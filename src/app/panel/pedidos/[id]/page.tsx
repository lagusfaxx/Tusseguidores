import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { panelUser } from "@/lib/reseller-auth";
import { pedidoDelCliente, tieneReposicion, yaReembolsado } from "@/lib/reseller-orders";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/orders";
import { formatClp, formatNumber } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";
import { get } from "@/lib/db";
import { accionPedirReposicion } from "../../actions";
import { PanelSubmit } from "@/components/panel-ui";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PanelPedidoDetalle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ nuevo?: string; error?: string }>;
}) {
  const user = await panelUser();
  if (!user) redirect("/panel/entrar");

  const { id } = await params;
  const { nuevo, error } = await searchParams;
  const order = pedidoDelCliente(user.id, Number(id));
  if (!order) notFound();

  const ticketAbierto = get<{ code: string; status: string }>(
    "SELECT code, status FROM tickets WHERE order_id = ? AND kind = 'reposicion' ORDER BY id DESC LIMIT 1",
    [order.id],
  );
  const puedeReposicion =
    tieneReposicion(order) &&
    ["completed", "partial", "processing"].includes(order.status) &&
    (!ticketAbierto || ticketAbierto.status === "cerrado");

  // "En cola" es el estado real de un pedido pagado que todavía no entró a
  // entrega: decirlo así evita el ticket de "no pasa nada con mi pedido".
  const enCola = !order.provider_order_id && !order.manual_dispatch_at && order.status === "paid";

  return (
    <>
      <Link href="/panel/pedidos" className="text-sm text-ink-400 hover:text-white">← Mis pedidos</Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <h1 className="font-mono text-2xl font-bold">{order.code}</h1>
        <span
          className={`rounded-full border px-2.5 py-1 text-xs font-semibold ${
            ORDER_STATUS_TONE[order.status as OrderStatus]
          }`}
        >
          {ORDER_STATUS_LABEL[order.status as OrderStatus]}
        </span>
      </div>

      {nuevo ? (
        <p className="mt-4 rounded-lg border border-lime-500/30 bg-lime-500/10 px-4 py-2.5 text-sm text-lime-200">
          Pedido creado.
        </p>
      ) : null}
      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          {error}
        </p>
      ) : null}
      {enCola ? (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100">
          En cola: todavía no entra a entrega. Se reintenta solo; si no sale, te devolvemos el
          saldo.
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start [&>*]:min-w-0">
        <section className="card p-5 sm:p-6">
          <h2 className="font-bold">{order.product_name}</h2>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["Servicio", `#${order.provider_service_id}`],
              ["Cantidad", formatNumber(order.quantity)],
              ["Cobrado de tu saldo", formatClp(order.amount_clp)],
              ["Creado", formatDateCl(order.created_at)],
              ["Estado de la entrega", order.provider_status ?? "—"],
              [
                "Avance",
                order.remains != null
                  ? `${formatNumber(Math.max(0, order.quantity - order.remains))} de ${formatNumber(order.quantity)}`
                  : "—",
              ],
              ["Conteo inicial", order.start_count != null ? formatNumber(order.start_count) : "—"],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex justify-between gap-4 border-b border-white/6 pb-2 last:border-0">
                <dt className="text-ink-400">{etiqueta}</dt>
                <dd className="text-right font-medium">{valor}</dd>
              </div>
            ))}
          </dl>

          <div className="mt-4">
            <p className="text-xs text-ink-400">Destino</p>
            <p className="mt-1 break-all font-mono text-xs text-ink-200">{order.link}</p>
          </div>

          {order.comments ? (
            <div className="mt-4">
              <p className="text-xs text-ink-400">
                Comentarios enviados ({order.comments.split("\n").length})
              </p>
              <pre className="mt-1 max-h-48 overflow-auto whitespace-pre-wrap rounded-lg border border-white/8 bg-white/3 p-3 text-xs">
                {order.comments}
              </pre>
            </div>
          ) : null}

          {yaReembolsado(order.id) ? (
            <p className="mt-4 rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-xs text-ink-200">
              Reembolsado a tu saldo.
            </p>
          ) : null}
        </section>

        <aside className="space-y-4">
          {puedeReposicion ? (
            <form action={accionPedirReposicion} className="card p-5">
              <input type="hidden" name="order_id" value={order.id} />
              <h2 className="font-bold">Pedir reposición</h2>
              <p className="mt-1.5 text-sm text-ink-400">
                Cuéntanos qué pasó y te respondemos en el ticket.
              </p>
              <textarea
                name="detalle"
                rows={3}
                className="field mt-3 text-sm"
                placeholder="Ej: bajaron 300 seguidores en dos días."
              />
              <div className="mt-4">
                <PanelSubmit className="btn btn-ghost w-full text-sm" pendiente="Enviando…">
                  Solicitar reposición
                </PanelSubmit>
              </div>
            </form>
          ) : ticketAbierto ? (
            <div className="card p-5">
              <h2 className="font-bold">Reposición solicitada</h2>
              <p className="mt-1.5 text-sm text-ink-400">
                Ticket{" "}
                <Link href={`/panel/tickets/${ticketAbierto.code}`} className="text-brand-300 hover:text-white">
                  {ticketAbierto.code}
                </Link>
                .
              </p>
            </div>
          ) : null}

          <div className="card p-5">
            <h2 className="font-bold">¿Algo no cuadra?</h2>
            <p className="mt-1.5 text-sm text-ink-400">Abre un ticket y lo revisamos.</p>
            <Link
              href={`/panel/tickets?pedido=${order.id}`}
              className="btn btn-ghost mt-4 w-full text-sm"
            >
              Abrir un ticket
            </Link>
          </div>
        </aside>
      </div>
    </>
  );
}
