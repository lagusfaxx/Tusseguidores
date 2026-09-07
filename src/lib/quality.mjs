/**
 * Puntajes de calidad de un servicio del proveedor.
 *
 * El cliente elige un producto ("Seguidores para Instagram") y es la tienda la
 * que decide a qué servicio del proveedor se lo pide. Para eso puntuamos cada
 * servicio en dos ejes: cuánto se cae (drop) y cuánto demora.
 *
 * La única información que da el proveedor es el nombre del servicio, sus
 * banderas de reposición y el tiempo promedio, así que leemos las convenciones
 * que usan todos los paneles SMM: "Non Drop", "Low Drop", "30 Days Refill",
 * "Instant", "0-1H Start", etc.
 */

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

/** 0 = se cae entero, 100 = no se cae. */
export function dropScore(name, refillDays = 0) {
  const n = String(name ?? "");
  let score = 50;

  if (/\bnon[-\s]?drop\b|\bno\s*drop\b|\bzero\s*drop\b/i.test(n)) score = 90;
  else if (/\blow\s*drop\b|\bless\s*drop\b/i.test(n)) score = 72;
  else if (/\bhigh\s*drops?\b|\bhuge\s*drop\b/i.test(n)) score = 18;
  else if (/\bdrops?\b/i.test(n)) score = 45;

  // La garantía de reposición es la señal más dura: el proveedor se compromete.
  if (refillDays >= 9999) score += 26;
  else if (refillDays >= 365) score += 20;
  else if (refillDays >= 99) score += 15;
  else if (refillDays >= 60) score += 11;
  else if (refillDays >= 30) score += 8;

  if (/\bno\s*refill\b|\bwithout\s*refill\b/i.test(n)) score -= 14;
  if (/\bnot\s*guarante+d\b|\bno\s*guarante+d?\b/i.test(n)) score -= 18;
  else if (/\bguarante+d?\b/i.test(n)) score += 5;

  if (/\breal\b|\bhq\b|\bhigh\s*quality\b/i.test(n)) score += 6;
  if (/\bbot\s*users?\b|\bfake\b/i.test(n)) score -= 12;

  return clamp(score);
}

/** 0 = tardísimo, 100 = arranca al instante. */
export function speedScore(name, avgMinutes) {
  const n = String(name ?? "");
  let score;

  if (avgMinutes != null && avgMinutes > 0) {
    if (avgMinutes <= 5) score = 100;
    else if (avgMinutes <= 15) score = 95;
    else if (avgMinutes <= 30) score = 89;
    else if (avgMinutes <= 60) score = 83;
    else if (avgMinutes <= 180) score = 73;
    else if (avgMinutes <= 360) score = 63;
    else if (avgMinutes <= 720) score = 53;
    else if (avgMinutes <= 1440) score = 43;
    else if (avgMinutes <= 4320) score = 28;
    else score = 14;
  } else {
    // Sin dato del proveedor nos guiamos por el plazo que promete el nombre.
    const prometido = startMinutesFromName(n);
    if (prometido == null) score = 50;
    else if (prometido <= 30) score = 82;
    else if (prometido <= 60) score = 76;
    else if (prometido <= 180) score = 68;
    else if (prometido <= 720) score = 55;
    else if (prometido <= 1440) score = 42;
    else score = 28;
  }

  if (/\binstant\b/i.test(n)) score += 4;
  if (/\bsuper\s*fast\b|\bultra\s*fast\b/i.test(n)) score += 4;
  if (/\bdrip[-\s]?feed\b/i.test(n)) score -= 10;

  return clamp(score);
}

/**
 * Minutos que promete el nombre del servicio para *empezar* la entrega.
 *
 * Los paneles SMM escriben el plazo dentro del nombre —"Instant", "0-1H",
 * "1-12 Hours", "24-48H", "Start Time: 0-6 Hrs"— y esa es toda la información
 * que hay: la API de servicios no devuelve el tiempo promedio.
 *
 * Se devuelve **el extremo alto** del rango a propósito. Un "0-24H" que
 * prometemos como inmediato es una promesa incumplida en veinticuatro horas;
 * prometido como "hasta 24 h", es un pedido que llegó antes.
 *
 * Devuelve null cuando el nombre no dice nada: ahí no hay que inventar un
 * plazo, hay que decir que no está garantizado.
 */
