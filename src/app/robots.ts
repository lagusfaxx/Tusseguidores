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
        disallow: ["/admin", "/admin/", "/api/", "/pedido/", "/pago/", "/seguimiento"],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
    host: base,
  };
}
