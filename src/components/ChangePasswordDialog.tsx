import { useRef, useState, type FormEvent } from "react";
import { Description, Dialog, DialogBackdrop, DialogPanel, DialogTitle } from "@headlessui/react";
import { Check, Eye, EyeOff, KeyRound, LoaderCircle, X } from "lucide-react";
import { changePassword, currentUsername } from "../api/client";
import * as ui from "../ui/classNames";

export function ChangePasswordDialog({ onClose }: { onClose: () => void }) {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const inFlight = useRef(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (inFlight.current) return;
    setError("");
    if (newPassword !== confirmPassword) { setError("The passwords do not match. Re-enter your new password."); return; }
    if (newPassword === currentPassword) { setError("Choose a new password different from your current password."); return; }
    inFlight.current = true;
    setSaving(true);
    try {
      await changePassword({ currentPassword, newPassword, confirmPassword });
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      setSaved(true);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Your password could not be updated. Please try again.");
    } finally {
      inFlight.current = false;
      setSaving(false);
    }
  }

  return <Dialog open onClose={() => { if (!inFlight.current) onClose(); }} className="relative z-50">
    <DialogBackdrop className="fixed inset-0 bg-slate-950/30" />
    <div className="fixed inset-0 overflow-y-auto p-4 sm:p-6">
      <div className="flex min-h-full items-center justify-center">
        <DialogPanel className="w-full max-w-md rounded-2xl bg-white shadow-2xl">
          <div className="flex items-start justify-between gap-4 px-6 pt-6">
            <span className={ui.cx("grid size-11 place-items-center rounded-xl", saved ? "bg-emerald-50 text-emerald-600" : "bg-brand-50 text-brand-600")}>
              {saved ? <Check size={21} /> : <KeyRound size={21} />}
            </span>
            <button type="button" aria-label="Close change password" disabled={saving} onClick={onClose} className="rounded-lg p-2 text-slate-400 hover:bg-slate-50 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600 disabled:opacity-40"><X size={18} /></button>
          </div>
          <div className="px-6 pb-5 pt-4">
            <DialogTitle className="text-xl font-semibold tracking-tight text-slate-900">{saved ? "Password updated" : "Change password"}</DialogTitle>
            <Description className="mt-2 text-sm leading-6 text-slate-500">{saved
              ? "Your new password is ready. You stay signed in here; other sessions will need to sign in again."
              : "Update your Sopra Mesin password. Your Google account password stays the same."}</Description>
          </div>
          {saved ? <div className="border-t border-slate-100 px-6 py-4"><button autoFocus type="button" onClick={onClose} className={`${ui.btnPrimary} w-full justify-center py-2.5 text-sm`}>Done</button></div> : <form onSubmit={(event) => void submit(event)}>
            <div className="space-y-4 px-6 pb-6">
              <input type="text" name="username" autoComplete="username" value={currentUsername()} readOnly hidden />
              <PasswordField id="current-password" label="Current password" value={currentPassword} onChange={setCurrentPassword} autoComplete="current-password" maxLength={1024} disabled={saving} autoFocus />
              <PasswordField id="new-password" label="New password" value={newPassword} onChange={setNewPassword} autoComplete="new-password" minLength={15} maxLength={128} disabled={saving} hint="Use 15–128 characters. A memorable passphrase works well." />
              <PasswordField id="confirm-password" label="Confirm new password" value={confirmPassword} onChange={setConfirmPassword} autoComplete="new-password" minLength={15} maxLength={128} disabled={saving} />
              {error && <div role="alert" className="whitespace-pre-line rounded-lg border border-red-100 bg-red-50 px-3 py-2.5 text-xs leading-5 text-red-700">{error}</div>}
              <p className="text-xs leading-5 text-slate-500">Forgot your current app password? Contact your administrator.</p>
            </div>
            <div className="flex justify-end gap-2 border-t border-slate-100 px-6 py-4">
              <button type="button" disabled={saving} onClick={onClose} className={`${ui.btnSecondary} px-4 py-2.5`}>Cancel</button>
              <button type="submit" disabled={saving} className={`${ui.btnPrimary} justify-center px-4 py-2.5`}>
                {saving && <LoaderCircle size={15} className="animate-spin" />}{saving ? "Updating…" : "Update password"}
              </button>
            </div>
          </form>}
        </DialogPanel>
      </div>
    </div>
  </Dialog>;
}

interface PasswordFieldProps {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  autoComplete: "current-password" | "new-password";
  minLength?: number;
  maxLength: number;
  disabled: boolean;
  autoFocus?: boolean;
  hint?: string;
}

function PasswordField({ id, label, value, onChange, autoComplete, minLength, maxLength, disabled, autoFocus, hint }: PasswordFieldProps) {
  const [visible, setVisible] = useState(false);
  return <div>
    <label htmlFor={id} className="mb-1.5 block text-xs font-medium text-slate-700">{label}</label>
    <div className="relative">
      <input id={id} name={id} type={visible ? "text" : "password"} value={value} onChange={(event) => onChange(event.target.value)} autoComplete={autoComplete} required minLength={minLength} maxLength={maxLength} disabled={disabled} autoFocus={autoFocus} data-autofocus={autoFocus || undefined} aria-describedby={hint ? `${id}-hint` : undefined} className="h-11 w-full rounded-lg border border-slate-200 bg-white pl-3 pr-11 text-sm text-slate-900 outline-none focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50" />
      <button type="button" aria-label={`${visible ? "Hide" : "Show"} ${label.toLowerCase()}`} aria-pressed={visible} disabled={disabled} onClick={() => setVisible((value) => !value)} className="absolute inset-y-0 right-0 rounded-r-lg px-3 text-slate-400 hover:text-slate-700 focus-visible:outline-2 focus-visible:outline-brand-600">
        {visible ? <EyeOff size={17} /> : <Eye size={17} />}
      </button>
    </div>
    {hint && <p id={`${id}-hint`} className="mt-1.5 text-2xs leading-5 text-slate-500">{hint}</p>}
  </div>;
}
