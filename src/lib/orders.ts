import "server-only";
import { db, get, run, all } from "./db";
import { getProductById } from "./catalog";
import { pricingContext, priceCustomQuantity, costUsd } from "./pricing";
import { provider, mapProviderStatus, ProviderError, providerConfigured } from "./provider";
import { getBoolSetting } from "./settings";
import { orderCode } from "./utils";
import { pickService } from "./routing";
import type { Order, OrderStatus } from "./types";

export function logEvent(orderId: number, type: string, message: string) {
  run("INSERT INTO order_events (order_id, type, message) VALUES (?, ?, ?)", [orderId, type, message]);
}

export function getOrderByCode(code: string): Order | undefined {
  return get<Order>("SELECT * FROM orders WHERE code = ?", [code.trim().toUpperCase()]);
}

export function getOrderById(id: number): Order | undefined {
  return get<Order>("SELECT * FROM orders WHERE id = ?", [id]);
}

export function getOrderEvents(orderId: number) {
  return all<{ id: number; type: string; message: string; created_at: string }>(
    "SELECT id, type, message, created_at FROM order_events WHERE order_id = ? ORDER BY id DESC",
    [orderId],
  );
}

export type CouponResult = { code: string; discountClp: number } | null;

export function applyCoupon(rawCode: string, amountClp: number): CouponResult {
  const code = rawCode.trim().toUpperCase();
  if (!code) return null;
  const coupon = get<{
    code: string; kind: string; value: number; min_clp: number;
    max_uses: number; used: number; active: number; expires_at: string | null;
  }>("SELECT * FROM coupons WHERE code = ?", [code]);
  if (!coupon || coupon.active !== 1) return null;
  if (coupon.expires_at && new Date(coupon.expires_at) < new Date()) return null;
  if (coupon.max_uses > 0 && coupon.used >= coupon.max_uses) return null;
  if (amountClp < coupon.min_clp) return null;

  const discount = coupon.kind === "fixed"
    ? Math.min(coupon.value, amountClp)
    : Math.round((amountClp * coupon.value) / 100);
  // Nunca dejamos el pedido en cero: siempre queda al menos $100.
  return { code: coupon.code, discountClp: Math.max(0, Math.min(discount, amountClp - 100)) };
}

export type CreateOrderInput = {
  productId: number;
  quantity: number;
  link: string;
  email: string;
  phone?: string;
  couponCode?: string;
  ip?: string;
};

export type CreateOrderResult =
  | { ok: true; order: Order }
  | { ok: false; error: string };

export function createOrder(input: CreateOrderInput): CreateOrderResult {
  const product = getProductById(input.productId);
  if (!product || product.published !== 1) return { ok: false, error: "El producto ya no está disponible." };

  const min = Math.max(product.min_qty, product.provider_min);
  const max = Math.min(product.max_qty, product.provider_max);
  const quantity = Math.round(input.quantity);
  if (!Number.isFinite(quantity) || quantity < min || quantity > max) {
    return { ok: false, error: `La cantidad debe estar entre ${min} y ${max}.` };
  }

  // El servicio definitivo se elige al despachar, pero comprobamos ya que
  // exista al menos uno capaz de atenderlo: así no cobramos algo que no
  // podemos entregar.
  const routed = pickService(
    {
      platform: product.platform,
      serviceType: product.service_type,
      quantity,
      referenceServiceId: product.provider_service_id,
      referenceRateUsd: product.rate_usd_per_1000,
      maxCostRatio: product.max_cost_ratio,
      variant: product.variant,
    },
    product.auto_select === 1,
  );
  if (!routed) return { ok: false, error: "Este servicio está temporalmente pausado. Inténtalo más tarde." };

  const ctx = pricingContext();
  // El precio se recalcula aquí en el servidor: nunca confiamos en el del formulario.
  const tier = get<{ price_clp: number | null }>(
    "SELECT price_clp FROM product_tiers WHERE product_id = ? AND quantity = ?",
    [product.id, quantity],
  );
  const base =
    product.price_mode === "manual" && tier?.price_clp != null
      ? tier.price_clp
      : priceCustomQuantity(quantity, product, product.rate_usd_per_1000, ctx);

  const coupon = input.couponCode ? applyCoupon(input.couponCode, base) : null;
  const amount = base - (coupon?.discountClp ?? 0);

  const code = uniqueCode();
  const info = run(
    `INSERT INTO orders
       (code, product_id, product_name, provider_service_id, reference_service_id, quantity,
        link, email, phone, amount_clp, discount_clp, coupon_code, cost_usd,
        status, payment_status, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?)`,
    [
      code, product.id, product.name, routed.service.service_id, product.provider_service_id,
      quantity, input.link.trim(), input.email.trim().toLowerCase(), input.phone?.trim() || null,
      amount, coupon?.discountClp ?? 0, coupon?.code ?? null,
      costUsd(routed.service.rate_usd_per_1000, quantity), input.ip ?? null,
    ],
  );

  const order = getOrderById(Number(info.lastInsertRowid))!;
  logEvent(order.id, "created", `Pedido creado por ${amount.toLocaleString("es-CL")} CLP.`);
  if (coupon) run("UPDATE coupons SET used = used + 1 WHERE code = ?", [coupon.code]);
  return { ok: true, order };
}

