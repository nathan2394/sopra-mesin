import {
  OrderSourceType,
  OrderStatus,
  JobStatus,
  MaintenanceType,
  type Order,
  type OrderLineItem,
  type Machine,
  type MaintenanceWindow,
  type ScheduleJob,
} from "./types";

/** Days offset from "now" → ISO date string, so sample data always looks current
 * (some overdue, some due soon, some further out) regardless of when this runs. */
function daysFromNow(offset: number): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + offset);
  return d.toISOString();
}

function now(): string {
  return new Date().toISOString();
}

/** Hours offset from "now" (rounded to the top of the hour), for schedule job timing. */
function hoursFromNow(offset: number): Date {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + offset);
  return d;
}

/** Offsets an existing ISO date string by `n` days, for milestones derived from an order's
 * own dates (e.g. a job's internal/external QC dates relative to its order's delivery date). */
function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString();
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

// Product names follow the pattern of Sopra's actual Product/Item Master (bottle & jar
// packaging SKUs) without reproducing any real customer/order data.
const PRODUCTS = [
  "Kale 250 ml",
  "Jar 2000 ml + Cap D88, Dark Blue",
  "SKLB 1000 ml",
  "Boston Round (BR) 100 ml",
  "Kick Square 500 ml Eco",
  "Syrup 750 ml",
  "Prima 250 ml Eco + Cap 38 ND, Black",
  "RE.JUVE 435 ML",
  "Tubular 150 ml",
  "MKP 30 ML NEW DESIGN",
  "Jar Cylinder 750 ml",
  "Acaii 490 ml",
];

const CUSTOMERS = [
  "Sinar Abadi Beverage",
  "Tirta Makmur Industri",
  "Kencana Pack Solutions",
  "Nusantara Bottling Co",
  "Graha Kemasan Jaya",
  "Mitra Sejahtera Foods",
  "Cahaya Prima Distribusi",
  "Anugerah Tirta Sentosa",
];

const SO_DELIVERY_OFFSETS = [-3, -1, 2, 4, 5, 7, 10, 14, 18, 25];

function pick<T>(arr: T[], i: number): T {
  return arr[i % arr.length];
}

// PROFILES is also used by the Schedule job generator further below.
const PROFILES = ["151504", "153502", "174601", "183702", "183833", "151901", "201805", "202318"];

/** One item line for a Customer Order (Description, Qty, FOB, MP, Carton, CBM). */
function makeLineItem(i: number): OrderLineItem {
  const qty = 400 + ((i * 733) % 8000);
  const fob = Number((0.6 + ((i * 37) % 140) / 100).toFixed(2));
  const mp = 3 + (i % 5);
  const carton = Math.max(1, Math.round(qty / (150 + (i % 4) * 40)));
  const cbm = Number((carton * (0.006 + (i % 5) * 0.001)).toFixed(3));
  return {
    id: uid(),
    description: pick(PRODUCTS, i).toUpperCase(),
    qty,
    fob,
    mp,
    carton,
    cbm,
  };
}

function makeOrderItems(seed: number, count: number): OrderLineItem[] {
  return Array.from({ length: count }, (_, k) => makeLineItem(seed * 4 + k));
}

