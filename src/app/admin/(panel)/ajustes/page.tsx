import { getSettings } from "@/lib/settings";
import { DEFAULT_MIN_RATES, parseMinRates } from "@/lib/pricing";
import { SERVICE_TYPE_OPTIONS } from "@/lib/labels";
import { SettingsForm } from "@/components/settings-form";
import { providerConfigured, provider } from "@/lib/provider";
import { config as flowConfig } from "@/lib/flow";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = getSettings();

  // Mostramos el saldo del proveedor si la key ya está configurada.
  let balance: string | null = null;
  let balanceError: string | null = null;
  if (providerConfigured()) {
    try {
      const result = await provider.balance();
      balance = `US$${Number(result.balance).toFixed(2)}`;
    } catch (error) {
      balanceError = error instanceof Error ? error.message : "No se pudo consultar el saldo.";
    }
  }

  const flow = flowConfig();

  // Un campo por tipo de servicio, con su etiqueta en español.
  const actuales = parseMinRates(settings.min_rate_json ?? "");
  const etiquetas = new Map(SERVICE_TYPE_OPTIONS.map((o) => [o.slug, o.label]));
  const minRates = Object.keys(DEFAULT_MIN_RATES)
    .map((slug) => ({
      slug,
      label: etiquetas.get(slug) ?? (slug === "otros" ? "Otros" : slug),
      value: actuales[slug] ?? DEFAULT_MIN_RATES[slug],
    }))
    .sort((a, b) => b.value - a.value);

  return (
    <>
      <h1 className="text-2xl font-bold">Ajustes</h1>
      <p className="mt-1 text-sm text-ink-400">
        Todo lo que se guarda acá se aplica de inmediato en la tienda.
      </p>

      <div className="mt-6">
        <SettingsForm
          settings={settings}
          minRates={minRates}
          providerBalance={balance}
          providerBalanceError={balanceError}
          flowSandbox={flow.sandbox}
          flowForcedByEnv={flow.forcedByEnv}
          providerKeyFromEnv={Boolean((process.env.PROVIDER_API_KEY ?? "").trim())}
        />
      </div>
    </>
  );
}
