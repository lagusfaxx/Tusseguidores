import "server-only";
import { all, get, run } from "./db";
import { getBoolSetting, getNumberSetting, getSetting } from "./settings";
import { ROUTABLE_GEOS } from "./quality.mjs";
import { PROVEEDOR_PRINCIPAL } from "./provider";
import { platformLabel, sortPlatforms } from "./labels";
import { revisarDestino } from "./targets";
import { costUsd } from "./pricing";
import { orderCode, isValidEmail } from "./utils";
import {
  getOrderByCode, getOrderById, isFundsError, logEvent, sendToProvider, setStatus,
} from "./orders";
import type { Order, ProviderService } from "./types";

/**
 * Prueba gratis: unos pocos seguidores, una sola vez por cuenta.
 *
 * Es para quien desconfía: ve llegar algo antes de pagar. La cuenta que la
 * recibe queda anotada en `trial_claims` para siempre y no se le vuelve a
 * enviar, la pida quien la pida y con el correo que sea.
 *
 * El pedido es uno normal de $0 ya "pagado", sin producto: así se despacha,
 * se sigue y se ve en el panel como cualquier otro, y el servicio que se usa
 * es exactamente el que se eligió aquí.
 */

export const MEDIO_PRUEBA = "prueba";

export function esPrueba(order: Pick<Order, "payment_provider">): boolean {
  return order.payment_provider === MEDIO_PRUEBA;
}

export function cantidadDePrueba(): number {
  return Math.max(1, Math.round(getNumberSetting("trial_quantity", 20)));
}

/**
 * El servicio de seguidores más barato entre los rápidos, del proveedor que
 * hoy atiende esa red (el de su producto de seguidores publicado).
 */
function servicioDePrueba(platform: string, cantidad: number): ProviderService | undefined {
  const provider =
    get<{ provider: string }>(
      `SELECT s.provider FROM products p
         JOIN provider_services s ON s.service_id = p.provider_service_id
        WHERE p.platform = ? AND p.service_type = 'seguidores' AND p.published = 1
        ORDER BY p.sort_order, p.id LIMIT 1`,
      [platform],
    )?.provider ?? PROVEEDOR_PRINCIPAL;

  return get<ProviderService>(
    `SELECT * FROM provider_services
      WHERE provider_enabled = 1 AND provider = ? AND platform = ?
        AND service_type = 'seguidores' AND variant = '' AND order_kind = 'default'
        AND geo IN (${ROUTABLE_GEOS.map(() => "?").join(",")})
        AND min_qty <= ? AND max_qty >= ? AND rate_usd_per_1000 > 0
      ORDER BY (speed_score >= 80) DESC, rate_usd_per_1000 ASC, speed_score DESC
      LIMIT 1`,
    [provider, platform, ...ROUTABLE_GEOS, cantidad, cantidad],
  );
}

/** Redes donde se ofrece la prueba: las configuradas que además tienen servicio. */
export function redesDePrueba(): { platform: string; label: string }[] {
  if (!getBoolSetting("trial_enabled", true)) return [];
  const cantidad = cantidadDePrueba();
  const configuradas = getSetting("trial_platforms", "instagram,tiktok")
    .split(",")
    .map((p) => p.trim().toLowerCase())
    .filter(Boolean);
  return sortPlatforms(
    [...new Set(configuradas)]
      .filter((platform) => servicioDePrueba(platform, cantidad))
      .map((platform) => ({ platform })),
  ).map(({ platform }) => ({ platform, label: platformLabel(platform) }));
}

export function pruebaDisponible(platform?: string): boolean {
  const redes = redesDePrueba();
  return platform ? redes.some((r) => r.platform === platform) : redes.length > 0;
}

/**
 * Identidad de la cuenta: la misma aunque la escriban con @, con mayúsculas,
 * con www, con barra final o con parámetros de seguimiento.
 */
