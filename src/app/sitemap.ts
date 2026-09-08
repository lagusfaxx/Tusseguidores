import type { MetadataRoute } from "next";
import { all } from "@/lib/db";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default function sitemap(): MetadataRoute.Sitemap {
  const base = siteUrl();
  const now = new Date();

  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/catalogo`, lastModified: now, changeFrequency: "daily", priority: 0.9 },
    { url: `${base}/preguntas-frecuentes`, lastModified: now, changeFrequency: "monthly", priority: 0.5 },
    { url: `${base}/terminos`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${base}/privacidad`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];

  const platforms = all<{ platform: string }>(
    `SELECT DISTINCT p.platform FROM products p
       JOIN provider_services s ON s.service_id = p.provider_service_id
      WHERE p.published = 1 AND s.provider_enabled = 1`,
  ).map((row) => ({
    url: `${base}/${row.platform}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.8,
  }));

  const categorias = all<{ platform: string; service_type: string }>(
    `SELECT DISTINCT p.platform, p.service_type FROM products p
       JOIN provider_services s ON s.service_id = p.provider_service_id
      WHERE p.published = 1 AND p.noindex = 0 AND s.provider_enabled = 1`,
  ).map((row) => ({
    // Las páginas de categoría ("/instagram/seguidores") son las que responden
    // a la búsqueda concreta, así que van con más prioridad que la red entera.
    url: `${base}/${row.platform}/${row.service_type}`,
    lastModified: now,
    changeFrequency: "weekly" as const,
    priority: 0.85,
  }));

  const products = all<{ slug: string; updated_at: string }>(
    `SELECT p.slug, p.updated_at FROM products p
       JOIN provider_services s ON s.service_id = p.provider_service_id
      WHERE p.published = 1 AND p.noindex = 0 AND s.provider_enabled = 1`,
  ).map((row) => ({
    url: `${base}/producto/${row.slug}`,
    lastModified: new Date(row.updated_at.replace(" ", "T") + "Z"),
    changeFrequency: "weekly" as const,
    priority: 0.7,
  }));

  return [...staticPages, ...platforms, ...categorias, ...products];
}
