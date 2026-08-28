import { NextResponse } from "next/server";
import { getPaymentStatus, FLOW_STATUS } from "@/lib/flow";
import { getOrderByCode, logEvent, markPaid, setStatus } from "@/lib/orders";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Webhook de confirmación de Flow.
 *
 * Flow envía el token por POST y espera un 200. Nunca confiamos en el cuerpo
 * del POST para decidir si está pagado: consultamos el estado directamente a
 * Flow con ese token. Es idempotente porque Flow reintenta la confirmación.
 */
export async function POST(request: Request) {
  let token = "";
  try {
    const form = await request.formData();
    token = String(form.get("token") ?? "");
  } catch {
    return new NextResponse("bad request", { status: 400 });
  }
  if (!token) return new NextResponse("missing token", { status: 400 });

  try {
    const status = await getPaymentStatus(token);
    const order = getOrderByCode(status.commerceOrder);
    if (!order) return new NextResponse("unknown order", { status: 404 });

    if (status.status === FLOW_STATUS.PAID) {
      // El monto debe calzar con lo que cobramos; si no, lo revisamos a mano.
      if (Math.round(status.amount) !== order.amount_clp) {
        logEvent(
          order.id,
          "warning",
          `El monto pagado (${status.amount}) no coincide con el del pedido (${order.amount_clp}). Revisar manualmente.`,
        );
      }
      await markPaid(order.id, String(status.flowOrder));
    } else if (status.status === FLOW_STATUS.REJECTED) {
      setStatus(order.id, "failed", "El pago fue rechazado por Flow.");
    } else if (status.status === FLOW_STATUS.CANCELED) {
      setStatus(order.id, "canceled", "El pago fue anulado.");
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[flow/confirmar]", error);
    // Devolvemos 500 para que Flow reintente más tarde.
    return new NextResponse("error", { status: 500 });
  }
}
