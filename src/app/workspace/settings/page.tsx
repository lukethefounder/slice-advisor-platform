"use client";

import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";
import { BrandMark } from "@/components/slice-ui";

type ThemeMode = "dark" | "light" | "system";
type Density = "comfortable" | "compact" | "spacious";
type Accent = "slice-red" | "crimson" | "ruby" | "graphite" | "blue";
type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";
type SettingsTab =
  | "overview"
  | "profile"
  | "appearance"
  | "notifications"
  | "security"
  | "privacy"
  | "workspace"
  | "ai"
  | "support"
  | "danger";

type AlertChannel = {
  id?: string;
  channel: string;
  enabled: boolean;
  minUrgency: string;
  minScore: number;
  digestOnly: boolean;
  quietHoursStart?: string | null;
  quietHoursEnd?: string | null;
  cooldownMinutes: number;
};

type WorkspaceSettingsPayload = {
  account: {
    id: string;
    name: string;
    email: string;
    phone: string;
    timezone: string;
    platformStatus: string;
    createdAt: string;
    firmName: string;
    title: string;
    company: string;
  };
  appearance: {
    mode: ThemeMode;
    density: Density;
    accent: Accent;
    cardStyle: "glass" | "solid" | "minimal";
    navigationStyle: "executive" | "compact" | "command";
    motion: "full" | "reduced";
    textScale: "standard" | "large" | "extra-large";
  };
  workspace: {
    defaultLanding: string;
    showMarketPulse: boolean;
    showTeamSnapshot: boolean;
    showClientInbox: boolean;
    showWatchlistPreview: boolean;
    showComplianceBanner: boolean;
    compactSidebar: boolean;
    commandBarPinned: boolean;
    autoSaveDrafts: boolean;
    confirmBeforeExternalActions: boolean;
  };
  ai: {
    defaultMode: "quick" | "balanced" | "deep";
    replyFormat: "executive-summary" | "advisor-memo" | "client-friendly" | "action-plan";
    preferredTone: string;
    detailLevel: string;
    useMemory: boolean;
    autoReadReplies: boolean;
    requireApprovalForReports: boolean;
    requireApprovalForEmails: boolean;
    defaultReportStyle: "Premium Red" | "Boardroom" | "Client Clean" | "Technical";
  };
  privacy: {
    aiMemoryEnabled: boolean;
    personalizationEnabled: boolean;
    analyticsEnabled: boolean;
    marketingEmailsEnabled: boolean;
    shareUsageForImprovement: boolean;
    showProfileToTeam: boolean;
    retainReports: "30 days" | "90 days" | "1 year" | "Forever";
    exportFormat: "PDF" | "CSV" | "JSON";
    hideSensitiveValues: boolean;
    maskClientNames: boolean;
    allowBrowserStorage: boolean;
  };
  security: {
    mfaEnabled: boolean;
    requireReauthForSensitiveActions: boolean;
    alertOnNewLogin: boolean;
    advisorModeEnabled: boolean;
    sessionTimeoutMinutes: number;
    lastSecurityReviewAt?: string | null;
  };
  notifications: AlertChannel[];
  contact: {
    name: string;
    phone: string;
    phoneHref: string;
    email: string;
    emailHref: string;
  };
};

const WORKSPACE_SETTINGS_KEY = "slice-workspace-settings-v5";
const THEME_KEY = "slice-theme-mode-v1";
const DENSITY_KEY = "slice-density-mode-v1";
const ACCENT_KEY = "slice-accent-mode-v1";

const DEFAULT_SETTINGS: WorkspaceSettingsPayload = {
  account: {
    id: "",
    name: "",
    email: "",
    phone: "",
    timezone: "America/Phoenix",
    platformStatus: "Active",
    createdAt: "",
    firmName: "Slice Workspace",
    title: "Advisor",
    company: "",
  },
  appearance: {
    mode: "dark",
    density: "comfortable",
    accent: "slice-red",
    cardStyle: "glass",
    navigationStyle: "executive",
    motion: "full",
    textScale: "standard",
  },
  workspace: {
    defaultLanding: "/workspace",
    showMarketPulse: true,
    showTeamSnapshot: true,
    showClientInbox: true,
    showWatchlistPreview: true,
    showComplianceBanner: true,
    compactSidebar: false,
    commandBarPinned: true,
    autoSaveDrafts: true,
    confirmBeforeExternalActions: true,
  },
  ai: {
    defaultMode: "balanced",
    replyFormat: "executive-summary",
    preferredTone: "Professional",
    detailLevel: "Balanced detail",
    useMemory: true,
    autoReadReplies: false,
    requireApprovalForReports: true,
    requireApprovalForEmails: true,
    defaultReportStyle: "Premium Red",
  },
  privacy: {
    aiMemoryEnabled: true,
    personalizationEnabled: true,
    analyticsEnabled: true,
    marketingEmailsEnabled: false,
    shareUsageForImprovement: false,
    showProfileToTeam: true,
    retainReports: "1 year",
    exportFormat: "PDF",
    hideSensitiveValues: true,
    maskClientNames: false,
    allowBrowserStorage: true,
  },
  security: {
    mfaEnabled: false,
    requireReauthForSensitiveActions: true,
    alertOnNewLogin: true,
    advisorModeEnabled: false,
    sessionTimeoutMinutes: 43200,
    lastSecurityReviewAt: null,
  },
  notifications: [
    {
      channel: "Dashboard",
      enabled: true,
      minUrgency: "Medium",
      minScore: 70,
      digestOnly: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "07:00",
      cooldownMinutes: 20,
    },
    {
      channel: "Email",
      enabled: true,
      minUrgency: "High",
      minScore: 80,
      digestOnly: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "07:00",
      cooldownMinutes: 30,
    },
    {
      channel: "Security",
      enabled: true,
      minUrgency: "Low",
      minScore: 50,
      digestOnly: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      cooldownMinutes: 0,
    },
    {
      channel: "Reports",
      enabled: true,
      minUrgency: "Medium",
      minScore: 70,
      digestOnly: true,
      quietHoursStart: "21:00",
      quietHoursEnd: "07:00",
      cooldownMinutes: 60,
    },
    {
      channel: "SMS",
      enabled: false,
      minUrgency: "Critical",
      minScore: 90,
      digestOnly: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "07:00",
      cooldownMinutes: 60,
    },
    {
      channel: "Push",
      enabled: false,
      minUrgency: "High",
      minScore: 80,
      digestOnly: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "07:00",
      cooldownMinutes: 30,
    },
    {
      channel: "Client Portal",
      enabled: true,
      minUrgency: "High",
      minScore: 75,
      digestOnly: false,
      quietHoursStart: "21:00",
      quietHoursEnd: "07:00",
      cooldownMinutes: 20,
    },
    {
      channel: "Compliance",
      enabled: true,
      minUrgency: "Medium",
      minScore: 65,
      digestOnly: false,
      quietHoursStart: null,
      quietHoursEnd: null,
      cooldownMinutes: 10,
    },
  ],
  contact: {
    name: "Luke Royal Price",
    phone: "(985) 290-3067",
    phoneHref: "tel:+19852903067",
    email: "price.luke.royal@gmail.com",
    emailHref: "mailto:price.luke.royal@gmail.com",
  },
};

