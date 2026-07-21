import { useEffect, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { OrderSourceType, OrderStatus } from "../types";
import type { Order, OrderDraft, OrderLineItem } from "../types";
import { computeOrderTotals, computeLeadTimeDays } from "../utils/orderMath";
import { Modal } from "../ui/Modal";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";

interface Props {
  initial?: Order | null;
  onSave: (draft: OrderDraft) => void;
  onCancel: () => void;
}

type Tab = "order" | "production" | "delivery";

const SOURCE_LABEL: Record<OrderSourceType, string> = {
  [OrderSourceType.SoPaid]: "SO — Paid",
  [OrderSourceType.ScUnpaid]: "SC — Unpaid (committed)",
  [OrderSourceType.PiUnpaid]: "PI — Unpaid (proforma)",
};

function toDateInputValue(iso?: string): string {
  if (!iso) return "";
  return iso.slice(0, 10);
}

function uid(): string {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `id-${Math.random().toString(36).slice(2)}-${Date.now()}`;
}

function emptyLineItem(): OrderLineItem {
  return {
    id: uid(),
    description: "",
    qty: 0,
    fob: 0,
    mp: undefined,
    carton: undefined,
    cbm: undefined,
  };
}

function emptyDraft(): OrderDraft {
  const todayIso = new Date().toISOString();
  return {
    sourceType: OrderSourceType.SoPaid,
    orderNo: "",
    poDate: todayIso,
    customerName: "",
    customerPoNo: "",
    poShipStart: todayIso,
    poShipEnd: todayIso,
    prodScheduleStart: undefined,
    prodScheduleEnd: undefined,
    deliveryDate: todayIso,
    orderDate: undefined,
    status: OrderStatus.Open,
    items: [emptyLineItem()],
  };
}

export function OrderForm({ initial, onSave, onCancel }: Props) {
  const [draft, setDraft] = useState<OrderDraft>(initial ?? emptyDraft());
  const [tab, setTab] = useState<Tab>("order");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setDraft(initial ?? emptyDraft());
    setTab("order");
  }, [initial]);

  const totals = computeOrderTotals(draft.items);
  const leadTime = computeLeadTimeDays(draft);

  const patch = (fields: Partial<OrderDraft>) => setDraft((d) => ({ ...d, ...fields }));

  const patchItem = (id: string, fields: Partial<OrderLineItem>) => {
    setDraft((d) => ({
      ...d,
      items: d.items.map((it) => (it.id === id ? { ...it, ...fields } : it)),
    }));
  };

  const addItem = () => setDraft((d) => ({ ...d, items: [...d.items, emptyLineItem()] }));

  const removeItem = (id: string) =>
    setDraft((d) => ({ ...d, items: d.items.length > 1 ? d.items.filter((it) => it.id !== id) : d.items }));

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!draft.customerName.trim() || !draft.customerPoNo.trim()) {
      setError("Customer and Customer PO # are required.");
      setTab("order");
      return;
    }
    if (draft.items.length === 0 || draft.items.some((it) => !it.description.trim() || it.qty <= 0)) {
      setError("Every line item needs a description and a positive Qty.");
      setTab("order");
      return;
    }
    setError(null);
    onSave(draft);
  };

  const tabBtn = (t: Tab, text: string) => (
    <button
      type="button"
      className={ui.cx(ui.segmentedBtn, tab === t && ui.segmentedBtnActive)}
      onClick={() => setTab(t)}
    >
      {text}
    </button>
  );

  return (
    <Modal onClose={onCancel} onSubmit={handleSubmit} wide>
      <h2 className="mb-1 text-[1.15rem]">{initial ? `Edit order · ${draft.orderNo}` : "New customer order"}</h2>

      <div className="grid grid-cols-3 gap-x-3.5 gap-y-2.5">
        <label className={ui.label}>
          Source
          <Select
            value={draft.sourceType}
            onChange={(v) => patch({ sourceType: v as OrderSourceType })}
            options={Object.values(OrderSourceType).map((s) => ({ value: s, label: SOURCE_LABEL[s] }))}
          />
        </label>
        <label className={ui.label}>
          Order No.
          <input className={ui.input} placeholder="auto on save" value={draft.orderNo} onChange={(e) => patch({ orderNo: e.target.value })} />
        </label>
        <label className={ui.label}>
          Status
          <Select
            value={draft.status}
            onChange={(v) => patch({ status: v as OrderStatus })}
            options={Object.values(OrderStatus).map((s) => ({ value: s, label: s }))}
          />
        </label>

        <label className={ui.label}>
          PO Date
          <input className={ui.input} type="date" value={toDateInputValue(draft.poDate)} onChange={(e) => patch({ poDate: new Date(e.target.value).toISOString() })} />
        </label>
        <label className={ui.label}>
          Customer
          <input className={ui.input} value={draft.customerName} onChange={(e) => patch({ customerName: e.target.value })} />
        </label>
        <label className={ui.label}>
          Customer PO #
          <input className={ui.input} value={draft.customerPoNo} onChange={(e) => patch({ customerPoNo: e.target.value })} />
        </label>
      </div>

      <div className="flex flex-wrap gap-2.5 rounded-md border border-slate-200 bg-slate-50 p-3.5">
        <div className="flex min-w-[100px] flex-col gap-0.5">
          <span className="text-[1.05rem] font-bold text-slate-800">{totals.qty.toLocaleString()}</span>
          <span className="text-[0.72rem] text-slate-500">Total Qty (pcs)</span>
        </div>
        <div className="flex min-w-[100px] flex-col gap-0.5">
          <span className="text-[1.05rem] font-bold text-slate-800">{totals.workHours}</span>
          <span className="text-[0.72rem] text-slate-500">Total Work Hour</span>
        </div>
        <div className="flex min-w-[100px] flex-col gap-0.5">
          <span className="text-[1.05rem] font-bold text-slate-800">{leadTime}</span>
          <span className="text-[0.72rem] text-slate-500">Lead Time (days)</span>
        </div>
      </div>

      <div className={ui.cx(ui.segmentedWrap, "self-start")}>
        {tabBtn("order", "Order")}
        {tabBtn("production", "Production")}
        {tabBtn("delivery", "Delivery Plan")}
      </div>

      {tab === "order" && (
        <div>
          <div className="mb-2 flex justify-end">
            <button type="button" className={ui.btnSecondary} onClick={addItem}><Plus size={14} /> Add item</button>
          </div>
          <div className="overflow-x-auto rounded-md border border-slate-200">
            <table className={ui.cx(ui.table, "min-w-[760px]")}>
              <thead>
                <tr>
                  <th className={ui.th}>Description</th>
                  <th className={ui.th}>Qty</th>
                  <th className={ui.th}>FOB</th>
                  <th className={ui.th}>MP</th>
                  <th className={ui.th}>Carton</th>
                  <th className={ui.th}>CBM</th>
                  <th className={ui.th}></th>
                </tr>
              </thead>
              <tbody>
                {draft.items.map((it) => (
                  <tr key={it.id}>
                    <td className={ui.td}><input className={ui.inputSm} value={it.description} onChange={(e) => patchItem(it.id, { description: e.target.value })} /></td>
                    <td className={ui.td}><input className={ui.cx(ui.inputSm, "w-16 text-right")} type="number" min={0} value={it.qty} onChange={(e) => patchItem(it.id, { qty: Number(e.target.value) })} /></td>
                    <td className={ui.td}><input className={ui.cx(ui.inputSm, "w-16 text-right")} type="number" min={0} step={0.01} value={it.fob} onChange={(e) => patchItem(it.id, { fob: Number(e.target.value) })} /></td>
                    <td className={ui.td}><input className={ui.cx(ui.inputSm, "w-16 text-right")} type="number" min={0} value={it.mp ?? ""} onChange={(e) => patchItem(it.id, { mp: e.target.value ? Number(e.target.value) : undefined })} /></td>
                    <td className={ui.td}><input className={ui.cx(ui.inputSm, "w-16 text-right")} type="number" min={0} value={it.carton ?? ""} onChange={(e) => patchItem(it.id, { carton: e.target.value ? Number(e.target.value) : undefined })} /></td>
                    <td className={ui.td}><input className={ui.cx(ui.inputSm, "w-16 text-right")} type="number" min={0} step={0.001} value={it.cbm ?? ""} onChange={(e) => patchItem(it.id, { cbm: e.target.value ? Number(e.target.value) : undefined })} /></td>
                    <td className={ui.td}>
                      <button type="button" className={ui.btnLinkDanger} onClick={() => removeItem(it.id)} disabled={draft.items.length <= 1}>
                        <Trash2 size={14} />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {tab === "production" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className={ui.label}>
              Prod. Schedule Start
              <input className={ui.input} type="date" value={toDateInputValue(draft.prodScheduleStart)} onChange={(e) => patch({ prodScheduleStart: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
            </label>
            <label className={ui.label}>
              Prod. Schedule End
              <input className={ui.input} type="date" value={toDateInputValue(draft.prodScheduleEnd)} onChange={(e) => patch({ prodScheduleEnd: e.target.value ? new Date(e.target.value).toISOString() : undefined })} />
            </label>
          </div>
          <p className={ui.muted}>
            Once this order is planned onto the Production Schedule, its jobs will show against machine "
            {draft.orderNo || "—"}" with the setup, run and milestone detail tracked there.
          </p>
        </div>
      )}

      {tab === "delivery" && (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-2 gap-3">
            <label className={ui.label}>
              PO Ship Start
              <input className={ui.input} type="date" value={toDateInputValue(draft.poShipStart)} onChange={(e) => patch({ poShipStart: new Date(e.target.value).toISOString() })} />
            </label>
            <label className={ui.label}>
              PO Ship End
              <input className={ui.input} type="date" value={toDateInputValue(draft.poShipEnd)} onChange={(e) => patch({ poShipEnd: new Date(e.target.value).toISOString() })} />
            </label>
          </div>
          <label className={ui.label}>
            Delivery date (Due / SLA)
            <input className={ui.input} type="date" value={toDateInputValue(draft.deliveryDate)} onChange={(e) => patch({ deliveryDate: new Date(e.target.value).toISOString() })} />
          </label>
          <p className={ui.muted}>
            Internal, external and Ship 1/2 milestones are set per production job on the Schedule board once this order is planned.
          </p>
        </div>
      )}

      {error && <div className={ui.bannerError}>{error}</div>}

      <div className="mt-2 flex justify-end gap-2.5">
        <button type="button" className={ui.btnSecondary} onClick={onCancel}>Cancel</button>
        <button type="submit" className={ui.btnPrimary}>{initial ? "Save changes" : "Create order"}</button>
      </div>
    </Modal>
  );
}
