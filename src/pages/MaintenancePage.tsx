import { useEffect, useMemo, useRef, useState } from "react";
import { Download, Plus, Upload } from "lucide-react";
import { api } from "../api/client";
import { Drawer } from "../components/Drawer";
import { notify } from "../components/Notification";
import { PageHeader } from "../components/PageHeader";
import { useProduction } from "../hooks/useProduction";
import { useDebouncedValue } from "../hooks/useDebouncedValue";
import { MaintenanceType } from "../types";
import type { MaintenanceWindow } from "../types";
import { formatDate } from "../utils/dateFormat";
import { DataTable } from "../ui/DataTable";
import { CreatableSelect, MultiSelect, Select } from "../ui/Select";
import { StatsRow, StatCard } from "../ui/StatCard";
import * as ui from "../ui/classNames";

interface MaintenanceReason {
  id: number;
  maintenanceType: MaintenanceType;
  reason: string;
  duration: number;
  durationUnit: "Hours" | "Days";
}

type ScheduleType = "one-time" | "recurring";
type RepeatType = "weekly" | "monthly";
type DurationUnit = "hours" | "days";

const WEEKDAYS = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

const scheduleTypeButtonClass = "rounded px-3 py-1.5 text-xs font-semibold transition-colors";

interface DrawerProps {
  open: boolean;
  editingMaintenance: MaintenanceWindow | null;
  machineOptions: Array<{ id: string; lineCode: string; name: string; machineType: string }>;
  visibleReasons: MaintenanceReason[];
  mwMachineIds: string[];
  mwScheduleType: ScheduleType;
  mwRepeats: RepeatType;
  mwWeekdays: number[];
  mwDay: number;
  mwAt: string;
  mwDuration: number;
  mwDurationUnit: DurationUnit;
  mwStartsOn: string;
  mwType: MaintenanceType;
  mwReason: string;
  mwError: string | null;
  onClose: () => void;
  onSave: () => void;
  onMachineChange: (values: string[]) => void;
  onScheduleTypeChange: (value: ScheduleType) => void;
  onRepeatsChange: (value: RepeatType) => void;
  onWeekdayToggle: (day: number) => void;
  onDayChange: (value: number) => void;
  onAtChange: (value: string) => void;
  onDurationChange: (value: number) => void;
  onDurationUnitChange: (value: DurationUnit) => void;
  onStartsOnChange: (value: string) => void;
  onTypeChange: (value: MaintenanceType) => void;
  onReasonChange: (value: string) => void;
}

