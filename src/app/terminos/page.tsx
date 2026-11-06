import type { Metadata } from "next";
import { LegalPage } from "@/components/legal-page";
import { buildMetadata } from "@/lib/seo";
import { getSettings } from "@/lib/settings";

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Términos y condiciones | TusSeguidores.cl",
    description: "Condiciones de uso, entrega, garantías y devoluciones de TusSeguidores.cl.",
    path: "/terminos",
  });
}

export default function TermsPage() {
  const s = getSettings();
  return (
    <LegalPage title="Términos y condiciones" updated="noviembre de 2026">
      <h2>1. Quiénes somos</h2>
      <p>
        {s.site_name} ({s.site_domain}) es una tienda chilena de servicios de crecimiento para redes
        sociales. Al comprar en este sitio aceptas estas condiciones.
      </p>

      <h2>2. Qué vendemos</h2>
      <p>
        Vendemos paquetes de interacciones (seguidores, me gusta, visualizaciones, comentarios y
        similares) que se entregan sobre cuentas o publicaciones públicas. No vendemos cuentas, no
        gestionamos tus perfiles y en ningún caso solicitamos tus contraseñas.
      </p>

      <h2>3. Entrega</h2>
      <p>
        La entrega comienza de forma automática una vez confirmado el pago. Los plazos indicados en
        cada producto son estimaciones basadas en el promedio histórico del servicio y pueden variar
        según la carga de la plataforma de destino.
      </p>
      <p>
        Para que podamos entregar tu pedido, la cuenta o publicación debe permanecer pública durante
        todo el proceso. Si la cuenta se vuelve privada, se cambia el nombre de usuario o se elimina
        la publicación, el pedido puede quedar incompleto y no procederá la devolución.
      </p>

      <h2>4. Datos que entregas al comprar</h2>
      <p>
        Eres responsable de la exactitud del enlace o usuario que ingresas. Una vez enviado el pedido
        al sistema de entrega no es posible cambiar el destino. Mientras no haya salido puedes
        corregirlo tú mismo desde la página de tu pedido; si ya salió, escríbenos de inmediato por el
        ticket del pedido: intentaremos detenerlo, pero no podemos garantizarlo.
      </p>

      <h2>5. Garantía y reposición</h2>
      <p>
        Los productos que indican reposición la incluyen dentro del plazo señalado en su ficha. La
        reposición cubre la caída de las interacciones entregadas por nosotros y se solicita desde
        la página del pedido.
      </p>

      <h2>6. Devoluciones</h2>
      <p>
        Si un pedido no se entrega, devolvemos el 100% del monto pagado. Si se entrega parcialmente,
        devolvemos la parte proporcional no entregada.
      </p>
      <p>
        <strong>Las devoluciones se realizan únicamente en criptomonedas: USDT (redes TRC20 o
        BEP20) o BTC</strong>, por el equivalente en pesos chilenos del monto a devolver al tipo de
        cambio del día del pago de la devolución. No se hacen devoluciones a tarjetas, Webpay ni
        cuentas bancarias. La devolución se solicita desde la página del pedido indicando la red y la
        dirección de la billetera, y se paga dentro de los 10 días hábiles siguientes. El comprador
        es responsable de que la dirección y la red sean correctas: un envío a una dirección o red
        equivocada no se puede recuperar.
      </p>
      <p>
        No corresponde devolución cuando el pedido no pudo completarse por causas atribuibles al
        comprador (cuenta privada, enlace incorrecto, publicación eliminada o cambio de usuario).
      </p>

      <h2>7. Pagos</h2>
      <p>
        Los pagos se procesan con Webpay (crédito y débito) a través de Flow, o por transferencia
        bancaria. Todos los precios están expresados en pesos chilenos e incluyen los
        impuestos aplicables. No almacenamos datos de tarjetas en nuestros servidores.
      </p>

      <h2>8. Uso aceptable</h2>
      <p>
        No aceptamos pedidos destinados a cuentas o contenidos que promuevan odio, violencia, abuso
        infantil, estafas o cualquier actividad ilegal. Nos reservamos el derecho de rechazar o
        anular un pedido, devolviendo el dinero en USDT o BTC según el punto 6.
      </p>

      <h2>9. Relación con las plataformas</h2>
      <p>
        No tenemos relación, patrocinio ni respaldo de Meta, TikTok, Google, X ni ninguna otra
        plataforma. Sus marcas se mencionan únicamente para describir el servicio ofrecido. El uso de
        servicios de crecimiento puede no estar alineado con los términos de esas plataformas y es
        responsabilidad de cada usuario evaluarlo.
      </p>

      <h2>10. Atención</h2>
      <p>
        Toda la atención es por ticket: desde la página de tu pedido o desde la página de soporte.
        No atendemos por correo, teléfono ni redes sociales.
      </p>
    </LegalPage>
  );
}
