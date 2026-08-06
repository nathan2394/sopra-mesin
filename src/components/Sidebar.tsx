import { useState } from "react";
import { CalendarDays, ChevronDown, LayoutGrid, List, Settings, Wrench } from "lucide-react";
import { NavLink } from "react-router-dom";
import { Logo } from "./Logo";

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
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

export function Sidebar({ collapsed }: Props) {
  const [openGroups, setOpenGroups] = useState<Record<string, boolean>>({
    Overview: true,
    Master: true,
    Transaction: true,
  });

  return (
    <aside
      className={`sticky top-0 z-20 flex h-screen shrink-0 flex-col overflow-hidden border-r border-slate-200 bg-white transition-[width] duration-200 ${
        collapsed ? "w-16" : "w-52.5"
      }`}
    >
      <div className={`flex h-15.5 shrink-0 items-center gap-2 px-4 ${collapsed ? "justify-center" : ""}`}>
        <Logo size={25} />
        {!collapsed && (
          <span className="whitespace-nowrap text-[15px] font-bold tracking-[-0.02em] text-slate-800">
            NEXORA MESIN
          </span>
        )}
      </div>

      <nav aria-label="Main navigation" className="flex-1 overflow-y-auto px-2.5 pt-1">
        {NAV_GROUPS.map((group) => (
          <div key={group.label} className="mb-3">
            {!collapsed && (
              <button
                type="button"
                onClick={() => setOpenGroups((value) => ({ ...value, [group.label]: !value[group.label] }))}
                className="flex w-full items-center justify-between rounded-md px-1.5 pb-2 pt-1 text-left text-xs font-medium tracking-[0.04em] text-slate-500 transition-colors hover:bg-slate-50 hover:text-slate-700"
              >
                <span>{group.label}</span>
                <ChevronDown size={13} className={`transition-transform ${openGroups[group.label] ? "rotate-0" : "-rotate-90"}`} />
              </button>
            )}
            {(collapsed || openGroups[group.label]) && group.items.map(({ to, label, icon: Icon, end }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                title={collapsed ? label : undefined}
                className={({ isActive }) =>
                  `mb-0.5 flex h-6.75 items-center gap-2.5 rounded-md text-2xs font-medium no-underline transition-colors ${
                    collapsed ? "justify-center px-2" : "ml-2 px-1.5"
                  } ${isActive ? "bg-blue-50 text-blue-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`
                }
              >
                <Icon size={15} strokeWidth={2.3} className="shrink-0" />
                {!collapsed && label}
              </NavLink>
            ))}
          </div>
        ))}
      </nav>
    </aside>
  );
}
