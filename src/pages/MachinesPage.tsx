import { useEffect, useMemo, useState } from "react";
import { Plus } from "lucide-react";
import { useProduction } from "../hooks/useProduction";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { PageHeader } from "../components/PageHeader";
import { MachineForm } from "../components/MachineForm";
import { StatsRow, StatCard } from "../ui/StatCard";
import { Select } from "../ui/Select";
import { DataTable } from "../ui/DataTable";
import * as ui from "../ui/classNames";
import type { Machine, MachineDraft } from "../types";

export function MachinesPage() {
  const [machinePage, setMachinePage] = useState(1);
  const [machineSearch, setMachineSearch] = useState("");
  const [machineTypeFilter, setMachineTypeFilter] = useState("All");
  const [machineStatusFilter, setMachineStatusFilter] = useState("All");
  const machineSearchQuery = useDebouncedValue(machineSearch.trim());
  const {
    machines,
    machineOptions,
    machinePagination,
    scheduleJobs,
    addMachine,
    updateMachine,
    removeMachine,
    isLoading,
  } = useProduction({
    machines: {
      page: machinePage,
      pageSize: 15,
      search: machineSearchQuery,
      type: machineTypeFilter === "All" ? undefined : machineTypeFilter,
      isActive: machineStatusFilter === "All" ? undefined : machineStatusFilter === "Active",
    },
    machineOptions: true,
    schedules: {},
  });

  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<Machine | null>(null);

  const stats = useMemo(() => {
    const active = machineOptions.filter((machine) => machine.isActive).length;
    return { total: machineOptions.length, active, inactive: machineOptions.length - active };
  }, [machineOptions]);

  const jobsByMachine = useMemo(() => {
    const map = new Map<string, number>();
    scheduleJobs.forEach((job) => map.set(job.machineId, (map.get(job.machineId) ?? 0) + 1));
    return map;
  }, [scheduleJobs]);

  useEffect(() => {
    if (machinePagination.totalPages > 0 && machinePage > machinePagination.totalPages) setMachinePage(machinePagination.totalPages);
  }, [machinePage, machinePagination.totalPages]);

  return (
    <div className={ui.page}>
      <PageHeader
        breadcrumb={[]}
        title="Machines"
        subtitle="Machine master data."
        actions={<button className={ui.btnPrimary} onClick={() => { setEditing(null); setFormOpen(true); }}><Plus size={15} /> New machine</button>}
      />

      <StatsRow>
        <StatCard value={stats.total} label="Total machines" />
        <StatCard value={stats.active} label="Active" />
        <StatCard value={stats.inactive} label="Inactive" />
        <StatCard value={scheduleJobs.length} label="Scheduled jobs" />
      </StatsRow>

      <div className={ui.filtersRow}>
        <input className={ui.searchInput} placeholder="Search line, name or type..." value={machineSearch} onChange={(event) => { setMachineSearch(event.target.value); setMachinePage(1); }} />
        <Select
          value={machineTypeFilter}
          onChange={(value) => { setMachineTypeFilter(value); setMachinePage(1); }}
          buttonClassName={ui.filterSelectButton}
          options={[{ value: "All", label: "All types" }, ...[...new Set(machineOptions.map((machine) => machine.machineType))].map((type) => ({ value: type, label: type }))]}
        />
        <Select
          value={machineStatusFilter}
          onChange={(value) => { setMachineStatusFilter(value); setMachinePage(1); }}
          buttonClassName={ui.filterSelectButton}
          options={[{ value: "All", label: "All statuses" }, { value: "Active", label: "Active" }, { value: "Inactive", label: "Inactive" }]}
        />
        <span className={ui.muted}>{machines.length} of {machinePagination.totalItems} shown</span>
      </div>

      <DataTable
        rows={machines}
        rowKey={(machine) => machine.id}
        columns={[
          { key: "line", header: "Line", cell: (machine) => machine.lineCode },
          { key: "name", header: "Name", cell: (machine) => machine.name },
          { key: "type", header: "Type", cell: (machine) => <span className={ui.badgeNeutral}>{machine.machineType}</span> },
          { key: "cavity", header: "Cavity", cell: (machine) => machine.allocatedCavity },
          { key: "status", header: "Status", cell: (machine) => <span className={machine.isActive ? ui.statusFulfilled : ui.statusCancelled}>{machine.isActive ? "Active" : "Inactive"}</span> },
          { key: "jobs", header: "Scheduled jobs", cell: (machine) => jobsByMachine.get(machine.id) ?? 0 },
          { key: "actions", header: "", className: "text-right whitespace-nowrap", cell: (machine) => <><button className={ui.btnLink} onClick={() => { setEditing(machine); setFormOpen(true); }}>Edit</button><button className={ui.btnLinkDanger} onClick={() => { const jobCount = jobsByMachine.get(machine.id) ?? 0; const warning = jobCount > 0 ? ` This also removes ${jobCount} scheduled job(s) on it.` : ""; if (window.confirm(`Delete machine ${machine.lineCode}?${warning}`)) void removeMachine(machine.id); }}>Delete</button></> },
        ]}
        pagination={{ ...machinePagination, onPageChange: setMachinePage, label: "Machines" }}
        isLoading={isLoading}
      />

      {formOpen && (
        <MachineForm
          initial={editing}
          onSave={async (draft: MachineDraft) => {
            const saved = editing
              ? await updateMachine(editing.id, draft)
              : await addMachine(draft);
            if (!saved) return;
            setFormOpen(false);
            setEditing(null);
          }}
          onCancel={() => {
            setFormOpen(false);
            setEditing(null);
          }}
        />
      )}
    </div>
  );
}
