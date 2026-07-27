"use client";

import Link from "next/link";
import type {
  ChangeEvent,
  CSSProperties,
  ReactNode,
} from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import {
  Activity,
  AlertTriangle,
  BellRing,
  Bot,
  Check,
  CheckCircle2,
  ChevronRight,
  CircleUserRound,
  ExternalLink,
  Eye,
  Gauge,
  KeyRound,
  LayoutDashboard,
  LifeBuoy,
  LockKeyhole,
  Mail,
  Monitor,
  Moon,
  Palette,
  RefreshCw,
  RotateCcw,
  Save,
  Settings2,
  ShieldCheck,
  Sun,
  Trash2,
  UserRoundCog,
  WandSparkles,
  Workflow,
} from "lucide-react";

import {
  BrandMark,
} from "@/components/slice-ui";

type ThemeMode =
  | "dark"
  | "light"
  | "system";

type Density =
  | "comfortable"
  | "compact"
  | "spacious";

type Accent =
  | "market-green"
  | "emerald"
  | "teal"
  | "graphite"
  | "blue";

type CardStyle =
  | "glass"
  | "solid"
  | "minimal";

type NavigationStyle =
  | "executive"
  | "compact"
  | "command";

type MotionMode =
  | "full"
  | "reduced";

type TextScale =
  | "standard"
  | "large"
  | "extra-large";

type AiMode =
  | "quick"
  | "balanced"
  | "deep";

type ReplyFormat =
  | "executive-summary"
  | "advisor-memo"
  | "client-friendly"
  | "action-plan";

type ReportStyle =
  | "Market Green"
  | "Boardroom"
  | "Client Clean"
  | "Technical";

type RetentionPeriod =
  | "30 days"
  | "90 days"
  | "1 year"
  | "Forever";

type ExportFormat =
  | "PDF"
  | "CSV"
  | "JSON";

type Tone =
  | "emerald"
  | "teal"
  | "cyan"
  | "blue"
  | "violet"
  | "amber"
  | "slate";

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

