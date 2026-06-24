"use client";

import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";

type MainTab =
  | "market"
  | "platform"
  | "mission"
  | "guidelines"
  | "news"
  | "workflow"
  | "clientPortal"
  | "advisorPortal"
  | "compliance"
  | "roadmap";

type LoginRole = {
  label: string;
  title: string;
  href: string;
  helper: string;
  tone: Tone;
  icon: string;
  bullets: string[];
};

type PlatformModule = {
  title: string;
  subtitle: string;
  description: string;
  details: string[];
  href: string;
  tone: Tone;
  icon: string;
};

type MarketSignal = {
  symbol: string;
  company: string;
  sector: string;
  advisorUse: string;
  riskNote: string;
  tone: Tone;
};

type NewsItem = {
  source: string;
  title: string;
  summary: string;
  category: string;
  tone: Tone;
  action: string;
};

type Guideline = {
  title: string;
  description: string;
  tone: Tone;
  icon: string;
};

type WorkflowStep = {
  step: string;
  title: string;
  description: string;
  output: string;
  tone: Tone;
};

type RoadmapItem = {
  title: string;
  detail: string;
  tone: Tone;
};

const LOGIN_LINKS: LoginRole[] = [
  {
    label: "Client Login",
    title: "Client Portal",
    href: "/client-login",
    helper: "For hands-on clients invited by an advisor.",
    tone: "purple",
    icon: "◍",
    bullets: [
      "Email invite access",
      "Risk survey and preferences",
      "Documents and signatures",
      "Advisor message threads",
    ],
  },
  {
    label: "Advisor Login",
    title: "Advisor Command Center",
    href: "/workspace",
    helper: "For advisors managing clients, markets, AI, and review workflows.",
    tone: "cyan",
    icon: "✦",
    bullets: [
      "Advisor workspace",
      "Client portal inbox",
      "TradingView board",
      "AI command layer",
    ],
  },
  {
    label: "Founder Login",
    title: "Founder Control",
    href: "/founder-login",
    helper: "For founder/admin control, oversight, and platform command.",
    tone: "red",
    icon: "S",
    bullets: [
      "Platform oversight",
      "Founder controls",
      "System posture",
      "Build and operations",
    ],
  },
];

const tabConfig: Array<{ id: MainTab; label: string; helper: string; icon: string }> = [
  { id: "market", label: "Live Market Console", helper: "Real-time pricing", icon: "▴" },
  { id: "platform", label: "Platform", helper: "What Slice does", icon: "▦" },
  { id: "mission", label: "Mission", helper: "Why it exists", icon: "◎" },
  { id: "guidelines", label: "Guidelines", helper: "How to use it", icon: "☑" },
  { id: "news", label: "Live News", helper: "Changing intelligence", icon: "◌" },
  { id: "workflow", label: "Workflow", helper: "Daily advisor flow", icon: "↬" },
  { id: "clientPortal", label: "Client Portal", helper: "Client experience", icon: "◍" },
  { id: "advisorPortal", label: "Advisor Portal", helper: "Advisor command", icon: "✦" },
  { id: "compliance", label: "Compliance", helper: "Review gates", icon: "🛡" },
  { id: "roadmap", label: "Roadmap", helper: "Expansion path", icon: "⌖" },
];

const platformModules: PlatformModule[] = [
  {
    title: "Advisor Command Center",
    subtitle: "One operating brain",
    description:
      "The advisor portal combines market intelligence, client profiles, AI drafting, team routing, client portal requests, compliance review, workspace settings, and system health in one command layer.",
    details: [
      "Daily advisor operating home",
      "AI command and workflow routing",
      "Client portal inbox",
      "Review-first client communications",
    ],
    href: "/workspace",
    tone: "red",
    icon: "✦",
  },
  {
    title: "Client Portal",
    subtitle: "High-touch client experience",
    description:
      "Clients can message advisors, submit requests, update risk tolerance through dropdowns, send documents, sign advisor-sent packets, revoke access, and build preferred allocation charts.",
    details: [
      "Email invite signup",
      "Persistent conversations",
      "Document signing demo flow",
      "Risk and allocation preferences",
    ],
    href: "/client-login",
    tone: "purple",
    icon: "◍",
  },
  {
    title: "Client Portal Inbox",
    subtitle: "Advisor intake layer",
    description:
      "Advisor-facing command view for client messages, documents, meeting requests, risk updates, portfolio preferences, buy/sell discussion requests, and team assignment.",
    details: [
      "Client submissions",
      "Team assignment",
      "Firm invite codes",
      "Advisor-review queue",
    ],
    href: "/workspace/client-portal-inbox",
    tone: "purple",
    icon: "☷",
  },
  {
    title: "Custom Advisor Board",
    subtitle: "TradingView + metrics",
    description:
      "A personal market workspace where advisors can search symbols, use TradingView charts, create metric-heavy watchlists, build notification layers, and track client-relevant market movement.",
    details: [
      "TradingView charting",
      "Metric rail customization",
      "Watchlist alerts",
      "Advisor decision support",
    ],
    href: "/workspace/custom-board",
    tone: "cyan",
    icon: "◈",
  },
  {
    title: "Client Communication",
    subtitle: "Draft, review, approve",
    description:
      "Slice supports client emails, client briefings, messages, notes, and advisor-reviewed communication packages with a review-first posture.",
    details: [
      "AI-assisted drafts",
      "Approval-safe sending",
      "Client briefing generation",
      "Message and document context",
    ],
    href: "/workspace/client-emails",
    tone: "green",
    icon: "✉",
  },
  {
    title: "Compliance Guardrails",
    subtitle: "Review layer",
    description:
      "Slice is designed around supervision, recordkeeping, approval gates, and review-first workflows for recommendation language, performance content, testimonials, PII, and client requests.",
    details: [
      "No automatic advice delivery",
      "Books-and-records posture",
      "Marketing and performance review",
      "Client request audit trail",
    ],
    href: "/workspace?tab=compliance",
    tone: "amber",
    icon: "🛡",
  },
  {
    title: "Enhanced Settings",
    subtitle: "Personalized workspace",
    description:
      "Advisors can personalize dark/light appearance, notifications, privacy controls, accessibility, workspace density, assistant behavior, and AI defaults.",
    details: [
      "Dark/red and light/blue modes",
      "Privacy and masking controls",
      "Advisor AI tone",
      "Notification preferences",
    ],
    href: "/workspace/settings",
    tone: "blue",
    icon: "⚙",
  },
  {
    title: "Founder Control",
    subtitle: "Platform oversight",
    description:
      "Founder access gives the platform owner a high-level operating path for oversight, build direction, system management, and future administrative expansion.",
    details: [
      "Founder portal",
      "System command",
      "Build oversight",
      "Platform direction",
    ],
    href: "/founder-login",
    tone: "red",
    icon: "S",
  },
];

