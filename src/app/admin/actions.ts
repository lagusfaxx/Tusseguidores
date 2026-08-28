"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, hashPassword } from "@/lib/auth";
import { db, get, run } from "@/lib/db";
import { setSettings, invalidateSettings } from "@/lib/settings";
import { provider, providerConfigured, ProviderError } from "@/lib/provider";
import { detectPlatform, detectServiceType, normalizeText } from "@/lib/taxonomy.mjs";
import { sendToProvider, setStatus, syncOpenOrders, logEvent, markPaid } from "@/lib/orders";
import { sanitizeHtml, slugify } from "@/lib/utils";
import type { OrderStatus } from "@/lib/types";

export type ActionState = { ok?: string; error?: string };

async function guard() {
  try {
    await requireUser();
  } catch {
    redirect("/admin/login");
  }
}

function refreshStore(extra?: string) {
  revalidatePath("/", "layout");
  if (extra) revalidatePath(extra);
}

// ------------------------------------------------------------------ ajustes
const SETTING_KEYS = [
  "site_name", "site_domain", "site_url", "site_tagline", "site_description",
  "contact_email", "contact_whatsapp",
  "usd_clp", "margin_percent", "price_rounding", "min_price_clp", "min_rate_json",
  "provider_url", "provider_key", "auto_send_to_provider",
  "flow_api_key", "flow_secret_key", "flow_sandbox",
  "seo_home_title", "seo_home_description", "seo_home_keywords", "seo_home_text",
  "google_site_verification", "google_analytics_id",
  "cron_secret", "orders_enabled",
];

export async function saveSettings(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await guard();
  const values: Record<string, string> = {};
  for (const key of SETTING_KEYS) {
    if (!formData.has(key)) continue;
    const raw = String(formData.get(key) ?? "").trim();
    values[key] = key === "seo_home_text" ? sanitizeHtml(raw) : raw;
  }
  // Las casillas no envían nada cuando están apagadas.
  for (const flag of ["auto_send_to_provider", "flow_sandbox", "orders_enabled"]) {
    values[flag] = formData.get(flag) ? "1" : "0";
  }
  setSettings(values);
  refreshStore();
  return { ok: "Ajustes guardados." };
}

export async function changePassword(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const user = await requireUser().catch(() => null);
  if (!user) redirect("/admin/login");

  const password = String(formData.get("new_password") ?? "");
  const confirm = String(formData.get("confirm_password") ?? "");
  if (password.length < 8) return { error: "La contraseña debe tener al menos 8 caracteres." };
  if (password !== confirm) return { error: "Las contraseñas no coinciden." };

  run("UPDATE admin_users SET password_hash = ? WHERE id = ?", [hashPassword(password), user.id]);
  return { ok: "Contraseña actualizada." };
}

// ----------------------------------------------------------------- productos
function tiersFromForm(formData: FormData): { quantity: number; price: number | null; popular: boolean }[] {
  const quantities = formData.getAll("tier_quantity").map((v) => Number(v));
  const prices = formData.getAll("tier_price").map((v) => String(v).trim());
  const popularIndex = String(formData.get("tier_popular") ?? "");

  const out: { quantity: number; price: number | null; popular: boolean }[] = [];
  quantities.forEach((quantity, i) => {
    if (!Number.isFinite(quantity) || quantity <= 0) return;
    const raw = prices[i] ?? "";
    const price = raw === "" ? null : Number(raw.replace(/[^\d]/g, ""));
    out.push({
      quantity: Math.round(quantity),
      price: price != null && Number.isFinite(price) && price > 0 ? price : null,
      popular: popularIndex === String(i),
    });
  });
  return out.sort((a, b) => a.quantity - b.quantity);
}

