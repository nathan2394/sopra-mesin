import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";
import type { PagedResult } from "../api/client";
import { notify } from "../components/Notification";
import { OrderSourceType } from "../types";
import type { Order, OrderDraft } from "../types";

interface ApiOrderLine {
  id: number;
  itemCode?: string;
  itemName: string;
  quantity: number;
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
  shipStartDate?: string;
  shipEndDate?: string;
  deliveryDate?: string;
  lines: ApiOrderLine[];
}

const sourceFromApi: Record<string, OrderSourceType> = {
  "SO:Paid": OrderSourceType.SoPaid,
  "SC:Unpaid": OrderSourceType.ScUnpaid,
  "PI:Unpaid": OrderSourceType.PiUnpaid,
  "MR:Unpaid": OrderSourceType.ManualRequest,
  "MF:Unpaid": OrderSourceType.ManualForecast,
};
const sourceToApi: Record<OrderSourceType, { source: string; paymentStatus: "Paid" | "Unpaid" }> = {
  [OrderSourceType.SoPaid]: { source: "SO", paymentStatus: "Paid" },
  [OrderSourceType.ScUnpaid]: { source: "SC", paymentStatus: "Unpaid" },
  [OrderSourceType.PiUnpaid]: { source: "PI", paymentStatus: "Unpaid" },
  [OrderSourceType.ManualRequest]: { source: "MR", paymentStatus: "Unpaid" },
  [OrderSourceType.ManualForecast]: { source: "MF", paymentStatus: "Unpaid" },
};

const fromApi = (order: ApiOrder): Order => {
  const timestamp = order.orderDate ?? new Date().toISOString();
  return {
    id: String(order.id),
    sourceType: sourceFromApi[`${order.source}:${order.paymentStatus ?? ""}`] ?? OrderSourceType.SoPaid,
    orderNo: order.orderNumber,
    poDate: order.orderDate ?? "",
    customerName: order.customerName ?? "",
    customerPoNo: order.purchaseOrderNumber ?? "",
    poShipStart: order.shipStartDate ?? "",
    poShipEnd: order.shipEndDate ?? "",
    deliveryDate: order.deliveryDate ?? "",
    orderDate: order.orderDate,
    items: order.lines.map((line) => ({
      id: String(line.id),
      itemCode: line.itemCode,
      description: line.itemName,
      qty: line.quantity,
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
  orderDate: order.poDate || null,
  shipStartDate: order.poShipStart ? order.poShipStart.slice(0, 10) : null,
  shipEndDate: order.poShipEnd ? order.poShipEnd.slice(0, 10) : null,
  deliveryDate: order.deliveryDate ? order.deliveryDate.slice(0, 10) : null,
  lines: order.items.map((line) => ({
    id: /^\d+$/.test(line.id) ? Number(line.id) : undefined,
    itemCode: line.itemCode,
    itemName: line.description,
    quantity: line.qty,
  })),
});

const report = (cause: unknown) =>
  notify("error", cause instanceof Error ? cause.message : "API request failed");

interface OrderQuery {
  page?: number;
  pageSize?: number;
  search?: string;
  source?: OrderSourceType | "";
  sortBy?: string;
  sortDir?: "asc" | "desc";
}

export interface OrderSummary {
  totalOrders: number;
  soPaid: number;
  scUnpaid: number;
  piUnpaid: number;
  manualRequest: number;
  manualForecast: number;
  totalQuantity: number;
}

export async function getOrderPage({
  page = 1,
  pageSize = 100,
  search = "",
  source = "",
  sortBy = "",
  sortDir = "asc",
}: OrderQuery = {}): Promise<PagedResult<Order, OrderSummary>> {
  const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) });
  if (search) query.set("search", search);
  if (source) {
    query.set("source", sourceToApi[source].source);
    query.set("paymentStatus", sourceToApi[source].paymentStatus);
  }
  if (sortBy) {
    query.set("sortBy", sortBy);
    query.set("sortDir", sortDir);
  }

  const result = await api<PagedResult<ApiOrder, OrderSummary>>(`/orders?${query}`);
  return { ...result, items: result.items.map(fromApi) };
}

export function useOrders(
  page = 1,
  pageSize = 100,
  search = "",
  source: OrderSourceType | "" = "",
  sortBy = "",
  sortDir: "asc" | "desc" = "asc",
) {
  const [orders, setOrders] = useState<Order[]>([]);
  const [pagination, setPagination] = useState({ page, pageSize, totalItems: 0, totalPages: 0 });
  const [summary, setSummary] = useState<OrderSummary>({ totalOrders: 0, soPaid: 0, scUnpaid: 0, piUnpaid: 0, manualRequest: 0, manualForecast: 0, totalQuantity: 0 });
  const [isLoading, setIsLoading] = useState(true);

  const refresh = useCallback(async () => {
    setIsLoading(true);
    try {
      const result = await getOrderPage({ page, pageSize, search, source, sortBy, sortDir });
      setPagination({
        page: result.page,
        pageSize: result.pageSize,
        totalItems: result.totalItems,
        totalPages: result.totalPages,
      });
      setOrders(result.items);
      if (result.summary) setSummary(result.summary);
    } catch (cause) {
      report(cause);
    } finally {
      setIsLoading(false);
    }
  }, [page, pageSize, search, source, sortBy, sortDir]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const addOrder = useCallback(async (draft: OrderDraft) => {
    try {
      await api<ApiOrder>("/orders", { method: "POST", body: JSON.stringify(toApi(draft)) });
      await refresh();
      notify("success", "Order created successfully.");
      return true;
    } catch (cause) { report(cause); return false; }
  }, [refresh]);

  const updateOrder = useCallback(async (id: string, draft: OrderDraft) => {
    try {
      await api<ApiOrder>(`/orders/${id}`, {
        method: "PUT",
        body: JSON.stringify(toApi(draft)),
      });
      await refresh();
      notify("success", "Order updated successfully.");
      return true;
    } catch (cause) { report(cause); return false; }
  }, [refresh]);

  const removeOrder = useCallback(async (id: string) => {
    try {
      await api<void>(`/orders/${id}`, { method: "DELETE" });
      await refresh();
      notify("success", "Order deleted successfully.");
      return true;
    } catch (cause) { report(cause); return false; }
  }, [refresh]);

  return { orders, pagination, summary, isLoading, addOrder, updateOrder, removeOrder, refresh };
}
