import Link from "next/link";
import { all } from "@/lib/db";
import { recargasPorConfirmar, ETIQUETA_RECARGA } from "@/lib/topups";
import { resolverRecarga } from "@/app/admin/actions";
import { formatClp } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";
import { datosTransferencia } from "@/lib/transfer";
import type { Topup } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminRecargasPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  const pendientes = recargasPorConfirmar();
  const ultimas = all<Topup & { user_email: string }>(
    `SELECT t.*, u.email AS user_email FROM topups t
       JOIN reseller_users u ON u.id = t.user_id
      WHERE t.status != 'pending'
      ORDER BY t.id DESC LIMIT 25`,
  );
  const datos = datosTransferencia();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Recargas de saldo</h1>
          <p className="mt-1 text-sm text-ink-400">
            Las de Webpay se acreditan solas. Aquí confirmas las transferencias, después de ver la
            plata en la cuenta {datos.banco ? `de ${datos.banco}` : ""}.
          </p>
        </div>
        <Link href="/admin/mayoristas" className="btn btn-ghost text-sm">Clientes mayoristas</Link>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <h2 className="mt-8 font-bold">Por confirmar ({pendientes.length})</h2>
      <div className="mt-3 space-y-3">
        {pendientes.map((r) => (
          <div key={r.id} className="card p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <p className="font-mono text-sm text-brand-300">{r.code}</p>
                <p className="mt-1 font-semibold">
                  {formatClp(r.amount_clp)} · {r.user_email}
                </p>
                <p className="mt-1 text-xs text-ink-400">
                  Pedida el {formatDateCl(r.created_at)} ·{" "}
                  {r.notified_at
                    ? `el cliente avisó el ${formatDateCl(r.notified_at)}${
                        r.transfer_reference ? ` (comprobante ${r.transfer_reference})` : ""
                      }`
                    : "el cliente todavía no avisa"}
                </p>
              </div>
              <div className="flex flex-wrap items-end gap-2">
                <form action={resolverRecarga} className="flex items-end gap-2">
                  <input type="hidden" name="topup_id" value={r.id} />
                  <input type="hidden" name="accion" value="acreditar" />
                  <input
                    name="referencia"
                    className="field max-w-[180px] text-xs"
                    placeholder="Referencia (opcional)"
                  />
                  <button type="submit" className="btn btn-primary whitespace-nowrap text-sm">
                    Acreditar saldo
                  </button>
                </form>
                <form action={resolverRecarga}>
                  <input type="hidden" name="topup_id" value={r.id} />
                  <input type="hidden" name="accion" value="rechazar" />
                  <button type="submit" className="btn btn-ghost text-sm">Rechazar</button>
                </form>
              </div>
            </div>
          </div>
        ))}
        {pendientes.length === 0 ? (
          <p className="card p-8 text-center text-sm text-ink-400">
            No hay transferencias esperando confirmación.
          </p>
        ) : null}
      </div>

      <h2 className="mt-10 font-bold">Historial</h2>
      <div className="card mt-3 overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr><th>Código</th><th>Cliente</th><th>Monto</th><th>Forma</th><th>Estado</th><th>Fecha</th></tr>
          </thead>
          <tbody>
            {ultimas.map((r) => (
              <tr key={r.id}>
                <td className="font-mono text-xs">{r.code}</td>
                <td>{r.user_email}</td>
                <td className="font-semibold">{formatClp(r.amount_clp)}</td>
                <td className="text-xs text-ink-400">{r.method === "flow" ? "Webpay" : "Transferencia"}</td>
                <td>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      r.status === "paid" ? "bg-lime-500/15 text-lime-400" : "bg-white/8 text-ink-400"
                    }`}
                  >
                    {ETIQUETA_RECARGA[r.status] ?? r.status}
                  </span>
                </td>
                <td className="whitespace-nowrap text-xs text-ink-400">
                  {formatDateCl(r.paid_at ?? r.created_at)}
                </td>
              </tr>
            ))}
            {ultimas.length === 0 ? (
              <tr><td colSpan={6} className="py-8 text-center text-ink-400">Sin recargas todavía.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
