import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StatusBadge } from "@/components/order-status";
import { getOrderByCode, getOrderEvents } from "@/lib/orders";
import { formatClp, formatNumber } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { datosTransferencia } from "@/lib/transfer";
import { TransferPanel } from "@/components/transfer-panel";

export const metadata: Metadata = {
  title: "Estado de tu pedido",
  robots: { index: false, follow: false },
};

type Params = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ estado?: string; aviso?: string }>;
};

export default async function OrderPage({ params, searchParams }: Params) {
  const { code } = await params;
  const { estado, aviso } = await searchParams;
  const order = getOrderByCode(decodeURIComponent(code));
  if (!order) notFound();

  const events = getOrderEvents(order.id);
  const settings = getSettings();
  const progress =
    order.remains != null && order.quantity > 0
      ? Math.max(0, Math.min(100, Math.round(((order.quantity - order.remains) / order.quantity) * 100)))
      : order.status === "completed"
        ? 100
        : order.status === "processing"
          ? 15
          : 0;

  return (
    <>
      <SiteHeader />
      <main className="bg-halo">
        <div className="mx-auto max-w-2xl px-4 py-14">
          {estado === "transferencia" ? (
            <div className="mb-6 rounded-xl border border-lime-500/30 bg-lime-500/10 p-4 text-sm text-lime-100">
              Tu pedido quedó reservado. Sigue las instrucciones de más abajo para transferir; en
              cuanto confirmemos el pago sale a entrega.
            </div>
          ) : null}

          {estado === "manual" ? (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              Tu pedido quedó registrado, pero todavía no está pagado. Escríbenos a{" "}
              <a className="underline" href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>{" "}
              con el código <strong>{order.code}</strong> para coordinar el pago.
            </div>
          ) : null}

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <span className="text-xs uppercase tracking-wider text-ink-400">Pedido</span>
              <h1 className="font-mono text-3xl font-extrabold tracking-tight">{order.code}</h1>
            </div>
            <StatusBadge status={order.status} />
          </div>

          <div className="card mt-6 p-6">
            <h2 className="text-lg font-bold">{order.product_name}</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div>
                <dt className="text-ink-400">Cantidad</dt>
                <dd className="font-semibold">{formatNumber(order.quantity)}</dd>
              </div>
              <div>
                <dt className="text-ink-400">Total pagado</dt>
                <dd className="font-semibold">{formatClp(order.amount_clp)}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-ink-400">Destino</dt>
                <dd className="break-all font-mono text-xs text-ink-200">{order.link}</dd>
              </div>
              <div>
                <dt className="text-ink-400">Creado</dt>
                <dd>{formatDateCl(order.created_at)}</dd>
              </div>
              <div>
                <dt className="text-ink-400">Última actualización</dt>
                <dd>{formatDateCl(order.updated_at)}</dd>
              </div>
              {order.comments ? (
                <div className="sm:col-span-2">
                  <dt className="text-ink-400">Tus comentarios ({order.comments.split("\n").length})</dt>
                  <dd className="mt-1 max-h-44 overflow-y-auto whitespace-pre-line rounded-lg border border-white/10 bg-white/4 p-3 text-xs leading-relaxed text-ink-200">
                    {order.comments}
                  </dd>
                </div>
              ) : null}
              {order.start_count != null ? (
                <div>
                  <dt className="text-ink-400">Conteo inicial</dt>
                  <dd>{formatNumber(order.start_count)}</dd>
                </div>
              ) : null}
              {order.remains != null ? (
                <div>
                  <dt className="text-ink-400">Faltan por entregar</dt>
                  <dd>{formatNumber(order.remains)}</dd>
                </div>
              ) : null}
            </dl>

            {order.payment_status === "paid" ? (
              <div className="mt-6">
                <div className="flex items-center justify-between text-xs text-ink-400">
                  <span>Avance de la entrega</span>
                  <span>{progress}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-[width]"
                    style={{ width: `${progress}%` }}
                  />
                </div>
              </div>
            ) : null}
          </div>

          {order.payment_provider === "transferencia" ? (
            <TransferPanel order={order} datos={datosTransferencia()} aviso={aviso === "1"} />
          ) : null}

          <section className="card mt-6 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Historial</h2>
            <ol className="mt-4 space-y-3">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                  <div>
                    <p className="text-ink-200">{event.message}</p>
                    <p className="text-xs text-ink-400">{formatDateCl(event.created_at)}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>

          <p className="mt-6 text-center text-sm text-ink-400">
            ¿Algo no cuadra? Escríbenos a{" "}
            <a className="text-brand-300 hover:underline" href={`mailto:${settings.contact_email}`}>
              {settings.contact_email}
            </a>{" "}
            con tu código. ·{" "}
            <Link href="/seguimiento" className="text-brand-300 hover:underline">
              Buscar otro pedido
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
