import type { FormEventHandler, ReactNode } from "react";

interface Props {
  onClose: () => void;
  onSubmit?: FormEventHandler<HTMLFormElement>;
  wide?: boolean;
  children: ReactNode;
}

/** Shared modal shell (backdrop + rounded panel) used by every create/edit form dialog. */
export function Modal({ onClose, onSubmit, wide, children }: Props) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-900/45 px-4 py-12"
      onMouseDown={onClose}
    >
      <form
        className={`flex w-full flex-col gap-3 rounded-2xl bg-white p-6 shadow-2xl ${wide ? "max-w-[1080px]" : "max-w-[480px]"}`}
        onMouseDown={(e) => e.stopPropagation()}
        onSubmit={onSubmit}
      >
        {children}
      </form>
    </div>
  );
}
