"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";
type MetricCategory = "Price" | "Volume" | "Technical" | "Risk" | "Valuation" | "Quality" | "Income" | "Macro" | "Custom";
type MetricUnit = "currency" | "percent" | "ratio" | "score" | "millions" | "billions" | "raw";
type AlertCondition = "above" | "below" | "moves-by" | "between" | "crosses-above" | "crosses-below";
type AlertPriority = "Monitor" | "Important" | "Critical";

type TradingViewSymbol = {
  exchange: string;
  symbol: string;
  full: string;
  display: string;
};

type MetricDefinition = {
  id: string;
  label: string;
  shortLabel: string;
  category: MetricCategory;
  unit: MetricUnit;
  mirrorMode: "quote" | "chart" | "assist";
  searchTerms: string[];
};

type MetricValue = {
  value: number | string | null;
  display: string;
  status: "live" | "chart" | "missing" | "review";
  source: string;
  asOf: string | null;
};

type MarketSnapshot = {
  ok: boolean;
  symbol: string;
  tvSymbol: string;
  provider: string;
  asOf: string | null;
  session: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  summary: string;
  metrics: Record<string, MetricValue>;
};

type MetricAlertConfig = {
  condition: AlertCondition;
  threshold: string;
  upperThreshold: string;
  note: string;
  priority: AlertPriority;
  enabled: boolean;
  lastSavedAt?: string;
  watchlistId?: string;
};

type SelectedMetric = {
  id: string;
  metricId: string;
  alert: MetricAlertConfig;
};

type SavedSymbol = {
  id: string;
  tvSymbol: string;
  label: string;
  note: string;
  createdAt: string;
};

type BoardState = {
  activeSymbol: TradingViewSymbol;
  symbolSearch: string;
  savedSymbols: SavedSymbol[];
  selectedMetrics: SelectedMetric[];
  metricSearch: string;
  metricCategory: MetricCategory | "All";
  expandedMetricId: string | null;
};

type CustomBoardAlert = {
  id: string;
  symbol: string;
  tvSymbol: string;
  metricId: string;
  metricLabel: string;
  condition: AlertCondition;
  threshold: string;
  upperThreshold?: string;
  note: string;
  priority: AlertPriority;
  createdAt: string;
  watchlistId: string;
};

type SharedWorkspaceWatchItem = {
  id: string;
  symbol: string;
  name: string;
  constraint: string;
  targetValue: string;
  note: string;
  source: "Manual" | "Custom Board";
};

const STORAGE_KEY = "slice-custom-advisor-workspace-premium-v1";
const SHARED_WATCHLIST_KEY = "slice-shared-watchlist-v1";
const CUSTOM_BOARD_ALERTS_KEY = "slice-custom-board-alerts-v1";
const MAX_SELECTED_METRICS = 8;

const DEFAULT_SYMBOL: TradingViewSymbol = {
  exchange: "NASDAQ",
  symbol: "AAPL",
  full: "NASDAQ:AAPL",
  display: "AAPL",
};

const DEFAULT_ALERT: MetricAlertConfig = {
  condition: "above",
  threshold: "",
  upperThreshold: "",
  note: "",
  priority: "Important",
  enabled: false,
};

const DEFAULT_SAVED_SYMBOLS: SavedSymbol[] = [
  { id: "watch-spy", tvSymbol: "AMEX:SPY", label: "SPY", note: "Benchmark", createdAt: "Default" },
  { id: "watch-qqq", tvSymbol: "NASDAQ:QQQ", label: "QQQ", note: "Growth", createdAt: "Default" },
  { id: "watch-nvda", tvSymbol: "NASDAQ:NVDA", label: "NVDA", note: "AI", createdAt: "Default" },
  { id: "watch-tlt", tvSymbol: "AMEX:TLT", label: "TLT", note: "Rates", createdAt: "Default" },
  { id: "watch-gld", tvSymbol: "AMEX:GLD", label: "GLD", note: "Gold", createdAt: "Default" },
];

const QUICK_SYMBOLS: SavedSymbol[] = [
  { id: "quick-spx", tvSymbol: "SP:SPX", label: "S&P", note: "Index", createdAt: "Quick" },
  { id: "quick-ndx", tvSymbol: "NASDAQ:NDX", label: "NDX", note: "Index", createdAt: "Quick" },
  { id: "quick-dji", tvSymbol: "TVC:DJI", label: "Dow", note: "Index", createdAt: "Quick" },
  { id: "quick-dxy", tvSymbol: "TVC:DXY", label: "DXY", note: "Macro", createdAt: "Quick" },
  { id: "quick-es", tvSymbol: "CME_MINI:ES1!", label: "ES", note: "Futures", createdAt: "Quick" },
  { id: "quick-btc", tvSymbol: "BINANCE:BTCUSDT", label: "BTC", note: "Crypto", createdAt: "Quick" },
];

const DEFAULT_SELECTED_METRIC_IDS = [
  "last-price",
  "change-pct",
  "volume",
  "rsi-14",
  "macd",
  "sma-50",
  "atr-14",
  "directional-bias",
];

