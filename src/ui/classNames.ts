// Shared Tailwind utility strings for form controls, buttons, labels, cards, tables,
// badges and status pills — every component/page composes these instead of hand-rolled
// CSS classes, so the whole app stays visually consistent from one place.

export const input =
  "w-full rounded-md border border-slate-300 bg-white px-2.5 py-2 text-sm text-slate-800 " +
  "placeholder:text-slate-400 focus:border-blue-500 focus:outline-none focus:ring-2 " +
  "focus:ring-blue-100 disabled:bg-slate-50 disabled:text-slate-400";

export const inputSm = input + " px-2 py-1.5 text-xs";

export const selectButton = "relative " + input + " cursor-pointer pr-8 text-left";
export const selectButtonSm = "relative " + inputSm + " cursor-pointer pr-7 text-left";

export const label = "flex flex-col gap-1 text-[0.84rem] font-medium text-slate-500";

export const btnBase =
  "inline-flex items-center gap-1.5 rounded-md px-3.5 py-2 text-sm font-semibold " +
  "transition-colors disabled:opacity-60 disabled:cursor-not-allowed";

export const btnPrimary = btnBase + " bg-blue-600 text-white hover:bg-blue-700";

export const btnSecondary =
  btnBase + " bg-white text-slate-800 border border-slate-300 hover:bg-slate-50";

export const btnOutline =
  btnBase + " bg-white text-blue-600 border border-slate-300 hover:bg-blue-50";

export const btnLink =
  "rounded px-1.5 py-0.5 text-[0.83rem] font-medium text-blue-600 hover:bg-blue-50";

export const btnLinkDanger =
  "rounded px-1.5 py-0.5 text-[0.83rem] font-medium text-red-600 hover:bg-red-50";

export const segmentedWrap =
  "inline-flex items-center gap-0.5 rounded-md border border-slate-300 bg-white p-0.5";

export const segmentedBtn = "rounded px-3.5 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50";
export const segmentedBtnActive = "bg-blue-600 text-white hover:bg-blue-700";

export const page = "mx-auto w-full max-w-[1400px] px-8 pt-6 pb-12";

export const filtersRow = "mb-3.5 flex flex-wrap items-center gap-2.5";
export const searchInput = input + " flex-1 min-w-[220px]";
export const filterSelect = input + " w-auto";
export const filterSelectButton = "relative " + filterSelect + " cursor-pointer pr-8 text-left";

export const card = "rounded-2xl border border-slate-200 bg-white shadow-sm p-5";

export const tableCard = "rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden";

export const table = "w-full border-collapse text-[0.88rem]";
export const th =
  "bg-slate-50 px-4 py-2.5 text-left text-[0.72rem] font-bold uppercase tracking-wide text-slate-400 border-b border-slate-200";
export const td = "px-4 py-2.5 text-left border-b border-slate-100 last:border-b-0";

export const muted = "text-slate-500 text-sm";
export const textDanger = "text-red-600 font-semibold";

export const banner = "rounded-md border border-sky-200 bg-sky-50 px-3.5 py-2.5 text-sm text-sky-900";
export const bannerError = "rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800";

export const badgeBase = "inline-block rounded-full px-2.5 py-0.5 text-[0.74rem] font-semibold";
export const badgeSo = badgeBase + " bg-green-50 text-green-700";
export const badgeSc = badgeBase + " bg-sky-50 text-sky-700";
export const badgePi = badgeBase + " bg-amber-50 text-amber-700";
export const badgeNeutral = badgeBase + " bg-slate-100 text-slate-600";

export const statusBase = "rounded-full border-0 px-2.5 py-1 text-[0.78rem] font-semibold";
export const statusOpen = statusBase + " bg-slate-100 text-slate-600";
export const statusConfirmed = statusBase + " bg-sky-50 text-sky-700";
export const statusInProduction = statusBase + " bg-amber-50 text-amber-700";
export const statusFulfilled = statusBase + " bg-green-50 text-green-700";
export const statusCancelled = statusBase + " bg-red-50 text-red-700";
export const statusPlanned = statusBase + " bg-sky-50 text-sky-700";
export const statusInProgress = statusBase + " bg-amber-50 text-amber-700";
export const statusDone = statusBase + " bg-slate-100 text-slate-600";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}
