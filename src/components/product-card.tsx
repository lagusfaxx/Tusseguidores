import Link from "next/link";
import { highlightTier, type ProductWithService } from "@/lib/catalog";
import { formatClp, formatNumber } from "@/lib/pricing";
import { platformLabel } from "@/lib/labels";
import { levelLabel } from "@/lib/level-defs";
import { ArrowIcon, BoltIcon, PlatformIcon } from "./icons";

/**
 * Tarjeta de producto del catálogo, en dos formas.
 *
 * - La normal es una tarjeta vertical en escritorio y una fila compacta en
 *   teléfono. Todo lo que se ve está pensado para que cuatro tarjetas seguidas
 *   se lean como una tabla y no como un collage: la imagen, el título, los
 *   datos y el precio ocupan siempre el mismo alto, aunque el nombre sea de
 *   una línea o de tres. Cuando cada tarjeta medía distinto, la grilla quedaba
 *   escalonada y la tienda parecía a medio hacer.
 *
 * - Con `fila`, es una fila ancha en todas las pantallas. Se usa donde hay uno
 *   o dos productos: una tarjeta angosta sola, con tres cuartos de fila
 *   vacíos al lado, se ve como un error de la página.
 */
export function ProductCard({
  product,
  fila = false,
}: {
  product: ProductWithService;
  fila?: boolean;
}) {
  const tier = highlightTier(product);
  const nivel = levelLabel(product.level);

  const red = (
    <span className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-brand-300">
      <PlatformIcon slug={product.platform} className="h-3.5 w-3.5" />
      {platformLabel(product.platform)}
    </span>
  );

  const etiquetas = (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="inline-flex items-center gap-1 rounded-md bg-white/6 px-1.5 py-0.5 text-[11px] text-ink-200">
        <BoltIcon className="h-3 w-3 text-lime-400" />
        {product.delivery_label}
      </span>
      {product.refill_days > 0 ? (
        <span className="rounded-md bg-white/6 px-1.5 py-0.5 text-[11px] text-ink-200">
          {product.refill_days >= 9999 ? "reposición ∞" : `reposición ${product.refill_days} d`}
        </span>
      ) : null}
      {nivel ? (
        <span className="rounded-md bg-white/6 px-1.5 py-0.5 text-[11px] text-ink-200">{nivel}</span>
      ) : null}
    </div>
  );

  const precio = (
    <>
      <span className="block whitespace-nowrap text-[11px] text-ink-400">
        {tier ? `Desde · ${formatNumber(tier.quantity)} u.` : "Consultar"}
      </span>
      <span className="text-lg font-extrabold tracking-tight text-white sm:text-xl">
        {tier ? formatClp(tier.priceClp) : "—"}
      </span>
    </>
  );

  const comprar = (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-lg border border-white/12 bg-white/6 px-2.5 py-1.5 text-[13px] font-semibold text-white transition-colors group-hover:border-brand-400/60 group-hover:bg-brand-500/20 sm:px-3">
      <span className="hidden sm:inline">Comprar</span>
      <ArrowIcon />
    </span>
  );

  const miniatura = (
    <div className="relative w-[76px] shrink-0 self-start overflow-hidden rounded-lg sm:w-[104px]">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={product.image_url || "/img/productos/generico.svg"}
        alt=""
        width={300}
        height={300}
        loading="lazy"
        decoding="async"
        className="aspect-square h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04]"
      />
    </div>
  );

  if (fila) {
    return (
      <Link
        href={`/producto/${product.slug}`}
        className="card card-hover group flex items-stretch gap-3 overflow-hidden p-3 sm:gap-5 sm:p-4"
        prefetch={false}
      >
        {miniatura}
        <div className="flex min-w-0 flex-1 flex-col justify-center gap-1.5 sm:flex-row sm:items-center sm:gap-6">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              {red}
              {product.badge ? (
                <span className="rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-medium text-ink-200">
                  {product.badge}
                </span>
              ) : null}
            </div>
            <h3 className="mt-1 line-clamp-2 text-[15px] font-bold leading-snug text-white sm:text-[17px]">
              {product.name}
            </h3>
            <p className="mt-1 hidden line-clamp-1 text-sm text-ink-400 sm:block">
              {product.short_description}
            </p>
            <div className="mt-1.5">{etiquetas}</div>
          </div>
          <div className="flex items-end justify-between gap-4 sm:shrink-0 sm:items-center sm:justify-end">
            <div className="sm:min-w-[7.5rem] sm:text-right">{precio}</div>
            {comprar}
          </div>
        </div>
      </Link>
    );
  }

  return (
    <Link
      href={`/producto/${product.slug}`}
      className="card card-hover group flex h-full gap-3 overflow-hidden p-3 sm:flex-col sm:gap-0 sm:p-0"
      prefetch={false}
    >
      <div className="relative w-[76px] shrink-0 self-start overflow-hidden rounded-lg sm:aspect-[16/7] sm:w-auto sm:self-auto sm:rounded-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={product.image_url || "/img/productos/generico.svg"}
          alt=""
          width={600}
          height={400}
          loading="lazy"
          decoding="async"
          className="aspect-square h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.04] sm:aspect-auto"
        />
        {/* Velo oscuro: las portadas son degradados muy saturados y sin esto
            la etiqueta de encima no se lee. */}
        <span className="pointer-events-none absolute inset-0 hidden bg-gradient-to-t from-ink-950/85 via-ink-950/10 to-transparent sm:block" />
        <span className="absolute bottom-2 left-2.5 hidden items-center gap-1.5 text-[11px] font-semibold text-white sm:inline-flex">
          <PlatformIcon slug={product.platform} className="h-3.5 w-3.5" />
          {platformLabel(product.platform)}
        </span>
        {product.badge ? (
          <span className="absolute right-2 top-2 hidden rounded-md bg-ink-950/75 px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-white backdrop-blur sm:block">
            {product.badge}
          </span>
        ) : null}
      </div>

      <div className="flex min-w-0 flex-1 flex-col sm:p-5">
        {/* En teléfono no hay imagen grande donde poner la red: va aquí. */}
        <div className="flex items-center gap-2 sm:hidden">
          {red}
          {product.badge ? (
            <span className="ml-auto rounded bg-white/8 px-1.5 py-0.5 text-[10px] font-medium text-ink-200">
              {product.badge}
            </span>
          ) : null}
        </div>

        <h3 className="mt-1 line-clamp-2 text-[15px] font-bold leading-snug text-white sm:mt-0 sm:min-h-[2.75rem] sm:text-[17px]">
          {product.name}
        </h3>

        {/* Alto fijo: sin esto, una descripción de una línea sube el precio de
            esa tarjeta y desalinea toda la fila. */}
        <p className="mt-1.5 hidden line-clamp-2 min-h-[2.5rem] text-sm leading-relaxed text-ink-400 sm:block">
          {product.short_description}
        </p>

        <div className="mt-1.5 sm:mt-3">{etiquetas}</div>

        <div className="mt-2.5 flex items-end justify-between gap-3 border-white/8 sm:mt-auto sm:border-t sm:pt-4">
          <div>{precio}</div>
          {comprar}
        </div>
      </div>
    </Link>
  );
}
