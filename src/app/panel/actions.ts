"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { entrar, registrar, salir, panelUser, cambiarPassword } from "@/lib/reseller-auth";
import { crearPedidoDePanel, pedidoDelCliente, tieneReposicion } from "@/lib/reseller-orders";
import { crearRecarga, avisarTransferencia, guardarTokenFlow, recargaPorId } from "@/lib/topups";
import { crearTicket, agregarMensaje, ticketDelCliente } from "@/lib/tickets";
import { createPayment, checkoutUrl, flowConfigured } from "@/lib/flow";
import { transferenciaDisponible } from "@/lib/transfer";
import { avisarAdmin, notificarBienvenidaPanel } from "@/lib/notify";
import { absoluteUrl } from "@/lib/seo";
import { getBoolSetting, getSetting } from "@/lib/settings";
import { formatClp } from "@/lib/pricing";

export type PanelState = { ok?: string; error?: string };

/**
 * Acciones del panel mayorista.
 *
 * Todas empiezan por la sesión: sin cliente no se hace nada, y el cliente sale
 * de la cookie, nunca de un campo del formulario. Un id de usuario que venga
 * del navegador es un agujero por donde alguien gasta el saldo de otro.
 */
async function sesion() {
  const user = await panelUser();
  if (!user) redirect("/panel/entrar");
  return user;
}

function panelActivo() {
  if (!getBoolSetting("reseller_enabled", true)) {
    redirect("/");
  }
}

// ------------------------------------------------------------------- cuenta

export async function accionEntrar(_prev: PanelState, formData: FormData): Promise<PanelState> {
  panelActivo();
  const result = await entrar(
    String(formData.get("email") ?? ""),
    String(formData.get("password") ?? ""),
  );
  if (!result.ok) return { error: result.error };
  redirect("/panel");
}

