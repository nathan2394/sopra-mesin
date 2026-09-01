import type { ReactNode } from "react";

interface Props {
  breadcrumb: string[];
  title: string;
  subtitle?: string;
  actions?: ReactNode;
}

export function PageHeader({ breadcrumb, title, subtitle, actions }: Props) {
  return (
    <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
      <div className="min-w-0">
        {breadcrumb.length > 0 && <div className="mb-1.5 text-xs font-medium text-slate-400">{breadcrumb.join(" > ")}</div>}
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        {subtitle && <div className="mt-1 max-w-4xl text-xs leading-5 text-slate-500 sm:leading-normal">{subtitle}</div>}
      </div>
      {actions && <div className="flex w-full flex-nowrap items-center gap-1.5 [&>*]:justify-center [&>*]:px-2 [&>*]:text-[11px] sm:w-auto sm:shrink-0 sm:justify-end sm:gap-2.5 sm:[&>*]:px-3 sm:[&>*]:text-xs">{actions}</div>}
    </div>
  );
}
