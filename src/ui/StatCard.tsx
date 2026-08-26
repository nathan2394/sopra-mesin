import type { ReactNode } from "react";

export function StatsRow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-3 grid grid-cols-[repeat(auto-fit,minmax(140px,1fr))] gap-2.5">
      {children}
    </div>
  );
}

export function StatCard({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-lg border border-slate-200 bg-white px-3.5 py-3">
      <div className="text-lg font-bold leading-none text-slate-800 tabular-nums">{value}</div>
      <div className="mt-2 text-2xs text-slate-500">{label}</div>
    </div>
  );
}
