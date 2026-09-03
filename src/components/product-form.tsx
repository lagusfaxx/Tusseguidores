"use client";

import { useActionState, useState } from "react";
import { saveProduct, type ActionState } from "@/app/admin/actions";
import { ImagePicker } from "./image-picker";
import { Feedback, SubmitButton } from "./admin-ui";
import { LEVELS } from "@/lib/level-defs";
import type { FaqItem, PricedTier, Product } from "@/lib/types";

type ServiceInfo = {
  service_id: number;
  clean_name: string;
  rate_usd_per_1000: number;
  min_qty: number;
  max_qty: number;
  provider_enabled: number;
  drop_score: number;
  speed_score: number;
};

export type RoutingPreview = {
  serviceId: number;
  name: string;
  rateUsd: number;
  drop: number;
  speed: number;
  score: number;
  rerouted: boolean;
  reason: string;
};

type Props = {
  product: Product | null;
  service: ServiceInfo;
  routing: RoutingPreview | null;
  alternatives: RoutingPreview[];
  tiers: PricedTier[];
  bullets: string[];
  faq: FaqItem[];
  platformOptions: { slug: string; label: string }[];
  typeOptions: { slug: string; label: string }[];
  /** Precio automático por 1.000 unidades, para mostrar la referencia. */
  autoRatePer1000: number;
};

