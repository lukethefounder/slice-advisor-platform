"use client";

import Link from "next/link";
import type {
  ChangeEvent,
  FormEvent,
  KeyboardEvent,
  ReactNode,
} from "react";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  BrandMark,
  Card,
  Metric,
  Pill,
  SliceBackground,
  SoftCard,
  cx,
  type SliceTone,
} from "@/components/slice-ui";

type StudioTab = "command" | "voice" | "tasks" | "reports";
type AnswerMode = "quick" | "balanced" | "deep";
type OperatingMode =
  | "Research"
  | "Platform Ops"
  | "Advisor Brief"
  | "Client Safe";
type SourcePolicy = "Primary First" | "Balanced" | "Fast";
type VoiceLanguage = "en-US" | "en-GB" | "es-US";
type VoiceRate = "Slow" | "Normal" | "Fast";
type Priority = "Critical" | "High" | "Medium" | "Low";
type TaskStatus =
  | "Backlog"
  | "To Do"
  | "In Progress"
  | "Review"
  | "Blocked"
  | "Complete";

type AiSource = {
  type?: string;
  title: string;
  url: string;
};

type ClientAction = {
  type?: string;
  href?: string;
  pdfHref?: string;
  autoRun?: boolean;
  [key: string]: unknown;
};

type BotMessage = {
  id: string;
  role: string;
  content: string;
  intent: string;
  createdAt: string;
  metadata?: {
    clientAction?: ClientAction;
    universalAiProvider?: string;
    universalAiStatus?: string;
    universalAiError?: string;
    universalAiModel?: string;
    universalAiLatencyMs?: number;
    researchUsed?: boolean;
    sources?: AiSource[];
    fastRouterUsed?: boolean;
    fastRouterConfidence?: number;
    [key: string]: unknown;
  };
};

type BotCommand = {
  id: string;
  commandText: string;
  commandType: string;
  status: string;
  resultSummary: string | null;
  createdAt: string;
};

type PdfReport = {
  id: string;
  title: string;
  reportType: string;
  status: string;
  downloadUrl: string;
  viewerUrl?: string;
  createdAt?: string;
  summary?: string;
  design?: {
    provider?: string;
    model?: string;
    researchUsed?: boolean;
    sourceCount?: number;
    sources?: AiSource[];
  };
};

type AiHealth = {
  ok: boolean;
  configured: boolean;
  status: string;
  provider: string;
  model: string;
  latencyMs: number;
  error?: string;
  checkedAt: string;
};

type AudioRuntime = {
  configured: boolean;
  provider: string;
  transcriptionModel: string;
  speechModel: string;
  speechVoice: string;
  speechFormat: string;
};

type PlatformCapability = {
  key?: string;
  label?: string;
  route?: string;
  category?: string;
  description?: string;
  capabilities?: string[];
  exampleCommands?: string[];
};

type BotPayload = {
  profile: {
    id: string;
    botName: string;
    preferredTone: string;
    commandStyle: string;
    autonomyLevel: string;
    voiceEnabled: boolean;
    customInstructions: string | null;
    capabilities: string[];
  };

  aiEngine?: {
    provider: string;
    configured: boolean;
    health?: AiHealth;
    model: string;
    fastModel?: string;
    qualityModel?: string;
    webSearchEnabled?: boolean;
    audio?: AudioRuntime;
  };

  platformContext?: {
    generatedAt?: string;

    firm?: {
      id?: string | null;
      name?: string | null;
      role?: string | null;
    };

    metrics?: Record<string, number>;

    privacy?: {
      note?: string;
    };

    capabilities?: PlatformCapability[];
  } | null;

  messages: BotMessage[];
  commands: BotCommand[];

  tabs: Array<{
    id: string;
    tabName: string;
    pinnedCommands: string[];
    status: string;
  }>;

  pdfReports?: PdfReport[];

  approvals?: Array<{
    id: string;
    title: string;
    status: string;
  }>;

  backendApprovals?: Array<{
    id: string;
    title: string;
    status: string;
  }>;

  voiceSessions?: Array<{
    id: string;
    sessionKey: string;
    language: string;
    transcript: string;
    finalTranscript?: string | null;
    status: string;
    confidenceScore: number;
    createdAt: string;
  }>;

  lastExecution?: {
    intent: string;
    status: string;
    resultSummary: string;
    clientAction?: ClientAction;
    sources?: AiSource[];
    researchUsed?: boolean;
  } | null;
};

type FirmWorkspacePayload = {
  firm: {
    id: string;
    name: string;
  } | null;

  membership: {
    id: string;
    role: string;
    canManageProjects: boolean;
    canManageFirm: boolean;
  } | null;

  members: Array<{
    id: string;
    role: string;
    status: string;

    user?: {
      id: string;
      name: string;
      email: string;
    };
  }>;

  projects: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
  }>;

  operations?: {
    allTasks: Array<{
      id: string;
      title: string;
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
    };
  };
};

type VoiceRouteResponse = {
  ok: boolean;
  error?: string;
  detail?: string;
  sessionKey?: string;
  transcript?: string;

  result?: {
    answer?: string;
    status?: string;
    clientAction?: ClientAction;
    sources?: AiSource[];
    researchUsed?: boolean;
  } | null;

  performance?: {
    totalMs?: number;
    transcriptionMs?: number;
    executionMs?: number;
    fastRouterUsed?: boolean;
  };
};

