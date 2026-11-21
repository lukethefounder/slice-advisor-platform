"use client";

import { resolveNeuralTheme } from "./theme-bootstrap";

export const WORKSPACE_SETTINGS_KEY = "slice-workspace-settings-v5";
export const THEME_KEY = "slice-theme-mode-v1";
export const DENSITY_KEY = "slice-density-mode-v1";
export const ACCENT_KEY = "slice-accent-mode-v1";
export { NEURAL_THEME_MIGRATION_KEY } from "./theme-bootstrap";

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
  mode: "dark",
  resolvedTheme: "dark",
  density: "comfortable",
  accent: "market-green",
  cardStyle: "glass",
  navigationStyle: "executive",
  motion: "full",
  textScale: "standard",
  compactSidebar: false,
  commandBarPinned: true,
};

function browserStorage(): Storage | null {
  try { return typeof window !== "undefined" ? window.localStorage : null; } catch { return null; }
}

function readStored(key: string) {
  try { return browserStorage()?.getItem(key) ?? null; } catch { return null; }
}

function prefersDark() {
  try { return window.matchMedia("(prefers-color-scheme: dark)").matches; } catch { return true; }
}

/** Migration is shared with the prepaint script; it changes only the old default. */
export function ensureNeuralDefaultPreference() {
  return resolveNeuralTheme(browserStorage(), prefersDark());
}

type AppearanceOverride = Partial<Omit<WorkspaceAppearanceSnapshot, "resolvedTheme">>;
let preview: AppearanceOverride | null = null;
let visitPreference: AppearanceOverride | null = null;

/** Live Settings previews never replace the saved preference until Save succeeds. */
export function previewWorkspaceAppearance(next: AppearanceOverride) {
  preview = { ...next };
  applyWorkspaceAppearance();
  notifyWorkspaceAppearanceChanged();
}

export function clearWorkspaceAppearancePreview() {
  if (!preview) return;
  preview = null;
  applyWorkspaceAppearance();
  notifyWorkspaceAppearanceChanged();
}

/** Browser-storage opt-outs can still retain a deliberate choice for this visit. */
export function rememberWorkspaceAppearanceForVisit(next: AppearanceOverride | null) {
  visitPreference = next ? { ...next } : null;
}

export function hasWorkspaceAppearanceForVisit() {
  return visitPreference !== null;
}

/** Preferences for Settings normalization, without an unsaved live preview.
 * Missing stored fields stay missing so server-backed fallbacks remain usable.
 */
