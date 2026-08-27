import type { Metadata } from "next";
import {
  BrainCircuit,
  Database,
  GitBranch,
  Network,
  Route,
  ShieldCheck,
} from "lucide-react";

import KnowledgeGraphExplorer from "@/components/public-site/knowledge-graph-explorer";
import {
  PrimaryLink,
  PublicHero,
  PublicPage,
  PublicSurface,
  SecondaryLink,
  SectionHeading,
  TrustLine,
} from "@/components/public-site/public-shell";

export const metadata: Metadata = {
  title: "Knowledge Graph",
  description:
    "Explore how Slice connects market evidence, research, portfolios, clients, documents, workflows, agents, and governance.",
};

const BENEFITS = [
  {
    title: "Context instead of isolated records",
    description:
      "A security can connect to a theme, article, portfolio exposure, household goal, advisor decision, client draft, and retained outcome.",
    icon: Network,
  },
  {
    title: "Evidence that survives the workflow",
    description:
      "Source and freshness do not disappear after research. They can remain linked to the task, communication, review, and decision they supported.",
    icon: Route,
  },
  {
    title: "Reusable firm intelligence",
    description:
      "Prior work, documents, preferences, decisions, and outcomes become retrievable context rather than disconnected history.",
    icon: Database,
  },
  {
    title: "Governed reasoning paths",
    description:
      "Agents can explore connected context while role scope, evidence, review rules, and human control remain visible.",
    icon: ShieldCheck,
  },
];

function GraphAside() {
  return (
    <PublicSurface className="p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-800">
            Connected intelligence
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
            Relationships are part of the product, not a hidden database detail.
          </h2>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-700/15 bg-emerald-50 text-emerald-800">
          <GitBranch className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        <TrustLine>Market evidence connects to affected securities and themes.</TrustLine>
        <TrustLine>Portfolio context connects to households, goals, and review work.</TrustLine>
        <TrustLine>Documents connect extracted facts to tasks and retained knowledge.</TrustLine>
        <TrustLine>Client output connects back to sources, approvals, and decisions.</TrustLine>
      </div>

      <div className="mt-6 rounded-2xl border border-emerald-700/15 bg-emerald-50 p-4">
        <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-800">
          <BrainCircuit className="h-3.5 w-3.5" />
          Reasoning advantage
        </div>
        <p className="mt-3 text-xs font-semibold leading-6 text-emerald-950">
          A model can answer more useful questions when the relevant market,
          client, portfolio, document, workflow, and governance relationships
          are already structured and inspectable.
        </p>
      </div>
    </PublicSurface>
  );
}

export default function KnowledgeGraphPage() {
  return (
    <PublicPage active="knowledge-graph">
      <PublicHero
        eyebrow="Slice knowledge graph"
        title={
          <>
            See how every important signal <span className="text-emerald-700">connects to the work it changes.</span>
          </>
        }
        description="The knowledge graph gives Slice a shared context layer across markets, research, portfolios, clients, documents, workflows, communications, agents, and governance. The public explorer is now isolated on its own route and activates only through user interaction."
        actions={
          <>
            <PrimaryLink href="/capabilities">Browse connected systems</PrimaryLink>
            <SecondaryLink href="/platform">Review the architecture</SecondaryLink>
          </>
        }
        aside={<GraphAside />}
      />

      <section className="pb-16 sm:pb-20">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <KnowledgeGraphExplorer />
        </div>
      </section>

      <section className="border-y border-emerald-950/10 bg-white/45 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Why graph context matters"
            title="The same evidence can support research, service, operations, and governance."
            description="Slice does not need to duplicate intelligence into separate silos. A governed relationship layer can let each role and workflow retrieve the context it is permitted to use."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {BENEFITS.map((benefit) => {
              const Icon = benefit.icon;
              return (
                <PublicSurface key={benefit.title} className="p-6">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-700/15 bg-emerald-50 text-emerald-800">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="mt-5 text-lg font-black text-[var(--slice-heading)]">
                    {benefit.title}
                  </h3>
                  <p className="mt-3 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
                    {benefit.description}
                  </p>
                </PublicSurface>
              );
            })}
          </div>
        </div>
      </section>
    </PublicPage>
  );
}