type AccountSettings = {
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

type AppearanceSettings = {
  mode: ThemeMode;
  density: Density;
  accent: Accent;
  cardStyle: CardStyle;
  navigationStyle: NavigationStyle;
  motion: MotionMode;
  textScale: TextScale;
};

type WorkspacePreferences = {
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

type AiPreferences = {
  defaultMode: AiMode;
  replyFormat: ReplyFormat;
  preferredTone: string;
  detailLevel: string;
  useMemory: boolean;
  autoReadReplies: boolean;
  requireApprovalForReports: boolean;
  requireApprovalForEmails: boolean;
  defaultReportStyle: ReportStyle;
};

type PrivacySettings = {
  aiMemoryEnabled: boolean;
  personalizationEnabled: boolean;
  analyticsEnabled: boolean;
  marketingEmailsEnabled: boolean;
  shareUsageForImprovement: boolean;
  showProfileToTeam: boolean;
  retainReports: RetentionPeriod;
  exportFormat: ExportFormat;
  hideSensitiveValues: boolean;
  maskClientNames: boolean;
  allowBrowserStorage: boolean;
};

type SecuritySettings = {
  mfaEnabled: boolean;
  requireReauthForSensitiveActions: boolean;
  alertOnNewLogin: boolean;
  advisorModeEnabled: boolean;
  sessionTimeoutMinutes: number;
  lastSecurityReviewAt?: string | null;
};

type ContactSettings = {
  name: string;
  phone: string;
  phoneHref: string;
  email: string;
  emailHref: string;
};

type WorkspaceSettings = {
  account: AccountSettings;
  appearance: AppearanceSettings;
  workspace: WorkspacePreferences;
  ai: AiPreferences;
  privacy: PrivacySettings;
  security: SecuritySettings;
  notifications: AlertChannel[];
  contact: ContactSettings;
};

type ApiSettingsResponse = {
  ok?: boolean;
  account?: Partial<AccountSettings>;
  appearance?: {
    mode?: unknown;
    density?: unknown;
    accent?: unknown;
  };
  privacy?: Partial<PrivacySettings>;
  security?: Partial<SecuritySettings>;
  notifications?: AlertChannel[];
  contact?: Partial<ContactSettings>;
  profileContext?: {
    profileId?: string | null;
    firmId?: string | null;
  };
  error?: string;
  detail?: string;
  message?: string;
  redirectTo?: string;
};

type LocalSettings = {
  account?: Partial<
    Pick<
      AccountSettings,
      | "firmName"
      | "title"
      | "company"
    >
  >;
  appearance?: Partial<AppearanceSettings>;
  workspace?: Partial<WorkspacePreferences>;
  ai?: Partial<AiPreferences>;
  privacy?: Partial<PrivacySettings>;
};

type TabDefinition = {
  id: SettingsTab;
  label: string;
  helper: string;
  tone: Tone;
  icon: typeof Settings2;
};

type SelectOption<T extends string> = {
  value: T;
  label: string;
  helper?: string;
};

const WORKSPACE_SETTINGS_KEY =
  "slice-workspace-settings-v5";
const THEME_KEY =
  "slice-theme-mode-v1";
const DENSITY_KEY =
  "slice-density-mode-v1";
const ACCENT_KEY =
  "slice-accent-mode-v1";

const DEFAULT_NOTIFICATIONS: AlertChannel[] = [
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
];

const DEFAULT_SETTINGS: WorkspaceSettings = {
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
    accent: "market-green",
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
    defaultReportStyle: "Market Green",
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
    advisorModeEnabled: true,
    sessionTimeoutMinutes: 720,
    lastSecurityReviewAt: null,
  },
  notifications: DEFAULT_NOTIFICATIONS,
  contact: {
    name: "Slice Support",
    phone: "",
    phoneHref: "",
    email: "",
    emailHref: "",
  },
};

const TABS: TabDefinition[] = [
  {
    id: "overview",
    label: "Overview",
    helper: "Control center",
    tone: "emerald",
    icon: LayoutDashboard,
  },
  {
    id: "profile",
    label: "Profile",
    helper: "Account identity",
    tone: "cyan",
    icon: CircleUserRound,
  },
  {
    id: "appearance",
    label: "Appearance",
    helper: "Theme and layout",
    tone: "violet",
    icon: Palette,
  },
  {
    id: "notifications",
    label: "Alerts",
    helper: "Channels and rules",
    tone: "amber",
    icon: BellRing,
  },
  {
    id: "security",
    label: "Security",
    helper: "Access controls",
    tone: "emerald",
    icon: ShieldCheck,
  },
  {
    id: "privacy",
    label: "Privacy",
    helper: "Data controls",
    tone: "blue",
    icon: Eye,
  },
  {
    id: "workspace",
    label: "Workspace",
    helper: "Modules and defaults",
    tone: "teal",
    icon: Workflow,
  },
  {
    id: "ai",
    label: "AI Defaults",
    helper: "Assistant behavior",
    tone: "violet",
    icon: Bot,
  },
  {
    id: "support",
    label: "Contact",
    helper: "Help and support",
    tone: "cyan",
    icon: LifeBuoy,
  },
  {
    id: "danger",
    label: "Account",
    helper: "Deactivate or delete",
    tone: "amber",
    icon: AlertTriangle,
  },
];

const THEME_OPTIONS:
  readonly SelectOption<ThemeMode>[] = [
    {
      value: "dark",
      label: "Dark",
    },
    {
      value: "light",
      label: "Light",
    },
    {
      value: "system",
      label: "System",
    },
  ];

const DENSITY_OPTIONS:
  readonly SelectOption<Density>[] = [
    {
      value: "compact",
      label: "Compact",
    },
    {
      value: "comfortable",
      label: "Comfortable",
    },
    {
      value: "spacious",
      label: "Spacious",
    },
  ];

const ACCENT_OPTIONS:
  readonly SelectOption<Accent>[] = [
    {
      value: "market-green",
      label: "Market Green",
      helper: "Primary Slice identity",
    },
    {
      value: "emerald",
      label: "Emerald",
      helper: "Deeper institutional green",
    },
    {
      value: "teal",
      label: "Teal",
      helper: "Green-cyan research accent",
    },
    {
      value: "graphite",
      label: "Graphite",
      helper: "Neutral operating mode",
    },
    {
      value: "blue",
      label: "Blue",
      helper: "Traditional market blue",
    },
  ];

const TIMEZONE_OPTIONS = [
  "America/Phoenix",
  "America/Los_Angeles",
  "America/Denver",
  "America/Chicago",
  "America/New_York",
  "UTC",
] as const;

const LANDING_OPTIONS = [
  {
    value: "/workspace",
    label: "Workspace Core",
  },
  {
    value: "/workspace/brief",
    label: "Advisor Brief",
  },
  {
    value: "/workspace/intelligence",
    label: "Intelligence",
  },
  {
    value: "/workspace/watchlists",
    label: "Watchlists",
  },
  {
    value: "/workspace/client-portal-inbox",
    label: "Client Portal Inbox",
  },
  {
    value: "/workspace/team-board",
    label: "Team Board",
  },
] as const;

function cx(
  ...classes: Array<
    string | false | null | undefined
  >
) {
  return classes
    .filter(Boolean)
    .join(" ");
}

function isRecord(
  value: unknown,
): value is Record<string, unknown> {
  return (
    typeof value === "object" &&
    value !== null &&
    !Array.isArray(value)
  );
}

function deepMerge<T>(
  base: T,
  incoming:
    | Partial<T>
    | null
    | undefined,
): T {
  if (!incoming) {
    return base;
  }

  const output = {
    ...(base as Record<string, unknown>),
  };

  for (
    const [
      key,
      value,
    ] of Object.entries(
      incoming as Record<string, unknown>,
    )
  ) {
    if (
      isRecord(value) &&
      isRecord(output[key])
    ) {
      output[key] =
        deepMerge(
          output[key],
          value,
        );
    } else if (
      value !== undefined
    ) {
      output[key] =
        value;
    }
  }

  return output as T;
}

function readLocalSettings(): LocalSettings {
  if (
    typeof window === "undefined"
  ) {
    return {};
  }

  try {
    const value =
      window.localStorage.getItem(
        WORKSPACE_SETTINGS_KEY,
      );

    return value
      ? (JSON.parse(value) as LocalSettings)
      : {};
  } catch {
    return {};
  }
}

function normalizeTheme(
  value: unknown,
): ThemeMode {
  return (
    value === "light" ||
    value === "system" ||
    value === "dark"
  )
    ? value
    : "dark";
}

function normalizeDensity(
  value: unknown,
): Density {
  const normalized =
    String(value ?? "")
      .trim()
      .toLowerCase();

  return (
    normalized === "compact" ||
    normalized === "spacious" ||
    normalized === "comfortable"
  )
    ? normalized
    : "comfortable";
}

function normalizeAccent(
  value: unknown,
): Accent {
  const normalized =
    String(value ?? "")
      .trim()
      .toLowerCase();

  if (
    normalized === "market-green" ||
    normalized === "slice-red" ||
    normalized === "slice red"
  ) {
    return "market-green";
  }

  if (
    normalized === "emerald" ||
    normalized === "crimson"
  ) {
    return "emerald";
  }

  if (
    normalized === "teal" ||
    normalized === "ruby"
  ) {
    return "teal";
  }

  if (
    normalized === "graphite"
  ) {
    return "graphite";
  }

  if (
    normalized === "blue"
  ) {
    return "blue";
  }

  return "market-green";
}

function normalizeCardStyle(
  value: unknown,
): CardStyle {
  return (
    value === "solid" ||
    value === "minimal" ||
    value === "glass"
  )
    ? value
    : "glass";
}

function normalizeNavigationStyle(
  value: unknown,
): NavigationStyle {
  return (
    value === "compact" ||
    value === "command" ||
    value === "executive"
  )
    ? value
    : "executive";
}

function normalizeMotion(
  value: unknown,
): MotionMode {
  return value === "reduced"
    ? "reduced"
    : "full";
}

function normalizeTextScale(
  value: unknown,
): TextScale {
  return (
    value === "large" ||
    value === "extra-large" ||
    value === "standard"
  )
    ? value
    : "standard";
}

function legacyApiAccent(
  accent: Accent,
) {
  if (accent === "emerald") {
    return "Crimson";
  }

  if (accent === "teal") {
    return "Ruby";
  }

  if (accent === "graphite") {
    return "Graphite";
  }

  return "Slice Red";
}

function legacyApiDensity(
  density: Density,
) {
  if (density === "compact") {
    return "Compact";
  }

  if (density === "spacious") {
    return "Spacious";
  }

  return "Comfortable";
}

function accentValues(
  accent: Accent,
) {
  if (accent === "emerald") {
    return {
      accent: "#059669",
      dark: "#064e3b",
      soft: "rgba(5,150,105,0.15)",
      border: "rgba(52,211,153,0.38)",
    };
  }

  if (accent === "teal") {
    return {
      accent: "#0d9488",
      dark: "#134e4a",
      soft: "rgba(13,148,136,0.15)",
      border: "rgba(45,212,191,0.38)",
    };
  }

  if (accent === "graphite") {
    return {
      accent: "#64748b",
      dark: "#0f172a",
      soft: "rgba(100,116,139,0.16)",
      border: "rgba(148,163,184,0.34)",
    };
  }

  if (accent === "blue") {
    return {
      accent: "#0284c7",
      dark: "#0c4a6e",
      soft: "rgba(2,132,199,0.15)",
      border: "rgba(56,189,248,0.36)",
    };
  }

  return {
    accent: "#10b981",
    dark: "#022c22",
    soft: "rgba(16,185,129,0.16)",
    border: "rgba(52,211,153,0.40)",
  };
}

function applyAppearance(
  appearance: AppearanceSettings,
) {
  if (
    typeof document === "undefined"
  ) {
    return;
  }

  const root =
    document.documentElement;
  const resolvedTheme =
    appearance.mode === "system"
      ? (
          window.matchMedia(
            "(prefers-color-scheme: dark)",
          ).matches
            ? "dark"
            : "light"
        )
      : appearance.mode;
  const colors =
    accentValues(
      appearance.accent,
    );

  root.dataset.sliceTheme =
    resolvedTheme;
  root.dataset.sliceThemeMode =
    appearance.mode;
  root.dataset.sliceDensity =
    appearance.density;
  root.dataset.sliceAccent =
    appearance.accent;
  root.dataset.sliceCardStyle =
    appearance.cardStyle;
  root.dataset.sliceNavigationStyle =
    appearance.navigationStyle;
  root.dataset.sliceMotion =
    appearance.motion;
  root.dataset.sliceTextScale =
    appearance.textScale;
  root.style.colorScheme =
    resolvedTheme;
  root.style.setProperty(
    "--slice-accent",
    colors.accent,
  );
  root.style.setProperty(
    "--slice-accent-dark",
    colors.dark,
  );
  root.style.setProperty(
    "--slice-accent-soft",
    colors.soft,
  );
  root.style.setProperty(
    "--slice-accent-border",
    colors.border,
  );

  window.dispatchEvent(
    new CustomEvent(
      "slice-workspace-settings-change",
    ),
  );
}

function saveLocalSettings(
  settings: WorkspaceSettings,
) {
  if (
    typeof window === "undefined"
  ) {
    return;
  }

  if (
    !settings.privacy.allowBrowserStorage
  ) {
    window.localStorage.removeItem(
      WORKSPACE_SETTINGS_KEY,
    );
    window.localStorage.removeItem(
      THEME_KEY,
    );
    window.localStorage.removeItem(
      DENSITY_KEY,
    );
    window.localStorage.removeItem(
      ACCENT_KEY,
    );
    return;
  }

  const local: LocalSettings = {
    account: {
      firmName:
        settings.account.firmName,
      title:
        settings.account.title,
      company:
        settings.account.company,
    },
    appearance:
      settings.appearance,
    workspace:
      settings.workspace,
    ai:
      settings.ai,
    privacy:
      settings.privacy,
  };

  window.localStorage.setItem(
    WORKSPACE_SETTINGS_KEY,
    JSON.stringify(local),
  );
  window.localStorage.setItem(
    THEME_KEY,
    settings.appearance.mode,
  );
  window.localStorage.setItem(
    DENSITY_KEY,
    settings.appearance.density,
  );
  window.localStorage.setItem(
    ACCENT_KEY,
    settings.appearance.accent,
  );
}

function readableDate(
  value:
    | string
    | null
    | undefined,
) {
  if (!value) {
    return "Not recorded";
  }

  const date =
    new Date(value);

  return Number.isFinite(
    date.getTime(),
  )
    ? date.toLocaleString(
        "en-US",
        {
          month: "short",
          day: "numeric",
          year: "numeric",
          hour: "numeric",
          minute: "2-digit",
        },
      )
    : "Not recorded";
}

function toneClasses(
  tone: Tone,
) {
  const classes: Record<
    Tone,
    string
  > = {
    emerald:
      "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
    teal:
      "border-teal-400/25 bg-teal-500/10 text-teal-100",
    cyan:
      "border-cyan-400/25 bg-cyan-500/10 text-cyan-100",
    blue:
      "border-sky-400/25 bg-sky-500/10 text-sky-100",
    violet:
      "border-violet-400/25 bg-violet-500/10 text-violet-100",
    amber:
      "border-amber-400/25 bg-amber-500/10 text-amber-100",
    slate:
      "border-white/10 bg-white/[0.045] text-slate-300",
  };

  return classes[tone];
}

function statusTone(
  value: string,
): Tone {
  const normalized =
    value.toLowerCase();

  if (
    normalized.includes("active") ||
    normalized.includes("saved") ||
    normalized.includes("ready") ||
    normalized.includes("enabled")
  ) {
    return "emerald";
  }

  if (
    normalized.includes("pending") ||
    normalized.includes("warning") ||
    normalized.includes("suspend")
  ) {
    return "amber";
  }

  return "slate";
}

function activeCount(
  values: boolean[],
) {
  return values.filter(Boolean).length;
}

function cloneDefaults() {
  return deepMerge(
    DEFAULT_SETTINGS,
    {},
  );
}

async function fetchJson<T>(
  url: string,
  init?: RequestInit,
): Promise<T> {
  const response =
    await fetch(url, {
      cache: "no-store",
      ...init,
    });
  const payload =
    (await response
      .json()
      .catch(() => ({}))) as
      T & ApiSettingsResponse;

  if (!response.ok) {
    throw new Error(
      payload.detail ||
        payload.error ||
        `Request failed with HTTP ${response.status}.`,
    );
  }

  return payload;
}

function normalizeApiResponse(
  api: ApiSettingsResponse,
  local: LocalSettings,
): WorkspaceSettings {
  const merged =
    cloneDefaults();

  merged.account = {
    ...merged.account,
    ...(api.account ?? {}),
    ...(local.account ?? {}),
  };

  merged.appearance = {
    ...merged.appearance,
    mode:
      normalizeTheme(
        local.appearance?.mode ??
          api.appearance?.mode,
      ),
    density:
      normalizeDensity(
        local.appearance?.density ??
          api.appearance?.density,
      ),
    accent:
      normalizeAccent(
        local.appearance?.accent ??
          api.appearance?.accent,
      ),
    cardStyle:
      normalizeCardStyle(
        local.appearance?.cardStyle,
      ),
    navigationStyle:
      normalizeNavigationStyle(
        local.appearance
          ?.navigationStyle,
      ),
    motion:
      normalizeMotion(
        local.appearance?.motion,
      ),
    textScale:
      normalizeTextScale(
        local.appearance
          ?.textScale,
      ),
  };

  merged.workspace = {
    ...merged.workspace,
    ...(local.workspace ?? {}),
  };

  merged.ai = {
    ...merged.ai,
    ...(local.ai ?? {}),
    defaultReportStyle:
      local.ai
        ?.defaultReportStyle ===
        "Boardroom" ||
      local.ai
        ?.defaultReportStyle ===
        "Client Clean" ||
      local.ai
        ?.defaultReportStyle ===
        "Technical"
        ? local.ai
            .defaultReportStyle
        : "Market Green",
  };

  merged.privacy = {
    ...merged.privacy,
    ...(api.privacy ?? {}),
    ...(local.privacy ?? {}),
  };

  merged.security = {
    ...merged.security,
    ...(api.security ?? {}),
  };

  merged.notifications =
    Array.isArray(
      api.notifications,
    ) &&
    api.notifications.length
      ? api.notifications
      : DEFAULT_NOTIFICATIONS.map(
          (item) => ({
            ...item,
          }),
        );

  merged.contact = {
    ...merged.contact,
    ...(api.contact ?? {}),
  };

  return merged;
}

function IconBadge({
  children,
  tone = "emerald",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <div
      className={cx(
        "grid h-11 w-11 shrink-0 place-items-center rounded-2xl border shadow-lg",
        toneClasses(tone),
      )}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em]",
        toneClasses(tone),
      )}
    >
      {children}
    </span>
  );
}

