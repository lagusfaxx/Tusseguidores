import Link from "next/link";
import { getPlatformsWithProducts } from "@/lib/catalog";
import { getSettings, getBoolSetting } from "@/lib/settings";
import { platformAccent, platformLabel, sortPlatforms } from "@/lib/labels";
import { pruebaDisponible } from "@/lib/prueba";
import { HeaderNav } from "./header-nav";

export function SiteHeader() {
  const settings = getSettings();
  const redes = sortPlatforms(getPlatformsWithProducts()).map((p) => ({
    slug: p.platform,
    label: platformLabel(p.platform),
    color: platformAccent(p.platform),
    products: p.products,
  }));

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-ink-950/90 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-extrabold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime-400 text-sm text-ink-950">
            TS
          </span>
          <span className="font-display text-[18px]">
            Tus<span className="text-lime-400">Seguidores</span>
          </span>
        </Link>

        <HeaderNav
          redes={redes}
          mayorista={getBoolSetting("reseller_enabled", true)}
          prueba={pruebaDisponible()}
        />
      </div>
      <span className="sr-only">{settings.site_tagline}</span>
    </header>
  );
}
