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
  return database;
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
