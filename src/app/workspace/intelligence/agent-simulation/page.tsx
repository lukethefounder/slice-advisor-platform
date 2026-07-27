"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Filter,
  Network,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  ResearchAgent,
  ResearchCohort,
  ResearchSwarmResponse,
} from "@/lib/intelligence/research-swarm-types";

const panelClass =
  "rounded-[1.75rem] border border-white/10 bg-black/58 shadow-2xl shadow-black/40 backdrop-blur-xl";

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

function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-800"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
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

function cohortTone(cohort: ResearchCohort) {
  return cohort === "media"
    ? ("orange" as const)
    : cohort === "technical"
      ? ("cyan" as const)
      : ("purple" as const);
}

function AgentCard({ agent }: { agent: ResearchAgent }) {
  return (
    <article className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={cohortTone(agent.cohort)}>{agent.cohort}</Badge>
            <Badge
              tone={
                agent.status === "completed"
                  ? "green"
                  : agent.status === "degraded"
                    ? "amber"
                    : "red"
              }
            >
              {agent.status}
            </Badge>
          </div>
          <h3 className="mt-3 text-base font-black text-white">
            {agent.role} #{agent.ordinal}
          </h3>
          <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
            {agent.pathway}
          </p>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center sm:w-72">
          <div className="rounded-xl border border-white/8 bg-black/25 p-2.5">
            <p className="text-[9px] uppercase tracking-[0.12em] text-slate-700">
              Score
            </p>
            <p className="mt-1 text-lg font-black text-white">
              {number(agent.score, 1)}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/25 p-2.5">
            <p className="text-[9px] uppercase tracking-[0.12em] text-slate-700">
              Confidence
            </p>
            <p className="mt-1 text-lg font-black text-white">
              {number(agent.confidence, 0)}
            </p>
          </div>
          <div className="rounded-xl border border-white/8 bg-black/25 p-2.5">
            <p className="text-[9px] uppercase tracking-[0.12em] text-slate-700">
              Agreement
            </p>
            <p className="mt-1 text-lg font-black text-white">
              {number(agent.agreement, 0)}
            </p>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <Progress value={agent.confidence} />
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.05] p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-300">
            Positive
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-emerald-50/75">
            {agent.positiveDrivers.join(" · ") || "No strong positive driver"}
          </p>
        </div>
        <div className="rounded-xl border border-emerald-400/15 bg-emerald-500/[0.05] p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-emerald-300">
            Negative
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-emerald-50/75">
            {agent.negativeDrivers.join(" · ") || "No strong negative driver"}
          </p>
        </div>
        <div className="rounded-xl border border-amber-400/15 bg-amber-500/[0.05] p-3">
          <p className="text-[9px] font-black uppercase tracking-[0.12em] text-amber-300">
            Contradictions
          </p>
          <p className="mt-2 text-xs font-semibold leading-5 text-amber-50/75">
            {agent.contradictions.join(" · ") || "No material contradiction"}
          </p>
        </div>
      </div>

      <p className="mt-3 text-[10px] font-bold text-slate-700">
        {agent.evidenceIds.length} evidence links · {agent.latencyMs} ms local pathway
      </p>
    </article>
  );
}