const SETTING_TABS: Array<{
  id: SettingsTab;
  label: string;
  helper: string;
  tone: Tone;
}> = [
  { id: "overview", label: "Overview", helper: "Control center", tone: "red" },
  { id: "profile", label: "Profile", helper: "Account identity", tone: "cyan" },
  { id: "appearance", label: "Appearance", helper: "Theme + layout", tone: "purple" },
  { id: "notifications", label: "Alerts", helper: "Channels + rules", tone: "amber" },
  { id: "security", label: "Security", helper: "Access + reset", tone: "green" },
  { id: "privacy", label: "Privacy", helper: "Data controls", tone: "blue" },
  { id: "workspace", label: "Workspace", helper: "Modules + defaults", tone: "slate" },
  { id: "ai", label: "AI Defaults", helper: "Assistant behavior", tone: "purple" },
  { id: "support", label: "Contact", helper: "Help + founder", tone: "cyan" },
  { id: "danger", label: "Account", helper: "Deactivate/delete", tone: "red" },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function deepMerge<T>(base: T, incoming: Partial<T> | null | undefined): T {
  if (!incoming) return base;

  const output: any = { ...(base as any) };

  for (const [key, value] of Object.entries(incoming as Record<string, unknown>)) {
    if (
      value &&
      typeof value === "object" &&
      !Array.isArray(value) &&
      output[key] &&
      typeof output[key] === "object" &&
      !Array.isArray(output[key])
    ) {
      output[key] = deepMerge(output[key], value as any);
    } else if (value !== undefined) {
      output[key] = value;
    }
  }

  return output;
}

function validTheme(value: unknown): ThemeMode {
  if (value === "light" || value === "system" || value === "dark") return value;
  return "dark";
}

function validDensity(value: unknown): Density {
  if (value === "compact" || value === "spacious" || value === "comfortable") return value;
  return "comfortable";
}

function validAccent(value: unknown): Accent {
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

function readableDate(value?: string) {
  if (!value) return "Not recorded";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not recorded";

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function toneFor(value: string | number | null | undefined): Tone {
  const lower = String(value ?? "").toLowerCase();
  const numeric = typeof value === "number" ? value : Number.NaN;

  if (
    lower.includes("error") ||
    lower.includes("delete") ||
    lower.includes("deactivate") ||
    lower.includes("critical") ||
    lower.includes("off") ||
    lower.includes("missing") ||
    (!Number.isNaN(numeric) && numeric < 35)
  ) {
    return "red";
  }

  if (
    lower.includes("active") ||
    lower.includes("enabled") ||
    lower.includes("on") ||
    lower.includes("ready") ||
    lower.includes("saved") ||
    (!Number.isNaN(numeric) && numeric >= 75)
  ) {
    return "green";
  }

  if (
    lower.includes("pending") ||
    lower.includes("review") ||
    lower.includes("medium") ||
    lower.includes("warning") ||
    (!Number.isNaN(numeric) && numeric >= 35 && numeric < 75)
  ) {
    return "amber";
  }

  if (lower.includes("ai") || lower.includes("assistant")) return "purple";
  if (lower.includes("email") || lower.includes("client")) return "cyan";

  return "slate";
}

function accentHex(accent: Accent) {
  if (accent === "crimson") return "#b91c1c";
  if (accent === "ruby") return "#e11d48";
  if (accent === "graphite") return "#334155";
  if (accent === "blue") return "#2563eb";
  return "#dc2626";
}

function accentDarkHex(accent: Accent) {
  if (accent === "graphite") return "#0f172a";
  if (accent === "blue") return "#1e3a8a";
  if (accent === "ruby") return "#881337";
  return "#7f1d1d";
}

function resolveTheme(mode: ThemeMode, systemDark: boolean) {
  if (mode === "system") return systemDark ? "dark" : "light";
  return mode;
}

function themeVars(input: {
  mode: ThemeMode;
  systemDark: boolean;
  accent: Accent;
}) {
  const theme = resolveTheme(input.mode, input.systemDark);
  const isLight = theme === "light";
  const accent = accentHex(input.accent);
  const accentDark = accentDarkHex(input.accent);

  if (isLight) {
    return {
      theme,
      isLight,
      style: {
        "--bg": "#f8fafc",
        "--bg2": "#fff7f7",
        "--surface": "rgba(255,255,255,0.92)",
        "--surfaceStrong": "#ffffff",
        "--panel": "rgba(15,23,42,0.045)",
        "--panel2": "rgba(255,255,255,0.72)",
        "--input": "#ffffff",
        "--text": "#0f172a",
        "--muted": "#64748b",
        "--muted2": "#475569",
        "--border": "rgba(15,23,42,0.12)",
        "--shadow": "rgba(15,23,42,0.12)",
        "--accent": accent,
        "--accentDark": accentDark,
        "--accentSoft": "rgba(220,38,38,0.10)",
        "--accentBorder": "rgba(220,38,38,0.36)",
      } as CSSProperties,
    };
  }

  return {
    theme,
    isLight,
    style: {
      "--bg": "#020202",
      "--bg2": "#260606",
      "--surface": "rgba(9,9,11,0.78)",
      "--surfaceStrong": "#09090b",
      "--panel": "rgba(255,255,255,0.055)",
      "--panel2": "rgba(0,0,0,0.32)",
      "--input": "rgba(0,0,0,0.42)",
      "--text": "#ffffff",
      "--muted": "#94a3b8",
      "--muted2": "#cbd5e1",
      "--border": "rgba(255,255,255,0.11)",
      "--shadow": "rgba(0,0,0,0.35)",
      "--accent": accent,
      "--accentDark": accentDark,
      "--accentSoft": "rgba(220,38,38,0.16)",
      "--accentBorder": "rgba(220,38,38,0.40)",
    } as CSSProperties,
  };
}

function densityClass(density: Density) {
  if (density === "compact") return "gap-3";
  if (density === "spacious") return "gap-6";
  return "gap-4";
}

function cardPadding(density: Density) {
  if (density === "compact") return "p-4";
  if (density === "spacious") return "p-7";
  return "p-5";
}

function toneClasses(tone: Tone, isLight: boolean) {
  if (isLight) {
    const light: Record<Tone, string> = {
      red: "border-red-200 bg-red-50 text-red-800",
      green: "border-emerald-200 bg-emerald-50 text-emerald-800",
      amber: "border-amber-200 bg-amber-50 text-amber-800",
      purple: "border-purple-200 bg-purple-50 text-purple-800",
      cyan: "border-sky-200 bg-sky-50 text-sky-800",
      blue: "border-blue-200 bg-blue-50 text-blue-800",
      slate: "border-slate-200 bg-slate-50 text-slate-800",
    };

    return light[tone];
  }

  const dark: Record<Tone, string> = {
    red: "border-red-500/30 bg-red-500/10 text-red-100",
    green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
    amber: "border-amber-500/30 bg-amber-500/10 text-amber-100",
    purple: "border-purple-500/30 bg-purple-500/10 text-purple-100",
    cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
    blue: "border-blue-500/30 bg-blue-500/10 text-blue-100",
    slate: "border-slate-500/20 bg-slate-500/10 text-slate-100",
  };

  return dark[tone];
}

function Pill({
  children,
  tone = "slate",
  isLight,
}: {
  children: ReactNode;
  tone?: Tone;
  isLight: boolean;
}) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
        toneClasses(tone, isLight),
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Card({
  children,
  className = "",
  density,
}: {
  children: ReactNode;
  className?: string;
  density: Density;
}) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[2rem] border shadow-2xl backdrop-blur-xl",
        cardPadding(density),
        className,
      )}
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
        color: "var(--text)",
        boxShadow: "0 24px 70px var(--shadow)",
      }}
    >
      {children}
    </div>
  );
}

