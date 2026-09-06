import Link from "next/link";
import { ticketsParaAdmin, ETIQUETA_TICKET, TIPO_TICKET } from "@/lib/tickets";
import { formatDateCl } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function AdminTicketsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; error?: string }>;
}) {
  const { estado, error } = await searchParams;
  const tickets = ticketsParaAdmin(estado ?? "abiertos");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tickets del panel</h1>
          <p className="mt-1 text-sm text-ink-400">
            Consultas, problemas y solicitudes de reposición de los clientes mayoristas.
          </p>
        </div>
        <form className="flex gap-2">
          <select name="estado" defaultValue={estado ?? "abiertos"} className="field max-w-[180px]">
            <option value="abiertos">Abiertos</option>
            <option value="cerrados">Cerrados</option>
            <option value="todos">Todos</option>
          </select>
          <button type="submit" className="btn btn-ghost text-sm">Filtrar</button>
        </form>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="card mt-6 divide-y divide-white/6">
        {tickets.map((t) => (
          <Link
            key={t.id}
            href={`/admin/tickets/${t.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-white/4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{t.subject}</p>
              <p className="truncate text-xs text-ink-400">
                <span className="font-mono">{t.code}</span> · {t.user_email} ·{" "}
                {TIPO_TICKET[t.kind] ?? t.kind}
                {t.order_code ? ` · pedido ${t.order_code}` : ""}
              </p>
            </div>
            <span className="text-xs text-ink-400">{t.mensajes} mensajes</span>
            <span className="text-xs text-ink-400">{formatDateCl(t.updated_at)}</span>
            <span
              className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
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
          <p className="p-10 text-center text-sm text-ink-400">No hay tickets con ese filtro.</p>
        ) : null}
      </div>
    </>
  );
}
