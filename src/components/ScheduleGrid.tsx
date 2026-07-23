import { useMemo, useState } from "react";
import type { ReactNode } from "react";
import { Search, SlidersHorizontal } from "lucide-react";
import { JobStatus } from "../types";
import type { Machine, MaintenanceWindow, ScheduleJob } from "../types";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";

interface Props {
  machines: Machine[];
  jobs: ScheduleJob[];
  maintenanceWindows: MaintenanceWindow[];
  onSelectJob?: (job: ScheduleJob) => void;
  /** Drag a job bar to a new date — called with the job, its (unchanged) machine, and the
   * new block start once the drag is dropped. The caller is expected to auto-reflow
   * whatever the move now overlaps (see useProduction's moveJob). */
  onJobMoved?: (jobId: string, machineId: string, newBlockStart: Date) => void;
}

type Scale = "Daily" | "Weekly";
type GroupBy = "None" | "Cell" | "Customer";

type Row =
  | { kind: "job"; id: string; job: ScheduleJob; machine?: Machine }
  | { kind: "maintenance"; id: string; window: MaintenanceWindow; machine?: Machine };

const DAY_WIDTH: Record<Scale, number> = { Daily: 34, Weekly: 13 };
const ROW_H = 42;

// Fixed label-column widths, shared between the header row and every body row so
// everything lines up regardless of row kind. Widths are numeric (not Tailwind classes)
// so we can sum them into LABEL_WIDTH for the frozen-column offset.
const COLS = [
  { key: "po", label: "PO #", width: 84, align: "" },
  { key: "customer", label: "Customer", width: 130, align: "" },
  { key: "itemNo", label: "Item #", width: 96, align: "" },
  { key: "qty", label: "Qty", width: 68, align: "text-right" },
  { key: "cell", label: "Machine", width: 64, align: "" },
  { key: "ship", label: "Ship", width: 76, align: "" },
] as const;

const LABEL_WIDTH = COLS.reduce((sum, c) => sum + c.width, 0);

const STATUS_TONES: Record<string, { solid: string; light: string }> = {
  [JobStatus.Planned]: { solid: "#3b4a68", light: "#5c6d90" },
  [JobStatus.InProgress]: { solid: "#1d6feb", light: "#6fa8ea" },
  [JobStatus.Done]: { solid: "#16a34a", light: "#5fbf82" },
};

function startOfDay(d: Date): Date {
  const c = new Date(d);
  c.setHours(0, 0, 0, 0);
  return c;
}
function addDays(d: Date, n: number): Date {
  const c = new Date(d);
  c.setDate(c.getDate() + n);
  return c;
}
function diffDays(from: Date, to: Date): number {
  return (to.getTime() - from.getTime()) / 86_400_000;
}
function toInputDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}
function fmtShort(d: Date): string {
  return d.toLocaleDateString(undefined, { day: "2-digit", month: "short" });
}
function weekNumber(d: Date): number {
  const first = new Date(d.getFullYear(), 0, 1);
  return Math.ceil((diffDays(first, d) + first.getDay() + 1) / 7);
}

function isOverdue(job: ScheduleJob): boolean {
  return job.status !== JobStatus.Done && new Date(job.endAt).getTime() > new Date(job.deliveryDate).getTime();
}

function computeProgressPct(job: ScheduleJob): number {
  if (job.status === JobStatus.Done) return 100;
  if (job.status === JobStatus.Planned) return 0;
  const runStart = new Date(job.startAt).getTime() + job.setupMinutes * 60_000;
  const runEnd = new Date(job.endAt).getTime();
  const now = Date.now();
  if (now <= runStart) return 0;
  if (now >= runEnd) return 100;
  return Math.round(((now - runStart) / (runEnd - runStart)) * 100);
}

const labelRowBase = `flex items-center border-r border-b border-slate-200 text-[0.8rem] text-slate-800`;

