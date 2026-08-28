import type { Metadata, Viewport } from "next";
import Script from "next/script";
import "./globals.css";
import { getSettings } from "@/lib/settings";
import { jsonLd, organizationLd, siteUrl, websiteLd } from "@/lib/seo";

export const dynamic = "force-dynamic";

export function generateMetadata(): Metadata {
  const s = getSettings();
  return {
    metadataBase: new URL(siteUrl()),
    title: {
      default: s.seo_home_title,
      template: `%s | ${s.site_name}`,
    },
    description: s.seo_home_description,
    applicationName: s.site_name,
    authors: [{ name: s.site_name }],
    creator: s.site_name,
    verification: s.google_site_verification ? { google: s.google_site_verification } : undefined,
    formatDetection: { telephone: false },
    icons: { icon: "/icon.svg", apple: "/icon.svg" },
    alternates: { canonical: siteUrl() },
  };
}

export const viewport: Viewport = {
  themeColor: "#08060f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const s = getSettings();
  return (
    <html lang="es-CL">
      <body className="min-h-screen bg-ink-950 antialiased">
        <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd([organizationLd(), websiteLd()])} />
        {children}
        {s.google_analytics_id ? (
          <>
            <Script
              src={`https://www.googletagmanager.com/gtag/js?id=${s.google_analytics_id}`}
              strategy="afterInteractive"
            />
            <Script id="ga" strategy="afterInteractive">
              {`window.dataLayer=window.dataLayer||[];function gtag(){dataLayer.push(arguments);}gtag('js',new Date());gtag('config','${s.google_analytics_id}');`}
            </Script>
          </>
        ) : null}
      </body>
    </html>
  );
}
