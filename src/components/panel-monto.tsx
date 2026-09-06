"use client";

import { useState } from "react";

/**
 * Campo de monto de la recarga, con atajos.
 *
 * Los atajos existen porque en el teléfono escribir "20000" en un campo
 * numérico es la parte más molesta de recargar. Antes eran texto suelto que
 * parecía un botón y no hacía nada.
 */
export function CampoMonto({
  name = "monto",
  minimo,
  atajos,
}: {
  name?: string;
  minimo: number;
  atajos: number[];
}) {
  const [valor, setValor] = useState(String(minimo));
  const clp = (v: number) =>
    v.toLocaleString("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

  return (
    <>
      <label className="field-label" htmlFor={name}>Monto (CLP)</label>
      <input
        id={name}
        name={name}
        inputMode="numeric"
        required
        className="field"
        value={valor}
        onChange={(e) => setValor(e.target.value.replace(/[^\d]/g, ""))}
      />
      <div className="mt-2 flex flex-wrap gap-1.5">
        {atajos.map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setValor(String(m))}
            className={`rounded-lg border px-2.5 py-1.5 text-xs font-semibold transition-colors ${
              Number(valor) === m
                ? "border-brand-400/60 bg-brand-500/20 text-white"
                : "border-white/10 bg-white/5 text-ink-200 hover:border-brand-400/40 hover:text-white"
            }`}
          >
            {clp(m)}
          </button>
        ))}
      </div>
      <p className="mt-1.5 text-xs text-ink-400">Mínimo {clp(minimo)}.</p>
    </>
  );
}
