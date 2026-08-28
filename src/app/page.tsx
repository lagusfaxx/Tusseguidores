import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { getFeaturedProducts, getPlatformsWithProducts, getPublishedProducts, cheapestTier } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { platformLabel, sortPlatforms } from "@/lib/labels";
import { formatClp } from "@/lib/pricing";
import { buildMetadata, faqLd, jsonLd } from "@/lib/seo";
import { PlatformIcon } from "@/components/icons";
import { sanitizeHtml } from "@/lib/utils";

export function generateMetadata(): Metadata {
  const s = getSettings();
  return buildMetadata({
    title: s.seo_home_title,
    description: s.seo_home_description,
    keywords: s.seo_home_keywords,
    path: "/",
  });
}

const HOME_FAQ = [
  {
    q: "¿Me pueden cerrar la cuenta?",
    a: "No hemos tenido casos. Nunca entramos a tu cuenta ni te pedimos la clave: la entrega se hace desde afuera, como si esas personas te hubieran encontrado solas. Lo que sí te recomendamos es no pedir 10.000 seguidores para una cuenta que tiene 200: se nota.",
  },
  {
    q: "¿Cuánto se demora?",
    a: "La mayoría parte antes de 10 minutos. Cada producto dice su tiempo estimado arriba del botón de pago, y ese tiempo sale del servicio que efectivamente vamos a usar, no de un promedio inventado.",
  },
  {
    q: "¿Con qué puedo pagar?",
    a: "Webpay (crédito y débito), transferencia y Mercado Pago. Todo pasa por Flow, así que los datos de tu tarjeta no llegan nunca a nosotros.",
  },
  {
    q: "¿Los seguidores se caen?",
    a: "Algunos sí, en todas las plataformas pasa. Por eso los packs marcados con reposición los reponemos gratis dentro del plazo que indican. Si tu pedido no llega, te devolvemos la plata completa.",
  },
  {
    q: "¿Necesito tener la cuenta pública?",
    a: "Sí, durante toda la entrega. Si la pones privada a mitad de camino el pedido queda incompleto y no alcanzamos a arreglarlo.",
  },
  {
    q: "Me equivoqué en el enlace",
    a: "Escríbenos altiro con tu código de pedido. Si todavía no sale a entrega lo corregimos; si ya salió, no hay vuelta atrás.",
  },
];

