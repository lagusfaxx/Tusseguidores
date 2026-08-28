import { NextResponse } from "next/server";
import { get } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Sonda para el healthcheck de Docker y Coolify. */
export function GET() {
  try {
    const products = get<{ n: number }>("SELECT COUNT(*) AS n FROM products WHERE published = 1")?.n ?? 0;
    return NextResponse.json({ ok: true, products });
  } catch {
    return NextResponse.json({ ok: false }, { status: 503 });
  }
}
