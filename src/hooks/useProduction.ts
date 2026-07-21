import { useCallback, useEffect, useState } from "react";
import {
  createSampleMachines,
  createSampleMaintenanceWindows,
  createSampleScheduleJobs,
} from "../mockData";
import { JobStatus } from "../types";
import type {
  Machine,
  MachineDraft,
  MaintenanceWindow,
  MaintenanceWindowDraft,
  ScheduleJob,
  ScheduleJobDraft,
} from "../types";

const STORAGE_KEY = "sopra-pps-production-mvp";

interface ProductionState {
  machines: Machine[];
  maintenanceWindows: MaintenanceWindow[];
  scheduleJobs: ScheduleJob[];
}

function generateFresh(): ProductionState {
  const machines = createSampleMachines();
  return {
    machines,
    maintenanceWindows: createSampleMaintenanceWindows(machines),
    scheduleJobs: createSampleScheduleJobs(machines),
  };
}

function load(): ProductionState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return generateFresh();
    const parsed = JSON.parse(raw) as ProductionState;
    if (!parsed.machines || parsed.machines.length === 0) return generateFresh();
    return parsed;
  } catch {
    return generateFresh();
  }
}

function save(state: ProductionState) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/**
 * Machines + maintenance windows + schedule jobs live together in one store (rather than
 * three) so cross-references (a job's machineId, a window's machineId) can never point at
 * something that no longer exists — deleting a machine cascades to its jobs/windows here.
 *
 * Dragging a job on the Gantt (see moveJob) does a simple local reflow: place it where it
 * was dropped, then push whatever it now overlaps later on that machine, respecting
 * maintenance windows. This is a UI/UX stand-in, not the real rule-based scheduling engine
 * designed for the .NET backend (see backend/docs/DESIGN.md for that algorithm).
 */
export function useProduction() {
  const [state, setState] = useState<ProductionState>(() => load());

  useEffect(() => {
    save(state);
  }, [state]);

  // --- Machines -------------------------------------------------------------------------

  const addMachine = useCallback((draft: MachineDraft) => {
    const timestamp = new Date().toISOString();
    setState((prev) => ({
      ...prev,
      machines: [{ ...draft, id: uid(), createdAt: timestamp, updatedAt: timestamp }, ...prev.machines],
    }));
  }, []);

  const updateMachine = useCallback((id: string, draft: MachineDraft) => {
    setState((prev) => ({
      ...prev,
      machines: prev.machines.map((m) => (m.id === id ? { ...m, ...draft, updatedAt: new Date().toISOString() } : m)),
    }));
  }, []);

  const removeMachine = useCallback((id: string) => {
    setState((prev) => ({
      machines: prev.machines.filter((m) => m.id !== id),
      maintenanceWindows: prev.maintenanceWindows.filter((w) => w.machineId !== id),
      scheduleJobs: prev.scheduleJobs.filter((j) => j.machineId !== id),
    }));
  }, []);

  // --- Maintenance windows ----------------------------------------------------------------

  const addMaintenanceWindow = useCallback((draft: MaintenanceWindowDraft) => {
    setState((prev) => ({ ...prev, maintenanceWindows: [{ ...draft, id: uid() }, ...prev.maintenanceWindows] }));
  }, []);

  const removeMaintenanceWindow = useCallback((id: string) => {
    setState((prev) => ({ ...prev, maintenanceWindows: prev.maintenanceWindows.filter((w) => w.id !== id) }));
  }, []);

  // --- Schedule jobs ----------------------------------------------------------------------

  const addJob = useCallback((draft: ScheduleJobDraft) => {
    setState((prev) => ({ ...prev, scheduleJobs: [{ ...draft, id: uid() }, ...prev.scheduleJobs] }));
  }, []);

  const updateJob = useCallback((id: string, draft: Partial<ScheduleJobDraft>) => {
    setState((prev) => ({
      ...prev,
      scheduleJobs: prev.scheduleJobs.map((j) => (j.id === id ? { ...j, ...draft } : j)),
    }));
  }, []);

  const removeJob = useCallback((id: string) => {
    setState((prev) => ({ ...prev, scheduleJobs: prev.scheduleJobs.filter((j) => j.id !== id) }));
  }, []);

  /** Drag-and-drop entry point: move `jobId` onto `newMachineId` starting at `newStartAt`,
   * then locally reflow whatever it now overlaps on that machine (push later, respecting
   * maintenance windows). Jobs already Done are left untouched. */
  const moveJob = useCallback((jobId: string, newMachineId: string, newStartAt: Date) => {
    setState((prev) => {
      const moving = prev.scheduleJobs.find((j) => j.id === jobId);
      if (!moving) return prev;

      const durationMs = new Date(moving.endAt).getTime() - new Date(moving.startAt).getTime();
      const movedStart = newStartAt;
      const movedEnd = new Date(newStartAt.getTime() + durationMs);

      const windows = prev.maintenanceWindows.filter((w) => w.machineId === newMachineId);

      const clampAroundMaintenance = (start: Date, end: Date): [Date, Date] => {
        let s = start;
        let e = end;
        for (let i = 0; i < 10; i++) {
          const hit = windows.find((w) => new Date(w.startAt) < e && new Date(w.endAt) > s);
          if (!hit) break;
          const shift = new Date(hit.endAt).getTime() - s.getTime();
          s = new Date(hit.endAt);
          e = new Date(e.getTime() + shift);
        }
        return [s, e];
      };

      const [clampedMovedStart, clampedMovedEnd] = clampAroundMaintenance(movedStart, movedEnd);

      const updated = prev.scheduleJobs.map((j) =>
        j.id === jobId
          ? { ...j, machineId: newMachineId, startAt: clampedMovedStart.toISOString(), endAt: clampedMovedEnd.toISOString() }
          : j
      );

      // Reflow the destination machine's other movable jobs in start-time order.
      const onMachine = updated
        .filter((j) => j.machineId === newMachineId && j.status !== JobStatus.Done)
        .sort((a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime());

      let cursor = new Date(0);
      const reflowedIds = new Set<string>();
      const final = updated.map((j) => {
        if (j.machineId !== newMachineId || j.status === JobStatus.Done) return j;
        const idx = onMachine.findIndex((o) => o.id === j.id);
        const ordered = onMachine[idx];
        if (reflowedIds.has(ordered.id)) return j;
        reflowedIds.add(ordered.id);

        let start = new Date(ordered.startAt);
        let end = new Date(ordered.endAt);
        if (start.getTime() < cursor.getTime()) {
          const dur = end.getTime() - start.getTime();
          start = cursor;
          end = new Date(cursor.getTime() + dur);
          [start, end] = clampAroundMaintenance(start, end);
        }
        cursor = end;

        return { ...j, startAt: start.toISOString(), endAt: end.toISOString() };
      });

      return { ...prev, scheduleJobs: final };
    });
  }, []);

  const resetSampleData = useCallback(() => {
    setState(generateFresh());
  }, []);

  return {
    machines: state.machines,
    maintenanceWindows: state.maintenanceWindows,
    scheduleJobs: state.scheduleJobs,
    addMachine,
    updateMachine,
    removeMachine,
    addMaintenanceWindow,
    removeMaintenanceWindow,
    addJob,
    updateJob,
    removeJob,
    moveJob,
    resetSampleData,
  };
}
