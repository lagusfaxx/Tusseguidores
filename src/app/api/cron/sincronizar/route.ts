import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { syncOpenOrders, retryUndispatched } from "@/lib/orders";
import { getBoolSetting, getSetting } from "@/lib/settings";
import { publicarNiveles } from "@/lib/autolevels";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function authorized(request: Request): boolean {
  const expected = process.env.CRON_SECRET || getSetting("cron_secret", "");
  if (!expected) return false;
  const url = new URL(request.url);
  const provided =
    url.searchParams.get("key") ??
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    "";
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

/**
 * Mantenimiento periódico de los pedidos. Pensado para llamarse cada 10
 * minutos desde un cron de Coolify.
 *
 * 1. Reintenta los pedidos pagados que nunca salieron al proveedor. Es lo que
 *    hace que, al recargar saldo, los pedidos atascados se envíen solos.
 * 2. Actualiza el avance de los que ya están en curso.
 * 3. Si los niveles automáticos están activos, reacomoda el catálogo: los
 *    servicios que el proveedor dio de baja dejan de ser el económico o el
 *    premium de su combinación y entra el mejor que haya quedado.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const reenvios = await retryUndispatched(25);
  const estados = await syncOpenOrders(200);
  const niveles = getBoolSetting("auto_levels", true) ? publicarNiveles({ publicar: true }) : null;
  return NextResponse.json({ ok: true, reenvios, estados, niveles });
}

export const POST = GET;
