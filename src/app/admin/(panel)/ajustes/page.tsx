import { getSettings } from "@/lib/settings";
import { DEFAULT_MIN_RATES } from "@/lib/pricing";
import { SettingsForm } from "@/components/settings-form";
import { providerConfigured, provider } from "@/lib/provider";

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

  return (
    <>
      <h1 className="text-2xl font-bold">Ajustes</h1>
      <p className="mt-1 text-sm text-ink-400">
        Todo lo que se guarda acá se aplica de inmediato en la tienda.
      </p>

      <div className="mt-6">
        <SettingsForm
          settings={settings}
          defaultMinRates={JSON.stringify(DEFAULT_MIN_RATES, null, 2)}
          providerBalance={balance}
          providerBalanceError={balanceError}
        />
      </div>
    </>
  );
}
