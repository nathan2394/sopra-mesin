import { useMemo, useState } from "react";
import { Plus, Wrench } from "lucide-react";
import { useProduction } from "../hooks/useProduction";
import { PageHeader } from "../components/PageHeader";
import { MachineForm } from "../components/MachineForm";
import { StatsRow, StatCard } from "../ui/StatCard";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";
import { MaintenanceType } from "../types";
import type { Machine, MachineDraft } from "../types";

export function MachinesPage() {
  const {
    machines,
    maintenanceWindows,
    scheduleJobs,
    addMachine,
    updateMachine,
    removeMachine,
    addMaintenanceWindow,
    removeMaintenanceWindow,
  } = useProduction();

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);

  const [mwMachineId, setMwMachineId] = useState<string>(machines[0]?.id ?? "");
  const [mwStart, setMwStart] = useState("");
  const [mwEnd, setMwEnd] = useState("");
  const [mwType, setMwType] = useState<MaintenanceType>(MaintenanceType.Planned);
  const [mwReason, setMwReason] = useState("");
  const [mwError, setMwError] = useState<string | null>(null);

  const stats = useMemo(() => {
    const active = machines.filter((m) => m.isActive).length;
    return { total: machines.length, active, inactive: machines.length - active, windows: maintenanceWindows.length };
  }, [machines, maintenanceWindows]);

  const jobsByMachine = useMemo(() => {
    const map = new Map<string, number>();
    scheduleJobs.forEach((j) => map.set(j.machineId, (map.get(j.machineId) ?? 0) + 1));
    return map;
  }, [scheduleJobs]);

  const machineLabel = (id: string) => machines.find((m) => m.id === id)?.lineCode ?? "—";

  const openAddForm = () => {
    setEditing(null);
    setFormOpen(true);
  };

  const openEditForm = (machine: Machine) => {
    setEditing(machine);
    setFormOpen(true);
  };

  const handleSaveMachine = (draft: MachineDraft) => {
    if (editing) updateMachine(editing.id, draft);
    else addMachine(draft);
    setFormOpen(false);
    setEditing(null);
  };

  const handleDeleteMachine = (machine: Machine) => {
    const jobCount = jobsByMachine.get(machine.id) ?? 0;
    const warning = jobCount > 0 ? ` This also removes ${jobCount} scheduled job(s) on it.` : "";
    if (window.confirm(`Delete machine ${machine.lineCode}?${warning}`)) {
      removeMachine(machine.id);
    }
  };

  const handleAddWindow = () => {
    if (!mwMachineId || !mwStart || !mwEnd) {
      setMwError("Pick a machine and both start/end times.");
      return;
    }
    if (new Date(mwEnd) <= new Date(mwStart)) {
      setMwError("End must be after start.");
      return;
    }
    setMwError(null);
    addMaintenanceWindow({
      machineId: mwMachineId,
      startAt: new Date(mwStart).toISOString(),
      endAt: new Date(mwEnd).toISOString(),
      type: mwType,
      reason: mwReason || undefined,
    });
    setMwStart("");
    setMwEnd("");
    setMwReason("");
  };

  return (
    <div className={ui.page}>
      <PageHeader
        breadcrumb={["Production", "Machines"]}
        title="Machines"
        subtitle="Manage the machine roster and log maintenance/downtime windows that block the schedule."
        actions={<button className={ui.btnPrimary} onClick={openAddForm}><Plus size={15} /> New machine</button>}
      />

      <StatsRow>
        <StatCard value={stats.total} label="Total machines" />
        <StatCard value={stats.active} label="Active" />
        <StatCard value={stats.inactive} label="Inactive" />
        <StatCard value={stats.windows} label="Maintenance windows" />
      </StatsRow>

      <div className={ui.cx(ui.tableCard, "mb-6")}>
        <table className={ui.table}>
          <thead>
            <tr>
              <th className={ui.th}>Line</th>
              <th className={ui.th}>Name</th>
              <th className={ui.th}>Type</th>
              <th className={ui.th}>Cavity</th>
              <th className={ui.th}>Status</th>
              <th className={ui.th}>Scheduled jobs</th>
              <th className={ui.th}></th>
            </tr>
          </thead>
          <tbody>
            {machines.map((m) => (
              <tr key={m.id} className="hover:bg-slate-50">
                <td className={ui.td}>{m.lineCode}</td>
                <td className={ui.td}>{m.name}</td>
                <td className={ui.td}><span className={ui.badgeNeutral}>{m.machineType}</span></td>
                <td className={ui.td}>{m.allocatedCavity}</td>
                <td className={ui.td}>
                  <span className={m.isActive ? ui.statusFulfilled : ui.statusCancelled}>
                    {m.isActive ? "Active" : "Inactive"}
                  </span>
                </td>
                <td className={ui.td}>{jobsByMachine.get(m.id) ?? 0}</td>
                <td className={ui.cx(ui.td, "text-right whitespace-nowrap")}>
                  <button className={ui.btnLink} onClick={() => openEditForm(m)}>Edit</button>
                  <button className={ui.btnLinkDanger} onClick={() => handleDeleteMachine(m)}>Delete</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={ui.card}>
        <div className="mb-3.5 flex items-center justify-between">
          <h2 className="flex items-center gap-1.5 text-[1.05rem]"><Wrench size={16} />Maintenance / downtime windows</h2>
        </div>

        <div className="mb-2.5 grid grid-cols-2 gap-3">
          <label className={ui.label}>
            Machine
            <Select
              value={mwMachineId}
              onChange={(v) => setMwMachineId(v)}
              options={machines.map((m) => ({ value: m.id, label: m.lineCode }))}
            />
          </label>
          <label className={ui.label}>
            Type
            <Select
              value={mwType}
              onChange={(v) => setMwType(v as MaintenanceType)}
              options={[
                { value: MaintenanceType.Planned, label: "Planned" },
                { value: MaintenanceType.Unplanned, label: "Unplanned" },
              ]}
            />
          </label>
        </div>
        <div className="mb-2.5 grid grid-cols-2 gap-3">
          <label className={ui.label}>
            Start
            <input className={ui.input} type="datetime-local" value={mwStart} onChange={(e) => setMwStart(e.target.value)} />
          </label>
          <label className={ui.label}>
            End
            <input className={ui.input} type="datetime-local" value={mwEnd} onChange={(e) => setMwEnd(e.target.value)} />
          </label>
        </div>
        <label className={ui.cx(ui.label, "mb-3")}>
          Reason
          <input className={ui.input} placeholder="Scheduled mold cleaning" value={mwReason} onChange={(e) => setMwReason(e.target.value)} />
        </label>

        {mwError && <div className={ui.cx(ui.bannerError, "mb-3")}>{mwError}</div>}
        <button className={ui.btnPrimary} onClick={handleAddWindow}><Plus size={15} /> Add window</button>

        <table className={ui.cx(ui.table, "mt-4")}>
          <thead>
            <tr>
              <th className={ui.th}>Machine</th><th className={ui.th}>Start</th><th className={ui.th}>End</th>
              <th className={ui.th}>Type</th><th className={ui.th}>Reason</th><th className={ui.th}></th>
            </tr>
          </thead>
          <tbody>
            {maintenanceWindows.map((w) => (
              <tr key={w.id} className="hover:bg-slate-50">
                <td className={ui.td}>{machineLabel(w.machineId)}</td>
                <td className={ui.td}>{new Date(w.startAt).toLocaleDateString()}</td>
                <td className={ui.td}>{new Date(w.endAt).toLocaleDateString()}</td>
                <td className={ui.td}>{w.type}</td>
                <td className={ui.td}>{w.reason ?? "—"}</td>
                <td className={ui.cx(ui.td, "text-right whitespace-nowrap")}>
                  <button className={ui.btnLinkDanger} onClick={() => removeMaintenanceWindow(w.id)}>Remove</button>
                </td>
              </tr>
            ))}
            {maintenanceWindows.length === 0 && (
              <tr><td colSpan={6} className={ui.cx(ui.td, ui.muted)}>No maintenance windows logged.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {formOpen && (
        <MachineForm
          initial={editing}
          onSave={handleSaveMachine}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
