import Link from "next/link";
import { all } from "@/lib/db";
import { platformLabel, serviceTypeLabel } from "@/lib/labels";
import { formatClp, formatNumber, pricingContext, autoPriceClp } from "@/lib/pricing";
import { togglePublished } from "@/app/admin/actions";
import type { Product } from "@/lib/types";

export const dynamic = "force-dynamic";

type Row = Product & {
  rate_usd_per_1000: number;
  provider_enabled: number;
  tiers: number;
  min_tier: number | null;
};

export default async function AdminProductsPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string; q?: string; problema?: string }>;
}) {
  const { estado, q, problema } = await searchParams;

  const where: string[] = [];
  const params: unknown[] = [];
  if (estado === "borradores") where.push("p.published = 0");
  if (estado === "publicados") where.push("p.published = 1");
  if (problema) where.push("s.provider_enabled = 0");
  if (q?.trim()) {
    where.push("(p.name LIKE ? OR p.slug LIKE ?)");
    params.push(`%${q.trim()}%`, `%${q.trim()}%`);
  }
  const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";

  const rows = all<Row>(
    `SELECT p.*, s.rate_usd_per_1000, s.provider_enabled,
            (SELECT COUNT(*) FROM product_tiers t WHERE t.product_id = p.id) AS tiers,
            (SELECT MIN(t.quantity) FROM product_tiers t WHERE t.product_id = p.id) AS min_tier
       FROM products p
       JOIN provider_services s ON s.service_id = p.provider_service_id
       ${clause}
      ORDER BY p.published DESC, p.sort_order, p.name`,
    params,
  );

  const ctx = pricingContext();

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Productos <span className="text-ink-400">({rows.length})</span></h1>
        <div className="flex gap-2">
          <Link href="/admin/catalogo" className="btn btn-ghost text-sm">Catálogo del proveedor</Link>
          <Link href="/admin/productos/nuevo" className="btn btn-primary text-sm">Agregar producto</Link>
        </div>
      </div>

      <form className="mt-6 flex flex-wrap gap-3">
        <input name="q" defaultValue={q ?? ""} className="field max-w-xs" placeholder="Buscar producto" />
        <select name="estado" defaultValue={estado ?? ""} className="field max-w-[180px]">
          <option value="">Todos</option>
          <option value="publicados">Publicados</option>
          <option value="borradores">Borradores</option>
        </select>
        <button type="submit" className="btn btn-ghost text-sm">Filtrar</button>
      </form>

      <div className="card mt-6 overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Producto</th><th>Red</th><th>Servicio</th><th>Desde</th>
              <th>Packs</th><th>Estado</th><th></th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const from = row.min_tier
                ? autoPriceClp(row.rate_usd_per_1000, row.min_tier, row.service_type, ctx, row.margin_override)
                : null;
              return (
                <tr key={row.id}>
                  <td>
                    <Link href={`/admin/productos/${row.id}`} className="font-semibold text-white hover:text-brand-300">
                      {row.name}
                    </Link>
                    <div className="text-[11px] text-ink-400">/producto/{row.slug}</div>
                  </td>
                  <td>{platformLabel(row.platform)}</td>
                  <td className="text-xs text-ink-400">
                    {serviceTypeLabel(row.service_type)} · #{row.provider_service_id}
                    {row.provider_enabled === 0 ? (
                      <span className="ml-1.5 rounded bg-red-500/15 px-1.5 py-0.5 text-red-300">baja</span>
                    ) : null}
                  </td>
                  <td>
                    {from ? formatClp(from) : "—"}
                    {row.min_tier ? (
                      <div className="text-[11px] text-ink-400">{formatNumber(row.min_tier)} u.</div>
                    ) : null}
                  </td>
                  <td>{row.tiers}</td>
                  <td>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                        row.published
                          ? "bg-lime-500/15 text-lime-400"
                          : "bg-white/8 text-ink-400"
                      }`}
                    >
                      {row.published ? "Publicado" : "Borrador"}
                    </span>
                    {row.featured ? <span className="ml-1.5 text-xs text-accent-400">★</span> : null}
                  </td>
                  <td className="text-right">
                    <form action={togglePublished} className="inline">
                      <input type="hidden" name="id" value={row.id} />
                      <button type="submit" className="text-xs text-ink-400 hover:text-white">
                        {row.published ? "Ocultar" : "Publicar"}
                      </button>
                    </form>
                  </td>
                </tr>
              );
            })}
            {rows.length === 0 ? (
              <tr><td colSpan={7} className="py-10 text-center text-ink-400">No hay productos con ese filtro.</td></tr>
            ) : null}
          </tbody>
        </table>
      </div>
    </>
  );
}
