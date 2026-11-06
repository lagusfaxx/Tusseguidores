"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import {
  corregirDestino,
  abrirTicketDePedido,
  responderTicketDePedido,
  pedirReposicion,
  pedirDevolucion,
  type PedidoState,
} from "@/app/pedido/actions";
import { REDES_DEVOLUCION, TEXTO_DEVOLUCIONES } from "@/lib/devoluciones";

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
    <form action={action}>
      <input type="hidden" name="code" value={code} />
      <p className="text-sm text-ink-400">
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
  return (
    <form action={action}>
      <input type="hidden" name="code" value={code} />
      <p className="text-sm text-ink-400">
        Escríbenos aquí y te respondemos en esta misma página. Te avisamos por correo cuando
        contestemos.
      </p>
      <label className="field-label mt-4" htmlFor="body">Tu mensaje</label>
      <textarea
        id="body"
        name="body"
        rows={4}
        required
        minLength={5}
        className="field"
        maxLength={4000}
        placeholder="Cuéntanos qué pasa con tu pedido"
      />
      <div className="mt-3">
        <Boton pendiente="Enviando…">Enviar mensaje</Boton>
      </div>
      <Aviso state={state} />
    </form>
  );
}

/** Responder en el ticket del pedido. Limpia el campo cuando el mensaje sale. */
export function ResponderTicket({
  code,
  ticket,
  bloqueado,
}: {
  code: string;
  ticket: string;
  /** Mensaje que explica por qué no puede escribir todavía. */
  bloqueado?: string | null;
}) {
  const [state, action] = useActionState<PedidoState, FormData>(responderTicketDePedido, {});
  const form = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) form.current?.reset();
  }, [state]);

  if (bloqueado) {
    return (
      <p className="mt-4 rounded-lg border border-white/10 bg-white/4 px-3 py-2.5 text-xs leading-relaxed text-ink-400">
        {bloqueado}
      </p>
    );
  }
  return (
    <form ref={form} action={action} className="mt-4">
      <input type="hidden" name="code" value={code} />
      <input type="hidden" name="ticket" value={ticket} />
      <textarea
        name="body"
        rows={3}
        required
        className="field text-sm"
        placeholder="Escribe tu mensaje"
        maxLength={4000}
      />
      <div className="mt-3">
        <Boton pendiente="Enviando…">Enviar</Boton>
      </div>
      <Aviso state={state} />
    </form>
  );
}

/**
 * Pedir la devolución. Solo en cripto: el cliente elige USDT o BTC y deja su
 * dirección, que es todo lo que hace falta para pagarle.
 */
export function PedirDevolucion({ code }: { code: string }) {
  const [state, action] = useActionState<PedidoState, FormData>(pedirDevolucion, {});
  if (state.ok) {
    return <p className="text-sm text-lime-200">{state.ok}</p>;
  }
  return (
    <form action={action}>
      <input type="hidden" name="code" value={code} />
      <p className="text-sm text-ink-400">{TEXTO_DEVOLUCIONES}</p>
      <label className="field-label mt-4" htmlFor="red">Recibir en</label>
      <select id="red" name="red" required className="field" defaultValue="">
        <option value="" disabled>Elige moneda y red</option>
        {Object.entries(REDES_DEVOLUCION).map(([id, red]) => (
          <option key={id} value={id}>{red.etiqueta}</option>
        ))}
      </select>
      <label className="field-label mt-4" htmlFor="direccion">Dirección de tu billetera</label>
      <input
        id="direccion"
        name="direccion"
        required
        autoComplete="off"
        spellCheck={false}
        className="field font-mono text-xs"
        placeholder="Pega la dirección completa"
      />
      <p className="mt-1.5 text-xs text-ink-600">
        Revisa que la red coincida con tu billetera: un envío a la red equivocada no se puede recuperar.
      </p>
      <label className="field-label mt-4" htmlFor="detalle-devolucion">
        Comentario <span className="font-normal text-ink-600">(opcional)</span>
      </label>
      <textarea id="detalle-devolucion" name="detalle" rows={2} className="field" maxLength={1000} />
      <div className="mt-4">
        <Boton pendiente="Enviando…">Pedir la devolución</Boton>
      </div>
      <Aviso state={state} />
    </form>
  );
}

/**
 * Pedir la reposición de lo que se cayó.
 *
 * Solo se monta cuando la garantía está viva: la página decide, aquí no hay
 * ninguna condición de plazo que pueda quedar desincronizada. El detalle es
 * opcional a propósito —pedir reposición tiene que costar un clic— pero deja
 * escribir qué pasó, que es lo que hace útil el ticket.
 */
export function PedirReposicion({
  code,
  vigencia,
}: {
  code: string;
  /** Hasta cuándo alcanza la garantía, ya escrito por la página. */
  vigencia: string;
}) {
  const [state, action] = useActionState<PedidoState, FormData>(pedirReposicion, {});

  if (state.ok) {
    return <p className="text-sm text-lime-200">{state.ok}</p>;
  }

  return (
    <form action={action}>
      <input type="hidden" name="code" value={code} />
      <p className="text-sm text-ink-400">
        Lo reponemos sin costo. {vigencia}.
      </p>
      <label className="field-label mt-4" htmlFor="detalle">
        Cuéntanos qué pasó <span className="font-normal text-ink-600">(opcional)</span>
      </label>
      <textarea
        id="detalle"
        name="detalle"
        rows={3}
        className="field"
        maxLength={4000}
        placeholder="Por ejemplo: quedaron 320 de los 500 que llegaron."
      />
      <div className="mt-4">
        <Boton pendiente="Pidiendo…">Pedir la reposición</Boton>
      </div>
      <Aviso state={state} />
    </form>
  );
}