export function startMinutesFromName(name) {
  const n = String(name ?? "").toLowerCase();

  // El plazo de reposición no es el de entrega. "30D Refill" y "365 Days
  // Guarantee" hablan de cuánto reponen, no de cuándo empiezan, así que se
  // sacan del texto antes de buscar nada.
  const limpio = n
    .replace(/\d+\s*(?:d|days?|día|dias|días)\s*(?:refill|guarante\w*|garant\w*)/g, " ")
    .replace(/(?:refill|guarante\w*|garant\w*)\s*\d+\s*(?:d|days?)/g, " ")
    .replace(/lifetime\s*(?:refill|guarante\w*)/g, " ")
    // Los ritmos tampoco son plazos: "100-300 Hour/Day" es cuánto entrega por
    // día, no cuándo empieza. Todo lo que lleve una barra detrás se va.
    .replace(
      /\d+[\d\s.,\-–]*(?:k|m)?\s*(?:hours?|hrs?|h|minutes?|mins?|m|days?|d)?\s*\/\s*(?:day|days|d|hour|hours|hr|h|week|month)\b/g,
      " ",
    );

  // Rangos explícitos: "0-1h", "1 - 12 hours", "24-48 hrs", "30-60 min".
  const rango = limpio.match(
    /\b(\d+)\s*(?:-|–|to)\s*(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minutes|d|day|days)\b/,
  );
  if (rango) return enMinutos(Number(rango[2]), rango[3]);

  // Un número con unidad, precedido de la palabra que lo enmarca. Las palabras
  // van con límite de palabra a propósito: sin él, el "in" de "Instant"
  // enganchaba el "30 d" de "30D Refill" y un servicio inmediato quedaba
  // marcado como de treinta días.
  const simple = limpio.match(
    /\b(?:start|starts|starting|speed|delivery|deliver|within|in|after|time)\b\W{0,12}(\d+)\s*(h|hr|hrs|hour|hours|m|min|mins|minutes|d|day|days)\b/,
  );
  if (simple) return enMinutos(Number(simple[1]), simple[2]);

  // Un plazo suelto con unidad de tiempo y nada que lo contradiga.
  const suelto = limpio.match(/\b(\d+)\s*(h|hr|hrs|hour|hours)\b/);
  if (suelto) return enMinutos(Number(suelto[1]), suelto[2]);

  // "Instant" e "Immediate" son la promesa más común y la más repetida.
  if (/\binstant\w*\b|\bimmediate\w*\b|\bno\s*delay\b/.test(limpio)) return 30;
  if (/\bsuper\s*fast\b|\bultra\s*fast\b|\bfastest\b/.test(limpio)) return 60;
  if (/\bfast\b|\bquick\b/.test(limpio)) return 180;
  if (/\bslow\b|\bgradual\b|\bdrip\s*feed\b/.test(limpio)) return 1440;

  return null;
}

function enMinutos(valor, unidad) {
  if (!Number.isFinite(valor) || valor <= 0) return null;
  if (/^m/.test(unidad)) return Math.min(valor, 60 * 24 * 30);
  if (/^h/.test(unidad)) return Math.min(valor * 60, 60 * 24 * 30);
  return Math.min(valor * 60 * 24, 60 * 24 * 30);
}

/**
 * El plazo con el que trabajamos: el promedio real si el proveedor lo dio, y
 * si no, lo que promete el nombre. Null si no hay ninguno de los dos.
 */
export function tiempoDeEntrega(name, avgMinutes) {
  if (avgMinutes != null && avgMinutes > 0) return avgMinutes;
  return startMinutesFromName(name);
}

/** Peso con el que se combinan ambos ejes al elegir servicio. */
export const DROP_WEIGHT = 0.55;
export const SPEED_WEIGHT = 0.45;

export function overallScore(drop, speed) {
  return drop * DROP_WEIGHT + speed * SPEED_WEIGHT;
}

/** Días de reposición leídos del nombre del servicio. */
export function refillDaysFromName(name) {
  const n = String(name ?? "");
  if (/lifetime\s*(refill|guarante)/i.test(n)) return 9999;
  const match = n.match(/(\d+)\s*(?:d|days?)\s*(?:refill|guarante)/i);
  if (match) return Number(match[1]);
  const alt = n.match(/(?:refill|guarante\w*)\s*(\d+)\s*(?:d|days?)/i);
  if (alt) return Number(alt[1]);
  return 0;
}

/**
 * País o región a la que apunta el servicio.
 *
 * Para una tienda chilena un servicio "Indian Accounts" no sirve aunque tenga
 * excelente puntaje: los seguidores no se parecen en nada a la audiencia real
 * de la cuenta. Solo enrutamos a servicios globales o de la región.
 */
const GEO_PATTERNS = [
  ["latam", /\b(latin|latino|latam|spanish|espa|chile|chilean|mexic|argentin|colombia|peru|brazil|brasil|brazilian)\b/i],
  ["targeted", /\b(indian|india|bangladesh|bangla|pakistan|pakistani|indonesia|indonesian|arab|arabic|saudi|turkey|turkish|russia|russian|vietnam|nigeria|african|egypt|iran|iraq|malaysia|thailand|philippine|korea|japan|china|chinese)\b/i],
  ["western", /\b(usa|u\.s\.a|united states|american|uk|united kingdom|england|english|british|europe|european|canada|canadian|australia|australian|germany|german|france|french|italy|italian|spain|spanish|portugal|portuguese|dutch|polish|greek)\b/i],
];