export async function saveProduct(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await guard();

  const id = Number(formData.get("id") ?? 0);
  const providerServiceId = Number(formData.get("provider_service_id"));
  const service = get<{ platform: string; service_type: string; min_qty: number; max_qty: number }>(
    "SELECT platform, service_type, min_qty, max_qty FROM provider_services WHERE service_id = ?",
    [providerServiceId],
  );
  if (!service) return { error: "El servicio del proveedor no existe." };

  const name = String(formData.get("name") ?? "").trim();
  if (!name) return { error: "El producto necesita un nombre." };

  let slug = slugify(String(formData.get("slug") ?? "") || name);
  if (!slug) return { error: "El enlace (slug) no puede quedar vacío." };
  const clash = get<{ id: number }>("SELECT id FROM products WHERE slug = ? AND id != ?", [slug, id]);
  if (clash) slug = `${slug}-${Date.now().toString(36).slice(-4)}`;

  const bullets = String(formData.get("bullets") ?? "")
    .split("\n").map((line) => line.trim()).filter(Boolean);

  // Preguntas frecuentes: una por línea con el formato "pregunta | respuesta".
  const faq = String(formData.get("faq") ?? "")
    .split("\n")
    .map((line) => {
      const [q, ...rest] = line.split("|");
      const a = rest.join("|").trim();
      return q?.trim() && a ? { q: q.trim(), a } : null;
    })
    .filter(Boolean);

  const values = {
    slug,
    name,
    platform: String(formData.get("platform") ?? "") || service.platform,
    service_type: String(formData.get("service_type") ?? "") || service.service_type,
    provider_service_id: providerServiceId,
    short_description: String(formData.get("short_description") ?? "").trim(),
    description_html: sanitizeHtml(String(formData.get("description_html") ?? "")),
    bullets_json: JSON.stringify(bullets),
    faq_json: JSON.stringify(faq),
    seo_title: String(formData.get("seo_title") ?? "").trim() || null,
    seo_description: String(formData.get("seo_description") ?? "").trim() || null,
    seo_keywords: String(formData.get("seo_keywords") ?? "").trim() || null,
    og_image: String(formData.get("og_image") ?? "").trim() || null,
    noindex: formData.get("noindex") ? 1 : 0,
    image_url: String(formData.get("image_url") ?? "").trim() || null,
    badge: String(formData.get("badge") ?? "").trim() || null,
    price_mode: formData.get("price_mode") === "manual" ? "manual" : "auto",
    margin_override: formData.get("margin_override")
      ? Number(formData.get("margin_override")) || null
      : null,
    min_qty: Math.max(service.min_qty, Number(formData.get("min_qty")) || service.min_qty),
    max_qty: Math.min(service.max_qty, Number(formData.get("max_qty")) || service.max_qty),
    link_label: String(formData.get("link_label") ?? "").trim() || "Enlace o usuario",
    link_placeholder: String(formData.get("link_placeholder") ?? "").trim() || "https://...",
    link_help: String(formData.get("link_help") ?? "").trim(),
    delivery_label: String(formData.get("delivery_label") ?? "").trim() || "Inicio inmediato",
    quality_label: String(formData.get("quality_label") ?? "").trim() || "Alta calidad",
    refill_days: Number(formData.get("refill_days")) || 0,
    guarantee_text: String(formData.get("guarantee_text") ?? "").trim() || null,
    featured: formData.get("featured") ? 1 : 0,
    published: formData.get("published") ? 1 : 0,
    sort_order: Number(formData.get("sort_order")) || 100,
  };

  const tiers = tiersFromForm(formData);

  const save = db.transaction(() => {
    let productId = id;
    if (id) {
      db.prepare(
        `UPDATE products SET
           slug=@slug, name=@name, platform=@platform, service_type=@service_type,
           provider_service_id=@provider_service_id, short_description=@short_description,
           description_html=@description_html, bullets_json=@bullets_json, faq_json=@faq_json,
           seo_title=@seo_title, seo_description=@seo_description, seo_keywords=@seo_keywords,
           og_image=@og_image, noindex=@noindex, image_url=@image_url, badge=@badge,
           price_mode=@price_mode, margin_override=@margin_override,
           min_qty=@min_qty, max_qty=@max_qty,
           link_label=@link_label, link_placeholder=@link_placeholder, link_help=@link_help,
           delivery_label=@delivery_label, quality_label=@quality_label,
           refill_days=@refill_days, guarantee_text=@guarantee_text,
           featured=@featured, published=@published, sort_order=@sort_order,
           updated_at=datetime('now')
         WHERE id=@id`,
      ).run({ ...values, id });
    } else {
      const info = db.prepare(
        `INSERT INTO products
           (slug, name, platform, service_type, provider_service_id, short_description,
            description_html, bullets_json, faq_json, seo_title, seo_description, seo_keywords,
            og_image, noindex, image_url, badge, price_mode, margin_override, min_qty, max_qty,
            link_label, link_placeholder, link_help, delivery_label, quality_label,
            refill_days, guarantee_text, featured, published, sort_order)
         VALUES
           (@slug, @name, @platform, @service_type, @provider_service_id, @short_description,
            @description_html, @bullets_json, @faq_json, @seo_title, @seo_description, @seo_keywords,
            @og_image, @noindex, @image_url, @badge, @price_mode, @margin_override, @min_qty, @max_qty,
            @link_label, @link_placeholder, @link_help, @delivery_label, @quality_label,
            @refill_days, @guarantee_text, @featured, @published, @sort_order)`,
      ).run(values);
      productId = Number(info.lastInsertRowid);
    }

    run("DELETE FROM product_tiers WHERE product_id = ?", [productId]);
    tiers.forEach((tier, i) =>
      run(
        "INSERT INTO product_tiers (product_id, quantity, price_clp, popular, sort_order) VALUES (?, ?, ?, ?, ?)",
        [productId, tier.quantity, tier.price, tier.popular ? 1 : 0, i],
      ),
    );
    return productId;
  });

  const productId = save();
  refreshStore(`/producto/${slug}`);
  if (!id) redirect(`/admin/productos/${productId}?creado=1`);
  return { ok: "Producto guardado." };
}

