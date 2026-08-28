import { NextResponse } from "next/server";
import fs from "node:fs/promises";
import path from "node:path";
import { UPLOADS_DIR } from "@/lib/db";

export const runtime = "nodejs";

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".png": "image/png",
  ".webp": "image/webp", ".avif": "image/avif", ".gif": "image/gif",
  ".svg": "image/svg+xml",
};

/** Sirve las imágenes subidas desde el panel, que viven en el volumen de datos. */
export async function GET(_request: Request, { params }: { params: Promise<{ file: string[] }> }) {
  const { file } = await params;
  const name = file.join("/");
  // Nunca dejamos salir del directorio de subidas.
  const target = path.resolve(UPLOADS_DIR, name);
  if (!target.startsWith(path.resolve(UPLOADS_DIR) + path.sep)) {
    return new NextResponse("not found", { status: 404 });
  }

  try {
    const data = await fs.readFile(target);
    return new NextResponse(new Uint8Array(data), {
      headers: {
        "Content-Type": MIME[path.extname(target).toLowerCase()] ?? "application/octet-stream",
        "Cache-Control": "public, max-age=31536000, immutable",
      },
    });
  } catch {
    return new NextResponse("not found", { status: 404 });
  }
}
