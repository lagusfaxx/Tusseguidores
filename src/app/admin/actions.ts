"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { requireUser, hashPassword } from "@/lib/auth";
import { all, db, get, run, rescoreServices } from "@/lib/db";
import { setSettings, invalidateSettings, getBoolSetting } from "@/lib/settings";
import { provider, providerConfigured, ProviderError } from "@/lib/provider";
import { testCredentials } from "@/lib/flow";
import { testEmail } from "@/lib/email";
import { detectPlatform, detectServiceType, normalizeText } from "@/lib/taxonomy.mjs";
import {
  dropScore, speedScore, refillDaysFromName, detectGeo, detectVariant, orderKindFromApiType,
  startMinutesFromName,
} from "@/lib/quality.mjs";
import {
  sendToProvider, setStatus, setStatusManual, markDispatchedManually, syncOpenOrders, logEvent,
  markPaid, retryUndispatched,
} from "@/lib/orders";
import { sanitizeHtml, slugify } from "@/lib/utils";
import { buildCopy } from "@/lib/copy.mjs";
import { findOffer, ladderFor } from "@/lib/offers";
import { publicarNiveles, refrescarEtiquetasDeEntrega } from "@/lib/autolevels";
import { movimiento } from "@/lib/wallet";
import { acreditar, rechazar } from "@/lib/topups";
import { reembolsar } from "@/lib/reseller-orders";
import {
  agregarMensaje, cerrarTicket, reabrirTicket, ticketPorId, contactoDeTicket,
} from "@/lib/tickets";
import { notificarRespuestaTicket } from "@/lib/notify";
import { absoluteUrl } from "@/lib/seo";
import { formatClp } from "@/lib/pricing";
import type { OrderStatus } from "@/lib/types";

export type ActionState = { ok?: string; error?: string };

/**
 * `redirect()` y `notFound()` funcionan lanzando un error especial. Al envolver
 * una acción en try/catch hay que dejarlos pasar o el redirect nunca ocurre.
 */
function isControlFlowError(error: unknown): boolean {
  const digest = (error as { digest?: unknown })?.digest;
  return typeof digest === "string" && (digest.startsWith("NEXT_REDIRECT") || digest === "NEXT_NOT_FOUND");
}

/**
 * Envuelve una acción de formulario que no devuelve estado. Si algo falla, en
 * vez de tumbar la página con un error de servidor volvemos a la pantalla de
 * origen con el motivo escrito.
 */
async function withErrorRedirect(backTo: string, action: () => Promise<void> | void) {
  try {
    await action();
  } catch (error) {
    if (isControlFlowError(error)) throw error;
    const message = error instanceof Error ? error.message : "Error inesperado.";
    console.error(`[admin] ${backTo}:`, error);
    redirect(`${backTo}${backTo.includes("?") ? "&" : "?"}error=${encodeURIComponent(message.slice(0, 200))}`);
  }
}

async function guard() {
  try {
    await requireUser();
  } catch {
    redirect("/admin/login");
  }
}

/** Enlace de producto libre: si choca, se le agrega un sufijo. */
function uniqueSlug(base: string, ignoreId = 0): string {
  const root = slugify(base) || `producto-${Date.now().toString(36)}`;
  let candidate = root;
  for (let i = 2; i < 50; i++) {
    const clash = get<{ id: number }>("SELECT id FROM products WHERE slug = ? AND id != ?", [
      candidate,
      ignoreId,
    ]);
    if (!clash) return candidate;
    candidate = `${root}-${i}`;
  }
  return `${root}-${Date.now().toString(36).slice(-5)}`;
}

function refreshStore(extra?: string) {
  revalidatePath("/", "layout");
  if (extra) revalidatePath(extra);
}

