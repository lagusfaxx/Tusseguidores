import "server-only";
import { get, rescoreServices } from "./db";
import { getBoolSetting, getNumberSetting, invalidateSettings, setSettings } from "./settings";
import { retryUndispatched, syncOpenOrders } from "./orders";
import { publicarNiveles, refrescarEtiquetasDeEntrega } from "./autolevels";
import { resumirSincronizacion, sincronizarProveedores } from "./catalog-sync";
import { algunProveedorConfigurado, refreshBalances } from "./provider";

/**
 * El trabajo de fondo de la tienda, en un solo lugar.
 *
 * Lo corre el reloj interno (instrumentation.ts) cada diez minutos y también
 * el cron de /api/cron/sincronizar, si lo tienes configurado. Las dos vías
 * hacen exactamente lo mismo, así que tener ambas no duplica nada: el candado
 * de abajo evita que se pisen, y el catálogo solo se baja cuando toca.
 *
 * Cada pasada:
 * 1. Reintenta los pedidos pagados que no salieron (al recargar saldo, salen solos).
 * 2. Actualiza el estado de los pedidos en curso con cada proveedor.
 * 3. Refresca el saldo de los proveedores.
 * 4. Cada tantas horas (6 por defecto): baja el catálogo de todos los
 *    proveedores, recalcula la calidad de cada servicio y, con los niveles
 *    automáticos activos, vuelve a armar económico / estándar / premium.
 */

export type ResultadoMantenimiento = {
  reenvios: { intentados: number; enviados: number };
  estados: { checked: number; updated: number };
  catalogo: string | null;
  calidad: { servicios: number; etiquetas: number } | null;
  niveles: ReturnType<typeof publicarNiveles> | null;
  error?: string;
};

declare global {
  // Una sola pasada a la vez, aunque el reloj y el cron coincidan.
  var __tsMantenimiento: Promise<ResultadoMantenimiento> | undefined;
}

/** Cada cuántas horas se baja el catálogo. 0 = nunca solo. */
export function horasEntreSincronizaciones(): number {
  return Math.max(0, getNumberSetting("auto_sync_catalog_hours", 6));
}

/** Cuándo se bajó el catálogo por última vez, de cualquier proveedor. */
export function ultimaSincronizacion(): Date | null {
  const at = get<{ at: string | null }>(
    "SELECT MAX(synced_at) AS at FROM provider_services WHERE provider_enabled = 1",
  )?.at;
  if (!at) return null;
  const fecha = new Date(`${at.replace(" ", "T")}Z`);
  return Number.isNaN(fecha.getTime()) ? null : fecha;
}

function tocaCatalogo(forzar: boolean): boolean {
  if (forzar) return true;
  const horas = horasEntreSincronizaciones();
  if (horas <= 0) return false;
  const ultima = ultimaSincronizacion();
  return !ultima || Date.now() - ultima.getTime() >= horas * 60 * 60 * 1000;
}

async function pasada(forzarCatalogo: boolean): Promise<ResultadoMantenimiento> {
  // Los ajustes viven en memoria 15 segundos por módulo: una pasada larga
  // tiene que leer lo último que guardaste en el panel.
  invalidateSettings();
  const resultado: ResultadoMantenimiento = {
    reenvios: { intentados: 0, enviados: 0 },
    estados: { checked: 0, updated: 0 },
    catalogo: null,
    calidad: null,
    niveles: null,
  };
  if (!algunProveedorConfigurado()) return resultado;

  // Primero lo que toca plata del cliente: pedidos pagados y en curso.
  resultado.reenvios = await retryUndispatched(25);
  resultado.estados = await syncOpenOrders(200);
  await refreshBalances();

  if (tocaCatalogo(forzarCatalogo)) {
    const sincronizados = await sincronizarProveedores();
    resultado.catalogo = resumirSincronizacion(sincronizados);
    if (sincronizados.some((r) => r.ok)) {
      // La calidad se recalcula con el catálogo recién bajado, y los plazos que
      // muestran los productos se ponen al día con ella.
      resultado.calidad = { servicios: rescoreServices(), etiquetas: refrescarEtiquetasDeEntrega() };
    }
  }

  // Los niveles se reacomodan en cada pasada, como hacía el cron: si un
  // servicio se dio de baja, entra el mejor que quede sin esperar seis horas.
  if (getBoolSetting("auto_levels", true)) {
    resultado.niveles = publicarNiveles({ publicar: true });
  }

  setSettings({ mantenimiento_at: new Date().toISOString() });
  return resultado;
}

/**
 * Corre una pasada, o se suma a la que ya está en curso.
 *
 * @param forzarCatalogo  baja el catálogo aunque no hayan pasado las horas.
 */
export function correrMantenimiento(forzarCatalogo = false): Promise<ResultadoMantenimiento> {
  if (globalThis.__tsMantenimiento) return globalThis.__tsMantenimiento;
  const trabajo = pasada(forzarCatalogo)
    .catch((error): ResultadoMantenimiento => ({
      reenvios: { intentados: 0, enviados: 0 },
      estados: { checked: 0, updated: 0 },
      catalogo: null,
      calidad: null,
      niveles: null,
      error: error instanceof Error ? error.message : String(error),
    }))
    .finally(() => {
      globalThis.__tsMantenimiento = undefined;
    });
  globalThis.__tsMantenimiento = trabajo;
  return trabajo;
}
