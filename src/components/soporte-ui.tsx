"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { abrirConsulta, responderConsulta, type SoporteState } from "@/app/soporte/actions";

function Boton({ children, pendiente }: { children: string; pendiente: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full text-sm" disabled={pending}>
      {pending ? pendiente : children}
    </button>
  );
}

function Aviso({ state }: { state: SoporteState }) {
  if (!state.ok && !state.error) return null;
  return (
    <p
      role="status"
      className={`mt-3 rounded-lg border px-3 py-2 text-sm ${
        state.error
          ? "border-red-500/30 bg-red-500/10 text-red-200"
          : "border-lime-500/30 bg-lime-500/10 text-lime-200"
      }`}
    >
      {state.error ?? state.ok}
    </p>
  );
}

export function NuevaConsulta() {
  const [state, action] = useActionState<SoporteState, FormData>(abrirConsulta, {});
  return (
    <form action={action}>
      <label className="field-label" htmlFor="email">Tu correo</label>
      <input id="email" name="email" type="email" required className="field" autoComplete="email" />
      <p className="mt-1 text-xs text-ink-600">Solo para avisarte cuando respondamos.</p>
      {/* Trampa para bots */}
      <input name="web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
      <label className="field-label mt-4" htmlFor="subject">Asunto</label>
      <input id="subject" name="subject" required minLength={4} maxLength={140} className="field" />
      <label className="field-label mt-4" htmlFor="body">Mensaje</label>
      <textarea id="body" name="body" rows={5} required minLength={5} maxLength={4000} className="field" />
      <div className="mt-4">
        <Boton pendiente="Enviando…">Enviar consulta</Boton>
      </div>
      <Aviso state={state} />
    </form>
  );
}

export function ResponderConsulta({
  code,
  llave,
  bloqueado,
}: {
  code: string;
  llave: string;
  bloqueado?: string | null;
}) {
  const [state, action] = useActionState<SoporteState, FormData>(responderConsulta, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  if (bloqueado) {
    return (
      <p className="mt-5 rounded-lg border border-white/10 bg-white/4 px-4 py-3 text-sm text-ink-400">
        {bloqueado}
      </p>
    );
  }
  return (
    <form ref={form} action={action} className="mt-5">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="k" value={llave} />
      <textarea name="body" rows={3} required maxLength={4000} className="field text-sm" placeholder="Escribe tu mensaje" />
      <div className="mt-3">
        <Boton pendiente="Enviando…">Enviar</Boton>
      </div>
      <Aviso state={state} />
    </form>
  );
}
