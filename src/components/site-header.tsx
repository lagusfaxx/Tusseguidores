import Link from "next/link";
import { getPlatformsWithProducts } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { platformLabel, sortPlatforms } from "@/lib/labels";
import { PlatformIcon } from "./icons";

export function SiteHeader() {
  const settings = getSettings();
  const platforms = sortPlatforms(getPlatformsWithProducts()).slice(0, 7);

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-extrabold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-sm">
            TS
          </span>
          <span className="text-[17px]">
            Tus<span className="text-brand-300">Seguidores</span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Redes sociales">
          {platforms.map((p) => (
            <Link
              key={p.platform}
              href={`/${p.platform}`}
              className="flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-sm text-ink-200 transition-colors hover:bg-white/6 hover:text-white"
            >
              <PlatformIcon slug={p.platform} className="h-4 w-4" />
              {platformLabel(p.platform)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 lg:ml-0">
          <Link href="/seguimiento" className="hidden rounded-lg px-3 py-2 text-sm text-ink-200 hover:text-white sm:block">
            Mi pedido
          </Link>
          <Link href="/#catalogo" className="btn btn-primary px-4 py-2 text-sm">
            Comprar ahora
          </Link>
        </div>
      </div>

      {/* Menú de redes en móvil: scroll horizontal, sin JavaScript */}
      <div className="flex gap-1.5 overflow-x-auto border-t border-white/6 px-4 py-2 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {sortPlatforms(getPlatformsWithProducts()).map((p) => (
          <Link
            key={p.platform}
            href={`/${p.platform}`}
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs text-ink-200"
          >
            <PlatformIcon slug={p.platform} className="h-3.5 w-3.5" />
            {platformLabel(p.platform)}
          </Link>
        ))}
      </div>
      <span className="sr-only">{settings.site_tagline}</span>
    </header>
  );
}
