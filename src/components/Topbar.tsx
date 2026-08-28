import { useEffect, useRef } from "react";
import { Bell, CheckCircle2, ChevronDown, Clock3, LoaderCircle, LogOut, Menu, PanelLeftClose, PanelLeftOpen, XCircle } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { currentUsername, logout } from "../api/client";
import { useScheduleOptimization } from "../hooks/useScheduleOptimization";

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
  onOpenMobile: () => void;
}

export function Topbar({ collapsed, onToggleCollapsed, onOpenMobile }: Props) {
  const username = currentUsername();
  const notificationRef = useRef<HTMLDetailsElement>(null);
  const email = username.includes("@") ? username : `${username}@sopra.id`;
  const navigate = useNavigate();
  const optimization = useScheduleOptimization();
  const job = optimization.latest;
  const active = job?.status === "Queued" || job?.status === "Processing";
  const unread = Boolean(job && !job.isRead && (job.status === "Ready" || job.status === "Failed"));
  const status = active
    ? { title: "Optimizing schedule", copy: "The result will appear here when it is ready.", Icon: LoaderCircle, color: "text-brand-600", spin: true }
    : job?.status === "Ready"
      ? { title: "Schedule is ready", copy: "Review the AI result before applying it.", Icon: CheckCircle2, color: "text-emerald-600", spin: false }
      : job?.status === "Failed"
        ? { title: "Optimization failed", copy: job.errorMessage ?? "The AI service could not finish the request.", Icon: XCircle, color: "text-red-600", spin: false }
        : optimization.busy
          ? { title: "Optimization in progress", copy: "Another planner is currently optimizing the schedule.", Icon: LoaderCircle, color: "text-brand-600", spin: true }
          : { title: "No active optimization", copy: "New optimization updates will appear here.", Icon: Clock3, color: "text-slate-400", spin: false };
  const StatusIcon = status.Icon;

  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      const notification = notificationRef.current;
      if (notification?.open && !notification.contains(event.target as Node)) notification.open = false;
    };
    document.addEventListener("pointerdown", dismiss);
    return () => document.removeEventListener("pointerdown", dismiss);
  }, []);

  return (
    <header className="sticky top-0 z-10 flex h-13.25 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
      <button type="button" onClick={onOpenMobile} aria-label="Open menu" className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 md:hidden">
        <Menu size={15} />
        <span>Menu</span>
      </button>
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="hidden items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 md:flex"
      >
        {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        <span>{collapsed ? "Expand" : "Collapse"}</span>
      </button>

      <div className="flex items-center gap-2">
        <details
          ref={notificationRef}
          className="group relative [&>summary::-webkit-details-marker]:hidden"
          onToggle={(event) => {
            if (event.currentTarget.open && job && !active && !job.isRead) void optimization.markRead(job.id).catch(() => undefined);
          }}
        >
          <summary className="relative flex h-8 w-8 cursor-pointer list-none items-center justify-center rounded-md text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" aria-label="Optimization notifications">
            {optimization.busy
              ? <LoaderCircle size={16} className="animate-spin text-brand-600" />
              : <Bell size={16} />}
            {unread && <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-red-500 ring-2 ring-white" />}
          </summary>
          <section className="absolute right-0 top-[calc(100%+0.5rem)] w-80 rounded-lg border border-slate-200 bg-white p-4 shadow-lg shadow-slate-200/60">
            <div className="flex items-start gap-3">
              <span className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-slate-50 ${status.color}`}>
                <StatusIcon size={16} className={status.spin ? "animate-spin" : ""} />
              </span>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-slate-900">{status.title}</p>
                <p className="mt-1 text-xs leading-5 text-slate-500">{status.copy}</p>
                {job?.status === "Ready" && (
                  <button type="button" className="mt-3 text-xs font-semibold text-brand-600 hover:text-brand-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600" onClick={() => {
                    if (notificationRef.current) notificationRef.current.open = false;
                    navigate(`/schedule?optimizationJob=${job.id}`);
                  }}>
                    Review schedule
                  </button>
                )}
              </div>
            </div>
          </section>
        </details>

        <details className="group relative [&>summary::-webkit-details-marker]:hidden">
          <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-brand-600 text-xs font-semibold text-white">
            {username.charAt(0).toUpperCase()}
          </span>
          <span className="hidden min-w-0 text-left leading-[1.2] sm:block">
            <span className="block max-w-52 truncate text-xs font-semibold text-slate-800">{email}</span>
            <span className="block text-2xs text-slate-500">Production Planner</span>
          </span>
          <ChevronDown size={14} className="text-slate-400 transition-transform group-open:rotate-180" />
          </summary>

        <div className="absolute right-0 top-[calc(100%+0.5rem)] w-40 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg shadow-slate-200/60">
          <button
            type="button"
            onClick={() => {
              logout();
              window.location.reload();
            }}
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-brand-600"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
        </details>
      </div>
    </header>
  );
}
