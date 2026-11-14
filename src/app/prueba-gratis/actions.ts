"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { pedirPrueba } from "@/lib/prueba";

export type PruebaState = { error?: string };

export async function solicitarPrueba(_prev: PruebaState, formData: FormData): Promise<PruebaState> {
  // Trampa para bots: un campo que una persona no ve ni llena.
  if (String(formData.get("web") ?? "").trim()) return { error: "No se pudo enviar." };

  const headerList = await headers();
  const ip = headerList.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null;

  const resultado = await pedirPrueba({
    platform: String(formData.get("platform") ?? ""),
    link: String(formData.get("link") ?? ""),
    email: String(formData.get("email") ?? ""),
    ip,
  });
  if (!resultado.ok) return { error: resultado.error };
  redirect(`/pedido/${resultado.code}`);
}
