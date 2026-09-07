"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { getOrderByCode, logEvent } from "@/lib/orders";
import { puedeCorregirDestino } from "@/lib/order-tracking";
import { crearTicket, agregarMensaje, ticketDePedido } from "@/lib/tickets";
import { avisarAdmin } from "@/lib/notify";
import { normalizeTarget } from "@/lib/utils";
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

  const crudo = String(formData.get("link") ?? "").trim();
  if (!crudo) return { error: "Escribe el enlace o usuario correcto." };

  const producto = order.product_id
    ? get<{ platform: string }>("SELECT platform FROM products WHERE id = ?", [order.product_id])
    : undefined;
  const link = normalizeTarget(crudo, producto?.platform ?? "");
  if (link === order.link) return { ok: "Ese es el destino que ya tenías guardado." };

  run("UPDATE orders SET link = ?, updated_at = datetime('now') WHERE id = ?", [link, order.id]);
  logEvent(order.id, "info", `El cliente corrigió el destino: ${order.link} → ${link}`);

  await avisarAdmin(
    `Destino corregido · ${order.code}`,
    `<p>El cliente cambió el destino de su pedido <strong>${order.code}</strong>.</p>` +
      `<p>Antes: ${order.link}<br>Ahora: ${link}</p>` +
      `<p><a href="${absoluteUrl(`/admin/pedidos/${order.id}`)}">Ver el pedido</a></p>`,
    `El cliente corrigió el destino de ${order.code}: ${order.link} -> ${link}`,
  );

  revalidatePath(`/pedido/${order.code}`);
  return { ok: "Destino actualizado." };
}

/** Abrir un ticket desde el seguimiento del pedido. */
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

  await avisarAdmin(
    `Ticket nuevo · ${result.ticket.code} · pedido ${order.code}`,
    `<p><strong>${order.email}</strong> abrió un ticket desde el seguimiento de su pedido ${order.code}.</p>` +
      `<p><a href="${absoluteUrl(`/admin/tickets/${result.ticket.id}`)}">Responder</a></p>`,
    `${order.email} abrió el ticket ${result.ticket.code} del pedido ${order.code}.`,
  );

  revalidatePath(`/pedido/${order.code}`);
  return { ok: "Listo, te respondemos por aquí y por correo." };
}

/** Responder en un ticket del propio pedido. */
export async function responderTicketDePedido(formData: FormData) {
  const order = await pedidoDe(formData);
  const ticket = ticketDePedido(order.id, String(formData.get("ticket") ?? ""));
  if (!ticket) redirect(`/pedido/${order.code}`);

  const cuerpo = String(formData.get("body") ?? "").trim();
  if (cuerpo) {
    agregarMensaje(ticket.id, "cliente", cuerpo);
    await avisarAdmin(
      `Respuesta en el ticket ${ticket.code}`,
      `<p><strong>${order.email}</strong> respondió en el ticket ${ticket.code} (pedido ${order.code}).</p>` +
        `<p><a href="${absoluteUrl(`/admin/tickets/${ticket.id}`)}">Abrir</a></p>`,
      `${order.email} respondió en el ticket ${ticket.code}.`,
    );
  }
  revalidatePath(`/pedido/${order.code}`);
  redirect(`/pedido/${order.code}#soporte`);
}
