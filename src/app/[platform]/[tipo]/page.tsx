import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { PlatformIcon } from "@/components/icons";
import { Stars } from "@/components/stars";
import { LeerMas } from "@/components/leer-mas";
import {
  cheapestTier, getPlatformServiceTypes, getProductsByPlatformType,
} from "@/lib/catalog";
import { platformLabel, serviceTypeLabel } from "@/lib/labels";
import { formatClp, formatNumber } from "@/lib/pricing";
import { absoluteUrl, breadcrumbLd, buildMetadata, faqLd, jsonLd } from "@/lib/seo";
import { textoDeTipo } from "@/lib/seo-text";
import { getBoolSetting, getSetting } from "@/lib/settings";
import { aggregateRatingLd, storeRating } from "@/lib/ratings";
import { sanitizeHtml } from "@/lib/utils";

type Params = { params: Promise<{ platform: string; tipo: string }> };

/**
 * Página de una categoría dentro de una red: /instagram/seguidores.
 *
 * Existe por una razón concreta de búsqueda. Quien escribe "seguidores
 * instagram" no busca una tienda de todo, busca eso; con solo la página de la
 * red, ese término competía contra una página que habla de seguidores, likes,
 * vistas y guardados a la vez, y ninguna de las dos ganaba. Esta tiene el
 * término en la URL, en el título, en el <h1> y en un texto armado solo con
 * los productos de esa categoría.
 */
function combinaciones() {
  return getPlatformServiceTypes();
}

function existe(platform: string, tipo: string): boolean {
  return combinaciones().some((c) => c.platform === platform && c.service_type === tipo);
}

/** "Comprar seguidores Instagram": el término tal como se busca. */
function titulo(platform: string, tipo: string): string {
  return `Comprar ${serviceTypeLabel(tipo).toLowerCase()} ${platformLabel(platform)}`;
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { platform, tipo } = await params;
  if (!existe(platform, tipo)) return { title: "Página no encontrada" };

  const productos = getProductsByPlatformType(platform, tipo);
  const desde = productos
    .map((p) => cheapestTier(p)?.priceClp ?? Infinity)
    .reduce((min, v) => Math.min(min, v), Infinity);
  const red = platformLabel(platform);
  const etiqueta = serviceTypeLabel(tipo).toLowerCase();

  return buildMetadata({
    title: `${titulo(platform, tipo)} en Chile${
      Number.isFinite(desde) ? ` desde ${formatClp(desde)}` : ""
    } | TusSeguidores.cl`,
    description:
      `Compra ${etiqueta} para ${red} en Chile${
        Number.isFinite(desde) ? ` desde ${formatClp(desde)}` : ""
      }. ${productos.length} servicios con entrega automática, precios en pesos, ` +
      `pago con Webpay o transferencia y sin pedirte la contraseña.`,
    keywords: [
      `${etiqueta} ${red.toLowerCase()}`,
      `comprar ${etiqueta} ${red.toLowerCase()}`,
      `${etiqueta} ${red.toLowerCase()} chile`,
      `${etiqueta} ${red.toLowerCase()} baratos`,
      `comprar ${etiqueta} ${red.toLowerCase()} chile`,
    ].join(", "),
    path: `/${platform}/${tipo}`,
  });
}

