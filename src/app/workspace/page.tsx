"use client";

import Link from "next/link";
import { createPortal } from "react-dom";
import type { Dispatch, ReactNode, SetStateAction } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";
type ThemeMode = "dark" | "light";
type OutletId = "overview" | "watchlists";
type WorkspaceMode = "guided" | "power" | "focus";
type AdvisorRole = "Founder" | "Lead Advisor" | "Service Advisor" | "Ops";

type IconName =
  | "board"
  | "watch"
  | "visuals"
  | "intel"
  | "portal"
  | "client"
  | "mail"
  | "spark"
  | "settings"
  | "shield"
  | "team"
  | "home"
  | "search"
  | "light"
  | "command"
  | "star";

type ActionTarget =
  | { type: "route"; href: string }
  | { type: "outlet"; outlet: OutletId }
  | { type: "mode"; mode: WorkspaceMode }
  | { type: "role"; role: AdvisorRole }
  | { type: "search"; query: string };

type WorkspaceTool = {
  id: string;
  label: string;
  shortLabel: string;
  subtitle: string;
  description: string;
  icon: IconName;
  tone: Tone;
  target: ActionTarget;
  routeLabel: string;
  category: "Market" | "Client" | "Communication" | "AI" | "System" | "Team";
  outcome: string;
  differentiator: string;
  status: "Live route" | "Workspace outlet";
  tags: string[];
};

type SearchSuggestion = {
  id: string;
  title: string;
  detail: string;
  badge: string;
  icon: IconName;
  tone: Tone;
  action: ActionTarget;
  keywords: string[];
};

type WatchItem = {
  id: string;
  symbol: string;
  name: string;
  constraint: string;
  targetValue: string;
  note: string;
  source: "Manual" | "Custom Board";
};

type TeamInvite = {
  id: string;
  firmName: string;
  email: string;
  role: string;
  inviteCode: string;
  inviteLink: string;
  createdAt: string;
  lastSentAt?: string;
  status: "Drafted" | "Ready to Send" | "Sent";
};

type OrbitShape = "pill" | "diamond" | "hex" | "panel" | "ring";

type OrbitNode = {
  label: string;
  sublabel: string;
  tone: Tone;
  top: string;
  left: string;
  width: string;
  shape: OrbitShape;
};

type MarketPulseItem = {
  symbol: string;
  price: string;
  change: string;
  tone: Tone;
  top: string;
  left: string;
  shape: OrbitShape;
};

const THEME_KEY = "slice-theme-mode-v1";
const OUTLET_KEY = "slice-console-outlet-v14";
const WATCHLIST_KEY = "slice-shared-watchlist-v1";
const TEAM_INVITES_KEY = "slice-team-invites-v1";

const WORKSPACE_TOOLS: WorkspaceTool[] = [
  {
    id: "custom-board",
    label: "Custom Board",
    shortLabel: "Board",
    subtitle: "Security analysis",
    description:
      "Dedicated market cockpit for charts, symbols, metrics, watchlist rules, and advisor-specific market review.",
    icon: "board",
    tone: "cyan",
    target: { type: "route", href: "/workspace/custom-board" },
    routeLabel: "/workspace/custom-board",
    category: "Market",
    outcome: "Analyze securities quickly",
    differentiator: "Advisor-owned market board",
    status: "Live route",
    tags: ["custom board", "security", "stock", "etf", "chart", "market", "analysis"],
  },
  {
    id: "watchlists",
    label: "Watchlists",
    shortLabel: "Watch",
    subtitle: "Rules and alerts",
    description: "Monitor symbols, constraints, thresholds, and advisor notes.",
    icon: "watch",
    tone: "amber",
    target: { type: "outlet", outlet: "watchlists" },
    routeLabel: "/workspace?tab=watchlists",
    category: "Market",
    outcome: "Track important signals",
    differentiator: "Constraint-based monitoring",
    status: "Workspace outlet",
    tags: ["watchlist", "alerts", "constraints", "thresholds", "monitoring"],
  },
  {
    id: "market-visuals",
    label: "Market Visuals",
    shortLabel: "Visuals",
    subtitle: "Visual market desk",
    description: "Charts, dashboards, snapshots, and presentation-ready market views.",
    icon: "visuals",
    tone: "blue",
    target: { type: "route", href: "/market-visuals" },
    routeLabel: "/market-visuals",
    category: "Market",
    outcome: "Present market context faster",
    differentiator: "Presentation-ready visual intelligence",
    status: "Live route",
    tags: ["market visuals", "charts", "dashboard", "market"],
  },
  {
    id: "intelligence",
    label: "Intelligence",
    shortLabel: "Intel",
    subtitle: "Technical + news scan",
    description: "Watchlist technical scanning and article/news monitoring.",
    icon: "intel",
    tone: "red",
    target: { type: "route", href: "/workspace/intelligence" },
    routeLabel: "/workspace/intelligence",
    category: "AI",
    outcome: "Surface signals earlier",
    differentiator: "Watchlist-driven intelligence",
    status: "Live route",
    tags: ["intelligence", "technical", "news", "articles", "watchlist"],
  },
  {
    id: "client-portal-inbox",
    label: "Client Portal Inbox",
    shortLabel: "Portal",
    subtitle: "Client messages",
    description: "Client messages, requests, documents, permission changes, and account updates.",
    icon: "portal",
    tone: "purple",
    target: { type: "route", href: "/workspace/client-portal-inbox" },
    routeLabel: "/workspace/client-portal-inbox",
    category: "Client",
    outcome: "Review client intent first",
    differentiator: "Client requests become advisor workflows",
    status: "Live route",
    tags: ["client portal", "inbox", "messages", "requests"],
  },
  {
    id: "client-profiles",
    label: "Client Profiles",
    shortLabel: "Clients",
    subtitle: "Relationship context",
    description: "Client profiles, household context, risk preferences, notes, objectives, and records.",
    icon: "client",
    tone: "purple",
    target: { type: "route", href: "/workspace/clients" },
    routeLabel: "/workspace/clients",
    category: "Client",
    outcome: "Know the client before acting",
    differentiator: "Client context before recommendation",
    status: "Live route",
    tags: ["client profiles", "crm", "household", "risk", "notes"],
  },
  {
    id: "email-center",
    label: "Email Center",
    shortLabel: "Email",
    subtitle: "Draft and review",
    description: "AI-assisted email drafts, advisor review, and client communication.",
    icon: "mail",
    tone: "green",
    target: { type: "route", href: "/workspace/client-emails" },
    routeLabel: "/workspace/client-emails",
    category: "Communication",
    outcome: "Send better updates faster",
    differentiator: "AI drafts with advisor control",
    status: "Live route",
    tags: ["email", "draft", "communication"],
  },
  {
    id: "ai-studio",
    label: "AI Studio",
    shortLabel: "AI",
    subtitle: "Command and prep",
    description: "Advisor AI studio for summarizing, preparing, routing, and brainstorming.",
    icon: "spark",
    tone: "red",
    target: { type: "route", href: "/workspace/personal-bot?mode=studio" },
    routeLabel: "/workspace/personal-bot?mode=studio",
    category: "AI",
    outcome: "Reduce preparation time",
    differentiator: "Advisor-specific AI cockpit",
    status: "Live route",
    tags: ["ai studio", "assistant", "summaries", "command", "prep"],
  },
  {
    id: "enhanced-settings",
    label: "Enhanced Settings",
    shortLabel: "Settings",
    subtitle: "Theme and defaults",
    description: "Theme, accessibility, notifications, preferences, and defaults.",
    icon: "settings",
    tone: "blue",
    target: { type: "route", href: "/workspace/settings" },
    routeLabel: "/workspace/settings",
    category: "System",
    outcome: "Personalize the workspace",
    differentiator: "Advisor-controlled experience",
    status: "Live route",
    tags: ["settings", "theme", "preferences", "notifications"],
  },
  {
    id: "compliance",
    label: "Compliance Center",
    shortLabel: "Compliance",
    subtitle: "Review gates",
    description: "Sensitive workflow review, records, and advisor guardrails.",
    icon: "shield",
    tone: "amber",
    target: { type: "route", href: "/security?panel=compliance" },
    routeLabel: "/security?panel=compliance",
    category: "System",
    outcome: "Review before delivery",
    differentiator: "Compliance visible in the workflow",
    status: "Live route",
    tags: ["compliance", "security", "review", "records"],
  },
  {
    id: "team-board",
    label: "Team Board",
    shortLabel: "Team",
    subtitle: "Tasks and calendar",
    description: "Delegation, calendar, brainstorm, shared workspace, My Work, and Docs.",
    icon: "team",
    tone: "green",
    target: { type: "route", href: "/workspace/team-board" },
    routeLabel: "/workspace/team-board",
    category: "Team",
    outcome: "Execute as a team",
    differentiator: "Team execution next to advisor tools",
    status: "Live route",
    tags: ["team", "tasks", "calendar", "brainstorm", "docs"],
  },
];

