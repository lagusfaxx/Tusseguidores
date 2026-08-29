import { notFound } from "next/navigation";
import Link from "next/link";
import type { Metadata } from "next";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ProductCard } from "@/components/product-card";
import { PlatformIcon } from "@/components/icons";
import { getPlatformsWithProducts, getProductsByPlatform } from "@/lib/catalog";
import { platformLabel, serviceTypeLabel } from "@/lib/labels";
import { breadcrumbLd, buildMetadata, faqLd, jsonLd } from "@/lib/seo";
import { textoDeRed } from "@/lib/seo-text";
import { getSetting, getBoolSetting } from "@/lib/settings";
import { sanitizeHtml } from "@/lib/utils";

type Params = { params: Promise<{ platform: string }> };

/** Textos de portada por red. Se usan en el <h1> y en la meta description. */
const INTRO: Record<string, string> = {
  instagram: "Seguidores, me gusta, visualizaciones y guardados para Instagram, con entrega automática y sin pedirte la contraseña.",
  tiktok: "Seguidores, me gusta y visualizaciones para TikTok. Elige tu pack, pega el enlace y listo.",
  youtube: "Suscriptores, visualizaciones y me gusta para tu canal de YouTube, con entrega gradual y segura.",
  facebook: "Seguidores, reacciones y visualizaciones para tu página o perfil de Facebook.",
  twitter: "Seguidores, me gusta y visualizaciones para tu cuenta de X (antes Twitter).",
  telegram: "Miembros, vistas y reacciones para tus canales y grupos de Telegram.",
  whatsapp: "Miembros y reacciones para tus canales de WhatsApp.",
  spotify: "Reproducciones y seguidores para tu perfil de artista en Spotify.",
  twitch: "Seguidores y espectadores para tu canal de Twitch.",
  threads: "Seguidores para tu perfil de Threads.",
  linkedin: "Seguidores para tu perfil o página de empresa en LinkedIn.",
};

function known(platform: string): boolean {
  return getPlatformsWithProducts().some((p) => p.platform === platform);
}

export async function generateMetadata({ params }: Params): Promise<Metadata> {
  const { platform } = await params;
  if (!known(platform)) return { title: "Página no encontrada" };
  const label = platformLabel(platform);
  return buildMetadata({
    title: `Comprar seguidores ${label} en Chile | TusSeguidores.cl`,
    description:
      INTRO[platform] ??
      `Compra seguidores, me gusta y visualizaciones para ${label} en Chile. Entrega automática, precios en pesos y pago seguro.`,
    keywords: `comprar seguidores ${label.toLowerCase()}, ${label.toLowerCase()} chile, likes ${label.toLowerCase()}, seguidores ${label.toLowerCase()} baratos`,
    path: `/${platform}`,
  });
}

export default async function PlatformPage({ params }: Params) {
  const { platform } = await params;
  if (!known(platform)) notFound();

  const products = getProductsByPlatform(platform);
  const label = platformLabel(platform);

  // Texto SEO: el que hayas escrito a mano para esta red manda; si no, se
  // genera con los precios y tiempos reales de la tienda.
  const manual = getSetting(`seo_text_${platform}`, "");
  const generado = getBoolSetting("auto_seo_text", true) ? textoDeRed(platform) : null;
  const cuerpoSeo = manual ? sanitizeHtml(manual) : generado?.html ?? null;
  const faqSeo = manual ? [] : generado?.faq ?? [];

  // Agrupamos por tipo de servicio para que la página no sea una lista plana.
  const groups = new Map<string, typeof products>();
  for (const product of products) {
    const list = groups.get(product.service_type) ?? [];
    list.push(product);
    groups.set(product.service_type, list);
  }

  return (
    <>
      <SiteHeader />
      <main className="bg-halo">
        <div className="mx-auto max-w-6xl px-4 py-12">
          <nav aria-label="Ruta de navegación" className="flex items-center gap-1.5 text-xs text-ink-400">
            <Link href="/" className="hover:text-white">Inicio</Link>
            <span>/</span>
            <span className="text-ink-200">{label}</span>
          </nav>

          <div className="mt-6 flex items-start gap-4">
            <span className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-brand-500/30 to-accent-500/25 text-brand-300">
              <PlatformIcon slug={platform} className="h-7 w-7" />
            </span>
            <div>
              <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">
                Comprar seguidores {label}
              </h1>
              <p className="mt-2 max-w-2xl leading-relaxed text-ink-200">
                {INTRO[platform] ?? `Servicios para ${label} con entrega automática y precios en pesos chilenos.`}
              </p>
            </div>
          </div>

          {[...groups.entries()].map(([type, items]) => (
            <section key={type} className="mt-12">
              <h2 className="text-xl font-bold">
                {serviceTypeLabel(type)} para {label}
              </h2>
              <div className="mt-5 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
                {items.map((product) => (
                  <ProductCard key={product.id} product={product} />
                ))}
              </div>
            </section>
          ))}

          {cuerpoSeo ? (
            <section className="mt-16 border-t border-white/8 pt-12">
              <div className="prose-ts max-w-3xl" dangerouslySetInnerHTML={{ __html: cuerpoSeo }} />
            </section>
          ) : null}

          {faqSeo.length ? (
            <section className="mt-12 max-w-3xl">
              <h2 className="text-xl font-bold">Preguntas sobre {label}</h2>
              <div className="mt-5 divide-y divide-white/8 border-y border-white/8">
                {faqSeo.map((item) => (
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

          {products.length === 0 ? (
            <p className="mt-10 rounded-xl border border-white/10 bg-white/4 p-6 text-ink-400">
              Todavía no hay productos publicados para {label}.
            </p>
          ) : null}
        </div>
      </main>
      <SiteFooter />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={jsonLd([
          breadcrumbLd([
            { name: "Inicio", path: "/" },
            { name: label, path: `/${platform}` },
          ]),
          ...(faqSeo.length ? [faqLd(faqSeo)] : []),
        ])}
      />
    </>
  );
}
