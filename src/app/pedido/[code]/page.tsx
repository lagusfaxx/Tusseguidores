import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StatusBadge } from "@/components/order-status";
import { getOrderByCode, orderTargets, ORDER_STATUS_LABEL } from "@/lib/orders";
import {
  pasosDelPedido, resumenDeEstado, avanceDelPedido, puedeCorregirDestino,
} from "@/lib/order-tracking";
import { ticketsDePedido, mensajesDeTicket, ETIQUETA_TICKET } from "@/lib/tickets";
import { formatClp, formatNumber } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { Copiar } from "@/components/copiar";
import { datosTransferencia } from "@/lib/transfer";
import { TransferPanel } from "@/components/transfer-panel";
import { CorregirDestino, AbrirTicket } from "@/components/order-tracking-ui";
import { responderTicketDePedido } from "../actions";
import { get } from "@/lib/db";

export const metadata: Metadata = {
  title: "Estado de tu pedido",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ estado?: string; aviso?: string }>;
};

const TONO: Record<string, string> = {
  hecho: "border-lime-400/50 bg-lime-400/15 text-lime-300",
  actual: "border-brand-400/60 bg-brand-500/20 text-brand-300",
  pendiente: "border-white/12 bg-white/5 text-ink-400",
  problema: "border-amber-400/50 bg-amber-400/15 text-amber-300",
};

