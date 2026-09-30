import "server-only";
import { all, db, get, run } from "./db";
import { publicarNiveles, refrescarEtiquetasDeEntrega } from "./autolevels";
import { platformLabel } from "./labels";
import { esProveedor, providerConfigured, PROVEEDORES, type ProveedorId } from "./provider";
import { guardarProveedorDeRed, proveedorDeRed } from "./proveedor-por-red";
import { ROUTABLE_GEOS } from "./quality.mjs";
import type { ProviderService } from "./types";

/**
 * Cambiar una red de proveedor.
 *
 * El precio de un producto sale del servicio de referencia (products.
 * provider_service_id): su costo, sus mínimos y sus plazos. Así que cambiar de
 * proveedor es cambiar esa referencia por la equivalente del otro catálogo, y
 * con eso el precio, los límites y el enrutado de los pedidos nuevos se
 * acomodan solos. Nada de esto toca los pedidos que ya salieron: esos siguen
 * con el proveedor al que se mandaron, que es el único que los conoce.
 *
 * - Los productos por niveles se vuelven a armar con el catálogo nuevo, igual
 *   que en una sincronización: el económico es el más barato del nuevo
 *   proveedor, el premium su mejor servicio.
 * - Los productos hechos a mano pasan al servicio más parecido del nuevo
 *   catálogo: mismo tipo, subtipo y forma de pedido, y la retención, velocidad
 *   y reposición más cercanas.
 * - Lo que no tiene equivalente se queda con el proveedor anterior, que lo
 *   sigue entregando. Ocultarlo sería perder ventas por un interruptor.
 *
 * Antes de mover nada se anota qué servicio tenía cada producto y si estaba
 * publicado, para que al volver al proveedor anterior quede exactamente como
 * estaba.
 */

export type ResultadoCambio = {
  red: string;
  proveedor: ProveedorId;
  anterior: ProveedorId;
  /** Productos que quedaron apuntando al proveedor nuevo. */
  reasignados: number;
  /** Publicados que siguen con el anterior porque el nuevo no tiene nada igual. */
  sinEquivalente: { id: number; name: string }[];
  /** Niveles que el nuevo proveedor no tiene y quedaron ocultos. */
  ocultos: number;
  /** Productos que se habían ocultado al irse y volvieron a publicarse. */
  reaparecidos: number;
  /** Niveles nuevos que solo existen en este proveedor: quedan como borrador. */
  nuevosBorrador: number;
  /** Publicados con precio manual: su precio no se mueve solo. */
  preciosManuales: number;
};

type ProductoDeRed = {
  id: number;
  name: string;
  published: number;
  auto_managed: number;
  level: string;
  min_qty: number;
  provider_service_id: number;
  provider: string;
};

function productosDeRed(platform: string): ProductoDeRed[] {
  return all<ProductoDeRed>(
    `SELECT p.id, p.name, p.published, p.auto_managed, p.level, p.min_qty,
            p.provider_service_id, s.provider
       FROM products p
       JOIN provider_services s ON s.service_id = p.provider_service_id
      WHERE p.platform = ?`,
    [platform],
  );
}

const geoMarks = ROUTABLE_GEOS.map(() => "?").join(",");

function conReposicion(s: Pick<ProviderService, "refill" | "refill_days">): boolean {
  return s.refill === 1 || s.refill_days > 0;
}

/**
 * El servicio del otro proveedor que más se parece a la referencia actual.
 *
 * Si el producto ya estuvo con ese proveedor y su servicio sigue activo, se
 * vuelve a ese mismo. Si no, se elige por parecido: lo que el cliente compró
 * es una retención, una velocidad y una garantía, no un número de servicio.
 */
export function servicioEquivalente(
  productId: number,
  referencia: ProviderService,
  proveedor: ProveedorId,
  cantidadMinima: number,
): ProviderService | undefined {
  const candidatos = all<ProviderService>(
    `SELECT * FROM provider_services
      WHERE provider = ? AND provider_enabled = 1 AND rate_usd_per_1000 > 0
        AND platform = ? AND service_type = ? AND variant = ? AND order_kind = ?
        AND (geo = ? OR geo IN (${geoMarks}))`,
    [
      proveedor, referencia.platform, referencia.service_type, referencia.variant,
      referencia.order_kind, referencia.geo, ...ROUTABLE_GEOS,
    ],
  );
  if (!candidatos.length) return undefined;

  const guardado = get<{ service_id: number }>(
    "SELECT service_id FROM product_provider_refs WHERE product_id = ? AND provider = ?",
    [productId, proveedor],
  );
  const previo = candidatos.find((c) => c.service_id === guardado?.service_id);
  if (previo) return previo;

  const distancia = (c: ProviderService) =>
    Math.abs(c.drop_score - referencia.drop_score) +
    Math.abs(c.speed_score - referencia.speed_score) * 0.8 +
    (conReposicion(c) !== conReposicion(referencia) ? 25 : 0) +
    (c.geo !== referencia.geo ? 10 : 0) +
    // Que pueda entregar el pack más chico que se vende: si no, ese pack
    // queda a la vista y falla al comprarlo.
    (c.min_qty > cantidadMinima ? 40 : 0) +
    (c.max_qty < cantidadMinima ? 60 : 0);

  return [...candidatos].sort(
    (a, b) => distancia(a) - distancia(b) || a.rate_usd_per_1000 - b.rate_usd_per_1000,
  )[0];
}

