import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { get, run } from "./db";

const COOKIE = "ts_admin";
const SESSION_DAYS = 7;

export type AdminUser = { id: number; email: string; name: string };

/** scrypt con sal aleatoria: no necesitamos dependencias nativas extra. */
export function hashPassword(password: string): string {
  const salt = crypto.randomBytes(16);
  const derived = crypto.scryptSync(password, salt, 64);
  return `scrypt$${salt.toString("hex")}$${derived.toString("hex")}`;
}

export function verifyPassword(password: string, stored: string): boolean {
  const [scheme, saltHex, hashHex] = stored.split("$");
  if (scheme !== "scrypt" || !saltHex || !hashHex) return false;
  const derived = crypto.scryptSync(password, Buffer.from(saltHex, "hex"), 64);
  const expected = Buffer.from(hashHex, "hex");
  return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
}

export function ensureAdminUser() {
  const existing = get<{ n: number }>("SELECT COUNT(*) AS n FROM admin_users");
  if (existing && existing.n > 0) return;
  const email = process.env.ADMIN_EMAIL || "admin@tusseguidores.cl";
  const password = process.env.ADMIN_PASSWORD || "cambiaesta123";
  run("INSERT INTO admin_users (email, password_hash, name) VALUES (?, ?, ?)", [
    email.toLowerCase(),
    hashPassword(password),
    "Administrador",
  ]);
}

export async function login(email: string, password: string): Promise<boolean> {
  ensureAdminUser();
  const user = get<{ id: number; password_hash: string }>(
    "SELECT id, password_hash FROM admin_users WHERE email = ?",
    [email.trim().toLowerCase()],
  );
  if (!user || !verifyPassword(password, user.password_hash)) return false;

  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  run("DELETE FROM admin_sessions WHERE expires_at < datetime('now')");
  run("INSERT INTO admin_sessions (token, user_id, expires_at) VALUES (?, ?, ?)", [
    token,
    user.id,
    expires.toISOString(),
  ]);

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
  return true;
}

export async function logout() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) run("DELETE FROM admin_sessions WHERE token = ?", [token]);
  store.delete(COOKIE);
}

export async function currentUser(): Promise<AdminUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const row = get<AdminUser>(
    `SELECT u.id, u.email, u.name
       FROM admin_sessions s
       JOIN admin_users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now')`,
    [token],
  );
  return row ?? null;
}

export async function requireUser(): Promise<AdminUser> {
  const user = await currentUser();
  if (!user) throw new Error("UNAUTHORIZED");
  return user;
}
