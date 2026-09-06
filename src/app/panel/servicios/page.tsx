import Link from "next/link";
import { redirect } from "next/navigation";
import { panelUser } from "@/lib/reseller-auth";
import {
  listarServicios, contarServicios, resumenDeRedes, serviciosPorCategoria,
  etiquetaRetencion, etiquetaVelocidad, VISTA_PREVIA_CATEGORIA, type ServicioPanel,
} from "@/lib/reseller-catalog";
import { platformLabel, serviceTypeLabel } from "@/lib/labels";
import { PlatformIcon } from "@/components/icons";
import { formatClp, formatNumber, formatDuration } from "@/lib/pricing";

export const dynamic = "force-dynamic";

/**
 * Catálogo del panel, en dos pasos.
 *
 * Sin red elegida se muestran las redes; dentro de una red, sus categorías
 * plegadas con el número de servicios de cada una. Antes era una lista plana de
 * casi dos mil filas paginada de a cuarenta: para llegar a "seguidores de
 * Instagram" había que pasar veinte páginas de Audiomack.
 *
 * El buscador se salta los dos pasos y devuelve resultados planos de todo el
 * catálogo, que es lo que hace falta cuando ya se sabe qué se quiere.
 */

const MAX_BUSQUEDA = 60;

function Barra({ valor, titulo }: { valor: number; titulo: string }) {
  const tono =
    valor >= 80 ? "bg-lime-400" : valor >= 60 ? "bg-brand-400" : valor >= 40 ? "bg-amber-400" : "bg-red-400";
  return (
    <span className="flex items-center gap-1.5" title={`${titulo}: ${valor}/100`}>
      <span className="h-1.5 w-8 shrink-0 overflow-hidden rounded-full bg-white/10">
        <span className={`block h-full rounded-full ${tono}`} style={{ width: `${valor}%` }} />
      </span>
      <span className="whitespace-nowrap text-[11px] text-ink-400">{titulo}</span>
    </span>
  );
}

/**
 * Una fila de servicio.
 *
 * En escritorio es una tabla: nombre, calidad, rango, precio y botón en
 * columnas alineadas. En teléfono se dobla en dos alturas —el nombre completo
 * arriba, el precio y el botón abajo— porque recortar el nombre a "Instagram
 * Follo…" deja al cliente eligiendo entre doce servicios idénticos.
 */
function Fila({ s, mostrarRed = false }: { s: ServicioPanel; mostrarRed?: boolean }) {
  const reposicion =
    s.refill_days >= 9999
      ? "reposición ∞"
      : s.refill_days > 0
        ? `reposición ${s.refill_days} d`
        : s.refill === 1
          ? "con reposición"
          : null;

  return (
    <div className="border-b border-white/6 px-4 py-3 last:border-0 hover:bg-white/3 sm:flex sm:items-center sm:gap-4">
      <div className="min-w-0 sm:flex-1">
        <div className="flex flex-wrap items-center gap-1.5 text-[11px] text-ink-400">
          <span className="font-mono">#{s.service_id}</span>
          {mostrarRed ? (
            <span className="rounded bg-white/8 px-1.5 py-0.5 text-ink-200">
              {platformLabel(s.platform)} · {serviceTypeLabel(s.service_type)}
            </span>
          ) : null}
          {reposicion ? (
            <span className="rounded bg-lime-500/15 px-1.5 py-0.5 text-lime-300">{reposicion}</span>
          ) : null}
          {s.order_kind === "custom_comments" ? (
            <span className="rounded bg-brand-500/20 px-1.5 py-0.5 text-brand-300">
              comentarios propios
            </span>
          ) : null}
        </div>

        {/* Dos líneas en teléfono, una recortada en escritorio: en la tabla el
            recorte mantiene las columnas alineadas y el nombre completo está en
            el título emergente y en la ficha del pedido. */}
        <p className="mt-1 line-clamp-2 text-sm font-medium sm:truncate" title={s.clean_name || s.name}>
          {s.clean_name || s.name}
        </p>

        {/* En teléfono los datos van aquí, en texto, en vez de en columnas. */}
        <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-ink-400 sm:hidden">
          <span>{etiquetaRetencion(s.drop_score)}</span>
          <span className="text-ink-600">·</span>
          <span>{etiquetaVelocidad(s.speed_score)}</span>
          <span className="text-ink-600">·</span>
          <span>{formatNumber(s.min_qty)} – {formatNumber(s.max_qty)} u.</span>
          {formatDuration(s.avg_minutes) ? (
            <>
              <span className="text-ink-600">·</span>
              <span>≈ {formatDuration(s.avg_minutes)}</span>
            </>
          ) : null}
        </p>
      </div>

      <div className="mt-2.5 flex items-center justify-between gap-4 sm:mt-0 sm:justify-end">
        <div className="hidden w-36 shrink-0 flex-col gap-1 sm:flex">
          <Barra valor={s.drop_score} titulo={etiquetaRetencion(s.drop_score)} />
          <Barra valor={s.speed_score} titulo={etiquetaVelocidad(s.speed_score)} />
        </div>
        <div className="hidden w-32 shrink-0 text-[11px] leading-tight text-ink-400 lg:block">
          {formatNumber(s.min_qty)} – {formatNumber(s.max_qty)} u.
          {formatDuration(s.avg_minutes) ? (
            <span className="block">≈ {formatDuration(s.avg_minutes)}</span>
          ) : null}
        </div>
        <div className="shrink-0 sm:w-24 sm:text-right">
          <p className="text-[10px] uppercase tracking-wide text-ink-400">por 1.000</p>
          <p className="font-bold tracking-tight">{formatClp(s.ratePer1000Clp)}</p>
        </div>
        <Link
          href={`/panel/nuevo?servicio=${s.service_id}`}
          className="shrink-0 rounded-lg border border-white/12 bg-white/6 px-4 py-2 text-sm font-semibold text-white transition-colors hover:border-brand-400/60 hover:bg-brand-500/20 sm:px-3 sm:py-1.5"
        >
          Pedir
        </Link>
      </div>
    </div>
  );
}

