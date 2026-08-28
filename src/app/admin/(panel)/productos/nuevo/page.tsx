import Link from "next/link";
import { listOffers, ladderFor, previewPrices } from "@/lib/offers";
import { createProductFromOffer } from "@/app/admin/actions";
import { platformLabel, serviceTypeLabel, sortPlatforms } from "@/lib/labels";
import { formatClp, formatNumber } from "@/lib/pricing";
import { PlatformIcon } from "@/components/icons";

export const dynamic = "force-dynamic";

function offerLabel(serviceType: string, orderKind: string): string {
  return orderKind === "custom_comments"
    ? "Comentarios personalizados"
    : serviceTypeLabel(serviceType);
}

export default async function NewProductPage({
  searchParams,
}: {
  searchParams: Promise<{ red?: string; error?: string }>;
}) {
  const { red, error } = await searchParams;
  const offers = listOffers();

  // Redes que tienen algo vendible, con cuántas cosas se pueden vender en cada una.
  const byPlatform = new Map<string, number>();
  for (const offer of offers) {
    byPlatform.set(offer.platform, (byPlatform.get(offer.platform) ?? 0) + 1);
  }
  const platforms = sortPlatforms([...byPlatform.keys()].map((platform) => ({ platform })));

  const selected = red && byPlatform.has(red) ? red : null;
  const options = selected
    ? offers
        .filter((offer) => offer.platform === selected)
        .sort((a, b) => b.services - a.services)
    : [];

  return (
    <>
      <div>
        <Link href="/admin/productos" className="text-sm text-ink-400 hover:text-white">← Productos</Link>
        <h1 className="mt-1 text-2xl font-bold">Agregar producto</h1>
        <p className="mt-1 text-sm text-ink-400">
          Elige la red y qué quieres vender. La tienda busca el mejor servicio disponible, arma las
          cantidades y escribe los textos; después puedes editarlo todo.
        </p>
      </div>

      {error === "sin-servicio" ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          Ya no hay servicios activos para esa combinación. Sincroniza el catálogo del proveedor.
        </p>
      ) : null}

      {/* Paso 1 */}
      <section className="mt-8">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
          1 · En qué red
        </h2>
        <div className="mt-4 flex flex-wrap gap-2">
          {platforms.map((p) => {
            const active = selected === p.platform;
            return (
              <Link
                key={p.platform}
                href={`/admin/productos/nuevo?red=${p.platform}`}
                className={`flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-sm transition-colors ${
                  active
                    ? "border-brand-400 bg-brand-500/15 text-white"
                    : "border-white/10 bg-white/4 text-ink-200 hover:border-white/25 hover:text-white"
                }`}
              >
                <PlatformIcon slug={p.platform} className="h-4 w-4" />
                {platformLabel(p.platform)}
                <span className="text-xs text-ink-400">{byPlatform.get(p.platform)}</span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Paso 2 */}
      {selected ? (
        <section className="mt-10">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-ink-400">
            2 · Qué vendes en {platformLabel(selected)}
          </h2>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {options.map((offer) => {
              const prices = previewPrices(offer);
              const ladder = ladderFor(offer);
              const key = `${offer.service_type}-${offer.order_kind}`;
              return (
                <form
                  key={key}
                  action={createProductFromOffer}
                  className="card flex flex-col p-5"
                >
                  <input type="hidden" name="platform" value={offer.platform} />
                  <input type="hidden" name="service_type" value={offer.service_type} />
                  <input type="hidden" name="order_kind" value={offer.order_kind} />

                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-bold">
                        {offerLabel(offer.service_type, offer.order_kind)}
                      </h3>
                      <p className="mt-0.5 text-xs text-ink-400">
                        {offer.services} servicio{offer.services === 1 ? "" : "s"} disponible
                        {offer.services === 1 ? "" : "s"} · calidad {offer.score.toFixed(0)}/100
                      </p>
                    </div>
                    {offer.used > 0 ? (
                      <span className="shrink-0 rounded bg-white/8 px-2 py-1 text-[11px] text-ink-400">
                        ya tienes {offer.used}
                      </span>
                    ) : null}
                  </div>

                  {offer.order_kind === "custom_comments" ? (
                    <p className="mt-3 rounded-lg bg-white/4 px-3 py-2 text-xs leading-relaxed text-ink-400">
                      El cliente escribe los comentarios, uno por línea, y el precio se calcula según
                      cuántos escriba.
                    </p>
                  ) : null}

                  <p className="mt-3 truncate text-xs text-ink-400" title={offer.best_name}>
                    Mejor servicio: <span className="font-mono">#{offer.best_service_id}</span>{" "}
                    {offer.best_name}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-1.5">
                    {prices.map((price) => (
                      <span
                        key={price.quantity}
                        className="rounded border border-white/10 bg-white/4 px-2 py-1 text-[11px]"
                      >
                        {formatNumber(price.quantity)}{" "}
                        <span className="text-brand-300">{formatClp(price.priceClp)}</span>
                      </span>
                    ))}
                  </div>

                  <div className="mt-5 flex items-center justify-between gap-3 border-t border-white/8 pt-4">
                    <label className="flex cursor-pointer items-center gap-2 text-xs text-ink-200">
                      <input type="checkbox" name="publish" defaultChecked className="h-4 w-4 accent-[#7c3aed]" />
                      Publicar de inmediato
                    </label>
                    <button type="submit" className="btn btn-primary px-4 py-2 text-sm">
                      Crear
                    </button>
                  </div>

                  <p className="mt-2 text-[11px] text-ink-400">
                    Cantidades: {ladder.map((q) => formatNumber(q)).join(" · ")}
                  </p>
                </form>
              );
            })}
          </div>

          <p className="mt-8 text-sm text-ink-400">
            ¿Necesitas un servicio específico que no está acá? Búscalo en{" "}
            <Link href={`/admin/catalogo?red=${selected}`} className="text-brand-300 hover:text-white">
              el catálogo del proveedor
            </Link>
            .
          </p>
        </section>
      ) : null}
    </>
  );
}
