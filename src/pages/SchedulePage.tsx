import { useMemo, useState } from "react";
import { LoaderCircle, WandSparkles, X } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { notify } from "../components/Notification";
import { ScheduleDetailDrawer } from "../components/ScheduleDetailDrawer";
import { ScheduleGrid } from "../components/ScheduleGrid";
import { getOrderPage } from "../hooks/useOrders";
import { useProduction } from "../hooks/useProduction";
import { JobStatus, MaintenanceType } from "../types";
import type { Order } from "../types";
import { formatDateTime, toJakartaDateTime } from "../utils/dateFormat";
import { parseOptimizationResponse } from "../utils/optimization";
import type { OptimizedSchedule } from "../utils/optimization";
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
const AI_OPTIMIZE_URL = "https://ai.sopra.services/webhook/generate-schedule";
const AI_TIMEOUT_MS = 5 * 60_000;

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
  const { machines, scheduleJobs, maintenanceWindows, moveJob, updateJob, addCorrectiveMaintenance, loadOptimizationContext, applyOptimizationResponse, isLoading } = useProduction({
    machines: { page: 1, pageSize: 100 },
    maintenance: { page: 1, pageSize: 100, startAt: weekStart, endAt: weekEnd },
    schedules: { startAt: weekStart, endAt: weekEnd },
  });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState<string | null>(null);
  const [moveNotice, setMoveNotice] = useState<MoveNotice | null>(null);
  const [applyingOptimization, setApplyingOptimization] = useState(false);
  const [optimizationStage, setOptimizationStage] = useState<"request" | "apply" | null>(null);
  const [optimizationConfirmation, setOptimizationConfirmation] = useState<{
    orders: Order[];
    candidate: OptimizedSchedule;
  } | null>(null);

  const selectedJob = scheduleJobs.find((job) => job.id === selectedJobId) ?? null;
  const selectedMaintenance = maintenanceWindows.find((window) => window.id === selectedMaintenanceId) ?? null;
  const selectedSetupMaintenance = selectedJob ? maintenanceWindows.find((window) =>
    window.type === MaintenanceType.Setup &&
    (window.affectedScheduleId === selectedJob.id ||
      (window.machineId === selectedJob.machineId && Date.parse(window.endAt) === Date.parse(selectedJob.startAt)))
  ) : undefined;
  const selectedMachine = machines.find((machine) => machine.id === (selectedJob?.machineId ?? selectedMaintenance?.machineId));
  const stats = useMemo(() => {
    const active = machines.filter((machine) => machine.isActive).length;
    const inProgress = scheduleJobs.filter((job) => job.status === JobStatus.ProductionProgress).length;
    const overdue = scheduleJobs.filter((job) => job.status !== JobStatus.ProductionComplete && new Date(job.endAt).getTime() > new Date(job.deliveryDate).getTime()).length;
    return { active, total: machines.length, inProgress, overdue, jobs: scheduleJobs.length };
  }, [machines, scheduleJobs]);

  const buildOptimizeRequest = async () => {
      const [firstPage, context] = await Promise.all([
        getOrderPage({ page: 1, pageSize: 100 }),
        loadOptimizationContext(),
      ]);
      const otherPages = await Promise.all(Array.from({ length: firstPage.totalPages - 1 }, (_, index) => getOrderPage({ page: index + 2, pageSize: 100 })));
      const orders = [firstPage, ...otherPages].flatMap((page) => page.items);
      const now = Date.now();
      const optimizable = orders.flatMap((order) => {
        if (Date.parse(order.deliveryDate) <= now) return [];
        return order.items.flatMap((item) => {
          const itemId = Number(item.id);
          const job = context.jobs.find((row) => row.orderLineIds.includes(itemId));
          if (job && (job.isLocked || job.status !== JobStatus.Open || Date.parse(job.endAt) <= now)) return [];
          return [{
            orderId: Number(order.id),
            orderNumber: order.orderNo,
            itemId,
            source: order.sourceType,
            scheduleId: job?.id ?? null,
            machineId: job?.machineId ?? null,
            itemName: item.description,
            quantity: item.qty,
            durationMinutes: job ? Math.round((new Date(job.endAt).getTime() - new Date(job.startAt).getTime()) / 60_000) : null,
            deliveryDate: order.deliveryDate,
            status: job?.status ?? JobStatus.Open,
            startAt: job ? toJakartaDateTime(job.startAt) : null,
            endAt: job ? toJakartaDateTime(job.endAt) : null,
          }];
        });
      });
      const payload = {
      machines: machines.filter((machine) => machine.isActive).map(({ createdAt: _, updatedAt: __, ...machine }) => machine),
      orders: optimizable,
      blockedSlots: context.jobs.filter((job) =>
        Date.parse(job.endAt) > now &&
        job.status !== JobStatus.ProductionComplete &&
        (job.isLocked || job.status === JobStatus.ProductionProgress || job.status === JobStatus.ProductionPending)
      ).map((job) => {
        const order = orders.find((row) => row.scheduleId === job.id || job.sourceOrderRefs?.split(", ").includes(row.orderNo));
        return {
          scheduleId: job.id,
          orderId: order ? Number(order.id) : null,
          itemIds: job.orderLineIds,
          machineId: job.machineId,
          startAt: toJakartaDateTime(job.startAt),
          endAt: toJakartaDateTime(job.endAt),
          status: job.status,
        };
      }),
      maintenance: context.maintenance.filter((window) =>
        window.type !== MaintenanceType.Setup && Date.parse(window.endAt) > now
      ).map((window) => ({
        maintenanceId: window.id,
        machineId: window.machineId,
        startAt: toJakartaDateTime(window.startAt),
        endAt: toJakartaDateTime(window.endAt),
        status: "Routine Maintenance",
        type: window.type,
        frequency: window.scheduleType === "One Time" ? "One Time" : window.repeatType,
        reason: window.reason,
      })),
    };
    return { orders, payload };
  };

  const optimizeSchedule = async () => {
    setApplyingOptimization(true);
    setOptimizationStage("request");
    try {
      const { orders, payload } = await buildOptimizeRequest();
      const response = await fetch(AI_OPTIMIZE_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(AI_TIMEOUT_MS),
      });
      if (!response.ok) throw new Error(`AI optimization failed (${response.status}).`);
      const candidates = parseOptimizationResponse(await response.json() as unknown);
      const candidate = candidates[0];
      setOptimizationConfirmation({ orders, candidate });
    } catch (cause) {
      notify("error", cause instanceof DOMException && cause.name === "TimeoutError"
        ? "AI optimization timed out after 5 minutes."
        : cause instanceof Error ? cause.message : "AI optimization failed.");
    } finally {
      setApplyingOptimization(false);
      setOptimizationStage(null);
    }
  };

  const confirmOptimization = async () => {
    if (!optimizationConfirmation) return;
    const confirmation = optimizationConfirmation;
    setOptimizationConfirmation(null);
    setApplyingOptimization(true);
    setOptimizationStage("apply");
    try {
      await applyOptimizationResponse(confirmation.orders, confirmation.candidate);
    } finally {
      setApplyingOptimization(false);
      setOptimizationStage(null);
    }
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
        actions={<button type="button" disabled={applyingOptimization} onClick={() => void optimizeSchedule()} className={ui.btnSecondary}><WandSparkles size={14} />{applyingOptimization ? "Optimizing..." : "Optimize Schedule"}</button>}
      />

      {optimizationStage && (
        <div role="status" aria-live="polite" className="fixed inset-0 z-[70] flex items-center justify-center bg-white/75 backdrop-blur-[1px]">
          <div className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
            <LoaderCircle size={20} className="animate-spin text-brand-600" />
            {optimizationStage === "request" ? "Optimizing schedule..." : "Applying schedule..."}
          </div>
        </div>
      )}

      {optimizationConfirmation && (
        <div className="notification-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/20 px-4" onMouseDown={(event) => event.target === event.currentTarget && setOptimizationConfirmation(null)}>
          <section role="dialog" aria-modal="true" aria-labelledby="optimization-confirm-title" aria-describedby="optimization-confirm-message" className="notification-panel relative w-full max-w-[400px] overflow-hidden rounded-lg border border-slate-200 bg-white px-7 pb-9 pt-9 text-center shadow-2xl sm:px-8">
            <button type="button" aria-label="Close confirmation" className="absolute right-4 top-4 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" onClick={() => setOptimizationConfirmation(null)}><X size={16} /></button>
            <span className="notification-icon mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-brand-50 text-brand-600"><WandSparkles size={24} strokeWidth={2.2} /></span>
            <div className="notification-content">
              <div className="notification-copy">
                <h2 id="optimization-confirm-title" className="text-xl font-bold tracking-tight text-slate-900">Apply optimized schedule?</h2>
                <p id="optimization-confirm-message" className="mx-auto max-w-[300px] text-sm leading-6 text-slate-500">Apply {optimizationConfirmation.candidate.orderSchedules.length} item schedules and {optimizationConfirmation.candidate.maintenanceSchedules.length} maintenance windows.</p>
              </div>
              <div className="flex justify-center gap-2">
                <button type="button" className={`${ui.btnSecondary} min-w-24 justify-center px-5 py-2.5 text-sm`} onClick={() => setOptimizationConfirmation(null)}>Cancel</button>
                <button type="button" className={`${ui.btnPrimary} min-w-32 justify-center px-6 py-2.5 text-sm`} onClick={() => void confirmOptimization()}>Apply Schedule</button>
              </div>
            </div>
          </section>
        </div>
      )}

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
          setupMaintenance={selectedSetupMaintenance}
          machine={selectedMachine}
          orderRef={selectedJob?.purchaseOrderNumber}
          onSave={selectedJob ? async ({ isLocked, startAt, endAt, correctiveMaintenance }) => {
            if (isLocked !== selectedJob.isLocked || startAt || endAt) {
              const saved = await updateJob(selectedJob.id, {
                isLocked,
                startAt: startAt ?? selectedJob.startAt,
                endAt: endAt ?? selectedJob.endAt,
              });
              if (!saved) return false;
            }
            if (correctiveMaintenance && !await addCorrectiveMaintenance(selectedJob.id, correctiveMaintenance.reason, correctiveMaintenance.estimatedHours)) return false;
            return true;
          } : undefined}
          onClose={() => { setSelectedJobId(null); setSelectedMaintenanceId(null); }}
        />
      )}

      {moveNotice && (
        <aside aria-live="polite" className="fixed bottom-5 right-5 z-50 w-[340px] rounded-lg border border-slate-200 bg-white p-4 shadow-xl">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-sm font-semibold text-slate-950">Schedule dipindahkan</p>
              <p className="mt-1 text-xs text-slate-500">{formatDateTime(moveNotice.startAt)} - {inputTime(new Date(moveNotice.startAt.getTime() + moveNotice.durationMs))} WIB</p>
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
              <button type="button" disabled={invalidEdit} className="text-xs font-semibold text-brand-600 disabled:text-slate-300" onClick={async () => {
                if (!editedStart || !await moveJob(moveNotice.jobId, moveNotice.machineId, editedStart)) return;
                setMoveNotice({ ...moveNotice, startAt: editedStart, editing: false });
              }}>Save time</button>
            ) : (
              <button type="button" className="text-xs font-semibold text-brand-600" onClick={() => setMoveNotice({ ...moveNotice, editing: true })}>Edit time</button>
            )}
          </div>
        </aside>
      )}
    </div>
  );
}
