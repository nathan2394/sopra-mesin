import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { PagedResult } from "../api/client";
import { OrderSourceType, OrderStatus } from "../types";
import type { Order, OrderDraft } from "../types";

interface ApiOrderLine {
  id: number;
  itemName: string;
  quantity: number;
  fob?: number;
  mp?: number;
  carton?: number;
  cbm?: number;
}

interface ApiOrder {
  id: number;
  source: string;
  orderNumber: string;
  purchaseOrderNumber?: string;
  customerName?: string;
  orderDate?: string;
  productionStartsAt?: string;
  productionEndsAt?: string;
  shipStartDate?: string;
  shipEndDate?: string;
  deliveryDate?: string;
  status: OrderStatus;
  lines: ApiOrderLine[];
}

interface ApiSchedule {
  id: number;
  machineId: number;
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
  status: string;
  orders: Array<{ orderLineId: number }>;
}

const sourceFromApi: Record<string, OrderSourceType> = {
  "SO Paid": OrderSourceType.SoPaid,
  "SC Unpaid": OrderSourceType.ScUnpaid,
  "PI Unpaid": OrderSourceType.PiUnpaid,
};
const sourceToApi: Record<OrderSourceType, string> = {
  [OrderSourceType.SoPaid]: "SO Paid",
  [OrderSourceType.ScUnpaid]: "SC Unpaid",
  [OrderSourceType.PiUnpaid]: "PI Unpaid",
};

const fromApi = (order: ApiOrder, schedule?: ApiSchedule): Order => {
  const timestamp = order.orderDate ?? new Date().toISOString();
  return {
    id: String(order.id),
    sourceType: sourceFromApi[order.source] ?? OrderSourceType.SoPaid,
    scheduleId: schedule ? String(schedule.id) : undefined,
    scheduleMachineId: schedule ? String(schedule.machineId) : undefined,
    orderNo: order.orderNumber,
    poDate: timestamp,
    customerName: order.customerName ?? "",
    customerPoNo: order.purchaseOrderNumber ?? "",
    poShipStart: order.shipStartDate ?? timestamp,
    poShipEnd: order.shipEndDate ?? timestamp,
    prodScheduleStart: order.productionStartsAt,
    prodScheduleEnd: order.productionEndsAt,
    deliveryDate: order.deliveryDate ?? timestamp,
    orderDate: order.orderDate,
    status: order.status,
    items: order.lines.map((line) => ({
      id: String(line.id),
      description: line.itemName,
      qty: line.quantity,
      fob: line.fob ?? 0,
      mp: line.mp,
      carton: line.carton,
      cbm: line.cbm,
    })),
    createdAt: timestamp,
    updatedAt: timestamp,
  };
};

const toApi = (order: OrderDraft) => ({
  source: sourceToApi[order.sourceType],
  orderNumber: order.orderNo || undefined,
  purchaseOrderNumber: order.customerPoNo,
  customerName: order.customerName,
  orderDate: order.poDate,
  productionStartsAt: order.prodScheduleStart,
  productionEndsAt: order.prodScheduleEnd,
  shipStartDate: order.poShipStart.slice(0, 10),
  shipEndDate: order.poShipEnd.slice(0, 10),
  deliveryDate: order.deliveryDate.slice(0, 10),
  status: order.status === OrderStatus.Fulfilled ? OrderStatus.Final : order.status,
  lines: order.items.map((line) => ({
    id: /^\d+$/.test(line.id) ? Number(line.id) : undefined,
    itemName: line.description,
    quantity: line.qty,
    fob: line.fob,
    mp: line.mp,
    carton: line.carton,
    cbm: line.cbm,
    status: order.status === OrderStatus.Fulfilled ? OrderStatus.Final : order.status,
  })),
});

const report = (cause: unknown) =>
  window.alert(cause instanceof Error ? cause.message : "API request failed");

export function useOrders(page = 1, pageSize = 100, search = "", source = "", status = "", allPages = false) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState({ page, pageSize, totalItems: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
      if (search) query.set("search", search);
      if (source) query.set("source", source);
      if (status) query.set("status", status);
      const [result, schedules] = await Promise.all([
        api<PagedResult<ApiOrder>>(`/orders?${query}`),
        api<ApiSchedule[]>("/schedules"),
      ]);
      const remaining = allPages ? await Promise.all(Array.from({ length: result.totalPages - 1 }, (_, index) => {
        const nextQuery = new URLSearchParams(query);
        nextQuery.set("page", String(index + 2));
        return api<PagedResult<ApiOrder>>(`/orders?${nextQuery}`);
      })) : [];
      setPagination({
        page: result.page,
        pageSize: result.pageSize,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      });
      setOrders([result, ...remaining].flatMap((pageResult) => pageResult.items).map((order) => {
        const lineIds = new Set(order.lines.map((line) => line.id));
        return fromApi(order, schedules.find((schedule) =>
          schedule.orders.some((line) => lineIds.has(line.orderLineId))));
      }));
    } catch (cause) { report(cause); } finally { setIsLoading(false); }
  }, [page, pageSize, search, source, status, allPages]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addOrder = useCallback(async (draft: OrderDraft) => {
    try {
      const order = await api<ApiOrder>("/orders", { method: "POST", body: JSON.stringify(toApi(draft)) });
      await syncSchedule(order, draft);
      await refresh();
    } catch (cause) { report(cause); }
  }, [refresh]);

  const updateOrder = useCallback(async (id: string, draft: OrderDraft) => {
    try {
      const order = await api<ApiOrder>(`/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify(toApi(draft)),
      });
      await syncSchedule(order, draft);
      await refresh();
    } catch (cause) { report(cause); }
  }, [refresh]);

  const removeOrder = useCallback(async (id: string) => {
    try {
      await api<void>(`/orders/${id}`, { method: "DELETE" });
      await refresh();
    } catch (cause) { report(cause); }
  }, [refresh]);

  return { orders, pagination, isLoading, addOrder, updateOrder, removeOrder, resetSampleData: refresh };
}

async function syncSchedule(order: ApiOrder, draft: OrderDraft) {
  if (!draft.scheduleMachineId || !draft.prodScheduleStart || !draft.prodScheduleEnd) {
    if (draft.scheduleId) await api<void>(`/schedules/${draft.scheduleId}`, { method: "DELETE" });
    return;
  }

  const current = draft.scheduleId
    ? await api<ApiSchedule>(`/schedules/${draft.scheduleId}`)
    : undefined;
  await api(draft.scheduleId ? `/schedules/${draft.scheduleId}` : "/schedules", {
    method: draft.scheduleId ? "PUT" : "POST",
    body: JSON.stringify({
      machineId: Number(draft.scheduleMachineId),
      itemName: order.lines.length === 1
        ? order.lines[0].itemName
        : `${order.orderNumber} (${order.lines.length} items)`,
      quantity: order.lines.reduce((total, line) => total + line.quantity, 0),
      preformName: current?.preformName,
      cavity: current?.cavity,
      setupPercent: current?.setupPercent ?? 0,
      progressPercent: current?.progressPercent ?? 0,
      setupMinutes: current?.setupMinutes ?? 0,
      startsAt: draft.prodScheduleStart,
      endsAt: draft.prodScheduleEnd,
      deliveryDate: draft.deliveryDate.slice(0, 10),
      reason: current?.reason,
      status: current?.status ?? "Open",
      orderLineIds: order.lines.map((line) => line.id),
    }),
  });
}