export function createSampleOrders(): Order[] {
  const orders: Order[] = [];

  // Local (not module-level) so this function's order numbering is self-contained and
  // reproducible regardless of whether createSampleScheduleJobs has run in this session.
  let seq = 1;
  function nextOrderNo(prefix: string): string {
    return `${prefix}-${String(seq++).padStart(5, "0")}`;
  }

  function buildOrder(
    i: number,
    sourceType: OrderSourceType,
    prefix: string,
    deliveryOffset: number,
    status: OrderStatus,
    itemCount: number
  ): Order {
    const customer = pick(CUSTOMERS, i);
    const poDateOffset = -(10 + i * 2);
    const shipStartOffset = deliveryOffset - 5;
    const shipEndOffset = deliveryOffset;
    const items = makeOrderItems(i, itemCount);
    return {
      id: uid(),
      sourceType,
      orderNo: nextOrderNo(prefix),
      poDate: daysFromNow(poDateOffset),
      customerName: customer,
      customerPoNo: `DS.${33000 + i * 17}`,
      poShipStart: daysFromNow(shipStartOffset),
      poShipEnd: daysFromNow(shipEndOffset),
      prodScheduleStart: daysFromNow(shipStartOffset - 12),
      prodScheduleEnd: daysFromNow(shipStartOffset - 2),
      deliveryDate: daysFromNow(deliveryOffset),
      orderDate: sourceType === OrderSourceType.SoPaid ? undefined : daysFromNow(-(7 + i)),
      status,
      items,
      createdAt: now(),
      updatedAt: now(),
    };
  }

  // SO — paid, already-open sales orders.
  SO_DELIVERY_OFFSETS.forEach((offset, i) => {
    const status = offset < 0 ? OrderStatus.InProduction : i % 4 === 0 ? OrderStatus.Confirmed : i % 5 === 0 ? OrderStatus.Final : OrderStatus.Open;
    orders.push(buildOrder(i, OrderSourceType.SoPaid, "SO", offset, status, 1 + (i % 3)));
  });

  // SC Unpaid — committed, not yet paid.
  const scDeliveryOffsets = [1, 3, 6, 8, 12, 15, 20, 30];
  scDeliveryOffsets.forEach((offset, i) => {
    orders.push(buildOrder(i + 10, OrderSourceType.ScUnpaid, "SC", offset, OrderStatus.Open, 1 + (i % 4)));
  });

  // PI Unpaid — proforma invoice, earliest-stage commitment.
  const piDeliveryOffsets = [5, 9, 13, 17, 22, 28, 35];
  piDeliveryOffsets.forEach((offset, i) => {
    const status = i % 5 === 0 ? OrderStatus.Cancelled : OrderStatus.Open;
    orders.push(buildOrder(i + 18, OrderSourceType.PiUnpaid, "PI", offset, status, 1 + (i % 3)));
  });

  return orders;
}

// ---------------------------------------------------------------------------------------
// Machines, maintenance windows & schedule jobs — line codes follow the real machine
// naming from Sopra's Machine Master ("P1-AK-1", "P1-AS-5", ...): P1/P2 = production line,
// AK = AOKI blow-mold, AS = ASB stretch-blow.

const MACHINE_DEFS: Array<{ lineCode: string; name: string; type: string; cavity: number; active: boolean }> = [
  { lineCode: "P1-AK-1", name: "AOKI 250-1", type: "AOKI", cavity: 8, active: true },
  { lineCode: "P1-AK-2", name: "AOKI 250-2", type: "AOKI", cavity: 6, active: true },
  { lineCode: "P1-AK-3", name: "AOKI 250-3", type: "AOKI", cavity: 4, active: true },
  { lineCode: "P1-AK-4", name: "AOKI 250-4", type: "AOKI", cavity: 6, active: false },
  { lineCode: "P1-AS-5", name: "ASB 250-5", type: "ASB", cavity: 8, active: true },
  { lineCode: "P1-AK-6", name: "AOKI 250-6", type: "AOKI", cavity: 6, active: true },
  { lineCode: "P2-AK-1", name: "AOKI 500-1", type: "AOKI", cavity: 10, active: true },
  { lineCode: "P2-AK-2", name: "AOKI 500-2", type: "AOKI", cavity: 8, active: true },
  { lineCode: "P2-AS-4", name: "ASB 500-4", type: "ASB", cavity: 3, active: true },
  { lineCode: "P2-AK-5", name: "AOKI 500-5", type: "AOKI", cavity: 8, active: true },
];