export default async function OrderPage({ params, searchParams }: Params) {
  const { code } = await params;
  const { estado, aviso } = await searchParams;
  const order = getOrderByCode(decodeURIComponent(code));
  if (!order) notFound();

  const settings = getSettings();
  const pasos = pasosDelPedido(order);
  const resumen = resumenDeEstado(order);
  const avance = avanceDelPedido(order);
  const tickets = ticketsDePedido(order.id);
  const destinos = orderTargets(order.id);
  const producto = order.product_id
    ? get<{ link_label: string; image_url: string | null; slug: string }>(
        "SELECT link_label, image_url, slug FROM products WHERE id = ?",
        [order.product_id],
      )
    : undefined;

  return (
    <>
      <SiteHeader />
      <main className="bg-halo">
        <div className="mx-auto max-w-3xl px-4 py-8 sm:py-12">
          {estado === "manual" ? (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              Tu pedido quedó registrado pero sin pagar. Escríbenos a{" "}
              <a className="underline" href={`mailto:${settings.contact_email}`}>{settings.contact_email}</a>{" "}
              con el código <strong>{order.code}</strong>.
            </div>
          ) : null}

          {/* ------------------------------------------------------ encabezado */}
          <div className="card overflow-hidden">
            <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 p-5 sm:p-6">
              <div className="min-w-0">
                <span className="text-xs uppercase tracking-wider text-ink-400">Pedido</span>
                <h1 className="mt-0.5 flex items-center gap-2 font-mono text-2xl font-extrabold tracking-tight">
                  {order.code}
                  <Copiar valor={order.code} />
                </h1>
                <p className="mt-2 text-lg font-bold">{resumen.titulo}</p>
                <p className="mt-0.5 text-sm text-ink-400">{resumen.detalle}</p>
              </div>
              <StatusBadge status={order.status} />
            </div>

            {/* ----------------------------------------------------- los pasos */}
            <ol className="grid gap-px bg-white/6 sm:grid-cols-4">
              {pasos.map((paso, i) => (
                <li key={paso.id} className="bg-ink-950/40 p-4">
                  <div className="flex items-center gap-2">
                    <span
                      className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${
                        TONO[paso.estado]
                      }`}
                    >
                      {paso.estado === "hecho" ? "✓" : paso.estado === "problema" ? "!" : i + 1}
                    </span>
                    <p
                      className={`text-sm font-semibold ${
                        paso.estado === "pendiente" ? "text-ink-400" : "text-white"
                      }`}
                    >
                      {paso.titulo}
                    </p>
                  </div>
                  <p className="mt-1.5 text-xs leading-relaxed text-ink-400">{paso.detalle}</p>
                  {paso.fecha ? (
                    <p className="mt-1 text-[11px] text-ink-600">{formatDateCl(paso.fecha)}</p>
                  ) : null}
                </li>
              ))}
            </ol>

            {order.payment_status === "paid" ? (
              <div className="border-t border-white/8 p-5 sm:p-6">
                <div className="flex items-center justify-between text-xs text-ink-400">
                  <span>Avance de la entrega</span>
                  <span className="font-semibold text-ink-200">{avance}%</span>
                </div>
                <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-[width]"
                    style={{ width: `${avance}%` }}
                  />
                </div>
                {order.remains != null ? (
                  <p className="mt-2 text-xs text-ink-400">
                    {formatNumber(Math.max(0, order.quantity - order.remains))} de{" "}
                    {formatNumber(order.quantity)} entregadas
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>

          {/* -------------------------------------------------------- el pedido */}
          <section className="card mt-5 p-5 sm:p-6">
            <div className="flex items-start gap-4">
              {producto?.image_url ? (
                /* eslint-disable-next-line @next/next/no-img-element */
                <img
                  src={producto.image_url}
                  alt=""
                  width={72}
                  height={72}
                  className="h-16 w-16 shrink-0 rounded-lg object-cover"
                />
              ) : null}
              <div className="min-w-0 flex-1">
                <h2 className="font-bold leading-snug">{order.product_name}</h2>
                <p className="mt-1 text-sm text-ink-400">
                  {formatNumber(order.quantity)} unidades · {formatClp(order.amount_clp)}
                </p>
              </div>
            </div>

            <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-white/8 pt-5 text-sm sm:grid-cols-2">
              <div className="sm:col-span-2">
                <dt className="text-ink-400">
                  {destinos.length > 1 ? `Destinos (${destinos.length} publicaciones)` : "Destino"}
                </dt>
                {destinos.length > 1 ? (
                  <dd className="mt-1 space-y-1.5">
                    {destinos.map((destino) => (
                      <div
                        key={destino.id}
                        className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg border border-white/8 bg-white/3 px-3 py-2"
                      >
                        <span className="min-w-0 flex-1 break-all font-mono text-xs text-ink-200">
                          {destino.link}
                        </span>
                        <span className="shrink-0 text-xs text-ink-400">
                          {formatNumber(destino.quantity)} ·{" "}
                          {destino.provider_order_id
                            ? ORDER_STATUS_LABEL[destino.status] ?? destino.status
                            : "en la fila"}
                        </span>
                      </div>
                    ))}
                  </dd>
                ) : (
                  <dd className="mt-0.5 break-all font-mono text-xs text-ink-200">{order.link}</dd>
                )}
              </div>
              <div>
                <dt className="text-ink-400">Fecha</dt>
                <dd>{formatDateCl(order.created_at)}</dd>
              </div>
              <div>
                <dt className="text-ink-400">Última actualización</dt>
                <dd>{formatDateCl(order.updated_at)}</dd>
              </div>
              {order.start_count != null ? (
                <div>
                  <dt className="text-ink-400">Conteo al empezar</dt>
                  <dd>{formatNumber(order.start_count)}</dd>
                </div>
              ) : null}
              {order.comments ? (
                <div className="sm:col-span-2">
                  <dt className="text-ink-400">Tus comentarios ({order.comments.split("\n").length})</dt>
                  <dd className="mt-1 max-h-44 overflow-y-auto whitespace-pre-line rounded-lg border border-white/10 bg-white/4 p-3 text-xs leading-relaxed text-ink-200">
                    {order.comments}
                  </dd>
                </div>
              ) : null}
            </dl>

            {producto?.slug ? (
              <Link
                href={`/producto/${producto.slug}`}
                className="mt-5 inline-block text-sm text-brand-300 hover:text-white"
              >
                Volver a pedir lo mismo →
              </Link>
            ) : null}
          </section>

          {order.payment_provider === "transferencia" && order.payment_status !== "paid" ? (
            <TransferPanel order={order} datos={datosTransferencia()} aviso={aviso === "1"} />
          ) : null}

          {/* --------------------------------------------- corregir y soporte */}
          <div id="soporte" className="mt-5 grid gap-5 sm:grid-cols-2 [&>*]:min-w-0">
            {puedeCorregirDestino(order) ? (
              <CorregirDestino
                code={order.code}
                links={destinos.length ? destinos.map((d) => d.link) : [order.link]}
                etiqueta={producto?.link_label ?? "Enlace o usuario"}
              />
            ) : (
              <div className="card p-5">
                <h2 className="font-bold">Destino</h2>
                <p className="mt-1 text-sm text-ink-400">
                  El pedido ya salió a entrega, así que el destino no se puede cambiar. Si hay un
                  problema, escríbenos por aquí.
                </p>
              </div>
            )}

            <AbrirTicket code={order.code} />
          </div>

          {/* ------------------------------------------------- conversaciones */}
          {tickets.map((ticket) => {
            const mensajes = mensajesDeTicket(ticket.id);
            return (
              <section key={ticket.id} className="card mt-5 p-5 sm:p-6">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h2 className="font-bold">{ticket.subject}</h2>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      ticket.status === "cerrado"
                        ? "bg-white/8 text-ink-400"
                        : ticket.status === "respondido"
                          ? "bg-lime-500/15 text-lime-300"
                          : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {ETIQUETA_TICKET[ticket.status] ?? ticket.status}
                  </span>
                </div>

                <div className="mt-4 space-y-3">
                  {mensajes.map((m) => (
                    <div
                      key={m.id}
                      className={`rounded-xl border p-3.5 ${
                        m.author === "admin"
                          ? "border-brand-400/30 bg-brand-500/5"
                          : "border-white/8 bg-white/3"
                      }`}
                    >
                      <p className="text-xs font-semibold text-ink-400">
                        {m.author === "admin" ? settings.site_name : "Tú"} ·{" "}
                        {formatDateCl(m.created_at)}
                      </p>
                      <p className="mt-1.5 whitespace-pre-line text-sm leading-relaxed text-ink-200">
                        {m.body}
                      </p>
                    </div>
                  ))}
                </div>

                {ticket.status !== "cerrado" ? (
                  <form action={responderTicketDePedido} className="mt-4">
                    <input type="hidden" name="code" value={order.code} />
                    <input type="hidden" name="ticket" value={ticket.code} />
                    <textarea
                      name="body"
                      rows={3}
                      required
                      className="field text-sm"
                      placeholder="Escribe tu respuesta"
                      maxLength={4000}
                    />
                    <button type="submit" className="btn btn-ghost mt-3 text-sm">Responder</button>
                  </form>
                ) : null}
              </section>
            );
          })}

          <p className="mt-6 text-center text-sm text-ink-400">
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
