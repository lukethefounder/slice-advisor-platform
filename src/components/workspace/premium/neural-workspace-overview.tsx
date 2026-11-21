"use client";

import dynamic from "next/dynamic";
import Link from "next/link";
import { Activity, ArrowUpRight, Bot, BrainCircuit, CheckCheck, ChevronRight, Clock3, Database, FileText, GitBranch, Network, Radar, ShieldCheck, Target, Workflow } from "lucide-react";
import { useEffect, useState } from "react";
import { intelligenceFetch, isAbortError } from "@/lib/intelligence/client";
import { safeResearchSourceUrl } from "@/lib/intelligence/research-evidence";
import type { ResearchGraphNode, ResearchGraphViewResponse } from "@/lib/intelligence/research-swarm-types";
import { HORIZONS, type CanonicalBundle, type CanonicalHorizon } from "@/lib/intelligence-unified/contracts";
import type { HomeSummary, WorkspaceBriefHighlight } from "@/lib/workspace/home-contract";
import css from "./neural-workspace.module.css";

const NeuralBrainScene = dynamic(() => import("@/components/knowledge-graph/neural-brain-scene"), {
  ssr: false,
  loading: () => <div className={css.sceneLoading}><BrainCircuit size={54} /><span>Preparing your neural workspace</span></div>,
});

function number(value: number | null | undefined, digits = 1) {
  return typeof value === "number" && Number.isFinite(value) ? value.toLocaleString("en-US", { maximumFractionDigits: digits }) : "—";
}
function time(value: string | null | undefined) {
  return value && Number.isFinite(Date.parse(value)) ? `${new Date(value).toISOString().replace("T", " ").slice(0, 16)} UTC` : "Time not recorded";
}
function selectionHref(symbol: string, runId?: string | null, nodeId?: string) {
  return `/workspace/intelligence${nodeId ? "/knowledge-graph" : ""}?${new URLSearchParams({ symbol, ...(runId ? { researchRunId: runId, runId } : {}), ...(nodeId ? { nodeId } : {}) })}`;
}

type Props = { scopeKey: string; enabled: boolean; summary: HomeSummary | null; selectedSymbol: string; motion: boolean; revision: number };

export default function NeuralWorkspaceOverview(props: Props) {
  const [preferWatchlist, setPreferWatchlist] = useState(false);
  const briefSection = props.summary?.dailyBrief;
  const brief = briefSection?.state === "ready" ? briefSection.data : null;
  const symbol = !preferWatchlist && brief ? brief.symbol : props.selectedSymbol;
  const highlightedBrief = !preferWatchlist && brief?.symbol === symbol ? brief : null;
  return <section className={css.overview} aria-label="Stock neural workspace">
    {brief && props.selectedSymbol && brief.symbol !== props.selectedSymbol && <div className={css.focusSwitch} role="group" aria-label="Workspace stock focus">
      <button type="button" aria-pressed={!preferWatchlist} onClick={() => setPreferWatchlist(false)}><FileText size={13} />Brief highlight · {brief.symbol}</button>
      <button type="button" aria-pressed={preferWatchlist} onClick={() => setPreferWatchlist(true)}><Radar size={13} />My selection · {props.selectedSymbol}</button>
    </div>}
    <ScopedNetwork key={`${props.scopeKey}:${symbol}:${highlightedBrief?.recordId ?? "selection"}:${props.revision}`} {...props} symbol={symbol} brief={highlightedBrief}
      briefMessage={briefSection?.state === "unavailable" ? briefSection.message : brief ? "Showing your selected instrument instead of the brief highlight." : "No saved daily-brief highlight is available. Your selected instrument is shown."} />
  </section>;
}

