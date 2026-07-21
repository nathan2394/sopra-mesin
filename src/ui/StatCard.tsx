import type { ReactNode } from "react";

export function StatsRow({ children }: { children: ReactNode }) {
  return (
    <div className="mb-5 grid grid-cols-[repeat(auto-fit,minmax(160px,1fr))] gap-3.5">
      {children}
    </div>
  );
}

export function StatCard({ value, label }: { value: ReactNode; label: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-[1.6rem] font-bold text-slate-800">{value}</div>
      <div className="mt-0.5 text-[0.82rem] text-slate-500">{label}</div>
    </div>
  );
}
