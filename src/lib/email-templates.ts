import "server-only";
import { formatClp, formatNumber } from "./pricing";
import { absoluteUrl } from "./seo";
import { getSetting } from "./settings";
import { datosTransferencia } from "./transfer";
import type { Order } from "./types";

/**
 * Los correos que manda la tienda.
 *
 * HTML plano con estilos en línea y una versión en texto: los clientes de
 * correo no cargan hojas de estilo y varios ni siquiera muestran el HTML.
 * Nada de imágenes remotas, para que no se vea roto con las imágenes
 * bloqueadas (que es lo normal en Gmail).
 */

export type EmailContent = { subject: string; html: string; text: string };

function escape(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

const COLOR = { texto: "#1c1917", suave: "#57534e", borde: "#e7e5e4", marca: "#7c3aed" };

function layout(opciones: {
  titulo: string;
  intro: string;
  filas?: [string, string][];
  aviso?: string;
  cta?: { texto: string; url: string };
  cierre?: string;
}): string {
  const tienda = getSetting("site_name", "TusSeguidores");
  const contacto = getSetting("contact_email", "");

  const filas = (opciones.filas ?? [])
    .filter(([, valor]) => valor)
    .map(
      ([etiqueta, valor]) =>
        `<tr>
           <td style="padding:8px 0;color:${COLOR.suave};font-size:14px;">${escape(etiqueta)}</td>
           <td style="padding:8px 0;color:${COLOR.texto};font-size:14px;font-weight:600;text-align:right;">${escape(valor)}</td>
         </tr>`,
    )
    .join("");

  return `<!doctype html>
<html lang="es"><body style="margin:0;padding:24px 12px;background:#faf9f7;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;color:${COLOR.texto};">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid ${COLOR.borde};border-radius:14px;">
    <tr><td style="padding:28px 28px 0;">
      <p style="margin:0;font-size:13px;font-weight:700;letter-spacing:.08em;text-transform:uppercase;color:${COLOR.marca};">${escape(tienda)}</p>
      <h1 style="margin:12px 0 0;font-size:21px;line-height:1.3;">${escape(opciones.titulo)}</h1>
      <p style="margin:12px 0 0;font-size:15px;line-height:1.6;color:${COLOR.suave};">${opciones.intro}</p>
    </td></tr>
    ${filas
      ? `<tr><td style="padding:20px 28px 0;">
           <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="border-top:1px solid ${COLOR.borde};">${filas}</table>
         </td></tr>`
      : ""}
    ${opciones.aviso
      ? `<tr><td style="padding:20px 28px 0;">
           <p style="margin:0;padding:12px 14px;background:#f5f3ff;border:1px solid #ddd6fe;border-radius:10px;font-size:14px;line-height:1.6;color:${COLOR.texto};">${opciones.aviso}</p>
         </td></tr>`
      : ""}
    ${opciones.cta
      ? `<tr><td style="padding:24px 28px 0;">
           <a href="${escape(opciones.cta.url)}" style="display:inline-block;padding:12px 20px;background:${COLOR.marca};color:#ffffff;font-size:15px;font-weight:600;text-decoration:none;border-radius:10px;">${escape(opciones.cta.texto)}</a>
         </td></tr>`
      : ""}
    <tr><td style="padding:24px 28px 28px;">
      ${opciones.cierre ? `<p style="margin:0 0 14px;font-size:14px;line-height:1.6;color:${COLOR.suave};">${opciones.cierre}</p>` : ""}
      <p style="margin:0;padding-top:16px;border-top:1px solid ${COLOR.borde};font-size:13px;line-height:1.6;color:${COLOR.suave};">
        ${contacto ? `¿Dudas? Respóndenos este correo o escríbenos a ${escape(contacto)}.` : "¿Dudas? Responde este mismo correo."}
      </p>
    </td></tr>
  </table>
</body></html>`;
}

/**
 * Arma la versión en texto plano. Descarta las líneas apagadas (un dato que
 * la tienda no tiene configurado) pero conserva las vacías: son los renglones
 * en blanco que separan los bloques.
 */
function texto(lineas: (string | false | null | undefined)[]): string {
  return lineas
    .filter((linea): linea is string => typeof linea === "string")
    .join("\n")
    .replace(/<[^>]+>/g, "");
}

function seguimiento(order: Order): string {
  return absoluteUrl(`/pedido/${order.code}`);
}

function detalle(order: Order): [string, string][] {
  return [
    ["Código", order.code],
    ["Servicio", order.product_name],
    ["Cantidad", formatNumber(order.quantity)],
    ["Destino", order.link],
    ["Total", formatClp(order.amount_clp)],
  ];
}

/** El pedido quedó esperando la transferencia del cliente. */
export function correoTransferenciaPendiente(order: Order): EmailContent {
  const datos = datosTransferencia();
  const url = seguimiento(order);
  const filas: [string, string][] = [
    ...detalle(order),
    ["Banco", datos.banco],
    ["Tipo de cuenta", datos.tipoCuenta],
    ["Número de cuenta", datos.numero],
    ["Titular", datos.titular],
    ["RUT", datos.rut],
    ["Correo del comprobante", datos.email],
  ];

  return {
    subject: `Tu pedido ${order.code} está reservado: falta la transferencia`,
    html: layout({
      titulo: "Reservamos tu pedido",
      intro:
        `Transfiere <strong>${escape(formatClp(order.amount_clp))}</strong> a la cuenta de abajo y pon ` +
        `<strong>${escape(order.code)}</strong> como mensaje o comentario. Apenas confirmemos que llegó, ` +
        "tu pedido sale a entrega.",
      filas,
      aviso: datos.instrucciones ? escape(datos.instrucciones) : undefined,
      cta: { texto: "Ver mi pedido y avisar que transferí", url },
      cierre: "Cuando transfieras, avísanos desde esa página.",
    }),
    text: texto([
      `Reservamos tu pedido ${order.code}.`,
      "",
      `Transfiere ${formatClp(order.amount_clp)} y pon ${order.code} como mensaje.`,
      "",
      `Servicio: ${order.product_name}`,
      `Cantidad: ${formatNumber(order.quantity)}`,
      `Destino: ${order.link}`,
      "",
      datos.banco && `Banco: ${datos.banco}`,
      datos.tipoCuenta && `Tipo de cuenta: ${datos.tipoCuenta}`,
      datos.numero && `Número de cuenta: ${datos.numero}`,
      datos.titular && `Titular: ${datos.titular}`,
      datos.rut && `RUT: ${datos.rut}`,
      datos.email && `Correo del comprobante: ${datos.email}`,
      "",
      datos.instrucciones,
      "",
      `Avísanos que transferiste en: ${url}`,
    ]),
  };
}

/** Pago recibido. Es el correo que más se abre: va con el seguimiento. */
export function correoPagoConfirmado(order: Order): EmailContent {
  const url = seguimiento(order);
  return {
    subject: `Pago confirmado · pedido ${order.code} en camino`,
    html: layout({
      titulo: "Recibimos tu pago",
      intro: "Tu pedido está en la fila de entrega. Empieza en unos minutos.",
      filas: detalle(order),
      aviso:
        "Mantén el perfil o la publicación en <strong>público</strong> hasta que termine: si se " +
        "pone en privado, la entrega se detiene.",
      cta: { texto: "Seguir mi pedido", url },
    }),
    text: texto([
      `Recibimos tu pago del pedido ${order.code}.`,
      "",
      `Servicio: ${order.product_name}`,
      `Cantidad: ${formatNumber(order.quantity)}`,
      `Destino: ${order.link}`,
      `Total: ${formatClp(order.amount_clp)}`,
      "",
      "Mantén el perfil o la publicación en público hasta que termine la entrega.",
      "",
      `Seguimiento: ${url}`,
    ]),
  };
}

/** La entrega terminó (completa o parcial). */
export function correoPedidoCompletado(order: Order, parcial = false): EmailContent {
  const url = seguimiento(order);
  const entregado = parcial && order.remains != null
    ? formatNumber(Math.max(0, order.quantity - order.remains))
    : formatNumber(order.quantity);

  return {
    subject: parcial
      ? `Tu pedido ${order.code} se entregó en parte`
      : `Listo: tu pedido ${order.code} está entregado`,
    html: layout({
      titulo: parcial ? "Entregamos parte de tu pedido" : "Tu pedido está entregado",
      intro: parcial
        ? `Entregamos ${escape(entregado)} de ${escape(formatNumber(order.quantity))}. Escríbenos y lo resolvemos.`
        : "Ya está todo entregado. Si algo no cuadra, respóndenos este correo.",
      filas: detalle(order),
      cta: { texto: "Ver el detalle", url },
    }),
    text: texto([
      parcial
        ? `Tu pedido ${order.code} se entregó en parte: ${entregado} de ${formatNumber(order.quantity)}.`
        : `Tu pedido ${order.code} está entregado.`,
      "",
      `Servicio: ${order.product_name}`,
      `Destino: ${order.link}`,
      "",
      `Detalle: ${url}`,
    ]),
  };
}

/**
 * Bienvenida al panel mayorista.
 *
 * Es el único correo que recibe quien recién se registra, así que dice las tres
 * cosas que necesita saber para empezar: cómo son los precios, cómo se paga y
 * dónde entrar.
 */
export function correoBienvenidaPanel(input: {
  email: string;
  name?: string | null;
  minTopupClp: number;
  marginPercent: number;
}): EmailContent {
  const url = absoluteUrl("/panel");
  const tienda = getSetting("site_name", "TusSeguidores");
  const nombre = input.name?.trim();

  return {
    subject: `Tu cuenta mayorista en ${tienda} está lista`,
    html: layout({
      titulo: nombre ? `Bienvenido, ${nombre}` : "Bienvenido al panel mayorista",
      intro: "Tu cuenta ya está activa. Compras a precio de mayorista, pagando con saldo.",
      filas: [
        ["Tu cuenta", input.email],
        ["Recarga mínima", formatClp(input.minTopupClp)],
        ["Formas de pago", "Webpay o transferencia"],
      ],
      aviso: "Cargas saldo, eliges el servicio y pides. Cada pedido se descuenta al instante.",
      cta: { texto: "Entrar al panel", url },
      cierre: "Si un pedido sale mal, abres un ticket desde el panel.",
    }),
    text: texto([
      nombre ? `Bienvenido, ${nombre}.` : "Bienvenido al panel mayorista.",
      "",
      `Tu cuenta ${input.email} ya está activa.`,
      `Recarga mínima: ${formatClp(input.minTopupClp)}, por Webpay o transferencia.`,
      "",
      "Cargas saldo, eliges el servicio y pides. Cada pedido se descuenta al instante.",
      "",
      `Entra en: ${url}`,
    ]),
  };
}

// ------------------------------------------------------------ avisos internos

function fichaAdmin(order: Order): string {
  return absoluteUrl(`/admin/pedidos/${order.id}`);
}

/** Entró un pedido nuevo, todavía sin pagar. */
export function correoAdminPedidoNuevo(order: Order): EmailContent {
  const url = fichaAdmin(order);
  const metodo = order.payment_provider === "transferencia" ? "transferencia" : "Webpay (Flow)";
  return {
    subject: `Pedido nuevo · ${order.code} · ${formatClp(order.amount_clp)}`,
    html: layout({
      titulo: "Entró un pedido nuevo",
      intro:
        `Todavía sin pagar: el cliente eligió <strong>${escape(metodo)}</strong>. ` +
        (order.payment_provider === "transferencia"
          ? "Te avisamos de nuevo cuando diga que transfirió."
          : "Si paga, sale solo al proveedor y te llega el aviso."),
      filas: [...detalle(order), ["Cliente", order.email], ["Teléfono", order.phone ?? "—"]],
      cta: { texto: "Abrir el pedido en el panel", url },
    }),
    text: texto([
      `Pedido nuevo: ${order.code} por ${formatClp(order.amount_clp)} (${metodo}, sin pagar).`,
      "",
      `Servicio: ${order.product_name}`,
      `Cantidad: ${formatNumber(order.quantity)}`,
      `Destino: ${order.link}`,
      `Cliente: ${order.email}`,
      order.phone && `Teléfono: ${order.phone}`,
      "",
      url,
    ]),
  };
}

/** Se confirmó el pago: es la venta de verdad. */
export function correoAdminPedidoPagado(order: Order): EmailContent {
  const url = fichaAdmin(order);
  return {
    subject: `Venta pagada · ${order.code} · ${formatClp(order.amount_clp)}`,
    html: layout({
      titulo: "Se confirmó un pago",
      intro:
        order.payment_provider === "transferencia"
          ? "Confirmaste la transferencia: el pedido sale al proveedor."
          : "El cobro pasó por Flow y el pedido sale solo al proveedor.",
      filas: [...detalle(order), ["Forma de pago", order.payment_provider], ["Cliente", order.email]],
      cta: { texto: "Ver el pedido", url },
    }),
    text: texto([
      `Venta pagada: ${order.code} por ${formatClp(order.amount_clp)}.`,
      "",
      `Servicio: ${order.product_name}`,
      `Cantidad: ${formatNumber(order.quantity)}`,
      `Destino: ${order.link}`,
      `Cliente: ${order.email}`,
      "",
      url,
    ]),
  };
}

/** El cliente dice que ya transfirió: hay que revisar la cuenta. */
export function correoAdminTransferencia(order: Order): EmailContent {
  const url = fichaAdmin(order);
  return {
    subject: `Transferencia por confirmar · ${order.code} · ${formatClp(order.amount_clp)}`,
    html: layout({
      titulo: "Un cliente avisó que transfirió",
      intro: "Revisa la cuenta y confirma el pago para que el pedido salga al proveedor.",
      filas: [
        ...detalle(order),
        ["Comprobante", order.transfer_reference ?? "—"],
        ["Cliente", order.email],
      ],
      cta: { texto: "Abrir el pedido en el panel", url },
    }),
    text: texto([
      `Transferencia por confirmar: ${order.code} por ${formatClp(order.amount_clp)}.`,
      `Cliente: ${order.email}`,
      order.transfer_reference && `Comprobante: ${order.transfer_reference}`,
      "",
      url,
    ]),
  };
}

/** Plata cobrada que no se está entregando: es lo más urgente de la tienda. */
export function correoAdminPedidoTrabado(order: Order, motivo: string): EmailContent {
  const url = fichaAdmin(order);
  return {
    subject: `Pedido pagado sin enviar · ${order.code}`,
    html: layout({
      titulo: "Un pedido pagado no pudo salir al proveedor",
      intro: `El cobro está hecho y la entrega no. Motivo: <strong>${escape(motivo)}</strong>.`,
      filas: [...detalle(order), ["Cliente", order.email]],
      aviso:
        "Si es falta de saldo, recarga en el proveedor: los pedidos trabados salen solos en la " +
        "siguiente pasada del cron, sin tocar nada.",
      cta: { texto: "Abrir el pedido en el panel", url },
    }),
    text: texto([
      `Pedido pagado sin enviar: ${order.code}.`,
      `Motivo: ${motivo}`,
      `Cliente: ${order.email}`,
      `Total: ${formatClp(order.amount_clp)}`,
      "",
      url,
    ]),
  };
}
