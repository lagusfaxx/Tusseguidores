import Link from "next/link";
import { getPlatformsWithProducts } from "@/lib/catalog";
import { getSettings, getBoolSetting } from "@/lib/settings";
import { platformLabel, sortPlatforms } from "@/lib/labels";
import { PlatformIcon } from "./icons";

export function SiteHeader() {
  const settings = getSettings();
  const platforms = sortPlatforms(getPlatformsWithProducts()).slice(0, 4);

  return (
    <header className="sticky top-0 z-40 border-b border-white/8 bg-ink-950/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-extrabold tracking-tight">
          <span className="grid h-8 w-8 place-items-center rounded-lg bg-lime-400 text-sm text-ink-950">
            TS
          </span>
          <span className="font-display text-[18px]">
            Tus<span className="text-lime-400">Seguidores</span>
          </span>
        </Link>

        <nav className="ml-auto hidden items-center gap-1 lg:flex" aria-label="Redes sociales">
          {platforms.map((p) => (
            <Link
              key={p.platform}
              href={`/${p.platform}`}
              className="flex items-center gap-1.5 whitespace-nowrap rounded-lg px-2.5 py-2 text-sm text-ink-200 transition-colors hover:bg-white/6 hover:text-white"
            >
              <PlatformIcon slug={p.platform} className="h-4 w-4" />
              {platformLabel(p.platform)}
            </Link>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-1.5 lg:ml-0">
          <Link
            href="/buscar"
            aria-label="Buscar"
            className="grid h-9 w-9 place-items-center rounded-lg text-ink-200 transition-colors hover:bg-white/6 hover:text-white"
          >
            <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
              <circle cx="11" cy="11" r="7" />
              <path d="m20 20-3.5-3.5" />
            </svg>
          </Link>
          <Link
            href="/seguimiento"
            className="hidden whitespace-nowrap rounded-lg px-2.5 py-2 text-sm text-ink-200 hover:text-white sm:block"
          >
            Mi pedido
          </Link>
          <Link
            href="/soporte"
            className="hidden whitespace-nowrap rounded-lg px-2.5 py-2 text-sm text-ink-200 hover:text-white xl:block"
          >
            Soporte
          </Link>
          {getBoolSetting("reseller_enabled", true) ? (
            <Link
              href="/panel"
              className="hidden whitespace-nowrap rounded-lg border border-brand-400/40 bg-brand-500/15 px-3 py-1.5 text-sm font-semibold text-brand-300 transition-colors hover:bg-brand-500/25 hover:text-white sm:block"
              title="Precios de reventa con saldo"
            >
              Panel mayorista
            </Link>
          ) : null}
          <Link href="/catalogo" className="btn btn-primary whitespace-nowrap px-4 py-2 text-sm">
            Ver precios
          </Link>
        </div>
      </div>

      {/* Menú de redes en móvil: scroll horizontal, sin JavaScript */}
      <div className="flex gap-1.5 overflow-x-auto border-t border-white/6 px-4 py-2 lg:hidden [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        {/* El panel mayorista va primero y marcado: en el menú de arriba no
            cabe en teléfono, y sin esto no existe para quien entra del celular. */}
        {getBoolSetting("reseller_enabled", true) ? (
          <Link
            href="/panel"
            className="flex shrink-0 items-center gap-1.5 rounded-full border border-brand-400/40 bg-brand-500/15 px-3 py-1.5 text-xs font-semibold text-brand-300 sm:hidden"
          >
            Panel mayorista
          </Link>
        ) : null}
        <Link
          href="/seguimiento"
          className="flex shrink-0 items-center rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs text-ink-200 sm:hidden"
        >
          Mi pedido
        </Link>
        <Link
          href="/soporte"
          className="flex shrink-0 items-center rounded-full border border-white/10 bg-white/4 px-3 py-1.5 text-xs text-ink-200"
        >
          Soporte
        </Link>
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
