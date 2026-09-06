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
import { BoltIcon, CheckIcon, LockIcon, PlatformIcon, ShieldIcon } from "@/components/icons";
import { sanitizeHtml } from "@/lib/utils";
import { textoDePortada } from "@/lib/seo-text";
import { getBoolSetting } from "@/lib/settings";
import { LeerMas } from "@/components/leer-mas";

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

  const cuerpoSeo = settings.seo_home_text
    ? sanitizeHtml(settings.seo_home_text)
    : getBoolSetting("auto_seo_text", true)
      ? textoDePortada()
      : null;

  return (
    <>
      <SiteHeader />
      <main>
        {/* ---------------------------------------------------------- Hero */}
        <section className="bg-halo border-b border-white/8">
          <div className="mx-auto max-w-6xl px-4 pb-12 pt-12 sm:pb-16 sm:pt-20">
            <div className="grid items-center gap-10 lg:grid-cols-[1.05fr_0.95fr] lg:gap-16">
              <div className="max-w-xl">
                <p className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-semibold text-ink-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
                  Tienda chilena · precios en pesos con IVA
                </p>

                <h1 className="mt-5 text-pretty text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl">
                  Seguidores, likes y vistas para tus redes.{" "}
                  <span className="whitespace-nowrap text-accent-400">Al tiro.</span>
                </h1>

                <p className="mt-5 text-lg leading-relaxed text-ink-200">
                  Eliges cuántos quieres, pagas con Webpay o transferencia y empiezan a llegar
                  en minutos. No te pedimos la clave: con tu usuario basta.
                </p>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link href="#catalogo" className="btn btn-primary text-base">
                    Ver precios
                  </Link>
                  <Link href="/seguimiento" className="btn btn-ghost text-base">
                    Seguir mi pedido
                  </Link>
                </div>

                {/* Tres datos duros, cada uno en su columna: la línea corrida de
                    antes se leía como una nota al pie. */}
                <dl className="mt-9 grid max-w-md grid-cols-3 gap-4 border-t border-white/8 pt-6">
                  {[
                    ["Desde", formatClp(desde)],
                    ["Servicios", String(all.length)],
                    ["Redes", String(platforms.length)],
                  ].map(([etiqueta, valor]) => (
                    <div key={etiqueta}>
                      <dt className="text-xs uppercase tracking-wider text-ink-400">{etiqueta}</dt>
                      <dd className="mt-1 text-xl font-extrabold tracking-tight text-white">{valor}</dd>
                    </div>
                  ))}
                </dl>
              </div>

              {/* Selector de red. En móvil basta con el de la cabecera. */}
              <div className="hidden lg:block">
                <div className="card p-5">
                  <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
                    Ir directo a tu red
                  </h2>
                  <div className="mt-4 grid grid-cols-2 gap-2">
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
                        <span className="ml-auto text-xs text-ink-400">{p.products}</span>
                      </Link>
                    ))}
                  </div>
                  <Link
                    href="/catalogo"
                    className="mt-4 flex items-center justify-center rounded-lg border border-white/10 bg-white/4 py-2.5 text-sm font-semibold text-ink-200 transition-colors hover:border-brand-400/50 hover:text-white"
                  >
                    Ver el catálogo completo
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* Cuatro promesas concretas, en columnas del mismo ancho. */}
        <div className="border-b border-white/8 bg-ink-900/50">
          <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-5 px-4 py-6 lg:grid-cols-4">
            {[
              [<LockIcon key="i" className="h-4 w-4" />, "Sin contraseñas", "Solo tu usuario o el enlace."],
              [<BoltIcon key="i" className="h-4 w-4" />, "Entrega en minutos", "Sale solo apenas se paga."],
              [<ShieldIcon key="i" className="h-4 w-4" />, "Reposición gratis", "En los packs que la indican."],
              [<CheckIcon key="i" className="h-4 w-4" />, "Pago seguro", "Webpay, transferencia y Mercado Pago."],
            ].map(([icono, titulo, texto]) => (
              <div key={String(titulo)} className="flex gap-2.5">
                <span className="mt-0.5 shrink-0 text-brand-300">{icono}</span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold leading-tight text-white">{titulo}</p>
                  <p className="mt-0.5 text-xs leading-relaxed text-ink-400">{texto}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* -------------------------------------------------------- Catálogo */}
        <section id="catalogo" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Lo que más se vende</h2>
              <p className="mt-2 max-w-xl text-sm text-ink-400">
                Los packs que más salen, con su precio final y el tiempo de entrega real del
                servicio que vamos a usar.
              </p>
            </div>
            <Link
              href="/catalogo"
              className="hidden shrink-0 items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3.5 py-2 text-sm font-semibold text-ink-200 transition-colors hover:border-brand-400/50 hover:text-white sm:inline-flex"
            >
              Ver los {all.length} servicios →
            </Link>
          </div>

          <div className="mt-5 grid gap-3 sm:mt-7 sm:grid-cols-2 sm:gap-5 lg:grid-cols-4">
            {products.map((product, i) => (
              /* Cuatro en teléfono; el resto está a un toque en el catálogo. */
              <div key={product.id} className={"h-full " + (i >= 4 ? "hidden sm:block" : "")}>
                <ProductCard product={product} />
              </div>
            ))}
          </div>

          <Link
            href="/catalogo"
            className="mt-4 flex items-center justify-center rounded-xl border border-white/12 bg-white/4 px-4 py-3 text-sm font-semibold text-ink-200 sm:hidden"
          >
            Ver los {all.length} servicios
          </Link>

          {products.length === 0 ? (
            <p className="mt-8 rounded-xl border border-white/10 bg-white/4 p-6 text-center text-ink-400">
              Aún no hay productos publicados. Entra a <code className="text-brand-300">/admin</code> para publicar los primeros.
            </p>
          ) : null}
        </section>

        {/* ------------------------------------- Cómo funciona + qué no hacemos */}
        <section className="border-y border-white/8 bg-ink-900/40">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Cómo se compra</h2>
            <ol className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {[
                ["Eliges el pack", "La red, el servicio y cuántos quieres. Los precios ya están con IVA."],
                ["Pegas tu usuario", "O el enlace de la publicación, según el servicio. Y tu correo."],
                ["Pagas", "Webpay, transferencia o Mercado Pago. El pedido sale solo apenas se confirma."],
                ["Sigues el avance", "Te llega un código tipo TS-7K2F9Q para ver cómo va cuando quieras."],
              ].map(([title, text], i) => (
                <li key={title} className="card h-full p-4 sm:p-5">
                  <span className="inline-grid h-7 w-7 place-items-center rounded-lg bg-brand-500/20 font-mono text-xs font-bold text-brand-300">
                    {i + 1}
                  </span>
                  <h3 className="mt-3 text-sm font-semibold sm:text-base">{title}</h3>
                  <p className="mt-1.5 text-[13px] leading-relaxed text-ink-400 sm:text-sm">{text}</p>
                </li>
              ))}
            </ol>

            {/* Bloque honesto: dice más de nosotros que cualquier lista de beneficios */}
            <div className="mt-12 grid gap-8 lg:grid-cols-[1fr_0.8fr] lg:gap-12">
              <div>
                <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Lo que no hacemos</h2>
                <div className="mt-6 grid grid-cols-2 gap-3">
                  {[
                    ["No te pedimos la clave.", "Ni ahora ni después. Si alguna vez te la piden para esto, no es un buen lugar para comprar."],
                    ["No prometemos que nadie se caiga.", "Se cae gente en todas las plataformas. Lo que sí hacemos es reponerla gratis en los packs que lo indican."],
                    ["No vendemos interacción real.", "Esto sube números y da empuje inicial. Los comentarios de verdad los tiene que ganar tu contenido."],
                    ["No trabajamos con cuentas privadas.", "Tiene que estar pública mientras dure la entrega, si no el sistema no llega."],
                  ].map(([titulo, texto]) => (
                    <div key={titulo} className="rounded-xl border border-white/8 bg-white/3 p-3.5 sm:p-4">
                      <p className="text-[13px] font-semibold leading-snug text-white sm:text-sm">{titulo}</p>
                      <p className="mt-1.5 text-[13px] leading-relaxed text-ink-400 sm:text-sm">{texto}</p>
                    </div>
                  ))}
                </div>
              </div>

              <div className="card flex flex-col justify-center p-6">
                <h3 className="text-lg font-bold">¿Dudas antes de pagar?</h3>
                <p className="mt-2 text-sm leading-relaxed text-ink-400">
                  Contestamos el mismo día. Si no sabes qué pack te conviene, cuéntanos tu cuenta y
                  te decimos.
                </p>
                <div className="mt-5 flex flex-wrap gap-2">
                  {whatsapp ? (
                    <a
                      href={`https://wa.me/${whatsapp}`}
                      target="_blank"
                      rel="noopener"
                      className="btn btn-ghost text-sm"
                    >
                      Escríbenos por WhatsApp
                    </a>
                  ) : null}
                  <a href={`mailto:${settings.contact_email}`} className="btn btn-ghost text-sm">
                    {settings.contact_email}
                  </a>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- FAQ */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Preguntas que nos hacen siempre</h2>
          {/* Dos columnas en pantalla grande: en una sola quedaba media
              pantalla vacía a la derecha. */}
          <div className="mt-7 grid gap-x-10 lg:grid-cols-2">
            {HOME_FAQ.map((item) => (
              <details
                key={item.q}
                className="group border-b border-white/8 py-4 [&_summary::-webkit-details-marker]:hidden"
              >
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

        {/* Texto SEO: manual si lo escribiste, generado si no. */}
        {cuerpoSeo ? (
          <section className="mx-auto max-w-6xl border-t border-white/8 px-4 py-12 sm:py-16">
            <LeerMas id="seo-portada" alto="22rem" etiqueta="Leer más" siempre>
              <div className="prose-ts max-w-3xl" dangerouslySetInnerHTML={{ __html: cuerpoSeo }} />
            </LeerMas>
          </section>
        ) : null}
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd(HOME_FAQ))} />
    </>
  );
}
