"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  ChartCandlestick,
  Database,
  FileCheck2,
  FileText,
  GitBranch,
  Landmark,
  Mail,
  Newspaper,
  PieChart,
  UsersRound,
  Workflow,
  type LucideIcon,
} from "lucide-react";

type Layer = "market" | "intelligence" | "advisor" | "governance";
type Filter = "all" | Layer;

type GraphNode = {
  id: string;
  x: number;
  y: number;
  label: string;
  eyebrow: string;
  description: string;
  layer: Layer;
  href: string;
  icon: LucideIcon;
  inputs: string[];
  outputs: string[];
};

type GraphEdge = {
  id: string;
  from: string;
  to: string;
  layer: Layer;
  bend?: number;
};

const NODES: GraphNode[] = [
  {
    id: "core",
    x: 500,
    y: 310,
    label: "Slice Intelligence Core",
    eyebrow: "Orchestration",
    description:
      "The reasoning layer that joins provider data, sourced evidence, firm memory, client context, and governance before an output is produced.",
    layer: "intelligence",
    href: "/command",
    icon: BrainCircuit,
    inputs: ["Provider data", "Research", "Firm memory", "Client context"],
    outputs: ["Ranked signals", "Drafts", "Tasks", "Review requests"],
  },
  {
    id: "markets",
    x: 105,
    y: 110,
    label: "Live Markets",
    eyebrow: "Provider layer",
    description:
      "Quotes, market state, timestamp age, volume, and technical context enter with explicit provider and entitlement status.",
    layer: "market",
    href: "/markets",
    icon: ChartCandlestick,
    inputs: ["Quotes", "Price history", "Market state"],
    outputs: ["Movement", "Freshness", "Technical context"],
  },
  {
    id: "macro",
    x: 110,
    y: 485,
    label: "Macro Context",
    eyebrow: "Economic layer",
    description:
      "Rates, inflation, liquidity, policy, and economic releases connect to themes, securities, and portfolio scenarios.",
    layer: "market",
    href: "/intelligence",
    icon: Landmark,
    inputs: ["Rates", "Inflation", "Policy", "Economic data"],
    outputs: ["Regime context", "Scenarios", "Theme links"],
  },
  {
    id: "news",
    x: 275,
    y: 175,
    label: "Sourced News",
    eyebrow: "Evidence layer",
    description:
      "Official feeds and provider stories are ranked by recency, relevance, materiality, and source quality.",
    layer: "intelligence",
    href: "/daily-intelligence",
    icon: Newspaper,
    inputs: ["Official feeds", "Provider news", "Source health"],
    outputs: ["Daily edition", "Alerts", "Digest candidates"],
  },
  {
    id: "agents",
    x: 500,
    y: 95,
    label: "Agent Mesh",
    eyebrow: "Parallel reasoning",
    description:
      "Market, research, portfolio, risk, client, document, and governance agents work in bounded paths before rejoining the core.",
    layer: "intelligence",
    href: "/intelligence",
    icon: Bot,
    inputs: ["Research questions", "Tools", "Policies"],
    outputs: ["Independent findings", "Debate", "Consensus"],
  },
  {
    id: "portfolio",
    x: 720,
    y: 115,
    label: "Portfolio Lab",
    eyebrow: "Investment context",
    description:
      "Holdings, allocation, drift, concentration, liquidity, tax context, goals, and scenario impact connect to research.",
    layer: "advisor",
    href: "/portfolio-lab",
    icon: PieChart,
    inputs: ["Holdings", "Goals", "Signals"],
    outputs: ["Exposure review", "Scenarios", "Talking points"],
  },
  {
    id: "clients",
    x: 900,
    y: 190,
    label: "Client Graph",
    eyebrow: "Relationship context",
    description:
      "Households, goals, assigned advisors, preferences, risk updates, meetings, messages, and documents stay connected.",
    layer: "advisor",
    href: "/client-login",
    icon: UsersRound,
    inputs: ["Profiles", "Goals", "Messages", "Documents"],
    outputs: ["Advisor context", "Service needs", "Next actions"],
  },
  {
    id: "communication",
    x: 900,
    y: 385,
    label: "Communication Center",
    eyebrow: "Reviewed output",
    description:
      "Emails, briefs, talking points, meeting notes, approval queues, and client delivery preserve the evidence that informed them.",
    layer: "advisor",
    href: "/workspace/client-emails",
    icon: Mail,
    inputs: ["Signals", "Client context", "Firm voice"],
    outputs: ["Drafts", "Approvals", "Delivered updates"],
  },
  {
    id: "documents",
    x: 850,
    y: 535,
    label: "Document Intelligence",
    eyebrow: "Retained evidence",
    description:
      "Uploaded statements, forms, agreements, and research produce extracted facts, obligations, tasks, and knowledge links.",
    layer: "advisor",
    href: "/workspace",
    icon: FileText,
    inputs: ["Statements", "Forms", "Research", "Agreements"],
    outputs: ["Extracted facts", "Tasks", "Knowledge links"],
  },
  {
    id: "workflow",
    x: 540,
    y: 535,
    label: "Workflow Engine",
    eyebrow: "Execution",
    description:
      "Signals and client needs become tasks, reminders, meetings, approval queues, routing, and operating cadence.",
    layer: "advisor",
    href: "/workspace",
    icon: Workflow,
    inputs: ["Signals", "Client needs", "Firm priorities"],
    outputs: ["Tasks", "Schedules", "Escalations"],
  },
  {
    id: "memory",
    x: 305,
    y: 500,
    label: "Firm Memory",
    eyebrow: "Institutional context",
    description:
      "Prior decisions, advisor preferences, documents, outcomes, and reusable firm knowledge provide continuity and precedent.",
    layer: "governance",
    href: "/command",
    icon: Database,
    inputs: ["Decisions", "Documents", "Outcomes"],
    outputs: ["Continuity", "Precedent", "Context retrieval"],
  },
  {
    id: "compliance",
    x: 695,
    y: 365,
    label: "Review and Compliance",
    eyebrow: "Control plane",
    description:
      "Permissions, review-first rules, source evidence, language checks, retention, and audit context gate sensitive output.",
    layer: "governance",
    href: "/security",
    icon: FileCheck2,
    inputs: ["Drafts", "Policies", "Client scope"],
    outputs: ["Approval", "Required edits", "Audit trail"],
  },
  {
    id: "founder",
    x: 670,
    y: 525,
    label: "Founder Command",
    eyebrow: "Leadership access",
    description:
      "Firm-wide operations, integration health, team oversight, feature control, and command-level visibility support leadership decisions.",
    layer: "governance",
    href: "/founder-login",
    icon: BriefcaseBusiness,
    inputs: ["Firm metrics", "System health", "Operations"],
    outputs: ["Priorities", "Controls", "Escalations"],
  },
];

