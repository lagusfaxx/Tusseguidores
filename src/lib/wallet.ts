import "server-only";
import { db, all, get } from "./db";
import type { WalletEntry } from "./types";

/**
 * Saldo de los clientes del panel.
 *
 * Regla única: **nadie toca `reseller_users.balance_clp` fuera de este
 * módulo**. Cada peso que entra o sale escribe una línea en `wallet_entries`
 * con el saldo que quedó, y las dos cosas pasan dentro de la misma transacción
 * de SQLite. Así el saldo siempre se puede reconstruir sumando el libro, y un
 * error a mitad de camino no deja plata a medio descontar.
 *
 * Los cobros y los reembolsos además llevan el pedido enganchado, y la base
 * tiene un índice único por (order_id, kind): aunque el código se llame dos
 * veces —un reintento, un doble clic, dos pestañas—, un pedido descuenta una
 * sola vez y se reembolsa una sola vez.
 */

export type MovimientoInput = {
  userId: number;
  kind: "recarga" | "pedido" | "reembolso" | "ajuste";
  /** Positivo suma al saldo, negativo descuenta. */
  amountClp: number;
  orderId?: number | null;
  topupId?: number | null;
  note?: string;
};

export type MovimientoResult =
  | { ok: true; balance: number; entryId: number }
  | { ok: false; error: string; balance: number };

/** ¿El error de SQLite es el índice único que evita cobrar dos veces? */
function esDuplicado(error: unknown): boolean {
  return /UNIQUE constraint failed/i.test((error as Error)?.message ?? "");
}

/**
 * Aplica un movimiento. Es la única puerta de entrada al saldo.
 *
 * Devuelve un resultado en vez de lanzar: quien llama decide qué mostrar.
 */
export function movimiento(input: MovimientoInput): MovimientoResult {
  const monto = Math.round(input.amountClp);
  if (!Number.isFinite(monto) || monto === 0) {
    return { ok: false, error: "Monto inválido.", balance: saldo(input.userId) };
  }

  const aplicar = db.transaction((): MovimientoResult => {
    const usuario = get<{ balance_clp: number; status: string }>(
      "SELECT balance_clp, status FROM reseller_users WHERE id = ?",
      [input.userId],
    );
    if (!usuario) return { ok: false, error: "Cuenta no encontrada.", balance: 0 };

    const nuevo = usuario.balance_clp + monto;
    // Un saldo negativo sería plata regalada: se rechaza aquí dentro, con el
    // saldo ya leído en la misma transacción, no antes de entrar.
    if (nuevo < 0) {
      return {
        ok: false,
        error: "Saldo insuficiente.",
        balance: usuario.balance_clp,
      };
    }

    const info = db
      .prepare(
        `INSERT INTO wallet_entries (user_id, kind, amount_clp, balance_after, order_id, topup_id, note)
         VALUES (?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        input.userId,
        input.kind,
        monto,
        nuevo,
        input.orderId ?? null,
        input.topupId ?? null,
        input.note ?? "",
      );
    db.prepare("UPDATE reseller_users SET balance_clp = ? WHERE id = ?").run(nuevo, input.userId);
    return { ok: true, balance: nuevo, entryId: Number(info.lastInsertRowid) };
  });

  try {
    return aplicar();
  } catch (error) {
    if (esDuplicado(error)) {
      // Ya estaba aplicado: no es un fallo, es la protección haciendo su
      // trabajo. Devolvemos el saldo real para que la pantalla no mienta.
      return { ok: true, balance: saldo(input.userId), entryId: 0 };
    }
    console.error("[wallet]", error);
    return { ok: false, error: "No se pudo mover el saldo.", balance: saldo(input.userId) };
  }
}

export function saldo(userId: number): number {
  return get<{ balance_clp: number }>("SELECT balance_clp FROM reseller_users WHERE id = ?", [userId])
    ?.balance_clp ?? 0;
}

export function movimientos(userId: number, limit = 50, offset = 0): WalletEntry[] {
  return all<WalletEntry>(
    "SELECT * FROM wallet_entries WHERE user_id = ? ORDER BY id DESC LIMIT ? OFFSET ?",
    [userId, limit, offset],
  );
}

export function contarMovimientos(userId: number): number {
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM wallet_entries WHERE user_id = ?", [userId])?.n ?? 0;
}

/**
 * Suma del libro, para comprobar que el espejo no se desvió.
 *
 * Se muestra en la ficha del cliente en el panel de administración: si alguna
 * vez no cuadra con `balance_clp`, se ve al tiro y no hay que salir a buscarlo.
 */
export function saldoSegunLibro(userId: number): number {
  return get<{ v: number }>(
    "SELECT COALESCE(SUM(amount_clp), 0) AS v FROM wallet_entries WHERE user_id = ?",
    [userId],
  )?.v ?? 0;
}

export const ETIQUETA_MOVIMIENTO: Record<string, string> = {
  recarga: "Recarga de saldo",
  pedido: "Pedido",
  reembolso: "Reembolso",
  ajuste: "Ajuste del administrador",
};