const marketSignals: MarketSignal[] = [
  {
    symbol: "SPY",
    company: "S&P 500 ETF",
    sector: "Broad Market",
    advisorUse:
      "Use as a broad equity benchmark for model drift, portfolio review, and client conversation context.",
    riskNote: "Educational until tied to a client-specific recommendation.",
    tone: "green",
  },
  {
    symbol: "QQQ",
    company: "Nasdaq 100 ETF",
    sector: "Growth Technology",
    advisorUse:
      "Monitor growth concentration, overlap, and AI/technology exposure across models and client portfolios.",
    riskNote: "Concentration discussion should be client-context reviewed.",
    tone: "purple",
  },
  {
    symbol: "NVDA",
    company: "NVIDIA",
    sector: "Semiconductors",
    advisorUse:
      "Flag position-size limits, volatility tolerance, tax impact, and client concentration before any discussion.",
    riskNote: "High risk if converted into buy/sell language without review.",
    tone: "red",
  },
  {
    symbol: "TLT",
    company: "20+ Year Treasury ETF",
    sector: "Fixed Income",
    advisorUse:
      "Compare duration exposure against cash-flow needs, retirement income planning, and rate sensitivity.",
    riskNote: "Recommendation requires client-specific review.",
    tone: "amber",
  },
  {
    symbol: "GLD",
    company: "Gold ETF",
    sector: "Real Assets",
    advisorUse:
      "Use as a diversifier discussion for inflation, geopolitical risk, and non-equity ballast.",
    riskNote: "Keep framed as education unless tied to allocation change.",
    tone: "blue",
  },
  {
    symbol: "BTC",
    company: "Bitcoin",
    sector: "Speculative / Digital Assets",
    advisorUse:
      "Use only for education, risk tolerance discussion, speculation limits, and client-specific suitability review.",
    riskNote: "Very high-risk and not appropriate for automated recommendations.",
    tone: "red",
  },
];

const newsItems: NewsItem[] = [
  {
    source: "Slice Market Intelligence",
    title: "Rate sensitivity remains a client-planning priority",
    summary:
      "Fixed income, cash alternatives, duration exposure, and income planning remain important review areas for advisor-client conversations.",
    category: "Planning",
    action: "Review fixed income and client liquidity needs.",
    tone: "amber",
  },
  {
    source: "Slice Advisor Desk",
    title: "AI concentration requires stronger portfolio context",
    summary:
      "Technology exposure, overlapping ETFs, concentrated single-stock positions, and risk tolerance should be reviewed before client-facing recommendations.",
    category: "Portfolio Risk",
    action: "Check overlap, concentration, volatility, and tax impact.",
    tone: "red",
  },
  {
    source: "Slice Compliance Monitor",
    title: "Client portal requests should remain review-first",
    summary:
      "Client-submitted buy or sell requests should be treated as advisor-review intake, not automatic trade instructions.",
    category: "Compliance",
    action: "Route requests into advisor review and retain rationale.",
    tone: "purple",
  },
  {
    source: "Slice Product Feed",
    title: "Client portal improves document and message tracking",
    summary:
      "Persistent threads, document packets, signatures, and advisor assignments make high-touch clients easier to manage.",
    category: "Product",
    action: "Use portal inbox to assign messages and documents.",
    tone: "cyan",
  },
  {
    source: "Slice Research Queue",
    title: "Allocation preference tools help advisors understand client intent",
    summary:
      "Client-built allocation pies can improve discovery, but still require suitability, risk, liquidity, and tax review.",
    category: "Client Experience",
    action: "Use allocation pies as discovery, not instructions.",
    tone: "green",
  },
];

const guidelines: Guideline[] = [
  {
    title: "Use Slice as an operating layer, not a replacement for advisor judgment.",
    description:
      "AI can draft, summarize, organize, and route. Advisors still review, approve, and own client-facing actions.",
    tone: "red",
    icon: "🧠",
  },
  {
    title: "Treat client portal requests as intake, not instructions.",
    description:
      "Client buy/sell requests, permissions, documents, and risk updates should route to advisor review before action.",
    tone: "purple",
    icon: "◍",
  },
  {
    title: "Keep every important decision source-backed.",
    description:
      "Market comments, client briefings, allocation discussions, and reports should retain the reasoning and supporting context.",
    tone: "cyan",
    icon: "▣",
  },
  {
    title: "Use compliance gates before delivery.",
    description:
      "Recommendation language, performance claims, private investment discussions, testimonials, and PII should be reviewed before use.",
    tone: "amber",
    icon: "🛡",
  },
  {
    title: "Use settings to personalize without breaking controls.",
    description:
      "Advisors can customize appearance, notifications, assistant behavior, and privacy defaults while preserving review-first workflows.",
    tone: "blue",
    icon: "⚙",
  },
  {
    title: "Use team assignment to prevent client work from getting lost.",
    description:
      "Client requests, messages, documents, and meeting needs should be assigned to advisor team members with clear ownership.",
    tone: "green",
    icon: "☷",
  },
];

const workflowSteps: WorkflowStep[] = [
  {
    step: "01",
    title: "Scan",
    description:
      "Slice brings market signals, client requests, documents, messages, watchlists, tasks, and pending advisor actions into one place.",
    output: "Advisor sees what changed.",
    tone: "cyan",
  },
  {
    step: "02",
    title: "Prioritize",
    description:
      "Items are grouped by urgency, client relevance, risk, review sensitivity, and advisor action potential.",
    output: "Advisor sees what matters.",
    tone: "blue",
  },
  {
    step: "03",
    title: "Prepare",
    description:
      "AI drafts talking points, meeting prep, client emails, summaries, portfolio explanations, and briefing packages.",
    output: "Advisor receives a draft.",
    tone: "purple",
  },
  {
    step: "04",
    title: "Assign",
    description:
      "Client requests, documents, and messages can be assigned to advisors, client service, portfolio, or compliance team members.",
    output: "Team ownership is clear.",
    tone: "green",
  },
  {
    step: "05",
    title: "Review",
    description:
      "Compliance and advisor review gates flag recommendation language, trade requests, PII, performance, and marketing risks.",
    output: "Advisor or firm approves.",
    tone: "red",
  },
  {
    step: "06",
    title: "Retain",
    description:
      "Prompts, drafts, approvals, sources, final messages, client requests, documents, and decisions remain organized.",
    output: "Firm keeps a defensible record.",
    tone: "amber",
  },
];

