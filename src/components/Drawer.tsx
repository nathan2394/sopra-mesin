import type { ReactNode } from "react";
import { X } from "lucide-react";

interface Props {
  open?: boolean;
  title: string;
  subtitle?: string;
  onClose: () => void;
  children: ReactNode;
  ariaLabel?: string;
  widthClassName?: string;
  headerExtra?: ReactNode;
}

export function Drawer({
  open = true,
  title,
  subtitle,
  onClose,
  children,
  ariaLabel,
  widthClassName = "max-w-[640px]",
  headerExtra,
}: Props) {
  if (!open) return null;

  return (
    <div className="drawer-backdrop fixed inset-0 z-50 bg-slate-950/20" onMouseDown={(event) => event.target === event.currentTarget && onClose()}>
      <aside role="dialog" aria-modal="true" aria-label={ariaLabel ?? title} className={`drawer-panel absolute inset-y-0 right-0 w-full overflow-y-auto border-l border-slate-200 bg-white ${widthClassName}`}>
        <header className="border-b border-slate-200 px-5 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-bold tracking-tight text-slate-900">{title}</h2>
              {subtitle && <p className="mt-1 text-xs text-slate-500">{subtitle}</p>}
              {headerExtra}
            </div>
            <button type="button" className="rounded-md p-1 text-slate-500 hover:bg-slate-100 hover:text-slate-900" onClick={onClose} aria-label="Close drawer"><X size={20} /></button>
          </div>
        </header>

        <div className="space-y-5 px-6 py-4">
          {children}
        </div>
      </aside>
    </div>
  );
}
