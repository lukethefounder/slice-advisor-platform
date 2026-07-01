"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useRef, useState } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";

type MainTab =
  | "command"
  | "markets"
  | "briefing"
  | "platform"
  | "portals"
  | "workflow"
  | "compliance"
  | "production";

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
  marketState?: "Live" | "Delayed" | "Closed" | "Stale" | "Demo";
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
};

type ScoredNewsItem = {
  id: string;
  sourceName: string;
  title: string;
  summary: string;
  link?: string;
  publishedAt?: string;
  score: number;
  urgency: "Critical" | "High" | "Medium" | "Low" | "Suppressed";
  matchedTickers: string[];
  matchedCompanies: string[];
  matchedThemes: string[];
  reasons: string[];
  shouldAlert: boolean;
  channels: Array<"SMS" | "Email" | "Dashboard" | "Digest">;
  complianceLabel: string;
  alertCopy: string;
};

type ScanResponse = {
  scannedAt: string;
  sources: Array<{
    id: string;
    name: string;
    ok: boolean;
    fetched: number;
    paid?: boolean;
    error?: string;
  }>;
  items: ScoredNewsItem[];
  alertCandidates: ScoredNewsItem[];
  digestCandidates: ScoredNewsItem[];
  suppressed: ScoredNewsItem[];
};

type PlatformModule = {
  title: string;
  subtitle: string;
  description: string;
  href: string;
  tone: Tone;
  icon: string;
  proof: string[];
};

type DailyBriefing = {
  headline: string;
  subhead: string;
  generatedAt: string;
  marketRead: string;
  investorImpact: string;
  advisorAction: string;
  complianceNote: string;
  tone: Tone;
  blocks: Array<{
    title: string;
    body: string;
    tone: Tone;
    points: string[];
  }>;
};

type SystemMetric = {
  label: string;
  value: string;
  helper: string;
  tone: Tone;
};

const STATIC_DEMO_TIMESTAMP = "2026-01-01T00:00:00.000Z";
const MARKET_REFRESH_MS = 10_000;
const INTELLIGENCE_REFRESH_MS = 120_000;

const MARKET_SYMBOLS = [
  "SPY",
  "QQQ",
  "AAPL",
  "MSFT",
  "NVDA",
  "TLT",
  "GLD",
  "US10Y",
  "DXY",
  "BTCUSD",
];

const TRADINGVIEW_TICKER_SYMBOLS = [
  { proName: "AMEX:SPY", title: "SPY" },
  { proName: "NASDAQ:QQQ", title: "QQQ" },
  { proName: "NASDAQ:AAPL", title: "AAPL" },
  { proName: "NASDAQ:MSFT", title: "MSFT" },
  { proName: "NASDAQ:NVDA", title: "NVDA" },
  { proName: "AMEX:TLT", title: "TLT" },
  { proName: "AMEX:GLD", title: "GLD" },
  { proName: "TVC:US10Y", title: "10Y" },
  { proName: "TVC:DXY", title: "DXY" },
  { proName: "COINBASE:BTCUSD", title: "BTC" },
];

const TICKER_TAPE_CONFIG = {
  symbols: TRADINGVIEW_TICKER_SYMBOLS,
  showSymbolLogo: true,
  isTransparent: true,
  displayMode: "adaptive",
  colorTheme: "dark",
  locale: "en",
};

const HERO_SYMBOL_OVERVIEW_CONFIG = {
  symbols: [
    ["SPY", "AMEX:SPY|1D"],
    ["QQQ", "NASDAQ:QQQ|1D"],
    ["NVDA", "NASDAQ:NVDA|1D"],
  ],
  chartOnly: false,
  width: "100%",
  height: 330,
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
  fontFamily:
    "-apple-system, BlinkMacSystemFont, Trebuchet MS, Roboto, Ubuntu, sans-serif",
  fontSize: "10",
  noTimeScale: false,
  valuesTracking: "1",
  changeMode: "price-and-percent",
  chartType: "area",
  dateRanges: ["1d|1", "1m|30", "3m|60", "12m|1D", "all|1M"],
};

const MARKET_OVERVIEW_CONFIG = {
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
      title: "Leadership",
      symbols: [
        { s: "NASDAQ:NVDA", d: "NVIDIA" },
        { s: "NASDAQ:AAPL", d: "Apple" },
        { s: "NASDAQ:MSFT", d: "Microsoft" },
        { s: "NASDAQ:AMZN", d: "Amazon" },
        { s: "NASDAQ:GOOGL", d: "Alphabet" },
      ],
    },
    {
      title: "Real Assets / Crypto",
      symbols: [
        { s: "AMEX:GLD", d: "Gold ETF" },
        { s: "AMEX:SLV", d: "Silver ETF" },
        { s: "TVC:USOIL", d: "Crude Oil" },
        { s: "COINBASE:BTCUSD", d: "Bitcoin" },
        { s: "COINBASE:ETHUSD", d: "Ethereum" },
      ],
    },
  ],
};

const MARKET_TIMELINE_CONFIG = {
  feedMode: "market",
  market: "stock",
  isTransparent: true,
  displayMode: "regular",
  width: "100%",
  height: 540,
  colorTheme: "dark",
  locale: "en",
};

const MINI_MARKET_CONFIG = {
  colorTheme: "dark",
  isTransparent: true,
  largeChartUrl: "",
  displayMode: "regular",
  width: "100%",
  height: 430,
  locale: "en",
  symbolsGroups: [
    {
      name: "Core Market",
      symbols: [
        { name: "AMEX:SPY", displayName: "SPY" },
        { name: "NASDAQ:QQQ", displayName: "QQQ" },
        { name: "AMEX:IWM", displayName: "IWM" },
      ],
    },
    {
      name: "Rates / Defense",
      symbols: [
        { name: "TVC:US10Y", displayName: "10Y" },
        { name: "AMEX:TLT", displayName: "TLT" },
        { name: "AMEX:GLD", displayName: "GLD" },
      ],
    },
    {
      name: "Innovation",
      symbols: [
        { name: "NASDAQ:NVDA", displayName: "NVDA" },
        { name: "NASDAQ:MSFT", displayName: "MSFT" },
        { name: "COINBASE:BTCUSD", displayName: "BTC" },
      ],
    },
  ],
};

