// Order CRUD MVP — mock-data-only, no backend. Field shape follows the three source sheets
// from Sopra's ERP extract ("MESIN PPS Database"): SO (paid), SC Unpaid, PI Unpaid.
//
// Plain "const object + typeof" unions instead of TS `enum` so this file stays compatible
// with `erasableSyntaxOnly` (no non-erasable runtime constructs).

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

/** One item line on a customer order — mirrors the "Customer Order" screen's item grid,
 * trimmed to the fields actually used (Description, Qty, FOB, MP, Carton, CBM). */
export interface OrderLineItem {
  id: string;
  description: string;
  qty: number;
  /** Freight-on-board unit price. */
  fob: number;
  /** Master pack qty. */
  mp?: number;
  /** Carton count for this line. */
  carton?: number;
  /** Cubic meters for this line. */
  cbm?: number;
}

export type OrderLineItemDraft = Omit<OrderLineItem, "id">;

export interface Order {
  id: string;
  sourceType: OrderSourceType;

  /** SONumber/PONumber for SO rows, OrderNo for SC/PI rows. */
  orderNo: string;

  poDate: string;
  customerName: string;
  /** The customer's own PO number (distinct from our internal orderNo). */
  customerPoNo: string;

  /** PO ship window. */
  poShipStart: string;
  poShipEnd: string;

  /** Production schedule window — set once jobs are planned onto the Schedule board. */
  prodScheduleStart?: string;
  prodScheduleEnd?: string;

  /** "SLADate" in the source sheets — overall delivery commitment, drives the "Due" milestone. */
  deliveryDate: string;

  /** SC/PI sheets only. */
  orderDate?: string;

  status: OrderStatus;

  items: OrderLineItem[];

  createdAt: string;
  updatedAt: string;
}

export type OrderDraft = Omit<Order, "id" | "createdAt" | "updatedAt">;

// ---------------------------------------------------------------------------------------
// Machines & Schedule — also mock-data-only. The full rule-based scheduling engine (setup
// time, MOQ grouping, phase gating, machine eligibility scoring) that was designed for the
// .NET backend is NOT reimplemented here; this is a UI/UX pass. Dragging a job on the Gantt
// does a simple local reflow (move it, push whatever it now overlaps), not a real re-optimize.

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
  Planned: "Planned",
  Unplanned: "Unplanned",
} as const;
export type MaintenanceType = (typeof MaintenanceType)[keyof typeof MaintenanceType];

export interface MaintenanceWindow {
  id: string;
  machineId: string;
  startAt: string;
  endAt: string;
  type: MaintenanceType;
  reason?: string;
}

export type MaintenanceWindowDraft = Omit<MaintenanceWindow, "id">;

export const JobStatus = {
  Planned: "Planned",
  InProgress: "In Progress",
  Done: "Done",
} as const;
export type JobStatus = (typeof JobStatus)[keyof typeof JobStatus];

export interface ScheduleJob {
  id: string;
  machineId: string;
  productName: string;
  qty: number;

  /** Start of the occupied block, i.e. changeover begins here (not production). */
  startAt: string;
  /** End of production. */
  endAt: string;

  /** Minutes of changeover/setup at the front of the block, before production starts.
   * Rendered as its own hatched segment on the Gantt so it reads distinctly from a
   * running job. 0 = no changeover needed (already tooled). */
  setupMinutes: number;

  /** "Due" milestone — overall delivery commitment. */
  deliveryDate: string;
  sourceOrderRefs?: string;
  status: JobStatus;

  // ---- Display columns + extra milestones for the spreadsheet-style Schedule grid ----
  customerName?: string;
  profile?: string;
  itemCode?: string;
  /** e.g. "S1" / "S2". */
  shift?: string;
  /** Internal QC/handover milestone, ahead of the external one. */
  internalDate?: string;
  /** External customer-facing milestone (e.g. inspection release). */
  externalDate?: string;
  /** First shipment split. */
  ship1Date?: string;
  /** Second shipment split, when the order ships in two batches. */
  ship2Date?: string;
  /** Final delivery-to-customer milestone, distinct from the production "Due" date. */
  finalDeliveryDate?: string;
}

export type ScheduleJobDraft = Omit<ScheduleJob, "id">;
