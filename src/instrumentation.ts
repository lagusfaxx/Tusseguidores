/**
 * Next llama a esto una vez al arrancar el servidor. Aquí se enciende el reloj
 * del mantenimiento, para que sincronizar el catálogo, recalcular la calidad y
 * seguir los pedidos no dependa de configurar un cron aparte.
 */
export async function register() {
  if (process.env.NEXT_RUNTIME !== "nodejs") return;
  // Ni durante el build ni en desarrollo: no queremos pegarle a los
  // proveedores cada vez que alguien corre la tienda en su computador.
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.NEXT_PHASE === "phase-production-build") return;
  const { encenderReloj } = await import("./lib/reloj");
  encenderReloj();
}
