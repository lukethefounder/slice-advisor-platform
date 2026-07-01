"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useEffect, useMemo, useState } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";
type IntelView = "technical" | "news";
type SourceType = "Free API" | "Paid Login" | "Manual RSS" | "Internal Watchlist";

type IndicatorKey =
  | "RSI"
  | "MACD"
  | "SMA50"
  | "SMA200"
  | "Volume"
  | "ATR"
  | "Bollinger"
  | "RelativeStrength";

type WatchItem = {
  id: string;
  symbol: string;
  name: string;
  constraint: string;
  targetValue: string;
  note: string;
  source: "Manual" | "Custom Board";
};

type TechnicalSignal = {
  id: string;
  symbol: string;
  source: string;
  indicator: IndicatorKey;
  reading: string;
  interpretation: string;
  severity: "Bullish" | "Bearish" | "Neutral" | "Watch";
  confidence: number;
};

type ArticleItem = {
  id: string;
  title: string;
  source: string;
  sourceType: SourceType;
  symbol: string;
  summary: string;
  category: "Macro" | "Equity" | "Rates" | "Earnings" | "Policy" | "Risk" | "Sector";
  urgency: "High" | "Medium" | "Low";
  access: "Free" | "Login Required" | "API Required";
};

type SourceConfig = {
  id: string;
  name: string;
  type: SourceType;
  status: "Connected" | "Not Connected" | "Login Required" | "API Key Required";
  coverage: string;
  articleTarget: number;
};

const WATCHLIST_KEY = "slice-shared-watchlist-v1";
const INTEL_SOURCE_KEY = "slice-intelligence-sources-v1";
const INTEL_INDICATORS_KEY = "slice-intelligence-indicators-v1";
const INTEL_INDEX_KEY = "slice-intelligence-index-v1";

const DEFAULT_WATCHLIST: WatchItem[] = [
  {
    id: "watch-spy",
    symbol: "SPY",
    name: "S&P 500 ETF",
    constraint: "Notify above",
    targetValue: "550",
    note: "Broad market strength check",
    source: "Custom Board",
  },
  {
    id: "watch-nvda",
    symbol: "NVDA",
    name: "NVIDIA",
    constraint: "Notify move",
    targetValue: "±4%",
    note: "AI exposure client conversation",
    source: "Manual",
  },
  {
    id: "watch-tlt",
    symbol: "TLT",
    name: "20+ Year Treasury ETF",
    constraint: "Notify below",
    targetValue: "88",
    note: "Rate-sensitive portfolio review",
    source: "Manual",
  },
];

const DEFAULT_SOURCES: SourceConfig[] = [
  {
    id: "watchlist",
    name: "Slice Watchlists",
    type: "Internal Watchlist",
    status: "Connected",
    coverage: "Everything in the workspace watchlist",
    articleTarget: 0,
  },
  {
    id: "free-financial-news",
    name: "Free Financial News API Slot",
    type: "Free API",
    status: "API Key Required",
    coverage: "Financial industry headlines, business, markets",
    articleTarget: 60,
  },
  {
    id: "free-sec-policy",
    name: "Free SEC / Policy Source Slot",
    type: "Free API",
    status: "API Key Required",
    coverage: "Filings, policy, regulatory context",
    articleTarget: 35,
  },
  {
    id: "free-macro",
    name: "Free Macro / Rates Source Slot",
    type: "Free API",
    status: "API Key Required",
    coverage: "Rates, macro, Fed, inflation, bonds",
    articleTarget: 35,
  },
  {
    id: "free-sector",
    name: "Free Sector News Source Slot",
    type: "Free API",
    status: "API Key Required",
    coverage: "Sector-specific news and company events",
    articleTarget: 70,
  },
  {
    id: "bloomberg",
    name: "Bloomberg Extension Login",
    type: "Paid Login",
    status: "Login Required",
    coverage: "User-owned Bloomberg access only",
    articleTarget: 0,
  },
  {
    id: "tradingview",
    name: "TradingView Extension Login",
    type: "Paid Login",
    status: "Login Required",
    coverage: "User-owned TradingView news and technical context only",
    articleTarget: 0,
  },
  {
    id: "premium-outlets",
    name: "Other Premium Outlet Login",
    type: "Paid Login",
    status: "Login Required",
    coverage: "WSJ, Barron's, FT, or other user-owned subscriptions",
    articleTarget: 0,
  },
];