const TABS: Array<{ id: MainTab; label: string; helper: string; icon: string }> = [
  { id: "command", label: "Command", helper: "First impression", icon: "✦" },
  { id: "markets", label: "Markets", helper: "Live pulse", icon: "▴" },
  { id: "briefing", label: "Briefing", helper: "AI daily read", icon: "◌" },
  { id: "platform", label: "Platform", helper: "What it does", icon: "▦" },
  { id: "portals", label: "Portals", helper: "Access", icon: "◍" },
  { id: "workflow", label: "Workflow", helper: "Advisor day", icon: "↬" },
  { id: "compliance", label: "Compliance", helper: "Review-first", icon: "🛡" },
  { id: "production", label: "Production", helper: "Launch path", icon: "⌖" },
];

const PLATFORM_MODULES: PlatformModule[] = [
  {
    title: "Unified Advisor / Founder Portal",
    subtitle: "One command center",
    description:
      "Advisor and founder/admin operations route through one portal so the platform feels simple even while the backend remains role-controlled and enterprise-ready.",
    href: "/founder-login",
    tone: "red",
    icon: "✦",
    proof: [
      "Advisor dashboard",
      "Founder oversight",
      "Firm operations",
      "System command",
    ],
  },
  {
    title: "Ultimate Custom Board",
    subtitle: "Analyze anything",
    description:
      "Search any stock, ETF, index, or crypto; run live analysis; add it to a watchlist; customize the right rail; build custom metrics; and save alert rules.",
    href: "/workspace/custom-board",
    tone: "cyan",
    icon: "◈",
    proof: [
      "Any security lookup",
      "Live quote route",
      "TradingView charting",
      "Custom advisor metrics",
    ],
  },
  {
    title: "Daily Intelligence Briefing",
    subtitle: "News that changes",
    description:
      "Slice scans public and advisor-authorized sources, ranks relevance, detects watchlist impact, and turns the day’s market activity into advisor-ready context.",
    href: "/intelligence",
    tone: "purple",
    icon: "◌",
    proof: [
      "Headline scoring",
      "Source health",
      "Alert candidates",
      "Digest candidates",
    ],
  },
  {
    title: "Client Portal",
    subtitle: "High-touch client experience",
    description:
      "Clients can message, upload documents, submit meeting requests, update risk preferences, and receive advisor-reviewed updates through a clean client portal.",
    href: "/client-login",
    tone: "purple",
    icon: "◍",
    proof: [
      "Client messages",
      "Document intake",
      "Risk preferences",
      "Advisor-reviewed output",
    ],
  },
  {
    title: "Client Communication Center",
    subtitle: "Draft, review, approve",
    description:
      "AI-assisted client emails, talking points, briefings, and summaries stay draft-first until an advisor or firm reviewer approves them.",
    href: "/workspace/client-emails",
    tone: "green",
    icon: "✉",
    proof: [
      "AI draft support",
      "Review gates",
      "Source-backed context",
      "Client-specific notes",
    ],
  },
  {
    title: "Portfolio Lab",
    subtitle: "Allocation and risk",
    description:
      "Review holdings, allocation drift, scenario impact, concentration, liquidity, tax context, and suitability before turning ideas into client communication.",
    href: "/portfolio-lab",
    tone: "green",
    icon: "▥",
    proof: [
      "Holdings review",
      "Scenario analysis",
      "Risk alignment",
      "Portfolio talking points",
    ],
  },
  {
    title: "Paid Source Intelligence",
    subtitle: "Advisor-owned feeds",
    description:
      "Advisors can connect authorized RSS, API, or export feeds from paid platforms so Slice can include those sources in the intelligence workflow.",
    href: "/intelligence",
    tone: "amber",
    icon: "▣",
    proof: [
      "Authorized feeds",
      "Encrypted credentials",
      "Relevant source scoring",
      "Alert routing",
    ],
  },
  {
    title: "Security and Compliance Posture",
    subtitle: "Review-first design",
    description:
      "Recommendation language, performance claims, private investments, PII, and client-specific outputs route through human review and retention logic.",
    href: "/security",
    tone: "blue",
    icon: "🛡",
    proof: [
      "Human approval",
      "Books and records",
      "Data minimization",
      "Firm policy controls",
    ],
  },
];

const WORKFLOW_STEPS = [
  {
    step: "01",
    title: "Monitor",
    body:
      "Live markets, watchlists, paid sources, public sources, client requests, documents, and internal tasks flow into one advisor operating layer.",
    output: "Advisor sees what changed.",
    tone: "cyan" as Tone,
  },
  {
    step: "02",
    title: "Analyze",
    body:
      "Slice turns market data and headlines into ranked advisor context using recency, materiality, watchlist relevance, source trust, and client-fit signals.",
    output: "Advisor sees what matters.",
    tone: "purple" as Tone,
  },
  {
    step: "03",
    title: "Brief",
    body:
      "The daily briefing summarizes market movement, investor impact, advisor action, compliance considerations, and client talking points.",
    output: "Advisor starts prepared.",
    tone: "green" as Tone,
  },
  {
    step: "04",
    title: "Customize",
    body:
      "Advisors build custom dashboards, custom metrics, alert thresholds, delivery channels, notes, and right-side decision rails.",
    output: "Workspace fits the advisor.",
    tone: "blue" as Tone,
  },
  {
    step: "05",
    title: "Review",
    body:
      "Client-specific language, recommendations, performance content, PII, and sensitive outputs are routed through advisor and firm review.",
    output: "Firm stays safer.",
    tone: "amber" as Tone,
  },
  {
    step: "06",
    title: "Notify",
    body:
      "Approved notifications, digests, notes, and client updates can route through dashboard, email, SMS, digest, or review queues.",
    output: "Clients get relevant context.",
    tone: "red" as Tone,
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function hashString(input: string) {
  let hash = 0;

  for (let index = 0; index < input.length; index += 1) {
    hash = (hash << 5) - hash + input.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash);
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

function formatCurrency(value: number, currency = "USD") {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value > 100 ? 2 : 4,
  }).format(value);
}

function formatNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: 2,
    notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard",
  }).format(value);
}

