import { all, get } from "./db";
import { DROP_WEIGHT, SPEED_WEIGHT, ROUTABLE_GEOS, SUPPORTED_ORDER_KINDS } from "./quality.mjs";
import type { ProviderService } from "./types";

/**
 * Enrutado de pedidos.
 *
 * El cliente elige un producto, no un servicio del proveedor. Aquí decidimos a
 * cuál de los servicios equivalentes se lo pedimos: el de mejor combinación de
 * "no se cae" y "entrega rápido", siempre que su costo no se dispare por sobre
 * el servicio de referencia con el que calculamos el precio de venta.
 *
 * De paso esto resuelve solo el problema de los servicios que el proveedor
 * desactiva: dejan de ser candidatos y el pedido se va al mejor que quede.
 */

export type Candidate = ProviderService & { score: number };

const SCORE = `(s.drop_score * ${DROP_WEIGHT} + s.speed_score * ${SPEED_WEIGHT})`;

export type RoutingInput = {
  platform: string;
  serviceType: string;
  quantity: number;
  /** Servicio con el que se calculó el precio. */
  referenceServiceId: number;
  referenceRateUsd: number;
  maxCostRatio: number;
  /**
   * Plazo prometido al cliente, en minutos. Ningún candidato puede tardar
   * mucho más que esto: la ficha decía "inicio inmediato" y el pedido salía a
   * un servicio de veinte horas, que es exactamente la promesa que no hay que
   * romper.
   */
  promisedMinutes?: number | null;
  /** Subtipo del servicio de referencia: solo enrutamos dentro del mismo. */
  variant?: string;
  /**
   * Forma de pedido del producto. Nunca se enruta entre formas distintas: un
   * servicio de comentarios personalizados espera el texto de los comentarios,
   * no una cantidad.
   */
  orderKind?: string;
};

const GEO_MARKS = ROUTABLE_GEOS.map(() => "?").join(",");

/**
 * Todos los servicios que podrían atender este pedido, del mejor al peor.
 *
 * Se descarta lo que no corresponde aunque puntúe alto: servicios apuntados a
 * un país que no es el público de la tienda y subtipos distintos al del
 * producto (likes de transmisión en vivo cuando lo que se vendió son likes de
 * una publicación, por ejemplo), y formas de pedido distintas a la del
 * producto.
 */
export function rankCandidates(input: RoutingInput, limit = 10): Candidate[] {
  const budget = input.referenceRateUsd * Math.max(1, input.maxCostRatio);

  // Tope de tiempo: hasta el doble de lo prometido, y nunca más de un día si
  // se prometió algo rápido. Un servicio sin plazo declarado (NULL) pasa: es
  // lo que hay para casi todo el catálogo y descartarlo dejaría sin candidatos.
  const techo =
    input.promisedMinutes != null && input.promisedMinutes > 0
      ? Math.max(input.promisedMinutes * 2, 120)
      : null;

  return all<Candidate>(
    `SELECT s.*, ${SCORE} AS score
       FROM provider_services s
      WHERE s.provider_enabled = 1
        AND s.platform = ?
        AND s.service_type = ?
        AND s.variant = ?
        AND s.order_kind = ?
        AND s.geo IN (${GEO_MARKS})
        AND s.min_qty <= ?
        AND s.max_qty >= ?
        AND s.rate_usd_per_1000 > 0
        AND s.rate_usd_per_1000 <= ?
        ${techo != null ? "AND COALESCE(s.avg_minutes, s.start_minutes) <= ?" : ""}
      ORDER BY score DESC, s.rate_usd_per_1000 ASC
      LIMIT ?`,
    [
      input.platform, input.serviceType, input.variant ?? "",
      input.orderKind ?? "default", ...ROUTABLE_GEOS,
      input.quantity, input.quantity, budget,
      ...(techo != null ? [techo] : []),
      limit,
    ],
  );
}

export type Routed = {
  service: ProviderService;
  score: number;
  /** true si se eligió automáticamente y no es el de referencia. */
  rerouted: boolean;
  reason: string;
};

/**
 * Elige el servicio al que se enviará el pedido.
 * Si no hay ningún candidato mejor, cae al de referencia siempre que siga activo.
 */
export function pickService(input: RoutingInput, autoSelect: boolean): Routed | null {
  const reference = get<ProviderService>(
    "SELECT * FROM provider_services WHERE service_id = ?",
    [input.referenceServiceId],
  );

  // Solo sabemos vender las formas de pedido que la tienda implementa.
  if (reference && !SUPPORTED_ORDER_KINDS.includes(reference.order_kind)) return null;

  const referenceUsable =
    reference != null &&
    reference.provider_enabled === 1 &&
    reference.min_qty <= input.quantity &&
    reference.max_qty >= input.quantity;

  if (!autoSelect) {
    if (!referenceUsable) return null;
    return {
      service: reference,
      score: reference.drop_score * DROP_WEIGHT + reference.speed_score * SPEED_WEIGHT,
      rerouted: false,
      reason: "Servicio fijo del producto.",
    };
  }

  // Con el tope de tiempo puede no quedar ninguno: se reintenta sin él, porque
  // es mejor entregar tarde que no entregar.
  const best = rankCandidates(input, 1)[0] ??
    (input.promisedMinutes != null
      ? rankCandidates({ ...input, promisedMinutes: null }, 1)[0]
      : undefined);
  if (!best) {
    if (!referenceUsable) return null;
    return {
      service: reference,
      score: reference.drop_score * DROP_WEIGHT + reference.speed_score * SPEED_WEIGHT,
      rerouted: false,
      reason: "No había alternativas dentro del presupuesto; se usó el servicio de referencia.",
    };
  }

  if (best.service_id === input.referenceServiceId) {
    return {
      service: best,
      score: best.score,
      rerouted: false,
      reason: "El servicio de referencia ya era el mejor disponible.",
    };
  }

  return {
    service: best,
    score: best.score,
    rerouted: true,
    reason: referenceUsable
      ? `Elegido por calidad: retención ${best.drop_score}/100 y velocidad ${best.speed_score}/100.`
      : `El servicio de referencia no estaba disponible; se enrutó al mejor activo (#${best.service_id}).`,
  };
}

/** Datos de enrutado para un producto, tal como se usan en la ficha y el panel. */
export function routingForProduct(
  product: {
    platform: string;
    service_type: string;
    provider_service_id: number;
    max_cost_ratio: number;
    auto_select: number;
    min_qty: number;
    /** Subtipo y forma de pedido del servicio de referencia. */
    variant?: string;
    order_kind?: string;
  },
  referenceRateUsd: number,
  quantity?: number,
): Routed | null {
  return pickService(
    {
      platform: product.platform,
      serviceType: product.service_type,
      quantity: quantity ?? product.min_qty,
      referenceServiceId: product.provider_service_id,
      referenceRateUsd,
      maxCostRatio: product.max_cost_ratio,
      variant: product.variant ?? "",
      orderKind: product.order_kind ?? "default",
    },
    product.auto_select === 1,
  );
}
