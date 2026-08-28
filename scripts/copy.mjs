/**
 * Textos en español para los productos que se publican al sembrar la tienda.
 * Están escritos a mano por combinación red social + tipo de servicio para que
 * las fichas no se lean como plantillas repetidas.
 */

export const PLATFORM_LABEL = {
  instagram: "Instagram", tiktok: "TikTok", youtube: "YouTube", facebook: "Facebook",
  telegram: "Telegram", whatsapp: "WhatsApp", twitter: "X (Twitter)", spotify: "Spotify",
  twitch: "Twitch", kick: "Kick", threads: "Threads", linkedin: "LinkedIn",
  discord: "Discord", snapchat: "Snapchat", pinterest: "Pinterest", soundcloud: "SoundCloud",
};

export const TYPE_LABEL = {
  seguidores: "Seguidores", suscriptores: "Suscriptores", miembros: "Miembros",
  likes: "Me gusta", reacciones: "Reacciones", vistas: "Visualizaciones",
  reproducciones: "Reproducciones", comentarios: "Comentarios", compartidos: "Compartidos",
  guardados: "Guardados", historias: "Vistas de historias", "en-vivo": "Espectadores en vivo",
  votos: "Votos", trafico: "Visitas web",
};

/** Cómo se le pide el destino al comprador según la red y el servicio. */
export const LINK_FIELD = {
  instagram: {
    perfil: { label: "Usuario de Instagram", placeholder: "@tucuenta", help: "Escribe tu usuario sin el @ o pega el enlace de tu perfil. La cuenta debe estar pública." },
    post: { label: "Enlace de la publicación", placeholder: "https://instagram.com/p/xxxxx", help: "Pega el enlace del post o reel. La cuenta debe estar pública." },
  },
  tiktok: {
    perfil: { label: "Usuario de TikTok", placeholder: "@tucuenta", help: "Tu usuario de TikTok. La cuenta no puede ser privada." },
    post: { label: "Enlace del video", placeholder: "https://www.tiktok.com/@usuario/video/123", help: "Pega el enlace directo del video." },
  },
  youtube: {
    perfil: { label: "Enlace del canal", placeholder: "https://youtube.com/@tucanal", help: "Pega la URL de tu canal de YouTube." },
    post: { label: "Enlace del video", placeholder: "https://youtube.com/watch?v=xxxx", help: "Pega el enlace del video o del Short." },
  },
  facebook: {
    perfil: { label: "Enlace de la página o perfil", placeholder: "https://facebook.com/tupagina", help: "La página debe ser pública." },
    post: { label: "Enlace de la publicación", placeholder: "https://facebook.com/tupagina/posts/123", help: "Pega el enlace del post o del video." },
  },
  telegram: {
    perfil: { label: "Enlace del canal o grupo", placeholder: "https://t.me/tucanal", help: "El canal debe ser público o tener enlace de invitación abierto." },
    post: { label: "Enlace de la publicación", placeholder: "https://t.me/tucanal/45", help: "Pega el enlace del mensaje." },
  },
  whatsapp: {
    perfil: { label: "Enlace del canal", placeholder: "https://whatsapp.com/channel/xxxx", help: "Copia el enlace de invitación de tu canal de WhatsApp." },
    post: { label: "Enlace de la publicación", placeholder: "https://whatsapp.com/channel/xxxx/123", help: "Pega el enlace del mensaje del canal." },
  },
  twitter: {
    perfil: { label: "Usuario de X", placeholder: "@tucuenta", help: "Tu usuario de X (Twitter), sin el @." },
    post: { label: "Enlace del post", placeholder: "https://x.com/usuario/status/123", help: "Pega el enlace del tweet." },
  },
  spotify: {
    perfil: { label: "Enlace del perfil de artista", placeholder: "https://open.spotify.com/artist/xxxx", help: "Copia el enlace desde Spotify con «Compartir → Copiar enlace»." },
    post: { label: "Enlace de la canción o playlist", placeholder: "https://open.spotify.com/track/xxxx", help: "Copia el enlace desde Spotify con «Compartir → Copiar enlace»." },
  },
  twitch: {
    perfil: { label: "Usuario de Twitch", placeholder: "tucanal", help: "El nombre de tu canal de Twitch." },
    post: { label: "Enlace del stream", placeholder: "https://twitch.tv/tucanal", help: "Pega el enlace del canal en vivo." },
  },
  threads: {
    perfil: { label: "Usuario de Threads", placeholder: "@tucuenta", help: "Tu usuario de Threads. El perfil debe estar público." },
    post: { label: "Enlace del post", placeholder: "https://threads.net/@usuario/post/xxx", help: "Pega el enlace de la publicación." },
  },
  linkedin: {
    perfil: { label: "Enlace del perfil o página", placeholder: "https://linkedin.com/in/tuperfil", help: "Pega la URL pública de tu perfil o página." },
    post: { label: "Enlace de la publicación", placeholder: "https://linkedin.com/posts/xxxx", help: "Pega el enlace del post." },
  },
};

