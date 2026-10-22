import { useEffect, useState, type FormEvent } from "react";
import { notify } from "./Notification";
import type { HotRunner, HotRunnerDraft, WarehouseOption } from "../types";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";
import { Drawer } from "./Drawer";

interface Props {
  initial?: HotRunner | null;
  machineOptions: string[];
  warehouseOptions: WarehouseOption[];
  onSave: (draft: HotRunnerDraft) => Promise<void>;
  onCancel: () => void;
}

const emptyDraft = (): HotRunnerDraft => ({
  machine: "AOKI",
  warehouseCode: "WH01-2",
  cavity: 2,
  stock: 0,
});

const toDraft = (hotRunner: HotRunner): HotRunnerDraft => ({
  machine: hotRunner.machine,
  warehouseCode: hotRunner.warehouseCode,
  cavity: hotRunner.cavity,
  stock: hotRunner.stock,
});

export function HotRunnerForm({ initial, machineOptions, warehouseOptions, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<HotRunnerDraft>(initial ? toDraft(initial) : emptyDraft());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(initial ? toDraft(initial) : emptyDraft());
    setError("");
  }, [initial]);

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();

    if (!draft.machine.trim() || draft.cavity < 1 || draft.stock < 0) {
      setError("Isi machine, cavity minimal 1, dan stock minimal 0 sebelum menyimpan.");
      return;
    }

    setSaving(true);
    setError("");
    try {
      await onSave({ ...draft, machine: draft.machine.trim() });
    } catch (cause) {
      notify("error", cause instanceof Error ? cause.message : "Hot runner belum dapat disimpan.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Drawer
      title={initial ? "Edit hot runner" : "New hot runner"}
      onClose={onCancel}
      ariaLabel="Hot runner"
    >
      <form className="space-y-5" onSubmit={handleSubmit}>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <label className={ui.label}>
            Machine
            <input
              required
              list="hot-runner-machines"
              className={ui.input}
              placeholder="AOKI"
              value={draft.machine}
              onChange={(event) => setDraft({ ...draft, machine: event.target.value })}
            />
            <datalist id="hot-runner-machines">
              {machineOptions.map((machine) => <option key={machine} value={machine} />)}
            </datalist>
          </label>

          <label className={ui.label}>
            Location
            <Select
              value={draft.warehouseCode}
              onChange={(warehouseCode) => setDraft({ ...draft, warehouseCode })}
              options={warehouseOptions.map((warehouse) => ({
                value: warehouse.code,
                label: warehouse.name,
              }))}
            />
          </label>

          <label className={ui.label}>
            Cavity
            <input
              required
              min={1}
              step={1}
              type="number"
              className={ui.input}
              value={draft.cavity}
              onChange={(event) => setDraft({ ...draft, cavity: Number(event.target.value) })}
            />
          </label>

          <label className={ui.label}>
            Stock
            <input
              required
              min={0}
              step={1}
              type="number"
              className={ui.input}
              value={draft.stock}
              onChange={(event) => setDraft({ ...draft, stock: Number(event.target.value) })}
            />
          </label>
        </div>

        {error && <div className={ui.bannerError}>{error}</div>}

        <div className="flex justify-end gap-2.5">
          <button type="button" className={ui.btnSecondary} onClick={onCancel}>
            Cancel
          </button>
          <button type="submit" className={ui.btnPrimary} disabled={saving}>
            {saving ? "Saving..." : initial ? "Save changes" : "Add hot runner"}
          </button>
        </div>
      </form>
    </Drawer>
  );
}
