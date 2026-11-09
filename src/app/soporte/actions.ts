"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { crearTicket, agregarMensaje, ticketConLlave, puedeEscribir } from "@/lib/tickets";
import { notificarConsultaAbierta } from "@/lib/notify";
import { avisarTicket } from "@/lib/ia-tickets";
import { absoluteUrl } from "@/lib/seo";
import { isValidEmail } from "@/lib/utils";

export type SoporteState = { ok?: string; error?: string };

/**
 * Consultas sin pedido: alguien que todavía no compra, o que perdió su código.
 *
 * La tienda no publica correo ni teléfono; toda la atención es por ticket.
 * Como no hay cuenta ni pedido, el ticket se protege con una llave que va en
 * el enlace y que le mandamos por correo.
 */
export async function abrirConsulta(_prev: SoporteState, formData: FormData): Promise<SoporteState> {
  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  if (!isValidEmail(email)) return { error: "Revisa tu correo: ahí te avisamos cuando respondamos." };
  // Trampa para bots: un campo que una persona no ve ni llena.
  if (String(formData.get("web") ?? "")) return { ok: "Listo." };

  const result = crearTicket({
    guestEmail: email,
    subject: String(formData.get("subject") ?? ""),
    body: String(formData.get("body") ?? ""),
    kind: "consulta",
    conLlave: true,
  });
  if (!result.ok) return { error: result.error };

  const ticket = result.ticket;
  const url = absoluteUrl(`/soporte/${ticket.code}?k=${ticket.access_key}`);
  await notificarConsultaAbierta({ to: email, code: ticket.code, subject: ticket.subject, url });
  await avisarTicket(ticket.id,
    `Consulta nueva · ${ticket.code}`,
    `<p><strong>${email}</strong> abrió la consulta ${ticket.code}: ${ticket.subject}</p>` +
      `<p><a href="${absoluteUrl(`/admin/tickets/${ticket.id}`)}">Responder</a></p>`,
    `${email} abrió la consulta ${ticket.code}: ${ticket.subject}`,
  );
  redirect(`/soporte/${ticket.code}?k=${ticket.access_key}&nuevo=1`);
}

export async function responderConsulta(_prev: SoporteState, formData: FormData): Promise<SoporteState> {
  const code = String(formData.get("code") ?? "");
  const key = String(formData.get("k") ?? "");
  const ticket = ticketConLlave(code, key);
  if (!ticket) return { error: "No encontramos esta consulta." };

  const cuerpo = String(formData.get("body") ?? "").trim();
  if (cuerpo.length < 2) return { error: "Escribe tu mensaje." };
  const permiso = puedeEscribir(ticket.id);
  if (!permiso.ok) return { error: permiso.error };

  agregarMensaje(ticket.id, "cliente", cuerpo);
  await avisarTicket(ticket.id,
    `Mensaje nuevo · ${ticket.code}`,
    `<p><strong>${ticket.guest_email}</strong> escribió en la consulta ${ticket.code}.</p>` +
      `<p><a href="${absoluteUrl(`/admin/tickets/${ticket.id}`)}">Responder</a></p>`,
    `${ticket.guest_email} escribió en la consulta ${ticket.code}.`,
  );
  revalidatePath(`/soporte/${ticket.code}`);
  return { ok: "Mensaje enviado." };
}

/** Desde /soporte, quien tiene pedido va directo a su conversación. */
export async function irAMiPedido(formData: FormData) {
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!code) redirect("/soporte?error=1");
  redirect(`/pedido/${encodeURIComponent(code)}#soporte`);
}