export function cambiarProveedorDeRed(
  platform: string,
  proveedor: string,
): { ok: true; resultado: ResultadoCambio } | { ok: false; error: string } {
  if (!esProveedor(proveedor)) return { ok: false, error: "Proveedor desconocido." };
  const nombre = PROVEEDORES[proveedor].nombre;
  const red = platformLabel(platform);

  if (!providerConfigured(proveedor)) {
    return { ok: false, error: `Falta la API key de ${nombre}. Guárdala en Ajustes.` };
  }
  const disponibles = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM provider_services
      WHERE provider = ? AND platform = ? AND provider_enabled = 1 AND rate_usd_per_1000 > 0`,
    [proveedor, platform],
  )?.n ?? 0;
  if (!disponibles) {
    return {
      ok: false,
      error: `${nombre} no tiene servicios de ${red} en el catálogo. Sincroniza el catálogo y vuelve a intentarlo.`,
    };
  }

  const anterior = proveedorDeRed(platform);
  if (anterior === proveedor) return { ok: false, error: `${red} ya usa ${nombre}.` };
  const resultado: ResultadoCambio = {
    red: platform,
    proveedor,
    anterior,
    reasignados: 0,
    sinEquivalente: [],
    ocultos: 0,
    reaparecidos: 0,
    nuevosBorrador: 0,
    preciosManuales: 0,
  };

  const cambiar = db.transaction(() => {
    const antes = productosDeRed(platform);

    // 1. Anotar cómo estaba cada producto con el proveedor que se deja. Solo
    //    los que eran suyos: uno que se quedó con el otro por falta de
    //    equivalente (u oculto) no dice nada de cómo estaba este, y anotarlo
    //    pisaría lo que se guardó la vez anterior.
    const anotar = db.prepare(
      `INSERT INTO product_provider_refs (product_id, provider, service_id, published, updated_at)
       VALUES (?, ?, ?, ?, datetime('now'))
       ON CONFLICT(product_id, provider) DO UPDATE SET
         service_id = excluded.service_id, published = excluded.published,
         updated_at = excluded.updated_at`,
    );
    for (const p of antes) {
      if (p.provider === anterior) anotar.run(p.id, p.provider, p.provider_service_id, p.published);
    }

    // 2. El interruptor. Desde aquí los niveles y el enrutado miran al nuevo.
    guardarProveedorDeRed(platform, proveedor);

    // 3. Los niveles se rearman con el catálogo nuevo. Lo que solo existe en
    //    este proveedor queda como borrador: publicarlo es decisión tuya.
    if (antes.some((p) => p.auto_managed === 1 && p.level)) {
      const niveles = publicarNiveles({ publicar: false, platform, reemplazar: false });
      resultado.nuevosBorrador = niveles.creados;
    }

    // 4. El resto, al servicio más parecido. Los niveles no: si el nuevo
    //    proveedor no tiene ese escalón, repartirlo a mano duplicaría otro.
    const actualizar = db.prepare(
      "UPDATE products SET provider_service_id = ?, updated_at = datetime('now') WHERE id = ?",
    );
    for (const p of productosDeRed(platform)) {
      if (p.provider === proveedor || (p.auto_managed === 1 && p.level)) continue;
      const referencia = get<ProviderService>("SELECT * FROM provider_services WHERE service_id = ?", [
        p.provider_service_id,
      ]);
      if (!referencia) continue;
      const minTier =
        get<{ q: number | null }>("SELECT MIN(quantity) AS q FROM product_tiers WHERE product_id = ?", [
          p.id,
        ])?.q ?? p.min_qty;
      const equivalente = servicioEquivalente(p.id, referencia, proveedor, minTier);
      if (equivalente) actualizar.run(equivalente.service_id, p.id);
    }

    // 5. Lo que estaba publicado la última vez que la red fue de este
    //    proveedor y se ocultó al irse, vuelve.
    resultado.reaparecidos = run(
      `UPDATE products SET published = 1, updated_at = datetime('now')
        WHERE published = 0 AND platform = ?
          AND id IN (SELECT r.product_id FROM product_provider_refs r
                      WHERE r.provider = ? AND r.published = 1)
          AND provider_service_id IN (SELECT service_id FROM provider_services
                                       WHERE provider = ? AND provider_enabled = 1)`,
      [platform, proveedor, proveedor],
    ).changes;

    // 6. El balance, para contarlo en pantalla.
    const publicadosAntes = new Set(antes.filter((p) => p.published === 1).map((p) => p.id));
    for (const p of productosDeRed(platform)) {
      const estaba = antes.find((a) => a.id === p.id);
      if (p.provider === proveedor && estaba && estaba.provider !== proveedor) resultado.reasignados++;
      if (publicadosAntes.has(p.id) && p.published === 0) resultado.ocultos++;
      if (p.published === 1 && p.provider !== proveedor) {
        resultado.sinEquivalente.push({ id: p.id, name: p.name });
      }
    }
    resultado.preciosManuales = get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM products
        WHERE platform = ? AND published = 1 AND price_mode = 'manual'`,
      [platform],
    )?.n ?? 0;
  });

  cambiar();

  // La etiqueta de entrega sale del servicio de referencia: con otro servicio,
  // otro plazo.
  refrescarEtiquetasDeEntrega();
  return { ok: true, resultado };
}

