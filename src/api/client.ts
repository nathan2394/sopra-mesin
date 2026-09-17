import { queueWarning } from "../components/Notification";

const API_URL = import.meta.env.VITE_API_URL ?? "https://localhost:5081/api";
const TOKEN_KEY = "sopra-mesin-token";
const USER_KEY = "sopra-mesin-user";
const pendingGets = new Map<string, Promise<unknown>>();

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PagedResult<T, TSummary = unknown> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
  summary?: TSummary;
}

export const hasToken = () => Boolean(localStorage.getItem(TOKEN_KEY));
export const currentUsername = () => localStorage.getItem(USER_KEY) ?? "User";
export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
};

interface AuthResult {
  token: string;
  username: string;
}

const saveAuth = (auth: AuthResult) => {
  localStorage.setItem(TOKEN_KEY, auth.token);
  localStorage.setItem(USER_KEY, auth.username);
};

async function send<T>(path: string, init: RequestInit): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  }).catch(() => { throw new Error("Cannot connect to the server. Check your connection and make sure the backend is running. If you were saving changes, refresh and check the data before trying again."); });

  if (response.status === 401 && token) {
    logout();
    queueWarning("Your session has expired. Please sign in again.");
    window.location.reload();
    throw new Error("Your session has expired. Please sign in again.");
  }
  if (response.status === 204) return undefined as T;

  const text = await response.text();
  let payload: ApiResponse<T> | undefined;
  try {
    payload = text ? JSON.parse(text) as ApiResponse<T> : undefined;
  } catch {
    if (!response.ok) throw new Error(`The server could not complete the request (HTTP ${response.status}). Refresh and check the data before trying again. If this continues, contact your administrator.`);
    throw new Error("The server returned an unreadable response. Refresh and check the data before trying again.");
  }
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || (response.status === 403
      ? "You do not have permission to perform this action. Contact your administrator."
      : response.status === 400 ? "Some submitted values are invalid. Check the required fields and date range, then try again."
      : response.status === 404 ? "This record is no longer available. Refresh the page to load the latest data."
      : "The request could not be completed. Refresh and check the data before trying again."));
  }
  return payload.data;
}

export function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const method = (init.method ?? "GET").toUpperCase();
  if (method !== "GET" || init.body) return send<T>(path, init);

  const pending = pendingGets.get(path);
  if (pending) return pending as Promise<T>;

  const request = send<T>(path, init);
  pendingGets.set(path, request);
  void request.finally(() => {
    if (pendingGets.get(path) === request) pendingGets.delete(path);
  }).catch(() => undefined);
  return request;
}

export async function login(username: string, password: string) {
  const auth = await api<AuthResult>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  });
  saveAuth(auth);
}

export const googleClientId = () => api<string>("/auth/google/client-id");

export async function loginWithGoogle(credential: string) {
  const auth = await api<AuthResult>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
  saveAuth(auth);
}
