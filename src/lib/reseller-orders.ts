import "server-only";
import { db, all, get, run } from "./db";
import { getOrderById, cleanComments, logEvent, sendToProvider } from "./orders";
import { precioDePedido, servicioVendible } from "./reseller-catalog";
import { costUsd } from "./pricing";
import { orderCode } from "./utils";
import { movimiento } from "./wallet";
import type { Order } from "./types";

/**
 * Pedidos hechos desde el panel SMM.
 *
 * Reutilizan la tabla `orders` de la tienda a propósito: así el despacho al
 * proveedor, el reintento del cron y la actualización de estados son
 * exactamente el mismo código ya probado, y no hay dos caminos que se puedan
 * desincronizar. Lo único distinto es que nacen pagados —con saldo— y que
 * llevan `reseller_user_id`.
 *
 * El orden importa y es el siguiente:
 *
 *   1. Se valida todo con la plata todavía quieta.
 *   2. En una sola transacción se crea el pedido y se descuenta el saldo. Si
 *      el saldo no alcanza, no queda nada a medias.
 *   3. Recién después se manda al proveedor. Si el proveedor falla, el pedido
 *      queda pagado y sin despachar, que es un estado que la tienda ya sabe
 *      manejar: el cron lo reintenta solo y el dueño lo ve en su panel. La
 *      plata no se pierde y, si no hay forma de entregarlo, se devuelve al
 *      saldo con `reembolsar`.
 */

export type CrearPedidoInput = {
  userId: number;
  serviceId: number;
  link: string;
  quantity: number;
  /** Solo para servicios de comentarios personalizados: uno por línea. */
  comments?: string;
};

export type CrearPedidoResult =
  | { ok: true; order: Order; despachado: boolean; aviso?: string }
  | { ok: false; error: string };

export async function crearPedidoDePanel(input: CrearPedidoInput): Promise<CrearPedidoResult> {
  const usuario = get<{ id: number; email: string; discount_percent: number; status: string }>(
    "SELECT id, email, discount_percent, status FROM reseller_users WHERE id = ?",
    [input.userId],
  );
  if (!usuario) return { ok: false, error: "Cuenta no encontrada." };
  if (usuario.status === "blocked") return { ok: false, error: "Tu cuenta está suspendida." };

  const service = servicioVendible(input.serviceId);
  if (!service) {
    return { ok: false, error: "Ese servicio ya no está disponible. Elige otro del catálogo." };
  }

  const link = input.link.trim();
  if (!/^https?:\/\/\S+$/i.test(link) && !/^@?[\w.\-]{2,}$/.test(link)) {
    return { ok: false, error: "Revisa el enlace o el usuario de destino." };
  }

  // En los comentarios personalizados la cantidad la ponen las líneas escritas,
  // no un número aparte: el proveedor cobra por comentario entregado.
  const esComentarios = service.order_kind === "custom_comments";
  const lineas = esComentarios ? cleanComments(input.comments ?? "") : [];
  if (esComentarios && lineas.length === 0) {
    return { ok: false, error: "Escribe al menos un comentario, uno por línea." };
  }
  const quantity = esComentarios ? lineas.length : Math.round(input.quantity);

  if (!Number.isFinite(quantity) || quantity < service.min_qty || quantity > service.max_qty) {
    return {
      ok: false,
      error: esComentarios
        ? `Este servicio acepta entre ${service.min_qty} y ${service.max_qty} comentarios. Escribiste ${quantity}.`
        : `La cantidad debe estar entre ${service.min_qty} y ${service.max_qty}.`,
    };
  }

  const precio = precioDePedido(service, quantity, usuario.discount_percent);

  // Paso 2: pedido y cobro, todo junto o nada.
  const crear = db.transaction((): { ok: true; orderId: number } | { ok: false; error: string } => {
    const saldoActual = get<{ balance_clp: number }>(
      "SELECT balance_clp FROM reseller_users WHERE id = ?",
      [usuario.id],
    )!.balance_clp;
    if (saldoActual < precio) {
      return {
        ok: false,
        error: `Te falta saldo: el pedido cuesta ${precio.toLocaleString("es-CL")} y tienes ${saldoActual.toLocaleString("es-CL")}. Recarga y vuelve a intentarlo.`,
      };
    }

    const info = db
      .prepare(
        `INSERT INTO orders
           (code, product_id, product_name, provider_service_id, reference_service_id, quantity,
            link, comments, email, amount_clp, cost_usd, payment_provider, status, payment_status,
            paid_at, reseller_user_id)
         VALUES (?, NULL, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'saldo', 'paid', 'paid', datetime('now'), ?)`,
      )
      .run(
        codigoLibre(),
        service.clean_name || service.name,
        service.service_id,
        service.service_id,
        quantity,
        link,
        lineas.length ? lineas.join("\n") : null,
        usuario.email,
        precio,
        costUsd(service.rate_usd_per_1000, quantity),
        usuario.id,
      );
    const orderId = Number(info.lastInsertRowid);

    const cobro = movimiento({
      userId: usuario.id,
      kind: "pedido",
      amountClp: -precio,
      orderId,
      note: `${service.clean_name || service.name} · ${quantity.toLocaleString("es-CL")} u.`,
    });
    // `movimiento` corre dentro de esta misma transacción: si no pudo cobrar,
    // lanzamos y el pedido recién insertado se va con ella.
    if (!cobro.ok) throw new Error(cobro.error);

    return { ok: true, orderId };
  });

  let creado: { ok: true; orderId: number } | { ok: false; error: string };
  try {
    creado = crear();
  } catch (error) {
    const mensaje = error instanceof Error ? error.message : "No se pudo crear el pedido.";
    return { ok: false, error: mensaje };
  }
  if (!creado.ok) return creado;

  const order = getOrderById(creado.orderId)!;
  logEvent(
    order.id,
    "created",
    `Pedido del panel mayorista: servicio #${service.service_id}, ${quantity.toLocaleString("es-CL")} u. por ${precio.toLocaleString("es-CL")} CLP de saldo.`,
  );

  // Paso 3: al proveedor. Un fallo aquí no rompe nada: queda pagado y sin
  // despachar, el cron lo reintenta y el dueño recibe el aviso.
  const envio = await sendToProvider(order.id);
  return {
    ok: true,
    order: getOrderById(order.id)!,
    despachado: envio.ok,
    aviso: envio.ok
      ? undefined
      : "El pedido quedó en cola: no pudo entrar a entrega en este momento y se reintenta solo. Si no sale, te devolvemos el saldo.",
  };
}

