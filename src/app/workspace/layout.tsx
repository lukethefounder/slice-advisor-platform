"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

import { AdvisorRoutingDock } from "@/components/advisor-routing-dock";

const WORKSPACE_SETTINGS_KEY = "slice-workspace-settings-v5";
const THEME_KEY = "slice-theme-mode-v1";
const DENSITY_KEY = "slice-density-mode-v1";
const ACCENT_KEY = "slice-accent-mode-v1";

type ThemeMode = "dark" | "light" | "system";
type Density = "comfortable" | "compact" | "spacious";
type Accent =
  | "market-green"
  | "emerald"
  | "teal"
  | "graphite"
  | "blue";

type SavedWorkspaceSettings = {
  appearance?: {
    mode?: ThemeMode;
    density?: Density;
    accent?: string;
  };
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeTheme(value: unknown): ThemeMode {
  return value === "light" || value === "system" || value === "dark"
    ? value
    : "dark";
}

function normalizeDensity(value: unknown): Density {
  return value === "compact" ||
    value === "spacious" ||
    value === "comfortable"
    ? value
    : "comfortable";
}

function normalizeAccent(value: unknown): Accent {
  if (
    value === "emerald" ||
    value === "teal" ||
    value === "graphite" ||
    value === "blue" ||
    value === "market-green"
  ) {
    return value;
  }

  // All legacy red-family settings now migrate to the market-green identity.
  return "market-green";
}

function accentValues(accent: Accent) {
  if (accent === "emerald") {
    return {
      accent: "#059669",
      accentDark: "#064e3b",
      accentSoft: "rgba(5, 150, 105, 0.14)",
      accentBorder: "rgba(52, 211, 153, 0.36)",
    };
  }

  if (accent === "teal") {
    return {
      accent: "#0d9488",
      accentDark: "#134e4a",
      accentSoft: "rgba(13, 148, 136, 0.14)",
      accentBorder: "rgba(45, 212, 191, 0.36)",
    };
  }

  if (accent === "graphite") {
    return {
      accent: "#64748b",
      accentDark: "#0f172a",
      accentSoft: "rgba(100, 116, 139, 0.16)",
      accentBorder: "rgba(148, 163, 184, 0.32)",
    };
  }

  if (accent === "blue") {
    return {
      accent: "#0284c7",
      accentDark: "#0c4a6e",
      accentSoft: "rgba(2, 132, 199, 0.14)",
      accentBorder: "rgba(56, 189, 248, 0.34)",
    };
  }

  return {
    accent: "#10b981",
    accentDark: "#022c22",
    accentSoft: "rgba(16, 185, 129, 0.15)",
    accentBorder: "rgba(52, 211, 153, 0.38)",
  };
}

function resolveTheme(mode: ThemeMode) {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }

  return mode;
}

function applyWorkspaceTheme() {
  const saved = readJson<SavedWorkspaceSettings>(
    WORKSPACE_SETTINGS_KEY,
    {},
  );
  const rawTheme =
    saved.appearance?.mode ||
    window.localStorage.getItem(THEME_KEY) ||
    "dark";
  const rawDensity =
    saved.appearance?.density ||
    window.localStorage.getItem(DENSITY_KEY) ||
    "comfortable";
  const rawAccent =
    saved.appearance?.accent ||
    window.localStorage.getItem(ACCENT_KEY) ||
    "market-green";

  const mode = normalizeTheme(rawTheme);
  const theme = resolveTheme(mode);
  const density = normalizeDensity(rawDensity);
  const accent = normalizeAccent(rawAccent);
  const colors = accentValues(accent);
  const root = document.documentElement;

  root.dataset.sliceTheme = theme;
  root.dataset.sliceThemeMode = mode;
  root.dataset.sliceDensity = density;
  root.dataset.sliceAccent = accent;
  root.style.colorScheme = theme;
  root.style.setProperty("--slice-accent", colors.accent);
  root.style.setProperty("--slice-accent-dark", colors.accentDark);
  root.style.setProperty("--slice-accent-soft", colors.accentSoft);
  root.style.setProperty("--slice-accent-border", colors.accentBorder);

  if (theme === "light") {
    root.style.setProperty("--slice-bg", "#f0fdf4");
    root.style.setProperty("--slice-bg-2", "#ecfdf5");
    root.style.setProperty("--slice-surface", "rgba(255,255,255,0.94)");
    root.style.setProperty("--slice-surface-strong", "#ffffff");
    root.style.setProperty("--slice-panel", "rgba(6,78,59,0.05)");
    root.style.setProperty("--slice-panel-2", "rgba(255,255,255,0.80)");
    root.style.setProperty("--slice-input", "#ffffff");
    root.style.setProperty("--slice-text", "#052e16");
    root.style.setProperty("--slice-muted", "#4b5563");
    root.style.setProperty("--slice-muted-2", "#334155");
    root.style.setProperty("--slice-border", "rgba(6,78,59,0.13)");
    root.style.setProperty("--slice-shadow", "rgba(6,78,59,0.12)");
  } else {
    root.style.setProperty("--slice-bg", "#010604");
    root.style.setProperty("--slice-bg-2", "#022c22");
    root.style.setProperty("--slice-surface", "rgba(3,12,9,0.84)");
    root.style.setProperty("--slice-surface-strong", "#020806");
    root.style.setProperty("--slice-panel", "rgba(52,211,153,0.055)");
    root.style.setProperty("--slice-panel-2", "rgba(0,0,0,0.36)");
    root.style.setProperty("--slice-input", "rgba(0,0,0,0.44)");
    root.style.setProperty("--slice-text", "#f0fdf4");
    root.style.setProperty("--slice-muted", "#94a3b8");
    root.style.setProperty("--slice-muted-2", "#d1fae5");
    root.style.setProperty("--slice-border", "rgba(52,211,153,0.12)");
    root.style.setProperty("--slice-shadow", "rgba(0,0,0,0.40)");
  }
}

