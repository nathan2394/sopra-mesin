import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useOrders } from "../hooks/useOrders";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { OrderForm } from "../components/OrderForm";
import { PageHeader } from "../components/PageHeader";
import { OrderSourceType } from "../types";
import type { Order, OrderDraft } from "../types";
import { computeOrderTotals } from "../utils/orderMath";
import { formatDate } from "../utils/dateFormat";
import { DataTable } from "../ui/DataTable";
import { StatsRow, StatCard } from "../ui/StatCard";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";

type SortKey = "orderNo" | "customerName" | "customerPoNo" | "qty" | "deliveryDate";

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

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<OrderSourceType | "All">("All");
  const [sortKey, setSortKey] = useState<SortKey>("deliveryDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const searchQuery = useDebouncedValue(search.trim());
  const { orders, pagination, addOrder, updateOrder, removeOrder, isLoading } = useOrders(
    page,
    15,
    searchQuery,
    sourceFilter === "All" ? "" : sourceFilter,
    sortKey,
    sortDir,
  );

  useEffect(() => {
    if (pagination.totalPages > 0 && page > pagination.totalPages) {
      setPage(pagination.totalPages);
    }
  }, [page, pagination.totalPages]);

  const stats = useMemo(() => {
    const bySource = (t: OrderSourceType) => orders.filter((o) => o.sourceType === t);
    const totalQty = orders.reduce((sum, o) => sum + computeOrderTotals(o.items).qty, 0);
    return {
      total: pagination.totalItems,
      so: bySource(OrderSourceType.SoPaid).length,
      sc: bySource(OrderSourceType.ScUnpaid).length,
      pi: bySource(OrderSourceType.PiUnpaid).length,
      mr: bySource(OrderSourceType.ManualRequest).length,
      mf: bySource(OrderSourceType.ManualForecast).length,
      totalQty,
    };
  }, [orders, pagination.totalItems]);

  const handleSort = (key: SortKey) => {
    setPage(1);
    if (key === sortKey) {
      setSortDir((direction) => (direction === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  return (
    <div className={ui.page}>
      <PageHeader
        breadcrumb={[]}
        title="Orders"
        subtitle="Review imported orders and manage production requests and forecasts."
        actions={<button type="button" className={ui.btnPrimary} onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={15} /> New order</button>}
      />

      <StatsRow>
        <StatCard value={stats.total} label="Total orders" />
        <StatCard value={stats.so} label="SO Paid" />
        <StatCard value={stats.sc} label="SC Unpaid" />
        <StatCard value={stats.pi} label="PI Unpaid" />
        <StatCard value={stats.mr} label="Manual Request" />
        <StatCard value={stats.mf} label="Manual Forecast" />
        <StatCard value={stats.totalQty.toLocaleString()} label="Qty shown (pcs)" />
      </StatsRow>

      <div className={ui.filtersRow}>
        <input
          className={ui.searchInput}
          placeholder="Search order no., PO #, item or customer…"
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />
        <Select
          value={sourceFilter}
          onChange={(v) => {
            setSourceFilter(v as OrderSourceType | "All");
            setPage(1);
          }}
          buttonClassName={ui.filterSelectButton}
          options={[
            { value: "All", label: "All sources" },
            ...Object.values(OrderSourceType).map((s) => ({ value: s, label: SOURCE_LABEL[s] })),
          ]}
        />
        <span className={ui.filterSummary}>{orders.length} of {pagination.totalItems} shown</span>
      </div>

      <OrderTable
        orders={orders}
        onEdit={(order) => { setEditing(order); setFormOpen(true); }}
        onDelete={(order) => { if (window.confirm(`Delete order ${order.orderNo}?`)) void removeOrder(order.id); }}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        pagination={pagination}
        onPageChange={setPage}
        isLoading={isLoading}
      />

      {formOpen && <OrderForm
        initial={editing}
        onSave={(draft: OrderDraft) => editing ? updateOrder(editing.id, draft) : addOrder(draft)}
        onCancel={() => { setFormOpen(false); setEditing(null); }}
      />}

    </div>
  );
}

interface OrderTableProps {
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

function OrderTable({ orders, onEdit, onDelete, sortKey, sortDir, onSort, pagination, onPageChange, isLoading }: OrderTableProps) {
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
