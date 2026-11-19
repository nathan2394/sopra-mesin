import { useState } from "react";
import { Drawer } from "./Drawer";
import * as ui from "../ui/classNames";
import { EMPTY_SET, type AdminRole, type PermissionAction, type PermissionMap, type PermissionModuleInfo } from "../auth/permissions";

export interface RoleDraft {
  name: string;
  description: string;
  permissions: PermissionMap;
}

interface Props {
  initial: AdminRole | null;
  modules: PermissionModuleInfo[];
  onSave: (draft: RoleDraft) => Promise<void>;
  onCancel: () => void;
}

const COLUMNS: Array<{ action: PermissionAction; label: string }> = [
  { action: "view", label: "View" },
  { action: "create", label: "Insert" },
  { action: "update", label: "Update" },
  { action: "delete", label: "Delete" },
];

export function RoleForm({ initial, modules, onSave, onCancel }: Props) {
  const readOnly = Boolean(initial && !initial.isEditable);
  const [name, setName] = useState(initial?.name ?? "");
  const [description, setDescription] = useState(initial?.description ?? "");
  const [permissions, setPermissions] = useState<PermissionMap>(() =>
    Object.fromEntries(modules.map((module) => [module.key, { ...EMPTY_SET, ...(initial?.permissions[module.key] ?? {}) }])));
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const toggle = (module: string, action: PermissionAction, checked: boolean) => setPermissions((current) => {
    const set = { ...(current[module] ?? EMPTY_SET), [action]: checked };
    if (action !== "view" && checked) set.view = true;
    if (action === "view" && !checked) { set.create = false; set.update = false; set.delete = false; }
    return { ...current, [module]: set };
  });

  const applyPreset = (preset: "all" | "view" | "none") => setPermissions(Object.fromEntries(modules.map((module) => {
    const supports = (action: PermissionAction) => module.actions.includes(action);
    if (preset === "none") return [module.key, { ...EMPTY_SET }];
    if (preset === "view") return [module.key, { ...EMPTY_SET, view: true }];
    return [module.key, { view: true, create: supports("create"), update: supports("update"), delete: supports("delete") }];
  })));

  const submit = async () => {
    if (saving) return;
    if (!name.trim() || name.trim().length > 50) return setError("Isi nama role, maksimal 50 karakter.");
    setError("");
    setSaving(true);
    try {
      await onSave({ name: name.trim(), description: description.trim(), permissions });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Role belum dapat disimpan\n\nCoba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer title={!initial ? "New role" : readOnly ? initial.name : "Edit role"} subtitle={initial && !readOnly ? initial.name : undefined} onClose={onCancel} ariaLabel="Role">
      {readOnly && (
        <p className="rounded-md bg-slate-50 px-3 py-2 text-xs leading-5 text-slate-600">
          {initial?.name === "Admin"
            ? "Admin is a system role with full access to every page, including Users & Roles. It cannot be changed."
            : "This is a system role used for automated import. It has no page access and cannot be changed."}
        </p>
      )}

      <label className={ui.label}>
        Role name
        <input className={ui.input} maxLength={50} disabled={readOnly} value={name} onChange={(event) => setName(event.target.value)} />
      </label>
      <label className={ui.label}>
        Description
        <input className={ui.input} maxLength={200} disabled={readOnly} placeholder="Optional" value={description} onChange={(event) => setDescription(event.target.value)} />
      </label>

      <div>
        <div className="mb-2 flex items-center justify-between gap-2">
          <h3 className="text-sm font-semibold text-slate-900">Page access</h3>
          {!readOnly && (
            <div className="flex gap-1">
              <button type="button" className={ui.btnLink} onClick={() => applyPreset("all")}>All access</button>
              <button type="button" className={ui.btnLink} onClick={() => applyPreset("view")}>View only</button>
              <button type="button" className={ui.btnLink} onClick={() => applyPreset("none")}>None</button>
            </div>
          )}
        </div>
        <div className="overflow-x-auto rounded-md border border-slate-200">
          <table className={ui.table}>
            <thead>
              <tr>
                <th className={ui.th}>Page</th>
                {COLUMNS.map((column) => <th key={column.action} className={`${ui.th} text-center`}>{column.label}</th>)}
              </tr>
            </thead>
            <tbody>
              {modules.map((module) => (
                <tr key={module.key}>
                  <td className={`${ui.td} font-medium text-slate-800`}>{module.label}</td>
                  {COLUMNS.map((column) => {
                    const supported = module.actions.includes(column.action);
                    return (
                      <td key={column.action} className={`${ui.td} text-center`}>
                        {supported ? (
                          <input
                            type="checkbox"
                            className="h-4 w-4 accent-brand-600"
                            aria-label={`${module.label}: ${column.label}`}
                            disabled={readOnly}
                            checked={permissions[module.key]?.[column.action] === true}
                            onChange={(event) => toggle(module.key, column.action, event.target.checked)}
                          />
                        ) : <span className="text-slate-300" aria-label="Not applicable">—</span>}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-2 text-2xs leading-4 text-slate-500">
          Insert, Update and Delete include View. Dashboard and Setup are read-only pages. Pages that use data from other pages (for example Schedule) keep working without View on those pages.
        </p>
      </div>

      {error && <div role="alert" className={ui.bannerError}>{error}</div>}

      <div className="mt-2 flex justify-end gap-2.5">
        <button type="button" className={ui.btnSecondary} onClick={onCancel}>{readOnly ? "Close" : "Cancel"}</button>
        {!readOnly && <button type="button" className={ui.btnPrimary} disabled={saving} onClick={() => void submit()}>{saving ? "Saving..." : initial ? "Save changes" : "Create role"}</button>}
      </div>
    </Drawer>
  );
}
