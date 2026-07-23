import { useMemo, useState } from "react";
import { useProduction } from "../hooks/useProduction";
import { useOrders } from "../hooks/useOrders";
import { ScheduleGrid } from "../components/ScheduleGrid";
import { PageHeader } from "../components/PageHeader";
import { StatsRow, StatCard } from "../ui/StatCard";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";
import { JobStatus, OrderStatus } from "../types";
import type { ScheduleJob } from "../types";

const JOB_STATUS_CLASS: Record<string, string> = {
  [JobStatus.Planned]: ui.statusPlanned,
  [JobStatus.InProgress]: ui.statusInProgress,
  [JobStatus.Done]: ui.statusDone,
};

const JOB_STATUS_OPTIONS = Object.values(JobStatus).map((s) => ({ value: s, label: s }));

const ORDER_STATUS_CLASS: Record<string, string> = {
  [OrderStatus.Open]: ui.statusOpen,
  [OrderStatus.Confirmed]: ui.statusConfirmed,
  [OrderStatus.Final]: ui.statusConfirmed,
  [OrderStatus.InProduction]: ui.statusInProduction,
  [OrderStatus.Fulfilled]: ui.statusFulfilled,
  [OrderStatus.Cancelled]: ui.statusCancelled,
};

export function SchedulePage() {
  const { machines, scheduleJobs, maintenanceWindows, moveJob, updateJob, removeJob, resetSampleData } =
    useProduction();
  const { orders } = useOrders();
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const selectedJob = scheduleJobs.find((j) => j.id === selectedJobId) ?? null;
  const selectedMachine = selectedJob ? machines.find((m) => m.id === selectedJob.machineId) : null;
  const selectedOrder = selectedJob?.sourceOrderRefs
    ? (orders.find((o) => o.orderNo === selectedJob.sourceOrderRefs) ?? null)
    : null;

  const stats = useMemo(() => {
    const active = machines.filter((m) => m.isActive).length;
    const inProgress = scheduleJobs.filter((j) => j.status === JobStatus.InProgress).length;
    const overdue = scheduleJobs.filter(
      (j) => j.status !== JobStatus.Done && new Date(j.endAt).getTime() > new Date(j.deliveryDate).getTime()
    ).length;
    return { active, total: machines.length, inProgress, overdue, jobs: scheduleJobs.length };
  }, [machines, scheduleJobs]);

  const handleJobMoved = (jobId: string, machineId: string, newBlockStart: Date) => {
    moveJob(jobId, machineId, newBlockStart);
  };

  const handleStatusChange = (job: ScheduleJob, status: (typeof JobStatus)[keyof typeof JobStatus]) => {
    updateJob(job.id, { status });
  };

  const handleDelete = (job: ScheduleJob) => {
    if (window.confirm(`Remove "${job.productName}" from the schedule?`)) {
      removeJob(job.id);
      setSelectedJobId(null);
    }
  };

  const handleReset = () => {
    if (window.confirm("Replace machines, maintenance windows and the schedule with fresh sample data?")) {
      resetSampleData();
      setSelectedJobId(null);
    }
  };

  return (
    <div className={ui.page}>
      <PageHeader
        breadcrumb={["Production", "Schedule"]}
        title="Production Schedule"
        subtitle="Drag a bar to reschedule — later jobs on that cell shift automatically. Click a row for job detail, or use Allocation to spot overlaps."
        actions={<button className={ui.btnSecondary} onClick={handleReset}>Reset sample data</button>}
      />

      <StatsRow>
        <StatCard value={`${stats.active}/${stats.total}`} label="Active machines" />
        <StatCard value={stats.jobs} label="Scheduled jobs" />
        <StatCard value={stats.inProgress} label="In progress" />
        <StatCard value={stats.overdue} label="Running late" />
      </StatsRow>

      <ScheduleGrid
        machines={machines}
        jobs={scheduleJobs}
        maintenanceWindows={maintenanceWindows}
        onSelectJob={(job) => setSelectedJobId(job.id)}
        onJobMoved={handleJobMoved}
      />

      <div className="mt-5 grid grid-cols-1 gap-5 lg:grid-cols-[1.1fr_0.9fr]">
        <div className={ui.card}>
          <h2 className="mb-1.5 text-[1.05rem]">Job detail{selectedJob ? `: ${selectedJob.productName}` : ""}</h2>
          {!selectedJob && <p className={ui.muted}>Click a bar on the Gantt to see its details.</p>}
          {selectedJob && (
            <>
              <table className={ui.table}>
                <tbody>
                  <tr><td className={ui.td}>Machine</td><td className={ui.td}>{selectedMachine?.lineCode ?? "—"}</td></tr>
                  <tr><td className={ui.td}>Qty</td><td className={ui.td}>{selectedJob.qty.toLocaleString()} pcs</td></tr>
                  {selectedJob.setupMinutes > 0 && (
                    <tr><td className={ui.td}>Setup / changeover</td><td className={ui.td}>{selectedJob.setupMinutes} min</td></tr>
                  )}
                  <tr>
                    <td className={ui.td}>Window</td>
                    <td className={ui.td}>{new Date(selectedJob.startAt).toLocaleDateString()} → {new Date(selectedJob.endAt).toLocaleDateString()}</td>
                  </tr>
                  <tr>
                    <td className={ui.td}>Delivery due</td>
                    <td className={ui.cx(ui.td, new Date(selectedJob.endAt) > new Date(selectedJob.deliveryDate) && ui.textDanger)}>
                      {new Date(selectedJob.deliveryDate).toLocaleDateString()}
                    </td>
                  </tr>
                  {selectedJob.sourceOrderRefs && (
                    <>
                      <tr><td className={ui.td}>Order ref</td><td className={ui.td}>{selectedJob.sourceOrderRefs}</td></tr>
                      <tr>
                        <td className={ui.td}>Sales order status</td>
                        <td className={ui.td}>
                          {selectedOrder ? (
                            <span className={ORDER_STATUS_CLASS[selectedOrder.status]}>{selectedOrder.status}</span>
                          ) : (
                            <span className={ui.muted}>Order not found</span>
                          )}
                        </td>
                      </tr>
                    </>
                  )}
                  <tr>
                    <td className={ui.td}>Job status</td>
                    <td className={ui.td}>
                      <Select
                        value={selectedJob.status}
                        onChange={(v) => handleStatusChange(selectedJob, v as ScheduleJob["status"])}
                        options={JOB_STATUS_OPTIONS}
                        buttonClassName={ui.cx(JOB_STATUS_CLASS[selectedJob.status], "relative inline cursor-pointer items-center pr-20 text-center")}
                      />
                    </td>
                  </tr>
                </tbody>
              </table>
              <div className="mt-3 flex justify-start">
                <button className={ui.btnLinkDanger} onClick={() => handleDelete(selectedJob)}>
                  Remove job
                </button>
              </div>
            </>
          )}
        </div>

        <div className={ui.card}>
          <h2 className="mb-2.5 text-[1.05rem]">Running now</h2>
          {scheduleJobs.filter((j) => j.status === JobStatus.InProgress).length === 0 && (
            <p className={ui.muted}>No jobs currently in progress.</p>
          )}
          <table className={ui.table}>
            <thead><tr><th className={ui.th}>Machine</th><th className={ui.th}>Product</th><th className={ui.th}>Qty</th></tr></thead>
            <tbody>
              {scheduleJobs
                .filter((j) => j.status === JobStatus.InProgress)
                .map((j) => (
                  <tr key={j.id} className="cursor-pointer hover:bg-slate-50" onClick={() => setSelectedJobId(j.id)}>
                    <td className={ui.td}>{machines.find((m) => m.id === j.machineId)?.lineCode ?? "—"}</td>
                    <td className={ui.td}>{j.productName}</td>
                    <td className={ui.td}>{j.qty.toLocaleString()}</td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
