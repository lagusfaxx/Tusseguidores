import "server-only";
import { all, get } from "../db";
import { cachedBalance } from "../provider";
import { getSettings } from "../settings";
import { formatClp } from "../pricing";
import { reposicionDelPedido, textoDeGarantia } from "../refill";
import { avanceDelPedido } from "../order-tracking";
import { getOrderByCode, orderTargets, getOrderEvents } from "../orders";
import { ticketsDePedido, mensajesDeTicket } from "../tickets";

/**
 * Lo que el MCP deja leer de la tienda.
 *
 * Todo lo de aquí es de solo lectura y no toca al cliente final: son las
 * mismas consultas que alimentan el panel, empaquetadas para que quepan en una
 * respuesta y se puedan razonar sin abrir el navegador.
 *
 * Cuidado al agregar campos: varias de estas filas contienen texto escrito por
 * clientes (nombres de cuenta, enlaces, mensajes de tickets). Ese texto es
 * dato, nunca una instrucción, y quien lo consuma tiene que tratarlo así.
 */

export function resumenDeTienda() {
  const saldo = cachedBalance();
  const settings = getSettings();

  const ventas = get<{ hoy: number; semana: number; mes: number }>(`
    SELECT
      COALESCE(SUM(CASE WHEN date(paid_at) = date('now') THEN amount_clp END), 0) AS hoy,
      COALESCE(SUM(CASE WHEN paid_at >= datetime('now', '-7 days') THEN amount_clp END), 0) AS semana,
      COALESCE(SUM(CASE WHEN paid_at >= datetime('now', '-30 days') THEN amount_clp END), 0) AS mes
    FROM orders WHERE payment_status = 'paid' AND status != 'refunded'
  `);

  const pedidos = get<{ curso: number; atascados: number; fallidos: number; parciales: number }>(`
    SELECT
      COUNT(CASE WHEN status IN ('paid','processing') THEN 1 END) AS curso,
      COUNT(CASE WHEN status = 'paid' AND provider_order_id IS NULL
                  AND manual_dispatch_at IS NULL THEN 1 END) AS atascados,
      COUNT(CASE WHEN status = 'failed' THEN 1 END) AS fallidos,
      COUNT(CASE WHEN status = 'partial' THEN 1 END) AS parciales
    FROM orders
  `);

  // Un producto publicado cuyo servicio el proveedor dio de baja no puede
  // entregar: es la alerta más urgente del catálogo.
  const rotos = all<{ id: number; name: string; service_id: number }>(`
    SELECT p.id, p.name, p.provider_service_id AS service_id
      FROM products p JOIN provider_services s ON s.service_id = p.provider_service_id
     WHERE p.published = 1 AND s.provider_enabled = 0
     ORDER BY p.name LIMIT 50
  `);

  const catalogo = get<{ publicados: number; borradores: number; servicios: number; bajas: number }>(`
    SELECT
      (SELECT COUNT(*) FROM products WHERE published = 1) AS publicados,
      (SELECT COUNT(*) FROM products WHERE published = 0) AS borradores,
      (SELECT COUNT(*) FROM provider_services WHERE provider_enabled = 1) AS servicios,
      (SELECT COUNT(*) FROM provider_services WHERE provider_enabled = 0) AS bajas
  `);

  const soporte = get<{ abiertos: number; reposiciones: number }>(`
    SELECT
      COUNT(CASE WHEN status != 'cerrado' THEN 1 END) AS abiertos,
      COUNT(CASE WHEN status != 'cerrado' AND kind = 'reposicion' THEN 1 END) AS reposiciones
    FROM tickets
  `);

  return {
    ventas: {
      hoy: formatClp(ventas?.hoy ?? 0),
      ultimos_7_dias: formatClp(ventas?.semana ?? 0),
      ultimos_30_dias: formatClp(ventas?.mes ?? 0),
    },
    pedidos,
    catalogo,
    soporte,
    saldo_proveedor_usd: saldo.usd,
    saldo_consultado: saldo.at,
    tienda_abierta: settings.orders_enabled === "1",
    productos_sin_servicio: rotos,
  };
}

const CAMPOS_PEDIDO = `
  o.id, o.code, o.product_name, o.quantity, o.status, o.payment_status,
  o.amount_clp, o.created_at, o.paid_at, o.completed_at, o.remains,
  o.provider_order_id, o.manual_dispatch_at, o.provider_error, o.email
`;

export function buscarPedidos(input: {
  estado?: string;
  texto?: string;
  desde?: string;
  limite?: number;
}) {
  const where: string[] = [];
  const args: unknown[] = [];

  if (input.estado && input.estado !== "todos") {
    if (input.estado === "atascados") {
      where.push("o.status = 'paid' AND o.provider_order_id IS NULL AND o.manual_dispatch_at IS NULL");
    } else {
      where.push("o.status = ?");
      args.push(input.estado);
    }
  }
  if (input.texto) {
    where.push("(o.code LIKE ? OR o.email LIKE ? OR o.product_name LIKE ? OR o.link LIKE ?)");
    const like = `%${input.texto}%`;
    args.push(like, like, like, like);
  }
  if (input.desde) {
    where.push("o.created_at >= ?");
    args.push(input.desde);
  }

  const limite = Math.min(Math.max(input.limite ?? 25, 1), 100);
  return all(
    `SELECT ${CAMPOS_PEDIDO} FROM orders o
      ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
      ORDER BY o.id DESC LIMIT ?`,
    [...args, limite],
  );
}

