"use client";

import dynamic from "next/dynamic";
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
  Network,
  Newspaper,
  Pause,
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
  startTransition,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import {
  IntelligenceMetric,
  IntelligenceNotice,
  IntelligencePage,
  IntelligencePill,
  IntelligenceSectionHeading,
  IntelligenceSurface,
  cx,
  formatIntelligenceCurrency,
  formatIntelligenceDate,
  formatIntelligenceInteger,
  formatIntelligenceNumber,
  formatIntelligencePercent,
} from "@/components/intelligence/intelligence-ui";
import {
  cleanIntelligenceSymbol,
  clientTimestampFreshness,
  intelligenceFetch,
  isAbortError,
  readSessionValue,
  writeSessionValue,
} from "@/lib/intelligence/client";
import type {
  ResearchCohort,
  ResearchCohortResult,
  ResearchEvidence,
  ResearchForecastVector,
  ResearchGraphAnalytics,
  ResearchGraphViewResponse,
  ResearchKnowledgeGraph,
  ResearchSwarmAlgorithmDiagnostics,
  ResearchSwarmResponse,
  ResearchBotTopology,
  SliceAgenticScore,
} from "@/lib/intelligence/research-swarm-types";

const ResearchKnowledgeGraphCanvas = dynamic(
  () => import("@/components/intelligence/research-knowledge-graph"),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-h-[520px] place-items-center rounded-[1.5rem] border border-[var(--slice-border)] bg-[var(--slice-surface-muted)]">
        <div className="text-center">
          <RefreshCw className="mx-auto h-5 w-5 animate-spin text-[var(--slice-accent-strong)]" />
          <p className="mt-3 text-xs font-black text-[var(--slice-muted)]">
            Loading the graph renderer
          </p>
        </div>
      </div>
    ),
  },
);

type IntegrationSummary = {
  key: string;
  label: string;
  category: string;
  configured: boolean;
  liveEnabled?: boolean;
  safeStatus: "Ready" | "Missing" | "Disabled" | "Simulated";
  note: string;
};

type BootstrapResponse = {
  ok: true;
  service: string;
  maximumAgents: number;
  defaults: {
    interactiveAgents: number;
    simulationPaths: number;
    projection: "overview";
    automaticRefreshMs: number;
  };
  allocation: string;
  latest: ResearchGraphViewResponse | null;
  graph: ResearchKnowledgeGraph | null;
  graphAnalytics: ResearchGraphAnalytics | null;
  integrations: IntegrationSummary[];
  persistence: {
    configured: boolean;
    enabled: boolean;
    database: string;
    missing: string[];
  };
  safeguards: {
    externalCallsPerAgent: false;
    autonomousTradingEnabled: false;
    equalThirdWeighting: true;
    scoreSemanticsPreserved: true;
    automaticResearchOnPageLoad: false;
  };
};

type IntelligenceSummary = {
  version: "slice-intelligence-client-summary-1.0.0";
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  requestedAgents: number;
  activeAgents: number;
  completedAt: string;
  providerAsOf: string | null;
  durationMs: number;
  market: ResearchSwarmResponse["market"];
  score: SliceAgenticScore;
  cohorts: Record<ResearchCohort, ResearchCohortResult>;
  evidence: ResearchEvidence[];
  graphAnalytics: ResearchGraphAnalytics;
  botTopology: ResearchBotTopology;
  forecastVector: ResearchForecastVector;
  warnings: string[];
  algorithm?: ResearchSwarmAlgorithmDiagnostics;
};

type RunStage =
  | "idle"
  | "loading-saved"
  | "research"
  | "complete"
  | "error";

const COHORTS = ["media", "technical", "economy"] as const;
const COHORT_META: Record<
  ResearchCohort,
  {
    label: string;
    description: string;
    tone: "amber" | "cyan" | "violet";
    icon: ReactNode;
  }
> = {
  media: {
    label: "Media research",
    description: "Sources, filings, narrative velocity, and contradictions.",
    tone: "amber",
    icon: <Newspaper className="h-4 w-4" />,
  },
  technical: {
    label: "Technical research",
    description: "Quote, trend, liquidity, volatility, and company structure.",
    tone: "cyan",
    icon: <Activity className="h-4 w-4" />,
  },
  economy: {
    label: "Industry economy",
    description: "Rates, inflation, labor, demand, and sector sensitivity.",
    tone: "violet",
    icon: <GitBranch className="h-4 w-4" />,
  },
};

const CACHE_MAX_AGE_MS = 30 * 60_000;
const AUTO_REFRESH_MS = 5 * 60_000;

function cacheKey(symbol: string) {
  return `slice-intelligence-summary-v2:${symbol}`;
}

function summaryFromSwarm(
  swarm: ResearchSwarmResponse,
): IntelligenceSummary {
  return {
    version: "slice-intelligence-client-summary-1.0.0",
    symbol: swarm.symbol,
    companyName: swarm.companyName,
    sector: swarm.sector,
    industry: swarm.industry,
    requestedAgents: swarm.requestedAgents,
    activeAgents: swarm.activeAgents,
    completedAt: swarm.completedAt,
    providerAsOf: swarm.providerAsOf,
    durationMs: swarm.durationMs,
    market: swarm.market,
    score: swarm.score,
    cohorts: swarm.cohorts,
    evidence: [...swarm.evidence]
      .sort(
        (left, right) =>
          right.relevanceScore * right.confidence -
          left.relevanceScore * left.confidence,
      )
      .slice(0, 18),
    graphAnalytics: swarm.graphAnalytics,
    botTopology: swarm.botTopology,
    forecastVector: swarm.forecastVector,
    warnings: swarm.warnings.slice(0, 16),
    algorithm: swarm.algorithm,
  };
}