function Surface({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={cx(
        "relative min-w-0 overflow-hidden rounded-[1.7rem] border border-emerald-200/10 bg-black/56 shadow-2xl shadow-black/35 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </section>
  );
}

function FieldLabel({
  children,
}: {
  children: ReactNode;
}) {
  return (
    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
      {children}
    </span>
  );
}

function TextField({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  disabled = false,
}: {
  label: string;
  value: string;
  onChange: (
    value: string,
  ) => void;
  placeholder?: string;
  type?: string;
  disabled?: boolean;
}) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <input
        type={type}
        value={value}
        onChange={(event: ChangeEvent<HTMLInputElement>) =>
          onChange(
            event.target.value,
          )
        }
        placeholder={placeholder}
        disabled={disabled}
        className="mt-1.5 w-full min-w-0 rounded-xl border border-white/10 bg-black/38 px-3 py-3 text-sm font-bold text-white outline-none ring-emerald-500 placeholder:text-slate-700 focus:ring-2 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </label>
  );
}

function SelectField<
  T extends string,
>({
  label,
  value,
  options,
  onChange,
  helper,
}: {
  label: string;
  value: T;
  options:
    readonly SelectOption<T>[];
  onChange: (
    value: T,
  ) => void;
  helper?: string;
}) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(
            event.target.value as T,
          )
        }
        className="mt-1.5 w-full min-w-0 rounded-xl border border-white/10 bg-[#020806] px-3 py-3 text-sm font-bold text-white outline-none ring-emerald-500 focus:ring-2"
      >
        {options.map(
          (option) => (
            <option
              key={option.value}
              value={option.value}
            >
              {option.label}
            </option>
          ),
        )}
      </select>
      {helper ? (
        <p className="mt-1.5 text-[10px] font-semibold leading-4 text-slate-600">
          {helper}
        </p>
      ) : null}
    </label>
  );
}

function NativeSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options:
    readonly string[];
  onChange: (
    value: string,
  ) => void;
}) {
  return (
    <label className="block min-w-0">
      <FieldLabel>{label}</FieldLabel>
      <select
        value={value}
        onChange={(event: ChangeEvent<HTMLSelectElement>) =>
          onChange(
            event.target.value,
          )
        }
        className="mt-1.5 w-full min-w-0 rounded-xl border border-white/10 bg-[#020806] px-3 py-3 text-sm font-bold text-white outline-none ring-emerald-500 focus:ring-2"
      >
        {options.map(
          (option) => (
            <option
              key={option}
              value={option}
            >
              {option}
            </option>
          ),
        )}
      </select>
    </label>
  );
}

function Toggle({
  label,
  helper,
  checked,
  onChange,
  tone = "emerald",
}: {
  label: string;
  helper: string;
  checked: boolean;
  onChange: (
    value: boolean,
  ) => void;
  tone?: Tone;
}) {
  return (
    <button
      type="button"
      onClick={() =>
        onChange(!checked)
      }
      className={cx(
        "flex min-w-0 items-center justify-between gap-4 rounded-2xl border p-4 text-left transition",
        checked
          ? toneClasses(tone)
          : "border-white/8 bg-white/[0.025] text-slate-400 hover:border-emerald-300/16",
      )}
    >
      <span className="min-w-0">
        <span className="block text-sm font-black text-white">
          {label}
        </span>
        <span className="mt-1 block text-xs font-semibold leading-5 text-slate-500">
          {helper}
        </span>
      </span>

      <span
        className={cx(
          "relative h-7 w-12 shrink-0 rounded-full border transition",
          checked
            ? "border-emerald-300/28 bg-emerald-500/25"
            : "border-white/10 bg-white/[0.05]",
        )}
      >
        <span
          className={cx(
            "absolute top-1 h-5 w-5 rounded-full bg-white shadow-lg transition",
            checked
              ? "left-6"
              : "left-1",
          )}
        />
      </span>
    </button>
  );
}

function SectionHeading({
  eyebrow,
  title,
  description,
  icon,
  tone = "emerald",
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  icon: ReactNode;
  tone?: Tone;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div className="flex min-w-0 items-start gap-3">
        <IconBadge tone={tone}>
          {icon}
        </IconBadge>
        <div className="min-w-0">
          <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">
            {eyebrow}
          </p>
          <h2 className="mt-1 text-2xl font-black tracking-[-0.04em] text-white">
            {title}
          </h2>
          <p className="mt-2 max-w-3xl text-xs font-semibold leading-6 text-slate-500">
            {description}
          </p>
        </div>
      </div>

      {action ? (
        <div className="shrink-0">
          {action}
        </div>
      ) : null}
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
  tone = "emerald",
  icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  tone?: Tone;
  icon: ReactNode;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-2xl border border-white/8 bg-white/[0.03] p-4">
      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent",
          tone === "emerald"
            ? "from-emerald-500/18"
            : tone === "teal"
              ? "from-teal-500/16"
              : tone === "cyan"
                ? "from-cyan-500/16"
                : tone === "blue"
                  ? "from-sky-500/16"
                  : tone === "violet"
                    ? "from-violet-500/16"
                    : tone === "amber"
                      ? "from-amber-500/16"
                      : "from-slate-500/10",
        )}
      />

      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[8px] font-black uppercase tracking-[0.14em] text-slate-600">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-black text-white">
            {value}
          </p>
          <p className="mt-1 truncate text-[10px] font-semibold text-slate-600">
            {helper}
          </p>
        </div>
        <IconBadge tone={tone}>
          {icon}
        </IconBadge>
      </div>
    </div>
  );
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: TabDefinition;
  active: boolean;
  onClick: () => void;
}) {
  const Icon =
    tab.icon;

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "group flex min-w-0 items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition",
        active
          ? "border-emerald-300/22 bg-emerald-500/[0.09] shadow-lg shadow-emerald-950/20"
          : "border-transparent hover:border-white/8 hover:bg-white/[0.03]",
      )}
    >
      <span
        className={cx(
          "grid h-9 w-9 shrink-0 place-items-center rounded-xl border",
          active
            ? toneClasses(tab.tone)
            : "border-white/8 bg-white/[0.03] text-slate-600 group-hover:text-emerald-200",
        )}
      >
        <Icon className="h-4 w-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-xs font-black text-white">
          {tab.label}
        </span>
        <span className="mt-0.5 block truncate text-[9px] font-semibold text-slate-600">
          {tab.helper}
        </span>
      </span>
      <ChevronRight
        className={cx(
          "h-3.5 w-3.5 shrink-0 transition",
          active
            ? "text-emerald-300"
            : "text-slate-800 group-hover:text-slate-500",
        )}
      />
    </button>
  );
}

function AccentCard({
  option,
  active,
  onClick,
}: {
  option: SelectOption<Accent>;
  active: boolean;
  onClick: () => void;
}) {
  const colors =
    accentValues(
      option.value,
    );
  const style = {
    "--preview-accent":
      colors.accent,
    "--preview-dark":
      colors.dark,
  } as CSSProperties;

  return (
    <button
      type="button"
      onClick={onClick}
      style={style}
      className={cx(
        "relative min-w-0 overflow-hidden rounded-2xl border p-3 text-left transition",
        active
          ? "border-emerald-300/28 bg-emerald-500/[0.07]"
          : "border-white/8 bg-white/[0.025] hover:border-white/16",
      )}
    >
      <div
        className="h-20 rounded-xl border border-white/10"
        style={{
          background:
            "radial-gradient(circle at 25% 20%, color-mix(in srgb, var(--preview-accent) 48%, transparent), transparent 36%), linear-gradient(135deg, var(--preview-dark), #020806 62%, var(--preview-accent))",
        }}
      >
        <div className="flex h-full items-center justify-center">
          <div
            className="grid h-10 w-10 place-items-center rounded-xl border border-white/20 text-sm font-black text-white shadow-xl"
            style={{
              background:
                "linear-gradient(145deg, var(--preview-accent), var(--preview-dark))",
            }}
          >
            S
          </div>
        </div>
      </div>

      <div className="mt-3 flex items-center justify-between gap-2">
        <div className="min-w-0">
          <p className="truncate text-xs font-black text-white">
            {option.label}
          </p>
          <p className="mt-0.5 truncate text-[9px] font-semibold text-slate-600">
            {option.helper}
          </p>
        </div>
        {active ? (
          <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-300" />
        ) : null}
      </div>
    </button>
  );
}

