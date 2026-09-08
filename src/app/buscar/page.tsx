import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { getPlatformServiceTypes, searchProducts } from "@/lib/catalog";
import { platformLabel, serviceTypeLabel } from "@/lib/labels";
import { buildMetadata } from "@/lib/seo";

export const dynamic = "force-dynamic";

type Params = { searchParams: Promise<{ q?: string }> };

/**
 * Buscador de la tienda.
 *
 * Existía en los datos estructurados (`SearchAction` apunta a /buscar?q=)
 * pero no como página: el sitio le prometía a Google un buscador que devolvía
 * 404. Los resultados van con noindex —son combinaciones infinitas de la
 * misma información— y su trabajo aquí es llevar a las páginas que sí se
 * indexan.
 */
export async function generateMetadata({ searchParams }: Params): Promise<Metadata> {
  const { q } = await searchParams;
  const consulta = (q ?? "").trim();
  return buildMetadata({
    title: consulta
      ? `Resultados para "${consulta}" | TusSeguidores.cl`
      : "Buscar servicios | TusSeguidores.cl",
    description: "Busca seguidores, me gusta, visualizaciones y más para tus redes sociales.",
    path: consulta ? `/buscar?q=${encodeURIComponent(consulta)}` : "/buscar",
    noindex: true,
  });
}

export default async function BuscarPage({ searchParams }: Params) {
  const { q } = await searchParams;
  const consulta = (q ?? "").trim().slice(0, 60);
  const resultados = consulta ? searchProducts(consulta) : [];
  const sugerencias = getPlatformServiceTypes().slice(0, 12);

  return (
    <>
      <SiteHeader />
      <main className="bg-halo">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl">Buscar</h1>

          <form action="/buscar" className="mt-5 flex max-w-xl gap-2">
            <input
              type="search"
              name="q"
              defaultValue={consulta}
              placeholder="seguidores instagram, likes tiktok…"
              aria-label="Qué estás buscando"
              className="field flex-1"
            />
            <button type="submit" className="btn btn-primary shrink-0 px-5">Buscar</button>
          </form>

          {consulta ? (
            resultados.length ? (
              <>
                <p className="mt-6 text-sm text-ink-400">
                  {resultados.length} resultado{resultados.length === 1 ? "" : "s"} para{" "}
                  <span className="text-ink-200">{consulta}</span>
                </p>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
                  {resultados.map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
                </div>
              </>
            ) : (
              <p className="mt-6 rounded-xl border border-white/10 bg-white/4 p-6 text-ink-400">
                No encontramos nada para <span className="text-ink-200">{consulta}</span>. Prueba con
                el nombre de la red o del servicio, por ejemplo &ldquo;seguidores instagram&rdquo;.
              </p>
            )
          ) : null}

          <section className="mt-12 border-t border-white/8 pt-10">
            <h2 className="text-lg font-bold">Lo que más se busca</h2>
            <ul className="mt-4 flex flex-wrap gap-2">
              {sugerencias.map((c) => (
                <li key={`${c.platform}-${c.service_type}`}>
                  <Link
                    href={`/${c.platform}/${c.service_type}`}
                    className="inline-block rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-ink-200 transition-colors hover:border-brand-400/50 hover:text-white"
                  >
                    {serviceTypeLabel(c.service_type)} {platformLabel(c.platform)}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
