"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronRight, Search, UserRound } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import {
  WORKSPACE_MOBILE_TOOLS,
  workspaceBreadcrumbs,
  workspaceRouteMeta,
  workspaceToolIsActive,
} from "@/lib/workspace/navigation";
import {
  applyWorkspaceAppearance,
  readWorkspaceAppearance,
  watchWorkspaceAppearance,
  type WorkspaceAppearanceSnapshot,
} from "@/lib/workspace/appearance";
import WorkspaceCommandPalette from "@/components/workspace/core/workspace-command-palette";
import WorkspaceSidebar from "@/components/workspace/core/workspace-sidebar";
import {
  GreenSliceLogo,
  WorkspaceIcon,
  WorkspacePill,
  cx,
} from "@/components/workspace/core/workspace-ui";

type AuthPayload = {
  authenticated?: boolean;
  user?: {
    id?: string;
    name?: string;
    email?: string;
  } | null;
  access?: {
    firm?: {
      id?: string;
      name?: string;
    } | null;
    membership?: {
      id?: string;
      role?: string;
    } | null;
  } | null;
};

const DEFAULT_APPEARANCE: WorkspaceAppearanceSnapshot = {
  mode: "light",
  resolvedTheme: "light",
  density: "comfortable",
  accent: "market-green",
  cardStyle: "glass",
  navigationStyle: "executive",
  motion: "full",
  textScale: "standard",
  compactSidebar: false,
  commandBarPinned: true,
};

