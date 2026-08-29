"use client";

import { useActionState } from "react";
import { retryStuckOrders, type ActionState } from "@/app/admin/actions";
import { SubmitButton, Feedback } from "./admin-ui";

/** Reenvía de una todos los pedidos pagados que quedaron sin despachar. */
export function RetryStuckButton() {
  const [state, formAction] = useActionState<ActionState>(retryStuckOrders, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <SubmitButton className="btn btn-ghost text-sm">Reintentar pedidos sin enviar</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}
