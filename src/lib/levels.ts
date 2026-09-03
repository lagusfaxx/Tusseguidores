import { all } from "./db";
import { overallScore, ROUTABLE_GEOS } from "./quality.mjs";
import { autoPriceClp, formatDuration, pricingContext } from "./pricing";
import { LEVELS, levelDef, levelOrder, type LevelDef, type LevelId } from "./level-defs";
import type { ProviderService } from "./types";

/**
 * Niveles de calidad de un mismo servicio.
 *
 * El proveedor tiene, para "seguidores de Instagram", decenas de servicios que
 * van desde lo más barato que existe hasta lo que no se cae nunca. Publicar
 * solo el mejor deja fuera al que quiere gastar poco; publicar solo el barato
 * deja fuera al que quiere calidad. Así que publicamos los dos extremos y un
 * punto medio, y le decimos al cliente en qué se diferencian de verdad
 * —retención, velocidad y reposición—, que es la única pregunta que tiene
 * cuando ve tres precios distintos para lo mismo.
 *
 * Nada de esto se configura a mano: el nivel sale de los puntajes del catálogo
 * y el precio sale del costo del servicio elegido. Mover el margen global o el
 * dólar reprecia los tres niveles de una sola vez.
 */

export {
  LEVELS, levelDef, levelLabel, levelFloorFactor, levelOrder,
  type LevelId, type LevelDef,
} from "./level-defs";

export type Candidate = ProviderService & { score: number };

export type PickedLevel = {
  level: LevelDef;
  service: Candidate;
  /** En qué se diferencia de los otros niveles publicados, en español. */
  diferencias: string[];
};

const geoMarks = ROUTABLE_GEOS.map(() => "?").join(",");

/**
 * Servicios que podrían atender esta combinación, del más barato al más caro.
 *
 * Mismos filtros que usa el enrutado: solo lo que la tienda sabe vender y lo
 * que apunta a un público que no desvirtúa el producto.
 */
export function candidatosDeOferta(
  platform: string,
  serviceType: string,
  orderKind = "default",
): Candidate[] {
  const rows = all<ProviderService>(
    `SELECT * FROM provider_services
      WHERE provider_enabled = 1
        AND platform = ? AND service_type = ?
        AND order_kind = ? AND variant = ''
        AND geo IN (${geoMarks})
        AND rate_usd_per_1000 > 0
      ORDER BY rate_usd_per_1000 ASC`,
    [platform, serviceType, orderKind, ...ROUTABLE_GEOS],
  );
  return rows.map((row) => ({ ...row, score: overallScore(row.drop_score, row.speed_score) }));
}

/**
 * Puntaje mínimo para que un servicio sea publicable.
 *
 * Por debajo de esto el servicio no es "barato", es malo: entrega tarde y se
 * cae entero. Venderlo sale más caro en devoluciones que lo que deja.
 */
const MIN_SCORE = 32;

/**
 * Retención mínima. Un servicio rapidísimo que se cae entero puntúa bien en el
 * promedio y no sirve para vender: el cliente ve el número subir el lunes y
 * bajar el martes.
 */
const MIN_DROP = 25;

/**
 * Elige el trío económico / estándar / premium de una combinación.
 *
 * - premium: el de mejor calidad; a igual calidad, el más barato.
 * - económico: el más barato que todavía es defendible.
 * - estándar: el que rinde mejor por peso gastado entre ambos extremos.
 *
 * Si dos niveles caerían en el mismo servicio se publica uno solo: tres fichas
 * idénticas a distinto precio son una estafa, no un catálogo.
 */
export function nivelesDeOferta(
  platform: string,
  serviceType: string,
  orderKind = "default",
  cantidadReferencia = 1000,
): PickedLevel[] {
  const todos = candidatosDeOferta(platform, serviceType, orderKind);
  if (!todos.length) return [];

  // Solo lo que puede atender la cantidad con la que se vende este servicio.
  const utiles = todos.filter(
    (s) => s.min_qty <= cantidadReferencia && s.max_qty >= cantidadReferencia,
  );
  const pool = (utiles.length ? utiles : todos).filter(
    (s) => s.score >= MIN_SCORE && s.drop_score >= MIN_DROP,
  );
  if (!pool.length) return [];

  const porPrecio = [...pool].sort((a, b) => a.rate_usd_per_1000 - b.rate_usd_per_1000);
  const premium = [...pool].sort(
    (a, b) => b.score - a.score || a.rate_usd_per_1000 - b.rate_usd_per_1000,
  )[0];
  const economico = porPrecio[0];

  // El intermedio se busca entre los dos extremos y se queda con el que más
  // calidad da por dólar: es el que de verdad merece llamarse "estándar".
  const medio = porPrecio
    .filter(
      (s) =>
        s.service_id !== premium.service_id &&
        s.service_id !== economico.service_id &&
        s.rate_usd_per_1000 > economico.rate_usd_per_1000 &&
        s.rate_usd_per_1000 < premium.rate_usd_per_1000,
    )
    .sort((a, b) => b.score / Math.sqrt(b.rate_usd_per_1000) - a.score / Math.sqrt(a.rate_usd_per_1000))[0];

  const elegidos: { level: LevelDef; service: Candidate }[] = [];
  const vistos = new Set<number>();
  const agregar = (id: LevelId, service: Candidate | undefined) => {
    if (!service || vistos.has(service.service_id)) return;
    vistos.add(service.service_id);
    elegidos.push({ level: levelDef(id) as LevelDef, service });
  };

  agregar("economico", economico);
  agregar("estandar", medio);
  agregar("premium", premium);

  // Con un solo servicio no hay niveles que comparar: queda el estándar solo.
  if (elegidos.length === 1) {
    return [{ level: levelDef("estandar") as LevelDef, service: elegidos[0].service, diferencias: [] }];
  }

  elegidos.sort((a, b) => a.service.rate_usd_per_1000 - b.service.rate_usd_per_1000);
  return elegidos.map((elegido, i) => ({
    ...elegido,
    diferencias: diferenciasCon(
      elegido.service,
      elegidos.filter((_, j) => j !== i).map((otro) => ({ level: otro.level, service: otro.service })),
    ),
  }));
}

