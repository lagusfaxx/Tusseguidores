import { redirect } from "next/navigation";
import { panelUser } from "@/lib/reseller-auth";
import { movimientos, ETIQUETA_MOVIMIENTO } from "@/lib/wallet";
import { recargasDelCliente, ETIQUETA_RECARGA } from "@/lib/topups";
import { datosTransferencia, transferenciaDisponible } from "@/lib/transfer";
import { flowConfigured } from "@/lib/flow";
import { formatClp, resellerContext } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";
import { PanelForm, PanelSubmit } from "@/components/panel-ui";
import { accionRecargar, accionAvisarTransferencia } from "../actions";
import { Copiar } from "@/components/copiar";
import { CampoMonto } from "@/components/panel-monto";

export const dynamic = "force-dynamic";

export default async function PanelSaldoPage({
  searchParams,
}: {
  searchParams: Promise<{ recarga?: string; aviso?: string; pagada?: string }>;
}) {
  const user = await panelUser();
  if (!user) redirect("/panel/entrar");

  const { recarga, aviso, pagada } = await searchParams;
  const ctx = resellerContext();
  const historial = movimientos(user.id, 30);
  const recargas = recargasDelCliente(user.id, 10);
  const pendiente = recarga ? recargas.find((r) => r.code === recarga) : undefined;
  const datos = datosTransferencia();
  const montos = [ctx.minTopupClp, ctx.minTopupClp * 3, ctx.minTopupClp * 5, ctx.minTopupClp * 10];

  // Formas de pago realmente disponibles según lo que esté configurado.
  const formas = [
    flowConfigured() ? { valor: "flow", etiqueta: "Webpay / tarjeta (al instante)" } : null,
    transferenciaDisponible() ? { valor: "transferencia", etiqueta: "Transferencia bancaria" } : null,
  ].filter((f): f is { valor: string; etiqueta: string } => f !== null);

  return (
    <>
      <h1 className="text-2xl font-bold">Saldo</h1>
      <p className="mt-1 text-sm text-ink-400">
        Tu saldo se descuenta con cada pedido. Recarga mínima: {formatClp(ctx.minTopupClp)}.
      </p>

      {pagada ? (
        <p className="mt-4 rounded-lg border border-lime-500/30 bg-lime-500/10 px-4 py-2.5 text-sm text-lime-200">
          Recarga acreditada. Ya puedes mandar pedidos.
        </p>
      ) : null}
      {aviso ? (
        <p className="mt-4 rounded-lg border border-lime-500/30 bg-lime-500/10 px-4 py-2.5 text-sm text-lime-200">
          Gracias, avisamos al equipo. Revisamos la transferencia y acreditamos el saldo.
        </p>
      ) : null}

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.1fr] lg:items-start [&>*]:min-w-0">
        <div className="space-y-6">
          <div className="card p-6">
            <p className="text-xs uppercase tracking-wider text-ink-400">Saldo disponible</p>
            <p className="mt-1 text-4xl font-extrabold tracking-tight text-lime-400">
              {formatClp(user.balance_clp)}
            </p>
          </div>

          <div className="card p-6">
            <h2 className="font-bold">Recargar</h2>
            {formas.length === 0 ? (
              <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2.5 text-sm text-amber-100">
                No hay ninguna forma de pago configurada todavía. Escríbenos y cargamos tu saldo a
                mano.
              </p>
            ) : (
            <PanelForm
              action={accionRecargar}
              submitLabel="Continuar"
              pendiente="Abriendo el pago…"
              className="mt-4"
            >
              <CampoMonto minimo={ctx.minTopupClp} atajos={montos} />

              <label className="field-label mt-4" htmlFor="metodo">Forma de pago</label>
              {/* Con una sola forma disponible el desplegable sobra: se muestra
                  cuál es y se manda en un campo oculto. Un select con una sola
                  opción —o peor, con ninguna— se ve como un error. */}
              {formas.length > 1 ? (
                <select id="metodo" name="metodo" className="field" defaultValue={formas[0].valor}>
                  {formas.map((f) => (
                    <option key={f.valor} value={f.valor}>{f.etiqueta}</option>
                  ))}
                </select>
              ) : (
                <>
                  <input type="hidden" name="metodo" value={formas[0].valor} />
                  <p className="field bg-white/3">{formas[0].etiqueta}</p>
                </>
              )}
              <p className="mt-1 text-xs text-ink-400">
                {flowConfigured()
                  ? "Con Webpay el saldo se acredita solo apenas se confirma el pago. "
                  : ""}
                {transferenciaDisponible()
                  ? "Por transferencia lo acreditamos al revisar la cuenta."
                  : ""}
              </p>
            </PanelForm>
            )}
          </div>

          {pendiente && pendiente.method === "transferencia" && pendiente.status === "pending" ? (
            <div className="card p-6">
              <h2 className="font-bold">Transfiere {formatClp(pendiente.amount_clp)}</h2>
              <p className="mt-1.5 text-sm text-ink-400">
                Pon <strong className="font-mono text-white">{pendiente.code}</strong> como mensaje
                para que podamos identificarla.
              </p>
              <dl className="mt-4 space-y-2 text-sm">
                {[
                  ["Banco", datos.banco],
                  ["Tipo de cuenta", datos.tipoCuenta],
                  ["Número", datos.numero],
                  ["Titular", datos.titular],
                  ["RUT", datos.rut],
                  ["Correo", datos.email],
                  ["Mensaje", pendiente.code],
                ]
                  .filter(([, valor]) => valor)
                  .map(([etiqueta, valor]) => (
                    <div key={etiqueta} className="flex items-center justify-between gap-3 border-b border-white/6 pb-2 last:border-0">
                      <dt className="text-xs text-ink-400">{etiqueta}</dt>
                      <dd className="flex items-center gap-2">
                        <span className="select-all text-right font-mono text-sm">{valor}</span>
                        <Copiar valor={String(valor)} />
                      </dd>
                    </div>
                  ))}
              </dl>
              {datos.instrucciones ? (
                <p className="mt-3 text-xs leading-relaxed text-ink-400">{datos.instrucciones}</p>
              ) : null}

              <form action={accionAvisarTransferencia} className="mt-5">
                <input type="hidden" name="topup_id" value={pendiente.id} />
                <label className="field-label" htmlFor="referencia">
                  Número de comprobante (opcional)
                </label>
                <input id="referencia" name="referencia" className="field" />
                <div className="mt-3">
                  <PanelSubmit className="btn btn-primary w-full text-sm" pendiente="Avisando…">
                    Ya transferí
                  </PanelSubmit>
                </div>
              </form>
            </div>
          ) : null}
        </div>

        <div className="space-y-6">
          {recargas.length ? (
            <section>
              <h2 className="font-bold">Recargas</h2>
              <div className="card mt-3 divide-y divide-white/6">
                {recargas.map((r) => (
                  <div key={r.id} className="flex flex-wrap items-center gap-x-3 gap-y-2 p-3.5 text-sm">
                    <div className="min-w-0 flex-1">
                      <p className="font-mono text-xs text-ink-400">{r.code}</p>
                      <p className="text-xs text-ink-400">
                        {r.method === "flow" ? "Webpay" : "Transferencia"} · {formatDateCl(r.created_at)}
                      </p>
                    </div>
                    <span className="font-semibold">{formatClp(r.amount_clp)}</span>
                    <span
                      className={`rounded-full px-2 py-0.5 text-[11px] font-semibold ${
                        r.status === "paid"
                          ? "bg-lime-500/15 text-lime-300"
                          : r.status === "rejected"
                            ? "bg-red-500/15 text-red-300"
                            : "bg-amber-500/15 text-amber-300"
                      }`}
                    >
                      {ETIQUETA_RECARGA[r.status] ?? r.status}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          ) : null}

          <section>
            <h2 className="font-bold">Movimientos</h2>
            <div className="card mt-3 divide-y divide-white/6">
              {historial.map((m) => (
                <div key={m.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3.5">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm">{ETIQUETA_MOVIMIENTO[m.kind] ?? m.kind}</p>
                    <p className="truncate text-xs text-ink-400">
                      {m.note || "—"} · {formatDateCl(m.created_at)}
                    </p>
                  </div>
                  <div className="text-right">
                    <p
                      className={`text-sm font-semibold ${
                        m.amount_clp >= 0 ? "text-lime-400" : "text-ink-200"
                      }`}
                    >
                      {m.amount_clp >= 0 ? "+" : "−"}
                      {formatClp(Math.abs(m.amount_clp))}
                    </p>
                    <p className="text-[11px] text-ink-400">saldo {formatClp(m.balance_after)}</p>
                  </div>
                </div>
              ))}
              {historial.length === 0 ? (
                <p className="p-8 text-center text-sm text-ink-400">Sin movimientos todavía.</p>
              ) : null}
            </div>
          </section>
        </div>
      </div>
    </>
  );
}
