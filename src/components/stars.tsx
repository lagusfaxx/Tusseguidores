import { formatRating, type Rating } from "@/lib/ratings";

/**
 * Estrellas con la nota y el número de opiniones.
 *
 * El relleno parcial se hace con dos filas superpuestas y un recorte por
 * ancho: así una nota de 4,8 se ve como 4,8 y no como 5 redondeado, sin pedir
 * una imagen por cada décima.
 */
export function Stars({
  rating,
  className = "",
  tamano = "sm",
  conTexto = true,
}: {
  rating: Rating;
  className?: string;
  tamano?: "sm" | "md";
  conTexto?: boolean;
}) {
  const alto = tamano === "md" ? "h-4 w-4" : "h-3.5 w-3.5";
  const porcentaje = Math.max(0, Math.min(100, (rating.value / rating.best) * 100));

  const fila = (color: string) => (
    <span className="flex" aria-hidden="true">
      {Array.from({ length: rating.best }, (_, i) => (
        <svg key={i} viewBox="0 0 24 24" fill="currentColor" className={`${alto} ${color}`}>
          <path d="m12 17.27 5.18 3.13-1.37-5.9L20.4 9.5l-6.04-.52L12 3.4 9.64 8.98 3.6 9.5l4.59 4l-1.37 5.9L12 17.27Z" />
        </svg>
      ))}
    </span>
  );

  return (
    <span
      className={`inline-flex items-center gap-1.5 ${className}`}
      title={`${formatRating(rating.value)} de ${rating.best} según ${rating.count} opiniones`}
    >
      <span className="relative inline-flex">
        {fila("text-white/15")}
        <span
          className="absolute inset-y-0 left-0 overflow-hidden"
          style={{ width: `${porcentaje}%` }}
        >
          {fila("text-amber-400")}
        </span>
      </span>
      {conTexto ? (
        <span className={tamano === "md" ? "text-sm text-ink-200" : "text-xs text-ink-300"}>
          <strong className="font-semibold text-white">{formatRating(rating.value)}</strong>
          <span className="text-ink-400"> · {rating.count.toLocaleString("es-CL")} opiniones</span>
        </span>
      ) : null}
      <span className="sr-only">
        {formatRating(rating.value)} de {rating.best} estrellas según {rating.count} opiniones
      </span>
    </span>
  );
}

/**
 * Versión de una sola estrella con la nota al lado. Va en las tarjetas del
 * catálogo, donde cinco estrellas se comen la fila de etiquetas.
 */
export function RatingChip({ rating, className = "" }: { rating: Rating; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-md bg-white/6 px-1.5 py-0.5 text-[11px] text-ink-200 ${className}`}
      title={`${formatRating(rating.value)} de ${rating.best} según ${rating.count} opiniones`}
    >
      <svg viewBox="0 0 24 24" fill="currentColor" className="h-3 w-3 text-amber-400" aria-hidden="true">
        <path d="m12 17.27 5.18 3.13-1.37-5.9L20.4 9.5l-6.04-.52L12 3.4 9.64 8.98 3.6 9.5l4.59 4l-1.37 5.9L12 17.27Z" />
      </svg>
      {formatRating(rating.value)}
      <span className="sr-only"> de {rating.best} estrellas según {rating.count} opiniones</span>
    </span>
  );
}
