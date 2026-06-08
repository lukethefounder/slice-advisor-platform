"use client";

import {
  FormEvent,
  KeyboardEvent,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import type { ReactNode } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";
type StudioView = "chat" | "prompts" | "scenarios" | "reports" | "memory" | "settings";
type AnswerMode = "quick" | "balanced" | "deep";
type ChatFocus = "advisor" | "client" | "meeting" | "market" | "report" | "platform";

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
    structuredCommand?: {
      intent?: string;
      confidence?: number;
      riskLevel?: string;
      requiresApproval?: boolean;
    };
    answerMode?: AnswerMode;
    aiParserOk?: boolean;
    aiParserError?: string;
    spokenAccent?: string;
    universalAiProvider?: string;
    universalAiStatus?: string;
    universalAiError?: string;
    universalAiModel?: string;
    universalAiConfigured?: boolean;
    universalAiLatencyMs?: number;
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
  pdfReports?: Array<{
    id: string;
    title: string;
    reportType: string;
    status: string;
    downloadUrl: string;
    createdAt?: string;
  }>;
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
  platformMap?: Array<{
    id: string;
    label: string;
    route: string;
    category: string;
    aliases: string[];
    capabilities: string[];
    examplePrompts: string[];
    status: string;
  }>;
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

type ScenarioSettings = {
  clientName: string;
  clientAge: number;
  startingBalance: number;
  monthlyContribution: number;
  horizonYears: number;
  expectedReturn: number;
  bearReturn: number;
  bullReturn: number;
  inflation: number;
  advisoryFee: number;
  taxDrag: number;
  volatility: number;
  stockAllocation: number;
  bondAllocation: number;
  cashAllocation: number;
  alternativeAllocation: number;
  riskProfile: "Conservative" | "Balanced" | "Growth" | "Aggressive";
};

type ScenarioSeries = {
  year: number;
  base: number;
  bull: number;
  bear: number;
  realBase: number;
  contributions: number;
};

const starterPrompts = [
  "Explain what Slice does in simple terms for a wealth manager.",
  "Help me prepare for a client meeting in a calm, professional way.",
  "Create a client-friendly explanation of NVDA exposure.",
  "Summarize the most important things I should work on inside Slice today.",
  "Draft a polished advisor email about recent market volatility.",
  "Create a report explaining why this platform matters.",
];

const focusCards: Array<{
  id: ChatFocus;
  title: string;
  helper: string;
  tone: Tone;
  promptPrefix: string;
}> = [
  {
    id: "advisor",
    title: "Advisor Answer",
    helper: "Reasoning, decisions, next steps.",
    tone: "cyan",
    promptPrefix: "Answer this like an advisor operating assistant: ",
  },
  {
    id: "client",
    title: "Client Friendly",
    helper: "Clear, calm, non-intimidating.",
    tone: "green",
    promptPrefix: "Turn this into a client-friendly explanation: ",
  },
  {
    id: "meeting",
    title: "Meeting Prep",
    helper: "Agenda, risks, talking points.",
    tone: "purple",
    promptPrefix: "Prepare me for a client or advisor meeting about: ",
  },
  {
    id: "market",
    title: "Market Lens",
    helper: "Equities, risk, signals, context.",
    tone: "amber",
    promptPrefix: "Analyze this market or investment topic carefully: ",
  },
  {
    id: "report",
    title: "Report Builder",
    helper: "Structured PDF/report-ready output.",
    tone: "red",
    promptPrefix: "Create a report-ready briefing about: ",
  },
  {
    id: "platform",
    title: "Use Slice",
    helper: "Navigation and workflow help.",
    tone: "slate",
    promptPrefix: "Help me use Slice to accomplish this: ",
  },
];

const quickModes = [
  {
    title: "Explain",
    prompt: "Explain this clearly and simply: ",
    helper: "Turn complexity into plain English.",
    tone: "cyan" as Tone,
  },
  {
    title: "Prepare",
    prompt: "Prepare me for this advisor meeting: ",
    helper: "Agenda, talking points, risks.",
    tone: "purple" as Tone,
  },
  {
    title: "Draft",
    prompt: "Draft a polished client-safe message about: ",
    helper: "Client-ready communication.",
    tone: "green" as Tone,
  },
  {
    title: "Analyze",
    prompt: "Analyze this from an advisor perspective: ",
    helper: "Balanced review and next steps.",
    tone: "amber" as Tone,
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toneFor(value: string | null | undefined): Tone {
  const lower = String(value ?? "").toLowerCase();

  if (
    lower.includes("failed") ||
    lower.includes("critical") ||
    lower.includes("high") ||
    lower.includes("error") ||
    lower.includes("missing")
  ) {
    return "red";
  }

  if (
    lower.includes("complete") ||
    lower.includes("active") ||
    lower.includes("ready") ||
    lower.includes("configured") ||
    lower.includes("generated") ||
    lower.includes("completed")
  ) {
    return "green";
  }

  if (
    lower.includes("open") ||
    lower.includes("queued") ||
    lower.includes("draft") ||
    lower.includes("pending") ||
    lower.includes("approval") ||
    lower.includes("timeout")
  ) {
    return "amber";
  }

  if (lower.includes("ai") || lower.includes("bot") || lower.includes("research")) return "purple";
  if (lower.includes("voice") || lower.includes("backend") || lower.includes("tool")) return "cyan";

  return "slate";
}

function modeTone(mode: AnswerMode): Tone {
  if (mode === "quick") return "cyan";
  if (mode === "deep") return "purple";
  return "green";
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

function shortTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleTimeString(undefined, {
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

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) >= 10 ? 0 : 2,
  }).format(Number.isFinite(value) ? value : 0);
}

function compactMoney(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    notation: "compact",
    maximumFractionDigits: 1,
  }).format(Number.isFinite(value) ? value : 0);
}

function actionLabel(action?: ClientAction) {
  if (!action?.href) return null;
  if (action.type === "report") return "Open Report";
  if (action.type === "source") return "Open Source";
  if (action.type === "navigate") return "Open Section";
  return "Open Result";
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
    return "The live AI response took longer than expected. Deep Mode is designed to wait longer for complete answers.";
  }

  return value;
}

function scenarioNetAnnualReturn(grossReturn: number, advisoryFee: number, taxDrag: number) {
  return (grossReturn - advisoryFee - taxDrag) / 100;
}

function futureValueMonthly({
  start,
  monthly,
  annualReturn,
  years,
}: {
  start: number;
  monthly: number;
  annualReturn: number;
  years: number;
}) {
  const months = Math.max(0, Math.round(years * 12));
  const monthlyRate = annualReturn / 12;
  let balance = Number.isFinite(start) ? start : 0;

  for (let month = 1; month <= months; month += 1) {
    balance = balance * (1 + monthlyRate) + (Number.isFinite(monthly) ? monthly : 0);
  }

  return balance;
}

