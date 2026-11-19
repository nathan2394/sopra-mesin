import { useMemo, useSyncExternalStore } from "react";

export type PermissionAction = "view" | "create" | "update" | "delete";
export type PermissionSet = Record<PermissionAction, boolean>;
export type PermissionMap = Record<string, PermissionSet>;

export type ModuleKey = "dashboard" | "orders" | "machines" | "schedule" | "maintenance" | "setup" | "hot-runner";

export const MODULE_ROUTES: ReadonlyArray<{ module: ModuleKey; path: string }> = [
  { module: "dashboard", path: "/" },
  { module: "orders", path: "/orders" },
  { module: "schedule", path: "/schedule" },
  { module: "machines", path: "/machines" },
  { module: "maintenance", path: "/maintenance" },
  { module: "setup", path: "/setup" },
  { module: "hot-runner", path: "/hot-runner" },
];

export interface PermissionModuleInfo {
  key: string;
  label: string;
  actions: PermissionAction[];
}

export interface AdminRole {
  id: number;
  name: string;
  description: string | null;
  isSystem: boolean;
  isEditable: boolean;
  userCount: number;
  permissions: PermissionMap;
}

export interface AdminUser {
  id: number;
  username: string;
  email: string;
  role: string;
  isActive: boolean;
  hasGoogle: boolean;
  isEditable: boolean;
  createdAt: string;
}

export const EMPTY_SET: PermissionSet = { view: false, create: false, update: false, delete: false };

const STORAGE_KEY = "sopra-mesin-permissions";
const NONE: PermissionMap = {};
const listeners = new Set<() => void>();
let cache: PermissionMap | null = null;

function sanitize(value: unknown): PermissionMap {
  if (!value || typeof value !== "object" || Array.isArray(value)) return NONE;
  const map: PermissionMap = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>)) {
    if (!raw || typeof raw !== "object") continue;
    const set = raw as Partial<PermissionSet>;
    map[key] = { view: set.view === true, create: set.create === true, update: set.update === true, delete: set.delete === true };
  }
  return map;
}

function readStored(): PermissionMap {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? sanitize(JSON.parse(raw)) : NONE;
  } catch {
    return NONE;
  }
}

const notifyListeners = () => listeners.forEach((listener) => listener());

export const getPermissions = (): PermissionMap => (cache ??= readStored());

export function setPermissions(value: unknown) {
  const next = sanitize(value);
  cache = next;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
  }
  notifyListeners();
}

export function clearPermissions() {
  cache = NONE;
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {
  }
  notifyListeners();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
};

export const can = (map: PermissionMap, module: string, action: PermissionAction) => map[module]?.[action] === true;

export function firstAllowedPath(map: PermissionMap): string | null {
  return MODULE_ROUTES.find((route) => can(map, route.module, "view"))?.path ?? null;
}

export function usePermissions() {
  const map = useSyncExternalStore(subscribe, getPermissions);
  return useMemo(() => ({
    map,
    can: (module: ModuleKey, action: PermissionAction) => can(map, module, action),
    canViewPath: (path: string) => {
      const route = MODULE_ROUTES.find((item) => item.path === path);
      return route ? can(map, route.module, "view") : false;
    },
  }), [map]);
}

export function useModulePermissions(module: ModuleKey): PermissionSet {
  const map = useSyncExternalStore(subscribe, getPermissions);
  return useMemo(() => map[module] ?? EMPTY_SET, [map, module]);
}
