import { useEffect, useState } from "react";
import { Outlet } from "react-router-dom";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { ScheduleOptimizationProvider } from "../hooks/useScheduleOptimization";

const COLLAPSE_KEY = "sopra-pps-sidebar-collapsed";

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem(COLLAPSE_KEY) === "1";
  } catch {
    return false;
  }
}

export function AppShell() {
  const [collapsed, setCollapsed] = useState(loadCollapsed);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(COLLAPSE_KEY, collapsed ? "1" : "0");
    } catch {
      // localStorage unavailable — collapse state just won't persist across reloads.
    }
  }, [collapsed]);

  return (
    <ScheduleOptimizationProvider>
      <div className="flex min-h-screen bg-slate-50">
        <Sidebar collapsed={collapsed} mobileOpen={mobileMenuOpen} onCloseMobile={() => setMobileMenuOpen(false)} />
        <div className="flex min-w-0 flex-1 flex-col">
          <Topbar collapsed={collapsed} onToggleCollapsed={() => setCollapsed((c) => !c)} onOpenMobile={() => setMobileMenuOpen(true)} />
          <main id="main-content" className="min-w-0 flex-1">
            <Outlet />
          </main>
        </div>
      </div>
    </ScheduleOptimizationProvider>
  );
}
