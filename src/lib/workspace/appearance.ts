"use client";

export const WORKSPACE_SETTINGS_KEY = "slice-workspace-settings-v5";
export const THEME_KEY = "slice-theme-mode-v1";
export const DENSITY_KEY = "slice-density-mode-v1";
export const ACCENT_KEY = "slice-accent-mode-v1";
export const LIGHT_DEFAULT_MIGRATION_KEY = "slice-light-default-v1";

export type WorkspaceThemeMode = "dark" | "light" | "system";
export type WorkspaceDensity = "comfortable" | "compact" | "spacious";
export type WorkspaceAccent =
  | "market-green"
  | "emerald"
  | "teal"
  | "graphite"
  | "blue";
export type WorkspaceCardStyle = "glass" | "solid" | "minimal";
export type WorkspaceNavigationStyle = "executive" | "compact" | "command";
export type WorkspaceMotionMode = "full" | "reduced";
export type WorkspaceTextScale = "standard" | "large" | "extra-large";

export type WorkspaceAppearanceSnapshot = {
  mode: WorkspaceThemeMode;
  resolvedTheme: "dark" | "light";
  density: WorkspaceDensity;
  accent: WorkspaceAccent;
  cardStyle: WorkspaceCardStyle;
  navigationStyle: WorkspaceNavigationStyle;
  motion: WorkspaceMotionMode;
  textScale: WorkspaceTextScale;
  compactSidebar: boolean;
  commandBarPinned: boolean;
};

type StoredWorkspaceSettings = {
  appearance?: Partial<{
    mode: WorkspaceThemeMode;
    density: WorkspaceDensity;
    accent: WorkspaceAccent;
    cardStyle: WorkspaceCardStyle;
    navigationStyle: WorkspaceNavigationStyle;
    motion: WorkspaceMotionMode;
    textScale: WorkspaceTextScale;
  }>;
  workspace?: Partial<{
    compactSidebar: boolean;
    commandBarPinned: boolean;
  }>;
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

function parseStoredSettings(raw: string | null): StoredWorkspaceSettings {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? (parsed as StoredWorkspaceSettings)
      : {};
  } catch {
    return {};
  }
}

function writeStoredSettings(value: StoredWorkspaceSettings) {
  if (typeof window === "undefined") return;

  try {
    window.localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify(value));
  } catch {
    // Browser storage is optional; the in-memory light default still applies.
  }
}

/**
 * Phase 23 intentionally migrates the old dark-by-default experience to the
 * new white-and-green default once. After this marker is written, Settings
 * remains authoritative and users may switch to Dark or System at any time.
 */
export function ensureLightDefaultPreference() {
  if (typeof window === "undefined") return;

  try {
    if (window.localStorage.getItem(LIGHT_DEFAULT_MIGRATION_KEY)) return;

    const stored = parseStoredSettings(
      window.localStorage.getItem(WORKSPACE_SETTINGS_KEY),
    );

    writeStoredSettings({
      ...stored,
      appearance: {
        ...stored.appearance,
        mode: "light",
      },
    });

    window.localStorage.setItem(THEME_KEY, "light");
    window.localStorage.setItem(LIGHT_DEFAULT_MIGRATION_KEY, "complete");
  } catch {
    // A blocked localStorage implementation should not stop the application.
  }
}

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function oneOf<T extends string>(
  value: unknown,
  allowed: readonly T[],
  fallback: T,
): T {
  return typeof value === "string" && allowed.includes(value as T)
    ? (value as T)
    : fallback;
}

function resolveTheme(mode: WorkspaceThemeMode): "dark" | "light" {
  if (typeof window === "undefined") return "light";
  if (mode !== "system") return mode;

  return window.matchMedia("(prefers-color-scheme: dark)").matches
    ? "dark"
    : "light";
}

