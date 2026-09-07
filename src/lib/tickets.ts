import "server-only";
import { all, get, run } from "./db";
import type { Ticket, TicketMessage } from "./types";

/**
 * Tickets de soporte.
 *
 * Los abre un mayorista desde su panel o un cliente de la tienda desde el
 * seguimiento de su pedido. En el segundo caso no hay cuenta: el ticket queda
 * colgado del pedido y el código del pedido es la llave para verlo, igual que
 * para ver el pedido mismo.
 *
 * Una solicitud de reposición es un ticket con `kind = 'reposicion'` y el
 * pedido enganchado, en vez de una tabla aparte: el dueño contesta, gestiona
 * la reposición desde la misma pantalla y cierra. Un solo lugar donde mirar es
 * lo que hace que nada se quede sin respuesta.
 */

export const ETIQUETA_TICKET: Record<string, string> = {
  abierto: "Abierto",
  respondido: "Respondido",
  cerrado: "Cerrado",
};

export const TIPO_TICKET: Record<string, string> = {
  consulta: "Consulta",
  problema: "Problema con un pedido",
  reposicion: "Solicitud de reposición",
};

function codigoLibre(): string {
  const alfabeto = "ACDEFGHJKLMNPQRSTUVWXYZ23456789";
  for (let i = 0; i < 12; i++) {
    let out = "";
    for (let j = 0; j < 5; j++) out += alfabeto[Math.floor(Math.random() * alfabeto.length)];
    const code = `TK-${out}`;
    if (!get("SELECT 1 FROM tickets WHERE code = ?", [code])) return code;
  }
  return `TK-${Date.now().toString(36).toUpperCase()}`;
}

export type CrearTicketInput = {
  /** Mayorista con cuenta. Null en los tickets de la tienda. */
  userId?: number | null;
  /** Correo del pedido, cuando no hay cuenta. */
  guestEmail?: string | null;
  subject: string;
  body: string;
  kind?: "consulta" | "problema" | "reposicion";
  orderId?: number | null;
};

export type CrearTicketResult = { ok: true; ticket: Ticket } | { ok: false; error: string };

export function crearTicket(input: CrearTicketInput): CrearTicketResult {
  const subject = input.subject.trim().slice(0, 140);
  const body = input.body.trim().slice(0, 4000);
  if (subject.length < 4) return { ok: false, error: "Escribe un asunto." };
  if (body.length < 5) return { ok: false, error: "Cuéntanos qué pasó." };

  // Un pedido solo puede tener una solicitud de reposición viva: si no, tres
  // clics seguidos abren tres tickets iguales.
  if (input.kind === "reposicion" && input.orderId) {
    const abierto = get<{ code: string }>(
      `SELECT code FROM tickets
        WHERE order_id = ? AND kind = 'reposicion' AND status != 'cerrado'`,
      [input.orderId],
    );
    if (abierto) {
      return { ok: false, error: `Ya pediste la reposición de este pedido (ticket ${abierto.code}).` };
    }
  }

  if (!input.userId && !input.guestEmail) {
    return { ok: false, error: "Falta identificar quién abre el ticket." };
  }

  const info = run(
    "INSERT INTO tickets (code, user_id, guest_email, order_id, subject, kind) VALUES (?, ?, ?, ?, ?, ?)",
    [
      codigoLibre(),
      input.userId ?? null,
      input.userId ? null : (input.guestEmail ?? "").trim().toLowerCase(),
      input.orderId ?? null,
      subject,
      input.kind ?? "consulta",
    ],
  );
  const ticket = ticketPorId(Number(info.lastInsertRowid))!;
  agregarMensaje(ticket.id, "cliente", body);
  return { ok: true, ticket };
}

export function agregarMensaje(ticketId: number, author: "cliente" | "admin", body: string) {
  const texto = body.trim().slice(0, 4000);
  if (!texto) return;
  run("INSERT INTO ticket_messages (ticket_id, author, body) VALUES (?, ?, ?)", [
    ticketId,
    author,
    texto,
  ]);
  // Quien escribe define el estado: si contesta el dueño queda "respondido",
  // si escribe el cliente vuelve a "abierto" y reaparece en la lista de
  // pendientes del administrador.
  run("UPDATE tickets SET status = ?, updated_at = datetime('now') WHERE id = ?", [
    author === "admin" ? "respondido" : "abierto",
    ticketId,
  ]);
}

