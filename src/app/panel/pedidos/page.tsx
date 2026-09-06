import Link from "next/link";
import { redirect } from "next/navigation";
import { panelUser } from "@/lib/reseller-auth";
import { pedidosDelCliente, contarPedidosDelCliente } from "@/lib/reseller-orders";
import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/orders";
import { formatClp, formatNumber } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const POR_PAGINA = 30;

export default async function PanelPedidosPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>;
}) {
  const user = await panelUser();
  if (!user) redirect("/panel/entrar");

  const { p } = await searchParams;
  const page = Math.max(1, Number(p) || 1);
  const total = contarPedidosDelCliente(user.id);
  const pedidos = pedidosDelCliente(user.id, POR_PAGINA, (page - 1) * POR_PAGINA);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="text-2xl font-bold">Mis pedidos <span className="text-ink-400">({total})</span></h1>
        <Link href="/panel/servicios" className="btn btn-primary text-sm">Nuevo pedido</Link>
      </div>

      <div className="card mt-6 divide-y divide-white/6">
        {pedidos.map((order) => (
          <Link
            key={order.id}
            href={`/panel/pedidos/${order.id}`}
            className="flex flex-wrap items-center gap-x-4 gap-y-2 p-4 transition-colors hover:bg-white/4"
          >
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-semibold">{order.product_name}</p>
              <p className="truncate text-xs text-ink-400">
                <span className="font-mono">{order.code}</span> · {formatNumber(order.quantity)} u. ·{" "}
                {order.link}
              </p>
            </div>
            <span className="text-xs text-ink-400">{formatDateCl(order.created_at)}</span>
            <span className="text-sm font-semibold">{formatClp(order.amount_clp)}</span>
            <span
              className={`rounded-full border px-2 py-0.5 text-[11px] font-semibold ${
                ORDER_STATUS_TONE[order.status as OrderStatus]
              }`}
            >
              {ORDER_STATUS_LABEL[order.status as OrderStatus]}
            </span>
          </Link>
        ))}
        {pedidos.length === 0 ? (
          <p className="p-10 text-center text-sm text-ink-400">Todavía no has hecho pedidos.</p>
        ) : null}
      </div>

      {paginas > 1 ? (
        <div className="mt-6 flex justify-center gap-2">
          {page > 1 ? (
            <Link href={`/panel/pedidos?p=${page - 1}`} className="rounded-lg bg-white/6 px-3 py-1.5 text-sm">
              ← Anterior
            </Link>
          ) : null}
          <span className="px-3 py-1.5 text-sm text-ink-400">Página {page} de {paginas}</span>
          {page < paginas ? (
            <Link href={`/panel/pedidos?p=${page + 1}`} className="rounded-lg bg-white/6 px-3 py-1.5 text-sm">
              Siguiente →
            </Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
