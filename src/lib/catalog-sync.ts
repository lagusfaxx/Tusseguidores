import "server-only";
import { all, db, get, run } from "./db";
import {
  clienteProveedor, idInterno, proveedoresConfigurados, ProviderError, PROVEEDORES,
  type ProveedorId, type ProviderServiceRow,
} from "./provider";
import { detectPlatform, detectServiceType, normalizeText } from "./taxonomy.mjs";
import {
  dropScore, speedScore, refillDaysFromName, detectGeo, detectVariant,
  orderKindFromApiType, startMinutesFromName,
} from "./quality.mjs";

/**
 * Guardar en la base el catálogo que devolvió el proveedor.
 *
 * Vive aparte de la acción del panel porque no es solo del panel: el MCP hace
 * exactamente el mismo trabajo, y tener dos copias de esto garantizaba que una
 * de las dos se quedara vieja.
 *
 * No recibe la respuesta cruda por casualidad: quien llama decide cómo pedirla
 * y cómo contar los errores de red; aquí solo se escribe lo que ya llegó.
 */
export type ResultadoSincronizacion = {
  /** Servicios que el proveedor sigue ofreciendo. */
  activos: number;
  /** Los que dejó de listar: se deshabilitan, nunca se borran. */
  bajas: number;
  /** Productos publicados que quedaron apuntando a un servicio dado de baja. */
  productosRotos: number;
};

export function guardarCatalogo(
  proveedor: ProveedorId,
  rows: ProviderServiceRow[],
): ResultadoSincronizacion {
  // La API de servicios no devuelve el tiempo promedio, así que conservamos el
  // que ya teníamos: es mejor señal de velocidad que el nombre del servicio.
  const knownAvg = new Map(
    all<{ service_id: number; avg_minutes: number | null }>(
      "SELECT service_id, avg_minutes FROM provider_services WHERE avg_minutes IS NOT NULL",
    ).map((row) => [row.service_id, row.avg_minutes]),
  );

  const upsert = db.prepare(`
    INSERT INTO provider_services
      (service_id, provider, remote_id, name, clean_name, category, platform, service_type, rate_usd_per_1000,
       min_qty, max_qty, refill, cancel, refill_days, drop_score, speed_score, geo, variant,
       order_kind, start_minutes, provider_enabled, synced_at)
    VALUES (@service_id, @provider, @remote_id, @name, @clean_name, @category, @platform, @service_type, @rate,
            @min_qty, @max_qty, @refill, @cancel, @refill_days, @drop_score, @speed_score,
            @geo, @variant, @order_kind, @start_minutes, 1, datetime('now'))
    ON CONFLICT(service_id) DO UPDATE SET
      provider = excluded.provider, remote_id = excluded.remote_id,
      name = excluded.name, clean_name = excluded.clean_name, category = excluded.category,
      platform = excluded.platform, service_type = excluded.service_type,
      rate_usd_per_1000 = excluded.rate_usd_per_1000,
      min_qty = excluded.min_qty, max_qty = excluded.max_qty,
      refill = excluded.refill, cancel = excluded.cancel,
      refill_days = excluded.refill_days, drop_score = excluded.drop_score,
      speed_score = excluded.speed_score, geo = excluded.geo, variant = excluded.variant,
      order_kind = excluded.order_kind, start_minutes = excluded.start_minutes,
      provider_enabled = 1, synced_at = datetime('now')
  `);

  const seen: number[] = [];
  const apply = db.transaction(() => {
    for (const row of rows) {
      const remoto = Number(row.service);
      if (!remoto) continue;
      const serviceId = idInterno(proveedor, remoto);
      seen.push(serviceId);
      const clean = normalizeText(row.name);
      const days = refillDaysFromName(clean);
      const serviceType = detectServiceType(row.name, row.category);
      upsert.run({
        service_id: serviceId,
        provider: proveedor,
        remote_id: remoto,
        name: row.name,
        clean_name: clean,
        category: normalizeText(row.category) || String(row.category ?? ""),
        platform: detectPlatform(row.name, row.category),
        service_type: serviceType,
        rate: Number(row.rate) || 0,
        min_qty: Number(row.min) || 1,
        max_qty: Number(row.max) || 1000,
        refill: row.refill ? 1 : 0,
        cancel: row.cancel ? 1 : 0,
        refill_days: days,
        drop_score: dropScore(clean, days || (row.refill ? 30 : 0)),
        speed_score: speedScore(clean, knownAvg.get(serviceId) ?? null),
        geo: detectGeo(clean),
        variant: detectVariant(clean),
        // El campo `type` de la API manda: dice si el servicio espera texto,
        // un número de opción o simplemente una cantidad.
        order_kind: orderKindFromApiType(row.type, clean, serviceType),
        start_minutes: startMinutesFromName(clean),
      });
    }
    // Lo que el proveedor ya no lista queda deshabilitado, no se borra: así los
    // pedidos históricos conservan su referencia. Solo se mira su propio
    // catálogo: sincronizar uno no puede apagar los servicios del otro.
    if (seen.length) {
      const marks = seen.map(() => "?").join(",");
      run(
        `UPDATE provider_services SET provider_enabled = 0
          WHERE provider = ? AND service_id NOT IN (${marks})`,
        [proveedor, ...seen],
      );
    }
  });
  apply();

  const disabled = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM provider_services WHERE provider = ? AND provider_enabled = 0",
    [proveedor],
  )?.n ?? 0;
  const affected = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM products p
       JOIN provider_services s ON s.service_id = p.provider_service_id
      WHERE p.published = 1 AND s.provider_enabled = 0 AND s.provider = ?`,
    [proveedor],
  )?.n ?? 0;

  return { activos: seen.length, bajas: disabled, productosRotos: affected };
}

export type SincronizacionDeProveedor =
  | ({ proveedor: ProveedorId; nombre: string; ok: true } & ResultadoSincronizacion)
  | { proveedor: ProveedorId; nombre: string; ok: false; error: string };

/**
 * Pide el catálogo a cada proveedor configurado y lo guarda.
 *
 * Uno que falla no frena al otro: si JustAnotherPanel no responde, el
 * catálogo de honestsmm se actualiza igual y el error queda en su fila.
 */
export async function sincronizarProveedores(): Promise<SincronizacionDeProveedor[]> {
  const resultados: SincronizacionDeProveedor[] = [];
  for (const proveedor of proveedoresConfigurados()) {
    const nombre = PROVEEDORES[proveedor].nombre;
    try {
      const rows = await clienteProveedor(proveedor).services();
      if (!Array.isArray(rows)) {
        resultados.push({ proveedor, nombre, ok: false, error: "devolvió una respuesta inesperada." });
        continue;
      }
      resultados.push({ proveedor, nombre, ok: true, ...guardarCatalogo(proveedor, rows) });
    } catch (error) {
      resultados.push({
        proveedor,
        nombre,
        ok: false,
        error: error instanceof ProviderError ? error.message : "no se pudo conectar.",
      });
    }
  }
  return resultados;
}

/** Una línea por proveedor, para mostrar en el panel. */
export function resumirSincronizacion(resultados: SincronizacionDeProveedor[]): string {
  return resultados
    .map((r) =>
      r.ok
        ? `${r.nombre}: ${r.activos} servicios activos, ${r.bajas} dados de baja` +
          (r.productosRotos
            ? ` (atención: ${r.productosRotos} producto(s) publicado(s) apuntan a servicios desactivados)`
            : "")
        : `${r.nombre}: ${r.error}`,
    )
    .join(" · ");
}
