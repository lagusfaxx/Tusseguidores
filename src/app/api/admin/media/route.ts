import { NextResponse } from "next/server";
import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import { currentUser } from "@/lib/auth";
import { UPLOADS_DIR } from "@/lib/db";
import { run } from "@/lib/db";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024;
const ALLOWED: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/avif": "avif",
  "image/gif": "gif",
  "image/svg+xml": "svg",
};

export async function POST(request: Request) {
  if (!(await currentUser())) return NextResponse.json({ error: "No autorizado" }, { status: 401 });

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Falta el archivo." }, { status: 400 });
  if (file.size > MAX_BYTES) {
    return NextResponse.json({ error: "La imagen no puede pesar más de 5 MB." }, { status: 400 });
  }
  const ext = ALLOWED[file.type];
  if (!ext) return NextResponse.json({ error: "Formato no permitido. Usa JPG, PNG, WEBP o AVIF." }, { status: 400 });

  const buffer = Buffer.from(await file.arrayBuffer());
  const filename = `${Date.now().toString(36)}-${crypto.randomBytes(6).toString("hex")}.${ext}`;
  await fs.mkdir(UPLOADS_DIR, { recursive: true });
  await fs.writeFile(path.join(UPLOADS_DIR, filename), buffer);

  run("INSERT INTO media (filename, mime, size) VALUES (?, ?, ?)", [filename, file.type, buffer.length]);

  return NextResponse.json({ url: `/media/${filename}` });
}
