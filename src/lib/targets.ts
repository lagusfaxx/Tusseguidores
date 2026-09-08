import { POST_TYPES } from "./copy.mjs";

/**
 * A dónde va el pedido: al perfil o a una publicación concreta.
 *
 * El problema que resuelve este archivo: alguien compra 500 me gusta y pega
 * el enlace de su perfil, o directamente su usuario. El pedido salía al
 * proveedor con un destino que no admite me gusta —lo rechaza o lo entrega en
 * cualquier parte— y la plata ya estaba cobrada. Aquí se decide qué necesita
 * cada servicio, se clasifica lo que pegó el cliente y se le dice en el
 * momento, antes de pagar, qué tiene que pegar.
 */

export type DestinoTipo = "perfil" | "post" | "desconocido";

/** ¿Este servicio se pide sobre una publicación en vez de sobre el perfil? */
export function necesitaPublicacion(serviceType: string, orderKind = ""): boolean {
  return orderKind === "custom_comments" || POST_TYPES.has(serviceType);
}

/**
 * Cómo se ve una publicación en cada red.
 *
 * Lo que no calce con ninguno de estos patrones no se rechaza: los
 * acortadores (vm.tiktok.com, fb.watch) y las redes que no están en la lista
 * pasan igual. La regla es no vender un pedido que sabemos que va a fallar,
 * no adivinar por el cliente.
 */