const roadmap: RoadmapItem[] = [
  {
    title: "Database-backed client portal",
    detail:
      "Move demo localStorage into Prisma tables for client profiles, invites, risk history, conversations, documents, signatures, and advisor assignments.",
    tone: "purple",
  },
  {
    title: "Secure document storage",
    detail:
      "Wire document packets to encrypted storage with permission controls, version history, and retention policies.",
    tone: "cyan",
  },
  {
    title: "Approved e-signature integration",
    detail:
      "Replace demo signatures with an approved e-sign workflow for regulated document workflows.",
    tone: "green",
  },
  {
    title: "Live data providers",
    detail:
      "Connect approved pricing, fundamentals, news, economic data, alerts, and compliance-reviewed source feeds.",
    tone: "blue",
  },
  {
    title: "Advisor team permissions",
    detail:
      "Build role-based team assignment, client service queues, compliance routing, and task ownership.",
    tone: "amber",
  },
  {
    title: "Firm-branded portal customization",
    detail:
      "Allow each firm to customize logo, colors, copy, onboarding, portal language, and permission workflows.",
    tone: "red",
  },
];

const liveSymbols = [
  { proName: "AMEX:SPY", title: "SPY" },
  { proName: "NASDAQ:QQQ", title: "QQQ" },
  { proName: "NASDAQ:NVDA", title: "NVDA" },
  { proName: "NASDAQ:AAPL", title: "AAPL" },
  { proName: "NASDAQ:MSFT", title: "MSFT" },
  { proName: "AMEX:TLT", title: "TLT" },
  { proName: "AMEX:GLD", title: "GLD" },
  { proName: "TVC:DXY", title: "DXY" },
  { proName: "TVC:US10Y", title: "10Y" },
  { proName: "COINBASE:BTCUSD", title: "BTC" },
];

const tickerTapeConfig = {
  symbols: liveSymbols,
  showSymbolLogo: true,
  isTransparent: true,
  displayMode: "adaptive",
  colorTheme: "dark",
  locale: "en",
};

const marketOverviewConfig = {
  colorTheme: "dark",
  dateRange: "12M",
  showChart: true,
  locale: "en",
  width: "100%",
  height: "660",
  largeChartUrl: "",
  isTransparent: true,
  showSymbolLogo: true,
  showFloatingTooltip: true,
  tabs: [
    {
      title: "Core",
      symbols: [
        { s: "AMEX:SPY", d: "S&P 500 ETF" },
        { s: "NASDAQ:QQQ", d: "Nasdaq 100 ETF" },
        { s: "AMEX:DIA", d: "Dow ETF" },
        { s: "AMEX:IWM", d: "Russell 2000 ETF" },
      ],
    },
    {
      title: "Rates",
      symbols: [
        { s: "TVC:US10Y", d: "US 10Y Yield" },
        { s: "TVC:US02Y", d: "US 2Y Yield" },
        { s: "AMEX:TLT", d: "20+ Year Treasury ETF" },
        { s: "AMEX:SHY", d: "1-3 Year Treasury ETF" },
      ],
    },
    {
      title: "Leaders",
      symbols: [
        { s: "NASDAQ:NVDA", d: "NVIDIA" },
        { s: "NASDAQ:AAPL", d: "Apple" },
        { s: "NASDAQ:MSFT", d: "Microsoft" },
        { s: "NASDAQ:AMZN", d: "Amazon" },
        { s: "NASDAQ:GOOGL", d: "Alphabet" },
      ],
    },
    {
      title: "Real Assets",
      symbols: [
        { s: "AMEX:GLD", d: "Gold ETF" },
        { s: "AMEX:SLV", d: "Silver ETF" },
        { s: "AMEX:VNQ", d: "Real Estate ETF" },
        { s: "TVC:USOIL", d: "Crude Oil" },
      ],
    },
  ],
};

const heroSymbolOverviewConfig = {
  symbols: [
    ["SPY", "AMEX:SPY|1D"],
    ["QQQ", "NASDAQ:QQQ|1D"],
    ["NVDA", "NASDAQ:NVDA|1D"],
  ],
  chartOnly: false,
  width: "100%",
  height: 260,
  locale: "en",
  colorTheme: "dark",
  autosize: true,
  showVolume: false,
  showMA: false,
  hideDateRanges: false,
  hideMarketStatus: false,
  hideSymbolLogo: false,
  scalePosition: "right",
  scaleMode: "Normal",
  fontFamily: "-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif",
  fontSize: "10",
  noTimeScale: false,
  valuesTracking: "1",
  changeMode: "price-and-percent",
  chartType: "area",
  maLineColor: "#2962FF",
  maLineWidth: 1,
  maLength: 9,
  lineWidth: 2,
  lineType: 0,
  dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D", "all|1M"],
};

const timelineConfig = {
  feedMode: "market",
  market: "stock",
  isTransparent: true,
  displayMode: "regular",
  width: "100%",
  height: 540,
  colorTheme: "dark",
  locale: "en",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function tonePanelClass(tone: Tone) {
  const tones: Record<Tone, string> = {
    red: "border-red-500/25 bg-red-500/10 shadow-red-950/20",
    green: "border-emerald-500/25 bg-emerald-500/10 shadow-emerald-950/20",
    amber: "border-amber-500/25 bg-amber-500/10 shadow-amber-950/20",
    purple: "border-purple-500/25 bg-purple-500/10 shadow-purple-950/20",
    blue: "border-blue-500/25 bg-blue-500/10 shadow-blue-950/20",
    cyan: "border-cyan-500/25 bg-cyan-500/10 shadow-cyan-950/20",
    slate: "border-slate-500/20 bg-slate-500/10 shadow-slate-950/20",
  };

  return tones[tone];
}

function dotClass(tone: Tone) {
  const tones: Record<Tone, string> = {
    red: "bg-red-400 shadow-red-400/50",
    green: "bg-emerald-400 shadow-emerald-400/50",
    amber: "bg-amber-400 shadow-amber-400/50",
    purple: "bg-purple-400 shadow-purple-400/50",
    blue: "bg-blue-400 shadow-blue-400/50",
    cyan: "bg-cyan-400 shadow-cyan-400/50",
    slate: "bg-slate-400 shadow-slate-400/50",
  };

  return tones[tone];
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
        "inline-flex max-w-full items-center rounded-full border px-3 py-1.5 text-[10px] font-black uppercase leading-tight tracking-[0.12em] shadow-sm",
        "whitespace-normal break-words text-center sm:whitespace-nowrap",
        tonePanelClass(tone),
      )}
    >
      <span className="min-w-0 break-words">{children}</span>
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative min-w-0 overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/78 shadow-2xl shadow-black/30 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function SoftCard({
  children,
  tone = "slate",
  className = "",
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "relative min-w-0 overflow-hidden rounded-[1.5rem] border p-4 shadow-xl",
        tonePanelClass(tone),
        className,
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b from-white/10 to-transparent" />
      <div className="relative min-w-0">{children}</div>
    </div>
  );
}

