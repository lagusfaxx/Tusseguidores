import "server-only";
import crypto from "node:crypto";
import { getSetting, getBoolSetting } from "./settings";

/**
 * Integración con Flow.cl (Webpay, débito, transferencia y Mercado Pago
 * en un solo checkout).
 *
 * Firma: se ordenan los parámetros alfabéticamente por nombre, se concatena
 * nombre+valor sin separadores y se firma con HMAC-SHA256 usando la secretKey.
 */

const SANDBOX_URL = process.env.FLOW_SANDBOX_URL || "https://sandbox.flow.cl/api";
const PROD_URL = "https://www.flow.cl/api";

export class FlowError extends Error {
  /** Mensaje crudo de Flow, para el registro y el panel. */
  constructor(message: string, readonly detail?: string) {
    super(message);
    this.name = "FlowError";
  }
}

export type FlowConfig = {
  apiKey: string;
  secretKey: string;
  sandbox: boolean;
  baseUrl: string;
  /**
   * Qué valores vienen de una variable de entorno. Una variable manda sobre lo
   * guardado en el panel, así que hay que decirlo en pantalla: si no, cambias
   * la casilla, no pasa nada y no hay forma de saber por qué.
   */
  forcedByEnv: { apiKey: boolean; secretKey: boolean; sandbox: boolean };
};

export function config(): FlowConfig {
  // Un espacio o un salto de línea pegado junto a la clave hace que Flow
  // responda "apiKey not found", que no dice nada del problema real.
  const envApiKey = (process.env.FLOW_API_KEY ?? "").trim();
  const envSecretKey = (process.env.FLOW_SECRET_KEY ?? "").trim();
  const envSandbox = (process.env.FLOW_SANDBOX ?? "").trim();

  const apiKey = envApiKey || getSetting("flow_api_key", "").trim();
  const secretKey = envSecretKey || getSetting("flow_secret_key", "").trim();
  const sandbox = envSandbox ? envSandbox === "1" : getBoolSetting("flow_sandbox", true);

  return {
    apiKey,
    secretKey,
    sandbox,
    baseUrl: sandbox ? SANDBOX_URL : PROD_URL,
    forcedByEnv: {
      apiKey: Boolean(envApiKey),
      secretKey: Boolean(envSecretKey),
      sandbox: Boolean(envSandbox),
    },
  };
}

/**
 * Traduce los errores de Flow a algo accionable.
 *
 * El más común de lejos es "apiKey not found": las credenciales de
 * sandbox.flow.cl y las de flow.cl son distintas, y usar unas con el otro
 * entorno da exactamente ese mensaje.
 */
export function explainFlowError(raw: string, sandbox: boolean): string {
  const message = raw.toLowerCase();
  const entorno = sandbox ? "pruebas (sandbox.flow.cl)" : "producción (flow.cl)";
  const otro = sandbox ? "producción" : "pruebas";

  if (message.includes("apikey not found") || message.includes("api key not found")) {
    const forzado = config().forcedByEnv.sandbox
      ? " Ojo: el entorno está fijado por la variable de entorno FLOW_SANDBOX, así que la casilla del panel no lo cambia; hay que editarla en el servidor."
      : "";
    return `Flow no reconoce la API key en el entorno de ${entorno}. Las credenciales de pruebas y las de producción son distintas: revisa que la key sea la del entorno correcto, o cambia el modo de pruebas en Ajustes si esa key es de ${otro}.${forzado}`;
  }
  if (message.includes("invalid signature") || message.includes("firma")) {
    return `La secret key de Flow no corresponde a la API key configurada (entorno de ${entorno}). Copia las dos del mismo lugar.`;
  }
  if (message.includes("amount")) {
    return "Flow rechazó el monto del pedido. Revisa el precio mínimo en Ajustes.";
  }
  if (message.includes("commerceorder")) {
    return "Flow rechazó el número de pedido porque ya existía. Vuelve a intentar la compra.";
  }
  return raw;
}

export function flowConfigured(): boolean {
  const { apiKey, secretKey } = config();
  return Boolean(apiKey && secretKey);
}

function sign(params: Record<string, string>, secretKey: string): string {
  const toSign = Object.keys(params)
    .sort()
    .map((key) => key + params[key])
    .join("");
  return crypto.createHmac("sha256", secretKey).update(toSign).digest("hex");
}

