"use client";

import Link from "next/link";
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  Bot,
  BrainCircuit,
  CheckCircle2,
  CircleStop,
  Clock3,
  Database,
  Gauge,
  GitBranch,
  Layers3,
  Network,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
  Sparkles,
  Target,
  Waypoints,
  Zap,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
  type ReactNode,
} from "react";

import ResearchKnowledgeGraphCanvas from "@/components/intelligence/research-knowledge-graph";
import type {
  ResearchGraphProjectionMode,
  ResearchGraphViewResponse,
  ResearchSwarmResponse,
} from "@/lib/intelligence/research-swarm-types";

type BuildPreset = "quick" | "deep" | "maximum";
type BuildState = "idle" | "loading" | "queued" | "processing" | "complete" | "error";

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

type BuildResponse = SyncBuildResponse | BackgroundBuildResponse;

type GraphApiResponse = {
  ok: true;
  symbol: string;
  view: ResearchGraphViewResponse | null;
  empty: boolean;
  message: string;
};

type JobApiResponse = {
  ok: true;
  job: PublicJob;
};

const panelClass =
  "rounded-[1.75rem] border border-white/10 bg-black/62 shadow-2xl shadow-black/40 backdrop-blur-xl";
const PRESETS: Record<
  BuildPreset,
  {
    label: string;
    helper: string;
    agents: number;
    projection: ResearchGraphProjectionMode;
    simulationPaths: number;
  }
> = {
  quick: {
    label: "Quick map",
    helper: "Fast decision view",
    agents: 600,
    projection: "overview",
    simulationPaths: 300,
  },
  deep: {
    label: "Deep research",
    helper: "Balanced detail and speed",
    agents: 1_200,
    projection: "balanced",
    simulationPaths: 750,
  },
  maximum: {
    label: "Build full graph",
    helper: "Full 2,000-pathway build",
    agents: 2_000,
    projection: "full",
    simulationPaths: 1_250,
  },
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function cleanSymbol(value: string) {
  return value
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-:$]/g, "")
    .slice(0, 24);
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

function integer(value: number | null | undefined) {
  return value === null || value === undefined || !Number.isFinite(value)
    ? "—"
    : Math.round(value).toLocaleString("en-US");
}

function dateTime(value: string | null | undefined) {
  if (!value) return "—";
  const parsed = new Date(value);
  return Number.isFinite(parsed.getTime())
    ? parsed.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : value;
}

function isBackgroundResponse(value: BuildResponse): value is BackgroundBuildResponse {
  return value.executionMode === "background";
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  });
  const body = (await response.json().catch(() => ({}))) as T & {
    error?: string | { message?: string };
    message?: string;
    detail?: string;
  };

  if (!response.ok) {
    const errorMessage =
      typeof body.error === "string" ? body.error : body.error?.message;
    throw new Error(
      body.detail || errorMessage || body.message || `Request failed with HTTP ${response.status}.`,
    );
  }

  return body;
}

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "emerald" | "cyan" | "purple" | "amber" | "orange" | "slate";
}) {
  const tones = {
    emerald: "border-emerald-400/25 bg-emerald-500/10 text-emerald-100",
    cyan: "border-cyan-400/25 bg-cyan-500/10 text-cyan-100",
    purple: "border-purple-400/25 bg-purple-500/10 text-purple-100",
    amber: "border-amber-400/25 bg-amber-500/10 text-amber-100",
    orange: "border-orange-400/25 bg-orange-500/10 text-orange-100",
    slate: "border-white/10 bg-white/[0.045] text-slate-300",
  } as const;

  return (
    <span
      className={cx(
        "inline-flex items-center gap-2 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em]",
        tones[tone],
      )}
    >
      {children}
    </span>
  );
}

function Metric({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className={cx(panelClass, "p-4")}>
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-[10px] font-black uppercase tracking-[0.15em] text-slate-600">
            {label}
          </p>
          <p className="mt-2 truncate text-2xl font-black tracking-tight text-white">
            {value}
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
            {helper}
          </p>
        </div>
        <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.07] text-emerald-300">
          {icon}
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value }: { value: number }) {
  return (
    <div
      className="h-2 overflow-hidden rounded-full bg-white/[0.06]"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.max(0, Math.min(100, value))}
    >
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-400 via-emerald-600 to-cyan-500 transition-[width] duration-500"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function Skeleton() {
  return (
    <div className="mt-5 grid gap-5" aria-label="Loading intelligence graph">
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className={cx(panelClass, "h-28 animate-pulse bg-white/[0.035]")} />
        ))}
      </div>
      <div className={cx(panelClass, "h-[720px] animate-pulse bg-white/[0.025]")} />
    </div>
  );
}

