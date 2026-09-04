import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle, LockKeyhole, Search, Wrench } from "lucide-react";
import { JobStatus, MaintenanceType, maintenanceTypeLabel } from "../types";
import type { Machine, MaintenanceWindow, ScheduleJob } from "../types";
import { addWibDays, formatDate, formatMonthDay, formatScheduleDateTime, wibInputDate, wibInputDateTime, wibInputTime, wibStartOfDay } from "../utils/dateFormat";
import { Select } from "../ui/Select";
import { ScheduleBlock } from "./ScheduleBlock";
import * as ui from "../ui/classNames";

interface Props {
  machines: Machine[];
  jobs: ScheduleJob[];
  maintenanceWindows: MaintenanceWindow[];
  weekStart: Date;
  weekEnd: Date;
  onWeekOffsetChange: React.Dispatch<React.SetStateAction<number>>;
  isLoading?: boolean;
  onSelectJob?: (job: ScheduleJob) => void;
  onSelectMaintenance?: (window: MaintenanceWindow) => void;
  onJobMoved?: (jobId: string, machineId: string, newBlockStart: Date) => void;
}

const INFO_COLS = "minmax(0,8fr) minmax(0,8fr) minmax(0,10fr) minmax(0,19fr)";
const GRID_COLS = `${INFO_COLS} minmax(0,55fr)`;

