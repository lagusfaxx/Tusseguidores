import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/seo";

export const dynamic = "force-dynamic";

export default function robots(): MetadataRoute.Robots {
  const base = siteUrl();
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin", "/admin/", "/api/", "/pedido/", "/pago/", "/seguimiento",
          // El buscador devuelve las mismas fichas con otra URL: que Google
          // gaste el rastreo en las páginas que sí queremos posicionar.
          "/buscar",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
