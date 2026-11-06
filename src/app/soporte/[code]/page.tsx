import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { ResponderConsulta } from "@/components/soporte-ui";
import { ticketConLlave, mensajesDeTicket, puedeEscribir, ETIQUETA_TICKET } from "@/lib/tickets";
import { getSettings } from "@/lib/settings";
import { formatDateCl } from "@/lib/utils";

export const metadata: Metadata = {
  title: "Tu consulta",
  robots: { index: false, follow: false },
};
export const dynamic = "force-dynamic";

export default async function ConsultaPage({
  params,
  searchParams,
}: {
  params: Promise<{ code: string }>;
  searchParams: Promise<{ k?: string; nuevo?: string }>;
}) {
  const { code } = await params;
  const { k, nuevo } = await searchParams;
  const ticket = ticketConLlave(decodeURIComponent(code), k ?? "");
  if (!ticket) notFound();

  const mensajes = mensajesDeTicket(ticket.id);
  const permiso = puedeEscribir(ticket.id);
  const tienda = getSettings().site_name;

  return (
    <>
      <SiteHeader />
      <main className="bg-halo">
        <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
          {nuevo ? (
            <div className="mb-6 rounded-xl border border-lime-500/30 bg-lime-500/10 p-4 text-sm text-lime-100">
              Recibimos tu consulta. Te mandamos este enlace por correo: guárdalo para volver.
            </div>
          ) : null}

          <section className="card p-5 sm:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="font-mono text-xs text-ink-400">{ticket.code}</p>
                <h1 className="mt-1 text-xl font-bold">{ticket.subject}</h1>
              </div>
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${
                  ticket.status === "cerrado"
                    ? "bg-white/8 text-ink-400"
                    : ticket.status === "respondido"
                      ? "bg-lime-500/15 text-lime-300"
                      : "bg-amber-500/15 text-amber-300"
                }`}
              >
                {ETIQUETA_TICKET[ticket.status] ?? ticket.status}
              </span>
            </div>

            <div className="mt-5 space-y-3">
              {mensajes.map((m) => (
                <div
                  key={m.id}
                  className={`rounded-xl border p-3.5 ${
                    m.author === "admin"
                      ? "mr-6 border-brand-400/30 bg-brand-500/10"
                      : "ml-6 border-white/8 bg-white/3"
                  }`}
                >
                  <p className="text-[11px] font-semibold text-ink-400">
                    {m.author === "admin" ? `${tienda} · soporte` : "Tú"} · {formatDateCl(m.created_at)}
                  </p>
                  <p className="mt-1 whitespace-pre-line break-words text-sm leading-relaxed text-ink-200">
                    {m.body}
                  </p>
                </div>
              ))}
            </div>

            {ticket.status === "cerrado" ? (
              <p className="mt-5 rounded-lg border border-white/10 bg-white/4 px-4 py-3 text-sm text-ink-400">
                Esta consulta está cerrada. Si necesitas algo más,{" "}
                <Link href="/soporte" className="text-brand-300 hover:underline">abre otra</Link>.
              </p>
            ) : (
              <ResponderConsulta code={ticket.code} llave={k ?? ""} bloqueado={permiso.ok ? null : permiso.error} />
            )}
          </section>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