const METRIC_LIBRARY: MetricDefinition[] = [
  { id: "last-price", label: "Last Price", shortLabel: "Price", category: "Price", unit: "currency", mirrorMode: "quote", searchTerms: ["price", "quote"] },
  { id: "change", label: "Price Change", shortLabel: "Change", category: "Price", unit: "currency", mirrorMode: "quote", searchTerms: ["change", "move"] },
  { id: "change-pct", label: "Change %", shortLabel: "Chg %", category: "Price", unit: "percent", mirrorMode: "quote", searchTerms: ["change percent", "return"] },
  { id: "open", label: "Open", shortLabel: "Open", category: "Price", unit: "currency", mirrorMode: "quote", searchTerms: ["open"] },
  { id: "high", label: "High", shortLabel: "High", category: "Price", unit: "currency", mirrorMode: "quote", searchTerms: ["high"] },
  { id: "low", label: "Low", shortLabel: "Low", category: "Price", unit: "currency", mirrorMode: "quote", searchTerms: ["low"] },
  { id: "volume", label: "Volume", shortLabel: "Volume", category: "Volume", unit: "millions", mirrorMode: "quote", searchTerms: ["volume"] },
  { id: "avg-volume", label: "Average Volume", shortLabel: "Avg Vol", category: "Volume", unit: "millions", mirrorMode: "assist", searchTerms: ["average volume"] },
  { id: "rsi-14", label: "RSI 14", shortLabel: "RSI", category: "Technical", unit: "score", mirrorMode: "chart", searchTerms: ["rsi"] },
  { id: "macd", label: "MACD", shortLabel: "MACD", category: "Technical", unit: "raw", mirrorMode: "chart", searchTerms: ["macd"] },
  { id: "sma-20", label: "20 SMA", shortLabel: "SMA20", category: "Technical", unit: "currency", mirrorMode: "chart", searchTerms: ["20 sma"] },
  { id: "sma-50", label: "50 SMA", shortLabel: "SMA50", category: "Technical", unit: "currency", mirrorMode: "chart", searchTerms: ["50 sma"] },
  { id: "sma-200", label: "200 SMA", shortLabel: "SMA200", category: "Technical", unit: "currency", mirrorMode: "chart", searchTerms: ["200 sma"] },
  { id: "ema-21", label: "21 EMA", shortLabel: "EMA21", category: "Technical", unit: "currency", mirrorMode: "chart", searchTerms: ["21 ema"] },
  { id: "vwap", label: "VWAP", shortLabel: "VWAP", category: "Technical", unit: "currency", mirrorMode: "chart", searchTerms: ["vwap"] },
  { id: "atr-14", label: "ATR 14", shortLabel: "ATR", category: "Risk", unit: "currency", mirrorMode: "chart", searchTerms: ["atr"] },
  { id: "beta", label: "Beta", shortLabel: "Beta", category: "Risk", unit: "ratio", mirrorMode: "assist", searchTerms: ["beta"] },
  { id: "market-cap", label: "Market Cap", shortLabel: "Mkt Cap", category: "Valuation", unit: "billions", mirrorMode: "assist", searchTerms: ["market cap"] },
  { id: "pe-ratio", label: "P/E Ratio", shortLabel: "P/E", category: "Valuation", unit: "ratio", mirrorMode: "assist", searchTerms: ["pe ratio"] },
  { id: "eps", label: "EPS", shortLabel: "EPS", category: "Quality", unit: "currency", mirrorMode: "assist", searchTerms: ["eps"] },
  { id: "dividend-yield", label: "Dividend Yield", shortLabel: "Yield", category: "Income", unit: "percent", mirrorMode: "assist", searchTerms: ["dividend yield"] },
  { id: "52-week-high", label: "52W High", shortLabel: "52H", category: "Risk", unit: "currency", mirrorMode: "assist", searchTerms: ["52 week high"] },
  { id: "52-week-low", label: "52W Low", shortLabel: "52L", category: "Risk", unit: "currency", mirrorMode: "assist", searchTerms: ["52 week low"] },
  { id: "directional-bias", label: "Directional Bias", shortLabel: "Bias", category: "Custom", unit: "raw", mirrorMode: "assist", searchTerms: ["bias", "summary"] },
];

