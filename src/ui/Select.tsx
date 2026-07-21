import { Listbox, ListboxButton, ListboxOption, ListboxOptions } from "@headlessui/react";
import { Check, ChevronsUpDown } from "lucide-react";
import { cx, selectButton } from "./classNames";

export interface SelectOption {
  value: string;
  label: string;
}

interface Props {
  value: string;
  onChange: (value: string) => void;
  options: SelectOption[];
  /** Overrides the trigger button's own styling — used for colored status/badge pills. */
  buttonClassName?: string;
  disabled?: boolean;
}

/**
 * Checkmark-on-left listbox (button trigger + floating panel), replacing native <select>
 * app-wide. Selected row gets a checkmark; the focused/hovered row gets a blue highlight —
 * same interaction pattern as the Tailwind UI "Custom with check on left" combobox, just in
 * this app's existing blue/slate palette instead of the reference's dark/indigo theme.
 */
export function Select({ value, onChange, options, buttonClassName, disabled }: Props) {
  const selected = options.find((o) => o.value === value);

  return (
    <Listbox value={value} onChange={onChange} disabled={disabled}>
      <div className="relative">
        <ListboxButton className={buttonClassName ?? selectButton}>
          <span className="block truncate">{selected?.label ?? value}</span>
          <span className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-2">
            <ChevronsUpDown className="h-4 w-4 opacity-60" aria-hidden="true" />
          </span>
        </ListboxButton>
        <ListboxOptions
          anchor="bottom start"
          transition
          className="z-30 mt-1 max-h-60 w-[var(--button-width)] overflow-auto rounded-md border border-slate-200 bg-white py-1 text-sm shadow-lg [--anchor-gap:4px] transition duration-100 ease-in focus:outline-none data-closed:opacity-0"
        >
          {options.map((opt) => (
            <ListboxOption
              key={opt.value}
              value={opt.value}
              className={({ focus }) =>
                cx("relative cursor-pointer py-2 pr-3 pl-8 select-none", focus ? "bg-blue-600 text-white" : "text-slate-800")
              }
            >
              {({ selected: isSelected }) => (
                <>
                  <span className={cx("block truncate", isSelected && "font-semibold")}>{opt.label}</span>
                  {isSelected && (
                    <span className="absolute inset-y-0 left-0 flex items-center pl-2.5">
                      <Check className="h-4 w-4" aria-hidden="true" />
                    </span>
                  )}
                </>
              )}
            </ListboxOption>
          ))}
        </ListboxOptions>
      </div>
    </Listbox>
  );
}
