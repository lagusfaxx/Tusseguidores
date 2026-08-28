"use client";

import { useActionState } from "react";
import { syncProviderCatalog, type ActionState } from "@/app/admin/actions";
import { SubmitButton, Feedback } from "./admin-ui";

export function SyncCatalogButton() {
  const [state, formAction] = useActionState<ActionState>(syncProviderCatalog, {});
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-3">
      <SubmitButton className="btn btn-ghost text-sm">Sincronizar con el proveedor</SubmitButton>
      <Feedback state={state} />
    </form>
  );
}
