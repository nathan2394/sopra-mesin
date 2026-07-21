import type { ReactNode } from "react";

interface Props {
  breadcrumb: string[];
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ breadcrumb, title, subtitle, actions }: Props) {
  return (
    <div className="mb-5 flex items-start justify-between gap-4">
      <div>
        <div className="mb-1.5 text-[0.82rem] text-slate-400">{breadcrumb.join(" › ")}</div>
        <h1 className="text-2xl">{title}</h1>
        {subtitle && <div className="mt-1 text-[0.92rem] text-slate-500">{subtitle}</div>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2.5">{actions}</div>}
    </div>
  );
}