type SpeechRecognitionAlternativeLike = {
  transcript: string;
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

type SpeechRecognitionConstructor =
  new () => SpeechRecognitionInstance;

type TaskDraft = {
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

type StudioPreferences = {
  operatingMode: OperatingMode;
  sourcePolicy: SourcePolicy;
  autoOpenActions: boolean;
  compactSources: boolean;
  showExecutionTrace: boolean;
  autoReadReplies: boolean;
  voiceAutoSend: boolean;
  voiceLanguage: VoiceLanguage;
  voiceRate: VoiceRate;
  reportDepth: "Balanced" | "Full";
  includeAssumptions: boolean;
  includeRiskNotes: boolean;
  includeReviewChecklist: boolean;
};

type PlatformRoute = {
  label: string;
  href: string;
  category: string;
  description: string;
};

const PREFERENCES_KEY =
  "slice-ai-studio-page-v9";

const DEFAULT_PREFERENCES: StudioPreferences = {
  operatingMode: "Research",
  sourcePolicy: "Primary First",
  autoOpenActions: true,
  compactSources: false,
  showExecutionTrace: true,
  autoReadReplies: false,
  voiceAutoSend: false,
  voiceLanguage: "en-US",
  voiceRate: "Normal",
  reportDepth: "Balanced",
  includeAssumptions: true,
  includeRiskNotes: true,
  includeReviewChecklist: true,
};

const TABS: Array<{
  id: StudioTab;
  label: string;
  helper: string;
}> = [
  {
    id: "command",
    label: "Command",
    helper: "Research and operate",
  },
  {
    id: "voice",
    label: "Voice Ops",
    helper: "Speak and execute",
  },
  {
    id: "tasks",
    label: "Tasks",
    helper: "Assign real work",
  },
  {
    id: "reports",
    label: "Reports",
    helper: "Source-backed output",
  },
];

const OPERATING_MODES: Array<{
  id: OperatingMode;
  helper: string;
}> = [
  {
    id: "Research",
    helper:
      "Current facts, sources, catalysts, and risks",
  },
  {
    id: "Platform Ops",
    helper:
      "Fast navigation and verified platform actions",
  },
  {
    id: "Advisor Brief",
    helper:
      "Decision-ready summaries with next steps",
  },
  {
    id: "Client Safe",
    helper:
      "Plain language prepared for advisor review",
  },
];

const QUICK_PROMPTS = [
  "Research NVDA with current primary sources, valuation context, catalysts, and downside risks.",
  "Summarize what needs my attention across Slice today.",
  "Search the firm for Apple exposure and related client-service tasks.",
  "Create a high-priority task to review the latest client briefing tomorrow.",
  "Create a source-backed report explaining current market volatility.",
  "Run backend vendor health and explain any failures.",
];

const REPORT_TEMPLATES = [
  {
    title:
      "Investment Research Memo",

    helper:
      "Thesis, valuation, catalysts, risks, and sources.",

    prompt:
      "Create a source-backed investment research memo with current facts, valuation context, bull and bear cases, catalysts, downside risks, data limitations, assumptions, visible sources, and advisor next steps.",
  },
  {
    title:
      "Client Review Packet",

    helper:
      "Market context, talking points, and follow-ups.",

    prompt:
      "Create a source-backed client portfolio review packet with an executive summary, current market context, risk discussion, advisor talking points, follow-up tasks, assumptions, visible sources, and an advisor review checklist.",
  },
  {
    title:
      "Market Volatility Brief",

    helper:
      "Current drivers, exact dates, and behavioral guidance.",

    prompt:
      "Create a current market-volatility report with verified drivers, exact dates, portfolio review questions, behavioral coaching, risk considerations, visible sources, and a compliance-conscious advisor checklist.",
  },
  {
    title:
      "Firm Operating Review",

    helper:
      "Priorities, tasks, approvals, and bottlenecks.",

    prompt:
      "Create an internal Slice firm operating review using accessible platform data, including priorities, tasks, approvals, client-service risks, workflow bottlenecks, action owners, and next steps. Do not invent external facts.",
  },
];

const FALLBACK_ROUTES: PlatformRoute[] = [
  {
    label: "Workspace",
    href: "/workspace",
    category: "Home",
    description:
      "Central Slice workspace",
  },
  {
    label: "Custom Board",
    href:
      "/workspace/custom-board",
    category: "Markets",
    description:
      "Advisor-owned security analysis board",
  },
  {
    label: "Watchlists",
    href:
      "/workspace/watchlists",
    category: "Markets",
    description:
      "Tracked securities, rules, and thresholds",
  },
  {
    label: "Market Visuals",
    href: "/market-visuals",
    category: "Markets",
    description:
      "Presentation-ready charts and market views",
  },
  {
    label: "Intelligence",
    href:
      "/workspace/intelligence",
    category:
      "Intelligence",
    description:
      "Technical and news monitoring",
  },
  {
    label: "Triage",
    href: "/triage",
    category:
      "Intelligence",
    description:
      "Review and prioritize market intelligence",
  },
  {
    label:
      "Opportunity Radar",
    href:
      "/opportunity-radar",
    category:
      "Intelligence",
    description:
      "Rank opportunities and supporting evidence",
  },
  {
    label:
      "Client Portal Inbox",
    href:
      "/workspace/client-portal-inbox",
    category: "Clients",
    description:
      "Client requests and portal activity",
  },
  {
    label:
      "Client Profiles",
    href:
      "/workspace/clients",
    category: "Clients",
    description:
      "Household, objective, and relationship context",
  },
  {
    label:
      "Client Email Center",
    href:
      "/workspace/client-emails",
    category:
      "Communication",
    description:
      "Advisor-reviewed communication drafts",
  },
  {
    label:
      "Client Briefings",
    href:
      "/workspace/client-briefings",
    category: "Reports",
    description:
      "Client-facing briefing workflows",
  },
  {
    label: "Team Board",
    href:
      "/workspace/team-board",
    category: "Team",
    description:
      "Tasks, projects, calendars, and documents",
  },
  {
    label:
      "Firm Command Center",
    href:
      "/workspace/firm-command-center",
    category: "Firm",
    description:
      "Firm oversight and operating metrics",
  },
  {
    label: "Portfolio Lab",
    href: "/portfolio-lab",
    category: "Portfolio",
    description:
      "Portfolio and allocation analysis",
  },
  {
    label: "Venture Monitor",
    href:
      "/alternative-investments?view=venture",
    category:
      "Alternatives",
    description:
      "Startup and venture tracking",
  },
  {
    label: "Penny Stocks",
    href:
      "/alternative-investments?view=penny-stocks",
    category:
      "Alternatives",
    description:
      "Speculative equity monitoring",
  },
  {
    label: "Crypto Markets",
    href:
      "/alternative-investments?view=crypto",
    category:
      "Alternatives",
    description:
      "Digital asset monitoring",
  },
  {
    label:
      "Watchlist Alerts",
    href:
      "/watchlist-alerts",
    category: "Alerts",
    description:
      "Price thresholds and alert status",
  },
  {
    label:
      "Backend Kernel",
    href: "/backend-kernel",
    category: "System",
    description:
      "Providers, jobs, queues, and integrations",
  },
  {
    label:
      "Backend Readiness",
    href:
      "/backend-readiness",
    category: "System",
    description:
      "Health, approvals, roles, and isolation",
  },
  {
    label: "Briefings",
    href: "/briefings",
    category: "Reports",
    description:
      "Advisor and client report center",
  },
  {
    label:
      "Security Center",
    href: "/security",
    category:
      "Governance",
    description:
      "Security, audit, and compliance controls",
  },
  {
    label:
      "Compliance Center",
    href:
      "/security?panel=compliance",
    category:
      "Governance",
    description:
      "Review gates and advisor guardrails",
  },
  {
    label:
      "Platform Settings",
    href:
      "/workspace/settings",
    category: "Settings",
    description:
      "Appearance, privacy, and platform preferences",
  },
];

function addDays(
  days: number,
) {
  const date =
    new Date();

  date.setDate(
    date.getDate() +
      days,
  );

  return date
    .toISOString()
    .slice(0, 10);
}

function statusTone(
  value:
    | string
    | number
    | null
    | undefined,
): SliceTone {
  const normalized =
    String(
      value ?? "",
    ).toLowerCase();

  const numeric =
    typeof value ===
    "number"
      ? value
      : Number.NaN;

  if (
    normalized.includes(
      "failed",
    ) ||
    normalized.includes(
      "error",
    ) ||
    normalized.includes(
      "blocked",
    ) ||
    normalized.includes(
      "invalid",
    ) ||
    (!Number.isNaN(
      numeric,
    ) &&
      numeric < 40)
  ) {
    return "red";
  }

  if (
    normalized.includes(
      "ready",
    ) ||
    normalized.includes(
      "complete",
    ) ||
    normalized.includes(
      "active",
    ) ||
    normalized.includes(
      "live",
    ) ||
    normalized.includes(
      "verified",
    ) ||
    (!Number.isNaN(
      numeric,
    ) &&
      numeric >= 75)
  ) {
    return "green";
  }

  if (
    normalized.includes(
      "pending",
    ) ||
    normalized.includes(
      "review",
    ) ||
    normalized.includes(
      "approval",
    ) ||
    normalized.includes(
      "queued",
    ) ||
    (!Number.isNaN(
      numeric,
    ) &&
      numeric >= 40 &&
      numeric < 75)
  ) {
    return "amber";
  }

  if (
    normalized.includes(
      "voice",
    ) ||
    normalized.includes(
      "model",
    )
  ) {
    return "purple";
  }

  if (
    normalized.includes(
      "research",
    ) ||
    normalized.includes(
      "source",
    )
  ) {
    return "cyan";
  }

  return "slate";
}

function formatDate(
  value?: string | null,
) {
  if (!value) {
    return "—";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "—";
  }

  return date.toLocaleString(
    undefined,
    {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    },
  );
}

function relativeTime(
  value?: string | null,
) {
  if (!value) {
    return "Never";
  }

  const date =
    new Date(value);

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "Unknown";
  }

  const minutes =
    Math.max(
      0,
      Math.round(
        (Date.now() -
          date.getTime()) /
          60_000,
      ),
    );

  if (minutes < 1) {
    return "Just now";
  }

  if (minutes < 60) {
    return `${minutes}m ago`;
  }

  const hours =
    Math.round(
      minutes / 60,
    );

  return hours < 24
    ? `${hours}h ago`
    : `${Math.round(
        hours / 24,
      )}d ago`;
}

function reportViewerHref(
  report: PdfReport,
) {
  if (report.viewerUrl) {
    return report.viewerUrl;
  }

  try {
    const base =
      typeof window ===
      "undefined"
        ? "http://localhost"
        : window.location
            .origin;

    const token =
      new URL(
        report.downloadUrl,
        base,
      ).searchParams.get(
        "token",
      );

    return token
      ? `/workspace/personal-bot/reports?token=${encodeURIComponent(
          token,
        )}`
      : report.downloadUrl;
  } catch {
    return report.downloadUrl;
  }
}

function stripForSpeech(
  value: string,
) {
  return value
    .replace(
      /https?:\/\/\S+/g,
      "A supporting link is available in the written response.",
    )
    .replace(
      /[`*_>#]/g,
      "",
    )
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 12_000);
}

function recorderMimeType() {
  if (
    typeof MediaRecorder ===
      "undefined" ||
    typeof MediaRecorder
      .isTypeSupported !==
      "function"
  ) {
    return "";
  }

  return (
    [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/mp4",
      "audio/ogg;codecs=opus",
    ].find((value) =>
      MediaRecorder.isTypeSupported(
        value,
      ),
    ) ?? ""
  );
}

function Surface({
  children,
  className,
  accent = "red",
}: {
  children: ReactNode;
  className?: string;
  accent?:
    | "red"
    | "cyan"
    | "purple"
    | "amber"
    | "green";
}) {
  const gradients: Record<
    typeof accent,
    string
  > = {
    red:
      "from-emerald-950/[0.12]",
    cyan:
      "from-cyan-950/[0.09]",
    purple:
      "from-purple-950/[0.09]",
    amber:
      "from-amber-950/[0.08]",
    green:
      "from-emerald-950/[0.08]",
  };

  return (
    <Card
      className={cx(
        "relative overflow-hidden !border-white/[0.10] !bg-[#050505]/95 shadow-[0_24px_80px_rgba(0,0,0,0.55)]",
        className,
      )}
    >
      <div
        className={cx(
          "pointer-events-none absolute inset-0 bg-gradient-to-br via-transparent to-transparent",
          gradients[accent],
        )}
      />

      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />

      <div className="relative">
        {children}
      </div>
    </Card>
  );
}

function Heading({
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
      <div className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400">
        {eyebrow}
      </div>

      <h2 className="mt-2 text-2xl font-black tracking-tight text-white md:text-3xl">
        {title}
      </h2>

      {helper ? (
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-300">
          {helper}
        </p>
      ) : null}
    </div>
  );
}

function Button({
  children,
  onClick,
  disabled,
  variant = "primary",
  type = "button",
}: {
  children: ReactNode;
  onClick?: () => void;
  disabled?: boolean;
  variant?:
    | "primary"
    | "secondary"
    | "ghost"
    | "danger";
  type?:
    | "button"
    | "submit";
}) {
  const styles = {
    primary:
      "border-white/20 bg-white text-slate-950 hover:bg-emerald-50 shadow-lg shadow-black/40",

    secondary:
      "border-emerald-400/25 bg-emerald-950/20 text-emerald-100 hover:border-emerald-300/40 hover:bg-emerald-950/30",

    ghost:
      "border-white/10 bg-white/[0.04] text-slate-200 hover:border-white/20 hover:bg-white/[0.07]",

    danger:
      "border-emerald-500/30 bg-emerald-950/25 text-emerald-100 hover:bg-emerald-900/30",
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={cx(
        "rounded-2xl border px-4 py-2.5 text-xs font-black transition hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-45",
        styles[variant],
      )}
    >
      {children}
    </button>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-300">
        {label}
      </span>

      <div className="mt-2">
        {children}
      </div>
    </label>
  );
}

function Sources({
  sources,
  compact,
}: {
  sources: AiSource[];
  compact: boolean;
}) {
  if (!sources.length) {
    return null;
  }

  return (
    <div className="mt-5">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.22em] text-cyan-300">
          Supporting sources
        </div>

        <Pill tone="cyan">
          {sources.length} links
        </Pill>
      </div>

      <div className="mt-3 grid gap-2 md:grid-cols-2">
        {sources
          .slice(
            0,
            compact ? 4 : 8,
          )
          .map(
            (
              source,
              index,
            ) => (
              <a
                key={`${source.url}-${index}`}
                href={source.url}
                target="_blank"
                rel="noreferrer"
                className="rounded-2xl border border-cyan-500/20 bg-[#080b0c] p-3 transition hover:border-cyan-300/40 hover:bg-cyan-950/20"
              >
                <div className="line-clamp-2 text-xs font-black text-white">
                  {source.title ||
                    `Source ${
                      index + 1
                    }`}
                </div>

                <div className="mt-1 truncate text-[10px] text-cyan-200/70">
                  {source.url}
                </div>
              </a>
            ),
          )}
      </div>
    </div>
  );
}

function ExecutionTrace({
  message,
  action,
  sourceCount,
}: {
  message?: BotMessage;
  action?: ClientAction;
  sourceCount: number;
}) {
  const steps: Array<{
    label: string;
    status: string;
    helper: string;
    tone: SliceTone;
  }> = [
    {
      label: "Interpret",

      status: message
        ? "Complete"
        : "Waiting",

      helper:
        message?.intent ||
        "Classify the request",

      tone: message
        ? "green"
        : "slate",
    },
    {
      label: "Research",

      status: message
        ?.metadata
        ?.researchUsed
        ? "Complete"
        : "Not required",

      helper: message
        ?.metadata
        ?.researchUsed
        ? `${sourceCount} visible source${
            sourceCount === 1
              ? ""
              : "s"
          }`
        : "Platform context only",

      tone: message
        ?.metadata
        ?.researchUsed
        ? "cyan"
        : "slate",
    },
    {
      label: "Execute",

      status: action?.href
        ? "Ready"
        : "No route",

      helper: action?.href
        ? String(
            action.type ||
              "Verified result",
          )
        : "Answer completed",

      tone: action?.href
        ? "green"
        : "slate",
    },
    {
      label: "Audit",

      status: message
        ? "Stored"
        : "Waiting",

      helper:
        "Message and command metadata",

      tone: message
        ? "purple"
        : "slate",
    },
  ];

  return (
    <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
      {steps.map(
        (
          step,
          index,
        ) => (
          <div
            key={step.label}
            className="rounded-2xl border border-white/10 bg-black/55 p-3"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-300">
                {String(
                  index + 1,
                ).padStart(
                  2,
                  "0",
                )}{" "}
                · {step.label}
              </span>

              <Pill
                tone={
                  step.tone
                }
              >
                {step.status}
              </Pill>
            </div>

            <p className="mt-2 line-clamp-2 text-[10px] leading-4 text-slate-300">
              {step.helper}
            </p>
          </div>
        ),
      )}
    </div>
  );
}

export default function PersonalBotPage() {
  const [
    data,
    setData,
  ] =
    useState<
      BotPayload | null
    >(null);

  const [
    workspace,
    setWorkspace,
  ] =
    useState<
      FirmWorkspacePayload | null
    >(null);

  const [
    activeTab,
    setActiveTab,
  ] =
    useState<StudioTab>(
      "command",
    );

  const [
    answerMode,
    setAnswerMode,
  ] =
    useState<AnswerMode>(
      "balanced",
    );

  const [
    prompt,
    setPrompt,
  ] = useState("");

  const [
    voiceDraft,
    setVoiceDraft,
  ] = useState("");

  const [
    reportPrompt,
    setReportPrompt,
  ] = useState(
    REPORT_TEMPLATES[0]
      .prompt,
  );

  const [
    notice,
    setNotice,
  ] = useState("");

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    busy,
    setBusy,
  ] = useState(false);

  const [
    verifying,
    setVerifying,
  ] = useState(false);

  const [
    refreshing,
    setRefreshing,
  ] = useState(false);

  const [
    recording,
    setRecording,
  ] = useState(false);

  const [
    transcribing,
    setTranscribing,
  ] = useState(false);

  const [
    listening,
    setListening,
  ] = useState(false);

  const [
    speaking,
    setSpeaking,
  ] = useState(false);

  const [
    elapsedSeconds,
    setElapsedSeconds,
  ] = useState(0);

  const [
    requestStartedAt,
    setRequestStartedAt,
  ] =
    useState<
      number | null
    >(null);

  const [
    recorderSupported,
    setRecorderSupported,
  ] = useState(false);

  const [
    browserSpeechSupported,
    setBrowserSpeechSupported,
  ] = useState(false);

  const [
    voiceSessionKey,
    setVoiceSessionKey,
  ] = useState("");

  const [
    selectedMemberId,
    setSelectedMemberId,
  ] = useState("");

  const [
    preferences,
    setPreferences,
  ] =
    useState<StudioPreferences>(
      DEFAULT_PREFERENCES,
    );

  const [
    task,
    setTask,
  ] =
    useState<TaskDraft>({
      title: "",
      detail: "",
      priority: "Medium",
      status: "To Do",
      dueDate:
        addDays(1),
      reminderAt: "",
      reminderNote: "",
      projectId: "",
      notifyEmail: true,
    });

  const recognitionRef =
    useRef<
      SpeechRecognitionInstance | null
    >(null);

  const recorderRef =
    useRef<
      MediaRecorder | null
    >(null);

  const streamRef =
    useRef<
      MediaStream | null
    >(null);

  const chunksRef =
    useRef<Blob[]>([]);

  const audioRef =
    useRef<
      HTMLAudioElement | null
    >(null);

  const audioUrlRef =
    useRef<
      string | null
    >(null);

  const requestControllerRef =
    useRef<
      AbortController | null
    >(null);

  const health =
    data?.aiEngine
      ?.health;

  const audio =
    data?.aiEngine
      ?.audio;

  const messages =
    data?.messages ?? [];

  const commands =
    data?.commands ?? [];

  const reports =
    data?.pdfReports ?? [];

  const voiceSessions =
    data?.voiceSessions ??
    [];

  const metrics =
    data?.platformContext
      ?.metrics ?? {};

  const approvals = [
    ...(data?.approvals ??
      []),

    ...(data?.backendApprovals ??
      []),
  ];

  const latestAssistant =
    useMemo(
      () =>
        [...messages]
          .reverse()
          .find(
            (item) =>
              item.role ===
              "assistant",
          ),
      [messages],
    );

  const latestUser =
    useMemo(
      () =>
        [...messages]
          .reverse()
          .find(
            (item) =>
              item.role ===
              "user",
          ),
      [messages],
    );

  const latestSources =
    latestAssistant
      ?.metadata
      ?.sources ??
    data?.lastExecution
      ?.sources ??
    [];

  const latestAction =
    latestAssistant
      ?.metadata
      ?.clientAction ??
    data?.lastExecution
      ?.clientAction;

  const pinnedCommands =
    useMemo(() => {
      const tab =
        data?.tabs.find(
          (item) =>
            item.tabName ===
              "AI Studio" ||
            item.tabName ===
              "My Bot",
        );

      return tab
        ?.pinnedCommands
        ?.length
        ? tab.pinnedCommands
        : QUICK_PROMPTS;
    }, [data?.tabs]);

  const platformRoutes =
    useMemo<
      PlatformRoute[]
    >(() => {
      const supplied =
        data?.platformContext
          ?.capabilities
          ?.filter(
            (item) =>
              item.label &&
              item.route,
          )
          .map(
            (item) => ({
              label:
                item.label as string,

              href:
                item.route as string,

              category:
                item.category ||
                "Platform",

              description:
                item.description ||
                item.capabilities?.join(
                  ", ",
                ) ||
                "Slice platform capability",
            }),
          );

      return supplied?.length
        ? supplied
        : FALLBACK_ROUTES;
    }, [
      data?.platformContext
        ?.capabilities,
    ]);

  const readiness =
    useMemo(() => {
      let score = 30;

      if (health?.ok) {
        score += 30;
      }

      if (
        data?.aiEngine
          ?.webSearchEnabled
      ) {
        score += 12;
      }

      if (
        audio?.configured
      ) {
        score += 10;
      }

      if (workspace?.firm) {
        score += 8;
      }

      if (reports.length) {
        score += 5;
      }

      if (
        !approvals.length
      ) {
        score += 5;
      }

      return Math.min(
        100,
        score,
      );
    }, [
      approvals.length,
      audio?.configured,
      data?.aiEngine
        ?.webSearchEnabled,
      health?.ok,
      reports.length,
      workspace?.firm,
    ]);

  async function loadBot() {
    const response =
      await fetch(
        "/api/personal-bot",
        {
          cache:
            "no-store",
        },
      );

    const payload =
      (await response.json()) as
        BotPayload & {
          error?: string;
          detail?: string;
        };

    if (!response.ok) {
      throw new Error(
        payload.detail ||
          payload.error ||
          "AI Studio could not load.",
      );
    }

    setData({
      ...payload,

      messages:
        payload.messages
          .length > 12
          ? payload.messages.slice(
              -12,
            )
          : payload.messages,
    });
  }

  async function loadWorkspace() {
    const response =
      await fetch(
        "/api/firm-workspace",
        {
          cache:
            "no-store",
        },
      );

    if (!response.ok) {
      setWorkspace(null);
      return;
    }

    const payload =
      (await response.json()) as
        FirmWorkspacePayload;

    setWorkspace(payload);

    if (
      !selectedMemberId &&
      payload.members[0]
    ) {
      setSelectedMemberId(
        payload.members[0].id,
      );
    }
  }

  async function refreshAll() {
    setRefreshing(true);
    setNotice("");

    try {
      await Promise.all([
        loadBot(),
        loadWorkspace(),
      ]);

      setNotice(
        "AI Studio context refreshed from current Slice records.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Context refresh failed.",
      );
    } finally {
      setRefreshing(false);
    }
  }

  function openClientAction(
    action?: ClientAction,
  ) {
    if (!action?.href) {
      return;
    }

    if (
      action.type ===
        "report" ||
      action.type ===
        "source"
    ) {
      window.open(
        action.href,
        "_blank",
        "noopener,noreferrer",
      );

      return;
    }

    window.location.assign(
      action.href,
    );
  }

  function maybeAutoOpen(
    action?: ClientAction,
  ) {
    if (
      preferences.autoOpenActions &&
      action?.autoRun
    ) {
      openClientAction(
        action,
      );
    }
  }

  async function verifyAi() {
    setVerifying(true);
    setNotice("");

    try {
      const response =
        await fetch(
          "/api/personal-bot",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "verifyAi",
              }),
          },
        );

      const payload =
        (await response.json()) as
          BotPayload & {
            error?: string;
            detail?: string;
          };

      if (!response.ok) {
        throw new Error(
          payload.detail ||
            payload.error ||
            "AI verification failed.",
        );
      }

      setData(payload);

      setNotice(
        payload.aiEngine
          ?.health?.ok
          ? `OpenAI verified through ${payload.aiEngine.health.model}.`
          : payload.aiEngine
                ?.health
                ?.error ||
              "AI verification failed.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "AI verification failed.",
      );
    } finally {
      setVerifying(false);
    }
  }

  async function sendCommand(
    command = prompt,
    voiceTranscript?: string,
    mode:
      AnswerMode =
      answerMode,
  ) {
    const clean =
      command.trim();

    if (!clean) {
      return;
    }

    requestControllerRef.current
      ?.abort();

    const controller =
      new AbortController();

    requestControllerRef.current =
      controller;

    setBusy(true);
    setNotice("");
    setPrompt("");

    setRequestStartedAt(
      Date.now(),
    );

    try {
      const response =
        await fetch(
          "/api/personal-bot",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            signal:
              controller.signal,

            body:
              JSON.stringify({
                action:
                  "sendMessage",

                prompt: clean,

                answerMode:
                  mode,

                voiceTranscript,

                currentPath:
                  "/workspace/personal-bot",

                pageTitle:
                  "Slice AI Studio",

                advancedSettings:
                  preferences,
              }),
          },
        );

      const payload =
        (await response.json()) as
          BotPayload & {
            error?: string;
            detail?: string;
          };

      if (!response.ok) {
        throw new Error(
          payload.detail ||
            payload.error ||
            "The command failed.",
        );
      }

      setData(payload);

      maybeAutoOpen(
        payload.lastExecution
          ?.clientAction,
      );

      const reply =
        [...payload.messages]
          .reverse()
          .find(
            (item) =>
              item.role ===
              "assistant",
          );

      if (
        preferences.autoReadReplies &&
        reply?.content
      ) {
        await speak(
          reply.content,
        );
      }
    } catch (error) {
      if (
        error instanceof Error &&
        error.name ===
          "AbortError"
      ) {
        setNotice(
          "The request was stopped before completion.",
        );
      } else {
        setNotice(
          error instanceof Error
            ? error.message
            : "The command failed.",
        );
      }
    } finally {
      if (
        requestControllerRef.current ===
        controller
      ) {
        requestControllerRef.current =
          null;
      }

      setBusy(false);

      setRequestStartedAt(
        null,
      );
    }
  }

  function stopRequest() {
    requestControllerRef.current
      ?.abort();

    requestControllerRef.current =
      null;

    setBusy(false);

    setRequestStartedAt(
      null,
    );
  }

  async function executeVoiceTranscript(
    transcript: string,
  ) {
    const clean =
      transcript.trim();

    if (!clean) {
      return;
    }

    setTranscribing(true);
    setNotice("");

    try {
      const response =
        await fetch(
          "/api/personal-bot/voice",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "transcribeAndExecute",

                transcript:
                  clean,

                fallbackTranscript:
                  clean,

                sessionKey:
                  voiceSessionKey ||
                  undefined,

                language:
                  preferences.voiceLanguage,

                answerMode,

                currentPath:
                  "/workspace/personal-bot",

                pageTitle:
                  "Slice AI Studio Voice Ops",

                recentMessages:
                  messages
                    .slice(-8)
                    .map(
                      (item) => ({
                        role:
                          item.role,

                        content:
                          item.content,
                      }),
                    ),

                advancedSettings:
                  preferences,
              }),
          },
        );

      const payload =
        (await response.json()) as
          VoiceRouteResponse;

      if (
        !response.ok ||
        !payload.ok
      ) {
        throw new Error(
          payload.detail ||
            payload.error ||
            "Voice command failed.",
        );
      }

      if (
        payload.sessionKey
      ) {
        setVoiceSessionKey(
          payload.sessionKey,
        );
      }

      if (
        payload.transcript
      ) {
        setVoiceDraft(
          payload.transcript,
        );
      }

      await loadBot();

      maybeAutoOpen(
        payload.result
          ?.clientAction,
      );

      if (
        preferences.autoReadReplies &&
        payload.result?.answer
      ) {
        await speak(
          payload.result.answer,
        );
      }

      if (
        payload.performance
          ?.totalMs
      ) {
        setNotice(
          `Voice command completed in ${payload.performance.totalMs} ms.`,
        );
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Voice command failed.",
      );
    } finally {
      setTranscribing(false);
    }
  }

  async function executeAudio(
    blob: Blob,
  ) {
    setTranscribing(true);
    setNotice("");

    try {
      const form =
        new FormData();

      form.set(
        "audio",

        new File(
          [blob],
          "slice-command.webm",
          {
            type:
              blob.type ||
              "audio/webm",
          },
        ),
      );

      form.set(
        "action",
        "transcribeAndExecute",
      );

      form.set(
        "language",
        preferences.voiceLanguage,
      );

      form.set(
        "answerMode",
        answerMode,
      );

      form.set(
        "currentPath",
        "/workspace/personal-bot",
      );

      form.set(
        "pageTitle",
        "Slice AI Studio Voice Ops",
      );

      form.set(
        "advancedSettings",

        JSON.stringify(
          preferences,
        ),
      );

      form.set(
        "recentMessages",

        JSON.stringify(
          messages
            .slice(-8)
            .map(
              (item) => ({
                role:
                  item.role,

                content:
                  item.content,
              }),
            ),
        ),
      );

      if (voiceSessionKey) {
        form.set(
          "sessionKey",
          voiceSessionKey,
        );
      }

      const response =
        await fetch(
          "/api/personal-bot/voice",
          {
            method: "POST",
            body: form,
          },
        );

      const payload =
        (await response.json()) as
          VoiceRouteResponse;

      if (
        !response.ok ||
        !payload.ok
      ) {
        throw new Error(
          payload.detail ||
            payload.error ||
            payload.result
              ?.answer ||
            "Voice command failed.",
        );
      }

      if (
        payload.sessionKey
      ) {
        setVoiceSessionKey(
          payload.sessionKey,
        );
      }

      if (
        payload.transcript
      ) {
        setVoiceDraft(
          payload.transcript,
        );
      }

      await loadBot();

      maybeAutoOpen(
        payload.result
          ?.clientAction,
      );

      if (
        preferences.autoReadReplies &&
        payload.result?.answer
      ) {
        await speak(
          payload.result.answer,
        );
      }

      if (
        payload.performance
          ?.totalMs
      ) {
        setNotice(
          `Voice command completed in ${payload.performance.totalMs} ms.`,
        );
      }
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Voice command failed.",
      );
    } finally {
      setTranscribing(false);
    }
  }

  async function startRecording() {
    try {
      const stream =
        await navigator.mediaDevices.getUserMedia(
          {
            audio: {
              echoCancellation:
                true,

              noiseSuppression:
                true,

              autoGainControl:
                true,

              channelCount: 1,
            },
          },
        );

      streamRef.current =
        stream;

      chunksRef.current =
        [];

      const mimeType =
        recorderMimeType();

      const recorder =
        mimeType
          ? new MediaRecorder(
              stream,
              {
                mimeType,

                audioBitsPerSecond:
                  64_000,
              },
            )
          : new MediaRecorder(
              stream,
            );

      recorderRef.current =
        recorder;

      recorder.ondataavailable =
        (
          event: BlobEvent,
        ) => {
          if (
            event.data.size >
            0
          ) {
            chunksRef.current.push(
              event.data,
            );
          }
        };

      recorder.onstop =
        () => {
          const blob =
            new Blob(
              chunksRef.current,
              {
                type:
                  recorder.mimeType ||
                  "audio/webm",
              },
            );

          streamRef.current
            ?.getTracks()
            .forEach(
              (track) =>
                track.stop(),
            );

          streamRef.current =
            null;

          setRecording(false);

          void executeAudio(
            blob,
          );
        };

      recorder.start(200);

      setActiveTab("voice");
      setRecording(true);
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Microphone access failed.",
      );
    }
  }

  function stopRecording() {
    if (
      recorderRef.current
        ?.state !==
      "inactive"
    ) {
      recorderRef.current
        ?.stop();
    }
  }

  function stopSpeaking() {
    audioRef.current?.pause();

    audioRef.current =
      null;

    if (
      audioUrlRef.current
    ) {
      URL.revokeObjectURL(
        audioUrlRef.current,
      );

      audioUrlRef.current =
        null;
    }

    window.speechSynthesis
      ?.cancel();

    setSpeaking(false);
  }

  async function speak(
    value: string,
  ) {
    const text =
      stripForSpeech(
        value,
      );

    if (!text) {
      return;
    }

    stopSpeaking();

    try {
      const response =
        await fetch(
          "/api/personal-bot/speech",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                text,

                voice:
                  audio?.speechVoice,

                model:
                  audio?.speechModel,

                format:
                  audio?.speechFormat ||
                  "mp3",

                speed:
                  preferences.voiceRate ===
                  "Slow"
                    ? 0.86
                    : preferences.voiceRate ===
                        "Fast"
                      ? 1.08
                      : 0.96,
              }),
          },
        );

      if (!response.ok) {
        throw new Error(
          "OpenAI speech was unavailable.",
        );
      }

      const blob =
        await response.blob();

      const url =
        URL.createObjectURL(
          blob,
        );

      audioUrlRef.current =
        url;

      const player =
        new Audio(url);

      audioRef.current =
        player;

      player.onended =
        () =>
          setSpeaking(false);

      player.onerror =
        () =>
          setSpeaking(false);

      setSpeaking(true);

      await player.play();
    } catch {
      if (
        !window.speechSynthesis
      ) {
        return;
      }

      const utterance =
        new SpeechSynthesisUtterance(
          text.slice(
            0,
            2200,
          ),
        );

      utterance.lang =
        preferences.voiceLanguage;

      utterance.rate =
        preferences.voiceRate ===
        "Slow"
          ? 0.84
          : preferences.voiceRate ===
              "Fast"
            ? 1.05
            : 0.94;

      utterance.onstart =
        () =>
          setSpeaking(true);

      utterance.onend =
        () =>
          setSpeaking(false);

      utterance.onerror =
        () =>
          setSpeaking(false);

      window.speechSynthesis.speak(
        utterance,
      );
    }
  }

  function startBrowserListening(
    target:
      | "prompt"
      | "voice",
  ) {
    const browser =
      window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };

    const Recognition =
      browser.SpeechRecognition ||
      browser.webkitSpeechRecognition;

    if (!Recognition) {
      return;
    }

    const recognition =
      new Recognition();

    recognition.continuous =
      false;

    recognition.interimResults =
      true;

    recognition.lang =
      preferences.voiceLanguage;

    let finalTranscript =
      "";

    recognition.onstart =
      () =>
        setListening(true);

    recognition.onresult =
      (
        event: SpeechRecognitionEventLike,
      ) => {
        let interim = "";

        for (
          let index =
            event.resultIndex ??
            0;
          index <
          event.results
            .length;
          index += 1
        ) {
          const result =
            event.results[
              index
            ];

          const transcript =
            result?.[0]
              ?.transcript ??
            "";

          if (
            result?.isFinal
          ) {
            finalTranscript +=
              transcript;
          } else {
            interim +=
              transcript;
          }
        }

        const current =
          (
            finalTranscript ||
            interim
          ).trim();

        if (
          target === "voice"
        ) {
          setVoiceDraft(
            current,
          );
        } else {
          setPrompt(
            current,
          );
        }
      };

    recognition.onend =
      () => {
        setListening(false);

        const current =
          finalTranscript.trim();

        if (!current) {
          return;
        }

        if (
          target === "voice"
        ) {
          setVoiceDraft(
            current,
          );

          if (
            preferences.voiceAutoSend
          ) {
            void executeVoiceTranscript(
              current,
            );
          }
        } else {
          setPrompt(
            current,
          );
        }
      };

    recognition.onerror =
      () => {
        setListening(false);

        setNotice(
          "Browser speech recognition stopped. OpenAI recording remains available.",
        );
      };

    recognitionRef.current =
      recognition;

    recognition.start();
  }

  async function createTask(
    event:
      FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault();

    if (
      !workspace?.firm ||
      !selectedMemberId ||
      !task.title.trim()
    ) {
      setNotice(
        "A connected firm, owner, and task title are required.",
      );

      return;
    }

    setBusy(true);
    setNotice("");

    try {
      const response =
        await fetch(
          "/api/firm-workspace",
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                firmId:
                  workspace.firm.id,

                action:
                  "createDelegatedTask",

                targetMembershipId:
                  selectedMemberId,

                ...task,
              }),
          },
        );

      const payload =
        (await response.json()) as
          FirmWorkspacePayload & {
            error?: string;
          };

      if (!response.ok) {
        throw new Error(
          payload.error ||
            "Task creation failed.",
        );
      }

      setWorkspace(payload);

      setTask(
        (current) => ({
          ...current,
          title: "",
          detail: "",
          reminderAt: "",
          reminderNote: "",
        }),
      );

      setNotice(
        "Task created and assigned on the Team Board.",
      );
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Task creation failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  function generateReport(
    sourceText?: string,
  ) {
    const title =
      reportPrompt.trim() ||
      "Advisor Intelligence Report";

    const command =
      `Create a source-backed Slice report.

Report request:
${sourceText?.trim() || title}

Report controls:
- Depth: ${preferences.reportDepth}
- Source policy: ${preferences.sourcePolicy}
- Include assumptions: ${preferences.includeAssumptions ? "Yes" : "No"}
- Include risk notes: ${preferences.includeRiskNotes ? "Yes" : "No"}
- Include advisor review checklist: ${preferences.includeReviewChecklist ? "Yes" : "No"}

Requirements:
- Use current authoritative sources for time-sensitive market, company, economic, legal, regulatory, product, or news claims.
- Separate facts, internal Slice records, assumptions, estimates, scenarios, and recommendations.
- Include exact dates, visible source links, data limitations, financial implications, downside risks, next actions, and advisor review notes.
- Do not use private client identifiers in public research queries.`;

    setActiveTab(
      "reports",
    );

    void sendCommand(
      command,
      undefined,
      "deep",
    );
  }

  useEffect(() => {
    setLoading(true);

    Promise.all([
      loadBot(),
      loadWorkspace(),
    ])
      .catch(
        (
          error: unknown,
        ) => {
          setNotice(
            error instanceof Error
              ? error.message
              : "AI Studio failed to load.",
          );
        },
      )
      .finally(() =>
        setLoading(false),
      );

    const browser =
      window as unknown as {
        SpeechRecognition?: SpeechRecognitionConstructor;
        webkitSpeechRecognition?: SpeechRecognitionConstructor;
      };

    setBrowserSpeechSupported(
      Boolean(
        browser.SpeechRecognition ||
          browser.webkitSpeechRecognition,
      ),
    );

    setRecorderSupported(
      typeof MediaRecorder !==
        "undefined" &&
        typeof navigator
          .mediaDevices
          ?.getUserMedia ===
          "function",
    );

    try {
      const saved =
        window.localStorage.getItem(
          PREFERENCES_KEY,
        );

      if (saved) {
        setPreferences({
          ...DEFAULT_PREFERENCES,

          ...(JSON.parse(
            saved,
          ) as Partial<StudioPreferences>),
        });
      }
    } catch {
      setPreferences(
        DEFAULT_PREFERENCES,
      );
    }

    return () => {
      recognitionRef.current
        ?.abort?.();

      requestControllerRef.current
        ?.abort();

      streamRef.current
        ?.getTracks()
        .forEach(
          (track) =>
            track.stop(),
        );

      audioRef.current
        ?.pause();

      window.speechSynthesis
        ?.cancel();

      if (
        audioUrlRef.current
      ) {
        URL.revokeObjectURL(
          audioUrlRef.current,
        );
      }
    };
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(
        PREFERENCES_KEY,

        JSON.stringify(
          preferences,
        ),
      );
    } catch {
      // Local preferences are optional.
    }
  }, [preferences]);

  useEffect(() => {
    if (
      !busy ||
      !requestStartedAt
    ) {
      setElapsedSeconds(0);

      return;
    }

    const timer =
      window.setInterval(
        () => {
          setElapsedSeconds(
            Math.floor(
              (Date.now() -
                requestStartedAt) /
                1000,
            ),
          );
        },
        1000,
      );

    return () =>
      window.clearInterval(
        timer,
      );
  }, [
    busy,
    requestStartedAt,
  ]);

  if (
    loading ||
    !data
  ) {
    return (
      <SliceBackground>
        <div className="mx-auto flex min-h-screen max-w-5xl items-center justify-center p-6">
          <Surface className="w-full p-8">
            <div className="flex flex-col items-center text-center">
              <BrandMark
                label="Slice"
                subtitle="Advisor Intelligence Platform"
              />

              <div className="mt-8 flex gap-1">
                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-300 [animation-delay:-0.3s]" />

                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-300 [animation-delay:-0.15s]" />

                <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-300" />
              </div>

              <h1 className="mt-5 text-3xl font-black text-white">
                Loading AI Studio
              </h1>

              <p className="mt-2 text-sm text-slate-300">
                Connecting research, Voice Ops, reports, and platform commands.
              </p>

              {notice ? (
                <p className="mt-4 text-sm text-emerald-300">
                  {notice}
                </p>
              ) : null}
            </div>
          </Surface>
        </div>
      </SliceBackground>
    );
  }

  const activeAi =
    busy ||
    recording ||
    transcribing ||
    listening ||
    speaking;

  const lastCommand =
    commands[0];

  return (
    <SliceBackground>
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute inset-0 bg-black/65" />

        <div className="absolute -left-48 -top-48 h-[34rem] w-[34rem] rounded-full bg-emerald-950/15 blur-[120px]" />

        <div className="absolute -right-40 top-1/3 h-[30rem] w-[30rem] rounded-full bg-emerald-950/10 blur-[120px]" />
      </div>

      <div className="relative mx-auto grid max-w-[1900px] gap-4 p-3 md:p-5">
        <Surface className="p-5 md:p-7">
          <div className="flex flex-col gap-6 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div>
              <BrandMark
                label="Slice"
                subtitle="Advisor Intelligence Platform"
              />

              <div className="mt-6 flex flex-col gap-4 xl:flex-row xl:items-center">
                <div className="relative grid h-20 w-20 shrink-0 place-items-center rounded-full border border-emerald-300/20 bg-black shadow-2xl shadow-black">
                  {activeAi ? (
                    <div className="absolute inset-0 animate-ping rounded-full border border-emerald-400/20" />
                  ) : null}

                  <div className="grid h-12 w-12 place-items-center rounded-full border border-emerald-300/20 bg-emerald-950/25 text-xs font-black text-emerald-100">
                    AI
                  </div>
                </div>

                <div>
                  <div className="flex flex-wrap gap-2">
                    <Pill
                      tone={
                        health?.ok
                          ? "green"
                          : "red"
                      }
                    >
                      {health?.ok
                        ? "OpenAI verified"
                        : "AI needs attention"}
                    </Pill>

                    <Pill
                      tone={
                        data.aiEngine
                          ?.webSearchEnabled
                          ? "cyan"
                          : "amber"
                      }
                    >
                      {data.aiEngine
                        ?.webSearchEnabled
                        ? "Live research"
                        : "Research disabled"}
                    </Pill>

                    <Pill
                      tone={
                        audio?.configured
                          ? "purple"
                          : "amber"
                      }
                    >
                      {audio?.configured
                        ? "OpenAI audio"
                        : "Browser audio fallback"}
                    </Pill>
                  </div>

                  <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-6xl">
                    AI Studio
                  </h1>

                  <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-300 md:text-base">
                    Financial research, platform actions, Voice Ops, team execution, and secure advisor reports in one permission-aware workspace.
                  </p>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <Button
                onClick={() =>
                  void refreshAll()
                }
                disabled={
                  refreshing
                }
                variant="ghost"
              >
                {refreshing
                  ? "Refreshing..."
                  : "Refresh Context"}
              </Button>

              <Button
                onClick={() =>
                  void verifyAi()
                }
                disabled={
                  verifying
                }
                variant="secondary"
              >
                {verifying
                  ? "Verifying..."
                  : "Verify AI"}
              </Button>

              <Link
                href="/workspace/settings"
                className="rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-slate-200 transition hover:border-white/20 hover:bg-white/[0.07]"
              >
                Platform Settings
              </Link>

              <Link
                href="/workspace"
                className="rounded-2xl border border-white/20 bg-white px-4 py-2.5 text-xs font-black text-slate-950 transition hover:bg-emerald-50"
              >
                Return to Workspace
              </Link>
            </div>
          </div>

          <div className="mt-7 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <Metric
              label="AI Health"
              value={
                health?.status ??
                "Unknown"
              }
              helper={
                health?.model ??
                data.aiEngine
                  ?.model
              }
              tone={statusTone(
                health?.status,
              )}
            />

            <Metric
              label="Research"
              value={
                data.aiEngine
                  ?.webSearchEnabled
                  ? "Live"
                  : "Off"
              }
              helper="Visible sources"
              tone={
                data.aiEngine
                  ?.webSearchEnabled
                  ? "cyan"
                  : "amber"
              }
            />

            <Metric
              label="Studio Score"
              value={`${readiness}%`}
              helper="Operational readiness"
              tone={statusTone(
                readiness,
              )}
            />

            <Metric
              label="Clients"
              value={
                metrics.accessibleClients ??
                0
              }
              helper="Permission scoped"
              tone="purple"
            />

            <Metric
              label="Reports"
              value={
                reports.length
              }
              helper="Secure outputs"
              tone="green"
            />

            <Metric
              label="Last Command"
              value={relativeTime(
                lastCommand?.createdAt,
              )}
              helper={
                lastCommand
                  ?.status ??
                "No command yet"
              }
              tone={statusTone(
                lastCommand
                  ?.status,
              )}
            />
          </div>
        </Surface>

        <Surface className="p-2">
          <div className="grid gap-2 md:grid-cols-4">
            {TABS.map(
              (
                tab,
                index,
              ) => {
                const active =
                  activeTab ===
                  tab.id;

                return (
                  <button
                    key={
                      tab.id
                    }
                    type="button"
                    onClick={() =>
                      setActiveTab(
                        tab.id,
                      )
                    }
                    className={cx(
                      "rounded-[1.3rem] border p-4 text-left transition",

                      active
                        ? "border-emerald-300/25 bg-white/[0.07]"
                        : "border-white/10 bg-black/60 hover:border-white/20 hover:bg-white/[0.04]",
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-white">
                          {
                            tab.label
                          }
                        </div>

                        <div className="mt-1 text-[10px] font-bold text-slate-300">
                          {
                            tab.helper
                          }
                        </div>
                      </div>

                      <span
                        className={cx(
                          "text-xs font-black",

                          active
                            ? "text-emerald-300"
                            : "text-slate-400",
                        )}
                      >
                        {String(
                          index +
                            1,
                        ).padStart(
                          2,
                          "0",
                        )}
                      </span>
                    </div>
                  </button>
                );
              },
            )}
          </div>
        </Surface>

        {notice ? (
          <div className="rounded-2xl border border-emerald-400/20 bg-[#090505] p-4 text-sm font-bold text-slate-100">
            {notice}
          </div>
        ) : null}

        {activeTab ===
        "command" ? (
          <section className="grid gap-4 2xl:grid-cols-[minmax(0,0.92fr)_minmax(0,1.08fr)]">
            <Surface className="p-5 md:p-6">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <Heading
                  eyebrow="Unified Intelligence"
                  title="Ask the market. Operate Slice."
                  helper="Research uses current sources when needed. Deterministic platform commands use the fast router and execute through permission-aware tools."
                />

                <div className="grid grid-cols-3 gap-1 rounded-2xl border border-white/10 bg-black/60 p-1">
                  {(
                    [
                      "quick",
                      "balanced",
                      "deep",
                    ] as AnswerMode[]
                  ).map(
                    (mode) => (
                      <button
                        key={
                          mode
                        }
                        type="button"
                        onClick={() =>
                          setAnswerMode(
                            mode,
                          )
                        }
                        className={cx(
                          "rounded-xl px-3 py-2 text-[10px] font-black uppercase",

                          answerMode ===
                            mode
                            ? "bg-white text-slate-950"
                            : "text-slate-300 hover:bg-white/[0.06] hover:text-white",
                        )}
                      >
                        {mode}
                      </button>
                    ),
                  )}
                </div>
              </div>

              <div className="mt-5 rounded-[1.5rem] border border-white/10 bg-black/55 p-3">
                <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  {OPERATING_MODES.map(
                    (mode) => (
                      <button
                        key={
                          mode.id
                        }
                        type="button"
                        onClick={() =>
                          setPreferences(
                            (
                              current,
                            ) => ({
                              ...current,

                              operatingMode:
                                mode.id,
                            }),
                          )
                        }
                        className={cx(
                          "rounded-xl border p-3 text-left transition",

                          preferences.operatingMode ===
                            mode.id
                            ? "border-emerald-300/25 bg-white/[0.07]"
                            : "border-white/5 bg-black/50 hover:border-white/15",
                        )}
                      >
                        <div className="text-[10px] font-black text-white">
                          {
                            mode.id
                          }
                        </div>

                        <div className="mt-1 text-[9px] leading-4 text-slate-300">
                          {
                            mode.helper
                          }
                        </div>
                      </button>
                    ),
                  )}
                </div>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[10px] font-bold text-slate-200">
                    Auto-open verified actions

                    <input
                      type="checkbox"
                      checked={
                        preferences.autoOpenActions
                      }
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>,
                      ) =>
                        setPreferences(
                          (
                            current,
                          ) => ({
                            ...current,

                            autoOpenActions:
                              event
                                .target
                                .checked,
                          }),
                        )
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[10px] font-bold text-slate-200">
                    Execution trace

                    <input
                      type="checkbox"
                      checked={
                        preferences.showExecutionTrace
                      }
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>,
                      ) =>
                        setPreferences(
                          (
                            current,
                          ) => ({
                            ...current,

                            showExecutionTrace:
                              event
                                .target
                                .checked,
                          }),
                        )
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/50 px-3 py-2 text-[10px] font-bold text-slate-200">
                    Compact sources

                    <input
                      type="checkbox"
                      checked={
                        preferences.compactSources
                      }
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>,
                      ) =>
                        setPreferences(
                          (
                            current,
                          ) => ({
                            ...current,

                            compactSources:
                              event
                                .target
                                .checked,
                          }),
                        )
                      }
                    />
                  </label>

                  <label className="rounded-xl border border-white/10 bg-black/50 px-3 py-2">
                    <span className="block text-[9px] font-black uppercase tracking-[0.14em] text-slate-300">
                      Source policy
                    </span>

                    <select
                      value={
                        preferences.sourcePolicy
                      }
                      onChange={(
                        event: ChangeEvent<HTMLSelectElement>,
                      ) =>
                        setPreferences(
                          (
                            current,
                          ) => ({
                            ...current,

                            sourcePolicy:
                              event
                                .target
                                .value as SourcePolicy,
                          }),
                        )
                      }
                      className="mt-1 w-full bg-transparent text-[10px] font-bold text-white outline-none"
                    >
                      {(
                        [
                          "Primary First",
                          "Balanced",
                          "Fast",
                        ] as SourcePolicy[]
                      ).map(
                        (
                          policy,
                        ) => (
                          <option
                            key={
                              policy
                            }
                            value={
                              policy
                            }
                            className="bg-black"
                          >
                            {
                              policy
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </label>
                </div>
              </div>

              <form
                className="mt-5 rounded-[1.6rem] border border-white/10 bg-black/70 p-4"
                onSubmit={(
                  event: FormEvent<HTMLFormElement>,
                ) => {
                  event.preventDefault();

                  void sendCommand();
                }}
              >
                <textarea
                  value={prompt}
                  onChange={(
                    event: ChangeEvent<HTMLTextAreaElement>,
                  ) =>
                    setPrompt(
                      event.target
                        .value,
                    )
                  }
                  onKeyDown={(
                    event: KeyboardEvent<HTMLTextAreaElement>,
                  ) => {
                    if (
                      event.key ===
                        "Enter" &&
                      !event.shiftKey
                    ) {
                      event.preventDefault();

                      void sendCommand();
                    }
                  }}
                  placeholder="Research an investment, search firm records, create a task, open a workflow, generate a report, or run a platform command..."
                  className="min-h-[260px] w-full resize-none rounded-[1.3rem] border border-white/15 bg-[#020202] px-5 py-4 text-base leading-7 text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/35 focus:ring-4 focus:ring-emerald-950/30"
                />

                <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                  <div className="flex flex-wrap gap-2">
                    {recorderSupported ? (
                      <Button
                        onClick={
                          recording
                            ? stopRecording
                            : () =>
                                void startRecording()
                        }
                        variant="secondary"
                      >
                        {recording
                          ? "Stop Recording"
                          : "Record Voice"}
                      </Button>
                    ) : null}

                    {browserSpeechSupported ? (
                      <Button
                        onClick={() =>
                          startBrowserListening(
                            "prompt",
                          )
                        }
                        variant="ghost"
                      >
                        Browser Voice
                      </Button>
                    ) : null}

                    <Button
                      onClick={() =>
                        setPrompt("")
                      }
                      variant="ghost"
                    >
                      Clear
                    </Button>
                  </div>

                  <Button
                    type="submit"
                    disabled={
                      busy ||
                      !prompt.trim()
                    }
                  >
                    {busy
                      ? "Researching and executing..."
                      : "Execute Command"}
                  </Button>
                </div>
              </form>

              <div className="mt-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400">
                    Pinned intelligence
                  </span>

                  <Pill tone="red">
                    One click
                  </Pill>
                </div>

                <div className="mt-3 grid gap-2 md:grid-cols-2">
                  {pinnedCommands
                    .slice(0, 8)
                    .map(
                      (
                        command,
                      ) => (
                        <button
                          key={
                            command
                          }
                          type="button"
                          onClick={() =>
                            setPrompt(
                              command,
                            )
                          }
                          className="rounded-2xl border border-white/10 bg-black/55 p-3 text-left text-xs font-bold leading-5 text-slate-200 transition hover:border-emerald-300/25 hover:bg-white/[0.05]"
                        >
                          {
                            command
                          }
                        </button>
                      ),
                    )}
                </div>
              </div>

              <details className="group mt-5 rounded-[1.35rem] border border-white/10 bg-black/55 p-4">
                <summary className="cursor-pointer list-none text-xs font-black text-white">
                  Full platform action directory

                  <span className="ml-2 text-slate-300 group-open:hidden">
                    +
                  </span>

                  <span className="ml-2 hidden text-slate-300 group-open:inline">
                    −
                  </span>
                </summary>

                <div className="mt-3 grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
                  {platformRoutes.map(
                    (route) => (
                      <Link
                        key={`${route.href}-${route.label}`}
                        href={
                          route.href
                        }
                        className="rounded-xl border border-white/10 bg-[#050505] p-3 transition hover:border-emerald-300/25 hover:bg-white/[0.04]"
                      >
                        <div className="text-[11px] font-black text-white">
                          {
                            route.label
                          }
                        </div>

                        <div className="mt-1 text-[9px] font-bold text-emerald-300">
                          {
                            route.category
                          }
                        </div>

                        <div className="mt-1 line-clamp-2 text-[9px] leading-4 text-slate-300">
                          {
                            route.description
                          }
                        </div>
                      </Link>
                    ),
                  )}
                </div>
              </details>

              <details className="group mt-3 rounded-[1.35rem] border border-white/10 bg-black/55 p-4">
                <summary className="cursor-pointer list-none text-xs font-black text-white">
                  Recent command history

                  <span className="ml-2 text-slate-300 group-open:hidden">
                    +
                  </span>

                  <span className="ml-2 hidden text-slate-300 group-open:inline">
                    −
                  </span>
                </summary>

                <div className="mt-3 grid gap-2">
                  {commands
                    .slice(0, 7)
                    .map(
                      (
                        command,
                      ) => (
                        <button
                          key={
                            command.id
                          }
                          type="button"
                          onClick={() => {
                            setPrompt(
                              command.commandText,
                            );

                            window.scrollTo(
                              {
                                top: 0,
                                behavior:
                                  "smooth",
                              },
                            );
                          }}
                          className="rounded-xl border border-white/10 bg-[#050505] p-3 text-left transition hover:border-emerald-300/25"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="line-clamp-2 text-[11px] font-bold text-white">
                                {
                                  command.commandText
                                }
                              </div>

                              <div className="mt-1 text-[9px] text-slate-300">
                                {command.resultSummary ||
                                  command.commandType}
                              </div>
                            </div>

                            <Pill
                              tone={statusTone(
                                command.status,
                              )}
                            >
                              {
                                command.status
                              }
                            </Pill>
                          </div>
                        </button>
                      ),
                    )}

                  {!commands.length ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-4 text-center text-xs text-slate-300">
                      No commands stored yet.
                    </div>
                  ) : null}
                </div>
              </details>
            </Surface>

            <Surface
              className="p-5 md:p-6"
              accent="cyan"
            >
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <Heading
                  eyebrow="Advisor Response"
                  title="Research, evidence, and execution."
                  helper="Review the latest result, supporting sources, tool path, and any verified platform action."
                />

                {latestAssistant ? (
                  <div className="flex flex-wrap gap-2">
                    <Button
                      onClick={
                        speaking
                          ? stopSpeaking
                          : () =>
                              void speak(
                                latestAssistant.content,
                              )
                      }
                      variant="secondary"
                    >
                      {speaking
                        ? "Stop Audio"
                        : "Read Response"}
                    </Button>

                    <Button
                      onClick={() =>
                        void navigator.clipboard.writeText(
                          latestAssistant.content,
                        )
                      }
                      variant="ghost"
                    >
                      Copy
                    </Button>

                    <Button
                      onClick={() =>
                        generateReport(
                          latestAssistant.content,
                        )
                      }
                      variant="ghost"
                    >
                      Make Report
                    </Button>
                  </div>
                ) : null}
              </div>

              {busy ? (
                <div className="mt-6 rounded-[1.4rem] border border-emerald-400/20 bg-[#090505] p-5">
                  <div className="flex items-center gap-3">
                    <div className="flex gap-1">
                      <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-300 [animation-delay:-0.3s]" />

                      <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-300 [animation-delay:-0.15s]" />

                      <span className="h-2 w-2 animate-bounce rounded-full bg-emerald-300" />
                    </div>

                    <div className="min-w-0 flex-1">
                      <div className="text-sm font-black text-white">
                        Researching and operating...
                      </div>

                      <div className="mt-1 text-xs text-slate-300">
                        Elapsed:{" "}
                        {elapsedSeconds}s
                      </div>
                    </div>

                    <Button
                      onClick={
                        stopRequest
                      }
                      variant="danger"
                    >
                      Stop
                    </Button>
                  </div>
                </div>
              ) : latestAssistant ? (
                <div className="mt-6">
                  <div className="flex flex-wrap gap-2">
                    <Pill
                      tone={statusTone(
                        latestAssistant
                          .metadata
                          ?.universalAiStatus ||
                          latestAssistant.intent,
                      )}
                    >
                      {latestAssistant
                        .metadata
                        ?.universalAiStatus ||
                        latestAssistant.intent}
                    </Pill>

                    <Pill
                      tone={
                        latestAssistant
                          .metadata
                          ?.researchUsed
                          ? "green"
                          : "slate"
                      }
                    >
                      {latestAssistant
                        .metadata
                        ?.researchUsed
                        ? "Research used"
                        : "Platform / internal"}
                    </Pill>

                    {latestAssistant
                      .metadata
                      ?.fastRouterUsed ? (
                      <Pill tone="cyan">
                        Fast command path
                      </Pill>
                    ) : null}

                    {latestAssistant
                      .metadata
                      ?.universalAiModel ? (
                      <Pill tone="purple">
                        {
                          latestAssistant
                            .metadata
                            .universalAiModel
                        }
                      </Pill>
                    ) : null}
                  </div>

                  <div className="mt-4 rounded-[1.4rem] border border-white/10 bg-[#020202] p-5">
                    <div className="whitespace-pre-wrap text-sm leading-7 text-slate-100">
                      {
                        latestAssistant.content
                      }
                    </div>
                  </div>

                  {latestAssistant
                    .metadata
                    ?.universalAiError ? (
                    <div className="mt-3 rounded-2xl border border-amber-400/25 bg-amber-950/25 p-3 text-xs leading-5 text-amber-100">
                      {
                        latestAssistant
                          .metadata
                          .universalAiError
                      }
                    </div>
                  ) : null}

                  <Sources
                    sources={
                      latestSources
                    }
                    compact={
                      preferences.compactSources
                    }
                  />

                  {preferences.showExecutionTrace ? (
                    <ExecutionTrace
                      message={
                        latestAssistant
                      }
                      action={
                        latestAction
                      }
                      sourceCount={
                        latestSources.length
                      }
                    />
                  ) : null}

                  <div className="mt-5 flex flex-wrap gap-2">
                    {latestAction
                      ?.href ? (
                      <Button
                        onClick={() =>
                          openClientAction(
                            latestAction,
                          )
                        }
                      >
                        {latestAction.type ===
                        "report"
                          ? "Open Report"
                          : latestAction.type ===
                              "source"
                            ? "Open Source"
                            : "Open Result"}
                      </Button>
                    ) : null}

                    {latestAction
                      ?.pdfHref ? (
                      <a
                        href={
                          latestAction.pdfHref
                        }
                        target="_blank"
                        rel="noreferrer"
                        className="rounded-2xl border border-emerald-400/25 bg-emerald-950/20 px-4 py-2.5 text-xs font-black text-emerald-100"
                      >
                        Open Raw PDF
                      </a>
                    ) : null}
                  </div>
                </div>
              ) : (
                <div className="mt-6 rounded-[1.4rem] border border-dashed border-white/15 bg-black/50 p-8 text-center">
                  <div className="text-xl font-black text-white">
                    Ready for the first command.
                  </div>

                  <p className="mt-2 text-sm text-slate-300">
                    Ask a financial question or describe a Slice outcome.
                  </p>
                </div>
              )}

              {latestUser ? (
                <SoftCard className="mt-5 !border-white/10 !bg-black/55">
                  <div className="flex items-center justify-between gap-3">
                    <Pill tone="red">
                      Latest request
                    </Pill>

                    <span className="text-[10px] font-bold text-slate-300">
                      {formatDate(
                        latestUser.createdAt,
                      )}
                    </span>
                  </div>

                  <p className="mt-3 text-xs leading-6 text-slate-200">
                    {
                      latestUser.content
                    }
                  </p>
                </SoftCard>
              ) : null}
            </Surface>
          </section>
        ) : null}

        {activeTab ===
        "voice" ? (
          <section className="grid gap-4 2xl:grid-cols-[minmax(0,0.95fr)_minmax(0,1.05fr)]">
            <Surface
              className="p-6"
              accent="purple"
            >
              <div className="text-center">
                <Heading
                  eyebrow="Low-Latency Voice Ops"
                  title="Speak the outcome."
                  helper="Noise-reduced recording, fast OpenAI transcription, deterministic command routing, and full AI research fallback use the same execution layer as typed commands."
                />

                <div className="mt-5 flex flex-wrap justify-center gap-2">
                  <Pill
                    tone={
                      audio?.configured
                        ? "green"
                        : "amber"
                    }
                  >
                    {audio?.configured
                      ? "OpenAI audio ready"
                      : "Browser fallback"}
                  </Pill>

                  <Pill
                    tone={
                      recorderSupported
                        ? "purple"
                        : "red"
                    }
                  >
                    {recorderSupported
                      ? "Microphone ready"
                      : "Recorder unavailable"}
                  </Pill>

                  <Pill tone="cyan">
                    Fast command router
                  </Pill>
                </div>

                <div className="mt-5 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                  <label className="rounded-xl border border-white/10 bg-black/55 p-3 text-left">
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-300">
                      Language
                    </span>

                    <select
                      value={
                        preferences.voiceLanguage
                      }
                      onChange={(
                        event: ChangeEvent<HTMLSelectElement>,
                      ) =>
                        setPreferences(
                          (
                            current,
                          ) => ({
                            ...current,

                            voiceLanguage:
                              event
                                .target
                                .value as VoiceLanguage,
                          }),
                        )
                      }
                      className="mt-1 w-full bg-transparent text-xs font-bold text-white outline-none"
                    >
                      {(
                        [
                          "en-US",
                          "en-GB",
                          "es-US",
                        ] as VoiceLanguage[]
                      ).map(
                        (
                          value,
                        ) => (
                          <option
                            key={
                              value
                            }
                            value={
                              value
                            }
                            className="bg-black"
                          >
                            {value}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className="rounded-xl border border-white/10 bg-black/55 p-3 text-left">
                    <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-300">
                      Speech rate
                    </span>

                    <select
                      value={
                        preferences.voiceRate
                      }
                      onChange={(
                        event: ChangeEvent<HTMLSelectElement>,
                      ) =>
                        setPreferences(
                          (
                            current,
                          ) => ({
                            ...current,

                            voiceRate:
                              event
                                .target
                                .value as VoiceRate,
                          }),
                        )
                      }
                      className="mt-1 w-full bg-transparent text-xs font-bold text-white outline-none"
                    >
                      {(
                        [
                          "Slow",
                          "Normal",
                          "Fast",
                        ] as VoiceRate[]
                      ).map(
                        (
                          value,
                        ) => (
                          <option
                            key={
                              value
                            }
                            value={
                              value
                            }
                            className="bg-black"
                          >
                            {value}
                          </option>
                        ),
                      )}
                    </select>
                  </label>

                  <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/55 p-3 text-xs font-bold text-slate-200">
                    Auto-read reply

                    <input
                      type="checkbox"
                      checked={
                        preferences.autoReadReplies
                      }
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>,
                      ) =>
                        setPreferences(
                          (
                            current,
                          ) => ({
                            ...current,

                            autoReadReplies:
                              event
                                .target
                                .checked,
                          }),
                        )
                      }
                    />
                  </label>

                  <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/55 p-3 text-xs font-bold text-slate-200">
                    Auto-send transcript

                    <input
                      type="checkbox"
                      checked={
                        preferences.voiceAutoSend
                      }
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>,
                      ) =>
                        setPreferences(
                          (
                            current,
                          ) => ({
                            ...current,

                            voiceAutoSend:
                              event
                                .target
                                .checked,
                          }),
                        )
                      }
                    />
                  </label>
                </div>

                <button
                  type="button"
                  onClick={
                    recording
                      ? stopRecording
                      : () =>
                          void startRecording()
                  }
                  disabled={
                    !recorderSupported ||
                    transcribing
                  }
                  className={cx(
                    "mt-7 rounded-full border px-10 py-5 text-base font-black shadow-2xl transition hover:-translate-y-1 disabled:opacity-45",

                    recording
                      ? "border-emerald-300/40 bg-emerald-700 text-white"
                      : "border-white/20 bg-white text-slate-950",
                  )}
                >
                  {recording
                    ? "Stop and Execute"
                    : transcribing
                      ? "Transcribing and executing..."
                      : "Start Voice Command"}
                </button>

                {browserSpeechSupported ? (
                  <button
                    type="button"
                    onClick={() =>
                      startBrowserListening(
                        "voice",
                      )
                    }
                    className="mt-3 block w-full text-xs font-black text-slate-300 hover:text-emerald-200"
                  >
                    Use browser speech recognition instead
                  </button>
                ) : null}
              </div>

              <div className="mt-7 rounded-[1.4rem] border border-white/10 bg-black/60 p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400">
                    Live transcript
                  </span>

                  {voiceSessionKey ? (
                    <Pill tone="slate">
                      Session active
                    </Pill>
                  ) : null}
                </div>

                <textarea
                  value={voiceDraft}
                  onChange={(
                    event: ChangeEvent<HTMLTextAreaElement>,
                  ) =>
                    setVoiceDraft(
                      event.target
                        .value,
                    )
                  }
                  placeholder="The transcript appears here and can be edited before execution."
                  className="mt-3 min-h-[180px] w-full resize-none rounded-[1.2rem] border border-white/15 bg-[#020202] px-4 py-3 text-sm leading-7 text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/35"
                />

                <div className="mt-3 flex flex-wrap gap-2">
                  <Button
                    onClick={() =>
                      void executeVoiceTranscript(
                        voiceDraft,
                      )
                    }
                    disabled={
                      !voiceDraft.trim() ||
                      transcribing
                    }
                  >
                    Execute Transcript
                  </Button>

                  <Button
                    onClick={() =>
                      setVoiceDraft("")
                    }
                    variant="ghost"
                  >
                    Clear
                  </Button>

                  {latestAssistant ? (
                    <Button
                      onClick={
                        speaking
                          ? stopSpeaking
                          : () =>
                              void speak(
                                latestAssistant.content,
                              )
                      }
                      variant="secondary"
                    >
                      {speaking
                        ? "Stop Reply"
                        : "Read Latest Reply"}
                    </Button>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-2 md:grid-cols-2">
                {QUICK_PROMPTS
                  .slice(0, 4)
                  .map(
                    (value) => (
                      <button
                        key={
                          value
                        }
                        type="button"
                        onClick={() =>
                          setVoiceDraft(
                            value,
                          )
                        }
                        className="rounded-2xl border border-white/10 bg-black/55 p-3 text-left text-xs font-bold leading-5 text-slate-200 transition hover:border-emerald-300/25"
                      >
                        {value}
                      </button>
                    ),
                  )}
              </div>
            </Surface>

            <Surface className="p-6">
              <Heading
                eyebrow="Voice Audit Trail"
                title="Every spoken command is reviewable."
                helper="Review transcripts, language, confidence, completion state, and the resulting platform execution."
              />

              <div className="mt-5 grid gap-3">
                {voiceSessions
                  .slice(0, 8)
                  .map(
                    (
                      session,
                    ) => (
                      <SoftCard
                        key={
                          session.id
                        }
                        className="!border-white/10 !bg-black/55"
                      >
                        <div className="flex flex-wrap items-center justify-between gap-3">
                          <div className="flex flex-wrap gap-2">
                            <Pill
                              tone={statusTone(
                                session.status,
                              )}
                            >
                              {
                                session.status
                              }
                            </Pill>

                            <Pill tone="purple">
                              {
                                session.language
                              }
                            </Pill>

                            <Pill tone="slate">
                              {
                                session.confidenceScore
                              }
                              % confidence
                            </Pill>
                          </div>

                          <span className="text-[10px] text-slate-300">
                            {formatDate(
                              session.createdAt,
                            )}
                          </span>
                        </div>

                        <p className="mt-3 text-sm leading-6 text-slate-100">
                          {session.finalTranscript ||
                            session.transcript ||
                            "No transcript stored."}
                        </p>
                      </SoftCard>
                    ),
                  )}

                {!voiceSessions.length ? (
                  <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-300">
                    No voice sessions yet.
                  </div>
                ) : null}
              </div>
            </Surface>
          </section>
        ) : null}

        {activeTab ===
        "tasks" ? (
          <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_420px]">
            <Surface
              className="p-6"
              accent="green"
            >
              <Heading
                eyebrow="Team Execution"
                title="Create and assign real work."
                helper="Tasks created here are written to the connected firm workspace and remain visible on the Team Board."
              />

              <form
                onSubmit={
                  createTask
                }
                className="mt-6 grid gap-4"
              >
                <Field label="Task title">
                  <input
                    value={
                      task.title
                    }
                    onChange={(
                      event: ChangeEvent<HTMLInputElement>,
                    ) =>
                      setTask(
                        (
                          current,
                        ) => ({
                          ...current,

                          title:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    placeholder="Review client briefing before Friday meeting"
                    className="w-full rounded-2xl border border-white/15 bg-[#020202] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/35"
                  />
                </Field>

                <Field label="Task detail">
                  <textarea
                    value={
                      task.detail
                    }
                    onChange={(
                      event: ChangeEvent<HTMLTextAreaElement>,
                    ) =>
                      setTask(
                        (
                          current,
                        ) => ({
                          ...current,

                          detail:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    placeholder="Expected outcome, context, and review requirements"
                    className="min-h-[140px] w-full rounded-2xl border border-white/15 bg-[#020202] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/35"
                  />
                </Field>

                <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                  <Field label="Owner">
                    <select
                      value={
                        selectedMemberId
                      }
                      onChange={(
                        event: ChangeEvent<HTMLSelectElement>,
                      ) =>
                        setSelectedMemberId(
                          event.target
                            .value,
                        )
                      }
                      className="w-full rounded-2xl border border-white/15 bg-[#020202] px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="">
                        Select owner
                      </option>

                      {(
                        workspace
                          ?.members ??
                        []
                      ).map(
                        (
                          member,
                        ) => (
                          <option
                            key={
                              member.id
                            }
                            value={
                              member.id
                            }
                          >
                            {member.user
                              ?.name ||
                              member.user
                                ?.email ||
                              member.role}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>

                  <Field label="Project">
                    <select
                      value={
                        task.projectId
                      }
                      onChange={(
                        event: ChangeEvent<HTMLSelectElement>,
                      ) =>
                        setTask(
                          (
                            current,
                          ) => ({
                            ...current,

                            projectId:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      className="w-full rounded-2xl border border-white/15 bg-[#020202] px-4 py-3 text-sm text-white outline-none"
                    >
                      <option value="">
                        No project
                      </option>

                      {(
                        workspace
                          ?.projects ??
                        []
                      ).map(
                        (
                          project,
                        ) => (
                          <option
                            key={
                              project.id
                            }
                            value={
                              project.id
                            }
                          >
                            {
                              project.title
                            }
                          </option>
                        ),
                      )}
                    </select>
                  </Field>

                  <Field label="Priority">
                    <select
                      value={
                        task.priority
                      }
                      onChange={(
                        event: ChangeEvent<HTMLSelectElement>,
                      ) =>
                        setTask(
                          (
                            current,
                          ) => ({
                            ...current,

                            priority:
                              event
                                .target
                                .value as Priority,
                          }),
                        )
                      }
                      className="w-full rounded-2xl border border-white/15 bg-[#020202] px-4 py-3 text-sm text-white outline-none"
                    >
                      {(
                        [
                          "Critical",
                          "High",
                          "Medium",
                          "Low",
                        ] as Priority[]
                      ).map(
                        (
                          value,
                        ) => (
                          <option
                            key={
                              value
                            }
                            value={
                              value
                            }
                          >
                            {value}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>

                  <Field label="Status">
                    <select
                      value={
                        task.status
                      }
                      onChange={(
                        event: ChangeEvent<HTMLSelectElement>,
                      ) =>
                        setTask(
                          (
                            current,
                          ) => ({
                            ...current,

                            status:
                              event
                                .target
                                .value as TaskStatus,
                          }),
                        )
                      }
                      className="w-full rounded-2xl border border-white/15 bg-[#020202] px-4 py-3 text-sm text-white outline-none"
                    >
                      {(
                        [
                          "Backlog",
                          "To Do",
                          "In Progress",
                          "Review",
                          "Blocked",
                          "Complete",
                        ] as TaskStatus[]
                      ).map(
                        (
                          value,
                        ) => (
                          <option
                            key={
                              value
                            }
                            value={
                              value
                            }
                          >
                            {value}
                          </option>
                        ),
                      )}
                    </select>
                  </Field>

                  <Field label="Due date">
                    <input
                      type="date"
                      value={
                        task.dueDate
                      }
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>,
                      ) =>
                        setTask(
                          (
                            current,
                          ) => ({
                            ...current,

                            dueDate:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      className="w-full rounded-2xl border border-white/15 bg-[#020202] px-4 py-3 text-sm text-white outline-none"
                    />
                  </Field>

                  <Field label="Reminder">
                    <input
                      type="datetime-local"
                      value={
                        task.reminderAt
                      }
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>,
                      ) =>
                        setTask(
                          (
                            current,
                          ) => ({
                            ...current,

                            reminderAt:
                              event
                                .target
                                .value,
                          }),
                        )
                      }
                      className="w-full rounded-2xl border border-white/15 bg-[#020202] px-4 py-3 text-sm text-white outline-none"
                    />
                  </Field>
                </div>

                <Field label="Reminder note">
                  <input
                    value={
                      task.reminderNote
                    }
                    onChange={(
                      event: ChangeEvent<HTMLInputElement>,
                    ) =>
                      setTask(
                        (
                          current,
                        ) => ({
                          ...current,

                          reminderNote:
                            event
                              .target
                              .value,
                        }),
                      )
                    }
                    placeholder="Optional reminder context"
                    className="w-full rounded-2xl border border-white/15 bg-[#020202] px-4 py-3 text-sm text-white outline-none placeholder:text-slate-400"
                  />
                </Field>

                <div className="flex flex-col gap-3 rounded-2xl border border-white/10 bg-black/55 p-4 md:flex-row md:items-center md:justify-between">
                  <label className="flex items-center gap-3 text-xs font-bold text-slate-200">
                    <input
                      type="checkbox"
                      checked={
                        task.notifyEmail
                      }
                      onChange={(
                        event: ChangeEvent<HTMLInputElement>,
                      ) =>
                        setTask(
                          (
                            current,
                          ) => ({
                            ...current,

                            notifyEmail:
                              event
                                .target
                                .checked,
                          }),
                        )
                      }
                    />

                    Notify the assigned team member when available
                  </label>

                  <Button
                    type="submit"
                    disabled={
                      busy
                    }
                  >
                    {busy
                      ? "Creating task..."
                      : "Create Team Board Task"}
                  </Button>
                </div>
              </form>
            </Surface>

            <div className="grid gap-4">
              <Surface
                className="p-5"
                accent="green"
              >
                <Heading
                  eyebrow="Firm Pulse"
                  title={
                    workspace
                      ?.firm
                      ?.name ||
                    "No firm connected"
                  }
                />

                <div className="mt-4 grid grid-cols-2 gap-3">
                  <Metric
                    label="Total"
                    value={
                      workspace
                        ?.operations
                        ?.sprintMetrics
                        ?.total ??
                      0
                    }
                    helper="All tasks"
                    tone="slate"
                  />

                  <Metric
                    label="Open"
                    value={
                      workspace
                        ?.operations
                        ?.sprintMetrics
                        ?.open ??
                      0
                    }
                    helper="Needs action"
                    tone="amber"
                  />

                  <Metric
                    label="In Progress"
                    value={
                      workspace
                        ?.operations
                        ?.sprintMetrics
                        ?.inProgress ??
                      0
                    }
                    helper="Active work"
                    tone="purple"
                  />

                  <Metric
                    label="Complete"
                    value={
                      workspace
                        ?.operations
                        ?.sprintMetrics
                        ?.complete ??
                      0
                    }
                    helper="Finished"
                    tone="green"
                  />
                </div>

                <Link
                  href="/workspace/team-board"
                  className="mt-4 inline-flex rounded-2xl border border-emerald-400/25 bg-emerald-950/25 px-4 py-2.5 text-xs font-black text-emerald-100"
                >
                  Open Team Board
                </Link>
              </Surface>

              <Surface className="p-5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400">
                    Recent work
                  </span>

                  <Pill tone="red">
                    {workspace
                      ?.operations
                      ?.allTasks
                      ?.length ??
                      0}
                  </Pill>
                </div>

                <div className="mt-4 grid gap-2">
                  {(
                    workspace
                      ?.operations
                      ?.allTasks ??
                    []
                  )
                    .slice(0, 7)
                    .map(
                      (
                        item,
                      ) => (
                        <SoftCard
                          key={
                            item.id
                          }
                          className="!border-white/10 !bg-black/55"
                        >
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="line-clamp-2 text-sm font-black text-white">
                                {
                                  item.title
                                }
                              </div>

                              <div className="mt-1 text-[10px] text-slate-300">
                                {item.ownerName ||
                                  "Team"}{" "}
                                ·{" "}
                                {item.dueDate ||
                                  "No due date"}
                              </div>
                            </div>

                            <Pill
                              tone={statusTone(
                                item.priority,
                              )}
                            >
                              {
                                item.priority
                              }
                            </Pill>
                          </div>
                        </SoftCard>
                      ),
                    )}
                </div>
              </Surface>
            </div>
          </section>
        ) : null}

        {activeTab ===
        "reports" ? (
          <section className="grid gap-4 2xl:grid-cols-[minmax(0,1fr)_480px]">
            <Surface
              className="p-6"
              accent="amber"
            >
              <div className="flex items-start justify-between gap-4">
                <Heading
                  eyebrow="Advisor Report Studio"
                  title="Research becomes presentation-ready."
                  helper="Create source-backed browser reports and secure PDFs with assumptions, risks, and advisor review controls."
                />

                <Pill tone="amber">
                  {reports.length} reports
                </Pill>
              </div>

              <textarea
                value={reportPrompt}
                onChange={(
                  event: ChangeEvent<HTMLTextAreaElement>,
                ) =>
                  setReportPrompt(
                    event.target
                      .value,
                  )
                }
                placeholder="Describe the report you need"
                className="mt-6 min-h-[220px] w-full resize-none rounded-[1.3rem] border border-white/15 bg-[#020202] px-5 py-4 text-sm leading-7 text-white outline-none placeholder:text-slate-400 focus:border-emerald-300/35"
              />

              <div className="mt-4 grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
                <label className="rounded-xl border border-white/10 bg-black/55 p-3">
                  <span className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-300">
                    Depth
                  </span>

                  <select
                    value={
                      preferences.reportDepth
                    }
                    onChange={(
                      event: ChangeEvent<HTMLSelectElement>,
                    ) =>
                      setPreferences(
                        (
                          current,
                        ) => ({
                          ...current,

                          reportDepth:
                            event
                              .target
                              .value as
                              | "Balanced"
                              | "Full",
                        }),
                      )
                    }
                    className="mt-1 w-full bg-transparent text-xs font-bold text-white outline-none"
                  >
                    <option
                      value="Balanced"
                      className="bg-black"
                    >
                      Balanced
                    </option>

                    <option
                      value="Full"
                      className="bg-black"
                    >
                      Full
                    </option>
                  </select>
                </label>

                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/55 p-3 text-xs font-bold text-slate-200">
                  Assumptions

                  <input
                    type="checkbox"
                    checked={
                      preferences.includeAssumptions
                    }
                    onChange={(
                      event: ChangeEvent<HTMLInputElement>,
                    ) =>
                      setPreferences(
                        (
                          current,
                        ) => ({
                          ...current,

                          includeAssumptions:
                            event
                              .target
                              .checked,
                        }),
                      )
                    }
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/55 p-3 text-xs font-bold text-slate-200">
                  Risk notes

                  <input
                    type="checkbox"
                    checked={
                      preferences.includeRiskNotes
                    }
                    onChange={(
                      event: ChangeEvent<HTMLInputElement>,
                    ) =>
                      setPreferences(
                        (
                          current,
                        ) => ({
                          ...current,

                          includeRiskNotes:
                            event
                              .target
                              .checked,
                        }),
                      )
                    }
                  />
                </label>

                <label className="flex items-center justify-between rounded-xl border border-white/10 bg-black/55 p-3 text-xs font-bold text-slate-200">
                  Review checklist

                  <input
                    type="checkbox"
                    checked={
                      preferences.includeReviewChecklist
                    }
                    onChange={(
                      event: ChangeEvent<HTMLInputElement>,
                    ) =>
                      setPreferences(
                        (
                          current,
                        ) => ({
                          ...current,

                          includeReviewChecklist:
                            event
                              .target
                              .checked,
                        }),
                      )
                    }
                  />
                </label>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2">
                {REPORT_TEMPLATES.map(
                  (
                    template,
                  ) => (
                    <button
                      key={
                        template.title
                      }
                      type="button"
                      onClick={() =>
                        setReportPrompt(
                          template.prompt,
                        )
                      }
                      className="rounded-2xl border border-white/10 bg-black/55 p-4 text-left transition hover:border-emerald-300/25"
                    >
                      <div className="text-sm font-black text-white">
                        {
                          template.title
                        }
                      </div>

                      <p className="mt-2 text-xs leading-5 text-slate-300">
                        {
                          template.helper
                        }
                      </p>
                    </button>
                  ),
                )}
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                <Button
                  onClick={() =>
                    generateReport()
                  }
                  disabled={
                    busy
                  }
                >
                  {busy
                    ? "Generating report..."
                    : "Generate Source-Backed Report"}
                </Button>

                {latestAssistant ? (
                  <Button
                    onClick={() =>
                      generateReport(
                        latestAssistant.content,
                      )
                    }
                    disabled={
                      busy
                    }
                    variant="secondary"
                  >
                    Use Latest Answer
                  </Button>
                ) : null}
              </div>
            </Surface>

            <Surface className="p-5">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.22em] text-emerald-400">
                    Report library
                  </div>

                  <h2 className="mt-2 text-2xl font-black text-white">
                    Recent intelligence
                  </h2>
                </div>

                <Pill tone="red">
                  {reports.length}
                </Pill>
              </div>

              <div className="mt-4 grid gap-3">
                {reports
                  .slice(0, 10)
                  .map(
                    (report) => {
                      const sourceCount =
                        report.design
                          ?.sources
                          ?.length ??
                        report.design
                          ?.sourceCount ??
                        0;

                      return (
                        <SoftCard
                          key={
                            report.id
                          }
                          className="!border-white/10 !bg-black/55"
                        >
                          <div className="flex flex-wrap gap-2">
                            <Pill
                              tone={statusTone(
                                report.status,
                              )}
                            >
                              {
                                report.status
                              }
                            </Pill>

                            <Pill tone="red">
                              {
                                report.reportType
                              }
                            </Pill>

                            <Pill
                              tone={
                                report
                                  .design
                                  ?.researchUsed
                                  ? "green"
                                  : "amber"
                              }
                            >
                              {report
                                .design
                                ?.researchUsed
                                ? "Researched"
                                : "Internal"}
                            </Pill>
                          </div>

                          <h3 className="mt-3 line-clamp-2 text-sm font-black text-white">
                            {
                              report.title
                            }
                          </h3>

                          {report.summary ? (
                            <p className="mt-2 line-clamp-3 text-xs leading-5 text-slate-300">
                              {
                                report.summary
                              }
                            </p>
                          ) : null}

                          <div className="mt-3 flex flex-wrap gap-2">
                            <Pill tone="cyan">
                              {sourceCount} sources
                            </Pill>

                            {report.design
                              ?.model ? (
                              <Pill tone="purple">
                                {
                                  report
                                    .design
                                    .model
                                }
                              </Pill>
                            ) : null}

                            <Pill tone="slate">
                              {formatDate(
                                report.createdAt,
                              )}
                            </Pill>
                          </div>

                          <div className="mt-4 grid gap-2 sm:grid-cols-2">
                            <a
                              href={reportViewerHref(
                                report,
                              )}
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-2xl border border-white/20 bg-white px-4 py-2.5 text-center text-xs font-black text-slate-950"
                            >
                              Open Browser Report
                            </a>

                            <a
                              href={
                                report.downloadUrl
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="rounded-2xl border border-emerald-400/25 bg-emerald-950/20 px-4 py-2.5 text-center text-xs font-black text-emerald-100"
                            >
                              Open Raw PDF
                            </a>
                          </div>
                        </SoftCard>
                      );
                    },
                  )}

                {!reports.length ? (
                  <div className="rounded-2xl border border-dashed border-white/15 p-8 text-center text-sm text-slate-300">
                    No reports yet. Generate the first source-backed report.
                  </div>
                ) : null}
              </div>
            </Surface>
          </section>
        ) : null}
      </div>
    </SliceBackground>
  );
}