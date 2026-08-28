/**
 * Clasificación de los servicios del proveedor: red social y tipo de servicio.
 * Se ejecuta al importar; el resultado queda guardado en columnas de la base
 * de datos para que la tienda no tenga que recalcular nada en cada request.
 */

export const PLATFORMS = [
  { slug: "instagram", label: "Instagram", match: [/instagram/i, /\bIG\b/i], color: "#E1306C" },
  { slug: "tiktok", label: "TikTok", match: [/tik\s*tok/i], color: "#00F2EA" },
  { slug: "youtube", label: "YouTube", match: [/you\s*tube/i, /\bYT\b/], color: "#FF0000" },
  { slug: "facebook", label: "Facebook", match: [/facebook/i, /\bFB\b/i], color: "#1877F2" },
  { slug: "telegram", label: "Telegram", match: [/telegram/i], color: "#229ED9" },
  { slug: "whatsapp", label: "WhatsApp", match: [/whats\s*app/i], color: "#25D366" },
  { slug: "twitter", label: "X (Twitter)", match: [/twitter/i, /^X\b/, /\bX\.com/i, /\bX \|/], color: "#0F1419" },
  { slug: "spotify", label: "Spotify", match: [/spotify/i], color: "#1DB954" },
  { slug: "twitch", label: "Twitch", match: [/twitch/i], color: "#9146FF" },
  { slug: "kick", label: "Kick", match: [/\bkick\b/i], color: "#53FC18" },
  { slug: "linkedin", label: "LinkedIn", match: [/linked\s*in/i], color: "#0A66C2" },
  { slug: "discord", label: "Discord", match: [/discord/i], color: "#5865F2" },
  { slug: "threads", label: "Threads", match: [/threads/i], color: "#000000" },
  { slug: "snapchat", label: "Snapchat", match: [/snap\s*chat/i], color: "#FFFC00" },
  { slug: "pinterest", label: "Pinterest", match: [/pinterest/i], color: "#BD081C" },
  { slug: "soundcloud", label: "SoundCloud", match: [/sound\s*cloud/i], color: "#FF5500" },
  { slug: "audiomack", label: "Audiomack", match: [/audiomack/i], color: "#FFA200" },
  { slug: "deezer", label: "Deezer", match: [/deezer/i], color: "#A238FF" },
  { slug: "apple-music", label: "Apple Music", match: [/apple\s*music/i], color: "#FA243C" },
  { slug: "vk", label: "VK", match: [/\bVK\b/i, /vk\.com/i], color: "#0077FF" },
  { slug: "kwai", label: "Kwai", match: [/kwai/i], color: "#FF6600" },
  { slug: "likee", label: "Likee", match: [/likee/i], color: "#00D6C9" },
  { slug: "rutube", label: "Rutube", match: [/rutube/i], color: "#EF3E6D" },
  { slug: "vimeo", label: "Vimeo", match: [/vimeo/i], color: "#1AB7EA" },
  { slug: "reddit", label: "Reddit", match: [/reddit/i], color: "#FF4500" },
  { slug: "quora", label: "Quora", match: [/quora/i], color: "#B92B27" },
  { slug: "google", label: "Google", match: [/google/i], color: "#4285F4" },
  { slug: "trustpilot", label: "Trustpilot", match: [/trustpilot/i], color: "#00B67A" },
  { slug: "shazam", label: "Shazam", match: [/shazam/i], color: "#0088FF" },
  { slug: "tumblr", label: "Tumblr", match: [/tumblr/i], color: "#36465D" },
  { slug: "dribbble", label: "Dribbble", match: [/dribbb?le/i], color: "#EA4C89" },
  { slug: "web", label: "Tráfico web", match: [/website/i, /web\s*traffic/i, /\bSEO\b/i], color: "#64748B" },
];

