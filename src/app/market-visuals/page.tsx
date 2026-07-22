"use client";

import {
  useEffect,
  useMemo,
  useState,
  type FormEvent,
  type ReactNode,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  BookOpenText,
  BrainCircuit,
  CheckCircle2,
  Clipboard,
  Code2,
  Database,
  FileCode2,
  Gauge,
  LineChart as LineChartIcon,
  Loader2,
  Newspaper,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Sigma,
  Sparkles,
  Target,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ComposedChart,
  Line,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type View =
  | "overview"
  | "chart"
  | "forecast"
  | "technicals"
  | "fundamentals"
  | "news"
  | "options"
  | "compare"
  | "pine"
  | "data";

type Tone = "green" | "red" | "amber" | "cyan" | "purple" | "slate";

type Candle = {
  date: string;
  providerDate: string;
  label: string;
  open: number;
  high: number;
  low: number;
  close: number;
  adjustedClose: number | null;
  volume: number;
  dividendAmount: number | null;
  splitCoefficient: number | null;
  sma20: number | null;
  sma50: number | null;
  sma100: number | null;
  sma200: number | null;
  ema9: number | null;
  ema21: number | null;
  vwap: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  bollingerUpper: number | null;
  bollingerMiddle: number | null;
  bollingerLower: number | null;
  atr14: number | null;
  volumeSma20: number | null;
  returnPct: number | null;
  cumulativeReturnPct: number | null;
  rangePct: number | null;
};

type MarketPayload = {
  symbol: string;
  interval: string;
  generatedAt: string;
  provider: "Alpha Vantage";
  providerOnly: true;
  entitlement: string | null;
  isRealtime: boolean;
  marketSession: {
    session: string;
    description: string;
    isOpen: boolean;
    isExtendedHours: boolean;
    timezone: string;
  };
  freshness: {
    status: "Live" | "Delayed" | "Closed" | "Stale" | "Unavailable";
    asOf: string | null;
    ageSeconds: number | null;
    message: string;
  };
  quote: {
    symbol: string;
    price: number;
    regularPrice: number | null;
    extendedHoursPrice: number | null;
    previousClose: number | null;
    change: number | null;
    changePct: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    volume: number | null;
    timestamp: string;
    session: string;
    source: string;
  } | null;
  company: {
    available: boolean;
    source: string;
    symbol: string | null;
    name: string | null;
    description: string | null;
    exchange: string | null;
    currency: string | null;
    country: string | null;
    sector: string | null;
    industry: string | null;
    marketCapitalization: number | null;
    ebitda: number | null;
    peRatio: number | null;
    pegRatio: number | null;
    bookValue: number | null;
    dividendPerShare: number | null;
    dividendYield: number | null;
    eps: number | null;
    revenuePerShareTTM: number | null;
    profitMargin: number | null;
    operatingMarginTTM: number | null;
    returnOnAssetsTTM: number | null;
    returnOnEquityTTM: number | null;
    revenueTTM: number | null;
    grossProfitTTM: number | null;
    dilutedEPSTTM: number | null;
    quarterlyEarningsGrowthYOY: number | null;
    quarterlyRevenueGrowthYOY: number | null;
    analystTargetPrice: number | null;
    trailingPE: number | null;
    forwardPE: number | null;
    priceToSalesRatioTTM: number | null;
    priceToBookRatio: number | null;
    evToRevenue: number | null;
    evToEBITDA: number | null;
    beta: number | null;
    week52High: number | null;
    week52Low: number | null;
    day50MovingAverage: number | null;
    day200MovingAverage: number | null;
    sharesOutstanding: number | null;
    dividendDate: string | null;
    exDividendDate: string | null;
    latestQuarter: string | null;
  };
  earnings: {
    available: boolean;
    source: string;
    quarterly: Array<{
      fiscalDateEnding: string;
      reportedDate: string;
      reportedEPS: number | null;
      estimatedEPS: number | null;
      surprise: number | null;
      surprisePercentage: number | null;
      reportTime: string;
    }>;
    annual: Array<{
      fiscalDateEnding: string;
      reportedEPS: number | null;
    }>;
  };
  news: {
    available: boolean;
    source: string;
    articleCount: number;
    weightedSentiment: number | null;
    articles: Array<{
      title: string;
      url: string;
      source: string;
      sourceDomain: string;
      publishedAt: string | null;
      summary: string;
      sentimentScore: number | null;
      sentimentLabel: string;
      relevanceScore: number | null;
      topics: string[];
    }>;
  };
  options: {
    available: boolean;
    source: string;
    error: string | null;
    contractCount: number;
    expirations: string[];
    callVolume: number;
    putVolume: number;
    putCallVolumeRatio: number | null;
    averageImpliedVolatility: number | null;
    contracts: Array<{
      contractId: string;
      symbol: string;
      expiration: string;
      strike: number | null;
      type: string;
      last: number | null;
      mark: number | null;
      bid: number | null;
      ask: number | null;
      volume: number | null;
      openInterest: number | null;
      impliedVolatility: number | null;
      delta: number | null;
      gamma: number | null;
      theta: number | null;
      vega: number | null;
      rho: number | null;
    }>;
  };
  candles: Candle[];
  latest: Candle | null;
  levels: {
    support: number | null;
    resistance: number | null;
    pivot: number | null;
    distanceToSupportPct: number | null;
    distanceToResistancePct: number | null;
  };
  signals: {
    directionalBias: string;
    trend: string;
    momentum: string;
    volatility: string;
    volume: string;
    summary: string;
  };
  forecast: {
    points: Array<{
      step: number;
      date: string;
      label: string;
      projected: number;
      lower: number;
      upper: number;
      bearish: number;
      bullish: number;
    }>;
    horizon: number;
    confidenceLevel: number;
    probabilityUp: number | null;
    probabilityDown: number | null;
    expectedMovePct: number | null;
    lowerMovePct: number | null;
    upperMovePct: number | null;
    annualizedVolatilityPct: number | null;
    driftPerStepPct: number | null;
    directionalBacktestPct: number | null;
    modelConfidence: number;
    methodology: string;
    scenarios: Array<{
      name: "Bear" | "Base" | "Bull";
      target: number | null;
      movePct: number | null;
      description: string;
    }>;
  };
  quality: {
    score: number;
    warnings: string[];
    calls: Array<{
      endpoint: string;
      status: "live" | "current" | "unavailable";
      asOf: string | null;
      error: string | null;
    }>;
  };
  pineLab: {
    openAiConfigured: boolean;
    model: string;
    pineVersion: 6;
  };
};

type PineProject = {
  id: string;
  name: string;
  symbol: string;
  interval: string;
  scriptType: "indicator" | "strategy";
  prompt: string;
  code: string;
  createdAt: string;
};

const TABS: Array<{
  id: View;
  label: string;
  helper: string;
  icon: typeof Activity;
}> = [
  { id: "overview", label: "Overview", helper: "Live market cockpit", icon: Gauge },
  { id: "chart", label: "Live Chart", helper: "Alpha Vantage OHLCV", icon: LineChartIcon },
  { id: "forecast", label: "Forecast", helper: "Probability bands", icon: BrainCircuit },
  { id: "technicals", label: "Technicals", helper: "Indicators and signals", icon: Sigma },
  { id: "fundamentals", label: "Fundamentals", helper: "Company and earnings", icon: BookOpenText },
  { id: "news", label: "News", helper: "Live sentiment feed", icon: Newspaper },
  { id: "options", label: "Options", helper: "Realtime chain", icon: Target },
  { id: "compare", label: "Compare", helper: "Relative performance", icon: BarChart3 },
  { id: "pine", label: "Pine Lab", helper: "OpenAI Pine v6", icon: Code2 },
  { id: "data", label: "Data Quality", helper: "Sources and candles", icon: Database },
];

const INPUT =
  "w-full min-w-0 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2 disabled:opacity-50";

const BUTTON =
  "inline-flex min-w-0 items-center justify-center gap-2 rounded-xl border border-white/10 bg-white/[0.055] px-4 py-3 text-xs font-black text-white transition hover:bg-white/10 disabled:opacity-40";

function cx(...values: Array<string | null | false | undefined>) {
  return values.filter(Boolean).join(" ");
}

function money(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) < 10 ? Math.max(digits, 4) : digits,
  }).format(value);
}

