#!/usr/bin/env node
/**
 * Genera las portadas de los productos como SVG (public/img/productos).
 * Son archivos de ~1 KB: cargan al instante y se ven nítidos en cualquier
 * pantalla. Desde el panel se pueden reemplazar por fotos reales.
 */
import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { PLATFORMS } from "../src/lib/taxonomy.mjs";
import { PLATFORM_LABEL, TYPE_LABEL } from "./copy.mjs";

const root = process.cwd();
const outDir = path.join(root, "public", "img", "productos");
fs.mkdirSync(outDir, { recursive: true });

const colorBy = Object.fromEntries(PLATFORMS.map((p) => [p.slug, p.color]));

const GLYPH = {
  seguidores: "M16 11a4 4 0 1 0-4-4 4 4 0 0 0 4 4Zm-8 2a3 3 0 1 0-3-3 3 3 0 0 0 3 3Zm8 2c-3 0-9 1.5-9 4.5V22h18v-2.5c0-3-6-4.5-9-4.5Zm-8 .5c-2.7.4-6 1.7-6 4V22h5v-2.5c0-1.4.6-2.6 1.5-3.5Z",
  suscriptores: "M4 5h16a2 2 0 0 1 2 2v10a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Zm6 3.5v7l6-3.5-6-3.5Z",
  miembros: "M12 4a4 4 0 1 1-4 4 4 4 0 0 1 4-4Zm-7 6a3 3 0 1 1-3 3 3 3 0 0 1 3-3Zm14 0a3 3 0 1 1-3 3 3 3 0 0 1 3-3Zm-7 4c-3.3 0-7 1.6-7 4.2V21h14v-2.8c0-2.6-3.7-4.2-7-4.2Z",
  likes: "M12 21s-8-5.1-8-10.2A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 8 3.8C20 15.9 12 21 12 21Z",
  reacciones: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm-3.5 7A1.5 1.5 0 1 1 7 10.5 1.5 1.5 0 0 1 8.5 9Zm7 0A1.5 1.5 0 1 1 14 10.5 1.5 1.5 0 0 1 15.5 9ZM12 18a5.5 5.5 0 0 1-5-3h10a5.5 5.5 0 0 1-5 3Z",
  vistas: "M12 5c-6 0-10 7-10 7s4 7 10 7 10-7 10-7-4-7-10-7Zm0 11a4 4 0 1 1 4-4 4 4 0 0 1-4 4Zm0-6a2 2 0 1 0 2 2 2 2 0 0 0-2-2Z",
  reproducciones: "M9 19V7l10-3v12M9 19a3 3 0 1 1-3-3 3 3 0 0 1 3 3Zm10-3a3 3 0 1 1-3-3 3 3 0 0 1 3 3Z",
  comentarios: "M4 4h16a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H9l-5 4v-4a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Z",
  compartidos: "M18 8a3 3 0 1 0-2.8-4H15L8.6 9.4a3 3 0 1 0 0 5.2l6.6 3.9a3 3 0 1 0 1-1.7l-6.6-3.9a3 3 0 0 0 0-1.8l6.6-3.9A3 3 0 0 0 18 8Z",
  guardados: "M6 3h12a1 1 0 0 1 1 1v17l-7-4-7 4V4a1 1 0 0 1 1-1Z",
  historias: "M12 3a9 9 0 1 0 9 9h-3a6 6 0 1 1-6-6Z",
  "en-vivo": "M12 8a4 4 0 1 1-4 4 4 4 0 0 1 4-4Zm-6.4-3.6 1.4 1.4a7 7 0 0 0 0 10.4l-1.4 1.4a9 9 0 0 1 0-13.2Zm12.8 0a9 9 0 0 1 0 13.2l-1.4-1.4a7 7 0 0 0 0-10.4Z",
  trafico: "M12 2a10 10 0 1 0 10 10A10 10 0 0 0 12 2Zm0 2c1.4 0 3 2.6 3.4 6H8.6C9 6.6 10.6 4 12 4ZM4.3 11h2.3c.1-2 .5-3.8 1.2-5.2A8 8 0 0 0 4.3 11Zm0 2a8 8 0 0 0 3.5 5.2c-.7-1.4-1.1-3.2-1.2-5.2Zm4.3 0h6.8c-.4 3.4-2 6-3.4 6s-3-2.6-3.4-6Zm8.8 0h2.3a8 8 0 0 1-3.5 5.2c.7-1.4 1.1-3.2 1.2-5.2Zm0-2c-.1-2-.5-3.8-1.2-5.2A8 8 0 0 1 19.7 11Z",
};

