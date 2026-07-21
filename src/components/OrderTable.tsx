import { OrderSourceType, OrderStatus } from "../types";
import type { Order } from "../types";
import { computeOrderTotals } from "../utils/orderMath";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";

const STATUS_OPTIONS = Object.values(OrderStatus).map((s) => ({ value: s, label: s }));

interface Props {
  orders: Order[];
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
  onStatusChange: (order: Order, status: OrderStatus) => void;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}

export type SortKey = "orderNo" | "customerName" | "customerPoNo" | "qty" | "deliveryDate" | "status";

const SOURCE_LABEL: Record<OrderSourceType, string> = {
  [OrderSourceType.SoPaid]: "SO Paid",
  [OrderSourceType.ScUnpaid]: "SC Unpaid",
  [OrderSourceType.PiUnpaid]: "PI Unpaid",
};

const SOURCE_CLASS: Record<OrderSourceType, string> = {
  [OrderSourceType.SoPaid]: ui.badgeSo,
  [OrderSourceType.ScUnpaid]: ui.badgeSc,
  [OrderSourceType.PiUnpaid]: ui.badgePi,
};

const STATUS_CLASS: Record<OrderStatus, string> = {
  [OrderStatus.Open]: ui.statusOpen,
  [OrderStatus.Confirmed]: ui.statusConfirmed,
  [OrderStatus.Final]: ui.statusConfirmed,
  [OrderStatus.InProduction]: ui.statusInProduction,
  [OrderStatus.Fulfilled]: ui.statusFulfilled,
  [OrderStatus.Cancelled]: ui.statusCancelled,
};

function isOverdue(order: Order): boolean {
  if (order.status === OrderStatus.Fulfilled || order.status === OrderStatus.Cancelled) return false;
  return new Date(order.deliveryDate).getTime() < Date.now();
}

function SortHeader({
  label,
  sortKeyValue,
  sortKey,
  sortDir,
  onSort,
}: {
  label: string;
  sortKeyValue: SortKey;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
}) {
  const active = sortKey === sortKeyValue;
  return (
    <th className={ui.cx(ui.th, "cursor-pointer select-none hover:text-slate-600")} onClick={() => onSort(sortKeyValue)}>
      {label}
      {active ? (sortDir === "asc" ? " ▲" : " ▼") : ""}
    </th>
  );
}

export function OrderTable({ orders, onEdit, onDelete, onStatusChange, sortKey, sortDir, onSort }: Props) {
  if (orders.length === 0) {
    return <p className={ui.cx(ui.muted, "p-5")}>No orders match your filters.</p>;
  }

  return (
    <table className={ui.table}>
      <thead>
        <tr>
          <th className={ui.th}>Source</th>
          <SortHeader label="Order No." sortKeyValue="orderNo" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          <SortHeader label="Customer" sortKeyValue="customerName" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          <SortHeader label="Customer PO #" sortKeyValue="customerPoNo" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          <th className={ui.th}>Items</th>
          <SortHeader label="Total Qty" sortKeyValue="qty" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          <SortHeader label="Delivery date" sortKeyValue="deliveryDate" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          <SortHeader label="Status" sortKeyValue="status" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
          <th className={ui.th}></th>
        </tr>
      </thead>
      <tbody>
        {orders.map((o) => {
          const totals = computeOrderTotals(o.items);
          const primaryDescription = o.items[0]?.description ?? "—";
          const overdue = isOverdue(o);
          return (
            <tr key={o.id} className={overdue ? "bg-orange-50/60" : "hover:bg-slate-50"}>
              <td className={ui.td}><span className={SOURCE_CLASS[o.sourceType]}>{SOURCE_LABEL[o.sourceType]}</span></td>
              <td className={ui.td}>{o.orderNo}</td>
              <td className={ui.td}>{o.customerName || "—"}</td>
              <td className={ui.td}>{o.customerPoNo || "—"}</td>
              <td className={ui.td}>
                {primaryDescription}
                {o.items.length > 1 ? <span className={ui.muted}> +{o.items.length - 1} more</span> : null}
              </td>
              <td className={ui.td}>{totals.qty.toLocaleString()}</td>
              <td className={ui.cx(ui.td, overdue && ui.textDanger)}>
                {new Date(o.deliveryDate).toLocaleDateString()}
                {overdue ? " · overdue" : ""}
              </td>
              <td className={ui.td}>
                <Select
                  value={o.status}
                  onChange={(v) => onStatusChange(o, v as OrderStatus)}
                  options={STATUS_OPTIONS}
                  buttonClassName={ui.cx(STATUS_CLASS[o.status], "relative inline-flex cursor-pointer items-center pr-6")}
                />
              </td>
              <td className={ui.cx(ui.td, "text-right whitespace-nowrap")}>
                <button className={ui.btnLink} onClick={() => onEdit(o)}>Edit</button>
                <button className={ui.btnLinkDanger} onClick={() => onDelete(o)}>Delete</button>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
