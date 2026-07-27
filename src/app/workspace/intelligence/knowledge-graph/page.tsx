"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  BrainCircuit,
  CheckCircle2,
  Database,
  Network,
  Play,
  RefreshCw,
  Search,
  ShieldCheck,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";

import ResearchKnowledgeGraphCanvas from "@/components/intelligence/research-knowledge-graph";
import type { ResearchSwarmResponse } from "@/lib/intelligence/research-swarm-types";

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

export default function IntelligenceKnowledgeGraphPage() {
  const [symbolInput, setSymbolInput] = useState("MSFT");
  const [activeSymbol, setActiveSymbol] = useState("MSFT");
  const [agentCount, setAgentCount] = useState(2_000);
  const [swarm, setSwarm] = useState<ResearchSwarmResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState(
    "Run the research swarm to build the complete agent-evidence-source graph.",
  );

  const runGraph = useCallback(
    async (symbol: string, agents: number) => {
      setLoading(true);
      setMessage(
        `Building a full ${agents.toLocaleString()}-pathway graph for ${symbol}.`,
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
              graphMode: "full",
              detailMode: "graph",
              persistGraph: true,
              simulationPaths: 500,
            }),
          },
        );
        setSwarm(body);
        setMessage(
          `${body.graph.nodeCount.toLocaleString()} nodes and ${body.graph.edgeCount.toLocaleString()} edges created.`,
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Unable to build the research graph.",
        );
      } finally {
        setLoading(false);
      }
    },
    [],
  );

  useEffect(() => {
    void runGraph("MSFT", 2_000);
  }, [runGraph]);

  async function runRequestedGraph() {
    const symbol = symbolInput.trim().toUpperCase() || activeSymbol;
    setActiveSymbol(symbol);
    await runGraph(symbol, agentCount);
  }

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-12rem] top-[-12rem] h-[36rem] w-[36rem] rounded-full bg-emerald-700/16 blur-3xl" />
        <div className="absolute right-[-14rem] top-[7rem] h-[38rem] w-[38rem] rounded-full bg-cyan-800/8 blur-3xl" />
      </div>

      <div className="mx-auto max-w-[1950px]">
        <section className={cx(panelClass, "p-6 sm:p-8")}>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-200">
                  <Network className="h-3.5 w-3.5" />
                  Live Research Knowledge Graph
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-purple-400/25 bg-purple-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-purple-100">
                  <Bot className="h-3.5 w-3.5" />
                  Up to 2,000 pathways
                </span>
              </div>
              <h1 className="mt-4 max-w-5xl text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">
                See every pathway behind the Slice score.
              </h1>
              <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-slate-400 sm:text-base">
                This canvas connects the asset, sector, industry, score, three equal
                research cohorts, individual agents, evidence items, sources, topics,
                and economic series. Neo4j persistence is used when configured.
              </p>
            </div>

            <Link
              href="/workspace/intelligence"
              className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black text-slate-300 transition hover:border-emerald-400/25 hover:text-white xl:self-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Control Plane
            </Link>
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
                    void runRequestedGraph();
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
              onClick={() => void runRequestedGraph()}
              disabled={loading}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-700 to-emerald-950 px-6 text-sm font-black text-white shadow-xl shadow-emerald-950/35 transition hover:brightness-110 disabled:opacity-50"
            >
              {loading ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              Build full graph
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
                ["Slice score", number(swarm.score.overall, 1), "Equal thirds"],
                ["Confidence", `${number(swarm.score.confidence, 0)}%`, "Research quality"],
                ["Agents", swarm.activeAgents.toLocaleString(), "Analytical pathways"],
                ["Evidence", swarm.evidence.length.toLocaleString(), "Provider and source items"],
                ["Nodes", swarm.graph.nodeCount.toLocaleString(), "Visual graph objects"],
                ["Edges", swarm.graph.edgeCount.toLocaleString(), "Research relationships"],
                ["Connected", `${number(swarm.graphAnalytics.connectednessScore, 0)}%`, "Graph centrality"],
              ].map(([label, value, helper]) => (
                <div key={label} className={cx(panelClass, "p-4")}>
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                    {label}
                  </p>
                  <p className="mt-2 text-2xl font-black text-white">
                    {value}
                  </p>
                  <p className="mt-2 text-xs font-semibold text-slate-500">
                    {helper}
                  </p>
                </div>
              ))}
            </section>

            <section className="mt-5">
              <ResearchKnowledgeGraphCanvas
                graph={swarm.graph}
                analytics={swarm.graphAnalytics}
                height={840}
                live
              />
            </section>

            <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_0.7fr]">
              <div className={cx(panelClass, "p-5 sm:p-6")}>
                <div className="flex items-end justify-between gap-4">
                  <div>
                    <span className="inline-flex items-center gap-2 rounded-full border border-cyan-400/25 bg-cyan-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-cyan-100">
                      <Database className="h-3.5 w-3.5" />
                      Graph clusters
                    </span>
                    <h2 className="mt-3 text-2xl font-black text-white">
                      Research topology
                    </h2>
                  </div>
                </div>
                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {swarm.graph.clusters.map((cluster) => (
                    <div
                      key={cluster.id}
                      className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                    >
                      <p className="text-sm font-black text-white">
                        {cluster.label}
                      </p>
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
                <span className="inline-flex items-center gap-2 rounded-full border border-emerald-400/25 bg-emerald-500/10 px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em] text-emerald-100">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Persistence
                </span>
                <h2 className="mt-3 text-2xl font-black text-white">
                  Neo4j graph state
                </h2>
                <div className="mt-5 rounded-2xl border border-white/8 bg-white/[0.025] p-4">
                  <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                    Status
                  </p>
                  <p className="mt-2 text-xl font-black text-white">
                    {swarm.graphPersistence.status}
                  </p>
                  <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
                    {"detail" in swarm.graphPersistence
                      ? swarm.graphPersistence.detail
                      : `${swarm.graphPersistence.nodeCount.toLocaleString()} nodes and ${swarm.graphPersistence.edgeCount.toLocaleString()} edges persisted.`}
                  </p>
                </div>

                {swarm.warnings.length ? (
                  <div className="mt-4 rounded-2xl border border-amber-400/15 bg-amber-500/[0.05] p-4 text-xs font-semibold leading-5 text-amber-100">
                    <div className="flex items-center gap-2 font-black">
                      <AlertTriangle className="h-4 w-4" />
                      {swarm.warnings.length} active limitations
                    </div>
                    <p className="mt-2">{swarm.warnings[0]}</p>
                  </div>
                ) : null}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </main>
  );
}