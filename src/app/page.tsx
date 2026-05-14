import {
  Card,
  LinkButton,
  Metric,
  Pill,
  SectionHeader,
  SliceBackground,
  SoftCard,
  TopNav,
} from "@/components/slice-ui";

const platformModules = [
  {
    title: "Advisor Operating Graph",
    description:
      "Connects alerts, sources, portfolios, tasks, client communication, meeting prep, compliance memory, and firm intelligence into one workflow.",
    tone: "red" as const,
  },
  {
    title: "Portfolio Impact Twin",
    description:
      "Translates credible events into client-specific portfolio impact, affected exposures, and advisor-facing action options.",
    tone: "purple" as const,
  },
  {
    title: "Personal AI Bots",
    description:
      "Every advisor/client workflow can be personalized by tone, detail level, task preferences, and approval requirements.",
    tone: "green" as const,
  },
  {
    title: "Source Credibility Engine",
    description:
      "Scores sources before action is recommended, reducing noise and improving advisor trust.",
    tone: "amber" as const,
  },
  {
    title: "Event-to-Action Autopilot",
    description:
      "Routes credible events into tasks, drafts, briefings, meeting prep, vault records, and simulated delivery queues.",
    tone: "red" as const,
  },
  {
    title: "Adaptive Intelligence",
    description:
      "Learns from advisor feedback, source outcomes, client preferences, and bot performance over time.",
    tone: "purple" as const,
  },
];

const workflowSteps = [
  {
    step: "01",
    title: "Scan",
    body: "Slice ingests alerts, market events, firm priorities, portfolio holdings, watchlists, and client context.",
  },
  {
    step: "02",
    title: "Score",
    body: "The platform ranks materiality, relevance, source credibility, urgency, trust, and client impact.",
  },
  {
    step: "03",
    title: "Route",
    body: "Credible events become task board items, meeting prep, client drafts, briefings, and compliance memory.",
  },
  {
    step: "04",
    title: "Learn",
    body: "Advisor feedback tunes future bot behavior, source weighting, client communication, and workflow recommendations.",
  },
];

export default function LandingPage() {
  return (
    <SliceBackground>
      <div className="mx-auto grid max-w-[1500px] gap-8 px-5 py-5">
        <TopNav />

        <section className="grid min-h-[calc(100vh-8rem)] items-center gap-8 py-10 xl:grid-cols-[1.08fr_0.92fr]">
          <div>
            <Pill tone="red">Advisor intelligence operating system</Pill>

            <h1 className="mt-6 max-w-6xl text-5xl font-black leading-[0.92] tracking-tight md:text-7xl xl:text-8xl">
              The command layer for modern wealth advisors.
            </h1>

            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300">
              Slice helps advisor firms move from noisy information to
              source-backed decisions, client-ready communication, compliance
              memory, meeting prep, and adaptive firm intelligence.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <LinkButton href="/advisor-os" variant="danger" className="px-6 py-4">
                Open Advisor OS
              </LinkButton>
              <LinkButton href="/workspace" variant="primary" className="px-6 py-4">
                Enter Workspace
              </LinkButton>
              <LinkButton href="/portal" variant="secondary" className="px-6 py-4">
                View Portal
              </LinkButton>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Advisor OS"
                value="Live"
                helper="AI workflow layer"
                tone="red"
              />
              <Metric
                label="Adaptive AI"
                value="Phase 3"
                helper="Learning enabled"
                tone="purple"
              />
              <Metric
                label="Communication"
                value="Drafts"
                helper="Approval-gated"
                tone="green"
              />
              <Metric
                label="Compliance"
                value="Vault"
                helper="Evidence retained"
                tone="amber"
              />
            </div>
          </div>

          <Card className="p-5">
            <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-red-500/15 to-transparent" />
            <div className="relative">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-slate-500">
                    Slice workflow
                  </div>
                  <h2 className="mt-2 text-3xl font-black">
                    Signal → Impact → Action → Memory
                  </h2>
                </div>
                <Pill tone="green">Premium UI shell</Pill>
              </div>

              <div className="mt-6 grid gap-3">
                {workflowSteps.map((item) => (
                  <div
                    key={item.step}
                    className="grid gap-4 rounded-[1.5rem] border border-white/10 bg-black/28 p-4 md:grid-cols-[64px_1fr]"
                  >
                    <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-red-600 to-red-950 text-lg font-black shadow-lg shadow-red-950/30">
                      {item.step}
                    </div>
                    <div>
                      <div className="text-lg font-black">{item.title}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        {item.body}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </Card>
        </section>

        <section className="grid gap-6 py-8">
          <SectionHeader
            eyebrow="Platform moat"
            title="A unified advisor platform, not another disconnected dashboard."
            description="The goal is to make Slice feel like the single operating surface for advisor intelligence, client response, meeting preparation, firm execution, and compliance-aware memory."
          />

          <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
            {platformModules.map((module) => (
              <Card key={module.title} className="p-5">
                <Pill tone={module.tone}>{module.title}</Pill>
                <p className="mt-4 text-sm leading-7 text-slate-400">
                  {module.description}
                </p>
              </Card>
            ))}
          </div>
        </section>

        <section className="grid gap-5 py-8 xl:grid-cols-[0.85fr_1.15fr]">
          <Card className="p-6">
            <SectionHeader
              eyebrow="Advisor experience"
              title="One premium command center."
              description="Advisor OS should be the page an advisor keeps open all day: what matters, why it matters, who is affected, what to do, and what has been retained."
            />

            <div className="mt-6 grid gap-3">
              {[
                "Prioritize source-backed opportunities instead of raw headlines.",
                "Explain portfolio impact before client outreach.",
                "Draft communication in the client’s preferred style.",
                "Store rationale, evidence, approvals, and delivery records.",
                "Improve future workflows through advisor feedback.",
              ].map((item) => (
                <SoftCard key={item}>
                  <div className="text-sm font-semibold leading-6 text-slate-300">
                    {item}
                  </div>
                </SoftCard>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <SectionHeader
              eyebrow="Visual system"
              title="Cleaner, darker, more premium."
              description="This UI pass standardizes the visual language: deep black surfaces, red command accents, rounded panels, glass cards, cleaner CTAs, better spacing, and stronger hierarchy."
            />

            <div className="mt-6 grid gap-4 md:grid-cols-2">
              <Metric
                label="Surface style"
                value="Glass"
                helper="Dark premium panels"
                tone="slate"
              />
              <Metric
                label="Primary accent"
                value="Red"
                helper="Command actions"
                tone="red"
              />
              <Metric
                label="Secondary accent"
                value="Purple"
                helper="AI/adaptive layer"
                tone="purple"
              />
              <Metric
                label="Trust signals"
                value="Green"
                helper="Ready/approved/live"
                tone="green"
              />
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <LinkButton href="/advisor-os" variant="danger">
                Open Advisor OS
              </LinkButton>
              <LinkButton href="/workspace" variant="primary">
                Open Workspace
              </LinkButton>
            </div>
          </Card>
        </section>
      </div>
    </SliceBackground>
  );
}