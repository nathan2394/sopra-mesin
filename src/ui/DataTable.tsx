import { useEffect, useRef, useState, type ReactNode } from "react";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Inbox, LoaderCircle } from "lucide-react";
import * as ui from "./classNames";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
  align?: "left" | "right" | "center";
  sortDirection?: "ascending" | "descending" | "none";
}

interface Props<T> {
  rows: T[];
  columns: DataTableColumn<T>[];
  rowKey: (row: T) => string | number;
  emptyText?: string;
  isLoading?: boolean;
  rowClassName?: (row: T) => string;
  tableClassName?: string;
  containerClassName?: string;
  label?: string;
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onPageSizeChange?: (size: number) => void;
    label?: string;
  };
}

export function DataTable<T>({ rows, columns, rowKey, emptyText = "No data found.", isLoading, rowClassName, tableClassName, containerClassName = ui.tableCard, label, pagination }: Props<T>) {
  const scroller = useRef<HTMLDivElement>(null);
  const table = useRef<HTMLTableElement>(null);
  const [scroll, setScroll] = useState({ overflow: false, left: false, right: false });
  const tableLabel = label ?? pagination?.label ?? "Data table";
  const totalPages = Math.max(1, pagination?.totalPages ?? 1);
  const currentPage = Math.min(totalPages, Math.max(1, pagination?.page ?? 1));
  const pages: Array<number | string> = totalPages <= 5
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : [...new Set([1, Math.max(2, currentPage - 1), currentPage, Math.min(totalPages - 1, currentPage + 1), totalPages])]
      .sort((a, b) => a - b)
      .flatMap((page, index, values) => index > 0 && page - Number(values[index - 1]) > 1 ? [`ellipsis-${page}`, page] : [page]);

  useEffect(() => {
    const element = scroller.current;
    if (!element) return;
    const measure = () => setScroll({
      overflow: element.scrollWidth > element.clientWidth + 2,
      left: element.scrollLeft > 2,
      right: element.scrollLeft + element.clientWidth < element.scrollWidth - 2,
    });
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    if (table.current) observer.observe(table.current);
    element.addEventListener("scroll", measure, { passive: true });
    measure();
    return () => { observer.disconnect(); element.removeEventListener("scroll", measure); };
  }, []);

  const changePage = (page: number) => {
    if (!pagination || isLoading) return;
    pagination.onPageChange(page);
    if (scroller.current && scroller.current.getBoundingClientRect().top < 64)
      scroller.current.scrollIntoView({ block: "start", behavior: "instant" });
  };
  const moveColumns = (direction: number) => scroller.current?.scrollBy({ left: direction * scroller.current.clientWidth * 0.7, behavior: "smooth" });

  return <div className={containerClassName} aria-busy={Boolean(isLoading)}>
    {scroll.overflow && <div className="flex items-center justify-between gap-3 border-b border-slate-200 bg-white px-4 py-2">
      <span className="inline-flex items-center gap-2 text-2xs text-slate-500"><ArrowLeftRight size={14} />Scroll to see more columns</span>
      <div className="flex gap-1">
        <button type="button" aria-label={`Scroll ${tableLabel} left`} onClick={() => moveColumns(-1)} disabled={!scroll.left} className="rounded-md p-1 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-30"><ChevronLeft size={17} /></button>
        <button type="button" aria-label={`Scroll ${tableLabel} right`} onClick={() => moveColumns(1)} disabled={!scroll.right} className="rounded-md p-1 text-slate-600 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-30"><ChevronRight size={17} /></button>
      </div>
    </div>}
    <div ref={scroller} role="region" aria-label={tableLabel} tabIndex={scroll.overflow ? 0 : undefined} className="scroll-mt-20 overflow-x-auto overscroll-x-contain focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand-600">
      <table ref={table} className={ui.cx("w-full border-separate border-spacing-0 text-sm leading-5 text-slate-700 tabular-nums", tableClassName)}>
        <caption className="sr-only">{tableLabel}</caption>
        <thead><tr>{columns.map((column) => <th key={column.key} scope="col" aria-sort={column.sortDirection} style={{ textAlign: column.align }} className={ui.cx("whitespace-nowrap border-b border-slate-200 bg-slate-50 px-4 py-3 text-left text-xs font-semibold text-slate-600", column.key === "actions" && "sticky right-0 z-10", column.className)}>{column.header || (column.key === "actions" ? <span className="sr-only">Actions</span> : null)}</th>)}</tr></thead>
        <tbody className={isLoading && rows.length > 0 ? "opacity-50 transition-opacity" : "transition-opacity"}>
          {rows.map((row) => <tr key={rowKey(row)} className={ui.cx("group bg-white transition-colors hover:bg-slate-50 focus-within:bg-brand-50/40", rowClassName?.(row))}>{columns.map((column) => <td key={column.key} style={{ textAlign: column.align }} className={ui.cx("border-b border-slate-100 px-4 py-3.5 align-middle group-last:border-b-0", column.key === "actions" && "sticky right-0 z-[1] bg-white shadow-[-1px_0_0_0_#eef1f7] group-hover:bg-slate-50 group-focus-within:bg-brand-50", column.className)}>{column.cell(row)}</td>)}</tr>)}
          {isLoading && rows.length === 0 && <tr><td colSpan={columns.length} className="px-4 py-14 text-center text-slate-500"><span role="status" className="inline-flex items-center gap-2"><LoaderCircle size={18} className="animate-spin text-brand-600" />Loading data…</span></td></tr>}
          {!isLoading && rows.length === 0 && <tr><td colSpan={columns.length} className="px-6 py-12 text-center"><Inbox size={25} className="mx-auto mb-3 text-slate-300" /><p className="text-sm text-slate-500">{emptyText}</p></td></tr>}
        </tbody>
      </table>
    </div>
    {pagination ? <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-3 border-t border-slate-200 bg-white px-4 py-3">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-xs text-slate-500 tabular-nums" aria-live="polite">{pagination.totalItems === 0 ? "0 records" : <><span className="font-semibold text-slate-700">{Math.min((currentPage - 1) * pagination.pageSize + 1, pagination.totalItems)}–{Math.min(currentPage * pagination.pageSize, pagination.totalItems)}</span> of {pagination.totalItems.toLocaleString()} records</>}</p>
        {pagination.onPageSizeChange && <label className="inline-flex items-center gap-2 text-xs text-slate-500">Rows per page<select aria-label={`${tableLabel} rows per page`} value={pagination.pageSize} disabled={isLoading} onChange={(event) => pagination.onPageSizeChange?.(Number(event.target.value))} className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600">{[15, 30, 50].map((size) => <option key={size} value={size}>{size}</option>)}</select></label>}
        {isLoading && rows.length > 0 && <span role="status" className="inline-flex items-center gap-1.5 text-xs text-slate-500"><LoaderCircle size={14} className="animate-spin text-brand-600" />Updating…</span>}
      </div>
      <nav className="flex items-center gap-1" aria-label={`${tableLabel} pagination`}>
        <button type="button" aria-label="Previous page" disabled={Boolean(isLoading) || currentPage <= 1} onClick={() => changePage(currentPage - 1)} className="grid size-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={16} /></button>
        <span className="px-3 text-xs text-slate-500 sm:hidden">{currentPage} / {totalPages}</span>
        {pages.map((page) => typeof page === "string" ? <span key={page} className="hidden px-1 text-slate-400 sm:block">…</span> : <button key={page} type="button" aria-label={`Page ${page}`} aria-current={page === currentPage ? "page" : undefined} disabled={isLoading} onClick={() => changePage(page)} className={ui.cx("hidden size-9 place-items-center rounded-md text-xs font-semibold focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-wait sm:grid", page === currentPage ? "bg-brand-50 text-brand-700 ring-1 ring-inset ring-brand-200" : "text-slate-600 hover:bg-slate-50")}>{page}</button>)}
        <button type="button" aria-label="Next page" disabled={Boolean(isLoading) || currentPage >= totalPages} onClick={() => changePage(currentPage + 1)} className="grid size-9 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={16} /></button>
      </nav>
    </div> : isLoading && rows.length > 0 ? <p role="status" className="flex items-center gap-2 border-t border-slate-100 px-4 py-2 text-xs text-slate-500"><LoaderCircle size={14} className="animate-spin" />Updating…</p> : null}
  </div>;
}