// ------------------------------------------------------------------ ajustes
const SETTING_KEYS = [
  "site_name", "site_domain", "site_url", "site_tagline", "site_description",
  "contact_email", "contact_whatsapp",
  "usd_clp", "margin_percent", "price_rounding", "min_price_clp", "margin_reference",
  "auto_levels",
  "provider_url", "provider_key", "auto_send_to_provider", "low_balance_usd",
  "email_enabled", "resend_api_key", "email_from", "email_reply_to", "email_admin",
  "email_admin_alerts", "email_admin_new_orders",
  "reseller_enabled", "reseller_margin_percent", "reseller_min_topup_clp",
  "reseller_min_order_clp", "reseller_welcome",
  "transfer_enabled", "transfer_bank", "transfer_account_type", "transfer_account_number",
  "transfer_holder", "transfer_rut", "transfer_email", "transfer_instructions",
  "flow_api_key", "flow_secret_key", "flow_sandbox",
  "seo_home_title", "seo_home_description", "seo_home_keywords", "seo_home_text",
  "auto_seo_text",
  "google_site_verification", "google_analytics_id",
  "rating_enabled", "rating_value", "rating_count",
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

  // Los precios mínimos por tipo llegan como un campo por tipo y se guardan
  // como un solo JSON.
  const minRates: Record<string, number> = {};
  for (const [field, value] of formData.entries()) {
    if (!field.startsWith("min_rate__")) continue;
    const tipo = field.slice("min_rate__".length);
    const n = Number(String(value).replace(/[^\d]/g, ""));
    if (tipo && Number.isFinite(n) && n >= 0) minRates[tipo] = n;
  }
  if (Object.keys(minRates).length) values.min_rate_json = JSON.stringify(minRates);
  // Las casillas no envían nada cuando están apagadas.
  for (const flag of [
    "auto_send_to_provider", "flow_sandbox", "orders_enabled", "auto_seo_text", "transfer_enabled",
    "auto_levels", "email_enabled", "email_admin_alerts", "email_admin_new_orders",
    "reseller_enabled", "rating_enabled",
  ]) {
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

/** Comprueba las credenciales de Flow sin cobrar nada. */
export async function testFlow(_prev: ActionState): Promise<ActionState> {
  await guard();
  const result = await testCredentials();
  if (result.ok) return { ok: result.message };
  return { error: result.detail ? `${result.message} (Flow dijo: "${result.detail}")` : result.message };
}

/** Manda un correo de prueba con Resend para ver si la configuración sirve. */
export async function testResend(_prev: ActionState): Promise<ActionState> {
  await guard();
  const result = await testEmail();
  return result.ok ? { ok: result.message } : { error: result.message };
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

  const slug = uniqueSlug(String(formData.get("slug") ?? "") || name, id);

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
    // Al editar un producto a mano se sale del modo automático salvo que la
    // casilla siga marcada: si no, el generador pisaría el texto en la
    // siguiente sincronización.
    auto_managed: formData.get("auto_managed") ? 1 : 0,
    level: String(formData.get("level") ?? "").trim(),
    margin_override: formData.get("margin_override")
      ? Number(formData.get("margin_override")) || null
      : null,
    auto_select: formData.get("auto_select") ? 1 : 0,
    max_cost_ratio: Math.min(5, Math.max(1, Number(formData.get("max_cost_ratio")) || 1.35)),
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
    // 0 en cualquiera de los dos = este producto usa la calificación general.
    rating_value: Math.min(5, Math.max(0, Number(formData.get("rating_value")) || 0)),
    rating_count: Math.max(0, Math.round(Number(formData.get("rating_count")) || 0)),
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
           level=@level, auto_managed=@auto_managed,
           auto_select=@auto_select, max_cost_ratio=@max_cost_ratio,
           min_qty=@min_qty, max_qty=@max_qty,
           link_label=@link_label, link_placeholder=@link_placeholder, link_help=@link_help,
           delivery_label=@delivery_label, quality_label=@quality_label,
           refill_days=@refill_days, guarantee_text=@guarantee_text,
           featured=@featured, published=@published, sort_order=@sort_order,
           rating_value=@rating_value, rating_count=@rating_count,
           updated_at=datetime('now')
         WHERE id=@id`,
      ).run({ ...values, id });
    } else {
      const info = db.prepare(
        `INSERT INTO products
           (slug, name, platform, service_type, provider_service_id, short_description,
            description_html, bullets_json, faq_json, seo_title, seo_description, seo_keywords,
            og_image, noindex, image_url, badge, price_mode, margin_override,
            level, auto_managed, auto_select, max_cost_ratio, min_qty, max_qty,
            link_label, link_placeholder, link_help, delivery_label, quality_label,
            refill_days, guarantee_text, featured, published, sort_order,
            rating_value, rating_count)
         VALUES
           (@slug, @name, @platform, @service_type, @provider_service_id, @short_description,
            @description_html, @bullets_json, @faq_json, @seo_title, @seo_description, @seo_keywords,
            @og_image, @noindex, @image_url, @badge, @price_mode, @margin_override,
            @level, @auto_managed, @auto_select, @max_cost_ratio, @min_qty, @max_qty,
            @link_label, @link_placeholder, @link_help, @delivery_label, @quality_label,
            @refill_days, @guarantee_text, @featured, @published, @sort_order,
            @rating_value, @rating_count)`,
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
  await withErrorRedirect("/admin/productos", async () => {
    await guard();
    const id = Number(formData.get("id"));
    run(
      "UPDATE products SET published = CASE published WHEN 1 THEN 0 ELSE 1 END, updated_at = datetime('now') WHERE id = ?",
      [id],
    );
    refreshStore();
    revalidatePath("/admin/productos");
  });
}

export async function deleteProduct(formData: FormData) {
  await withErrorRedirect("/admin/productos", async () => {
    await guard();
    const id = Number(formData.get("id"));
    run("DELETE FROM products WHERE id = ?", [id]);
    refreshStore();
    redirect("/admin/productos?eliminado=1");
  });
}

/**
 * Crea un producto listo a partir de "red social + qué vendes".
 *
 * Es la vía normal para agregar productos: la tienda busca el mejor servicio,
 * arma la escalera de cantidades, escribe los textos y el SEO en español y deja
 * el producto publicado. Después se puede afinar en el editor.
 */
export async function createProductFromOffer(formData: FormData) {
  await withErrorRedirect("/admin/productos/nuevo", async () => {
    await guard();

    const platform = String(formData.get("platform") ?? "");
    const serviceType = String(formData.get("service_type") ?? "");
    const orderKind = String(formData.get("order_kind") ?? "default");
    const publish = formData.get("publish") ? 1 : 0;

    const offer = findOffer(platform, serviceType, orderKind);
    if (!offer) redirect("/admin/productos/nuevo?error=sin-servicio");

    const copy = buildCopy({ platform, type: serviceType, orderKind });
    const slug = uniqueSlug(copy.slug);

    const ladder = ladderFor(offer);
    const days = refillDaysFromName(offer.best_name);

    const create = db.transaction(() => {
      const info = db.prepare(
        `INSERT INTO products
           (slug, name, platform, service_type, provider_service_id, short_description,
            description_html, bullets_json, faq_json, seo_title, seo_description, seo_keywords,
            image_url, min_qty, max_qty, link_label, link_placeholder, link_help,
            delivery_label, quality_label, refill_days, guarantee_text,
            auto_select, max_cost_ratio, published, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 1, 1.35, ?, 100)`,
      ).run(
        slug, copy.name, platform, serviceType, offer.best_service_id,
        copy.shortDescription, copy.descriptionHtml,
        JSON.stringify(copy.bullets), JSON.stringify(copy.faq),
        copy.seoTitle, copy.seoDescription, copy.seoKeywords,
        `/img/productos/${platform}-${serviceType}.svg`,
        ladder[0], offer.best_max,
        copy.link.label, copy.link.placeholder, copy.link.help,
        "Inicio inmediato",
        offer.score >= 80 ? "Alta calidad · sin caídas" : "Alta calidad",
        days,
        days >= 9999
          ? "Reposición de por vida si bajan"
          : days > 0
            ? `Reposición gratis por ${days} días`
            : "Reembolso si el pedido no se entrega",
        publish,
      );

      const productId = Number(info.lastInsertRowid);
      const popular = Math.min(2, ladder.length - 1);
      ladder.forEach((quantity, i) =>
        run("INSERT INTO product_tiers (product_id, quantity, popular, sort_order) VALUES (?, ?, ?, ?)", [
          productId, quantity, i === popular ? 1 : 0, i,
        ]),
      );
      return productId;
    });

    const productId = create();
    refreshStore(`/producto/${slug}`);
    revalidatePath("/admin/productos");
    redirect(`/admin/productos/${productId}?creado=1`);
  });
}

/**
 * Publica el catálogo completo por niveles: económico, estándar y premium de
 * cada combinación red + servicio, con los textos que explican en qué se
 * diferencian. Se puede repetir cuantas veces se quiera.
 */
export async function generarNiveles(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await guard();
  const platform = String(formData.get("platform") ?? "").trim() || undefined;
  const publicar = formData.get("borrador") ? false : true;
  const reemplazar = formData.get("conservar") ? false : true;

  const r = publicarNiveles({ publicar, platform, reemplazar });
  refreshStore();
  revalidatePath("/admin/productos");

  if (!r.creados && !r.actualizados) {
    return { error: "No se encontraron servicios publicables. Sincroniza el catálogo del proveedor." };
  }
  return {
    ok:
      `${r.combinaciones} combinaciones revisadas: ${r.creados} productos nuevos, ` +
      `${r.actualizados} actualizados` +
      (r.reemplazados ? `, ${r.reemplazados} productos antiguos ocultos por quedar duplicados` : "") +
      (r.retirados ? `, ${r.retirados} despublicados porque su nivel ya no existe` : "") +
      (r.sinNiveles ? `. ${r.sinNiveles} combinaciones tienen un solo servicio, así que no llevan niveles` : "") +
      ".",
  };
}

/**
 * Crea un producto en blanco a partir de un servicio suelto del proveedor.
 *
 * Si ese servicio ya tiene un producto, no se crea otro: se abre el que existe.
 * Antes esto reventaba con un error de servidor porque el enlace del producto
 * se derivaba del número de servicio y chocaba consigo mismo.
 */
export async function createFromService(formData: FormData) {
  await withErrorRedirect("/admin/catalogo", async () => {
    await guard();
    const serviceId = Number(formData.get("service_id"));
    const service = get<{
      service_id: number; clean_name: string; platform: string; service_type: string;
      min_qty: number; max_qty: number; avg_minutes: number | null; order_kind: string;
    }>("SELECT * FROM provider_services WHERE service_id = ?", [serviceId]);
    if (!service) redirect("/admin/catalogo?error=Ese+servicio+ya+no+existe+en+el+cat%C3%A1logo.");

    const existing = get<{ id: number }>(
      "SELECT id FROM products WHERE provider_service_id = ? ORDER BY id LIMIT 1",
      [serviceId],
    );
    if (existing) redirect(`/admin/productos/${existing.id}?ya-existia=1`);

    const slug = uniqueSlug(`${service.service_type}-${service.platform}-${service.service_id}`);
    const name = service.clean_name.trim().slice(0, 90) || `Servicio ${service.service_id}`;

    const create = db.transaction(() => {
      const info = db.prepare(
        `INSERT INTO products
           (slug, name, platform, service_type, provider_service_id, short_description,
            image_url, min_qty, max_qty, auto_select, published, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 100)`,
      ).run(
        slug,
        name,
        service.platform,
        service.service_type,
        service.service_id,
        "",
        `/img/productos/${service.platform}-${service.service_type}.svg`,
        service.min_qty,
        service.max_qty,
        // Un servicio elegido a mano se respeta: no lo reemplazamos por otro.
        0,
      );

      const productId = Number(info.lastInsertRowid);
      const ladder = [100, 250, 500, 1000, 2500, 5000]
        .filter((q) => q >= service.min_qty && q <= service.max_qty)
        .slice(0, 6);
      const rows = ladder.length ? ladder : [Math.max(1, service.min_qty)];
      const popular = Math.min(2, rows.length - 1);
      rows.forEach((q, i) =>
        run("INSERT INTO product_tiers (product_id, quantity, popular, sort_order) VALUES (?, ?, ?, ?)", [
          productId, q, i === popular ? 1 : 0, i,
        ]),
      );
      return productId;
    });

    const productId = create();
    revalidatePath("/admin/productos");
    revalidatePath("/admin/catalogo");
    redirect(`/admin/productos/${productId}?creado=1`);
  });
}

// ------------------------------------------------------------------ pedidos
export async function orderAction(formData: FormData) {
  const id = Number(formData.get("order_id"));
  // Volvemos a la ficha del pedido, que es donde están los botones: si el envío
  // falla, el motivo tiene que verse ahí y no en la lista.
  await withErrorRedirect(`/admin/pedidos/${id}`, async () => {
    await guard();
    const action = String(formData.get("action"));

    if (action === "send") {
      const result = await sendToProvider(id);
      // Antes el error se perdía en silencio y el pedido seguía "pendiente de
      // envío" sin que nada lo explicara.
      if (!result.ok) throw new Error(result.error);
    } else if (action === "mark_paid") {
      const referencia = String(formData.get("admin_note") ?? "").trim();
      await markPaid(id, referencia || "manual");
    } else if (action === "sent_manual") {
      markDispatchedManually(id, String(formData.get("admin_note") ?? "").trim() || undefined);
    } else if (action === "note") {
      const note = String(formData.get("admin_note") ?? "").trim();
      run("UPDATE orders SET admin_note = ?, updated_at = datetime('now') WHERE id = ?", [note, id]);
    } else if (action === "status") {
      const status = String(formData.get("status")) as OrderStatus;
      // Cambiar el estado a mano también pone el pago al día y, si el pedido
      // queda pagado y sin despachar, lo manda al proveedor en el acto.
      const sent = await setStatusManual(id, status);
      if (sent && !sent.ok) throw new Error(sent.error);
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
  });
}

/** Reintenta de una todos los pedidos pagados que no salieron. */
export async function retryStuckOrders(_prev: ActionState): Promise<ActionState> {
  await guard();
  const { intentados, enviados } = await retryUndispatched(50);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
  if (intentados === 0) return { ok: "No hay pedidos pendientes de enviar." };
  if (enviados === 0) {
    return {
      error: `Ninguno de los ${intentados} pedidos pudo enviarse. Revisa el saldo del proveedor y el detalle de un pedido para ver el motivo exacto.`,
    };
  }
  return { ok: `Enviados ${enviados} de ${intentados} pedidos pendientes.` };
}

export async function syncOrders() {
  await guard();
  await syncOpenOrders(200);
  revalidatePath("/admin/pedidos");
  revalidatePath("/admin");
}

/**
 * Corrige el destino de un pedido.
 *
 * Es lo que pasa cuando el cliente pega mal su usuario: hasta ahora había que
 * cancelar y rehacer. Si el pedido todavía no salió se cambia y ya está; si ya
 * salió, no se toca, porque el destino real está en manos de la entrega y
 * cambiarlo aquí solo serviría para no saber a dónde se mandó.
 */
export async function editarDestino(formData: FormData) {
  const id = Number(formData.get("order_id"));
  await withErrorRedirect(`/admin/pedidos/${id}`, async () => {
    await guard();
    const order = get<{ link: string; provider_order_id: number | null; manual_dispatch_at: string | null }>(
      "SELECT link, provider_order_id, manual_dispatch_at FROM orders WHERE id = ?",
      [id],
    );
    if (!order) throw new Error("Pedido no encontrado.");
    if (order.provider_order_id || order.manual_dispatch_at) {
      throw new Error("El pedido ya salió a entrega: el destino no se puede cambiar.");
    }

    const link = String(formData.get("link") ?? "").trim();
    if (!link) throw new Error("Escribe el nuevo destino.");
    if (link === order.link) return;

    run("UPDATE orders SET link = ?, updated_at = datetime('now') WHERE id = ?", [link, id]);
    logEvent(id, "info", `Destino corregido desde el panel: ${order.link} → ${link}`);
    revalidatePath(`/admin/pedidos/${id}`);
  });
}

// ------------------------------------------------------------ panel mayorista

/** Ajusta el saldo de un cliente a mano, con su motivo. */
export async function ajustarSaldo(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await guard();
  const userId = Number(formData.get("user_id"));
  const monto = Number(String(formData.get("monto") ?? "").replace(/[^\d-]/g, ""));
  const nota = String(formData.get("nota") ?? "").trim();
  if (!Number.isFinite(monto) || monto === 0) return { error: "Escribe un monto distinto de cero." };
  if (!nota) return { error: "Escribe el motivo del ajuste: queda en el historial del cliente." };

  const result = movimiento({ userId, kind: "ajuste", amountClp: monto, note: nota });
  if (!result.ok) return { error: result.error };
  revalidatePath(`/admin/mayoristas/${userId}`);
  revalidatePath("/admin/mayoristas");
  return { ok: `Saldo ajustado. Nuevo saldo: ${formatClp(result.balance)}.` };
}

export async function cambiarEstadoMayorista(formData: FormData) {
  const userId = Number(formData.get("user_id"));
  await withErrorRedirect(`/admin/mayoristas/${userId}`, async () => {
    await guard();
    const accion = String(formData.get("accion"));
    if (accion === "bloquear" || accion === "activar") {
      run("UPDATE reseller_users SET status = ? WHERE id = ?", [
        accion === "bloquear" ? "blocked" : "active",
        userId,
      ]);
      // Un cliente bloqueado no puede seguir usando una sesión abierta.
      if (accion === "bloquear") run("DELETE FROM reseller_sessions WHERE user_id = ?", [userId]);
    } else if (accion === "descuento") {
      const valor = Math.min(90, Math.max(0, Number(formData.get("descuento")) || 0));
      run("UPDATE reseller_users SET discount_percent = ? WHERE id = ?", [valor, userId]);
    } else if (accion === "nota") {
      run("UPDATE reseller_users SET admin_note = ? WHERE id = ?", [
        String(formData.get("nota") ?? "").slice(0, 1000),
        userId,
      ]);
    }
    revalidatePath(`/admin/mayoristas/${userId}`);
  });
}

/** Confirma o rechaza una recarga por transferencia. */
export async function resolverRecarga(formData: FormData) {
  await withErrorRedirect("/admin/recargas", async () => {
    await guard();
    const id = Number(formData.get("topup_id"));
    const accion = String(formData.get("accion"));
    if (accion === "acreditar") {
      const result = acreditar(id, String(formData.get("referencia") ?? "").trim() || "transferencia");
      if (!result.ok) throw new Error(result.error);
    } else if (accion === "rechazar") {
      rechazar(id, String(formData.get("referencia") ?? "").trim() || "Rechazada por el administrador");
    }
    revalidatePath("/admin/recargas");
    revalidatePath("/admin");
  });
}

/** Devuelve al saldo un pedido del panel que no se va a entregar. */
export async function reembolsarPedido(formData: FormData) {
  const id = Number(formData.get("order_id"));
  await withErrorRedirect(`/admin/pedidos/${id}`, async () => {
    await guard();
    const result = reembolsar(id, String(formData.get("motivo") ?? "").trim() || "Pedido no entregado");
    if (!result.ok) throw new Error(result.error ?? "No se pudo reembolsar.");
    revalidatePath(`/admin/pedidos/${id}`);
    revalidatePath("/admin/pedidos");
  });
}

/** Responde un ticket del panel y, si corresponde, lo cierra. */
export async function responderTicket(formData: FormData) {
  const id = Number(formData.get("ticket_id"));
  await withErrorRedirect(`/admin/tickets/${id}`, async () => {
    await guard();
    const accion = String(formData.get("accion") ?? "responder");
    const cuerpo = String(formData.get("body") ?? "").trim();

    if (accion === "cerrar") {
      if (cuerpo) agregarMensaje(id, "admin", cuerpo);
      cerrarTicket(id);
    } else if (accion === "reabrir") {
      reabrirTicket(id);
    } else if (cuerpo) {
      agregarMensaje(id, "admin", cuerpo);
    }

    // La respuesta también sale por correo: el cliente de la tienda no tiene
    // panel donde volver a mirar.
    if (cuerpo) {
      const ticket = ticketPorId(id);
      if (ticket) {
        const pedido = ticket.order_id
          ? get<{ code: string }>("SELECT code FROM orders WHERE id = ?", [ticket.order_id])
          : undefined;
        await notificarRespuestaTicket({
          to: contactoDeTicket(ticket),
          code: ticket.code,
          subject: ticket.subject,
          mensaje: cuerpo,
          orderCode: pedido?.code ?? null,
          url: ticket.user_id
            ? absoluteUrl(`/panel/tickets/${ticket.code}`)
            : absoluteUrl(`/pedido/${pedido?.code ?? ""}#soporte`),
        });
      }
    }
    revalidatePath(`/admin/tickets/${id}`);
    revalidatePath("/admin/tickets");
  });
}

