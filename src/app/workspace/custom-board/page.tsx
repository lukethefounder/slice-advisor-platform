"use client";

import { ReactNode, useEffect, useMemo, useRef, useState } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";

type MetricCategory =
  | "Price"
  | "Volume"
  | "Liquidity"
  | "Risk"
  | "Technical"
  | "Fundamental"
  | "Valuation"
  | "Quality"
  | "Growth"
  | "Income"
  | "Returns"
  | "Relative"
  | "Macro";

type MetricUnit =
  | "currency"
  | "percent"
  | "ratio"
  | "score"
  | "millions"
  | "billions"
  | "days"
  | "raw";

type MetricAlertKind =
  | "price"
  | "volume"
  | "liquidity"
  | "risk"
  | "quality"
  | "growth"
  | "valuation"
  | "return"
  | "oscillator"
  | "income"
  | "spread"
  | "generic";

type TradingViewSymbol = {
  exchange: string;
  symbol: string;
  full: string;
  display: string;
};

type MetricDefinition = {
  id: string;
  label: string;
  category: MetricCategory;
  description: string;
  unit: MetricUnit;
  min: number;
  max: number;
  higherIsGood: boolean;
  alertKind: MetricAlertKind;
};

type SelectedMetric = {
  metricId: string;
  standard: AlertStandard;
};

type AlertStandard = {
  lower?: number;
  upper?: number;
  note: string;
};

type WatchlistItem = {
  id: string;
  tvSymbol: string;
  label: string;
  note: string;
};

type BoardState = {
  activeSymbol: TradingViewSymbol;
  watchlist: WatchlistItem[];
  selectedMetrics: SelectedMetric[];
  metricSearch: string;
  symbolSearch: string;
  layerScope: "active" | "watchlist";
};

type NotificationLayer = {
  id: string;
  title: string;
  description: string;
  tone: Tone;
  metricIds: string[];
};

const STORAGE_KEY = "slice-custom-advisor-workspace-v4";
const MAX_SELECTED_METRICS = 10;

const DEFAULT_SYMBOL: TradingViewSymbol = {
  exchange: "NASDAQ",
  symbol: "AAPL",
  full: "NASDAQ:AAPL",
  display: "AAPL",
};

const DEFAULT_WATCHLIST: WatchlistItem[] = [
  {
    id: "watch-spy",
    tvSymbol: "AMEX:SPY",
    label: "SPY",
    note: "Broad equity benchmark",
  },
  {
    id: "watch-qqq",
    tvSymbol: "NASDAQ:QQQ",
    label: "QQQ",
    note: "Growth / technology proxy",
  },
  {
    id: "watch-nvda",
    tvSymbol: "NASDAQ:NVDA",
    label: "NVDA",
    note: "AI concentration review",
  },
  {
    id: "watch-tlt",
    tvSymbol: "AMEX:TLT",
    label: "TLT",
    note: "Duration sensitivity",
  },
  {
    id: "watch-gld",
    tvSymbol: "AMEX:GLD",
    label: "GLD",
    note: "Real asset diversifier",
  },
];

