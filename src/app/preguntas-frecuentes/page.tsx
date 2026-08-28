import type { Metadata } from "next";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";
import { buildMetadata, faqLd, jsonLd } from "@/lib/seo";

const FAQ = [
  ["¿Necesitan mi contraseña?", "No, nunca. Solo necesitamos tu usuario o el enlace público de la publicación. Si alguien te pide la clave para este tipo de servicios, desconfía."],
  ["¿Cuánto demora la entrega?", "La mayoría de los pedidos empieza en menos de 10 minutos desde que se confirma el pago. El tiempo total depende del servicio y la cantidad, y aparece indicado en la ficha de cada producto."],
  ["¿Cómo pago?", "Con Flow, que te deja pagar con tarjeta de crédito o débito por Webpay, con transferencia bancaria o con Mercado Pago. Los precios están en pesos chilenos."],
  ["¿Me llega boleta?", "Recibes el comprobante de pago de Flow en tu correo apenas se confirma la transacción."],
  ["¿Es seguro para mi cuenta?", "Sí. La entrega se hace desde fuera de tu cuenta, sin acceder a ella ni instalar nada. Tu cuenta sigue funcionando con normalidad."],
  ["¿Los seguidores bajan con el tiempo?", "En todas las plataformas hay una caída natural. Por eso varios de nuestros packs incluyen reposición gratuita: si bajan dentro del plazo indicado, los reponemos sin costo."],
  ["¿Puedo pedir para una cuenta privada?", "No. La cuenta o publicación debe estar pública durante toda la entrega, si no el sistema no puede completarla."],
  ["Me equivoqué en el enlace, ¿qué hago?", "Escríbenos de inmediato con tu código de pedido. Si todavía no salió a entrega podemos corregirlo; una vez enviado no es posible cambiar el destino."],
  ["¿Puedo comprar para varias cuentas?", "Sí. Haz un pedido por cada cuenta o publicación, indicando el enlace correspondiente en cada uno."],
  ["¿Qué pasa si mi pedido no llega?", "Te devolvemos el 100% del dinero. Escríbenos con el código del pedido y lo resolvemos."],
] as const;

export function generateMetadata(): Metadata {
  return buildMetadata({
    title: "Preguntas frecuentes | TusSeguidores.cl",
    description:
      "Resolvemos las dudas más comunes: tiempos de entrega, seguridad, medios de pago, garantías y devoluciones.",
    keywords: "comprar seguidores es seguro, cuanto demora comprar seguidores, pagar seguidores webpay",
    path: "/preguntas-frecuentes",
  });
}

export default function FaqPage() {
  const items = FAQ.map(([q, a]) => ({ q, a }));
  return (
    <>
      <SiteHeader />
      <main className="bg-halo">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">Preguntas frecuentes</h1>
          <p className="mt-2 text-ink-200">
            Si tu duda no está acá, escríbenos y te respondemos.
          </p>

          <div className="mt-8 space-y-3">
            {items.map((item) => (
              <details key={item.q} className="card group p-5 [&_summary::-webkit-details-marker]:hidden">
                <summary className="flex cursor-pointer items-center justify-between gap-4 font-semibold">
                  {item.q}
                  <span className="text-brand-300 transition-transform group-open:rotate-45">+</span>
                </summary>
                <p className="mt-3 text-sm leading-relaxed text-ink-200">{item.a}</p>
              </details>
            ))}
          </div>

          <div className="card mt-10 p-6 text-center">
            <p className="text-ink-200">¿Listo para comprar?</p>
            <Link href="/catalogo" className="btn btn-primary mt-4">Ver catálogo</Link>
          </div>
        </div>
      </main>
      <SiteFooter />
      <script type="application/ld+json" dangerouslySetInnerHTML={jsonLd(faqLd(items))} />
    </>
  );
}
