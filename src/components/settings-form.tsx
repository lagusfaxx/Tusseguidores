"use client";

import { useActionState } from "react";
import {
  saveSettings, changePassword, testFlow, testResend, type ActionState,
} from "@/app/admin/actions";
import { Feedback, SubmitButton } from "./admin-ui";

type Props = {
  settings: Record<string, string>;
  minRates: { slug: string; label: string; value: number }[];
  providerBalance: string | null;
  providerBalanceError: string | null;
  /** Entorno de cobro que se está usando de verdad, no el guardado. */
  flowSandbox: boolean;
  flowForcedByEnv: { apiKey: boolean; secretKey: boolean; sandbox: boolean };
  providerKeyFromEnv: boolean;
  resendKeyFromEnv: boolean;
};

/** Marca los campos que una variable de entorno está pisando. */
function EnvNotice({ name }: { name: string }) {
  return (
    <p className="mt-1 rounded bg-amber-500/10 px-2 py-1 text-xs text-amber-100">
      Este valor viene de la variable de entorno <code className="font-mono">{name}</code> y manda
      sobre lo que guardes aquí. Para cambiarlo, edítala en el servidor (en Coolify, en las
      variables del recurso) o bórrala para administrarlo desde este panel.
    </p>
  );
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="card p-6">
      <h2 className="font-bold">{title}</h2>
      {hint ? <p className="mt-1 text-sm text-ink-400">{hint}</p> : null}
      <div className="mt-5 space-y-4">{children}</div>
    </section>
  );
}

