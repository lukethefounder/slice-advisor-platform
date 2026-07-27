"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type View = "overview" | "crypto" | "penny-stocks" | "venture" | "briefings" | "risk";
type BriefingMode = "advisor" | "client";
type BriefingSubView = "studio" | "schedules" | "advisor-notes" | "client-drafts" | "quality";

type User = { id: string; name: string; email: string };

type Firm = {
  id: string;
  name: string;
  firmEmail: string | null;
  firmCode: string;
};

type Membership = {
  id: string;
  firmId: string;
  userId: string;
  role: string;
  status: string;
  canManageProjects: boolean;
  canManageFirm: boolean;
};

type EnrichedCryptoCoin = {
  id: string;
  symbol: string;
  name: string;
  image?: string;
  current_price: number | null;
  market_cap: number | null;
  market_cap_rank: number | null;
  fully_diluted_valuation?: number | null;
  total_volume: number | null;
  high_24h?: number | null;
  low_24h?: number | null;
  price_change_percentage_24h: number | null;
  price_change_percentage_1h_in_currency?: number | null;
  price_change_percentage_7d_in_currency?: number | null;
  price_change_percentage_30d_in_currency?: number | null;
  sparkline_in_7d?: { price: number[] };
  last_updated?: string | null;
  trendLabel: string;
  riskScore: number;
  riskLevel: string;
  opportunityScore: number;
  liquidityScore: number;
  valuationScore: number;
  momentumScore: number;
  riskAdjustedScore: number;
  volumeToMarketCapPct: number | null;
  fdvToMarketCap: number | null;
  advisorAction: string;
  advisorNotes: string[];
};

type FearGreed = {
  source: string;
  value: number | null;
  classification: string;
  updatedAt: string | null;
  history: Array<{ value: string; value_classification: string; timestamp: string }>;
};

type AlternativeVenture = {
  id: string;
  startupName: string;
  founderName: string | null;
  sector: string;
  stage: string;
  website: string | null;
  background: string;
  problemToSolve: string;
  solution: string | null;
  equityOfferedPct: number;
  tentativeValuation: number;
  amountSought: number | null;
  traction: string | null;
  thesis: string | null;
  keyRisks: string | null;
  monitoringStatus: string;
  riskLevel: string;
  notes: string | null;
  imageUrl: string | null;
  deckUrl: string | null;
  presentationSummary: string | null;
  customerProfile: string | null;
  revenueModel: string | null;
  moat: string | null;
  nextDiligence: string | null;
  impliedPostMoney: number | null;
  valuationGapPct: number | null;
  tractionScore: number;
  valuationDisciplineScore: number;
  founderMarketScore: number;
  ventureRiskScore: number;
  diligenceScore: number;
  presentationScore: number;
  ventureRecommendation: string;
  createdAt: string;
  updatedAt: string;
  createdBy?: User;
};

type PennyQuote = {
  ticker: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  provider: string;
  note: string;
};

type AlternativePennyStock = {
  id: string;
  ticker: string;
  companyName: string;
  sector: string;
  thesis: string | null;
  catalyst: string | null;
  riskNotes: string | null;
  targetEntry: string | null;
  maxPositionPct: number | null;
  status: string;
  riskLevel: string;
  notes: string | null;
  quote: PennyQuote | null;
  catalystScore: number;
  promotionRiskScore: number;
  liquidityProxyScore: number;
  disciplineScore: number;
  trendScore: number;
  riskReductionScore: number;
  speculativeScore: number;
  riskAdjustedLabel: string;
  advisorGuardrails: string[];
  createdAt: string;
  updatedAt: string;
  createdBy?: User;
};

type BriefingSchedule = {
  id: string;
  title: string;
  trigger: string;
  description: string;
  status: string;
  lastRunAt: string | null;
  createdAt: string;
  updatedAt: string;
  coverage: {
    audienceType: "Advisor" | "Client/Investor";
    intervalHours: number;
    localFocus: string;
    scope: "Local" | "U.S." | "Global" | "Local → Global";
    includeMarket: boolean;
    includeEconomy: boolean;
    includeCrypto: boolean;
    includeAlternatives: boolean;
    includeCommodities: boolean;
    includeEnergy: boolean;
    includeMinerals: boolean;
    includeGeopolitics: boolean;
    includeTariffs: boolean;
    includeLabor: boolean;
    includeVenture: boolean;
    commodities: string[];
    globalTopics: string[];
    tone: string;
    deliveryChannel: "Email" | "Dashboard" | "Both";
    recipientLabel: string;
    advisorInstructions: string;
  };
  channels: string[];
  guardrails: string[];
};

type AdvisorBriefing = {
  id: string;
  title: string;
  category: string;
  summary: string;
  confidenceScore: number;
  sourceItemsJson: string;
  actionsJson: string;
  status: string;
  createdAt: string;
};

type ClientBriefing = {
  id: string;
  title: string;
  body: string;
  audience: string;
  channel: string;
  clientName: string | null;
  sourceSummaryJson: string;
  complianceNotesJson: string;
  status: string;
  tone: string;
  createdAt: string;
};

type AlternativeData = {
  firms: Array<Firm & { membership: Membership }>;
  firm: Firm | null;
  membership: Membership | null;
  crypto: {
    markets: EnrichedCryptoCoin[];
    leaders: EnrichedCryptoCoin[];
    highestRisk: EnrichedCryptoCoin[];
    valuationLeaders: EnrichedCryptoCoin[];
    fearGreed: FearGreed;
    sentiment: { regime: string; riskComment: string; riskScoreAdjustment: number };
    fetchedAt: string;
    aggregateMarketCap: number;
    aggregateVolume: number;
    breadth: number;
    sources: string[];
  };
  pennyStocks: AlternativePennyStock[];
  ventures: AlternativeVenture[];
  briefings: {
    schedules: BriefingSchedule[];
    advisorBriefings: AdvisorBriefing[];
    clientBriefings: ClientBriefing[];
  };
  stats: {
    ventureStats: {
      count: number;
      watching: number;
      diligence: number;
      passed: number;
      averageValuation: number;
      averageEquityOffered: number;
      averageDiligenceScore: number;
      averagePresentationScore: number;
    };
    pennyStats: {
      count: number;
      watching: number;
      activeReview: number;
      passed: number;
      averageRiskReductionScore: number;
      averageSpeculativeScore: number;
    };
    briefingStats: {
      schedules: number;
      activeSchedules: number;
      advisorBriefings: number;
      clientBriefings: number;
    };
  };
  riskFramework: Array<{
    label: string;
    riskLevel: string;
    primaryRisks: string;
    mitigation: string;
  }>;
  generatedBriefing?: {
    text: string;
    stored: { storedAs: string; id: string };
    eventCount: number;
    commodityCount: number;
    aiStatus: string;
    aiProvider: string;
    aiModel: string | null;
    aiError: string | null;
    since: string;
    until: string;
  };
};

type Tone = "red" | "green" | "amber" | "slate" | "purple" | "cyan";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function safeJson<T>(value: string, fallback: T): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function money(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  if (Math.abs(value) >= 1_000_000_000_000) return `$${(value / 1_000_000_000_000).toFixed(2)}T`;
  if (Math.abs(value) >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value > 10 ? 2 : 6,
  }).format(value);
}

function numberFormat(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(value);
}

