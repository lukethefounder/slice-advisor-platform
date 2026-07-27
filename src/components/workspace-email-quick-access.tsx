"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";

type EmailCenterPreview = {
  metrics?: {
    clientCount: number;
    clientsWithEmail: number;
    clientsMissingEmail: number;
    draftCount: number;
    pendingApprovalCount: number;
  };
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export default function WorkspaceEmailQuickAccess() {
  const pathname = usePathname();
  const [open, setOpen] = useState(true);
  const [preview, setPreview] = useState<EmailCenterPreview | null>(null);

  const shouldShow = pathname === "/workspace";

  useEffect(() => {
    if (!shouldShow) return;

    let active = true;

    async function loadPreview() {
      try {
        const response = await fetch("/api/client-emails", {
          cache: "no-store",
        });

        if (!response.ok) return;

        const payload = await response.json();

        if (active) {
          setPreview(payload);
        }
      } catch {
        // Keep the workspace UI untouched if preview loading fails.
      }
    }

    void loadPreview();

    return () => {
      active = false;
    };
  }, [shouldShow]);

  if (!shouldShow) return null;

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="fixed bottom-5 left-5 z-[9998] rounded-2xl border border-emerald-500/30 bg-zinc-950/90 px-4 py-3 text-xs font-black uppercase tracking-[0.14em] text-emerald-100 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl hover:bg-emerald-500/15"
      >
        Client Email Center
      </button>
    );
  }

  return (
    <aside className="fixed bottom-5 left-5 z-[9998] w-[min(420px,calc(100vw-2.5rem))] overflow-hidden rounded-[1.8rem] border border-white/10 bg-zinc-950/92 shadow-2xl shadow-emerald-950/40 backdrop-blur-xl">
      <div className="relative p-4">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-emerald-600/18 to-transparent" />

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400">
                Advisor Communication
              </div>
              <h2 className="mt-1 text-lg font-black text-white">
                Client Email Center
              </h2>
              <p className="mt-1 text-xs leading-5 text-slate-400">
                Draft polished AI emails, choose recipients, edit drafts, approve, and send.
              </p>
            </div>

            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-xl border border-white/10 bg-white/5 px-2.5 py-1.5 text-[10px] font-black text-white hover:bg-white/10"
            >
              Hide
            </button>
          </div>

          <div className="mt-4 grid grid-cols-3 gap-2">
            <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">
                Clients
              </div>
              <div className="mt-1 text-xl font-black text-white">
                {preview?.metrics?.clientCount ?? "—"}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3">
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-300">
                Email Ready
              </div>
              <div className="mt-1 text-xl font-black text-emerald-100">
                {preview?.metrics?.clientsWithEmail ?? "—"}
              </div>
            </div>

            <div
              className={cx(
                "rounded-2xl border p-3",
                preview?.metrics?.pendingApprovalCount
                  ? "border-amber-500/20 bg-amber-500/10"
                  : "border-white/10 bg-white/[0.045]"
              )}
            >
              <div className="text-[9px] font-black uppercase tracking-[0.14em] text-amber-300">
                Approvals
              </div>
              <div className="mt-1 text-xl font-black text-white">
                {preview?.metrics?.pendingApprovalCount ?? "—"}
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            <a
              href="/workspace/client-emails"
              className="rounded-2xl bg-white px-4 py-3 text-center text-xs font-black text-slate-950 shadow-lg shadow-black/20"
            >
              Open Email Center
            </a>

            <a
              href="/workspace/client-briefings"
              className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-center text-xs font-black text-cyan-100"
            >
              Holding Briefings
            </a>
          </div>
        </div>
      </div>
    </aside>
  );
}