import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { formatClp } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";
import { run } from "@/lib/db";
import { getOrderByCode, logEvent } from "@/lib/orders";
import type { DatosTransferencia } from "@/lib/transfer";
import type { Order } from "@/lib/types";

/** El cliente avisa que ya transfirió. Solo marca; no confirma nada. */
async function avisarTransferencia(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "");
  const referencia = String(formData.get("referencia") ?? "").trim().slice(0, 120);
  const order = getOrderByCode(code);
  if (!order || order.payment_provider !== "transferencia" || order.payment_status === "paid") {
    redirect(`/pedido/${encodeURIComponent(code)}`);
  }

  run(
    `UPDATE orders SET transfer_notified_at = datetime('now'), transfer_reference = ?,
            updated_at = datetime('now')
      WHERE id = ?`,
    [referencia || null, order.id],
  );
  logEvent(
    order.id,
    "info",
    `El cliente avisó que transfirió${referencia ? ` (comprobante ${referencia})` : ""}.`,
  );
  revalidatePath(`/pedido/${order.code}`);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  redirect(`/pedido/${order.code}?aviso=1`);
}

function Dato({ etiqueta, valor }: { etiqueta: string; valor: string }) {
  if (!valor) return null;
  return (
    <div className="flex items-baseline justify-between gap-4 border-b border-white/8 py-2.5 last:border-0">
      <dt className="shrink-0 text-xs text-ink-400">{etiqueta}</dt>
      <dd className="select-all text-right font-mono text-sm">{valor}</dd>
    </div>
  );
}

export function TransferPanel({
  order,
  datos,
  aviso,
}: {
  order: Order;
  datos: DatosTransferencia;
  aviso: boolean;
}) {
  if (order.payment_status === "paid") return null;

  return (
    <section className="card mt-6 border-amber-500/30 p-6">
      <h2 className="text-lg font-bold">Transfiere para completar tu pedido</h2>
      <p className="mt-1.5 text-sm leading-relaxed text-ink-200">
        Todavía no recibimos el pago. Transfiere{" "}
        <strong className="text-white">{formatClp(order.amount_clp)}</strong> a esta cuenta y pon tu
        código <strong className="font-mono text-white">{order.code}</strong> en el mensaje o
        comentario de la transferencia.
      </p>

      <dl className="mt-5 rounded-xl border border-white/10 bg-white/4 px-4 py-1">
        <Dato etiqueta="Banco" valor={datos.banco} />
        <Dato etiqueta="Tipo de cuenta" valor={datos.tipoCuenta} />
        <Dato etiqueta="N° de cuenta" valor={datos.numero} />
        <Dato etiqueta="Titular" valor={datos.titular} />
        <Dato etiqueta="RUT" valor={datos.rut} />
        <Dato etiqueta="Correo" valor={datos.email} />
        <Dato etiqueta="Monto" valor={formatClp(order.amount_clp)} />
        <Dato etiqueta="Mensaje" valor={order.code} />
      </dl>

      {datos.instrucciones ? (
        <p className="mt-4 text-sm leading-relaxed text-ink-400">{datos.instrucciones}</p>
      ) : null}

      {order.transfer_notified_at ? (
        <div className="mt-5 rounded-xl border border-lime-500/30 bg-lime-500/10 px-4 py-3 text-sm text-lime-100">
          Nos avisaste el {formatDateCl(order.transfer_notified_at)}
          {order.transfer_reference ? ` (comprobante ${order.transfer_reference})` : ""}. En cuanto
          veamos la transferencia en la cuenta, tu pedido sale a entrega. Suele tomar unas horas en
          días hábiles.
        </div>
      ) : (
        <form action={avisarTransferencia} className="mt-5">
          <input type="hidden" name="code" value={order.code} />
          <label className="field-label" htmlFor="referencia">
            ¿Ya transferiste? Avísanos
          </label>
          <input
            id="referencia"
            name="referencia"
            className="field"
            placeholder="N° de comprobante (opcional)"
            autoComplete="off"
          />
          <button type="submit" className="btn btn-primary mt-3 w-full">
            Ya transferí
          </button>
          <p className="mt-2 text-xs text-ink-400">
            Esto nos avisa para que revisemos la cuenta. No confirma el pago por sí solo.
          </p>
        </form>
      )}

      {aviso ? (
        <p className="mt-4 text-center text-xs text-ink-400">
          Guarda tu código {order.code} para volver a esta página cuando quieras.
        </p>
      ) : null}
    </section>
  );
}
