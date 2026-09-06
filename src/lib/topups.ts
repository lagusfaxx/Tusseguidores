import "server-only";
import { all, get, run } from "./db";
import { resellerContext } from "./pricing";
import { movimiento } from "./wallet";
import type { Topup } from "./types";

/**
 * Recargas de saldo del panel mayorista.
 *
 * Dos caminos, el mismo final:
 *
 * - **Flow**: el cliente paga en línea y la confirmación de Flow acredita el
 *   saldo sola. Nunca confiamos en el navegador para acreditar: el webhook
 *   consulta el estado a Flow y es idempotente, porque Flow reintenta.
 * - **Transferencia**: la recarga queda esperando a que el dueño vea la plata
 *   en su cuenta y la confirme desde el panel de administración.
 *
 * En los dos casos, acreditar es un solo movimiento en el libro con el
 * `topup_id` enganchado, y la base tiene un índice único sobre esa columna:
 * una recarga acredita una vez y nada más, pase lo que pase.
 */

export type CrearRecargaResult = { ok: true; topup: Topup } | { ok: false; error: string };

export function crearRecarga(input: {
  userId: number;
  amountClp: number;
  method: "flow" | "transferencia";
}): CrearRecargaResult {
  const ctx = resellerContext();
  const monto = Math.round(input.amountClp);
  if (!Number.isFinite(monto) || monto < ctx.minTopupClp) {
    return {
      ok: false,
      error: `La recarga mínima es de ${ctx.minTopupClp.toLocaleString("es-CL")} CLP.`,
    };
  }
  // Flow no acepta montos gigantes y un cero de más no puede terminar en una
  // recarga imposible de cobrar.
  if (monto > 5_000_000) return { ok: false, error: "El máximo por recarga es de 5.000.000 CLP." };

  const info = run(
    "INSERT INTO topups (code, user_id, amount_clp, method) VALUES (?, ?, ?, ?)",
    [codigoLibre(), input.userId, monto, input.method],
  );
  return { ok: true, topup: recargaPorId(Number(info.lastInsertRowid))! };
}

function codigoLibre(): string {
  const alfabeto = "ACDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 12; i++) {
    let out = "";
    for (let j = 0; j < 6; j++) out += alfabeto[Math.floor(Math.random() * alfabeto.length)];
    const code = `SL-${out}`;
    if (!get("SELECT 1 FROM topups WHERE code = ?", [code])) return code;
  }
  return `SL-${Date.now().toString(36).toUpperCase()}`;
}

export function recargaPorId(id: number): Topup | undefined {
  return get<Topup>("SELECT * FROM topups WHERE id = ?", [id]);
}

export function recargaPorCodigo(code: string): Topup | undefined {
  return get<Topup>("SELECT * FROM topups WHERE code = ?", [code.trim().toUpperCase()]);
}

export function recargasDelCliente(userId: number, limit = 20): Topup[] {
  return all<Topup>("SELECT * FROM topups WHERE user_id = ? ORDER BY id DESC LIMIT ?", [userId, limit]);
}

export function guardarTokenFlow(topupId: number, token: string) {
  run("UPDATE topups SET payment_token = ? WHERE id = ?", [token, topupId]);
}

/** El cliente avisa que ya transfirió. No acredita nada: solo avisa. */
export function avisarTransferencia(topupId: number, referencia: string) {
  run(
    `UPDATE topups SET notified_at = datetime('now'), transfer_reference = ?
      WHERE id = ? AND status = 'pending' AND method = 'transferencia'`,
    [referencia.trim().slice(0, 120) || null, topupId],
  );
}

export type AcreditarResult = { ok: true; saldo: number } | { ok: false; error: string };

/**
 * Acredita una recarga. Es idempotente: llamarla dos veces no duplica el saldo.
 */
export function acreditar(topupId: number, referencia: string): AcreditarResult {
  const topup = recargaPorId(topupId);
  if (!topup) return { ok: false, error: "Recarga no encontrada." };
  if (topup.status === "paid") {
    // Flow reintenta la confirmación y el dueño puede apretar dos veces: no es
    // un error, simplemente ya estaba hecho.
    return { ok: true, saldo: saldoDe(topup.user_id) };
  }
  if (topup.status === "rejected") return { ok: false, error: "Esa recarga está rechazada." };

  const result = movimiento({
    userId: topup.user_id,
    kind: "recarga",
    amountClp: topup.amount_clp,
    topupId: topup.id,
    note: `${topup.code} · ${topup.method === "flow" ? "Webpay" : "transferencia"}`,
  });
  if (!result.ok) return { ok: false, error: result.error };

  run(
    `UPDATE topups SET status = 'paid', payment_ref = ?, paid_at = datetime('now') WHERE id = ?`,
    [referencia || null, topupId],
  );
  return { ok: true, saldo: result.balance };
}

export function rechazar(topupId: number, motivo: string) {
  run("UPDATE topups SET status = 'rejected', payment_ref = ? WHERE id = ? AND status = 'pending'", [
    motivo.slice(0, 200) || null,
    topupId,
  ]);
}

function saldoDe(userId: number): number {
  return get<{ balance_clp: number }>("SELECT balance_clp FROM reseller_users WHERE id = ?", [userId])
    ?.balance_clp ?? 0;
}

/** Transferencias esperando confirmación, para el panel de administración. */
export function recargasPorConfirmar(limit = 100) {
  return all<Topup & { user_email: string; user_name: string }>(
    `SELECT t.*, u.email AS user_email, u.name AS user_name
       FROM topups t JOIN reseller_users u ON u.id = t.user_id
      WHERE t.status = 'pending' AND t.method = 'transferencia'
      ORDER BY (t.notified_at IS NULL), t.created_at ASC
      LIMIT ?`,
    [limit],
  );
}

export function contarRecargasPorConfirmar(): number {
  return (
    get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM topups
        WHERE status = 'pending' AND method = 'transferencia' AND notified_at IS NOT NULL`,
    )?.n ?? 0
  );
}

export const ETIQUETA_RECARGA: Record<string, string> = {
  pending: "Esperando pago",
  paid: "Acreditada",
  rejected: "Rechazada",
};
