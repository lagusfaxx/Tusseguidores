import { ORDER_STATUS_LABEL, ORDER_STATUS_TONE } from "@/lib/orders";
import type { OrderStatus } from "@/lib/types";

export function StatusBadge({ status }: { status: OrderStatus }) {
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-1 text-xs font-semibold ${
        ORDER_STATUS_TONE[status] ?? ORDER_STATUS_TONE.pending
      }`}
    >
      {ORDER_STATUS_LABEL[status] ?? status}
    </span>
  );
}