const METRIC_CATEGORIES: Array<MetricCategory | "All"> = [
  "All",
  "Price",
  "Volume",
  "Technical",
  "Risk",
  "Valuation",
  "Quality",
  "Income",
  "Macro",
  "Custom",
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function nowLabel() {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function cloneDefaultAlert(): MetricAlertConfig {
  return { ...DEFAULT_ALERT };
}

function loadJson<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function parseTradingViewSymbol(raw: string, fallbackExchange = "NASDAQ"): TradingViewSymbol {
  const cleaned = raw.trim().replace(/\s+/g, "").toUpperCase();

  if (!cleaned) return DEFAULT_SYMBOL;

  if (cleaned.includes(":")) {
    const [exchangePart, ...symbolParts] = cleaned.split(":");
    const exchange = exchangePart.replace(/[^A-Z0-9._-]/g, "") || fallbackExchange;
    const symbol = symbolParts.join(":").replace(/[^A-Z0-9._/!\-$]/g, "") || "AAPL";

    return {
      exchange,
      symbol,
      full: `${exchange}:${symbol}`,
      display: symbol,
    };
  }

  const symbol = cleaned.replace(/[^A-Z0-9._/!\-$]/g, "") || "AAPL";

  return {
    exchange: fallbackExchange,
    symbol,
    full: `${fallbackExchange}:${symbol}`,
    display: symbol,
  };
}

function toneClass(tone: Tone) {
  const tones: Record<Tone, string> = {
    red: "border-red-500/25 bg-red-500/10 text-red-100 shadow-red-950/20",
    green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100 shadow-emerald-950/20",
    amber: "border-amber-500/25 bg-amber-500/10 text-amber-100 shadow-amber-950/20",
    purple: "border-purple-500/25 bg-purple-500/10 text-purple-100 shadow-purple-950/20",
    cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100 shadow-cyan-950/20",
    blue: "border-blue-500/25 bg-blue-500/10 text-blue-100 shadow-blue-950/20",
    slate: "border-slate-500/20 bg-slate-500/10 text-slate-100 shadow-slate-950/20",
  };

  return tones[tone];
}

function dotClass(tone: Tone) {
  const tones: Record<Tone, string> = {
    red: "bg-red-400 shadow-red-400/50",
    green: "bg-emerald-400 shadow-emerald-400/50",
    amber: "bg-amber-400 shadow-amber-400/50",
    purple: "bg-purple-400 shadow-purple-400/50",
    cyan: "bg-cyan-400 shadow-cyan-400/50",
    blue: "bg-blue-400 shadow-blue-400/50",
    slate: "bg-slate-400 shadow-slate-400/50",
  };

  return tones[tone];
}

function categoryTone(category: MetricCategory): Tone {
  const tones: Record<MetricCategory, Tone> = {
    Price: "cyan",
    Volume: "blue",
    Technical: "purple",
    Risk: "red",
    Valuation: "amber",
    Quality: "green",
    Income: "green",
    Macro: "slate",
    Custom: "red",
  };

  return tones[category] ?? "slate";
}

function conditionLabel(condition: AlertCondition) {
  const labels: Record<AlertCondition, string> = {
    above: "Notify above",
    below: "Notify below",
    "moves-by": "Move by",
    between: "Between",
    "crosses-above": "Crosses above",
    "crosses-below": "Crosses below",
  };

  return labels[condition];
}

function priorityTone(priority: AlertPriority): Tone {
  if (priority === "Critical") return "red";
  if (priority === "Important") return "amber";
  return "blue";
}

function metricDisplay(snapshot: MarketSnapshot | null, metric: MetricDefinition) {
  if (!snapshot) {
    return {
      display: "—",
      status: "Loading",
      tone: "amber" as Tone,
      source: "Loading",
      asOf: null,
    };
  }

  const value = snapshot.metrics?.[metric.id];

  if (!value) {
    if (metric.mirrorMode === "chart") {
      return {
        display: "Chart",
        status: "Mirror",
        tone: "purple" as Tone,
        source: "TradingView chart",
        asOf: snapshot.asOf,
      };
    }

    return {
      display: "—",
      status: "Missing",
      tone: "slate" as Tone,
      source: snapshot.provider,
      asOf: snapshot.asOf,
    };
  }

  if (value.status === "chart") {
    return {
      display: value.display || "Chart",
      status: "Mirror",
      tone: "purple" as Tone,
      source: "TradingView chart",
      asOf: value.asOf || snapshot.asOf,
    };
  }

  if (value.status === "live") {
    return {
      display: value.display || "—",
      status: "Live",
      tone: categoryTone(metric.category),
      source: value.source || snapshot.provider,
      asOf: value.asOf || snapshot.asOf,
    };
  }

  return {
    display: value.display || "—",
    status: value.status === "review" ? "Review" : "Missing",
    tone: value.status === "review" ? "amber" as Tone : "slate" as Tone,
    source: value.source || snapshot.provider,
    asOf: value.asOf || snapshot.asOf,
  };
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "relative min-w-0 overflow-hidden rounded-[1.5rem] border border-white/10 bg-zinc-950/76 shadow-2xl shadow-black/30 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cx("inline-flex rounded-full border px-2.5 py-1 text-[10px] font-black uppercase tracking-[0.12em]", toneClass(tone))}>
      {children}
    </span>
  );
}

function TradingViewChart({ symbol }: { symbol: TradingViewSymbol }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.innerHTML = "";

    const widgetContainer = document.createElement("div");
    widgetContainer.className = "tradingview-widget-container__widget";
    container.appendChild(widgetContainer);

    const script = document.createElement("script");
    script.src = "https://s3.tradingview.com/external-embedding/embed-widget-advanced-chart.js";
    script.async = true;
    script.type = "text/javascript";
    script.innerHTML = JSON.stringify({
      autosize: true,
      symbol: symbol.full,
      interval: "5",
      timezone: "America/New_York",
      theme: "dark",
      style: "1",
      locale: "en",
      enable_publishing: false,
      allow_symbol_change: true,
      calendar: false,
      support_host: "https://www.tradingview.com",
      hide_top_toolbar: false,
      hide_side_toolbar: false,
      withdateranges: true,
      details: true,
      hotlist: false,
      studies: ["STD;Volume", "STD;RSI", "STD;MACD"],
    });

    container.appendChild(script);

    return () => {
      container.innerHTML = "";
    };
  }, [symbol.full]);

  return (
    <div
      ref={containerRef}
      className="tradingview-widget-container h-full min-h-[520px] w-full"
      suppressHydrationWarning
    />
  );
}

function buildDefaultBoardState(): BoardState {
  return {
    activeSymbol: DEFAULT_SYMBOL,
    symbolSearch: DEFAULT_SYMBOL.full,
    savedSymbols: DEFAULT_SAVED_SYMBOLS,
    selectedMetrics: DEFAULT_SELECTED_METRIC_IDS.map((metricId) => ({
      id: `selected-${metricId}`,
      metricId,
      alert: cloneDefaultAlert(),
    })),
    metricSearch: "",
    metricCategory: "All",
    expandedMetricId: null,
  };
}

