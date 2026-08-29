"use client";

import { useState } from "react";

/**
 * Copia un dato al portapapeles. En el teléfono seleccionar a mano un número
 * de cuenta o un código de pedido es incómodo y se presta para errores.
 */
export function Copiar({ valor, etiqueta = "Copiar" }: { valor: string; etiqueta?: string }) {
  const [copiado, setCopiado] = useState(false);

  return (
    <button
      type="button"
      onClick={async () => {
        try {
          await navigator.clipboard.writeText(valor);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1800);
        } catch {
          // Sin permiso de portapapeles el texto igual se puede seleccionar.
        }
      }}
      aria-label={`${etiqueta}: ${valor}`}
      className="shrink-0 rounded-md border border-white/12 bg-white/6 px-2 py-1 text-[11px] font-semibold text-ink-200 transition-colors hover:border-brand-400/50 hover:text-white"
    >
      {copiado ? "✓ Listo" : etiqueta}
    </button>
  );
}