export async function togglePublished(formData: FormData) {
  await guard();
  const id = Number(formData.get("id"));
  run(
    "UPDATE products SET published = CASE published WHEN 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?",
    [id],
  );
  refreshStore();
  revalidatePath("/admin/productos");
}

export async function deleteProduct(formData: FormData) {
  await guard();
  const id = Number(formData.get("id"));
  run("DELETE FROM products WHERE id = ?", [id]);
  refreshStore();
  redirect("/admin/productos?eliminado=1");
}

/** Crea un producto en blanco a partir de un servicio del proveedor. */
export async function createFromService(formData: FormData) {
  await guard();
  const serviceId = Number(formData.get("service_id"));
  const service = get<{
    service_id: number; clean_name: string; platform: string; service_type: string;
    min_qty: number; max_qty: number; avg_minutes: number | null;
  }>("SELECT * FROM provider_services WHERE service_id = ?", [serviceId]);
  if (!service) redirect("/admin/catalogo?error=1");

  const base = slugify(`${service.service_type}-${service.platform}-${service.service_id}`);
  const info = db.prepare(
    `INSERT INTO products
       (slug, name, platform, service_type, provider_service_id, short_description,
        image_url, min_qty, max_qty, published, sort_order)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 100)`,
  ).run(
    base,
    service.clean_name.slice(0, 90),
    service.platform,
    service.service_type,
    service.service_id,
    "",
    `/img/productos/${service.platform}-${service.service_type}.svg`,
    service.min_qty,
    service.max_qty,
  );

  const productId = Number(info.lastInsertRowid);
  // Escalera inicial razonable dentro de los límites del servicio.
  const ladder = [100, 250, 500, 1000, 2500, 5000]
    .filter((q) => q >= service.min_qty && q <= service.max_qty)
    .slice(0, 6);
  (ladder.length ? ladder : [service.min_qty]).forEach((q, i) =>
    run("INSERT INTO product_tiers (product_id, quantity, popular, sort_order) VALUES (?, ?, ?, ?)", [
      productId, q, i === 2 ? 1 : 0, i,
    ]),
  );

  redirect(`/admin/productos/${productId}?creado=1`);
}

// ------------------------------------------------------------------ pedidos
export async function orderAction(formData: FormData) {
  await guard();
  const id = Number(formData.get("order_id"));
  const action = String(formData.get("action"));

  if (action === "send") {
    await sendToProvider(id);
  } else if (action === "mark_paid") {
    await markPaid(id, "manual");
  } else if (action === "note") {
    const note = String(formData.get("admin_note") ?? "").trim();
    run("UPDATE orders SET admin_note = ?, updated_at = datetime('now') WHERE id = ?", [note, id]);
  } else if (action === "status") {
    const status = String(formData.get("status")) as OrderStatus;
    setStatus(id, status, `Estado cambiado a mano desde el panel: ${status}.`);
  } else if (action === "refill") {
    const order = get<{ provider_order_id: number | null }>(
      "SELECT provider_order_id FROM orders WHERE id = ?", [id],
    );
    if (order?.provider_order_id) {
      try {
        const result = await provider.refill(order.provider_order_id);
        logEvent(id, "refill", `Reposición solicitada al proveedor (ID ${result.refill}).`);
      } catch (error) {
        logEvent(id, "error", `No se pudo pedir la reposición: ${(error as Error).message}`);
      }
    }
  } else if (action === "cancel") {
    const order = get<{ provider_order_id: number | null }>(
      "SELECT provider_order_id FROM orders WHERE id = ?", [id],
    );
    if (order?.provider_order_id) {
      try {
        await provider.cancel([order.provider_order_id]);
        logEvent(id, "cancel", "Cancelación solicitada al proveedor.");
      } catch (error) {
        logEvent(id, "error", `No se pudo cancelar: ${(error as Error).message}`);
      }
    }
    setStatus(id, "canceled", "Pedido cancelado desde el panel.");
  }

  revalidatePath("/admin/pedidos");
  revalidatePath(`/admin/pedidos/${id}`);
}

export async function syncOrders() {
  await guard();
  await syncOpenOrders(200);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
}