export function readWorkspaceAppearance(): WorkspaceAppearanceSnapshot {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;

  ensureLightDefaultPreference();

  const stored = readJson<StoredWorkspaceSettings>(WORKSPACE_SETTINGS_KEY, {});
  const mode = oneOf(
    stored.appearance?.mode ?? window.localStorage.getItem(THEME_KEY),
    ["dark", "light", "system"] as const,
    DEFAULT_APPEARANCE.mode,
  );
  const density = oneOf(
    stored.appearance?.density ?? window.localStorage.getItem(DENSITY_KEY),
    ["comfortable", "compact", "spacious"] as const,
    DEFAULT_APPEARANCE.density,
  );
  const accent = oneOf(
    stored.appearance?.accent ?? window.localStorage.getItem(ACCENT_KEY),
    ["market-green", "emerald", "teal", "graphite", "blue"] as const,
    DEFAULT_APPEARANCE.accent,
  );

  return {
    mode,
    resolvedTheme: resolveTheme(mode),
    density,
    accent,
    cardStyle: oneOf(
      stored.appearance?.cardStyle,
      ["glass", "solid", "minimal"] as const,
      DEFAULT_APPEARANCE.cardStyle,
    ),
    navigationStyle: oneOf(
      stored.appearance?.navigationStyle,
      ["executive", "compact", "command"] as const,
      DEFAULT_APPEARANCE.navigationStyle,
    ),
    motion: oneOf(
      stored.appearance?.motion,
      ["full", "reduced"] as const,
      DEFAULT_APPEARANCE.motion,
    ),
    textScale: oneOf(
      stored.appearance?.textScale,
      ["standard", "large", "extra-large"] as const,
      DEFAULT_APPEARANCE.textScale,
    ),
    compactSidebar: stored.workspace?.compactSidebar === true,
    commandBarPinned: stored.workspace?.commandBarPinned !== false,
  };
}

function accentValues(accent: WorkspaceAccent) {
  if (accent === "teal") {
    return {
      main: "#0f9f8c",
      strong: "#0f766e",
      dark: "#134e4a",
      soft: "rgba(20,184,166,0.11)",
      border: "rgba(13,148,136,0.25)",
      glow: "rgba(20,184,166,0.18)",
    };
  }

  if (accent === "graphite") {
    return {
      main: "#64748b",
      strong: "#475569",
      dark: "#1e293b",
      soft: "rgba(100,116,139,0.10)",
      border: "rgba(100,116,139,0.22)",
      glow: "rgba(100,116,139,0.14)",
    };
  }

  if (accent === "blue") {
    return {
      main: "#0ea5e9",
      strong: "#0284c7",
      dark: "#0c4a6e",
      soft: "rgba(14,165,233,0.10)",
      border: "rgba(14,165,233,0.24)",
      glow: "rgba(14,165,233,0.16)",
    };
  }

  if (accent === "emerald") {
    return {
      main: "#10b981",
      strong: "#047857",
      dark: "#064e3b",
      soft: "rgba(16,185,129,0.11)",
      border: "rgba(5,150,105,0.24)",
      glow: "rgba(16,185,129,0.18)",
    };
  }

  return {
    main: "#16a36f",
    strong: "#087f57",
    dark: "#07533c",
    soft: "rgba(22,163,111,0.105)",
    border: "rgba(22,163,111,0.24)",
    glow: "rgba(22,163,111,0.18)",
  };
}

