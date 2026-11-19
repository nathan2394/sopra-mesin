import { useState } from "react";
import { BrowserRouter, Route, Routes } from "react-router-dom";
import { hasToken } from "./api/client";
import { AppShell } from "./components/AppShell";
import { DashboardPage } from "./pages/DashboardPage";
import { OrdersPage } from "./pages/OrdersPage";
import { SchedulePage } from "./pages/SchedulePage";
import { MachinesPage } from "./pages/MachinesPage";
import { MaintenancePage } from "./pages/MaintenancePage";
import { SetupPage } from "./pages/SetupPage";
import { HotRunnerPage } from "./pages/HotRunnerPage";
import { LoginPage } from "./pages/LoginPage";
import { UsersPage } from "./pages/UsersPage";
import { Notification } from "./components/Notification";
import { RequireAdmin, RequireView } from "./components/RouteGuards";

function App() {
  const [authenticated, setAuthenticated] = useState(hasToken);

  return (
    <>
      <Notification />
      {!authenticated ? (
        <LoginPage onAuthenticated={() => setAuthenticated(true)} />
      ) : (
        <BrowserRouter>
          <Routes>
            <Route element={<AppShell />}>
              <Route index element={<RequireView module="dashboard"><DashboardPage /></RequireView>} />
              <Route path="/orders" element={<RequireView module="orders"><OrdersPage /></RequireView>} />
              <Route path="/schedule" element={<RequireView module="schedule"><SchedulePage /></RequireView>} />
              <Route path="/machines" element={<RequireView module="machines"><MachinesPage /></RequireView>} />
              <Route path="/maintenance" element={<RequireView module="maintenance"><MaintenancePage /></RequireView>} />
              <Route path="/setup" element={<RequireView module="setup"><SetupPage /></RequireView>} />
              <Route path="/hot-runner" element={<RequireView module="hot-runner"><HotRunnerPage /></RequireView>} />
              <Route path="/users" element={<RequireAdmin><UsersPage /></RequireAdmin>} />
            </Route>
          </Routes>
        </BrowserRouter>
      )}
    </>
  );
}

export default App;
