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
import { toJakartaDateTime, formatDateTime } from "../utils/dateFormat";
import type { OptimizedSchedule } from "../utils/optimization";
import { normalizeMaintenanceType } from "../utils/optimization";

type ApiMachine = Omit<Machine, "id"> & { id: number };
type ApiWindow = Omit<MaintenanceWindow, "id" | "machineId" | "affectedScheduleId"> & { id: number; machineId: number; affectedScheduleId?: number };
type OptimizationMaintenanceBody = Omit<OptimizedSchedule["maintenanceSchedules"][number], "maintenanceId" | "itemId"> & {
  itemId?: string[];
  orderLineId?: number;
  bufferId?: number;
  bufferSequenceNo?: number;
  replacesMaintenanceId?: number;
  scheduleType: string;
};
type StoredJob = ScheduleJob & {
  reason?: string;
  purchaseOrderNumber?: string;
  orderLineId?: number;
  bufferId?: number;
  bufferSequenceNo?: number;
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
  setupMaintenanceId?: number;
  blockingMaintenanceId?: number;
  blockingMaintenanceReason?: string;
  rescheduledScheduleIds?: number[];
  previousStartsAt?: Record<string, string>;
  status: ScheduleJob["status"];
  order?: { orderLineId: number; orderNumber: string; purchaseOrderNumber?: string; customerName?: string; itemCode?: string };
  bufferId?: number;
  bufferSequenceNo?: number;
}

interface ProductionOptions {
  machines?: { page?: number; pageSize?: number; search?: string; type?: string; isActive?: boolean };
  machineOptions?: boolean;
  maintenance?: { page?: number; pageSize?: number; search?: string; machineId?: string; type?: string; scheduleType?: string; startAt?: Date; endAt?: Date; excludeSetup?: boolean };
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
  setupMaintenanceId: job.setupMaintenanceId ? String(job.setupMaintenanceId) : undefined,
  blockingMaintenanceId: job.blockingMaintenanceId ? String(job.blockingMaintenanceId) : undefined,
  blockingMaintenanceReason: job.blockingMaintenanceReason,
  orderLineId: job.order?.orderLineId,
  bufferId: job.bufferId,
  bufferSequenceNo: job.bufferSequenceNo,
});

const itemIdOf = (job: { order?: { orderLineId: number }; bufferId?: number; bufferSequenceNo?: number }) =>
  job.order ? `O-${job.order.orderLineId}` : job.bufferId && job.bufferSequenceNo
    ? `B-${job.bufferId}-${job.bufferSequenceNo}` : null;

const jobBody = (job: StoredJob) => ({
  machineId: Number(job.machineId),
  isLocked: job.isLocked,
  itemName: job.productName,
  preform: job.preform,
  cavity: job.cavity,
  quantity: job.qty,
  startsAt: job.startAt,
  endsAt: job.endAt,
  deliveryDate: job.bufferId ? null : job.deliveryDate.slice(0, 10),
  reason: job.reason,
  status: job.status,
  orderLineId: job.orderLineId,
  bufferId: job.bufferId,
  bufferSequenceNo: job.bufferSequenceNo,
});

