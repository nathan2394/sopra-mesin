import { useEffect, useMemo, useRef, useState } from "react";
import type { UIEvent } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, LoaderCircle, Search } from "lucide-react";
import { JobStatus } from "../types";
import type { Machine, MaintenanceWindow, ScheduleJob } from "../types";
import { formatMonthDay, formatScheduleDateTime } from "../utils/dateFormat";
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

const GRID_COLS = "112px minmax(180px,200px) minmax(180px,220px) 64px 150px minmax(340px,1fr)";

export function ScheduleGrid({ machines, jobs, maintenanceWindows, weekStart, weekEnd, onWeekOffsetChange, isLoading, onSelectJob, onSelectMaintenance, onJobMoved }: Props) {
  const [machineId, setMachineId] = useState("All");
  const [search, setSearch] = useState("");
  const headerInnerRef = useRef<HTMLDivElement>(null);
  const stickySentinelRef = useRef<HTMLDivElement>(null);
  const [isStuck, setIsStuck] = useState(false);
  const handleBodyScroll = (event: UIEvent<HTMLDivElement>) => {
    if (headerInnerRef.current) headerInnerRef.current.style.transform = `translateX(-${event.currentTarget.scrollLeft}px)`;
  };
  useEffect(() => {
    const node = stickySentinelRef.current;
    if (!node) return;
    const observer = new IntersectionObserver(([entry]) => setIsStuck(!entry.isIntersecting), { rootMargin: "-54px 0px 0px 0px", threshold: 0 });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  const machineById = useMemo(() => new Map(machines.map((machine) => [machine.id, machine])), [machines]);
  const days = Array.from({ length: 7 }, (_, index) => {
    const date = new Date(weekStart);
    date.setDate(date.getDate() + index);
    return date;
  });
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

  return (
    <section className="overflow-visible rounded-xl border border-slate-200 bg-white">
      <div ref={stickySentinelRef} aria-hidden="true" />
      <div className={ui.cx("sticky top-13.25 z-20 rounded-t-xl bg-white transition-[margin-top,box-shadow] duration-150", isStuck ? "mt-3 shadow-[0_1px_0_rgba(15,23,42,0.06)]" : "mt-0 shadow-none")}>
        <div className="grid grid-cols-1 gap-3 rounded-t-xl border-b border-slate-200 p-4 lg:grid-cols-[220px_150px_1fr] lg:items-end">
          <div className="text-2xs font-medium text-slate-500">
            <div>Week</div>
            <div className="mt-1 grid h-9 grid-cols-[32px_minmax(0,1fr)_32px] items-stretch overflow-hidden rounded-md border border-slate-200 bg-white">
              <button type="button" className="grid h-full place-items-center border-r border-slate-200 text-slate-500 hover:bg-slate-50" onClick={() => onWeekOffsetChange((value) => value - 1)} aria-label="Previous week"><ChevronLeft size={14} /></button>
              <div className="flex min-w-0 items-center justify-center gap-1.5 px-2 text-2xs font-semibold text-slate-700"><CalendarDays size={13} /><span className="truncate">{weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric" })} - {new Date(weekEnd.getTime() - 1).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</span></div>
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

        <div className="overflow-hidden bg-slate-50">
          <div ref={headerInnerRef} className="grid text-xs tabular-nums" style={{ gridTemplateColumns: GRID_COLS, width: "max-content", minWidth: "100%" }}>
            <div className={ui.cx(ui.th, "flex items-center px-2!")}>Order ID #</div>
            <div className={ui.cx(ui.th, "flex items-center px-2!")}>Customer</div>
            <div className={ui.cx(ui.th, "flex items-center px-2!")}>Item #</div>
            <div className={ui.cx(ui.th, "flex items-center px-2!")}>Ship</div>
            <div className={ui.cx(ui.th, "flex items-center px-2! pl-3!")}>Schedule</div>
            <div className="border-b border-l border-slate-200 bg-slate-50">
              <div className="border-b border-slate-200 py-2 text-center text-2xs font-semibold normal-case tracking-normal text-slate-500">{weekStart.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} - {new Date(weekEnd.getTime() - 1).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}</div>
              <div className="grid grid-cols-7">{days.map((date) => <span key={date.toISOString()} className="border-r border-slate-200 py-2 text-center text-2xs font-semibold normal-case tracking-normal text-slate-500 last:border-r-0">{String(date.getDate()).padStart(2, "0")}</span>)}</div>
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto rounded-b-xl" onScroll={handleBodyScroll}>
        <div className="grid text-xs tabular-nums" style={{ gridTemplateColumns: GRID_COLS, width: "max-content", minWidth: "100%" }}>
          {isLoading ? (
            <div role="status" className="col-span-6 flex items-center justify-center gap-2 px-4 py-8 text-center text-xs text-slate-500"><LoaderCircle size={14} className="animate-spin text-brand-600" />Loading data...</div>
          ) : groups.length === 0 ? (
            <div className="col-span-6 px-4 py-8 text-center text-xs text-slate-500">No jobs or maintenance in this week.</div>
          ) : groups.map((groupMachineId) => {
            const groupJobs = visibleJobs.filter((job) => job.machineId === groupMachineId);
            const groupMaintenance = visibleMaintenance.filter((window) => window.machineId === groupMachineId);
            const rows = [...groupJobs.map((job) => ({ type: "job" as const, start: job.startAt, job })), ...groupMaintenance.map((window) => ({ type: "maintenance" as const, start: window.startAt, window }))].sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
            return (
              <div className="contents" key={groupMachineId}>
                <div className="col-span-5 flex h-7 items-center border-b border-slate-200 bg-slate-50 px-2 text-2xs font-semibold text-slate-600">{machineById.get(groupMachineId)?.lineCode ?? "Unassigned"} · {groupJobs.length + groupMaintenance.length}</div>
                <div className="h-7 border-b border-l border-slate-200 bg-slate-50" />
                {rows.map((row) => row.type === "job" ? (
                  <div className="contents group" key={`job-${row.job.id}`}>
                    <div className="flex min-h-12 items-center truncate border-b border-slate-200 px-2 py-2 text-slate-700 group-hover:bg-slate-50">{row.job.sourceOrderRefs || "—"}</div>
                    <div className="flex min-h-12 items-center whitespace-normal wrap-break-word border-b border-slate-200 px-2 py-2 text-slate-700 group-hover:bg-slate-50">{row.job.customerName || "—"}</div>
                    <div className="flex min-h-12 items-center truncate border-b border-slate-200 px-2 py-2 text-slate-700 group-hover:bg-slate-50">{row.job.productName}</div>
                    <div className="flex min-h-12 items-center whitespace-nowrap border-b border-slate-200 px-2 py-2 text-slate-700 group-hover:bg-slate-50">{row.job.deliveryDate ? formatMonthDay(row.job.deliveryDate) : "—"}</div>
                    <div className="flex min-h-12 flex-col justify-center gap-0.5 whitespace-nowrap border-b border-slate-200 px-2 py-2 pl-3 text-slate-700 group-hover:bg-slate-50">
                      <span>{formatScheduleDateTime(row.job.startAt)}</span>
                      <span>{formatScheduleDateTime(row.job.endAt)}</span>
                    </div>
                    <ScheduleBar job={row.job} weekStart={weekStart} onSelect={onSelectJob} onMove={onJobMoved} wrapperClassName="border-b border-b-slate-200 group-hover:bg-slate-50" />
                  </div>
                ) : (
                  <div className="contents group" key={`maintenance-${row.window.id}`}>
                    <div className="flex min-h-12 items-center border-b border-red-100 bg-red-50 px-2 py-2 text-slate-700 group-hover:bg-red-100">—</div>
                    <div className="flex min-h-12 items-center border-b border-red-100 bg-red-50 px-2 py-2 text-slate-700 group-hover:bg-red-100">—</div>
                    <div className="flex min-h-12 items-center border-b border-red-100 bg-red-50 px-2 py-2 text-slate-700 group-hover:bg-red-100">—</div>
                    <div className="flex min-h-12 items-center border-b border-red-100 bg-red-50 px-2 py-2 text-slate-700 group-hover:bg-red-100">—</div>
                    <div className="flex min-h-12 flex-col justify-center gap-0.5 whitespace-nowrap border-b border-red-100 bg-red-50 px-2 py-2 pl-3 text-slate-700 group-hover:bg-red-100">
                      <span>{formatScheduleDateTime(row.window.startAt)}</span>
                      <span>{formatScheduleDateTime(row.window.endAt)}</span>
                    </div>
                    <MaintenanceBar window={row.window} weekStart={weekStart} machine={machineById.get(row.window.machineId)} onSelect={onSelectMaintenance} wrapperClassName="border-b border-b-red-100 bg-red-50 group-hover:bg-red-100" />
                  </div>
                ))}
              </div>
            );
          })}
        </div>
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
        const startDay = new Date(start.getFullYear(), start.getMonth(), start.getDate()).getTime();
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
          const currentDay = Math.floor((startDay - weekStart.getTime()) / 86400000);
          const targetDay = Math.max(0, Math.min(6, currentDay + Math.round((upEvent.clientX - startX) / (timelineWidth / 7))));
          if (targetDay !== currentDay) {
            const next = new Date(start);
            next.setFullYear(weekStart.getFullYear(), weekStart.getMonth(), weekStart.getDate() + targetDay);
            onMove?.(job.id, job.machineId, next);
          } else if (!moved.current) onSelect?.(job);
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
