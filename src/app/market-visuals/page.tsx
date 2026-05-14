"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  Brush,
  CartesianGrid,
  Cell,
  ComposedChart,
  Legend,
  Line,
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type ViewMode = "dashboard" | "trader" | "forecast" | "platform" | "data";
type CandleLimit = 40 | 80 | 120 | 180;

type MarketVisualPayload = {
  symbol: string;
  interval: string;
  provider: string;
  isLive: boolean;
  note: string;
  sourcePriority: string[];
  dataPolicy: {
    realTimeRequiresProvider: boolean;
    demoFallbackEnabled: boolean;
    accuracyReminder: string;
  };
  marketSession: {
    session: string;
    description: string;
    isRegularMarket: boolean;
    isExtendedHours: boolean;
    timezone: string;
  };
  freshness: {
    status: string;
    asOf: string | null;
    ageMinutes: number | null;
    warning: string;
  };
  quality: {
    score: number;
    warnings: string[];
  };
  quote: {
    symbol: string;
    price: number | null;
    change: number | null;
    changePct: number | null;
    latestTradingDay: string | null;
    previousClose: number | null;
    open: number | null;
    high: number | null;
    low: number | null;
    volume: number | null;
    provider: string;
  } | null;
  levels: {
    support: number;
    resistance: number;
    midpoint: number;
    distanceToSupportPct: number;
    distanceToResistancePct: number;
  };
  signals: {
    directionalBias: string;
    momentum: string;
    riskState: string;
    summary: string;
  };
  modelConfidence: number;
  latest: {
    close: number;
    chartClose: number;
    change: number;
    changePct: number;
    rsi14: number | null;
    vwap: number | null;
    sma20: number | null;
    sma50: number | null;
    macd: number | null;
    asOf: string;
  } | null;
  candles: Array<{
    date: string;
    label: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    sma20: number | null;
    sma50: number | null;
    ema9: number | null;
    vwap: number | null;
    rsi14: number | null;
    macd: number | null;
    macdSignal: number | null;
    macdHistogram: number | null;
    bollingerUpper: number | null;
    bollingerLower: number | null;
  }>;
  predictions: Array<{
    date: string;
    label: string;
    projected: number;
    upper: number;
    lower: number;
  }>;
  platform: {
    platformOverview: Array<{ name: string; value: number }>;
    taskStatusCounts: Array<{ name: string; value: number }>;
    alertScores: Array<{
      name: string;
      title: string;
      score: number;
      urgency: string;
      source: string;
    }>;
    opportunityMatrix: Array<{
      name: string;
      title: string;
      opportunity: number;
      risk: number;
      composite: number;
      confidence: number;
      source: string;
    }>;
    sourceCredibility?: Array<{
      name: string;
      sourceName: string;
      domain: string;
      credibility: number;
      transparency: number;
      biasRisk: number;
      status: string;
    }>;
    watchlistHeatmap?: Array<{
      symbol: string;
      priority: string;
      status: string;
      sourceType: string;
      score: number;
    }>;
  };
};

const COLORS = {
  bg: "#09090b",
  grid: "rgba(255,255,255,0.08)",
  text: "#cbd5e1",
  muted: "#94a3b8",
  red: "#ef4444",
  redSoft: "rgba(239, 68, 68, 0.18)",
  green: "#22c55e",
  greenSoft: "rgba(34, 197, 94, 0.18)",
  amber: "#f59e0b",
  amberSoft: "rgba(245, 158, 11, 0.18)",
  cyan: "#06b6d4",
  cyanSoft: "rgba(6, 182, 212, 0.18)",
  purple: "#a855f7",
  purpleSoft: "rgba(168, 85, 247, 0.18)",
  blue: "#3b82f6",
  pink: "#ec4899",
  slate: "#64748b",
  white: "#f8fafc",
};

const BAR_COLORS = [
  COLORS.red,
  COLORS.cyan,
  COLORS.purple,
  COLORS.green,
  COLORS.amber,
  COLORS.blue,
  COLORS.pink,
  COLORS.slate,
];

const VIEW_TABS: Array<{
  id: ViewMode;
  label: string;
  description: string;
}> = [
  {
    id: "dashboard",
    label: "Dashboard",
    description: "Everything important",
  },
  {
    id: "trader",
    label: "Trader Charts",
    description: "Price, volume, RSI, MACD",
  },
  {
    id: "forecast",
    label: "Forecast",
    description: "Projection and levels",
  },
  {
    id: "platform",
    label: "Platform Intelligence",
    description: "Alerts, sources, watchlists",
  },
  {
    id: "data",
    label: "Data Table",
    description: "Candle detail",
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(value) >= 10 ? 2 : 4,
  }).format(value || 0);
}

function compactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";

  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  }).format(value);
}

