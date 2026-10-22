import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { Drawer } from "./Drawer";
import { api } from "../api/client";
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
interface ManualProduct { code: string; name: string }
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
  const [products, setProducts] = useState<ManualProduct[]>([]);
  const [productsLoading, setProductsLoading] = useState(true);
  const [productsError, setProductsError] = useState("");
  const [productsRetry, setProductsRetry] = useState(0);

  useEffect(() => setDraft(initial ?? emptyDraft()), [initial]);
  useEffect(() => {
    let active = true;
    api<ManualProduct[]>("/orders/manual-products")
      .then((items) => { if (active) { setProducts(items); setProductsError(""); } })
      .catch((cause) => { if (active) setProductsError(cause instanceof Error ? cause.message : "Daftar produk tidak dapat dimuat."); })
      .finally(() => { if (active) setProductsLoading(false); });
    return () => { active = false; };
  }, [productsRetry]);

  const patch = (fields: Partial<OrderDraft>) => setDraft((current) => ({ ...current, ...fields }));
  const patchLine = (id: string, fields: Partial<OrderLineItem>) => patch({
    items: draft.items.map((line) => line.id === id ? { ...line, ...fields } : line),
  });

  const save = async () => {
    if (!draft.customerName.trim()) return setError("Isi nama customer sebelum menyimpan.");
    if (draft.items.some((line) => !line.description.trim() || line.qty <= 0))
      return setError("Isi nama produk dan jumlah lebih dari nol untuk setiap item.");
    setError("");
    setSaving(true);
    const saved = await onSave(draft);
    setSaving(false);
    if (saved) onCancel();
  };

  const generatedNumber = initial?.orderNo || "[auto]";
  const generatedPurchaseOrder = initial?.customerPoNo || `${draft.sourceType.startsWith("MR") ? "MR" : "MF"}-${generatedNumber}`;
  const productOptions = products.map((product) => ({
    value: product.name,
    label: product.name,
  }));

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
          <thead><tr><th className={ui.th}>Item code</th><th className={ui.th}>Product</th><th className={ui.th}>Qty</th><th className={ui.th}></th></tr></thead>
          <tbody>{draft.items.map((line) => <tr key={line.id}>
            <td className={ui.td}><input className={ui.cx(ui.inputSm, "cursor-not-allowed read-only:bg-slate-100 read-only:text-slate-500")} value={line.itemCode ?? ""} placeholder="Auto" readOnly /></td>
            <td className={ui.td}><Select
              value={line.description}
              onChange={(value) => {
                const product = products.find((item) => item.name === value);
                if (product) patchLine(line.id, { itemCode: product.code, description: product.name });
              }}
              options={line.description && !productOptions.some((option) => option.value === line.description)
                ? [{ value: line.description, label: line.description }, ...productOptions]
                : productOptions}
              placeholder={productsLoading ? "Memuat produk..." : "Cari nama produk"}
              maxVisible={80}
              portal
              buttonClassName={ui.inputSm}
              disabled={productsLoading || !!productsError}
            /></td>
            <td className={ui.td}><input className={ui.cx(ui.inputSm, "w-24 text-right")} type="number" min="0" value={line.qty} onChange={(event) => patchLine(line.id, { qty: Number(event.target.value) })} /></td>
            <td className={ui.td}><button type="button" className={ui.btnLinkDanger} disabled={draft.items.length === 1} onClick={() => patch({ items: draft.items.filter((item) => item.id !== line.id) })}><Trash2 size={14} /></button></td>
          </tr>)}</tbody>
        </table>
      </div>

      {productsError && <div className={ui.bannerError}>Daftar produk gagal dimuat. {productsError} <button type="button" className="underline" onClick={() => { setProductsLoading(true); setProductsRetry((value) => value + 1); }}>Coba lagi</button></div>}
      {error && <div className={ui.bannerError}>{error}</div>}
      <div className="flex justify-end gap-2.5">
        <button type="button" className={ui.btnSecondary} onClick={onCancel}>Cancel</button>
        <button type="button" className={ui.btnPrimary} disabled={saving || !initial && (productsLoading || !!productsError)} onClick={() => void save()}>{saving ? "Saving..." : initial ? "Save changes" : "Create order"}</button>
      </div>
    </Drawer>
  );
}