const DEFAULT_SELECTED_METRIC_IDS = [
  "last-price",
  "one-day-return",
  "relative-volume",
  "bid-ask-spread",
  "float-proxy",
  "liquidity-score",
  "rsi-14",
  "volatility-30d",
  "pe-forward",
  "dividend-yield",
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

function deterministicValue(symbol: string, metric: MetricDefinition) {
  const hash = hashString(`${symbol}-${metric.id}`);
  const ratio = (hash % 10000) / 10000;
  const value = metric.min + (metric.max - metric.min) * ratio;

  if (metric.unit === "currency") return Number(value.toFixed(2));
  if (metric.unit === "percent") return Number(value.toFixed(2));
  if (metric.unit === "ratio") return Number(value.toFixed(2));
  if (metric.unit === "score") return Math.round(value);
  if (metric.unit === "millions") return Math.round(value);
  if (metric.unit === "billions") return Number(value.toFixed(1));
  if (metric.unit === "days") return Math.round(value);

  return Number(value.toFixed(2));
}

function formatMetricValue(value: number, metric: MetricDefinition) {
  if (metric.unit === "currency") return `$${value.toLocaleString()}`;
  if (metric.unit === "percent") return `${value}%`;
  if (metric.unit === "ratio") return `${value}x`;
  if (metric.unit === "score") return `${value}/100`;
  if (metric.unit === "millions") return `${value.toLocaleString()}M`;
  if (metric.unit === "billions") return `$${value.toLocaleString()}B`;
  if (metric.unit === "days") return `${value}d`;

  return String(value);
}

function metricStatus(value: number, metric: MetricDefinition, standard: AlertStandard) {
  if (typeof standard.upper === "number" && value > standard.upper) {
    return metric.higherIsGood ? "Positive break" : "Upper risk";
  }

  if (typeof standard.lower === "number" && value < standard.lower) {
    return metric.higherIsGood ? "Lower risk" : "Positive low";
  }

  return "Normal";
}

function statusTone(status: string): Tone {
  if (status.includes("Positive")) return "green";
  if (status.includes("risk") || status.includes("Risk")) return "red";
  if (status.includes("Normal")) return "slate";

  return "amber";
}

function addMetric(
  id: string,
  label: string,
  category: MetricCategory,
  description: string,
  unit: MetricUnit,
  min: number,
  max: number,
  higherIsGood: boolean,
  alertKind: MetricAlertKind = "generic",
): MetricDefinition {
  return {
    id,
    label,
    category,
    description,
    unit,
    min,
    max,
    higherIsGood,
    alertKind,
  };
}

const CORE_METRICS: MetricDefinition[] = [
  addMetric("last-price", "Last Price", "Price", "Latest traded price estimate.", "currency", 8, 850, true, "price"),
  addMetric("price-change", "Price Change", "Price", "Estimated day price change.", "currency", -24, 24, true, "price"),
  addMetric("one-day-return", "1D Return", "Returns", "One-day return percentage.", "percent", -8, 8, true, "return"),
  addMetric("five-day-return", "5D Return", "Returns", "Five-day return percentage.", "percent", -14, 16, true, "return"),
  addMetric("one-month-return", "1M Return", "Returns", "One-month return percentage.", "percent", -22, 26, true, "return"),
  addMetric("three-month-return", "3M Return", "Returns", "Three-month return percentage.", "percent", -35, 42, true, "return"),
  addMetric("ytd-return", "YTD Return", "Returns", "Year-to-date return percentage.", "percent", -45, 70, true, "return"),
  addMetric("one-year-return", "1Y Return", "Returns", "One-year return percentage.", "percent", -60, 120, true, "return"),

  addMetric("volume", "Volume", "Volume", "Estimated current volume.", "millions", 1, 800, true, "volume"),
  addMetric("average-volume", "Average Volume", "Volume", "Average daily volume estimate.", "millions", 1, 550, true, "volume"),
  addMetric("relative-volume", "Relative Volume", "Volume", "Current volume versus normal volume.", "ratio", 0.1, 4.8, true, "volume"),
  addMetric("volume-turnover", "Turnover Ratio", "Volume", "Estimated share turnover ratio.", "percent", 0.05, 18, true, "volume"),

  addMetric("bid-ask-spread", "Bid/Ask Spread", "Liquidity", "Estimated bid/ask spread percent.", "percent", 0.01, 2.4, false, "spread"),
  addMetric("float-proxy", "Float Proxy", "Liquidity", "Estimated freely tradable float proxy.", "millions", 8, 15500, true, "liquidity"),
  addMetric("liquidity-score", "Liquidity Score", "Liquidity", "Composite liquidity score.", "score", 0, 100, true, "liquidity"),
  addMetric("days-to-liquidate", "Days to Liquidate", "Liquidity", "Estimated time to liquidate a large position.", "days", 0.1, 14, false, "liquidity"),

  addMetric("volatility-10d", "10D Volatility", "Risk", "Short-term annualized volatility estimate.", "percent", 4, 110, false, "risk"),
  addMetric("volatility-30d", "30D Volatility", "Risk", "Thirty-day annualized volatility estimate.", "percent", 5, 130, false, "risk"),
  addMetric("max-drawdown", "Max Drawdown", "Risk", "Estimated maximum recent drawdown.", "percent", -65, -1, true, "risk"),
  addMetric("beta", "Beta", "Risk", "Market beta estimate.", "ratio", 0.1, 2.8, false, "risk"),
  addMetric("downside-capture", "Downside Capture", "Risk", "Downside capture ratio estimate.", "percent", 20, 180, false, "risk"),
  addMetric("rate-sensitivity", "Rate Sensitivity", "Risk", "Sensitivity to interest-rate movement.", "score", 0, 100, false, "risk"),

  addMetric("rsi-14", "RSI 14", "Technical", "Relative strength index.", "score", 0, 100, false, "oscillator"),
  addMetric("macd-score", "MACD Score", "Technical", "Composite MACD momentum score.", "score", 0, 100, true, "oscillator"),
  addMetric("trend-score", "Trend Score", "Technical", "Trend strength composite.", "score", 0, 100, true, "quality"),
  addMetric("moving-average-distance", "MA Distance", "Technical", "Distance from key moving average.", "percent", -35, 35, true, "generic"),
  addMetric("support-distance", "Support Distance", "Technical", "Distance to estimated support.", "percent", 0, 30, false, "risk"),
  addMetric("resistance-distance", "Resistance Distance", "Technical", "Distance to estimated resistance.", "percent", 0, 30, true, "generic"),

  addMetric("market-cap", "Market Cap", "Fundamental", "Estimated market capitalization.", "billions", 1, 3300, true, "quality"),
  addMetric("revenue-growth", "Revenue Growth", "Growth", "Estimated forward revenue growth.", "percent", -18, 65, true, "growth"),
  addMetric("earnings-growth", "Earnings Growth", "Growth", "Estimated forward earnings growth.", "percent", -40, 90, true, "growth"),
  addMetric("free-cash-flow-growth", "FCF Growth", "Growth", "Estimated free cash flow growth.", "percent", -30, 80, true, "growth"),

  addMetric("gross-margin", "Gross Margin", "Quality", "Estimated gross margin.", "percent", 5, 92, true, "quality"),
  addMetric("operating-margin", "Operating Margin", "Quality", "Estimated operating margin.", "percent", -20, 58, true, "quality"),
  addMetric("roe", "ROE", "Quality", "Estimated return on equity.", "percent", -25, 70, true, "quality"),
  addMetric("roic", "ROIC", "Quality", "Estimated return on invested capital.", "percent", -20, 55, true, "quality"),
  addMetric("debt-to-equity", "Debt / Equity", "Quality", "Estimated leverage ratio.", "ratio", 0, 5, false, "risk"),
  addMetric("quality-score", "Quality Score", "Quality", "Composite business quality score.", "score", 0, 100, true, "quality"),

  addMetric("pe-trailing", "Trailing P/E", "Valuation", "Estimated trailing price-to-earnings ratio.", "ratio", 4, 95, false, "valuation"),
  addMetric("pe-forward", "Forward P/E", "Valuation", "Estimated forward price-to-earnings ratio.", "ratio", 4, 80, false, "valuation"),
  addMetric("price-to-sales", "Price / Sales", "Valuation", "Estimated price-to-sales ratio.", "ratio", 0.3, 28, false, "valuation"),
  addMetric("price-to-book", "Price / Book", "Valuation", "Estimated price-to-book ratio.", "ratio", 0.2, 35, false, "valuation"),
  addMetric("ev-ebitda", "EV / EBITDA", "Valuation", "Estimated EV/EBITDA ratio.", "ratio", 2, 45, false, "valuation"),
  addMetric("valuation-score", "Valuation Score", "Valuation", "Composite valuation attractiveness score.", "score", 0, 100, true, "valuation"),

  addMetric("dividend-yield", "Dividend Yield", "Income", "Estimated dividend yield.", "percent", 0, 9, true, "income"),
  addMetric("payout-ratio", "Payout Ratio", "Income", "Estimated payout ratio.", "percent", 0, 120, false, "income"),
  addMetric("income-score", "Income Score", "Income", "Composite income score.", "score", 0, 100, true, "income"),

  addMetric("spy-relative-strength", "SPY Relative Strength", "Relative", "Relative strength versus SPY.", "score", 0, 100, true, "quality"),
  addMetric("sector-relative-strength", "Sector Relative Strength", "Relative", "Relative strength versus sector.", "score", 0, 100, true, "quality"),
  addMetric("correlation-spy", "SPY Correlation", "Relative", "Correlation versus SPY.", "ratio", -1, 1, false, "risk"),
];

const GENERATED_METRICS: MetricDefinition[] = [
  ...["20D", "50D", "100D", "200D"].flatMap((period) => [
    addMetric(
      `ma-${period.toLowerCase()}-trend`,
      `${period} MA Trend`,
      "Technical",
      `${period} moving average trend score.`,
      "score",
      0,
      100,
      true,
      "quality",
    ),
    addMetric(
      `ma-${period.toLowerCase()}-distance`,
      `${period} MA Distance`,
      "Technical",
      `Distance from ${period} moving average.`,
      "percent",
      -35,
      35,
      true,
      "generic",
    ),
  ]),
  ...["1M", "3M", "6M", "1Y", "3Y", "5Y"].map((period) =>
    addMetric(
      `${period.toLowerCase()}-annualized-return`,
      `${period} Annualized Return`,
      "Returns",
      `${period} annualized return estimate.`,
      "percent",
      -40,
      90,
      true,
      "return",
    ),
  ),
  ...["Revenue", "Earnings", "Cash Flow", "Book Value", "Dividend"].map((label) =>
    addMetric(
      `${label.toLowerCase().replace(/\s+/g, "-")}-stability`,
      `${label} Stability`,
      "Quality",
      `${label} stability score.`,
      "score",
      0,
      100,
      true,
      "quality",
    ),
  ),
  ...["CPI", "Rates", "Dollar", "Oil", "Credit Spread"].map((label) =>
    addMetric(
      `${label.toLowerCase().replace(/\s+/g, "-")}-sensitivity`,
      `${label} Sensitivity`,
      "Macro",
      `Estimated sensitivity to ${label}.`,
      "score",
      0,
      100,
      false,
      "risk",
    ),
  ),
];

const METRIC_CATALOG: MetricDefinition[] = Array.from(
  new Map([...CORE_METRICS, ...GENERATED_METRICS].map((metric) => [metric.id, metric])).values(),
).sort((a, b) => {
  const categoryCompare = a.category.localeCompare(b.category);
  if (categoryCompare !== 0) return categoryCompare;
  return a.label.localeCompare(b.label);
});

const metricById = new Map(METRIC_CATALOG.map((metric) => [metric.id, metric]));

function defaultStandard(metric: MetricDefinition): AlertStandard {
  const span = metric.max - metric.min;
  const midpoint = metric.min + span * 0.5;

  if (metric.alertKind === "oscillator") {
    return {
      lower: 30,
      upper: 70,
      note: "Momentum extremes: below 30 may indicate weakness/oversold; above 70 may indicate strength/overbought.",
    };
  }

  if (metric.alertKind === "spread") {
    return {
      upper: Number((metric.min + span * 0.65).toFixed(2)),
      note: "Liquidity warning when spread moves above normal range.",
    };
  }

  if (metric.alertKind === "liquidity") {
    return metric.higherIsGood
      ? {
          lower: Number((metric.min + span * 0.25).toFixed(2)),
          note: "Liquidity warning when this metric falls below the preferred level.",
        }
      : {
          upper: Number((metric.min + span * 0.65).toFixed(2)),
          note: "Liquidity warning when liquidation difficulty rises.",
        };
  }

  if (metric.alertKind === "volume") {
    return {
      lower: Number((metric.min + span * 0.18).toFixed(2)),
      upper: Number((metric.min + span * 0.78).toFixed(2)),
      note: "Volume layer watches abnormal quiet or elevated activity.",
    };
  }

  if (metric.alertKind === "risk") {
    return {
      upper: Number((metric.min + span * 0.68).toFixed(2)),
      note: "Risk layer highlights unusually elevated risk exposure.",
    };
  }

  if (metric.alertKind === "valuation") {
    return metric.higherIsGood
      ? {
          lower: Number((metric.min + span * 0.35).toFixed(2)),
          note: "Valuation attractiveness below preferred level.",
        }
      : {
          upper: Number((metric.min + span * 0.72).toFixed(2)),
          note: "Valuation multiple above preferred review threshold.",
        };
  }

  if (metric.alertKind === "return" || metric.alertKind === "growth" || metric.alertKind === "quality") {
    return {
      lower: Number((metric.min + span * 0.32).toFixed(2)),
      note: "Review when score or return falls below preferred advisor threshold.",
    };
  }

  if (metric.alertKind === "income") {
    return {
      lower: Number((metric.min + span * 0.22).toFixed(2)),
      upper: Number((metric.min + span * 0.84).toFixed(2)),
      note: "Income layer watches unusually low or unusually high income metrics.",
    };
  }

  if (metric.alertKind === "price") {
    return {
      lower: Number((midpoint * 0.85).toFixed(2)),
      upper: Number((midpoint * 1.15).toFixed(2)),
      note: "Price layer watches movement outside the advisor-defined review range.",
    };
  }

  return {
    lower: Number((metric.min + span * 0.25).toFixed(2)),
    upper: Number((metric.min + span * 0.75).toFixed(2)),
    note: "Generic advisor review band.",
  };
}

function makeSelectedMetric(metricId: string): SelectedMetric {
  const metric = metricById.get(metricId) ?? METRIC_CATALOG[0];

  return {
    metricId: metric.id,
    standard: defaultStandard(metric),
  };
}

const NOTIFICATION_LAYERS: NotificationLayer[] = [
  {
    id: "price-volume",
    title: "Price + Volume",
    description: "Core price, volume, spread, float, and liquidity movement.",
    tone: "cyan",
    metricIds: [
      "last-price",
      "one-day-return",
      "volume",
      "relative-volume",
      "bid-ask-spread",
      "float-proxy",
      "liquidity-score",
    ],
  },
  {
    id: "technical-momentum",
    title: "Technical Momentum",
    description: "Trend, RSI, moving averages, support, and resistance context.",
    tone: "purple",
    metricIds: [
      "rsi-14",
      "macd-score",
      "trend-score",
      "moving-average-distance",
      "support-distance",
      "resistance-distance",
    ],
  },
  {
    id: "risk-volatility",
    title: "Risk + Volatility",
    description: "Volatility, drawdown, beta, downside capture, and rate sensitivity.",
    tone: "red",
    metricIds: [
      "volatility-10d",
      "volatility-30d",
      "max-drawdown",
      "beta",
      "downside-capture",
      "rate-sensitivity",
    ],
  },
  {
    id: "valuation-quality",
    title: "Valuation + Quality",
    description: "Valuation multiples, margins, ROE, ROIC, leverage, and quality score.",
    tone: "amber",
    metricIds: [
      "pe-forward",
      "price-to-sales",
      "ev-ebitda",
      "gross-margin",
      "operating-margin",
      "roe",
      "roic",
      "quality-score",
    ],
  },
  {
    id: "growth-income",
    title: "Growth + Income",
    description: "Growth, dividend, payout, and income context.",
    tone: "green",
    metricIds: [
      "revenue-growth",
      "earnings-growth",
      "free-cash-flow-growth",
      "dividend-yield",
      "payout-ratio",
      "income-score",
    ],
  },
  {
    id: "relative-macro",
    title: "Relative + Macro",
    description: "Relative strength, SPY correlation, and macro sensitivity layers.",
    tone: "blue",
    metricIds: [
      "spy-relative-strength",
      "sector-relative-strength",
      "correlation-spy",
      "cpi-sensitivity",
      "rates-sensitivity",
      "dollar-sensitivity",
      "credit-spread-sensitivity",
    ],
  },
];

function parseTradingViewSymbol(raw: string, fallbackExchange = "NASDAQ"): TradingViewSymbol {
  const cleaned = raw.trim().replace(/\s+/g, "").toUpperCase();

  if (!cleaned) return DEFAULT_SYMBOL;

  if (cleaned.includes(":")) {
    const [exchangePart, symbolPart] = cleaned.split(":");
    const exchange = exchangePart.replace(/[^A-Z0-9._-]/g, "") || fallbackExchange;
    const symbol = symbolPart.replace(/[^A-Z0-9._/-]/g, "") || "AAPL";

    return {
      exchange,
      symbol,
      full: `${exchange}:${symbol}`,
      display: symbol,
    };
  }

  const symbol = cleaned.replace(/[^A-Z0-9._/-]/g, "") || "AAPL";

  return {
    exchange: fallbackExchange,
    symbol,
    full: `${fallbackExchange}:${symbol}`,
    display: symbol,
  };
}

function loadBoardState(): BoardState {
  const fallback: BoardState = {
    activeSymbol: DEFAULT_SYMBOL,
    watchlist: DEFAULT_WATCHLIST,
    selectedMetrics: DEFAULT_SELECTED_METRIC_IDS.map(makeSelectedMetric),
    metricSearch: "",
    symbolSearch: "",
    layerScope: "active",
  };

  if (typeof window === "undefined") return fallback;

  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return fallback;

    const parsed = JSON.parse(raw) as Partial<BoardState>;

    return {
      ...fallback,
      ...parsed,
      activeSymbol: parsed.activeSymbol ?? fallback.activeSymbol,
      watchlist: Array.isArray(parsed.watchlist) ? parsed.watchlist : fallback.watchlist,
      selectedMetrics: Array.isArray(parsed.selectedMetrics)
        ? parsed.selectedMetrics
            .filter((item) => metricById.has(item.metricId))
            .slice(0, MAX_SELECTED_METRICS)
        : fallback.selectedMetrics,
    };
  } catch {
    return fallback;
  }
}

