import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { NuevaConsulta } from "@/components/soporte-ui";
import { buildMetadata } from "@/lib/seo";
import { TEXTO_DEVOLUCIONES } from "@/lib/devoluciones";
import { irAMiPedido } from "./actions";

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Soporte | TusSeguidores.cl",
    description: "Escríbenos por ticket: te respondemos en la misma página y te avisamos por correo.",
    path: "/soporte",
  });
}

/**
 * La única puerta de contacto de la tienda. No hay correo ni teléfono
 * públicos: quien tiene pedido habla desde su pedido, y quien no, abre una
 * consulta aquí.
 */
export default async function SoportePage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;
  return (
    <>
      <SiteHeader />
      <main className="bg-halo">
        <div className="mx-auto max-w-5xl px-4 py-12 sm:py-16">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Soporte</h1>
          <p className="mt-2 max-w-2xl text-ink-200">
            Toda la atención es por ticket: escribes aquí, te respondemos en la misma página y te
            avisamos por correo. Así nada se pierde y siempre sabes en qué va tu caso.
          </p>

          <div className="mt-8 grid gap-5 lg:grid-cols-2 [&>*]:min-w-0">
            <section className="card p-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                Ya compré
              </span>
              <h2 className="mt-1 text-lg font-bold">Ayuda con un pedido</h2>
              <p className="mt-1 text-sm text-ink-400">
                Cada pedido tiene su propio ticket. Entra con tu código y escríbenos desde ahí:
                también puedes corregir el destino, pedir reposición o pedir una devolución.
              </p>
              <form action={irAMiPedido} className="mt-5">
                <label className="field-label" htmlFor="code">Código de pedido</label>
                <input
                  id="code"
                  name="code"
                  required
                  autoComplete="off"
                  className="field font-mono uppercase"
                  placeholder="TS-XXXXXX"
                />
                {error ? <p className="mt-2 text-sm text-red-300">Escribe tu código de pedido.</p> : null}
                <button type="submit" className="btn btn-primary mt-4 w-full">Ir a mi pedido</button>
              </form>
              <p className="mt-4 text-xs text-ink-600">
                ¿Perdiste el código? Está en el correo que te enviamos al comprar.
              </p>
              <p className="mt-4 border-t border-white/8 pt-4 text-xs leading-relaxed text-ink-400">
                {TEXTO_DEVOLUCIONES}
              </p>
            </section>

            <section className="card p-6">
              <span className="text-xs font-semibold uppercase tracking-wider text-brand-300">
                Todavía no compro
              </span>
              <h2 className="mt-1 text-lg font-bold">Hacer una consulta</h2>
              <p className="mt-1 mb-5 text-sm text-ink-400">
                Antes de escribir, mira las{" "}
                <Link href="/preguntas-frecuentes" className="text-brand-300 hover:underline">
                  preguntas frecuentes
                </Link>
                : casi siempre la respuesta está ahí.
              </p>
              <NuevaConsulta />
            </section>
          </div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
