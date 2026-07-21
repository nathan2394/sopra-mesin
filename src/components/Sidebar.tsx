import { NavLink } from "react-router-dom";
import { LayoutDashboard, ClipboardList, GanttChartSquare, Factory, PanelLeftClose, PanelLeftOpen, LogOut } from "lucide-react";
import { Logo } from "./Logo";

interface Props {
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/orders", label: "Orders", icon: ClipboardList, end: false },
  { to: "/schedule", label: "Schedule", icon: GanttChartSquare, end: false },
  { to: "/machines", label: "Machines", icon: Factory, end: false },
];

export function Sidebar({ collapsed, onToggleCollapsed }: Props) {
  return (
    <aside
      className={`sticky top-0 flex h-screen shrink-0 flex-col border-r border-slate-200 bg-white transition-[width] duration-150 ${
        collapsed ? "w-[72px]" : "w-64"
      }`}
    >
      <div className={`flex items-center gap-2.5 pt-5 pb-4 ${collapsed ? "justify-center px-0" : "px-5"}`}>
        <Logo />
        {!collapsed && (
          <div className="leading-tight">
            <div className="text-[0.98rem] font-bold text-slate-800">Sopra PPS</div>
            <div className="text-[0.72rem] text-slate-400">MVP · v0.1.0</div>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto px-3 py-1">
        {!collapsed && (
          <div className="px-2.5 pt-4 pb-1.5 text-[0.68rem] font-bold tracking-wide text-slate-400 uppercase">
            Production
          </div>
        )}
        {NAV_ITEMS.map(({ to, label, icon: Icon, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            title={collapsed ? label : undefined}
            className={({ isActive }) =>
              `mb-0.5 flex items-center gap-2.5 rounded-md py-2 text-[0.88rem] font-medium no-underline ${
                collapsed ? "justify-center px-2.5" : "px-2.5"
              } ${isActive ? "bg-blue-50 font-semibold text-blue-600" : "text-slate-500 hover:bg-slate-50 hover:text-slate-800"}`
            }
          >
            <Icon size={17} className="shrink-0" />
            {!collapsed && label}
          </NavLink>
        ))}
      </nav>

      <div className={`border-t border-slate-200 pt-3.5 pb-4 ${collapsed ? "flex justify-center px-0" : "px-5"}`}>
        {!collapsed && (
          <>
            <div className="text-[0.7rem] tracking-wide text-slate-400 uppercase">SOPRA</div>
            <div className="mt-0.5 text-[0.86rem] font-bold text-slate-800">nathan@sopra.id</div>
            <div className="text-[0.78rem] text-slate-500">Production Planner</div>
          </>
        )}
        <div className={`mt-2.5 flex items-center text-[0.8rem] ${collapsed ? "flex-col justify-center gap-3" : "justify-between"}`}>
          <button
            type="button"
            onClick={onToggleCollapsed}
            title={collapsed ? "Expand" : "Collapse"}
            className="flex cursor-pointer items-center gap-1 border-0 bg-none p-0 text-[0.8rem] text-slate-500 hover:text-slate-800"
          >
            {collapsed ? <PanelLeftOpen size={14} /> : <PanelLeftClose size={14} />}
            {!collapsed && "Collapse"}
          </button>
          <button
            type="button"
            title={collapsed ? "Logout" : undefined}
            className="flex cursor-pointer items-center gap-1 border-0 bg-none p-0 text-[0.8rem] font-medium text-red-600 hover:text-red-700"
          >
            <LogOut size={14} />
            {!collapsed && "Logout"}
          </button>
        </div>
      </div>
    </aside>
  );
}
