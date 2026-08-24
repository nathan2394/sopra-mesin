import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { PagedResult } from "../api/client";
import { notify } from "../components/Notification";
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
  paymentStatus?: "Paid" | "Unpaid";
  externalId?: number;
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
  "SO:Paid": OrderSourceType.SoPaid,
  "SC:Unpaid": OrderSourceType.ScUnpaid,
  "PI:Unpaid": OrderSourceType.PiUnpaid,
};
const sourceToApi: Record<OrderSourceType, { source: string; paymentStatus: "Paid" | "Unpaid" }> = {
  [OrderSourceType.SoPaid]: { source: "SO", paymentStatus: "Paid" },
  [OrderSourceType.ScUnpaid]: { source: "SC", paymentStatus: "Unpaid" },
  [OrderSourceType.PiUnpaid]: { source: "PI", paymentStatus: "Unpaid" },
};

const fromApi = (order: ApiOrder): Order => {
  const timestamp = order.orderDate ?? new Date().toISOString();
  return {
    id: String(order.id),
    sourceType: sourceFromApi[`${order.source}:${order.paymentStatus ?? ""}`] ?? OrderSourceType.SoPaid,
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
  source: sourceToApi[order.sourceType].source,
  paymentStatus: sourceToApi[order.sourceType].paymentStatus,
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
  notify("error", cause instanceof Error ? cause.message : "API request failed");

interface OrderQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  source?: OrderSourceType | "";
  status?: string;
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export async function getOrderPage({
  page = 1,
  pageSize = 100,
  search = "",
  source = "",
  status = "",
  sortBy = "",
  sortDir = "asc",
}: OrderQuery = {}): Promise<PagedResult<Order>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) query.set("search", search);
  if (source) {
    query.set("source", sourceToApi[source].source);
    query.set("paymentStatus", sourceToApi[source].paymentStatus);
  }
  if (status) query.set("status", status);
  if (sortBy) {
    query.set("sortBy", sortBy);
    query.set("sortDir", sortDir);
  }

  const result = await api<PagedResult<ApiOrder>>(`/orders?${query}`);
  return { ...result, items: result.items.map(fromApi) };
}

export function useOrders(
  page = 1,
  pageSize = 100,
  search = "",
  source: OrderSourceType | "" = "",
  status = "",
  sortBy = "",
  sortDir: "asc" | "desc" = "asc",
) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState({ page, pageSize, totalItems: 0, totalPages: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getOrderPage({ page, pageSize, search, source, status, sortBy, sortDir });
      setPagination({
        page: result.page,
        pageSize: result.pageSize,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      });
      setOrders(result.items);
    } catch (cause) {
      report(cause);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, source, status, sortBy, sortDir]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const updateOrder = useCallback(async (id: string, draft: OrderDraft) => {
    try {
      const order = await api<ApiOrder>(`/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify(toApi(draft)),
      });
      await syncSchedule(order, draft);
      await refresh();
      notify("success", "Order updated successfully.");
    } catch (cause) { report(cause); }
  }, [refresh]);

  return { orders, pagination, isLoading, updateOrder, refresh };
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