export function readSavedWorkspaceAppearancePreferences(): AppearanceOverride {
  const initial = ensureNeuralDefaultPreference();
  const stored = initial.stored as StoredWorkspaceSettings;
  const appearance = stored.appearance && typeof stored.appearance === "object" && !Array.isArray(stored.appearance) ? stored.appearance : {};
  return { ...appearance, mode: initial.mode, ...visitPreference };
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

export function resolveWorkspaceTheme(mode: WorkspaceThemeMode): "dark" | "light" {
  return mode === "system" ? (prefersDark() ? "dark" : "light") : mode;
}

export function readWorkspaceAppearance(): WorkspaceAppearanceSnapshot {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE;
  const initial = ensureNeuralDefaultPreference();
  const stored = initial.stored as StoredWorkspaceSettings;
  const appearance = stored.appearance && typeof stored.appearance === "object" ? stored.appearance : {};
  const workspace = stored.workspace && typeof stored.workspace === "object" ? stored.workspace : {};
  const snapshot = {
    mode: initial.mode,
    density: oneOf(appearance.density ?? readStored(DENSITY_KEY), ["comfortable", "compact", "spacious"] as const, DEFAULT_APPEARANCE.density),
    accent: oneOf(appearance.accent ?? readStored(ACCENT_KEY), ["market-green", "emerald", "teal", "graphite", "blue"] as const, DEFAULT_APPEARANCE.accent),
    cardStyle: oneOf(appearance.cardStyle, ["glass", "solid", "minimal"] as const, DEFAULT_APPEARANCE.cardStyle),
    navigationStyle: oneOf(appearance.navigationStyle, ["executive", "compact", "command"] as const, DEFAULT_APPEARANCE.navigationStyle),
    motion: oneOf(appearance.motion, ["full", "reduced"] as const, DEFAULT_APPEARANCE.motion),
    textScale: oneOf(appearance.textScale, ["standard", "large", "extra-large"] as const, DEFAULT_APPEARANCE.textScale),
    compactSidebar: workspace.compactSidebar === true,
    commandBarPinned: workspace.commandBarPinned !== false,
    ...visitPreference,
    ...preview,
  };
  return { ...snapshot, resolvedTheme: resolveWorkspaceTheme(snapshot.mode) };
}

function accentValues(accent: WorkspaceAccent, light: boolean) {
  const palettes = {
    "market-green": { light: ["#087d75", "#07635d", "#064b49"], dark: ["#70e3d2", "#8ef0d1", "#8ef0d1"], rgb: "112,227,210" },
    emerald: { light: ["#087c60", "#066348", "#064b39"], dark: ["#73e4bd", "#a2f3d5", "#b1f7de"], rgb: "115,228,189" },
    teal: { light: ["#087b80", "#086066", "#06494e"], dark: ["#69ddd7", "#95f1ec", "#b0f7f0"], rgb: "105,221,215" },
    graphite: { light: ["#4b667e", "#375169", "#263e53"], dark: ["#b0c6dd", "#caddeb", "#dcebf5"], rgb: "176,198,221" },
    blue: { light: ["#116f9c", "#115879", "#0c405b"], dark: ["#7bc9fb", "#a4ddff", "#c1e9ff"], rgb: "123,201,251" },
  };
  const palette = palettes[accent] ?? palettes["market-green"];
  const [main, strong, dark] = light ? palette.light : palette.dark;
  return { main, strong, dark, soft: `rgba(${palette.rgb},${light ? ".12" : ".10"})`, border: `rgba(${palette.rgb},.27)`, glow: `rgba(${palette.rgb},.17)` };
}

export function applyWorkspaceAppearance(
  snapshot = readWorkspaceAppearance(),
): WorkspaceAppearanceSnapshot {
  if (typeof document === "undefined") return snapshot;

  const root = document.documentElement;
  const light = snapshot.resolvedTheme === "light";
  const colors = accentValues(snapshot.accent, light);

  root.dataset.sliceBrand = "neural";
  root.dataset.sliceTheme = snapshot.resolvedTheme;
  root.dataset.sliceAppearance = snapshot.resolvedTheme;
  root.dataset.sliceThemeMode = snapshot.mode;
  root.dataset.sliceAppearancePreference = snapshot.mode;
  root.dataset.sliceDensity = snapshot.density;
  root.dataset.sliceAccent = snapshot.accent;
  root.dataset.sliceCardStyle = snapshot.cardStyle;
  root.dataset.sliceNavigation = snapshot.navigationStyle;
  root.dataset.sliceNavigationStyle = snapshot.navigationStyle;
  root.dataset.sliceMotion = snapshot.motion;
  root.dataset.sliceTextScale = snapshot.textScale;
  root.dataset.sliceSidebar = snapshot.compactSidebar ? "compact" : "standard";
  root.dataset.sliceCommandBar = snapshot.commandBarPinned ? "pinned" : "floating";
  root.style.colorScheme = snapshot.resolvedTheme;
  root.classList.toggle("dark", !light);

  // Clear overrides left by earlier appearance providers, including during a
  // client-side update. Surface and status colors belong to the CSS theme.
  ["--background", "--foreground", "--slice-page-bg", "--slice-bg", "--slice-bg-2", "--slice-page", "--slice-surface", "--slice-surface-strong", "--slice-surface-muted", "--slice-panel", "--slice-panel-solid", "--slice-input", "--slice-text", "--slice-heading", "--slice-muted", "--slice-subtle", "--slice-border", "--slice-border-strong", "--slice-shadow", "--slice-overlay", "--slice-inverse", "--slice-soft",
    ...["green", "cyan", "amber", "rose", "violet", "slate"].flatMap(tone => ["bg", "text", "border"].map(part => `--slice-${tone}-${part}`)),
  ].forEach(name => root.style.removeProperty(name));

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

  // Base surfaces, text and status tones come exclusively from neural-theme.css.
  // Inline copies here previously overrode the global palette after hydration.
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
    if (document.visibilityState === "hidden") return;
    const snapshot = readWorkspaceAppearance();
    const next = workspaceAppearanceFingerprint(snapshot);
    if (next !== fingerprint) {
      fingerprint = next;
      applyWorkspaceAppearance(snapshot);
      onChange?.(snapshot);
    }
  };
  refresh();
  // Appearance is event-driven; no 600 ms timer or repeated unchanged style writes.
  const events = ["storage", "slice-theme-change", "slice-workspace-settings-change", "focus", "pageshow"];
  events.forEach(event => window.addEventListener(event, refresh));
  document.addEventListener("visibilitychange", refresh);
  media.addEventListener?.("change", refresh);
  return () => {
    events.forEach(event => window.removeEventListener(event, refresh));
    document.removeEventListener("visibilitychange", refresh);
    media.removeEventListener?.("change", refresh);
  };
}

// slice-event-appearance-v1