export default function ResearchSwarmPage() {
  const [symbolInput, setSymbolInput] = useState("MSFT");
  const [activeSymbol, setActiveSymbol] = useState("MSFT");
  const [agentCount, setAgentCount] = useState(2_000);
  const [swarm, setSwarm] = useState<ResearchSwarmResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    "Run the swarm to inspect individual pathways and evidence assignments.",
  );
  const [cohortFilter, setCohortFilter] = useState<ResearchCohort | "all">(
    "all",
  );
  const [statusFilter, setStatusFilter] = useState<
    ResearchAgent["status"] | "all"
  >("all");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(0);
  const pageSize = 60;

  const runSwarm = useCallback(async (symbol: string, agents: number) => {
    setLoading(true);
    setMessage(
      `Running ${agents.toLocaleString()} research pathways for ${symbol}.`,
    );

    try {
      const body = await fetchJson<ResearchSwarmResponse>(
        "/api/intelligence/research-swarm",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            symbol,
            agentCount: agents,
            graphMode: "summary",
            detailMode: "agents",
            persistGraph: true,
            simulationPaths: 500,
          }),
        },
      );
      setSwarm(body);
      setPage(0);
      setMessage(
        `${body.activeAgents.toLocaleString()} pathways completed with ${body.evidence.length.toLocaleString()} evidence items.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to run the research swarm.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void runSwarm("MSFT", 2_000);
  }, [runSwarm]);

  async function runRequestedSwarm() {
    const symbol = symbolInput.trim().toUpperCase() || activeSymbol;
    setActiveSymbol(symbol);
    await runSwarm(symbol, agentCount);
  }

  const filteredAgents = useMemo(() => {
    const normalizedSearch = search.trim().toLowerCase();

    return (swarm?.agents ?? []).filter((agent) => {
      const cohortMatch =
        cohortFilter === "all" || agent.cohort === cohortFilter;
      const statusMatch =
        statusFilter === "all" || agent.status === statusFilter;
      const searchMatch =
        !normalizedSearch ||
        agent.role.toLowerCase().includes(normalizedSearch) ||
        agent.pathway.toLowerCase().includes(normalizedSearch) ||
        agent.positiveDrivers.some((driver) =>
          driver.toLowerCase().includes(normalizedSearch),
        ) ||
        agent.negativeDrivers.some((driver) =>
          driver.toLowerCase().includes(normalizedSearch),
        );

      return cohortMatch && statusMatch && searchMatch;
    });
  }, [cohortFilter, search, statusFilter, swarm]);
  const pagedAgents = filteredAgents.slice(
    page * pageSize,
    page * pageSize + pageSize,
  );
  const pageCount = Math.max(1, Math.ceil(filteredAgents.length / pageSize));

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-12rem] top-[-12rem] h-[36rem] w-[36rem] rounded-full bg-emerald-700/16 blur-3xl" />
        <div className="absolute right-[-14rem] top-[6rem] h-[38rem] w-[38rem] rounded-full bg-purple-800/12 blur-3xl" />
      </div>

      <div className="mx-auto max-w-[1950px]">
        <section className={cx(panelClass, "p-6 sm:p-8")}>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="red">
                  <Bot className="h-3.5 w-3.5" />
                  Real-Time Research Swarm
                </Badge>
                <Badge tone="green">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Equal-third score architecture
                </Badge>
              </div>
              <h1 className="mt-4 max-w-5xl text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">
                Inspect the agents that construct the Slice score.
              </h1>
              <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-slate-400 sm:text-base">
                Each agent is an independent analytical pathway assigned to media,
                technical, or industry-economy evidence. Agents share provider data to
                preserve rate limits, but use different roles, evidence selections,
                weighting pathways, and contradiction checks.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <Link
                href="/workspace/intelligence/knowledge-graph"
                className="inline-flex items-center gap-2 rounded-xl border border-purple-400/20 bg-purple-500/[0.07] px-4 py-3 text-xs font-black text-purple-100 hover:bg-purple-500/15"
              >
                <Network className="h-4 w-4" />
                Open graph
              </Link>
              <Link
                href="/workspace/intelligence"
                className="inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black text-slate-300 hover:text-white"
              >
                <ArrowLeft className="h-4 w-4" />
                Control Plane
              </Link>
            </div>
          </div>

          <div className="mt-7 grid gap-3 lg:grid-cols-[1fr_320px_auto]">
            <label className="flex items-center rounded-2xl border border-white/10 bg-black/45 px-4">
              <Search className="h-5 w-5 text-emerald-300" />
              <input
                value={symbolInput}
                onChange={(event: any) =>
                  setSymbolInput(event.target.value.toUpperCase())
                }
                onKeyDown={(event: any) => {
                  if (event.key === "Enter") {
                    void runRequestedSwarm();
                  }
                }}
                className="h-14 min-w-0 flex-1 bg-transparent px-4 text-sm font-black uppercase tracking-[0.12em] text-white outline-none"
                placeholder="MSFT"
              />
            </label>

            <label className="rounded-2xl border border-white/10 bg-black/45 px-4 py-2">
              <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                Agent pathways
                <span className="text-emerald-300">
                  {agentCount.toLocaleString()}
                </span>
              </span>
              <input
                type="range"
                min={300}
                max={2_000}
                step={100}
                value={agentCount}
                onChange={(event: any) => setAgentCount(Number(event.target.value))}
                className="mt-2 w-full accent-emerald-600"
              />
            </label>

            <button
              type="button"
              onClick={() => void runRequestedSwarm()}
              disabled={loading}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-700 to-emerald-950 px-6 text-sm font-black text-white shadow-xl shadow-emerald-950/35 transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              Run swarm
            </button>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm font-semibold leading-6 text-slate-300">
            {loading ? (
              <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-emerald-300" />
            ) : swarm ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            ) : (
              <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            )}
            {message}
          </div>
        </section>

        {swarm ? (
          <>
            <section className="mt-5 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
              {[
                ["Slice score", number(swarm.score.overall, 1)],
                ["Confidence", `${number(swarm.score.confidence, 0)}%`],
                ["Media agents", swarm.allocation.media.toLocaleString()],
                ["Technical agents", swarm.allocation.technical.toLocaleString()],
                ["Economy agents", swarm.allocation.economy.toLocaleString()],
                ["Evidence", swarm.evidence.length.toLocaleString()],
              ].map(([label, value]) => (
                <div key={label} className={cx(panelClass, "p-4")}>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {value}
                  </p>
                </div>
              ))}
            </section>

            <section className={cx(panelClass, "mt-5 p-5 sm:p-6")}>
              <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
                <div>
                  <Badge tone="cyan">
                    <Filter className="h-3.5 w-3.5" />
                    Agent inspector
                  </Badge>
                  <h2 className="mt-3 text-2xl font-black text-white">
                    {filteredAgents.length.toLocaleString()} matching pathways
                  </h2>
                </div>

                <div className="flex flex-wrap gap-2">
                  <label className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2">
                    <Search className="h-4 w-4 text-slate-500" />
                    <input
                      value={search}
                      onChange={(event: any) => {
                        setSearch(event.target.value);
                        setPage(0);
                      }}
                      className="w-52 bg-transparent text-xs font-bold text-white outline-none placeholder:text-slate-700"
                      placeholder="Search roles and drivers"
                    />
                  </label>
                  <select
                    value={cohortFilter}
                    onChange={(event: any) => {
                      setCohortFilter(
                        event.target.value as ResearchCohort | "all",
                      );
                      setPage(0);
                    }}
                    className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs font-black text-white outline-none"
                  >
                    <option value="all">All cohorts</option>
                    <option value="media">Media</option>
                    <option value="technical">Technical</option>
                    <option value="economy">Economy</option>
                  </select>
                  <select
                    value={statusFilter}
                    onChange={(event: any) => {
                      setStatusFilter(
                        event.target.value as ResearchAgent["status"] | "all",
                      );
                      setPage(0);
                    }}
                    className="rounded-xl border border-white/10 bg-zinc-950 px-3 py-2 text-xs font-black text-white outline-none"
                  >
                    <option value="all">All statuses</option>
                    <option value="completed">Completed</option>
                    <option value="degraded">Degraded</option>
                    <option value="insufficient-evidence">
                      Insufficient evidence
                    </option>
                  </select>
                </div>
              </div>

              <div className="mt-5 space-y-3">
                {pagedAgents.map((agent) => (
                  <AgentCard key={agent.id} agent={agent} />
                ))}
              </div>

              <div className="mt-5 flex items-center justify-between gap-4">
                <button
                  type="button"
                  onClick={() => setPage((current) => Math.max(0, current - 1))}
                  disabled={page === 0}
                  className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-black text-white disabled:opacity-40"
                >
                  Previous
                </button>
                <p className="text-xs font-black text-slate-500">
                  Page {page + 1} of {pageCount}
                </p>
                <button
                  type="button"
                  onClick={() =>
                    setPage((current) => Math.min(pageCount - 1, current + 1))
                  }
                  disabled={page >= pageCount - 1}
                  className="rounded-xl border border-white/10 bg-white/[0.035] px-4 py-2 text-xs font-black text-white disabled:opacity-40"
                >
                  Next
                </button>
              </div>
            </section>

            {swarm.warnings.length ? (
              <section className={cx(panelClass, "mt-5 p-5 sm:p-6")}>
                <Badge tone="amber">
                  <AlertTriangle className="h-3.5 w-3.5" />
                  Research limitations
                </Badge>
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  {swarm.warnings.map((warning) => (
                    <div
                      key={warning}
                      className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.05] p-4 text-xs font-semibold leading-5 text-amber-100"
                    >
                      {warning}
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </>
        ) : null}
      </div>
    </main>
  );
}