import "server-only";
import crypto from "node:crypto";
import { cookies } from "next/headers";
import { get, run } from "./db";
import { hashPassword, verifyPassword } from "./auth";
import { isValidEmail } from "./utils";
import type { ResellerUser } from "./types";

/**
 * Sesiones del panel SMM.
 *
 * Va aparte de `auth.ts` a propósito: son dos mundos distintos y no queremos
 * que una sesión de cliente pueda confundirse jamás con una de administrador.
 * Cookie distinta, tabla distinta y ninguna función compartida salvo el hash
 * de la contraseña, que es el mismo scrypt.
 */

const COOKIE = "ts_panel";
const SESSION_DAYS = 30;

export type PanelUser = Pick<
  ResellerUser,
  "id" | "email" | "name" | "phone" | "balance_clp" | "discount_percent" | "status"
>;

const CAMPOS = "id, email, name, phone, balance_clp, discount_percent, status";

export type RegistroResult = { ok: true; user: PanelUser } | { ok: false; error: string };

export async function registrar(input: {
  email: string;
  password: string;
  name: string;
  phone?: string;
}): Promise<RegistroResult> {
  const email = input.email.trim().toLowerCase();
  if (!isValidEmail(email)) return { ok: false, error: "Revisa el correo: no parece válido." };
  if (input.password.length < 8) {
    return { ok: false, error: "La contraseña debe tener al menos 8 caracteres." };
  }
  if (get("SELECT 1 FROM reseller_users WHERE email = ?", [email])) {
    return { ok: false, error: "Ya hay una cuenta con ese correo. Entra con tu contraseña." };
  }

  const info = run(
    "INSERT INTO reseller_users (email, password_hash, name, phone) VALUES (?, ?, ?, ?)",
    [email, hashPassword(input.password), input.name.trim().slice(0, 80), input.phone?.trim() || null],
  );
  const user = get<PanelUser>(`SELECT ${CAMPOS} FROM reseller_users WHERE id = ?`, [
    Number(info.lastInsertRowid),
  ])!;
  await abrirSesion(user.id);
  return { ok: true, user };
}

export type LoginResult = { ok: true } | { ok: false; error: string };

export async function entrar(email: string, password: string): Promise<LoginResult> {
  const row = get<{ id: number; password_hash: string; status: string }>(
    "SELECT id, password_hash, status FROM reseller_users WHERE email = ?",
    [email.trim().toLowerCase()],
  );
  // Mismo mensaje para "no existe" y "contraseña mala": no le contamos a nadie
  // qué correos tienen cuenta.
  if (!row || !verifyPassword(password, row.password_hash)) {
    return { ok: false, error: "Correo o contraseña incorrectos." };
  }
  if (row.status === "blocked") {
    return { ok: false, error: "Tu cuenta está suspendida. Escríbenos para revisarla." };
  }
  await abrirSesion(row.id);
  return { ok: true };
}

async function abrirSesion(userId: number) {
  const token = crypto.randomBytes(32).toString("hex");
  const expires = new Date(Date.now() + SESSION_DAYS * 86_400_000);
  run("DELETE FROM reseller_sessions WHERE expires_at < datetime('now')");
  run("INSERT INTO reseller_sessions (token, user_id, expires_at) VALUES (?, ?, ?)", [
    token,
    userId,
    expires.toISOString(),
  ]);
  run("UPDATE reseller_users SET last_login_at = datetime('now') WHERE id = ?", [userId]);

  const store = await cookies();
  store.set(COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires,
  });
}

export async function salir() {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (token) run("DELETE FROM reseller_sessions WHERE token = ?", [token]);
  store.delete(COOKIE);
}

/** El cliente de esta sesión, con el saldo al día. */
export async function panelUser(): Promise<PanelUser | null> {
  const store = await cookies();
  const token = store.get(COOKIE)?.value;
  if (!token) return null;
  const row = get<PanelUser>(
    `SELECT ${CAMPOS.split(", ").map((c) => `u.${c}`).join(", ")}
       FROM reseller_sessions s
       JOIN reseller_users u ON u.id = s.user_id
      WHERE s.token = ? AND s.expires_at > datetime('now')`,
    [token],
  );
  if (!row || row.status === "blocked") return null;
  return row;
}

export async function cambiarPassword(userId: number, actual: string, nueva: string): Promise<LoginResult> {
  const row = get<{ password_hash: string }>(
    "SELECT password_hash FROM reseller_users WHERE id = ?",
    [userId],
  );
  if (!row || !verifyPassword(actual, row.password_hash)) {
    return { ok: false, error: "La contraseña actual no coincide." };
  }
  if (nueva.length < 8) return { ok: false, error: "La nueva contraseña debe tener al menos 8 caracteres." };
  run("UPDATE reseller_users SET password_hash = ? WHERE id = ?", [hashPassword(nueva), userId]);
  return { ok: true };
}
