import Link from "next/link";
import { all, get } from "@/lib/db";
import { createFromService } from "@/app/admin/actions";
import { SyncCatalogButton } from "@/components/sync-catalog";
import { platformLabel, serviceTypeLabel, PLATFORM_OPTIONS, SERVICE_TYPE_OPTIONS } from "@/lib/labels";
import { formatClp, formatNumber, pricingContext, autoPriceClp } from "@/lib/pricing";
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
  searchParams: Promise<{ q?: string; red?: string; tipo?: string; estado?: string; p?: string }>;
}) {
  const { q, red, tipo, estado, p } = await searchParams;
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
            {formatNumber(total)} servicios · última sincronización {formatDateCl(lastSync)}
          </p>
        </div>
        <SyncCatalogButton />
      </div>

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
              <th>ID</th><th>Servicio</th><th>Red</th><th>Tipo</th>
              <th>Retención</th><th>Velocidad</th>
              <th>Costo /1.000</th><th>Venta 1.000</th><th>Rango</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.service_id} className={row.provider_enabled ? "" : "opacity-50"}>
                <td className="font-mono text-xs">{row.service_id}</td>
                <td className="max-w-[380px]">
                  <div className="truncate">{row.clean_name}</div>
                  <div className="truncate text-[11px] text-ink-400">{row.category}</div>
                </td>
                <td className="text-xs">{platformLabel(row.platform)}</td>
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
                <td className="text-xs">US${row.rate_usd_per_1000}</td>
                <td className="text-xs font-semibold text-brand-300">
                  {formatClp(autoPriceClp(row.rate_usd_per_1000, 1000, row.service_type, ctx))}
                </td>
                <td className="whitespace-nowrap text-[11px] text-ink-400">
                  {formatNumber(row.min_qty)} – {formatNumber(row.max_qty)}
                  {row.refill ? <span className="ml-1 text-lime-400">♻</span> : null}
                </td>
                <td className="text-right">
                  {row.used > 0 ? (
                    <span className="text-[11px] text-ink-400">{row.used} producto(s)</span>
                  ) : null}
                  <form action={createFromService} className="inline">
                    <input type="hidden" name="service_id" value={row.service_id} />
                    <button type="submit" className="ml-2 whitespace-nowrap text-xs text-brand-300 hover:text-white">
                      Crear producto
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