export async function accionRegistrar(_prev: PanelState, formData: FormData): Promise<PanelState> {
  panelActivo();
  const email = String(formData.get("email") ?? "");
  const result = await registrar({
    email,
    password: String(formData.get("password") ?? ""),
    name: String(formData.get("name") ?? ""),
    phone: String(formData.get("phone") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  // La bienvenida al cliente y el aviso al dueño, en ese orden: lo primero que
  // hace una cuenta nueva es buscar el correo para ver si quedó bien creada.
  await notificarBienvenidaPanel(result.user);
  await avisarAdmin(
    "Cuenta nueva en el panel mayorista",
    `<p>Se registró <strong>${result.user.email}</strong>${result.user.name ? ` (${result.user.name})` : ""}.</p>`,
    `Se registró ${result.user.email} en el panel mayorista.`,
  );
  redirect("/panel");
}

export async function accionSalir() {
  await salir();
  redirect("/panel/entrar");
}

export async function accionCambiarPassword(
  _prev: PanelState,
  formData: FormData,
): Promise<PanelState> {
  const user = await sesion();
  const result = await cambiarPassword(
    user.id,
    String(formData.get("actual") ?? ""),
    String(formData.get("nueva") ?? ""),
  );
  return result.ok ? { ok: "Contraseña cambiada." } : { error: result.error };
}

// ------------------------------------------------------------------ pedidos

export async function accionCrearPedido(_prev: PanelState, formData: FormData): Promise<PanelState> {
  panelActivo();
  const user = await sesion();

  const result = await crearPedidoDePanel({
    userId: user.id,
    serviceId: Number(formData.get("service_id")),
    link: String(formData.get("link") ?? ""),
    quantity: Number(formData.get("quantity")),
    comments: String(formData.get("comments") ?? ""),
  });
  if (!result.ok) return { error: result.error };

  revalidatePath("/panel");
  revalidatePath("/panel/pedidos");
  redirect(`/panel/pedidos/${result.order.id}?nuevo=1`);
}

/** El cliente pide la reposición de un pedido: se abre un ticket para el dueño. */
export async function accionPedirReposicion(formData: FormData) {
  const user = await sesion();
  const orderId = Number(formData.get("order_id"));
  const order = pedidoDelCliente(user.id, orderId);
  if (!order) redirect("/panel/pedidos");

  if (!tieneReposicion(order)) {
    redirect(`/panel/pedidos/${orderId}?error=${encodeURIComponent("Este servicio no incluye reposición.")}`);
  }

  const result = crearTicket({
    userId: user.id,
    kind: "reposicion",
    orderId,
    subject: `Reposición del pedido ${order.code}`,
    body:
      String(formData.get("detalle") ?? "").trim() ||
      `Solicito la reposición del pedido ${order.code} (${order.product_name}, ${order.quantity} u.).`,
  });
  if (!result.ok) {
    redirect(`/panel/pedidos/${orderId}?error=${encodeURIComponent(result.error)}`);
  }

  await avisarAdmin(
    `Solicitud de reposición · ${order.code}`,
    `<p><strong>${user.email}</strong> pidió la reposición del pedido ${order.code}.</p>` +
      `<p><a href="${absoluteUrl(`/admin/tickets/${result.ticket.id}`)}">Abrir el ticket ${result.ticket.code}</a></p>`,
    `${user.email} pidió la reposición del pedido ${order.code}. Ticket ${result.ticket.code}: ${absoluteUrl(`/admin/tickets/${result.ticket.id}`)}`,
  );
  redirect(`/panel/tickets/${result.ticket.code}`);
}

// ------------------------------------------------------------------- saldo

export async function accionRecargar(_prev: PanelState, formData: FormData): Promise<PanelState> {
  panelActivo();
  const user = await sesion();
  const metodo = String(formData.get("metodo") ?? "flow") === "transferencia" ? "transferencia" : "flow";
  const monto = Number(String(formData.get("monto") ?? "").replace(/[^\d]/g, ""));

  if (metodo === "transferencia" && !transferenciaDisponible()) {
    return { error: "La transferencia no está disponible ahora. Usa Webpay." };
  }
  if (metodo === "flow" && !flowConfigured()) {
    return { error: "El pago en línea no está disponible ahora. Recarga por transferencia." };
  }

  const creada = crearRecarga({ userId: user.id, amountClp: monto, method: metodo });
  if (!creada.ok) return { error: creada.error };
  const topup = creada.topup;

  if (metodo === "transferencia") {
    revalidatePath("/panel/saldo");
    redirect(`/panel/saldo?recarga=${topup.code}`);
  }

  try {
    const pago = await createPayment({
      commerceOrder: topup.code,
      subject: `Recarga de saldo ${topup.code} · ${getSetting("site_name", "TusSeguidores")}`,
      amount: topup.amount_clp,
      email: user.email,
      urlConfirmation: absoluteUrl("/api/flow/recarga"),
      urlReturn: absoluteUrl("/panel/saldo/retorno"),
    });
    guardarTokenFlow(topup.id, pago.token);
    redirect(checkoutUrl(pago));
  } catch (error) {
    // `redirect` lanza a propósito: hay que dejarlo pasar.
    if ((error as { digest?: string })?.digest?.startsWith("NEXT_REDIRECT")) throw error;
    console.error("[panel/recarga]", error);
    return {
      error:
        "No pudimos abrir el pago en este momento. Prueba de nuevo o recarga por transferencia.",
    };
  }
}

export async function accionAvisarTransferencia(formData: FormData) {
  const user = await sesion();
  const topupId = Number(formData.get("topup_id"));
  const topup = recargaPorId(topupId);
  if (!topup || topup.user_id !== user.id) redirect("/panel/saldo");

  avisarTransferencia(topupId, String(formData.get("referencia") ?? ""));
  await avisarAdmin(
    `Recarga por transferencia · ${topup.code} · ${formatClp(topup.amount_clp)}`,
    `<p><strong>${user.email}</strong> avisó que transfirió ${formatClp(topup.amount_clp)} para recargar su saldo.</p>` +
      `<p><a href="${absoluteUrl("/admin/recargas")}">Revisar las recargas por confirmar</a></p>`,
    `${user.email} avisó una transferencia de ${formatClp(topup.amount_clp)} (${topup.code}). Revisa ${absoluteUrl("/admin/recargas")}`,
  );
  revalidatePath("/panel/saldo");
  redirect("/panel/saldo?aviso=1");
}

// ------------------------------------------------------------------ tickets

export async function accionCrearTicket(_prev: PanelState, formData: FormData): Promise<PanelState> {
  const user = await sesion();
  const result = crearTicket({
    userId: user.id,
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
    kind: String(formData.get("kind") ?? "consulta") === "problema" ? "problema" : "consulta",
    orderId: Number(formData.get("order_id")) || null,
  });
  if (!result.ok) return { error: result.error };

  await avisarAdmin(
    `Ticket nuevo · ${result.ticket.code}`,
    `<p><strong>${user.email}</strong> abrió el ticket ${result.ticket.code}: ${result.ticket.subject}</p>` +
      `<p><a href="${absoluteUrl(`/admin/tickets/${result.ticket.id}`)}">Responder</a></p>`,
    `${user.email} abrió el ticket ${result.ticket.code}: ${result.ticket.subject}`,
  );
  redirect(`/panel/tickets/${result.ticket.code}`);
}

export async function accionResponderTicket(formData: FormData) {
  const user = await sesion();
  const code = String(formData.get("code") ?? "");
  const ticket = ticketDelCliente(user.id, code);
  if (!ticket) redirect("/panel/tickets");

  const cuerpo = String(formData.get("body") ?? "").trim();
  if (cuerpo) {
    agregarMensaje(ticket.id, "cliente", cuerpo);
    await avisarAdmin(
      `Respuesta en el ticket ${ticket.code}`,
      `<p><strong>${user.email}</strong> respondió en el ticket ${ticket.code}.</p>` +
        `<p><a href="${absoluteUrl(`/admin/tickets/${ticket.id}`)}">Abrir</a></p>`,
      `${user.email} respondió en el ticket ${ticket.code}.`,
    );
  }
  revalidatePath(`/panel/tickets/${ticket.code}`);
  redirect(`/panel/tickets/${ticket.code}`);
}
