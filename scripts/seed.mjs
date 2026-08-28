#!/usr/bin/env node
/**
 * Carga data/catalog.json en la base de datos y publica un catálogo inicial
 * curado en español. Es idempotente: se puede volver a ejecutar sin duplicar
 * productos ni pisar los textos que hayas editado desde el panel.
 *
 *   node scripts/seed.mjs            -> importa + publica el set curado
 *   node scripts/seed.mjs --only-import  -> solo refresca provider_services
 */
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import Database from "better-sqlite3";
import { detectPlatform, detectServiceType, normalizeText } from "../src/lib/taxonomy.mjs";
import {
  dropScore, speedScore, overallScore, refillDaysFromName,
  detectGeo, detectVariant, ROUTABLE_GEOS,
} from "../src/lib/quality.mjs";
import { buildCopy, POST_TYPES, PLATFORM_LABEL, TYPE_LABEL } from "./copy.mjs";

const root = process.cwd();
const DATA_DIR = process.env.DATA_DIR ? path.resolve(process.env.DATA_DIR) : path.join(root, "data");
const DB_PATH = process.env.DATABASE_PATH ? path.resolve(process.env.DATABASE_PATH) : path.join(DATA_DIR, "tusseguidores.db");
const onlyImport = process.argv.includes("--only-import");

fs.mkdirSync(DATA_DIR, { recursive: true });
fs.mkdirSync(path.join(DATA_DIR, "uploads"), { recursive: true });

const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");
db.exec(fs.readFileSync(path.join(root, "src", "lib", "schema.sql"), "utf8"));

// ---------------------------------------------------------------- catálogo
const catalogPath = path.join(root, "data", "catalog.json");
if (!fs.existsSync(catalogPath)) {
  console.error("Falta data/catalog.json. Ejecuta antes: npm run parse-catalog -- <precios.txt> <updates.txt>");
  process.exit(1);
}
const catalog = JSON.parse(fs.readFileSync(catalogPath, "utf8"));

const upsertService = db.prepare(`
  INSERT INTO provider_services
    (service_id, name, clean_name, category, platform, service_type, rate_usd_per_1000,
     min_qty, max_qty, avg_minutes, refill, cancel, provider_description,
     refill_days, drop_score, speed_score, geo, variant,
     provider_enabled, last_provider_update, synced_at)
  VALUES (@service_id, @name, @clean_name, @category, @platform, @service_type, @rate,
          @min_qty, @max_qty, @avg_minutes, @refill, @cancel, @provider_description,
          @refill_days, @drop_score, @speed_score, @geo, @variant,
          @provider_enabled, @last_provider_update, datetime('now'))
  ON CONFLICT(service_id) DO UPDATE SET
    name = excluded.name, clean_name = excluded.clean_name, category = excluded.category,
    platform = excluded.platform, service_type = excluded.service_type,
    rate_usd_per_1000 = excluded.rate_usd_per_1000,
    min_qty = excluded.min_qty, max_qty = excluded.max_qty,
    avg_minutes = excluded.avg_minutes,
    provider_description = excluded.provider_description,
    refill_days = excluded.refill_days,
    drop_score = excluded.drop_score,
    speed_score = excluded.speed_score,
    geo = excluded.geo,
    variant = excluded.variant,
    provider_enabled = excluded.provider_enabled,
    last_provider_update = excluded.last_provider_update,
    synced_at = datetime('now')
`);