const EDGES: GraphEdge[] = [
  { id: "markets-news", from: "markets", to: "news", layer: "market", bend: -30 },
  { id: "markets-core", from: "markets", to: "core", layer: "market", bend: 38 },
  { id: "macro-core", from: "macro", to: "core", layer: "market", bend: -35 },
  { id: "news-agents", from: "news", to: "agents", layer: "intelligence", bend: -28 },
  { id: "news-core", from: "news", to: "core", layer: "intelligence", bend: 18 },
  { id: "agents-core", from: "agents", to: "core", layer: "intelligence", bend: 0 },
  { id: "core-portfolio", from: "core", to: "portfolio", layer: "advisor", bend: -24 },
  { id: "portfolio-clients", from: "portfolio", to: "clients", layer: "advisor", bend: -20 },
  { id: "clients-communication", from: "clients", to: "communication", layer: "advisor", bend: 22 },
  { id: "core-communication", from: "core", to: "communication", layer: "advisor", bend: 34 },
  { id: "core-workflow", from: "core", to: "workflow", layer: "advisor", bend: 16 },
  { id: "workflow-documents", from: "workflow", to: "documents", layer: "advisor", bend: 12 },
  { id: "memory-core", from: "memory", to: "core", layer: "governance", bend: -22 },
  { id: "core-compliance", from: "core", to: "compliance", layer: "governance", bend: -12 },
  { id: "compliance-communication", from: "compliance", to: "communication", layer: "governance", bend: -15 },
  { id: "compliance-documents", from: "compliance", to: "documents", layer: "governance", bend: 20 },
  { id: "workflow-founder", from: "workflow", to: "founder", layer: "governance", bend: 10 },
];

const FILTERS: Array<{ key: Filter; label: string }> = [
  { key: "all", label: "All layers" },
  { key: "market", label: "Market" },
  { key: "intelligence", label: "Intelligence" },
  { key: "advisor", label: "Advisor" },
  { key: "governance", label: "Governance" },
];

const LAYER_STYLE: Record<
  Layer,
  { button: string; icon: string; edge: string; label: string }
