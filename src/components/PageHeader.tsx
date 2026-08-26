import type { ReactNode } from "react";

interface Props {
  breadcrumb: string[];
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ breadcrumb, title, subtitle, actions }: Props) {
  return (
    <div className="mb-4 flex items-start justify-between gap-4">
      <div>
        {breadcrumb.length > 0 && <div className="mb-1.5 text-xs font-medium text-slate-400">{breadcrumb.join(" > ")}</div>}
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <div className="mt-1 max-w-4xl text-xs text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </div>
  );
}