function setToneVariables(root: HTMLElement, light: boolean) {
  if (light) {
    root.style.setProperty("--slice-green-bg", "rgba(16,185,129,0.10)");
    root.style.setProperty("--slice-green-text", "#08724f");
    root.style.setProperty("--slice-green-border", "rgba(5,150,105,0.22)");
    root.style.setProperty("--slice-cyan-bg", "rgba(6,182,212,0.09)");
    root.style.setProperty("--slice-cyan-text", "#0e7490");
    root.style.setProperty("--slice-cyan-border", "rgba(8,145,178,0.22)");
    root.style.setProperty("--slice-amber-bg", "rgba(245,158,11,0.10)");
    root.style.setProperty("--slice-amber-text", "#9a5b08");
    root.style.setProperty("--slice-amber-border", "rgba(217,119,6,0.22)");
    root.style.setProperty("--slice-rose-bg", "rgba(244,63,94,0.085)");
    root.style.setProperty("--slice-rose-text", "#be123c");
    root.style.setProperty("--slice-rose-border", "rgba(225,29,72,0.20)");
    root.style.setProperty("--slice-violet-bg", "rgba(139,92,246,0.085)");
    root.style.setProperty("--slice-violet-text", "#6d28d9");
    root.style.setProperty("--slice-violet-border", "rgba(124,58,237,0.20)");
    root.style.setProperty("--slice-slate-bg", "rgba(100,116,139,0.08)");
    root.style.setProperty("--slice-slate-text", "#516276");
    root.style.setProperty("--slice-slate-border", "rgba(100,116,139,0.16)");
  } else {
    root.style.setProperty("--slice-green-bg", "rgba(16,185,129,0.11)");
    root.style.setProperty("--slice-green-text", "#a7f3d0");
    root.style.setProperty("--slice-green-border", "rgba(52,211,153,0.24)");
    root.style.setProperty("--slice-cyan-bg", "rgba(6,182,212,0.10)");
    root.style.setProperty("--slice-cyan-text", "#a5f3fc");
    root.style.setProperty("--slice-cyan-border", "rgba(34,211,238,0.22)");
    root.style.setProperty("--slice-amber-bg", "rgba(245,158,11,0.10)");
    root.style.setProperty("--slice-amber-text", "#fde68a");
    root.style.setProperty("--slice-amber-border", "rgba(251,191,36,0.22)");
    root.style.setProperty("--slice-rose-bg", "rgba(244,63,94,0.10)");
    root.style.setProperty("--slice-rose-text", "#fecdd3");
    root.style.setProperty("--slice-rose-border", "rgba(251,113,133,0.22)");
    root.style.setProperty("--slice-violet-bg", "rgba(139,92,246,0.10)");
    root.style.setProperty("--slice-violet-text", "#ddd6fe");
    root.style.setProperty("--slice-violet-border", "rgba(167,139,250,0.22)");
    root.style.setProperty("--slice-slate-bg", "rgba(148,163,184,0.08)");
    root.style.setProperty("--slice-slate-text", "#cbd5e1");
    root.style.setProperty("--slice-slate-border", "rgba(148,163,184,0.16)");
  }
}

