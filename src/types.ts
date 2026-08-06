export const OrderSourceType = {
  SoPaid: "SO_Paid",
  ScUnpaid: "SC_Unpaid",
  PiUnpaid: "PI_Unpaid",
} as const;
export type OrderSourceType = (typeof OrderSourceType)[keyof typeof OrderSourceType];

export const OrderStatus = {
  Open: "Open",
  Confirmed: "Confirmed",
  Final: "Final",
  InProduction: "In Production",
  Fulfilled: "Fulfilled",
  Cancelled: "Cancelled",
} as const;
export type OrderStatus = (typeof OrderStatus)[keyof typeof OrderStatus];

export interface OrderLineItem {
  id: string;
  description: string;
  qty: number;
  fob: number;
  mp?: number;
  carton?: number;
  cbm?: number;
}

export type OrderLineItemDraft = Omit<OrderLineItem, "id">;

export interface Order {
  id: string;
  sourceType: OrderSourceType;
  scheduleId?: string;
  scheduleMachineId?: string;
  orderNo: string;

  poDate: string;
  customerName: string;
  customerPoNo: string;
  poShipStart: string;
  poShipEnd: string;
  prodScheduleStart?: string;
  prodScheduleEnd?: string;
  deliveryDate: string;
  orderDate?: string;
  status: OrderStatus;
  items: OrderLineItem[];
  createdAt: string;
  updatedAt: string;
}

export type OrderDraft = Omit<Order, "id" | "createdAt" | "updatedAt">;

export const MachineType = {
  Aoki: "AOKI",
  Asb: "ASB",
  Dexter: "Dexter",
} as const;
export type MachineType = (typeof MachineType)[keyof typeof MachineType];

export interface Machine {
  id: string;
  lineCode: string;
  name: string;
  machineType: string;
  allocatedCavity: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
}

export type MachineDraft = Omit<Machine, "id" | "createdAt" | "updatedAt">;

export const MaintenanceType = {
  Preventive: "Preventive Maintenance",
  Corrective: "Corrective Maintenance",
  Setup: "Setup Maintenance",
  Trial: "Trial Maintenance",
} as const;
export type MaintenanceType = (typeof MaintenanceType)[keyof typeof MaintenanceType];

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
  qty: number;
  startAt: string;
  endAt: string;
  setupMinutes: number;
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
