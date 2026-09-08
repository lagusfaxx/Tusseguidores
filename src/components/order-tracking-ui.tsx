"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import {
  corregirDestino,
  abrirTicketDePedido,
  type PedidoState,
} from "@/app/pedido/actions";

/**
 * Los dos formularios del seguimiento que necesitan contestar sin recargar:
 * corregir el destino y abrir un ticket.
 */

function Boton({ children, pendiente }: { children: string; pendiente: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary w-full text-sm" disabled={pending}>
      {pending ? pendiente : children}
    </button>
  );
}

function Aviso({ state }: { state: PedidoState }) {
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

export function CorregirDestino({
  code,
  links,
  etiqueta,
}: {
  code: string;
  /** Todos los destinos del pedido: uno, o una publicación por línea. */
  links: string[];
  etiqueta: string;
}) {
  const [state, action] = useActionState<PedidoState, FormData>(corregirDestino, {});
  const varios = links.length > 1;
  return (
    <form action={action} className="card p-5">
      <input type="hidden" name="code" value={code} />
      <h2 className="font-bold">
        {varios ? "¿Te equivocaste de publicación?" : "¿Te equivocaste de cuenta?"}
      </h2>
      <p className="mt-1 text-sm text-ink-400">
        {varios
          ? "Puedes corregir los enlaces mientras el pedido no haya salido. Uno por línea, y tienen que seguir siendo los mismos."
          : "Puedes corregir el destino mientras el pedido no haya salido."}
      </p>
      <label className="field-label mt-4" htmlFor="link">{varios ? "Enlaces" : etiqueta}</label>
      {varios ? (
        <textarea
          id="link"
          name="link"
          rows={Math.min(8, links.length + 1)}
          defaultValue={links.join("\n")}
          className="field font-mono text-xs"
        />
      ) : (
        <input id="link" name="link" defaultValue={links[0] ?? ""} className="field font-mono text-xs" />
      )}
      <div className="mt-4">
        <Boton pendiente="Guardando…">
          {varios ? "Guardar los nuevos destinos" : "Guardar el nuevo destino"}
        </Boton>
      </div>
      <Aviso state={state} />
    </form>
  );
}

export function AbrirTicket({ code }: { code: string }) {
  const [state, action] = useActionState<PedidoState, FormData>(abrirTicketDePedido, {});
  if (state.ok) {
    return (
      <div className="card p-5">
        <h2 className="font-bold">Mensaje enviado</h2>
        <p className="mt-1 text-sm text-ink-400">{state.ok}</p>
      </div>
    );
  }
  return (
    <form action={action} className="card p-5">
      <input type="hidden" name="code" value={code} />
      <h2 className="font-bold">¿Necesitas ayuda con este pedido?</h2>
      <label className="field-label mt-4" htmlFor="subject">Asunto</label>
      <input id="subject" name="subject" required className="field" maxLength={140} />
      <label className="field-label mt-4" htmlFor="body">Mensaje</label>
      <textarea id="body" name="body" rows={4} required className="field" maxLength={4000} />
      <div className="mt-4">
        <Boton pendiente="Enviando…">Enviar</Boton>
      </div>
      <Aviso state={state} />
    </form>
  );
}
