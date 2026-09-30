import Link from "next/link";
import { all } from "@/lib/db";
import { SyncCatalogButton } from "@/components/sync-catalog";
import { ProviderSwitch } from "@/components/provider-switch";
import { platformLabel, PLATFORM_PRIORITY } from "@/lib/labels";
import { formatDateCl } from "@/lib/utils";
import {
  cachedBalance, LISTA_PROVEEDORES, providerConfigured, PROVEEDOR_PRINCIPAL,
} from "@/lib/provider";
import { mapaProveedorPorRed } from "@/lib/proveedor-por-red";
import { invalidateSettings } from "@/lib/settings";

export const dynamic = "force-dynamic";

type Conteo = { provider: string; platform: string; n: number };

export default async function AdminProvidersPage() {
  // Los ajustes se guardan en memoria 15 segundos por módulo, y esta página no
  // comparte módulo con la acción que mueve el interruptor: sin esto, justo
  // después de cambiar una red se vería todavía el proveedor anterior.
  invalidateSettings();
  const mapa = mapaProveedorPorRed();

  // Servicios activos por proveedor y red: dice si un proveedor puede atender
  // una red antes de pasarla a él.
  const conteos = all<Conteo>(
    `SELECT provider, platform, COUNT(*) AS n FROM provider_services
      WHERE provider_enabled = 1 AND rate_usd_per_1000 > 0
      GROUP BY provider, platform`,
  );
  const servicios = (provider: string, platform: string) =>
    conteos.find((c) => c.provider === provider && c.platform === platform)?.n ?? 0;

  const productos = all<{ platform: string; publicados: number; total: number }>(
    `SELECT platform, SUM(published) AS publicados, COUNT(*) AS total FROM products GROUP BY platform`,
  );
  // De qué proveedor son hoy los productos publicados de cada red. Puede no
  // coincidir con el interruptor: lo que el nuevo no tiene se queda con el otro.
  const porProveedor = all<{ platform: string; provider: string; n: number }>(
    `SELECT p.platform, s.provider, COUNT(*) AS n
       FROM products p JOIN provider_services s ON s.service_id = p.provider_service_id
      WHERE p.published = 1
      GROUP BY p.platform, s.provider`,
  );
  const sincronizado = all<{ provider: string; at: string | null; activos: number }>(
    `SELECT provider, MAX(synced_at) AS at, SUM(provider_enabled) AS activos
       FROM provider_services GROUP BY provider`,
  );

  const redes = [...new Set([...conteos.map((c) => c.platform), ...productos.map((p) => p.platform)])]
    .filter((platform) => platform && platform !== "otros")
    .sort((a, b) => {
      const ia = PLATFORM_PRIORITY.indexOf(a);
      const ib = PLATFORM_PRIORITY.indexOf(b);
      return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib) || a.localeCompare(b);
    });

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Proveedores</h1>
          <p className="mt-1 max-w-2xl text-sm text-ink-400">
            Elige qué proveedor atiende cada red. Al cambiarla, sus productos pasan a los servicios
            equivalentes del otro proveedor y los precios se recalculan con lo que cobra. Los pedidos
            que ya salieron siguen con el proveedor al que se mandaron.
          </p>
        </div>
        <SyncCatalogButton />
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        {LISTA_PROVEEDORES.map((def) => {
          const saldo = cachedBalance(def.id);
          const sync = sincronizado.find((s) => s.provider === def.id);
          const redesAtendidas = redes.filter(
            (red) => (mapa[red] ?? PROVEEDOR_PRINCIPAL) === def.id,
          ).length;
          const configurado = providerConfigured(def.id);
          return (
            <section key={def.id} className="card p-5">
              <div className="flex items-center justify-between gap-3">
                <h2 className="font-bold">{def.nombre}</h2>
                <span
                  className={`rounded-full border px-2 py-0.5 text-xs ${
                    configurado
                      ? "border-lime-500/30 bg-lime-500/10 text-lime-300"
                      : "border-amber-500/30 bg-amber-500/10 text-amber-200"
                  }`}
                >
                  {configurado ? "Conectado" : "Sin API key"}
                </span>
              </div>
              <dl className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div>
                  <dt className="text-xs text-ink-400">Saldo</dt>
                  <dd className="font-semibold">{saldo.usd != null ? `US$${saldo.usd.toFixed(2)}` : "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-400">Redes que atiende</dt>
                  <dd className="font-semibold">{redesAtendidas}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-400">Servicios activos</dt>
                  <dd className="font-semibold">{sync?.activos ?? 0}</dd>
                </div>
                <div>
                  <dt className="text-xs text-ink-400">Última sincronización</dt>
                  <dd className="font-semibold">{sync?.at ? formatDateCl(sync.at) : "Nunca"}</dd>
                </div>
              </dl>
              {!configurado ? (
                <p className="mt-4 text-sm text-ink-400">
                  Guarda su API key en <Link href="/admin/ajustes" className="underline">Ajustes</Link> y
                  sincroniza el catálogo para poder usarlo.
                </p>
              ) : !sync?.activos ? (
                <p className="mt-4 text-sm text-ink-400">
                  Falta sincronizar su catálogo: usa el botón de arriba.
                </p>
              ) : null}
            </section>
          );
        })}
      </div>

      <div className="card mt-6 overflow-x-auto">
        <table className="admin-table">
          <thead>
            <tr>
              <th>Red</th>
              <th>Productos</th>
              <th>Proveedor (servicios disponibles)</th>
            </tr>
          </thead>
          <tbody>
            {redes.map((red) => {
              const actual = mapa[red] ?? PROVEEDOR_PRINCIPAL;
              const prod = productos.find((p) => p.platform === red);
              const otros = porProveedor.filter((p) => p.platform === red && p.provider !== actual);
              return (
                <tr key={red}>
                  <td className="font-semibold">{platformLabel(red)}</td>
                  <td className="text-sm">
                    {prod?.publicados ?? 0} publicados
                    <span className="text-ink-400"> de {prod?.total ?? 0}</span>
                    {otros.length ? (
                      <p className="mt-1 text-xs text-amber-200">
                        {otros.reduce((sum, o) => sum + o.n, 0)} siguen con el otro proveedor: no tiene
                        equivalente.
                      </p>
                    ) : null}
                  </td>
                  <td>
                    <ProviderSwitch
                      platform={red}
                      label={platformLabel(red)}
                      actual={actual}
                      opciones={LISTA_PROVEEDORES.map((def) => ({
                        id: def.id,
                        nombre: def.nombre,
                        servicios: servicios(def.id, red),
                        configurado: providerConfigured(def.id),
                      }))}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}
