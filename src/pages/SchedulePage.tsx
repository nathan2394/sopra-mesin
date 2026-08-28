import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Check, LoaderCircle, WandSparkles, X } from "lucide-react";
import { PageHeader } from "../components/PageHeader";
import { notify } from "../components/Notification";
import { ScheduleDetailDrawer } from "../components/ScheduleDetailDrawer";
import { ScheduleGrid } from "../components/ScheduleGrid";
import { getOrderPage } from "../hooks/useOrders";
import { useProduction } from "../hooks/useProduction";
import { useScheduleOptimization } from "../hooks/useScheduleOptimization";
import { JobStatus, MaintenanceType } from "../types";
import type { Order, ScheduleJob } from "../types";
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
  cascadedScheduleIds: string[];
}

const inputDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
const inputTime = (date: Date) => `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
export function SchedulePage() {
  const optimization = useScheduleOptimization();
  const [searchParams, setSearchParams] = useSearchParams();
  const reviewedJobId = useRef<number | null>(null);
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
  const { machines, scheduleJobs, maintenanceWindows, moveJob, updateJob, addCorrectiveMaintenance, getScheduleJob, loadOptimizationContext, applyOptimizationResponse, isLoading } = useProduction({
    machines: { page: 1, pageSize: 100 },
    maintenance: { page: 1, pageSize: 100, startAt: weekStart, endAt: weekEnd },
    schedules: { startAt: weekStart, endAt: weekEnd },
  });
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [selectedMaintenanceId, setSelectedMaintenanceId] = useState<string | null>(null);
  const [linkedMaintenanceJob, setLinkedMaintenanceJob] = useState<{ maintenanceId: string; job: ScheduleJob } | null>(null);
  const [moveNotice, setMoveNotice] = useState<MoveNotice | null>(null);
  const [applyingOptimization, setApplyingOptimization] = useState(false);
  const [submittingOptimization, setSubmittingOptimization] = useState(false);
  const [optimizationStage, setOptimizationStage] = useState<"apply" | null>(null);
  const [optimizationConfirmation, setOptimizationConfirmation] = useState<{
    jobId: number;
    orders: Order[];
    optimizedItemIds: number[];
    deleteCount: number;
    candidate: OptimizedSchedule;
  } | null>(null);

  useEffect(() => {
    if (!moveNotice || moveNotice.editing) return;
    const timer = window.setTimeout(() => setMoveNotice(null), 4_000);
    return () => window.clearTimeout(timer);
  }, [moveNotice]);

  const selectedJob = scheduleJobs.find((job) => job.id === selectedJobId) ?? null;
  const selectedMaintenance = maintenanceWindows.find((window) => window.id === selectedMaintenanceId) ?? null;
  const selectedSetupMaintenance = selectedJob ? maintenanceWindows.find((window) =>
    window.type === MaintenanceType.Setup &&
    (window.affectedScheduleId === selectedJob.id ||
      (window.machineId === selectedJob.machineId && Date.parse(window.endAt) === Date.parse(selectedJob.startAt)))
  ) : undefined;
  const selectedCorrectiveMaintenance = selectedJob ? maintenanceWindows.find((window) =>
    window.type === MaintenanceType.Corrective && window.affectedScheduleId === selectedJob.id
  ) : undefined;
  const visibleSelectedMaintenanceJob = selectedMaintenance ? scheduleJobs.find((job) =>
    selectedMaintenance.affectedScheduleId === job.id ||
    (selectedMaintenance.type === MaintenanceType.Setup && selectedMaintenance.machineId === job.machineId &&
      Date.parse(selectedMaintenance.endAt) === Date.parse(job.startAt))
  ) : undefined;
  useEffect(() => {
    const maintenanceId = selectedMaintenance?.id;
    const scheduleId = selectedMaintenance?.affectedScheduleId;
    if (!maintenanceId || !scheduleId || visibleSelectedMaintenanceJob) return;
    let active = true;
    void getScheduleJob(scheduleId).then((job) => {
      if (active && job) setLinkedMaintenanceJob({ maintenanceId, job });
    });
    return () => { active = false; };
  }, [getScheduleJob, selectedMaintenance?.affectedScheduleId, selectedMaintenance?.id, visibleSelectedMaintenanceJob]);
  const selectedMaintenanceJob = visibleSelectedMaintenanceJob ??
    (linkedMaintenanceJob && linkedMaintenanceJob.maintenanceId === selectedMaintenance?.id ? linkedMaintenanceJob.job : undefined);
  const selectedMachine = machines.find((machine) => machine.id === (selectedJob?.machineId ?? selectedMaintenance?.machineId));
  const stats = useMemo(() => {
    const active = machines.filter((machine) => machine.isActive).length;
    const inProgress = scheduleJobs.filter((job) => job.status === JobStatus.ProductionProgress).length;
    const overdue = scheduleJobs.filter((job) => job.status !== JobStatus.ProductionComplete && new Date(job.endAt).getTime() > new Date(job.deliveryDate).getTime()).length;
    return { active, total: machines.length, inProgress, overdue, jobs: scheduleJobs.length };
  }, [machines, scheduleJobs]);

  const loadOrders = async () => {
    const firstPage = await getOrderPage({ page: 1, pageSize: 100 });
    const otherPages = await Promise.all(Array.from({ length: firstPage.totalPages - 1 }, (_, index) => getOrderPage({ page: index + 2, pageSize: 100 })));
    return [firstPage, ...otherPages].flatMap((page) => page.items);
  };

  const buildOptimizeRequest = async () => {
      const [orders, context] = await Promise.all([
        loadOrders(),
        loadOptimizationContext(),
      ]);
      const now = Date.now();
      const historyStart = now - 7 * 24 * 60 * 60_000;
      const activeMachines = machines.filter((machine) => machine.isActive);
      const isBlocked = (job: typeof context.jobs[number]) =>
        Date.parse(job.endAt) > now &&
        job.status !== JobStatus.ProductionComplete &&
        (job.isLocked || job.status === JobStatus.ProductionProgress || job.status === JobStatus.ProductionPending);
      const optimizable = orders.flatMap((order) => {
        const deliveryAt = Date.parse(order.deliveryDate);
        if (order.deliveryDate && (!Number.isFinite(deliveryAt) || deliveryAt <= now)) return [];
        return order.items.flatMap((item) => {
          const itemId = Number(item.id);
          const job = context.jobs.find((row) => row.orderLineId === itemId);
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
            deliveryDate: order.deliveryDate || null,
            status: job?.status ?? JobStatus.Open,
            startAt: job ? toJakartaDateTime(job.startAt) : null,
            endAt: job ? toJakartaDateTime(job.endAt) : null,
          }];
        });
      });
      const payload = {
      machines: activeMachines.map(({ createdAt: _, updatedAt: __, ...machine }) => machine),
      machineHistory: activeMachines.map((machine) => ({
        machineId: Number(machine.id),
        productions: context.jobs
          .filter((job) => job.machineId === machine.id &&
            ((Date.parse(job.startAt) < now && Date.parse(job.endAt) >= historyStart) || isBlocked(job)))
          .sort((left, right) => Date.parse(left.startAt) - Date.parse(right.startAt))
          .map((job) => ({
            scheduleId: Number(job.id),
            itemId: job.orderLineId,
            orderNumber: job.sourceOrderRefs ?? null,
            itemCode: job.itemCode ?? null,
            itemName: job.productName,
            preform: job.preform ?? null,
            cavity: job.cavity ?? null,
            quantity: job.qty,
            startAt: toJakartaDateTime(job.startAt),
            endAt: toJakartaDateTime(job.endAt),
            status: job.status,
          })),
      })),
      orders: optimizable,
      blockedSlots: context.jobs.filter(isBlocked).map((job) => {
        const order = orders.find((row) => job.sourceOrderRefs === row.orderNo);
        return {
          scheduleId: job.id,
          orderId: order ? Number(order.id) : null,
          itemId: job.orderLineId,
          machineId: job.machineId,
          preform: job.preform ?? null,
          cavity: job.cavity ?? null,
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
    setSubmittingOptimization(true);
    try {
      const { payload } = await buildOptimizeRequest();
      await optimization.start(payload);
    } catch (cause) {
      notify("error", cause instanceof Error ? cause.message : "AI optimization failed.");
    } finally {
      setSubmittingOptimization(false);
    }
  };

  const optimizationJobId = Number(searchParams.get("optimizationJob"));
  useEffect(() => {
    if (!Number.isInteger(optimizationJobId) || optimizationJobId <= 0 || reviewedJobId.current === optimizationJobId) return;
    reviewedJobId.current = optimizationJobId;
    void (async () => {
      try {
        const [detail, orders] = await Promise.all([optimization.get(optimizationJobId), loadOrders()]);
        if (!detail.response) throw new Error(detail.job.errorMessage ?? "Optimization result is not ready.");
        const request = detail.request as { orders?: Array<{ itemId: number; scheduleId?: string | null }> };
        const requestedOrders = request.orders ?? [];
        const candidate = parseOptimizationResponse(detail.response)[0];
        const returnedItemIds = new Set(candidate.orderSchedules.map((row) => row.itemId));
        const deleteCount = new Set(requestedOrders
          .filter((row) => row.scheduleId && !returnedItemIds.has(row.itemId))
          .map((row) => row.scheduleId)).size;
        setOptimizationConfirmation({
          jobId: optimizationJobId,
          orders,
          optimizedItemIds: requestedOrders.map((row) => row.itemId),
          deleteCount,
          candidate,
        });
        const next = new URLSearchParams(searchParams);
        next.delete("optimizationJob");
        setSearchParams(next, { replace: true });
        await optimization.refresh();
      } catch (cause) {
        reviewedJobId.current = null;
        notify("error", cause instanceof Error ? cause.message : "Optimization result could not be opened.");
      }
    })();
  }, [optimization, optimizationJobId, searchParams, setSearchParams]);

  const confirmOptimization = async () => {
    if (!optimizationConfirmation) return;
    const confirmation = optimizationConfirmation;
    setOptimizationConfirmation(null);
    setApplyingOptimization(true);
    setOptimizationStage("apply");
    try {
      if (await applyOptimizationResponse(confirmation.orders, confirmation.candidate, confirmation.optimizedItemIds))
        await optimization.markApplied(confirmation.jobId);
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
    const cascadedScheduleIds = await moveJob(jobId, machineId, startAt);
    if (!cascadedScheduleIds) return;
    setMoveNotice({
      jobId,
      machineId,
      previousStart: new Date(job.startAt),
      startAt,
      durationMs,
      editing: false,
      editDate: inputDate(startAt),
      editTime: inputTime(startAt),
      cascadedScheduleIds,
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
        actions={<button type="button" disabled={applyingOptimization || submittingOptimization || optimization.busy} onClick={() => void optimizeSchedule()} className={ui.btnSecondary}><WandSparkles size={14} />{optimization.busy ? "Optimization running" : submittingOptimization ? "Starting..." : "Optimize Schedule"}</button>}
      />

      {optimizationStage && (
        <div role="status" aria-live="polite" className="fixed inset-0 z-[70] flex items-center justify-center bg-white/75 backdrop-blur-[1px]">
          <div className="flex items-center gap-2.5 text-sm font-medium text-slate-700">
            <LoaderCircle size={20} className="animate-spin text-brand-600" />
            Applying schedule...
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
                <p id="optimization-confirm-message" className="mx-auto max-w-[300px] text-sm leading-6 text-slate-500">Apply {optimizationConfirmation.candidate.orderSchedules.length} item schedules, remove {optimizationConfirmation.deleteCount} omitted schedules, and apply {optimizationConfirmation.candidate.maintenanceSchedules.length} maintenance windows.</p>
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
          linkedCorrectiveMaintenance={selectedCorrectiveMaintenance}
          linkedJob={selectedMaintenanceJob}
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
        <aside aria-live="polite" className="notification-panel fixed bottom-5 right-5 z-50 w-[320px] overflow-hidden rounded-lg border border-slate-200 bg-white p-3.5 shadow-xl">
          <div className="flex items-start gap-3">
            <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-50 text-emerald-600"><Check size={16} strokeWidth={2.4} /></span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-slate-900">Schedule updated</p>
              <p className="mt-0.5 truncate text-xs tabular-nums text-slate-500">{formatDateTime(moveNotice.startAt)} → {inputTime(new Date(moveNotice.startAt.getTime() + moveNotice.durationMs))} WIB</p>
            </div>
            <button type="button" aria-label="Close notification" onClick={() => setMoveNotice(null)} className="rounded-md p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"><X size={15} /></button>
          </div>
          {moveNotice.editing && (
            <div className="mt-3 grid grid-cols-2 gap-2 pl-11">
              <input aria-label="New start date" type="date" value={moveNotice.editDate} onChange={(event) => setMoveNotice({ ...moveNotice, editDate: event.target.value })} className="h-9 rounded-md border border-slate-200 px-2 text-xs" />
              <input aria-label="New start time" type="time" value={moveNotice.editTime} onChange={(event) => setMoveNotice({ ...moveNotice, editTime: event.target.value })} className="h-9 rounded-md border border-slate-200 px-2 text-xs" />
              {invalidEdit && <p role="alert" className="col-span-2 text-xs text-red-600">Production must end after the current time.</p>}
            </div>
          )}
          <div className="mt-2.5 flex gap-3 pl-11">
            <button type="button" className="text-xs font-semibold text-slate-500 transition hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" onClick={async () => {
              if (await moveJob(moveNotice.jobId, moveNotice.machineId, moveNotice.previousStart, moveNotice.cascadedScheduleIds)) setMoveNotice(null);
            }}>Undo</button>
            {moveNotice.editing ? (
              <button type="button" disabled={invalidEdit} className="text-xs font-semibold text-brand-600 transition hover:text-brand-700 disabled:text-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" onClick={async () => {
                if (!editedStart) return;
                const movedIds = await moveJob(moveNotice.jobId, moveNotice.machineId, editedStart,
                  editedStart < moveNotice.startAt ? moveNotice.cascadedScheduleIds : undefined);
                if (!movedIds) return;
                setMoveNotice({ ...moveNotice, startAt: editedStart, editing: false,
                  cascadedScheduleIds: [...new Set([...moveNotice.cascadedScheduleIds, ...movedIds])] });
              }}>Save time</button>
            ) : (
              <button type="button" className="text-xs font-semibold text-brand-600 transition hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" onClick={() => setMoveNotice({ ...moveNotice, editing: true })}>Edit time</button>
            )}
          </div>
          {!moveNotice.editing && <span key={`${moveNotice.jobId}-${moveNotice.startAt.getTime()}`} aria-hidden="true" className="notification-progress absolute inset-x-0 bottom-0 h-1 bg-brand-500" />}
        </aside>
      )}

    </div>
  );
}
