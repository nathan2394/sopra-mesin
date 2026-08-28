import { useEffect, useState } from "react";
import { api } from "../api/client";
import { Drawer } from "./Drawer";
import { JobStatus, MaintenanceType } from "../types";
import type { Machine, MaintenanceWindow, ScheduleJob } from "../types";
import { CreatableSelect } from "../ui/CreatableSelect";
import { Select } from "../ui/Select";
import * as ui from "../ui/classNames";
import { formatDate, formatDateTime } from "../utils/dateFormat";

interface Props {
  job?: ScheduleJob;
  maintenance?: MaintenanceWindow;
  setupMaintenance?: MaintenanceWindow;
  linkedCorrectiveMaintenance?: MaintenanceWindow;
  linkedJob?: ScheduleJob;
  machine?: Machine;
  orderRef?: string;
  onSave?: (value: { isLocked: boolean; startAt?: string; endAt?: string; correctiveMaintenance?: { reason: string; estimatedHours: number } }) => Promise<boolean> | boolean;
  onClose: () => void;
}

interface DowntimeReason {
  id: number;
  reason: string;
  estimatedHours: number;
}

const inputDate = (value: string) => {
  const date = new Date(value);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
};

const inputTime = (value: string) => {
  const date = new Date(value);
  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
};

const mergeDateTime = (date: string, time: string) => `${date}T${time}:00`;
const displayDateTime = (value: string) => `${formatDateTime(value)} WIB`;

function LockIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M3.01491 11.0539C2.73856 11.0539 2.50208 10.9556 2.30545 10.759C2.10883 10.5623 2.01034 10.3257 2.01001 10.049V5.0245C2.01001 4.74815 2.10849 4.51167 2.30545 4.31504C2.50241 4.11841 2.7389 4.01993 3.01491 4.0196H3.51736V3.0147C3.51736 2.31964 3.76239 1.72725 4.25245 1.23753C4.74251 0.747805 5.3349 0.502777 6.02962 0.502442C6.72434 0.502107 7.3169 0.747135 7.80729 1.23753C8.29768 1.72792 8.54254 2.32031 8.54187 3.0147V4.0196H9.04432C9.32067 4.0196 9.55733 4.11808 9.75429 4.31504C9.95125 4.512 10.0496 4.74849 10.0492 5.0245V10.049C10.0492 10.3254 9.95091 10.562 9.75429 10.759C9.55766 10.9559 9.32101 11.0542 9.04432 11.0539H3.01491ZM6.73958 8.24672C6.93621 8.04976 7.03452 7.8131 7.03452 7.53676C7.03452 7.26041 6.93621 7.02392 6.73958 6.8273C6.54295 6.63067 6.3063 6.53219 6.02962 6.53185C5.75293 6.53152 5.51645 6.63 5.32016 6.8273C5.12387 7.02459 5.02539 7.26108 5.02472 7.53676C5.02405 7.81243 5.12253 8.04909 5.32016 8.24672C5.51779 8.44435 5.75427 8.54266 6.02962 8.54166C6.30496 8.54065 6.54162 8.44234 6.73958 8.24672ZM4.52226 4.0196H7.53697V3.0147C7.53697 2.59599 7.39042 2.24008 7.09733 1.94699C6.80423 1.65389 6.44833 1.50734 6.02962 1.50734C5.61091 1.50734 5.25501 1.65389 4.96191 1.94699C4.66881 2.24008 4.52226 2.59599 4.52226 3.0147V4.0196Z" fill="currentColor" />
    </svg>
  );
}

function MaintenanceIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 13 13" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M4.02018 1.00501C4.49111 1.00487 4.95552 1.11505 5.3762 1.32671C5.79688 1.53838 6.16213 1.84565 6.44267 2.22389C6.72322 2.60213 6.91126 3.04084 6.99172 3.50484C7.07219 3.96884 7.04285 4.44524 6.90604 4.89586L10.0502 8.04C10.3091 8.29735 10.459 8.64444 10.4688 9.00933C10.4787 9.37422 10.3478 9.72892 10.1033 9.9999C9.85871 10.2709 9.51926 10.4374 9.15527 10.4648C8.79129 10.4923 8.43069 10.3787 8.14822 10.1475L8.04018 10.05L4.89604 6.90586C4.36944 7.06604 3.80905 7.079 3.27561 6.94335C2.74217 6.8077 2.25604 6.52861 1.86993 6.13633C1.48382 5.74406 1.21246 5.25358 1.08526 4.71806C0.958074 4.18254 0.979906 3.62242 1.1484 3.09842L2.57449 4.52251L3.98853 4.05166L4.05134 3.98835L4.52268 2.57632L3.09458 1.14973C3.38603 1.05576 3.69758 1.00501 4.02018 1.00501ZM6.32465 5.81393C6.24496 5.73967 6.13936 5.69958 6.03047 5.70225C5.92158 5.70491 5.81806 5.75012 5.7421 5.82818C5.66614 5.90624 5.62378 6.01096 5.62408 6.11988C5.62439 6.2288 5.66735 6.33327 5.74376 6.4109L8.75072 9.33947C8.82947 9.4143 8.93435 9.4554 9.04298 9.45401C9.15161 9.45263 9.2554 9.40886 9.33222 9.33204C9.40903 9.25522 9.4528 9.15143 9.45419 9.0428C9.45558 8.93417 9.41448 8.8293 9.33965 8.75054L6.32465 5.81393Z" fill="currentColor" />
    </svg>
  );
}

