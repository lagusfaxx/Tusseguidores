"use client";

import { useActionState } from "react";
import { generarNiveles, type ActionState } from "@/app/admin/actions";
import { Feedback, SubmitButton } from "./admin-ui";

/**
 * Botón que arma el catálogo completo por niveles.
 *
 * Es la vía rápida para llenar la tienda: por cada red y cada tipo de servicio
 * publica el económico, el estándar y el premium, con los textos que explican
 * en qué se diferencian. Se puede apretar cuantas veces se quiera: los
 * productos que ya existen se actualizan en vez de duplicarse.
 */
export function GenerateLevelsButton({ platform }: { platform?: string }) {
  const [state, formAction] = useActionState<ActionState, FormData>(generarNiveles, {});

  return (
    <div className="flex flex-col items-end gap-2">
      <form action={formAction} className="flex items-center gap-3">
        {platform ? <input type="hidden" name="platform" value={platform} /> : null}
        <label className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-400">
          <input type="checkbox" name="borrador" className="h-3.5 w-3.5 accent-[#7c3aed]" />
          dejar como borrador
        </label>
        <label
          className="flex cursor-pointer items-center gap-1.5 text-xs text-ink-400"
          title="Por defecto se oculta el producto antiguo que vendía lo mismo sin niveles, para no mostrar cuatro fichas del mismo servicio."
        >
          <input type="checkbox" name="conservar" className="h-3.5 w-3.5 accent-[#7c3aed]" />
          conservar los antiguos
        </label>
        <SubmitButton className="btn btn-primary text-sm">
          Generar catálogo por niveles
        </SubmitButton>
      </form>
      <Feedback state={state} />
    </div>
  );
}
