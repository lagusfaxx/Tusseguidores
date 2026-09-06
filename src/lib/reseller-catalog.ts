import "server-only";
import { all, get } from "./db";
import { resellerContext, resellerPriceClp, resellerRatePer1000 } from "./pricing";
import { SUPPORTED_ORDER_KINDS } from "./quality.mjs";
import { PLATFORM_PRIORITY } from "./labels";
import type { ProviderService } from "./types";

/**
 * Catálogo que ve el cliente mayorista.
 *
 * A diferencia de la tienda, aquí el cliente elige el servicio del proveedor
 * directamente —con su número, su rango y sus puntajes—, como en cualquier
 * panel SMM. No hay enrutado automático: lo que pide es exactamente lo que se
 * despacha, y por eso puede comparar dos servicios de la misma categoría y
 * quedarse con el que más le sirve.
 *
 * Solo se muestran las formas de pedido que sabemos atender de punta a punta:
 * cantidad + enlace, y comentarios personalizados. Ofrecer una encuesta o una
 * suscripción sin la pantalla que las pide sería vender algo que va a fallar.
 */

export const FORMAS_SOPORTADAS = ["default", "custom_comments"] as const;
const MARCAS = FORMAS_SOPORTADAS.map(() => "?").join(",");

export type ServicioPanel = ProviderService & {
  /** Precio mayorista por 1.000 unidades, ya con el descuento del cliente. */
  ratePer1000Clp: number;
};

export type FiltroCatalogo = {
  q?: string;
  platform?: string;
  serviceType?: string;
  /** Solo servicios con reposición. */
  refill?: boolean;
  limit?: number;
  offset?: number;
};

/**
 * Orden de las redes en el catálogo del panel.
 *
 * Sin esto la lista empieza por "Audiomack" —alfabético— y el cliente tiene
 * que buscar Instagram cuatro páginas más adelante.
 */
const ORDEN_REDES = `CASE s.platform ${PLATFORM_PRIORITY.map(
  (slug, i) => `WHEN '${slug}' THEN ${i}`,
).join(" ")} ELSE 99 END`;

function condiciones(filtro: FiltroCatalogo): { clause: string; params: unknown[] } {
  const where = [
    "s.provider_enabled = 1",
    "s.rate_usd_per_1000 > 0",
    `s.order_kind IN (${MARCAS})`,
  ];
  const params: unknown[] = [...FORMAS_SOPORTADAS];

  if (filtro.q?.trim()) {
    where.push("(s.clean_name LIKE ? OR s.name LIKE ? OR CAST(s.service_id AS TEXT) = ?)");
    const like = `%${filtro.q.trim()}%`;
    params.push(like, like, filtro.q.trim());
  }
  if (filtro.platform) {
    where.push("s.platform = ?");
    params.push(filtro.platform);
  }
  if (filtro.serviceType) {
    where.push("s.service_type = ?");
    params.push(filtro.serviceType);
  }
  if (filtro.refill) where.push("(s.refill = 1 OR s.refill_days > 0)");

  return { clause: `WHERE ${where.join(" AND ")}`, params };
}

export function contarServicios(filtro: FiltroCatalogo = {}): number {
  const { clause, params } = condiciones(filtro);
  return get<{ n: number }>(`SELECT COUNT(*) AS n FROM provider_services s ${clause}`, params)?.n ?? 0;
}

export function listarServicios(
  filtro: FiltroCatalogo = {},
  discountPercent = 0,
): ServicioPanel[] {
  const { clause, params } = condiciones(filtro);
  const ctx = resellerContext();
  const filas = all<ProviderService>(
    `SELECT s.* FROM provider_services s ${clause}
      ORDER BY ${ORDEN_REDES}, s.platform, s.service_type,
               (s.drop_score * 0.55 + s.speed_score * 0.45) DESC, s.rate_usd_per_1000
      LIMIT ? OFFSET ?`,
    [...params, filtro.limit ?? 50, filtro.offset ?? 0],
  );
  return filas.map((s) => ({
    ...s,
    ratePer1000Clp: resellerRatePer1000(s.rate_usd_per_1000, ctx, discountPercent),
  }));
}

/** Un servicio, solo si se puede vender en el panel. */
export function servicioVendible(serviceId: number): ProviderService | undefined {
  return get<ProviderService>(
    `SELECT * FROM provider_services
      WHERE service_id = ? AND provider_enabled = 1 AND rate_usd_per_1000 > 0
        AND order_kind IN (${MARCAS})`,
    [serviceId, ...FORMAS_SOPORTADAS],
  );
}

/** Precio de un pedido concreto, con el descuento del cliente ya aplicado. */
export function precioDePedido(
  service: Pick<ProviderService, "rate_usd_per_1000">,
  quantity: number,
  discountPercent = 0,
): number {
  return resellerPriceClp(service.rate_usd_per_1000, quantity, resellerContext(), discountPercent);
}

/** Redes que tienen algo vendible, para el filtro. */
export function redesDelPanel(): { platform: string; n: number }[] {
  return all<{ platform: string; n: number }>(
    `SELECT platform, COUNT(*) AS n FROM provider_services
      WHERE provider_enabled = 1 AND rate_usd_per_1000 > 0
        AND order_kind IN (${MARCAS})
      GROUP BY platform ORDER BY ${ORDEN_REDES.replace(/s\./g, "")}, n DESC`,
    [...FORMAS_SOPORTADAS],
  );
}

export function tiposDelPanel(): { service_type: string; n: number }[] {
  return all<{ service_type: string; n: number }>(
    `SELECT service_type, COUNT(*) AS n FROM provider_services
      WHERE provider_enabled = 1 AND rate_usd_per_1000 > 0
        AND order_kind IN (${MARCAS})
      GROUP BY service_type ORDER BY n DESC`,
    [...FORMAS_SOPORTADAS],
  );
}

/** Etiquetas legibles de los puntajes, para no mostrar "72/100" y nada más. */
export function etiquetaRetencion(score: number): string {
  if (score >= 80) return "Muy estable";
  if (score >= 60) return "Estable";
  if (score >= 40) return "Media";
  return "Puede caer";
}

export function etiquetaVelocidad(score: number): string {
  if (score >= 80) return "Muy rápido";
  if (score >= 60) return "Rápido";
  if (score >= 40) return "Normal";
  return "Lento";
}

/** El SUPPORTED_ORDER_KINDS del proveedor, expuesto para las pantallas. */
export { SUPPORTED_ORDER_KINDS };
