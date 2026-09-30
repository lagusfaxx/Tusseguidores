"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { cambiarProveedor, type ActionState } from "@/app/admin/actions";
import { Feedback } from "./admin-ui";

export type OpcionProveedor = {
  id: string;
  nombre: string;
  /** Servicios activos que tiene para esta red. */
  servicios: number;
  configurado: boolean;
};

function Boton({
  opcion, activo, red,
}: {
  opcion: OpcionProveedor;
  activo: boolean;
  red: string;
}) {
  const { pending } = useFormStatus();
  const disponible = opcion.configurado && opcion.servicios > 0;
  const motivo = !opcion.configurado
    ? "Falta su API key"
    : opcion.servicios === 0
      ? "No tiene servicios de esta red (sincroniza el catálogo)"
      : undefined;

  return (
    <button
      type="submit"
      name="proveedor"
      value={opcion.id}
      disabled={activo || !disponible || pending}
      title={motivo}
      onClick={(event) => {
        const ok = window.confirm(
          `¿Pasar ${red} a ${opcion.nombre}?\n\nLos productos de ${red} se reasignan a sus servicios y los precios se recalculan con lo que cobra ${opcion.nombre}. Los pedidos que ya salieron siguen con su proveedor.`,
        );
        if (!ok) event.preventDefault();
      }}
      className={`rounded-md px-3 py-1.5 text-sm transition ${
        activo
          ? "bg-brand-500 font-semibold text-white"
          : disponible
            ? "text-ink-200 hover:bg-white/10"
            : "cursor-not-allowed text-ink-400 opacity-50"
      }`}
    >
      {opcion.nombre}
      <span className={`ml-1.5 text-[11px] ${activo ? "text-white/80" : "text-ink-400"}`}>
        {opcion.servicios}
      </span>
    </button>
  );
}

/** Interruptor de proveedor de una red: un botón por proveedor. */
export function ProviderSwitch({
  platform, label, actual, opciones,
}: {
  platform: string;
  label: string;
  actual: string;
  opciones: OpcionProveedor[];
}) {
  const [state, action] = useActionState<ActionState, FormData>(cambiarProveedor, {});
  return (
    <div className="space-y-2">
      <form action={action} className="inline-flex rounded-lg border border-white/10 bg-white/5 p-1">
        <input type="hidden" name="platform" value={platform} />
        {opciones.map((opcion) => (
          <Boton key={opcion.id} opcion={opcion} activo={opcion.id === actual} red={label} />
        ))}
      </form>
      <Feedback state={state} />
    </div>
  );
}
