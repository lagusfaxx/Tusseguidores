import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { StatusBadge } from "@/components/order-status";
import {
  getOrderByCode, orderTargets, sincronizarPedido, ORDER_STATUS_LABEL,
} from "@/lib/orders";
import {
  pasosDelPedido, resumenDeEstado, avanceDelPedido, puedeCorregirDestino,
} from "@/lib/order-tracking";
import {
  ticketDelPedido, mensajesDeTicket, puedeEscribir, ETIQUETA_TICKET,
} from "@/lib/tickets";
import { devolucionDisponible, TEXTO_DEVOLUCIONES } from "@/lib/devoluciones";
import { transferenciaDisponible } from "@/lib/transfer";
import { reposicionDelPedido, reposicionYaPedida, textoDeGarantia } from "@/lib/refill";
import { formatClp, formatNumber } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";
import { getSettings } from "@/lib/settings";
import { Copiar } from "@/components/copiar";
import { datosTransferencia } from "@/lib/transfer";
import { TransferPanel } from "@/components/transfer-panel";
import {
  CorregirDestino, AbrirTicket, ResponderTicket, PedirReposicion, PedirDevolucion,
} from "@/components/order-tracking-ui";
import { AutoRefresh } from "@/components/auto-refresh";
import { pagarPedido } from "../actions";
import { get } from "@/lib/db";

export const metadata: Metadata = {
  title: "Estado de tu pedido",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

type Params = {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ estado?: string; aviso?: string; pago?: string }>;
};

const TONO: Record<string, string> = {
  hecho: "border-lime-400/50 bg-lime-400/15 text-lime-300",
  actual: "border-brand-400/60 bg-brand-500/20 text-brand-300",
  pendiente: "border-white/12 bg-white/5 text-ink-400",
  problema: "border-amber-400/50 bg-amber-400/15 text-amber-300",
};

