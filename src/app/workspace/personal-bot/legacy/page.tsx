"use client";

import Link from "next/link";
import {
  Activity,
  ArrowUpRight,
  Bot,
  BrainCircuit,
  CircleStop,
  Database,
  FileChartColumnIncreasing,
  Gauge,
  Headphones,
  Loader2,
  Mail,
  Mic,
  Radio,
  RefreshCw,
  Search,
  Send,
  Settings2,
  ShieldCheck,
  Sparkles,
  Trash2,
  Waves,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from "react";

import {
  BrandMark,
  Card,
  SliceBackground,
} from "@/components/slice-ui";
import {
  WorkspaceAlert,
  WorkspaceButton,
  WorkspacePill,
  WorkspaceSurface,
  WorkspaceTextarea,
  cx,
} from "@/components/workspace/core/workspace-ui";

type StudioTab = "brain" | "voice" | "reports" | "autonomy";
type AnswerMode = "quick" | "balanced" | "deep";

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
    sources?: AiSource[];
    researchUsed?: boolean;
    fastRouterUsed?: boolean;
    fastRouterConfidence?: number | null;
    universalAiLatencyMs?: number | null;
    universalAiModel?: string | null;
    executionStatus?: string;
    resultSummary?: string;
    executionLane?: string;
    evidenceScore?: number;
    [key: string]: unknown;
  };
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
    confidenceScore?: number;
    advisorReviewRequired?: boolean;
    sources?: AiSource[];
    [key: string]: unknown;
  };
};

type MemoryPolicy = {
  maximumSearches: number;
  storedSearches: number;
  reportsPreserved?: boolean;
  auditHistoryPreserved?: boolean;
  description?: string;
};

type StudioBootstrap = {
  ok?: boolean;
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
    model: string;
    fastModel?: string;
    qualityModel?: string;
    webSearchEnabled?: boolean;
    health?: {
      ok: boolean;
      status: string;
      latencyMs: number;
      error?: string;
    };
    audio?: {
      configured: boolean;
      provider: string;
      transcriptionModel: string;
      speechModel: string;
      speechVoice: string;
      speechFormat: string;
    };
  };
  platformContext?: {
    generatedAt?: string;
    firm?: {
      id?: string | null;
      name?: string | null;
      role?: string | null;
    } | null;
  } | null;
  messages: BotMessage[];
  pdfReports?: PdfReport[];
  approvals?: Array<{ id: string; title: string; status: string }>;
  backendApprovals?: Array<{ id: string; title: string; status: string }>;
  lastExecution?: {
    status: string;
    resultSummary: string;
    clientAction?: ClientAction;
    sources?: AiSource[];
    researchUsed?: boolean;
  } | null;
  memoryPolicy: MemoryPolicy;
  error?: string;
};

type InstantResponse = {
  ok: boolean;
  latencyMs: number;
  transcriptionMs?: number | null;
  transcript?: string | null;
  userMessage: BotMessage;
  assistantMessage: BotMessage;
  result: {
    intent: string;
    status: string;
    answer: string;
    resultSummary: string;
    clientAction?: ClientAction;
    fastRouterUsed: boolean;
    fastRouterConfidence: number | null;
    sources: AiSource[];
    researchUsed: boolean;
    provider: string;
    model: string | null;
    providerLatencyMs: number | null;
    executionLane: string;
    evidenceScore: number;
  };
  memoryPolicy: MemoryPolicy;
  error?: string;
};

type AdvisorBriefPayload = {
  preference?: {
    enabled: boolean;
    emailEnabled: boolean;
    emailAddress: string;
    lastSentAt: string | null;
  };
  schedule?: {
    label: string;
    nextRunAt: string | null;
    emailReady: boolean;
  };
  jobs?: Array<{
    id: string;
    status: string;
    progress: { value: number; message: string | null };
    error: string | null;
  }>;
  delivery?: {
    status: string;
    destination: string | null;
  } | null;
};

type WatchlistsPayload = {
  state?: {
    schedulerEnabled: boolean;
    lastSchedulerTick: string | null;
  };
  metrics?: {
    listCount: number;
    enabledCount: number;
    readyCount: number;
    eventCount: number;
    criticalEventCount: number;
    activeJobCount: number;
  };
};

type EmailPayload = {
  metrics?: {
    draftCount: number;
    generatingCount: number;
    pendingApprovalCount: number;
    scheduledCount: number;
    sendingCount: number;
    failedCount: number;
  };
  jobs?: Array<{
    id: string;
    status: string;
    progress: { value: number; message: string | null };
    error: string | null;
  }>;
};