function safeExternalUrl(value: string) {
  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:"
      ? url.toString()
      : null;
  } catch {
    return null;
  }
}

function freshnessTone(
  state: ReturnType<typeof clientTimestampFreshness>["state"],
) {
  if (state === "current") return "emerald" as const;
  if (state === "recent") return "cyan" as const;
  if (state === "stale") return "amber" as const;
  if (state === "missing") return "slate" as const;
  return "rose" as const;
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
        className="grid h-52 w-52 place-items-center rounded-full p-3 shadow-[0_20px_65px_var(--slice-shadow)]"
        style={{
          background: `conic-gradient(var(--slice-accent) 0deg, var(--slice-accent-strong) ${degrees}deg, color-mix(in srgb, var(--slice-border) 72%, transparent) ${degrees}deg 360deg)`,
        }}
      >
        <div className="grid h-full w-full place-items-center rounded-full border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] text-center">
          <div>
            <p className="text-[9px] font-black uppercase tracking-[0.17em] text-[var(--slice-accent-strong)]">
              Slice score
            </p>
            <p className="mt-1 text-5xl font-black tracking-[-0.06em] text-[var(--slice-heading)]">
              {formatIntelligenceNumber(score, 1)}
            </p>
            <p className="mt-1 text-xs font-black text-[var(--slice-heading)]">
              {label}
            </p>
            <p className="mt-2 text-[10px] font-bold text-[var(--slice-muted)]">
              {formatIntelligenceNumber(confidence, 0)}% confidence
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function EvidenceCard({ evidence }: { evidence: ResearchEvidence }) {
  const external = safeExternalUrl(evidence.sourceUrl);

  return (
    <article className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4 shadow-sm">
      <div className="flex flex-wrap items-center gap-2">
        <IntelligencePill
          tone={
            evidence.polarity === "positive"
              ? "emerald"
              : evidence.polarity === "negative"
                ? "rose"
                : evidence.polarity === "mixed"
                  ? "amber"
                  : "slate"
          }
        >
          {evidence.polarity}
        </IntelligencePill>
        <span className="truncate text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">
          {evidence.source}
        </span>
      </div>

      <h3 className="mt-3 line-clamp-2 text-sm font-black leading-5 text-[var(--slice-heading)]">
        {evidence.title}
      </h3>
      <p className="mt-2 line-clamp-3 text-xs font-semibold leading-5 text-[var(--slice-muted)]">
        {evidence.summary || "No source summary was available."}
      </p>

      <div className="mt-3 grid grid-cols-3 gap-2 text-center">
        {[
          ["Score", evidence.score],
          ["Confidence", evidence.confidence],
          ["Freshness", evidence.freshnessScore],
        ].map(([label, value]) => (
          <div
            key={String(label)}
            className="rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-2"
          >
            <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
              {label}
            </p>
            <p className="mt-1 text-sm font-black text-[var(--slice-heading)]">
              {formatIntelligenceNumber(Number(value), 0)}
            </p>
          </div>
        ))}
      </div>

      {external ? (
        <a
          href={external}
          target="_blank"
          rel="noreferrer noopener"
          className="mt-3 inline-flex items-center gap-1.5 text-[11px] font-black text-[var(--slice-accent-strong)] hover:underline"
        >
          Open evidence
          <ArrowRight className="h-3.5 w-3.5" />
        </a>
      ) : null}
    </article>
  );
}

function ProviderReadiness({
  integrations,
}: {
  integrations: IntegrationSummary[];
}) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {integrations.map((integration) => (
        <div
          key={integration.key}
          className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="truncate text-sm font-black text-[var(--slice-heading)]">
                {integration.label}
              </p>
              <p className="mt-1 text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">
                {integration.category}
              </p>
            </div>
            <IntelligencePill
              tone={
                integration.safeStatus === "Ready"
                  ? "emerald"
                  : integration.safeStatus === "Disabled"
                    ? "slate"
                    : integration.safeStatus === "Simulated"
                      ? "amber"
                      : "rose"
              }
            >
              {integration.safeStatus}
            </IntelligencePill>
          </div>
          <p className="mt-3 text-[11px] font-semibold leading-5 text-[var(--slice-muted)]">
            {integration.note}
          </p>
        </div>
      ))}
    </div>
  );
}