function uniqueCode(): string {
  for (let i = 0; i < 12; i++) {
    const code = orderCode();
    if (!get("SELECT 1 FROM orders WHERE code = ?", [code])) return code;
  }
  return `TS-${Date.now().toString(36).toUpperCase()}`;
}

export function setStatus(orderId: number, status: OrderStatus, message?: string) {
  run("UPDATE orders SET status = ?, updated_at = datetime('now') WHERE id = ?", [status, orderId]);
  if (message) logEvent(orderId, status, message);
}

/** Marca el pedido como pagado y, si corresponde, lo envía al proveedor. */
export async function markPaid(orderId: number, paymentRef: string): Promise<void> {
  const order = getOrderById(orderId);
  if (!order) return;
  if (order.payment_status === "paid") return; // idempotente: Flow reintenta la confirmación

  run(
    `UPDATE orders SET payment_status = 'paid', status = 'paid', payment_ref = ?,
            paid_at = datetime('now'), updated_at = datetime('now')
      WHERE id = ?`,
    [paymentRef, orderId],
  );
  logEvent(orderId, "paid", `Pago confirmado (referencia ${paymentRef}).`);

  if (getBoolSetting("auto_send_to_provider", true)) {
    await sendToProvider(orderId);
  }
}

export type SendResult = { ok: true; providerOrderId: number } | { ok: false; error: string };

/**
 * Decide a qué servicio del proveedor se le pide el pedido en el momento del
 * despacho, y deja constancia si cambió respecto de lo elegido al comprar.
 */
function resolveDispatchService(order: Order): number {
  const product = order.product_id ? getProductById(order.product_id) : undefined;
  if (!product) return order.provider_service_id;

  const routed = pickService(
    {
      platform: product.platform,
      serviceType: product.service_type,
      quantity: order.quantity,
      referenceServiceId: order.reference_service_id ?? product.provider_service_id,
      referenceRateUsd: product.rate_usd_per_1000,
      maxCostRatio: product.max_cost_ratio,
      variant: product.variant,
    },
    product.auto_select === 1,
  );
  if (!routed) return order.provider_service_id;

  if (routed.service.service_id !== order.provider_service_id) {
    run(
      "UPDATE orders SET provider_service_id = ?, cost_usd = ?, updated_at = datetime('now') WHERE id = ?",
      [
        routed.service.service_id,
        (routed.service.rate_usd_per_1000 / 1000) * order.quantity,
        order.id,
      ],
    );
    logEvent(
      order.id,
      "routing",
      `Servicio reasignado al #${routed.service.service_id}. ${routed.reason}`,
    );
  }
  return routed.service.service_id;
}

/** Envía el pedido al proveedor. Es seguro llamarlo dos veces. */
export async function sendToProvider(orderId: number): Promise<SendResult> {
  const order = getOrderById(orderId);
  if (!order) return { ok: false, error: "Pedido no encontrado." };
  if (order.provider_order_id) return { ok: true, providerOrderId: order.provider_order_id };
  if (order.payment_status !== "paid") return { ok: false, error: "El pedido aún no está pagado." };
  if (!providerConfigured()) {
    const message = "Falta configurar la API key del proveedor.";
    run("UPDATE orders SET provider_error = ?, updated_at = datetime('now') WHERE id = ?", [message, orderId]);
    logEvent(orderId, "error", message);
    return { ok: false, error: message };
  }

  // Volvemos a elegir el servicio justo antes de enviarlo: entre que el cliente
  // pagó y este momento el proveedor pudo haber desactivado uno o haber
  // habilitado otro mejor.
  const serviceId = resolveDispatchService(order);

  try {
    const response = await provider.addOrder({
      service: serviceId,
      link: order.link,
      quantity: order.quantity,
    });
    const providerOrderId = Number(response.order);
    if (!providerOrderId) throw new ProviderError("El proveedor no devolvió un número de pedido.");

    run(
      `UPDATE orders SET provider_order_id = ?, status = 'processing', provider_status = 'In progress',
              provider_error = NULL, updated_at = datetime('now')
        WHERE id = ?`,
      [providerOrderId, orderId],
    );
    logEvent(orderId, "sent", `Enviado al proveedor, servicio #${serviceId} (pedido ${providerOrderId}).`);
    return { ok: true, providerOrderId };
  } catch (error) {
    const message = error instanceof Error ? error.message : "Error desconocido del proveedor.";
    run("UPDATE orders SET provider_error = ?, updated_at = datetime('now') WHERE id = ?", [message, orderId]);
    logEvent(orderId, "error", `No se pudo enviar al proveedor: ${message}`);
    return { ok: false, error: message };
  }
}