export function ScheduleGrid({ machines, jobs, maintenanceWindows, weekStart, weekEnd, onWeekOffsetChange, isLoading, onSelectJob, onSelectMaintenance, onJobMoved }: Props) {
  const [machineId, setMachineId] = useState("All");
  const [search, setSearch] = useState("");
  const [collapsedMachines, setCollapsedMachines] = useState<Set<string>>(new Set());
  const stickySentinelRef = useRef<HTMLDivElement>(null);
  const headerScrollRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);
  useEffect(() => {
    const node = stickySentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setIsStuck(!entry.isIntersecting), { rootMargin: "-54px 0px 0px 0px", threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const machineById = useMemo(() => new Map(machines.map((machine) => [machine.id, machine])), [machines]);
  const days = Array.from({ length: 7 }, (_, index) => addWibDays(weekStart, index));
  const query = search.trim().toLowerCase();
  const visibleJobs = jobs.filter((job) =>
    (machineId === "All" || job.machineId === machineId) &&
    new Date(job.endAt) > weekStart && new Date(job.startAt) < weekEnd &&
    (!query || [job.sourceOrderRefs, job.customerName, job.productName, job.itemCode].some((value) => value?.toLowerCase().includes(query)))
  );
  const visibleMaintenance = maintenanceWindows.filter((window) =>
    (machineId === "All" || window.machineId === machineId) &&
    new Date(window.endAt) > weekStart && new Date(window.startAt) < weekEnd &&
    (!query || [window.reason, window.type, machineById.get(window.machineId)?.lineCode].some((value) => value?.toLowerCase().includes(query)))
  );
  const groups = [...new Set([...visibleJobs.map((job) => job.machineId), ...visibleMaintenance.map((window) => window.machineId)])]
    .sort((a, b) => (machineById.get(a)?.lineCode ?? "").localeCompare(machineById.get(b)?.lineCode ?? ""));
  const toggleMachine = (groupMachineId: string) => setCollapsedMachines((current) => {
    const next = new Set(current);
    if (next.has(groupMachineId)) next.delete(groupMachineId); else next.add(groupMachineId);
    return next;
  });
  const rowsForMachine = (groupMachineId: string) => {
    const groupJobs = visibleJobs.filter((job) => job.machineId === groupMachineId);
    const groupMaintenance = visibleMaintenance.filter((window) => window.machineId === groupMachineId);
    return [
      ...groupJobs.map((job) => ({ type: "job" as const, sortAt: job.startAt, priority: 1, job })),
      ...groupMaintenance.map((window) => {
        const linkedJob = groupJobs.find((job) =>
          window.affectedScheduleId === job.id ||
          (window.type === MaintenanceType.Setup && Date.parse(window.endAt) === Date.parse(job.startAt))
        );
        return { type: "maintenance" as const, sortAt: linkedJob?.startAt ?? window.startAt, priority: linkedJob ? 0 : 1, window };
      }),
    ].sort((a, b) =>
      Date.parse(a.sortAt) - Date.parse(b.sortAt) ||
      a.priority - b.priority ||
      (a.type === "maintenance" && b.type === "maintenance" ? Date.parse(a.window.startAt) - Date.parse(b.window.startAt) : 0)
    );
  };

  return (
    <section className="overflow-visible rounded-xl border border-slate-200 bg-white">
      <div ref={stickySentinelRef} aria-hidden="true" />
      <div className={ui.cx("sticky top-13.25 z-[5] rounded-t-xl bg-white transition-[margin-top,box-shadow] duration-150", isStuck ? "mt-3 shadow-[0_1px_0_rgba(15,23,42,0.06)]" : "mt-0 shadow-none")}>
        <div className="grid grid-cols-1 gap-3 rounded-t-xl border-b border-slate-200 p-4 lg:grid-cols-[220px_150px_1fr] lg:items-end">
          <div className="text-2xs font-medium text-slate-500">
            <div>Week</div>
            <div className="mt-1 grid h-9 grid-cols-[32px_minmax(0,1fr)_32px] items-stretch overflow-hidden rounded-md border border-slate-200 bg-white">
              <button type="button" className="grid h-full place-items-center border-r border-slate-200 text-slate-500 hover:bg-slate-50" onClick={() => onWeekOffsetChange((value) => value - 1)} aria-label="Previous week"><ChevronLeft size={14} /></button>
              <div className="flex min-w-0 items-center justify-center gap-1.5 px-2 text-2xs font-semibold text-slate-700"><CalendarDays size={13} /><span className="truncate">{formatMonthDay(weekStart)} - {formatDate(weekEnd.getTime() - 1)}</span></div>
              <button type="button" className="grid h-full place-items-center border-l border-slate-200 text-slate-500 hover:bg-slate-50" onClick={() => onWeekOffsetChange((value) => value + 1)} aria-label="Next week"><ChevronRight size={14} /></button>
            </div>
          </div>
          <label className="text-2xs font-medium text-slate-500">Machine
            <div className="mt-1"><Select value={machineId} onChange={setMachineId} options={[{ value: "All", label: "All machines" }, ...machines.map((machine) => ({ value: machine.id, label: machine.lineCode }))]} buttonClassName="relative h-9 w-full rounded-md border border-slate-200 bg-white px-3 pr-8 text-left text-xs text-slate-700" /></div>
          </label>
          <label className="justify-self-stretch text-2xs font-medium text-slate-500 lg:w-70 lg:justify-self-end">Search
            <div className="mt-1 flex h-9 items-center gap-2 rounded-md border border-slate-200 px-3"><Search size={14} className="text-slate-400" /><input className="min-w-0 flex-1 border-0 bg-transparent text-xs text-slate-800 outline-none" placeholder="PO# / Customer / Item" value={search} onChange={(event) => setSearch(event.target.value)} /></div>
          </label>
        </div>

        <div className="flex flex-wrap items-center gap-x-5 gap-y-2 border-b border-slate-200 px-4 py-2.5 text-2xs text-slate-500">
          {[JobStatus.Open, JobStatus.ProductionProgress, JobStatus.ProductionComplete, JobStatus.ProductionPending]
            .map((jobStatus): readonly [string, string] => [ui.scheduleToneClass(jobStatus, false), jobStatus])
            .concat([[ui.scheduleToneClass(undefined, true), "Maintenance"]])
            .map(([tone, label]) => <span key={label} className="flex items-center gap-1.5"><i className={`h-2.5 w-2.5 rounded-full ${tone}`} />{label}</span>)}
        </div>

        <div ref={headerScrollRef} data-testid="schedule-grid-header" className="hidden overflow-hidden bg-slate-50 md:block">
          <div className="grid min-w-[900px] w-full text-xs tabular-nums" style={{ gridTemplateColumns: GRID_COLS }}>
            <div className={ui.cx(ui.th, "flex items-center whitespace-nowrap px-2!")}>Order No.</div>
            <div className={ui.cx(ui.th, "flex items-center whitespace-nowrap px-2!")}>Item</div>
            <div className={ui.cx(ui.th, "flex items-center whitespace-nowrap px-2!")}>Delivery Due</div>
            <div className={ui.cx(ui.th, "flex items-center whitespace-nowrap px-2! pl-3!")}>Production Window</div>
            <div className="border-b border-l border-slate-200 bg-slate-50">
              <div className="border-b border-slate-200 py-2 text-center text-2xs font-semibold normal-case tracking-normal text-slate-500">{formatDate(weekStart)} - {formatDate(weekEnd.getTime() - 1)}</div>
              <div className="grid grid-cols-7">{days.map((date) => <span key={date.getTime()} className="border-r border-slate-200 py-2 text-center text-2xs font-semibold normal-case tracking-normal text-slate-500 last:border-r-0">{wibInputDate(date).slice(8, 10)}</span>)}</div>
            </div>
          </div>
        </div>
      </div>

      <div data-testid="schedule-grid-body" className="hidden overflow-x-auto rounded-b-xl md:block" onScroll={(event) => {
        if (headerScrollRef.current) headerScrollRef.current.scrollLeft = event.currentTarget.scrollLeft;
      }}>
        <div className="grid min-w-[900px] w-full text-xs tabular-nums" style={{ gridTemplateColumns: GRID_COLS }}>
          {isLoading ? (
            <div role="status" className="col-span-5 flex items-center justify-center gap-2 px-4 py-8 text-center text-xs text-slate-500"><LoaderCircle size={14} className="animate-spin text-brand-600" />Loading data...</div>
          ) : groups.length === 0 ? (
            <div className="col-span-5 px-4 py-8 text-center text-xs text-slate-500">No jobs or maintenance in this week.</div>
          ) : groups.map((groupMachineId) => {
            const rows = rowsForMachine(groupMachineId);
            const entryCount = rows.length;
            const machine = machineById.get(groupMachineId);
            const collapsed = collapsedMachines.has(groupMachineId);
            return (
              <div className="contents" key={groupMachineId}>
                <button type="button" aria-expanded={!collapsed} onClick={() => toggleMachine(groupMachineId)} className="col-span-5 flex h-8 items-center gap-2 border-b border-slate-200 bg-slate-50 px-2 text-left text-2xs font-semibold text-slate-600 hover:bg-slate-100">
                  <ChevronRight size={13} className={`shrink-0 transition-transform ${collapsed ? "" : "rotate-90"}`} />
                  <span>{machine?.lineCode ?? "Unassigned"}</span>
                  <span className="rounded-full bg-slate-200 px-2 py-0.5 font-medium text-slate-500">{entryCount} {entryCount === 1 ? "entry" : "entries"}</span>
                </button>
                {!collapsed && rows.map((row) => row.type === "job" ? (
                  <div className="contents group" key={`job-${row.job.id}`}>
                    <div className="flex min-h-14 items-center truncate border-b border-slate-200 px-2 py-2 font-semibold text-slate-700 group-hover:bg-slate-50">{row.job.sourceOrderRefs || "—"}</div>
                    <div className="flex min-h-14 min-w-0 flex-col justify-center border-b border-slate-200 px-2 py-2 text-slate-700 group-hover:bg-slate-50">
                      <span className="truncate font-semibold" title={row.job.productName}>{row.job.productName}</span>
                      {row.job.itemCode && <span className="truncate text-2xs text-slate-400" title={row.job.itemCode}>{row.job.itemCode}</span>}
                    </div>
                    <div className="flex min-h-14 items-center whitespace-nowrap border-b border-slate-200 px-2 py-2 font-semibold text-slate-700 group-hover:bg-slate-50">{row.job.deliveryDate ? formatMonthDay(row.job.deliveryDate) : "—"}</div>
                    <div className="flex min-h-14 min-w-0 items-center whitespace-nowrap border-b border-slate-200 px-2 py-2 pl-3 text-2xs font-semibold text-slate-700 group-hover:bg-slate-50">{formatScheduleDateTime(row.job.startAt)} → {formatScheduleDateTime(row.job.endAt)}</div>
                    <ScheduleBar job={row.job} weekStart={weekStart} onSelect={onSelectJob} onMove={onJobMoved} wrapperClassName="border-b border-b-slate-200 group-hover:bg-slate-50" />
                  </div>
                ) : (
                  <div className="contents group" key={`maintenance-${row.window.id}`}>
                    <div className="col-span-4 grid min-h-14 min-w-0 bg-red-50 text-left text-red-600 group-hover:bg-red-100" style={{ gridTemplateColumns: INFO_COLS }}>
                      <span className="col-span-3 flex min-w-0 items-center gap-2 px-3 py-2"><Wrench size={14} className="shrink-0" /><span className="truncate font-semibold">{maintenanceTypeLabel(row.window.type)}</span></span>
                      <span className="flex min-w-0 items-center whitespace-nowrap px-2 py-2 pl-3 text-2xs font-medium">{formatScheduleDateTime(row.window.startAt)} → {formatScheduleDateTime(row.window.endAt)}</span>
                    </div>
                    <MaintenanceBar window={row.window} weekStart={weekStart} machine={machineById.get(row.window.machineId)} onSelect={onSelectMaintenance} wrapperClassName="bg-red-50 group-hover:bg-red-100" />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </div>

      <div className="md:hidden">
        {isLoading ? (
          <div role="status" className="flex items-center justify-center gap-2 px-4 py-8 text-xs text-slate-500"><LoaderCircle size={14} className="animate-spin text-brand-600" />Loading data...</div>
        ) : groups.length === 0 ? (
          <div className="px-4 py-8 text-center text-xs text-slate-500">No jobs or maintenance in this week.</div>
        ) : groups.map((groupMachineId) => {
          const rows = rowsForMachine(groupMachineId);
          const machine = machineById.get(groupMachineId);
          const collapsed = collapsedMachines.has(groupMachineId);
          return (
            <div key={`agenda-${groupMachineId}`}>
              <button type="button" aria-expanded={!collapsed} onClick={() => toggleMachine(groupMachineId)} className="flex h-10 w-full items-center gap-2 border-b border-slate-200 bg-slate-50 px-3 text-left text-xs font-semibold text-slate-700 hover:bg-slate-100">
                <ChevronRight size={14} className={`shrink-0 transition-transform ${collapsed ? "" : "rotate-90"}`} />
                <span className="min-w-0 flex-1 truncate">{machine?.lineCode ?? "Unassigned"}</span>
                <span className="shrink-0 rounded-full bg-slate-200 px-2 py-0.5 text-2xs font-medium text-slate-500">{rows.length}</span>
              </button>
              {!collapsed && <div className="divide-y divide-slate-200">
                {rows.map((row) => row.type === "job" ? (
                  <button type="button" key={`agenda-job-${row.job.id}`} onClick={() => onSelectJob?.(row.job)} className="flex w-full items-start gap-3 bg-white px-3 py-3 text-left hover:bg-slate-50">
                    <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${ui.scheduleToneClass(row.job.status, false)}`} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                        {row.job.isLocked && <LockKeyhole size={11} className="shrink-0 text-slate-500" />}
                        <span className="truncate">{row.job.sourceOrderRefs || "No order"}</span>
                      </span>
                      <span className="mt-0.5 block truncate text-xs text-slate-600">{row.job.productName}</span>
                      <span className="mt-1 block text-2xs tabular-nums text-slate-500">{formatScheduleDateTime(row.job.startAt)} → {formatScheduleDateTime(row.job.endAt)}</span>
                    </span>
                    <span className="shrink-0 text-right text-2xs font-semibold text-slate-500">Due<br />{row.job.deliveryDate ? formatMonthDay(row.job.deliveryDate) : "—"}</span>
                  </button>
                ) : (
                  <button type="button" key={`agenda-maintenance-${row.window.id}`} onClick={() => onSelectMaintenance?.(row.window)} className="flex w-full items-start gap-3 bg-red-50 px-3 py-3 text-left text-red-700 hover:bg-red-100">
                    <Wrench size={14} className="mt-0.5 shrink-0" />
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-xs font-semibold">{maintenanceTypeLabel(row.window.type)}</span>
                      {row.window.reason && <span className="mt-0.5 block truncate text-xs text-red-600">{row.window.reason}</span>}
                      <span className="mt-1 block text-2xs tabular-nums text-red-600">{formatScheduleDateTime(row.window.startAt)} → {formatScheduleDateTime(row.window.endAt)}</span>
                    </span>
                  </button>
                ))}
              </div>}
            </div>
          );
        })}
      </div>
    </section>
  );
}


function ScheduleBar({ job, weekStart, onSelect, onMove, wrapperClassName }: { job: ScheduleJob; weekStart: Date; onSelect?: (job: ScheduleJob) => void; onMove?: (jobId: string, machineId: string, start: Date) => void; wrapperClassName?: string }) {
  const moved = useRef(false);
  const start = new Date(job.startAt);
  const end = new Date(job.endAt);
  const movable = !!onMove && (job.status === JobStatus.Open || job.status === JobStatus.ProductionPending) && !job.isLocked;
  const tone = ui.scheduleToneClass(job.status, false);

  return (
    <ScheduleBlock
      start={start}
      end={end}
      weekStart={weekStart}
      title={job.productName}
      subtitle={`Qty ${job.qty.toLocaleString()}`}
      locked={job.isLocked}
      toneClassName={tone}
      testId={`schedule-job-${job.id}`}
      wrapperClassName={wrapperClassName}
      borderClassName="border-slate-200"
      onClick={(event) => {
        event.stopPropagation();
        if (!movable) onSelect?.(job);
      }}
      onPointerDown={!movable ? undefined : (event) => {
        event.preventDefault();
        const element = event.currentTarget;
        const startX = event.clientX;
        const timelineWidth = element.parentElement?.clientWidth || 1;
        const startDay = wibStartOfDay(start).getTime();
        moved.current = false;
        const pointerMove = (moveEvent: PointerEvent) => {
          const delta = moveEvent.clientX - startX;
          moved.current ||= Math.abs(delta) > 3;
          element.style.transform = `translateX(${delta}px)`;
        };
        const pointerUp = (upEvent: PointerEvent) => {
          window.removeEventListener("pointermove", pointerMove);
          window.removeEventListener("pointerup", pointerUp);
          window.removeEventListener("pointercancel", pointerCancel);
          element.style.transform = "translateX(0)";
          if (!moved.current) {
            onSelect?.(job);
            return;
          }
          const currentDay = Math.floor((startDay - weekStart.getTime()) / 86400000);
          const targetDay = Math.max(0, Math.min(6, currentDay + Math.round((upEvent.clientX - startX) / (timelineWidth / 7))));
          if (targetDay !== currentDay) {
            const next = new Date(wibInputDateTime(wibInputDate(addWibDays(weekStart, targetDay)), wibInputTime(start)));
            onMove?.(job.id, job.machineId, next);
          }
        };
        const pointerCancel = () => {
          window.removeEventListener("pointermove", pointerMove);
          window.removeEventListener("pointerup", pointerUp);
          window.removeEventListener("pointercancel", pointerCancel);
          element.style.transform = "translateX(0)";
        };
        window.addEventListener("pointermove", pointerMove);
        window.addEventListener("pointerup", pointerUp);
        window.addEventListener("pointercancel", pointerCancel);
      }}
    />
  );
}

function MaintenanceBar({ window, weekStart, machine, onSelect, wrapperClassName }: { window: MaintenanceWindow; weekStart: Date; machine?: Machine; onSelect?: (window: MaintenanceWindow) => void; wrapperClassName?: string }) {
  const machineLabel = machine ? `${machine.name} - ${machine.machineType}` : "Machine";

  return (
    <ScheduleBlock
      start={new Date(window.startAt)}
      end={new Date(window.endAt)}
      weekStart={weekStart}
      title={window.reason || "Maintenance"}
      subtitle={machineLabel}
      toneClassName="bg-red-500"
      className="min-w-9"
      wrapperClassName={wrapperClassName}
      borderClassName="border-red-100"
      onClick={(event) => { event.stopPropagation(); onSelect?.(window); }}
    />
  );
}
