import { useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useOrders } from "../hooks/useOrders";
import { OrderForm } from "../components/OrderForm";
import { OrderTable, type SortKey } from "../components/OrderTable";
import { PageHeader } from "../components/PageHeader";
import { OrderSourceType, OrderStatus } from "../types";
import type { Order, OrderDraft } from "../types";
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
  const { orders, addOrder, updateOrder, removeOrder, resetSampleData } = useOrders();

  const [search, setSearch] = useState("");
  const [sourceFilter, setSourceFilter] = useState<OrderSourceType | "All">("All");
  const [statusFilter, setStatusFilter] = useState<OrderStatus | "All">("All");
  const [sortKey, setSortKey] = useState<SortKey>("deliveryDate");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Order | null>(null);

  const stats = useMemo(() => {
    const bySource = (t: OrderSourceType) => orders.filter((o) => o.sourceType === t);
    const openQty = orders
      .filter((o) => o.status !== OrderStatus.Fulfilled && o.status !== OrderStatus.Cancelled)
      .reduce((sum, o) => sum + computeOrderTotals(o.items).qty, 0);
    return {
      total: orders.length,
      so: bySource(OrderSourceType.SoPaid).length,
      sc: bySource(OrderSourceType.ScUnpaid).length,
      pi: bySource(OrderSourceType.PiUnpaid).length,
      openQty,
    };
  }, [orders]);

  const visibleOrders = useMemo(() => {
    let rows = orders;
    if (sourceFilter !== "All") rows = rows.filter((o) => o.sourceType === sourceFilter);
    if (statusFilter !== "All") rows = rows.filter((o) => o.status === statusFilter);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      rows = rows.filter(
        (o) =>
          o.orderNo.toLowerCase().includes(q) ||
          o.customerPoNo.toLowerCase().includes(q) ||
          o.customerName.toLowerCase().includes(q) ||
          o.items.some((it) => it.description.toLowerCase().includes(q))
      );
    }

    const sorted = [...rows].sort((a, b) => {
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
  }, [orders, sourceFilter, statusFilter, search, sortKey, sortDir]);

  const handleSort = (key: SortKey) => {
    if (key === sortKey) {
      setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    } else {
      setSortKey(key);
      setSortDir("asc");
    }
  };

  const openAddForm = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEditForm = (order: Order) => {
    setEditing(order);
    setFormOpen(true);
  };

  const handleSave = (draft: OrderDraft) => {
    if (editing) {
      updateOrder(editing.id, draft);
    } else {
      addOrder(draft);
    }
    setFormOpen(false);
    setEditing(null);
  };

  const handleDelete = (order: Order) => {
    if (window.confirm(`Delete order ${order.orderNo} for ${order.customerName}?`)) {
      removeOrder(order.id);
    }
  };

  const handleStatusChange = (order: Order, status: OrderStatus) => {
    updateOrder(order.id, { ...order, status });
  };

  const handleResetSampleData = () => {
    if (window.confirm("Replace all orders with fresh sample data? This can't be undone.")) {
      resetSampleData();
    }
  };

  return (
    <div className={ui.page}>
      <PageHeader
        breadcrumb={["Production", "Orders"]}
        title="Orders"
        subtitle="Open demand pulled from SO (paid), SC Unpaid and PI Unpaid — add, edit or update status directly."
        actions={
          <>
            <button className={ui.btnSecondary} onClick={handleResetSampleData}>Reset sample data</button>
            <button className={ui.btnPrimary} onClick={openAddForm}><Plus size={15} /> New order</button>
          </>
        }
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
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select
          value={sourceFilter}
          onChange={(v) => setSourceFilter(v as OrderSourceType | "All")}
          buttonClassName={ui.filterSelectButton}
          options={[
            { value: "All", label: "All sources" },
            ...Object.values(OrderSourceType).map((s) => ({ value: s, label: SOURCE_LABEL[s] })),
          ]}
        />
        <Select
          value={statusFilter}
          onChange={(v) => setStatusFilter(v as OrderStatus | "All")}
          buttonClassName={ui.filterSelectButton}
          options={[
            { value: "All", label: "All statuses" },
            ...Object.values(OrderStatus).map((s) => ({ value: s, label: s })),
          ]}
        />
        <span className={ui.muted}>{visibleOrders.length} of {orders.length} shown</span>
      </div>

      <div className={ui.tableCard}>
        <OrderTable
          orders={visibleOrders}
          onEdit={openEditForm}
          onDelete={handleDelete}
          onStatusChange={handleStatusChange}
          sortKey={sortKey}
          sortDir={sortDir}
          onSort={handleSort}
        />
      </div>

      {formOpen && (
        <OrderForm
          initial={editing}
          onSave={handleSave}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
