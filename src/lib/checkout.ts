import "server-only";
import { createPayment, checkoutUrl, flowConfigured, FlowError } from "./flow";
import { logEvent } from "./orders";
import { absoluteUrl } from "./seo";
import { run } from "./db";
import type { Order } from "./types";

/**
 * Abre el pago en Flow para un pedido ya guardado.
 *
 * Se usa al comprar y también cuando el cliente, desde su pedido, decide pasar
 * de transferencia a Webpay: es el mismo pedido, no uno nuevo.
 */
export async function abrirPagoFlow(order: Order): Promise<{ url: string } | { error: string }> {
  if (!flowConfigured()) {
    // Sin pasarela configurada el pedido queda pendiente y se aprueba a mano
    // desde el panel. Así la tienda nunca deja al cliente en una pantalla rota.
    logEvent(order.id, "info", "Flow no está configurado: el pedido quedó pendiente de pago manual.");
    return { url: `/pedido/${order.code}?estado=manual` };
  }

  try {
    // Flow no acepta dos pagos con la misma orden de comercio. Si el cliente
    // ya había abierto uno para este pedido, el nuevo intento lleva sufijo
    // (ver pedidoDeOrdenFlow, que lo vuelve a juntar con su pedido).
    const commerceOrder = order.payment_token
      ? `${order.code}-${Date.now().toString(36).slice(-4).toUpperCase()}`
      : order.code;
    const payment = await createPayment({
      commerceOrder,
      subject: `${order.product_name} · ${order.quantity.toLocaleString("es-CL")} unidades`,
      amount: order.amount_clp,
      email: order.email,
      urlConfirmation: absoluteUrl("/api/flow/confirmar"),
      urlReturn: absoluteUrl("/pago/retorno"),
    });
    run(
      `UPDATE orders SET payment_token = ?, payment_provider = 'flow', status = 'pending',
              updated_at = datetime('now') WHERE id = ?`,
      [payment.token, order.id],
    );
    logEvent(order.id, "info", "Redirigido a Flow para el pago.");
    return { url: checkoutUrl(payment) };
  } catch (error) {
    // El detalle técnico queda en el historial del pedido y en el registro del
    // servidor; al comprador no le sirve leer "apiKey not found".
    const detail = error instanceof FlowError ? (error.detail ?? error.message) : String(error);
    console.error("[checkout] Flow:", detail);
    logEvent(order.id, "warning", `No se pudo crear el pago en Flow: ${detail}`);
    return {
      error:
        `No pudimos abrir el pago en este momento. Tu pedido quedó guardado con el código ${order.code}: ` +
        "inténtalo de nuevo en unos minutos, o paga por transferencia desde la página de tu pedido.",
    };
  }
}
