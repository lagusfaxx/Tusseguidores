"use client";

import Link from "next/link";
import { useEffect, useState } from "react";

/**
 * Los últimos pedidos que se abrieron en este navegador.
 *
 * El código de seguimiento se pierde: llega por correo, a veces a spam, y la
 * pregunta "¿cuál era mi código?" es de las que más tickets abre. Se guarda
 * solo en el dispositivo del cliente y solo lo que ya se le mostró en pantalla.
 */

const CLAVE = "ts:pedidos";
const MAXIMO = 6;

type Recordado = { code: string; name: string; at: number };

function leer(): Recordado[] {
  try {
    const lista = JSON.parse(window.localStorage.getItem(CLAVE) ?? "[]");
    return Array.isArray(lista)
      ? lista.filter((p): p is Recordado => typeof p?.code === "string" && typeof p?.name === "string")
      : [];
  } catch {
    return [];
  }
}

/** Va en la página del pedido: anota que este navegador lo vio. */
export function RecordarPedido({ code, name }: { code: string; name: string }) {
  useEffect(() => {
    try {
      const resto = leer().filter((p) => p.code !== code);
      const lista = [{ code, name, at: Date.now() }, ...resto].slice(0, MAXIMO);
      window.localStorage.setItem(CLAVE, JSON.stringify(lista));
    } catch {
      // Sin almacenamiento no se recuerda; el código sigue llegando por correo.
    }
  }, [code, name]);
  return null;
}

/** Va en /seguimiento: un toque en vez de buscar el código en el correo. */
export function PedidosRecientes() {
  const [pedidos, setPedidos] = useState<Recordado[]>([]);

  useEffect(() => {
    setPedidos(leer());
  }, []);

  if (!pedidos.length) return null;

  return (
    <section className="mt-8">
      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
        Tus últimos pedidos en este dispositivo
      </h2>
      <ul className="mt-3 space-y-2">
        {pedidos.map((p) => (
          <li key={p.code}>
            <Link
              href={`/pedido/${encodeURIComponent(p.code)}`}
              className="card card-hover flex items-center justify-between gap-3 px-4 py-3"
              prefetch={false}
            >
              <span className="min-w-0">
                <span className="block font-mono text-sm font-bold">{p.code}</span>
                <span className="block truncate text-xs text-ink-400">{p.name}</span>
              </span>
              <span className="shrink-0 text-sm font-semibold text-brand-300">Ver →</span>
            </Link>
          </li>
        ))}
      </ul>
    </section>
  );
}
