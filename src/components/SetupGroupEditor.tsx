import { useState } from "react";
import type { Machine, MaintenanceWindow, MaintenanceWindowDraft } from "../types";
import { wibInputDate, wibInputTime, wibInputDateTime, toJakartaDateTime } from "../utils/dateFormat";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";

export function SetupGroupEditor({ setup, machines, onSave, disabled = false }: {
  setup: MaintenanceWindow;
  machines: Machine[];
  onSave: (draft: MaintenanceWindowDraft) => Promise<boolean>;
  disabled?: boolean;
}) {
  const [machineId, setMachineId] = useState(setup.machineId);
  const [startDate, setStartDate] = useState(wibInputDate(setup.startAt));
  const [startTime, setStartTime] = useState(wibInputTime(setup.startAt));
  const [saving, setSaving] = useState(false);
  const startAt = startDate === wibInputDate(setup.startAt) && startTime === wibInputTime(setup.startAt) ? setup.startAt : wibInputDateTime(startDate, startTime);
  const endMillis = Date.parse(startAt) + Date.parse(setup.endAt) - Date.parse(setup.startAt);
  const endAt = Number.isFinite(endMillis) ? toJakartaDateTime(endMillis) : "";
  const invalid = !startDate || !startTime || !Number.isFinite(endMillis) || endMillis <= Date.parse(startAt) || Date.parse(startAt) <= Date.now();
  return <details className={`${ui.card} mt-4`}>
    <summary className="cursor-pointer text-sm font-semibold text-black">Move group</summary>
    <div className="mt-4 space-y-3">
      <label className={ui.label}>Destination<Select value={machineId} onChange={setMachineId} options={machines.filter(x => x.isActive || x.id === setup.machineId).map(x => ({ value: x.id, label: x.lineCode }))} /></label>
      <div className="grid grid-cols-2 gap-3">
        <label className={ui.label}>Date<input type="date" className={ui.input} value={startDate} onChange={e => setStartDate(e.target.value)} /></label>
        <label className={ui.label}>Time (WIB)<input type="time" className={ui.input} value={startTime} onChange={e => setStartTime(e.target.value)} /></label>
      </div>
      {invalid && <p role="alert" className="text-xs text-red-600">Pilih tanggal dan jam setelah waktu saat ini.</p>}
      {disabled && <p role="status" className="text-xs text-slate-500">Simpan atau batalkan perubahan setup terlebih dahulu.</p>}
      <div className="flex justify-end"><button type="button" className={ui.btnPrimary} disabled={invalid || saving || disabled} onClick={async () => {
        setSaving(true);
        try { await onSave({ ...setup, machineId, startAt, endAt }); }
        finally { setSaving(false); }
      }}>{saving ? "Moving group..." : "Move group"}</button></div>
    </div>
  </details>;
}