export function cerrarTicket(ticketId: number) {
  run("UPDATE tickets SET status = 'cerrado', updated_at = datetime('now') WHERE id = ?", [ticketId]);
}

export function reabrirTicket(ticketId: number) {
  run("UPDATE tickets SET status = 'abierto', updated_at = datetime('now') WHERE id = ?", [ticketId]);
}

export function ticketPorId(id: number): Ticket | undefined {
  return get<Ticket>("SELECT * FROM tickets WHERE id = ?", [id]);
}

export function ticketDelCliente(userId: number, code: string): Ticket | undefined {
  return get<Ticket>("SELECT * FROM tickets WHERE code = ? AND user_id = ?", [
    code.trim().toUpperCase(),
    userId,
  ]);
}

export function mensajesDeTicket(ticketId: number): TicketMessage[] {
  return all<TicketMessage>(
    "SELECT * FROM ticket_messages WHERE ticket_id = ? ORDER BY id",
    [ticketId],
  );
}

export function ticketsDelCliente(userId: number, limit = 50): Ticket[] {
  return all<Ticket>(
    "SELECT * FROM tickets WHERE user_id = ? ORDER BY updated_at DESC LIMIT ?",
    [userId, limit],
  );
}

export type TicketConCliente = Ticket & {
  user_email: string | null;
  user_name: string | null;
  order_code: string | null;
  mensajes: number;
  /** Correo con el que contestarle, tenga cuenta o no. */
  contacto: string;
};

export function ticketsParaAdmin(estado = "abiertos", limit = 100): TicketConCliente[] {
  const where =
    estado === "todos"
      ? ""
      : estado === "cerrados"
        ? "WHERE t.status = 'cerrado'"
        : "WHERE t.status != 'cerrado'";
  return all<TicketConCliente>(
    `SELECT t.*, u.email AS user_email, u.name AS user_name, o.code AS order_code,
            COALESCE(u.email, t.guest_email, o.email, '') AS contacto,
            (SELECT COUNT(*) FROM ticket_messages m WHERE m.ticket_id = t.id) AS mensajes
       FROM tickets t
       LEFT JOIN reseller_users u ON u.id = t.user_id
       LEFT JOIN orders o ON o.id = t.order_id
       ${where}
      ORDER BY (t.status = 'abierto') DESC, t.updated_at DESC
      LIMIT ?`,
    [limit],
  );
}

export function contarTicketsAbiertos(): number {
  return get<{ n: number }>("SELECT COUNT(*) AS n FROM tickets WHERE status = 'abierto'")?.n ?? 0;
}

/** Tickets de un pedido de la tienda, para mostrarlos en su seguimiento. */
export function ticketsDePedido(orderId: number): Ticket[] {
  return all<Ticket>(
    "SELECT * FROM tickets WHERE order_id = ? ORDER BY id DESC",
    [orderId],
  );
}

/** Un ticket del pedido, comprobando que de verdad sea de ese pedido. */
export function ticketDePedido(orderId: number, code: string): Ticket | undefined {
  return get<Ticket>("SELECT * FROM tickets WHERE code = ? AND order_id = ?", [
    code.trim().toUpperCase(),
    orderId,
  ]);
}

/** Con quién hay que hablar en este ticket. */
export function contactoDeTicket(ticket: Ticket): string {
  if (ticket.user_id) {
    return (
      get<{ email: string }>("SELECT email FROM reseller_users WHERE id = ?", [ticket.user_id])
        ?.email ?? ""
    );
  }
  if (ticket.guest_email) return ticket.guest_email;
  if (ticket.order_id) {
    return get<{ email: string }>("SELECT email FROM orders WHERE id = ?", [ticket.order_id])?.email ?? "";
  }
  return "";
}
