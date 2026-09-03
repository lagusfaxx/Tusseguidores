/**
 * Definición de los niveles de calidad, sin nada que toque la base de datos.
 *
 * Va aparte de levels.ts porque el editor del panel es un componente de
 * cliente: si importara el módulo que consulta SQLite, better-sqlite3
 * terminaría en el bundle del navegador.
 */

export type LevelId = "economico" | "estandar" | "premium";

export type LevelDef = {
  id: LevelId;
  /** Cómo se llama en la tienda. Va en el nombre del producto y en la ficha. */
  label: string;
  /** Sufijo del enlace: .../comprar-seguidores-instagram-premium */
  slug: string;
  /** Etiqueta de la tarjeta del catálogo. */
  badge: string;
  /** Una línea que explica para quién es. */
  pitch: string;
  /**
   * Multiplicador del piso por 1.000 de Ajustes → Precios.
   *
   * El piso existe para que un servicio que cuesta centavos no se regale, pero
   * aplasta los tres niveles contra el mismo número justo cuando más tienen que
   * notarse. Escalándolo por nivel, la escalera económico → estándar → premium
   * nunca se aplana y sigue dependiendo de un solo control.
   */
  floorFactor: number;
};

export const LEVELS: LevelDef[] = [
  {
    id: "economico",
    label: "Económico",
    slug: "economico",
    badge: "El más barato",
    pitch:
      "Lo más barato que tenemos. Sirve para empujar el número rápido, asumiendo que una parte se puede caer.",
    floorFactor: 1,
  },
  {
    id: "estandar",
    label: "Estándar",
    slug: "estandar",
    badge: "El más elegido",
    pitch: "El equilibrio: buena retención y entrega rápida a un precio que no se dispara.",
    floorFactor: 1.3,
  },
  {
    id: "premium",
    label: "Premium",
    slug: "premium",
    badge: "Máxima calidad",
    pitch:
      "Lo que menos se cae y lo que trae la reposición más larga. Para cuentas que no pueden retroceder.",
    floorFactor: 1.75,
  },
];

const BY_ID = new Map<string, LevelDef>(LEVELS.map((level) => [level.id, level]));

export function levelDef(id: string | null | undefined): LevelDef | null {
  return BY_ID.get(id ?? "") ?? null;
}

export function levelLabel(id: string | null | undefined): string {
  return levelDef(id)?.label ?? "";
}

/** Multiplicador del piso por 1.000 que le toca a un nivel. */
export function levelFloorFactor(id: string | null | undefined): number {
  return levelDef(id)?.floorFactor ?? 1;
}

/** Posición del nivel en la escalera, para ordenar. */
export function levelOrder(id: string | null | undefined): number {
  const index = LEVELS.findIndex((level) => level.id === id);
  return index === -1 ? 99 : index;
}