/** One label-row cell, sized/aligned to match its header counterpart. */
function Cell({ col, children }: { col: (typeof COLS)[number]; children: ReactNode }) {
  return (
    <div className={ui.cx(col.align, "shrink-0 truncate px-2")} style={{ width: col.width, height: ROW_H }}>
      {children}
    </div>
  );
}

/**
 * Spreadsheet-style production schedule modeled on the reference PO-line Gantt: a filter
 * bar (date window / cell / scale / group by / search), a fixed set of PO-line columns on
 * the left, and a day-scaled timeline on the right showing each job's setup + run segments.
 * Maintenance/"stopped" windows are their own rows so downtime reads as clearly as a running job.
 */
export function ScheduleGrid({ machines, jobs, maintenanceWindows, onSelectJob, onJobMoved }: Props) {
  const today = startOfDay(new Date());
  const [startDate, setStartDate] = useState(() => toInputDate(addDays(today, -5)));
  const [endDate, setEndDate] = useState(() => toInputDate(addDays(today, 32)));
  const [cellFilter, setCellFilter] = useState<string>("All");
  const [scale, setScale] = useState<Scale>("Daily");
  const [groupBy, setGroupBy] = useState<GroupBy>("None");
  const [search, setSearch] = useState("");
  const [showAllocation, setShowAllocation] = useState(false);
  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);

  const dayWidth = DAY_WIDTH[scale];
  const rangeStart = startOfDay(new Date(startDate));
  const rangeEnd = startOfDay(new Date(endDate));
  const totalDays = Math.max(1, Math.round(diffDays(rangeStart, rangeEnd)) + 1);
  const timelineWidth = totalDays * dayWidth;

  const machineById = useMemo(() => new Map(machines.map((m) => [m.id, m])), [machines]);

  const days = useMemo(() => Array.from({ length: totalDays }, (_, i) => addDays(rangeStart, i)), [rangeStart, totalDays]);

  const weekBands = useMemo(() => {
    const bands: { label: string; days: number }[] = [];
    days.forEach((d) => {
      const isMonday = d.getDay() === 1;
      if (bands.length === 0 || isMonday) {
        bands.push({ label: `${fmtShort(d)} - ${fmtShort(addDays(d, 6))} (#${weekNumber(d)})`, days: 1 });
      } else {
        bands[bands.length - 1].days += 1;
      }
    });
    return bands;
  }, [days]);

  const overlapsRange = (start: string, end: string) =>
    new Date(end).getTime() >= rangeStart.getTime() && new Date(start).getTime() <= addDays(rangeEnd, 1).getTime();

  const matchesSearch = (haystack: (string | undefined)[]) => {
    if (!search.trim()) return true;
    const q = search.trim().toLowerCase();
    return haystack.some((v) => (v ?? "").toLowerCase().includes(q));
  };

  const conflictJobIds = useMemo(() => {
    const ids = new Set<string>();
    const byMachine = new Map<string, ScheduleJob[]>();
    jobs.forEach((j) => {
      const list = byMachine.get(j.machineId) ?? [];
      list.push(j);
      byMachine.set(j.machineId, list);
    });
    byMachine.forEach((list) => {
      for (let a = 0; a < list.length; a++) {
        for (let b = a + 1; b < list.length; b++) {
          const s1 = new Date(list[a].startAt).getTime();
          const e1 = new Date(list[a].endAt).getTime();
          const s2 = new Date(list[b].startAt).getTime();
          const e2 = new Date(list[b].endAt).getTime();
          if (s1 < e2 && s2 < e1) {
            ids.add(list[a].id);
            ids.add(list[b].id);
          }
        }
      }
    });
    return ids;
  }, [jobs]);

  const rows = useMemo<Row[]>(() => {
    const jobRows: Row[] = jobs
      .filter((j) => cellFilter === "All" || j.machineId === cellFilter)
      .filter((j) => overlapsRange(j.startAt, j.endAt))
      .filter((j) => matchesSearch([j.sourceOrderRefs, j.customerName, j.itemCode, j.productName]))
      .map((j) => ({ kind: "job", id: j.id, job: j, machine: machineById.get(j.machineId) }));

    const maintRows: Row[] = maintenanceWindows
      .filter((w) => cellFilter === "All" || w.machineId === cellFilter)
      .filter((w) => overlapsRange(w.startAt, w.endAt))
      .filter((w) => matchesSearch([w.reason, w.type]))
      .map((w) => ({ kind: "maintenance", id: `maint-${w.id}`, window: w, machine: machineById.get(w.machineId) }));

    const all = [...jobRows, ...maintRows];
    all.sort((a, b) => {
      const sa = a.kind === "job" ? a.job.startAt : a.window.startAt;
      const sb = b.kind === "job" ? b.job.startAt : b.window.startAt;
      return new Date(sa).getTime() - new Date(sb).getTime();
    });
    return all;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobs, maintenanceWindows, cellFilter, search, startDate, endDate, machineById]);

  type RenderItem = { type: "group"; label: string } | { type: "row"; row: Row };
  const renderItems = useMemo<RenderItem[]>(() => {
    if (groupBy === "None") return rows.map((row) => ({ type: "row", row }) as RenderItem);
    const groupLabel = (row: Row): string => {
      if (groupBy === "Cell") return row.machine?.lineCode ?? "Unassigned";
      return row.kind === "job" ? row.job.customerName ?? "Unknown customer" : "Maintenance";
    };
    const groups = new Map<string, Row[]>();
    rows.forEach((row) => {
      const label = groupLabel(row);
      const list = groups.get(label) ?? [];
      list.push(row);
      groups.set(label, list);
    });
    const items: RenderItem[] = [];
    [...groups.entries()]
      .sort((a, b) => a[0].localeCompare(b[0]))
      .forEach(([label, list]) => {
        items.push({ type: "group", label: `${label} · ${list.length}` });
        list.forEach((row) => items.push({ type: "row", row }));
      });
    return items;
  }, [rows, groupBy]);

  const barLeft = (iso: string) => Math.max(0, diffDays(rangeStart, startOfDay(new Date(iso)))) * dayWidth;
  const milestoneLeft = (iso: string) => diffDays(rangeStart, new Date(iso)) * dayWidth;

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <div className="flex flex-wrap items-end gap-3.5 border-b border-slate-200 bg-slate-50 p-4">
        <label className="flex flex-col gap-1 text-[0.76rem] font-semibold text-slate-500">
          <span>Start Date</span>
          <input className={ui.cx(ui.inputSm, "py-1.5")} type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[0.76rem] font-semibold text-slate-500">
          <span>End Date</span>
          <input className={ui.cx(ui.inputSm, "py-1.5")} type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} />
        </label>
        <label className="flex flex-col gap-1 text-[0.76rem] font-semibold text-slate-500">
          <span>Cell / Line</span>
          <Select
            value={cellFilter}
            onChange={setCellFilter}
            buttonClassName={ui.selectButtonSm}
            options={[{ value: "All", label: "All cells" }, ...machines.map((m) => ({ value: m.id, label: m.lineCode }))]}
          />
        </label>
        <label className="flex flex-col gap-1 text-[0.76rem] font-semibold text-slate-500">
          <span>Scale</span>
          <Select
            value={scale}
            onChange={(v) => setScale(v as Scale)}
            buttonClassName={ui.selectButtonSm}
            options={[
              { value: "Daily", label: "Daily" },
              { value: "Weekly", label: "Weekly" },
            ]}
          />
        </label>
        <label className="flex flex-col gap-1 text-[0.76rem] font-semibold text-slate-500">
          <span>Group By</span>
          <Select
            value={groupBy}
            onChange={(v) => setGroupBy(v as GroupBy)}
            buttonClassName={ui.selectButtonSm}
            options={[
              { value: "None", label: "None" },
              { value: "Cell", label: "Cell" },
              { value: "Customer", label: "Customer" },
            ]}
          />
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1 text-[0.76rem] font-semibold text-slate-500">
          <span>Search</span>
          <div className="flex items-center gap-1.5 rounded-md border border-slate-300 bg-white px-2.5 text-slate-400">
            <Search size={14} />
            <input
              className="flex-1 border-none py-1.5 text-sm text-slate-800 focus:outline-none"
              placeholder="PO# / Customer / Item"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
        </label>
        <button
          type="button"
          className={ui.cx(ui.btnSecondary, "h-[34px] whitespace-nowrap", showAllocation && "border-blue-500 bg-blue-50 text-blue-600")}
          onClick={() => setShowAllocation((v) => !v)}
          title="Highlight cells with overlapping jobs"
        >
          <SlidersHorizontal size={14} /> Allocation
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-4 border-b border-slate-200 bg-slate-50 px-4 py-2.5 text-[0.78rem] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-[9px] w-3.5 rounded-sm" style={{ background: "linear-gradient(to right, #1d6feb 60%, #6fa8ea 60%)" }} /> In progress
        </span>
        <span className="flex items-center gap-1.5"><span className="h-[9px] w-3.5 rounded-sm bg-[#3b4a68]" /> Planned</span>
        <span className="flex items-center gap-1.5"><span className="h-[9px] w-3.5 rounded-sm bg-green-600" /> Done</span>
        <span className="flex items-center gap-1.5">
          <span className="h-[9px] w-3.5 rounded-sm" style={{ background: "repeating-linear-gradient(45deg, #f0a93a, #f0a93a 4px, #d68a12 4px, #d68a12 8px)" }} /> Setup
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-[9px] w-3.5 rounded-sm" style={{ background: "repeating-linear-gradient(45deg, #fbd955, #fbd955 4px, #26282c 4px, #26282c 8px)" }} /> Stopped
        </span>
      </div>

      {rows.length === 0 ? (
        <p className={ui.cx(ui.muted, "p-5")}>No jobs or maintenance windows in this window.</p>
      ) : (
        <div className="max-h-[620px] overflow-auto">
          <div className="relative" style={{ width: LABEL_WIDTH + timelineWidth, minWidth: "100%" }}>
            {/* Header: sticky top freezes it vertically; the nested label block is also sticky
             * left so the top-left corner stays pinned in both directions while scrolling. */}
            <div className="sticky top-0 z-30 flex border-b border-slate-200 bg-slate-50">
              <div
                className="sticky left-0 z-10 flex shrink-0 items-center border-r border-slate-200 bg-slate-50"
                style={{ width: LABEL_WIDTH, height: 58 }}
              >
                {COLS.map((col) => (
                  <div
                    key={col.key}
                    style={{ width: col.width }}
                    className={ui.cx(col.align, "shrink-0 truncate px-2 text-[0.72rem] font-bold tracking-wide text-slate-400 uppercase")}
                  >
                    {col.label}
                  </div>
                ))}
              </div>
              <div className="shrink-0" style={{ width: timelineWidth }}>
                <div className="flex border-b border-slate-200" style={{ height: 24 }}>
                  {weekBands.map((band, i) => (
                    <div
                      key={i}
                      className="shrink-0 overflow-hidden border-r border-slate-200 pl-1.5 text-[0.68rem] font-bold whitespace-nowrap text-slate-500"
                      style={{ width: band.days * dayWidth }}
                    >
                      {band.label}
                    </div>
                  ))}
                </div>
                <div className="flex" style={{ height: 34 }}>
                  {days.map((d, i) => (
                    <div
                      key={i}
                      className={ui.cx(
                        "flex shrink-0 items-center justify-center border-r border-slate-100 text-[0.7rem] text-slate-500",
                        (d.getDay() === 0 || d.getDay() === 6) && "bg-slate-50"
                      )}
                      style={{ width: dayWidth }}
                    >
                      {scale === "Daily" ? String(d.getDate()).padStart(2, "0") : d.getDate() % 7 === 1 ? String(d.getDate()).padStart(2, "0") : ""}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="absolute top-0 bottom-0 w-0.5 bg-blue-600" style={{ left: LABEL_WIDTH + milestoneLeft(today.toISOString()) }} />

            {renderItems.map((item, i) => {
              if (item.type === "group") {
                return (
                  <div key={`g-${i}`} className="flex border-b border-slate-200 bg-slate-50" style={{ height: 30 }}>
                    <div
                      className="sticky left-0 z-10 flex shrink-0 items-center border-r border-slate-200 bg-slate-50 px-3 text-[0.72rem] font-bold tracking-wide text-slate-500 uppercase"
                      style={{ width: LABEL_WIDTH }}
                    >
                      {item.label}
                    </div>
                    <div className="shrink-0 bg-slate-50" style={{ width: timelineWidth }} />
                  </div>
                );
              }
              const row = item.row;
              if (row.kind === "job") {
                const job = row.job;
                const conflict = showAllocation && conflictJobIds.has(row.id);
                const selected = selectedJobId === row.id;
                return (
                  <div key={row.id} className="flex">
                    <div
                      className={ui.cx(
                        labelRowBase,
                        "sticky left-0 z-10 shrink-0 cursor-pointer bg-white hover:bg-blue-50",
                        conflict && "bg-red-50",
                        selected && "bg-blue-100 ring-1 ring-inset ring-blue-400"
                      )}
                      style={{ width: LABEL_WIDTH }}
                      onClick={() => {
                        setSelectedJobId(job.id);
                        onSelectJob?.(job);
                      }}
                    >
                      <Cell col={COLS[0]}>{job.sourceOrderRefs ?? "—"}</Cell>
                      <Cell col={COLS[1]}>{job.customerName ?? "—"}</Cell>
                      <Cell col={COLS[2]}>{job.productName}</Cell>
                      <Cell col={COLS[3]}>{job.qty.toLocaleString()}</Cell>
                      <Cell col={COLS[4]}>{row.machine?.lineCode ?? "—"}</Cell>
                      <Cell col={COLS[5]}>{job.ship1Date ? new Date(job.ship1Date).toLocaleDateString(undefined, { day: "2-digit", month: "short" }) : "—"}</Cell>
                    </div>
                    <div className="shrink-0" style={{ width: timelineWidth }}>
                      <ScheduleJobBar
                        job={row.job}
                        barLeft={barLeft}
                        dayWidth={dayWidth}
                        conflict={conflict}
                        selected={selected}
                        onDragCommit={onJobMoved ? (j, newStart) => onJobMoved(j.id, j.machineId, newStart) : undefined}
                      />
                    </div>
                  </div>
                );
              }
              return (
                <div key={row.id} className="flex">
                  <div className={ui.cx(labelRowBase, "sticky left-0 z-10 shrink-0 cursor-default bg-white text-slate-500 italic")} style={{ width: LABEL_WIDTH }}>
                    <Cell col={COLS[0]}>—</Cell>
                    <Cell col={COLS[1]}>—</Cell>
                    <Cell col={COLS[2]}>—</Cell>
                    <Cell col={COLS[3]}>Stopped — {row.window.reason ?? row.window.type}</Cell>
                    <Cell col={COLS[4]}>{row.machine?.lineCode ?? "—"}</Cell>
                    <Cell col={COLS[5]}>—</Cell>
                  </div>
                  <div className="relative shrink-0 border-b border-slate-200" style={{ width: timelineWidth, height: ROW_H }}>
                    <div
                      className="absolute flex items-center justify-center rounded-md text-[0.72rem] font-bold text-slate-900"
                      style={{
                        top: 7,
                        height: 28,
                        left: barLeft(row.window.startAt),
                        width: Math.max(6, diffDays(new Date(row.window.startAt), new Date(row.window.endAt)) * dayWidth),
                        background: "repeating-linear-gradient(45deg, #fbd955, #fbd955 8px, #26282c 8px, #26282c 16px)",
                      }}
                    >
                      Stopped
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function ScheduleJobBar({
  job,
  barLeft,
  dayWidth,
  conflict,
  selected,
  onDragCommit,
}: {
  job: ScheduleJob;
  barLeft: (iso: string) => number;
  dayWidth: number;
  conflict: boolean;
  selected: boolean;
  onDragCommit?: (job: ScheduleJob, newBlockStart: Date) => void;
}) {
  const [dragPx, setDragPx] = useState<number | null>(null);

  const blockStart = new Date(job.startAt);
  const runStart = new Date(blockStart.getTime() + job.setupMinutes * 60_000);
  const blockEnd = new Date(job.endAt);
  const totalDurationDays = Math.max(diffDays(blockStart, blockEnd), 4 / 24);
  const setupDurationDays = job.setupMinutes > 0 ? diffDays(blockStart, runStart) : 0;
  const tone = STATUS_TONES[job.status] ?? STATUS_TONES[JobStatus.Planned];
  const pct = computeProgressPct(job);
  const late = isOverdue(job);

  const draggable = !!onDragCommit && job.status !== JobStatus.Done;

  const width = Math.max(6, totalDurationDays * dayWidth);
  const setupWidth = setupDurationDays * dayWidth;
  const left = barLeft(job.startAt) + (dragPx ?? 0);

  const handleMouseDown = (e: React.MouseEvent) => {
    if (!draggable || !onDragCommit) return;
    e.preventDefault();
    const startX = e.clientX;
    let latestDeltaPx = 0;
    document.body.style.userSelect = "none";
    document.body.style.cursor = "grabbing";

    const handleMouseMove = (ev: MouseEvent) => {
      latestDeltaPx = ev.clientX - startX;
      setDragPx(latestDeltaPx);
    };
    const handleMouseUp = () => {
      window.removeEventListener("mousemove", handleMouseMove);
      window.removeEventListener("mouseup", handleMouseUp);
      document.body.style.userSelect = "";
      document.body.style.cursor = "";
      setDragPx(null);
      const deltaDays = Math.round(latestDeltaPx / dayWidth);
      if (deltaDays !== 0) {
        onDragCommit(job, addDays(blockStart, deltaDays));
      }
    };
    window.addEventListener("mousemove", handleMouseMove);
    window.addEventListener("mouseup", handleMouseUp);
  };

  return (
    <div className={ui.cx("relative border-b border-slate-200", conflict && "bg-red-50", selected && "bg-blue-50")} style={{ height: ROW_H }}>
      <div
        className={ui.cx(
          "absolute flex overflow-hidden rounded-md shadow-sm",
          job.status === JobStatus.Done && "opacity-60",
          late && "ring-2 ring-red-600",
          selected && "ring-2 ring-blue-600",
          draggable && "cursor-grab hover:ring-2 hover:ring-blue-600",
          dragPx !== null && "z-30 cursor-grabbing opacity-80 shadow-lg"
        )}
        style={{ top: 7, height: 28, left, width }}
        onMouseDown={handleMouseDown}
      >
        {setupWidth > 0 && (
          <div
            className="shrink-0 rounded-l-md"
            style={{ width: setupWidth, background: "repeating-linear-gradient(45deg, #f0a93a, #f0a93a 7px, #d68a12 7px, #d68a12 14px)" }}
            title={`Setup — ${job.setupMinutes} min`}
          />
        )}
        <div
          className="flex items-center overflow-hidden px-1.5 text-[0.74rem] font-semibold text-white"
          style={{
            marginLeft: setupWidth,
            width: width - setupWidth,
            background: `linear-gradient(to right, ${tone.solid} ${pct}%, ${tone.light} ${pct}%)`,
          }}
          title={`${job.productName}\nQty: ${job.qty.toLocaleString()}\n${job.status} · ${pct}%${draggable ? "\nDrag to reschedule" : ""}`}
        >
          <span className="truncate">{job.productName} · {pct}%</span>
        </div>
      </div>
    </div>
  );
}
