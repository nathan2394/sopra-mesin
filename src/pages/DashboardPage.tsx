import { useMemo } from "react";
import { Link } from "react-router-dom";
import { PageHeader } from "../components/PageHeader";
import { useOrders } from "../hooks/useOrders";
import { useProduction } from "../hooks/useProduction";
import { JobStatus } from "../types";
import { formatDate } from "../utils/dateFormat";
import { DataTable } from "../ui/DataTable";
import { StatsRow, StatCard } from "../ui/StatCard";
import * as ui from "../ui/classNames";
import { computeOrderTotals } from "../utils/orderMath";

export function DashboardPage() {
  const { orders } = useOrders();
  const { machines, scheduleJobs } = useProduction({
    machines: { page: 1, pageSize: 100 },
    schedules: {},
  });

  const completedItemIds = useMemo(() => new Set(scheduleJobs
    .filter((job) => job.status === JobStatus.ProductionComplete && job.orderLineId)
    .map((job) => String(job.orderLineId))), [scheduleJobs]);
  const openOrders = useMemo(() => orders.filter((order) =>
    order.items.some((item) => !completedItemIds.has(item.id))), [completedItemIds, orders]);
  const openQty = useMemo(() => openOrders.reduce((sum, order) => sum + order.items
    .filter((item) => !completedItemIds.has(item.id))
    .reduce((itemSum, item) => itemSum + item.qty, 0), 0), [completedItemIds, openOrders]);

  const overdueOrders = useMemo(
    () =>
      openOrders
        .filter((order) => order.deliveryDate)
        .filter((order) => new Date(order.deliveryDate).getTime() < Date.now())
        .sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime()),
    [openOrders]
  );

  const upcoming = useMemo(
    () =>
      openOrders
        .filter((order) => order.deliveryDate)
        .sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime())
        .slice(0, 6),
    [openOrders]
  );

  const activeMachines = machines.filter((machine) => machine.isActive).length;
  const jobsInProgress = scheduleJobs.filter((job) => job.status === JobStatus.ProductionProgress).length;

  return (
    <div className={ui.page}>
      <PageHeader
        breadcrumb={[]}
        title="Dashboard"
        subtitle="Snapshot of open demand and the production line."
      />

      <StatsRow>
        <StatCard value={openOrders.length} label="Open orders" />
        <StatCard value={openQty.toLocaleString()} label="Open qty (pcs)" />
        <StatCard value={`${activeMachines}/${machines.length}`} label="Active machines" />
        <StatCard value={jobsInProgress} label="Jobs in progress" />
        <StatCard value={overdueOrders.length} label="Overdue orders" />
      </StatsRow>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className={ui.card}>
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Upcoming deliveries</h2>
            <Link to="/orders" className={ui.btnLink}>View all orders {"->"}</Link>
          </div>
          <DataTable
            rows={upcoming}
            rowKey={(order) => order.id}
            emptyText="Nothing scheduled."
            containerClassName="overflow-hidden rounded-md border border-slate-200"
            rowClassName={() => "hover:bg-slate-50"}
            columns={[
              { key: "item", header: "Item", cell: (order) => `${order.items[0]?.description ?? "-"}${order.items.length > 1 ? ` +${order.items.length - 1}` : ""}` },
              { key: "customer", header: "Customer", cell: (order) => order.customerName || "-" },
              { key: "qty", header: "Qty", cell: (order) => computeOrderTotals(order.items).qty.toLocaleString() },
              { key: "due", header: "Due", cell: (order) => formatDate(order.deliveryDate) },
            ]}
          />
        </div>

        <div className={ui.card}>
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
            <Link to="/schedule" className={ui.btnLink}>Open schedule {"->"}</Link>
          </div>
          <DataTable
            rows={overdueOrders.slice(0, 6)}
            rowKey={(order) => order.id}
            emptyText="No overdue orders right now."
            containerClassName="overflow-hidden rounded-md border border-slate-200"
            rowClassName={() => "hover:bg-slate-50"}
            columns={[
              { key: "order", header: "Order", cell: (order) => order.orderNo },
              { key: "item", header: "Item", cell: (order) => order.items[0]?.description ?? "-" },
              { key: "due", header: "Due", className: ui.textDanger, cell: (order) => formatDate(order.deliveryDate) },
            ]}
          />
        </div>
      </div>
    </div>
  );
}