function retencionTexto(score: number): string {
  if (score >= 85) return "prácticamente no se cae";
  if (score >= 70) return "se cae poco";
  if (score >= 50) return "se cae algo";
  return "se cae bastante";
}

function entregaTexto(service: Candidate): string {
  const promedio = formatDuration(service.avg_minutes);
  if (promedio) return `empieza en ~${promedio}`;
  if (service.speed_score >= 80) return "empieza casi de inmediato";
  if (service.speed_score >= 60) return "empieza rápido";
  if (service.speed_score >= 40) return "empieza dentro del día";
  return "empieza lento, a propósito";
}

function reposicionTexto(service: Candidate): string {
  if (service.refill_days >= 9999) return "reposición de por vida";
  if (service.refill_days > 0) return `reposición ${service.refill_days} días`;
  if (service.refill) return "con reposición";
  return "sin reposición";
}

/** Las tres cosas que describen un nivel, para la ficha y las tarjetas. */
export function rasgosDeServicio(service: Candidate): string[] {
  return [retencionTexto(service.drop_score), entregaTexto(service), reposicionTexto(service)];
}

/**
 * En qué se diferencia este servicio de los otros niveles.
 *
 * Comparamos solo lo que cambia: si dos niveles reponen lo mismo no tiene
 * sentido escribirlo, y si el barato es igual de rápido conviene decirlo, que
 * es exactamente lo que el cliente necesita para decidir.
 */
export function diferenciasCon(
  service: Candidate,
  otros: { level: LevelDef; service: Candidate }[],
): string[] {
  const frases: string[] = [];

  for (const otro of otros) {
    const partes: string[] = [];
    const nombre = otro.level.label.toLowerCase();

    const precio = otro.service.rate_usd_per_1000 / service.rate_usd_per_1000;
    if (precio >= 1.15) partes.push(`cuesta ${(precio).toFixed(1)}× menos`);
    else if (precio <= 0.87) partes.push(`cuesta ${(1 / precio).toFixed(1)}× más`);

    const drop = service.drop_score - otro.service.drop_score;
    if (drop >= 10) partes.push(`retiene mejor (${service.drop_score} contra ${otro.service.drop_score} de 100)`);
    else if (drop <= -10) partes.push(`retiene peor (${service.drop_score} contra ${otro.service.drop_score} de 100)`);

    const speed = service.speed_score - otro.service.speed_score;
    if (speed >= 10) partes.push("entrega más rápido");
    else if (speed <= -10) partes.push("entrega más lento");

    const dias = service.refill_days - otro.service.refill_days;
    if (dias > 0) {
      partes.push(
        service.refill_days >= 9999
          ? "repone de por vida"
          : otro.service.refill_days > 0
            ? `repone ${service.refill_days} días en vez de ${otro.service.refill_days}`
            : `incluye reposición por ${service.refill_days} días`,
      );
    } else if (dias < 0) {
      partes.push(otro.service.refill_days >= 9999 ? "no repone de por vida" : "repone menos días");
    }

    if (partes.length) frases.push(`Frente al ${nombre}: ${partes.join(", ")}.`);
  }

  return frases;
}

/** Los niveles hermanos de un producto ya publicado, para el comparador. */
export type SiblingLevel = {
  id: number;
  slug: string;
  name: string;
  level: string;
  quality_label: string;
  delivery_label: string;
  refill_days: number;
  price_mode: "auto" | "manual";
  margin_override: number | null;
  service_type: string;
  rate_usd_per_1000: number;
  drop_score: number;
  speed_score: number;
  min_tier: number | null;
  manual_price: number | null;
};

