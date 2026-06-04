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
    averageComposite: number;
  };
};

type Tone = "red" | "green" | "amber" | "slate" | "purple" | "cyan";

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

function dollars(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  return `$${value.toFixed(2)}`;
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
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/72 shadow-xl shadow-red-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
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
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        tones[tone]
      )}
    >
      {children}
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
          Opportunity + Technical Radar
        </div>
      </div>
    </div>
  );
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
        <div className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
          {label}
        </div>
        <div className="mt-1 text-3xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 text-xs font-semibold text-slate-500">{helper}</div> : null}
      </div>
    </Card>
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
          <line x1="0" x2={width} y1={priceY(priceMax)} y2={priceY(priceMax)} stroke="rgba(255,255,255,.08)" />
          <line x1="0" x2={width} y1={priceY(priceMin)} y2={priceY(priceMin)} stroke="rgba(255,255,255,.08)" />
          <line x1="0" x2={width} y1={priceHeight + gap} y2={priceHeight + gap} stroke="rgba(255,255,255,.18)" />
          <line x1="0" x2={width} y1={rsiY(70)} y2={rsiY(70)} stroke="rgba(251,191,36,.35)" strokeDasharray="4 5" />
          <line x1="0" x2={width} y1={rsiY(30)} y2={rsiY(30)} stroke="rgba(251,191,36,.35)" strokeDasharray="4 5" />

          <path d={closePath} fill="none" stroke="rgba(248,113,113,.95)" strokeWidth="3" />
          {sma20Path ? <path d={sma20Path} fill="none" stroke="rgba(52,211,153,.95)" strokeWidth="2" /> : null}
          {sma50Path ? <path d={sma50Path} fill="none" stroke="rgba(168,85,247,.95)" strokeWidth="2" /> : null}
          {rsiPath ? <path d={rsiPath} fill="none" stroke="rgba(251,191,36,.95)" strokeWidth="2" /> : null}

          <text x="6" y="14" fill="rgba(203,213,225,.9)" fontSize="12">
            ${priceMax.toFixed(2)}
          </text>
          <text x="6" y={priceHeight - 4} fill="rgba(203,213,225,.9)" fontSize="12">
            ${priceMin.toFixed(2)}
          </text>
          <text x="6" y={rsiY(70) - 5} fill="rgba(251,191,36,.8)" fontSize="12">
            RSI 70
          </text>
          <text x="6" y={rsiY(30) - 5} fill="rgba(251,191,36,.8)" fontSize="12">
            RSI 30
          </text>
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
    <div className="grid gap-3 md:grid-cols-4">
      {items.map(([label, value, tone]) => (
        <div
          key={`${payload.symbol}-${label}`}
          className={cx(
            "rounded-2xl border p-4",
            tone === "red" && "border-red-500/20 bg-red-500/10",
            tone === "green" && "border-emerald-500/20 bg-emerald-500/10",
            tone === "amber" && "border-amber-500/20 bg-amber-500/10",
            tone === "purple" && "border-purple-500/20 bg-purple-500/10",
            tone === "cyan" && "border-cyan-500/20 bg-cyan-500/10",
            tone === "slate" && "border-white/10 bg-black/30"
          )}
        >
          <div className="text-xs font-black uppercase text-slate-500">{label}</div>
          <div className="mt-1 truncate text-lg font-black text-white">{value}</div>
        </div>
      ))}
    </div>
  );
}