/** Tipos que apuntan a una publicación concreta en vez de al perfil. */
export const POST_TYPES = new Set([
  "likes", "reacciones", "vistas", "comentarios", "compartidos", "guardados",
  "reproducciones", "votos", "historias",
]);

const INTRO = {
  seguidores: (p) =>
    `Suma seguidores a tu cuenta de ${p} sin complicaciones. Eliges cuántos quieres, pagas y la entrega empieza sola: no te pedimos la clave ni acceso a tu cuenta, solo tu usuario.`,
  suscriptores: (p) =>
    `Haz crecer tu canal de ${p} con suscriptores que se suman de forma gradual, para que el crecimiento se vea natural y el canal siga cumpliendo los requisitos de monetización.`,
  miembros: (p) =>
    `Llena tu canal o grupo de ${p} con miembros reales. Un canal con comunidad convence mucho más rápido a quien recién llega.`,
  likes: (p) =>
    `Dale empuje a tus publicaciones de ${p}. Los me gusta llegan a los pocos minutos de confirmado el pago y ayudan a que el algoritmo muestre tu contenido a más gente.`,
  reacciones: (p) =>
    `Suma reacciones a tus publicaciones de ${p}. Una publicación con reacciones se ve activa y motiva a que el resto también participe.`,
  vistas: (p) =>
    `Aumenta las visualizaciones de tus videos en ${p}. Es la señal que más peso tiene para que el contenido siga circulando en el feed.`,
  reproducciones: (p) =>
    `Sube las reproducciones de tu música en ${p}. Las cuentas de escucha suben de a poco, con la cadencia que espera la plataforma.`,
  comentarios: (p) =>
    `Agrega comentarios a tus publicaciones de ${p}. Una publicación con conversación retiene mucho más y se posiciona mejor.`,
  compartidos: (p) =>
    `Multiplica el alcance de tu contenido en ${p} con compartidos. Es la métrica que más ayuda a que una publicación salga de tu círculo habitual.`,
  guardados: (p) =>
    `Suma guardados a tus publicaciones de ${p}. Es una de las señales que más valora el algoritmo, porque indica que el contenido vale la pena volver a verlo.`,
  historias: (p) =>
    `Sube las vistas de tus historias de ${p} y aparece más arriba en la barra de historias de tus seguidores.`,
  "en-vivo": (p) =>
    `Llena tu transmisión en vivo de ${p} con espectadores durante todo el stream, para que quien llegue se encuentre con una sala activa.`,
  votos: (p) => `Consigue votos para tu encuesta de ${p} de forma rápida y ordenada.`,
  trafico: () => `Recibe visitas reales a tu sitio web desde distintos países y dispositivos.`,
};