> = {
  market: {
    button: "border-sky-700/25 bg-sky-50 text-sky-950",
    icon: "border-sky-700/20 bg-white text-sky-800",
    edge: "#0284c7",
    label: "Market layer",
  },
  intelligence: {
    button: "border-emerald-700/25 bg-emerald-50 text-emerald-950",
    icon: "border-emerald-700/20 bg-white text-emerald-800",
    edge: "#059669",
    label: "Intelligence layer",
  },
  advisor: {
    button: "border-cyan-700/25 bg-cyan-50 text-cyan-950",
    icon: "border-cyan-700/20 bg-white text-cyan-800",
    edge: "#0891b2",
    label: "Advisor layer",
  },
  governance: {
    button: "border-violet-700/25 bg-violet-50 text-violet-950",
    icon: "border-violet-700/20 bg-white text-violet-800",
    edge: "#7c3aed",
    label: "Governance layer",
  },
};

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function graphPath(edge: GraphEdge) {
  const from = NODES.find((node) => node.id === edge.from);
  const to = NODES.find((node) => node.id === edge.to);
  if (!from || !to) return "";

  const midpointX = (from.x + to.x) / 2;
  const midpointY = (from.y + to.y) / 2;
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.max(Math.sqrt(dx * dx + dy * dy), 1);
  const bend = edge.bend ?? 0;
  const controlX = midpointX + (-dy / length) * bend;
  const controlY = midpointY + (dx / length) * bend;

  return `M ${from.x} ${from.y} Q ${controlX.toFixed(2)} ${controlY.toFixed(2)} ${to.x} ${to.y}`;
}

