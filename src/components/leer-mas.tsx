/**
 * Recorta un bloque largo y lo abre con un botón.
 *
 * Usa la casilla oculta en vez de JavaScript a propósito: el contenido nunca
 * sale del HTML —así Google lo lee igual— y no hay nada que hidratar.
 *
 * Por omisión solo recorta en teléfono, que es donde un texto de tres
 * pantallas duele. Con `siempre` recorta también en escritorio: sirve para el
 * texto SEO del final, que estirado deja la página terminando en un muro de
 * párrafos en vez de en el pie.
 */
export function LeerMas({
  id,
  alto = "22rem",
  etiqueta = "Leer más",
  siempre = false,
  children,
}: {
  id: string;
  alto?: string;
  etiqueta?: string;
  siempre?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div>
      <input type="checkbox" id={id} className="peer sr-only" />
      <div
        style={{ ["--alto" as string]: alto }}
        className={`relative max-h-[var(--alto)] overflow-hidden after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-24 after:bg-gradient-to-t after:from-ink-950 after:to-transparent peer-checked:max-h-none peer-checked:after:hidden ${
          siempre ? "" : "sm:max-h-none sm:after:hidden"
        }`}
      >
        {children}
      </div>
      <label
        htmlFor={id}
        className={`mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3.5 py-2 text-sm font-semibold text-ink-200 transition-colors hover:border-brand-400/50 hover:text-white peer-checked:hidden ${
          siempre ? "" : "sm:hidden"
        }`}
      >
        {etiqueta}
      </label>
    </div>
  );
}