type AutonomyState = {
  brief: AdvisorBriefPayload | null;
  watchlists: WatchlistsPayload | null;
  email: EmailPayload | null;
  loadedAt: string | null;
  loading: boolean;
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

type SpeechRecognitionLike = {
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

type SpeechRecognitionConstructor = new () => SpeechRecognitionLike;

type SpeechWindow = {
  SpeechRecognition?: SpeechRecognitionConstructor;
  webkitSpeechRecognition?: SpeechRecognitionConstructor;
};

const PREFERENCES_KEY = "slice-ai-studio-cockpit-v11";
const MEMORY_TURNS = 10;

const QUICK_PROMPTS = [
  "Summarize what needs my attention across Slice right now.",
  "Show the most important watchlist, briefing, email, and document automation issues.",
  "Research NVDA with current sources, valuation context, catalysts, and downside risks.",
  "Prepare a client-safe explanation of current market volatility with sources.",
  "Open the Client Email Center and prepare a market update workflow.",
] as const;

const ROUTE_ACTIONS = [
  {
    label: "Clients",
    href: "/workspace/clients",
    helper: "Profiles and assignments",
  },
  {
    label: "Email Center",
    href: "/workspace/client-emails",
    helper: "Draft, approve, deliver",
  },
  {
    label: "Watchlists",
    href: "/workspace/watchlists",
    helper: "Rules and scanning",
  },
  {
    label: "Advisor Brief",
    href: "/workspace/brief",
    helper: "Scheduled intelligence",
  },
  {
    label: "Settings",
    href: "/workspace/settings",
    helper: "Appearance and AI defaults",
  },
] as const;

const REPORT_TEMPLATES = [
  {
    label: "Investment memo",
    helper: "Thesis, valuation, catalysts, risks, sources.",
    prompt:
      "Create a source-backed investment research memo with an executive summary, valuation context, catalysts, downside risks, assumptions, visible sources, and an advisor review checklist.",
  },
  {
    label: "Client review packet",
    helper: "Client-ready context and next actions.",
    prompt:
      "Create a client-ready portfolio review packet with market context, plain-English talking points, risks, follow-ups, assumptions, visible sources, and an advisor review checklist.",
  },
  {
    label: "Volatility brief",
    helper: "Current drivers, behavior, and portfolio questions.",
    prompt:
      "Create a client-ready market volatility briefing with exact dates, verified drivers, behavioral guidance, portfolio review questions, risks, sources, and advisor review notes.",
  },
  {
    label: "Firm operating review",
    helper: "Priorities, automation, approvals, bottlenecks.",
    prompt:
      "Create a visual firm operating review from accessible Slice data with priorities, approvals, automation health, client-service risks, bottlenecks, next actions, and evidence sources.",
  },
] as const;

const TAB_DEFINITIONS: Array<{
  id: StudioTab;
  label: string;
  helper: string;
  icon: typeof BrainCircuit;
}> = [
  {
    id: "brain",
    label: "Brain",
    helper: "Ask and operate",
    icon: BrainCircuit,
  },
  {
    id: "voice",
    label: "Voice",
    helper: "Transcribe to action",
    icon: Mic,
  },
  {
    id: "reports",
    label: "Reports",
    helper: "Client-ready output",
    icon: FileChartColumnIncreasing,
  },
  {
    id: "autonomy",
    label: "Autonomy",
    helper: "Always-on systems",
    icon: Activity,
  },
];

function formatDate(value?: string | null) {
  if (!value) return "Not recorded";
  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? "Not recorded"
    : date.toLocaleString(undefined, {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      });
}

function trimToTurns(messages: BotMessage[], maximumTurns = MEMORY_TURNS) {
  let userTurns = 0;
  let startIndex = 0;

  for (let index = messages.length - 1; index >= 0; index -= 1) {
    if (messages[index]?.role === "user") {
      userTurns += 1;
    }

    if (userTurns > maximumTurns) {
      startIndex = index + 1;
      break;
    }
  }

  return messages.slice(startIndex);
}

function statusTone(value: string | null | undefined) {
  const normalized = String(value ?? "").toLowerCase();

  if (
    normalized.includes("complete") ||
    normalized.includes("ready") ||
    normalized.includes("sent") ||
    normalized.includes("active") ||
    normalized.includes("healthy")
  ) {
    return "emerald" as const;
  }

  if (
    normalized.includes("processing") ||
    normalized.includes("queued") ||
    normalized.includes("running") ||
    normalized.includes("generating")
  ) {
    return "cyan" as const;
  }

  if (
    normalized.includes("failed") ||
    normalized.includes("error") ||
    normalized.includes("blocked") ||
    normalized.includes("review")
  ) {
    return "amber" as const;
  }

  return "slate" as const;
}

function executionStage(input: {
  busy: boolean;
  elapsedMs: number;
  mode: AnswerMode;
  transcribing: boolean;
}) {
  if (input.transcribing) {
    return "Transcribing voice and preserving financial terms";
  }

  if (!input.busy) {
    return "Ready for the next command";
  }

  if (input.elapsedMs < 450) {
    return "Interpreting intent and checking the fast command router";
  }

  if (input.elapsedMs < 1_400) {
    return "Loading only the permission-scoped context this command needs";
  }

  if (input.mode === "deep") {
    return "Researching current sources and building a verified response";
  }

  return "Executing the platform action and verifying the result";
}

function SourceList({ sources }: { sources: AiSource[] }) {
  if (!sources.length) {
    return (
      <p className="text-xs font-semibold leading-5 text-slate-600">
        No public source links were required for the latest platform action.
      </p>
    );
  }

  return (
    <div className="grid gap-2">
      {sources.slice(0, 8).map((source, index) => (
        <a
          key={`${source.url}-${index}`}
          href={source.url}
          target="_blank"
          rel="noopener noreferrer"
          className="group min-w-0 rounded-xl border border-cyan-400/16 bg-cyan-500/[0.045] p-3 transition hover:border-cyan-300/35 hover:bg-cyan-500/[0.08]"
        >
          <p className="line-clamp-2 text-xs font-black text-white">
            {source.title || `Source ${index + 1}`}
          </p>
          <p className="mt-1 truncate text-[10px] font-semibold text-cyan-300/70">
            {source.url}
          </p>
        </a>
      ))}
    </div>
  );
}

function RichMessage({ value }: { value: string }) {
  const blocks = value
    .split(/\n{2,}/)
    .map((block) => block.trim())
    .filter(Boolean);

  return (
    <div className="space-y-3 text-sm font-semibold leading-6 text-slate-200">
      {blocks.map((block, index) => {
        const lines = block.split("\n").map((line) => line.trim());
        const bullets = lines.filter((line) => /^[-*•]\s+/.test(line));

        if (bullets.length === lines.length && bullets.length) {
          return (
            <ul key={`${block.slice(0, 24)}-${index}`} className="space-y-1.5 pl-5">
              {bullets.map((line) => (
                <li key={line} className="list-disc">
                  {line.replace(/^[-*•]\s+/, "")}
                </li>
              ))}
            </ul>
          );
        }

        return (
          <p key={`${block.slice(0, 24)}-${index}`} className="whitespace-pre-wrap">
            {block}
          </p>
        );
      })}
    </div>
  );
}

function MiniMetric({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string | number;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.028] p-3.5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-[8px] font-black uppercase tracking-[0.15em] text-slate-600">
            {label}
          </p>
          <p className="mt-1 truncate text-xl font-black text-white">{value}</p>
          <p className="mt-1 truncate text-[10px] font-semibold text-slate-600">
            {helper}
          </p>
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-[var(--slice-accent)]">
          {icon}
        </div>
      </div>
    </div>
  );
}

function CognitiveMap({
  lane,
  researchUsed,
  busy,
}: {
  lane: string;
  researchUsed: boolean;
  busy: boolean;
}) {
  const nodes = [
    {
      label: "Interpret",
      active: true,
      icon: <BrainCircuit className="h-3.5 w-3.5" />,
    },
    {
      label: "Route",
      active: Boolean(lane),
      icon: <Zap className="h-3.5 w-3.5" />,
    },
    {
      label: researchUsed ? "Research" : "Context",
      active: researchUsed || !busy,
      icon: researchUsed ? <Search className="h-3.5 w-3.5" /> : <Database className="h-3.5 w-3.5" />,
    },
    {
      label: "Verify",
      active: !busy,
      icon: <ShieldCheck className="h-3.5 w-3.5" />,
    },
    {
      label: "Act",
      active: !busy,
      icon: <ArrowUpRight className="h-3.5 w-3.5" />,
    },
  ];

  return (
    <WorkspaceSurface className="relative overflow-hidden p-4">
      <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_-20%,var(--slice-accent-soft),transparent_56%),linear-gradient(rgba(52,211,153,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,.025)_1px,transparent_1px)] bg-[size:auto,20px_20px,20px_20px]" />
      <div className="relative">
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--slice-accent)]">
              Cognitive fabric
            </p>
            <p className="mt-1 text-sm font-black text-white">{lane}</p>
          </div>
          <span className={cx(
            "relative grid h-9 w-9 place-items-center rounded-full border border-[var(--slice-accent-border)] bg-black/45 text-[var(--slice-accent)]",
            busy && "animate-pulse",
          )}>
            <span className="absolute inset-1 rounded-full border border-[var(--slice-accent-border)]" />
            <BrainCircuit className="relative h-4 w-4" />
          </span>
        </div>

        <div className="relative mt-4 grid grid-cols-5 gap-1">
          <div className="pointer-events-none absolute left-[9%] right-[9%] top-4 h-px bg-gradient-to-r from-transparent via-emerald-400/40 to-transparent" />
          {nodes.map((node, index) => (
            <div key={node.label} className="relative z-10 text-center">
              <div
                className={cx(
                  "mx-auto grid h-8 w-8 place-items-center rounded-xl border transition",
                  node.active
                    ? "border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-[var(--slice-accent)] shadow-[0_0_24px_var(--slice-accent-glow)]"
                    : "border-white/8 bg-black/40 text-slate-700",
                  busy && index <= 2 && "animate-pulse",
                )}
              >
                {node.icon}
              </div>
              <p className="mt-1.5 truncate text-[7px] font-black uppercase tracking-[0.08em] text-slate-600">
                {node.label}
              </p>
            </div>
          ))}
        </div>
      </div>
    </WorkspaceSurface>
  );
}

function EmptyPanel({
  icon,
  title,
  description,
}: {
  icon: ReactNode;
  title: string;
  description: string;
}) {
  return (
    <div className="grid min-h-56 place-items-center rounded-2xl border border-dashed border-white/10 bg-white/[0.02] p-7 text-center">
      <div className="max-w-md">
        <div className="mx-auto grid h-12 w-12 place-items-center rounded-2xl border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-[var(--slice-accent)]">
          {icon}
        </div>
        <h3 className="mt-4 text-lg font-black text-white">{title}</h3>
        <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
          {description}
        </p>
      </div>
    </div>
  );
}

