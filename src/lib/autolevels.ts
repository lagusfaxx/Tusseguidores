import { all, db, get, run } from "./db";
import { buildCopy } from "./copy.mjs";
import { LADDERS, cantidadDeReferencia } from "./offers";
import { LEVELS, nivelesDeOferta, rasgosDeServicio, type Candidate, type LevelDef, type PickedLevel } from "./levels";
import { platformLabel, serviceTypeLabel, PLATFORM_PRIORITY } from "./labels";
import { formatDuration } from "./pricing";
import { SUPPORTED_ORDER_KINDS, ROUTABLE_GEOS } from "./quality.mjs";
import { slugify } from "./utils";

/**
 * Publicación automática del catálogo por niveles.
 *
 * Recorre todas las combinaciones red + servicio que el proveedor tiene
 * activas y publica, para cada una, el económico, el estándar y el premium con
 * los textos que explican en qué se diferencian. Es idempotente: se puede
 * correr cada vez que se sincroniza el catálogo y solo mueve lo que cambió.
 *
 * Los productos que crea quedan marcados con auto_managed = 1. Eso es lo único
 * que toca: un producto que hayas creado tú, o uno que hayas sacado del modo
 * automático desde el editor, no se pisa nunca.
 */

export type ResultadoPublicacion = {
  combinaciones: number;
  creados: number;
  actualizados: number;
  retirados: number;
  /** Productos sin nivel que se ocultaron por quedar duplicados con la escalera. */
  reemplazados: number;
  /** Combinaciones que quedaron con un solo servicio: no hay niveles que comparar. */
  sinNiveles: number;
};

type Combinacion = { platform: string; service_type: string; order_kind: string };

const geoMarks = ROUTABLE_GEOS.map(() => "?").join(",");
const kindMarks = SUPPORTED_ORDER_KINDS.map(() => "?").join(",");

/** Todo lo que el proveedor permite vender hoy, agrupado como se publica. */
export function combinacionesVendibles(platform?: string): Combinacion[] {
  return all<Combinacion>(
    `SELECT platform, service_type, order_kind
       FROM provider_services
      WHERE provider_enabled = 1 AND variant = '' AND rate_usd_per_1000 > 0
        AND geo IN (${geoMarks}) AND order_kind IN (${kindMarks})
        ${platform ? "AND platform = ?" : ""}
      GROUP BY platform, service_type, order_kind
      HAVING COUNT(*) > 0`,
    platform
      ? [...ROUTABLE_GEOS, ...SUPPORTED_ORDER_KINDS, platform]
      : [...ROUTABLE_GEOS, ...SUPPORTED_ORDER_KINDS],
  );
}

function escalera(serviceType: string, orderKind: string, service: Candidate): number[] {
  const key = orderKind === "custom_comments" ? "custom_comments" : serviceType;
  const base = LADDERS[key] ?? LADDERS.seguidores;
  const ladder = base.filter((q) => q >= service.min_qty && q <= service.max_qty).slice(0, 6);
  return ladder.length ? ladder : [Math.max(1, service.min_qty)];
}

function etiquetaEntrega(avgMinutes: number | null): string {
  const texto = formatDuration(avgMinutes);
  return texto ? `Entrega en ~${texto}` : "Inicio inmediato";
}

function garantia(service: Candidate): string {
  if (service.refill_days >= 9999) return "Reposición de por vida si bajan";
  if (service.refill_days > 0) return `Reposición gratis por ${service.refill_days} días`;
  return "Reembolso si el pedido no se entrega";
}

function etiquetaCalidad(level: LevelDef, service: Candidate): string {
  if (level.id === "premium") return "Máxima calidad · sin caídas";
  if (level.id === "economico") return service.drop_score >= 60 ? "Calidad estándar" : "Calidad básica";
  return service.refill_days > 0 ? "Alta calidad · con reposición" : "Alta calidad";
}

/**
 * Textos de un producto de nivel.
 *
 * Parte de la copia de la combinación y le agrega lo único que cambia entre
 * niveles: para quién es, en qué se diferencia de los otros dos y qué promete
 * el servicio que hay detrás. Sin eso el cliente ve tres precios y ninguna
 * razón para pagar el del medio.
 */
