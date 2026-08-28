import Link from "next/link";
import { highlightTier, type ProductWithService } from "@/lib/catalog";
import { formatClp, formatNumber } from "@/lib/pricing";
import { platformLabel } from "@/lib/labels";
import { ArrowIcon, BoltIcon, PlatformIcon } from "./icons";

export function ProductCard({ product }: { product: ProductWithService }) {
  const tier = highlightTier(product);

  return (
    <Link
      href={`/producto/${product.slug}`}
      className="card card-hover group flex flex-col overflow-hidden"
      prefetch={false}
    >
      <div className="relative aspect-[5/2] overflow-hidden bg-ink-800">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image_url || "/img/productos/generico.svg"}
          alt={`${product.name} — ${platformLabel(product.platform)}`}
          width={600}
          height={400}
          loading="lazy"
          decoding="async"
          className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
        />
        {product.badge ? (
          <span className="absolute left-3 top-3 rounded bg-ink-950/80 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur">
            {product.badge}
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col p-5">
        <div className="flex items-center gap-2 text-xs font-semibold text-brand-300">
          <PlatformIcon slug={product.platform} className="h-3.5 w-3.5" />
          {platformLabel(product.platform)}
        </div>

        <h3 className="mt-2 text-lg font-bold leading-snug text-white">{product.name}</h3>
        <p className="mt-1.5 line-clamp-2 text-sm leading-relaxed text-ink-400">{product.short_description}</p>

        <p className="mt-4 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-400">
          <span className="inline-flex items-center gap-1">
            <BoltIcon className="h-3 w-3 text-lime-400" />
            {product.delivery_label}
          </span>
          {product.refill_days > 0 ? (
            <>
              <span className="text-ink-600">·</span>
              <span>
                {product.refill_days >= 9999
                  ? "reposición de por vida"
                  : `reposición ${product.refill_days} días`}
              </span>
            </>
          ) : null}
        </p>

        <div className="mt-5 flex items-end justify-between border-t border-white/8 pt-4 [margin-top:auto]">
          <div>
            <span className="block text-[11px] text-ink-400">
              {tier ? `${formatNumber(tier.quantity)} unidades` : ""}
            </span>
            <span className="text-xl font-extrabold text-white">
              {tier ? formatClp(tier.priceClp) : "—"}
            </span>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-300 transition-transform group-hover:translate-x-0.5">
            Comprar <ArrowIcon />
          </span>
        </div>
      </div>
    </Link>
  );
}