function loadBoardState(): BoardState {
  const fallback = buildDefaultBoardState();

  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<BoardState>;

    const selectedMetrics = Array.isArray(parsed.selectedMetrics)
      ? parsed.selectedMetrics
          .filter((item) => item && typeof item.metricId === "string" && METRIC_LIBRARY.some((metric) => metric.id === item.metricId))
          .slice(0, MAX_SELECTED_METRICS)
          .map((item) => ({
            id: item.id || `selected-${item.metricId}`,
            metricId: item.metricId,
            alert: {
              ...cloneDefaultAlert(),
              ...(item.alert || {}),
            },
          }))
      : fallback.selectedMetrics;

    return {
      ...fallback,
      ...parsed,
      activeSymbol: parsed.activeSymbol ?? fallback.activeSymbol,
      symbolSearch: parsed.symbolSearch ?? parsed.activeSymbol?.full ?? fallback.symbolSearch,
      savedSymbols: Array.isArray(parsed.savedSymbols) ? parsed.savedSymbols : fallback.savedSymbols,
      selectedMetrics,
      metricCategory: parsed.metricCategory ?? fallback.metricCategory,
      expandedMetricId: parsed.expandedMetricId ?? null,
    };
  } catch {
    return fallback;
  }
}

function saveBoardState(state: BoardState) {
  saveJson(STORAGE_KEY, state);
}

function useMarketSnapshot(activeSymbol: TradingViewSymbol, selectedMetricIds: string[]) {
  const [snapshot, setSnapshot] = useState<MarketSnapshot | null>(null);
  const [status, setStatus] = useState<"loading" | "live" | "error">("loading");
  const [message, setMessage] = useState("Loading market rail...");
  const metricKey = selectedMetricIds.join(",");

  useEffect(() => {
    let cancelled = false;

    async function refresh() {
      setStatus("loading");
      setMessage("Refreshing market rail...");

      try {
        const response = await fetch(
          `/api/custom-board/openai-market?symbol=${encodeURIComponent(activeSymbol.display)}&tvSymbol=${encodeURIComponent(activeSymbol.full)}&metrics=${encodeURIComponent(metricKey)}`,
          { cache: "no-store" },
        );

        if (!response.ok) throw new Error("Market route unavailable.");

        const payload = (await response.json()) as MarketSnapshot;

        if (cancelled) return;

        setSnapshot(payload);
        setStatus(payload.ok ? "live" : "error");
        setMessage(payload.ok ? "Market rail synced." : "Market rail returned incomplete data.");
      } catch (error) {
        if (cancelled) return;

        setSnapshot(null);
        setStatus("error");
        setMessage(error instanceof Error ? error.message : "Could not load market rail.");
      }
    }

    refresh();

    const interval = window.setInterval(refresh, 60000);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
    };
  }, [activeSymbol.display, activeSymbol.full, metricKey]);

  return { snapshot, status, message };
}

