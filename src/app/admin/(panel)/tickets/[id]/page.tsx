import Link from "next/link";
import { notFound } from "next/navigation";
import { get } from "@/lib/db";
import { ticketPorId, mensajesDeTicket, ETIQUETA_TICKET, TIPO_TICKET } from "@/lib/tickets";
import { getOrderById } from "@/lib/orders";
import { responderTicket, reposicionDesdeTicket } from "@/app/admin/actions";
import { formatClp, formatNumber } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";
import { ORDER_STATUS_LABEL } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminTicketDetalle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const ticket = ticketPorId(Number(id));
  if (!ticket) notFound();

  const cliente = get<{ email: string; name: string; balance_clp: number }>(
    "SELECT email, name, balance_clp FROM reseller_users WHERE id = ?",
    [ticket.user_id],
  );
  const mensajes = mensajesDeTicket(ticket.id);
  const order = ticket.order_id ? getOrderById(ticket.order_id) : undefined;

  return (
    <>
      <Link href="/admin/tickets" className="text-sm text-ink-400 hover:text-white">← Tickets</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{ticket.subject}</h1>
          <p className="mt-1 text-xs text-ink-400">
            <span className="font-mono">{ticket.code}</span> · {TIPO_TICKET[ticket.kind] ?? ticket.kind} ·{" "}
            <Link href={`/admin/mayoristas/${ticket.user_id}`} className="text-brand-300 hover:text-white">
              {cliente?.email}
            </Link>
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
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

      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr] lg:items-start">
        <div>
          <div className="space-y-3">
            {mensajes.map((m) => (
              <div
                key={m.id}
                className={`card p-4 ${m.author === "admin" ? "border-brand-400/30 bg-brand-500/5" : ""}`}
              >
                <p className="text-xs font-semibold text-ink-400">
                  {m.author === "admin" ? "Tú" : cliente?.email} · {formatDateCl(m.created_at)}
                </p>
                <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-200">{m.body}</p>
              </div>
            ))}
          </div>

          <form action={responderTicket} className="card mt-5 p-5">
            <input type="hidden" name="ticket_id" value={ticket.id} />
            <label className="field-label" htmlFor="body">Responder al cliente</label>
            <textarea id="body" name="body" rows={4} className="field" maxLength={4000} />
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="submit" name="accion" value="responder" className="btn btn-primary text-sm">
                Enviar respuesta
              </button>
              {ticket.status === "cerrado" ? (
                <button type="submit" name="accion" value="reabrir" className="btn btn-ghost text-sm">
                  Reabrir
                </button>
              ) : (
                <button type="submit" name="accion" value="cerrar" className="btn btn-ghost text-sm">
                  Responder y cerrar
                </button>
              )}
            </div>
          </form>
        </div>

        <aside className="space-y-4">
          {cliente ? (
            <section className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Cliente</h2>
              <p className="mt-3 text-sm">{cliente.name || cliente.email}</p>
              <p className="mt-1 text-sm text-ink-400">Saldo: {formatClp(cliente.balance_clp)}</p>
              <Link
                href={`/admin/mayoristas/${ticket.user_id}`}
                className="btn btn-ghost mt-4 w-full text-sm"
              >
                Ver la cuenta
              </Link>
            </section>
          ) : null}

          {order ? (
            <section className="card p-5">
              <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Pedido</h2>
              <p className="mt-3 font-mono text-sm text-brand-300">{order.code}</p>
              <p className="mt-1 text-sm">{order.product_name}</p>
              <p className="mt-1 text-xs text-ink-400">
                {formatNumber(order.quantity)} u. · {formatClp(order.amount_clp)} ·{" "}
                {ORDER_STATUS_LABEL[order.status as OrderStatus]}
                {order.provider_order_id ? ` · proveedor #${order.provider_order_id}` : ""}
              </p>

              {ticket.kind === "reposicion" && order.provider_order_id ? (
                <form action={reposicionDesdeTicket} className="mt-4">
                  <input type="hidden" name="ticket_id" value={ticket.id} />
                  <input type="hidden" name="order_id" value={order.id} />
                  <button type="submit" className="btn btn-primary w-full text-sm">
                    Pedir la reposición al proveedor
                  </button>
                  <p className="mt-2 text-[11px] leading-relaxed text-ink-400">
                    Se la pide al proveedor con el número de pedido y deja la respuesta escrita en
                    este ticket.
                  </p>
                </form>
              ) : null}

              <Link href={`/admin/pedidos/${order.id}`} className="btn btn-ghost mt-3 w-full text-sm">
                Abrir el pedido
              </Link>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
