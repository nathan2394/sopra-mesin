import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { api, currentUsername } from "../api/client";

export type OptimizationJobStatus = "Queued" | "Processing" | "Ready" | "Applied" | "Failed" | "Expired" | "Stale";

export interface OptimizationJobSummary {
  id: number;
  status: OptimizationJobStatus;
  isRead: boolean;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
  requestedBy: string;
  isLatest: boolean;
  canApply: boolean;
  applyUntil?: string;
}

export interface OptimizationJobDetail {
  job: OptimizationJobSummary;
  request: unknown;
  response: unknown;
}

interface OptimizationStatus {
  busy: boolean;
  latest: OptimizationJobSummary | null;
  jobs: OptimizationJobSummary[];
}

interface OptimizationContextValue extends OptimizationStatus {
  refresh: () => Promise<void>;
  start: () => Promise<OptimizationJobSummary>;
  get: (id: number) => Promise<OptimizationJobDetail>;
  markRead: (ids: number[]) => void;
}

const OptimizationContext = createContext<OptimizationContextValue | null>(null);

export function ScheduleOptimizationProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<OptimizationStatus>({ busy: false, latest: null, jobs: [] });
  const readKey = `sopra-optimization-read:${currentUsername()}`;

  const readIds = useCallback(() => {
    try {
      const ids: unknown = JSON.parse(localStorage.getItem(readKey) ?? "[]");
      return new Set<number>(Array.isArray(ids) ? ids.filter(Number.isInteger) : []);
    } catch {
      return new Set<number>();
    }
  }, [readKey]);

  const refresh = useCallback(async () => {
    const response = await api<OptimizationStatus>("/schedule-optimizations/status");
    const seen = readIds();
    setStatus({
      ...response,
      jobs: (response.jobs ?? (response.latest ? [response.latest] : []))
        .map((job) => ({ ...job, isRead: seen.has(job.id) })),
    });
  }, [readIds]);

  useEffect(() => { void refresh().catch(() => undefined); }, [refresh]);
  useEffect(() => {
    const timer = window.setInterval(() => void refresh().catch(() => undefined), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  const value = useMemo<OptimizationContextValue>(() => ({
    ...status,
    refresh,
    start: async () => {
      const job = await api<OptimizationJobSummary>("/schedule-optimizations", {
        method: "POST",
      });
      setStatus((current) => ({ busy: true, latest: job,
        jobs: [{ ...job, isRead: false }, ...current.jobs.filter((row) => row.id !== job.id)] }));
      return job;
    },
    get: (id) => api<OptimizationJobDetail>(`/schedule-optimizations/${id}`),
    markRead: (ids) => {
      const seen = readIds();
      ids.forEach((id) => seen.add(id));
      localStorage.setItem(readKey, JSON.stringify([...seen]));
      setStatus((current) => ({ ...current,
        jobs: current.jobs.map((job) => seen.has(job.id) ? { ...job, isRead: true } : job) }));
    },
  }), [readIds, readKey, refresh, status]);

  return <OptimizationContext.Provider value={value}>{children}</OptimizationContext.Provider>;
}

export function useScheduleOptimization() {
  const context = useContext(OptimizationContext);
  if (!context) throw new Error("useScheduleOptimization must be used inside ScheduleOptimizationProvider");
  return context;
}
