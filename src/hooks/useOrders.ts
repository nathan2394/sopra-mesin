import { useCallback, useEffect, useState } from "react";
import { createSampleOrders } from "../mockData";
import type { Order, OrderDraft } from "../types";

const STORAGE_KEY = "sopra-pps-orders-mvp";

function load(): Order[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return createSampleOrders();
    const parsed = JSON.parse(raw) as Order[];
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : createSampleOrders();
  } catch {
    return createSampleOrders();
  }
}

function save(orders: Order[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(orders));
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

/**
 * All-in-the-browser CRUD store for the Orders MVP: no backend, data lives in
 * localStorage so it survives refreshes. "Reset sample data" wipes back to the
 * generated mock set. This is deliberately swappable later for real API calls
 * (see backend/src/SopraPPS.Api's OrdersController from the earlier full-stack build)
 * without the UI layer needing to change shape.
 */
export function useOrders() {
  const [orders, setOrders] = useState<Order[]>(() => load());

  useEffect(() => {
    save(orders);
  }, [orders]);

  const addOrder = useCallback((draft: OrderDraft) => {
    const timestamp = new Date().toISOString();
    setOrders((prev) => [
      { ...draft, id: uid(), createdAt: timestamp, updatedAt: timestamp },
      ...prev,
    ]);
  }, []);

  const updateOrder = useCallback((id: string, draft: OrderDraft) => {
    setOrders((prev) =>
      prev.map((o) => (o.id === id ? { ...o, ...draft, updatedAt: new Date().toISOString() } : o))
    );
  }, []);

  const removeOrder = useCallback((id: string) => {
    setOrders((prev) => prev.filter((o) => o.id !== id));
  }, []);

  const resetSampleData = useCallback(() => {
    setOrders(createSampleOrders());
  }, []);

  return { orders, addOrder, updateOrder, removeOrder, resetSampleData };
}
