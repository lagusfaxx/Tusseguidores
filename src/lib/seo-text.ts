import { all } from "./db";
import { platformLabel, serviceTypeLabel } from "./labels";
import { formatClp, formatNumber, formatDuration, pricingContext, autoPriceClp } from "./pricing";

/**
 * Texto SEO generado desde los datos reales de la tienda.
 *
 * La clave es que no son plantillas con sinónimos cambiados: cada párrafo lleva
 * precios, tiempos de entrega, cantidades y garantías leídos de la base de
 * datos. Eso hace que la página de Instagram y la de TikTok sean distintas de
 * verdad —que es lo que Google premia— y de paso el texto le sirve al que lo
 * lee, porque responde lo que vino a preguntar: cuánto cuesta y cuánto demora.
 *
 * Todo lo de aquí se puede reemplazar a mano desde el panel.
 */

export type FilaPrecio = {
  serviceType: string;
  orderKind: string;
  slug: string;
  nombre: string;
  desdeQty: number;
  desdeClp: number;
  minutos: number | null;
  refillDays: number;
};

/** Lo que la tienda vende hoy para una red, con precios reales. */
export function filasDePrecio(platform: string): FilaPrecio[] {
  const ctx = pricingContext();
  const rows = all<{
    slug: string; name: string; service_type: string; order_kind: string;
    rate: number; margin_override: number | null; avg_minutes: number | null;
    refill_days: number; min_tier: number | null; manual_price: number | null;
  }>(
    `SELECT p.slug, p.name, p.service_type, s.order_kind,
            s.rate_usd_per_1000 AS rate, p.margin_override, s.avg_minutes, p.refill_days,
            (SELECT MIN(t.quantity) FROM product_tiers t WHERE t.product_id = p.id) AS min_tier,
            (SELECT t.price_clp FROM product_tiers t
              WHERE t.product_id = p.id AND p.price_mode = 'manual'
              ORDER BY t.quantity LIMIT 1) AS manual_price
       FROM products p
       JOIN provider_services s ON s.service_id = p.provider_service_id
      WHERE p.published = 1 AND s.provider_enabled = 1 AND p.platform = ?
      ORDER BY p.sort_order, p.name`,
    [platform],
  );

  return rows
    .filter((row) => row.min_tier != null)
    .map((row) => {
      const qty = row.min_tier as number;
      const tipo = row.order_kind === "custom_comments" ? "comentarios" : row.service_type;
      return {
        serviceType: row.service_type,
        orderKind: row.order_kind,
        slug: row.slug,
        nombre: row.name,
        desdeQty: qty,
        desdeClp: row.manual_price ?? autoPriceClp(row.rate, qty, tipo, ctx, row.margin_override),
        minutos: row.avg_minutes,
        refillDays: row.refill_days,
      };
    });
}

