import { useState } from "react";
import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import { Check, ChevronsUpDown, Search, X } from "lucide-react";
import { cx, input, selectButton } from "./classNames";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  buttonClassName?: string;
  className?: string;
  disabled?: boolean;
}

export function Select({ value, onChange, options, buttonClassName, className, disabled }: Props) {
  const [query, setQuery] = useState("");
  const selected = options.find((option) => option.value === value);
  const visible = options.filter((option) => `${option.label} ${option.value}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <Combobox value={value} onChange={(next) => next !== null && onChange(next)} onClose={() => setQuery("")} disabled={disabled}>
    <div className={cx("relative", className)}>
      <ComboboxButton className={buttonClassName ?? selectButton}>
        <span className="block truncate">{selected?.label ?? value}</span>
        <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"><ChevronsUpDown className="h-4 w-4 opacity-60" /></span>
      </ComboboxButton>
      <ComboboxOptions transition className="absolute left-0 top-full z-50 mt-1 max-h-64 w-max min-w-full max-w-[calc(100vw-2rem)] overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg focus:outline-none data-closed:opacity-0">
        <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-2">
          <div className="flex h-8 items-center gap-2 rounded-md border border-slate-200 px-2"><Search size={14} className="text-slate-400" /><input autoFocus aria-label="Search options" className="min-w-32 flex-1 border-0 bg-transparent text-xs text-slate-800 outline-none" value={query} onChange={(event) => setQuery(event.target.value)} onClick={(event) => event.stopPropagation()} /></div>
        </div>
        {visible.map((option) => <ComboboxOption key={option.value} value={option.value} className={({ focus }) => cx("relative cursor-pointer py-2 pr-3 pl-8 select-none", focus ? "bg-brand-600 text-white" : "text-slate-800")}>
          {({ selected: active }) => <><span className={cx("block whitespace-normal", active && "font-semibold")}>{option.label}</span>{active && <span className="absolute inset-y-0 left-0 flex items-center pl-2.5"><Check className="h-4 w-4" /></span>}</>}
        </ComboboxOption>)}
        {visible.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">No options found.</p>}
      </ComboboxOptions>
    </div>
  </Combobox>;
}

interface CreatableSelectProps {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}

export function CreatableSelect({ value, onChange, options }: CreatableSelectProps) {
  const visible = options.filter((option) => option.toLowerCase().includes(value.toLowerCase()));

  return <Combobox value={value} onChange={(next) => next !== null && onChange(next)} immediate>
    <div className="relative">
      <ComboboxInput className={`${input} pr-8`} displayValue={(selected: string) => selected} onChange={(event) => onChange(event.target.value)} />
      <ComboboxButton className="absolute inset-y-0 right-0 flex items-center px-2 text-slate-400"><ChevronsUpDown size={15} /></ComboboxButton>
      <ComboboxOptions className="absolute left-0 top-full z-50 mt-1 max-h-52 w-full overflow-auto rounded-md border border-slate-200 bg-white py-1 text-xs shadow-lg empty:invisible">
        {visible.map((option) => <ComboboxOption key={option} value={option} className="group flex cursor-pointer items-center gap-2 px-2.5 py-2 text-slate-700 data-focus:bg-brand-600 data-focus:text-white">
          <Check size={14} className="invisible group-data-selected:visible" />
          <span>{option}</span>
        </ComboboxOption>)}
      </ComboboxOptions>
    </div>
  </Combobox>;
}

interface MultiSelectProps {
  values: string[];
  onChange: (values: string[]) => void;
  options: SelectOption[];
  disabled?: boolean;
}

export function MultiSelect({ values, onChange, options, disabled }: MultiSelectProps) {
  const [query, setQuery] = useState("");
  const selected = options.filter((option) => values.includes(option.value));
  const visible = options.filter((option) => `${option.label} ${option.value}`.toLowerCase().includes(query.trim().toLowerCase()));

  return <div className="space-y-2">
    <Combobox multiple value={values} onChange={onChange} onClose={() => setQuery("")} disabled={disabled}>
      <div className="relative">
        <ComboboxButton className={selectButton}>
          <span className={`block truncate ${selected.length === 0 ? "text-slate-400" : ""}`}>
            {selected.length === 0 ? "Select machines" : selected.length === 1 ? selected[0].label : `${selected.length} machines selected`}
          </span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2"><ChevronsUpDown className="h-4 w-4 opacity-60" /></span>
        </ComboboxButton>
        <ComboboxOptions transition className="absolute left-0 top-full z-50 mt-1 max-h-64 w-max min-w-full max-w-[calc(100vw-2rem)] overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg focus:outline-none data-closed:opacity-0">
          <div className="sticky top-0 z-10 border-b border-slate-200 bg-white p-2">
            <div className="flex h-8 items-center gap-2 rounded-md border border-slate-200 px-2"><Search size={14} className="text-slate-400" /><input autoFocus aria-label="Search options" className="min-w-32 flex-1 border-0 bg-transparent text-xs text-slate-800 outline-none" value={query} onChange={(event) => setQuery(event.target.value)} onClick={(event) => event.stopPropagation()} /></div>
          </div>
          {visible.map((option) => <ComboboxOption key={option.value} value={option.value} className={({ focus }) => cx("relative cursor-pointer py-2 pr-3 pl-8 select-none", focus ? "bg-brand-600 text-white" : "text-slate-800")}>
            {({ selected: active }) => <><span className={cx("block whitespace-normal", active && "font-semibold")}>{option.label}</span>{active && <span className="absolute inset-y-0 left-0 flex items-center pl-2.5"><Check className="h-4 w-4" /></span>}</>}
          </ComboboxOption>)}
          {visible.length === 0 && <p className="px-3 py-2 text-xs text-slate-500">No options found.</p>}
        </ComboboxOptions>
      </div>
    </Combobox>

    {selected.length > 0 && <div className="flex flex-wrap gap-2">
      {selected.map((option) => <span key={option.value} className="inline-flex max-w-full items-center gap-1.5 rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
        <span className="truncate">{option.label}</span>
        <button
          type="button"
          aria-label={`Remove ${option.label}`}
          className="rounded-full p-0.5 text-slate-400 transition hover:bg-slate-200 hover:text-slate-700"
          onMouseDown={(event) => event.preventDefault()}
          onClick={() => onChange(values.filter((value) => value !== option.value))}
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </span>)}
    </div>}
  </div>;
}
