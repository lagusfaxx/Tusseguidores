import Link from "next/link";
import { getPlatformsWithProducts } from "@/lib/catalog";
import { getSettings, getBoolSetting } from "@/lib/settings";
import { platformLabel, sortPlatforms } from "@/lib/labels";

export function SiteFooter() {
  const s = getSettings();
  const platforms = sortPlatforms(getPlatformsWithProducts());
  const year = new Date().getFullYear();

  return (
    <footer className="border-t border-white/8 bg-ink-900/60">
      <div className="mx-auto grid max-w-6xl gap-8 px-4 py-10 sm:grid-cols-2 sm:gap-10 sm:py-14 lg:grid-cols-4">
        <div>
          <div className="flex items-center gap-2 font-extrabold">
            <span className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500 text-sm">
              TS
            </span>
            Tus<span className="-ml-2 text-brand-300">Seguidores</span>
          </div>
          <p className="mt-4 text-sm leading-relaxed text-ink-400">{s.site_tagline}.</p>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Redes</h3>
          <ul className="mt-4 space-y-2 text-sm text-ink-400">
            {platforms.slice(0, 8).map((p, i) => (
              /* En teléfono con cuatro redes basta: el resto está en el menú. */
              <li key={p.platform} className={i >= 4 ? "hidden sm:list-item" : ""}>
                <Link href={`/${p.platform}`} className="hover:text-white">
                  Comprar seguidores {platformLabel(p.platform)}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Ayuda</h3>
          <ul className="mt-4 space-y-2 text-sm text-ink-400">
            <li><Link href="/seguimiento" className="hover:text-white">Seguir mi pedido</Link></li>
            <li><Link href="/soporte" className="hover:text-white">Soporte</Link></li>
            {getBoolSetting("reseller_enabled", true) ? (
              <li><Link href="/panel" className="hover:text-white">Panel mayorista</Link></li>
            ) : null}
            <li><Link href="/preguntas-frecuentes" className="hover:text-white">Preguntas frecuentes</Link></li>
            <li><Link href="/terminos" className="hover:text-white">Términos y condiciones</Link></li>
            <li><Link href="/privacidad" className="hover:text-white">Política de privacidad</Link></li>
          </ul>
        </div>

        <div>
          <h3 className="text-sm font-semibold text-white">Soporte</h3>
          <ul className="mt-4 space-y-2 text-sm text-ink-400">
            <li>
              <Link href="/soporte" className="hover:text-white">Abrir un ticket</Link>
            </li>
            <li className="text-xs leading-relaxed">
              Toda la atención es por ticket, desde tu pedido o desde la página de soporte.
            </li>
            <li className="pt-2 text-xs">Pagos con Webpay o transferencia. Devoluciones solo en USDT o BTC.</li>
          </ul>
        </div>
      </div>

      <div className="border-t border-white/6 px-4 py-6 text-center text-xs text-ink-400">
        © {year} {s.site_name} · Hecho en Chile
      </div>
    </footer>
  );
}
