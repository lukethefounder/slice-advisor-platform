"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  GitBranch,
  Globe2,
  Layers3,
  Network,
  Newspaper,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
  Wifi,
  WifiOff,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import ResearchKnowledgeGraphCanvas from "@/components/intelligence/research-knowledge-graph";
import type {
  ResearchCohort,
  ResearchEvidence,
  ResearchSwarmResponse,
} from "@/lib/intelligence/research-swarm-types";
import type { ForecastResponse } from "@/lib/intelligence-forecast/types";

type ForecastWithPersistence = ForecastResponse & {
  persistence?: {
    status: string;
    runId: string;
    storedAt: string;
  };
};

type BehavioralSimulation = {
  simulationId: string;
  configuration: {
    paths: number;
    seed: number;
    agentCount: number;
    horizonCount: number;
  };
  horizons: Array<{
    horizon: string;
    label: string;
    positiveReturnProbability: number;
    meanReturnPercent: number;
    crashProbability: number;
    rallyProbability: number;
    agentAgreementPercent: number;
  }>;
};

type Stage =
  | "idle"
  | "research"
  | "forecast"
  | "simulation"
  | "complete"
  | "error";

const panelClass =
  "rounded-[1.75rem] border border-white/10 bg-black/58 shadow-2xl shadow-black/40 backdrop-blur-xl";

const COHORT_META: Record<
  ResearchCohort,
  {
    title: string;
    shortTitle: string;
    subtitle: string;
    tone: "orange" | "cyan" | "purple";
    icon: ReactNode;
  }
> = {
  media: {
    title: "Media Research",
    shortTitle: "Media",
    subtitle: "News, filings, credibility, narrative velocity, and contradiction checks",
    tone: "orange",
    icon: <Newspaper className="h-5 w-5" />,
  },
  technical: {
    title: "Technical Research",
    shortTitle: "Technical",
    subtitle: "Quotes, intraday flow, volatility, fundamentals, and trend structure",
    tone: "cyan",
    icon: <Activity className="h-5 w-5" />,
  },
  economy: {
    title: "Industry Economy",
    shortTitle: "Economy",
    subtitle: "Rates, inflation, labor, demand, commodities, and industry sensitivity",
    tone: "purple",
    icon: <Globe2 className="h-5 w-5" />,
  },
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function number(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function compact(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  });
}

function currency(value: number | null | undefined, currencyCode = "USD") {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
    maximumFractionDigits: value >= 100 ? 2 : 4,
  });
}

function signedPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${value > 0 ? "+" : ""}${number(value, 2)}%`;
}

function dateTime(value?: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime()) ? parsed.toLocaleString() : value;
}

function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "green" | "red" | "amber" | "cyan" | "purple" | "orange" | "slate";
}) {
  const colors = {
    green: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    red: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-400/25 bg-amber-500/10 text-amber-100",
    cyan: "border-cyan-400/25 bg-cyan-500/10 text-cyan-100",
    purple: "border-purple-400/25 bg-purple-500/10 text-purple-100",
    orange: "border-orange-400/25 bg-orange-500/10 text-orange-100",
    slate: "border-white/10 bg-white/[0.05] text-slate-300",
  } as const;

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em]",
        colors[tone],
      )}
    >
      {children}
    </span>
  );
}

function Progress({
  value,
  tone = "red",
}: {
  value: number;
  tone?: "red" | "green" | "amber" | "cyan" | "purple" | "orange";
}) {
  const colors = {
    red: "from-emerald-500 to-emerald-800",
    green: "from-emerald-400 to-emerald-700",
    amber: "from-amber-300 to-amber-700",
    cyan: "from-cyan-400 to-cyan-700",
    purple: "from-purple-400 to-purple-700",
    orange: "from-orange-400 to-orange-700",
  } as const;

  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className={cx("h-full rounded-full bg-gradient-to-r", colors[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
  icon,
  tone = "red",
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
  tone?: "red" | "green" | "amber" | "cyan" | "purple" | "orange";
}) {
  const iconColors = {
    red: "border-emerald-400/15 bg-emerald-500/[0.06] text-emerald-300",
    green: "border-emerald-400/15 bg-emerald-500/[0.06] text-emerald-300",
    amber: "border-amber-400/15 bg-amber-500/[0.06] text-amber-300",
    cyan: "border-cyan-400/15 bg-cyan-500/[0.06] text-cyan-300",
    purple: "border-purple-400/15 bg-purple-500/[0.06] text-purple-300",
    orange: "border-orange-400/15 bg-orange-500/[0.06] text-orange-300",
  } as const;

  return (
    <div className={cx(panelClass, "p-4")}> 
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
            {label}
          </p>
          <p className="mt-2 text-2xl font-black text-white">{value}</p>
        </div>
        <div className={cx("grid h-10 w-10 place-items-center rounded-2xl border", iconColors[tone])}>
          {icon}
        </div>
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
        {helper}
      </p>
    </div>
  );
}

function ScoreDial({
  score,
  confidence,
  label,
}: {
  score: number;
  confidence: number;
  label: string;
}) {
  const degrees = Math.max(0, Math.min(100, score)) * 3.6;

  return (
    <div className="grid place-items-center">
      <div
        className="grid h-60 w-60 place-items-center rounded-full p-3 shadow-[0_0_90px_rgba(4,120,87,0.28)]"
        style={{
          background: `conic-gradient(#10b981 0deg, #065f46 ${degrees}deg, rgba(255,255,255,0.07) ${degrees}deg 360deg)`,
        }}
      >
        <div className="grid h-full w-full place-items-center rounded-full border border-white/10 bg-[#050505] text-center">
          <div>
            <p className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-300">
              Agentic Slice Score
            </p>
            <p className="mt-2 text-6xl font-black tracking-[-0.06em] text-white">
              {number(score, 1)}
            </p>
            <p className="mt-1 text-sm font-black text-white">{label}</p>
            <p className="mt-2 text-xs font-bold text-slate-500">
              {number(confidence, 0)}% confidence
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: ResearchEvidence }) {
  return (
    <article className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Badge
          tone={
            evidence.polarity === "positive"
              ? "green"
              : evidence.polarity === "negative"
                ? "red"
                : "slate"
          }
        >
          {evidence.polarity}
        </Badge>
        <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-600">
          {evidence.source}
        </span>
      </div>
      <h3 className="mt-3 line-clamp-2 text-sm font-black leading-5 text-white">
        {evidence.title}
      </h3>
      <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-slate-500">
        {evidence.summary || "No summary was returned."}
      </p>
      <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[10px] font-black">
        <div className="rounded-xl border border-white/8 bg-black/25 p-2">
          <p className="text-slate-700">Score</p>
          <p className="mt-1 text-white">{number(evidence.score, 0)}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-black/25 p-2">
          <p className="text-slate-700">Confidence</p>
          <p className="mt-1 text-white">{number(evidence.confidence, 0)}</p>
        </div>
        <div className="rounded-xl border border-white/8 bg-black/25 p-2">
          <p className="text-slate-700">Freshness</p>
          <p className="mt-1 text-white">{number(evidence.freshnessScore, 0)}</p>
        </div>
      </div>
      {evidence.sourceUrl ? (
        <a
          href={evidence.sourceUrl}
          target="_blank"
          rel="noreferrer"
          className="mt-3 inline-flex items-center gap-2 text-xs font-black text-emerald-300 hover:text-emerald-200"
        >
          Open source
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </article>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  });
  const body = (await response.json()) as T & {
    error?: string;
    detail?: string;
  };

  if (!response.ok) {
    throw new Error(
      body.detail || body.error || `Request failed with HTTP ${response.status}.`,
    );
  }

  return body;
}

export default function IntelligenceControlPlanePage() {
  const [symbolInput, setSymbolInput] = useState("MSFT");
  const [activeSymbol, setActiveSymbol] = useState("MSFT");
  const [agentCount, setAgentCount] = useState(2_000);
  const [swarm, setSwarm] = useState<ResearchSwarmResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastWithPersistence | null>(null);
  const [simulation, setSimulation] = useState<BehavioralSimulation | null>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [message, setMessage] = useState("Ready to run the real-time research swarm.");

  const runSwarm = useCallback(
    async (requestedSymbol: string, requestedAgentCount: number, quiet = false) => {
      if (!quiet) {
        setStage("research");
        setMessage(
          `Running ${requestedAgentCount.toLocaleString()} research pathways for ${requestedSymbol}.`,
        );
      }

      const body = await fetchJson<ResearchSwarmResponse>(
        "/api/intelligence/research-swarm",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            symbol: requestedSymbol,
            agentCount: requestedAgentCount,
            simulationPaths: 750,
            graphMode: quiet ? "summary" : "full",
            detailMode: quiet ? "summary" : "graph",
            persistGraph: true,
          }),
        },
      );
      setSwarm(body);

      if (!quiet) {
        setStage("idle");
        setMessage(
          `${body.activeAgents.toLocaleString()} pathways completed with ${body.graph.nodeCount.toLocaleString()} knowledge nodes.`,
        );
      }

      return body;
    },
    [],
  );

  useEffect(() => {
    void runSwarm("MSFT", 2_000).catch((error: unknown) => {
      setStage("error");
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to initialize the research swarm.",
      );
    });
  }, [runSwarm]);

  useEffect(() => {
    if (!autoRefresh) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        void runSwarm(activeSymbol, agentCount, true).catch(() => undefined);
      }
    }, 45_000);

    return () => window.clearInterval(timer);
  }, [activeSymbol, agentCount, autoRefresh, runSwarm]);

  async function runRequestedSwarm() {
    const symbol = symbolInput.trim().toUpperCase() || activeSymbol;
    setActiveSymbol(symbol);

    try {
      await runSwarm(symbol, agentCount);
    } catch (error) {
      setStage("error");
      setMessage(error instanceof Error ? error.message : "Research swarm failed.");
    }
  }

  async function runCompleteCycle() {
    const symbol = symbolInput.trim().toUpperCase() || activeSymbol;
    setActiveSymbol(symbol);

    try {
      const research = await runSwarm(symbol, agentCount);
      setStage("forecast");
      setMessage("Research complete. Generating the stored forecast surface.");
      const nextForecast = await fetchJson<ForecastWithPersistence>(
        "/api/intelligence/forecast",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(research.forecastSnapshot),
        },
      );
      setForecast(nextForecast);
      const runId = nextForecast.persistence?.runId;

      if (!runId) {
        throw new Error(
          "Forecast completed without a stored run ID; behavioral simulation was not started.",
        );
      }

      setStage("simulation");
      setMessage("Forecast stored. Running market-participant stress paths.");
      const result = await fetchJson<{
        ok: boolean;
        result: BehavioralSimulation;
      }>("/api/intelligence/forecast/agent-simulation", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "run",
          runId,
          scenario: "BASELINE",
          paths: 750,
        }),
      });
      setSimulation(result.result);
      setStage("complete");
      setMessage(
        `Complete: ${research.activeAgents.toLocaleString()} research pathways, ${research.graph.edgeCount.toLocaleString()} graph lines, eight horizons, and ${result.result.configuration.paths} behavioral paths.`,
      );
    } catch (error) {
      setStage("error");
      setMessage(error instanceof Error ? error.message : "The complete cycle failed.");
    }
  }

  const busy = stage === "research" || stage === "forecast" || stage === "simulation";
  const positive = (swarm?.market.changePercent ?? 0) >= 0;
  const visibleEvidence = useMemo(() => {
    const grouped: Record<ResearchCohort, ResearchEvidence[]> = {
      media: [],
      technical: [],
      economy: [],
    };

    for (const item of swarm?.evidence ?? []) {
      grouped[item.cohort].push(item);
    }

    for (const cohort of ["media", "technical", "economy"] as const) {
      grouped[cohort].sort(
        (left, right) =>
          right.relevanceScore * right.confidence -
          left.relevanceScore * left.confidence,
      );
    }

    return grouped;
  }, [swarm]);
  const forecastAverageConfidence = forecast?.horizons.length
    ? forecast.horizons.reduce((sum, horizon) => sum + horizon.confidence, 0) /
      forecast.horizons.length
    : null;
  const simulationAgreement = simulation?.horizons.length
    ? simulation.horizons.reduce((sum, horizon) => sum + horizon.agentAgreementPercent, 0) /
      simulation.horizons.length
    : null;

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-12rem] top-[-14rem] h-[38rem] w-[38rem] rounded-full bg-emerald-700/18 blur-3xl" />
        <div className="absolute right-[-14rem] top-[6rem] h-[36rem] w-[36rem] rounded-full bg-purple-800/11 blur-3xl" />
        <div className="absolute bottom-[-20rem] left-[30%] h-[40rem] w-[40rem] rounded-full bg-cyan-800/7 blur-3xl" />
      </div>

      <div className="mx-auto max-w-[1950px]">
        <section className={cx(panelClass, "overflow-hidden")}> 
          <div className="grid gap-8 bg-[radial-gradient(circle_at_10%_0%,rgba(16,185,129,0.22),transparent_34%),radial-gradient(circle_at_92%_12%,rgba(168,85,247,0.12),transparent_30%)] p-6 sm:p-8 xl:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge tone="red">
                  <BrainCircuit className="h-3.5 w-3.5" />
                  Agentic Slice Intelligence
                </Badge>
                <Badge
                  tone={
                    swarm?.market.realTimeConfirmed
                      ? "green"
                      : swarm?.market.delayed
                        ? "amber"
                        : "red"
                  }
                >
                  {swarm?.market.realTimeConfirmed ? (
                    <Wifi className="h-3.5 w-3.5" />
                  ) : (
                    <WifiOff className="h-3.5 w-3.5" />
                  )}
                  {swarm?.market.freshnessLabel || "Provider timing pending"}
                </Badge>
                <Badge tone="purple">
                  <Network className="h-3.5 w-3.5" />
                  Sprawling knowledge graph
                </Badge>
              </div>

              <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl xl:text-7xl">
                Real-time research, live knowledge graph, and forecast vectors in one control plane.
              </h1>
              <p className="mt-5 max-w-4xl text-sm font-semibold leading-7 text-slate-400 sm:text-base">
                Slice now consolidates market tape, technical data, source research, economic releases,
                bot topology, graph centrality, and forecast pressure into one evidence-aware surface.
                The score remains one third media, one third technical, and one third industry economy.
              </p>

              <div className="mt-7 grid gap-3 lg:grid-cols-[1fr_320px_auto_auto]">
                <label className="flex min-w-0 items-center rounded-2xl border border-white/10 bg-black/55 p-1.5">
                  <Search className="ml-3 h-5 w-5 text-emerald-300" />
                  <input
                    value={symbolInput}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setSymbolInput(event.target.value.toUpperCase())
                    }
                    onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                      if (event.key === "Enter") {
                        void runCompleteCycle();
                      }
                    }}
                    className="min-w-0 flex-1 bg-transparent px-4 py-3 text-base font-black uppercase tracking-[0.12em] text-white outline-none"
                    placeholder="MSFT"
                  />
                </label>

                <label className="rounded-2xl border border-white/10 bg-black/55 px-4 py-2.5">
                  <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                    Research pathways
                    <span className="text-emerald-300">{agentCount.toLocaleString()}</span>
                  </span>
                  <input
                    type="range"
                    min={300}
                    max={2_000}
                    step={100}
                    value={agentCount}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setAgentCount(Number(event.target.value))
                    }
                    className="mt-2 w-full accent-emerald-600"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => void runRequestedSwarm()}
                  disabled={busy}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-white/10 bg-white/[0.05] px-5 text-sm font-black text-white transition hover:border-emerald-400/25 hover:bg-emerald-500/[0.08] disabled:opacity-50"
                >
                  <RefreshCw className={cx("h-4 w-4", busy && "animate-spin")} />
                  Research only
                </button>

                <button
                  type="button"
                  onClick={() => void runCompleteCycle()}
                  disabled={busy}
                  className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-700 to-emerald-950 px-6 text-sm font-black text-white shadow-xl shadow-emerald-950/35 transition hover:brightness-110 disabled:opacity-50"
                >
                  {busy ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4 fill-current" />
                  )}
                  Full research cycle
                </button>
              </div>

              <div
                className={cx(
                  "mt-4 flex items-start gap-3 rounded-2xl border p-4 text-sm font-semibold leading-6",
                  stage === "error"
                    ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                    : stage === "complete"
                      ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                      : "border-white/10 bg-white/[0.035] text-slate-300",
                )}
              >
                {stage === "error" ? (
                  <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0" />
                ) : stage === "complete" ? (
                  <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0" />
                ) : (
                  <Activity className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
                )}
                {message}
              </div>
            </div>

            <div className="grid content-start gap-5 xl:grid-cols-[260px_1fr]">
              <ScoreDial
                score={swarm?.score.overall ?? 50}
                confidence={swarm?.score.confidence ?? 0}
                label={swarm?.score.label ?? "Awaiting research"}
              />

              <div className="grid gap-4">
                <div className="rounded-[1.5rem] border border-white/10 bg-black/50 p-5">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <p className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-600">
                        Live provider observation
                      </p>
                      <p className="mt-2 text-3xl font-black text-white">
                        {swarm?.symbol ?? activeSymbol}
                      </p>
                    </div>
                    <div
                      className={cx(
                        "grid h-12 w-12 place-items-center rounded-2xl border",
                        positive
                          ? "border-emerald-400/20 bg-emerald-500/10 text-emerald-300"
                          : "border-emerald-400/20 bg-emerald-500/10 text-emerald-300",
                      )}
                    >
                      {positive ? (
                        <TrendingUp className="h-6 w-6" />
                      ) : (
                        <TrendingDown className="h-6 w-6" />
                      )}
                    </div>
                  </div>
                  <p className="mt-5 text-4xl font-black text-white">
                    {currency(swarm?.market.price, swarm?.market.currency)}
                  </p>
                  <p className={cx("mt-2 text-sm font-black", positive ? "text-emerald-300" : "text-emerald-300")}>
                    {signedPercent(swarm?.market.changePercent)} latest session
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                      <p className="text-[9px] uppercase tracking-[0.12em] text-slate-700">
                        Provider as of
                      </p>
                      <p className="mt-1 font-black text-white">
                        {dateTime(swarm?.providerAsOf)}
                      </p>
                    </div>
                    <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                      <p className="text-[9px] uppercase tracking-[0.12em] text-slate-700">
                        Market status
                      </p>
                      <p className="mt-1 font-black text-white">
                        {swarm?.market.marketStatus || "unknown"}
                      </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between gap-4 rounded-2xl border border-white/10 bg-black/45 px-4 py-3">
                  <div>
                    <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                      Auto research refresh
                    </p>
                    <p className="mt-1 text-xs font-black text-white">
                      {autoRefresh ? "Every 45 seconds" : "Paused"}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setAutoRefresh((current) => !current)}
                    className={cx(
                      "relative h-7 w-12 rounded-full border transition",
                      autoRefresh
                        ? "border-emerald-400/30 bg-emerald-500/20"
                        : "border-white/10 bg-white/[0.05]",
                    )}
                    aria-label="Toggle auto refresh"
                  >
                    <span
                      className={cx(
                        "absolute top-1 h-5 w-5 rounded-full bg-white transition",
                        autoRefresh ? "left-6" : "left-1",
                      )}
                    />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
          <Metric
            label="Active pathways"
            value={(swarm?.activeAgents ?? 0).toLocaleString()}
            helper="Media, technical, and economy research bots."
            icon={<Bot className="h-5 w-5" />}
            tone="red"
          />
          <Metric
            label="Graph lines"
            value={(swarm?.graph.edgeCount ?? 0).toLocaleString()}
            helper="Evidence, agent, source, topic, and contradiction links."
            icon={<Network className="h-5 w-5" />}
            tone="purple"
          />
          <Metric
            label="Connectedness"
            value={`${number(swarm?.graphAnalytics.connectednessScore, 0)}%`}
            helper="Centrality, edge intensity, and bridge-node pressure."
            icon={<GitBranch className="h-5 w-5" />}
            tone="cyan"
          />
          <Metric
            label="Consensus"
            value={`${number(swarm?.botTopology.consensusScore, 0)}%`}
            helper="Cross-cohort score alignment and agent agreement."
            icon={<Gauge className="h-5 w-5" />}
            tone="green"
          />
          <Metric
            label="Forecast vector"
            value={swarm?.forecastVector.forecastBias ?? "Pending"}
            helper={`${signedPercent(swarm?.forecastVector.expectedDriftPercent)} expected drift.`}
            icon={<Zap className="h-5 w-5" />}
            tone="amber"
          />
          <Metric
            label="Research speed"
            value={`${number(swarm?.botTopology.pathwayThroughputPerSecond, 0)}/s`}
            helper="Deterministic pathway throughput over shared evidence."
            icon={<Clock3 className="h-5 w-5" />}
            tone="orange"
          />
        </section>

        {swarm?.graph ? (
          <section className="mt-5">
            <ResearchKnowledgeGraphCanvas
              graph={swarm.graph}
              analytics={swarm.graphAnalytics}
              height={780}
              live
            />
          </section>
        ) : null}

        <section className="mt-5 grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
          <div className={cx(panelClass, "p-5 sm:p-6")}> 
            <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
              <div>
                <Badge tone="red">
                  <Layers3 className="h-3.5 w-3.5" />
                  Algorithm cockpit
                </Badge>
                <h2 className="mt-3 text-2xl font-black text-white">
                  Forecast vector and graph pressure
                </h2>
                <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                  The vector blends equal-third research, provider freshness, centrality,
                  graph connectedness, bot consensus, and contradiction drag.
                </p>
              </div>
              <Badge tone="slate">
                {swarm?.forecastVector.algorithmVersion ?? "pending"}
              </Badge>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                ["Expected drift", signedPercent(swarm?.forecastVector.expectedDriftPercent), "Directional vector"],
                ["Confidence lift", `${number(swarm?.forecastVector.confidenceLift, 0)}%`, "Graph + evidence + agreement"],
                ["Tail risk", `${number(swarm?.forecastVector.tailRiskScore, 0)}%`, "Contradictions + freshness drag"],
                ["Amplification", `${number(swarm?.forecastVector.networkAmplification, 0)}%`, "How fast a signal can spread"],
              ].map(([label, value, helper]) => (
                <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-black text-white">{value}</p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {helper}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.05] p-4 text-sm font-semibold leading-6 text-emerald-50/80">
              {swarm?.forecastVector.driverSummary ?? "Run a research cycle to generate the forecast vector."}
            </div>
          </div>

          <div className={cx(panelClass, "p-5 sm:p-6")}> 
            <Badge tone="purple">
              <Network className="h-3.5 w-3.5" />
              Bot topology
            </Badge>
            <h2 className="mt-3 text-2xl font-black text-white">
              Cohort handoffs and tension
            </h2>
            <div className="mt-5 space-y-3">
              {(swarm?.botTopology.cohortHandoffs ?? []).map((handoff) => (
                <div key={`${handoff.from}-${handoff.to}`} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                  <div className="flex items-center justify-between gap-4">
                    <p className="text-sm font-black text-white">
                      {COHORT_META[handoff.from].shortTitle} → {COHORT_META[handoff.to].shortTitle}
                    </p>
                    <Badge
                      tone={
                        handoff.relationship === "contradicts"
                          ? "red"
                          : handoff.relationship === "diverges"
                            ? "amber"
                            : "green"
                      }
                    >
                      {handoff.relationship}
                    </Badge>
                  </div>
                  <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                    <span>{handoff.description}</span>
                    <span>{number(handoff.strength, 0)}%</span>
                  </div>
                  <div className="mt-2">
                    <Progress value={handoff.strength} tone="purple" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-3">
          {(["media", "technical", "economy"] as const).map((cohort) => {
            const result = swarm?.cohorts[cohort];
            const meta = COHORT_META[cohort];

            return (
              <article key={cohort} className={cx(panelClass, "p-5 sm:p-6")}> 
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <Badge tone={meta.tone}>{meta.icon}{meta.title}</Badge>
                    <p className="mt-3 text-sm font-semibold leading-6 text-slate-500">
                      {meta.subtitle}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-4xl font-black text-white">
                      {number(result?.score, 1)}
                    </p>
                    <p className="mt-1 text-[10px] font-black uppercase tracking-[0.13em] text-slate-600">
                      33.33% weight
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                    <p className="text-[9px] uppercase tracking-[0.12em] text-slate-700">
                      Agents
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {(result?.requestedAgents ?? 0).toLocaleString()}
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                    <p className="text-[9px] uppercase tracking-[0.12em] text-slate-700">
                      Confidence
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {number(result?.confidence, 0)}%
                    </p>
                  </div>
                  <div className="rounded-xl border border-white/8 bg-white/[0.025] p-3">
                    <p className="text-[9px] uppercase tracking-[0.12em] text-slate-700">
                      Evidence
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {(result?.evidenceCount ?? 0).toLocaleString()}
                    </p>
                  </div>
                </div>

                <div className="mt-4">
                  <Progress value={result?.score ?? 50} tone={meta.tone} />
                </div>
              </article>
            );
          })}
        </section>

        <section className="mt-5 grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
          <section className={cx(panelClass, "p-5 sm:p-6")}> 
            <Badge tone="cyan">
              <Database className="h-3.5 w-3.5" />
              Top graph connectors
            </Badge>
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              {(swarm?.graphAnalytics.centralityTop ?? []).slice(0, 8).map((node) => (
                <div key={node.id} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="line-clamp-1 text-sm font-black text-white">{node.label}</p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.13em] text-slate-700">
                        {node.kind} · {node.cohort}
                      </p>
                    </div>
                    <span className="text-xl font-black text-white">
                      {node.centralityScore}%
                    </span>
                  </div>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    Degree {node.degree} · weighted {number(node.weightedDegree, 1)}
                  </p>
                </div>
              ))}
            </div>
          </section>

          <section className={cx(panelClass, "p-5 sm:p-6")}> 
            <div className="flex items-end justify-between gap-4">
              <div>
                <Badge tone="orange">
                  <Newspaper className="h-3.5 w-3.5" />
                  Highest-impact evidence
                </Badge>
                <h2 className="mt-3 text-2xl font-black text-white">
                  Most relevant current inputs
                </h2>
              </div>
              <Link
                href="/workspace/intelligence/agent-simulation"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black text-slate-300 hover:text-white"
              >
                Inspect agents
                <ArrowRight className="h-4 w-4" />
              </Link>
            </div>
            <div className="mt-5 grid gap-3 lg:grid-cols-3">
              {(["media", "technical", "economy"] as const).map((cohort) => (
                <div key={cohort} className="space-y-3">
                  <Badge tone={COHORT_META[cohort].tone}>{COHORT_META[cohort].shortTitle}</Badge>
                  {visibleEvidence[cohort].slice(0, 3).map((evidence) => (
                    <EvidenceCard key={evidence.id} evidence={evidence} />
                  ))}
                </div>
              ))}
            </div>
          </section>
        </section>

        {(forecast || simulation) ? (
          <section className="mt-5 grid gap-5 xl:grid-cols-2">
            {forecast ? (
              <div className={cx(panelClass, "p-5 sm:p-6")}> 
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <Badge tone="red">
                      <Target className="h-3.5 w-3.5" />
                      Forecast Output
                    </Badge>
                    <h2 className="mt-3 text-2xl font-black text-white">
                      Agentic score passed into all horizons
                    </h2>
                  </div>
                  <Badge tone="green">{number(forecastAverageConfidence, 0)}% mean confidence</Badge>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {forecast.horizons.map((horizon) => (
                    <div key={horizon.horizon} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-white">{horizon.label}</p>
                        <span
                          className={cx(
                            "text-xs font-black",
                            horizon.direction === "Bullish"
                              ? "text-emerald-300"
                              : horizon.direction === "Bearish"
                                ? "text-emerald-300"
                                : "text-amber-300",
                          )}
                        >
                          {horizon.direction}
                        </span>
                      </div>
                      <p className="mt-3 text-2xl font-black text-white">
                        {signedPercent(horizon.expectedReturnPercent)}
                      </p>
                      <p className="mt-1 text-xs font-bold text-slate-500">
                        {number(horizon.positiveReturnProbability, 0)}% probability positive
                      </p>
                      <div className="mt-3">
                        <Progress value={horizon.confidence} />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}

            {simulation ? (
              <div className={cx(panelClass, "p-5 sm:p-6")}> 
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <Badge tone="purple">
                      <Bot className="h-3.5 w-3.5" />
                      Behavioral stress simulation
                    </Badge>
                    <h2 className="mt-3 text-2xl font-black text-white">
                      Bot agreement and tail risk
                    </h2>
                  </div>
                  <Badge tone="purple">{number(simulationAgreement, 0)}% mean agreement</Badge>
                </div>
                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
                  {simulation.horizons.slice(0, 8).map((horizon) => (
                    <div key={horizon.horizon} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-black text-white">{horizon.label}</p>
                        <span className="text-xs font-black text-purple-300">
                          {number(horizon.agentAgreementPercent, 0)}%
                        </span>
                      </div>
                      <p className="mt-3 text-2xl font-black text-white">
                        {signedPercent(horizon.meanReturnPercent)}
                      </p>
                      <div className="mt-3 flex items-center justify-between text-[10px] font-bold text-slate-600">
                        <span>Crash {number(horizon.crashProbability, 0)}%</span>
                        <span>Rally {number(horizon.rallyProbability, 0)}%</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {swarm?.warnings.length ? (
          <section className={cx(panelClass, "mt-5 p-5 sm:p-6")}> 
            <Badge tone="amber">
              <AlertTriangle className="h-3.5 w-3.5" />
              Active limitations
            </Badge>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {swarm.warnings.map((warning) => (
                <div key={warning} className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.05] p-4 text-xs font-semibold leading-5 text-amber-100">
                  {warning}
                </div>
              ))}
            </div>
          </section>
        ) : null}

        <section className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {[
            {
              href: "/workspace/intelligence/agent-simulation",
              title: "Research Swarm",
              copy: "Inspect pathways, evidence assignments, agreement, latency, and contradictions.",
              icon: <Bot className="h-5 w-5" />,
            },
            {
              href: "/workspace/intelligence/knowledge-graph",
              title: "Knowledge Graph",
              copy: "Open the full graph with sources, evidence, topics, bridges, and centrality.",
              icon: <Network className="h-5 w-5" />,
            },
            {
              href: "/workspace/intelligence/forecast-lab",
              title: "Forecast Lab",
              copy: "Run horizons using the research-vector-adjusted Slice score.",
              icon: <Target className="h-5 w-5" />,
            },
            {
              href: "/workspace/intelligence/launch-readiness",
              title: "Launch Readiness",
              copy: "Review controls, evidence integrity, costs, and human governance.",
              icon: <ShieldCheck className="h-5 w-5" />,
            },
          ].map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={cx(
                panelClass,
                "group p-5 transition hover:-translate-y-0.5 hover:border-emerald-400/25 hover:bg-emerald-500/[0.035]",
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.06] text-emerald-300">
                  {item.icon}
                </div>
                <ArrowRight className="h-4 w-4 text-slate-700 transition group-hover:translate-x-1 group-hover:text-emerald-300" />
              </div>
              <h3 className="mt-5 text-lg font-black text-white">{item.title}</h3>
              <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                {item.copy}
              </p>
            </Link>
          ))}
        </section>
      </div>
    </main>
  );
}