function esc(s) {
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function cover({ platform, type }) {
  const color = colorBy[platform] ?? "#7c3aed";
  const title = PLATFORM_LABEL[platform] ?? platform;
  const subtitle = TYPE_LABEL[type] ?? type;
  const glyph = GLYPH[type] ?? GLYPH.seguidores;
  const id = `${platform}-${type}`;

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 400" width="600" height="400" role="img" aria-label="${esc(subtitle)} para ${esc(title)}">
<defs>
<linearGradient id="bg-${id}" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="#151129"/><stop offset="1" stop-color="#0b0918"/>
</linearGradient>
<radialGradient id="halo-${id}" cx="0.78" cy="0.18" r="0.75">
<stop offset="0" stop-color="${color}" stop-opacity="0.55"/>
<stop offset="1" stop-color="${color}" stop-opacity="0"/>
</radialGradient>
<linearGradient id="ink-${id}" x1="0" y1="0" x2="1" y2="1">
<stop offset="0" stop-color="${color}"/><stop offset="1" stop-color="#ff2e93"/>
</linearGradient>
</defs>
<rect width="600" height="400" fill="url(#bg-${id})"/>
<rect width="600" height="400" fill="url(#halo-${id})"/>
<circle cx="482" cy="86" r="118" fill="${color}" opacity="0.13"/>
<circle cx="96" cy="332" r="92" fill="#ff2e93" opacity="0.09"/>
<g transform="translate(56 128) scale(3.4)">
<path d="${glyph}" fill="url(#ink-${id})"/>
</g>
<text x="56" y="316" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="34" font-weight="800" fill="#ffffff">${esc(subtitle)}</text>
<text x="56" y="352" font-family="system-ui,-apple-system,Segoe UI,Roboto,sans-serif" font-size="22" font-weight="600" fill="${color}">para ${esc(title)}</text>
</svg>`;
}

const dbPath = process.env.DATABASE_PATH || path.join(root, "data", "tusseguidores.db");
const combos = new Set();
if (fs.existsSync(dbPath)) {
  const db = new Database(dbPath, { readonly: true });
  // Productos ya publicados y, además, toda combinación que el proveedor
  // ofrece de verdad: así al publicar algo nuevo desde el panel ya hay portada.
  for (const row of db.prepare("SELECT DISTINCT platform, service_type FROM products").all()) {
    combos.add(`${row.platform}|${row.service_type}`);
  }
  const available = db.prepare(`
    SELECT platform, service_type FROM provider_services
     WHERE provider_enabled = 1
     GROUP BY platform, service_type HAVING COUNT(*) >= 3
  `).all();
  for (const row of available) {
    if (PLATFORM_LABEL[row.platform] && TYPE_LABEL[row.service_type]) {
      combos.add(`${row.platform}|${row.service_type}`);
    }
  }
  db.close();
}

let n = 0;
for (const combo of combos) {
  const [platform, type] = combo.split("|");
  fs.writeFileSync(path.join(outDir, `${platform}-${type}.svg`), cover({ platform, type }));
  n++;
}

// Imagen genérica de respaldo + Open Graph
fs.writeFileSync(path.join(outDir, "generico.svg"), cover({ platform: "instagram", type: "seguidores" }));
console.log(`Portadas generadas: ${n} en ${outDir}`);
