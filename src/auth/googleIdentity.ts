export interface GoogleCredentialResponse {
  credential?: string;
}

interface GoogleIdentity {
  initialize: (options: {
    client_id: string;
    callback: (response: GoogleCredentialResponse) => void;
    ux_mode?: "popup" | "redirect";
    login_hint?: string;
    use_fedcm_for_button?: boolean;
    button_auto_select?: boolean;
  }) => void;
  renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
}

declare global {
  interface Window {
    google?: { accounts: { id: GoogleIdentity } };
  }
}

const SCRIPT_URL = "https://accounts.google.com/gsi/client";
let loading: Promise<GoogleIdentity> | undefined;

export function loadGoogleIdentity(): Promise<GoogleIdentity> {
  if (window.google?.accounts.id) return Promise.resolve(window.google.accounts.id);
  if (loading) return loading;

  loading = new Promise<GoogleIdentity>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${SCRIPT_URL}"]`);
    const script = existing ?? Object.assign(document.createElement("script"), {
      src: SCRIPT_URL,
      async: true,
    });
    const cleanup = () => {
      window.clearTimeout(timeout);
      script.removeEventListener("load", onLoad);
      script.removeEventListener("error", onError);
    };
    const onError = () => {
      cleanup();
      script.remove();
      reject(new Error("Login Google belum tersedia\n\nMuat ulang halaman atau gunakan username dan password."));
    };
    const onLoad = () => {
      if (!window.google?.accounts.id) return onError();
      cleanup();
      resolve(window.google.accounts.id);
    };
    const timeout = window.setTimeout(onError, 15000);
    script.addEventListener("load", onLoad, { once: true });
    script.addEventListener("error", onError, { once: true });
    if (!existing) document.head.appendChild(script);
  }).catch((error: unknown) => {
    loading = undefined;
    throw error;
  });
  return loading;
}