export default function WorkspaceShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [commandOpen, setCommandOpen] = useState(false);
  const [auth, setAuth] = useState<AuthPayload | null>(null);
  const [appearance, setAppearance] = useState<WorkspaceAppearanceSnapshot>(
    DEFAULT_APPEARANCE,
  );

  const meta = useMemo(() => workspaceRouteMeta(pathname), [pathname]);
  const breadcrumbs = useMemo(() => workspaceBreadcrumbs(pathname), [pathname]);

  const loadIdentity = useCallback(async () => {
    try {
      const response = await fetch("/api/auth/me", { cache: "no-store" });
      if (!response.ok) return;
      setAuth((await response.json()) as AuthPayload);
    } catch {
      // The workspace remains usable if identity metadata is briefly unavailable.
    }
  }, []);

  useEffect(() => {
    setAppearance(applyWorkspaceAppearance(readWorkspaceAppearance()));
    void loadIdentity();
    return watchWorkspaceAppearance((next) => setAppearance(next));
  }, [loadIdentity]);

  useEffect(() => {
    function openCommand(event: KeyboardEvent) {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setCommandOpen(true);
      }
    }

    document.addEventListener("keydown", openCommand);
    return () => document.removeEventListener("keydown", openCommand);
  }, []);

  async function signOut() {
    await fetch("/api/auth/logout", { method: "POST" }).catch(() => null);
    window.location.href = "/founder-login";
  }

  const role = auth?.access?.membership?.role || "Advisor";
  const firmName = auth?.access?.firm?.name || "Slice firm workspace";
  const userName = auth?.user?.name || auth?.user?.email || "Advisor";
  const isWorkspaceHome = pathname === "/workspace";
  const sidebarWidth =
    appearance.compactSidebar || appearance.navigationStyle === "compact"
      ? "lg:grid-cols-[242px_minmax(0,1fr)]"
      : "lg:grid-cols-[286px_minmax(0,1fr)]";

  if (isWorkspaceHome) {
    return (
      <div className="slice-workspace-theme-root min-h-dvh">
        <a
          href="#workspace-main"
          className="sr-only z-[200] rounded-lg bg-[var(--slice-accent-strong)] px-4 py-2 font-black text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
        >
          Skip to workspace content
        </a>
        <div id="workspace-main">{children}</div>
      </div>
    );
  }

  return (
    <div className="slice-workspace-theme-root min-h-dvh text-[var(--slice-text)]">
      <a
        href="#workspace-main"
        className="sr-only z-[200] rounded-lg bg-[var(--slice-accent-strong)] px-4 py-2 font-black text-white focus:not-sr-only focus:fixed focus:left-3 focus:top-3"
      >
        Skip to workspace content
      </a>

      <div className={cx("min-h-dvh lg:grid", sidebarWidth)}>
        <div className="min-h-0 lg:sticky lg:top-0 lg:h-dvh">
          <WorkspaceSidebar
            onOpenSearch={() => setCommandOpen(true)}
            onSignOut={() => void signOut()}
            role={role}
            firmName={firmName}
          />
        </div>

        <div className="min-w-0 pb-20 lg:pb-0">
          <header className="slice-context-header sticky top-0 z-40 border-b border-[var(--slice-border)] bg-[color-mix(in_srgb,var(--slice-surface-strong)_88%,transparent)] shadow-[0_10px_32px_var(--slice-shadow)] backdrop-blur-xl">
            <div className="flex min-h-16 items-center gap-3 px-16 py-3 sm:px-5 lg:px-6">
              <div className="hidden lg:block">
                <GreenSliceLogo compact />
              </div>

              <div className="min-w-0 flex-1">
                <nav aria-label="Breadcrumb" className="hidden items-center gap-1.5 sm:flex">
                  {breadcrumbs.map((item, index) => (
                    <span
                      key={`${item.href}-${index}`}
                      className="flex min-w-0 items-center gap-1.5"
                    >
                      {index ? (
                        <ChevronRight
                          className="h-3 w-3 shrink-0 text-[var(--slice-subtle)]"
                          aria-hidden="true"
                        />
                      ) : null}
                      <Link
                        href={item.href}
                        aria-current={item.current ? "page" : undefined}
                        className={cx(
                          "truncate text-[10px] font-black uppercase tracking-[0.13em]",
                          item.current
                            ? "text-[var(--slice-accent-strong)]"
                            : "text-[var(--slice-muted)] hover:text-[var(--slice-heading)]",
                        )}
                      >
                        {item.label}
                      </Link>
                    </span>
                  ))}
                </nav>

                <div className="mt-0.5 flex min-w-0 items-center gap-2 sm:mt-1">
                  <h2 className="truncate text-sm font-black text-[var(--slice-heading)] sm:text-base">
                    {meta.label}
                  </h2>
                  <WorkspacePill tone="slate">{meta.category}</WorkspacePill>
                </div>
              </div>

              {appearance.commandBarPinned ? (
                <button
                  type="button"
                  onClick={() => setCommandOpen(true)}
                  className="hidden min-h-10 items-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 text-xs font-bold text-[var(--slice-muted)] shadow-sm transition hover:border-[var(--slice-accent-border)] hover:text-[var(--slice-heading)] sm:inline-flex"
                >
                  <Search className="h-4 w-4 text-[var(--slice-accent)]" aria-hidden="true" />
                  Search
                  <span className="rounded-md border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] px-1.5 py-0.5 text-[8px] font-black text-[var(--slice-subtle)]">
                    Ctrl K
                  </span>
                </button>
              ) : null}

              <div className="hidden min-w-0 items-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 py-2 shadow-sm xl:flex">
                <div className="grid h-8 w-8 place-items-center rounded-lg border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-[var(--slice-accent-strong)]">
                  <UserRound className="h-4 w-4" aria-hidden="true" />
                </div>
                <div className="min-w-0">
                  <p className="max-w-36 truncate text-[10px] font-black text-[var(--slice-heading)]">
                    {userName}
                  </p>
                  <p className="max-w-36 truncate text-[9px] font-semibold text-[var(--slice-muted)]">
                    {firmName}
                  </p>
                </div>
              </div>
            </div>
          </header>

          <div id="workspace-main" className="min-h-[calc(100dvh-4rem)] min-w-0">
            {children}
          </div>
        </div>
      </div>

      <nav
        aria-label="Mobile workspace navigation"
        className="fixed inset-x-2 bottom-2 z-50 grid grid-cols-5 rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface)] p-1.5 shadow-[0_20px_60px_var(--slice-shadow)] backdrop-blur-xl lg:hidden"
      >
        {WORKSPACE_MOBILE_TOOLS.map((tool) => {
          const active = workspaceToolIsActive(pathname, tool.href);

          return (
            <Link
              key={tool.id}
              href={tool.href}
              prefetch={false}
              aria-current={active ? "page" : undefined}
              className={cx(
                "flex min-h-12 min-w-0 flex-col items-center justify-center gap-1 rounded-xl px-1 text-[9px] font-black transition",
                active
                  ? "bg-[linear-gradient(110deg,var(--slice-accent),var(--slice-accent-strong))] text-white"
                  : "text-[var(--slice-muted)] hover:bg-[var(--slice-accent-soft)] hover:text-[var(--slice-heading)]",
              )}
            >
              <WorkspaceIcon name={tool.icon} className="h-4 w-4" />
              <span className="max-w-full truncate">{tool.shortLabel}</span>
            </Link>
          );
        })}
      </nav>

      <WorkspaceCommandPalette open={commandOpen} onClose={() => setCommandOpen(false)} />
    </div>
  );
}