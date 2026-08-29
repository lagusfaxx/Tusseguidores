"use client";

import { useActionState, useState } from "react";
import { saveSeoText, type ActionState } from "@/app/admin/actions";
import { Feedback, SubmitButton } from "./admin-ui";

type Props = {
  clave: string;
  titulo: string;
  url: string;
  manual: string;
  generado: string;
  autoActivo: boolean;
};

/** Cuenta palabras de un HTML, que es lo que mira Google. */
function palabras(html: string): number {
  const texto = html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return texto ? texto.split(" ").length : 0;
}

export function SeoTextEditor({ clave, titulo, url, manual, generado, autoActivo }: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveSeoText, {});
  const [abierto, setAbierto] = useState(false);
  const [borrador, setBorrador] = useState(manual);

  const usandoManual = Boolean(manual);
  const vigente = usandoManual ? manual : autoActivo ? generado : "";

  return (
    <section className="card overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
        <div className="min-w-0">
          <h2 className="font-bold">{titulo}</h2>
          <p className="mt-0.5 text-xs text-ink-400">
            <span className="font-mono">{url}</span> · {palabras(vigente)} palabras ·{" "}
            {usandoManual ? (
              <span className="text-amber-300">texto propio</span>
            ) : vigente ? (
              <span className="text-lime-400">generado solo</span>
            ) : (
              <span className="text-red-300">sin texto</span>
            )}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-sm text-ink-400 hover:text-white"
          >
            Ver ↗
          </a>
          <button
            type="button"
            onClick={() => setAbierto((v) => !v)}
            className="btn btn-ghost px-3 py-1.5 text-sm"
          >
            {abierto ? "Cerrar" : usandoManual ? "Editar" : "Reemplazar"}
          </button>
        </div>
      </div>

      {abierto ? (
        <div className="border-t border-white/8 px-5 py-5">
          {!usandoManual && generado ? (
            <details className="mb-5">
              <summary className="cursor-pointer text-sm text-ink-400 hover:text-white">
                Ver el texto que se está mostrando ahora
              </summary>
              <div
                className="prose-ts mt-4 max-h-80 overflow-y-auto rounded-lg border border-white/10 bg-white/3 p-4"
                dangerouslySetInnerHTML={{ __html: generado }}
              />
              <button
                type="button"
                className="mt-3 text-sm text-brand-300 hover:text-white"
                onClick={() => setBorrador(generado)}
              >
                Copiarlo al editor para modificarlo
              </button>
            </details>
          ) : null}

          <form action={formAction}>
            <input type="hidden" name="clave" value={clave} />
            <label className="field-label" htmlFor={`html-${clave}`}>
              Texto propio (HTML)
            </label>
            <textarea
              id={`html-${clave}`}
              name="html"
              rows={12}
              value={borrador}
              onChange={(event) => setBorrador(event.target.value)}
              placeholder="Déjalo vacío para usar el texto generado automáticamente."
              className="field font-mono text-xs leading-relaxed"
            />
            <p className="mt-1.5 text-xs text-ink-400">
              Se permiten &lt;h2&gt;, &lt;h3&gt;, &lt;p&gt;, &lt;ul&gt;, &lt;ol&gt;, &lt;li&gt;,
              &lt;strong&gt; y &lt;a&gt;. Vacío = vuelve al automático.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-4">
              <SubmitButton>Guardar</SubmitButton>
              <Feedback state={state} />
            </div>
          </form>
        </div>
      ) : null}
    </section>
  );
}
