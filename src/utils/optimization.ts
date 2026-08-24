export interface OptimizedSchedule {
  orderSchedules: Array<{
    itemId: number;
    machineId: number;
    startAt: string;
    endAt: string;
  }>;
  maintenanceSchedules: Array<{
    maintenanceId?: number;
    itemId?: number;
    type: string;
    machineId: number;
    startAt: string;
    endAt: string;
  }>;
}

const isDate = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const isId = (value: unknown) => Number.isInteger(value) && Number(value) > 0;

export function parseOptimizationResponse(value: unknown): OptimizedSchedule[] {
  if (!Array.isArray(value) || value.length === 0) throw new Error("AI response must contain at least one schedule candidate.");

  for (const candidate of value) {
    if (!candidate || typeof candidate !== "object") throw new Error("AI response contains an invalid candidate.");
    const { orderSchedules, maintenanceSchedules } = candidate as Partial<OptimizedSchedule>;
    if (!Array.isArray(orderSchedules) || !Array.isArray(maintenanceSchedules)) throw new Error("AI response is missing orderSchedules or maintenanceSchedules.");
    if (!orderSchedules.length && !maintenanceSchedules.length) throw new Error("AI response candidate is empty.");
    if (!orderSchedules.every((row) => isId(row?.itemId) && isId(row?.machineId) && isDate(row?.startAt) && isDate(row?.endAt) && Date.parse(row.endAt) > Date.parse(row.startAt))) {
      throw new Error("AI response contains an invalid order schedule.");
    }
    if (!maintenanceSchedules.every((row) => typeof row?.type === "string" && isId(row?.machineId) && isDate(row?.startAt) && isDate(row?.endAt) && Date.parse(row.endAt) > Date.parse(row.startAt))) {
      throw new Error("AI response contains an invalid maintenance schedule.");
    }
    if (new Set(orderSchedules.map((row) => row.itemId)).size !== orderSchedules.length) {
      throw new Error("AI response schedules the same item more than once.");
    }
  }

  return value as OptimizedSchedule[];
}
