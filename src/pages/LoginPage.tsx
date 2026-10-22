import { useEffect, useRef, useState } from "react";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { forgetGoogleAccount, googleClientId, lastGoogleAccount, login, loginWithGoogle } from "../api/client";
import { loadGoogleIdentity } from "../auth/googleIdentity";
import { Logo } from "../components/Logo";
import { notify } from "../components/Notification";

const inputClass = "h-11 w-full rounded-md border border-slate-300 bg-slate-50 px-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-500 focus:border-brand-600 focus:ring-2 focus:ring-brand-600/15";

export function LoginPage({ onAuthenticated }: { onAuthenticated: () => void }) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [rememberedAccount, setRememberedAccount] = useState(lastGoogleAccount);
  const [googleStatus, setGoogleStatus] = useState<"loading" | "ready" | "error">("loading");
  const [googleRetry, setGoogleRetry] = useState(0);
  const googleButtonRef = useRef<HTMLDivElement>(null);
  const inFlight = useRef(false);
  const onAuthenticatedRef = useRef(onAuthenticated);

  useEffect(() => {
    onAuthenticatedRef.current = onAuthenticated;
  }, [onAuthenticated]);

  useEffect(() => {
    let active = true;
    let observer: ResizeObserver | undefined;
    const container = googleButtonRef.current;
    setGoogleStatus("loading");

    const initialize = async () => {
      try {
        const [clientId, google] = await Promise.all([googleClientId(), loadGoogleIdentity()]);
        if (!active || !container) return;

        // Initialize once per account choice, never on a resize. No One Tap
        // prompt: signing in still requires an explicit click on Google's button.
        google.initialize({
          client_id: clientId,
          ux_mode: "popup",
          login_hint: rememberedAccount?.subject,
          // First login/account switch uses Google's ordinary account popup.
          // Returning users opt into FedCM's personalized, click-to-sign-in flow.
          use_fedcm_for_button: Boolean(rememberedAccount),
          button_auto_select: Boolean(rememberedAccount),
          callback: async ({ credential }) => {
            if (!active || inFlight.current) return;
            if (!credential) return notify("warning", "Login Google belum selesai\n\nKlik tombol Google untuk mencoba lagi.");
            inFlight.current = true;
            setSubmitting(true);
            try {
              const result = await loginWithGoogle(credential);
              if (active) {
                if (!result.accountRemembered) {
                  notify("warning", "Berhasil masuk, tetapi akun belum dapat diingat\n\nLogin berikutnya mungkin meminta Anda memilih akun Google lagi.");
                }
                onAuthenticatedRef.current();
              }
            } catch (cause) {
              if (active) notify("error", cause instanceof Error ? cause.message : "Login Google gagal\n\nCoba lagi atau gunakan username dan password.");
            } finally {
              inFlight.current = false;
              if (active) setSubmitting(false);
            }
          },
        });

        let renderedWidth = 0;
        const render = () => {
          if (!active) return;
          const width = Math.min(400, Math.max(200, Math.floor(container.clientWidth)));
          if (width === renderedWidth) return;
          renderedWidth = width;
          container.replaceChildren();
          google.renderButton(container, {
            type: "standard",
            theme: "outline",
            size: "large",
            text: "signin_with",
            shape: "rectangular",
            logo_alignment: "left",
            width,
          });
        };

        render();
        setGoogleStatus("ready");
        observer = new ResizeObserver(render);
        observer.observe(container);
      } catch (cause) {
        if (active) {
          setGoogleStatus("error");
          notify("error", cause instanceof Error ? cause.message : "Login Google belum tersedia\n\nGunakan username dan password atau hubungi administrator.");
        }
      }
    };

    void initialize();
    return () => {
      active = false;
      observer?.disconnect();
      container?.replaceChildren();
    };
  }, [rememberedAccount, googleRetry]);

  const useAnotherAccount = () => {
    if (inFlight.current) return;
    forgetGoogleAccount();
    setRememberedAccount(null);
  };

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (inFlight.current) return;
    inFlight.current = true;
    setSubmitting(true);
    try {
      await login(username, password);
      onAuthenticated();
    } catch (cause) {
      notify("error", cause instanceof Error ? cause.message : "Login gagal\n\nPeriksa username dan password, lalu coba lagi.");
    } finally {
      inFlight.current = false;
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

          <section aria-label="Login dengan Google" aria-busy={submitting} className="space-y-3">
            <div ref={googleButtonRef} aria-label="Lanjutkan dengan Google" className={`flex min-h-11 w-full items-center justify-center overflow-hidden rounded-md ${submitting ? "pointer-events-none opacity-60" : ""}`} />
            {googleStatus === "loading" && <p role="status" className="text-center text-sm text-slate-500">Menyiapkan login Google...</p>}
            {googleStatus === "error" && (
              <button type="button" disabled={submitting} onClick={() => setGoogleRetry((attempt) => attempt + 1)} className="block w-full rounded-md py-2 text-sm font-medium text-brand-600 hover:underline disabled:opacity-50">
                Coba muat ulang tombol Google
              </button>
            )}
            {rememberedAccount && (
              <button type="button" disabled={submitting} onClick={useAnotherAccount} className="block w-full rounded-md py-2 text-sm font-medium text-brand-600 hover:underline disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-brand-600">
                Gunakan akun lain
              </button>
            )}
          </section>
        </div>
      </section>
    </main>
  );
}