function codigoLibre(): string {
  for (let i = 0; i < 12; i++) {
    const code = orderCode();
    if (!get("SELECT 1 FROM orders WHERE code = ?", [code])) return code;
  }
  return `TS-${Date.now().toString(36).toUpperCase()}`;
}

/**
 * Devuelve al saldo lo que costó un pedido que no se va a entregar.
 *
 * El índice único de `wallet_entries` hace que un pedido no se pueda
 * reembolsar dos veces, aunque se apriete el botón mil veces.
 */
export function reembolsar(orderId: number, note = "Pedido no entregado"): { ok: boolean; error?: string } {
  const order = getOrderById(orderId);
  if (!order) return { ok: false, error: "Pedido no encontrado." };
  if (!order.reseller_user_id) return { ok: false, error: "Ese pedido no es del panel mayorista." };
  if (yaReembolsado(orderId)) return { ok: false, error: "Ese pedido ya fue reembolsado." };

  const result = movimiento({
    userId: order.reseller_user_id,
    kind: "reembolso",
    amountClp: order.amount_clp,
    orderId,
    note: `${order.code}: ${note}`,
  });
  if (!result.ok) return { ok: false, error: result.error };

  run(
    "UPDATE orders SET status = 'refunded', updated_at = datetime('now') WHERE id = ?",
    [orderId],
  );
  logEvent(orderId, "refunded", `Saldo devuelto al cliente (${order.amount_clp.toLocaleString("es-CL")} CLP). ${note}`);
  return { ok: true };
}

export function yaReembolsado(orderId: number): boolean {
  return Boolean(
    get("SELECT 1 FROM wallet_entries WHERE order_id = ? AND kind = 'reembolso'", [orderId]),
  );
}

export function pedidosDelCliente(userId: number, limit = 30, offset = 0): Order[] {
  return all<Order>(
    "SELECT * FROM orders WHERE reseller_user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
    [userId, limit, offset],
  );
}

export function contarPedidosDelCliente(userId: number): number {
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE reseller_user_id = ?", [userId])?.n ?? 0;
}

export function pedidoDelCliente(userId: number, orderId: number): Order | undefined {
  return get<Order>("SELECT * FROM orders WHERE id = ? AND reseller_user_id = ?", [orderId, userId]);
}

/** ¿Este pedido salió de un servicio con reposición? Habilita pedirla. */
export function tieneReposicion(order: Order): boolean {
  const service = get<{ refill: number; refill_days: number }>(
    "SELECT refill, refill_days FROM provider_services WHERE service_id = ?",
    [order.provider_service_id],
  );
  return Boolean(service && (service.refill === 1 || service.refill_days > 0));
}

export function estadisticasCliente(userId: number) {
  return {
    pedidos: contarPedidosDelCliente(userId),
    enCurso: get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM orders WHERE reseller_user_id = ? AND status IN ('paid','processing','partial')",
      [userId],
    )?.n ?? 0,
    completados: get<{ n: number }>(
      "SELECT COUNT(*) AS n FROM orders WHERE reseller_user_id = ? AND status = 'completed'",
      [userId],
    )?.n ?? 0,
    gastado: get<{ v: number }>(
      "SELECT COALESCE(SUM(amount_clp), 0) AS v FROM orders WHERE reseller_user_id = ? AND status != 'refunded'",
      [userId],
    )?.v ?? 0,
  };
}
