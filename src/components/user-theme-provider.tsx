"use client";

import { useEffect } from "react";
import { applyWorkspaceAppearance, ensureNeuralDefaultPreference, notifyWorkspaceAppearanceChanged, readWorkspaceAppearance, rememberWorkspaceAppearanceForVisit, THEME_KEY, WORKSPACE_SETTINGS_KEY } from "@/lib/workspace/appearance";

export type SliceAppearance = "dark" | "light" | "system";
export type SliceAccentPreset =
  | "auto"
  | "red"
  | "blue"
  | "cyan"
  | "emerald"
  | "purple"
  | "amber";
export type SliceDensity = "comfortable" | "compact";
export type SliceDigestFrequency = "off" | "daily" | "weekly";
export type SliceConfirmationLevel = "standard" | "strict";
export type SliceAiTone = "balanced" | "concise" | "executive" | "detailed";

export type SlicePlatformSettings = {
  appearance: SliceAppearance;
  accentPreset: SliceAccentPreset;
  density: SliceDensity;
  reduceMotion: boolean;
  largeText: boolean;
  highContrast: boolean;
  focusOutlines: boolean;

  defaultWorkspaceView: string;
  compactMetricCards: boolean;
  showFloatingAssistant: boolean;
  showEmailQuickAccess: boolean;
  showDraggableOverlays: boolean;
  openWorkspaceLinksInNewTab: boolean;

  marketAlerts: boolean;
  clientTaskAlerts: boolean;
  complianceAlerts: boolean;
  emailDeliveryAlerts: boolean;
  digestFrequency: SliceDigestFrequency;
  alertSound: boolean;

  maskClientData: boolean;
  requireSensitiveActionConfirmations: boolean;
  confirmationLevel: SliceConfirmationLevel;
  autoLockMinutes: number;
  localOnlyPreferences: boolean;

  advisorAiTone: SliceAiTone;
  requireAdvisorApprovalForClientContent: boolean;
  defaultDraftDepth: "short" | "standard" | "thorough";
  retainPromptHistory: boolean;
};

type ColorPalette = {
  accent300: string;
  accent400: string;
  accent500: string;
  accent600: string;
  accent700: string;
  accent900: string;
  accentSoft: string;
};

type UnknownRecord = Record<string, unknown>;

export const SLICE_SETTINGS_UPDATED_EVENT = "slice-settings-updated";
export const SLICE_GLOBAL_SETTINGS_KEY = "slice-platform-settings:global:v4";
export const SLICE_USER_SETTINGS_PREFIX = "slice-platform-settings:user:v4:";

export const DEFAULT_SLICE_PLATFORM_SETTINGS: SlicePlatformSettings = {
  appearance: "dark",
  accentPreset: "auto",
  density: "comfortable",
  reduceMotion: false,
  largeText: false,
  highContrast: false,
  focusOutlines: true,

  defaultWorkspaceView: "overview",
  compactMetricCards: false,
  showFloatingAssistant: true,
  showEmailQuickAccess: true,
  showDraggableOverlays: true,
  openWorkspaceLinksInNewTab: false,

  marketAlerts: true,
  clientTaskAlerts: true,
  complianceAlerts: true,
  emailDeliveryAlerts: true,
  digestFrequency: "daily",
  alertSound: false,

  maskClientData: false,
  requireSensitiveActionConfirmations: true,
  confirmationLevel: "standard",
  autoLockMinutes: 30,
  localOnlyPreferences: true,

  advisorAiTone: "balanced",
  requireAdvisorApprovalForClientContent: true,
  defaultDraftDepth: "standard",
  retainPromptHistory: true,
};