function saveBoardState(state: BoardState) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
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
      interval: "D",
      timezone: "Etc/UTC",
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
      studies: ["STD;Volume"],
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

function MetricCard({
  metric,
  selected,
  activeSymbol,
  removeMetric,
}: {
  metric: MetricDefinition;
  selected: SelectedMetric;
  activeSymbol: TradingViewSymbol;
  removeMetric: (metricId: string) => void;
}) {
  const value = deterministicValue(activeSymbol.full, metric);
  const status = metricStatus(value, metric, selected.standard);
  const tone = statusTone(status);

  return (
    <div className={cx("rounded-2xl border p-3 shadow-lg", toneClass(tone))}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[10px] font-black uppercase tracking-[0.12em] text-slate-400">
            {metric.category}
          </div>
          <div className="mt-1 truncate text-sm font-black text-white">{metric.label}</div>
          <div className="mt-1 text-2xl font-black text-white">
            {formatMetricValue(value, metric)}
          </div>
        </div>

        <button
          type="button"
          onClick={() => removeMetric(metric.id)}
          className="rounded-full border border-white/10 bg-black/25 px-2 py-1 text-[10px] font-black text-slate-300 hover:text-white"
        >
          ×
        </button>
      </div>

      <div className="mt-3 grid gap-2">
        <div className="flex items-center justify-between gap-2 text-[11px] font-bold text-slate-300">
          <span>Status</span>
          <span>{status}</span>
        </div>
        <div className="rounded-xl border border-white/10 bg-black/25 p-2 text-[11px] leading-4 text-slate-300">
          {selected.standard.note}
        </div>
      </div>
    </div>
  );
}

