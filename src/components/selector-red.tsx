"use client";

import Link from "next/link";
import { useState } from "react";
import { ArrowIcon, PlatformIcon } from "./icons";

export type RedDelSelector = {
  slug: string;
  label: string;
  color: string;
  total: number;
  items: { slug: string; name: string; price: string; entrega: string }[];
};

/** Portada: red → servicio → ficha, en dos toques. */
export function SelectorRed({ redes }: { redes: RedDelSelector[] }) {
  const [activa, setActiva] = useState(redes[0]?.slug ?? "");
  const red = redes.find((r) => r.slug === activa) ?? redes[0];
  if (!red) return null;

  return (
    <div className="card overflow-hidden" style={{ "--red": red.color } as React.CSSProperties}>
      <div
        role="tablist"
        aria-label="Red social"
        className="flex gap-1.5 overflow-x-auto border-b border-white/8 p-3 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {redes.map((r) => {
          const on = r.slug === red.slug;
          return (
            <button
              key={r.slug}
              type="button"
              role="tab"
              aria-selected={on}
              onClick={() => setActiva(r.slug)}
              className={`flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-sm font-semibold transition-colors ${
                on
                  ? "border-[var(--red)] bg-white/8 text-white"
                  : "border-transparent text-ink-400 hover:bg-white/5 hover:text-white"
              }`}
            >
              <span style={on ? { color: r.color } : undefined}>
                <PlatformIcon slug={r.slug} className="h-4 w-4" />
              </span>
              {r.label}
            </button>
          );
        })}
      </div>

      <ul>
        {red.items.map((item) => (
          <li key={item.slug} className="border-b border-white/6 last:border-b-0">
            <Link
              href={`/producto/${item.slug}`}
              className="group flex items-center gap-3 px-4 py-3 transition-colors hover:bg-white/5"
              prefetch={false}
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-[15px] font-semibold">{item.name}</span>
                <span className="block truncate text-xs text-ink-400">{item.entrega}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block text-[10px] uppercase tracking-wider text-ink-400">Desde</span>
                <span className="block text-[15px] font-extrabold">{item.price}</span>
              </span>
              <span className="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-white/6 text-white transition-colors group-hover:bg-lime-400 group-hover:text-ink-950">
                <ArrowIcon />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      {red.total > red.items.length ? (
        <Link
          href={`/${red.slug}`}
          className="block border-t border-white/8 px-4 py-3 text-center text-sm font-semibold text-ink-200 hover:text-white"
        >
          Ver los {red.total} de {red.label}
        </Link>
      ) : null}
    </div>
  );
}
