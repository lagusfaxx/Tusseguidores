import { ImageResponse } from "next/og";

export const runtime = "nodejs";

/**
 * Imagen para redes sociales (1200x630). Se genera al vuelo y se cachea,
 * así no hay que mantener PNG a mano por cada producto.
 */
export function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const title = (searchParams.get("t") ?? "Comprar seguidores en Chile").slice(0, 90);
  const subtitle = (searchParams.get("s") ?? "Entrega automática · Pago con Webpay").slice(0, 110);

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: 72,
          background: "linear-gradient(135deg, #0d0a1a 0%, #1a0f33 55%, #2a0f2b 100%)",
          fontFamily: "sans-serif",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <div
            style={{
              width: 56, height: 56, borderRadius: 14, display: "flex",
              alignItems: "center", justifyContent: "center",
              background: "linear-gradient(135deg,#7c3aed,#ff2e93)",
              color: "#fff", fontSize: 24, fontWeight: 800,
            }}
          >
            TS
          </div>
          <div style={{ color: "#fff", fontSize: 30, fontWeight: 800 }}>TusSeguidores.cl</div>
        </div>

        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ color: "#fff", fontSize: 66, fontWeight: 800, lineHeight: 1.1 }}>{title}</div>
          <div style={{ color: "#b18cff", fontSize: 32, marginTop: 20 }}>{subtitle}</div>
        </div>

        <div style={{ display: "flex", gap: 14 }}>
          {["Sin contraseñas", "Entrega en minutos", "Precios en pesos"].map((tag) => (
            <div
              key={tag}
              style={{
                color: "#e5e0ff", fontSize: 24, padding: "10px 22px", borderRadius: 999,
                border: "1px solid rgba(255,255,255,0.2)", background: "rgba(255,255,255,0.06)",
              }}
            >
              {tag}
            </div>
          ))}
        </div>
      </div>
    ),
    { width: 1200, height: 630 },
  );
}
