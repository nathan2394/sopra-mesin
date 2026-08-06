import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { PagedResult } from "../api/client";
import type {
  Machine,
  MachineDraft,
  MaintenanceWindow,
  MaintenanceWindowDraft,
  ScheduleJob,
  ScheduleJobDraft,
} from "../types";

type ApiMachine = Omit<Machine, "id"> & { id: number };
type ApiWindow = Omit<MaintenanceWindow, "id" | "machineId" | "affectedScheduleId"> & { id: number; machineId: number; affectedScheduleId?: number };
type StoredJob = ScheduleJob & {
  preformName?: string;
  cavity?: number;
  setupPercent: number;
  progressPercent: number;
  reason?: string;
  orderLineIds: number[];
};

interface ApiJob {
  id: number;
  machineId: number;
  isLocked: boolean;
  isMaintenance: boolean;
  itemName: string;
  preformName?: string;
  cavity?: number;
  quantity: number;
  setupPercent: number;
  progressPercent: number;
  setupMinutes: number;
  startsAt: string;
  endsAt: string;
  deliveryDate?: string;
  reason?: string;
  blockingMaintenanceId?: number;
  blockingMaintenanceReason?: string;
  status: ScheduleJob["status"];
  orders: Array<{ orderLineId: number; orderNumber: string; customerName?: string; itemCode?: string }>;
}

const machineFromApi = (machine: ApiMachine): Machine => ({ ...machine, id: String(machine.id) });
const windowFromApi = (window: ApiWindow): MaintenanceWindow => ({
  ...window,
  id: String(window.id),
  machineId: String(window.machineId),
  affectedScheduleId: window.affectedScheduleId ? String(window.affectedScheduleId) : undefined,
});
const jobFromApi = (job: ApiJob): StoredJob => ({
  id: String(job.id),
  machineId: String(job.machineId),
  isLocked: job.isLocked,
  productName: job.itemName,
  qty: job.quantity,
  startAt: job.startsAt,
  endAt: job.endsAt,
  setupMinutes: job.setupMinutes,
  deliveryDate: job.deliveryDate ?? job.endsAt,
  sourceOrderRefs: job.orders.map((order) => order.orderNumber).join(", ") || undefined,
  status: job.status,
  customerName: job.orders[0]?.customerName,
  itemCode: job.orders[0]?.itemCode,
  preformName: job.preformName,
  cavity: job.cavity,
  setupPercent: job.setupPercent,
  progressPercent: job.progressPercent,
  reason: job.reason,
  blockingMaintenanceId: job.blockingMaintenanceId ? String(job.blockingMaintenanceId) : undefined,
  blockingMaintenanceReason: job.blockingMaintenanceReason,
  orderLineIds: job.orders.map((order) => order.orderLineId),
});

const jobBody = (job: StoredJob) => ({
  machineId: Number(job.machineId),
  isLocked: job.isLocked,
  itemName: job.productName,
  preformName: job.preformName,
  cavity: job.cavity,
  quantity: job.qty,
  setupPercent: job.setupPercent,
  progressPercent: job.progressPercent,
  setupMinutes: job.setupMinutes,
  startsAt: job.startAt,
  endsAt: job.endAt,
  deliveryDate: job.deliveryDate.slice(0, 10),
  reason: job.reason,
  status: job.status,
  orderLineIds: job.orderLineIds,
});

const report = (cause: unknown) =>
  window.alert(cause instanceof Error ? cause.message : "API request failed");
const localDateTime = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;

