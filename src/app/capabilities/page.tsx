import type { Metadata } from "next";
import Link from "next/link";
import {
  ArrowRight,
  BellRing,
  Bot,
  BrainCircuit,
  BriefcaseBusiness,
  ChartCandlestick,
  CheckCircle2,
  CircleUserRound,
  FileCheck2,
  FileText,
  Gauge,
  GitBranch,
  LayoutDashboard,
  Mail,
  Radar,
  Scale,
  Settings2,
  ShieldCheck,
  Sparkles,
  UsersRound,
  Workflow,
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
  title: "Capabilities",
  description:
    "Browse Slice capabilities across investment intelligence, advisor operations, automation, and governance.",
};

type Capability = {
  title: string;
  description: string;
  detail: string;
  href: string;
  icon: LucideIcon;
};

type CapabilityGroup = {
  number: string;
  label: string;
  title: string;
  description: string;
  icon: LucideIcon;
  items: Capability[];
};

const GROUPS: CapabilityGroup[] = [
  {
    number: "01",
    label: "Investment intelligence",
    title: "Understand markets, risks, opportunities, and evidence.",
    description:
      "Provider-aware market context, sourced research, forecasting, portfolio analysis, and opportunity screening remain connected rather than living in separate products.",
    icon: BrainCircuit,
    items: [
      {
        title: "Live market command",
        description: "Compact provider quotes with visible freshness and optional full analysis.",
        detail:
          "Inspect state, entitlement, timestamps, movement, quality, technicals, and symbol news without loading the full stack on every route.",
        href: "/markets",
        icon: ChartCandlestick,
      },
      {
        title: "Daily sourced intelligence",
        description: "A fixed morning edition ranked for advisor relevance.",
        detail:
          "Source evidence, themes, materiality, alert candidates, digest candidates, and provider health remain attached.",
        href: "/daily-intelligence",
        icon: FileText,
      },
      {
        title: "Opportunity radar",
        description: "Screen for developing investment and client-review opportunities.",
        detail:
          "Signals can combine market structure, technical context, news, macro conditions, portfolio exposure, and confidence.",
        href: "/opportunity-radar",
        icon: Radar,
      },
      {
        title: "Portfolio laboratory",
        description: "Review exposure, concentration, drift, scenarios, and tradeoffs.",
        detail:
          "Portfolio analysis can connect holdings and goals to market evidence, risk, liquidity, taxes, and client communication.",
        href: "/portfolio-lab",
        icon: Gauge,
      },
    ],
  },
  {
    number: "02",
    label: "Advisor operations",
    title: "Turn intelligence into organized client and firm work.",
    description:
      "Client service, priorities, communication, meetings, documents, and team workflows operate from shared context instead of repeated manual transfer.",
    icon: BriefcaseBusiness,
    items: [
      {
        title: "Advisor workspace",
        description: "A unified operating board for daily priorities and client work.",
        detail:
          "Combine watchlists, signals, tasks, briefs, communication, meetings, documents, and service needs in one protected route family.",
        href: "/workspace",
        icon: LayoutDashboard,
      },
      {
        title: "Client relationship layer",
        description: "Profiles, goals, risk updates, assignments, meetings, and messages.",
        detail:
          "Each client can remain connected to the correct advisor, documents, conversations, service history, and next actions.",
        href: "/client-login",
        icon: CircleUserRound,
      },
      {
        title: "Communication center",
        description: "Draft, review, approve, and deliver advisor communication.",
        detail:
          "Generated options remain editable, previewable, source-aware, client-scoped, and subject to human approval before sending.",
        href: "/workspace/client-emails",
        icon: Mail,
      },
      {
        title: "Firm planning",
        description: "Coordinate priorities, ownership, risks, cadence, and outcomes.",
        detail:
          "Leadership and teams can turn strategic priorities into clear operating work without losing the evidence behind each decision.",
        href: "/firm-planning",
        icon: UsersRound,
      },
    ],
  },
  {
    number: "03",
    label: "Automation and agents",
    title: "Remove repetitive preparation while preserving deliberate control.",
    description:
      "Role-aware assistants and specialist agents can research, summarize, route, draft, monitor, and prepare work within explicit data and action boundaries.",
    icon: Bot,
    items: [
      {
        title: "Personal advisor bot",
        description: "A preference-aware assistant for each authorized user.",
        detail:
          "The assistant can learn approved working preferences, prepare daily context, answer questions, and help complete permitted workspace tasks.",
        href: "/workspace/personal-bot",
        icon: Sparkles,
      },
      {
        title: "Research agent mesh",
        description: "Multiple bounded analytical paths for stronger research coverage.",
        detail:
          "Market, news, macro, portfolio, risk, client, document, and governance paths can compare findings before a consolidated result.",
        href: "/intelligence",
        icon: GitBranch,
      },
      {
        title: "Workflow automation",
        description: "Convert signals and service needs into routed operating work.",
        detail:
          "Create tasks, reminders, review requests, meeting preparation, draft queues, and escalations with ownership and status.",
        href: "/workspace",
        icon: Workflow,
      },
      {
        title: "Alert orchestration",
        description: "Prioritize what needs attention without flooding the advisor.",
        detail:
          "Alerts can account for materiality, confidence, freshness, portfolio relevance, client scope, duplication, and review status.",
        href: "/workspace/watchlists",
        icon: BellRing,
      },
    ],
  },
  {
    number: "04",
    label: "Governance and control",
    title: "Keep permissions, evidence, review, and system health visible.",
    description:
      "Governance is embedded throughout the platform so faster research and operations do not require hidden uncertainty or uncontrolled client-facing output.",
    icon: ShieldCheck,
    items: [
      {
        title: "Review-first governance",
        description: "Sensitive output remains under advisor or designated reviewer control.",
        detail:
          "Client-specific claims, recommendations, delivery, and high-impact actions can require explicit review with retained evidence and edits.",
        href: "/security",
        icon: FileCheck2,
      },
      {
        title: "Role and permission control",
        description: "Founder, firm, advisor, and client experiences expose different authority.",
        detail:
          "Connected interfaces can still respect tenant, assignment, role, action, document, communication, and administrative boundaries.",
        href: "/security",
        icon: Scale,
      },
      {
        title: "System readiness",
        description: "Inspect integrations, queues, provider configuration, and runtime health.",
        detail:
          "The platform can report what is configured, missing, disabled, degraded, or simulated without disclosing secret credential values.",
        href: "/backend-readiness",
        icon: Settings2,
      },
      {
        title: "Founder command center",
        description: "Leadership-level visibility and controlled platform administration.",
        detail:
          "The founder route can coordinate firm health, teams, integrations, operating priorities, system controls, and strategic oversight.",
        href: "/founder-login",
        icon: BriefcaseBusiness,
      },
    ],
  },
];

