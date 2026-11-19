import { useCallback, useEffect, useMemo, useState } from "react";
import { KeyRound, Plus } from "lucide-react";
import { api, currentUsername } from "../api/client";
import { notify } from "../components/Notification";
import { PageHeader } from "../components/PageHeader";
import { ResetPasswordDrawer, UserForm, type UserDraft } from "../components/UserForm";
import { RoleForm, type RoleDraft } from "../components/RoleForm";
import type { AdminRole, AdminUser, PermissionModuleInfo } from "../auth/permissions";
import { DataTable } from "../ui/DataTable";
import { StatsRow, StatCard } from "../ui/StatCard";
import * as ui from "../ui/classNames";

type Tab = "users" | "roles";

export function UsersPage() {
  const [tab, setTab] = useState<Tab>("users");
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [roles, setRoles] = useState<AdminRole[]>([]);
  const [modules, setModules] = useState<PermissionModuleInfo[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [search, setSearch] = useState("");
  const [userForm, setUserForm] = useState<{ user: AdminUser | null } | null>(null);
  const [roleForm, setRoleForm] = useState<{ role: AdminRole | null } | null>(null);
  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const self = currentUsername();

  const load = useCallback(async () => {
    try {
      const [nextUsers, nextRoles, catalog] = await Promise.all([
        api<AdminUser[]>("/users"),
        api<AdminRole[]>("/roles"),
        api<{ modules: PermissionModuleInfo[] }>("/roles/catalog"),
      ]);
      setUsers(nextUsers);
      setRoles(nextRoles);
      setModules(catalog.modules);
      setLoadError("");
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : "Data belum dapat dimuat\n\nMuat ulang halaman.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const filteredUsers = useMemo(() => {
    const query = search.trim().toLowerCase();
    return query ? users.filter((user) => `${user.username} ${user.email} ${user.role}`.toLowerCase().includes(query)) : users;
  }, [search, users]);

  const saveUser = async (draft: UserDraft) => {
    const editing = userForm?.user;
    if (editing) {
      await api<AdminUser>(`/users/${editing.id}`, { method: "POST", body: JSON.stringify({ email: draft.email, role: draft.role, isActive: draft.isActive }) });
    } else {
      await api<AdminUser>("/users", { method: "POST", body: JSON.stringify({ username: draft.username, email: draft.email, password: draft.password, role: draft.role }) });
    }
    setUserForm(null);
    notify("success", editing ? "User updated successfully." : "User created successfully.");
    await load();
  };

  const saveRole = async (draft: RoleDraft) => {
    const editing = roleForm?.role;
    const body = JSON.stringify({ name: draft.name, description: draft.description || null, permissions: draft.permissions });
    if (editing) await api<AdminRole>(`/roles/${editing.id}`, { method: "POST", body });
    else await api<AdminRole>("/roles", { method: "POST", body });
    setRoleForm(null);
    notify("success", editing ? "Role updated successfully." : "Role created successfully.");
    await load();
  };

  const removeRole = async (role: AdminRole) => {
    if (!window.confirm(`Delete role ${role.name}? This cannot be undone.`)) return;
    try {
      await api<void>(`/roles/${role.id}`, { method: "DELETE" });
      notify("success", "Role removed successfully.");
      await load();
    } catch (cause) {
      notify("error", cause instanceof Error ? cause.message : "Role belum dapat dihapus\n\nMuat ulang dan coba lagi.");
    }
  };

  const activeUsers = users.filter((user) => user.isActive).length;
  const summarize = (role: AdminRole) => {
    const sets = modules.map((module) => role.permissions[module.key]);
    return {
      viewable: sets.filter((set) => set?.view).length,
      editable: sets.filter((set) => set && (set.create || set.update || set.delete)).length,
    };
  };

  return (
    <div className={ui.page}>
      <PageHeader
        breadcrumb={[]}
        title="Users & Roles"
        subtitle="Create accounts and decide, page by page, who can view, insert, update, and delete."
        actions={tab === "users"
          ? <button type="button" className={ui.btnPrimary} disabled={loading || roles.length === 0} onClick={() => setUserForm({ user: null })}><Plus size={15} /> New user</button>
          : <button type="button" className={ui.btnPrimary} disabled={loading || modules.length === 0} onClick={() => setRoleForm({ role: null })}><Plus size={15} /> New role</button>}
      />

      <StatsRow>
        <StatCard value={users.length} label="Users" />
        <StatCard value={activeUsers} label="Active" />
        <StatCard value={users.length - activeUsers} label="Inactive" />
        <StatCard value={roles.length} label="Roles" />
      </StatsRow>

      <div className="mb-3.5 flex flex-wrap items-center gap-2.5">
        <div className={ui.segmentedWrap} role="tablist" aria-label="Users and roles">
          {(["users", "roles"] as const).map((item) => (
            <button key={item} type="button" role="tab" aria-selected={tab === item} className={`${ui.segmentedBtn} ${tab === item ? ui.segmentedBtnActive : ""}`} onClick={() => setTab(item)}>
              {item === "users" ? "Users" : "Roles"}
            </button>
          ))}
        </div>
        {tab === "users" && (
          <>
            <input className={`${ui.searchInput}`} placeholder="Search username, email or role..." value={search} onChange={(event) => setSearch(event.target.value)} />
            <span className={ui.filterSummary}>{filteredUsers.length} of {users.length} shown</span>
          </>
        )}
      </div>

      {loadError && <div role="alert" className={`${ui.bannerError} mb-3.5`}>{loadError} <button type="button" className={ui.btnSecondary} onClick={() => { setLoading(true); void load(); }}>Retry</button></div>}

      {tab === "users" ? (
        <DataTable
          rows={filteredUsers}
          rowKey={(user) => user.id}
          isLoading={loading}
          emptyText="No users match your search."
          label="Users"
          columns={[
            { key: "username", header: "Username", cell: (user) => <span className="font-semibold text-slate-900">{user.username}{user.username === self && <span className="ml-1.5 text-2xs font-medium text-slate-400">(you)</span>}</span> },
            { key: "email", header: "Email", cell: (user) => user.email },
            { key: "role", header: "Role", cell: (user) => <span className={ui.badgeNeutral}>{user.role}</span> },
            { key: "status", header: "Status", cell: (user) => <span className={user.isActive ? ui.statusFulfilled : ui.statusCancelled}>{user.isActive ? "Active" : "Inactive"}</span> },
            {
              key: "actions",
              header: "",
              className: "text-right whitespace-nowrap",
              cell: (user) => user.isEditable ? <>
                <button type="button" className={ui.btnLink} onClick={() => setUserForm({ user })}>Edit</button>
                {user.username !== self && <button type="button" className={ui.btnLink} onClick={() => setResetUser(user)}><KeyRound size={12} className="mr-1 inline" />Reset password</button>}
              </> : <span className="text-2xs text-slate-400">Service account</span>,
            },
          ]}
        />
      ) : (
        <DataTable
          rows={roles}
          rowKey={(role) => role.id}
          isLoading={loading}
          emptyText="No roles found."
          label="Roles"
          columns={[
            { key: "name", header: "Role", cell: (role) => <div><p className="font-semibold text-slate-900">{role.name}</p>{role.description && <p className="mt-0.5 text-2xs text-slate-500">{role.description}</p>}</div> },
            { key: "type", header: "Type", cell: (role) => <span className={role.isSystem ? ui.statusConfirmed : ui.badgeNeutral}>{role.isSystem ? "System" : "Custom"}</span> },
            { key: "users", header: "Users", align: "right", cell: (role) => role.userCount },
            { key: "view", header: "Can view", cell: (role) => { const { viewable } = summarize(role); return `${viewable} of ${modules.length} pages`; } },
            { key: "edit", header: "Can change data", cell: (role) => { const { editable } = summarize(role); return editable === 0 ? "None" : `${editable} ${editable === 1 ? "page" : "pages"}`; } },
            {
              key: "actions",
              header: "",
              className: "text-right whitespace-nowrap",
              cell: (role) => <>
                <button type="button" className={ui.btnLink} onClick={() => setRoleForm({ role })}>{role.isEditable ? "Edit" : "View"}</button>
                {role.isEditable && <button type="button" className={`${ui.btnLinkDanger} disabled:cursor-not-allowed disabled:opacity-40`} disabled={role.userCount > 0} title={role.userCount > 0 ? "Move its users to another role first" : undefined} onClick={() => void removeRole(role)}>Delete</button>}
              </>,
            },
          ]}
        />
      )}

      {userForm && <UserForm initial={userForm.user} roles={roles} selfUsername={self} onSave={saveUser} onCancel={() => setUserForm(null)} />}
      {roleForm && <RoleForm initial={roleForm.role} modules={modules} onSave={saveRole} onCancel={() => setRoleForm(null)} />}
      {resetUser && <ResetPasswordDrawer user={resetUser} onCancel={() => setResetUser(null)} onSave={async (password) => {
        await api<unknown>(`/users/${resetUser.id}/reset-password`, { method: "POST", body: JSON.stringify({ newPassword: password }) });
        setResetUser(null);
        notify("success", "Password reset successfully.");
      }} />}
    </div>
  );
}