function number(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    maximumFractionDigits: digits,
  }).format(value);
}

function compact(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function percent(value: number | null | undefined, digits = 2, signed = true) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${signed && value > 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function ratioPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    timeZoneName: "short",
  });
}

function tone(value: string | number | null | undefined): Tone {
  const text = String(value ?? "").toLowerCase();
  const numeric = typeof value === "number" ? value : Number.NaN;

  if (
    text.includes("live") ||
    text.includes("bullish") ||
    text.includes("positive") ||
    text.includes("available") ||
    (!Number.isNaN(numeric) && numeric >= 70)
  ) {
    return "green";
  }

  if (
    text.includes("stale") ||
    text.includes("unavailable") ||
    text.includes("bearish") ||
    text.includes("failed") ||
    (!Number.isNaN(numeric) && numeric < 40)
  ) {
    return "red";
  }

  if (
    text.includes("delayed") ||
    text.includes("closed") ||
    text.includes("mixed") ||
    text.includes("elevated") ||
    (!Number.isNaN(numeric) && numeric < 70)
  ) {
    return "amber";
  }

  if (text.includes("forecast") || text.includes("openai")) return "purple";
  if (text.includes("alpha") || text.includes("current")) return "cyan";
  return "slate";
}

const TONE_CLASSES: Record<Tone, string> = {
  green: "border-emerald-400/25 bg-emerald-400/10 text-emerald-100",
  red: "border-red-400/25 bg-red-400/10 text-red-100",
  amber: "border-amber-400/25 bg-amber-400/10 text-amber-100",
  cyan: "border-cyan-400/25 bg-cyan-400/10 text-cyan-100",
  purple: "border-violet-400/25 bg-violet-400/10 text-violet-100",
  slate: "border-white/10 bg-white/[0.055] text-slate-300",
};

