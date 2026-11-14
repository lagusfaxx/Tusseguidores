"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { PlatformIcon } from "./icons";

export type RedDelMenu = { slug: string; label: string; color: string; products: number };

type Props = { redes: RedDelMenu[]; mayorista: boolean; prueba: boolean };

const ENLACE = "rounded-lg px-3 py-2 text-sm font-medium text-ink-200 transition-colors hover:bg-white/6 hover:text-white";

function Lupa() {
  return (
    <svg viewBox="0 0 24 24" className="h-[18px] w-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
      <circle cx="11" cy="11" r="7" />
      <path d="m20 20-3.5-3.5" />
    </svg>
  );
}

function Redes({ redes, alElegir }: { redes: RedDelMenu[]; alElegir: () => void }) {
  return (
    <>
      {redes.map((r) => (
        <Link
          key={r.slug}
          href={`/${r.slug}`}
          onClick={alElegir}
          className="flex items-center gap-2.5 rounded-lg px-3 py-2.5 text-sm font-medium text-ink-200 transition-colors hover:bg-white/6 hover:text-white"
        >
          <span style={{ color: r.color }}>
            <PlatformIcon slug={r.slug} className="h-[18px] w-[18px]" />
          </span>
          <span className="truncate">{r.label}</span>
        </Link>
      ))}
    </>
  );
}

/**
 * Menú de la cabecera. En escritorio: las redes en un desplegable y cuatro
 * enlaces; en teléfono, todo dentro de un panel que abre el botón de menú.
 */
export function HeaderNav({ redes, mayorista, prueba }: Props) {
  const [redesAbiertas, setRedesAbiertas] = useState(false);
  const [menuAbierto, setMenuAbierto] = useState(false);
  const desplegable = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!redesAbiertas) return;
    const fuera = (e: MouseEvent) => {
      if (!desplegable.current?.contains(e.target as Node)) setRedesAbiertas(false);
    };
    const tecla = (e: KeyboardEvent) => e.key === "Escape" && setRedesAbiertas(false);
    document.addEventListener("mousedown", fuera);
    document.addEventListener("keydown", tecla);
    return () => {
      document.removeEventListener("mousedown", fuera);
      document.removeEventListener("keydown", tecla);
    };
  }, [redesAbiertas]);

  // Con el panel abierto en teléfono, la página de atrás no se desplaza.
  useEffect(() => {
    document.body.style.overflow = menuAbierto ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [menuAbierto]);

  const cerrar = () => {
    setRedesAbiertas(false);
    setMenuAbierto(false);
  };

  return (
    <>
      {/* ------------------------------------------------------ escritorio */}
      <nav className="ml-6 hidden items-center gap-0.5 lg:flex" aria-label="Principal">
        <div className="relative" ref={desplegable}>
          <button
            type="button"
            aria-expanded={redesAbiertas}
            onClick={() => setRedesAbiertas((v) => !v)}
            className={`${ENLACE} flex items-center gap-1.5`}
          >
            Redes
            <svg viewBox="0 0 12 12" className={`h-3 w-3 transition-transform ${redesAbiertas ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" aria-hidden>
              <path d="m2.5 4.5 3.5 3.5 3.5-3.5" />
            </svg>
          </button>
          {redesAbiertas ? (
            <div className="absolute left-0 top-full z-50 mt-2 w-[26rem] rounded-2xl border border-white/10 bg-ink-900 p-2 shadow-2xl shadow-black/60">
              <div className="grid grid-cols-2 gap-0.5">
                <Redes redes={redes} alElegir={cerrar} />
              </div>
              <Link
                href="/catalogo"
                onClick={cerrar}
                className="mt-2 block rounded-lg border-t border-white/8 px-3 py-2.5 text-center text-sm font-semibold text-ink-200 hover:text-white"
              >
                Ver todo el catálogo
              </Link>
            </div>
          ) : null}
        </div>
        {prueba ? (
          <Link href="/prueba-gratis" className={`${ENLACE} flex items-center gap-1.5`}>
            Prueba gratis
            <span className="h-1.5 w-1.5 rounded-full bg-lime-400" />
          </Link>
        ) : null}
        <Link href="/seguimiento" className={ENLACE}>Mi pedido</Link>
        <Link href="/soporte" className={ENLACE}>Soporte</Link>
        {mayorista ? <Link href="/panel" className={ENLACE}>Mayoristas</Link> : null}
      </nav>

      <div className="ml-auto flex items-center gap-1.5">
        <Link
          href="/buscar"
          aria-label="Buscar"
          className="grid h-10 w-10 place-items-center rounded-lg text-ink-200 transition-colors hover:bg-white/6 hover:text-white"
        >
          <Lupa />
        </Link>
        {/* El envoltorio oculta el botón: .btn fija su propio display. */}
        <span className="hidden sm:block">
          <Link href="/catalogo" className="btn btn-primary whitespace-nowrap px-4 py-2 text-sm">
            Ver precios
          </Link>
        </span>
        <button
          type="button"
          aria-label={menuAbierto ? "Cerrar el menú" : "Abrir el menú"}
          aria-expanded={menuAbierto}
          onClick={() => setMenuAbierto((v) => !v)}
          className="grid h-10 w-10 place-items-center rounded-lg border border-white/12 bg-white/5 text-white lg:hidden"
        >
          <svg viewBox="0 0 24 24" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden>
            {menuAbierto ? <path d="M6 6l12 12M18 6 6 18" /> : <path d="M4 7h16M4 12h16M4 17h16" />}
          </svg>
        </button>
      </div>

      {/* -------------------------------------------------------- teléfono */}
      {menuAbierto ? (
        <div className="absolute inset-x-0 top-full z-50 h-[calc(100dvh-4rem)] overflow-y-auto border-t border-white/8 bg-ink-950 px-4 pb-8 pt-4 lg:hidden">
          <Link href="/catalogo" onClick={cerrar} className="btn btn-primary w-full text-base">
            Ver precios
          </Link>
          {prueba ? (
            <Link
              href="/prueba-gratis"
              onClick={cerrar}
              className="mt-2.5 flex items-center justify-center gap-2 rounded-xl border border-lime-400/40 px-4 py-3 text-sm font-semibold"
            >
              <span className="rounded bg-lime-400 px-1.5 py-0.5 text-[11px] font-bold uppercase text-ink-950">Gratis</span>
              Prueba con seguidores
            </Link>
          ) : null}

          <p className="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-ink-400">Redes</p>
          <div className="mt-1.5 grid grid-cols-2 gap-0.5">
            <Redes redes={redes} alElegir={cerrar} />
          </div>

          <p className="mt-6 px-3 text-xs font-semibold uppercase tracking-wider text-ink-400">Ayuda</p>
          <div className="mt-1.5 grid">
            {[
              ["/seguimiento", "Mi pedido"],
              ["/soporte", "Soporte"],
              ["/preguntas-frecuentes", "Preguntas frecuentes"],
              ...(mayorista ? [["/panel", "Panel mayorista"]] : []),
            ].map(([href, texto]) => (
              <Link
                key={href}
                href={href}
                onClick={cerrar}
                className="rounded-lg px-3 py-3 text-[15px] font-medium text-ink-200 hover:bg-white/6 hover:text-white"
              >
                {texto}
              </Link>
            ))}
          </div>
        </div>
      ) : null}
    </>
  );
}