/** El resultado en una frase, para el panel. */
export function describirCambio(r: ResultadoCambio): string {
  const nombre = PROVEEDORES[r.proveedor].nombre;
  const red = platformLabel(r.red);
  const partes = [
    `${red} ahora usa ${nombre}: ${r.reasignados} producto(s) pasaron a sus servicios y sus precios ya se recalcularon.`,
  ];
  if (r.reaparecidos) partes.push(`${r.reaparecidos} volvieron a publicarse, como estaban antes.`);
  if (r.ocultos) partes.push(`${r.ocultos} nivel(es) que ${nombre} no tiene quedaron ocultos.`);
  if (r.nuevosBorrador) {
    partes.push(`${r.nuevosBorrador} producto(s) que solo existen en ${nombre} quedaron como borrador.`);
  }
  if (r.sinEquivalente.length) {
    partes.push(
      `${r.sinEquivalente.length} siguen con ${PROVEEDORES[r.anterior].nombre} porque ${nombre} no tiene nada equivalente: ` +
        r.sinEquivalente.slice(0, 5).map((p) => p.name).join(", ") +
        (r.sinEquivalente.length > 5 ? "…" : "") +
        ".",
    );
  }
  if (r.preciosManuales) {
    partes.push(`${r.preciosManuales} tienen precio manual: esos no cambian solos, revísalos.`);
  }
  return partes.join(" ");
}

/**
 * Productos publicados cuyo servicio el proveedor dio de baja.
 *
 * Sin esto desaparecían de la tienda hasta que alguien los arreglara a mano
 * (la tienda no muestra lo que no puede entregar). Se pasan al servicio más
 * parecido del proveedor que atiende su red; si ese no tiene nada, al más
 * parecido del mismo proveedor que tenían. Lo corre cada sincronización.
 *
 * Los niveles automáticos también entran: si los niveles están activos, la
 * republicación que viene después los vuelve a elegir con su propio criterio.
 */
export function repararProductosDadosDeBaja(): { reparados: { id: number; name: string }[] } {
  const rotos = all<ProductoDeRed & { platform: string }>(
    `SELECT p.id, p.name, p.published, p.auto_managed, p.level, p.min_qty, p.platform,
            p.provider_service_id, s.provider
       FROM products p
       JOIN provider_services s ON s.service_id = p.provider_service_id
      WHERE p.published = 1 AND s.provider_enabled = 0`,
  );
  const reparados: { id: number; name: string }[] = [];
  const actualizar = db.prepare(
    "UPDATE products SET provider_service_id = ?, updated_at = datetime('now') WHERE id = ?",
  );

  const reparar = db.transaction(() => {
    for (const p of rotos) {
      const referencia = get<ProviderService>("SELECT * FROM provider_services WHERE service_id = ?", [
        p.provider_service_id,
      ]);
      if (!referencia) continue;
      const minTier =
        get<{ q: number | null }>("SELECT MIN(quantity) AS q FROM product_tiers WHERE product_id = ?", [
          p.id,
        ])?.q ?? p.min_qty;
      const activo = proveedorDeRed(p.platform);
      const propio = esProveedor(p.provider) ? p.provider : activo;
      const nuevo =
        servicioEquivalente(p.id, referencia, activo, minTier) ??
        (propio !== activo ? servicioEquivalente(p.id, referencia, propio, minTier) : undefined);
      if (!nuevo) continue;
      actualizar.run(nuevo.service_id, p.id);
      reparados.push({ id: p.id, name: p.name });
    }
  });
  reparar();

  if (reparados.length) refrescarEtiquetasDeEntrega();
  return { reparados };
}