export function useProduction(
  machinePage = 1,
  machinePageSize = 100,
  maintenancePage = 1,
  maintenancePageSize = 100,
  filters: { machineSearch?: string; machineType?: string; machineIsActive?: boolean; maintenanceSearch?: string; maintenanceMachineId?: string; maintenanceType?: string; maintenanceScheduleType?: string } = {},
  scheduleFilters: { scheduleStartAt?: Date; scheduleEndAt?: Date } = {},
) {
  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineOptions, setMachineOptions] = useState<Machine[]>([]);
  const [maintenanceWindows, setMaintenanceWindows] = useState<MaintenanceWindow[]>([]);
  const [scheduleJobs, setScheduleJobs] = useState<StoredJob[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [machinePagination, setMachinePagination] = useState({ page: machinePage, pageSize: machinePageSize, totalItems: 0, totalPages: 0 });
  const [maintenancePagination, setMaintenancePagination] = useState({ page: maintenancePage, pageSize: maintenancePageSize, totalItems: 0, totalPages: 0 });

  const refresh = useCallback(async (options: { silent?: boolean } = {}) => {
    if (!options.silent) setIsLoading(true);
    try {
      const machineQuery = new URLSearchParams({ page: String(machinePage), pageSize: String(machinePageSize) });
      if (filters.machineSearch) machineQuery.set("search", filters.machineSearch);
      if (filters.machineType) machineQuery.set("type", filters.machineType);
      if (filters.machineIsActive !== undefined) machineQuery.set("isActive", String(filters.machineIsActive));
      const maintenanceQuery = new URLSearchParams({ page: String(maintenancePage), pageSize: String(maintenancePageSize) });
      const scheduleQuery = new URLSearchParams();
      if (filters.maintenanceSearch) maintenanceQuery.set("search", filters.maintenanceSearch);
      if (filters.maintenanceMachineId) maintenanceQuery.set("machineId", filters.maintenanceMachineId);
      if (filters.maintenanceType) maintenanceQuery.set("type", filters.maintenanceType);
      if (filters.maintenanceScheduleType) maintenanceQuery.set("scheduleType", filters.maintenanceScheduleType);
      if (scheduleFilters.scheduleStartAt) scheduleQuery.set("startAt", localDateTime(scheduleFilters.scheduleStartAt));
      if (scheduleFilters.scheduleEndAt) scheduleQuery.set("endAt", localDateTime(scheduleFilters.scheduleEndAt));
      const [machineRows, allMachineRows, windowRows, jobRows] = await Promise.all([
        api<PagedResult<ApiMachine>>(`/machines?${machineQuery}`),
        api<PagedResult<ApiMachine>>("/machines?page=1&pageSize=100"),
        api<PagedResult<ApiWindow>>(`/maintenance-windows?${maintenanceQuery}`),
        api<ApiJob[]>(`/schedules${scheduleQuery.size > 0 ? `?${scheduleQuery}` : ""}`),
      ]);
      setMachines(machineRows.items.map(machineFromApi));
      setMachineOptions(allMachineRows.items.map(machineFromApi));
      setMaintenanceWindows(windowRows.items.map(windowFromApi));
      setMachinePagination({ page: machineRows.page, pageSize: machineRows.pageSize, totalItems: machineRows.totalItems, totalPages: machineRows.totalPages });
      setMaintenancePagination({ page: windowRows.page, pageSize: windowRows.pageSize, totalItems: windowRows.totalItems, totalPages: windowRows.totalPages });
      setScheduleJobs(jobRows.filter((job) => !job.isMaintenance).map(jobFromApi));
    } catch (cause) {
      report(cause);
    } finally {
      if (!options.silent) setIsLoading(false);
    }
  }, [machinePage, machinePageSize, maintenancePage, maintenancePageSize, filters.machineSearch, filters.machineType, filters.machineIsActive, filters.maintenanceSearch, filters.maintenanceMachineId, filters.maintenanceType, filters.maintenanceScheduleType, scheduleFilters.scheduleStartAt, scheduleFilters.scheduleEndAt]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const onFocus = () => void refresh({ silent: true });
    window.addEventListener("focus", onFocus);
    return () => window.removeEventListener("focus", onFocus);
  }, [refresh]);

  useEffect(() => {
    const now = Date.now();
    const nextTransition = [...scheduleJobs.flatMap((job) => [job.startAt, job.endAt]), ...maintenanceWindows.flatMap((window) => [window.startAt, window.endAt])]
      .map((value) => new Date(value).getTime())
      .filter((time) => time > now)
      .sort((a, b) => a - b)[0];
    if (!nextTransition) return;
    const timer = window.setTimeout(() => void refresh({ silent: true }), Math.min(nextTransition - now + 500, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [maintenanceWindows, refresh, scheduleJobs]);

  const addMachine = useCallback(async (draft: MachineDraft) => {
    try {
      await api<ApiMachine>("/machines", { method: "POST", body: JSON.stringify(draft) });
      await refresh();
    } catch (cause) { report(cause); }
  }, [refresh]);

  const updateMachine = useCallback(async (id: string, draft: MachineDraft) => {
    try {
      await api<ApiMachine>(`/machines/${id}`, {
        method: "PUT",
        body: JSON.stringify(draft),
      });
      await refresh();
    } catch (cause) { report(cause); }
  }, [refresh]);

  const removeMachine = useCallback(async (id: string) => {
    try {
      await api<void>(`/machines/${id}`, { method: "DELETE" });
      await refresh();
    } catch (cause) { report(cause); }
  }, [refresh]);

  const addMaintenanceWindow = useCallback(async (draft: MaintenanceWindowDraft) => {
    try {
      await api<ApiWindow>("/maintenance-windows", {
        method: "POST",
        body: JSON.stringify({ ...draft, machineId: Number(draft.machineId), affectedScheduleId: draft.affectedScheduleId ? Number(draft.affectedScheduleId) : undefined }),
      });
      await refresh();
    } catch (cause) { report(cause); }
  }, [refresh]);

  const removeMaintenanceWindow = useCallback(async (id: string) => {
    try {
      await api<void>(`/maintenance-windows/${id}`, { method: "DELETE" });
      await refresh();
    } catch (cause) { report(cause); }
  }, [refresh]);

  const updateMaintenanceWindow = useCallback(async (id: string, draft: MaintenanceWindowDraft) => {
    try {
      await api<ApiWindow>(`/maintenance-windows/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...draft, machineId: Number(draft.machineId), affectedScheduleId: draft.affectedScheduleId ? Number(draft.affectedScheduleId) : undefined }),
      });
      await refresh();
    } catch (cause) { report(cause); }
  }, [refresh]);

  const addCorrectiveMaintenance = useCallback(async (jobId: string, reason: string, estimatedHours: number) => {
    const job = scheduleJobs.find((row) => row.id === jobId);
    if (!job) return;
    const startAt = new Date(Math.max(Date.now(), new Date(job.startAt).getTime()));
    const endAt = new Date(startAt.getTime() + estimatedHours * 3_600_000);
    try {
      await api<ApiWindow>("/maintenance-windows", {
        method: "POST",
        body: JSON.stringify({
          machineId: Number(job.machineId),
          startAt: localDateTime(startAt),
          endAt: localDateTime(endAt),
          type: "Corrective Maintenance",
          reason,
          scheduleType: "One Time",
          affectedScheduleId: Number(job.id),
        }),
      });
      await refresh();
    } catch (cause) { report(cause); }
  }, [refresh, scheduleJobs]);

  const addJob = useCallback(async (draft: ScheduleJobDraft) => {
    const job: StoredJob = {
      ...draft,
      id: "",
      setupPercent: 0,
      progressPercent: 0,
      orderLineIds: [],
    };
    try {
      const created = await api<ApiJob>("/schedules", { method: "POST", body: JSON.stringify(jobBody(job)) });
      setScheduleJobs((rows) => [jobFromApi(created), ...rows]);
    } catch (cause) { report(cause); }
  }, []);

  const updateJob = useCallback(async (id: string, patch: Partial<ScheduleJobDraft>) => {
    const current = scheduleJobs.find((job) => job.id === id);
    if (!current) return;
    try {
      const updated = await api<ApiJob>(`/schedules/${id}`, {
        method: "PUT",
        body: JSON.stringify(jobBody({ ...current, ...patch })),
      });
      setScheduleJobs((rows) => rows.map((row) => row.id === id ? jobFromApi(updated) : row));
    } catch (cause) { report(cause); }
  }, [scheduleJobs]);

  const removeJob = useCallback(async (id: string) => {
    try {
      await api<void>(`/schedules/${id}`, { method: "DELETE" });
      setScheduleJobs((rows) => rows.filter((row) => row.id !== id));
    } catch (cause) { report(cause); }
  }, []);

  const moveJob = useCallback(async (id: string, _machineId: string, start: Date) => {
    const current = scheduleJobs.find((job) => job.id === id);
    if (!current) return false;
    try {
      await api<ApiJob>(`/schedules/${id}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({ startsAt: localDateTime(start) }),
      });
      await refresh();
      return true;
    } catch (cause) { report(cause); return false; }
  }, [refresh, scheduleJobs]);

  return {
    machines,
    machineOptions,
    machinePagination,
    maintenanceWindows,
    maintenancePagination,
    scheduleJobs,
    isLoading,
    addMachine,
    updateMachine,
    removeMachine,
    addMaintenanceWindow,
    updateMaintenanceWindow,
    removeMaintenanceWindow,
    addCorrectiveMaintenance,
    addJob,
    updateJob,
    removeJob,
    moveJob,
    refresh,
    resetSampleData: refresh,
  };
}
