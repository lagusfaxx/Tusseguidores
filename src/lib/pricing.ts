import { getNumberSetting, getSetting } from "./settings";
import { levelFloorFactor } from "./level-defs";
import type { PricedTier, Product, Tier } from "./types";

/**
 * Precio de venta = costo del proveedor convertido a CLP + margen,
 * con dos pisos que evitan packs regalados:
 *   - min_price_clp: ticket mínimo de la tienda.
 *   - min_rate_clp_per_1000: precio mínimo por cada 1.000 unidades, distinto
 *     según el tipo de servicio (mil visualizaciones no valen lo mismo que
 *     mil seguidores). Es lo que mantiene la escalera de packs creciente
 *     cuando el costo del proveedor es de centavos.
 */

export const DEFAULT_MIN_RATES: Record<string, number> = {
  seguidores: 4900,
  suscriptores: 9900,
  miembros: 3900,
  likes: 2900,
  reacciones: 2900,
  vistas: 490,
  reproducciones: 990,
  comentarios: 39000,
  compartidos: 2900,
  guardados: 2900,
  historias: 690,
  "en-vivo": 9900,
  votos: 4900,
  menciones: 4900,
  trafico: 990,
  premium: 9900,
  resenas: 39000,
  otros: 2900,
};

export type PricingContext = {
  usdClp: number;
  marginPercent: number;
  rounding: number;
  minPriceClp: number;
  minRates: Record<string, number>;
};

export function parseMinRates(raw: string): Record<string, number> {
  if (!raw.trim()) return { ...DEFAULT_MIN_RATES };
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out = { ...DEFAULT_MIN_RATES };
    for (const [key, value] of Object.entries(parsed)) {
      const n = Number(value);
      if (Number.isFinite(n) && n >= 0) out[key] = n;
    }
    return out;
  } catch {
    return { ...DEFAULT_MIN_RATES };
  }
}

export function pricingContext(): PricingContext {
  return {
    usdClp: getNumberSetting("usd_clp", 980),
    marginPercent: getNumberSetting("margin_percent", 180),
    rounding: getNumberSetting("price_rounding", 90),
    minPriceClp: getNumberSetting("min_price_clp", 1990),
    minRates: parseMinRates(getSetting("min_rate_json", "")),
  };
}

/** Costo real que nos cobra el proveedor, en USD. */
export function costUsd(rateUsdPer1000: number, quantity: number): number {
  return (rateUsdPer1000 / 1000) * quantity;
}

/**
 * Redondea hacia arriba a una terminación comercial.
 * Con rounding = 90 -> 4.312 se convierte en 4.390.
 */
export function roundToEnding(value: number, ending: number): number {
  if (ending <= 0) return Math.ceil(value / 10) * 10;
  const step = ending < 100 ? 100 : 1000;
  const base = Math.floor(value / step) * step + ending;
  return base >= value ? base : base + step;
}

/** Piso por 1.000 de un tipo de servicio, ya escalado al nivel de calidad. */
export function floorPer1000(
  serviceType: string,
  ctx: PricingContext,
  level?: string | null,
): number {
  return (ctx.minRates[serviceType] ?? ctx.minRates.otros ?? 2900) * levelFloorFactor(level);
}

export function autoPriceClp(
  rateUsdPer1000: number,
  quantity: number,
  serviceType: string,
  ctx: PricingContext,
  marginOverride?: number | null,
  level?: string | null,
): number {
  const margin = marginOverride ?? ctx.marginPercent;
  const withMargin = costUsd(rateUsdPer1000, quantity) * ctx.usdClp * (1 + margin / 100);
  const rateFloor = (quantity / 1000) * floorPer1000(serviceType, ctx, level);
  return Math.max(ctx.minPriceClp, roundToEnding(Math.max(withMargin, rateFloor), ctx.rounding));
}

export type PriceBreakdown = {
  priceClp: number;
  /** Cuál de los dos términos fijó el precio. */
  origen: "costo" | "piso" | "minimo";
  /** Cuántas veces el costo del proveedor es el precio de venta. */
  multiplo: number;
  /** Lo que le pagas al proveedor por esa cantidad. */
  costoClp: number;
  /** Lo que te queda: precio de venta menos costo. */
  gananciaClp: number;
};

/**
 * Precio con el detalle de por qué salió ese número.
 *
 * Sirve para el catálogo del panel: cuando el piso por tipo de servicio es más
 * alto que el costo con margen, varios servicios de costos muy distintos
 * terminan con el mismo precio, y sin esta explicación parece un error.
 */
export function priceBreakdown(
  rateUsdPer1000: number,
  quantity: number,
  serviceType: string,
  ctx: PricingContext,
  marginOverride?: number | null,
  level?: string | null,
): PriceBreakdown {
  const margin = marginOverride ?? ctx.marginPercent;
  const costoClp = costUsd(rateUsdPer1000, quantity) * ctx.usdClp;
  const conMargen = costoClp * (1 + margin / 100);
  const piso = (quantity / 1000) * floorPer1000(serviceType, ctx, level);

  const base = Math.max(conMargen, piso);
  const priceClp = Math.max(ctx.minPriceClp, roundToEnding(base, ctx.rounding));

  const origen: PriceBreakdown["origen"] =
    priceClp > roundToEnding(base, ctx.rounding) ? "minimo" : piso > conMargen ? "piso" : "costo";

  return {
    priceClp,
    origen,
    multiplo: costoClp > 0 ? priceClp / costoClp : 0,
    costoClp,
    gananciaClp: priceClp - costoClp,
  };
}

type PriceableProduct = Pick<Product, "price_mode" | "margin_override" | "service_type"> & {
  /** Nivel de calidad, si el producto es parte de una escalera de niveles. */
  level?: string | null;
};

export function priceTier(
  tier: Tier,
  product: PriceableProduct,
  rateUsdPer1000: number,
  ctx: PricingContext,
): PricedTier {
  // Un precio manual guardado siempre manda; el modo "auto" ignora overrides.
  const useManual = product.price_mode === "manual" && tier.price_clp != null;
  const priceClp = useManual
    ? (tier.price_clp as number)
    : autoPriceClp(
        rateUsdPer1000, tier.quantity, product.service_type, ctx,
        product.margin_override, product.level,
      );
  return {
    id: tier.id,
    quantity: tier.quantity,
    priceClp,
    unitClp: priceClp / tier.quantity,
    popular: tier.popular === 1,
    manual: useManual,
  };
}

/** Precio de una cantidad arbitraria (selector de cantidad libre). */
export function priceCustomQuantity(
  quantity: number,
  product: PriceableProduct,
  rateUsdPer1000: number,
  ctx: PricingContext,
): number {
  return autoPriceClp(
    rateUsdPer1000, quantity, product.service_type, ctx, product.margin_override, product.level,
  );
}

const CLP = new Intl.NumberFormat("es-CL", {
  style: "currency",
  currency: "CLP",
  maximumFractionDigits: 0,
});

export function formatClp(value: number): string {
  return CLP.format(Math.round(value));
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("es-CL").format(Math.round(value));
}

/** "1 h 30 min" a partir de minutos. */
export function formatDuration(minutes: number | null | undefined): string | null {
  if (minutes == null || minutes <= 0) return null;
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 1440) {
    const h = Math.floor(minutes / 60);
    const m = minutes % 60;
    return m ? `${h} h ${m} min` : `${h} h`;
  }
  return `${Math.round(minutes / 1440)} días`;
}
