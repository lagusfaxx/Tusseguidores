import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { BuyBox } from "@/components/buy-box";
import { PlatformIcon, CheckIcon, BoltIcon, ShieldIcon } from "@/components/icons";
import {
  getProductBySlug, getPricedTiers, getProductsByPlatform, parseJson,
} from "@/lib/catalog";
import { platformLabel, serviceTypeLabel } from "@/lib/labels";
import { formatClp, formatNumber, formatDuration, pricingContext } from "@/lib/pricing";
import { absoluteUrl, breadcrumbLd, buildMetadata, faqLd, jsonLd } from "@/lib/seo";
import { sanitizeHtml } from "@/lib/utils";
import { routingForProduct } from "@/lib/routing";
import type { FaqItem } from "@/lib/types";

type Params = { params: Promise<{ slug: string }> };

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product) return { title: "Producto no encontrado" };

  return buildMetadata({
    title: product.seo_title || `${product.name} | TusSeguidores.cl`,
    description: product.seo_description || product.short_description,
    keywords: product.seo_keywords,
    image: product.og_image || product.image_url,
    path: `/producto/${product.slug}`,
    noindex: product.noindex === 1 || product.published !== 1,
  });
}

export default async function ProductPage({ params }: Params) {
  const { slug } = await params;
  const product = getProductBySlug(slug);
  if (!product || product.published !== 1) notFound();

  const tiers = getPricedTiers(product);
  const ctx = pricingContext();
  const bullets = parseJson<string[]>(product.bullets_json, []);
  const faq = parseJson<FaqItem[]>(product.faq_json, []);

  // Precio efectivo por 1.000 unidades: lo que necesita el widget para
  // calcular cantidades libres con el mismo resultado que el servidor.
  const minRate = ctx.minRates[product.service_type] ?? ctx.minRates.otros ?? 2900;
  const margin = product.margin_override ?? ctx.marginPercent;
  const ratePer1000Clp = Math.max(product.rate_usd_per_1000 * ctx.usdClp * (1 + margin / 100), minRate);

  // El pedido se le pide al mejor servicio disponible en el momento de
  // despacharlo, así que la entrega y la garantía que mostramos salen de ese
  // servicio y no del de referencia: lo que promete la ficha es lo que llega.
  const routed = routingForProduct(product, product.rate_usd_per_1000);
  const deliveryLabel = routed
    ? formatDuration(routed.service.avg_minutes) ?? product.delivery_label
    : product.delivery_label;
  const refillDays = routed ? Math.max(routed.service.refill_days, product.refill_days) : product.refill_days;
  const guaranteeText = refillDays >= 9999
    ? "Reposición de por vida si bajan"
    : refillDays > 0
      ? `Reposición gratis por ${refillDays} días`
      : product.guarantee_text || "Reembolso si el pedido no se entrega";

  const minQty = Math.max(product.min_qty, product.provider_min);
  const maxQty = Math.min(product.max_qty, product.provider_max);
  const cheapest = tiers.length ? tiers.reduce((a, b) => (a.priceClp < b.priceClp ? a : b)) : null;
  const dearest = tiers.length ? tiers.reduce((a, b) => (a.priceClp > b.priceClp ? a : b)) : null;

  const related = getProductsByPlatform(product.platform)
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.seo_description || product.short_description,
    image: [absoluteUrl(product.image_url || "/img/productos/generico.svg")],
    sku: `TS-${product.id}`,
    brand: { "@type": "Brand", name: "TusSeguidores" },
    category: `${platformLabel(product.platform)} / ${serviceTypeLabel(product.service_type)}`,
    offers: {
      "@type": "AggregateOffer",
      priceCurrency: "CLP",
      lowPrice: cheapest?.priceClp ?? 0,
      highPrice: dearest?.priceClp ?? 0,
      offerCount: tiers.length,
      availability: "https://schema.org/InStock",
      url: absoluteUrl(`/producto/${product.slug}`),
      seller: { "@type": "Organization", name: "TusSeguidores" },
    },
  };

  return (
    <>
      <SiteHeader />
      <main className="bg-halo">
        <div className="mx-auto max-w-6xl px-4 py-10">
          <nav aria-label="Ruta de navegación" className="flex flex-wrap items-center gap-1.5 text-xs text-ink-400">
            <Link href="/" className="hover:text-white">Inicio</Link>
            <span>/</span>
            <Link href={`/${product.platform}`} className="hover:text-white">{platformLabel(product.platform)}</Link>
            <span>/</span>
            <span className="text-ink-200">{product.name}</span>
          </nav>

          <div className="mt-6 grid gap-10 lg:grid-cols-[1.15fr_0.85fr]">
            {/* -------------------------------------------------- Columna izquierda */}
            <div>
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-300">
                <PlatformIcon slug={product.platform} className="h-4 w-4" />
                {platformLabel(product.platform)} · {serviceTypeLabel(product.service_type)}
              </div>

              <h1 className="mt-2 text-3xl font-extrabold leading-tight tracking-tight sm:text-4xl">
                {product.name}
              </h1>
              <p className="mt-3 max-w-2xl text-lg leading-relaxed text-ink-200">{product.short_description}</p>

              <div className="mt-6 overflow-hidden rounded-2xl border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image_url || "/img/productos/generico.svg"}
                  alt={product.name}
                  width={600}
                  height={400}
                  fetchPriority="high"
                  className="aspect-[3/2] w-full object-cover"
                />
              </div>

              <dl className="mt-6 grid gap-3 sm:grid-cols-3">
                {[
                  { icon: BoltIcon, label: "Entrega", value: deliveryLabel },
                  { icon: CheckIcon, label: "Calidad", value: product.quality_label },
                  { icon: ShieldIcon, label: "Garantía", value: guaranteeText },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="card p-4">
                    <dt className="flex items-center gap-1.5 text-xs text-ink-400">
                      <Icon className="h-3.5 w-3.5 text-brand-300" />
                      {label}
                    </dt>
                    <dd className="mt-1 text-sm font-semibold">{value}</dd>
                  </div>
                ))}
              </dl>

              {bullets.length ? (
                <ul className="mt-6 grid gap-2.5 sm:grid-cols-2">
                  {bullets.map((item) => (
                    <li key={item} className="flex items-start gap-2 text-sm text-ink-200">
                      <CheckIcon className="mt-0.5 h-4 w-4 shrink-0 text-lime-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              ) : null}

              <article
                className="prose-ts mt-10 max-w-none"
                dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description_html) }}
              />

              {/* Tabla de precios: buena para SEO y para comparar de un vistazo */}
              {tiers.length ? (
                <section className="mt-10">
                  <h2 className="text-xl font-bold">Precios</h2>
                  <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
                    <table className="w-full text-sm">
                      <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-ink-400">
                        <tr>
                          <th className="px-4 py-3 font-semibold">Cantidad</th>
                          <th className="px-4 py-3 font-semibold">Precio</th>
                          <th className="px-4 py-3 font-semibold">Por unidad</th>
                          <th className="px-4 py-3 font-semibold">Entrega</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tiers.map((tier) => (
                          <tr key={tier.id} className="border-t border-white/6">
                            <td className="px-4 py-3 font-semibold">{formatNumber(tier.quantity)}</td>
                            <td className="px-4 py-3 font-bold text-brand-300">{formatClp(tier.priceClp)}</td>
                            <td className="px-4 py-3 text-ink-400">
                              ${tier.unitClp.toLocaleString("es-CL", { maximumFractionDigits: 2 })}
                            </td>
                            <td className="px-4 py-3 text-ink-400">{deliveryLabel}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              ) : null}

              {faq.length ? (
                <section className="mt-10">
                  <h2 className="text-xl font-bold">Preguntas frecuentes</h2>
                  <div className="mt-4 space-y-3">
                    {faq.map((item) => (
                      <details key={item.q} className="card group p-4 [&_summary::-webkit-details-marker]:hidden">
                        <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold">
                          {item.q}
                          <span className="text-brand-300 transition-transform group-open:rotate-45">+</span>
                        </summary>
                        <p className="mt-2.5 text-sm leading-relaxed text-ink-200">{item.a}</p>
                      </details>
                    ))}
                  </div>
                </section>
              ) : null}
            </div>

            {/* -------------------------------------------------- Compra */}
            <div className="lg:sticky lg:top-24 lg:self-start">
              <BuyBox
                productId={product.id}
                tiers={tiers}
                minQty={minQty}
                maxQty={maxQty}
                linkLabel={product.link_label}
                linkPlaceholder={product.link_placeholder}
                linkHelp={product.link_help}
                deliveryLabel={deliveryLabel}
                guaranteeText={guaranteeText}
                ratePer1000Clp={ratePer1000Clp}
                minPriceClp={ctx.minPriceClp}
                rounding={ctx.rounding}
              />
            </div>
          </div>

          {related.length ? (
            <section className="mt-16">
              <h2 className="text-2xl font-extrabold tracking-tight">
                Más para {platformLabel(product.platform)}
              </h2>
              <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {related.map((item) => (
                  <ProductCard key={item.id} product={item} />
                ))}
              </div>
            </section>
          ) : null}
        </div>
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd([
          productLd,
          breadcrumbLd([
            { name: "Inicio", path: "/" },
            { name: platformLabel(product.platform), path: `/${product.platform}` },
            { name: product.name, path: `/producto/${product.slug}` },
          ]),
          ...(faq.length ? [faqLd(faq)] : []),
        ])}
      />
    </>
  );
}
