"use client";

import { useEffect, useState } from "react";

/**
 * Barra de compra fija al pie, solo en teléfono.
 *
 * El formulario va arriba de la ficha, pero quien baja a leer la descripción,
 * los precios o las preguntas se queda sin botón a la vista y tiene que
 * devolverse a mano. Aparece cuando el formulario sale de la pantalla y
 * desaparece cuando vuelve: nunca tapa el botón de pagar de verdad.
 */
export function BarraComprar({ ancla, precio, detalle }: { ancla: string; precio: string; detalle: string }) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const destino = document.getElementById(ancla);
    if (!destino || typeof IntersectionObserver === "undefined") return;
    const observador = new IntersectionObserver(
      ([entrada]) => setVisible(!entrada.isIntersecting && entrada.boundingClientRect.top < 0),
      { threshold: 0 },
    );
    observador.observe(destino);
    return () => observador.disconnect();
  }, [ancla]);

  return (
    <div
      aria-hidden={!visible}
      className={`fixed inset-x-0 bottom-0 z-30 border-t border-white/10 bg-ink-950/95 px-4 pt-2.5 backdrop-blur-md transition-transform duration-200 lg:hidden ${
        visible ? "translate-y-0" : "translate-y-full"
      }`}
      style={{ paddingBottom: "calc(0.625rem + env(safe-area-inset-bottom))" }}
    >
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
        <div className="min-w-0">
          <span className="block truncate text-[11px] text-ink-400">{detalle}</span>
          <span className="text-lg font-extrabold leading-tight">{precio}</span>
        </div>
        <a
          href={`#${ancla}`}
          tabIndex={visible ? 0 : -1}
          className="btn btn-primary shrink-0 px-5 py-2.5 text-sm"
        >
          Comprar ahora
        </a>
      </div>
    </div>
  );
}
