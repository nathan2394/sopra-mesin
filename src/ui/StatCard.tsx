import type { ReactNode } from "react";

export function StatsRow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 grid grid-cols-2 gap-px overflow-hidden rounded-lg border border-slate-200 bg-slate-200 [&>*:last-child:nth-child(odd)]:col-span-2 [&>*:last-child:nth-child(odd)]:items-center [&>*:last-child:nth-child(odd)]:text-center sm:grid-cols-[repeat(auto-fit,minmax(140px,1fr))] sm:gap-2.5 sm:overflow-visible sm:rounded-none sm:border-0 sm:bg-transparent sm:[&>*:last-child:nth-child(odd)]:col-span-1 sm:[&>*:last-child:nth-child(odd)]:items-stretch sm:[&>*:last-child:nth-child(odd)]:text-left">
      {children}
    </div>
  );
}

export function StatCard({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="flex min-h-20 flex-col justify-center bg-white px-3.5 py-3.5 sm:min-h-0 sm:rounded-lg sm:border sm:border-slate-200 sm:py-3">
      <div className="text-lg font-bold leading-none text-slate-800 tabular-nums">{value}</div>
      <div className="mt-2 text-2xs text-slate-500">{label}</div>
    </div>
  );
}