const DEFAULT_INDICATORS: IndicatorKey[] = [
  "RSI",
  "MACD",
  "SMA50",
  "SMA200",
  "Volume",
  "Bollinger",
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

const toneClasses: Record<Tone, string> = {
  red: "border-red-500/30 bg-red-500/10 text-red-100",
  green: "border-emerald-500/30 bg-emerald-500/10 text-emerald-100",
  amber: "border-amber-500/30 bg-amber-500/10 text-amber-100",
  purple: "border-purple-500/30 bg-purple-500/10 text-purple-100",
  cyan: "border-cyan-500/30 bg-cyan-500/10 text-cyan-100",
  blue: "border-blue-500/30 bg-blue-500/10 text-blue-100",
  slate: "border-slate-500/20 bg-slate-500/10 text-slate-100",
};

function severityTone(severity: TechnicalSignal["severity"]): Tone {
  if (severity === "Bullish") return "green";
  if (severity === "Bearish") return "red";
  if (severity === "Watch") return "amber";
  return "slate";
}

function urgencyTone(urgency: ArticleItem["urgency"]): Tone {
  if (urgency === "High") return "red";
  if (urgency === "Medium") return "amber";
  return "slate";
}

function sourceTone(type: SourceType): Tone {
  if (type === "Free API") return "cyan";
  if (type === "Paid Login") return "purple";
  if (type === "Internal Watchlist") return "green";
  return "amber";
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-3xl border border-white/10 bg-zinc-950/82 shadow-2xl shadow-black/30 backdrop-blur-xl",
        className,
      )}
    >
      {children}
    </div>
  );
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em]",
        toneClasses[tone],
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function LinkButton({
  href,
  children,
  tone = "red",
}: {
  href: string;
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <Link
      href={href}
      prefetch={false}
      className={cx(
        "inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-black transition hover:-translate-y-0.5",
        toneClasses[tone],
      )}
    >
      {children}
    </Link>
  );
}

function ActionButton({
  children,
  tone = "red",
  onClick,
}: {
  children: ReactNode;
  tone?: Tone;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cx(
        "inline-flex items-center justify-center rounded-2xl border px-4 py-3 text-sm font-black transition hover:-translate-y-0.5",
        toneClasses[tone],
      )}
    >
      {children}
    </button>
  );
}

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = window.localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function saveJson<T>(key: string, value: T) {
  window.localStorage.setItem(key, JSON.stringify(value));
}

function numericSeed(symbol: string) {
  return symbol.split("").reduce((sum, char) => sum + char.charCodeAt(0), 0);
}

