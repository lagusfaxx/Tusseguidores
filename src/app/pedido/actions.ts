"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureTargets, getOrderByCode, logEvent } from "@/lib/orders";
import { puedeCorregirDestino } from "@/lib/order-tracking";
import { reposicionDelPedido, reposicionYaPedida } from "@/lib/refill";
import { crearTicket, agregarMensaje, ticketDePedido, puedeEscribir } from "@/lib/tickets";
import { devolucionDisponible, REDES_DEVOLUCION, type RedDevolucion } from "@/lib/devoluciones";
import type { Ticket } from "@/lib/types";
import { avisarAdmin, notificarTransferenciaPendiente } from "@/lib/notify";
import { abrirPagoFlow } from "@/lib/checkout";
import { transferenciaDisponible } from "@/lib/transfer";
import { revisarDestinos, separarDestinos } from "@/lib/targets";
import { absoluteUrl } from "@/lib/seo";
import { run, get } from "@/lib/db";

export type PedidoState = { ok?: string; error?: string };

/**
 * Acciones que puede hacer el cliente desde el seguimiento de su pedido.
 *
 * No hay sesión: el código del pedido es la llave, igual que para ver la
 * página. Por eso todo empieza buscando el pedido por su código y nada acepta
 * un id que venga del formulario.
 */
async function pedidoDe(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim();
  const order = getOrderByCode(code);
  if (!order) redirect("/seguimiento?error=1");
  return order;
}

/**
 * Corregir el enlace de destino.
 *
 * Es el caso más común de soporte: el cliente pega mal su usuario, o su cuenta
 * estaba privada, y hasta ahora no había forma de arreglarlo sin escribir un
 * correo y esperar. Solo se permite mientras el pedido no haya salido.
 */
export async function corregirDestino(_prev: PedidoState, formData: FormData): Promise<PedidoState> {
  const order = await pedidoDe(formData);
  if (!puedeCorregirDestino(order)) {
    return { error: "Este pedido ya salió a entrega y el destino no se puede cambiar." };
  }

  const crudos = separarDestinos(String(formData.get("link") ?? ""));
  if (!crudos.length) return { error: "Escribe el enlace o usuario correcto." };

  const producto = order.product_id
    ? get<{ platform: string; service_type: string }>(
        "SELECT platform, service_type FROM products WHERE id = ?",
        [order.product_id],
      )
    : undefined;
  const servicio = get<{ order_kind: string }>(
    "SELECT order_kind FROM provider_services WHERE service_id = ?",
    [order.reference_service_id ?? order.provider_service_id],
  );

  // Se revisa igual que al comprar: corregir un destino no puede dejar el
  // pedido con un enlace que el proveedor no sabe entregar.
  const revision = revisarDestinos(
    crudos,
    producto?.platform ?? "",
    producto?.service_type ?? "",
    servicio?.order_kind ?? "",
  );
  if (!revision.ok) return { error: revision.error };
  const links = revision.links;

  const destinos = ensureTargets(order);
  if (links.length !== destinos.length) {
    return {
      error:
        destinos.length > 1
          ? `Este pedido va a ${destinos.length} publicaciones: deja ${destinos.length} enlaces, uno por línea. Para cambiar la cantidad, escríbenos.`
          : "Este pedido va a un solo destino. Deja un enlace.",
    };
  }

  const antes = destinos.map((d) => d.link);
  if (antes.join("\n") === links.join("\n")) {
    return { ok: "Ese es el destino que ya tenías guardado." };
  }

  destinos.forEach((destino, i) =>
    run("UPDATE order_targets SET link = ?, updated_at = datetime('now') WHERE id = ?", [links[i], destino.id]),
  );
  run("UPDATE orders SET link = ?, updated_at = datetime('now') WHERE id = ?", [links[0], order.id]);
  logEvent(
    order.id,
    "info",
    `El cliente corrigió el destino: ${antes.join(", ")} → ${links.join(", ")}`,
  );

  await avisarAdmin(
    `Destino corregido · ${order.code}`,
    `<p>El cliente cambió el destino de su pedido <strong>${order.code}</strong>.</p>` +
      `<p>Antes: ${antes.join("<br>")}<br><br>Ahora: ${links.join("<br>")}</p>` +
      `<p><a href="${absoluteUrl(`/admin/pedidos/${order.id}`)}">Ver el pedido</a></p>`,
    `El cliente corrigió el destino de ${order.code}: ${antes.join(", ")} -> ${links.join(", ")}`,
  );

  revalidatePath(`/pedido/${order.code}`);
  return { ok: links.length > 1 ? "Destinos actualizados." : "Destino actualizado." };
}