function BrandMark({
  label = "Slice",
  subtitle = "Advisor Intelligence Platform",
}: {
  label?: string;
  subtitle?: string;
}) {
  return (
    <div className="flex min-w-0 items-center gap-3">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-zinc-950 to-red-600 shadow-lg shadow-red-950/50 ring-1 ring-red-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
      </div>

      <div className="min-w-0">
        <div className="truncate text-2xl font-black tracking-tight text-white">
          {label}
        </div>
        <div className="line-clamp-2 text-[10px] font-black uppercase leading-snug tracking-[0.22em] text-red-400 sm:truncate">
          {subtitle}
        </div>
      </div>
    </div>
  );
}

function LinkButton({
  href,
  children,
  tone = "red",
  variant = "solid",
  className = "",
}: {
  href: string;
  children: ReactNode;
  tone?: Tone;
  variant?: "solid" | "soft" | "light";
  className?: string;
}) {
  const classNameByVariant =
    variant === "light"
      ? "border border-white/20 bg-white text-slate-950 shadow-lg shadow-red-950/20 hover:bg-red-100 hover:text-slate-950"
      : variant === "solid"
        ? tone === "red"
          ? "border border-red-400/30 bg-gradient-to-r from-red-600 via-red-700 to-red-950 text-white shadow-lg shadow-red-950/40 hover:from-red-500 hover:via-red-700 hover:to-red-900"
          : cx("border text-white shadow-lg hover:scale-[1.01]", tonePanelClass(tone))
        : cx("border text-white shadow-lg hover:scale-[1.01]", tonePanelClass(tone));

  return (
    <a
      href={href}
      className={cx(
        "inline-flex min-w-0 items-center justify-center rounded-2xl px-4 py-3 text-center text-sm font-black leading-tight transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500",
        classNameByVariant,
        className,
      )}
    >
      <span className="relative z-10 min-w-0 whitespace-normal break-words sm:whitespace-nowrap">
        {children}
      </span>
    </a>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        <div className="text-xs font-black uppercase leading-relaxed tracking-[0.2em] text-red-400">
          {eyebrow}
        </div>
        <h2 className="mt-2 max-w-5xl text-2xl font-black tracking-tight text-white md:text-4xl">
          {title}
        </h2>
        <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-400">
          {description}
        </p>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function SliceBackground({ children }: { children: ReactNode }) {
  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-14%] top-[-10%] h-[32rem] w-[32rem] rounded-full bg-red-700/24 blur-3xl" />
        <div className="absolute right-[-12%] top-[12%] h-[34rem] w-[34rem] rounded-full bg-purple-700/12 blur-3xl" />
        <div className="absolute bottom-[-18%] left-[24%] h-[30rem] w-[30rem] rounded-full bg-red-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative">{children}</div>
    </main>
  );
}

function TradingViewWidget({
  id,
  scriptSrc,
  config,
  className = "",
}: {
  id: string;
  scriptSrc: string;
  config: Record<string, unknown>;
  className?: string;
}) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    setIsMounted(false);
    container.innerHTML = "";

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container__widget";
    container.appendChild(widgetContainer);

    const copyright = document.createElement("div");
    copyright.className = "tradingview-widget-copyright sr-only";
    container.appendChild(copyright);

    const script = document.createElement("script");
    script.src = scriptSrc;
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify(config);
    script.onload = () => setIsMounted(true);

    window.setTimeout(() => setIsMounted(true), 900);
    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [id, scriptSrc, config]);

  return (
    <div className={cx("relative min-w-0 overflow-hidden rounded-[1.5rem]", className)}>
      <div
        className={cx(
          "pointer-events-none absolute inset-0 z-0 rounded-[1.5rem] border border-white/10 bg-black/35 transition-opacity duration-700",
          isMounted ? "opacity-0" : "opacity-100",
        )}
      >
        <div className="flex h-full min-h-[120px] items-center justify-center p-5 text-center">
          <div>
            <div className="mx-auto h-8 w-8 animate-pulse rounded-full border border-cyan-500/30 bg-cyan-500/10" />
            <div className="mt-3 text-xs font-black uppercase tracking-[0.18em] text-slate-500">
              Loading live market data
            </div>
          </div>
        </div>
      </div>
      <div
        ref={containerRef}
        id={id}
        className={cx(
          "tradingview-widget-container relative z-10 min-w-0 transition-opacity duration-700",
          isMounted ? "opacity-100" : "opacity-0",
        )}
        suppressHydrationWarning
      />
    </div>
  );
}