function MaintenanceScheduleDrawer({
  open,
  editingMaintenance,
  machineOptions,
  visibleReasons,
  mwMachineIds,
  mwScheduleType,
  mwRepeats,
  mwWeekdays,
  mwDay,
  mwAt,
  mwDuration,
  mwDurationUnit,
  mwStartsOn,
  mwType,
  mwReason,
  mwError,
  onClose,
  onSave,
  onMachineChange,
  onScheduleTypeChange,
  onRepeatsChange,
  onWeekdayToggle,
  onDayChange,
  onAtChange,
  onDurationChange,
  onDurationUnitChange,
  onStartsOnChange,
  onTypeChange,
  onReasonChange,
}: DrawerProps) {
  return (
    <Drawer
      open={open}
      title={editingMaintenance ? "Update Schedule" : "Add Schedule"}
      subtitle="Block machine time for planned work. Unplanned downtime is recorded automatically from Schedule."
      onClose={onClose}
      ariaLabel="Maintenance schedule"
    >
          <div className="flex justify-start">
            <div className={ui.segmentedWrap}>
              <button type="button" onClick={() => onScheduleTypeChange("one-time")} className={`${scheduleTypeButtonClass} ${mwScheduleType === "one-time" ? ui.segmentedBtnActive : ui.segmentedBtn}`}>One time</button>
              <button type="button" onClick={() => onScheduleTypeChange("recurring")} className={`${scheduleTypeButtonClass} ${mwScheduleType === "recurring" ? ui.segmentedBtnActive : ui.segmentedBtn}`}>Recurring</button>
            </div>
          </div>

          <label className={ui.label}>Machine
            {editingMaintenance ? (
              <Select value={mwMachineIds[0] ?? ""} onChange={(value) => onMachineChange([value])} options={machineOptions.map((machine) => ({ value: machine.id, label: `${machine.lineCode} — ${machine.name} ${machine.machineType}` }))} />
            ) : (
              <MultiSelect values={mwMachineIds} onChange={onMachineChange} options={machineOptions.map((machine) => ({ value: machine.id, label: `${machine.lineCode} — ${machine.name} ${machine.machineType}` }))} />
            )}
          </label>

          <div className="grid gap-4 md:grid-cols-2">
            <label className={ui.label}>Type
              <Select
                value={mwType}
                onChange={(value) => onTypeChange(value as MaintenanceType)}
                options={[
                  { value: MaintenanceType.Preventive, label: "Preventive Maintenance" },
                  { value: MaintenanceType.Corrective, label: "Corrective Maintenance" },
                  { value: MaintenanceType.Trial, label: "Trial Maintenance" },
                ]}
              />
            </label>
            <label className={ui.label}>Reason
              <CreatableSelect value={mwReason} onChange={onReasonChange} options={visibleReasons.map((item) => item.reason)} />
            </label>
          </div>

          <div className={ui.label}>Duration
            <div className="grid grid-cols-2 gap-2">
              <input className={ui.input} type="number" min="1" step="1" value={mwDuration} onChange={(event) => onDurationChange(Number(event.target.value))} />
              <Select value={mwDurationUnit} onChange={(value) => onDurationUnitChange(value as DurationUnit)} options={[{ value: "hours", label: "Hours" }, { value: "days", label: "Days" }]} />
            </div>
            <span className="font-normal text-slate-400">End is calculated from start + duration.</span>
          </div>

          {mwScheduleType === "recurring" ? (
            <>
              <div className="grid gap-4 md:grid-cols-2">
                <label className={ui.label}>At
                  <input className={ui.input} type="time" value={mwAt} onChange={(event) => onAtChange(event.target.value)} />
                </label>
                <label className={ui.label}>Repeats
                  <Select value={mwRepeats} onChange={(value) => onRepeatsChange(value as RepeatType)} options={[{ value: "weekly", label: "Weekly" }, { value: "monthly", label: "Monthly" }]} />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className={ui.label}>Starts on
                  <input className={ui.input} type="date" value={mwStartsOn} onChange={(event) => onStartsOnChange(event.target.value)} />
                </label>
                <div className={ui.label}>On
                  {mwRepeats === "monthly" ? (
                    <input className={ui.input} type="number" min="1" max="28" step="1" inputMode="numeric" value={mwDay} onChange={(event) => onDayChange(Number(event.target.value))} />
                  ) : (
                    <div className="flex min-h-8 flex-wrap items-center gap-1">
                      {WEEKDAYS.map((day) => <button key={day.value} type="button" aria-pressed={mwWeekdays.includes(day.value)} onClick={() => onWeekdayToggle(day.value)} className={`h-7 min-w-7 rounded-full px-2 text-xs font-semibold transition ${mwWeekdays.includes(day.value) ? "bg-brand-600 text-white" : "bg-slate-100 text-slate-600 hover:bg-slate-200"}`}>{day.label}</button>)}
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="grid gap-4 md:grid-cols-2">
              <label className={ui.label}>Starts on
                <input className={ui.input} type="date" value={mwStartsOn} onChange={(event) => onStartsOnChange(event.target.value)} />
              </label>
              <label className={ui.label}>At
                <input className={ui.input} type="time" value={mwAt} onChange={(event) => onAtChange(event.target.value)} />
              </label>
            </div>
          )}

          {mwError && <div className={ui.bannerError}>{mwError}</div>}

          <div className="flex justify-end gap-2">
            <button type="button" className={ui.btnSecondary} onClick={onClose}>Back</button>
            <button type="button" className={ui.btnPrimary} onClick={onSave}>{editingMaintenance ? "Update Schedule" : "Add Schedule"}</button>
          </div>
    </Drawer>
  );
}

export function MaintenancePage() {
  const [maintenancePage, setMaintenancePage] = useState(1);
  const [maintenanceSearch, setMaintenanceSearch] = useState("");
  const [maintenanceMachineFilter, setMaintenanceMachineFilter] = useState("All");
  const [maintenanceTypeFilter, setMaintenanceTypeFilter] = useState("All");
  const [maintenanceScheduleFilter, setMaintenanceScheduleFilter] = useState("All");
  const maintenanceSearchQuery = useDebouncedValue(maintenanceSearch.trim());
  const {
    machineOptions,
    maintenanceWindows,
    maintenancePagination,
    addMaintenanceWindows,
    updateMaintenanceWindow,
    removeMaintenanceWindow,
    isLoading,
    refreshMaintenance,
  } = useProduction({
    machineOptions: true,
    maintenance: {
      page: maintenancePage,
      pageSize: 15,
      search: maintenanceSearchQuery,
      machineId: maintenanceMachineFilter === "All" ? undefined : maintenanceMachineFilter,
      type: maintenanceTypeFilter === "All" ? undefined : maintenanceTypeFilter,
      scheduleType: maintenanceScheduleFilter === "All" ? undefined : maintenanceScheduleFilter,
    },
  });

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [editingMaintenance, setEditingMaintenance] = useState<MaintenanceWindow | null>(null);
  const [mwMachineIds, setMwMachineIds] = useState<string[]>([]);
  const [mwScheduleType, setMwScheduleType] = useState<ScheduleType>("recurring");
  const [mwRepeats, setMwRepeats] = useState<RepeatType>("monthly");
  const [mwWeekdays, setMwWeekdays] = useState([2]);
  const [mwDay, setMwDay] = useState(1);
  const [mwAt, setMwAt] = useState("09:00");
  const [mwDuration, setMwDuration] = useState(6);
  const [mwDurationUnit, setMwDurationUnit] = useState<DurationUnit>("hours");
  const [mwStartsOn, setMwStartsOn] = useState(new Date().toISOString().slice(0, 10));
  const [mwType, setMwType] = useState<MaintenanceType>(MaintenanceType.Preventive);
  const [mwReason, setMwReason] = useState("");
  const [maintenanceReasons, setMaintenanceReasons] = useState<MaintenanceReason[]>([]);
  const [mwError, setMwError] = useState<string | null>(null);
  const importInput = useRef<HTMLInputElement>(null);

  useEffect(() => {
    void api<MaintenanceReason[]>("/maintenance-reasons").then(setMaintenanceReasons).catch(() => setMaintenanceReasons([]));
  }, []);

  const visibleReasons = maintenanceReasons.filter((item) => item.maintenanceType === mwType);

  useEffect(() => {
    if (editingMaintenance && editingMaintenance.type === mwType) return;
    if (!visibleReasons.some((item) => item.reason === mwReason)) setMwReason(visibleReasons[0]?.reason ?? "");
  }, [mwType, maintenanceReasons, editingMaintenance]);

  useEffect(() => {
    if (editingMaintenance?.type === mwType && editingMaintenance.reason === mwReason) return;
    const selected = maintenanceReasons.find((item) => item.maintenanceType === mwType && item.reason === mwReason);
    if (selected) {
      setMwDuration(selected.duration);
      setMwDurationUnit(selected.durationUnit.toLowerCase() as DurationUnit);
    }
  }, [maintenanceReasons, mwReason, mwType, editingMaintenance]);

  useEffect(() => {
    if (maintenancePagination.totalPages > 0 && maintenancePage > maintenancePagination.totalPages) setMaintenancePage(maintenancePagination.totalPages);
  }, [maintenancePage, maintenancePagination.totalPages]);

  const stats = useMemo(() => ({
    total: maintenancePagination.totalItems,
    machines: machineOptions.length,
    oneTime: maintenanceWindows.filter((window) => window.scheduleType === "One Time").length,
    recurring: maintenanceWindows.filter((window) => window.scheduleType === "Recurring").length,
  }), [machineOptions.length, maintenancePagination.totalItems, maintenanceWindows]);

  const machineLabel = (id: string) => {
    const machine = machineOptions.find((row) => row.id === id);
    return machine ? `${machine.name} · ${machine.machineType}` : "—";
  };

  const resetForm = () => {
    setEditingMaintenance(null);
    setMwMachineIds([]);
    setMwScheduleType("recurring");
    setMwRepeats("monthly");
    setMwWeekdays([2]);
    setMwDay(1);
    setMwAt("09:00");
    setMwDuration(6);
    setMwDurationUnit("hours");
    setMwStartsOn(new Date().toISOString().slice(0, 10));
    setMwType(MaintenanceType.Preventive);
    setMwReason("");
    setMwError(null);
  };

  const openAddDrawer = () => {
    resetForm();
    setDrawerOpen(true);
  };

  const closeDrawer = () => {
    setDrawerOpen(false);
    setEditingMaintenance(null);
    setMwError(null);
  };

  const openEditMaintenance = (window: MaintenanceWindow) => {
    const start = new Date(window.startAt);
    const durationHours = (new Date(window.endAt).getTime() - start.getTime()) / 3_600_000;
    const weekdays = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
    setEditingMaintenance(window);
    setMwMachineIds([window.machineId]);
    setMwScheduleType(window.scheduleType === "Recurring" ? "recurring" : "one-time");
    setMwRepeats(window.repeatType === "Weekly" ? "weekly" : "monthly");
    setMwWeekdays(window.repeatValue?.split(",").map((day) => weekdays.indexOf(day.trim())).filter((day) => day >= 0) ?? []);
    setMwDay(Number(window.repeatValue) || start.getDate());
    setMwAt(`${String(start.getHours()).padStart(2, "0")}:${String(start.getMinutes()).padStart(2, "0")}`);
    setMwStartsOn(`${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, "0")}-${String(start.getDate()).padStart(2, "0")}`);
    setMwDuration(durationHours % 24 === 0 ? durationHours / 24 : durationHours);
    setMwDurationUnit(durationHours % 24 === 0 ? "days" : "hours");
    setMwType(window.type);
    setMwReason(window.reason ?? "");
    setMwError(null);
    setDrawerOpen(true);
  };

  const handleSaveWindow = async () => {
    if (mwMachineIds.length === 0 || !mwStartsOn || mwDuration < 1 || (mwScheduleType === "recurring" && ((mwRepeats === "monthly" && (mwDay < 1 || mwDay > 28)) || (mwRepeats === "weekly" && mwWeekdays.length === 0)))) {
      setMwError(mwMachineIds.length === 0 ? "Select at least one machine." : "Complete the schedule with a day from 1 to 28.");
      return;
    }

    const [hours, minutes] = mwAt.split(":").map(Number);
    const startsAt = new Date(`${mwStartsOn}T00:00:00`);
    startsAt.setHours(hours, minutes, 0, 0);

    if (mwScheduleType === "recurring" && mwRepeats === "monthly") {
      const base = new Date(startsAt);
      startsAt.setDate(Math.min(mwDay, new Date(startsAt.getFullYear(), startsAt.getMonth() + 1, 0).getDate()));
      if (startsAt < base) {
        startsAt.setMonth(startsAt.getMonth() + 1, 1);
        startsAt.setDate(Math.min(mwDay, new Date(startsAt.getFullYear(), startsAt.getMonth() + 1, 0).getDate()));
      }
    }

    if (mwScheduleType === "recurring" && mwRepeats === "weekly") {
      for (let offset = 0; offset < 7; offset += 1) {
        const candidate = new Date(startsAt);
        candidate.setDate(candidate.getDate() + offset);
        if (mwWeekdays.includes(candidate.getDay())) {
          startsAt.setTime(candidate.getTime());
          break;
        }
      }
    }

    const endsAt = new Date(startsAt.getTime() + mwDuration * (mwDurationUnit === "days" ? 86_400_000 : 3_600_000));
    const format = (date: Date) =>
      `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}T${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}:${String(date.getSeconds()).padStart(2, "0")}`;

    setMwError(null);
    const draft = {
      affectedScheduleId: editingMaintenance?.affectedScheduleId,
      startAt: format(startsAt),
      endAt: format(endsAt),
      type: mwType,
      reason: mwReason || undefined,
      scheduleType: mwScheduleType === "recurring" ? "Recurring" : "One Time",
      repeatType: mwScheduleType === "recurring" ? (mwRepeats === "weekly" ? "Weekly" : "Monthly") : undefined,
      repeatValue: mwScheduleType === "recurring" ? (mwRepeats === "weekly" ? mwWeekdays.map((day) => ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][day]).join(", ") : String(mwDay)) : undefined,
    } as const;

    const saved = editingMaintenance
      ? await updateMaintenanceWindow(editingMaintenance.id, { ...draft, machineId: mwMachineIds[0] })
      : await addMaintenanceWindows(mwMachineIds, draft);

    if (saved) closeDrawer();
  };

  return (
    <div className={ui.page}>
      <PageHeader
        breadcrumb={[]}
        title="Maintenance"
        subtitle="Maintenance and downtime windows."
        actions={
          <>
            <input ref={importInput} className="hidden" type="file" accept=".xlsx" onChange={async (event) => {
              const file = event.target.files?.[0];
              if (!file) return;
              const form = new FormData();
              form.append("file", file);
              try {
                const result = await api<{ imported: number; errors: string[] }>("/maintenance-windows/import", { method: "POST", body: form });
                await refreshMaintenance();
                notify(
                  result.errors.length ? "warning" : "success",
                  result.errors.length ? `${result.imported} imported. ${result.errors.join(" ")}` : `${result.imported} imported successfully.`,
                );
              } catch (cause) {
                notify("error", cause instanceof Error ? cause.message : "Import failed");
              }
              event.target.value = "";
            }} />
            <button className={ui.btnSecondary} type="button" onClick={() => importInput.current?.click()}><Upload size={15} /> Import xlsx</button>
            <a className={ui.btnSecondary} href="/maintenance-schedule-template.xlsx" download><Download size={15} /> Download Format</a>
            <button className={ui.btnPrimary} type="button" onClick={openAddDrawer}><Plus size={15} /> Add Schedule</button>
          </>
        }
      />

      <StatsRow>
        <StatCard value={stats.total} label="Maintenance windows" />
        <StatCard value={stats.recurring} label="Recurring" />
        <StatCard value={stats.oneTime} label="One time" />
        <StatCard value={stats.machines} label="Machines" />
      </StatsRow>

      <div className={ui.filtersRow}>
        <input className={ui.searchInput} placeholder="Search machine, type or reason..." value={maintenanceSearch} onChange={(event) => { setMaintenanceSearch(event.target.value); setMaintenancePage(1); }} />
        <Select
          value={maintenanceMachineFilter}
          onChange={(value) => { setMaintenanceMachineFilter(value); setMaintenancePage(1); }}
          buttonClassName={ui.filterSelectButton}
          options={[{ value: "All", label: "All machines" }, ...machineOptions.map((machine) => ({ value: machine.id, label: `${machine.lineCode} — ${machine.name} ${machine.machineType}` }))]}
        />
        <Select
          value={maintenanceTypeFilter}
          onChange={(value) => { setMaintenanceTypeFilter(value); setMaintenancePage(1); }}
          buttonClassName={ui.filterSelectButton}
          options={[
            { value: "All", label: "All types" },
            { value: MaintenanceType.Preventive, label: "Preventive Maintenance" },
            { value: MaintenanceType.Corrective, label: "Corrective Maintenance" },
            { value: MaintenanceType.Trial, label: "Trial Maintenance" },
          ]}
        />
        <Select
          value={maintenanceScheduleFilter}
          onChange={(value) => { setMaintenanceScheduleFilter(value); setMaintenancePage(1); }}
          buttonClassName={ui.filterSelectButton}
          options={[{ value: "All", label: "All patterns" }, { value: "One Time", label: "One time" }, { value: "Recurring", label: "Recurring" }]}
        />
        <span className={ui.muted}>{maintenanceWindows.length} of {maintenancePagination.totalItems} shown</span>
      </div>

      <DataTable
        rows={maintenanceWindows}
        rowKey={(window) => window.id}
        emptyText="No maintenance windows logged."
        columns={[
          { key: "machine", header: "Machine", cell: (window) => machineLabel(window.machineId) },
          { key: "type", header: "Type", cell: (window) => <span className={ui.badgeNeutral}>{window.type.replace(" Maintenance", "")}</span> },
          { key: "pattern", header: "Pattern", cell: (window) => window.scheduleType === "Recurring" ? `Every ${window.repeatType === "Monthly" ? `month, day ${window.repeatValue}` : `week, ${window.repeatValue}`} · ${new Date(window.startAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}-${new Date(window.endAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", hour12: false })}` : "One time" },
          { key: "next", header: "Next", cell: (window) => formatDate(window.startAt) },
          { key: "reason", header: "Reason", cell: (window) => window.reason ?? "—" },
          { key: "actions", header: "", className: "text-right whitespace-nowrap", cell: (window) => <><button className={ui.btnLink} onClick={() => openEditMaintenance(window)}>Edit</button><button className={ui.btnLinkDanger} onClick={() => removeMaintenanceWindow(window.id)}>Remove</button></> },
        ]}
        pagination={{ ...maintenancePagination, onPageChange: setMaintenancePage, label: "Maintenance" }}
        isLoading={isLoading}
      />

      <MaintenanceScheduleDrawer
        open={drawerOpen}
        editingMaintenance={editingMaintenance}
        machineOptions={machineOptions}
        visibleReasons={visibleReasons}
        mwMachineIds={mwMachineIds}
        mwScheduleType={mwScheduleType}
        mwRepeats={mwRepeats}
        mwWeekdays={mwWeekdays}
        mwDay={mwDay}
        mwAt={mwAt}
        mwDuration={mwDuration}
        mwDurationUnit={mwDurationUnit}
        mwStartsOn={mwStartsOn}
        mwType={mwType}
        mwReason={mwReason}
        mwError={mwError}
        onClose={closeDrawer}
        onSave={handleSaveWindow}
        onMachineChange={setMwMachineIds}
        onScheduleTypeChange={setMwScheduleType}
        onRepeatsChange={setMwRepeats}
        onWeekdayToggle={(day) => setMwWeekdays((values) => values.includes(day) ? values.filter((value) => value !== day) : [...values, day])}
        onDayChange={setMwDay}
        onAtChange={setMwAt}
        onDurationChange={setMwDuration}
        onDurationUnitChange={setMwDurationUnit}
        onStartsOnChange={setMwStartsOn}
        onTypeChange={setMwType}
        onReasonChange={setMwReason}
      />
    </div>
  );
}