const ACCENT_PALETTES: Record<Exclude<SliceAccentPreset, "auto">, ColorPalette> = {
  red: {
    accent300: "#8ef0d1",
    accent400: "#70e3d2",
    accent500: "#40bdaa",
    accent600: "#087d75",
    accent700: "#07635d",
    accent900: "#064b49",
    accentSoft: "rgba(112,227,210,0.1)",
  },
  blue: {
    accent300: "#93c5fd",
    accent400: "#60a5fa",
    accent500: "#3b82f6",
    accent600: "#2563eb",
    accent700: "#1d4ed8",
    accent900: "#1e3a8a",
    accentSoft: "#dbeafe",
  },
  cyan: {
    accent300: "#67e8f9",
    accent400: "#22d3ee",
    accent500: "#06b6d4",
    accent600: "#0891b2",
    accent700: "#0e7490",
    accent900: "#164e63",
    accentSoft: "#cffafe",
  },
  emerald: {
    accent300: "#86efac",
    accent400: "#4ade80",
    accent500: "#22c55e",
    accent600: "#16a34a",
    accent700: "#15803d",
    accent900: "#14532d",
    accentSoft: "#dcfce7",
  },
  purple: {
    accent300: "#d8b4fe",
    accent400: "#c084fc",
    accent500: "#a855f7",
    accent600: "#9333ea",
    accent700: "#7e22ce",
    accent900: "#581c87",
    accentSoft: "#f3e8ff",
  },
  amber: {
    accent300: "#fcd34d",
    accent400: "#fbbf24",
    accent500: "#f59e0b",
    accent600: "#d97706",
    accent700: "#b45309",
    accent900: "#78350f",
    accentSoft: "#fef3c7",
  },
};

function isRecord(value: unknown): value is UnknownRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function isAppearance(value: unknown): value is SliceAppearance {
  return value === "dark" || value === "light" || value === "system";
}

function isAccent(value: unknown): value is SliceAccentPreset {
  return (
    value === "auto" ||
    value === "red" ||
    value === "blue" ||
    value === "cyan" ||
    value === "emerald" ||
    value === "purple" ||
    value === "amber"
  );
}

function isDensity(value: unknown): value is SliceDensity {
  return value === "comfortable" || value === "compact";
}

function isDigestFrequency(value: unknown): value is SliceDigestFrequency {
  return value === "off" || value === "daily" || value === "weekly";
}

function isConfirmationLevel(value: unknown): value is SliceConfirmationLevel {
  return value === "standard" || value === "strict";
}

function isAiTone(value: unknown): value is SliceAiTone {
  return value === "balanced" || value === "concise" || value === "executive" || value === "detailed";
}

function isDraftDepth(value: unknown): value is SlicePlatformSettings["defaultDraftDepth"] {
  return value === "short" || value === "standard" || value === "thorough";
}

function asBoolean(value: unknown, fallback: boolean) {
  return typeof value === "boolean" ? value : fallback;
}

function asString(value: unknown, fallback: string) {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function asAutoLockMinutes(value: unknown, fallback: number) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.max(0, Math.min(240, Math.round(parsed)));
}