const DEFAULT_WATCHLIST: WatchItem[] = [
  {
    id: "watch-spy",
    symbol: "SPY",
    name: "S&P 500 ETF",
    constraint: "Notify above",
    targetValue: "550",
    note: "Broad market strength check",
    source: "Custom Board",
  },
  {
    id: "watch-nvda",
    symbol: "NVDA",
    name: "NVIDIA",
    constraint: "Notify move",
    targetValue: "±4%",
    note: "AI exposure review",
    source: "Manual",
  },
  {
    id: "watch-tlt",
    symbol: "TLT",
    name: "20+ Year Treasury ETF",
    constraint: "Notify below",
    targetValue: "88",
    note: "Rate-sensitive portfolio review",
    source: "Manual",
  },
];

const ORBIT_NODES: OrbitNode[] = [
  {
    label: "Client",
    sublabel: "Signals",
    tone: "purple",
    top: "12%",
    left: "50%",
    width: "min-w-[118px]",
    shape: "pill",
  },
  {
    label: "Visuals",
    sublabel: "Market",
    tone: "blue",
    top: "30%",
    left: "78%",
    width: "min-w-[96px]",
    shape: "diamond",
  },
  {
    label: "Watch",
    sublabel: "Rules",
    tone: "amber",
    top: "70%",
    left: "78%",
    width: "min-w-[104px]",
    shape: "hex",
  },
  {
    label: "AI Studio",
    sublabel: "Prep",
    tone: "red",
    top: "88%",
    left: "50%",
    width: "min-w-[116px]",
    shape: "ring",
  },
  {
    label: "Team",
    sublabel: "Tasks",
    tone: "green",
    top: "70%",
    left: "22%",
    width: "min-w-[104px]",
    shape: "hex",
  },
  {
    label: "Intel",
    sublabel: "Scan",
    tone: "cyan",
    top: "30%",
    left: "22%",
    width: "min-w-[104px]",
    shape: "panel",
  },
];

const FALLBACK_QUOTES: MarketPulseItem[] = [
  { symbol: "SPY", price: "$548.32", change: "+0.56%", tone: "green", top: "7%", left: "30%", shape: "panel" },
  { symbol: "QQQ", price: "$472.84", change: "+0.74%", tone: "green", top: "9%", left: "70%", shape: "panel" },
  { symbol: "NVDA", price: "$131.22", change: "+1.48%", tone: "green", top: "33%", left: "89%", shape: "diamond" },
  { symbol: "AAPL", price: "$214.37", change: "-0.32%", tone: "red", top: "67%", left: "89%", shape: "diamond" },
  { symbol: "BTC", price: "$67,012", change: "+1.92%", tone: "green", top: "92%", left: "70%", shape: "hex" },
  { symbol: "TLT", price: "$89.14", change: "-0.18%", tone: "amber", top: "92%", left: "30%", shape: "hex" },
  { symbol: "MSFT", price: "$441.09", change: "+0.64%", tone: "green", top: "67%", left: "11%", shape: "diamond" },
  { symbol: "DXY", price: "104.18", change: "-0.11%", tone: "cyan", top: "33%", left: "11%", shape: "diamond" },
];

const TEAM_ROLE_OPTIONS = [
  "Founder",
  "Principal Advisor",
  "Lead Advisor",
  "Senior Wealth Advisor",
  "Associate Advisor",
  "Service Advisor",
  "Portfolio Manager",
  "Investment Analyst",
  "Financial Planning Analyst",
  "Paraplanner",
  "Client Service Associate",
  "Relationship Manager",
  "Operations Associate",
  "Compliance Officer",
  "Chief Compliance Officer",
  "Admin",
  "Ops",
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function isLightTheme(theme: ThemeMode) {
  return theme === "light";
}

function textStrong(theme: ThemeMode) {
  return isLightTheme(theme) ? "text-slate-950" : "text-white";
}

function textMuted(theme: ThemeMode) {
  return isLightTheme(theme) ? "text-slate-600" : "text-slate-400";
}

function textFaint(theme: ThemeMode) {
  return isLightTheme(theme) ? "text-slate-500" : "text-slate-500";
}

function surface(theme: ThemeMode) {
  return isLightTheme(theme)
    ? "border-sky-200/80 bg-white/84 shadow-xl shadow-sky-900/10 backdrop-blur-xl"
    : "border-white/10 bg-zinc-950/84 shadow-2xl shadow-black/30 backdrop-blur-xl";
}

function sidebarSurface(theme: ThemeMode) {
  return isLightTheme(theme)
    ? "border-sky-200/80 bg-white/78 shadow-xl shadow-sky-900/10"
    : "border-white/10 bg-black/60";
}

function inputSurface(theme: ThemeMode) {
  return isLightTheme(theme)
    ? "border-sky-200/80 bg-white/88 text-slate-950 placeholder:text-slate-400"
    : "border-white/10 bg-black/60 text-white placeholder:text-slate-600";
}

function tintSurface(theme: ThemeMode) {
  return isLightTheme(theme)
    ? "border-sky-200/80 bg-sky-50/84"
    : "border-white/10 bg-white/[0.05]";
}

function blackGlass(theme: ThemeMode) {
  return isLightTheme(theme)
    ? "border-sky-200/80 bg-white/86"
    : "border-white/10 bg-black/28";
}

function toneClasses(tone: Tone, theme: ThemeMode) {
  if (isLightTheme(theme)) {
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
    red: "border-red-500/35 bg-red-500/12 text-red-100",
    green: "border-emerald-500/35 bg-emerald-500/12 text-emerald-100",
    amber: "border-amber-500/35 bg-amber-500/12 text-amber-100",
    purple: "border-purple-500/35 bg-purple-500/12 text-purple-100",
    cyan: "border-cyan-500/35 bg-cyan-500/12 text-cyan-100",
    blue: "border-blue-500/35 bg-blue-500/12 text-blue-100",
    slate: "border-slate-500/22 bg-slate-500/10 text-slate-100",
  };

  return dark[tone];
}

const dotClasses: Record<Tone, string> = {
  red: "bg-red-400 shadow-red-400/60",
  green: "bg-emerald-400 shadow-emerald-400/60",
  amber: "bg-amber-400 shadow-amber-400/60",
  purple: "bg-purple-400 shadow-purple-400/60",
  cyan: "bg-cyan-400 shadow-cyan-400/60",
  blue: "bg-blue-400 shadow-blue-400/60",
  slate: "bg-slate-400 shadow-slate-400/60",
};

function toneForChange(change: string): Tone {
  if (change.trim().startsWith("-")) return "red";
  if (change.trim().startsWith("+")) return "green";
  return "amber";
}

function Icon({ name, className = "" }: { name: IconName; className?: string }) {
  const icons: Record<IconName, string> = {
    board: "◈",
    watch: "◔",
    visuals: "▧",
    intel: "✺",
    portal: "◍",
    client: "◐",
    mail: "✉",
    spark: "✦",
    settings: "⚙",
    shield: "🛡",
    team: "☷",
    home: "⌂",
    search: "⌕",
    light: "◉",
    command: "⌘",
    star: "★",
  };

  return <span className={cx("inline-flex leading-none", className)}>{icons[name]}</span>;
}

function Card({
  children,
  className = "",
  theme,
}: {
  children: ReactNode;
  className?: string;
  theme: ThemeMode;
}) {
  return (
    <div className={cx("relative min-w-0 overflow-hidden rounded-[1.7rem] border", surface(theme), className)}>
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "slate",
  theme,
}: {
  children: ReactNode;
  tone?: Tone;
  theme: ThemeMode;
}) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase leading-tight tracking-[0.12em]",
        toneClasses(tone, theme),
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function LinkButton({
  href,
  children,
  tone = "red",
  variant = "solid",
  className = "",
  theme,
}: {
  href: string;
  children: ReactNode;
  tone?: Tone;
  variant?: "solid" | "soft" | "light";
  className?: string;
  theme: ThemeMode;
}) {
  const classes =
    variant === "light"
      ? "border-white/20 bg-white text-slate-950 hover:bg-red-100"
      : variant === "solid" && tone === "red" && !isLightTheme(theme)
        ? "border-red-400/40 bg-gradient-to-r from-red-500 via-red-700 to-red-950 text-white shadow-xl shadow-red-950/40 hover:from-red-400 hover:via-red-600 hover:to-red-900"
        : cx("border", toneClasses(tone, theme));

  return (
    <Link
      href={href}
      prefetch={false}
      className={cx(
        "inline-flex items-center justify-center rounded-2xl px-3.5 py-2.5 text-sm font-black transition hover:-translate-y-0.5",
        classes,
        className,
      )}
    >
      {children}
    </Link>
  );
}

function ActionButton({
  children,
  tone = "red",
  className = "",
  onClick,
  theme,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
  onClick: () => void;
  theme: ThemeMode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center justify-center rounded-2xl border px-3.5 py-2.5 text-sm font-black transition hover:-translate-y-0.5",
        toneClasses(tone, theme),
        className,
      )}
    >
      {children}
    </button>
  );
}

function BrandMark({ theme }: { theme: ThemeMode }) {
  return (
    <div className="flex items-center gap-3">
      <div className="relative grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-red-950 via-zinc-950 to-red-600 shadow-lg shadow-red-950/50 ring-1 ring-red-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-base font-black text-white">
          S
        </div>
      </div>

      <div className="min-w-0">
        <div className={cx("truncate text-xl font-black tracking-tight", textStrong(theme))}>Slice</div>
        <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
          Advisor Console
        </div>
      </div>
    </div>
  );
}

