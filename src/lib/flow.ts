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

const SANDBOX_URL = "https://sandbox.flow.cl/api";
const PROD_URL = "https://www.flow.cl/api";

export class FlowError extends Error {}

function config() {
  const apiKey = process.env.FLOW_API_KEY || getSetting("flow_api_key", "");
  const secretKey = process.env.FLOW_SECRET_KEY || getSetting("flow_secret_key", "");
  const sandbox = process.env.FLOW_SANDBOX
    ? process.env.FLOW_SANDBOX === "1"
    : getBoolSetting("flow_sandbox", true);
  return { apiKey, secretKey, baseUrl: sandbox ? SANDBOX_URL : PROD_URL };
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
  const { apiKey, secretKey, baseUrl } = config();
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
    const message = (data as { message?: string })?.message ?? `Flow respondió ${response.status}`;
    throw new FlowError(message);
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

export const FLOW_STATUS = {
  PENDING: 1,
  PAID: 2,
  REJECTED: 3,
  CANCELED: 4,
} as const;
