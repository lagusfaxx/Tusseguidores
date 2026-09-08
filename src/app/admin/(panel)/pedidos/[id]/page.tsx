import Link from "next/link";
import { notFound } from "next/navigation";
import { StatusBadge } from "@/components/order-status";
import { getOrderById, getOrderEvents, orderTargets, ORDER_STATUS_LABEL } from "@/lib/orders";
import { orderAction, reembolsarPedido, editarDestino } from "@/app/admin/actions";
import { formatClp, formatNumber, pricingContext } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";
import { get } from "@/lib/db";
import { yaReembolsado } from "@/lib/reseller-orders";
import type { OrderStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminOrderDetail({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ error?: string }>;
}) {
  const { id } = await params;
  const { error } = await searchParams;
  const order = getOrderById(Number(id));
  if (!order) notFound();

  const events = getOrderEvents(order.id);
  // Los pedidos viejos no tienen fila de destinos: se muestra el suyo igual.
  const guardados = orderTargets(order.id);
  const destinos = guardados.length
    ? guardados
    : [{
        id: 0, link: order.link, quantity: order.quantity,
        provider_order_id: order.provider_order_id, provider_status: order.provider_status,
        provider_error: order.provider_error, status: order.status,
      }];
  const ctx = pricingContext();
  const service = get<{ clean_name: string; rate_usd_per_1000: number; provider_enabled: number }>(
    "SELECT clean_name, rate_usd_per_1000, provider_enabled FROM provider_services WHERE service_id = ?",
    [order.provider_service_id],
  );
  // Si el enrutado automático cambió de servicio, mostramos ambos.
  const reference =
    order.reference_service_id && order.reference_service_id !== order.provider_service_id
      ? get<{ clean_name: string }>(
          "SELECT clean_name FROM provider_services WHERE service_id = ?",
          [order.reference_service_id],
        )
      : null;
  // Plata cobrada que no se está entregando: ni salió al proveedor ni lo
  // despachaste tú.
  const pendienteDeEnvio =
    order.payment_status === "paid" &&
    !order.provider_order_id &&
    !order.manual_dispatch_at &&
    !["canceled", "refunded"].includes(order.status);

  const costClp = order.cost_usd * ctx.usdClp;
  const profit = order.amount_clp - costClp;

  return (
    <>
      <Link href="/admin/pedidos" className="text-sm text-ink-400 hover:text-white">← Volver a pedidos</Link>

      <div className="mt-4 flex flex-wrap items-center justify-between gap-4">
        <h1 className="font-mono text-2xl font-bold">{order.code}</h1>
        <StatusBadge status={order.status} />
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      {pendienteDeEnvio ? (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100">
          Pagado y todavía sin enviar al proveedor. Mándalo con «Enviar al proveedor», o si ya lo
          despachaste por fuera, regístralo con «Marcar como enviado a mano» para que deje de contar
          como pendiente.
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section className="card p-6">
            <h2 className="font-bold">{order.product_name}</h2>
            <dl className="mt-4 grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <div><dt className="text-ink-400">Cantidad</dt><dd>{formatNumber(order.quantity)}</dd></div>
              <div>
                <dt className="text-ink-400">Servicio del proveedor</dt>
                <dd>
                  #{order.provider_service_id}
                  {reference ? (
                    <span className="ml-2 rounded bg-brand-500/20 px-1.5 py-0.5 text-[11px] text-brand-300">
                      enrutado desde #{order.reference_service_id}
                    </span>
                  ) : null}
                </dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-ink-400">
                  {destinos.length > 1
                    ? `Destinos · ${destinos.length} publicaciones, ${formatNumber(destinos[0].quantity)} en cada una`
                    : "Destino"}
                </dt>
                {/* Un pedido repartido son varios pedidos del proveedor: cada
                    fila muestra el suyo, con su estado y su error si lo tuvo. */}
                <dd className="space-y-1.5">
                  {destinos.map((destino) => (
                    <div key={destino.id} className="break-all font-mono text-xs">
                      <a
                        href={destino.link}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-brand-300 hover:underline"
                      >
                        {destino.link}
                      </a>
                      {destinos.length > 1 || destino.provider_order_id ? (
                        <span className="ml-2 font-sans text-[11px] text-ink-400">
                          {destino.provider_order_id
                            ? `proveedor #${destino.provider_order_id} · ${destino.provider_status ?? destino.status}`
                            : destino.provider_error
                              ? `sin enviar · ${destino.provider_error}`
                              : "sin enviar"}
                        </span>
                      ) : null}
                    </div>
                  ))}
                </dd>
                {/* Corregir el enlace mal pegado sin cancelar el pedido: solo
                    mientras no haya salido. */}
                {!order.provider_order_id && !order.manual_dispatch_at ? (
                  <form action={editarDestino} className="mt-2 flex flex-wrap gap-2">
                    <input type="hidden" name="order_id" value={order.id} />
                    {destinos.length > 1 ? (
                      <textarea
                        name="link"
                        rows={Math.min(8, destinos.length + 1)}
                        defaultValue={destinos.map((d) => d.link).join("\n")}
                        className="field min-w-0 flex-1 font-mono text-xs"
                      />
                    ) : (
                      <input
                        name="link"
                        defaultValue={destinos[0]?.link ?? order.link}
                        className="field min-w-0 flex-1 font-mono text-xs"
                      />
                    )}
                    <button type="submit" className="btn btn-ghost text-xs">Corregir</button>
                  </form>
                ) : null}
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
              {order.comments ? (
                <div className="sm:col-span-2">
                  <dt className="text-ink-400">
                    Comentarios del cliente ({order.comments.split("\n").length})
                  </dt>
                  <dd className="mt-1 max-h-52 overflow-y-auto whitespace-pre-line rounded-lg border border-white/10 bg-white/4 p-3 text-xs leading-relaxed">
                    {order.comments}
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
              <div className="flex justify-between">
                <dt className="text-ink-400">Envío</dt>
                <dd>
                  {order.provider_order_id
                    ? `Proveedor #${order.provider_order_id}`
                    : order.manual_dispatch_at
                      ? `A mano · ${formatDateCl(order.manual_dispatch_at)}`
                      : "Sin enviar"}
                </dd>
              </div>
            </dl>
          </section>

          <section className="card space-y-4 p-6">
            <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Acciones</h2>

            {order.payment_status !== "paid" ? (
              <form action={orderAction} className="space-y-2">
                <input type="hidden" name="order_id" value={order.id} />
                <input type="hidden" name="action" value="mark_paid" />
                {order.payment_provider === "transferencia" ? (
                  <>
                    <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-amber-100">
                      {order.transfer_notified_at
                        ? `El cliente avisó que transfirió el ${formatDateCl(order.transfer_notified_at)}${
                            order.transfer_reference ? ` (comprobante ${order.transfer_reference})` : ""
                          }.`
                        : "El cliente todavía no avisa que transfirió."}{" "}
                      Revisa tu cuenta antes de confirmar: al hacerlo el pedido sale al proveedor y
                      se gasta tu saldo.
                    </p>
                    <input
                      name="admin_note"
                      className="field text-xs"
                      placeholder="Referencia de la transferencia (opcional)"
                    />
                  </>
                ) : null}
                <button type="submit" className="btn btn-primary w-full text-sm">
                  {order.payment_provider === "transferencia"
                    ? "Confirmar transferencia y enviar"
                    : "Marcar como pagado y enviar"}
                </button>
              </form>
            ) : null}

            {order.payment_status === "paid" && !order.provider_order_id && !order.manual_dispatch_at ? (
              <>
                <form action={orderAction}>
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="action" value="send" />
                  <button type="submit" className="btn btn-primary w-full text-sm">
                    Enviar al proveedor
                  </button>
                </form>

                {/* Para los pedidos que le pasaste al proveedor por fuera: sin
                    esto quedaban para siempre en "pagados sin enviar". */}
                <form action={orderAction} className="space-y-2">
                  <input type="hidden" name="order_id" value={order.id} />
                  <input type="hidden" name="action" value="sent_manual" />
                  <input
                    name="admin_note"
                    className="field text-xs"
                    placeholder="Referencia del envío manual (opcional)"
                  />
                  <button type="submit" className="btn btn-ghost w-full text-sm">
                    Marcar como enviado a mano
                  </button>
                </form>
              </>
            ) : null}

            {order.manual_dispatch_at && !order.provider_order_id ? (
              <p className="rounded-lg border border-white/10 bg-white/4 px-3 py-2 text-xs leading-relaxed text-ink-200">
                Lo marcaste como enviado a mano el {formatDateCl(order.manual_dispatch_at)}. Ya no se
                cuenta como pendiente y el reintento automático lo deja tranquilo; el estado final lo
                pones tú abajo.
              </p>
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
              <p className="text-[11px] leading-relaxed text-ink-400">
                Poner «Pagado», «En proceso», «Entrega parcial» o «Completado» también da el pago por
                recibido. Con «Pagado» el pedido sale al proveedor al aplicar; con los otros tres, si
                nunca salió del panel, queda registrado como enviado a mano.
              </p>
              <select name="status" defaultValue={order.status} className="field">
                {(Object.keys(ORDER_STATUS_LABEL) as OrderStatus[]).map((status) => (
                  <option key={status} value={status}>{ORDER_STATUS_LABEL[status]}</option>
                ))}
              </select>
              <button type="submit" className="btn btn-ghost w-full text-sm">Aplicar</button>
            </form>

            {order.reseller_user_id ? (
              <div className="rounded-lg border border-white/10 bg-white/4 p-3">
                <p className="text-xs text-ink-400">Pedido del panel mayorista</p>
                <Link
                  href={`/admin/mayoristas/${order.reseller_user_id}`}
                  className="mt-1 block text-sm text-brand-300 hover:text-white"
                >
                  Ver la cuenta del cliente →
                </Link>
                {yaReembolsado(order.id) ? (
                  <p className="mt-2 text-xs text-ink-400">Ya se le devolvió el saldo.</p>
                ) : (
                  <form action={reembolsarPedido} className="mt-3 space-y-2">
                    <input type="hidden" name="order_id" value={order.id} />
                    <input
                      name="motivo"
                      className="field text-xs"
                      placeholder="Motivo (queda en su historial)"
                    />
                    <button type="submit" className="btn btn-ghost w-full text-sm">
                      Devolver {formatClp(order.amount_clp)} a su saldo
                    </button>
                  </form>
                )}
              </div>
            ) : null}

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