export default function IntelligenceKnowledgeGraphPage() {
  const [symbolInput, setSymbolInput] = useState("MSFT");
  const [activeSymbol, setActiveSymbol] = useState("MSFT");
  const [preset, setPreset] = useState<BuildPreset>("deep");
  const [agentCount, setAgentCount] = useState(PRESETS.deep.agents);
  const [projection, setProjection] =
    useState<ResearchGraphProjectionMode>(PRESETS.deep.projection);
  const [swarm, setSwarm] = useState<SyncBuildResponse | null>(null);
  const [graphView, setGraphView] = useState<ResearchGraphViewResponse | null>(null);
  const [job, setJob] = useState<PublicJob | null>(null);
  const [state, setState] = useState<BuildState>("idle");
  const [message, setMessage] = useState("Loading the latest verified intelligence graph.");
  const [error, setError] = useState("");
  const [autoStarted, setAutoStarted] = useState(false);
  const pollTimerRef = useRef<number | null>(null);
  const mountedRef = useRef(true);

  const currentGraph = swarm?.graph ?? graphView?.graph ?? null;
  const currentAnalytics = swarm?.graphAnalytics ?? graphView?.analytics ?? null;
  const currentRunId = swarm?.runId ?? graphView?.runId ?? null;
  const metadata: ResearchGraphViewResponse["metadata"] = swarm
    ? {
        companyName: swarm.companyName,
        sector: swarm.sector,
        industry: swarm.industry,
        requestedAgents: swarm.requestedAgents,
        activeAgents: swarm.activeAgents,
        score: swarm.score.overall,
        confidence: swarm.score.confidence,
        providerAsOf: swarm.providerAsOf,
        durationMs: swarm.durationMs,
      }
    : graphView?.metadata ?? {};

  const scoreNode = useMemo(
    () => currentGraph?.nodes.find((node) => node.kind === "score") ?? null,
    [currentGraph],
  );
  const score = metadata.score ?? scoreNode?.score ?? null;
  const confidence = metadata.confidence ?? scoreNode?.confidence ?? null;
  const originalNodeCount =
    currentGraph?.projection?.originalNodeCount ?? currentGraph?.nodeCount ?? 0;
  const originalEdgeCount =
    currentGraph?.projection?.originalEdgeCount ?? currentGraph?.edgeCount ?? 0;
  const shownNodeCount = currentGraph?.nodeCount ?? 0;
  const shownEdgeCount = currentGraph?.edgeCount ?? 0;
  const activeAgents =
    metadata.activeAgents ??
    currentGraph?.nodes.filter((node) => node.kind === "agent").length ??
    0;

  const stopPolling = useCallback(() => {
    if (pollTimerRef.current !== null) {
      window.clearTimeout(pollTimerRef.current);
      pollTimerRef.current = null;
    }
  }, []);

  const updateLocation = useCallback((symbol: string, runId?: string | null) => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    url.searchParams.set("symbol", symbol);
    if (runId) url.searchParams.set("runId", runId);
    else url.searchParams.delete("runId");
    window.history.replaceState({}, "", `${url.pathname}${url.search}`);
  }, []);

  const loadGraph = useCallback(
    async (input: {
      symbol: string;
      projection: ResearchGraphProjectionMode;
      runId?: string | null;
      quiet?: boolean;
    }) => {
      const params = new URLSearchParams({
        symbol: input.symbol,
        projection: input.projection,
      });
      if (input.runId) params.set("runId", input.runId);
      if (!input.quiet) {
        setState("loading");
        setMessage(`Loading the latest ${input.symbol} graph.`);
      }
      const response = await fetchJson<GraphApiResponse>(
        `/api/intelligence/research-graph?${params.toString()}`,
      );
      if (!mountedRef.current) return null;
      setGraphView(response.view);
      setSwarm(null);

      if (response.view) {
        setActiveSymbol(response.view.symbol || input.symbol);
        setState("complete");
        setError("");
        setMessage(
          `${response.view.graph.nodeCount.toLocaleString()} rendered nodes from ${(
            response.view.graph.projection?.originalNodeCount ??
            response.view.graph.nodeCount
          ).toLocaleString()} total nodes.`,
        );
        updateLocation(response.view.symbol || input.symbol, response.view.runId);
      } else if (!input.quiet) {
        setState("idle");
        setMessage(response.message);
      }

      return response.view;
    },
    [updateLocation],
  );

  const pollJob = useCallback(
    async (jobId: string, symbol: string) => {
      stopPolling();

      const check = async () => {
        if (!mountedRef.current) return;
        if (document.visibilityState === "hidden") {
          pollTimerRef.current = window.setTimeout(check, 2_500);
          return;
        }

        try {
          const response = await fetchJson<JobApiResponse>(`/api/jobs/${jobId}`);
          if (!mountedRef.current) return;
          setJob(response.job);
          setState(response.job.status === "Processing" ? "processing" : "queued");
          setMessage(
            response.job.progress.message ||
              `${response.job.jobName}: ${response.job.status}`,
          );

          if (response.job.status === "Complete") {
            stopPolling();
            setState("loading");
            setMessage("Loading the completed knowledge graph.");
            const completedView = await loadGraph({
              symbol,
              projection,
              quiet: true,
            });
            if (!completedView) {
              setState("error");
              setError(
                "The research job completed, but its persisted graph could not be loaded. Check Neo4j health and retry the build.",
              );
              return;
            }
            setState("complete");
            setMessage("The completed research graph is ready.");
            return;
          }

          if (
            response.job.status === "Failed" ||
            response.job.status === "DeadLetter" ||
            response.job.status === "Cancelled"
          ) {
            stopPolling();
            setState(response.job.status === "Cancelled" ? "idle" : "error");
            setError(
              response.job.lastError?.message ||
                response.job.error ||
                `Graph build ended with status ${response.job.status}.`,
            );
            return;
          }

          pollTimerRef.current = window.setTimeout(check, 1_500);
        } catch (caught) {
          stopPolling();
          setState("error");
          setError(caught instanceof Error ? caught.message : "Unable to read graph-job status.");
        }
      };

      await check();
    },
    [loadGraph, projection, stopPolling],
  );

  const runGraph = useCallback(
    async (input: {
      symbol: string;
      agents: number;
      selectedPreset: BuildPreset;
      forceRefresh?: boolean;
      silent?: boolean;
    }) => {
      stopPolling();
      const clean = cleanSymbol(input.symbol) || "MSFT";
      const presetConfig = PRESETS[input.selectedPreset];
      const graphMode = input.agents <= 700 ? "summary" : "full";
      const nextProjection = presetConfig.projection;
      setActiveSymbol(clean);
      setSymbolInput(clean);
      setProjection(nextProjection);
      setState("loading");
      setError("");
      setJob(null);
      setMessage(
        input.agents > 900
          ? `Preparing ${input.agents.toLocaleString()} research pathways. Durable deployments continue the full build in the background.`
          : `Building a fast ${input.agents.toLocaleString()}-pathway map for ${clean}.`,
      );

      try {
        const response = await fetchJson<BuildResponse>(
          "/api/intelligence/research-swarm",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              symbol: clean,
              agentCount: input.agents,
              simulationPaths: presetConfig.simulationPaths,
              graphMode,
              detailMode: graphMode === "full" ? "graph" : "summary",
              projection: nextProjection,
              persistGraph: true,
              forceRefresh: input.forceRefresh === true,
              executionMode: input.agents > 900 ? "background" : "sync",
            }),
          },
        );

        if (!mountedRef.current) return;

        if (isBackgroundResponse(response)) {
          setJob(response.job);
          setState(response.job.status === "Processing" ? "processing" : "queued");
          setMessage(response.message);
          await pollJob(response.job.id, clean);
          return;
        }

        setSwarm(response);
        setGraphView(null);
        setState("complete");
        setMessage(
          `${response.graph.nodeCount.toLocaleString()} rendered nodes from ${(
            response.graph.projection?.originalNodeCount ?? response.graph.nodeCount
          ).toLocaleString()} total nodes.`,
        );
        updateLocation(clean, response.runId);
      } catch (caught) {
        if (!mountedRef.current) return;
        setState("error");
        setError(caught instanceof Error ? caught.message : "Unable to build the research graph.");
        setMessage("The graph build did not complete.");
      }
    },
    [pollJob, stopPolling, updateLocation],
  );

  useEffect(() => {
    mountedRef.current = true;
    const params = new URLSearchParams(window.location.search);
    const initialSymbol = cleanSymbol(params.get("symbol") || "MSFT") || "MSFT";
    const initialRunId = params.get("runId");
    setSymbolInput(initialSymbol);
    setActiveSymbol(initialSymbol);

    void (async () => {
      try {
        const existing = await loadGraph({
          symbol: initialSymbol,
          projection: PRESETS.deep.projection,
          runId: initialRunId,
        });

        if (!existing && !autoStarted) {
          setAutoStarted(true);
          setPreset("quick");
          setAgentCount(PRESETS.quick.agents);
          await runGraph({
            symbol: initialSymbol,
            agents: PRESETS.quick.agents,
            selectedPreset: "quick",
            silent: true,
          });
        }
      } catch (caught) {
        setState("error");
        setError(caught instanceof Error ? caught.message : "Unable to load intelligence graph.");
      }
    })();

    return () => {
      mountedRef.current = false;
      stopPolling();
    };
    // Initial route resolution should run once.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!currentRunId || !activeSymbol) return;
    if (swarm?.graph.projection?.mode === projection) return;
    if (graphView?.graph.projection?.mode === projection) return;

    void loadGraph({
      symbol: activeSymbol,
      projection,
      runId: currentRunId,
      quiet: true,
    }).catch((caught) => {
      setError(caught instanceof Error ? caught.message : "Unable to change graph detail.");
    });
  }, [activeSymbol, currentRunId, graphView, loadGraph, projection, swarm]);

  function choosePreset(next: BuildPreset) {
    const config = PRESETS[next];
    setPreset(next);
    setAgentCount(config.agents);
    setProjection(config.projection);
  }

  async function runRequestedGraph() {
    await runGraph({
      symbol: symbolInput,
      agents: agentCount,
      selectedPreset: preset,
      forceRefresh: true,
    });
  }

  async function cancelJob() {
    if (!job) return;
    try {
      const response = await fetchJson<JobApiResponse>(`/api/jobs/${job.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "cancel" }),
      });
      setJob(response.job);
      setState("idle");
      setMessage("Graph build cancellation requested.");
      stopPolling();
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Unable to cancel graph build.");
    }
  }

  const progress = job?.progress.value ?? (state === "loading" ? 12 : 0);
  const isBusy = ["loading", "queued", "processing"].includes(state);
  const persistenceLabel = swarm
    ? swarm.graphPersistence.status
    : graphView?.persistence.status ?? "unavailable";

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 text-white sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-12rem] top-[-12rem] h-[36rem] w-[36rem] rounded-full bg-emerald-700/15 blur-3xl" />
        <div className="absolute right-[-14rem] top-[7rem] h-[38rem] w-[38rem] rounded-full bg-cyan-800/[0.07] blur-3xl" />
        <div className="absolute inset-0 bg-[linear-gradient(rgba(52,211,153,0.025)_1px,transparent_1px),linear-gradient(90deg,rgba(52,211,153,0.025)_1px,transparent_1px)] bg-[size:48px_48px]" />
      </div>

      <div className="mx-auto max-w-[1950px]">
        <section className={cx(panelClass, "p-5 sm:p-7")}>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-5xl">
              <div className="flex flex-wrap items-center gap-2">
                <Pill tone="emerald">
                  <Network className="h-3.5 w-3.5" />
                  Live Research Knowledge Graph
                </Pill>
                <Pill tone="cyan">
                  <Zap className="h-3.5 w-3.5" />
                  Progressive rendering
                </Pill>
                <Pill tone="purple">
                  <Bot className="h-3.5 w-3.5" />
                  Up to 2,000 pathways
                </Pill>
              </div>
              <h1 className="mt-4 text-4xl font-black tracking-[-0.045em] sm:text-6xl">
                Understand the score without fighting the graph.
              </h1>
              <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-slate-400 sm:text-base">
                Slice keeps the existing equal-third media, technical, and economy model,
                then adds PageRank, bridge analysis, community detection, contradiction
                topology, source concentration, and network resilience. Use a fast overview
                for decisions or reveal the complete pathway map when deeper inspection matters.
              </p>
            </div>

            <Link
              href="/workspace/intelligence"
              className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black text-slate-300 transition hover:border-emerald-400/25 hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Intelligence Control Plane
            </Link>
          </div>

          <div className="mt-7 grid gap-3 xl:grid-cols-[minmax(220px,0.9fr)_minmax(420px,1.6fr)_auto]">
            <label className="flex items-center rounded-2xl border border-white/10 bg-black/45 px-4">
              <Search className="h-5 w-5 text-emerald-300" />
              <input
                value={symbolInput}
                onChange={(event: ChangeEvent<HTMLInputElement>) => setSymbolInput(cleanSymbol(event.target.value))}
                onKeyDown={(event: KeyboardEvent<HTMLInputElement>) => {
                  if (event.key === "Enter" && !isBusy) void runRequestedGraph();
                }}
                className="h-14 min-w-0 flex-1 bg-transparent px-4 text-sm font-black uppercase tracking-[0.12em] text-white outline-none"
                placeholder="MSFT"
                aria-label="Security symbol"
              />
            </label>

            <div className="grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-black/45 p-1.5">
              {(Object.keys(PRESETS) as BuildPreset[]).map((item) => {
                const config = PRESETS[item];
                const active = preset === item;
                return (
                  <button
                    key={item}
                    type="button"
                    onClick={() => choosePreset(item)}
                    disabled={isBusy}
                    className={cx(
                      "rounded-xl px-3 py-2.5 text-left transition disabled:opacity-50",
                      active
                        ? "bg-emerald-600 text-white shadow-lg shadow-emerald-950/35"
                        : "text-slate-400 hover:bg-white/[0.055] hover:text-white",
                    )}
                  >
                    <span className="block text-xs font-black">{config.label}</span>
                    <span className="mt-1 hidden text-[10px] font-semibold opacity-75 sm:block">
                      {config.helper}
                    </span>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => void runRequestedGraph()}
              disabled={isBusy || !cleanSymbol(symbolInput)}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-6 text-sm font-black text-white shadow-xl shadow-emerald-950/35 transition hover:bg-emerald-500 disabled:opacity-50"
            >
              {isBusy ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              {agentCount > 900 ? "Build deep graph" : "Build graph"}
            </button>
          </div>

          <div className="mt-3 grid gap-3 lg:grid-cols-[1fr_280px]">
            <label className="rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
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
                disabled={isBusy}
                onChange={(event: ChangeEvent<HTMLInputElement>) => {
                  const next = Number(event.target.value);
                  setAgentCount(next);
                  setPreset(next <= 700 ? "quick" : next <= 1_400 ? "deep" : "maximum");
                }}
                className="mt-2 w-full accent-emerald-600 disabled:opacity-50"
              />
            </label>

            <label className="grid gap-1 rounded-2xl border border-white/10 bg-white/[0.025] px-4 py-3">
              <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                Visible graph detail
              </span>
              <select
                value={projection}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setProjection(event.target.value as ResearchGraphProjectionMode)
                }
                disabled={!currentRunId || isBusy}
                className="bg-transparent text-sm font-black text-white outline-none disabled:opacity-50"
              >
                <option className="bg-zinc-950" value="overview">Overview · fastest</option>
                <option className="bg-zinc-950" value="balanced">Balanced · recommended</option>
                <option className="bg-zinc-950" value="full">Full · maximum detail</option>
              </select>
            </label>
          </div>

          <div
            className={cx(
              "mt-4 rounded-2xl border p-4",
              error
                ? "border-emerald-400/25 bg-emerald-500/10"
                : "border-white/10 bg-white/[0.025]",
            )}
            role="status"
            aria-live="polite"
          >
            <div className="flex items-start gap-3">
              {state === "complete" ? (
                <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              ) : state === "error" ? (
                <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              ) : isBusy ? (
                <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-emerald-300" />
              ) : (
                <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
              )}
              <div className="min-w-0 flex-1">
                <div className="text-sm font-bold leading-6 text-slate-200">
                  {error || message}
                </div>
                {job ? (
                  <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1 text-[11px] font-semibold text-slate-500">
                    <span>Job {job.id.slice(0, 10)}</span>
                    <span>{job.status}</span>
                    <span>Attempt {job.attempt}/{job.maxAttempts}</span>
                  </div>
                ) : null}
              </div>
              {job && ["Queued", "Retrying", "Processing"].includes(job.status) ? (
                <button
                  type="button"
                  onClick={() => void cancelJob()}
                  className="inline-flex shrink-0 items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-3 py-2 text-xs font-black text-slate-300 hover:text-white"
                >
                  <CircleStop className="h-4 w-4" />
                  Cancel
                </button>
              ) : null}
            </div>
            {isBusy ? <div className="mt-3"><ProgressBar value={progress} /></div> : null}
          </div>
        </section>

        {state === "loading" && !currentGraph ? <Skeleton /> : null}

        {currentGraph && currentAnalytics ? (
          <>
            <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-8">
              <Metric
                label="Slice score"
                value={number(score, 1)}
                helper="Original equal-third model"
                icon={<Gauge className="h-5 w-5" />}
              />
              <Metric
                label="Confidence"
                value={confidence === null ? "—" : `${number(confidence, 0)}%`}
                helper="Evidence and agreement"
                icon={<ShieldCheck className="h-5 w-5" />}
              />
              <Metric
                label="Pathways"
                value={integer(metadata.requestedAgents ?? activeAgents)}
                helper="Media, technical, economy"
                icon={<Bot className="h-5 w-5" />}
              />
              <Metric
                label="Graph size"
                value={`${integer(originalNodeCount)} / ${integer(originalEdgeCount)}`}
                helper="Total nodes / relationships"
                icon={<Network className="h-5 w-5" />}
              />
              <Metric
                label="Rendered now"
                value={`${integer(shownNodeCount)} / ${integer(shownEdgeCount)}`}
                helper={`${projection} projection`}
                icon={<Layers3 className="h-5 w-5" />}
              />
              <Metric
                label="Connectedness"
                value={`${number(currentAnalytics.connectednessScore, 0)}%`}
                helper="Weighted graph cohesion"
                icon={<GitBranch className="h-5 w-5" />}
              />
              <Metric
                label="Resilience"
                value={
                  currentAnalytics.networkResilience === undefined
                    ? "—"
                    : `${number(currentAnalytics.networkResilience, 0)}%`
                }
                helper="After central-node removal"
                icon={<Waypoints className="h-5 w-5" />}
              />
              <Metric
                label="Communities"
                value={integer(currentAnalytics.communities?.length)}
                helper="Detected research groups"
                icon={<Target className="h-5 w-5" />}
              />
            </section>

            <section className="mt-5">
              <ResearchKnowledgeGraphCanvas
                graph={currentGraph}
                analytics={currentAnalytics}
                height={820}
                live
              />
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[1.15fr_0.85fr]">
              <div className={cx(panelClass, "p-5 sm:p-6")}>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
                  <div>
                    <Pill tone="cyan">
                      <Activity className="h-3.5 w-3.5" />
                      Algorithm diagnostics
                    </Pill>
                    <h2 className="mt-3 text-2xl font-black">Deeper insight, unchanged score semantics</h2>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-slate-500">
                      Advanced algorithms explain graph structure and uncertainty. They do not
                      secretly reweight the existing one-third media, one-third technical, and
                      one-third economy Slice score.
                    </p>
                  </div>
                  <Pill tone="emerald">Phase 10 graph engine</Pill>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {[
                    [
                      "PageRank leader",
                      currentAnalytics.pagerankTop?.[0]?.label || "—",
                      currentAnalytics.pagerankTop?.[0]
                        ? `${number(currentAnalytics.pagerankTop[0].score * 100, 1)} influence`
                        : "Weighted influence",
                    ],
                    [
                      "Bridge leader",
                      currentAnalytics.betweennessTop?.[0]?.label ||
                        currentAnalytics.bridgeNodes[0]?.label ||
                        "—",
                      "Cross-cluster connector",
                    ],
                    [
                      "Source concentration",
                      currentAnalytics.sourceConcentration === undefined
                        ? "—"
                        : `${number(currentAnalytics.sourceConcentration, 1)}%`,
                      "Lower is more diverse",
                    ],
                    [
                      "Contradiction ratio",
                      currentAnalytics.contradictionRatio === undefined
                        ? "—"
                        : `${number(currentAnalytics.contradictionRatio, 1)}%`,
                      "Disagreement relationships",
                    ],
                  ].map(([label, value, helper]) => (
                    <div key={label} className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                        {label}
                      </p>
                      <p className="mt-2 line-clamp-2 text-lg font-black text-white">{value}</p>
                      <p className="mt-2 text-xs font-semibold text-slate-500">{helper}</p>
                    </div>
                  ))}
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {currentGraph.clusters.map((cluster) => (
                    <div key={cluster.id} className="rounded-2xl border border-white/8 bg-black/28 p-4">
                      <p className="text-sm font-black text-white">{cluster.label}</p>
                      <p className="mt-3 text-3xl font-black text-white">
                        {cluster.nodeCount.toLocaleString()}
                      </p>
                      <p className="mt-1 text-xs font-semibold text-slate-500">
                        nodes · score {number(cluster.averageScore, 1)}
                      </p>
                    </div>
                  ))}
                </div>
              </div>

              <div className={cx(panelClass, "p-5 sm:p-6")}>
                <Pill tone="emerald">
                  <Database className="h-3.5 w-3.5" />
                  Persistence and freshness
                </Pill>
                <h2 className="mt-3 text-2xl font-black">Research run state</h2>

                <div className="mt-5 grid gap-3">
                  {[
                    ["Symbol", activeSymbol],
                    ["Company", metadata.companyName || "—"],
                    ["Sector", metadata.sector || "—"],
                    ["Industry", metadata.industry || "—"],
                    ["Generated", dateTime(currentGraph.generatedAt)],
                    ["Provider as of", dateTime(metadata.providerAsOf)],
                    ["Build duration", metadata.durationMs ? `${number(metadata.durationMs / 1_000, 2)}s` : "—"],
                    ["Neo4j", persistenceLabel],
                  ].map(([label, value]) => (
                    <div key={label} className="flex items-start justify-between gap-4 rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3">
                      <span className="text-[10px] font-black uppercase tracking-[0.13em] text-slate-600">
                        {label}
                      </span>
                      <span className="max-w-[65%] text-right text-xs font-black text-slate-200">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>

                {currentAnalytics.contradictionHotspots.length ? (
                  <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-500/[0.05] p-4">
                    <div className="flex items-center gap-2 text-xs font-black text-amber-100">
                      <AlertTriangle className="h-4 w-4" />
                      Highest contradiction hotspot
                    </div>
                    <p className="mt-2 text-sm font-black text-white">
                      {currentAnalytics.contradictionHotspots[0]?.label}
                    </p>
                    <p className="mt-1 text-xs font-semibold text-slate-500">
                      Severity {number(currentAnalytics.contradictionHotspots[0]?.severity, 0)}
                    </p>
                  </div>
                ) : null}

                <div className="mt-4 rounded-2xl border border-white/8 bg-white/[0.025] p-4 text-xs font-semibold leading-6 text-slate-500">
                  <div className="flex items-center gap-2 font-black text-slate-200">
                    <Clock3 className="h-4 w-4 text-emerald-300" />
                    Fast by default
                  </div>
                  The overview and balanced projections keep all central pathways and selected-node
                  context while withholding low-priority visual detail until requested. The full
                  graph remains available from the detail selector.
                </div>
              </div>
            </section>

            {swarm?.warnings.length ? (
              <section className={cx(panelClass, "mt-5 p-5")}>
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-[0.14em] text-amber-200">
                  <AlertTriangle className="h-4 w-4" />
                  Active data limitations
                </div>
                <div className="mt-3 grid gap-2">
                  {swarm.warnings.slice(0, 6).map((warning) => (
                    <p key={warning} className="rounded-xl border border-white/8 bg-white/[0.025] px-4 py-3 text-xs font-semibold leading-5 text-slate-400">
                      {warning}
                    </p>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : state !== "loading" ? (
          <section className={cx(panelClass, "mt-5 grid min-h-[380px] place-items-center p-8 text-center")}>
            <div className="max-w-xl">
              <Sparkles className="mx-auto h-10 w-10 text-emerald-300" />
              <h2 className="mt-4 text-2xl font-black">Build the first research map</h2>
              <p className="mt-3 text-sm font-semibold leading-7 text-slate-500">
                Enter a public symbol and choose Quick map for a fast decision view, or Deep
                research for a durable graph that continues building in the background.
              </p>
              <button
                type="button"
                onClick={() => void runRequestedGraph()}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-black text-white"
              >
                <Play className="h-4 w-4 fill-current" />
                Build {cleanSymbol(symbolInput) || "MSFT"}
              </button>
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}