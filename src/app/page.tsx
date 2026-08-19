"use client";

import Link from "next/link";
import Reveal from "@/components/ui/reveal";
import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  AnimatePresence,
  motion,
  useReducedMotion,
} from "framer-motion";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  ArrowRight,
  BellRing,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  Building2,
  CalendarClock,
  ChartCandlestick,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronRight,
  CircleDot,
  Clock3,
  CloudCog,
  Database,
  ExternalLink,
  FileCheck2,
  FileSearch,
  FileText,
  Gauge,
  GitBranch,
  Globe2,
  Landmark,
  Layers3,
  Lightbulb,
  LineChart,
  Link2,
  LockKeyhole,
  Mail,
  Menu,
  MessageSquareText,
  Network,
  Newspaper,
  Orbit,
  PieChart,
  Radar,
  RefreshCcw,
  Route,
  Search,
  ServerCog,
  ShieldCheck,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  UserRound,
  UsersRound,
  Workflow,
  X,
  Zap,
} from "lucide-react";

import type {
  PublicArticle,
  PublicIntelligenceSnapshot,
} from "@/lib/public-intelligence-types";

type MarketState = "Live" | "Delayed" | "Closed" | "Stale" | "Demo";

type MarketSnapshot = {
  symbol: string;
  providerSymbol?: string;
  assetType?: string;
  provider?: string;
  isRealtime?: boolean;
  price: number;
  previousClose?: number | null;
  change?: number | null;
  changePercent?: number | null;
  bid?: number | null;
  ask?: number | null;
  volume?: number | null;
  currency?: string;
  marketState?: MarketState;
  qualityScore?: number;
  latencyMs?: number;
  providerTimestamp?: string | null;
  receivedAt?: string;
  technicals?: {
    sma20?: number | null;
    sma50?: number | null;
    sma200?: number | null;
    rsi14?: number | null;
    volatility30d?: number | null;
    trend?: "Bullish" | "Bearish" | "Neutral" | "Insufficient data";
    technicalSummary?: string;
  };
  warnings?: string[];
};

type MarketApiResponse = {
  generatedAt?: string;
  pollAfterMs?: number;
  providerPriority?: string[];
  requestedSymbols?: string[];
  realtimeCount?: number;
  delayedOrDemoCount?: number;
  staleCount?: number;
  warnings?: string[];
  snapshots?: MarketSnapshot[];
  providerMode?: string;
  strictProvider?: boolean;
  error?: string;
  detail?: string;
};

type PricePoint = {
  price: number;
  at: number;
};

type PriceHistory = Record<string, PricePoint[]>;

type PriceMovement = Record<string, "up" | "down" | "flat">;

