import Link from "next/link";
import { redirect } from "next/navigation";
import { panelUser } from "@/lib/reseller-auth";
import { servicioVendible, etiquetaRetencion, etiquetaVelocidad } from "@/lib/reseller-catalog";
import { resellerRatePer1000, resellerContext, formatClp, formatNumber, formatDuration } from "@/lib/pricing";
import { platformLabel, serviceTypeLabel } from "@/lib/labels";
import { PanelOrderForm } from "@/components/panel-order-form";

export const dynamic = "force-dynamic";

/** Sugerencia de enlace según la red, para que no peguen cualquier cosa. */
const EJEMPLO: Record<string, string> = {
  instagram: "https://www.instagram.com/tucuenta",
  tiktok: "https://www.tiktok.com/@tucuenta",
  youtube: "https://www.youtube.com/watch?v=...",
  facebook: "https://www.facebook.com/tupagina",
  twitter: "https://x.com/tucuenta",
  telegram: "https://t.me/tucanal",
  spotify: "https://open.spotify.com/artist/...",
  twitch: "https://www.twitch.tv/tucanal",
};

export default async function PanelNuevoPedido({
  searchParams,
}: {
  searchParams: Promise<{ servicio?: string }>;
}) {
  const user = await panelUser();
  if (!user) redirect("/panel/entrar");

  const { servicio } = await searchParams;
  const service = servicioVendible(Number(servicio));
  if (!service) {
    return (
      <div className="card p-8 text-center">
        <p className="text-ink-200">Ese servicio ya no está disponible.</p>
        <Link href="/panel/servicios" className="btn btn-primary mt-5 text-sm">Ver el catálogo</Link>
      </div>
    );
  }

  const ctx = resellerContext();
  const rate = resellerRatePer1000(service.rate_usd_per_1000, ctx, user.discount_percent);

  return (
    <>
      <Link
        href={`/panel/servicios?red=${service.platform}`}
        className="text-sm text-ink-400 hover:text-white"
      >
        ← Volver a {platformLabel(service.platform)}
      </Link>

      <h1 className="mt-4 text-2xl font-bold">Nuevo pedido</h1>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_0.85fr] lg:items-start [&>*]:min-w-0">
        <PanelOrderForm
          serviceId={service.service_id}
          serviceName={service.clean_name || service.name}
          ratePer1000Clp={rate}
          minQty={service.min_qty}
          maxQty={service.max_qty}
          minOrderClp={ctx.minOrderClp}
          balanceClp={user.balance_clp}
          orderKind={service.order_kind}
          linkSugerido={EJEMPLO[service.platform] ?? "https://..."}
        />

        <aside className="card p-5">
          <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">
            Detalle
          </h2>
          <dl className="mt-4 space-y-3 text-sm">
            {[
              ["Red", platformLabel(service.platform)],
              ["Tipo", serviceTypeLabel(service.service_type)],
              ["Precio por 1.000", formatClp(rate)],
              ["Rango", `${formatNumber(service.min_qty)} – ${formatNumber(service.max_qty)} u.`],
              ["Retención", `${etiquetaRetencion(service.drop_score)} (${service.drop_score}/100)`],
              ["Velocidad", `${etiquetaVelocidad(service.speed_score)} (${service.speed_score}/100)`],
              ["Entrega estimada", formatDuration(service.avg_minutes) ?? "Inmediata"],
              [
                "Reposición",
                service.refill_days >= 9999
                  ? "De por vida"
                  : service.refill_days > 0
                    ? `${service.refill_days} días`
                    : service.refill === 1
                      ? "Sí, incluida"
                      : "Sin reposición",
              ],
            ].map(([etiqueta, valor]) => (
              <div key={etiqueta} className="flex justify-between gap-4 border-b border-white/6 pb-2 last:border-0">
                <dt className="text-ink-400">{etiqueta}</dt>
                <dd className="text-right font-medium">{valor}</dd>
              </div>
            ))}
          </dl>

          {service.provider_description ? (
            <p className="mt-4 whitespace-pre-line rounded-lg border border-white/8 bg-white/3 p-3 text-xs leading-relaxed text-ink-200">
              {service.provider_description.slice(0, 900)}
            </p>
          ) : null}

          {service.refill_days > 0 || service.refill === 1 ? (
            <p className="mt-4 text-xs leading-relaxed text-ink-400">
              Si bajan dentro del plazo, pides la reposición desde el pedido.
            </p>
          ) : null}
        </aside>
      </div>
    </>
  );
}