function targetLabel(target: ActionTarget) {
  if (target.type === "route") return target.href;
  if (target.type === "outlet") return `/workspace?tab=${target.outlet}`;
  if (target.type === "mode") return `Mode: ${target.mode}`;
  if (target.type === "role") return `Role: ${target.role}`;
  return `Search: ${target.query}`;
}

function toolTargetToOutlet(target: ActionTarget): OutletId | null {
  if (target.type === "outlet") return target.outlet;
  return null;
}

function saveWatchlist(items: WatchItem[]) {
  window.localStorage.setItem(WATCHLIST_KEY, JSON.stringify(items));
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function nowLabel() {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function buildTeamInviteLink({
  firmName,
  email,
  role,
  inviteCode,
}: {
  firmName: string;
  email: string;
  role: string;
  inviteCode: string;
}) {
  const origin = typeof window !== "undefined" ? window.location.origin : "";

  const params = new URLSearchParams({
    code: inviteCode,
    firm: firmName,
    email,
    role,
  });

  return `${origin}/workspace/team-invite?${params.toString()}`;
}

function shapeClass(shape: OrbitShape) {
  switch (shape) {
    case "pill":
      return "rounded-[1.35rem]";
    case "diamond":
      return "rounded-[1rem] rotate-45";
    case "hex":
      return "rounded-[1rem] hex-clip";
    case "panel":
      return "rounded-[1.1rem]";
    case "ring":
      return "rounded-full";
    default:
      return "rounded-[1.1rem]";
  }
}

function innerShapeReset(shape: OrbitShape) {
  return shape === "diamond" ? "-rotate-45" : "";
}

function getTextField(row: Record<string, unknown>, keys: string[], fallback: string) {
  for (const key of keys) {
    const value = row[key];
    if (typeof value === "string" && value.trim()) return value;
    if (typeof value === "number" && Number.isFinite(value)) return String(value);
  }
  return fallback;
}

function formatPrice(symbol: string, value: string) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return value;
  if (symbol === "DXY") return parsed.toFixed(2);
  if (symbol === "BTC") return `$${Math.round(parsed).toLocaleString()}`;
  return `$${parsed.toFixed(2)}`;
}

function deriveAdvisorName() {
  const keys = [
    "slice-current-user-v1",
    "slice-current-advisor-v1",
    "slice-advisor-profile-v1",
    "slice-user-profile-v1",
    "slice-founder-profile-v1",
  ];

  for (const key of keys) {
    try {
      const raw = window.localStorage.getItem(key);
      if (!raw) continue;

      const parsed = JSON.parse(raw) as Record<string, unknown>;
      const possibleName =
        parsed.name ||
        parsed.fullName ||
        parsed.displayName ||
        parsed.firstName ||
        parsed.advisorName ||
        parsed.founderName;

      if (typeof possibleName === "string" && possibleName.trim()) {
        return possibleName.trim();
      }
    } catch {
      const raw = window.localStorage.getItem(key);
      if (raw && raw.trim() && !raw.includes("{")) return raw.trim();
    }
  }

  return "Advisor";
}

function useMarketQuotes() {
  const [quotes, setQuotes] = useState<MarketPulseItem[]>(FALLBACK_QUOTES);
  const [quoteStatus, setQuoteStatus] = useState("Market feed ready");

  useEffect(() => {
    let cancelled = false;
    const symbols = FALLBACK_QUOTES.map((quote) => quote.symbol);

    async function refresh() {
      try {
        const response = await fetch(`/api/market/quotes?symbols=${symbols.join(",")}`, {
          cache: "no-store",
        });

        if (!response.ok) throw new Error("Quote feed unavailable");

        const json = (await response.json()) as unknown;
        const records = Array.isArray(json)
          ? json
          : typeof json === "object" && json !== null && Array.isArray((json as { quotes?: unknown }).quotes)
            ? (json as { quotes: unknown[] }).quotes
            : [];

        if (!records.length) throw new Error("Quote feed returned no records");

        const nextQuotes = FALLBACK_QUOTES.map((fallback) => {
          const record = records.find((item) => {
            if (typeof item !== "object" || item === null) return false;
            const row = item as Record<string, unknown>;
            return getTextField(row, ["symbol", "ticker"], "").toUpperCase() === fallback.symbol;
          });

          if (!record || typeof record !== "object") return fallback;

          const row = record as Record<string, unknown>;
          const rawPrice = getTextField(row, ["price", "last", "regularMarketPrice"], fallback.price);
          const rawChange =
            getTextField(row, ["changePercent", "changePct", "percentChange"], "") ||
            getTextField(row, ["change", "regularMarketChangePercent"], fallback.change);

          const change = rawChange.includes("%") ? rawChange : `${rawChange}%`;
          const tone = toneForChange(change);

          return {
            ...fallback,
            price: formatPrice(fallback.symbol, rawPrice),
            change,
            tone,
          };
        });

        if (!cancelled) {
          setQuotes(nextQuotes);
          setQuoteStatus("Market feed live");
        }
      } catch {
        if (!cancelled) {
          setQuotes(FALLBACK_QUOTES);
          setQuoteStatus("Market feed ready");
        }
      }
    }

    refresh();
    const interval = window.setInterval(refresh, 30000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, []);

  return { quotes, quoteStatus };
}

function Sidebar({
  activeOutlet,
  onOpenTarget,
  theme,
}: {
  activeOutlet: OutletId;
  onOpenTarget: (target: ActionTarget) => void;
  theme: ThemeMode;
}) {
  return (
    <aside className={cx("flex h-full min-h-0 flex-col gap-3 border-r p-3 backdrop-blur-xl", sidebarSurface(theme))}>
      <BrandMark theme={theme} />

      <div className={cx("min-h-0 flex-1 rounded-[1.6rem] border p-2", tintSurface(theme))}>
        <div className={cx("mb-2 px-2 text-[10px] font-black uppercase tracking-[0.18em]", textFaint(theme))}>
          Advisor tools
        </div>

        <div className="grid gap-1">
          {WORKSPACE_TOOLS.map((tool) => {
            const outlet = toolTargetToOutlet(tool.target);
            const active = outlet ? activeOutlet === outlet : false;

            if (tool.target.type === "route") {
              return (
                <Link
                  key={tool.id}
                  href={tool.target.href}
                  prefetch={false}
                  className={cx(
                    "group flex items-center gap-2.5 rounded-2xl border border-transparent px-2.5 py-1.5 text-left transition hover:border-red-400/30",
                    isLightTheme(theme) ? "hover:bg-red-50/80" : "hover:bg-red-500/[0.08]",
                  )}
                >
                  <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-base", toneClasses(tool.tone, theme))}>
                    <Icon name={tool.icon} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className={cx("block truncate text-[13px] font-black", textStrong(theme))}>{tool.label}</span>
                    <span className={cx("block truncate text-[10px] font-semibold", textFaint(theme))}>{tool.subtitle}</span>
                  </span>
                  <span className={cx("transition group-hover:text-red-400", textFaint(theme))}>↗</span>
                </Link>
              );
            }

            return (
              <button
                key={tool.id}
                type="button"
                onClick={() => onOpenTarget(tool.target)}
                className={cx(
                  "group flex items-center gap-2.5 rounded-2xl border px-2.5 py-1.5 text-left transition",
                  active
                    ? cx("shadow-lg", toneClasses(tool.tone, theme))
                    : cx("border-transparent hover:border-red-400/30", isLightTheme(theme) ? "hover:bg-red-50/80" : "hover:bg-red-500/[0.08]"),
                )}
              >
                <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-base", active ? "border-white/20 bg-black/25" : toneClasses(tool.tone, theme))}>
                  <Icon name={tool.icon} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className={cx("block truncate text-[13px] font-black", textStrong(theme))}>{tool.label}</span>
                  <span className={cx("block truncate text-[10px] font-semibold", textFaint(theme))}>{tool.subtitle}</span>
                </span>
                <span className={cx("transition group-hover:text-red-400", textFaint(theme))}>→</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="grid gap-2">
        <LinkButton href="/" tone="slate" variant="soft" className="w-full" theme={theme}>Home</LinkButton>
        <LinkButton href="/client-login" tone="purple" variant="soft" className="w-full" theme={theme}>Client Login</LinkButton>
        <LinkButton href="/founder-login" tone="red" className="w-full" theme={theme}>Advisor Login</LinkButton>
      </div>
    </aside>
  );
}

function CommandPulldown({
  commandText,
  setCommandText,
  suggestions,
  selectedIndex,
  setSelectedIndex,
  isOpen,
  setIsOpen,
  executeSuggestion,
  runCommand,
  theme,
}: {
  commandText: string;
  setCommandText: (value: string) => void;
  suggestions: SearchSuggestion[];
  selectedIndex: number;
  setSelectedIndex: Dispatch<SetStateAction<number>>;
  isOpen: boolean;
  setIsOpen: (value: boolean) => void;
  executeSuggestion: (suggestion: SearchSuggestion) => void;
  runCommand: () => void;
  theme: ThemeMode;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [mounted, setMounted] = useState(false);
  const [overlayRect, setOverlayRect] = useState({ top: 90, left: 16, width: 700 });

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    function updateRect() {
      const el = inputRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      const maxWidth = Math.min(780, window.innerWidth - 24);
      const width = Math.min(maxWidth, Math.max(420, rect.width));
      const left = clamp(rect.left, 12, window.innerWidth - width - 12);
      const top = rect.bottom + 10;
      setOverlayRect({ top, left, width });
    }

    if (isOpen) {
      updateRect();
      window.addEventListener("resize", updateRect);
      window.addEventListener("scroll", updateRect, true);

      return () => {
        window.removeEventListener("resize", updateRect);
        window.removeEventListener("scroll", updateRect, true);
      };
    }
  }, [isOpen]);

  const overlay =
    isOpen && mounted
      ? createPortal(
          <>
            <button
              type="button"
              aria-label="Close search"
              onClick={() => setIsOpen(false)}
              className={cx("fixed inset-0", isLightTheme(theme) ? "bg-red-950/10" : "bg-black/50")}
              style={{ zIndex: 2147483645 }}
            />

            <div
              className={cx(
                "fixed max-h-[76vh] overflow-hidden rounded-[1.9rem] border p-2 shadow-2xl backdrop-blur-2xl",
                isLightTheme(theme)
                  ? "border-red-200 bg-white/98 shadow-red-950/20"
                  : "border-red-500/25 bg-zinc-950/98 shadow-[0_30px_80px_rgba(0,0,0,0.7)]",
              )}
              style={{ top: overlayRect.top, left: overlayRect.left, width: overlayRect.width, zIndex: 2147483646 }}
            >
              <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-red-500/20 via-orange-500/8 to-transparent" />

              <div className="relative mb-2 flex items-center justify-between px-3 py-2">
                <div>
                  <div className={cx("text-[10px] font-black uppercase tracking-[0.16em]", textFaint(theme))}>Command search</div>
                  <div className={cx("text-sm font-black", textStrong(theme))}>
                    {commandText.trim() ? `Routing “${commandText.trim()}”` : "Type anything. Jump anywhere."}
                  </div>
                </div>
                <div className={cx("text-[10px] font-black uppercase tracking-[0.16em]", textFaint(theme))}>↑ ↓ enter esc</div>
              </div>

              <div className="relative grid max-h-[calc(76vh-72px)] gap-2 overflow-y-auto pr-1">
                {suggestions.length ? (
                  suggestions.map((suggestion, index) => (
                    <button
                      key={suggestion.id}
                      type="button"
                      onMouseDown={(event) => {
                        event.preventDefault();
                        executeSuggestion(suggestion);
                      }}
                      onMouseEnter={() => setSelectedIndex(index)}
                      className={cx(
                        "rounded-2xl border p-3 text-left transition",
                        selectedIndex === index
                          ? cx("scale-[1.01] shadow-xl shadow-red-950/20", toneClasses(suggestion.tone, theme))
                          : cx("hover:-translate-y-0.5", blackGlass(theme)),
                      )}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex min-w-0 gap-3">
                          <div className={cx("grid h-11 w-11 shrink-0 place-items-center rounded-2xl border text-lg", toneClasses(suggestion.tone, theme))}>
                            <Icon name={suggestion.icon} />
                          </div>
                          <div className="min-w-0">
                            <div className={cx("font-black", textStrong(theme))}>{suggestion.title}</div>
                            <p className={cx("mt-1 line-clamp-2 text-xs font-semibold leading-5", textMuted(theme))}>{suggestion.detail}</p>
                            <div className={cx("mt-2 text-[10px] font-black uppercase tracking-[0.12em]", textFaint(theme))}>{targetLabel(suggestion.action)}</div>
                          </div>
                        </div>
                        <Pill tone={suggestion.tone} theme={theme}>{suggestion.badge}</Pill>
                      </div>
                    </button>
                  ))
                ) : (
                  <div className={cx("rounded-2xl border p-4 text-sm font-bold", blackGlass(theme), textMuted(theme))}>
                    No matching tool found.
                  </div>
                )}
              </div>
            </div>
          </>,
          document.body,
        )
      : null;

  return (
    <>
      <div className="relative">
        <Icon name="search" className="pointer-events-none absolute left-4 top-1/2 z-10 -translate-y-1/2 text-sm text-red-400" />
        <input
          ref={inputRef}
          value={commandText}
          onFocus={() => setIsOpen(true)}
          onChange={(event) => {
            setCommandText(event.target.value);
            setIsOpen(true);
          }}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setIsOpen(true);
              setSelectedIndex((current) => Math.min(current + 1, Math.max(0, suggestions.length - 1)));
            }

            if (event.key === "ArrowUp") {
              event.preventDefault();
              setSelectedIndex((current) => Math.max(0, current - 1));
            }

            if (event.key === "Enter") {
              event.preventDefault();
              const selected = suggestions[selectedIndex];
              if (selected) executeSuggestion(selected);
              else runCommand();
            }

            if (event.key === "Escape") setIsOpen(false);
          }}
          placeholder="Search tools, routes, clients, intelligence..."
          className={cx("w-full rounded-2xl border py-3 pl-11 pr-4 text-sm font-bold outline-none ring-red-500 focus:ring-2", inputSurface(theme))}
        />
      </div>
      {overlay}
    </>
  );
}

function TeamInvitePanel({
  theme,
  invites,
  setInvites,
}: {
  theme: ThemeMode;
  invites: TeamInvite[];
  setInvites: Dispatch<SetStateAction<TeamInvite[]>>;
}) {
  const [firmName, setFirmName] = useState("Slice Advisory Group");
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("Lead Advisor");
  const [sendingInvite, setSendingInvite] = useState(false);
  const [sendMessage, setSendMessage] = useState("");

  async function createInvite() {
    const cleanEmail = email.trim().toLowerCase();
    const cleanFirm = firmName.trim() || "Slice Advisory Group";

    if (!cleanEmail) {
      setSendMessage("Enter an advisor email first.");
      return;
    }

    setSendingInvite(true);
    setSendMessage("");

    const inviteCode = `SLICE-${Math.random().toString(36).slice(2, 8).toUpperCase()}`;
    const inviteLink = buildTeamInviteLink({
      firmName: cleanFirm,
      email: cleanEmail,
      role,
      inviteCode,
    });

    const invite: TeamInvite = {
      id: `invite-${Date.now()}`,
      firmName: cleanFirm,
      email: cleanEmail,
      role,
      inviteCode,
      inviteLink,
      createdAt: nowLabel(),
      lastSentAt: nowLabel(),
      status: "Sent",
    };

    try {
      const response = await fetch("/api/team-invites/send", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          to: invite.email,
          firmName: invite.firmName,
          role: invite.role,
          inviteCode: invite.inviteCode,
          inviteLink: invite.inviteLink,
        }),
      });

      const result = (await response.json()) as {
        ok?: boolean;
        message?: string;
      };

      if (!response.ok || !result.ok) {
        throw new Error(result.message || "Invite email could not be sent.");
      }

      setInvites((current) => {
        const next = [invite, ...current];
        saveJson(TEAM_INVITES_KEY, next);
        return next;
      });

      setEmail("");
      setSendMessage("Email sent successfully.");
    } catch (error) {
      setSendMessage(
        error instanceof Error
          ? error.message
          : "Invite email could not be sent. Check Resend configuration.",
      );
    } finally {
      setSendingInvite(false);
    }
  }

  return (
    <Card theme={theme} className="p-4">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-emerald-500/14 via-red-500/5 to-transparent" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-green-400">
            Firm Invite
          </div>
          <h2 className={cx("mt-2 text-xl font-black", textStrong(theme))}>Invite advisors</h2>
          <p className={cx("mt-1 text-xs font-semibold leading-5", textMuted(theme))}>
            Sends a firm-specific account creation link.
          </p>
        </div>

        <Pill tone="green" theme={theme}>{invites.length} sent</Pill>
      </div>

      <div className="relative mt-4 grid gap-2">
        <input
          value={firmName}
          onChange={(event) => setFirmName(event.target.value)}
          placeholder="Firm name"
          className={cx("rounded-2xl border px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500", inputSurface(theme))}
        />

        <input
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="advisor@email.com"
          className={cx("rounded-2xl border px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500", inputSurface(theme))}
        />

        <select
          value={role}
          onChange={(event) => setRole(event.target.value)}
          className={cx("rounded-2xl border px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500", inputSurface(theme))}
        >
          {TEAM_ROLE_OPTIONS.map((option) => (
            <option key={option}>{option}</option>
          ))}
        </select>

        <ActionButton onClick={createInvite} tone="red" theme={theme} className="disabled:cursor-not-allowed disabled:opacity-60">
          {sendingInvite ? "Sending..." : "Create Invite Link"}
        </ActionButton>
      </div>

      {sendMessage ? (
        <div className={cx("mt-4 rounded-2xl border px-3 py-3 text-center text-xs font-black uppercase tracking-[0.12em]", sendMessage === "Email sent successfully." ? toneClasses("green", theme) : toneClasses("amber", theme))}>
          {sendMessage}
        </div>
      ) : null}
    </Card>
  );
}