export function nivelesHermanos(product: {
  id: number;
  platform: string;
  service_type: string;
  order_kind?: string;
}): SiblingLevel[] {
  return all<SiblingLevel>(
    `SELECT p.id, p.slug, p.name, p.level, p.quality_label, p.delivery_label, p.refill_days,
            p.price_mode, p.margin_override, p.service_type,
            s.rate_usd_per_1000, s.drop_score, s.speed_score,
            (SELECT MIN(t.quantity) FROM product_tiers t WHERE t.product_id = p.id) AS min_tier,
            (SELECT t.price_clp FROM product_tiers t
              WHERE t.product_id = p.id AND p.price_mode = 'manual'
              ORDER BY t.quantity LIMIT 1) AS manual_price
       FROM products p
       JOIN provider_services s ON s.service_id = p.provider_service_id
      WHERE p.published = 1 AND s.provider_enabled = 1
        AND p.platform = ? AND p.service_type = ? AND s.order_kind = ?
        AND p.level != ''`,
    [product.platform, product.service_type, product.order_kind ?? "default"],
  ).sort((a, b) => levelOrder(a.level) - levelOrder(b.level));
}



export type FilaComparador = {
  id: number;
  slug: string;
  name: string;
  level: string;
  label: string;
  pitch: string;
  badge: string;
  /** Precio de todos los niveles a la misma cantidad, para que se puedan comparar. */
  priceClp: number;
  quantity: number;
  retencion: string;
  entrega: string;
  reposicion: string;
  /** true si es el nivel que el cliente está mirando. */
  actual: boolean;
};

/**
 * Los tres niveles de un producto, con el precio de cada uno a la misma
 * cantidad.
 *
 * Compararlos a la cantidad mínima de cada uno sería tramposo: si el económico
 * parte en 100 y el premium en 500, el premium se vería cinco veces más caro
 * sin serlo. Y a cantidades chicas los tres chocan contra el ticket mínimo de
 * la tienda y salen iguales, que es peor: parecen lo mismo a distinto nombre.
 * Así que se comparan a la primera cantidad que los tres pueden entregar y en
 * la que el precio efectivamente se separa.
 */
export function comparadorDeNiveles(product: {
  id: number;
  platform: string;
  service_type: string;
  order_kind?: string;
}): FilaComparador[] {
  const hermanos = nivelesHermanos(product);
  if (hermanos.length < 2) return [];

  const ctx = pricingContext();
  const precio = (hermano: SiblingLevel, cantidad: number) =>
    hermano.price_mode === "manual" && hermano.manual_price != null
      ? hermano.manual_price
      : autoPriceClp(
          hermano.rate_usd_per_1000, cantidad, hermano.service_type, ctx,
          hermano.margin_override, hermano.level,
        );

  const cantidad = cantidadComparable(hermanos, precio);
  if (!cantidad) return [];

  return hermanos.map((hermano) => {
    const def = levelDef(hermano.level);
    return {
      id: hermano.id,
      slug: hermano.slug,
      name: hermano.name,
      level: hermano.level,
      label: def?.label ?? hermano.level,
      pitch: def?.pitch ?? "",
      badge: def?.badge ?? "",
      quantity: cantidad,
      priceClp: precio(hermano, cantidad),
      retencion: retencionTexto(hermano.drop_score),
      entrega:
        hermano.delivery_label === "Inicio inmediato"
          ? "empieza de inmediato"
          : hermano.delivery_label.replace(/^Entrega en ~?/, "empieza en ~").toLowerCase(),
      reposicion:
        hermano.refill_days >= 9999
          ? "reposición de por vida"
          : hermano.refill_days > 0
            ? `reposición ${hermano.refill_days} días`
            : "sin reposición",
      actual: hermano.id === product.id,
    };
  });
}

/**
 * Cantidad a la que se comparan los niveles: la primera que todos ofrecen y en
 * la que los precios no son todos iguales. Si en ninguna se separan (porque el
 * ticket mínimo de la tienda los aplasta a todos), se usa la más grande común,
 * que es donde más se acercan a su precio real.
 */
function cantidadComparable(
  hermanos: SiblingLevel[],
  precio: (hermano: SiblingLevel, cantidad: number) => number,
): number | null {
  const porProducto = new Map<number, Set<number>>();
  for (const fila of all<{ product_id: number; quantity: number }>(
    `SELECT product_id, quantity FROM product_tiers
      WHERE product_id IN (${hermanos.map(() => "?").join(",")})`,
    hermanos.map((h) => h.id),
  )) {
    const set = porProducto.get(fila.product_id) ?? new Set<number>();
    set.add(fila.quantity);
    porProducto.set(fila.product_id, set);
  }

  const comunes = [...(porProducto.get(hermanos[0].id) ?? [])]
    .filter((quantity) => hermanos.every((h) => porProducto.get(h.id)?.has(quantity)))
    .sort((a, b) => a - b);
  if (!comunes.length) {
    const minimos = hermanos.map((h) => h.min_tier ?? 0).filter(Boolean);
    return minimos.length ? Math.max(...minimos) : null;
  }

  // Primero buscamos la cantidad en la que los tres precios son distintos; si
  // ninguna lo consigue, basta con que dos se separen.
  let parcial: number | null = null;
  for (const quantity of comunes) {
    const precios = new Set(hermanos.map((h) => precio(h, quantity)));
    if (precios.size === hermanos.length) return quantity;
    if (precios.size > 1 && parcial == null) parcial = quantity;
  }
  return parcial ?? comunes[comunes.length - 1];
}
