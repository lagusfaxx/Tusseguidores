import type { Metadata } from "next";
import { getSetting, getSettings } from "./settings";

export function siteUrl(): string {
  return (getSetting("site_url", "https://tusseguidores.cl") || "https://tusseguidores.cl").replace(/\/+$/, "");
}

export function absoluteUrl(path = "/"): string {
  return `${siteUrl()}${path.startsWith("/") ? path : `/${path}`}`;
}

type PageSeo = {
  title: string;
  description: string;
  path: string;
  keywords?: string | null;
  image?: string | null;
  noindex?: boolean;
};

export function buildMetadata({ title, description, path, keywords, image, noindex }: PageSeo): Metadata {
  const s = getSettings();
  const url = absoluteUrl(path);
  // Un SVG no sirve como imagen de Open Graph: si el producto solo tiene su
  // portada SVG, generamos un PNG con la ruta /api/og.
  const usable = image && !image.endsWith(".svg") ? image : null;
  const ogImage = usable
    ? (usable.startsWith("http") ? usable : absoluteUrl(usable))
    : absoluteUrl(`/api/og?t=${encodeURIComponent(title.split("|")[0].trim())}&s=${encodeURIComponent(description.slice(0, 90))}`);

  return {
    title,
    description,
    keywords: keywords ? keywords.split(",").map((k) => k.trim()).filter(Boolean) : undefined,
    alternates: { canonical: url },
    robots: noindex
      ? { index: false, follow: false }
      : { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
    openGraph: {
      type: "website",
      url,
      siteName: s.site_name,
      title,
      description,
      locale: "es_CL",
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: "summary_large_image", title, description, images: [ogImage] },
  };
}

/** Etiqueta <script type="application/ld+json"> lista para insertar. */
export function jsonLd(data: Record<string, unknown> | Record<string, unknown>[]) {
  return {
    __html: JSON.stringify(data).replace(/</g, "\\u003c"),
  };
}

export function organizationLd() {
  const s = getSettings();
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: s.site_name,
    url: siteUrl(),
    logo: absoluteUrl("/icon.svg"),
    email: s.contact_email,
    areaServed: "CL",
    sameAs: [] as string[],
  };
}

export function websiteLd() {
  const s = getSettings();
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: s.site_name,
    url: siteUrl(),
    inLanguage: "es-CL",
    potentialAction: {
      "@type": "SearchAction",
      target: { "@type": "EntryPoint", urlTemplate: `${siteUrl()}/buscar?q={search_term_string}` },
      "query-input": "required name=search_term_string",
    },
  };
}

export function breadcrumbLd(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: absoluteUrl(item.path),
    })),
  };
}

export function faqLd(items: { q: string; a: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: items.map((item) => ({
      "@type": "Question",
      name: item.q,
      acceptedAnswer: { "@type": "Answer", text: item.a },
    })),
  };
}
