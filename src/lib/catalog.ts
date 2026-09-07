import { all, get } from "./db";
import { levelOrder } from "./level-defs";
import { serviceTypeOrder } from "./labels";
import { pricingContext, priceTier } from "./pricing";
import type { PricedTier, Product, ProviderService, Tier } from "./types";

export type ProductWithService = Product & {
  rate_usd_per_1000: number;
  provider_min: number;
  provider_max: number;
  provider_enabled: number;
  avg_minutes: number | null;
  start_minutes: number | null;
  provider_name: string;
  /** Subtipo, forma de pedido y calidad del servicio de referencia. */
  variant: string;
  order_kind: string;
  geo: string;
  drop_score: number;
  speed_score: number;
};

const PRODUCT_SELECT = `
  SELECT p.*,
         s.rate_usd_per_1000,
         s.min_qty        AS provider_min,
         s.max_qty        AS provider_max,
         s.provider_enabled,
         s.avg_minutes,
         s.start_minutes,
         s.name           AS provider_name,
         s.variant,
         s.order_kind,
         s.geo,
         s.drop_score,
         s.speed_score
    FROM products p
    JOIN provider_services s ON s.service_id = p.provider_service_id
`;

export function getPublishedProducts(): ProductWithService[] {
  return all<ProductWithService>(
    `${PRODUCT_SELECT} WHERE p.published = 1 AND s.provider_enabled = 1 ORDER BY p.sort_order, p.name`,
  );
}

export function getProductsByPlatform(platform: string): ProductWithService[] {
  return all<ProductWithService>(
    `${PRODUCT_SELECT}
      WHERE p.published = 1 AND s.provider_enabled = 1 AND p.platform = ?
      ORDER BY p.sort_order, p.name`,
    [platform],
  );
}

export function getFeaturedProducts(limit = 8): ProductWithService[] {
  return all<ProductWithService>(
    `${PRODUCT_SELECT}
      WHERE p.published = 1 AND s.provider_enabled = 1 AND p.featured = 1
      ORDER BY p.sort_order, p.name LIMIT ?`,
    [limit],
  );
}

export function getProductBySlug(slug: string): ProductWithService | undefined {
  return get<ProductWithService>(`${PRODUCT_SELECT} WHERE p.slug = ?`, [slug]);
}

export function getProductById(id: number): ProductWithService | undefined {
  return get<ProductWithService>(`${PRODUCT_SELECT} WHERE p.id = ?`, [id]);
}

export function getTiers(productId: number): Tier[] {
  return all<Tier>("SELECT * FROM product_tiers WHERE product_id = ? ORDER BY sort_order, quantity", [productId]);
}

export function getPricedTiers(product: ProductWithService): PricedTier[] {
  const ctx = pricingContext();
  return getTiers(product.id).map((tier) => priceTier(tier, product, product.rate_usd_per_1000, ctx));
}

/** Pack más barato del producto. Se usa para el "desde $X" del sitio. */
export function cheapestTier(product: ProductWithService): PricedTier | null {
  const tiers = getPricedTiers(product);
  if (!tiers.length) return null;
  return tiers.reduce((min, t) => (t.priceClp < min.priceClp ? t : min));
}

/**
 * Pack que se muestra en la tarjeta del catálogo: el marcado como popular, que
 * es el mismo que viene preseleccionado en la ficha. Mostrar siempre el más
 * chico hacía que media portada repitiera el precio mínimo de la tienda.
 */
export function highlightTier(product: ProductWithService): PricedTier | null {
  const tiers = getPricedTiers(product);
  if (!tiers.length) return null;
  return tiers.find((t) => t.popular) ?? tiers[0];
}

export type PlatformSummary = { platform: string; products: number };

export function getPlatformsWithProducts(): PlatformSummary[] {
  return all<PlatformSummary>(
    `SELECT p.platform, COUNT(*) AS products
       FROM products p
       JOIN provider_services s ON s.service_id = p.provider_service_id
      WHERE p.published = 1 AND s.provider_enabled = 1
      GROUP BY p.platform
      ORDER BY products DESC`,
  );
}

export function getProviderService(serviceId: number): ProviderService | undefined {
  return get<ProviderService>("SELECT * FROM provider_services WHERE service_id = ?", [serviceId]);
}

export function parseJson<T>(raw: string | null | undefined, fallback: T): T {
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

/**
 * Ordena los productos de una misma categoría como se leen: primero la
 * escalera de niveles (económico → estándar → premium) y, dentro de cada
 * nivel, del pack más barato al más caro.
 *
 * `sort_order` sirve para ordenar categorías entre sí, pero dentro de una
 * dejaba la lista al azar: dos productos con el mismo número quedaban en el
 * orden en que SQLite los devolviera.
 */
export function sortProductsForStore(products: ProductWithService[]): ProductWithService[] {
  const desde = new Map(products.map((p) => [p.id, cheapestTier(p)?.priceClp ?? Number.MAX_SAFE_INTEGER]));
  return [...products].sort((a, b) => {
    const nivel = levelOrder(a.level) - levelOrder(b.level);
    if (nivel !== 0) return nivel;
    const precio = desde.get(a.id)! - desde.get(b.id)!;
    if (precio !== 0) return precio;
    return a.name.localeCompare(b.name, "es");
  });
}

export type ServiceTypeGroup = { serviceType: string; items: ProductWithService[] };

/**
 * Agrupa los productos por tipo de servicio para pintar una sección por
 * categoría, con las categorías en el orden de la tienda y los productos
 * ordenados dentro de cada una.
 */
export function groupByServiceType(products: ProductWithService[]): ServiceTypeGroup[] {
  const groups = new Map<string, ProductWithService[]>();
  for (const product of products) {
    const list = groups.get(product.service_type) ?? [];
    list.push(product);
    groups.set(product.service_type, list);
  }
  return [...groups.entries()]
    .map(([serviceType, items]) => ({ serviceType, items: sortProductsForStore(items) }))
    .sort((a, b) => serviceTypeOrder(a.serviceType) - serviceTypeOrder(b.serviceType));
}
