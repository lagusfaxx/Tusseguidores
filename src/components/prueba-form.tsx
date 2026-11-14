"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { solicitarPrueba, type PruebaState } from "@/app/prueba-gratis/actions";
import { PlatformIcon } from "./icons";

type Red = { platform: string; label: string; color: string };

function Enviar({ cantidad }: { cantidad: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary mt-5 w-full text-base" disabled={pending}>
      {pending ? "Enviando…" : `Recibir ${cantidad} seguidores gratis`}
    </button>
  );
}

export function PruebaForm({ redes, cantidad, inicial }: { redes: Red[]; cantidad: number; inicial?: string }) {
  const [state, action] = useActionState<PruebaState, FormData>(solicitarPrueba, {});
  const [platform, setPlatform] = useState(
    redes.some((r) => r.platform === inicial) ? inicial! : redes[0]?.platform ?? "",
  );
  // Controlados: si el servidor rechaza la cuenta, no se pierde lo escrito.
  const [link, setLink] = useState("");
  const [email, setEmail] = useState("");
  const red = redes.find((r) => r.platform === platform) ?? redes[0];

  return (
    <form action={action} className="card p-5 sm:p-6">
      <input type="hidden" name="platform" value={platform} />
      <input name="web" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />

      {redes.length > 1 ? (
        <div className="mb-5 grid grid-cols-2 gap-2">
          {redes.map((r) => {
            const on = r.platform === platform;
            return (
              <button
                key={r.platform}
                type="button"
                aria-pressed={on}
                onClick={() => setPlatform(r.platform)}
                className={`flex items-center justify-center gap-2 rounded-xl border px-3 py-2.5 text-sm font-semibold transition-colors ${
                  on ? "border-lime-400 bg-lime-400/10 text-white" : "border-white/10 bg-white/4 text-ink-200 hover:border-white/25"
                }`}
              >
                <span style={{ color: r.color }}>
                  <PlatformIcon slug={r.platform} className="h-4 w-4" />
                </span>
                {r.label}
              </button>
            );
          })}
        </div>
      ) : null}

      <label className="field-label" htmlFor="link">Usuario de {red?.label}</label>
      <input
        id="link"
        name="link"
        type="text"
        required
        autoComplete="off"
        className="field"
        placeholder="@tucuenta"
        value={link}
        onChange={(e) => setLink(e.target.value)}
      />
      <p className="mt-1.5 text-xs text-ink-400">La cuenta tiene que estar pública.</p>

      <label className="field-label mt-4" htmlFor="email">Tu correo</label>
      <input
        id="email"
        name="email"
        type="email"
        required
        autoComplete="email"
        inputMode="email"
        className="field"
        placeholder="tucorreo@ejemplo.cl"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      {state.error ? (
        <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {state.error}
        </p>
      ) : null}

      <Enviar cantidad={cantidad} />
      <p className="mt-3 text-center text-xs text-ink-400">Sin tarjeta ni contraseña · una vez por cuenta</p>
    </form>
  );
}