function Buscador({ q, red }: { q?: string; red?: string }) {
  return (
    <form className="flex flex-wrap items-center gap-2">
      {red ? <input type="hidden" name="red" value={red} /> : null}
      <input
        name="q"
        defaultValue={q ?? ""}
        className="field min-w-0 flex-1 sm:max-w-sm sm:flex-none"
        placeholder="Buscar por nombre o ID de servicio"
      />
      <button type="submit" className="btn btn-ghost text-sm">Buscar</button>
      {q ? (
        <Link href={red ? `/panel/servicios?red=${red}` : "/panel/servicios"} className="btn btn-ghost text-sm">
          Limpiar
        </Link>
      ) : null}
    </form>
  );
}

export default async function PanelServiciosPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; red?: string; cat?: string; p?: string }>;
}) {
  const user = await panelUser();
  if (!user) redirect("/panel/entrar");

  const { q, red, cat, p } = await searchParams;
  const buscando = Boolean(q?.trim());

  const cabecera = (
    <div className="flex flex-wrap items-end justify-between gap-4">
      <h1 className="text-2xl font-bold">Servicios</h1>
      <span className="hidden rounded-lg border border-white/12 bg-white/6 px-3 py-1.5 text-sm sm:inline-block">
        Saldo: <strong className="text-lime-400">{formatClp(user.balance_clp)}</strong>
      </span>
    </div>
  );

  // ------------------------------------------------------------- buscando
  if (buscando) {
    const filtro = { q, platform: red, limit: MAX_BUSQUEDA };
    const total = contarServicios({ q, platform: red });
    const resultados = listarServicios(filtro, user.discount_percent);

    return (
      <>
        {cabecera}
        <div className="mt-6">
          <Buscador q={q} red={red} />
        </div>
        <p className="mt-4 text-sm text-ink-400">
          {formatNumber(total)} resultado{total === 1 ? "" : "s"} para «{q}»
          {red ? ` en ${platformLabel(red)}` : ""}
          {total > MAX_BUSQUEDA ? ` · se muestran ${MAX_BUSQUEDA}` : ""}
        </p>

        <div className="card mt-3 overflow-hidden">
          {resultados.map((s) => (
            <Fila key={s.service_id} s={s} mostrarRed />
          ))}
          {resultados.length === 0 ? (
            <p className="p-10 text-center text-sm text-ink-400">Sin resultados.</p>
          ) : null}
        </div>
      </>
    );
  }

  // ------------------------------------------- una categoría de una red
  if (red && cat) {
    const POR_PAGINA = 40;
    const pagina = Math.max(1, Number(p) || 1);
    const filtro = { platform: red, serviceType: cat, limit: POR_PAGINA, offset: (pagina - 1) * POR_PAGINA };
    const total = contarServicios({ platform: red, serviceType: cat });
    if (total === 0) redirect(`/panel/servicios?red=${red}`);
    const servicios = listarServicios(filtro, user.discount_percent);
    const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));

    return (
      <>
        {cabecera}

        <nav className="mt-5 flex flex-wrap items-center gap-1.5 text-sm">
          <Link href="/panel/servicios" className="text-ink-400 hover:text-white">Todas las redes</Link>
          <span className="text-ink-600">/</span>
          <Link href={`/panel/servicios?red=${red}`} className="text-ink-400 hover:text-white">
            {platformLabel(red)}
          </Link>
          <span className="text-ink-600">/</span>
          <span className="font-semibold">{serviceTypeLabel(cat)}</span>
          <span className="text-xs text-ink-400">· {formatNumber(total)} servicios</span>
        </nav>

        <div className="mt-4">
          <Buscador red={red} />
        </div>

        <div className="card mt-5 overflow-hidden">
          {servicios.map((s) => (
            <Fila key={s.service_id} s={s} />
          ))}
        </div>

        {paginas > 1 ? (
          <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
            {pagina > 1 ? (
              <Link
                href={`/panel/servicios?red=${red}&cat=${cat}&p=${pagina - 1}`}
                className="rounded-lg bg-white/6 px-3 py-1.5 text-sm"
              >
                ← Anterior
              </Link>
            ) : null}
            <span className="px-3 py-1.5 text-sm text-ink-400">Página {pagina} de {paginas}</span>
            {pagina < paginas ? (
              <Link
                href={`/panel/servicios?red=${red}&cat=${cat}&p=${pagina + 1}`}
                className="rounded-lg bg-white/6 px-3 py-1.5 text-sm"
              >
                Siguiente →
              </Link>
            ) : null}
          </div>
        ) : null}
      </>
    );
  }

  // ------------------------------------------------------ una red elegida
  if (red) {
    const grupos = serviciosPorCategoria(red, user.discount_percent);
    if (grupos.length === 0) redirect("/panel/servicios");
    const total = grupos.reduce((suma, g) => suma + g.total, 0);

    return (
      <>
        {cabecera}

        <nav className="mt-5 flex flex-wrap items-center gap-1.5 text-sm">
          <Link href="/panel/servicios" className="text-ink-400 hover:text-white">Todas las redes</Link>
          <span className="text-ink-600">/</span>
          <span className="flex items-center gap-1.5 font-semibold">
            <PlatformIcon slug={red} className="h-4 w-4 text-brand-300" />
            {platformLabel(red)}
          </span>
          <span className="text-xs text-ink-400">· {formatNumber(total)} servicios</span>
        </nav>

        <div className="mt-4">
          <Buscador red={red} />
        </div>

        <div className="mt-6 space-y-3">
          {grupos.map((grupo) => (
            /* Cerradas: la página de la red tiene que caber en una pantalla y
               mostrar de qué hay, no volcarlo todo encima. */
            <details
              key={grupo.serviceType}
              className="card group overflow-hidden [&_summary::-webkit-details-marker]:hidden"
            >
              <summary className="flex cursor-pointer items-center gap-3 px-4 py-3.5 hover:bg-white/3">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{serviceTypeLabel(grupo.serviceType)}</span>
                    <span className="rounded-full bg-white/8 px-2 py-0.5 text-[11px] text-ink-200">
                      {formatNumber(grupo.total)}
                    </span>
                  </div>
                  <span className="mt-0.5 block text-xs text-ink-400">
                    desde {formatClp(Math.min(...grupo.servicios.map((s) => s.ratePer1000Clp)))} por 1.000
                  </span>
                </div>
                <span className="shrink-0 text-ink-400 transition-transform group-open:rotate-180">▾</span>
              </summary>

              <div className="border-t border-white/8">
                {grupo.servicios.map((s) => (
                  <Fila key={s.service_id} s={s} />
                ))}
                {grupo.total > VISTA_PREVIA_CATEGORIA ? (
                  <Link
                    href={`/panel/servicios?red=${red}&cat=${grupo.serviceType}`}
                    className="flex items-center justify-center gap-1.5 border-t border-white/6 px-4 py-3 text-sm font-semibold text-brand-300 hover:bg-white/4 hover:text-white"
                  >
                    Ver los {formatNumber(grupo.total)} →
                  </Link>
                ) : null}
              </div>
            </details>
          ))}
        </div>
      </>
    );
  }

  // ---------------------------------------------------------- las redes
  const redes = resumenDeRedes(user.discount_percent);
  const totalServicios = redes.reduce((suma, r) => suma + r.servicios, 0);

  return (
    <>
      {cabecera}

      <div className="mt-6">
        <Buscador />
      </div>

      <p className="mt-5 text-sm text-ink-400">
        {formatNumber(totalServicios)} servicios en {redes.length} redes
      </p>

      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {redes.map((r) => (
          <Link
            key={r.platform}
            href={`/panel/servicios?red=${r.platform}`}
            className="card card-hover flex items-center gap-4 p-4"
          >
            <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br from-brand-500/30 to-accent-500/25 text-brand-300">
              <PlatformIcon slug={r.platform} className="h-5 w-5" />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-semibold">{platformLabel(r.platform)}</p>
              <p className="mt-0.5 text-xs text-ink-400">
                {formatNumber(r.servicios)} servicios
                {r.conReposicion > 0 ? ` · ${formatNumber(r.conReposicion)} con reposición` : ""}
              </p>
            </div>
            <div className="shrink-0 text-right">
              <p className="text-[10px] uppercase tracking-wide text-ink-400">desde</p>
              <p className="text-sm font-bold">{formatClp(r.desdeClp)}</p>
              <p className="text-[10px] text-ink-400">/1.000</p>
            </div>
          </Link>
        ))}
      </div>
    </>
  );
}
