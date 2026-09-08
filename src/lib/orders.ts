import "server-only";
import { db, get, run, all } from "./db";
import { getProductById } from "./catalog";
import { pricingContext, priceCustomQuantity, costUsd, minutosDeEntrega } from "./pricing";
import { provider, mapProviderStatus, ProviderError, providerConfigured } from "./provider";
import { getBoolSetting } from "./settings";
import { orderCode } from "./utils";
import { pickService } from "./routing";
import {
  notificarPagoConfirmado, notificarPedidoCompletado, notificarPedidoTrabado,
  notificarVentaPagada,
} from "./notify";
import { necesitaPublicacion, revisarDestinos } from "./targets";
import type { Order, OrderStatus, OrderTarget } from "./types";

/** Comentarios escritos por el cliente: una línea por comentario, sin vacías. */
export function cleanComments(raw: string): string[] {
  return raw
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 5000);
}

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

/** Los destinos de un pedido, en el orden en que los pidió el cliente. */
export function orderTargets(orderId: number): OrderTarget[] {
  return all<OrderTarget>(
    "SELECT * FROM order_targets WHERE order_id = ? ORDER BY position, id",
    [orderId],
  );
}

/**
 * Garantiza que el pedido tenga sus destinos en la tabla.
 *
 * Los pedidos anteriores a esta tabla —y los del panel mayorista, que se
 * insertan por su cuenta— traen el destino en `orders.link`. Se les crea una
 * fila con lo que ya tienen, incluido el pedido del proveedor si ya salió,
 * para que el despacho y la sincronización tengan un solo camino.
 */
