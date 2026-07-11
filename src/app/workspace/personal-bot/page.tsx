"use client";

import Link from "next/link";
import type { CSSProperties, FormEvent, KeyboardEvent, ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import { BrandMark } from "@/components/slice-ui";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";
type StudioTab = "command" | "voice" | "tasks" | "reports" | "settings";
type AnswerMode = "quick" | "balanced" | "deep";
type Priority = "Critical" | "High" | "Medium" | "Low";
type TaskStatus = "Backlog" | "To Do" | "In Progress" | "Review" | "Blocked" | "Complete";

type ClientAction = {
  type?: string;
  href?: string;
  autoRun?: boolean;
};

type BotMessage = {
  id: string;
  role: string;
  content: string;
  intent: string;
  createdAt: string;
  metadata?: {
    clientAction?: ClientAction;
    answerMode?: AnswerMode;
    universalAiProvider?: string;
    universalAiStatus?: string;
    universalAiError?: string;
    universalAiModel?: string;
    universalAiConfigured?: boolean;
    universalAiLatencyMs?: number;
    spokenAccent?: string;
    reportError?: string | null;
  };
};

type BotCommand = {
  id: string;
  commandText: string;
  commandType: string;
  status: string;
  resultSummary: string | null;
  createdAt: string;
  action?: Record<string, unknown>;
};

type ReportSection = {
  title?: string;
  body?: string;
  bullets?: string[];
};

type ReportMetric = {
  label?: string;
  value?: string | number;
  helper?: string;
  tone?: Tone;
};

type PdfReport = {
  id: string;
  title: string;
  reportType: string;
  status: string;
  downloadUrl: string;
  createdAt?: string;
  summary?: string;
  sections?: ReportSection[];
  design?: {
    generatedBy?: string;
    preparedFor?: string;
    investmentGrade?: string;
    confidenceScore?: number;
    metrics?: ReportMetric[];
    charts?: Array<{
      title?: string;
      subtitle?: string;
      data?: Array<{ label?: string; value?: number }>;
    }>;
  };
};

type BotPayload = {
  profile: {
    id: string;
    botName: string;
    onboardingComplete: boolean;
    preferredTone: string;
    commandStyle: string;
    autonomyLevel: string;
    voiceEnabled: boolean;
    customInstructions: string | null;
    personality: Record<string, unknown>;
    risk: Record<string, unknown>;
    capabilities: string[];
    spokenAccent?: string;
    speechLanguage?: string;
  };
  aiEngine?: {
    provider: string;
    configured: boolean;
    model: string;
    qualityModel?: string;
    structuredCommands: boolean;
    universalAnswers?: boolean;
    approvalGates: boolean;
    platformBrain?: boolean;
    voiceLearning?: boolean;
    webSearchEnabled?: boolean;
    spokenAccent?: string;
    speechLanguage?: string;
    requiredEnv?: string;
    timeoutPolicy?: {
      quickMs: number;
      balancedMs: number;
      deepMs: number;
    };
  };
  messages: BotMessage[];
  commands: BotCommand[];
  tabs: Array<{
    id: string;
    tabName: string;
    notes: string | null;
    pinnedCommands: string[];
    status: string;
  }>;
  pdfReports?: PdfReport[];
  memories?: Array<{
    id: string;
    memoryType: string;
    title: string;
    value: string;
    confidenceScore: number;
    status: string;
  }>;
  approvals?: Array<{
    id: string;
    title: string;
    actionType: string;
    riskLevel: string;
    summary: string;
    status: string;
  }>;
  backendApprovals?: Array<{
    id: string;
    title: string;
    actionType: string;
    riskLevel: string;
    summary: string;
    status: string;
  }>;
};

type FirmWorkspacePayload = {
  firm: {
    id: string;
    name: string;
    firmEmail?: string | null;
  } | null;
  membership: {
    id: string;
    userId: string;
    role: string;
    canManageProjects: boolean;
    canManageFirm: boolean;
  } | null;
  members: Array<{
    id: string;
    firmId: string;
    userId: string;
    role: string;
    status: string;
    calendarColor: string;
    user?: {
      id: string;
      name: string;
      email: string;
    };
  }>;
  projects: Array<{
    id: string;
    title: string;
    description?: string | null;
    status: string;
    priority: string;
    dueDate?: string | null;
  }>;
  operations?: {
    allTasks: Array<{
      id: string;
      title: string;
      detail?: string | null;
      status: string;
      priority: string;
      dueDate?: string | null;
      ownerName?: string;
    }>;
    sprintMetrics?: {
      total: number;
      open: number;
      inProgress: number;
      review: number;
      blocked: number;
      complete: number;
      overdue: number;
      ideas: number;
      deadlines: number;
      timedReminders: number;
    };
  };
  emailResult?: {
    status: string;
    reason: string;
    simulated: boolean;
  };
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
  confidence?: number;
};

type SpeechRecognitionResultLike = {
  0?: SpeechRecognitionAlternativeLike;
  isFinal?: boolean;
};

type SpeechRecognitionEventLike = {
  resultIndex?: number;
  results: ArrayLike<SpeechRecognitionResultLike>;
};

type SpeechRecognitionInstance = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  start: () => void;
  stop: () => void;
  abort?: () => void;
  onstart: (() => void) | null;
  onresult: ((event: SpeechRecognitionEventLike) => void) | null;
  onend: (() => void) | null;
  onerror: ((event?: unknown) => void) | null;
};

type SpeechRecognitionConstructor = new () => SpeechRecognitionInstance;

type TeamTaskDraft = {
  title: string;
  detail: string;
  priority: Priority;
  status: TaskStatus;
  dueDate: string;
  reminderAt: string;
  reminderNote: string;
  projectId: string;
  notifyEmail: boolean;
};

type AdvancedSettings = {
  responseLayout: "Executive Summary" | "Advisor Memo" | "Client Friendly" | "Action Plan";
  defaultAnswerMode: AnswerMode;
  compactReplies: boolean;
  autoReadReplies: boolean;
  voiceAutoSend: boolean;
  voiceLanguage: "en-US" | "en-GB" | "es-US";
  voiceRate: "Slow" | "Normal" | "Fast";
  reportStyle: "Premium Red" | "Boardroom" | "Client Clean" | "Technical";
  reportDepth: "Concise" | "Balanced" | "Full";
  includeReviewChecklist: boolean;
  includeAssumptions: boolean;
  includeRiskNotes: boolean;
  taskDefaultPriority: Priority;
  taskDefaultStatus: TaskStatus;
  taskDueDays: "Today" | "Tomorrow" | "3 Days" | "1 Week";
  taskEmailDefault: boolean;
  approvalStyle: "Advisor approval required" | "Draft only" | "Suggest only" | "Autonomous where safe";
};

type AccountSettingsPayload = {
  ok: boolean;
  account: {
    id: string;
    name: string;
    email: string;
    phone: string;
    timezone: string;
    platformStatus: string;
    createdAt: string;
  };
  appearance: {
    mode: "dark" | "light" | "system";
    density: "Comfortable" | "Compact" | "Spacious";
    accent: "Slice Red" | "Crimson" | "Ruby" | "Graphite";
  };
  privacy: {
    aiMemoryEnabled: boolean;
    analyticsEnabled: boolean;
    personalizationEnabled: boolean;
    marketingEmailsEnabled: boolean;
    shareUsageForImprovement: boolean;
    showProfileToTeam: boolean;
    retainReports: "30 days" | "90 days" | "1 year" | "Forever";
    exportFormat: "PDF" | "CSV" | "JSON";
  };
  security: {
    mfaEnabled: boolean;
    requireReauthForSensitiveActions: boolean;
    alertOnNewLogin: boolean;
    advisorModeEnabled: boolean;
    sessionTimeoutMinutes: number;
    lastSecurityReviewAt?: string | null;
  };
  notifications: Array<{
    id?: string;
    channel: string;
    enabled: boolean;
    minUrgency: string;
    minScore: number;
    digestOnly: boolean;
    quietHoursStart?: string | null;
    quietHoursEnd?: string | null;
    cooldownMinutes: number;
  }>;
  contact: {
    name: string;
    phone: string;
    phoneHref: string;
    email: string;
    emailHref: string;
  };
};

type RouteIntent = {
  label: string;
  helper: string;
  href: string;
  tone: Tone;
};

const ADVANCED_SETTINGS_KEY = "slice-ai-studio-advanced-settings-v4";

const defaultAdvancedSettings: AdvancedSettings = {
  responseLayout: "Executive Summary",
  defaultAnswerMode: "balanced",
  compactReplies: true,
  autoReadReplies: false,
  voiceAutoSend: false,
  voiceLanguage: "en-US",
  voiceRate: "Normal",
  reportStyle: "Premium Red",
  reportDepth: "Balanced",
  includeReviewChecklist: true,
  includeAssumptions: true,
  includeRiskNotes: true,
  taskDefaultPriority: "Medium",
  taskDefaultStatus: "To Do",
  taskDueDays: "Tomorrow",
  taskEmailDefault: true,
  approvalStyle: "Advisor approval required",
};

const defaultAccountSettings: AccountSettingsPayload = {
  ok: true,
  account: {
    id: "",
    name: "",
    email: "",
    phone: "",
    timezone: "America/Phoenix",
    platformStatus: "Active",
    createdAt: "",
  },
  appearance: {
    mode: "dark",
    density: "Comfortable",
    accent: "Slice Red",
  },
  privacy: {
    aiMemoryEnabled: true,
    analyticsEnabled: true,
    personalizationEnabled: true,
    marketingEmailsEnabled: false,
    shareUsageForImprovement: false,
    showProfileToTeam: true,
    retainReports: "1 year",
    exportFormat: "PDF",
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
  ],
  contact: {
    name: "Luke Royal Price",
    phone: "(985) 290-3067",
    phoneHref: "tel:+19852903067",
    email: "price.luke.royal@gmail.com",
    emailHref: "mailto:price.luke.royal@gmail.com",
  },
};

const tabs: Array<{
  id: StudioTab;
  label: string;
  helper: string;
  tone: Tone;
}> = [
  { id: "command", label: "Command", helper: "Input + reply", tone: "red" },
  { id: "voice", label: "Voice Ops", helper: "Speak outcomes", tone: "purple" },
  { id: "tasks", label: "Tasks", helper: "Assign work", tone: "green" },
  { id: "reports", label: "Reports", helper: "Reliable viewer", tone: "amber" },
  { id: "settings", label: "Settings", helper: "Customize", tone: "blue" },
];

const routeIntents: RouteIntent[] = [
  {
    label: "Market analysis",
    helper: "Custom Board",
    href: "/workspace/custom-board",
    tone: "cyan",
  },
  {
    label: "Watchlist rules",
    helper: "Watchlists",
    href: "/workspace/watchlists",
    tone: "amber",
  },
  {
    label: "Team execution",
    helper: "Team Board",
    href: "/workspace/team-board",
    tone: "green",
  },
  {
    label: "Client records",
    helper: "Client Profiles",
    href: "/workspace/clients",
    tone: "purple",
  },
  {
    label: "Client messages",
    helper: "Portal Inbox",
    href: "/workspace/client-portal-inbox",
    tone: "purple",
  },
  {
    label: "Draft email",
    helper: "Email Center",
    href: "/workspace/client-emails",
    tone: "cyan",
  },
];

const reportBlueprints = [
  "Client portfolio review packet",
  "Advisor executive summary",
  "Market volatility explanation",
  "Slice platform value report",
  "Investment scenario report",
  "Team execution recap",
];

const advancedReportBlueprints = [
  {
    title: "Client Review Packet",
    prompt:
      "Create a client portfolio review packet with executive summary, current objectives, risk discussion, recommended talking points, follow-up tasks, and advisor review checklist.",
    tone: "red" as Tone,
  },
  {
    title: "Investment Scenario",
    prompt:
      "Create an investment scenario report with base, bull, and bear case framing, assumptions, risks, client-friendly explanation, and advisor action items.",
    tone: "purple" as Tone,
  },
  {
    title: "Market Volatility",
    prompt:
      "Create a market volatility report explaining recent uncertainty in plain English, including risks, behavioral coaching notes, portfolio review questions, and compliance-conscious disclaimers.",
    tone: "amber" as Tone,
  },
  {
    title: "Executive Platform Memo",
    prompt:
      "Create an executive memo explaining the Slice platform value proposition, workflow benefits, advisor efficiency gains, implementation plan, and investor-ready talking points.",
    tone: "green" as Tone,
  },
];