function buildScenarioSeries(settings: ScenarioSettings): ScenarioSeries[] {
  const series: ScenarioSeries[] = [];
  const years = Math.max(1, Math.round(settings.horizonYears));

  for (let year = 0; year <= years; year += 1) {
    const baseReturn = scenarioNetAnnualReturn(settings.expectedReturn, settings.advisoryFee, settings.taxDrag);
    const bullReturn = scenarioNetAnnualReturn(settings.bullReturn, settings.advisoryFee, settings.taxDrag);
    const bearReturn = scenarioNetAnnualReturn(settings.bearReturn, settings.advisoryFee, settings.taxDrag);
    const inflationRate = settings.inflation / 100;

    const base = futureValueMonthly({
      start: settings.startingBalance,
      monthly: settings.monthlyContribution,
      annualReturn: baseReturn,
      years: year,
    });

    const bull = futureValueMonthly({
      start: settings.startingBalance,
      monthly: settings.monthlyContribution,
      annualReturn: bullReturn,
      years: year,
    });

    const bear = futureValueMonthly({
      start: settings.startingBalance,
      monthly: settings.monthlyContribution,
      annualReturn: bearReturn,
      years: year,
    });

    series.push({
      year,
      base,
      bull,
      bear,
      realBase: base / Math.pow(1 + inflationRate, year),
      contributions: settings.startingBalance + settings.monthlyContribution * 12 * year,
    });
  }

  return series;
}

function riskCommentary(settings: ScenarioSettings) {
  if (settings.riskProfile === "Conservative") {
    return "This profile should emphasize downside control, liquidity, and client comfort over maximum upside.";
  }

  if (settings.riskProfile === "Balanced") {
    return "This profile can balance growth and stability, but the advisor should make volatility expectations very clear.";
  }

  if (settings.riskProfile === "Growth") {
    return "This profile can tolerate more equity exposure, but scenario ranges should be reviewed before implementation.";
  }

  return "This profile is aggressive. Use strict suitability review, volatility education, and clear downside framing.";
}

function allocationTotal(settings: ScenarioSettings) {
  return (
    settings.stockAllocation +
    settings.bondAllocation +
    settings.cashAllocation +
    settings.alternativeAllocation
  );
}

function readinessTone(value: number): Tone {
  if (value >= 85) return "green";
  if (value >= 68) return "cyan";
  if (value >= 45) return "amber";
  return "red";
}

function messageWordCount(messages: BotMessage[]) {
  return messages.reduce((count, message) => count + message.content.split(/\s+/).filter(Boolean).length, 0);
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span className={cx("inline-flex max-w-full rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1", tones[tone])}>
      <span className="truncate">{children}</span>
    </span>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/74 shadow-xl shadow-red-950/20 backdrop-blur-xl", className)}>
      {children}
    </div>
  );
}

function Panel({ children, className = "", tone = "slate" }: { children: ReactNode; className?: string; tone?: Tone }) {
  const glows: Record<Tone, string> = {
    red: "from-red-500/16",
    green: "from-emerald-500/16",
    amber: "from-amber-500/16",
    purple: "from-purple-500/16",
    cyan: "from-cyan-500/16",
    slate: "from-slate-400/8",
  };

  return (
    <div className={cx("relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.052] p-4 shadow-lg shadow-black/10", className)}>
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">{children}</div>
    </div>
  );
}

