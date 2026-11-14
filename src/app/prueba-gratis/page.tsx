import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { PruebaForm } from "@/components/prueba-form";
import { buildMetadata } from "@/lib/seo";
import { cantidadDePrueba, redesDePrueba } from "@/lib/prueba";
import { platformAccent } from "@/lib/labels";
import { BoltIcon, CheckIcon, LockIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const cantidad = cantidadDePrueba();
  return buildMetadata({
    title: `Prueba gratis: ${cantidad} seguidores | TusSeguidores.cl`,
    description: `Recibe ${cantidad} seguidores gratis en tu cuenta antes de comprar. Sin tarjeta ni contraseña.`,
    path: "/prueba-gratis",
  });
}

export default async function PruebaPage({
  searchParams,
}: {
  searchParams: Promise<{ red?: string }>;
}) {
  const { red } = await searchParams;
  const cantidad = cantidadDePrueba();
  const redes = redesDePrueba().map((r) => ({ ...r, color: platformAccent(r.platform) }));

  return (
    <>
      <SiteHeader />
      <main className="bg-halo">
        <div className="mx-auto grid max-w-5xl gap-8 px-4 py-10 sm:py-16 lg:grid-cols-2 lg:items-center lg:gap-14">
          <div>
            <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-lime-400">
              <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
              Gratis
            </p>
            <h1 className="mt-4 text-4xl font-extrabold leading-[1.05] sm:text-5xl">
              Prueba con {cantidad} seguidores antes de comprar
            </h1>
            <p className="mt-4 text-lg text-ink-200">Míralos llegar a tu cuenta y decide después.</p>
            <ul className="mt-6 space-y-2.5 text-sm text-ink-200">
              {[
                [<BoltIcon key="i" className="h-4 w-4" />, "Empiezan a llegar en minutos"],
                [<LockIcon key="i" className="h-4 w-4" />, "Sin tarjeta ni contraseña"],
                [<CheckIcon key="i" className="h-4 w-4" />, "Una prueba por cuenta"],
              ].map(([icono, texto]) => (
                <li key={String(texto)} className="flex items-center gap-2">
                  <span className="text-lime-400">{icono}</span>
                  {texto}
                </li>
              ))}
            </ul>
          </div>

          {redes.length ? (
            <PruebaForm redes={redes} cantidad={cantidad} inicial={red} />
          ) : (
            <div className="card p-6">
              <p className="font-semibold">La prueba gratis no está disponible ahora.</p>
              <Link href="/catalogo" className="btn btn-primary mt-4 text-sm">Ver precios</Link>
            </div>
          )}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
