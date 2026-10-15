import { queueWarning } from "../components/Notification";

const API_URL = import.meta.env.VITE_API_URL ?? "https://localhost:5081/api";
const TOKEN_KEY = "sopra-mesin-token";
const USER_KEY = "sopra-mesin-user";
const EMAIL_KEY = "sopra-mesin-email";
const ROLE_KEY = "sopra-mesin-role";
const GOOGLE_ACCOUNT_KEY = "sopra-mesin-last-google-account";
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
export const currentEmail = () => localStorage.getItem(EMAIL_KEY) ?? "";
export const currentRole = () => localStorage.getItem(ROLE_KEY) ?? "";
export const logout = () => {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(EMAIL_KEY);
  localStorage.removeItem(ROLE_KEY);
};

interface AuthResult {
  token: string;
  username: string;
  email?: string;
  role?: string;
  googleAccount?: GoogleAccount | null;
}

export interface GoogleAccount {
  subject: string;
  email: string;
  name: string;
}

function isGoogleAccount(value: unknown): value is GoogleAccount {
  if (!value || typeof value !== "object") return false;
  const account = value as Partial<GoogleAccount>;
  return typeof account.subject === "string" && account.subject.length > 0 && account.subject.length <= 255
    && typeof account.email === "string" && account.email.length > 0 && account.email.length <= 320
    && typeof account.name === "string" && account.name.length <= 512;
}

// Compatibility with API versions that validate the credential but do not
// return googleAccount. Decoding is NOT signature verification or login.
// Call only after /auth/google has successfully authenticated this credential.
function googleAccountFromAcceptedCredential(credential: string): GoogleAccount | null {
  try {
    if (credential.length > 65536) return null;
    const parts = credential.split(".");
    if (parts.length !== 3 || !parts[1]) return null;
    const base64 = parts[1].replace(/-/g, "+").replace(/_/g, "/");
    const bytes = Uint8Array.from(atob(base64.padEnd(Math.ceil(base64.length / 4) * 4, "=")), (char) => char.charCodeAt(0));
    const payload: unknown = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes));
    if (!payload || typeof payload !== "object") return null;
    const claims = payload as Record<string, unknown>;
    const account = {
      subject: claims.sub,
      email: claims.email,
      name: typeof claims.name === "string" && claims.name ? claims.name : claims.email,
    };
    return isGoogleAccount(account) ? account : null;
  } catch {
    return null;
  }
}

export function lastGoogleAccount(): GoogleAccount | null {
  try {
    const account: unknown = JSON.parse(localStorage.getItem(GOOGLE_ACCOUNT_KEY) ?? "null");
    return isGoogleAccount(account) ? account : null;
  } catch {
    return null;
  }
}

export function forgetGoogleAccount() {
  try {
    localStorage.removeItem(GOOGLE_ACCOUNT_KEY);
  } catch {
  }
}

const saveAuth = (auth: AuthResult) => {
  localStorage.setItem(TOKEN_KEY, auth.token);
  localStorage.setItem(USER_KEY, auth.username);

  for (const [key, value] of [[EMAIL_KEY, auth.email], [ROLE_KEY, auth.role]] as const) {
    if (typeof value === "string" && value.trim()) localStorage.setItem(key, value.trim());
    else localStorage.removeItem(key);
  }
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

export async function loginWithGoogle(credential: string): Promise<{ accountRemembered: boolean }> {
  const auth = await api<AuthResult>("/auth/google", {
    method: "POST",
    body: JSON.stringify({ credential }),
  });
  saveAuth(auth);

  const account = isGoogleAccount(auth.googleAccount)
    ? auth.googleAccount
    : googleAccountFromAcceptedCredential(credential);
  if (!account) {
    forgetGoogleAccount();
    return { accountRemembered: false };
  }
  try {
    localStorage.setItem(GOOGLE_ACCOUNT_KEY, JSON.stringify({
      subject: account.subject,
      email: account.email,
      name: account.name,
    }));
    return { accountRemembered: true };
  } catch {
    return { accountRemembered: false };
  }
}