async function request<T>(endpoint: string, params: Record<string, string>, method: "GET" | "POST"): Promise<T> {
  const { apiKey, secretKey, baseUrl, sandbox } = config();
  if (!apiKey || !secretKey) throw new FlowError("Flow no está configurado. Agrega la API key y la secret key en /admin/ajustes.");

  const payload = { ...params, apiKey };
  const signed = { ...payload, s: sign(payload, secretKey) };
  const url = `${baseUrl}${endpoint}`;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 20_000);
  let response: Response;
  try {
    if (method === "GET") {
      response = await fetch(`${url}?${new URLSearchParams(signed)}`, { cache: "no-store", signal: controller.signal });
    } else {
      response = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams(signed),
        cache: "no-store",
        signal: controller.signal,
      });
    }
  } catch {
    throw new FlowError("No se pudo conectar con Flow.");
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  let data: unknown;
  try {
    data = JSON.parse(text);
  } catch {
    throw new FlowError(`Respuesta inesperada de Flow (${response.status}).`);
  }
  if (!response.ok) {
    const raw = (data as { message?: string })?.message ?? `Flow respondió ${response.status}`;
    throw new FlowError(explainFlowError(raw, sandbox), raw);
  }
  return data as T;
}

export type FlowPayment = { token: string; url: string; flowOrder: number };

export async function createPayment(input: {
  commerceOrder: string;
  subject: string;
  amount: number;
  email: string;
  urlConfirmation: string;
  urlReturn: string;
}): Promise<FlowPayment> {
  return request<FlowPayment>(
    "/payment/create",
    {
      commerceOrder: input.commerceOrder,
      subject: input.subject.slice(0, 250),
      currency: "CLP",
      amount: String(Math.round(input.amount)),
      email: input.email,
      urlConfirmation: input.urlConfirmation,
      urlReturn: input.urlReturn,
    },
    "POST",
  );
}

export type FlowStatus = {
  flowOrder: number;
  commerceOrder: string;
  status: number; // 1 pendiente, 2 pagada, 3 rechazada, 4 anulada
  amount: number;
  payer?: string;
  paymentData?: { date?: string; media?: string; amount?: string };
};

export async function getPaymentStatus(token: string): Promise<FlowStatus> {
  return request<FlowStatus>("/payment/getStatus", { token }, "GET");
}

/** URL a la que hay que enviar al comprador. */
export function checkoutUrl(payment: FlowPayment): string {
  return `${payment.url}?token=${payment.token}`;
}

export type FlowTest =
  | { ok: true; sandbox: boolean; message: string }
  | { ok: false; sandbox: boolean; message: string; detail?: string };

/**
 * Comprueba las credenciales sin cobrar nada.
 *
 * Flow valida la API key antes que el token, así que preguntamos por el estado
 * de un token inventado: si contesta que el token no existe, las credenciales
 * están bien; si contesta que no encuentra la apiKey, están mal.
 */
export async function testCredentials(): Promise<FlowTest> {
  const { apiKey, secretKey, sandbox } = config();
  if (!apiKey || !secretKey) {
    return { ok: false, sandbox, message: "Falta la API key o la secret key de Flow." };
  }

  try {
    await getPaymentStatus("prueba-de-credenciales-tusseguidores");
    return {
      ok: true,
      sandbox,
      message: `Credenciales correctas en el entorno de ${sandbox ? "pruebas" : "producción"}.`,
    };
  } catch (error) {
    const detail = error instanceof FlowError ? error.detail ?? error.message : String(error);
    const low = detail.toLowerCase();
    // Que no encuentre el token es justo lo que esperamos: la key sí sirvió.
    if (low.includes("token") || low.includes("not found the payment") || low.includes("payment not found")) {
      return {
        ok: true,
        sandbox,
        message: `Credenciales correctas en el entorno de ${sandbox ? "pruebas" : "producción"}.`,
      };
    }
    return {
      ok: false,
      sandbox,
      message: error instanceof FlowError ? error.message : "No se pudo hablar con Flow.",
      detail,
    };
  }
}

export const FLOW_STATUS = {
  PENDING: 1,
  PAID: 2,
  REJECTED: 3,
  CANCELED: 4,
} as const;