const BULLETS = {
  seguidores: [
    "No pedimos tu contraseña, solo tu usuario",
    "Entrega automática apenas se confirma el pago",
    "Perfiles con foto y publicaciones, no cuentas vacías",
    "Puedes seguir usando tu cuenta con normalidad",
  ],
  suscriptores: [
    "Entrega gradual para que el canal no levante alertas",
    "No pedimos acceso al canal",
    "Compatible con canales monetizados",
    "Soporte por WhatsApp si algo se demora",
  ],
  miembros: [
    "Solo necesitamos el enlace del canal o grupo",
    "Entrega desde los primeros minutos",
    "Miembros con perfil, no cuentas en blanco",
    "Sin límite de publicaciones posteriores",
  ],
  likes: [
    "Llegan a los pocos minutos de pagar",
    "Repartidos en el tiempo, no todos de golpe",
    "Funciona en posts, reels y videos",
    "No afecta el alcance orgánico de tu cuenta",
  ],
  reacciones: [
    "Puedes elegir la publicación exacta",
    "Entrega desde el primer minuto",
    "Se reparten para que se vea natural",
    "Sin acceso a tu cuenta",
  ],
  vistas: [
    "Inicio inmediato tras el pago",
    "Se contabilizan como vistas válidas",
    "Sirve para videos, reels y shorts",
    "Velocidad de entrega ajustada a cada plataforma",
  ],
  reproducciones: [
    "Reproducciones completas, no clics sueltos",
    "Entrega repartida en varios días",
    "Funciona con canciones, álbumes y playlists",
    "No requiere acceso a tu cuenta de artista",
  ],
  comentarios: [
    "Comentarios en español, escritos por personas",
    "Puedes enviarnos los textos que quieras",
    "Se publican de forma escalonada",
    "Ideal para lanzamientos y promociones",
  ],
  compartidos: [
    "Aumenta el alcance fuera de tus seguidores",
    "Entrega rápida y constante",
    "Combina bien con me gusta y guardados",
    "Sin riesgo para tu cuenta",
  ],
  guardados: [
    "La señal que más pondera el algoritmo",
    "Entrega en pocas horas",
    "Compatible con reels y carruseles",
    "Sin contraseña ni acceso",
  ],
  historias: [
    "Vistas en todas las historias activas",
    "Entrega en menos de una hora",
    "Te sube en la barra de historias",
    "Sin acceso a tu cuenta",
  ],
  "en-vivo": [
    "Espectadores durante todo el stream",
    "Debes tener el vivo ya iniciado",
    "Entrega en los primeros minutos",
    "Sube tu posición en la categoría",
  ],
  votos: ["Votos en la opción que elijas", "Entrega rápida", "Sin acceso a tu cuenta", "Soporte directo"],
  trafico: ["Visitas de países reales", "Tráfico de escritorio y móvil", "Se ve en Google Analytics", "Entrega diaria constante"],
};

const FAQ_COMMON = (p, t) => [
  {
    q: "¿Necesitan mi contraseña?",
    a: "No. Nunca pedimos claves ni acceso a tu cuenta. Solo necesitamos el enlace o el usuario público para poder hacer la entrega.",
  },
  {
    q: "¿Cuánto se demora la entrega?",
    a: "La entrega comienza de forma automática apenas Flow confirma el pago, normalmente en menos de 10 minutos. El tiempo total depende de la cantidad que compres y aparece indicado en cada pack.",
  },
  {
    q: "¿Es seguro para mi cuenta?",
    a: `Sí. No usamos bots dentro de tu cuenta ni cambiamos nada en ella: la entrega se hace desde fuera, igual que si esas personas te encontraran solas. Tu cuenta de ${p} sigue funcionando con total normalidad.`,
  },
  {
    q: "¿Cómo pago?",
    a: "Con Flow, que acepta Webpay (crédito y débito), transferencia bancaria y Mercado Pago. Los precios están en pesos chilenos e incluyen IVA.",
  },
  {
    q: "¿Y si no llega mi pedido?",
    a: "Escríbenos con el código de tu pedido y lo revisamos. Si el pedido no se entrega, te devolvemos el dinero.",
  },
  {
    q: `¿Puedo comprar ${t.toLowerCase()} para más de una cuenta?`,
    a: "Sí. Haz un pedido por cada cuenta o publicación indicando el enlace correspondiente en cada uno.",
  },
];

