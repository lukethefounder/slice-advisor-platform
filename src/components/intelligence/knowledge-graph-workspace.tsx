"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  CheckCircle2,
  CircleStop,
  Clock3,
  Gauge,
  GitBranch,
  Layers3,
  Network,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Waypoints,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

import {
  IntelligenceMetric,
  IntelligenceNotice,
  IntelligencePage,
  IntelligencePill,
  IntelligenceSectionHeading,
  IntelligenceSurface,
  cx,
  formatIntelligenceDate,
  formatIntelligenceInteger,
  formatIntelligenceNumber,
} from "@/components/intelligence/intelligence-ui";
import {
  cleanIntelligenceSymbol,
  clientTimestampFreshness,
  intelligenceFetch,
  isAbortError,
} from "@/lib/intelligence/client";
import type {
  ResearchGraphProjectionMode,
  ResearchGraphViewResponse,
  ResearchSwarmResponse,
} from "@/lib/intelligence/research-swarm-types";

const ResearchKnowledgeGraphCanvas = dynamic(
  () => import("@/components/intelligence/research-knowledge-graph"),
  {
    ssr: false,
    loading: () => (
      <div className="grid min-h-[640px] place-items-center rounded-[1.5rem] border border-[var(--slice-border)] bg-[var(--slice-surface-muted)]">
        <div className="text-center">
          <RefreshCw className="mx-auto h-5 w-5 animate-spin text-[var(--slice-accent-strong)]" />
          <p className="mt-3 text-xs font-black text-[var(--slice-muted)]">
            Loading the progressive graph renderer
          </p>
        </div>
      </div>
    ),
  },
);

type BuildPreset = "quick" | "deep" | "maximum";
type BuildState =
  | "idle"
  | "loading"
  | "queued"
  | "processing"
  | "complete"
  | "error";

type PublicJob = {
  id: string;
  jobKey: string;
  jobName: string;
  status: string;
  progress: {
    value: number;
    message: string | null;
    updatedAt: string | null;
  };
  attempt: number;
  maxAttempts: number;
  output: Record<string, unknown> | null;
  error: string | null;
  lastError: {
    message: string;
    retryable: boolean;
  } | null;
  completedAt: string | null;
};

type SyncBuildResponse = ResearchSwarmResponse & {
  executionMode: "sync";
  executionFallback?: string | null;
};

type BackgroundBuildResponse = {
  ok: true;
  executionMode: "background";
  duplicate: boolean;
  job: PublicJob;
  symbol: string;
  requestedAgents: number;
  projection: ResearchGraphProjectionMode;
  message: string;
};

type BuildResponse =
  | SyncBuildResponse
  | BackgroundBuildResponse;

type PersistenceStatus = {
  configured: boolean;
  enabled: boolean;
  database: string;
  missing: string[];
};

type GraphApiResponse = {
  ok: true;
  symbol: string;
  projection: ResearchGraphProjectionMode;
  view: ResearchGraphViewResponse | null;
  empty: boolean;
  persistence: PersistenceStatus;
  message: string;
};

type JobApiResponse = {
  ok: true;
  job: PublicJob;
};

const PRESETS: Record<
  BuildPreset,
  {
    label: string;
    helper: string;
    agents: number;
    projection: ResearchGraphProjectionMode;
    simulationPaths: number;
    graphMode: "summary" | "full";
    detailMode: "summary" | "graph";
    executionMode: "sync" | "background";
  }
> = {
  quick: {
    label: "Quick map",
    helper: "Fast overview projection",
    agents: 600,
    projection: "overview",
    simulationPaths: 300,
    graphMode: "summary",
    detailMode: "summary",
    executionMode: "sync",
  },
  deep: {
    label: "Deep research",
    helper: "Balanced durable graph",
    agents: 1_200,
    projection: "balanced",
    simulationPaths: 750,
    graphMode: "full",
    detailMode: "graph",
    executionMode: "background",
  },
  maximum: {
    label: "Maximum graph",
    helper: "Full 2,000-pathway build",
    agents: 2_000,
    projection: "full",
    simulationPaths: 1_250,
    graphMode: "full",
    detailMode: "graph",
    executionMode: "background",
  },
};