/** Abrir el ticket del pedido. Si ya existe, el mensaje se suma a ese. */
export async function abrirTicketDePedido(
  _prev: PedidoState,
  formData: FormData,
): Promise<PedidoState> {
  const order = await pedidoDe(formData);

  const result = crearTicket({
    guestEmail: order.email,
    orderId: order.id,
    subject: String(formData.get("subject") ?? "").trim() || `Ayuda con el pedido ${order.code}`,
    body: String(formData.get("body") ?? ""),
    kind: "problema",
  });
  if (!result.ok) return { error: result.error };

  await avisoDeTicket(order.code, order.email, result.ticket, result.existente);

  revalidatePath(`/pedido/${order.code}`);
  return { ok: "Listo, te respondemos por aquí y te avisamos por correo." };
}

/** Responder en el ticket del propio pedido. */
export async function responderTicketDePedido(
  _prev: PedidoState,
  formData: FormData,
): Promise<PedidoState> {
  const order = await pedidoDe(formData);
  const ticket = ticketDePedido(order.id, String(formData.get("ticket") ?? ""));
  if (!ticket) return { error: "No encontramos la conversación de este pedido." };

  const cuerpo = String(formData.get("body") ?? "").trim();
  if (cuerpo.length < 2) return { error: "Escribe tu mensaje." };
  const permiso = puedeEscribir(ticket.id);
  if (!permiso.ok) return { error: permiso.error };

  agregarMensaje(ticket.id, "cliente", cuerpo);
  await avisoDeTicket(order.code, order.email, ticket, true);
  revalidatePath(`/pedido/${order.code}`);
  return { ok: "Mensaje enviado." };
}

async function avisoDeTicket(orderCode: string, email: string, ticket: Ticket, existente: boolean) {
  await avisarAdmin(
    existente ? `Mensaje nuevo · ${ticket.code} · pedido ${orderCode}` : `Ticket nuevo · ${ticket.code} · pedido ${orderCode}`,
    `<p><strong>${email}</strong> ${existente ? "escribió en" : "abrió"} el ticket ${ticket.code} del pedido ${orderCode}.</p>` +
      `<p><a href="${absoluteUrl(`/admin/tickets/${ticket.id}`)}">Responder</a></p>`,
    `${email} ${existente ? "escribió en" : "abrió"} el ticket ${ticket.code} del pedido ${orderCode}.`,
  );
}

/**
 * Pedir la devolución de un pedido pagado que no se entregó (o se entregó a
 * medias). Las devoluciones se hacen solo en cripto, así que se pide la red y
 * la dirección de una vez: es lo que el dueño necesita para pagar, y queda en
 * el mismo ticket del pedido.
 */
export async function pedirDevolucion(
  _prev: PedidoState,
  formData: FormData,
): Promise<PedidoState> {
  const order = await pedidoDe(formData);
  if (!devolucionDisponible(order)) {
    return { error: "Este pedido no tiene una devolución pendiente." };
  }

  const red = String(formData.get("red") ?? "") as RedDevolucion;
  const destino = REDES_DEVOLUCION[red];
  if (!destino) return { error: "Elige en qué quieres recibir la devolución: USDT o BTC." };
  const direccion = String(formData.get("direccion") ?? "").trim();
  if (!destino.patron.test(direccion)) {
    return { error: `Esa dirección no parece de ${destino.etiqueta}. Revísala: si está mala, el dinero se pierde.` };
  }

  const detalle = String(formData.get("detalle") ?? "").trim().slice(0, 1000);
  const result = crearTicket({
    guestEmail: order.email,
    orderId: order.id,
    kind: "devolucion",
    subject: `Devolución del pedido ${order.code}`,
    body:
      `Pido la devolución del pedido ${order.code}.\n` +
      `Recibir en: ${destino.etiqueta}\nDirección: ${direccion}` +
      (detalle ? `\n\n${detalle}` : ""),
  });
  if (!result.ok) return { error: result.error };

  logEvent(order.id, "info", `El cliente pidió la devolución en ${destino.etiqueta}: ${direccion}`);
  await avisoDeTicket(order.code, order.email, result.ticket, result.existente);
  revalidatePath(`/pedido/${order.code}`);
  return { ok: "Recibimos tu solicitud. Te avisamos por el ticket cuando hagamos la transferencia." };
}

