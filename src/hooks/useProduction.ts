import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { PagedResult } from "../api/client";
import { notify } from "../components/Notification";
import type {
  Machine,
  MachineDraft,
  MaintenanceWindow,
  MaintenanceWindowDraft,
  Order,
  ScheduleJob,
  ScheduleJobDraft,
} from "../types";
import { toJakartaDateTime } from "../utils/dateFormat";
import type { OptimizedSchedule } from "../utils/optimization";

type ApiMachine = Omit<Machine, "id"> & { id: number };
type ApiWindow = Omit<MaintenanceWindow, "id" | "machineId" | "affectedScheduleId"> & { id: number; machineId: number; affectedScheduleId?: number };
type StoredJob = ScheduleJob & {
  reason?: string;
  purchaseOrderNumber?: string;
  orderLineId?: number;
};

interface ApiJob {
  id: number;
  machineId: number;
  machineLineCode: string;
  isLocked: boolean;
  isMaintenance: boolean;
  itemName: string;
  preform?: string;
  cavity?: number;
  quantity: number;
  startsAt: string;
  endsAt: string;
  deliveryDate?: string;
  reason?: string;
  blockingMaintenanceId?: number;
  blockingMaintenanceReason?: string;
  rescheduledScheduleIds?: number[];
  previousStartsAt?: Record<string, string>;
  status: ScheduleJob["status"];
  order?: { orderLineId: number; orderNumber: string; purchaseOrderNumber?: string; customerName?: string; itemCode?: string };
}

interface ProductionOptions {
  machines?: { page?: number; pageSize?: number; search?: string; type?: string; isActive?: boolean };
  machineOptions?: boolean;
  maintenance?: { page?: number; pageSize?: number; search?: string; machineId?: string; type?: string; scheduleType?: string; startAt?: Date; endAt?: Date };
  schedules?: { startAt?: Date; endAt?: Date };
}

interface MachineSummary {
  totalMachines: number;
  active: number;
  inactive: number;
  scheduledJobs: number;
}

interface MaintenanceSummary {
  totalWindows: number;
  recurring: number;
  oneTime: number;
  machines: number;
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
  preform: job.preform,
  cavity: job.cavity,
  qty: job.quantity,
  startAt: job.startsAt,
  endAt: job.endsAt,
  deliveryDate: job.deliveryDate ?? job.endsAt,
  sourceOrderRefs: job.order?.orderNumber,
  status: job.status,
  customerName: job.order?.customerName,
  itemCode: job.order?.itemCode,
  reason: job.reason,
  purchaseOrderNumber: job.order?.purchaseOrderNumber,
  blockingMaintenanceId: job.blockingMaintenanceId ? String(job.blockingMaintenanceId) : undefined,
  blockingMaintenanceReason: job.blockingMaintenanceReason,
  orderLineId: job.order?.orderLineId,
});

const jobBody = (job: StoredJob) => ({
  machineId: Number(job.machineId),
  isLocked: job.isLocked,
  itemName: job.productName,
  preform: job.preform,
  cavity: job.cavity,
  quantity: job.qty,
  startsAt: job.startAt,
  endsAt: job.endAt,
  deliveryDate: job.deliveryDate.slice(0, 10),
  reason: job.reason,
  status: job.status,
  orderLineId: job.orderLineId,
});

const report = (cause: unknown) =>
  notify("error", cause instanceof Error ? cause.message : "API request failed");
const localDateTime = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;
const getAllMaintenance = async () => {
  const first = await api<PagedResult<ApiWindow>>("/maintenance-windows?page=1&pageSize=100");
  const rest = await Promise.all(Array.from({ length: first.totalPages - 1 }, (_, index) =>
    api<PagedResult<ApiWindow>>(`/maintenance-windows?page=${index + 2}&pageSize=100`)
  ));
  return [first, ...rest].flatMap((page) => page.items);
};

