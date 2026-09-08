"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { ensureTargets, getOrderByCode, logEvent } from "@/lib/orders";
import { puedeCorregirDestino } from "@/lib/order-tracking";
import { crearTicket, agregarMensaje, ticketDePedido } from "@/lib/tickets";
import { avisarAdmin } from "@/lib/notify";
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