const voiceExamples = [
  "Create a PDF report for tomorrow’s client meeting and include risks, assumptions, and action items.",
  "Assign Jordan a high-priority task to review the client briefing by Friday.",
  "Draft a client email explaining market volatility in plain English.",
  "Prepare a meeting plan, then create follow-up tasks for the team.",
  "Open the watchlists area and help me review high-priority symbols.",
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(days: number) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return ymd(date);
}

function dueDateFromSetting(value: AdvancedSettings["taskDueDays"]) {
  if (value === "Today") return ymd(new Date());
  if (value === "3 Days") return addDays(3);
  if (value === "1 Week") return addDays(7);
  return addDays(1);
}

function shortTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function formatTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const minutes = Math.round((Date.now() - date.getTime()) / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

function toneFor(value: string | number | null | undefined): Tone {
  const lower = String(value ?? "").toLowerCase();
  const numeric = typeof value === "number" ? value : Number.NaN;

  if (
    lower.includes("failed") ||
    lower.includes("critical") ||
    lower.includes("blocked") ||
    lower.includes("high") ||
    lower.includes("error") ||
    lower.includes("missing") ||
    (!Number.isNaN(numeric) && numeric < 35)
  ) {
    return "red";
  }

  if (
    lower.includes("complete") ||
    lower.includes("active") ||
    lower.includes("ready") ||
    lower.includes("configured") ||
    lower.includes("generated") ||
    lower.includes("delivered") ||
    lower.includes("connected") ||
    (!Number.isNaN(numeric) && numeric >= 75)
  ) {
    return "green";
  }

  if (
    lower.includes("open") ||
    lower.includes("queued") ||
    lower.includes("draft") ||
    lower.includes("pending") ||
    lower.includes("approval") ||
    lower.includes("timeout") ||
    lower.includes("review") ||
    (!Number.isNaN(numeric) && numeric >= 35 && numeric < 75)
  ) {
    return "amber";
  }

  if (lower.includes("voice") || lower.includes("bot") || lower.includes("ai")) return "purple";
  if (lower.includes("backend") || lower.includes("tool")) return "cyan";

  return "slate";
}

function modeTone(mode: AnswerMode): Tone {
  if (mode === "quick") return "cyan";
  if (mode === "deep") return "purple";
  return "green";
}

function stripForSpeech(text: string) {
  return text
    .replace(/https?:\/\/\S+/g, "source link available")
    .replace(/[`*_>#]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2200);
}

function sanitizeError(value?: string) {
  if (!value) return null;

  const lower = value.toLowerCase();

  if (lower.includes("fallback") || lower.includes("responsiveness")) {
    return "The live AI response took longer than expected. Deep Mode waits longer for fuller answers.";
  }

  return value;
}

function actionLabel(action?: ClientAction) {
  if (!action?.href) return null;
  if (action.type === "report") return "Open Report";
  if (action.type === "source") return "Open Source";
  if (action.type === "navigate") return "Open Section";
  return "Open Result";
}

function getTwoChatRecollection(messages: BotMessage[]) {
  if (messages.length <= 4) return messages;

  const chunks: BotMessage[][] = [];
  let currentChunk: BotMessage[] = [];

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const message = messages[index];
    currentChunk.unshift(message);

    if (message.role === "user") {
      chunks.unshift(currentChunk);
      currentChunk = [];

      if (chunks.length >= 2) break;
    }
  }

  const selected = chunks.flat();

  if (selected.length) return selected.slice(-4);

  return messages.slice(-4);
}

function compactBotPayload(payload: BotPayload): BotPayload {
  return {
    ...payload,
    messages: getTwoChatRecollection(payload.messages ?? []),
  };
}

function safeMemberName(member: FirmWorkspacePayload["members"][number]) {
  return member.user?.name || member.user?.email || "Team member";
}

function buildReportPrompt(topic: string, sourceText?: string, settings?: AdvancedSettings) {
  const cleanTopic = topic.trim() || "Slice advisor report";
  const activeSettings = settings ?? defaultAdvancedSettings;

  return `Create a beautiful customized Slice PDF report titled "${cleanTopic}".

Report style:
- Visual style: ${activeSettings.reportStyle}
- Depth: ${activeSettings.reportDepth}
- Include assumptions: ${activeSettings.includeAssumptions ? "Yes" : "No"}
- Include risk notes: ${activeSettings.includeRiskNotes ? "Yes" : "No"}
- Include review checklist: ${activeSettings.includeReviewChecklist ? "Yes" : "No"}

Accuracy and quality requirements:
- Be precise, advisor-grade, and easy to review.
- Separate facts, assumptions, estimates, and recommendations.
- Do not invent live market data, prices, client facts, legal conclusions, or compliance approvals.
- If a data point is unknown or not supplied, clearly label it as an assumption or item to verify.
- Include an executive summary, key findings, workflow implications, risks, advisor action items, and final review checklist.
- Include a compliance-conscious review note before any client-facing use.
- Use polished Slice language and make the output suitable for a professional wealth manager.

Source material:
${sourceText?.trim() || cleanTopic}`;
}

function inferTaskTitle(value: string) {
  const cleaned = value
    .replace(/^create\s+(a\s+)?task\s*(to|for|about)?/i, "")
    .replace(/^assign\s+/i, "")
    .trim();

  return cleaned.slice(0, 90) || "AI Studio follow-up task";
}

function previewText(value: string, maxChars = 900) {
  const clean = value.trim();
  if (clean.length <= maxChars) return clean;
  return `${clean.slice(0, maxChars).trim()}...`;
}

function reportToken(report: PdfReport) {
  try {
    const url = new URL(
      report.downloadUrl,
      typeof window !== "undefined" ? window.location.origin : "http://localhost",
    );
    return url.searchParams.get("token") || "";
  } catch {
    return "";
  }
}

function reportViewerHref(report: PdfReport) {
  const token = reportToken(report);
  return token ? `/workspace/personal-bot/reports?token=${encodeURIComponent(token)}` : report.downloadUrl;
}

function reportPdfHref(report: PdfReport) {
  return report.downloadUrl;
}

function themeVars(isLight: boolean, accent: AccountSettingsPayload["appearance"]["accent"]) {
  const red = accent === "Crimson" ? "#b91c1c" : accent === "Ruby" ? "#e11d48" : accent === "Graphite" ? "#334155" : "#dc2626";
  const redDark = accent === "Graphite" ? "#0f172a" : "#7f1d1d";

  if (isLight) {
    return {
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
      "--accent": red,
      "--accentDark": redDark,
      "--accentSoft": "rgba(220,38,38,0.10)",
    } as CSSProperties;
  }

  return {
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
    "--accent": red,
    "--accentDark": redDark,
    "--accentSoft": "rgba(220,38,38,0.16)",
  } as CSSProperties;
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    red: "bg-red-500/12 text-red-100 ring-red-500/35",
    green: "bg-emerald-500/10 text-emerald-100 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-100 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-100 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-100 ring-cyan-500/30",
    blue: "bg-blue-500/10 text-blue-100 ring-blue-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex max-w-full rounded-full px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em] ring-1",
        tones[tone],
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "relative min-h-0 overflow-hidden rounded-[2rem] border shadow-2xl backdrop-blur-2xl",
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
  className = "",
  tone = "red",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  const glow: Record<Tone, string> = {
    red: "from-red-500/18",
    green: "from-emerald-500/14",
    amber: "from-amber-500/14",
    purple: "from-purple-500/14",
    cyan: "from-cyan-500/14",
    blue: "from-blue-500/14",
    slate: "from-slate-400/8",
  };

  return (
    <div
      className={cx(
        "relative min-h-0 overflow-hidden rounded-[1.5rem] border p-4 shadow-xl",
        className,
      )}
      style={{
        background: "var(--panel)",
        borderColor: "var(--border)",
        color: "var(--text)",
      }}
    >
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent", glow[tone])} />
      <div className="relative min-h-0">{children}</div>
    </div>
  );
}

function Metric({
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
  const glow: Record<Tone, string> = {
    red: "from-red-500/18",
    green: "from-emerald-500/14",
    amber: "from-amber-500/14",
    purple: "from-purple-500/14",
    cyan: "from-cyan-500/14",
    blue: "from-blue-500/14",
    slate: "from-slate-400/10",
  };

  return (
    <div
      className="relative overflow-hidden rounded-[1.35rem] border p-4"
      style={{
        background: "var(--panel)",
        borderColor: "var(--border)",
      }}
    >
      <div className={cx("absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent", glow[tone])} />
      <div className="relative">
        <div className="truncate text-[9px] font-black uppercase tracking-[0.16em]" style={{ color: "var(--muted)" }}>
          {label}
        </div>
        <div className="mt-1 truncate text-2xl font-black" style={{ color: "var(--text)" }}>{value}</div>
        {helper ? <div className="mt-0.5 truncate text-[10px] font-semibold" style={{ color: "var(--muted)" }}>{helper}</div> : null}
      </div>
    </div>
  );
}

function BotOrb({
  listening,
  speaking,
  configured,
  size = "large",
}: {
  listening: boolean;
  speaking: boolean;
  configured: boolean;
  size?: "large" | "small";
}) {
  const active = listening || speaking;
  const outer = size === "large" ? "h-28 w-28" : "h-20 w-20";
  const inner = size === "large" ? "h-20 w-20" : "h-16 w-16";
  const core = size === "large" ? "h-12 w-12 text-base" : "h-10 w-10 text-sm";

  return (
    <div className={cx("relative grid shrink-0 place-items-center", outer)}>
      <span
        className={cx(
          "absolute inset-0 rounded-full blur-2xl",
          active ? "bg-red-400/40" : configured ? "bg-red-500/22" : "bg-amber-500/18",
        )}
      />
      <span className="absolute inset-1 rounded-full border border-red-400/25" />
      <span className={cx("absolute inset-4 rounded-full border", active ? "border-red-300/45" : "border-white/10")} />
      {active ? <span className="absolute inset-1 animate-ping rounded-full border border-red-300/45" /> : null}

      <div
        className={cx(
          "relative grid place-items-center rounded-full border shadow-2xl",
          inner,
          active
            ? "border-red-300/70 bg-gradient-to-br from-red-300/25 via-red-950 to-black shadow-red-950/60"
            : configured
              ? "border-red-300/35 bg-gradient-to-br from-red-500/16 via-zinc-950 to-black shadow-red-950/40"
              : "border-amber-300/30 bg-gradient-to-br from-amber-500/10 via-zinc-950 to-black shadow-amber-950/35",
        )}
      >
        <div className={cx("grid place-items-center rounded-full border border-white/15 bg-black/70 font-black text-white", core)}>
          AI
        </div>
      </div>
    </div>
  );
}

function AnswerModeSelector({
  answerMode,
  setAnswerMode,
}: {
  answerMode: AnswerMode;
  setAnswerMode: (mode: AnswerMode) => void;
}) {
  const modes: Array<{
    id: AnswerMode;
    label: string;
    helper: string;
    tone: Tone;
  }> = [
    { id: "quick", label: "Quick", helper: "Fast", tone: "cyan" },
    { id: "balanced", label: "Balanced", helper: "Default", tone: "green" },
    { id: "deep", label: "Deep", helper: "Reports", tone: "purple" },
  ];

  return (
    <div className="grid gap-1.5 rounded-[1.35rem] border p-1.5 md:grid-cols-3" style={{ background: "var(--panel2)", borderColor: "var(--border)" }}>
      {modes.map((mode) => (
        <button
          key={mode.id}
          type="button"
          onClick={() => setAnswerMode(mode.id)}
          className={cx(
            "rounded-2xl px-3 py-2.5 text-left transition",
            answerMode === mode.id
              ? "bg-gradient-to-br from-white via-red-100 to-red-200 text-slate-950 shadow-lg shadow-red-950/20"
              : "hover:bg-red-500/10",
          )}
          style={answerMode === mode.id ? undefined : { color: "var(--text)" }}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="text-xs font-black">{mode.label}</div>
            <span
              className={cx(
                "h-2 w-2 rounded-full",
                mode.tone === "cyan"
                  ? "bg-cyan-400"
                  : mode.tone === "green"
                    ? "bg-emerald-400"
                    : "bg-purple-400",
              )}
            />
          </div>
          <div className="mt-0.5 text-[10px] font-bold" style={{ color: answerMode === mode.id ? "#64748b" : "var(--muted)" }}>
            {mode.helper}
          </div>
        </button>
      ))}
    </div>
  );
}

function TabButton({
  tab,
  active,
  onClick,
}: {
  tab: (typeof tabs)[number];
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "min-w-0 rounded-[1.25rem] px-3 py-2.5 text-left ring-1 transition hover:-translate-y-0.5",
        active
          ? "bg-gradient-to-br from-white via-red-100 to-red-200 text-slate-950 shadow-xl shadow-red-950/25 ring-white/40"
          : "hover:bg-red-500/10 hover:ring-red-400/30",
      )}
      style={active ? undefined : { background: "var(--panel)", color: "var(--text)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="truncate text-sm font-black">{tab.label}</div>
        <span className={cx("h-2 w-2 rounded-full", dotClass(tab.tone))} />
      </div>
      <div className="mt-0.5 truncate text-[10px] font-bold" style={{ color: active ? "#64748b" : "var(--muted)" }}>
        {tab.helper}
      </div>
    </button>
  );
}

function dotClass(tone: Tone) {
  const dots: Record<Tone, string> = {
    red: "bg-red-400 shadow-red-400/60",
    green: "bg-emerald-400 shadow-emerald-400/60",
    amber: "bg-amber-400 shadow-amber-400/60",
    purple: "bg-purple-400 shadow-purple-400/60",
    cyan: "bg-cyan-400 shadow-cyan-400/60",
    blue: "bg-blue-400 shadow-blue-400/60",
    slate: "bg-slate-400 shadow-slate-400/60",
  };

  return dots[tone];
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
      <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>{label}</span>
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
      {helper ? <div className="mt-1 text-[10px] font-semibold" style={{ color: "var(--muted)" }}>{helper}</div> : null}
    </label>
  );
}

function ToggleRow({
  label,
  checked,
  onChange,
  helper,
  tone = "slate",
}: {
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
  helper?: string;
  tone?: Tone;
}) {
  return (
    <label className="flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-sm font-bold" style={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--text)" }}>
      <span>
        {label}
        {helper ? <span className="mt-1 block text-[10px] font-semibold" style={{ color: "var(--muted)" }}>{helper}</span> : null}
      </span>
      <span className="flex items-center gap-2">
        <Pill tone={checked ? tone : "slate"}>{checked ? "On" : "Off"}</Pill>
        <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} />
      </span>
    </label>
  );
}

function SectionHeader({ eyebrow, title, helper }: { eyebrow: string; title: string; helper?: string }) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-[0.22em] text-red-300">{eyebrow}</div>
      <h2 className="mt-2 text-3xl font-black" style={{ color: "var(--text)" }}>{title}</h2>
      {helper ? <p className="mt-2 max-w-4xl text-sm leading-6" style={{ color: "var(--muted)" }}>{helper}</p> : null}
    </div>
  );
}

function LatestAnswerPanel({
  latestAssistant,
  saving,
  answerMode,
  onCopy,
  onSpeak,
  onReport,
}: {
  latestAssistant?: BotMessage;
  saving: boolean;
  answerMode: AnswerMode;
  onCopy: (text: string) => void;
  onSpeak: (text: string) => void;
  onReport: (text: string) => void;
}) {
  if (saving) return <ThinkingCard answerMode={answerMode} />;

  if (!latestAssistant) {
    return (
      <Panel tone="red">
        <div className="text-2xl font-black" style={{ color: "var(--text)" }}>No command yet.</div>
        <p className="mt-2 text-sm leading-6" style={{ color: "var(--muted)" }}>
          Use the command input on the left. The clean output appears here without turning into a long wall of chat.
        </p>
      </Panel>
    );
  }

  const action = latestAssistant.metadata?.clientAction;
  const actionText = actionLabel(action);
  const cleanedError = sanitizeError(latestAssistant.metadata?.universalAiError);

  return (
    <div className="grid gap-4">
      <Panel tone="red">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <div className="flex flex-wrap gap-2">
              <Pill tone={toneFor(latestAssistant.metadata?.universalAiStatus || latestAssistant.intent)}>
                Slice Executive AI
              </Pill>
              {latestAssistant.metadata?.answerMode ? (
                <Pill tone={modeTone(latestAssistant.metadata.answerMode)}>{latestAssistant.metadata.answerMode}</Pill>
              ) : null}
              <Pill tone="slate">{shortTime(latestAssistant.createdAt)}</Pill>
            </div>

            <h3 className="mt-3 text-2xl font-black" style={{ color: "var(--text)" }}>Executive answer preview</h3>
          </div>

          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => onSpeak(latestAssistant.content)} className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100">
              Read
            </button>
            <button type="button" onClick={() => onCopy(latestAssistant.content)} className="rounded-2xl border px-4 py-2 text-xs font-black" style={{ borderColor: "var(--border)", background: "var(--panel)", color: "var(--text)" }}>
              Copy
            </button>
            <button type="button" onClick={() => onReport(latestAssistant.content)} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-100">
              Make PDF
            </button>
          </div>
        </div>

        <div className="mt-4 rounded-[1.35rem] border p-4" style={{ background: "var(--panel2)", borderColor: "var(--border)" }}>
          <div className="whitespace-pre-wrap text-sm leading-7" style={{ color: "var(--muted2)" }}>
            {previewText(latestAssistant.content)}
          </div>
        </div>

        {cleanedError ? (
          <div className="mt-3 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3 text-xs leading-5 text-amber-100">
            {cleanedError}
          </div>
        ) : null}

        {action?.href && actionText ? (
          <a
            href={action.href}
            target={action.type === "report" || action.type === "source" ? "_blank" : undefined}
            rel={action.type === "report" || action.type === "source" ? "noreferrer" : undefined}
            className="mt-4 inline-flex rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
          >
            {actionText}
          </a>
        ) : null}
      </Panel>

      <details className="group rounded-[1.5rem] border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
        <summary className="cursor-pointer list-none text-sm font-black" style={{ color: "var(--text)" }}>
          Open full response
          <span className="ml-2 text-xs font-semibold group-open:hidden" style={{ color: "var(--muted)" }}>+</span>
          <span className="ml-2 hidden text-xs font-semibold group-open:inline" style={{ color: "var(--muted)" }}>−</span>
        </summary>
        <div className="mt-4 max-h-[420px] overflow-y-auto rounded-[1.25rem] border p-4" style={{ background: "var(--panel2)", borderColor: "var(--border)" }}>
          <div className="whitespace-pre-wrap text-sm leading-7" style={{ color: "var(--muted2)" }}>{latestAssistant.content}</div>
        </div>
      </details>
    </div>
  );
}

function ThinkingCard({ answerMode }: { answerMode: AnswerMode }) {
  return (
    <div className="rounded-[1.4rem] border border-red-500/25 bg-red-500/10 p-4 shadow-lg shadow-red-950/20">
      <div className="flex items-center gap-3">
        <div className="flex gap-1">
          <span className="h-2 w-2 animate-bounce rounded-full bg-red-300 [animation-delay:-0.3s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-red-300 [animation-delay:-0.15s]" />
          <span className="h-2 w-2 animate-bounce rounded-full bg-red-300" />
        </div>
        <div>
          <div className="text-sm font-black text-white">
            {answerMode === "deep" ? "Building an executive-grade answer..." : "Thinking..."}
          </div>
          <div className="mt-1 text-xs text-red-100/70">
            {answerMode === "deep"
              ? "Deep Mode gives report-quality structure and stronger review notes."
              : "Slice AI is preparing a clean advisor-grade response."}
          </div>
        </div>
      </div>
    </div>
  );
}

function MessageMiniCard({ message }: { message: BotMessage }) {
  const isUser = message.role === "user";

  return (
    <div className="rounded-[1.25rem] border p-3" style={{ background: isUser ? "var(--accentSoft)" : "var(--panel)", borderColor: "var(--border)" }}>
      <div className="flex items-center justify-between gap-2">
        <Pill tone={isUser ? "red" : "slate"}>{isUser ? "You" : "AI"}</Pill>
        <span className="text-[10px] font-semibold" style={{ color: "var(--muted)" }}>{shortTime(message.createdAt)}</span>
      </div>
      <p className="mt-2 line-clamp-3 text-xs leading-5" style={{ color: "var(--muted)" }}>{message.content}</p>
    </div>
  );
}

function ReportLibraryCard({ report }: { report: PdfReport }) {
  return (
    <Panel tone={toneFor(report.status)}>
      <div className="flex flex-wrap gap-2">
        <Pill tone={toneFor(report.status)}>{report.status}</Pill>
        <Pill tone="red">{report.reportType}</Pill>
      </div>

      <h3 className="mt-3 line-clamp-2 text-sm font-black" style={{ color: "var(--text)" }}>{report.title}</h3>
      <div className="mt-2 text-xs" style={{ color: "var(--muted)" }}>{formatTime(report.createdAt)}</div>

      {report.summary ? (
        <p className="mt-3 line-clamp-3 text-xs leading-5" style={{ color: "var(--muted)" }}>{report.summary}</p>
      ) : null}

      <div className="mt-4 grid gap-2">
        <a href={reportViewerHref(report)} target="_blank" rel="noreferrer" className="inline-flex justify-center rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950">
          Open Browser Report
        </a>

        <a href={reportPdfHref(report)} target="_blank" rel="noreferrer" className="inline-flex justify-center rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100">
          Open Raw PDF
        </a>
      </div>
    </Panel>
  );
}

export default function PersonalBotPage() {
  const [data, setData] = useState<BotPayload | null>(null);
  const [workspace, setWorkspace] = useState<FirmWorkspacePayload | null>(null);
  const [accountSettings, setAccountSettings] = useState<AccountSettingsPayload>(defaultAccountSettings);
  const [activeTab, setActiveTab] = useState<StudioTab>("command");
  const [prompt, setPrompt] = useState("");
  const [voiceDraft, setVoiceDraft] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [accountSaving, setAccountSaving] = useState(false);
  const [workspaceLoading, setWorkspaceLoading] = useState(false);
  const [answerMode, setAnswerMode] = useState<AnswerMode>("balanced");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);
  const [systemDark, setSystemDark] = useState(true);
  const [reportTopic, setReportTopic] = useState("Slice advisor executive report");
  const [selectedMemberId, setSelectedMemberId] = useState("");
  const [deactivateConfirm, setDeactivateConfirm] = useState("");
  const [deleteConfirm, setDeleteConfirm] = useState("");
  const [advancedSettings, setAdvancedSettings] = useState<AdvancedSettings>(defaultAdvancedSettings);
  const [taskDraft, setTaskDraft] = useState<TeamTaskDraft>({
    title: "",
    detail: "",
    priority: defaultAdvancedSettings.taskDefaultPriority,
    status: defaultAdvancedSettings.taskDefaultStatus,
    dueDate: dueDateFromSetting(defaultAdvancedSettings.taskDueDays),
    reminderAt: "",
    reminderNote: "",
    projectId: "",
    notifyEmail: defaultAdvancedSettings.taskEmailDefault,
  });
  const [draftProfile, setDraftProfile] = useState({
    botName: "",
    preferredTone: "Professional",
    commandStyle: "Balanced detail",
    autonomyLevel: "Advisor approval required",
    customInstructions: "",
    voiceEnabled: true,
  });

  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);

  const appearanceMode = accountSettings.appearance.mode;
  const isLight = appearanceMode === "light" || (appearanceMode === "system" && !systemDark);
  const themeStyle = themeVars(isLight, accountSettings.appearance.accent);
  const densityClass =
    accountSettings.appearance.density === "Compact"
      ? "gap-3"
      : accountSettings.appearance.density === "Spacious"
        ? "gap-6"
        : "gap-4";

  const profile = data?.profile;
  const aiEngine = data?.aiEngine;
  const messages = data?.messages ?? [];
  const reports = data?.pdfReports ?? [];
  const commands = data?.commands ?? [];
  const memories = data?.memories ?? [];
  const approvals = [...(data?.approvals ?? []), ...(data?.backendApprovals ?? [])];
  const teamMetrics = workspace?.operations?.sprintMetrics;
  const visibleTaskCount = workspace?.operations?.allTasks?.length ?? 0;
  const latestAssistant = useMemo(
    () => [...messages].reverse().find((item) => item.role === "assistant"),
    [messages],
  );
  const latestUser = useMemo(
    () => [...messages].reverse().find((item) => item.role === "user"),
    [messages],
  );
  const previousContext = useMemo(() => messages.filter((item) => item.id !== latestAssistant?.id && item.id !== latestUser?.id), [
    latestAssistant?.id,
    latestUser?.id,
    messages,
  ]);
  const lastCommand = commands[0];

  const studioReadiness = useMemo(() => {
    let score = 36;

    if (aiEngine?.configured) score += 24;
    if (profile?.voiceEnabled) score += 8;
    if (reports.length) score += 8;
    if (workspace?.firm) score += 8;
    if (profile?.customInstructions) score += 7;
    if (approvals.length === 0) score += 5;
    if (memories.length) score += 4;

    return Math.max(0, Math.min(100, score));
  }, [
    aiEngine?.configured,
    approvals.length,
    memories.length,
    profile?.customInstructions,
    profile?.voiceEnabled,
    reports.length,
    workspace?.firm,
  ]);

  async function loadData() {
    try {
      const response = await fetch("/api/personal-bot", { cache: "no-store" });
      const payload = (await response.json()) as BotPayload & { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Could not load AI Studio.");
        return;
      }

      setData(compactBotPayload(payload));
      setDraftProfile({
        botName: payload.profile.botName ?? "Slice AI",
        preferredTone: payload.profile.preferredTone ?? "Professional",
        commandStyle: payload.profile.commandStyle ?? "Balanced detail",
        autonomyLevel: payload.profile.autonomyLevel ?? "Advisor approval required",
        customInstructions: payload.profile.customInstructions ?? "",
        voiceEnabled: Boolean(payload.profile.voiceEnabled),
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load AI Studio.");
    }
  }

  async function loadAccountSettings() {
    try {
      const response = await fetch("/api/account-settings", { cache: "no-store" });
      const payload = (await response.json()) as AccountSettingsPayload & { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Could not load account settings.");
        return;
      }

      setAccountSettings({
        ...defaultAccountSettings,
        ...payload,
        account: { ...defaultAccountSettings.account, ...payload.account },
        appearance: { ...defaultAccountSettings.appearance, ...payload.appearance },
        privacy: { ...defaultAccountSettings.privacy, ...payload.privacy },
        security: { ...defaultAccountSettings.security, ...payload.security },
        notifications: payload.notifications?.length ? payload.notifications : defaultAccountSettings.notifications,
        contact: { ...defaultAccountSettings.contact, ...payload.contact },
      });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load account settings.");
    }
  }

  async function loadWorkspace() {
    setWorkspaceLoading(true);

    try {
      const response = await fetch("/api/firm-workspace", { cache: "no-store" });
      const payload = (await response.json()) as FirmWorkspacePayload & { error?: string };

      if (!response.ok) {
        setWorkspace(null);
        return;
      }

      setWorkspace(payload);

      if (!selectedMemberId && payload.members?.[0]) {
        setSelectedMemberId(payload.members[0].id);
      }
    } catch {
      setWorkspace(null);
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function saveAccountSettings() {
    setAccountSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/account-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "save-account-settings",
        },
        body: JSON.stringify({
          action: "saveAccountSettings",
          account: accountSettings.account,
          appearance: accountSettings.appearance,
          privacy: accountSettings.privacy,
          security: accountSettings.security,
          notifications: accountSettings.notifications,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Could not save settings.");
        return;
      }

      setAccountSettings({
        ...defaultAccountSettings,
        ...payload,
        account: { ...defaultAccountSettings.account, ...payload.account },
        appearance: { ...defaultAccountSettings.appearance, ...payload.appearance },
        privacy: { ...defaultAccountSettings.privacy, ...payload.privacy },
        security: { ...defaultAccountSettings.security, ...payload.security },
        notifications: payload.notifications?.length ? payload.notifications : defaultAccountSettings.notifications,
        contact: { ...defaultAccountSettings.contact, ...payload.contact },
      });
      setMessage("Settings saved.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not save settings.");
    } finally {
      setAccountSaving(false);
    }
  }

  async function requestPasswordReset() {
    setAccountSaving(true);
    setMessage("");

    try {
      const response = await fetch("/api/account-settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "request-password-reset",
        },
        body: JSON.stringify({ action: "requestPasswordReset" }),
      });

      const payload = await response.json();

      setMessage(payload.message || payload.error || "Password reset request submitted.");
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not request password reset.");
    } finally {
      setAccountSaving(false);
    }
  }

  async function logout() {
    setAccountSaving(true);

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
    setAccountSaving(true);
    setMessage("");

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

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error || "Could not deactivate account.");
        return;
      }

      window.location.href = payload.redirectTo || "/login";
    } finally {
      setAccountSaving(false);
    }
  }

  async function deleteAccount() {
    setAccountSaving(true);
    setMessage("");

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

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error || "Could not delete account.");
        return;
      }

      window.location.href = payload.redirectTo || "/login";
    } finally {
      setAccountSaving(false);
    }
  }

  async function sendPrompt(value = prompt, voiceTranscript?: string) {
    const trimmed = value.trim();

    if (!trimmed) return;

    setSaving(true);
    setMessage("");
    setPrompt("");

    const lower = trimmed.toLowerCase();

    if (lower.includes("task") || lower.includes("assign") || lower.includes("delegate")) {
      setTaskDraft((current) => ({
        ...current,
        title: current.title || inferTaskTitle(trimmed),
        detail: current.detail || trimmed,
      }));
      setActiveTab("tasks");
    }

    if (lower.includes("pdf") || lower.includes("report") || lower.includes("briefing") || lower.includes("packet")) {
      setActiveTab("reports");
    }

    try {
      const response = await fetch("/api/personal-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "ai-executive-studio-send-message",
        },
        body: JSON.stringify({
          action: "sendMessage",
          prompt: trimmed,
          answerMode,
          voiceTranscript,
          currentPath: "/workspace/personal-bot",
          pageTitle: "Slice AI Executive Studio",
          visibleMemoryWindow: 2,
          advancedSettings,
          accountSettings: {
            appearance: accountSettings.appearance,
            privacy: accountSettings.privacy,
          },
          instruction:
            "Treat this as an executive operator request. Infer the correct Slice workflow. Keep the reply concise, structured, and non-overwhelming unless deep detail is explicitly required.",
        }),
      });

      const payload = (await response.json()) as BotPayload & { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "AI Studio could not answer.");
        return;
      }

      const compactPayload = compactBotPayload(payload);
      setData(compactPayload);

      const newestAssistant = [...(compactPayload.messages ?? [])].reverse().find((item) => item.role === "assistant");

      if (advancedSettings.autoReadReplies && newestAssistant?.content) {
        speak(newestAssistant.content);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "AI Studio could not answer.");
    } finally {
      setSaving(false);
    }
  }

  async function saveProfile() {
    setSaving(true);
    setMessage("");

    try {
      window.localStorage.setItem(ADVANCED_SETTINGS_KEY, JSON.stringify(advancedSettings));

      const response = await fetch("/api/personal-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "ai-executive-studio-update-profile",
        },
        body: JSON.stringify({
          action: "updateProfile",
          ...draftProfile,
          autonomyLevel: advancedSettings.approvalStyle,
        }),
      });

      const payload = (await response.json()) as BotPayload & { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Could not save profile.");
        return;
      }

      setData(compactBotPayload(payload));
      setMessage("AI Studio settings saved.");
    } finally {
      setSaving(false);
    }
  }

  async function createTeamTask(event?: FormEvent<HTMLFormElement>) {
    event?.preventDefault();

    if (!taskDraft.title.trim()) {
      setMessage("Task title is required.");
      return;
    }

    if (!workspace?.firm?.id) {
      setMessage("Create or connect to a firm before assigning Team Board tasks.");
      return;
    }

    const targetMembershipId = selectedMemberId || workspace.members[0]?.id;

    if (!targetMembershipId) {
      setMessage("Add a team member before assigning this task.");
      return;
    }

    setWorkspaceLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/firm-workspace", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "ai-executive-studio-create-team-task",
        },
        body: JSON.stringify({
          firmId: workspace.firm.id,
          action: "createDelegatedTask",
          targetMembershipId,
          title: taskDraft.title,
          detail: taskDraft.detail,
          priority: taskDraft.priority,
          status: taskDraft.status,
          dueDate: taskDraft.dueDate,
          reminderAt: taskDraft.reminderAt,
          reminderNote: taskDraft.reminderNote,
          projectId: taskDraft.projectId || null,
          notifyEmail: taskDraft.notifyEmail,
        }),
      });

      const payload = (await response.json()) as FirmWorkspacePayload & { error?: string };

      if (!response.ok) {
        setMessage(payload.error ?? "Task could not be created.");
        return;
      }

      setWorkspace(payload);
      setTaskDraft((current) => ({
        ...current,
        title: "",
        detail: "",
        reminderAt: "",
        reminderNote: "",
      }));

      const emailNote = payload.emailResult ? ` Email: ${payload.emailResult.status}.` : "";
      setMessage(`Team Board task created and assigned.${emailNote}`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Task could not be created.");
    } finally {
      setWorkspaceLoading(false);
    }
  }

  async function copyText(text: string, label = "Copied.") {
    try {
      await navigator.clipboard.writeText(text);
      setMessage(label);
    } catch {
      setMessage("Copy failed. Select the text manually.");
    }
  }

  function generateReport(topic = reportTopic, sourceText?: string) {
    setAnswerMode("deep");
    setActiveTab("reports");
    void sendPrompt(buildReportPrompt(topic, sourceText, advancedSettings));
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(stripForSpeech(text));
    utterance.lang = advancedSettings.voiceLanguage || profile?.speechLanguage || "en-US";
    utterance.rate = advancedSettings.voiceRate === "Slow" ? 0.82 : advancedSettings.voiceRate === "Fast" ? 1.04 : 0.92;
    utterance.pitch = 1;
    utterance.onstart = () => setSpeaking(true);
    utterance.onend = () => setSpeaking(false);
    utterance.onerror = () => setSpeaking(false);

    window.speechSynthesis.speak(utterance);
  }

  function stopSpeaking() {
    if (typeof window !== "undefined" && window.speechSynthesis) {
      window.speechSynthesis.cancel();
    }

    setSpeaking(false);
  }

  function startListening(target: "prompt" | "voice" = "prompt") {
    if (typeof window === "undefined") return;

    const browserWindow = window as unknown as {
      SpeechRecognition?: SpeechRecognitionConstructor;
      webkitSpeechRecognition?: SpeechRecognitionConstructor;
    };

    const SpeechRecognition = browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage("Voice recognition is not available in this browser.");
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = advancedSettings.voiceLanguage || profile?.speechLanguage || "en-US";

    let finalTranscript = "";

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: SpeechRecognitionEventLike) => {
      let interim = "";

      for (let index = event.resultIndex ?? 0; index < event.results.length; index += 1) {
        const result = event.results[index];
        const transcript = result?.[0]?.transcript ?? "";

        if (result?.isFinal) {
          finalTranscript += transcript;
        } else {
          interim += transcript;
        }
      }

      const liveText = (finalTranscript || interim).trim();

      if (target === "voice") {
        setVoiceDraft(liveText);
      } else {
        setPrompt(liveText);
      }
    };

    recognition.onend = () => {
      setListening(false);

      if (finalTranscript.trim()) {
        if (target === "voice") {
          setVoiceDraft(finalTranscript.trim());

          if (advancedSettings.voiceAutoSend) {
            void sendPrompt(finalTranscript.trim(), finalTranscript.trim());
          }
        } else {
          void sendPrompt(finalTranscript.trim(), finalTranscript.trim());
        }
      }
    };

    recognition.onerror = () => {
      setListening(false);
      setMessage("Voice recognition stopped. You can still type your request.");
    };

    recognitionRef.current = recognition;
    recognition.start();
  }

  function stopListening() {
    recognitionRef.current?.stop();
    setListening(false);
  }

  function onPromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void sendPrompt();
    }
  }

  function updateAdvancedSettings<K extends keyof AdvancedSettings>(key: K, value: AdvancedSettings[K]) {
    setAdvancedSettings((current) => {
      const next = { ...current, [key]: value };

      if (key === "defaultAnswerMode") {
        setAnswerMode(value as AnswerMode);
      }

      if (key === "taskDefaultPriority") {
        setTaskDraft((draft) => ({ ...draft, priority: value as Priority }));
      }

      if (key === "taskDefaultStatus") {
        setTaskDraft((draft) => ({ ...draft, status: value as TaskStatus }));
      }

      if (key === "taskDueDays") {
        setTaskDraft((draft) => ({ ...draft, dueDate: dueDateFromSetting(value as AdvancedSettings["taskDueDays"]) }));
      }

      if (key === "taskEmailDefault") {
        setTaskDraft((draft) => ({ ...draft, notifyEmail: value as boolean }));
      }

      return next;
    });
  }

  function updateAccount<K extends keyof AccountSettingsPayload["account"]>(key: K, value: AccountSettingsPayload["account"][K]) {
    setAccountSettings((current) => ({
      ...current,
      account: {
        ...current.account,
        [key]: value,
      },
    }));
  }

  function updateAppearance<K extends keyof AccountSettingsPayload["appearance"]>(key: K, value: AccountSettingsPayload["appearance"][K]) {
    setAccountSettings((current) => ({
      ...current,
      appearance: {
        ...current.appearance,
        [key]: value,
      },
    }));
  }

  function updatePrivacy<K extends keyof AccountSettingsPayload["privacy"]>(key: K, value: AccountSettingsPayload["privacy"][K]) {
    setAccountSettings((current) => ({
      ...current,
      privacy: {
        ...current.privacy,
        [key]: value,
      },
    }));
  }

  function updateSecurity<K extends keyof AccountSettingsPayload["security"]>(key: K, value: AccountSettingsPayload["security"][K]) {
    setAccountSettings((current) => ({
      ...current,
      security: {
        ...current.security,
        [key]: value,
      },
    }));
  }

  function updateNotification(index: number, patch: Partial<AccountSettingsPayload["notifications"][number]>) {
    setAccountSettings((current) => ({
      ...current,
      notifications: current.notifications.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    }));
  }

  useEffect(() => {
    void loadData();
    void loadWorkspace();
    void loadAccountSettings();

    if (typeof window !== "undefined") {
      const browserWindow = window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };

      setVoiceSupported(Boolean(browserWindow.SpeechRecognition || browserWindow.webkitSpeechRecognition));

      const media = window.matchMedia("(prefers-color-scheme: dark)");
      setSystemDark(media.matches);

      const listener = (event: MediaQueryListEvent) => setSystemDark(event.matches);
      media.addEventListener?.("change", listener);

      try {
        const raw = window.localStorage.getItem(ADVANCED_SETTINGS_KEY);
        if (raw) {
          const parsed = JSON.parse(raw) as Partial<AdvancedSettings>;
          const merged = { ...defaultAdvancedSettings, ...parsed };
          setAdvancedSettings(merged);
          setAnswerMode(merged.defaultAnswerMode);
          setTaskDraft((current) => ({
            ...current,
            priority: merged.taskDefaultPriority,
            status: merged.taskDefaultStatus,
            dueDate: dueDateFromSetting(merged.taskDueDays),
            notifyEmail: merged.taskEmailDefault,
          }));
        }
      } catch {
        setAdvancedSettings(defaultAdvancedSettings);
      }

      return () => media.removeEventListener?.("change", listener);
    }
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;

    document.documentElement.dataset.sliceTheme = isLight ? "light" : "dark";
    document.documentElement.style.colorScheme = isLight ? "light" : "dark";
  }, [isLight]);

  if (!data) {
    return (
      <main className="min-h-screen p-5 text-white" style={themeStyle}>
        <Card className="mx-auto mt-20 max-w-3xl p-8 text-center">
          <div className="mx-auto flex justify-center rounded-3xl bg-zinc-950/90 p-4">
            <BrandMark />
          </div>
          <h1 className="mt-8 text-3xl font-black">Loading Slice AI Executive Studio...</h1>
          {message ? <p className="mt-3 text-sm text-red-200">{message}</p> : null}
        </Card>
      </main>
    );
  }

  return (
    <main
      className="min-h-screen overflow-x-hidden p-3 md:p-5"
      style={{
        ...themeStyle,
        background: isLight
          ? "radial-gradient(circle at top left, rgba(220,38,38,0.14), transparent 30%), radial-gradient(circle at top right, rgba(248,113,113,0.16), transparent 28%), linear-gradient(135deg, var(--bg), var(--bg2))"
          : "radial-gradient(circle at top left, rgba(127,29,29,0.48), transparent 30%), radial-gradient(circle at top right, rgba(239,68,68,0.24), transparent 26%), radial-gradient(circle at bottom, rgba(153,27,27,0.30), transparent 38%), linear-gradient(135deg, var(--bg), #09090b, #111111, var(--bg2))",
        color: "var(--text)",
      }}
    >
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-12%] top-[-18%] h-[34rem] w-[34rem] rounded-full bg-red-700/20 blur-3xl" />
        <div className="absolute right-[-14%] top-[5%] h-[34rem] w-[34rem] rounded-full bg-red-500/14 blur-3xl" />
        <div className="absolute bottom-[-20%] left-[25%] h-[30rem] w-[30rem] rounded-full bg-orange-700/10 blur-3xl" />
      </div>

      <div className={cx("relative mx-auto grid max-w-[1900px]", densityClass)}>
        <header className="relative overflow-hidden rounded-[2.25rem] border p-5 shadow-2xl backdrop-blur-2xl" style={{ background: "var(--surface)", borderColor: "var(--border)", color: "var(--text)", boxShadow: "0 24px 70px var(--shadow)" }}>
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_18%_12%,rgba(239,68,68,0.20),transparent_30%),radial-gradient(circle_at_82%_12%,rgba(248,113,113,0.12),transparent_26%)]" />

          <div className="relative flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
            <div className="min-w-0">
              <div className={cx("inline-flex rounded-3xl p-3", isLight ? "bg-zinc-950" : "bg-transparent")}>
                <BrandMark />
              </div>

              <div className="mt-5 flex flex-col gap-5 xl:flex-row xl:items-center">
                <BotOrb listening={listening} speaking={speaking} configured={Boolean(aiEngine?.configured)} />

                <div className="min-w-0">
                  <div className="flex flex-wrap gap-2">
                    <Pill tone={aiEngine?.configured ? "green" : "amber"}>
                      {aiEngine?.configured ? "Live AI connected" : "Fallback mode"}
                    </Pill>
                    <Pill tone={modeTone(answerMode)}>{answerMode} mode</Pill>
                    <Pill tone="red">Premium command center</Pill>
                    <Pill tone="cyan">{isLight ? "Light mode" : "Dark mode"}</Pill>
                    <Pill tone={voiceSupported ? "green" : "slate"}>
                      Voice {voiceSupported ? "available" : "unavailable"}
                    </Pill>
                  </div>

                  <h1 className="mt-3 text-4xl font-black tracking-tight md:text-6xl" style={{ color: "var(--text)" }}>
                    AI Executive Studio
                  </h1>

                  <p className="mt-3 max-w-5xl text-sm font-semibold leading-7" style={{ color: "var(--muted)" }}>
                    A premium, voice-first command center for advisor work: speak naturally, get clean execution,
                    generate reports, assign tasks, draft client-ready language, and customize the platform to the user.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap gap-2">
              {activeTab === "settings" ? (
                <button
                  type="button"
                  onClick={logout}
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-black text-red-100 shadow-lg shadow-red-950/20 transition hover:-translate-y-0.5"
                >
                  Logout
                </button>
              ) : null}
              <Link
                href="/workspace"
                prefetch={false}
                className="rounded-2xl bg-gradient-to-br from-white via-red-100 to-red-200 px-5 py-3 text-sm font-black text-slate-950 shadow-lg shadow-red-950/20 transition hover:-translate-y-0.5"
              >
                ← Return to Workspace
              </Link>
            </div>
          </div>

          <div className="relative mt-5 grid gap-3 md:grid-cols-3 xl:grid-cols-6">
            <Metric label="AI Provider" value={aiEngine?.configured ? "OpenAI" : "Fallback"} helper={aiEngine?.provider} tone={aiEngine?.configured ? "green" : "amber"} />
            <Metric label="Model" value={answerMode === "deep" ? aiEngine?.qualityModel ?? aiEngine?.model ?? "—" : aiEngine?.model ?? "—"} helper="Selected by mode" tone="red" />
            <Metric label="Studio Score" value={`${studioReadiness}%`} helper="Executive readiness" tone={toneFor(studioReadiness)} />
            <Metric label="Reports" value={reports.length} helper="Generated PDFs" tone="green" />
            <Metric label="Team Tasks" value={visibleTaskCount} helper={workspace?.firm?.name ?? "No firm"} tone="purple" />
            <Metric label="Last Command" value={lastCommand ? relativeTime(lastCommand.createdAt) : "—"} helper={lastCommand?.status ?? "No command yet"} tone={toneFor(lastCommand?.status)} />
          </div>
        </header>

        <Card className="p-2">
          <div className="grid gap-2 md:grid-cols-5">
            {tabs.map((tab) => (
              <TabButton key={tab.id} tab={tab} active={activeTab === tab.id} onClick={() => setActiveTab(tab.id)} />
            ))}
          </div>
        </Card>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        {activeTab === "command" ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Card className="p-5">
              <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-start 2xl:justify-between">
                <SectionHeader
                  eyebrow="Command Input"
                  title="Tell Slice the outcome."
                  helper="Write or speak naturally. Slice should infer whether this is a report, task, route, meeting prep, client draft, or advisor analysis."
                />
                <div className="w-[360px] max-w-full">
                  <AnswerModeSelector answerMode={answerMode} setAnswerMode={setAnswerMode} />
                </div>
              </div>

              <form
                onSubmit={(event: FormEvent) => {
                  event.preventDefault();
                  void sendPrompt();
                }}
                className="mt-5 rounded-[1.75rem] border p-4"
                style={{ background: "var(--panel2)", borderColor: "var(--border)" }}
              >
                <textarea
                  value={prompt}
                  onChange={(event) => setPrompt(event.target.value)}
                  onKeyDown={onPromptKeyDown}
                  placeholder="Example: Create a concise client-ready PDF report for tomorrow’s meeting and prepare three follow-up tasks for the team..."
                  className="min-h-[250px] w-full resize-none rounded-[1.5rem] border px-5 py-4 text-base leading-7 outline-none focus:border-red-400/40"
                  style={{ background: "var(--input)", borderColor: "var(--border)", color: "var(--text)" }}
                />

                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {voiceSupported ? (
                      <button
                        type="button"
                        onClick={listening ? stopListening : () => startListening("prompt")}
                        className={cx(
                          "rounded-2xl px-4 py-3 text-xs font-black ring-1",
                          listening
                            ? "bg-red-500/20 text-red-100 ring-red-400/40"
                            : "bg-red-500/10 text-red-100 ring-red-500/30",
                        )}
                      >
                        {listening ? "Stop Listening" : "Speak Command"}
                      </button>
                    ) : null}

                    <button type="button" onClick={() => setPrompt("")} className="rounded-2xl border px-4 py-3 text-xs font-black" style={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--text)" }}>
                      Clear
                    </button>
                  </div>

                  <button disabled={saving || !prompt.trim()} className="rounded-2xl bg-gradient-to-br from-white via-red-100 to-red-200 px-6 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-50">
                    {saving ? "Thinking..." : "Execute Command"}
                  </button>
                </div>
              </form>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {[
                  ["Report", "Say PDF, report, briefing, packet, deck, or presentation.", "red"],
                  ["Task", "Say assign, delegate, task, follow up, owner, due date.", "green"],
                  ["Draft", "Say email, note, client explanation, meeting prep, talking points.", "purple"],
                ].map(([title, helper, tone]) => (
                  <Panel key={title} tone={tone as Tone}>
                    <div className="text-sm font-black" style={{ color: "var(--text)" }}>{title}</div>
                    <p className="mt-2 text-xs leading-5" style={{ color: "var(--muted)" }}>{helper}</p>
                  </Panel>
                ))}
              </div>

              <Panel tone="cyan" className="mt-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Smart destinations</div>
                <div className="mt-3 grid gap-2 md:grid-cols-3">
                  {routeIntents.slice(0, 6).map((route) => (
                    <Link key={route.href} href={route.href} prefetch={false} className="rounded-2xl border p-3 transition hover:border-red-400/30 hover:bg-red-500/10" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
                      <div className="text-xs font-black" style={{ color: "var(--text)" }}>{route.label}</div>
                      <div className="mt-1 text-[10px] font-semibold" style={{ color: "var(--muted)" }}>{route.helper}</div>
                    </Link>
                  ))}
                </div>
              </Panel>
            </Card>

            <Card className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <SectionHeader
                  eyebrow="Clean Reply"
                  title="No wall of text."
                  helper="The latest answer is summarized first. Full detail is tucked behind an expandable section."
                />
                <Pill tone="cyan">{messages.length} visible messages</Pill>
              </div>

              <div className="mt-5">
                <LatestAnswerPanel
                  latestAssistant={latestAssistant}
                  saving={saving}
                  answerMode={answerMode}
                  onCopy={(text) => copyText(text, "Latest answer copied.")}
                  onSpeak={speak}
                  onReport={(text) => generateReport("Report from latest Slice AI answer", text)}
                />
              </div>

              {latestUser || previousContext.length ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {latestUser ? <MessageMiniCard message={latestUser} /> : null}
                  {previousContext.slice(-1).map((item) => (
                    <MessageMiniCard key={item.id} message={item} />
                  ))}
                </div>
              ) : null}
            </Card>
          </section>
        ) : null}

        {activeTab === "voice" ? (
          <section className="grid gap-4 xl:grid-cols-[0.95fr_1.05fr]">
            <Card className="p-6">
              <div className="flex flex-col items-center text-center">
                <BotOrb listening={listening} speaking={speaking} configured={Boolean(aiEngine?.configured)} size="large" />

                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Pill tone="red">Voice-first</Pill>
                  <Pill tone={voiceSupported ? "green" : "slate"}>{voiceSupported ? "Browser ready" : "Browser unsupported"}</Pill>
                  <Pill tone={advancedSettings.voiceAutoSend ? "amber" : "green"}>
                    {advancedSettings.voiceAutoSend ? "Auto-send on" : "Review before send"}
                  </Pill>
                </div>

                <h2 className="mt-5 text-4xl font-black tracking-tight" style={{ color: "var(--text)" }}>
                  Say the outcome. Slice handles the workflow.
                </h2>
                <p className="mt-3 max-w-2xl text-sm leading-7" style={{ color: "var(--muted)" }}>
                  This is not a rigid command list. Speak naturally and edit the transcript before execution.
                </p>

                <button
                  type="button"
                  onClick={listening ? stopListening : () => startListening("voice")}
                  disabled={!voiceSupported}
                  className={cx(
                    "mt-8 rounded-full px-10 py-5 text-lg font-black shadow-2xl transition hover:-translate-y-1 disabled:opacity-50",
                    listening
                      ? "bg-red-500 text-white shadow-red-950/50"
                      : "bg-gradient-to-br from-white via-red-100 to-red-200 text-slate-950 shadow-red-950/30",
                  )}
                >
                  {listening ? "Listening..." : "Start Voice Command"}
                </button>
              </div>

              <div className="mt-8 rounded-[1.75rem] border p-4" style={{ background: "var(--panel2)", borderColor: "var(--border)" }}>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Live Transcript</div>
                <textarea
                  value={voiceDraft}
                  onChange={(event) => setVoiceDraft(event.target.value)}
                  placeholder="Your spoken instruction will appear here. You can edit it before execution."
                  className="mt-3 min-h-[160px] w-full resize-none rounded-[1.4rem] border px-4 py-3 text-sm leading-6 outline-none focus:border-red-400/40"
                  style={{ background: "var(--input)", borderColor: "var(--border)", color: "var(--text)" }}
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <button type="button" onClick={() => void sendPrompt(voiceDraft, voiceDraft)} disabled={!voiceDraft.trim() || saving} className="rounded-2xl bg-gradient-to-br from-white via-red-100 to-red-200 px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">
                    Execute Voice Command
                  </button>
                  <button type="button" onClick={() => setVoiceDraft("")} className="rounded-2xl border px-5 py-3 text-sm font-black" style={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--text)" }}>
                    Clear
                  </button>
                </div>
              </div>
            </Card>

            <div className="grid gap-4">
              <Card className="p-5">
                <SectionHeader eyebrow="Natural Voice Patterns" title="Speak like a person." />
                <div className="mt-4 grid gap-3">
                  {voiceExamples.map((item) => (
                    <button key={item} type="button" onClick={() => setVoiceDraft(item)} className="rounded-[1.35rem] border p-4 text-left text-sm leading-6 transition hover:-translate-y-0.5 hover:border-red-400/30 hover:bg-red-500/10" style={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--muted2)" }}>
                      “{item}”
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-purple-300">Voice Execution Logic</div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <Metric label="Report Intent" value="PDF / report" helper="Creates report flow" tone="amber" />
                  <Metric label="Task Intent" value="Assign / task" helper="Prepares delegation" tone="green" />
                  <Metric label="Route Intent" value="Open / show" helper="Navigates platform" tone="cyan" />
                  <Metric label="Draft Intent" value="Email / note" helper="Creates client draft" tone="purple" />
                </div>
              </Card>
            </div>
          </section>
        ) : null}

        {activeTab === "tasks" ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <SectionHeader
                  eyebrow="Team Task Commander"
                  title="Create and assign Team Board tasks."
                  helper="Tasks can be manually refined here after Slice interprets a typed or spoken command."
                />
                <Pill tone={workspace?.firm ? "green" : "amber"}>
                  {workspaceLoading ? "Loading" : workspace?.firm?.name ?? "No firm"}
                </Pill>
              </div>

              <form onSubmit={createTeamTask} className="mt-5 grid gap-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Assign to</span>
                    <select value={selectedMemberId} onChange={(event) => setSelectedMemberId(event.target.value)} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none ring-red-500 focus:ring-2" style={{ background: "var(--input)", borderColor: "var(--border)", color: "var(--text)" }}>
                      {workspace?.members?.length ? (
                        workspace.members.map((member) => (
                          <option key={member.id} value={member.id}>
                            {safeMemberName(member)} · {member.role}
                          </option>
                        ))
                      ) : (
                        <option>No team members available</option>
                      )}
                    </select>
                  </label>

                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Project</span>
                    <select value={taskDraft.projectId} onChange={(event) => setTaskDraft((current) => ({ ...current, projectId: event.target.value }))} className="mt-2 w-full rounded-2xl border px-4 py-3 text-sm font-semibold outline-none ring-red-500 focus:ring-2" style={{ background: "var(--input)", borderColor: "var(--border)", color: "var(--text)" }}>
                      <option value="">No project</option>
                      {workspace?.projects?.map((project) => (
                        <option key={project.id} value={project.id}>
                          {project.title}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>

                <label>
                  <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Task title</span>
                  <ThemedInput value={taskDraft.title} onChange={(value) => setTaskDraft((current) => ({ ...current, title: value }))} placeholder="Review client briefing and prepare follow-up notes" />
                </label>

                <label>
                  <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Details</span>
                  <textarea value={taskDraft.detail} onChange={(event) => setTaskDraft((current) => ({ ...current, detail: event.target.value }))} placeholder="Explain expected output, context, client/advisor review notes..." className="mt-2 min-h-[120px] w-full resize-none rounded-2xl border px-4 py-3 text-sm font-semibold leading-6 outline-none ring-red-500 focus:ring-2" style={{ background: "var(--input)", borderColor: "var(--border)", color: "var(--text)" }} />
                </label>

                <div className="grid gap-4 md:grid-cols-4">
                  <ThemedSelect label="Priority" value={taskDraft.priority} options={["Critical", "High", "Medium", "Low"]} onChange={(value) => setTaskDraft((current) => ({ ...current, priority: value }))} />
                  <ThemedSelect label="Status" value={taskDraft.status} options={["Backlog", "To Do", "In Progress", "Review", "Blocked", "Complete"]} onChange={(value) => setTaskDraft((current) => ({ ...current, status: value }))} />
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Due</span>
                    <ThemedInput type="date" value={taskDraft.dueDate} onChange={(value) => setTaskDraft((current) => ({ ...current, dueDate: value }))} />
                  </label>
                  <label>
                    <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Reminder</span>
                    <ThemedInput type="datetime-local" value={taskDraft.reminderAt} onChange={(value) => setTaskDraft((current) => ({ ...current, reminderAt: value }))} />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_220px]">
                  <ThemedInput value={taskDraft.reminderNote} onChange={(value) => setTaskDraft((current) => ({ ...current, reminderNote: value }))} placeholder="Reminder note" />
                  <ToggleRow label="Notify email" checked={taskDraft.notifyEmail} onChange={(value) => setTaskDraft((current) => ({ ...current, notifyEmail: value }))} tone="green" />
                </div>

                <button type="submit" disabled={workspaceLoading} className="rounded-2xl bg-gradient-to-br from-white via-red-100 to-red-200 px-5 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-50">
                  {workspaceLoading ? "Creating Task..." : "Create Team Board Task"}
                </button>
              </form>
            </Card>

            <div className="grid gap-4">
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-green-300">Team Snapshot</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric label="Total" value={teamMetrics?.total ?? 0} helper="Tasks" tone="red" />
                  <Metric label="Open" value={teamMetrics?.open ?? 0} helper="Not complete" tone="amber" />
                  <Metric label="Progress" value={teamMetrics?.inProgress ?? 0} helper="Active" tone="purple" />
                  <Metric label="Complete" value={teamMetrics?.complete ?? 0} helper="Done" tone="green" />
                </div>
                <Link href="/workspace/team-board" prefetch={false} className="mt-4 inline-flex rounded-2xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-sm font-black text-green-100">
                  Open Team Board
                </Link>
              </Card>

              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Recent Team Tasks</div>
                <div className="mt-4 grid gap-3">
                  {(workspace?.operations?.allTasks ?? []).slice(0, 6).map((task) => (
                    <Panel key={task.id} tone={toneFor(task.priority)}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black" style={{ color: "var(--text)" }}>{task.title}</div>
                          <div className="mt-1 truncate text-[10px] font-semibold" style={{ color: "var(--muted)" }}>
                            {task.ownerName ?? "Team"} · {task.dueDate ?? "No due date"}
                          </div>
                        </div>
                        <Pill tone={toneFor(task.priority)}>{task.priority}</Pill>
                      </div>
                    </Panel>
                  ))}

                  {!workspace?.operations?.allTasks?.length ? (
                    <div className="rounded-2xl border border-dashed p-4 text-sm" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                      No team tasks loaded yet.
                    </div>
                  ) : null}
                </div>
              </Card>
            </div>
          </section>
        ) : null}

        {activeTab === "reports" ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_460px]">
            <Card className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <SectionHeader
                  eyebrow="Advanced Slice Report Studio"
                  title="Create reports that always open."
                  helper="Reports open through a normal browser viewer first. If raw browser PDF rendering fails, the HTML viewer still works and can be printed or saved as PDF."
                />
                <Pill tone="red">{reports.length} reports</Pill>
              </div>

              <div className="mt-5 grid gap-4">
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
                  <textarea value={reportTopic} onChange={(event) => setReportTopic(event.target.value)} className="min-h-[220px] w-full resize-none rounded-2xl border px-4 py-3 text-sm font-semibold leading-6 outline-none ring-red-500 focus:ring-2" style={{ background: "var(--input)", borderColor: "var(--border)", color: "var(--text)" }} placeholder="Describe the report you want Slice to generate..." />

                  <Panel tone="amber">
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">Report Defaults</div>
                    <div className="mt-3 grid gap-2 text-xs leading-5" style={{ color: "var(--muted)" }}>
                      <div>Style: {advancedSettings.reportStyle}</div>
                      <div>Depth: {advancedSettings.reportDepth}</div>
                      <div>Assumptions: {advancedSettings.includeAssumptions ? "Included" : "Hidden"}</div>
                      <div>Risk notes: {advancedSettings.includeRiskNotes ? "Included" : "Hidden"}</div>
                      <div>Checklist: {advancedSettings.includeReviewChecklist ? "Included" : "Hidden"}</div>
                    </div>
                    <button type="button" onClick={() => setActiveTab("settings")} className="mt-4 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-2 text-xs font-black text-amber-100">
                      Edit Defaults
                    </button>
                  </Panel>
                </div>

                <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {advancedReportBlueprints.map((blueprint) => (
                    <button key={blueprint.title} type="button" onClick={() => setReportTopic(blueprint.prompt)} className="rounded-2xl border p-4 text-left transition hover:bg-red-500/10" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
                      <Pill tone={blueprint.tone}>{blueprint.title}</Pill>
                      <p className="mt-3 line-clamp-3 text-xs leading-5" style={{ color: "var(--muted)" }}>{blueprint.prompt}</p>
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  {reportBlueprints.map((blueprint) => (
                    <button key={blueprint} type="button" onClick={() => setReportTopic(blueprint)} className="rounded-2xl border p-3 text-left text-xs font-black transition hover:bg-red-500/10" style={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--text)" }}>
                      {blueprint}
                    </button>
                  ))}
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <button type="button" onClick={() => generateReport(reportTopic)} disabled={saving} className="rounded-2xl bg-gradient-to-br from-white via-red-100 to-red-200 px-5 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-50">
                    Generate Report
                  </button>

                  <button type="button" onClick={() => generateReport("Report from latest Slice AI answer", latestAssistant?.content || "No latest answer available. Create a report explaining Slice AI Studio capability.")} disabled={saving} className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-black text-red-100 transition hover:-translate-y-0.5 disabled:opacity-50">
                    Use Latest Answer
                  </button>

                  <button type="button" onClick={() => window.print()} className="rounded-2xl border px-5 py-3 text-sm font-black transition hover:-translate-y-0.5" style={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--text)" }}>
                    Print Studio View
                  </button>
                </div>

                <div className="grid gap-3 md:grid-cols-3">
                  <Panel tone="green">
                    <div className="text-sm font-black" style={{ color: "var(--text)" }}>Reliable Opening</div>
                    <p className="mt-2 text-xs leading-5" style={{ color: "var(--muted)" }}>
                      Opens through `/workspace/personal-bot/reports` instead of relying only on raw PDF rendering.
                    </p>
                  </Panel>
                  <Panel tone="red">
                    <div className="text-sm font-black" style={{ color: "var(--text)" }}>Raw PDF Fallback</div>
                    <p className="mt-2 text-xs leading-5" style={{ color: "var(--muted)" }}>
                      The original PDF endpoint remains available if the browser supports it.
                    </p>
                  </Panel>
                  <Panel tone="amber">
                    <div className="text-sm font-black" style={{ color: "var(--text)" }}>Print to PDF</div>
                    <p className="mt-2 text-xs leading-5" style={{ color: "var(--muted)" }}>
                      The browser viewer can be printed or saved as PDF even if the raw PDF route fails.
                    </p>
                  </Panel>
                </div>
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Report Library</div>

              <div className="mt-4 grid gap-3">
                {reports.slice(0, 8).map((report) => (
                  <ReportLibraryCard key={report.id} report={report} />
                ))}

                {!reports.length ? (
                  <div className="rounded-3xl border border-dashed p-6 text-center text-sm leading-6" style={{ borderColor: "var(--border)", color: "var(--muted)" }}>
                    No reports yet. Generate one from the report builder.
                  </div>
                ) : null}
              </div>
            </Card>
          </section>
        ) : null}

        {activeTab === "settings" ? (
          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card className="p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <SectionHeader
                  eyebrow="Enhanced Settings"
                  title="Make Slice yours."
                  helper="Account, security, privacy, notifications, appearance, AI behavior, support, and account control live here in one premium settings center."
                />
                <div className="flex flex-wrap gap-2">
                  <button type="button" onClick={saveAccountSettings} disabled={accountSaving} className="rounded-2xl bg-gradient-to-br from-white via-red-100 to-red-200 px-5 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-50">
                    {accountSaving ? "Saving..." : "Save All"}
                  </button>
                  <button type="button" onClick={logout} className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-black text-red-100">
                    Logout
                  </button>
                </div>
              </div>

              <div className="mt-5 grid gap-3">
                <details open className="rounded-[1.5rem] border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
                  <summary className="cursor-pointer text-sm font-black" style={{ color: "var(--text)" }}>Account & profile</summary>

                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label>
                        <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Name</span>
                        <ThemedInput value={accountSettings.account.name} onChange={(value) => updateAccount("name", value)} placeholder="Your name" />
                      </label>
                      <label>
                        <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Email</span>
                        <ThemedInput value={accountSettings.account.email} onChange={(value) => updateAccount("email", value)} placeholder="you@example.com" />
                      </label>
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <label>
                        <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Phone</span>
                        <ThemedInput value={accountSettings.account.phone} onChange={(value) => updateAccount("phone", value)} placeholder="(555) 555-5555" />
                      </label>
                      <ThemedSelect
                        label="Timezone"
                        value={accountSettings.account.timezone}
                        options={["America/Phoenix", "America/Chicago", "America/New_York", "America/Los_Angeles", "America/Denver"]}
                        onChange={(value) => updateAccount("timezone", value)}
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <Metric label="Status" value={accountSettings.account.platformStatus || "Active"} helper="Account state" tone={toneFor(accountSettings.account.platformStatus)} />
                      <Metric label="Email" value={accountSettings.account.email || "—"} helper="Login identity" tone="cyan" />
                      <Metric label="Phone" value={accountSettings.account.phone || "Not set"} helper="Optional contact" tone="purple" />
                    </div>
                  </div>
                </details>

                <details open className="rounded-[1.5rem] border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
                  <summary className="cursor-pointer text-sm font-black" style={{ color: "var(--text)" }}>Appearance & personalization</summary>

                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <ThemedSelect
                        label="Theme"
                        value={accountSettings.appearance.mode}
                        options={["dark", "light", "system"]}
                        onChange={(value) => updateAppearance("mode", value)}
                        helper="Applies to AI Studio immediately."
                      />
                      <ThemedSelect
                        label="Density"
                        value={accountSettings.appearance.density}
                        options={["Comfortable", "Compact", "Spacious"]}
                        onChange={(value) => updateAppearance("density", value)}
                      />
                      <ThemedSelect
                        label="Accent"
                        value={accountSettings.appearance.accent}
                        options={["Slice Red", "Crimson", "Ruby", "Graphite"]}
                        onChange={(value) => updateAppearance("accent", value)}
                      />
                    </div>

                    <div className="grid gap-3 md:grid-cols-3">
                      <Panel tone="red">
                        <div className="text-sm font-black" style={{ color: "var(--text)" }}>Theme preview</div>
                        <p className="mt-2 text-xs leading-5" style={{ color: "var(--muted)" }}>
                          Text, panels, inputs, cards, and backgrounds respond to the selected mode.
                        </p>
                      </Panel>
                      <Panel tone="purple">
                        <div className="text-sm font-black" style={{ color: "var(--text)" }}>Unique workspace</div>
                        <p className="mt-2 text-xs leading-5" style={{ color: "var(--muted)" }}>
                          Density and accent make each user’s platform feel personalized.
                        </p>
                      </Panel>
                      <Panel tone="cyan">
                        <div className="text-sm font-black" style={{ color: "var(--text)" }}>System mode</div>
                        <p className="mt-2 text-xs leading-5" style={{ color: "var(--muted)" }}>
                          System follows the device light/dark preference automatically.
                        </p>
                      </Panel>
                    </div>
                  </div>
                </details>

                <details className="rounded-[1.5rem] border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
                  <summary className="cursor-pointer text-sm font-black" style={{ color: "var(--text)" }}>Notifications & alerts</summary>

                  <div className="mt-4 grid gap-3">
                    {accountSettings.notifications.map((item, index) => (
                      <div key={item.channel} className="rounded-[1.35rem] border p-4" style={{ background: "var(--panel2)", borderColor: "var(--border)" }}>
                        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                          <div>
                            <div className="text-lg font-black" style={{ color: "var(--text)" }}>{item.channel}</div>
                            <p className="text-xs" style={{ color: "var(--muted)" }}>
                              Alert threshold, quiet hours, cooldown, and digest behavior.
                            </p>
                          </div>
                          <ToggleRow label="Enabled" checked={item.enabled} onChange={(value) => updateNotification(index, { enabled: value })} tone="green" />
                        </div>

                        <div className="mt-4 grid gap-3 md:grid-cols-5">
                          <ThemedSelect
                            label="Urgency"
                            value={item.minUrgency}
                            options={["Low", "Medium", "High", "Critical"]}
                            onChange={(value) => updateNotification(index, { minUrgency: value })}
                          />
                          <label>
                            <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Score</span>
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
                        </div>

                        <div className="mt-3">
                          <ToggleRow label="Digest only" checked={item.digestOnly} onChange={(value) => updateNotification(index, { digestOnly: value })} tone="amber" />
                        </div>
                      </div>
                    ))}
                  </div>
                </details>

                <details className="rounded-[1.5rem] border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
                  <summary className="cursor-pointer text-sm font-black" style={{ color: "var(--text)" }}>Security</summary>

                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <ToggleRow label="Multi-factor authentication" helper="UI-ready setting. Connect MFA provider when ready." checked={accountSettings.security.mfaEnabled} onChange={(value) => updateSecurity("mfaEnabled", value)} tone="green" />
                      <ToggleRow label="Require re-auth for sensitive actions" checked={accountSettings.security.requireReauthForSensitiveActions} onChange={(value) => updateSecurity("requireReauthForSensitiveActions", value)} tone="red" />
                      <ToggleRow label="Alert on new login" checked={accountSettings.security.alertOnNewLogin} onChange={(value) => updateSecurity("alertOnNewLogin", value)} tone="amber" />
                      <ToggleRow label="Advisor mode" helper="Extra review posture for client-facing actions." checked={accountSettings.security.advisorModeEnabled} onChange={(value) => updateSecurity("advisorModeEnabled", value)} tone="purple" />
                    </div>

                    <label>
                      <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Session timeout minutes</span>
                      <ThemedInput type="number" value={accountSettings.security.sessionTimeoutMinutes} onChange={(value) => updateSecurity("sessionTimeoutMinutes", Number(value))} />
                    </label>

                    <div className="flex flex-wrap gap-2">
                      <button type="button" onClick={requestPasswordReset} disabled={accountSaving} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm font-black text-amber-100 disabled:opacity-50">
                        Send Password Reset Email
                      </button>
                      <button type="button" onClick={logout} className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-black text-red-100">
                        Logout Now
                      </button>
                    </div>
                  </div>
                </details>

                <details className="rounded-[1.5rem] border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
                  <summary className="cursor-pointer text-sm font-black" style={{ color: "var(--text)" }}>Privacy & data controls</summary>

                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-3 md:grid-cols-2">
                      <ToggleRow label="AI memory" helper="Allow Slice to remember preferences and workflow style." checked={accountSettings.privacy.aiMemoryEnabled} onChange={(value) => updatePrivacy("aiMemoryEnabled", value)} tone="purple" />
                      <ToggleRow label="Personalization" helper="Use preferences to tailor UI and AI behavior." checked={accountSettings.privacy.personalizationEnabled} onChange={(value) => updatePrivacy("personalizationEnabled", value)} tone="green" />
                      <ToggleRow label="Analytics" helper="Use platform analytics to improve the user experience." checked={accountSettings.privacy.analyticsEnabled} onChange={(value) => updatePrivacy("analyticsEnabled", value)} tone="cyan" />
                      <ToggleRow label="Usage improvement sharing" helper="Optional product improvement signal." checked={accountSettings.privacy.shareUsageForImprovement} onChange={(value) => updatePrivacy("shareUsageForImprovement", value)} tone="amber" />
                      <ToggleRow label="Marketing emails" checked={accountSettings.privacy.marketingEmailsEnabled} onChange={(value) => updatePrivacy("marketingEmailsEnabled", value)} tone="slate" />
                      <ToggleRow label="Show profile to team" checked={accountSettings.privacy.showProfileToTeam} onChange={(value) => updatePrivacy("showProfileToTeam", value)} tone="blue" />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <ThemedSelect label="Report retention" value={accountSettings.privacy.retainReports} options={["30 days", "90 days", "1 year", "Forever"]} onChange={(value) => updatePrivacy("retainReports", value)} />
                      <ThemedSelect label="Default export format" value={accountSettings.privacy.exportFormat} options={["PDF", "CSV", "JSON"]} onChange={(value) => updatePrivacy("exportFormat", value)} />
                    </div>
                  </div>
                </details>

                <details className="rounded-[1.5rem] border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
                  <summary className="cursor-pointer text-sm font-black" style={{ color: "var(--text)" }}>AI Studio behavior</summary>

                  <div className="mt-4 grid gap-4">
                    <label>
                      <span className="text-[10px] font-black uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Bot name</span>
                      <ThemedInput value={draftProfile.botName} onChange={(value) => setDraftProfile((current) => ({ ...current, botName: value }))} />
                    </label>

                    <div className="grid gap-4 md:grid-cols-3">
                      <ThemedSelect label="Tone" value={draftProfile.preferredTone} options={["Professional", "Calm", "Direct", "Encouraging", "Brutally honest", "Witty"]} onChange={(value) => setDraftProfile((current) => ({ ...current, preferredTone: value }))} />
                      <ThemedSelect label="Detail" value={draftProfile.commandStyle} options={["Short", "Balanced detail", "Detailed", "Deep research"]} onChange={(value) => setDraftProfile((current) => ({ ...current, commandStyle: value }))} />
                      <ThemedSelect label="Reply layout" value={advancedSettings.responseLayout} options={["Executive Summary", "Advisor Memo", "Client Friendly", "Action Plan"]} onChange={(value) => updateAdvancedSettings("responseLayout", value)} />
                    </div>

                    <div className="grid gap-4 md:grid-cols-3">
                      <ThemedSelect label="Default mode" value={advancedSettings.defaultAnswerMode} options={["quick", "balanced", "deep"]} onChange={(value) => updateAdvancedSettings("defaultAnswerMode", value)} />
                      <ToggleRow label="Compact replies" helper="Show preview first, full detail on demand." checked={advancedSettings.compactReplies} onChange={(value) => updateAdvancedSettings("compactReplies", value)} tone="green" />
                      <ToggleRow label="Auto-read replies" helper="Speak the newest assistant response." checked={advancedSettings.autoReadReplies} onChange={(value) => updateAdvancedSettings("autoReadReplies", value)} tone="purple" />
                    </div>

                    <textarea value={draftProfile.customInstructions} onChange={(event) => setDraftProfile((current) => ({ ...current, customInstructions: event.target.value }))} className="min-h-[150px] w-full resize-none rounded-2xl border px-4 py-3 text-sm font-semibold leading-6 outline-none ring-red-500 focus:ring-2" style={{ background: "var(--input)", borderColor: "var(--border)", color: "var(--text)" }} placeholder="Tell Slice AI how to answer, what to prioritize, what to avoid, and how to handle client-facing output..." />

                    <button type="button" onClick={saveProfile} disabled={saving} className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-5 py-3 text-sm font-black text-purple-100 disabled:opacity-50">
                      Save AI Behavior
                    </button>
                  </div>
                </details>

                <details className="rounded-[1.5rem] border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
                  <summary className="cursor-pointer text-sm font-black" style={{ color: "var(--text)" }}>Report defaults</summary>

                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-4 md:grid-cols-3">
                      <ThemedSelect label="Report style" value={advancedSettings.reportStyle} options={["Premium Red", "Boardroom", "Client Clean", "Technical"]} onChange={(value) => updateAdvancedSettings("reportStyle", value)} />
                      <ThemedSelect label="Report depth" value={advancedSettings.reportDepth} options={["Concise", "Balanced", "Full"]} onChange={(value) => updateAdvancedSettings("reportDepth", value)} />
                      <ToggleRow label="Review checklist" checked={advancedSettings.includeReviewChecklist} onChange={(value) => updateAdvancedSettings("includeReviewChecklist", value)} tone="amber" />
                    </div>

                    <div className="grid gap-4 md:grid-cols-2">
                      <ToggleRow label="Include assumptions" checked={advancedSettings.includeAssumptions} onChange={(value) => updateAdvancedSettings("includeAssumptions", value)} tone="green" />
                      <ToggleRow label="Include risk notes" checked={advancedSettings.includeRiskNotes} onChange={(value) => updateAdvancedSettings("includeRiskNotes", value)} tone="red" />
                    </div>
                  </div>
                </details>

                <details className="rounded-[1.5rem] border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
                  <summary className="cursor-pointer text-sm font-black" style={{ color: "var(--text)" }}>Task defaults</summary>

                  <div className="mt-4 grid gap-4">
                    <div className="grid gap-4 md:grid-cols-4">
                      <ThemedSelect label="Priority" value={advancedSettings.taskDefaultPriority} options={["Critical", "High", "Medium", "Low"]} onChange={(value) => updateAdvancedSettings("taskDefaultPriority", value)} />
                      <ThemedSelect label="Status" value={advancedSettings.taskDefaultStatus} options={["Backlog", "To Do", "In Progress", "Review", "Blocked", "Complete"]} onChange={(value) => updateAdvancedSettings("taskDefaultStatus", value)} />
                      <ThemedSelect label="Due date" value={advancedSettings.taskDueDays} options={["Today", "Tomorrow", "3 Days", "1 Week"]} onChange={(value) => updateAdvancedSettings("taskDueDays", value)} />
                      <ToggleRow label="Email notify" checked={advancedSettings.taskEmailDefault} onChange={(value) => updateAdvancedSettings("taskEmailDefault", value)} tone="green" />
                    </div>

                    <ThemedSelect
                      label="Approval style"
                      value={advancedSettings.approvalStyle}
                      options={["Advisor approval required", "Draft only", "Suggest only", "Autonomous where safe"]}
                      onChange={(value) => updateAdvancedSettings("approvalStyle", value)}
                      helper="Sensitive external communication and client-money workflows should remain advisor-reviewed."
                    />
                  </div>
                </details>

                <details open className="rounded-[1.5rem] border p-4" style={{ background: "var(--panel)", borderColor: "var(--border)" }}>
                  <summary className="cursor-pointer text-sm font-black" style={{ color: "var(--text)" }}>Contact us</summary>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <a href={accountSettings.contact.phoneHref} className="rounded-2xl border p-4 transition hover:bg-red-500/10" style={{ background: "var(--panel2)", borderColor: "var(--border)" }}>
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-red-300">Phone</div>
                      <div className="mt-2 text-xl font-black" style={{ color: "var(--text)" }}>{accountSettings.contact.phone}</div>
                      <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>Call or tap from mobile.</p>
                    </a>
                    <a href={accountSettings.contact.emailHref} className="rounded-2xl border p-4 transition hover:bg-red-500/10" style={{ background: "var(--panel2)", borderColor: "var(--border)" }}>
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-red-300">Email</div>
                      <div className="mt-2 break-all text-xl font-black" style={{ color: "var(--text)" }}>{accountSettings.contact.email}</div>
                      <p className="mt-1 text-xs" style={{ color: "var(--muted)" }}>Send a support or founder note.</p>
                    </a>
                  </div>
                </details>

                <details className="rounded-[1.5rem] border border-red-500/30 bg-red-500/10 p-4">
                  <summary className="cursor-pointer text-sm font-black text-red-100">Danger zone</summary>

                  <div className="mt-4 grid gap-4">
                    <Panel tone="amber">
                      <div className="text-sm font-black" style={{ color: "var(--text)" }}>Deactivate account</div>
                      <p className="mt-2 text-xs leading-5" style={{ color: "var(--muted)" }}>
                        This suspends access and logs you out. Type DEACTIVATE to confirm.
                      </p>
                      <ThemedInput value={deactivateConfirm} onChange={setDeactivateConfirm} placeholder="DEACTIVATE" />
                      <button type="button" onClick={deactivateAccount} disabled={accountSaving || deactivateConfirm !== "DEACTIVATE"} className="mt-3 rounded-2xl border border-amber-500/30 bg-amber-500/10 px-5 py-3 text-sm font-black text-amber-100 disabled:opacity-50">
                        Deactivate Account
                      </button>
                    </Panel>

                    <Panel tone="red">
                      <div className="text-sm font-black" style={{ color: "var(--text)" }}>Delete account</div>
                      <p className="mt-2 text-xs leading-5" style={{ color: "var(--muted)" }}>
                        This permanently deletes the user account and cascaded account data. Type DELETE MY ACCOUNT to confirm.
                      </p>
                      <ThemedInput value={deleteConfirm} onChange={setDeleteConfirm} placeholder="DELETE MY ACCOUNT" />
                      <button type="button" onClick={deleteAccount} disabled={accountSaving || deleteConfirm !== "DELETE MY ACCOUNT"} className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-black text-red-100 disabled:opacity-50">
                        Delete Account
                      </button>
                    </Panel>
                  </div>
                </details>

                <div className="grid gap-3 md:grid-cols-2">
                  <button type="button" onClick={saveAccountSettings} disabled={accountSaving} className="rounded-2xl bg-gradient-to-br from-white via-red-100 to-red-200 px-5 py-3 text-sm font-black text-slate-950 transition hover:-translate-y-0.5 disabled:opacity-50">
                    {accountSaving ? "Saving..." : "Save All Settings"}
                  </button>
                  <button type="button" onClick={logout} className="rounded-2xl border border-red-500/30 bg-red-500/10 px-5 py-3 text-sm font-black text-red-100">
                    Logout
                  </button>
                </div>
              </div>
            </Card>

            <div className="grid gap-4">
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-red-300">Account Snapshot</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric label="Name" value={accountSettings.account.name || "—"} helper="Profile" tone="red" />
                  <Metric label="Theme" value={accountSettings.appearance.mode} helper={accountSettings.appearance.density} tone="cyan" />
                  <Metric label="Voice Input" value={voiceSupported ? "Available" : "Unavailable"} helper={advancedSettings.voiceLanguage} tone={voiceSupported ? "green" : "slate"} />
                  <Metric label="Security" value={accountSettings.security.requireReauthForSensitiveActions ? "Protected" : "Standard"} helper="Sensitive actions" tone={accountSettings.security.requireReauthForSensitiveActions ? "green" : "amber"} />
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">Privacy + Memory</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric label="AI Memory" value={accountSettings.privacy.aiMemoryEnabled ? "On" : "Off"} helper="Preference learning" tone={accountSettings.privacy.aiMemoryEnabled ? "purple" : "slate"} />
                  <Metric label="Marketing" value={accountSettings.privacy.marketingEmailsEnabled ? "On" : "Off"} helper="Optional emails" tone={accountSettings.privacy.marketingEmailsEnabled ? "amber" : "green"} />
                  <Metric label="Approvals" value={approvals.length} helper="Open gates" tone={approvals.length ? "amber" : "green"} />
                  <Metric label="Memories" value={memories.length} helper="Stored prefs" tone={memories.length ? "purple" : "slate"} />
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">Quick Contact</div>
                <div className="mt-4 grid gap-3">
                  <a href={accountSettings.contact.phoneHref} className="rounded-2xl border p-4 text-sm font-black" style={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--text)" }}>
                    {accountSettings.contact.phone}
                  </a>
                  <a href={accountSettings.contact.emailHref} className="rounded-2xl border p-4 text-sm font-black" style={{ background: "var(--panel)", borderColor: "var(--border)", color: "var(--text)" }}>
                    {accountSettings.contact.email}
                  </a>
                </div>
              </Card>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}