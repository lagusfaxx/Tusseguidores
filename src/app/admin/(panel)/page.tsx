import Link from "next/link";
import { all, get } from "@/lib/db";
import { orderStats } from "@/lib/orders";
import { syncOrders } from "@/app/admin/actions";
import { StatusBadge } from "@/components/order-status";
import { formatClp, formatNumber, pricingContext } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";
import { getSettings, getNumberSetting } from "@/lib/settings";
import { flowConfigured } from "@/lib/flow";
import { providerConfigured, cachedBalance, refreshBalance } from "@/lib/provider";
import type { Order } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AdminDashboard() {
  const stats = orderStats();
  const ctx = pricingContext();
  // El saldo se refresca aquí y queda guardado para las demás pantallas.
  await refreshBalance();
  const balance = cachedBalance();
  const settings = getSettings();
  const recent = all<Order>("SELECT * FROM orders ORDER BY id DESC LIMIT 8");

  const published = get<{ n: number }>("SELECT COUNT(*) AS n FROM products WHERE published = 1")?.n ?? 0;
  const drafts = get<{ n: number }>("SELECT COUNT(*) AS n FROM products WHERE published = 0")?.n ?? 0;
  const services = get<{ n: number }>("SELECT COUNT(*) AS n FROM provider_services WHERE provider_enabled = 1")?.n ?? 0;
  const broken = all<{ id: number; name: string }>(
    `SELECT p.id, p.name FROM products p
       JOIN provider_services s ON s.service_id = p.provider_service_id
      WHERE p.published = 1 AND s.provider_enabled = 0`,
  );

  const costClp = stats.cost * ctx.usdClp;
  const margin = stats.revenue > 0 ? Math.round(((stats.revenue - costClp) / stats.revenue) * 100) : 0;

  const lowBalance = getNumberSetting("low_balance_usd", 10);

  const alerts = [
    stats.transferenciasAvisadas > 0 && {
      text: `${stats.transferenciasAvisadas} cliente(s) avisaron que transfirieron y esperan tu confirmación.`,
      href: "/admin/pedidos?estado=transferencias",
      urgente: true,
    },
    stats.transferenciasPorConfirmar > stats.transferenciasAvisadas && {
      text: `${stats.transferenciasPorConfirmar - stats.transferenciasAvisadas} pedido(s) por transferencia esperando el pago.`,
      href: "/admin/pedidos?estado=transferencias",
    },
    stats.sinEnviar > 0 && {
      text:
        `${stats.sinEnviar} pedido(s) ya pagado(s) por ${formatClp(stats.sinEnviarClp)} todavía no salen al proveedor` +
        (stats.sinSaldo > 0 ? " — el proveedor rechazó por falta de saldo." : "."),
      href: "/admin/pedidos?estado=sin-enviar",
      urgente: true,
    },
    balance.usd != null && balance.usd <= lowBalance && {
      text: `Te queda US$${balance.usd.toFixed(2)} de saldo en el proveedor. Recarga antes de que se caigan las entregas.`,
      href: "/admin/ajustes",
      urgente: true,
    },
    !providerConfigured() && {
      text: "Falta la API key del proveedor: los pedidos pagados no se enviarán solos.",
      href: "/admin/ajustes",
    },
    !flowConfigured() && {
      text: "Flow no está configurado: los clientes no pueden pagar en línea.",
      href: "/admin/ajustes",
    },
    settings.orders_enabled !== "1" && {
      text: "La tienda tiene los pedidos desactivados.",
      href: "/admin/ajustes",
    },
    broken.length > 0 && {
      text: `${broken.length} producto(s) publicado(s) apuntan a servicios que el proveedor desactivó.`,
      href: "/admin/productos?problema=1",
    },
  ].filter(Boolean) as { text: string; href: string; urgente?: boolean }[];

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h1 className="text-2xl font-bold">Resumen</h1>
        <form action={syncOrders}>
          <button type="submit" className="btn btn-ghost text-sm">
            Actualizar estados con el proveedor
          </button>
        </form>
      </div>

      {alerts.length ? (
        <div className="mt-5 space-y-2">
          {alerts.map((alert) => (
            <Link
              key={alert.text}
              href={alert.href}
              className={`block rounded-lg border px-4 py-2.5 text-sm ${
                alert.urgente
                  ? "border-red-500/40 bg-red-500/10 text-red-100 hover:bg-red-500/15"
                  : "border-amber-500/30 bg-amber-500/10 text-amber-100 hover:bg-amber-500/15"
              }`}
            >
              {alert.text} →
            </Link>
          ))}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {[
          { label: "Ventas totales", value: formatClp(stats.revenue), hint: `${stats.paid} pedidos pagados` },
          { label: "Ventas de hoy", value: formatClp(stats.revenueToday), hint: `${stats.today} pedidos hoy` },
          { label: "Margen estimado", value: `${margin}%`, hint: `Costo ${formatClp(costClp)}` },
          {
            label: "Saldo del proveedor",
            value: balance.usd != null ? `US$${balance.usd.toFixed(2)}` : "—",
            hint: balance.usd != null
              ? `${formatNumber(stats.processing)} pedidos en proceso`
              : "Configura la API key para verlo",
          },
        ].map((card) => (
          <div key={card.label} className="card p-5">
            <p className="text-xs uppercase tracking-wider text-ink-400">{card.label}</p>
            <p className="mt-1.5 text-2xl font-extrabold">{card.value}</p>
            <p className="mt-1 text-xs text-ink-400">{card.hint}</p>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Productos publicados", value: published, href: "/admin/productos" },
          { label: "Borradores", value: drafts, href: "/admin/productos?estado=borradores" },
          { label: "Servicios del proveedor", value: services, href: "/admin/catalogo" },
        ].map((card) => (
          <Link key={card.label} href={card.href} className="card card-hover p-5">
            <p className="text-xs uppercase tracking-wider text-ink-400">{card.label}</p>
            <p className="mt-1.5 text-2xl font-extrabold">{formatNumber(card.value)}</p>
          </Link>
        ))}
      </div>

      <section className="card mt-8 overflow-hidden">
        <div className="flex items-center justify-between border-b border-white/8 px-5 py-4">
          <h2 className="font-bold">Últimos pedidos</h2>
          <Link href="/admin/pedidos" className="text-sm text-brand-300 hover:text-white">Ver todos</Link>
        </div>
        <div className="overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Código</th><th>Producto</th><th>Cantidad</th><th>Total</th><th>Estado</th><th>Fecha</th>
              </tr>
            </thead>
            <tbody>
              {recent.map((order) => (
                <tr key={order.id}>
                  <td>
                    <Link href={`/admin/pedidos/${order.id}`} className="font-mono text-brand-300 hover:text-white">
                      {order.code}
                    </Link>
                  </td>
                  <td className="max-w-[240px] truncate">{order.product_name}</td>
                  <td>{formatNumber(order.quantity)}</td>
                  <td className="font-semibold">{formatClp(order.amount_clp)}</td>
                  <td><StatusBadge status={order.status} /></td>
                  <td className="text-ink-400">{formatDateCl(order.created_at)}</td>
                </tr>
              ))}
              {recent.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-10 text-center text-ink-400">
                    Todavía no hay pedidos.
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
