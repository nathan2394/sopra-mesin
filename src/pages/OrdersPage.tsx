import { useEffect, useState } from "react";
import { ArrowDown, ArrowUp, ArrowUpDown, Plus } from "lucide-react";
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

const sortableHeaderClass = "inline-flex items-center gap-1.5 whitespace-nowrap rounded text-xs font-semibold hover:text-brand-600 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600";

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(15);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<OrderSourceType | "All">("All");
  const [sortKey, setSortKey] = useState<SortKey>("deliveryDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);
  const searchQuery = useDebouncedValue(search.trim());
  const { orders, pagination, summary, addOrder, updateOrder, removeOrder, isLoading } = useOrders(
    page,
    pageSize,
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
        <StatCard value={summary.totalOrders} label="Total orders" />
        <StatCard value={summary.soPaid} label="SO Paid" />
        <StatCard value={summary.scUnpaid} label="SC Unpaid" />
        <StatCard value={summary.piUnpaid} label="PI Unpaid" />
        <StatCard value={summary.manualRequest} label="Manual Request" />
        <StatCard value={summary.manualForecast} label="Manual Forecast" />
        <StatCard value={summary.totalQuantity.toLocaleString()} label="Total qty (pcs)" />
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
        onDelete={(order) => { if (window.confirm(`Delete order ${order.orderNo}? This cannot be undone. Cancel to keep the order.`)) void removeOrder(order.id); }}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        pagination={pagination}
        onPageChange={setPage}
        onPageSizeChange={(size) => { setPageSize(size); setPage(1); }}
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
  onPageSizeChange: (size: number) => void;
  isLoading?: boolean;
}

function OrderTable({ orders, onEdit, onDelete, sortKey, sortDir, onSort, pagination, onPageChange, onPageSizeChange, isLoading }: OrderTableProps) {
  const direction = (key: SortKey) => sortKey === key ? (sortDir === "asc" ? "ascending" : "descending") : "none";
  const sortHeader = (key: SortKey, title: string) => {
    const Icon = sortKey === key ? (sortDir === "asc" ? ArrowUp : ArrowDown) : ArrowUpDown;
    return <button type="button" className={sortableHeaderClass} onClick={() => onSort(key)} aria-label={`Sort by ${title}${sortKey === key ? `, currently ${direction(key)}` : ""}`}>{title}<Icon size={13} className={sortKey === key ? "text-brand-600" : "text-slate-400"} /></button>;
  };
  return <DataTable
    rows={orders}
    rowKey={(order) => order.id}
    emptyText="No orders match your filters. Try another search or source."
    isLoading={isLoading}
    tableClassName="min-w-[1050px]"
    columns={[
      { key: "source", header: "Source", className: "whitespace-nowrap", cell: (order) => <span className={SOURCE_CLASS[order.sourceType]}>{SOURCE_LABEL[order.sourceType]}</span> },
      { key: "orderNo", header: sortHeader("orderNo", "Order no."), sortDirection: direction("orderNo"), className: "min-w-36", cell: (order) => <span className="font-semibold text-slate-900">{order.orderNo}</span> },
      { key: "customer", header: sortHeader("customerName", "Customer"), sortDirection: direction("customerName"), className: "min-w-40 max-w-60 break-words", cell: (order) => order.customerName || "—" },
      { key: "po", header: sortHeader("customerPoNo", "Customer PO"), sortDirection: direction("customerPoNo"), className: "min-w-32 max-w-48 break-words", cell: (order) => order.customerPoNo || "—" },
      { key: "items", header: "Items", className: "min-w-60 max-w-80", cell: (order) => <div className="space-y-1"><p className="break-words">{order.items[0]?.description ?? "—"}</p>{order.items.length > 1 && <details className="text-xs"><summary className="w-fit cursor-pointer rounded font-medium text-brand-600 hover:text-brand-700">{order.items.length - 1} more items</summary><ul className="mt-2 space-y-2 border-l-2 border-slate-200 pl-3 text-slate-600">{order.items.slice(1).map((item) => <li key={item.id} className="break-words">{item.description}<span className="mt-0.5 block text-2xs text-slate-400">{item.qty.toLocaleString()} pcs</span></li>)}</ul></details>}</div> },
      { key: "qty", header: sortHeader("qty", "Total qty"), sortDirection: direction("qty"), align: "right", className: "whitespace-nowrap", cell: (order) => <span className="font-medium">{computeOrderTotals(order.items).qty.toLocaleString()}</span> },
      { key: "delivery", header: sortHeader("deliveryDate", "Delivery date"), sortDirection: direction("deliveryDate"), className: "whitespace-nowrap", cell: (order) => formatDate(order.deliveryDate) },
      { key: "actions", header: "", align: "right", className: "whitespace-nowrap", cell: (order) => order.sourceType === OrderSourceType.ManualRequest || order.sourceType === OrderSourceType.ManualForecast ? <div className="inline-flex items-center gap-1"><button type="button" aria-label={`Edit order ${order.orderNo}`} className={ui.btnLink} onClick={() => onEdit(order)}>Edit</button><button type="button" aria-label={`Delete order ${order.orderNo}`} className={ui.btnLinkDanger} onClick={() => onDelete(order)}>Delete</button></div> : <span className="text-2xs text-slate-400">Imported</span> },
    ]}
    pagination={{ ...pagination, onPageChange, onPageSizeChange, label: "Orders" }}
  />;
}
