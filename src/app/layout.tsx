import type { Metadata, Viewport } from "next";
import Script from "next/script";
import localFont from "next/font/local";
import "./globals.css";

// Títulos. El archivo va en el repo: el build no depende de Google Fonts.
const display = localFont({
  src: "./fonts/bricolage-grotesque.woff2",
  variable: "--font-bricolage",
  weight: "200 800",
  display: "swap",
});
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
  themeColor: "#09090e",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const s = getSettings();
  return (
    <html lang="es-CL" className={display.variable}>
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