export function detectGeo(name) {
  const n = String(name ?? "");
  for (const [geo, re] of GEO_PATTERNS) if (re.test(n)) return geo;
  return "global";
}

/**
 * Geografías a las que se puede enrutar sin desvirtuar el producto.
 *
 * Solo lo neutro y lo regional. Un servicio marcado como estadounidense,
 * italiano o indio es un producto distinto —se nota, sobre todo en los
 * comentarios— y debe elegirse a mano, no caer por puntaje.
 */
export const ROUTABLE_GEOS = ["global", "latam"];

/**
 * Subtipo del servicio dentro de su categoría.
 *
 * "Instagram Likes" y "Instagram Live Stream Likes" caen los dos en el tipo
 * "likes", pero no son el mismo producto: uno va a una publicación y el otro a
 * una transmisión en vivo. Marcamos el subtipo para no mezclarlos al enrutar.
 */
const VARIANT_PATTERNS = [
  ["live", /\b(live\s*stream|livestream|live\s*video|en\s*vivo)\b/i],
  ["comment", /\bcomment\s+(likes?|replies|hearts)\b/i],
  ["poll", /\b(poll|question\s*answer|quiz|slider)\b/i],
  ["link", /\b(link\s*click|swipe\s*up|profile\s*visits?|website\s*click|link\s*press|sticker)\b/i],
  ["reach", /\b(reach|impressions?)\b/i],
  ["premium", /\bpremium\b/i],
  ["drip", /\bdrip[-\s]?feed\b/i],
  ["subscription", /\bsubscriptions?\b/i],
];

export function detectVariant(name) {
  const n = String(name ?? "");
  for (const [variant, re] of VARIANT_PATTERNS) if (re.test(n)) return variant;
  return "";
}

/**
 * Cómo hay que pedirle el servicio al proveedor.
 *
 * La API acepta varias formas de pedido y no todas llevan "quantity": los
 * comentarios personalizados llevan el texto de cada comentario, las encuestas
 * el número de la opción, los paquetes no llevan cantidad. Pedirle "quantity" a
 * un servicio de comentarios personalizados entrega cualquier cosa, así que
 * cada servicio queda marcado con su forma de pedido.
 *
 * Al sincronizar en vivo esto se reemplaza por el campo `type` que devuelve el
 * proveedor, que es la fuente autoritativa; las reglas de abajo son para el
 * catálogo importado desde la lista de precios, que no trae ese campo.
 */
export const ORDER_KINDS = {
  DEFAULT: "default",
  CUSTOM_COMMENTS: "custom_comments",
  POLL: "poll",
  MENTIONS: "mentions",
  PACKAGE: "package",
  SUBSCRIPTIONS: "subscriptions",
  DRIP: "drip",
};

/** Formas de pedido que la tienda sabe vender hoy. */
export const SUPPORTED_ORDER_KINDS = [ORDER_KINDS.DEFAULT, ORDER_KINDS.CUSTOM_COMMENTS];

export function detectOrderKind(name, serviceType = "") {
  const n = String(name ?? "");
  if (/\bcustom\b/i.test(n) && (/comment/i.test(n) || serviceType === "comentarios")) {
    return ORDER_KINDS.CUSTOM_COMMENTS;
  }
  if (/\bpoll\b|\banswer\s*number\b/i.test(n)) return ORDER_KINDS.POLL;
  if (/\bmentions?\b/i.test(n)) return ORDER_KINDS.MENTIONS;
  if (/\bpackage\b/i.test(n)) return ORDER_KINDS.PACKAGE;
  if (/\bsubscriptions?\b/i.test(n)) return ORDER_KINDS.SUBSCRIPTIONS;
  if (/\bdrip[-\s]?feed\b/i.test(n)) return ORDER_KINDS.DRIP;
  return ORDER_KINDS.DEFAULT;
}

/** Traduce el campo `type` que devuelve la API del proveedor. */
export function orderKindFromApiType(apiType, name = "", serviceType = "") {
  const t = String(apiType ?? "").toLowerCase().replace(/[^a-z]/g, "");
  if (!t) return detectOrderKind(name, serviceType);
  if (t.includes("customcomment")) return ORDER_KINDS.CUSTOM_COMMENTS;
  if (t.includes("poll")) return ORDER_KINDS.POLL;
  if (t.includes("mention")) return ORDER_KINDS.MENTIONS;
  if (t.includes("package")) return ORDER_KINDS.PACKAGE;
  if (t.includes("subscription")) return ORDER_KINDS.SUBSCRIPTIONS;
  if (t.includes("dripfeed")) return ORDER_KINDS.DRIP;
  if (t.includes("default")) return ORDER_KINDS.DEFAULT;
  return detectOrderKind(name, serviceType);
}
