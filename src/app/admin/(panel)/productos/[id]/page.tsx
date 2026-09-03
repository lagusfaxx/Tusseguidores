import Link from "next/link";
import { notFound } from "next/navigation";
import { ProductForm } from "@/components/product-form";
import { deleteProduct } from "@/app/admin/actions";
import { getProductById, getPricedTiers, parseJson } from "@/lib/catalog";
import { get } from "@/lib/db";
import { PLATFORM_OPTIONS, SERVICE_TYPE_OPTIONS } from "@/lib/labels";
import { pricingContext , floorPer1000 } from "@/lib/pricing";
import { rankCandidates, routingForProduct } from "@/lib/routing";
import type { FaqItem } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function EditProductPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ creado?: string; "ya-existia"?: string }>;
}) {
  const { id } = await params;
  const { creado, "ya-existia": yaExistia } = await searchParams;
  const product = getProductById(Number(id));
  if (!product) notFound();

  const service = get<{
    service_id: number; clean_name: string; rate_usd_per_1000: number;
    min_qty: number; max_qty: number; provider_enabled: number;
    drop_score: number; speed_score: number;
  }>(
    `SELECT service_id, clean_name, rate_usd_per_1000, min_qty, max_qty,
            provider_enabled, drop_score, speed_score
       FROM provider_services WHERE service_id = ?`,
    [product.provider_service_id],
  )!;

  // Vista previa de a qué servicio se enviaría un pedido hecho ahora mismo.
  const routed = routingForProduct(product, product.rate_usd_per_1000);
  const routing = routed
    ? {
        serviceId: routed.service.service_id,
        name: routed.service.clean_name,
        rateUsd: routed.service.rate_usd_per_1000,
        drop: routed.service.drop_score,
        speed: routed.service.speed_score,
        score: routed.score,
        rerouted: routed.rerouted,
        reason: routed.reason,
      }
    : null;

  const alternatives = rankCandidates(
    {
      platform: product.platform,
      serviceType: product.service_type,
      quantity: Math.max(product.min_qty, product.provider_min),
      referenceServiceId: product.provider_service_id,
      referenceRateUsd: product.rate_usd_per_1000,
      maxCostRatio: product.max_cost_ratio,
      variant: product.variant,
    },
    6,
  ).map((candidate) => ({
    serviceId: candidate.service_id,
    name: candidate.clean_name,
    rateUsd: candidate.rate_usd_per_1000,
    drop: candidate.drop_score,
    speed: candidate.speed_score,
    score: candidate.score,
    rerouted: false,
    reason: "",
  }));

  const ctx = pricingContext();
  const margin = product.margin_override ?? ctx.marginPercent;
  const autoRatePer1000 = Math.max(
    service.rate_usd_per_1000 * ctx.usdClp * (1 + margin / 100),
    floorPer1000(product.service_type, ctx, product.level, margin),
  );

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <Link href="/admin/productos" className="text-sm text-ink-400 hover:text-white">← Productos</Link>
          <h1 className="mt-1 text-2xl font-bold">{product.name}</h1>
        </div>
        <form action={deleteProduct}>
          <input type="hidden" name="id" value={product.id} />
          <button type="submit" className="text-sm text-red-300 hover:text-red-200">Eliminar producto</button>
        </form>
      </div>

      {yaExistia ? (
        <p className="mt-4 rounded-lg border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-sm text-amber-100">
          Ese servicio ya tenía este producto, así que te traje al que existe en vez de crear uno repetido.
        </p>
      ) : null}

      {creado ? (
        <p className="mt-4 rounded-lg border border-lime-500/30 bg-lime-500/10 px-4 py-2.5 text-sm text-lime-200">
          Producto creado. Completa los textos y marca «Publicado en la tienda» cuando esté listo.
        </p>
      ) : null}

      <div className="mt-6">
        <ProductForm
          product={product}
          service={service}
          routing={routing}
          alternatives={alternatives}
          tiers={getPricedTiers(product)}
          bullets={parseJson<string[]>(product.bullets_json, [])}
          faq={parseJson<FaqItem[]>(product.faq_json, [])}
          platformOptions={PLATFORM_OPTIONS}
          typeOptions={SERVICE_TYPE_OPTIONS}
          autoRatePer1000={autoRatePer1000}
        />
      </div>
    </>
  );
}
