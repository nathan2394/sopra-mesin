import { useMemo, useState } from "react";
import { WandSparkles, X } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { ScheduleDetailDrawer } from "../components/ScheduleDetailDrawer";
import { ScheduleGrid } from "../components/ScheduleGrid";
import { useOrders } from "../hooks/useOrders";
import { useProduction } from "../hooks/useProduction";
import { JobStatus } from "../types";
import { formatDateTime } from "../utils/dateFormat";
import { StatsRow, StatCard } from "../ui/StatCard";
import * as ui from "../ui/classNames";

interface MoveNotice {
  jobId: string;
  machineId: string;
  previousStart: Date;
  startAt: Date;
  durationMs: number;
  editing: boolean;
  editDate: string;
  editTime: string;
}

const inputDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const inputTime = (date: Date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
const displayDateTime = (date: Date) => formatDateTime(date);

export function SchedulePage() {
  const [weekOffset, setWeekOffset] = useState(0);
  const weekStart = useMemo(() => {
    const value = new Date();
    value.setHours(0, 0, 0, 0);
    value.setDate(value.getDate() + weekOffset * 7);
    return value;
  }, [weekOffset]);
  const weekEnd = useMemo(() => {
    const value = new Date(weekStart);
    value.setDate(value.getDate() + 7);
    return value;
  }, [weekStart]);
  const { machines, scheduleJobs, maintenanceWindows, moveJob, updateJob, addCorrectiveMaintenance, isLoading } = useProduction(1, 100, 1, 100, {}, {
    scheduleStartAt: weekStart,
    scheduleEndAt: weekEnd,
  });
  const { orders } = useOrders(1, 100, "", "", "", true);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState<string | null>(null);
  const [moveNotice, setMoveNotice] = useState<MoveNotice | null>(null);

  const selectedJob = scheduleJobs.find((job) => job.id === selectedJobId) ?? null;
  const selectedMaintenance = maintenanceWindows.find((window) => window.id === selectedMaintenanceId) ?? null;
  const selectedMachine = machines.find((machine) => machine.id === (selectedJob?.machineId ?? selectedMaintenance?.machineId));
  const selectedOrder = selectedJob?.sourceOrderRefs
    ? orders.find((order) => order.orderNo === selectedJob.sourceOrderRefs)
    : undefined;

  const stats = useMemo(() => {
    const active = machines.filter((machine) => machine.isActive).length;
    const inProgress = scheduleJobs.filter((job) => job.status === JobStatus.ProductionProgress).length;
    const overdue = scheduleJobs.filter((job) => job.status !== JobStatus.ProductionComplete && new Date(job.endAt).getTime() > new Date(job.deliveryDate).getTime()).length;
    return { active, total: machines.length, inProgress, overdue, jobs: scheduleJobs.length };
  }, [machines, scheduleJobs]);

  const openOptimizePayload = () => {
    const optimizable = orders.flatMap((order) => {
      const job = scheduleJobs.find((row) => row.id === order.scheduleId || row.sourceOrderRefs?.split(", ").includes(order.orderNo));
      if (job && (job.isLocked || job.status !== JobStatus.Open)) return [];
      const item = order.items[0];
      return [{
        orderId: Number(order.id),
        orderNumber: order.orderNo,
        itemId: item ? Number(item.id) : null,
        source: order.sourceType,
        scheduleId: job?.id ?? null,
        machineId: job?.machineId ?? null,
        itemName: job?.productName ?? item?.description ?? null,
        quantity: job?.qty ?? order.items.reduce((total, row) => total + row.qty, 0),
        durationMinutes: job ? Math.round((new Date(job.endAt).getTime() - new Date(job.startAt).getTime()) / 60_000) : null,
        deliveryDate: order.deliveryDate,
        status: job?.status ?? JobStatus.Open,
        startAt: job?.startAt ?? null,
        endAt: job?.endAt ?? null,
      }];
    });
    const payload = {
      machines: machines.filter((machine) => machine.isActive).map(({ createdAt: _, updatedAt: __, ...machine }) => machine),
      orders: optimizable,
      blockedSlots: scheduleJobs.filter((job) =>
        job.status !== JobStatus.ProductionComplete &&
        (job.isLocked || job.status === JobStatus.ProductionProgress || job.status === JobStatus.ProductionPending)
      ).map((job) => {
        const order = orders.find((row) => row.scheduleId === job.id || job.sourceOrderRefs?.split(", ").includes(row.orderNo));
        return {
          scheduleId: job.id,
          orderId: order ? Number(order.id) : null,
          machineId: job.machineId,
          startAt: job.startAt,
          endAt: job.endAt,
          status: job.status,
        };
      }),
      maintenance: maintenanceWindows.filter((window) => new Date(window.endAt).getTime() > Date.now()).map((window) => ({
        maintenanceId: window.id,
        machineId: window.machineId,
        startAt: window.startAt,
        endAt: window.endAt,
        status: "Routine Maintenance",
        type: window.type,
        frequency: window.scheduleType === "One Time" ? "One Time" : window.repeatType,
        reason: window.reason,
      })),
    };
    const tab = window.open("", "_blank");
    if (!tab) return window.alert("Popup diblokir. Izinkan popup untuk melihat payload optimize.");
    tab.opener = null;
    tab.document.title = "Optimize Schedule API Payload";
    tab.document.body.style.cssText = "margin:0;padding:24px;background:#0f172a;color:#e2e8f0;font:13px/1.6 ui-monospace,monospace";
    const pre = tab.document.createElement("pre");
    pre.textContent = JSON.stringify(payload, null, 2);
    tab.document.body.append(pre);
  };

  const handleJobMoved = async (jobId: string, machineId: string, droppedStart: Date) => {
    const job = scheduleJobs.find((row) => row.id === jobId);
    if (!job) return;
    const durationMs = new Date(job.endAt).getTime() - new Date(job.startAt).getTime();
    let startAt = droppedStart;
    if (startAt.getTime() + durationMs <= Date.now()) {
      const halfHour = 30 * 60_000;
      startAt = new Date(Math.ceil((Date.now() + halfHour) / halfHour) * halfHour);
    }
    if (!await moveJob(jobId, machineId, startAt)) return;
    setMoveNotice({
      jobId,
      machineId,
      previousStart: new Date(job.startAt),
      startAt,
      durationMs,
      editing: false,
      editDate: inputDate(startAt),
      editTime: inputTime(startAt),
    });
  };

  const editedStart = moveNotice ? new Date(`${moveNotice.editDate}T${moveNotice.editTime}:00`) : undefined;
  const editedEnd = editedStart && moveNotice && !Number.isNaN(editedStart.getTime()) ? new Date(editedStart.getTime() + moveNotice.durationMs) : undefined;
  const invalidEdit = !editedEnd || editedEnd.getTime() <= Date.now();

  return (
    <div className={ui.page}>
      <PageHeader
        breadcrumb={[]}
        title="Production Schedule"
        subtitle="Drag a bar to reschedule later jobs on that cell automatically. Click a row for job detail, or use Allocation to spot overlaps."
        actions={<button type="button" onClick={openOptimizePayload} className={ui.btnSecondary}><WandSparkles size={14} />Optimize Schedule</button>}
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
        weekStart={weekStart}
        weekEnd={weekEnd}
        onWeekOffsetChange={setWeekOffset}
        isLoading={isLoading}
        onSelectJob={(job) => { setSelectedMaintenanceId(null); setSelectedJobId(job.id); }}
        onSelectMaintenance={(window) => { setSelectedJobId(null); setSelectedMaintenanceId(window.id); }}
        onJobMoved={handleJobMoved}
      />

      {(selectedJob || selectedMaintenance) && (
        <ScheduleDetailDrawer
          key={selectedJob ? `job-${selectedJob.id}` : `maintenance-${selectedMaintenance?.id}`}
          job={selectedJob ?? undefined}
          maintenance={selectedMaintenance ?? undefined}
          machine={selectedMachine}
          orderRef={selectedOrder?.customerPoNo}
          onSave={selectedJob ? async ({ isLocked, startAt, endAt, correctiveMaintenance }) => {
            if (isLocked !== selectedJob.isLocked || startAt || endAt) {
              await updateJob(selectedJob.id, {
                isLocked,
                startAt: startAt ?? selectedJob.startAt,
                endAt: endAt ?? selectedJob.endAt,
              });
            }
            if (correctiveMaintenance) await addCorrectiveMaintenance(selectedJob.id, correctiveMaintenance.reason, correctiveMaintenance.estimatedHours);
          } : undefined}
          onClose={() => { setSelectedJobId(null); setSelectedMaintenanceId(null); }}
        />
      )}

      {moveNotice && (
        <aside aria-live="polite" className="fixed bottom-5 right-5 z-50 w-[340px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Schedule dipindahkan</p>
              <p className="mt-1 text-xs text-slate-500">{displayDateTime(moveNotice.startAt)} - {inputTime(new Date(moveNotice.startAt.getTime() + moveNotice.durationMs))} WIB</p>
            </div>
            <button type="button" aria-label="Close notification" onClick={() => setMoveNotice(null)} className="rounded p-1 text-slate-400 hover:bg-slate-100"><X size={15} /></button>
          </div>
          {moveNotice.editing && (
            <div className="mt-3 grid grid-cols-2 gap-2">
              <input aria-label="New start date" type="date" value={moveNotice.editDate} onChange={(event) => setMoveNotice({ ...moveNotice, editDate: event.target.value })} className="h-9 rounded-md border border-slate-200 px-2 text-xs" />
              <input aria-label="New start time" type="time" value={moveNotice.editTime} onChange={(event) => setMoveNotice({ ...moveNotice, editTime: event.target.value })} className="h-9 rounded-md border border-slate-200 px-2 text-xs" />
              {invalidEdit && <p role="alert" className="col-span-2 text-xs text-red-600">End production harus setelah waktu sekarang.</p>}
            </div>
          )}
          <div className="mt-3 flex gap-2">
            <button type="button" className="text-xs font-semibold text-slate-600 hover:text-slate-950" onClick={async () => {
              if (await moveJob(moveNotice.jobId, moveNotice.machineId, moveNotice.previousStart)) setMoveNotice(null);
            }}>Undo</button>
            {moveNotice.editing ? (
              <button type="button" disabled={invalidEdit} className="text-xs font-semibold text-blue-600 disabled:text-slate-300" onClick={async () => {
                if (!editedStart || !await moveJob(moveNotice.jobId, moveNotice.machineId, editedStart)) return;
                setMoveNotice({ ...moveNotice, startAt: editedStart, editing: false });
              }}>Save time</button>
            ) : (
              <button type="button" className="text-xs font-semibold text-blue-600" onClick={() => setMoveNotice({ ...moveNotice, editing: true })}>Edit time</button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