function NotificationCard({
  channel,
  onChange,
}: {
  channel: AlertChannel;
  onChange: (
    patch: Partial<AlertChannel>,
  ) => void;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-sm font-black text-white">
            {channel.channel}
          </p>
          <p className="mt-1 text-[10px] font-semibold leading-4 text-slate-600">
            Minimum {channel.minUrgency} urgency at score {channel.minScore}.
          </p>
        </div>
        <button
          type="button"
          onClick={() =>
            onChange({
              enabled:
                !channel.enabled,
            })
          }
          className={cx(
            "rounded-full border px-3 py-1 text-[9px] font-black uppercase tracking-[0.1em]",
            channel.enabled
              ? toneClasses("emerald")
              : toneClasses("slate"),
          )}
        >
          {channel.enabled
            ? "Enabled"
            : "Paused"}
        </button>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <NativeSelect
          label="Minimum urgency"
          value={channel.minUrgency}
          options={[
            "Low",
            "Medium",
            "High",
            "Critical",
          ]}
          onChange={(value) =>
            onChange({
              minUrgency: value,
            })
          }
        />

        <label>
          <span className="flex items-center justify-between gap-2">
            <FieldLabel>
              Minimum score
            </FieldLabel>
            <span className="text-[9px] font-black text-emerald-300">
              {channel.minScore}/100
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={100}
            step={1}
            value={channel.minScore}
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange({
                minScore:
                  Number(
                    event.target.value,
                  ),
              })
            }
            className="mt-3 w-full accent-emerald-500"
          />
        </label>

        <TextField
          label="Quiet hours start"
          type="time"
          value={
            channel.quietHoursStart ??
            ""
          }
          onChange={(value) =>
            onChange({
              quietHoursStart:
                value || null,
            })
          }
        />

        <TextField
          label="Quiet hours end"
          type="time"
          value={
            channel.quietHoursEnd ??
            ""
          }
          onChange={(value) =>
            onChange({
              quietHoursEnd:
                value || null,
            })
          }
        />

        <label>
          <FieldLabel>
            Cooldown minutes
          </FieldLabel>
          <input
            type="number"
            min={0}
            max={1440}
            value={
              channel.cooldownMinutes
            }
            onChange={(event: ChangeEvent<HTMLInputElement>) =>
              onChange({
                cooldownMinutes:
                  Math.max(
                    0,
                    Math.min(
                      1440,
                      Number(
                        event.target.value,
                      ) || 0,
                    ),
                  ),
              })
            }
            className="mt-1.5 w-full rounded-xl border border-white/10 bg-black/38 px-3 py-3 text-sm font-bold text-white outline-none ring-emerald-500 focus:ring-2"
          />
        </label>

        <Toggle
          label="Digest only"
          helper="Collect events into a scheduled digest instead of immediate alerts."
          checked={
            channel.digestOnly
          }
          onChange={(value) =>
            onChange({
              digestOnly: value,
            })
          }
          tone="teal"
        />
      </div>
    </div>
  );
}

