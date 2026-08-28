#!/usr/bin/env node
/**
 * Convierte los dos archivos del proveedor (lista de precios y actualizaciones)
 * en data/catalog.json, la semilla que consume scripts/seed.mjs.
 *
 * Uso: node scripts/parse-catalog.mjs <precios_panel.txt> <services_update.txt>
 */
import fs from "node:fs";
import path from "node:path";

const [, , preciosPath, updatesPath] = process.argv;
if (!preciosPath) {
  console.error("Uso: node scripts/parse-catalog.mjs <precios_panel.txt> [services_update.txt]");
  process.exit(1);
}

const HEADER_RE = /^ID\tService\tRate per 1000/;
const ROW_RE = /^\s*(\d+)\t/;

function toNumber(raw) {
  if (raw == null) return null;
  const cleaned = String(raw).replace(/[$\s ]/g, "").replace(/,/g, "");
  if (!cleaned) return null;
  const n = Number(cleaned);
  return Number.isFinite(n) ? n : null;
}

/** "1 hour 39 minutes" -> minutos */
function parseAverageMinutes(raw) {
  if (!raw) return null;
  const text = raw.toLowerCase();
  let minutes = 0;
  let found = false;
  for (const [re, mult] of [
    [/(\d+)\s*day/, 1440],
    [/(\d+)\s*hour/, 60],
    [/(\d+)\s*minute/, 1],
  ]) {
    const m = text.match(re);
    if (m) {
      minutes += Number(m[1]) * mult;
      found = true;
    }
  }
  return found ? minutes : null;
}

// --- 1. Lista de precios --------------------------------------------------
const preciosLines = fs.readFileSync(preciosPath, "utf8").split(/\r?\n/);
const services = new Map();
let currentCategory = "Sin categoría";
let lastNonEmpty = "";

for (const line of preciosLines) {
  if (HEADER_RE.test(line)) {
    // La categoría es la última línea con contenido antes del encabezado.
    if (lastNonEmpty) currentCategory = lastNonEmpty.trim();
    continue;
  }
  if (ROW_RE.test(line)) {
    const cols = line.split("\t");
    const id = Number(cols[0].trim());
    const name = (cols[1] || "").trim();
    if (!id || !name) continue;
    const rate = toNumber(cols[2]);
    const min = toNumber(cols[3]);
    const max = toNumber(cols[4]);
    // Un mismo servicio aparece en varias categorías: nos quedamos con la primera.
    if (!services.has(id)) {
      services.set(id, {
        serviceId: id,
        name,
        category: currentCategory,
        rateUsdPer1000: rate ?? 0,
        minQty: min ?? 1,
        maxQty: max ?? 1000,
        avgMinutes: parseAverageMinutes(cols[5]),
        providerDescription: (cols[6] || "").trim() || null,
        categories: [currentCategory],
      });
    } else {
      const existing = services.get(id);
      if (!existing.categories.includes(currentCategory)) existing.categories.push(currentCategory);
    }
  }
  if (line.trim()) lastNonEmpty = line;
}

// --- 2. Actualizaciones (habilitados / deshabilitados) --------------------
const updates = new Map();
if (updatesPath && fs.existsSync(updatesPath)) {
  const lines = fs.readFileSync(updatesPath, "utf8").split(/\r?\n/);
  for (let i = 0; i < lines.length; i++) {
    const idLine = lines[i].trim();
    if (!/^\d+$/.test(idLine)) continue;
    const id = Number(idLine);
    // El bloque son 3 líneas: id / nombre+fecha / texto del cambio.
    const changeLine = (lines[i + 2] || "").trim();
    if (!changeLine) continue;
    const prev = updates.get(id) || {};
    if (/^Service disabled/i.test(changeLine)) prev.enabled = false;
    else if (/^Service enabled/i.test(changeLine)) prev.enabled = true;
    const rateMatch = changeLine.match(/^Rate (increased|decreased) from \$?([\d.]+) to \$?([\d.]+)/i);
    if (rateMatch) prev.latestRateUsdPer1000 = Number(rateMatch[3]);
    prev.lastUpdate = changeLine;
    updates.set(id, prev);
  }
}

// --- 3. Fusión ------------------------------------------------------------
const out = [];
for (const svc of services.values()) {
  const upd = updates.get(svc.serviceId);
  out.push({
    ...svc,
    // La tarifa del feed de cambios es más reciente que la de la lista de precios.
    rateUsdPer1000: upd?.latestRateUsdPer1000 ?? svc.rateUsdPer1000,
    providerEnabled: upd?.enabled === false ? 0 : 1,
    lastProviderUpdate: upd?.lastUpdate ?? null,
  });
}
out.sort((a, b) => a.serviceId - b.serviceId);

const disabled = out.filter((s) => !s.providerEnabled).length;
const target = path.join(process.cwd(), "data", "catalog.json");
fs.mkdirSync(path.dirname(target), { recursive: true });
fs.writeFileSync(target, JSON.stringify(out, null, 0));

console.log(`Servicios: ${out.length}`);
console.log(`Desactivados por el proveedor: ${disabled}`);
console.log(`Categorías del proveedor: ${new Set(out.map((s) => s.category)).size}`);
console.log(`Escrito en ${target}`);
