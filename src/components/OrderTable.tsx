import { OrderSourceType } from "../types";
import type { Order } from "../types";
import { formatDate } from "../utils/dateFormat";
import { computeOrderTotals } from "../utils/orderMath";
import { DataTable } from "../ui/DataTable";
import * as ui from "../ui/classNames";

export type SortKey = "orderNo" | "customerName" | "customerPoNo" | "qty" | "deliveryDate";

interface Props {
  orders: Order[];
  onEdit: (order: Order) => void;
  onDelete: (order: Order) => void;
  sortKey: SortKey;
  sortDir: "asc" | "desc";
  onSort: (key: SortKey) => void;
  pagination: { page: number; pageSize: number; totalItems: number; totalPages: number };
  onPageChange: (page: number) => void;
  isLoading?: boolean;
}

const SOURCE_LABEL: Record<OrderSourceType, string> = {
  [OrderSourceType.SoPaid]: "SO Paid",
  [OrderSourceType.ScUnpaid]: "SC Unpaid",
  [OrderSourceType.PiUnpaid]: "PI Unpaid",
  [OrderSourceType.ManualRequest]: "Manual Request",
  [OrderSourceType.ManualForecast]: "Manual Forecast",
};

const SOURCE_CLASS: Record<OrderSourceType, string> = {
  [OrderSourceType.SoPaid]: ui.badgeSo,
  [OrderSourceType.ScUnpaid]: ui.badgeSc,
  [OrderSourceType.PiUnpaid]: ui.badgePi,
  [OrderSourceType.ManualRequest]: ui.badgeSc,
  [OrderSourceType.ManualForecast]: ui.badgePi,
};

const sortableHeaderClass = "whitespace-nowrap text-2xs font-semibold uppercase tracking-[0.06em] hover:text-slate-600";

export function OrderTable({ orders, onEdit, onDelete, sortKey, sortDir, onSort, pagination, onPageChange, isLoading }: Props) {
  return <DataTable
    rows={orders}
    rowKey={(order) => order.id}
    emptyText="No orders match your filters."
    isLoading={isLoading}
    rowClassName={() => "hover:bg-slate-50"}
    columns={[
      { key: "source", header: "Source", cell: (order) => <span className={SOURCE_CLASS[order.sourceType]}>{SOURCE_LABEL[order.sourceType]}</span> },
      { key: "orderNo", header: <button type="button" className={sortableHeaderClass} onClick={() => onSort("orderNo")}>Order No.{sortKey === "orderNo" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</button>, cell: (order) => order.orderNo },
      { key: "customer", header: <button type="button" className={sortableHeaderClass} onClick={() => onSort("customerName")}>Customer{sortKey === "customerName" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</button>, cell: (order) => order.customerName || "-" },
      { key: "po", header: <button type="button" className={sortableHeaderClass} onClick={() => onSort("customerPoNo")}>Customer PO #{sortKey === "customerPoNo" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</button>, cell: (order) => order.customerPoNo || "-" },
      { key: "items", header: "Items", cell: (order) => <>{order.items[0]?.description ?? "-"}{order.items.length > 1 && <span className={ui.muted}> +{order.items.length - 1} more</span>}</> },
      { key: "qty", header: <button type="button" className={sortableHeaderClass} onClick={() => onSort("qty")}>Total Qty{sortKey === "qty" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</button>, cell: (order) => computeOrderTotals(order.items).qty.toLocaleString() },
      { key: "delivery", header: <button type="button" className={sortableHeaderClass} onClick={() => onSort("deliveryDate")}>Delivery date{sortKey === "deliveryDate" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</button>, cell: (order) => formatDate(order.deliveryDate) },
      { key: "actions", header: "", className: "whitespace-nowrap text-right", cell: (order) => order.sourceType === OrderSourceType.ManualRequest || order.sourceType === OrderSourceType.ManualForecast ? <><button type="button" className={ui.btnLink} onClick={() => onEdit(order)}>Edit</button><button type="button" className={ui.btnLinkDanger} onClick={() => onDelete(order)}>Delete</button></> : null },
    ]}
    pagination={{ ...pagination, onPageChange, label: "Orders" }}
  />;
}
