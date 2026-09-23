import { useEffect, useState } from "react";
import { Check, TriangleAlert, X } from "lucide-react";
import * as ui from "../ui/classNames";

export type NotificationType = "success" | "error" | "warning";

interface Notice {
  type: NotificationType;
  message: string;
}

const EVENT_NAME = "sopra-notification";
const PENDING_WARNING_KEY = "sopra-pending-warning";

export const notify = (type: NotificationType, message: string) =>
  window.dispatchEvent(new CustomEvent<Notice>(EVENT_NAME, { detail: { type, message } }));

export const queueWarning = (message: string) =>
  sessionStorage.setItem(PENDING_WARNING_KEY, message);

const styles = {
  success: { title: "Changes saved", icon: Check, iconClass: "bg-emerald-50 text-emerald-600" },
  error: { title: "Permintaan belum dapat diproses", icon: X, iconClass: "bg-red-50 text-red-600" },
  warning: { title: "Periksa kembali", icon: TriangleAlert, iconClass: "bg-amber-50 text-amber-600" },
};

export function Notification() {
  const [notice, setNotice] = useState<Notice | null>(null);
  const [leaving, setLeaving] = useState(false);

  useEffect(() => {
    const pending = sessionStorage.getItem(PENDING_WARNING_KEY);
    if (pending) {
      sessionStorage.removeItem(PENDING_WARNING_KEY);
      setNotice({ type: "warning", message: pending });
    }

    const show = (event: Event) => {
      setLeaving(false);
      setNotice((event as CustomEvent<Notice>).detail);
    };
    window.addEventListener(EVENT_NAME, show);
    return () => window.removeEventListener(EVENT_NAME, show);
  }, []);

  useEffect(() => {
    if (!notice || notice.type !== "success") return;
    const timer = window.setTimeout(() => setLeaving(true), 4_000);
    return () => window.clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    if (!leaving) return;
    const timer = window.setTimeout(() => setNotice(null), 180);
    return () => window.clearTimeout(timer);
  }, [leaving]);

  useEffect(() => {
    if (!notice) return;
    const closeOnEscape = (event: KeyboardEvent) => event.key === "Escape" && setLeaving(true);
    window.addEventListener("keydown", closeOnEscape);
    return () => window.removeEventListener("keydown", closeOnEscape);
  }, [notice]);

  if (!notice) return null;

  const style = styles[notice.type];
  const Icon = style.icon;
  const titleEnd = notice.message.indexOf("\n\n");
  const hasTitle = notice.type !== "success" && titleEnd > 0 && titleEnd <= 90 && !notice.message.slice(0, titleEnd).includes("\n");
  const messageTitle = hasTitle ? notice.message.slice(0, titleEnd) : style.title;
  const messageBody = hasTitle ? notice.message.slice(titleEnd + 2) : notice.message;

  return (
    <div
      className={`notification-backdrop fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/20 px-4 ${leaving ? "notification-backdrop-out" : ""}`}
      onMouseDown={(event) => event.target === event.currentTarget && setLeaving(true)}
    >
      <section
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="notification-title"
        aria-describedby="notification-message"
        aria-live="assertive"
        className={`notification-panel relative max-h-[85vh] w-full max-w-[480px] overflow-y-auto rounded-lg border border-slate-200 bg-white px-7 pb-9 pt-9 text-center shadow-2xl sm:px-8 ${leaving ? "notification-panel-out" : ""}`}
      >
        <button
          type="button"
          aria-label="Close notification"
          className="absolute right-4 top-4 rounded-md p-1 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600"
          onClick={() => setLeaving(true)}
        >
          <X size={16} />
        </button>

        <span className={`notification-icon mx-auto flex h-14 w-14 items-center justify-center rounded-full ${style.iconClass}`}>
          <Icon size={24} strokeWidth={2.2} />
        </span>
        <div className="notification-content">
          <div className="notification-copy">
            <h2 id="notification-title" className="text-center text-xl font-bold tracking-tight text-slate-900">{messageTitle}</h2>
            <div id="notification-message" className="flex flex-col gap-4 break-words text-center text-sm leading-6 text-slate-600">
              {messageBody.split("\n\n").map((paragraph, index) => <div key={index} className={/^(Mesin|Mulai|Selesai|Order|Produk|Jadwal|Kolom|Baris|Periksa|Tujuan|Status)[^:\n]*:/.test(paragraph) ? "rounded-md bg-slate-50 px-4 py-3 text-left" : ""}>{paragraph.split("\n").map((line, lineIndex) => {
                const label = /^(Mesin|Mulai|Selesai|Order|Produk|Jadwal|Kolom|Baris|Periksa|Tujuan|Status)[^:\n]*:/.exec(line);
                return <span key={lineIndex} className="block">{label ? <><strong className="font-semibold text-slate-800">{label[0]}</strong>{line.slice(label[0].length)}</> : line}</span>;
              })}</div>)}
            </div>
          </div>
          <button
            type="button"
            className={`${ui.btnPrimary} min-w-32 justify-center px-6 py-2.5 text-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600`}
            onClick={() => setLeaving(true)}
          >
            Close
          </button>
        </div>
        {notice.type === "success" && <span aria-hidden="true" className="notification-progress absolute inset-x-0 bottom-0 h-1 bg-brand-500" />}
      </section>
    </div>
  );
}
