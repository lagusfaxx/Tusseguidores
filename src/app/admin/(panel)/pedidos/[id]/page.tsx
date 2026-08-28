import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/order-status";
import { getOrderById, getOrderEvents, ORDER_STATUS_LABEL } from "@/lib/orders";
import { orderAction } from "@/app/admin/actions";
import { formatClp, formatNumber, pricingContext } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";
import { get } from "@/lib/db";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const order = getOrderById(Number(id));
  if (!order) notFound();

  const events = getOrderEvents(order.id);
  const ctx = pricingContext();
  const service = get<{ clean_name: string; rate_usd_per_1000: number; provider_enabled: number }>(
    "SELECT clean_name, rate_usd_per_1000, provider_enabled FROM provider_services WHERE service_id = ?",
    [order.provider_service_id],
  );
  const costClp = order.cost_usd * ctx.usdClp;
  const profit = order.amount_clp - costClp;

  return (
    <>
      <Link href="/admin/pedidos" className="text-sm text-ink-400 hover:text-white">← Volver a pedidos</Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-mono text-2xl font-bold">{order.code}</h1>
        <StatusBadge status={order.status} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-bold">{order.product_name}</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-400">Cantidad</dt><dd>{formatNumber(order.quantity)}</dd></div>
              <div><dt className="text-ink-400">Servicio del proveedor</dt><dd>#{order.provider_service_id}</dd></div>
              <div className="sm:col-span-2">
                <dt className="text-ink-400">Destino</dt>
                <dd className="break-all font-mono text-xs">
                  <a href={order.link} target="_blank" rel="noopener noreferrer" className="text-brand-300 hover:underline">
                    {order.link}
                  </a>
                </dd>
              </div>
              <div><dt className="text-ink-400">Cliente</dt><dd>{order.email}</dd></div>
              <div><dt className="text-ink-400">Teléfono</dt><dd>{order.phone || "—"}</dd></div>
              <div><dt className="text-ink-400">Creado</dt><dd>{formatDateCl(order.created_at)}</dd></div>
              <div><dt className="text-ink-400">Pagado</dt><dd>{formatDateCl(order.paid_at)}</dd></div>
              {service ? (
                <div className="sm:col-span-2">
                  <dt className="text-ink-400">Servicio</dt>
                  <dd className="text-xs">
                    {service.clean_name}
                    {service.provider_enabled === 0 ? (
                      <span className="ml-2 rounded bg-red-500/15 px-1.5 py-0.5 text-red-300">desactivado</span>
                    ) : null}
                  </dd>
                </div>
              ) : null}
              {order.provider_error ? (
                <div className="sm:col-span-2">
                  <dt className="text-ink-400">Error del proveedor</dt>
                  <dd className="text-red-300">{order.provider_error}</dd>
                </div>
              ) : null}
            </dl>
          </section>

          <section className="card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Historial</h2>
            <ol className="mt-4 space-y-3">
              {events.map((event) => (
                <li key={event.id} className="flex gap-3 text-sm">
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-400" />
                  <div>
                    <p className="text-ink-200">{event.message}</p>
                    <p className="text-xs text-ink-400">{formatDateCl(event.created_at)} · {event.type}</p>
                  </div>
                </li>
              ))}
            </ol>
          </section>
        </div>

        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Dinero</h2>
            <dl className="mt-4 space-y-2 text-sm">
              <div className="flex justify-between"><dt className="text-ink-400">Cobrado</dt><dd className="font-semibold">{formatClp(order.amount_clp)}</dd></div>
              {order.discount_clp > 0 ? (
                <div className="flex justify-between">
                  <dt className="text-ink-400">Descuento ({order.coupon_code})</dt>
                  <dd>−{formatClp(order.discount_clp)}</dd>
                </div>
              ) : null}
              <div className="flex justify-between"><dt className="text-ink-400">Costo proveedor</dt><dd>{formatClp(costClp)} <span className="text-xs text-ink-400">(US${order.cost_usd.toFixed(4)})</span></dd></div>
              <div className="flex justify-between border-t border-white/8 pt-2">
                <dt className="font-semibold">Margen</dt>
                <dd className={`font-bold ${profit >= 0 ? "text-lime-400" : "text-red-300"}`}>{formatClp(profit)}</dd>
              </div>
              <div className="flex justify-between"><dt className="text-ink-400">Pago</dt><dd>{order.payment_status} · {order.payment_ref ?? "—"}</dd></div>
            </dl>
          </section>

          <section className="card space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Acciones</h2>

            {order.payment_status !== "paid" ? (
              <form action={orderAction}>
                <input type="hidden" name="order_id" value={order.id} />
                <input type="hidden" name="action" value="mark_paid" />
                <button type="submit" className="btn btn-primary w-full text-sm">
                  Marcar como pagado y enviar
                </button>
              </form>
            ) : null}

            {order.payment_status === "paid" && !order.provider_order_id ? (
              <form action={orderAction}>
                <input type="hidden" name="order_id" value={order.id} />
                <input type="hidden" name="action" value="send" />
                <button type="submit" className="btn btn-primary w-full text-sm">
                  Enviar al proveedor
                </button>
              </form>
            ) : null}

            {order.provider_order_id ? (
              <div className="grid grid-cols-2 gap-2">
                <form action={orderAction}>
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="action" value="refill" />
                  <button type="submit" className="btn btn-ghost w-full text-sm">Pedir reposición</button>
                </form>
                <form action={orderAction}>
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="action" value="cancel" />
                  <button type="submit" className="btn btn-ghost w-full text-sm">Cancelar</button>
                </form>
              </div>
            ) : null}

            <form action={orderAction} className="space-y-2">
              <input type="hidden" name="order_id" value={order.id} />
              <input type="hidden" name="action" value="status" />
              <label className="field-label">Cambiar estado a mano</label>
              <select name="status" defaultValue={order.status} className="field">
                {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((status) => (
                  <option key={status} value={status}>{ORDER_STATUS_LABEL[status]}</option>
                ))}
              </select>
              <button type="submit" className="btn btn-ghost w-full text-sm">Aplicar</button>
            </form>

            <form action={orderAction} className="space-y-2">
              <input type="hidden" name="order_id" value={order.id} />
              <input type="hidden" name="action" value="note" />
              <label className="field-label">Nota interna</label>
              <textarea name="admin_note" rows={3} defaultValue={order.admin_note ?? ""} className="field" />
              <button type="submit" className="btn btn-ghost w-full text-sm">Guardar nota</button>
            </form>
          </section>
        </div>
      </div>
    </>
  );
}
