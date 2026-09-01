export const input =
  "h-8 w-full rounded-md border border-slate-200 bg-white px-2.5 text-xs text-slate-700 " +
  "placeholder:text-slate-400 focus:border-brand-500 focus:outline-none focus:ring-2 " +
  "focus:ring-brand-100 disabled:bg-slate-50 disabled:text-slate-400";

export const inputSm = input + " px-2";

export const selectButton = "relative " + input + " cursor-pointer pr-8 text-left";

export const label = "flex flex-col gap-1 text-2xs font-medium text-slate-500";

export const btnBase =
  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-semibold " +
  "transition duration-150 active:translate-y-px disabled:opacity-60 disabled:cursor-not-allowed";

export const btnPrimary = btnBase + " bg-brand-600 text-white hover:bg-brand-700";

export const btnSecondary =
  btnBase + " bg-white text-slate-800 border border-slate-200 hover:bg-slate-50";

export const btnLink =
  "rounded px-1.5 py-0.5 text-13 font-medium text-brand-600 hover:bg-brand-50";

export const btnLinkDanger =
  "rounded px-1.5 py-0.5 text-13 font-medium text-red-600 hover:bg-red-50";

export const segmentedWrap =
  "inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5";

export const segmentedBtn = "rounded px-3.5 py-1.5 text-sm font-semibold text-slate-500 hover:bg-slate-50";
export const segmentedBtnActive = "bg-brand-600 text-white hover:bg-brand-700";

export const page = "mx-auto w-full max-w-[1440px] px-4 pb-10 pt-4 sm:px-5 lg:px-6";

export const filtersRow = "mb-3.5 grid grid-cols-2 items-center gap-2 sm:flex sm:flex-wrap sm:gap-2.5";
export const searchInput = inputSm + " col-span-2 min-w-0 sm:min-w-[220px] sm:flex-1";
export const filterSelect = inputSm + " min-w-0";
export const filterSelectButton = "relative " + filterSelect + " w-full cursor-pointer pr-8 text-left sm:w-auto sm:min-w-36 sm:shrink-0";
export const filterSummary = "col-span-2 justify-self-end whitespace-nowrap text-xs text-slate-500 tabular-nums sm:col-span-1 sm:ml-auto";

export const card = "rounded-lg border border-slate-200 bg-white p-4";

export const tableCard = "rounded-lg border border-slate-200 bg-white overflow-hidden";

export const table = "w-full border-collapse text-xs tabular-nums";
export const th =
  "sticky top-0 z-10 bg-slate-50 px-3 py-2 text-left text-2xs font-semibold uppercase tracking-[0.06em] text-slate-400 border-b border-slate-200";
export const td = "px-3 py-2.5 text-left border-b border-slate-200";

export const muted = "text-slate-500 text-sm";
export const textDanger = "text-red-600 font-semibold";

export const bannerError = "rounded-md border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-800";

export const badgeBase = "inline-block rounded px-2 py-0.5 text-2xs font-semibold";
export const badgeSo = badgeBase + " bg-green-50 text-green-700";
export const badgeSc = badgeBase + " bg-brand-50 text-brand-700";
export const badgePi = badgeBase + " bg-amber-50 text-amber-700";
export const badgeNeutral = badgeBase + " bg-slate-100 text-slate-600";

export const statusBase = "rounded border-0 px-2 py-0.5 text-2xs font-semibold";
export const statusOpen = statusBase + " bg-slate-100 text-slate-600";
export const statusConfirmed = statusBase + " bg-brand-50 text-brand-700";
export const statusInProduction = statusBase + " bg-amber-50 text-amber-700";
export const statusFulfilled = statusBase + " bg-green-50 text-green-700";
export const statusCancelled = statusBase + " bg-red-50 text-red-700";

export function cx(...parts: Array<string | false | null | undefined>): string {
  return parts.filter(Boolean).join(" ");
}

export function scheduleToneClass(status: string | undefined, isMaintenance: boolean): string {
  if (isMaintenance) return "bg-red-500";
  switch (status) {
    case "Production Progress":
      return "bg-brand-600";
    case "Production Complete":
      return "bg-emerald-600";
    case "Production Pending":
      return "bg-amber-500";
    default:
      return "bg-slate-900";
  }
}
