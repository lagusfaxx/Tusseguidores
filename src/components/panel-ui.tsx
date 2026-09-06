"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { PanelState } from "@/app/panel/actions";

/** Botón que se bloquea mientras el servidor trabaja: evita el doble clic. */
export function PanelSubmit({
  children = "Enviar",
  className = "btn btn-primary",
  pendiente = "Enviando…",
  disabled = false,
}: {
  children?: React.ReactNode;
  className?: string;
  pendiente?: string;
  /** Para bloquearlo cuando el formulario todavía no puede enviarse. */
  disabled?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending || disabled}>
      {pending ? pendiente : children}
    </button>
  );
}

export function PanelFeedback({ state }: { state: PanelState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      role="status"
      className={`rounded-lg border px-4 py-2.5 text-sm ${
        state.error
          ? "border-red-500/30 bg-red-500/10 text-red-200"
          : "border-lime-500/30 bg-lime-500/10 text-lime-200"
      }`}
    >
      {state.error ?? state.ok}
    </p>
  );
}

/**
 * Formulario con estado del panel.
 *
 * Es el mismo patrón del panel de administración: la acción devuelve un texto
 * y se muestra ahí mismo, sin recargar ni perder lo escrito.
 */
export function PanelForm({
  action,
  children,
  className = "",
  submitLabel = "Enviar",
  submitClassName = "btn btn-primary",
  pendiente,
}: {
  action: (prev: PanelState, formData: FormData) => Promise<PanelState>;
  children: React.ReactNode;
  className?: string;
  submitLabel?: string;
  submitClassName?: string;
  pendiente?: string;
}) {
  const [state, formAction] = useActionState<PanelState, FormData>(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="mt-5 space-y-3">
        <PanelSubmit className={submitClassName} pendiente={pendiente}>
          {submitLabel}
        </PanelSubmit>
        <PanelFeedback state={state} />
      </div>
    </form>
  );
}
