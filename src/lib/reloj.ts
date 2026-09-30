import { getBoolSetting, invalidateSettings } from "./settings";

/**
 * El reloj del mantenimiento: cada diez minutos corre la pasada de
 * mantenimiento.ts dentro del mismo servidor.
 *
 * Reemplaza al cron de Coolify, que había que configurar a mano y, si no
 * estaba, dejaba los pedidos pagados sin salir y el catálogo viejo. El cron
 * sigue funcionando si ya lo tienes: las dos vías comparten un candado y no se
 * pisan.
 *
 * Se apaga desde Ajustes → Operación (auto_mantenimiento).
 */

const CADA_MS = 10 * 60 * 1000;
/** La primera pasada espera a que el servidor termine de arrancar. */
const PRIMERA_MS = 60 * 1000;

declare global {
  var __tsReloj: NodeJS.Timeout | undefined;
}

async function tic() {
  invalidateSettings();
  if (!getBoolSetting("auto_mantenimiento", true)) return;
  const { correrMantenimiento } = await import("./mantenimiento");
  const r = await correrMantenimiento();
  if (r.error) console.error("[mantenimiento]", r.error);
  else if (r.catalogo) console.log("[mantenimiento] catálogo:", r.catalogo);
}

export function encenderReloj() {
  if (globalThis.__tsReloj) return;
  const correr = () => void tic().catch((error) => console.error("[mantenimiento]", error));
  const primera = setTimeout(correr, PRIMERA_MS);
  primera.unref();
  globalThis.__tsReloj = setInterval(correr, CADA_MS);
  globalThis.__tsReloj.unref();
  console.log("[mantenimiento] reloj encendido: una pasada cada 10 minutos.");
}
