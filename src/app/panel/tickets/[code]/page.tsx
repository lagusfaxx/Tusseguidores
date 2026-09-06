import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { panelUser } from "@/lib/reseller-auth";
import { ticketDelCliente, mensajesDeTicket, ETIQUETA_TICKET, TIPO_TICKET } from "@/lib/tickets";
import { getOrderById } from "@/lib/orders";
import { formatDateCl } from "@/lib/utils";
import { PanelSubmit } from "@/components/panel-ui";
import { accionResponderTicket } from "../../actions";

export const dynamic = "force-dynamic";

export default async function PanelTicketDetalle({ params }: { params: Promise<{ code: string }> }) {
  const user = await panelUser();
  if (!user) redirect("/panel/entrar");

  const { code } = await params;
  const ticket = ticketDelCliente(user.id, code);
  if (!ticket) notFound();

  const mensajes = mensajesDeTicket(ticket.id);
  const order = ticket.order_id ? getOrderById(ticket.order_id) : undefined;

  return (
    <div className="mx-auto max-w-3xl">
      <Link href="/panel/tickets" className="text-sm text-ink-400 hover:text-white">← Soporte</Link>

      <div className="mt-4 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">{ticket.subject}</h1>
          <p className="mt-1 text-xs text-ink-400">
            <span className="font-mono">{ticket.code}</span> · {TIPO_TICKET[ticket.kind] ?? ticket.kind}
            {order ? (
              <>
                {" · pedido "}
                <Link href={`/panel/pedidos/${order.id}`} className="text-brand-300 hover:text-white">
                  {order.code}
                </Link>
              </>
            ) : null}
          </p>
        </div>
        <span
          className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
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

      <div className="mt-6 space-y-3">
        {mensajes.map((m) => (
          <div
            key={m.id}
            className={`card p-4 ${m.author === "admin" ? "border-brand-400/30 bg-brand-500/5" : ""}`}
          >
            <p className="text-xs font-semibold text-ink-400">
              {m.author === "admin" ? "Soporte" : "Tú"} · {formatDateCl(m.created_at)}
            </p>
            <p className="mt-2 whitespace-pre-line text-sm leading-relaxed text-ink-200">{m.body}</p>
          </div>
        ))}
      </div>

      {ticket.status !== "cerrado" ? (
        <form action={accionResponderTicket} className="card mt-6 p-5">
          <input type="hidden" name="code" value={ticket.code} />
          <label className="field-label" htmlFor="body">Responder</label>
          <textarea id="body" name="body" rows={4} required className="field" maxLength={4000} />
          <div className="mt-4">
            <PanelSubmit className="btn btn-primary text-sm" pendiente="Enviando…">Enviar</PanelSubmit>
          </div>
        </form>
      ) : (
        <p className="mt-6 rounded-lg border border-white/10 bg-white/4 px-4 py-3 text-sm text-ink-400">
          Este ticket está cerrado. Si el problema sigue, abre uno nuevo.
        </p>
      )}
    </div>
  );
}