export default async function PlatformTypePage({ params }: Params) {
  const { platform, tipo } = await params;
  if (!existe(platform, tipo)) notFound();

  const productos = getProductsByPlatformType(platform, tipo);
  if (!productos.length) notFound();

  const red = platformLabel(platform);
  const etiqueta = serviceTypeLabel(tipo);
  const precios = productos.map((p) => cheapestTier(p)?.priceClp).filter((v): v is number => !!v);
  const desde = precios.length ? Math.min(...precios) : null;
  const hasta = precios.length ? Math.max(...precios) : null;
  const rating = storeRating();

  // Texto propio de esta categoría. El escrito a mano en el panel manda.
  const manual = getSetting(`seo_text_${platform}_${tipo}`, "");
  const generado = getBoolSetting("auto_seo_text", true) ? textoDeTipo(platform, tipo) : null;
  const cuerpo = manual ? sanitizeHtml(manual) : generado?.html ?? null;
  const faq = manual ? [] : generado?.faq ?? [];

  // Enlaces internos: las otras categorías de la misma red y la misma
  // categoría en las otras redes. Es lo que hace que estas páginas se
  // encuentren entre ellas sin depender del menú.
  const todas = combinaciones();
  const otrasCategorias = todas.filter((c) => c.platform === platform && c.service_type !== tipo);
  const otrasRedes = todas.filter((c) => c.service_type === tipo && c.platform !== platform);

  const productLd = {
    "@context": "https://schema.org",
    "@type": "Product",
    name: `${etiqueta} para ${red}`,
    description: `${etiqueta} para ${red} con entrega automática y precios en pesos chilenos.`,
    brand: { "@type": "Brand", name: "TusSeguidores" },
    category: `${red} / ${etiqueta}`,
    ...(rating ? { aggregateRating: aggregateRatingLd(rating) } : {}),
    ...(desde != null && hasta != null
      ? {
          offers: {
            "@type": "AggregateOffer",
            priceCurrency: "CLP",
            lowPrice: desde,
            highPrice: hasta,
            offerCount: productos.length,
            availability: "https://schema.org/InStock",
            url: absoluteUrl(`/${platform}/${tipo}`),
            seller: { "@type": "Organization", name: "TusSeguidores" },
          },
        }
      : {}),
  };

  const itemListLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    name: `${etiqueta} para ${red}`,
    numberOfItems: productos.length,
    itemListElement: productos.map((p, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: p.name,
      url: absoluteUrl(`/producto/${p.slug}`),
    })),
  };

  return (
    <>
      <SiteHeader />
      <main className="bg-halo">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <nav aria-label="Ruta de navegación" className="flex flex-wrap items-center gap-1.5 text-xs text-ink-400">
            <Link href="/" className="hover:text-white">Inicio</Link>
            <span>/</span>
            <Link href={`/${platform}`} className="hover:text-white">{red}</Link>
            <span>/</span>
            <span className="text-ink-200">{etiqueta}</span>
          </nav>

          <div className="mt-5 flex items-start gap-3 sm:gap-4">
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/30 to-accent-500/25 text-brand-300 sm:h-14 sm:w-14 sm:rounded-2xl">
              <PlatformIcon slug={platform} className="h-6 w-6 sm:h-7 sm:w-7" />
            </span>
            <div>
              <h1 className="text-2xl font-extrabold tracking-tight sm:text-3xl lg:text-4xl">
                {titulo(platform, tipo)}
              </h1>
              <p className="mt-2 max-w-2xl text-sm leading-relaxed text-ink-200 sm:text-base">
                {productos.length} servicio{productos.length === 1 ? "" : "s"} de{" "}
                {etiqueta.toLowerCase()} para {red}
                {desde != null ? `, desde ${formatClp(desde)}` : ""}. Entrega automática, precios en
                pesos chilenos y sin pedirte la contraseña.
              </p>
              {rating ? <Stars rating={rating} tamano="md" className="mt-3" /> : null}
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 sm:gap-5 lg:mt-9 lg:grid-cols-4">
            {productos.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {/* Tabla de precios: es la respuesta corta a "cuánto cuesta", que es
              la búsqueda que trae a esta página. */}
          <section className="mt-12">
            <h2 className="text-xl font-bold">
              Precios de {etiqueta.toLowerCase()} para {red}
            </h2>
            <div className="mt-4 overflow-x-auto rounded-xl border border-white/10">
              <table className="w-full text-sm">
                <thead className="bg-white/5 text-left text-xs uppercase tracking-wide text-ink-400">
                  <tr>
                    <th className="px-4 py-3 font-semibold">Servicio</th>
                    <th className="px-4 py-3 font-semibold">Desde</th>
                    <th className="px-4 py-3 font-semibold">Precio</th>
                    <th className="hidden px-4 py-3 font-semibold sm:table-cell">Entrega</th>
                  </tr>
                </thead>
                <tbody>
                  {productos.map((p) => {
                    const barato = cheapestTier(p);
                    return (
                      <tr key={p.id} className="border-t border-white/6">
                        <td className="px-4 py-3">
                          <Link href={`/producto/${p.slug}`} className="font-semibold hover:text-brand-300">
                            {p.name}
                          </Link>
                        </td>
                        <td className="px-4 py-3 text-ink-400">
                          {barato ? `${formatNumber(barato.quantity)} u.` : "—"}
                        </td>
                        <td className="px-4 py-3 font-bold text-brand-300">
                          {barato ? formatClp(barato.priceClp) : "—"}
                        </td>
                        <td className="hidden px-4 py-3 text-ink-400 sm:table-cell">
                          {p.delivery_label}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          {cuerpo ? (
            <section className="mt-12 border-t border-white/8 pt-10">
              <LeerMas id="seo-tipo" alto="20rem" etiqueta={`Leer más sobre ${etiqueta.toLowerCase()} para ${red}`}>
                <div className="prose-ts max-w-3xl" dangerouslySetInnerHTML={{ __html: cuerpo }} />
              </LeerMas>
            </section>
          ) : null}

          {faq.length ? (
            <section className="mt-12 max-w-3xl">
              <h2 className="text-xl font-bold">
                Preguntas sobre {etiqueta.toLowerCase()} para {red}
              </h2>
              <div className="mt-5 divide-y divide-white/8 border-y border-white/8">
                {faq.map((item) => (
                  <details key={item.q} className="group py-4 [&_summary::-webkit-details-marker]:hidden">
                    <summary className="flex cursor-pointer items-center justify-between gap-4 text-sm font-semibold">
                      {item.q}
                      <span className="shrink-0 text-lg leading-none text-ink-400 transition-transform group-open:rotate-45">+</span>
                    </summary>
                    <p className="mt-3 text-sm leading-relaxed text-ink-200">{item.a}</p>
                  </details>
                ))}
              </div>
            </section>
          ) : null}

          {otrasCategorias.length || otrasRedes.length ? (
            <section className="mt-12 border-t border-white/8 pt-10">
              <h2 className="text-lg font-bold">Otras búsquedas</h2>
              <div className="mt-4 grid gap-6 sm:grid-cols-2">
                {otrasCategorias.length ? (
                  <div>
                    <h3 className="text-sm font-semibold text-ink-200">Más para {red}</h3>
                    <ul className="mt-2.5 flex flex-wrap gap-2">
                      {otrasCategorias.map((c) => (
                        <li key={c.service_type}>
                          <Link
                            href={`/${c.platform}/${c.service_type}`}
                            className="inline-block rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-ink-200 transition-colors hover:border-brand-400/50 hover:text-white"
                          >
                            Comprar {serviceTypeLabel(c.service_type).toLowerCase()} {red}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                {otrasRedes.length ? (
                  <div>
                    <h3 className="text-sm font-semibold text-ink-200">
                      {etiqueta} en otras redes
                    </h3>
                    <ul className="mt-2.5 flex flex-wrap gap-2">
                      {otrasRedes.map((c) => (
                        <li key={c.platform}>
                          <Link
                            href={`/${c.platform}/${c.service_type}`}
                            className="inline-block rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-sm text-ink-200 transition-colors hover:border-brand-400/50 hover:text-white"
                          >
                            Comprar {etiqueta.toLowerCase()} {platformLabel(c.platform)}
                          </Link>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
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
          itemListLd,
          breadcrumbLd([
            { name: "Inicio", path: "/" },
            { name: red, path: `/${platform}` },
            { name: etiqueta, path: `/${platform}/${tipo}` },
          ]),
          ...(faq.length ? [faqLd(faq)] : []),
        ])}
      />
    </>
  );
}
