import "server-only";
import { getSetting } from "./settings";

/**
 * Cliente de la API v2 de honestsmm (mismo protocolo que la mayoría de los
 * paneles SMM: POST application/x-www-form-urlencoded, respuesta JSON).
 */

export type ProviderServiceRow = {
  service: number | string;
  name: string;
  type: string;
  category: string;
  rate: string | number;
  min: string | number;
  max: string | number;
  refill?: boolean;
  cancel?: boolean;
};

export type AddOrderInput = {
  service: number;
  link: string;
  quantity?: number;
  runs?: number;
  interval?: number;
  comments?: string;
  username?: string;
};

export type StatusResponse = {
  charge?: string;
  start_count?: string;
  status?: string;
  remains?: string;
  currency?: string;
  error?: string;
};

export class ProviderError extends Error {
  constructor(message: string, readonly payload?: unknown) {
    super(message);
    this.name = "ProviderError";
  }
}

function credentials() {
  const url = getSetting("provider_url", "https://honestsmm.com/api/v2");
  const key = process.env.PROVIDER_API_KEY || getSetting("provider_key", "");
  if (!key) throw new ProviderError("Falta la API key del proveedor. Configúrala en /admin/ajustes.");
  return { url, key };
}

async function call<T>(params: Record<string, string | number | undefined>): Promise<T> {
  const { url, key } = credentials();
  const body = new URLSearchParams();
  body.set("key", key);
  for (const [name, value] of Object.entries(params)) {
    if (value !== undefined && value !== null && value !== "") body.set(name, String(value));
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30_000);
  let response: Response;
  try {
    response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
      cache: "no-store",
      signal: controller.signal,
    });
  } catch (err) {
    throw new ProviderError(
      err instanceof Error && err.name === "AbortError"
        ? "El proveedor no respondió a tiempo."
        : "No se pudo conectar con el proveedor.",
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  if (!response.ok) throw new ProviderError(`El proveedor respondió ${response.status}`, text.slice(0, 500));

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ProviderError("Respuesta ilegible del proveedor.", text.slice(0, 500));
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "error" in parsed) {
    throw new ProviderError(String((parsed as { error: unknown }).error), parsed);
  }
  return parsed as T;
}

export function providerConfigured(): boolean {
  return Boolean(process.env.PROVIDER_API_KEY || getSetting("provider_key", ""));
}

export const provider = {
  services: () => call<ProviderServiceRow[]>({ action: "services" }),

  balance: () => call<{ balance: string; currency: string }>({ action: "balance" }),

  addOrder: (input: AddOrderInput) => call<{ order: number }>({ action: "add", ...input }),

  status: (orderId: number) => call<StatusResponse>({ action: "status", order: orderId }),

  multiStatus: (orderIds: number[]) =>
    call<Record<string, StatusResponse>>({ action: "status", orders: orderIds.join(",") }),

  refill: (orderId: number) => call<{ refill: string | number }>({ action: "refill", order: orderId }),

  cancel: (orderIds: number[]) =>
    call<Array<{ order: number; cancel: number | { error: string } }>>({
      action: "cancel",
      orders: orderIds.join(","),
    }),

  refillStatus: (refillId: number) => call<{ status: string }>({ action: "refill_status", refill: refillId }),
};

/** Normaliza el estado del proveedor al vocabulario interno de la tienda. */
export function mapProviderStatus(raw: string | undefined): string {
  const s = (raw ?? "").toLowerCase();
  if (s.includes("completed")) return "completed";
  if (s.includes("partial")) return "partial";
  if (s.includes("progress") || s.includes("processing")) return "processing";
  if (s.includes("pending")) return "processing";
  if (s.includes("cancel")) return "canceled";
  if (s.includes("fail") || s.includes("error")) return "failed";
  if (s.includes("refund")) return "refunded";
  return "processing";
}
