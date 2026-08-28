import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useOrders } from "../hooks/useOrders";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { OrderTable, type SortKey } from "../components/OrderTable";
import { OrderForm } from "../components/OrderForm";
import { PageHeader } from "../components/PageHeader";
import { OrderSourceType } from "../types";
import type { Order, OrderDraft } from "../types";
import { computeOrderTotals } from "../utils/orderMath";
import { StatsRow, StatCard } from "../ui/StatCard";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";

const SOURCE_LABEL: Record<OrderSourceType, string> = {
  [OrderSourceType.SoPaid]: "SO Paid",
  [OrderSourceType.ScUnpaid]: "SC Unpaid",
  [OrderSourceType.PiUnpaid]: "PI Unpaid",
  [OrderSourceType.ManualRequest]: "Manual Request",
  [OrderSourceType.ManualForecast]: "Manual Forecast",
};

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
        subtitle="Imported demand and manually entered requests or forecasts."
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
        <span className={ui.muted}>{orders.length} of {pagination.totalItems} shown</span>
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
