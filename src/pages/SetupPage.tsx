import { useEffect, useState } from "react";
import { CalendarDays, LoaderCircle } from "lucide-react";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { formatDate, toJakartaDateTime, wibInputDate, wibInputTime } from "../utils/dateFormat";
import * as ui from "../ui/classNames";

interface SetupRow {
  id: number;
  machineCode: string;
  startAt: string;
  endAt: string;
  before: string | null;
  after: string[];
  setupPercentage: string | null;
}

export function SetupPage() {
  const [today, setToday] = useState(wibInputDate());
  const [mode, setMode] = useState<"today" | "custom">("today");
  const [range, setRange] = useState({ start: today, end: today });
  const [draft, setDraft] = useState(range);
  const [customOpen, setCustomOpen] = useState(false);
  const [rows, setRows] = useState<SetupRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  const start = mode === "today" ? today : range.start;
  const end = mode === "today" ? today : range.end;

  useEffect(() => {
    const timer = window.setInterval(() => setToday(wibInputDate()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    void api<SetupRow[]>(`/maintenance-windows/setup-report?${new URLSearchParams({ startDate: start, endDate: end })}`)
      .then((data) => {
        if (current) setRows(data.map((row) => ({ ...row, startAt: toJakartaDateTime(row.startAt), endAt: toJakartaDateTime(row.endAt) })));
      })
      .catch((cause: unknown) => { if (current) setError(cause instanceof Error ? cause.message : "Unable to load setup report."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [start, end, retry]);

  const groups = new Map<string, SetupRow[]>();
  for (const row of rows) {
    const date = wibInputDate(row.startAt);
    groups.set(date, [...(groups.get(date) ?? []), row]);
  }
  const dateLabel = (date: string) => formatDate(`${date}T00:00:00+07:00`);
  const invalidRange = !draft.start || !draft.end || draft.start > draft.end;

  return (
    <div className={ui.page}>
      <PageHeader breadcrumb={[]} title="Setup" subtitle="Product changeovers and setup percentages by machine." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-md bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-600"><CalendarDays size={14} />{dateLabel(start)}{start !== end && ` – ${dateLabel(end)}`}</span>
        <button type="button" aria-pressed={mode === "today"} className={mode === "today" ? ui.btnPrimary : ui.btnSecondary} onClick={() => { setToday(wibInputDate()); setMode("today"); setCustomOpen(false); }}>Today</button>
        <button type="button" aria-expanded={customOpen} aria-pressed={mode === "custom"} className={mode === "custom" ? ui.btnPrimary : ui.btnSecondary} onClick={() => { setDraft({ start, end }); setCustomOpen(!customOpen); }}>Custom</button>
      </div>
      {customOpen && (
        <form className={`${ui.card} mb-4 flex flex-wrap items-end gap-3`} onSubmit={(event) => { event.preventDefault(); if (invalidRange) return; setRange(draft); setMode("custom"); setCustomOpen(false); }}>
          <label className={ui.label}>From<input required type="date" max={draft.end || undefined} className={ui.input} value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></label>
          <label className={ui.label}>To<input required type="date" min={draft.start || undefined} className={ui.input} value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></label>
          <button type="submit" disabled={invalidRange} className={ui.btnPrimary}>Apply</button>
          <button type="button" className={ui.btnSecondary} onClick={() => setCustomOpen(false)}>Cancel</button>
          {invalidRange && <p role="alert" className="w-full text-xs text-red-600">Choose an end date on or after the start date.</p>}
        </form>
      )}
      {loading ? <div role="status" className={`${ui.card} flex items-center justify-center gap-2 py-12 text-sm text-slate-500`}><LoaderCircle size={16} className="animate-spin" />Loading setup report...</div>
        : error ? <div role="alert" className={ui.bannerError}>{error} <button className={ui.btnSecondary} onClick={() => setRetry((value) => value + 1)}>Retry</button></div>
        : rows.length === 0 ? <div className={`${ui.card} py-12 text-center text-sm text-slate-500`}>No setups in this date range.</div>
        : <div className="space-y-4">{[...groups].map(([date, entries]) => {
          const percentages = entries.map((row) => row.setupPercentage && /^\d+(\.\d+)?%$/.test(row.setupPercentage) ? Number(row.setupPercentage.slice(0, -1)) : null);
          const known = percentages.filter((value): value is number => value !== null);
          const total = known.reduce((sum, value) => sum + value, 0);
          return <section key={date} className={ui.tableCard} aria-label={`Setup ${date}`}>
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-800">{new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T00:00:00+07:00`))}</h2><span className={ui.badgeNeutral}>{entries.length} {entries.length === 1 ? "setup" : "setups"}</span></div>
            <div className="overflow-x-auto"><table className={`${ui.table} min-w-[680px]`}>
              <thead><tr>{["Time (WIB)", "Machine code", "Before", "After", "Percentage"].map((label) => <th key={label} scope="col" className={`${ui.th} ${label === "Percentage" ? "text-right" : ""}`}>{label}</th>)}</tr></thead>
              <tbody>{entries.map((row) => <tr key={row.id} className="hover:bg-slate-50">
                <td className={`${ui.td} whitespace-nowrap text-slate-600`}>{wibInputTime(row.startAt)} – {wibInputTime(row.endAt)}{wibInputDate(row.endAt) !== date && <span className="mt-1 block text-2xs text-slate-400">Ends {dateLabel(wibInputDate(row.endAt))}</span>}</td>
                <td className={`${ui.td} whitespace-nowrap font-semibold text-slate-700`}>{row.machineCode}</td>
                <td className={`${ui.td} text-slate-500`}>{row.before || "—"}</td>
                <td className={`${ui.td} font-medium text-slate-800`}>{row.after.length ? row.after.map((product) => <div key={product}>{product}</div>) : "—"}</td>
                <td className={`${ui.td} text-right font-semibold text-slate-700`}>{row.setupPercentage || "—"}</td>
              </tr>)}</tbody>
              <tfoot><tr className="bg-slate-50"><th colSpan={4} scope="row" className="px-3 py-3 text-right font-semibold text-slate-600">Total{known.length < entries.length && <span className="ml-2 font-normal text-slate-400">({entries.length - known.length} without percentage)</span>}</th><td className="px-3 py-3 text-right font-bold text-brand-600">{known.length ? `${Number(total.toFixed(6))}%` : "—"}</td></tr></tfoot>
            </table></div>
          </section>;
        })}</div>}
    </div>
  );
}
