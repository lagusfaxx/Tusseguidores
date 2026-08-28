/** Utilidades pequeñas compartidas por la tienda y el panel. */

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(" ");
}

/** Limpia el HTML que se guarda desde el panel dejando solo etiquetas de texto. */
const ALLOWED_TAGS = /^(p|br|strong|b|em|i|u|ul|ol|li|h2|h3|h4|a|blockquote|span)$/i;

export function sanitizeHtml(input: string): string {
  return input
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|input|link|meta)[\s\S]*?<\s*\/\s*\1\s*>/gi, "")
    .replace(/<\s*(script|style|iframe|object|embed|form|input|link|meta)[^>]*\/?>/gi, "")
    .replace(/<\/?([a-z0-9]+)([^>]*)>/gi, (match, tag: string, attrs: string) => {
      if (!ALLOWED_TAGS.test(tag)) return "";
      if (match.startsWith("</")) return `</${tag.toLowerCase()}>`;
      // Solo dejamos href/title en enlaces, y nunca javascript:
      if (tag.toLowerCase() === "a") {
        const href = attrs.match(/href\s*=\s*("([^"]*)"|'([^']*)')/i);
        const value = (href?.[2] ?? href?.[3] ?? "").trim();
        const safe = /^(https?:|mailto:|\/|#)/i.test(value) ? value : "";
        return safe
          ? `<a href="${escapeAttr(safe)}" rel="nofollow noopener" target="_blank">`
          : "<a>";
      }
      return `<${tag.toLowerCase()}>`;
    });
}

function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Código corto y legible para los pedidos: TS-7K2F9Q */
export function orderCode(): string {
  const alphabet = "ACDEFGHJKLMNPQRSTUVWXYZ23456789";
  let out = "";
  for (let i = 0; i < 6; i++) out += alphabet[Math.floor(Math.random() * alphabet.length)];
  return `TS-${out}`;
}

export function slugify(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 90);
}

/** Normaliza lo que escribe el comprador en el campo de destino. */
export function normalizeTarget(raw: string, platform: string): string {
  const value = raw.trim();
  if (!value) return "";
  if (/^https?:\/\//i.test(value)) return value;
  const user = value.replace(/^@/, "");
  const byPlatform: Record<string, string> = {
    instagram: `https://www.instagram.com/${user}`,
    tiktok: `https://www.tiktok.com/@${user}`,
    twitter: `https://x.com/${user}`,
    threads: `https://www.threads.net/@${user}`,
    twitch: `https://www.twitch.tv/${user}`,
    facebook: `https://www.facebook.com/${user}`,
    youtube: `https://www.youtube.com/@${user}`,
    telegram: `https://t.me/${user}`,
  };
  return byPlatform[platform] ?? value;
}

export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(value.trim());
}

export function formatDateCl(value: string | null | undefined): string {
  if (!value) return "—";
  const iso = value.includes("T") ? value : value.replace(" ", "T") + "Z";
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-CL", {
    dateStyle: "short",
    timeStyle: "short",
    timeZone: "America/Santiago",
  }).format(date);
}
