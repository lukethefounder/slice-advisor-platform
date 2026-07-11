"use client";

import type { ReactNode } from "react";
import { useEffect } from "react";

const WORKSPACE_SETTINGS_KEY = "slice-workspace-settings-v5";
const THEME_KEY = "slice-theme-mode-v1";
const DENSITY_KEY = "slice-density-mode-v1";
const ACCENT_KEY = "slice-accent-mode-v1";

type ThemeMode = "dark" | "light" | "system";
type Density = "comfortable" | "compact" | "spacious";
type Accent = "slice-red" | "crimson" | "ruby" | "graphite" | "blue";

type SavedWorkspaceSettings = {
  appearance?: {
    mode?: ThemeMode;
    density?: Density;
    accent?: Accent;
  };
};

function readJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function normalizeTheme(value: unknown): ThemeMode {
  if (value === "light" || value === "system" || value === "dark") return value;
  return "dark";
}

function normalizeDensity(value: unknown): Density {
  if (value === "compact" || value === "spacious" || value === "comfortable") return value;
  return "comfortable";
}

function normalizeAccent(value: unknown): Accent {
  if (
    value === "crimson" ||
    value === "ruby" ||
    value === "graphite" ||
    value === "blue" ||
    value === "slice-red"
  ) {
    return value;
  }

  return "slice-red";
}

function accentValues(accent: Accent) {
  if (accent === "crimson") {
    return {
      accent: "#b91c1c",
      accentDark: "#7f1d1d",
      accentSoft: "rgba(185, 28, 28, 0.14)",
      accentBorder: "rgba(185, 28, 28, 0.38)",
    };
  }

  if (accent === "ruby") {
    return {
      accent: "#e11d48",
      accentDark: "#881337",
      accentSoft: "rgba(225, 29, 72, 0.14)",
      accentBorder: "rgba(225, 29, 72, 0.38)",
    };
  }

  if (accent === "graphite") {
    return {
      accent: "#475569",
      accentDark: "#0f172a",
      accentSoft: "rgba(71, 85, 105, 0.16)",
      accentBorder: "rgba(71, 85, 105, 0.42)",
    };
  }

  if (accent === "blue") {
    return {
      accent: "#2563eb",
      accentDark: "#1e3a8a",
      accentSoft: "rgba(37, 99, 235, 0.14)",
      accentBorder: "rgba(37, 99, 235, 0.38)",
    };
  }

  return {
    accent: "#dc2626",
    accentDark: "#7f1d1d",
    accentSoft: "rgba(220, 38, 38, 0.16)",
    accentBorder: "rgba(220, 38, 38, 0.40)",
  };
}

function resolveTheme(mode: ThemeMode) {
  if (mode === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
  }

  return mode;
}

function applyWorkspaceTheme() {
  const saved = readJson<SavedWorkspaceSettings>(WORKSPACE_SETTINGS_KEY, {});
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
    "slice-red";

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
    root.style.setProperty("--slice-bg", "#f8fafc");
    root.style.setProperty("--slice-bg-2", "#fff7f7");
    root.style.setProperty("--slice-surface", "rgba(255,255,255,0.94)");
    root.style.setProperty("--slice-surface-strong", "#ffffff");
    root.style.setProperty("--slice-panel", "rgba(15,23,42,0.045)");
    root.style.setProperty("--slice-panel-2", "rgba(255,255,255,0.76)");
    root.style.setProperty("--slice-input", "#ffffff");
    root.style.setProperty("--slice-text", "#0f172a");
    root.style.setProperty("--slice-muted", "#64748b");
    root.style.setProperty("--slice-muted-2", "#475569");
    root.style.setProperty("--slice-border", "rgba(15,23,42,0.12)");
    root.style.setProperty("--slice-shadow", "rgba(15,23,42,0.12)");
  } else {
    root.style.setProperty("--slice-bg", "#020202");
    root.style.setProperty("--slice-bg-2", "#260606");
    root.style.setProperty("--slice-surface", "rgba(9,9,11,0.82)");
    root.style.setProperty("--slice-surface-strong", "#09090b");
    root.style.setProperty("--slice-panel", "rgba(255,255,255,0.055)");
    root.style.setProperty("--slice-panel-2", "rgba(0,0,0,0.36)");
    root.style.setProperty("--slice-input", "rgba(0,0,0,0.44)");
    root.style.setProperty("--slice-text", "#ffffff");
    root.style.setProperty("--slice-muted", "#94a3b8");
    root.style.setProperty("--slice-muted-2", "#cbd5e1");
    root.style.setProperty("--slice-border", "rgba(255,255,255,0.11)");
    root.style.setProperty("--slice-shadow", "rgba(0,0,0,0.38)");
  }
}