export default async function OrderPage({ params, searchParams }: Params) {
  const { code } = await params;
  const { estado, aviso, pago } = await searchParams;
  let order = getOrderByCode(decodeURIComponent(code));
  if (!order) notFound();

  // El cron pasa cada diez minutos; quien abrió esta página quiere el número
  // de ahora. Se le pregunta al proveedor y, si algo cambió, se relee.
  if (await sincronizarPedido(order.id)) {
    order = getOrderByCode(order.code) ?? order;
  }

  const settings = getSettings();
  const pasos = pasosDelPedido(order);
  const resumen = resumenDeEstado(order);
  const avance = avanceDelPedido(order);
  const enCurso = order.payment_status === "paid" &&
    ["paid", "processing", "partial"].includes(order.status);
  // Un pedido tiene una sola conversación: todo lo que el cliente necesite
  // decir de este pedido va ahí.
  const ticket = ticketDelPedido(order.id);
  const mensajes = ticket ? mensajesDeTicket(ticket.id) : [];
  const permiso = ticket ? puedeEscribir(ticket.id) : { ok: true as const };
  const sinPagar = order.payment_status !== "paid" && order.status !== "refunded";
  const devolucion = devolucionDisponible(order);

  // La reposición se ofrece solo dentro del plazo del servicio con el que se
  // entregó: el día siguiente al vencimiento el formulario ya no está.
  const reposicion = reposicionDelPedido(order);
  const reposicionAbierta = reposicionYaPedida(order.id);
  const destinos = orderTargets(order.id);
  const producto = order.product_id
    ? get<{ link_label: string; image_url: string | null; slug: string }>(
        "SELECT link_label, image_url, slug FROM products WHERE id = ?",
        [order.product_id],
      )
    : undefined;

  return (
    <>
      <AutoRefresh activo={enCurso} />
      <SiteHeader />
      <main className="bg-halo">
        <div className="mx-auto max-w-6xl px-4 py-8 sm:py-12">
          {estado === "manual" || pago === "error" ? (
            <div className="mb-6 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
              No pudimos abrir el pago en línea en este momento. Tu pedido quedó guardado: inténtalo
              de nuevo en unos minutos{transferenciaDisponible() ? " o paga por transferencia" : ""}.
            </div>
          ) : null}

          <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
            {/* ================================================ columna principal */}
            <div className="space-y-5">
              {/* ------------------------------------------------ encabezado */}
              <div className="card overflow-hidden">
                <div className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 p-5 sm:p-6">
                  <div className="min-w-0">
                    <span className="text-xs uppercase tracking-wider text-ink-400">Pedido</span>
                    <h1 className="mt-0.5 flex items-center gap-2 font-mono text-2xl font-extrabold tracking-tight">
                      {order.code}
                      <Copiar valor={order.code} />
                    </h1>
                    <p className="mt-2 text-lg font-bold">{resumen.titulo}</p>
                    <p className="mt-0.5 text-sm text-ink-400">{resumen.detalle}</p>
                  </div>
                  <StatusBadge status={order.status} />
                </div>

                {/* ------------------------------------------------- los pasos */}
                <ol className="grid gap-px bg-white/6 sm:grid-cols-4">
                  {pasos.map((paso, i) => (
                    <li key={paso.id} className="bg-ink-950/40 p-4">
                      <div className="flex items-center gap-2">
                        <span
                          className={`grid h-6 w-6 shrink-0 place-items-center rounded-full border text-[11px] font-bold ${
                            TONO[paso.estado]
                          }`}
                        >
                          {paso.estado === "hecho" ? "✓" : paso.estado === "problema" ? "!" : i + 1}
                        </span>
                        <p
                          className={`text-sm font-semibold ${
                            paso.estado === "pendiente" ? "text-ink-400" : "text-white"
                          }`}
                        >
                          {paso.titulo}
                        </p>
                      </div>
                      <p className="mt-1.5 text-xs leading-relaxed text-ink-400">{paso.detalle}</p>
                      {paso.fecha ? (
                        <p className="mt-1 text-[11px] text-ink-600">{formatDateCl(paso.fecha)}</p>
                      ) : null}
                    </li>
                  ))}
                </ol>

                {order.payment_status === "paid" ? (
                  <div className="border-t border-white/8 p-5 sm:p-6">
                    {/* Lo que se sabe del avance es cuántas faltan: eso es lo
                        que se muestra. Sin ese dato no hay barra ni porcentaje,
                        porque cualquier número sería inventado. */}
                    {avance ? (
                      <>
                        <div className="flex items-end justify-between gap-3">
                          <div>
                            <p className="text-xs text-ink-400">
                              {avance.restante > 0 ? "Faltan por entregar" : "Entrega completa"}
                            </p>
                            <p className="text-2xl font-bold text-ink-100">
                              {formatNumber(avance.restante)}
                              <span className="ml-1 text-sm font-normal text-ink-400">
                                de {formatNumber(avance.cantidad)}
                              </span>
                            </p>
                          </div>
                          <span className="text-xs font-semibold text-ink-300">{avance.porcentaje}%</span>
                        </div>
                        <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/8">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-brand-500 to-accent-500 transition-[width]"
                            style={{ width: `${avance.porcentaje}%` }}
                          />
                        </div>
                      </>
                    ) : (
                      <p className="text-xs text-ink-400">
                        Tu pedido de {formatNumber(order.quantity)} ya está en marcha.
                        Aquí vas a ver cuántas faltan a medida que avanza.
                      </p>
                    )}
                    {enCurso ? (
                      <p className="mt-2 text-[11px] text-ink-600">
                        Esta página se actualiza sola mientras la tengas abierta.
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>

              {/* --------------------------------------------------- el pago */}
              {sinPagar ? (
                <section className="card p-5 sm:p-6">
                  <h2 className="font-bold">
                    {order.payment_provider === "transferencia" ? "Paga tu pedido" : "Tu pedido espera el pago"}
                  </h2>
                  <p className="mt-1 text-sm text-ink-400">
                    Puedes pagar o cambiar el medio de pago aquí mismo. Es el mismo pedido: no hace
                    falta volver a comprar.
                  </p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    <form action={pagarPedido}>
                      <input type="hidden" name="code" value={order.code} />
                      <input type="hidden" name="metodo" value="flow" />
                      <button type="submit" className="btn btn-primary text-sm">
                        Pagar {formatClp(order.amount_clp)} con Webpay
                      </button>
                    </form>
                    {transferenciaDisponible() && order.payment_provider !== "transferencia" ? (
                      <form action={pagarPedido}>
                        <input type="hidden" name="code" value={order.code} />
                        <input type="hidden" name="metodo" value="transferencia" />
                        <button type="submit" className="btn btn-ghost text-sm">
                          Prefiero transferir
                        </button>
                      </form>
                    ) : null}
                  </div>
                </section>
              ) : null}

              {order.payment_provider === "transferencia" && sinPagar ? (
                <TransferPanel order={order} datos={datosTransferencia()} aviso={aviso === "1"} />
              ) : null}

              {/* ------------------------------------------------- el pedido */}
              <section className="card p-5 sm:p-6">
                <div className="flex items-start gap-4">
                  {producto?.image_url ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img
                      src={producto.image_url}
                      alt=""
                      width={72}
                      height={72}
                      className="h-16 w-16 shrink-0 rounded-lg object-cover"
                    />
                  ) : null}
                  <div className="min-w-0 flex-1">
                    <h2 className="font-bold leading-snug">{order.product_name}</h2>
                    <p className="mt-1 text-sm text-ink-400">
                      {formatNumber(order.quantity)} unidades · {formatClp(order.amount_clp)}
                    </p>
                  </div>
                </div>

                <dl className="mt-5 grid gap-x-6 gap-y-3 border-t border-white/8 pt-5 text-sm sm:grid-cols-2">
                  <div className="sm:col-span-2">
                    <dt className="text-ink-400">
                      {destinos.length > 1 ? `Destinos (${destinos.length} publicaciones)` : "Destino"}
                    </dt>
                    {destinos.length > 1 ? (
                      <dd className="mt-1 space-y-1.5">
                        {destinos.map((destino) => (
                          <div
                            key={destino.id}
                            className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5 rounded-lg border border-white/8 bg-white/3 px-3 py-2"
                          >
                            <span className="min-w-0 flex-1 break-all font-mono text-xs text-ink-200">
                              {destino.link}
                            </span>
                            <span className="shrink-0 text-xs text-ink-400">
                              {formatNumber(destino.quantity)} ·{" "}
                              {destino.provider_order_id
                                ? ORDER_STATUS_LABEL[destino.status] ?? destino.status
                                : "en la fila"}
                            </span>
                          </div>
                        ))}
                      </dd>
                    ) : (
                      <dd className="mt-0.5 break-all font-mono text-xs text-ink-200">{order.link}</dd>
                    )}
                  </div>
                  <div>
                    <dt className="text-ink-400">Fecha</dt>
                    <dd>{formatDateCl(order.created_at)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-400">Reposición</dt>
                    <dd>{textoDeGarantia(reposicion)}</dd>
                  </div>
                  <div>
                    <dt className="text-ink-400">Última actualización</dt>
                    <dd>{formatDateCl(order.updated_at)}</dd>
                  </div>
                  {order.start_count != null ? (
                    <div>
                      <dt className="text-ink-400">Conteo al empezar</dt>
                      <dd>{formatNumber(order.start_count)}</dd>
                    </div>
                  ) : null}
                  {order.comments ? (
                    <div className="sm:col-span-2">
                      <dt className="text-ink-400">Tus comentarios ({order.comments.split("\n").length})</dt>
                      <dd className="mt-1 max-h-44 overflow-y-auto whitespace-pre-line rounded-lg border border-white/10 bg-white/4 p-3 text-xs leading-relaxed text-ink-200">
                        {order.comments}
                      </dd>
                    </div>
                  ) : null}
                </dl>

                {producto?.slug ? (
                  <Link
                    href={`/producto/${producto.slug}`}
                    className="mt-5 inline-block text-sm text-brand-300 hover:text-white"
                  >
                    Volver a pedir lo mismo →
                  </Link>
                ) : null}
              </section>

              {/* ------------------------------------- lo que puede hacer el cliente */}
              {puedeCorregirDestino(order) || (reposicion.disponible && !reposicionAbierta) || devolucion ? (
                <section className="card divide-y divide-white/8">
                  {puedeCorregirDestino(order) ? (
                    <Accion titulo={destinos.length > 1 ? "Corregir las publicaciones" : "Corregir el destino"}>
                      <CorregirDestino
                        code={order.code}
                        links={destinos.length ? destinos.map((d) => d.link) : [order.link]}
                        etiqueta={producto?.link_label ?? "Enlace o usuario"}
                      />
                    </Accion>
                  ) : null}
                  {reposicion.disponible && !reposicionAbierta ? (
                    <Accion titulo="Pedir reposición gratis">
                      <PedirReposicion
                        code={order.code}
                        vigencia={
                          reposicion.dePorVida
                            ? "Este pedido tiene reposición sin vencimiento"
                            : `Te quedan ${reposicion.diasRestantes} día${reposicion.diasRestantes === 1 ? "" : "s"} de garantía`
                        }
                      />
                    </Accion>
                  ) : null}
                  {devolucion ? (
                    <Accion titulo="Pedir la devolución (USDT o BTC)" abierto>
                      <PedirDevolucion code={order.code} />
                    </Accion>
                  ) : null}
                </section>
              ) : null}
            </div>

            {/* ================================================ soporte (ticket) */}
            <aside id="soporte" className="card p-5 sm:p-6 lg:sticky lg:top-24">
              <div className="flex items-center justify-between gap-2">
                <h2 className="font-bold">Soporte de este pedido</h2>
                {ticket ? (
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                      ticket.status === "cerrado"
                        ? "bg-white/8 text-ink-400"
                        : ticket.status === "respondido"
                          ? "bg-lime-500/15 text-lime-300"
                          : "bg-amber-500/15 text-amber-300"
                    }`}
                  >
                    {ETIQUETA_TICKET[ticket.status] ?? ticket.status}
                  </span>
                ) : null}
              </div>

              {ticket ? (
                <>
                  <p className="mt-1 text-xs text-ink-400">
                    Ticket <span className="font-mono">{ticket.code}</span> · toda la conversación de
                    este pedido va aquí.
                  </p>
                  <div className="mt-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1">
                    {mensajes.map((m) => (
                      <div
                        key={m.id}
                        className={`rounded-xl border p-3 ${
                          m.author !== "cliente"
                            ? "mr-6 border-brand-400/30 bg-brand-500/10"
                            : "ml-6 border-white/8 bg-white/3"
                        }`}
                      >
                        <p className="text-[11px] font-semibold text-ink-400">
                          {m.author === "admin"
                            ? `${settings.site_name} · soporte`
                            : m.author === "ia"
                              ? `${settings.site_name} · asistente`
                              : "Tú"} ·{" "}
                          {formatDateCl(m.created_at)}
                        </p>
                        <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-ink-200">
                          {m.body}
                        </p>
                      </div>
                    ))}
                  </div>
                  <ResponderTicket
                    code={order.code}
                    ticket={ticket.code}
                    bloqueado={permiso.ok ? null : permiso.error}
                  />
                </>
              ) : (
                <div className="mt-3">
                  <AbrirTicket code={order.code} />
                </div>
              )}
              {devolucion ? null : (
                <p className="mt-4 border-t border-white/8 pt-3 text-xs leading-relaxed text-ink-400">
                  {TEXTO_DEVOLUCIONES}
                </p>
              )}
            </aside>
          </div>

          <p className="mt-6 text-center text-sm text-ink-400">
            <Link href="/seguimiento" className="text-brand-300 hover:underline">
              Buscar otro pedido
            </Link>
          </p>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}

/** Una acción plegable: así la página no es una pared de formularios. */
function Accion({
  titulo,
  abierto,
  children,
}: {
  titulo: string;
  abierto?: boolean;
  children: React.ReactNode;
}) {
  return (
    <details open={abierto} className="group p-5 sm:px-6 [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold">
        {titulo}
        <span className="text-lg leading-none text-ink-400 transition-transform group-open:rotate-45">+</span>
      </summary>
      <div className="mt-4">{children}</div>
    </details>
  );
}
