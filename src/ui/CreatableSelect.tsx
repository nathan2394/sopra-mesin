import { Combobox, ComboboxButton, ComboboxInput, ComboboxOption, ComboboxOptions } from "@headlessui/react";
import { Check, ChevronsUpDown } from "lucide-react";
import { input } from "./classNames";

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: string[];
}

export function CreatableSelect({ value, onChange, options }: Props) {
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
