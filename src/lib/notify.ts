import "server-only";
import { get, run } from "./db";
import { emailConfig, emailConfigured, sendEmail, type SendEmailResult } from "./email";
import { getBoolSetting } from "./settings";
import {
  correoAdminPedidoNuevo,
  correoBienvenidaPanel,
  correoAdminPedidoPagado,
  correoAdminPedidoTrabado,
  correoAdminTransferencia,
  correoPagoConfirmado,
  correoPedidoCompletado,
  correoTransferenciaPendiente,
  type EmailContent,
} from "./email-templates";
import type { Order } from "./types";

/**
 * Correos que manda la tienda sola cuando pasa algo en un pedido.
 *
 * Dos reglas:
 *
 * 1. Cada tipo de correo se manda una sola vez por pedido. El cron pasa cada
 *    diez minutos y la confirmación de Flow puede llegar repetida: sin esto el
 *    cliente recibiría el mismo aviso veinte veces.
 * 2. Nada de esto puede tumbar un pedido. Si Resend falla, queda anotado en el
 *    historial y en `email_log`, y el pedido sigue su curso.
 *
 * No importa `orders.ts` a propósito: es ese módulo el que llama a este, y el
 * evento del historial se escribe directo para no cerrar el círculo.
 */

export type EmailKind =
  | "transferencia_pendiente"
  | "pago_confirmado"
  | "pedido_completado"
  | "admin_pedido_nuevo"
  | "admin_pedido_pagado"
  | "admin_transferencia"
  | "admin_trabado";

function yaEnviado(orderId: number, kind: EmailKind): boolean {
  return Boolean(
    get<{ id: number }>(
      "SELECT id FROM email_log WHERE order_id = ? AND kind = ? AND error IS NULL LIMIT 1",
      [orderId, kind],
    ),
  );
}

function registrar(
  orderId: number,
  kind: EmailKind,
  recipient: string,
  result: SendEmailResult,
): void {
  run(
    "INSERT INTO email_log (order_id, kind, recipient, provider_id, error) VALUES (?, ?, ?, ?, ?)",
    [orderId, kind, recipient, result.ok ? result.id : null, result.ok ? null : result.error],
  );
  run("INSERT INTO order_events (order_id, type, message) VALUES (?, ?, ?)", [
    orderId,
    result.ok ? "email" : "error",
    result.ok
      ? `Correo enviado a ${recipient}: ${ETIQUETA[kind]}.`
      : `No se pudo enviar el correo "${ETIQUETA[kind]}" a ${recipient}: ${result.error}`,
  ]);
}

const ETIQUETA: Record<EmailKind, string> = {
  transferencia_pendiente: "datos para transferir",
  pago_confirmado: "pago confirmado",
  pedido_completado: "pedido entregado",
  admin_pedido_nuevo: "aviso interno de pedido nuevo",
  admin_pedido_pagado: "aviso interno de venta pagada",
  admin_transferencia: "aviso interno de transferencia",
  admin_trabado: "aviso interno de pedido sin enviar",
};

/**
 * Los pedidos del panel mayorista no llevan correos de tienda.
 *
 * El mayorista manda decenas de pedidos al día y ve el estado de todos en su
 * panel: mandarle un correo por cada uno sería castigarlo por comprar.
 */
function esDelPanel(order: Order): boolean {
  return order.reseller_user_id != null;
}

/** Envía y deja constancia. Nunca lanza. */
async function enviar(
  order: Order,
  kind: EmailKind,
  to: string,
  contenido: EmailContent,
): Promise<void> {
  if (!emailConfigured() || !to.trim()) return;
  if (yaEnviado(order.id, kind)) return;

  try {
    const result = await sendEmail({
      to,
      subject: contenido.subject,
      html: contenido.html,
      text: contenido.text,
    });
    registrar(order.id, kind, to, result);
  } catch (error) {
    // sendEmail ya atrapa lo suyo; esto es el último cortafuegos para que un
    // correo no se lleve puesto un pedido pagado.
    console.error("[email]", error);
  }
}