export function normalizeSliceSettings(input: unknown): SlicePlatformSettings {
  if (!isRecord(input)) return DEFAULT_SLICE_PLATFORM_SETTINGS;

  return {
    appearance: isAppearance(input.appearance)
      ? input.appearance
      : DEFAULT_SLICE_PLATFORM_SETTINGS.appearance,
    accentPreset: isAccent(input.accentPreset)
      ? input.accentPreset
      : DEFAULT_SLICE_PLATFORM_SETTINGS.accentPreset,
    density: isDensity(input.density)
      ? input.density
      : DEFAULT_SLICE_PLATFORM_SETTINGS.density,
    reduceMotion: asBoolean(input.reduceMotion, DEFAULT_SLICE_PLATFORM_SETTINGS.reduceMotion),
    largeText: asBoolean(input.largeText, DEFAULT_SLICE_PLATFORM_SETTINGS.largeText),
    highContrast: asBoolean(input.highContrast, DEFAULT_SLICE_PLATFORM_SETTINGS.highContrast),
    focusOutlines: asBoolean(input.focusOutlines, DEFAULT_SLICE_PLATFORM_SETTINGS.focusOutlines),

    defaultWorkspaceView: asString(
      input.defaultWorkspaceView,
      DEFAULT_SLICE_PLATFORM_SETTINGS.defaultWorkspaceView,
    ),
    compactMetricCards: asBoolean(input.compactMetricCards, DEFAULT_SLICE_PLATFORM_SETTINGS.compactMetricCards),
    showFloatingAssistant: asBoolean(input.showFloatingAssistant, DEFAULT_SLICE_PLATFORM_SETTINGS.showFloatingAssistant),
    showEmailQuickAccess: asBoolean(input.showEmailQuickAccess, DEFAULT_SLICE_PLATFORM_SETTINGS.showEmailQuickAccess),
    showDraggableOverlays: asBoolean(input.showDraggableOverlays, DEFAULT_SLICE_PLATFORM_SETTINGS.showDraggableOverlays),
    openWorkspaceLinksInNewTab: asBoolean(
      input.openWorkspaceLinksInNewTab,
      DEFAULT_SLICE_PLATFORM_SETTINGS.openWorkspaceLinksInNewTab,
    ),

    marketAlerts: asBoolean(input.marketAlerts, DEFAULT_SLICE_PLATFORM_SETTINGS.marketAlerts),
    clientTaskAlerts: asBoolean(input.clientTaskAlerts, DEFAULT_SLICE_PLATFORM_SETTINGS.clientTaskAlerts),
    complianceAlerts: asBoolean(input.complianceAlerts, DEFAULT_SLICE_PLATFORM_SETTINGS.complianceAlerts),
    emailDeliveryAlerts: asBoolean(input.emailDeliveryAlerts, DEFAULT_SLICE_PLATFORM_SETTINGS.emailDeliveryAlerts),
    digestFrequency: isDigestFrequency(input.digestFrequency)
      ? input.digestFrequency
      : DEFAULT_SLICE_PLATFORM_SETTINGS.digestFrequency,
    alertSound: asBoolean(input.alertSound, DEFAULT_SLICE_PLATFORM_SETTINGS.alertSound),

    maskClientData: asBoolean(input.maskClientData, DEFAULT_SLICE_PLATFORM_SETTINGS.maskClientData),
    requireSensitiveActionConfirmations: asBoolean(
      input.requireSensitiveActionConfirmations,
      DEFAULT_SLICE_PLATFORM_SETTINGS.requireSensitiveActionConfirmations,
    ),
    confirmationLevel: isConfirmationLevel(input.confirmationLevel)
      ? input.confirmationLevel
      : DEFAULT_SLICE_PLATFORM_SETTINGS.confirmationLevel,
    autoLockMinutes: asAutoLockMinutes(
      input.autoLockMinutes,
      DEFAULT_SLICE_PLATFORM_SETTINGS.autoLockMinutes,
    ),
    localOnlyPreferences: asBoolean(
      input.localOnlyPreferences,
      DEFAULT_SLICE_PLATFORM_SETTINGS.localOnlyPreferences,
    ),

    advisorAiTone: isAiTone(input.advisorAiTone)
      ? input.advisorAiTone
      : DEFAULT_SLICE_PLATFORM_SETTINGS.advisorAiTone,
    requireAdvisorApprovalForClientContent: asBoolean(
      input.requireAdvisorApprovalForClientContent,
      DEFAULT_SLICE_PLATFORM_SETTINGS.requireAdvisorApprovalForClientContent,
    ),
    defaultDraftDepth: isDraftDepth(input.defaultDraftDepth)
      ? input.defaultDraftDepth
      : DEFAULT_SLICE_PLATFORM_SETTINGS.defaultDraftDepth,
    retainPromptHistory: asBoolean(input.retainPromptHistory, DEFAULT_SLICE_PLATFORM_SETTINGS.retainPromptHistory),
  };
}

