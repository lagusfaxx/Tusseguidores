import { NextResponse } from "next/server";
import crypto from "node:crypto";
import {
  WebStandardStreamableHTTPServerTransport,
} from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { crearServidor } from "@/lib/mcp/servidor";
import { getSetting } from "@/lib/settings";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * El servidor MCP de la tienda, hablado por HTTP.
 *
 * Vive dentro de la app y no como proceso aparte por una razón concreta: la
 * base es un archivo SQLite en el disco del contenedor. Cualquier cosa que
 * quiera leer los datos de verdad tiene que correr aquí.
 *
 * Cada petición levanta su propio transporte sin sesión. Es más simple de
 * razonar y sobrevive a un reinicio: no hay estado en memoria que se pierda.
 */

/**
 * La llave es un token propio, distinto del cron.
 *
 * Se compara en tiempo constante para no filtrar por cuánto tarda, igual que
 * el del cron. Sin token configurado el endpoint no responde: es preferible
 * que no funcione a que quede abierto.
 */
function autorizado(request: Request): boolean {
  const esperado = process.env.MCP_TOKEN || getSetting("mcp_token", "");
  if (!esperado) return false;

  const entregado =
    request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ??
    new URL(request.url).searchParams.get("key") ??
    "";

  const a = Buffer.from(entregado);
  const b = Buffer.from(esperado);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

async function manejar(request: Request): Promise<Response> {
  if (!autorizado(request)) {
    return NextResponse.json({ error: "No autorizado" }, { status: 401 });
  }

  const transport = new WebStandardStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
    // Sin streaming: las respuestas son cortas y JSON plano viaja mejor por
    // cualquier proxy intermedio.
    enableJsonResponse: true,
  });

  const server = crearServidor();
  await server.connect(transport);

  try {
    return await transport.handleRequest(request);
  } finally {
    // Cada petición es independiente: lo que se abrió aquí se cierra aquí.
    await transport.close();
    await server.close();
  }
}

export const GET = manejar;
export const POST = manejar;
export const DELETE = manejar;
