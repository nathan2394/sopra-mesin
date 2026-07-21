import { useEffect, useState } from "react";
import type { Machine, MachineDraft } from "../types";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";

const MACHINE_TYPE_OPTIONS = [
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
  return { lineCode: "", name: "", machineType: "AOKI", allocatedCavity: 8, isActive: true };
}

export function MachineForm({ initial, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<MachineDraft>(initial ?? emptyDraft());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initial ?? emptyDraft());
  }, [initial]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.lineCode.trim() || !draft.name.trim()) {
      setError("Line code and machine name are required.");
      return;
    }
    setError(null);
    onSave(draft);
  };

  return (
    <Modal onClose={onCancel} onSubmit={handleSubmit}>
      <h2 className="mb-1 text-[1.15rem]">{initial ? "Edit machine" : "New machine"}</h2>

      <div className="grid grid-cols-2 gap-3">
        <label className={ui.label}>
          Line code
          <input
            className={ui.input}
            placeholder="P1-AK-7"
            value={draft.lineCode}
            onChange={(e) => setDraft({ ...draft, lineCode: e.target.value })}
          />
        </label>
        <label className={ui.label}>
          Machine type
          <Select
            value={draft.machineType}
            onChange={(v) => setDraft({ ...draft, machineType: v })}
            options={MACHINE_TYPE_OPTIONS}
          />
        </label>
      </div>

      <label className={ui.label}>
        Name
        <input
          className={ui.input}
          placeholder="AOKI 250-7"
          value={draft.name}
          onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        />
      </label>

      <div className="grid grid-cols-2 gap-3">
        <label className={ui.label}>
          Allocated cavity
          <input
            className={ui.input}
            type="number"
            min={1}
            value={draft.allocatedCavity}
            onChange={(e) => setDraft({ ...draft, allocatedCavity: Number(e.target.value) })}
          />
        </label>
        <label className={ui.cx(ui.label, "justify-center")}>
          &nbsp;
          <span className="flex items-center gap-2 text-sm text-slate-800">
            <input
              type="checkbox"
              className="h-4 w-4 accent-blue-600"
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
        <button type="submit" className={ui.btnPrimary}>{initial ? "Save changes" : "Add machine"}</button>
      </div>
    </Modal>
  );
}
