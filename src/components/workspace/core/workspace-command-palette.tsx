"use client";

import { createPortal } from "react-dom";
import {
  ArrowRight,
  Search,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  searchWorkspaceTools,
} from "@/lib/workspace-green-core";
import {
  WorkspaceIcon,
  WorkspacePill,
  cx,
  toneClasses,
} from "@/components/workspace/core/workspace-ui";

export default function WorkspaceCommandPalette({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      return;
    }

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        onClose();
      }
    }

    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  const tools = useMemo(() => searchWorkspaceTools(query), [query]);

  if (!mounted || !open) {
    return null;
  }

  return createPortal(
    <div className="fixed inset-0 z-[2147483646] grid place-items-start bg-black/72 p-3 pt-[8vh] backdrop-blur-md sm:p-6 sm:pt-[12vh]">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
        aria-label="Close command palette"
      />

      <section className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[2rem] border border-emerald-300/20 bg-[#020806]/98 shadow-[0_40px_120px_rgba(0,0,0,0.75)]">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-emerald-500/18 via-cyan-500/[0.04] to-transparent" />

        <div className="relative flex items-center gap-3 border-b border-white/8 p-4">
          <Search className="h-5 w-5 shrink-0 text-emerald-300" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search tools, briefing, markets, clients, team…"
            className="min-w-0 flex-1 bg-transparent text-base font-bold text-white outline-none placeholder:text-slate-600"
            autoFocus
          />
          <button
            type="button"
            onClick={onClose}
            className="grid h-9 w-9 place-items-center rounded-xl border border-white/10 bg-white/[0.04] text-slate-400 hover:text-white"
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative max-h-[68vh] space-y-2 overflow-y-auto p-3">
          {tools.map((tool) => (
            <a
              key={tool.id}
              href={tool.href}
              onClick={onClose}
              className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-3 transition hover:border-emerald-300/20 hover:bg-emerald-500/[0.06]"
            >
              <span
                className={cx(
                  "grid h-11 w-11 shrink-0 place-items-center rounded-xl border",
                  toneClasses(tool.tone),
                )}
              >
                <WorkspaceIcon name={tool.icon} className="h-5 w-5" />
              </span>

              <span className="min-w-0 flex-1">
                <span className="flex min-w-0 items-center gap-2">
                  <span className="truncate text-sm font-black text-white">
                    {tool.label}
                  </span>
                  <WorkspacePill tone={tool.tone}>{tool.category}</WorkspacePill>
                </span>
                <span className="mt-1 block line-clamp-2 text-xs font-semibold leading-5 text-slate-500">
                  {tool.description}
                </span>
                <span className="mt-1 block truncate text-[9px] font-black uppercase tracking-[0.12em] text-emerald-300/70">
                  {tool.outcome}
                </span>
              </span>

              <ArrowRight className="h-4 w-4 shrink-0 text-slate-700 transition group-hover:translate-x-0.5 group-hover:text-emerald-300" />
            </a>
          ))}

          {!tools.length ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
              No advisor tool matched “{query}”.
            </div>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}