export default function PersonalBotPage() {
  const [activeTab, setActiveTab] = useState<StudioTab>("brain");
  const [data, setData] = useState<StudioBootstrap | null>(null);
  const [messages, setMessages] = useState<BotMessage[]>([]);
  const [prompt, setPrompt] = useState("");
  const [answerMode, setAnswerMode] = useState<AnswerMode>("balanced");
  const [notice, setNotice] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [transcribing, setTranscribing] = useState(false);
  const [listening, setListening] = useState(false);
  const [recording, setRecording] = useState(false);
  const [browserVoiceAvailable, setBrowserVoiceAvailable] = useState(false);
  const [recordingAvailable, setRecordingAvailable] = useState(false);
  const [autoExecuteVoice, setAutoExecuteVoice] = useState(true);
  const [autoOpenActions, setAutoOpenActions] = useState(true);
  const [voiceTranscript, setVoiceTranscript] = useState("");
  const [reportPrompt, setReportPrompt] = useState<string>(REPORT_TEMPLATES[0].prompt);
  const [selectedReportId, setSelectedReportId] = useState("");
  const [lastLatencyMs, setLastLatencyMs] = useState<number | null>(null);
  const [lastExecutionLane, setLastExecutionLane] = useState("Adaptive Analysis");
  const [lastEvidenceScore, setLastEvidenceScore] = useState(0);
  const [requestElapsedMs, setRequestElapsedMs] = useState(0);
  const [autonomy, setAutonomy] = useState<AutonomyState>({
    brief: null,
    watchlists: null,
    email: null,
    loadedAt: null,
    loading: false,
  });

  const promptRef = useRef<HTMLTextAreaElement | null>(null);
  const conversationRef = useRef<HTMLDivElement | null>(null);
  const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const requestControllerRef = useRef<AbortController | null>(null);
  const requestStartedAtRef = useRef<number | null>(null);

  const loadStudio = useCallback(async (silent = false) => {
    if (!silent) setLoading(true);

    try {
      const response = await fetch("/api/personal-bot/instant", {
        cache: "no-store",
      });
      const payload = (await response.json()) as StudioBootstrap;

      if (!response.ok) {
        throw new Error(payload.error || "AI Studio could not load.");
      }

      setData(payload);
      const nextMessages = trimToTurns(payload.messages ?? []);
      setMessages(nextMessages);
      const latestLoadedAssistant = [...nextMessages]
        .reverse()
        .find((message) => message.role === "assistant");
      setLastExecutionLane(
        typeof latestLoadedAssistant?.metadata?.executionLane === "string"
          ? latestLoadedAssistant.metadata.executionLane
          : latestLoadedAssistant?.metadata?.researchUsed
            ? "Research"
            : "Adaptive Analysis",
      );
      setLastEvidenceScore(
        typeof latestLoadedAssistant?.metadata?.evidenceScore === "number"
          ? latestLoadedAssistant.metadata.evidenceScore
          : 0,
      );
      setSelectedReportId(
        (current) => current || payload.pdfReports?.[0]?.id || "",
      );
    } catch (error) {
      if (!silent) {
        setNotice(error instanceof Error ? error.message : "AI Studio could not load.");
      }
    } finally {
      if (!silent) setLoading(false);
    }
  }, []);

  const loadAutonomy = useCallback(async () => {
    setAutonomy((current) => ({ ...current, loading: true }));

    const [brief, watchlists, email] = await Promise.allSettled([
      fetch("/api/advisor-brief", { cache: "no-store" }).then((response) =>
        response.ok ? (response.json() as Promise<AdvisorBriefPayload>) : null,
      ),
      fetch("/api/workspace/watchlists", { cache: "no-store" }).then(
        (response) =>
          response.ok ? (response.json() as Promise<WatchlistsPayload>) : null,
      ),
      fetch("/api/client-emails", { cache: "no-store" }).then((response) =>
        response.ok ? (response.json() as Promise<EmailPayload>) : null,
      ),
    ]);

    setAutonomy({
      brief: brief.status === "fulfilled" ? brief.value : null,
      watchlists: watchlists.status === "fulfilled" ? watchlists.value : null,
      email: email.status === "fulfilled" ? email.value : null,
      loadedAt: new Date().toISOString(),
      loading: false,
    });
  }, []);

  useEffect(() => {
    void loadStudio();

    const browser = window as unknown as SpeechWindow;
    setBrowserVoiceAvailable(
      Boolean(browser.SpeechRecognition || browser.webkitSpeechRecognition),
    );
    setRecordingAvailable(
      typeof MediaRecorder !== "undefined" &&
        typeof navigator.mediaDevices?.getUserMedia === "function",
    );

    try {
      const stored = JSON.parse(
        window.localStorage.getItem(PREFERENCES_KEY) || "{}",
      ) as Partial<{
        answerMode: AnswerMode;
        autoExecuteVoice: boolean;
        autoOpenActions: boolean;
      }>;

      if (
        stored.answerMode === "quick" ||
        stored.answerMode === "balanced" ||
        stored.answerMode === "deep"
      ) {
        setAnswerMode(stored.answerMode);
      }

      if (typeof stored.autoExecuteVoice === "boolean") {
        setAutoExecuteVoice(stored.autoExecuteVoice);
      }

      if (typeof stored.autoOpenActions === "boolean") {
        setAutoOpenActions(stored.autoOpenActions);
      }
    } catch {
      // Local Studio preferences are optional.
    }
  }, [loadStudio]);

  useEffect(() => {
    window.localStorage.setItem(
      PREFERENCES_KEY,
      JSON.stringify({
        answerMode,
        autoExecuteVoice,
        autoOpenActions,
      }),
    );
  }, [answerMode, autoExecuteVoice, autoOpenActions]);

  useEffect(() => {
    if (activeTab !== "autonomy") return;

    void loadAutonomy();
    const interval = window.setInterval(() => void loadAutonomy(), 20_000);
    return () => window.clearInterval(interval);
  }, [activeTab, loadAutonomy]);

  useEffect(() => {
    if (!busy || !requestStartedAtRef.current) {
      setRequestElapsedMs(0);
      return;
    }

    const interval = window.setInterval(() => {
      setRequestElapsedMs(Date.now() - (requestStartedAtRef.current ?? Date.now()));
    }, 200);

    return () => window.clearInterval(interval);
  }, [busy]);

  useEffect(() => {
    conversationRef.current?.scrollTo({
      top: conversationRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, busy]);

  useEffect(() => {
    function shortcut(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      const editing =
        target?.tagName === "INPUT" ||
        target?.tagName === "TEXTAREA" ||
        target?.getAttribute("contenteditable") === "true";

      if (event.key === "/" && !editing) {
        event.preventDefault();
        promptRef.current?.focus();
      }

      if (event.key === "Escape" && requestControllerRef.current) {
        event.preventDefault();
        requestControllerRef.current.abort();
      }
    }

    document.addEventListener("keydown", shortcut);
    return () => document.removeEventListener("keydown", shortcut);
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.abort?.();
      requestControllerRef.current?.abort();

      if (recorderRef.current?.state !== "inactive") {
        recorderRef.current?.stop();
      }

      streamRef.current?.getTracks().forEach((track) => track.stop());
    };
  }, []);

  const reports = data?.pdfReports ?? [];
  const selectedReport =
    reports.find((report) => report.id === selectedReportId) ?? reports[0] ?? null;
  const latestAssistant = useMemo(
    () => [...messages].reverse().find((message) => message.role === "assistant"),
    [messages],
  );
  const latestSources = latestAssistant?.metadata?.sources ?? [];
  const latestAction = latestAssistant?.metadata?.clientAction;
  const pendingApprovals = [
    ...(data?.approvals ?? []),
    ...(data?.backendApprovals ?? []),
  ].filter((approval) => approval.status === "Pending").length;
  const memoryPolicy = data?.memoryPolicy ?? {
    maximumSearches: MEMORY_TURNS,
    storedSearches: Math.min(MEMORY_TURNS, messages.filter((message) => message.role === "user").length),
  };
  const aiReady = Boolean(data?.aiEngine?.configured);
  const stage = executionStage({
    busy,
    elapsedMs: requestElapsedMs,
    mode: answerMode,
    transcribing,
  });

  function maybeOpenAction(action?: ClientAction) {
    if (!autoOpenActions || !action?.href || action.autoRun !== true) return;

    if (/^https?:\/\//i.test(action.href)) {
      window.open(action.href, "_blank", "noopener,noreferrer");
    } else {
      window.location.assign(action.href);
    }
  }

  function mergeCompletedResponse(
    optimisticId: string | null,
    payload: InstantResponse,
  ) {
    setMessages((current) => {
      const withoutOptimistic = optimisticId
        ? current.filter((message) => message.id !== optimisticId)
        : current;

      return trimToTurns([
        ...withoutOptimistic,
        payload.userMessage,
        payload.assistantMessage,
      ]);
    });

    setData((current) =>
      current
        ? {
            ...current,
            memoryPolicy: payload.memoryPolicy,
            lastExecution: {
              status: payload.result.status,
              resultSummary: payload.result.resultSummary,
              clientAction: payload.result.clientAction,
              sources: payload.result.sources,
              researchUsed: payload.result.researchUsed,
            },
          }
        : current,
    );
    setLastLatencyMs(payload.latencyMs);
    setLastExecutionLane(payload.result.executionLane || "Adaptive Analysis");
    setLastEvidenceScore(payload.result.evidenceScore || 0);
    maybeOpenAction(payload.result.clientAction);
  }

  async function runCommand(
    command = prompt,
    mode: AnswerMode = answerMode,
    transcript?: string,
  ): Promise<InstantResponse | null> {
    const clean = command.trim();
    if (!clean || busy || transcribing) return null;

    const controller = new AbortController();
    requestControllerRef.current?.abort();
    requestControllerRef.current = controller;
    requestStartedAtRef.current = Date.now();

    const optimisticId = `optimistic-${Date.now()}`;
    const optimistic: BotMessage = {
      id: optimisticId,
      role: "user",
      content: clean,
      intent: transcript ? "Voice Command" : "Command",
      createdAt: new Date().toISOString(),
    };

    setMessages((current) => trimToTurns([...current, optimistic]));
    setPrompt("");
    setBusy(true);
    setNotice("");
    setLastLatencyMs(null);

    try {
      const response = await fetch("/api/personal-bot/instant", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        signal: controller.signal,
        body: JSON.stringify({
          prompt: clean,
          voiceTranscript: transcript,
          answerMode: mode,
          currentPath: "/workspace/personal-bot",
          pageTitle: "Slice AI Studio",
          advancedSettings: {
            autoOpenActions,
            adaptiveRouting: true,
            operatingMode: mode === "quick" ? "Platform Ops" : "Research",
            sourcePolicy:
              mode === "quick"
                ? "Fast"
                : mode === "deep"
                  ? "Primary First"
                  : "Balanced",
          },
        }),
      });
      const payload = (await response.json()) as InstantResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Slice AI could not complete the request.");
      }

      mergeCompletedResponse(optimisticId, payload);

      if (
        payload.result.clientAction?.type === "report" ||
        payload.result.clientAction?.pdfHref
      ) {
        window.setTimeout(() => void loadStudio(true), 500);
      }

      return payload;
    } catch (error) {
      setMessages((current) => current.filter((message) => message.id !== optimisticId));

      if (error instanceof Error && error.name === "AbortError") {
        setNotice("The current AI request was stopped.");
      } else {
        setNotice(
          error instanceof Error
            ? error.message
            : "Slice AI could not complete the request.",
        );
      }

      return null;
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
      requestStartedAtRef.current = null;
      setBusy(false);
    }
  }

  async function runRecordedAudio(blob: Blob) {
    if (busy || transcribing) return;

    const controller = new AbortController();
    requestControllerRef.current?.abort();
    requestControllerRef.current = controller;
    requestStartedAtRef.current = Date.now();
    setTranscribing(true);
    setBusy(true);
    setNotice("");

    try {
      const form = new FormData();
      form.set(
        "audio",
        new File([blob], "slice-command.webm", {
          type: blob.type || "audio/webm",
        }),
      );
      form.set("language", "en-US");
      form.set("answerMode", "quick");
      form.set("currentPath", "/workspace/personal-bot");
      form.set("pageTitle", "Slice AI Studio Voice");
      form.set(
        "advancedSettings",
        JSON.stringify({
          autoOpenActions,
          adaptiveRouting: true,
          operatingMode: "Platform Ops",
          sourcePolicy: "Fast",
        }),
      );

      const response = await fetch("/api/personal-bot/instant", {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      const payload = (await response.json()) as InstantResponse;

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Voice command could not be completed.");
      }

      setVoiceTranscript(payload.transcript ?? "");
      mergeCompletedResponse(null, payload);
      setActiveTab("brain");
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        setNotice("The voice request was stopped.");
      } else {
        setNotice(
          error instanceof Error
            ? error.message
            : "Voice command could not be completed.",
        );
      }
    } finally {
      if (requestControllerRef.current === controller) {
        requestControllerRef.current = null;
      }
      requestStartedAtRef.current = null;
      setTranscribing(false);
      setBusy(false);
    }
  }

  function stopRequest() {
    requestControllerRef.current?.abort();
  }

  function startBrowserVoice() {
    const browser = window as unknown as SpeechWindow;
    const Recognition =
      browser.SpeechRecognition ?? browser.webkitSpeechRecognition;

    if (!Recognition) {
      setNotice(
        "Instant browser transcription is unavailable here. Use high-accuracy recording instead.",
      );
      return;
    }

    recognitionRef.current?.abort?.();
    const recognition = new Recognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = "en-US";
    let finalText = "";

    recognition.onstart = () => {
      setListening(true);
      setActiveTab("voice");
      setNotice("");
    };

    recognition.onresult = (event) => {
      let interim = "";

      for (
        let index = event.resultIndex ?? 0;
        index < event.results.length;
        index += 1
      ) {
        const result = event.results[index];
        const text = result?.[0]?.transcript ?? "";

        if (result?.isFinal) finalText += text;
        else interim += text;
      }

      const current = (finalText || interim).trim();
      setVoiceTranscript(current);
      setPrompt(current);
    };

    recognition.onend = () => {
      setListening(false);
      const clean = finalText.trim();

      if (clean && autoExecuteVoice) {
        void runCommand(clean, "quick", clean).then(() => setActiveTab("brain"));
      }
    };

    recognition.onerror = () => {
      setListening(false);
      setNotice(
        "Browser voice recognition stopped. High-accuracy recording remains available.",
      );
    };

    recognitionRef.current = recognition;

    try {
      recognition.start();
    } catch (error) {
      setListening(false);
      setNotice(
        error instanceof Error
          ? error.message
          : "Browser voice recognition could not start.",
      );
    }
  }

  async function startRecording() {
    if (!recordingAvailable || busy || transcribing) {
      setNotice("High-accuracy recording is not available in this browser.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      streamRef.current = stream;
      chunksRef.current = [];

      const recorder = new MediaRecorder(stream, {
        audioBitsPerSecond: 64_000,
      });
      recorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data);
      };

      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });

        streamRef.current?.getTracks().forEach((track) => track.stop());
        streamRef.current = null;
        setRecording(false);
        void runRecordedAudio(blob);
      };

      recorder.start(200);
      setRecording(true);
      setActiveTab("voice");
      setNotice("");
    } catch (error) {
      setNotice(
        error instanceof Error ? error.message : "Microphone access failed.",
      );
    }
  }

  function stopRecording() {
    if (recorderRef.current?.state !== "inactive") {
      recorderRef.current?.stop();
    }
  }

  async function clearWorkingMemory() {
    if (!window.confirm("Clear the rolling AI working memory? Reports and audit records will remain.")) {
      return;
    }

    try {
      const response = await fetch("/api/personal-bot/instant", {
        method: "DELETE",
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        memoryPolicy?: MemoryPolicy;
      };

      if (!response.ok || !payload.ok) {
        throw new Error(payload.error || "Working memory could not be cleared.");
      }

      setMessages([]);
      setData((current) =>
        current
          ? {
              ...current,
              messages: [],
              memoryPolicy: {
                maximumSearches: MEMORY_TURNS,
                storedSearches: 0,
                reportsPreserved: true,
                auditHistoryPreserved: true,
              },
            }
          : current,
      );
      setNotice("AI working memory cleared. Reports and audit history were preserved.");
    } catch (error) {
      setNotice(
        error instanceof Error
          ? error.message
          : "Working memory could not be cleared.",
      );
    }
  }

  async function generateReport() {
    const request = reportPrompt.trim();
    if (!request) return;

    setActiveTab("brain");
    const result = await runCommand(
      `${request}\n\nRequirements:\n- Build a premium client-ready visual report.\n- Separate verified facts, assumptions, scenarios, risks, and advisor next actions.\n- Include exact dates for time-sensitive claims.\n- Include visible source links and data limitations.\n- Do not include private client identifiers in public research queries.\n- Require advisor review before external use.`,
      "deep",
    );

    if (result) {
      window.setTimeout(() => {
        void loadStudio(true).then(() => setActiveTab("reports"));
      }, 500);
    }
  }

  function handlePromptKeyDown(event: ReactKeyboardEvent<HTMLTextAreaElement>) {
    if ((event.metaKey || event.ctrlKey) && event.key === "Enter") {
      event.preventDefault();
      void runCommand();
    }
  }

  const activeBriefJobs = (autonomy.brief?.jobs ?? []).filter((job) =>
    ["Queued", "Retrying", "Processing"].includes(job.status),
  ).length;
  const activeEmailJobs = (autonomy.email?.jobs ?? []).filter((job) =>
    ["Queued", "Retrying", "Processing"].includes(job.status),
  ).length;
  const activeAutomationJobs =
    activeBriefJobs +
    activeEmailJobs +
    (autonomy.watchlists?.metrics?.activeJobCount ?? 0);

  return (
    <SliceBackground>
      <div className="mx-auto flex min-h-[calc(100dvh-4rem)] max-w-[1920px] flex-col gap-2 p-2.5 sm:p-3 lg:h-[calc(100dvh-4rem)] lg:min-h-0 lg:overflow-hidden">
        <header className="flex shrink-0 items-center justify-between gap-3 rounded-[1.35rem] border border-white/[0.09] bg-[#050807]/92 px-3 py-2.5 shadow-[0_18px_60px_rgba(0,0,0,.42)] backdrop-blur-xl">
          <div className="flex min-w-0 items-center gap-3">
            <BrandMark
              label={data?.profile.botName || "Slice AI Studio"}
              subtitle="Platform Brain · Advisor Intelligence"
            />
            <div className="hidden h-8 w-px bg-white/10 xl:block" />
            <div className="hidden min-w-0 xl:block">
              <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--slice-accent)]">
                Command intelligence cockpit
              </p>
              <p className="mt-1 truncate text-[10px] font-semibold text-slate-600">
                Research, act, speak, report, and monitor autonomous work from one screen.
              </p>
            </div>
          </div>

          <div className="hidden min-w-0 items-center gap-2 md:flex">
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2">
              <span className={cx("h-2 w-2 rounded-full", aiReady ? "bg-emerald-300 shadow-[0_0_16px_rgba(110,231,183,.8)]" : "bg-amber-300")} />
              <span className="text-[10px] font-black text-white">{aiReady ? "Brain online" : "Review setup"}</span>
            </span>
            <span className="inline-flex items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[10px] font-black text-slate-300">
              <Database className="h-3.5 w-3.5 text-cyan-300" />
              {memoryPolicy.storedSearches}/{memoryPolicy.maximumSearches}
            </span>
            <span className="hidden items-center gap-2 rounded-xl border border-white/8 bg-white/[0.03] px-3 py-2 text-[10px] font-black text-slate-300 2xl:inline-flex">
              <Zap className="h-3.5 w-3.5 text-[var(--slice-accent)]" />
              {data?.aiEngine?.fastModel || data?.aiEngine?.model || "Model pending"}
            </span>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <WorkspaceButton
              variant="quiet"
              size="sm"
              icon={<RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} />}
              onClick={() => void loadStudio()}
              disabled={loading || busy}
            >
              <span className="hidden sm:inline">Refresh</span>
            </WorkspaceButton>
            <WorkspaceButton
              href="/workspace/settings"
              variant="quiet"
              size="sm"
              icon={<Settings2 className="h-4 w-4" />}
            >
              <span className="hidden sm:inline">Settings</span>
            </WorkspaceButton>
          </div>
        </header>

        <Card className="z-30 shrink-0 !overflow-visible !rounded-[1.55rem] !border-[var(--slice-accent-border)] !bg-[#020806]/96 p-2.5 shadow-[0_20px_70px_rgba(0,0,0,.58)] backdrop-blur-2xl sm:p-3">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_0%,var(--slice-accent-soft),transparent_34%),radial-gradient(circle_at_92%_20%,rgba(6,182,212,.10),transparent_28%),linear-gradient(rgba(52,211,153,.025)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,.025)_1px,transparent_1px)] bg-[size:auto,auto,28px_28px,28px_28px]" />
          <div className="relative">
          <div className="grid gap-2 xl:grid-cols-[minmax(0,1fr)_auto] xl:items-end">
            <div className="min-w-0">
              <div className="mb-1.5 flex items-center justify-between gap-2">
                <div className="flex flex-wrap items-center gap-2">
                  <WorkspacePill tone="emerald">
                    <Zap className="h-3 w-3" aria-hidden="true" />
                    Command cockpit
                  </WorkspacePill>
                  <span className="hidden text-[9px] font-semibold text-slate-600 lg:inline">
                    Press <strong className="text-slate-300">/</strong> to focus · Ctrl/⌘ + Enter to run
                  </span>
                </div>
                <span className="text-[9px] font-semibold text-slate-600">{stage}</span>
              </div>

              <WorkspaceTextarea
                ref={promptRef}
                value={prompt}
                onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setPrompt(event.target.value)}
                onKeyDown={handlePromptKeyDown}
                rows={1}
                className="min-h-[58px] max-h-28 resize-none border-white/12 bg-black/42 text-[14px] font-semibold leading-5 shadow-inner shadow-black/30 placeholder:text-slate-700"
                placeholder="Ask a question, research a security, open a workflow, create a report, or tell Slice exactly what to do…"
                aria-label="Slice AI command prompt"
              />
            </div>

            <div className="grid grid-cols-[auto_auto_auto] gap-1.5">
              <div className="grid grid-cols-3 rounded-xl border border-white/10 bg-black/35 p-1">
                {(["quick", "balanced", "deep"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setAnswerMode(mode)}
                    className={cx(
                      "rounded-lg px-2.5 py-1.5 text-[8px] font-black uppercase tracking-[0.11em] transition",
                      answerMode === mode
                        ? "bg-[var(--slice-accent-strong)] text-white shadow-lg shadow-black/30"
                        : "text-slate-500 hover:bg-white/[0.05] hover:text-white",
                    )}
                    aria-pressed={answerMode === mode}
                  >
                    {mode === "quick" ? "Instant" : mode === "balanced" ? "Adaptive" : "Deep"}
                  </button>
                ))}
              </div>

              <WorkspaceButton
                variant={listening ? "danger" : "secondary"}
                icon={listening ? <CircleStop className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                onClick={
                  listening
                    ? () => recognitionRef.current?.stop()
                    : startBrowserVoice
                }
                disabled={!browserVoiceAvailable || busy || transcribing}
              >
                {listening ? "Finish voice" : "Voice"}
              </WorkspaceButton>

              <WorkspaceButton
                variant="primary"
                icon={
                  busy || transcribing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Send className="h-4 w-4" />
                  )
                }
                onClick={() => void runCommand()}
                disabled={!prompt.trim() || busy || transcribing || loading}
              >
                {busy || transcribing ? "Working" : "Run"}
              </WorkspaceButton>
            </div>
          </div>

          <div className="mt-1.5 flex items-center gap-1.5 overflow-x-auto pb-0.5">
            {QUICK_PROMPTS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => {
                  setPrompt(item);
                  promptRef.current?.focus();
                }}
                className="shrink-0 rounded-full border border-white/8 bg-white/[0.03] px-2.5 py-1 text-[9px] font-bold text-slate-600 transition hover:border-[var(--slice-accent-border)] hover:bg-[var(--slice-accent-soft)] hover:text-white"
              >
                {item.length > 48 ? `${item.slice(0, 48)}…` : item}
              </button>
            ))}
          </div>

          <div className="mt-1.5 hidden grid-cols-5 gap-1.5 lg:grid" aria-label="AI cognitive routing status">
            {[
              {
                label: "Cognitive lane",
                value: lastExecutionLane,
                helper: busy ? "Routing current request" : "Adaptive task classification",
                icon: <Zap className="h-3.5 w-3.5" />,
              },
              {
                label: "Research policy",
                value:
                  answerMode === "quick"
                    ? "Only when required"
                    : answerMode === "deep"
                      ? "Primary-source depth"
                      : "Adaptive verification",
                helper: "Web tools activate selectively",
                icon: <Search className="h-3.5 w-3.5" />,
              },
              {
                label: "Evidence quality",
                value: latestSources.length ? `${lastEvidenceScore}/100` : "Standby",
                helper: `${latestSources.length} visible source${latestSources.length === 1 ? "" : "s"}`,
                icon: <ShieldCheck className="h-3.5 w-3.5" />,
              },
              {
                label: "Working context",
                value: `${memoryPolicy.storedSearches}/${memoryPolicy.maximumSearches} turns`,
                helper: "Permission-scoped rolling memory",
                icon: <Database className="h-3.5 w-3.5" />,
              },
              {
                label: "Model path",
                value:
                  answerMode === "deep"
                    ? data?.aiEngine?.qualityModel || data?.aiEngine?.model || "Quality"
                    : data?.aiEngine?.fastModel || data?.aiEngine?.model || "Fast",
                helper: lastLatencyMs ? `${lastLatencyMs} ms last response` : "Ready",
                icon: <BrainCircuit className="h-3.5 w-3.5" />,
              },
            ].map((item) => (
              <div
                key={item.label}
                className="rounded-lg border border-white/[0.065] bg-black/28 px-2.5 py-1.5"
              >
                <div className="flex items-center gap-1.5 text-[8px] font-black uppercase tracking-[0.13em] text-slate-600">
                  <span className="text-[var(--slice-accent)]">{item.icon}</span>
                  {item.label}
                </div>
                <p className="mt-1 truncate text-[10px] font-black text-white">{item.value}</p>
                <p className="mt-0.5 truncate text-[8px] font-semibold text-slate-700">{item.helper}</p>
              </div>
            ))}
          </div>

          {(busy || transcribing) && (
            <div className="mt-1.5 flex items-center gap-3 rounded-lg border border-cyan-400/15 bg-cyan-500/[0.045] px-3 py-1.5" role="status">
              <Loader2 className="h-4 w-4 shrink-0 animate-spin text-cyan-300" />
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-3">
                  <p className="truncate text-[10px] font-black text-cyan-100">{stage}</p>
                  <span className="shrink-0 text-[9px] font-bold text-cyan-300/70">
                    {(requestElapsedMs / 1000).toFixed(1)}s
                  </span>
                </div>
                <div className="mt-1.5 h-1 overflow-hidden rounded-full bg-black/35">
                  <div className="h-full w-1/3 animate-[pulse_1.1s_ease-in-out_infinite] rounded-full bg-gradient-to-r from-cyan-400 via-[var(--slice-accent)] to-emerald-300" />
                </div>
              </div>
              <button
                type="button"
                onClick={stopRequest}
                className="rounded-lg border border-white/10 px-2.5 py-1 text-[9px] font-black text-slate-300 hover:bg-white/[0.06] hover:text-white"
              >
                Stop
              </button>
            </div>
          )}
          </div>
        </Card>

        {notice ? (
          <WorkspaceAlert
            tone="info"
            className="fixed bottom-4 right-4 z-[100] max-w-[min(92vw,480px)] py-2.5 shadow-2xl"
            action={
              <button
                type="button"
                onClick={() => setNotice("")}
                className="text-[10px] font-black text-cyan-100"
              >
                Dismiss
              </button>
            }
          >
            {notice}
          </WorkspaceAlert>
        ) : null}

        <nav className="grid shrink-0 grid-cols-4 gap-1 rounded-xl border border-white/8 bg-black/30 p-1" aria-label="AI Studio sections">
          {TAB_DEFINITIONS.map((tab) => {
            const Icon = tab.icon;
            const active = activeTab === tab.id;

            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cx(
                  "flex min-w-0 items-center justify-center gap-2 rounded-lg px-2 py-1.5 text-left transition sm:px-3",
                  active
                    ? "border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-white shadow-lg shadow-black/20"
                    : "border border-transparent text-slate-600 hover:bg-white/[0.04] hover:text-white",
                )}
                aria-current={active ? "page" : undefined}
              >
                <Icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                <span className="min-w-0">
                  <span className="block truncate text-[10px] font-black uppercase tracking-[0.12em] sm:text-xs sm:normal-case sm:tracking-normal">
                    {tab.label}
                  </span>
                  <span className="hidden truncate text-[8px] font-semibold text-slate-600 xl:block">
                    {tab.helper}
                  </span>
                </span>
              </button>
            );
          })}
        </nav>

        <div className="min-h-0 flex-1 lg:overflow-hidden">
          {activeTab === "brain" ? (
            <section className="grid h-full min-h-0 gap-2 lg:grid-cols-[205px_minmax(0,1fr)_300px]">
              <WorkspaceSurface as="aside" className="hidden min-h-0 overflow-y-auto p-4 lg:block">
                <div className="flex items-center gap-2">
                  <Search className="h-4 w-4 text-[var(--slice-accent)]" />
                  <h2 className="text-xs font-black uppercase tracking-[0.14em] text-white">
                    Operate Slice
                  </h2>
                </div>

                <div className="mt-3 grid gap-2">
                  {ROUTE_ACTIONS.map((action) => (
                    <Link
                      key={action.href}
                      href={action.href}
                      prefetch={false}
                      className="group rounded-xl border border-white/8 bg-white/[0.025] p-3 transition hover:border-[var(--slice-accent-border)] hover:bg-[var(--slice-accent-soft)]"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <p className="text-xs font-black text-white">{action.label}</p>
                        <ArrowUpRight className="h-3.5 w-3.5 text-[var(--slice-accent)]" />
                      </div>
                      <p className="mt-1 text-[10px] font-semibold text-slate-600">
                        {action.helper}
                      </p>
                    </Link>
                  ))}
                </div>

                <div className="mt-5 border-t border-white/8 pt-4">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
                      Rolling memory
                    </p>
                    <WorkspacePill tone="cyan">
                      {memoryPolicy.storedSearches}/{memoryPolicy.maximumSearches}
                    </WorkspacePill>
                  </div>
                  <p className="mt-2 text-[10px] font-semibold leading-5 text-slate-600">
                    Only the latest ten searches remain in working memory. Reports and audit history remain separate.
                  </p>
                  <WorkspaceButton
                    className="mt-3 w-full"
                    variant="quiet"
                    size="sm"
                    icon={<Trash2 className="h-4 w-4" />}
                    onClick={() => void clearWorkingMemory()}
                    disabled={busy || !messages.length}
                  >
                    Clear working memory
                  </WorkspaceButton>
                </div>
              </WorkspaceSurface>

              <WorkspaceSurface className="flex min-h-0 flex-col overflow-hidden">
                <div className="flex shrink-0 items-center justify-between gap-3 border-b border-white/8 px-4 py-3">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--slice-accent)]">
                      Live workspace
                    </p>
                    <h2 className="mt-0.5 text-sm font-black text-white">
                      Conversation and verified actions
                    </h2>
                  </div>
                  <div className="flex items-center gap-2">
                    {lastLatencyMs ? (
                      <WorkspacePill tone={lastLatencyMs < 1_500 ? "emerald" : "cyan"}>
                        {lastLatencyMs} ms
                      </WorkspacePill>
                    ) : null}
                    <WorkspacePill tone={answerMode === "deep" ? "violet" : "slate"}>
                      {answerMode === "balanced" ? "adaptive" : answerMode}
                    </WorkspacePill>
                  </div>
                </div>

                <div ref={conversationRef} className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
                  {loading ? (
                    <div className="space-y-3">
                      {[0, 1, 2].map((item) => (
                        <div key={item} className="h-24 animate-pulse rounded-2xl border border-white/6 bg-white/[0.025]" />
                      ))}
                    </div>
                  ) : !messages.length ? (
                    <EmptyPanel
                      icon={<BrainCircuit className="h-5 w-5" />}
                      title="The command cockpit is ready."
                      description="Ask a question, open a workflow, create a source-backed report, or use voice. Your prompt stays permanently visible above."
                    />
                  ) : (
                    messages.map((message) => {
                      const assistant = message.role === "assistant";
                      const action = message.metadata?.clientAction;
                      const sources = message.metadata?.sources ?? [];

                      return (
                        <article
                          key={message.id}
                          className={cx(
                            "rounded-2xl border p-4",
                            assistant
                              ? "border-[var(--slice-accent-border)] bg-[linear-gradient(145deg,var(--slice-accent-soft),rgba(255,255,255,.018))]"
                              : "ml-auto max-w-[88%] border-white/10 bg-white/[0.05]",
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <div className="flex items-center gap-2">
                              <div
                                className={cx(
                                  "grid h-8 w-8 place-items-center rounded-xl border",
                                  assistant
                                    ? "border-[var(--slice-accent-border)] bg-black/30 text-[var(--slice-accent)]"
                                    : "border-white/10 bg-black/25 text-slate-300",
                                )}
                              >
                                {assistant ? (
                                  <Bot className="h-4 w-4" />
                                ) : (
                                  <Zap className="h-4 w-4" />
                                )}
                              </div>
                              <div>
                                <p className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-500">
                                  {assistant ? data?.profile.botName || "Slice AI" : "You"}
                                </p>
                                <p className="text-[9px] font-semibold text-slate-700">
                                  {formatDate(message.createdAt)}
                                </p>
                              </div>
                            </div>
                            {assistant ? (
                              <WorkspacePill tone={message.metadata?.researchUsed ? "cyan" : "emerald"}>
                                {message.metadata?.researchUsed ? "Researched" : "Verified"}
                              </WorkspacePill>
                            ) : null}
                          </div>

                          <div className="mt-3">
                            {assistant ? (
                              <RichMessage value={message.content} />
                            ) : (
                              <p className="whitespace-pre-wrap text-sm font-bold leading-6 text-white">
                                {message.content}
                              </p>
                            )}
                          </div>

                          {assistant && action?.href ? (
                            <div className="mt-4 flex flex-wrap gap-2">
                              <WorkspaceButton
                                href={action.href}
                                variant="primary"
                                size="sm"
                                icon={<ArrowUpRight className="h-4 w-4" />}
                              >
                                Open verified action
                              </WorkspaceButton>
                              {action.pdfHref ? (
                                <WorkspaceButton
                                  href={String(action.pdfHref)}
                                  variant="secondary"
                                  size="sm"
                                  icon={<FileChartColumnIncreasing className="h-4 w-4" />}
                                >
                                  Open report
                                </WorkspaceButton>
                              ) : null}
                            </div>
                          ) : null}

                          {assistant && sources.length ? (
                            <details className="mt-4 rounded-xl border border-white/8 bg-black/20 p-3">
                              <summary className="cursor-pointer text-[10px] font-black uppercase tracking-[0.13em] text-cyan-300">
                                {sources.length} supporting source{sources.length === 1 ? "" : "s"}
                              </summary>
                              <div className="mt-3">
                                <SourceList sources={sources} />
                              </div>
                            </details>
                          ) : null}
                        </article>
                      );
                    })
                  )}

                  {busy ? (
                    <div className="rounded-2xl border border-cyan-400/15 bg-cyan-500/[0.04] p-4">
                      <div className="flex items-center gap-3">
                        <Loader2 className="h-5 w-5 animate-spin text-cyan-300" />
                        <div>
                          <p className="text-xs font-black text-cyan-100">{stage}</p>
                          <p className="mt-1 text-[10px] font-semibold text-cyan-300/65">
                            The interface remains usable while the request completes.
                          </p>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </WorkspaceSurface>

              <div className="grid min-h-0 content-start gap-3 overflow-y-auto">
                <CognitiveMap
                  lane={lastExecutionLane}
                  researchUsed={Boolean(latestAssistant?.metadata?.researchUsed)}
                  busy={busy || transcribing}
                />

                <WorkspaceSurface className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--slice-accent)]">
                        Latest result
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        {latestAssistant?.intent || "Waiting for a command"}
                      </p>
                    </div>
                    <WorkspacePill tone={statusTone(data?.lastExecution?.status)}>
                      {data?.lastExecution?.status || "Ready"}
                    </WorkspacePill>
                  </div>

                  <p className="mt-3 line-clamp-5 text-xs font-semibold leading-5 text-slate-500">
                    {data?.lastExecution?.resultSummary ||
                      latestAssistant?.content ||
                      "The next verified answer or action summary will appear here."}
                  </p>

                  {latestAction?.href ? (
                    <WorkspaceButton
                      className="mt-3 w-full"
                      href={latestAction.href}
                      variant="primary"
                      size="sm"
                      icon={<ArrowUpRight className="h-4 w-4" />}
                    >
                      Open action
                    </WorkspaceButton>
                  ) : null}
                </WorkspaceSurface>

                <WorkspaceSurface className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-2">
                      <Database className="h-4 w-4 text-cyan-300" />
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-cyan-300">
                        Intelligence fabric
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {latestSources.length ? (
                        <WorkspacePill tone={lastEvidenceScore >= 80 ? "emerald" : "cyan"}>
                          {lastEvidenceScore}/100
                        </WorkspacePill>
                      ) : null}
                      <WorkspacePill tone="cyan">{latestSources.length}</WorkspacePill>
                    </div>
                  </div>
                  <div className="mt-3 max-h-72 overflow-y-auto">
                    <SourceList sources={latestSources} />
                  </div>
                </WorkspaceSurface>

                <div className="grid grid-cols-2 gap-2">
                  <MiniMetric
                    label="Model"
                    value={data?.aiEngine?.fastModel || data?.aiEngine?.model || "Pending"}
                    helper="Adaptive model selection"
                    icon={<BrainCircuit className="h-4 w-4" />}
                  />
                  <MiniMetric
                    label="Approvals"
                    value={pendingApprovals}
                    helper="Awaiting review"
                    icon={<ShieldCheck className="h-4 w-4" />}
                  />
                </div>
              </div>
            </section>
          ) : null}

          {activeTab === "voice" ? (
            <section className="grid h-full min-h-0 gap-2 xl:grid-cols-[minmax(0,1fr)_320px]">
              <WorkspaceSurface className="flex min-h-0 flex-col overflow-y-auto p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.17em] text-[var(--slice-accent)]">
                      Voice command center
                    </p>
                    <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white sm:text-3xl">
                      Speak naturally. Watch the transcript become an action.
                    </h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                      Browser transcription is immediate. High-accuracy recording uses the existing OpenAI audio adapter and then executes through the same permission-scoped command route.
                    </p>
                  </div>
                  <WorkspacePill tone={browserVoiceAvailable ? "emerald" : "amber"}>
                    {browserVoiceAvailable ? "Instant voice ready" : "Recording fallback"}
                  </WorkspacePill>
                </div>

                <div className="mt-6 grid flex-1 place-items-center rounded-[2rem] border border-[var(--slice-accent-border)] bg-[radial-gradient(circle_at_center,var(--slice-accent-soft),transparent_66%)] p-6 text-center">
                  <div>
                    <div
                      className={cx(
                        "mx-auto grid h-32 w-32 place-items-center rounded-full border border-[var(--slice-accent-border)] bg-black/45 shadow-[0_0_80px_var(--slice-accent-glow)]",
                        (listening || recording || transcribing) && "animate-pulse",
                      )}
                    >
                      {transcribing ? (
                        <Loader2 className="h-12 w-12 animate-spin text-cyan-300" />
                      ) : recording ? (
                        <Radio className="h-12 w-12 text-amber-300" />
                      ) : listening ? (
                        <Waves className="h-12 w-12 text-[var(--slice-accent)]" />
                      ) : (
                        <Headphones className="h-12 w-12 text-[var(--slice-accent)]" />
                      )}
                    </div>

                    <h3 className="mt-5 text-2xl font-black text-white">
                      {transcribing
                        ? "Transcribing and executing"
                        : recording
                          ? "High-accuracy recording active"
                          : listening
                            ? "Listening in real time"
                            : "Voice operations ready"}
                    </h3>
                    <p className="mt-2 max-w-2xl text-sm font-semibold leading-6 text-slate-500">
                      Try “open client profiles”, “research Apple exposure”, “create a client-ready volatility report”, or “show autonomous scanning status”.
                    </p>

                    <div className="mt-5 flex flex-wrap justify-center gap-2">
                      <WorkspaceButton
                        variant={listening ? "danger" : "primary"}
                        icon={listening ? <CircleStop className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                        onClick={
                          listening
                            ? () => recognitionRef.current?.stop()
                            : startBrowserVoice
                        }
                        disabled={!browserVoiceAvailable || recording || transcribing || busy}
                      >
                        {listening ? "Finish command" : "Instant voice"}
                      </WorkspaceButton>
                      <WorkspaceButton
                        variant={recording ? "danger" : "secondary"}
                        icon={recording ? <CircleStop className="h-4 w-4" /> : <Radio className="h-4 w-4" />}
                        onClick={recording ? stopRecording : () => void startRecording()}
                        disabled={!recordingAvailable || listening || transcribing || busy}
                      >
                        {recording ? "Stop recording" : "High-accuracy recording"}
                      </WorkspaceButton>
                    </div>
                  </div>
                </div>

                <div className="mt-4 rounded-2xl border border-white/8 bg-black/30 p-4">
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.14em] text-slate-600">
                        Live transcript
                      </p>
                      <p className="mt-1 text-sm font-black text-white">
                        {voiceTranscript || "Your words appear here as you speak."}
                      </p>
                    </div>
                    <label className="flex items-center gap-2 text-[10px] font-bold text-slate-500">
                      <input
                        type="checkbox"
                        checked={autoExecuteVoice}
                        onChange={(event: ChangeEvent<HTMLInputElement>) => setAutoExecuteVoice(event.target.checked)}
                        className="h-4 w-4 accent-emerald-500"
                      />
                      Execute final transcript automatically
                    </label>
                  </div>
                </div>
              </WorkspaceSurface>

              <div className="grid min-h-0 content-start gap-3 overflow-y-auto">
                <WorkspaceSurface className="p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--slice-accent)]">
                    Voice performance
                  </p>
                  <div className="mt-3 grid gap-2">
                    <MiniMetric
                      label="Last command"
                      value={lastLatencyMs ? `${lastLatencyMs} ms` : "Waiting"}
                      helper="Transcription + execution"
                      icon={<Gauge className="h-4 w-4" />}
                    />
                    <MiniMetric
                      label="Browser voice"
                      value={browserVoiceAvailable ? "Ready" : "Unavailable"}
                      helper="Live interim transcript"
                      icon={<Mic className="h-4 w-4" />}
                    />
                    <MiniMetric
                      label="Audio model"
                      value={data?.aiEngine?.audio?.transcriptionModel || "Fallback"}
                      helper="Higher-accuracy path"
                      icon={<Waves className="h-4 w-4" />}
                    />
                  </div>
                </WorkspaceSurface>

                <WorkspaceSurface className="p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-cyan-300">
                    Execution safeguards
                  </p>
                  <div className="mt-3 space-y-2 text-xs font-semibold leading-5 text-slate-500">
                    <p>• Voice uses the same server authorization as typed commands.</p>
                    <p>• Client communication and high-impact actions retain approval gates.</p>
                    <p>• Financial terms, tickers, dates, and client workflow names are preserved during transcription.</p>
                  </div>
                </WorkspaceSurface>
              </div>
            </section>
          ) : null}

          {activeTab === "reports" ? (
            <section className="grid h-full min-h-0 gap-2 xl:grid-cols-[340px_minmax(0,1fr)]">
              <div className="grid min-h-0 content-start gap-3 overflow-y-auto">
                <WorkspaceSurface className="p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--slice-accent)]">
                    Report builder
                  </p>
                  <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-white">
                    Client-ready visuals backed by evidence.
                  </h2>
                  <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                    Choose a report pattern, customize the request, and generate through the same research and source layer used by the platform brain.
                  </p>

                  <div className="mt-4 grid grid-cols-2 gap-2">
                    {REPORT_TEMPLATES.map((template) => (
                      <button
                        key={template.label}
                        type="button"
                        onClick={() => setReportPrompt(template.prompt)}
                        className="rounded-xl border border-white/8 bg-white/[0.025] p-3 text-left transition hover:border-[var(--slice-accent-border)] hover:bg-[var(--slice-accent-soft)]"
                      >
                        <p className="text-xs font-black text-white">{template.label}</p>
                        <p className="mt-1 line-clamp-2 text-[9px] font-semibold leading-4 text-slate-600">
                          {template.helper}
                        </p>
                      </button>
                    ))}
                  </div>

                  <WorkspaceTextarea
                    value={reportPrompt}
                    onChange={(event: ChangeEvent<HTMLTextAreaElement>) => setReportPrompt(event.target.value)}
                    className="mt-4 min-h-40 bg-black/35"
                    aria-label="Report request"
                  />
                  <WorkspaceButton
                    className="mt-3 w-full"
                    variant="primary"
                    icon={busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                    onClick={() => void generateReport()}
                    disabled={busy || !reportPrompt.trim()}
                  >
                    Generate visual report
                  </WorkspaceButton>
                </WorkspaceSurface>

                <WorkspaceSurface className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
                        Report library
                      </p>
                      <p className="mt-1 text-lg font-black text-white">
                        {reports.length} recent reports
                      </p>
                    </div>
                    <WorkspaceButton
                      variant="quiet"
                      size="sm"
                      icon={<RefreshCw className="h-4 w-4" />}
                      onClick={() => void loadStudio(true)}
                    >
                      Refresh
                    </WorkspaceButton>
                  </div>

                  <div className="mt-3 max-h-72 space-y-2 overflow-y-auto">
                    {reports.length ? (
                      reports.map((report) => (
                        <button
                          key={report.id}
                          type="button"
                          onClick={() => setSelectedReportId(report.id)}
                          className={cx(
                            "w-full rounded-xl border p-3 text-left transition",
                            selectedReport?.id === report.id
                              ? "border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)]"
                              : "border-white/8 bg-white/[0.025] hover:border-white/15",
                          )}
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="truncate text-xs font-black text-white">{report.title}</p>
                            <WorkspacePill tone={statusTone(report.status)}>{report.status}</WorkspacePill>
                          </div>
                          <p className="mt-1 truncate text-[9px] font-semibold text-slate-600">
                            {report.reportType} · {formatDate(report.createdAt)}
                          </p>
                        </button>
                      ))
                    ) : (
                      <p className="text-xs font-semibold text-slate-600">
                        No reports have been created yet.
                      </p>
                    )}
                  </div>
                </WorkspaceSurface>
              </div>

              <WorkspaceSurface className="min-h-0 overflow-y-auto p-4">
                {selectedReport ? (
                  <div className="mx-auto max-w-5xl">
                    <div className="overflow-hidden rounded-[2rem] border border-[var(--slice-accent-border)] bg-[linear-gradient(145deg,#020806,#052e16_58%,#0f766e)] p-6 shadow-2xl shadow-black/40 sm:p-8">
                      <div className="flex flex-wrap items-center justify-between gap-3">
                        <WorkspacePill tone="emerald">Client-ready preview</WorkspacePill>
                        <WorkspacePill tone={selectedReport.design?.researchUsed ? "cyan" : "amber"}>
                          {selectedReport.design?.researchUsed ? "Source backed" : "Internal context"}
                        </WorkspacePill>
                      </div>
                      <h2 className="mt-7 max-w-4xl text-3xl font-black tracking-[-0.045em] text-white sm:text-5xl">
                        {selectedReport.title}
                      </h2>
                      <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-emerald-50/75 sm:text-base">
                        {selectedReport.summary || "Slice AI report prepared for advisor review."}
                      </p>
                      <div className="mt-7 grid gap-3 sm:grid-cols-3">
                        <MiniMetric
                          label="Confidence"
                          value={`${selectedReport.design?.confidenceScore ?? "—"}`}
                          helper="Advisor review still required"
                          icon={<Gauge className="h-4 w-4" />}
                        />
                        <MiniMetric
                          label="Sources"
                          value={selectedReport.design?.sourceCount ?? selectedReport.design?.sources?.length ?? 0}
                          helper="Visible evidence links"
                          icon={<Database className="h-4 w-4" />}
                        />
                        <MiniMetric
                          label="Model"
                          value={selectedReport.design?.model || "Slice AI"}
                          helper="Generation provider"
                          icon={<BrainCircuit className="h-4 w-4" />}
                        />
                      </div>
                      <div className="mt-7 flex flex-wrap gap-2">
                        <WorkspaceButton
                          href={selectedReport.viewerUrl || selectedReport.downloadUrl}
                          variant="primary"
                          icon={<ArrowUpRight className="h-4 w-4" />}
                        >
                          Open client preview
                        </WorkspaceButton>
                        <WorkspaceButton
                          href={selectedReport.downloadUrl}
                          variant="secondary"
                          icon={<FileChartColumnIncreasing className="h-4 w-4" />}
                        >
                          Open raw PDF
                        </WorkspaceButton>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_0.8fr]">
                      <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                        <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--slice-accent)]">
                          Advisor review context
                        </p>
                        <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
                          {selectedReport.summary || "Review the report for factual accuracy, source freshness, client suitability, and firm approval before external distribution."}
                        </p>
                      </div>
                      <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-5">
                        <div className="flex items-center justify-between gap-3">
                          <p className="text-[9px] font-black uppercase tracking-[0.15em] text-cyan-300">
                            Evidence backing
                          </p>
                          <WorkspacePill tone="cyan">
                            {selectedReport.design?.sources?.length ?? 0}
                          </WorkspacePill>
                        </div>
                        <div className="mt-3 max-h-60 overflow-y-auto">
                          <SourceList sources={selectedReport.design?.sources ?? []} />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : (
                  <EmptyPanel
                    icon={<FileChartColumnIncreasing className="h-5 w-5" />}
                    title="Choose or create a report."
                    description="The selected report appears here as a client-ready visual preview with evidence, confidence, and download controls."
                  />
                )}
              </WorkspaceSurface>
            </section>
          ) : null}

          {activeTab === "autonomy" ? (
            <section className="grid h-full min-h-0 gap-2 xl:grid-cols-[minmax(0,1fr)_320px]">
              <WorkspaceSurface className="min-h-0 overflow-y-auto p-4">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.17em] text-[var(--slice-accent)]">
                      Always-on control plane
                    </p>
                    <h2 className="mt-2 max-w-4xl text-3xl font-black tracking-[-0.045em] text-white sm:text-4xl">
                      The platform keeps scanning, briefing, and delivering approved work without an open browser.
                    </h2>
                    <p className="mt-3 max-w-4xl text-sm font-semibold leading-6 text-slate-500">
                      Vercel cron schedules the work, PostgreSQL stores durable jobs, and every workflow exposes progress, failures, cancellation, retry, and last-update information.
                    </p>
                  </div>
                  <WorkspaceButton
                    variant="secondary"
                    icon={<RefreshCw className={cx("h-4 w-4", autonomy.loading && "animate-spin")} />}
                    onClick={() => void loadAutonomy()}
                    disabled={autonomy.loading}
                  >
                    Refresh status
                  </WorkspaceButton>
                </div>

                <div className="mt-6 grid gap-3 md:grid-cols-3">
                  <Link
                    href="/workspace/brief"
                    prefetch={false}
                    className="group rounded-2xl border border-white/8 bg-white/[0.025] p-5 transition hover:border-[var(--slice-accent-border)] hover:bg-[var(--slice-accent-soft)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Mail className="h-6 w-6 text-[var(--slice-accent)]" />
                      <WorkspacePill tone={autonomy.brief?.preference?.enabled ? "emerald" : "amber"}>
                        {autonomy.brief?.preference?.enabled ? "Automatic" : "Paused"}
                      </WorkspacePill>
                    </div>
                    <h3 className="mt-4 text-xl font-black text-white">Advisor Brief</h3>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                      {autonomy.brief?.schedule?.label || "Schedule not loaded"}
                    </p>
                    <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-slate-600">
                      <span>Next run</span>
                      <span>{formatDate(autonomy.brief?.schedule?.nextRunAt)}</span>
                    </div>
                  </Link>

                  <Link
                    href="/workspace/watchlists"
                    prefetch={false}
                    className="group rounded-2xl border border-white/8 bg-white/[0.025] p-5 transition hover:border-[var(--slice-accent-border)] hover:bg-[var(--slice-accent-soft)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Search className="h-6 w-6 text-cyan-300" />
                      <WorkspacePill tone={autonomy.watchlists?.state?.schedulerEnabled ? "emerald" : "amber"}>
                        {autonomy.watchlists?.state?.schedulerEnabled ? "Scanning" : "Paused"}
                      </WorkspacePill>
                    </div>
                    <h3 className="mt-4 text-xl font-black text-white">Watchlist Scanning</h3>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                      {autonomy.watchlists?.metrics?.readyCount ?? 0} ready lists · {autonomy.watchlists?.metrics?.eventCount ?? 0} retained events
                    </p>
                    <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-slate-600">
                      <span>Last tick</span>
                      <span>{formatDate(autonomy.watchlists?.state?.lastSchedulerTick)}</span>
                    </div>
                  </Link>

                  <Link
                    href="/workspace/client-emails"
                    prefetch={false}
                    className="group rounded-2xl border border-white/8 bg-white/[0.025] p-5 transition hover:border-[var(--slice-accent-border)] hover:bg-[var(--slice-accent-soft)]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <Send className="h-6 w-6 text-amber-300" />
                      <WorkspacePill tone={(autonomy.email?.metrics?.failedCount ?? 0) ? "amber" : "emerald"}>
                        {(autonomy.email?.metrics?.failedCount ?? 0) ? "Review" : "Healthy"}
                      </WorkspacePill>
                    </div>
                    <h3 className="mt-4 text-xl font-black text-white">Approved Email Delivery</h3>
                    <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
                      {autonomy.email?.metrics?.scheduledCount ?? 0} scheduled · {autonomy.email?.metrics?.pendingApprovalCount ?? 0} awaiting approval
                    </p>
                    <div className="mt-4 flex items-center justify-between text-[10px] font-bold text-slate-600">
                      <span>Active work</span>
                      <span>{activeEmailJobs}</span>
                    </div>
                  </Link>
                </div>

                <WorkspaceAlert tone="info" className="mt-5" title="Autonomy boundary">
                  Slice can autonomously scan, generate advisor briefings, refine drafts, process documents, and execute already approved or scheduled deliveries. New AI-created client emails retain advisor approval unless a future firm policy explicitly permits another workflow.
                </WorkspaceAlert>
              </WorkspaceSurface>

              <div className="grid min-h-0 content-start gap-3 overflow-y-auto">
                <WorkspaceSurface className="p-4">
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <p className="text-[9px] font-black uppercase tracking-[0.15em] text-[var(--slice-accent)]">
                        Runtime health
                      </p>
                      <p className="mt-1 text-lg font-black text-white">Durable and recoverable</p>
                    </div>
                    <WorkspacePill tone={activeAutomationJobs ? "cyan" : "emerald"}>
                      {activeAutomationJobs} active
                    </WorkspacePill>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {[
                      ["Brief jobs", activeBriefJobs, autonomy.brief?.jobs?.[0]?.status || "Idle"],
                      ["Watchlist jobs", autonomy.watchlists?.metrics?.activeJobCount ?? 0, autonomy.watchlists?.state?.schedulerEnabled ? "Enabled" : "Paused"],
                      ["Email jobs", activeEmailJobs, (autonomy.email?.metrics?.failedCount ?? 0) ? "Failures visible" : "Healthy"],
                    ].map(([label, count, status]) => (
                      <div key={String(label)} className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                        <div className="flex items-center justify-between gap-3">
                          <div>
                            <p className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-600">
                              {label}
                            </p>
                            <p className="mt-1 text-lg font-black text-white">{String(count)}</p>
                          </div>
                          <WorkspacePill tone={statusTone(String(status))}>{String(status)}</WorkspacePill>
                        </div>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[10px] font-semibold text-slate-600">
                    Last refresh: {formatDate(autonomy.loadedAt)}
                  </p>
                </WorkspaceSurface>

                <WorkspaceSurface className="p-4">
                  <p className="text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">
                    Configure at the source
                  </p>
                  <div className="mt-3 grid gap-2">
                    {ROUTE_ACTIONS.slice(1).map((action) => (
                      <Link
                        key={action.href}
                        href={action.href}
                        prefetch={false}
                        className="flex items-center justify-between rounded-xl border border-white/8 bg-white/[0.025] px-3 py-3 text-xs font-black text-slate-300 hover:border-[var(--slice-accent-border)] hover:text-white"
                      >
                        {action.label}
                        <ArrowUpRight className="h-4 w-4 text-[var(--slice-accent)]" />
                      </Link>
                    ))}
                  </div>
                </WorkspaceSurface>
              </div>
            </section>
          ) : null}
        </div>
      </div>
    </SliceBackground>
  );
}