export default function HomePage() {
  const settings = getSettings();
  const featured = getFeaturedProducts(8);
  const all = getPublishedProducts();
  const products = featured.length ? featured : all.slice(0, 8);
  const platforms = sortPlatforms(getPlatformsWithProducts());

  // Precio real más bajo del catálogo: preferimos decir el número a prometer
  // "precios bajos".
  const prices = all.map((p) => cheapestTier(p)?.priceClp).filter((v): v is number => typeof v === "number");
  const desde = prices.length ? Math.min(...prices) : 1990;

  const whatsapp = settings.contact_whatsapp.replace(/\D/g, "");

  return (
    <>
      <SiteHeader />
      <main>
        {/* ---------------------------------------------------------- Hero */}
        <section className="border-b border-white/8">
          <div className="mx-auto max-w-6xl px-4 pb-14 pt-14 sm:pt-20">
            <div className="grid gap-12 lg:grid-cols-[1.1fr_0.9fr] lg:items-start">
              <div className="max-w-xl">
                <h1 className="text-pretty text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
                  Seguidores, likes y vistas para tus redes.{" "}
                  <span className="whitespace-nowrap text-accent-400">Al tiro.</span>
                </h1>

                <p className="mt-6 text-lg leading-relaxed text-ink-200">
                  Eliges cuántos quieres, pagas con Webpay o transferencia y empiezan a llegar
                  en minutos. No te pedimos la clave: con tu usuario basta.
                </p>

                <div className="mt-8 flex flex-wrap items-center gap-3">
                  <Link href="#catalogo" className="btn btn-primary text-base">
                    Ver precios
                  </Link>
                  <Link href="/seguimiento" className="btn btn-ghost text-base">
                    Seguir mi pedido
                  </Link>
                </div>

                <p className="mt-6 text-sm text-ink-400">
                  Desde <strong className="font-semibold text-white">{formatClp(desde)}</strong> ·{" "}
                  {all.length} servicios en {platforms.length} redes · Precios en pesos, IVA incluido
                </p>
              </div>

              {/* Selector de red. En móvil basta con el de la cabecera. */}
              <div className="hidden lg:block">
                <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                  Ir directo a tu red
                </h2>
                <div className="mt-4 grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {platforms.map((p) => (
                    <Link
                      key={p.platform}
                      href={`/${p.platform}`}
                      className="group flex items-center gap-2.5 rounded-lg border border-white/10 bg-white/4 px-3 py-2.5 transition-colors hover:border-brand-400/50 hover:bg-white/8"
                    >
                      <PlatformIcon
                        slug={p.platform}
                        className="h-5 w-5 shrink-0 text-ink-400 transition-colors group-hover:text-brand-300"
                      />
                      <span className="truncate text-sm font-medium">{platformLabel(p.platform)}</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Franja de datos concretos, sin tarjetas ni iconos */}
        <div className="border-b border-white/8 bg-ink-900/50">
          <div className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-4 text-sm text-ink-200">
            <span>Sin contraseñas</span>
            <span className="text-ink-600">·</span>
            <span>Webpay, transferencia y Mercado Pago</span>
            <span className="text-ink-600">·</span>
            <span>Reposición gratis en los packs marcados</span>
            <span className="text-ink-600">·</span>
            <span>Te devolvemos la plata si no llega</span>
          </div>
        </div>

        {/* -------------------------------------------------------- Catálogo */}
        <section id="catalogo" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Lo que más se vende</h2>
            <Link href="/catalogo" className="text-sm text-brand-300 hover:text-white">
              Ver los {all.length} servicios →
            </Link>
          </div>

          <div className="mt-7 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>

          {products.length === 0 ? (
            <p className="mt-8 rounded-xl border border-white/10 bg-white/4 p-6 text-center text-ink-400">
              Aún no hay productos publicados. Entra a <code className="text-brand-300">/admin</code> para publicar los primeros.
            </p>
          ) : null}
        </section>

        {/* ------------------------------------- Cómo funciona + qué no hacemos */}
        <section className="border-y border-white/8 bg-ink-900/40">
          <div className="mx-auto grid max-w-6xl gap-12 px-4 py-14 lg:grid-cols-2">
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Cómo se compra</h2>
              <ol className="mt-6 space-y-5">
                {[
                  ["Eliges el pack", "La red, el servicio y cuántos quieres. Los precios ya están con IVA."],
                  ["Pegas tu usuario", "O el enlace de la publicación, según el servicio. Y tu correo."],
                  ["Pagas", "Webpay, transferencia o Mercado Pago. El pedido sale solo apenas se confirma."],
                  ["Sigues el avance", "Te llega un código tipo TS-7K2F9Q para ver cómo va cuando quieras."],
                ].map(([title, text], i) => (
                  <li key={title} className="flex gap-4">
                    <span className="mt-0.5 font-mono text-sm text-brand-300">0{i + 1}</span>
                    <div>
                      <h3 className="font-semibold">{title}</h3>
                      <p className="mt-1 text-sm leading-relaxed text-ink-400">{text}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>

            {/* Bloque honesto: dice más de nosotros que cualquier lista de beneficios */}
            <div>
              <h2 className="text-2xl font-bold tracking-tight">Lo que no hacemos</h2>
              <ul className="mt-6 space-y-4 text-sm leading-relaxed text-ink-200">
                <li>
                  <strong className="text-white">No te pedimos la clave.</strong> Ni ahora ni después.
                  Si alguna vez te la piden para esto, no es un buen lugar para comprar.
                </li>
                <li>
                  <strong className="text-white">No prometemos que nadie se caiga.</strong> Se cae
                  gente en todas las plataformas. Lo que sí hacemos es reponerla gratis en los packs
                  que lo indican.
                </li>
                <li>
                  <strong className="text-white">No vendemos interacción real.</strong> Esto sube
                  números y da empuje inicial. Los comentarios de verdad los tiene que ganar tu
                  contenido.
                </li>
                <li>
                  <strong className="text-white">No trabajamos con cuentas privadas.</strong> Tiene
                  que estar pública mientras dure la entrega, si no el sistema no llega.
                </li>
              </ul>
              {whatsapp ? (
                <p className="mt-7 text-sm text-ink-400">
                  ¿Dudas antes de pagar?{" "}
                  <a
                    href={`https://wa.me/${whatsapp}`}
                    target="_blank"
                    rel="noopener"
                    className="text-brand-300 hover:text-white"
                  >
                    Escríbenos por WhatsApp
                  </a>
                  , contestamos el mismo día.
                </p>
              ) : (
                <p className="mt-7 text-sm text-ink-400">
                  ¿Dudas antes de pagar?{" "}
                  <a href={`mailto:${settings.contact_email}`} className="text-brand-300 hover:text-white">
                    {settings.contact_email}
                  </a>
                  , contestamos el mismo día.
                </p>
              )}
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- FAQ */}
        <section className="mx-auto max-w-6xl px-4 py-14">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Preguntas que nos hacen siempre</h2>
          <div className="mt-7 max-w-3xl divide-y divide-white/8 border-y border-white/8">
            {HOME_FAQ.map((item) => (
              <details key={item.q} className="group py-4 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold">
                  {item.q}
                  <span className="shrink-0 text-lg leading-none text-ink-400 transition-transform group-open:rotate-45">
                    +
                  </span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-200">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Texto SEO editable desde el panel */}
        {settings.seo_home_text ? (
          <section className="mx-auto max-w-6xl px-4 pb-14">
            <div className="prose-ts max-w-3xl" dangerouslySetInnerHTML={{ __html: sanitizeHtml(settings.seo_home_text) }} />
          </section>
        ) : null}
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd(HOME_FAQ))} />
    </>
  );
}