const importAll = db.transaction((rows) => {
  for (const row of rows) {
    const platform = detectPlatform(row.name, row.category);
    const serviceType = detectServiceType(row.name, row.category);
    const clean = normalizeText(row.name);
    const refillMatch = /refill|guarantee|garant/i.test(clean) && !/no refill/i.test(clean);
    const days = refillDaysFromName(clean);
    upsertService.run({
      service_id: row.serviceId,
      name: row.name,
      clean_name: clean,
      category: normalizeText(row.category) || row.category,
      platform,
      service_type: serviceType,
      rate: row.rateUsdPer1000,
      min_qty: Math.max(1, row.minQty || 1),
      max_qty: Math.max(1, row.maxQty || 1000),
      avg_minutes: row.avgMinutes,
      refill: refillMatch ? 1 : 0,
      cancel: 0,
      provider_description: row.providerDescription,
      refill_days: days,
      drop_score: dropScore(clean, days),
      speed_score: speedScore(clean, row.avgMinutes),
      geo: detectGeo(clean),
      variant: detectVariant(clean),
      provider_enabled: row.providerEnabled,
      last_provider_update: row.lastProviderUpdate,
    });
  }
});
importAll(catalog);
console.log(`Servicios importados/actualizados: ${catalog.length}`);

if (onlyImport) {
  console.log("Modo --only-import: no se tocan los productos.");
  process.exit(0);
}

// ------------------------------------------------------- ajustes iniciales
const setSetting = db.prepare(
  "INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO NOTHING",
);
for (const [key, value] of Object.entries({
  usd_clp: "980",
  margin_percent: "180",
  price_rounding: "90",
  min_price_clp: "1990",
  site_url: process.env.SITE_URL || "https://tusseguidores.cl",
  provider_url: "https://honestsmm.com/api/v2",
})) {
  setSetting.run(key, value);
}

// ------------------------------------------------------ selección curada
/** Escaleras de cantidad por tipo de servicio. */
const LADDERS = {
  seguidores: [100, 250, 500, 1000, 2500, 5000],
  suscriptores: [100, 250, 500, 1000, 2500, 5000],
  miembros: [100, 500, 1000, 2500, 5000, 10000],
  likes: [50, 100, 250, 500, 1000, 2500],
  reacciones: [50, 100, 250, 500, 1000],
  vistas: [1000, 2500, 5000, 10000, 25000, 50000],
  reproducciones: [1000, 2500, 5000, 10000, 25000],
  comentarios: [10, 25, 50, 100, 250],
  compartidos: [100, 250, 500, 1000, 2500],
  guardados: [100, 250, 500, 1000, 2500],
  historias: [500, 1000, 2500, 5000, 10000],
  "en-vivo": [100, 250, 500, 1000],
  trafico: [1000, 5000, 10000, 25000],
};

/**
 * Etiquetas de las tarjetas. Van solo en unos pocos productos: si todas dicen
 * "más vendido" la etiqueta deja de significar nada.
 */
const BADGES = {
  "instagram/seguidores": "Lo más pedido",
  "tiktok/vistas": "Barato",
  "youtube/suscriptores": "Entrega lenta y segura",
  "instagram/likes": "Llega en minutos",
};

/** Qué publicamos de entrada. El resto queda importado y oculto. */
const CURATED = [
  ["instagram", "seguidores", 1], ["instagram", "likes", 1], ["instagram", "vistas", 1],
  ["instagram", "comentarios", 0], ["instagram", "guardados", 0], ["instagram", "historias", 0],
  ["tiktok", "seguidores", 1], ["tiktok", "likes", 1], ["tiktok", "vistas", 1],
  ["tiktok", "comentarios", 0], ["tiktok", "compartidos", 0],
  ["youtube", "suscriptores", 1], ["youtube", "vistas", 1], ["youtube", "likes", 0],
  ["youtube", "comentarios", 0],
  ["facebook", "seguidores", 0], ["facebook", "likes", 0], ["facebook", "vistas", 0],
  ["twitter", "seguidores", 0], ["twitter", "likes", 0], ["twitter", "vistas", 0],
  ["telegram", "miembros", 0], ["telegram", "vistas", 0], ["telegram", "reacciones", 0],
  ["whatsapp", "miembros", 0], ["whatsapp", "reacciones", 0],
  ["spotify", "reproducciones", 0], ["spotify", "seguidores", 0],
  ["twitch", "seguidores", 0], ["twitch", "vistas", 0],
  ["threads", "seguidores", 0],
  ["linkedin", "seguidores", 0],
];