export function copiaDeNivel(
  combinacion: Combinacion,
  elegido: PickedLevel,
): {
  name: string; slug: string; shortDescription: string; descriptionHtml: string;
  bullets: string[]; faq: { q: string; a: string }[];
  seoTitle: string; seoDescription: string; seoKeywords: string;
  link: { label: string; placeholder: string; help: string };
} {
  const { level, service, diferencias } = elegido;
  const base = buildCopy({
    platform: combinacion.platform,
    type: combinacion.service_type,
    orderKind: combinacion.order_kind,
  });
  const red = platformLabel(combinacion.platform);
  const tipo =
    combinacion.order_kind === "custom_comments"
      ? "comentarios personalizados"
      : serviceTypeLabel(combinacion.service_type).toLowerCase();
  const rasgos = rasgosDeServicio(service);

  const comparativa = diferencias.length
    ? `<h2>En qué se diferencia de los otros niveles</h2>\n<ul>${diferencias
        .map((linea) => `<li>${linea}</li>`)
        .join("")}</ul>\n<p>Los tres niveles entregan lo mismo: ${tipo} para ${red}. Lo que cambia es de dónde salen, cuánto aguantan y cuánto demoran. Si es tu primera compra, el estándar es el que más se pide.</p>`
    : "";

  const ficha =
    `<h2>Qué recibes con el nivel ${level.label.toLowerCase()}</h2>\n` +
    `<p>${level.pitch} En concreto: ${rasgos.join(", ")}.</p>`;

  return {
    name: `${base.name} — ${level.label}`,
    slug: `${base.slug}-${level.slug}`,
    shortDescription: `${level.pitch}`,
    descriptionHtml: [base.descriptionHtml, ficha, comparativa].filter(Boolean).join("\n"),
    bullets: [...rasgos.map(capitalizar), ...base.bullets].slice(0, 6),
    faq: [
      {
        q: `¿Cuál es la diferencia entre el ${level.label.toLowerCase()} y los otros niveles?`,
        a: diferencias.length
          ? diferencias.join(" ")
          : "Por ahora este es el único servicio disponible para esta combinación, así que no hay otro nivel con el que compararlo.",
      },
      ...base.faq,
    ],
    seoTitle: `${capitalizar(tipo)} ${red} ${level.label} en Chile | TusSeguidores.cl`,
    seoDescription:
      `${capitalizar(tipo)} para ${red}, nivel ${level.label.toLowerCase()}: ${rasgos.join(", ")}. ` +
      `Precios en pesos, entrega automática y sin contraseña.`.slice(0, 158),
    seoKeywords: [
      `comprar ${tipo} ${red.toLowerCase()} ${level.label.toLowerCase()}`,
      `${tipo} ${red.toLowerCase()} ${level.id === "economico" ? "baratos" : level.label.toLowerCase()}`,
      `${tipo} ${red.toLowerCase()} chile`,
      base.seoKeywords,
    ].join(", "),
    link: base.link,
  };
}

function capitalizar(texto: string): string {
  return texto.charAt(0).toUpperCase() + texto.slice(1);
}

function slugLibre(base: string, ignoreId: number): string {
  const raiz = slugify(base) || `producto-${Date.now().toString(36)}`;
  let candidato = raiz;
  for (let i = 2; i < 50; i++) {
    const choque = get<{ id: number }>("SELECT id FROM products WHERE slug = ? AND id != ?", [
      candidato,
      ignoreId,
    ]);
    if (!choque) return candidato;
    candidato = `${raiz}-${i}`;
  }
  return `${raiz}-${Date.now().toString(36).slice(-5)}`;
}

/**
 * Publica o actualiza los niveles de todas las combinaciones vendibles.
 *
 * @param publicar    false deja los productos nuevos como borrador.
 * @param platform    limita el trabajo a una sola red.
 * @param reemplazar  oculta el producto suelto que vendía lo mismo sin niveles,
 *                    para que la tienda no muestre cuatro fichas del mismo
 *                    servicio. Se despublica, no se borra: se puede volver a
 *                    publicar desde el listado cuando quieras.
 */
