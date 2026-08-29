"use client";

import { useActionState } from "react";
import { saveSettings, changePassword, testFlow, type ActionState } from "@/app/admin/actions";
import { Feedback, SubmitButton } from "./admin-ui";

type Props = {
  settings: Record<string, string>;
  defaultMinRates: string;
  providerBalance: string | null;
  providerBalanceError: string | null;
  /** Entorno de cobro que se está usando de verdad, no el guardado. */
  flowSandbox: boolean;
  flowForcedByEnv: { apiKey: boolean; secretKey: boolean; sandbox: boolean };
  providerKeyFromEnv: boolean;
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
  settings, defaultMinRates, providerBalance, providerBalanceError,
  flowSandbox, flowForcedByEnv, providerKeyFromEnv,
}: Props) {
  const [state, formAction] = useActionState<ActionState, FormData>(saveSettings, {});
  const [passwordState, passwordAction] = useActionState<ActionState, FormData>(changePassword, {});
  const [flowState, flowAction] = useActionState<ActionState>(testFlow, {});
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

        <Section title="Precios" hint="El precio de venta es el costo del proveedor convertido a pesos más el margen.">
          <Field label="Dólar (CLP por US$)" name="usd_clp" type="number" value={settings.usd_clp}
            hint="Súbelo un poco sobre el dólar observado para cubrir la variación." />
          <Field label="Margen global (%)" name="margin_percent" type="number" value={settings.margin_percent}
            hint="180 significa que el precio de venta es 2,8 veces el costo." />
          <Field label="Terminación de precio" name="price_rounding" type="number" value={settings.price_rounding}
            hint="90 redondea hacia arriba a terminaciones …90 ($4.390). 0 redondea a la decena." />
          <Field label="Precio mínimo (CLP)" name="min_price_clp" type="number" value={settings.min_price_clp}
            hint="Ningún pedido se cobra por debajo de este monto." />
          <div>
            <label className="field-label" htmlFor="min_rate_json">Precio mínimo por 1.000 unidades</label>
            <textarea
              id="min_rate_json"
              name="min_rate_json"
              rows={10}
              defaultValue={settings.min_rate_json || defaultMinRates}
              className="field font-mono text-xs"
            />
            <p className="mt-1 text-xs text-ink-400">
              JSON por tipo de servicio, en pesos. Es el piso que mantiene los packs grandes más caros que
              los chicos cuando el costo del proveedor es de centavos.
            </p>
          </div>
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

        <Section title="SEO de la portada">
          <Field label="Título" name="seo_home_title" value={settings.seo_home_title} />
          <div>
            <label className="field-label" htmlFor="seo_home_description">Meta descripción</label>
            <textarea id="seo_home_description" name="seo_home_description" rows={3}
              defaultValue={settings.seo_home_description} className="field" />
          </div>
          <Field label="Palabras clave" name="seo_home_keywords" value={settings.seo_home_keywords} />
          <div>
            <label className="field-label" htmlFor="seo_home_text">Texto SEO al pie de la portada (HTML)</label>
            <textarea id="seo_home_text" name="seo_home_text" rows={8}
              defaultValue={settings.seo_home_text} className="field font-mono text-xs" />
            <p className="mt-1 text-xs text-ink-400">Opcional. Se muestra al final de la portada.</p>
          </div>
          <Field label="Verificación de Google Search Console" name="google_site_verification"
            value={settings.google_site_verification}
            hint="Solo el valor del meta tag google-site-verification." />
          <Field label="ID de Google Analytics" name="google_analytics_id" value={settings.google_analytics_id}
            placeholder="G-XXXXXXXXXX" />
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

        <div className="sticky bottom-0 -mx-4 flex items-center gap-4 border-t border-white/10 bg-ink-950/95 px-4 py-4 backdrop-blur lg:col-span-2">
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