function buildTechnicalSignals(
  symbols: string[],
  indicators: IndicatorKey[],
  selectedIndex: string,
): TechnicalSignal[] {
  const allSymbols = Array.from(new Set([...symbols, selectedIndex.toUpperCase()].filter(Boolean)));

  return allSymbols.flatMap((symbol) =>
    indicators.map((indicator, index) => {
      const seed = numericSeed(`${symbol}-${indicator}`);
      const score = (seed * (index + 7)) % 100;
      const severity: TechnicalSignal["severity"] =
        score > 72 ? "Bullish" : score < 28 ? "Bearish" : score > 55 ? "Watch" : "Neutral";

      const readingByIndicator: Record<IndicatorKey, string> = {
        RSI: `${30 + (score % 55)}`,
        MACD: score > 55 ? "Positive cross setup" : score < 35 ? "Negative momentum" : "Flat / mixed",
        SMA50: score > 50 ? "Above 50D" : "Below 50D",
        SMA200: score > 45 ? "Above 200D" : "Below 200D",
        Volume: `${80 + score}% of 20D avg`,
        ATR: `${(1 + score / 33).toFixed(2)} volatility units`,
        Bollinger: score > 70 ? "Upper band pressure" : score < 30 ? "Lower band pressure" : "Middle band",
        RelativeStrength: score > 60 ? "Outperforming index" : score < 40 ? "Underperforming index" : "In line",
      };

      return {
        id: `${symbol}-${indicator}`,
        symbol,
        source: symbol === selectedIndex.toUpperCase() ? "Selected Index" : "Watchlist",
        indicator,
        reading: readingByIndicator[indicator],
        interpretation:
          severity === "Bullish"
            ? `${symbol} is showing constructive ${indicator} behavior.`
            : severity === "Bearish"
              ? `${symbol} is flashing weaker ${indicator} behavior.`
              : severity === "Watch"
                ? `${symbol} should be watched for a possible ${indicator} confirmation.`
                : `${symbol} is currently mixed on ${indicator}.`,
        severity,
        confidence: Math.max(42, Math.min(97, score)),
      };
    }),
  );
}

function buildArticles(
  watchlist: WatchItem[],
  sources: SourceConfig[],
  selectedIndex: string,
): ArticleItem[] {
  const symbols = Array.from(
    new Set([...watchlist.map((item) => item.symbol), selectedIndex.toUpperCase()].filter(Boolean)),
  );

  const freeSources = sources.filter((source) => source.type === "Free API");
  const freeTargets = freeSources.reduce((sum, source) => sum + source.articleTarget, 0);
  const targetCount = Math.max(20, Math.min(200, freeTargets || 200));

  const categories: ArticleItem["category"][] = [
    "Macro",
    "Equity",
    "Rates",
    "Earnings",
    "Policy",
    "Risk",
    "Sector",
  ];

  const articles: ArticleItem[] = [];

  for (let index = 0; index < targetCount; index += 1) {
    const symbol = symbols[index % Math.max(1, symbols.length)] ?? "SPY";
    const category = categories[index % categories.length];
    const source = freeSources[index % Math.max(1, freeSources.length)];

    articles.push({
      id: `article-${index}`,
      title: `${symbol} ${category.toLowerCase()} intelligence item ${index + 1}`,
      source: source?.name ?? "Configured free source",
      sourceType: source?.type ?? "Free API",
      symbol,
      summary:
        index % 3 === 0
          ? `Potentially relevant ${category.toLowerCase()} article for ${symbol}. Backend integration should fetch headline, URL, date, source, sentiment, and source excerpt.`
          : `Article placeholder prepared for ${symbol}. This slot is ready for a trusted free API, RSS feed, or compliant paid-login connector.`,
      category,
      urgency: index % 11 === 0 ? "High" : index % 4 === 0 ? "Medium" : "Low",
      access: source?.status === "Connected" ? "Free" : "API Required",
    });
  }

  const paidSources = sources.filter((source) => source.type === "Paid Login");

  paidSources.forEach((source, index) => {
    articles.unshift({
      id: `paid-${source.id}`,
      title: `${source.name} connector ready`,
      source: source.name,
      sourceType: "Paid Login",
      symbol: symbols[index % Math.max(1, symbols.length)] ?? "SPY",
      summary:
        "Paid-source access must use the user's own authorized login/session or official API. Slice should not bypass paywalls, scrape without permission, or store raw passwords.",
      category: "Risk",
      urgency: "Medium",
      access: "Login Required",
    });
  });

  return articles;
}

