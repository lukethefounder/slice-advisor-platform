"use client";

import Link from "next/link";
import { ArrowUpRight, Network, RefreshCw } from "lucide-react";
import { useEffect, useState } from "react";
import { intelligenceFetch, isAbortError, cleanIntelligenceSymbol } from "@/lib/intelligence/client";
import type { ResearchGraphNode, ResearchGraphViewResponse } from "@/lib/intelligence/research-swarm-types";
import NeuralBrainScene from "@/components/knowledge-graph/neural-brain-scene";
import styles from "@/components/knowledge-graph/neural-brain-scene.module.css";

const count = (value: number | undefined) => typeof value === "number" && Number.isFinite(value) ? value.toLocaleString() : "—";

type Props = { symbol?: string; researchRunId?: string | null; variant?: "workspace" | "public"; scopeKey?: string; enabled?: boolean; animated?: boolean; height?: number };

export default function KnowledgeGraphSpotlight(props: Props) {
  return <ScopedSpotlight key={`${props.scopeKey ?? "anonymous"}:${props.enabled !== false}:${props.variant ?? "workspace"}:${props.symbol ?? "MSFT"}:${props.researchRunId ?? "latest"}`} {...props}/>;
}

function ScopedSpotlight({ symbol = "MSFT", researchRunId, variant = "workspace", enabled = true, animated = true, height = 510 }: Props) {
  const requestedSymbol = cleanIntelligenceSymbol(symbol) || "MSFT";
  const [view, setView] = useState<ResearchGraphViewResponse | null>(null);
  const [loading, setLoading] = useState(variant === "workspace" && enabled), [error, setError] = useState("");
  const [selected, setSelected] = useState<ResearchGraphNode | null>(null);
  const publicView = variant === "public";
  useEffect(() => {
    if (publicView || !enabled) return;
    const controller = new AbortController(); let active = true;
    const query = new URLSearchParams({ symbol: requestedSymbol, projection: "overview" });
    if (researchRunId) query.set("runId", researchRunId);
    void intelligenceFetch<{ view: ResearchGraphViewResponse | null }>(`/api/intelligence/research-graph?${query}`, { signal: controller.signal }, { timeoutMs: 18000, retries: 0 })
      .then(response => { if (active) setView(response.view?.symbol === requestedSymbol && (!researchRunId || response.view.runId === researchRunId) ? response.view : null); })
      .catch(caught => { if (active && !isAbortError(caught)) setError(caught instanceof Error ? caught.message : "Saved research is unavailable."); })
      .finally(() => { if (active) setLoading(false); });
    return () => { active = false; controller.abort(); };
  }, [publicView, enabled, requestedSymbol, researchRunId]);
  const displayView = enabled && view?.symbol === requestedSymbol ? view : null;
  const plan = displayView?.metadata.researchPlan;
  const query = new URLSearchParams({ symbol: requestedSymbol });
  if (displayView) { query.set("researchRunId", displayView.runId); query.set("runId", displayView.runId); }
  return <section className={styles.spotlightShell} aria-label={publicView ? "Illustrative Slice neural architecture" : `Saved ${requestedSymbol} neural knowledge graph`}>
    <div className={styles.spotlightHeader}><div><p><Network size={12}/>THE NEURAL RESEARCH NETWORK</p><h3>{publicView ? "Intelligence lives in the connections." : `${requestedSymbol} / connected intelligence`}</h3><small>{publicView ? "Illustrative architecture" : loading ? "Loading your saved evidence…" : displayView ? `Saved research · ${new Date(displayView.generatedAt).toLocaleString()}` : "Your research network is ready to populate."}</small></div>{loading ? <RefreshCw size={18} className={styles.loading}/> : <span className={styles.savedBadge}>{displayView ? "Evidence attached" : "Explore the network"}</span>}</div>
    <NeuralBrainScene variant={variant} graph={displayView?.graph ?? null} symbol={requestedSymbol} height={height} animated={animated} selectedNodeId={selected?.id ?? null} onSelectNode={setSelected}/>
    {displayView && <div className={styles.spotlightMetrics}><div><small>Research pathways</small><strong>{count(plan?.evaluatedAgents ?? displayView.metadata.activeAgents)}</strong></div><div><small>Source domains</small><strong>{plan?.uniqueSourceCount ?? "—"}</strong></div><div><small>Research score</small><strong>{typeof displayView.metadata.score === "number" ? displayView.metadata.score.toFixed(1) : "—"}<em>/100</em></strong></div><div><small>Graph relationships</small><strong>{(displayView.graph.projection?.originalEdgeCount ?? displayView.graph.edgeCount).toLocaleString()}</strong></div></div>}
    <div className={styles.spotlightFooter}><p>{error || (selected ? `${selected.kind}: ${selected.label}` : publicView ? "Media, technical structure, and economic context converge into a traceable research network." : displayView ? "Select a neuron to inspect its role. Motion visualizes saved relationships; forecast percentages are available in intelligence." : "This illustrative network becomes your saved stock graph after a research run.")}</p><Link href={publicView ? "/founder-login" : `/workspace/intelligence?${query}`} prefetch={false}>{publicView ? "Sign in to research" : "Inspect the evidence"}<ArrowUpRight size={14}/></Link></div>
  </section>;
}