function CapabilityAside() {
  return (
    <PublicSurface className="p-6 sm:p-7">
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-[9px] font-black uppercase tracking-[0.18em] text-emerald-800">
            Four connected systems
          </div>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
            Broad capability without a crowded public entry page.
          </h2>
        </div>
        <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-700/15 bg-emerald-50 text-emerald-800">
          <BriefcaseBusiness className="h-5 w-5" />
        </div>
      </div>

      <div className="mt-6 grid gap-3">
        {GROUPS.map((group) => {
          const Icon = group.icon;
          return (
            <div key={group.number} className="flex items-center gap-3 rounded-2xl border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-3.5">
              <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl border border-emerald-700/15 bg-white text-emerald-800">
                <Icon className="h-4 w-4" />
              </div>
              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-[0.14em] text-emerald-700">
                  System {group.number}
                </div>
                <div className="mt-0.5 text-sm font-black text-[var(--slice-heading)]">
                  {group.label}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </PublicSurface>
  );
}

export default function CapabilitiesPage() {
  return (
    <PublicPage active="capabilities">
      <PublicHero
        eyebrow="Slice capability map"
        title={
          <>
            Everything an advisory firm needs, <span className="text-emerald-700">organized into four operating systems.</span>
          </>
        }
        description="Slice is deliberately broad, but it should never feel like one endless page. Capabilities are now grouped by purpose, linked to their own routes, and separated from the lightweight public homepage."
        actions={
          <>
            <PrimaryLink href="/advisor-signup">Start advisor onboarding</PrimaryLink>
            <SecondaryLink href="/platform">Review architecture</SecondaryLink>
          </>
        }
        aside={<CapabilityAside />}
      />

      <section className="pb-16 sm:pb-20">
        <div className="mx-auto w-full max-w-[1500px] space-y-8 px-4 sm:px-6 lg:px-8">
          {GROUPS.map((group) => {
            const GroupIcon = group.icon;
            return (
              <PublicSurface key={group.number} className="overflow-hidden">
                <div className="grid gap-6 border-b border-emerald-950/10 bg-[linear-gradient(110deg,rgba(16,163,111,0.10),transparent_65%)] p-6 sm:p-8 lg:grid-cols-[auto_minmax(0,1fr)] lg:items-center">
                  <div className="grid h-14 w-14 place-items-center rounded-2xl border border-emerald-700/15 bg-white text-emerald-800 shadow-sm">
                    <GroupIcon className="h-6 w-6" />
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-[0.19em] text-emerald-800">
                      System {group.number} · {group.label}
                    </div>
                    <h2 className="mt-2 text-3xl font-black tracking-[-0.045em] text-[var(--slice-heading)]">
                      {group.title}
                    </h2>
                    <p className="mt-3 max-w-4xl text-sm font-semibold leading-7 text-[var(--slice-muted)]">
                      {group.description}
                    </p>
                  </div>
                </div>

                <div className="grid md:grid-cols-2">
                  {group.items.map((item, index) => {
                    const Icon = item.icon;
                    return (
                      <Link prefetch={false}
                        key={item.title}
                        href={item.href}
                        className={[
                          "group relative p-6 transition hover:bg-emerald-50/70 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-emerald-600/40 sm:p-8",
                          index % 2 === 0 ? "md:border-r md:border-emerald-950/10" : "",
                          index < 2 ? "border-b border-emerald-950/10" : "",
                        ].join(" ")}
                      >
                        <div className="flex items-start gap-4">
                          <div className="grid h-12 w-12 shrink-0 place-items-center rounded-2xl border border-emerald-700/15 bg-emerald-50 text-emerald-800 transition group-hover:bg-emerald-100">
                            <Icon className="h-5 w-5" />
                          </div>
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-3">
                              <h3 className="text-xl font-black tracking-[-0.035em] text-[var(--slice-heading)]">
                                {item.title}
                              </h3>
                              <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-emerald-700 transition-transform group-hover:translate-x-1" />
                            </div>
                            <p className="mt-2 text-sm font-black leading-6 text-[var(--slice-text)]">
                              {item.description}
                            </p>
                            <p className="mt-3 text-xs font-semibold leading-6 text-[var(--slice-muted)]">
                              {item.detail}
                            </p>
                          </div>
                        </div>
                      </Link>
                    );
                  })}
                </div>
              </PublicSurface>
            );
          })}
        </div>
      </section>

      <section className="border-y border-emerald-950/10 bg-white/45 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-[1500px] px-4 sm:px-6 lg:px-8">
          <SectionHeading
            eyebrow="Connected, not collapsed"
            title="Separate routes improve usability without breaking the operating model."
            description="Each capability can have the interface, data strategy, loading behavior, and permissions it needs. The knowledge graph and shared operating context provide continuity between them."
          />

          <PublicSurface className="mt-10 grid gap-7 p-6 sm:p-8 lg:grid-cols-[1fr_auto] lg:items-center">
            <div className="grid gap-3 sm:grid-cols-2">
              <TrustLine>Public education routes remain fast and indexable.</TrustLine>
              <TrustLine>Protected modules remain role-aware and data-scoped.</TrustLine>
              <TrustLine>Live provider requests happen only where they add value.</TrustLine>
              <TrustLine>Governance, evidence, and firm context still travel across workflows.</TrustLine>
            </div>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-700/20 bg-emerald-50 px-4 py-2 text-xs font-black text-emerald-900">
              <CheckCircle2 className="h-4 w-4" />
              Clearer product architecture
            </div>
          </PublicSurface>
        </div>
      </section>
    </PublicPage>
  );
}