import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { Lock } from "lucide-react";
import { isAdmin, logout } from "../api/client";
import { firstAllowedPath, usePermissions, type ModuleKey } from "../auth/permissions";
import * as ui from "../ui/classNames";

export function NoAccess({ title = "No page access yet", message }: { title?: string; message?: string }) {
  return (
    <div className={ui.page}>
      <div className={`${ui.card} mx-auto mt-10 max-w-md text-center`}>
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-500"><Lock size={20} /></span>
        <h1 className="mt-4 text-lg font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1.5 text-sm text-slate-500">
          {message ?? "Your account has not been given access to any page. Ask an administrator to assign a role, then sign in again."}
        </p>
        <button type="button" className={`${ui.btnSecondary} mt-5`} onClick={() => { logout(); window.location.reload(); }}>Sign out</button>
      </div>
    </div>
  );
}

export function RequireView({ module, children }: { module: ModuleKey; children: ReactNode }) {
  const { map, can } = usePermissions();
  if (can(module, "view")) return <>{children}</>;
  const fallback = firstAllowedPath(map);
  return fallback ? <Navigate to={fallback} replace /> : <NoAccess />;
}

export function RequireAdmin({ children }: { children: ReactNode }) {
  const { map } = usePermissions();
  if (isAdmin()) return <>{children}</>;
  const fallback = firstAllowedPath(map);
  return fallback ? <Navigate to={fallback} replace /> : <NoAccess />;
}
