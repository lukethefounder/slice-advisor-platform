"use client";

import { useEffect, useMemo, useState, type FormEvent, type ReactNode } from "react";

type TechnicalUniverseId =
  | "sp100"
  | "nasdaq100"
  | "dow30"
  | "advisor-watchlist"
  | "custom";

type Signal = {
  id: string;
  title: string;
  summary: string | null;
  sourceName: string;
  signalType: string;
  priorityTier: string;
  portfolioRelevanceScore: number;
  opportunityScore: number;
  riskScore: number;
  confidenceScore: number;
  actionabilityScore: number;
  compositeScore: number;
  tickersJson: string;
  categoriesJson: string;
  evidenceJson: string;
  suggestedAction: string;
  advisorNotes: string | null;
  status: string;
  createdAt: string;
  updatedAt: string;
};

type IntelligenceRun = {
  id: string;
  mode: string;
  scannedCount: number;
  retainedCount: number;
  alertCount: number;
  digestCount: number;
  discardedCount: number;
  durationMs: number;
  createdAt: string;
};

type TechnicalPayload = {
  type: "TECHNICAL_PAYLOAD";
  version: number;
  symbol: string;
  snapshot: {
    companyName: string | null;
    price: number;
    rsi7: number | null;
    rsi14: number | null;
    rsi21: number | null;
    rsiRegime: string;
    rsi14RecoveryFromOversold: boolean;
    rsiBullishDivergence: boolean;
    rangePositionPct: number | null;
    drawdownFromHighPct: number | null;
    distanceToSma20Pct: number | null;
    distanceToSma50Pct: number | null;
    distanceToSma200Pct: number | null;
    macdHistogram: number | null;
    macdHistogramImproving: boolean;
    bollingerPositionPct: number | null;
    volumeRatio: number | null;
    atr14Pct: number | null;
    volatility30Pct: number | null;
    return1mPct: number | null;
    return3mPct: number | null;
    return6mPct: number | null;
    return12mPct: number | null;
    relative3mVsBenchmarkPct: number | null;
    marketCap: number | null;
    trailingPE: number | null;
    forwardPE: number | null;
    priceToBook: number | null;
    beta: number | null;
    dividendYield: number | null;
    dollarVolume: number | null;
  };
  miniChart: Array<{
    d: string;
    c: number;
    s20: number | null;
    s50: number | null;
    r: number | null;
  }>;
};

type RadarResponse = {
  signals: Signal[];
  stats: {
    total: number;
    open: number;
    critical: number;
    high: number;
    protect: number;
    opportunity: number;
  };
  technical?: {
    universes: Array<{
      id: TechnicalUniverseId;
      label: string;
      description: string;
    }>;
    total: number;
    open: number;
    highConviction: number;
    critical: number;
    averageComposite: number;
    averageConfidence: number;
    averageActionability: number;
    recentRuns: IntelligenceRun[];
    lastRun: IntelligenceRun | null;
  };
  headline?: {
    total: number;
    open: number;
    critical: number;
    high: number;
    averageComposite: number;
    recentRuns: IntelligenceRun[];
    lastRun: IntelligenceRun | null;
  };
  autopilot?: {
    enabled: boolean;
    route: string;
    scheduleSummary: string;
    latestRun: IntelligenceRun | null;
    recentRuns: IntelligenceRun[];
    continuousScanningNote: string;
  };
};

type Tone = "red" | "green" | "amber" | "slate" | "purple" | "cyan";
type ActiveView = "command" | "signals" | "technical" | "autopilot" | "settings";
type SignalFilter = "all" | "technical" | "headline" | "critical" | "high";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseJsonList(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function extractTechnicalPayload(items: unknown[]): TechnicalPayload | null {
  const found = items.find((item) => {
    if (!item || typeof item !== "object") return false;
    return (item as { type?: string }).type === "TECHNICAL_PAYLOAD";
  });

  return (found as TechnicalPayload | undefined) ?? null;
}

function evidenceStrings(items: unknown[]) {
  return items.filter((item) => typeof item === "string").map(String);
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  return `${value.toFixed(1)}%`;
}

function compactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000_000) return `${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(1)}K`;
  return `${value.toFixed(0)}`;
}

