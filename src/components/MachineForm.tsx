import { useEffect, useState } from "react";
import type { Machine, MachineDraft } from "../types";
import { Drawer } from "./Drawer";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";

const MACHINE_NAME_OPTIONS = [
  { value: "AOKI", label: "AOKI" },
  { value: "ASB", label: "ASB" },
  { value: "Dexter", label: "Dexter" },
];

interface Props {
  initial?: Machine | null;
  onSave: (draft: MachineDraft) => void;
  onCancel: () => void;
}

function emptyDraft(): MachineDraft {
  return { lineCode: "", name: "AOKI", machineType: "", allowedCavity: 8, isActive: true };
}

export function MachineForm({ initial, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<MachineDraft>(initial ?? emptyDraft());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initial ?? emptyDraft());
  }, [initial]);

  const handleSave = () => {
    if (!draft.lineCode.trim() || !draft.name.trim() || !draft.machineType.trim()) {
      setError("Machine code, name, and type are required.");
      return;
    }
    setError(null);
    onSave(draft);
  };

  return (
    <Drawer title={initial ? "Edit machine" : "New machine"} onClose={onCancel} ariaLabel="Machine">
      <div className="grid grid-cols-2 gap-3">
        <label className={ui.label}>
          Machine code
          <input
            className={ui.input}
            placeholder="P1-AK-7"
            value={draft.lineCode}
            onChange={(e) => setDraft({ ...draft, lineCode: e.target.value })}
          />
        </label>
        <label className={ui.label}>
          Name
          <Select
            value={draft.name}
            onChange={(v) => setDraft({ ...draft, name: v })}
            options={MACHINE_NAME_OPTIONS}
          />
        </label>
      </div>

      <label className={ui.label}>
        Machine type
        <input
          className={ui.input}
          placeholder="250-7"
          value={draft.machineType}
          onChange={(e) => setDraft({ ...draft, machineType: e.target.value })}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={ui.label}>
          Allowed cavity
          <input
            className={ui.input}
            type="number"
            min={1}
            value={draft.allowedCavity}
            onChange={(e) => setDraft({ ...draft, allowedCavity: Number(e.target.value) })}
          />
        </label>
        <label className={ui.cx(ui.label, "justify-center")}>
          &nbsp;
          <span className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 accent-brand-600"
              checked={draft.isActive}
              onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
            />
            Active
          </span>
        </label>
      </div>

      {error && <div className={ui.bannerError}>{error}</div>}

      <div className="mt-2 flex justify-end gap-2.5">
        <button type="button" className={ui.btnSecondary} onClick={onCancel}>Cancel</button>
        <button type="button" className={ui.btnPrimary} onClick={handleSave}>{initial ? "Save changes" : "Add machine"}</button>
      </div>
    </Drawer>
  );
}
