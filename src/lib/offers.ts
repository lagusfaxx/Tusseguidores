import { all } from "./db";
import { ROUTABLE_GEOS, SUPPORTED_ORDER_KINDS } from "./quality.mjs";
import { autoPriceClp, pricingContext } from "./pricing";

/**
 * Qué puede vender la tienda, visto desde arriba.
 *
 * En vez de mostrar los casi 2.000 servicios del proveedor, agrupamos lo que
 * hay en combinaciones "red social + qué vendes", que es como piensa quien
 * arma el catálogo. Cada combinación ya trae el mejor servicio disponible y su
 * precio de venta, así que crear el producto es un clic.
 */

export type Offer = {
  platform: string;
  service_type: string;
  order_kind: string;
  services: number;
  best_service_id: number;
  best_name: string;
  best_rate: number;
  best_min: number;
  best_max: number;
  score: number;
  /** Cuántos productos publicados ya usan esta combinación. */
  used: number;
};

const geoMarks = ROUTABLE_GEOS.map(() => "?").join(",");
const kindMarks = SUPPORTED_ORDER_KINDS.map(() => "?").join(",");

export function listOffers(platform?: string): Offer[] {
  const rows = all<Offer>(
    `WITH candidatos AS (
       SELECT s.*, (s.drop_score * 0.55 + s.speed_score * 0.45) AS score
         FROM provider_services s
        WHERE s.provider_enabled = 1
          AND s.variant = ''
          AND s.geo IN (${geoMarks})
          AND s.order_kind IN (${kindMarks})
          AND s.rate_usd_per_1000 > 0
          ${platform ? "AND s.platform = ?" : ""}
     ),
     mejores AS (
       SELECT platform, service_type, order_kind, MAX(score) AS score
         FROM candidatos GROUP BY platform, service_type, order_kind
     )
     SELECT c.platform, c.service_type, c.order_kind,
            (SELECT COUNT(*) FROM candidatos x
              WHERE x.platform = c.platform AND x.service_type = c.service_type
                AND x.order_kind = c.order_kind) AS services,
            c.service_id  AS best_service_id,
            c.clean_name  AS best_name,
            c.rate_usd_per_1000 AS best_rate,
            c.min_qty     AS best_min,
            c.max_qty     AS best_max,
            c.score,
            (SELECT COUNT(*) FROM products p
               JOIN provider_services ps ON ps.service_id = p.provider_service_id
              WHERE p.platform = c.platform AND p.service_type = c.service_type
                AND ps.order_kind = c.order_kind) AS used
       FROM candidatos c
       JOIN mejores m
         ON m.platform = c.platform AND m.service_type = c.service_type
        AND m.order_kind = c.order_kind AND m.score = c.score
      GROUP BY c.platform, c.service_type, c.order_kind
      ORDER BY services DESC`,
    platform
      ? [...ROUTABLE_GEOS, ...SUPPORTED_ORDER_KINDS, platform]
      : [...ROUTABLE_GEOS, ...SUPPORTED_ORDER_KINDS],
  );
  return rows;
}

export function findOffer(platform: string, serviceType: string, orderKind: string): Offer | undefined {
  return listOffers(platform).find(
    (offer) => offer.service_type === serviceType && offer.order_kind === orderKind,
  );
}

/** Escaleras de cantidad sugeridas, iguales a las que usa el sembrado. */
export const LADDERS: Record<string, number[]> = {
  seguidores: [100, 250, 500, 1000, 2500, 5000],
  suscriptores: [100, 250, 500, 1000, 2500, 5000],
  miembros: [100, 500, 1000, 2500, 5000, 10000],
  likes: [50, 100, 250, 500, 1000, 2500],
  reacciones: [50, 100, 250, 500, 1000],
  vistas: [1000, 2500, 5000, 10000, 25000, 50000],
  reproducciones: [1000, 2500, 5000, 10000, 25000],
  comentarios: [10, 25, 50, 100, 250],
  custom_comments: [5, 10, 20, 50],
  compartidos: [100, 250, 500, 1000, 2500],
  guardados: [100, 250, 500, 1000, 2500],
  historias: [500, 1000, 2500, 5000, 10000],
  "en-vivo": [100, 250, 500, 1000],
  trafico: [1000, 5000, 10000, 25000],
};

/**
 * Cantidad con la que tiene sentido comparar servicios de este tipo. Comparar
 * comentarios de a 1.000 no dice nada: los packs van de 10 a 250.
 */
export function cantidadDeReferencia(serviceType: string, orderKind = "default"): number {
  const key = orderKind === "custom_comments" ? "custom_comments" : serviceType;
  const base = LADDERS[key] ?? LADDERS.seguidores;
  return base[Math.min(2, base.length - 1)];
}

export function ladderFor(offer: Offer): number[] {
  const key = offer.order_kind === "custom_comments" ? "custom_comments" : offer.service_type;
  const base = LADDERS[key] ?? LADDERS.seguidores;
  const ladder = base.filter((q) => q >= offer.best_min && q <= offer.best_max).slice(0, 6);
  return ladder.length ? ladder : [Math.max(offer.best_min, 1)];
}

/** Precios que tendría el producto si se creara ahora. */
export function previewPrices(offer: Offer): { quantity: number; priceClp: number }[] {
  const ctx = pricingContext();
  const type = offer.order_kind === "custom_comments" ? "comentarios" : offer.service_type;
  return ladderFor(offer).map((quantity) => ({
    quantity,
    priceClp: autoPriceClp(offer.best_rate, quantity, type, ctx),
  }));
}
