import { getBoolSetting, getSettings } from "./settings";

/**
 * Pago por transferencia bancaria.
 *
 * A diferencia de Flow, acá nadie confirma el pago automáticamente: el pedido
 * queda esperando a que el dueño de la tienda vea la plata en su cuenta y lo
 * confirme en el panel. Recién ahí sale al proveedor.
 */

export type DatosTransferencia = {
  banco: string;
  tipoCuenta: string;
  numero: string;
  titular: string;
  rut: string;
  email: string;
  instrucciones: string;
};

export function datosTransferencia(): DatosTransferencia {
  const s = getSettings();
  return {
    banco: s.transfer_bank ?? "",
    tipoCuenta: s.transfer_account_type ?? "",
    numero: s.transfer_account_number ?? "",
    titular: s.transfer_holder ?? "",
    rut: s.transfer_rut ?? "",
    email: s.transfer_email ?? s.contact_email ?? "",
    instrucciones: s.transfer_instructions ?? "",
  };
}

/**
 * Solo ofrecemos transferencia si están los datos mínimos para hacerla. Un
 * botón que lleva a una pantalla sin número de cuenta pierde la venta.
 */
export function transferenciaDisponible(): boolean {
  if (!getBoolSetting("transfer_enabled", false)) return false;
  const d = datosTransferencia();
  return Boolean(d.banco && d.numero && d.titular);
}