export default function IntelligencePage() {
  const [view, setView] = useState<IntelView>("technical");
  const [watchlist, setWatchlist] = useState<WatchItem[]>(DEFAULT_WATCHLIST);
  const [sources, setSources] = useState<SourceConfig[]>(DEFAULT_SOURCES);
  const [indicators, setIndicators] = useState<IndicatorKey[]>(DEFAULT_INDICATORS);
  const [selectedIndex, setSelectedIndex] = useState("SPY");
  const [customSymbol, setCustomSymbol] = useState("");
  const [articleQuery, setArticleQuery] = useState("");
  const [lastScan, setLastScan] = useState("Not scanned yet");

  useEffect(() => {
    const storedWatchlist = loadJson<WatchItem[]>(WATCHLIST_KEY, DEFAULT_WATCHLIST);
    const storedSources = loadJson<SourceConfig[]>(INTEL_SOURCE_KEY, DEFAULT_SOURCES);
    const storedIndicators = loadJson<IndicatorKey[]>(INTEL_INDICATORS_KEY, DEFAULT_INDICATORS);
    const storedIndex = window.localStorage.getItem(INTEL_INDEX_KEY);

    setWatchlist(storedWatchlist);
    setSources(storedSources);
    setIndicators(storedIndicators);

    if (storedIndex) setSelectedIndex(storedIndex);

    const params = new URLSearchParams(window.location.search);
    const symbol = params.get("symbol");

    if (symbol) {
      setSelectedIndex(symbol.toUpperCase());
      setView("technical");
    }
  }, []);

  useEffect(() => {
    saveJson(INTEL_SOURCE_KEY, sources);
  }, [sources]);

  useEffect(() => {
    saveJson(INTEL_INDICATORS_KEY, indicators);
  }, [indicators]);

  useEffect(() => {
    window.localStorage.setItem(INTEL_INDEX_KEY, selectedIndex);
  }, [selectedIndex]);

  const symbols = useMemo(() => watchlist.map((item) => item.symbol), [watchlist]);

  const technicalSignals = useMemo(() => {
    return buildTechnicalSignals(symbols, indicators, selectedIndex);
  }, [indicators, selectedIndex, symbols]);

  const articles = useMemo(() => {
    const normalized = articleQuery.trim().toLowerCase();
    const generated = buildArticles(watchlist, sources, selectedIndex);

    if (!normalized) return generated;

    return generated.filter((article) =>
      [
        article.title,
        article.source,
        article.symbol,
        article.summary,
        article.category,
        article.urgency,
      ]
        .join(" ")
        .toLowerCase()
        .includes(normalized),
    );
  }, [articleQuery, selectedIndex, sources, watchlist]);

  const highSignals = technicalSignals.filter(
    (signal) => signal.severity === "Bullish" || signal.severity === "Bearish",
  ).length;

  const highArticles = articles.filter((article) => article.urgency === "High").length;
  const paidConnectors = sources.filter((source) => source.type === "Paid Login").length;

  const freeArticleTarget = sources
    .filter((source) => source.type === "Free API")
    .reduce((sum, source) => sum + source.articleTarget, 0);

  function toggleIndicator(indicator: IndicatorKey) {
    setIndicators((current) => {
      if (current.includes(indicator)) return current.filter((item) => item !== indicator);
      return [...current, indicator];
    });
  }

  function connectSource(id: string) {
    setSources((current) =>
      current.map((source) =>
        source.id === id
          ? {
              ...source,
              status: source.type === "Paid Login" ? "Login Required" : "Connected",
            }
          : source,
      ),
    );
  }

  function addCustomSymbol() {
    const symbol = customSymbol.trim().toUpperCase();
    if (!symbol) return;

    const nextItem: WatchItem = {
      id: `watch-${symbol}-${Date.now()}`,
      symbol,
      name: symbol,
      constraint: "Intelligence scan",
      targetValue: "Advisor set",
      note: "Added from Intelligence page.",
      source: "Manual",
    };

    const next = [nextItem, ...watchlist.filter((item) => item.symbol !== symbol)];

    setWatchlist(next);
    saveJson(WATCHLIST_KEY, next);
    setCustomSymbol("");
  }

  function scanNow() {
    setLastScan(
      new Date().toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      }),
    );
  }

  return (
    <main className="relative h-screen overflow-hidden bg-[#050505] text-white">
      <div className="pointer-events-none fixed inset-0">
        <div className="absolute left-[-16%] top-[-16%] h-[34rem] w-[34rem] rounded-full bg-red-700/25 blur-3xl" />
        <div className="absolute right-[-12%] top-[8%] h-[32rem] w-[32rem] rounded-full bg-cyan-700/14 blur-3xl" />
        <div className="absolute bottom-[-18%] left-[28%] h-[30rem] w-[30rem] rounded-full bg-purple-500/10 blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(255,255,255,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(255,255,255,0.025)_1px,transparent_1px)] bg-[size:44px_44px]" />
      </div>

      <div className="relative mx-auto grid h-screen max-w-[1900px] grid-rows-[auto_minmax(0,1fr)] gap-3 p-3">
        <header className="rounded-[1.75rem] border border-white/10 bg-black/70 p-4 shadow-2xl shadow-black/40 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="red">Intelligence</Pill>
                <Pill tone="cyan">{technicalSignals.length} technical checks</Pill>
                <Pill tone="amber">{Math.min(200, freeArticleTarget)} article target</Pill>
                <Pill tone="purple">{paidConnectors} paid connectors</Pill>
              </div>

              <h1 className="mt-3 text-3xl font-black leading-tight md:text-5xl">
                Watchlist-driven technical and article intelligence.
              </h1>

              <p className="mt-2 max-w-5xl text-sm font-semibold leading-7 text-slate-400">
                This cockpit reads the workspace watchlist, runs customizable technical scans, tracks a selected
                index/security, and prepares source slots for trusted free APIs plus user-authorized paid-source
                connectors. Paid subscriptions must use the user's own authorized login or official API access.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <LinkButton href="/workspace" tone="slate">Workspace</LinkButton>
              <LinkButton href="/workspace?tab=watchlists" tone="amber">Watchlists</LinkButton>
              <LinkButton href="/market-visuals" tone="blue">Market Visuals</LinkButton>
              <ActionButton onClick={scanNow} tone="red">Scan Now</ActionButton>
            </div>
          </div>
        </header>

        <section className="grid min-h-0 gap-3 xl:grid-cols-[330px_minmax(0,1fr)]">
          <Card className="min-h-0 p-4">
            <div className="grid gap-3">
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setView("technical")}
                  className={cx(
                    "rounded-2xl border px-4 py-3 text-left transition",
                    view === "technical" ? toneClasses.red : "border-white/10 bg-white/[0.045]",
                  )}
                >
                  <div className="text-sm font-black">Technical</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    Watchlist scan
                  </div>
                </button>

                <button
                  type="button"
                  onClick={() => setView("news")}
                  className={cx(
                    "rounded-2xl border px-4 py-3 text-left transition",
                    view === "news" ? toneClasses.cyan : "border-white/10 bg-white/[0.045]",
                  )}
                >
                  <div className="text-sm font-black">News / Articles</div>
                  <div className="text-[10px] font-bold uppercase tracking-[0.12em] text-slate-500">
                    Source scan
                  </div>
                </button>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
                  Scan Scope
                </div>

                <div className="mt-3 grid gap-2">
                  <select
                    value={selectedIndex}
                    onChange={(event) => setSelectedIndex(event.target.value)}
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none"
                  >
                    <option>SPY</option>
                    <option>QQQ</option>
                    <option>DIA</option>
                    <option>IWM</option>
                    <option>VOO</option>
                    <option>TLT</option>
                  </select>

                  <input
                    value={customSymbol}
                    onChange={(event) => setCustomSymbol(event.target.value)}
                    placeholder="Add symbol to watchlist"
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                  />

                  <ActionButton onClick={addCustomSymbol} tone="amber">
                    Add Symbol
                  </ActionButton>
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
                  Watchlist Symbols
                </div>

                <div className="mt-3 grid max-h-[220px] gap-2 overflow-y-auto pr-1">
                  {watchlist.map((item) => (
                    <Link
                      key={item.id}
                      href={`/workspace/intelligence?symbol=${encodeURIComponent(item.symbol)}`}
                      className="rounded-2xl border border-white/10 bg-black/25 px-3 py-2 transition hover:bg-white/[0.06]"
                    >
                      <div className="text-sm font-black text-white">{item.symbol}</div>
                      <div className="text-xs font-semibold text-slate-500">
                        {item.constraint} · {item.targetValue}
                      </div>
                    </Link>
                  ))}
                </div>
              </div>

              <div className="rounded-3xl border border-white/10 bg-white/[0.045] p-4">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-green-400">
                  Status
                </div>

                <div className="mt-3 grid gap-2">
                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                      Last Scan
                    </div>
                    <div className="mt-1 text-sm font-black text-white">{lastScan}</div>
                  </div>

                  <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                      24/7 Requirement
                    </div>
                    <div className="mt-1 text-xs font-semibold leading-5 text-slate-400">
                      Production constant scanning needs a backend worker, cron job, or queue. This page is the
                      cockpit and configuration layer.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </Card>

          <Card className="min-h-0 p-5">
            {view === "technical" ? (
              <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone="red">Technical Scan</Pill>
                    <Pill tone="cyan">{selectedIndex} index/security</Pill>
                    <Pill tone="amber">{highSignals} priority signals</Pill>
                  </div>

                  <h2 className="mt-3 text-3xl font-black text-white">
                    Customizable technical scanner
                  </h2>

                  <p className="mt-2 text-sm font-semibold leading-7 text-slate-400">
                    Choose indicators and scan every watchlist item plus a selected index/security. A production
                    backend should replace the demo readings with real market data.
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    {(
                      [
                        "RSI",
                        "MACD",
                        "SMA50",
                        "SMA200",
                        "Volume",
                        "ATR",
                        "Bollinger",
                        "RelativeStrength",
                      ] as IndicatorKey[]
                    ).map((indicator) => (
                      <button
                        key={indicator}
                        type="button"
                        onClick={() => toggleIndicator(indicator)}
                        className={cx(
                          "rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em]",
                          indicators.includes(indicator)
                            ? toneClasses.red
                            : "border-white/10 bg-white/[0.045] text-slate-400",
                        )}
                      >
                        {indicator}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid max-h-[calc(100vh-330px)] gap-3 overflow-y-auto pr-1 md:grid-cols-2 2xl:grid-cols-3">
                  {technicalSignals.map((signal) => (
                    <div
                      key={signal.id}
                      className="rounded-3xl border border-white/10 bg-white/[0.045] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="text-2xl font-black text-white">{signal.symbol}</div>
                          <div className="text-xs font-semibold text-slate-500">
                            {signal.source} · {signal.indicator}
                          </div>
                        </div>
                        <Pill tone={severityTone(signal.severity)}>{signal.severity}</Pill>
                      </div>

                      <div className="mt-4 rounded-2xl border border-white/10 bg-black/25 p-3">
                        <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                          Reading
                        </div>
                        <div className="mt-1 text-sm font-black text-white">{signal.reading}</div>
                      </div>

                      <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
                        {signal.interpretation}
                      </p>

                      <div className="mt-4 flex items-center justify-between gap-3">
                        <div className="h-2 flex-1 overflow-hidden rounded-full bg-white/10">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400"
                            style={{ width: `${signal.confidence}%` }}
                          />
                        </div>
                        <div className="text-xs font-black text-white">{signal.confidence}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : (
              <div className="grid h-full min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-4">
                <div>
                  <div className="flex flex-wrap gap-2">
                    <Pill tone="cyan">News / Articles</Pill>
                    <Pill tone="amber">{articles.length} configured article slots</Pill>
                    <Pill tone="purple">{paidConnectors} premium connectors</Pill>
                    <Pill tone="red">{highArticles} high urgency</Pill>
                  </div>

                  <h2 className="mt-3 text-3xl font-black text-white">
                    Article and source intelligence
                  </h2>

                  <p className="mt-2 text-sm font-semibold leading-7 text-slate-400">
                    Free API slots can be wired to financial news APIs, RSS feeds, SEC/policy feeds, and macro
                    sources. Paid outlets must be accessed only through the user's authorized login, extension, or
                    official API.
                  </p>

                  <div className="mt-4 grid gap-3 xl:grid-cols-[minmax(0,1fr)_360px]">
                    <input
                      value={articleQuery}
                      onChange={(event) => setArticleQuery(event.target.value)}
                      placeholder="Search articles, sources, symbols..."
                      className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600"
                    />

                    <div className="flex flex-wrap gap-2">
                      {sources.map((source) => (
                        <button
                          key={source.id}
                          type="button"
                          onClick={() => connectSource(source.id)}
                          className={cx(
                            "rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em]",
                            toneClasses[sourceTone(source.type)],
                          )}
                        >
                          {source.name}
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                <div className="grid min-h-0 gap-3 xl:grid-cols-[minmax(0,1fr)_380px]">
                  <div className="grid max-h-[calc(100vh-350px)] gap-3 overflow-y-auto pr-1 md:grid-cols-2">
                    {articles.map((article) => (
                      <div
                        key={article.id}
                        className="rounded-3xl border border-white/10 bg-white/[0.045] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-black text-white">{article.title}</div>
                            <div className="mt-1 text-xs font-semibold text-slate-500">
                              {article.source} · {article.symbol}
                            </div>
                          </div>
                          <Pill tone={urgencyTone(article.urgency)}>{article.urgency}</Pill>
                        </div>

                        <p className="mt-3 text-sm font-semibold leading-6 text-slate-400">
                          {article.summary}
                        </p>

                        <div className="mt-4 flex flex-wrap gap-2">
                          <Pill tone="cyan">{article.category}</Pill>
                          <Pill tone={sourceTone(article.sourceType)}>{article.sourceType}</Pill>
                          <Pill tone={article.access === "Free" ? "green" : "amber"}>
                            {article.access}
                          </Pill>
                        </div>
                      </div>
                    ))}
                  </div>

                  <div className="grid max-h-[calc(100vh-350px)] gap-3 overflow-y-auto pr-1">
                    {sources.map((source) => (
                      <div
                        key={source.id}
                        className="rounded-3xl border border-white/10 bg-white/[0.045] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-sm font-black text-white">{source.name}</div>
                            <div className="mt-1 text-xs font-semibold text-slate-500">
                              {source.coverage}
                            </div>
                          </div>
                          <Pill tone={sourceTone(source.type)}>{source.type}</Pill>
                        </div>

                        <div className="mt-4 grid grid-cols-2 gap-2">
                          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                              Status
                            </div>
                            <div className="mt-1 text-xs font-black text-white">{source.status}</div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/25 p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-500">
                              Target
                            </div>
                            <div className="mt-1 text-xs font-black text-white">
                              {source.articleTarget}
                            </div>
                          </div>
                        </div>

                        {source.type === "Paid Login" ? (
                          <div className="mt-3 rounded-2xl border border-purple-500/30 bg-purple-500/10 p-3 text-xs font-semibold leading-5 text-purple-100">
                            Use user-authorized login/extension access only. Do not scrape, bypass paywalls, or
                            store raw passwords.
                          </div>
                        ) : null}

                        <div className="mt-3">
                          <ActionButton onClick={() => connectSource(source.id)} tone={sourceTone(source.type)}>
                            {source.type === "Paid Login" ? "Open Login Connector" : "Mark Connected"}
                          </ActionButton>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </Card>
        </section>
      </div>
    </main>
  );
}