function dollars(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toFixed(2)}`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
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

function tradingViewSymbol(symbol: string) {
  if (!symbol) return "NASDAQ:AAPL";
  if (symbol.includes(":")) return symbol;
  return `NASDAQ:${symbol}`;
}

function tierTone(tier: string): Tone {
  if (tier === "Critical") return "red";
  if (tier === "High") return "amber";
  if (tier === "Medium") return "green";
  return "slate";
}

function signalTone(type: string): Tone {
  if (type === "Protect") return "red";
  if (type === "Opportunity") return "green";
  if (type === "Technical Opportunity") return "cyan";
  if (type === "High-Risk Opportunity") return "amber";
  return "purple";
}

function scoreTone(score: number): Tone {
  if (score >= 85) return "green";
  if (score >= 72) return "cyan";
  if (score >= 60) return "amber";
  return "slate";
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
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/78 shadow-xl shadow-red-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function Panel({
  children,
  className = "",
  tone = "slate",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  const glows: Record<Tone, string> = {
    red: "from-red-500/16",
    green: "from-emerald-500/16",
    amber: "from-amber-500/16",
    purple: "from-purple-500/16",
    cyan: "from-cyan-500/16",
    slate: "from-slate-400/8",
  };

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.052] p-4 shadow-lg shadow-black/10",
        className
      )}
    >
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">{children}</div>
    </div>
  );
}

function Pill({
  children,
  tone = "red",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const tones: Record<Tone, string> = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex max-w-full rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1",
        tones[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-zinc-950 to-red-700 shadow-lg shadow-red-950/50 ring-1 ring-red-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
      </div>

      <div>
        <div className="text-2xl font-black tracking-tight text-white">Slice</div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
          Opportunity Radar
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: Tone;
}) {
  const tones: Record<Tone, string> = {
    red: "from-red-500/16",
    green: "from-emerald-500/16",
    amber: "from-amber-500/16",
    purple: "from-purple-500/16",
    cyan: "from-cyan-500/16",
    slate: "from-slate-400/10",
  };

  return (
    <Card className="p-4">
      <div className={cx("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", tones[tone])} />
      <div className="relative">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</div> : null}
      </div>
    </Card>
  );
}

function ProgressBar({
  value,
  tone = "cyan",
}: {
  value: number;
  tone?: Tone;
}) {
  const colors: Record<Tone, string> = {
    red: "from-red-500 to-red-800",
    green: "from-emerald-400 to-emerald-700",
    amber: "from-amber-400 to-amber-700",
    purple: "from-purple-400 to-purple-800",
    cyan: "from-cyan-400 to-cyan-700",
    slate: "from-slate-400 to-slate-700",
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className={cx("h-full rounded-full bg-gradient-to-r transition-all", colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function RunBars({ runs }: { runs: IntelligenceRun[] }) {
  const points = runs.slice(0, 8).reverse();

  if (!points.length) {
    return (
      <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
        No recent scan runs yet.
      </div>
    );
  }

  const maxScanned = Math.max(1, ...points.map((run) => run.scannedCount));

  return (
    <div className="grid gap-3">
      {points.map((run) => (
        <div key={run.id} className="rounded-2xl border border-white/10 bg-black/35 p-3">
          <div className="flex items-center justify-between gap-3">
            <div className="min-w-0">
              <div className="truncate text-xs font-black text-white">{run.mode}</div>
              <div className="mt-1 text-[10px] font-bold text-slate-500">
                {relativeTime(run.createdAt)} · {run.durationMs}ms
              </div>
            </div>
            <Pill tone={run.alertCount ? "red" : run.retainedCount ? "cyan" : "slate"}>
              {run.alertCount} alerts
            </Pill>
          </div>
          <div className="mt-3 grid gap-2">
            <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              <span>Scanned {run.scannedCount}</span>
              <span>Retained {run.retainedCount}</span>
            </div>
            <ProgressBar value={(run.scannedCount / maxScanned) * 100} tone={run.alertCount ? "red" : "cyan"} />
          </div>
        </div>
      ))}
    </div>
  );
}

function TradingViewChart({ symbol }: { symbol: string }) {
  const resolved = tradingViewSymbol(symbol);

  return (
    <iframe
      key={resolved}
      title={`TradingView ${resolved}`}
      src={`https://s.tradingview.com/widgetembed/?frameElementId=slice_opportunity_${encodeURIComponent(
        resolved
      )}&symbol=${encodeURIComponent(
        resolved
      )}&interval=D&hidesidetoolbar=0&symboledit=1&saveimage=1&toolbarbg=131722&studies=%5B%22Volume%40tv-basicstudies%22%2C%22MASimple%40tv-basicstudies%22%2C%22RSI%40tv-basicstudies%22%2C%22MACD%40tv-basicstudies%22%5D&theme=dark&style=1&timezone=America%2FPhoenix&withdateranges=1&hideideas=1&studies_overrides=%7B%7D&overrides=%7B%7D&enabled_features=%5B%5D&disabled_features=%5B%5D&utm_source=slice.local&utm_medium=widget&utm_campaign=chart&utm_term=${encodeURIComponent(
        resolved
      )}`}
      className="h-[420px] w-full rounded-[1.5rem] border border-white/10 bg-black"
      allowFullScreen
    />
  );
}

function MiniTechnicalChart({ payload }: { payload: TechnicalPayload }) {
  const points = payload.miniChart ?? [];

  if (points.length < 2) {
    return (
      <div className="rounded-2xl border border-white/10 bg-black/30 p-4 text-sm text-slate-500">
        Not enough chart data.
      </div>
    );
  }

  const width = 680;
  const priceHeight = 168;
  const rsiHeight = 72;
  const gap = 14;
  const height = priceHeight + rsiHeight + gap;

  const closes = points.map((point) => point.c);
  const sma20 = points.map((point) => point.s20).filter((value): value is number => value !== null);
  const sma50 = points.map((point) => point.s50).filter((value): value is number => value !== null);
  const allPriceValues = [...closes, ...sma20, ...sma50];
  const priceMin = Math.min(...allPriceValues);
  const priceMax = Math.max(...allPriceValues);
  const priceRange = priceMax - priceMin || 1;

  function x(index: number) {
    return (index / (points.length - 1)) * width;
  }

  function priceY(value: number) {
    return priceHeight - ((value - priceMin) / priceRange) * priceHeight;
  }

  function rsiY(value: number) {
    return priceHeight + gap + rsiHeight - (value / 100) * rsiHeight;
  }

  const closePath = points
    .map((point, index) => `${index === 0 ? "M" : "L"} ${x(index)} ${priceY(point.c)}`)
    .join(" ");

  const sma20Path = points
    .map((point, index) =>
      point.s20 === null ? "" : `${index === 0 ? "M" : "L"} ${x(index)} ${priceY(point.s20)}`
    )
    .filter(Boolean)
    .join(" ");

  const sma50Path = points
    .map((point, index) =>
      point.s50 === null ? "" : `${index === 0 ? "M" : "L"} ${x(index)} ${priceY(point.s50)}`
    )
    .filter(Boolean)
    .join(" ");

  const rsiPath = points
    .map((point, index) =>
      point.r === null ? "" : `${index === 0 ? "M" : "L"} ${x(index)} ${rsiY(point.r)}`
    )
    .filter(Boolean)
    .join(" ");

  return (
    <div className="rounded-3xl border border-cyan-500/20 bg-cyan-500/10 p-4">
      <div className="flex flex-col gap-2 md:flex-row md:items-end md:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">
            Technical chart
          </div>
          <div className="mt-1 text-lg font-black text-white">
            {payload.symbol} {payload.snapshot.companyName ? `· ${payload.snapshot.companyName}` : ""}
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <Pill tone="cyan">Price</Pill>
          <Pill tone="green">SMA 20</Pill>
          <Pill tone="purple">SMA 50</Pill>
          <Pill tone="amber">RSI</Pill>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-2xl border border-white/10 bg-black/40 p-3">
        <svg viewBox={`0 0 ${width} ${height}`} className="h-64 w-full">
          <line x1="0" x2={width} y1={priceHeight + gap} y2={priceHeight + gap} stroke="rgba(255,255,255,.18)" />
          <line x1="0" x2={width} y1={rsiY(70)} y2={rsiY(70)} stroke="rgba(251,191,36,.35)" strokeDasharray="4 5" />
          <line x1="0" x2={width} y1={rsiY(30)} y2={rsiY(30)} stroke="rgba(251,191,36,.35)" strokeDasharray="4 5" />
          <path d={closePath} fill="none" stroke="rgba(248,113,113,.95)" strokeWidth="3" />
          {sma20Path ? <path d={sma20Path} fill="none" stroke="rgba(52,211,153,.95)" strokeWidth="2" /> : null}
          {sma50Path ? <path d={sma50Path} fill="none" stroke="rgba(168,85,247,.95)" strokeWidth="2" /> : null}
          {rsiPath ? <path d={rsiPath} fill="none" stroke="rgba(251,191,36,.95)" strokeWidth="2" /> : null}
          <text x="6" y="14" fill="rgba(203,213,225,.9)" fontSize="12">${priceMax.toFixed(2)}</text>
          <text x="6" y={priceHeight - 4} fill="rgba(203,213,225,.9)" fontSize="12">${priceMin.toFixed(2)}</text>
          <text x="6" y={rsiY(70) - 5} fill="rgba(251,191,36,.8)" fontSize="12">RSI 70</text>
          <text x="6" y={rsiY(30) - 5} fill="rgba(251,191,36,.8)" fontSize="12">RSI 30</text>
        </svg>
      </div>
    </div>
  );
}

function TechnicalDetailGrid({ payload }: { payload: TechnicalPayload }) {
  const s = payload.snapshot;

  const items = [
    ["Price", dollars(s.price), "cyan"],
    ["RSI 7 / 14 / 21", `${pct(s.rsi7).replace("%", "")} / ${pct(s.rsi14).replace("%", "")} / ${pct(s.rsi21).replace("%", "")}`, "amber"],
    ["RSI Regime", s.rsiRegime, "amber"],
    ["RSI Recovery", s.rsi14RecoveryFromOversold ? "Yes" : "No", s.rsi14RecoveryFromOversold ? "green" : "slate"],
    ["RSI Divergence", s.rsiBullishDivergence ? "Yes" : "No", s.rsiBullishDivergence ? "green" : "slate"],
    ["52W Position", pct(s.rangePositionPct), "cyan"],
    ["Drawdown", pct(s.drawdownFromHighPct), "red"],
    ["SMA 20 Distance", pct(s.distanceToSma20Pct), "cyan"],
    ["SMA 50 Distance", pct(s.distanceToSma50Pct), "purple"],
    ["SMA 200 Distance", pct(s.distanceToSma200Pct), "purple"],
    ["MACD Improving", s.macdHistogramImproving ? "Yes" : "No", s.macdHistogramImproving ? "green" : "slate"],
    ["Bollinger Position", pct(s.bollingerPositionPct), "cyan"],
    ["Volume Ratio", s.volumeRatio === null ? "—" : `${s.volumeRatio.toFixed(2)}x`, "green"],
    ["ATR %", pct(s.atr14Pct), "red"],
    ["3M Relative", pct(s.relative3mVsBenchmarkPct), "purple"],
    ["Forward P/E", s.forwardPE === null ? "—" : s.forwardPE.toFixed(1), "slate"],
    ["Market Cap", dollars(s.marketCap), "slate"],
    ["Dollar Volume", dollars(s.dollarVolume), "slate"],
  ] as Array<[string, string, Tone]>;

  return (
    <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
      {items.map(([label, value, tone]) => (
        <Panel key={`${payload.symbol}-${label}`} tone={tone} className="bg-black/35">
          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
          <div className="mt-1 truncate text-lg font-black text-white">{value}</div>
        </Panel>
      ))}
    </div>
  );
}

function ScoreGauge({ label, value }: { label: string; value: number }) {
  return (
    <Panel tone={scoreTone(value)} className="bg-black/35">
      <div className="flex items-center justify-between gap-3">
        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
          {label}
        </div>
        <div className="text-xl font-black text-white">{value}</div>
      </div>
      <div className="mt-3">
        <ProgressBar value={value} tone={scoreTone(value)} />
      </div>
    </Panel>
  );
}

export default function OpportunityRadarPage() {
  const [data, setData] = useState<RadarResponse | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [activeView, setActiveView] = useState<ActiveView>("command");
  const [signalFilter, setSignalFilter] = useState<SignalFilter>("all");
  const [search, setSearch] = useState("");
  const [selectedSymbol, setSelectedSymbol] = useState("AAPL");

  const [technicalForm, setTechnicalForm] = useState({
    indexUniverse: "sp100" as TechnicalUniverseId,
    customSymbols: "",
    limit: 100,
    minCompositeScore: 70,
    maxDurationMs: 38_000,
    scanMode: "fast" as "fast" | "broad" | "deep",
    minOpportunityScore: "",
    maxRiskScore: 78,
    minConfidenceScore: 50,
    minActionabilityScore: 46,
    minAdvisorRelevanceScore: "",
    minPrice: 5,
    maxPrice: "",
    minMarketCap: "",
    minDollarVolume: 3000000,
    minRsi14: 32,
    maxRsi14: 62,
    requireRsiRecovery: false,
    requireRsiDivergence: false,
    requireConstructiveRsiStack: false,
    minRangePositionPct: "",
    maxRangePositionPct: "",
    minDrawdownFromHighPct: "",
    maxDrawdownFromHighPct: "",
    minDistanceToSma200Pct: "",
    maxDistanceToSma200Pct: "",
    requirePriceAboveSma20: false,
    requirePriceAboveSma50: false,
    requireMacdImproving: true,
    minRelative3mVsBenchmarkPct: "",
    maxVolatility30Pct: 70,
    maxAtr14Pct: 8,
    maxBeta: "",
    maxForwardPE: "",
    maxTrailingPE: "",
    maxPriceToBook: "",
    minDividendYield: "",
    onlyAdvisorRelevant: false,
  });

  const signals = data?.signals ?? [];
  const technicalSignals = useMemo(() => {
    return signals.filter((signal) => signal.signalType === "Technical Opportunity");
  }, [signals]);

  const headlineSignals = useMemo(() => {
    return signals.filter((signal) => signal.signalType !== "Technical Opportunity");
  }, [signals]);

  const openSignals = useMemo(() => {
    const query = search.trim().toLowerCase();

    return signals
      .filter((signal) => signal.status === "Open")
      .filter((signal) => {
        if (signalFilter === "technical") return signal.signalType === "Technical Opportunity";
        if (signalFilter === "headline") return signal.signalType !== "Technical Opportunity";
        if (signalFilter === "critical") return signal.priorityTier === "Critical";
        if (signalFilter === "high") return signal.priorityTier === "High";
        return true;
      })
      .filter((signal) => {
        if (!query) return true;

        return (
          signal.title.toLowerCase().includes(query) ||
          signal.summary?.toLowerCase().includes(query) ||
          signal.sourceName.toLowerCase().includes(query) ||
          signal.signalType.toLowerCase().includes(query) ||
          signal.tickersJson.toLowerCase().includes(query)
        );
      })
      .sort((a, b) => b.compositeScore - a.compositeScore);
  }, [signals, signalFilter, search]);

  const selectedTechnicalPayload = useMemo(() => {
    const match =
      technicalSignals
        .map((signal) => extractTechnicalPayload(parseJsonList(signal.evidenceJson)))
        .find((payload) => payload?.symbol === selectedSymbol) ??
      technicalSignals
        .map((signal) => extractTechnicalPayload(parseJsonList(signal.evidenceJson)))
        .find(Boolean) ??
      null;

    return match;
  }, [technicalSignals, selectedSymbol]);

  const technicalSymbols = useMemo(() => {
    return technicalSignals
      .map((signal) => extractTechnicalPayload(parseJsonList(signal.evidenceJson)))
      .filter((payload): payload is TechnicalPayload => Boolean(payload))
      .map((payload) => payload.symbol);
  }, [technicalSignals]);

  async function loadData() {
    const response = await fetch("/api/opportunities", {
      cache: "no-store",
    });

    const payload = await response.json().catch(() => null);

    if (!response.ok) {
      setMessage(payload?.error ?? "Unable to load Opportunity Radar.");
      return;
    }

    setData(payload);

    const firstTechnical = payload?.signals
      ?.map((signal: Signal) => extractTechnicalPayload(parseJsonList(signal.evidenceJson)))
      ?.find(Boolean);

    if (firstTechnical?.symbol && selectedSymbol === "AAPL") {
      setSelectedSymbol(firstTechnical.symbol);
    }
  }

  function buildAdvancedFilters() {
    function maybeNumber(value: string | number | boolean) {
      if (typeof value === "boolean") return undefined;
      if (value === "") return undefined;
      const number = Number(value);
      return Number.isFinite(number) ? number : undefined;
    }

    return {
      minCompositeScore: technicalForm.minCompositeScore,
      minOpportunityScore: maybeNumber(technicalForm.minOpportunityScore),
      maxRiskScore: maybeNumber(technicalForm.maxRiskScore),
      minConfidenceScore: maybeNumber(technicalForm.minConfidenceScore),
      minActionabilityScore: maybeNumber(technicalForm.minActionabilityScore),
      minAdvisorRelevanceScore: maybeNumber(technicalForm.minAdvisorRelevanceScore),

      minPrice: maybeNumber(technicalForm.minPrice),
      maxPrice: maybeNumber(technicalForm.maxPrice),
      minMarketCap: maybeNumber(technicalForm.minMarketCap),
      minDollarVolume: maybeNumber(technicalForm.minDollarVolume),

      minRsi14: maybeNumber(technicalForm.minRsi14),
      maxRsi14: maybeNumber(technicalForm.maxRsi14),
      requireRsiRecovery: technicalForm.requireRsiRecovery,
      requireRsiDivergence: technicalForm.requireRsiDivergence,
      requireConstructiveRsiStack: technicalForm.requireConstructiveRsiStack,

      minRangePositionPct: maybeNumber(technicalForm.minRangePositionPct),
      maxRangePositionPct: maybeNumber(technicalForm.maxRangePositionPct),
      minDrawdownFromHighPct: maybeNumber(technicalForm.minDrawdownFromHighPct),
      maxDrawdownFromHighPct: maybeNumber(technicalForm.maxDrawdownFromHighPct),

      minDistanceToSma200Pct: maybeNumber(technicalForm.minDistanceToSma200Pct),
      maxDistanceToSma200Pct: maybeNumber(technicalForm.maxDistanceToSma200Pct),
      requirePriceAboveSma20: technicalForm.requirePriceAboveSma20,
      requirePriceAboveSma50: technicalForm.requirePriceAboveSma50,
      requireMacdImproving: technicalForm.requireMacdImproving,

      minRelative3mVsBenchmarkPct: maybeNumber(technicalForm.minRelative3mVsBenchmarkPct),
      maxVolatility30Pct: maybeNumber(technicalForm.maxVolatility30Pct),
      maxAtr14Pct: maybeNumber(technicalForm.maxAtr14Pct),
      maxBeta: maybeNumber(technicalForm.maxBeta),

      maxForwardPE: maybeNumber(technicalForm.maxForwardPE),
      maxTrailingPE: maybeNumber(technicalForm.maxTrailingPE),
      maxPriceToBook: maybeNumber(technicalForm.maxPriceToBook),
      minDividendYield: maybeNumber(technicalForm.minDividendYield),
      onlyAdvisorRelevant: technicalForm.onlyAdvisorRelevant,
    };
  }

  async function postOpportunityAction(body: Record<string, unknown>) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/opportunities", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": String(body.action ?? "opportunity-radar"),
        },
        body: JSON.stringify(body),
      });

      const result = await response.json();

      if (!response.ok) {
        setMessage(result.error ?? "Opportunity action failed.");
        return null;
      }

      if (result.radar) {
        setData(result.radar);
      } else {
        await loadData();
      }

      return result;
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Opportunity action failed.");
      return null;
    } finally {
      setLoading(false);
    }
  }

  async function generateSignals() {
    const result = await postOpportunityAction({ action: "generate" });

    if (result) {
      setMessage(
        `News opportunity radar updated: ${result.result?.created ?? 0} created, ${result.result?.updated ?? 0} updated, ${result.result?.skipped ?? 0} skipped.`
      );
    }
  }

  async function runTechnicalScan(event?: FormEvent) {
    event?.preventDefault();

    const result = await postOpportunityAction({
      action: "technicalScan",
      indexUniverse: technicalForm.indexUniverse,
      customSymbols: technicalForm.customSymbols,
      limit: technicalForm.limit,
      minCompositeScore: technicalForm.minCompositeScore,
      maxDurationMs: technicalForm.maxDurationMs,
      advancedFilters: buildAdvancedFilters(),
    });

    if (result) {
      setActiveView("signals");
      setSignalFilter("technical");
      setMessage(
        `Technical scan complete: ${result.scanned} scanned, ${result.qualified} qualified, ${result.created} created, ${result.updated} updated, ${result.alerted} alerts.`
      );
    }
  }

  async function runFullScan() {
    const triage = await fetch(
      `/api/intelligence/triage/run?technicals=1&technicalUniverse=${technicalForm.indexUniverse}`,
      {
        method: "POST",
      }
    );

    const triageData = await triage.json().catch(() => ({}));

    if (!triage.ok) {
      setMessage(triageData.error ?? "Triage scan failed.");
      return;
    }

    const result = await postOpportunityAction({
      action: "runOpportunityStack",
      indexUniverse: technicalForm.indexUniverse,
      customSymbols: technicalForm.customSymbols,
      limit: technicalForm.limit,
      minCompositeScore: technicalForm.minCompositeScore,
      maxDurationMs: technicalForm.maxDurationMs,
      advancedFilters: buildAdvancedFilters(),
    });

    if (!result) return;

    setMessage(
      `Full stack scan complete: headlines refreshed and technical scan found ${result.technical?.qualified ?? 0} qualifying setups from ${result.technical?.scanned ?? 0} securities.`
    );
  }

  async function runAutopilotPulse() {
    const result = await postOpportunityAction({
      action: "autopilotPulse",
      scanMode: technicalForm.scanMode,
      indexUniverse: technicalForm.indexUniverse,
      customSymbols: technicalForm.customSymbols,
      limit: technicalForm.limit,
      minCompositeScore: technicalForm.minCompositeScore,
      maxDurationMs: technicalForm.maxDurationMs,
      advancedFilters: buildAdvancedFilters(),
    });

    if (!result) return;

    setMessage(
      `Autopilot pulse complete: triage ran in ${result.triage?.durationMs ?? "—"}ms and technicals found ${result.technical?.qualified ?? 0} qualifying setups.`
    );
  }

  async function updateStatus(signalId: string, status: string) {
    await postOpportunityAction({
      action: "updateStatus",
      signalId,
      status,
    });
  }

  useEffect(() => {
    void loadData();
    const interval = window.setInterval(() => {
      void loadData();
    }, 30_000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const latestRun = data?.autopilot?.latestRun ?? null;
  const latestTechnicalRun = data?.technical?.lastRun ?? null;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.16),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1900px] gap-5">
        <header className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-zinc-950/78 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(239,68,68,0.28),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(6,182,212,0.16),transparent_26%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <Logo />

              <div className="mt-5 flex flex-wrap gap-2">
                <Pill tone="red">Always-on radar</Pill>
                <Pill tone="cyan">Headline + technical scoring</Pill>
                <Pill tone="green">Advisor notifications</Pill>
                <Pill tone="purple">TradingView visual confirmation</Pill>
              </div>

              <h1 className="mt-5 max-w-6xl text-4xl font-black tracking-tight md:text-6xl">
                Opportunity Radar that keeps scanning even when the advisor is offline.
              </h1>

              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
                Slice combines source-backed headline intelligence with an index-level technical scanner.
                The server-side cron keeps running in production, while this page acts as the visual command center.
                TradingView is embedded for chart review; server-side scanning runs through authorized server-accessible data routes.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <a href="/workspace" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20">
                ← Workspace
              </a>
              <a href="/triage" className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white hover:bg-white/10">
                Triage
              </a>
              <a href="/notifications" className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-500/20">
                Notifications
              </a>
              <a href="/intelligence-settings" className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-black text-purple-100 hover:bg-purple-500/20">
                Intelligence Settings
              </a>
              <button
                onClick={runAutopilotPulse}
                disabled={loading}
                className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
              >
                {loading ? "Running..." : "Run Autopilot Pulse"}
              </button>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <StatCard label="Open" value={data?.stats.open ?? "—"} helper="Active signals" tone="amber" />
            <StatCard label="Technical" value={data?.technical?.open ?? "—"} helper="Open setups" tone="cyan" />
            <StatCard label="High Conviction" value={data?.technical?.highConviction ?? "—"} helper="Technical high/critical" tone="green" />
            <StatCard label="Avg Technical" value={data?.technical?.averageComposite ?? "—"} helper="Composite score" tone="purple" />
            <StatCard label="Headline Open" value={data?.headline?.open ?? "—"} helper="News opportunities" tone="red" />
            <StatCard label="Critical" value={data?.stats.critical ?? "—"} helper="Urgent items" tone="red" />
            <StatCard label="Latest Run" value={latestRun ? relativeTime(latestRun.createdAt) : "Never"} helper={latestRun?.mode ?? "No run"} tone={latestRun ? "green" : "slate"} />
            <StatCard label="Alerts" value={latestRun?.alertCount ?? "—"} helper="Latest scan alerts" tone={latestRun?.alertCount ? "red" : "slate"} />
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <Card className="p-3">
          <div className="grid gap-2 md:grid-cols-5">
            {[
              ["command", "Command", "Scanner control", "red"],
              ["signals", "Signals", "Open opportunities", "cyan"],
              ["technical", "Technical", "Index scanner", "green"],
              ["autopilot", "Autopilot", "Always-on status", "purple"],
              ["settings", "Settings", "Criteria tuning", "amber"],
            ].map(([key, label, helper, tone]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveView(key as ActiveView)}
                className={cx(
                  "rounded-2xl px-4 py-3 text-left transition",
                  activeView === key
                    ? "bg-white text-slate-950 shadow-lg shadow-black/20"
                    : "border border-white/10 bg-white/[0.045] text-white hover:bg-white/10"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-black">{label}</div>
                  <span
                    className={cx(
                      "h-2 w-2 rounded-full",
                      tone === "red"
                        ? "bg-red-400"
                        : tone === "cyan"
                          ? "bg-cyan-400"
                          : tone === "green"
                            ? "bg-emerald-400"
                            : tone === "purple"
                              ? "bg-purple-400"
                              : "bg-amber-400"
                    )}
                  />
                </div>
                <div className={cx("mt-1 text-[10px] font-bold", activeView === key ? "text-slate-500" : "text-slate-500")}>
                  {helper}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {activeView === "command" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1.1fr)_470px]">
            <Card className="p-6">
              <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <Pill tone="cyan">Opportunity operating room</Pill>
                  <h2 className="mt-4 text-3xl font-black text-white">
                    Full-stack headline + technical radar
                  </h2>
                  <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
                    Run a complete scan manually, or rely on the autopilot cron to keep scanning. The manual controls are for immediate review; the production engine should run in the background through `vercel.json`.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-3 lg:min-w-[520px]">
                  <button
                    onClick={generateSignals}
                    disabled={loading}
                    className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 disabled:opacity-50"
                  >
                    Refresh News
                  </button>
                  <button
                    onClick={() => void runTechnicalScan()}
                    disabled={loading}
                    className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 disabled:opacity-50"
                  >
                    Technical Scan
                  </button>
                  <button
                    onClick={runFullScan}
                    disabled={loading}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                  >
                    Full Stack
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-3">
                <Panel tone="green" className="bg-black/35">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                    Autopilot
                  </div>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    Server-side scans
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {data?.autopilot?.continuousScanningNote ??
                      "Continuous scanning runs server-side through the cron route, not from the browser."}
                  </p>
                  <div className="mt-4">
                    <ProgressBar value={data?.autopilot?.enabled ? 100 : 20} tone={data?.autopilot?.enabled ? "green" : "amber"} />
                  </div>
                </Panel>

                <Panel tone="cyan" className="bg-black/35">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                    Technical engine
                  </div>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    {data?.technical?.averageComposite ?? 0}/100
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Average technical composite across stored technical opportunities.
                  </p>
                  <div className="mt-4">
                    <ProgressBar value={data?.technical?.averageComposite ?? 0} tone="cyan" />
                  </div>
                </Panel>

                <Panel tone="red" className="bg-black/35">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
                    Advisor alerts
                  </div>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    {latestRun?.alertCount ?? 0}
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Alerts generated in the most recent run. Review them in Notification Center.
                  </p>
                  <div className="mt-4">
                    <ProgressBar value={Math.min(100, (latestRun?.alertCount ?? 0) * 16)} tone="red" />
                  </div>
                </Panel>
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-2">
                <Panel tone="purple" className="bg-black/35">
                  <div className="text-lg font-black text-white">Recent scan runs</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    This verifies that the radar is being run by the backend.
                  </p>
                  <div className="mt-4">
                    <RunBars runs={data?.autopilot?.recentRuns ?? []} />
                  </div>
                </Panel>

                <Panel tone="cyan" className="bg-black/35">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                    <div>
                      <div className="text-lg font-black text-white">TradingView visual review</div>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        Embedded for chart confirmation. Background scanning is server-side.
                      </p>
                    </div>

                    <select
                      value={selectedSymbol}
                      onChange={(event) => setSelectedSymbol(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm font-black text-white outline-none"
                    >
                      {Array.from(new Set(["AAPL", "MSFT", "NVDA", "SPY", "QQQ", ...technicalSymbols])).map((symbol) => (
                        <option key={symbol} value={symbol}>
                          {symbol}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div className="mt-4">
                    <TradingViewChart symbol={selectedSymbol} />
                  </div>
                </Panel>
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                Scanner settings
              </div>
              <h2 className="mt-2 text-2xl font-black">Technical operator</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Choose the universe and strictness. Cron jobs rotate through symbols over time, which is how the radar can keep covering large indexes.
              </p>

              <form onSubmit={runTechnicalScan} className="mt-5 grid gap-3">
                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Universe
                  </span>
                  <select
                    value={technicalForm.indexUniverse}
                    onChange={(event) =>
                      setTechnicalForm((current) => ({
                        ...current,
                        indexUniverse: event.target.value as TechnicalUniverseId,
                      }))
                    }
                    className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-black text-white outline-none"
                  >
                    {(data?.technical?.universes ?? [
                      { id: "sp100", label: "S&P 100", description: "" },
                      { id: "nasdaq100", label: "Nasdaq 100", description: "" },
                      { id: "dow30", label: "Dow 30", description: "" },
                      { id: "advisor-watchlist", label: "Advisor Watchlist", description: "" },
                      { id: "custom", label: "Custom Symbols", description: "" },
                    ]).map((universe) => (
                      <option key={universe.id} value={universe.id}>
                        {universe.label}
                      </option>
                    ))}
                  </select>
                </label>

                {technicalForm.indexUniverse === "custom" ? (
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Custom Symbols
                    </span>
                    <textarea
                      value={technicalForm.customSymbols}
                      onChange={(event) =>
                        setTechnicalForm((current) => ({
                          ...current,
                          customSymbols: event.target.value,
                        }))
                      }
                      placeholder="AAPL, MSFT, NVDA, JPM"
                      className="min-h-24 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
                    />
                  </label>
                ) : null}

                <div className="grid gap-3 md:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Run Limit
                    </span>
                    <input
                      type="number"
                      min={1}
                      max={125}
                      value={technicalForm.limit}
                      onChange={(event) =>
                        setTechnicalForm((current) => ({
                          ...current,
                          limit: Number(event.target.value),
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-black text-white outline-none"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Min Score
                    </span>
                    <input
                      type="number"
                      min={50}
                      max={95}
                      value={technicalForm.minCompositeScore}
                      onChange={(event) =>
                        setTechnicalForm((current) => ({
                          ...current,
                          minCompositeScore: Number(event.target.value),
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-black text-white outline-none"
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                      Scan Mode
                    </span>
                    <select
                      value={technicalForm.scanMode}
                      onChange={(event) =>
                        setTechnicalForm((current) => ({
                          ...current,
                          scanMode: event.target.value as "fast" | "broad" | "deep",
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-black text-white outline-none"
                    >
                      <option value="fast">Fast</option>
                      <option value="broad">Broad</option>
                      <option value="deep">Deep</option>
                    </select>
                  </label>
                </div>

                <button
                  disabled={loading}
                  className="rounded-2xl bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-100 ring-1 ring-cyan-500/30 disabled:opacity-50"
                >
                  {loading ? "Scanning..." : "Run Technical Opportunity Scan"}
                </button>
              </form>
            </Card>
          </section>
        ) : null}

        {activeView === "signals" ? (
          <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                Signal Views
              </div>
              <h2 className="mt-2 text-2xl font-black">Filter radar</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Separate headline opportunities from technical setups while keeping both in one advisor workflow.
              </p>

              <input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search symbol, source, title..."
                className="mt-5 w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600"
              />

              <div className="mt-5 grid gap-2">
                {[
                  ["all", "All Open Signals", data?.stats.open ?? 0, "slate"],
                  ["technical", "Technical Setups", technicalSignals.filter((signal) => signal.status === "Open").length, "cyan"],
                  ["headline", "Headline Signals", headlineSignals.filter((signal) => signal.status === "Open").length, "red"],
                  ["critical", "Critical", signals.filter((signal) => signal.status === "Open" && signal.priorityTier === "Critical").length, "red"],
                  ["high", "High", signals.filter((signal) => signal.status === "Open" && signal.priorityTier === "High").length, "amber"],
                ].map(([key, label, count, tone]) => (
                  <button
                    key={String(key)}
                    onClick={() => setSignalFilter(key as SignalFilter)}
                    className={cx(
                      "rounded-2xl border px-4 py-3 text-left transition",
                      signalFilter === key
                        ? "border-white/25 bg-white text-slate-950"
                        : "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.08]"
                    )}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black">{label}</div>
                        <div className={cx("mt-1 text-xs", signalFilter === key ? "text-slate-600" : "text-slate-500")}>
                          {String(count)} open
                        </div>
                      </div>
                      <Pill tone={tone as Tone}>{String(count)}</Pill>
                    </div>
                  </button>
                ))}
              </div>

              <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs leading-6 text-amber-100/80">
                Technical opportunities are screening outputs for advisor review. They are not automatic buy recommendations.
              </div>
            </Card>

            <Card className="p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <h2 className="text-2xl font-black">Open Opportunity Signals</h2>
                  <p className="mt-1 text-sm text-slate-500">{openSignals.length} matching signal(s)</p>
                </div>
              </div>

              <div className="mt-5 space-y-5">
                {openSignals.length === 0 ? (
                  <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-sm text-slate-400">
                    No open signals match this filter.
                  </div>
                ) : (
                  openSignals.map((signal) => {
                    const tickers = parseJsonList(signal.tickersJson);
                    const categories = parseJsonList(signal.categoriesJson);
                    const rawEvidence = parseJsonList(signal.evidenceJson);
                    const technicalPayload = extractTechnicalPayload(rawEvidence);
                    const evidence = evidenceStrings(rawEvidence);
                    const isTechnical = signal.signalType === "Technical Opportunity";

                    return (
                      <article
                        key={signal.id}
                        className="rounded-3xl border border-white/10 bg-white/5 p-5"
                      >
                        <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                          <div>
                            <div className="flex flex-wrap gap-2">
                              <Pill tone={signalTone(signal.signalType)}>{signal.signalType}</Pill>
                              <Pill tone={tierTone(signal.priorityTier)}>{signal.priorityTier}</Pill>
                              <Pill tone="slate">{signal.sourceName}</Pill>
                            </div>

                            <h3 className="mt-4 text-2xl font-black">{signal.title}</h3>

                            <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
                              {signal.summary || "No summary stored."}
                            </p>

                            <div className="mt-3 flex flex-wrap gap-2">
                              {tickers.map((ticker, tickerIndex) => (
                                <button
                                  key={`${signal.id}-ticker-${tickerIndex}-${String(ticker)}`}
                                  type="button"
                                  onClick={() => setSelectedSymbol(String(ticker))}
                                >
                                  <Pill tone={isTechnical ? "cyan" : "red"}>{String(ticker)}</Pill>
                                </button>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center">
                            <div className="text-xs font-black uppercase text-red-300">Composite</div>
                            <div className="text-4xl font-black">{signal.compositeScore}</div>
                          </div>
                        </div>

                        {technicalPayload ? (
                          <div className="mt-5 grid gap-5">
                            <MiniTechnicalChart payload={technicalPayload} />
                            <TechnicalDetailGrid payload={technicalPayload} />
                          </div>
                        ) : null}

                        <div className="mt-5 grid gap-3 md:grid-cols-5">
                          {[
                            ["Portfolio", signal.portfolioRelevanceScore],
                            ["Opportunity", signal.opportunityScore],
                            ["Risk", signal.riskScore],
                            ["Confidence", signal.confidenceScore],
                            ["Actionable", signal.actionabilityScore],
                          ].map(([label, value]) => (
                            <ScoreGauge key={`${signal.id}-${String(label)}`} label={String(label)} value={Number(value)} />
                          ))}
                        </div>

                        <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-xs font-black uppercase text-slate-500">Suggested advisor action</div>
                          <p className="mt-2 text-sm leading-7 text-slate-300">{signal.suggestedAction}</p>
                        </div>

                        {signal.advisorNotes ? (
                          <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                            <div className="text-xs font-black uppercase text-cyan-300">Advisor notes</div>
                            <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-cyan-50/80">
                              {signal.advisorNotes}
                            </p>
                          </div>
                        ) : null}

                        <div className="mt-5 grid gap-4 md:grid-cols-2">
                          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                            <div className="text-xs font-black uppercase text-slate-500">Categories</div>
                            <div className="mt-2 flex flex-wrap gap-2">
                              {categories.slice(0, 10).map((category, categoryIndex) => (
                                <Pill key={`${signal.id}-category-${categoryIndex}-${String(category)}`} tone="purple">
                                  {String(category)}
                                </Pill>
                              ))}
                            </div>
                          </div>

                          <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                            <div className="text-xs font-black uppercase text-slate-500">Evidence</div>
                            <ul className="mt-2 space-y-1">
                              {evidence.slice(0, 10).map((item, evidenceIndex) => (
                                <li key={`${signal.id}-evidence-${evidenceIndex}-${item}`} className="text-sm text-slate-400">
                                  • {item}
                                </li>
                              ))}
                            </ul>
                          </div>
                        </div>

                        <div className="mt-5 flex flex-wrap gap-2">
                          <button
                            onClick={() => updateStatus(signal.id, "Reviewed")}
                            disabled={loading}
                            className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50"
                          >
                            Mark Reviewed
                          </button>
                          <button
                            onClick={() => updateStatus(signal.id, "Archived")}
                            disabled={loading}
                            className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-2 text-xs font-black text-white disabled:opacity-50"
                          >
                            Archive
                          </button>
                        </div>
                      </article>
                    );
                  })
                )}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "technical" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                Technical Opportunity Engine
              </div>
              <h2 className="mt-2 text-3xl font-black">Index-level technical analysis</h2>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-400">
                The scanner evaluates RSI stack, RSI recovery, RSI divergence, trend stabilization,
                SMA behavior, MACD improvement, Bollinger position, volume, liquidity, volatility,
                valuation sanity, relative strength, and advisor relevance.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-4">
                <StatCard label="Technical Total" value={data?.technical?.total ?? "—"} tone="cyan" />
                <StatCard label="Technical Open" value={data?.technical?.open ?? "—"} tone="green" />
                <StatCard label="Critical" value={data?.technical?.critical ?? "—"} tone="red" />
                <StatCard label="Avg Confidence" value={data?.technical?.averageConfidence ?? "—"} tone="purple" />
              </div>

              {selectedTechnicalPayload ? (
                <div className="mt-5 grid gap-5">
                  <MiniTechnicalChart payload={selectedTechnicalPayload} />
                  <TechnicalDetailGrid payload={selectedTechnicalPayload} />
                </div>
              ) : (
                <div className="mt-5 rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-400">
                  No technical payload available yet. Run a technical scan.
                </div>
              )}
            </Card>

            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-300">
                Live visual context
              </div>
              <h2 className="mt-2 text-2xl font-black">TradingView review</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Visual chart confirmation for selected technical setups.
              </p>

              <select
                value={selectedSymbol}
                onChange={(event) => setSelectedSymbol(event.target.value)}
                className="mt-5 w-full rounded-2xl border border-white/10 bg-black/50 px-4 py-3 text-sm font-black text-white outline-none"
              >
                {Array.from(new Set(["AAPL", "MSFT", "NVDA", "SPY", "QQQ", ...technicalSymbols])).map((symbol) => (
                  <option key={symbol} value={symbol}>
                    {symbol}
                  </option>
                ))}
              </select>

              <div className="mt-5">
                <TradingViewChart symbol={selectedSymbol} />
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "autopilot" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_430px]">
            <Card className="p-6">
              <Pill tone="green">Autopilot status</Pill>
              <h2 className="mt-4 text-3xl font-black text-white">
                Continuous scanning is controlled server-side.
              </h2>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
                {data?.autopilot?.scheduleSummary ??
                  "Configure Vercel Cron or an external scheduler to hit /api/cron/triage on a recurring schedule."}
              </p>

              <div className="mt-6 grid gap-3 md:grid-cols-4">
                <StatCard label="Route" value={data?.autopilot?.route ?? "/api/cron/triage"} helper="Cron endpoint" tone="cyan" />
                <StatCard label="Latest Run" value={latestRun ? relativeTime(latestRun.createdAt) : "Never"} helper={latestRun?.mode ?? "No run"} tone="green" />
                <StatCard label="Latest Technical" value={latestTechnicalRun ? relativeTime(latestTechnicalRun.createdAt) : "Never"} helper={latestTechnicalRun?.mode ?? "No technical run"} tone="purple" />
                <StatCard label="Latest Alerts" value={latestRun?.alertCount ?? "—"} helper="Most recent run" tone={latestRun?.alertCount ? "red" : "slate"} />
              </div>

              <div className="mt-6">
                <RunBars runs={data?.autopilot?.recentRuns ?? []} />
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                Production notes
              </div>
              <h3 className="mt-2 text-2xl font-black">How “never stop” works</h3>

              <div className="mt-5 grid gap-3">
                <Panel tone="green" className="bg-black/35">
                  <div className="font-black text-white">1. Cron calls the backend</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    The backend scans sources and technical universes without anyone viewing the page.
                  </p>
                </Panel>
                <Panel tone="cyan" className="bg-black/35">
                  <div className="font-black text-white">2. Technical scan rotates through indexes</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Large universes are covered over repeated runs to avoid provider timeouts.
                  </p>
                </Panel>
                <Panel tone="red" className="bg-black/35">
                  <div className="font-black text-white">3. Notifications are created automatically</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Qualified headline or technical opportunities generate dashboard/email notification records.
                  </p>
                </Panel>
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "settings" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-300">
                Advanced Technical Criteria
              </div>
              <h2 className="mt-2 text-3xl font-black text-white">
                Tune the opportunity algorithm
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-400">
                These settings are sent into the technical scan. Leave fields blank to avoid enforcing that filter.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                {[
                  ["minOpportunityScore", "Min Opportunity"],
                  ["maxRiskScore", "Max Risk"],
                  ["minConfidenceScore", "Min Confidence"],
                  ["minActionabilityScore", "Min Actionability"],
                  ["minAdvisorRelevanceScore", "Min Advisor Relevance"],
                  ["minPrice", "Min Price"],
                  ["maxPrice", "Max Price"],
                  ["minMarketCap", "Min Market Cap"],
                  ["minDollarVolume", "Min Dollar Volume"],
                  ["minRsi14", "Min RSI 14"],
                  ["maxRsi14", "Max RSI 14"],
                  ["minRelative3mVsBenchmarkPct", "Min 3M Relative"],
                  ["maxVolatility30Pct", "Max Volatility 30D"],
                  ["maxAtr14Pct", "Max ATR 14%"],
                  ["maxBeta", "Max Beta"],
                  ["maxForwardPE", "Max Forward P/E"],
                  ["maxTrailingPE", "Max Trailing P/E"],
                  ["maxPriceToBook", "Max Price/Book"],
                ].map(([key, label]) => (
                  <label key={key} className="grid gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                      {label}
                    </span>
                    <input
                      type="number"
                      value={(technicalForm as any)[key]}
                      onChange={(event) =>
                        setTechnicalForm((current) => ({
                          ...current,
                          [key]: event.target.value === "" ? "" : Number(event.target.value),
                        }))
                      }
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-black text-white outline-none"
                    />
                  </label>
                ))}
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["requireRsiRecovery", "Require RSI recovery"],
                  ["requireRsiDivergence", "Require RSI divergence"],
                  ["requireConstructiveRsiStack", "Require RSI stack"],
                  ["requirePriceAboveSma20", "Require price above SMA20"],
                  ["requirePriceAboveSma50", "Require price above SMA50"],
                  ["requireMacdImproving", "Require MACD improving"],
                  ["onlyAdvisorRelevant", "Only advisor-relevant"],
                ].map(([key, label]) => (
                  <label
                    key={key}
                    className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-slate-300"
                  >
                    {label}
                    <input
                      type="checkbox"
                      checked={Boolean((technicalForm as any)[key])}
                      onChange={(event) =>
                        setTechnicalForm((current) => ({
                          ...current,
                          [key]: event.target.checked,
                        }))
                      }
                    />
                  </label>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                Recommended default
              </div>
              <h3 className="mt-2 text-2xl font-black">Advisor-safe scanner</h3>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                For daily advisor operations, keep risk limits strict and use technical scans as opportunity flags, not automatic recommendations.
              </p>

              <div className="mt-5 grid gap-3">
                <Panel tone="cyan" className="bg-black/35">
                  <div className="font-black text-white">Default min composite</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">70 to 74 is a strong daily range.</p>
                </Panel>
                <Panel tone="red" className="bg-black/35">
                  <div className="font-black text-white">Risk ceiling</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">Keep max risk near 78 unless intentionally hunting volatility.</p>
                </Panel>
                <Panel tone="green" className="bg-black/35">
                  <div className="font-black text-white">Liquidity</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">Dollar volume filters prevent thinly traded ideas from cluttering advisor alerts.</p>
                </Panel>
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}