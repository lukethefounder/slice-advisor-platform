import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  Bot,
  BrainCircuit,
  ChartCandlestick,
  CheckCircle2,
  Database,
  FileCheck2,
  FileText,
  GitBranch,
  Layers3,
  Network,
  Radar,
  ShieldCheck,
  UsersRound,
  Workflow,
  Zap,
  type LucideIcon,
} from "lucide-react";

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
  title: "Platform",
  description:
    "Understand the Slice advisor operating architecture from observation and connected context through action and review-first governance.",
};

const STAGES: Array<{
  number: string;
  title: string;
  summary: string;
  icon: LucideIcon;
  inputs: string[];
  outputs: string[];
}> = [
  {
    number: "01",
    title: "Observe",
    summary:
      "Markets, sourced news, uploaded documents, client activity, workflows, and firm operating data enter monitored provider and system layers.",
    icon: Radar,
    inputs: ["Market providers", "Official sources", "Client activity", "Firm data"],
    outputs: ["Freshness state", "Normalized evidence", "Source health"],
  },
  {
    number: "02",
    title: "Connect",
    summary:
      "The knowledge graph links securities, themes, portfolios, households, documents, decisions, tasks, communications, and policies.",
    icon: Network,
    inputs: ["Entities", "Relationships", "Prior decisions", "Permissions"],
    outputs: ["Context map", "Related evidence", "Firm memory"],
  },
  {
    number: "03",
    title: "Reason",
    summary:
      "Specialized AI and analytical paths rank materiality, identify disagreement, model risk, and assemble explainable next-step context.",
    icon: BrainCircuit,
    inputs: ["Market signals", "Research", "Portfolio context", "Client scope"],
    outputs: ["Ranked findings", "Confidence", "Risk context"],
  },
  {
    number: "04",
    title: "Act",
    summary:
      "Advisors move from evidence to portfolio review, client draft, meeting preparation, task, alert, or documented operating decision.",
    icon: Zap,
    inputs: ["Approved signals", "Firm workflow", "Advisor intent"],
    outputs: ["Drafts", "Tasks", "Meetings", "Review requests"],
  },
  {
    number: "05",
    title: "Govern",
    summary:
      "Permissions, source evidence, review gates, language checks, audit context, retention, and final human control remain attached to work.",
    icon: ShieldCheck,
    inputs: ["Policies", "Client scope", "Sensitive output", "Reviewer rules"],
    outputs: ["Approval state", "Required edits", "Audit trail"],
  },
];

const SYSTEMS = [
  {
    title: "Market and research intelligence",
    description:
      "Provider-backed quotes, technical context, sourced news, macro conditions, opportunity filters, and scenario inputs.",
    icon: ChartCandlestick,
    href: "/markets",
  },
  {
    title: "Connected firm memory",
    description:
      "A shared map of clients, securities, documents, decisions, outcomes, themes, workflows, and retained operating knowledge.",
    icon: GitBranch,
    href: "/knowledge-graph",
  },
  {
    title: "Advisor operations",
    description:
      "Client service, communication, meetings, documents, priorities, planning, and team workflows in one operating layer.",
    icon: Workflow,
    href: "/capabilities",
  },
  {
    title: "Controlled automation",
    description:
      "Role-aware assistants and specialist agents prepare, summarize, route, and draft while sensitive actions remain review-gated.",
    icon: Bot,
    href: "/workspace/personal-bot",
  },
];

const GOVERNANCE = [
  {
    title: "Source transparency",
    text: "Provider, timestamp, market state, relevance, and original evidence remain visible instead of being hidden behind a generated answer.",
    icon: FileText,
  },
  {
    title: "Role separation",
    text: "Founder, firm, advisor, and client routes can feel connected while continuing to expose different data and actions.",
    icon: UsersRound,
  },
  {
    title: "Review-first output",
    text: "Client-specific recommendations, claims, and sensitive communication remain under advisor or designated reviewer control.",
    icon: FileCheck2,
  },
  {
    title: "Operating health",
    text: "Integration readiness, scheduled work, provider degradation, queue status, and retained decisions can be inspected directly.",
    icon: Database,
  },
];

function ArchitectureAside() {
  return (
    <PublicSurface className="p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-800">
            Architecture at a glance
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
            Evidence flows forward. Governance travels with it.
          </h2>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-700/15 bg-emerald-50 text-emerald-800">
          <Layers3 className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 grid gap-2.5">
        {STAGES.map((stage, index) => {
          const Icon = stage.icon;
          return (
            <div key={stage.number} className="flex items-center gap-3">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-700/15 bg-white text-emerald-800 shadow-sm">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0 flex-1 rounded-xl border border-emerald-950/10 bg-[var(--slice-surface-muted)] px-3 py-2.5">
                <span className="text-[9px] font-black uppercase tracking-[0.15em] text-emerald-700">
                  {stage.number}
                </span>
                <span className="ml-2 text-sm font-black text-[var(--slice-heading)]">
                  {stage.title}
                </span>
              </div>
              {index < STAGES.length - 1 ? (
                <ArrowRight className="h-4 w-4 shrink-0 text-emerald-600" />
              ) : (
                <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-700" />
              )}
            </div>
          );
        })}
      </div>
    </PublicSurface>
  );
}