export function getSliceSettingsUserKey(identity: string) {
  return `${SLICE_USER_SETTINGS_PREFIX}${identity.toLowerCase().trim()}`;
}

export function loadSliceSettingsFromStorage(key = SLICE_GLOBAL_SETTINGS_KEY) {
  if (typeof window === "undefined") return DEFAULT_SLICE_PLATFORM_SETTINGS;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return DEFAULT_SLICE_PLATFORM_SETTINGS;
    return normalizeSliceSettings(JSON.parse(raw));
  } catch {
    return DEFAULT_SLICE_PLATFORM_SETTINGS;
  }
}

export function saveSliceSettingsToStorage(
  settings: SlicePlatformSettings,
  key = SLICE_GLOBAL_SETTINGS_KEY,
) {
  if (typeof window === "undefined") return;
  const normalized = normalizeSliceSettings(settings);
  const initial = ensureNeuralDefaultPreference();
  const appearance = isRecord(initial.stored.appearance) ? initial.stored.appearance : {};
  const shared = { mode: normalized.appearance, density: normalized.density,
    motion: normalized.reduceMotion ? "reduced" as const : "full" as const,
    textScale: normalized.largeText ? "large" as const : "standard" as const };
  try {
    window.localStorage.setItem(key, JSON.stringify(normalized));
    window.localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify({ ...initial.stored, appearance: { ...appearance, ...shared } }));
    window.localStorage.setItem(THEME_KEY, normalized.appearance);
    rememberWorkspaceAppearanceForVisit(null);
  } catch {
    rememberWorkspaceAppearanceForVisit(shared);
  }
  notifyWorkspaceAppearanceChanged();
}

function effectiveAccent(settings: SlicePlatformSettings) {
  if (settings.accentPreset === "auto") {
    return ACCENT_PALETTES.red;
  }

  return ACCENT_PALETTES[settings.accentPreset];
}

function setCssVar(root: HTMLElement, name: string, value: string) {
  root.style.setProperty(name, value);
}

export function applySliceSettings(settings: SlicePlatformSettings) {
  if (typeof document === "undefined") return;

  const normalized = normalizeSliceSettings(settings);
  const root = document.documentElement;
  const current = readWorkspaceAppearance();
  applyWorkspaceAppearance(current);
  const appearance = current.resolvedTheme;
  const accent = effectiveAccent(normalized);

  root.dataset.sliceUserTheme = "true";
  root.dataset.sliceAppearance = appearance;
  root.dataset.sliceAppearancePreference = current.mode;
  root.dataset.sliceDensity = current.density;
  root.dataset.sliceMotion = normalized.reduceMotion ? "reduced" : current.motion;
  root.dataset.sliceLargeText = normalized.largeText ? "true" : "false";
  root.dataset.sliceHighContrast = normalized.highContrast ? "true" : "false";
  root.dataset.sliceFocusOutlines = normalized.focusOutlines ? "true" : "false";
  root.dataset.sliceMaskClientData = normalized.maskClientData ? "true" : "false";
  root.dataset.sliceFloatingAssistant = normalized.showFloatingAssistant ? "visible" : "hidden";
  root.dataset.sliceEmailQuickAccess = normalized.showEmailQuickAccess ? "visible" : "hidden";
  root.dataset.sliceDraggableOverlays = normalized.showDraggableOverlays ? "visible" : "hidden";
  root.dataset.sliceConfirmationLevel = normalized.confirmationLevel;

  root.style.colorScheme = appearance === "light" ? "light" : "dark";

  const scaleKeys = ["300", "400", "500", "600", "700", "900"] as const;
  if (normalized.accentPreset === "auto") {
    scaleKeys.forEach(key => root.style.removeProperty(`--slice-accent-${key}`));
  } else {
    for (const key of scaleKeys) setCssVar(root, `--slice-accent-${key}`, accent[`accent${key}`]);
    setCssVar(root, "--slice-accent", appearance === "light" ? accent.accent600 : accent.accent300);
    setCssVar(root, "--slice-accent-strong", appearance === "light" ? accent.accent700 : accent.accent300);
    setCssVar(root, "--slice-accent-dark", appearance === "light" ? accent.accent900 : accent.accent300);
    setCssVar(root, "--slice-accent-soft", `color-mix(in srgb, ${accent.accent500} 12%, transparent)`);
  }
  // neural-theme.css owns page, surface, text and status colors for every route.

}