function esc(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Cómo se llama el destino en cada red, para que el texto no diga "enlace" siempre. */
const DESTINO: Record<string, string> = {
  instagram: "tu usuario de Instagram o el enlace del post",
  tiktok: "tu usuario de TikTok o el enlace del video",
  youtube: "el enlace de tu canal o del video",
  facebook: "el enlace de tu página o de la publicación",
  twitter: "tu usuario de X o el enlace del post",
  telegram: "el enlace de tu canal",
  whatsapp: "el enlace de invitación de tu canal",
  spotify: "el enlace del perfil de artista o de la canción",
  twitch: "el nombre de tu canal",
  threads: "tu usuario de Threads",
  linkedin: "la URL de tu perfil o página",
};

/** Preguntas propias de cada red: es donde vive la búsqueda de cola larga. */
const PREGUNTAS: Record<string, { q: string; a: string }[]> = {
  instagram: [
    { q: "¿Instagram se da cuenta?", a: "No hay forma de que distinga estos seguidores de los que llegan solos, porque nunca entramos a tu cuenta. Lo que sí se nota a simple vista es pedir 10.000 seguidores para una cuenta con 200: sube de a poco." },
    { q: "¿Sirve si tengo la cuenta privada?", a: "No. Tiene que estar pública durante toda la entrega. Puedes volver a ponerla privada cuando termine." },
    { q: "¿Los seguidores comentan o dan me gusta?", a: "No. Son cuentas con foto y publicaciones que te siguen, pero la interacción se compra aparte. Si quieres que tus posts se vean activos, suma me gusta o comentarios." },
    { q: "¿Afecta mi alcance?", a: "El alcance se mide contra tus seguidores totales, así que un salto grande puede bajar tu porcentaje de interacción un tiempo. Por eso conviene acompañarlo con me gusta en las publicaciones." },
  ],
  tiktok: [
    { q: "¿Me ayuda a salir en el Para Ti?", a: "Las visualizaciones son la señal que más pesa para que TikTok siga mostrando un video. No es magia: si el video retiene, el empujón inicial ayuda; si no retiene, se apaga igual." },
    { q: "¿Puedo comprar para un video que ya subí?", a: "Sí, y de hecho funciona mejor en videos recientes. Pega el enlace directo del video." },
    { q: "¿Sirve para la monetización?", a: "TikTok exige seguidores y vistas reales sostenidas en el tiempo. Esto te acerca a los mínimos, pero no reemplaza publicar seguido." },
  ],
  youtube: [
    { q: "¿Me sirve para monetizar?", a: "Los requisitos de YouTube son 1.000 suscriptores y 4.000 horas de reproducción. Los suscriptores te acercan al primer número; las horas dependen de que la gente vea tus videos completos." },
    { q: "¿Por qué la entrega es tan lenta?", a: "A propósito. YouTube revisa los saltos bruscos, así que entregamos de a poco. Un pedido de 1.000 suscriptores puede tomar varios días y eso es lo correcto." },
    { q: "¿Se caen los suscriptores?", a: "Algunos sí. Por eso los packs con reposición los reponemos gratis dentro del plazo indicado en cada uno." },
  ],
  facebook: [
    { q: "¿Sirve para una página de negocio?", a: "Sí, es el caso más común. Necesitamos el enlace público de la página." },
    { q: "¿Los seguidores ven mis publicaciones?", a: "Facebook muestra tus posts a una parte de tus seguidores. Tener más base ayuda, pero el alcance real lo decide el contenido." },
  ],
  twitter: [
    { q: "¿X borra estas cuentas?", a: "X limpia cuentas inactivas cada cierto tiempo, así que espera algo de caída. Los packs con reposición la cubren dentro del plazo." },
    { q: "¿Puedo comprar vistas para un tweet viejo?", a: "Sí, mientras el post siga público. Pega el enlace directo." },
  ],
  telegram: [
    { q: "¿Funciona en canales privados?", a: "Solo si tienen enlace de invitación abierto. En canales cerrados el sistema no puede entrar." },
    { q: "¿Los miembros leen los mensajes?", a: "Suman a la cuenta de miembros y dan credibilidad a quien llega. Las vistas de cada publicación se compran aparte." },
  ],
  whatsapp: [
    { q: "¿Sirve para un canal nuevo?", a: "Sí. Copia el enlace de invitación desde el canal y pégalo al comprar." },
    { q: "¿Es para grupos o para canales?", a: "Para canales de WhatsApp, que son los públicos. En los grupos no se puede." },
  ],
  spotify: [
    { q: "¿Me pagan regalías por estas reproducciones?", a: "Spotify paga por reproducciones válidas, pero decide caso a caso y puede descartar las que considere irregulares. Tómalo como visibilidad, no como ingreso." },
    { q: "¿Por qué se entregan de a poco?", a: "Porque así es como escucha la gente de verdad. Una avalancha en una hora es justo lo que Spotify filtra." },
  ],
  twitch: [
    { q: "¿Sirve para llegar a Afiliado?", a: "Twitch pide seguidores, espectadores promedio y días emitidos. Los seguidores te ayudan con uno de esos números, no con todos." },
    { q: "¿Los espectadores chatean?", a: "No. Suman al contador y te suben en la categoría, que es lo que hace que gente real entre." },
  ],
};

const PREGUNTAS_BASE = [
  { q: "¿Necesitan mi contraseña?", a: "Nunca. Solo el usuario o el enlace público. Si alguien te la pide para esto, desconfía." },
  { q: "¿Cómo pago?", a: "Con Flow: tarjeta de crédito o débito por Webpay, transferencia bancaria o Mercado Pago. Los precios están en pesos chilenos." },
  { q: "¿Y si no llega?", a: "Te devolvemos el 100%. Escríbenos con el código de pedido que te damos al pagar." },
];

/**
 * Cuerpo SEO de la página de una red social. Devuelve HTML listo para insertar.
 */
export function textoDeRed(platform: string): { html: string; faq: { q: string; a: string }[] } | null {
  const filas = filasDePrecio(platform);
  if (!filas.length) return null;

  const red = platformLabel(platform);
  const destino = DESTINO[platform] ?? "el enlace de tu perfil";
  const barato = filas.reduce((min, f) => (f.desdeClp < min.desdeClp ? f : min));
  const conRefill = filas.filter((f) => f.refillDays > 0);
  const rapidos = filas.filter((f) => f.minutos != null).sort((a, b) => (a.minutos ?? 0) - (b.minutos ?? 0));
  const tipos = [...new Set(filas.map((f) => f.serviceType))];

  const listaTipos = tipos
    .map((t) => serviceTypeLabel(t).toLowerCase())
    .reduce((texto, t, i, arr) => (i === 0 ? t : i === arr.length - 1 ? `${texto} y ${t}` : `${texto}, ${t}`), "");

  const filasTabla = filas
    .map(
      (f) => `<tr>
<td><a href="/producto/${esc(f.slug)}">${esc(f.nombre)}</a></td>
<td>${formatNumber(f.desdeQty)}</td>
<td>${formatClp(f.desdeClp)}</td>
<td>${f.minutos != null ? esc(formatDuration(f.minutos) ?? "—") : "Inicio inmediato"}</td>
<td>${f.refillDays >= 9999 ? "De por vida" : f.refillDays > 0 ? `${f.refillDays} días` : "—"}</td>
</tr>`,
    )
    .join("\n");

  const html = [
    `<h2>Comprar seguidores para ${esc(red)} en Chile</h2>`,
    `<p>En TusSeguidores puedes comprar ${listaTipos} para ${esc(red)} pagando en pesos chilenos, ` +
      `desde ${formatClp(barato.desdeClp)} por ${formatNumber(barato.desdeQty)} unidades. ` +
      `No pedimos tu contraseña en ningún momento: para entregar nos basta con ${destino}, ` +
      `siempre que la cuenta esté pública.</p>`,

    `<h2>Precios de ${esc(red)} actualizados</h2>`,
    `<p>Estos son los precios de partida de cada servicio. En la ficha de cada uno eliges la cantidad exacta ` +
      `y el precio se ajusta solo.</p>`,
    `<table><thead><tr><th>Servicio</th><th>Desde</th><th>Precio</th><th>Entrega</th><th>Reposición</th></tr></thead>` +
      `<tbody>${filasTabla}</tbody></table>`,

    `<h2>Cuánto demora la entrega</h2>`,
    rapidos.length
      ? `<p>La mayoría de los pedidos parte antes de diez minutos desde que Flow confirma el pago. ` +
        `Hoy el servicio más rápido para ${esc(red)} es ${esc(rapidos[0].nombre.toLowerCase())}, ` +
        `con una entrega promedio de ${esc(formatDuration(rapidos[0].minutos) ?? "menos de una hora")}. ` +
        `Los tiempos de cada pack están en su ficha y salen del servicio que efectivamente usamos, ` +
        `no de un promedio general.</p>`
      : `<p>La mayoría de los pedidos parte antes de diez minutos desde que Flow confirma el pago. ` +
        `El tiempo total depende del servicio y de la cantidad, y aparece en la ficha de cada pack.</p>`,

    `<h2>Cómo comprar</h2>`,
    `<ol>` +
      `<li>Elige el servicio de ${esc(red)} que necesitas y la cantidad.</li>` +
      `<li>Pega ${destino} y tu correo.</li>` +
      `<li>Paga con Webpay, transferencia o Mercado Pago.</li>` +
      `<li>Guarda el código que te mostramos: con él sigues el avance cuando quieras.</li>` +
      `</ol>`,

    conRefill.length
      ? `<h2>Garantía de reposición</h2>` +
        `<p>${conRefill.length} de nuestros ${filas.length} servicios para ${esc(red)} incluyen reposición sin costo: ` +
        `si las unidades entregadas bajan dentro del plazo, las reponemos. ` +
        `Cada ficha indica su plazo exacto. En los que no la incluyen, si el pedido no se entrega te devolvemos el dinero.</p>`
      : `<h2>Si algo sale mal</h2>` +
        `<p>Si un pedido no se entrega, te devolvemos el 100% del monto pagado. Escríbenos con tu código de pedido.</p>`,
  ].join("\n");

  return {
    html,
    faq: [...(PREGUNTAS[platform] ?? []), ...PREGUNTAS_BASE],
  };
}

/** Cuerpo SEO de la portada, armado con lo que la tienda vende hoy. */
export function textoDePortada(): string | null {
  const filas = all<{ platform: string; n: number }>(
    `SELECT p.platform, COUNT(*) AS n
       FROM products p
       JOIN provider_services s ON s.service_id = p.provider_service_id
      WHERE p.published = 1 AND s.provider_enabled = 1
      GROUP BY p.platform ORDER BY n DESC`,
  );
  if (!filas.length) return null;

  const ctx = pricingContext();
  const todos = all<{
    platform: string; slug: string; name: string; service_type: string; order_kind: string;
    rate: number; margin_override: number | null; min_tier: number | null;
  }>(
    `SELECT p.platform, p.slug, p.name, p.service_type, s.order_kind,
            s.rate_usd_per_1000 AS rate, p.margin_override,
            (SELECT MIN(t.quantity) FROM product_tiers t WHERE t.product_id = p.id) AS min_tier
       FROM products p
       JOIN provider_services s ON s.service_id = p.provider_service_id
      WHERE p.published = 1 AND s.provider_enabled = 1`,
  );

  const precios = todos
    .filter((r) => r.min_tier != null)
    .map((r) => ({
      ...r,
      clp: autoPriceClp(
        r.rate,
        r.min_tier as number,
        r.order_kind === "custom_comments" ? "comentarios" : r.service_type,
        ctx,
        r.margin_override,
      ),
    }));
  if (!precios.length) return null;

  const barato = precios.reduce((min, r) => (r.clp < min.clp ? r : min));
  const redes = filas.map((f) => platformLabel(f.platform));
  const listaRedes = redes
    .slice(0, 6)
    .reduce((t, r, i, arr) => (i === 0 ? r : i === arr.length - 1 ? `${t} y ${r}` : `${t}, ${r}`), "");

  const enlaces = filas
    .map(
      (f) =>
        `<li><a href="/${esc(f.platform)}">Comprar seguidores ${esc(platformLabel(f.platform))}</a> — ` +
        `${f.n} servicio${f.n === 1 ? "" : "s"}</li>`,
    )
    .join("\n");

  return [
    `<h2>Comprar seguidores en Chile, pagando en pesos</h2>`,
    `<p>TusSeguidores.cl es una tienda chilena de servicios para redes sociales. ` +
      `Tenemos ${precios.length} servicios repartidos en ${filas.length} redes —${esc(listaRedes)}— ` +
      `desde ${formatClp(barato.clp)}. Pagas con Webpay, transferencia o Mercado Pago a través de Flow, ` +
      `y la entrega empieza sola apenas se confirma el pago.</p>`,
    `<p>No pedimos contraseñas ni acceso a tus cuentas: con tu usuario o el enlace público basta. ` +
      `Eso significa que puedes seguir usando tu cuenta con normalidad mientras se entrega el pedido.</p>`,

    `<h2>Qué puedes comprar</h2>`,
    `<ul>${enlaces}</ul>`,

    `<h2>Cuánto cuesta</h2>`,
    `<p>Los precios están en pesos chilenos e incluyen impuestos. El pack más barato de la tienda cuesta ` +
      `${formatClp(barato.clp)} por ${formatNumber(barato.min_tier as number)} unidades de ` +
      `${esc(barato.name.toLowerCase())}. En cada ficha eliges la cantidad exacta y ves el precio antes de pagar; ` +
      `no hay costos ocultos ni suscripciones.</p>`,

    `<h2>Es seguro para mi cuenta</h2>`,
    `<p>La entrega se hace desde fuera de tu cuenta, sin instalar nada y sin iniciar sesión. ` +
      `Lo único que te pedimos es que el perfil o la publicación estén públicos mientras dura el pedido. ` +
      `Los packs marcados con reposición reponen sin costo lo que se caiga dentro del plazo indicado, ` +
      `y si un pedido no se entrega devolvemos el 100% del dinero.</p>`,
  ].join("\n");
}
