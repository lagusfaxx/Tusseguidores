import { NextResponse } from "next/server";
import crypto from "node:crypto";
import { getSetting } from "@/lib/settings";
import { correrMantenimiento } from "@/lib/mantenimiento";

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
 * Mantenimiento periódico, a pedido. El servidor ya lo corre solo cada 10
 * minutos (ver instrumentation.ts); este endpoint queda para quien prefiera un
 * cron externo o quiera forzar una pasada. Con ?catalogo=1 baja además el
 * catálogo de los proveedores aunque no hayan pasado las horas.
 *
 * Qué hace cada pasada está en lib/mantenimiento.ts.
 */
export async function GET(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }
  const forzar = new URL(request.url).searchParams.get("catalogo") === "1";
  const resultado = await correrMantenimiento(forzar);
  return NextResponse.json({ ok: !resultado.error, ...resultado });
}

export const POST = GET;
