import "server-only";
import { all, get, run } from "../db";
import { logEvent, getOrderByCode, retryUndispatched, syncOpenOrders, sendToProvider } from "../orders";
import { publicarNiveles } from "../autolevels";
import { provider, providerConfigured, ProviderError } from "../provider";
import { rescoreServices } from "../db";
import { agregarMensaje } from "../tickets";
import { guardarCatalogo } from "../catalog-sync";
import { revalidatePath } from "next/cache";
import type { Ticket } from "../types";

/**
 * Lo que el MCP puede cambiar.
 *
 * El corte es deliberado: aquí está lo que se puede deshacer o repetir sin
 * consecuencias —sincronizar, republicar, reintentar, despublicar— y no está
 * nada que mueva dinero. Reembolsar un pedido y ajustar el saldo de un
 * mayorista siguen siendo del panel, con una persona mirando.
 *
 * Todo lo que pasa por aquí queda anotado con autor `mcp`, para que después se
 * pueda revisar qué se hizo sin una persona presente.
 */

/** La tienda se recalcula sola, pero las páginas cacheadas hay que avisarles. */
function refrescarTienda() {
  for (const ruta of ["/", "/catalogo", "/admin/productos", "/admin/catalogo"]) {
    revalidatePath(ruta);
  }
}

/** Deja rastro de cada operación, en el pedido cuando lo hay y siempre en el log. */
function anotar(orderId: number | null, accion: string, detalle: string) {
  if (orderId) logEvent(orderId, "mcp", `${accion}: ${detalle}`);
  run(
    "INSERT INTO mcp_log (accion, detalle, order_id) VALUES (?, ?, ?)",
    [accion, detalle, orderId],
  );
}

export function bitacora(limite = 50) {
  const n = Math.min(Math.max(limite, 1), 200);
  return all("SELECT * FROM mcp_log ORDER BY id DESC LIMIT ?", [n]);
}

// ------------------------------------------------------------------ catálogo

export async function sincronizarCatalogo() {
  if (!providerConfigured()) {
    return { ok: false as const, error: "Falta la API key del proveedor." };
  }

  let rows;
  try {
    rows = await provider.services();
  } catch (error) {
    return {
      ok: false as const,
      error: error instanceof ProviderError
        ? `El proveedor respondió: ${error.message}`
        : "No se pudo conectar con el proveedor.",
    };
  }
  if (!Array.isArray(rows)) {
    return { ok: false as const, error: "El proveedor devolvió una respuesta inesperada." };
  }

  const resultado = guardarCatalogo(rows);
  anotar(null, "sincronizar_catalogo", `${resultado.activos} activos, ${resultado.bajas} de baja`);
  refrescarTienda();
  return { ok: true as const, ...resultado };
}

export function republicarNiveles(platform?: string) {
  const r = publicarNiveles({ publicar: true, platform });
  anotar(null, "publicar_niveles", `${r.creados} nuevos, ${r.actualizados} actualizados${platform ? ` (${platform})` : ""}`);
  refrescarTienda();
  return r;
}

export function recalcularCalidad() {
  const total = rescoreServices();
  anotar(null, "recalcular_calidad", `${total} servicios`);
  refrescarTienda();
  return { servicios: total };
}

export function cambiarPublicacion(productId: number, publicar: boolean) {
  const producto = get<{ id: number; name: string; published: number }>(
    "SELECT id, name, published FROM products WHERE id = ?",
    [productId],
  );
  if (!producto) return { ok: false, error: "No existe ese producto." };

  run("UPDATE products SET published = ?, updated_at = datetime('now') WHERE id = ?", [
    publicar ? 1 : 0,
    productId,
  ]);
  anotar(null, publicar ? "publicar_producto" : "despublicar_producto", `#${productId} ${producto.name}`);
  refrescarTienda();
  return { ok: true, producto: producto.name, publicado: publicar };
}

// ------------------------------------------------------------------- pedidos

export async function reintentarAtascados(limite = 25) {
  const r = await retryUndispatched(Math.min(Math.max(limite, 1), 50));
  anotar(null, "reintentar_atascados", `${r.enviados} de ${r.intentados} salieron`);
  return r;
}

export async function actualizarEstados(limite = 200) {
  const r = await syncOpenOrders(Math.min(Math.max(limite, 1), 300));
  anotar(null, "actualizar_estados", `${r.checked} consultados, ${r.updated} cambiaron`);
  return r;
}

/**
 * Despachar un pedido concreto.
 *
 * Solo pagados: despachar uno sin pagar es regalar la entrega, y ningún
 * análisis automático debería poder hacerlo.
 */
export async function despacharPedido(code: string) {
  const order = getOrderByCode(code);
  if (!order) return { ok: false, error: "No existe ese pedido." };
  if (order.payment_status !== "paid") {
    return { ok: false, error: "Ese pedido no está pagado." };
  }
  if (order.provider_order_id) {
    return { ok: false, error: "Ese pedido ya salió a entrega." };
  }

  const r = await sendToProvider(order.id);
  anotar(order.id, "despachar_pedido", r.ok ? "enviado" : `falló: ${r.error}`);
  return r.ok ? { ok: true, code: order.code } : { ok: false, error: r.error };
}

// ------------------------------------------------------------------- soporte

export async function responderTicketMcp(code: string, texto: string) {
  const ticket = get<Ticket>("SELECT * FROM tickets WHERE code = ?", [code.trim().toUpperCase()]);
  if (!ticket) return { ok: false, error: "No existe ese ticket." };

  const cuerpo = texto.trim();
  if (cuerpo.length < 5) return { ok: false, error: "La respuesta es demasiado corta." };

  // `agregarMensaje` ya deja el ticket en "respondido" cuando escribe el dueño.
  agregarMensaje(ticket.id, "admin", cuerpo);
  anotar(ticket.order_id, "responder_ticket", `${ticket.code}: ${cuerpo.slice(0, 120)}`);
  return { ok: true, ticket: ticket.code };
}
