import { useEffect, useState } from "react";
import { X } from "lucide-react";
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

interface ManualProduct { code: string; name: string }

function emptyDraft(): MachineDraft {
  return {
    lineCode: "",
    name: "AOKI",
    machineType: "",
    warehouseCode: "",
    isActive: true,
    bannedItems: [],
    dedicatedItems: [],
  };
}

const toDraft = (machine: Machine): MachineDraft => ({
  lineCode: machine.lineCode,
  name: machine.name,
  machineType: machine.machineType,
  warehouseCode: machine.warehouseCode,
  isActive: machine.isActive,
  bannedItems: machine.bannedItems ?? [],
  dedicatedItems: machine.dedicatedItems ?? [],
});

const defaultWarehouseCode = (lineCode: string) => {
  const normalized = lineCode.trim().toUpperCase();

  if (normalized.startsWith("P1")) return "WH01-2";
  if (normalized.startsWith("P2")) return "WH03-2";
  return "";
};

export function MachineForm({ initial, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<MachineDraft>(initial ? toDraft(initial) : emptyDraft());
  const [products, setProducts] = useState<ManualProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [productsRetry, setProductsRetry] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [warehouseOptions, setWarehouseOptions] = useState<WarehouseOption[]>([]);
  const [warehouseLoading, setWarehouseLoading] = useState(!initial);
  const [warehouseError, setWarehouseError] = useState(false);
  const [warehouseTouched, setWarehouseTouched] = useState(Boolean(initial));

  useEffect(() => {
    setDraft(initial ? toDraft(initial) : emptyDraft());
    setWarehouseTouched(Boolean(initial));
  }, [initial]);

  useEffect(() => {
    let active = true;
    api<ManualProduct[]>("/orders/manual-products")
      .then((items) => { if (active) { setProducts(items); setProductsError(""); } })
      .catch((cause) => { if (active) setProductsError(cause instanceof Error ? cause.message : "Daftar item tidak dapat dimuat."); })
      .finally(() => { if (active) setProductsLoading(false); });
    return () => { active = false; };
  }, [productsRetry]);

  useEffect(() => {
    if (initial) return;
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
  }, [initial]);

  const handleSave = () => {
    if (!initial && (!draft.lineCode.trim() || !draft.name.trim() || !draft.machineType.trim() || !draft.warehouseCode)) {
      setError("Isi kode, nama, jenis mesin, dan warehouse sebelum menyimpan.");
      return;
    }
    if (!initial && !/^[A-Za-z0-9-]+$/.test(draft.lineCode)) {
      setError("Kode mesin hanya boleh berisi huruf, angka, dan tanda -.");
      return;
    }
    setError(null);
    onSave(draft);
  };

  const productOptions = products.map((product) => ({
    value: product.code || product.name,
    label: product.code ? `${product.name} · ${product.code}` : product.name,
  }));

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
            disabled={Boolean(initial)}
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
            disabled={Boolean(initial)}
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
          disabled={Boolean(initial)}
          onChange={(e) => setDraft({ ...draft, machineType: e.target.value })}
        />
      </label>

      <label className={ui.label}>
        Warehouse
        {initial ? <input className={ui.input} value={draft.warehouseCode} disabled /> : (
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
        )}
      </label>

      <label className={ui.label}>
        <span className="flex items-center gap-2 text-sm text-slate-800">
          <input
            type="checkbox"
            className="h-4 w-4 accent-brand-600"
            checked={draft.isActive}
            disabled={Boolean(initial)}
            onChange={(e) => setDraft({ ...draft, isActive: e.target.checked })}
          />
          Active
        </span>
      </label>

      <label className={ui.label}>
        Banned items
        <Select
          value=""
          onChange={(value) => setDraft((current) => ({ ...current, bannedItems: [...current.bannedItems, value] }))}
          options={productOptions.filter((option) => !draft.bannedItems.includes(option.value))}
          placeholder={productsLoading ? "Memuat item..." : "Cari item"}
          maxVisible={80}
          fiveRowOptions
          portal
          buttonClassName={ui.input}
          disabled={productsLoading || Boolean(productsError)}
        />
      </label>

      {draft.bannedItems.length > 0 && <div className="flex flex-wrap gap-2">
        {draft.bannedItems.map((value) => <span key={value} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          <span className="truncate">{productOptions.find((option) => option.value === value)?.label ?? value}</span>
          <button type="button" aria-label={`Remove banned item ${value}`} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700" onClick={() => setDraft((current) => ({ ...current, bannedItems: current.bannedItems.filter((item) => item !== value) }))}><X size={14} /></button>
        </span>)}
      </div>}

      <label className={ui.label}>
        Dedicated items
        <Select
          value=""
          onChange={(value) => setDraft((current) => ({ ...current, dedicatedItems: [...current.dedicatedItems, value] }))}
          options={productOptions.filter((option) => !draft.dedicatedItems.includes(option.value))}
          placeholder={productsLoading ? "Memuat item..." : "Cari item"}
          maxVisible={80}
          fiveRowOptions
          portal
          buttonClassName={ui.input}
          disabled={productsLoading || Boolean(productsError)}
        />
      </label>

      {draft.dedicatedItems.length > 0 && <div className="flex flex-wrap gap-2">
        {draft.dedicatedItems.map((value) => <span key={value} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
          <span className="truncate">{productOptions.find((option) => option.value === value)?.label ?? value}</span>
          <button type="button" aria-label={`Remove dedicated item ${value}`} className="rounded-full p-0.5 text-slate-400 hover:bg-slate-200 hover:text-slate-700" onClick={() => setDraft((current) => ({ ...current, dedicatedItems: current.dedicatedItems.filter((item) => item !== value) }))}><X size={14} /></button>
        </span>)}
      </div>}

      {error && <div className={ui.bannerError}>{error}</div>}
      {productsError && <div className={ui.bannerError}>Daftar item gagal dimuat. {productsError} <button type="button" className="underline" onClick={() => { setProductsLoading(true); setProductsRetry((value) => value + 1); }}>Coba lagi</button></div>}
      {!initial && warehouseError && (
        <div className={ui.bannerError}>
          Daftar warehouse belum dapat dimuat. Tutup drawer lalu coba lagi.
        </div>
      )}

      <div className="mt-2 flex justify-end gap-2.5">
        <button type="button" className={ui.btnSecondary} onClick={onCancel}>Cancel</button>
        <button
          type="button"
          className={ui.btnPrimary}
          disabled={!initial && (warehouseLoading || warehouseError)}
          onClick={handleSave}
        >
          {initial ? "Save changes" : "Add machine"}
        </button>
      </div>
    </Drawer>
  );
}
