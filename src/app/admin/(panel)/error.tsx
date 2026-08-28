"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Sin esto, cualquier fallo del panel se ve como una pantalla en blanco con un
 * "Application error" y un código. Al menos aquí se ve qué pasó y se puede
 * reintentar sin perder la sesión.
 */
export default function AdminError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  return (
    <div className="mx-auto max-w-lg py-16 text-center">
      <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-red-500/15 text-2xl text-red-300">
        !
      </div>
      <h1 className="mt-5 text-2xl font-bold">Algo se cayó en el panel</h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-200">
        La tienda sigue funcionando; esto solo afectó a esta pantalla.
      </p>

      {error.message ? (
        <p className="mt-5 break-words rounded-lg border border-white/10 bg-white/4 p-3 text-left font-mono text-xs text-ink-200">
          {error.message}
        </p>
      ) : null}
      {error.digest ? (
        <p className="mt-2 text-xs text-ink-400">
          Código para buscar en los registros del servidor:{" "}
          <span className="font-mono text-ink-200">{error.digest}</span>
        </p>
      ) : null}

      <div className="mt-7 flex justify-center gap-3">
        <button type="button" onClick={reset} className="btn btn-primary text-sm">
          Reintentar
        </button>
        <Link href="/admin" className="btn btn-ghost text-sm">
          Volver al resumen
        </Link>
      </div>
    </div>
  );
}