function Panel({
  children,
  tone = "red",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  const glows: Record<Tone, string> = {
    red: "from-red-500/16",
    green: "from-emerald-500/12",
    amber: "from-amber-500/12",
    purple: "from-purple-500/12",
    cyan: "from-cyan-500/12",
    blue: "from-blue-500/12",
    slate: "from-slate-400/8",
  };

  return (
    <div
      className={cx("relative overflow-hidden rounded-[1.45rem] border p-4", className)}
      style={{
        background: "var(--panel)",
        borderColor: "var(--border)",
      }}
    >
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">{children}</div>
    </div>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone = "red",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: Tone;
}) {
  return (
    <Panel tone={tone}>
      <div className="text-[10px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
        {label}
      </div>
      <div className="mt-2 truncate text-2xl font-black" style={{ color: "var(--text)" }}>
        {value}
      </div>
      {helper ? (
        <div className="mt-1 truncate text-[10px] font-semibold" style={{ color: "var(--muted)" }}>
          {helper}
        </div>
      ) : null}
    </Panel>
  );
}

function SectionHeader({
  eyebrow,
  title,
  helper,
}: {
  eyebrow: string;
  title: string;
  helper?: string;
}) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-black tracking-tight" style={{ color: "var(--text)" }}>
        {title}
      </h2>
      {helper ? (
        <p className="mt-2 max-w-4xl text-sm font-semibold leading-7" style={{ color: "var(--muted)" }}>
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function SettingsTabButton({
  tab,
  active,
  isLight,
  onClick,
}: {
  tab: (typeof SETTING_TABS)[number];
  active: boolean;
  isLight: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-[1.25rem] border p-3 text-left transition hover:-translate-y-0.5",
        active ? toneClasses(tab.tone, isLight) : "",
      )}
      style={
        active
          ? undefined
          : {
              background: "var(--panel)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }
      }
    >
      <div className="flex items-center justify-between gap-3">
        <div className="truncate text-sm font-black">{tab.label}</div>
        <span
          className={cx(
            "h-2.5 w-2.5 rounded-full",
            tab.tone === "red"
              ? "bg-red-400"
              : tab.tone === "green"
                ? "bg-emerald-400"
                : tab.tone === "amber"
                  ? "bg-amber-400"
                  : tab.tone === "purple"
                    ? "bg-purple-400"
                    : tab.tone === "cyan"
                      ? "bg-cyan-400"
                      : tab.tone === "blue"
                        ? "bg-blue-400"
                        : "bg-slate-400",
          )}
        />
      </div>
      <div className="mt-1 truncate text-[10px] font-semibold opacity-75">{tab.helper}</div>
    </button>
  );
}

function ThemedInput({
  value,
  onChange,
  placeholder,
  type = "text",
}: {
  value: string | number;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
}) {
  return (
    <input
      type={type}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      placeholder={placeholder}
      className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none ring-red-500 focus:ring-2"
      style={{
        background: "var(--input)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    />
  );
}

function ThemedSelect<T extends string>({
  label,
  value,
  options,
  onChange,
  helper,
}: {
  label: string;
  value: T;
  options: T[];
  onChange: (value: T) => void;
  helper?: string;
}) {
  return (
    <label>
      <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value as T)}
        className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none ring-red-500 focus:ring-2"
        style={{
          background: "var(--input)",
          borderColor: "var(--border)",
          color: "var(--text)",
        }}
      >
        {options.map((option) => (
          <option key={option}>{option}</option>
        ))}
      </select>
      {helper ? (
        <div className="mt-1 text-[10px] font-semibold" style={{ color: "var(--muted)" }}>
          {helper}
        </div>
      ) : null}
    </label>
  );
}

function ToggleRow({
  label,
  helper,
  checked,
  onChange,
  tone = "green",
  isLight,
}: {
  label: string;
  helper?: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  tone?: Tone;
  isLight: boolean;
}) {
  return (
    <label
      className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-bold"
      style={{
        background: "var(--panel)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <span>
        {label}
        {helper ? (
          <span className="mt-1 block text-[10px] font-semibold" style={{ color: "var(--muted)" }}>
            {helper}
          </span>
        ) : null}
      </span>
      <span className="flex items-center gap-2">
        <Pill tone={checked ? tone : "slate"} isLight={isLight}>
          {checked ? "On" : "Off"}
        </Pill>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      </span>
    </label>
  );
}

function ChoiceCard({
  active,
  title,
  detail,
  tone,
  isLight,
  onClick,
}: {
  active: boolean;
  title: string;
  detail: string;
  tone: Tone;
  isLight: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-[1.5rem] border p-4 text-left transition hover:-translate-y-1",
        active ? toneClasses(tone, isLight) : "",
      )}
      style={
        active
          ? undefined
          : {
              background: "var(--panel)",
              borderColor: "var(--border)",
              color: "var(--text)",
            }
      }
    >
      <div className="text-lg font-black">{title}</div>
      <p className="mt-2 text-sm font-semibold leading-6 opacity-75">{detail}</p>
      <div className="mt-4">
        <Pill tone={active ? "green" : "slate"} isLight={isLight}>
          {active ? "Selected" : "Choose"}
        </Pill>
      </div>
    </button>
  );
}

export default function WorkspaceSettingsPage() {
  const [savedSettings, setSavedSettings] = useState<WorkspaceSettingsPayload>(DEFAULT_SETTINGS);
  const [draftSettings, setDraftSettings] = useState<WorkspaceSettingsPayload>(DEFAULT_SETTINGS);
  const [activeTab, setActiveTab] = useState<SettingsTab>("overview");
  const [systemDark, setSystemDark] = useState(true);
  const [saveMessage, setSaveMessage] = useState("");
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "unsaved">("idle");
  const [passwordResetStatus, setPasswordResetStatus] = useState("");
  const [deactivateConfirm, setDeactivateConfirm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");

  const settings = draftSettings;

  const { theme, isLight, style } = themeVars({
    mode: settings.appearance.mode,
    systemDark,
    accent: settings.appearance.accent,
  });

  const pageGap = densityClass(settings.appearance.density);
  const hasUnsavedChanges = useMemo(
    () => JSON.stringify(savedSettings) !== JSON.stringify(draftSettings),
    [draftSettings, savedSettings],
  );

  const activeNotifications = settings.notifications.filter((item) => item.enabled).length;
  const workspaceScore = useMemo(() => {
    let score = 42;

    if (settings.workspace.commandBarPinned) score += 8;
    if (settings.workspace.confirmBeforeExternalActions) score += 10;
    if (settings.security.requireReauthForSensitiveActions) score += 12;
    if (settings.privacy.aiMemoryEnabled) score += 8;
    if (settings.privacy.hideSensitiveValues) score += 8;
    if (activeNotifications >= 4) score += 8;
    if (settings.appearance.mode) score += 4;

    return Math.max(0, Math.min(100, score));
  }, [activeNotifications, settings]);

  function setDraft(nextSettings: WorkspaceSettingsPayload) {
    setDraftSettings(nextSettings);
    setSaveState("unsaved");
    setSaveMessage("You have unsaved settings. Click Save & Apply to use them across the workspace.");
  }

  function updateAccount<K extends keyof WorkspaceSettingsPayload["account"]>(
    key: K,
    value: WorkspaceSettingsPayload["account"][K],
  ) {
    setDraft({
      ...settings,
      account: {
        ...settings.account,
        [key]: value,
      },
    });
  }

  function updateAppearance<K extends keyof WorkspaceSettingsPayload["appearance"]>(
    key: K,
    value: WorkspaceSettingsPayload["appearance"][K],
  ) {
    setDraft({
      ...settings,
      appearance: {
        ...settings.appearance,
        [key]: value,
      },
    });
  }

  function updateWorkspace<K extends keyof WorkspaceSettingsPayload["workspace"]>(
    key: K,
    value: WorkspaceSettingsPayload["workspace"][K],
  ) {
    setDraft({
      ...settings,
      workspace: {
        ...settings.workspace,
        [key]: value,
      },
    });
  }

  function updateAi<K extends keyof WorkspaceSettingsPayload["ai"]>(
    key: K,
    value: WorkspaceSettingsPayload["ai"][K],
  ) {
    setDraft({
      ...settings,
      ai: {
        ...settings.ai,
        [key]: value,
      },
    });
  }

  function updatePrivacy<K extends keyof WorkspaceSettingsPayload["privacy"]>(
    key: K,
    value: WorkspaceSettingsPayload["privacy"][K],
  ) {
    setDraft({
      ...settings,
      privacy: {
        ...settings.privacy,
        [key]: value,
      },
    });
  }

  function updateSecurity<K extends keyof WorkspaceSettingsPayload["security"]>(
    key: K,
    value: WorkspaceSettingsPayload["security"][K],
  ) {
    setDraft({
      ...settings,
      security: {
        ...settings.security,
        [key]: value,
      },
    });
  }

  function updateNotification(index: number, patch: Partial<AlertChannel>) {
    setDraft({
      ...settings,
      notifications: settings.notifications.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    });
  }

  function applySavedSettingsToPlatform(nextSettings: WorkspaceSettingsPayload) {
    const resolvedTheme = resolveTheme(nextSettings.appearance.mode, systemDark);

    window.localStorage.setItem(WORKSPACE_SETTINGS_KEY, JSON.stringify(nextSettings));
    window.localStorage.setItem(THEME_KEY, resolvedTheme);
    window.localStorage.setItem(DENSITY_KEY, nextSettings.appearance.density);
    window.localStorage.setItem(ACCENT_KEY, nextSettings.appearance.accent);

    document.documentElement.dataset.sliceTheme = resolvedTheme;
    document.documentElement.dataset.sliceThemeMode = nextSettings.appearance.mode;
    document.documentElement.dataset.sliceDensity = nextSettings.appearance.density;
    document.documentElement.dataset.sliceAccent = nextSettings.appearance.accent;
    document.documentElement.style.colorScheme = resolvedTheme;

    const root = document.documentElement;
    root.style.setProperty("--slice-accent", accentHex(nextSettings.appearance.accent));
    root.style.setProperty("--slice-accent-dark", accentDarkHex(nextSettings.appearance.accent));
    root.style.setProperty("--slice-accent-soft", "rgba(220, 38, 38, 0.16)");
    root.style.setProperty("--slice-accent-border", "rgba(220, 38, 38, 0.40)");

    window.dispatchEvent(new Event("slice-theme-change"));
    window.dispatchEvent(new Event("slice-workspace-settings-change"));
  }

  async function loadSettings() {
    let localSettings = DEFAULT_SETTINGS;

    try {
      const raw = window.localStorage.getItem(WORKSPACE_SETTINGS_KEY);
      if (raw) {
        localSettings = deepMerge(DEFAULT_SETTINGS, JSON.parse(raw));
      }

      const storedTheme = window.localStorage.getItem(THEME_KEY);
      const storedDensity = window.localStorage.getItem(DENSITY_KEY);
      const storedAccent = window.localStorage.getItem(ACCENT_KEY);

      localSettings = {
        ...localSettings,
        appearance: {
          ...localSettings.appearance,
          mode: validTheme(storedTheme || localSettings.appearance.mode),
          density: validDensity(storedDensity || localSettings.appearance.density),
          accent: validAccent(storedAccent || localSettings.appearance.accent),
        },
      };

      setSavedSettings(localSettings);
      setDraftSettings(localSettings);
      setSaveState("idle");
      applySavedSettingsToPlatform(localSettings);
    } catch {
      setSavedSettings(DEFAULT_SETTINGS);
      setDraftSettings(DEFAULT_SETTINGS);
      applySavedSettingsToPlatform(DEFAULT_SETTINGS);
    }

    try {
      const response = await fetch("/api/account-settings", { cache: "no-store" });
      const payload = await response.json();

      if (!response.ok) return;

      const nextSettings = deepMerge(localSettings, {
        account: {
          id: payload.account?.id || localSettings.account.id,
          name: payload.account?.name || localSettings.account.name,
          email: payload.account?.email || localSettings.account.email,
          phone: payload.account?.phone || localSettings.account.phone,
          timezone: payload.account?.timezone || localSettings.account.timezone,
          platformStatus: payload.account?.platformStatus || localSettings.account.platformStatus,
          createdAt: payload.account?.createdAt || localSettings.account.createdAt,
        },
        appearance: {
          ...localSettings.appearance,
          mode:
            payload.appearance?.mode === "light" ||
            payload.appearance?.mode === "system" ||
            payload.appearance?.mode === "dark"
              ? payload.appearance.mode
              : localSettings.appearance.mode,
          density:
            payload.appearance?.density === "Compact"
              ? "compact"
              : payload.appearance?.density === "Spacious"
                ? "spacious"
                : payload.appearance?.density === "Comfortable"
                  ? "comfortable"
                  : localSettings.appearance.density,
          accent:
            payload.appearance?.accent === "Crimson"
              ? "crimson"
              : payload.appearance?.accent === "Ruby"
                ? "ruby"
                : payload.appearance?.accent === "Graphite"
                  ? "graphite"
                  : localSettings.appearance.accent,
        },
        privacy: payload.privacy || localSettings.privacy,
        security: payload.security || localSettings.security,
        notifications: payload.notifications?.length ? payload.notifications : localSettings.notifications,
        contact: payload.contact || localSettings.contact,
      } as Partial<WorkspaceSettingsPayload>);

      setSavedSettings(nextSettings);
      setDraftSettings(nextSettings);
      applySavedSettingsToPlatform(nextSettings);
    } catch {
      // Local settings are still valid.
    }
  }

  async function saveSettings() {
    setSaveState("saving");
    setSaveMessage("Saving and applying workspace settings...");

    applySavedSettingsToPlatform(settings);

    try {
      const response = await fetch("/api/account-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "save-workspace-settings",
        },
        body: JSON.stringify({
          action: "saveAccountSettings",
          account: {
            name: settings.account.name,
            email: settings.account.email,
            phone: settings.account.phone,
            timezone: settings.account.timezone,
          },
          appearance: {
            mode: settings.appearance.mode,
            density:
              settings.appearance.density === "compact"
                ? "Compact"
                : settings.appearance.density === "spacious"
                  ? "Spacious"
                  : "Comfortable",
            accent:
              settings.appearance.accent === "crimson"
                ? "Crimson"
                : settings.appearance.accent === "ruby"
                  ? "Ruby"
                  : settings.appearance.accent === "graphite"
                    ? "Graphite"
                    : "Slice Red",
          },
          privacy: settings.privacy,
          security: settings.security,
          notifications: settings.notifications,
        }),
      });

      if (!response.ok) {
        const errorPayload = await response.json().catch(() => ({}));
        setSavedSettings(settings);
        setSaveState("error");
        setSaveMessage(errorPayload.error || "Settings were applied locally, but account API save failed.");
        return;
      }

      setSavedSettings(settings);
      setSaveState("saved");
      setSaveMessage("Settings saved and applied across the workspace.");
    } catch {
      setSavedSettings(settings);
      setSaveState("saved");
      setSaveMessage("Settings saved locally and applied across the workspace.");
    }
  }

  async function requestPasswordReset() {
    setPasswordResetStatus("Requesting password reset...");

    try {
      const response = await fetch("/api/account-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "request-password-reset",
        },
        body: JSON.stringify({ action: "requestPasswordReset" }),
      });

      const payload = await response.json().catch(() => ({}));

      setPasswordResetStatus(
        payload.message ||
          payload.error ||
          "Password reset request queued. Connect email delivery for production reset emails.",
      );
    } catch {
      setPasswordResetStatus("Password reset request saved locally. Connect the account settings API to send reset emails.");
    }
  }

  async function logout() {
    try {
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: {
          "x-slice-sensitive-action": "logout",
        },
      });
    } finally {
      window.location.href = "/login";
    }
  }

  async function deactivateAccount() {
    if (deactivateConfirm !== "DEACTIVATE") return;

    try {
      const response = await fetch("/api/account-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "deactivate-account",
        },
        body: JSON.stringify({
          action: "deactivateAccount",
          confirmation: deactivateConfirm,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (response.ok) {
        window.location.href = payload.redirectTo || "/login";
        return;
      }

      setSaveMessage(payload.error || "Could not deactivate account.");
      setSaveState("error");
    } catch {
      setSaveMessage("Account settings API is required to deactivate accounts.");
      setSaveState("error");
    }
  }

  async function deleteAccount() {
    if (deleteConfirm !== "DELETE MY ACCOUNT") return;

    try {
      const response = await fetch("/api/account-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "delete-account",
        },
        body: JSON.stringify({
          action: "deleteAccount",
          confirmation: deleteConfirm,
        }),
      });

      const payload = await response.json().catch(() => ({}));

      if (response.ok) {
        window.location.href = payload.redirectTo || "/login";
        return;
      }

      setSaveMessage(payload.error || "Could not delete account.");
      setSaveState("error");
    } catch {
      setSaveMessage("Account settings API is required to delete accounts.");
      setSaveState("error");
    }
  }

  useEffect(() => {
    void loadSettings();

    const media = window.matchMedia("(prefers-color-scheme: dark)");
    setSystemDark(media.matches);

    const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
    media.addEventListener?.("change", listener);

    return () => media.removeEventListener?.("change", listener);
  }, []);

  const mainBackground = isLight
    ? "radial-gradient(circle at top left, rgba(220,38,38,0.12), transparent 30%), radial-gradient(circle at top right, rgba(37,99,235,0.14), transparent 30%), linear-gradient(135deg, var(--bg), var(--bg2))"
    : "radial-gradient(circle at top left, rgba(127,29,29,0.45), transparent 30%), radial-gradient(circle at top right, rgba(239,68,68,0.18), transparent 26%), radial-gradient(circle at bottom, rgba(153,27,27,0.24), transparent 38%), linear-gradient(135deg, var(--bg), #09090b, #111111, var(--bg2))";

  return (
    <main
      className="min-h-screen overflow-x-hidden p-3 md:p-5"
      style={{
        ...style,
        background: mainBackground,
        color: "var(--text)",
      }}
    >
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-12%] top-[-18%] h-[34rem] w-[34rem] rounded-full bg-red-700/20 blur-3xl" />
        <div className="absolute right-[-14%] top-[5%] h-[34rem] w-[34rem] rounded-full bg-blue-500/10 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[25%] h-[30rem] w-[30rem] rounded-full bg-orange-700/10 blur-3xl" />
      </div>

      <div className={cx("relative mx-auto grid max-w-[1800px]", pageGap)}>
        <header
          className="relative overflow-hidden rounded-[2.25rem] border p-5 shadow-2xl backdrop-blur-xl"
          style={{
            background: "var(--surface)",
            borderColor: "var(--border)",
            boxShadow: "0 24px 70px var(--shadow)",
          }}
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(239,68,68,0.18),transparent_30%),radial-gradient(circle_at_82%_12%,rgba(248,113,113,0.12),transparent_26%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className={cx("inline-flex rounded-3xl p-3", isLight ? "bg-zinc-950" : "bg-transparent")}>
                <BrandMark />
              </div>

              <div className="mt-5 flex flex-wrap gap-2">
                <Pill tone="red" isLight={isLight}>Workspace Settings</Pill>
                <Pill tone={isLight ? "cyan" : "red"} isLight={isLight}>{settings.appearance.mode} mode</Pill>
                <Pill tone="green" isLight={isLight}>{hasUnsavedChanges ? "Unsaved changes" : "Saved"}</Pill>
                <Pill tone="purple" isLight={isLight}>{settings.appearance.accent}</Pill>
              </div>

              <h1 className="mt-4 max-w-6xl text-4xl font-black leading-tight tracking-tight md:text-6xl" style={{ color: "var(--text)" }}>
                Save and apply settings across the whole workspace.
              </h1>

              <p className="mt-3 max-w-5xl text-sm font-semibold leading-7" style={{ color: "var(--muted)" }}>
                Choose your theme, accent, density, and platform preferences, then click Save & Apply. The workspace layout broadcasts those saved settings across all workspace tabs and routes.
              </p>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              <button
                type="button"
                onClick={saveSettings}
                className="rounded-2xl bg-gradient-to-br from-white via-red-100 to-red-200 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-red-950/20 transition hover:-translate-y-0.5"
              >
                {saveState === "saving" ? "Saving..." : "Save & Apply"}
              </button>
              <button
                type="button"
                onClick={logout}
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-black text-red-100 transition hover:-translate-y-0.5"
              >
                Logout
              </button>
              <Link
                href="/workspace"
                prefetch={false}
                className={cx("rounded-2xl border px-5 py-3 text-sm font-black transition hover:-translate-y-0.5", toneClasses("slate", isLight))}
              >
                Back to Workspace
              </Link>
            </div>
          </div>

          <div className="relative mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <MetricCard label="Account" value={settings.account.name || "Set up"} helper={settings.account.email || "No email"} tone="red" />
            <MetricCard label="Theme" value={settings.appearance.mode} helper={theme} tone={isLight ? "cyan" : "red"} />
            <MetricCard label="Accent" value={settings.appearance.accent} helper="Global workspace color" tone="purple" />
            <MetricCard label="Density" value={settings.appearance.density} helper="Workspace spacing" tone="green" />
            <MetricCard label="Alerts" value={`${activeNotifications}/${settings.notifications.length}`} helper="Enabled channels" tone="amber" />
            <MetricCard label="Save State" value={hasUnsavedChanges ? "Unsaved" : "Saved"} helper="Click Save & Apply" tone={hasUnsavedChanges ? "amber" : "green"} />
          </div>

          {saveMessage ? (
            <div
              className={cx(
                "relative mt-4 rounded-2xl border p-3 text-sm font-bold",
                saveState === "error" ? toneClasses("red", isLight) : saveState === "unsaved" ? toneClasses("amber", isLight) : toneClasses("green", isLight),
              )}
            >
              {saveMessage}
            </div>
          ) : null}
        </header>

        <section className="grid gap-4 xl:grid-cols-[330px_minmax(0,1fr)]">
          <Card density={settings.appearance.density} className="self-start xl:sticky xl:top-4">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
              Settings Navigation
            </div>
            <div className="mt-4 grid gap-2">
              {SETTING_TABS.map((tab) => (
                <SettingsTabButton
                  key={tab.id}
                  tab={tab}
                  active={activeTab === tab.id}
                  isLight={isLight}
                  onClick={() => setActiveTab(tab.id)}
                />
              ))}
            </div>

            <div className="mt-5 grid gap-2">
              <button
                type="button"
                onClick={saveSettings}
                className="rounded-2xl bg-gradient-to-br from-white via-red-100 to-red-200 px-4 py-3 text-sm font-black text-slate-950"
              >
                {saveState === "saving" ? "Saving..." : "Save & Apply"}
              </button>
              <Link href="/workspace/personal-bot" prefetch={false} className={cx("rounded-2xl border px-4 py-3 text-sm font-black", toneClasses("purple", isLight))}>
                AI Studio
              </Link>
              <Link href="/workspace/team-board" prefetch={false} className={cx("rounded-2xl border px-4 py-3 text-sm font-black", toneClasses("green", isLight))}>
                Team Board
              </Link>
              <Link href="/workspace/custom-board" prefetch={false} className={cx("rounded-2xl border px-4 py-3 text-sm font-black", toneClasses("cyan", isLight))}>
                Custom Board
              </Link>
            </div>
          </Card>

          <div className="grid gap-4">
            {activeTab === "overview" ? (
              <>
                <Card density={settings.appearance.density}>
                  <SectionHeader
                    eyebrow="Overview"
                    title="Settings apply after saving."
                    helper="Make changes freely, preview them here, then click Save & Apply to store and broadcast them across all workspace routes."
                  />

                  <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                    <Panel tone="red">
                      <div className="text-xl font-black" style={{ color: "var(--text)" }}>Theme</div>
                      <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
                        Current draft: {settings.appearance.mode}. Saved theme is applied globally after Save & Apply.
                      </p>
                      <button type="button" onClick={() => setActiveTab("appearance")} className="mt-4 rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950">
                        Edit Appearance
                      </button>
                    </Panel>

                    <Panel tone="purple">
                      <div className="text-xl font-black" style={{ color: "var(--text)" }}>Accent</div>
                      <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
                        Current draft: {settings.appearance.accent}. Accent variables are broadcast from the workspace layout.
                      </p>
                      <button type="button" onClick={() => setActiveTab("appearance")} className="mt-4 rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950">
                        Edit Accent
                      </button>
                    </Panel>

                    <Panel tone={hasUnsavedChanges ? "amber" : "green"}>
                      <div className="text-xl font-black" style={{ color: "var(--text)" }}>{hasUnsavedChanges ? "Unsaved" : "Saved"}</div>
                      <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
                        {hasUnsavedChanges
                          ? "Your changes are only previewed on this page until you save them."
                          : "Your saved settings are available to workspace tabs and routes."}
                      </p>
                      <button type="button" onClick={saveSettings} className="mt-4 rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950">
                        Save & Apply
                      </button>
                    </Panel>
                  </div>
                </Card>

                <section className="grid gap-4 xl:grid-cols-3">
                  <Card density={settings.appearance.density}>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-green-400">Platform-wide Settings</div>
                    <div className="mt-4 text-5xl font-black" style={{ color: "var(--text)" }}>Global</div>
                    <p className="mt-3 text-sm leading-6" style={{ color: "var(--muted)" }}>
                      The workspace layout reads saved settings and applies theme/accent CSS variables to every workspace page.
                    </p>
                  </Card>

                  <Card density={settings.appearance.density}>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">Save Required</div>
                    <div className="mt-4 text-5xl font-black" style={{ color: "var(--text)" }}>{hasUnsavedChanges ? "Yes" : "No"}</div>
                    <p className="mt-3 text-sm leading-6" style={{ color: "var(--muted)" }}>
                      Changes are intentionally saved by button, not automatically.
                    </p>
                  </Card>

                  <Card density={settings.appearance.density}>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Fast Action</div>
                    <div className="mt-4 grid gap-2">
                      <button type="button" onClick={saveSettings} className="rounded-2xl bg-gradient-to-br from-white via-red-100 to-red-200 px-4 py-3 text-sm font-black text-slate-950">
                        Save & Apply Workspace-Wide
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setDraftSettings(savedSettings);
                          setSaveState("idle");
                          setSaveMessage("Unsaved changes discarded.");
                        }}
                        disabled={!hasUnsavedChanges}
                        className={cx("rounded-2xl border px-4 py-3 text-sm font-black disabled:opacity-50", toneClasses("slate", isLight))}
                      >
                        Discard Unsaved Changes
                      </button>
                    </div>
                  </Card>
                </section>
              </>
            ) : null}

            {activeTab === "profile" ? (
              <Card density={settings.appearance.density}>
                <SectionHeader
                  eyebrow="Profile"
                  title="Account and advisor identity."
                  helper="These settings are saved when you click Save & Apply."
                />

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Full name</span>
                    <ThemedInput value={settings.account.name} onChange={(value) => updateAccount("name", value)} placeholder="Your name" />
                  </label>

                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Email</span>
                    <ThemedInput value={settings.account.email} onChange={(value) => updateAccount("email", value.toLowerCase())} placeholder="you@example.com" />
                  </label>

                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Phone</span>
                    <ThemedInput value={settings.account.phone} onChange={(value) => updateAccount("phone", value)} placeholder="(555) 555-5555" />
                  </label>

                  <ThemedSelect
                    label="Timezone"
                    value={settings.account.timezone}
                    options={["America/Phoenix", "America/Los_Angeles", "America/Denver", "America/Chicago", "America/New_York"]}
                    onChange={(value) => updateAccount("timezone", value)}
                    helper="Used for reminders, quiet hours, and daily briefings."
                  />

                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Title</span>
                    <ThemedInput value={settings.account.title} onChange={(value) => updateAccount("title", value)} placeholder="Advisor, Founder, Operations Lead..." />
                  </label>

                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Company / firm</span>
                    <ThemedInput value={settings.account.company} onChange={(value) => updateAccount("company", value)} placeholder="Firm or company name" />
                  </label>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <MetricCard label="Status" value={settings.account.platformStatus || "Active"} helper="Platform status" tone={toneFor(settings.account.platformStatus)} />
                  <MetricCard label="Member since" value={readableDate(settings.account.createdAt)} helper="Account age" tone="cyan" />
                  <MetricCard label="Timezone" value={settings.account.timezone} helper="Scheduling" tone="purple" />
                  <MetricCard label="Contact" value={settings.account.phone || "Not set"} helper="Phone" tone="amber" />
                </div>
              </Card>
            ) : null}

            {activeTab === "appearance" ? (
              <div className="grid gap-4">
                <Card density={settings.appearance.density}>
                  <SectionHeader
                    eyebrow="Appearance"
                    title="Preview here. Save to apply everywhere."
                    helper="Theme and accent changes preview in settings immediately. They apply to workspace tabs/routes after Save & Apply."
                  />

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <ChoiceCard
                      active={settings.appearance.mode === "dark"}
                      title="Dark command mode"
                      detail="Black/red advisor command styling with a market-desk feel."
                      tone="red"
                      isLight={isLight}
                      onClick={() => updateAppearance("mode", "dark")}
                    />
                    <ChoiceCard
                      active={settings.appearance.mode === "light"}
                      title="Light advisor mode"
                      detail="Clean white surfaces with high-contrast slate text."
                      tone="cyan"
                      isLight={isLight}
                      onClick={() => updateAppearance("mode", "light")}
                    />
                    <ChoiceCard
                      active={settings.appearance.mode === "system"}
                      title="System mode"
                      detail="Automatically follows the device preference."
                      tone="purple"
                      isLight={isLight}
                      onClick={() => updateAppearance("mode", "system")}
                    />
                  </div>

                  <div className="mt-5 grid gap-4 md:grid-cols-3">
                    <ThemedSelect
                      label="Density"
                      value={settings.appearance.density}
                      options={["comfortable", "compact", "spacious"]}
                      onChange={(value) => updateAppearance("density", value)}
                    />
                    <ThemedSelect
                      label="Accent"
                      value={settings.appearance.accent}
                      options={["slice-red", "crimson", "ruby", "graphite", "blue"]}
                      onChange={(value) => updateAppearance("accent", value)}
                    />
                    <ThemedSelect
                      label="Text scale"
                      value={settings.appearance.textScale}
                      options={["standard", "large", "extra-large"]}
                      onChange={(value) => updateAppearance("textScale", value)}
                    />
                    <ThemedSelect
                      label="Card style"
                      value={settings.appearance.cardStyle}
                      options={["glass", "solid", "minimal"]}
                      onChange={(value) => updateAppearance("cardStyle", value)}
                    />
                    <ThemedSelect
                      label="Navigation style"
                      value={settings.appearance.navigationStyle}
                      options={["executive", "compact", "command"]}
                      onChange={(value) => updateAppearance("navigationStyle", value)}
                    />
                    <ThemedSelect
                      label="Motion"
                      value={settings.appearance.motion}
                      options={["full", "reduced"]}
                      onChange={(value) => updateAppearance("motion", value)}
                    />
                  </div>

                  <div className="mt-5">
                    <button
                      type="button"
                      onClick={saveSettings}
                      className="rounded-2xl bg-gradient-to-br from-white via-red-100 to-red-200 px-5 py-3 text-sm font-black text-slate-950"
                    >
                      Save & Apply Appearance Workspace-Wide
                    </button>
                  </div>
                </Card>

                <section className="grid gap-4 xl:grid-cols-3">
                  <Card density={settings.appearance.density}>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-green-400">Live Preview</div>
                    <div className="mt-4 rounded-[1.5rem] border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-black" style={{ color: "var(--text)" }}>Client Portal Inbox</div>
                          <div className="mt-1 text-xs font-semibold" style={{ color: "var(--muted)" }}>Preview in {settings.appearance.mode} mode</div>
                        </div>
                        <Pill tone="purple" isLight={isLight}>Preview</Pill>
                      </div>
                      <div className="mt-4 grid gap-2">
                        <Panel tone="cyan">
                          <div className="text-xs font-black" style={{ color: "var(--text)" }}>Readable surfaces</div>
                          <div className="mt-1 text-xs font-semibold" style={{ color: "var(--muted)" }}>Text remains visible in light and dark.</div>
                        </Panel>
                        <Panel tone="red">
                          <div className="text-xs font-black" style={{ color: "var(--text)" }}>Accent-ready</div>
                          <div className="mt-1 text-xs font-semibold" style={{ color: "var(--muted)" }}>Saved accent is pushed through the workspace layout.</div>
                        </Panel>
                      </div>
                    </div>
                  </Card>

                  <Card density={settings.appearance.density}>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">Save Behavior</div>
                    <div className="mt-4 text-4xl font-black" style={{ color: "var(--text)" }}>
                      {hasUnsavedChanges ? "Pending" : "Applied"}
                    </div>
                    <p className="mt-3 text-sm leading-6" style={{ color: "var(--muted)" }}>
                      Changes apply platform-wide only after clicking Save & Apply.
                    </p>
                  </Card>

                  <Card density={settings.appearance.density}>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Accent Preview</div>
                    <div className="mt-5 h-20 rounded-[1.5rem] border" style={{ borderColor: "var(--border)", background: `linear-gradient(135deg, var(--accentDark), var(--accent), var(--panel2))` }} />
                    <div className="mt-3 text-sm font-bold" style={{ color: "var(--muted)" }}>
                      Current draft accent: {settings.appearance.accent}
                    </div>
                  </Card>
                </section>
              </div>
            ) : null}

            {activeTab === "notifications" ? (
              <Card density={settings.appearance.density}>
                <SectionHeader
                  eyebrow="Notifications"
                  title="Control every alert type."
                  helper="Set what gets surfaced, where it appears, quiet hours, score thresholds, digest behavior, and cooldowns."
                />

                <div className="mt-5 grid gap-3">
                  {settings.notifications.map((item, index) => (
                    <div
                      key={item.channel}
                      className="rounded-[1.5rem] border p-4"
                      style={{
                        background: "var(--panel)",
                        borderColor: "var(--border)",
                      }}
                    >
                      <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <div className="text-xl font-black" style={{ color: "var(--text)" }}>{item.channel}</div>
                            <Pill tone={item.enabled ? "green" : "slate"} isLight={isLight}>{item.enabled ? "Enabled" : "Off"}</Pill>
                            <Pill tone={toneFor(item.minUrgency)} isLight={isLight}>{item.minUrgency}</Pill>
                          </div>
                          <p className="mt-1 text-xs font-semibold" style={{ color: "var(--muted)" }}>
                            Alert score, urgency, quiet hours, digest-only delivery, and cooldown controls.
                          </p>
                        </div>

                        <ToggleRow
                          label="Channel enabled"
                          checked={item.enabled}
                          onChange={(value) => updateNotification(index, { enabled: value })}
                          tone="green"
                          isLight={isLight}
                        />
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-6">
                        <ThemedSelect
                          label="Urgency"
                          value={item.minUrgency}
                          options={["Low", "Medium", "High", "Critical"]}
                          onChange={(value) => updateNotification(index, { minUrgency: value })}
                        />
                        <label>
                          <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Min score</span>
                          <ThemedInput type="number" value={item.minScore} onChange={(value) => updateNotification(index, { minScore: Number(value) })} />
                        </label>
                        <label>
                          <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Quiet start</span>
                          <ThemedInput type="time" value={item.quietHoursStart || ""} onChange={(value) => updateNotification(index, { quietHoursStart: value })} />
                        </label>
                        <label>
                          <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Quiet end</span>
                          <ThemedInput type="time" value={item.quietHoursEnd || ""} onChange={(value) => updateNotification(index, { quietHoursEnd: value })} />
                        </label>
                        <label>
                          <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Cooldown</span>
                          <ThemedInput type="number" value={item.cooldownMinutes} onChange={(value) => updateNotification(index, { cooldownMinutes: Number(value) })} />
                        </label>
                        <div className="self-end">
                          <ToggleRow
                            label="Digest"
                            checked={item.digestOnly}
                            onChange={(value) => updateNotification(index, { digestOnly: value })}
                            tone="amber"
                            isLight={isLight}
                          />
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </Card>
            ) : null}

            {activeTab === "security" ? (
              <Card density={settings.appearance.density}>
                <SectionHeader
                  eyebrow="Security"
                  title="Account access and sensitive-action protection."
                  helper="Protect advisor workflows with session settings, re-authentication, new-login alerts, MFA readiness, password reset, and logout."
                />

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <ToggleRow
                    label="Multi-factor authentication"
                    helper="UI-ready setting. Connect MFA provider when ready."
                    checked={settings.security.mfaEnabled}
                    onChange={(value) => updateSecurity("mfaEnabled", value)}
                    tone="green"
                    isLight={isLight}
                  />
                  <ToggleRow
                    label="Require re-auth for sensitive actions"
                    helper="Recommended for reports, emails, account changes, and external actions."
                    checked={settings.security.requireReauthForSensitiveActions}
                    onChange={(value) => updateSecurity("requireReauthForSensitiveActions", value)}
                    tone="red"
                    isLight={isLight}
                  />
                  <ToggleRow
                    label="Alert on new login"
                    checked={settings.security.alertOnNewLogin}
                    onChange={(value) => updateSecurity("alertOnNewLogin", value)}
                    tone="amber"
                    isLight={isLight}
                  />
                  <ToggleRow
                    label="Advisor mode"
                    helper="Adds a stricter review posture for client-facing actions."
                    checked={settings.security.advisorModeEnabled}
                    onChange={(value) => updateSecurity("advisorModeEnabled", value)}
                    tone="purple"
                    isLight={isLight}
                  />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_360px]">
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Session timeout minutes</span>
                    <ThemedInput
                      type="number"
                      value={settings.security.sessionTimeoutMinutes}
                      onChange={(value) => updateSecurity("sessionTimeoutMinutes", Number(value))}
                    />
                  </label>

                  <Panel tone="green">
                    <div className="text-sm font-black" style={{ color: "var(--text)" }}>Security posture</div>
                    <p className="mt-2 text-xs leading-5" style={{ color: "var(--muted)" }}>
                      Last security review: {settings.security.lastSecurityReviewAt ? readableDate(settings.security.lastSecurityReviewAt) : "Not recorded"}
                    </p>
                  </Panel>
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={requestPasswordReset}
                    className={cx("rounded-2xl border px-5 py-3 text-sm font-black", toneClasses("amber", isLight))}
                  >
                    Send Password Reset Email
                  </button>
                  <button
                    type="button"
                    onClick={logout}
                    className={cx("rounded-2xl border px-5 py-3 text-sm font-black", toneClasses("red", isLight))}
                  >
                    Logout Now
                  </button>
                </div>

                {passwordResetStatus ? (
                  <div className={cx("mt-4 rounded-2xl border p-3 text-sm font-bold", toneClasses("amber", isLight))}>
                    {passwordResetStatus}
                  </div>
                ) : null}
              </Card>
            ) : null}

            {activeTab === "privacy" ? (
              <Card density={settings.appearance.density}>
                <SectionHeader
                  eyebrow="Privacy"
                  title="Control memory, analytics, retention, and sensitive display."
                  helper="These preferences make the workspace feel personal without losing control over what is stored, shown, retained, or used for personalization."
                />

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <ToggleRow label="AI memory" helper="Allow Slice to remember preferences and workflow style." checked={settings.privacy.aiMemoryEnabled} onChange={(value) => updatePrivacy("aiMemoryEnabled", value)} tone="purple" isLight={isLight} />
                  <ToggleRow label="Personalization" helper="Use preferences to tailor UI and AI behavior." checked={settings.privacy.personalizationEnabled} onChange={(value) => updatePrivacy("personalizationEnabled", value)} tone="green" isLight={isLight} />
                  <ToggleRow label="Analytics" helper="Use platform analytics to improve the user experience." checked={settings.privacy.analyticsEnabled} onChange={(value) => updatePrivacy("analyticsEnabled", value)} tone="cyan" isLight={isLight} />
                  <ToggleRow label="Usage improvement sharing" helper="Optional product improvement signal." checked={settings.privacy.shareUsageForImprovement} onChange={(value) => updatePrivacy("shareUsageForImprovement", value)} tone="amber" isLight={isLight} />
                  <ToggleRow label="Marketing emails" checked={settings.privacy.marketingEmailsEnabled} onChange={(value) => updatePrivacy("marketingEmailsEnabled", value)} tone="slate" isLight={isLight} />
                  <ToggleRow label="Show profile to team" checked={settings.privacy.showProfileToTeam} onChange={(value) => updatePrivacy("showProfileToTeam", value)} tone="blue" isLight={isLight} />
                  <ToggleRow label="Hide sensitive values" helper="Masks sensitive client/account values in general workspace views." checked={settings.privacy.hideSensitiveValues} onChange={(value) => updatePrivacy("hideSensitiveValues", value)} tone="red" isLight={isLight} />
                  <ToggleRow label="Mask client names" helper="Useful for screen sharing or founder demos." checked={settings.privacy.maskClientNames} onChange={(value) => updatePrivacy("maskClientNames", value)} tone="purple" isLight={isLight} />
                  <ToggleRow label="Allow browser storage" helper="Stores settings locally for fast loading." checked={settings.privacy.allowBrowserStorage} onChange={(value) => updatePrivacy("allowBrowserStorage", value)} tone="green" isLight={isLight} />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <ThemedSelect label="Report retention" value={settings.privacy.retainReports} options={["30 days", "90 days", "1 year", "Forever"]} onChange={(value) => updatePrivacy("retainReports", value)} />
                  <ThemedSelect label="Default export format" value={settings.privacy.exportFormat} options={["PDF", "CSV", "JSON"]} onChange={(value) => updatePrivacy("exportFormat", value)} />
                </div>
              </Card>
            ) : null}

            {activeTab === "workspace" ? (
              <Card density={settings.appearance.density}>
                <SectionHeader
                  eyebrow="Workspace"
                  title="Control the modules, defaults, and advisor operating flow."
                  helper="Choose what appears, what is pinned, what gets confirmed, and where each advisor lands by default."
                />

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <ThemedSelect
                    label="Default landing"
                    value={settings.workspace.defaultLanding}
                    options={[
                      "/workspace",
                      "/workspace/personal-bot",
                      "/workspace/team-board",
                      "/workspace/custom-board",
                      "/workspace/watchlists",
                      "/workspace/client-portal-inbox",
                      "/workspace/client-emails",
                    ]}
                    onChange={(value) => updateWorkspace("defaultLanding", value)}
                  />
                  <ThemedSelect
                    label="Navigation style"
                    value={settings.appearance.navigationStyle}
                    options={["executive", "compact", "command"]}
                    onChange={(value) => updateAppearance("navigationStyle", value)}
                  />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <ToggleRow label="Show market pulse" checked={settings.workspace.showMarketPulse} onChange={(value) => updateWorkspace("showMarketPulse", value)} tone="cyan" isLight={isLight} />
                  <ToggleRow label="Show team snapshot" checked={settings.workspace.showTeamSnapshot} onChange={(value) => updateWorkspace("showTeamSnapshot", value)} tone="green" isLight={isLight} />
                  <ToggleRow label="Show client inbox" checked={settings.workspace.showClientInbox} onChange={(value) => updateWorkspace("showClientInbox", value)} tone="purple" isLight={isLight} />
                  <ToggleRow label="Show watchlist preview" checked={settings.workspace.showWatchlistPreview} onChange={(value) => updateWorkspace("showWatchlistPreview", value)} tone="amber" isLight={isLight} />
                  <ToggleRow label="Show compliance banner" checked={settings.workspace.showComplianceBanner} onChange={(value) => updateWorkspace("showComplianceBanner", value)} tone="red" isLight={isLight} />
                  <ToggleRow label="Compact sidebar" checked={settings.workspace.compactSidebar} onChange={(value) => updateWorkspace("compactSidebar", value)} tone="slate" isLight={isLight} />
                  <ToggleRow label="Pinned command bar" checked={settings.workspace.commandBarPinned} onChange={(value) => updateWorkspace("commandBarPinned", value)} tone="green" isLight={isLight} />
                  <ToggleRow label="Auto-save drafts" checked={settings.workspace.autoSaveDrafts} onChange={(value) => updateWorkspace("autoSaveDrafts", value)} tone="cyan" isLight={isLight} />
                  <ToggleRow label="Confirm external actions" checked={settings.workspace.confirmBeforeExternalActions} onChange={(value) => updateWorkspace("confirmBeforeExternalActions", value)} tone="red" isLight={isLight} />
                </div>
              </Card>
            ) : null}

            {activeTab === "ai" ? (
              <Card density={settings.appearance.density}>
                <SectionHeader
                  eyebrow="AI Defaults"
                  title="Set how Slice AI behaves across the workspace."
                  helper="These preferences make every AI interaction more consistent for each unique advisor."
                />

                <div className="mt-5 grid gap-4 md:grid-cols-3">
                  <ThemedSelect label="Default mode" value={settings.ai.defaultMode} options={["quick", "balanced", "deep"]} onChange={(value) => updateAi("defaultMode", value)} />
                  <ThemedSelect label="Reply format" value={settings.ai.replyFormat} options={["executive-summary", "advisor-memo", "client-friendly", "action-plan"]} onChange={(value) => updateAi("replyFormat", value)} />
                  <ThemedSelect label="Report style" value={settings.ai.defaultReportStyle} options={["Premium Red", "Boardroom", "Client Clean", "Technical"]} onChange={(value) => updateAi("defaultReportStyle", value)} />
                  <ThemedSelect label="Preferred tone" value={settings.ai.preferredTone} options={["Professional", "Calm", "Direct", "Encouraging", "Brutally honest", "Witty"]} onChange={(value) => updateAi("preferredTone", value)} />
                  <ThemedSelect label="Detail level" value={settings.ai.detailLevel} options={["Short", "Balanced detail", "Detailed", "Deep research"]} onChange={(value) => updateAi("detailLevel", value)} />
                </div>

                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <ToggleRow label="Use AI memory" checked={settings.ai.useMemory} onChange={(value) => updateAi("useMemory", value)} tone="purple" isLight={isLight} />
                  <ToggleRow label="Auto-read AI replies" checked={settings.ai.autoReadReplies} onChange={(value) => updateAi("autoReadReplies", value)} tone="cyan" isLight={isLight} />
                  <ToggleRow label="Require approval for reports" checked={settings.ai.requireApprovalForReports} onChange={(value) => updateAi("requireApprovalForReports", value)} tone="amber" isLight={isLight} />
                  <ToggleRow label="Require approval for emails" checked={settings.ai.requireApprovalForEmails} onChange={(value) => updateAi("requireApprovalForEmails", value)} tone="red" isLight={isLight} />
                </div>
              </Card>
            ) : null}

            {activeTab === "support" ? (
              <div className="grid gap-4">
                <Card density={settings.appearance.density}>
                  <SectionHeader
                    eyebrow="Contact"
                    title="Need help or founder support?"
                    helper="Contact details are easy to access, especially for early users, advisors, demos, and support requests."
                  />

                  <div className="mt-5 grid gap-4 md:grid-cols-2">
                    <a
                      href={settings.contact.phoneHref}
                      className="rounded-[1.5rem] border p-5 transition hover:-translate-y-1 hover:bg-red-500/10"
                      style={{ background: "var(--panel)", borderColor: "var(--border)" }}
                    >
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-red-400">Phone</div>
                      <div className="mt-2 text-3xl font-black" style={{ color: "var(--text)" }}>{settings.contact.phone}</div>
                      <p className="mt-2 text-sm font-semibold" style={{ color: "var(--muted)" }}>Tap to call on mobile.</p>
                    </a>

                    <a
                      href={settings.contact.emailHref}
                      className="rounded-[1.5rem] border p-5 transition hover:-translate-y-1 hover:bg-red-500/10"
                      style={{ background: "var(--panel)", borderColor: "var(--border)" }}
                    >
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-red-400">Email</div>
                      <div className="mt-2 break-all text-2xl font-black" style={{ color: "var(--text)" }}>{settings.contact.email}</div>
                      <p className="mt-2 text-sm font-semibold" style={{ color: "var(--muted)" }}>Send product, support, or investor notes.</p>
                    </a>
                  </div>
                </Card>

                <section className="grid gap-4 xl:grid-cols-3">
                  <Card density={settings.appearance.density}>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">Support Paths</div>
                    <div className="mt-4 grid gap-2">
                      <Panel tone="cyan"><div className="text-sm font-black" style={{ color: "var(--text)" }}>Bug report</div></Panel>
                      <Panel tone="purple"><div className="text-sm font-black" style={{ color: "var(--text)" }}>Feature request</div></Panel>
                      <Panel tone="amber"><div className="text-sm font-black" style={{ color: "var(--text)" }}>Advisor onboarding help</div></Panel>
                    </div>
                  </Card>

                  <Card density={settings.appearance.density}>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-green-400">Useful Routes</div>
                    <div className="mt-4 grid gap-2">
                      <Link href="/workspace/personal-bot" className={cx("rounded-2xl border px-4 py-3 text-sm font-black", toneClasses("purple", isLight))}>AI Studio</Link>
                      <Link href="/workspace/team-board" className={cx("rounded-2xl border px-4 py-3 text-sm font-black", toneClasses("green", isLight))}>Team Board</Link>
                      <Link href="/workspace/custom-board" className={cx("rounded-2xl border px-4 py-3 text-sm font-black", toneClasses("cyan", isLight))}>Custom Board</Link>
                    </div>
                  </Card>

                  <Card density={settings.appearance.density}>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">Account Help</div>
                    <p className="mt-4 text-sm leading-6" style={{ color: "var(--muted)" }}>
                      For account access, report generation, AI response issues, workspace customization, and advisor demo questions, use the phone or email above.
                    </p>
                  </Card>
                </section>
              </div>
            ) : null}

            {activeTab === "danger" ? (
              <Card density={settings.appearance.density}>
                <SectionHeader
                  eyebrow="Account Actions"
                  title="Deactivate or delete account."
                  helper="These actions are intentionally separated, clearly labeled, and require typed confirmations."
                />

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  <Panel tone="amber">
                    <div className="text-2xl font-black" style={{ color: "var(--text)" }}>Deactivate account</div>
                    <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
                      Deactivation suspends access and logs the user out. Type DEACTIVATE to confirm.
                    </p>
                    <ThemedInput value={deactivateConfirm} onChange={setDeactivateConfirm} placeholder="DEACTIVATE" />
                    <button
                      type="button"
                      onClick={deactivateAccount}
                      disabled={deactivateConfirm !== "DEACTIVATE"}
                      className={cx("mt-4 rounded-2xl border px-5 py-3 text-sm font-black disabled:opacity-50", toneClasses("amber", isLight))}
                    >
                      Deactivate Account
                    </button>
                  </Panel>

                  <Panel tone="red">
                    <div className="text-2xl font-black" style={{ color: "var(--text)" }}>Delete account</div>
                    <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
                      Permanent deletion removes the user account and cascaded data. Type DELETE MY ACCOUNT to confirm.
                    </p>
                    <ThemedInput value={deleteConfirm} onChange={setDeleteConfirm} placeholder="DELETE MY ACCOUNT" />
                    <button
                      type="button"
                      onClick={deleteAccount}
                      disabled={deleteConfirm !== "DELETE MY ACCOUNT"}
                      className={cx("mt-4 rounded-2xl border px-5 py-3 text-sm font-black disabled:opacity-50", toneClasses("red", isLight))}
                    >
                      Delete Account
                    </button>
                  </Panel>
                </div>

                <div className="mt-5">
                  <button
                    type="button"
                    onClick={logout}
                    className={cx("rounded-2xl border px-5 py-3 text-sm font-black", toneClasses("slate", isLight))}
                  >
                    Logout Instead
                  </button>
                </div>
              </Card>
            ) : null}
          </div>
        </section>
      </div>
    </main>
  );
}