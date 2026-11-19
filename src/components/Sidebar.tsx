import { useState } from "react";
import { ArrowLeftRight, Box, CalendarDays, ChevronDown, LayoutGrid, List, Settings, ShieldCheck, Wrench, X } from "lucide-react";
import { NavLink } from "react-router-dom";
import { isAdmin } from "../api/client";
import { usePermissions, type ModuleKey } from "../auth/permissions";
import { Logo } from "./Logo";

interface Props {
  collapsed: boolean;
  mobileOpen: boolean;
  onCloseMobile: () => void;
}

interface NavItem {
  to: string;
  label: string;
  icon: typeof LayoutGrid;
  end: boolean;
  module?: ModuleKey;
  adminOnly?: boolean;
}

const NAV_GROUPS: Array<{ label: string; items: NavItem[] }> = [
  {
    label: "Overview",
    items: [{ to: "/", label: "Dashboard", icon: LayoutGrid, end: true, module: "dashboard" }],
  },
  {
    label: "Master",
    items: [
      { to: "/orders", label: "Orders", icon: List, end: false, module: "orders" },
      { to: "/machines", label: "Machines", icon: Settings, end: false, module: "machines" },
    ],
  },
  {
    label: "Transaction",
    items: [
      { to: "/schedule", label: "Schedule", icon: CalendarDays, end: false, module: "schedule" },
      { to: "/maintenance", label: "Maintenance", icon: Wrench, end: false, module: "maintenance" },
      { to: "/setup", label: "Setup", icon: ArrowLeftRight, end: false, module: "setup" },
      { to: "/hot-runner", label: "Hot Runner", icon: Box, end: false, module: "hot-runner" },
    ],
  },
  {
    label: "Administration",
    items: [{ to: "/users", label: "Users & Roles", icon: ShieldCheck, end: false, adminOnly: true }],
  },
];

export function Sidebar({ collapsed, mobileOpen, onCloseMobile }: Props) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Overview: true,
    Master: true,
    Transaction: true,
    Administration: true,
  });
  const { can } = usePermissions();
  const admin = isAdmin();
  const visibleGroups = NAV_GROUPS
    .map((group) => ({ ...group, items: group.items.filter((item) => item.adminOnly ? admin : item.module ? can(item.module, "view") : false) }))
    .filter((group) => group.items.length > 0);

  return (
    <>
      {mobileOpen && <button type="button" aria-label="Close menu" className="fixed inset-0 z-30 bg-slate-950/25 lg:hidden" onClick={onCloseMobile} />}
      <aside
        className={`fixed inset-y-0 left-0 z-40 flex h-screen w-52.5 shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-transform duration-200 lg:visible lg:sticky lg:top-0 lg:z-20 lg:translate-x-0 lg:transition-[width] ${mobileOpen ? "visible translate-x-0" : "invisible -translate-x-full"} ${collapsed ? "lg:w-16" : "lg:w-52.5"}`}
      >
      <div className="flex h-15.5 shrink-0 items-center justify-center px-2">
        <Logo variant="wordmark" className="h-13 w-32 scale-125 lg:hidden" />
        <Logo variant={collapsed ? "mark" : "wordmark"} className={`hidden lg:block ${collapsed ? "h-8 w-8" : "h-13 w-full scale-125"}`} />
        <button type="button" aria-label="Close navigation" onClick={onCloseMobile} className="ml-2 grid h-8 w-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-50 lg:hidden"><X size={16} /></button>
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2.5 pt-1">
        {visibleGroups.map((group) => (
          <div key={group.label} className="mb-3">
              <button
                type="button"
                onClick={() => setOpenGroups((value) => ({ ...value, [group.label]: !value[group.label] }))}
                className={`flex w-full items-center justify-between rounded-md px-1.5 pb-2 pt-1 text-left text-xs font-medium tracking-[0.04em] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700 ${collapsed ? "lg:hidden" : ""}`}
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
                    collapsed ? "ml-2 px-1.5 lg:ml-0 lg:justify-center lg:px-2" : "ml-2 px-1.5"
                  } ${!openGroups[group.label] ? (collapsed ? "hidden lg:flex" : "hidden") : ""} ${isActive ? "bg-brand-50 text-brand-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`
                }
              >
                <Icon size={15} strokeWidth={2.3} className="shrink-0" />
                <span className={collapsed ? "lg:hidden" : ""}>{label}</span>
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
      </aside>
    </>
  );
}
