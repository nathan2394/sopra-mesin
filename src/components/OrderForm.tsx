import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Drawer } from "./Drawer";
import { OrderSourceType } from "../types";
import type { Order, OrderDraft, OrderLineItem } from "../types";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";

interface Props {
  initial?: Order | null;
  onSave: (draft: OrderDraft) => Promise<boolean>;
  onCancel: () => void;
}

const MANUAL_SOURCES = [
  { value: OrderSourceType.ManualRequest, label: "Manual Request (MR)" },
  { value: OrderSourceType.ManualForecast, label: "Manual Forecast (MF)" },
];
const newLine = (): OrderLineItem => ({ id: crypto.randomUUID(), itemCode: "", description: "", qty: 0 });
const emptyDraft = (): OrderDraft => ({
  sourceType: OrderSourceType.ManualRequest,
  orderNo: "",
  poDate: "",
  customerName: "",
  customerPoNo: "",
  poShipStart: "",
  poShipEnd: "",
  deliveryDate: "",
  items: [newLine()],
});

export function OrderForm({ initial, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<OrderDraft>(initial ?? emptyDraft());
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => setDraft(initial ?? emptyDraft()), [initial]);

  const patch = (fields: Partial<OrderDraft>) => setDraft((current) => ({ ...current, ...fields }));
  const patchLine = (id: string, fields: Partial<OrderLineItem>) => patch({
    items: draft.items.map((line) => line.id === id ? { ...line, ...fields } : line),
  });

  const save = async () => {
    if (!draft.customerName.trim()) return setError("Customer is required.");
    if (draft.items.some((line) => !line.description.trim() || line.qty <= 0))
      return setError("Each item needs a description and quantity greater than zero.");
    setError("");
    setSaving(true);
    const saved = await onSave(draft);
    setSaving(false);
    if (saved) onCancel();
  };

  const generatedNumber = initial?.orderNo || "[auto]";
  const generatedPurchaseOrder = initial?.customerPoNo || `${draft.sourceType.startsWith("MR") ? "MR" : "MF"}-${generatedNumber}`;

  return (
    <Drawer title={initial ? `Edit order ${initial.orderNo}` : "New manual order"} subtitle="Manual orders are created as Unpaid." onClose={onCancel} widthClassName="max-w-[820px]">
      <div className="grid gap-3 sm:grid-cols-2">
        <label className={ui.label}>Purchase order number
          <input className={ui.input} value={generatedPurchaseOrder} disabled />
        </label>
        <label className={ui.label}>Order number
          <input className={ui.input} value={generatedNumber} disabled />
        </label>
        <label className={ui.label}>Source
          <Select value={draft.sourceType} onChange={(value) => patch({ sourceType: value as OrderSourceType })} options={MANUAL_SOURCES} disabled={!!initial} />
        </label>
        <label className={ui.label}>Customer
          <input className={ui.input} value={draft.customerName} onChange={(event) => patch({ customerName: event.target.value })} />
        </label>
        <label className={ui.label}>Order date
          <input className={ui.input} type="date" value={draft.poDate.slice(0, 10)} onChange={(event) => patch({ poDate: event.target.value })} />
        </label>
        <label className={ui.label}>Ship start
          <input className={ui.input} type="date" value={draft.poShipStart.slice(0, 10)} onChange={(event) => patch({ poShipStart: event.target.value })} />
        </label>
        <label className={ui.label}>Ship end
          <input className={ui.input} type="date" value={draft.poShipEnd.slice(0, 10)} onChange={(event) => patch({ poShipEnd: event.target.value })} />
        </label>
        <label className={ui.label}>Delivery date
          <input className={ui.input} type="date" value={draft.deliveryDate.slice(0, 10)} onChange={(event) => patch({ deliveryDate: event.target.value })} />
        </label>
      </div>

      <div className="flex items-center justify-between border-t border-slate-200 pt-4">
        <h3 className="text-sm font-semibold text-slate-900">Items</h3>
        <button type="button" className={ui.btnSecondary} onClick={() => patch({ items: [...draft.items, newLine()] })}><Plus size={14} /> Add item</button>
      </div>
      <div className="overflow-x-auto rounded-md border border-slate-200">
        <table className={ui.cx(ui.table, "min-w-[700px]")}>
          <thead><tr><th className={ui.th}>Item code</th><th className={ui.th}>Description</th><th className={ui.th}>Qty</th><th className={ui.th}></th></tr></thead>
          <tbody>{draft.items.map((line) => <tr key={line.id}>
            <td className={ui.td}><input className={ui.inputSm} value={line.itemCode ?? ""} onChange={(event) => patchLine(line.id, { itemCode: event.target.value })} /></td>
            <td className={ui.td}><input className={ui.inputSm} value={line.description} onChange={(event) => patchLine(line.id, { description: event.target.value })} /></td>
            <td className={ui.td}><input className={ui.cx(ui.inputSm, "w-24 text-right")} type="number" min="0" value={line.qty} onChange={(event) => patchLine(line.id, { qty: Number(event.target.value) })} /></td>
            <td className={ui.td}><button type="button" className={ui.btnLinkDanger} disabled={draft.items.length === 1} onClick={() => patch({ items: draft.items.filter((item) => item.id !== line.id) })}><Trash2 size={14} /></button></td>
          </tr>)}</tbody>
        </table>
      </div>

      {error && <div className={ui.bannerError}>{error}</div>}
      <div className="flex justify-end gap-2.5">
        <button type="button" className={ui.btnSecondary} onClick={onCancel}>Cancel</button>
        <button type="button" className={ui.btnPrimary} disabled={saving} onClick={() => void save()}>{saving ? "Saving..." : initial ? "Save changes" : "Create order"}</button>
      </div>
    </Drawer>
  );
}
