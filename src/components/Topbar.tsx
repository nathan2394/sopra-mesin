import { useMemo } from "react";
import { Bell, ChevronDown } from "lucide-react";

function formatLoginTime(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function Topbar() {
  const loginTime = useMemo(() => formatLoginTime(new Date()), []);

  return (
    <header className="flex h-[60px] shrink-0 items-center justify-between border-b border-slate-200 bg-white px-6">
      <div className="text-[0.85rem] text-slate-500">
        Login Time: <strong className="font-semibold text-slate-800">{loginTime}</strong>
      </div>
      <div className="flex items-center gap-4">
        <button
          type="button"
          className="relative flex rounded-md p-1.5 text-slate-500 hover:bg-slate-50 hover:text-slate-800"
          aria-label="Notifications"
        >
          <Bell size={18} />
          <span className="absolute top-1 right-1 h-1.5 w-1.5 rounded-full border-[1.5px] border-white bg-red-600" />
        </button>
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-blue-600 text-[0.85rem] font-bold text-white">
            N
          </div>
          <div className="text-left leading-[1.25]">
            <div className="text-[0.84rem] font-semibold text-slate-800">nathan@sopra.id</div>
            <div className="text-[0.74rem] text-slate-500">Production Planner</div>
          </div>
          <ChevronDown size={16} className="text-slate-400" />
        </div>
      </div>
    </header>
  );
}
