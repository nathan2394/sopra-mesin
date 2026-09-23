export interface OptimizedSchedule {
  orderSchedules: Array<{
    itemId: number;
    machineId: number;
    preform: string;
    cavity: number;
    quantity: number;
    startAt: string;
    endAt: string;
  }>;
  maintenanceSchedules: Array<{
    maintenanceId?: number;
    itemId?: number | number[];
    setupPercentage?: string;
    reason?: string;
    type: string;
    machineId: number;
    startAt: string;
    endAt: string;
  }>;
}

const isDate = (value: unknown) => typeof value === "string" && !Number.isNaN(Date.parse(value));
const isId = (value: unknown) => Number.isInteger(value) && Number(value) > 0;

export function normalizeMaintenanceType(type: string): string {
  const name = type.trim().replace(/\s+maintenance$/i, "").toLowerCase();
  return `${name.charAt(0).toUpperCase()}${name.slice(1)} Maintenance`;
}

export function parseOptimizationResponse(value: unknown): OptimizedSchedule[] {
  const candidates = Array.isArray(value) ? value : [value];
  if (candidates.length === 0) throw new Error("The AI returned no schedule to review. Run Optimize Schedule again.");

  for (const candidate of candidates) {
    if (!candidate || typeof candidate !== "object") throw new Error("The AI returned an unreadable schedule result. Run Optimize Schedule again.");
    const { orderSchedules, maintenanceSchedules } = candidate as Partial<OptimizedSchedule>;
    if (!Array.isArray(orderSchedules) || !Array.isArray(maintenanceSchedules)) throw new Error("The AI result is missing production or maintenance data. Run Optimize Schedule again.");
    if (!orderSchedules.length && !maintenanceSchedules.length) throw new Error("The AI result contains no production or maintenance entries. Run Optimize Schedule again.");
    if (!orderSchedules.every((row) => isId(row?.itemId) && isId(row?.machineId) && typeof row?.preform === "string" && row.preform.trim() && isId(row?.cavity) && typeof row?.quantity === "number" && Number.isFinite(row.quantity) && row.quantity >= 0 && isDate(row?.startAt) && isDate(row?.endAt) && Date.parse(row.endAt) > Date.parse(row.startAt))) {
      throw new Error("The AI result contains incomplete or invalid production details. Run Optimize Schedule again.");
    }
    if (!maintenanceSchedules.every((row) => {
      if (typeof row?.type !== "string") return false;
      const type = normalizeMaintenanceType(row.type);
      const itemIds = Array.isArray(row.itemId) ? row.itemId : row.itemId === undefined ? [] : [row.itemId];
      const itemIdsAreValid = itemIds.every(isId) && new Set(itemIds).size === itemIds.length;
      const linkedItemsAreValid = type === "Setup Maintenance" ? Array.isArray(row.itemId) && itemIds.length > 0
        : type === "Corrective Maintenance" ? itemIds.length === 1 : true;
      const percentageIsValid = row.setupPercentage === undefined || typeof row.setupPercentage === "string" &&
        row.setupPercentage.length <= 30 && /^\d+(?:\.\d+)?%$/.test(row.setupPercentage);
      return ["Setup Maintenance", "Corrective Maintenance", "Preventive Maintenance", "Trial Maintenance"].includes(type) &&
        isId(row.machineId) && itemIdsAreValid && linkedItemsAreValid && percentageIsValid &&
        (row.reason === undefined || typeof row.reason === "string") &&
        isDate(row.startAt) && isDate(row.endAt) && Date.parse(row.endAt) > Date.parse(row.startAt);
    })) {
      throw new Error("The AI result contains invalid maintenance details, order links, or setup percentages. Run Optimize Schedule again.");
    }
    if (new Set(orderSchedules.map((row) => row.itemId)).size !== orderSchedules.length) {
      throw new Error("The AI result schedules an order item more than once. Run Optimize Schedule again to get a valid result.");
    }
  }

  return candidates as OptimizedSchedule[];
}