const report = (cause: unknown) =>
  notify("error", cause instanceof Error ? cause.message : "Permintaan belum dapat diproses\n\nMuat ulang dan periksa data sebelum mencoba lagi.");
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
  const excludeSetup = options.maintenance?.excludeSetup ?? false;
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

  const refreshMaintenance = useCallback(async (silent = false, propagateError = false) => {
    if (!loadMaintenance) return;
    if (!silent) setMaintenanceLoading(true);
    try {
      const query = new URLSearchParams({ page: String(maintenancePage), pageSize: String(maintenancePageSize) });
      if (maintenanceSearch) query.set("search", maintenanceSearch);
      if (maintenanceMachineId) query.set("machineId", maintenanceMachineId);
      if (maintenanceType) query.set("type", maintenanceType);
      if (excludeSetup) query.set("excludeSetup", "true");
      if (maintenanceScheduleType) query.set("scheduleType", maintenanceScheduleType);
      if (maintenanceStartAt) query.set("startAt", toJakartaDateTime(maintenanceStartAt));
      if (maintenanceEndAt) query.set("endAt", toJakartaDateTime(maintenanceEndAt));
      const rows = await api<PagedResult<ApiWindow, MaintenanceSummary>>(`/maintenance-windows?${query}`);
      setMaintenanceWindows(rows.items.map(windowFromApi));
      setMaintenancePagination({ page: rows.page, pageSize: rows.pageSize, totalItems: rows.totalItems, totalPages: rows.totalPages });
      if (rows.summary) setMaintenanceSummary(rows.summary);
    } catch (cause) {
      if (propagateError) throw cause;
      report(cause);
    } finally {
      if (!silent) setMaintenanceLoading(false);
    }
  }, [loadMaintenance, maintenanceEndAt, maintenanceMachineId, maintenancePage, maintenancePageSize, maintenanceScheduleType, maintenanceSearch, maintenanceStartAt, maintenanceType, excludeSetup]);

  const refreshSchedules = useCallback(async (silent = false, propagateError = false) => {
    if (!loadSchedules) return;
    if (!silent) setSchedulesLoading(true);
    try {
      const query = new URLSearchParams();
      if (scheduleStartAt) query.set("startAt", toJakartaDateTime(scheduleStartAt));
      if (scheduleEndAt) query.set("endAt", toJakartaDateTime(scheduleEndAt));
      const rows = await api<ApiJob[]>(`/schedules${query.size ? `?${query}` : ""}`);
      setScheduleJobs(rows.filter((job) => !job.isMaintenance).map(jobFromApi));
    } catch (cause) {
      if (propagateError) throw cause;
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

  const getSetupJobs = useCallback(async (setup: MaintenanceWindow) => {
    const rows = await api<ApiJob[]>(`/schedules?${new URLSearchParams({ machineId: setup.machineId })}`);
    return rows.filter(job => !job.isMaintenance && (String(job.setupMaintenanceId) === setup.id ||
      String(job.id) === setup.affectedScheduleId || (!job.setupMaintenanceId && !setup.affectedScheduleId &&
        Date.parse(job.startsAt) === Date.parse(setup.endAt))))
      .map(jobFromApi).sort((a, b) => Date.parse(a.startAt) - Date.parse(b.startAt));
  }, []);

  const getMaintenanceWindow = useCallback(async (id: string) => {
    try {
      return windowFromApi(await api<ApiWindow>(`/maintenance-windows/${id}`));
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
      await api<ApiMachine>(`/machines/${id}`, { method: "POST", body: JSON.stringify(draft) });
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
        method: "POST",
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
          startAt: toJakartaDateTime(startAt),
          endAt: toJakartaDateTime(endAt),
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
        method: "POST",
        body: JSON.stringify(jobBody({ ...current, ...patch })),
      });
      setScheduleJobs((rows) => rows.map((row) => row.id === id ? jobFromApi(updated) : row));
      await Promise.all([refreshSchedules(true), refreshMaintenance(true)]);
      notify("success", "Production schedule updated successfully.");
      return true;
    } catch (cause) { report(cause); return false; }
  }, [refreshMaintenance, refreshSchedules, scheduleJobs]);

  const moveJob = useCallback(async (id: string, machineId: string, start: Date, restoreStartsAt?: Record<string, string>) => {
    const current = scheduleJobs.find((job) => job.id === id);
    if (!current) return false;
    try {
      const updated = await api<ApiJob>(`/schedules/${id}/reschedule`, {
        method: "POST",
        body: JSON.stringify({ machineId: Number(machineId), startsAt: toJakartaDateTime(start), restoreStartsAt }),
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

  const applyOptimizationResponse = useCallback(async (jobId: number, orders: Order[], optimized: OptimizedSchedule) => {
    try {
      const [allJobs, existingMaintenance] = await Promise.all([
        api<ApiJob[]>("/schedules"),
        getAllMaintenance(),
      ]);
      const buffers = await api<Array<{ id: number; name: string; qtyBuffer: number; sequenceNo: number }>>("/buffers");
      const itemsById = new Map<string, { order: Order; item: Order["items"][number] }>(
        orders.flatMap((order) => order.items.map((item) => [`O-${item.id}`, { order, item }] as const)));
      const buffersById = new Map<string, typeof buffers[number]>(
        buffers.map((buffer) => [`B-${buffer.id}-${buffer.sequenceNo}`, buffer] as const));
      const now = Date.now();
      const activeCorrectiveScheduleIds = new Set(existingMaintenance
        .filter((row) => row.type === "Corrective Maintenance" && row.affectedScheduleId && Date.parse(row.endAt) > now)
        .map((row) => Number(row.affectedScheduleId)));
      const startedSetupIds = new Set(allJobs
        .filter((job) => job.setupMaintenanceId && Date.parse(job.startsAt) <= now && Date.parse(job.endsAt) > now)
        .map((job) => job.setupMaintenanceId!));
      existingMaintenance.filter((row) => row.type === "Setup Maintenance" &&
        Date.parse(row.startAt) <= now && Date.parse(row.endAt) > now)
        .forEach((row) => startedSetupIds.add(row.id));
      const protectedJobsByItemId = new Map(allJobs
        .filter((job) => itemIdOf(job) && (Date.parse(job.startsAt) <= now ||
          startedSetupIds.has(job.setupMaintenanceId ?? 0) ||
          job.status !== "Open" && !(job.status === "Production Pending" && activeCorrectiveScheduleIds.has(job.id))))
        .map((job) => [itemIdOf(job)!, job] as const));
      const protectedScheduleIds = new Set([...protectedJobsByItemId.values()].map((job) => job.id));
      const returnedItemIds = new Set(optimized.orderSchedules.map((row) => row.itemId));
      const incompletePending = allJobs.find((job) => {
        if (job.status !== "Production Pending" || protectedScheduleIds.has(job.id)) return false;
        const itemId = itemIdOf(job);
        const production = optimized.orderSchedules.find((row) => row.itemId === itemId);
        const corrective = optimized.maintenanceSchedules.filter((row) =>
          normalizeMaintenanceType(row.type) === "Corrective Maintenance" &&
          (Array.isArray(row.itemId) ? row.itemId.length === 1 && row.itemId[0] === itemId : row.itemId === itemId));
        return !production || corrective.length !== 1 || corrective[0].machineId !== production.machineId;
      });
      if (incompletePending) throw new Error(
        `Jadwal tertahan tidak lengkap\n\nAI harus mengembalikan produksi dan corrective maintenance untuk ${incompletePending.itemName} di ${incompletePending.machineLineCode}. Keduanya harus terhubung ke order yang sama dan memakai mesin yang sama. Tidak ada jadwal yang diterapkan.`);
      const missingLocked = allJobs.find((job) => job.isLocked && !protectedScheduleIds.has(job.id) &&
        itemIdOf(job) && !returnedItemIds.has(itemIdOf(job)!));
      if (missingLocked) throw new Error(
        `Jadwal terkunci tidak lengkap\n\nAI tidak mengembalikan jadwal terkunci untuk ${missingLocked.itemName} di ${missingLocked.machineLineCode}. Hasil optimasi tidak diterapkan. Jalankan Optimize Schedule kembali.`);
      const missingGroupOrder = allJobs.find((job) =>
        startedSetupIds.has(job.setupMaintenanceId ?? 0) && Date.parse(job.endsAt) > now && itemIdOf(job) &&
        !returnedItemIds.has(itemIdOf(job)!));
      if (missingGroupOrder) throw new Error(
        `Grup setup tidak lengkap\n\nSetup atau produksi di ${missingGroupOrder.machineLineCode} sudah mulai. AI tidak mengembalikan ${missingGroupOrder.itemName}. Optimasi dibatalkan.`);
      const hasBufferResult = optimized.orderSchedules.some((row) => row.itemId.startsWith("B-"));
      const claimedScheduleIds = new Set<number>();

      const schedules = optimized.orderSchedules.flatMap((result) => {
        const entry = itemsById.get(result.itemId);
        const buffer = buffersById.get(result.itemId);
        if (!entry && !buffer) throw new Error("Item sudah berubah\n\nItem pada hasil optimasi tidak lagi tersedia. Muat ulang data dan jalankan optimasi kembali.");
        const matched = allJobs.find((job) => itemIdOf(job) === result.itemId);
        if (matched && protectedScheduleIds.has(matched.id)) {
          const unchanged = matched.machineId === result.machineId &&
            toJakartaDateTime(matched.startsAt) === toJakartaDateTime(result.startAt) &&
            toJakartaDateTime(matched.endsAt) === toJakartaDateTime(result.endAt) &&
            (matched.preform ?? "") === result.preform && matched.cavity === result.cavity &&
            Number(matched.quantity) === result.quantity;
          if (!unchanged) {
            const aiMachine = allJobs.find((job) => job.machineId === result.machineId)?.machineLineCode ?? "mesin lain";
            const reason = Date.parse(matched.endsAt) <= now ? "Produksi sudah selesai dan menjadi riwayat."
              : Date.parse(matched.startsAt) <= now ? "Produksi sedang berjalan."
              : startedSetupIds.has(matched.setupMaintenanceId ?? 0) ? "Setup atau produksi dalam grup sudah mulai."
              : activeCorrectiveScheduleIds.has(matched.id) || matched.status === "Production Pending" ? "Produksi tertahan corrective maintenance."
              : "Status produksi belum memungkinkan perubahan.";
            throw new Error(`Jadwal yang dilindungi tidak boleh berubah\n\n${reason} AI mengubah mesin, waktu, atau detail produksinya.\n\nOrder: ${matched.order?.orderNumber || "—"}\nProduk: ${matched.itemName}\nMesin saat ini: ${matched.machineLineCode}\nMulai: ${formatDateTime(matched.startsAt)} WIB\nSelesai: ${formatDateTime(matched.endsAt)} WIB\nMesin dari AI: ${aiMachine}\n\nTidak ada jadwal yang diterapkan. Jalankan Optimize Schedule kembali.`);
          }
          return [];
        }
        const current = matched ? jobFromApi(matched) : undefined;
        const scheduleId = matched && !claimedScheduleIds.has(matched.id) ? matched.id : undefined;
        if (scheduleId !== undefined) claimedScheduleIds.add(scheduleId);
        const body = {
          machineId: result.machineId,
          isLocked: current?.isLocked ?? false,
          itemName: entry?.item.description ?? buffer!.name,
          preform: result.preform,
          cavity: result.cavity,
          quantity: result.quantity,
          startsAt: result.startAt,
          endsAt: result.endAt,
          deliveryDate: entry?.order.deliveryDate ? entry.order.deliveryDate.slice(0, 10) : null,
          reason: current?.reason,
          status: current?.status === "Production Pending" ? "Open" : current?.status ?? "Open",
          orderLineId: entry ? Number(entry.item.id) : null,
          bufferId: buffer?.id ?? null,
          bufferSequenceNo: buffer?.sequenceNo ?? null,
        };
        return [{ id: scheduleId, ...body }];
      });

      const replaceableScheduleIds = new Set(allJobs.filter((job) =>
        !job.isMaintenance &&
        !protectedScheduleIds.has(job.id) &&
        (job.order || hasBufferResult && job.bufferId)
      ).map((job) => job.id));
      const deleteScheduleIds = allJobs.filter((job) =>
        replaceableScheduleIds.has(job.id) &&
        itemIdOf(job) && !returnedItemIds.has(itemIdOf(job)!)
      ).map((job) => job.id);
      const replaceableSetupIds = new Set(allJobs.filter((job) =>
        replaceableScheduleIds.has(job.id) && job.setupMaintenanceId
      ).map((job) => job.setupMaintenanceId!));
      const protectedSetupIds = new Set(allJobs.filter((job) =>
        protectedScheduleIds.has(job.id) && job.setupMaintenanceId
      ).map((job) => job.setupMaintenanceId!));
      const replacedSetup = existingMaintenance.filter((row) =>
        row.type === "Setup Maintenance" &&
        Date.parse(row.startAt) > now &&
        !protectedSetupIds.has(row.id) && !protectedScheduleIds.has(row.affectedScheduleId ?? 0) &&
        (replaceableSetupIds.has(row.id) || replaceableScheduleIds.has(row.affectedScheduleId ?? 0))
      );
      const maintenance = optimized.maintenanceSchedules.flatMap<OptimizationMaintenanceBody>(({ maintenanceId, type, itemId, ...result }) => {
        const normalizedType = normalizeMaintenanceType(type);
        const itemIds = Array.isArray(itemId) ? itemId : itemId === undefined ? [] : [itemId];
        if (normalizedType === "Corrective Maintenance") {
          if (itemIds.length !== 1) throw new Error("Hubungan maintenance tidak sesuai\n\nCorrective maintenance harus terhubung ke tepat satu item order. Jalankan optimasi kembali.");
          const linkedJob = allJobs.find((job) => itemIdOf(job) === itemIds[0]);
          const previous = linkedJob ? existingMaintenance.find((row) => row.type === "Corrective Maintenance" &&
            row.affectedScheduleId === linkedJob.id && Date.parse(row.endAt) > now) : undefined;
          if (maintenanceId !== undefined && previous?.id !== maintenanceId)
            throw new Error("Hubungan maintenance sudah berubah\n\nMuat ulang dan periksa jadwal terbaru sebelum menerapkan optimasi.");
          if (previous && Date.parse(previous.startAt) <= now) {
            if (previous.machineId !== result.machineId ||
              toJakartaDateTime(previous.startAt) !== toJakartaDateTime(result.startAt) ||
              toJakartaDateTime(previous.endAt) !== toJakartaDateTime(result.endAt))
              throw new Error("Corrective maintenance sudah berjalan\n\nAI mengubah maintenance yang sudah mulai. Tidak ada jadwal yang diterapkan; jalankan optimasi ulang.");
            return [];
          }
          const orderMatch = /^O-(\d+)$/.exec(itemIds[0]);
          const bufferMatch = /^B-(\d+)-(\d+)$/.exec(itemIds[0]);
          return [{
            ...result,
            orderLineId: orderMatch ? Number(orderMatch[1]) : undefined,
            bufferId: bufferMatch ? Number(bufferMatch[1]) : undefined,
            bufferSequenceNo: bufferMatch ? Number(bufferMatch[2]) : undefined,
            replacesMaintenanceId: previous?.id,
            type: normalizedType,
            reason: result.reason || previous?.reason || "AI schedule optimization",
            scheduleType: "One Time",
          }];
        }
        const protectedJobs = itemIds.flatMap((itemId) => {
          const job = protectedJobsByItemId.get(itemId);
          return job ? [job] : [];
        });
        if (normalizedType === "Setup Maintenance" && protectedJobs.length) {
          const setupIds = new Set(protectedJobs.map((job) => job.setupMaintenanceId).filter((value): value is number => value !== undefined));
          const currentSetup = existingMaintenance.find((row) => row.type === "Setup Maintenance" &&
            (setupIds.has(row.id) || protectedJobs.some((job) => row.affectedScheduleId === job.id)));
          const entireGroupIsProtected = protectedJobs.length === itemIds.length;
          if (!currentSetup || !entireGroupIsProtected || setupIds.size > 1)
            throw new Error("Grup setup tidak dapat diganti\n\nHasil optimasi mengubah grup dengan produksi yang dilindungi. Belum ada perubahan diterapkan. Jalankan optimasi kembali menggunakan jadwal terbaru.");
          const currentItemIds = allJobs.filter((job) => job.setupMaintenanceId === currentSetup.id)
            .filter((job) => Date.parse(job.endsAt) > now)
            .map(itemIdOf).filter((id): id is string => !!id);
          if (startedSetupIds.has(currentSetup.id) &&
            (currentItemIds.length !== itemIds.length || currentItemIds.some((id) => !itemIds.includes(id))))
            throw new Error("Grup setup tidak lengkap\n\nAI mengubah daftar order dalam grup setup yang sudah mulai produksi. Tidak ada jadwal yang diterapkan. Jalankan Optimize Schedule kembali.");
          const unchanged = currentSetup.machineId === result.machineId &&
            toJakartaDateTime(currentSetup.startAt) === toJakartaDateTime(result.startAt) &&
            toJakartaDateTime(currentSetup.endAt) === toJakartaDateTime(result.endAt);
          if (!unchanged) throw new Error(`Setup tidak dapat dipindahkan\n\nSetup terhubung ke produksi yang dilindungi.\n\nOrder: ${protectedJobs[0].order?.orderNumber || "—"}\nProduk: ${protectedJobs[0].itemName}\nMesin: ${protectedJobs[0].machineLineCode}\nMulai produksi: ${formatDateTime(protectedJobs[0].startsAt)} WIB\n\nBelum ada perubahan diterapkan. Jalankan Optimize Schedule kembali menggunakan jadwal terbaru.`);
          return [];
        }
        const exists = normalizedType !== "Setup Maintenance" && existingMaintenance.some((row) =>
          row.machineId === result.machineId && row.startAt === result.startAt && row.endAt === result.endAt && row.type === normalizedType
        );
        return exists ? [] : [{
          ...result,
          itemId: itemIds.length ? itemIds : undefined,
          type: normalizedType,
          reason: result.reason || "AI schedule optimization",
          scheduleType: "One Time",
        }];
      });
      try {
        await api<object>("/schedules/bulk-optimization", {
          method: "POST",
          body: JSON.stringify({
            jobId,
            schedules,
            deleteScheduleIds,
            deleteMaintenanceIds: replacedSetup.map((row) => row.id),
            maintenanceSchedules: maintenance,
          }),
        });
      } catch (cause) {
        const detail = await api<{ job: { status: string } }>(`/schedule-optimizations/${jobId}`).catch(() => null);
        if (detail?.job.status !== "Applied") throw cause;
      }

      try {
        await Promise.all([refreshSchedules(false, true), refreshMaintenance(false, true)]);
        notify("success", `Optimization applied: ${schedules.length} items, ${deleteScheduleIds.length} schedules removed, and ${maintenance.length} maintenance windows.`);
      } catch {
        notify("warning", "Jadwal tersimpan, tampilan belum diperbarui\n\nMuat ulang halaman untuk melihat jadwal terbaru.");
      }
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
    getSetupJobs,
    getMaintenanceWindow,
    loadOptimizationContext,
    applyOptimizationResponse,
    refreshMaintenance,
  };
}
