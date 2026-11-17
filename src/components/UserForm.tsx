import { useState } from "react";
import { Drawer } from "./Drawer";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";
import type { AdminRole, AdminUser } from "../auth/permissions";

export interface UserDraft {
  username: string;
  email: string;
  password: string;
  role: string;
  isActive: boolean;
}

interface Props {
  initial: AdminUser | null;
  roles: AdminRole[];
  selfUsername: string;
  onSave: (draft: UserDraft) => Promise<void>;
  onCancel: () => void;
}

export function UserForm({ initial, roles, selfUsername, onSave, onCancel }: Props) {
  const editing = Boolean(initial);
  const isSelf = editing && initial?.username === selfUsername;
  const assignable = roles.filter((role) => role.name.toLowerCase() !== "scheduler");
  const [draft, setDraft] = useState<UserDraft>({
    username: initial?.username ?? "",
    email: initial?.email ?? "",
    password: "",
    role: initial?.role ?? assignable.find((role) => role.name === "Viewer")?.name ?? "",
    isActive: initial?.isActive ?? true,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    if (!editing && !draft.username.trim()) return setError("Isi username, maksimal 50 karakter.");
    if (!/^\S+@\S+\.\S+$/.test(draft.email.trim())) return setError("Gunakan alamat email yang valid.");
    if (!draft.role) return setError("Pilih role untuk pengguna ini.");
    if (!editing && (draft.password.length < 15 || draft.password.length > 128))
      return setError("Password harus terdiri dari 15–128 karakter. Boleh berupa beberapa kata yang mudah diingat.");
    setError("");
    setSaving(true);
    try {
      await onSave({ ...draft, username: draft.username.trim(), email: draft.email.trim() });
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Pengguna belum dapat disimpan\n\nCoba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer title={editing ? "Edit user" : "New user"} subtitle={editing ? initial?.username : undefined} onClose={onCancel} ariaLabel="User">
      {!editing && (
        <label className={ui.label}>
          Username
          <input className={ui.input} maxLength={50} autoComplete="off" value={draft.username} onChange={(event) => setDraft({ ...draft, username: event.target.value })} />
        </label>
      )}

      <label className={ui.label}>
        Email
        <input className={ui.input} type="email" maxLength={150} autoComplete="off" value={draft.email} onChange={(event) => setDraft({ ...draft, email: event.target.value })} />
      </label>

      <div className={ui.label}>
        Role
        <Select
          value={draft.role}
          onChange={(role) => setDraft({ ...draft, role })}
          options={assignable.map((role) => ({ value: role.name, label: role.name }))}
          placeholder="Select a role"
          disabled={isSelf}
        />
      </div>

      {!editing && (
        <label className={ui.label}>
          Initial password
          <input className={ui.input} type={showPassword ? "text" : "password"} minLength={15} maxLength={128} autoComplete="new-password" value={draft.password} onChange={(event) => setDraft({ ...draft, password: event.target.value })} />
          <span className="mt-1 flex items-center gap-2 text-2xs font-normal text-slate-500">
            <input type="checkbox" className="h-3.5 w-3.5 accent-brand-600" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
            Show password
          </span>
        </label>
      )}

      {editing && (
        <label className={ui.label}>
          <span className="flex items-center gap-2 text-sm text-slate-800">
            <input type="checkbox" className="h-4 w-4 accent-brand-600" checked={draft.isActive} disabled={isSelf} onChange={(event) => setDraft({ ...draft, isActive: event.target.checked })} />
            Active
          </span>
        </label>
      )}

      {isSelf && <p className="text-xs text-slate-500">You cannot change your own role or deactivate your own account.</p>}
      {error && <div role="alert" className={ui.bannerError}>{error}</div>}

      <div className="mt-2 flex justify-end gap-2.5">
        <button type="button" className={ui.btnSecondary} onClick={onCancel}>Cancel</button>
        <button type="button" className={ui.btnPrimary} disabled={saving} onClick={() => void submit()}>
          {saving ? "Saving..." : editing ? "Save changes" : "Create user"}
        </button>
      </div>
    </Drawer>
  );
}

interface ResetProps {
  user: AdminUser;
  onSave: (password: string) => Promise<void>;
  onCancel: () => void;
}

export function ResetPasswordDrawer({ user, onSave, onCancel }: ResetProps) {
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    if (saving) return;
    if (password.length < 15 || password.length > 128) return setError("Password harus terdiri dari 15–128 karakter.");
    setError("");
    setSaving(true);
    try {
      await onSave(password);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Password belum dapat direset\n\nCoba lagi.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer title="Reset password" subtitle={user.username} onClose={onCancel} ariaLabel="Reset password">
      <p className="text-xs leading-5 text-slate-500">
        Set a new password for this account. Every session the user has open is signed out, and they must use the new password next time.
      </p>
      <label className={ui.label}>
        New password
        <input className={ui.input} type={showPassword ? "text" : "password"} minLength={15} maxLength={128} autoComplete="new-password" value={password} onChange={(event) => setPassword(event.target.value)} />
        <span className="mt-1 flex items-center gap-2 text-2xs font-normal text-slate-500">
          <input type="checkbox" className="h-3.5 w-3.5 accent-brand-600" checked={showPassword} onChange={(event) => setShowPassword(event.target.checked)} />
          Show password
        </span>
      </label>
      {error && <div role="alert" className={ui.bannerError}>{error}</div>}
      <div className="mt-2 flex justify-end gap-2.5">
        <button type="button" className={ui.btnSecondary} onClick={onCancel}>Cancel</button>
        <button type="button" className={ui.btnPrimary} disabled={saving} onClick={() => void submit()}>{saving ? "Saving..." : "Reset password"}</button>
      </div>
    </Drawer>
  );
}