export default function WorkspaceSettingsPage() {
  const [
    settings,
    setSettings,
  ] =
    useState<WorkspaceSettings>(
      cloneDefaults,
    );
  const [
    activeTab,
    setActiveTab,
  ] =
    useState<SettingsTab>(
      "overview",
    );
  const [
    loading,
    setLoading,
  ] =
    useState(true);
  const [
    saving,
    setSaving,
  ] =
    useState(false);
  const [
    dirty,
    setDirty,
  ] =
    useState(false);
  const [
    message,
    setMessage,
  ] =
    useState(
      "Loading workspace settings.",
    );
  const [
    messageTone,
    setMessageTone,
  ] =
    useState<Tone>(
      "slate",
    );
  const [
    passwordResetting,
    setPasswordResetting,
  ] =
    useState(false);
  const [
    dangerConfirmation,
    setDangerConfirmation,
  ] =
    useState("");
  const [
    dangerAction,
    setDangerAction,
  ] =
    useState<
      "deactivate" | "delete" | null
    >(null);

  const loadSettings =
    useCallback(async () => {
      setLoading(true);
      setMessage(
        "Loading server and workspace preferences.",
      );
      setMessageTone(
        "slate",
      );

      try {
        const api =
          await fetchJson<ApiSettingsResponse>(
            "/api/account-settings",
          );
        const next =
          normalizeApiResponse(
            api,
            readLocalSettings(),
          );

        setSettings(next);
        applyAppearance(
          next.appearance,
        );
        setDirty(false);
        setMessage(
          "Settings synchronized.",
        );
        setMessageTone(
          "emerald",
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Settings could not be loaded.",
        );
        setMessageTone(
          "amber",
        );
      } finally {
        setLoading(false);
      }
    }, []);

  useEffect(() => {
    void loadSettings();
  }, [loadSettings]);

  useEffect(() => {
    if (loading) {
      return;
    }

    applyAppearance(
      settings.appearance,
    );
  }, [
    loading,
    settings.appearance,
  ]);

  function mutate(
    producer: (
      current: WorkspaceSettings,
    ) => WorkspaceSettings,
  ) {
    setSettings(
      (current) =>
        producer(current),
    );
    setDirty(true);
    setMessage(
      "Unsaved changes.",
    );
    setMessageTone(
      "amber",
    );
  }

  function updateAccount<
    K extends keyof AccountSettings,
  >(
    key: K,
    value: AccountSettings[K],
  ) {
    mutate(
      (current) => ({
        ...current,
        account: {
          ...current.account,
          [key]: value,
        },
      }),
    );
  }

  function updateAppearance<
    K extends keyof AppearanceSettings,
  >(
    key: K,
    value: AppearanceSettings[K],
  ) {
    mutate(
      (current) => ({
        ...current,
        appearance: {
          ...current.appearance,
          [key]: value,
        },
      }),
    );
  }

  function updateWorkspace<
    K extends keyof WorkspacePreferences,
  >(
    key: K,
    value: WorkspacePreferences[K],
  ) {
    mutate(
      (current) => ({
        ...current,
        workspace: {
          ...current.workspace,
          [key]: value,
        },
      }),
    );
  }

  function updateAi<
    K extends keyof AiPreferences,
  >(
    key: K,
    value: AiPreferences[K],
  ) {
    mutate(
      (current) => ({
        ...current,
        ai: {
          ...current.ai,
          [key]: value,
        },
      }),
    );
  }

  function updatePrivacy<
    K extends keyof PrivacySettings,
  >(
    key: K,
    value: PrivacySettings[K],
  ) {
    mutate(
      (current) => ({
        ...current,
        privacy: {
          ...current.privacy,
          [key]: value,
        },
      }),
    );
  }

  function updateSecurity<
    K extends keyof SecuritySettings,
  >(
    key: K,
    value: SecuritySettings[K],
  ) {
    mutate(
      (current) => ({
        ...current,
        security: {
          ...current.security,
          [key]: value,
        },
      }),
    );
  }

  function updateNotification(
    index: number,
    patch: Partial<AlertChannel>,
  ) {
    mutate(
      (current) => ({
        ...current,
        notifications:
          current.notifications.map(
            (
              item,
              itemIndex,
            ) =>
              itemIndex === index
                ? {
                    ...item,
                    ...patch,
                  }
                : item,
          ),
      }),
    );
  }

  async function saveSettings() {
    setSaving(true);
    setMessage(
      "Saving account and workspace settings.",
    );
    setMessageTone(
      "slate",
    );

    try {
      const response =
        await fetchJson<ApiSettingsResponse>(
          "/api/account-settings",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action:
                "saveAccountSettings",
              account: {
                name:
                  settings.account.name,
                email:
                  settings.account.email,
                phone:
                  settings.account.phone,
                timezone:
                  settings.account
                    .timezone,
              },
              appearance: {
                mode:
                  settings.appearance.mode,
                density:
                  legacyApiDensity(
                    settings.appearance
                      .density,
                  ),
                accent:
                  legacyApiAccent(
                    settings.appearance
                      .accent,
                  ),
              },
              privacy:
                settings.privacy,
              security:
                settings.security,
              notifications:
                settings.notifications,
            }),
          },
        );

      const serverMerged =
        normalizeApiResponse(
          response,
          {
            account: {
              firmName:
                settings.account
                  .firmName,
              title:
                settings.account.title,
              company:
                settings.account
                  .company,
            },
            appearance:
              settings.appearance,
            workspace:
              settings.workspace,
            ai:
              settings.ai,
            privacy:
              settings.privacy,
          },
        );

      saveLocalSettings(
        serverMerged,
      );
      applyAppearance(
        serverMerged.appearance,
      );
      setSettings(
        serverMerged,
      );
      setDirty(false);
      setMessage(
        "All settings saved.",
      );
      setMessageTone(
        "emerald",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Settings could not be saved.",
      );
      setMessageTone(
        "amber",
      );
    } finally {
      setSaving(false);
    }
  }

  async function requestPasswordReset() {
    setPasswordResetting(true);
    setMessage(
      "Queueing password reset request.",
    );
    setMessageTone(
      "slate",
    );

    try {
      const response =
        await fetchJson<ApiSettingsResponse>(
          "/api/account-settings",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action:
                "requestPasswordReset",
            }),
          },
        );

      setMessage(
        response.message ||
          "Password reset request queued.",
      );
      setMessageTone(
        "emerald",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Password reset could not be requested.",
      );
      setMessageTone(
        "amber",
      );
    } finally {
      setPasswordResetting(
        false,
      );
    }
  }

  async function performDangerAction(
    action:
      | "deactivate"
      | "delete",
  ) {
    const required =
      action === "deactivate"
        ? "DEACTIVATE"
        : "DELETE MY ACCOUNT";

    if (
      dangerConfirmation !== required
    ) {
      setMessage(
        `Type "${required}" exactly to continue.`,
      );
      setMessageTone(
        "amber",
      );
      return;
    }

    setDangerAction(action);
    setMessage(
      action === "deactivate"
        ? "Deactivating account."
        : "Deleting account.",
    );
    setMessageTone(
      "amber",
    );

    try {
      const response =
        await fetchJson<ApiSettingsResponse>(
          "/api/account-settings",
          {
            method: "POST",
            headers: {
              "Content-Type":
                "application/json",
            },
            body: JSON.stringify({
              action:
                action === "deactivate"
                  ? "deactivateAccount"
                  : "deleteAccount",
              confirmation:
                dangerConfirmation,
            }),
          },
        );

      window.location.href =
        response.redirectTo ||
        "/founder-login";
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Account action failed.",
      );
      setMessageTone(
        "amber",
      );
      setDangerAction(null);
    }
  }

  function resetUnsavedChanges() {
    void loadSettings();
  }

  const enabledNotifications =
    useMemo(
      () =>
        settings.notifications.filter(
          (item) =>
            item.enabled,
        ).length,
      [
        settings.notifications,
      ],
    );

  const privacyScore =
    useMemo(
      () =>
        activeCount([
          settings.privacy.hideSensitiveValues,
          settings.privacy.maskClientNames,
        ]),
      [
        settings.privacy.hideSensitiveValues,
        settings.privacy.maskClientNames,
      ],
    );

  const workspaceModules =
    activeCount([
      settings.workspace
        .showMarketPulse,
      settings.workspace
        .showTeamSnapshot,
      settings.workspace
        .showClientInbox,
      settings.workspace
        .showWatchlistPreview,
      settings.workspace
        .showComplianceBanner,
    ]);

  const securityControls =
    activeCount([
      settings.security
        .mfaEnabled,
      settings.security
        .requireReauthForSensitiveActions,
      settings.security
        .alertOnNewLogin,
      settings.security
        .advisorModeEnabled,
    ]);

  const activeAccent =
    ACCENT_OPTIONS.find(
      (option) =>
        option.value ===
        settings.appearance.accent,
    )?.label ??
    "Market Green";

  const themeIcon =
    settings.appearance.mode ===
    "dark"
      ? Moon
      : settings.appearance.mode ===
          "light"
        ? Sun
        : Monitor;
  const ThemeIcon =
    themeIcon;

  if (loading) {
    return (
      <main className="grid min-h-[100dvh] place-items-center overflow-hidden bg-[#010604] p-6 text-white">
        <div className="text-center">
          <RefreshCw className="mx-auto h-9 w-9 animate-spin text-emerald-300" />
          <h1 className="mt-5 text-2xl font-black">
            Loading settings
          </h1>
          <p className="mt-2 text-sm font-semibold text-slate-600">
            Synchronizing account, security, and workspace preferences.
          </p>
        </div>
      </main>
    );
  }

  return (
    <main className="relative min-h-[100dvh] overflow-hidden bg-[#010604] p-2 text-white sm:p-3">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-16%] top-[-18%] h-[42rem] w-[42rem] rounded-full bg-emerald-600/22 blur-3xl" />
        <div className="absolute right-[-16%] top-[5%] h-[38rem] w-[38rem] rounded-full bg-cyan-600/8 blur-3xl" />
        <div className="absolute bottom-[-24%] left-[32%] h-[38rem] w-[38rem] rounded-full bg-lime-500/7 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(52,211,153,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.025)_1px,transparent_1px)] bg-[size:42px_42px]" />
      </div>

      <div className="relative mx-auto grid min-h-[calc(100dvh-1rem)] max-w-[1900px] grid-rows-[auto_minmax(0,1fr)] gap-2 sm:min-h-[calc(100dvh-1.5rem)] sm:gap-3">
        <header className="rounded-[1.6rem] border border-emerald-200/10 bg-black/58 p-3 shadow-2xl shadow-black/35 backdrop-blur-xl sm:p-4">
          <div className="flex min-w-0 flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <BrandMark subtitle="Workspace Settings" />
              <div className="hidden h-11 w-px bg-white/10 sm:block" />
              <div className="hidden min-w-0 sm:block">
                <p className="truncate text-[9px] font-black uppercase tracking-[0.15em] text-emerald-300">
                  Market-green control plane
                </p>
                <p className="mt-1 truncate text-xs font-semibold text-slate-600">
                  Account, security, notifications, workspace, and AI defaults.
                </p>
              </div>
            </div>

            <div className="flex min-w-0 flex-wrap items-center justify-end gap-2">
              <Pill
                tone={
                  statusTone(
                    settings.account
                      .platformStatus,
                  )
                }
              >
                {settings.account.platformStatus}
              </Pill>

              <Pill
                tone={
                  dirty
                    ? "amber"
                    : "emerald"
                }
              >
                {dirty
                  ? "Unsaved changes"
                  : "Synchronized"}
              </Pill>

              <button
                type="button"
                onClick={resetUnsavedChanges}
                disabled={
                  saving ||
                  !dirty
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-400 transition hover:border-emerald-300/18 hover:text-white disabled:opacity-35"
              >
                <RotateCcw className="h-3.5 w-3.5" />
                Reset
              </button>

              <button
                type="button"
                onClick={() =>
                  void saveSettings()
                }
                disabled={
                  saving ||
                  !dirty
                }
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-emerald-400/25 bg-gradient-to-r from-emerald-500 via-emerald-700 to-emerald-950 px-4 text-[10px] font-black uppercase tracking-[0.1em] text-white shadow-lg shadow-emerald-950/35 transition hover:brightness-110 disabled:opacity-40"
              >
                {saving ? (
                  <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                {saving
                  ? "Saving"
                  : "Save settings"}
              </button>

              <Link
                href="/workspace"
                className="inline-flex h-10 items-center justify-center rounded-xl border border-white/10 bg-white/[0.035] px-3 text-[10px] font-black uppercase tracking-[0.1em] text-slate-300 transition hover:border-emerald-300/18 hover:text-white"
              >
                Workspace
              </Link>
            </div>
          </div>

          <div
            className={cx(
              "mt-3 flex items-start gap-2 rounded-xl border px-3 py-2.5 text-xs font-bold leading-5",
              toneClasses(
                messageTone,
              ),
            )}
          >
            {messageTone ===
            "emerald" ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" />
            ) : messageTone ===
              "amber" ? (
              <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Activity className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <span className="min-w-0 flex-1">
              {message}
            </span>
          </div>
        </header>

        <div className="grid min-h-0 min-w-0 gap-2 lg:grid-cols-[250px_minmax(0,1fr)] sm:gap-3">
          <Surface className="hidden min-h-0 flex-col lg:flex">
            <div className="border-b border-white/8 p-3">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">
                Settings navigation
              </p>
              <p className="mt-1 truncate text-sm font-black text-white">
                {settings.account.name ||
                  "Advisor account"}
              </p>
              <p className="mt-1 truncate text-[10px] font-semibold text-slate-600">
                {settings.account.email}
              </p>
            </div>

            <nav className="min-h-0 flex-1 space-y-1 overflow-y-auto p-2">
              {TABS.map(
                (tab) => (
                  <TabButton
                    key={tab.id}
                    tab={tab}
                    active={
                      activeTab ===
                      tab.id
                    }
                    onClick={() =>
                      setActiveTab(
                        tab.id,
                      )
                    }
                  />
                ),
              )}
            </nav>

            <div className="border-t border-white/8 p-3">
              <div className="rounded-xl border border-emerald-300/12 bg-emerald-500/[0.05] p-3">
                <p className="text-[8px] font-black uppercase tracking-[0.13em] text-emerald-300">
                  Current appearance
                </p>
                <p className="mt-1 truncate text-xs font-black text-white">
                  {activeAccent}
                </p>
                <p className="mt-1 truncate text-[9px] font-semibold text-slate-600">
                  {settings.appearance.mode} · {settings.appearance.density}
                </p>
              </div>
            </div>
          </Surface>

          <div className="grid min-h-0 min-w-0 grid-rows-[auto_minmax(0,1fr)] gap-2 lg:grid-rows-[minmax(0,1fr)]">
            <div className="flex min-w-0 gap-1.5 overflow-x-auto rounded-xl border border-white/8 bg-black/40 p-1.5 lg:hidden">
              {TABS.map(
                (tab) => {
                  const Icon =
                    tab.icon;

                  return (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() =>
                        setActiveTab(
                          tab.id,
                        )
                      }
                      className={cx(
                        "inline-flex shrink-0 items-center gap-2 rounded-lg border px-3 py-2 text-[9px] font-black uppercase tracking-[0.1em]",
                        activeTab ===
                          tab.id
                          ? toneClasses(
                              tab.tone,
                            )
                          : "border-transparent text-slate-600",
                      )}
                    >
                      <Icon className="h-3.5 w-3.5" />
                      {tab.label}
                    </button>
                  );
                },
              )}
            </div>

            <div className="min-h-0 overflow-y-auto">
              {activeTab ===
              "overview" ? (
                <div className="grid gap-3">
                  <Surface className="p-4 sm:p-5">
                    <SectionHeading
                      eyebrow="Settings overview"
                      title="Your advisor operating preferences"
                      description="Review the account, security, appearance, notification, privacy, workspace, and AI configuration currently applied to Slice."
                      icon={<Gauge className="h-5 w-5" />}
                      action={
                        <Pill tone="emerald">
                          <Check className="h-3 w-3" />
                          Beta ready
                        </Pill>
                      }
                    />

                    <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                      <Metric
                        label="Security controls"
                        value={`${securityControls}/4`}
                        helper="active protections"
                        tone="emerald"
                        icon={<ShieldCheck className="h-4 w-4" />}
                      />
                      <Metric
                        label="Alert channels"
                        value={`${enabledNotifications}/${settings.notifications.length}`}
                        helper="enabled channels"
                        tone="amber"
                        icon={<BellRing className="h-4 w-4" />}
                      />
                      <Metric
                        label="Workspace modules"
                        value={`${workspaceModules}/5`}
                        helper="visible modules"
                        tone="teal"
                        icon={<Workflow className="h-4 w-4" />}
                      />
                      <Metric
                        label="Accent"
                        value={activeAccent}
                        helper="active identity"
                        tone="cyan"
                        icon={<Palette className="h-4 w-4" />}
                      />
                    </div>
                  </Surface>

                  <div className="grid gap-3 xl:grid-cols-[1.1fr_0.9fr]">
                    <Surface className="p-4 sm:p-5">
                      <SectionHeading
                        eyebrow="Account identity"
                        title={settings.account.name || "Advisor profile"}
                        description={`${settings.account.title} · ${
                          settings.account.company ||
                          settings.account.firmName
                        }`}
                        icon={<CircleUserRound className="h-5 w-5" />}
                        tone="cyan"
                      />

                      <div className="mt-5 grid gap-3 sm:grid-cols-2">
                        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                          <FieldLabel>Email</FieldLabel>
                          <p className="mt-2 truncate text-sm font-black text-white">
                            {settings.account.email || "Not set"}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                          <FieldLabel>Timezone</FieldLabel>
                          <p className="mt-2 truncate text-sm font-black text-white">
                            {settings.account.timezone}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                          <FieldLabel>Member since</FieldLabel>
                          <p className="mt-2 truncate text-sm font-black text-white">
                            {readableDate(settings.account.createdAt)}
                          </p>
                        </div>
                        <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                          <FieldLabel>Default landing</FieldLabel>
                          <p className="mt-2 truncate text-sm font-black text-white">
                            {settings.workspace.defaultLanding}
                          </p>
                        </div>
                      </div>
                    </Surface>

                    <Surface className="p-4 sm:p-5">
                      <SectionHeading
                        eyebrow="Approval posture"
                        title="Human review remains central"
                        description="Advisor approval defaults protect reports, email, and external actions."
                        icon={<LockKeyhole className="h-5 w-5" />}
                        tone="emerald"
                      />

                      <div className="mt-5 space-y-2">
                        {[
                          {
                            label: "Email approval",
                            enabled:
                              settings.ai.requireApprovalForEmails,
                          },
                          {
                            label: "Report approval",
                            enabled:
                              settings.ai.requireApprovalForReports,
                          },
                          {
                            label: "External-action confirmation",
                            enabled:
                              settings.workspace.confirmBeforeExternalActions,
                          },
                          {
                            label: "Sensitive-action reauthentication",
                            enabled:
                              settings.security.requireReauthForSensitiveActions,
                          },
                        ].map(
                          (item) => (
                            <div
                              key={item.label}
                              className="flex items-center justify-between gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-3"
                            >
                              <span className="text-xs font-black text-white">
                                {item.label}
                              </span>
                              <Pill
                                tone={
                                  item.enabled
                                    ? "emerald"
                                    : "amber"
                                }
                              >
                                {item.enabled
                                  ? "Required"
                                  : "Optional"}
                              </Pill>
                            </div>
                          ),
                        )}
                      </div>
                    </Surface>
                  </div>
                </div>
              ) : null}

              {activeTab ===
              "profile" ? (
                <Surface className="p-4 sm:p-5">
                  <SectionHeading
                    eyebrow="Account profile"
                    title="Advisor and firm identity"
                    description="Update the account identity used by Slice. Name and email are saved to the account database; firm presentation fields are retained in workspace preferences."
                    icon={<UserRoundCog className="h-5 w-5" />}
                    tone="cyan"
                  />

                  <div className="mt-5 grid gap-4 sm:grid-cols-2">
                    <TextField
                      label="Full name"
                      value={settings.account.name}
                      onChange={(value) =>
                        updateAccount("name", value)
                      }
                      placeholder="Advisor name"
                    />
                    <TextField
                      label="Account email"
                      type="email"
                      value={settings.account.email}
                      onChange={(value) =>
                        updateAccount("email", value)
                      }
                      placeholder="advisor@firm.com"
                    />
                    <TextField
                      label="Phone"
                      type="tel"
                      value={settings.account.phone}
                      onChange={(value) =>
                        updateAccount("phone", value)
                      }
                      placeholder="Phone number"
                    />
                    <NativeSelect
                      label="Timezone"
                      value={settings.account.timezone}
                      options={TIMEZONE_OPTIONS}
                      onChange={(value) =>
                        updateAccount("timezone", value)
                      }
                    />
                    <TextField
                      label="Firm display name"
                      value={settings.account.firmName}
                      onChange={(value) =>
                        updateAccount("firmName", value)
                      }
                      placeholder="Firm name"
                    />
                    <TextField
                      label="Advisor title"
                      value={settings.account.title}
                      onChange={(value) =>
                        updateAccount("title", value)
                      }
                      placeholder="Lead Advisor"
                    />
                    <TextField
                      label="Company"
                      value={settings.account.company}
                      onChange={(value) =>
                        updateAccount("company", value)
                      }
                      placeholder="Company"
                    />
                    <TextField
                      label="Account status"
                      value={settings.account.platformStatus}
                      onChange={() => undefined}
                      disabled
                    />
                  </div>
                </Surface>
              ) : null}

              {activeTab ===
              "appearance" ? (
                <div className="grid gap-3">
                  <Surface className="p-4 sm:p-5">
                    <SectionHeading
                      eyebrow="Appearance"
                      title="Market-green visual system"
                      description="Every accent option is type-safe. Legacy slice-red, crimson, and ruby values are migrated automatically into the new palette."
                      icon={<Palette className="h-5 w-5" />}
                      tone="violet"
                      action={
                        <div className="flex items-center gap-2">
                          <ThemeIcon className="h-4 w-4 text-emerald-300" />
                          <Pill tone="emerald">
                            Live preview
                          </Pill>
                        </div>
                      }
                    />

                    <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                      {ACCENT_OPTIONS.map(
                        (option) => (
                          <AccentCard
                            key={option.value}
                            option={option}
                            active={
                              settings.appearance.accent ===
                              option.value
                            }
                            onClick={() =>
                              updateAppearance(
                                "accent",
                                option.value,
                              )
                            }
                          />
                        ),
                      )}
                    </div>
                  </Surface>

                  <Surface className="p-4 sm:p-5">
                    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                      <SelectField
                        label="Theme"
                        value={settings.appearance.mode}
                        options={THEME_OPTIONS}
                        onChange={(value) =>
                          updateAppearance("mode", value)
                        }
                      />

                      <SelectField
                        label="Density"
                        value={settings.appearance.density}
                        options={DENSITY_OPTIONS}
                        onChange={(value) =>
                          updateAppearance("density", value)
                        }
                      />

                      <SelectField
                        label="Accent"
                        value={settings.appearance.accent}
                        options={ACCENT_OPTIONS}
                        onChange={(value) =>
                          updateAppearance("accent", value)
                        }
                      />

                      <SelectField
                        label="Card style"
                        value={settings.appearance.cardStyle}
                        options={[
                          {
                            value: "glass",
                            label: "Glass",
                          },
                          {
                            value: "solid",
                            label: "Solid",
                          },
                          {
                            value: "minimal",
                            label: "Minimal",
                          },
                        ] as const}
                        onChange={(value) =>
                          updateAppearance("cardStyle", value)
                        }
                      />

                      <SelectField
                        label="Navigation"
                        value={settings.appearance.navigationStyle}
                        options={[
                          {
                            value: "executive",
                            label: "Executive",
                          },
                          {
                            value: "compact",
                            label: "Compact",
                          },
                          {
                            value: "command",
                            label: "Command-first",
                          },
                        ] as const}
                        onChange={(value) =>
                          updateAppearance("navigationStyle", value)
                        }
                      />

                      <SelectField
                        label="Text scale"
                        value={settings.appearance.textScale}
                        options={[
                          {
                            value: "standard",
                            label: "Standard",
                          },
                          {
                            value: "large",
                            label: "Large",
                          },
                          {
                            value: "extra-large",
                            label: "Extra large",
                          },
                        ] as const}
                        onChange={(value) =>
                          updateAppearance("textScale", value)
                        }
                      />
                    </div>

                    <div className="mt-4">
                      <Toggle
                        label="Full motion"
                        helper="Enable animated operating-core, transition, and orbit effects."
                        checked={settings.appearance.motion === "full"}
                        onChange={(value) =>
                          updateAppearance(
                            "motion",
                            value ? "full" : "reduced",
                          )
                        }
                        tone="violet"
                      />
                    </div>
                  </Surface>
                </div>
              ) : null}

              {activeTab ===
              "notifications" ? (
                <Surface className="p-4 sm:p-5">
                  <SectionHeading
                    eyebrow="Notifications"
                    title="Alert channels and thresholds"
                    description="Control channel availability, urgency, scoring thresholds, quiet hours, cooldowns, and digest behavior."
                    icon={<BellRing className="h-5 w-5" />}
                    tone="amber"
                    action={
                      <Pill tone="amber">
                        {enabledNotifications} enabled
                      </Pill>
                    }
                  />

                  <div className="mt-5 grid gap-3 xl:grid-cols-2">
                    {settings.notifications.map(
                      (channel, index) => (
                        <NotificationCard
                          key={`${channel.channel}-${channel.id ?? index}`}
                          channel={channel}
                          onChange={(patch) =>
                            updateNotification(index, patch)
                          }
                        />
                      ),
                    )}
                  </div>
                </Surface>
              ) : null}

              {activeTab ===
              "security" ? (
                <div className="grid gap-3">
                  <Surface className="p-4 sm:p-5">
                    <SectionHeading
                      eyebrow="Security"
                      title="Authentication and sensitive-action controls"
                      description="Apply reauthentication, login alerts, advisor mode, session timing, and password-reset workflows."
                      icon={<ShieldCheck className="h-5 w-5" />}
                      tone="emerald"
                      action={
                        <Pill tone="emerald">
                          {securityControls}/4 active
                        </Pill>
                      }
                    />

                    <div className="mt-5 grid gap-3 sm:grid-cols-2">
                      <Toggle
                        label="Multi-factor authentication"
                        helper="Record MFA as required for the advisor account."
                        checked={settings.security.mfaEnabled}
                        onChange={(value) =>
                          updateSecurity("mfaEnabled", value)
                        }
                      />
                      <Toggle
                        label="Reauthenticate sensitive actions"
                        helper="Require a fresh credential check before high-risk actions."
                        checked={
                          settings.security
                            .requireReauthForSensitiveActions
                        }
                        onChange={(value) =>
                          updateSecurity(
                            "requireReauthForSensitiveActions",
                            value,
                          )
                        }
                      />
                      <Toggle
                        label="Alert on new login"
                        helper="Create security alerts when a new session is detected."
                        checked={settings.security.alertOnNewLogin}
                        onChange={(value) =>
                          updateSecurity("alertOnNewLogin", value)
                        }
                      />
                      <Toggle
                        label="Advisor mode"
                        helper="Apply advisor-oriented safeguards and review defaults."
                        checked={settings.security.advisorModeEnabled}
                        onChange={(value) =>
                          updateSecurity("advisorModeEnabled", value)
                        }
                      />
                    </div>

                    <div className="mt-4 grid gap-4 sm:grid-cols-[1fr_auto] sm:items-end">
                      <label>
                        <span className="flex items-center justify-between gap-2">
                          <FieldLabel>
                            Session timeout
                          </FieldLabel>
                          <span className="text-[9px] font-black text-emerald-300">
                            {settings.security.sessionTimeoutMinutes} minutes
                          </span>
                        </span>
                        <input
                          type="range"
                          min={15}
                          max={43200}
                          step={15}
                          value={settings.security.sessionTimeoutMinutes}
                          onChange={(event: ChangeEvent<HTMLInputElement>) =>
                            updateSecurity(
                              "sessionTimeoutMinutes",
                              Number(event.target.value),
                            )
                          }
                          className="mt-3 w-full accent-emerald-500"
                        />
                      </label>

                      <button
                        type="button"
                        onClick={() =>
                          void requestPasswordReset()
                        }
                        disabled={passwordResetting}
                        className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl border border-emerald-300/18 bg-emerald-500/[0.06] px-4 text-xs font-black text-emerald-100 disabled:opacity-50"
                      >
                        {passwordResetting ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <KeyRound className="h-4 w-4" />
                        )}
                        Request password reset
                      </button>
                    </div>

                    <div className="mt-4 rounded-xl border border-white/8 bg-white/[0.025] p-3">
                      <FieldLabel>
                        Last security review
                      </FieldLabel>
                      <p className="mt-1 text-xs font-black text-white">
                        {readableDate(
                          settings.security.lastSecurityReviewAt,
                        )}
                      </p>
                    </div>
                  </Surface>
                </div>
              ) : null}

              {activeTab ===
              "privacy" ? (
                <Surface className="p-4 sm:p-5">
                  <SectionHeading
                    eyebrow="Privacy"
                    title="Data retention and personalization"
                    description="Control memory, analytics, profile visibility, exports, sensitive-value masking, and browser persistence."
                    icon={<Eye className="h-5 w-5" />}
                    tone="blue"
                    action={
                      <Pill tone="blue">
                        {privacyScore}/2 core protections
                      </Pill>
                    }
                  />

                  <div className="mt-5 grid gap-3 sm:grid-cols-2">
                    <Toggle
                      label="AI memory"
                      helper="Allow assistant memory to improve continuity."
                      checked={settings.privacy.aiMemoryEnabled}
                      onChange={(value) =>
                        updatePrivacy("aiMemoryEnabled", value)
                      }
                      tone="violet"
                    />
                    <Toggle
                      label="Personalization"
                      helper="Personalize the workspace for the current advisor."
                      checked={settings.privacy.personalizationEnabled}
                      onChange={(value) =>
                        updatePrivacy("personalizationEnabled", value)
                      }
                      tone="teal"
                    />
                    <Toggle
                      label="Product analytics"
                      helper="Allow operational analytics for platform health."
                      checked={settings.privacy.analyticsEnabled}
                      onChange={(value) =>
                        updatePrivacy("analyticsEnabled", value)
                      }
                      tone="cyan"
                    />
                    <Toggle
                      label="Marketing email"
                      helper="Receive product and market-green platform updates."
                      checked={settings.privacy.marketingEmailsEnabled}
                      onChange={(value) =>
                        updatePrivacy("marketingEmailsEnabled", value)
                      }
                      tone="amber"
                    />
                    <Toggle
                      label="Share usage for improvement"
                      helper="Allow anonymized product-improvement signals."
                      checked={settings.privacy.shareUsageForImprovement}
                      onChange={(value) =>
                        updatePrivacy("shareUsageForImprovement", value)
                      }
                      tone="blue"
                    />
                    <Toggle
                      label="Show profile to team"
                      helper="Make advisor identity visible to active firm members."
                      checked={settings.privacy.showProfileToTeam}
                      onChange={(value) =>
                        updatePrivacy("showProfileToTeam", value)
                      }
                    />
                    <Toggle
                      label="Hide sensitive values"
                      helper="Mask high-risk values in shared displays and exports."
                      checked={settings.privacy.hideSensitiveValues}
                      onChange={(value) =>
                        updatePrivacy("hideSensitiveValues", value)
                      }
                    />
                    <Toggle
                      label="Mask client names"
                      helper="Use reduced client identity in presentation surfaces."
                      checked={settings.privacy.maskClientNames}
                      onChange={(value) =>
                        updatePrivacy("maskClientNames", value)
                      }
                    />
                    <Toggle
                      label="Browser preference storage"
                      helper="Persist local workspace and AI preferences in this browser."
                      checked={settings.privacy.allowBrowserStorage}
                      onChange={(value) =>
                        updatePrivacy("allowBrowserStorage", value)
                      }
                      tone="teal"
                    />
                  </div>

                  <div className="mt-4 grid gap-4 sm:grid-cols-2">
                    <SelectField
                      label="Report retention"
                      value={settings.privacy.retainReports}
                      options={[
                        {
                          value: "30 days",
                          label: "30 days",
                        },
                        {
                          value: "90 days",
                          label: "90 days",
                        },
                        {
                          value: "1 year",
                          label: "1 year",
                        },
                        {
                          value: "Forever",
                          label: "Forever",
                        },
                      ] as const}
                      onChange={(value) =>
                        updatePrivacy("retainReports", value)
                      }
                    />

                    <SelectField
                      label="Default export"
                      value={settings.privacy.exportFormat}
                      options={[
                        {
                          value: "PDF",
                          label: "PDF",
                        },
                        {
                          value: "CSV",
                          label: "CSV",
                        },
                        {
                          value: "JSON",
                          label: "JSON",
                        },
                      ] as const}
                      onChange={(value) =>
                        updatePrivacy("exportFormat", value)
                      }
                    />
                  </div>
                </Surface>
              ) : null}

              {activeTab ===
              "workspace" ? (
                <Surface className="p-4 sm:p-5">
                  <SectionHeading
                    eyebrow="Workspace"
                    title="Advisor workspace modules and defaults"
                    description="Choose the default landing route, module visibility, navigation behavior, autosave, and external-action confirmation."
                    icon={<Workflow className="h-5 w-5" />}
                    tone="teal"
                  />

                  <div className="mt-5">
                    <SelectField
                      label="Default landing page"
                      value={settings.workspace.defaultLanding}
                      options={LANDING_OPTIONS}
                      onChange={(value) =>
                        updateWorkspace("defaultLanding", value)
                      }
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Toggle
                      label="Market pulse"
                      helper="Display live market information on the workspace."
                      checked={settings.workspace.showMarketPulse}
                      onChange={(value) =>
                        updateWorkspace("showMarketPulse", value)
                      }
                    />
                    <Toggle
                      label="Team snapshot"
                      helper="Display team work and execution metrics."
                      checked={settings.workspace.showTeamSnapshot}
                      onChange={(value) =>
                        updateWorkspace("showTeamSnapshot", value)
                      }
                      tone="teal"
                    />
                    <Toggle
                      label="Client inbox"
                      helper="Display client-portal activity on the workspace."
                      checked={settings.workspace.showClientInbox}
                      onChange={(value) =>
                        updateWorkspace("showClientInbox", value)
                      }
                      tone="cyan"
                    />
                    <Toggle
                      label="Watchlist preview"
                      helper="Display current watchlist signals and scan context."
                      checked={settings.workspace.showWatchlistPreview}
                      onChange={(value) =>
                        updateWorkspace("showWatchlistPreview", value)
                      }
                      tone="amber"
                    />
                    <Toggle
                      label="Compliance banner"
                      helper="Keep review and compliance posture visible."
                      checked={settings.workspace.showComplianceBanner}
                      onChange={(value) =>
                        updateWorkspace("showComplianceBanner", value)
                      }
                      tone="amber"
                    />
                    <Toggle
                      label="Compact sidebar"
                      helper="Use reduced left-navigation width."
                      checked={settings.workspace.compactSidebar}
                      onChange={(value) =>
                        updateWorkspace("compactSidebar", value)
                      }
                      tone="slate"
                    />
                    <Toggle
                      label="Pinned command bar"
                      helper="Keep command search immediately available."
                      checked={settings.workspace.commandBarPinned}
                      onChange={(value) =>
                        updateWorkspace("commandBarPinned", value)
                      }
                      tone="violet"
                    />
                    <Toggle
                      label="Autosave drafts"
                      helper="Persist email and report drafts automatically."
                      checked={settings.workspace.autoSaveDrafts}
                      onChange={(value) =>
                        updateWorkspace("autoSaveDrafts", value)
                      }
                      tone="cyan"
                    />
                    <Toggle
                      label="Confirm external actions"
                      helper="Ask for confirmation before sending or publishing externally."
                      checked={
                        settings.workspace.confirmBeforeExternalActions
                      }
                      onChange={(value) =>
                        updateWorkspace(
                          "confirmBeforeExternalActions",
                          value,
                        )
                      }
                    />
                  </div>
                </Surface>
              ) : null}

              {activeTab ===
              "ai" ? (
                <Surface className="p-4 sm:p-5">
                  <SectionHeading
                    eyebrow="AI defaults"
                    title="Assistant behavior and approval posture"
                    description="Configure research depth, response format, tone, memory, spoken output, and approval requirements."
                    icon={<WandSparkles className="h-5 w-5" />}
                    tone="violet"
                  />

                  <div className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                    <SelectField
                      label="Default mode"
                      value={settings.ai.defaultMode}
                      options={[
                        {
                          value: "quick",
                          label: "Quick",
                        },
                        {
                          value: "balanced",
                          label: "Balanced",
                        },
                        {
                          value: "deep",
                          label: "Deep research",
                        },
                      ] as const}
                      onChange={(value) =>
                        updateAi("defaultMode", value)
                      }
                    />

                    <SelectField
                      label="Reply format"
                      value={settings.ai.replyFormat}
                      options={[
                        {
                          value: "executive-summary",
                          label: "Executive summary",
                        },
                        {
                          value: "advisor-memo",
                          label: "Advisor memo",
                        },
                        {
                          value: "client-friendly",
                          label: "Client friendly",
                        },
                        {
                          value: "action-plan",
                          label: "Action plan",
                        },
                      ] as const}
                      onChange={(value) =>
                        updateAi("replyFormat", value)
                      }
                    />

                    <SelectField
                      label="Report style"
                      value={settings.ai.defaultReportStyle}
                      options={[
                        {
                          value: "Market Green",
                          label: "Market Green",
                        },
                        {
                          value: "Boardroom",
                          label: "Boardroom",
                        },
                        {
                          value: "Client Clean",
                          label: "Client Clean",
                        },
                        {
                          value: "Technical",
                          label: "Technical",
                        },
                      ] as const}
                      onChange={(value) =>
                        updateAi("defaultReportStyle", value)
                      }
                    />

                    <TextField
                      label="Preferred tone"
                      value={settings.ai.preferredTone}
                      onChange={(value) =>
                        updateAi("preferredTone", value)
                      }
                      placeholder="Professional"
                    />

                    <TextField
                      label="Detail level"
                      value={settings.ai.detailLevel}
                      onChange={(value) =>
                        updateAi("detailLevel", value)
                      }
                      placeholder="Balanced detail"
                    />
                  </div>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Toggle
                      label="Use AI memory"
                      helper="Use approved advisor context across workflows."
                      checked={settings.ai.useMemory}
                      onChange={(value) =>
                        updateAi("useMemory", value)
                      }
                      tone="violet"
                    />
                    <Toggle
                      label="Read replies aloud"
                      helper="Enable spoken response behavior by default."
                      checked={settings.ai.autoReadReplies}
                      onChange={(value) =>
                        updateAi("autoReadReplies", value)
                      }
                      tone="cyan"
                    />
                    <Toggle
                      label="Approve reports"
                      helper="Require advisor approval before reports are finalized."
                      checked={settings.ai.requireApprovalForReports}
                      onChange={(value) =>
                        updateAi("requireApprovalForReports", value)
                      }
                    />
                    <Toggle
                      label="Approve email"
                      helper="Require advisor approval before email is sent."
                      checked={settings.ai.requireApprovalForEmails}
                      onChange={(value) =>
                        updateAi("requireApprovalForEmails", value)
                      }
                    />
                  </div>
                </Surface>
              ) : null}

              {activeTab ===
              "support" ? (
                <div className="grid gap-3 xl:grid-cols-[1fr_0.9fr]">
                  <Surface className="p-4 sm:p-5">
                    <SectionHeading
                      eyebrow="Support"
                      title="Contact and platform help"
                      description="Use the configured support contact or open the relevant system area."
                      icon={<LifeBuoy className="h-5 w-5" />}
                      tone="cyan"
                    />

                    <div className="mt-5 grid gap-3">
                      <a
                        href={settings.contact.emailHref || `mailto:${settings.contact.email}`}
                        className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition hover:border-emerald-300/18 hover:bg-emerald-500/[0.05]"
                      >
                        <IconBadge tone="cyan">
                          <Mail className="h-5 w-5" />
                        </IconBadge>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                            Email
                          </span>
                          <span className="mt-1 block truncate text-sm font-black text-white">
                            {settings.contact.email || "Support email not configured"}
                          </span>
                        </span>
                        <ExternalLink className="h-4 w-4 text-slate-700 group-hover:text-emerald-300" />
                      </a>

                      <a
                        href={settings.contact.phoneHref || `tel:${settings.contact.phone}`}
                        className="group flex min-w-0 items-center gap-3 rounded-2xl border border-white/8 bg-white/[0.025] p-4 transition hover:border-emerald-300/18 hover:bg-emerald-500/[0.05]"
                      >
                        <IconBadge tone="teal">
                          <LifeBuoy className="h-5 w-5" />
                        </IconBadge>
                        <span className="min-w-0 flex-1">
                          <span className="block text-xs font-black uppercase tracking-[0.12em] text-slate-600">
                            Phone
                          </span>
                          <span className="mt-1 block truncate text-sm font-black text-white">
                            {settings.contact.phone || "Support phone not configured"}
                          </span>
                        </span>
                        <ExternalLink className="h-4 w-4 text-slate-700 group-hover:text-emerald-300" />
                      </a>
                    </div>
                  </Surface>

                  <Surface className="p-4 sm:p-5">
                    <SectionHeading
                      eyebrow="System links"
                      title="Open a control center"
                      description="Jump to security, system readiness, or the main workspace."
                      icon={<Settings2 className="h-5 w-5" />}
                      tone="slate"
                    />

                    <div className="mt-5 grid gap-2">
                      {[
                        {
                          href: "/security",
                          label: "Security Center",
                          icon: ShieldCheck,
                        },
                        {
                          href: "/system",
                          label: "System Readiness",
                          icon: Gauge,
                        },
                        {
                          href: "/workspace",
                          label: "Workspace Core",
                          icon: LayoutDashboard,
                        },
                      ].map((item) => (
                        <Link
                          key={item.href}
                          href={item.href}
                          className="flex items-center gap-3 rounded-xl border border-white/8 bg-white/[0.025] px-3 py-3 text-xs font-black text-slate-300 transition hover:border-emerald-300/18 hover:text-white"
                        >
                          <item.icon className="h-4 w-4 text-emerald-300" />
                          <span className="min-w-0 flex-1 truncate">
                            {item.label}
                          </span>
                          <ChevronRight className="h-3.5 w-3.5 text-slate-700" />
                        </Link>
                      ))}
                    </div>
                  </Surface>
                </div>
              ) : null}

              {activeTab ===
              "danger" ? (
                <Surface className="p-4 sm:p-5">
                  <SectionHeading
                    eyebrow="Account governance"
                    title="Deactivate or permanently delete"
                    description="These actions affect authentication and stored account data. Use the exact confirmation phrase shown."
                    icon={<AlertTriangle className="h-5 w-5" />}
                    tone="amber"
                  />

                  <div className="mt-5 grid gap-4 xl:grid-cols-2">
                    <div className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.055] p-4">
                      <div className="flex items-start gap-3">
                        <IconBadge tone="amber">
                          <LockKeyhole className="h-5 w-5" />
                        </IconBadge>
                        <div>
                          <p className="text-lg font-black text-white">
                            Deactivate account
                          </p>
                          <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
                            Suspends access and clears the current session. The account remains in the database for governance review.
                          </p>
                        </div>
                      </div>

                      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.13em] text-amber-200">
                        Type DEACTIVATE
                      </p>
                      <input
                        value={dangerConfirmation}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setDangerConfirmation(event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-amber-400/20 bg-black/38 px-3 py-3 text-sm font-black text-white outline-none ring-amber-500 focus:ring-2"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void performDangerAction("deactivate")
                        }
                        disabled={dangerAction !== null}
                        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-amber-400/25 bg-amber-500/[0.09] px-4 text-xs font-black text-amber-100 disabled:opacity-50"
                      >
                        {dangerAction === "deactivate" ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <LockKeyhole className="h-4 w-4" />
                        )}
                        Deactivate account
                      </button>
                    </div>

                    <div className="rounded-2xl border border-orange-400/20 bg-orange-500/[0.055] p-4">
                      <div className="flex items-start gap-3">
                        <IconBadge tone="amber">
                          <Trash2 className="h-5 w-5" />
                        </IconBadge>
                        <div>
                          <p className="text-lg font-black text-white">
                            Delete account
                          </p>
                          <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
                            Permanently deletes the user and cascaded account data according to the Prisma schema.
                          </p>
                        </div>
                      </div>

                      <p className="mt-4 text-[10px] font-black uppercase tracking-[0.13em] text-orange-200">
                        Type DELETE MY ACCOUNT
                      </p>
                      <input
                        value={dangerConfirmation}
                        onChange={(event: ChangeEvent<HTMLInputElement>) =>
                          setDangerConfirmation(event.target.value)
                        }
                        className="mt-2 w-full rounded-xl border border-orange-400/20 bg-black/38 px-3 py-3 text-sm font-black text-white outline-none ring-orange-500 focus:ring-2"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void performDangerAction("delete")
                        }
                        disabled={dangerAction !== null}
                        className="mt-3 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-orange-400/25 bg-orange-500/[0.09] px-4 text-xs font-black text-orange-100 disabled:opacity-50"
                      >
                        {dangerAction === "delete" ? (
                          <RefreshCw className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4" />
                        )}
                        Permanently delete
                      </button>
                    </div>
                  </div>
                </Surface>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}