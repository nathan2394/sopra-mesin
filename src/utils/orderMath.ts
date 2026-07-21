import type { Order, OrderDraft, OrderLineItem } from "../types";

export interface OrderTotals {
  qty: number;
  workHours: number;
}

/** Rolls up an order's line items into the header summary figures shown on the
 * Customer Order screen (Total Qty / Total Work Hour). */
export function computeOrderTotals(items: OrderLineItem[]): OrderTotals {
  const qty = items.reduce((sum, it) => sum + (it.qty || 0), 0);
  // Illustrative line-time estimate (not a real capacity model): ~1.1h per 1,000 pcs.
  const workHours = (qty / 1000) * 1.1;
  return {
    qty,
    workHours: Number(workHours.toFixed(2)),
  };
}

/** Lead time in days between the PO date and the ship window closing — matches the
 * reference form's read-only "Lead Time" field. */
export function computeLeadTimeDays(
  order: Pick<Order, "poDate" | "poShipEnd"> | Pick<OrderDraft, "poDate" | "poShipEnd">
): number {
  if (!order.poDate || !order.poShipEnd) return 0;
  const start = new Date(order.poDate).getTime();
  const end = new Date(order.poShipEnd).getTime();
  if (Number.isNaN(start) || Number.isNaN(end)) return 0;
  return Math.max(0, Math.round((end - start) / 86_400_000));
}
