"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/**
 * Vuelve a pedir la página cada cierto rato mientras el pedido está en curso.
 *
 * La página de seguimiento se calcula en el servidor, así que sin esto el
 * cliente ve el número que había cuando abrió y nada más: la entrega avanza y
 * la pantalla no. Con el refresco, el servidor le pregunta al proveedor y el
 * restante baja solo, sin que nadie recargue.
 *
 * Se detiene cuando el pedido termina y cuando la pestaña no está a la vista:
 * una pestaña olvidada en segundo plano no tiene por qué seguir consultando.
 */
export function AutoRefresh({ activo, cadaSegundos = 20 }: { activo: boolean; cadaSegundos?: number }) {
  const router = useRouter();

  useEffect(() => {
    if (!activo) return;
    const id = setInterval(() => {
      if (document.visibilityState === "visible") router.refresh();
    }, Math.max(5, cadaSegundos) * 1000);
    return () => clearInterval(id);
  }, [activo, cadaSegundos, router]);

  return null;
}
