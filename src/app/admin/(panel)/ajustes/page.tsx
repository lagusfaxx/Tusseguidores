import { getSettings } from "@/lib/settings";
import { DEFAULT_MIN_RATES, parseMinRates } from "@/lib/pricing";
import { SERVICE_TYPE_OPTIONS } from "@/lib/labels";
import { SettingsForm } from "@/components/settings-form";
import { cachedBalance, providerConfigured, refreshBalance, type ProveedorId } from "@/lib/provider";
import { config as flowConfig } from "@/lib/flow";
import { emailConfig } from "@/lib/email";

export const dynamic = "force-dynamic";

export default async function AdminSettingsPage() {
  const settings = getSettings();

  // Consultamos el saldo de cada proveedor que ya tiene su key configurada.
  // Queda guardado para el resto del panel, con el motivo si falló.
  const saldo = async (id: ProveedorId): Promise<{ balance: string | null; error: string | null }> => {
    if (!providerConfigured(id)) return { balance: null, error: null };
    const valor = await refreshBalance(id);
    if (valor != null) return { balance: `US$${valor.toFixed(2)}`, error: null };
    return { balance: null, error: cachedBalance(id).error ?? "No se pudo consultar el saldo." };
  };
  const [principal, jap] = await Promise.all([saldo("honestsmm"), saldo("jap")]);

  const flow = flowConfig();
  const email = emailConfig();

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
          providerBalance={principal.balance}
          providerBalanceError={principal.error}
          japBalance={jap.balance}
          japBalanceError={jap.error}
          flowSandbox={flow.sandbox}
          flowForcedByEnv={flow.forcedByEnv}
          providerKeyFromEnv={Boolean((process.env.PROVIDER_API_KEY ?? "").trim())}
          japKeyFromEnv={Boolean((process.env.JAP_API_KEY ?? "").trim())}
          resendKeyFromEnv={email.keyFromEnv}
        />
      </div>
    </>
  );
}
