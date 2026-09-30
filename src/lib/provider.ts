import "server-only";
import { get } from "./db";
import { getSetting } from "./settings";

/**
 * Clientes de los proveedores SMM.
 *
 * honestsmm y JustAnotherPanel hablan el mismo protocolo, el "API v2" que usan
 * casi todos los paneles: POST application/x-www-form-urlencoded con `key` y
 * `action`, respuesta JSON. Lo único que cambia entre uno y otro es la URL, la
 * clave y de dónde sale cada una, así que es un solo cliente con dos
 * configuraciones.
 */

export type ProveedorId = "honestsmm" | "jap";

export type ProveedorDef = {
  id: ProveedorId;
  nombre: string;
  urlPorDefecto: string;
  ajusteUrl: string;
  ajusteClave: string;
  /** Variable de entorno que, si está, manda sobre la clave guardada. */
  envClave: string;
  /** Dónde se guarda el último saldo consultado. */
  ajusteSaldo: string;
  /**
   * Cuánto se corre el número de servicio para guardarlo en la tienda.
   *
   * Los dos proveedores numeran desde 1, así que el servicio 435 existe en
   * ambos. El principal queda sin desplazar para que ningún producto ni pedido
   * viejo cambie de número.
   */
  desplazamiento: number;
};

export const PROVEEDOR_PRINCIPAL: ProveedorId = "honestsmm";

export const PROVEEDORES: Record<ProveedorId, ProveedorDef> = {
  honestsmm: {
    id: "honestsmm",
    nombre: "honestsmm",
    urlPorDefecto: "https://honestsmm.com/api/v2",
    ajusteUrl: "provider_url",
    ajusteClave: "provider_key",
    envClave: "PROVIDER_API_KEY",
    ajusteSaldo: "provider_balance",
    desplazamiento: 0,
  },
  jap: {
    id: "jap",
    nombre: "JustAnotherPanel",
    urlPorDefecto: "https://justanotherpanel.com/api/v2",
    ajusteUrl: "jap_url",
    ajusteClave: "jap_key",
    envClave: "JAP_API_KEY",
    ajusteSaldo: "jap_balance",
    desplazamiento: 10_000_000,
  },
};

export const LISTA_PROVEEDORES: ProveedorDef[] = Object.values(PROVEEDORES);

export function esProveedor(valor: unknown): valor is ProveedorId {
  return typeof valor === "string" && Object.prototype.hasOwnProperty.call(PROVEEDORES, valor);
}

export function nombreProveedor(id: string | null | undefined): string {
  return esProveedor(id) ? PROVEEDORES[id].nombre : PROVEEDORES[PROVEEDOR_PRINCIPAL].nombre;
}

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

function claveDe(def: ProveedorDef): string {
  // Igual que con Flow: un espacio pegado a la clave da errores que no dicen nada.
  return (process.env[def.envClave] || getSetting(def.ajusteClave, "")).trim();
}

function credentials(id: ProveedorId) {
  const def = PROVEEDORES[id];
  const url = getSetting(def.ajusteUrl, def.urlPorDefecto).trim() || def.urlPorDefecto;
  const key = claveDe(def);
  if (!key) {
    throw new ProviderError(`Falta la API key de ${def.nombre}. Configúrala en /admin/ajustes.`);
  }
  return { url, key };
}

async function call<T>(id: ProveedorId, params: Record<string, string | number | undefined>): Promise<T> {
  const { url, key } = credentials(id);
  const nombre = PROVEEDORES[id].nombre;
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
        ? `${nombre} no respondió a tiempo.`
        : `No se pudo conectar con ${nombre}.`,
    );
  } finally {
    clearTimeout(timeout);
  }

  const text = await response.text();
  if (!response.ok) throw new ProviderError(`${nombre} respondió ${response.status}`, text.slice(0, 500));

  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new ProviderError(`Respuesta ilegible de ${nombre}.`, text.slice(0, 500));
  }
  if (parsed && typeof parsed === "object" && !Array.isArray(parsed) && "error" in parsed) {
    throw new ProviderError(String((parsed as { error: unknown }).error), parsed);
  }
  return parsed as T;
}

export function providerConfigured(id: ProveedorId = PROVEEDOR_PRINCIPAL): boolean {
  return Boolean(claveDe(PROVEEDORES[id]));
}

