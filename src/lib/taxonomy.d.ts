export type PlatformDef = { slug: string; label: string; match: RegExp[]; color: string };
export type ServiceTypeDef = { slug: string; label: string; match: RegExp[] };

export const PLATFORMS: PlatformDef[];
export const SERVICE_TYPES: ServiceTypeDef[];
export function normalizeText(input: string | null | undefined): string;
export function detectPlatform(name: string, category?: string): string;
export function detectServiceType(name: string, category?: string): string;
export function slugify(input: string): string;
