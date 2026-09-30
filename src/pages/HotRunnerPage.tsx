import { useEffect, useState } from "react";
import { Plus } from "lucide-react";
import { api } from "../api/client";
import { HotRunnerForm } from "../components/HotRunnerForm";
import { notify } from "../components/Notification";
import { PageHeader } from "../components/PageHeader";
import type { HotRunner, HotRunnerDraft, WarehouseOption } from "../types";
import { DataTable } from "../ui/DataTable";
import { StatsRow, StatCard } from "../ui/StatCard";
import * as ui from "../ui/classNames";

export function HotRunnerPage() {
  const [rows, setRows] = useState<HotRunner[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reload, setReload] = useState(0);
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<HotRunner | null>(null);
  const [warehouses, setWarehouses] = useState<WarehouseOption[]>([]);
  const totalStock = rows.reduce((total, row) => total + row.stock, 0);
  const totalInUse = rows.reduce((total, row) => total + row.inUse, 0);
  const totalAvailable = rows.reduce((total, row) => total + row.available, 0);
  const critical = rows.filter((row) => row.available <= 0).length;

  useEffect(() => {
    let current = true;

    const load = async (initial = false) => {
      if (initial) setLoading(true);
      try {
        const data = await api<HotRunner[]>("/hot-runners");
        if (!current) return;
        setRows(data);
        setError("");
      } catch (cause) {
        if (current) {
          setError(
            cause instanceof Error
              ? cause.message
              : "Hot runner availability could not be loaded.",
          );
        }
      } finally {
        if (current && initial) setLoading(false);
      }
    };

    void load(true);
    const timer = window.setInterval(() => void load(), 30_000);
    return () => {
      current = false;
      window.clearInterval(timer);
    };
  }, [reload]);

  useEffect(() => {
    void api<WarehouseOption[]>("/machines/warehouses")
      .then(setWarehouses)
      .catch(() => setWarehouses([]));
  }, []);

  const save = async (draft: HotRunnerDraft) => {
    const saved = await api<HotRunner>(editing ? `/hot-runners/${editing.id}` : "/hot-runners", {
      method: "POST",
      body: JSON.stringify(draft),
    });

    setRows((current) => editing
      ? current.map((row) => row.id === saved.id ? saved : row)
      : [...current, saved]);
    setFormOpen(false);
    setEditing(null);
    setReload((value) => value + 1);
    notify("success", editing ? "Hot runner updated." : "Hot runner added.");
  };

  const remove = async (row: HotRunner) => {
    if (!window.confirm(`Delete ${row.machine} cavity ${row.cavity} at ${row.location}?`)) return;

    try {
      await api<void>(`/hot-runners/${row.id}`, { method: "DELETE" });
      setRows((current) => current.filter((item) => item.id !== row.id));
      notify("success", "Hot runner deleted.");
    } catch (cause) {
      notify("error", cause instanceof Error ? cause.message : "Hot runner belum dapat dihapus.");
    }
  };

  return (
    <div className={ui.page}>
      <PageHeader
        breadcrumb={[]}
        title="Hot Runner"
        subtitle="Live availability based on hot runners currently used by production."
        actions={(
          <button
            type="button"
            className={ui.btnPrimary}
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus size={15} /> New hot runner
          </button>
        )}
      />

      <StatsRow>
        <StatCard value={rows.length} label="Hot runner types" />
        <StatCard value={totalStock} label="Total stock" />
        <StatCard value={totalInUse} label="In use" />
        <StatCard value={totalAvailable} label="Available" />
        <StatCard value={critical} label="Unavailable" />
      </StatsRow>

      {error && (
        <div role="alert" className={`${ui.bannerError} mb-4`}>
          {error}
        </div>
      )}

      <DataTable
        rows={rows}
        rowKey={(row) => row.id}
        emptyText="No hot runner stock found."
        isLoading={loading}
        columns={[
          {
            key: "location",
            header: "Location",
            cell: (row) => <span className="font-semibold text-slate-800">{row.location}</span>,
          },
          { key: "machine", header: "Machine", cell: (row) => row.machine },
          {
            key: "machine-code",
            header: "Machine code",
            cell: (row) => (
              row.machineCodes.length ? (
                <div className="flex flex-wrap gap-1">
                  {row.machineCodes.map((code) => (
                    <span key={code} className={ui.badgeNeutral}>
                      {code}
                    </span>
                  ))}
                </div>
              ) : "—"
            ),
          },
          { key: "cavity", header: "Cavity", cell: (row) => row.cavity },
          { key: "stock", header: "Stock", cell: (row) => row.stock },
          { key: "in-use", header: "In use", cell: (row) => row.inUse },
          {
            key: "available",
            header: "Available",
            cell: (row) => (
              <span className={row.available > 0 ? ui.statusFulfilled : ui.statusCancelled}>
                {row.available}
              </span>
            ),
          },
          {
            key: "actions",
            header: "",
            className: "whitespace-nowrap text-right",
            cell: (row) => (
              <>
                <button
                  type="button"
                  className={ui.btnLink}
                  onClick={() => {
                    setEditing(row);
                    setFormOpen(true);
                  }}
                >
                  Edit
                </button>
                <button
                  type="button"
                  className={ui.btnLinkDanger}
                  onClick={() => void remove(row)}
                >
                  Delete
                </button>
              </>
            ),
          },
        ]}
      />

      {formOpen && (
        <HotRunnerForm
          initial={editing}
          machineOptions={[...new Set(rows.map((row) => row.machine))].sort()}
          warehouseOptions={warehouses}
          onSave={save}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
