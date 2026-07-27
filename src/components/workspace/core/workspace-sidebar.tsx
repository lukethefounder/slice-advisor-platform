"use client";

import Link from "next/link";
import {
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useState } from "react";

import { WORKSPACE_TOOLS } from "@/lib/workspace-green-core";
import {
  GreenSliceLogo,
  WorkspaceIcon,
  WorkspacePill,
  cx,
  toneClasses,
} from "@/components/workspace/core/workspace-ui";

export default function WorkspaceSidebar({
  onOpenSearch,
  onSignOut,
  role,
  firmName,
}: {
  onOpenSearch: () => void;
  onSignOut: () => void;
  role: string;
  firmName: string;
}) {
  const [mobileOpen, setMobileOpen] = useState(false);

  const content = (
    <div className="flex h-full min-h-0 flex-col">
      <div className="border-b border-emerald-200/10 p-4">
        <div className="flex items-center justify-between gap-3">
          <GreenSliceLogo />
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-emerald-300/12 bg-emerald-500/[0.055] p-3">
          <p className="truncate text-xs font-black text-white">{firmName}</p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <WorkspacePill tone="emerald">Beta workspace</WorkspacePill>
            <WorkspacePill tone="slate">{role}</WorkspacePill>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setMobileOpen(false);
            onOpenSearch();
          }}
          className="mt-3 flex w-full items-center gap-2 rounded-xl border border-white/10 bg-black/35 px-3 py-2.5 text-left text-xs font-bold text-slate-400 transition hover:border-emerald-400/25 hover:text-white"
        >
          <Search className="h-4 w-4 text-emerald-300" />
          <span className="min-w-0 flex-1 truncate">Search advisor tools</span>
          <span className="rounded-md border border-white/10 px-1.5 py-0.5 text-[8px] font-black uppercase text-slate-600">
            ⌘K
          </span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto p-2.5">
        <p className="px-2 pb-2 text-[9px] font-black uppercase tracking-[0.18em] text-slate-600">
          Advisor tools
        </p>

        <nav className="grid gap-1">
          {WORKSPACE_TOOLS.map((tool) => (
            <Link
              key={tool.id}
              href={tool.href}
              prefetch={false}
              onClick={() => setMobileOpen(false)}
              className="group flex min-w-0 items-center gap-2.5 rounded-xl border border-transparent px-2.5 py-2 transition hover:border-emerald-300/18 hover:bg-emerald-500/[0.065]"
            >
              <span
                className={cx(
                  "grid h-9 w-9 shrink-0 place-items-center rounded-xl border shadow-lg",
                  toneClasses(tool.tone),
                )}
              >
                <WorkspaceIcon name={tool.icon} />
              </span>

              <span className="min-w-0 flex-1">
                <span className="block truncate text-xs font-black text-white">
                  {tool.label}
                </span>
                <span className="mt-0.5 block truncate text-[9px] font-semibold text-slate-600">
                  {tool.subtitle}
                </span>
              </span>

              <span className="text-sm text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-emerald-300">
                ↗
              </span>
            </Link>
          ))}
        </nav>
      </div>

      <div className="grid gap-2 border-t border-emerald-200/10 p-3">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/workspace/settings"
            onClick={() => setMobileOpen(false)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[10px] font-black text-slate-300 hover:border-emerald-400/25 hover:text-white"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Settings
          </Link>
          <Link
            href="/security"
            onClick={() => setMobileOpen(false)}
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2.5 text-[10px] font-black text-slate-300 hover:border-emerald-400/25 hover:text-white"
          >
            <ShieldCheck className="h-3.5 w-3.5" />
            Security
          </Link>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex items-center justify-center gap-2 rounded-xl border border-amber-400/20 bg-amber-500/[0.07] px-3 py-2.5 text-[10px] font-black text-amber-100 transition hover:bg-amber-500/12"
        >
          <LogOut className="h-3.5 w-3.5" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-40 grid h-11 w-11 place-items-center rounded-xl border border-emerald-300/18 bg-black/75 text-emerald-100 shadow-xl backdrop-blur-xl lg:hidden"
        aria-label="Open navigation"
      >
        <Menu className="h-5 w-5" />
      </button>

      <aside className="hidden h-full min-h-0 border-r border-emerald-200/10 bg-black/48 backdrop-blur-2xl lg:block">
        {content}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-black/72 backdrop-blur-sm"
            aria-label="Close navigation"
          />
          <aside className="absolute inset-y-0 left-0 w-[min(88vw,320px)] border-r border-emerald-300/15 bg-[#020806] shadow-2xl shadow-black">
            {content}
          </aside>
        </div>
      ) : null}
    </>
  );
}