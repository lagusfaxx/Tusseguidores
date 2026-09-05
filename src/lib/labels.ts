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

/**
 * Orden en el que se muestran los tipos de servicio dentro de una red.
 *
 * Sin esto las secciones salían en el orden en que la base devolvía los
 * productos —alfabético por slug, con "Comentarios" y "En vivo" arriba y los
 * seguidores en medio de la página—, que no es el orden en que la gente
 * compra.
 */
export const SERVICE_TYPE_PRIORITY = [
  "seguidores", "likes", "vistas", "reproducciones", "suscriptores", "miembros",
  "comentarios", "historias", "compartidos", "guardados", "reacciones",
  "en-vivo", "trafico", "votos", "resenas", "menciones", "premium",
];

/** Posición del tipo de servicio en el orden de la tienda. */
export function serviceTypeOrder(slug: string): number {
  const index = SERVICE_TYPE_PRIORITY.indexOf(slug);
  return index === -1 ? 999 : index;
}

export function sortServiceTypes<T extends { service_type: string }>(rows: T[]): T[] {
  return [...rows].sort((a, b) => serviceTypeOrder(a.service_type) - serviceTypeOrder(b.service_type));
}