/**
 * Pedir la reposición de un pedido entregado.
 *
 * El botón solo aparece dentro del plazo, pero la comprobación se repite aquí:
 * el formulario se puede reenviar al día siguiente y la garantía no se estira
 * por eso.
 */
export async function pedirReposicion(
  _prev: PedidoState,
  formData: FormData,
): Promise<PedidoState> {
  const order = await pedidoDe(formData);
  const estado = reposicionDelPedido(order);

  if (!estado.disponible) {
    if (estado.motivo === "vencida") {
      return { error: "El plazo de reposición de este pedido ya terminó." };
    }
    if (estado.motivo === "no-entregado") {
      return { error: "Todavía estamos entregando este pedido. Espera a que termine." };
    }
    return { error: "Este pedido no incluye reposición." };
  }

  const abierto = reposicionYaPedida(order.id);
  if (abierto) {
    return { error: `Ya pediste la reposición de este pedido (ticket ${abierto.code}).` };
  }

  const detalle = String(formData.get("detalle") ?? "").trim();
  const result = crearTicket({
    guestEmail: order.email,
    orderId: order.id,
    kind: "reposicion",
    subject: `Reposición del pedido ${order.code}`,
    body:
      detalle ||
      `Pido la reposición del pedido ${order.code} (${order.product_name}, ${order.quantity} u.).`,
  });
  if (!result.ok) return { error: result.error };

  await avisarAdmin(
    `Reposición pedida · ${order.code}`,
    `<p><strong>${order.email}</strong> pidió la reposición de su pedido ${order.code}.</p>` +
      `<p>${order.product_name} · ${order.quantity} u. · destino ${order.link}</p>` +
      `<p><a href="${absoluteUrl(`/admin/tickets/${result.ticket.id}`)}">Abrir el ticket ${result.ticket.code}</a></p>`,
    `${order.email} pidió la reposición de ${order.code}. Ticket ${result.ticket.code}: ${absoluteUrl(`/admin/tickets/${result.ticket.id}`)}`,
  );

  revalidatePath(`/pedido/${order.code}`);
  return { ok: `Listo, la pedimos. Seguimos por el ticket ${result.ticket.code}.` };
}

/**
 * Pagar un pedido que quedó sin pagar, o cambiar de medio de pago.
 *
 * Es el mismo pedido: el cliente que dudaba entre Webpay y transferencia
 * antes volvía al producto y creaba otro pedido por cada intento.
 */
export async function pagarPedido(formData: FormData) {
  const order = await pedidoDe(formData);
  if (order.payment_status === "paid" || order.status === "refunded") {
    redirect(`/pedido/${order.code}`);
  }
  const metodo = String(formData.get("metodo") ?? "flow") === "transferencia" ? "transferencia" : "flow";

  if (metodo === "transferencia") {
    if (!transferenciaDisponible()) redirect(`/pedido/${order.code}`);
    run(
      `UPDATE orders SET payment_provider = 'transferencia', status = 'pending',
              updated_at = datetime('now') WHERE id = ?`,
      [order.id],
    );
    logEvent(order.id, "info", "El cliente eligió pagar por transferencia.");
    const actualizado = getOrderByCode(order.code);
    if (actualizado) await notificarTransferenciaPendiente(actualizado);
    revalidatePath(`/pedido/${order.code}`);
    redirect(`/pedido/${order.code}?estado=transferencia`);
  }

  const resultado = await abrirPagoFlow(order);
  if ("error" in resultado) {
    redirect(`/pedido/${order.code}?pago=error`);
  }
  redirect(resultado.url);
}
