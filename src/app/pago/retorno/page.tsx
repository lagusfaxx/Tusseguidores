import Link from "next/link";
import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { Copiar } from "@/components/copiar";
import { getPaymentStatus, FLOW_STATUS } from "@/lib/flow";
import { getOrderByCode, markPaid, setStatus } from "@/lib/orders";
import { get } from "@/lib/db";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Resultado del pago",
  robots: { index: false, follow: false },
};

/**
 * Pantalla a la que Flow devuelve al comprador. La confirmación oficial llega
 * por el webhook, pero aquí volvemos a consultar el estado para no dejar al
 * cliente esperando si el webhook aún no llegó.
 */
export default async function PaymentReturnPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const { token } = await searchParams;
  if (!token) redirect("/seguimiento");

  let order: Order | undefined;
  let paid = false;
  let message = "No pudimos confirmar el pago automáticamente.";

  try {
    const status = await getPaymentStatus(token);
    order = getOrderByCode(status.commerceOrder);
    if (order) {
      if (status.status === FLOW_STATUS.PAID) {
        await markPaid(order.id, String(status.flowOrder));
        paid = true;
      } else if (status.status === FLOW_STATUS.REJECTED) {
        setStatus(order.id, "failed", "El pago fue rechazado por Flow.");
        message = "El pago fue rechazado. Puedes intentarlo de nuevo con otro medio de pago.";
      } else if (status.status === FLOW_STATUS.CANCELED) {
        setStatus(order.id, "canceled", "El pago fue anulado por el comprador.");
        message = "El pago quedó anulado. Si fue un error, puedes volver a comprar.";
      } else {
        message = "El pago está en proceso. Te avisaremos por correo apenas se confirme.";
      }
      order = getOrderByCode(order.code);
    }
  } catch {
    order = get<Order>("SELECT * FROM orders WHERE payment_token = ?", [token]);
  }

  return (
    <>
      <SiteHeader />
      <main className="bg-halo">
        <div className="mx-auto max-w-lg px-4 py-24 text-center">
          <div
            className={`mx-auto grid h-16 w-16 place-items-center rounded-2xl text-3xl ${
              paid ? "bg-lime-500/15 text-lime-400" : "bg-amber-500/15 text-amber-300"
            }`}
          >
            {paid ? "✓" : "!"}
          </div>

          <h1 className="mt-6 text-3xl font-extrabold tracking-tight">
            {paid ? "¡Pago confirmado!" : "Pago pendiente"}
          </h1>
          <p className="mt-3 text-ink-200">
            {paid
              ? "Ya enviamos tu pedido a entrega. Puedes seguir el avance en cualquier momento con tu código."
              : message}
          </p>

          {order ? (
            <>
              <p className="mt-6 text-sm text-ink-400">Tu código de pedido</p>
              <p className="flex items-center justify-center gap-2 font-mono text-2xl font-extrabold text-brand-300">
                {order.code}
                <Copiar valor={order.code} />
              </p>
              <p className="mx-auto mt-3 max-w-sm text-xs leading-relaxed text-ink-400">
                Anótalo o saca una foto: con este código sigues tu pedido cuando quieras.
                Si lo pierdes, escríbenos desde el correo que usaste al comprar.
              </p>
              <Link href={`/pedido/${order.code}`} className="btn btn-primary mt-8">
                Ver mi pedido
              </Link>
            </>
          ) : (
            <Link href="/seguimiento" className="btn btn-primary mt-8">
              Buscar mi pedido
            </Link>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
