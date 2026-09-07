import "server-only";
import type { Order, OrderStatus } from "./types";

/**
 * Lo que ve el cliente cuando sigue su pedido.
 *
 * El historial interno no sirve para esto: dice "Enviado al proveedor,
 * servicio #3626 (pedido 91422)" y "Servicio reasignado al #1772". Al cliente
 * eso no le dice nada bueno —le dice que compró un intermediario— y encima
 * suena a error. Aquí se traduce a cuatro pasos y una frase.
 */

export type PasoEstado = "hecho" | "actual" | "pendiente" | "problema";

export type Paso = {
  id: string;
  titulo: string;
  detalle: string;
  estado: PasoEstado;
  fecha?: string | null;
};

/** ¿El pedido ya está en manos de la entrega? */
function enEntrega(order: Order): boolean {
  return Boolean(order.provider_order_id || order.manual_dispatch_at) ||
    ["processing", "partial", "completed"].includes(order.status);
}

export function pasosDelPedido(order: Order): Paso[] {
  const pagado = order.payment_status === "paid";
  const entregando = enEntrega(order);
  const terminado = order.status === "completed";
  const parcial = order.status === "partial";
  const cancelado = ["canceled", "refunded"].includes(order.status);
  const falló = order.status === "failed";

  const entregadas =
    order.remains != null ? Math.max(0, order.quantity - order.remains) : null;

  return [
    {
      id: "recibido",
      titulo: "Pedido recibido",
      detalle: "Guardamos tu pedido con su código.",
      estado: "hecho",
      fecha: order.created_at,
    },
    {
      id: "pago",
      titulo: pagado ? "Pago confirmado" : "Esperando el pago",
      detalle: pagado
        ? "Listo, el pedido pasa a entrega."
        : order.payment_provider === "transferencia"
          ? "Transfiere y avísanos para confirmarlo."
          : "Todavía no recibimos el pago.",
      estado: falló ? "problema" : pagado ? "hecho" : "actual",
      fecha: order.paid_at,
    },
    {
      id: "entrega",
      titulo: entregando ? "En entrega" : "En la fila de entrega",
      detalle: entregando
        ? entregadas != null
          ? `Van ${entregadas.toLocaleString("es-CL")} de ${order.quantity.toLocaleString("es-CL")}.`
          : "La entrega ya empezó."
        : pagado
          ? "Empieza en unos minutos."
          : "Empieza cuando se confirme el pago.",
      estado: cancelado ? "problema" : terminado ? "hecho" : entregando ? "actual" : "pendiente",
    },
    {
      id: "listo",
      titulo: parcial ? "Entrega parcial" : "Entregado",
      detalle: terminado
        ? "Pedido completo."
        : parcial
          ? "Se entregó una parte. Escríbenos y lo resolvemos."
          : "Te avisamos por correo cuando termine.",
      estado: terminado ? "hecho" : parcial ? "problema" : "pendiente",
    },
  ];
}

/** Titular del estado, en una frase, para encabezar la página. */
export function resumenDeEstado(order: Order): { titulo: string; detalle: string } {
  const estado = order.status as OrderStatus;

  if (estado === "completed") {
    return { titulo: "Pedido entregado", detalle: "Ya está todo entregado." };
  }
  if (estado === "partial") {
    return {
      titulo: "Entregado en parte",
      detalle: "No alcanzamos a completarlo. Escríbenos y lo resolvemos.",
    };
  }
  if (estado === "refunded") {
    return { titulo: "Pedido reembolsado", detalle: "Te devolvimos el dinero." };
  }
  if (estado === "canceled") {
    return { titulo: "Pedido cancelado", detalle: "Este pedido no se va a entregar." };
  }
  if (estado === "failed") {
    return {
      titulo: "Hubo un problema con el pago",
      detalle: "No se completó el cobro. Puedes intentarlo de nuevo o escribirnos.",
    };
  }
  if (order.payment_status !== "paid") {
    return {
      titulo: "Esperando el pago",
      detalle:
        order.payment_provider === "transferencia"
          ? "Tu pedido está reservado. En cuanto confirmemos la transferencia sale a entrega."
          : "Apenas se confirme el pago, el pedido sale a entrega.",
    };
  }
  if (estado === "processing" || order.provider_order_id || order.manual_dispatch_at) {
    return { titulo: "En entrega", detalle: "Tu pedido está avanzando." };
  }
  return { titulo: "En la fila de entrega", detalle: "Empieza en unos minutos." };
}

/** Porcentaje entregado, para la barra. */
export function avanceDelPedido(order: Order): number {
  if (order.status === "completed") return 100;
  if (order.remains != null && order.quantity > 0) {
    return Math.max(0, Math.min(100, Math.round(((order.quantity - order.remains) / order.quantity) * 100)));
  }
  if (order.status === "processing") return 15;
  return 0;
}

/**
 * ¿Se puede todavía corregir el destino?
 *
 * Solo mientras el pedido no haya salido. Después el destino ya está en manos
 * de la entrega y cambiarlo en la base sería mentirle al cliente.
 */
export function puedeCorregirDestino(order: Order): boolean {
  return (
    !order.provider_order_id &&
    !order.manual_dispatch_at &&
    !["completed", "partial", "canceled", "refunded"].includes(order.status)
  );
}