export default function IntelligenceControlPlane() {
  const [symbolInput, setSymbolInput] = useState("MSFT");
  const [activeSymbol, setActiveSymbol] = useState("MSFT");
  const [agentCount, setAgentCount] = useState(600);
  const [bootstrap, setBootstrap] = useState<BootstrapResponse | null>(null);
  const [swarm, setSwarm] = useState<ResearchSwarmResponse | null>(null);
  const [summary, setSummary] = useState<IntelligenceSummary | null>(null);
  const [stage, setStage] = useState<RunStage>("loading-saved");
  const [message, setMessage] = useState(
    "Loading the latest saved intelligence state.",
  );
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [showGraph, setShowGraph] = useState(false);
  const [lastRunAt, setLastRunAt] = useState<number | null>(null);
  const bootstrapController = useRef<AbortController | null>(null);
  const researchController = useRef<AbortController | null>(null);
  const requestSequence = useRef(0);
  const mounted = useRef(true);
  const busy = stage === "research" || stage === "loading-saved";

  const loadBootstrap = useCallback(
    async (symbol: string, quiet = false) => {
      bootstrapController.current?.abort();
      const controller = new AbortController();
      bootstrapController.current = controller;

      if (!quiet) {
        setStage("loading-saved");
        setMessage(`Loading the latest saved ${symbol} intelligence.`);
      }

      try {
        const response = await intelligenceFetch<BootstrapResponse>(
          `/api/intelligence/research-swarm?symbol=${encodeURIComponent(
            symbol,
          )}&projection=overview`,
          {
            signal: controller.signal,
          },
          {
            timeoutMs: 18_000,
            retries: 1,
          },
        );

        if (!mounted.current) return;
        setBootstrap(response);
        setStage("idle");
        const loadedFreshness = response.latest
          ? clientTimestampFreshness(response.latest.generatedAt, {
              currentWithinMs: 15 * 60_000,
              recentWithinMs: 24 * 60 * 60_000,
            })
          : null;
        setMessage(
          response.latest
            ? `${loadedFreshness?.label ?? "Saved"}: ${response.latest.symbol} graph loaded without starting a new provider scan.`
            : `No saved ${symbol} research graph exists yet. Run live research when you are ready.`,
        );
      } catch (error) {
        if (isAbortError(error) || !mounted.current) return;
        setStage("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to load the saved intelligence state.",
        );
      }
    },
    [],
  );

  const runResearch = useCallback(
    async (input: {
      symbol: string;
      agents: number;
      quiet?: boolean;
      forceRefresh?: boolean;
    }) => {
      researchController.current?.abort();
      const controller = new AbortController();
      researchController.current = controller;
      const sequence = requestSequence.current + 1;
      requestSequence.current = sequence;

      if (!input.quiet) {
        setStage("research");
        setMessage(
          `Running ${input.agents.toLocaleString()} evidence-aware pathways for ${input.symbol}.`,
        );
      }

      try {
        const response = await intelligenceFetch<ResearchSwarmResponse>(
          "/api/intelligence/research-swarm",
          {
            method: "POST",
            signal: controller.signal,
            body: JSON.stringify({
              symbol: input.symbol,
              agentCount: input.agents,
              simulationPaths: 300,
              graphMode: "summary",
              detailMode: "summary",
              projection: "overview",
              persistGraph: false,
              forceRefresh: input.forceRefresh === true,
              executionMode: "sync",
            }),
          },
          {
            timeoutMs: 82_000,
          },
        );

        if (
          !mounted.current ||
          sequence !== requestSequence.current
        ) {
          return null;
        }

        const nextSummary = summaryFromSwarm(response);
        setSwarm(response);
        setSummary(nextSummary);
        setActiveSymbol(response.symbol);
        setSymbolInput(response.symbol);
        setLastRunAt(Date.now());
        writeSessionValue(cacheKey(response.symbol), nextSummary);
        setStage("complete");
        setMessage(
          `${response.activeAgents.toLocaleString()} pathways completed in ${Math.max(
            1,
            Math.round(response.durationMs / 1_000),
          )} seconds. No full graph was persisted during this interactive run.`,
        );
        return response;
      } catch (error) {
        if (isAbortError(error) || !mounted.current) return null;

        setStage("error");
        setMessage(
          error instanceof Error
            ? error.message
            : "The intelligence research request did not complete.",
        );
        return null;
      }
    },
    [],
  );

  useEffect(() => {
    mounted.current = true;
    const cached = readSessionValue<IntelligenceSummary>(
      cacheKey("MSFT"),
      CACHE_MAX_AGE_MS,
    );
    if (cached) {
      setSummary(cached);
      const cachedFreshness = clientTimestampFreshness(
        cached.completedAt,
        {
          currentWithinMs: 15 * 60_000,
          recentWithinMs: CACHE_MAX_AGE_MS,
        },
      );
      setMessage(
        `${cachedFreshness.label}: showing the verified session snapshot while saved graph status loads.`,
      );
    }

    void loadBootstrap("MSFT");

    return () => {
      mounted.current = false;
      bootstrapController.current?.abort();
      researchController.current?.abort();
    };
  }, [loadBootstrap]);

  useEffect(() => {
    if (!autoRefresh) return;

    const interval = window.setInterval(() => {
      const oldEnough =
        lastRunAt === null || Date.now() - lastRunAt >= AUTO_REFRESH_MS;

      if (
        oldEnough &&
        !busy &&
        navigator.onLine &&
        document.visibilityState === "visible"
      ) {
        void runResearch({
          symbol: activeSymbol,
          agents: agentCount,
          quiet: true,
          forceRefresh: false,
        });
      }
    }, 30_000);

    return () => window.clearInterval(interval);
  }, [
    activeSymbol,
    agentCount,
    autoRefresh,
    busy,
    lastRunAt,
    runResearch,
  ]);

  async function runRequestedResearch() {
    const symbol =
      cleanIntelligenceSymbol(symbolInput) || activeSymbol;
    const cached = readSessionValue<IntelligenceSummary>(
      cacheKey(symbol),
      CACHE_MAX_AGE_MS,
    );

    setActiveSymbol(symbol);
    setSymbolInput(symbol);
    if (cached) setSummary(cached);

    await runResearch({
      symbol,
      agents: agentCount,
      forceRefresh: true,
    });
  }

  async function refreshSavedState() {
    const symbol =
      cleanIntelligenceSymbol(symbolInput) || activeSymbol;
    setActiveSymbol(symbol);
    await loadBootstrap(symbol);
  }

  const visibleEvidence = useMemo(() => {
    const grouped: Record<ResearchCohort, ResearchEvidence[]> = {
      media: [],
      technical: [],
      economy: [],
    };

    for (const evidence of summary?.evidence ?? []) {
      grouped[evidence.cohort].push(evidence);
    }

    return grouped;
  }, [summary]);

  const graphSummary = bootstrap?.latest;
  const analytics = summary?.graphAnalytics ?? graphSummary?.analytics ?? null;
  const score =
    summary?.score.overall ?? graphSummary?.metadata.score ?? null;
  const confidence =
    summary?.score.confidence ?? graphSummary?.metadata.confidence ?? null;
  const liveMarket = summary?.market ?? null;
  const positive = (liveMarket?.changePercent ?? 0) >= 0;
  const displayedGeneratedAt =
    summary?.completedAt ?? graphSummary?.generatedAt ?? null;
  const displayedProviderAsOf =
    summary?.providerAsOf ?? graphSummary?.metadata.providerAsOf ?? null;
  const resultFreshness = clientTimestampFreshness(
    displayedGeneratedAt,
    {
      currentWithinMs: 15 * 60_000,
      recentWithinMs: 24 * 60 * 60_000,
    },
  );
  const providerFreshness = clientTimestampFreshness(
    displayedProviderAsOf,
    {
      currentWithinMs: 15 * 60_000,
      recentWithinMs: 24 * 60 * 60_000,
    },
  );
  const savedOnly = Boolean(graphSummary && !summary);
  const providerNeedsReview = [
    "stale",
    "future",
    "invalid",
    "missing",
  ].includes(providerFreshness.state);
  const integrationReadiness =
    bootstrap?.integrations.filter((item) =>
      ["postgresql", "alpha_vantage", "openai", "neo4j"].includes(
        item.key,
      ),
    ) ?? [];

  return (
    <IntelligencePage>
      <IntelligenceSurface className="overflow-hidden">
        <div className="grid gap-8 bg-[radial-gradient(circle_at_8%_0%,rgba(16,185,129,0.13),transparent_35%),radial-gradient(circle_at_94%_10%,rgba(6,182,212,0.08),transparent_32%)] p-5 sm:p-7 xl:grid-cols-[minmax(0,1.2fr)_minmax(350px,0.8fr)]">
          <div>
            <div className="flex flex-wrap items-center gap-2">
              <IntelligencePill tone="emerald">
                <BrainCircuit className="h-3.5 w-3.5" />
                Intelligence control plane
              </IntelligencePill>
              <IntelligencePill
                tone={
                  liveMarket?.realTimeConfirmed
                    ? "emerald"
                    : liveMarket?.delayed
                      ? "amber"
                      : freshnessTone(providerFreshness.state)
                }
              >
                {liveMarket?.realTimeConfirmed ? (
                  <Wifi className="h-3.5 w-3.5" />
                ) : (
                  <WifiOff className="h-3.5 w-3.5" />
                )}
                {liveMarket?.freshnessLabel ?? providerFreshness.label}
              </IntelligencePill>
              <IntelligencePill
                tone={freshnessTone(resultFreshness.state)}
              >
                <Clock3 className="h-3.5 w-3.5" />
                {resultFreshness.label}
              </IntelligencePill>
              <IntelligencePill tone="cyan">
                <Network className="h-3.5 w-3.5" />
                Progressive graph
              </IntelligencePill>
            </div>

            <h1 className="mt-5 max-w-5xl text-4xl font-black tracking-[-0.05em] text-[var(--slice-heading)] sm:text-5xl xl:text-6xl">
              Evidence, graph structure, and forecast pressure without blocking the workspace.
            </h1>
            <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-[var(--slice-muted)] sm:text-base">
              Slice loads the most recent verified intelligence first. A new
              provider scan begins only when requested—or through the optional
              five-minute refresh—while deep graph builds and forecast work
              remain isolated in their dedicated routes.
            </p>

            <div className="mt-6 grid gap-3 xl:grid-cols-[minmax(220px,1fr)_260px_auto_auto]">
              <label className="flex min-h-14 items-center rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 shadow-sm">
                <Search className="h-5 w-5 text-[var(--slice-accent-strong)]" />
                <input
                  value={symbolInput}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setSymbolInput(
                      cleanIntelligenceSymbol(event.target.value),
                    )
                  }
                  onKeyDown={(
                    event: KeyboardEvent<HTMLInputElement>,
                  ) => {
                    if (event.key === "Enter" && !busy) {
                      void runRequestedResearch();
                    }
                  }}
                  className="min-w-0 flex-1 bg-transparent px-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--slice-heading)] outline-none"
                  placeholder="MSFT"
                  aria-label="Security symbol"
                />
              </label>

              <label className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 py-2.5 shadow-sm">
                <span className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.13em] text-[var(--slice-subtle)]">
                  Interactive pathways
                  <span className="text-[var(--slice-accent-strong)]">
                    {agentCount.toLocaleString()}
                  </span>
                </span>
                <input
                  type="range"
                  min={300}
                  max={900}
                  step={100}
                  value={agentCount}
                  disabled={busy}
                  onChange={(event: ChangeEvent<HTMLInputElement>) =>
                    setAgentCount(Number(event.target.value))
                  }
                  className="mt-2 w-full accent-emerald-600 disabled:opacity-50"
                />
              </label>

              <button
                type="button"
                onClick={() => void refreshSavedState()}
                disabled={busy}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-5 text-sm font-black text-[var(--slice-text)] shadow-sm transition hover:border-[var(--slice-accent-border)] hover:bg-[var(--slice-accent-soft)] disabled:opacity-50"
              >
                <RefreshCw
                  className={cx(
                    "h-4 w-4",
                    stage === "loading-saved" && "animate-spin",
                  )}
                />
                Saved state
              </button>

              <button
                type="button"
                onClick={() => void runRequestedResearch()}
                disabled={busy || !cleanIntelligenceSymbol(symbolInput)}
                className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(110deg,var(--slice-accent),var(--slice-accent-strong))] px-6 text-sm font-black text-white shadow-[0_14px_32px_var(--slice-accent-glow)] transition hover:brightness-105 disabled:opacity-50"
              >
                {stage === "research" ? (
                  <RefreshCw className="h-4 w-4 animate-spin" />
                ) : (
                  <Play className="h-4 w-4 fill-current" />
                )}
                Run live research
              </button>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setAutoRefresh((current) => !current)}
                className={cx(
                  "inline-flex min-h-10 items-center gap-2 rounded-xl border px-3 text-[11px] font-black transition",
                  autoRefresh
                    ? "border-[var(--slice-green-border)] bg-[var(--slice-green-bg)] text-[var(--slice-green-text)]"
                    : "border-[var(--slice-border)] bg-[var(--slice-surface-strong)] text-[var(--slice-muted)]",
                )}
                aria-pressed={autoRefresh}
              >
                {autoRefresh ? (
                  <Pause className="h-3.5 w-3.5" />
                ) : (
                  <Clock3 className="h-3.5 w-3.5" />
                )}
                {autoRefresh
                  ? "Five-minute refresh enabled"
                  : "Automatic refresh off"}
              </button>
              <span className="text-[10px] font-semibold text-[var(--slice-muted)]">
                Hidden tabs and offline devices never start a refresh.
              </span>
            </div>

            <IntelligenceNotice
              className="mt-4"
              tone={
                stage === "error"
                  ? "rose"
                  : stage === "complete"
                    ? "emerald"
                    : "slate"
              }
              icon={
                stage === "error" ? (
                  <AlertTriangle className="h-5 w-5" />
                ) : stage === "complete" ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Activity className="h-5 w-5" />
                )
              }
            >
              {message}
            </IntelligenceNotice>
          </div>

          <div className="grid content-start gap-5 md:grid-cols-[220px_minmax(0,1fr)] xl:grid-cols-1 2xl:grid-cols-[220px_minmax(0,1fr)]">
            {score !== null && confidence !== null ? (
              <ScoreDial
                score={score}
                confidence={confidence}
                label={
                  summary?.score.label ??
                  `${resultFreshness.state === "stale" ? "Historical" : "Saved"} graph score`
                }
              />
            ) : (
              <div className="grid min-h-52 place-items-center rounded-[1.4rem] border border-dashed border-[var(--slice-border-strong)] bg-[var(--slice-surface-muted)] p-5 text-center">
                <div>
                  <BrainCircuit className="mx-auto h-7 w-7 text-[var(--slice-accent-strong)]" />
                  <p className="mt-3 text-sm font-black text-[var(--slice-heading)]">
                    No verified score yet
                  </p>
                  <p className="mt-2 text-xs font-semibold leading-5 text-[var(--slice-muted)]">
                    Run live research to create the first current score.
                  </p>
                </div>
              </div>
            )}

            <div className="grid gap-3">
              <div className="rounded-[1.4rem] border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-5 shadow-sm">
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <p className="text-[9px] font-black uppercase tracking-[0.14em] text-[var(--slice-subtle)]">
                      {savedOnly ? "Saved provider observation" : "Provider observation"}
                    </p>
                    <p className="mt-1 text-2xl font-black text-[var(--slice-heading)]">
                      {summary?.symbol ??
                        graphSummary?.symbol ??
                        activeSymbol}
                    </p>
                  </div>
                  <span
                    className={cx(
                      "grid h-11 w-11 place-items-center rounded-xl border",
                      positive
                        ? "border-emerald-600/20 bg-emerald-50 text-emerald-700"
                        : "border-rose-600/20 bg-rose-50 text-rose-700",
                    )}
                  >
                    {positive ? (
                      <TrendingUp className="h-5 w-5" />
                    ) : (
                      <TrendingDown className="h-5 w-5" />
                    )}
                  </span>
                </div>

                <p className="mt-4 text-3xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
                  {liveMarket
                    ? formatIntelligenceCurrency(
                        liveMarket.price,
                        liveMarket.currency,
                      )
                    : resultFreshness.state === "stale"
                      ? "Historical graph"
                      : "Saved graph"}
                </p>
                <p
                  className={cx(
                    "mt-1 text-xs font-black",
                    positive
                      ? "text-emerald-700"
                      : "text-rose-700",
                  )}
                >
                  {liveMarket
                    ? `${formatIntelligencePercent(
                        liveMarket.changePercent,
                      )} latest session`
                    : `${resultFreshness.label}. Run live research for current market context.`}
                </p>

                <div className="mt-4 grid grid-cols-2 gap-2">
                  <div className="rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-3">
                    <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                      Provider as of
                    </p>
                    <p className="mt-1 text-[10px] font-black text-[var(--slice-heading)]">
                      {formatIntelligenceDate(displayedProviderAsOf)}
                    </p>
                    <p className="mt-1 text-[8px] font-bold text-[var(--slice-subtle)]">
                      {providerFreshness.label}
                    </p>
                  </div>
                  <div className="rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-3">
                    <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                      Research duration
                    </p>
                    <p className="mt-1 text-[10px] font-black text-[var(--slice-heading)]">
                      {summary
                        ? `${formatIntelligenceNumber(
                            summary.durationMs / 1_000,
                            1,
                          )}s`
                        : graphSummary?.metadata.durationMs
                          ? `${formatIntelligenceNumber(
                              graphSummary.metadata.durationMs / 1_000,
                              1,
                            )}s`
                          : "—"}
                    </p>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <Link
                  href={`/workspace/intelligence/knowledge-graph?symbol=${encodeURIComponent(
                    activeSymbol,
                  )}`}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 text-[11px] font-black text-[var(--slice-text)] transition hover:border-[var(--slice-accent-border)]"
                >
                  <Network className="h-3.5 w-3.5" />
                  Deep graph
                </Link>
                <Link
                  href={`/workspace/intelligence/forecast-lab?symbol=${encodeURIComponent(
                    activeSymbol,
                  )}`}
                  prefetch={false}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl bg-[var(--slice-accent-strong)] px-3 text-[11px] font-black text-white"
                >
                  <Target className="h-3.5 w-3.5" />
                  Forecast lab
                </Link>
              </div>
            </div>
          </div>
        </div>
      </IntelligenceSurface>

      {savedOnly || providerNeedsReview ? (
        <IntelligenceNotice
          className="mt-5"
          tone={
            providerFreshness.state === "future" ||
            providerFreshness.state === "invalid"
              ? "rose"
              : "amber"
          }
          icon={<AlertTriangle className="h-4 w-4" />}
        >
          {savedOnly
            ? `This is a saved analytical graph generated ${formatIntelligenceDate(displayedGeneratedAt)} (${resultFreshness.label.toLowerCase()}). It is historical evidence, not a claim about the current market. Run live research before making a current-state interpretation.`
            : `The provider timestamp needs review: ${providerFreshness.label}. Slice preserved the evidence and its timestamp rather than relabeling it as current.`}
        </IntelligenceNotice>
      ) : null}

      <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
        <IntelligenceMetric
          label="Active pathways"
          value={formatIntelligenceInteger(
            summary?.activeAgents ??
              graphSummary?.metadata.activeAgents,
          )}
          helper="Media, technical, and economy pathways."
          icon={<Bot className="h-5 w-5" />}
        />
        <IntelligenceMetric
          label="Graph nodes"
          value={formatIntelligenceInteger(
            summary?.graphAnalytics.analyzedNodeCount ??
              graphSummary?.graph.projection?.originalNodeCount ??
              graphSummary?.graph.nodeCount,
          )}
          helper="Analyzed relationship entities."
          icon={<Network className="h-5 w-5" />}
          tone="cyan"
        />
        <IntelligenceMetric
          label="Connectedness"
          value={
            analytics
              ? `${formatIntelligenceNumber(
                  analytics.connectednessScore,
                  0,
                )}%`
              : "—"
          }
          helper="Weighted graph cohesion."
          icon={<GitBranch className="h-5 w-5" />}
          tone="violet"
        />
        <IntelligenceMetric
          label="Consensus"
          value={
            summary
              ? `${formatIntelligenceNumber(
                  summary.botTopology.consensusScore,
                  0,
                )}%`
              : "—"
          }
          helper="Cross-cohort agreement."
          icon={<Gauge className="h-5 w-5" />}
          tone="emerald"
        />
        <IntelligenceMetric
          label="Forecast vector"
          value={summary?.forecastVector.forecastBias ?? "Pending"}
          helper={
            summary
              ? `${formatIntelligencePercent(
                  summary.forecastVector.expectedDriftPercent,
                )} expected drift`
              : "Run current research."
          }
          icon={<Zap className="h-5 w-5" />}
          tone="amber"
        />
        <IntelligenceMetric
          label="Persistence"
          value={
            bootstrap?.persistence.configured
              ? "Ready"
              : "Memory only"
          }
          helper={
            bootstrap?.persistence.configured
              ? "Neo4j graph retention available."
              : "Configure Neo4j for durable graph runs."
          }
          icon={<Database className="h-5 w-5" />}
          tone={
            bootstrap?.persistence.configured
              ? "emerald"
              : "slate"
          }
        />
      </section>

      {summary ? (
        <>
          <IntelligenceSurface className="mt-5 p-5 sm:p-6">
            <IntelligenceSectionHeading
              eyebrow="Equal-third model"
              title="Three independent research cohorts"
              description="The original Slice weighting remains unchanged: one third media, one third technical, and one third industry economy. Graph diagnostics improve explainability without silently rewriting the score."
            />
            <div className="mt-5 grid gap-3 xl:grid-cols-3">
              {COHORTS.map((cohort) => {
                const result = summary.cohorts[cohort];
                const meta = COHORT_META[cohort];

                return (
                  <article
                    key={cohort}
                    className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-5 shadow-sm"
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div>
                        <IntelligencePill tone={meta.tone}>
                          {meta.icon}
                          {meta.label}
                        </IntelligencePill>
                        <p className="mt-3 text-xs font-semibold leading-5 text-[var(--slice-muted)]">
                          {meta.description}
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-3xl font-black text-[var(--slice-heading)]">
                          {formatIntelligenceNumber(
                            result.score,
                            1,
                          )}
                        </p>
                        <p className="mt-1 text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                          33.33% weight
                        </p>
                      </div>
                    </div>

                    <div className="mt-5 grid grid-cols-3 gap-2 text-center">
                      {[
                        ["Agents", result.requestedAgents],
                        ["Confidence", result.confidence],
                        ["Evidence", result.evidenceCount],
                      ].map(([label, value]) => (
                        <div
                          key={String(label)}
                          className="rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-3"
                        >
                          <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                            {label}
                          </p>
                          <p className="mt-1 text-base font-black text-[var(--slice-heading)]">
                            {formatIntelligenceNumber(
                              Number(value),
                              label === "Confidence" ? 0 : 0,
                            )}
                            {label === "Confidence" ? "%" : ""}
                          </p>
                        </div>
                      ))}
                    </div>
                  </article>
                );
              })}
            </div>
          </IntelligenceSurface>

          <section className="mt-5 grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <IntelligenceSurface className="p-5 sm:p-6">
              <IntelligenceSectionHeading
                eyebrow="Graph diagnostics"
                title="Network quality and pressure"
                description="Advanced graph metrics remain visible as diagnostics; they do not replace the original score semantics."
              />
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                {[
                  [
                    "Network resilience",
                    summary.graphAnalytics.networkResilience,
                    "Stability after central-node removal",
                  ],
                  [
                    "Source concentration",
                    summary.graphAnalytics.sourceConcentration,
                    "Dependence on a small source set",
                  ],
                  [
                    "Contradiction ratio",
                    summary.graphAnalytics.contradictionRatio,
                    "Opposing relationships in the graph",
                  ],
                  [
                    "Stability score",
                    summary.algorithm?.stabilityScore,
                    "Evidence, agreement, and topology",
                  ],
                ].map(([label, value, helper]) => (
                  <div
                    key={String(label)}
                    className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4"
                  >
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">
                      {label}
                    </p>
                    <p className="mt-2 text-2xl font-black text-[var(--slice-heading)]">
                      {typeof value === "number"
                        ? `${formatIntelligenceNumber(value, 0)}%`
                        : "—"}
                    </p>
                    <p className="mt-1 text-[11px] font-semibold text-[var(--slice-muted)]">
                      {helper}
                    </p>
                  </div>
                ))}
              </div>

              <div className="mt-4 rounded-2xl border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] p-4">
                <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-accent-strong)]">
                  Forecast pressure
                </p>
                <p className="mt-2 text-sm font-bold leading-6 text-[var(--slice-text)]">
                  {summary.forecastVector.driverSummary}
                </p>
              </div>
            </IntelligenceSurface>

            <IntelligenceSurface className="p-5 sm:p-6">
              <IntelligenceSectionHeading
                eyebrow="Highest-impact evidence"
                title="Most relevant current inputs"
                description="Only the strongest evidence is rendered here. The warehouse and graph routes retain the deeper inspection tools."
                action={
                  <Link
                    href="/workspace/intelligence/data-warehouse"
                    prefetch={false}
                    className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 text-[11px] font-black text-[var(--slice-text)]"
                  >
                    Evidence warehouse
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                }
              />
              <div className="mt-5 grid gap-3 lg:grid-cols-3">
                {COHORTS.map((cohort) => (
                  <div key={cohort} className="space-y-3">
                    <IntelligencePill
                      tone={COHORT_META[cohort].tone}
                    >
                      {COHORT_META[cohort].label}
                    </IntelligencePill>
                    {visibleEvidence[cohort]
                      .slice(0, 2)
                      .map((evidence) => (
                        <EvidenceCard
                          key={evidence.id}
                          evidence={evidence}
                        />
                      ))}
                  </div>
                ))}
              </div>
            </IntelligenceSurface>
          </section>

          <IntelligenceSurface className="mt-5 p-5 sm:p-6">
            <IntelligenceSectionHeading
              eyebrow="Graph preview"
              title="Render only when it is useful"
              description="The graph bundle and canvas remain unloaded until this panel is opened. Signal-flow animation is disabled by default."
              action={
                <button
                  type="button"
                  onClick={() =>
                    startTransition(() =>
                      setShowGraph((current) => !current),
                    )
                  }
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--slice-accent-strong)] px-4 text-xs font-black text-white"
                >
                  {showGraph ? (
                    <Pause className="h-4 w-4" />
                  ) : (
                    <Network className="h-4 w-4" />
                  )}
                  {showGraph ? "Hide preview" : "Open preview"}
                </button>
              }
            />

            {showGraph ? (
              <div className="mt-5">
                <ResearchKnowledgeGraphCanvas
                  graph={swarm?.graph ?? summaryGraphFallback(summary)}
                  analytics={summary.graphAnalytics}
                  height={600}
                  live={false}
                />
              </div>
            ) : (
              <div className="mt-5 grid min-h-44 place-items-center rounded-2xl border border-dashed border-[var(--slice-border-strong)] bg-[var(--slice-surface-muted)] p-5 text-center">
                <div>
                  <Network className="mx-auto h-7 w-7 text-[var(--slice-accent-strong)]" />
                  <p className="mt-3 text-sm font-black text-[var(--slice-heading)]">
                    Graph renderer is sleeping
                  </p>
                  <p className="mt-2 max-w-md text-xs font-semibold leading-5 text-[var(--slice-muted)]">
                    Opening this panel imports the canvas and draws the
                    overview projection. No signal-flow animation starts
                    automatically.
                  </p>
                </div>
              </div>
            )}
          </IntelligenceSurface>
        </>
      ) : null}

      <IntelligenceSurface className="mt-5 p-5 sm:p-6">
        <IntelligenceSectionHeading
          eyebrow="Production readiness"
          title="Safe provider configuration"
          description="These are boolean readiness states only. API keys and connection secrets remain on the server and are never returned to this page."
        />
        <div className="mt-5">
          {integrationReadiness.length ? (
            <ProviderReadiness integrations={integrationReadiness} />
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--slice-border-strong)] bg-[var(--slice-surface-muted)] p-5 text-sm font-semibold text-[var(--slice-muted)]">
              Provider readiness will appear after the saved-state request
              completes.
            </div>
          )}
        </div>
      </IntelligenceSurface>

      {summary?.warnings.length ? (
        <IntelligenceSurface className="mt-5 p-5 sm:p-6">
          <IntelligenceSectionHeading
            eyebrow="Active limitations"
            title="Provider and evidence warnings"
            description="Slice keeps degraded states visible rather than replacing unavailable evidence with fabricated certainty."
          />
          <div className="mt-5 grid gap-3 lg:grid-cols-2">
            {summary.warnings.map((warning) => (
              <IntelligenceNotice
                key={warning}
                tone="amber"
                icon={<AlertTriangle className="h-4 w-4" />}
              >
                {warning}
              </IntelligenceNotice>
            ))}
          </div>
        </IntelligenceSurface>
      ) : null}

      <section className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {[
          {
            href: "/workspace/intelligence/agent-simulation",
            title: "Research swarm",
            copy: "Inspect individual pathways without loading them on this page.",
            icon: <Bot className="h-5 w-5" />,
          },
          {
            href: "/workspace/intelligence/knowledge-graph",
            title: "Knowledge graph",
            copy: "Build, persist, project, search, and inspect graph relationships.",
            icon: <Network className="h-5 w-5" />,
          },
          {
            href: "/workspace/intelligence/forecast-lab",
            title: "Forecast lab",
            copy: "Run the eight-horizon forecast workflow in its dedicated route.",
            icon: <Target className="h-5 w-5" />,
          },
          {
            href: "/workspace/intelligence/production-controls",
            title: "Production controls",
            copy: "Review jobs, providers, model health, and operational safeguards.",
            icon: <ShieldCheck className="h-5 w-5" />,
          },
        ].map((item) => (
          <Link
            key={item.href}
            href={item.href}
            prefetch={false}
            className="group flex min-h-40 flex-col justify-between rounded-[1.4rem] border border-[var(--slice-border)] bg-[var(--slice-surface)] p-5 shadow-sm transition hover:-translate-y-0.5 hover:border-[var(--slice-accent-border)] hover:shadow-[0_18px_45px_var(--slice-shadow)]"
          >
            <span className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-[var(--slice-accent-strong)]">
              {item.icon}
            </span>
            <div className="mt-5">
              <div className="flex items-center justify-between gap-3">
                <h3 className="text-base font-black text-[var(--slice-heading)]">
                  {item.title}
                </h3>
                <ArrowRight className="h-4 w-4 text-[var(--slice-accent-strong)] transition group-hover:translate-x-1" />
              </div>
              <p className="mt-2 text-xs font-semibold leading-5 text-[var(--slice-muted)]">
                {item.copy}
              </p>
            </div>
          </Link>
        ))}
      </section>
    </IntelligencePage>
  );
}

