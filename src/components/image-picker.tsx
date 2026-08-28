"use client";

import { useRef, useState } from "react";

/** Sube una foto al volumen de datos y guarda su URL en el formulario. */
export function ImagePicker({ name, defaultValue }: { name: string; defaultValue?: string | null }) {
  const [url, setUrl] = useState(defaultValue ?? "");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  async function upload(file: File) {
    setBusy(true);
    setError("");
    try {
      const body = new FormData();
      body.set("file", file);
      const response = await fetch("/api/admin/media", { method: "POST", body });
      const data = (await response.json()) as { url?: string; error?: string };
      if (!response.ok || !data.url) throw new Error(data.error ?? "No se pudo subir la imagen.");
      setUrl(data.url);
    } catch (err) {
      setError(err instanceof Error ? err.message : "No se pudo subir la imagen.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div>
      <input type="hidden" name={name} value={url} />
      <div className="flex items-start gap-4">
        <div className="h-24 w-36 shrink-0 overflow-hidden rounded-lg border border-white/12 bg-ink-800">
          {url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={url} alt="Vista previa" className="h-full w-full object-cover" />
          ) : (
            <div className="grid h-full place-items-center text-xs text-ink-400">Sin foto</div>
          )}
        </div>
        <div className="flex-1">
          <input
            ref={inputRef}
            type="file"
            accept="image/jpeg,image/png,image/webp,image/avif,image/gif"
            className="hidden"
            onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-ghost px-3 py-1.5 text-sm"
              onClick={() => inputRef.current?.click()}
              disabled={busy}
            >
              {busy ? "Subiendo…" : "Subir foto"}
            </button>
            {url ? (
              <button
                type="button"
                className="btn btn-ghost px-3 py-1.5 text-sm"
                onClick={() => setUrl("")}
              >
                Quitar
              </button>
            ) : null}
          </div>
          <input
            className="field mt-2 text-xs"
            value={url}
            onChange={(event) => setUrl(event.target.value)}
            placeholder="/img/productos/instagram-seguidores.svg"
          />
          <p className="mt-1 text-xs text-ink-400">
            JPG, PNG, WEBP o AVIF, hasta 5 MB. También puedes pegar una ruta o URL.
          </p>
          {error ? <p className="mt-1 text-xs text-red-300">{error}</p> : null}
        </div>
      </div>
    </div>
  );
}
