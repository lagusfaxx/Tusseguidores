import Link from "next/link";
import { all, get } from "@/lib/db";
import { StatusBadge } from "@/components/order-status";
import { formatClp, formatNumber } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";
import { syncOrders } from "@/app/admin/actions";
import { RetryStuckButton } from "@/components/retry-stuck";
import { ORDER_STATUS_LABEL } from "@/lib/orders";
import type { Order, OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 40;

export default async function AdminOrdersPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string; p?: string }>;
}) {
  const { estado, q, p } = await searchParams;
  const page = Math.max(1, Number(p) || 1);

  const where: string[] = [];
  const params: unknown[] = [];
  if (estado === "transferencias") {
    where.push(
      "payment_provider = 'transferencia' AND payment_status = 'pending' AND status NOT IN ('canceled','refunded')",
    );
  } else if (estado === "sin-enviar") {
    // Pagados que nunca salieron al proveedor: lo que hay que mirar primero.
    where.push(
      "payment_status = 'paid' AND provider_order_id IS NULL AND status NOT IN ('canceled','refunded')",
    );
  } else if (estado && estado !== "todos") {
    where.push("status = ?");
    params.push(estado);
  }
  if (q?.trim()) {
    where.push("(code LIKE ? OR email LIKE ? OR link LIKE ? OR product_name LIKE ?)");
    const like = `%${q.trim()}%`;
    params.push(like, like, like, like);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = get<{ n: number }>(`SELECT COUNT(*) AS n FROM orders ${clause}`, params)?.n ?? 0;
  const orders = all<Order>(
    `SELECT * FROM orders ${clause} ORDER BY id DESC LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const statuses = Object.keys(ORDER_STATUS_LABEL) as OrderStatus[];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Pedidos <span className="text-ink-400">({total})</span></h1>
        <div className="flex flex-wrap items-center gap-3">
          <RetryStuckButton />
          <form action={syncOrders}>
            <button type="submit" className="btn btn-ghost text-sm">Actualizar estados</button>
          </form>
        </div>
      </div>

      <form className="mt-6 flex flex-wrap gap-3">
        <input
          name="q"
          defaultValue={q ?? ""}
          className="field max-w-xs"
          placeholder="Buscar por código, correo o enlace"
        />
        <select name="estado" defaultValue={estado ?? "todos"} className="field max-w-[180px]">
          <option value="todos">Todos los estados</option>
          <option value="transferencias">Transferencias por confirmar</option>
          <option value="sin-enviar">Pagados sin enviar</option>
          {statuses.map((status) => (
            <option key={status} value={status}>{ORDER_STATUS_LABEL[status]}</option>
          ))}
        </select>
        <button type="submit" className="btn btn-ghost text-sm">Filtrar</button>
      </form>

      <div className="card mt-6 overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Código</th><th>Producto</th><th>Destino</th><th>Cantidad</th>
              <th>Total</th><th>Pago</th><th>Estado</th><th>Proveedor</th><th>Fecha</th>
            </tr>
          </thead>
          <tbody>
            {orders.map((order) => (
              <tr key={order.id}>
                <td>
                  <Link href={`/admin/pedidos/${order.id}`} className="font-mono text-brand-300 hover:text-white">
                    {order.code}
                  </Link>
                  <div className="text-[11px] text-ink-400">{order.email}</div>
                </td>
                <td className="max-w-[200px] truncate">{order.product_name}</td>
                <td className="max-w-[180px] truncate text-xs text-ink-400">{order.link}</td>
                <td>{formatNumber(order.quantity)}</td>
                <td className="font-semibold">{formatClp(order.amount_clp)}</td>
                <td className="text-xs">
                  {order.payment_provider === "transferencia" ? (
                    <span className="whitespace-nowrap">
                      Transferencia
                      {order.payment_status !== "paid" && order.transfer_notified_at ? (
                        <span className="ml-1 rounded bg-amber-500/20 px-1.5 py-0.5 text-[10px] text-amber-300">
                          avisó
                        </span>
                      ) : null}
                    </span>
                  ) : (
                    <span className="text-ink-400">Webpay</span>
                  )}
                </td>
                <td><StatusBadge status={order.status} /></td>
                <td className="text-xs text-ink-400">
                  {order.provider_order_id ? `#${order.provider_order_id}` : order.provider_error ? "Error" : "—"}
                </td>
                <td className="whitespace-nowrap text-xs text-ink-400">{formatDateCl(order.created_at)}</td>
              </tr>
            ))}
            {orders.length === 0 ? (
              <tr><td colSpan={9} className="py-10 text-center text-ink-400">No hay pedidos con ese filtro.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <div className="mt-6 flex justify-center gap-2">
          {Array.from({ length: pages }, (_, i) => i + 1).slice(0, 12).map((n) => (
            <Link
              key={n}
              href={`/admin/pedidos?p=${n}${estado ? `&estado=${estado}` : ""}${q ? `&q=${encodeURIComponent(q)}` : ""}`}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                n === page ? "bg-brand-500 text-white" : "bg-white/6 text-ink-200 hover:bg-white/10"
              }`}
            >
              {n}
            </Link>
          ))}
        </div>
      ) : null}
    </>
  );
}
