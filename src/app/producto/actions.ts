"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createOrder, logEvent, setStatus } from "@/lib/orders";
import { createPayment, checkoutUrl, flowConfigured, FlowError } from "@/lib/flow";
import { absoluteUrl } from "@/lib/seo";
import { getSettings, getBoolSetting } from "@/lib/settings";
import { getProductById } from "@/lib/catalog";
import { isValidEmail, normalizeTarget } from "@/lib/utils";
import { run } from "@/lib/db";

export type CheckoutState = { error?: string };

export async function startCheckout(
  _prev: CheckoutState,
  formData: FormData,
): Promise<CheckoutState> {
  if (!getBoolSetting("orders_enabled", true)) {
    return { error: "La tienda no está recibiendo pedidos en este momento. Vuelve a intentarlo más tarde." };
  }

  const productId = Number(formData.get("productId"));
  const quantity = Number(formData.get("quantity"));
  const rawLink = String(formData.get("link") ?? "");
  const email = String(formData.get("email") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const coupon = String(formData.get("coupon") ?? "");
  const comments = String(formData.get("comments") ?? "");

  const product = getProductById(productId);
  if (!product) return { error: "El producto ya no está disponible." };
  if (!rawLink.trim()) return { error: "Falta el enlace o usuario de destino." };
  if (!isValidEmail(email)) return { error: "Revisa tu correo: lo necesitamos para enviarte el comprobante." };

  const link = normalizeTarget(rawLink, product.platform);

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const created = createOrder({
    productId,
    quantity,
    link,
    comments,
    email,
    phone,
    couponCode: coupon,
    ip: ip ?? undefined,
  });
  if (!created.ok) return { error: created.error };

  const order = created.order;
  const settings = getSettings();

  if (!flowConfigured()) {
    // Sin pasarela configurada el pedido queda pendiente y se aprueba a mano
    // desde el panel. Así la tienda nunca deja al cliente en una pantalla rota.
    logEvent(order.id, "info", "Flow no está configurado: el pedido quedó pendiente de pago manual.");
    redirect(`/pedido/${order.code}?estado=manual`);
  }

  let url: string;
  try {
    const payment = await createPayment({
      commerceOrder: order.code,
      subject: `${order.product_name} · ${order.quantity.toLocaleString("es-CL")} unidades`,
      amount: order.amount_clp,
      email: order.email,
      urlConfirmation: absoluteUrl("/api/flow/confirmar"),
      urlReturn: absoluteUrl("/pago/retorno"),
    });
    run("UPDATE orders SET payment_token = ?, updated_at = datetime('now') WHERE id = ?", [
      payment.token,
      order.id,
    ]);
    logEvent(order.id, "info", "Redirigido a Flow para el pago.");
    url = checkoutUrl(payment);
  } catch (error) {
    // El detalle técnico queda en el historial del pedido y en el registro del
    // servidor; al comprador no le sirve leer "apiKey not found".
    const detail = error instanceof FlowError ? (error.detail ?? error.message) : String(error);
    console.error("[checkout] Flow:", detail);
    setStatus(order.id, "failed", `No se pudo crear el pago en Flow: ${detail}`);
    return {
      error:
        `No pudimos abrir el pago en este momento. Tu pedido quedó guardado con el código ${order.code}: ` +
        `escríbenos a ${settings.contact_email} y lo resolvemos, o inténtalo de nuevo en unos minutos.`,
    };
  }

  redirect(url);
}