function MetricCard({
  selected,
  metric,
  snapshot,
  index,
  total,
  expanded,
  onToggleExpanded,
  onRemove,
  onMoveUp,
  onMoveDown,
  onUpdateAlert,
  onSaveAlert,
}: {
  selected: SelectedMetric;
  metric: MetricDefinition;
  snapshot: MarketSnapshot | null;
  index: number;
  total: number;
  expanded: boolean;
  onToggleExpanded: () => void;
  onRemove: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onUpdateAlert: (alert: MetricAlertConfig) => void;
  onSaveAlert: () => void;
}) {
  const alert = selected.alert;
  const reading = metricDisplay(snapshot, metric);

  return (
    <div className={cx("rounded-2xl border p-2 shadow-lg transition", toneClass(reading.tone))}>
      <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5">
            <span className={cx("h-2 w-2 rounded-full shadow-lg", dotClass(reading.tone))} />
            <div className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-slate-400">
              #{index + 1} · {metric.category}
            </div>
          </div>

          <div className="mt-1 grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
            <div className="min-w-0">
              <div className="truncate text-xs font-black text-white">{metric.shortLabel}</div>
              <div className="truncate text-[9px] font-bold text-slate-400">{metric.label}</div>
            </div>

            <div className="text-right">
              <div className="max-w-[150px] truncate text-sm font-black text-white">
                {reading.display}
              </div>
              <div className="truncate text-[8px] font-black uppercase tracking-[0.1em] text-slate-500">
                {reading.status}
              </div>
            </div>
          </div>
        </div>

        <button
          type="button"
          onClick={onRemove}
          className="h-6 rounded-full border border-white/10 bg-black/25 px-2 text-[10px] font-black text-slate-300 hover:text-white"
        >
          ×
        </button>
      </div>

      <div className="mt-1.5 grid grid-cols-4 gap-1.5">
        <button
          type="button"
          onClick={onMoveUp}
          disabled={index === 0}
          className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
        >
          ↑
        </button>
        <button
          type="button"
          onClick={onMoveDown}
          disabled={index === total - 1}
          className="rounded-lg border border-white/10 bg-black/20 px-2 py-1 text-[9px] font-black text-slate-300 transition hover:bg-white/10 disabled:cursor-not-allowed disabled:opacity-35"
        >
          ↓
        </button>
        <button
          type="button"
          onClick={onToggleExpanded}
          className="col-span-2 rounded-lg border border-red-500/25 bg-red-500/10 px-2 py-1 text-[9px] font-black text-red-100 transition hover:bg-red-500/15"
        >
          {expanded ? "Close Alert" : "Alert Rules"}
        </button>
      </div>

      {expanded ? (
        <div className="mt-2 rounded-2xl border border-white/10 bg-black/35 p-2.5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-red-300">
                Advanced Alert
              </div>
              <div className="mt-0.5 text-xs font-black text-white">
                {metric.label}
              </div>
            </div>
            <Pill tone={alert.enabled ? "green" : priorityTone(alert.priority)}>
              {alert.enabled ? "Saved" : alert.priority}
            </Pill>
          </div>

          <div className="mt-2 grid gap-1.5">
            <div className="grid grid-cols-2 gap-1.5">
              <select
                value={alert.condition}
                onChange={(event) =>
                  onUpdateAlert({
                    ...alert,
                    condition: event.target.value as AlertCondition,
                    enabled: false,
                  })
                }
                className="rounded-xl border border-white/10 bg-black/55 px-2 py-2 text-[11px] font-bold text-white outline-none ring-red-500 focus:ring-2"
              >
                <option value="above">Above</option>
                <option value="below">Below</option>
                <option value="moves-by">Moves by</option>
                <option value="between">Between</option>
                <option value="crosses-above">Cross above</option>
                <option value="crosses-below">Cross below</option>
              </select>

              <select
                value={alert.priority}
                onChange={(event) =>
                  onUpdateAlert({
                    ...alert,
                    priority: event.target.value as AlertPriority,
                    enabled: false,
                  })
                }
                className="rounded-xl border border-white/10 bg-black/55 px-2 py-2 text-[11px] font-bold text-white outline-none ring-red-500 focus:ring-2"
              >
                <option value="Monitor">Monitor</option>
                <option value="Important">Important</option>
                <option value="Critical">Critical</option>
              </select>
            </div>

            <div className={cx("grid gap-1.5", alert.condition === "between" ? "grid-cols-2" : "grid-cols-1")}>
              <input
                value={alert.threshold}
                onChange={(event) =>
                  onUpdateAlert({
                    ...alert,
                    threshold: event.target.value,
                    enabled: false,
                  })
                }
                placeholder={alert.condition === "moves-by" ? "Move, e.g. 3%" : "Threshold"}
                className="rounded-xl border border-white/10 bg-black/55 px-2 py-2 text-[11px] font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
              />

              {alert.condition === "between" ? (
                <input
                  value={alert.upperThreshold}
                  onChange={(event) =>
                    onUpdateAlert({
                      ...alert,
                      upperThreshold: event.target.value,
                      enabled: false,
                    })
                  }
                  placeholder="Upper"
                  className="rounded-xl border border-white/10 bg-black/55 px-2 py-2 text-[11px] font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                />
              ) : null}
            </div>

            <textarea
              value={alert.note}
              onChange={(event) =>
                onUpdateAlert({
                  ...alert,
                  note: event.target.value,
                  enabled: false,
                })
              }
              placeholder="Advisor note..."
              rows={2}
              className="resize-none rounded-xl border border-white/10 bg-black/55 px-2 py-2 text-[11px] font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
            />

            <button
              type="button"
              onClick={onSaveAlert}
              className="rounded-xl border border-emerald-500/25 bg-emerald-500/10 px-3 py-2 text-xs font-black text-emerald-100 transition hover:bg-emerald-500/15"
            >
              Save to Watchlist
            </button>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function MetricLibraryItem({
  metric,
  selected,
  disabled,
  onAdd,
}: {
  metric: MetricDefinition;
  selected: boolean;
  disabled: boolean;
  onAdd: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onAdd}
      disabled={selected || disabled}
      className="rounded-xl border border-white/10 bg-white/[0.045] p-2 text-left transition hover:bg-white/[0.075] disabled:cursor-not-allowed disabled:opacity-45"
    >
      <div className="flex items-center justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-xs font-black text-white">{metric.label}</div>
          <div className="mt-0.5 text-[9px] font-bold uppercase tracking-[0.12em] text-slate-500">
            {metric.category} · {metric.mirrorMode === "chart" ? "Chart" : metric.mirrorMode === "quote" ? "Quote" : "Assist"}
          </div>
        </div>
        <Pill tone={selected ? "green" : categoryTone(metric.category)}>
          {selected ? "Added" : "+"}
        </Pill>
      </div>
    </button>
  );
}

export default function CustomAdvisorWorkspacePage() {
  const [boardState, setBoardState] = useState<BoardState>(() => buildDefaultBoardState());
  const [saveMessage, setSaveMessage] = useState("");

  useEffect(() => {
    setBoardState(loadBoardState());
  }, []);

  useEffect(() => {
    saveBoardState(boardState);
  }, [boardState]);

  const selectedMetricIds = useMemo(
    () => new Set(boardState.selectedMetrics.map((metric) => metric.metricId)),
    [boardState.selectedMetrics],
  );

  const selectedMetricIdList = useMemo(
    () => boardState.selectedMetrics.map((metric) => metric.metricId),
    [boardState.selectedMetrics],
  );

  const { snapshot, status: providerStatus, message: providerMessage } = useMarketSnapshot(
    boardState.activeSymbol,
    selectedMetricIdList,
  );

  const selectedMetricPairs = useMemo(
    () =>
      boardState.selectedMetrics
        .map((selected) => ({
          selected,
          metric: METRIC_LIBRARY.find((metric) => metric.id === selected.metricId),
        }))
        .filter(
          (item): item is { selected: SelectedMetric; metric: MetricDefinition } =>
            Boolean(item.metric),
        ),
    [boardState.selectedMetrics],
  );

  const filteredMetrics = useMemo(() => {
    const query = boardState.metricSearch.trim().toLowerCase();

    return METRIC_LIBRARY.filter((metric) => {
      if (boardState.metricCategory !== "All" && metric.category !== boardState.metricCategory) return false;
      if (!query) return true;

      return [
        metric.label,
        metric.shortLabel,
        metric.category,
        metric.unit,
        metric.mirrorMode,
        ...metric.searchTerms,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    }).slice(0, 8);
  }, [boardState.metricCategory, boardState.metricSearch]);

  function updateState(patch: Partial<BoardState>) {
    setBoardState((current) => ({
      ...current,
      ...patch,
    }));
  }

  function openSymbolFromSearch(addToSaved = true) {
    const parsed = parseTradingViewSymbol(boardState.symbolSearch || boardState.activeSymbol.full);

    setBoardState((current) => {
      const exists = current.savedSymbols.some((item) => item.tvSymbol === parsed.full);

      return {
        ...current,
        activeSymbol: parsed,
        symbolSearch: parsed.full,
        savedSymbols:
          addToSaved && !exists
            ? [
                {
                  id: `saved-${parsed.exchange}-${parsed.symbol}-${Date.now()}`,
                  tvSymbol: parsed.full,
                  label: parsed.display,
                  note: "Added",
                  createdAt: nowLabel(),
                },
                ...current.savedSymbols,
              ]
            : current.savedSymbols,
      };
    });
  }

  function openSavedSymbol(item: SavedSymbol) {
    updateState({
      activeSymbol: parseTradingViewSymbol(item.tvSymbol),
      symbolSearch: item.tvSymbol,
    });
  }

  function removeSavedSymbol(itemId: string) {
    updateState({
      savedSymbols: boardState.savedSymbols.filter((item) => item.id !== itemId),
    });
  }

  function addSelectedMetric(metricId: string) {
    if (selectedMetricIds.has(metricId)) return;
    if (boardState.selectedMetrics.length >= MAX_SELECTED_METRICS) return;

    updateState({
      selectedMetrics: [
        ...boardState.selectedMetrics,
        {
          id: `selected-${metricId}-${Date.now()}`,
          metricId,
          alert: cloneDefaultAlert(),
        },
      ],
      expandedMetricId: null,
    });
  }

  function removeSelectedMetric(selectedId: string) {
    updateState({
      selectedMetrics: boardState.selectedMetrics.filter((item) => item.id !== selectedId),
      expandedMetricId: boardState.expandedMetricId === selectedId ? null : boardState.expandedMetricId,
    });
  }

  function moveMetric(selectedId: string, direction: "up" | "down") {
    const currentIndex = boardState.selectedMetrics.findIndex((item) => item.id === selectedId);
    if (currentIndex < 0) return;

    const nextIndex = direction === "up" ? currentIndex - 1 : currentIndex + 1;
    if (nextIndex < 0 || nextIndex >= boardState.selectedMetrics.length) return;

    const next = [...boardState.selectedMetrics];
    const currentItem = next[currentIndex];
    const targetItem = next[nextIndex];

    if (!currentItem || !targetItem) return;

    next[currentIndex] = targetItem;
    next[nextIndex] = currentItem;

    updateState({ selectedMetrics: next });
  }

  function updateMetricAlert(selectedId: string, alert: MetricAlertConfig) {
    updateState({
      selectedMetrics: boardState.selectedMetrics.map((item) =>
        item.id === selectedId ? { ...item, alert } : item,
      ),
    });
  }

  function saveMetricAlert(selected: SelectedMetric, metric: MetricDefinition) {
    const threshold = selected.alert.threshold.trim();
    const upperThreshold = selected.alert.upperThreshold.trim();

    if (!threshold) {
      setSaveMessage("Enter a threshold before saving the alert.");
      return;
    }

    if (selected.alert.condition === "between" && !upperThreshold) {
      setSaveMessage("Enter both thresholds for a between alert.");
      return;
    }

    const watchlistId = `watch-${boardState.activeSymbol.display}-${metric.id}-${Date.now()}`;
    const createdAt = nowLabel();

    const watchItem: SharedWorkspaceWatchItem = {
      id: watchlistId,
      symbol: boardState.activeSymbol.display,
      name: boardState.activeSymbol.full,
      constraint: `${metric.label}: ${conditionLabel(selected.alert.condition)} · ${selected.alert.priority}`,
      targetValue:
        selected.alert.condition === "between"
          ? `${threshold} to ${upperThreshold}`
          : selected.alert.condition === "moves-by"
            ? `±${threshold}`
            : threshold,
      note:
        selected.alert.note.trim() ||
        `Custom Board alert for ${metric.label} on ${boardState.activeSymbol.full}. Review the live chart and current market rail before any client recommendation.`,
      source: "Custom Board",
    };

    const existingWatchlist = loadJson<SharedWorkspaceWatchItem[]>(SHARED_WATCHLIST_KEY, []);
    saveJson(SHARED_WATCHLIST_KEY, [watchItem, ...existingWatchlist]);

    const alertRecord: CustomBoardAlert = {
      id: `alert-${Date.now()}`,
      symbol: boardState.activeSymbol.display,
      tvSymbol: boardState.activeSymbol.full,
      metricId: metric.id,
      metricLabel: metric.label,
      condition: selected.alert.condition,
      threshold,
      upperThreshold: selected.alert.condition === "between" ? upperThreshold : undefined,
      note: watchItem.note,
      priority: selected.alert.priority,
      createdAt,
      watchlistId,
    };

    const existingAlerts = loadJson<CustomBoardAlert[]>(CUSTOM_BOARD_ALERTS_KEY, []);
    saveJson(CUSTOM_BOARD_ALERTS_KEY, [alertRecord, ...existingAlerts]);

    updateMetricAlert(selected.id, {
      ...selected.alert,
      threshold,
      upperThreshold,
      enabled: true,
      lastSavedAt: createdAt,
      watchlistId,
    });

    setSaveMessage(`Saved ${metric.label} alert for ${boardState.activeSymbol.full}.`);
  }

  function applyDefaultMetricSet(metricIds: string[]) {
    updateState({
      selectedMetrics: metricIds.slice(0, MAX_SELECTED_METRICS).map((metricId) => ({
        id: `selected-${metricId}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        metricId,
        alert: cloneDefaultAlert(),
      })),
      expandedMetricId: null,
    });
  }

  const providerTone: Tone = providerStatus === "live" ? "green" : providerStatus === "loading" ? "amber" : "red";
  const priceDisplay = snapshot?.metrics?.["last-price"]?.display || "—";
  const changeDisplay = snapshot?.metrics?.["change-pct"]?.display || "—";

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.18),_transparent_30%),radial-gradient(circle_at_bottom,_rgba(168,85,247,0.12),_transparent_36%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-4 text-white">
      <div className="mx-auto grid max-w-[1900px] gap-4">
        <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-2xl shadow-red-950/30 backdrop-blur-xl">
          <div className="absolute right-[-120px] top-[-160px] hidden h-[360px] w-[360px] rounded-full border border-red-500/10 xl:block">
            <div className="absolute inset-12 rounded-full border border-cyan-500/10" />
            <div className="absolute inset-24 rounded-full border border-white/10" />
          </div>

          <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-center">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="cyan">TradingView Visual Mirror</Pill>
                <Pill tone="red">Cached Market Rail</Pill>
                <Pill tone="purple">8 Compact Metrics</Pill>
                <Pill tone={providerTone}>{providerStatus}</Pill>
              </div>

              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
                Custom advisor market board.
              </h1>

              <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400 md:text-base">
                A cleaner advisor cockpit: live TradingView chart, compact market rail, premium symbol picker, and advanced alert rules that save directly to the Workspace Watchlist.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Symbol Command
                    </div>
                    <div className="mt-1 text-xs font-bold text-slate-400">
                      Stocks · ETFs · indices · futures · crypto · macro
                    </div>
                  </div>
                  <Pill tone="red">Live Chart</Pill>
                </div>

                <div className="mt-3 flex gap-2">
                  <input
                    value={boardState.symbolSearch}
                    onChange={(event) => updateState({ symbolSearch: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") openSymbolFromSearch(true);
                    }}
                    placeholder="NASDAQ:AAPL, AMEX:SPY, SP:SPX, CME_MINI:ES1!, BINANCE:BTCUSDT..."
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => openSymbolFromSearch(true)}
                    className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/30"
                  >
                    Open
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-1 gap-2">
                <a href="/workspace" className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-center text-xs font-black text-white">
                  Workspace
                </a>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[280px_minmax(0,1fr)_390px]">
          <Card className="h-fit p-3 xl:sticky xl:top-4">
            <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-white/[0.045] p-3">
              <div className="absolute right-[-50px] top-[-60px] h-32 w-32 rounded-full bg-red-500/15 blur-2xl" />
              <div className="relative">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
                      Symbol Rail
                    </div>
                    <h2 className="mt-1 text-xl font-black">{boardState.activeSymbol.display}</h2>
                  </div>
                  <Pill tone={providerTone}>{providerStatus}</Pill>
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-white/10 bg-black/30 p-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                      Price
                    </div>
                    <div className="mt-1 truncate text-lg font-black text-white">{priceDisplay}</div>
                  </div>
                  <div className="rounded-xl border border-white/10 bg-black/30 p-2">
                    <div className="text-[9px] font-black uppercase tracking-[0.12em] text-slate-500">
                      Move
                    </div>
                    <div className="mt-1 truncate text-lg font-black text-white">{changeDisplay}</div>
                  </div>
                </div>

                <div className="mt-3 rounded-xl border border-white/10 bg-black/25 p-2 text-[11px] leading-5 text-slate-300">
                  {providerMessage}
                </div>
              </div>
            </div>

            <div className="mt-3 grid gap-1.5">
              {boardState.savedSymbols.map((item) => (
                <div
                  key={item.id}
                  className={cx(
                    "group flex items-center gap-2 rounded-xl border p-2.5 transition",
                    item.tvSymbol === boardState.activeSymbol.full
                      ? "border-white bg-white text-slate-950"
                      : "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.075]",
                  )}
                >
                  <button type="button" onClick={() => openSavedSymbol(item)} className="min-w-0 flex-1 text-left">
                    <div className="truncate text-xs font-black">{item.label}</div>
                    <div
                      className={cx(
                        "mt-0.5 truncate text-[10px]",
                        item.tvSymbol === boardState.activeSymbol.full ? "text-slate-600" : "text-slate-500",
                      )}
                    >
                      {item.tvSymbol}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => removeSavedSymbol(item.id)}
                    className="rounded-full border border-white/10 bg-black/15 px-2 py-1 text-[9px] font-black opacity-80 transition group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.045] p-2.5">
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Quick Launch</div>
              <div className="mt-2 grid grid-cols-2 gap-1.5">
                {QUICK_SYMBOLS.map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => openSavedSymbol(item)}
                    className="rounded-xl border border-white/10 bg-black/25 px-2 py-2 text-left text-[10px] font-black text-slate-200 transition hover:bg-white/[0.075]"
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>
          </Card>

          <div className="grid gap-4">
            <Card className="p-0">
              <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                    Active Live Chart
                  </div>
                  <h2 className="mt-1 text-3xl font-black">{boardState.activeSymbol.full}</h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Pill tone="cyan">{boardState.activeSymbol.exchange}</Pill>
                  <Pill tone="green">{boardState.activeSymbol.display}</Pill>
                  <Pill tone="purple">{boardState.selectedMetrics.length}/8 metrics</Pill>
                </div>
              </div>

              <div className="h-[620px] min-h-[560px] p-2">
                <TradingViewChart symbol={boardState.activeSymbol} />
              </div>
            </Card>

            <Card className="p-3">
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
                    Metric Presets
                  </div>
                  <h2 className="mt-1 text-xl font-black">One-click advisor rails</h2>
                </div>

                <a
                  href="/workspace?tab=watchlists"
                  className="rounded-2xl border border-emerald-500/25 bg-emerald-500/10 px-4 py-3 text-center text-xs font-black text-emerald-100 transition hover:bg-emerald-500/15"
                >
                  Workspace Watchlist
                </a>
              </div>

              <div className="mt-3 grid gap-2 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => applyDefaultMetricSet(["last-price", "change-pct", "volume", "avg-volume", "rsi-14", "macd", "sma-50", "atr-14"])}
                  className={cx("rounded-2xl border p-3 text-left shadow-lg transition hover:-translate-y-0.5", toneClass("cyan"))}
                >
                  <div className="text-sm font-black text-white">Core Tape</div>
                  <p className="mt-1 text-xs leading-5 text-slate-300">Price, move, volume, momentum, trend.</p>
                </button>

                <button
                  type="button"
                  onClick={() => applyDefaultMetricSet(["rsi-14", "macd", "sma-20", "sma-50", "sma-200", "ema-21", "vwap", "atr-14"])}
                  className={cx("rounded-2xl border p-3 text-left shadow-lg transition hover:-translate-y-0.5", toneClass("purple"))}
                >
                  <div className="text-sm font-black text-white">Technicals</div>
                  <p className="mt-1 text-xs leading-5 text-slate-300">Chart studies and momentum layers.</p>
                </button>

                <button
                  type="button"
                  onClick={() => applyDefaultMetricSet(["last-price", "open", "high", "low", "52-week-high", "52-week-low", "market-cap", "pe-ratio"])}
                  className={cx("rounded-2xl border p-3 text-left shadow-lg transition hover:-translate-y-0.5", toneClass("amber"))}
                >
                  <div className="text-sm font-black text-white">Valuation</div>
                  <p className="mt-1 text-xs leading-5 text-slate-300">Range, size, P/E, fundamentals.</p>
                </button>
              </div>
            </Card>
          </div>

          <Card className="h-fit p-3 xl:sticky xl:top-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
                  Advisor Metrics
                </div>
                <h2 className="mt-1 text-xl font-black">Premium rail</h2>
              </div>
              <Pill tone={boardState.selectedMetrics.length >= MAX_SELECTED_METRICS ? "amber" : "purple"}>
                {boardState.selectedMetrics.length}/8
              </Pill>
            </div>

            <div className="mt-3 grid gap-2">
              <input
                value={boardState.metricSearch}
                onChange={(event) => updateState({ metricSearch: event.target.value })}
                placeholder="Search metrics..."
                className="w-full rounded-2xl border border-white/10 bg-black/45 px-3 py-2.5 text-xs font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
              />

              <select
                value={boardState.metricCategory}
                onChange={(event) => updateState({ metricCategory: event.target.value as MetricCategory | "All" })}
                className="w-full rounded-2xl border border-white/10 bg-black/45 px-3 py-2.5 text-xs font-bold text-white outline-none ring-red-500 focus:ring-2"
              >
                {METRIC_CATEGORIES.map((category) => (
                  <option key={category} value={category}>
                    {category}
                  </option>
                ))}
              </select>

              {boardState.metricSearch || boardState.metricCategory !== "All" ? (
                <div className="grid max-h-48 gap-1.5 overflow-y-auto pr-1">
                  {filteredMetrics.map((metric) => (
                    <MetricLibraryItem
                      key={metric.id}
                      metric={metric}
                      selected={selectedMetricIds.has(metric.id)}
                      disabled={boardState.selectedMetrics.length >= MAX_SELECTED_METRICS}
                      onAdd={() => addSelectedMetric(metric.id)}
                    />
                  ))}
                </div>
              ) : null}
            </div>

            {saveMessage ? (
              <div className="mt-3 rounded-2xl border border-emerald-500/25 bg-emerald-500/10 p-2 text-xs font-bold leading-5 text-emerald-100">
                {saveMessage}
              </div>
            ) : null}

            <div className="mt-3 grid gap-1.5">
              {selectedMetricPairs.map(({ selected, metric }, index) => (
                <MetricCard
                  key={selected.id}
                  selected={selected}
                  metric={metric}
                  snapshot={snapshot}
                  index={index}
                  total={selectedMetricPairs.length}
                  expanded={boardState.expandedMetricId === selected.id}
                  onToggleExpanded={() =>
                    updateState({
                      expandedMetricId: boardState.expandedMetricId === selected.id ? null : selected.id,
                    })
                  }
                  onRemove={() => removeSelectedMetric(selected.id)}
                  onMoveUp={() => moveMetric(selected.id, "up")}
                  onMoveDown={() => moveMetric(selected.id, "down")}
                  onUpdateAlert={(alert) => updateMetricAlert(selected.id, alert)}
                  onSaveAlert={() => saveMetricAlert(selected, metric)}
                />
              ))}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}