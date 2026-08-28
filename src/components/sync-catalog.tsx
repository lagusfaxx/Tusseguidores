"use client";

import { useActionState } from "react";
import { syncProviderCatalog, rescoreCatalog, type ActionState } from "@/app/admin/actions";
import { SubmitButton, Feedback } from "./admin-ui";

export function SyncCatalogButton() {
  const [syncState, syncAction] = useActionState<ActionState>(syncProviderCatalog, {});
  const [scoreState, scoreAction] = useActionState<ActionState>(rescoreCatalog, {});

  return (
    <div className="flex flex-wrap items-center gap-3">
      <form action={syncAction}>
        <SubmitButton className="btn btn-ghost text-sm">Sincronizar con el proveedor</SubmitButton>
      </form>
      <form action={scoreAction}>
        <SubmitButton className="btn btn-ghost text-sm">Recalcular calidad</SubmitButton>
      </form>
      <Feedback state={syncState.ok || syncState.error ? syncState : scoreState} />
    </div>
  );
}
