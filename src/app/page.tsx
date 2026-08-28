import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { getFeaturedProducts, getPlatformsWithProducts, getPublishedProducts } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { platformLabel, sortPlatforms } from "@/lib/labels";
import { buildMetadata, faqLd, jsonLd } from "@/lib/seo";
import { BoltIcon, CheckIcon, ChatIcon, LockIcon, PlatformIcon, ShieldIcon } from "@/components/icons";
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
    q: "¿Es seguro comprar seguidores en Chile?",
    a: "Sí. No pedimos tu contraseña ni acceso a tu cuenta: solo el usuario o el enlace público. La entrega se hace desde fuera de tu cuenta, así que no hay riesgo de bloqueo por darnos acceso.",
  },
  {
    q: "¿Cuánto demora la entrega?",
    a: "La mayoría de los pedidos empieza en menos de 10 minutos desde que Flow confirma el pago. El tiempo total depende del servicio y la cantidad; cada pack indica su plazo estimado.",
  },
  {
    q: "¿Qué medios de pago aceptan?",
    a: "Pagas con Flow: tarjetas de crédito y débito por Webpay, transferencia bancaria y Mercado Pago. Todos los precios están en pesos chilenos.",
  },
  {
    q: "¿Puedo seguir mi pedido?",
    a: "Sí. Al pagar recibes un código de pedido. Con ese código puedes ver el avance en cualquier momento desde la sección «Mi pedido».",
  },
  {
    q: "¿Qué pasa si los seguidores bajan?",
    a: "Los productos con reposición incluida la reponen sin costo dentro del plazo indicado. Si un pedido no se entrega, te devolvemos el dinero.",
  },
];

