import Link from "next/link";
import { formatClp, formatNumber } from "@/lib/pricing";
import type { FilaComparador } from "@/lib/levels";

/**
 * Comparador de niveles de la ficha.
 *
 * El cliente llega buscando "seguidores de Instagram" y se encuentra con tres
 * precios. Este bloque contesta la única pregunta que tiene —qué me llevo de
 * más si pago más— con los datos del servicio que hay detrás de cada nivel, no
 * con adjetivos.
 */
export function LevelCompare({ filas }: { filas: FilaComparador[] }) {
  if (filas.length < 2) return null;

  return (
    <section className="mt-10">
      <h2 className="text-xl font-bold">Elige el nivel</h2>
      <p className="mt-1 text-sm text-ink-400">
        Los tres entregan lo mismo. Lo que cambia es cuánto aguanta, cuánto demora y cuánto cuesta.
        Precios comparados a {formatNumber(filas[0].quantity)} unidades.
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        {filas.map((fila) => {
          const contenido = (
            <>
              <div className="flex items-baseline justify-between gap-2">
                <span className="text-sm font-bold">{fila.label}</span>
                {fila.actual ? (
                  <span className="rounded bg-brand-500/20 px-1.5 py-0.5 text-[10px] font-semibold text-brand-200">
                    estás viendo este
                  </span>
                ) : (
                  <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] text-ink-400">
                    {fila.badge}
                  </span>
                )}
              </div>

              <p className="mt-2 text-xl font-extrabold text-white">{formatClp(fila.priceClp)}</p>

              <ul className="mt-3 space-y-1 text-xs leading-relaxed text-ink-300">
                <li>{fila.retencion}</li>
                <li>{fila.entrega}</li>
                <li>{fila.reposicion}</li>
              </ul>

              <p className="mt-3 text-xs leading-relaxed text-ink-400">{fila.pitch}</p>

              {!fila.actual ? (
                <span className="mt-3 inline-block text-xs font-semibold text-brand-300">
                  Ver este nivel →
                </span>
              ) : null}
            </>
          );

          return fila.actual ? (
            <div key={fila.id} className="card border-brand-400/60 bg-brand-500/8 p-4">{contenido}</div>
          ) : (
            <Link
              key={fila.id}
              href={`/producto/${fila.slug}`}
              className="card card-hover p-4"
              prefetch={false}
            >
              {contenido}
            </Link>
          );
        })}
      </div>
    </section>
  );
}
