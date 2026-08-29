import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";
import {
  dropScore, speedScore, refillDaysFromName, detectGeo, detectVariant, detectOrderKind,
} from "./quality.mjs";

export const DATA_DIR = process.env.DATA_DIR
  ? path.resolve(process.env.DATA_DIR)
  : path.join(process.cwd(), "data");

export const UPLOADS_DIR = path.join(DATA_DIR, "uploads");

const DB_PATH = process.env.DATABASE_PATH
  ? path.resolve(process.env.DATABASE_PATH)
  : path.join(DATA_DIR, "tusseguidores.db");

declare global {
  // Next recarga módulos en dev; mantenemos una sola conexión.
  var __tsDb: Database.Database | undefined;
}

function open(): Database.Database {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  const database = new Database(DB_PATH);
  database.pragma("journal_mode = WAL");
  database.pragma("foreign_keys = ON");
  database.pragma("synchronous = NORMAL");
  const schemaPath = path.join(process.cwd(), "src", "lib", "schema.sql");
  const schema = fs.existsSync(schemaPath)
    ? fs.readFileSync(schemaPath, "utf8")
    : fs.readFileSync(path.join(process.cwd(), "schema.sql"), "utf8");
  database.exec(schema);
  migrate(database);
  return database;
}

/**
 * schema.sql solo crea tablas que no existan, así que las columnas nuevas hay
 * que agregarlas aparte para no perder la base de datos de un sitio ya en
 * producción. ALTER TABLE ADD COLUMN en SQLite es instantáneo.
 */
function migrate(database: Database.Database) {
  const columns = (table: string) =>
    new Set(
      (database.pragma(`table_info(${table})`) as { name: string }[]).map((row) => row.name),
    );

  const additions: [string, string, string][] = [
    ["provider_services", "refill_days", "INTEGER NOT NULL DEFAULT 0"],
    ["provider_services", "drop_score", "INTEGER NOT NULL DEFAULT 50"],
    ["provider_services", "speed_score", "INTEGER NOT NULL DEFAULT 50"],
    ["provider_services", "geo", "TEXT NOT NULL DEFAULT 'global'"],
    ["provider_services", "variant", "TEXT NOT NULL DEFAULT ''"],
    ["provider_services", "order_kind", "TEXT NOT NULL DEFAULT 'default'"],
    ["orders", "comments", "TEXT"],
    ["orders", "transfer_notified_at", "TEXT"],
    ["orders", "transfer_reference", "TEXT"],
    ["products", "auto_select", "INTEGER NOT NULL DEFAULT 1"],
    ["products", "max_cost_ratio", "REAL NOT NULL DEFAULT 1.35"],
    ["orders", "reference_service_id", "INTEGER"],
  ];

  const added: string[] = [];
  for (const [table, column, definition] of additions) {
    if (!columns(table).has(column)) {
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
      added.push(`${table}.${column}`);
    }
  }

  // Las columnas nuevas quedan con su valor por defecto, que para los puntajes
  // de calidad sería mentira (todo 50/50, todo "default"). Las recalculamos a
  // partir del nombre del servicio, que es de donde salen igual.
  const quality = [
    "provider_services.refill_days", "provider_services.drop_score",
    "provider_services.speed_score", "provider_services.geo",
    "provider_services.variant", "provider_services.order_kind",
  ];
  if (added.some((column) => quality.includes(column))) {
    rescoreServices(database);
  }
}

/** Recalcula los puntajes y las clasificaciones de todos los servicios. */
export function rescoreServices(database: Database.Database = db): number {
  const rows = database
    .prepare("SELECT service_id, clean_name, name, service_type, avg_minutes, refill FROM provider_services")
    .all() as {
      service_id: number; clean_name: string; name: string;
      service_type: string; avg_minutes: number | null; refill: number;
    }[];

  const update = database.prepare(
    `UPDATE provider_services
        SET refill_days = ?, drop_score = ?, speed_score = ?, geo = ?, variant = ?, order_kind = ?
      WHERE service_id = ?`,
  );

  const apply = database.transaction(() => {
    for (const row of rows) {
      const name = row.clean_name || row.name || "";
      const days = refillDaysFromName(name);
      update.run(
        days,
        dropScore(name, days || (row.refill ? 30 : 0)),
        speedScore(name, row.avg_minutes),
        detectGeo(name),
        detectVariant(name),
        detectOrderKind(name, row.service_type),
        row.service_id,
      );
    }
  });
  apply();
  return rows.length;
}

export const db: Database.Database = globalThis.__tsDb ?? open();
if (process.env.NODE_ENV !== "production") globalThis.__tsDb = db;

export function all<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T[] {
  return db.prepare(sql).all(...(params as never[])) as T[];
}

export function get<T = Record<string, unknown>>(sql: string, params: unknown[] = []): T | undefined {
  return db.prepare(sql).get(...(params as never[])) as T | undefined;
}

export function run(sql: string, params: unknown[] = []) {
  return db.prepare(sql).run(...(params as never[]));
}