const PATRONES_POST: Record<string, RegExp[]> = {
  instagram: [/\/(p|reel|reels|tv|share)\//i],
  tiktok: [/\/video\//i, /\/photo\//i, /vm\.tiktok\.com\//i, /vt\.tiktok\.com\//i],
  youtube: [/[?&]v=/i, /youtu\.be\//i, /\/shorts\//i, /\/live\//i, /\/watch/i],
  facebook: [/\/posts\//i, /\/videos?\//i, /\/reel\//i, /\/photo/i, /story_fbid=/i, /fb\.watch\//i, /permalink/i],
  twitter: [/\/status(es)?\//i],
  threads: [/\/post\//i],
  telegram: [/t\.me\/(c\/)?[^/?#]+\/\d+/i],
  whatsapp: [/\/channel\/[^/?#]+\/\d+/i],
  spotify: [/\/(track|album|playlist|episode)\//i],
  linkedin: [/\/posts\//i, /\/feed\/update\//i, /activity[-:]/i],
  twitch: [/\/videos?\//i, /\/clip(s)?\//i],
};

/** Enlaces que son claramente un perfil y nada más. */
const PATRONES_PERFIL: Record<string, RegExp[]> = {
  instagram: [/instagram\.com\/[^/?#]+\/?(\?|#|$)/i],
  tiktok: [/tiktok\.com\/@[^/?#]+\/?(\?|#|$)/i],
  youtube: [/youtube\.com\/(@|c\/|channel\/|user\/)[^/?#]+\/?(\?|#|$)/i],
  facebook: [/facebook\.com\/[^/?#]+\/?(\?|#|$)/i],
  twitter: [/(twitter|x)\.com\/[^/?#]+\/?(\?|#|$)/i],
  threads: [/threads\.(net|com)\/@?[^/?#]+\/?(\?|#|$)/i],
  telegram: [/t\.me\/[^/?#]+\/?(\?|#|$)/i],
  spotify: [/\/artist\//i, /\/user\//i],
  linkedin: [/linkedin\.com\/(in|company)\/[^/?#]+\/?(\?|#|$)/i],
  twitch: [/twitch\.tv\/[^/?#]+\/?(\?|#|$)/i],
};

/**
 * Clasifica lo que pegó el cliente. Un usuario suelto ("@micuenta") es
 * siempre un perfil: no existe forma de escribir una publicación así.
 */
export function clasificarDestino(raw: string, platform: string): DestinoTipo {
  const value = raw.trim();
  if (!value) return "desconocido";
  if (!/^https?:\/\//i.test(value)) return "perfil";

  const post = PATRONES_POST[platform];
  if (post?.some((re) => re.test(value))) return "post";
  const perfil = PATRONES_PERFIL[platform];
  if (perfil?.some((re) => re.test(value))) return "perfil";
  return "desconocido";
}

/**
 * Deja el destino como lo espera el proveedor.
 *
 * A diferencia de la versión anterior, un usuario suelto solo se convierte en
 * la URL del perfil cuando el servicio va al perfil. En un servicio de
 * publicación se devuelve tal cual para que la validación lo rechace: antes se
 * transformaba en un enlace de perfil perfectamente válido y el error se
 * descubría en el proveedor, con el pedido ya pagado.
 */
export function normalizarDestino(raw: string, platform: string, necesitaPost = false): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  if (necesitaPost) return value;

  const user = value.replace(/^@/, "");
  const porRed: Record<string, string> = {
    instagram: `https://www.instagram.com/${user}`,
    tiktok: `https://www.tiktok.com/@${user}`,
    twitter: `https://x.com/${user}`,
    threads: `https://www.threads.net/@${user}`,
    twitch: `https://www.twitch.tv/${user}`,
    facebook: `https://www.facebook.com/${user}`,
    youtube: `https://www.youtube.com/@${user}`,
    telegram: `https://t.me/${user}`,
  };
  return porRed[platform] ?? value;
}

/** Cómo se llama la publicación en cada red, para que el aviso no sea genérico. */
const NOMBRE_POST: Record<string, string> = {
  instagram: "de la publicación o del reel",
  tiktok: "del video",
  youtube: "del video o del Short",
  facebook: "de la publicación o del video",
  twitter: "del post",
  threads: "de la publicación",
  telegram: "del mensaje del canal",
  whatsapp: "del mensaje del canal",
  spotify: "de la canción, el álbum o la playlist",
  linkedin: "de la publicación",
  twitch: "del video o del clip",
};

/** Un ejemplo real de enlace de publicación, para mostrarlo en el error. */
const EJEMPLO_POST: Record<string, string> = {
  instagram: "https://www.instagram.com/p/Cxxxxxxxxxx/",
  tiktok: "https://www.tiktok.com/@usuario/video/7300000000000000000",
  youtube: "https://www.youtube.com/watch?v=xxxxxxxxxxx",
  facebook: "https://www.facebook.com/tupagina/posts/123456789",
  twitter: "https://x.com/usuario/status/1700000000000000000",
  threads: "https://www.threads.net/@usuario/post/Cxxxxxxxxxx",
  telegram: "https://t.me/tucanal/45",
  whatsapp: "https://whatsapp.com/channel/xxxxxxxx/123",
  spotify: "https://open.spotify.com/track/xxxxxxxxxxxxxxxxxxxxxx",
  linkedin: "https://www.linkedin.com/posts/xxxxxxxx",
};

export type RevisionDestino = { ok: true; link: string } | { ok: false; error: string };

/**
 * Revisa un destino para un servicio concreto. Devuelve el enlace ya
 * normalizado o el motivo, escrito para el comprador.
 */
export function revisarDestino(
  raw: string,
  platform: string,
  serviceType: string,
  orderKind = "",
): RevisionDestino {
  const value = raw.trim();
  if (!value) return { ok: false, error: "Falta el enlace de destino." };

  const necesitaPost = necesitaPublicacion(serviceType, orderKind);
  const link = normalizarDestino(value, platform, necesitaPost);

  if (!necesitaPost) {
    // Al perfil: lo único que no sirve es un enlace a una publicación, que
    // el proveedor entregaría en el lugar equivocado.
    if (clasificarDestino(link, platform) === "post") {
      return {
        ok: false,
        error:
          "Este servicio va a tu perfil, no a una publicación. Pega el enlace de tu perfil " +
          "o escribe tu usuario.",
      };
    }
    if (!/^https?:\/\//i.test(link) && !/^@?[\w.\-]{2,}$/.test(link)) {
      return { ok: false, error: "Revisa el enlace o el usuario de destino." };
    }
    return { ok: true, link };
  }

  if (!/^https?:\/\//i.test(link)) {
    return {
      ok: false,
      error:
        "Aquí va el enlace de la publicación, no tu usuario: abre la publicación, copia su " +
        "enlace y pégalo.",
    };
  }

  const tipo = clasificarDestino(link, platform);
  if (tipo === "perfil") {
    const nombre = NOMBRE_POST[platform] ?? "de la publicación";
    const ejemplo = EJEMPLO_POST[platform];
    return {
      ok: false,
      error:
        `Ese es el enlace de tu perfil, y este servicio se entrega en una publicación. ` +
        `Abre la publicación, copia su enlace ${nombre} y pégalo aquí` +
        (ejemplo ? ` (algo así como ${ejemplo}).` : "."),
    };
  }
  return { ok: true, link };
}

/**
 * Revisa la lista completa de destinos de un pedido repartido entre varias
 * publicaciones. Devuelve los enlaces normalizados, sin repetidos.
 */
export type RevisionDestinos = { ok: true; links: string[] } | { ok: false; error: string };

export function revisarDestinos(
  raws: string[],
  platform: string,
  serviceType: string,
  orderKind = "",
  maximo = 50,
): RevisionDestinos {
  const limpios = raws.map((r) => r.trim()).filter(Boolean);
  if (!limpios.length) return { ok: false, error: "Falta el enlace de destino." };
  if (limpios.length > maximo) {
    return { ok: false, error: `Puedes repartir el pedido entre ${maximo} publicaciones como máximo.` };
  }

  const links: string[] = [];
  for (const [i, crudo] of limpios.entries()) {
    const revision = revisarDestino(crudo, platform, serviceType, orderKind);
    if (!revision.ok) {
      return {
        ok: false,
        error: limpios.length > 1 ? `Enlace ${i + 1}: ${revision.error}` : revision.error,
      };
    }
    if (links.includes(revision.link)) {
      return { ok: false, error: `El enlace ${i + 1} está repetido. Cada publicación va una sola vez.` };
    }
    links.push(revision.link);
  }
  return { ok: true, links };
}

/** Separa un textarea de enlaces (uno por línea, o separados por coma). */
export function separarDestinos(raw: string): string[] {
  return raw
    .split(/[\r\n,]+/)
    .map((line) => line.trim())
    .filter(Boolean);
}
