"use client";

import { useMemo, useState } from "react";
import { PanelSubmit, PanelFeedback } from "./panel-ui";
import { useActionState } from "react";
import { accionCrearPedido, type PanelState } from "@/app/panel/actions";

/**
 * Formulario de pedido del panel.
 *
 * Calcula el precio mientras el cliente escribe con **la misma fórmula que el
 * servidor** (tarifa por 1.000 ÷ 1.000 × cantidad, redondeado hacia arriba al
 * peso, con el cobro mínimo): lo que ve es lo que se le va a descontar. El
 * servidor lo vuelve a calcular igual y no confía en nada de esta pantalla,
 * pero si los dos números no coincidieran, el cliente sentiría —con razón— que
 * le cobraron distinto de lo que decía.
 */
export function PanelOrderForm({
  serviceId,
  serviceName,
  ratePer1000Clp,
  minQty,
  maxQty,
  minOrderClp,
  balanceClp,
  orderKind,
  linkSugerido,
}: {
  serviceId: number;
  serviceName: string;
  ratePer1000Clp: number;
  minQty: number;
  maxQty: number;
  minOrderClp: number;
  balanceClp: number;
  orderKind: string;
  linkSugerido: string;
}) {
  const esComentarios = orderKind === "custom_comments";
  const [cantidad, setCantidad] = useState<string>(String(minQty));
  const [comentarios, setComentarios] = useState("");
  const [state, formAction] = useActionState<PanelState, FormData>(accionCrearPedido, {});

  const lineas = useMemo(
    () => comentarios.split(/\r?\n/).map((l) => l.trim()).filter(Boolean).length,
    [comentarios],
  );
  const unidades = esComentarios ? lineas : Number(cantidad.replace(/[^\d]/g, "")) || 0;

  const precio = useMemo(() => {
    if (unidades <= 0) return 0;
    return Math.max(minOrderClp, Math.ceil((ratePer1000Clp / 1000) * unidades));
  }, [unidades, ratePer1000Clp, minOrderClp]);

  const fueraDeRango = unidades > 0 && (unidades < minQty || unidades > maxQty);
  const sinSaldo = precio > balanceClp;
  const clp = (v: number) => v.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

  return (
    <form action={formAction} className="card p-5 sm:p-6">
      <input type="hidden" name="service_id" value={serviceId} />

      <p className="text-xs uppercase tracking-wider text-ink-400">Servicio #{serviceId}</p>
      <h2 className="mt-1 font-bold leading-snug">{serviceName}</h2>

      <label className="field-label mt-5" htmlFor="link">
        {esComentarios ? "Enlace de la publicación" : "Enlace o usuario de destino"}
      </label>
      <input
        id="link"
        name="link"
        required
        className="field"
        placeholder={linkSugerido}
        autoComplete="off"
      />

      {esComentarios ? (
        <>
          <label className="field-label mt-4" htmlFor="comments">
            Comentarios, uno por línea
          </label>
          <textarea
            id="comments"
            name="comments"
            rows={6}
            className="field font-mono text-xs"
            value={comentarios}
            onChange={(e) => setComentarios(e.target.value)}
            placeholder={"Muy bueno\nMe encantó\n..."}
          />
          <p className="mt-1 text-xs text-ink-400">
            {lineas} comentario{lineas === 1 ? "" : "s"} · el servicio acepta entre{" "}
            {minQty.toLocaleString("es-CL")} y {maxQty.toLocaleString("es-CL")}.
          </p>
          {/* El servidor cuenta las líneas; este campo va solo para que el
              formulario tenga siempre una cantidad válida. */}
          <input type="hidden" name="quantity" value={lineas} />
        </>
      ) : (
        <>
          <label className="field-label mt-4" htmlFor="quantity">Cantidad</label>
          <input
            id="quantity"
            name="quantity"
            inputMode="numeric"
            required
            className="field"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
          />
          <p className="mt-1 text-xs text-ink-400">
            Entre {minQty.toLocaleString("es-CL")} y {maxQty.toLocaleString("es-CL")} unidades.
          </p>
        </>
      )}

      <div className="mt-5 rounded-xl border border-white/10 bg-white/4 p-4">
        <div className="flex items-end justify-between gap-3">
          <div>
            <p className="text-xs text-ink-400">Se descuenta de tu saldo</p>
            <p className="text-2xl font-extrabold tracking-tight">{clp(precio)}</p>
          </div>
          <div className="text-right text-xs text-ink-400">
            <p>Saldo: {clp(balanceClp)}</p>
            <p>Queda: {clp(Math.max(0, balanceClp - precio))}</p>
          </div>
        </div>
        {fueraDeRango ? (
          <p className="mt-3 text-xs text-amber-300">
            La cantidad tiene que estar entre {minQty.toLocaleString("es-CL")} y{" "}
            {maxQty.toLocaleString("es-CL")}.
          </p>
        ) : null}
        {sinSaldo && unidades > 0 ? (
          <p className="mt-3 text-xs text-amber-300">
            Te falta saldo para este pedido. Recarga y vuelve a intentarlo.
          </p>
        ) : null}
      </div>

      <div className="mt-5 space-y-3">
        {/* Bloqueado hasta que el pedido sea posible: mandarlo para que el
            servidor conteste que no se puede es hacerle perder el viaje. */}
        <PanelSubmit
          className="btn btn-primary w-full"
          pendiente="Enviando el pedido…"
          disabled={unidades <= 0 || fueraDeRango || sinSaldo}
        >
          {unidades <= 0
            ? esComentarios
              ? "Escribe los comentarios"
              : "Escribe la cantidad"
            : sinSaldo
              ? "Saldo insuficiente"
              : `Pedir por ${clp(precio)}`}
        </PanelSubmit>
        <PanelFeedback state={state} />
      </div>

      <p className="mt-3 text-xs leading-relaxed text-ink-400">
        El pedido sale al proveedor al instante. Revisa el enlace antes de enviarlo: una vez
        despachado no se puede cambiar el destino.
      </p>
    </form>
  );
}
