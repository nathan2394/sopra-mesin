import { useEffect, useMemo, useState } from "react";
import { useOrders } from "../hooks/useOrders";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { OrderTable, type SortKey } from "../components/OrderTable";
import { PageHeader } from "../components/PageHeader";
import { OrderSourceType, OrderStatus } from "../types";
import type { Order } from "../types";
import { computeOrderTotals } from "../utils/orderMath";
import { StatsRow, StatCard } from "../ui/StatCard";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";

const SOURCE_LABEL: Record<OrderSourceType, string> = {
  [OrderSourceType.SoPaid]: "SO Paid",
  [OrderSourceType.ScUnpaid]: "SC Unpaid",
  [OrderSourceType.PiUnpaid]: "PI Unpaid",
};

export function OrdersPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<OrderSourceType | "All">("All");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "All">("All");
  const [sortKey, setSortKey] = useState<SortKey>("deliveryDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const searchQuery = useDebouncedValue(search.trim());
  const { orders, pagination, updateOrder, isLoading } = useOrders(
    page,
    15,
    searchQuery,
    sourceFilter === "All" ? "" : sourceFilter,
    statusFilter === "All" ? "" : statusFilter,
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
    const openQty = orders
      .filter((o) => o.status !== OrderStatus.Fulfilled && o.status !== OrderStatus.Cancelled)
      .reduce((sum, o) => sum + computeOrderTotals(o.items).qty, 0);
    return {
      total: pagination.totalItems,
      so: bySource(OrderSourceType.SoPaid).length,
      sc: bySource(OrderSourceType.ScUnpaid).length,
      pi: bySource(OrderSourceType.PiUnpaid).length,
      openQty,
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

  const handleStatusChange = (order: Order, status: OrderStatus) => {
    updateOrder(order.id, { ...order, status });
  };

  return (
    <div className={ui.page}>
      <PageHeader
        breadcrumb={[]}
        title="Orders"
        subtitle="Open demand pulled from SO (paid), SC Unpaid and PI Unpaid."
      />

      <StatsRow>
        <StatCard value={stats.total} label="Total orders" />
        <StatCard value={stats.so} label="SO Paid" />
        <StatCard value={stats.sc} label="SC Unpaid" />
        <StatCard value={stats.pi} label="PI Unpaid" />
        <StatCard value={stats.openQty.toLocaleString()} label="Open qty (pcs)" />
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
        <Select
          value={statusFilter}
          onChange={(v) => {
            setStatusFilter(v as OrderStatus | "All");
            setPage(1);
          }}
          buttonClassName={ui.filterSelectButton}
          options={[
            { value: "All", label: "All statuses" },
            ...Object.values(OrderStatus).map((s) => ({ value: s, label: s })),
          ]}
        />
        <span className={ui.muted}>{orders.length} of {pagination.totalItems} shown</span>
      </div>

      <OrderTable
        orders={orders}
        onStatusChange={handleStatusChange}
        sortKey={sortKey}
        sortDir={sortDir}
        onSort={handleSort}
        pagination={pagination}
        onPageChange={setPage}
        isLoading={isLoading}
      />

    </div>
  );
}