/** Los proveedores que tienen clave, en el orden en que se muestran. */
export function proveedoresConfigurados(): ProveedorId[] {
  return LISTA_PROVEEDORES.filter((def) => providerConfigured(def.id)).map((def) => def.id);
}

export function algunProveedorConfigurado(): boolean {
  return proveedoresConfigurados().length > 0;
}

export type ClienteProveedor = ReturnType<typeof clienteProveedor>;

/** Las llamadas a la API de un proveedor. Los números de servicio son los suyos. */
export function clienteProveedor(id: ProveedorId) {
  return {
    id,
    nombre: PROVEEDORES[id].nombre,

    services: () => call<ProviderServiceRow[]>(id, { action: "services" }),

    balance: () => call<{ balance: string; currency: string }>(id, { action: "balance" }),

    addOrder: (input: AddOrderInput) => call<{ order: number }>(id, { action: "add", ...input }),

    status: (orderId: number) => call<StatusResponse>(id, { action: "status", order: orderId }),

    multiStatus: (orderIds: number[]) =>
      call<Record<string, StatusResponse>>(id, { action: "status", orders: orderIds.join(",") }),

    refill: (orderId: number) => call<{ refill: string | number }>(id, { action: "refill", order: orderId }),

    cancel: (orderIds: number[]) =>
      call<Array<{ order: number; cancel: number | { error: string } }>>(id, {
        action: "cancel",
        orders: orderIds.join(","),
      }),

    refillStatus: (refillId: number) =>
      call<{ status: string }>(id, { action: "refill_status", refill: refillId }),
  };
}

/** Número de servicio de la tienda para un servicio de un proveedor. */
export function idInterno(id: ProveedorId, remoto: number): number {
  return PROVEEDORES[id].desplazamiento + remoto;
}

/**
 * A quién y con qué número se le pide un servicio de la tienda.
 *
 * Se lee de la base; si el servicio no está (un pedido muy viejo cuyo servicio
 * se borró a mano), se deduce del desplazamiento, que nunca cambia.
 */
export function servicioRemoto(serviceId: number): { proveedor: ProveedorId; remoto: number } {
  const fila = get<{ provider: string; remote_id: number | null }>(
    "SELECT provider, remote_id FROM provider_services WHERE service_id = ?",
    [serviceId],
  );
  if (fila && esProveedor(fila.provider)) {
    return {
      proveedor: fila.provider,
      remoto: fila.remote_id ?? serviceId - PROVEEDORES[fila.provider].desplazamiento,
    };
  }
  // El de mayor desplazamiento que no pase del número es el dueño.
  const proveedor =
    [...LISTA_PROVEEDORES]
      .sort((a, b) => b.desplazamiento - a.desplazamiento)
      .find((d) => serviceId >= d.desplazamiento)?.id ?? PROVEEDOR_PRINCIPAL;
  return { proveedor, remoto: serviceId - PROVEEDORES[proveedor].desplazamiento };
}

/**
 * Saldo del proveedor, guardado para no llamar a su API en cada pantalla.
 * Lo refresca el cron y la página de ajustes.
 */
export async function refreshBalance(id: ProveedorId = PROVEEDOR_PRINCIPAL): Promise<number | null> {
  if (!providerConfigured(id)) return null;
  try {
    const result = await clienteProveedor(id).balance();
    const value = Number(result.balance);
    if (!Number.isFinite(value)) return null;
    const { setSettings } = await import("./settings");
    const clave = PROVEEDORES[id].ajusteSaldo;
    setSettings({ [clave]: String(value), [`${clave}_at`]: new Date().toISOString() });
    return value;
  } catch {
    return null;
  }
}

/** Refresca el saldo de todos los proveedores configurados. */
export async function refreshBalances(): Promise<void> {
  await Promise.all(proveedoresConfigurados().map((id) => refreshBalance(id)));
}

export function cachedBalance(id: ProveedorId = PROVEEDOR_PRINCIPAL): { usd: number | null; at: string | null } {
  const clave = PROVEEDORES[id].ajusteSaldo;
  const raw = getSetting(clave, "");
  const value = Number(raw);
  return {
    usd: raw !== "" && Number.isFinite(value) ? value : null,
    at: getSetting(`${clave}_at`, "") || null,
  };
}

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