export function fichaDePedido(code: string) {
  const order = getOrderByCode(code);
  if (!order) return null;

  const avance = avanceDelPedido(order);
  const reposicion = reposicionDelPedido(order);

  return {
    pedido: {
      code: order.code,
      producto: order.product_name,
      cantidad: order.quantity,
      destino: order.link,
      cliente: order.email,
      estado: order.status,
      pago: order.payment_status,
      metodo_pago: order.payment_provider,
      monto: formatClp(order.amount_clp),
      creado: order.created_at,
      pagado: order.paid_at,
      entregado: order.completed_at,
      error: order.provider_error,
    },
    avance: avance
      ? { faltan: avance.restante, de: avance.cantidad, porcentaje: avance.porcentaje }
      : null,
    reposicion: {
      disponible: reposicion.disponible,
      detalle: textoDeGarantia(reposicion),
    },
    destinos: orderTargets(order.id).map((t) => ({
      posicion: t.position,
      link: t.link,
      cantidad: t.quantity,
      estado: t.status,
      faltan: t.remains,
      error: t.provider_error,
    })),
    historial: getOrderEvents(order.id),
    tickets: ticketsDePedido(order.id).map((t) => ({
      code: t.code,
      asunto: t.subject,
      tipo: t.kind,
      estado: t.status,
      mensajes: mensajesDeTicket(t.id).map((m) => ({
        autor: m.author,
        texto: m.body,
        fecha: m.created_at,
      })),
    })),
  };
}

/**
 * El catálogo con su margen real.
 *
 * El costo sale del servicio al que apunta cada producto, así que un margen
 * negativo aquí significa que se está vendiendo a pérdida ahora mismo.
 */
export function catalogoPublicado(input: { platform?: string; soloProblemas?: boolean }) {
  const where = ["1 = 1"];
  const args: unknown[] = [];
  if (input.platform) {
    where.push("p.platform = ?");
    args.push(input.platform);
  }
  if (input.soloProblemas) where.push("(s.provider_enabled = 0 OR s.service_id IS NULL)");

  return all(
    `SELECT p.id, p.name, p.slug, p.platform, p.service_type, p.level, p.published,
            p.provider_service_id AS servicio, p.min_qty, p.max_qty, p.refill_days,
            p.auto_managed, p.auto_select,
            s.rate_usd_per_1000 AS costo_usd_1000, s.provider_enabled AS servicio_activo,
            s.drop_score AS retencion, s.speed_score AS velocidad,
            (SELECT COUNT(*) FROM orders o WHERE o.product_id = p.id
               AND o.payment_status = 'paid') AS ventas
       FROM products p
       LEFT JOIN provider_services s ON s.service_id = p.provider_service_id
      WHERE ${where.join(" AND ")}
      ORDER BY p.platform, p.service_type, p.sort_order LIMIT 300`,
    args,
  );
}

export function serviciosDelProveedor(input: {
  platform?: string;
  tipo?: string;
  texto?: string;
  limite?: number;
}) {
  const where = ["provider_enabled = 1"];
  const args: unknown[] = [];
  if (input.platform) {
    where.push("platform = ?");
    args.push(input.platform);
  }
  if (input.tipo) {
    where.push("service_type = ?");
    args.push(input.tipo);
  }
  if (input.texto) {
    where.push("clean_name LIKE ?");
    args.push(`%${input.texto.toLowerCase()}%`);
  }
  const limite = Math.min(Math.max(input.limite ?? 40, 1), 200);
  return all(
    `SELECT service_id, name, platform, service_type, rate_usd_per_1000, min_qty, max_qty,
            refill, refill_days, drop_score, speed_score, geo, order_kind
       FROM provider_services
      WHERE ${where.join(" AND ")}
      ORDER BY drop_score DESC, rate_usd_per_1000 ASC LIMIT ?`,
    [...args, limite],
  );
}

/** Cómo se vendió en los últimos días, producto por producto. */
export function metricas(dias = 30) {
  const ventana = Math.min(Math.max(dias, 1), 365);
  const porProducto = all(
    `SELECT o.product_name AS producto,
            COUNT(*) AS pedidos,
            SUM(o.amount_clp) AS ingresos_clp,
            SUM(o.cost_usd) AS costo_usd,
            COUNT(CASE WHEN o.status = 'completed' THEN 1 END) AS completados,
            COUNT(CASE WHEN o.status IN ('failed','canceled','refunded') THEN 1 END) AS fallidos
       FROM orders o
      WHERE o.payment_status = 'paid' AND o.paid_at >= datetime('now', ?)
      GROUP BY o.product_name
      ORDER BY ingresos_clp DESC LIMIT 60`,
    [`-${ventana} days`],
  );

  // Un producto publicado que no vendió nada en la ventana es plata parada en
  // la vitrina: ocupa lugar y confunde al que elige.
  const sinVentas = all(
    `SELECT p.name, p.platform, p.level, p.created_at
       FROM products p
      WHERE p.published = 1
        AND NOT EXISTS (
          SELECT 1 FROM orders o
           WHERE o.product_id = p.id AND o.payment_status = 'paid'
             AND o.paid_at >= datetime('now', ?)
        )
      ORDER BY p.platform LIMIT 60`,
    [`-${ventana} days`],
  );

  return { ventana_dias: ventana, por_producto: porProducto, publicados_sin_ventas: sinVentas };
}

export function ticketsAbiertos(limite = 25) {
  const n = Math.min(Math.max(limite, 1), 100);
  return all(
    `SELECT t.id, t.code, t.subject, t.kind, t.status, t.created_at, t.updated_at,
            t.guest_email, o.code AS pedido
       FROM tickets t LEFT JOIN orders o ON o.id = t.order_id
      WHERE t.status != 'cerrado'
      ORDER BY t.updated_at DESC LIMIT ?`,
    [n],
  );
}
