import { useEffect, useMemo, useState } from "react";
import { useOrders } from "../hooks/useOrders";
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
  const { orders, pagination, updateOrder, isLoading } = useOrders(
    page,
    15,
    search.trim(),
    sourceFilter === "All" ? "" : SOURCE_LABEL[sourceFilter],
    statusFilter === "All" ? "" : statusFilter,
  );
  const [sortKey, setSortKey] = useState<SortKey>("deliveryDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

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

  const visibleOrders = useMemo(() => {
    const sorted = [...orders].sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case "orderNo": cmp = a.orderNo.localeCompare(b.orderNo); break;
        case "customerName": cmp = a.customerName.localeCompare(b.customerName); break;
        case "customerPoNo": cmp = a.customerPoNo.localeCompare(b.customerPoNo); break;
        case "qty": cmp = computeOrderTotals(a.items).qty - computeOrderTotals(b.items).qty; break;
        case "deliveryDate": cmp = new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime(); break;
        case "status": cmp = a.status.localeCompare(b.status); break;
      }
      return sortDir === "asc" ? cmp : -cmp;
    });

    return sorted;
  }, [orders, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
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
        <span className={ui.muted}>{visibleOrders.length} of {pagination.totalItems} shown</span>
      </div>

      <OrderTable
        orders={visibleOrders}
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
