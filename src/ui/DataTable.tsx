import type { ReactNode } from "react";
import { ChevronLeft, ChevronRight, LoaderCircle } from "lucide-react";
import * as ui from "./classNames";

export interface DataTableColumn<T> {
  key: string;
  header: ReactNode;
  cell: (row: T) => ReactNode;
  className?: string;
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
  pagination?: {
    page: number;
    pageSize: number;
    totalItems: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    label?: string;
  };
}

export function DataTable<T>({ rows, columns, rowKey, emptyText = "No data found.", isLoading, rowClassName, tableClassName, containerClassName = ui.tableCard, pagination }: Props<T>) {
  const pages: Array<number | string> = pagination
    ? pagination.totalPages <= 5
      ? Array.from({ length: pagination.totalPages }, (_, index) => index + 1)
      : [...new Set([1, Math.max(2, pagination.page - 1), pagination.page, Math.min(pagination.totalPages - 1, pagination.page + 1), pagination.totalPages])]
          .sort((a, b) => a - b)
          .flatMap((page, index, values) => index > 0 && page - Number(values[index - 1]) > 1 ? [`ellipsis-${page}`, page] : [page])
    : [];

  const showLoadingRow = isLoading && rows.length === 0;

  return <div className={containerClassName}>
    <div className="max-h-[calc(100dvh-12rem)] overflow-auto overscroll-contain">
      <table className={ui.cx(ui.table, tableClassName)}>
        <thead><tr>{columns.map((column) => <th key={column.key} className={ui.cx(ui.th, column.className)}>{column.header}</th>)}</tr></thead>
        <tbody className={isLoading && rows.length > 0 ? "opacity-60 transition-opacity" : "transition-opacity"}>
          {rows.map((row) => <tr key={rowKey(row)} className={rowClassName?.(row)}>{columns.map((column) => <td key={column.key} className={ui.cx(ui.td, column.className)}>{column.cell(row)}</td>)}</tr>)}
          {showLoadingRow && <tr><td colSpan={columns.length} className={ui.cx(ui.td, "py-8 !text-center text-slate-500")}><span className="inline-flex items-center gap-2"><LoaderCircle size={14} className="animate-spin text-brand-600" />Loading data...</span></td></tr>}
          {!isLoading && rows.length === 0 && <tr><td colSpan={columns.length} className={ui.cx(ui.td, "py-8 !text-center text-slate-500")}>{emptyText}</td></tr>}
        </tbody>
      </table>
    </div>
    {pagination && <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 px-4 py-3">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-xs text-slate-500 tabular-nums">Showing {pagination.totalItems === 0 ? 0 : (pagination.page - 1) * pagination.pageSize + 1} to {Math.min(pagination.page * pagination.pageSize, pagination.totalItems)} of <span className="font-semibold text-slate-700">{pagination.totalItems}</span> records</p>
        {isLoading && rows.length > 0 && <span role="status" className="inline-flex items-center gap-2 text-xs text-slate-500"><LoaderCircle size={14} className="animate-spin text-brand-600" />Loading data...</span>}
      </div>
      <nav className="flex items-center gap-1.5" aria-label={`${pagination.label ?? "Table"} pagination`}>
        <button type="button" aria-label="Previous page" disabled={pagination.page <= 1} onClick={() => pagination.onPageChange(pagination.page - 1)} className="grid size-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronLeft size={15} /></button>
        {pages.map((page) => typeof page === "string" ? <span key={page} className="px-1 text-slate-400">...</span> : <button key={page} type="button" aria-current={page === pagination.page ? "page" : undefined} onClick={() => pagination.onPageChange(page)} className={ui.cx("grid size-8 place-items-center rounded-md border text-xs font-semibold", page === pagination.page ? "border-brand-600 bg-brand-600 text-white" : "border-slate-200 bg-white text-slate-600 hover:bg-slate-50")}>{page}</button>)}
        <button type="button" aria-label="Next page" disabled={pagination.page >= pagination.totalPages} onClick={() => pagination.onPageChange(pagination.page + 1)} className="grid size-8 place-items-center rounded-md border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-40"><ChevronRight size={15} /></button>
      </nav>
    </div>}
  </div>;
}
