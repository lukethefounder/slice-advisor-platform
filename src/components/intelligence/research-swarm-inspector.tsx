"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  BrainCircuit,
  CheckCircle2,
  ChevronLeft,
  Clock3,
  ChevronRight,
  Filter,
  Network,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type CSSProperties,
  type KeyboardEvent,
} from "react";

import {
  IntelligenceMetric,
  IntelligenceNotice,
  IntelligencePage,
  IntelligencePill,
  IntelligenceSectionHeading,
  IntelligenceSurface,
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
  ResearchAgent,
  ResearchCohort,
  ResearchSwarmResponse,
} from "@/lib/intelligence/research-swarm-types";

const PAGE_SIZE = 24;

function cohortTone(cohort: ResearchCohort) {
  return cohort === "media"
    ? ("amber" as const)
    : cohort === "technical"
      ? ("cyan" as const)
      : ("violet" as const);
}

function statusTone(status: ResearchAgent["status"]) {
  return status === "completed"
    ? ("emerald" as const)
    : status === "degraded"
      ? ("amber" as const)
      : ("rose" as const);
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

function AgentCard({ agent }: { agent: ResearchAgent }) {
  const virtualStyle = {
    contentVisibility: "auto",
    containIntrinsicSize: "320px",
  } as CSSProperties;

  return (
    <article
      className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4 shadow-sm"
      style={virtualStyle}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <IntelligencePill tone={cohortTone(agent.cohort)}>
              {agent.cohort}
            </IntelligencePill>
            <IntelligencePill tone={statusTone(agent.status)}>
              {agent.status}
            </IntelligencePill>
          </div>
          <h3 className="mt-3 text-base font-black text-[var(--slice-heading)]">
            {agent.role} #{agent.ordinal}
          </h3>
          <p className="mt-2 text-xs font-semibold leading-5 text-[var(--slice-muted)]">
            {agent.pathway}
          </p>
        </div>

        <div className="grid shrink-0 grid-cols-3 gap-2 text-center sm:w-72">
          {[
            ["Score", agent.score],
            ["Confidence", agent.confidence],
            ["Agreement", agent.agreement],
          ].map(([label, value]) => (
            <div
              key={String(label)}
              className="rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-2.5"
            >
              <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                {label}
              </p>
              <p className="mt-1 text-lg font-black text-[var(--slice-heading)]">
                {formatIntelligenceNumber(Number(value), 1)}
              </p>
            </div>
          ))}
        </div>
      </div>

      <div className="mt-4 h-2 overflow-hidden rounded-full bg-[var(--slice-slate-bg)]">
        <div
          className="h-full rounded-full bg-[linear-gradient(90deg,var(--slice-accent),var(--slice-accent-strong))]"
          style={{
            width: `${Math.max(
              0,
              Math.min(100, agent.confidence),
            )}%`,
          }}
        />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-emerald-600/15 bg-emerald-50 p-3 dark:border-emerald-400/15 dark:bg-emerald-500/[0.06]">
          <p className="text-[8px] font-black uppercase tracking-[0.1em] text-emerald-800 dark:text-emerald-200">
            Positive drivers
          </p>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-emerald-950/75 dark:text-emerald-50/75">
            {agent.positiveDrivers.join(" · ") ||
              "No strong positive driver"}
          </p>
        </div>
        <div className="rounded-xl border border-rose-600/15 bg-rose-50 p-3 dark:border-rose-400/15 dark:bg-rose-500/[0.06]">
          <p className="text-[8px] font-black uppercase tracking-[0.1em] text-rose-800 dark:text-rose-200">
            Negative drivers
          </p>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-rose-950/75 dark:text-rose-50/75">
            {agent.negativeDrivers.join(" · ") ||
              "No strong negative driver"}
          </p>
        </div>
        <div className="rounded-xl border border-amber-600/15 bg-amber-50 p-3 dark:border-amber-400/15 dark:bg-amber-500/[0.06]">
          <p className="text-[8px] font-black uppercase tracking-[0.1em] text-amber-900 dark:text-amber-200">
            Contradictions
          </p>
          <p className="mt-2 text-[11px] font-semibold leading-5 text-amber-950/75 dark:text-amber-50/75">
            {agent.contradictions.join(" · ") ||
              "No material contradiction"}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[9px] font-bold text-[var(--slice-subtle)]">
        {agent.evidenceIds.length.toLocaleString()} evidence links ·{" "}
        {agent.latencyMs.toLocaleString()} ms local pathway
      </p>
    </article>
  );
}

export default function ResearchSwarmInspector() {
  const [symbolInput, setSymbolInput] = useState("MSFT");
  const [activeSymbol, setActiveSymbol] = useState("MSFT");
  const [agentCount, setAgentCount] = useState(600);
  const [swarm, setSwarm] =
    useState<ResearchSwarmResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    "Choose a symbol and run the inspector. Opening this page does not start 2,000 pathways.",
  );
  const [error, setError] = useState("");
  const [cohortFilter, setCohortFilter] = useState<
    ResearchCohort | "all"
  >("all");
  const [statusFilter, setStatusFilter] = useState<
    ResearchAgent["status"] | "all"
  >("all");
  const [search, setSearch] = useState("");
  const deferredSearch = useDeferredValue(
    search.trim().toLowerCase(),
  );
  const [page, setPage] = useState(0);
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  async function runSwarm() {
    const symbol =
      cleanIntelligenceSymbol(symbolInput) || activeSymbol;
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;
    setActiveSymbol(symbol);
    setSymbolInput(symbol);
    setLoading(true);
    setError("");
    setMessage(
      `Running ${agentCount.toLocaleString()} inspectable pathways for ${symbol}.`,
    );

    try {
      const response =
        await intelligenceFetch<ResearchSwarmResponse>(
          "/api/intelligence/research-swarm",
          {
            method: "POST",
            signal: nextController.signal,
            body: JSON.stringify({
              symbol,
              agentCount,
              graphMode: "summary",
              detailMode: "agents",
              projection: "overview",
              persistGraph: false,
              forceRefresh: true,
              simulationPaths: 300,
              executionMode: "sync",
            }),
          },
          {
            timeoutMs: 82_000,
          },
        );

      if (!mounted.current) return;
      setSwarm(response);
      setPage(0);
      setMessage(
        `${response.activeAgents.toLocaleString()} pathways completed with ${response.evidence.length.toLocaleString()} evidence items. The full graph was not persisted.`,
      );
    } catch (caught) {
      if (isAbortError(caught) || !mounted.current) {
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to run the research swarm.",
      );
      setMessage("The pathway run did not complete.");
    } finally {
      if (mounted.current) setLoading(false);
    }
  }

  useEffect(
    () => () => {
      mounted.current = false;
      controller.current?.abort();
    },
    [],
  );

  useEffect(() => {
    setPage(0);
  }, [cohortFilter, deferredSearch, statusFilter]);

  const filteredAgents = useMemo(() => {
    return (swarm?.agents ?? []).filter((agent) => {
      const cohortMatch =
        cohortFilter === "all" ||
        agent.cohort === cohortFilter;
      const statusMatch =
        statusFilter === "all" ||
        agent.status === statusFilter;
      const searchMatch =
        !deferredSearch ||
        agent.role
          .toLowerCase()
          .includes(deferredSearch) ||
        agent.pathway
          .toLowerCase()
          .includes(deferredSearch) ||
        agent.positiveDrivers.some((driver) =>
          driver.toLowerCase().includes(deferredSearch),
        ) ||
        agent.negativeDrivers.some((driver) =>
          driver.toLowerCase().includes(deferredSearch),
        ) ||
        agent.contradictions.some((driver) =>
          driver.toLowerCase().includes(deferredSearch),
        );

      return cohortMatch && statusMatch && searchMatch;
    });
  }, [
    cohortFilter,
    deferredSearch,
    statusFilter,
    swarm,
  ]);
  const pageCount = Math.max(
    1,
    Math.ceil(filteredAgents.length / PAGE_SIZE),
  );
  const safePage = Math.min(page, pageCount - 1);
  const pagedAgents = filteredAgents.slice(
    safePage * PAGE_SIZE,
    safePage * PAGE_SIZE + PAGE_SIZE,
  );
  const providerFreshness = clientTimestampFreshness(
    swarm?.providerAsOf,
    {
      currentWithinMs: 20 * 60_000,
      recentWithinMs: 72 * 60 * 60_000,
    },
  );
  const runFreshness = clientTimestampFreshness(
    swarm?.completedAt,
    {
      currentWithinMs: 15 * 60_000,
      recentWithinMs: 60 * 60_000,
    },
  );

  return (
    <IntelligencePage>
      <IntelligenceSurface className="p-5 sm:p-7">
        <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-5xl">
            <div className="flex flex-wrap items-center gap-2">
              <IntelligencePill tone="violet">
                <Bot className="h-3.5 w-3.5" />
                Research pathway inspector
              </IntelligencePill>
              <IntelligencePill tone="emerald">
                <ShieldCheck className="h-3.5 w-3.5" />
                Equal thirds preserved
              </IntelligencePill>
              {swarm ? (
                <>
                  <IntelligencePill
                    tone={freshnessTone(runFreshness.state)}
                  >
                    <Clock3 className="h-3.5 w-3.5" />
                    Run {runFreshness.label}
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
              Inspect individual agents only when their detail is needed.
            </h1>
            <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-[var(--slice-muted)] sm:text-base">
              The browser inspector is intentionally capped at 900
              pathways and renders only 24 cards at a time. Full
              2,000-pathway analysis remains available through the
              durable knowledge-graph workflow without sending every
              agent card to the browser at once.
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <Link
              href={`/workspace/intelligence/knowledge-graph?symbol=${encodeURIComponent(
                activeSymbol,
              )}`}
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] px-4 text-xs font-black text-[var(--slice-accent-strong)]"
            >
              <Network className="h-4 w-4" />
              Deep graph
            </Link>
            <Link
              href="/workspace/intelligence"
              prefetch={false}
              className="inline-flex min-h-11 items-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 text-xs font-black text-[var(--slice-text)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Control plane
            </Link>
          </div>
        </div>

        <div className="mt-7 grid gap-3 lg:grid-cols-[minmax(220px,1fr)_320px_auto]">
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
                if (event.key === "Enter" && !loading) {
                  void runSwarm();
                }
              }}
              className="min-w-0 flex-1 bg-transparent px-4 text-sm font-black uppercase tracking-[0.12em] text-[var(--slice-heading)] outline-none"
              placeholder="MSFT"
              aria-label="Security symbol"
            />
          </label>

          <label className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 py-2.5 shadow-sm">
            <span className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">
              Inspectable pathways
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
              disabled={loading}
              onChange={(
                event: ChangeEvent<HTMLInputElement>,
              ) => setAgentCount(Number(event.target.value))}
              className="mt-2 w-full accent-emerald-600 disabled:opacity-50"
            />
          </label>

          <button
            type="button"
            onClick={() => void runSwarm()}
            disabled={
              loading ||
              !cleanIntelligenceSymbol(symbolInput)
            }
            className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(110deg,var(--slice-accent),var(--slice-accent-strong))] px-6 text-sm font-black text-white shadow-[0_14px_32px_var(--slice-accent-glow)] transition hover:brightness-105 disabled:opacity-50"
          >
            {loading ? (
              <RefreshCw className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4 fill-current" />
            )}
            Run inspector
          </button>
        </div>

        <IntelligenceNotice
          className="mt-4"
          tone={
            error
              ? "rose"
              : swarm
                ? "emerald"
                : "slate"
          }
          icon={
            error ? (
              <AlertTriangle className="h-5 w-5" />
            ) : swarm ? (
              <CheckCircle2 className="h-5 w-5" />
            ) : (
              <BrainCircuit className="h-5 w-5" />
            )
          }
        >
          {error || message}
        </IntelligenceNotice>
      </IntelligenceSurface>

      {swarm ? (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
            <IntelligenceMetric
              label="Slice score"
              value={formatIntelligenceNumber(
                swarm.score.overall,
                1,
              )}
              helper={swarm.score.label}
              icon={<BrainCircuit className="h-5 w-5" />}
            />
            <IntelligenceMetric
              label="Confidence"
              value={`${formatIntelligenceNumber(
                swarm.score.confidence,
                0,
              )}%`}
              helper="Evidence, freshness, and agreement."
              icon={<ShieldCheck className="h-5 w-5" />}
            />
            <IntelligenceMetric
              label="Active pathways"
              value={formatIntelligenceInteger(
                swarm.activeAgents,
              )}
              helper="Completed or degraded local pathways."
              icon={<Bot className="h-5 w-5" />}
              tone="violet"
            />
            <IntelligenceMetric
              label="Evidence items"
              value={formatIntelligenceInteger(
                swarm.evidence.length,
              )}
              helper="Shared provider evidence."
              icon={<Filter className="h-5 w-5" />}
              tone="cyan"
            />
            <IntelligenceMetric
              label="Filtered agents"
              value={formatIntelligenceInteger(
                filteredAgents.length,
              )}
              helper="Current local filter result."
              icon={<Search className="h-5 w-5" />}
              tone="amber"
            />
            <IntelligenceMetric
              label="Provider age"
              value={providerFreshness.label}
              helper={`As of ${formatIntelligenceDate(swarm.providerAsOf)}.`}
              icon={<Clock3 className="h-5 w-5" />}
              tone={freshnessTone(providerFreshness.state)}
            />
          </section>

          <IntelligenceSurface className="mt-5 p-5 sm:p-6">
            <IntelligenceSectionHeading
              eyebrow="Pathway filtering"
              title="Find the exact agents that matter"
              description="Search and filter locally. Deferred input keeps typing responsive even when the completed response contains hundreds of pathways."
            />

            <div className="mt-5 grid gap-3 lg:grid-cols-[minmax(240px,1fr)_190px_210px_auto]">
              <label className="flex min-h-11 items-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3">
                <Search className="h-4 w-4 text-[var(--slice-subtle)]" />
                <input
                  value={search}
                  onChange={(
                    event: ChangeEvent<HTMLInputElement>,
                  ) => setSearch(event.target.value)}
                  placeholder="Role, pathway, driver, or contradiction"
                  className="min-w-0 flex-1 bg-transparent text-xs font-bold text-[var(--slice-heading)] outline-none"
                />
              </label>

              <select
                value={cohortFilter}
                onChange={(
                  event: ChangeEvent<HTMLSelectElement>,
                ) =>
                  setCohortFilter(
                    event.target.value as
                      | ResearchCohort
                      | "all",
                  )
                }
                className="min-h-11 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 text-xs font-black text-[var(--slice-heading)] outline-none"
              >
                <option value="all">All cohorts</option>
                <option value="media">Media</option>
                <option value="technical">Technical</option>
                <option value="economy">Economy</option>
              </select>

              <select
                value={statusFilter}
                onChange={(
                  event: ChangeEvent<HTMLSelectElement>,
                ) =>
                  setStatusFilter(
                    event.target.value as
                      | ResearchAgent["status"]
                      | "all",
                  )
                }
                className="min-h-11 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 text-xs font-black text-[var(--slice-heading)] outline-none"
              >
                <option value="all">All statuses</option>
                <option value="completed">Completed</option>
                <option value="degraded">Degraded</option>
                <option value="insufficient-evidence">
                  Insufficient evidence
                </option>
              </select>

              <div className="flex items-center justify-end gap-2">
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) =>
                      Math.max(0, current - 1),
                    )
                  }
                  disabled={safePage <= 0}
                  className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] text-[var(--slice-muted)] disabled:opacity-35"
                  aria-label="Previous agent page"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <span className="min-w-20 text-center text-[10px] font-black text-[var(--slice-muted)]">
                  {safePage + 1} / {pageCount}
                </span>
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) =>
                      Math.min(
                        pageCount - 1,
                        current + 1,
                      ),
                    )
                  }
                  disabled={safePage >= pageCount - 1}
                  className="grid h-11 w-11 place-items-center rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] text-[var(--slice-muted)] disabled:opacity-35"
                  aria-label="Next agent page"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>
          </IntelligenceSurface>

          <div className="mt-5 grid gap-3">
            {pagedAgents.map((agent) => (
              <AgentCard key={agent.id} agent={agent} />
            ))}
          </div>

          {!pagedAgents.length ? (
            <IntelligenceSurface className="mt-5 p-8 text-center">
              <Search className="mx-auto h-8 w-8 text-[var(--slice-accent-strong)]" />
              <h2 className="mt-4 text-xl font-black text-[var(--slice-heading)]">
                No pathways match these filters
              </h2>
              <p className="mt-2 text-sm font-semibold text-[var(--slice-muted)]">
                Clear the search or select a different cohort or
                status.
              </p>
            </IntelligenceSurface>
          ) : null}
        </>
      ) : (
        <IntelligenceSurface className="mt-5 p-8">
          <div className="grid min-h-[330px] place-items-center text-center">
            <div className="max-w-2xl">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-[var(--slice-accent-strong)]">
                <Bot className="h-8 w-8" />
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
                The inspector is idle
              </h2>
              <p className="mt-3 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
                No agent swarm is launched on navigation. Run a
                bounded inspection above, or open the knowledge graph
                for a durable 1,200- or 2,000-pathway build.
              </p>
            </div>
          </div>
        </IntelligenceSurface>
      )}
    </IntelligencePage>
  );
}