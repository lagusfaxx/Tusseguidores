import Link from "next/link";
import { getPlatformServiceTypes, getPlatformsWithProducts } from "@/lib/catalog";
import { getSettings } from "@/lib/settings";
import { platformLabel, serviceTypeLabel, sortPlatforms, sortServiceTypes } from "@/lib/labels";
import { textoDeRed, textoDeTipo, textoDePortada } from "@/lib/seo-text";
import { SeoTextEditor } from "@/components/seo-editor";

export const dynamic = "force-dynamic";

export default async function AdminSeoPage() {
  const settings = getSettings();
  const auto = settings.auto_seo_text === "1";
  const platforms = sortPlatforms(getPlatformsWithProducts());
  const combinaciones = sortServiceTypes(getPlatformServiceTypes());

  const paginas = [
    {
      clave: "seo_home_text",
      titulo: "Portada",
      url: "/",
      manual: settings.seo_home_text ?? "",
      generado: textoDePortada() ?? "",
    },
    ...platforms.flatMap((p) => {
      const generado = textoDeRed(p.platform);
      const red = {
        clave: `seo_text_${p.platform}`,
        titulo: platformLabel(p.platform),
        url: `/${p.platform}`,
        manual: settings[`seo_text_${p.platform}`] ?? "",
        generado: generado?.html ?? "",
      };
      // Debajo de cada red van sus páginas de categoría, que son las que
      // responden a búsquedas como "seguidores instagram".
      const categorias = combinaciones
        .filter((c) => c.platform === p.platform)
        .map((c) => {
          const texto = textoDeTipo(c.platform, c.service_type);
          return {
            clave: `seo_text_${c.platform}_${c.service_type}`,
            titulo: `${platformLabel(c.platform)} · ${serviceTypeLabel(c.service_type)}`,
            url: `/${c.platform}/${c.service_type}`,
            manual: settings[`seo_text_${c.platform}_${c.service_type}`] ?? "",
            generado: texto?.html ?? "",
          };
        });
      return [red, ...categorias];
    }),
  ];

  const conManual = paginas.filter((p) => p.manual).length;

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Texto SEO</h1>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-ink-400">
            El texto largo que va al final de la portada y de cada página de red social. Se genera
            solo con los precios, tiempos de entrega y garantías reales de la tienda, así que cada
            página es distinta y se actualiza sola cuando cambias precios.
          </p>
        </div>
        <Link href="/admin/ajustes" className="btn btn-ghost text-sm">Metadatos y títulos</Link>
      </div>

      <div className="card mt-6 p-5">
        <p className="text-sm">
          {auto ? (
            <>
              Generación automática <strong className="text-lime-400">activa</strong>.{" "}
              {conManual > 0
                ? `${conManual} página(s) usan un texto que escribiste tú.`
                : "Ninguna página tiene texto propio todavía."}
            </>
          ) : (
            <>
              Generación automática <strong className="text-amber-300">apagada</strong>. Solo se
              muestra el texto que escribas a mano. Puedes activarla en{" "}
              <Link href="/admin/ajustes" className="text-brand-300 hover:text-white">Ajustes → SEO</Link>.
            </>
          )}
        </p>
      </div>

      <div className="mt-6 space-y-4">
        {paginas.map((pagina) => (
          <SeoTextEditor
            key={pagina.clave}
            clave={pagina.clave}
            titulo={pagina.titulo}
            url={pagina.url}
            manual={pagina.manual}
            generado={pagina.generado}
            autoActivo={auto}
          />
        ))}
      </div>
    </>
  );
}
