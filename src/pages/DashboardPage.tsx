import { useMemo } from "react";
import { Link } from "react-router-dom";
import { useOrders } from "../hooks/useOrders";
import { useProduction } from "../hooks/useProduction";
import { PageHeader } from "../components/PageHeader";
import { StatsRow, StatCard } from "../ui/StatCard";
import * as ui from "../ui/classNames";
import { OrderStatus, JobStatus } from "../types";
import { computeOrderTotals } from "../utils/orderMath";

export function DashboardPage() {
  const { orders } = useOrders();
  const { machines, scheduleJobs } = useProduction();

  const openQty = useMemo(
    () =>
      orders
        .filter((o) => o.status !== OrderStatus.Fulfilled && o.status !== OrderStatus.Cancelled)
        .reduce((sum, o) => sum + computeOrderTotals(o.items).qty, 0),
    [orders]
  );

  const overdueOrders = useMemo(
    () =>
      orders
        .filter(
          (o) =>
            o.status !== OrderStatus.Fulfilled &&
            o.status !== OrderStatus.Cancelled &&
            new Date(o.deliveryDate).getTime() < Date.now()
        )
        .sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime()),
    [orders]
  );

  const upcoming = useMemo(
    () =>
      orders
        .filter((o) => o.status !== OrderStatus.Fulfilled && o.status !== OrderStatus.Cancelled)
        .sort((a, b) => new Date(a.deliveryDate).getTime() - new Date(b.deliveryDate).getTime())
        .slice(0, 6),
    [orders]
  );

  const activeMachines = machines.filter((m) => m.isActive).length;
  const jobsInProgress = scheduleJobs.filter((j) => j.status === JobStatus.InProgress).length;

  return (
    <div className={ui.page}>
      <PageHeader
        breadcrumb={["Production"]}
        title="Dashboard"
        subtitle="Snapshot of open demand and the production line."
      />

      <StatsRow>
        <StatCard value={orders.length} label="Open orders" />
        <StatCard value={openQty.toLocaleString()} label="Open qty (pcs)" />
        <StatCard value={`${activeMachines}/${machines.length}`} label="Active machines" />
        <StatCard value={jobsInProgress} label="Jobs in progress" />
        <StatCard value={overdueOrders.length} label="Overdue orders" />
      </StatsRow>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className={ui.card}>
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[1.05rem]">Upcoming deliveries</h2>
            <Link to="/orders" className={ui.btnLink}>View all orders →</Link>
          </div>
          {upcoming.length === 0 && <p className={ui.muted}>Nothing scheduled.</p>}
          {upcoming.length > 0 && (
            <table className={ui.table}>
              <thead><tr><th className={ui.th}>Item</th><th className={ui.th}>Customer</th><th className={ui.th}>Qty</th><th className={ui.th}>Due</th></tr></thead>
              <tbody>
                {upcoming.map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className={ui.td}>{o.items[0]?.description ?? "—"}{o.items.length > 1 ? ` +${o.items.length - 1}` : ""}</td>
                    <td className={ui.td}>{o.customerName || "—"}</td>
                    <td className={ui.td}>{computeOrderTotals(o.items).qty.toLocaleString()}</td>
                    <td className={ui.td}>{new Date(o.deliveryDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className={ui.card}>
          <div className="mb-3.5 flex items-center justify-between">
            <h2 className="text-[1.05rem]">Needs attention</h2>
            <Link to="/schedule" className={ui.btnLink}>Open schedule →</Link>
          </div>
          {overdueOrders.length === 0 && <p className={ui.muted}>No overdue orders right now.</p>}
          {overdueOrders.length > 0 && (
            <table className={ui.table}>
              <thead><tr><th className={ui.th}>Order</th><th className={ui.th}>Item</th><th className={ui.th}>Due</th></tr></thead>
              <tbody>
                {overdueOrders.slice(0, 6).map((o) => (
                  <tr key={o.id} className="hover:bg-slate-50">
                    <td className={ui.td}>{o.orderNo}</td>
                    <td className={ui.td}>{o.items[0]?.description ?? "—"}</td>
                    <td className={ui.cx(ui.td, ui.textDanger)}>{new Date(o.deliveryDate).toLocaleDateString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