type AlphaIntradayBar = {
  timestamp: string;
  providerTimestamp?: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type AlphaDetailResponse = {
  schemaVersion?: string;
  ok?: boolean;
  symbol?: string;
  provider?: string;
  retrievedAt?: string;
  providerAsOf?: string | null;
  entitlement?: "realtime" | "delayed" | null;
  freshness?: {
    mode?:
      | "realtime"
      | "delayed"
      | "market_closed"
      | "end_of_day"
      | "stale"
      | "unavailable";
    isRealtime?: boolean;
    isDelayed?: boolean;
    providerAsOf?: string | null;
    retrievedAt?: string;
    ageSeconds?: number | null;
    label?: string;
    explanation?: string;
  };
  market?: {
    currentStatus?: string;
    isOpen?: boolean;
    region?: string;
    primaryExchanges?: string;
    localOpen?: string;
    localClose?: string;
  } | null;
  quote?: {
    price: number;
    open: number;
    high: number;
    low: number;
    previousClose: number;
    change: number;
    changePercent: number;
    volume: number;
    latestTradingDay?: string | null;
  } | null;
  intraday?: {
    interval: string;
    timeZone: string;
    lastRefreshed?: string | null;
    bars: AlphaIntradayBar[];
    session?: {
      date: string;
      open: number;
      high: number;
      low: number;
      latest: number;
      vwap: number;
      volume: number;
      changePercent: number;
    } | null;
  } | null;
  technicals?: {
    historyPointCount?: number;
    sma20?: number | null;
    sma50?: number | null;
    sma200?: number | null;
    rsi14?: number | null;
    volatility20Annualized?: number | null;
    momentum30?: number | null;
    drawdownFrom60DayHigh?: number | null;
    trendScore?: number | null;
    momentumScore?: number | null;
    riskScore?: number | null;
    volumeScore?: number | null;
    technicalSummary?: string;
  } | null;
  news?: {
    articleCount?: number;
    latestPublishedAt?: string | null;
    averageSentiment?: number;
    relevanceWeightedSentiment?: number;
    latestTitle?: string;
    items?: Array<{
      id: string;
      title: string;
      summary: string;
      url: string;
      source: string;
      publishedAt?: string | null;
      tickerRelevance?: number;
      tickerSentimentScore?: number;
      tickerSentimentLabel?: string;
      topics?: string[];
    }>;
  } | null;
  health?: {
    configured?: boolean;
    successfulEndpointCount?: number;
    failedEndpointCount?: number;
    degraded?: boolean;
    recommendedPollMs?: number;
    warnings?: string[];
    errors?: Record<string, string>;
  };
  error?: string;
};

type GraphLayer = "market" | "intelligence" | "advisor" | "governance" | "all";

type GraphNode = {
  id: string;
  x: number;
  y: number;
  label: string;
  eyebrow: string;
  description: string;
  layer: Exclude<GraphLayer, "all">;
  icon: LucideIcon;
  href: string;
  inputs: string[];
  outputs: string[];
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
  layer: Exclude<GraphLayer, "all">;
  bend?: number;
  duration: number;
  delay: number;
};

type Capability = {
  title: string;
  description: string;
  detail: string;
  href: string;
  icon: LucideIcon;
};

type CapabilityGroup = {
  id: "intelligence" | "operations" | "automation" | "governance";
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  items: Capability[];
};

const MARKET_SYMBOLS = [
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "NVDA",
  "AAPL",
  "MSFT",
  "AMZN",
  "TLT",
  "GLD",
  "BTCUSD",
];

const DETAIL_SYMBOLS = new Set([
  "SPY",
  "QQQ",
  "IWM",
  "DIA",
  "NVDA",
  "AAPL",
  "MSFT",
  "AMZN",
  "TLT",
  "GLD",
]);

const DEFAULT_MARKET_POLL_MS = 30_000;
const PUBLIC_INTELLIGENCE_ARTICLE_LIMIT = 6;

const NAV_ITEMS = [
  { label: "What is Slice", href: "#what-is-slice" },
  { label: "Live markets", href: "#live-markets" },
  { label: "Knowledge graph", href: "#knowledge-graph" },
  { label: "Capabilities", href: "#capabilities" },
  { label: "Daily intelligence", href: "/blog" },
];

const ARCHITECTURE_LAYERS = [
  {
    number: "01",
    title: "Observe",
    summary: "Markets, news, documents, client activity, workflows, and firm data enter one monitored operating layer.",
    icon: Radar,
  },
  {
    number: "02",
    title: "Connect",
    summary: "The knowledge graph links securities, themes, portfolios, clients, tasks, communications, and compliance context.",
    icon: Network,
  },
  {
    number: "03",
    title: "Reason",
    summary: "Specialized AI agents rank materiality, identify relationships, model risk, and propose next-best actions.",
    icon: BrainCircuit,
  },
  {
    number: "04",
    title: "Act",
    summary: "Advisors move from signal to portfolio review, client draft, task, meeting, alert, or documented decision.",
    icon: Zap,
  },
  {
    number: "05",
    title: "Govern",
    summary: "Permissions, review gates, source evidence, audit trails, and retention rules remain attached to the work.",
    icon: ShieldCheck,
  },
];

const CAPABILITY_GROUPS: CapabilityGroup[] = [
  {
    id: "intelligence",
    label: "Intelligence",
    title: "A connected view of markets, research, portfolios, and risk",
    description:
      "Slice continuously turns provider data and sourced information into ranked, explainable advisor context.",
    icon: BrainCircuit,
    items: [
      {
        title: "Alpha Vantage market command",
        description: "Strict provider-backed quote, freshness, quality, latency, technical, and session context.",
        detail: "The public homepage never invents prices. It requests Alpha Vantage explicitly and preserves the last confirmed provider value when a refresh fails.",
        href: "/workspace/custom-board",
        icon: ChartCandlestick,
      },
      {
        title: "Daily sourced intelligence",
        description: "Cron-scouted articles from official feeds and Alpha Vantage market news.",
        detail: "Articles are deduplicated, ranked for recency and relevance, connected to tickers and themes, and retained as a public daily edition.",
        href: "/blog",
        icon: Newspaper,
      },
      {
        title: "Portfolio and scenario lab",
        description: "Allocation, concentration, liquidity, tax context, drift, and scenario review.",
        detail: "Market and research signals can move directly into portfolio analysis without losing source or suitability context.",
        href: "/portfolio-lab",
        icon: PieChart,
      },
      {
        title: "Opportunity and risk radar",
        description: "Technical opportunity filtering, risk signals, watchlists, and alert thresholds.",
        detail: "Slice monitors broad universes and advisor watchlists, then prioritizes the small set of changes that deserve human attention.",
        href: "/opportunity-radar",
        icon: Target,
      },
    ],
  },
  {
    id: "operations",
    label: "Advisor operations",
    title: "One operating system for the full advisor day",
    description:
      "Client service, communication, planning, documents, meetings, tasks, and firm oversight live in a single workspace.",
    icon: BriefcaseBusiness,
    items: [
      {
        title: "Unified advisor workspace",
        description: "A command center for clients, priorities, market context, tasks, and communication.",
        detail: "The workspace is designed to reduce route-switching while preserving role-based access behind the interface.",
        href: "/workspace",
        icon: Layers3,
      },
      {
        title: "Client portal and advisor assignment",
        description: "Messages, documents, risk updates, meeting access, and advisor-specific routing.",
        detail: "Clients see the right advisor relationship while assigned advisors receive the corresponding messages and profile updates.",
        href: "/client-login",
        icon: UsersRound,
      },
      {
        title: "Communication center",
        description: "AI-assisted email, briefing, talking-point, and review workflows.",
        detail: "Drafts remain easy to edit, compare, approve, queue, and send through controlled firm processes.",
        href: "/workspace/client-emails",
        icon: Mail,
      },
      {
        title: "Firm planning and oversight",
        description: "Team operations, goals, reminders, system health, and founder-level visibility.",
        detail: "Leadership can see what is working, what is blocked, where review is required, and how the firm is operating.",
        href: "/firm-planning",
        icon: Building2,
      },
    ],
  },
  {
    id: "automation",
    label: "AI and automation",
    title: "Specialized agents that coordinate instead of operating in isolation",
    description:
      "The Slice bot mesh divides work into bounded expert paths, then rejoins the evidence before presenting an answer or action.",
    icon: Bot,
    items: [
      {
        title: "Personal advisor bot",
        description: "A role-aware assistant shaped by advisor preferences, workflows, clients, and firm policy.",
        detail: "The bot can answer, summarize, draft, route work, and maintain continuity while respecting permissions and review gates.",
        href: "/workspace/personal-bot",
        icon: Bot,
      },
      {
        title: "Research swarm",
        description: "Parallel market, company, macro, sentiment, and risk research paths.",
        detail: "Independent agents reduce single-path blind spots and return source-linked findings to a common reasoning layer.",
        href: "/intelligence",
        icon: Orbit,
      },
      {
        title: "Workflow automation",
        description: "Signal-to-task, meeting preparation, reminders, briefs, drafts, and approval queues.",
        detail: "Automation is aimed at removing repetitive work while leaving decisions and sensitive communications under human control.",
        href: "/workspace",
        icon: Workflow,
      },
      {
        title: "Firm memory and knowledge graph",
        description: "Relationships between prior decisions, documents, clients, securities, themes, and outcomes.",
        detail: "The graph gives bots and humans a shared map of why something matters and where related knowledge already exists.",
        href: "/command",
        icon: GitBranch,
      },
    ],
  },
  {
    id: "governance",
    label: "Governance",
    title: "Evidence, permissions, and review are part of the product",
    description:
      "Slice is designed for advisor workflows where speed matters, but traceability and controlled action matter just as much.",
    icon: ShieldCheck,
    items: [
      {
        title: "Review-first output",
        description: "Client-specific language, recommendations, performance claims, and sensitive output stay gated.",
        detail: "AI can accelerate preparation, but the advisor or designated reviewer controls what becomes client-facing.",
        href: "/security",
        icon: FileCheck2,
      },
      {
        title: "Source and freshness transparency",
        description: "Provider, timestamp, market state, quality, relevance, and original links remain visible.",
        detail: "The interface distinguishes real-time, delayed, closed, stale, and unavailable states instead of obscuring them.",
        href: "/security",
        icon: FileSearch,
      },
      {
        title: "Role-based access",
        description: "Founder, firm, advisor, and client experiences remain separated by permissions.",
        detail: "Navigation can feel unified without exposing the same data or actions to every role.",
        href: "/founder-login",
        icon: LockKeyhole,
      },
      {
        title: "Audit and operating health",
        description: "Cron health, integration health, queued work, system readiness, and retained decisions.",
        detail: "The system can show not only the output, but whether the underlying source, job, and approval path were healthy.",
        href: "/backend-readiness",
        icon: ServerCog,
      },
    ],
  },
];

const GRAPH_NODES: GraphNode[] = [
  {
    id: "slice-core",
    x: 600,
    y: 345,
    label: "Slice Intelligence Core",
    eyebrow: "Orchestration",
    description: "The central reasoning layer that joins market data, sourced evidence, client context, workflows, and governance before an output is produced.",
    layer: "intelligence",
    icon: BrainCircuit,
    href: "/command",
    inputs: ["Provider data", "Research", "Firm memory", "Client context"],
    outputs: ["Ranked signals", "Drafts", "Tasks", "Review requests"],
  },
  {
    id: "market",
    x: 125,
    y: 120,
    label: "Live Markets",
    eyebrow: "Alpha Vantage",
    description: "Quotes, market state, intraday bars, volume, freshness, latency, and technical context.",
    layer: "market",
    icon: ChartCandlestick,
    href: "/workspace/custom-board",
    inputs: ["Bulk quotes", "Intraday bars", "Market status"],
    outputs: ["Movement", "Freshness", "Technical context"],
  },
  {
    id: "technicals",
    x: 350,
    y: 90,
    label: "Technical Engine",
    eyebrow: "Market structure",
    description: "Trend, momentum, volatility, volume, moving averages, and opportunity filtering.",
    layer: "market",
    icon: LineChart,
    href: "/opportunity-radar",
    inputs: ["Price history", "Volume", "Benchmarks"],
    outputs: ["Trend score", "Momentum", "Risk quality"],
  },
  {
    id: "macro",
    x: 120,
    y: 525,
    label: "Macro Context",
    eyebrow: "Economic layer",
    description: "Rates, inflation, liquidity, policy, economic releases, and cross-asset implications.",
    layer: "market",
    icon: Landmark,
    href: "/intelligence",
    inputs: ["Economic data", "Policy", "Rates"],
    outputs: ["Regime context", "Scenario inputs", "Theme links"],
  },
  {
    id: "news",
    x: 125,
    y: 315,
    label: "Sourced News",
    eyebrow: "Daily scouting",
    description: "Official feeds and Alpha Vantage market news, ranked by recency, relevance, materiality, and source evidence.",
    layer: "intelligence",
    icon: Newspaper,
    href: "/blog",
    inputs: ["Official feeds", "Provider news", "Source health"],
    outputs: ["Daily edition", "Alerts", "Digest candidates"],
  },
  {
    id: "sentiment",
    x: 350,
    y: 520,
    label: "Sentiment Mesh",
    eyebrow: "Interpretation",
    description: "Article sentiment, ticker relevance, theme intensity, disagreement, and narrative change.",
    layer: "intelligence",
    icon: Activity,
    href: "/intelligence",
    inputs: ["Headlines", "Ticker relevance", "Themes"],
    outputs: ["Sentiment context", "Narrative shifts", "Confidence"],
  },
  {
    id: "agents",
    x: 585,
    y: 95,
    label: "Agent Swarm",
    eyebrow: "Parallel AI paths",
    description: "Specialized market, research, risk, client, document, and compliance agents work in parallel before rejoining the core.",
    layer: "intelligence",
    icon: Orbit,
    href: "/intelligence",
    inputs: ["Research questions", "Tool access", "Policies"],
    outputs: ["Independent findings", "Debate", "Consensus"],
  },
  {
    id: "portfolio",
    x: 820,
    y: 105,
    label: "Portfolio Lab",
    eyebrow: "Investment context",
    description: "Holdings, allocation, drift, concentration, liquidity, tax context, and scenario impact.",
    layer: "advisor",
    icon: PieChart,
    href: "/portfolio-lab",
    inputs: ["Holdings", "Goals", "Signals"],
    outputs: ["Exposure review", "Scenarios", "Talking points"],
  },
  {
    id: "risk",
    x: 825,
    y: 565,
    label: "Risk and Suitability",
    eyebrow: "Guardrail layer",
    description: "Risk tolerance, concentration, liquidity, downside scenarios, suitability, and client-specific constraints.",
    layer: "governance",
    icon: ShieldCheck,
    href: "/portfolio-lab",
    inputs: ["Portfolio", "Client profile", "Scenarios"],
    outputs: ["Risk flags", "Review gates", "Suitability context"],
  },
  {
    id: "clients",
    x: 1075,
    y: 155,
    label: "Client Graph",
    eyebrow: "Relationship context",
    description: "Households, goals, assigned advisors, preferences, risk updates, messages, meetings, and documents.",
    layer: "advisor",
    icon: UsersRound,
    href: "/client-login",
    inputs: ["Profiles", "Messages", "Goals", "Documents"],
    outputs: ["Advisor context", "Service needs", "Next actions"],
  },
  {
    id: "communications",
    x: 1080,
    y: 365,
    label: "Communication Center",
    eyebrow: "Human-reviewed output",
    description: "Emails, briefs, talking points, meeting notes, approval queues, and client delivery.",
    layer: "advisor",
    icon: Mail,
    href: "/workspace/client-emails",
    inputs: ["Signals", "Client context", "Firm voice"],
    outputs: ["Drafts", "Approvals", "Delivered updates"],
  },
  {
    id: "documents",
    x: 1075,
    y: 575,
    label: "Document Intelligence",
    eyebrow: "Evidence layer",
    description: "Uploaded documents, extracted facts, summaries, obligations, decisions, and retained records.",
    layer: "advisor",
    icon: FileText,
    href: "/workspace",
    inputs: ["Statements", "Forms", "Research", "Agreements"],
    outputs: ["Extracted facts", "Tasks", "Knowledge links"],
  },
  {
    id: "workflow",
    x: 610,
    y: 625,
    label: "Workflow Engine",
    eyebrow: "Execution",
    description: "Tasks, reminders, meetings, approval queues, routing, and operating cadence.",
    layer: "advisor",
    icon: Workflow,
    href: "/workspace",
    inputs: ["Signals", "Client needs", "Firm priorities"],
    outputs: ["Tasks", "Schedules", "Escalations"],
  },
  {
    id: "compliance",
    x: 920,
    y: 390,
    label: "Review and Compliance",
    eyebrow: "Control plane",
    description: "Permissions, review-first rules, source evidence, language checks, retention, and audit context.",
    layer: "governance",
    icon: FileCheck2,
    href: "/security",
    inputs: ["Drafts", "Policies", "Client scope"],
    outputs: ["Approval", "Required edits", "Audit trail"],
  },
  {
    id: "firm-memory",
    x: 600,
    y: 500,
    label: "Firm Memory",
    eyebrow: "Institutional knowledge",
    description: "Prior decisions, advisor preferences, documents, outcomes, workflows, and reusable firm knowledge.",
    layer: "governance",
    icon: Database,
    href: "/command",
    inputs: ["Decisions", "Documents", "Outcomes"],
    outputs: ["Continuity", "Precedent", "Context retrieval"],
  },
  {
    id: "founder",
    x: 820,
    y: 315,
    label: "Founder Command",
    eyebrow: "Leadership access",
    description: "Firm-wide operations, system health, team oversight, feature control, and command-level visibility.",
    layer: "governance",
    icon: Building2,
    href: "/founder-login",
    inputs: ["Firm metrics", "System health", "Operations"],
    outputs: ["Priorities", "Controls", "Escalations"],
  },
];

const GRAPH_EDGES: GraphEdge[] = [
  { id: "market-technicals", from: "market", to: "technicals", layer: "market", bend: -45, duration: 4.5, delay: -1.2 },
  { id: "market-core", from: "market", to: "slice-core", layer: "market", bend: 38, duration: 5.8, delay: -3.1 },
  { id: "technicals-core", from: "technicals", to: "slice-core", layer: "market", bend: -25, duration: 4.9, delay: -2.3 },
  { id: "macro-core", from: "macro", to: "slice-core", layer: "market", bend: -40, duration: 6.4, delay: -1.8 },
  { id: "macro-risk", from: "macro", to: "risk", layer: "market", bend: 60, duration: 7.2, delay: -4.2 },
  { id: "news-sentiment", from: "news", to: "sentiment", layer: "intelligence", bend: -35, duration: 4.4, delay: -0.8 },
  { id: "news-core", from: "news", to: "slice-core", layer: "intelligence", bend: 28, duration: 5.2, delay: -2.9 },
  { id: "sentiment-core", from: "sentiment", to: "slice-core", layer: "intelligence", bend: -30, duration: 4.7, delay: -1.5 },
  { id: "agents-core", from: "agents", to: "slice-core", layer: "intelligence", bend: 20, duration: 4.2, delay: -0.4 },
  { id: "technicals-agents", from: "technicals", to: "agents", layer: "intelligence", bend: 28, duration: 5.6, delay: -3.4 },
  { id: "news-agents", from: "news", to: "agents", layer: "intelligence", bend: -70, duration: 6.8, delay: -2.1 },
  { id: "core-portfolio", from: "slice-core", to: "portfolio", layer: "advisor", bend: -38, duration: 5.1, delay: -1.1 },
  { id: "core-clients", from: "slice-core", to: "clients", layer: "advisor", bend: -80, duration: 7.3, delay: -4.1 },
  { id: "portfolio-clients", from: "portfolio", to: "clients", layer: "advisor", bend: 30, duration: 4.6, delay: -2.2 },
  { id: "portfolio-risk", from: "portfolio", to: "risk", layer: "governance", bend: 75, duration: 6.2, delay: -3.5 },
  { id: "clients-comms", from: "clients", to: "communications", layer: "advisor", bend: -18, duration: 4.1, delay: -0.9 },
  { id: "clients-documents", from: "clients", to: "documents", layer: "advisor", bend: 28, duration: 5.2, delay: -2.5 },
  { id: "core-comms", from: "slice-core", to: "communications", layer: "advisor", bend: 48, duration: 6.1, delay: -3.3 },
  { id: "core-workflow", from: "slice-core", to: "workflow", layer: "advisor", bend: -20, duration: 4.8, delay: -1.7 },
  { id: "workflow-comms", from: "workflow", to: "communications", layer: "advisor", bend: -55, duration: 6.3, delay: -4.6 },
  { id: "workflow-documents", from: "workflow", to: "documents", layer: "advisor", bend: 20, duration: 5.4, delay: -1.4 },
  { id: "comms-compliance", from: "communications", to: "compliance", layer: "governance", bend: 26, duration: 4.0, delay: -2.1 },
  { id: "documents-compliance", from: "documents", to: "compliance", layer: "governance", bend: -42, duration: 5.7, delay: -0.6 },
  { id: "risk-compliance", from: "risk", to: "compliance", layer: "governance", bend: -22, duration: 4.5, delay: -2.8 },
  { id: "compliance-core", from: "compliance", to: "slice-core", layer: "governance", bend: 45, duration: 5.5, delay: -3.9 },
  { id: "memory-core", from: "firm-memory", to: "slice-core", layer: "governance", bend: -16, duration: 4.3, delay: -1.6 },
  { id: "documents-memory", from: "documents", to: "firm-memory", layer: "governance", bend: 60, duration: 7.1, delay: -5.0 },
  { id: "workflow-memory", from: "workflow", to: "firm-memory", layer: "governance", bend: 22, duration: 4.2, delay: -0.3 },
  { id: "founder-core", from: "founder", to: "slice-core", layer: "governance", bend: 30, duration: 4.4, delay: -2.0 },
  { id: "founder-compliance", from: "founder", to: "compliance", layer: "governance", bend: -25, duration: 4.8, delay: -3.2 },
  { id: "founder-memory", from: "founder", to: "firm-memory", layer: "governance", bend: 25, duration: 5.0, delay: -1.0 },
];

const AGENT_ROLES = [
  { title: "Market agent", text: "Watches price, breadth, session state, volume, and technical change.", icon: ChartCandlestick },
  { title: "News agent", text: "Scouts, deduplicates, ranks, and links sourced articles to relevant entities.", icon: Newspaper },
  { title: "Macro agent", text: "Connects policy, rates, inflation, liquidity, and economic releases to portfolios.", icon: Landmark },
  { title: "Portfolio agent", text: "Maps signals into exposures, scenarios, concentration, and advisor talking points.", icon: PieChart },
  { title: "Client agent", text: "Adds goals, preferences, assigned-advisor context, service history, and next needs.", icon: UserRound },
  { title: "Document agent", text: "Extracts facts, obligations, decisions, and reusable knowledge from files.", icon: FileSearch },
  { title: "Communication agent", text: "Builds editable drafts, briefs, meeting prep, and approved delivery paths.", icon: MessageSquareText },
  { title: "Governance agent", text: "Checks permissions, sensitive language, source evidence, and review requirements.", icon: ShieldCheck },
];

const WORKFLOW_STEPS = [
  { step: "01", title: "A change occurs", text: "A price moves, a source publishes, a client writes, a document arrives, or a task becomes due.", icon: Activity },
  { step: "02", title: "Slice builds context", text: "The graph connects the event to securities, themes, portfolios, clients, documents, and prior decisions.", icon: Network },
  { step: "03", title: "Agents investigate", text: "Specialized paths independently test materiality, relevance, risk, and possible downstream actions.", icon: Orbit },
  { step: "04", title: "The advisor sees the why", text: "Source, timestamp, provider state, evidence, affected relationships, and confidence stay visible.", icon: Lightbulb },
  { step: "05", title: "Work is prepared", text: "Slice can propose a review, task, scenario, meeting brief, client draft, alert, or documented decision.", icon: Workflow },
  { step: "06", title: "Human control closes the loop", text: "The advisor or firm reviewer approves, edits, suppresses, schedules, or records the action.", icon: FileCheck2 },
];

const FAQS = [
  {
    question: "What is Slice in one sentence?",
    answer: "Slice is an advisor intelligence and operating platform that connects real-time market data, sourced research, portfolios, clients, documents, workflows, AI agents, and review-first governance in one system.",
  },
  {
    question: "Is the homepage market data actually from Alpha Vantage?",
    answer: "Yes. This replacement calls Slice’s strict Alpha Vantage route with provider=alphavantage and strict=true. It does not generate fallback prices. The interface visibly labels real-time, delayed, closed, stale, or unavailable states.",
  },
  {
    question: "Does an Alpha Vantage API key automatically mean real-time US equity data?",
    answer: "No. The key must have the appropriate market-data entitlement, and ALPHA_VANTAGE_ENTITLEMENT should be set to realtime. Otherwise Slice correctly labels the result delayed or historical instead of calling it real-time.",
  },
  {
    question: "How does the daily article page stay current?",
    answer:
      "At 6:00 AM Eastern Time, a protected Vercel Cron route scouts official market feeds and Alpha Vantage Market News & Sentiment, ranks and deduplicates the results, selects the six highest-ranked unique stories, and stores one fixed edition for the homepage and blog. Page visits only read the stored edition and do not initiate another scan.",
  },
  {
    question: "Does Slice make autonomous client recommendations?",
    answer: "The platform can prepare research, analysis, drafts, tasks, and possible next actions, but client-specific recommendations and sensitive communications are designed to remain under advisor or firm review.",
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function OriginalBrandMark() {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-950 via-zinc-950 to-emerald-600 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-emerald-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-emerald-700" />
      </div>

      <div className="min-w-0">
        <div className="truncate text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="line-clamp-2 text-[10px] font-black uppercase leading-snug tracking-[0.22em] text-emerald-400 sm:truncate">
          Advisor Intelligence Platform
        </div>
      </div>
    </div>
  );
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatCurrency(value: number, currency = "USD") {
  if (!Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value >= 100 ? 2 : value >= 1 ? 3 : 6,
  }).format(value);
}

function formatCompact(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatTime(value?: string | null) {
  if (!value) return "Awaiting provider timestamp";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "Provider timestamp unavailable";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(parsed));
}

function relativeTime(value?: string | null) {
  if (!value) return "time unavailable";
  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "time unavailable";

  const seconds = Math.max(0, Math.round((Date.now() - parsed) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

function marketDateKey(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "";

  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(value));
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return `${read("year")}-${read("month")}-${read("day")}`;
}

function safeExternalUrl(value?: string) {
  if (!value) return undefined;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function dataStateTone(snapshot: MarketSnapshot) {
  if (snapshot.marketState === "Live" && snapshot.isRealtime) return "green";
  if (snapshot.marketState === "Closed") return "blue";
  if (snapshot.marketState === "Delayed") return "amber";
  if (snapshot.marketState === "Stale") return "red";
  return "slate";
}

function buildSparkPath(points: PricePoint[], width = 240, height = 72) {
  const values = points.map((point) => point.price).filter(Number.isFinite);
  if (!values.length) return "";

  const minimum = Math.min(...values);
  const maximum = Math.max(...values);
  const range = Math.max(maximum - minimum, Math.abs(maximum) * 0.0005, 0.0001);

  return values
    .map((value, index) => {
      const x = values.length === 1 ? width / 2 : (index / (values.length - 1)) * width;
      const y = height - ((value - minimum) / range) * (height - 12) - 6;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function graphPath(edge: GraphEdge) {
  const from = GRAPH_NODES.find((node) => node.id === edge.from);
  const to = GRAPH_NODES.find((node) => node.id === edge.to);

  if (!from || !to) return "";

  const midpointX = (from.x + to.x) / 2;
  const midpointY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const perpendicularX = (-dy / length) * (edge.bend ?? 0);
  const perpendicularY = (dx / length) * (edge.bend ?? 0);
  const controlX = midpointX + perpendicularX;
  const controlY = midpointY + perpendicularY;

  return `M ${from.x} ${from.y} Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${to.x} ${to.y}`;
}

function normalizeIntelligence(
  value: Partial<PublicIntelligenceSnapshot>,
): PublicIntelligenceSnapshot {
  const items = Array.isArray(value.items)
    ? value.items.slice(
        0,
        PUBLIC_INTELLIGENCE_ARTICLE_LIMIT,
      )
    : [];

  return {
    schemaVersion:
      "slice-public-intelligence-2.0.0",
    generatedAt:
      value.generatedAt ??
      new Date(0).toISOString(),
    dateKey:
      value.dateKey ??
      marketDateKey(value.generatedAt),
    marketTimeZone: "America/New_York",
    provider:
      "Slice Public Intelligence Mesh",
    refreshCadence:
      value.refreshCadence ??
      "Published daily at 6:00 AM Eastern Time",
    storage: value.storage ?? "fresh",
    sources: Array.isArray(value.sources)
      ? value.sources
      : [],
    items,
    alertCandidates: items.filter(
      (item) => item.shouldAlert,
    ),
    digestCandidates: items.filter(
      (item) =>
        !item.shouldAlert &&
        item.score >= 55,
    ),
    suppressed: items.filter(
      (item) => item.score < 55,
    ),
    topicCounts: Array.isArray(
      value.topicCounts,
    )
      ? value.topicCounts
      : [],
    warnings: Array.isArray(value.warnings)
      ? value.warnings
      : [],
  };
}

function useAlphaMarket() {
  const [snapshots, setSnapshots] = useState<MarketSnapshot[]>([]);
  const [history, setHistory] = useState<PriceHistory>({});
  const [movement, setMovement] = useState<PriceMovement>({});
  const [generatedAt, setGeneratedAt] = useState<string>();
  const [pollMs, setPollMs] = useState(DEFAULT_MARKET_POLL_MS);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [warnings, setWarnings] = useState<string[]>([]);
  const latestPrices = useRef<Record<string, number>>({});
  const requestInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (requestInFlight.current) return;
    requestInFlight.current = true;
    setRefreshing(true);

    try {
      const response = await fetch(
        `/api/market/realtime?symbols=${encodeURIComponent(
          MARKET_SYMBOLS.join(","),
        )}&provider=alphavantage&strict=true&persist=false`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as MarketApiResponse;

      if (!response.ok) {
        throw new Error(
          data.detail || data.error || `Alpha Vantage market route returned HTTP ${response.status}.`,
        );
      }

      const received = Array.isArray(data.snapshots)
        ? data.snapshots.filter((snapshot) => snapshot.provider === "Alpha Vantage")
        : [];

      if (!received.length) {
        throw new Error("Alpha Vantage returned no usable homepage quotes.");
      }

      const now = Date.now();
      const nextMovement: PriceMovement = {};

      for (const snapshot of received) {
        const prior = latestPrices.current[snapshot.symbol];
        nextMovement[snapshot.symbol] =
          prior === undefined || prior === snapshot.price
            ? "flat"
            : snapshot.price > prior
              ? "up"
              : "down";
        latestPrices.current[snapshot.symbol] = snapshot.price;
      }

      setMovement((current) => ({ ...current, ...nextMovement }));
      setHistory((current) => {
        const next: PriceHistory = { ...current };

        for (const snapshot of received) {
          const existing = [...(current[snapshot.symbol] ?? [])];

          if (!existing.length && snapshot.previousClose && snapshot.previousClose > 0) {
            existing.push({
              price: snapshot.previousClose,
              at: now - Math.max(data.pollAfterMs ?? DEFAULT_MARKET_POLL_MS, 60_000),
            });
          }

          existing.push({ price: snapshot.price, at: now });
          next[snapshot.symbol] = existing.slice(-42);
        }

        return next;
      });
      setSnapshots(received);
      setGeneratedAt(data.generatedAt ?? new Date().toISOString());
      setWarnings(Array.isArray(data.warnings) ? data.warnings : []);
      setPollMs(
        clamp(
          Math.round(data.pollAfterMs ?? DEFAULT_MARKET_POLL_MS),
          15_000,
          120_000,
        ),
      );
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The strict Alpha Vantage market feed is temporarily unavailable.",
      );
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, pollMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refresh();
    };

    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [pollMs, refresh]);

  const stats = useMemo(() => {
    const usable = snapshots.filter((snapshot) => snapshot.price > 0);
    const advancers = usable.filter((snapshot) => (snapshot.changePercent ?? 0) > 0);
    const decliners = usable.filter((snapshot) => (snapshot.changePercent ?? 0) < 0);
    const realtime = usable.filter(
      (snapshot) => snapshot.isRealtime && snapshot.marketState === "Live",
    );
    const quality = usable.length
      ? usable.reduce((sum, snapshot) => sum + (snapshot.qualityScore ?? 0), 0) /
        usable.length
      : 0;
    const topMover = [...usable].sort(
      (left, right) =>
        Math.abs(right.changePercent ?? 0) - Math.abs(left.changePercent ?? 0),
    )[0];

    return {
      usableCount: usable.length,
      advancers: advancers.length,
      decliners: decliners.length,
      realtimeCount: realtime.length,
      breadth: usable.length ? (advancers.length / usable.length) * 100 : 0,
      averageQuality: quality,
      topMover,
    };
  }, [snapshots]);

  return {
    snapshots,
    history,
    movement,
    generatedAt,
    pollMs,
    loading,
    refreshing,
    error,
    warnings,
    refresh,
    stats,
  };
}

function useAlphaDetail(symbol: string) {
  const [detail, setDetail] = useState<AlphaDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const requestSequence = useRef(0);

  const refresh = useCallback(async () => {
    const requestId = requestSequence.current + 1;
    requestSequence.current = requestId;

    if (!DETAIL_SYMBOLS.has(symbol)) {
      setDetail(null);
      setLoading(false);
      setError("Intraday detail is available for the equity and ETF symbols in this board.");
      return;
    }

    setLoading(true);

    try {
      const response = await fetch(
        `/api/intelligence/alpha-vantage?symbol=${encodeURIComponent(symbol)}&interval=5min`,
        { cache: "no-store" },
      );
      const data = (await response.json()) as AlphaDetailResponse;

      if (!response.ok || data.ok === false) {
        throw new Error(data.error || `Alpha Vantage detail returned HTTP ${response.status}.`);
      }

      if (requestId !== requestSequence.current) return;

      setDetail(data);
      setError("");
    } catch (caught) {
      if (requestId !== requestSequence.current) return;

      setError(
        caught instanceof Error
          ? caught.message
          : "Alpha Vantage intraday detail is temporarily unavailable.",
      );
    } finally {
      if (requestId === requestSequence.current) setLoading(false);
    }
  }, [symbol]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const recommended = clamp(
      detail?.health?.recommendedPollMs ?? 300_000,
      300_000,
      900_000,
    );
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refresh();
    }, recommended);

    return () => window.clearInterval(interval);
  }, [detail?.health?.recommendedPollMs, refresh]);

  return { detail, loading, error, refresh };
}

function usePublicIntelligence() {
  const [snapshot, setSnapshot] =
    useState<PublicIntelligenceSnapshot>(() =>
      normalizeIntelligence({}),
    );
  const [loading, setLoading] =
    useState(true);
  const [refreshing, setRefreshing] =
    useState(false);
  const [error, setError] =
    useState("");
  const requestInFlight = useRef(false);

  const refresh = useCallback(async () => {
    if (requestInFlight.current) return;

    requestInFlight.current = true;
    setRefreshing(true);

    try {
      const response = await fetch(
        `/api/intelligence/daily?limit=${PUBLIC_INTELLIGENCE_ARTICLE_LIMIT}`,
        {
          cache: "default",
          headers: {
            Accept: "application/json",
          },
        },
      );

      const data =
        (await response.json()) as Partial<PublicIntelligenceSnapshot> & {
          error?: string;
        };

      if (!response.ok) {
        throw new Error(
          data.error ||
            `Public intelligence returned HTTP ${response.status}.`,
        );
      }

      setSnapshot(
        normalizeIntelligence(data),
      );
      setError("");
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "The public intelligence edition is temporarily unavailable.",
      );
    } finally {
      requestInFlight.current = false;
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  /*
   * Load the stored edition once. Do not poll every five minutes and do not
   * launch a new provider scan when another user signs in.
   */
  useEffect(() => {
    void refresh();
  }, [refresh]);

  const sourceHealth = useMemo(() => {
    const online =
      snapshot.sources.filter(
        (source) => source.ok,
      ).length;

    return {
      online,
      total: snapshot.sources.length,
      fetched: snapshot.sources.reduce(
        (sum, source) =>
          sum + source.fetched,
        0,
      ),
    };
  }, [snapshot.sources]);

  return {
    snapshot,
    loading,
    refreshing,
    error,
    refresh,
    sourceHealth,
  };
}

function Section({
  id,
  eyebrow,
  title,
  description,
  children,
  action,
  className,
}: {
  id?: string;
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <section id={id} className={cx("relative scroll-mt-28 py-20 sm:py-24 lg:py-28", className)}>
      <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
        <Reveal className="mb-10 flex flex-col gap-6 lg:mb-14 lg:flex-row lg:items-end lg:justify-between">
          <div className="max-w-4xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/[0.07] px-3 py-1.5 text-[10px] font-black uppercase tracking-[0.22em] text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.08)] backdrop-blur-xl">
              <Sparkles className="h-3.5 w-3.5" />
              {eyebrow}
            </div>
            <h2 className="mt-5 text-balance text-3xl font-black tracking-[-0.05em] text-white sm:text-4xl lg:text-6xl">
              {title}
            </h2>
            <p className="mt-5 max-w-3xl text-base leading-8 text-slate-400 sm:text-lg sm:leading-9">
              {description}
            </p>
          </div>
          {action ? <div className="shrink-0">{action}</div> : null}
        </Reveal>
        {children}
      </div>
    </section>
  );
}

function StateBadge({ snapshot }: { snapshot: MarketSnapshot }) {
  const tone = dataStateTone(snapshot);
  const classes = {
    green: "border-emerald-400/25 bg-emerald-400/10 text-emerald-200",
    blue: "border-sky-400/25 bg-sky-400/10 text-sky-200",
    amber: "border-amber-400/25 bg-amber-400/10 text-amber-200",
    red: "border-rose-400/25 bg-rose-400/10 text-rose-200",
    slate: "border-white/10 bg-white/[0.05] text-slate-300",
  }[tone];

  return (
    <span className={cx("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em]", classes)}>
      <span className={cx("h-1.5 w-1.5 rounded-full", tone === "green" ? "animate-pulse bg-emerald-300" : tone === "red" ? "bg-rose-300" : tone === "amber" ? "bg-amber-300" : tone === "blue" ? "bg-sky-300" : "bg-slate-400")} />
      {snapshot.marketState ?? "Unknown"}
    </span>
  );
}

function AmbientField() {
  const reducedMotion = useReducedMotion();
  const points = useMemo(
    () =>
      Array.from({ length: 28 }, (_, index) => ({
        left: `${(index * 37 + 11) % 100}%`,
        top: `${(index * 53 + 7) % 100}%`,
        size: 2 + (index % 4),
        delay: -((index * 0.47) % 8),
        duration: 6 + (index % 7),
      })),
    [],
  );

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <div className="absolute left-[-18rem] top-[-20rem] h-[48rem] w-[48rem] rounded-full bg-emerald-500/12 blur-[130px]" />
      <div className="absolute right-[-16rem] top-[8%] h-[44rem] w-[44rem] rounded-full bg-cyan-500/[0.07] blur-[150px]" />
      <div className="absolute bottom-[-20rem] left-[24%] h-[46rem] w-[46rem] rounded-full bg-lime-500/[0.06] blur-[150px]" />
      <div className="absolute inset-0 bg-[linear-gradient(rgba(52,211,153,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.022)_1px,transparent_1px)] [background-size:58px_58px] [mask-image:linear-gradient(to_bottom,black,transparent_92%)]" />
      <div className={cx("absolute inset-0 opacity-25", !reducedMotion && "slice-grid-drift")}>
        <svg className="h-full w-full" viewBox="0 0 1600 1000" preserveAspectRatio="xMidYMid slice">
          <defs>
            <linearGradient id="ambient-line" x1="0" x2="1">
              <stop offset="0" stopColor="#10b981" stopOpacity="0" />
              <stop offset="0.5" stopColor="#34d399" stopOpacity="0.45" />
              <stop offset="1" stopColor="#22d3ee" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[140, 300, 470, 660, 830].map((y, index) => (
            <path
              key={y}
              d={`M -100 ${y} C 260 ${y - 170 + index * 13}, 720 ${y + 150 - index * 17}, 1700 ${y - 30}`}
              fill="none"
              stroke="url(#ambient-line)"
              strokeWidth="1"
              strokeDasharray="7 20"
              className={reducedMotion ? undefined : "slice-edge-flow"}
              style={{ animationDelay: `${-index * 1.6}s` }}
            />
          ))}
        </svg>
      </div>
      {points.map((point, index) => (
        <span
          key={index}
          className={cx("absolute rounded-full bg-emerald-300/60 shadow-[0_0_16px_rgba(52,211,153,0.75)]", !reducedMotion && "slice-particle-float")}
          style={{
            left: point.left,
            top: point.top,
            width: point.size,
            height: point.size,
            animationDelay: `${point.delay}s`,
            animationDuration: `${point.duration}s`,
          }}
        />
      ))}
    </div>
  );
}

function Header() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <header className="sticky top-0 z-[80] border-b border-emerald-300/10 bg-[#020705]/84 shadow-[0_12px_40px_rgba(0,0,0,0.22)] backdrop-blur-2xl">
      <div className="mx-auto flex h-[76px] max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-8">
        <Link href="/" prefetch={false} aria-label="Slice home" className="shrink-0">
          <OriginalBrandMark />
        </Link>

        <nav className="hidden items-center gap-1 xl:flex" aria-label="Homepage navigation">
          {NAV_ITEMS.map((item) =>
            item.href.startsWith("#") ? (
              <a
                key={item.label}
                href={item.href}
                className="rounded-xl px-3.5 py-2 text-xs font-black text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
              >
                {item.label}
              </a>
            ) : (
              <Link
                key={item.label}
                href={item.href}
                prefetch={false}
                className="rounded-xl px-3.5 py-2 text-xs font-black text-slate-400 transition hover:bg-white/[0.05] hover:text-white"
              >
                {item.label}
              </Link>
            ),
          )}
        </nav>

        <div className="hidden items-center gap-2 sm:flex">
          <Link
            href="/client-login"
            prefetch={false}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-4 py-2.5 text-xs font-black text-slate-200 transition hover:border-emerald-300/25 hover:bg-emerald-400/[0.08]"
          >
            Client login
          </Link>
          <Link
            href="/founder-login"
            prefetch={false}
            className="group inline-flex items-center gap-2 rounded-xl border border-emerald-300/25 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-900 px-4 py-2.5 text-xs font-black text-white shadow-[0_12px_30px_rgba(5,150,105,0.22)] transition hover:-translate-y-0.5 hover:from-emerald-400 hover:to-emerald-800"
          >
            Founder login
            <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-0.5" />
          </Link>
        </div>

        <button
          type="button"
          onClick={() => setMobileOpen((open) => !open)}
          className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/[0.05] text-white sm:hidden"
          aria-expanded={mobileOpen}
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
        >
          {mobileOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </div>

      <AnimatePresence>
        {mobileOpen ? (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden border-t border-white/10 bg-[#030a07]/96 sm:hidden"
          >
            <div className="grid gap-1 px-4 py-4">
              {NAV_ITEMS.map((item) =>
                item.href.startsWith("#") ? (
                  <a
                    key={item.label}
                    href={item.href}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-black text-slate-300 hover:bg-white/[0.05] hover:text-white"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Link
                    key={item.label}
                    href={item.href}
                    prefetch={false}
                    onClick={() => setMobileOpen(false)}
                    className="rounded-xl px-4 py-3 text-sm font-black text-slate-300 hover:bg-white/[0.05] hover:text-white"
                  >
                    {item.label}
                  </Link>
                ),
              )}
              <div className="mt-3 grid grid-cols-2 gap-2">
                <Link href="/client-login" prefetch={false} className="rounded-xl border border-white/10 bg-white/[0.05] px-3 py-3 text-center text-xs font-black text-white">
                  Client login
                </Link>
                <Link href="/founder-login" prefetch={false} className="rounded-xl bg-emerald-600 px-3 py-3 text-center text-xs font-black text-white">
                  Founder login
                </Link>
              </div>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </header>
  );
}

function MarketTicker({
  snapshots,
  loading,
}: {
  snapshots: MarketSnapshot[];
  loading: boolean;
}) {
  const items = snapshots.length ? [...snapshots, ...snapshots] : [];

  return (
    <div className="relative z-20 overflow-hidden border-b border-emerald-300/10 bg-[#04100b]/88 py-2.5 backdrop-blur-xl">
      {items.length ? (
        <div className="slice-marquee flex min-w-max items-center gap-2 px-2 hover:[animation-play-state:paused]">
          {items.map((snapshot, index) => {
            const positive = (snapshot.changePercent ?? 0) >= 0;
            return (
              <div
                key={`${snapshot.symbol}-${index}`}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-white/[0.035] px-3.5 py-2 shadow-sm"
              >
                <span className="text-[11px] font-black tracking-[0.08em] text-white">
                  {snapshot.symbol}
                </span>
                <span className="tabular-nums text-xs font-bold text-slate-200">
                  {formatCurrency(snapshot.price, snapshot.currency)}
                </span>
                <span className={cx("inline-flex items-center gap-1 tabular-nums text-[10px] font-black", positive ? "text-emerald-300" : "text-rose-300")}>
                  {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {formatPercent(snapshot.changePercent)}
                </span>
                <span className="h-1 w-1 rounded-full bg-emerald-400/50" />
                <span className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-500">
                  Alpha Vantage
                </span>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="mx-auto flex max-w-[1500px] items-center gap-3 px-4 text-xs font-bold text-slate-400 sm:px-6 lg:px-8">
          <RefreshCcw className={cx("h-3.5 w-3.5", loading && "animate-spin")} />
          Connecting to the strict Alpha Vantage market feed. No placeholder prices are being shown.
        </div>
      )}
    </div>
  );
}

function MetricTile({
  icon: Icon,
  label,
  value,
  helper,
}: {
  icon: LucideIcon;
  label: string;
  value: ReactNode;
  helper: string;
}) {
  return (
    <div className="group relative overflow-hidden rounded-2xl border border-white/[0.08] bg-white/[0.04] p-4 shadow-[0_16px_45px_rgba(0,0,0,0.18)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-emerald-300/20 hover:bg-emerald-400/[0.055]">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/55 to-transparent opacity-0 transition group-hover:opacity-100" />
      <Icon className="h-4 w-4 text-emerald-300" />
      <div className="mt-3 text-2xl font-black tracking-[-0.04em] text-white">{value}</div>
      <div className="mt-1 text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{label}</div>
      <div className="mt-2 text-[10px] leading-4 text-slate-600">{helper}</div>
    </div>
  );
}

function HeroSignalMesh({
  market,
  intelligence,
}: {
  market: ReturnType<typeof useAlphaMarket>;
  intelligence: ReturnType<typeof usePublicIntelligence>;
}) {
  const reducedMotion = useReducedMotion();
  const leading = market.snapshots.slice(0, 5);
  const topStory = intelligence.snapshot.items[0];
  const orbitNodes = [
    { x: 18, y: 21, label: leading[0]?.symbol ?? "MARKET", icon: ChartCandlestick },
    { x: 78, y: 18, label: "NEWS", icon: Newspaper },
    { x: 88, y: 55, label: "CLIENT", icon: UsersRound },
    { x: 67, y: 84, label: "RISK", icon: ShieldCheck },
    { x: 18, y: 78, label: "WORKFLOW", icon: Workflow },
    { x: 8, y: 48, label: "PORTFOLIO", icon: PieChart },
  ];

  return (
    <div className="relative mx-auto aspect-[1.04/1] w-full max-w-[650px] overflow-hidden rounded-[2.5rem] border border-emerald-300/15 bg-[#030b08]/88 shadow-[0_35px_120px_rgba(0,0,0,0.46),0_0_80px_rgba(16,185,129,0.08)] backdrop-blur-2xl">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(16,185,129,0.13),transparent_43%),linear-gradient(rgba(52,211,153,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.028)_1px,transparent_1px)] [background-size:auto,34px_34px,34px_34px]" />
      <div className="absolute inset-6 rounded-[2rem] border border-emerald-300/10" />
      <div className={cx("absolute left-1/2 top-1/2 h-[64%] w-[64%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-emerald-300/15", !reducedMotion && "slice-orbit-slow")} />
      <div className={cx("absolute left-1/2 top-1/2 h-[42%] w-[42%] -translate-x-1/2 -translate-y-1/2 rounded-full border border-dashed border-cyan-300/15", !reducedMotion && "slice-orbit-reverse")} />

      <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
        <defs>
          <linearGradient id="hero-path" x1="0" x2="1">
            <stop offset="0" stopColor="#34d399" stopOpacity="0.15" />
            <stop offset="0.5" stopColor="#6ee7b7" stopOpacity="0.9" />
            <stop offset="1" stopColor="#22d3ee" stopOpacity="0.15" />
          </linearGradient>
          <filter id="hero-glow">
            <feGaussianBlur stdDeviation="0.8" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>
        {orbitNodes.map((node, index) => {
          const path = `M 50 50 Q ${50 + (node.y - 50) * 0.45} ${50 - (node.x - 50) * 0.4} ${node.x} ${node.y}`;
          return (
            <g key={node.label}>
              <path d={path} fill="none" stroke="url(#hero-path)" strokeWidth="0.45" strokeDasharray="2 2.7" className={reducedMotion ? undefined : "slice-edge-flow"} />
              {!reducedMotion ? (
                <circle r="0.75" fill="#a7f3d0" filter="url(#hero-glow)">
                  <animateMotion dur={`${4.5 + index * 0.42}s`} begin={`${index * -0.78}s`} repeatCount="indefinite" path={path} />
                </circle>
              ) : null}
            </g>
          );
        })}
      </svg>

      <div className="absolute left-1/2 top-1/2 z-20 flex h-36 w-36 -translate-x-1/2 -translate-y-1/2 flex-col items-center justify-center rounded-full border border-emerald-300/25 bg-gradient-to-br from-emerald-400/25 via-emerald-700/35 to-[#020604] text-center shadow-[0_0_80px_rgba(16,185,129,0.24)] backdrop-blur-2xl">
        <div className="absolute inset-2 rounded-full border border-white/10" />
        <BrainCircuit className="relative h-7 w-7 text-emerald-200" />
        <div className="relative mt-2 text-sm font-black text-white">Slice Core</div>
        <div className="relative mt-1 text-[8px] font-black uppercase tracking-[0.18em] text-emerald-300">Evidence joined</div>
        {!reducedMotion ? <span className="absolute inset-[-9px] rounded-full border border-emerald-300/20 slice-core-pulse" /> : null}
      </div>

      {orbitNodes.map((node, index) => {
        const Icon = node.icon;
        return (
          <motion.div
            key={node.label}
            className="absolute z-20 -translate-x-1/2 -translate-y-1/2"
            style={{ left: `${node.x}%`, top: `${node.y}%` }}
            animate={reducedMotion ? undefined : { y: [0, index % 2 ? -5 : 5, 0], x: [0, index % 3 ? 3 : -3, 0] }}
            transition={{ duration: 4.5 + index * 0.3, repeat: Infinity, ease: "easeInOut" }}
          >
            <div className="flex min-w-[90px] flex-col items-center rounded-2xl border border-white/10 bg-[#06110c]/92 px-3 py-2.5 text-center shadow-[0_14px_36px_rgba(0,0,0,0.34)] backdrop-blur-xl">
              <Icon className="h-4 w-4 text-emerald-300" />
              <span className="mt-1.5 text-[8px] font-black tracking-[0.13em] text-white">{node.label}</span>
            </div>
          </motion.div>
        );
      })}

      <div className="absolute inset-x-5 bottom-5 z-30 grid gap-2 sm:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">
            <Activity className="h-3 w-3" />
            Provider pulse
          </div>
          <div className="mt-2 flex items-end justify-between gap-3">
            <div>
              <div className="text-lg font-black text-white">{leading[0] ? `${leading[0].symbol} ${formatCurrency(leading[0].price)}` : "Connecting"}</div>
              <div className="mt-1 text-[9px] text-slate-500">{leading[0]?.marketState ?? "Awaiting Alpha Vantage"}</div>
            </div>
            {leading[0] ? <div className={cx("text-sm font-black", (leading[0].changePercent ?? 0) >= 0 ? "text-emerald-300" : "text-rose-300")}>{formatPercent(leading[0].changePercent)}</div> : null}
          </div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/35 p-3 backdrop-blur-xl">
          <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-cyan-300">
            <Newspaper className="h-3 w-3" />
            Daily intelligence
          </div>
          <div className="mt-2 line-clamp-2 text-xs font-black leading-5 text-white">
            {topStory?.title ?? "Cron-scouted articles will appear here."}
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection({
  market,
  intelligence,
}: {
  market: ReturnType<typeof useAlphaMarket>;
  intelligence: ReturnType<typeof usePublicIntelligence>;
}) {
  const topMover = market.stats.topMover;
  const liveLabel = market.stats.realtimeCount
    ? `${market.stats.realtimeCount} live Alpha Vantage instruments`
    : market.snapshots.length
      ? "Provider data connected — session state shown honestly"
      : "Connecting to Alpha Vantage";

  return (
    <section className="relative z-10 overflow-hidden pb-16 pt-14 sm:pb-20 sm:pt-20 lg:pb-28 lg:pt-24">
      <div className="mx-auto grid w-full max-w-[1500px] items-center gap-14 px-4 sm:px-6 lg:grid-cols-[minmax(0,1.02fr)_minmax(520px,0.98fr)] lg:px-8">
        <Reveal>
          <div className="inline-flex flex-wrap items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/[0.075] px-3.5 py-2 text-[10px] font-black uppercase tracking-[0.18em] text-emerald-200 shadow-[0_0_40px_rgba(16,185,129,0.08)] backdrop-blur-xl">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-300 opacity-50" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-emerald-300" />
            </span>
            {liveLabel}
            <span className="h-3 w-px bg-emerald-200/20" />
            <span className="text-slate-400">Daily intelligence mesh active</span>
          </div>

          <h1 className="mt-7 max-w-5xl text-balance text-5xl font-black leading-[0.94] tracking-[-0.066em] text-white sm:text-6xl lg:text-[5.25rem] xl:text-[6.1rem]">
            The connected operating system for a modern
            <span className="block bg-gradient-to-r from-emerald-200 via-emerald-400 to-cyan-300 bg-clip-text text-transparent">
              advisory firm.
            </span>
          </h1>

          <p className="mt-7 max-w-3xl text-base font-medium leading-8 text-slate-400 sm:text-lg sm:leading-9">
            Slice joins real-time market data, sourced research, knowledge graphs,
            portfolios, client relationships, documents, communications, workflows,
            AI agents, and review-first controls in one advisor intelligence platform.
            It is built to show not only <span className="font-bold text-slate-200">what changed</span>,
            but <span className="font-bold text-slate-200">why it matters, who it affects, and what should happen next</span>.
          </p>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Link
              href="/founder-login"
              prefetch={false}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl border border-emerald-300/25 bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-900 px-6 py-4 text-sm font-black text-white shadow-[0_20px_55px_rgba(5,150,105,0.28)] transition duration-300 hover:-translate-y-1 hover:from-emerald-400 hover:to-emerald-800"
            >
              Enter founder command
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/workspace"
              prefetch={false}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-6 py-4 text-sm font-black text-white shadow-[0_18px_45px_rgba(0,0,0,0.2)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-emerald-300/30 hover:bg-emerald-400/[0.09]"
            >
              Explore advisor workspace
              <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <Link
              href="/blog"
              prefetch={false}
              className="group inline-flex items-center justify-center gap-2 rounded-2xl px-5 py-4 text-sm font-black text-slate-300 transition hover:text-emerald-200"
            >
              Read today&apos;s intelligence
              <Newspaper className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-9 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <MetricTile
              icon={ChartCandlestick}
              label="Market instruments"
              value={market.stats.usableCount || "—"}
              helper="Strict Alpha Vantage route"
            />
            <MetricTile
              icon={Activity}
              label="Market breadth"
              value={market.stats.usableCount ? `${market.stats.breadth.toFixed(0)}%` : "—"}
              helper={`${market.stats.advancers} advancing · ${market.stats.decliners} declining`}
            />
            <MetricTile
              icon={Newspaper}
              label="Ranked articles"
              value={intelligence.snapshot.items.length || "—"}
              helper={`${intelligence.sourceHealth.online}/${intelligence.sourceHealth.total || 0} sources online`}
            />
            <MetricTile
              icon={Gauge}
              label="Data quality"
              value={market.stats.usableCount ? `${market.stats.averageQuality.toFixed(0)}/100` : "—"}
              helper={topMover ? `${topMover.symbol} is the largest tracked move` : "Awaiting provider data"}
            />
          </div>

          {(market.error || intelligence.error) ? (
            <div className="mt-5 rounded-2xl border border-amber-400/20 bg-amber-400/[0.07] p-4 text-xs leading-6 text-amber-100/85">
              <div className="flex items-start gap-3">
                <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
                <div>
                  <span className="font-black text-amber-200">Live status:</span>{" "}
                  {market.error || intelligence.error}. Slice preserves the last confirmed response and never substitutes invented market values.
                </div>
              </div>
            </div>
          ) : null}
        </Reveal>

        <Reveal delay={0.12}>
          <HeroSignalMesh market={market} intelligence={intelligence} />
        </Reveal>
      </div>

      <div className="mx-auto mt-14 grid w-full max-w-[1500px] gap-3 px-4 sm:grid-cols-2 sm:px-6 lg:grid-cols-5 lg:px-8">
        {ARCHITECTURE_LAYERS.map((layer, index) => {
          const Icon = layer.icon;
          return (
            <Reveal key={layer.title} delay={index * 0.05}>
              <div className="group h-full rounded-[1.55rem] border border-white/[0.07] bg-[#06100c]/70 p-5 shadow-[0_18px_50px_rgba(0,0,0,0.18)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-emerald-300/20 hover:bg-emerald-400/[0.055]">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-black tracking-[0.2em] text-emerald-300">{layer.number}</span>
                  <Icon className="h-4 w-4 text-emerald-300/80" />
                </div>
                <h3 className="mt-5 text-lg font-black text-white">{layer.title}</h3>
                <p className="mt-3 text-xs leading-6 text-slate-500">{layer.summary}</p>
              </div>
            </Reveal>
          );
        })}
      </div>
    </section>
  );
}

function PlatformDefinitionSection() {
  const pillars = [
    {
      icon: BrainCircuit,
      title: "Advisor intelligence layer",
      eyebrow: "Understand",
      text: "Combines provider-backed market data, sourced news, technical context, macro relationships, portfolio exposure, client needs, and prior firm knowledge into one evidence map.",
      bullets: ["Live and delayed-state transparency", "Source-linked daily research", "Knowledge-graph relationships", "Explainable prioritization"],
    },
    {
      icon: Workflow,
      title: "Advisor operating layer",
      eyebrow: "Execute",
      text: "Moves important context into the actual work of the firm: portfolio reviews, client drafts, meeting preparation, tasks, reminders, documents, approvals, and team routing.",
      bullets: ["Unified workspace", "Client and advisor portals", "Communication center", "Firm planning and queues"],
    },
    {
      icon: ShieldCheck,
      title: "Firm control layer",
      eyebrow: "Govern",
      text: "Keeps permissions, source evidence, human approvals, system health, audit context, retention, and founder-level controls attached to every sensitive workflow.",
      bullets: ["Role separation", "Review-first output", "Operational health", "Founder command access"],
    },
  ];

  return (
    <Section
      id="what-is-slice"
      eyebrow="What Slice is"
      title="More than a dashboard. More than a chatbot. A connected advisor operating system."
      description="Most financial tools stop at data, research, CRM, planning, or communication. Slice is designed as the connective layer between all of them—so information can become controlled, explainable work without losing its source or context."
      className="border-y border-emerald-300/[0.06] bg-[#040a07]/58"
    >
      <div className="grid gap-5 lg:grid-cols-3">
        {pillars.map((pillar, index) => {
          const Icon = pillar.icon;
          return (
            <Reveal key={pillar.title} delay={index * 0.08}>
              <article className="group relative h-full overflow-hidden rounded-[2rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.055] to-white/[0.025] p-7 shadow-[0_28px_80px_rgba(0,0,0,0.22)] backdrop-blur-xl transition duration-300 hover:-translate-y-1.5 hover:border-emerald-300/20">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/50 to-transparent opacity-0 transition group-hover:opacity-100" />
                <div className="flex items-center justify-between gap-4">
                  <div className="grid h-13 w-13 place-items-center rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.08] text-emerald-200 shadow-[0_0_35px_rgba(16,185,129,0.1)]">
                    <Icon className="h-6 w-6" />
                  </div>
                  <span className="text-[9px] font-black uppercase tracking-[0.19em] text-emerald-300/80">{pillar.eyebrow}</span>
                </div>
                <h3 className="mt-7 text-2xl font-black tracking-[-0.035em] text-white">{pillar.title}</h3>
                <p className="mt-4 text-sm leading-7 text-slate-400">{pillar.text}</p>
                <div className="mt-7 space-y-3">
                  {pillar.bullets.map((bullet) => (
                    <div key={bullet} className="flex items-center gap-3 text-xs font-bold text-slate-300">
                      <span className="grid h-5 w-5 place-items-center rounded-full border border-emerald-300/15 bg-emerald-400/[0.08] text-emerald-300">
                        <Check className="h-3 w-3" />
                      </span>
                      {bullet}
                    </div>
                  ))}
                </div>
              </article>
            </Reveal>
          );
        })}
      </div>

      <Reveal className="mt-7">
        <div className="grid gap-5 overflow-hidden rounded-[2rem] border border-emerald-300/10 bg-gradient-to-r from-emerald-500/[0.07] via-[#07110d] to-cyan-500/[0.05] p-6 sm:p-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-center">
          <div>
            <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">The core distinction</div>
            <h3 className="mt-3 text-3xl font-black tracking-[-0.045em] text-white">Every signal retains a path.</h3>
            <p className="mt-4 text-sm leading-7 text-slate-400">
              A market movement can remain connected to the provider timestamp, the related article, the affected portfolio, the relevant client, the generated draft, the approving advisor, and the final recorded action. That path is the foundation for better context, continuity, and control.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {["Signal → evidence", "Evidence → relationship", "Relationship → workflow", "Workflow → human review"].map((item, index) => (
              <div key={item} className="relative overflow-hidden rounded-2xl border border-white/[0.08] bg-black/20 p-5">
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-emerald-300/5 via-emerald-300/50 to-transparent" />
                <div className="text-[9px] font-black tracking-[0.18em] text-slate-600">0{index + 1}</div>
                <div className="mt-3 text-sm font-black text-white">{item}</div>
              </div>
            ))}
          </div>
        </div>
      </Reveal>
    </Section>
  );
}

function Sparkline({
  points,
  positive,
  className,
}: {
  points: PricePoint[];
  positive: boolean;
  className?: string;
}) {
  const path = buildSparkPath(points);

  return (
    <svg className={cx("h-[76px] w-full overflow-visible", className)} viewBox="0 0 240 72" preserveAspectRatio="none" aria-label="Observed provider price path">
      <defs>
        <linearGradient id={positive ? "spark-positive" : "spark-negative"} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor={positive ? "#34d399" : "#fb7185"} stopOpacity="0.34" />
          <stop offset="1" stopColor={positive ? "#34d399" : "#fb7185"} stopOpacity="0" />
        </linearGradient>
      </defs>
      {path ? (
        <>
          <path d={`${path} L240,72 L0,72 Z`} fill={`url(#${positive ? "spark-positive" : "spark-negative"})`} opacity="0.7" />
          <path d={path} fill="none" stroke={positive ? "#6ee7b7" : "#fda4af"} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
          <circle cx="238" cy={path.split(" ").at(-1)?.split(",")[1] ?? "36"} r="2.6" fill={positive ? "#a7f3d0" : "#fecdd3"} />
        </>
      ) : (
        <path d="M0 40 L240 40" fill="none" stroke="#334155" strokeWidth="1" strokeDasharray="4 7" />
      )}
    </svg>
  );
}

function MarketCard({
  snapshot,
  points,
  movement,
  selected,
  onSelect,
}: {
  snapshot: MarketSnapshot;
  points: PricePoint[];
  movement: "up" | "down" | "flat" | undefined;
  selected: boolean;
  onSelect: () => void;
}) {
  const positive = (snapshot.changePercent ?? 0) >= 0;

  return (
    <button
      type="button"
      onClick={onSelect}
      className={cx(
        "group relative min-w-0 overflow-hidden rounded-[1.65rem] border p-5 text-left shadow-[0_18px_55px_rgba(0,0,0,0.2)] backdrop-blur-xl transition duration-300 hover:-translate-y-1",
        selected
          ? "border-emerald-300/30 bg-emerald-400/[0.09] shadow-[0_22px_65px_rgba(5,150,105,0.12)]"
          : "border-white/[0.075] bg-white/[0.038] hover:border-emerald-300/18 hover:bg-white/[0.055]",
      )}
      aria-pressed={selected}
    >
      {movement && movement !== "flat" ? (
        <span
          key={`${snapshot.symbol}:${snapshot.price}:${snapshot.providerTimestamp ?? "unknown"}`}
          aria-hidden="true"
          className={cx(
            "pointer-events-none absolute inset-0 z-0 rounded-[1.65rem]",
            movement === "up" && "slice-price-flash-up",
            movement === "down" && "slice-price-flash-down",
          )}
        />
      ) : null}
      <div className="relative z-10">
      <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-emerald-300/45 to-transparent opacity-0 transition group-hover:opacity-100" />
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-black tracking-[0.03em] text-white">{snapshot.symbol}</span>
            <StateBadge snapshot={snapshot} />
          </div>
          <div className="mt-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-600">{snapshot.assetType ?? "Market asset"}</div>
        </div>
        <div className={cx("flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-black", positive ? "bg-emerald-400/10 text-emerald-300" : "bg-rose-400/10 text-rose-300")}>
          {positive ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
          {formatPercent(snapshot.changePercent)}
        </div>
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
              key={`${snapshot.symbol}-${snapshot.price}`}
              initial={{
                opacity: 0,
                y: movement === "down" ? -8 : 8,
                filter: "blur(4px)",
              }}
              animate={{ opacity: 1, y: 0, filter: "blur(0px)" }}
              exit={{
                opacity: 0,
                y: movement === "down" ? 8 : -8,
                filter: "blur(4px)",
              }}
              transition={{ duration: 0.3, ease: "easeOut" }}
              className="tabular-nums text-2xl font-black tracking-[-0.04em] text-white"
            >
              {formatCurrency(snapshot.price, snapshot.currency)}
            </motion.div>
          </AnimatePresence>
          <div className="mt-1 tabular-nums text-[10px] font-bold text-slate-500">
            {snapshot.change === null || snapshot.change === undefined ? "Change unavailable" : `${snapshot.change >= 0 ? "+" : ""}${snapshot.change.toFixed(2)} today`}
          </div>
        </div>
        <div className="text-right text-[9px] font-black uppercase tracking-[0.13em] text-slate-600">
          <div>{snapshot.provider ?? "Provider"}</div>
          <div className="mt-1">Q {snapshot.qualityScore ?? "—"}</div>
        </div>
      </div>

      <div className="mt-2">
        <Sparkline points={points} positive={positive} />
      </div>

      <div className="mt-2 flex items-center justify-between border-t border-white/[0.06] pt-3 text-[9px] font-bold text-slate-600">
        <span>{formatCompact(snapshot.volume)} volume</span>
        <span>{snapshot.latencyMs === undefined ? "Latency —" : `${snapshot.latencyMs}ms`}</span>
        <span>{relativeTime(snapshot.providerTimestamp)}</span>
      </div>
      </div>
    </button>
  );
}

function IntradayChart({ bars }: { bars: AlphaIntradayBar[] }) {
  const values = [...bars.slice(0, 72)].reverse();
  const closes = values.map((bar) => bar.close).filter(Number.isFinite);
  const volumes = values.map((bar) => bar.volume).filter(Number.isFinite);
  const width = 860;
  const height = 290;
  const priceHeight = 214;

  if (closes.length < 2) {
    return (
      <div className="grid h-[290px] place-items-center rounded-2xl border border-dashed border-white/10 bg-black/20 text-center text-xs font-bold text-slate-500">
        Intraday bars are not available for this symbol or entitlement.
      </div>
    );
  }

  const minimum = Math.min(...closes);
  const maximum = Math.max(...closes);
  const range = Math.max(maximum - minimum, maximum * 0.0005, 0.0001);
  const maxVolume = Math.max(...volumes, 1);
  const path = closes
    .map((value, index) => {
      const x = (index / (closes.length - 1)) * width;
      const y = 16 + (1 - (value - minimum) / range) * (priceHeight - 32);
      return `${index ? "L" : "M"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
  const positive = closes.at(-1)! >= closes[0];

  return (
    <svg className="h-[290px] w-full" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" aria-label="Alpha Vantage intraday price and volume chart">
      <defs>
        <linearGradient id="intraday-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={positive ? "#34d399" : "#fb7185"} stopOpacity="0.28" />
          <stop offset="1" stopColor={positive ? "#34d399" : "#fb7185"} stopOpacity="0" />
        </linearGradient>
        <linearGradient id="intraday-line" x1="0" x2="1">
          <stop offset="0" stopColor={positive ? "#10b981" : "#f43f5e"} />
          <stop offset="0.5" stopColor={positive ? "#a7f3d0" : "#fecdd3"} />
          <stop offset="1" stopColor={positive ? "#22d3ee" : "#fb7185"} />
        </linearGradient>
      </defs>
      {[44, 90, 136, 182].map((y) => (
        <line key={y} x1="0" y1={y} x2={width} y2={y} stroke="#ffffff" strokeOpacity="0.055" strokeDasharray="4 8" />
      ))}
      {volumes.map((volume, index) => {
        const column = width / Math.max(volumes.length, 1);
        const barHeight = (volume / maxVolume) * 52;
        return (
          <rect
            key={`${index}-${volume}`}
            x={index * column + 1}
            y={height - barHeight - 4}
            width={Math.max(column - 2, 1)}
            height={barHeight}
            rx="1"
            fill={positive ? "#34d399" : "#fb7185"}
            fillOpacity="0.18"
          />
        );
      })}
      <path d={`${path} L${width},${priceHeight} L0,${priceHeight} Z`} fill="url(#intraday-fill)" />
      <path d={path} fill="none" stroke="url(#intraday-line)" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
      <circle cx={width - 2} cy={path.split(" ").at(-1)?.split(",")[1] ?? 100} r="4" fill={positive ? "#a7f3d0" : "#fecdd3"} />
    </svg>
  );
}

function LiveMarketSection({ market }: { market: ReturnType<typeof useAlphaMarket> }) {
  const [selectedSymbol, setSelectedSymbol] = useState("SPY");
  const selected =
    market.snapshots.find((snapshot) => snapshot.symbol === selectedSymbol) ??
    market.snapshots[0];
  const activeSymbol = selected?.symbol ?? selectedSymbol;
  const alphaDetail = useAlphaDetail(activeSymbol);
  const detail = alphaDetail.detail;

  useEffect(() => {
    if (
      market.snapshots.length &&
      !market.snapshots.some((snapshot) => snapshot.symbol === selectedSymbol)
    ) {
      setSelectedSymbol(market.snapshots[0].symbol);
    }
  }, [market.snapshots, selectedSymbol]);

  return (
    <Section
      id="live-markets"
      eyebrow="Real-time market command"
      title="Provider-backed movement that is visible, honest, and continuously connected."
      description="The homepage calls Slice’s strict Alpha Vantage route explicitly, observes actual provider changes over time, and supplements the quote board with intraday bars, market status, technical context, latency, quality, and freshness. No synthetic fallback price is displayed as live data."
      action={
        <button
          type="button"
          onClick={() => void market.refresh()}
          disabled={market.refreshing}
          className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.08] px-4 py-3 text-xs font-black text-emerald-100 transition hover:border-emerald-300/35 hover:bg-emerald-400/[0.13] disabled:opacity-50"
        >
          <RefreshCcw className={cx("h-4 w-4", market.refreshing && "animate-spin")} />
          Refresh Alpha Vantage
        </button>
      }
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          icon={CircleDot}
          label="Real-time instruments"
          value={`${market.stats.realtimeCount}/${market.stats.usableCount || 0}`}
          helper="Entitlement and market session determine live state"
        />
        <MetricTile
          icon={TrendingUp}
          label="Advancers"
          value={market.stats.advancers}
          helper={`${market.stats.breadth.toFixed(0)}% of the usable board`}
        />
        <MetricTile
          icon={TrendingDown}
          label="Decliners"
          value={market.stats.decliners}
          helper="Negative session changes in the tracked set"
        />
        <MetricTile
          icon={Clock3}
          label="Refresh cadence"
          value={`${Math.round(market.pollMs / 1000)}s`}
          helper={market.generatedAt ? `Last response ${relativeTime(market.generatedAt)}` : "Waiting for provider"}
        />
      </div>

      {market.warnings.length ? (
        <div className="mt-5 rounded-2xl border border-amber-300/15 bg-amber-400/[0.055] p-4">
          <div className="flex items-start gap-3">
            <BellRing className="mt-0.5 h-4 w-4 shrink-0 text-amber-300" />
            <div>
              <div className="text-xs font-black text-amber-200">Provider notes</div>
              <div className="mt-1 space-y-1 text-[11px] leading-5 text-amber-100/65">
                {market.warnings.slice(0, 3).map((warning) => (
                  <p key={warning}>{warning}</p>
                ))}
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mt-7 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {market.snapshots.map((snapshot) => (
          <MarketCard
            key={snapshot.symbol}
            snapshot={snapshot}
            points={market.history[snapshot.symbol] ?? []}
            movement={market.movement[snapshot.symbol]}
            selected={snapshot.symbol === activeSymbol}
            onSelect={() => setSelectedSymbol(snapshot.symbol)}
          />
        ))}
      </div>

      {!market.snapshots.length ? (
        <div className="mt-7 rounded-[2rem] border border-dashed border-white/10 bg-white/[0.025] p-10 text-center">
          <CloudCog className="mx-auto h-8 w-8 text-emerald-300" />
          <h3 className="mt-4 text-xl font-black text-white">Waiting for the strict Alpha Vantage response</h3>
          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            Confirm that <code className="rounded bg-black/30 px-1.5 py-1 text-emerald-200">ALPHA_VANTAGE_API_KEY</code> is configured in the deployment environment. Real-time US equity labels also require the appropriate Alpha Vantage entitlement.
          </p>
          {market.error ? <p className="mt-4 text-xs font-bold text-amber-300">{market.error}</p> : null}
        </div>
      ) : null}

      {selected ? (
        <Reveal className="mt-7">
          <div className="overflow-hidden rounded-[2.2rem] border border-emerald-300/10 bg-[#050d09]/86 shadow-[0_32px_95px_rgba(0,0,0,0.3)] backdrop-blur-2xl">
            <div className="grid border-b border-white/[0.07] lg:grid-cols-[minmax(0,1.45fr)_minmax(300px,0.55fr)]">
              <div className="p-5 sm:p-7">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="text-2xl font-black text-white">{selected.symbol}</span>
                      <StateBadge snapshot={selected} />
                      <span className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.15em] text-slate-400">
                        {detail?.freshness?.label ?? (selected.isRealtime ? "Provider real-time" : "Provider delayed")}
                      </span>
                    </div>
                    <div className="mt-2 text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                      Alpha Vantage intraday intelligence · {detail?.intraday?.interval ?? "5min"}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => void alphaDetail.refresh()}
                    disabled={alphaDetail.loading}
                    className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-[10px] font-black text-slate-300 transition hover:border-emerald-300/25 hover:text-white"
                  >
                    <RefreshCcw className={cx("h-3.5 w-3.5", alphaDetail.loading && "animate-spin")} />
                    Refresh detail
                  </button>
                </div>

                <div className="mt-6 rounded-2xl border border-white/[0.065] bg-black/20 p-3">
                  {alphaDetail.loading && !detail ? (
                    <div className="grid h-[290px] place-items-center text-xs font-bold text-slate-500">
                      <div className="flex items-center gap-2"><RefreshCcw className="h-4 w-4 animate-spin" /> Loading provider intraday bars</div>
                    </div>
                  ) : (
                    <IntradayChart bars={detail?.intraday?.bars ?? []} />
                  )}
                </div>

                {alphaDetail.error ? (
                  <div className="mt-3 rounded-xl border border-amber-300/15 bg-amber-400/[0.05] px-3 py-2 text-[10px] leading-5 text-amber-200/80">
                    {alphaDetail.error}
                  </div>
                ) : null}
              </div>

              <div className="border-t border-white/[0.07] bg-white/[0.02] p-5 sm:p-7 lg:border-l lg:border-t-0">
                <div className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-300">Selected market context</div>
                <div className="mt-4 grid grid-cols-2 gap-3">
                  {[
                    ["Price", formatCurrency(selected.price, selected.currency)],
                    ["Session move", formatPercent(selected.changePercent)],
                    ["Previous close", selected.previousClose ? formatCurrency(selected.previousClose, selected.currency) : "—"],
                    ["Volume", formatCompact(selected.volume)],
                    ["RSI 14", selected.technicals?.rsi14?.toFixed(1) ?? detail?.technicals?.rsi14?.toFixed(1) ?? "—"],
                    ["30D volatility", selected.technicals?.volatility30d ? `${selected.technicals.volatility30d.toFixed(1)}%` : detail?.technicals?.volatility20Annualized ? `${detail.technicals.volatility20Annualized.toFixed(1)}%` : "—"],
                    ["Quality", `${selected.qualityScore ?? "—"}/100`],
                    ["Latency", selected.latencyMs === undefined ? "—" : `${selected.latencyMs}ms`],
                  ].map(([label, value]) => (
                    <div key={label} className="rounded-xl border border-white/[0.065] bg-black/20 p-3">
                      <div className="text-[8px] font-black uppercase tracking-[0.14em] text-slate-600">{label}</div>
                      <div className="mt-2 truncate text-sm font-black text-white">{value}</div>
                    </div>
                  ))}
                </div>

                <div className="mt-4 rounded-xl border border-emerald-300/10 bg-emerald-400/[0.045] p-4">
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.15em] text-emerald-300">
                    <Activity className="h-3.5 w-3.5" /> Technical read
                  </div>
                  <p className="mt-2 text-xs leading-6 text-slate-400">
                    {detail?.technicals?.technicalSummary ?? selected.technicals?.technicalSummary ?? "Technical history is loading from Alpha Vantage."}
                  </p>
                </div>

                <div className="mt-4 text-[10px] leading-5 text-slate-600">
                  Provider timestamp: <span className="font-bold text-slate-400">{formatTime(selected.providerTimestamp ?? detail?.providerAsOf)}</span>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      ) : null}
    </Section>
  );
}

function KnowledgeGraphExplorer() {
  const reducedMotion = useReducedMotion();
  const [layer, setLayer] = useState<GraphLayer>("all");
  const [selectedId, setSelectedId] = useState("slice-core");
  const selected = GRAPH_NODES.find((node) => node.id === selectedId) ?? GRAPH_NODES[0];
  const SelectedIcon = selected.icon;
  const layerStyles: Record<Exclude<GraphLayer, "all">, { stroke: string; text: string; bg: string; border: string }> = {
    market: { stroke: "#22d3ee", text: "text-cyan-200", bg: "bg-cyan-400/10", border: "border-cyan-300/20" },
    intelligence: { stroke: "#34d399", text: "text-emerald-200", bg: "bg-emerald-400/10", border: "border-emerald-300/20" },
    advisor: { stroke: "#a78bfa", text: "text-violet-200", bg: "bg-violet-400/10", border: "border-violet-300/20" },
    governance: { stroke: "#fbbf24", text: "text-amber-200", bg: "bg-amber-400/10", border: "border-amber-300/20" },
  };
  const visible = (candidate: Exclude<GraphLayer, "all">) => layer === "all" || layer === candidate;

  return (
    <Section
      id="knowledge-graph"
      eyebrow="Living knowledge graph"
      title="Sprawling, intersecting intelligence paths that show how the platform thinks."
      description="The graph is not decorative. It represents the system Slice is building: market observations, sourced articles, agents, portfolios, clients, documents, workflows, communications, firm memory, founder control, and compliance are connected so downstream work can retain its upstream evidence."
      className="border-y border-emerald-300/[0.06] bg-[#030806]/64"
    >
      <div className="mb-5 flex flex-wrap gap-2">
        {(["all", "market", "intelligence", "advisor", "governance"] as GraphLayer[]).map((item) => (
          <button
            key={item}
            type="button"
            onClick={() => setLayer(item)}
            className={cx(
              "rounded-full border px-4 py-2 text-[10px] font-black uppercase tracking-[0.16em] transition",
              layer === item
                ? "border-emerald-300/30 bg-emerald-400/12 text-emerald-100"
                : "border-white/10 bg-white/[0.035] text-slate-500 hover:border-emerald-300/20 hover:text-white",
            )}
          >
            {item === "all" ? "Entire mesh" : item}
          </button>
        ))}
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_350px]">
        <div className="overflow-x-auto rounded-[2.25rem] border border-emerald-300/10 bg-[#030a07]/90 p-3 shadow-[0_35px_110px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-5">
          <div className="relative aspect-[12/7] min-w-[980px] overflow-hidden rounded-[1.75rem] border border-white/[0.06] bg-[radial-gradient(circle_at_50%_48%,rgba(16,185,129,0.1),transparent_38%),linear-gradient(rgba(52,211,153,0.028)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.028)_1px,transparent_1px)] [background-size:auto,38px_38px,38px_38px]">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-500/[0.025] via-transparent to-cyan-500/[0.025]" />
            <svg className="absolute inset-0 h-full w-full" viewBox="0 0 1200 700" aria-hidden="true">
              <defs>
                <filter id="graph-glow">
                  <feGaussianBlur stdDeviation="2.2" result="blur" />
                  <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
                </filter>
              </defs>
              {GRAPH_EDGES.map((edge) => {
                const active = visible(edge.layer);
                const path = graphPath(edge);
                const stroke = layerStyles[edge.layer].stroke;
                return (
                  <g key={edge.id} opacity={active ? 1 : 0.09}>
                    <path d={path} fill="none" stroke={stroke} strokeOpacity={active ? 0.18 : 0.08} strokeWidth="8" filter="url(#graph-glow)" />
                    <path
                      d={path}
                      fill="none"
                      stroke={stroke}
                      strokeOpacity={active ? 0.6 : 0.12}
                      strokeWidth="1.4"
                      strokeDasharray="7 12"
                      className={!reducedMotion && active ? "slice-edge-flow" : undefined}
                      style={{ animationDuration: `${edge.duration}s`, animationDelay: `${edge.delay}s` }}
                    />
                    {!reducedMotion && active ? (
                      <>
                        <circle r="3.2" fill={stroke} filter="url(#graph-glow)">
                          <animateMotion dur={`${edge.duration}s`} begin={`${edge.delay}s`} repeatCount="indefinite" path={path} />
                        </circle>
                        <circle r="1.8" fill="#ecfdf5">
                          <animateMotion dur={`${edge.duration * 1.35}s`} begin={`${edge.delay - 1.3}s`} repeatCount="indefinite" path={path} />
                        </circle>
                      </>
                    ) : null}
                  </g>
                );
              })}
            </svg>

            {GRAPH_NODES.map((node, index) => {
              const Icon = node.icon;
              const style = layerStyles[node.layer];
              const active = visible(node.layer);
              const selectedNode = selected.id === node.id;
              return (
                <motion.button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedId(node.id)}
                  className={cx(
                    "absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3 py-2.5 text-left shadow-[0_14px_40px_rgba(0,0,0,0.35)] backdrop-blur-xl transition duration-300",
                    style.border,
                    style.bg,
                    active ? "opacity-100" : "opacity-25 grayscale",
                    selectedNode ? "scale-110 ring-2 ring-white/20" : "hover:scale-105",
                    node.id === "slice-core" && "min-w-[150px] rounded-[1.75rem] border-emerald-200/35 bg-emerald-500/20 shadow-[0_0_65px_rgba(16,185,129,0.2)]",
                  )}
                  style={{ left: `${(node.x / 1200) * 100}%`, top: `${(node.y / 700) * 100}%` }}
                  animate={reducedMotion || !active ? undefined : { y: [0, index % 2 ? -4 : 4, 0], x: [0, index % 3 ? 2 : -2, 0] }}
                  transition={{ duration: 4.2 + (index % 5) * 0.45, repeat: Infinity, ease: "easeInOut" }}
                  aria-label={`Inspect ${node.label}`}
                >
                  <div className="flex items-center gap-2">
                    <span className={cx("grid h-8 w-8 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/25", style.text)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-[8px] font-black uppercase tracking-[0.13em] text-slate-500">{node.eyebrow}</span>
                      <span className="mt-0.5 block whitespace-nowrap text-[10px] font-black text-white">{node.label}</span>
                    </span>
                  </div>
                  {node.id === "slice-core" && !reducedMotion ? <span className="pointer-events-none absolute inset-[-8px] rounded-[2rem] border border-emerald-300/20 slice-core-pulse" /> : null}
                </motion.button>
              );
            })}

            <div className="absolute bottom-4 left-4 z-30 flex items-center gap-2 rounded-full border border-white/10 bg-black/45 px-3 py-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-400 backdrop-blur-xl">
              <Route className="h-3.5 w-3.5 text-emerald-300" />
              {GRAPH_EDGES.filter((edge) => visible(edge.layer)).length} active paths · {GRAPH_NODES.filter((node) => visible(node.layer)).length} visible nodes
            </div>
          </div>
        </div>

        <Reveal>
          <aside className="sticky top-28 overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.04] p-6 shadow-[0_25px_80px_rgba(0,0,0,0.25)] backdrop-blur-xl">
            <div className="flex items-start justify-between gap-4">
              <div className={cx("grid h-12 w-12 place-items-center rounded-2xl border", layerStyles[selected.layer].border, layerStyles[selected.layer].bg, layerStyles[selected.layer].text)}>
                <SelectedIcon className="h-5 w-5" />
              </div>
              <span className="rounded-full border border-white/10 bg-black/25 px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.16em] text-slate-500">{selected.layer}</span>
            </div>
            <div className="mt-6 text-[9px] font-black uppercase tracking-[0.19em] text-emerald-300">{selected.eyebrow}</div>
            <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-white">{selected.label}</h3>
            <p className="mt-4 text-sm leading-7 text-slate-400">{selected.description}</p>

            <div className="mt-6 grid gap-4">
              <div className="rounded-2xl border border-white/[0.07] bg-black/20 p-4">
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">Inputs</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  {selected.inputs.map((input) => <span key={input} className="rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[9px] font-bold text-slate-300">{input}</span>)}
                </div>
              </div>
              <div className="rounded-2xl border border-emerald-300/10 bg-emerald-400/[0.045] p-4">
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">Outputs</div>
                <div className="mt-3 space-y-2">
                  {selected.outputs.map((output) => (
                    <div key={output} className="flex items-center gap-2 text-[10px] font-bold text-slate-300">
                      <ArrowRight className="h-3 w-3 text-emerald-300" /> {output}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <Link href={selected.href} prefetch={false} className="group mt-6 inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.08] px-4 py-3 text-xs font-black text-emerald-100 transition hover:bg-emerald-400/[0.14]">
              Open connected module
              <ArrowRight className="h-3.5 w-3.5 transition group-hover:translate-x-1" />
            </Link>
          </aside>
        </Reveal>
      </div>
    </Section>
  );
}

function CapabilitySection() {
  const [activeId, setActiveId] = useState<CapabilityGroup["id"]>("intelligence");
  const active = CAPABILITY_GROUPS.find((group) => group.id === activeId) ?? CAPABILITY_GROUPS[0];
  const ActiveIcon = active.icon;

  return (
    <Section
      id="capabilities"
      eyebrow="Platform capabilities"
      title="Everything Slice offers, organized into the four systems an advisory firm actually needs."
      description="The platform is deliberately broad, but the experience is structured. Intelligence explains what matters. Operations turns it into work. Automation removes repetition. Governance keeps that work controlled and reviewable."
    >
      <div className="grid gap-3 md:grid-cols-4">
        {CAPABILITY_GROUPS.map((group) => {
          const Icon = group.icon;
          const activeGroup = group.id === activeId;
          return (
            <button
              key={group.id}
              type="button"
              onClick={() => setActiveId(group.id)}
              className={cx(
                "group flex items-center gap-3 rounded-2xl border p-4 text-left transition duration-300",
                activeGroup
                  ? "border-emerald-300/25 bg-emerald-400/[0.1] shadow-[0_18px_45px_rgba(5,150,105,0.1)]"
                  : "border-white/[0.07] bg-white/[0.035] hover:border-emerald-300/18 hover:bg-white/[0.055]",
              )}
            >
              <span className={cx("grid h-10 w-10 shrink-0 place-items-center rounded-xl border", activeGroup ? "border-emerald-300/20 bg-emerald-400/12 text-emerald-200" : "border-white/10 bg-black/20 text-slate-500 group-hover:text-emerald-300")}>
                <Icon className="h-4.5 w-4.5" />
              </span>
              <span>
                <span className="block text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">System</span>
                <span className={cx("mt-1 block text-xs font-black", activeGroup ? "text-white" : "text-slate-300")}>{group.label}</span>
              </span>
            </button>
          );
        })}
      </div>

      <AnimatePresence mode="wait">
        <motion.div
          key={active.id}
          initial={{ opacity: 0, y: 14 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -10 }}
          transition={{ duration: 0.28 }}
          className="mt-6 overflow-hidden rounded-[2.25rem] border border-white/[0.08] bg-[#050d09]/84 shadow-[0_30px_90px_rgba(0,0,0,0.28)] backdrop-blur-2xl"
        >
          <div className="grid border-b border-white/[0.07] bg-gradient-to-r from-emerald-500/[0.075] via-transparent to-cyan-500/[0.04] p-7 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center lg:gap-6 sm:p-9">
            <div className="grid h-14 w-14 place-items-center rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.09] text-emerald-200">
              <ActiveIcon className="h-6 w-6" />
            </div>
            <div className="mt-5 lg:mt-0">
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">{active.label}</div>
              <h3 className="mt-2 text-3xl font-black tracking-[-0.045em] text-white">{active.title}</h3>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">{active.description}</p>
            </div>
          </div>

          <div className="grid lg:grid-cols-2">
            {active.items.map((item, index) => {
              const Icon = item.icon;
              return (
                <Link
                  key={item.title}
                  href={item.href}
                  prefetch={false}
                  className={cx(
                    "group relative p-6 transition duration-300 hover:bg-emerald-400/[0.045] sm:p-8",
                    index % 2 === 0 ? "lg:border-r lg:border-white/[0.07]" : "",
                    index < 2 ? "border-b border-white/[0.07]" : "",
                  )}
                >
                  <div className="flex items-start gap-4">
                    <span className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-white/[0.04] text-emerald-300 transition group-hover:border-emerald-300/20 group-hover:bg-emerald-400/[0.09]">
                      <Icon className="h-5 w-5" />
                    </span>
                    <div className="min-w-0">
                      <div className="flex items-start justify-between gap-3">
                        <h4 className="text-xl font-black tracking-[-0.03em] text-white">{item.title}</h4>
                        <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-slate-600 transition group-hover:translate-x-1 group-hover:text-emerald-300" />
                      </div>
                      <p className="mt-2 text-sm font-bold leading-6 text-slate-300">{item.description}</p>
                      <p className="mt-3 text-xs leading-6 text-slate-500">{item.detail}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </motion.div>
      </AnimatePresence>

      <Reveal className="mt-7">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {[
            { value: "One", label: "Connected operating layer", text: "Instead of isolated market, CRM, research, email, and workflow surfaces." },
            { value: "Many", label: "Specialized agent paths", text: "Research, risk, client, document, workflow, and governance agents coordinate." },
            { value: "Visible", label: "Evidence and freshness", text: "Sources, provider timestamps, relationships, and review status remain attached." },
            { value: "Human", label: "Final control", text: "The advisor or firm reviewer owns sensitive client-facing decisions and output." },
          ].map((item) => (
            <div key={item.label} className="rounded-[1.6rem] border border-white/[0.07] bg-white/[0.035] p-5">
              <div className="text-2xl font-black tracking-[-0.04em] text-emerald-200">{item.value}</div>
              <div className="mt-2 text-xs font-black text-white">{item.label}</div>
              <p className="mt-2 text-[11px] leading-5 text-slate-500">{item.text}</p>
            </div>
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

function ArticleCard({ article, featured = false }: { article: PublicArticle; featured?: boolean }) {
  const external = safeExternalUrl(article.link);
  const positiveSentiment = (article.sentimentScore ?? 0) >= 0;

  return (
    <article className={cx("group relative flex h-full flex-col overflow-hidden rounded-[1.8rem] border border-white/[0.08] bg-white/[0.04] shadow-[0_22px_65px_rgba(0,0,0,0.2)] backdrop-blur-xl transition duration-300 hover:-translate-y-1 hover:border-emerald-300/20", featured && "lg:col-span-2")}>
      {article.bannerImage ? (
        <div className={cx("relative overflow-hidden border-b border-white/[0.07]", featured ? "h-52 sm:h-64" : "h-40")}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={article.bannerImage} alt="" className="h-full w-full object-cover opacity-55 saturate-75 transition duration-700 group-hover:scale-105 group-hover:opacity-70" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#07100c] via-[#07100c]/35 to-transparent" />
        </div>
      ) : (
        <div className={cx("relative overflow-hidden border-b border-white/[0.07] bg-[radial-gradient(circle_at_30%_30%,rgba(16,185,129,0.2),transparent_45%),linear-gradient(135deg,#07140e,#030806)]", featured ? "h-40" : "h-28")}>
          <div className="slice-route-sweep absolute inset-0 opacity-50" />
          <Newspaper className="absolute bottom-4 left-5 h-7 w-7 text-emerald-300/70" />
        </div>
      )}
      <div className="flex flex-1 flex-col p-5 sm:p-6">
        <div className="flex flex-wrap items-center gap-2">
          <span className={cx("rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.14em]", article.urgency === "Critical" ? "border-rose-300/25 bg-rose-400/10 text-rose-200" : article.urgency === "High" ? "border-amber-300/25 bg-amber-400/10 text-amber-200" : "border-emerald-300/15 bg-emerald-400/[0.07] text-emerald-200")}>{article.urgency}</span>
          <span className="text-[9px] font-black uppercase tracking-[0.13em] text-slate-500">{article.sourceName}</span>
          <span className="text-[9px] font-bold text-slate-600">{relativeTime(article.publishedAt)}</span>
        </div>
        <h3 className={cx("mt-4 font-black tracking-[-0.035em] text-white", featured ? "text-2xl sm:text-3xl" : "text-lg")}>{article.title}</h3>
        <p className={cx("mt-3 line-clamp-3 leading-6 text-slate-500", featured ? "text-sm" : "text-xs")}>{article.summary || "Open the original source for the full article context."}</p>
        <div className="mt-5 flex flex-wrap gap-2">
          {[...article.matchedTickers.slice(0, 3), ...article.matchedThemes.slice(0, 2)].map((tag) => (
            <span key={tag} className="rounded-full border border-white/[0.08] bg-black/20 px-2.5 py-1 text-[8px] font-black text-slate-400">{tag}</span>
          ))}
        </div>
        <div className="mt-auto pt-6">
          <div className="grid grid-cols-3 gap-2 border-t border-white/[0.065] pt-4">
            <div><div className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-600">Score</div><div className="mt-1 text-sm font-black text-white">{article.score}</div></div>
            <div><div className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-600">Sentiment</div><div className={cx("mt-1 text-sm font-black", positiveSentiment ? "text-emerald-300" : "text-rose-300")}>{article.sentimentLabel || "Context"}</div></div>
            <div className="text-right"><div className="text-[8px] font-black uppercase tracking-[0.13em] text-slate-600">Source</div><div className="mt-1 text-[9px] font-black text-slate-300">{article.sourceKind === "alpha-vantage-news" ? "Alpha Vantage" : "Official feed"}</div></div>
          </div>
          {external ? (
            <a href={external} target="_blank" rel="noopener noreferrer" className="mt-4 inline-flex items-center gap-2 text-xs font-black text-emerald-300 transition hover:text-emerald-100">
              Read original source <ExternalLink className="h-3.5 w-3.5" />
            </a>
          ) : null}
        </div>
      </div>
    </article>
  );
}

function DailyIntelligenceSection({
  intelligence,
}: {
  intelligence: ReturnType<
    typeof usePublicIntelligence
  >;
}) {
  const articles =
    intelligence.snapshot.items.slice(
      0,
      PUBLIC_INTELLIGENCE_ARTICLE_LIMIT,
    );

  const editionDate =
    intelligence.snapshot.dateKey ||
    marketDateKey(
      intelligence.snapshot.generatedAt,
    ) ||
    "pending";

  const topTopics =
    intelligence.snapshot.topicCounts.slice(
      0,
      8,
    );

  return (
    <Section
      id="daily-intelligence"
      eyebrow="Six-article daily intelligence"
      title="Six useful market articles, selected once each morning before the advisor arrives."
      description="At 6:00 AM Eastern Time, a protected publisher gathers official market and regulatory feeds plus Alpha Vantage Market News & Sentiment, removes duplicates, ranks relevance and materiality, and stores one fixed six-article edition for the homepage and blog. Page visits only read that completed edition."
      action={
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() =>
              void intelligence.refresh()
            }
            disabled={
              intelligence.refreshing
            }
            className="inline-flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black text-slate-300 transition hover:border-emerald-300/20 hover:text-white"
          >
            <RefreshCcw
              className={cx(
                "h-4 w-4",
                intelligence.refreshing &&
                  "animate-spin",
              )}
            />
            Reload edition
          </button>

          <Link
            href="/blog"
            prefetch={false}
            className="inline-flex items-center gap-2 rounded-2xl border border-emerald-300/20 bg-emerald-400/[0.08] px-4 py-3 text-xs font-black text-emerald-100 transition hover:bg-emerald-400/[0.14]"
          >
            Open blog
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      }
      className="border-y border-emerald-300/[0.06] bg-[#040a07]/58"
    >
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <MetricTile
          icon={Newspaper}
          label="Daily articles"
          value={articles.length || "—"}
          helper={`Six selected at 6:00 AM ET · Edition ${editionDate}`}
        />

        <MetricTile
          icon={Globe2}
          label="Sources online"
          value={`${intelligence.sourceHealth.online}/${intelligence.sourceHealth.total || 0}`}
          helper={`${intelligence.sourceHealth.fetched} raw items evaluated during publication`}
        />

        <MetricTile
          icon={BellRing}
          label="Priority candidates"
          value={
            intelligence.snapshot
              .alertCandidates.length
          }
          helper="Require advisor review before client use"
        />

        <MetricTile
          icon={CalendarClock}
          label="Edition generated"
          value={
            intelligence.snapshot
              .generatedAt &&
            Date.parse(
              intelligence.snapshot
                .generatedAt,
            ) > 0
              ? relativeTime(
                  intelligence.snapshot
                    .generatedAt,
                )
              : "Pending"
          }
          helper={
            intelligence.snapshot
              .refreshCadence
          }
        />
      </div>

      {topTopics.length ? (
        <div className="mt-5 flex flex-wrap items-center gap-2 rounded-2xl border border-white/[0.07] bg-white/[0.03] p-4">
          <span className="mr-2 inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-300">
            <Link2 className="h-3.5 w-3.5" />
            Connected themes
          </span>

          {topTopics.map((topic) => (
            <span
              key={topic.topic}
              className="rounded-full border border-white/[0.08] bg-black/20 px-3 py-1.5 text-[9px] font-bold text-slate-400"
            >
              {topic.topic} · {topic.count}
            </span>
          ))}
        </div>
      ) : null}

      {articles.length ? (
        <div className="mt-7 grid gap-5 lg:grid-cols-3">
          {articles.map(
            (article, index) => (
              <ArticleCard
                key={article.id}
                article={article}
                featured={index === 0}
              />
            ),
          )}
        </div>
      ) : (
        <div className="mt-7 rounded-[2rem] border border-dashed border-white/10 bg-white/[0.025] p-10 text-center">
          <Radar className="mx-auto h-8 w-8 text-emerald-300" />

          <h3 className="mt-4 text-xl font-black text-white">
            The daily edition is waiting
            for its first scheduled
            publication.
          </h3>

          <p className="mx-auto mt-3 max-w-2xl text-sm leading-7 text-slate-500">
            Configure{" "}
            <code className="rounded bg-black/30 px-1.5 py-1 text-emerald-200">
              CRON_SECRET
            </code>
            , the production database, and{" "}
            <code className="rounded bg-black/30 px-1.5 py-1 text-emerald-200">
              ALPHA_VANTAGE_API_KEY
            </code>
            . The protected publisher will
            create the six-article edition
            at 6:00 AM Eastern Time.
          </p>

          {intelligence.error ? (
            <p className="mt-4 text-xs font-bold text-amber-300">
              {intelligence.error}
            </p>
          ) : null}
        </div>
      )}

      <div className="mt-7 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <div className="rounded-[1.8rem] border border-white/[0.08] bg-white/[0.035] p-6">
          <div className="flex items-center gap-3">
            <FileCheck2 className="h-5 w-5 text-emerald-300" />
            <h3 className="text-lg font-black text-white">
              Why an article appears
            </h3>
          </div>

          <div className="mt-5 grid gap-3 sm:grid-cols-2">
            {[
              "Source quality and availability",
              "Publication recency",
              "Ticker and watchlist relevance",
              "Theme and macro relationships",
              "Materiality and urgency",
              "Original source retained",
            ].map((item) => (
              <div
                key={item}
                className="flex items-center gap-3 rounded-xl border border-white/[0.06] bg-black/20 p-3 text-[10px] font-bold text-slate-400"
              >
                <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-300" />
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[1.8rem] border border-white/[0.08] bg-white/[0.035] p-6">
          <div className="flex items-center gap-3">
            <Database className="h-5 w-5 text-cyan-300" />
            <h3 className="text-lg font-black text-white">
              One durable daily edition
            </h3>
          </div>

          <p className="mt-4 text-sm leading-7 text-slate-500">
            The 6:00 AM publisher writes a
            completed batch to Slice’s
            PostgreSQL database. Visitors
            receive the same six selected
            articles throughout the day
            instead of initiating expensive
            source and provider requests. If
            the next publication fails, the
            last confirmed edition remains
            available with its original
            generation time.
          </p>

          <div className="mt-5 flex flex-wrap gap-2 text-[9px] font-black uppercase tracking-[0.13em] text-slate-500">
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
              Six articles
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
              Database backed
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
              Once daily
            </span>
            <span className="rounded-full border border-white/10 bg-black/20 px-3 py-1.5">
              Source linked
            </span>
          </div>
        </div>
      </div>
    </Section>
  );
}

function AgentMeshSection() {
  return (
    <Section
      id="agent-mesh"
      eyebrow="Coordinated AI agents"
      title="Many bounded bot paths. One evidence-linked advisor answer."
      description="Slice is designed around coordinated specialization rather than a single agent attempting every task. Each path can inspect a different part of the problem, challenge assumptions, and return its findings to the central graph before any workflow is proposed."
    >
      <div className="relative overflow-hidden rounded-[2.25rem] border border-emerald-300/10 bg-[#030a07]/88 p-6 shadow-[0_35px_110px_rgba(0,0,0,0.33)] sm:p-8 lg:p-10">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,rgba(16,185,129,0.13),transparent_32%),linear-gradient(rgba(52,211,153,0.022)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.022)_1px,transparent_1px)] [background-size:auto,42px_42px,42px_42px]" />
        <div className="relative grid gap-6 lg:grid-cols-[minmax(0,0.72fr)_minmax(0,1.28fr)] lg:items-center">
          <Reveal>
            <div className="relative mx-auto aspect-square w-full max-w-[440px]">
              <div className="absolute left-1/2 top-1/2 grid h-36 w-36 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full border border-emerald-300/25 bg-emerald-400/[0.12] shadow-[0_0_80px_rgba(16,185,129,0.2)] backdrop-blur-xl">
                <div className="text-center"><BrainCircuit className="mx-auto h-7 w-7 text-emerald-200" /><div className="mt-2 text-sm font-black text-white">Slice Core</div><div className="mt-1 text-[8px] font-black uppercase tracking-[0.15em] text-emerald-300">Join + govern</div></div>
                <span className="pointer-events-none absolute inset-[-10px] rounded-full border border-emerald-300/20 slice-core-pulse" />
              </div>
              <svg className="absolute inset-0 h-full w-full" viewBox="0 0 100 100" aria-hidden="true">
                <defs><linearGradient id="agent-path" x1="0" x2="1"><stop offset="0" stopColor="#22d3ee" stopOpacity="0.1" /><stop offset="0.5" stopColor="#6ee7b7" stopOpacity="0.8" /><stop offset="1" stopColor="#a78bfa" stopOpacity="0.1" /></linearGradient></defs>
                {AGENT_ROLES.map((agent, index) => {
                  const angle = (Math.PI * 2 * index) / AGENT_ROLES.length - Math.PI / 2;
                  const x = 50 + Math.cos(angle) * 39;
                  const y = 50 + Math.sin(angle) * 39;
                  const path = `M 50 50 Q ${50 + Math.sin(angle) * 15} ${50 - Math.cos(angle) * 15} ${x} ${y}`;
                  return (
                    <g key={agent.title}>
                      <path d={path} fill="none" stroke="url(#agent-path)" strokeWidth="0.55" strokeDasharray="2 2.5" className="slice-edge-flow" />
                      <circle r="1" fill="#a7f3d0"><animateMotion dur={`${4.2 + index * 0.28}s`} begin={`${index * -0.65}s`} repeatCount="indefinite" path={path} /></circle>
                    </g>
                  );
                })}
              </svg>
              {AGENT_ROLES.map((agent, index) => {
                const Icon = agent.icon;
                const angle = (Math.PI * 2 * index) / AGENT_ROLES.length - Math.PI / 2;
                const x = 50 + Math.cos(angle) * 39;
                const y = 50 + Math.sin(angle) * 39;
                return (
                  <motion.div key={agent.title} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${x}%`, top: `${y}%` }} animate={{ y: [0, index % 2 ? -4 : 4, 0] }} transition={{ duration: 4 + index * 0.25, repeat: Infinity, ease: "easeInOut" }}>
                    <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-[#07110d]/92 text-emerald-300 shadow-[0_14px_35px_rgba(0,0,0,0.35)] backdrop-blur-xl"><Icon className="h-5 w-5" /></div>
                  </motion.div>
                );
              })}
            </div>
          </Reveal>

          <div className="grid gap-3 sm:grid-cols-2">
            {AGENT_ROLES.map((agent, index) => {
              const Icon = agent.icon;
              return (
                <Reveal key={agent.title} delay={index * 0.035}>
                  <div className="group flex h-full gap-4 rounded-[1.45rem] border border-white/[0.07] bg-white/[0.035] p-4 transition duration-300 hover:-translate-y-1 hover:border-emerald-300/18 hover:bg-emerald-400/[0.05]">
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-white/10 bg-black/20 text-emerald-300"><Icon className="h-4 w-4" /></span>
                    <div><h3 className="text-sm font-black text-white">{agent.title}</h3><p className="mt-2 text-[11px] leading-5 text-slate-500">{agent.text}</p></div>
                  </div>
                </Reveal>
              );
            })}
          </div>
        </div>

        <div className="relative mt-8 grid gap-3 border-t border-white/[0.07] pt-7 sm:grid-cols-3">
          {[
            { icon: Search, title: "Parallel investigation", text: "Different agents inspect different evidence and reduce single-path blind spots." },
            { icon: GitBranch, title: "Graph reconciliation", text: "Findings are joined to shared entities, relationships, prior decisions, and policies." },
            { icon: FileCheck2, title: "Controlled handoff", text: "The result becomes a draft, task, review, alert, scenario, or recorded decision—not an uncontrolled action." },
          ].map((item) => {
            const Icon = item.icon;
            return <div key={item.title} className="rounded-2xl border border-white/[0.065] bg-black/20 p-5"><Icon className="h-4 w-4 text-emerald-300" /><h3 className="mt-3 text-sm font-black text-white">{item.title}</h3><p className="mt-2 text-[11px] leading-5 text-slate-500">{item.text}</p></div>;
          })}
        </div>
      </div>
    </Section>
  );
}

function WorkflowSection() {
  return (
    <Section
      id="workflow"
      eyebrow="Signal-to-action workflow"
      title="A clearer path from market change to controlled advisor execution."
      description="The platform is designed to reduce the distance between noticing something and completing the right work—without removing the source, relationship, permission, or human review that makes the action trustworthy."
      className="border-y border-emerald-300/[0.06] bg-[#040a07]/58"
    >
      <div className="relative">
        <div className="pointer-events-none absolute left-[26px] top-10 hidden h-[calc(100%-80px)] w-px bg-gradient-to-b from-emerald-300/0 via-emerald-300/30 to-emerald-300/0 lg:block" />
        <div className="grid gap-4">
          {WORKFLOW_STEPS.map((step, index) => {
            const Icon = step.icon;
            return (
              <Reveal key={step.step} delay={index * 0.045}>
                <div className="group grid gap-5 rounded-[1.75rem] border border-white/[0.07] bg-white/[0.035] p-5 transition duration-300 hover:border-emerald-300/18 hover:bg-emerald-400/[0.045] lg:grid-cols-[56px_250px_minmax(0,1fr)_160px] lg:items-center lg:p-6">
                  <div className="relative z-10 grid h-13 w-13 place-items-center rounded-2xl border border-emerald-300/18 bg-[#07120d] text-emerald-300 shadow-[0_0_30px_rgba(16,185,129,0.09)]"><Icon className="h-5 w-5" /></div>
                  <div><div className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300">Step {step.step}</div><h3 className="mt-2 text-lg font-black text-white">{step.title}</h3></div>
                  <p className="text-sm leading-7 text-slate-500">{step.text}</p>
                  <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.14em] text-slate-600 lg:justify-end">
                    {index < WORKFLOW_STEPS.length - 1 ? <>Routes forward <ArrowRight className="h-3.5 w-3.5 text-emerald-300" /></> : <><CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" /> Recorded</>}
                  </div>
                </div>
              </Reveal>
            );
          })}
        </div>
      </div>

      <div className="mt-7 grid gap-5 lg:grid-cols-3">
        {[
          { icon: MessageSquareText, title: "Client communication", text: "Create editable, source-aware email and briefing drafts; compare versions; route to approval; queue only the selected output." },
          { icon: CalendarClock, title: "Meeting readiness", text: "Combine recent messages, documents, portfolio changes, open tasks, risk context, and relevant market events into one preparation surface." },
          { icon: FileText, title: "Document-to-workflow", text: "Extract facts and obligations from uploads, connect them to the right client or entity, and create tasks or review queues without losing the original record." },
        ].map((item) => {
          const Icon = item.icon;
          return <Reveal key={item.title}><div className="h-full rounded-[1.75rem] border border-white/[0.08] bg-gradient-to-b from-white/[0.045] to-white/[0.025] p-6"><Icon className="h-5 w-5 text-emerald-300" /><h3 className="mt-5 text-xl font-black text-white">{item.title}</h3><p className="mt-3 text-sm leading-7 text-slate-500">{item.text}</p></div></Reveal>;
        })}
      </div>
    </Section>
  );
}

function AccessAndTrustSection() {
  const portals = [
    { icon: Building2, title: "Founder command", description: "Firm-wide system visibility, team oversight, health, priorities, feature control, and leadership-level operations.", href: "/founder-login", label: "Founder login", accent: "emerald" },
    { icon: BriefcaseBusiness, title: "Advisor workspace", description: "Clients, markets, research, portfolios, drafts, tasks, meetings, documents, alerts, and the personal advisor bot.", href: "/founder-login", label: "Advisor access", accent: "cyan" },
    { icon: UsersRound, title: "Client portal", description: "Assigned-advisor relationship, secure messages, document intake, meeting access, risk updates, and advisor-reviewed communication.", href: "/client-login", label: "Client login", accent: "violet" },
  ];
  const controls = [
    "Real-time, delayed, closed, stale, and unavailable data states are visibly different.",
    "The Alpha Vantage API key stays server-side and is never sent to the browser.",
    "Client-specific or recommendation-like output remains subject to human review.",
    "Original article links, source names, timestamps, and relevance reasons remain attached.",
    "Role-based access separates founder, advisor, firm, and client data and actions.",
    "Scheduled jobs, source health, integration health, and retained editions can be monitored.",
  ];

  return (
    <Section
      id="access"
      eyebrow="Access and trust"
      title="A unified platform experience with clearly separated roles and controls."
      description="Slice can feel like one coherent operating system while still presenting the right information, actions, and review responsibilities to the founder, advisor, firm team, and client."
    >
      <div className="grid gap-5 lg:grid-cols-3">
        {portals.map((portal, index) => {
          const Icon = portal.icon;
          return (
            <Reveal key={portal.title} delay={index * 0.06}>
              <div className="group flex h-full flex-col overflow-hidden rounded-[2rem] border border-white/[0.08] bg-white/[0.04] p-7 shadow-[0_28px_80px_rgba(0,0,0,0.22)] transition duration-300 hover:-translate-y-1 hover:border-emerald-300/20">
                <div className="flex items-center justify-between"><span className="grid h-13 w-13 place-items-center rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.08] text-emerald-200"><Icon className="h-6 w-6" /></span><span className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-600">Role {String(index + 1).padStart(2, "0")}</span></div>
                <h3 className="mt-7 text-2xl font-black tracking-[-0.035em] text-white">{portal.title}</h3>
                <p className="mt-4 flex-1 text-sm leading-7 text-slate-500">{portal.description}</p>
                <Link href={portal.href} prefetch={false} className="group/link mt-7 inline-flex items-center justify-between rounded-2xl border border-emerald-300/15 bg-emerald-400/[0.07] px-4 py-3 text-xs font-black text-emerald-100 transition hover:bg-emerald-400/[0.13]">
                  {portal.label}<ArrowRight className="h-4 w-4 transition group-hover/link:translate-x-1" />
                </Link>
              </div>
            </Reveal>
          );
        })}
      </div>

      <div className="mt-7 grid gap-6 overflow-hidden rounded-[2.2rem] border border-emerald-300/10 bg-gradient-to-br from-[#07130e] via-[#040a07] to-[#06100c] p-6 shadow-[0_32px_100px_rgba(0,0,0,0.3)] sm:p-8 lg:grid-cols-[0.8fr_1.2fr] lg:p-10">
        <Reveal>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-300/15 bg-emerald-400/[0.07] px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-300"><ShieldCheck className="h-3.5 w-3.5" /> Review-first posture</div>
          <h3 className="mt-5 text-3xl font-black tracking-[-0.045em] text-white">Speed without pretending controls do not matter.</h3>
          <p className="mt-4 text-sm leading-7 text-slate-400">The purpose of Slice is not to hide uncertainty or remove the advisor from the decision. It is to make evidence easier to find, relationships easier to understand, repetitive work easier to complete, and sensitive output easier to review.</p>
          <Link href="/security" prefetch={false} className="mt-6 inline-flex items-center gap-2 text-xs font-black text-emerald-300 hover:text-emerald-100">Review the security posture <ArrowRight className="h-4 w-4" /></Link>
        </Reveal>
        <div className="grid gap-3 sm:grid-cols-2">
          {controls.map((control) => <div key={control} className="flex gap-3 rounded-2xl border border-white/[0.07] bg-black/20 p-4"><CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-300" /><p className="text-[11px] leading-6 text-slate-400">{control}</p></div>)}
        </div>
      </div>
    </Section>
  );
}

function FAQSection() {
  const [open, setOpen] = useState(0);

  return (
    <Section
      id="faq"
      eyebrow="Platform questions"
      title="The important answers, stated directly."
      description="These points clarify what the homepage is showing, what depends on deployment configuration, and where the advisor remains in control."
      className="border-y border-emerald-300/[0.06] bg-[#040a07]/58"
    >
      <div className="mx-auto max-w-5xl space-y-3">
        {FAQS.map((item, index) => {
          const active = index === open;
          return (
            <div key={item.question} className={cx("overflow-hidden rounded-[1.5rem] border transition", active ? "border-emerald-300/18 bg-emerald-400/[0.055]" : "border-white/[0.07] bg-white/[0.03]")}>
              <button type="button" onClick={() => setOpen(active ? -1 : index)} className="flex w-full items-center justify-between gap-5 p-5 text-left sm:p-6" aria-expanded={active}>
                <span className="text-sm font-black text-white sm:text-base">{item.question}</span>
                <ChevronDown className={cx("h-4 w-4 shrink-0 text-emerald-300 transition-transform", active && "rotate-180")} />
              </button>
              <AnimatePresence initial={false}>
                {active ? (
                  <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.25 }}>
                    <p className="border-t border-white/[0.06] px-5 py-5 text-sm leading-7 text-slate-400 sm:px-6">{item.answer}</p>
                  </motion.div>
                ) : null}
              </AnimatePresence>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

function FinalCallToAction() {
  return (
    <section className="relative z-10 px-4 py-20 sm:px-6 sm:py-24 lg:px-8 lg:py-28">
      <Reveal className="mx-auto max-w-[1500px]">
        <div className="relative overflow-hidden rounded-[2.5rem] border border-emerald-300/20 bg-gradient-to-br from-emerald-500/20 via-emerald-900/35 to-[#020604] px-6 py-12 shadow-[0_40px_130px_rgba(5,150,105,0.18)] sm:px-10 sm:py-16 lg:px-14">
          <div className="slice-route-sweep absolute inset-0 opacity-65" />
          <div className="pointer-events-none absolute -right-28 -top-28 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
          <div className="relative grid gap-9 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
            <div>
              <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200/20 bg-black/20 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-200"><Sparkles className="h-3.5 w-3.5" /> Slice founder command</div>
              <h2 className="mt-5 max-w-5xl text-balance text-4xl font-black tracking-[-0.055em] text-white sm:text-5xl lg:text-6xl">See the entire platform as one connected system.</h2>
              <p className="mt-5 max-w-3xl text-sm leading-8 text-emerald-50/70 sm:text-base">Enter the founder portal to oversee the workspace, intelligence engines, advisor and client experiences, system health, operations, automation, and firm-wide controls.</p>
            </div>
            <div className="flex min-w-[250px] flex-col gap-3">
              <Link href="/founder-login" prefetch={false} className="group inline-flex items-center justify-center gap-2 rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-950 shadow-xl transition hover:-translate-y-1 hover:bg-emerald-50">Founder login <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" /></Link>
              <Link href="/blog" prefetch={false} className="inline-flex items-center justify-center gap-2 rounded-2xl border border-white/15 bg-black/20 px-6 py-4 text-sm font-black text-white transition hover:bg-white/[0.08]">Today&apos;s intelligence <Newspaper className="h-4 w-4" /></Link>
            </div>
          </div>
        </div>
      </Reveal>
    </section>
  );
}

function Footer() {
  return (
    <footer className="relative z-10 border-t border-emerald-300/[0.08] bg-[#010403]/84 py-10 backdrop-blur-xl">
      <div className="mx-auto grid max-w-[1500px] gap-8 px-4 sm:px-6 lg:grid-cols-[1fr_auto_1fr] lg:items-center lg:px-8">
        <Link href="/" prefetch={false} className="justify-self-start"><OriginalBrandMark /></Link>
        <nav className="flex flex-wrap justify-start gap-x-5 gap-y-3 text-[10px] font-black uppercase tracking-[0.13em] text-slate-500 lg:justify-center">
          <a href="#what-is-slice" className="hover:text-emerald-300">Platform</a>
          <a href="#live-markets" className="hover:text-emerald-300">Markets</a>
          <a href="#knowledge-graph" className="hover:text-emerald-300">Graph</a>
          <Link href="/blog" prefetch={false} className="hover:text-emerald-300">Blog</Link>
          <Link href="/security" prefetch={false} className="hover:text-emerald-300">Security</Link>
          <Link href="/founder-login" prefetch={false} className="hover:text-emerald-300">Founder login</Link>
        </nav>
        <p className="max-w-md text-[9px] font-bold uppercase leading-5 tracking-[0.11em] text-slate-700 lg:justify-self-end lg:text-right">
          Market intelligence and advisor workflow support. Provider state and source evidence should be reviewed before client-specific use.
        </p>
      </div>
    </footer>
  );
}

function HomepageStyles() {
  return (
    <style jsx global>{`
      html {
        background: #010403;
      }

      body {
        background:
          radial-gradient(circle at 15% 0%, rgba(16, 185, 129, 0.11), transparent 30%),
          radial-gradient(circle at 88% 10%, rgba(34, 211, 238, 0.055), transparent 27%),
          linear-gradient(180deg, #010403 0%, #020705 38%, #010403 100%);
      }

      @keyframes slice-marquee {
        from { transform: translate3d(0, 0, 0); }
        to { transform: translate3d(-50%, 0, 0); }
      }

      @keyframes slice-edge-flow {
        from { stroke-dashoffset: 0; }
        to { stroke-dashoffset: -38; }
      }

      @keyframes slice-grid-drift {
        0%, 100% { transform: translate3d(-1.2%, -0.8%, 0) scale(1.03); }
        50% { transform: translate3d(1.2%, 0.8%, 0) scale(1.05); }
      }

      @keyframes slice-particle-float {
        0%, 100% { transform: translate3d(0, 0, 0); opacity: 0.18; }
        40% { opacity: 0.75; }
        50% { transform: translate3d(8px, -24px, 0); opacity: 0.6; }
      }

      @keyframes slice-orbit {
        to { transform: translate(-50%, -50%) rotate(360deg); }
      }

      @keyframes slice-orbit-reverse {
        to { transform: translate(-50%, -50%) rotate(-360deg); }
      }

      @keyframes slice-core-pulse {
        0%, 100% { transform: scale(0.98); opacity: 0.25; }
        50% { transform: scale(1.08); opacity: 0.7; }
      }

      @keyframes slice-price-up {
        0% { box-shadow: 0 0 0 rgba(52, 211, 153, 0); }
        35% { box-shadow: 0 0 45px rgba(52, 211, 153, 0.28); background-color: rgba(16, 185, 129, 0.13); }
        100% { box-shadow: 0 18px 55px rgba(0, 0, 0, 0.2); }
      }

      @keyframes slice-price-down {
        0% { box-shadow: 0 0 0 rgba(251, 113, 133, 0); }
        35% { box-shadow: 0 0 45px rgba(251, 113, 133, 0.24); background-color: rgba(244, 63, 94, 0.11); }
        100% { box-shadow: 0 18px 55px rgba(0, 0, 0, 0.2); }
      }

      @keyframes slice-route-sweep {
        from { background-position: 0 0, 0 0; }
        to { background-position: 110px 70px, -90px 40px; }
      }

      .slice-marquee {
        animation: slice-marquee 48s linear infinite;
      }

      .slice-edge-flow {
        animation: slice-edge-flow 5s linear infinite;
      }

      .slice-grid-drift {
        animation: slice-grid-drift 14s ease-in-out infinite;
      }

      .slice-particle-float {
        animation: slice-particle-float 8s ease-in-out infinite;
      }

      .slice-orbit-slow {
        animation: slice-orbit 28s linear infinite;
      }

      .slice-orbit-reverse {
        animation: slice-orbit-reverse 19s linear infinite;
      }

      .slice-core-pulse {
        animation: slice-core-pulse 2.8s ease-in-out infinite;
      }

      .slice-price-flash-up {
        animation: slice-price-up 1.15s ease-out;
      }

      .slice-price-flash-down {
        animation: slice-price-down 1.15s ease-out;
      }

      .slice-route-sweep {
        background-image:
          radial-gradient(circle, rgba(167, 243, 208, 0.23) 1px, transparent 1.5px),
          linear-gradient(115deg, transparent 0%, rgba(52, 211, 153, 0.08) 48%, transparent 58%);
        background-size: 28px 28px, 220px 100%;
        animation: slice-route-sweep 16s linear infinite;
      }

      @media (prefers-reduced-motion: reduce) {
        .slice-marquee,
        .slice-edge-flow,
        .slice-grid-drift,
        .slice-particle-float,
        .slice-orbit-slow,
        .slice-orbit-reverse,
        .slice-core-pulse,
        .slice-price-flash-up,
        .slice-price-flash-down,
        .slice-route-sweep {
          animation: none !important;
        }
      }
    `}</style>
  );
}

export default function HomePage() {
  const market = useAlphaMarket();
  const intelligence = usePublicIntelligence();

  return (
      <main
        data-slice-color-lock="true"
        data-slice-tone="dark"
        className="relative min-h-screen overflow-hidden bg-[#010403] text-white selection:bg-emerald-400/30 selection:text-white"
      >
      <HomepageStyles />
      <AmbientField />
      <Header />
      <MarketTicker snapshots={market.snapshots} loading={market.loading} />
      <div className="relative z-10">
        <HeroSection market={market} intelligence={intelligence} />
        <PlatformDefinitionSection />
        <LiveMarketSection market={market} />
        <KnowledgeGraphExplorer />
        <CapabilitySection />
        <DailyIntelligenceSection intelligence={intelligence} />
        <AgentMeshSection />
        <WorkflowSection />
        <AccessAndTrustSection />
        <FAQSection />
        <FinalCallToAction />
      </div>
      <Footer />
    </main>
  );
}