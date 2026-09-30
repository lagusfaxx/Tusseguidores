import "server-only";
import { getSetting, setSettings } from "./settings";
import { esProveedor, PROVEEDOR_PRINCIPAL, type ProveedorId } from "./provider";

/**
 * Qué proveedor atiende cada red.
 *
 * Es el interruptor del panel: "Instagram con JustAnotherPanel" hace que los
 * productos de Instagram se armen con los servicios de ese proveedor, que sus
 * precios salgan de lo que cobra ese proveedor y que los pedidos nuevos se le
 * manden a él. Una red que no figura aquí va con el principal.
 *
 * Se guarda como un JSON en ajustes ({"instagram":"jap"}). Solo tiene las
 * redes que se movieron.
 */

const AJUSTE = "proveedor_por_red";
const SLUG_RED = /^[a-z0-9-]{1,40}$/;

export function mapaProveedorPorRed(): Record<string, ProveedorId> {
  const raw = getSetting(AJUSTE, "").trim();
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    const out: Record<string, ProveedorId> = {};
    for (const [red, proveedor] of Object.entries(parsed)) {
      if (SLUG_RED.test(red) && esProveedor(proveedor) && proveedor !== PROVEEDOR_PRINCIPAL) {
        out[red] = proveedor;
      }
    }
    return out;
  } catch {
    return {};
  }
}

export function proveedorDeRed(platform: string): ProveedorId {
  return mapaProveedorPorRed()[platform] ?? PROVEEDOR_PRINCIPAL;
}

export function guardarProveedorDeRed(platform: string, proveedor: ProveedorId): void {
  if (!SLUG_RED.test(platform)) throw new Error("Red desconocida.");
  const mapa = mapaProveedorPorRed();
  if (proveedor === PROVEEDOR_PRINCIPAL) delete mapa[platform];
  else mapa[platform] = proveedor;
  setSettings({ [AJUSTE]: JSON.stringify(mapa) });
}

/**
 * Condición SQL "el servicio es del proveedor que atiende a su red".
 *
 * Sirve para las consultas que recorren varias redes a la vez (el catálogo del
 * panel mayorista, las combinaciones que se publican por niveles). Los valores
 * van escritos en la consulta y no como parámetros para no tener que cuadrar
 * los `?` de cada consulta que la usa: por eso solo entra lo que pasó por la
 * validación de `mapaProveedorPorRed`, que admite letras, números y guiones.
 *
 * @param alias  alias de provider_services en la consulta ("s"), o "" si no tiene.
 */
export function sqlProveedorActivo(alias = "s"): string {
  const col = (nombre: string) => (alias ? `${alias}.${nombre}` : nombre);
  const casos = Object.entries(mapaProveedorPorRed())
    .map(([red, proveedor]) => `WHEN '${red}' THEN '${proveedor}'`)
    .join(" ");
  return casos
    ? `${col("provider")} = CASE ${col("platform")} ${casos} ELSE '${PROVEEDOR_PRINCIPAL}' END`
    : `${col("provider")} = '${PROVEEDOR_PRINCIPAL}'`;
}