const geoMarks = ROUTABLE_GEOS.map(() => "?").join(",");
const candidates = db.prepare(`
  SELECT * FROM provider_services
   WHERE platform = ? AND service_type = ? AND provider_enabled = 1
     AND variant = '' AND geo IN (${geoMarks})
     AND rate_usd_per_1000 > 0 AND min_qty <= ?
   ORDER BY rate_usd_per_1000 ASC
`);

/**
 * Servicio de referencia del producto: el que fija el precio de venta y los
 * límites que se muestran en la ficha.
 *
 * Nos quedamos con el más barato dentro del tercio de mejor calidad. Así el
 * precio queda competitivo y, al despachar, el enrutado automático todavía
 * tiene presupuesto para subir a algo aún mejor si aparece.
 */
function pickService(platform, type, ladder) {
  const minNeeded = Math.min(...ladder);
  let rows = candidates.all(platform, type, ...ROUTABLE_GEOS, minNeeded);
  if (!rows.length) rows = candidates.all(platform, type, ...ROUTABLE_GEOS, minNeeded * 10);
  if (!rows.length) return null;

  const usable = rows.filter((r) => r.max_qty >= Math.max(...ladder) / 2);
  const pool = usable.length ? usable : rows;

  const scored = pool
    .map((r) => ({ ...r, score: overallScore(r.drop_score, r.speed_score) }))
    .sort((a, b) => b.score - a.score);

  const topCount = Math.max(1, Math.ceil(scored.length / 3));
  const top = scored.slice(0, topCount);
  return top.reduce((cheapest, r) => (r.rate_usd_per_1000 < cheapest.rate_usd_per_1000 ? r : cheapest));
}

function ladderFor(type, service) {
  const base = LADDERS[type] ?? LADDERS.seguidores;
  return base
    .filter((q) => q >= service.min_qty && q <= service.max_qty)
    .slice(0, 6);
}

function refillDays(cleanName) {
  const m = cleanName.match(/(\d+)\s*(?:D|days?)\s*refill/i);
  if (m) return Number(m[1]);
  if (/lifetime\s*refill/i.test(cleanName)) return 9999;
  return 0;
}

function deliveryLabel(avgMinutes) {
  if (avgMinutes == null) return "Inicio inmediato";
  if (avgMinutes < 60) return `Entrega en ~${avgMinutes} min`;
  if (avgMinutes < 1440) return `Entrega en ~${Math.round(avgMinutes / 60)} h`;
  return `Entrega en ~${Math.round(avgMinutes / 1440)} días`;
}

const findProduct = db.prepare("SELECT id FROM products WHERE slug = ?");
const insertProduct = db.prepare(`
  INSERT INTO products
    (slug, name, platform, service_type, provider_service_id, short_description, description_html,
     bullets_json, faq_json, seo_title, seo_description, seo_keywords, image_url, badge,
     price_mode, min_qty, max_qty, link_label, link_placeholder, link_help,
     delivery_label, quality_label, refill_days, guarantee_text, featured, published, sort_order)
  VALUES
    (@slug, @name, @platform, @service_type, @provider_service_id, @short_description, @description_html,
     @bullets_json, @faq_json, @seo_title, @seo_description, @seo_keywords, @image_url, @badge,
     'auto', @min_qty, @max_qty, @link_label, @link_placeholder, @link_help,
     @delivery_label, @quality_label, @refill_days, @guarantee_text, @featured, 1, @sort_order)
`);
const updateProductService = db.prepare(`
  UPDATE products SET provider_service_id = ?, min_qty = ?, max_qty = ?,
         delivery_label = ?, refill_days = ?, updated_at = datetime('now')
   WHERE id = ?
`);
const insertTier = db.prepare(
  "INSERT INTO product_tiers (product_id, quantity, popular, sort_order) VALUES (?, ?, ?, ?)",
);
const countTiers = db.prepare("SELECT COUNT(*) AS n FROM product_tiers WHERE product_id = ?");

let created = 0;
let updated = 0;
let skipped = [];