/** Consulta al proveedor el estado de los pedidos en curso y los actualiza. */
export async function syncOpenOrders(limit = 100): Promise<{ checked: number; updated: number }> {
  const open = all<{ id: number; provider_order_id: number }>(
    `SELECT id, provider_order_id FROM orders
      WHERE provider_order_id IS NOT NULL
        AND status IN ('processing', 'paid', 'partial')
      ORDER BY updated_at ASC LIMIT ?`,
    [limit],
  );
  if (!open.length || !providerConfigured()) return { checked: 0, updated: 0 };

  const byProviderId = new Map(open.map((o) => [String(o.provider_order_id), o.id]));
  let updated = 0;

  for (let i = 0; i < open.length; i += 100) {
    const batch = open.slice(i, i + 100).map((o) => o.provider_order_id);
    try {
      const statuses = await provider.multiStatus(batch);
      for (const [providerId, info] of Object.entries(statuses)) {
        const orderId = byProviderId.get(providerId);
        if (!orderId || !info || info.error) continue;
        const status = mapProviderStatus(info.status);
        const current = getOrderById(orderId);
        run(
          `UPDATE orders SET status = ?, provider_status = ?, start_count = ?, remains = ?,
                  updated_at = datetime('now')
            WHERE id = ?`,
          [
            status,
            info.status ?? null,
            info.start_count != null ? Number(info.start_count) : null,
            info.remains != null ? Number(info.remains) : null,
            orderId,
          ],
        );
        if (current && current.status !== status) {
          logEvent(orderId, status, `Estado actualizado por el proveedor: ${info.status}.`);
          updated++;
        }
      }
    } catch {
      // Un fallo puntual del proveedor no debe romper la sincronización completa.
    }
  }
  return { checked: open.length, updated };
}

export const ORDER_STATUS_LABEL: Record<OrderStatus, string> = {
  pending: "Esperando pago",
  paid: "Pagado",
  processing: "En proceso",
  completed: "Completado",
  partial: "Entrega parcial",
  canceled: "Cancelado",
  failed: "Con problema",
  refunded: "Reembolsado",
};

export const ORDER_STATUS_TONE: Record<OrderStatus, string> = {
  pending: "bg-amber-500/15 text-amber-300 border-amber-500/30",
  paid: "bg-sky-500/15 text-sky-300 border-sky-500/30",
  processing: "bg-brand-500/20 text-brand-300 border-brand-400/30",
  completed: "bg-lime-500/15 text-lime-400 border-lime-500/30",
  partial: "bg-orange-500/15 text-orange-300 border-orange-500/30",
  canceled: "bg-white/8 text-ink-200 border-white/15",
  failed: "bg-red-500/15 text-red-300 border-red-500/30",
  refunded: "bg-white/8 text-ink-200 border-white/15",
};

export function orderStats() {
  return {
    total: get<{ n: number }>("SELECT COUNT(*) AS n FROM orders")?.n ?? 0,
    paid: get<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE payment_status = 'paid'")?.n ?? 0,
    pending: get<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE status = 'pending'")?.n ?? 0,
    processing: get<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE status IN ('processing','paid','partial')")?.n ?? 0,
    revenue: get<{ v: number }>("SELECT COALESCE(SUM(amount_clp), 0) AS v FROM orders WHERE payment_status = 'paid'")?.v ?? 0,
    cost: get<{ v: number }>("SELECT COALESCE(SUM(cost_usd), 0) AS v FROM orders WHERE payment_status = 'paid'")?.v ?? 0,
    today: get<{ n: number }>("SELECT COUNT(*) AS n FROM orders WHERE date(created_at) = date('now')")?.n ?? 0,
    revenueToday: get<{ v: number }>(
      "SELECT COALESCE(SUM(amount_clp), 0) AS v FROM orders WHERE payment_status = 'paid' AND date(paid_at) = date('now')",
    )?.v ?? 0,
  };
}

export { db };