function getNestedString(record: UnknownRecord, path: string[]) {
  let current: unknown = record;

  for (const key of path) {
    if (!isRecord(current)) return null;
    current = current[key];
  }

  return typeof current === "string" && current.trim() ? current.trim() : null;
}

export async function detectSliceUserIdentity() {
  try {
    const response = await fetch("/api/personal-bot", {
      cache: "no-store",
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as unknown;

    if (!isRecord(payload)) return null;

    return (
      getNestedString(payload, ["user", "email"]) ||
      getNestedString(payload, ["currentUser", "email"]) ||
      getNestedString(payload, ["profile", "email"]) ||
      getNestedString(payload, ["advisor", "email"]) ||
      getNestedString(payload, ["user", "id"]) ||
      getNestedString(payload, ["id"]) ||
      getNestedString(payload, ["email"])
    );
  } catch {
    return null;
  }
}

async function loadAndApplySettings() {
  const globalSettings = loadSliceSettingsFromStorage(SLICE_GLOBAL_SETTINGS_KEY);
  applySliceSettings(globalSettings);

  const identity = await detectSliceUserIdentity();

  if (!identity) {
    return {
      identity: null,
      settings: globalSettings,
    };
  }

  const userKey = getSliceSettingsUserKey(identity);
  const userSettings = loadSliceSettingsFromStorage(userKey);
  const merged = normalizeSliceSettings({
    ...globalSettings,
    ...userSettings,
  });

  applySliceSettings(merged);

  return {
    identity,
    settings: merged,
  };
}

export default function UserThemeProvider() {
  useEffect(() => {
    let active = true;
    let currentIdentity: string | null = null;

    async function sync() {
      const result = await loadAndApplySettings();
      if (!active) return;
      currentIdentity = result.identity;
    }

    function syncFromCurrentStorage() {
      const globalSettings = loadSliceSettingsFromStorage(SLICE_GLOBAL_SETTINGS_KEY);

      if (currentIdentity) {
        const userSettings = loadSliceSettingsFromStorage(getSliceSettingsUserKey(currentIdentity));
        applySliceSettings({
          ...globalSettings,
          ...userSettings,
        });
        return;
      }

      applySliceSettings(globalSettings);
    }

    applySliceSettings(loadSliceSettingsFromStorage(SLICE_GLOBAL_SETTINGS_KEY));
    void sync();

    const settingsListener = () => syncFromCurrentStorage();
    const storageListener = (event: StorageEvent) => {
      if (
        event.key === SLICE_GLOBAL_SETTINGS_KEY ||
        Boolean(currentIdentity && event.key === getSliceSettingsUserKey(currentIdentity))
      ) {
        syncFromCurrentStorage();
      }
    };

    const media = window.matchMedia("(prefers-color-scheme: light)");
    const mediaListener = () => syncFromCurrentStorage();

    window.addEventListener(SLICE_SETTINGS_UPDATED_EVENT, settingsListener);
    window.addEventListener("slice-theme-updated", settingsListener);
    window.addEventListener("storage", storageListener);
    media.addEventListener("change", mediaListener);

    return () => {
      active = false;
      window.removeEventListener(SLICE_SETTINGS_UPDATED_EVENT, settingsListener);
      window.removeEventListener("slice-theme-updated", settingsListener);
      window.removeEventListener("storage", storageListener);
      media.removeEventListener("change", mediaListener);
    };
  }, []);

  return null;
}