function ArrowIcon() {
  return (
    <svg width="21" height="10" viewBox="0 0 21 10" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <path d="M0.75 5H18.25" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      <path d="M14.5 1.25L18.25 5L14.5 8.75" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function ScheduleDetailDrawer({ job, maintenance, setupMaintenance, linkedCorrectiveMaintenance, linkedJob, machine, orderRef, onSave, onClose }: Props) {
  const [locked, setLocked] = useState(job?.isLocked ?? false);
  const [correctiveMaintenance, setCorrectiveMaintenance] = useState(false);
  const [reason, setReason] = useState("Burned Bearing");
  const [estimatedHours, setEstimatedHours] = useState("6");
  const [reasons, setReasons] = useState<DowntimeReason[]>([]);
  const [startDate, setStartDate] = useState(job ? inputDate(job.startAt) : "");
  const [startTime, setStartTime] = useState(job ? inputTime(job.startAt) : "");
  const [endDate, setEndDate] = useState(job ? inputDate(job.endAt) : "");
  const [endTime, setEndTime] = useState(job ? inputTime(job.endAt) : "");
  const isComplete = job?.status === JobStatus.ProductionComplete;
  const hasActiveCorrective = !!linkedCorrectiveMaintenance || job?.status === JobStatus.ProductionPending;
  const canEdit = job?.status === JobStatus.Open;
  const canEditSchedule = canEdit && !locked && !!job;
  const invalidSchedule = canEditSchedule && (!startDate || !startTime || !endDate || !endTime || new Date(mergeDateTime(endDate, endTime)).getTime() <= new Date(mergeDateTime(startDate, startTime)).getTime());
  const isMaintenance = !!maintenance;
  const status = isMaintenance ? maintenance?.type ?? "Maintenance" : job?.status ?? JobStatus.Open;
  const statusClass = ui.scheduleToneClass(job?.status, isMaintenance);

  useEffect(() => {
    void api<DowntimeReason[]>("/downtime-reasons").then(setReasons).catch(() => setReasons([]));
  }, []);

  useEffect(() => {
    setLocked(job?.isLocked ?? false);
    setCorrectiveMaintenance(false);
    setStartDate(job ? inputDate(job.startAt) : "");
    setStartTime(job ? inputTime(job.startAt) : "");
    setEndDate(job ? inputDate(job.endAt) : "");
    setEndTime(job ? inputTime(job.endAt) : "");
  }, [job]);

  return (
    <Drawer
      title={isMaintenance ? maintenance?.type ?? "Maintenance" : job?.sourceOrderRefs ? `Order ${job.sourceOrderRefs}` : `Production Schedule #${job?.id}`}
      subtitle={machine ? `${machine.name} · ${machine.machineType}` : undefined}
      onClose={onClose}
      ariaLabel="Schedule detail"
      headerExtra={!isMaintenance && <span className={`mt-3 inline-flex rounded-full px-3 py-1 text-xs font-semibold text-white ${statusClass}`}>{status}</span>}
    >
          {!isMaintenance && (
            <>
              <div>
                <p className="mb-1 text-13 text-slate-500">Lock Production</p>
                <button type="button" role="switch" aria-checked={locked} disabled={!canEdit} onClick={() => setLocked((value) => !value)} className={`flex h-6 w-12 items-center rounded-full p-0.5 transition-colors ${locked ? "justify-end bg-brand-600" : "justify-start bg-slate-300"} disabled:cursor-not-allowed disabled:opacity-70`}>
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-400"><LockIcon /></span>
                </button>
              </div>

              <div className="grid grid-cols-2 gap-x-8 gap-y-5 rounded-lg bg-slate-50 p-4">
                <div><p className="text-13 text-slate-400">Qty</p><p className="mt-1 text-base font-semibold text-slate-950">{job ? `${job.qty.toLocaleString()} pcs` : "-"}</p></div>
                <div><p className="text-13 text-slate-400">Order ID</p><p className="mt-1 text-base font-semibold text-slate-950">{job?.sourceOrderRefs ?? "-"}</p></div>
                <div className="col-span-2"><p className="text-13 text-slate-400">Customer</p><p className="mt-1 text-base font-semibold text-slate-950">{job?.customerName ?? "-"}</p></div>
                <div className="col-span-2"><p className="text-13 text-slate-400">Item</p><p className="mt-1 text-base font-semibold text-slate-950">{job?.productName ?? "-"}</p>{job?.itemCode && <p className="mt-0.5 text-xs text-slate-400">{job.itemCode}</p>}</div>
                <div><p className="text-13 text-slate-400">Preform</p><p className="mt-1 text-base font-semibold text-slate-950">{job?.preform ?? "-"}</p></div>
                <div><p className="text-13 text-slate-400">Cavity used</p><p className="mt-1 text-base font-semibold text-slate-950">{job?.cavity ?? "-"}</p></div>
                <div><p className="text-13 text-slate-400">Delivery Due</p><p className="mt-1 text-base font-semibold text-slate-950">{job ? formatDate(job.deliveryDate) : "-"}</p></div>
                <div><p className="text-13 text-slate-400">Order Ref</p><p className="mt-1 text-base font-semibold text-slate-950">{orderRef || "-"}</p></div>
              </div>
            </>
          )}

          {isMaintenance && (
            <div className="grid grid-cols-2 gap-x-8 gap-y-5 rounded-lg bg-slate-50 p-4">
              <div><p className="text-13 text-slate-400">Machine</p><p className="mt-1 text-sm font-semibold text-slate-950">{machine ? `${machine.name} · ${machine.machineType}` : "-"}</p></div>
              <div><p className="text-13 text-slate-400">Machine code</p><p className="mt-1 text-sm font-semibold text-slate-950">{machine?.lineCode ?? "-"}</p></div>
              <div><p className="text-13 text-slate-400">Schedule</p><p className="mt-1 text-sm font-semibold text-slate-950">{maintenance?.scheduleType ?? "-"}</p></div>
              <div><p className="text-13 text-slate-400">Frequency</p><p className="mt-1 text-sm font-semibold text-slate-950">{maintenance?.scheduleType === "Recurring" ? [maintenance.repeatType, maintenance.repeatValue].filter(Boolean).join(" · ") : "One Time"}</p></div>
              <div className="col-span-2"><p className="text-13 text-slate-400">Reason</p><p className="mt-1 text-sm font-semibold leading-5 text-slate-950">{maintenance?.reason || "No reason provided"}</p></div>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 border-b border-slate-200 pb-5 sm:grid-cols-[1fr_40px_1fr] sm:items-end">
            <div>
              <p className="text-13 text-slate-400">{isMaintenance ? "Start Maintenance" : "Start Production"}</p>
              {!isMaintenance && canEditSchedule ? (
                <div className="mt-2 space-y-2">
                  <input type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-950" />
                  <input type="time" value={startTime} onChange={(event) => setStartTime(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-950" />
                </div>
              ) : (
                <p className="mt-1 whitespace-nowrap text-13 font-semibold text-slate-950">{isMaintenance ? (maintenance?.startAt ? displayDateTime(maintenance.startAt) : "-") : (job?.startAt ? displayDateTime(job.startAt) : "-")}</p>
              )}
            </div>
            <span className={`flex rotate-90 items-center justify-self-center text-slate-900 sm:rotate-0 ${!isMaintenance && canEditSchedule ? "sm:h-19 sm:self-center" : "sm:self-center"}`}><ArrowIcon /></span>
            <div>
              <p className="text-13 text-slate-400">{isMaintenance ? "End Maintenance" : "End Production"}</p>
              {!isMaintenance && canEditSchedule ? (
                <div className="mt-2 space-y-2">
                  <input type="date" value={endDate} onChange={(event) => setEndDate(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-950" />
                  <input type="time" value={endTime} onChange={(event) => setEndTime(event.target.value)} className="w-full rounded-md border border-slate-200 px-3 py-2 text-sm text-slate-950" />
                </div>
              ) : (
                <p className="mt-1 whitespace-nowrap text-13 font-semibold text-slate-950">{isMaintenance ? (maintenance?.endAt ? displayDateTime(maintenance.endAt) : "-") : (job?.endAt ? displayDateTime(job.endAt) : "-")}</p>
              )}
            </div>
          </div>
          {!isMaintenance && invalidSchedule && <p className="-mt-2 border-b border-slate-200 pb-5 text-xs text-red-600">End production harus lebih besar dari start production.</p>}

          {!isMaintenance && (
            <div className="rounded-lg bg-slate-50 p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-sm font-semibold text-slate-900">Setup Maintenance</span>
                {setupMaintenance && <span className="rounded-full bg-white px-2 py-0.5 text-2xs font-semibold text-brand-700">Linked to this order</span>}
              </div>
              {setupMaintenance ? (
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_24px_1fr] sm:items-center">
                  <div><p className="text-2xs text-slate-400">Start Setup</p><p className="mt-1 text-xs font-semibold text-slate-800">{displayDateTime(setupMaintenance.startAt)}</p></div>
                  <span className="rotate-90 justify-self-center text-slate-500 sm:rotate-0"><ArrowIcon /></span>
                  <div><p className="text-2xs text-slate-400">End Setup</p><p className="mt-1 text-xs font-semibold text-slate-800">{displayDateTime(setupMaintenance.endAt)}</p></div>
                </div>
              ) : <p className="mt-2 text-xs text-slate-500">No setup maintenance linked to this order.</p>}
            </div>
          )}

          {isMaintenance ? (
            <>
              {(maintenance?.type === MaintenanceType.Setup || maintenance?.type === MaintenanceType.Corrective) && (
                <div className="rounded-lg bg-slate-50 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900">{linkedJob ? `Order ${linkedJob.sourceOrderRefs ?? linkedJob.id}` : "Linked Order"}</span>
                    {linkedJob && <span className="rounded-full bg-white px-2 py-0.5 text-2xs font-semibold text-brand-700">Linked to this maintenance</span>}
                  </div>
                  {linkedJob ? (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_24px_1fr] sm:items-center">
                      <div><p className="text-2xs text-slate-400">Start Production</p><p className="mt-1 text-xs font-semibold text-slate-800">{displayDateTime(linkedJob.startAt)}</p></div>
                      <span className="rotate-90 justify-self-center text-slate-500 sm:rotate-0"><ArrowIcon /></span>
                      <div><p className="text-2xs text-slate-400">End Production</p><p className="mt-1 text-xs font-semibold text-slate-800">{displayDateTime(linkedJob.endAt)}</p></div>
                    </div>
                  ) : <p className="mt-2 text-xs text-slate-500">No order linked to this maintenance.</p>}
                </div>
              )}
            </>
          ) : (
            <div className="rounded-lg bg-slate-50 p-4">
              {hasActiveCorrective ? (
                <>
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <span className="text-sm font-semibold text-slate-900">Corrective Maintenance</span>
                    <span className="rounded-full bg-white px-2 py-0.5 text-2xs font-semibold text-brand-700">Linked to this order</span>
                  </div>
                  <div className="mt-3">
                    <p className="text-2xs text-slate-400">Reason</p>
                    <p className="mt-1 text-xs font-semibold text-slate-800">{linkedCorrectiveMaintenance?.reason ?? job?.blockingMaintenanceReason ?? "Maintenance in progress"}</p>
                  </div>
                  {linkedCorrectiveMaintenance && (
                    <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-[1fr_24px_1fr] sm:items-center">
                      <div><p className="text-2xs text-slate-400">Start Corrective</p><p className="mt-1 text-xs font-semibold text-slate-800">{displayDateTime(linkedCorrectiveMaintenance.startAt)}</p></div>
                      <span className="rotate-90 justify-self-center text-slate-500 sm:rotate-0"><ArrowIcon /></span>
                      <div><p className="text-2xs text-slate-400">End Corrective</p><p className="mt-1 text-xs font-semibold text-slate-800">{displayDateTime(linkedCorrectiveMaintenance.endAt)}</p></div>
                    </div>
                  )}
                </>
              ) : (
                <div className="flex items-center gap-3">
                  <button type="button" role="switch" aria-checked={correctiveMaintenance} disabled={isComplete} onClick={() => setCorrectiveMaintenance((value) => !value)} className={`flex h-6 w-12 items-center rounded-full p-0.5 transition-colors ${correctiveMaintenance ? "justify-end bg-brand-600" : "justify-start bg-slate-300"} disabled:cursor-not-allowed disabled:opacity-70`}>
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-white text-slate-400"><MaintenanceIcon /></span>
                  </button>
                  <span className="text-sm font-semibold text-slate-900">Corrective Maintenance</span>
                </div>
              )}
              {correctiveMaintenance && !hasActiveCorrective && (
                <div className="mt-4 space-y-3">
                  <label className="block text-13 font-semibold text-slate-800">Reason <span className="text-red-500">*</span>
                    <div className="mt-2"><CreatableSelect value={reason} options={reasons.map((item) => item.reason)} onChange={(value) => {
                      setReason(value);
                      const match = reasons.find((item) => item.reason.toLowerCase() === value.trim().toLowerCase());
                      if (match) setEstimatedHours(String(match.estimatedHours));
                    }} /></div>
                  </label>
                  <label className="block text-13 font-semibold text-slate-800">Estimated Time <span className="text-red-500">*</span>
                    <div className="mt-2"><Select value={estimatedHours} onChange={setEstimatedHours} options={[...new Set([2, 4, 6, 8, 24, ...reasons.map((item) => Number(item.estimatedHours))])].sort((a, b) => a - b).map((hours) => ({ value: String(hours), label: `${hours} Hours` }))} /></div>
                  </label>
                </div>
              )}
            </div>
          )}

          <div className="flex justify-end gap-2">
            <button type="button" className={ui.btnSecondary} onClick={onClose}>Back</button>
            {!isComplete && <button type="button" disabled={isMaintenance || invalidSchedule} className={ui.btnPrimary} onClick={async () => {
              const saved = await onSave?.({
                isLocked: locked,
                startAt: canEditSchedule ? mergeDateTime(startDate, startTime) : undefined,
                endAt: canEditSchedule ? mergeDateTime(endDate, endTime) : undefined,
                correctiveMaintenance: correctiveMaintenance ? { reason, estimatedHours: Number(estimatedHours) } : undefined,
              });
              if (saved !== false) onClose();
            }}>Save</button>}
          </div>
    </Drawer>
  );
}
