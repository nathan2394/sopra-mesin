const API_URL = import.meta.env.VITE_API_URL ?? "https://localhost:5081/api";
const TOKEN_KEY = "sopra-mesin-token";
const USER_KEY = "sopra-mesin-user";

interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
}

export interface PagedResult<T> {
  items: T[];
  page: number;
  pageSize: number;
  totalItems: number;
  totalPages: number;
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

export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);
  const response = await fetch(`${API_URL}${path}`, {
    ...init,
    headers: {
      ...(init.body && !(init.body instanceof FormData) ? { "Content-Type": "application/json" } : {}),
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });

  if (response.status === 401 && token) {
    logout();
    window.location.reload();
  }
  if (response.status === 204) return undefined as T;

  const payload = (await response.json()) as ApiResponse<T>;
  if (!response.ok || !payload.success) {
    throw new Error(payload.message || `API error ${response.status}`);
  }
  return payload.data;
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

export async function register(username: string, email: string, password: string) {
  const auth = await api<AuthResult>("/auth/register", {
    method: "POST",
    body: JSON.stringify({ username, email, password }),
  });
  saveAuth(auth);
}
