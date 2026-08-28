"use client";

import { useActionState, useMemo, useState } from "react";
import { useFormStatus } from "react-dom";
import { startCheckout, type CheckoutState } from "@/app/producto/actions";
import type { PricedTier } from "@/lib/types";
import { CheckIcon, LockIcon } from "./icons";

type Props = {
  productId: number;
  tiers: PricedTier[];
  minQty: number;
  maxQty: number;
  linkLabel: string;
  linkPlaceholder: string;
  linkHelp: string;
  deliveryLabel: string;
  guaranteeText: string | null;
  /**
   * Precio efectivo por cada 1.000 unidades en CLP (costo + margen o el piso
   * por tipo de servicio, lo que sea mayor). Con esto el precio que ve el
   * comprador en una cantidad libre coincide exactamente con el que recalcula
   * el servidor al crear el pedido.
   */
  ratePer1000Clp: number;
  minPriceClp: number;
  rounding: number;
};

/** Misma terminación comercial que aplica el servidor en src/lib/pricing.ts */
function roundToEnding(value: number, ending: number): number {
  if (ending <= 0) return Math.ceil(value / 10) * 10;
  const step = ending < 100 ? 100 : 1000;
  const base = Math.floor(value / step) * step + ending;
  return base >= value ? base : base + step;
}

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });
const num = new Intl.NumberFormat("es-CL");

function SubmitButton({ price }: { price: number }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="btn btn-primary mt-5 w-full text-base" disabled={pending}>
      {pending ? "Redirigiendo al pago…" : `Pagar ${clp.format(price)}`}
    </button>
  );
}

export function BuyBox(props: Props) {
  const { tiers, minQty, maxQty, ratePer1000Clp, minPriceClp } = props;
  const defaultTier = tiers.find((t) => t.popular) ?? tiers[0];

  const [selected, setSelected] = useState<number | "custom">(defaultTier?.id ?? "custom");
  const [customQty, setCustomQty] = useState<number>(defaultTier?.quantity ?? minQty);
  const [state, formAction] = useActionState<CheckoutState, FormData>(startCheckout, {});

  const { quantity, price } = useMemo(() => {
    if (selected === "custom") {
      const qty = Math.min(maxQty, Math.max(minQty, Math.round(customQty) || minQty));
      const raw = (qty / 1000) * ratePer1000Clp;
      return { quantity: qty, price: Math.max(minPriceClp, roundToEnding(raw, props.rounding)) };
    }
    const tier = tiers.find((t) => t.id === selected) ?? defaultTier;
    return { quantity: tier?.quantity ?? minQty, price: tier?.priceClp ?? minPriceClp };
  }, [selected, customQty, tiers, defaultTier, minQty, maxQty, ratePer1000Clp, minPriceClp, props.rounding]);

  return (
    <form action={formAction} className="card p-5 sm:p-6">
      <input type="hidden" name="productId" value={props.productId} />
      <input type="hidden" name="quantity" value={quantity} />

      <h2 className="text-sm font-semibold uppercase tracking-wider text-ink-400">Elige la cantidad</h2>

      <div className="mt-4 grid grid-cols-2 gap-2.5">
        {tiers.map((tier) => {
          const active = selected === tier.id;
          return (
            <button
              key={tier.id}
              type="button"
              onClick={() => setSelected(tier.id)}
              aria-pressed={active}
              className={`relative rounded-xl border px-3 py-3 text-left transition-colors ${
                active
                  ? "border-brand-400 bg-brand-500/15"
                  : "border-white/10 bg-white/4 hover:border-white/25"
              }`}
            >
              {tier.popular ? (
                <span className="absolute -top-2 right-2 rounded-full bg-accent-500 px-1.5 py-0.5 text-[9px] font-bold uppercase">
                  Popular
                </span>
              ) : null}
              <span className="block text-base font-bold">{num.format(tier.quantity)}</span>
              <span className="block text-sm font-semibold text-brand-300">{clp.format(tier.priceClp)}</span>
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => setSelected("custom")}
          aria-pressed={selected === "custom"}
          className={`rounded-xl border px-3 py-3 text-left transition-colors ${
            selected === "custom"
              ? "border-brand-400 bg-brand-500/15"
              : "border-white/10 bg-white/4 hover:border-white/25"
          }`}
        >
          <span className="block text-base font-bold">Otra</span>
          <span className="block text-sm text-ink-400">cantidad</span>
        </button>
      </div>

      {selected === "custom" ? (
        <div className="mt-4">
          <label className="field-label" htmlFor="customQty">
            Cantidad exacta (entre {num.format(minQty)} y {num.format(maxQty)})
          </label>
          <input
            id="customQty"
            type="number"
            className="field"
            min={minQty}
            max={maxQty}
            step={10}
            value={customQty}
            onChange={(e) => setCustomQty(Number(e.target.value))}
          />
        </div>
      ) : null}

      <div className="mt-5 space-y-4">
        <div>
          <label className="field-label" htmlFor="link">{props.linkLabel}</label>
          <input
            id="link"
            name="link"
            type="text"
            required
            autoComplete="off"
            className="field"
            placeholder={props.linkPlaceholder}
          />
          <p className="mt-1.5 text-xs leading-relaxed text-ink-400">{props.linkHelp}</p>
        </div>

        <div>
          <label className="field-label" htmlFor="email">Tu correo</label>
          <input
            id="email"
            name="email"
            type="email"
            required
            autoComplete="email"
            className="field"
            placeholder="tucorreo@ejemplo.cl"
          />
          <p className="mt-1.5 text-xs text-ink-400">Ahí te enviamos el comprobante y el código de seguimiento.</p>
        </div>

        <details className="text-sm">
          <summary className="cursor-pointer text-ink-400 hover:text-white">¿Tienes un cupón?</summary>
          <input name="coupon" type="text" className="field mt-2 uppercase" placeholder="CUPON10" />
        </details>
      </div>

      <div className="mt-5 flex items-center justify-between rounded-xl border border-white/10 bg-white/4 px-4 py-3">
        <div>
          <span className="block text-xs text-ink-400">{num.format(quantity)} unidades</span>
          <span className="text-2xl font-extrabold">{clp.format(price)}</span>
        </div>
        <span className="text-right text-xs leading-relaxed text-ink-400">
          {props.deliveryLabel}
          {props.guaranteeText ? <><br />{props.guaranteeText}</> : null}
        </span>
      </div>

      {state.error ? (
        <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          {state.error}
        </p>
      ) : null}

      <SubmitButton price={price} />

      <ul className="mt-4 space-y-1.5 text-xs text-ink-400">
        <li className="flex items-center gap-1.5"><LockIcon className="h-3.5 w-3.5 text-lime-400" /> Pago seguro con Flow: Webpay, transferencia o Mercado Pago</li>
        <li className="flex items-center gap-1.5"><CheckIcon className="h-3.5 w-3.5 text-lime-400" /> Nunca pedimos tu contraseña</li>
      </ul>
    </form>
  );
}
