import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { useOrders } from "../hooks/useOrders";
import { useProduction } from "../hooks/useProduction";
import { JobStatus } from "../types";
import type { HotRunner } from "../types";
import { computeOrderTotals } from "../utils/orderMath";
import { formatDate, formatDateTime, wibInputDate } from "../utils/dateFormat";
import { DataTable } from "../ui/DataTable";
import { StatsRow, StatCard } from "../ui/StatCard";
import * as ui from "../ui/classNames";

interface AttentionRow {
  id: string;
  type: string;
  detail: string;
  note: string;
  to: string;
}

export function DashboardPage() {
  const { orders } = useOrders();
  const { machines, maintenanceWindows, scheduleJobs } = useProduction({
    machines: { page: 1, pageSize: 100 },
    maintenance: { page: 1, pageSize: 100, excludeSetup: true },
    schedules: {},
  });
  const [hotRunners, setHotRunners] = useState<HotRunner[]>([]);

  useEffect(() => {
    let active = true;

    const load = () => void api<HotRunner[]>("/hot-runners")
      .then((rows) => {
        if (active) setHotRunners(rows);
      })
      .catch(() => {
        if (active) setHotRunners([]);
      });

    load();
    const timer = window.setInterval(load, 30_000);
    return () => {
      active = false;
      window.clearInterval(timer);
    };
  }, []);

  const completedItemIds = useMemo(() => new Set(scheduleJobs
    .filter((job) => job.status === JobStatus.ProductionComplete && job.orderLineId)
    .map((job) => String(job.orderLineId))), [scheduleJobs]);
  const scheduledItemIds = useMemo(() => new Set(scheduleJobs
    .filter((job) => job.orderLineId)
    .map((job) => String(job.orderLineId))), [scheduleJobs]);
  const openOrders = useMemo(() => orders.filter((order) =>
    order.items.some((item) => !completedItemIds.has(item.id))), [completedItemIds, orders]);
  const today = wibInputDate();
  const now = Date.now();

  const overdueOrders = useMemo(() => openOrders
    .filter((order) => order.deliveryDate && order.deliveryDate.slice(0, 10) < today)
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate)), [openOrders, today]);
  const upcoming = useMemo(() => openOrders
    .filter((order) => order.deliveryDate && order.deliveryDate.slice(0, 10) >= today)
    .sort((a, b) => a.deliveryDate.localeCompare(b.deliveryDate))
    .slice(0, 6), [openOrders, today]);

  const jobsInProgress = scheduleJobs.filter((job) => job.status === JobStatus.ProductionProgress);
  const jobsPending = scheduleJobs.filter((job) => job.status === JobStatus.ProductionPending);
  const activeMaintenance = maintenanceWindows.filter((window) =>
    Date.parse(window.startAt) <= now && Date.parse(window.endAt) > now);
  const criticalHotRunners = hotRunners.filter((row) => row.available <= 0);
  const unscheduledItems = openOrders.flatMap((order) => order.items
    .filter((item) => !scheduledItemIds.has(item.id))
    .map((item) => ({ order, item })));

  const machineRows = useMemo(() => machines
    .filter((machine) => machine.isActive)
    .map((machine) => {
      const currentJob = scheduleJobs
        .filter((job) => job.machineId === machine.id && (
          job.status === JobStatus.ProductionProgress ||
          job.status === JobStatus.ProductionPending))
        .sort((a, b) => Date.parse(b.startAt) - Date.parse(a.startAt))[0];
      const maintenance = activeMaintenance.find((window) => window.machineId === machine.id);
      const nextJob = scheduleJobs
        .filter((job) => job.machineId === machine.id && Date.parse(job.startAt) > now)
        .sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt))[0];

      return {
        id: machine.id,
        lineCode: machine.lineCode,
        status: maintenance ? "Maintenance" : currentJob?.status ?? "Idle",
        order: currentJob?.sourceOrderRefs ?? "—",
        activity: maintenance?.reason ?? currentJob?.productName ?? "—",
        until: maintenance?.endAt ?? currentJob?.endAt,
        next: nextJob
          ? `${nextJob.sourceOrderRefs ?? nextJob.productName} · ${formatDateTime(nextJob.startAt)}`
          : "—",
      };
    })
    .sort((a, b) => a.lineCode.localeCompare(b.lineCode)), [activeMaintenance, machines, now, scheduleJobs]);

  const attentionRows = useMemo<AttentionRow[]>(() => [
    ...jobsPending.map((job) => ({
      id: `pending-${job.id}`,
      type: "Production pending",
      detail: `${machines.find((machine) => machine.id === job.machineId)?.lineCode ?? "Machine"} · ${job.productName}`,
      note: job.blockingMaintenanceReason ?? "Corrective maintenance",
      to: "/schedule",
    })),
    ...criticalHotRunners.map((row) => ({
      id: `hot-runner-${row.id}`,
      type: "Hot runner unavailable",
      detail: `${row.location} · ${row.machine} · cavity ${row.cavity}`,
      note: `${row.available} available`,
      to: "/hot-runner",
    })),
    ...overdueOrders.map((order) => ({
      id: `overdue-${order.id}`,
      type: "Overdue order",
      detail: `${order.orderNo} · ${order.customerName || "No customer"}`,
      note: formatDate(order.deliveryDate),
      to: "/orders",
    })),
    ...unscheduledItems.map(({ order, item }) => ({
      id: `unscheduled-${item.id}`,
      type: "Unscheduled order",
      detail: `${order.orderNo} · ${item.description}`,
      note: "No production schedule",
      to: "/orders",
    })),
  ].slice(0, 10), [criticalHotRunners, jobsPending, machines, overdueOrders, unscheduledItems]);

  const idleMachines = machineRows.filter((machine) => machine.status === "Idle").length;
  const statusClass = (status: string) => status === "Maintenance"
    ? ui.statusCancelled
    : status === JobStatus.ProductionPending
      ? ui.statusInProduction
      : status === JobStatus.ProductionProgress
        ? ui.statusConfirmed
        : ui.statusOpen;

  return (
    <div className={ui.page}>
      <PageHeader
        breadcrumb={[]}
        title="Dashboard"
        subtitle="Live production status, operational risks, and upcoming deliveries."
      />

      <StatsRow>
        <StatCard value={openOrders.length} label="Open orders" />
        <StatCard value={jobsInProgress.length} label="In progress" />
        <StatCard value={jobsPending.length} label="Production pending" />
        <StatCard value={idleMachines} label="Idle machines" />
        <StatCard value={activeMaintenance.length} label="Active maintenance" />
        <StatCard value={unscheduledItems.length} label="Unscheduled items" />
        <StatCard value={overdueOrders.length} label="Overdue orders" />
        <StatCard value={criticalHotRunners.length} label="Hot runner unavailable" />
      </StatsRow>

      <section className={`${ui.card} mb-5`}>
        <div className="mb-3.5 flex items-center justify-between gap-3">
          <h2 className="text-sm font-semibold text-slate-900">Live machine status</h2>
          <Link to="/schedule" className={ui.btnLink}>Open schedule {"->"}</Link>
        </div>
        <DataTable
          rows={machineRows}
          rowKey={(machine) => machine.id}
          emptyText="No active machines."
          containerClassName="overflow-hidden rounded-md border border-slate-200"
          rowClassName={() => "hover:bg-slate-50"}
          columns={[
            { key: "machine", header: "Machine", cell: (machine) => <span className="font-semibold text-slate-800">{machine.lineCode}</span> },
            { key: "status", header: "Status", cell: (machine) => <span className={statusClass(machine.status)}>{machine.status}</span> },
            { key: "order", header: "Current order", cell: (machine) => machine.order },
            { key: "activity", header: "Product / activity", cell: (machine) => machine.activity },
            { key: "until", header: "Until", cell: (machine) => machine.until ? `${formatDateTime(machine.until)} WIB` : "—" },
            { key: "next", header: "Next production", cell: (machine) => machine.next },
          ]}
        />
      </section>

      <div className="grid grid-cols-1 gap-5 xl:grid-cols-[1.1fr_0.9fr]">
        <section className={ui.card}>
          <div className="mb-3.5 flex items-center justify-between gap-3">
            <h2 className="text-sm font-semibold text-slate-900">Needs attention</h2>
            <span className={ui.badgeNeutral}>{attentionRows.length} shown</span>
          </div>
          <DataTable
            rows={attentionRows}
            rowKey={(row) => row.id}
            emptyText="No operational issues right now."
            containerClassName="overflow-hidden rounded-md border border-slate-200"
            rowClassName={() => "hover:bg-slate-50"}
            columns={[
              { key: "type", header: "Issue", cell: (row) => <span className={ui.statusCancelled}>{row.type}</span> },
              { key: "detail", header: "Detail", cell: (row) => row.detail },
              { key: "note", header: "Status", cell: (row) => row.note },
              { key: "action", header: "", className: "text-right", cell: (row) => <Link to={row.to} className={ui.btnLink}>Open</Link> },
            ]}
          />
        </section>

        <section className={ui.card}>
          <div className="mb-3.5 flex items-center justify-between gap-3">
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
              { key: "item", header: "Item", cell: (order) => `${order.items[0]?.description ?? "—"}${order.items.length > 1 ? ` +${order.items.length - 1}` : ""}` },
              { key: "customer", header: "Customer", cell: (order) => order.customerName || "—" },
              { key: "qty", header: "Qty", cell: (order) => computeOrderTotals(order.items).qty.toLocaleString() },
              { key: "due", header: "Due", cell: (order) => formatDate(order.deliveryDate) },
            ]}
          />
        </section>
      </div>
    </div>
  );
}
