import Link from "next/link";
import { redirect } from "next/navigation";
import { panelUser } from "@/lib/reseller-auth";
import { PanelForm } from "@/components/panel-ui";
import { accionRegistrar } from "../actions";
import { getSetting } from "@/lib/settings";
import { formatClp, resellerContext } from "@/lib/pricing";

export const dynamic = "force-dynamic";

export default async function PanelRegistroPage() {
  if (await panelUser()) redirect("/panel");
  const ctx = resellerContext();
  const bienvenida = getSetting("reseller_welcome", "");

  return (
    <div className="mx-auto max-w-md py-6">
      <h1 className="text-2xl font-extrabold tracking-tight">Crear cuenta mayorista</h1>
      <p className="mt-2 text-sm text-ink-200">
        Es gratis. Solo pagas cuando cargas saldo, desde {formatClp(ctx.minTopupClp)}.
      </p>
      {bienvenida ? (
        <p className="mt-4 rounded-lg border border-white/10 bg-white/4 px-4 py-3 text-sm text-ink-200">
          {bienvenida}
        </p>
      ) : null}

      <div className="card mt-6 p-6">
        <PanelForm action={accionRegistrar} submitLabel="Crear mi cuenta" pendiente="Creando…">
          <label className="field-label" htmlFor="name">Nombre</label>
          <input id="name" name="name" required className="field" placeholder="Cómo te llamamos" />

          <label className="field-label mt-4" htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" required autoComplete="username" className="field" />

          <label className="field-label mt-4" htmlFor="phone">Teléfono (opcional)</label>
          <input id="phone" name="phone" className="field" placeholder="+56 9 1234 5678" />

          <label className="field-label mt-4" htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            minLength={8}
            autoComplete="new-password"
            className="field"
          />
          <p className="mt-1 text-xs text-ink-400">Mínimo 8 caracteres.</p>
        </PanelForm>
      </div>

      <p className="mt-4 text-sm text-ink-400">
        ¿Ya tienes cuenta?{" "}
        <Link href="/panel/entrar" className="text-brand-300 hover:text-white">Entra aquí</Link>
      </p>
    </div>
  );
}