function isBackgroundResponse(
  response: BuildResponse,
): response is BackgroundBuildResponse {
  return response.executionMode === "background";
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

function outputString(
  output: Record<string, unknown> | null,
  key: string,
) {
  const value = output?.[key];
  return typeof value === "string" ? value : null;
}

export default function KnowledgeGraphWorkspace() {
  const [symbolInput, setSymbolInput] = useState("MSFT");
  const [activeSymbol, setActiveSymbol] = useState("MSFT");
  const [preset, setPreset] =
    useState<BuildPreset>("quick");
  const [projection, setProjection] =
    useState<ResearchGraphProjectionMode>("overview");
  const [graphView, setGraphView] =
    useState<ResearchGraphViewResponse | null>(null);
  const [syncResult, setSyncResult] =
    useState<SyncBuildResponse | null>(null);
  const [persistence, setPersistence] =
    useState<PersistenceStatus | null>(null);
  const [job, setJob] = useState<PublicJob | null>(null);
  const [state, setState] =
    useState<BuildState>("loading");
  const [message, setMessage] = useState(
    "Loading the latest saved graph without starting a new research run.",
  );
  const [error, setError] = useState("");
  const mounted = useRef(true);
  const loadController =
    useRef<AbortController | null>(null);
  const buildController =
    useRef<AbortController | null>(null);
  const pollController =
    useRef<AbortController | null>(null);
  const pollTimer =
    useRef<number | null>(null);
  const projectionRef =
    useRef<ResearchGraphProjectionMode>("overview");

  const currentGraph =
    syncResult?.graph ?? graphView?.graph ?? null;
  const currentAnalytics =
    syncResult?.graphAnalytics ??
    graphView?.analytics ??
    null;
  const currentRunId =
    syncResult?.runId ?? graphView?.runId ?? null;
  const metadata: ResearchGraphViewResponse["metadata"] =
    syncResult
      ? {
          companyName: syncResult.companyName,
          sector: syncResult.sector,
          industry: syncResult.industry,
          requestedAgents: syncResult.requestedAgents,
          activeAgents: syncResult.activeAgents,
          score: syncResult.score.overall,
          confidence: syncResult.score.confidence,
          providerAsOf: syncResult.providerAsOf,
          durationMs: syncResult.durationMs,
        }
      : graphView?.metadata ?? {};
  const graphGeneratedAt =
    syncResult?.graph.generatedAt ?? graphView?.generatedAt ?? null;
  const graphFreshness = clientTimestampFreshness(
    graphGeneratedAt,
    {
      currentWithinMs: 15 * 60_000,
      recentWithinMs: 24 * 60 * 60_000,
    },
  );
  const providerFreshness = clientTimestampFreshness(
    metadata.providerAsOf,
    {
      currentWithinMs: 15 * 60_000,
      recentWithinMs: 24 * 60 * 60_000,
    },
  );
  const savedGraph = Boolean(graphView && !syncResult);
  const providerNeedsReview = [
    "stale",
    "future",
    "invalid",
    "missing",
  ].includes(providerFreshness.state);

  const originalNodeCount =
    currentGraph?.projection?.originalNodeCount ??
    currentGraph?.nodeCount ??
    0;
  const originalEdgeCount =
    currentGraph?.projection?.originalEdgeCount ??
    currentGraph?.edgeCount ??
    0;
  const renderedNodeCount =
    currentGraph?.nodeCount ?? 0;
  const renderedEdgeCount =
    currentGraph?.edgeCount ?? 0;
  const isBusy = [
    "loading",
    "queued",
    "processing",
  ].includes(state);

  useEffect(() => {
    projectionRef.current = projection;
  }, [projection]);

  const stopPolling = useCallback(() => {
    if (pollTimer.current !== null) {
      window.clearTimeout(pollTimer.current);
      pollTimer.current = null;
    }
    pollController.current?.abort();
    pollController.current = null;
  }, []);

  const updateLocation = useCallback(
    (symbol: string, runId?: string | null) => {
      const url = new URL(window.location.href);
      url.searchParams.set("symbol", symbol);

      if (runId) {
        url.searchParams.set("runId", runId);
      } else {
        url.searchParams.delete("runId");
      }

      window.history.replaceState(
        {},
        "",
        `${url.pathname}${url.search}`,
      );
    },
    [],
  );

  const loadGraph = useCallback(
    async (input: {
      symbol: string;
      projection: ResearchGraphProjectionMode;
      runId?: string | null;
      quiet?: boolean;
    }) => {
      loadController.current?.abort();
      const controller = new AbortController();
      loadController.current = controller;
      const params = new URLSearchParams({
        symbol: input.symbol,
        projection: input.projection,
      });

      if (input.runId) {
        params.set("runId", input.runId);
      }

      if (!input.quiet) {
        setState("loading");
        setMessage(
          `Loading the latest saved ${input.symbol} graph.`,
        );
      }

      try {
        const response =
          await intelligenceFetch<GraphApiResponse>(
            `/api/intelligence/research-graph?${params.toString()}`,
            {
              signal: controller.signal,
            },
            {
              timeoutMs: 18_000,
              retries: 1,
            },
          );

        if (!mounted.current) return null;

        setPersistence(response.persistence);
        setGraphView(response.view);
        setSyncResult(null);
        setJob(null);

        if (response.view) {
          const symbol =
            response.view.symbol || input.symbol;
          setActiveSymbol(symbol);
          setSymbolInput(symbol);
          setState("complete");
          setError("");
          setMessage(
            `${response.view.graph.nodeCount.toLocaleString()} nodes are rendered from ${(
              response.view.graph.projection
                ?.originalNodeCount ??
              response.view.graph.nodeCount
            ).toLocaleString()} total nodes.`,
          );
          updateLocation(symbol, response.view.runId);
        } else {
          setState("idle");
          setError("");
          setMessage(response.message);
          updateLocation(input.symbol, null);
        }

        return response.view;
      } catch (caught) {
        if (isAbortError(caught) || !mounted.current) {
          return null;
        }

        setState("error");
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load the saved graph.",
        );
        return null;
      }
    },
    [updateLocation],
  );

  const pollJob = useCallback(
    async (
      jobId: string,
      symbol: string,
      initialDelay = 1_500,
    ) => {
      stopPolling();
      let delay = initialDelay;

      const check = async () => {
        if (!mounted.current) return;

        if (
          document.visibilityState === "hidden" ||
          !navigator.onLine
        ) {
          delay = Math.min(8_000, delay * 1.35);
          pollTimer.current = window.setTimeout(
            check,
            Math.max(5_000, delay),
          );
          return;
        }

        const controller = new AbortController();
        pollController.current = controller;

        try {
          const response =
            await intelligenceFetch<JobApiResponse>(
              `/api/jobs/${jobId}`,
              {
                signal: controller.signal,
              },
              {
                timeoutMs: 15_000,
                retries: 1,
              },
            );

          if (!mounted.current) return;

          const nextJob = response.job;
          setJob(nextJob);
          setState(
            nextJob.status === "Processing"
              ? "processing"
              : "queued",
          );
          setMessage(
            nextJob.progress.message ||
              `${nextJob.jobName}: ${nextJob.status}`,
          );

          if (nextJob.status === "Complete") {
            stopPolling();
            setState("loading");
            setMessage(
              "Loading the completed persisted graph.",
            );
            const completedRunId = outputString(
              nextJob.output,
              "runId",
            );
            const completedView = await loadGraph({
              symbol,
              projection: projectionRef.current,
              runId: completedRunId,
              quiet: true,
            });

            if (!completedView) {
              setState("error");
              setError(
                "The job completed, but its graph could not be loaded. Review Neo4j and background-worker health before retrying.",
              );
              return;
            }

            setState("complete");
            setMessage(
              "The completed research graph is ready.",
            );
            return;
          }

          if (
            nextJob.status === "Failed" ||
            nextJob.status === "DeadLetter" ||
            nextJob.status === "Cancelled"
          ) {
            stopPolling();
            setState(
              nextJob.status === "Cancelled"
                ? "idle"
                : "error",
            );
            setError(
              nextJob.lastError?.message ||
                nextJob.error ||
                `Graph build ended with status ${nextJob.status}.`,
            );
            return;
          }

          delay = Math.min(
            8_000,
            Math.max(1_500, delay * 1.28),
          );
          pollTimer.current =
            window.setTimeout(check, delay);
        } catch (caught) {
          if (
            isAbortError(caught) ||
            !mounted.current
          ) {
            return;
          }

          delay = Math.min(8_000, delay * 1.5);
          setMessage(
            caught instanceof Error
              ? `${caught.message} Retrying job status.`
              : "Job status is temporarily unavailable. Retrying.",
          );
          pollTimer.current =
            window.setTimeout(check, delay);
        }
      };

      await check();
    },
    [loadGraph, stopPolling],
  );

  const runGraph = useCallback(
    async (input: {
      symbol: string;
      selectedPreset: BuildPreset;
      forceRefresh?: boolean;
    }) => {
      const symbol =
        cleanIntelligenceSymbol(input.symbol) || "MSFT";
      const config = PRESETS[input.selectedPreset];
      buildController.current?.abort();
      const controller = new AbortController();
      buildController.current = controller;
      stopPolling();
      setActiveSymbol(symbol);
      setSymbolInput(symbol);
      setPreset(input.selectedPreset);
      setProjection(config.projection);
      projectionRef.current = config.projection;
      setState("loading");
      setError("");
      setMessage(
        `Starting the ${config.label.toLowerCase()} for ${symbol}.`,
      );

      try {
        const response =
          await intelligenceFetch<BuildResponse>(
            "/api/intelligence/research-swarm",
            {
              method: "POST",
              signal: controller.signal,
              body: JSON.stringify({
                symbol,
                agentCount: config.agents,
                simulationPaths:
                  config.simulationPaths,
                graphMode: config.graphMode,
                detailMode: config.detailMode,
                projection: config.projection,
                persistGraph: true,
                forceRefresh:
                  input.forceRefresh === true,
                executionMode:
                  config.executionMode,
              }),
            },
            {
              timeoutMs: 86_000,
            },
          );

        if (!mounted.current) return;

        if (isBackgroundResponse(response)) {
          setJob(response.job);
          setState(
            response.job.status === "Processing"
              ? "processing"
              : "queued",
          );
          setMessage(response.message);
          await pollJob(response.job.id, symbol);
          return;
        }

        setSyncResult(response);
        setGraphView(null);
        setJob(null);
        setState("complete");
        setMessage(
          `${response.graph.nodeCount.toLocaleString()} nodes rendered from ${(
            response.graph.projection
              ?.originalNodeCount ??
            response.graph.nodeCount
          ).toLocaleString()} total nodes.${
            response.executionFallback
              ? ` ${response.executionFallback}`
              : ""
          }`,
        );
        updateLocation(symbol, response.runId);
      } catch (caught) {
        if (isAbortError(caught) || !mounted.current) {
          return;
        }

        setState("error");
        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to build the research graph.",
        );
        setMessage(
          "The graph build did not complete.",
        );
      }
    },
    [pollJob, stopPolling, updateLocation],
  );

  useEffect(() => {
    mounted.current = true;
    const params = new URLSearchParams(
      window.location.search,
    );
    const initialSymbol =
      cleanIntelligenceSymbol(
        params.get("symbol") || "MSFT",
      ) || "MSFT";
    const initialRunId = params.get("runId");

    setSymbolInput(initialSymbol);
    setActiveSymbol(initialSymbol);
    void loadGraph({
      symbol: initialSymbol,
      projection: "overview",
      runId: initialRunId,
    });

    return () => {
      mounted.current = false;
      stopPolling();
      loadController.current?.abort();
      buildController.current?.abort();
    };
  }, [loadGraph, stopPolling]);

  useEffect(() => {
    if (!currentRunId || !activeSymbol) return;
    const currentMode =
      syncResult?.graph.projection?.mode ??
      graphView?.graph.projection?.mode;

    if (currentMode === projection) return;

    void loadGraph({
      symbol: activeSymbol,
      projection,
      runId: currentRunId,
      quiet: true,
    });
  }, [
    activeSymbol,
    currentRunId,
    graphView,
    loadGraph,
    projection,
    syncResult,
  ]);

  async function runRequestedGraph() {
    await runGraph({
      symbol: symbolInput,
      selectedPreset: preset,
      forceRefresh: true,
    });
  }

  async function cancelJob() {
    if (!job) return;

    try {
      const response =
        await intelligenceFetch<JobApiResponse>(
          `/api/jobs/${job.id}`,
          {
            method: "PATCH",
            body: JSON.stringify({
              action: "cancel",
            }),
          },
          {
            timeoutMs: 15_000,
          },
        );

      setJob(response.job);
      setState("idle");
      setMessage(
        "Graph build cancellation requested.",
      );
      stopPolling();
    } catch (caught) {
      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to cancel the graph build.",
      );
    }
  }

  const progress =
    job?.progress.value ??
    (state === "loading" ? 12 : 0);
  const persistenceLabel =
    syncResult?.graphPersistence.status ??
    graphView?.persistence.status ??
    (persistence?.configured
      ? "available"
      : "unavailable");
  const communities =
    currentAnalytics?.communities?.slice(0, 6) ?? [];
  const centralNodes =
    currentAnalytics?.pagerankTop?.slice(0, 6) ??
    currentAnalytics?.centralityTop.slice(0, 6) ??
    [];

  return (
    <IntelligencePage>
      <IntelligenceSurface className="p-5 sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-5xl">
            <div className="flex flex-wrap items-center gap-2">
              <IntelligencePill tone="emerald">
                <Network className="h-3.5 w-3.5" />
                Research knowledge graph
              </IntelligencePill>
              <IntelligencePill tone="cyan">
                <Layers3 className="h-3.5 w-3.5" />
                Progressive projections
              </IntelligencePill>
              <IntelligencePill tone="violet">
                <Bot className="h-3.5 w-3.5" />
                Up to 2,000 pathways
              </IntelligencePill>
              {currentGraph ? (
                <>
                  <IntelligencePill
                    tone={freshnessTone(graphFreshness.state)}
                  >
                    <Clock3 className="h-3.5 w-3.5" />
                    Graph {graphFreshness.label}
                  </IntelligencePill>
                  <IntelligencePill
                    tone={freshnessTone(providerFreshness.state)}
                  >
                    Provider {providerFreshness.label}
                  </IntelligencePill>
                </>
              ) : null}
            </div>

            <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] text-[var(--slice-heading)] sm:text-5xl xl:text-6xl">
              Build the complete relationship map without freezing the advisor workspace.
            </h1>
            <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-[var(--slice-muted)] sm:text-base">
              Saved graphs load first. Quick maps run synchronously;
              deep and maximum graphs use tracked background jobs when
              durable Neo4j persistence is available. The canvas adapts
              its edge budget, pixel ratio, and frame rate to the device.
            </p>
          </div>

          <Link
            href="/workspace/intelligence"
            prefetch={false}
            className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 text-xs font-black text-[var(--slice-text)] transition hover:border-[var(--slice-accent-border)]"
          >
            <ArrowLeft className="h-4 w-4" />
            Control plane
          </Link>
        </div>

        <div className="mt-7 grid gap-3 xl:grid-cols-[minmax(220px,0.9fr)_minmax(470px,1.6fr)_auto]">
          <label className="flex min-h-14 items-center rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 shadow-sm">
            <Search className="h-5 w-5 text-[var(--slice-accent-strong)]" />
            <input
              value={symbolInput}
              onChange={(
                event: ChangeEvent<HTMLInputElement>,
              ) =>
                setSymbolInput(
                  cleanIntelligenceSymbol(
                    event.target.value,
                  ),
                )
              }
              onKeyDown={(
                event: KeyboardEvent<HTMLInputElement>,
              ) => {
                if (event.key === "Enter" && !isBusy) {
                  void runRequestedGraph();
                }
              }}
              className="min-w-0 flex-1 bg-transparent px-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--slice-heading)] outline-none"
              placeholder="MSFT"
              aria-label="Security symbol"
            />
          </label>

          <div className="grid grid-cols-3 gap-2 rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-1.5">
            {(Object.keys(PRESETS) as BuildPreset[]).map(
              (item) => {
                const config = PRESETS[item];
                const active = preset === item;

                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => {
                      setPreset(item);
                      setProjection(config.projection);
                    }}
                    disabled={isBusy}
                    className={cx(
                      "rounded-xl px-3 py-2.5 text-left transition disabled:opacity-50",
                      active
                        ? "bg-[var(--slice-accent-strong)] text-white shadow-sm"
                        : "text-[var(--slice-muted)] hover:bg-[var(--slice-surface-strong)] hover:text-[var(--slice-heading)]",
                    )}
                  >
                    <span className="block text-xs font-black">
                      {config.label}
                    </span>
                    <span className="mt-1 hidden text-[9px] font-semibold opacity-80 sm:block">
                      {config.helper}
                    </span>
                  </button>
                );
              },
            )}
          </div>

          <button
            type="button"
            onClick={() => void runRequestedGraph()}
            disabled={
              isBusy ||
              !cleanIntelligenceSymbol(symbolInput)
            }
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(110deg,var(--slice-accent),var(--slice-accent-strong))] px-6 text-sm font-black text-white shadow-[0_14px_32px_var(--slice-accent-glow)] transition hover:brightness-105 disabled:opacity-50"
          >
            {isBusy ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
            {preset === "quick"
              ? "Build quick map"
              : "Build durable graph"}
          </button>
        </div>

        <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_280px]">
          <div className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-4">
            <div className="grid gap-3 sm:grid-cols-3">
              {[
                [
                  "Pathways",
                  PRESETS[preset].agents.toLocaleString(),
                ],
                [
                  "Simulation paths",
                  PRESETS[
                    preset
                  ].simulationPaths.toLocaleString(),
                ],
                [
                  "Execution",
                  PRESETS[preset].executionMode,
                ],
              ].map(([label, value]) => (
                <div key={label}>
                  <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                    {label}
                  </p>
                  <p className="mt-1 text-sm font-black capitalize text-[var(--slice-heading)]">
                    {value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          <label className="grid gap-1 rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 py-3 shadow-sm">
            <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">
              Visible graph detail
            </span>
            <select
              value={projection}
              onChange={(
                event: ChangeEvent<HTMLSelectElement>,
              ) =>
                setProjection(
                  event.target
                    .value as ResearchGraphProjectionMode,
                )
              }
              disabled={!currentRunId || isBusy}
              className="bg-transparent text-sm font-black text-[var(--slice-heading)] outline-none disabled:opacity-50"
            >
              <option value="overview">
                Overview · fastest
              </option>
              <option value="balanced">
                Balanced · recommended
              </option>
              <option value="full">
                Full · maximum detail
              </option>
            </select>
          </label>
        </div>

        <IntelligenceNotice
          className="mt-4"
          tone={
            state === "error"
              ? "rose"
              : state === "complete"
                ? "emerald"
                : state === "queued" ||
                    state === "processing"
                  ? "cyan"
                  : "slate"
          }
          icon={
            state === "error" ? (
              <AlertTriangle className="h-5 w-5" />
            ) : state === "complete" ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : isBusy ? (
              <RefreshCw className="h-5 w-5 animate-spin" />
            ) : (
              <Network className="h-5 w-5" />
            )
          }
        >
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div>
              <p>{error || message}</p>
              {job ? (
                <p className="mt-1 text-[10px] font-bold opacity-75">
                  Job {job.id.slice(0, 10)} · {job.status} ·
                  attempt {job.attempt}/{job.maxAttempts}
                </p>
              ) : null}
            </div>

            {job &&
            ["Queued", "Retrying", "Processing"].includes(
              job.status,
            ) ? (
              <button
                type="button"
                onClick={() => void cancelJob()}
                className="inline-flex min-h-9 shrink-0 items-center gap-2 rounded-xl border border-current/20 px-3 text-[10px] font-black"
              >
                <CircleStop className="h-4 w-4" />
                Cancel
              </button>
            ) : null}
          </div>

          {isBusy ? (
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <div
                className="h-full rounded-full bg-[var(--slice-accent-strong)] transition-[width] duration-500"
                style={{
                  width: `${Math.max(
                    0,
                    Math.min(100, progress),
                  )}%`,
                }}
              />
            </div>
          ) : null}
        </IntelligenceNotice>

        {currentGraph && (savedGraph || providerNeedsReview) ? (
          <IntelligenceNotice
            className="mt-4"
            tone={
              providerFreshness.state === "future" ||
              providerFreshness.state === "invalid"
                ? "rose"
                : savedGraph && graphFreshness.state !== "stale"
                  ? "cyan"
                  : "amber"
            }
            icon={<AlertTriangle className="h-4 w-4" />}
          >
            {savedGraph
              ? `This graph was loaded from ${graphView?.source ?? "saved storage"} and generated ${formatIntelligenceDate(graphGeneratedAt)} (${graphFreshness.label.toLowerCase()}). It remains valid historical evidence, but it is not relabeled as current market analysis.`
              : `The graph is current, but its provider timestamp needs review: ${providerFreshness.label}. Slice preserves the source time and warning rather than fabricating recency.`}
          </IntelligenceNotice>
        ) : null}
      </IntelligenceSurface>

      {currentGraph && currentAnalytics ? (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
            <IntelligenceMetric
              label="Slice score"
              value={formatIntelligenceNumber(
                metadata.score,
                1,
              )}
              helper="Original equal-third score."
              icon={<Gauge className="h-5 w-5" />}
            />
            <IntelligenceMetric
              label="Confidence"
              value={
                metadata.confidence === undefined
                  ? "—"
                  : `${formatIntelligenceNumber(
                      metadata.confidence,
                      0,
                    )}%`
              }
              helper="Evidence and agreement."
              icon={<ShieldCheck className="h-5 w-5" />}
            />
            <IntelligenceMetric
              label="Pathways"
              value={formatIntelligenceInteger(
                metadata.requestedAgents ??
                  metadata.activeAgents,
              )}
              helper="Media, technical, economy."
              icon={<Bot className="h-5 w-5" />}
              tone="violet"
            />
            <IntelligenceMetric
              label="Graph size"
              value={`${formatIntelligenceInteger(
                originalNodeCount,
              )} / ${formatIntelligenceInteger(
                originalEdgeCount,
              )}`}
              helper="Total nodes / relationships."
              icon={<Network className="h-5 w-5" />}
              tone="cyan"
            />
            <IntelligenceMetric
              label="Rendered"
              value={`${formatIntelligenceInteger(
                renderedNodeCount,
              )} / ${formatIntelligenceInteger(
                renderedEdgeCount,
              )}`}
              helper={`${projection} projection.`}
              icon={<Layers3 className="h-5 w-5" />}
              tone="cyan"
            />
            <IntelligenceMetric
              label="Connectedness"
              value={`${formatIntelligenceNumber(
                currentAnalytics.connectednessScore,
                0,
              )}%`}
              helper="Weighted graph cohesion."
              icon={<GitBranch className="h-5 w-5" />}
              tone="emerald"
            />
            <IntelligenceMetric
              label="Resilience"
              value={`${formatIntelligenceNumber(
                currentAnalytics.networkResilience,
                0,
              )}%`}
              helper="Network stability under stress."
              icon={<Waypoints className="h-5 w-5" />}
              tone="amber"
            />
            <IntelligenceMetric
              label="Graph age"
              value={graphFreshness.label}
              helper={`Generated ${formatIntelligenceDate(graphGeneratedAt)}.`}
              icon={<Clock3 className="h-5 w-5" />}
              tone={freshnessTone(graphFreshness.state)}
            />
          </section>

          <IntelligenceSurface className="mt-5 p-3 sm:p-4">
            <ResearchKnowledgeGraphCanvas
              graph={currentGraph}
              analytics={currentAnalytics}
              height={700}
              live
            />
          </IntelligenceSurface>

          <section className="mt-5 grid gap-5 xl:grid-cols-2">
            <IntelligenceSurface className="p-5 sm:p-6">
              <IntelligenceSectionHeading
                eyebrow="Graph communities"
                title="Dominant relationship clusters"
                description="The largest communities expose where evidence and analytical pathways are concentrating."
              />
              <div className="mt-5 space-y-3">
                {communities.length ? (
                  communities.map((community) => (
                    <div
                      key={community.id}
                      className="flex items-center justify-between gap-4 rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4"
                    >
                      <div className="min-w-0">
                        <p className="truncate text-sm font-black text-[var(--slice-heading)]">
                          {community.label}
                        </p>
                        <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                          {community.cohort} ·{" "}
                          {community.edgeCount.toLocaleString()}{" "}
                          internal relationships
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-xl font-black text-[var(--slice-heading)]">
                          {community.nodeCount.toLocaleString()}
                        </p>
                        <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                          nodes
                        </p>
                      </div>
                    </div>
                  ))
                ) : (
                  <p className="rounded-2xl border border-dashed border-[var(--slice-border-strong)] bg-[var(--slice-surface-muted)] p-5 text-sm font-semibold text-[var(--slice-muted)]">
                    Community diagnostics were not present in this
                    saved graph.
                  </p>
                )}
              </div>
            </IntelligenceSurface>

            <IntelligenceSurface className="p-5 sm:p-6">
              <IntelligenceSectionHeading
                eyebrow="Centrality"
                title="Most influential nodes"
                description="High-centrality nodes connect the largest number of material evidence paths."
              />
              <div className="mt-5 space-y-3">
                {centralNodes.map((node, index) => (
                  <div
                    key={node.id}
                    className="flex items-center gap-4 rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4"
                  >
                    <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-sm font-black text-[var(--slice-accent-strong)]">
                      {index + 1}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-black text-[var(--slice-heading)]">
                        {node.label}
                      </p>
                      <p className="mt-1 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                        {node.kind} · {node.cohort}
                      </p>
                    </div>
                    <span className="text-sm font-black text-[var(--slice-accent-strong)]">
                      {formatIntelligenceNumber(
                        "centralityScore" in node
                          ? node.centralityScore
                          : node.score,
                        0,
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </IntelligenceSurface>
          </section>
        </>
      ) : state !== "loading" ? (
        <IntelligenceSurface className="mt-5 p-6 sm:p-8">
          <div className="grid min-h-[380px] place-items-center text-center">
            <div className="max-w-2xl">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-[var(--slice-accent-strong)]">
                <Network className="h-8 w-8" />
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
                No graph was built automatically
              </h2>
              <p className="mt-3 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
                This is intentional. Select Quick map for a fast
                interactive graph, or choose a durable deep build when
                the evidence warrants it. Page navigation never starts
                a provider scan or 600-pathway build.
              </p>
              <div className="mt-6 flex flex-wrap justify-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    void runGraph({
                      symbol: activeSymbol,
                      selectedPreset: "quick",
                      forceRefresh: true,
                    })
                  }
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl bg-[var(--slice-accent-strong)] px-4 text-xs font-black text-white"
                >
                  <Play className="h-4 w-4 fill-current" />
                  Build quick map
                </button>
                <Link
                  href="/workspace/intelligence"
                  prefetch={false}
                  className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 text-xs font-black text-[var(--slice-text)]"
                >
                  <Sparkles className="h-4 w-4" />
                  Run score research first
                </Link>
              </div>
            </div>
          </div>
        </IntelligenceSurface>
      ) : null}

      <IntelligenceSurface className="mt-5 p-5 sm:p-6">
        <IntelligenceSectionHeading
          eyebrow="Persistence readiness"
          title="Durable graph storage"
          description="Deep background builds require a configured and enabled Neo4j connection. Quick synchronous maps remain usable in the current session without it."
        />
        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {[
            [
              "Configured",
              persistence?.configured ? "Yes" : "No",
            ],
            [
              "Persistence state",
              persistenceLabel,
            ],
            [
              "Graph generated",
              `${formatIntelligenceDate(graphGeneratedAt)} · ${graphFreshness.label}`,
            ],
            [
              "Provider as of",
              `${formatIntelligenceDate(metadata.providerAsOf)} · ${providerFreshness.label}`,
            ],
          ].map(([label, value]) => (
            <div
              key={label}
              className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4"
            >
              <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[var(--slice-subtle)]">
                {label}
              </p>
              <p className="mt-2 truncate text-base font-black text-[var(--slice-heading)]">
                {value}
              </p>
            </div>
          ))}
        </div>

        {persistence?.missing.length ? (
          <IntelligenceNotice
            className="mt-4"
            tone="amber"
            icon={<AlertTriangle className="h-4 w-4" />}
          >
            Missing server configuration:{" "}
            {persistence.missing.join(", ")}. No credential
            values are exposed here.
          </IntelligenceNotice>
        ) : null}
      </IntelligenceSurface>
    </IntelligencePage>
  );
}