export default function OpportunityRadarPage() {
  const [data, setData] = useState<RadarResponse | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [activeView, setActiveView] = useState<"all" | "technical" | "headline">("all");
  const [technicalForm, setTechnicalForm] = useState({
    indexUniverse: "sp100" as TechnicalUniverseId,
    customSymbols: "",
    limit: 80,
    minCompositeScore: 72,
  });

  const openSignals = useMemo(() => {
    const signals = data?.signals.filter((signal) => signal.status === "Open") ?? [];

    if (activeView === "technical") {
      return signals.filter((signal) => signal.signalType === "Technical Opportunity");
    }

    if (activeView === "headline") {
      return signals.filter((signal) => signal.signalType !== "Technical Opportunity");
    }

    return signals;
  }, [data, activeView]);

  const technicalSignals = useMemo(() => {
    return data?.signals.filter((signal) => signal.signalType === "Technical Opportunity") ?? [];
  }, [data]);

  const headlineSignals = useMemo(() => {
    return data?.signals.filter((signal) => signal.signalType !== "Technical Opportunity") ?? [];
  }, [data]);

  async function loadData() {
    const response = await fetch("/api/opportunities", {
      cache: "no-store",
    });

    if (response.ok) {
      setData(await response.json());
    }
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

      await loadData();
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
        `News opportunity radar updated: ${result.created} created, ${result.updated} updated, ${result.skipped} skipped.`
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
    });

    if (result) {
      setActiveView("technical");
      setMessage(
        `Technical scan complete: ${result.scanned} scanned, ${result.qualified} qualified, ${result.created} created, ${result.updated} updated, ${result.alerted} alerts.`
      );
    }
  }

  async function runFullScan() {
    setLoading(true);
    setMessage("");

    try {
      const triage = await fetch(
        `/api/intelligence/triage/run?technicals=1&technicalUniverse=${technicalForm.indexUniverse}`,
        {
          method: "POST",
        }
      );

      const triageData = await triage.json();

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
      });

      if (!result) return;

      setMessage(
        `Full stack scan complete: headline opportunities refreshed and technical scan found ${result.technical.qualified} qualifying setups from ${result.technical.scanned} securities.`
      );

      await loadData();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Full scan failed.");
    } finally {
      setLoading(false);
    }
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
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.16),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto max-w-[1500px]">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-black/60 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl lg:flex-row lg:items-center lg:justify-between">
          <Logo />

          <div className="flex flex-wrap gap-3">
            <a
              href="/workspace"
              className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
            >
              Workspace
            </a>

            <a
              href="/triage"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Triage
            </a>

            <a
              href="/portfolio-lab"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Portfolio
            </a>

            <button
              onClick={generateSignals}
              disabled={loading}
              className="rounded-2xl bg-red-500/10 px-4 py-3 font-black text-red-300 ring-1 ring-red-500/30 disabled:opacity-60"
            >
              Refresh News Signals
            </button>

            <button
              onClick={runFullScan}
              disabled={loading}
              className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
            >
              Run Full Headline + Technical Scan
            </button>
          </div>
        </header>

        {message ? (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        ) : null}

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
          <Card className="p-6">
            <Pill tone="cyan">Headline + technical intelligence</Pill>
            <h1 className="mt-4 text-4xl font-black tracking-tight md:text-5xl">
              Opportunity Radar
            </h1>
            <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-400">
              This module combines retained source-backed headlines with technical scans across
              operator-selected stock universes. Only securities that clear the enhanced technical
              algorithm are stored as opportunities.
            </p>

            <div className="mt-6 grid gap-3 md:grid-cols-4">
              <StatCard label="Open" value={data?.stats.open ?? "—"} helper="Active signals" tone="amber" />
              <StatCard label="Technical" value={data?.technical?.open ?? "—"} helper="Open technical setups" tone="cyan" />
              <StatCard label="High Conviction" value={data?.technical?.highConviction ?? "—"} helper="Technical high/critical" tone="green" />
              <StatCard label="Avg Technical" value={data?.technical?.averageComposite ?? "—"} helper="Composite score" tone="purple" />
            </div>
          </Card>

          <Card className="p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                  Technical Scan Operator
                </div>
                <h2 className="mt-2 text-2xl font-black">Index + enhanced RSI</h2>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Choose the equity universe. The scanner evaluates RSI 7/14/21,
                  RSI recovery, RSI divergence, trend stabilization, liquidity, relative strength,
                  valuation sanity, and risk controls.
                </p>
              </div>
              <Pill tone="cyan">Nonstop compatible</Pill>
            </div>

            <form onSubmit={runTechnicalScan} className="mt-5 grid gap-3">
              <div className="grid gap-3 md:grid-cols-3">
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

                <label className="grid gap-2">
                  <span className="text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                    Limit
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
              </div>

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

              <button
                disabled={loading}
                className="rounded-2xl bg-cyan-500/10 px-5 py-3 text-sm font-black text-cyan-100 ring-1 ring-cyan-500/30 disabled:opacity-50"
              >
                {loading ? "Scanning..." : "Run Technical Opportunity Scan"}
              </button>
            </form>
          </Card>
        </section>

        <section className="mt-5 grid gap-3 md:grid-cols-6">
          <StatCard label="Total" value={data?.stats.total ?? "—"} tone="slate" />
          <StatCard label="Open" value={data?.stats.open ?? "—"} tone="amber" />
          <StatCard label="Critical" value={data?.stats.critical ?? "—"} tone="red" />
          <StatCard label="High" value={data?.stats.high ?? "—"} tone="amber" />
          <StatCard label="Protect" value={data?.stats.protect ?? "—"} tone="red" />
          <StatCard label="Opportunity" value={data?.stats.opportunity ?? "—"} tone="green" />
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[360px_1fr]">
          <Card className="p-5">
            <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
              Signal Views
            </div>
            <h2 className="mt-2 text-2xl font-black">Filter radar</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Separate headline opportunities from technical opportunities while keeping both in one advisor workflow.
            </p>

            <div className="mt-5 grid gap-2">
              {[
                ["all", "All Open Signals", data?.stats.open ?? 0, "slate"],
                ["technical", "Technical Setups", technicalSignals.filter((signal) => signal.status === "Open").length, "cyan"],
                ["headline", "Headline Signals", headlineSignals.filter((signal) => signal.status === "Open").length, "red"],
              ].map(([key, label, count, tone]) => (
                <button
                  key={String(key)}
                  onClick={() => setActiveView(key as "all" | "technical" | "headline")}
                  className={cx(
                    "rounded-2xl border px-4 py-3 text-left transition",
                    activeView === key
                      ? "border-white/25 bg-white text-slate-950"
                      : "border-white/10 bg-white/[0.045] text-white hover:bg-white/[0.08]"
                  )}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div>
                      <div className="text-sm font-black">{label}</div>
                      <div className={cx("mt-1 text-xs", activeView === key ? "text-slate-600" : "text-slate-500")}>
                        {String(count)} open
                      </div>
                    </div>
                    <Pill tone={tone as Tone}>{String(count)}</Pill>
                  </div>
                </button>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-xs leading-6 text-amber-100/80">
              Technical opportunities are screening outputs for advisor review. They are
              not automatic buy recommendations and should be confirmed against
              fundamentals, valuation, client suitability, tax impact, and headline risk.
            </div>
          </Card>

          <Card className="p-5">
            <h2 className="text-2xl font-black">Open Opportunity Signals</h2>

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
                            <Pill tone={signalTone(signal.signalType)}>
                              {signal.signalType}
                            </Pill>
                            <Pill tone={tierTone(signal.priorityTier)}>
                              {signal.priorityTier}
                            </Pill>
                            <Pill tone="slate">{signal.sourceName}</Pill>
                          </div>

                          <h3 className="mt-4 text-2xl font-black">
                            {signal.title}
                          </h3>

                          <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
                            {signal.summary || "No summary stored."}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2">
                            {tickers.map((ticker, tickerIndex) => (
                              <Pill
                                key={`${signal.id}-ticker-${tickerIndex}-${String(ticker)}`}
                                tone={isTechnical ? "cyan" : "red"}
                              >
                                {String(ticker)}
                              </Pill>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-center">
                          <div className="text-xs font-black uppercase text-red-300">
                            Composite
                          </div>
                          <div className="text-4xl font-black">
                            {signal.compositeScore}
                          </div>
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
                          <div
                            key={`${signal.id}-score-${String(label)}`}
                            className={cx(
                              "rounded-2xl border p-4",
                              scoreTone(Number(value)) === "green" && "border-emerald-500/20 bg-emerald-500/10",
                              scoreTone(Number(value)) === "cyan" && "border-cyan-500/20 bg-cyan-500/10",
                              scoreTone(Number(value)) === "amber" && "border-amber-500/20 bg-amber-500/10",
                              scoreTone(Number(value)) === "slate" && "border-white/10 bg-black/30"
                            )}
                          >
                            <div className="text-xs font-black uppercase text-slate-500">
                              {label}
                            </div>
                            <div className="mt-1 text-2xl font-black">
                              {String(value)}
                            </div>
                          </div>
                        ))}
                      </div>

                      <div className="mt-5 rounded-2xl border border-white/10 bg-black/30 p-4">
                        <div className="text-xs font-black uppercase text-slate-500">
                          Suggested advisor action
                        </div>
                        <p className="mt-2 text-sm leading-7 text-slate-300">
                          {signal.suggestedAction}
                        </p>
                      </div>

                      {signal.advisorNotes ? (
                        <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/10 p-4">
                          <div className="text-xs font-black uppercase text-cyan-300">
                            Advisor notes
                          </div>
                          <p className="mt-2 whitespace-pre-wrap text-sm leading-7 text-cyan-50/80">
                            {signal.advisorNotes}
                          </p>
                        </div>
                      ) : null}

                      <div className="mt-5 grid gap-4 md:grid-cols-2">
                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-xs font-black uppercase text-slate-500">
                            Categories
                          </div>
                          <div className="mt-2 flex flex-wrap gap-2">
                            {categories.slice(0, 10).map((category, categoryIndex) => (
                              <Pill
                                key={`${signal.id}-category-${categoryIndex}-${String(category)}`}
                                tone="purple"
                              >
                                {String(category)}
                              </Pill>
                            ))}
                          </div>
                        </div>

                        <div className="rounded-2xl border border-white/10 bg-black/30 p-4">
                          <div className="text-xs font-black uppercase text-slate-500">
                            Evidence
                          </div>
                          <ul className="mt-2 space-y-1">
                            {evidence.slice(0, 10).map((item, evidenceIndex) => (
                              <li
                                key={`${signal.id}-evidence-${evidenceIndex}-${item}`}
                                className="text-sm text-slate-400"
                              >
                                • {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>

                      <div className="mt-5 flex flex-wrap gap-3">
                        <button
                          onClick={() => updateStatus(signal.id, "Reviewed")}
                          className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
                        >
                          Mark Reviewed
                        </button>

                        <button
                          onClick={() => updateStatus(signal.id, "Action Needed")}
                          className="rounded-2xl bg-red-500/10 px-4 py-3 font-black text-red-300 ring-1 ring-red-500/30"
                        >
                          Mark Action Needed
                        </button>

                        <button
                          onClick={() => updateStatus(signal.id, "Dismissed")}
                          className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
                        >
                          Dismiss
                        </button>
                      </div>
                    </article>
                  );
                })
              )}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}