export default function HomePage() {
  const settings = getSettings();
  const featured = getFeaturedProducts(8);
  const all = getPublishedProducts();
  const products = featured.length ? featured : all.slice(0, 8);
  const platforms = sortPlatforms(getPlatformsWithProducts());

  return (
    <>
      <SiteHeader />
      <main>
        {/* ---------------------------------------------------------- Hero */}
        <section className="bg-halo relative overflow-hidden">
          <div className="mx-auto max-w-6xl px-4 pb-16 pt-16 sm:pt-24">
            <div className="grid items-center gap-12 lg:grid-cols-[1.05fr_0.95fr]">
              <div>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/12 bg-white/5 px-3 py-1.5 text-xs font-semibold text-ink-200">
                  <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
                  Entrega automática · Pago en pesos chilenos
                </span>

                <h1 className="mt-5 text-4xl font-extrabold leading-[1.08] tracking-tight sm:text-5xl lg:text-6xl">
                  Haz crecer tus redes{" "}
                  <span className="bg-gradient-to-r from-brand-300 via-accent-400 to-lime-400 bg-clip-text text-transparent">
                    hoy mismo
                  </span>
                </h1>

                <p className="mt-5 max-w-xl text-lg leading-relaxed text-ink-200">
                  Seguidores, me gusta y visualizaciones para Instagram, TikTok, YouTube y más.
                  Eliges el pack, pagas con Webpay o transferencia y la entrega parte sola.
                  Sin contraseñas y sin esperas.
                </p>

                <div className="mt-8 flex flex-wrap gap-3">
                  <Link href="#catalogo" className="btn btn-primary text-base">
                    Ver precios
                  </Link>
                  <Link href="/seguimiento" className="btn btn-ghost text-base">
                    Seguir mi pedido
                  </Link>
                </div>

                <ul className="mt-8 grid gap-2.5 text-sm text-ink-200 sm:grid-cols-2">
                  {[
                    "Nunca pedimos tu contraseña",
                    "Pago seguro con Flow y Webpay",
                    "Soporte real, en español",
                    "Reposición incluida en los packs marcados",
                  ].map((item) => (
                    <li key={item} className="flex items-center gap-2">
                      <CheckIcon className="h-4 w-4 shrink-0 text-lime-400" />
                      {item}
                    </li>
                  ))}
                </ul>
              </div>

              {/* Redes disponibles */}
              <div className="card p-6 sm:p-8">
                <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
                  Elige tu red social
                </h2>
                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                  {platforms.map((p) => (
                    <Link
                      key={p.platform}
                      href={`/${p.platform}`}
                      className="group flex flex-col items-center gap-2 rounded-xl border border-white/8 bg-white/4 px-3 py-4 text-center transition-colors hover:border-brand-400/50 hover:bg-white/8"
                    >
                      <PlatformIcon slug={p.platform} className="h-7 w-7 text-brand-300 transition-colors group-hover:text-accent-400" />
                      <span className="text-xs font-semibold">{platformLabel(p.platform)}</span>
                      <span className="text-[10px] text-ink-400">{p.products} servicios</span>
                    </Link>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ------------------------------------------------------ Confianza */}
        <section className="border-y border-white/6 bg-ink-900/40">
          <div className="mx-auto grid max-w-6xl gap-6 px-4 py-10 sm:grid-cols-2 lg:grid-cols-4">
            {[
              { icon: BoltIcon, title: "Entrega en minutos", text: "El pedido se envía solo apenas se confirma el pago." },
              { icon: LockIcon, title: "Sin contraseñas", text: "Solo necesitamos tu usuario o el enlace público." },
              { icon: ShieldIcon, title: "Reposición incluida", text: "Los packs con garantía reponen sin costo si bajan." },
              { icon: ChatIcon, title: "Soporte en Chile", text: "Te respondemos por WhatsApp y correo, en español." },
            ].map(({ icon: Icon, title, text }) => (
              <div key={title} className="flex gap-3">
                <Icon className="h-6 w-6 shrink-0 text-brand-300" />
                <div>
                  <h3 className="text-sm font-bold">{title}</h3>
                  <p className="mt-1 text-sm leading-relaxed text-ink-400">{text}</p>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* -------------------------------------------------------- Catálogo */}
        <section id="catalogo" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-16">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <div>
              <h2 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Los más pedidos</h2>
              <p className="mt-2 text-ink-400">Packs listos para comprar en menos de un minuto.</p>
            </div>
            <Link href="/catalogo" className="btn btn-ghost text-sm">
              Ver todo el catálogo
            </Link>
          </div>

          <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
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

        {/* ------------------------------------------------------ Cómo funciona */}
        <section className="border-y border-white/6 bg-ink-900/40">
          <div className="mx-auto max-w-6xl px-4 py-16">
            <h2 className="text-3xl font-extrabold tracking-tight">Comprar toma menos de un minuto</h2>
            <ol className="mt-10 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
              {[
                ["Elige el pack", "Selecciona la red, el servicio y la cantidad que necesitas."],
                ["Pega tu enlace", "Tu usuario o el enlace de la publicación. Nada más."],
                ["Paga con Flow", "Webpay, transferencia o Mercado Pago. Precios en pesos."],
                ["Recibe tu pedido", "La entrega empieza sola y sigues el avance con tu código."],
              ].map(([title, text], i) => (
                <li key={title} className="card p-6">
                  <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 font-bold">
                    {i + 1}
                  </span>
                  <h3 className="mt-4 font-bold">{title}</h3>
                  <p className="mt-1.5 text-sm leading-relaxed text-ink-400">{text}</p>
                </li>
              ))}
            </ol>
          </div>
        </section>

        {/* ------------------------------------------------------------- FAQ */}
        <section className="mx-auto max-w-3xl px-4 py-16">
          <h2 className="text-3xl font-extrabold tracking-tight">Preguntas frecuentes</h2>
          <div className="mt-8 space-y-3">
            {HOME_FAQ.map((item) => (
              <details key={item.q} className="card group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold">
                  {item.q}
                  <span className="text-brand-300 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-200">{item.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* Texto SEO editable desde el panel */}
        {settings.seo_home_text ? (
          <section className="mx-auto max-w-3xl px-4 pb-16">
            <div className="prose-ts" dangerouslySetInnerHTML={{ __html: sanitizeHtml(settings.seo_home_text) }} />
          </section>
        ) : null}
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd(HOME_FAQ))} />
    </>
  );
}
