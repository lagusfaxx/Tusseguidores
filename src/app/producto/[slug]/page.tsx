import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { BuyBox } from "@/components/buy-box";
import { LevelCompare } from "@/components/level-compare";
import { PlatformIcon, CheckIcon, BoltIcon, ShieldIcon } from "@/components/icons";
import {
  getProductBySlug, getPricedTiers, getProductsByPlatform, parseJson,
} from "@/lib/catalog";
import { platformLabel, serviceTypeLabel } from "@/lib/labels";
import { formatClp, formatNumber, formatDuration, floorPer1000, pricingContext } from "@/lib/pricing";
import { absoluteUrl, breadcrumbLd, buildMetadata, faqLd, jsonLd } from "@/lib/seo";
import { sanitizeHtml } from "@/lib/utils";
import { routingForProduct } from "@/lib/routing";
import { comparadorDeNiveles, levelLabel } from "@/lib/levels";
import { getBoolSetting } from "@/lib/settings";
import { transferenciaDisponible } from "@/lib/transfer";
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
  // El piso por 1.000 sube con el nivel: sin eso el económico y el premium
  // chocarían contra el mismo mínimo y las cantidades libres se aplanarían.
  const minRate = floorPer1000(product.service_type, ctx, product.level);
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

  // Los otros niveles del mismo servicio, con su precio a la misma cantidad.
  const niveles = comparadorDeNiveles(product);

  const related = getProductsByPlatform(product.platform)
    .filter((p) => p.id !== product.id)
    .slice(0, 4);

  /**
   * Bloque con los datos concretos de este producto. Es lo que evita que la
   * ficha de Instagram y la de TikTok sean el mismo texto con otro nombre:
   * los precios, los plazos y la garantía son distintos en cada una y se
   * actualizan solos cuando cambia el catálogo.
   */
  const datos =
    getBoolSetting("auto_seo_text", true) && tiers.length
      ? [
          `<h2>Cuánto cuesta y cuánto demora</h2>`,
          // El pack más chico es el de menor cantidad, no el de menor precio:
          // los primeros suelen empatar en el ticket mínimo de la tienda.
          `<p>El pack más chico son ${formatNumber(tiers[0].quantity)} unidades por ` +
            `${formatClp(tiers[0].priceClp)}, y el más grande ` +
            `${formatNumber(tiers[tiers.length - 1].quantity)} por ` +
            `${formatClp(tiers[tiers.length - 1].priceClp)}. También puedes pedir una cantidad exacta entre ` +
            `${formatNumber(minQty)} y ${formatNumber(maxQty)}: el precio se ajusta solo.</p>`,
          `<p>${deliveryLabel === "Inicio inmediato"
            ? "La entrega empieza apenas se confirma el pago"
            : `El plazo promedio de entrega es de ${deliveryLabel.replace(/^Entrega en ~?/, "")}`}` +
            `, y el pedido se envía al servicio más rápido y con menos caída que tengamos activo ` +
            `en ese momento. ${refillDays >= 9999
              ? "Este pack incluye reposición de por vida: si bajan, los reponemos."
              : refillDays > 0
                ? `Este pack incluye ${refillDays} días de reposición sin costo.`
                : "Si el pedido no se entrega, te devolvemos el dinero."}</p>`,
          // Con niveles publicados, la comparación de precios es contenido
          // propio de esta ficha y no se repite en ninguna otra: es la
          // diferencia entre tres páginas distintas y tres páginas clonadas.
          ...(niveles.length > 1
            ? [
                `<h2>Cuál nivel te conviene</h2>`,
                `<p>Para ${formatNumber(niveles[0].quantity)} unidades, ` +
                  niveles
                    .map(
                      (n) =>
                        `el ${n.label.toLowerCase()} cuesta ${formatClp(n.priceClp)} y ${n.retencion}, ${n.entrega}, ${n.reposicion}`,
                    )
                    .join("; ") +
                  `. Estás viendo el ${levelLabel(product.level).toLowerCase() || "único disponible"}.</p>`,
              ]
            : []),
        ].join("\n")
      : null;

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

          {/*
            En teléfono el orden del DOM manda: título, formulario de compra y
            recién después el contenido largo. Antes había que bajar casi cuatro
            pantallas para encontrar el botón de pagar.
          */}
          <div className="mt-5 grid gap-8 lg:mt-6 lg:grid-cols-[1.15fr_0.85fr] lg:items-start lg:gap-10">
            {/* ------------------------------------------------------- Encabezado */}
            <header className="lg:col-start-1 lg:row-start-1">
              <div className="flex items-center gap-2 text-sm font-semibold text-brand-300">
                <PlatformIcon slug={product.platform} className="h-4 w-4" />
                {platformLabel(product.platform)} · {serviceTypeLabel(product.service_type)}
                {product.level ? (
                  <span className="rounded bg-white/10 px-1.5 py-0.5 text-[11px] font-semibold text-ink-200">
                    {levelLabel(product.level)}
                  </span>
                ) : null}
              </div>

              <h1 className="mt-2 text-[26px] font-extrabold leading-tight tracking-tight sm:text-3xl lg:text-4xl">
                {product.name}
              </h1>
              <p className="mt-2 max-w-2xl leading-relaxed text-ink-200 lg:mt-3 lg:text-lg">
                {product.short_description}
              </p>
            </header>

            {/* ------------------------------------------------------------ Compra */}
            <div className="lg:col-start-2 lg:row-start-1 lg:row-span-2 lg:sticky lg:top-24">
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
                orderKind={product.order_kind}
                transferencia={transferenciaDisponible()}
              />
            </div>

            {/* -------------------------------------------------- Contenido largo */}
            <div className="lg:col-start-1 lg:row-start-2">
              <div className="overflow-hidden rounded-2xl border border-white/10">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={product.image_url || "/img/productos/generico.svg"}
                  alt={product.name}
                  width={600}
                  height={400}
                  fetchPriority="high"
                  className="aspect-[5/2] w-full object-cover sm:aspect-[3/2]"
                />
              </div>

              <dl className="mt-5 grid grid-cols-3 gap-2 sm:gap-3">
                {[
                  { icon: BoltIcon, label: "Entrega", value: deliveryLabel },
                  { icon: CheckIcon, label: "Calidad", value: product.quality_label },
                  { icon: ShieldIcon, label: "Garantía", value: guaranteeText },
                ].map(({ icon: Icon, label, value }) => (
                  <div key={label} className="card p-3 sm:p-4">
                    <dt className="flex items-center gap-1.5 text-[11px] text-ink-400 sm:text-xs">
                      <Icon className="h-3.5 w-3.5 shrink-0 text-brand-300" />
                      {label}
                    </dt>
                    <dd className="mt-1 text-[13px] font-semibold leading-snug sm:text-sm">{value}</dd>
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

              {/*
                En teléfono la descripción se recorta con un "ver más" de puro
                CSS. El texto sigue en el HTML, así que Google lo lee igual;
                lo que se evita es empujar el resto de la página tres pantallas.
              */}
              <div className="mt-8 lg:mt-10">
                <input type="checkbox" id="ver-mas" className="peer sr-only" />
                <article
                  className="prose-ts relative max-h-[22rem] max-w-none overflow-hidden peer-checked:max-h-none after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-24 after:bg-gradient-to-t after:from-ink-950 after:to-transparent peer-checked:after:hidden sm:max-h-none sm:after:hidden"
                  dangerouslySetInnerHTML={{
                    __html: sanitizeHtml(product.description_html) + (datos ?? ""),
                  }}
                />
                <label
                  htmlFor="ver-mas"
                  className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3.5 py-2 text-sm font-semibold text-ink-200 peer-checked:hidden sm:hidden"
                >
                  Leer la descripción completa
                </label>
              </div>

              <LevelCompare filas={niveles} />

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
                          <th className="hidden px-4 py-3 font-semibold sm:table-cell">Por unidad</th>
                          <th className="px-4 py-3 font-semibold">Entrega</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tiers.map((tier) => (
                          <tr key={tier.id} className="border-t border-white/6">
                            <td className="px-4 py-3 font-semibold">{formatNumber(tier.quantity)}</td>
                            <td className="px-4 py-3 font-bold text-brand-300">{formatClp(tier.priceClp)}</td>
                            <td className="hidden px-4 py-3 text-ink-400 sm:table-cell">
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

          </div>

          {related.length ? (
            <section className="mt-12 lg:mt-16">
              <h2 className="text-2xl font-extrabold tracking-tight">
                Más para {platformLabel(product.platform)}
              </h2>
              <div className="mt-5 grid gap-3 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
                {related.map((item, i) => (
                  <div key={item.id} className={i >= 2 ? "hidden sm:block" : ""}>
                    <ProductCard product={item} />
                  </div>
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
