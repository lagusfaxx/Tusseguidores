import { all, run } from "./db";

export type SettingsMap = Record<string, string>;

/** Valores por defecto. Todo esto es editable desde /admin/ajustes. */
export const DEFAULT_SETTINGS: SettingsMap = {
  site_name: "TusSeguidores",
  site_domain: "tusseguidores.cl",
  site_url: "https://tusseguidores.cl",
  site_tagline: "Seguidores, likes y visualizaciones reales para tus redes",
  site_description:
    "Compra seguidores, likes y visualizaciones para Instagram, TikTok, YouTube y más. Entrega automática en minutos, pago seguro con Webpay y soporte en Chile.",
  contact_email: "hola@tusseguidores.cl",
  contact_whatsapp: "",

  // Precios
  usd_clp: "980",
  margin_percent: "180",
  price_rounding: "90",     // redondea a terminación .., 90 -> $X.X90
  min_price_clp: "1990",
  min_rate_json: "",

  // Proveedor
  provider_url: "https://honestsmm.com/api/v2",
  provider_key: "",
  auto_send_to_provider: "1",

  // Flow.cl
  flow_api_key: "",
  flow_secret_key: "",
  flow_sandbox: "1",

  // SEO
  seo_home_title: "Comprar seguidores en Chile | TusSeguidores.cl",
  seo_home_description:
    "Compra seguidores, likes y visualizaciones para Instagram, TikTok y YouTube en Chile. Entrega inmediata, precios en pesos y pago seguro.",
  seo_home_keywords:
    "comprar seguidores chile, seguidores instagram, likes tiktok, visualizaciones youtube",
  seo_home_text: "",
  google_site_verification: "",
  google_analytics_id: "",

  // Operación
  cron_secret: "",
  orders_enabled: "1",
};

let cache: { data: SettingsMap; at: number } | null = null;
const TTL_MS = 15_000;

export function getSettings(): SettingsMap {
  if (cache && Date.now() - cache.at < TTL_MS) return cache.data;
  const rows = all<{ key: string; value: string }>("SELECT key, value FROM settings");
  const data: SettingsMap = { ...DEFAULT_SETTINGS };
  for (const row of rows) data[row.key] = row.value;
  cache = { data, at: Date.now() };
  return data;
}

export function getSetting(key: string, fallback = ""): string {
  return getSettings()[key] ?? fallback;
}

export function getNumberSetting(key: string, fallback = 0): number {
  const raw = getSetting(key, "");
  const n = Number(raw);
  return Number.isFinite(n) ? n : fallback;
}

export function getBoolSetting(key: string, fallback = false): boolean {
  const raw = getSetting(key, "");
  if (raw === "") return fallback;
  return raw === "1" || raw.toLowerCase() === "true";
}

export function setSettings(values: SettingsMap) {
  const stmt = "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value";
  for (const [key, value] of Object.entries(values)) run(stmt, [key, value ?? ""]);
  cache = null;
}

export function invalidateSettings() {
  cache = null;
}
