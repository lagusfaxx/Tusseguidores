import Link from "next/link";
import { highlightTier, type ProductWithService } from "@/lib/catalog";
import { formatClp, formatNumber } from "@/lib/pricing";
import { platformLabel } from "@/lib/labels";
import { ArrowIcon, BoltIcon, PlatformIcon } from "./icons";

/**
 * En teléfono la tarjeta es una fila compacta: foto chica a la izquierda y el
 * precio a la derecha. Una tarjeta vertical con imagen grande ocupa media
 * pantalla, y ocho de esas obligan a scrollear diez pantallas para ver el
 * catálogo. Desde 640px vuelve a ser la tarjeta de siempre.
 */
export function ProductCard({ product }: { product: ProductWithService }) {
  const tier = highlightTier(product);

  return (
    <Link
      href={`/producto/${product.slug}`}
      className="card card-hover group flex gap-3 overflow-hidden p-3 sm:flex-col sm:gap-0 sm:p-0"
      prefetch={false}
    >
      <div className="relative w-24 shrink-0 overflow-hidden rounded-lg sm:aspect-[5/2] sm:w-auto sm:rounded-none">
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
          <span className="absolute left-1.5 top-1.5 hidden rounded bg-ink-950/80 px-2 py-1 text-[11px] font-semibold text-white backdrop-blur sm:block">
            {product.badge}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col sm:p-5">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold text-brand-300 sm:text-xs">
          <PlatformIcon slug={product.platform} className="h-3.5 w-3.5" />
          {platformLabel(product.platform)}
          {product.badge ? (
            <span className="ml-auto rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-medium text-ink-200 sm:hidden">
              {product.badge}
            </span>
          ) : null}
        </div>

        <h3 className="mt-1 text-[15px] font-bold leading-snug text-white sm:mt-2 sm:text-lg">
          {product.name}
        </h3>

        <p className="mt-1 line-clamp-2 hidden text-sm leading-relaxed text-ink-400 sm:block">
          {product.short_description}
        </p>

        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-400 sm:mt-4">
          <span className="inline-flex items-center gap-1">
            <BoltIcon className="h-3 w-3 text-lime-400" />
            {product.delivery_label}
          </span>
          {product.refill_days > 0 ? (
            <>
              <span className="text-ink-600">·</span>
              <span className="hidden sm:inline">
                {product.refill_days >= 9999
                  ? "reposición de por vida"
                  : `reposición ${product.refill_days} días`}
              </span>
              <span className="sm:hidden">
                {product.refill_days >= 9999 ? "reposición ∞" : `reposición ${product.refill_days}d`}
              </span>
            </>
          ) : null}
        </p>

        <div className="mt-2 flex items-end justify-between gap-3 border-white/8 pt-0 sm:mt-auto sm:border-t sm:pt-4">
          <div>
            <span className="block text-[11px] text-ink-400">
              {tier ? `${formatNumber(tier.quantity)} unidades` : ""}
            </span>
            <span className="text-lg font-extrabold text-white sm:text-xl">
              {tier ? formatClp(tier.priceClp) : "—"}
            </span>
          </div>
          <span className="flex items-center gap-1.5 text-sm font-semibold text-brand-300 transition-transform group-hover:translate-x-0.5">
            <span className="hidden sm:inline">Comprar</span>
            <ArrowIcon />
          </span>
        </div>
      </div>
    </Link>
  );
}