export default function PlatformPage() {
  return (
    <PublicPage active="platform">
      <PublicHero
        eyebrow="Slice platform architecture"
        title={
          <>
            From fragmented information to <span className="text-emerald-700">controlled advisor action.</span>
          </>
        }
        description="Slice is designed as an operating layer rather than a collection of disconnected tools. It preserves provider state and source evidence, adds connected firm context, coordinates specialized reasoning, and routes work through human review."
        actions={
          <>
            <PrimaryLink href="/capabilities">Browse capabilities</PrimaryLink>
            <SecondaryLink href="/knowledge-graph">Explore the graph</SecondaryLink>
          </>
        }
        aside={<ArchitectureAside />}
      />

      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Five connected stages"
            title="The operating loop is clear, inspectable, and reusable."
            description="Each stage has a distinct responsibility. Information is normalized before reasoning, relationships are made visible before action, and governance remains part of the workflow instead of becoming an afterthought."
          />

          <div className="mt-10 grid gap-5">
            {STAGES.map((stage) => {
              const Icon = stage.icon;
              return (
                <PublicSurface
                  key={stage.number}
                  className="grid gap-6 p-6 sm:p-8 lg:grid-cols-[auto_minmax(0,1.2fr)_minmax(18rem,0.8fr)] lg:items-start"
                >
                  <div className="flex items-center gap-3 lg:block">
                    <div className="grid h-14 w-14 place-items-center rounded-2xl border border-emerald-700/15 bg-emerald-50 text-emerald-800">
                      <Icon className="h-6 w-6" />
                    </div>
                    <div className="lg:mt-4">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-700">
                        Stage {stage.number}
                      </div>
                      <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
                        {stage.title}
                      </h3>
                    </div>
                  </div>

                  <p className="text-sm font-semibold leading-8 text-[var(--slice-muted)] sm:text-base">
                    {stage.summary}
                  </p>

                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
                    <div className="rounded-2xl border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-4">
                      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-[var(--slice-subtle)]">
                        Inputs
                      </div>
                      <div className="mt-3 flex flex-wrap gap-2">
                        {stage.inputs.map((input) => (
                          <span key={input} className="rounded-full border border-emerald-950/10 bg-white px-2.5 py-1 text-[10px] font-bold text-[var(--slice-muted)]">
                            {input}
                          </span>
                        ))}
                      </div>
                    </div>
                    <div className="rounded-2xl border border-emerald-700/15 bg-emerald-50/75 p-4">
                      <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-800">
                        Outputs
                      </div>
                      <div className="mt-3 grid gap-2">
                        {stage.outputs.map((output) => (
                          <div key={output} className="flex items-center gap-2 text-[10px] font-bold text-emerald-950">
                            <ArrowRight className="h-3 w-3 text-emerald-700" />
                            {output}
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                </PublicSurface>
              );
            })}
          </div>
        </div>
      </section>

      <section className="border-y border-emerald-950/10 bg-white/45 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Four operating systems"
            title="Broad capability, organized around how advisory work actually happens."
            description="Slice keeps market intelligence, firm memory, day-to-day operations, and automation connected while allowing each system to load and evolve independently."
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {SYSTEMS.map((system) => {
              const Icon = system.icon;
              return (
                <Link prefetch={false}
                  key={system.title}
                  href={system.href}
                  className="group flex flex-col rounded-[1.8rem] border border-emerald-950/10 bg-white/90 p-6 shadow-[0_20px_60px_rgba(6,78,55,0.09)] transition hover:-translate-y-1 hover:border-emerald-700/25 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40"
                >
                  <div className="grid h-12 w-12 place-items-center rounded-2xl border border-emerald-700/15 bg-emerald-50 text-emerald-800">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="mt-5 text-xl font-black tracking-[-0.035em] text-[var(--slice-heading)]">
                    {system.title}
                  </h3>
                  <p className="mt-3 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
                    {system.description}
                  </p>
                  <div className="mt-auto flex items-center gap-2 pt-6 text-xs font-black text-emerald-800">
                    Open connected route
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      <section className="py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Governance is structural"
            title="Speed does not require hiding uncertainty or removing control."
            description="The platform is built to show what it knows, where it came from, how current it is, and what still requires a person to review."
            action={<SecondaryLink href="/security">Open security</SecondaryLink>}
          />

          <div className="mt-10 grid gap-5 md:grid-cols-2 xl:grid-cols-4">
            {GOVERNANCE.map((item) => {
              const Icon = item.icon;
              return (
                <PublicSurface key={item.title} className="p-6">
                  <div className="grid h-11 w-11 place-items-center rounded-2xl border border-emerald-700/15 bg-emerald-50 text-emerald-800">
                    <Icon className="h-4.5 w-4.5" />
                  </div>
                  <h3 className="mt-5 text-lg font-black text-[var(--slice-heading)]">
                    {item.title}
                  </h3>
                  <p className="mt-3 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
                    {item.text}
                  </p>
                </PublicSurface>
              );
            })}
          </div>

          <PublicSurface className="mt-6 grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div>
              <div className="text-[10px] font-black uppercase tracking-[0.18em] text-emerald-800">
                Operating principles
              </div>
              <div className="mt-5 grid gap-3 sm:grid-cols-2">
                <TrustLine>Evidence stays connected to the work it supports.</TrustLine>
                <TrustLine>Provider degradation is visible rather than replaced by invented data.</TrustLine>
                <TrustLine>Role-aware interfaces do not imply identical permissions.</TrustLine>
                <TrustLine>Human approval remains the final gate for sensitive client output.</TrustLine>
              </div>
            </div>
            <PrimaryLink href="/markets">Inspect live provider states</PrimaryLink>
          </PublicSurface>
        </div>
      </section>
    </PublicPage>
  );
}