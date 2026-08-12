"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LogOut,
  Menu,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useEffect, useRef, useState } from "react";

import {
  WORKSPACE_NAVIGATION_SECTIONS,
  workspaceToolIsActive,
} from "@/lib/workspace/navigation";
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
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  const openButtonRef = useRef<HTMLButtonElement | null>(null);
  const closeButtonRef = useRef<HTMLButtonElement | null>(null);
  const drawerRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    setMobileOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!mobileOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setMobileOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = drawerRef.current
        ? Array.from(
            drawerRef.current.querySelectorAll<HTMLElement>(
              'button:not(:disabled), a[href], input:not(:disabled), select:not(:disabled), textarea:not(:disabled), [tabindex]:not([tabindex="-1"])',
            ),
          )
        : [];

      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    }

    document.addEventListener("keydown", onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
      openButtonRef.current?.focus();
    };
  }, [mobileOpen]);

  const content = (
    <div className="flex h-full min-h-0 flex-col bg-[linear-gradient(180deg,var(--slice-surface-strong),var(--slice-surface-muted))] text-[var(--slice-text)]">
      <div className="border-b border-[var(--slice-border)] p-4">
        <div className="flex items-center justify-between gap-3">
          <Link href="/workspace" aria-label="Slice workspace home">
            <GreenSliceLogo />
          </Link>
          <button
            ref={closeButtonRef}
            type="button"
            onClick={() => setMobileOpen(false)}
            className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] text-[var(--slice-muted)] transition hover:border-[var(--slice-accent-border)] hover:text-[var(--slice-heading)] lg:hidden"
            aria-label="Close navigation"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--slice-green-border)] bg-[var(--slice-green-bg)] p-3">
          <p className="truncate text-xs font-black text-[var(--slice-heading)]">
            {firmName || "Slice firm workspace"}
          </p>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <WorkspacePill tone="emerald">Active workspace</WorkspacePill>
            <WorkspacePill tone="slate">{role || "Advisor"}</WorkspacePill>
          </div>
        </div>

        <button
          type="button"
          onClick={() => {
            setMobileOpen(false);
            onOpenSearch();
          }}
          className="mt-3 flex w-full items-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-input)] px-3 py-3 text-left text-xs font-bold text-[var(--slice-muted)] shadow-sm transition hover:border-[var(--slice-accent-border)] hover:text-[var(--slice-heading)]"
        >
          <Search className="h-4 w-4 text-[var(--slice-accent)]" aria-hidden="true" />
          <span className="min-w-0 flex-1 truncate">Search Slice</span>
          <span className="rounded-md border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] px-1.5 py-0.5 text-[8px] font-black uppercase text-[var(--slice-subtle)]">
            Ctrl K
          </span>
        </button>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto px-2.5 py-3 [scrollbar-gutter:stable]">
        <nav aria-label="Workspace navigation" className="space-y-4">
          <Link
            href="/workspace"
            prefetch={false}
            className={cx(
              "group flex min-w-0 items-center gap-3 rounded-xl border px-2.5 py-2.5 transition",
              pathname === "/workspace"
                ? "border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] shadow-sm"
                : "border-transparent hover:border-[var(--slice-border)] hover:bg-[var(--slice-surface-muted)]",
            )}
            aria-current={pathname === "/workspace" ? "page" : undefined}
          >
            <span
              className={cx(
                "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
                toneClasses("emerald"),
              )}
            >
              <WorkspaceIcon name="board" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xs font-black text-[var(--slice-heading)]">
                Workspace Home
              </span>
              <span className="mt-0.5 block truncate text-[9px] font-semibold text-[var(--slice-muted)]">
                Priorities and operating pulse
              </span>
            </span>
          </Link>

          {WORKSPACE_NAVIGATION_SECTIONS.map((section) => (
            <section key={section.id} aria-labelledby={`workspace-nav-${section.id}`}>
              <p
                id={`workspace-nav-${section.id}`}
                className="px-2 pb-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-[var(--slice-subtle)]"
              >
                {section.label}
              </p>
              <div className="grid gap-1">
                {section.tools.map((tool) => {
                  const active = workspaceToolIsActive(pathname, tool.href);

                  return (
                    <Link
                      key={tool.id}
                      href={tool.href}
                      prefetch={false}
                      className={cx(
                        "group flex min-w-0 items-center gap-2.5 rounded-xl border px-2.5 py-2 transition",
                        active
                          ? "border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] shadow-sm"
                          : "border-transparent hover:border-[var(--slice-border)] hover:bg-[var(--slice-surface-muted)]",
                      )}
                      aria-current={active ? "page" : undefined}
                    >
                      <span
                        className={cx(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
                          toneClasses(tool.tone),
                          active && "ring-1 ring-[var(--slice-border)]",
                        )}
                      >
                        <WorkspaceIcon name={tool.icon} />
                      </span>

                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-xs font-black text-[var(--slice-heading)]">
                          {tool.label}
                        </span>
                        <span className="mt-0.5 block truncate text-[9px] font-semibold text-[var(--slice-muted)]">
                          {tool.subtitle}
                        </span>
                      </span>

                      <span
                        className={cx(
                          "h-1.5 w-1.5 shrink-0 rounded-full transition",
                          active
                            ? "bg-[var(--slice-accent)] shadow-[0_0_10px_var(--slice-accent-glow)]"
                            : "bg-transparent group-hover:bg-[var(--slice-subtle)]",
                        )}
                        aria-hidden="true"
                      />
                    </Link>
                  );
                })}
              </div>
            </section>
          ))}
        </nav>
      </div>

      <div className="grid gap-2 border-t border-[var(--slice-border)] p-3">
        <div className="grid grid-cols-2 gap-2">
          <Link
            href="/workspace/settings"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 py-2 text-[10px] font-black text-[var(--slice-text)] transition hover:border-[var(--slice-accent-border)] hover:bg-[var(--slice-accent-soft)]"
          >
            <SlidersHorizontal className="h-3.5 w-3.5" aria-hidden="true" />
            Settings
          </Link>
          <Link
            href="/security"
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 py-2 text-[10px] font-black text-[var(--slice-text)] transition hover:border-[var(--slice-accent-border)] hover:bg-[var(--slice-accent-soft)]"
          >
            <ShieldCheck className="h-3.5 w-3.5" aria-hidden="true" />
            Security
          </Link>
        </div>

        <button
          type="button"
          onClick={onSignOut}
          className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-[var(--slice-amber-border)] bg-[var(--slice-amber-bg)] px-3 py-2 text-[10px] font-black text-[var(--slice-amber-text)] transition hover:brightness-98"
        >
          <LogOut className="h-3.5 w-3.5" aria-hidden="true" />
          Sign out
        </button>
      </div>
    </div>
  );

  return (
    <>
      <button
        ref={openButtonRef}
        type="button"
        onClick={() => setMobileOpen(true)}
        className="fixed left-3 top-3 z-[70] grid h-11 w-11 place-items-center rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface)] text-[var(--slice-heading)] shadow-[0_10px_28px_var(--slice-shadow)] backdrop-blur-xl lg:hidden"
        aria-label="Open workspace navigation"
        aria-expanded={mobileOpen}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <aside className="hidden h-dvh border-r border-[var(--slice-border)] bg-[var(--slice-surface-strong)] shadow-[8px_0_30px_var(--slice-shadow)] lg:block">
        {content}
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-[2147483645] lg:hidden">
          <button
            type="button"
            onClick={() => setMobileOpen(false)}
            className="absolute inset-0 bg-[var(--slice-overlay)] backdrop-blur-sm"
            aria-label="Close workspace navigation"
          />
          <aside
            ref={drawerRef}
            className="absolute inset-y-0 left-0 w-[min(88vw,340px)] border-r border-[var(--slice-border)] bg-[var(--slice-surface-strong)] shadow-2xl"
            aria-label="Workspace navigation drawer"
          >
            {content}
          </aside>
        </div>
      ) : null}
    </>
  );
}