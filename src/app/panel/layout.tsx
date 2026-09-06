import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { panelUser } from "@/lib/reseller-auth";
import { getBoolSetting, getSetting } from "@/lib/settings";
import { formatClp } from "@/lib/pricing";
import { accionSalir } from "./actions";

export const metadata: Metadata = {
  title: "Panel mayorista",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/panel", label: "Resumen" },
  { href: "/panel/servicios", label: "Servicios" },
  { href: "/panel/pedidos", label: "Mis pedidos" },
  { href: "/panel/saldo", label: "Saldo" },
  { href: "/panel/tickets", label: "Soporte" },
];

/**
 * Cascarón del panel mayorista.
 *
 * Las pantallas de entrar y crear cuenta viven dentro de este mismo grupo, así
 * que aquí no se exige sesión: cada página decide. Lo que sí se decide acá es
 * mostrar la barra solo cuando hay alguien dentro, para que la pantalla de
 * login no tenga un menú que no lleva a ninguna parte.
 */
export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  if (!getBoolSetting("reseller_enabled", true)) redirect("/");
  const user = await panelUser();
  const tienda = getSetting("site_name", "TusSeguidores");

  return (
    <div className="bg-halo min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center gap-3 px-4">
          <Link href={user ? "/panel" : "/"} className="flex shrink-0 items-center gap-2 font-bold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-brand-500 to-accent-500 text-xs">
              TS
            </span>
            <span className="hidden sm:inline">{tienda}</span>
            <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-ink-200">
              mayorista
            </span>
          </Link>

          {user ? (
            <>
              <nav className="ml-1 flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto sm:ml-4 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {NAV.map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="shrink-0 rounded-lg px-3 py-2 text-sm text-ink-200 transition-colors hover:bg-white/6 hover:text-white"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>

              <Link
                href="/panel/saldo"
                className="shrink-0 rounded-lg border border-white/12 bg-white/6 px-3 py-1.5 text-sm font-semibold text-white"
                title="Tu saldo disponible"
              >
                {formatClp(user.balance_clp)}
              </Link>
              <form action={accionSalir} className="shrink-0">
                <button type="submit" className="rounded-lg px-2 py-2 text-sm text-ink-400 hover:text-white">
                  Salir
                </button>
              </form>
            </>
          ) : (
            <div className="ml-auto flex items-center gap-2">
              <Link href="/panel/entrar" className="rounded-lg px-3 py-2 text-sm text-ink-200 hover:text-white">
                Entrar
              </Link>
              <Link href="/panel/crear-cuenta" className="btn btn-primary px-4 py-2 text-sm">
                Crear cuenta
              </Link>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>

      <footer className="mx-auto max-w-6xl px-4 pb-10 text-xs text-ink-400">
        <Link href="/" className="hover:text-white">← Volver a la tienda</Link>
      </footer>
    </div>
  );
}
