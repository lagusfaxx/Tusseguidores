import Link from "next/link";
import { redirect } from "next/navigation";
import { panelUser } from "@/lib/reseller-auth";
import { estadisticasCliente, pedidosDelCliente } from "@/lib/reseller-orders";
import { movimientos } from "@/lib/wallet";
import { ticketsDelCliente } from "@/lib/tickets";
import { formatClp, formatNumber, resellerContext } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/orders";
import { ETIQUETA_MOVIMIENTO } from "@/lib/wallet";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function PanelHome() {
  const user = await panelUser();
  if (!user) redirect("/panel/entrar");

  const stats = estadisticasCliente(user.id);
  const ultimos = pedidosDelCliente(user.id, 6);
  const ultimosMovimientos = movimientos(user.id, 6);
  const tickets = ticketsDelCliente(user.id, 3).filter((t) => t.status !== "cerrado");
  const ctx = resellerContext();

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Hola{user.name ? `, ${user.name}` : ""}</h1>
          {user.discount_percent > 0 ? (
            <p className="mt-1 text-sm text-ink-400">
              Tienes un {user.discount_percent}% de descuento sobre el precio mayorista.
            </p>
          ) : null}
        </div>
        <div className="flex w-full gap-2 sm:w-auto">
          <Link href="/panel/servicios" className="btn btn-primary flex-1 text-sm sm:flex-none">
            Hacer un pedido
          </Link>
          <Link href="/panel/saldo" className="btn btn-ghost flex-1 text-sm sm:flex-none">
            Recargar
          </Link>
        </div>
      </div>

      {/* Dos columnas ya en teléfono: cuatro tarjetas apiladas eran una
          pantalla entera de números antes de llegar a los pedidos. */}
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-4">
        {[
          ["Saldo disponible", formatClp(user.balance_clp), "text-lime-400"],
          ["Pedidos", formatNumber(stats.pedidos), ""],
          ["En curso", formatNumber(stats.enCurso), ""],
          ["Gastado", formatClp(stats.gastado), ""],
        ].map(([etiqueta, valor, tono]) => (
          <div key={etiqueta} className="card p-3.5 sm:p-4">
            <p className="text-[11px] uppercase tracking-wider text-ink-400 sm:text-xs">{etiqueta}</p>
            <p className={`mt-1 text-lg font-extrabold tracking-tight sm:text-xl ${tono}`}>{valor}</p>
          </div>
        ))}
      </div>

      {user.balance_clp <= 0 ? (
        <p className="mt-6 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-100">
          No tienes saldo. Recarga desde {formatClp(ctx.minTopupClp)} para empezar a pedir.{" "}
          <Link href="/panel/saldo" className="font-semibold underline">Recargar</Link>
        </p>
      ) : null}

      {tickets.length ? (
        <div className="mt-6 rounded-xl border border-white/10 bg-white/4 px-4 py-3 text-sm">
          <p className="font-semibold">Tickets abiertos</p>
          <ul className="mt-2 space-y-1">
            {tickets.map((t) => (
              <li key={t.id}>
                <Link href={`/panel/tickets/${t.code}`} className="text-brand-300 hover:text-white">
                  {t.code} · {t.subject}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="mt-8 grid gap-6 lg:grid-cols-[1.3fr_1fr] [&>*]:min-w-0">
        <section className="min-w-0">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-bold">Últimos pedidos</h2>
            <Link href="/panel/pedidos" className="text-sm text-brand-300 hover:text-white">Ver todos →</Link>
          </div>
          <div className="card mt-3 divide-y divide-white/6">
            {ultimos.map((order) => (
              <Link
                key={order.id}
                href={`/panel/pedidos/${order.id}`}
                className="flex flex-wrap items-center gap-x-3 gap-y-1.5 p-3.5 transition-colors hover:bg-white/4"
              >
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{order.product_name}</p>
                  <p className="truncate text-xs text-ink-400">
                    {order.code} · {formatNumber(order.quantity)} u. · {formatDateCl(order.created_at)}
                  </p>
                </div>
                <span className="shrink-0 text-sm font-semibold">{formatClp(order.amount_clp)}</span>
                <span
                  className={`shrink-0 rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                    ORDER_STATUS_TONE[order.status as OrderStatus]
                  }`}
                >
                  {ORDER_STATUS_LABEL[order.status as OrderStatus]}
                </span>
              </Link>
            ))}
            {ultimos.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-400">
                Sin pedidos.{" "}
                <Link href="/panel/servicios" className="text-brand-300">Ver el catálogo</Link>
              </p>
            ) : null}
          </div>
        </section>

        <section className="min-w-0">
          <div className="flex items-end justify-between gap-4">
            <h2 className="font-bold">Movimientos</h2>
            <Link href="/panel/saldo" className="text-sm text-brand-300 hover:text-white">Ver saldo →</Link>
          </div>
          <div className="card mt-3 divide-y divide-white/6">
            {ultimosMovimientos.map((m) => (
              <div key={m.id} className="flex items-center gap-3 p-3.5">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm">{ETIQUETA_MOVIMIENTO[m.kind] ?? m.kind}</p>
                  <p className="truncate text-xs text-ink-400">{m.note || formatDateCl(m.created_at)}</p>
                </div>
                <span
                  className={`shrink-0 text-sm font-semibold ${
                    m.amount_clp >= 0 ? "text-lime-400" : "text-ink-200"
                  }`}
                >
                  {m.amount_clp >= 0 ? "+" : "−"}
                  {formatClp(Math.abs(m.amount_clp))}
                </span>
              </div>
            ))}
            {ultimosMovimientos.length === 0 ? (
              <p className="p-6 text-center text-sm text-ink-400">Sin movimientos.</p>
            ) : null}
          </div>
        </section>
      </div>
    </>
  );
}
