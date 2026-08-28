import { PLATFORMS, SERVICE_TYPES } from "./taxonomy.mjs";

const platformBySlug = new Map(PLATFORMS.map((p) => [p.slug, p]));
const typeBySlug = new Map(SERVICE_TYPES.map((t) => [t.slug, t]));

export function platformLabel(slug: string): string {
  return platformBySlug.get(slug)?.label ?? "Otros";
}

export function platformColor(slug: string): string {
  return platformBySlug.get(slug)?.color ?? "#7c3aed";
}

export function serviceTypeLabel(slug: string): string {
  return typeBySlug.get(slug)?.label ?? "Servicios";
}

export const PLATFORM_OPTIONS = PLATFORMS.map((p) => ({ slug: p.slug, label: p.label, color: p.color }));
export const SERVICE_TYPE_OPTIONS = SERVICE_TYPES.map((t) => ({ slug: t.slug, label: t.label }));

/** Orden en el que se muestran las redes en la portada y el menú. */
export const PLATFORM_PRIORITY = [
  "instagram", "tiktok", "youtube", "facebook", "twitter", "telegram",
  "whatsapp", "spotify", "twitch", "kick", "threads", "linkedin",
  "discord", "snapchat", "pinterest", "soundcloud",
];

export function sortPlatforms<T extends { platform: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => {
    const ia = PLATFORM_PRIORITY.indexOf(a.platform);
    const ib = PLATFORM_PRIORITY.indexOf(b.platform);
    return (ia === -1 ? 999 : ia) - (ib === -1 ? 999 : ib);
  });
}