export function publicarNiveles({
  publicar = true,
  platform,
  reemplazar = true,
}: { publicar?: boolean; platform?: string; reemplazar?: boolean } = {}): ResultadoPublicacion {
  const combinaciones = combinacionesVendibles(platform);
  const resultado: ResultadoPublicacion = {
    combinaciones: combinaciones.length,
    creados: 0,
    actualizados: 0,
    retirados: 0,
    reemplazados: 0,
    sinNiveles: 0,
  };

  const buscar = db.prepare(
    `SELECT id, slug, auto_managed FROM products
      WHERE platform = ? AND service_type = ? AND level = ? AND auto_managed = 1
        AND id IN (SELECT p.id FROM products p JOIN provider_services s
                     ON s.service_id = p.provider_service_id
                    WHERE s.order_kind = ?)`,
  );

  const insertar = db.prepare(
    `INSERT INTO products
       (slug, name, platform, service_type, provider_service_id, short_description,
        description_html, bullets_json, faq_json, seo_title, seo_description, seo_keywords,
        image_url, badge, price_mode, level, auto_managed, auto_select, max_cost_ratio,
        min_qty, max_qty, link_label, link_placeholder, link_help,
        delivery_label, quality_label, refill_days, guarantee_text, published, sort_order)
     VALUES
       (@slug, @name, @platform, @service_type, @provider_service_id, @short_description,
        @description_html, @bullets_json, @faq_json, @seo_title, @seo_description, @seo_keywords,
        @image_url, @badge, 'auto', @level, 1, 1, @max_cost_ratio,
        @min_qty, @max_qty, @link_label, @link_placeholder, @link_help,
        @delivery_label, @quality_label, @refill_days, @guarantee_text, @published, @sort_order)`,
  );

  const actualizar = db.prepare(
    `UPDATE products SET
       name=@name, provider_service_id=@provider_service_id, short_description=@short_description,
       description_html=@description_html, bullets_json=@bullets_json, faq_json=@faq_json,
       seo_title=@seo_title, seo_description=@seo_description, seo_keywords=@seo_keywords,
       badge=@badge, price_mode='auto', margin_override=NULL, level=@level,
       max_cost_ratio=@max_cost_ratio, min_qty=@min_qty, max_qty=@max_qty,
       link_label=@link_label, link_placeholder=@link_placeholder, link_help=@link_help,
       delivery_label=@delivery_label, quality_label=@quality_label,
       refill_days=@refill_days, guarantee_text=@guarantee_text, sort_order=@sort_order,
       updated_at=datetime('now')
     WHERE id=@id`,
  );

  // Los tres niveles de un servicio tienen que quedar juntos en la tienda, no
  // todos los económicos primero: por eso el orden lleva la posición del
  // servicio dentro de su red y, dentro de ella, la del nivel.
  const posiciones = new Map<string, number>();

  const trabajo = db.transaction(() => {
    for (const combinacion of combinaciones) {
      const referencia = cantidadDeReferencia(combinacion.service_type, combinacion.order_kind);
      const elegidos = nivelesDeOferta(
        combinacion.platform,
        combinacion.service_type,
        combinacion.order_kind,
        referencia,
      );
      if (!elegidos.length) continue;
      if (elegidos.length === 1) resultado.sinNiveles++;

      const orden = PLATFORM_PRIORITY.indexOf(combinacion.platform);
      const posicion = (posiciones.get(combinacion.platform) ?? 0) + 1;
      posiciones.set(combinacion.platform, posicion);
      const baseOrden = (orden === -1 ? 90 : orden) * 1000 + posicion * 10;

      for (const elegido of elegidos) {
        const copia = copiaDeNivel(combinacion, elegido);
        const ladder = escalera(combinacion.service_type, combinacion.order_kind, elegido.service);
        const existente = buscar.get(
          combinacion.platform,
          combinacion.service_type,
          elegido.level.id,
          combinacion.order_kind,
        ) as { id: number; slug: string } | undefined;

        const valores = {
          name: copia.name,
          platform: combinacion.platform,
          service_type: combinacion.service_type,
          provider_service_id: elegido.service.service_id,
          short_description: copia.shortDescription,
          description_html: copia.descriptionHtml,
          bullets_json: JSON.stringify(copia.bullets),
          faq_json: JSON.stringify(copia.faq),
          seo_title: copia.seoTitle,
          seo_description: copia.seoDescription,
          seo_keywords: copia.seoKeywords,
          badge: elegido.level.badge,
          level: elegido.level.id,
          max_cost_ratio: elegido.level.id === "premium" ? 1.15 : 1.35,
          min_qty: ladder[0],
          max_qty: elegido.service.max_qty,
          link_label: copia.link.label,
          link_placeholder: copia.link.placeholder,
          link_help: copia.link.help,
          delivery_label: etiquetaEntrega(elegido.service.avg_minutes),
          quality_label: etiquetaCalidad(elegido.level, elegido.service),
          refill_days: elegido.service.refill_days,
          guarantee_text: garantia(elegido.service),
          sort_order: baseOrden + LEVELS.findIndex((l) => l.id === elegido.level.id),
        };

        if (existente) {
          actualizar.run({ ...valores, id: existente.id });
          sembrarPacks(existente.id, ladder);
          resultado.actualizados++;
          continue;
        }

        const info = insertar.run({
          ...valores,
          slug: slugLibre(copia.slug, 0),
          image_url: `/img/productos/${combinacion.platform}-${combinacion.service_type}.svg`,
          published: publicar ? 1 : 0,
        });
        sembrarPacks(Number(info.lastInsertRowid), ladder);
        resultado.creados++;
      }

      // Un nivel que dejó de existir (el proveedor se quedó sin ese escalón)
      // se despublica, no se borra: los pedidos viejos siguen apuntando a él.
      const publicados = elegidos.map((e) => e.level.id);
      const marcas = publicados.map(() => "?").join(",");
      const retirados = db
        .prepare(
          `UPDATE products SET published = 0, updated_at = datetime('now')
            WHERE auto_managed = 1 AND published = 1
              AND platform = ? AND service_type = ?
              AND level != '' AND level NOT IN (${marcas})
              AND id IN (SELECT p.id FROM products p
                           JOIN provider_services s ON s.service_id = p.provider_service_id
                          WHERE s.order_kind = ?)`,
        )
        .run(combinacion.platform, combinacion.service_type, ...publicados, combinacion.order_kind);
      resultado.retirados += retirados.changes;

      // El producto viejo que vendía esto mismo sin niveles queda oculto: si no,
      // la página de la red muestra cuatro fichas para un solo servicio.
      if (reemplazar && elegidos.length > 1 && publicar) {
        const reemplazados = db
          .prepare(
            `UPDATE products SET published = 0, updated_at = datetime('now')
              WHERE published = 1 AND level = ''
                AND platform = ? AND service_type = ?
                AND id IN (SELECT p.id FROM products p
                             JOIN provider_services s ON s.service_id = p.provider_service_id
                            WHERE s.order_kind = ?)`,
          )
          .run(combinacion.platform, combinacion.service_type, combinacion.order_kind);
        resultado.reemplazados += reemplazados.changes;
      }
    }
  });

  trabajo();
  return resultado;
}

/** Deja los packs del producto tal como los define la escalera del servicio. */
function sembrarPacks(productId: number, ladder: number[]) {
  const actuales = all<{ quantity: number }>(
    "SELECT quantity FROM product_tiers WHERE product_id = ? ORDER BY quantity",
    [productId],
  ).map((row) => row.quantity);

  const iguales =
    actuales.length === ladder.length && actuales.every((q, i) => q === ladder[i]);
  if (iguales) return;

  run("DELETE FROM product_tiers WHERE product_id = ?", [productId]);
  const popular = Math.min(2, ladder.length - 1);
  ladder.forEach((quantity, i) =>
    run(
      "INSERT INTO product_tiers (product_id, quantity, popular, sort_order) VALUES (?, ?, ?, ?)",
      [productId, quantity, i === popular ? 1 : 0, i],
    ),
  );
}
