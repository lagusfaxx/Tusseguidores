import "server-only";
import { randomBytes } from "node:crypto";
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
  devolucion: "Solicitud de devolución",
};

/**
 * Cuántos mensajes seguidos puede dejar el cliente sin que le contestemos.
 * Más que eso no ayuda a nadie: es la misma pregunta repetida, y cada mensaje
 * nos manda un aviso.
 */
export const MAX_MENSAJES_SIN_RESPUESTA = 3;

/**
 * Mensajes del cliente en un mismo ticket en 24 horas. Con el asistente
 * contestando cada uno, el tope de arriba nunca se alcanza: esto es lo que
 * frena al que escribe sin parar.
 */
export const MAX_MENSAJES_POR_DIA = 8;

/** Tickets abiertos a la vez que puede tener un mayorista sin pedido enganchado. */
const MAX_TICKETS_SUELTOS_ABIERTOS = 2;

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

function llaveNueva(): string {
  return randomBytes(18).toString("base64url");
}

export type CrearTicketInput = {
  /** Mayorista con cuenta. Null en los tickets de la tienda. */
  userId?: number | null;
  /** Correo del pedido, cuando no hay cuenta. */
  guestEmail?: string | null;
  subject: string;
  body: string;
  kind?: "consulta" | "problema" | "reposicion" | "devolucion";
  orderId?: number | null;
  /**
   * Ticket sin pedido ni cuenta (la página /soporte): se protege con una
   * llave que va en el enlace, porque no hay otra cosa que lo identifique.
   */
  conLlave?: boolean;
};

export type CrearTicketResult =
  | {
      ok: true;
      ticket: Ticket;
      /**
       * true si el pedido ya tenía su ticket y el mensaje se sumó a esa
       * conversación en vez de abrir otra.
       */
      existente: boolean;
    }
  | { ok: false; error: string };

/** El ticket de un pedido, abierto o cerrado. Cada pedido tiene uno solo. */
export function ticketDelPedido(orderId: number): Ticket | undefined {
  return get<Ticket>("SELECT * FROM tickets WHERE order_id = ? ORDER BY id LIMIT 1", [orderId]);
}

/**
 * Cuántos mensajes seguidos dejó el cliente desde la última respuesta.
 *
 * @param soloHumanas  cuenta desde la última respuesta del dueño, sin contar
 *                     las del asistente: es la medida de "cuánto insiste".
 */
export function mensajesSinRespuesta(ticketId: number, soloHumanas = false): number {
  const autores = soloHumanas ? "('admin')" : "('admin', 'ia')";
  return (
    get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ticket_messages
        WHERE ticket_id = ? AND author = 'cliente'
          AND id > COALESCE((SELECT MAX(id) FROM ticket_messages
                              WHERE ticket_id = ? AND author IN ${autores}), 0)`,
      [ticketId, ticketId],
    )?.n ?? 0
  );
}

function mensajesDelDia(ticketId: number): number {
  return (
    get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM ticket_messages
        WHERE ticket_id = ? AND author = 'cliente' AND created_at > datetime('now', '-1 day')`,
      [ticketId],
    )?.n ?? 0
  );
}

/** Si el cliente todavía puede escribir en el ticket, o por qué no. */
export function puedeEscribir(ticketId: number): { ok: true } | { ok: false; error: string } {
  if (mensajesDelDia(ticketId) >= MAX_MENSAJES_POR_DIA) {
    return {
      ok: false,
      error:
        "Ya nos escribiste mucho hoy sobre este caso. Una persona del equipo lo está revisando y te responde aquí.",
    };
  }
  if (mensajesSinRespuesta(ticketId) >= MAX_MENSAJES_SIN_RESPUESTA) {
    return {
      ok: false,
      error:
        "Ya nos dejaste varios mensajes y los estamos revisando. Espera nuestra respuesta antes de escribir de nuevo.",
    };
  }
  return { ok: true };
}

/**
 * Abre un ticket.
 *
 * Un pedido tiene un solo ticket. Si ya existe, el mensaje se suma a esa
 * conversación (y si estaba cerrada se reabre) en vez de abrir otra: antes un
 * cliente podía abrir doscientos tickets por un pedido de dos mil pesos.
 */
