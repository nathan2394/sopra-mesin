import type { OrderLineItem } from "../types";

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