function pct(value: number | null | undefined) {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${value >= 0 ? "+" : ""}${value.toFixed(2)}%`;
}

function shortDate(value: string | null | undefined) {
  if (!value) return "—";
  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function longDate(value: string | null | undefined) {
  if (!value) return "Never";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

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

function nextRunLabel(schedule: BriefingSchedule) {
  if (schedule.status !== "Active") return "Paused";
  const base = schedule.lastRunAt ? new Date(schedule.lastRunAt).getTime() : new Date(schedule.createdAt).getTime();
  const next = new Date(base + schedule.coverage.intervalHours * 60 * 60 * 1000);

  if (Number.isNaN(next.getTime())) return "Unknown";
  if (next.getTime() <= Date.now()) return "Due now";

  return longDate(next.toISOString());
}

function positiveScoreTone(score: number): Tone {
  if (score >= 82) return "green";
  if (score >= 68) return "cyan";
  if (score >= 52) return "amber";
  return "red";
}

function toneForStatus(status: string): Tone {
  const lower = status.toLowerCase();
  if (lower.includes("pass") || lower.includes("blocked") || lower.includes("extreme")) return "red";
  if (lower.includes("active") || lower.includes("diligence")) return "green";
  if (lower.includes("watch") || lower.includes("review") || lower.includes("draft")) return "amber";
  if (lower.includes("venture") || lower.includes("crypto") || lower.includes("advisor")) return "purple";
  if (lower.includes("client")) return "cyan";
  return "slate";
}

function scopeTone(scope: string): Tone {
  if (scope === "Global") return "red";
  if (scope === "Local → Global") return "purple";
  if (scope === "U.S.") return "cyan";
  return "green";
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/78 shadow-xl shadow-emerald-950/20 backdrop-blur-xl", className)}>
      {children}
    </div>
  );
}

function Panel({ children, className = "", tone = "slate" }: { children: ReactNode; className?: string; tone?: Tone }) {
  const glows: Record<Tone, string> = {
    red: "from-emerald-500/16",
    green: "from-emerald-500/16",
    amber: "from-amber-500/16",
    purple: "from-purple-500/16",
    cyan: "from-cyan-500/16",
    slate: "from-slate-400/8",
  };

  return (
    <div className={cx("relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.052] p-4 shadow-lg shadow-black/10", className)}>
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">{children}</div>
    </div>
  );
}

function Pill({ children, tone = "red" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    red: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
  };

  return (
    <span className={cx("inline-flex max-w-full items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1", tones[tone])}>
      <span className="truncate">{children}</span>
    </span>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-950 via-zinc-950 to-emerald-700 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-900 text-lg font-black text-white shadow-inner">S</div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-emerald-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-emerald-700" />
      </div>

      <div className="min-w-0">
        <div className="truncate text-2xl font-black tracking-tight text-white">Slice</div>
        <div className="truncate text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400">
          Alternative Investments
        </div>
      </div>
    </div>
  );
}

function MetricBubble({ label, value, helper, tone = "slate" }: { label: string; value: string | number; helper?: string; tone?: Tone }) {
  const glows: Record<Tone, string> = {
    red: "from-emerald-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    slate: "from-slate-400/10",
    purple: "from-purple-500/18",
    cyan: "from-cyan-500/18",
  };

  return (
    <div className="relative min-h-[112px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function ScoreBar({ value, tone = "red" }: { value: number; tone?: Tone }) {
  const fills: Record<Tone, string> = {
    red: "from-emerald-700 to-emerald-400",
    green: "from-emerald-700 to-emerald-300",
    amber: "from-amber-700 to-amber-300",
    purple: "from-purple-700 to-purple-300",
    slate: "from-slate-700 to-slate-300",
    cyan: "from-cyan-700 to-cyan-300",
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/50">
      <div className={cx("h-full rounded-full bg-gradient-to-r", fills[tone])} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function Sparkline({ values }: { values: number[] }) {
  if (!values.length) {
    return <div className="flex h-16 items-center justify-center rounded-2xl bg-black/30 text-xs font-bold text-slate-600">No sparkline</div>;
  }

  const width = 220;
  const height = 64;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;

  const points = values
    .map((value, index) => {
      const x = (index / Math.max(values.length - 1, 1)) * width;
      const y = height - ((value - min) / range) * height;
      return `${x},${y}`;
    })
    .join(" ");

  const isUp = values[values.length - 1] >= values[0];

  return (
    <svg viewBox={`0 0 ${width} ${height}`} className="h-16 w-full rounded-2xl bg-black/30" role="img" aria-label="7 day price sparkline">
      <polyline fill="none" stroke={isUp ? "rgb(110 231 183)" : "rgb(252 165 165)"} strokeWidth="3" points={points} />
    </svg>
  );
}

const inputClass = "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 transition placeholder:text-slate-600 focus:ring-2";
const selectClass = "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 transition focus:ring-2";

const viewTabs: Array<{ id: View; label: string; description: string; tone: Tone }> = [
  { id: "overview", label: "Overview", description: "Alternative dashboard", tone: "red" },
  { id: "crypto", label: "Crypto Markets", description: "Risk-adjusted crypto", tone: "cyan" },
  { id: "penny-stocks", label: "Penny Stocks", description: "Speculative equities", tone: "amber" },
  { id: "venture", label: "Venture Monitor", description: "Startup opportunities", tone: "purple" },
  { id: "briefings", label: "Research Notes", description: "Briefing center", tone: "green" },
  { id: "risk", label: "Risk Framework", description: "Suitability guardrails", tone: "slate" },
];

const briefingSubViews: Array<{ id: BriefingSubView; label: string; helper: string; tone: Tone }> = [
  { id: "studio", label: "Studio", helper: "Build + generate", tone: "green" },
  { id: "schedules", label: "Schedules", helper: "Interval control", tone: "purple" },
  { id: "advisor-notes", label: "Advisor Notes", helper: "Internal briefings", tone: "cyan" },
  { id: "client-drafts", label: "Client Drafts", helper: "Approval-ready", tone: "amber" },
  { id: "quality", label: "Quality", helper: "Controls + compliance", tone: "red" },
];

function CryptoCard({ coin }: { coin: EnrichedCryptoCoin }) {
  return (
    <Panel tone={positiveScoreTone(coin.riskAdjustedScore)} className="bg-black/35">
      <div className="flex items-start gap-4">
        {coin.image ? (
          <img src={coin.image} alt={coin.name} className="h-12 w-12 rounded-2xl" />
        ) : (
          <div className="grid h-12 w-12 place-items-center rounded-2xl bg-emerald-500/10 text-sm font-black text-emerald-200">
            {coin.symbol.toUpperCase()}
          </div>
        )}

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div>
              <div className="text-lg font-black text-white">{coin.name}</div>
              <div className="mt-1 text-xs font-bold uppercase text-slate-500">
                {coin.symbol.toUpperCase()} · Rank {coin.market_cap_rank ?? "—"}
              </div>
            </div>
            <Pill tone={positiveScoreTone(coin.riskAdjustedScore)}>Risk-adjusted {coin.riskAdjustedScore}</Pill>
          </div>

          <div className="mt-3 grid gap-3 md:grid-cols-4">
            <MetricBubble label="Price" value={money(coin.current_price)} tone="cyan" />
            <MetricBubble label="24h" value={pct(coin.price_change_percentage_24h)} tone={coin.price_change_percentage_24h && coin.price_change_percentage_24h >= 0 ? "green" : "red"} />
            <MetricBubble label="7d" value={pct(coin.price_change_percentage_7d_in_currency)} tone={coin.price_change_percentage_7d_in_currency && coin.price_change_percentage_7d_in_currency >= 0 ? "green" : "red"} />
            <MetricBubble label="30d" value={pct(coin.price_change_percentage_30d_in_currency)} tone={coin.price_change_percentage_30d_in_currency && coin.price_change_percentage_30d_in_currency >= 0 ? "green" : "red"} />
          </div>

          <div className="mt-4">
            <Sparkline values={coin.sparkline_in_7d?.price ?? []} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {[
              ["Momentum", coin.momentumScore, "cyan"],
              ["Liquidity", coin.liquidityScore, "green"],
              ["Valuation", coin.valuationScore, "purple"],
              ["Opportunity", coin.opportunityScore, "amber"],
              ["Risk", coin.riskScore, "red"],
            ].map(([label, value, tone]) => (
              <div key={`${coin.id}-${label}`} className="rounded-2xl border border-white/10 bg-black/35 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
                  <span className="text-sm font-black text-white">{value}</span>
                </div>
                <div className="mt-2">
                  <ScoreBar value={Number(value)} tone={tone as Tone} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Advisor action</div>
            <p className="mt-2 text-sm leading-6 text-slate-300">{coin.advisorAction}</p>
          </div>
        </div>
      </div>
    </Panel>
  );
}

function PennyStockCard({
  stock,
  onStatus,
  disabled,
}: {
  stock: AlternativePennyStock;
  onStatus: (id: string, status: string) => void;
  disabled: boolean;
}) {
  return (
    <Panel tone={positiveScoreTone(stock.riskReductionScore)} className="bg-black/35">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="amber">{stock.ticker}</Pill>
            <Pill tone={toneForStatus(stock.status)}>{stock.status}</Pill>
            <Pill tone={toneForStatus(stock.riskLevel)}>{stock.riskLevel}</Pill>
          </div>
          <h3 className="mt-3 text-2xl font-black text-white">{stock.companyName}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{stock.thesis || "No thesis recorded yet."}</p>
        </div>

        <div className="grid min-w-[260px] gap-3">
          <MetricBubble label="Risk Reduction" value={stock.riskReductionScore} helper={stock.riskAdjustedLabel} tone={positiveScoreTone(stock.riskReductionScore)} />
          <MetricBubble label="Speculative Score" value={stock.speculativeScore} helper="Risk-adjusted trend" tone={positiveScoreTone(stock.speculativeScore)} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {[
          ["Trend", stock.trendScore, "cyan"],
          ["Catalyst", stock.catalystScore, "green"],
          ["Liquidity", stock.liquidityProxyScore, "purple"],
          ["Discipline", stock.disciplineScore, "amber"],
          ["Promo Risk", stock.promotionRiskScore, "red"],
        ].map(([label, value, tone]) => (
          <div key={`${stock.id}-${label}`} className="rounded-2xl border border-white/10 bg-black/35 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
              <span className="text-sm font-black text-white">{value}</span>
            </div>
            <div className="mt-2">
              <ScoreBar value={Number(value)} tone={tone as Tone} />
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricBubble label="Live Price" value={money(stock.quote?.price)} helper={stock.quote?.provider ?? "No provider"} tone="cyan" />
        <MetricBubble label="Live Change" value={pct(stock.quote?.changePct)} helper={stock.quote?.note ?? "No quote note"} tone={stock.quote?.changePct && stock.quote.changePct >= 0 ? "green" : "red"} />
        <MetricBubble label="Volume" value={numberFormat(stock.quote?.volume)} helper="Liquidity proxy" tone="purple" />
        <MetricBubble label="Max Position" value={stock.maxPositionPct ? `${stock.maxPositionPct}%` : "Missing"} helper="Risk control" tone={stock.maxPositionPct ? "green" : "red"} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <Panel className="bg-black/35" tone="green">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Catalyst</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{stock.catalyst || "No catalyst recorded."}</p>
        </Panel>

        <Panel className="bg-black/35" tone="red">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Guardrails</div>
          <ul className="mt-2 grid gap-2">
            {stock.advisorGuardrails.map((guardrail) => (
              <li key={guardrail} className="text-sm leading-6 text-slate-300">• {guardrail}</li>
            ))}
          </ul>
        </Panel>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        {["Watching", "Active Review", "Passed"].map((status) => (
          <button key={status} onClick={() => onStatus(stock.id, status)} disabled={disabled} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-black text-white hover:bg-white/10 disabled:opacity-50">
            {status}
          </button>
        ))}
      </div>
    </Panel>
  );
}

function VentureCard({
  venture,
  onStatus,
  disabled,
}: {
  venture: AlternativeVenture;
  onStatus: (id: string, status: string) => void;
  disabled: boolean;
}) {
  return (
    <Panel tone={positiveScoreTone(venture.diligenceScore)} className="bg-black/35">
      <div className="grid gap-5 xl:grid-cols-[320px_minmax(0,1fr)]">
        <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-gradient-to-br from-emerald-950 via-zinc-950 to-zinc-900">
          {venture.imageUrl ? (
            <img src={venture.imageUrl} alt={venture.startupName} className="h-72 w-full object-cover" />
          ) : (
            <div className="grid h-72 place-items-center p-6 text-center">
              <div>
                <div className="mx-auto grid h-16 w-16 place-items-center rounded-3xl bg-emerald-500/15 text-2xl font-black text-emerald-100 ring-1 ring-emerald-500/30">
                  {venture.startupName.slice(0, 1)}
                </div>
                <div className="mt-4 text-2xl font-black text-white">{venture.startupName}</div>
                <div className="mt-2 text-sm font-bold text-slate-500">{venture.sector}</div>
              </div>
            </div>
          )}
        </div>

        <div>
          <div className="flex flex-wrap gap-2">
            <Pill tone="purple">{venture.stage}</Pill>
            <Pill tone={toneForStatus(venture.monitoringStatus)}>{venture.monitoringStatus}</Pill>
            <Pill tone={toneForStatus(venture.riskLevel)}>{venture.riskLevel}</Pill>
            <Pill tone={positiveScoreTone(venture.diligenceScore)}>Diligence {venture.diligenceScore}</Pill>
          </div>

          <h3 className="mt-4 text-3xl font-black text-white">{venture.startupName}</h3>
          <p className="mt-2 text-sm leading-7 text-slate-400">{venture.background}</p>

          <div className="mt-4 grid gap-3 md:grid-cols-4">
            <MetricBubble label="Valuation" value={money(venture.tentativeValuation)} tone="purple" />
            <MetricBubble label="Equity" value={`${venture.equityOfferedPct}%`} tone="amber" />
            <MetricBubble label="Amount" value={money(venture.amountSought)} tone="cyan" />
            <MetricBubble label="Implied Post" value={money(venture.impliedPostMoney)} tone="green" />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-5">
            {[
              ["Traction", venture.tractionScore, "green"],
              ["Valuation", venture.valuationDisciplineScore, "purple"],
              ["Founder/Mkt", venture.founderMarketScore, "cyan"],
              ["Risk", venture.ventureRiskScore, "red"],
              ["Presentation", venture.presentationScore, "amber"],
            ].map(([label, value, tone]) => (
              <div key={`${venture.id}-${label}`} className="rounded-2xl border border-white/10 bg-black/35 p-3">
                <div className="flex items-center justify-between gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</span>
                  <span className="text-sm font-black text-white">{value}</span>
                </div>
                <div className="mt-2">
                  <ScoreBar value={Number(value)} tone={tone as Tone} />
                </div>
              </div>
            ))}
          </div>

          <div className="mt-4 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
            <div className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Presentation model</div>
            <p className="mt-2 text-sm leading-6 text-cyan-50/80">
              {venture.presentationSummary || "No presentation summary recorded. Add deck URL, customer profile, revenue model, moat, and next diligence step."}
            </p>

            <div className="mt-3 grid gap-3 md:grid-cols-2">
              <div>
                <div className="text-[10px] font-black uppercase text-slate-500">Revenue model</div>
                <div className="mt-1 text-sm leading-6 text-slate-300">{venture.revenueModel || "Missing"}</div>
              </div>
              <div>
                <div className="text-[10px] font-black uppercase text-slate-500">Moat</div>
                <div className="mt-1 text-sm leading-6 text-slate-300">{venture.moat || "Missing"}</div>
              </div>
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            <Panel className="bg-black/35" tone="green">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Problem</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{venture.problemToSolve}</p>
            </Panel>

            <Panel className="bg-black/35" tone="cyan">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-cyan-300">Solution</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{venture.solution || "No solution recorded."}</p>
            </Panel>

            <Panel className="bg-black/35" tone="red">
              <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Key risks</div>
              <p className="mt-2 text-sm leading-6 text-slate-300">{venture.keyRisks || "No key risks recorded."}</p>
            </Panel>
          </div>

          <div className="mt-4 flex flex-wrap gap-2">
            {venture.deckUrl ? (
              <a href={venture.deckUrl} target="_blank" rel="noreferrer" className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950">
                Open Deck
              </a>
            ) : null}

            {venture.website ? (
              <a href={venture.website} target="_blank" rel="noreferrer" className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-black text-white hover:bg-white/10">
                Website
              </a>
            ) : null}

            {["Watching", "Diligence", "Passed"].map((status) => (
              <button key={status} onClick={() => onStatus(venture.id, status)} disabled={disabled} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-black text-white hover:bg-white/10 disabled:opacity-50">
                {status}
              </button>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function briefingCoverageCount(form: {
  includeMarket: boolean;
  includeEconomy: boolean;
  includeCrypto: boolean;
  includeAlternatives: boolean;
  includeCommodities: boolean;
  includeEnergy: boolean;
  includeMinerals: boolean;
  includeGeopolitics: boolean;
  includeTariffs: boolean;
  includeLabor: boolean;
  includeVenture: boolean;
}) {
  return [
    form.includeMarket,
    form.includeEconomy,
    form.includeCrypto,
    form.includeAlternatives,
    form.includeCommodities,
    form.includeEnergy,
    form.includeMinerals,
    form.includeGeopolitics,
    form.includeTariffs,
    form.includeLabor,
    form.includeVenture,
  ].filter(Boolean).length;
}

function briefingQualityScore(form: {
  audienceType: "Advisor" | "Client/Investor";
  intervalHours: number;
  localFocus: string;
  scope: "Local" | "U.S." | "Global" | "Local → Global";
  deliveryChannel: "Email" | "Dashboard" | "Both";
  recipientLabel: string;
  commodities: string;
  globalTopics: string;
  advisorInstructions: string;
  includeMarket: boolean;
  includeEconomy: boolean;
  includeCrypto: boolean;
  includeAlternatives: boolean;
  includeCommodities: boolean;
  includeEnergy: boolean;
  includeMinerals: boolean;
  includeGeopolitics: boolean;
  includeTariffs: boolean;
  includeLabor: boolean;
  includeVenture: boolean;
}) {
  let score = 35;

  const coverage = briefingCoverageCount(form);
  score += Math.min(24, coverage * 2);
  score += form.localFocus.trim().length >= 4 ? 8 : 0;
  score += form.recipientLabel.trim().length >= 3 ? 8 : 0;
  score += form.globalTopics.split(/,|\n/).filter((item) => item.trim()).length >= 6 ? 10 : 0;
  score += form.commodities.split(/,|\n/).filter((item) => item.trim()).length >= 4 ? 8 : 0;
  score += form.scope === "Local → Global" ? 8 : form.scope === "Global" ? 5 : 3;
  score += form.intervalHours <= 24 ? 5 : 2;
  score += form.advisorInstructions.trim().length >= 20 ? 7 : 0;
  score += form.audienceType === "Client/Investor" ? 3 : 0;

  return Math.max(0, Math.min(100, Math.round(score)));
}

function briefingQualityIssues(form: {
  intervalHours: number;
  localFocus: string;
  recipientLabel: string;
  commodities: string;
  globalTopics: string;
  advisorInstructions: string;
  includeMarket: boolean;
  includeEconomy: boolean;
  includeCrypto: boolean;
  includeAlternatives: boolean;
  includeCommodities: boolean;
  includeEnergy: boolean;
  includeMinerals: boolean;
  includeGeopolitics: boolean;
  includeTariffs: boolean;
  includeLabor: boolean;
  includeVenture: boolean;
}) {
  const issues: string[] = [];
  const coverage = briefingCoverageCount(form);

  if (coverage < 5) issues.push("Coverage is narrow. Enable more sections for a holistic briefing.");
  if (!form.localFocus.trim()) issues.push("Add a local focus so the briefing can begin locally before expanding globally.");
  if (!form.recipientLabel.trim()) issues.push("Add a recipient label so drafts are easier to organize.");
  if (form.globalTopics.split(/,|\n/).filter((item) => item.trim()).length < 5) {
    issues.push("Add more global topics such as wars, tariffs, strikes, uprisings, sanctions, and supply chain shocks.");
  }
  if (form.commodities.split(/,|\n/).filter((item) => item.trim()).length < 4) {
    issues.push("Add more commodity inputs such as oil, gas, gold, copper, lithium, uranium, or silver.");
  }
  if (!form.advisorInstructions.trim()) issues.push("Add custom advisor instructions to make the AI output more specific.");
  if (form.intervalHours > 72) issues.push("Long intervals may make the briefing less actionable for fast-moving markets.");

  return issues;
}

function BriefingScheduleCard({
  schedule,
  onGenerate,
  onStatus,
  disabled,
}: {
  schedule: BriefingSchedule;
  onGenerate: (ruleId: string) => void;
  onStatus: (ruleId: string, status: string) => void;
  disabled: boolean;
}) {
  const selectedCoverage = [
    schedule.coverage.includeMarket ? "Markets" : null,
    schedule.coverage.includeEconomy ? "Economy" : null,
    schedule.coverage.includeCrypto ? "Crypto" : null,
    schedule.coverage.includeCommodities ? "Commodities" : null,
    schedule.coverage.includeEnergy ? "Energy" : null,
    schedule.coverage.includeMinerals ? "Minerals" : null,
    schedule.coverage.includeGeopolitics ? "Geopolitics" : null,
    schedule.coverage.includeTariffs ? "Tariffs" : null,
    schedule.coverage.includeLabor ? "Labor" : null,
    schedule.coverage.includeVenture ? "Venture" : null,
  ].filter(Boolean);

  return (
    <Panel tone={schedule.coverage.audienceType === "Advisor" ? "purple" : "cyan"} className="bg-black/35">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Pill tone={schedule.coverage.audienceType === "Advisor" ? "purple" : "cyan"}>{schedule.coverage.audienceType}</Pill>
            <Pill tone={toneForStatus(schedule.status)}>{schedule.status}</Pill>
            <Pill tone="amber">Every {schedule.coverage.intervalHours}h</Pill>
            <Pill tone={scopeTone(schedule.coverage.scope)}>{schedule.coverage.scope}</Pill>
          </div>
          <h3 className="mt-3 text-xl font-black text-white">{schedule.title}</h3>
          <p className="mt-2 text-sm leading-6 text-slate-400">{schedule.description}</p>
        </div>

        <div className="grid min-w-[230px] gap-2">
          <MetricBubble label="Last Run" value={relativeTime(schedule.lastRunAt)} helper={schedule.coverage.deliveryChannel} tone="slate" />
          <MetricBubble label="Next Run" value={nextRunLabel(schedule)} helper="Based on interval" tone={nextRunLabel(schedule) === "Due now" ? "red" : "green"} />
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricBubble label="Local Focus" value={schedule.coverage.localFocus} tone="cyan" />
        <MetricBubble label="Recipient" value={schedule.coverage.recipientLabel} tone="purple" />
        <MetricBubble label="Commodities" value={schedule.coverage.commodities.length} helper={schedule.coverage.commodities.slice(0, 3).join(", ")} tone="amber" />
        <MetricBubble label="Global Topics" value={schedule.coverage.globalTopics.length} helper="Tracked topics" tone="green" />
      </div>

      <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-4">
        <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Coverage map</div>
        <div className="mt-3 flex flex-wrap gap-2">
          {selectedCoverage.map((item) => (
            <Pill key={String(item)} tone="slate">{String(item)}</Pill>
          ))}
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button onClick={() => onGenerate(schedule.id)} disabled={disabled} className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950 disabled:opacity-50">
          Generate Now
        </button>
        <button onClick={() => onStatus(schedule.id, schedule.status === "Active" ? "Paused" : "Active")} disabled={disabled} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-2 text-xs font-black text-white disabled:opacity-50">
          {schedule.status === "Active" ? "Pause" : "Activate"}
        </button>
      </div>
    </Panel>
  );
}

function BriefingDraftCard({
  title,
  body,
  kind,
  createdAt,
  status,
  sources,
  complianceNotes = [],
}: {
  title: string;
  body: string;
  kind: "Advisor" | "Client/Investor";
  createdAt: string;
  status: string;
  sources: Array<{ title?: string; source?: string; url?: string; publishedAt?: string; topic?: string; scope?: string }>;
  complianceNotes?: string[];
}) {
  const [copied, setCopied] = useState(false);

  async function copyBody() {
    await navigator.clipboard.writeText(body);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1500);
  }

  return (
    <Panel tone={kind === "Advisor" ? "purple" : "cyan"} className="bg-black/35">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap gap-2">
            <Pill tone={kind === "Advisor" ? "purple" : "cyan"}>{kind}</Pill>
            <Pill tone={toneForStatus(status)}>{status}</Pill>
            <Pill tone="slate">{shortDate(createdAt)}</Pill>
            <Pill tone="green">{sources.length} sources</Pill>
          </div>
          <h3 className="mt-3 text-xl font-black text-white">{title}</h3>
        </div>

        <button onClick={copyBody} className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950">
          {copied ? "Copied" : "Copy Draft"}
        </button>
      </div>

      <pre className="mt-4 max-h-[420px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/45 p-4 text-sm leading-7 text-slate-300">
        {body}
      </pre>

      <div className="mt-4 grid gap-4 xl:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
            Sources captured inside interval
          </div>
          <div className="mt-3 grid gap-2">
            {sources.length ? (
              sources.slice(0, 10).map((source, index) => (
                <div key={`${title}-${index}-${source.title}`} className="text-sm leading-6 text-slate-400">
                  {source.url ? (
                    <a href={source.url} target="_blank" rel="noreferrer" className="text-cyan-200 hover:text-cyan-100">
                      {source.title || source.source || "Source"}
                    </a>
                  ) : (
                    source.title || source.source || "Source"
                  )}
                  {source.source ? <span className="text-slate-600"> · {source.source}</span> : null}
                  {source.scope ? <span className="text-slate-600"> · {source.scope}</span> : null}
                </div>
              ))
            ) : (
              <div className="text-sm text-slate-500">No source list stored.</div>
            )}
          </div>
        </div>

        <div className="rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">
            Compliance / review notes
          </div>
          <div className="mt-3 grid gap-2">
            {(complianceNotes.length ? complianceNotes : [
              "Confirm all events occurred inside the briefing interval.",
              "Review before external delivery.",
              "Do not present alternatives as recommendations.",
            ]).map((note) => (
              <div key={note} className="text-sm leading-6 text-amber-50/80">• {note}</div>
            ))}
          </div>
        </div>
      </div>
    </Panel>
  );
}

function BriefingStudioGuide() {
  return (
    <Panel tone="green" className="bg-black/35">
      <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Briefing Center standard</div>
      <h3 className="mt-2 text-2xl font-black text-white">What makes a briefing useful</h3>
      <div className="mt-4 grid gap-3">
        {[
          "Interval-only news: the briefing should only include events that happened since the last scheduled update.",
          "Local-to-global structure: start with the advisor’s local market, expand to U.S. economy, then global risks.",
          "Separate audiences: advisor briefings can include internal strategy; client/investor briefings must be simpler and approval-ready.",
          "Source-backed output: every briefing stores captured sources so the advisor can verify before sending.",
          "Macro + alternatives together: rates, inflation, jobs, commodities, energy, metals, crypto, venture, tariffs, labor, and geopolitical risk.",
        ].map((item) => (
          <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3 text-sm leading-6 text-slate-300">
            {item}
          </div>
        ))}
      </div>
    </Panel>
  );
}

function BriefingQualityPanel({
  qualityScore,
  qualityIssues,
  briefingForm,
}: {
  qualityScore: number;
  qualityIssues: string[];
  briefingForm: {
    audienceType: "Advisor" | "Client/Investor";
    intervalHours: number;
    localFocus: string;
    scope: "Local" | "U.S." | "Global" | "Local → Global";
    deliveryChannel: "Email" | "Dashboard" | "Both";
    recipientLabel: string;
    commodities: string;
    globalTopics: string;
    advisorInstructions: string;
    includeMarket: boolean;
    includeEconomy: boolean;
    includeCrypto: boolean;
    includeAlternatives: boolean;
    includeCommodities: boolean;
    includeEnergy: boolean;
    includeMinerals: boolean;
    includeGeopolitics: boolean;
    includeTariffs: boolean;
    includeLabor: boolean;
    includeVenture: boolean;
  };
}) {
  const coverageCount = briefingCoverageCount(briefingForm);

  return (
    <Panel tone={positiveScoreTone(qualityScore)} className="bg-black/35">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">Readiness score</div>
          <h3 className="mt-2 text-3xl font-black text-white">{qualityScore}/100</h3>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-slate-400">
            This score checks whether the briefing has enough coverage, local context, interval discipline, global topic depth, commodity inputs, and advisor instructions to be useful.
          </p>
        </div>

        <div className="grid min-w-[260px] gap-3">
          <MetricBubble label="Coverage" value={`${coverageCount}/11`} helper="Enabled modules" tone="green" />
          <MetricBubble label="Interval" value={`${briefingForm.intervalHours}h`} helper="Advisor-selected" tone="amber" />
        </div>
      </div>

      <div className="mt-4">
        <ScoreBar value={qualityScore} tone={positiveScoreTone(qualityScore)} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-2">
        <div className="rounded-2xl border border-white/10 bg-white/[0.045] p-4">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Strengths</div>
          <div className="mt-3 grid gap-2">
            {[
              briefingForm.localFocus ? `Local focus: ${briefingForm.localFocus}` : null,
              briefingForm.scope ? `Scope: ${briefingForm.scope}` : null,
              briefingForm.globalTopics ? "Global risk topics included" : null,
              briefingForm.commodities ? "Commodities/minerals included" : null,
              briefingForm.audienceType === "Client/Investor" ? "External draft review mode enabled" : "Internal advisor strategy mode",
            ]
              .filter(Boolean)
              .map((item) => (
                <div key={String(item)} className="text-sm leading-6 text-slate-300">• {item}</div>
              ))}
          </div>
        </div>

        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
          <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Improvements</div>
          <div className="mt-3 grid gap-2">
            {qualityIssues.length ? (
              qualityIssues.map((issue) => (
                <div key={issue} className="text-sm leading-6 text-emerald-50/80">• {issue}</div>
              ))
            ) : (
              <div className="text-sm leading-6 text-emerald-50/80">No major briefing quality gaps detected.</div>
            )}
          </div>
        </div>
      </div>
    </Panel>
  );
}

export default function AlternativeInvestmentsPage() {
  const [data, setData] = useState<AlternativeData | null>(null);
  const [activeView, setActiveView] = useState<View>("overview");
  const [briefingMode, setBriefingMode] = useState<BriefingMode>("advisor");
  const [briefingSubView, setBriefingSubView] = useState<BriefingSubView>("studio");
  const [message, setMessage] = useState("");
  const [generatedText, setGeneratedText] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [briefingForm, setBriefingForm] = useState({
    audienceType: "Advisor" as "Advisor" | "Client/Investor",
    intervalHours: 24,
    localFocus: "Phoenix, Arizona",
    scope: "Local → Global" as "Local" | "U.S." | "Global" | "Local → Global",
    deliveryChannel: "Email" as "Email" | "Dashboard" | "Both",
    recipientLabel: "Advisor Team",
    tone: "Professional, balanced, advisor-grade",
    commodities: "Oil, Natural Gas, Gold, Silver, Copper, Lithium, Uranium",
    globalTopics:
      "U.S. economy, Federal Reserve, inflation, labor market, S&P 500, tariffs, global war, sanctions, strikes, supply chain, oil markets, crypto regulation, venture funding",
    includeMarket: true,
    includeEconomy: true,
    includeCrypto: true,
    includeAlternatives: true,
    includeCommodities: true,
    includeEnergy: true,
    includeMinerals: true,
    includeGeopolitics: true,
    includeTariffs: true,
    includeLabor: true,
    includeVenture: true,
    advisorInstructions:
      "Lead with the most actionable developments. Separate advisor-only comments from client-safe language. Flag anything requiring suitability review.",
  });

  const [ventureForm, setVentureForm] = useState({
    startupName: "",
    founderName: "",
    sector: "Technology",
    stage: "Seed",
    website: "",
    imageUrl: "",
    deckUrl: "",
    background: "",
    problemToSolve: "",
    solution: "",
    equityOfferedPct: "",
    tentativeValuation: "",
    amountSought: "",
    traction: "",
    thesis: "",
    keyRisks: "",
    monitoringStatus: "Watching",
    riskLevel: "Very High",
    presentationSummary: "",
    customerProfile: "",
    revenueModel: "",
    moat: "",
    nextDiligence: "",
    notes: "",
  });

  const [pennyForm, setPennyForm] = useState({
    ticker: "",
    companyName: "",
    sector: "Unknown",
    thesis: "",
    catalyst: "",
    riskNotes: "",
    targetEntry: "",
    maxPositionPct: "",
    status: "Watching",
    riskLevel: "Extreme",
    notes: "",
  });

  const firm = data?.firm ?? null;
  const membership = data?.membership ?? null;
  const canManage =
    membership?.role === "Owner" ||
    Boolean(membership?.canManageProjects) ||
    Boolean(membership?.canManageFirm);

  const cryptoMarkets = data?.crypto.markets ?? [];
  const ventures = data?.ventures ?? [];
  const pennyStocks = data?.pennyStocks ?? [];
  const schedules = data?.briefings.schedules ?? [];
  const advisorBriefings = data?.briefings.advisorBriefings ?? [];
  const clientBriefings = data?.briefings.clientBriefings ?? [];

  const bestCrypto = useMemo(() => {
    return cryptoMarkets.slice().sort((a, b) => b.riskAdjustedScore - a.riskAdjustedScore)[0] ?? null;
  }, [cryptoMarkets]);

  const bestPenny = useMemo(() => {
    return pennyStocks.slice().sort((a, b) => b.riskReductionScore - a.riskReductionScore)[0] ?? null;
  }, [pennyStocks]);

  const bestVenture = useMemo(() => {
    return ventures.slice().sort((a, b) => b.diligenceScore - a.diligenceScore)[0] ?? null;
  }, [ventures]);

  const advisorSchedules = schedules.filter((schedule) => schedule.coverage.audienceType === "Advisor");
  const clientSchedules = schedules.filter((schedule) => schedule.coverage.audienceType === "Client/Investor");
  const dueSchedules = schedules.filter((schedule) => nextRunLabel(schedule) === "Due now" && schedule.status === "Active");

  const qualityScore = briefingQualityScore(briefingForm);
  const qualityIssues = briefingQualityIssues(briefingForm);

  function setView(view: View) {
    setActiveView(view);
    const url = new URL(window.location.href);
    url.searchParams.set("view", view);
    window.history.replaceState({}, "", url.toString());
  }

  async function loadData() {
    const response = await fetch("/api/alternative-investments", { cache: "no-store" });
    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to load alternative investments.");
      return;
    }

    setData(payload);
  }

  async function postAction(body: Record<string, unknown>) {
    if (!firm) {
      setMessage("A firm workspace is required before saving alternative investments.");
      return null;
    }

    setSaving(true);
    setMessage("");
    setGeneratedText("");

    try {
      const response = await fetch("/api/alternative-investments", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": String(body.action ?? "alternative-action"),
        },
        body: JSON.stringify({ firmId: firm.id, ...body }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Action failed.");
        return null;
      }

      setData(payload);

      if (payload.generatedBriefing?.text) {
        setGeneratedText(payload.generatedBriefing.text);
        setMessage(
          `Briefing generated from ${payload.generatedBriefing.eventCount} interval event(s), ${payload.generatedBriefing.commodityCount} commodity snapshot(s). AI status: ${payload.generatedBriefing.aiStatus}.`
        );
      }

      return payload;
    } finally {
      setSaving(false);
    }
  }

  async function createBriefingSchedule(event: FormEvent) {
    event.preventDefault();

    const payload = await postAction({
      action: "createBriefingSchedule",
      ...briefingForm,
    });

    if (payload) {
      setView("briefings");
      setBriefingSubView("schedules");
      setMessage("Briefing schedule created.");
    }
  }

  async function generateBriefing(ruleId?: string) {
    const payload = await postAction({
      action: "generateBriefing",
      ...(ruleId ? { ruleId } : briefingForm),
    });

    if (payload) {
      setView("briefings");
      setBriefingSubView(briefingForm.audienceType === "Advisor" ? "advisor-notes" : "client-drafts");
    }
  }

  async function updateBriefingScheduleStatus(ruleId: string, status: string) {
    const payload = await postAction({
      action: "updateBriefingScheduleStatus",
      ruleId,
      status,
    });

    if (payload) setMessage(`Briefing schedule ${status.toLowerCase()}.`);
  }

  async function createVenture(event: FormEvent) {
    event.preventDefault();
    const payload = await postAction({ action: "createVenture", ...ventureForm });

    if (payload) {
      setVentureForm({
        startupName: "",
        founderName: "",
        sector: "Technology",
        stage: "Seed",
        website: "",
        imageUrl: "",
        deckUrl: "",
        background: "",
        problemToSolve: "",
        solution: "",
        equityOfferedPct: "",
        tentativeValuation: "",
        amountSought: "",
        traction: "",
        thesis: "",
        keyRisks: "",
        monitoringStatus: "Watching",
        riskLevel: "Very High",
        presentationSummary: "",
        customerProfile: "",
        revenueModel: "",
        moat: "",
        nextDiligence: "",
        notes: "",
      });
      setView("venture");
      setMessage("Venture added to firm monitor.");
    }
  }

  async function updateVentureStatus(ventureId: string, monitoringStatus: string) {
    const payload = await postAction({ action: "updateVentureStatus", ventureId, monitoringStatus });
    if (payload) {
      setView("venture");
      setMessage(`Venture status updated to ${monitoringStatus}.`);
    }
  }

  async function createPennyStock(event: FormEvent) {
    event.preventDefault();
    const payload = await postAction({ action: "createPennyStock", ...pennyForm });

    if (payload) {
      setPennyForm({
        ticker: "",
        companyName: "",
        sector: "Unknown",
        thesis: "",
        catalyst: "",
        riskNotes: "",
        targetEntry: "",
        maxPositionPct: "",
        status: "Watching",
        riskLevel: "Extreme",
        notes: "",
      });
      setView("penny-stocks");
      setMessage("Penny stock added to watchlist.");
    }
  }

  async function updatePennyStatus(pennyStockId: string, status: string) {
    const payload = await postAction({ action: "updatePennyStockStatus", pennyStockId, status });
    if (payload) {
      setView("penny-stocks");
      setMessage(`Penny stock status updated to ${status}.`);
    }
  }

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get("view") as View | null;

    if (view && viewTabs.some((tab) => tab.id === view)) setActiveView(view);

    async function run() {
      try {
        await loadData();
      } finally {
        setLoading(false);
      }
    }

    void run();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.16),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
        <div className="mx-auto max-w-[1500px]">
          <Logo />
          <div className="mt-8 text-sm font-semibold text-slate-400">
            Loading alternative investment workspace...
          </div>
        </div>
      </main>
    );
  }

  if (!firm) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.16),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
        <div className="mx-auto max-w-4xl">
          <Logo />
          <Card className="mt-8 p-6">
            <Pill tone="amber">Firm required</Pill>
            <h1 className="mt-4 text-3xl font-black">Create or join a firm first.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Alternative investments are tracked at the firm level so advisors can share the same crypto dashboard, penny-stock watchlist, venture monitor, and briefing studio.
            </p>
            <a href="/workspace" className="mt-6 inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950">
              Open Workspace
            </a>
          </Card>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.16),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1900px] gap-5">
        <header className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-zinc-950/78 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.28),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(6,182,212,0.16),transparent_26%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <Logo />

              <div className="mt-5 flex flex-wrap gap-2">
                <Pill tone="red">Alternatives risk lab</Pill>
                <Pill tone="cyan">Crypto trend scoring</Pill>
                <Pill tone="amber">Penny stock guardrails</Pill>
                <Pill tone="purple">Venture presentation monitor</Pill>
                <Pill tone="green">Briefing center</Pill>
              </div>

              <h1 className="mt-5 max-w-6xl text-4xl font-black tracking-tight md:text-6xl">
                Alternative research, risk control, and briefing automation.
              </h1>

              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
                Slice scores speculative alternatives while giving advisors a briefing center that separates internal advisor notes from client/investor drafts, controls intervals, preserves sources, and keeps alternative commentary approval-ready.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <div className="rounded-2xl bg-white/5 px-4 py-3">
                <div className="text-[10px] font-black uppercase text-slate-500">Firm</div>
                <div className="max-w-[220px] truncate text-sm font-black">{firm.name}</div>
              </div>

              <a href="/workspace" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">
                ← Workspace
              </a>

              <a href="/market-visuals" className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white hover:bg-white/10">
                Market Visuals
              </a>

              <button
                onClick={() => {
                  setLoading(true);
                  void loadData().finally(() => setLoading(false));
                }}
                className="rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/40"
              >
                Refresh Data
              </button>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <MetricBubble label="Crypto Universe" value={cryptoMarkets.length} helper="Tracked assets" tone="cyan" />
            <MetricBubble label="Crypto Breadth" value={`${data?.crypto.breadth ?? 0}%`} helper="Positive 24h" tone={(data?.crypto.breadth ?? 0) >= 50 ? "green" : "red"} />
            <MetricBubble label="Fear/Greed" value={data?.crypto.fearGreed.value ?? "—"} helper={data?.crypto.fearGreed.classification ?? "Unavailable"} tone="purple" />
            <MetricBubble label="Best Crypto" value={bestCrypto?.symbol.toUpperCase() ?? "—"} helper={bestCrypto ? `Score ${bestCrypto.riskAdjustedScore}` : "No data"} tone="green" />
            <MetricBubble label="Penny Watches" value={data?.stats.pennyStats.count ?? 0} helper={`Avg control ${Math.round(data?.stats.pennyStats.averageRiskReductionScore ?? 0)}`} tone="amber" />
            <MetricBubble label="Ventures" value={data?.stats.ventureStats.count ?? 0} helper={`${data?.stats.ventureStats.diligence ?? 0} diligence`} tone="purple" />
            <MetricBubble label="Briefing Schedules" value={data?.stats.briefingStats.schedules ?? 0} helper={`${data?.stats.briefingStats.activeSchedules ?? 0} active`} tone="green" />
            <MetricBubble label="Due Now" value={dueSchedules.length} helper="Interval schedules" tone={dueSchedules.length ? "red" : "slate"} />
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
            {message}
          </div>
        ) : null}

        <Card className="p-3">
          <div className="grid gap-2 md:grid-cols-3 xl:grid-cols-6">
            {viewTabs.map((tab) => (
              <button
                key={tab.id}
                type="button"
                onClick={() => setView(tab.id)}
                className={cx(
                  "rounded-2xl px-4 py-3 text-left transition",
                  activeView === tab.id
                    ? "bg-white text-slate-950 shadow-lg shadow-black/20"
                    : "border border-white/10 bg-white/[0.045] text-white hover:bg-white/10"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-black">{tab.label}</div>
                  <span
                    className={cx(
                      "h-2 w-2 rounded-full",
                      tab.tone === "red"
                        ? "bg-emerald-400"
                        : tab.tone === "cyan"
                          ? "bg-cyan-400"
                          : tab.tone === "purple"
                            ? "bg-purple-400"
                            : tab.tone === "green"
                              ? "bg-emerald-400"
                              : tab.tone === "amber"
                                ? "bg-amber-400"
                                : "bg-slate-400"
                    )}
                  />
                </div>
                <div className={cx("mt-1 text-[10px] font-bold", activeView === tab.id ? "text-slate-500" : "text-slate-500")}>
                  {tab.description}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {activeView === "overview" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_430px]">
            <Card className="p-6">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-400">
                  Risk-adjusted alternatives
                </div>
                <h2 className="mt-2 text-3xl font-black text-white">Alternative intelligence dashboard</h2>
                <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-400">
                  Alternatives can never be made risk-free, but the platform can reduce blind risk by forcing trend, liquidity, valuation, catalyst, presentation, suitability, and source review.
                </p>
              </div>

              <div className="mt-6 grid gap-5 xl:grid-cols-4">
                <Panel tone="cyan" className="bg-black/35">
                  <Pill tone="cyan">Crypto</Pill>
                  <h3 className="mt-3 text-2xl font-black text-white">{bestCrypto?.name ?? "No crypto leader"}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{bestCrypto?.advisorAction ?? "Crypto data unavailable."}</p>
                  <div className="mt-4">
                    <ScoreBar value={bestCrypto?.riskAdjustedScore ?? 0} tone="cyan" />
                  </div>
                </Panel>

                <Panel tone="amber" className="bg-black/35">
                  <Pill tone="amber">Penny stocks</Pill>
                  <h3 className="mt-3 text-2xl font-black text-white">{bestPenny?.ticker ?? "No penny watch"}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{bestPenny?.riskAdjustedLabel ?? "Add a ticker with thesis, catalyst, and risk notes."}</p>
                  <div className="mt-4">
                    <ScoreBar value={bestPenny?.riskReductionScore ?? 0} tone="amber" />
                  </div>
                </Panel>

                <Panel tone="purple" className="bg-black/35">
                  <Pill tone="purple">Venture</Pill>
                  <h3 className="mt-3 text-2xl font-black text-white">{bestVenture?.startupName ?? "No venture"}</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{bestVenture?.ventureRecommendation ?? "Add a venture with presentation and diligence details."}</p>
                  <div className="mt-4">
                    <ScoreBar value={bestVenture?.diligenceScore ?? 0} tone="purple" />
                  </div>
                </Panel>

                <Panel tone="green" className="bg-black/35">
                  <Pill tone="green">Briefings</Pill>
                  <h3 className="mt-3 text-2xl font-black text-white">{data?.stats.briefingStats.activeSchedules ?? 0} active</h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Advisor and client/investor briefings use interval-captured events and source-backed review.
                  </p>
                  <div className="mt-4">
                    <ScoreBar value={(data?.stats.briefingStats.activeSchedules ?? 0) * 20} tone="green" />
                  </div>
                </Panel>
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">
                Market condition
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Crypto sentiment</h2>

              <div className="mt-5">
                <MetricBubble label="Fear / Greed" value={data?.crypto.fearGreed.value ?? "—"} helper={data?.crypto.fearGreed.classification ?? "Unavailable"} tone="purple" />
              </div>

              <div className="mt-5 rounded-2xl border border-white/10 bg-black/35 p-4">
                <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">Regime</div>
                <div className="mt-2 text-xl font-black text-white">{data?.crypto.sentiment.regime}</div>
                <p className="mt-2 text-sm leading-6 text-slate-400">{data?.crypto.sentiment.riskComment}</p>
              </div>

              <div className="mt-5 grid gap-3">
                <MetricBubble label="Aggregate Cap" value={money(data?.crypto.aggregateMarketCap)} tone="cyan" />
                <MetricBubble label="Aggregate Volume" value={money(data?.crypto.aggregateVolume)} tone="green" />
                <MetricBubble label="Fetched" value={relativeTime(data?.crypto.fetchedAt)} helper={data?.crypto.sources.join(", ")} tone="slate" />
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "crypto" ? (
          <section className="grid gap-5 xl:grid-cols-[360px_1fr]">
            <div className="grid gap-5">
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">Crypto leaders</div>
                <h2 className="mt-2 text-2xl font-black text-white">Risk-adjusted ranking</h2>
                <div className="mt-5 grid gap-3">
                  {(data?.crypto.leaders ?? []).map((coin) => (
                    <Panel key={coin.id} tone={positiveScoreTone(coin.riskAdjustedScore)} className="bg-black/35">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-white">{coin.name}</div>
                          <div className="mt-1 text-xs uppercase text-slate-500">{coin.symbol}</div>
                        </div>
                        <Pill tone={positiveScoreTone(coin.riskAdjustedScore)}>{coin.riskAdjustedScore}</Pill>
                      </div>
                    </Panel>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-purple-400">Valuation leaders</div>
                <h2 className="mt-2 text-2xl font-black text-white">FDV discipline</h2>
                <div className="mt-5 grid gap-3">
                  {(data?.crypto.valuationLeaders ?? []).map((coin) => (
                    <Panel key={coin.id} tone="purple" className="bg-black/35">
                      <div className="flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black text-white">{coin.name}</div>
                          <div className="mt-1 text-xs uppercase text-slate-500">
                            FDV/MC {coin.fdvToMarketCap ? coin.fdvToMarketCap.toFixed(2) : "—"}
                          </div>
                        </div>
                        <Pill tone="purple">{coin.valuationScore}</Pill>
                      </div>
                    </Panel>
                  ))}
                </div>
              </Card>
            </div>

            <Card className="p-5">
              <div className="grid gap-4">
                {cryptoMarkets.map((coin) => <CryptoCard key={coin.id} coin={coin} />)}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "penny-stocks" ? (
          <section className="grid gap-5 xl:grid-cols-[440px_1fr]">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-400">Add speculative equity</div>
              <h2 className="mt-2 text-2xl font-black text-white">Penny stock risk controls</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                The score improves when there is a real catalyst, liquidity support, risk notes, target entry, and max position limit.
              </p>

              {canManage ? (
                <form onSubmit={createPennyStock} className="mt-5 grid gap-3">
                  <div className="grid gap-3 md:grid-cols-2">
                    <input value={pennyForm.ticker} onChange={(event) => setPennyForm((current) => ({ ...current, ticker: event.target.value.toUpperCase() }))} placeholder="Ticker" className={inputClass} />
                    <input value={pennyForm.companyName} onChange={(event) => setPennyForm((current) => ({ ...current, companyName: event.target.value }))} placeholder="Company name" className={inputClass} />
                  </div>

                  <input value={pennyForm.sector} onChange={(event) => setPennyForm((current) => ({ ...current, sector: event.target.value }))} placeholder="Sector" className={inputClass} />
                  <textarea value={pennyForm.thesis} onChange={(event) => setPennyForm((current) => ({ ...current, thesis: event.target.value }))} placeholder="Thesis" className={cx(inputClass, "min-h-24")} />
                  <textarea value={pennyForm.catalyst} onChange={(event) => setPennyForm((current) => ({ ...current, catalyst: event.target.value }))} placeholder="Catalyst: contract, filing, trial data, uplisting, revenue inflection..." className={cx(inputClass, "min-h-24")} />
                  <textarea value={pennyForm.riskNotes} onChange={(event) => setPennyForm((current) => ({ ...current, riskNotes: event.target.value }))} placeholder="Risk notes: dilution, liquidity, reporting, promotional risk..." className={cx(inputClass, "min-h-24")} />

                  <div className="grid gap-3 md:grid-cols-2">
                    <input value={pennyForm.targetEntry} onChange={(event) => setPennyForm((current) => ({ ...current, targetEntry: event.target.value }))} placeholder="Target entry" className={inputClass} />
                    <input value={pennyForm.maxPositionPct} onChange={(event) => setPennyForm((current) => ({ ...current, maxPositionPct: event.target.value }))} placeholder="Max position %" className={inputClass} />
                  </div>

                  <button disabled={saving} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60">
                    Add Penny Stock
                  </button>
                </form>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-sm text-slate-400">
                  You can view this section, but only owners/admins/project managers can modify it.
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="grid gap-4">
                {pennyStocks.length ? (
                  pennyStocks.map((stock) => (
                    <PennyStockCard key={stock.id} stock={stock} disabled={saving || !canManage} onStatus={updatePennyStatus} />
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-400">
                    No penny stocks added yet.
                  </div>
                )}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "venture" ? (
          <section className="grid gap-5 xl:grid-cols-[460px_1fr]">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-purple-400">Venture submission</div>
              <h2 className="mt-2 text-2xl font-black text-white">Presentation-ready monitor</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Add enough details for a venture to be displayed cleanly: image, deck, problem, solution, revenue model, moat, valuation bridge, and next diligence step.
              </p>

              {canManage ? (
                <form onSubmit={createVenture} className="mt-5 grid gap-3">
                  <input value={ventureForm.startupName} onChange={(event) => setVentureForm((current) => ({ ...current, startupName: event.target.value }))} placeholder="Startup name" className={inputClass} />
                  <input value={ventureForm.founderName} onChange={(event) => setVentureForm((current) => ({ ...current, founderName: event.target.value }))} placeholder="Founder name" className={inputClass} />
                  <div className="grid gap-3 md:grid-cols-2">
                    <select value={ventureForm.sector} onChange={(event) => setVentureForm((current) => ({ ...current, sector: event.target.value }))} className={selectClass}>
                      <option>Technology</option>
                      <option>FinTech</option>
                      <option>AI / Automation</option>
                      <option>Healthcare</option>
                      <option>Consumer</option>
                      <option>Real Estate</option>
                      <option>Climate</option>
                      <option>Industrial</option>
                    </select>
                    <select value={ventureForm.stage} onChange={(event) => setVentureForm((current) => ({ ...current, stage: event.target.value }))} className={selectClass}>
                      <option>Pre-Seed</option>
                      <option>Seed</option>
                      <option>Series A</option>
                      <option>Series B</option>
                      <option>Growth</option>
                    </select>
                  </div>
                  <input value={ventureForm.website} onChange={(event) => setVentureForm((current) => ({ ...current, website: event.target.value }))} placeholder="Website URL" className={inputClass} />
                  <input value={ventureForm.imageUrl} onChange={(event) => setVentureForm((current) => ({ ...current, imageUrl: event.target.value }))} placeholder="Image URL for venture card" className={inputClass} />
                  <input value={ventureForm.deckUrl} onChange={(event) => setVentureForm((current) => ({ ...current, deckUrl: event.target.value }))} placeholder="Deck / presentation URL" className={inputClass} />
                  <textarea value={ventureForm.background} onChange={(event) => setVentureForm((current) => ({ ...current, background: event.target.value }))} placeholder="Short background" className={cx(inputClass, "min-h-24")} />
                  <textarea value={ventureForm.problemToSolve} onChange={(event) => setVentureForm((current) => ({ ...current, problemToSolve: event.target.value }))} placeholder="Problem to solve" className={cx(inputClass, "min-h-24")} />
                  <textarea value={ventureForm.solution} onChange={(event) => setVentureForm((current) => ({ ...current, solution: event.target.value }))} placeholder="Solution" className={cx(inputClass, "min-h-24")} />
                  <div className="grid gap-3 md:grid-cols-3">
                    <input value={ventureForm.equityOfferedPct} onChange={(event) => setVentureForm((current) => ({ ...current, equityOfferedPct: event.target.value }))} placeholder="Equity %" className={inputClass} />
                    <input value={ventureForm.tentativeValuation} onChange={(event) => setVentureForm((current) => ({ ...current, tentativeValuation: event.target.value }))} placeholder="Valuation" className={inputClass} />
                    <input value={ventureForm.amountSought} onChange={(event) => setVentureForm((current) => ({ ...current, amountSought: event.target.value }))} placeholder="Amount sought" className={inputClass} />
                  </div>
                  <textarea value={ventureForm.traction} onChange={(event) => setVentureForm((current) => ({ ...current, traction: event.target.value }))} placeholder="Traction" className={cx(inputClass, "min-h-20")} />
                  <textarea value={ventureForm.presentationSummary} onChange={(event) => setVentureForm((current) => ({ ...current, presentationSummary: event.target.value }))} placeholder="Presentation summary" className={cx(inputClass, "min-h-20")} />
                  <textarea value={ventureForm.customerProfile} onChange={(event) => setVentureForm((current) => ({ ...current, customerProfile: event.target.value }))} placeholder="Customer profile" className={cx(inputClass, "min-h-20")} />
                  <textarea value={ventureForm.revenueModel} onChange={(event) => setVentureForm((current) => ({ ...current, revenueModel: event.target.value }))} placeholder="Revenue model" className={cx(inputClass, "min-h-20")} />
                  <textarea value={ventureForm.moat} onChange={(event) => setVentureForm((current) => ({ ...current, moat: event.target.value }))} placeholder="Moat / differentiation" className={cx(inputClass, "min-h-20")} />
                  <textarea value={ventureForm.nextDiligence} onChange={(event) => setVentureForm((current) => ({ ...current, nextDiligence: event.target.value }))} placeholder="Next diligence step" className={cx(inputClass, "min-h-20")} />
                  <textarea value={ventureForm.keyRisks} onChange={(event) => setVentureForm((current) => ({ ...current, keyRisks: event.target.value }))} placeholder="Key risks" className={cx(inputClass, "min-h-20")} />
                  <button disabled={saving} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60">
                    Add Venture
                  </button>
                </form>
              ) : (
                <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-sm text-slate-400">
                  You can view ventures, but only owners/admins/project managers can modify them.
                </div>
              )}
            </Card>

            <Card className="p-5">
              <div className="grid gap-4">
                {ventures.length ? (
                  ventures.map((venture) => (
                    <VentureCard key={venture.id} venture={venture} disabled={saving || !canManage} onStatus={updateVentureStatus} />
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-400">
                    No ventures added yet.
                  </div>
                )}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "briefings" ? (
          <section className="grid gap-5">
            <Card className="p-5">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-green-400">
                    Briefing Center
                  </div>
                  <h2 className="mt-2 text-3xl font-black text-white">Research notes command center</h2>
                  <p className="mt-2 max-w-5xl text-sm leading-7 text-slate-400">
                    Create advisor briefings for internal decision-making and client/investor briefings for approval-ready communication. Each generated note is interval-based, source-backed, and designed to move from local context to broader U.S. and global risks.
                  </p>
                </div>

                <div className="grid gap-2 md:grid-cols-4 xl:min-w-[620px]">
                  <MetricBubble label="Schedules" value={schedules.length} helper={`${data?.stats.briefingStats.activeSchedules ?? 0} active`} tone="green" />
                  <MetricBubble label="Due Now" value={dueSchedules.length} helper="Need update" tone={dueSchedules.length ? "red" : "slate"} />
                  <MetricBubble label="Advisor Notes" value={advisorBriefings.length} helper="Generated" tone="purple" />
                  <MetricBubble label="Client Drafts" value={clientBriefings.length} helper="Approval queue" tone="cyan" />
                </div>
              </div>
            </Card>

            <Card className="p-3">
              <div className="grid gap-2 md:grid-cols-5">
                {briefingSubViews.map((tab) => (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setBriefingSubView(tab.id)}
                    className={cx(
                      "rounded-2xl px-4 py-3 text-left transition",
                      briefingSubView === tab.id
                        ? "bg-white text-slate-950 shadow-lg shadow-black/20"
                        : "border border-white/10 bg-white/[0.045] text-white hover:bg-white/10"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-sm font-black">{tab.label}</div>
                      <span
                        className={cx(
                          "h-2 w-2 rounded-full",
                          tab.tone === "red"
                            ? "bg-emerald-400"
                            : tab.tone === "cyan"
                              ? "bg-cyan-400"
                              : tab.tone === "purple"
                                ? "bg-purple-400"
                                : tab.tone === "green"
                                  ? "bg-emerald-400"
                                  : tab.tone === "amber"
                                    ? "bg-amber-400"
                                    : "bg-slate-400"
                        )}
                      />
                    </div>
                    <div className="mt-1 text-[10px] font-bold text-slate-500">{tab.helper}</div>
                  </button>
                ))}
              </div>
            </Card>

            {briefingSubView === "studio" ? (
              <section className="grid gap-5 xl:grid-cols-[520px_minmax(0,1fr)]">
                <Card className="p-5">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-green-400">
                    Briefing builder
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white">Build an interval-based briefing</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Choose audience, scope, interval, topics, commodities, and custom instructions. Advisor briefings can include internal action items; client/investor briefings are saved as approval-ready drafts.
                  </p>

                  {canManage ? (
                    <form onSubmit={createBriefingSchedule} className="mt-5 grid gap-3">
                      <div className="grid gap-3 md:grid-cols-2">
                        <select
                          value={briefingForm.audienceType}
                          onChange={(event) =>
                            setBriefingForm((current) => ({
                              ...current,
                              audienceType: event.target.value as "Advisor" | "Client/Investor",
                              recipientLabel: event.target.value === "Advisor" ? "Advisor Team" : "Client/Investor List",
                            }))
                          }
                          className={selectClass}
                        >
                          <option>Advisor</option>
                          <option>Client/Investor</option>
                        </select>

                        <input
                          type="number"
                          min={1}
                          max={168}
                          value={briefingForm.intervalHours}
                          onChange={(event) => setBriefingForm((current) => ({ ...current, intervalHours: Number(event.target.value) }))}
                          placeholder="Interval hours"
                          className={inputClass}
                        />
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <input value={briefingForm.localFocus} onChange={(event) => setBriefingForm((current) => ({ ...current, localFocus: event.target.value }))} placeholder="Local focus, e.g. Phoenix, Arizona" className={inputClass} />
                        <select value={briefingForm.scope} onChange={(event) => setBriefingForm((current) => ({ ...current, scope: event.target.value as any }))} className={selectClass}>
                          <option>Local</option>
                          <option>U.S.</option>
                          <option>Global</option>
                          <option>Local → Global</option>
                        </select>
                      </div>

                      <div className="grid gap-3 md:grid-cols-2">
                        <select value={briefingForm.deliveryChannel} onChange={(event) => setBriefingForm((current) => ({ ...current, deliveryChannel: event.target.value as any }))} className={selectClass}>
                          <option>Email</option>
                          <option>Dashboard</option>
                          <option>Both</option>
                        </select>
                        <input value={briefingForm.recipientLabel} onChange={(event) => setBriefingForm((current) => ({ ...current, recipientLabel: event.target.value }))} placeholder="Recipient label" className={inputClass} />
                      </div>

                      <input value={briefingForm.tone} onChange={(event) => setBriefingForm((current) => ({ ...current, tone: event.target.value }))} placeholder="Tone" className={inputClass} />
                      <textarea value={briefingForm.commodities} onChange={(event) => setBriefingForm((current) => ({ ...current, commodities: event.target.value }))} placeholder="Commodities/minerals/energy to monitor" className={cx(inputClass, "min-h-20")} />
                      <textarea value={briefingForm.globalTopics} onChange={(event) => setBriefingForm((current) => ({ ...current, globalTopics: event.target.value }))} placeholder="Global topics: wars, tariffs, uprisings, strikes, sanctions..." className={cx(inputClass, "min-h-24")} />
                      <textarea value={briefingForm.advisorInstructions} onChange={(event) => setBriefingForm((current) => ({ ...current, advisorInstructions: event.target.value }))} placeholder="Custom advisor instructions" className={cx(inputClass, "min-h-24")} />

                      <div className="grid gap-2 md:grid-cols-2">
                        {[
                          ["includeMarket", "Markets"],
                          ["includeEconomy", "Economy"],
                          ["includeCrypto", "Crypto"],
                          ["includeAlternatives", "Alternatives"],
                          ["includeCommodities", "Commodities"],
                          ["includeEnergy", "Energy"],
                          ["includeMinerals", "Minerals"],
                          ["includeGeopolitics", "Geopolitics"],
                          ["includeTariffs", "Tariffs"],
                          ["includeLabor", "Labor / strikes"],
                          ["includeVenture", "Venture"],
                        ].map(([key, label]) => (
                          <label key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-slate-300">
                            {label}
                            <input
                              type="checkbox"
                              checked={Boolean((briefingForm as any)[key])}
                              onChange={(event) => setBriefingForm((current) => ({ ...current, [key]: event.target.checked }))}
                            />
                          </label>
                        ))}
                      </div>

                      <div className="grid gap-2 md:grid-cols-2">
                        <button disabled={saving} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-60">
                          Save Schedule
                        </button>
                        <button type="button" onClick={() => generateBriefing()} disabled={saving} className="rounded-2xl border border-green-500/30 bg-green-500/10 px-5 py-3 text-sm font-black text-green-100 disabled:opacity-60">
                          Generate Now
                        </button>
                      </div>
                    </form>
                  ) : (
                    <div className="mt-5 rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-sm text-slate-400">
                      You can view briefings, but only owners/admins/project managers can schedule or generate them.
                    </div>
                  )}
                </Card>

                <div className="grid gap-5">
                  <BriefingQualityPanel qualityScore={qualityScore} qualityIssues={qualityIssues} briefingForm={briefingForm} />

                  <BriefingStudioGuide />

                  {generatedText ? (
                    <Card className="p-5">
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <Pill tone="green">Latest generated briefing</Pill>
                          <h3 className="mt-3 text-2xl font-black text-white">Generated draft preview</h3>
                        </div>
                        <button onClick={() => navigator.clipboard.writeText(generatedText)} className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950">
                          Copy
                        </button>
                      </div>
                      <pre className="mt-4 max-h-[520px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/45 p-4 text-sm leading-7 text-slate-300">
                        {generatedText}
                      </pre>
                    </Card>
                  ) : null}
                </div>
              </section>
            ) : null}

            {briefingSubView === "schedules" ? (
              <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
                <Card className="p-5">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-purple-400">Schedule command</div>
                  <h2 className="mt-2 text-2xl font-black text-white">Briefing interval control</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Active schedules define how often each advisor or client/investor briefing should be generated. Due schedules can be generated immediately.
                  </p>

                  <div className="mt-5 grid gap-3">
                    <MetricBubble label="Total schedules" value={schedules.length} tone="purple" />
                    <MetricBubble label="Active" value={schedules.filter((item) => item.status === "Active").length} tone="green" />
                    <MetricBubble label="Paused" value={schedules.filter((item) => item.status !== "Active").length} tone="slate" />
                    <MetricBubble label="Due now" value={dueSchedules.length} tone={dueSchedules.length ? "red" : "slate"} />
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="grid gap-4">
                    {schedules.length ? (
                      schedules.map((schedule) => (
                        <BriefingScheduleCard
                          key={schedule.id}
                          schedule={schedule}
                          disabled={saving || !canManage}
                          onGenerate={generateBriefing}
                          onStatus={updateBriefingScheduleStatus}
                        />
                      ))
                    ) : (
                      <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                        No briefing schedules yet.
                      </div>
                    )}
                  </div>
                </Card>
              </section>
            ) : null}

            {briefingSubView === "advisor-notes" ? (
              <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
                <Card className="p-5">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-purple-400">Advisor briefings</div>
                  <h2 className="mt-2 text-2xl font-black text-white">Internal research notes</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Advisor notes can include internal strategy, suitability reminders, and action items before any client-facing draft is created.
                  </p>

                  <div className="mt-5 grid gap-3">
                    <MetricBubble label="Generated" value={advisorBriefings.length} tone="purple" />
                    <MetricBubble label="Schedules" value={advisorSchedules.length} tone="green" />
                    <MetricBubble label="Due Now" value={advisorSchedules.filter((item) => nextRunLabel(item) === "Due now").length} tone="red" />
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="grid gap-4">
                    {advisorBriefings.length ? (
                      advisorBriefings.map((briefing) => (
                        <BriefingDraftCard
                          key={briefing.id}
                          kind="Advisor"
                          title={briefing.title}
                          body={briefing.summary}
                          createdAt={briefing.createdAt}
                          status={briefing.status}
                          sources={safeJson(briefing.sourceItemsJson, [])}
                          complianceNotes={safeJson(briefing.actionsJson, [])}
                        />
                      ))
                    ) : (
                      <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                        No advisor briefings generated yet.
                      </div>
                    )}
                  </div>
                </Card>
              </section>
            ) : null}

            {briefingSubView === "client-drafts" ? (
              <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
                <Card className="p-5">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">Client / investor briefings</div>
                  <h2 className="mt-2 text-2xl font-black text-white">Approval-ready drafts</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Client and investor briefings should be simpler, compliance-conscious, and approved by the advisor before delivery.
                  </p>

                  <div className="mt-5 grid gap-3">
                    <MetricBubble label="Drafts" value={clientBriefings.length} tone="cyan" />
                    <MetricBubble label="Schedules" value={clientSchedules.length} tone="green" />
                    <MetricBubble label="Due Now" value={clientSchedules.filter((item) => nextRunLabel(item) === "Due now").length} tone="red" />
                  </div>
                </Card>

                <Card className="p-5">
                  <div className="grid gap-4">
                    {clientBriefings.length ? (
                      clientBriefings.map((briefing) => (
                        <BriefingDraftCard
                          key={briefing.id}
                          kind="Client/Investor"
                          title={briefing.title}
                          body={briefing.body}
                          createdAt={briefing.createdAt}
                          status={briefing.status}
                          sources={safeJson(briefing.sourceSummaryJson, [])}
                          complianceNotes={safeJson(briefing.complianceNotesJson, [])}
                        />
                      ))
                    ) : (
                      <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-400">
                        No client/investor briefings generated yet.
                      </div>
                    )}
                  </div>
                </Card>
              </section>
            ) : null}

            {briefingSubView === "quality" ? (
              <section className="grid gap-5 xl:grid-cols-[1fr_430px]">
                <Card className="p-6">
                  <BriefingQualityPanel qualityScore={qualityScore} qualityIssues={qualityIssues} briefingForm={briefingForm} />

                  <div className="mt-5 grid gap-4 xl:grid-cols-3">
                    <Panel tone="green" className="bg-black/35">
                      <div className="text-lg font-black text-white">Interval discipline</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Briefings should only use events captured between the last run and the current run. This avoids stale news and keeps updates relevant.
                      </p>
                    </Panel>

                    <Panel tone="cyan" className="bg-black/35">
                      <div className="text-lg font-black text-white">Source verification</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Every generated briefing stores a source list so the advisor can inspect events before forwarding or acting on them.
                      </p>
                    </Panel>

                    <Panel tone="red" className="bg-black/35">
                      <div className="text-lg font-black text-white">External approval</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        Client/investor drafts should remain drafts until an advisor reviews suitability, risk language, and source quality.
                      </p>
                    </Panel>
                  </div>
                </Card>

                <Card className="p-6">
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-400">Briefing checklist</div>
                  <h2 className="mt-2 text-2xl font-black text-white">Before sending</h2>

                  <div className="mt-5 grid gap-3">
                    {[
                      "Confirm all included events happened inside the chosen interval.",
                      "Check source credibility before sending to clients or investors.",
                      "Remove advisor-only action items from client/investor drafts.",
                      "Avoid guarantees, performance promises, or automatic recommendations.",
                      "Explain crypto, venture, and penny-stock risk in plain language.",
                      "Confirm client suitability before discussing alternatives.",
                      "Use the source list to support any market claims.",
                    ].map((item) => (
                      <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-sm leading-6 text-slate-300">
                        {item}
                      </div>
                    ))}
                  </div>
                </Card>
              </section>
            ) : null}
          </section>
        ) : null}

        {activeView === "risk" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_430px]">
            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-emerald-400">Risk framework</div>
              <h2 className="mt-2 text-3xl font-black text-white">Make risky trends less blind</h2>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-400">
                The goal is not to make crypto, penny stocks, venture, or alternative briefings safe. The goal is to make the risk visible, documented, comparable, source-backed, and controlled before any advisor discusses the idea.
              </p>

              <div className="mt-6 grid gap-4">
                {(data?.riskFramework ?? []).map((item) => (
                  <Panel key={item.label} tone={toneForStatus(item.riskLevel)} className="bg-black/35">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <Pill tone={toneForStatus(item.riskLevel)}>{item.riskLevel}</Pill>
                        <h3 className="mt-3 text-2xl font-black text-white">{item.label}</h3>
                      </div>
                    </div>

                    <div className="mt-4 grid gap-4 lg:grid-cols-2">
                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Primary risks</div>
                        <p className="mt-2 text-sm leading-6 text-emerald-50/80">{item.primaryRisks}</p>
                      </div>

                      <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4">
                        <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Risk mitigation</div>
                        <p className="mt-2 text-sm leading-6 text-emerald-50/80">{item.mitigation}</p>
                      </div>
                    </div>
                  </Panel>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-400">Advisor checklist</div>
              <h2 className="mt-2 text-2xl font-black text-white">Before discussion</h2>

              <div className="mt-5 grid gap-3">
                {[
                  "Document why this alternative belongs in the client conversation.",
                  "Verify liquidity, custody, execution venue, and pricing source.",
                  "Add risk notes before marking a penny stock as Active Review.",
                  "Require venture deck, image, revenue model, moat, traction, and next diligence step.",
                  "Use maximum position limits and client suitability notes for all speculative assets.",
                  "For briefings, include only events captured between update intervals.",
                  "Never present scores as guarantees or automated recommendations.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-sm leading-6 text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}