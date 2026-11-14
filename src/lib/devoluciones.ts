import type { Order } from "./types";

/**
 * Devoluciones.
 *
 * Se hacen solo en cripto (USDT o BTC). Webpay y las transferencias no se
 * revierten desde la tienda: el cliente deja su red y su dirección en el
 * ticket del pedido y el dueño paga desde su billetera.
 *
 * Este archivo no es "server-only": las etiquetas las usa también el
 * formulario del cliente.
 */

export const REDES_DEVOLUCION = {
  "usdt-trc20": {
    etiqueta: "USDT · red TRON (TRC20)",
    ejemplo: "T…",
    patron: /^T[1-9A-HJ-NP-Za-km-z]{33}$/,
  },
  "usdt-bep20": {
    etiqueta: "USDT · red BNB Smart Chain (BEP20)",
    ejemplo: "0x…",
    patron: /^0x[0-9a-fA-F]{40}$/,
  },
  btc: {
    etiqueta: "BTC · red Bitcoin",
    ejemplo: "bc1… / 1… / 3…",
    patron: /^(bc1[0-9a-z]{25,62}|[13][1-9A-HJ-NP-Za-km-z]{25,34})$/,
  },
} as const;

export type RedDevolucion = keyof typeof REDES_DEVOLUCION;

export const TEXTO_DEVOLUCIONES =
  "Las devoluciones se hacen solo en criptomonedas: USDT (redes TRC20 o BEP20) o BTC.";

/**
 * Un pedido pagado que no se entregó completo: cancelado, fallido después de
 * pagar o entregado a medias.
 */
export function devolucionDisponible(order: Order): boolean {
  return (
    order.payment_status === "paid" &&
    // La prueba gratis no costó nada: no hay qué devolver.
    order.payment_provider !== "prueba" &&
    ["canceled", "failed", "partial"].includes(order.status)
  );
}
