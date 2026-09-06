import Link from "next/link";
import { redirect } from "next/navigation";
import { panelUser } from "@/lib/reseller-auth";
import { PanelForm } from "@/components/panel-ui";
import { accionEntrar } from "../actions";
import { formatClp } from "@/lib/pricing";
import { resellerContext } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function PanelLoginPage() {
  if (await panelUser()) redirect("/panel");
  const ctx = resellerContext();

  return (
    <div className="mx-auto grid max-w-4xl gap-8 py-6 lg:grid-cols-[1fr_0.9fr] lg:items-center">
      <div>
        <h1 className="text-3xl font-extrabold tracking-tight">Panel mayorista</h1>
        <p className="mt-3 text-ink-200">
          Los mismos servicios de la tienda a precio de mayorista, sin el precio mínimo de la
          tienda. Cargas saldo una vez y desde ahí mandas los pedidos que necesites, cuando los
          necesites.
        </p>
        <ul className="mt-6 space-y-2.5 text-sm text-ink-200">
          <li>· Precio por cada 1.000 unidades, sin ticket mínimo de la tienda.</li>
          <li>· Recarga desde {formatClp(ctx.minTopupClp)} por Webpay o transferencia.</li>
          <li>· Cada pedido descuenta del saldo al instante y entra a entrega solo.</li>
          <li>· Reposición y soporte por ticket, respondido por nosotros.</li>
        </ul>
      </div>

      <div className="card p-6">
        <h2 className="font-bold">Entrar</h2>
        <PanelForm action={accionEntrar} submitLabel="Entrar" pendiente="Entrando…" className="mt-4">
          <label className="field-label" htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" required autoComplete="username" className="field" />

          <label className="field-label mt-4" htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="field"
          />
        </PanelForm>
        <p className="mt-4 text-sm text-ink-400">
          ¿No tienes cuenta?{" "}
          <Link href="/panel/crear-cuenta" className="text-brand-300 hover:text-white">Créala gratis</Link>
        </p>
      </div>
    </div>
  );
}
