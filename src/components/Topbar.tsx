import { ChevronDown, LogOut, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { currentUsername, logout } from "../api/client";

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

export function Topbar({ collapsed, onToggleCollapsed }: Props) {
  const username = currentUsername();
  const email = username.includes("@") ? username : `${username}@sopra.id`;

  return (
    <header className="sticky top-0 z-10 flex h-13.25 shrink-0 items-center justify-between border-b border-slate-200 bg-white px-5">
      <button
        type="button"
        onClick={onToggleCollapsed}
        aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        className="flex items-center gap-1.5 rounded-md px-1.5 py-1 text-xs font-medium text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
      >
        {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
        <span>{collapsed ? "Expand" : "Collapse"}</span>
      </button>

      <details className="group relative [&>summary::-webkit-details-marker]:hidden">
        <summary className="flex cursor-pointer list-none items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600">
          <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-600 text-xs font-semibold text-white">
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
            className="flex w-full items-center gap-2 rounded-md px-2.5 py-2 text-left text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50 hover:text-red-600 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <LogOut size={14} />
            Logout
          </button>
        </div>
      </details>
    </header>
  );
}
