import Link from "next/link";
import { all } from "@/lib/db";
import { formatClp, formatNumber } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Fila = {
  id: number;
  email: string;
  name: string;
  balance_clp: number;
  discount_percent: number;
  status: string;
  created_at: string;
  last_login_at: string | null;
  pedidos: number;
  gastado: number;
};

export default async function AdminMayoristasPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; error?: string }>;
}) {
  const { q, error } = await searchParams;
  const where = q?.trim() ? "WHERE u.email LIKE ? OR u.name LIKE ?" : "";
  const params = q?.trim() ? [`%${q.trim()}%`, `%${q.trim()}%`] : [];

  const filas = all<Fila>(
    `SELECT u.*,
            (SELECT COUNT(*) FROM orders o WHERE o.reseller_user_id = u.id) AS pedidos,
            (SELECT COALESCE(SUM(o.amount_clp), 0) FROM orders o
              WHERE o.reseller_user_id = u.id AND o.status != 'refunded') AS gastado
       FROM reseller_users u ${where}
      ORDER BY u.balance_clp DESC, u.id DESC`,
    params,
  );

  const saldoTotal = filas.reduce((suma, f) => suma + f.balance_clp, 0);

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Clientes mayoristas</h1>
          <p className="mt-1 text-sm text-ink-400">
            {filas.length} cuentas · {formatClp(saldoTotal)} de saldo cargado sin gastar
          </p>
        </div>
        <Link href="/admin/recargas" className="btn btn-ghost text-sm">Recargas por confirmar</Link>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <form className="mt-6 flex flex-wrap gap-3">
        <input name="q" defaultValue={q ?? ""} className="field max-w-xs" placeholder="Buscar por correo o nombre" />
        <button type="submit" className="btn btn-ghost text-sm">Buscar</button>
      </form>

      <div className="card mt-6 overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Cliente</th><th>Saldo</th><th>Descuento</th><th>Pedidos</th>
              <th>Gastado</th><th>Última entrada</th><th>Estado</th>
            </tr>
          </thead>
          <tbody>
            {filas.map((f) => (
              <tr key={f.id}>
                <td>
                  <Link href={`/admin/mayoristas/${f.id}`} className="font-semibold text-brand-300 hover:text-white">
                    {f.email}
                  </Link>
                  <div className="text-[11px] text-ink-400">{f.name || "—"}</div>
                </td>
                <td className="font-semibold">{formatClp(f.balance_clp)}</td>
                <td>{f.discount_percent > 0 ? `${f.discount_percent}%` : "—"}</td>
                <td>{formatNumber(f.pedidos)}</td>
                <td>{formatClp(f.gastado)}</td>
                <td className="whitespace-nowrap text-xs text-ink-400">{formatDateCl(f.last_login_at)}</td>
                <td>
                  <span
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      f.status === "blocked" ? "bg-red-500/15 text-red-300" : "bg-lime-500/15 text-lime-400"
                    }`}
                  >
                    {f.status === "blocked" ? "Suspendido" : "Activo"}
                  </span>
                </td>
              </tr>
            ))}
            {filas.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-ink-400">Sin clientes mayoristas todavía.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
