import Link from "next/link";
import { redirect } from "next/navigation";
import { panelUser } from "@/lib/reseller-auth";
import { getPaymentStatus, FLOW_STATUS } from "@/lib/flow";
import { recargaPorCodigo, acreditar } from "@/lib/topups";
import { formatClp } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/**
 * Vuelta desde Flow después de recargar.
 *
 * Acredita si el pago está confirmado, igual que el webhook y con la misma
 * protección: acreditar es idempotente, así que si llegan los dos —el webhook
 * y esta pantalla— el saldo sube una sola vez. Existe porque el webhook puede
 * tardar unos segundos y el cliente ya está mirando la pantalla.
 */
export default async function RetornoRecarga({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>;
}) {
  const user = await panelUser();
  if (!user) redirect("/panel/entrar");

  const { token } = await searchParams;
  let mensaje = "No pudimos leer el resultado del pago. Si el cobro salió, el saldo se acredita solo en unos minutos.";
  let ok = false;
  let monto = 0;

  if (token) {
    try {
      const status = await getPaymentStatus(token);
      const topup = recargaPorCodigo(status.commerceOrder);
      if (topup && topup.user_id === user.id) {
        monto = topup.amount_clp;
        if (status.status === FLOW_STATUS.PAID) {
          if (Math.round(status.amount) >= topup.amount_clp) {
            acreditar(topup.id, String(status.flowOrder));
            ok = true;
            mensaje = "Listo: tu saldo ya está acreditado.";
          } else {
            // Monto distinto al esperado: no se acredita solo, lo revisa el dueño.
            mensaje = "El monto pagado no coincide con la recarga. Lo estamos revisando.";
          }
        } else if (status.status === FLOW_STATUS.REJECTED) {
          mensaje = "El pago fue rechazado. No se te cobró nada.";
        } else if (status.status === FLOW_STATUS.CANCELED) {
          mensaje = "Anulaste el pago. No se te cobró nada.";
        } else {
          mensaje = "El pago está en proceso. Apenas se confirme, el saldo aparece solo.";
        }
      }
    } catch {
      // Deja el mensaje por defecto: el webhook acreditará igual.
    }
  }

  return (
    <div className="mx-auto max-w-md py-10 text-center">
      <div className="card p-8">
        <p className={`text-lg font-bold ${ok ? "text-lime-400" : ""}`}>{mensaje}</p>
        {ok && monto ? (
          <p className="mt-2 text-sm text-ink-400">Recargaste {formatClp(monto)}.</p>
        ) : null}
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          <Link href="/panel/saldo?pagada=1" className="btn btn-ghost text-sm">Ver mi saldo</Link>
          <Link href="/panel/servicios" className="btn btn-primary text-sm">Hacer un pedido</Link>
        </div>
      </div>
    </div>
  );
}
