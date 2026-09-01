import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { PropsWithChildren } from "react";
import { api } from "../api/client";

export type OptimizationJobStatus = "Queued" | "Processing" | "Ready" | "Applied" | "Failed";

export interface OptimizationJobSummary {
  id: number;
  status: OptimizationJobStatus;
  isRead: boolean;
  errorMessage?: string;
  createdAt: string;
  startedAt?: string;
  completedAt?: string;
}

export interface OptimizationJobDetail {
  job: OptimizationJobSummary;
  request: unknown;
  response: unknown;
}

interface OptimizationStatus {
  busy: boolean;
  latest: OptimizationJobSummary | null;
}

interface OptimizationContextValue extends OptimizationStatus {
  refresh: () => Promise<void>;
  start: (payload: unknown) => Promise<OptimizationJobSummary>;
  get: (id: number) => Promise<OptimizationJobDetail>;
  markRead: (id: number) => Promise<void>;
  markApplied: (id: number) => Promise<void>;
}

const OptimizationContext = createContext<OptimizationContextValue | null>(null);

export function ScheduleOptimizationProvider({ children }: PropsWithChildren) {
  const [status, setStatus] = useState<OptimizationStatus>({ busy: false, latest: null });

  const refresh = useCallback(async () => {
    setStatus(await api<OptimizationStatus>("/schedule-optimizations/status"));
  }, []);

  useEffect(() => { void refresh().catch(() => undefined); }, [refresh]);
  useEffect(() => {
    if (!status.busy) return;
    const timer = window.setInterval(() => void refresh().catch(() => undefined), 30_000);
    return () => window.clearInterval(timer);
  }, [refresh, status.busy]);

  const value = useMemo<OptimizationContextValue>(() => ({
    ...status,
    refresh,
    start: async (payload) => {
      const job = await api<OptimizationJobSummary>("/schedule-optimizations", {
        method: "POST",
        body: JSON.stringify({ payload }),
      });
      setStatus({ busy: true, latest: job });
      return job;
    },
    get: (id) => api<OptimizationJobDetail>(`/schedule-optimizations/${id}`),
    markRead: async (id) => {
      const job = await api<OptimizationJobSummary>(`/schedule-optimizations/${id}/read`, { method: "POST" });
      setStatus((current) => ({ ...current, latest: current.latest?.id === id ? job : current.latest }));
    },
    markApplied: async (id) => {
      await api<OptimizationJobSummary>(`/schedule-optimizations/${id}/applied`, { method: "POST" });
      setStatus({ busy: false, latest: null });
    },
  }), [refresh, status]);

  return <OptimizationContext.Provider value={value}>{children}</OptimizationContext.Provider>;
}

export function useScheduleOptimization() {
  const context = useContext(OptimizationContext);
  if (!context) throw new Error("useScheduleOptimization must be used inside ScheduleOptimizationProvider");
  return context;
}