function Field({
  label, name, value, type = "text", hint, placeholder,
}: {
  label: string; name: string; value?: string; type?: string; hint?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>{label}</label>
      <input id={name} name={name} type={type} defaultValue={value ?? ""} placeholder={placeholder} className="field" />
      {hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

function Check({ label, name, checked, hint }: { label: string; name: string; checked: boolean; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input type="checkbox" name={name} defaultChecked={checked} className="mt-0.5 h-4 w-4 accent-[#7c3aed]" />
      <span>
        <span className="text-sm font-semibold">{label}</span>
        {hint ? <span className="block text-xs text-ink-400">{hint}</span> : null}
      </span>
    </label>
  );
}

export function SettingsForm({
  settings, minRates, providerBalance, providerBalanceError,
  flowSandbox, flowForcedByEnv, providerKeyFromEnv, resendKeyFromEnv,
}: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveSettings, {});
  const [passwordState, passwordAction] = useActionState<ActionState, FormData>(changePassword, {});
  const [flowState, flowAction] = useActionState<ActionState>(testFlow, {});
  const [emailState, emailAction] = useActionState<ActionState>(testResend, {});
  // El entorno real, no el que dice la casilla: una variable de entorno puede
  // estar pisándola.
  const sandbox = flowSandbox;

  return (
    <>
      <form action={formAction} className="grid gap-6 lg:grid-cols-2">
        <Section title="La tienda">
          <Field label="Nombre" name="site_name" value={settings.site_name} />
          <Field label="Dominio" name="site_domain" value={settings.site_domain} />
          <Field label="URL completa" name="site_url" value={settings.site_url}
            hint="Con https:// y sin barra final. Se usa en los enlaces canónicos, el sitemap y el retorno de Flow." />
          <Field label="Frase corta" name="site_tagline" value={settings.site_tagline} />
          <Field label="Correo de contacto" name="contact_email" type="email" value={settings.contact_email} />
          <Field label="WhatsApp" name="contact_whatsapp" value={settings.contact_whatsapp}
            hint="Con código de país, por ejemplo +56 9 1234 5678. Se muestra en el pie de página." />
          <Check label="Recibir pedidos" name="orders_enabled" checked={settings.orders_enabled === "1"}
            hint="Desactívalo para pausar las ventas sin bajar el sitio." />
        </Section>

        <Section
          title="Precios"
          hint="El precio de venta es el costo del proveedor convertido a pesos más el margen. Mover el dólar o el margen reprecia toda la tienda de una vez: los tres niveles de cada producto, los packs y las cantidades libres."
        >
          <Field label="Dólar (CLP por US$)" name="usd_clp" type="number" value={settings.usd_clp}
            hint="Súbelo un poco sobre el dólar observado para cubrir la variación." />
          <Field label="Margen global (%)" name="margin_percent" type="number" value={settings.margin_percent}
            hint="180 significa que el precio de venta es 2,8 veces el costo. Bájalo y baja toda la tienda: los pisos de más abajo se mueven contigo." />
          <Field label="Terminación de precio" name="price_rounding" type="number" value={settings.price_rounding}
            hint="90 redondea hacia arriba a terminaciones …90 ($4.390). 0 redondea a la decena." />
          <Field label="Precio mínimo (CLP)" name="min_price_clp" type="number" value={settings.min_price_clp}
            hint="Ningún pedido se cobra por debajo de este monto." />
          <Field label="Margen de referencia de los pisos (%)" name="margin_reference" type="number"
            value={settings.margin_reference}
            hint="Los pisos de abajo están escritos para este margen y se escalan solos cuando cambias el margen global. Déjalo en el margen que tienes hoy: así los precios actuales no se mueven y, a partir de ahí, el margen manda sobre toda la tienda." />
          <div>
            <label className="field-label">Precio mínimo por cada 1.000 unidades</label>
            <p className="mb-3 text-xs leading-relaxed text-ink-400">
              El piso de cada tipo de servicio, escrito al margen de referencia. Cuando el costo del
              proveedor es de centavos —que es casi todo el catálogo— este número es el que fija el
              precio, y por eso servicios de costo muy distinto terminan valiendo lo mismo. Súbelo
              para ganar más en ese tipo; bájalo para dejar que mande el costo.
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {minRates.map((rate) => (
                <label key={rate.slug} className="flex items-center gap-2">
                  <span className="min-w-0 flex-1 truncate text-sm text-ink-200">{rate.label}</span>
                  <input
                    name={`min_rate__${rate.slug}`}
                    type="number"
                    min={0}
                    step={100}
                    defaultValue={rate.value}
                    className="field w-28 text-right tabular-nums"
                  />
                </label>
              ))}
            </div>
          </div>
          <Check
            label="Mantener el catálogo por niveles al día"
            name="auto_levels"
            checked={settings.auto_levels === "1"}
            hint="Cada vez que se sincroniza el catálogo, la tienda vuelve a elegir el servicio económico, el estándar y el premium de cada producto. Si el proveedor da de baja uno, entra solo el mejor que quede."
          />
        </Section>

        <Section title="Proveedor (honestsmm)">
          <Field label="URL de la API" name="provider_url" value={settings.provider_url} />
          <Field label="API key" name="provider_key" type="password" value={settings.provider_key}
            hint="La sacas de tu página de cuenta en el proveedor." />
          {providerKeyFromEnv ? <EnvNotice name="PROVIDER_API_KEY" /> : null}
          <Check label="Enviar los pedidos automáticamente al confirmar el pago"
            name="auto_send_to_provider" checked={settings.auto_send_to_provider === "1"} />
          <Field label="Avisar cuando el saldo baje de (US$)" name="low_balance_usd" type="number"
            value={settings.low_balance_usd}
            hint="Aparece una alerta roja en el resumen. Si el proveedor se queda sin saldo, los pedidos ya pagados quedan en espera y se reenvían solos al recargar." />
          {providerBalance ? (
            <p className="rounded-lg border border-lime-500/30 bg-lime-500/10 px-3 py-2 text-sm text-lime-200">
              Saldo en el proveedor: <strong>{providerBalance}</strong>
            </p>
          ) : providerBalanceError ? (
            <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              {providerBalanceError}
            </p>
          ) : null}
        </Section>

        <Section title="Pagos (Flow.cl)">
          <div
            className={`rounded-lg border px-3 py-2.5 text-sm leading-relaxed ${
              sandbox
                ? "border-amber-500/30 bg-amber-500/10 text-amber-100"
                : "border-lime-500/30 bg-lime-500/10 text-lime-100"
            }`}
          >
            Ahora mismo se cobra en{" "}
            <strong>{sandbox ? "PRUEBAS (sandbox.flow.cl)" : "PRODUCCIÓN (www.flow.cl)"}</strong>.
            {sandbox ? " Ningún pago es real." : " Los pagos son reales."}
          </div>

          <p className="text-xs leading-relaxed text-ink-400">
            Las credenciales de pruebas y las de producción son distintas: la API key y la secret key
            tienen que ser las de{" "}
            <code className="font-mono text-brand-300">{sandbox ? "sandbox.flow.cl" : "www.flow.cl"}</code>.
            Si las mezclas, Flow responde «apiKey not found» y nadie puede pagar.
          </p>

          <div>
            <Field label="API key" name="flow_api_key" type="password" value={settings.flow_api_key} />
            {flowForcedByEnv.apiKey ? <EnvNotice name="FLOW_API_KEY" /> : null}
          </div>
          <div>
            <Field label="Secret key" name="flow_secret_key" type="password" value={settings.flow_secret_key} />
            {flowForcedByEnv.secretKey ? <EnvNotice name="FLOW_SECRET_KEY" /> : null}
          </div>
          <div>
            <Check label="Modo de pruebas (sandbox)" name="flow_sandbox" checked={settings.flow_sandbox === "1"}
              hint="Desmárcalo para cobrar de verdad. Al cambiarlo también tienes que cambiar las credenciales." />
            {flowForcedByEnv.sandbox ? <EnvNotice name="FLOW_SANDBOX" /> : null}
          </div>

          <p className="rounded-lg bg-white/4 px-3 py-2 text-xs leading-relaxed text-ink-400">
            En el panel de Flow configura la URL de confirmación como{" "}
            <code className="text-brand-300">{settings.site_url}/api/flow/confirmar</code> y la de retorno como{" "}
            <code className="text-brand-300">{settings.site_url}/pago/retorno</code>.
          </p>

          <p className="text-xs text-ink-400">
            Guarda primero los cambios y después prueba las credenciales; el botón usa lo que está
            guardado, no lo que tienes escrito en pantalla.
          </p>
        </Section>

        <Section
          title="Transferencia bancaria"
          hint="Un segundo botón en la ficha del producto. El pedido queda reservado y no sale al proveedor hasta que tú confirmes que llegó la plata."
        >
          <Check
            label="Aceptar pagos por transferencia"
            name="transfer_enabled"
            checked={settings.transfer_enabled === "1"}
            hint="El botón solo aparece si además están el banco, el número de cuenta y el titular."
          />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Banco" name="transfer_bank" value={settings.transfer_bank} placeholder="Banco de Chile" />
            <Field label="Tipo de cuenta" name="transfer_account_type" value={settings.transfer_account_type} />
          </div>
          <Field label="Número de cuenta" name="transfer_account_number" value={settings.transfer_account_number} />
          <div className="grid grid-cols-2 gap-3">
            <Field label="Titular" name="transfer_holder" value={settings.transfer_holder} />
            <Field label="RUT" name="transfer_rut" value={settings.transfer_rut} placeholder="12.345.678-9" />
          </div>
          <Field label="Correo para el comprobante" name="transfer_email" type="email"
            value={settings.transfer_email}
            hint="Si lo dejas vacío se usa el correo de contacto de la tienda." />
          <div>
            <label className="field-label" htmlFor="transfer_instructions">Instrucciones adicionales</label>
            <textarea id="transfer_instructions" name="transfer_instructions" rows={3}
              defaultValue={settings.transfer_instructions} className="field"
              placeholder="Ej: Confirmamos las transferencias de lunes a viernes entre 9 y 19 h." />
            <p className="mt-1 text-xs text-ink-400">
              Se muestran bajo los datos de la cuenta. Sirve para fijar expectativas de horario.
            </p>
          </div>
          <p className="rounded-lg bg-white/4 px-3 py-2 text-xs leading-relaxed text-ink-400">
            El cliente ve estos datos con su código de pedido como mensaje. Cuando avisa que
            transfirió, aparece una alerta en el resumen y el pedido queda en{" "}
            <strong className="text-white">Transferencias por confirmar</strong>. Revisas tu cuenta,
            confirmas, y recién ahí sale al proveedor.
          </p>
        </Section>

        <Section
          title="Correos (Resend)"
          hint="Los avisos automáticos del pedido: los datos para transferir, la confirmación del pago y el aviso de entrega. Sin esto la tienda no manda ningún correo."
        >
          <Check label="Enviar correos" name="email_enabled" checked={settings.email_enabled === "1"}
            hint="Apágalo para dejar de mandar todo de una vez, sin borrar la configuración." />
          <div>
            <Field label="API key de Resend" name="resend_api_key" type="password"
              value={settings.resend_api_key}
              hint="La creas en resend.com → API Keys. Con permiso de envío basta." />
            {resendKeyFromEnv ? <EnvNotice name="RESEND_API_KEY" /> : null}
          </div>
          <Field label="Remitente" name="email_from" value={settings.email_from}
            placeholder="pedidos@tusseguidores.cl"
            hint="El dominio tiene que estar verificado en Resend (SPF y DKIM). Puedes escribir solo la dirección o el formato completo: TusSeguidores <pedidos@tusseguidores.cl>." />
          <Field label="Responder a" name="email_reply_to" type="email" value={settings.email_reply_to}
            hint="A dónde llegan las respuestas de los clientes. Vacío = el correo de contacto de la tienda." />
          <Field label="Correo para los avisos internos" name="email_admin" type="email"
            value={settings.email_admin}
            hint="Transferencias por confirmar y pedidos pagados que no pudieron salir. Vacío = el correo de contacto." />
          <Check label="Recibir los avisos internos" name="email_admin_alerts"
            checked={settings.email_admin_alerts === "1"}
            hint="Venta pagada, transferencia por confirmar y pedidos que no pudieron salir al proveedor." />
          <Check label="Avisarme también de cada pedido nuevo" name="email_admin_new_orders"
            checked={settings.email_admin_new_orders === "1"}
            hint="Apenas entra el pedido, aunque todavía no esté pagado. Apágalo si te molestan los carritos abandonados." />
          <p className="rounded-lg bg-white/4 px-3 py-2 text-xs leading-relaxed text-ink-400">
            Cada correo sale una sola vez por pedido, aunque el cron pase muchas veces o Flow repita
            la confirmación. Lo que se envió queda en el historial del pedido.
          </p>
        </Section>

        <Section
          title="Panel mayorista"
          hint="La sección de reventa: el cliente carga saldo y manda pedidos al costo del proveedor más un margen chico, sin los pisos de precio de la tienda."
        >
          <Check label="Panel mayorista activo" name="reseller_enabled"
            checked={settings.reseller_enabled === "1"}
            hint="Apagado, /panel deja de estar disponible y el enlace desaparece de la tienda." />
          <Field label="Margen mayorista (%)" name="reseller_margin_percent" type="number"
            value={settings.reseller_margin_percent}
            hint="Sobre el costo del proveedor. 30 significa que un servicio que te cuesta $1.000 el mil se vende a $1.300 el mil. Nada que ver con el margen de la tienda: aquí no hay pisos ni ticket mínimo." />
          <Field label="Recarga mínima (CLP)" name="reseller_min_topup_clp" type="number"
            value={settings.reseller_min_topup_clp}
            hint="Lo que menos puede cargar un cliente de una vez." />
          <Field label="Cobro mínimo por pedido (CLP)" name="reseller_min_order_clp" type="number"
            value={settings.reseller_min_order_clp}
            hint="Piso por pedido, para que 10 unidades de algo de centavos no salgan $1." />
          <div>
            <label className="field-label" htmlFor="reseller_welcome">Mensaje de bienvenida</label>
            <textarea id="reseller_welcome" name="reseller_welcome" rows={2}
              defaultValue={settings.reseller_welcome} className="field"
              placeholder="Ej: Cuentas verificadas en el día hábil." />
            <p className="mt-1 text-xs text-ink-400">Se muestra al crear la cuenta.</p>
          </div>
          <p className="rounded-lg bg-white/4 px-3 py-2 text-xs leading-relaxed text-ink-400">
            El saldo se descuenta en el momento del pedido y queda registrado en el libro de
            movimientos de cada cliente. Las recargas por Webpay se acreditan solas; las
            transferencias las confirmas tú en <strong className="text-white">Recargas</strong>.
          </p>
        </Section>

        <Section title="SEO de la portada">
          <Field label="Título" name="seo_home_title" value={settings.seo_home_title} />
          <div>
            <label className="field-label" htmlFor="seo_home_description">Meta descripción</label>
            <textarea id="seo_home_description" name="seo_home_description" rows={3}
              defaultValue={settings.seo_home_description} className="field" />
          </div>
          <Field label="Palabras clave" name="seo_home_keywords" value={settings.seo_home_keywords} />
          <Check
            label="Generar el texto SEO automáticamente"
            name="auto_seo_text"
            checked={settings.auto_seo_text === "1"}
            hint="La portada y cada página de red social muestran un texto armado con sus precios, plazos y garantías reales. Se actualiza solo cuando cambias precios. Lo editas en la sección SEO del menú."
          />
          <Field label="Verificación de Google Search Console" name="google_site_verification"
            value={settings.google_site_verification}
            hint="Solo el valor del meta tag google-site-verification." />
          <Field label="ID de Google Analytics" name="google_analytics_id" value={settings.google_analytics_id}
            placeholder="G-XXXXXXXXXX" />
        </Section>

        <Section
          title="Calificación del servicio"
          hint="La nota que se muestra en la tienda y que se publica como aggregateRating: es lo que hace que el resultado de Google salga con estrellas debajo del título. Pon los números de tus opiniones reales; sin número de opiniones no se muestra nada."
        >
          <Check
            label="Mostrar la calificación"
            name="rating_enabled"
            checked={settings.rating_enabled === "1"}
            hint="Apágalo para sacar las estrellas de toda la tienda y de los datos estructurados."
          />
          <Field
            label="Nota (1 a 5)"
            name="rating_value"
            type="number"
            value={settings.rating_value}
            hint="Se admite un decimal, por ejemplo 4.8. Fuera del rango 1–5 no se muestra."
          />
          <Field
            label="Número de opiniones"
            name="rating_count"
            type="number"
            value={settings.rating_count}
            hint="Cuántas personas la calificaron. En 0 no se muestra la calificación en ninguna parte: Google no valida una nota sin opiniones detrás."
          />
          <p className="text-xs leading-relaxed text-ink-400">
            Cada producto puede llevar su propia nota desde su ficha en el panel. Si la deja en 0,
            usa esta.
          </p>
        </Section>

        <Section title="Operación">
          <Field label="Clave del cron" name="cron_secret" type="password" value={settings.cron_secret}
            hint="Necesaria para llamar a /api/cron/sincronizar y actualizar los estados de los pedidos." />
          <p className="rounded-lg bg-white/4 px-3 py-2 text-xs leading-relaxed text-ink-400">
            Programa una llamada cada 10 minutos a{" "}
            <code className="text-brand-300">{settings.site_url}/api/cron/sincronizar?key=TU_CLAVE</code>{" "}
            para que los pedidos se actualicen solos.
          </p>
        </Section>

        <div className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t border-white/10 bg-ink-950/95 px-1 py-4 backdrop-blur lg:col-span-2">
          <SubmitButton>Guardar ajustes</SubmitButton>
          <Feedback state={state} />
        </div>
      </form>

      <form action={flowAction} className="card mt-6 p-6">
        <h2 className="font-bold">Probar las credenciales de Flow</h2>
        <p className="mt-1 text-sm text-ink-400">
          Consulta a Flow sin cobrar nada y te dice exactamente qué está fallando.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <SubmitButton className="btn btn-ghost text-sm">Probar ahora</SubmitButton>
          <Feedback state={flowState} />
        </div>
      </form>

      <form action={emailAction} className="card mt-6 p-6">
        <h2 className="font-bold">Probar el envío de correos</h2>
        <p className="mt-1 text-sm text-ink-400">
          Manda un correo de prueba al destinatario de los avisos internos. Guarda primero: el botón
          usa lo que está guardado, no lo que tienes escrito en pantalla.
        </p>
        <div className="mt-5 flex flex-wrap items-center gap-4">
          <SubmitButton className="btn btn-ghost text-sm">Enviar prueba</SubmitButton>
          <Feedback state={emailState} />
        </div>
      </form>

      <form action={passwordAction} className="card mt-6 max-w-md p-6">
        <h2 className="font-bold">Cambiar mi contraseña</h2>
        <div className="mt-5 space-y-4">
          <Field label="Nueva contraseña" name="new_password" type="password" />
          <Field label="Repetir contraseña" name="confirm_password" type="password" />
        </div>
        <div className="mt-5 flex items-center gap-4">
          <SubmitButton>Cambiar</SubmitButton>
          <Feedback state={passwordState} />
        </div>
      </form>
    </>
  );
}
