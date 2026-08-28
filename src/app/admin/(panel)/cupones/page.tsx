import { all } from "@/lib/db";
import { deleteCoupon } from "@/app/admin/actions";
import { CouponForm } from "@/components/coupon-form";
import { formatClp } from "@/lib/pricing";
import { formatDateCl } from "@/lib/utils";

export const dynamic = "force-dynamic";

type Coupon = {
  code: string; kind: string; value: number; min_clp: number;
  max_uses: number; used: number; active: number; expires_at: string | null; created_at: string;
};

export default async function AdminCouponsPage() {
  const coupons = all<Coupon>("SELECT * FROM coupons ORDER BY created_at DESC");

  return (
    <>
      <h1 className="text-2xl font-bold">Cupones</h1>
      <p className="mt-1 text-sm text-ink-400">
        El cliente los escribe en la ficha del producto, en «¿Tienes un cupón?».
      </p>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_1.4fr]">
        <CouponForm />

        <div className="card overflow-x-auto">
          <table className="admin-table">
            <thead>
              <tr>
                <th>Código</th><th>Descuento</th><th>Mínimo</th><th>Usos</th>
                <th>Vence</th><th>Estado</th><th></th>
              </tr>
            </thead>
            <tbody>
              {coupons.map((coupon) => (
                <tr key={coupon.code}>
                  <td className="font-mono font-semibold">{coupon.code}</td>
                  <td>{coupon.kind === "fixed" ? formatClp(coupon.value) : `${coupon.value}%`}</td>
                  <td className="text-ink-400">{coupon.min_clp ? formatClp(coupon.min_clp) : "—"}</td>
                  <td className="text-ink-400">
                    {coupon.used}{coupon.max_uses ? ` / ${coupon.max_uses}` : ""}
                  </td>
                  <td className="text-xs text-ink-400">
                    {coupon.expires_at ? formatDateCl(coupon.expires_at) : "Sin vencimiento"}
                  </td>
                  <td>
                    <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                      coupon.active ? "bg-lime-500/15 text-lime-400" : "bg-white/8 text-ink-400"
                    }`}>
                      {coupon.active ? "Activo" : "Inactivo"}
                    </span>
                  </td>
                  <td className="text-right">
                    <form action={deleteCoupon} className="inline">
                      <input type="hidden" name="code" value={coupon.code} />
                      <button type="submit" className="text-xs text-red-300 hover:text-red-200">Eliminar</button>
                    </form>
                  </td>
                </tr>
              ))}
              {coupons.length === 0 ? (
                <tr><td colSpan={7} className="py-10 text-center text-ink-400">Todavía no hay cupones.</td></tr>
              ) : null}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