/** Pide al proveedor la reposición del pedido de un ticket. */
export async function reposicionDesdeTicket(formData: FormData) {
  const id = Number(formData.get("ticket_id"));
  await withErrorRedirect(`/admin/tickets/${id}`, async () => {
    await guard();
    const orderId = Number(formData.get("order_id"));
    const order = get<{ provider_order_id: number | null; code: string }>(
      "SELECT provider_order_id, code FROM orders WHERE id = ?",
      [orderId],
    );
    if (!order?.provider_order_id) throw new Error("Ese pedido nunca salió al proveedor.");

    try {
      const result = await provider.refill(order.provider_order_id);
      logEvent(orderId, "refill", `Reposición solicitada al proveedor (ID ${result.refill}).`);
      agregarMensaje(id, "admin", `Pedimos la reposición al proveedor (referencia ${result.refill}).`);
    } catch (error) {
      const mensaje = (error as Error).message;
      logEvent(orderId, "error", `No se pudo pedir la reposición: ${mensaje}`);
      throw new Error(`El proveedor rechazó la reposición: ${mensaje}`);
    }
    revalidatePath(`/admin/tickets/${id}`);
  });
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

  // La API de servicios no devuelve el tiempo promedio, así que conservamos el
  // que ya teníamos: es mejor señal de velocidad que el nombre del servicio.
  const knownAvg = new Map(
    all<{ service_id: number; avg_minutes: number | null }>(
      "SELECT service_id, avg_minutes FROM provider_services WHERE avg_minutes IS NOT NULL",
    ).map((row) => [row.service_id, row.avg_minutes]),
  );

  const upsert = db.prepare(`
    INSERT INTO provider_services
      (service_id, name, clean_name, category, platform, service_type, rate_usd_per_1000,
       min_qty, max_qty, refill, cancel, refill_days, drop_score, speed_score, geo, variant,
       order_kind, start_minutes, provider_enabled, synced_at)
    VALUES (@service_id, @name, @clean_name, @category, @platform, @service_type, @rate,
            @min_qty, @max_qty, @refill, @cancel, @refill_days, @drop_score, @speed_score,
            @geo, @variant, @order_kind, @start_minutes, 1, datetime('now'))
    ON CONFLICT(service_id) DO UPDATE SET
      name = excluded.name, clean_name = excluded.clean_name, category = excluded.category,
      platform = excluded.platform, service_type = excluded.service_type,
      rate_usd_per_1000 = excluded.rate_usd_per_1000,
      min_qty = excluded.min_qty, max_qty = excluded.max_qty,
      refill = excluded.refill, cancel = excluded.cancel,
      refill_days = excluded.refill_days, drop_score = excluded.drop_score,
      speed_score = excluded.speed_score, geo = excluded.geo, variant = excluded.variant,
      order_kind = excluded.order_kind, start_minutes = excluded.start_minutes,
      provider_enabled = 1, synced_at = datetime('now')
  `);

  const seen: number[] = [];
  const apply = db.transaction(() => {
    for (const row of rows) {
      const serviceId = Number(row.service);
      if (!serviceId) continue;
      seen.push(serviceId);
      const clean = normalizeText(row.name);
      const days = refillDaysFromName(clean);
      const serviceType = detectServiceType(row.name, row.category);
      upsert.run({
        service_id: serviceId,
        name: row.name,
        clean_name: clean,
        category: normalizeText(row.category) || String(row.category ?? ""),
        platform: detectPlatform(row.name, row.category),
        service_type: serviceType,
        rate: Number(row.rate) || 0,
        min_qty: Number(row.min) || 1,
        max_qty: Number(row.max) || 1000,
        refill: row.refill ? 1 : 0,
        cancel: row.cancel ? 1 : 0,
        refill_days: days,
        drop_score: dropScore(clean, days || (row.refill ? 30 : 0)),
        speed_score: speedScore(clean, knownAvg.get(serviceId) ?? null),
        geo: detectGeo(clean),
        variant: detectVariant(clean),
        // El campo `type` de la API manda: dice si el servicio espera texto,
        // un número de opción o simplemente una cantidad.
        order_kind: orderKindFromApiType(row.type, clean, serviceType),
        start_minutes: startMinutesFromName(clean),
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

  // Con los niveles automáticos activos, cada sincronización reacomoda el
  // catálogo solo: si el proveedor dio de baja el servicio que estaba detrás
  // del premium, el premium pasa a apuntar al mejor que quedó.
  let niveles = "";
  if (getBoolSetting("auto_levels", false)) {
    const r = publicarNiveles({ publicar: true });
    niveles = ` Niveles al día: ${r.creados} nuevos, ${r.actualizados} actualizados.`;
  }

  refreshStore();
  revalidatePath("/admin/catalogo");
  revalidatePath("/admin/productos");

  return {
    ok: `Catálogo sincronizado: ${seen.length} servicios activos, ${disabled} dados de baja.` +
      niveles +
      (affected ? ` Atención: ${affected} producto(s) publicado(s) apuntan a servicios que el proveedor desactivó.` : ""),
  };
}

/**
 * Vuelve a puntuar todo el catálogo a partir del nombre de cada servicio.
 * Sirve después de una actualización, o si las clasificaciones quedaron viejas.
 */
export async function rescoreCatalog(_prev: ActionState): Promise<ActionState> {
  await guard();
  const total = rescoreServices();
  // Los productos guardan el plazo con el que se publicaron: si el recálculo
  // cambió lo que sabemos, hay que actualizarlos o seguirán prometiendo lo que
  // ya no es verdad.
  const etiquetas = refrescarEtiquetasDeEntrega();
  refreshStore();
  revalidatePath("/admin/catalogo");
  return {
    ok:
      `Recalculados ${total} servicios.` +
      (etiquetas ? ` Se actualizó el plazo de entrega de ${etiquetas} producto(s).` : ""),
  };
}

/** Guarda o borra el texto SEO propio de una página. */
export async function saveSeoText(_prev: ActionState, formData: FormData): Promise<ActionState> {
  await guard();
  const clave = String(formData.get("clave") ?? "");
  // seo_text_<red> y seo_text_<red>_<tipo>, que es la página de categoría.
  if (!/^seo_text_[a-z0-9-]{2,30}(_[a-z0-9-]{2,30})?$|^seo_home_text$/.test(clave)) {
    return { error: "Página desconocida." };
  }
  const html = sanitizeHtml(String(formData.get("html") ?? "").trim());
  setSettings({ [clave]: html });
  refreshStore();
  revalidatePath("/admin/seo");
  return { ok: html ? "Texto guardado. Esta página ya no usa el automático." : "Texto borrado: vuelve al automático." };
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
  await withErrorRedirect("/admin/cupones", async () => {
    await guard();
    run("DELETE FROM coupons WHERE code = ?", [String(formData.get("code"))]);
    revalidatePath("/admin/cupones");
  });
}