function Panel({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <section
      className={cx(
        "min-w-0 overflow-hidden rounded-[1.8rem] border border-white/10 bg-zinc-950/82 shadow-2xl shadow-black/30 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </section>
  );
}

function Badge({ children, value = "slate" }: { children: ReactNode; value?: Tone | string | number | null }) {
  const selected = typeof value === "string" && value in TONE_CLASSES ? (value as Tone) : tone(value);
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
        TONE_CLASSES[selected],
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Metric({
  label,
  value,
  helper,
  icon,
  metricTone = "slate",
}: {
  label: string;
  value: ReactNode;
  helper?: ReactNode;
  icon?: ReactNode;
  metricTone?: Tone;
}) {
  return (
    <div className="relative min-w-0 overflow-hidden rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-4">
      <div className="absolute -right-10 -top-10 h-28 w-28 rounded-full bg-red-600/10 blur-2xl" />
      <div className="relative flex min-w-0 items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
            {label}
          </div>
          <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
          {helper ? <div className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</div> : null}
        </div>
        {icon ? (
          <div className={cx("shrink-0 rounded-2xl border p-3", TONE_CLASSES[metricTone])}>{icon}</div>
        ) : null}
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
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 border-b border-white/10 p-5 md:p-6 lg:flex-row lg:items-start lg:justify-between">
      <div className="min-w-0">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-red-300">{eyebrow}</div>
        <h2 className="mt-2 break-words text-2xl font-black md:text-3xl">{title}</h2>
        {description ? <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-500">{description}</p> : null}
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function ChartEmpty({ message }: { message: string }) {
  return (
    <div className="grid h-full place-items-center rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
      {message}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name?: string; value?: unknown; color?: string }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="max-w-xs rounded-2xl border border-white/10 bg-black/90 p-3 text-xs shadow-2xl backdrop-blur-xl">
      <div className="font-black text-white">{label}</div>
      <div className="mt-2 grid gap-1.5">
        {payload.map((item, index) => (
          <div key={`${item.name}-${index}`} className="flex items-center justify-between gap-4">
            <span className="text-slate-400">{item.name}</span>
            <span className="font-black text-white">
              {typeof item.value === "number" ? number(item.value, 4) : String(item.value ?? "—")}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function defaultPine(symbol: string) {
  return `//@version=6
indicator("SLICE Live Market Overlay - ${symbol}", overlay = true)

fastLength = input.int(9, "Fast EMA", minval = 1)
slowLength = input.int(21, "Slow EMA", minval = 2)
trendLength = input.int(200, "Trend SMA", minval = 20)
rsiLength = input.int(14, "RSI Length", minval = 2)

fastEma = ta.ema(close, fastLength)
slowEma = ta.ema(close, slowLength)
trendSma = ta.sma(close, trendLength)
rsiValue = ta.rsi(close, rsiLength)

bullish = close > fastEma and fastEma > slowEma and close > trendSma and rsiValue > 50
bearish = close < fastEma and fastEma < slowEma and close < trendSma and rsiValue < 50

plot(fastEma, "Fast EMA", color = color.new(color.lime, 0), linewidth = 2)
plot(slowEma, "Slow EMA", color = color.new(color.aqua, 0), linewidth = 2)
plot(trendSma, "Trend SMA", color = color.new(color.orange, 0), linewidth = 2)
plotshape(bullish, title = "Bullish", style = shape.triangleup, location = location.belowbar, color = color.new(color.green, 0), size = size.tiny)
plotshape(bearish, title = "Bearish", style = shape.triangledown, location = location.abovebar, color = color.new(color.red, 0), size = size.tiny)

alertcondition(bullish, title = "SLICE Bullish", message = "Bullish SLICE conditions on {{ticker}}")
alertcondition(bearish, title = "SLICE Bearish", message = "Bearish SLICE conditions on {{ticker}}")
`;
}

export default function MarketVisualsPage() {
  const [symbol, setSymbol] = useState("NVDA");
  const [compareSymbol, setCompareSymbol] = useState("AAPL");
  const [interval, setInterval] = useState("5min");
  const [view, setView] = useState<View>("overview");
  const [data, setData] = useState<MarketPayload | null>(null);
  const [compareData, setCompareData] = useState<MarketPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [lastRefresh, setLastRefresh] = useState<string | null>(null);
  const [optionsRequested, setOptionsRequested] = useState(false);
  const [confidence, setConfidence] = useState(95);
  const [horizon, setHorizon] = useState(20);

  const [pinePrompt, setPinePrompt] = useState(
    "Create a non-repainting momentum indicator with EMA 9/21, SMA 200, RSI, ATR risk levels, volume confirmation, a compact dashboard table, and alert conditions.",
  );
  const [pineType, setPineType] = useState<"indicator" | "strategy">("indicator");
  const [pineCode, setPineCode] = useState(defaultPine("NVDA"));
  const [pineLoading, setPineLoading] = useState(false);
  const [pineWarnings, setPineWarnings] = useState<string[]>([]);
  const [pineProjects, setPineProjects] = useState<PineProject[]>([]);

  async function requestVisuals(
    nextSymbol: string,
    nextInterval: string,
    includeOptions: boolean,
  ) {
    const params = new URLSearchParams({
      symbol: nextSymbol.trim().toUpperCase(),
      interval: nextInterval,
      horizon: String(horizon),
      confidence: String(confidence),
      includeOptions: includeOptions ? "1" : "0",
    });
    const response = await fetch(`/api/market-visuals?${params.toString()}`, {
      cache: "no-store",
    });
    const payload = await response.json();
    if (!response.ok) throw new Error(payload.error ?? payload.detail ?? `Unable to load ${nextSymbol}.`);
    return payload as MarketPayload;
  }

  async function loadVisuals(includeOptions = optionsRequested || view === "options") {
    setLoading(true);
    setMessage("");

    try {
      const primary = await requestVisuals(symbol, interval, includeOptions);
      setData(primary);
      setOptionsRequested(includeOptions);

      if (view === "compare" && compareSymbol.trim()) {
        const comparison = await requestVisuals(compareSymbol, interval, false);
        setCompareData(comparison);
      }

      setLastRefresh(new Date().toISOString());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load Alpha Vantage market data.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    setOptionsRequested(view === "options");
    void loadVisuals(view === "options");
  }

  useEffect(() => {
    void loadVisuals(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (view === "options" && !optionsRequested) void loadVisuals(true);
    if (view === "compare" && compareSymbol.trim()) void loadVisuals(optionsRequested);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view]);

  useEffect(() => {
    if (!autoRefresh) return;
    const refreshMs = interval === "daily" ? 60_000 : 30_000;
    const timer = window.setInterval(() => void loadVisuals(optionsRequested || view === "options"), refreshMs);
    return () => window.clearInterval(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoRefresh, interval, symbol, compareSymbol, view, optionsRequested, horizon, confidence]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem("slice-pine-lab-projects-v2");
      setPineProjects(raw ? JSON.parse(raw) : []);
    } catch {
      setPineProjects([]);
    }
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem("slice-pine-lab-projects-v2", JSON.stringify(pineProjects));
    } catch {
      // Local project saving is optional.
    }
  }, [pineProjects]);

  const candles = useMemo(() => data?.candles.slice(-320) ?? [], [data]);
  const latest = data?.latest ?? null;
  const quote = data?.quote ?? null;

  const forecastChart = useMemo(() => {
    const history = candles.slice(-70).map((candle) => ({
      label: candle.label,
      close: candle.close,
      projected: null,
      lower: null,
      upper: null,
      bearish: null,
      bullish: null,
    }));
    const forecast =
      data?.forecast.points.map((point) => ({
        label: point.label,
        close: null,
        projected: point.projected,
        lower: point.lower,
        upper: point.upper,
        bearish: point.bearish,
        bullish: point.bullish,
      })) ?? [];
    return [...history, ...forecast];
  }, [candles, data]);

  const technicalScores = useMemo(() => {
    if (!latest || !data) return [];
    const price = quote?.price ?? latest.close;
    const trendScore = [latest.ema9, latest.ema21, latest.sma20, latest.sma50, latest.sma200]
      .filter((value): value is number => value !== null)
      .reduce((score, value) => score + (price >= value ? 20 : 5), 0);
    const rsiScore = latest.rsi14 === null ? 50 : latest.rsi14 >= 50 && latest.rsi14 <= 70 ? 80 : latest.rsi14 < 30 ? 65 : 40;
    const macdScore = latest.macdHistogram === null ? 50 : latest.macdHistogram > 0 ? 80 : 35;
    const volumeRatio = latest.volumeSma20 ? latest.volume / latest.volumeSma20 : 1;
    const volumeScore = Math.max(10, Math.min(100, volumeRatio * 65));
    const levelScore = data.levels.resistance && data.levels.support
      ? Math.max(10, Math.min(100, 50 + ((price - data.levels.support) / Math.max(data.levels.resistance - data.levels.support, 0.01) - 0.5) * 50))
      : 50;

    return [
      { name: "Trend", score: Math.min(100, trendScore) },
      { name: "RSI", score: rsiScore },
      { name: "MACD", score: macdScore },
      { name: "Volume", score: volumeScore },
      { name: "Price Range", score: levelScore },
      { name: "Data Quality", score: data.quality.score },
      { name: "Forecast", score: data.forecast.modelConfidence },
    ];
  }, [data, latest, quote]);

  const normalizedCompare = useMemo(() => {
    if (!data || !compareData) return [];
    const primary = data.candles.slice(-180);
    const secondary = compareData.candles.slice(-180);
    const length = Math.min(primary.length, secondary.length);
    const a = primary.slice(-length);
    const b = secondary.slice(-length);
    const aBase = a[0]?.close || 1;
    const bBase = b[0]?.close || 1;

    return a.map((row, index) => {
      const primaryReturn = (row.close / aBase - 1) * 100;
      const compareReturn = ((b[index]?.close ?? bBase) / bBase - 1) * 100;
      return {
        label: row.label,
        primaryReturn,
        compareReturn,
        spread: primaryReturn - compareReturn,
      };
    });
  }, [data, compareData]);

  const latestRows = useMemo(() => [...candles].reverse().slice(0, 100), [candles]);

  function marketContext() {
    return {
      price: quote?.price,
      changePct: quote?.changePct,
      session: data?.marketSession.session,
      directionalBias: data?.signals.directionalBias,
      trend: data?.signals.trend,
      momentum: data?.signals.momentum,
      support: data?.levels.support,
      resistance: data?.levels.resistance,
      rsi14: latest?.rsi14,
      sma20: latest?.sma20,
      sma50: latest?.sma50,
      sma200: latest?.sma200,
      ema9: latest?.ema9,
      ema21: latest?.ema21,
      vwap: latest?.vwap,
      atr14: latest?.atr14,
      forecastProbabilityUp: data?.forecast.probabilityUp,
      forecastExpectedMovePct: data?.forecast.expectedMovePct,
      forecastConfidence: data?.forecast.modelConfidence,
      asOf: data?.freshness.asOf,
    };
  }

  async function generatePine() {
    setPineLoading(true);
    setMessage("");
    setPineWarnings([]);

    try {
      const response = await fetch("/api/market-visuals/pine", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "generate-pine-script",
        },
        body: JSON.stringify({
          symbol,
          interval,
          prompt: pinePrompt,
          scriptType: pineType,
          existingCode: pineCode,
          marketContext: marketContext(),
        }),
      });
      const result = await response.json();
      if (!response.ok) throw new Error(result.detail ?? result.error ?? "OpenAI Pine generation failed.");
      setPineCode(result.code);
      setPineWarnings(Array.isArray(result.warnings) ? result.warnings : []);
      setMessage(`Pine Script v6 generated with ${result.model}.`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "OpenAI Pine generation failed.");
    } finally {
      setPineLoading(false);
    }
  }

  async function copyPine() {
    try {
      await navigator.clipboard.writeText(pineCode);
      setMessage("Pine Script copied.");
    } catch {
      setMessage("Copy failed. Select the code and copy it manually.");
    }
  }

  function savePine() {
    const project: PineProject = {
      id: `pine-${Date.now()}`,
      name: `${symbol.toUpperCase()} ${pineType} ${new Date().toLocaleDateString("en-US")}`,
      symbol: symbol.toUpperCase(),
      interval,
      scriptType: pineType,
      prompt: pinePrompt,
      code: pineCode,
      createdAt: new Date().toISOString(),
    };
    setPineProjects((current) => [project, ...current].slice(0, 40));
    setMessage("Pine project saved locally.");
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[#050505] px-4 py-5 text-white md:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_8%_0%,rgba(153,27,27,0.48),transparent_30%),radial-gradient(circle_at_88%_4%,rgba(6,182,212,0.16),transparent_26%),radial-gradient(circle_at_55%_100%,rgba(124,58,237,0.08),transparent_30%),linear-gradient(145deg,#030303,#09090b_48%,#111827)]" />
      <div className="pointer-events-none fixed inset-0 opacity-[0.035] [background-image:linear-gradient(rgba(255,255,255,.5)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,.5)_1px,transparent_1px)] [background-size:46px_46px]" />

      <div className="relative mx-auto grid max-w-[1900px] gap-5">
        <header className="rounded-[2rem] border border-white/10 bg-black/72 p-5 shadow-2xl shadow-red-950/25 backdrop-blur-xl md:p-7">
          <div className="flex min-w-0 flex-col gap-5 2xl:flex-row 2xl:items-start 2xl:justify-between">
            <div className="min-w-0">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-[0.22em] text-red-400">
                <Activity className="h-4 w-4" />
                SLICE Alpha Vantage Market OS
              </div>
              <h1 className="mt-3 break-words text-4xl font-black tracking-tight md:text-6xl">
                Real-time market visuals without mixed or fabricated data.
              </h1>
              <p className="mt-3 max-w-5xl text-sm font-medium leading-7 text-slate-400 md:text-base">
                Quotes, candles, technicals, fundamentals, earnings, news sentiment, options, comparisons, and quantitative forecasts all originate from the configured Alpha Vantage account. Pine Lab uses the server-side OpenAI API to create Pine Script v6.
              </p>
            </div>

            <a
              href="/workspace"
              className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-white px-5 py-3 text-sm font-black text-zinc-950 hover:bg-red-50"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to workspace
            </a>
          </div>

          <form onSubmit={submit} className="mt-5 grid min-w-0 gap-3 md:grid-cols-2 xl:grid-cols-[150px_150px_130px_130px_180px_auto_auto]">
            <div className="relative min-w-0">
              <Search className="absolute left-3 top-3.5 h-4 w-4 text-slate-600" />
              <input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                className={cx(INPUT, "pl-10")}
                placeholder="Symbol"
              />
            </div>
            <select value={interval} onChange={(event) => setInterval(event.target.value)} className={INPUT}>
              <option value="1min">1 minute</option>
              <option value="5min">5 minutes</option>
              <option value="15min">15 minutes</option>
              <option value="30min">30 minutes</option>
              <option value="60min">60 minutes</option>
              <option value="daily">Daily</option>
            </select>
            <select value={horizon} onChange={(event) => setHorizon(Number(event.target.value))} className={INPUT}>
              <option value={10}>10-step forecast</option>
              <option value={20}>20-step forecast</option>
              <option value={30}>30-step forecast</option>
              <option value={60}>60-step forecast</option>
            </select>
            <select value={confidence} onChange={(event) => setConfidence(Number(event.target.value))} className={INPUT}>
              <option value={68}>68% band</option>
              <option value={80}>80% band</option>
              <option value={90}>90% band</option>
              <option value={95}>95% band</option>
              <option value={99}>99% band</option>
            </select>
            <button
              type="button"
              onClick={() => setAutoRefresh((current) => !current)}
              className={cx(BUTTON, autoRefresh && "border-emerald-400/25 bg-emerald-400/10 text-emerald-100")}
            >
              <RefreshCw className={cx("h-4 w-4", loading && "animate-spin")} />
              {autoRefresh ? "Auto-refresh on" : "Auto-refresh off"}
            </button>
            <button disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/30 hover:bg-red-500 disabled:opacity-40">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Activity className="h-4 w-4" />}
              Refresh market
            </button>
            <Badge value={data?.freshness.status ?? "unavailable"}>
              {data?.freshness.status ?? "Connecting"}
            </Badge>
          </form>
        </header>

        {message ? (
          <div className="flex items-start justify-between gap-3 rounded-2xl border border-red-400/25 bg-red-400/10 p-4 text-sm font-bold text-red-100">
            <span>{message}</span>
            <button type="button" onClick={() => setMessage("")}><X className="h-4 w-4" /></button>
          </div>
        ) : null}

        <section className="grid min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <Metric
            label="Live price"
            value={money(quote?.price)}
            helper={`${percent(quote?.changePct)} · ${quote?.session ?? "—"}`}
            icon={quote?.changePct && quote.changePct >= 0 ? <TrendingUp className="h-5 w-5" /> : <TrendingDown className="h-5 w-5" />}
            metricTone={quote?.changePct && quote.changePct >= 0 ? "green" : "red"}
          />
          <Metric label="Volume" value={compact(quote?.volume)} helper={quote?.source ?? "Alpha Vantage"} icon={<BarChart3 className="h-5 w-5" />} metricTone="cyan" />
          <Metric label="Bias" value={data?.signals.directionalBias ?? "—"} helper={data?.signals.trend ?? "—"} icon={<Target className="h-5 w-5" />} metricTone={tone(data?.signals.directionalBias)} />
          <Metric label="Forecast up" value={percent(data?.forecast.probabilityUp, 1, false)} helper={`${data?.forecast.modelConfidence ?? 0}/100 model confidence`} icon={<BrainCircuit className="h-5 w-5" />} metricTone="purple" />
          <Metric label="Data quality" value={`${data?.quality.score ?? 0}/100`} helper={`${data?.quality.calls.filter((call) => call.status !== "unavailable").length ?? 0} provider sections`} icon={<ShieldCheck className="h-5 w-5" />} metricTone={tone(data?.quality.score)} />
          <Metric label="As of" value={data?.freshness.asOf ? dateTime(data.freshness.asOf) : "—"} helper={lastRefresh ? `UI refreshed ${dateTime(lastRefresh)}` : "Awaiting refresh"} icon={<RefreshCw className="h-5 w-5" />} metricTone="slate" />
        </section>

        <nav className="flex min-w-0 gap-2 overflow-x-auto rounded-[1.6rem] border border-white/10 bg-black/55 p-2">
          {TABS.map((tab) => {
            const Icon = tab.icon;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={cx(
                  "min-w-[150px] rounded-2xl px-4 py-3 text-left transition",
                  view === tab.id ? "bg-white text-zinc-950" : "text-slate-300 hover:bg-white/[0.06]",
                )}
              >
                <div className="flex items-center gap-2 text-sm font-black"><Icon className="h-4 w-4" />{tab.label}</div>
                <div className={cx("mt-1 text-xs", view === tab.id ? "text-slate-600" : "text-slate-500")}>{tab.helper}</div>
              </button>
            );
          })}
        </nav>

        {loading && !data ? (
          <Panel className="grid min-h-[600px] place-items-center p-8 text-center">
            <div>
              <Loader2 className="mx-auto h-9 w-9 animate-spin text-red-300" />
              <h2 className="mt-4 text-2xl font-black">Loading Alpha Vantage market data</h2>
              <p className="mt-2 text-sm text-slate-500">Retrieving entitled quotes, OHLCV history, fundamentals, earnings, and sentiment.</p>
            </div>
          </Panel>
        ) : data ? (
          <>
            {view === "overview" ? (
              <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1.25fr)_minmax(360px,0.75fr)]">
                <Panel>
                  <SectionHeader
                    eyebrow="Alpha Vantage live overview"
                    title={`${data.company.name || data.symbol} · ${data.symbol}`}
                    description={data.freshness.message}
                    action={<Badge value={data.isRealtime ? "green" : data.freshness.status}>{data.isRealtime ? "Realtime entitled" : data.freshness.status}</Badge>}
                  />
                  <div className="h-[520px] p-4 md:p-6">
                    {candles.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={candles.slice(-220)}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                          <XAxis dataKey="label" minTickGap={24} stroke="#64748b" fontSize={11} />
                          <YAxis domain={["auto", "auto"]} stroke="#64748b" fontSize={11} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area type="monotone" dataKey="close" name="Close" stroke="#ef4444" fill="#ef4444" fillOpacity={0.12} strokeWidth={3} />
                          <Line type="monotone" dataKey="vwap" name="VWAP" stroke="#06b6d4" dot={false} connectNulls strokeWidth={2} />
                          <Line type="monotone" dataKey="sma20" name="SMA 20" stroke="#22c55e" dot={false} connectNulls />
                          <Line type="monotone" dataKey="sma50" name="SMA 50" stroke="#f59e0b" dot={false} connectNulls />
                          <ReferenceLine y={data.levels.support ?? undefined} stroke="#22c55e" strokeDasharray="5 5" />
                          <ReferenceLine y={data.levels.resistance ?? undefined} stroke="#ef4444" strokeDasharray="5 5" />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : <ChartEmpty message="No Alpha Vantage candle data is available." />}
                  </div>
                </Panel>

                <div className="grid min-w-0 content-start gap-5">
                  <Panel>
                    <SectionHeader eyebrow="Market state" title="Live tape and levels" />
                    <div className="grid gap-3 p-5 sm:grid-cols-2 2xl:grid-cols-1">
                      <Metric label="Open" value={money(quote?.open)} helper="Current session" />
                      <Metric label="High / Low" value={`${money(quote?.high)} / ${money(quote?.low)}`} helper="Alpha Vantage quote" />
                      <Metric label="Support" value={money(data.levels.support)} helper={`${percent(data.levels.distanceToSupportPct, 2, false)} below`} />
                      <Metric label="Resistance" value={money(data.levels.resistance)} helper={`${percent(data.levels.distanceToResistancePct, 2, false)} above`} />
                      <Metric label="RSI 14" value={number(latest?.rsi14)} helper={data.signals.momentum} />
                      <Metric label="ATR 14" value={money(latest?.atr14)} helper={data.signals.volatility} />
                    </div>
                  </Panel>
                  <Panel>
                    <div className="p-5">
                      <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.16em] text-cyan-300"><CheckCircle2 className="h-4 w-4" />Source integrity</div>
                      <p className="mt-3 text-sm leading-7 text-slate-400">{data.signals.summary}</p>
                      <div className="mt-4 flex flex-wrap gap-2">
                        <Badge value="cyan">{quote?.source || "Alpha Vantage"}</Badge>
                        <Badge value={data.quality.score}>{data.quality.score}/100 quality</Badge>
                        <Badge value={data.marketSession.session}>{data.marketSession.session}</Badge>
                      </div>
                    </div>
                  </Panel>
                </div>
              </div>
            ) : null}

            {view === "chart" ? (
              <div className="grid min-w-0 gap-5">
                <Panel>
                  <SectionHeader
                    eyebrow="Entitled OHLCV"
                    title={`${data.symbol} ${data.interval} price structure`}
                    description="All lines and bars are calculated from Alpha Vantage candles; the newest candle is reconciled to the real-time quote."
                    action={<Badge value={data.freshness.status}>{dateTime(data.freshness.asOf)}</Badge>}
                  />
                  <div className="h-[620px] p-4 md:p-6">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={candles}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                        <XAxis dataKey="label" minTickGap={28} stroke="#64748b" fontSize={11} />
                        <YAxis yAxisId="price" domain={["auto", "auto"]} stroke="#64748b" fontSize={11} />
                        <YAxis yAxisId="volume" orientation="right" stroke="#475569" fontSize={10} />
                        <Tooltip content={<CustomTooltip />} />
                        <Area yAxisId="price" type="monotone" dataKey="close" name="Close" stroke="#ef4444" fill="#ef4444" fillOpacity={0.1} strokeWidth={3} />
                        <Line yAxisId="price" type="monotone" dataKey="high" name="High" stroke="#22c55e" dot={false} strokeOpacity={0.35} />
                        <Line yAxisId="price" type="monotone" dataKey="low" name="Low" stroke="#f43f5e" dot={false} strokeOpacity={0.35} />
                        <Line yAxisId="price" type="monotone" dataKey="ema9" name="EMA 9" stroke="#a3e635" dot={false} connectNulls />
                        <Line yAxisId="price" type="monotone" dataKey="ema21" name="EMA 21" stroke="#38bdf8" dot={false} connectNulls />
                        <Line yAxisId="price" type="monotone" dataKey="sma50" name="SMA 50" stroke="#f59e0b" dot={false} connectNulls />
                        <Line yAxisId="price" type="monotone" dataKey="sma200" name="SMA 200" stroke="#a855f7" dot={false} connectNulls />
                        <Line yAxisId="price" type="monotone" dataKey="vwap" name="VWAP" stroke="#06b6d4" dot={false} connectNulls strokeWidth={2} />
                        <Bar yAxisId="volume" dataKey="volume" name="Volume" fill="#475569" fillOpacity={0.35} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>
            ) : null}

            {view === "forecast" ? (
              <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1.2fr)_minmax(360px,0.8fr)]">
                <Panel>
                  <SectionHeader
                    eyebrow="Quantitative forecast"
                    title={`${data.forecast.confidenceLevel}% probability envelope`}
                    description={data.forecast.methodology}
                    action={<Badge value={data.forecast.modelConfidence}>{data.forecast.modelConfidence}/100 model quality</Badge>}
                  />
                  <div className="h-[580px] p-4 md:p-6">
                    {forecastChart.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={forecastChart}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                          <XAxis dataKey="label" minTickGap={18} stroke="#64748b" fontSize={11} />
                          <YAxis domain={["auto", "auto"]} stroke="#64748b" fontSize={11} />
                          <Tooltip content={<CustomTooltip />} />
                          <Line type="monotone" dataKey="close" name="History" stroke="#ffffff" dot={false} strokeWidth={2} connectNulls />
                          <Area type="monotone" dataKey="upper" name="Upper band" stroke="#22c55e" fill="#22c55e" fillOpacity={0.06} dot={false} connectNulls />
                          <Area type="monotone" dataKey="lower" name="Lower band" stroke="#ef4444" fill="#ef4444" fillOpacity={0.06} dot={false} connectNulls />
                          <Line type="monotone" dataKey="projected" name="Base forecast" stroke="#a855f7" dot={false} strokeWidth={3} connectNulls />
                          <Line type="monotone" dataKey="bullish" name="Bull scenario" stroke="#22c55e" dot={false} strokeDasharray="5 5" connectNulls />
                          <Line type="monotone" dataKey="bearish" name="Bear scenario" stroke="#ef4444" dot={false} strokeDasharray="5 5" connectNulls />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : <ChartEmpty message="Not enough Alpha Vantage history to create a forecast." />}
                  </div>
                </Panel>

                <div className="grid min-w-0 content-start gap-5">
                  <Panel>
                    <SectionHeader eyebrow="Probability summary" title="Forecast diagnostics" />
                    <div className="grid gap-3 p-5 sm:grid-cols-2 2xl:grid-cols-1">
                      <Metric label="Probability up" value={percent(data.forecast.probabilityUp, 2, false)} helper={`${data.forecast.horizon} forecast steps`} />
                      <Metric label="Expected move" value={percent(data.forecast.expectedMovePct)} helper="Base path" />
                      <Metric label="Lower / upper" value={`${percent(data.forecast.lowerMovePct)} / ${percent(data.forecast.upperMovePct)}`} helper={`${data.forecast.confidenceLevel}% band`} />
                      <Metric label="Annualized volatility" value={percent(data.forecast.annualizedVolatilityPct, 2, false)} helper="From Alpha Vantage returns" />
                      <Metric label="Directional backtest" value={percent(data.forecast.directionalBacktestPct, 1, false)} helper="Recent one-step history" />
                      <Metric label="Drift per step" value={percent(data.forecast.driftPerStepPct, 4)} helper="EWMA estimate" />
                    </div>
                  </Panel>
                  <Panel>
                    <div className="grid gap-3 p-5">
                      {data.forecast.scenarios.map((scenario) => (
                        <div key={scenario.name} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                          <div className="flex items-center justify-between gap-3">
                            <Badge value={scenario.name === "Bull" ? "green" : scenario.name === "Bear" ? "red" : "purple"}>{scenario.name}</Badge>
                            <div className="text-xl font-black">{money(scenario.target)}</div>
                          </div>
                          <div className="mt-2 text-sm font-black text-slate-300">{percent(scenario.movePct)}</div>
                          <p className="mt-2 text-xs leading-5 text-slate-500">{scenario.description}</p>
                        </div>
                      ))}
                    </div>
                  </Panel>
                </div>
              </div>
            ) : null}

            {view === "technicals" ? (
              <div className="grid min-w-0 gap-5 xl:grid-cols-[minmax(0,1fr)_minmax(380px,0.8fr)]">
                <Panel>
                  <SectionHeader eyebrow="Technical score stack" title="Indicators computed from Alpha Vantage candles" description={data.signals.summary} />
                  <div className="h-[520px] p-5">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={technicalScores}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} />
                        <YAxis domain={[0, 100]} stroke="#64748b" fontSize={11} />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={70} stroke="#22c55e" strokeDasharray="5 5" />
                        <Bar dataKey="score" name="Score" radius={[10, 10, 0, 0]}>
                          {technicalScores.map((row) => <Cell key={row.name} fill={row.score >= 70 ? "#22c55e" : row.score >= 45 ? "#f59e0b" : "#ef4444"} fillOpacity={0.82} />)}
                        </Bar>
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
                <Panel>
                  <SectionHeader eyebrow="Latest indicators" title={`${data.symbol} technical state`} />
                  <div className="grid gap-3 p-5 sm:grid-cols-2">
                    <Metric label="SMA 20" value={money(latest?.sma20)} helper={latest?.sma20 && quote ? `${percent((quote.price / latest.sma20 - 1) * 100)} vs price` : "—"} />
                    <Metric label="SMA 50" value={money(latest?.sma50)} helper={data.signals.trend} />
                    <Metric label="SMA 200" value={money(latest?.sma200)} helper="Long-term trend" />
                    <Metric label="EMA 9 / 21" value={`${money(latest?.ema9)} / ${money(latest?.ema21)}`} helper="Tactical trend" />
                    <Metric label="VWAP" value={money(latest?.vwap)} helper={latest?.vwap && quote ? `${percent((quote.price / latest.vwap - 1) * 100)} vs price` : "—"} />
                    <Metric label="RSI 14" value={number(latest?.rsi14)} helper={data.signals.momentum} />
                    <Metric label="MACD" value={number(latest?.macd, 4)} helper={`Histogram ${number(latest?.macdHistogram, 4)}`} />
                    <Metric label="ATR 14" value={money(latest?.atr14)} helper={data.signals.volatility} />
                    <Metric label="Bollinger upper" value={money(latest?.bollingerUpper)} helper={`Middle ${money(latest?.bollingerMiddle)}`} />
                    <Metric label="Bollinger lower" value={money(latest?.bollingerLower)} helper={`Range ${percent(latest?.rangePct, 2, false)}`} />
                    <Metric label="Volume / avg" value={latest?.volumeSma20 ? `${number(latest.volume / latest.volumeSma20, 2)}x` : "—"} helper={data.signals.volume} />
                    <Metric label="Cumulative return" value={percent(latest?.cumulativeReturnPct)} helper={`${candles.length} displayed candles`} />
                  </div>
                </Panel>
              </div>
            ) : null}

            {view === "fundamentals" ? (
              <div className="grid min-w-0 gap-5 2xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
                <Panel>
                  <SectionHeader eyebrow="Alpha Vantage OVERVIEW" title={data.company.name || data.symbol} description={data.company.description || "Company overview is unavailable from Alpha Vantage."} action={<Badge value={data.company.available ? "green" : "red"}>{data.company.available ? "Current filing data" : "Unavailable"}</Badge>} />
                  <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-3">
                    <Metric label="Market cap" value={compact(data.company.marketCapitalization)} helper={data.company.exchange || "—"} />
                    <Metric label="P/E" value={number(data.company.peRatio)} helper={`Forward ${number(data.company.forwardPE)}`} />
                    <Metric label="EPS" value={money(data.company.eps)} helper={`Diluted TTM ${money(data.company.dilutedEPSTTM)}`} />
                    <Metric label="Revenue TTM" value={compact(data.company.revenueTTM)} helper={`YoY ${ratioPercent(data.company.quarterlyRevenueGrowthYOY)}`} />
                    <Metric label="Profit margin" value={ratioPercent(data.company.profitMargin)} helper={`Operating ${ratioPercent(data.company.operatingMarginTTM)}`} />
                    <Metric label="ROE" value={ratioPercent(data.company.returnOnEquityTTM)} helper={`ROA ${ratioPercent(data.company.returnOnAssetsTTM)}`} />
                    <Metric label="Dividend yield" value={ratioPercent(data.company.dividendYield)} helper={`Per share ${money(data.company.dividendPerShare)}`} />
                    <Metric label="Analyst target" value={money(data.company.analystTargetPrice)} helper={quote ? `${percent(data.company.analystTargetPrice ? (data.company.analystTargetPrice / quote.price - 1) * 100 : null)} vs live` : "—"} />
                    <Metric label="Beta" value={number(data.company.beta)} helper={`${money(data.company.week52Low)}–${money(data.company.week52High)} 52-week`} />
                    <Metric label="Price / sales" value={number(data.company.priceToSalesRatioTTM)} helper={`Price/book ${number(data.company.priceToBookRatio)}`} />
                    <Metric label="EV / EBITDA" value={number(data.company.evToEBITDA)} helper={`EV/revenue ${number(data.company.evToRevenue)}`} />
                    <Metric label="Shares outstanding" value={compact(data.company.sharesOutstanding)} helper={`Latest quarter ${data.company.latestQuarter || "—"}`} />
                  </div>
                </Panel>
                <Panel>
                  <SectionHeader eyebrow="Alpha Vantage EARNINGS" title="Reported EPS and surprises" action={<Badge value={data.earnings.available ? "green" : "red"}>{data.earnings.quarterly.length} quarters</Badge>} />
                  <div className="h-[390px] p-5">
                    {data.earnings.quarterly.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={[...data.earnings.quarterly].reverse()}>
                          <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                          <XAxis dataKey="fiscalDateEnding" stroke="#64748b" fontSize={10} />
                          <YAxis stroke="#64748b" fontSize={11} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="reportedEPS" name="Reported EPS" fill="#22c55e" fillOpacity={0.75} />
                          <Line type="monotone" dataKey="estimatedEPS" name="Estimated EPS" stroke="#06b6d4" strokeWidth={2} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    ) : <ChartEmpty message="Alpha Vantage did not return earnings history for this symbol." />}
                  </div>
                  <div className="overflow-x-auto px-5 pb-5">
                    <table className="w-full min-w-[650px] text-left text-xs">
                      <thead className="text-slate-500"><tr><th className="p-2">Quarter</th><th className="p-2">Reported</th><th className="p-2">Estimate</th><th className="p-2">Surprise</th><th className="p-2">Surprise %</th></tr></thead>
                      <tbody>{data.earnings.quarterly.slice(0, 8).map((row) => <tr key={`${row.fiscalDateEnding}-${row.reportedDate}`} className="border-t border-white/10"><td className="p-2 font-bold">{row.fiscalDateEnding}</td><td className="p-2">{money(row.reportedEPS)}</td><td className="p-2">{money(row.estimatedEPS)}</td><td className="p-2">{money(row.surprise)}</td><td className="p-2">{percent(row.surprisePercentage)}</td></tr>)}</tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            ) : null}

            {view === "news" ? (
              <Panel>
                <SectionHeader eyebrow="Alpha Vantage NEWS_SENTIMENT" title={`${data.symbol} live news and sentiment`} description="Article titles, timestamps, relevance, and ticker sentiment are returned by Alpha Vantage; SLICE does not invent missing articles." action={<Badge value={data.news.weightedSentiment !== null && data.news.weightedSentiment >= 0.15 ? "green" : data.news.weightedSentiment !== null && data.news.weightedSentiment <= -0.15 ? "red" : "amber"}>Weighted sentiment {number(data.news.weightedSentiment, 4)}</Badge>} />
                <div className="grid gap-3 p-5 lg:grid-cols-2 2xl:grid-cols-3">
                  {data.news.articles.map((article) => (
                    <article key={`${article.url}-${article.publishedAt}`} className="min-w-0 rounded-2xl border border-white/10 bg-white/[0.035] p-4">
                      <div className="flex flex-wrap gap-2"><Badge value={article.sentimentLabel}>{article.sentimentLabel}</Badge><Badge value="cyan">Relevance {number(article.relevanceScore, 3)}</Badge></div>
                      <h3 className="mt-3 break-words text-base font-black leading-6">{article.title}</h3>
                      <div className="mt-2 text-xs text-slate-500">{article.source} · {dateTime(article.publishedAt)}</div>
                      <p className="mt-3 line-clamp-4 text-sm leading-6 text-slate-400">{article.summary}</p>
                      <div className="mt-3 flex flex-wrap gap-1.5">{article.topics.map((topic) => <span key={topic} className="rounded-md bg-white/[0.055] px-2 py-1 text-[9px] font-black text-slate-400">{topic}</span>)}</div>
                      {article.url ? <a href={article.url} target="_blank" rel="noreferrer" className="mt-4 inline-flex text-xs font-black text-cyan-300 hover:text-cyan-200">Open source article →</a> : null}
                    </article>
                  ))}
                  {!data.news.articles.length ? <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm font-bold text-slate-500 lg:col-span-2 2xl:col-span-3">Alpha Vantage did not return matching news.</div> : null}
                </div>
              </Panel>
            ) : null}

            {view === "options" ? (
              <Panel>
                <SectionHeader eyebrow="Alpha Vantage REALTIME_OPTIONS" title={`${data.symbol} real-time options chain`} description="Real-time options require an Alpha Vantage plan that includes the REALTIME_OPTIONS endpoint. If the plan is not entitled, SLICE shows the provider error rather than simulated contracts." action={<Badge value={data.options.available ? "green" : "red"}>{data.options.available ? `${data.options.contractCount} contracts` : "Not available"}</Badge>} />
                {data.options.available ? (
                  <>
                    <div className="grid gap-3 p-5 sm:grid-cols-2 xl:grid-cols-5">
                      <Metric label="Call volume" value={compact(data.options.callVolume)} helper="Returned contracts" />
                      <Metric label="Put volume" value={compact(data.options.putVolume)} helper="Returned contracts" />
                      <Metric label="Put / call" value={number(data.options.putCallVolumeRatio, 3)} helper="Volume ratio" />
                      <Metric label="Average IV" value={ratioPercent(data.options.averageImpliedVolatility)} helper="Available Greeks" />
                      <Metric label="Expirations" value={data.options.expirations.length} helper={data.options.expirations[0] || "—"} />
                    </div>
                    <div className="max-h-[650px] overflow-auto px-5 pb-5">
                      <table className="w-full min-w-[1200px] text-left text-xs">
                        <thead className="sticky top-0 bg-zinc-950 text-slate-500"><tr>{["Contract","Type","Expiry","Strike","Bid","Ask","Mark","Volume","OI","IV","Delta","Gamma","Theta","Vega"].map((header) => <th key={header} className="p-2">{header}</th>)}</tr></thead>
                        <tbody>{data.options.contracts.map((contract) => <tr key={contract.contractId} className="border-t border-white/10"><td className="p-2 font-bold">{contract.contractId}</td><td className="p-2 uppercase">{contract.type}</td><td className="p-2">{contract.expiration}</td><td className="p-2">{money(contract.strike)}</td><td className="p-2">{money(contract.bid)}</td><td className="p-2">{money(contract.ask)}</td><td className="p-2">{money(contract.mark)}</td><td className="p-2">{compact(contract.volume)}</td><td className="p-2">{compact(contract.openInterest)}</td><td className="p-2">{ratioPercent(contract.impliedVolatility)}</td><td className="p-2">{number(contract.delta, 4)}</td><td className="p-2">{number(contract.gamma, 4)}</td><td className="p-2">{number(contract.theta, 4)}</td><td className="p-2">{number(contract.vega, 4)}</td></tr>)}</tbody>
                      </table>
                    </div>
                  </>
                ) : (
                  <div className="m-5 rounded-2xl border border-red-400/25 bg-red-400/10 p-6 text-sm leading-7 text-red-100">
                    <div className="flex items-center gap-2 font-black"><AlertTriangle className="h-5 w-5" />Options data unavailable</div>
                    <p className="mt-2">{data.options.error || "The Alpha Vantage response did not contain an options chain. Confirm that the paid plan includes REALTIME_OPTIONS and Greeks access."}</p>
                  </div>
                )}
              </Panel>
            ) : null}

            {view === "compare" ? (
              <Panel>
                <SectionHeader eyebrow="Relative performance" title={`${data.symbol} versus ${compareSymbol.toUpperCase()}`} description="Both series are independently requested from Alpha Vantage and normalized to a common starting value." action={<form onSubmit={(event) => { event.preventDefault(); void loadVisuals(optionsRequested); }} className="flex gap-2"><input value={compareSymbol} onChange={(event) => setCompareSymbol(event.target.value.toUpperCase())} className={cx(INPUT, "w-32")} /><button className={BUTTON}>Compare</button></form>} />
                <div className="h-[600px] p-5">
                  {normalizedCompare.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={normalizedCompare}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,.08)" />
                        <XAxis dataKey="label" minTickGap={25} stroke="#64748b" fontSize={11} />
                        <YAxis stroke="#64748b" fontSize={11} />
                        <Tooltip content={<CustomTooltip />} />
                        <ReferenceLine y={0} stroke="#64748b" />
                        <Line type="monotone" dataKey="primaryReturn" name={`${data.symbol} return %`} stroke="#ef4444" dot={false} strokeWidth={3} />
                        <Line type="monotone" dataKey="compareReturn" name={`${compareSymbol.toUpperCase()} return %`} stroke="#06b6d4" dot={false} strokeWidth={3} />
                        <Area type="monotone" dataKey="spread" name="Relative spread %" stroke="#a855f7" fill="#a855f7" fillOpacity={0.08} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : <ChartEmpty message="Load a comparison symbol to calculate relative performance." />}
                </div>
              </Panel>
            ) : null}

            {view === "pine" ? (
              <div className="grid min-w-0 gap-5 2xl:grid-cols-[420px_minmax(0,1fr)_360px]">
                <Panel className="h-fit 2xl:sticky 2xl:top-5">
                  <SectionHeader eyebrow="OpenAI Pine Lab" title="Generate Pine Script v6" action={<Badge value={data.pineLab.openAiConfigured ? "green" : "red"}>{data.pineLab.openAiConfigured ? data.pineLab.model : "OPENAI_API_KEY missing"}</Badge>} />
                  <div className="grid gap-4 p-5">
                    <select value={pineType} onChange={(event) => setPineType(event.target.value as "indicator" | "strategy")} className={INPUT}><option value="indicator">Indicator</option><option value="strategy">Strategy</option></select>
                    <textarea value={pinePrompt} onChange={(event) => setPinePrompt(event.target.value)} className={cx(INPUT, "min-h-[220px] leading-6")} placeholder="Describe the Pine indicator or strategy..." />
                    <div className="rounded-2xl border border-cyan-400/20 bg-cyan-400/10 p-4 text-xs leading-6 text-cyan-100"><div className="font-black">Live context sent to OpenAI</div><p className="mt-1">{data.symbol} · {data.interval} · {money(quote?.price)} · {data.signals.directionalBias} · RSI {number(latest?.rsi14)} · forecast up {percent(data.forecast.probabilityUp, 1, false)}</p></div>
                    <button type="button" onClick={() => void generatePine()} disabled={pineLoading || !data.pineLab.openAiConfigured} className="inline-flex items-center justify-center gap-2 rounded-xl bg-violet-600 px-4 py-4 text-sm font-black text-white hover:bg-violet-500 disabled:opacity-40">{pineLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}Generate with OpenAI</button>
                    <div className="grid grid-cols-2 gap-2"><button type="button" onClick={() => void copyPine()} className={BUTTON}><Clipboard className="h-4 w-4" />Copy</button><button type="button" onClick={savePine} className={BUTTON}><Save className="h-4 w-4" />Save</button></div>
                    <button type="button" onClick={() => { setPineCode(defaultPine(symbol)); setPineWarnings([]); }} className={BUTTON}><RefreshCw className="h-4 w-4" />Reset template</button>
                  </div>
                </Panel>

                <Panel>
                  <SectionHeader eyebrow="Pine editor" title={`${symbol.toUpperCase()} ${pineType}`} description="Generated code uses TradingView Pine Script v6. Paste it into TradingView Pine Editor and compile before use." />
                  <div className="p-5"><textarea value={pineCode} onChange={(event) => setPineCode(event.target.value)} spellCheck={false} className="min-h-[780px] w-full resize-y rounded-2xl border border-white/10 bg-black/70 p-5 font-mono text-xs leading-6 text-emerald-100 outline-none ring-violet-500 focus:ring-2" /></div>
                  {pineWarnings.length ? <div className="mx-5 mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-xs leading-6 text-amber-100">{pineWarnings.map((warning) => <div key={warning}>• {warning}</div>)}</div> : null}
                </Panel>

                <Panel className="h-fit 2xl:sticky 2xl:top-5">
                  <SectionHeader eyebrow="Saved locally" title="Pine projects" action={<Badge value="purple">{pineProjects.length}</Badge>} />
                  <div className="max-h-[760px] space-y-2 overflow-y-auto p-3">
                    {pineProjects.map((project) => <div key={project.id} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="text-sm font-black">{project.name}</div><div className="mt-1 text-xs text-slate-500">{project.symbol} · {project.interval} · {project.scriptType}</div><div className="mt-3 grid grid-cols-2 gap-2"><button type="button" onClick={() => { setPineCode(project.code); setPinePrompt(project.prompt); setPineType(project.scriptType); }} className={BUTTON}><FileCode2 className="h-4 w-4" />Load</button><button type="button" onClick={() => setPineProjects((current) => current.filter((item) => item.id !== project.id))} className="inline-flex items-center justify-center rounded-xl border border-red-400/20 bg-red-400/10 px-3 py-2 text-xs font-black text-red-100">Delete</button></div></div>)}
                    {!pineProjects.length ? <div className="rounded-2xl border border-dashed border-white/10 p-7 text-center text-sm font-bold text-slate-500">No Pine projects saved yet.</div> : null}
                  </div>
                </Panel>
              </div>
            ) : null}

            {view === "data" ? (
              <div className="grid min-w-0 gap-5">
                <Panel>
                  <SectionHeader eyebrow="Provider integrity" title="Every requested source and its status" description="Unavailable endpoints remain unavailable; SLICE does not replace them with demo values." action={<Badge value={data.quality.score}>{data.quality.score}/100 quality</Badge>} />
                  <div className="grid gap-3 p-5 md:grid-cols-2 xl:grid-cols-4">
                    {data.quality.calls.map((call) => <div key={call.endpoint} className="rounded-2xl border border-white/10 bg-white/[0.035] p-4"><div className="flex items-center justify-between gap-2"><div className="truncate text-sm font-black">{call.endpoint}</div><Badge value={call.status}>{call.status}</Badge></div><div className="mt-2 text-xs text-slate-500">{call.asOf ? dateTime(call.asOf) : "No timestamp"}</div>{call.error ? <p className="mt-3 break-words text-xs leading-5 text-red-200">{call.error}</p> : null}</div>)}
                  </div>
                  {data.quality.warnings.length ? <div className="mx-5 mb-5 rounded-2xl border border-amber-400/20 bg-amber-400/10 p-4 text-sm leading-7 text-amber-100">{data.quality.warnings.map((warning) => <div key={warning}>• {warning}</div>)}</div> : null}
                </Panel>
                <Panel>
                  <SectionHeader eyebrow="Alpha Vantage candle table" title={`${latestRows.length} latest enriched observations`} description="Raw OHLCV comes from Alpha Vantage; technical columns are calculated deterministically from that same series." />
                  <div className="max-h-[720px] overflow-auto p-5">
                    <table className="w-full min-w-[1500px] text-left text-xs">
                      <thead className="sticky top-0 bg-zinc-950 text-slate-500"><tr>{["Time","Open","High","Low","Close","Volume","SMA20","SMA50","SMA200","EMA9","EMA21","VWAP","RSI","MACD Hist","ATR","Return %"].map((header) => <th key={header} className="p-2">{header}</th>)}</tr></thead>
                      <tbody>{latestRows.map((row) => <tr key={`${row.date}-${row.close}`} className="border-t border-white/10"><td className="p-2 font-bold">{dateTime(row.date)}</td><td className="p-2">{money(row.open)}</td><td className="p-2">{money(row.high)}</td><td className="p-2">{money(row.low)}</td><td className="p-2 font-black">{money(row.close)}</td><td className="p-2">{compact(row.volume)}</td><td className="p-2">{money(row.sma20)}</td><td className="p-2">{money(row.sma50)}</td><td className="p-2">{money(row.sma200)}</td><td className="p-2">{money(row.ema9)}</td><td className="p-2">{money(row.ema21)}</td><td className="p-2">{money(row.vwap)}</td><td className="p-2">{number(row.rsi14)}</td><td className="p-2">{number(row.macdHistogram, 4)}</td><td className="p-2">{money(row.atr14)}</td><td className="p-2">{percent(row.returnPct)}</td></tr>)}</tbody>
                    </table>
                  </div>
                </Panel>
              </div>
            ) : null}
          </>
        ) : null}

        <footer className="rounded-2xl border border-white/10 bg-black/45 p-4 text-xs leading-6 text-slate-500">
          Forecasts are quantitative estimates derived from Alpha Vantage OHLCV and are not guarantees, trade instructions, or client recommendations. Fundamentals update when issuers report financials; news and options availability depend on the Alpha Vantage subscription and exchange entitlements.
        </footer>
      </div>
    </main>
  );
}