function formatTimestamp(value: string | undefined) {
  if (!value) return "—";

  const parsed = Date.parse(value);
  if (!Number.isFinite(parsed)) return "—";

  const date = new Date(parsed);
  return `${date.toISOString().slice(0, 10)} ${date.toISOString().slice(11, 16)} UTC`;
}

function fallbackSnapshot(symbol: string): MarketSnapshot {
  const hash = hashString(symbol);
  const base = 18 + (hash % 900);
  const deterministicWave = Math.sin(hash * 0.017) * base * 0.012;
  const price = Number((base + deterministicWave).toFixed(2));
  const change = Number((price - base).toFixed(2));
  const changePercent = Number(((change / base) * 100).toFixed(2));

  return {
    symbol,
    provider: "Slice fallback",
    isRealtime: false,
    price,
    previousClose: base,
    change,
    changePercent,
    bid: Number((price * 0.999).toFixed(2)),
    ask: Number((price * 1.001).toFixed(2)),
    volume: 1_000_000 + (hash % 40_000_000),
    currency: "USD",
    marketState: "Demo",
    qualityScore: 35,
    latencyMs: 0,
    providerTimestamp: null,
    receivedAt: STATIC_DEMO_TIMESTAMP,
    technicals: {
      sma20: Number((base * 0.98).toFixed(2)),
      sma50: Number((base * 0.95).toFixed(2)),
      sma200: Number((base * 0.9).toFixed(2)),
      rsi14: 35 + (hash % 45),
      volatility30d: Number((10 + (hash % 65)).toFixed(2)),
      trend: changePercent >= 0 ? "Bullish" : "Bearish",
      technicalSummary:
        "Fallback estimate. Connect a licensed data provider for production-grade market data.",
    },
    warnings: [
      "Fallback value. Do not use this value for trading, client reporting, or time-sensitive advice.",
    ],
  };
}

function fallbackScan(): ScanResponse {
  return {
    scannedAt: STATIC_DEMO_TIMESTAMP,
    sources: [
      {
        id: "fallback-source",
        name: "Slice Market Desk",
        ok: true,
        fetched: 5,
      },
    ],
    items: [],
    alertCandidates: [
      {
        id: "fallback-alert-1",
        sourceName: "Slice Market Desk",
        title: "Advisor review required before turning market movement into client guidance",
        summary:
          "Slice detected that market movement should be translated into advisor-reviewed context before any client-specific use.",
        link: "",
        publishedAt: STATIC_DEMO_TIMESTAMP,
        score: 88,
        urgency: "High",
        matchedTickers: ["SPY", "QQQ"],
        matchedCompanies: [],
        matchedThemes: ["portfolio review", "risk tolerance", "market volatility"],
        reasons: [
          "Broad market context",
          "Potential client relevance",
          "Advisor review required",
        ],
        shouldAlert: true,
        channels: ["Dashboard", "Email"],
        complianceLabel:
          "Market intelligence alert — not a buy/sell recommendation.",
        alertCopy:
          "High: Review market movement before using it in client communication.",
      },
    ],
    digestCandidates: [
      {
        id: "fallback-digest-1",
        sourceName: "Slice Research Queue",
        title: "AI, rates, liquidity, and client behavior remain key advisor themes",
        summary:
          "A useful daily briefing should connect headlines to portfolio positioning, client questions, risk review, and communication needs.",
        link: "",
        publishedAt: STATIC_DEMO_TIMESTAMP,
        score: 72,
        urgency: "Medium",
        matchedTickers: ["NVDA", "TLT"],
        matchedCompanies: [],
        matchedThemes: ["ai", "rates", "liquidity"],
        reasons: ["Theme relevance", "Portfolio discussion value"],
        shouldAlert: false,
        channels: ["Digest"],
        complianceLabel: "Stored for digest only.",
        alertCopy: "Digest: Review AI, rates, and liquidity themes.",
      },
    ],
    suppressed: [],
  };
}

