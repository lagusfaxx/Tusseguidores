import Link from "next/link";
import { redirect } from "next/navigation";
import { panelUser } from "@/lib/reseller-auth";
import {
  contarServicios, listarServicios, redesDelPanel, tiposDelPanel,
  etiquetaRetencion, etiquetaVelocidad,
} from "@/lib/reseller-catalog";
import { platformLabel, serviceTypeLabel } from "@/lib/labels";
import { formatClp, formatNumber, formatDuration } from "@/lib/pricing";

export const dynamic = "force-dynamic";

const POR_PAGINA = 40;

/** Barra de 0 a 100 para leer el puntaje de un vistazo. */
function Barra({ valor, titulo }: { valor: number; titulo: string }) {
  const tono = valor >= 80 ? "bg-lime-400" : valor >= 60 ? "bg-brand-400" : valor >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <span className="flex items-center gap-1.5" title={`${titulo}: ${valor}/100`}>
      <span className="h-1.5 w-10 overflow-hidden rounded-full bg-white/10">
        <span className={`block h-full rounded-full ${tono}`} style={{ width: `${valor}%` }} />
      </span>
      <span className="whitespace-nowrap text-[11px] text-ink-400">{titulo}</span>
    </span>
  );
}

export default async function PanelServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; red?: string; tipo?: string; refill?: string; p?: string }>;
}) {
  const user = await panelUser();
  if (!user) redirect("/panel/entrar");

  const { q, red, tipo, refill, p } = await searchParams;
  const page = Math.max(1, Number(p) || 1);
  const filtro = {
    q,
    platform: red,
    serviceType: tipo,
    refill: refill === "1",
    limit: POR_PAGINA,
    offset: (page - 1) * POR_PAGINA,
  };

  const total = contarServicios(filtro);
  const servicios = listarServicios(filtro, user.discount_percent);
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const redes = redesDelPanel();
  const tipos = tiposDelPanel();

  const url = (extra: Record<string, string | number>) => {
    const sp = new URLSearchParams();
    if (q) sp.set("q", q);
    if (red) sp.set("red", red);
    if (tipo) sp.set("tipo", tipo);
    if (refill) sp.set("refill", refill);
    for (const [k, v] of Object.entries(extra)) sp.set(k, String(v));
    return `/panel/servicios?${sp}`;
  };

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Servicios</h1>
          <p className="mt-1 text-sm text-ink-400">
            {formatNumber(total)} servicios al precio mayorista. El precio que ves es por cada 1.000
            unidades; en el pedido se cobra la cantidad exacta.
          </p>
        </div>
        <span className="rounded-lg border border-white/12 bg-white/6 px-3 py-1.5 text-sm">
          Saldo: <strong className="text-lime-400">{formatClp(user.balance_clp)}</strong>
        </span>
      </div>

      <form className="mt-6 flex flex-wrap gap-3">
        <input name="q" defaultValue={q ?? ""} className="field max-w-xs" placeholder="Buscar servicio o ID" />
        <select name="red" defaultValue={red ?? ""} className="field max-w-[170px]">
          <option value="">Todas las redes</option>
          {redes.map((r) => (
            <option key={r.platform} value={r.platform}>
              {platformLabel(r.platform)} ({r.n})
            </option>
          ))}
        </select>
        <select name="tipo" defaultValue={tipo ?? ""} className="field max-w-[170px]">
          <option value="">Todos los tipos</option>
          {tipos.map((t) => (
            <option key={t.service_type} value={t.service_type}>
              {serviceTypeLabel(t.service_type)} ({t.n})
            </option>
          ))}
        </select>
        <label className="flex items-center gap-2 text-sm text-ink-200">
          <input type="checkbox" name="refill" value="1" defaultChecked={refill === "1"} className="h-4 w-4 accent-[#7c3aed]" />
          Solo con reposición
        </label>
        <button type="submit" className="btn btn-ghost text-sm">Filtrar</button>
      </form>

      <div className="mt-6 space-y-2.5">
        {servicios.map((s) => (
          <div key={s.service_id} className="card flex flex-wrap items-center gap-x-5 gap-y-3 p-4">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2 text-[11px] text-ink-400">
                <span className="font-mono">#{s.service_id}</span>
                <span className="rounded bg-white/8 px-1.5 py-0.5 text-ink-200">
                  {platformLabel(s.platform)}
                </span>
                <span className="rounded bg-white/8 px-1.5 py-0.5 text-ink-200">
                  {serviceTypeLabel(s.service_type)}
                </span>
                {s.refill_days > 0 || s.refill === 1 ? (
                  <span className="rounded bg-lime-500/15 px-1.5 py-0.5 text-lime-300">
                    {s.refill_days >= 9999
                      ? "reposición de por vida"
                      : s.refill_days > 0
                        ? `reposición ${s.refill_days} d`
                        : "con reposición"}
                  </span>
                ) : null}
                {s.order_kind === "custom_comments" ? (
                  <span className="rounded bg-brand-500/20 px-1.5 py-0.5 text-brand-300">
                    comentarios personalizados
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-sm font-semibold leading-snug">{s.clean_name || s.name}</p>
              <div className="mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1.5">
                <Barra valor={s.drop_score} titulo={etiquetaRetencion(s.drop_score)} />
                <Barra valor={s.speed_score} titulo={etiquetaVelocidad(s.speed_score)} />
                <span className="text-[11px] text-ink-400">
                  {formatNumber(s.min_qty)} – {formatNumber(s.max_qty)} u.
                </span>
                {formatDuration(s.avg_minutes) ? (
                  <span className="text-[11px] text-ink-400">≈ {formatDuration(s.avg_minutes)}</span>
                ) : null}
              </div>
            </div>

            <div className="flex items-center gap-4">
              <div className="text-right">
                <p className="text-[11px] text-ink-400">por 1.000</p>
                <p className="text-lg font-extrabold tracking-tight">
                  {formatClp(s.ratePer1000Clp)}
                </p>
              </div>
              <Link
                href={`/panel/nuevo?servicio=${s.service_id}`}
                className="btn btn-primary whitespace-nowrap px-4 py-2 text-sm"
              >
                Pedir
              </Link>
            </div>
          </div>
        ))}
        {servicios.length === 0 ? (
          <p className="card p-10 text-center text-sm text-ink-400">
            No hay servicios con ese filtro.
          </p>
        ) : null}
      </div>

      {paginas > 1 ? (
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {page > 1 ? (
            <Link href={url({ p: page - 1 })} className="rounded-lg bg-white/6 px-3 py-1.5 text-sm">← Anterior</Link>
          ) : null}
          <span className="px-3 py-1.5 text-sm text-ink-400">Página {page} de {paginas}</span>
          {page < paginas ? (
            <Link href={url({ p: page + 1 })} className="rounded-lg bg-white/6 px-3 py-1.5 text-sm">Siguiente →</Link>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
