import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { login, currentUser, ensureAdminUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Entrar al panel", robots: { index: false, follow: false } };
export const dynamic = "force-dynamic";

async function signIn(formData: FormData) {
  "use server";
  const email = String(formData.get("email") ?? "");
  const password = String(formData.get("password") ?? "");
  const ok = await login(email, password);
  if (!ok) redirect("/admin/login?error=1");
  redirect("/admin");
}

export default async function AdminLoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  ensureAdminUser();
  if (await currentUser()) redirect("/admin");
  const { error } = await searchParams;

  return (
    <div className="bg-halo grid min-h-screen place-items-center px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 flex items-center justify-center gap-2 font-extrabold">
          <span className="grid h-9 w-9 place-items-center rounded-lg bg-gradient-to-br from-brand-500 to-accent-500">
            TS
          </span>
          <span className="text-lg">Panel de TusSeguidores</span>
        </div>

        <form action={signIn} className="card p-6">
          <label className="field-label" htmlFor="email">Correo</label>
          <input id="email" name="email" type="email" required autoComplete="username" className="field" />

          <label className="field-label mt-4" htmlFor="password">Contraseña</label>
          <input
            id="password"
            name="password"
            type="password"
            required
            autoComplete="current-password"
            className="field"
          />

          {error ? (
            <p role="alert" className="mt-4 rounded-lg border border-red-500/30 bg-red-500/10 px-3 py-2 text-sm text-red-200">
              Correo o contraseña incorrectos.
            </p>
          ) : null}

          <button type="submit" className="btn btn-primary mt-6 w-full">Entrar</button>
        </form>
      </div>
    </div>
  );
}