async function enviarAlAdmin(order: Order, kind: EmailKind, contenido: EmailContent): Promise<void> {
  const config = emailConfig();
  if (!config.adminAlerts) return;
  await enviar(order, kind, config.admin, contenido);
}

/** Pedido por transferencia recién creado: le mandamos los datos de la cuenta. */
export async function notificarTransferenciaPendiente(order: Order): Promise<void> {
  if (order.payment_provider !== "transferencia") return;
  if (esDelPanel(order)) return;
  await enviar(order, "transferencia_pendiente", order.email, correoTransferenciaPendiente(order));
}

export async function notificarPagoConfirmado(order: Order): Promise<void> {
  if (esDelPanel(order)) return;
  await enviar(order, "pago_confirmado", order.email, correoPagoConfirmado(order));
}

export async function notificarPedidoCompletado(order: Order, parcial = false): Promise<void> {
  if (esDelPanel(order)) return;
  await enviar(order, "pedido_completado", order.email, correoPedidoCompletado(order, parcial));
}

/**
 * Entró un pedido, todavía sin pagar.
 *
 * Va aparte del resto de los avisos internos porque es el único que llega
 * aunque el cliente no pague nunca: quien no quiera ese ruido lo apaga en
 * Ajustes y sigue recibiendo los de la plata.
 */
export async function notificarPedidoNuevo(order: Order): Promise<void> {
  if (!getBoolSetting("email_admin_new_orders", true)) return;
  await enviarAlAdmin(order, "admin_pedido_nuevo", correoAdminPedidoNuevo(order));
}

/** Se confirmó el pago de un pedido. */
export async function notificarVentaPagada(order: Order): Promise<void> {
  await enviarAlAdmin(order, "admin_pedido_pagado", correoAdminPedidoPagado(order));
}

/** El cliente avisó que transfirió: hay que revisar la cuenta. */
export async function notificarTransferenciaAvisada(order: Order): Promise<void> {
  await enviarAlAdmin(order, "admin_transferencia", correoAdminTransferencia(order));
}

/** Un pedido pagado que no pudo salir al proveedor. */
export async function notificarPedidoTrabado(order: Order, motivo: string): Promise<void> {
  await enviarAlAdmin(order, "admin_trabado", correoAdminPedidoTrabado(order, motivo));
}

/**
 * Aviso interno suelto, sin pedido enganchado (panel mayorista: cuentas
 * nuevas, recargas por confirmar, tickets).
 *
 * No pasa por `email_log` porque no hay un pedido al que colgarlo y porque
 * cada uno nace de una acción concreta de una persona: no hay reintentos que
 * puedan duplicarlo.
 */
export async function avisarAdmin(subject: string, html: string, text: string): Promise<void> {
  const config = emailConfig();
  if (!config.adminAlerts || !emailConfigured() || !config.admin) return;
  try {
    await sendEmail({ to: config.admin, subject, html, text });
  } catch (error) {
    console.error("[email]", error);
  }
}

/**
 * Bienvenida a un cliente que acaba de crear su cuenta mayorista.
 *
 * No pasa por `email_log` porque no hay pedido al que colgarlo: nace de un
 * registro, que ocurre una sola vez por cuenta.
 */
export async function notificarBienvenidaPanel(user: {
  email: string;
  name?: string | null;
}): Promise<void> {
  if (!emailConfigured()) return;
  const { resellerContext } = await import("./pricing");
  const ctx = resellerContext();
  const contenido = correoBienvenidaPanel({
    email: user.email,
    name: user.name,
    minTopupClp: ctx.minTopupClp,
    marginPercent: ctx.marginPercent,
  });
  try {
    await sendEmail({
      to: user.email,
      subject: contenido.subject,
      html: contenido.html,
      text: contenido.text,
    });
  } catch (error) {
    console.error("[email]", error);
  }
}
