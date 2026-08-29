import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { getPublishedProducts } from "@/lib/catalog";
import { platformLabel, sortPlatforms } from "@/lib/labels";
import { buildMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Catálogo completo | TusSeguidores.cl",
    description:
      "Todos nuestros servicios para Instagram, TikTok, YouTube, Facebook, X, Telegram y más. Precios en pesos chilenos con entrega automática.",
    keywords: "catálogo seguidores chile, servicios smm chile, comprar likes chile",
    path: "/catalogo",
  });
}

export default function CatalogPage() {
  const products = getPublishedProducts();
  const platforms = sortPlatforms(
    [...new Set(products.map((p) => p.platform))].map((platform) => ({ platform })),
  );

  return (
    <>
      <SiteHeader />
      <main className="bg-halo">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">Catálogo completo</h1>
          <p className="mt-2 max-w-2xl text-sm text-ink-200 sm:text-base">
            {products.length} servicios listos para comprar, todos con entrega automática y precios en pesos chilenos.
          </p>

          <div className="mt-6 flex flex-wrap gap-2">
            {platforms.map((p) => (
              <a
                key={p.platform}
                href={`#${p.platform}`}
                className="rounded-full border border-white/12 bg-white/5 px-3.5 py-1.5 text-sm text-ink-200 transition-colors hover:border-brand-400/50 hover:text-white"
              >
                {platformLabel(p.platform)}
              </a>
            ))}
          </div>

          {platforms.map((p) => (
            <section key={p.platform} id={p.platform} className="mt-9 scroll-mt-24 lg:mt-12">
              <div className="flex items-end justify-between gap-4">
                <h2 className="text-xl font-bold sm:text-2xl">{platformLabel(p.platform)}</h2>
                <Link href={`/${p.platform}`} className="shrink-0 text-sm text-brand-300 hover:text-white">
                  Ver <span className="hidden sm:inline">página de {platformLabel(p.platform)}</span>
                  <span className="sm:hidden">todo</span>
                </Link>
              </div>
              {(() => {
                const items = products.filter((product) => product.platform === p.platform);
                return (
                  <>
                    <div className="mt-4 grid gap-3 sm:mt-5 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
                      {items.map((product, i) => (
                        /* En teléfono mostramos los primeros cuatro: 35 tarjetas
                           seguidas eran diez pantallas de scroll. */
                        <div key={product.id} className={i >= 3 ? "hidden sm:block" : ""}>
                          <ProductCard product={product} />
                        </div>
                      ))}
                    </div>
                    {items.length > 3 ? (
                      <Link
                        href={`/${p.platform}`}
                        className="mt-3 flex items-center justify-center rounded-xl border border-white/12 bg-white/4 px-4 py-2.5 text-sm font-semibold text-ink-200 sm:hidden"
                      >
                        Ver los {items.length} de {platformLabel(p.platform)}
                      </Link>
                    ) : null}
                  </>
                );
              })()}
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
