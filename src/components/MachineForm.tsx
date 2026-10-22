import { useEffect, useState } from "react";
import { api } from "../api/client";
import type { Machine, MachineDraft, WarehouseOption } from "../types";
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
  return {
    lineCode: "",
    name: "AOKI",
    machineType: "",
    warehouseCode: "",
    isActive: true,
  };
}

const toDraft = (machine: Machine): MachineDraft => ({
  lineCode: machine.lineCode,
  name: machine.name,
  machineType: machine.machineType,
  warehouseCode: machine.warehouseCode,
  isActive: machine.isActive,
});

const defaultWarehouseCode = (lineCode: string) => {
  const normalized = lineCode.trim().toUpperCase();

  if (normalized.startsWith("P1")) return "WH01-2";
  if (normalized.startsWith("P2")) return "WH03-2";
  return "";
};

export function MachineForm({ initial, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<MachineDraft>(initial ? toDraft(initial) : emptyDraft());
  const [error, setError] = useState<string | null>(null);
  const [warehouseOptions, setWarehouseOptions] = useState<WarehouseOption[]>([]);
  const [warehouseLoading, setWarehouseLoading] = useState(true);
  const [warehouseError, setWarehouseError] = useState(false);
  const [warehouseTouched, setWarehouseTouched] = useState(Boolean(initial));

  useEffect(() => {
    setDraft(initial ? toDraft(initial) : emptyDraft());
    setWarehouseTouched(Boolean(initial));
  }, [initial]);

  useEffect(() => {
    let active = true;

    setWarehouseLoading(true);
    setWarehouseError(false);

    void api<WarehouseOption[]>("/machines/warehouses")
      .then((options) => {
        if (active) setWarehouseOptions(options);
      })
      .catch(() => {
        if (active) setWarehouseError(true);
      })
      .finally(() => {
        if (active) setWarehouseLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const handleSave = () => {
    if (!draft.lineCode.trim() || !draft.name.trim() || !draft.machineType.trim() || !draft.warehouseCode) {
      setError("Isi kode, nama, jenis mesin, dan warehouse sebelum menyimpan.");
      return;
    }
    if (!/^[A-Za-z0-9-]+$/.test(draft.lineCode)) {
      setError("Kode mesin hanya boleh berisi huruf, angka, dan tanda -.");
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
            maxLength={30}
            onChange={(event) => {
              const lineCode = event.target.value;
              const deleting = (event.nativeEvent as InputEvent).inputType?.startsWith("delete")
                && lineCode.length < draft.lineCode.length;
              if (!/^[A-Za-z0-9-]*$/.test(lineCode) && !deleting) {
                setError("Kode mesin hanya boleh berisi huruf, angka, dan tanda -.");
                return;
              }
              setError(null);

              setDraft((current) => ({
                ...current,
                lineCode,
                warehouseCode: warehouseTouched
                  ? current.warehouseCode
                  : defaultWarehouseCode(lineCode),
              }));
            }}
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

      <label className={ui.label}>
        Warehouse
        <Select
          value={draft.warehouseCode}
          onChange={(warehouseCode) => {
            setWarehouseTouched(true);
            setDraft({ ...draft, warehouseCode });
          }}
          options={warehouseOptions.map((warehouse) => ({
            value: warehouse.code,
            label: warehouse.name,
          }))}
          disabled={warehouseLoading || warehouseError}
        />
      </label>

      <label className={ui.label}>
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

      {error && <div className={ui.bannerError}>{error}</div>}
      {warehouseError && (
        <div className={ui.bannerError}>
          Daftar warehouse belum dapat dimuat. Tutup drawer lalu coba lagi.
        </div>
      )}

      <div className="mt-2 flex justify-end gap-2.5">
        <button type="button" className={ui.btnSecondary} onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className={ui.btnPrimary}
          disabled={warehouseLoading || warehouseError}
          onClick={handleSave}
        >
          {initial ? "Save changes" : "Add machine"}
        </button>
      </div>
    </Drawer>
  );
}