export const SERVICE_TYPES = [
  { slug: "seguidores", label: "Seguidores", match: [/followers?/i, /\bsubs\b/i] },
  { slug: "suscriptores", label: "Suscriptores", match: [/subscribers?/i] },
  { slug: "miembros", label: "Miembros", match: [/members?/i] },
  { slug: "reacciones", label: "Reacciones", match: [/reactions?/i, /emoticons?/i] },
  { slug: "likes", label: "Me gusta", match: [/likes?/i, /hearts?/i, /favou?rites?/i] },
  { slug: "vistas", label: "Visualizaciones", match: [/views?/i, /impressions?/i] },
  { slug: "reproducciones", label: "Reproducciones", match: [/plays?/i, /streams?/i, /listens?/i] },
  { slug: "comentarios", label: "Comentarios", match: [/comments?/i, /replies/i] },
  { slug: "compartidos", label: "Compartidos", match: [/shares?/i, /reposts?/i, /retweets?/i, /re-?posts?/i] },
  { slug: "guardados", label: "Guardados", match: [/saves?/i, /bookmarks?/i] },
  { slug: "historias", label: "Historias", match: [/stor(y|ies)/i] },
  { slug: "en-vivo", label: "En vivo", match: [/live\s*stream/i, /\blive\b/i] },
  { slug: "votos", label: "Votos", match: [/votes?/i, /polls?/i] },
  { slug: "resenas", label: "Reseñas", match: [/reviews?/i, /ratings?/i] },
  { slug: "menciones", label: "Menciones", match: [/mentions?/i] },
  { slug: "premium", label: "Premium", match: [/premium/i] },
  { slug: "trafico", label: "Tráfico", match: [/traffic/i, /visitors?/i] },
];

/** Deja el texto sin emojis ni tipografías Unicode decorativas. */
export function normalizeText(input) {
  if (!input) return "";
  return String(input)
    // Matemáticas bold/italic/sans (𝐒𝐮𝐩𝐞𝐫𝐟𝐚𝐬𝐭, 𝑩𝒆𝒔𝒕...) -> ASCII
    .replace(/[\u{1D400}-\u{1D7FF}]/gu, (ch) => {
      const cp = ch.codePointAt(0);
      const blocks = [
        [0x1d400, 0x41], [0x1d41a, 0x61], [0x1d434, 0x41], [0x1d44e, 0x61],
        [0x1d468, 0x41], [0x1d482, 0x61], [0x1d49c, 0x41], [0x1d4b6, 0x61],
        [0x1d504, 0x41], [0x1d51e, 0x61], [0x1d5a0, 0x41], [0x1d5ba, 0x61],
        [0x1d5d4, 0x41], [0x1d5ee, 0x61], [0x1d608, 0x41], [0x1d622, 0x61],
        [0x1d63c, 0x41], [0x1d656, 0x61], [0x1d670, 0x41], [0x1d68a, 0x61],
        [0x1d6a8, 0x41], [0x1d7ce, 0x30], [0x1d7d8, 0x30], [0x1d7e2, 0x30],
        [0x1d7ec, 0x30], [0x1d7f6, 0x30],
      ];
      for (const [start, base] of blocks) {
        const len = base === 0x30 ? 10 : 26;
        if (cp >= start && cp < start + len) return String.fromCharCode(base + (cp - start));
      }
      return "";
    })
    // Superíndices/pequeñas capitales usadas como adorno (ᴺᴱᵂ, ɴᴇᴡ, ᴜᴘᴅᴀᴛᴇᴅ)
    .replace(/[ᴀ-ᵿᶀ-ᶿ⁰-₟]/gu, "")
    // Emojis, banderas, símbolos
    .replace(/[\u{1F000}-\u{1FAFF}\u{2190}-\u{27BF}\u{2B00}-\u{2BFF}\u{FE00}-\u{FE0F}\u{200D}\u{E0000}-\u{E007F}]/gu, "")
    .replace(/[♻️⛔🔥]/gu, "")
    .replace(/​| /g, " ")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function firstMatch(list, ...haystacks) {
  for (const entry of list) {
    for (const hay of haystacks) {
      if (!hay) continue;
      if (entry.match.some((re) => re.test(hay))) return entry;
    }
  }
  return null;
}

export function detectPlatform(name, category) {
  const n = normalizeText(name);
  const c = normalizeText(category);
  return firstMatch(PLATFORMS, n, c)?.slug ?? "otros";
}

export function detectServiceType(name, category) {
  const n = normalizeText(name);
  const c = normalizeText(category);
  return firstMatch(SERVICE_TYPES, n, c)?.slug ?? "otros";
}

export function slugify(input) {
  return normalizeText(input)
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}
