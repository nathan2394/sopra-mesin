import { OrderSourceType, OrderStatus } from "../types";
import type { Order } from "../types";
import { formatDate } from "../utils/dateFormat";
import { computeOrderTotals } from "../utils/orderMath";
import { DataTable } from "../ui/DataTable";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";

const STATUS_OPTIONS = Object.values(OrderStatus).map((status) => ({ value: status, label: status }));

export type SortKey = "orderNo" | "customerName" | "customerPoNo" | "qty" | "deliveryDate" | "status";

interface Props {
  orders: Order[];
  onStatusChange: (order: Order, status: OrderStatus) => void;
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

const sortableHeaderClass = "whitespace-nowrap text-2xs font-semibold uppercase tracking-[0.06em] hover:text-slate-600";

export function OrderTable({ orders, onStatusChange, sortKey, sortDir, onSort, pagination, onPageChange, isLoading }: Props) {
  return <DataTable
    rows={orders}
    rowKey={(order) => order.id}
    emptyText="No orders match your filters."
    isLoading={isLoading}
    rowClassName={(order) => order.status !== OrderStatus.Fulfilled && order.status !== OrderStatus.Cancelled && new Date(order.deliveryDate).getTime() < Date.now() ? "bg-orange-50/60" : "hover:bg-slate-50"}
    columns={[
      { key: "source", header: "Source", cell: (order) => <span className={SOURCE_CLASS[order.sourceType]}>{SOURCE_LABEL[order.sourceType]}</span> },
      { key: "orderNo", header: <button type="button" className={sortableHeaderClass} onClick={() => onSort("orderNo")}>Order No.{sortKey === "orderNo" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</button>, cell: (order) => order.orderNo },
      { key: "customer", header: <button type="button" className={sortableHeaderClass} onClick={() => onSort("customerName")}>Customer{sortKey === "customerName" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</button>, cell: (order) => order.customerName || "-" },
      { key: "po", header: <button type="button" className={sortableHeaderClass} onClick={() => onSort("customerPoNo")}>Customer PO #{sortKey === "customerPoNo" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</button>, cell: (order) => order.customerPoNo || "-" },
      { key: "items", header: "Items", cell: (order) => <>{order.items[0]?.description ?? "-"}{order.items.length > 1 && <span className={ui.muted}> +{order.items.length - 1} more</span>}</> },
      { key: "qty", header: <button type="button" className={sortableHeaderClass} onClick={() => onSort("qty")}>Total Qty{sortKey === "qty" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</button>, cell: (order) => computeOrderTotals(order.items).qty.toLocaleString() },
      { key: "delivery", header: <button type="button" className={sortableHeaderClass} onClick={() => onSort("deliveryDate")}>Delivery date{sortKey === "deliveryDate" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</button>, cell: (order) => { const overdue = order.status !== OrderStatus.Fulfilled && order.status !== OrderStatus.Cancelled && new Date(order.deliveryDate).getTime() < Date.now(); return <span className={overdue ? ui.textDanger : ""}>{formatDate(order.deliveryDate)}{overdue ? " - overdue" : ""}</span>; } },
      { key: "status", header: <button type="button" className={sortableHeaderClass} onClick={() => onSort("status")}>Status{sortKey === "status" ? (sortDir === "asc" ? " ▲" : " ▼") : ""}</button>, cell: (order) => <Select value={order.status} onChange={(value) => onStatusChange(order, value as OrderStatus)} options={STATUS_OPTIONS} buttonClassName={ui.cx(STATUS_CLASS[order.status], "relative inline-flex cursor-pointer items-center pr-6")} /> },
    ]}
    pagination={{ ...pagination, onPageChange, label: "Orders" }}
  />;
}
