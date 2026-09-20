import "server-only";
import { get } from "./db";
import type { Order } from "./types";

/**
 * Garantía de reposición: si se puede pedir, y hasta cuándo.
 *
 * Los servicios con reposición la dan por una cantidad de días contados desde
 * que la entrega terminó. Pasado ese plazo ya no hay nada que pedir, así que
 * el botón no se muestra: ofrecerlo el día 31 de una garantía de 30 es
 * prometer algo que después hay que negar por correo.
 *
 * La ventana la marca el servicio con el que se entregó el pedido, no el
 * producto: el producto pudo cambiar de nivel o de plazo después de la compra,
 * y lo que se puede reponer es lo que se entregó.
 */

/** Cuando el servicio dice que repone pero no dice por cuántos días. */
const DIAS_POR_DEFECTO = 30;
/** El proveedor marca así la reposición sin vencimiento. */
const DE_POR_VIDA = 9999;

export type Reposicion =
  | { disponible: true; dePorVida: boolean; vence: Date | null; diasRestantes: number | null }
  | { disponible: false; motivo: "sin-garantia" | "no-entregado" | "vencida" | "ya-pedida"; vencio?: Date };

function diasDeGarantia(order: Order): number {
  const service = get<{ refill: number; refill_days: number }>(
    "SELECT refill, refill_days FROM provider_services WHERE service_id = ?",
    [order.provider_service_id],
  );
  if (!service) return 0;
  if (service.refill_days > 0) return service.refill_days;
  return service.refill === 1 ? DIAS_POR_DEFECTO : 0;
}

/**
 * Desde cuándo corre el plazo.
 *
 * Lo normal es la fecha de término. Un pedido entregado antes de que
 * existiera esa columna puede no tenerla: ahí sirve la última actualización,
 * que es cuando el estado pasó a entregado.
 */
function inicioDeGarantia(order: Order): Date | null {
  const marca = order.completed_at ?? order.updated_at;
  if (!marca) return null;
  // Las fechas se guardan como 'YYYY-MM-DD HH:MM:SS' en UTC.
  const fecha = new Date(`${marca.replace(" ", "T")}Z`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

export function reposicionDelPedido(order: Order, ahora = new Date()): Reposicion {
  const dias = diasDeGarantia(order);
  if (dias <= 0) return { disponible: false, motivo: "sin-garantia" };

  // Solo se repone lo que se entregó: mientras el pedido va en camino, lo que
  // falta llega solo y no hay nada que reponer.
  if (!["completed", "partial"].includes(order.status)) {
    return { disponible: false, motivo: "no-entregado" };
  }

  if (dias >= DE_POR_VIDA) {
    return { disponible: true, dePorVida: true, vence: null, diasRestantes: null };
  }

  const inicio = inicioDeGarantia(order);
  if (!inicio) return { disponible: false, motivo: "sin-garantia" };

  const vence = new Date(inicio.getTime() + dias * 24 * 60 * 60 * 1000);
  if (ahora >= vence) return { disponible: false, motivo: "vencida", vencio: vence };

  return {
    disponible: true,
    dePorVida: false,
    vence,
    diasRestantes: Math.max(1, Math.ceil((vence.getTime() - ahora.getTime()) / (24 * 60 * 60 * 1000))),
  };
}

/** ¿Hay una solicitud viva para este pedido? Entonces no se pide de nuevo. */
export function reposicionYaPedida(orderId: number): { code: string } | undefined {
  return get<{ code: string }>(
    "SELECT code FROM tickets WHERE order_id = ? AND kind = 'reposicion' AND status != 'cerrado' ORDER BY id DESC LIMIT 1",
    [orderId],
  );
}

/** Frase corta para la ficha del pedido. */
export function textoDeGarantia(estado: Reposicion): string {
  if (estado.disponible) {
    if (estado.dePorVida) return "Reposición garantizada sin vencimiento";
    return `Reposición garantizada por ${estado.diasRestantes} día${estado.diasRestantes === 1 ? "" : "s"} más`;
  }
  if (estado.motivo === "vencida") return "El plazo de reposición de este pedido ya terminó";
  if (estado.motivo === "no-entregado") return "La reposición se puede pedir cuando la entrega termine";
  return "Este pedido no incluye reposición";
}