function summaryGraphFallback(
  summary: IntelligenceSummary,
): ResearchKnowledgeGraph {
  const generatedAt = summary.completedAt;
  const runId = `summary:${summary.symbol}:${generatedAt}`;
  const scoreId = `score:${runId}`;
  const assetId = `asset:${summary.symbol}`;
  const nodes: ResearchKnowledgeGraph["nodes"] = [
    {
      id: scoreId,
      kind: "score",
      label: `Slice Score ${formatIntelligenceNumber(
        summary.score.overall,
        1,
      )}`,
      cohort: "shared",
      score: summary.score.overall,
      confidence: summary.score.confidence,
      size: 30,
      group: "score",
      properties: {
        label: summary.score.label,
      },
    },
    {
      id: assetId,
      kind: "asset",
      label: `${summary.symbol} ${summary.companyName}`.trim(),
      cohort: "shared",
      score: summary.score.overall,
      confidence: summary.score.confidence,
      size: 24,
      group: "asset",
      properties: {
        symbol: summary.symbol,
      },
    },
  ];
  const edges: ResearchKnowledgeGraph["edges"] = [];

  for (const cohort of COHORTS) {
    const id = `cohort:${cohort}:${runId}`;
    const cohortResult = summary.cohorts[cohort];
    nodes.push({
      id,
      kind: "cohort",
      label: COHORT_META[cohort].label,
      cohort,
      score: cohortResult.score,
      confidence: cohortResult.confidence,
      size: 22,
      group: cohort,
      properties: {
        requestedAgents: cohortResult.requestedAgents,
        evidenceCount: cohortResult.evidenceCount,
      },
    });
    edges.push({
      id: `edge:${id}:${scoreId}`,
      source: id,
      target: scoreId,
      kind: "CONTRIBUTES_TO",
      weight: 1 / 3,
      cohort,
      properties: {
        equalWeight: true,
      },
    });
  }

  edges.push({
    id: `edge:${assetId}:${scoreId}`,
    source: assetId,
    target: scoreId,
    kind: "DERIVES",
    weight: 1,
    cohort: "shared",
    properties: {},
  });

  for (const evidence of summary.evidence.slice(0, 18)) {
    const id = `evidence:${evidence.id}`;
    nodes.push({
      id,
      kind:
        evidence.kind === "economic-series"
          ? "economic-series"
          : "evidence",
      label: evidence.title,
      cohort: evidence.cohort,
      score: evidence.score,
      confidence: evidence.confidence,
      size: 8 + evidence.relevanceScore / 20,
      group: evidence.kind,
      properties: {
        source: evidence.source,
        asOf: evidence.asOf,
        sourceUrl: evidence.sourceUrl,
      },
    });
    edges.push({
      id: `edge:${id}:cohort:${evidence.cohort}:${runId}`,
      source: id,
      target: `cohort:${evidence.cohort}:${runId}`,
      kind: "CONTRIBUTES_TO",
      weight: Math.max(0.1, evidence.confidence / 100),
      cohort: evidence.cohort,
      properties: {},
    });
  }

  return {
    schemaVersion: "slice-research-graph-1.0.0",
    runId,
    generatedAt,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
    clusters: COHORTS.map((cohort) => ({
      id: `cluster:${cohort}`,
      label: COHORT_META[cohort].label,
      cohort,
      nodeCount: nodes.filter((node) => node.cohort === cohort)
        .length,
      averageScore: summary.cohorts[cohort].score,
    })),
    projection: {
      mode: "overview",
      originalNodeCount: nodes.length,
      originalEdgeCount: edges.length,
      renderedNodeCount: nodes.length,
      renderedEdgeCount: edges.length,
      omittedNodeCount: 0,
      omittedEdgeCount: 0,
      clipped: false,
      selectedNodeId: null,
      generatedAt,
    },
  };
}