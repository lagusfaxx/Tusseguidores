import Link from "next/link";
import { all, get } from "@/lib/db";
import { createFromService } from "@/app/admin/actions";
import { SyncCatalogButton } from "@/components/sync-catalog";
import { serviceTypeLabel, PLATFORM_OPTIONS, SERVICE_TYPE_OPTIONS } from "@/lib/labels";
import { formatClp, formatNumber, pricingContext, priceBreakdown } from "@/lib/pricing";
import { cantidadDeReferencia } from "@/lib/offers";
import { formatDateCl } from "@/lib/utils";

export const dynamic = "force-dynamic";

const PAGE_SIZE = 50;

type Row = {
  service_id: number;
  clean_name: string;
  category: string;
  platform: string;
  service_type: string;
  rate_usd_per_1000: number;
  min_qty: number;
  max_qty: number;
  refill: number;
  order_kind: string;
  drop_score: number;
  speed_score: number;
  geo: string;
  variant: string;
  provider_enabled: number;
  synced_at: string;
  used: number;
};

/** Barra compacta 0-100 para leer los puntajes de un vistazo. */
function ScoreBar({ value }: { value: number }) {
  const tone = value >= 80 ? "bg-lime-400" : value >= 60 ? "bg-brand-400" : value >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <span className="flex items-center gap-1.5">
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-white/10">
        <span className={`block h-full rounded-full ${tone}`} style={{ width: `${value}%` }} />
      </span>
      <span className="text-[11px] text-ink-400">{value}</span>
    </span>
  );
}

