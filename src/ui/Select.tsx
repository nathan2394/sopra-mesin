import { useState } from "react";
import { Combobox, ComboboxButton, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import { Check, ChevronsUpDown, Search } from "lucide-react";
import { cx, selectButton } from "./classNames";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  buttonClassName?: string;
  disabled?: boolean;
}

export function Select({ value, onChange, options, buttonClassName, disabled }: Props) {
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const visible = options.filter((option) => `${option.label} ${option.value}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <Combobox value={value} onChange={(next) => next !== null && onChange(next)} onClose={() => setQuery("")} disabled={disabled}>
    <div className="relative">
      <ComboboxButton className={buttonClassName ?? selectButton}>
        <span className="block truncate">{selected?.label ?? value}</span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"><ChevronsUpDown className="h-4 w-4 opacity-60" /></span>
      </ComboboxButton>
      <ComboboxOptions transition className="absolute left-0 top-full z-50 mt-1 max-h-64 w-max min-w-full max-w-[calc(100vw-2rem)] overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg focus:outline-none data-closed:opacity-0">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-2">
          <div className="flex h-8 items-center gap-2 rounded-md border border-slate-200 px-2"><Search size={14} className="text-slate-400" /><input autoFocus aria-label="Search options" className="min-w-32 flex-1 border-0 bg-transparent text-xs text-slate-800 outline-none" value={query} onChange={(event) => setQuery(event.target.value)} onClick={(event) => event.stopPropagation()} /></div>
        </div>
        {visible.map((option) => <ComboboxOption key={option.value} value={option.value} className={({ focus }) => cx("relative cursor-pointer py-2 pr-3 pl-8 select-none", focus ? "bg-blue-600 text-white" : "text-slate-800")}>
          {({ selected: active }) => <><span className={cx("block whitespace-normal", active && "font-semibold")}>{option.label}</span>{active && <span className="absolute inset-y-0 left-0 flex items-center pl-2.5"><Check className="h-4 w-4" /></span>}</>}
        </ComboboxOption>)}
        {visible.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">No options found.</p>}
      </ComboboxOptions>
    </div>
  </Combobox>;
}
