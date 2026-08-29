/**
 * Recorta un bloque largo en teléfono y lo deja completo desde 640px.
 *
 * Usa la casilla oculta en vez de JavaScript a propósito: el contenido nunca
 * sale del HTML —así Google lo lee igual— y no hay nada que hidratar.
 */
export function LeerMas({
  id,
  alto = "22rem",
  etiqueta = "Leer más",
  children,
}: {
  id: string;
  alto?: string;
  etiqueta?: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <input type="checkbox" id={id} className="peer sr-only" />
      <div
        style={{ ["--alto" as string]: alto }}
        className="relative max-h-[var(--alto)] overflow-hidden after:pointer-events-none after:absolute after:inset-x-0 after:bottom-0 after:h-24 after:bg-gradient-to-t after:from-ink-950 after:to-transparent peer-checked:max-h-none peer-checked:after:hidden sm:max-h-none sm:after:hidden"
      >
        {children}
      </div>
      <label
        htmlFor={id}
        className="mt-3 inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-white/12 bg-white/5 px-3.5 py-2 text-sm font-semibold text-ink-200 peer-checked:hidden sm:hidden"
      >
        {etiqueta}
      </label>
    </div>
  );
}
