import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { googleClientId, login, loginWithGoogle } from "../api/client";
import { Logo } from "../components/Logo";
import { notify } from "../components/Notification";

interface GoogleCredentialResponse {
  credential?: string;
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (options: { client_id: string; callback: (response: GoogleCredentialResponse) => void }) => void;
          renderButton: (element: HTMLElement, options: Record<string, string | number>) => void;
        };
      };
    };
  }
}

const inputClass = "h-11 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15";

export function LoginPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const googleButtonRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    let active = true;
    let observer: ResizeObserver | undefined;

    const initialize = async () => {
      try {
        const clientId = await googleClientId();
        if (!active) return;

        const render = () => {
          const container = googleButtonRef.current;
          if (!container || !window.google) return;
          window.google.accounts.id.initialize({
            client_id: clientId,
            callback: async ({ credential }) => {
              if (!credential) return notify("warning", "Google credential tidak tersedia");
              setSubmitting(true);
              try {
                await loginWithGoogle(credential);
                onAuthenticated();
              } catch (cause) {
                notify("error", cause instanceof Error ? cause.message : "Google login gagal");
              } finally {
                setSubmitting(false);
              }
            },
          });
          container.replaceChildren();
          window.google.accounts.id.renderButton(container, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "signin_with",
            shape: "rectangular",
            logo_alignment: "left",
            width: Math.floor(container.clientWidth),
          });
        };

        if (window.google) render();
        else {
          const existing = document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]');
          const script = existing ?? Object.assign(document.createElement("script"), {
            src: "https://accounts.google.com/gsi/client",
            async: true,
          });
          script.addEventListener("load", render, { once: true });
          if (!existing) document.head.appendChild(script);
        }

        observer = new ResizeObserver(render);
        if (googleButtonRef.current) observer.observe(googleButtonRef.current);
      } catch (cause) {
        if (active) notify("error", cause instanceof Error ? cause.message : "Google login tidak tersedia");
      }
    };

    void initialize();
    return () => {
      active = false;
      observer?.disconnect();
    };
  }, [onAuthenticated]);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await login(username, password);
      onAuthenticated();
    } catch (cause) {
      notify("error", cause instanceof Error ? cause.message : "Authentication failed");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="grid min-h-dvh bg-white font-sans lg:grid-cols-2">
      <section aria-hidden="true" className="relative hidden bg-[url('/login-background.webp')] bg-cover bg-center lg:block">
        <div className="absolute inset-0 bg-brand-600/30" />
      </section>

      <section className="flex min-h-dvh items-center justify-center px-6 py-12 sm:px-10 lg:px-14">
        <div className="w-full max-w-[448px]">
          <header className="text-center">
            <div className="mb-1 flex justify-center"><Logo className="h-32 w-72" /></div>
            <h1 className="text-2xl leading-8 font-bold tracking-[-0.6px] text-slate-900">Welcome Back</h1>
            <p className="mt-0.5 text-base leading-6 font-semibold text-slate-500">Sign in to access your data</p>
          </header>

          <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
            <label className="flex flex-col gap-2 text-sm leading-[14px] font-medium text-slate-900">
              Username
              <input
                className={inputClass}
                required
                autoComplete="username"
                placeholder="Enter your username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
              />
            </label>

            <label className="flex flex-col gap-2 text-sm leading-[14px] font-medium text-slate-900">
              Password
              <span className="relative">
                <input
                  className={`${inputClass} pr-11`}
                  type={showPassword ? "text" : "password"}
                  minLength={6}
                  required
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                />
                <button
                  type="button"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((visible) => !visible)}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-md text-slate-500 transition hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-brand-600"
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            <button
              type="submit"
              disabled={submitting}
              className="flex h-11 items-center justify-center gap-2 rounded-md bg-brand-600 px-4 text-sm font-medium text-white transition hover:bg-brand-700 active:translate-y-px disabled:cursor-wait disabled:opacity-65 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
            >
              <LogIn size={17} />
              {submitting ? "Please wait..." : "Sign In"}
            </button>
          </form>

          <div className="my-8 flex items-center gap-4 text-sm leading-5 text-slate-500">
            <span className="h-px flex-1 bg-slate-200" />
            <span>Or continue with</span>
            <span className="h-px flex-1 bg-slate-200" />
          </div>

          <div ref={googleButtonRef} aria-label="Sign In With Google" className="flex h-11 w-full items-center justify-center overflow-hidden rounded-md" />
        </div>
      </section>
    </main>
  );
}
