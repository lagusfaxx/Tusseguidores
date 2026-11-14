import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import {
  getFeaturedProducts, getPlatformServiceTypes, getPlatformsWithProducts,
  getPublishedProducts, cheapestTier, groupByServiceType,
} from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { platformAccent, platformLabel, serviceTypeLabel, sortPlatforms } from "@/lib/labels";
import { formatClp } from "@/lib/pricing";
import { buildMetadata, faqLd, jsonLd } from "@/lib/seo";
import { BoltIcon, CheckIcon, LockIcon, PlatformIcon, ShieldIcon } from "@/components/icons";
import { sanitizeHtml } from "@/lib/utils";
import { textoDePortada } from "@/lib/seo-text";
import { getBoolSetting } from "@/lib/settings";
import { LeerMas } from "@/components/leer-mas";
import { Stars } from "@/components/stars";
import { storeRating } from "@/lib/ratings";
import { SelectorRed, type RedDelSelector } from "@/components/selector-red";
import { cantidadDePrueba, pruebaDisponible } from "@/lib/prueba";

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
    a: "No hemos tenido casos. Nunca entramos a tu cuenta ni te pedimos la clave. Eso sí: no pidas 10.000 seguidores para una cuenta que tiene 200, se nota.",
  },
  {
    q: "¿Cuánto se demora?",
    a: "La mayoría parte antes de 10 minutos. Cada producto dice su tiempo estimado arriba del botón de pago.",
  },
  {
    q: "¿Con qué puedo pagar?",
    a: "Webpay, transferencia y Mercado Pago, todo por Flow. Los datos de tu tarjeta no pasan por nosotros.",
  },
  {
    q: "¿Los seguidores se caen?",
    a: "Algunos sí, pasa en todas las plataformas. Los packs con reposición los reponemos gratis dentro del plazo que indican. Si tu pedido no llega, te devolvemos la plata.",
  },
  {
    q: "¿Necesito tener la cuenta pública?",
    a: "Sí, durante toda la entrega. Si la pones privada a mitad de camino el pedido queda incompleto.",
  },
  {
    q: "Me equivoqué en el enlace",
    a: "Escríbenos altiro con tu código. Si todavía no sale a entrega lo corregimos; si ya salió, no hay vuelta atrás.",
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

  const redes: RedDelSelector[] = platforms.map((p) => {
    const label = platformLabel(p.platform);
    const items = groupByServiceType(all.filter((x) => x.platform === p.platform)).flatMap((g) => g.items);
    return {
      slug: p.platform,
      label,
      color: platformAccent(p.platform),
      total: items.length,
      items: items.slice(0, 5).map((x) => {
        const tier = cheapestTier(x);
        return {
          slug: x.slug,
          name: x.name.replace(` para ${label}`, ""),
          price: tier ? formatClp(tier.priceClp) : "—",
          entrega: x.delivery_label,
        };
      }),
    };
  });

  const rating = storeRating();
  const prueba = pruebaDisponible() ? cantidadDePrueba() : 0;
  // Las combinaciones red + servicio que la gente busca por su nombre
  // ("seguidores instagram"). Cada una tiene su página y desde aquí recibe el
  // enlace que necesita para que Google la encuentre y la entienda.
  const buscados = getPlatformServiceTypes().slice(0, 12);

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
          <div className="mx-auto max-w-6xl px-4 pb-10 pt-9 sm:pb-16 sm:pt-16">
            <div className="grid items-start gap-8 lg:grid-cols-[1fr_1fr] lg:gap-14">
              <div className="max-w-xl lg:pt-6">
                <p className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-ink-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
                  Tienda chilena · precios con IVA
                </p>

                <h1 className="mt-4 text-[2.6rem] font-extrabold leading-[1.02] sm:text-6xl">
                  Seguidores, likes y vistas.{" "}
                  <span className="whitespace-nowrap text-lime-400">Al tiro.</span>
                </h1>

                <p className="mt-4 text-lg leading-relaxed text-ink-200">
                  Pagas en pesos y empiezan a llegar en minutos.
                </p>

                {rating ? <Stars rating={rating} tamano="md" className="mt-5" /> : null}

                <ul className="mt-6 grid max-w-md grid-cols-2 gap-x-6 gap-y-2.5 text-sm text-ink-200">
                  {[
                    [<LockIcon key="i" className="h-4 w-4" />, "Sin contraseñas"],
                    [<BoltIcon key="i" className="h-4 w-4" />, "Entrega en minutos"],
                    [<ShieldIcon key="i" className="h-4 w-4" />, "Reposición gratis"],
                    [<CheckIcon key="i" className="h-4 w-4" />, `Desde ${formatClp(desde)}`],
                  ].map(([icono, titulo]) => (
                    <li key={String(titulo)} className="flex items-center gap-2">
                      <span className="shrink-0 text-lime-400">{icono}</span>
                      {titulo}
                    </li>
                  ))}
                </ul>

                <div className="mt-7 flex flex-wrap items-center gap-3">
                  <Link href="/catalogo" className="btn btn-primary hidden text-base lg:inline-flex">
                    Ver los {all.length} servicios
                  </Link>
                  {prueba ? (
                    <Link href="/prueba-gratis" className="btn btn-ghost border-lime-400/50 text-base">
                      <span className="rounded bg-lime-400 px-1.5 py-0.5 text-[11px] font-bold uppercase text-ink-950">Gratis</span>
                      Probar con {prueba} seguidores
                    </Link>
                  ) : (
                    <Link href="/seguimiento" className="btn btn-ghost hidden text-base lg:inline-flex">
                      Seguir mi pedido
                    </Link>
                  )}
                </div>
              </div>

              <SelectorRed redes={redes} />
            </div>
          </div>
        </section>

        {/* -------------------------------------------------------- Catálogo */}
        <section id="catalogo" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-12 sm:py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Lo más vendido</h2>
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

        {/* ------------------------------------------------- Panel mayorista */}
        {getBoolSetting("reseller_enabled", true) ? (
          <section className="mx-auto max-w-6xl px-4 pb-12 sm:pb-16">
            <div className="card relative overflow-hidden border-brand-400/30 p-6 sm:p-8">
              <div className="pointer-events-none absolute -right-20 -top-20 h-64 w-64 rounded-full bg-brand-500/20 blur-3xl" />
              <div className="relative grid gap-6 lg:grid-cols-[1.3fr_1fr] lg:items-center">
                <div>
                  <span className="rounded-full bg-brand-500/20 px-2.5 py-1 text-xs font-semibold text-brand-300">
                    Para agencias y revendedores
                  </span>
                  <h2 className="mt-4 text-2xl font-bold tracking-tight sm:text-3xl">
                    Los mismos servicios, a precio de reventa
                  </h2>
                  <p className="mt-3 text-ink-200">
                    Cargas saldo una vez y pides sin pagar en cada pedido.
                  </p>
                  <div className="mt-6 flex flex-wrap gap-3">
                    <Link href="/panel/crear-cuenta" className="btn btn-primary">Crear cuenta gratis</Link>
                    <Link href="/panel/entrar" className="btn btn-ghost">Ya tengo cuenta</Link>
                  </div>
                </div>
                <ul className="grid gap-2 text-sm">
                  {[
                    ["Precio por cada 1.000", "Más bajo que en la tienda."],
                    ["Pago con saldo", "Webpay o transferencia."],
                    ["Catálogo completo", "No solo los packs."],
                    ["Soporte por ticket", "Uno por pedido."],
                  ].map(([titulo, texto]) => (
                    <li key={titulo} className="rounded-xl border border-white/8 bg-white/3 px-4 py-3">
                      <p className="font-semibold text-white">{titulo}</p>
                      <p className="mt-0.5 text-ink-400">{texto}</p>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        ) : null}

        {/* ------------------------------------- Cómo funciona + qué no hacemos */}
        <section className="border-y border-white/8 bg-ink-900/40">
          <div className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
            <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Cómo se compra</h2>
            <ol className="mt-7 grid grid-cols-2 gap-3 sm:gap-4 lg:grid-cols-4">
              {[
                ["Eliges el pack", "Red, servicio y cantidad."],
                ["Pegas tu usuario", "O el enlace de la publicación."],
                ["Pagas", "Webpay, transferencia o Mercado Pago."],
                ["Sigues el avance", "Con tu código de pedido."],
              ].map(([title, text], i) => (
                <li key={title} className="card h-full p-4 sm:p-5">
                  <span className="inline-grid h-7 w-7 place-items-center rounded-lg bg-lime-400 font-mono text-xs font-bold text-ink-950">
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
                    ["No te pedimos la clave.", "Ni ahora ni después."],
                    ["No prometemos que nadie se caiga.", "Pasa en todas las plataformas. Por eso reponemos gratis en los packs que lo indican."],
                    ["No vendemos interacción real.", "Esto sube números. Los comentarios los gana tu contenido."],
                    ["No trabajamos con cuentas privadas.", "Tiene que estar pública mientras dure la entrega."],
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
                <p className="mt-2 text-sm text-ink-400">Respondemos el mismo día.</p>
                <div className="mt-5 flex flex-wrap gap-2">
                  <Link href="/soporte" className="btn btn-ghost text-sm">Abrir un ticket</Link>
                  <Link href="/preguntas-frecuentes" className="btn btn-ghost text-sm">
                    Preguntas frecuentes
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------------- FAQ */}
        <section className="mx-auto max-w-6xl px-4 py-12 sm:py-16">
          <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Preguntas frecuentes</h2>
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

        {/* ------------------------------------------------ Lo más buscado */}
        {buscados.length ? (
          <section className="border-t border-white/8 bg-ink-900/40">
            <div className="mx-auto max-w-6xl px-4 py-12 sm:py-14">
              <h2 className="text-2xl font-bold tracking-tight sm:text-3xl">Lo más buscado</h2>
              <ul className="mt-6 flex flex-wrap gap-2">
                {buscados.map((c) => (
                  <li key={`${c.platform}-${c.service_type}`}>
                    <Link
                      href={`/${c.platform}/${c.service_type}`}
                      className="inline-block rounded-full border border-white/12 bg-white/5 px-3.5 py-2 text-sm text-ink-200 transition-colors hover:border-brand-400/50 hover:text-white"
                    >
                      Comprar {serviceTypeLabel(c.service_type).toLowerCase()}{" "}
                      {platformLabel(c.platform)}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          </section>
        ) : null}

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
