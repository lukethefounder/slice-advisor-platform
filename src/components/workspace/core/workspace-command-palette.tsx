"use client";

import { createPortal } from "react-dom";
import { useRouter } from "next/navigation";
import { ArrowRight, Search, X } from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
} from "react";

import { searchWorkspaceTools } from "@/lib/workspace-green-core";
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
  const router = useRouter();
  const listboxId = useId();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const deferredQuery = useDeferredValue(query);
  const tools = useMemo(() => searchWorkspaceTools(deferredQuery), [deferredQuery]);

  useEffect(() => setMounted(true), []);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setActiveIndex(0);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    previousFocusRef.current = document.activeElement as HTMLElement | null;
    document.body.style.overflow = "hidden";
    const focusTimer = window.setTimeout(() => inputRef.current?.focus(), 0);

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }

      if (event.key !== "Tab") return;
      const focusable = dialogRef.current
        ? Array.from(
            dialogRef.current.querySelectorAll<HTMLElement>(
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
      window.clearTimeout(focusTimer);
      document.removeEventListener("keydown", onKeyDown);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [onClose, open]);

  useEffect(() => {
    setActiveIndex((current) => Math.min(current, Math.max(tools.length - 1, 0)));
  }, [tools.length]);

  function choose(index: number) {
    const tool = tools[index];
    if (!tool) return;
    onClose();
    router.push(tool.href);
  }

  if (!mounted || !open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[2147483646] grid place-items-start bg-[var(--slice-overlay)] p-3 pt-[7vh] backdrop-blur-md sm:p-6 sm:pt-[11vh]">
      <button
        type="button"
        onClick={onClose}
        className="absolute inset-0"
        aria-label="Close command palette"
      />

      <section
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="workspace-command-title"
        className="relative mx-auto w-full max-w-3xl overflow-hidden rounded-[1.65rem] border border-[var(--slice-border-strong)] bg-[var(--slice-surface-strong)] shadow-[0_36px_110px_var(--slice-shadow)]"
      >
        <div className="flex items-center gap-3 border-b border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-4">
          <Search className="h-5 w-5 shrink-0 text-[var(--slice-accent)]" aria-hidden="true" />
          <label htmlFor="workspace-command-input" className="sr-only">
            Search Slice workspace
          </label>
          <input
            ref={inputRef}
            id="workspace-command-input"
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setActiveIndex(0);
            }}
            onKeyDown={(event) => {
              if (event.key === "ArrowDown") {
                event.preventDefault();
                setActiveIndex((current) => (tools.length ? (current + 1) % tools.length : 0));
              }

              if (event.key === "ArrowUp") {
                event.preventDefault();
                setActiveIndex((current) =>
                  tools.length ? (current - 1 + tools.length) % tools.length : 0,
                );
              }

              if (event.key === "Enter") {
                event.preventDefault();
                choose(activeIndex);
              }
            }}
            role="combobox"
            aria-expanded="true"
            aria-controls={listboxId}
            aria-activedescendant={
              tools[activeIndex] ? `${listboxId}-${activeIndex}` : undefined
            }
            placeholder="Search clients, intelligence, email, documents, team…"
            className="min-w-0 flex-1 bg-transparent text-base font-bold text-[var(--slice-heading)] outline-none placeholder:text-[var(--slice-subtle)]"
            autoComplete="off"
          />
          <span className="hidden rounded-lg border border-[var(--slice-border)] bg-white px-2 py-1 text-[9px] font-black uppercase text-[var(--slice-subtle)] sm:inline-flex">
            ↑ ↓ Enter
          </span>
          <button
            type="button"
            onClick={onClose}
            className="grid h-10 w-10 place-items-center rounded-xl border border-[var(--slice-border)] bg-white text-[var(--slice-muted)] shadow-sm transition hover:border-[var(--slice-accent-border)] hover:text-[var(--slice-heading)]"
            aria-label="Close command palette"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        <div className="border-b border-[var(--slice-border)] px-4 py-3">
          <p id="workspace-command-title" className="text-xs font-black text-[var(--slice-heading)]">
            Navigate the Slice operating system
          </p>
          <p className="mt-1 text-[11px] font-semibold text-[var(--slice-muted)]">
            Results are route-aware and use the existing workspace tool registry.
          </p>
        </div>

        <div
          id={listboxId}
          role="listbox"
          aria-label="Workspace destinations"
          className="max-h-[64vh] space-y-1.5 overflow-y-auto p-3 [scrollbar-gutter:stable]"
        >
          {tools.map((tool, index) => {
            const active = index === activeIndex;

            return (
              <button
                key={tool.id}
                id={`${listboxId}-${index}`}
                type="button"
                role="option"
                aria-selected={active}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(index)}
                className={cx(
                  "group flex w-full min-w-0 items-center gap-3 rounded-2xl border p-3 text-left transition",
                  active
                    ? "border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] shadow-sm"
                    : "border-[var(--slice-border)] bg-[var(--slice-surface-muted)] hover:border-[var(--slice-border-strong)] hover:bg-white",
                )}
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
                    <span className="truncate text-sm font-black text-[var(--slice-heading)]">
                      {tool.label}
                    </span>
                    <WorkspacePill tone={tool.tone}>{tool.category}</WorkspacePill>
                  </span>
                  <span className="mt-1 block line-clamp-2 text-xs font-semibold leading-5 text-[var(--slice-muted)]">
                    {tool.description}
                  </span>
                  <span className="mt-1 block truncate text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-accent-strong)]">
                    {tool.outcome}
                  </span>
                </span>

                <ArrowRight
                  className={cx(
                    "h-4 w-4 shrink-0 transition",
                    active
                      ? "translate-x-0.5 text-[var(--slice-accent)]"
                      : "text-[var(--slice-subtle)] group-hover:text-[var(--slice-accent)]",
                  )}
                  aria-hidden="true"
                />
              </button>
            );
          })}

          {!tools.length ? (
            <div className="rounded-2xl border border-dashed border-[var(--slice-border-strong)] bg-[var(--slice-surface-muted)] p-8 text-center">
              <p className="text-sm font-black text-[var(--slice-heading)]">
                No matching workspace tool
              </p>
              <p className="mt-2 text-xs font-semibold leading-5 text-[var(--slice-muted)]">
                Try a route name such as clients, documents, intelligence, email, or settings.
              </p>
            </div>
          ) : null}
        </div>
      </section>
    </div>,
    document.body,
  );
}