export default async function AdminCatalogPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; red?: string; tipo?: string; estado?: string; p?: string; error?: string }>;
}) {
  const { q, red, tipo, estado, p, error } = await searchParams;
  const page = Math.max(1, Number(p) || 1);

  const where: string[] = [];
  const params: unknown[] = [];
  if (q?.trim()) {
    where.push("(s.clean_name LIKE ? OR s.name LIKE ? OR CAST(s.service_id AS TEXT) = ?)");
    params.push(`%${q.trim()}%`, `%${q.trim()}%`, q.trim());
  }
  if (red) { where.push("s.platform = ?"); params.push(red); }
  if (tipo) { where.push("s.service_type = ?"); params.push(tipo); }
  if (estado === "baja") where.push("s.provider_enabled = 0");
  else if (estado === "enrutables") where.push("s.provider_enabled = 1 AND s.variant = '' AND s.geo IN ('global','latam','western')");
  else if (estado !== "todos") where.push("s.provider_enabled = 1");
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const total = get<{ n: number }>(`SELECT COUNT(*) AS n FROM provider_services s ${clause}`, params)?.n ?? 0;
  const rows = all<Row>(
    `SELECT s.*, (SELECT COUNT(*) FROM products p WHERE p.provider_service_id = s.service_id) AS used
       FROM provider_services s ${clause}
      ORDER BY s.platform, s.service_type,
               (s.drop_score * 0.55 + s.speed_score * 0.45) DESC, s.rate_usd_per_1000
      LIMIT ? OFFSET ?`,
    [...params, PAGE_SIZE, (page - 1) * PAGE_SIZE],
  );
  const pages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const ctx = pricingContext();

  // El precio se calcula a la cantidad con la que se vende ese tipo de
  // servicio, no siempre a 1.000: comparar comentarios de a mil no dice nada.
  const precios = Object.fromEntries(
    rows.map((row) => [
      row.service_id,
      priceBreakdown(
        row.rate_usd_per_1000,
        cantidadDeReferencia(row.service_type, row.order_kind),
        row.order_kind === "custom_comments" ? "comentarios" : row.service_type,
        ctx,
      ),
    ]),
  );

  const lastSync = get<{ at: string }>("SELECT MAX(synced_at) AS at FROM provider_services")?.at;

  const query = (extra: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (red) sp.set("red", red);
    if (tipo) sp.set("tipo", tipo);
    if (estado) sp.set("estado", estado);
    for (const [key, value] of Object.entries(extra)) sp.set(key, String(value));
    return `/admin/catalogo?${sp}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Catálogo del proveedor</h1>
          <p className="mt-1 text-sm text-ink-400">
            {formatNumber(total)} servicios · última sincronización {formatDateCl(lastSync)} ·
          precios calculados con el dólar a {formatClp(ctx.usdClp)} y {ctx.marginPercent}% de margen
          </p>
        </div>
        <SyncCatalogButton />
      </div>

      {error ? (
        <p className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <form className="mt-6 flex flex-wrap gap-3">
        <input name="q" defaultValue={q ?? ""} className="field max-w-xs" placeholder="Buscar por nombre o ID" />
        <select name="red" defaultValue={red ?? ""} className="field max-w-[170px]">
          <option value="">Todas las redes</option>
          {PLATFORM_OPTIONS.map((option) => (
            <option key={option.slug} value={option.slug}>{option.label}</option>
          ))}
        </select>
        <select name="tipo" defaultValue={tipo ?? ""} className="field max-w-[170px]">
          <option value="">Todos los servicios</option>
          {SERVICE_TYPE_OPTIONS.map((option) => (
            <option key={option.slug} value={option.slug}>{option.label}</option>
          ))}
        </select>
        <select name="estado" defaultValue={estado ?? ""} className="field max-w-[150px]">
          <option value="">Activos</option>
          <option value="enrutables">Solo enrutables</option>
          <option value="baja">Dados de baja</option>
          <option value="todos">Todos</option>
        </select>
        <button type="submit" className="btn btn-ghost text-sm">Filtrar</button>
      </form>

      <div className="card mt-6 overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>ID</th><th>Servicio</th><th>Tipo</th>
              <th>Retención</th><th>Velocidad</th>
              <th>Costo /1.000</th><th>Precio de venta</th><th>Te queda</th><th>Rango</th>
              <th className="sticky right-0 bg-ink-900 text-right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.service_id} className={row.provider_enabled ? "" : "opacity-50"}>
                <td className="font-mono text-xs">{row.service_id}</td>
                <td className="max-w-[300px] min-w-[200px]">
                  <div className="truncate">{row.clean_name}</div>
                  <div className="truncate text-[11px] text-ink-400">{row.category}</div>
                </td>
                <td className="text-xs">
                  {serviceTypeLabel(row.service_type)}
                  {row.variant ? (
                    <span className="ml-1 rounded bg-white/8 px-1 py-0.5 text-[10px] text-ink-400">{row.variant}</span>
                  ) : null}
                  {row.geo !== "global" ? (
                    <span className="ml-1 rounded bg-white/8 px-1 py-0.5 text-[10px] text-ink-400">{row.geo}</span>
                  ) : null}
                </td>
                <td><ScoreBar value={row.drop_score} /></td>
                <td><ScoreBar value={row.speed_score} /></td>
                <td className="text-xs tabular-nums">US${row.rate_usd_per_1000}</td>
                <td className="whitespace-nowrap text-xs">
                  <span className="font-semibold tabular-nums text-brand-300">
                    {formatClp(precios[row.service_id].priceClp)}
                  </span>
                  <div className="text-[11px] text-ink-400">
                    por {formatNumber(cantidadDeReferencia(row.service_type, row.order_kind))}
                    {precios[row.service_id].origen !== "costo" ? (
                      <span
                        className="ml-1 rounded bg-amber-500/15 px-1 py-0.5 text-amber-300"
                        title={
                          precios[row.service_id].origen === "piso"
                            ? "El precio lo fija el mínimo por 1.000 de este tipo de servicio, no el costo. Por eso varios servicios de costo distinto valen lo mismo. Se cambia en Ajustes → Precios."
                            : "El precio lo fija el ticket mínimo de la tienda. Se cambia en Ajustes → Precios."
                        }
                      >
                        {precios[row.service_id].origen === "piso" ? "piso" : "mínimo"}
                      </span>
                    ) : null}
                  </div>
                </td>
                <td className="whitespace-nowrap text-xs tabular-nums">
                  {/* Lo primero es lo que se lleva al bolsillo; el múltiplo y el
                      costo van abajo y rotulados, para que no se confundan. */}
                  <span
                    className={
                      precios[row.service_id].gananciaClp > 0 ? "font-semibold text-lime-400" : "text-red-300"
                    }
                  >
                    {precios[row.service_id].gananciaClp >= 0 ? "+" : "−"}
                    {formatClp(Math.abs(precios[row.service_id].gananciaClp))}
                  </span>
                  <div className="text-[11px] text-ink-400">
                    {precios[row.service_id].multiplo > 0
                      ? `${precios[row.service_id].multiplo.toFixed(1)}× · `
                      : ""}
                    costo {formatClp(precios[row.service_id].costoClp)}
                  </div>
                </td>
                <td className="whitespace-nowrap text-[11px] text-ink-400">
                  {formatNumber(row.min_qty)} – {formatNumber(row.max_qty)}
                  {row.refill ? <span className="ml-1 text-lime-400">♻</span> : null}
                </td>
                <td className="sticky right-0 bg-ink-900 text-right">
                  <form action={createFromService} className="inline-flex items-center gap-2">
                    <input type="hidden" name="service_id" value={row.service_id} />
                    {row.used > 0 ? (
                      <span
                        className="rounded bg-white/8 px-1.5 py-0.5 text-[11px] text-ink-400"
                        title={`Ya hay ${row.used} producto(s) usando este servicio`}
                      >
                        {row.used}
                      </span>
                    ) : null}
                    <button
                      type="submit"
                      className="whitespace-nowrap rounded-lg border border-white/12 bg-white/6 px-2.5 py-1.5 text-xs text-ink-200 hover:border-brand-400/50 hover:text-white"
                    >
                      {row.used > 0 ? "Abrir" : "Crear"}
                    </button>
                  </form>
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={10} className="py-10 text-center text-ink-400">No hay servicios con ese filtro.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pages > 1 ? (
        <div className="mt-6 flex flex-wrap justify-center gap-2">
          {page > 1 ? <Link href={query({ p: page - 1 })} className="rounded-lg bg-white/6 px-3 py-1.5 text-sm">← Anterior</Link> : null}
          <span className="px-3 py-1.5 text-sm text-ink-400">Página {page} de {pages}</span>
          {page < pages ? <Link href={query({ p: page + 1 })} className="rounded-lg bg-white/6 px-3 py-1.5 text-sm">Siguiente →</Link> : null}
        </div>
      ) : null}
    </>
  );
}
