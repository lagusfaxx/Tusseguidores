"use client";

import { useActionState } from "react";
import { saveCoupon, type ActionState } from "@/app/admin/actions";
import { Feedback, SubmitButton } from "./admin-ui";

export function CouponForm() {
  const [state, formAction] = useActionState<ActionState, FormData>(saveCoupon, {});

  return (
    <form action={formAction} className="card p-6">
      <h2 className="font-bold">Nuevo cupón</h2>
      <p className="mt-1 text-sm text-ink-400">Si el código ya existe, se actualiza.</p>

      <div className="mt-5 space-y-4">
        <div>
          <label className="field-label" htmlFor="code">Código</label>
          <input id="code" name="code" required className="field font-mono uppercase" placeholder="BIENVENIDA10" />
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="kind">Tipo</label>
            <select id="kind" name="kind" className="field" defaultValue="percent">
              <option value="percent">Porcentaje</option>
              <option value="fixed">Monto fijo</option>
            </select>
          </div>
          <div>
            <label className="field-label" htmlFor="value">Valor</label>
            <input id="value" name="value" type="number" min={1} required className="field" placeholder="10" />
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="field-label" htmlFor="min_clp">Compra mínima (CLP)</label>
            <input id="min_clp" name="min_clp" type="number" min={0} className="field" placeholder="0" />
          </div>
          <div>
            <label className="field-label" htmlFor="max_uses">Máximo de usos</label>
            <input id="max_uses" name="max_uses" type="number" min={0} className="field" placeholder="0 = sin límite" />
          </div>
        </div>

        <div>
          <label className="field-label" htmlFor="expires_at">Vence el</label>
          <input id="expires_at" name="expires_at" type="date" className="field" />
        </div>

        <label className="flex cursor-pointer items-center gap-2.5">
          <input type="checkbox" name="active" defaultChecked className="h-4 w-4 accent-[#7c3aed]" />
          <span className="text-sm font-semibold">Activo</span>
        </label>
      </div>

      <div className="mt-6 flex items-center gap-4">
        <SubmitButton>Guardar cupón</SubmitButton>
        <Feedback state={state} />
      </div>
    </form>
  );
}
