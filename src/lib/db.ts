import Database from "better-sqlite3";
import fs from "node:fs";
import path from "node:path";

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
    ["products", "auto_select", "INTEGER NOT NULL DEFAULT 1"],
    ["products", "max_cost_ratio", "REAL NOT NULL DEFAULT 1.35"],
    ["orders", "reference_service_id", "INTEGER"],
  ];

  for (const [table, column, definition] of additions) {
    if (!columns(table).has(column)) {
      database.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
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
