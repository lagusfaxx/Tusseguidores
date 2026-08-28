import Link from "next/link";
import { cheapestTier, type ProductWithService } from "@/lib/catalog";
import { formatClp, formatNumber } from "@/lib/pricing";
import { platformLabel } from "@/lib/labels";
import { ArrowIcon, BoltIcon, PlatformIcon } from "./icons";

export function ProductCard({ product }: { product: ProductWithService }) {
  const from = cheapestTier(product);

  return (
    <Link
      href={`/producto/${product.slug}`}
      className="card card-hover group flex flex-col overflow-hidden"
      prefetch={false}
    >
      <div className="relative aspect-[3/2] overflow-hidden bg-ink-800">
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
          <span className="absolute left-3 top-3 rounded-full bg-accent-500 px-2.5 py-1 text-[11px] font-bold uppercase tracking-wide text-white">
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

        <div className="mt-4 flex items-center gap-3 text-[11px] text-ink-400">
          <span className="inline-flex items-center gap-1 rounded-md bg-white/5 px-2 py-1">
            <BoltIcon className="h-3 w-3 text-lime-400" />
            {product.delivery_label}
          </span>
          {product.refill_days > 0 ? (
            <span className="rounded-md bg-white/5 px-2 py-1">
              {product.refill_days >= 9999 ? "Reposición de por vida" : `Reposición ${product.refill_days} días`}
            </span>
          ) : null}
        </div>

        <div className="mt-5 flex items-end justify-between border-t border-white/8 pt-4">
          <div>
            <span className="block text-[11px] text-ink-400">
              Desde {from ? `${formatNumber(from.quantity)} unidades` : ""}
            </span>
            <span className="text-xl font-extrabold text-white">
              {from ? formatClp(from.priceClp) : "—"}
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
