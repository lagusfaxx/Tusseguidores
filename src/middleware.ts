import { NextResponse, type NextRequest } from "next/server";

/**
 * Flow devuelve al comprador a la URL de retorno con un POST y el token en el
 * cuerpo, no en la URL. Las páginas de retorno son páginas, no rutas de API:
 * no pueden leer ese cuerpo y Next lo trata como si fuera una Server Action.
 * Aquí lo pasamos a un GET con ?token=, que es lo que esas páginas leen.
 */
export async function middleware(request: NextRequest) {
  if (request.method !== "POST") return NextResponse.next();

  let token = "";
  try {
    const form = await request.formData();
    token = String(form.get("token") ?? "");
  } catch {
    // Cuerpo vacío o que no es un formulario: sin token, la página decide.
  }

  const url = request.nextUrl.clone();
  if (token) url.searchParams.set("token", token);
  // 303 para que el navegador siga con GET y no reenvíe el POST.
  return NextResponse.redirect(url, 303);
}

export const config = {
  matcher: ["/pago/retorno", "/panel/saldo/retorno"],
  // En Node y no en edge: con un middleware edge Next compila también
  // instrumentation.ts para edge, y ahí no existe SQLite.
  runtime: "nodejs",
};