function Metric({ label, value, helper, tone = "slate" }: { label: string; value: string | number; helper?: string; tone?: Tone }) {
  const glows: Record<Tone, string> = {
    red: "from-red-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    cyan: "from-cyan-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function ProgressBar({ value, tone = "cyan" }: { value: number; tone?: Tone }) {
  const fills: Record<Tone, string> = {
    red: "from-red-700 to-red-400",
    green: "from-emerald-700 to-emerald-300",
    amber: "from-amber-700 to-amber-300",
    purple: "from-purple-700 to-purple-300",
    slate: "from-slate-700 to-slate-300",
    cyan: "from-cyan-700 to-cyan-300",
  };

  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-black/50">
      <div
        className={cx("h-full rounded-full bg-gradient-to-r", fills[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function BotOrb({ listening, speaking, configured }: { listening: boolean; speaking: boolean; configured: boolean }) {
  const active = listening || speaking;

  return (
    <div className="relative grid h-20 w-20 shrink-0 place-items-center">
      <span
        className={cx(
          "absolute inset-0 rounded-full blur-2xl",
          active ? "bg-cyan-400/25" : configured ? "bg-emerald-400/14" : "bg-amber-500/18"
        )}
      />
      {active ? <span className="absolute inset-0 animate-ping rounded-full border border-cyan-300/45" /> : null}

      <div
        className={cx(
          "relative grid h-16 w-16 place-items-center rounded-full border shadow-2xl",
          active
            ? "border-cyan-300/60 bg-gradient-to-br from-cyan-300/20 via-slate-950 to-black shadow-cyan-950/40"
            : configured
              ? "border-emerald-300/30 bg-gradient-to-br from-emerald-500/10 via-zinc-950 to-black shadow-emerald-950/35"
              : "border-amber-300/30 bg-gradient-to-br from-amber-500/10 via-zinc-950 to-black shadow-amber-950/35"
        )}
      >
        <div className="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/60 text-lg font-black">
          S
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
    {
      id: "quick",
      label: "Quick",
      helper: "Shorter answer",
      tone: "cyan",
    },
    {
      id: "balanced",
      label: "Balanced",
      helper: "Best default",
      tone: "green",
    },
    {
      id: "deep",
      label: "Deep",
      helper: "Longer wait, fuller answer",
      tone: "purple",
    },
  ];

  return (
    <div className="grid gap-2 rounded-[1.35rem] border border-white/10 bg-black/35 p-2 md:grid-cols-3">
      {modes.map((mode) => (
        <button
          key={mode.id}
          type="button"
          onClick={() => setAnswerMode(mode.id)}
          className={cx(
            "rounded-2xl px-3 py-2.5 text-left transition",
            answerMode === mode.id
              ? "bg-white text-slate-950 shadow-lg shadow-black/20"
              : "bg-white/[0.045] text-white hover:bg-white/[0.08]"
          )}
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
                    : "bg-purple-400"
              )}
            />
          </div>
          <div className={cx("mt-1 text-[10px] font-bold", answerMode === mode.id ? "text-slate-500" : "text-slate-500")}>
            {mode.helper}
          </div>
        </button>
      ))}
    </div>
  );
}

function ScenarioChart({ series }: { series: ScenarioSeries[] }) {
  const width = 900;
  const height = 340;
  const padding = 36;

  const values = series.flatMap((item) => [item.bear, item.base, item.bull, item.contributions]);
  const max = Math.max(...values);
  const min = Math.min(...values, 0);
  const range = max - min || 1;

  function pathFor(key: keyof Pick<ScenarioSeries, "base" | "bull" | "bear" | "contributions">) {
    return series
      .map((point, index) => {
        const x = padding + (index / Math.max(series.length - 1, 1)) * (width - padding * 2);
        const y = height - padding - ((point[key] - min) / range) * (height - padding * 2);
        return `${index === 0 ? "M" : "L"} ${x} ${y}`;
      })
      .join(" ");
  }

  return (
    <div className="rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
      <svg viewBox={`0 0 ${width} ${height}`} className="h-[340px] w-full">
        <path d={pathFor("bull")} fill="none" stroke="rgba(110,231,183,.95)" strokeWidth="4" />
        <path d={pathFor("base")} fill="none" stroke="rgba(34,211,238,.95)" strokeWidth="4" />
        <path d={pathFor("bear")} fill="none" stroke="rgba(248,113,113,.95)" strokeWidth="4" />
        <path d={pathFor("contributions")} fill="none" stroke="rgba(148,163,184,.65)" strokeWidth="3" strokeDasharray="8 8" />
        <text x={padding} y="24" fill="rgba(226,232,240,.9)" fontSize="14" fontWeight="700">
          Investment scenario projection
        </text>
        <text x={padding} y={height - 8} fill="rgba(148,163,184,.85)" fontSize="12">
          Year 0
        </text>
        <text x={width - padding - 70} y={height - 8} fill="rgba(148,163,184,.85)" fontSize="12">
          Final year
        </text>
        <text x={width - padding - 130} y="24" fill="rgba(226,232,240,.85)" fontSize="12">
          {compactMoney(max)}
        </text>
      </svg>

      <div className="mt-3 flex flex-wrap gap-2">
        <Pill tone="green">Bull</Pill>
        <Pill tone="cyan">Base</Pill>
        <Pill tone="red">Bear</Pill>
        <Pill tone="slate">Contributions</Pill>
      </div>
    </div>
  );
}

function AllocationBar({ settings }: { settings: ScenarioSettings }) {
  const total = Math.max(allocationTotal(settings), 1);

  const items = [
    ["Stocks", settings.stockAllocation, "bg-red-400"],
    ["Bonds", settings.bondAllocation, "bg-cyan-400"],
    ["Cash", settings.cashAllocation, "bg-emerald-400"],
    ["Alts", settings.alternativeAllocation, "bg-purple-400"],
  ];

  return (
    <div>
      <div className="flex h-4 overflow-hidden rounded-full bg-black/50">
        {items.map(([label, value, color]) => (
          <div
            key={String(label)}
            className={String(color)}
            style={{ width: `${(Number(value) / total) * 100}%` }}
          />
        ))}
      </div>
      <div className="mt-3 grid gap-2 md:grid-cols-4">
        {items.map(([label, value]) => (
          <div key={String(label)} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
            <div className="mt-1 text-xl font-black text-white">{value}%</div>
          </div>
        ))}
      </div>
    </div>
  );
}

function MessageBubble({
  message,
  onCopy,
  onSpeak,
}: {
  message: BotMessage;
  onCopy: (text: string) => void;
  onSpeak: (text: string) => void;
}) {
  const isUser = message.role === "user";
  const action = message.metadata?.clientAction;
  const actionText = actionLabel(action);
  const cleanedError = sanitizeError(message.metadata?.universalAiError);

  return (
    <div className={cx("flex", isUser ? "justify-end" : "justify-start")}>
      <article
        className={cx(
          "group max-w-[92%] rounded-[1.6rem] border shadow-lg md:max-w-[84%]",
          isUser
            ? "border-red-500/25 bg-gradient-to-br from-red-500/12 to-red-950/20 text-red-50"
            : "border-white/10 bg-gradient-to-br from-white/[0.075] to-white/[0.035] text-slate-100"
        )}
      >
        <div
          className={cx(
            "flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3",
            isUser ? "border-red-500/15" : "border-white/10"
          )}
        >
          <div className="flex flex-wrap items-center gap-2">
            <Pill tone={isUser ? "red" : toneFor(message.metadata?.universalAiStatus || message.intent)}>
              {isUser ? "You" : "Slice AI"}
            </Pill>
            <span className="text-[11px] font-semibold text-slate-500">{shortTime(message.createdAt)}</span>
            {!isUser && message.metadata?.answerMode ? (
              <Pill tone={modeTone(message.metadata.answerMode)}>
                {message.metadata.answerMode}
              </Pill>
            ) : null}
            {!isUser && message.metadata?.universalAiLatencyMs ? (
              <span className="text-[11px] text-slate-600">
                {Math.round(message.metadata.universalAiLatencyMs / 1000)}s
              </span>
            ) : null}
          </div>

          <div className="flex gap-2 opacity-100 md:opacity-0 md:transition md:group-hover:opacity-100">
            <button
              type="button"
              onClick={() => onCopy(message.content)}
              className="rounded-xl border border-white/10 bg-black/25 px-2.5 py-1.5 text-[10px] font-black text-slate-300 hover:bg-black/40"
            >
              Copy
            </button>
            {!isUser ? (
              <button
                type="button"
                onClick={() => onSpeak(message.content)}
                className="rounded-xl border border-cyan-500/25 bg-cyan-500/10 px-2.5 py-1.5 text-[10px] font-black text-cyan-100"
              >
                Read
              </button>
            ) : null}
          </div>
        </div>

        <div className="px-4 py-4">
          <div className="whitespace-pre-wrap text-sm leading-7">{message.content}</div>

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
        </div>
      </article>
    </div>
  );
}

function EmptyChatState({
  onPrompt,
}: {
  onPrompt: (prompt: string) => void;
}) {
  return (
    <div className="rounded-[1.75rem] border border-dashed border-white/10 bg-black/25 p-6">
      <div className="mx-auto max-w-3xl text-center">
        <div className="text-2xl font-black text-white">Start with a normal sentence.</div>
        <p className="mt-2 text-sm leading-6 text-slate-400">
          Slice AI is designed to feel like a teammate. Ask for a client explanation, meeting prep,
          investment scenario, platform guidance, or a report.
        </p>
      </div>

      <div className="mt-5 grid gap-3 md:grid-cols-3">
        {[
          "Prepare me for a client portfolio review.",
          "Explain this market move to a client.",
          "Build a retirement scenario for a new client.",
        ].map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => onPrompt(item)}
            className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-left text-sm leading-6 text-slate-300 hover:bg-white/[0.08]"
          >
            {item}
          </button>
        ))}
      </div>
    </div>
  );
}

function ThinkingCard({ answerMode }: { answerMode: AnswerMode }) {
  return (
    <div className="flex justify-start">
      <div className="max-w-[86%] rounded-[1.6rem] border border-cyan-500/20 bg-cyan-500/10 p-4 shadow-lg shadow-cyan-950/20">
        <div className="flex items-center gap-3">
          <div className="flex gap-1">
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.3s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300 [animation-delay:-0.15s]" />
            <span className="h-2 w-2 animate-bounce rounded-full bg-cyan-300" />
          </div>
          <div>
            <div className="text-sm font-black text-white">
              {answerMode === "deep" ? "Building a deeper answer..." : "Thinking..."}
            </div>
            <div className="mt-1 text-xs text-cyan-100/70">
              {answerMode === "deep"
                ? "Deep Mode waits longer so the answer can be more complete."
                : "Slice AI is preparing a clean advisor-grade response."}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ChatFocusPanel({
  selectedFocus,
  setSelectedFocus,
  onApply,
}: {
  selectedFocus: ChatFocus;
  setSelectedFocus: (focus: ChatFocus) => void;
  onApply: (prefix: string) => void;
}) {
  return (
    <Panel tone="cyan" className="bg-black/35">
      <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
        Choose a helpful starting lens
      </div>

      <div className="mt-3 grid gap-2">
        {focusCards.map((focus) => (
          <button
            key={focus.id}
            type="button"
            onClick={() => {
              setSelectedFocus(focus.id);
              onApply(focus.promptPrefix);
            }}
            className={cx(
              "rounded-2xl border p-3 text-left transition hover:bg-white/[0.08]",
              selectedFocus === focus.id
                ? "border-white/25 bg-white text-slate-950"
                : "border-white/10 bg-white/[0.045] text-white"
            )}
          >
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black">{focus.title}</div>
                <div className={cx("mt-1 text-xs", selectedFocus === focus.id ? "text-slate-500" : "text-slate-500")}>
                  {focus.helper}
                </div>
              </div>
              <span
                className={cx(
                  "mt-1 h-2.5 w-2.5 rounded-full",
                  focus.tone === "red"
                    ? "bg-red-400"
                    : focus.tone === "green"
                      ? "bg-emerald-400"
                      : focus.tone === "amber"
                        ? "bg-amber-400"
                        : focus.tone === "purple"
                          ? "bg-purple-400"
                          : focus.tone === "cyan"
                            ? "bg-cyan-400"
                            : "bg-slate-400"
                )}
              />
            </div>
          </button>
        ))}
      </div>
    </Panel>
  );
}

function ConversationStats({
  messages,
  latestAssistant,
}: {
  messages: BotMessage[];
  latestAssistant?: BotMessage;
}) {
  const assistantCount = messages.filter((message) => message.role === "assistant").length;
  const userCount = messages.filter((message) => message.role === "user").length;
  const words = messageWordCount(messages);

  return (
    <Panel tone="purple" className="bg-black/35">
      <div className="text-xs font-black uppercase tracking-[0.22em] text-purple-300">
        Conversation
      </div>
      <div className="mt-3 grid grid-cols-2 gap-2">
        <Metric label="You" value={userCount} tone="red" />
        <Metric label="AI" value={assistantCount} tone="cyan" />
        <Metric label="Words" value={words} tone="purple" />
        <Metric label="Latest" value={latestAssistant ? relativeTime(latestAssistant.createdAt) : "—"} tone="slate" />
      </div>
    </Panel>
  );
}

export default function PersonalBotPage() {
  const [data, setData] = useState<BotPayload | null>(null);
  const [prompt, setPrompt] = useState("");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeView, setActiveView] = useState<StudioView>("chat");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("balanced");
  const [selectedFocus, setSelectedFocus] = useState<ChatFocus>("advisor");
  const [listening, setListening] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [voiceSupported, setVoiceSupported] = useState(false);

  const [scenario, setScenario] = useState<ScenarioSettings>({
    clientName: "New Client",
    clientAge: 42,
    startingBalance: 250000,
    monthlyContribution: 2500,
    horizonYears: 20,
    expectedReturn: 7,
    bearReturn: 2,
    bullReturn: 10,
    inflation: 2.5,
    advisoryFee: 0.85,
    taxDrag: 0.6,
    volatility: 14,
    stockAllocation: 65,
    bondAllocation: 25,
    cashAllocation: 5,
    alternativeAllocation: 5,
    riskProfile: "Balanced",
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
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const profile = data?.profile;
  const aiEngine = data?.aiEngine;
  const messages = data?.messages ?? [];
  const reports = data?.pdfReports ?? [];
  const commands = data?.commands ?? [];
  const memories = data?.memories ?? [];
  const approvals = [...(data?.approvals ?? []), ...(data?.backendApprovals ?? [])];

  const latestAssistant = useMemo(
    () => [...messages].reverse().find((item) => item.role === "assistant"),
    [messages]
  );

  const pinnedPrompts = useMemo(() => {
    const pinned = data?.tabs?.flatMap((tab) => tab.pinnedCommands ?? []) ?? [];
    return pinned.length ? pinned.slice(0, 8) : starterPrompts;
  }, [data]);

  const scenarioSeries = useMemo(() => buildScenarioSeries(scenario), [scenario]);
  const finalScenario = scenarioSeries[scenarioSeries.length - 1];
  const totalContributions = finalScenario?.contributions ?? 0;
  const projectedGain = (finalScenario?.base ?? 0) - totalContributions;
  const allocationSum = allocationTotal(scenario);
  const studioReadiness = useMemo(() => {
    let score = 30;

    if (aiEngine?.configured) score += 25;
    if (messages.length) score += 12;
    if (reports.length) score += 8;
    if (profile?.customInstructions) score += 8;
    if (profile?.voiceEnabled) score += 7;
    if (approvals.length === 0) score += 5;
    if (memories.length) score += 5;

    return Math.max(0, Math.min(100, score));
  }, [aiEngine?.configured, messages.length, reports.length, profile?.customInstructions, profile?.voiceEnabled, approvals.length, memories.length]);

  const scenarioPrompt = useMemo(() => {
    return `Create a client-friendly investment scenario for ${scenario.clientName}. Starting balance: ${money(
      scenario.startingBalance
    )}. Monthly contribution: ${money(scenario.monthlyContribution)}. Horizon: ${
      scenario.horizonYears
    } years. Risk profile: ${scenario.riskProfile}. Allocation: ${scenario.stockAllocation}% stocks, ${
      scenario.bondAllocation
    }% bonds, ${scenario.cashAllocation}% cash, ${
      scenario.alternativeAllocation
    }% alternatives. Base return: ${scenario.expectedReturn}%, bear return: ${
      scenario.bearReturn
    }%, bull return: ${scenario.bullReturn}%, inflation: ${scenario.inflation}%, advisory fee: ${
      scenario.advisoryFee
    }%, tax drag: ${scenario.taxDrag}%. Explain the base, bull, and bear cases clearly, include advisor talking points, and avoid guarantees.`;
  }, [scenario]);

  async function loadData() {
    const response = await fetch("/api/personal-bot", {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Could not load AI Studio.");
      return;
    }

    setData(payload);
    setDraftProfile({
      botName: payload.profile.botName ?? "Slice AI",
      preferredTone: payload.profile.preferredTone ?? "Professional",
      commandStyle: payload.profile.commandStyle ?? "Balanced detail",
      autonomyLevel: payload.profile.autonomyLevel ?? "Advisor approval required",
      customInstructions: payload.profile.customInstructions ?? "",
      voiceEnabled: Boolean(payload.profile.voiceEnabled),
    });
  }

  async function sendPrompt(value = prompt, voiceTranscript?: string) {
    const trimmed = value.trim();

    if (!trimmed) return;

    setSaving(true);
    setMessage("");
    setPrompt("");

    try {
      const response = await fetch("/api/personal-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "ai-studio-send-message",
        },
        body: JSON.stringify({
          action: "sendMessage",
          prompt: trimmed,
          answerMode,
          voiceTranscript,
          currentPath: "/workspace/personal-bot",
          pageTitle: "Slice AI Studio",
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "AI Studio could not answer.");
        return;
      }

      setData(payload);
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
      const response = await fetch("/api/personal-bot", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "ai-studio-update-profile",
        },
        body: JSON.stringify({
          action: "updateProfile",
          ...draftProfile,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Could not save profile.");
        return;
      }

      setData(payload);
      setMessage("AI Studio preferences saved.");
    } finally {
      setSaving(false);
    }
  }

  async function copyText(text: string, label = "Copied.") {
    await navigator.clipboard.writeText(text);
    setMessage(label);
  }

  async function copyScenarioSummary() {
    const summary = [
      `${scenario.clientName} Investment Scenario`,
      "",
      `Starting balance: ${money(scenario.startingBalance)}`,
      `Monthly contribution: ${money(scenario.monthlyContribution)}`,
      `Horizon: ${scenario.horizonYears} years`,
      `Risk profile: ${scenario.riskProfile}`,
      `Allocation: ${scenario.stockAllocation}% stocks, ${scenario.bondAllocation}% bonds, ${scenario.cashAllocation}% cash, ${scenario.alternativeAllocation}% alternatives`,
      "",
      `Base projected value: ${money(finalScenario?.base ?? 0)}`,
      `Bull projected value: ${money(finalScenario?.bull ?? 0)}`,
      `Bear projected value: ${money(finalScenario?.bear ?? 0)}`,
      `Real base value after inflation: ${money(finalScenario?.realBase ?? 0)}`,
      `Total contributions: ${money(totalContributions)}`,
      `Projected base gain: ${money(projectedGain)}`,
      "",
      riskCommentary(scenario),
      "",
      "This is a planning illustration, not a guarantee or recommendation.",
    ].join("\n");

    await copyText(summary, "Scenario summary copied.");
  }

  function speak(text: string) {
    if (typeof window === "undefined" || !window.speechSynthesis) return;

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(stripForSpeech(text));
    utterance.lang = profile?.speechLanguage || "en-GB";
    utterance.rate = 0.92;
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

  function startListening() {
    if (typeof window === "undefined") return;

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setMessage("Voice recognition is not available in this browser.");
      return;
    }

    const recognition = new (SpeechRecognition as SpeechRecognitionConstructor)();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = profile?.speechLanguage || "en-GB";

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

      setPrompt((finalTranscript || interim).trim());
    };

    recognition.onend = () => {
      setListening(false);

      if (finalTranscript.trim()) {
        void sendPrompt(finalTranscript.trim(), finalTranscript.trim());
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

  function updateScenario<K extends keyof ScenarioSettings>(key: K, value: ScenarioSettings[K]) {
    setScenario((current) => ({
      ...current,
      [key]: value,
    }));
  }

  function applyFocusPrefix(prefix: string) {
    setPrompt((current) => {
      if (current.trim().startsWith(prefix.trim())) return current;
      return current.trim() ? `${prefix}${current}` : prefix;
    });
  }

  useEffect(() => {
    void loadData();

    if (typeof window !== "undefined") {
      setVoiceSupported(Boolean((window as any).SpeechRecognition || (window as any).webkitSpeechRecognition));
    }
  }, []);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages.length, saving]);

  if (!data) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.30),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.14),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
        <Card className="mx-auto mt-20 max-w-3xl p-8 text-center">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">Slice AI Studio</div>
          <h1 className="mt-4 text-3xl font-black">Loading your AI workspace...</h1>
          {message ? <p className="mt-3 text-sm text-red-200">{message}</p> : null}
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.30),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.14),_transparent_28%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1900px] gap-5">
        <header className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-zinc-950/76 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(239,68,68,0.20),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(6,182,212,0.12),transparent_26%)]" />

          <div className="relative flex flex-col gap-6 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex gap-5">
              <BotOrb listening={listening} speaking={speaking} configured={Boolean(aiEngine?.configured)} />

              <div>
                <div className="flex flex-wrap gap-2">
                  <Pill tone={aiEngine?.configured ? "green" : "amber"}>
                    {aiEngine?.configured ? "API connected" : "Fallback mode"}
                  </Pill>
                  <Pill tone={modeTone(answerMode)}>{answerMode} mode</Pill>
                  <Pill tone="purple">Scenario lab</Pill>
                  <Pill tone="green">Client friendly</Pill>
                </div>

                <h1 className="mt-4 max-w-5xl text-4xl font-black tracking-tight md:text-6xl">
                  Slice AI Studio, simplified.
                </h1>

                <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-400">
                  A calmer, cleaner command center for answers, client communication, meeting prep,
                  investment scenarios, reports, platform guidance, and voice-assisted work.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <a href="/workspace" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20">
                ← Workspace
              </a>
              <a href="/workspace/client-briefings" className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-black text-purple-100 hover:bg-purple-500/20">
                Client Briefings
              </a>
              <a href="/market-visuals" className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 hover:bg-red-500/20">
                Market Visuals
              </a>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Metric label="AI Provider" value={aiEngine?.configured ? "OpenAI" : "Fallback"} helper={aiEngine?.provider} tone={aiEngine?.configured ? "green" : "amber"} />
            <Metric label="Model" value={answerMode === "deep" ? aiEngine?.qualityModel ?? aiEngine?.model ?? "—" : aiEngine?.model ?? "—"} helper="Selected by mode" tone="cyan" />
            <Metric label="Studio Score" value={`${studioReadiness}%`} helper="Usability readiness" tone={readinessTone(studioReadiness)} />
            <Metric label="Reports" value={reports.length} helper="Generated PDFs" tone="green" />
            <Metric label="Approvals" value={approvals.length} helper="Review gates" tone={approvals.length ? "amber" : "slate"} />
            <Metric label="Voice" value={voiceSupported ? "Available" : "Unavailable"} helper={profile?.speechLanguage ?? "en-GB"} tone={voiceSupported ? "green" : "slate"} />
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <Card className="p-3">
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {[
              ["chat", "Chat", "Clean command", "cyan"],
              ["prompts", "Shortcuts", "Start faster", "green"],
              ["scenarios", "Scenarios", "Client graphs", "red"],
              ["reports", "Reports", "PDF output", "purple"],
              ["memory", "Memory", "Context", "amber"],
              ["settings", "Settings", "Tone + API", "slate"],
            ].map(([key, label, helper, tone]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveView(key as StudioView)}
                className={cx(
                  "rounded-2xl px-4 py-3 text-left transition",
                  activeView === key
                    ? "bg-white text-slate-950 shadow-lg shadow-black/20"
                    : "border border-white/10 bg-white/[0.045] text-white hover:bg-white/10"
                )}
              >
                <div className="text-sm font-black">{label}</div>
                <div className={cx("mt-1 text-[10px] font-bold", activeView === key ? "text-slate-500" : "text-slate-500")}>
                  {helper}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {activeView === "chat" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card className="grid min-h-[760px] grid-rows-[auto_1fr_auto] p-0">
              <div className="border-b border-white/10 bg-black/20 p-5">
                <div className="flex flex-col gap-4 2xl:flex-row 2xl:items-center 2xl:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                      Clean Chat Workspace
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">Ask. Review. Use.</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                      Choose a response depth, write naturally, and keep the conversation focused.
                    </p>
                  </div>

                  <div className="min-w-[300px] 2xl:min-w-[420px]">
                    <AnswerModeSelector answerMode={answerMode} setAnswerMode={setAnswerMode} />
                  </div>
                </div>
              </div>

              <div className="grid max-h-[650px] gap-4 overflow-y-auto bg-black/10 p-5">
                {messages.length ? (
                  messages.map((item) => (
                    <MessageBubble
                      key={item.id}
                      message={item}
                      onCopy={(text) => copyText(text, "Message copied.")}
                      onSpeak={speak}
                    />
                  ))
                ) : (
                  <EmptyChatState
                    onPrompt={(item) => {
                      setPrompt(item);
                    }}
                  />
                )}
                {saving ? <ThinkingCard answerMode={answerMode} /> : null}
                <div ref={messagesEndRef} />
              </div>

              <div className="border-t border-white/10 bg-zinc-950/95 p-4">
                <div className="mb-3 flex flex-wrap gap-2">
                  {focusCards.slice(0, 4).map((focus) => (
                    <button
                      key={focus.id}
                      type="button"
                      onClick={() => {
                        setSelectedFocus(focus.id);
                        applyFocusPrefix(focus.promptPrefix);
                      }}
                      className={cx(
                        "rounded-2xl px-3 py-2 text-xs font-black ring-1 transition",
                        selectedFocus === focus.id
                          ? "bg-white text-slate-950 ring-white/20"
                          : "bg-white/[0.045] text-slate-300 ring-white/10 hover:bg-white/[0.08]"
                      )}
                    >
                      {focus.title}
                    </button>
                  ))}
                </div>

                <form
                  onSubmit={(event: FormEvent) => {
                    event.preventDefault();
                    void sendPrompt();
                  }}
                  className="rounded-[1.75rem] border border-white/10 bg-black/35 p-3"
                >
                  <textarea
                    value={prompt}
                    onChange={(event) => setPrompt(event.target.value)}
                    onKeyDown={onPromptKeyDown}
                    placeholder="Ask naturally. Example: Help me prepare a client-friendly explanation of NVDA exposure..."
                    className="min-h-[118px] w-full resize-none rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-cyan-400/40"
                  />

                  <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div className="flex flex-wrap gap-2">
                      {voiceSupported ? (
                        <button
                          type="button"
                          onClick={listening ? stopListening : startListening}
                          className={cx(
                            "rounded-2xl px-4 py-2 text-xs font-black ring-1",
                            listening
                              ? "bg-red-500/10 text-red-100 ring-red-500/30"
                              : "bg-cyan-500/10 text-cyan-100 ring-cyan-500/30"
                          )}
                        >
                          {listening ? "Stop Listening" : "Voice"}
                        </button>
                      ) : null}

                      {latestAssistant?.content ? (
                        <button
                          type="button"
                          onClick={() => speak(latestAssistant.content)}
                          className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-xs font-black text-cyan-100"
                        >
                          Read Latest
                        </button>
                      ) : null}

                      {speaking ? (
                        <button
                          type="button"
                          onClick={stopSpeaking}
                          className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100"
                        >
                          Stop Voice
                        </button>
                      ) : null}

                      <button
                        type="button"
                        onClick={() => setPrompt("")}
                        className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-2 text-xs font-black text-slate-300"
                      >
                        Clear
                      </button>
                    </div>

                    <button
                      disabled={saving || !prompt.trim()}
                      className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                    >
                      {saving ? (answerMode === "deep" ? "Thinking deeply..." : "Thinking...") : "Send"}
                    </button>
                  </div>
                </form>
              </div>
            </Card>

            <div className="grid gap-5">
              <Panel tone={aiEngine?.configured ? "green" : "amber"} className="bg-black/35">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                      API status
                    </div>
                    <h3 className="mt-2 text-2xl font-black text-white">
                      {aiEngine?.configured ? "Live AI is connected" : "Fallback mode is active"}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {aiEngine?.configured
                        ? `Using ${aiEngine.provider}. Deep Mode waits longer for fuller answers.`
                        : `Add ${aiEngine?.requiredEnv ?? "OPENAI_API_KEY"} to enable live AI responses.`}
                    </p>
                  </div>
                  <Pill tone={aiEngine?.configured ? "green" : "amber"}>
                    {aiEngine?.configured ? "Ready" : "Needs key"}
                  </Pill>
                </div>

                <div className="mt-4">
                  <ProgressBar value={studioReadiness} tone={readinessTone(studioReadiness)} />
                </div>
              </Panel>

              <ChatFocusPanel
                selectedFocus={selectedFocus}
                setSelectedFocus={setSelectedFocus}
                onApply={applyFocusPrefix}
              />

              <ConversationStats messages={messages} latestAssistant={latestAssistant} />

              <Panel tone="green" className="bg-black/35">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-300">
                  Best quick starts
                </div>
                <div className="mt-3 grid gap-2">
                  {starterPrompts.slice(0, 5).map((item) => (
                    <button
                      key={item}
                      type="button"
                      onClick={() => setPrompt(item)}
                      className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-left text-sm leading-6 text-slate-300 hover:bg-white/[0.08]"
                    >
                      {item}
                    </button>
                  ))}
                </div>
              </Panel>
            </div>
          </section>
        ) : null}

        {activeView === "prompts" ? (
          <section className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-green-300">
                Shortcuts
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Make AI Studio easier to use</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Pick a mode or prompt. It loads into the chat box so the user does not have to start from a blank page.
              </p>

              <div className="mt-5 grid gap-3">
                {quickModes.map((mode) => (
                  <button
                    key={mode.title}
                    type="button"
                    onClick={() => {
                      setPrompt(mode.prompt);
                      setActiveView("chat");
                    }}
                    className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4 text-left hover:bg-white/[0.08]"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-lg font-black text-white">{mode.title}</div>
                        <p className="mt-1 text-sm text-slate-400">{mode.helper}</p>
                      </div>
                      <Pill tone={mode.tone}>Mode</Pill>
                    </div>
                  </button>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <div className="grid gap-3 md:grid-cols-2">
                {pinnedPrompts.map((item) => (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setPrompt(item);
                      setActiveView("chat");
                    }}
                    className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4 text-left transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
                  >
                    <div className="text-sm font-black text-white">Prompt</div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{item}</p>
                  </button>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "scenarios" ? (
          <section className="grid gap-5 xl:grid-cols-[460px_minmax(0,1fr)]">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-red-300">
                New client scenario lab
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Build a client-ready investment scenario</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Adjust assumptions, view base/bull/bear outcomes, then ask Slice AI to turn it into a client-friendly explanation.
              </p>

              <div className="mt-5 grid gap-4">
                <label>
                  <span className="text-xs font-black uppercase text-slate-500">Client name</span>
                  <input
                    value={scenario.clientName}
                    onChange={(event) => updateScenario("clientName", event.target.value)}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-2">
                  <label>
                    <span className="text-xs font-black uppercase text-slate-500">Client age</span>
                    <input
                      type="number"
                      value={scenario.clientAge}
                      onChange={(event) => updateScenario("clientAge", Number(event.target.value))}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                    />
                  </label>

                  <label>
                    <span className="text-xs font-black uppercase text-slate-500">Risk profile</span>
                    <select
                      value={scenario.riskProfile}
                      onChange={(event) => updateScenario("riskProfile", event.target.value as ScenarioSettings["riskProfile"])}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                    >
                      <option>Conservative</option>
                      <option>Balanced</option>
                      <option>Growth</option>
                      <option>Aggressive</option>
                    </select>
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-2">
                  <label>
                    <span className="text-xs font-black uppercase text-slate-500">Starting balance</span>
                    <input
                      type="number"
                      value={scenario.startingBalance}
                      onChange={(event) => updateScenario("startingBalance", Number(event.target.value))}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                    />
                  </label>

                  <label>
                    <span className="text-xs font-black uppercase text-slate-500">Monthly contribution</span>
                    <input
                      type="number"
                      value={scenario.monthlyContribution}
                      onChange={(event) => updateScenario("monthlyContribution", Number(event.target.value))}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                    />
                  </label>
                </div>

                <label>
                  <span className="text-xs font-black uppercase text-slate-500">Horizon: {scenario.horizonYears} years</span>
                  <input
                    type="range"
                    min={1}
                    max={40}
                    value={scenario.horizonYears}
                    onChange={(event) => updateScenario("horizonYears", Number(event.target.value))}
                    className="mt-3 w-full"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <label>
                    <span className="text-xs font-black uppercase text-slate-500">Bear %</span>
                    <input
                      type="number"
                      value={scenario.bearReturn}
                      onChange={(event) => updateScenario("bearReturn", Number(event.target.value))}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                    />
                  </label>
                  <label>
                    <span className="text-xs font-black uppercase text-slate-500">Base %</span>
                    <input
                      type="number"
                      value={scenario.expectedReturn}
                      onChange={(event) => updateScenario("expectedReturn", Number(event.target.value))}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                    />
                  </label>
                  <label>
                    <span className="text-xs font-black uppercase text-slate-500">Bull %</span>
                    <input
                      type="number"
                      value={scenario.bullReturn}
                      onChange={(event) => updateScenario("bullReturn", Number(event.target.value))}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                    />
                  </label>
                </div>

                <div className="grid gap-4 md:grid-cols-3">
                  <label>
                    <span className="text-xs font-black uppercase text-slate-500">Inflation %</span>
                    <input
                      type="number"
                      value={scenario.inflation}
                      onChange={(event) => updateScenario("inflation", Number(event.target.value))}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                    />
                  </label>
                  <label>
                    <span className="text-xs font-black uppercase text-slate-500">Fee %</span>
                    <input
                      type="number"
                      value={scenario.advisoryFee}
                      onChange={(event) => updateScenario("advisoryFee", Number(event.target.value))}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                    />
                  </label>
                  <label>
                    <span className="text-xs font-black uppercase text-slate-500">Tax drag %</span>
                    <input
                      type="number"
                      value={scenario.taxDrag}
                      onChange={(event) => updateScenario("taxDrag", Number(event.target.value))}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                    />
                  </label>
                </div>

                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-sm font-black text-white">Allocation</div>
                    <Pill tone={allocationSum === 100 ? "green" : "amber"}>{allocationSum}%</Pill>
                  </div>

                  <div className="mt-4 grid gap-3">
                    {[
                      ["Stocks", "stockAllocation"],
                      ["Bonds", "bondAllocation"],
                      ["Cash", "cashAllocation"],
                      ["Alternatives", "alternativeAllocation"],
                    ].map(([label, key]) => (
                      <label key={key}>
                        <span className="text-xs font-black uppercase text-slate-500">
                          {label}: {scenario[key as keyof ScenarioSettings]}%
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={100}
                          value={Number(scenario[key as keyof ScenarioSettings])}
                          onChange={(event) => updateScenario(key as keyof ScenarioSettings, Number(event.target.value) as never)}
                          className="mt-2 w-full"
                        />
                      </label>
                    ))}
                  </div>
                </div>

                <div className="grid gap-3 md:grid-cols-2">
                  <button
                    type="button"
                    onClick={() => {
                      setPrompt(scenarioPrompt);
                      setAnswerMode("deep");
                      setActiveView("chat");
                    }}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
                  >
                    Ask AI to Explain
                  </button>

                  <button
                    type="button"
                    onClick={copyScenarioSummary}
                    className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100"
                  >
                    Copy Summary
                  </button>
                </div>
              </div>
            </Card>

            <div className="grid gap-5">
              <Card className="p-5">
                <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.22em] text-red-300">
                      Scenario output
                    </div>
                    <h2 className="mt-2 text-2xl font-black text-white">{scenario.clientName}</h2>
                    <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
                      {riskCommentary(scenario)}
                    </p>
                  </div>
                  <Pill tone={allocationSum === 100 ? "green" : "amber"}>
                    {allocationSum === 100 ? "Allocation balanced" : "Allocation needs review"}
                  </Pill>
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  <Metric label="Base value" value={money(finalScenario?.base ?? 0)} helper="Projected nominal" tone="cyan" />
                  <Metric label="Bull value" value={money(finalScenario?.bull ?? 0)} helper="Upside case" tone="green" />
                  <Metric label="Bear value" value={money(finalScenario?.bear ?? 0)} helper="Downside case" tone="red" />
                  <Metric label="Real base" value={money(finalScenario?.realBase ?? 0)} helper="After inflation" tone="purple" />
                  <Metric label="Contributions" value={money(totalContributions)} helper="Total paid in" tone="slate" />
                  <Metric label="Base gain" value={money(projectedGain)} helper="Projected growth" tone={projectedGain >= 0 ? "green" : "red"} />
                  <Metric label="Net base return" value={`${(scenario.expectedReturn - scenario.advisoryFee - scenario.taxDrag).toFixed(2)}%`} helper="After fee/tax drag" tone="amber" />
                  <Metric label="Volatility" value={`${scenario.volatility}%`} helper="Planning assumption" tone="red" />
                </div>

                <div className="mt-5">
                  <ScenarioChart series={scenarioSeries} />
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                  Allocation view
                </div>
                <div className="mt-4">
                  <AllocationBar settings={scenario} />
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-purple-300">
                  Advisor talking points
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  {[
                    "This is an illustration, not a guarantee.",
                    "The bear case helps frame downside expectations before the client sees upside projections.",
                    "Real return after inflation is often more useful than nominal return for planning conversations.",
                    "Fees and tax drag should be visible so expectations feel honest.",
                    "Allocation should total 100% before using this in a client meeting.",
                    "Ask AI to turn this scenario into client-friendly language before sending externally.",
                  ].map((item) => (
                    <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4 text-sm leading-6 text-slate-300">
                      {item}
                    </div>
                  ))}
                </div>
              </Card>
            </div>
          </section>
        ) : null}

        {activeView === "reports" ? (
          <section className="grid gap-5">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-purple-300">
                Reports
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">AI-generated reports</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Reports are created when the prompt asks for a report, PDF, briefing, deck, packet, or presentation.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {reports.map((report) => (
                  <Panel key={report.id} tone={toneFor(report.status)} className="bg-black/35">
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={toneFor(report.status)}>{report.status}</Pill>
                      <Pill tone="purple">{report.reportType}</Pill>
                    </div>
                    <h3 className="mt-3 text-lg font-black text-white">{report.title}</h3>
                    <div className="mt-2 text-xs text-slate-500">{formatTime(report.createdAt)}</div>
                    <a
                      href={report.downloadUrl}
                      target="_blank"
                      rel="noreferrer"
                      className="mt-4 inline-flex rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                    >
                      Open Report
                    </a>
                  </Panel>
                ))}

                {!reports.length ? (
                  <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
                    No reports yet. Ask AI Studio to “create a report” or “make a PDF.”
                  </div>
                ) : null}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "memory" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_430px]">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-300">
                Memory
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Useful context</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                AI Studio can display stored preferences, remembered items, approvals, and platform routes.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {memories.map((memory) => (
                  <Panel key={memory.id} tone={toneFor(memory.status)} className="bg-black/35">
                    <div className="flex flex-wrap gap-2">
                      <Pill tone="amber">{memory.memoryType}</Pill>
                      <Pill tone={toneFor(memory.status)}>{memory.status}</Pill>
                    </div>
                    <h3 className="mt-3 text-lg font-black text-white">{memory.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{memory.value}</p>
                    <div className="mt-3 text-xs text-slate-500">Confidence {memory.confidenceScore}%</div>
                  </Panel>
                ))}

                {!memories.length ? (
                  <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
                    No memories yet.
                  </div>
                ) : null}
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-red-300">
                Approvals
              </div>
              <div className="mt-4 grid gap-3">
                {approvals.slice(0, 8).map((approval) => (
                  <Panel key={approval.id} tone={toneFor(approval.status)} className="bg-black/35">
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={toneFor(approval.status)}>{approval.status}</Pill>
                      <Pill tone={toneFor(approval.riskLevel)}>{approval.riskLevel}</Pill>
                    </div>
                    <h3 className="mt-3 text-sm font-black text-white">{approval.title}</h3>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{approval.summary}</p>
                  </Panel>
                ))}
                {!approvals.length ? <div className="text-sm text-slate-500">No approvals pending.</div> : null}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "settings" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-red-300">
                Preferences
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Make AI Studio feel like you want</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                These settings keep the assistant useful without making the interface feel overly technical.
              </p>

              <div className="mt-5 grid gap-4">
                <label>
                  <span className="text-xs font-black uppercase text-slate-500">Bot name</span>
                  <input
                    value={draftProfile.botName}
                    onChange={(event) => setDraftProfile((current) => ({ ...current, botName: event.target.value }))}
                    className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                  />
                </label>

                <div className="grid gap-4 md:grid-cols-3">
                  <label>
                    <span className="text-xs font-black uppercase text-slate-500">Tone</span>
                    <select
                      value={draftProfile.preferredTone}
                      onChange={(event) => setDraftProfile((current) => ({ ...current, preferredTone: event.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                    >
                      <option>Professional</option>
                      <option>Calm</option>
                      <option>Direct</option>
                      <option>Encouraging</option>
                      <option>Brutally honest</option>
                      <option>Witty</option>
                    </select>
                  </label>

                  <label>
                    <span className="text-xs font-black uppercase text-slate-500">Detail</span>
                    <select
                      value={draftProfile.commandStyle}
                      onChange={(event) => setDraftProfile((current) => ({ ...current, commandStyle: event.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                    >
                      <option>Short</option>
                      <option>Balanced detail</option>
                      <option>Detailed</option>
                      <option>Deep research</option>
                    </select>
                  </label>

                  <label>
                    <span className="text-xs font-black uppercase text-slate-500">Autonomy</span>
                    <select
                      value={draftProfile.autonomyLevel}
                      onChange={(event) => setDraftProfile((current) => ({ ...current, autonomyLevel: event.target.value }))}
                      className="mt-2 w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                    >
                      <option>Advisor approval required</option>
                      <option>Suggest only</option>
                      <option>Draft only</option>
                      <option>Autonomous where safe</option>
                    </select>
                  </label>
                </div>

                <label>
                  <span className="text-xs font-black uppercase text-slate-500">Custom instructions</span>
                  <textarea
                    value={draftProfile.customInstructions}
                    onChange={(event) => setDraftProfile((current) => ({ ...current, customInstructions: event.target.value }))}
                    className="mt-2 min-h-[140px] w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
                    placeholder="Tell Slice AI how to answer, what to prioritize, and what to avoid..."
                  />
                </label>

                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-sm font-bold text-slate-300">
                  Voice replies enabled
                  <input
                    type="checkbox"
                    checked={draftProfile.voiceEnabled}
                    onChange={(event) => setDraftProfile((current) => ({ ...current, voiceEnabled: event.target.checked }))}
                  />
                </label>

                <button
                  type="button"
                  onClick={saveProfile}
                  disabled={saving}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                >
                  Save Preferences
                </button>
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-300">
                API setup
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                {aiEngine?.configured ? "Connected" : "Needs environment key"}
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                AI Studio uses the shared Slice AI integration. Add your key as an environment variable named <span className="font-black text-white">OPENAI_API_KEY</span>, then restart the dev server.
              </p>

              <div className="mt-5 grid gap-3">
                <Metric label="Provider" value={aiEngine?.provider ?? "—"} tone={aiEngine?.configured ? "green" : "amber"} />
                <Metric label="Quick/Balanced Model" value={aiEngine?.model ?? "—"} tone="cyan" />
                <Metric label="Deep Model" value={aiEngine?.qualityModel ?? aiEngine?.model ?? "—"} tone="purple" />
                <Metric label="Web Search" value={aiEngine?.webSearchEnabled ? "Enabled" : "Off"} tone={aiEngine?.webSearchEnabled ? "green" : "slate"} />
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Local setup</div>
                <pre className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-300">{`OPENAI_API_KEY=your_key_here
OPENAI_MODEL=gpt-4.1-mini
OPENAI_QUALITY_MODEL=gpt-4.1
OPENAI_ENABLE_WEB_SEARCH=false`}</pre>
              </div>

              <div className="mt-5 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Timeout policy</div>
                <div className="mt-3 grid gap-2 text-sm text-emerald-50/80">
                  <div>Quick: about {Math.round((aiEngine?.timeoutPolicy?.quickMs ?? 45000) / 1000)}s</div>
                  <div>Balanced: about {Math.round((aiEngine?.timeoutPolicy?.balancedMs ?? 95000) / 1000)}s</div>
                  <div>Deep: about {Math.round((aiEngine?.timeoutPolicy?.deepMs ?? 150000) / 1000)}s</div>
                </div>
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}