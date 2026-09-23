import { useEffect, useState } from "react";
import { CalendarDays, LoaderCircle } from "lucide-react";
import { api } from "../api/client";
import { PageHeader } from "../components/PageHeader";
import { formatDate, toJakartaDateTime, wibInputTime } from "../utils/dateFormat";
import * as ui from "../ui/classNames";
import { setupShift } from "../utils/setupShift";

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
  const [today, setToday] = useState(setupShift().date);
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
    const timer = window.setInterval(() => setToday(setupShift().date), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    let current = true;
    setLoading(true);
    setError("");
    void api<SetupRow[]>(`/maintenance-windows/setup-report?${new URLSearchParams({ startDate: start, endDate: end, shiftDay: "true" })}`)
      .then((data) => {
        if (current) setRows(data.map((row) => ({ ...row, startAt: toJakartaDateTime(row.startAt), endAt: toJakartaDateTime(row.endAt) })));
      })
      .catch((cause: unknown) => { if (current) setError(cause instanceof Error ? cause.message : "Laporan setup belum dapat dimuat. Coba Retry atau muat ulang halaman."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; };
  }, [start, end, retry]);

  const groups = new Map<string, SetupRow[]>();
  for (const row of rows) {
    const { date } = setupShift(row.startAt);
    groups.set(date, [...(groups.get(date) ?? []), row]);
  }
  const dateLabel = (date: string) => formatDate(`${date}T00:00:00+07:00`);
  const invalidRange = !draft.start || !draft.end || draft.start > draft.end;

  return (
    <div className={ui.page}>
      <PageHeader breadcrumb={[]} title="Setup" subtitle="Product changeovers and setup percentages by machine." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        <span className="inline-flex items-center gap-2 rounded-md bg-brand-50 px-3 py-2 text-xs font-semibold text-brand-600"><CalendarDays size={14} />{dateLabel(start)}{start !== end && ` – ${dateLabel(end)}`}</span>
        <button type="button" aria-pressed={mode === "today"} className={mode === "today" ? ui.btnPrimary : ui.btnSecondary} onClick={() => { setToday(setupShift().date); setMode("today"); setCustomOpen(false); }}>Today</button>
        <button type="button" aria-expanded={customOpen} aria-pressed={mode === "custom"} className={mode === "custom" ? ui.btnPrimary : ui.btnSecondary} onClick={() => { setDraft({ start, end }); setCustomOpen(!customOpen); }}>Custom</button>
      </div>
      {customOpen && (
        <form className={`${ui.card} mb-4 flex flex-wrap items-end gap-3`} onSubmit={(event) => { event.preventDefault(); if (invalidRange) return; setRange(draft); setMode("custom"); setCustomOpen(false); }}>
          <label className={ui.label}>From<input required type="date" max={draft.end || undefined} className={ui.input} value={draft.start} onChange={(event) => setDraft({ ...draft, start: event.target.value })} /></label>
          <label className={ui.label}>To<input required type="date" min={draft.start || undefined} className={ui.input} value={draft.end} onChange={(event) => setDraft({ ...draft, end: event.target.value })} /></label>
          <button type="submit" disabled={invalidRange} className={ui.btnPrimary}>Apply</button>
          <button type="button" className={ui.btnSecondary} onClick={() => setCustomOpen(false)}>Cancel</button>
          {invalidRange && <p role="alert" className="w-full text-xs text-red-600">Pilih tanggal akhir yang sama atau setelah tanggal mulai.</p>}
        </form>
      )}
      {loading ? <div role="status" className={`${ui.card} flex items-center justify-center gap-2 py-12 text-sm text-slate-500`}><LoaderCircle size={16} className="animate-spin" />Loading setup report...</div>
        : error ? <div role="alert" className={ui.bannerError}>{error} <button className={ui.btnSecondary} onClick={() => setRetry((value) => value + 1)}>Retry</button></div>
        : rows.length === 0 ? <div className={`${ui.card} py-12 text-center text-sm text-slate-500`}>No setups in this date range.</div>
        : <div className="space-y-4">{[...groups].sort(([a], [b]) => a.localeCompare(b)).map(([date, entries]) => {
          entries.sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());
          return <section key={date} className={`${ui.tableCard} isolate`} aria-label={`Setup ${date}`}>
            <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-4 py-3"><h2 className="text-sm font-semibold text-slate-800">{new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Jakarta", weekday: "long", day: "numeric", month: "long", year: "numeric" }).format(new Date(`${date}T00:00:00+07:00`))}</h2><span className={ui.badgeNeutral}>{entries.length} {entries.length === 1 ? "setup" : "setups"}</span></div>
            <div className="overflow-x-auto"><table className={`${ui.table} min-w-[680px]`}>
              <thead><tr>{["Shift", "Time (WIB)", "Machine code", "Before", "After", "Percentage"].map((label) => <th key={label} scope="col" className={`${ui.th} ${label === "Percentage" ? "text-right" : label === "Shift" ? "text-center" : ""}`}>{label}</th>)}</tr></thead>
              {[1, 2].map((shift) => {
                const shiftEntries = entries.filter(row => setupShift(row.startAt).shift === shift);
                const known = shiftEntries.flatMap(row => row.setupPercentage && /^\d+(\.\d+)?%$/.test(row.setupPercentage) ? [Number(row.setupPercentage.slice(0, -1))] : []);
                const total = known.reduce((sum, value) => sum + value, 0);
                return <tbody key={shift}>{shiftEntries.map((row, index) => <tr key={row.id} className="hover:bg-slate-50">
                {index === 0 && <th scope="rowgroup" rowSpan={shiftEntries.length} className={`${ui.td} text-center align-middle font-semibold text-slate-600`}>{shift}</th>}
                <td className={`${ui.td} whitespace-nowrap text-slate-600`}>{wibInputTime(row.startAt)} – {wibInputTime(row.endAt)}</td>
                <td className={`${ui.td} whitespace-nowrap font-semibold text-slate-700`}>{row.machineCode}</td>
                <td className={`${ui.td} text-slate-500`}>{row.before || "—"}</td>
                <td className={`${ui.td} font-medium text-slate-800`}>{row.after.length ? row.after.map((product) => <div key={product}>{product}</div>) : "—"}</td>
                <td className={`${ui.td} text-right font-semibold text-slate-700`}>{row.setupPercentage || "—"}</td>
              </tr>)}
                <tr className="border-b border-slate-200 bg-slate-50"><th colSpan={5} scope="row" className="px-3 py-3 text-right font-semibold text-slate-600">Total Shift {shift}{known.length < shiftEntries.length && <span className="ml-2 font-normal text-slate-400">({shiftEntries.length - known.length} without percentage)</span>}</th><td className="px-3 py-3 text-right font-bold text-brand-600">{known.length || !shiftEntries.length ? `${Number(total.toFixed(6))}%` : "—"}</td></tr>
                </tbody>;
              })}
            </table></div>
          </section>;
        })}</div>}
    </div>
  );
}