function LoginCard({
  label,
  title,
  href,
  helper,
  tone,
  icon,
  bullets,
}: LoginRole) {
  return (
    <a
      href={href}
      className={cx(
        "group relative flex min-h-[310px] min-w-0 flex-col overflow-hidden rounded-[1.65rem] border p-5 shadow-xl transition hover:-translate-y-1 hover:scale-[1.01]",
        tonePanelClass(tone),
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white/10 to-transparent" />
      <div className="relative flex h-full min-w-0 flex-col">
        <div className="flex items-start justify-between gap-4">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/35 text-2xl font-black text-white">
            {icon}
          </div>
          <span className="shrink-0 text-xl transition group-hover:translate-x-1">→</span>
        </div>

        <div className="mt-4 min-w-0">
          <div className="text-[10px] font-black uppercase leading-relaxed tracking-[0.16em] text-slate-400">
            {label}
          </div>
          <div className="mt-1 text-2xl font-black leading-tight text-white">
            {title}
          </div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{helper}</p>
        </div>

        <div className="mt-auto grid gap-2 pt-4">
          {bullets.map((bullet) => (
            <div key={bullet} className="flex min-w-0 items-start gap-2 text-xs font-bold leading-5 text-slate-300">
              <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full shadow", dotClass(tone))} />
              <span className="min-w-0 break-words">{bullet}</span>
            </div>
          ))}
        </div>
      </div>
    </a>
  );
}

function ModuleCard({ module }: { module: PlatformModule }) {
  return (
    <a
      href={module.href}
      className={cx(
        "group relative flex min-h-[390px] min-w-0 flex-col overflow-hidden rounded-[1.75rem] border p-5 shadow-xl transition hover:-translate-y-1 hover:scale-[1.01]",
        tonePanelClass(module.tone),
      )}
    >
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/10 to-transparent" />
      <div className="relative flex h-full min-w-0 flex-col">
        <div className="flex items-start justify-between gap-3">
          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/35 text-xl font-black text-white">
            {module.icon}
          </div>
          <Pill tone={module.tone}>{module.subtitle}</Pill>
        </div>

        <h3 className="mt-4 text-2xl font-black leading-tight tracking-tight text-white">
          {module.title}
        </h3>
        <p className="mt-3 text-sm leading-6 text-slate-300">
          {module.description}
        </p>

        <div className="mt-auto grid gap-2 pt-5">
          {module.details.map((detail) => (
            <div key={detail} className="flex min-w-0 items-start gap-2 text-xs font-bold leading-5 text-slate-300">
              <span className={cx("mt-1.5 h-2 w-2 shrink-0 rounded-full shadow", dotClass(module.tone))} />
              <span className="min-w-0 break-words">{detail}</span>
            </div>
          ))}
        </div>

        <div className="mt-6 inline-flex items-center gap-2 text-sm font-black text-white">
          Open module
          <span className="transition group-hover:translate-x-1">→</span>
        </div>
      </div>
    </a>
  );
}

function HeroMetrics() {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {[
        ["Advisor OS", "Command center", "red", "✦"],
        ["Client Portal", "Hands-on clients", "purple", "◍"],
        ["Live Markets", "TradingView powered", "cyan", "▴"],
        ["Compliance", "Review-first", "amber", "🛡"],
      ].map(([label, value, tone, icon]) => (
        <SoftCard key={label} tone={tone as Tone} className="min-h-[118px]">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-black uppercase leading-relaxed tracking-[0.16em] text-slate-400">
                {label}
              </div>
              <div className="mt-2 text-xl font-black leading-tight text-white md:text-2xl">
                {value}
              </div>
            </div>
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-white/10 bg-black/25 text-lg">
              {icon}
            </div>
          </div>
        </SoftCard>
      ))}
    </div>
  );
}

function MarketTab() {
  return (
    <div className="grid gap-5">
      <Card className="p-0">
        <div className="border-b border-white/10 p-5">
          <SectionHeader
            eyebrow="Real-Time Price Layer"
            title="Live market pricing and advisor context."
            description="The public portal uses TradingView-powered market widgets for live price visibility, while Slice frames market movement as advisor-reviewed context rather than automatic advice."
            action={<LinkButton href="/workspace/custom-board" tone="cyan" variant="soft">Open Custom Board</LinkButton>}
          />
        </div>

        <div className="p-3">
          <TradingViewWidget
            id="slice-ticker-tape"
            scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"
            className="min-h-[84px]"
            config={tickerTapeConfig}
          />
        </div>
      </Card>

      <section className="grid gap-5 2xl:grid-cols-[1.15fr_0.85fr]">
        <Card className="p-5">
          <div className="mb-5 min-w-0">
            <div className="text-xs font-black uppercase leading-relaxed tracking-[0.2em] text-cyan-400">
              Live Market Overview
            </div>
            <h2 className="mt-2 text-3xl font-black leading-tight text-white">
              Watchlists, indexes, rates, leaders, real assets, and crypto context
            </h2>
            <p className="mt-2 text-sm leading-7 text-slate-400">
              This widget updates from TradingView. The advisor workspace can use this context to prepare reviewed client conversations.
            </p>
          </div>

          <TradingViewWidget
            id="slice-market-overview"
            scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js"
            className="min-h-[660px]"
            config={marketOverviewConfig}
          />
        </Card>

        <div className="grid gap-5">
          <Card className="p-5">
            <SectionHeader
              eyebrow="Advisor Signal Context"
              title="Market movement translated into advisor use cases."
              description="These are not live recommendations. They show how Slice turns market movement into advisor-reviewed conversation context."
            />

            <div className="mt-5 grid gap-3">
              {marketSignals.map((signal) => (
                <SoftCard key={signal.symbol} tone={signal.tone}>
                  <div className="flex min-w-0 items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <div className="text-2xl font-black text-white">{signal.symbol}</div>
                        <Pill tone={signal.tone}>{signal.sector}</Pill>
                      </div>
                      <div className="mt-1 text-sm font-bold leading-5 text-slate-400">
                        {signal.company}
                      </div>
                    </div>
                    <span className={cx("mt-2 h-3 w-3 shrink-0 rounded-full shadow-lg", dotClass(signal.tone))} />
                  </div>

                  <p className="mt-4 text-sm leading-6 text-slate-300">
                    {signal.advisorUse}
                  </p>
                  <div className="mt-3 rounded-2xl border border-red-500/20 bg-red-500/10 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-300">
                      Review note
                    </div>
                    <p className="mt-1 text-xs leading-5 text-red-50">
                      {signal.riskNote}
                    </p>
                  </div>
                </SoftCard>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function PlatformTab() {
  return (
    <div className="grid gap-5">
      <SectionHeader
        eyebrow="Platform"
        title="One operating system for modern advisors."
        description="Slice is designed to make the advisor faster, more organized, more responsive, and more defensible — while keeping the advisor in control."
      />

      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
        {platformModules.map((module) => (
          <ModuleCard key={module.title} module={module} />
        ))}
      </div>
    </div>
  );
}

function MissionTab() {
  return (
    <div className="grid gap-5">
      <Card className="p-6">
        <SectionHeader
          eyebrow="Mission"
          title="Make advisors dramatically easier to work with."
          description="The future advisor is not just a portfolio manager. The future advisor is a communicator, coordinator, reviewer, educator, planner, and trusted operating partner. Slice gives that advisor an intelligence center."
        />

        <div className="mt-8 grid gap-4 md:grid-cols-3">
          {[
            ["Clients feel heard", "Messages, requests, documents, risk updates, and preferences stay organized.", "purple", "◍"],
            ["Advisors move faster", "AI helps prepare drafts, summaries, briefings, and next steps.", "cyan", "✦"],
            ["Firms stay safer", "Review gates and records help avoid uncontrolled communication workflows.", "red", "🛡"],
          ].map(([title, description, tone, icon]) => (
            <SoftCard key={title} tone={tone as Tone} className="min-h-[230px]">
              <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-black/25 text-xl">
                {icon}
              </div>
              <h3 className="mt-4 text-xl font-black leading-tight text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
            </SoftCard>
          ))}
        </div>
      </Card>

      <section className="grid gap-5 lg:grid-cols-2">
        <Card className="p-5">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
            Problem
          </div>
          <h3 className="mt-2 text-3xl font-black leading-tight text-white">
            Advisor work is scattered.
          </h3>
          <p className="mt-4 text-sm leading-7 text-slate-400">
            Client emails live in one place. Documents live somewhere else. Market context is
            separate. Compliance is separate. Client requests get buried. Team tasks get lost.
            AI drafts have no workflow. Slice pulls these pieces into one advisor-centered command layer.
          </p>
        </Card>

        <Card className="p-5">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-400">
            Solution
          </div>
          <h3 className="mt-2 text-3xl font-black leading-tight text-white">
            A beautiful command center.
          </h3>
          <p className="mt-4 text-sm leading-7 text-slate-400">
            Slice combines client intake, messaging, risk updates, market boards, AI drafting,
            client briefings, compliance review, firm assignment, and settings into one operating
            system that makes the advisor and client relationship easier to manage.
          </p>
        </Card>
      </section>
    </div>
  );
}

function GuidelinesTab() {
  return (
    <div className="grid gap-5">
      <SectionHeader
        eyebrow="Website Guidelines"
        title="How firms, advisors, clients, and founders should use Slice."
        description="The public portal clearly explains what Slice does, what it does not do, and how users should navigate the platform safely."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {guidelines.map((guideline) => (
          <SoftCard key={guideline.title} tone={guideline.tone} className="min-h-[255px]">
            <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-black/25 text-xl">
              {guideline.icon}
            </div>
            <h3 className="mt-4 text-xl font-black leading-tight text-white">{guideline.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{guideline.description}</p>
          </SoftCard>
        ))}
      </div>

      <Card className="p-5">
        <div className="text-xs font-black uppercase tracking-[0.24em] text-amber-400">
          Confirmed User Paths
        </div>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {LOGIN_LINKS.map((login) => (
            <LoginCard key={login.label} {...login} />
          ))}
        </div>
      </Card>
    </div>
  );
}

function NewsTab({ activeNewsIndex }: { activeNewsIndex: number }) {
  const activeNews = newsItems[activeNewsIndex % newsItems.length];

  return (
    <div className="grid gap-5">
      <Card className="p-5">
        <SectionHeader
          eyebrow="Relevant News & Intelligence"
          title="Auto-rotating advisor intelligence feed."
          description="This section rotates automatically for the demo. In production, wire it to approved news, market, compliance, and firm-specific data sources."
          action={<Pill tone={activeNews.tone}>{activeNews.category}</Pill>}
        />

        <SoftCard tone={activeNews.tone} className="mt-6 min-h-[260px]">
          <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-400">
            {activeNews.source}
          </div>
          <h3 className="mt-2 text-3xl font-black leading-tight text-white">{activeNews.title}</h3>
          <p className="mt-4 text-sm leading-7 text-slate-300">{activeNews.summary}</p>
          <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              Advisor action
            </div>
            <p className="mt-1 text-sm font-bold leading-6 text-white">{activeNews.action}</p>
          </div>
        </SoftCard>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        {newsItems.map((item, index) => (
          <SoftCard key={item.title} tone={item.tone} className={cx("min-h-[230px]", index === activeNewsIndex ? "ring-2 ring-white/30" : "")}>
            <div className="flex min-w-0 items-start justify-between gap-3">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  {item.source}
                </div>
                <h3 className="mt-2 text-xl font-black leading-tight text-white">{item.title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{item.summary}</p>
              </div>
              <div className="shrink-0">
                <Pill tone={item.tone}>{item.category}</Pill>
              </div>
            </div>
          </SoftCard>
        ))}
      </div>

      <Card className="p-5">
        <SectionHeader
          eyebrow="External Market News Widget"
          title="Market news timeline."
          description="TradingView-powered market timeline for automatically changing market context."
        />

        <div className="mt-5">
          <TradingViewWidget
            id="slice-market-news-timeline"
            scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-timeline.js"
            className="min-h-[540px]"
            config={timelineConfig}
          />
        </div>
      </Card>
    </div>
  );
}

function WorkflowTab() {
  return (
    <div className="grid gap-5">
      <SectionHeader
        eyebrow="Workflow"
        title="The daily advisor flow."
        description="Slice is built to reduce scattered work and make the next best advisor action obvious."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {workflowSteps.map((step) => (
          <SoftCard key={step.step} tone={step.tone} className="min-h-[285px]">
            <div className="flex items-start gap-4">
              <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl bg-white text-lg font-black text-slate-950">
                {step.step}
              </div>
              <div className="min-w-0">
                <h3 className="text-xl font-black leading-tight text-white">{step.title}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-300">{step.description}</p>
                <div className="mt-3 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs font-bold leading-5 text-white">
                  {step.output}
                </div>
              </div>
            </div>
          </SoftCard>
        ))}
      </div>
    </div>
  );
}

function ClientPortalTab() {
  return (
    <div className="grid gap-5">
      <SectionHeader
        eyebrow="Client Portal"
        title="A premium portal for hands-on clients."
        description="The client portal gives demanding clients a controlled, beautiful place to communicate, submit documents, update risk preferences, sign packets, and request advisor review without creating chaos."
        action={<LinkButton href="/client-login" tone="purple" variant="soft">Open Client Login</LinkButton>}
      />

      <section className="grid gap-5 xl:grid-cols-[1fr_430px]">
        <Card className="p-5">
          <div className="grid gap-4 md:grid-cols-2">
            {[
              ["Persistent conversations", "Client and advisor messages stay organized in threads that do not disappear.", "purple", "✉"],
              ["Document packets", "Advisors can send documents for client review, demo signature, and return.", "cyan", "▥"],
              ["Dropdown risk survey", "Clients update risk tolerance and preferences without manually typing long responses.", "green", "◎"],
              ["Allocation pie chart", "Clients can express preferred investment-type allocations for advisor discovery.", "amber", "◔"],
              ["Access control", "Clients can remove documents or revoke access in the demo flow.", "red", "🔒"],
              ["Advisor review", "Everything flows back to advisor review, not automatic trade execution.", "blue", "🛡"],
            ].map(([title, description, tone, icon]) => (
              <SoftCard key={title} tone={tone as Tone} className="min-h-[220px]">
                <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-black/25 text-xl">
                  {icon}
                </div>
                <h3 className="mt-4 text-xl font-black leading-tight text-white">{title}</h3>
                <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
              </SoftCard>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <div className="text-xs font-black uppercase tracking-[0.24em] text-purple-400">
            Client Path
          </div>
          <h3 className="mt-2 text-3xl font-black leading-tight text-white">Simple client journey.</h3>

          <div className="mt-5 grid gap-3">
            {[
              ["01", "Advisor sends invite"],
              ["02", "Client enters email"],
              ["03", "Client completes signup"],
              ["04", "Client answers risk dropdowns"],
              ["05", "Client builds allocation pie"],
              ["06", "Advisor reviews everything"],
            ].map(([step, label]) => (
              <div key={step} className="flex min-w-0 items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
                <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white text-sm font-black text-slate-950">
                  {step}
                </div>
                <div className="min-w-0 text-sm font-black leading-5 text-white">{label}</div>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function AdvisorPortalTab() {
  return (
    <div className="grid gap-5">
      <SectionHeader
        eyebrow="Advisor Portal"
        title="The advisor cockpit for clients, markets, AI, and review."
        description="The advisor portal is the operating layer. It gives the advisor a home base to manage client requests, conversations, documents, market boards, AI drafts, settings, team routing, and compliance review."
        action={<LinkButton href="/workspace" tone="cyan" variant="soft">Open Advisor Portal</LinkButton>}
      />

      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-4">
        {[
          ["Client Portal Inbox", "Review and assign all client-submitted portal items.", "/workspace/client-portal-inbox", "purple"],
          ["Custom Board", "TradingView charts, metrics, watchlists, and alert standards.", "/workspace/custom-board", "cyan"],
          ["Email Center", "AI-assisted client email drafts and approval-safe sending.", "/workspace/client-emails", "green"],
          ["Settings", "Dark/light themes, privacy, alerts, AI defaults, and accessibility.", "/workspace/settings", "blue"],
        ].map(([title, description, href, tone]) => (
          <a key={title} href={href} className={cx("flex min-h-[210px] flex-col rounded-[1.5rem] border p-5 shadow-xl transition hover:-translate-y-1", tonePanelClass(tone as Tone))}>
            <h3 className="text-xl font-black leading-tight text-white">{title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
            <div className="mt-auto pt-5 text-sm font-black text-white">Open →</div>
          </a>
        ))}
      </div>
    </div>
  );
}

function ComplianceTab() {
  return (
    <div className="grid gap-5">
      <Card className="p-5">
        <SectionHeader
          eyebrow="Compliance"
          title="Built around review-first workflows."
          description="Slice should help advisors and firms organize, review, and retain work. It should not be positioned as a tool that automatically gives advice, sends recommendations, or executes trades."
        />

        <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {[
            ["Client requests", "Buy/sell requests are treated as advisor-review intake, not automatic orders.", "purple"],
            ["AI output", "AI output remains draft-only until reviewed and approved.", "cyan"],
            ["Performance content", "Performance, projections, and backtests need substantiation and review.", "amber"],
            ["Books and records", "Prompts, drafts, messages, approvals, documents, and rationale should be retained.", "green"],
            ["Marketing", "Testimonials, endorsements, public content, and prospect material require controls.", "red"],
            ["Privacy", "Client data, documents, PII, and portal permissions need secure handling.", "blue"],
          ].map(([title, description, tone]) => (
            <SoftCard key={title} tone={tone as Tone} className="min-h-[215px]">
              <h3 className="text-xl font-black leading-tight text-white">{title}</h3>
              <p className="mt-3 text-sm leading-6 text-slate-300">{description}</p>
            </SoftCard>
          ))}
        </div>
      </Card>
    </div>
  );
}

function RoadmapTab() {
  return (
    <div className="grid gap-5">
      <SectionHeader
        eyebrow="Roadmap"
        title="The path from beautiful demo to production-grade platform."
        description="The portal can look production-grade now. The next step is wiring the underlying workflows to real authentication, databases, file storage, permissions, and approved integrations."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {roadmap.map((item) => (
          <SoftCard key={item.title} tone={item.tone} className="min-h-[210px]">
            <h3 className="text-xl font-black leading-tight text-white">{item.title}</h3>
            <p className="mt-3 text-sm leading-6 text-slate-300">{item.detail}</p>
          </SoftCard>
        ))}
      </div>
    </div>
  );
}

export default function HomePage() {
  const [activeTab, setActiveTab] = useState<MainTab>("market");
  const [activeNewsIndex, setActiveNewsIndex] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveNewsIndex((current) => (current + 1) % newsItems.length);
    }, 7000);

    return () => window.clearInterval(timer);
  }, []);

  const activeTabConfig = useMemo(
    () => tabConfig.find((tab) => tab.id === activeTab) ?? tabConfig[0],
    [activeTab],
  );

  return (
    <SliceBackground>
      <div className="mx-auto grid max-w-[1900px] gap-5 px-3 py-4 sm:px-4 md:px-6 lg:px-8">
        <header className="sticky top-3 z-40 rounded-[1.75rem] border border-white/10 bg-black/70 p-3 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="flex min-w-0 flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <BrandMark />

            <nav className="grid grid-cols-1 gap-2 sm:grid-cols-3 lg:flex lg:flex-wrap lg:items-center">
              <LinkButton href="/client-login" tone="purple" variant="soft" className="w-full px-3 py-2.5 text-xs lg:w-auto">
                Client Login
              </LinkButton>
              <LinkButton href="/workspace" tone="cyan" variant="soft" className="w-full px-3 py-2.5 text-xs lg:w-auto">
                Advisor Login
              </LinkButton>
              <LinkButton href="/founder-login" tone="red" variant="solid" className="w-full px-3 py-2.5 text-xs lg:w-auto">
                Founder Login
              </LinkButton>
            </nav>
          </div>
        </header>

        <section className="relative overflow-hidden rounded-[2.5rem] border border-white/10 bg-black/72 p-5 shadow-2xl shadow-red-950/30 backdrop-blur-xl md:p-8">
          <div className="pointer-events-none absolute right-[-140px] top-[-180px] hidden h-[480px] w-[480px] rounded-full border border-red-500/10 xl:block">
            <div className="absolute inset-12 rounded-full border border-cyan-500/10" />
            <div className="absolute inset-24 rounded-full border border-white/10" />
            <div className="absolute left-24 top-36 h-3 w-3 rounded-full bg-red-400 shadow-lg shadow-red-500/50" />
            <div className="absolute bottom-28 right-24 h-3 w-3 rounded-full bg-cyan-400 shadow-lg shadow-cyan-500/50" />
          </div>

          <div className="relative grid min-w-0 gap-8 xl:grid-cols-[minmax(0,1fr)_560px] xl:items-center">
            <div className="min-w-0">
              <div className="flex flex-wrap gap-2">
                <Pill tone="red">Advisor Intelligence Platform</Pill>
                <Pill tone="cyan">Live Market Layer</Pill>
                <Pill tone="purple">Client Portal</Pill>
                <Pill tone="amber">Review-First</Pill>
              </div>

              <h1 className="mt-6 max-w-6xl text-5xl font-black leading-[0.92] tracking-tight text-white md:text-7xl xl:text-8xl">
                The command center for modern financial advisors.
              </h1>

              <p className="mt-6 max-w-5xl text-base leading-8 text-slate-400 md:text-lg">
                Slice brings advisor workflows, client portal requests, market intelligence,
                TradingView-powered pricing, AI drafting, compliance review, document handling,
                team assignment, risk updates, and client communication into one beautiful operating layer.
              </p>

              <div className="mt-8 grid gap-3 md:grid-cols-3">
                {LOGIN_LINKS.map((login) => (
                  <LoginCard key={login.label} {...login} />
                ))}
              </div>
            </div>

            <div className="grid min-w-0 gap-4">
              <Card className="p-5">
                <div className="flex min-w-0 items-start justify-between gap-4">
                  <div className="min-w-0">
                    <div className="text-xs font-black uppercase leading-relaxed tracking-[0.2em] text-red-400">
                      Public Portal
                    </div>
                    <h2 className="mt-2 text-3xl font-black leading-tight text-white">
                      Everything starts here.
                    </h2>
                    <p className="mt-3 text-sm leading-7 text-slate-400">
                      Clients enter their portal. Advisors enter the command center. The founder
                      enters platform control. This page explains the platform clearly while showing
                      live market context and safe user paths.
                    </p>
                  </div>
                  <div className="grid h-14 w-14 shrink-0 place-items-center rounded-2xl bg-red-600 text-2xl font-black text-white">
                    S
                  </div>
                </div>
              </Card>

              <HeroMetrics />

              <Card className="p-3">
                <TradingViewWidget
                  id="slice-hero-symbol-overview"
                  scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js"
                  className="min-h-[280px]"
                  config={heroSymbolOverviewConfig}
                />
              </Card>
            </div>
          </div>
        </section>

        <Card className="p-0">
          <div className="border-b border-white/10 p-3">
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3 2xl:grid-cols-5">
              {tabConfig.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={cx(
                    "min-h-[76px] rounded-2xl border px-4 py-3 text-left transition",
                    activeTab === tab.id
                      ? "border-white bg-white text-slate-950"
                      : "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.075]",
                  )}
                >
                  <div className="flex min-w-0 items-start gap-2 text-sm font-black leading-tight">
                    <span className="shrink-0">{tab.icon}</span>
                    <span className="min-w-0 break-words">{tab.label}</span>
                  </div>
                  <div
                    className={cx(
                      "mt-1 text-[11px] font-bold leading-4",
                      activeTab === tab.id ? "text-slate-600" : "text-slate-500",
                    )}
                  >
                    {tab.helper}
                  </div>
                </button>
              ))}
            </div>
          </div>

          <div className="p-4 md:p-5">
            <div className="mb-5 flex min-w-0 flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
              <div className="min-w-0">
                <div className="text-xs font-black uppercase leading-relaxed tracking-[0.2em] text-red-400">
                  {activeTabConfig.helper}
                </div>
                <div className="mt-1 text-2xl font-black leading-tight text-white">
                  {activeTabConfig.label}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2 sm:grid-cols-3 xl:flex xl:flex-wrap">
                <LinkButton href="/client-login" tone="purple" variant="soft" className="w-full xl:w-auto">
                  Client Portal
                </LinkButton>
                <LinkButton href="/workspace" tone="cyan" variant="soft" className="w-full xl:w-auto">
                  Advisor Portal
                </LinkButton>
                <LinkButton href="/founder-login" tone="red" variant="solid" className="w-full xl:w-auto">
                  Founder Login
                </LinkButton>
              </div>
            </div>

            {activeTab === "market" ? <MarketTab /> : null}
            {activeTab === "platform" ? <PlatformTab /> : null}
            {activeTab === "mission" ? <MissionTab /> : null}
            {activeTab === "guidelines" ? <GuidelinesTab /> : null}
            {activeTab === "news" ? <NewsTab activeNewsIndex={activeNewsIndex} /> : null}
            {activeTab === "workflow" ? <WorkflowTab /> : null}
            {activeTab === "clientPortal" ? <ClientPortalTab /> : null}
            {activeTab === "advisorPortal" ? <AdvisorPortalTab /> : null}
            {activeTab === "compliance" ? <ComplianceTab /> : null}
            {activeTab === "roadmap" ? <RoadmapTab /> : null}
          </div>
        </Card>

        <footer className="rounded-[2rem] border border-white/10 bg-black/55 p-5 text-center shadow-2xl shadow-black/20 backdrop-blur-xl">
          <div className="flex flex-wrap items-center justify-center gap-2">
            <Pill tone="red">Slice</Pill>
            <Pill tone="cyan">Advisor OS</Pill>
            <Pill tone="purple">Client Portal</Pill>
            <Pill tone="amber">Review First</Pill>
          </div>

          <p className="mx-auto mt-4 max-w-4xl text-xs leading-6 text-slate-500">
            Slice is a workflow, intelligence, communication, and review-support platform for advisors and firms.
            It should not be used to automatically provide investment advice, execute trades, publish marketing content,
            or send client-specific recommendations without appropriate human and firm review.
          </p>
        </footer>
      </div>
    </SliceBackground>
  );
}