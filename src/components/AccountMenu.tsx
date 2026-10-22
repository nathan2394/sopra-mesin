import { useState } from "react";
import { Menu, MenuButton, MenuItem, MenuItems } from "@headlessui/react";
import { ChevronDown, KeyRound, LogOut } from "lucide-react";
import { currentEmail, currentRole, currentUsername, logout } from "../api/client";
import { ChangePasswordDialog } from "./ChangePasswordDialog";

export function AccountMenu({ onOpen }: { onOpen?: () => void }) {
  const [passwordOpen, setPasswordOpen] = useState(false);
  const username = currentUsername();
  const email = currentEmail();
  const role = currentRole();
  const initial = (username || email).charAt(0).toUpperCase();

  return <>
    <Menu as="div" className="relative">
      <MenuButton onClick={onOpen} aria-label="Account menu" className="group flex max-w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-left transition-colors hover:bg-slate-50 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-600 data-open:bg-slate-50">
        <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-brand-600 text-sm font-semibold text-white">{initial}</span>
        <span className="hidden min-w-0 sm:block">
          <span className="block max-w-48 truncate text-xs font-semibold text-slate-800">{username}</span>
          {role && <span className="block text-2xs text-slate-500">{role}</span>}
        </span>
        <ChevronDown size={14} className="text-slate-400 transition-transform group-data-open:rotate-180" />
      </MenuButton>
      <MenuItems transition className="absolute right-0 top-[calc(100%+0.625rem)] z-[40] w-72 max-w-[calc(100vw-2rem)] origin-top-right rounded-xl border border-slate-200 bg-white p-1.5 shadow-xl shadow-slate-900/10 outline-none transition duration-150 ease-out data-closed:scale-95 data-closed:opacity-0 motion-reduce:transition-none">
        <div className="px-3 py-3">
          <p className="text-2xs font-medium text-slate-500">Signed in as</p>
          <p className="mt-1 break-words text-sm font-semibold text-slate-900">{email || username}</p>
          {role && <span className="mt-2 inline-flex rounded-md bg-slate-100 px-2 py-0.5 text-2xs font-medium text-slate-600">{role}</span>}
        </div>
        <div className="mx-2 border-t border-slate-100" />
        <div className="py-1.5">
          <MenuItem>
            <button type="button" onClick={() => setPasswordOpen(true)} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-700 data-focus:bg-slate-50 data-focus:text-slate-900">
              <KeyRound size={17} className="text-slate-400" />Change password
            </button>
          </MenuItem>
        </div>
        <div className="mx-2 border-t border-slate-100" />
        <div className="pt-1.5">
          <MenuItem>
            <button type="button" onClick={() => { logout(); window.location.reload(); }} className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-red-600 data-focus:bg-red-50">
              <LogOut size={17} />Logout
            </button>
          </MenuItem>
        </div>
      </MenuItems>
    </Menu>
    {passwordOpen && <ChangePasswordDialog onClose={() => setPasswordOpen(false)} />}
  </>;
}