export function useProduction(options: ProductionOptions = {}) {
  const machinePage = options.machines?.page ?? 1;
  const machinePageSize = options.machines?.pageSize ?? 100;
  const machineSearch = options.machines?.search ?? "";
  const machineType = options.machines?.type ?? "";
  const machineIsActive = options.machines?.isActive;
  const loadMachines = options.machines !== undefined;
  const loadMachineOptions = options.machineOptions === true;

  const maintenancePage = options.maintenance?.page ?? 1;
  const maintenancePageSize = options.maintenance?.pageSize ?? 100;
  const maintenanceSearch = options.maintenance?.search ?? "";
  const maintenanceMachineId = options.maintenance?.machineId ?? "";
  const maintenanceType = options.maintenance?.type ?? "";
  const maintenanceScheduleType = options.maintenance?.scheduleType ?? "";
  const maintenanceStartAt = options.maintenance?.startAt;
  const maintenanceEndAt = options.maintenance?.endAt;
  const loadMaintenance = options.maintenance !== undefined;

  const scheduleStartAt = options.schedules?.startAt;
  const scheduleEndAt = options.schedules?.endAt;
  const loadSchedules = options.schedules !== undefined;

  const [machines, setMachines] = useState<Machine[]>([]);
  const [machineOptions, setMachineOptions] = useState<Machine[]>([]);
  const [maintenanceWindows, setMaintenanceWindows] = useState<MaintenanceWindow[]>([]);
  const [scheduleJobs, setScheduleJobs] = useState<StoredJob[]>([]);
  const [machinesLoading, setMachinesLoading] = useState(loadMachines);
  const [machineOptionsLoading, setMachineOptionsLoading] = useState(loadMachineOptions);
  const [maintenanceLoading, setMaintenanceLoading] = useState(loadMaintenance);
  const [schedulesLoading, setSchedulesLoading] = useState(loadSchedules);
  const [machinePagination, setMachinePagination] = useState({ page: machinePage, pageSize: machinePageSize, totalItems: 0, totalPages: 0 });
  const [maintenancePagination, setMaintenancePagination] = useState({ page: maintenancePage, pageSize: maintenancePageSize, totalItems: 0, totalPages: 0 });
  const [machineSummary, setMachineSummary] = useState<MachineSummary>({ totalMachines: 0, active: 0, inactive: 0, scheduledJobs: 0 });
  const [maintenanceSummary, setMaintenanceSummary] = useState<MaintenanceSummary>({ totalWindows: 0, recurring: 0, oneTime: 0, machines: 0 });

  const refreshMachines = useCallback(async (silent = false) => {
    if (!loadMachines) return;
    if (!silent) setMachinesLoading(true);
    try {
      const query = new URLSearchParams({ page: String(machinePage), pageSize: String(machinePageSize) });
      if (machineSearch) query.set("search", machineSearch);
      if (machineType) query.set("type", machineType);
      if (machineIsActive !== undefined) query.set("isActive", String(machineIsActive));
      const rows = await api<PagedResult<ApiMachine, MachineSummary>>(`/machines?${query}`);
      setMachines(rows.items.map(machineFromApi));
      setMachinePagination({ page: rows.page, pageSize: rows.pageSize, totalItems: rows.totalItems, totalPages: rows.totalPages });
      if (rows.summary) setMachineSummary(rows.summary);
    } catch (cause) {
      report(cause);
    } finally {
      if (!silent) setMachinesLoading(false);
    }
  }, [loadMachines, machineIsActive, machinePage, machinePageSize, machineSearch, machineType]);

  const refreshMachineOptions = useCallback(async (silent = false) => {
    if (!loadMachineOptions) return;
    if (!silent) setMachineOptionsLoading(true);
    try {
      const rows = await api<PagedResult<ApiMachine>>("/machines?page=1&pageSize=100");
      setMachineOptions(rows.items.map(machineFromApi));
    } catch (cause) {
      report(cause);
    } finally {
      if (!silent) setMachineOptionsLoading(false);
    }
  }, [loadMachineOptions]);

  const refreshMaintenance = useCallback(async (silent = false) => {
    if (!loadMaintenance) return;
    if (!silent) setMaintenanceLoading(true);
    try {
      const query = new URLSearchParams({ page: String(maintenancePage), pageSize: String(maintenancePageSize) });
      if (maintenanceSearch) query.set("search", maintenanceSearch);
      if (maintenanceMachineId) query.set("machineId", maintenanceMachineId);
      if (maintenanceType) query.set("type", maintenanceType);
      if (maintenanceScheduleType) query.set("scheduleType", maintenanceScheduleType);
      if (maintenanceStartAt) query.set("startAt", localDateTime(maintenanceStartAt));
      if (maintenanceEndAt) query.set("endAt", localDateTime(maintenanceEndAt));
      const rows = await api<PagedResult<ApiWindow, MaintenanceSummary>>(`/maintenance-windows?${query}`);
      setMaintenanceWindows(rows.items.map(windowFromApi));
      setMaintenancePagination({ page: rows.page, pageSize: rows.pageSize, totalItems: rows.totalItems, totalPages: rows.totalPages });
      if (rows.summary) setMaintenanceSummary(rows.summary);
    } catch (cause) {
      report(cause);
    } finally {
      if (!silent) setMaintenanceLoading(false);
    }
  }, [loadMaintenance, maintenanceEndAt, maintenanceMachineId, maintenancePage, maintenancePageSize, maintenanceScheduleType, maintenanceSearch, maintenanceStartAt, maintenanceType]);

  const refreshSchedules = useCallback(async (silent = false) => {
    if (!loadSchedules) return;
    if (!silent) setSchedulesLoading(true);
    try {
      const query = new URLSearchParams();
      if (scheduleStartAt) query.set("startAt", localDateTime(scheduleStartAt));
      if (scheduleEndAt) query.set("endAt", localDateTime(scheduleEndAt));
      const rows = await api<ApiJob[]>(`/schedules${query.size ? `?${query}` : ""}`);
      setScheduleJobs(rows.filter((job) => !job.isMaintenance).map(jobFromApi));
    } catch (cause) {
      report(cause);
    } finally {
      if (!silent) setSchedulesLoading(false);
    }
  }, [loadSchedules, scheduleEndAt, scheduleStartAt]);

  const getScheduleJob = useCallback(async (id: string) => {
    try {
      return jobFromApi(await api<ApiJob>(`/schedules/${id}`));
    } catch (cause) {
      report(cause);
      return null;
    }
  }, []);

  useEffect(() => { void refreshMachines(); }, [refreshMachines]);
  useEffect(() => { void refreshMachineOptions(); }, [refreshMachineOptions]);
  useEffect(() => { void refreshMaintenance(); }, [refreshMaintenance]);
  useEffect(() => { void refreshSchedules(); }, [refreshSchedules]);

  useEffect(() => {
    if (!loadSchedules) return;
    const now = Date.now();
    const nextTransition = [...scheduleJobs.flatMap((job) => [job.startAt, job.endAt]), ...maintenanceWindows.flatMap((window) => [window.startAt, window.endAt])]
      .map((value) => new Date(value).getTime())
      .filter((time) => time > now)
      .sort((a, b) => a - b)[0];
    if (!nextTransition) return;
    const timer = window.setTimeout(() => void refreshSchedules(true), Math.min(nextTransition - now + 500, 2_147_483_647));
    return () => window.clearTimeout(timer);
  }, [loadSchedules, maintenanceWindows, refreshSchedules, scheduleJobs]);

  const refreshMachineData = useCallback(async () => {
    await Promise.all([refreshMachines(), refreshMachineOptions()]);
  }, [refreshMachineOptions, refreshMachines]);

  const refreshMaintenanceData = useCallback(async () => {
    await Promise.all([refreshMaintenance(), refreshSchedules(true)]);
  }, [refreshMaintenance, refreshSchedules]);

  const addMachine = useCallback(async (draft: MachineDraft) => {
    try {
      await api<ApiMachine>("/machines", { method: "POST", body: JSON.stringify(draft) });
      await refreshMachineData();
      notify("success", "Machine created successfully.");
      return true;
    } catch (cause) { report(cause); return false; }
  }, [refreshMachineData]);

  const updateMachine = useCallback(async (id: string, draft: MachineDraft) => {
    try {
      await api<ApiMachine>(`/machines/${id}`, { method: "PUT", body: JSON.stringify(draft) });
      await refreshMachineData();
      notify("success", "Machine updated successfully.");
      return true;
    } catch (cause) { report(cause); return false; }
  }, [refreshMachineData]);

  const removeMachine = useCallback(async (id: string) => {
    try {
      await api<void>(`/machines/${id}`, { method: "DELETE" });
      await refreshMachineData();
      notify("success", "Machine removed successfully.");
    } catch (cause) { report(cause); }
  }, [refreshMachineData]);

  const addMaintenanceWindows = useCallback(async (machineIds: string[], draft: Omit<MaintenanceWindowDraft, "machineId">) => {
    try {
      await api<ApiWindow[]>("/maintenance-windows/multiple", {
        method: "POST",
        body: JSON.stringify(machineIds.map((machineId) => ({
          ...draft,
          machineId: Number(machineId),
          affectedScheduleId: draft.affectedScheduleId ? Number(draft.affectedScheduleId) : undefined,
        }))),
      });
      await refreshMaintenanceData();
      notify("success", "Maintenance schedule created successfully.");
      return true;
    } catch (cause) { report(cause); return false; }
  }, [refreshMaintenanceData]);

  const removeMaintenanceWindow = useCallback(async (id: string) => {
    try {
      await api<void>(`/maintenance-windows/${id}`, { method: "DELETE" });
      await refreshMaintenanceData();
      notify("success", "Maintenance schedule removed successfully.");
    } catch (cause) { report(cause); }
  }, [refreshMaintenanceData]);

  const updateMaintenanceWindow = useCallback(async (id: string, draft: MaintenanceWindowDraft) => {
    try {
      await api<ApiWindow>(`/maintenance-windows/${id}`, {
        method: "PUT",
        body: JSON.stringify({ ...draft, machineId: Number(draft.machineId), affectedScheduleId: draft.affectedScheduleId ? Number(draft.affectedScheduleId) : undefined }),
      });
      await refreshMaintenanceData();
      notify("success", "Maintenance schedule updated successfully.");
      return true;
    } catch (cause) { report(cause); return false; }
  }, [refreshMaintenanceData]);

  const addCorrectiveMaintenance = useCallback(async (jobId: string, reason: string, estimatedHours: number) => {
    const job = scheduleJobs.find((row) => row.id === jobId);
    if (!job) return false;
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
      await refreshMaintenanceData();
      notify("success", "Corrective maintenance scheduled successfully.");
      return true;
    } catch (cause) { report(cause); return false; }
  }, [refreshMaintenanceData, scheduleJobs]);

  const updateJob = useCallback(async (id: string, patch: Partial<ScheduleJobDraft>) => {
    const current = scheduleJobs.find((job) => job.id === id);
    if (!current) return false;
    try {
      const updated = await api<ApiJob>(`/schedules/${id}`, {
        method: "PUT",
        body: JSON.stringify(jobBody({ ...current, ...patch })),
      });
      setScheduleJobs((rows) => rows.map((row) => row.id === id ? jobFromApi(updated) : row));
      await Promise.all([refreshSchedules(true), refreshMaintenance(true)]);
      notify("success", "Production schedule updated successfully.");
      return true;
    } catch (cause) { report(cause); return false; }
  }, [refreshMaintenance, refreshSchedules, scheduleJobs]);

  const moveJob = useCallback(async (id: string, _machineId: string, start: Date, restoreStartsAt?: Record<string, string>) => {
    const current = scheduleJobs.find((job) => job.id === id);
    if (!current) return false;
    try {
      const updated = await api<ApiJob>(`/schedules/${id}/reschedule`, {
        method: "PATCH",
        body: JSON.stringify({ startsAt: localDateTime(start), restoreStartsAt }),
      });
      await Promise.all([refreshSchedules(true), refreshMaintenance(true)]);
      return updated.previousStartsAt ?? {};
    } catch (cause) { report(cause); return false; }
  }, [refreshMaintenance, refreshSchedules, scheduleJobs]);

  const loadOptimizationContext = useCallback(async () => {
    const [jobs, maintenance] = await Promise.all([
      api<ApiJob[]>("/schedules"),
      getAllMaintenance(),
    ]);
    return {
      jobs: jobs.filter((job) => !job.isMaintenance).map(jobFromApi),
      maintenance: maintenance.map(windowFromApi),
    };
  }, []);

  const applyOptimizationResponse = useCallback(async (orders: Order[], optimized: OptimizedSchedule, optimizedItemIds: number[]) => {
    try {
      const [allJobs, existingMaintenance] = await Promise.all([
        api<ApiJob[]>("/schedules"),
        getAllMaintenance(),
      ]);
      const itemsById = new Map(orders.flatMap((order) => order.items.map((item) => [Number(item.id), { order, item }] as const)));
      const protectedJobsByItemId = new Map(allJobs
        .filter((job) => job.order && (job.isLocked || job.status !== "Open"))
        .map((job) => [job.order!.orderLineId, job] as const));
      const protectedScheduleIds = new Set([...protectedJobsByItemId.values()].map((job) => job.id));
      const optimizedItemIdSet = new Set(optimizedItemIds);
      const returnedItemIds = new Set(optimized.orderSchedules.map((row) => row.itemId));
      const claimedScheduleIds = new Set<number>();

      const schedules = optimized.orderSchedules.flatMap((result) => {
        const entry = itemsById.get(result.itemId);
        if (!entry) throw new Error(`Order item ${result.itemId} was not found.`);
        const { order, item } = entry;
        const matched = allJobs.find((job) => job.order?.orderLineId === result.itemId);
        if (matched && (matched.isLocked || matched.status !== "Open")) {
          const unchanged = matched.machineId === result.machineId &&
            toJakartaDateTime(matched.startsAt) === toJakartaDateTime(result.startAt) &&
            toJakartaDateTime(matched.endsAt) === toJakartaDateTime(result.endAt);
          if (!unchanged) {
            const aiMachine = allJobs.find((job) => job.machineId === result.machineId)?.machineLineCode ?? `Machine ${result.machineId}`;
            throw new Error(`Protected schedule #${matched.id} (item ${result.itemId}) cannot be changed. Current: ${matched.machineLineCode} · ${toJakartaDateTime(matched.startsAt)} → ${toJakartaDateTime(matched.endsAt)}. AI: ${aiMachine} · ${toJakartaDateTime(result.startAt)} → ${toJakartaDateTime(result.endAt)}.`);
          }
          return [];
        }
        const current = matched ? jobFromApi(matched) : undefined;
        const scheduleId = matched && !claimedScheduleIds.has(matched.id) ? matched.id : undefined;
        if (scheduleId !== undefined) claimedScheduleIds.add(scheduleId);
        const body = {
          machineId: result.machineId,
          isLocked: current?.isLocked ?? false,
          itemName: item.description,
          preform: result.preform,
          cavity: result.cavity,
          quantity: item.qty,
          startsAt: result.startAt,
          endsAt: result.endAt,
          deliveryDate: order.deliveryDate ? order.deliveryDate.slice(0, 10) : null,
          reason: current?.reason,
          status: current?.status ?? "Open",
          orderLineId: result.itemId,
        };
        return [{ id: scheduleId, ...body }];
      });

      const replaceableScheduleIds = new Set(allJobs.filter((job) =>
        !job.isMaintenance &&
        !protectedScheduleIds.has(job.id) &&
        job.order && optimizedItemIdSet.has(job.order.orderLineId)
      ).map((job) => job.id));
      const deleteScheduleIds = allJobs.filter((job) =>
        replaceableScheduleIds.has(job.id) &&
        job.order && !returnedItemIds.has(job.order.orderLineId)
      ).map((job) => job.id);
      const replacedSetup = existingMaintenance.filter((row) =>
        row.type === "Setup Maintenance" &&
        replaceableScheduleIds.has(row.affectedScheduleId ?? 0)
      );
      const maintenance = optimized.maintenanceSchedules.flatMap(({ maintenanceId: _, type, ...result }) => {
        const normalizedType = `${type.charAt(0).toUpperCase()}${type.slice(1).toLowerCase()} Maintenance`;
        const protectedJob = result.itemId ? protectedJobsByItemId.get(result.itemId) : undefined;
        if (normalizedType === "Setup Maintenance" && protectedJob) {
          const currentSetup = existingMaintenance.find((row) => row.type === "Setup Maintenance" && row.affectedScheduleId === protectedJob.id);
          if (!currentSetup) return [];
          const unchanged = currentSetup.machineId === result.machineId &&
            toJakartaDateTime(currentSetup.startAt) === toJakartaDateTime(result.startAt) &&
            toJakartaDateTime(currentSetup.endAt) === toJakartaDateTime(result.endAt);
          if (!unchanged) throw new Error(`AI attempted to change Setup Maintenance for protected schedule #${protectedJob.id} on ${protectedJob.machineLineCode}.`);
          return [];
        }
        const exists = normalizedType !== "Setup Maintenance" && existingMaintenance.some((row) =>
          row.machineId === result.machineId && row.startAt === result.startAt && row.endAt === result.endAt && row.type === normalizedType
        );
        return exists ? [] : [{
          ...result,
          type: normalizedType,
          reason: "AI schedule optimization",
          scheduleType: "One Time",
        }];
      });
      await api<object>("/schedules/bulk-optimization", {
        method: "POST",
        body: JSON.stringify({
          schedules,
          deleteScheduleIds,
          deleteMaintenanceIds: replacedSetup.map((row) => row.id),
          maintenanceSchedules: maintenance,
        }),
      });

      await Promise.all([refreshSchedules(), refreshMaintenance()]);
      notify("success", `Optimization applied: ${schedules.length} items, ${deleteScheduleIds.length} schedules removed, and ${maintenance.length} maintenance windows.`);
      return true;
    } catch (cause) { report(cause); return false; }
  }, [refreshMaintenance, refreshSchedules]);

  return {
    machines,
    machineOptions,
    machinePagination,
    machineSummary,
    maintenanceWindows,
    maintenancePagination,
    maintenanceSummary,
    scheduleJobs,
    isLoading: machinesLoading || machineOptionsLoading || maintenanceLoading || schedulesLoading,
    addMachine,
    updateMachine,
    removeMachine,
    addMaintenanceWindows,
    updateMaintenanceWindow,
    removeMaintenanceWindow,
    addCorrectiveMaintenance,
    updateJob,
    moveJob,
    getScheduleJob,
    loadOptimizationContext,
    applyOptimizationResponse,
    refreshMaintenance,
  };
}
