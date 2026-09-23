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
  }).catch(() => { throw new Error("Koneksi ke server terputus\n\nPeriksa koneksi internet. Jika sedang menyimpan, muat ulang dan periksa data sebelum mencoba lagi."); });

  if (response.status === 401 && token) {
    logout();
    queueWarning("Sesi login berakhir\n\nSilakan login kembali.");
    window.location.reload();
    throw new Error("Sesi login berakhir\n\nSilakan login kembali.");
  }
  if (response.status === 204) return undefined as T;
  if (response.status === 401) throw new Error("Login diperlukan\n\nSilakan login untuk melanjutkan.");
  if (response.status === 403) throw new Error("Akses tidak diizinkan\n\nHubungi administrator untuk memeriksa hak akses akun.");
  if (response.status === 413) throw new Error("File terlalu besar\n\nKurangi ukuran file sebelum mengunggah kembali.");
  if (response.status === 429) throw new Error("Terlalu banyak permintaan\n\nTunggu sebentar sebelum mencoba lagi.");

  const text = await response.text();
  let payload: ApiResponse<T> | undefined;
  try {
    payload = text ? JSON.parse(text) as ApiResponse<T> : undefined;
  } catch {
    if (!response.ok) throw new Error("Permintaan belum dapat diproses\n\nServer tidak memberikan respons yang sesuai. Muat ulang dan periksa data sebelum mencoba lagi; hubungi administrator jika masalah berulang.");
    throw new Error("Respons server tidak dapat dibaca\n\nMuat ulang dan periksa data sebelum mencoba lagi.");
  }
  if (!response.ok || !payload?.success) {
    throw new Error(payload?.message || (response.status === 403
      ? "Akses tidak diizinkan\n\nHubungi administrator untuk memeriksa hak akses akun."
      : response.status === 400 ? "Data belum sesuai\n\nPeriksa isian wajib, angka, serta tanggal sebelum mencoba lagi."
      : response.status === 404 ? "Data tidak ditemukan\n\nMuat ulang halaman untuk melihat data terbaru."
      : "Permintaan belum dapat diproses\n\nMuat ulang dan periksa data sebelum mencoba lagi."));
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
