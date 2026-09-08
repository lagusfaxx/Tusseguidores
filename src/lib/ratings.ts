import type { Product } from "./types";
import { getBoolSetting, getNumberSetting } from "./settings";

/**
 * Calificación del servicio.
 *
 * El valor y el número de opiniones los pone la tienda desde
 * /admin/ajustes → "Calificación del servicio", y cada producto puede llevar
 * el suyo propio. Se muestra en la tienda y se publica como `aggregateRating`
 * en los datos estructurados, que es lo que hace que el resultado de Google
 * salga con estrellas en vez de con una línea de texto.
 *
 * Sin número de opiniones no se muestra nada: una calificación sin cuántos la
 * dieron no la valida Google y, sobre todo, no es información real.
 */
export type Rating = { value: number; count: number; best: number; worst: number };

const BEST = 5;
const WORST = 1;

function build(value: number, count: number): Rating | null {
  const nota = Math.round(value * 10) / 10;
  const opiniones = Math.round(count);
  if (!(nota >= WORST && nota <= BEST) || opiniones < 1) return null;
  return { value: nota, count: opiniones, best: BEST, worst: WORST };
}

/** Calificación general de la tienda, o null si está apagada o incompleta. */
export function storeRating(): Rating | null {
  if (!getBoolSetting("rating_enabled", true)) return null;
  return build(getNumberSetting("rating_value", 0), getNumberSetting("rating_count", 0));
}

/** Calificación de un producto: la suya si la tiene, si no la de la tienda. */
export function productRating(
  product: Pick<Product, "rating_value" | "rating_count">,
): Rating | null {
  if (!getBoolSetting("rating_enabled", true)) return null;
  const propia = build(product.rating_value ?? 0, product.rating_count ?? 0);
  return propia ?? storeRating();
}

/** Bloque aggregateRating de schema.org, para meter dentro de otro objeto. */
export function aggregateRatingLd(rating: Rating) {
  return {
    "@type": "AggregateRating",
    ratingValue: rating.value,
    reviewCount: rating.count,
    bestRating: rating.best,
    worstRating: rating.worst,
  };
}

/** "4,8" con coma decimal, como se escribe en Chile. */
export function formatRating(value: number): string {
  return value.toLocaleString("es-CL", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
}