function PulseQueue({ theme }: { theme: ThemeMode }) {
  const items = [
    ["Client updates", "3 unread portal updates", "purple"],
    ["Watchlist coverage", "4 active alert conditions", "cyan"],
    ["Market scan", "High-priority intelligence ready", "red"],
    ["Team workflow", "Firm invite flow available", "green"],
  ] as const;

  return (
    <Card theme={theme} className="p-4">
      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">Workspace pulse</div>
      <div className="mt-3 grid gap-2">
        {items.map(([label, detail, tone]) => (
          <div key={label} className={cx("group rounded-2xl border p-3 transition hover:-translate-y-0.5", toneClasses(tone, theme))}>
            <div className="flex items-center gap-3">
              <span className={cx("h-2.5 w-2.5 rounded-full shadow-lg", dotClasses[tone])} />
              <div className="min-w-0">
                <div className={cx("truncate text-sm font-black", textStrong(theme))}>{label}</div>
                <div className={cx("truncate text-xs font-semibold", textMuted(theme))}>{detail}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function HeroCard({ theme, userName }: { theme: ThemeMode; userName: string }) {
  return (
    <Card className="relative p-3" theme={theme}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-red-600/20 via-orange-500/7 to-transparent" />
      <div className="relative flex h-full items-center justify-center text-center">
        <h1 className={cx("truncate text-3xl font-black leading-none tracking-tight xl:text-5xl", textStrong(theme))}>
          Welcome, {userName}.
        </h1>
      </div>
    </Card>
  );
}

function QuoteCard({ item, theme }: { item: MarketPulseItem; theme: ThemeMode }) {
  const content = (
    <div className="text-center">
      <div className={cx("text-[11px] font-black", textStrong(theme))}>{item.symbol}</div>
      <div className={cx("mt-0.5 text-xs font-black", textStrong(theme))}>{item.price}</div>
      <div className={cx("text-[9px] font-black uppercase tracking-[0.08em]", textMuted(theme))}>{item.change}</div>
    </div>
  );

  if (item.shape === "diamond") {
    return (
      <div className={cx("grid h-[70px] w-[70px] place-items-center rounded-[1rem] border rotate-45 shadow-xl backdrop-blur-xl", toneClasses(item.tone, theme))}>
        <div className="-rotate-45">{content}</div>
      </div>
    );
  }

  return (
    <div className={cx("grid min-w-[86px] place-items-center border px-2.5 py-2 shadow-xl backdrop-blur-xl", item.shape === "hex" ? "hex-clip rounded-[1rem]" : "rounded-[1rem]", toneClasses(item.tone, theme))}>
      {content}
    </div>
  );
}

function CentralIntelligenceMesh({ theme }: { theme: ThemeMode }) {
  const { quotes, quoteStatus } = useMarketQuotes();

  return (
    <Card className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] p-3" theme={theme}>
      <div className="flex items-end justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-400">Advisor operating intelligence</div>
          <h2 className={cx("mt-1 truncate text-2xl font-black leading-none", textStrong(theme))}>Slice operating core</h2>
          <p className={cx("mt-1 max-w-4xl truncate text-xs font-semibold leading-5", textMuted(theme))}>
            Centered client, market, AI, and team workflow around the Slice core.
          </p>
        </div>
        <Pill tone={quoteStatus === "Market feed live" ? "green" : "red"} theme={theme}>{quoteStatus}</Pill>
      </div>

      <div className="relative mt-3 min-h-0 overflow-hidden rounded-[2rem] border border-white/10 bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.035),transparent_56%),linear-gradient(180deg,rgba(255,255,255,0.02),transparent)]">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(239,68,68,0.15),transparent_34%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(255,90,0,0.08),transparent_46%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_50%,rgba(6,182,212,0.055),transparent_56%)]" />

        <div className="mesh-stage absolute left-1/2 top-1/2 aspect-square -translate-x-1/2 -translate-y-1/2">
          <div className="absolute left-1/2 top-1/2 h-[96%] w-[96%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-white/10 pulse-ring pulse-ring-1" />
          <div className="absolute left-1/2 top-1/2 h-[74%] w-[74%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-500/20 pulse-ring pulse-ring-2" />
          <div className="absolute left-1/2 top-1/2 h-[52%] w-[52%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-500/20 pulse-ring pulse-ring-3" />

          <div className="absolute inset-[9%] orbit-slow">
            {ORBIT_NODES.map((item) => (
              <div key={item.label} className="absolute -translate-x-1/2 -translate-y-1/2 orbit-counter" style={{ top: item.top, left: item.left }}>
                <div className={cx(item.width, "border shadow-xl backdrop-blur-xl", shapeClass(item.shape), toneClasses(item.tone, theme), item.shape === "diamond" ? "p-0" : "px-3 py-2")}>
                  {item.shape === "diamond" ? (
                    <div className={cx("grid h-[70px] w-[70px] place-items-center p-2", innerShapeReset(item.shape))}>
                      <div className="text-center">
                        <div className={cx("truncate text-[10px] font-black", textStrong(theme))}>{item.label}</div>
                        <div className={cx("mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em]", textMuted(theme))}>{item.sublabel}</div>
                      </div>
                    </div>
                  ) : item.shape === "ring" ? (
                    <div className="grid h-[84px] w-[84px] place-items-center rounded-full border border-white/10">
                      <div className="text-center">
                        <div className={cx("text-[10px] font-black", textStrong(theme))}>{item.label}</div>
                        <div className={cx("mt-0.5 text-[8px] font-bold uppercase tracking-[0.08em]", textMuted(theme))}>{item.sublabel}</div>
                      </div>
                    </div>
                  ) : (
                    <div className="text-center">
                      <div className={cx("truncate text-[10px] font-black", textStrong(theme))}>{item.label}</div>
                      <div className={cx("mt-0.5 truncate text-[8px] font-bold uppercase tracking-[0.08em]", textMuted(theme))}>{item.sublabel}</div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>

          <div className="absolute inset-[2%] orbit-fast">
            {quotes.map((item) => (
              <div key={item.symbol} className="absolute -translate-x-1/2 -translate-y-1/2 orbit-counter" style={{ top: item.top, left: item.left }}>
                <QuoteCard item={item} theme={theme} />
              </div>
            ))}
          </div>

          <div className="comet-track absolute left-[-22%] top-1/2 h-8 w-[145%] -translate-y-1/2">
            <div className="comet-core">
              <span>FOCUS</span>
            </div>
          </div>

          <div className="absolute left-1/2 top-1/2 h-[30%] w-[30%] -translate-x-1/2 -translate-y-1/2">
            <div className="mesh-core core-heartbeat absolute inset-0" />
            <div className="absolute inset-[9px] rounded-full border border-white/10 bg-black/50 backdrop-blur-xl" />

            <div className="absolute inset-[18px] grid place-items-center rounded-full bg-gradient-to-br from-red-700/85 via-red-950/95 to-black shadow-[0_0_60px_rgba(239,68,68,0.42)]">
              <div className="absolute inset-[13px] rounded-full border border-red-500/20" />

              <div className="core-logo-shell relative grid place-items-center rounded-[2.2rem] border border-white/10 bg-gradient-to-br from-red-950 via-black to-red-700 shadow-2xl shadow-red-950/50">
                <div className="absolute inset-[8px] rounded-[1.7rem] border border-white/10" />
                <div className="core-logo-letter relative grid place-items-center rounded-full bg-gradient-to-br from-red-500 via-red-700 to-red-950 text-4xl font-black text-white shadow-xl shadow-red-950/60">
                  S
                </div>
              </div>

              <div className="mt-2 text-center">
                <div className="text-sm font-black text-white">Slice Core</div>
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-red-200">Advisor OS</div>
              </div>
            </div>
          </div>
        </div>

        <div className="absolute inset-x-4 bottom-4 grid gap-2 md:grid-cols-4">
          {[
            ["Client", "Profiles • Requests"],
            ["Market", "Board • Watchlists"],
            ["AI", "Prep • Summaries"],
            ["Execution", "Team • Compliance"],
          ].map(([title, label]) => (
            <div key={title} className={cx("rounded-2xl border px-3 py-2", blackGlass(theme))}>
              <div className={cx("text-xs font-black", textStrong(theme))}>{title}</div>
              <div className={cx("truncate text-[9px] font-black uppercase tracking-[0.12em]", textFaint(theme))}>{label}</div>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function DashboardOverview({
  theme,
  invites,
  setInvites,
  userName,
}: {
  theme: ThemeMode;
  invites: TeamInvite[];
  setInvites: Dispatch<SetStateAction<TeamInvite[]>>;
  userName: string;
}) {
  return (
    <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_315px]">
      <div className="grid min-h-0 grid-rows-[124px_minmax(0,1fr)] gap-3">
        <HeroCard theme={theme} userName={userName} />
        <CentralIntelligenceMesh theme={theme} />
      </div>

      <div className="grid min-h-0 grid-rows-[auto_auto] gap-3">
        <TeamInvitePanel theme={theme} invites={invites} setInvites={setInvites} />
        <PulseQueue theme={theme} />
      </div>
    </div>
  );
}

function WatchlistsOutlet({
  items,
  setItems,
  theme,
}: {
  items: WatchItem[];
  setItems: Dispatch<SetStateAction<WatchItem[]>>;
  theme: ThemeMode;
}) {
  const [symbol, setSymbol] = useState("");
  const [constraint, setConstraint] = useState("Notify above");
  const [targetValue, setTargetValue] = useState("");
  const [note, setNote] = useState("");

  function addItem() {
    const cleanSymbol = symbol.trim().toUpperCase();
    if (!cleanSymbol) return;

    const nextItem: WatchItem = {
      id: `watch-${cleanSymbol}-${Date.now()}`,
      symbol: cleanSymbol,
      name: cleanSymbol,
      constraint,
      targetValue: targetValue.trim() || "Set target",
      note: note.trim() || "Advisor-defined watch condition",
      source: "Manual",
    };

    setItems((current) => {
      const next = [nextItem, ...current.filter((item) => item.symbol !== cleanSymbol)];
      saveWatchlist(next);
      return next;
    });

    setSymbol("");
    setTargetValue("");
    setNote("");
  }

  function removeItem(id: string) {
    setItems((current) => {
      const next = current.filter((item) => item.id !== id);
      saveWatchlist(next);
      return next;
    });
  }

  return (
    <div className="grid h-full min-h-0 gap-3 xl:grid-cols-[390px_minmax(0,1fr)]">
      <Card className="p-5" theme={theme}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">Watchlists</div>
            <h1 className={cx("mt-2 text-3xl font-black", textStrong(theme))}>Constraint-based monitoring</h1>
            <p className={cx("mt-2 text-sm font-semibold leading-6", textMuted(theme))}>
              Add symbols with advisor-defined constraints. Intelligence reads the same watchlist.
            </p>
          </div>
          <Pill tone="amber" theme={theme}>{items.length} watched</Pill>
        </div>

        <div className="mt-5 grid gap-3">
          <input value={symbol} onChange={(event) => setSymbol(event.target.value)} placeholder="Symbol, e.g. AAPL" className={cx("rounded-2xl border px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500", inputSurface(theme))} />
          <select value={constraint} onChange={(event) => setConstraint(event.target.value)} className={cx("rounded-2xl border px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500", inputSurface(theme))}>
            <option>Notify above</option>
            <option>Notify below</option>
            <option>Notify move</option>
            <option>Watch volume spike</option>
            <option>Review weekly</option>
          </select>
          <input value={targetValue} onChange={(event) => setTargetValue(event.target.value)} placeholder="Constraint target, e.g. 195 or ±4%" className={cx("rounded-2xl border px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500", inputSurface(theme))} />
          <textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="Advisor note" rows={3} className={cx("resize-none rounded-2xl border px-4 py-3 text-sm font-bold outline-none focus:ring-2 focus:ring-red-500", inputSurface(theme))} />
          <ActionButton onClick={addItem} tone="amber" theme={theme}>Add Watch Item</ActionButton>
          <LinkButton href="/workspace/intelligence" tone="red" variant="soft" theme={theme}>Open Intelligence</LinkButton>
        </div>
      </Card>

      <Card className="min-h-0 p-5" theme={theme}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">Active watch items</div>
            <h2 className={cx("mt-2 text-2xl font-black", textStrong(theme))}>Advisor monitoring queue</h2>
          </div>
          <Pill tone="green" theme={theme}>Shared with Intelligence</Pill>
        </div>

        <div className="mt-5 grid max-h-[calc(100vh-245px)] gap-3 overflow-y-auto pr-1">
          {items.map((item) => (
            <div key={item.id} className={cx("rounded-3xl border p-4", blackGlass(theme))}>
              <div className="flex items-start justify-between gap-4">
                <div>
                  <div className={cx("text-2xl font-black", textStrong(theme))}>{item.symbol}</div>
                  <div className={cx("text-sm font-semibold", textFaint(theme))}>{item.name}</div>
                </div>
                <Pill tone={item.source === "Custom Board" ? "cyan" : "amber"} theme={theme}>{item.source}</Pill>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-3">
                <div className={cx("rounded-2xl border p-3", blackGlass(theme))}>
                  <div className={cx("text-[10px] font-black uppercase tracking-[0.12em]", textFaint(theme))}>Constraint</div>
                  <div className={cx("mt-1 text-sm font-black", textStrong(theme))}>{item.constraint}</div>
                </div>
                <div className={cx("rounded-2xl border p-3", blackGlass(theme))}>
                  <div className={cx("text-[10px] font-black uppercase tracking-[0.12em]", textFaint(theme))}>Target</div>
                  <div className={cx("mt-1 text-sm font-black", textStrong(theme))}>{item.targetValue}</div>
                </div>
                <div className={cx("rounded-2xl border p-3", blackGlass(theme))}>
                  <div className={cx("text-[10px] font-black uppercase tracking-[0.12em]", textFaint(theme))}>Status</div>
                  <div className={cx("mt-1 text-sm font-black", textStrong(theme))}>Watching</div>
                </div>
              </div>

              <p className={cx("mt-3 text-sm font-semibold leading-6", textMuted(theme))}>{item.note}</p>

              <div className="mt-4 flex gap-2">
                <LinkButton href={`/workspace/custom-board?symbol=${encodeURIComponent(item.symbol)}`} tone="cyan" variant="soft" theme={theme}>Analyze</LinkButton>
                <LinkButton href={`/workspace/intelligence?symbol=${encodeURIComponent(item.symbol)}`} tone="red" variant="soft" theme={theme}>Intel</LinkButton>
                <button
                  type="button"
                  onClick={() => removeItem(item.id)}
                  className={cx("rounded-2xl border px-4 py-3 text-sm font-black transition hover:bg-red-500/10 hover:text-red-100", isLightTheme(theme) ? "border-slate-200 bg-white text-slate-600" : "border-white/10 bg-white/[0.04] text-slate-300")}
                >
                  Remove
                </button>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

function buildSuggestions(): SearchSuggestion[] {
  const toolSuggestions: SearchSuggestion[] = WORKSPACE_TOOLS.map((tool) => ({
    id: `tool-${tool.id}`,
    title: tool.label,
    detail: tool.description,
    badge: tool.category,
    icon: tool.icon,
    tone: tool.tone,
    action: tool.target,
    keywords: [
      tool.label,
      tool.shortLabel,
      tool.subtitle,
      tool.description,
      tool.category,
      tool.routeLabel,
      tool.outcome,
      tool.differentiator,
      ...tool.tags,
    ],
  }));

  return [
    ...toolSuggestions,
    {
      id: "mode-guided",
      title: "Switch to Guided Mode",
      detail: "Cleanest advisor view.",
      badge: "Mode",
      icon: "light",
      tone: "green",
      action: { type: "mode", mode: "guided" },
      keywords: ["guided", "simple", "clean", "easy"],
    },
    {
      id: "mode-power",
      title: "Switch to Power Mode",
      detail: "Denser view for fast navigation.",
      badge: "Mode",
      icon: "command",
      tone: "red",
      action: { type: "mode", mode: "power" },
      keywords: ["power", "advanced", "dense"],
    },
    {
      id: "role-founder",
      title: "Switch Role to Founder",
      detail: "Founder-level operating view.",
      badge: "Role",
      icon: "star",
      tone: "red",
      action: { type: "role", role: "Founder" },
      keywords: ["founder", "owner", "admin"],
    },
  ];
}

function AmbientPlasmaBlob() {
  return (
    <>
      <Link
        href="/workspace/personal-bot?mode=studio"
        prefetch={false}
        aria-label="Open AI Studio"
        title="Open AI Studio"
        className="fixed bottom-6 right-6 z-[50] block h-[78px] w-[78px] transition hover:scale-105"
      >
        <div className="plasma-chaos absolute inset-0" />
        <div className="plasma-chaos-2 absolute inset-[6px]" />
        <div className="plasma-chaos-3 absolute inset-[14px]" />
        <div className="absolute inset-0 grid place-items-center">
          <span className="text-[9px] font-black uppercase tracking-[0.16em] text-white/90 drop-shadow-[0_0_12px_rgba(255,255,255,0.45)]">AI</span>
        </div>
      </Link>

      <style jsx global>{`
        .hex-clip {
          clip-path: polygon(18% 0%, 82% 0%, 100% 50%, 82% 100%, 18% 100%, 0% 50%);
        }

        .mesh-stage {
          width: min(94%, 760px);
          max-height: 100%;
        }

        .core-logo-shell {
          width: clamp(82px, 42%, 116px);
          aspect-ratio: 1 / 1;
        }

        .core-logo-letter {
          width: 62%;
          aspect-ratio: 1 / 1;
        }

        @media (max-height: 820px) {
          .mesh-stage {
            width: min(86%, 620px);
          }
        }

        @media (max-height: 760px) {
          .core-logo-shell {
            width: clamp(72px, 40%, 96px);
          }

          .core-logo-letter {
            width: 60%;
          }
        }

        @media (max-height: 720px) {
          .mesh-stage {
            width: min(78%, 520px);
          }
        }

        @keyframes chaosMorphA {
          0% {
            border-radius: 46% 54% 39% 61% / 60% 43% 57% 40%;
            transform: rotate(0deg) scale(1);
          }
          20% {
            border-radius: 58% 42% 52% 48% / 36% 64% 36% 64%;
            transform: rotate(75deg) scale(1.05);
          }
          40% {
            border-radius: 38% 62% 47% 53% / 54% 36% 64% 46%;
            transform: rotate(145deg) scale(0.95);
          }
          60% {
            border-radius: 62% 38% 55% 45% / 48% 60% 40% 52%;
            transform: rotate(220deg) scale(1.08);
          }
          80% {
            border-radius: 43% 57% 58% 42% / 62% 38% 58% 42%;
            transform: rotate(290deg) scale(0.98);
          }
          100% {
            border-radius: 46% 54% 39% 61% / 60% 43% 57% 40%;
            transform: rotate(360deg) scale(1);
          }
        }

        @keyframes chaosMorphB {
          0%,
          100% {
            opacity: 0.75;
            transform: scale(0.9);
          }
          50% {
            opacity: 1;
            transform: scale(1.1);
          }
        }

        @keyframes chaosHue {
          0% {
            filter: hue-rotate(0deg) saturate(1.15);
          }
          30% {
            filter: hue-rotate(28deg) saturate(1.35);
          }
          60% {
            filter: hue-rotate(58deg) saturate(1.45);
          }
          100% {
            filter: hue-rotate(0deg) saturate(1.15);
          }
        }

        .plasma-chaos {
          border-radius: 46% 54% 39% 61% / 60% 43% 57% 40%;
          background:
            radial-gradient(circle at 24% 22%, rgba(255, 239, 182, 0.96), transparent 18%),
            radial-gradient(circle at 74% 28%, rgba(255, 94, 0, 0.92), transparent 21%),
            radial-gradient(circle at 68% 74%, rgba(255, 0, 111, 0.75), transparent 25%),
            radial-gradient(circle at 36% 72%, rgba(255, 170, 0, 0.58), transparent 22%),
            conic-gradient(
              from 90deg,
              rgba(29, 0, 0, 0.94),
              rgba(255, 41, 0, 0.74),
              rgba(255, 143, 0, 0.62),
              rgba(188, 0, 56, 0.78),
              rgba(29, 0, 0, 0.94)
            );
          animation: chaosMorphA 8.5s linear infinite, chaosHue 11s ease-in-out infinite;
          box-shadow:
            0 0 24px rgba(255, 70, 0, 0.42),
            0 0 60px rgba(255, 0, 70, 0.2);
        }

        .plasma-chaos-2 {
          border-radius: 58% 42% 53% 47% / 35% 62% 38% 65%;
          background:
            radial-gradient(circle at 42% 40%, rgba(255, 255, 255, 0.35), transparent 15%),
            radial-gradient(circle at 62% 55%, rgba(255, 115, 0, 0.82), transparent 24%),
            linear-gradient(135deg, rgba(123, 0, 0, 0.62), rgba(255, 90, 0, 0.44));
          mix-blend-mode: screen;
          animation: chaosMorphA 5.9s linear infinite reverse, chaosMorphB 3.2s ease-in-out infinite;
        }

        .plasma-chaos-3 {
          border-radius: 62% 38% 49% 51% / 44% 60% 40% 56%;
          background:
            radial-gradient(circle, rgba(255, 244, 196, 0.96) 0%, rgba(255, 136, 0, 0.88) 34%, rgba(132, 0, 0, 0.72) 76%);
          animation: chaosMorphA 4.8s linear infinite, chaosHue 8s ease-in-out infinite reverse;
          box-shadow: 0 0 18px rgba(255, 176, 0, 0.55);
        }

        @keyframes orbitSlow {
          0% {
            transform: rotate(0deg);
          }
          100% {
            transform: rotate(360deg);
          }
        }

        @keyframes orbitFast {
          0% {
            transform: rotate(360deg);
          }
          100% {
            transform: rotate(0deg);
          }
        }

        @keyframes orbitCounter {
          0% {
            transform: translate(-50%, -50%) rotate(0deg);
          }
          100% {
            transform: translate(-50%, -50%) rotate(-360deg);
          }
        }

        @keyframes meshGlow {
          0%,
          100% {
            box-shadow:
              0 0 42px rgba(239, 68, 68, 0.18),
              0 0 95px rgba(239, 68, 68, 0.06);
          }
          50% {
            box-shadow:
              0 0 76px rgba(239, 68, 68, 0.34),
              0 0 130px rgba(6, 182, 212, 0.11);
          }
        }

        @keyframes coreHeartbeat {
          0%,
          100% {
            transform: scale(1);
            filter: saturate(1);
            box-shadow:
              0 0 34px rgba(248, 113, 113, 0.22),
              0 0 82px rgba(239, 68, 68, 0.12);
          }
          14% {
            transform: scale(1.035);
            filter: saturate(1.35);
            box-shadow:
              0 0 54px rgba(248, 113, 113, 0.52),
              0 0 132px rgba(239, 68, 68, 0.24);
          }
          28% {
            transform: scale(0.992);
            filter: saturate(1.08);
            box-shadow:
              0 0 38px rgba(248, 113, 113, 0.32),
              0 0 92px rgba(239, 68, 68, 0.16);
          }
          42% {
            transform: scale(1.022);
            filter: saturate(1.22);
            box-shadow:
              0 0 48px rgba(248, 113, 113, 0.42),
              0 0 116px rgba(239, 68, 68, 0.22);
          }
          60% {
            transform: scale(1);
            filter: saturate(1);
          }
        }

        @keyframes pulseRingA {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.8;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.025);
            opacity: 1;
          }
        }

        @keyframes pulseRingB {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.45;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.055);
            opacity: 0.9;
          }
        }

        @keyframes pulseRingC {
          0%,
          100% {
            transform: translate(-50%, -50%) scale(1);
            opacity: 0.45;
          }
          50% {
            transform: translate(-50%, -50%) scale(1.085);
            opacity: 0.88;
          }
        }

        @keyframes cometFly {
          0% {
            transform: translateX(-25%) translateY(-50%) rotate(-8deg);
            opacity: 0;
          }
          8% {
            opacity: 1;
          }
          42% {
            opacity: 1;
          }
          55% {
            transform: translateX(70%) translateY(-50%) rotate(-8deg);
            opacity: 0;
          }
          100% {
            transform: translateX(70%) translateY(-50%) rotate(-8deg);
            opacity: 0;
          }
        }

        .orbit-slow {
          animation: orbitSlow 36s linear infinite;
          transform-origin: center center;
        }

        .orbit-fast {
          animation: orbitFast 24s linear infinite;
          transform-origin: center center;
        }

        .orbit-counter {
          animation: orbitCounter 36s linear infinite;
          transform-origin: center center;
        }

        .pulse-ring-1 {
          animation: pulseRingA 4.6s ease-in-out infinite;
        }

        .pulse-ring-2 {
          animation: pulseRingB 5.2s ease-in-out infinite;
        }

        .pulse-ring-3 {
          animation: pulseRingC 5.8s ease-in-out infinite;
        }

        .mesh-core {
          position: absolute;
          inset: 0;
          border-radius: 9999px;
          background:
            radial-gradient(circle at 30% 30%, rgba(255, 210, 160, 0.92), transparent 18%),
            radial-gradient(circle at 70% 35%, rgba(255, 80, 0, 0.72), transparent 24%),
            radial-gradient(circle at 50% 70%, rgba(255, 0, 72, 0.46), transparent 28%),
            conic-gradient(
              from 90deg,
              rgba(30, 0, 0, 0.9),
              rgba(239, 68, 68, 0.7),
              rgba(255, 120, 0, 0.3),
              rgba(30, 0, 0, 0.9)
            );
          animation: meshGlow 4.2s ease-in-out infinite;
        }

        .core-heartbeat {
          animation: meshGlow 4.2s ease-in-out infinite, coreHeartbeat 2.6s ease-in-out infinite;
          transform-origin: center center;
        }

        .comet-track {
          animation: cometFly 6.5s cubic-bezier(0.2, 0.7, 0.18, 1) infinite;
        }

        .comet-core {
          position: absolute;
          left: 0;
          top: 50%;
          display: flex;
          align-items: center;
          gap: 8px;
          transform: translateY(-50%);
          color: white;
          font-size: 10px;
          font-weight: 900;
          letter-spacing: 0.18em;
          text-transform: uppercase;
          text-shadow: 0 0 14px rgba(255, 255, 255, 0.8);
        }

        .comet-core::before {
          content: "";
          display: block;
          width: 220px;
          height: 2px;
          border-radius: 999px;
          background: linear-gradient(90deg, transparent, rgba(255, 80, 0, 0.2), rgba(255, 255, 255, 0.9));
          box-shadow: 0 0 18px rgba(255, 80, 0, 0.7);
        }

        .comet-core::after {
          content: "";
          display: block;
          width: 11px;
          height: 11px;
          border-radius: 999px;
          background: white;
          box-shadow:
            0 0 10px rgba(255, 255, 255, 0.9),
            0 0 30px rgba(255, 80, 0, 0.9),
            0 0 50px rgba(239, 68, 68, 0.7);
        }
      `}</style>
    </>
  );
}

export default function WorkspacePage() {
  const [activeOutlet, setActiveOutlet] = useState<OutletId>("overview");
  const [theme, setTheme] = useState<ThemeMode>("dark");
  const [mode, setMode] = useState<WorkspaceMode>("guided");
  const [role, setRole] = useState<AdvisorRole>("Founder");
  const [commandText, setCommandText] = useState("");
  const [commandOpen, setCommandOpen] = useState(false);
  const [selectedSuggestionIndex, setSelectedSuggestionIndex] = useState(0);
  const [watchItems, setWatchItems] = useState<WatchItem[]>(DEFAULT_WATCHLIST);
  const [invites, setInvites] = useState<TeamInvite[]>([]);
  const [userName, setUserName] = useState("Advisor");

  const allSuggestions = useMemo(() => buildSuggestions(), []);

  const suggestions = useMemo(() => {
    const query = commandText.trim().toLowerCase();

    if (!query) return allSuggestions.slice(0, 8);

    return allSuggestions
      .map((suggestion) => {
        const haystack = [suggestion.title, suggestion.detail, suggestion.badge, ...suggestion.keywords]
          .join(" ")
          .toLowerCase();

        let score = 0;
        if (suggestion.title.toLowerCase().startsWith(query)) score += 100;
        if (suggestion.title.toLowerCase().includes(query)) score += 70;
        if (haystack.includes(query)) score += 40;

        const words = query.split(/\s+/).filter(Boolean);
        score += words.filter((word) => haystack.includes(word)).length * 12;

        return { suggestion, score };
      })
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score)
      .map((item) => item.suggestion)
      .slice(0, 10);
  }, [allSuggestions, commandText]);

  useEffect(() => {
    function syncTheme() {
      const storedTheme = window.localStorage.getItem(THEME_KEY);
      if (storedTheme === "light" || storedTheme === "dark") {
        setTheme(storedTheme);
        document.documentElement.dataset.sliceTheme = storedTheme;
      }
    }

    syncTheme();
    window.addEventListener("storage", syncTheme);
    window.addEventListener("slice-theme-change", syncTheme);

    return () => {
      window.removeEventListener("storage", syncTheme);
      window.removeEventListener("slice-theme-change", syncTheme);
    };
  }, []);

  useEffect(() => {
    try {
      setUserName(deriveAdvisorName());

      const params = new URLSearchParams(window.location.search);
      const tab = params.get("tab");
      const addSymbol = params.get("addSymbol") ?? params.get("symbol");

      if (tab === "watchlists") setActiveOutlet(tab);

      const savedOutlet = window.localStorage.getItem(OUTLET_KEY) as OutletId | null;
      const savedWatchlist = window.localStorage.getItem(WATCHLIST_KEY);
      const savedInvites = loadJson<TeamInvite[]>(TEAM_INVITES_KEY, []);

      setInvites(savedInvites);

      if (!tab && savedOutlet && ["overview", "watchlists"].includes(savedOutlet)) {
        setActiveOutlet(savedOutlet);
      }

      if (savedWatchlist) {
        const parsed = JSON.parse(savedWatchlist);
        if (Array.isArray(parsed)) setWatchItems(parsed);
      }

      if (addSymbol) {
        const cleanSymbol = addSymbol.trim().toUpperCase();
        const nextItem: WatchItem = {
          id: `watch-${cleanSymbol}-${Date.now()}`,
          symbol: cleanSymbol,
          name: cleanSymbol,
          constraint: "Review from Custom Board",
          targetValue: "Advisor set",
          note: "Added from Custom Board route handoff.",
          source: "Custom Board",
        };

        setWatchItems((current) => {
          const next = [nextItem, ...current.filter((item) => item.symbol !== cleanSymbol)];
          saveWatchlist(next);
          return next;
        });

        setActiveOutlet("watchlists");
      }
    } catch {
      setActiveOutlet("overview");
    }
  }, []);

  useEffect(() => {
    window.localStorage.setItem(OUTLET_KEY, activeOutlet);
  }, [activeOutlet]);

  useEffect(() => {
    setSelectedSuggestionIndex(0);
  }, [commandText]);

  function setOutlet(outlet: OutletId) {
    setActiveOutlet(outlet);
    const url = new URL(window.location.href);
    url.searchParams.set("tab", outlet);
    window.history.pushState({ outlet }, "", url.toString());
  }

  function openTarget(target: ActionTarget) {
    if (target.type === "route") {
      window.location.href = target.href;
      return;
    }

    if (target.type === "outlet") {
      setOutlet(target.outlet);
      return;
    }

    if (target.type === "mode") {
      setMode(target.mode);
      return;
    }

    if (target.type === "role") {
      setRole(target.role);
      return;
    }

    if (target.type === "search") {
      setCommandText(target.query);
      setCommandOpen(true);
    }
  }

  function executeSuggestion(suggestion: SearchSuggestion) {
    openTarget(suggestion.action);
    setCommandText("");
    setCommandOpen(false);
  }

  function runCommand() {
    const selected = suggestions[selectedSuggestionIndex];
    if (selected) executeSuggestion(selected);
  }

  return (
    <main className={cx("h-screen overflow-hidden", isLightTheme(theme) ? "bg-red-50 text-slate-950" : "bg-[#050202] text-white")}>
      <div className="pointer-events-none fixed inset-0">
        {isLightTheme(theme) ? (
          <>
            <div className="absolute left-[-18%] top-[-18%] h-[36rem] w-[36rem] rounded-full bg-red-200/70 blur-3xl" />
            <div className="absolute right-[-16%] top-[10%] h-[34rem] w-[34rem] rounded-full bg-orange-100/80 blur-3xl" />
            <div className="absolute bottom-[-20%] left-[30%] h-[30rem] w-[30rem] rounded-full bg-sky-200/70 blur-3xl" />
            <div className="absolute inset-0 bg-[linear-gradient(rgba(239,68,68,0.12)_1px,transparent_1px),linear-gradient(90deg,rgba(239,68,68,0.12)_1px,transparent_1px)] bg-[size:44px_44px]" />
          </>
        ) : (
          <>
            <div className="absolute left-[-18%] top-[-18%] h-[38rem] w-[38rem] rounded-full bg-red-700/30 blur-3xl" />
            <div className="absolute right-[-16%] top-[10%] h-[34rem] w-[34rem] rounded-full bg-orange-600/12 blur-3xl" />
            <div className="absolute bottom-[-20%] left-[30%] h-[30rem] w-[30rem] rounded-full bg-red-500/15 blur-3xl" />
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(255,70,0,0.11),transparent_36%),linear-gradient(rgba(255,255,255,0.026)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.026)_1px,transparent_1px)] bg-[size:100%_100%,44px_44px,44px_44px]" />
          </>
        )}
      </div>

      <div className="relative grid h-screen min-h-0 grid-cols-1 lg:grid-cols-[268px_minmax(0,1fr)]">
        <Sidebar activeOutlet={activeOutlet} onOpenTarget={openTarget} theme={theme} />

        <section className="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3 p-3">
          <header className={cx("rounded-[1.65rem] border p-3 shadow-2xl backdrop-blur-xl", surface(theme))}>
            <div className="grid gap-3 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-center">
              <div className="grid gap-2 md:grid-cols-4">
                <div className={cx("rounded-2xl border px-4 py-2.5", tintSurface(theme))}>
                  <div className={cx("text-[10px] font-black uppercase tracking-[0.16em]", textFaint(theme))}>Role</div>
                  <div className={cx("mt-1 truncate text-xs font-black", textStrong(theme))}>{role}</div>
                </div>

                <div className={cx("rounded-2xl border px-4 py-2.5", tintSurface(theme))}>
                  <div className={cx("text-[10px] font-black uppercase tracking-[0.16em]", textFaint(theme))}>Mode</div>
                  <div className={cx("mt-1 truncate text-xs font-black", textStrong(theme))}>{mode}</div>
                </div>

                <div className={cx("rounded-2xl border px-4 py-2.5", tintSurface(theme))}>
                  <div className={cx("text-[10px] font-black uppercase tracking-[0.16em]", textFaint(theme))}>Invites</div>
                  <div className={cx("mt-1 truncate text-xs font-black", textStrong(theme))}>{invites.length} sent</div>
                </div>

                <div className={cx("rounded-2xl border px-4 py-2.5", tintSurface(theme))}>
                  <div className={cx("text-[10px] font-black uppercase tracking-[0.16em]", textFaint(theme))}>Outlet</div>
                  <div className={cx("mt-1 truncate text-xs font-black", textStrong(theme))}>{activeOutlet}</div>
                </div>
              </div>

              <CommandPulldown
                commandText={commandText}
                setCommandText={setCommandText}
                suggestions={suggestions}
                selectedIndex={selectedSuggestionIndex}
                setSelectedIndex={setSelectedSuggestionIndex}
                isOpen={commandOpen}
                setIsOpen={setCommandOpen}
                executeSuggestion={executeSuggestion}
                runCommand={runCommand}
                theme={theme}
              />
            </div>
          </header>

          <div className="min-h-0 overflow-hidden">
            {activeOutlet === "overview" ? (
              <DashboardOverview theme={theme} invites={invites} setInvites={setInvites} userName={userName} />
            ) : null}

            {activeOutlet === "watchlists" ? (
              <WatchlistsOutlet items={watchItems} setItems={setWatchItems} theme={theme} />
            ) : null}
          </div>
        </section>
      </div>

      <AmbientPlasmaBlob />
    </main>
  );
}