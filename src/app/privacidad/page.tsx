import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { buildMetadata } from "@/lib/seo";
import { getSettings } from "@/lib/settings";

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Política de privacidad | TusSeguidores.cl",
    description: "Qué datos guardamos, para qué los usamos y cómo puedes pedir que los eliminemos.",
    path: "/privacidad",
  });
}

export default function PrivacyPage() {
  const s = getSettings();
  return (
    <LegalPage title="Política de privacidad" updated="agosto de 2026">
      <h2>Qué datos guardamos</h2>
      <p>Al comprar guardamos únicamente lo necesario para procesar y respaldar tu pedido:</p>
      <ul>
        <li>Tu correo electrónico, para identificar tu pedido y darte soporte. Flow lo usa además para enviarte el comprobante del pago.</li>
        <li>El enlace o usuario de destino que ingresaste.</li>
        <li>El detalle del pedido: producto, cantidad, monto y estado.</li>
        <li>La dirección IP desde la que se hizo el pedido, para prevención de fraude.</li>
        <li>Tu teléfono, solo si decides entregarlo.</li>
      </ul>

      <h2>Qué no guardamos</h2>
      <p>
        No almacenamos contraseñas de redes sociales (nunca te las pedimos) ni datos de tarjetas de
        crédito o débito: esos datos los procesa directamente Flow y no pasan por nuestros
        servidores.
      </p>

      <h2>Con quién compartimos datos</h2>
      <ul>
        <li>
          <strong>Proveedor de entrega:</strong> le enviamos el enlace de destino y la cantidad del
          pedido. No recibe tu correo ni tus datos personales.
        </li>
        <li>
          <strong>Flow:</strong> recibe tu correo y el monto para procesar el pago.
        </li>
      </ul>
      <p>No vendemos ni cedemos tus datos a terceros con fines publicitarios.</p>

      <h2>Cookies</h2>
      <p>
        Usamos una cookie técnica para mantener la sesión del panel de administración. Si tenemos
        Google Analytics activo, se usan además cookies de medición para entender de forma agregada
        cómo se navega el sitio.
      </p>

      <h2>Tus derechos</h2>
      <p>
        Puedes pedirnos en cualquier momento acceder, rectificar o eliminar tus datos escribiendo a{" "}
        {s.contact_email}. Eliminamos los datos de pedidos cerrados que ya no necesitamos conservar
        por razones contables.
      </p>

      <h2>Contacto</h2>
      <p>Responsable del tratamiento: {s.site_name}, {s.site_domain}. Correo: {s.contact_email}.</p>
    </LegalPage>
  );
}