function NotificationLayerButton({
  layer,
  applyLayer,
}: {
  layer: NotificationLayer;
  applyLayer: (layer: NotificationLayer) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => applyLayer(layer)}
      className={cx("rounded-2xl border p-4 text-left shadow-lg transition hover:-translate-y-0.5", toneClass(layer.tone))}
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-black text-white">{layer.title}</div>
          <p className="mt-1 text-xs leading-5 text-slate-300">{layer.description}</p>
        </div>
        <span className={cx("h-3 w-3 shrink-0 rounded-full shadow-lg", dotClass(layer.tone))} />
      </div>
    </button>
  );
}

export default function CustomAdvisorWorkspacePage() {
  const [boardState, setBoardState] = useState<BoardState>({
    activeSymbol: DEFAULT_SYMBOL,
    watchlist: DEFAULT_WATCHLIST,
    selectedMetrics: DEFAULT_SELECTED_METRIC_IDS.map(makeSelectedMetric),
    metricSearch: "",
    symbolSearch: "",
    layerScope: "active",
  });

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

  const selectedMetricPairs = useMemo(
    () =>
      boardState.selectedMetrics
        .map((selected) => ({
          selected,
          metric: metricById.get(selected.metricId),
        }))
        .filter(
          (item): item is { selected: SelectedMetric; metric: MetricDefinition } =>
            Boolean(item.metric),
        ),
    [boardState.selectedMetrics],
  );

  const filteredMetrics = useMemo(() => {
    const query = boardState.metricSearch.trim().toLowerCase();

    return METRIC_CATALOG.filter((metric) => {
      if (selectedMetricIds.has(metric.id)) return false;

      if (!query) return true;

      return [
        metric.label,
        metric.category,
        metric.description,
        metric.unit,
        metric.alertKind,
      ]
        .join(" ")
        .toLowerCase()
        .includes(query);
    }).slice(0, 45);
  }, [boardState.metricSearch, selectedMetricIds]);

  const triggeredAlerts = useMemo(() => {
    return selectedMetricPairs
      .map(({ selected, metric }) => {
        const value = deterministicValue(boardState.activeSymbol.full, metric);
        const status = metricStatus(value, metric, selected.standard);

        return {
          metric,
          selected,
          value,
          status,
          tone: statusTone(status),
        };
      })
      .filter((item) => item.status !== "Normal");
  }, [boardState.activeSymbol.full, selectedMetricPairs]);

  function updateState(patch: Partial<BoardState>) {
    setBoardState((current) => ({
      ...current,
      ...patch,
    }));
  }

  function openSymbolFromSearch(addToWatchlist = true) {
    const parsed = parseTradingViewSymbol(boardState.symbolSearch || boardState.activeSymbol.full);

    setBoardState((current) => {
      const exists = current.watchlist.some((item) => item.tvSymbol === parsed.full);

      return {
        ...current,
        activeSymbol: parsed,
        symbolSearch: parsed.full,
        watchlist:
          addToWatchlist && !exists
            ? [
                {
                  id: `watch-${parsed.exchange}-${parsed.symbol}-${Date.now()}`,
                  tvSymbol: parsed.full,
                  label: parsed.display,
                  note: "Added from symbol search",
                },
                ...current.watchlist,
              ]
            : current.watchlist,
      };
    });
  }

  function openWatchlistItem(item: WatchlistItem) {
    updateState({
      activeSymbol: parseTradingViewSymbol(item.tvSymbol),
      symbolSearch: item.tvSymbol,
    });
  }

  function removeWatchlistItem(itemId: string) {
    updateState({
      watchlist: boardState.watchlist.filter((item) => item.id !== itemId),
    });
  }

  function addSelectedMetric(metricId: string) {
    if (selectedMetricIds.has(metricId)) return;
    if (boardState.selectedMetrics.length >= MAX_SELECTED_METRICS) return;

    updateState({
      selectedMetrics: [...boardState.selectedMetrics, makeSelectedMetric(metricId)],
    });
  }

  function removeSelectedMetric(metricId: string) {
    updateState({
      selectedMetrics: boardState.selectedMetrics.filter((item) => item.metricId !== metricId),
    });
  }

  function applyLayer(layer: NotificationLayer) {
    const nextMetrics = layer.metricIds
      .map((metricId) => metricById.get(metricId))
      .filter((metric): metric is MetricDefinition => Boolean(metric))
      .slice(0, MAX_SELECTED_METRICS)
      .map((metric) => makeSelectedMetric(metric.id));

    updateState({
      selectedMetrics: nextMetrics,
      metricSearch: layer.title,
    });
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.38),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.16),_transparent_28%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-4 text-white">
      <div className="mx-auto grid max-w-[1900px] gap-4">
        <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-2xl shadow-red-950/30 backdrop-blur-xl">
          <div className="absolute right-[-120px] top-[-160px] hidden h-[360px] w-[360px] rounded-full border border-red-500/10 xl:block">
            <div className="absolute inset-12 rounded-full border border-cyan-500/10" />
            <div className="absolute inset-24 rounded-full border border-white/10" />
          </div>

          <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_520px] xl:items-center">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="cyan">Create Your Own Workspace</Pill>
                <Pill tone="red">TradingView</Pill>
                <Pill tone="purple">Metric Rail</Pill>
                <Pill tone="amber">Advisor Alerts</Pill>
              </div>

              <h1 className="mt-4 text-4xl font-black tracking-tight md:text-6xl">
                Custom advisor market board.
              </h1>

              <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400 md:text-base">
                Search any TradingView-style symbol, open live charts, build a right-side
                decision rail with up to 10 custom metrics, and generate notification layers for
                price, volume, liquidity, valuation, quality, income, risk, and technical review.
              </p>
            </div>

            <div className="grid gap-3">
              <div className="rounded-[1.35rem] border border-white/10 bg-white/[0.045] p-3">
                <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                  Open TradingView Symbol
                </div>
                <div className="mt-2 flex gap-2">
                  <input
                    value={boardState.symbolSearch}
                    onChange={(event) => updateState({ symbolSearch: event.target.value })}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") openSymbolFromSearch(true);
                    }}
                    placeholder="NASDAQ:AAPL, NYSE:BRK.B, AMEX:SPY, BTCUSD..."
                    className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  />
                  <button
                    type="button"
                    onClick={() => openSymbolFromSearch(true)}
                    className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white"
                  >
                    Open
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2">
                <a href="/workspace" className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-center text-xs font-black text-white">
                  Workspace
                </a>
                <a href="/workspace/settings" className="rounded-2xl border border-blue-500/25 bg-blue-500/10 px-4 py-3 text-center text-xs font-black text-blue-100">
                  Settings
                </a>
                <a href="/watchlist-alerts" className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-center text-xs font-black text-amber-100">
                  Alerts
                </a>
              </div>
            </div>
          </div>
        </header>

        <section className="grid gap-4 xl:grid-cols-[290px_minmax(0,1fr)_370px]">
          <Card className="h-fit p-4 xl:sticky xl:top-4">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
              Watchlist
            </div>
            <h2 className="mt-2 text-2xl font-black">Symbols</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Click any symbol to update the chart and metric rail.
            </p>

            <div className="mt-4 grid gap-2">
              {boardState.watchlist.map((item) => (
                <div
                  key={item.id}
                  className={cx(
                    "group flex items-center gap-2 rounded-2xl border p-3 transition",
                    item.tvSymbol === boardState.activeSymbol.full
                      ? "border-white bg-white text-slate-950"
                      : "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.075]",
                  )}
                >
                  <button
                    type="button"
                    onClick={() => openWatchlistItem(item)}
                    className="min-w-0 flex-1 text-left"
                  >
                    <div className="truncate text-sm font-black">{item.label}</div>
                    <div
                      className={cx(
                        "mt-0.5 truncate text-[11px]",
                        item.tvSymbol === boardState.activeSymbol.full ? "text-slate-600" : "text-slate-500",
                      )}
                    >
                      {item.tvSymbol} · {item.note}
                    </div>
                  </button>

                  <button
                    type="button"
                    onClick={() => removeWatchlistItem(item.id)}
                    className="rounded-full border border-white/10 bg-black/15 px-2 py-1 text-[10px] font-black opacity-80 transition group-hover:opacity-100"
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-amber-500/25 bg-amber-500/10 p-3">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-100">
                Review-first
              </div>
              <p className="mt-2 text-xs leading-5 text-amber-50">
                This board supports advisor review and discovery. It should not auto-send client
                recommendations or execute trades.
              </p>
            </div>
          </Card>

          <div className="grid gap-4">
            <Card className="p-0">
              <div className="flex flex-col gap-3 border-b border-white/10 p-4 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                    Active Chart
                  </div>
                  <h2 className="mt-1 text-3xl font-black">{boardState.activeSymbol.full}</h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <Pill tone="cyan">{boardState.activeSymbol.exchange}</Pill>
                  <Pill tone="green">{boardState.activeSymbol.display}</Pill>
                  <Pill tone="purple">{boardState.selectedMetrics.length}/10 metrics</Pill>
                </div>
              </div>

              <div className="h-[620px] min-h-[560px] p-2">
                <TradingViewChart symbol={boardState.activeSymbol} />
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
                    Notification Layers
                  </div>
                  <h2 className="mt-2 text-2xl font-black">Generate advisor standards</h2>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                    Apply a complete set of metrics and review standards for the active symbol or
                    your broader watchlist workflow.
                  </p>
                </div>

                <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-2">
                  <button
                    type="button"
                    onClick={() => updateState({ layerScope: "active" })}
                    className={cx(
                      "rounded-xl px-3 py-2 text-xs font-black",
                      boardState.layerScope === "active"
                        ? "bg-white text-slate-950"
                        : "text-slate-400 hover:bg-white/[0.075] hover:text-white",
                    )}
                  >
                    Active
                  </button>
                  <button
                    type="button"
                    onClick={() => updateState({ layerScope: "watchlist" })}
                    className={cx(
                      "rounded-xl px-3 py-2 text-xs font-black",
                      boardState.layerScope === "watchlist"
                        ? "bg-white text-slate-950"
                        : "text-slate-400 hover:bg-white/[0.075] hover:text-white",
                    )}
                  >
                    Watchlist
                  </button>
                </div>
              </div>

              <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {NOTIFICATION_LAYERS.map((layer) => (
                  <NotificationLayerButton key={layer.id} layer={layer} applyLayer={applyLayer} />
                ))}
              </div>
            </Card>

            <Card className="p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-blue-400">
                    Metric Library
                  </div>
                  <h2 className="mt-2 text-2xl font-black">Search hundreds of advisor metrics</h2>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                    Add any metric to the right rail. Keep the board clean by limiting the decision
                    rail to the 10 metrics that matter most.
                  </p>
                </div>

                <input
                  value={boardState.metricSearch}
                  onChange={(event) => updateState({ metricSearch: event.target.value })}
                  placeholder="Search liquidity, valuation, RSI, drawdown..."
                  className="w-full rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2 lg:max-w-md"
                />
              </div>

              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {filteredMetrics.map((metric) => (
                  <button
                    key={metric.id}
                    type="button"
                    onClick={() => addSelectedMetric(metric.id)}
                    disabled={boardState.selectedMetrics.length >= MAX_SELECTED_METRICS}
                    className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-left transition hover:bg-white/[0.075] disabled:cursor-not-allowed disabled:opacity-50"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="truncate text-sm font-black text-white">{metric.label}</div>
                        <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.12em] text-slate-500">
                          {metric.category} · {metric.alertKind}
                        </div>
                      </div>
                      <Pill tone="slate">{metric.unit}</Pill>
                    </div>
                    <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">
                      {metric.description}
                    </p>
                  </button>
                ))}
              </div>
            </Card>
          </div>

          <Card className="h-fit p-4 xl:sticky xl:top-4">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
              Decision Rail
            </div>
            <h2 className="mt-2 text-2xl font-black">Advisor Metrics</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              The right rail stays compact so the board remains readable during client review.
            </p>

            <div className="mt-4 grid gap-3">
              {selectedMetricPairs.map(({ selected, metric }) => (
                <MetricCard
                  key={metric.id}
                  metric={metric}
                  selected={selected}
                  activeSymbol={boardState.activeSymbol}
                  removeMetric={removeSelectedMetric}
                />
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.045] p-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Triggered Alerts
                  </div>
                  <div className="mt-1 text-2xl font-black text-white">{triggeredAlerts.length}</div>
                </div>
                <Pill tone={triggeredAlerts.length ? "amber" : "green"}>
                  {triggeredAlerts.length ? "Review" : "Normal"}
                </Pill>
              </div>

              <div className="mt-3 grid gap-2">
                {triggeredAlerts.length ? (
                  triggeredAlerts.map((alert) => (
                    <div key={alert.metric.id} className={cx("rounded-xl border p-2", toneClass(alert.tone))}>
                      <div className="text-xs font-black text-white">{alert.metric.label}</div>
                      <div className="mt-0.5 text-[11px] text-slate-300">
                        {formatMetricValue(alert.value, alert.metric)} · {alert.status}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="rounded-xl border border-white/10 bg-black/25 p-3 text-xs leading-5 text-slate-400">
                    No selected metric is outside its advisor review standard.
                  </div>
                )}
              </div>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}