const seedProducts = db.transaction(() => {
  let order = 10;
  for (const [platform, type, featured] of CURATED) {
    const ladderBase = LADDERS[type] ?? LADDERS.seguidores;
    const service = pickService(platform, type, ladderBase);
    if (!service) {
      skipped.push(`${platform}/${type}`);
      continue;
    }
    const ladder = ladderFor(type, service);
    if (!ladder.length) {
      skipped.push(`${platform}/${type} (sin cantidades compatibles)`);
      continue;
    }

    const copy = buildCopy({ platform, type });
    const existing = findProduct.get(copy.slug);
    const days = refillDays(service.clean_name);

    if (existing) {
      updateProductService.run(
        service.service_id, ladder[0], service.max_qty,
        deliveryLabel(service.avg_minutes), days, existing.id,
      );
      updated++;
      order += 10;
      continue;
    }

    const info = insertProduct.run({
      slug: copy.slug,
      name: copy.name,
      platform,
      service_type: type,
      provider_service_id: service.service_id,
      short_description: copy.shortDescription,
      description_html: copy.descriptionHtml,
      bullets_json: JSON.stringify(copy.bullets),
      faq_json: JSON.stringify(copy.faq),
      seo_title: copy.seoTitle,
      seo_description: copy.seoDescription,
      seo_keywords: copy.seoKeywords,
      image_url: `/img/productos/${platform}-${type}.svg`,
      badge: BADGES[`${platform}/${type}`] ?? null,
      min_qty: ladder[0],
      max_qty: service.max_qty,
      link_label: copy.link.label,
      link_placeholder: copy.link.placeholder,
      link_help: copy.link.help,
      delivery_label: deliveryLabel(service.avg_minutes),
      quality_label: service.drop_score >= 80
        ? "Alta calidad · sin caídas"
        : service.refill
          ? "Alta calidad · con reposición"
          : "Alta calidad",
      refill_days: days,
      guarantee_text: days
        ? days >= 9999
          ? "Reposición de por vida si bajan"
          : `Reposición gratis por ${days} días`
        : "Reembolso si el pedido no se entrega",
      featured,
      sort_order: order,
    });

    const productId = Number(info.lastInsertRowid);
    const popularIndex = Math.min(2, ladder.length - 1);
    ladder.forEach((qty, i) => insertTier.run(productId, qty, i === popularIndex ? 1 : 0, i));
    created++;
    order += 10;
  }
});
seedProducts();

// Repone cantidades si algún producto quedó sin packs.
for (const row of db.prepare("SELECT id, service_type, provider_service_id FROM products").all()) {
  if (countTiers.get(row.id).n > 0) continue;
  const svc = db.prepare("SELECT * FROM provider_services WHERE service_id = ?").get(row.provider_service_id);
  if (!svc) continue;
  const ladder = ladderFor(row.service_type, svc);
  ladder.forEach((qty, i) => insertTier.run(row.id, qty, i === Math.min(2, ladder.length - 1) ? 1 : 0, i));
}

// ------------------------------------------------------------ usuario admin
const adminCount = db.prepare("SELECT COUNT(*) AS n FROM admin_users").get().n;
if (adminCount === 0) {
  const email = (process.env.ADMIN_EMAIL || "admin@tusseguidores.cl").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "cambiaesta123";
  const salt = crypto.randomBytes(16);
  const hash = crypto.scryptSync(password, salt, 64);
  db.prepare("INSERT INTO admin_users (email, password_hash, name) VALUES (?, ?, ?)").run(
    email,
    `scrypt$${salt.toString("hex")}$${hash.toString("hex")}`,
    "Administrador",
  );
  console.log(`\nUsuario admin creado: ${email} / ${password}`);
  console.log("Cambia la contraseña desde /admin/ajustes apenas entres.");
}

console.log(`\nProductos publicados: ${created} nuevos, ${updated} actualizados.`);
if (skipped.length) console.log(`Sin servicio disponible: ${skipped.join(", ")}`);
console.log(`Base de datos: ${DB_PATH}`);
