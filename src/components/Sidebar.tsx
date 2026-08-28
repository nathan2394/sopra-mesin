import { useState } from "react";
import { CalendarDays, ChevronDown, LayoutGrid, List, Settings, Wrench, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Logo } from "./Logo";

interface Props {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

const NAV_GROUPS = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutGrid, end: true }],
  },
  {
    label: "Master",
    items: [
      { to: "/orders", label: "Orders", icon: List, end: false },
      { to: "/machines", label: "Machines", icon: Settings, end: false },
    ],
  },
  {
    label: "Transaction",
    items: [
      { to: "/schedule", label: "Schedule", icon: CalendarDays, end: false },
      { to: "/maintenance", label: "Maintenance", icon: Wrench, end: false },
    ],
  },
];

export function Sidebar({ collapsed, mobileOpen, onCloseMobile }: Props) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Overview: true,
    Master: true,
    Transaction: true,
  });

  return (
    <>
      {mobileOpen && <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 bg-slate-950/25 md:hidden" onClick={onCloseMobile} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-52.5 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-transform duration-200 md:visible md:sticky md:top-0 md:z-20 md:w-16 md:translate-x-0 md:transition-[width] ${mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"} ${collapsed ? "xl:w-16" : "xl:w-52.5"}`}
      >
      <div className="flex h-15.5 shrink-0 items-center justify-center px-3">
        <Logo variant="wordmark" className="h-13 w-full md:hidden" />
        <Logo variant="mark" className="hidden h-8 w-8 md:block xl:hidden" />
        <Logo variant={collapsed ? "mark" : "wordmark"} className={`hidden xl:block ${collapsed ? "h-8 w-8" : "h-13 w-full"}`} />
        <button type="button" aria-label="Close navigation" onClick={onCloseMobile} className="ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-50 md:hidden"><X size={16} /></button>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2.5 pt-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-3">
              <button
                type="button"
                onClick={() => setOpenGroups((value) => ({ ...value, [group.label]: !value[group.label] }))}
                className={`w-full items-center justify-between rounded-md px-1.5 pb-2 pt-1 text-left text-xs font-medium tracking-[0.04em] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 ${collapsed ? "hidden" : "flex md:hidden xl:flex"}`}
              >
                <span>{group.label}</span>
                <ChevronDown size={13} className={`transition-transform ${openGroups[group.label] ? "rotate-0" : "-rotate-90"}`} />
              </button>
            {group.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={label}
                onClick={onCloseMobile}
                className={({ isActive }) =>
                  `mb-0.5 flex h-6.75 items-center gap-2.5 rounded-md text-2xs font-medium no-underline transition-colors ${
                    collapsed ? "ml-2 px-1.5 md:ml-0 md:justify-center md:px-2" : "ml-2 px-1.5 md:ml-0 md:justify-center md:px-2 xl:ml-2 xl:justify-start xl:px-1.5"
                  } ${!collapsed && !openGroups[group.label] ? "xl:hidden" : ""} ${isActive ? "bg-brand-50 text-brand-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`
                }
              >
                <Icon size={15} strokeWidth={2.3} className="shrink-0" />
                <span className={collapsed ? "md:hidden" : "md:hidden xl:inline"}>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      </aside>
    </>
  );
}
