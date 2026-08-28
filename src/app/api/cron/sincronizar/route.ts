import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { syncOpenOrders } from "@/lib/orders";
import { getSetting } from "@/lib/settings";

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
 * Actualiza el estado de los pedidos en curso preguntándole al proveedor.
 * Pensado para llamarse cada 10 minutos desde un cron de Coolify.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const result = await syncOpenOrders(200);
  return NextResponse.json({ ok: true, ...result });
}

export const POST = GET;