export default function WorkspaceLayout({ children }: { children: ReactNode }) {
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
      window.removeEventListener("slice-workspace-settings-change", handleChange);
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
                radial-gradient(circle at top left, rgba(220, 38, 38, 0.11), transparent 30%),
                radial-gradient(circle at top right, rgba(37, 99, 235, 0.12), transparent 30%),
                linear-gradient(135deg, var(--slice-bg), var(--slice-bg-2)) !important;
              color: var(--slice-text) !important;
            }

            html[data-slice-theme="dark"] .slice-workspace-theme-root main {
              background:
                radial-gradient(circle at top left, rgba(127, 29, 29, 0.45), transparent 30%),
                radial-gradient(circle at top right, rgba(239, 68, 68, 0.18), transparent 26%),
                linear-gradient(135deg, var(--slice-bg), #09090b, #111111, var(--slice-bg-2)) !important;
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
            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="text-zinc-400"],
            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="text-zinc-500"] {
              color: var(--slice-muted) !important;
            }

            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="bg-[#050505]"],
            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="bg-[#050202]"],
            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="bg-zinc-950"],
            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="bg-zinc-900"],
            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="bg-black/"],
            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="bg-white/["] {
              background-color: var(--slice-surface) !important;
            }

            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="border-white/"],
            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="border-zinc-"],
            html[data-slice-theme="light"] .slice-workspace-theme-root [class*="border-slate-"] {
              border-color: var(--slice-border) !important;
            }

            .slice-workspace-theme-root [class*="text-red-"] {
              color: var(--slice-accent) !important;
            }

            .slice-workspace-theme-root [class*="border-red-"] {
              border-color: var(--slice-accent-border) !important;
            }

            .slice-workspace-theme-root [class*="ring-red-"] {
              --tw-ring-color: var(--slice-accent-border) !important;
            }

            .slice-workspace-theme-root [class*="bg-red-"] {
              background-color: var(--slice-accent-soft) !important;
            }

            .slice-workspace-theme-root [class*="from-red-"] {
              --tw-gradient-from: var(--slice-accent-dark) var(--tw-gradient-from-position) !important;
              --tw-gradient-to: color-mix(in srgb, var(--slice-accent-dark) 0%, transparent) var(--tw-gradient-to-position) !important;
              --tw-gradient-stops: var(--tw-gradient-from), var(--tw-gradient-to) !important;
            }

            .slice-workspace-theme-root [class*="via-red-"] {
              --tw-gradient-to: color-mix(in srgb, var(--slice-accent) 0%, transparent) var(--tw-gradient-to-position) !important;
              --tw-gradient-stops: var(--tw-gradient-from), var(--slice-accent) var(--tw-gradient-via-position), var(--tw-gradient-to) !important;
            }

            .slice-workspace-theme-root [class*="to-red-"] {
              --tw-gradient-to: var(--slice-accent) var(--tw-gradient-to-position) !important;
            }

            .slice-workspace-theme-root input,
            .slice-workspace-theme-root textarea,
            .slice-workspace-theme-root select {
              color: var(--slice-text);
            }

            html[data-slice-theme="light"] .slice-workspace-theme-root input,
            html[data-slice-theme="light"] .slice-workspace-theme-root textarea,
            html[data-slice-theme="light"] .slice-workspace-theme-root select {
              background: var(--slice-input) !important;
              color: var(--slice-text) !important;
              border-color: var(--slice-border) !important;
            }

            html[data-slice-theme="light"] .slice-workspace-theme-root ::placeholder {
              color: #94a3b8 !important;
            }
          `,
        }}
      />
      {children}
    </div>
  );
}