function ScopedNetwork({ enabled, summary, symbol, brief, briefMessage, motion }: Props & { symbol: string; brief: WorkspaceBriefHighlight | null; briefMessage: string }) {
  const [view, setView] = useState<ResearchGraphViewResponse | null>(null);
  const [bundle, setBundle] = useState<CanonicalBundle | null>(null);
  const [loading, setLoading] = useState(enabled && Boolean(symbol));
  const [error, setError] = useState("");
  const [forecastError, setForecastError] = useState("");
  const [selected, setSelected] = useState<ResearchGraphNode | null>(null);
  const [horizon, setHorizon] = useState<CanonicalHorizon>("2-5d");

  useEffect(() => {
    if (!enabled || !symbol) return;
    let current = true;
    const request = new AbortController();
    const query = new URLSearchParams({ symbol, projection: "balanced" });
    // This route reads a saved graph only. Opening the workspace cannot start research.
    void intelligenceFetch<{ view: ResearchGraphViewResponse | null }>(`/api/intelligence/research-graph?${query}`, { signal: request.signal }, { timeoutMs: 18000, retries: 0 })
      .then(async response => {
        if (!current) return;
        const saved = response.view;
        if (saved && saved.symbol !== symbol) throw new Error("Saved research does not match this stock.");
        setView(saved);
        if (!saved) return;
        const params = new URLSearchParams({ symbol, researchRunId: saved.runId });
        try {
          const forecast = await intelligenceFetch<{ bundle: CanonicalBundle | null }>(`/api/intelligence/canonical?${params}`, { signal: request.signal }, { timeoutMs: 18000, retries: 0 });
          if (!current) return;
          const result = forecast.bundle;
          if (result && (result.symbol !== symbol || result.researchRunId !== saved.runId)) throw new Error("Forecast identity does not match the graph.");
          setBundle(result);
        } catch (caught) { if (current && !isAbortError(caught)) setForecastError(caught instanceof Error ? caught.message : "Matching forecast unavailable."); }
      })
      .catch(caught => { if (current && !isAbortError(caught)) setError(caught instanceof Error ? caught.message : "Saved research is unavailable."); })
      .finally(() => { if (current) setLoading(false); });
    return () => { current = false; request.abort(); };
  }, [enabled, symbol]);

  const saved = enabled && view?.symbol === symbol ? view : null;
  const matching = saved && bundle?.researchRunId === saved.runId && bundle.symbol === symbol ? bundle : null;
  const forecast = matching?.forecast.horizons.find(item => item.horizon === horizon);
  const probability = forecast && Number.isFinite(forecast.positiveReturnProbability) && forecast.positiveReturnProbability >= 0 && forecast.positiveReturnProbability <= 100 ? forecast.positiveReturnProbability : null;
  const plan = saved?.metadata.researchPlan;
  const graph = saved?.graph ?? null;
  const selectedNode = selected && graph?.nodes.some(node => node.id === selected.id) ? selected : null;
  const sourceUrl = selectedNode ? safeResearchSourceUrl(selectedNode.properties.sourceUrl ?? selectedNode.properties.url) : "";
  const researchHref = symbol ? selectionHref(symbol, saved?.runId) : "/workspace/intelligence";
  const sourcesHref = `${researchHref}#research-sources`;
  const taskCount = summary?.tasks.state === "ready" ? summary.tasks.data.count : null;
  const approvalCount = summary?.approvals.state === "ready" ? summary.approvals.data.count : null;
  const scenarioCount = summary?.scenarios.state === "ready" ? summary.scenarios.data.count : null;
  const clientCount = summary?.clients.state === "ready" ? summary.clients.data.count : null;

  return <>
    <div className={css.focusHeader}>
      <div><p className={css.kicker}><span className={css.statusDot} />{brief ? "HIGHLIGHTED IN YOUR LATEST SAVED BRIEF" : "YOUR SELECTED INSTRUMENT"}</p><h2>{symbol || "Your next discovery"}<span>{brief?.companyName || saved?.metadata.companyName || "Stock intelligence network"}</span></h2><p className={css.focusMeta}>{brief?.industryName || saved?.metadata.sector || "Media / Technical / Economy"}{brief && <> · Brief saved {time(brief.createdAt)}</>}</p></div>
      <div className={css.focusActions}><Link className={css.primary} href={researchHref} prefetch={false}><Network size={15} />{saved ? "Explore this graph" : "Build this stock's graph"}<ArrowUpRight size={14} /></Link><Link className={css.secondary} href="/workspace/brief" prefetch={false}><FileText size={14} />Open daily brief</Link></div>
    </div>
    {!brief && <p className={css.contextNote}>{briefMessage}</p>}
    <div className={css.field} data-motion={motion ? "on" : "off"}>
      <div className={css.fieldGrid} aria-hidden="true" />
      <svg className={css.connectorLines} viewBox="0 0 1200 700" preserveAspectRatio="none" aria-hidden="true"><defs><linearGradient id="workspace-neural-link"><stop stopColor="#2dd4bf" stopOpacity=".1" /><stop offset=".5" stopColor="#a1ebed" stopOpacity=".65" /><stop offset="1" stopColor="#8b7cf6" stopOpacity=".1" /></linearGradient></defs><g fill="none" stroke="url(#workspace-neural-link)"><path d="M190 150C330 150 340 330 600 330S870 170 1020 170" /><path d="M170 500C330 500 360 380 600 330S870 400 1030 450" /><path d="M330 650C330 500 500 400 600 330S780 100 800 40" /></g></svg>
      <div className={css.brainLayer}><NeuralBrainScene variant="workspace" graph={graph} symbol={symbol || "SLICE"} height={660} animated={motion} controls={false} selectedNodeId={selectedNode?.id ?? null} onSelectNode={setSelected} /></div>
      <div className={css.orbitLayout}>
        <div className={css.leftRail}>
          <article className={`${css.nodeCard} ${css.briefCard}`}>
            <div className={css.nodeTitle}><FileText size={14} /><span>DAILY BRIEF SIGNAL</span><i /></div>
            {brief ? <><div className={css.rank}><b>{brief.rank ? `#${brief.rank}` : "—"}</b><span>in your saved<br />security ranking</span></div><p>{brief.explanation || "The saved brief includes this security in its ranked research universe."}</p><div className={css.miniMetrics}><span><small>Brief score</small><strong>{number(brief.score)}<em>/100</em></strong></span><span><small>Brief quality</small><strong>{number(brief.dataQuality, 0)}<em>/100</em></strong></span></div><small className={css.timestamp}>{brief.providerMode} · {time(brief.marketAsOf)}</small></> : <><h3>A focus for your next brief.</h3><p>Create a source-backed daily brief to highlight its leading ranked stock here. Your selected stock remains available for research.</p><Link className={css.textLink} href="/workspace/brief" prefetch={false}>Open brief center<ChevronRight size={13} /></Link></>}
          </article>
          <article className={`${css.nodeCard} ${css.catalystCard}`}>
            <div className={css.nodeTitle}><Activity size={14} /><span>CATALYSTS / FRICTION</span><i /></div>
            {brief?.positiveDrivers.length ? <ul className={css.drivers}>{brief.positiveDrivers.slice(0, 2).map((driver, index) => <li key={index}><span /><span>{driver}</span></li>)}</ul> : <p>Supporting drivers appear when they are retained in the saved brief.</p>}
            {brief?.riskFlags.length ? <p className={css.risk}><ShieldCheck size={13} /><span>{brief.riskFlags[0]}</span></p> : <small className={css.timestamp}>Review the complete source trail before interpreting a signal.</small>}
          </article>
        </div>
        <div className={css.centerSpace}>
          <div className={css.networkLabel}><BrainCircuit size={13} /><span>{loading ? "Loading saved connections" : graph ? "Saved evidence topology" : "Illustrative neural topology"}</span></div>
          <div className={css.networkTelemetry}>
            <span><b>{graph ? number(graph.projection?.originalNodeCount ?? graph.nodeCount, 0) : "—"}</b>recorded nodes</span><span><b>{graph ? number(graph.projection?.originalEdgeCount ?? graph.edgeCount, 0) : "—"}</b>relationships</span><span><b>{plan ? number(plan.evaluatedAgents, 0) : saved ? number(saved.metadata.activeAgents, 0) : "—"}</b>analytical pathways</span>
          </div>
        </div>
        <div className={css.rightRail}>
          <article className={`${css.nodeCard} ${css.scoreCard}`}>
            <div className={css.nodeTitle}><Radar size={14} /><span>RESEARCH CONVICTION</span><i /></div>
            <div className={css.scoreValue}>{saved ? number(saved.metadata.score) : "—"}<span>/100</span></div><p className={css.scoreCaption}>Slice evidence score</p>
            <div className={css.scoreTrack} aria-hidden="true"><span style={{ width: `${Math.max(0, Math.min(100, saved?.metadata.score ?? 0))}%` }} /></div>
            <div className={css.scoreDetail}><span>Confidence score</span><b>{saved ? `${number(saved.metadata.confidence, 0)} / 100` : "—"}</b></div>
            <div className={css.scoreDetail}><span>Unique source domains</span><b>{plan ? number(plan.uniqueSourceCount, 0) : "—"}</b></div>
            <small className={css.timestamp}>Sentiment and evidence confidence are separate from an outcome probability.</small>
          </article>
          <article className={`${css.nodeCard} ${css.outcomeCard}`}>
            <div className={css.nodeTitle}><Target size={14} /><span>OUTCOME LENS</span><i /></div>
            <label className={css.horizon}><span>Horizon</span><select value={horizon} onChange={event => setHorizon(event.target.value as CanonicalHorizon)} aria-label="Forecast horizon">{HORIZONS.map(value => <option key={value} value={value}>{value}</option>)}</select></label>
            <div className={css.outcomeNumber}>{probability === null ? "—" : number(probability)}<span>{probability === null ? "" : "%"}</span></div><p className={css.scoreCaption}>Estimated positive-return probability</p>
            {forecast && probability !== null ? <><div className={css.scoreDetail}><span>Expected return</span><b>{number(forecast.expectedReturnPercent, 2)}%</b></div><small className={css.timestamp}>Model estimate · target {time(matching?.targets[horizon])}</small></> : <p>{forecastError || (loading ? "Loading the forecast matched to this graph." : "A saved matching forecast is required. No probability is inferred from the brief score.")}</p>}
          </article>
        </div>
      </div>
      <div className={css.fieldFooter}><span><Clock3 size={12} />{saved ? `Graph observation: ${time(saved.metadata.providerAsOf)}` : "Saved evidence will replace the illustrative layout after research is built."}</span><span>Motion visualizes connections; it does not indicate new market data.</span></div>
    </div>
    {error && <p className={css.networkError} role="alert">{error} <Link href={researchHref} prefetch={false}>Open intelligence<ArrowUpRight size={12} /></Link></p>}
    <div className={css.detailGrid}>
      <section className={css.evidencePanel} aria-label="Selected graph node">
        <div className={css.panelHead}><span><GitBranch size={14} />INSIDE THE NETWORK</span><span className={css.badge}>{selectedNode ? selectedNode.kind : "Interactive"}</span></div>
        <h3>{selectedNode?.label || "Follow a connection."}</h3><p>{selectedNode ? String(selectedNode.properties.researchQuestion || selectedNode.properties.summary || selectedNode.properties.description || `A ${selectedNode.cohort} ${selectedNode.kind} connected to this saved research run.`).slice(0, 500) : "Select a neuron in the graph to inspect its role. Open the full graph for its evidence, neighboring nodes, and source trail."}</p>
        {selectedNode && <div className={css.selectedActions}><Link className={css.textLink} href={selectionHref(symbol, saved?.runId, selectedNode.id)} prefetch={false}>Inspect node and evidence<ArrowUpRight size={13} /></Link>{sourceUrl && <a className={css.textLink} href={sourceUrl} target="_blank" rel="noopener noreferrer">Original source<ArrowUpRight size={13} /></a>}</div>}
      </section>
      <section className={css.evidencePanel} aria-label="Featured stock sources">
        <div className={css.panelHead}><span><Database size={14} />TRACE THE EVIDENCE</span><Link className={css.textLink} href={sourcesHref} prefetch={false}>Graph sources<ArrowUpRight size={12} /></Link></div>
        {brief?.sources.length ? <div className={css.sourceRows}>{brief.sources.slice(0, 3).map(source => <a href={source.url} key={source.url} target="_blank" rel="noopener noreferrer"><div><strong>{source.label || source.publisher}</strong><small>{source.publisher} · {time(source.asOf)}</small></div><ArrowUpRight size={13} /></a>)}</div> : <p>Original links from the highlighted brief appear here when available. The graph source registry contains the evidence retained in its own saved run.</p>}
        {brief && <small className={css.timestamp}>Links above support the saved daily brief. The graph and forecast may have a different observation time.</small>}
      </section>
    </div>
    <nav className={css.actionNetwork} aria-label="Connected workspace actions">
      <Link href="/workspace/team-board" prefetch={false}><span><Workflow size={17} /></span><div><small>ACTION QUEUE</small><strong>{number(taskCount, 0)} open tasks</strong></div><ArrowUpRight size={14} /></Link>
      <Link href="/workspace/personal-bot" prefetch={false}><span><CheckCheck size={17} /></span><div><small>HUMAN REVIEW</small><strong>{number(approvalCount, 0)} approvals</strong></div><ArrowUpRight size={14} /></Link>
      <Link href="/workspace/strategy-lab" prefetch={false}><span><GitBranch size={17} /></span><div><small>SCENARIO LAB</small><strong>{number(scenarioCount, 0)} open scenarios</strong></div><ArrowUpRight size={14} /></Link>
      <Link href="/workspace/clients" prefetch={false}><span><ShieldCheck size={17} /></span><div><small>CLIENT CONTEXT</small><strong>{number(clientCount, 0)} accessible clients</strong></div><ArrowUpRight size={14} /></Link>
      <Link href={`/workspace/personal-bot?marketSymbol=${encodeURIComponent(symbol)}&prompt=${encodeURIComponent(`Explain the saved research for ${symbol}, cite its source times, and identify the strongest supporting and opposing evidence. Separate sentiment from forecast probability.`)}`} prefetch={false}><span><Bot size={17} /></span><div><small>AI STUDIO</small><strong>Question the evidence</strong></div><ArrowUpRight size={14} /></Link>
    </nav>
  </>;
}