export function crearTicket(input: CrearTicketInput): CrearTicketResult {
  const subject = input.subject.trim().slice(0, 140);
  const body = input.body.trim().slice(0, 4000);
  if (subject.length < 4) return { ok: false, error: "Escribe un asunto." };
  if (body.length < 5) return { ok: false, error: "Cuéntanos qué pasó." };

  if (!input.userId && !input.guestEmail) {
    return { ok: false, error: "Falta identificar quién abre el ticket." };
  }

  if (input.orderId) {
    const existente = ticketDelPedido(input.orderId);
    if (existente) {
      if (input.kind === "reposicion" && existente.kind === "reposicion" && existente.status !== "cerrado") {
        return { ok: false, error: `Ya pediste la reposición de este pedido (ticket ${existente.code}).` };
      }
      const permiso = puedeEscribir(existente.id);
      if (!permiso.ok) return permiso;
      // Una reposición o una devolución dicen más que "consulta": el tipo se
      // actualiza para que el dueño vea en la lista qué le están pidiendo.
      if (input.kind === "reposicion" || input.kind === "devolucion") {
        run("UPDATE tickets SET kind = ? WHERE id = ?", [input.kind, existente.id]);
      }
      agregarMensaje(existente.id, "cliente", body);
      return { ok: true, ticket: ticketPorId(existente.id)!, existente: true };
    }
  } else if (input.userId) {
    const abiertos =
      get<{ n: number }>(
        "SELECT COUNT(*) AS n FROM tickets WHERE user_id = ? AND order_id IS NULL AND status != 'cerrado'",
        [input.userId],
      )?.n ?? 0;
    if (abiertos >= MAX_TICKETS_SUELTOS_ABIERTOS) {
      return {
        ok: false,
        error: "Ya tienes consultas abiertas. Sigue en una de ellas y te respondemos ahí.",
      };
    }
  } else if (input.guestEmail) {
    const correo = input.guestEmail.trim().toLowerCase();
    const abierto = get<{ code: string }>(
      `SELECT code FROM tickets
        WHERE guest_email = ? AND order_id IS NULL AND user_id IS NULL AND status != 'cerrado'`,
      [correo],
    );
    if (abierto) {
      return {
        ok: false,
        error: `Ya tienes una consulta abierta (${abierto.code}). Te mandamos el enlace por correo: sigue ahí.`,
      };
    }
  }

  const info = run(
    "INSERT INTO tickets (code, user_id, guest_email, order_id, subject, kind, access_key) VALUES (?, ?, ?, ?, ?, ?, ?)",
    [
      codigoLibre(),
      input.userId ?? null,
      input.userId ? null : (input.guestEmail ?? "").trim().toLowerCase(),
      input.orderId ?? null,
      subject,
      input.kind ?? "consulta",
      input.conLlave ? llaveNueva() : null,
    ],
  );
  const ticket = ticketPorId(Number(info.lastInsertRowid))!;
  agregarMensaje(ticket.id, "cliente", body);
  return { ok: true, ticket, existente: false };
}

export function agregarMensaje(
  ticketId: number,
  author: "cliente" | "admin" | "ia",
  body: string,
  /** Solo para "ia": el asistente decide si el ticket queda respondido o sigue abierto. */
  estado?: "abierto" | "respondido",
) {
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
  run(
    `UPDATE tickets SET status = ?, updated_at = datetime('now'),
            escalated_at = CASE WHEN ? = 'admin' THEN NULL ELSE escalated_at END
      WHERE id = ?`,
    [
      author === "admin" ? "respondido" : author === "ia" ? (estado ?? "respondido") : "abierto",
      author,
      ticketId,
    ],
  );
}

/** Ticket de /soporte: se busca por código y llave, nunca solo por código. */
export function ticketConLlave(code: string, key: string): Ticket | undefined {
  if (!key) return undefined;
  return get<Ticket>(
    "SELECT * FROM tickets WHERE code = ? AND access_key = ? AND order_id IS NULL AND user_id IS NULL",
    [code.trim().toUpperCase(), key],
  );
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
      ORDER BY (t.escalated_at IS NOT NULL AND t.status != 'cerrado') DESC, (t.status = 'abierto') DESC, t.updated_at DESC
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

/**
 * Borra tickets con sus mensajes. No se puede deshacer.
 *
 * @param alcance "todos", "cerrados" o "respondidos" (los que no esperan nada
 *                de nosotros: respondidos por el dueño o el asistente).
 */
export function borrarTickets(alcance: "todos" | "cerrados" | "respondidos"): number {
  const where =
    alcance === "cerrados"
      ? "WHERE status = 'cerrado'"
      : alcance === "respondidos"
        ? "WHERE status IN ('cerrado', 'respondido')"
        : "";
  const ids = all<{ id: number }>(`SELECT id FROM tickets ${where}`).map((t) => t.id);
  if (!ids.length) return 0;
  // Los mensajes se borran a mano: el ON DELETE CASCADE depende de que la
  // conexión tenga las llaves foráneas encendidas, y aquí no se apuesta.
  const enLotes = 500;
  for (let i = 0; i < ids.length; i += enLotes) {
    const lote = ids.slice(i, i + enLotes);
    const marcas = lote.map(() => "?").join(",");
    run(`DELETE FROM ticket_messages WHERE ticket_id IN (${marcas})`, lote);
    run(`DELETE FROM tickets WHERE id IN (${marcas})`, lote);
  }
  return ids.length;
}

export function borrarTicket(id: number): void {
  run("DELETE FROM ticket_messages WHERE ticket_id = ?", [id]);
  run("DELETE FROM tickets WHERE id = ?", [id]);
}
