import { SiteHeader } from "@/components/site-header";
import { SiteFooter } from "@/components/site-footer";

export function LegalPage({
  title,
  updated,
  children,
}: {
  title: string;
  updated: string;
  children: React.ReactNode;
}) {
  return (
    <>
      <SiteHeader />
      <main className="bg-halo">
        <div className="mx-auto max-w-3xl px-4 py-14">
          <h1 className="text-3xl font-extrabold tracking-tight sm:text-4xl">{title}</h1>
          <p className="mt-2 text-sm text-ink-400">Última actualización: {updated}</p>
          <div className="prose-ts mt-8">{children}</div>
        </div>
      </main>
      <SiteFooter />
    </>
  );
}
