import { NextResponse } from "next/server";
import { getPaymentStatus, FLOW_STATUS } from "@/lib/flow";
import { recargaPorCodigo, acreditar, rechazar } from "@/lib/topups";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/**
 * Webhook de Flow para las recargas de saldo del panel mayorista.
 *
 * Va aparte del de los pedidos de la tienda porque son dos cosas distintas y
 * mezclarlas obligaría a adivinar por el código. Lo demás es igual: nunca
 * confiamos en el cuerpo del POST, le preguntamos el estado a Flow con el
 * token, y acreditar es idempotente porque Flow reintenta.
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
    const topup = recargaPorCodigo(status.commerceOrder);
    if (!topup) return new NextResponse("unknown topup", { status: 404 });

    if (status.status === FLOW_STATUS.PAID) {
      // Si pagaron menos de lo pedido no acreditamos solos: lo revisa el dueño
      // desde el panel, con la recarga todavía pendiente.
      if (Math.round(status.amount) >= topup.amount_clp) {
        acreditar(topup.id, String(status.flowOrder));
      }
    } else if (status.status === FLOW_STATUS.REJECTED) {
      rechazar(topup.id, "Rechazada por Flow");
    } else if (status.status === FLOW_STATUS.CANCELED) {
      rechazar(topup.id, "Anulada por el comprador");
    }

    return new NextResponse("OK", { status: 200 });
  } catch (error) {
    console.error("[flow/recarga]", error);
    // 500 para que Flow lo reintente.
    return new NextResponse("error", { status: 500 });
  }
}