export default function KnowledgeGraphExplorer() {
  const [filter, setFilter] = useState<Filter>("all");
  const [selectedId, setSelectedId] = useState("core");
  const selected = useMemo(
    () => NODES.find((node) => node.id === selectedId) ?? NODES[0],
    [selectedId],
  );
  const SelectedIcon = selected.icon;
  const visibleNodeIds = useMemo(
    () =>
      new Set(
        NODES.filter((node) => filter === "all" || node.layer === filter).map(
          (node) => node.id,
        ),
      ),
    [filter],
  );
  const visibleEdges = useMemo(
    () =>
      EDGES.filter(
        (edge) =>
          filter === "all" ||
          edge.layer === filter ||
          (visibleNodeIds.has(edge.from) && visibleNodeIds.has(edge.to)),
      ),
    [filter, visibleNodeIds],
  );

  return (
    <section className="rounded-[2rem] border border-emerald-950/10 bg-white/88 p-4 shadow-[0_24px_80px_rgba(6,78,55,0.11)] backdrop-blur-xl sm:p-6 lg:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-700/20 bg-emerald-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-900">
            <GitBranch className="h-3.5 w-3.5" />
            Interactive relationship map
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-[-0.05em] text-[var(--slice-heading)] sm:text-4xl">
            Select a node to inspect its role, inputs, and outputs.
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[var(--slice-muted)]">
            The map uses static paths and interaction-driven updates. There are
            no perpetual motion loops, particle fields, or off-screen animations
            consuming resources while the user reads.
          </p>
        </div>

        <div className="flex flex-wrap gap-2" role="group" aria-label="Graph layer filter">
          {FILTERS.map((item) => (
            <button
              key={item.key}
              type="button"
              onClick={() => setFilter(item.key)}
              aria-pressed={filter === item.key}
              className={cx(
                "rounded-full border px-3 py-2 text-[10px] font-black uppercase tracking-[0.12em] transition",
                filter === item.key
                  ? "border-emerald-800/25 bg-emerald-700 text-white"
                  : "border-emerald-950/10 bg-white text-[var(--slice-muted)] hover:border-emerald-700/25 hover:bg-emerald-50",
              )}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-7 grid gap-6 xl:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="overflow-x-auto rounded-[1.7rem] border border-emerald-950/10 bg-[linear-gradient(145deg,#f7fcf9,#eef9f3)] p-3 sm:p-4">
          <div className="relative min-h-[620px] min-w-[1000px] overflow-hidden rounded-[1.35rem] border border-emerald-950/10 bg-white/75">
            <div className="absolute inset-0 bg-[linear-gradient(rgba(5,120,83,0.035)_1px,transparent_1px),linear-gradient(90deg,rgba(5,120,83,0.035)_1px,transparent_1px)] [background-size:44px_44px]" />

            <svg
              className="absolute inset-0 h-full w-full"
              viewBox="0 0 1000 620"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              {visibleEdges.map((edge) => {
                const active =
                  edge.from === selected.id || edge.to === selected.id;
                return (
                  <path
                    key={edge.id}
                    d={graphPath(edge)}
                    fill="none"
                    stroke={LAYER_STYLE[edge.layer].edge}
                    strokeOpacity={active ? 0.72 : 0.18}
                    strokeWidth={active ? 2.5 : 1.4}
                    strokeDasharray={active ? "none" : "6 8"}
                  />
                );
              })}
            </svg>

            {NODES.map((node) => {
              const Icon = node.icon;
              const visible = filter === "all" || node.layer === filter;
              const selectedNode = node.id === selected.id;
              const style = LAYER_STYLE[node.layer];

              return (
                <button
                  key={node.id}
                  type="button"
                  onClick={() => setSelectedId(node.id)}
                  className={cx(
                    "absolute z-10 -translate-x-1/2 -translate-y-1/2 rounded-2xl border px-3 py-2.5 text-left shadow-[0_12px_34px_rgba(6,78,55,0.12)] transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/45",
                    style.button,
                    visible ? "opacity-100" : "pointer-events-none opacity-20 grayscale",
                    selectedNode
                      ? "scale-110 ring-2 ring-emerald-700/20"
                      : "hover:scale-105",
                    node.id === "core" &&
                      "min-w-[185px] border-emerald-700/35 bg-emerald-100 shadow-[0_18px_50px_rgba(5,120,83,0.18)]",
                  )}
                  style={{ left: `${node.x / 10}%`, top: `${(node.y / 620) * 100}%` }}
                  aria-pressed={selectedNode}
                >
                  <div className="flex items-center gap-2.5">
                    <span className={cx("grid h-9 w-9 shrink-0 place-items-center rounded-xl border", style.icon)}>
                      <Icon className="h-4 w-4" />
                    </span>
                    <span>
                      <span className="block text-[8px] font-black uppercase tracking-[0.13em] opacity-70">
                        {node.eyebrow}
                      </span>
                      <span className="mt-0.5 block whitespace-nowrap text-[10px] font-black">
                        {node.label}
                      </span>
                    </span>
                  </div>
                </button>
              );
            })}

            <div className="absolute bottom-3 left-3 z-20 rounded-full border border-emerald-950/10 bg-white/90 px-3 py-2 text-[9px] font-black uppercase tracking-[0.13em] text-[var(--slice-muted)] shadow-sm">
              {visibleNodeIds.size} visible nodes · {visibleEdges.length} visible paths
            </div>
          </div>
        </div>

        <aside className="h-fit rounded-[1.7rem] border border-emerald-950/10 bg-white p-5 shadow-[0_18px_55px_rgba(6,78,55,0.09)] xl:sticky xl:top-28 sm:p-6">
          <div className="flex items-start justify-between gap-4">
            <div className={cx("grid h-12 w-12 place-items-center rounded-2xl border", LAYER_STYLE[selected.layer].icon)}>
              <SelectedIcon className="h-5 w-5" />
            </div>
            <span className={cx("rounded-full border px-2.5 py-1 text-[8px] font-black uppercase tracking-[0.15em]", LAYER_STYLE[selected.layer].button)}>
              {LAYER_STYLE[selected.layer].label}
            </span>
          </div>

          <div className="mt-6 text-[9px] font-black uppercase tracking-[0.18em] text-emerald-800">
            {selected.eyebrow}
          </div>
          <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
            {selected.label}
          </h3>
          <p className="mt-4 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
            {selected.description}
          </p>

          <div className="mt-6 grid gap-4">
            <div className="rounded-2xl border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-4">
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--slice-subtle)]">
                Inputs
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {selected.inputs.map((input) => (
                  <span key={input} className="rounded-full border border-emerald-950/10 bg-white px-2.5 py-1 text-[9px] font-bold text-[var(--slice-muted)]">
                    {input}
                  </span>
                ))}
              </div>
            </div>

            <div className="rounded-2xl border border-emerald-700/15 bg-emerald-50 p-4">
              <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-800">
                Outputs
              </div>
              <div className="mt-3 grid gap-2">
                {selected.outputs.map((output) => (
                  <div key={output} className="flex items-center gap-2 text-[10px] font-bold text-emerald-950">
                    <ArrowRight className="h-3 w-3 text-emerald-700" />
                    {output}
                  </div>
                ))}
              </div>
            </div>
          </div>

          <Link prefetch={false}
            href={selected.href}
            className="group mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-800/20 bg-[linear-gradient(110deg,#16a36f,#07533c)] px-4 py-3 text-sm font-black text-white shadow-[0_12px_26px_rgba(5,120,83,0.20)] transition hover:brightness-105"
          >
            Open connected module
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
          </Link>
        </aside>
      </div>
    </section>
  );
}