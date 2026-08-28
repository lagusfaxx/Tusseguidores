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
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Catálogo completo</h1>
          <p className="mt-2 max-w-2xl text-ink-200">
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
            <section key={p.platform} id={p.platform} className="mt-12 scroll-mt-24">
              <div className="flex items-end justify-between gap-4">
                <h2 className="text-2xl font-bold">{platformLabel(p.platform)}</h2>
                <Link href={`/${p.platform}`} className="text-sm text-brand-300 hover:text-white">
                  Ver página de {platformLabel(p.platform)}
                </Link>
              </div>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {products
                  .filter((product) => product.platform === p.platform)
                  .map((product) => (
                    <ProductCard key={product.id} product={product} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