// -------------------------------------------------- catálogo del proveedor
export async function syncProviderCatalog(_prev: ActionState): Promise<ActionState> {
  await guard();
  if (!providerConfigured()) {
    return { error: "Primero guarda la API key del proveedor en Ajustes." };
  }

  let rows: Awaited<ReturnType<typeof provider.services>>;
  try {
    rows = await provider.services();
  } catch (error) {
    return {
      error: error instanceof ProviderError
        ? `El proveedor respondió: ${error.message}`
        : "No se pudo conectar con el proveedor.",
    };
  }
  if (!Array.isArray(rows)) return { error: "El proveedor devolvió una respuesta inesperada." };

  const upsert = db.prepare(`
    INSERT INTO provider_services
      (service_id, name, clean_name, category, platform, service_type, rate_usd_per_1000,
       min_qty, max_qty, refill, cancel, provider_enabled, synced_at)
    VALUES (@service_id, @name, @clean_name, @category, @platform, @service_type, @rate,
            @min_qty, @max_qty, @refill, @cancel, 1, datetime('now'))
    ON CONFLICT(service_id) DO UPDATE SET
      name = excluded.name, clean_name = excluded.clean_name, category = excluded.category,
      platform = excluded.platform, service_type = excluded.service_type,
      rate_usd_per_1000 = excluded.rate_usd_per_1000,
      min_qty = excluded.min_qty, max_qty = excluded.max_qty,
      refill = excluded.refill, cancel = excluded.cancel,
      provider_enabled = 1, synced_at = datetime('now')
  `);

  const seen: number[] = [];
  const apply = db.transaction(() => {
    for (const row of rows) {
      const serviceId = Number(row.service);
      if (!serviceId) continue;
      seen.push(serviceId);
      upsert.run({
        service_id: serviceId,
        name: row.name,
        clean_name: normalizeText(row.name),
        category: normalizeText(row.category) || String(row.category ?? ""),
        platform: detectPlatform(row.name, row.category),
        service_type: detectServiceType(row.name, row.category),
        rate: Number(row.rate) || 0,
        min_qty: Number(row.min) || 1,
        max_qty: Number(row.max) || 1000,
        refill: row.refill ? 1 : 0,
        cancel: row.cancel ? 1 : 0,
      });
    }
    // Lo que el proveedor ya no lista queda deshabilitado, no se borra: así los
    // pedidos históricos conservan su referencia.
    if (seen.length) {
      const marks = seen.map(() => "?").join(",");
      run(`UPDATE provider_services SET provider_enabled = 0 WHERE service_id NOT IN (${marks})`, seen);
    }
  });
  apply();

  const disabled = get<{ n: number }>(
    "SELECT COUNT(*) AS n FROM provider_services WHERE provider_enabled = 0",
  )?.n ?? 0;
  const affected = get<{ n: number }>(
    `SELECT COUNT(*) AS n FROM products p
       JOIN provider_services s ON s.service_id = p.provider_service_id
      WHERE p.published = 1 AND s.provider_enabled = 0`,
  )?.n ?? 0;

  invalidateSettings();
  refreshStore();
  revalidatePath("/admin/catalogo");

  return {
    ok: `Catálogo sincronizado: ${seen.length} servicios activos, ${disabled} dados de baja.` +
      (affected ? ` Atención: ${affected} producto(s) publicado(s) apuntan a servicios que el proveedor desactivó.` : ""),
  };
}

// ------------------------------------------------------------------ cupones
export async function saveCoupon(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await guard();
  const code = String(formData.get("code") ?? "").trim().toUpperCase();
  if (!/^[A-Z0-9_-]{3,24}$/.test(code)) {
    return { error: "El código debe tener entre 3 y 24 caracteres (letras, números, - o _)." };
  }
  const value = Number(formData.get("value"));
  if (!Number.isFinite(value) || value <= 0) return { error: "El descuento debe ser mayor que cero." };

  run(
    `INSERT INTO coupons (code, kind, value, min_clp, max_uses, active, expires_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(code) DO UPDATE SET
       kind = excluded.kind, value = excluded.value, min_clp = excluded.min_clp,
       max_uses = excluded.max_uses, active = excluded.active, expires_at = excluded.expires_at`,
    [
      code,
      formData.get("kind") === "fixed" ? "fixed" : "percent",
      value,
      Number(formData.get("min_clp")) || 0,
      Number(formData.get("max_uses")) || 0,
      formData.get("active") ? 1 : 0,
      String(formData.get("expires_at") ?? "").trim() || null,
    ],
  );
  revalidatePath("/admin/cupones");
  return { ok: `Cupón ${code} guardado.` };
}

export async function deleteCoupon(formData: FormData) {
  await guard();
  run("DELETE FROM coupons WHERE code = ?", [String(formData.get("code"))]);
  revalidatePath("/admin/cupones");
}