export function ensureTargets(order: Order): OrderTarget[] {
  const existentes = orderTargets(order.id);
  if (existentes.length) return existentes;

  run(
    `INSERT INTO order_targets
       (order_id, position, link, quantity, comments, provider_service_id,
        provider_order_id, provider_status, start_count, remains, status)
     VALUES (?, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    [
      order.id, order.link, order.quantity, order.comments,
      order.provider_service_id, order.provider_order_id, order.provider_status,
      order.start_count, order.remains,
      order.provider_order_id ? order.status : "pending",
    ],
  );
  return orderTargets(order.id);
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
  /**
   * Cantidad por destino. Con una sola publicación (o con el perfil) es la
   * cantidad del pedido; repartido entre varias, es lo que recibe cada una.
   */
  quantity: number;
  link: string;
  /**
   * Publicaciones entre las que se reparte el pedido. Manda sobre `link`
   * cuando viene con algo. Cada una recibe `quantity` y sale al proveedor como
   * un pedido suyo, que es la única forma que tiene de entregarlas.
   */
  links?: string[];
  /** Solo para servicios de comentarios personalizados: uno por línea. */
  comments?: string;
  email: string;
  phone?: string;
  couponCode?: string;
  ip?: string;
  /** "flow" cobra en línea; "transferencia" queda esperando tu confirmación. */
  paymentProvider?: "flow" | "transferencia";
};

export type CreateOrderResult =
  | { ok: true; order: Order }
  | { ok: false; error: string };

export function createOrder(input: CreateOrderInput): CreateOrderResult {
  const product = getProductById(input.productId);
  if (!product || product.published !== 1) return { ok: false, error: "El producto ya no está disponible." };

  const min = Math.max(product.min_qty, product.provider_min);
  const max = Math.min(product.max_qty, product.provider_max);

  // En los comentarios personalizados manda el texto: la cantidad es cuántas
  // líneas escribió el cliente, no un número que él elija aparte.
  const isCustomComments = product.order_kind === "custom_comments";
  const commentLines = isCustomComments ? cleanComments(input.comments ?? "") : [];
  if (isCustomComments && commentLines.length === 0) {
    return { ok: false, error: "Escribe al menos un comentario, uno por línea." };
  }

  // Destinos: uno solo, o varias publicaciones entre las que se reparte. Se
  // revisan contra el tipo de servicio, así que un enlace de perfil en un
  // servicio de me gusta se rechaza aquí y no en el proveedor con el pedido
  // ya cobrado.
  const crudos = input.links?.length ? input.links : [input.link];
  const revision = revisarDestinos(
    crudos, product.platform, product.service_type, product.order_kind,
  );
  if (!revision.ok) return { ok: false, error: revision.error };
  const links = revision.links;

  if (links.length > 1 && !necesitaPublicacion(product.service_type, product.order_kind)) {
    return {
      ok: false,
      error: "Este servicio va a una sola cuenta: no se puede repartir entre varios destinos.",
    };
  }
  if (links.length > 1 && isCustomComments) {
    return {
      ok: false,
      error: "Los comentarios personalizados van a una sola publicación. Haz un pedido por cada una.",
    };
  }

  // La cantidad es por destino: los límites del proveedor se aplican a cada
  // pedido suyo, y cada publicación es uno.
  const porDestino = isCustomComments ? commentLines.length : Math.round(input.quantity);

  if (!Number.isFinite(porDestino) || porDestino < min || porDestino > max) {
    return {
      ok: false,
      error: isCustomComments
        ? `Tienes que escribir entre ${min} y ${max} comentarios (uno por línea). Escribiste ${porDestino}.`
        : links.length > 1
          ? `Cada publicación tiene que llevar entre ${min} y ${max}.`
          : `La cantidad debe estar entre ${min} y ${max}.`,
    };
  }

  const quantity = porDestino * links.length;

  // El servicio definitivo se elige al despachar, pero comprobamos ya que
  // exista al menos uno capaz de atenderlo: así no cobramos algo que no
  // podemos entregar.
  const routed = pickService(
    {
      platform: product.platform,
      serviceType: product.service_type,
      // La que ve el proveedor es la de cada destino: sus mínimos y máximos
      // se aplican a cada pedido suyo, no al total repartido.
      quantity: porDestino,
      referenceServiceId: product.provider_service_id,
      referenceRateUsd: product.rate_usd_per_1000,
      maxCostRatio: product.max_cost_ratio,
      variant: product.variant,
      orderKind: product.order_kind,
      // El plazo que vio el cliente en la ficha: nadie más lento que eso.
      promisedMinutes: minutosDeEntrega({
        avg_minutes: product.avg_minutes,
        start_minutes: product.start_minutes,
      }),
    },
    product.auto_select === 1,
  );
  if (!routed) return { ok: false, error: "Este servicio está temporalmente pausado. Inténtalo más tarde." };

  const ctx = pricingContext();
  // El precio se recalcula aquí en el servidor: nunca confiamos en el del
  // formulario. Se calcula por destino y se multiplica: repartir 500 me gusta
  // entre tres publicaciones cuesta tres veces el pack de 500, que es
  // exactamente lo que le cuesta a la tienda.
  const tier = get<{ price_clp: number | null }>(
    "SELECT price_clp FROM product_tiers WHERE product_id = ? AND quantity = ?",
    [product.id, porDestino],
  );
  const unitario =
    product.price_mode === "manual" && tier?.price_clp != null
      ? tier.price_clp
      : priceCustomQuantity(porDestino, product, product.rate_usd_per_1000, ctx);
  const base = unitario * links.length;

  const coupon = input.couponCode ? applyCoupon(input.couponCode, base) : null;
  const amount = base - (coupon?.discountClp ?? 0);

  const code = uniqueCode();
  const info = run(
    `INSERT INTO orders
       (code, product_id, product_name, provider_service_id, reference_service_id, quantity,
        link, comments, email, phone, amount_clp, discount_clp, coupon_code, cost_usd,
        payment_provider, status, payment_status, ip)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', 'pending', ?)`,
    [
      code, product.id, product.name, routed.service.service_id, product.provider_service_id,
      quantity, links[0], commentLines.length ? commentLines.join("\n") : null,
      input.email.trim().toLowerCase(), input.phone?.trim() || null,
      amount, coupon?.discountClp ?? 0, coupon?.code ?? null,
      costUsd(routed.service.rate_usd_per_1000, quantity),
      input.paymentProvider ?? "flow", input.ip ?? null,
    ],
  );

  const order = getOrderById(Number(info.lastInsertRowid))!;

  // Un destino por publicación. Cada uno sale al proveedor por separado.
  const comentarios = commentLines.length ? commentLines.join("\n") : null;
  links.forEach((link, i) =>
    run(
      "INSERT INTO order_targets (order_id, position, link, quantity, comments) VALUES (?, ?, ?, ?, ?)",
      [order.id, i, link, porDestino, comentarios],
    ),
  );

  logEvent(
    order.id,
    "created",
    `Pedido creado por ${amount.toLocaleString("es-CL")} CLP` +
      (links.length > 1
        ? `, repartido entre ${links.length} publicaciones (${porDestino.toLocaleString("es-CL")} en cada una)`
        : "") +
      (order.payment_provider === "transferencia" ? ", a pagar por transferencia." : "."),
  );
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

/**
 * Estados que solo pueden existir si el pedido está pagado.
 *
 * Cambiar el estado a mano y dejar el pago en "pendiente" dejaba el pedido en
 * un limbo: no aparecía el botón de enviar, `sendToProvider` lo rechazaba por
 * no estar pagado y el reintento automático tampoco lo tomaba. Es decir, se
 * quedaba pendiente de envío para siempre.
 */
const ESTADOS_PAGADOS: OrderStatus[] = ["paid", "processing", "completed", "partial"];

/** Marca el pago a mano sin tocar el estado ni despachar nada. */
function marcarPagadoSinEnviar(orderId: number, motivo: string) {
  run(
    `UPDATE orders
        SET payment_status = 'paid',
            payment_ref = COALESCE(payment_ref, 'manual'),
            paid_at = COALESCE(paid_at, datetime('now')),
            updated_at = datetime('now')
      WHERE id = ?`,
    [orderId],
  );
  logEvent(orderId, "paid", motivo);
}

/**
 * Cambio de estado hecho a mano desde el panel.
 *
 * Además de guardar el estado, sincroniza el pago (un pedido "En proceso" no
 * puede estar impago) y, si queda pagado y sin despachar, lo manda al
 * proveedor en el mismo gesto. Devuelve el resultado del envío cuando lo hubo,
 * para poder mostrar el error en pantalla en vez de tragárselo.
 */
export async function setStatusManual(
  orderId: number,
  status: OrderStatus,
): Promise<SendResult | null> {
  const order = getOrderById(orderId);
  if (!order) return { ok: false, error: "Pedido no encontrado." };

  if (ESTADOS_PAGADOS.includes(status) && order.payment_status !== "paid") {
    marcarPagadoSinEnviar(
      orderId,
      `Pago dado por recibido a mano al cambiar el estado a "${ORDER_STATUS_LABEL[status]}".`,
    );
  }
  setStatus(orderId, status, `Estado cambiado a mano desde el panel: ${ORDER_STATUS_LABEL[status]}.`);

  if (status === "completed" || status === "partial") {
    await notificarPedidoCompletado(getOrderById(orderId)!, status === "partial");
  }

  // Poner "En proceso", "Entrega parcial" o "Completado" en un pedido que
  // nunca salió del panel solo puede significar que lo despachaste tú: se
  // registra como envío manual para que deje de figurar como pendiente.
  if (
    ["processing", "completed", "partial"].includes(status) &&
    !order.provider_order_id &&
    !order.manual_dispatch_at
  ) {
    markDispatchedManually(orderId);
    return null;
  }

  // "Pagado" es justamente el estado de "pagado y todavía sin enviar": si no
  // salió nunca, lo intentamos ahora.
  const fresh = getOrderById(orderId)!;
  if (
    status === "paid" &&
    !fresh.provider_order_id &&
    !fresh.manual_dispatch_at &&
    getBoolSetting("auto_send_to_provider", true)
  ) {
    return await sendToProvider(orderId);
  }
  return null;
}

/**
 * Deja constancia de que el pedido lo despachaste tú, fuera del panel.
 *
 * Sirve para los pedidos que se le pasan al proveedor a mano (o que se
 * entregan por otra vía): sin esto quedaban para siempre en "pagados sin
 * enviar" y el cron seguía intentando mandarlos.
 */
export function markDispatchedManually(orderId: number, referencia?: string): void {
  const order = getOrderById(orderId);
  if (!order) return;
  if (order.payment_status !== "paid") {
    marcarPagadoSinEnviar(orderId, "Pago dado por recibido a mano al registrar el envío manual.");
  }
  run(
    `UPDATE orders
        SET manual_dispatch_at = COALESCE(manual_dispatch_at, datetime('now')),
            provider_error = NULL,
            status = CASE WHEN status IN ('pending', 'paid') THEN 'processing' ELSE status END,
            updated_at = datetime('now')
      WHERE id = ?`,
    [orderId],
  );
  logEvent(
    orderId,
    "sent",
    `Enviado a mano, fuera del panel${referencia ? ` (${referencia})` : ""}. Ya no cuenta como pendiente de envío.`,
  );
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
  logEvent(
    orderId,
    "paid",
    order.payment_provider === "transferencia"
      ? `Transferencia confirmada a mano${paymentRef && paymentRef !== "manual" ? ` (${paymentRef})` : ""}.`
      : `Pago confirmado (referencia ${paymentRef}).`,
  );

  const pagado = getOrderById(orderId)!;
  await notificarPagoConfirmado(pagado);
  await notificarVentaPagada(pagado);

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
      orderKind: product.order_kind,
      // El plazo que vio el cliente en la ficha: nadie más lento que eso.
      promisedMinutes: minutosDeEntrega({
        avg_minutes: product.avg_minutes,
        start_minutes: product.start_minutes,
      }),
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
  // Con el pedido repartido entre publicaciones, "ya salió" significa que
  // salieron todas: si una quedó en el camino hay que volver por ella.
  const yaEnviados = ensureTargets(order).filter((t) => t.provider_order_id);
  if (yaEnviados.length && yaEnviados.length === orderTargets(orderId).length) {
    return { ok: true, providerOrderId: yaEnviados[0].provider_order_id! };
  }
  if (order.manual_dispatch_at) {
    return { ok: false, error: "Este pedido figura como enviado a mano: no se vuelve a mandar al proveedor." };
  }
  if (order.payment_status !== "paid") {
    return {
      ok: false,
      error:
        "El pedido aún no está pagado. Confirma el pago (o cambia el estado a “Pagado”) y vuelve a intentarlo.",
    };
  }
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

  // Una publicación, un pedido del proveedor: es la única forma en que sabe
  // entregar. Los que ya salieron no se vuelven a mandar, así que reintentar
  // un pedido a medio despachar solo manda lo que falta.
  const pendientes = orderTargets(orderId).filter((t) => !t.provider_order_id);
  const total = orderTargets(orderId).length;
  const enviados: number[] = [];
  let fallo: string | null = null;

  for (const destino of pendientes) {
    try {
      // Los comentarios personalizados van como texto y sin "quantity": el
      // proveedor cuenta las líneas.
      const response = await provider.addOrder(
        destino.comments
          ? { service: serviceId, link: destino.link, comments: destino.comments }
          : { service: serviceId, link: destino.link, quantity: destino.quantity },
      );
      const providerOrderId = Number(response.order);
      if (!providerOrderId) throw new ProviderError("El proveedor no devolvió un número de pedido.");

      run(
        `UPDATE order_targets
            SET provider_order_id = ?, provider_service_id = ?, provider_status = 'In progress',
                provider_error = NULL, status = 'processing', updated_at = datetime('now')
          WHERE id = ?`,
        [providerOrderId, serviceId, destino.id],
      );
      enviados.push(providerOrderId);
      logEvent(
        orderId,
        "sent",
        total > 1
          ? `Publicación ${destino.position + 1} de ${total} enviada al proveedor, ` +
            `servicio #${serviceId} (pedido ${providerOrderId}): ${destino.link}`
          : `Enviado al proveedor, servicio #${serviceId} (pedido ${providerOrderId}).`,
      );
    } catch (error) {
      const message = error instanceof Error ? error.message : "Error desconocido del proveedor.";
      fallo = message;
      run(
        "UPDATE order_targets SET provider_error = ?, updated_at = datetime('now') WHERE id = ?",
        [message, destino.id],
      );
      logEvent(
        orderId,
        "error",
        (total > 1 ? `Publicación ${destino.position + 1} de ${total}: ` : "") +
          (isFundsError(message)
            ? `Sin saldo en el proveedor: ${message}. Se reintenta solo al recargar.`
            : `No se pudo enviar al proveedor: ${message}`),
      );
      // Sin saldo el resto va a fallar igual: no gastamos más llamadas.
      if (isFundsError(message)) break;
    }
  }

  refrescarDesdeDestinos(orderId);

  if (!enviados.length) {
    const message = fallo ?? "El proveedor no aceptó el pedido.";
    // Plata cobrada sin entregar: el dueño se entera por correo, una sola vez
    // por pedido, sin tener que estar mirando el panel.
    await notificarPedidoTrabado(order, message);
    return { ok: false, error: message };
  }

  if (fallo) {
    // Parte salió y parte no: el pedido queda en curso, con lo que falta
    // pendiente para el reintento automático.
    await notificarPedidoTrabado(order, fallo);
    return { ok: false, error: fallo };
  }

  return { ok: true, providerOrderId: enviados[0] };
}

/**
 * Vuelve a calcular el estado del pedido a partir de sus destinos.
 *
 * El pedido que ve el cliente es uno solo aunque por dentro sean tres pedidos
 * del proveedor: aquí se suma lo entregado, se elige el estado que representa
 * al conjunto y se deja en `orders` para que todo lo demás —el panel, el
 * seguimiento, los correos— siga leyendo un pedido y no una lista.
 */
export function refrescarDesdeDestinos(orderId: number): Order | undefined {
  const order = getOrderById(orderId);
  if (!order) return undefined;
  const destinos = orderTargets(orderId);
  if (!destinos.length) return order;

  const enviados = destinos.filter((t) => t.provider_order_id);
  const errores = destinos
    .filter((t) => !t.provider_order_id && t.provider_error)
    .map((t) => (destinos.length > 1 ? `Publicación ${t.position + 1}: ${t.provider_error}` : t.provider_error!));

  // Lo que queda por entregar solo se sabe de los que ya salieron; los que no
  // salieron cuentan completos como pendientes.
  const conRemains = enviados.filter((t) => t.remains != null);
  const remains =
    enviados.length && conRemains.length === enviados.length
      ? conRemains.reduce((sum, t) => sum + (t.remains ?? 0), 0) +
        destinos.filter((t) => !t.provider_order_id).reduce((sum, t) => sum + t.quantity, 0)
      : null;
  const startCount = conRemains.length
    ? enviados.reduce((sum, t) => sum + (t.start_count ?? 0), 0)
    : null;

  const estados = destinos.map((t) => (t.provider_order_id ? t.status : "pending"));
  const terminales = ["completed", "partial", "canceled", "refunded"];
  let status: OrderStatus = order.status;
  if (enviados.length) {
    if (estados.every((e) => e === "completed")) status = "completed";
    else if (estados.every((e) => terminales.includes(e))) {
      status = estados.some((e) => e === "completed" || e === "partial") ? "partial" : order.status;
    } else status = "processing";
  }

  run(
    `UPDATE orders
        SET provider_order_id = ?, provider_status = ?, provider_error = ?,
            start_count = ?, remains = ?, status = ?, updated_at = datetime('now')
      WHERE id = ?`,
    [
      enviados[0]?.provider_order_id ?? null,
      enviados[0]?.provider_status ?? null,
      errores.length ? errores.join(" · ") : null,
      startCount,
      remains,
      status,
      orderId,
    ],
  );
  return getOrderById(orderId);
}

/** ¿El proveedor rechazó el pedido por falta de saldo? */
export function isFundsError(message: string): boolean {
  return /not enough funds|insufficient|balance|saldo|fondos/i.test(message);
}

/**
 * Pedidos que el cliente pagó pero que nunca salieron al proveedor.
 *
 * Es el estado más peligroso de la tienda: la plata ya se cobró y no se está
 * entregando nada. Pasa sobre todo cuando el proveedor se queda sin saldo.
 */
export function undispatchedOrders(limit = 100): Order[] {
  return all<Order>(
    `SELECT * FROM orders o
      WHERE o.payment_status = 'paid'
        AND o.manual_dispatch_at IS NULL
        AND o.status NOT IN ('canceled', 'refunded')
        -- Sin destinos todavía, o con alguna publicación que no salió: un
        -- pedido repartido está a medio entregar hasta que salen todas.
        AND (o.provider_order_id IS NULL
             OR EXISTS (SELECT 1 FROM order_targets t
                         WHERE t.order_id = o.id AND t.provider_order_id IS NULL))
      ORDER BY o.paid_at ASC LIMIT ?`,
    [limit],
  );
}

/**
 * Reintenta enviar los pedidos pagados que quedaron sin despachar. Lo llama el
 * cron, así que en cuanto recargas el saldo salen solos, sin tocar nada.
 */
export async function retryUndispatched(limit = 25): Promise<{ intentados: number; enviados: number }> {
  if (!providerConfigured()) return { intentados: 0, enviados: 0 };
  const pending = undispatchedOrders(limit);
  let enviados = 0;

  for (const order of pending) {
    const result = await sendToProvider(order.id);
    if (result.ok) {
      enviados++;
      continue;
    }
    // Si es falta de saldo, el resto va a fallar igual: no insistimos.
    if (isFundsError(result.error)) break;
  }
  return { intentados: pending.length, enviados };
}

/** Consulta al proveedor el estado de los pedidos en curso y los actualiza. */
export async function syncOpenOrders(limit = 100): Promise<{ checked: number; updated: number }> {
  // Se consulta por destino, no por pedido: un pedido repartido entre tres
  // publicaciones son tres pedidos del proveedor, cada uno con su avance.
  const open = all<{ id: number; order_id: number; provider_order_id: number }>(
    `SELECT t.id, t.order_id, t.provider_order_id
       FROM order_targets t
       JOIN orders o ON o.id = t.order_id
      WHERE t.provider_order_id IS NOT NULL
        AND t.status IN ('processing', 'paid', 'partial', 'pending')
        AND o.status IN ('processing', 'paid', 'partial')
      ORDER BY t.updated_at ASC LIMIT ?`,
    [limit],
  );
  if (!open.length || !providerConfigured()) return { checked: 0, updated: 0 };

  const byProviderId = new Map(open.map((t) => [String(t.provider_order_id), t]));
  const pedidos = new Set(open.map((t) => t.order_id));
  let updated = 0;

  for (let i = 0; i < open.length; i += 100) {
    const batch = open.slice(i, i + 100).map((t) => t.provider_order_id);
    try {
      const statuses = await provider.multiStatus(batch);
      for (const [providerId, info] of Object.entries(statuses)) {
        const destino = byProviderId.get(providerId);
        if (!destino || !info || info.error) continue;
        const status = mapProviderStatus(info.status);
        run(
          `UPDATE order_targets SET status = ?, provider_status = ?, start_count = ?, remains = ?,
                  updated_at = datetime('now')
            WHERE id = ?`,
          [
            status,
            info.status ?? null,
            info.start_count != null ? Number(info.start_count) : null,
            info.remains != null ? Number(info.remains) : null,
            destino.id,
          ],
        );
      }
    } catch {
      // Un fallo puntual del proveedor no debe romper la sincronización completa.
    }
  }

  // Recién ahora se resume cada pedido: el cliente ve uno solo, con la suma de
  // lo entregado en todas sus publicaciones.
  for (const orderId of pedidos) {
    const antes = getOrderById(orderId);
    const despues = refrescarDesdeDestinos(orderId);
    if (!antes || !despues || antes.status === despues.status) continue;
    logEvent(orderId, despues.status, `Estado actualizado por el proveedor: ${despues.provider_status ?? despues.status}.`);
    updated++;
    if (despues.status === "completed" || despues.status === "partial") {
      await notificarPedidoCompletado(despues, despues.status === "partial");
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

/** Transferencias que el cliente dice haber hecho y esperan tu confirmación. */
export function transferenciasPendientes(limit = 100): Order[] {
  return all<Order>(
    `SELECT * FROM orders
      WHERE payment_provider = 'transferencia' AND payment_status = 'pending'
        AND status NOT IN ('canceled', 'refunded')
      ORDER BY (transfer_notified_at IS NULL), created_at ASC
      LIMIT ?`,
    [limit],
  );
}

export function orderStats() {
  return {
    transferenciasPorConfirmar: get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM orders
        WHERE payment_provider = 'transferencia' AND payment_status = 'pending'
          AND status NOT IN ('canceled', 'refunded')`,
    )?.n ?? 0,
    transferenciasAvisadas: get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM orders
        WHERE payment_provider = 'transferencia' AND payment_status = 'pending'
          AND transfer_notified_at IS NOT NULL
          AND status NOT IN ('canceled', 'refunded')`,
    )?.n ?? 0,
    // Pagados que nunca salieron, o que salieron a medias: plata cobrada sin
    // entregar. Un pedido repartido cuenta mientras le falte una publicación.
    sinEnviar: get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM orders o
        WHERE o.payment_status = 'paid'
          AND o.manual_dispatch_at IS NULL
          AND o.status NOT IN ('canceled', 'refunded')
          AND (o.provider_order_id IS NULL
               OR EXISTS (SELECT 1 FROM order_targets t
                           WHERE t.order_id = o.id AND t.provider_order_id IS NULL))`,
    )?.n ?? 0,
    sinEnviarClp: get<{ v: number }>(
      `SELECT COALESCE(SUM(o.amount_clp), 0) AS v FROM orders o
        WHERE o.payment_status = 'paid'
          AND o.manual_dispatch_at IS NULL
          AND o.status NOT IN ('canceled', 'refunded')
          AND (o.provider_order_id IS NULL
               OR EXISTS (SELECT 1 FROM order_targets t
                           WHERE t.order_id = o.id AND t.provider_order_id IS NULL))`,
    )?.v ?? 0,
    sinSaldo: get<{ n: number }>(
      `SELECT COUNT(*) AS n FROM orders
        WHERE payment_status = 'paid' AND provider_order_id IS NULL
          AND manual_dispatch_at IS NULL
          AND provider_error IS NOT NULL
          AND (provider_error LIKE '%funds%' OR provider_error LIKE '%balance%'
               OR provider_error LIKE '%saldo%' OR provider_error LIKE '%insufficient%')`,
    )?.n ?? 0,
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