/** Frase de la tarjeta del catálogo: una por tipo, para que no se repitan. */
const CARD_LINE = {
  seguidores: () => `Suman a tu cuenta sin que des la clave.`,
  suscriptores: (p) => `De a poco, para que ${p} no lo note raro.`,
  miembros: () => `Para que quien llegue vea movimiento.`,
  likes: () => `Llegan a los minutos y ayudan a que el post circule.`,
  reacciones: () => `Se reparten en la publicación para que se vea activa.`,
  vistas: () => `La métrica que más pesa para que el video siga saliendo.`,
  reproducciones: () => `Escuchas repartidas en varios días.`,
  comentarios: () => `Comentarios en español, escritos por personas.`,
  compartidos: () => `Sacan tu contenido de tu círculo de siempre.`,
  guardados: () => `De las señales que más valora el algoritmo.`,
  historias: () => `Te suben en la barra de historias.`,
  "en-vivo": () => `Espectadores durante todo el stream, no solo al principio.`,
  votos: () => `Votos en la opción que elijas.`,
  trafico: () => `Visitas reales, de distintos países y dispositivos.`,
};

export function buildCopy({ platform, type }) {
  const p = PLATFORM_LABEL[platform] ?? platform;
  const t = TYPE_LABEL[type] ?? type;
  const name = `${t} para ${p}`;
  const slug = `comprar-${type}-${platform}`;

  const intro = (INTRO[type] ?? INTRO.seguidores)(p);
  const bullets = BULLETS[type] ?? BULLETS.seguidores;

  const descriptionHtml = [
    `<p>${intro}</p>`,
    `<h2>Cómo funciona</h2>`,
    `<ol>`,
    `<li>Elige el pack de ${t.toLowerCase()} que necesitas.</li>`,
    `<li>Pega tu ${POST_TYPES.has(type) ? "enlace de la publicación" : "usuario o enlace de perfil"} y tu correo.</li>`,
    `<li>Paga con Webpay, transferencia o Mercado Pago a través de Flow.</li>`,
    `<li>La entrega parte sola y puedes seguir el avance con el código de tu pedido.</li>`,
    `</ol>`,
    `<h2>Qué incluye</h2>`,
    `<ul>${bullets.map((b) => `<li>${b}</li>`).join("")}</ul>`,
    `<h2>Antes de comprar</h2>`,
    `<p>Revisa que tu cuenta esté pública y que el enlace que entregas sea el correcto: una vez enviado el pedido al sistema de entrega no se puede cambiar el destino. Si tienes dudas, escríbenos antes de pagar y te ayudamos.</p>`,
  ].join("\n");

  const seoTitle = `Comprar ${t.toLowerCase()} para ${p} en Chile | TusSeguidores.cl`;
  const seoDescription =
    `Compra ${t.toLowerCase()} para ${p} en pesos chilenos. Entrega automática en minutos, sin contraseña, pago seguro con Webpay o transferencia. Desde $1.990.`.slice(0, 158);
  const seoKeywords = [
    `comprar ${t.toLowerCase()} ${p.toLowerCase()}`,
    `${t.toLowerCase()} ${p.toLowerCase()} chile`,
    `comprar ${t.toLowerCase()} ${p.toLowerCase()} chile`,
    `${t.toLowerCase()} ${p.toLowerCase()} baratos`,
  ].join(", ");

  const linkSet = LINK_FIELD[platform] ?? LINK_FIELD.instagram;
  const link = POST_TYPES.has(type) ? linkSet.post : linkSet.perfil;

  return {
    name,
    slug,
    shortDescription: (CARD_LINE[type] ?? CARD_LINE.seguidores)(p),
    descriptionHtml,
    bullets,
    faq: FAQ_COMMON(p, t),
    seoTitle,
    seoDescription,
    seoKeywords,
    link,
  };
}
