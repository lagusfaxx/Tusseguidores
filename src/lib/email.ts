import "server-only";
import { getSetting, getBoolSetting, getSettings } from "./settings";

/**
 * Envío de correos con Resend (https://resend.com).
 *
 * La API es un POST con la clave en el encabezado, así que no hace falta
 * ninguna dependencia: se llama con fetch igual que al proveedor y a Flow.
 *
 * Regla de oro: un correo que no sale nunca puede tumbar una venta. Todo lo de
 * aquí devuelve un resultado en vez de lanzar, y quien lo llama deja
 * constancia en el historial del pedido y sigue adelante.
 */

const API_URL = process.env.RESEND_API_URL || "https://api.resend.com/emails";

export type EmailConfig = {
  apiKey: string;
  /** Remitente completo, tal como lo verá el cliente: Nombre <correo@dominio>. */
  from: string;
  replyTo: string;
  /** Dónde llegan los avisos internos (transferencias, pedidos trabados). */
  admin: string;
  enabled: boolean;
  adminAlerts: boolean;
  /** La clave viene de una variable de entorno y manda sobre el panel. */
  keyFromEnv: boolean;
};

export function emailConfig(): EmailConfig {
  const s = getSettings();
  // Un espacio pegado a la clave da un 401 que no dice nada del problema real.
  const envKey = (process.env.RESEND_API_KEY ?? "").trim();
  const apiKey = envKey || (s.resend_api_key ?? "").trim();
  const remitente = (s.email_from ?? "").trim();
  const nombre = (s.site_name ?? "").trim();

  return {
    apiKey,
    from: remitente ? (remitente.includes("<") ? remitente : `${nombre} <${remitente}>`) : "",
    replyTo: (s.email_reply_to || s.contact_email || "").trim(),
    admin: (s.email_admin || s.contact_email || "").trim(),
    enabled: getBoolSetting("email_enabled", true),
    adminAlerts: getBoolSetting("email_admin_alerts", true),
    keyFromEnv: Boolean(envKey),
  };
}

/** ¿Hay clave y remitente para poder mandar algo? */
export function emailConfigured(): boolean {
  const config = emailConfig();
  return Boolean(config.apiKey && config.from);
}

export type SendEmailInput = {
  to: string;
  subject: string;
  html: string;
  /** Versión en texto plano. Sin ella los filtros de spam castigan el correo. */
  text: string;
  replyTo?: string;
};

export type SendEmailResult =
  | { ok: true; id: string }
  | { ok: false; error: string };

export async function sendEmail(input: SendEmailInput): Promise<SendEmailResult> {
  const config = emailConfig();
  if (!config.enabled) return { ok: false, error: "El envío de correos está desactivado en Ajustes." };
  if (!config.apiKey) return { ok: false, error: "Falta la API key de Resend. Configúrala en /admin/ajustes." };
  if (!config.from) return { ok: false, error: "Falta el remitente de los correos. Configúralo en /admin/ajustes." };
  if (!input.to.trim()) return { ok: false, error: "No hay destinatario." };

  try {
    const response = await fetch(API_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${config.apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: config.from,
        to: [input.to.trim()],
        subject: input.subject,
        html: input.html,
        text: input.text,
        reply_to: input.replyTo || config.replyTo || undefined,
      }),
      // Resend responde en menos de un segundo; si no, no vale la pena esperar
      // con un cliente mirando la pantalla de "procesando".
      signal: AbortSignal.timeout(10_000),
    });

    const payload = (await response.json().catch(() => null)) as
      | { id?: string; message?: string; name?: string }
      | null;

    if (!response.ok) {
      return {
        ok: false,
        error: payload?.message || `Resend respondió ${response.status}.`,
      };
    }
    if (!payload?.id) return { ok: false, error: "Resend no devolvió el identificador del correo." };
    return { ok: true, id: payload.id };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { ok: false, error: `No se pudo contactar a Resend: ${message}` };
  }
}

export type EmailTest = { ok: boolean; message: string };

/** Manda un correo de prueba al destinatario de los avisos internos. */
export async function testEmail(): Promise<EmailTest> {
  const config = emailConfig();
  if (!config.apiKey) return { ok: false, message: "Falta la API key de Resend." };
  if (!config.from) return { ok: false, message: "Falta el remitente de los correos." };
  if (!config.admin) {
    return { ok: false, message: "Falta el correo de avisos (o el correo de contacto de la tienda)." };
  }

  const tienda = getSetting("site_name", "la tienda");
  const result = await sendEmail({
    to: config.admin,
    subject: `Prueba de correo · ${tienda}`,
    html: `<p>Si lees esto, Resend está bien configurado: los correos de los pedidos van a salir.</p>`,
    text: "Si lees esto, Resend está bien configurado: los correos de los pedidos van a salir.",
  });

  return result.ok
    ? { ok: true, message: `Correo de prueba enviado a ${config.admin}.` }
    : { ok: false, message: result.error };
}
