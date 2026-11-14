import { get } from "./db";
import type { Order } from "./types";

/**
 * Enlace para repetir un pedido: la ficha del producto con el destino y la
 * cantidad ya puestos. El precio no viaja en el enlace: se calcula de nuevo
 * con lo que cueste hoy.
 *
 * Devuelve null si el producto ya no está publicado. Los pedidos con
 * comentarios escritos o repartidos entre varias publicaciones vuelven a la
 * ficha sin datos: ahí cada compra es distinta.
 */
export function rutaRecompra(order: Order): string | null {
  if (!order.product_id) return null;
  const producto = get<{ slug: string }>(
    "SELECT slug FROM products WHERE id = ? AND published = 1",
    [order.product_id],
  );
  if (!producto) return null;

  const base = `/producto/${producto.slug}`;
  if (order.comments || order.link.includes("\n")) return base;

  const destinos = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM order_targets WHERE order_id = ?",
    [order.id],
  )?.n ?? 0;
  if (destinos > 1) return base;

  const query = new URLSearchParams({ destino: order.link, cantidad: String(order.quantity) });
  return `${base}?${query.toString()}`;
}
