export function dropScore(name: string, refillDays?: number): number;
export function speedScore(name: string, avgMinutes: number | null | undefined): number;
export function overallScore(drop: number, speed: number): number;
export function refillDaysFromName(name: string): number;
export const DROP_WEIGHT: number;
export const SPEED_WEIGHT: number;
export function detectGeo(name: string): string;
export function detectVariant(name: string): string;
export const ROUTABLE_GEOS: string[];
