import Link from "next/link";
import { notFound } from "next/navigation";
import { get, all } from "@/lib/db";
import { movimientos, saldoSegunLibro, ETIQUETA_MOVIMIENTO } from "@/lib/wallet";
import { ajustarSaldo, cambiarEstadoMayorista } from "@/app/admin/actions";
import { ActionForm } from "@/components/admin-ui";
import { formatClp, formatNumber } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";
import { ORDER_STATUS_LABEL } from "@/lib/orders";
import type { Order, OrderStatus, ResellerUser } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminMayoristaDetalle({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const user = get<ResellerUser>("SELECT * FROM reseller_users WHERE id = ?", [Number(id)]);
  if (!user) notFound();

  const historial = movimientos(user.id, 40);
  const libro = saldoSegunLibro(user.id);
  const pedidos = all<Order>(
    "SELECT * FROM orders WHERE reseller_user_id = ? ORDER BY id DESC LIMIT 15",
    [user.id],
  );

  return (
    <>
      <Link href="/admin/mayoristas" className="text-sm text-ink-400 hover:text-white">← Mayoristas</Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">{user.email}</h1>
          <p className="mt-1 text-sm text-ink-400">
            {user.name || "Sin nombre"} · {user.phone || "sin teléfono"} · desde{" "}
            {formatDateCl(user.created_at)}
          </p>
        </div>
        <span
          className={`rounded-full px-3 py-1 text-sm font-semibold ${
            user.status === "blocked" ? "bg-red-500/15 text-red-300" : "bg-lime-500/15 text-lime-400"
          }`}
        >
          {user.status === "blocked" ? "Suspendido" : "Activo"}
        </span>
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-start [&>*]:min-w-0">
        <div className="space-y-6">
          <section className="card p-6">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-ink-400">Saldo</p>
                <p className="mt-1 text-3xl font-extrabold tracking-tight text-lime-400">
                  {formatClp(user.balance_clp)}
                </p>
              </div>
              {/* El libro es la verdad: si no cuadra con el espejo hay que
                  mirarlo, y es mejor verlo aquí que no verlo nunca. */}
              {libro !== user.balance_clp ? (
                <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-xs text-red-200">
                  El libro suma {formatClp(libro)} y el saldo dice {formatClp(user.balance_clp)}. Revisar.
                </p>
              ) : (
                <p className="text-xs text-ink-400">Cuadra con el libro de movimientos.</p>
              )}
            </div>
          </section>

          <section className="card p-6">
            <h2 className="font-bold">Movimientos</h2>
            <div className="mt-4 divide-y divide-white/6">
              {historial.map((m) => (
                <div key={m.id} className="flex items-center gap-3 py-2.5 text-sm">
                  <div className="min-w-0 flex-1">
                    <p>{ETIQUETA_MOVIMIENTO[m.kind] ?? m.kind}</p>
                    <p className="truncate text-xs text-ink-400">
                      {m.note || "—"} · {formatDateCl(m.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className={m.amount_clp >= 0 ? "font-semibold text-lime-400" : "font-semibold"}>
                      {m.amount_clp >= 0 ? "+" : "−"}
                      {formatClp(Math.abs(m.amount_clp))}
                    </p>
                    <p className="text-[11px] text-ink-400">saldo {formatClp(m.balance_after)}</p>
                  </div>
                </div>
              ))}
              {historial.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">Sin movimientos.</p>
              ) : null}
            </div>
          </section>

          <section className="card p-6">
            <h2 className="font-bold">Últimos pedidos</h2>
            <div className="mt-4 divide-y divide-white/6">
              {pedidos.map((o) => (
                <Link
                  key={o.id}
                  href={`/admin/pedidos/${o.id}`}
                  className="flex items-center gap-3 py-2.5 text-sm hover:text-white"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate">{o.product_name}</p>
                    <p className="truncate text-xs text-ink-400">
                      {o.code} · {formatNumber(o.quantity)} u. · {formatDateCl(o.created_at)}
                    </p>
                  </div>
                  <span className="font-semibold">{formatClp(o.amount_clp)}</span>
                  <span className="text-xs text-ink-400">{ORDER_STATUS_LABEL[o.status as OrderStatus]}</span>
                </Link>
              ))}
              {pedidos.length === 0 ? (
                <p className="py-6 text-center text-sm text-ink-400">Sin pedidos.</p>
              ) : null}
            </div>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
              Ajustar saldo
            </h2>
            <ActionForm action={ajustarSaldo} submitLabel="Aplicar ajuste" className="mt-4">
              <input type="hidden" name="user_id" value={user.id} />
              <label className="field-label" htmlFor="monto">Monto (negativo para descontar)</label>
              <input id="monto" name="monto" className="field" placeholder="10000 o -5000" />
              <label className="field-label mt-4" htmlFor="nota">Motivo</label>
              <input id="nota" name="nota" className="field" placeholder="Ej: bono de bienvenida" />
            </ActionForm>
          </section>

          <section className="card space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Cuenta</h2>

            <form action={cambiarEstadoMayorista} className="flex items-end gap-2">
              <input type="hidden" name="user_id" value={user.id} />
              <input type="hidden" name="accion" value="descuento" />
              <div className="flex-1">
                <label className="field-label" htmlFor="descuento">Descuento del cliente (%)</label>
                <input
                  id="descuento"
                  name="descuento"
                  type="number"
                  min={0}
                  max={90}
                  step={1}
                  defaultValue={user.discount_percent}
                  className="field"
                />
              </div>
              <button type="submit" className="btn btn-ghost text-sm">Guardar</button>
            </form>

            <form action={cambiarEstadoMayorista} className="space-y-2">
              <input type="hidden" name="user_id" value={user.id} />
              <input type="hidden" name="accion" value="nota" />
              <label className="field-label" htmlFor="nota-cliente">Nota interna</label>
              <textarea
                id="nota-cliente"
                name="nota"
                rows={3}
                defaultValue={user.admin_note ?? ""}
                className="field"
              />
              <button type="submit" className="btn btn-ghost w-full text-sm">Guardar nota</button>
            </form>

            <form action={cambiarEstadoMayorista}>
              <input type="hidden" name="user_id" value={user.id} />
              <input type="hidden" name="accion" value={user.status === "blocked" ? "activar" : "bloquear"} />
              <button type="submit" className="btn btn-ghost w-full text-sm">
                {user.status === "blocked" ? "Reactivar la cuenta" : "Suspender la cuenta"}
              </button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