export default function WorkspaceLayout({
  children,
}: {
  children: ReactNode;
}) {
  useEffect(() => {
    applyWorkspaceTheme();

    const media = window.matchMedia("(prefers-color-scheme: dark)");

    function handleChange() {
      applyWorkspaceTheme();
    }

    window.addEventListener("storage", handleChange);
    window.addEventListener("slice-theme-change", handleChange);
    window.addEventListener("slice-workspace-settings-change", handleChange);
    media.addEventListener?.("change", handleChange);

    return () => {
      window.removeEventListener("storage", handleChange);
      window.removeEventListener("slice-theme-change", handleChange);
      window.removeEventListener(
        "slice-workspace-settings-change",
        handleChange,
      );
      media.removeEventListener?.("change", handleChange);
    };
  }, []);

  return (
    <div className="slice-workspace-theme-root">
      <style
        dangerouslySetInnerHTML={{
          __html: `
            .slice-workspace-theme-root {
              color: var(--slice-text);
            }

            .slice-workspace-theme-root * {
              transition-property: background-color, border-color, color, box-shadow, opacity;
              transition-duration: 180ms;
              transition-timing-function: ease;
            }

            html[data-slice-density="compact"] .slice-workspace-theme-root {
              --slice-density-pad: 0.75rem;
              --slice-density-gap: 0.75rem;
            }

            html[data-slice-density="comfortable"] .slice-workspace-theme-root {
              --slice-density-pad: 1rem;
              --slice-density-gap: 1rem;
            }

            html[data-slice-density="spacious"] .slice-workspace-theme-root {
              --slice-density-pad: 1.35rem;
              --slice-density-gap: 1.35rem;
            }

            html[data-slice-theme="light"] .slice-workspace-theme-root main {
              background:
                radial-gradient(circle at top left, rgba(16,185,129,0.14), transparent 30%),
                radial-gradient(circle at top right, rgba(34,211,238,0.10), transparent 28%),
                linear-gradient(135deg, var(--slice-bg), var(--slice-bg-2)) !important;
              color: var(--slice-text) !important;
            }

            html[data-slice-theme="dark"] .slice-workspace-theme-root main {
              background:
                radial-gradient(circle at top left, rgba(5,150,105,0.30), transparent 30%),
                radial-gradient(circle at top right, rgba(34,211,238,0.10), transparent 28%),
                linear-gradient(135deg, var(--slice-bg), #020806, #07130e, var(--slice-bg-2)) !important;
              color: var(--slice-text) !important;
            }

            html[data-slice-theme="light"] .slice-workspace-theme-root .text-white,
            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="text-slate-100"],
            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="text-slate-200"],
            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="text-slate-300"] {
              color: var(--slice-text) !important;
            }

            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="text-slate-400"],
            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="text-slate-500"],
            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="text-zinc-400"] {
              color: var(--slice-muted) !important;
            }

            .slice-workspace-theme-root input,
            .slice-workspace-theme-root textarea,
            .slice-workspace-theme-root select {
              caret-color: var(--slice-accent);
            }
          `,
        }}
      />

      {children}
      <AdvisorRoutingDock />
    </div>
  );
}