export function createSampleMachines(): Machine[] {
  return MACHINE_DEFS.map((m) => ({
    id: uid(),
    lineCode: m.lineCode,
    name: m.name,
    machineType: m.type,
    allocatedCavity: m.cavity,
    isActive: m.active,
    createdAt: now(),
    updatedAt: now(),
  }));
}

export function createSampleMaintenanceWindows(machines: Machine[]): MaintenanceWindow[] {
  const windows: MaintenanceWindow[] = [];
  // A couple of realistic downtime blocks on different machines.
  const plans: Array<{ machineIndex: number; startHour: number; durationHours: number; type: MaintenanceType; reason: string }> = [
    { machineIndex: 1, startHour: 30, durationHours: 8, type: MaintenanceType.Planned, reason: "Scheduled mold cleaning" },
    { machineIndex: 4, startHour: 60, durationHours: 12, type: MaintenanceType.Planned, reason: "Preventive maintenance" },
    { machineIndex: 6, startHour: 6, durationHours: 4, type: MaintenanceType.Unplanned, reason: "Hydraulic leak repair" },
  ];

  plans.forEach(({ machineIndex, startHour, durationHours, type, reason }) => {
    const machine = machines[machineIndex];
    if (!machine) return;
    const start = hoursFromNow(startHour);
    const end = hoursFromNow(startHour + durationHours);
    windows.push({
      id: uid(),
      machineId: machine.id,
      startAt: start.toISOString(),
      endAt: end.toISOString(),
      type,
      reason,
    });
  });

  return windows;
}

export function createSampleScheduleJobs(machines: Machine[]): ScheduleJob[] {
  const jobs: ScheduleJob[] = [];
  const activeMachines = machines.filter((m) => m.isActive);

  // Schedule jobs are production instances of paid SO orders — the Orders page is the
  // source of truth, so a job's customer/product/qty/dates are drawn from a real SO order's
  // own line item rather than invented separately. One order line may back several jobs
  // (split across machines/cavities), same as one PO line can run on more than one machine.
  const soOrders = createSampleOrders().filter((o) => o.sourceType === OrderSourceType.SoPaid);
  const orderLines = soOrders.flatMap((order) => order.items.map((item) => ({ order, item })));

  activeMachines.forEach((machine, mi) => {
    let cursor = 0;
    const jobCount = 2 + (mi % 3); // 2-4 jobs per machine
    for (let j = 0; j < jobCount; j++) {
      // Changeover: 0 if this job happens to reuse the same tooling as the last one on
      // this machine (every 3rd job, for variety), otherwise a realistic 30-90 min swap.
      const setupMinutes = j > 0 && j % 3 === 0 ? 0 : 30 + ((mi + j) % 4) * 20;
      const runHours = 10 + ((mi + j) % 4) * 6; // 10-28h runs
      const blockHours = runHours + setupMinutes / 60;

      const start = hoursFromNow(cursor);
      const end = hoursFromNow(cursor + blockHours);
      const idx = mi * 3 + j;
      const { order, item } = orderLines[idx % orderLines.length];

      jobs.push({
        id: uid(),
        machineId: machine.id,
        productName: item.description,
        qty: item.qty,
        startAt: start.toISOString(),
        endAt: end.toISOString(),
        setupMinutes,
        deliveryDate: order.deliveryDate,
        sourceOrderRefs: order.orderNo,
        status: cursor === 0 ? JobStatus.InProgress : JobStatus.Planned,
        customerName: order.customerName,
        profile: pick(PROFILES, idx),
        itemCode: `4${String(50100000 + idx).padStart(8, "0")}`,
        shift: idx % 5 === 0 ? "S2" : "S1",
        internalDate: addDays(order.deliveryDate, -5),
        externalDate: addDays(order.deliveryDate, -3),
        ship1Date: order.poShipStart,
        ship2Date: idx % 3 === 0 ? order.poShipEnd : undefined,
        finalDeliveryDate: addDays(order.deliveryDate, idx % 3 === 0 ? 4 : 2),
      });

      cursor += blockHours;
    }
  });

  return jobs;
}
