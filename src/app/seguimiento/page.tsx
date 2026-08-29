import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { buildMetadata } from "@/lib/seo";

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Seguir mi pedido | TusSeguidores.cl",
    description: "Consulta el estado de tu pedido con el código que recibiste al pagar.",
    path: "/seguimiento",
    noindex: true,
  });
}

async function buscar(formData: FormData) {
  "use server";
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) redirect("/seguimiento?error=1");
  redirect(`/pedido/${encodeURIComponent(code)}`);
}

export default async function TrackingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  return (
    <>
      <SiteHeader />
      <main className="bg-halo">
        <div className="mx-auto max-w-lg px-4 py-20">
          <h1 className="text-3xl font-extrabold tracking-tight">Seguir mi pedido</h1>
          <p className="mt-2 text-ink-200">
            Escribe el código que te mostramos al terminar la compra. Se ve así:{" "}
            <span className="font-mono text-brand-300">TS-7K2F9Q</span>.
          </p>

          <form action={buscar} className="card mt-8 p-6">
            <label className="field-label" htmlFor="code">Código de pedido</label>
            <input
              id="code"
              name="code"
              className="field font-mono uppercase"
              placeholder="TS-XXXXXX"
              required
              autoComplete="off"
            />
            {error ? (
              <p className="mt-3 text-sm text-red-300">Escribe un código válido.</p>
            ) : null}
            <button type="submit" className="btn btn-primary mt-5 w-full">Ver mi pedido</button>
          </form>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