export function applyWorkspaceAppearance(
  snapshot = readWorkspaceAppearance(),
): WorkspaceAppearanceSnapshot {
  if (typeof document === "undefined") return snapshot;

  const root = document.documentElement;
  const colors = accentValues(snapshot.accent);
  const light = snapshot.resolvedTheme === "light";

  root.dataset.sliceTheme = snapshot.resolvedTheme;
  root.dataset.sliceAppearance = snapshot.resolvedTheme;
  root.dataset.sliceThemeMode = snapshot.mode;
  root.dataset.sliceDensity = snapshot.density;
  root.dataset.sliceAccent = snapshot.accent;
  root.dataset.sliceCardStyle = snapshot.cardStyle;
  root.dataset.sliceNavigation = snapshot.navigationStyle;
  root.dataset.sliceMotion = snapshot.motion;
  root.dataset.sliceTextScale = snapshot.textScale;
  root.dataset.sliceSidebar = snapshot.compactSidebar ? "compact" : "standard";
  root.dataset.sliceCommandBar = snapshot.commandBarPinned ? "pinned" : "floating";
  root.style.colorScheme = snapshot.resolvedTheme;
  root.classList.toggle("dark", !light);

  root.style.setProperty("--slice-accent", colors.main);
  root.style.setProperty("--slice-accent-strong", colors.strong);
  root.style.setProperty("--slice-accent-dark", colors.dark);
  root.style.setProperty("--slice-accent-soft", colors.soft);
  root.style.setProperty("--slice-accent-border", colors.border);
  root.style.setProperty("--slice-accent-glow", colors.glow);
  root.style.setProperty(
    "--slice-text-scale",
    snapshot.textScale === "extra-large"
      ? "1.095"
      : snapshot.textScale === "large"
        ? "1.045"
        : "1",
  );
  root.style.setProperty(
    "--slice-sidebar-width",
    snapshot.compactSidebar || snapshot.navigationStyle === "compact"
      ? "242px"
      : "286px",
  );

  if (light) {
    root.style.setProperty("--slice-bg", "#f7fcf9");
    root.style.setProperty("--slice-bg-2", "#eaf7f0");
    root.style.setProperty("--slice-page", "#f4faf6");
    root.style.setProperty("--slice-surface", "rgba(255,255,255,0.88)");
    root.style.setProperty("--slice-surface-strong", "#ffffff");
    root.style.setProperty("--slice-surface-muted", "#f2f9f5");
    root.style.setProperty("--slice-panel", "rgba(246,252,248,0.94)");
    root.style.setProperty("--slice-input", "rgba(255,255,255,0.98)");
    root.style.setProperty("--slice-text", "#173c2f");
    root.style.setProperty("--slice-heading", "#062a1e");
    root.style.setProperty("--slice-muted", "#61766d");
    root.style.setProperty("--slice-subtle", "#8ba198");
    root.style.setProperty("--slice-border", "rgba(7,83,60,0.12)");
    root.style.setProperty("--slice-border-strong", "rgba(16,163,111,0.24)");
    root.style.setProperty("--slice-shadow", "rgba(12,74,50,0.10)");
    root.style.setProperty("--slice-overlay", "rgba(6,42,30,0.34)");
    root.style.setProperty("--slice-inverse", "#ffffff");
  } else {
    root.style.setProperty("--slice-bg", "#010604");
    root.style.setProperty("--slice-bg-2", "#06120d");
    root.style.setProperty("--slice-page", "#020806");
    root.style.setProperty("--slice-surface", "rgba(3,12,9,0.91)");
    root.style.setProperty("--slice-surface-strong", "#020806");
    root.style.setProperty("--slice-surface-muted", "#07130f");
    root.style.setProperty("--slice-panel", "rgba(7,18,14,0.94)");
    root.style.setProperty("--slice-input", "rgba(0,0,0,0.40)");
    root.style.setProperty("--slice-text", "#e7f7ef");
    root.style.setProperty("--slice-heading", "#f0fdf4");
    root.style.setProperty("--slice-muted", "#94a3b8");
    root.style.setProperty("--slice-subtle", "#64748b");
    root.style.setProperty("--slice-border", "rgba(255,255,255,0.09)");
    root.style.setProperty("--slice-border-strong", "rgba(52,211,153,0.22)");
    root.style.setProperty("--slice-shadow", "rgba(0,0,0,0.34)");
    root.style.setProperty("--slice-overlay", "rgba(0,0,0,0.72)");
    root.style.setProperty("--slice-inverse", "#ffffff");
  }

  setToneVariables(root, light);
  return snapshot;
}

export function workspaceAppearanceFingerprint(
  snapshot = readWorkspaceAppearance(),
) {
  return JSON.stringify(snapshot);
}

export function notifyWorkspaceAppearanceChanged() {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new Event("slice-theme-change"));
  window.dispatchEvent(new Event("slice-workspace-settings-change"));
}

export function watchWorkspaceAppearance(
  onChange?: (snapshot: WorkspaceAppearanceSnapshot) => void,
) {
  if (typeof window === "undefined") return () => undefined;

  let fingerprint = "";
  const media = window.matchMedia("(prefers-color-scheme: dark)");

  const refresh = () => {
    const snapshot = applyWorkspaceAppearance();
    const next = workspaceAppearanceFingerprint(snapshot);

    if (next !== fingerprint) {
      fingerprint = next;
      onChange?.(snapshot);
    }
  };

  refresh();
  const interval = window.setInterval(refresh, 600);

  window.addEventListener("storage", refresh);
  window.addEventListener("slice-theme-change", refresh);
  window.addEventListener("slice-workspace-settings-change", refresh);
  media.addEventListener?.("change", refresh);

  return () => {
    window.clearInterval(interval);
    window.removeEventListener("storage", refresh);
    window.removeEventListener("slice-theme-change", refresh);
    window.removeEventListener("slice-workspace-settings-change", refresh);
    media.removeEventListener?.("change", refresh);
  };
}