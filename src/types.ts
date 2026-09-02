export const OrderSourceType = {
  SoPaid: "SO_Paid",
  ScUnpaid: "SC_Unpaid",
  PiUnpaid: "PI_Unpaid",
  ManualRequest: "MR_Unpaid",
  ManualForecast: "MF_Unpaid",
} as const;
export type OrderSourceType = (typeof OrderSourceType)[keyof typeof OrderSourceType];

export interface OrderLineItem {
  id: string;
  itemCode?: string;
  description: string;
  qty: number;
}

export interface Order {
  id: string;
  sourceType: OrderSourceType;
  orderNo: string;

  poDate: string;
  customerName: string;
  customerPoNo: string;
  poShipStart: string;
  poShipEnd: string;
  deliveryDate: string;
  orderDate?: string;
  items: OrderLineItem[];
  createdAt: string;
  updatedAt: string;
}

export type OrderDraft = Omit<Order, "id" | "createdAt" | "updatedAt">;

export interface Machine {
  id: string;
  lineCode: string;
  name: string;
  machineType: string;
  cavity?: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MachineDraft = Omit<Machine, "id" | "cavity" | "createdAt" | "updatedAt">;

export const MaintenanceType = {
  Preventive: "Preventive Maintenance",
  Corrective: "Corrective Maintenance",
  Setup: "Setup Maintenance",
  Trial: "Trial Maintenance",
} as const;
export type MaintenanceType = (typeof MaintenanceType)[keyof typeof MaintenanceType];
export const maintenanceTypeLabel = (type: MaintenanceType) =>
  type === MaintenanceType.Setup ? "Setup" : type === MaintenanceType.Trial ? "Trial" : type;

export interface MaintenanceWindow {
  id: string;
  machineId: string;
  affectedScheduleId?: string;
  startAt: string;
  endAt: string;
  type: MaintenanceType;
  reason?: string;
  scheduleType: "One Time" | "Recurring";
  repeatType?: "Weekly" | "Monthly";
  repeatValue?: string;
}

export type MaintenanceWindowDraft = Omit<MaintenanceWindow, "id">;

export const JobStatus = {
  Open: "Open",
  ProductionProgress: "Production Progress",
  ProductionComplete: "Production Complete",
  ProductionPending: "Production Pending",
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export interface ScheduleJob {
  id: string;
  machineId: string;
  isLocked: boolean;
  productName: string;
  preform?: string;
  cavity?: number;
  qty: number;
  startAt: string;
  endAt: string;
  deliveryDate: string;
  sourceOrderRefs?: string;
  status: JobStatus;
  blockingMaintenanceId?: string;
  blockingMaintenanceReason?: string;
  customerName?: string;
  profile?: string;
  itemCode?: string;
  shift?: string;
  internalDate?: string;
  externalDate?: string;
  ship1Date?: string;
  ship2Date?: string;
  finalDeliveryDate?: string;
}

export type ScheduleJobDraft = Omit<ScheduleJob, "id">;
