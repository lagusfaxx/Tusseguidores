"use server";

import { after } from "next/server";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { createOrder, logEvent } from "@/lib/orders";
import { notificarPedidoNuevo, notificarTransferenciaPendiente } from "@/lib/notify";
import { getBoolSetting } from "@/lib/settings";
import { getProductById } from "@/lib/catalog";
import { transferenciaDisponible } from "@/lib/transfer";
import { isValidEmail } from "@/lib/utils";
import { separarDestinos } from "@/lib/targets";
import { abrirPagoFlow } from "@/lib/checkout";

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
  // Repartido entre publicaciones: un enlace por línea. La validación de qué
  // sirve como destino está en createOrder, que es por donde entran también
  // los pedidos del panel mayorista.
  const rawLinks = separarDestinos(String(formData.get("links") ?? ""));
  const email = String(formData.get("email") ?? "");
  const phone = String(formData.get("phone") ?? "");
  const coupon = String(formData.get("coupon") ?? "");
  const comments = String(formData.get("comments") ?? "");
  // El botón que se apretó decide el camino.
  const metodo = String(formData.get("metodo") ?? "flow") === "transferencia" ? "transferencia" : "flow";

  const product = getProductById(productId);
  if (!product) return { error: "El producto ya no está disponible." };
  if (!rawLink.trim() && !rawLinks.length) return { error: "Falta el enlace o usuario de destino." };
  if (!isValidEmail(email)) return { error: "Revisa tu correo: lo necesitamos para enviarte el comprobante." };

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  if (metodo === "transferencia" && !transferenciaDisponible()) {
    return { error: "El pago por transferencia no está disponible ahora. Usa Webpay." };
  }

  const created = createOrder({
    productId,
    quantity,
    link: rawLink,
    links: rawLinks,
    comments,
    paymentProvider: metodo,
    email,
    phone,
    couponCode: coupon,
    ip: ip ?? undefined,
  });
  if (!created.ok) return { error: created.error };

  const order = created.order;

  // Solo se avisa de los pedidos por transferencia, que esperan que alguien
  // revise la cuenta. Los de Webpay avisan cuando se pagan: avisar al abrir el
  // pago llenaba la bandeja de compras que nunca se concretaron.
  if (metodo === "transferencia" && !created.reutilizado) {
    after(async () => {
      await notificarPedidoNuevo(order);
    });
  }

  if (metodo === "transferencia") {
    // No se cobra nada acá: el pedido espera a que el dueño vea la plata.
    logEvent(order.id, "info", "Esperando la transferencia del cliente.");
    // Los datos de la cuenta también por correo: el cliente los necesita
    // cuando abra el banco, que casi nunca es en esta misma pestaña.
    await notificarTransferenciaPendiente(order);
    redirect(`/pedido/${order.code}?estado=transferencia`);
  }

  const url = await abrirPagoFlow(order);
  if ("error" in url) return url;
  redirect(url.url);
}
