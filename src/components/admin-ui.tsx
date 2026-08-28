"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { ActionState } from "@/app/admin/actions";

export function SubmitButton({
  children = "Guardar",
  className = "btn btn-primary",
}: {
  children?: React.ReactNode;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={className} disabled={pending}>
      {pending ? "Guardando…" : children}
    </button>
  );
}

export function Feedback({ state }: { state: ActionState }) {
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

/** Formulario que usa un server action con estado y muestra el resultado. */
export function ActionForm({
  action,
  children,
  className = "",
  submitLabel,
}: {
  action: (prev: ActionState, formData: FormData) => Promise<ActionState>;
  children: React.ReactNode;
  className?: string;
  submitLabel?: string;
}) {
  const [state, formAction] = useActionState<ActionState, FormData>(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      <div className="mt-6 flex items-center gap-4">
        <SubmitButton>{submitLabel}</SubmitButton>
        <Feedback state={state} />
      </div>
    </form>
  );
}

export function ConfirmButton({
  children,
  message,
  className = "text-sm text-red-300 hover:text-red-200",
}: {
  children: React.ReactNode;
  message: string;
  className?: string;
}) {
  return (
    <button
      type="submit"
      className={className}
      onClick={(event) => {
        if (!window.confirm(message)) event.preventDefault();
      }}
    >
      {children}
    </button>
  );
}
