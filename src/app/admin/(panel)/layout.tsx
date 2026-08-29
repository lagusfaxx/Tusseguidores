import Link from "next/link";
import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { currentUser, logout } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Panel",
  robots: { index: false, follow: false, nocache: true },
};
export const dynamic = "force-dynamic";

const NAV = [
  { href: "/admin", label: "Resumen" },
  { href: "/admin/pedidos", label: "Pedidos" },
  { href: "/admin/productos", label: "Productos" },
  { href: "/admin/catalogo", label: "Catálogo del proveedor" },
  { href: "/admin/seo", label: "SEO" },
  { href: "/admin/cupones", label: "Cupones" },
  { href: "/admin/ajustes", label: "Ajustes" },
];

async function signOut() {
  "use server";
  await logout();
  redirect("/admin/login");
}

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  // /admin/login vive fuera de este grupo de rutas, así que aquí siempre
  // exigimos sesión sin riesgo de redirigir en bucle.
  const user = await currentUser();
  if (!user) redirect("/admin/login");

  return (
    <div className="admin-shell min-h-screen">
      <header className="sticky top-0 z-30 border-b border-white/8 bg-ink-950/90 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-7xl items-center gap-3 px-4">
          <Link href="/admin" className="flex items-center gap-2 font-bold">
            <span className="grid h-7 w-7 place-items-center rounded-md bg-gradient-to-br from-brand-500 to-accent-500 text-xs">
              TS
            </span>
            Panel
          </Link>

          <nav className="ml-4 flex flex-1 items-center gap-0.5 overflow-x-auto [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

          <Link href="/" target="_blank" className="hidden text-sm text-ink-400 hover:text-white sm:block">
            Ver tienda ↗
          </Link>
          <form action={signOut}>
            <button type="submit" className="rounded-lg px-3 py-2 text-sm text-ink-400 hover:text-white">
              Salir
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 py-8">{children}</main>
    </div>
  );
}
