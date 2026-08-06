import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { hasToken } from "./api/client";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { OrdersPage } from "./pages/OrdersPage";
import { SchedulePage } from "./pages/SchedulePage";
import { MachinesPage } from "./pages/MachinesPage";
import { MaintenancePage } from "./pages/MaintenancePage";
import { LoginPage } from "./pages/LoginPage";
import "./App.css";

function App() {
  const [authenticated, setAuthenticated] = useState(hasToken);
  if (!authenticated) return <LoginPage onAuthenticated={() => setAuthenticated(true)} />;

  return (
    <BrowserRouter>
      <Routes>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/orders" element={<OrdersPage />} />
          <Route path="/schedule" element={<SchedulePage />} />
          <Route path="/machines" element={<MachinesPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
