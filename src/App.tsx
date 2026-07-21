import { HashRouter, Route, Routes } from "react-router-dom";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { OrdersPage } from "./pages/OrdersPage";
import { SchedulePage } from "./pages/SchedulePage";
import { MachinesPage } from "./pages/MachinesPage";
import "./App.css";

/**
 * Sopra PPS MVP — mock-data-only (no backend, no database), styled after the Nexora
 * Commerce design system (sidebar nav, breadcrumb + title header pattern, card panels).
 * Orders/Machines/Schedule all persist to localStorage via their respective hooks.
 */
function App() {
  return (
    <HashRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/machines" element={<MachinesPage />} />
        </Route>
      </Routes>
    </HashRouter>
  );
}

export default App;
