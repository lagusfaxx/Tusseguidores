import Link from "next/link";
import { redirect } from "next/navigation";
import { panelUser } from "@/lib/reseller-auth";
import { ticketsDelCliente, ETIQUETA_TICKET, TIPO_TICKET } from "@/lib/tickets";
import { pedidoDelCliente, pedidosDelCliente } from "@/lib/reseller-orders";
import { formatDateCl } from "@/lib/utils";
import { PanelForm } from "@/components/panel-ui";
import { accionCrearTicket } from "../actions";

export const dynamic = "force-dynamic";

export default async function PanelTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ pedido?: string }>;
}) {
  const user = await panelUser();
  if (!user) redirect("/panel/entrar");

  const { pedido } = await searchParams;
  const tickets = ticketsDelCliente(user.id);
  const elegido = pedido ? pedidoDelCliente(user.id, Number(pedido)) : undefined;
  const recientes = pedidosDelCliente(user.id, 25);

  return (
    <>
      <h1 className="text-2xl font-bold">Soporte</h1>
      <p className="mt-1 text-sm text-ink-400">
        Las reposiciones se piden desde el pedido.
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start [&>*]:min-w-0">
        <div className="card p-6">
          <h2 className="font-bold">Nuevo ticket</h2>
          <PanelForm action={accionCrearTicket} submitLabel="Abrir ticket" pendiente="Abriendo…" className="mt-4">
            <label className="field-label" htmlFor="subject">Asunto</label>
            <input id="subject" name="subject" required className="field" maxLength={140} />

            <label className="field-label mt-4" htmlFor="kind">Tipo</label>
            <select id="kind" name="kind" className="field" defaultValue={elegido ? "problema" : "consulta"}>
              <option value="consulta">Consulta</option>
              <option value="problema">Problema con un pedido</option>
            </select>

            <label className="field-label mt-4" htmlFor="order_id">Pedido relacionado (opcional)</label>
            <select id="order_id" name="order_id" className="field" defaultValue={elegido?.id ?? ""}>
              <option value="">Ninguno</option>
              {recientes.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.code} · {o.product_name.slice(0, 40)}
                </option>
              ))}
            </select>

            <label className="field-label mt-4" htmlFor="body">Mensaje</label>
            <textarea id="body" name="body" rows={5} required className="field" maxLength={4000} />
          </PanelForm>
        </div>

        <section>
          <h2 className="font-bold">Mis tickets</h2>
          <div className="card mt-3 divide-y divide-white/6">
            {tickets.map((t) => (
              <Link
                key={t.id}
                href={`/panel/tickets/${t.code}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-2 p-4 transition-colors hover:bg-white/4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.subject}</p>
                  <p className="truncate text-xs text-ink-400">
                    <span className="font-mono">{t.code}</span> · {TIPO_TICKET[t.kind] ?? t.kind} ·{" "}
                    {formatDateCl(t.updated_at)}
                  </p>
                </div>
                <span
                  className={`shrink-0 rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                    t.status === "cerrado"
                      ? "bg-white/8 text-ink-400"
                      : t.status === "respondido"
                        ? "bg-lime-500/15 text-lime-300"
                        : "bg-amber-500/15 text-amber-300"
                  }`}
                >
                  {ETIQUETA_TICKET[t.status] ?? t.status}
                </span>
              </Link>
            ))}
            {tickets.length === 0 ? (
              <p className="p-8 text-center text-sm text-ink-400">Sin tickets.</p>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