function signed(value: number | null | undefined, suffix = "") {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value}${suffix}`;
}

function timeAgo(dateString: string | null) {
  if (!dateString) return "No timestamp";

  const minutes = Math.round((Date.now() - new Date(dateString).getTime()) / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);

  if (hours < 48) return `${hours}h ago`;

  return new Date(dateString).toLocaleString();
}

function percent(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function toneFor(value: string | number): "red" | "green" | "amber" | "purple" | "cyan" | "slate" {
  const text = String(value).toLowerCase();

  if (text.includes("fresh") || text.includes("live") || text.includes("regular") || text.includes("bullish") || text.includes("ready")) {
    return "green";
  }

  if (text.includes("stale") || text.includes("demo") || text.includes("closed") || text.includes("bearish") || text.includes("missing") || text.includes("failed")) {
    return "red";
  }

  if (text.includes("mixed") || text.includes("after") || text.includes("pre") || text.includes("warning") || text.includes("market closed")) {
    return "amber";
  }

  if (text.includes("ai") || text.includes("opportunity") || text.includes("forecast")) {
    return "purple";
  }

  if (text.includes("provider") || text.includes("backend") || text.includes("quality")) {
    return "cyan";
  }

  return "slate";
}

function qualityTone(score: number): "red" | "green" | "amber" | "purple" | "cyan" | "slate" {
  if (score >= 80) return "green";
  if (score >= 60) return "amber";
  return "red";
}

function changeTone(value: number | null | undefined): "red" | "green" | "slate" {
  if (value === null || value === undefined) return "slate";
  if (value > 0) return "green";
  if (value < 0) return "red";
  return "slate";
}

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "red" | "green" | "amber" | "purple" | "cyan" | "slate";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1",
        tones[tone]
      )}
    >
      {children}
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-xl shadow-red-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "red" | "green" | "amber" | "purple" | "cyan" | "slate";
}) {
  const glows = {
    red: "from-red-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    cyan: "from-cyan-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div
        className={cx(
          "absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent",
          glows[tone]
        )}
      />
      <div className="relative">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function ChartHeader({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow: string;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="mb-5 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
      <div>
        <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
          {eyebrow}
        </div>
        <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">{description}</p>
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/95 p-3 text-xs text-white shadow-xl shadow-black/40">
      <div className="mb-2 font-black text-slate-200">{label}</div>
      <div className="grid gap-1">
        {payload.map((item: any, index: number) => (
          <div key={`${item.dataKey}-${index}`} className="flex items-center justify-between gap-5">
            <span className="flex items-center gap-2 text-slate-400">
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ backgroundColor: item.color || item.fill || BAR_COLORS[index % BAR_COLORS.length] }}
              />
              {item.name || item.dataKey}
            </span>
            <span className="font-black text-white">
              {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

function EmptyChart({ label = "No chart data available yet." }: { label?: string }) {
  return (
    <div className="flex h-full min-h-[260px] items-center justify-center rounded-[1.5rem] border border-dashed border-white/10 bg-white/[0.025] p-6 text-center text-sm font-bold text-slate-500">
      {label}
    </div>
  );
}

function ChartToggle({
  label,
  enabled,
  onClick,
  tone = "cyan",
}: {
  label: string;
  enabled: boolean;
  onClick: () => void;
  tone?: "red" | "green" | "amber" | "purple" | "cyan" | "slate";
}) {
  const active = {
    red: "border-red-500/40 bg-red-500/15 text-red-100",
    green: "border-emerald-500/40 bg-emerald-500/15 text-emerald-100",
    amber: "border-amber-500/40 bg-amber-500/15 text-amber-100",
    purple: "border-purple-500/40 bg-purple-500/15 text-purple-100",
    cyan: "border-cyan-500/40 bg-cyan-500/15 text-cyan-100",
    slate: "border-slate-500/40 bg-slate-500/15 text-slate-100",
  };

  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "rounded-2xl border px-3 py-2 text-xs font-black transition",
        enabled
          ? active[tone]
          : "border-white/10 bg-white/[0.04] text-slate-400 hover:bg-white/[0.07]"
      )}
    >
      {label}
    </button>
  );
}

export default function MarketVisualsPage() {
  const [symbol, setSymbol] = useState("NVDA");
  const [compareSymbol, setCompareSymbol] = useState("AAPL");
  const [showCompare, setShowCompare] = useState(false);
  const [interval, setInterval] = useState("5min");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [view, setView] = useState<ViewMode>("dashboard");
  const [candleLimit, setCandleLimit] = useState<CandleLimit>(80);
  const [data, setData] = useState<MarketVisualPayload | null>(null);
  const [compareData, setCompareData] = useState<MarketVisualPayload | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastLoadedAt, setLastLoadedAt] = useState<string | null>(null);

  const [overlays, setOverlays] = useState({
    sma20: true,
    sma50: true,
    ema9: false,
    vwap: true,
    bollinger: true,
    support: true,
    resistance: true,
  });

  async function fetchVisuals(nextSymbol: string, nextInterval: string) {
    const params = new URLSearchParams({
      symbol: nextSymbol,
      interval: nextInterval,
    });

    const response = await fetch(`/api/market-visuals?${params.toString()}`, {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      throw new Error(payload.error ?? `Could not load ${nextSymbol}.`);
    }

    return payload as MarketVisualPayload;
  }

  async function loadVisuals(nextSymbol = symbol, nextInterval = interval) {
    setLoading(true);
    setMessage("");

    try {
      const primary = await fetchVisuals(nextSymbol.toUpperCase(), nextInterval);
      setData(primary);

      if (showCompare && compareSymbol.trim()) {
        const comparison = await fetchVisuals(compareSymbol.toUpperCase(), nextInterval);
        setCompareData(comparison);
      } else {
        setCompareData(null);
      }

      setLastLoadedAt(new Date().toISOString());
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not load market visuals.");
    } finally {
      setLoading(false);
    }
  }

  function submit(event: FormEvent) {
    event.preventDefault();
    void loadVisuals(symbol.toUpperCase(), interval);
  }

  useEffect(() => {
    void loadVisuals();
  }, []);

  useEffect(() => {
    if (!autoRefresh) return;

    const id = window.setInterval(() => {
      void loadVisuals(symbol.toUpperCase(), interval);
    }, interval === "daily" ? 300000 : 60000);

    return () => window.clearInterval(id);
  }, [autoRefresh, interval, symbol, showCompare, compareSymbol]);

  const latest = data?.latest ?? null;

  const chartData = useMemo(() => data?.candles.slice(-candleLimit) ?? [], [data, candleLimit]);
  const compareChartData = useMemo(() => compareData?.candles.slice(-candleLimit) ?? [], [compareData, candleLimit]);

  const compareOverlayData = useMemo(() => {
    if (!showCompare || !compareChartData.length || !chartData.length) return chartData;

    return chartData.map((point, index) => {
      const comparisonPoint = compareChartData[index + Math.max(0, compareChartData.length - chartData.length)];

      return {
        ...point,
        [`${compareData?.symbol ?? "Compare"} Close`]: comparisonPoint?.close ?? null,
      };
    });
  }, [chartData, compareChartData, compareData?.symbol, showCompare]);

  const predictionChartData = useMemo(
    () => [
      ...(data?.candles.slice(-50).map((item) => ({
        label: item.label,
        close: item.close,
        projected: null,
        upper: null,
        lower: null,
      })) ?? []),
      ...(data?.predictions.map((item) => ({
        label: item.label,
        close: null,
        projected: item.projected,
        upper: item.upper,
        lower: item.lower,
      })) ?? []),
    ],
    [data]
  );

  const radarData = [
    {
      metric: "RSI",
      value: latest?.rsi14 ?? 50,
      fullMark: 100,
    },
    {
      metric: "Trend",
      value:
        latest?.sma20 && latest?.sma50
          ? Math.max(0, Math.min(100, 50 + (latest.sma20 - latest.sma50) * 2))
          : 50,
      fullMark: 100,
    },
    {
      metric: "MACD",
      value: latest?.macd ? Math.max(0, Math.min(100, 50 + latest.macd * 4)) : 50,
      fullMark: 100,
    },
    {
      metric: "VWAP",
      value:
        latest?.vwap && latest.close
          ? Math.max(0, Math.min(100, 50 + (latest.close - latest.vwap) * 2))
          : 50,
      fullMark: 100,
    },
    {
      metric: "Confidence",
      value: data?.modelConfidence ?? 50,
      fullMark: 100,
    },
  ];

  const technicalScore = useMemo(() => {
    if (!latest) return 50;

    let score = 50;

    if (latest.close && latest.vwap && latest.close > latest.vwap) score += 10;
    if (latest.close && latest.vwap && latest.close < latest.vwap) score -= 10;
    if (latest.sma20 && latest.sma50 && latest.sma20 > latest.sma50) score += 12;
    if (latest.sma20 && latest.sma50 && latest.sma20 < latest.sma50) score -= 12;
    if (latest.rsi14 !== null && latest.rsi14 >= 70) score -= 10;
    if (latest.rsi14 !== null && latest.rsi14 <= 30) score += 8;
    if (latest.macd !== null && latest.macd > 0) score += 6;
    if (latest.macd !== null && latest.macd < 0) score -= 6;

    return Math.max(0, Math.min(100, Math.round(score)));
  }, [latest]);

  const primaryChangeTone = changeTone(latest?.change);
  const platformOverview = data?.platform.platformOverview ?? [];
  const alertScores = data?.platform.alertScores ?? [];
  const opportunityMatrix = data?.platform.opportunityMatrix ?? [];
  const sourceCredibility = data?.platform.sourceCredibility ?? [];
  const watchlistHeatmap = data?.platform.watchlistHeatmap ?? [];
  const taskStatusCounts = data?.platform.taskStatusCounts ?? [];

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.20),_transparent_30%),radial-gradient(circle_at_bottom_left,_rgba(168,85,247,0.16),_transparent_30%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1700px] gap-6">
        <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="pointer-events-none absolute inset-x-0 top-0 h-40 bg-gradient-to-b from-red-600/20 to-transparent" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Slice Market Visuals
              </div>
              <h1 className="mt-2 text-4xl font-black md:text-6xl">
                Market intelligence, beautifully visualized.
              </h1>
              <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400">
                One clean command center for live-aware quotes, technical charts, trend overlays, volume,
                RSI, MACD, VWAP, Bollinger bands, prediction ranges, source credibility, watchlist heat,
                alert intensity, opportunity risk, and backend data-quality warnings.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href="/workspace" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">
                Workspace
              </a>
              <a href="/watchlist-alerts" className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-100">
                Price Alerts
              </a>
              <a href="/advisor-command-center" className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100">
                AI Command
              </a>
              <a href="/backend-kernel" className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100">
                Backend Kernel
              </a>
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <Card>
          <form onSubmit={submit} className="grid gap-3 xl:grid-cols-[1fr_1fr_190px_190px_auto]">
            <input
              value={symbol}
              onChange={(event) => setSymbol(event.target.value.toUpperCase())}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
              placeholder="Primary ticker, e.g. NVDA"
            />

            <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
              <input
                value={compareSymbol}
                onChange={(event) => setCompareSymbol(event.target.value.toUpperCase())}
                disabled={!showCompare}
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-cyan-500 placeholder:text-slate-600 focus:ring-2 disabled:opacity-40"
                placeholder="Compare ticker, e.g. AAPL"
              />
              <button
                type="button"
                onClick={() => setShowCompare((current) => !current)}
                className={cx(
                  "rounded-2xl border px-4 py-3 text-xs font-black",
                  showCompare
                    ? "border-cyan-500/40 bg-cyan-500/15 text-cyan-100"
                    : "border-white/10 bg-white/[0.04] text-slate-400"
                )}
              >
                Compare {showCompare ? "On" : "Off"}
              </button>
            </div>

            <select
              value={interval}
              onChange={(event) => setInterval(event.target.value)}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
            >
              <option value="1min">1 minute</option>
              <option value="5min">5 minutes</option>
              <option value="15min">15 minutes</option>
              <option value="30min">30 minutes</option>
              <option value="60min">60 minutes</option>
              <option value="daily">Daily</option>
            </select>

            <select
              value={candleLimit}
              onChange={(event) => setCandleLimit(Number(event.target.value) as CandleLimit)}
              className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
            >
              <option value={40}>Last 40 candles</option>
              <option value={80}>Last 80 candles</option>
              <option value={120}>Last 120 candles</option>
              <option value={180}>Last 180 candles</option>
            </select>

            <button
              disabled={loading}
              className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
            >
              {loading ? "Loading..." : "Load Visuals"}
            </button>
          </form>

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setAutoRefresh((current) => !current)}
              className={cx(
                "rounded-2xl border px-4 py-2 text-xs font-black",
                autoRefresh
                  ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                  : "border-white/10 bg-white/5 text-white"
              )}
            >
              Auto-refresh {autoRefresh ? "On" : "Off"}
            </button>

            {data ? (
              <>
                <Pill tone={data.isLive ? "green" : "amber"}>{data.provider}</Pill>
                <Pill tone="purple">{data.symbol}</Pill>
                {showCompare && compareData ? <Pill tone="cyan">vs {compareData.symbol}</Pill> : null}
                <Pill tone={toneFor(data.freshness.status)}>{data.freshness.status}</Pill>
                <Pill tone={toneFor(data.marketSession.session)}>{data.marketSession.session}</Pill>
                <span className="text-xs font-semibold leading-6 text-slate-500">
                  Loaded {timeAgo(lastLoadedAt)} · Candle as of {timeAgo(data.freshness.asOf)}
                </span>
              </>
            ) : null}
          </div>
        </Card>

        {data ? (
          <>
            <nav className="grid gap-2 rounded-[2rem] border border-white/10 bg-black/40 p-2 backdrop-blur-xl sm:grid-cols-2 xl:grid-cols-5">
              {VIEW_TABS.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setView(tab.id)}
                  className={cx(
                    "rounded-2xl px-4 py-3 text-left transition",
                    view === tab.id
                      ? "bg-white text-slate-950 shadow-lg shadow-red-950/20"
                      : "bg-white/[0.045] text-white hover:bg-white/[0.08]"
                  )}
                >
                  <div className="truncate text-sm font-black">{tab.label}</div>
                  <div className={cx("mt-1 truncate text-[10px] font-semibold", view === tab.id ? "text-slate-600" : "text-slate-500")}>
                    {tab.description}
                  </div>
                </button>
              ))}
            </nav>

            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-8">
              <Metric label="Last" value={money(latest?.close)} helper={data.quote?.price ? "Quote validated" : "Chart close"} tone="purple" />
              <Metric label="Change" value={signed(latest?.change)} helper={percent(latest?.changePct)} tone={primaryChangeTone} />
              <Metric label="Quality" value={`${data.quality.score}%`} helper="Data quality" tone={qualityTone(data.quality.score)} />
              <Metric label="Session" value={data.marketSession.session} helper={data.marketSession.description} tone={toneFor(data.marketSession.session)} />
              <Metric label="Technical" value={`${technicalScore}%`} helper={data.signals.directionalBias} tone={qualityTone(technicalScore)} />
              <Metric label="Model" value={`${data.modelConfidence}%`} helper="Forecast confidence" tone={qualityTone(data.modelConfidence)} />
              <Metric label="RSI 14" value={latest?.rsi14 ?? "—"} helper={data.signals.riskState} tone={latest?.rsi14 && latest.rsi14 >= 70 ? "red" : latest?.rsi14 && latest.rsi14 <= 30 ? "green" : "amber"} />
              <Metric label="Volume" value={compactNumber(data.quote?.volume ?? chartData[chartData.length - 1]?.volume)} helper="Latest volume" tone="cyan" />
            </section>

            {(view === "dashboard" || view === "trader") ? (
              <Card>
                <ChartHeader
                  eyebrow="Main Price Dashboard"
                  title={`${data.symbol} price action with overlays`}
                  description="Toggle moving averages, VWAP, Bollinger bands, support/resistance, and optional comparison ticker. This is the ideal primary chart for visual learners."
                  action={
                    <div className="flex flex-wrap gap-2">
                      <ChartToggle label="SMA 20" enabled={overlays.sma20} onClick={() => setOverlays((current) => ({ ...current, sma20: !current.sma20 }))} tone="cyan" />
                      <ChartToggle label="SMA 50" enabled={overlays.sma50} onClick={() => setOverlays((current) => ({ ...current, sma50: !current.sma50 }))} tone="purple" />
                      <ChartToggle label="EMA 9" enabled={overlays.ema9} onClick={() => setOverlays((current) => ({ ...current, ema9: !current.ema9 }))} tone="amber" />
                      <ChartToggle label="VWAP" enabled={overlays.vwap} onClick={() => setOverlays((current) => ({ ...current, vwap: !current.vwap }))} tone="green" />
                      <ChartToggle label="Bands" enabled={overlays.bollinger} onClick={() => setOverlays((current) => ({ ...current, bollinger: !current.bollinger }))} tone="slate" />
                      <ChartToggle label="Levels" enabled={overlays.support || overlays.resistance} onClick={() => setOverlays((current) => ({ ...current, support: !current.support, resistance: !current.resistance }))} tone="red" />
                    </div>
                  }
                />

                <div className="h-[520px]">
                  {chartData.length ? (
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={compareOverlayData}>
                        <defs>
                          <linearGradient id="closeGradient" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.red} stopOpacity={0.36} />
                            <stop offset="95%" stopColor={COLORS.red} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                        <XAxis dataKey="label" tick={{ fill: COLORS.muted, fontSize: 11 }} minTickGap={24} />
                        <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} domain={["auto", "auto"]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ color: COLORS.text, fontSize: 12 }} />

                        <Area
                          name={`${data.symbol} Close`}
                          type="monotone"
                          dataKey="close"
                          fill="url(#closeGradient)"
                          stroke={COLORS.red}
                          strokeWidth={3}
                          dot={false}
                        />

                        {showCompare && compareData ? (
                          <Line
                            name={`${compareData.symbol} Close`}
                            type="monotone"
                            dataKey={`${compareData.symbol} Close`}
                            dot={false}
                            stroke={COLORS.cyan}
                            strokeWidth={2.5}
                            strokeDasharray="8 5"
                          />
                        ) : null}

                        {overlays.ema9 ? <Line name="EMA 9" type="monotone" dataKey="ema9" dot={false} stroke={COLORS.amber} strokeWidth={2} /> : null}
                        {overlays.sma20 ? <Line name="SMA 20" type="monotone" dataKey="sma20" dot={false} stroke={COLORS.cyan} strokeWidth={2} /> : null}
                        {overlays.sma50 ? <Line name="SMA 50" type="monotone" dataKey="sma50" dot={false} stroke={COLORS.purple} strokeWidth={2} /> : null}
                        {overlays.vwap ? <Line name="VWAP" type="monotone" dataKey="vwap" dot={false} stroke={COLORS.green} strokeWidth={2.4} /> : null}
                        {overlays.bollinger ? <Line name="Bollinger Upper" type="monotone" dataKey="bollingerUpper" dot={false} stroke={COLORS.slate} strokeWidth={1.4} strokeDasharray="4 4" /> : null}
                        {overlays.bollinger ? <Line name="Bollinger Lower" type="monotone" dataKey="bollingerLower" dot={false} stroke={COLORS.slate} strokeWidth={1.4} strokeDasharray="4 4" /> : null}
                        {overlays.support ? <ReferenceLine y={data.levels.support} stroke={COLORS.green} strokeDasharray="6 5" label={{ value: "Support", fill: COLORS.green, fontSize: 11 }} /> : null}
                        {overlays.resistance ? <ReferenceLine y={data.levels.resistance} stroke={COLORS.red} strokeDasharray="6 5" label={{ value: "Resistance", fill: COLORS.red, fontSize: 11 }} /> : null}
                        <Brush dataKey="label" height={28} stroke={COLORS.red} fill="#18181b" travellerWidth={10} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  ) : (
                    <EmptyChart />
                  )}
                </div>
              </Card>
            ) : null}

            {view === "dashboard" ? (
              <>
                <section className="grid gap-6 xl:grid-cols-[0.75fr_1.25fr]">
                  <Card>
                    <ChartHeader
                      eyebrow="Accuracy Console"
                      title="Provider, freshness, and risk"
                      description="Before making any decision, this panel tells you whether the data is live, stale, delayed, simulated, or missing."
                    />

                    <div className="grid gap-3">
                      <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Provider Priority</div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          {data.sourcePriority.map((provider) => (
                            <Pill key={provider} tone={provider.includes("Demo") ? "amber" : "green"}>
                              {provider}
                            </Pill>
                          ))}
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Freshness Warning</div>
                        <p className="mt-2 text-sm leading-6 text-slate-300">{data.freshness.warning}</p>
                      </div>

                      <div className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Signal Summary</div>
                        <div className="mt-2 text-xl font-black text-white">{data.signals.directionalBias}</div>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{data.signals.summary}</p>
                      </div>

                      {data.quality.warnings.length ? (
                        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4">
                          <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-200">Quality Notes</div>
                          <ul className="mt-3 grid gap-2 text-sm leading-6 text-amber-100">
                            {data.quality.warnings.map((warning) => (
                              <li key={warning}>• {warning}</li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                    </div>
                  </Card>

                  <Card>
                    <ChartHeader
                      eyebrow="Technical Radar"
                      title="Momentum, trend, VWAP, and confidence"
                      description="A single visual snapshot for quick technical interpretation."
                    />

                    <div className="h-[420px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <RadarChart data={radarData}>
                          <PolarGrid stroke={COLORS.grid} />
                          <PolarAngleAxis dataKey="metric" tick={{ fill: COLORS.text, fontSize: 12 }} />
                          <PolarRadiusAxis tick={{ fill: COLORS.muted, fontSize: 10 }} />
                          <Radar name={data.symbol} dataKey="value" fill={COLORS.purple} fillOpacity={0.22} stroke={COLORS.purple} strokeWidth={3} />
                          <Tooltip content={<CustomTooltip />} />
                          <Legend wrapperStyle={{ color: COLORS.text, fontSize: 12 }} />
                        </RadarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </section>

                <section className="grid gap-6 xl:grid-cols-3">
                  <Card>
                    <ChartHeader
                      eyebrow="Trading Levels"
                      title="Support / resistance"
                      description="Key price areas based on recent candles."
                    />
                    <div className="grid gap-3">
                      <Metric label="Support" value={money(data.levels.support)} helper={`${data.levels.distanceToSupportPct}% below`} tone="green" />
                      <Metric label="Resistance" value={money(data.levels.resistance)} helper={`${data.levels.distanceToResistancePct}% above`} tone="red" />
                      <Metric label="Midpoint" value={money(data.levels.midpoint)} helper="Recent range midpoint" tone="cyan" />
                    </div>
                  </Card>

                  <Card>
                    <ChartHeader
                      eyebrow="Quote Validation"
                      title="Independent quote snapshot"
                      description="Validates the latest chart close when provider quote data is available."
                    />
                    <div className="grid gap-3">
                      <Metric label="Quote Price" value={money(data.quote?.price)} helper={data.quote?.provider ?? "No quote"} tone="purple" />
                      <Metric label="Previous Close" value={money(data.quote?.previousClose)} helper={data.quote?.latestTradingDay ?? "No date"} tone="slate" />
                      <Metric label="Quote Volume" value={compactNumber(data.quote?.volume)} helper="Provider volume" tone="cyan" />
                    </div>
                  </Card>

                  <Card>
                    <ChartHeader
                      eyebrow="Quick Actions"
                      title="Use this insight"
                      description="Jump directly into execution."
                    />
                    <div className="grid gap-3">
                      <a href={`/watchlist-alerts`} className="rounded-2xl bg-white px-4 py-3 text-center text-sm font-black text-slate-950">
                        Create Price Alert
                      </a>
                      <a href={`/workspace/personal-bot`} className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-center text-sm font-black text-purple-100">
                        Ask Bot to Research
                      </a>
                      <a href={`/opportunity-radar`} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-center text-sm font-black text-amber-100">
                        Open Opportunity Radar
                      </a>
                      <a href={`/portfolio-lab`} className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-center text-sm font-black text-emerald-100">
                        Open Portfolio Lab
                      </a>
                    </div>
                  </Card>
                </section>
              </>
            ) : null}

            {view === "trader" ? (
              <>
                <section className="grid gap-6 xl:grid-cols-2">
                  <Card>
                    <ChartHeader
                      eyebrow="Volume"
                      title="Market participation"
                      description="High volume gives context to price moves and alert urgency."
                    />

                    <div className="h-[380px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                          <XAxis dataKey="label" tick={{ fill: COLORS.muted, fontSize: 11 }} minTickGap={24} />
                          <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} tickFormatter={(value) => compactNumber(Number(value))} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar name="Volume" dataKey="volume" radius={[8, 8, 0, 0]}>
                            {chartData.map((item, index) => {
                              const previous = chartData[index - 1]?.close ?? item.open;
                              const up = item.close >= previous;

                              return <Cell key={`${item.date}-vol`} fill={up ? COLORS.green : COLORS.red} />;
                            })}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card>
                    <ChartHeader
                      eyebrow="RSI"
                      title="Overbought / oversold pressure"
                      description="RSI above 70 can indicate overheating; below 30 can indicate oversold pressure."
                    />

                    <div className="h-[380px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ComposedChart data={chartData}>
                          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                          <XAxis dataKey="label" tick={{ fill: COLORS.muted, fontSize: 11 }} minTickGap={24} />
                          <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} domain={[0, 100]} />
                          <Tooltip content={<CustomTooltip />} />
                          <ReferenceLine y={70} stroke={COLORS.red} strokeDasharray="6 4" label={{ value: "70", fill: COLORS.red, fontSize: 11 }} />
                          <ReferenceLine y={30} stroke={COLORS.green} strokeDasharray="6 4" label={{ value: "30", fill: COLORS.green, fontSize: 11 }} />
                          <Line name="RSI 14" type="monotone" dataKey="rsi14" dot={false} stroke={COLORS.amber} strokeWidth={3} />
                        </ComposedChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </section>

                <Card>
                  <ChartHeader
                    eyebrow="MACD"
                    title="Momentum shift"
                    description="MACD line, signal line, and histogram show whether momentum is strengthening or weakening."
                  />

                  <div className="h-[420px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={chartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                        <XAxis dataKey="label" tick={{ fill: COLORS.muted, fontSize: 11 }} minTickGap={24} />
                        <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ color: COLORS.text, fontSize: 12 }} />
                        <ReferenceLine y={0} stroke={COLORS.slate} strokeDasharray="5 5" />
                        <Bar name="MACD Histogram" dataKey="macdHistogram" radius={[6, 6, 0, 0]}>
                          {chartData.map((item) => (
                            <Cell
                              key={`${item.date}-macd`}
                              fill={(item.macdHistogram ?? 0) >= 0 ? COLORS.green : COLORS.red}
                            />
                          ))}
                        </Bar>
                        <Line name="MACD" type="monotone" dataKey="macd" dot={false} stroke={COLORS.cyan} strokeWidth={3} />
                        <Line name="Signal" type="monotone" dataKey="macdSignal" dot={false} stroke={COLORS.purple} strokeWidth={2.5} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>
              </>
            ) : null}

            {view === "forecast" ? (
              <section className="grid gap-6">
                <Card>
                  <ChartHeader
                    eyebrow="Predictive Projection"
                    title="Forward path with volatility bands"
                    description="A visual estimate from recent momentum and volatility. Use as a planning aid, not a guaranteed forecast."
                    action={<Pill tone={qualityTone(data.modelConfidence)}>Confidence {data.modelConfidence}%</Pill>}
                  />

                  <div className="h-[480px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <ComposedChart data={predictionChartData}>
                        <defs>
                          <linearGradient id="projectionBand" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={COLORS.purple} stopOpacity={0.28} />
                            <stop offset="95%" stopColor={COLORS.purple} stopOpacity={0.02} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                        <XAxis dataKey="label" tick={{ fill: COLORS.muted, fontSize: 11 }} minTickGap={18} />
                        <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} domain={["auto", "auto"]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend wrapperStyle={{ color: COLORS.text, fontSize: 12 }} />
                        <Area name="Upper Band" type="monotone" dataKey="upper" fill="url(#projectionBand)" stroke={COLORS.purple} strokeDasharray="4 4" strokeWidth={1.5} />
                        <Line name="Actual Close" type="monotone" dataKey="close" dot={false} stroke={COLORS.red} strokeWidth={3} />
                        <Line name="Projected" type="monotone" dataKey="projected" dot={false} stroke={COLORS.cyan} strokeWidth={3} />
                        <Line name="Lower Band" type="monotone" dataKey="lower" dot={false} stroke={COLORS.purple} strokeDasharray="4 4" strokeWidth={1.5} />
                      </ComposedChart>
                    </ResponsiveContainer>
                  </div>
                </Card>

                <section className="grid gap-6 xl:grid-cols-3">
                  <Card>
                    <ChartHeader
                      eyebrow="Forecast Read"
                      title="Model interpretation"
                      description="A simple read of the forecast context."
                    />
                    <div className="grid gap-3">
                      <Metric label="Bias" value={data.signals.directionalBias} helper={data.signals.momentum} tone={toneFor(data.signals.directionalBias)} />
                      <Metric label="Confidence" value={`${data.modelConfidence}%`} helper="Projection model" tone={qualityTone(data.modelConfidence)} />
                      <Metric label="Data Quality" value={`${data.quality.score}%`} helper={data.freshness.status} tone={qualityTone(data.quality.score)} />
                    </div>
                  </Card>

                  <Card>
                    <ChartHeader
                      eyebrow="Range"
                      title="Support and resistance"
                      description="Distance to key trading levels."
                    />
                    <div className="grid gap-3">
                      <Metric label="Support" value={money(data.levels.support)} helper={`${data.levels.distanceToSupportPct}% away`} tone="green" />
                      <Metric label="Resistance" value={money(data.levels.resistance)} helper={`${data.levels.distanceToResistancePct}% away`} tone="red" />
                      <Metric label="Midpoint" value={money(data.levels.midpoint)} helper="Recent midpoint" tone="cyan" />
                    </div>
                  </Card>

                  <Card>
                    <ChartHeader
                      eyebrow="Warning"
                      title="Decision guardrails"
                      description="Use the prediction correctly."
                    />
                    <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm leading-6 text-amber-100">
                      Forecast visuals are directional analytics. Confirm source freshness, market session,
                      volume confirmation, portfolio exposure, and client suitability before taking action.
                    </div>
                  </Card>
                </section>
              </section>
            ) : null}

            {view === "platform" ? (
              <section className="grid gap-6">
                <section className="grid gap-6 xl:grid-cols-3">
                  <Card>
                    <ChartHeader
                      eyebrow="Platform Overview"
                      title="System data volume"
                      description="A snapshot of major intelligence objects in Slice."
                    />
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={platformOverview}>
                          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                          <XAxis dataKey="name" tick={{ fill: COLORS.muted, fontSize: 11 }} />
                          <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="value" radius={[8, 8, 0, 0]}>
                            {platformOverview.map((_, index) => (
                              <Cell key={`overview-${index}`} fill={BAR_COLORS[index % BAR_COLORS.length]} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card>
                    <ChartHeader
                      eyebrow="Alert Scores"
                      title="Top alert intensity"
                      description="Higher scores suggest greater urgency or relevance."
                    />
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={alertScores}>
                          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                          <XAxis dataKey="name" tick={{ fill: COLORS.muted, fontSize: 11 }} />
                          <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} domain={[0, 100]} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                            {alertScores.map((item, index) => (
                              <Cell key={`alert-${index}`} fill={item.score >= 85 ? COLORS.red : item.score >= 70 ? COLORS.amber : COLORS.cyan} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card>
                    <ChartHeader
                      eyebrow="Task Flow"
                      title="Execution status"
                      description="Operational status across workspace tasks."
                    />
                    <div className="h-[320px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <AreaChart data={taskStatusCounts}>
                          <defs>
                            <linearGradient id="taskGradient" x1="0" y1="0" x2="0" y2="1">
                              <stop offset="5%" stopColor={COLORS.cyan} stopOpacity={0.35} />
                              <stop offset="95%" stopColor={COLORS.cyan} stopOpacity={0.02} />
                            </linearGradient>
                          </defs>
                          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                          <XAxis dataKey="name" tick={{ fill: COLORS.muted, fontSize: 11 }} />
                          <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} />
                          <Tooltip content={<CustomTooltip />} />
                          <Area dataKey="value" fill="url(#taskGradient)" stroke={COLORS.cyan} strokeWidth={3} />
                        </AreaChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>
                </section>

                <section className="grid gap-6 xl:grid-cols-2">
                  <Card>
                    <ChartHeader
                      eyebrow="Opportunity Matrix"
                      title="Risk vs opportunity"
                      description="Each dot represents a stored opportunity signal. Right = higher opportunity. Up = higher risk."
                    />

                    <div className="h-[420px]">
                      <ResponsiveContainer width="100%" height="100%">
                        <ScatterChart>
                          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                          <XAxis type="number" dataKey="opportunity" name="Opportunity" tick={{ fill: COLORS.muted, fontSize: 11 }} domain={[0, 100]} />
                          <YAxis type="number" dataKey="risk" name="Risk" tick={{ fill: COLORS.muted, fontSize: 11 }} domain={[0, 100]} />
                          <Tooltip content={<CustomTooltip />} cursor={{ strokeDasharray: "3 3" }} />
                          <ReferenceLine x={70} stroke={COLORS.green} strokeDasharray="5 5" />
                          <ReferenceLine y={70} stroke={COLORS.red} strokeDasharray="5 5" />
                          <Scatter name="Opportunity Signals" data={opportunityMatrix} fill={COLORS.purple}>
                            {opportunityMatrix.map((item, index) => (
                              <Cell
                                key={`opp-${index}`}
                                fill={
                                  item.composite >= 85
                                    ? COLORS.green
                                    : item.risk >= 80
                                      ? COLORS.red
                                      : item.opportunity >= 75
                                        ? COLORS.cyan
                                        : COLORS.purple
                                }
                              />
                            ))}
                          </Scatter>
                        </ScatterChart>
                      </ResponsiveContainer>
                    </div>
                  </Card>

                  <Card>
                    <ChartHeader
                      eyebrow="Source Credibility"
                      title="Trust and bias profile"
                      description="Credibility, transparency, and bias-risk scores for tracked sources."
                    />

                    <div className="h-[420px]">
                      {sourceCredibility.length ? (
                        <ResponsiveContainer width="100%" height="100%">
                          <ComposedChart data={sourceCredibility}>
                            <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                            <XAxis dataKey="name" tick={{ fill: COLORS.muted, fontSize: 11 }} />
                            <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} domain={[0, 100]} />
                            <Tooltip content={<CustomTooltip />} />
                            <Legend wrapperStyle={{ color: COLORS.text, fontSize: 12 }} />
                            <Bar name="Credibility" dataKey="credibility" radius={[8, 8, 0, 0]} fill={COLORS.green} />
                            <Line name="Transparency" type="monotone" dataKey="transparency" dot={false} stroke={COLORS.cyan} strokeWidth={3} />
                            <Line name="Bias Risk" type="monotone" dataKey="biasRisk" dot={false} stroke={COLORS.red} strokeWidth={3} />
                          </ComposedChart>
                        </ResponsiveContainer>
                      ) : (
                        <EmptyChart label="No source credibility records yet. Run source credibility or triage workflows to populate this chart." />
                      )}
                    </div>
                  </Card>
                </section>

                <Card>
                  <ChartHeader
                    eyebrow="Watchlist Heat"
                    title="Tracked asset intensity"
                    description="Shows which watchlist names are getting the most attention from alerts, priority, bot commands, and radar activity."
                  />

                  <div className="h-[360px]">
                    {watchlistHeatmap.length ? (
                      <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={watchlistHeatmap}>
                          <CartesianGrid strokeDasharray="3 3" stroke={COLORS.grid} />
                          <XAxis dataKey="symbol" tick={{ fill: COLORS.muted, fontSize: 11 }} />
                          <YAxis tick={{ fill: COLORS.muted, fontSize: 11 }} domain={[0, 100]} />
                          <Tooltip content={<CustomTooltip />} />
                          <Bar dataKey="score" radius={[8, 8, 0, 0]}>
                            {watchlistHeatmap.map((item, index) => (
                              <Cell key={`heat-${index}`} fill={item.score >= 85 ? COLORS.red : item.score >= 70 ? COLORS.amber : COLORS.cyan} />
                            ))}
                          </Bar>
                        </BarChart>
                      </ResponsiveContainer>
                    ) : (
                      <EmptyChart label="No watchlist heat data yet. Add tickers to watchlists or create price alerts." />
                    )}
                  </div>
                </Card>
              </section>
            ) : null}

            {view === "data" ? (
              <Card>
                <ChartHeader
                  eyebrow="Raw Candle Data"
                  title={`${data.symbol} candle table`}
                  description="A clean view of recent OHLCV data and computed indicators."
                  action={<Pill tone="cyan">{chartData.length} candles</Pill>}
                />

                <div className="overflow-hidden rounded-[1.5rem] border border-white/10">
                  <div className="max-h-[720px] overflow-auto">
                    <table className="w-full min-w-[1100px] border-collapse text-left text-xs">
                      <thead className="sticky top-0 bg-zinc-950 text-slate-400">
                        <tr>
                          {["Time", "Open", "High", "Low", "Close", "Volume", "SMA20", "SMA50", "VWAP", "RSI", "MACD"].map((heading) => (
                            <th key={heading} className="border-b border-white/10 px-4 py-3 font-black uppercase tracking-[0.14em]">
                              {heading}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {[...chartData].reverse().map((candle) => (
                          <tr key={candle.date} className="border-b border-white/5 odd:bg-white/[0.025] hover:bg-white/[0.06]">
                            <td className="px-4 py-3 font-bold text-white">{candle.label}</td>
                            <td className="px-4 py-3 text-slate-300">{money(candle.open)}</td>
                            <td className="px-4 py-3 text-emerald-300">{money(candle.high)}</td>
                            <td className="px-4 py-3 text-red-300">{money(candle.low)}</td>
                            <td className="px-4 py-3 font-black text-white">{money(candle.close)}</td>
                            <td className="px-4 py-3 text-cyan-300">{compactNumber(candle.volume)}</td>
                            <td className="px-4 py-3 text-cyan-300">{money(candle.sma20)}</td>
                            <td className="px-4 py-3 text-purple-300">{money(candle.sma50)}</td>
                            <td className="px-4 py-3 text-emerald-300">{money(candle.vwap)}</td>
                            <td className="px-4 py-3 text-amber-300">{candle.rsi14 ?? "—"}</td>
                            <td className={cx("px-4 py-3", (candle.macd ?? 0) >= 0 ? "text-emerald-300" : "text-red-300")}>
                              {candle.macd ?? "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </Card>
            ) : null}

            <footer className="pb-8 text-center text-xs font-semibold text-slate-600">
              Slice Market Visuals · interactive technical dashboard · source-aware · data-quality-first
            </footer>
          </>
        ) : null}
      </div>
    </main>
  );
}