function useHomepageMarket(symbols: string[]) {
  const [snapshots, setSnapshots] = useState<MarketSnapshot[]>(
    symbols.map(fallbackSnapshot),
  );
  const [generatedAt, setGeneratedAt] = useState(STATIC_DEMO_TIMESTAMP);
  const [loading, setLoading] = useState(false);
  const [sourceLabel, setSourceLabel] = useState("Preparing market data");
  const [warning, setWarning] = useState("");

  const symbolsKey = symbols.join(",");

  async function refresh() {
    setLoading(true);
    setWarning("");

    const fallbackMap = new Map<string, MarketSnapshot>();
    for (const symbol of symbols) {
      fallbackMap.set(symbol.toUpperCase(), fallbackSnapshot(symbol.toUpperCase()));
    }

    try {
      const response = await fetch(
        `/api/market/realtime?symbols=${encodeURIComponent(symbols.join(","))}&persist=true`,
        { cache: "no-store" },
      );

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as MarketApiResponse;

      for (const snapshot of data.snapshots ?? []) {
        fallbackMap.set(snapshot.symbol.toUpperCase(), snapshot);
      }

      const ordered = symbols.map(
        (symbol) => fallbackMap.get(symbol.toUpperCase()) ?? fallbackSnapshot(symbol),
      );

      setSnapshots(ordered);
      setGeneratedAt(data.generatedAt ?? new Date().toISOString());
      setSourceLabel(
        ordered.some((snapshot) => snapshot.isRealtime)
          ? "Provider-backed real-time market data"
          : "Slice fallback market data",
      );
    } catch (error) {
      setSnapshots(symbols.map(fallbackSnapshot));
      setGeneratedAt(new Date().toISOString());
      setSourceLabel("Slice fallback market data");
      setWarning(
        error instanceof Error
          ? `Market API unavailable, using fallback cards: ${error.message}`
          : "Market API unavailable, using fallback cards.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, MARKET_REFRESH_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, [symbolsKey]);

  const averageQuality =
    snapshots.reduce((sum, snapshot) => sum + (snapshot.qualityScore ?? 0), 0) /
    Math.max(1, snapshots.length);

  return {
    snapshots,
    generatedAt,
    loading,
    sourceLabel,
    warning,
    averageQuality,
    refresh,
  };
}

function useDailyIntelligence() {
  const [scan, setScan] = useState<ScanResponse>(fallbackScan());
  const [loading, setLoading] = useState(false);
  const [warning, setWarning] = useState("");

  async function refresh() {
    setLoading(true);
    setWarning("");

    try {
      const response = await fetch("/api/intelligence/scan", {
        cache: "no-store",
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}`);
      }

      const data = (await response.json()) as ScanResponse;
      setScan(data);
    } catch (error) {
      setScan(fallbackScan());
      setWarning(
        error instanceof Error
          ? `Intelligence API unavailable, using fallback briefing: ${error.message}`
          : "Intelligence API unavailable, using fallback briefing.",
      );
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    refresh();

    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") refresh();
    }, INTELLIGENCE_REFRESH_MS);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibilityChange);
    };
  }, []);

  return {
    scan,
    loading,
    warning,
    refresh,
  };
}

function generateDailyBriefing(
  scan: ScanResponse,
  marketSnapshots: MarketSnapshot[],
): DailyBriefing {
  const topAlert = scan.alertCandidates[0] ?? scan.digestCandidates[0];
  const topMover = [...marketSnapshots].sort(
    (left, right) =>
      Math.abs(right.changePercent ?? 0) - Math.abs(left.changePercent ?? 0),
  )[0];

  const positiveCount = marketSnapshots.filter(
    (snapshot) => (snapshot.changePercent ?? 0) >= 0,
  ).length;
  const negativeCount = marketSnapshots.length - positiveCount;

  const marketTone =
    positiveCount > negativeCount
      ? "constructive with selective leadership"
      : negativeCount > positiveCount
        ? "risk-aware with pressure pockets"
        : "mixed and selective";

  const tone: Tone =
    scan.alertCandidates.some((item) => item.urgency === "Critical")
      ? "red"
      : scan.alertCandidates.length
        ? "amber"
        : positiveCount >= negativeCount
          ? "green"
          : "blue";

  const headline = topAlert
    ? `Today’s Slice Brief: ${topAlert.title}`
    : "Today’s Slice Brief: Markets are active and require advisor context";

  const marketRead = topMover
    ? `${topMover.symbol} is the most notable tracked mover at ${
        (topMover.changePercent ?? 0) >= 0 ? "+" : ""
      }${(topMover.changePercent ?? 0).toFixed(2)}%. The tracked market set looks ${marketTone}.`
    : "Tracked markets are being monitored for price, technical, liquidity, and client-relevance context.";

  const investorImpact = topAlert
    ? `The highest-scoring intelligence item is from ${topAlert.sourceName} with a score of ${topAlert.score}. It matched ${
        topAlert.matchedTickers.length
          ? topAlert.matchedTickers.join(", ")
          : topAlert.matchedThemes.slice(0, 3).join(", ") || "advisor themes"
      }.`
    : "No urgent item cleared the highest alert threshold, so the homepage should emphasize monitoring, preparation, and digest-level context.";

  const advisorAction = topAlert?.shouldAlert
    ? "Review the alert, confirm source context, check affected client exposure, and decide whether a client-facing update is appropriate."
    : "Use the daily digest to prepare talking points, but avoid unnecessary client alerts unless relevance is clear.";

  return {
    headline,
    subhead:
      "Generated from live market context, source scans, watchlist relevance, and advisor-review guardrails.",
    generatedAt: scan.scannedAt,
    marketRead,
    investorImpact,
    advisorAction,
    complianceNote:
      "This is market intelligence and workflow support. It is not a buy/sell recommendation and should be reviewed before client-specific use.",
    tone,
    blocks: [
      {
        title: "What changed",
        body:
          "Slice compares live market movement and source scans to surface what may deserve advisor attention.",
        tone: "cyan",
        points: scan.alertCandidates.length
          ? scan.alertCandidates.slice(0, 4).map((item) => item.title)
          : [
              "No urgent alert exceeded the highest threshold.",
              "Continue monitoring watchlists and client-sensitive holdings.",
            ],
      },
      {
        title: "What belongs in the digest",
        body:
          "Digest items are useful for client context but not necessarily important enough for immediate notification.",
        tone: "purple",
        points: scan.digestCandidates.length
          ? scan.digestCandidates.slice(0, 4).map((item) => item.title)
          : [
              "No digest candidates were available from the latest scan.",
              "Use the market board for manual review.",
            ],
      },
      {
        title: "Source and system health",
        body:
          "The homepage should show whether the intelligence engine is actually receiving usable source data.",
        tone: "green",
        points: scan.sources.length
          ? scan.sources
              .slice(0, 5)
              .map((source) => `${source.name}: ${source.ok ? "online" : "issue"}`)
          : ["No source health data is available yet."],
      },
    ],
  };
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
        tonePanelClass(tone),
      )}
    >
      <span className="min-w-0 break-words">{children}</span>
    </span>
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
    <Link
      href={href}
      prefetch={false}
      className={cx(
        "relative z-50 inline-flex min-w-0 items-center justify-center rounded-2xl px-4 py-3 text-center text-sm font-black leading-tight transition duration-200 hover:-translate-y-0.5 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-red-500",
        classNameByVariant,
        className,
      )}
    >
      <span className="relative z-10 min-w-0 whitespace-normal break-words sm:whitespace-nowrap">
        {children}
      </span>
    </Link>
  );
}

function BrandMark() {
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
          Slice
        </div>
        <div className="line-clamp-2 text-[10px] font-black uppercase leading-snug tracking-[0.22em] text-red-400 sm:truncate">
          Advisor Intelligence Platform
        </div>
      </div>
    </div>
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
              Loading live market layer
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

function MarketTile({ snapshot }: { snapshot: MarketSnapshot }) {
  const positive = (snapshot.changePercent ?? 0) >= 0;
  const tone: Tone =
    snapshot.marketState === "Demo" || snapshot.marketState === "Stale"
      ? "amber"
      : positive
        ? "green"
        : "red";

  return (
    <SoftCard tone={tone} className="min-h-[238px]">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <div className="text-2xl font-black text-white">{snapshot.symbol}</div>
            <Pill tone={tone}>{snapshot.marketState ?? "Unknown"}</Pill>
          </div>
          <div className="mt-1 text-xs font-black uppercase tracking-[0.14em] text-slate-500">
            {snapshot.provider ?? "Provider"} · Quality {snapshot.qualityScore ?? 0}/100
          </div>
        </div>
        <span className={cx("mt-2 h-3 w-3 shrink-0 rounded-full shadow-lg", dotClass(tone))} />
      </div>

      <div className="mt-5 flex items-end justify-between gap-3">
        <div>
          <div className="text-3xl font-black tracking-tight text-white transition-all duration-500">
            {formatCurrency(snapshot.price, snapshot.currency ?? "USD")}
          </div>

          <div
            className={cx(
              "mt-1 text-sm font-black transition-all duration-500",
              positive ? "text-emerald-300" : "text-red-300",
            )}
          >
            {positive ? "+" : ""}
            {formatNumber(snapshot.change)} · {positive ? "+" : ""}
            {formatNumber(snapshot.changePercent)}%
          </div>
        </div>

        <div
          className={cx(
            "rounded-2xl border px-3 py-2 text-right transition-all duration-500",
            positive
              ? "border-emerald-400/20 bg-emerald-500/10"
              : "border-red-400/20 bg-red-500/10",
          )}
        >
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
            Move
          </div>
          <div className="text-xs font-black text-white">
            {snapshot.marketState ?? "—"}
          </div>
        </div>
      </div>

      <div className="mt-5 grid grid-cols-2 gap-3">
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
            Volume
          </div>
          <div className="mt-1 text-sm font-black text-white">{formatNumber(snapshot.volume)}</div>
        </div>
        <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
          <div className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-500">
            RSI
          </div>
          <div className="mt-1 text-sm font-black text-white">
            {snapshot.technicals?.rsi14 ?? "—"}
          </div>
        </div>
      </div>

      <p className="mt-4 line-clamp-2 text-xs font-semibold leading-5 text-slate-300">
        {snapshot.technicals?.technicalSummary ??
          "Technical summary will appear when provider history is available."}
      </p>
    </SoftCard>
  );
}

function ModuleCard({ module }: { module: PlatformModule }) {
  return (
    <Link
      href={module.href}
      prefetch={false}
      className={cx(
        "group relative z-10 flex min-h-[390px] min-w-0 flex-col overflow-hidden rounded-[1.75rem] border p-5 shadow-xl transition hover:-translate-y-1 hover:scale-[1.01]",
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
          {module.proof.map((detail) => (
            <div
              key={detail}
              className="flex min-w-0 items-start gap-2 text-xs font-bold leading-5 text-slate-300"
            >
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
    </Link>
  );
}

function BriefingPanel({
  briefing,
  scan,
  loading,
  warning,
  refresh,
}: {
  briefing: DailyBriefing;
  scan: ScanResponse;
  loading: boolean;
  warning: string;
  refresh: () => void;
}) {
  return (
    <Card className="p-5">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Pill tone={briefing.tone}>AI daily briefing</Pill>
            <Pill tone="cyan">{scan.sources.filter((source) => source.ok).length} sources online</Pill>
            <Pill tone={scan.alertCandidates.length ? "red" : "green"}>
              {scan.alertCandidates.length} alerts
            </Pill>
            <Pill tone="purple">{scan.digestCandidates.length} digest</Pill>
          </div>

          <h2 className="mt-4 text-3xl font-black leading-tight text-white md:text-5xl">
            {briefing.headline}
          </h2>
          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
            {briefing.subhead}
          </p>
          <div className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
            Generated {formatTimestamp(briefing.generatedAt)}
          </div>
        </div>

        <button
          type="button"
          onClick={refresh}
          disabled={loading}
          className="relative z-50 rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
        >
          {loading ? "Regenerating..." : "Regenerate brief"}
        </button>
      </div>

      {warning ? (
        <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-4 text-sm font-bold leading-6 text-amber-100">
          {warning}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 lg:grid-cols-4">
        <SoftCard tone="cyan" className="lg:col-span-2">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-cyan-300">
            Market read
          </div>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-200">
            {briefing.marketRead}
          </p>
        </SoftCard>

        <SoftCard tone="purple" className="lg:col-span-2">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-purple-300">
            Investor impact
          </div>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-200">
            {briefing.investorImpact}
          </p>
        </SoftCard>

        <SoftCard tone="green" className="lg:col-span-2">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-300">
            Advisor action
          </div>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-200">
            {briefing.advisorAction}
          </p>
        </SoftCard>

        <SoftCard tone="amber" className="lg:col-span-2">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-amber-300">
            Review note
          </div>
          <p className="mt-3 text-sm font-semibold leading-7 text-slate-200">
            {briefing.complianceNote}
          </p>
        </SoftCard>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        {briefing.blocks.map((block) => (
          <SoftCard key={block.title} tone={block.tone}>
            <h3 className="text-xl font-black text-white">{block.title}</h3>
            <p className="mt-2 text-sm leading-6 text-slate-300">{block.body}</p>
            <div className="mt-4 grid gap-2">
              {block.points.map((point) => (
                <div
                  key={point}
                  className="rounded-2xl border border-white/10 bg-black/25 p-3 text-xs font-bold leading-5 text-slate-300"
                >
                  {point}
                </div>
              ))}
            </div>
          </SoftCard>
        ))}
      </div>
    </Card>
  );
}

function CommandTab({
  market,
  briefing,
  scan,
  intelligence,
}: {
  market: ReturnType<typeof useHomepageMarket>;
  briefing: DailyBriefing;
  scan: ScanResponse;
  intelligence: ReturnType<typeof useDailyIntelligence>;
}) {
  const systemMetrics: SystemMetric[] = [
    {
      label: "Market Layer",
      value: market.sourceLabel,
      helper: `Updated ${formatTimestamp(market.generatedAt)}`,
      tone: market.snapshots.some((snapshot) => snapshot.isRealtime) ? "green" : "amber",
    },
    {
      label: "Data Quality",
      value: `${Math.round(market.averageQuality)}/100`,
      helper: "Average market snapshot quality across homepage symbols",
      tone: market.averageQuality >= 80 ? "green" : market.averageQuality >= 55 ? "amber" : "red",
    },
    {
      label: "Briefing Engine",
      value: `${scan.alertCandidates.length} alert candidates`,
      helper: `${scan.digestCandidates.length} digest items, ${scan.suppressed.length} suppressed`,
      tone: scan.alertCandidates.length ? "red" : "green",
    },
    {
      label: "Portal Access",
      value: "Unified",
      helper: "Advisor and founder access route through one command portal",
      tone: "red",
    },
  ];

  return (
    <div className="grid gap-5">
      <section className="grid gap-5 2xl:grid-cols-[1.14fr_0.86fr]">
        <Card className="p-6">
          <div className="flex flex-wrap gap-2">
            <Pill tone="red">First-impression command center</Pill>
            <Pill tone="cyan">Continuously updating market layer</Pill>
            <Pill tone="purple">AI daily intelligence</Pill>
            <Pill tone="amber">Review-first advisor workflow</Pill>
          </div>

          <h1 className="mt-6 max-w-6xl text-4xl font-black leading-[0.96] tracking-tight text-white md:text-7xl">
            The advisor homepage that feels like a market desk, AI analyst,
            client portal, and compliance command center in one.
          </h1>

          <p className="mt-6 max-w-5xl text-base font-semibold leading-8 text-slate-300 md:text-lg">
            Slice is an advisor intelligence platform built to help advisors monitor
            markets, analyze any security, scan relevant news, prepare daily briefings,
            manage client requests, draft client communication, customize metrics, and
            keep every sensitive action review-first.
          </p>

          <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {systemMetrics.map((metric) => (
              <SoftCard key={metric.label} tone={metric.tone} className="min-h-[132px]">
                <div className="text-[10px] font-black uppercase leading-relaxed tracking-[0.16em] text-slate-400">
                  {metric.label}
                </div>
                <div className="mt-2 text-xl font-black leading-tight text-white">
                  {metric.value}
                </div>
                <p className="mt-2 text-xs font-semibold leading-5 text-slate-400">
                  {metric.helper}
                </p>
              </SoftCard>
            ))}
          </div>

          <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <LinkButton href="/founder-login" tone="red">
              Advisor / Founder Login
            </LinkButton>
            <LinkButton href="/client-login" tone="purple" variant="soft">
              Client Login
            </LinkButton>
            <LinkButton href="/workspace/custom-board" tone="cyan" variant="soft">
              Analyze Any Security
            </LinkButton>
            <LinkButton href="/intelligence" tone="purple" variant="soft">
              Run Intelligence Scanner
            </LinkButton>
          </div>
        </Card>

        <div className="grid gap-5">
          <Card className="p-3">
            <TradingViewWidget
              id="slice-hero-symbol-overview"
              scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-symbol-overview.js"
              config={HERO_SYMBOL_OVERVIEW_CONFIG}
              className="min-h-[350px]"
            />
          </Card>

          <Card className="p-5">
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                  Today’s AI Read
                </div>
                <h2 className="mt-2 text-2xl font-black leading-tight text-white">
                  {briefing.marketRead}
                </h2>
              </div>
              <button
                type="button"
                onClick={intelligence.refresh}
                disabled={intelligence.loading}
                className="relative z-50 rounded-2xl border border-white/10 bg-white px-4 py-3 text-xs font-black text-slate-950 disabled:opacity-60"
              >
                {intelligence.loading ? "Refreshing..." : "Refresh Brief"}
              </button>
            </div>

            <p className="mt-4 text-sm font-semibold leading-7 text-slate-400">
              {briefing.advisorAction}
            </p>
          </Card>
        </div>
      </section>

      <Card className="p-3">
        <TradingViewWidget
          id="slice-home-ticker-tape"
          scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-ticker-tape.js"
          className="min-h-[84px]"
          config={TICKER_TAPE_CONFIG}
        />
      </Card>
    </div>
  );
}

function MarketsTab({
  market,
}: {
  market: ReturnType<typeof useHomepageMarket>;
}) {
  return (
    <div className="grid gap-5">
      <SectionHeader
        eyebrow="Live Market Layer"
        title="A homepage that updates continuously and proves Slice is market-aware."
        description="The homepage pulls from /api/market/realtime when available, falls back safely when it is not, and updates continuously while the browser tab is visible."
        action={
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={market.refresh}
              disabled={market.loading}
              className="relative z-50 rounded-2xl border border-white/10 bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
            >
              {market.loading ? "Refreshing..." : "Refresh market data"}
            </button>
            <LinkButton href="/workspace/custom-board" tone="cyan" variant="soft">
              Open Custom Board
            </LinkButton>
          </div>
        }
      />

      {market.warning ? (
        <div className="rounded-[1.5rem] border border-amber-500/25 bg-amber-500/10 p-4 text-sm font-bold leading-6 text-amber-100">
          {market.warning}
        </div>
      ) : null}

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        {market.snapshots.map((snapshot) => (
          <MarketTile key={snapshot.symbol} snapshot={snapshot} />
        ))}
      </div>

      <section className="grid gap-5 2xl:grid-cols-[1.12fr_0.88fr]">
        <Card className="p-5">
          <TradingViewWidget
            id="slice-home-market-overview"
            scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-market-overview.js"
            className="min-h-[670px]"
            config={MARKET_OVERVIEW_CONFIG}
          />
        </Card>

        <Card className="p-5">
          <TradingViewWidget
            id="slice-home-mini-market"
            scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-market-quotes.js"
            className="min-h-[440px]"
            config={MINI_MARKET_CONFIG}
          />

          <div className="mt-5 grid gap-3 md:grid-cols-2">
            {[
              ["Any stock", "Search and analyze equities inside the custom board."],
              ["Any ETF", "Track allocation, liquidity, trend, and client-fit context."],
              ["Any index", "Use indexes, rates, dollar, volatility, and macro proxies."],
              ["Any crypto", "Track digital assets with high-risk review labeling."],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <div className="font-black text-white">{title}</div>
                <p className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                  {detail}
                </p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

function BriefingTab({
  briefing,
  scan,
  intelligence,
}: {
  briefing: DailyBriefing;
  scan: ScanResponse;
  intelligence: ReturnType<typeof useDailyIntelligence>;
}) {
  return (
    <div className="grid gap-5">
      <BriefingPanel
        briefing={briefing}
        scan={scan}
        loading={intelligence.loading}
        warning={intelligence.warning}
        refresh={intelligence.refresh}
      />

      <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <Card className="p-5">
          <SectionHeader
            eyebrow="Intelligence Engine"
            title="News becomes ranked investor relevance."
            description="Slice should not blast investors with every headline. It should evaluate source trust, watchlist relevance, materiality, recency, and advisor-defined thresholds."
          />

          <div className="mt-5 grid gap-3">
            {[
              ["Alert threshold", `${scan.alertCandidates.length} immediate candidates`, "red"],
              ["Digest threshold", `${scan.digestCandidates.length} digest items`, "purple"],
              ["Suppressed noise", `${scan.suppressed.length} lower-priority items`, "slate"],
              ["Source health", `${scan.sources.filter((source) => source.ok).length}/${scan.sources.length} online`, "green"],
            ].map(([label, value, tone]) => (
              <SoftCard key={label} tone={tone as Tone}>
                <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                  {label}
                </div>
                <div className="mt-2 text-2xl font-black text-white">{value}</div>
              </SoftCard>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <TradingViewWidget
            id="slice-home-market-timeline"
            scriptSrc="https://s3.tradingview.com/external-embedding/embed-widget-timeline.js"
            className="min-h-[560px]"
            config={MARKET_TIMELINE_CONFIG}
          />
        </Card>
      </section>
    </div>
  );
}

function PlatformTab() {
  return (
    <div className="grid gap-5">
      <SectionHeader
        eyebrow="Platform"
        title="Slice is not a simple dashboard. It is an advisor operating layer."
        description="The homepage should immediately show that Slice connects markets, intelligence, clients, AI, communication, compliance, and firm execution into one command experience."
      />

      <div className="grid gap-5 md:grid-cols-2 2xl:grid-cols-4">
        {PLATFORM_MODULES.map((module) => (
          <ModuleCard key={module.title} module={module} />
        ))}
      </div>
    </div>
  );
}

function PortalsTab() {
  return (
    <div className="grid gap-5">
      <SectionHeader
        eyebrow="Portal Access"
        title="Two clean entry points: clients and the unified advisor/founder portal."
        description="The login experience is intentionally simple. Clients use the client portal. Advisors, teams, and founder/admin controls route through the advisor/founder login."
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="p-6">
          <Pill tone="purple">Client Login</Pill>
          <h2 className="mt-4 text-4xl font-black leading-tight text-white">
            Client Portal
          </h2>
          <p className="mt-4 text-sm font-semibold leading-7 text-slate-400">
            Clients can message, upload documents, request meetings, update risk preferences,
            submit buy/sell discussion requests, and receive advisor-reviewed updates.
          </p>
          <div className="mt-6">
            <LinkButton href="/client-login" tone="purple">
              Open Client Login
            </LinkButton>
          </div>
        </Card>

        <Card className="p-6">
          <Pill tone="red">Advisor / Founder Login</Pill>
          <h2 className="mt-4 text-4xl font-black leading-tight text-white">
            Unified Command Portal
          </h2>
          <p className="mt-4 text-sm font-semibold leading-7 text-slate-400">
            Advisors, firm operators, and founder controls enter through the combined
            advisor/founder login. The platform can then route permissions, admin controls,
            client queues, and system oversight by role.
          </p>
          <div className="mt-6">
            <LinkButton href="/founder-login" tone="red">
              Open Advisor / Founder Login
            </LinkButton>
          </div>
        </Card>
      </section>
    </div>
  );
}

function WorkflowTab() {
  return (
    <div className="grid gap-5">
      <SectionHeader
        eyebrow="Advisor Workflow"
        title="From market movement to reviewed client communication."
        description="Slice should make the advisor faster without removing advisor judgment, compliance review, or firm policy."
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {WORKFLOW_STEPS.map((step) => (
          <Card key={step.step} className={cx("p-5", tonePanelClass(step.tone))}>
            <div className="text-5xl font-black text-white/15">{step.step}</div>
            <h3 className="mt-2 text-2xl font-black text-white">{step.title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{step.body}</p>
            <div className="mt-5 rounded-2xl border border-white/10 bg-black/25 p-3 text-xs font-black uppercase tracking-[0.14em] text-white">
              {step.output}
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}

function ComplianceTab() {
  return (
    <div className="grid gap-5">
      <SectionHeader
        eyebrow="Compliance Posture"
        title="AI prepares. Advisors approve. Firms retain."
        description="Slice should be positioned as a workflow, intelligence, supervision, and documentation layer — not an autonomous advice engine."
      />

      <section className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {[
          [
            "Human approval",
            "Client-specific recommendations, trade language, performance content, and sensitive messages stay review-gated.",
            "red",
          ],
          [
            "Source-backed output",
            "Market comments and investor notifications retain source context, timestamps, reasoning, and reviewer decisions.",
            "cyan",
          ],
          [
            "Books and records",
            "Prompts, drafts, edits, approvals, final versions, delivery metadata, and source packages should be retained.",
            "amber",
          ],
          [
            "Paid-source compliance",
            "Advisors can connect authorized paid feeds, but Slice should not bypass passwords, cookies, sessions, or paywalls.",
            "purple",
          ],
          [
            "Client privacy",
            "Client data should be minimized, permissioned, logged, and routed through approved firm systems.",
            "green",
          ],
          [
            "Firm policy",
            "Each firm still needs legal, compliance, data vendor, cybersecurity, and supervisory review before production rollout.",
            "blue",
          ],
        ].map(([title, description, tone]) => (
          <Card key={title} className={cx("p-5", tonePanelClass(tone as Tone))}>
            <h3 className="text-2xl font-black text-white">{title}</h3>
            <p className="mt-3 text-sm leading-7 text-slate-300">{description}</p>
          </Card>
        ))}
      </section>
    </div>
  );
}

function ProductionTab() {
  return (
    <div className="grid gap-5">
      <SectionHeader
        eyebrow="Production Path"
        title="The premium homepage is only the front door. Production value comes from real integrations."
        description="This page is built to use live APIs when present, fall back safely when they are not, and show investors that the architecture is moving toward serious advisor infrastructure."
      />

      <section className="grid gap-5 xl:grid-cols-2">
        <Card className="p-5">
          <h3 className="text-3xl font-black text-white">Production wiring</h3>
          <div className="mt-5 grid gap-3">
            {[
              "Licensed real-time market data provider",
              "Provider-backed fundamentals and technical data",
              "Advisor-authorized paid research feeds",
              "Encrypted credential storage",
              "Client portal database persistence",
              "Notification provider for email/SMS/digest delivery",
              "Role-based advisor/founder/team permissions",
              "Books-and-records retention and approval logs",
              "Firm-specific compliance policies and review queues",
              "Data vendor terms-of-use review",
            ].map((item) => (
              <div
                key={item}
                className="flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.045] p-4"
              >
                <span className="mt-1 h-2.5 w-2.5 rounded-full bg-red-400 shadow-lg shadow-red-400/40" />
                <span className="text-sm font-bold leading-6 text-slate-300">{item}</span>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-5">
          <h3 className="text-3xl font-black text-white">Why the homepage matters</h3>
          <div className="mt-5 grid gap-3">
            {[
              [
                "Immediate clarity",
                "Visitors should understand within seconds that Slice is an advisor intelligence and workflow platform.",
              ],
              [
                "Market credibility",
                "Live widgets and provider-backed cards make the platform feel current, serious, and financially relevant.",
              ],
              [
                "AI usefulness",
                "Daily briefings show that the product changes with the day’s news and does not feel static.",
              ],
              [
                "Workflow depth",
                "The homepage shows client portals, advisor tools, compliance review, and operations as one system.",
              ],
              [
                "Demo credibility",
                "Every major button routes into the actual product instead of generic marketing sections.",
              ],
            ].map(([title, detail]) => (
              <div key={title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
                <div className="font-black text-white">{title}</div>
                <p className="mt-1 text-sm leading-6 text-slate-400">{detail}</p>
              </div>
            ))}
          </div>
        </Card>
      </section>
    </div>
  );
}

export default function SliceHomePage() {
  const [activeTab, setActiveTab] = useState<MainTab>("command");
  const market = useHomepageMarket(MARKET_SYMBOLS);
  const intelligence = useDailyIntelligence();

  const briefing = useMemo(
    () => generateDailyBriefing(intelligence.scan, market.snapshots),
    [intelligence.scan, market.snapshots],
  );

  const activeTabContent = useMemo(() => {
    if (activeTab === "command") {
      return (
        <CommandTab
          market={market}
          briefing={briefing}
          scan={intelligence.scan}
          intelligence={intelligence}
        />
      );
    }

    if (activeTab === "markets") return <MarketsTab market={market} />;

    if (activeTab === "briefing") {
      return (
        <BriefingTab
          briefing={briefing}
          scan={intelligence.scan}
          intelligence={intelligence}
        />
      );
    }

    if (activeTab === "platform") return <PlatformTab />;
    if (activeTab === "portals") return <PortalsTab />;
    if (activeTab === "workflow") return <WorkflowTab />;
    if (activeTab === "compliance") return <ComplianceTab />;

    return <ProductionTab />;
  }, [activeTab, market, briefing, intelligence]);

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-14%] top-[-10%] h-[32rem] w-[32rem] rounded-full bg-red-700/24 blur-3xl" />
        <div className="absolute right-[-12%] top-[12%] h-[34rem] w-[34rem] rounded-full bg-purple-700/12 blur-3xl" />
        <div className="absolute bottom-[-18%] left-[24%] h-[30rem] w-[30rem] rounded-full bg-red-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="relative mx-auto grid max-w-[1860px] gap-4 px-4 py-4 md:px-6">
        <header className="sticky top-3 z-40 rounded-[2rem] border border-white/10 bg-black/72 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between xl:flex-1">
              <BrandMark />

              <div className="grid gap-2 md:grid-cols-3 xl:max-w-3xl">
                <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Market feed
                  </div>
                  <div className="mt-1 truncate text-xs font-black text-white">
                    {market.sourceLabel}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Last update
                  </div>
                  <div className="mt-1 truncate text-xs font-black text-white">
                    {formatTimestamp(market.generatedAt)}
                  </div>
                </div>
                <div className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
                  <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    Intelligence
                  </div>
                  <div className="mt-1 truncate text-xs font-black text-white">
                    {intelligence.scan.alertCandidates.length} alerts ·{" "}
                    {intelligence.scan.digestCandidates.length} digest
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <LinkButton href="/client-login" tone="purple" variant="soft">
                Client Login
              </LinkButton>
              <LinkButton href="/founder-login" tone="red">
                Advisor / Founder Login
              </LinkButton>
            </div>
          </div>
        </header>

        <section className="rounded-[2rem] border border-white/10 bg-zinc-950/70 p-2 shadow-2xl shadow-black/30 backdrop-blur-xl">
          <div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4 2xl:grid-cols-8">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setActiveTab(tab.id)}
                className={cx(
                  "group rounded-[1.25rem] border p-3 text-left transition hover:-translate-y-0.5",
                  activeTab === tab.id
                    ? "border-red-400/40 bg-red-500/15 shadow-lg shadow-red-950/30"
                    : "border-white/10 bg-white/[0.045] hover:bg-white/[0.075]",
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <span className="text-lg">{tab.icon}</span>
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                    {tab.helper}
                  </span>
                </div>
                <div className="mt-2 text-sm font-black text-white">{tab.label}</div>
              </button>
            ))}
          </div>
        </section>

        {activeTabContent}

        <footer className="rounded-[2rem] border border-white/10 bg-zinc-950/70 p-5 text-center text-xs font-bold leading-6 text-slate-500 shadow-2xl shadow-black/30">
          Slice is an advisor workflow, market intelligence, AI briefing, and review
          platform. It is not a substitute for advisor judgment, firm compliance policy,
          legal review, data vendor review, or regulated trading workflows.
        </footer>
      </div>
    </main>
  );
}