const clp = new Intl.NumberFormat("es-CL", { style: "currency", currency: "CLP", maximumFractionDigits: 0 });

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
  label, name, defaultValue, placeholder, type = "text", hint, required,
}: {
  label: string; name: string; defaultValue?: string | number | null;
  placeholder?: string; type?: string; hint?: string; required?: boolean;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>{label}</label>
      <input
        id={name}
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="field"
      />
      {hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

function Textarea({
  label, name, defaultValue, rows = 4, hint, placeholder,
}: {
  label: string; name: string; defaultValue?: string; rows?: number; hint?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="field-label" htmlFor={name}>{label}</label>
      <textarea
        id={name}
        name={name}
        rows={rows}
        defaultValue={defaultValue ?? ""}
        placeholder={placeholder}
        className="field font-mono text-xs leading-relaxed"
      />
      {hint ? <p className="mt-1 text-xs text-ink-400">{hint}</p> : null}
    </div>
  );
}

function Check({ label, name, defaultChecked, hint }: { label: string; name: string; defaultChecked?: boolean; hint?: string }) {
  return (
    <label className="flex cursor-pointer items-start gap-2.5">
      <input type="checkbox" name={name} defaultChecked={defaultChecked} className="mt-0.5 h-4 w-4 accent-[#7c3aed]" />
      <span>
        <span className="text-sm font-semibold">{label}</span>
        {hint ? <span className="block text-xs text-ink-400">{hint}</span> : null}
      </span>
    </label>
  );
}

export function ProductForm(props: Props) {
  const { product, service, autoRatePer1000, routing, alternatives } = props;
  const [state, formAction] = useActionState<ActionState, FormData>(saveProduct, {});
  const [rows, setRows] = useState(
    props.tiers.length
      ? props.tiers.map((t) => ({ quantity: t.quantity, price: t.manual ? String(t.priceClp) : "", popular: t.popular }))
      : [{ quantity: service.min_qty, price: "", popular: true }],
  );
  const [priceMode, setPriceMode] = useState(product?.price_mode ?? "auto");

  function updateRow(index: number, patch: Partial<(typeof rows)[number]>) {
    setRows((current) => current.map((row, i) => (i === index ? { ...row, ...patch } : row)));
  }

  return (
    <form action={formAction} className="space-y-6">
      {product ? <input type="hidden" name="id" value={product.id} /> : null}
      <input type="hidden" name="provider_service_id" value={service.service_id} />

      <div className="grid gap-6 lg:grid-cols-[1.5fr_1fr]">
        <div className="space-y-6">
          <Section title="Lo que ve el cliente">
            <Field label="Nombre del producto" name="name" defaultValue={product?.name} required
              placeholder="Seguidores para Instagram" />
            <Field label="Enlace de la página (slug)" name="slug" defaultValue={product?.slug}
              hint="Se usa en la URL: /producto/comprar-seguidores-instagram" />
            <Textarea label="Descripción corta" name="short_description" rows={2}
              defaultValue={product?.short_description}
              hint="Una o dos líneas. Aparece en las tarjetas del catálogo y bajo el título." />
            <Textarea label="Descripción larga (HTML)" name="description_html" rows={12}
              defaultValue={product?.description_html}
              hint="Se permiten <p>, <h2>, <h3>, <ul>, <ol>, <li>, <strong>, <em> y <a>. El resto se elimina al guardar." />
            <Textarea label="Puntos destacados" name="bullets" rows={5}
              defaultValue={props.bullets.join("\n")}
              hint="Uno por línea. Se muestran con un tilde verde en la ficha." />
            <Textarea label="Preguntas frecuentes" name="faq" rows={7}
              defaultValue={props.faq.map((item) => `${item.q} | ${item.a}`).join("\n")}
              hint="Una por línea, con el formato: pregunta | respuesta. Alimentan el bloque de FAQ y el marcado FAQPage de Google." />
          </Section>

          <Section title="SEO" hint="Si dejas los campos vacíos se usa el nombre y la descripción corta.">
            <Field label="Título SEO (title)" name="seo_title" defaultValue={product?.seo_title}
              hint="Ideal entre 50 y 60 caracteres. Es lo que se ve como titular en Google." />
            <Textarea label="Meta descripción" name="seo_description" rows={3}
              defaultValue={product?.seo_description ?? ""}
              hint="Entre 140 y 158 caracteres. Es el texto gris bajo el titular en Google." />
            <Field label="Palabras clave" name="seo_keywords" defaultValue={product?.seo_keywords}
              hint="Separadas por comas." />
            <Field label="Imagen para redes sociales" name="og_image" defaultValue={product?.og_image}
              hint="Opcional. Si la dejas vacía se genera una automáticamente en PNG." />
            <Check label="No indexar esta página" name="noindex" defaultChecked={product?.noindex === 1}
              hint="Marca esto para sacarla de Google sin despublicarla de la tienda." />
          </Section>

          <Section title="Campo de destino" hint="Lo que se le pide al comprador para poder entregar.">
            <Field label="Etiqueta" name="link_label" defaultValue={product?.link_label ?? "Enlace o usuario"} />
            <Field label="Texto de ejemplo" name="link_placeholder" defaultValue={product?.link_placeholder ?? "https://..."} />
            <Textarea label="Ayuda bajo el campo" name="link_help" rows={2} defaultValue={product?.link_help} />
          </Section>
        </div>

        <div className="space-y-6">
          <Section title="Publicación">
            <Check label="Publicado en la tienda" name="published" defaultChecked={product?.published === 1} />
            <Check label="Destacado en la portada" name="featured" defaultChecked={product?.featured === 1} />
            <Field label="Etiqueta de la tarjeta" name="badge" defaultValue={product?.badge}
              placeholder="Más vendido" hint="Opcional. Se muestra sobre la foto." />
            <Field label="Orden" name="sort_order" type="number" defaultValue={product?.sort_order ?? 100}
              hint="Menor número, más arriba." />
            <div>
              <label className="field-label" htmlFor="level">Nivel de calidad</label>
              <select id="level" name="level" defaultValue={product?.level ?? ""} className="field">
                <option value="">Sin nivel (producto único)</option>
                {LEVELS.map((level) => (
                  <option key={level.id} value={level.id}>{level.label}</option>
                ))}
              </select>
              <p className="mt-1 text-xs text-ink-400">
                Agrupa este producto con los otros niveles de la misma red y servicio. La ficha
                muestra el comparador con los precios de los tres.
              </p>
            </div>
            <Check
              label="Mantenerlo al día automáticamente"
              name="auto_managed"
              defaultChecked={product?.auto_managed === 1}
              hint="Con esto marcado, cada sincronización vuelve a elegir el servicio del proveedor y reescribe los textos del nivel. Desmárcalo si editaste algo a mano y no quieres que se pise."
            />
          </Section>

          <Section title="Foto">
            <ImagePicker name="image_url" defaultValue={product?.image_url} />
          </Section>

          <Section title="Servicio del proveedor">
            <div className="rounded-lg border border-white/10 bg-white/4 p-4 text-sm">
              <p className="font-mono text-xs text-ink-400">#{service.service_id}</p>
              <p className="mt-1 leading-relaxed">{service.clean_name}</p>
              <dl className="mt-3 space-y-1 text-xs text-ink-400">
                <div className="flex justify-between"><dt>Costo por 1.000</dt><dd>US${service.rate_usd_per_1000}</dd></div>
                <div className="flex justify-between"><dt>Rango del proveedor</dt><dd>{service.min_qty} – {service.max_qty}</dd></div>
                <div className="flex justify-between">
                  <dt>Retención / velocidad</dt>
                  <dd>{service.drop_score} / {service.speed_score}</dd>
                </div>
                <div className="flex justify-between">
                  <dt>Estado</dt>
                  <dd className={service.provider_enabled ? "text-lime-400" : "text-red-300"}>
                    {service.provider_enabled ? "Activo" : "Dado de baja"}
                  </dd>
                </div>
              </dl>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Cantidad mínima" name="min_qty" type="number" defaultValue={product?.min_qty ?? service.min_qty} />
              <Field label="Cantidad máxima" name="max_qty" type="number" defaultValue={product?.max_qty ?? service.max_qty} />
            </div>
            <Field label="Texto de entrega" name="delivery_label" defaultValue={product?.delivery_label ?? "Inicio inmediato"} />
            <Field label="Texto de calidad" name="quality_label" defaultValue={product?.quality_label ?? "Alta calidad"} />
            <Field label="Días de reposición" name="refill_days" type="number" defaultValue={product?.refill_days ?? 0}
              hint="0 = sin reposición. 9999 = de por vida." />
            <Field label="Texto de garantía" name="guarantee_text" defaultValue={product?.guarantee_text} />
          </Section>

          <Section
            title="Elección del servicio"
            hint="El cliente elige el producto; la tienda decide a qué servicio del proveedor pedírselo."
          >
            <Check
              label="Elegir automáticamente el mejor servicio"
              name="auto_select"
              defaultChecked={product ? product.auto_select === 1 : true}
              hint="Al despachar se busca el servicio más rápido y con menos caída entre los equivalentes activos. Si lo desmarcas, siempre se usa el servicio de referencia."
            />
            <Field
              label="Presupuesto máximo"
              name="max_cost_ratio"
              type="number"
              defaultValue={product?.max_cost_ratio ?? 1.35}
              hint="Cuánto puede costar el servicio elegido respecto del de referencia. 1.35 = hasta un 35% más caro; sube este número para priorizar la calidad sobre el margen."
            />

            {routing ? (
              <div className="rounded-lg border border-white/10 bg-white/4 p-4 text-sm">
                <p className="text-xs uppercase tracking-wider text-ink-400">
                  Ahora mismo se enviaría a
                </p>
                <p className="mt-1.5 font-mono text-xs text-brand-300">#{routing.serviceId}</p>
                <p className="mt-1 leading-relaxed">{routing.name}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs">
                  <span className="rounded bg-white/6 px-2 py-1">Retención {routing.drop}/100</span>
                  <span className="rounded bg-white/6 px-2 py-1">Velocidad {routing.speed}/100</span>
                  <span className="rounded bg-white/6 px-2 py-1">US${routing.rateUsd}</span>
                </div>
                <p className="mt-2 text-xs text-ink-400">{routing.reason}</p>
              </div>
            ) : (
              <p className="rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
                No hay ningún servicio activo capaz de atender este producto. Revisa las cantidades
                o sincroniza el catálogo del proveedor.
              </p>
            )}

            {alternatives.length ? (
              <details className="text-sm">
                <summary className="cursor-pointer text-ink-400 hover:text-white">
                  Ver las {alternatives.length} alternativas consideradas
                </summary>
                <ul className="mt-2 space-y-1.5">
                  {alternatives.map((option) => (
                    <li key={option.serviceId} className="rounded border border-white/8 bg-white/3 px-2.5 py-2 text-xs">
                      <span className="font-mono text-ink-400">#{option.serviceId}</span>{" "}
                      <span className="text-brand-300">{option.score.toFixed(0)}</span>{" "}
                      <span className="text-ink-400">US${option.rateUsd}</span>
                      <div className="mt-0.5 truncate text-ink-200">{option.name}</div>
                    </li>
                  ))}
                </ul>
              </details>
            ) : null}
          </Section>

          <Section title="Precios">
            <div>
              <label className="field-label">Modo de precio</label>
              <select
                name="price_mode"
                value={priceMode}
                onChange={(event) => setPriceMode(event.target.value as "auto" | "manual")}
                className="field"
              >
                <option value="auto">Automático (costo + margen)</option>
                <option value="manual">Manual (escribo cada precio)</option>
              </select>
              <p className="mt-1 text-xs text-ink-400">
                En automático se calcula con el margen global; el precio manual solo se usa si eliges ese modo.
              </p>
            </div>
            <Field label="Margen propio (%)" name="margin_override" type="number"
              defaultValue={product?.margin_override ?? ""}
              hint="Opcional. Vacío = usa el margen global de Ajustes." />
            <p className="rounded-lg bg-white/4 px-3 py-2 text-xs text-ink-400">
              Referencia automática: <strong className="text-white">{clp.format(autoRatePer1000)}</strong> por cada 1.000 unidades.
            </p>
          </Section>
        </div>
      </div>

      <Section title="Cantidades (packs)" hint="Lo que el cliente elige en la ficha. Se ordenan de menor a mayor al guardar.">
        <div className="space-y-2">
          {rows.map((row, index) => (
            <div key={index} className="flex flex-wrap items-end gap-3 rounded-lg border border-white/8 bg-white/3 p-3">
              <div className="w-32">
                <label className="field-label">Cantidad</label>
                <input
                  name="tier_quantity"
                  type="number"
                  min={1}
                  className="field"
                  value={row.quantity}
                  onChange={(event) => updateRow(index, { quantity: Number(event.target.value) })}
                />
              </div>
              <div className="w-40">
                <label className="field-label">Precio manual (CLP)</label>
                <input
                  name="tier_price"
                  type="number"
                  min={0}
                  className="field"
                  placeholder={priceMode === "manual" ? "Obligatorio" : "Automático"}
                  value={row.price}
                  onChange={(event) => updateRow(index, { price: event.target.value })}
                />
              </div>
              <label className="flex items-center gap-2 pb-2.5 text-sm">
                <input
                  type="radio"
                  name="tier_popular"
                  value={index}
                  checked={row.popular}
                  onChange={() => setRows((current) => current.map((r, i) => ({ ...r, popular: i === index })))}
                  className="h-4 w-4 accent-[#ff2e93]"
                />
                Popular
              </label>
              <button
                type="button"
                className="ml-auto pb-2.5 text-sm text-red-300 hover:text-red-200"
                onClick={() => setRows((current) => current.filter((_, i) => i !== index))}
              >
                Quitar
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          className="btn btn-ghost text-sm"
          onClick={() =>
            setRows((current) => [
              ...current,
              { quantity: (current.at(-1)?.quantity ?? service.min_qty) * 2, price: "", popular: false },
            ])
          }
        >
          Agregar cantidad
        </button>
      </Section>

      <div className="sticky bottom-0 flex flex-wrap items-center gap-4 border-t border-white/10 bg-ink-950/95 px-1 py-4 backdrop-blur">
        <SubmitButton>{product ? "Guardar cambios" : "Crear producto"}</SubmitButton>
        {product ? (
          <a href={`/producto/${product.slug}`} target="_blank" rel="noopener noreferrer" className="text-sm text-ink-400 hover:text-white">
            Ver en la tienda ↗
          </a>
        ) : null}
        <Feedback state={state} />
      </div>
    </form>
  );
}