export function claveDeCuenta(platform: string, link: string): string {
  const limpio = link
    .trim()
    .toLowerCase()
    .replace(/^https?:\/\//, "")
    .replace(/^(www|m|mobile)\./, "")
    .replace(/[?#].*$/, "")
    .replace(/\/+$/, "")
    .replace(/\/@/, "/");
  return `${platform}:${limpio}`;
}

function codigoLibre(): string {
  for (let i = 0; i < 10; i++) {
    const code = orderCode();
    if (!getOrderByCode(code)) return code;
  }
  return `${orderCode()}${Date.now().toString(36).slice(-2).toUpperCase()}`;
}

export type ResultadoPrueba = { ok: true; code: string } | { ok: false; error: string };

export async function pedirPrueba(input: {
  platform: string;
  link: string;
  email: string;
  ip?: string | null;
}): Promise<ResultadoPrueba> {
  const platform = input.platform.trim().toLowerCase();
  if (!getBoolSetting("orders_enabled", true) || !pruebaDisponible(platform)) {
    return { ok: false, error: "La prueba gratis no está disponible en este momento." };
  }
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: "Revisa tu correo." };

  const revision = revisarDestino(input.link, platform, "seguidores");
  if (!revision.ok) return { ok: false, error: revision.error };
  const link = revision.link;
  const clave = claveDeCuenta(platform, link);

  const yaUsada = "Esa cuenta ya recibió su prueba gratis. Es una sola por cuenta.";
  if (get("SELECT id FROM trial_claims WHERE target_key = ?", [clave])) {
    return { ok: false, error: yaUsada };
  }

  // Topes para que nadie vacíe el saldo del proveedor con cuentas inventadas.
  const porIp = Math.max(1, getNumberSetting("trial_per_ip_daily", 3));
  if (input.ip) {
    const usadas = get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM trial_claims WHERE ip = ? AND created_at > datetime('now', '-1 day')",
      [input.ip],
    )?.n ?? 0;
    if (usadas >= porIp) {
      return { ok: false, error: "Ya pediste varias pruebas hoy. Vuelve a intentarlo mañana." };
    }
  }
  const tope = getNumberSetting("trial_daily_limit", 50);
  const hoy = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM trial_claims WHERE created_at > datetime('now', '-1 day')",
  )?.n ?? 0;
  if (tope > 0 && hoy >= tope) {
    return { ok: false, error: "Se acabaron las pruebas gratis de hoy. Vuelve mañana." };
  }

  const cantidad = cantidadDePrueba();
  const servicio = servicioDePrueba(platform, cantidad);
  if (!servicio) return { ok: false, error: "La prueba gratis no está disponible en este momento." };

  // La cuenta se reserva antes de crear nada: el índice único es lo que
  // impide dos pruebas a la misma cuenta aunque lleguen a la vez.
  try {
    run(
      "INSERT INTO trial_claims (target_key, platform, link, email, ip) VALUES (?, ?, ?, ?, ?)",
      [clave, platform, link, email, input.ip ?? null],
    );
  } catch {
    return { ok: false, error: yaUsada };
  }

  const code = codigoLibre();
  const info = run(
    `INSERT INTO orders
       (code, product_id, product_name, provider_service_id, reference_service_id, quantity,
        link, email, amount_clp, cost_usd, payment_provider, status, payment_status,
        payment_ref, paid_at, ip)
     VALUES (?, NULL, ?, ?, ?, ?, ?, ?, 0, ?, ?, 'paid', 'paid', 'prueba', datetime('now'), ?)`,
    [
      code, `Prueba gratis: ${cantidad} seguidores ${platformLabel(platform)}`,
      servicio.service_id, servicio.service_id, cantidad, link, email,
      costUsd(servicio.rate_usd_per_1000, cantidad), MEDIO_PRUEBA, input.ip ?? null,
    ],
  );
  const orderId = Number(info.lastInsertRowid);
  run("INSERT INTO order_targets (order_id, position, link, quantity) VALUES (?, 0, ?, ?)", [
    orderId, link, cantidad,
  ]);
  run("UPDATE trial_claims SET order_id = ? WHERE target_key = ?", [orderId, clave]);
  logEvent(orderId, "created", `Prueba gratis de ${cantidad} seguidores para ${link}.`);

  if (getBoolSetting("auto_send_to_provider", true)) {
    const envio = await sendToProvider(orderId);
    if (!envio.ok) {
      const pedido = getOrderById(orderId);
      const reintentable =
        isFundsError(envio.error) || /api key/i.test(envio.error) || Boolean(pedido?.provider_order_id);
      if (!reintentable) {
        // El proveedor no la aceptó (cuenta privada o que no existe). No se
        // entregó nada, así que la cuenta queda libre para intentarlo bien.
        setStatus(orderId, "canceled", "Prueba anulada: el proveedor no aceptó la cuenta.");
        run("DELETE FROM trial_claims WHERE target_key = ?", [clave]);
        return {
          ok: false,
          error: "No pudimos enviar la prueba a esa cuenta. Revisa que exista y esté pública.",
        };
      }
      // Sin saldo o sin llave: sale sola en la próxima pasada de mantenimiento.
    }
  }
  return { ok: true, code };
}

/** Para el panel: cuántas pruebas se han dado y cuántas terminaron en compra. */
export function pruebaStats() {
  const total = get<{ n: number }>("SELECT COUNT(*) AS n FROM trial_claims")?.n ?? 0;
  const compraron = get<{ n: number }>(
    `SELECT COUNT(DISTINCT c.email) AS n FROM trial_claims c
      WHERE EXISTS (SELECT 1 FROM orders o
                     WHERE o.email = c.email AND o.payment_status = 'paid'
                       AND o.payment_provider != '${MEDIO_PRUEBA}' AND o.amount_clp > 0
                       AND o.created_at >= c.created_at)`,
  )?.n ?? 0;
  const costo = get<{ v: number }>(
    `SELECT COALESCE(SUM(cost_usd), 0) AS v FROM orders
      WHERE payment_provider = '${MEDIO_PRUEBA}' AND status != 'canceled'`,
  )?.v ?? 0;
  return { total, compraron, costoUsd: costo };
}

/** Últimas cuentas que recibieron la prueba, para revisarlas en el panel. */
export function ultimasPruebas(limit = 50) {
  return all<{ link: string; platform: string; email: string; created_at: string; code: string | null }>(
    `SELECT c.link, c.platform, c.email, c.created_at, o.code
       FROM trial_claims c LEFT JOIN orders o ON o.id = c.order_id
      ORDER BY c.id DESC LIMIT ?`,
    [limit],
  );
}
