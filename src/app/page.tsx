import type { ReactNode } from "react";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/72 shadow-xl shadow-red-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function SoftCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "red",
}: {
  children: ReactNode;
  tone?: "red" | "green" | "amber" | "slate" | "purple";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full px-3 py-1 text-[11px] font-black ring-1",
        tones[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-zinc-950 to-red-700 shadow-lg shadow-red-950/50 ring-1 ring-red-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
      </div>

      <div className="min-w-0">
        <div className="truncate text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="truncate text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
          Advisor Intelligence Platform
        </div>
      </div>
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string;
  helper: string;
  tone?: "red" | "green" | "amber" | "slate" | "purple";
}) {
  const glows = {
    red: "from-red-500/18 to-transparent",
    green: "from-emerald-500/18 to-transparent",
    amber: "from-amber-500/18 to-transparent",
    slate: "from-slate-400/10 to-transparent",
    purple: "from-purple-500/18 to-transparent",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b",
          glows[tone]
        )}
      />
      <div className="relative">
        <div className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-3xl font-black text-white">
          {value}
        </div>
        <div className="mt-1 truncate text-xs font-semibold text-slate-500">
          {helper}
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div>
      <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
        {eyebrow}
      </div>
      <h2 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
        {title}
      </h2>
      <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
        {description}
      </p>
    </div>
  );
}

function FeatureCard({
  title,
  description,
  bullets,
  tone = "red",
}: {
  title: string;
  description: string;
  bullets: string[];
  tone?: "red" | "green" | "amber" | "purple";
}) {
  const pillTone =
    tone === "green"
      ? "green"
      : tone === "amber"
        ? "amber"
        : tone === "purple"
          ? "purple"
          : "red";

  return (
    <Card className="p-5">
      <Pill tone={pillTone}>{title}</Pill>
      <p className="mt-4 text-sm leading-7 text-slate-400">{description}</p>

      <div className="mt-5 grid gap-3">
        {bullets.map((bullet) => (
          <div
            key={bullet}
            className="rounded-2xl border border-white/10 bg-black/30 p-3 text-sm font-semibold leading-6 text-slate-300"
          >
            {bullet}
          </div>
        ))}
      </div>
    </Card>
  );
}

function MiniChart() {
  return (
    <div className="relative h-72 overflow-hidden rounded-[1.75rem] border border-white/10 bg-black/40 p-5">
      <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-red-600/20 to-transparent" />

      <div className="relative flex h-full flex-col justify-between">
        <div>
          <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
            Opportunity flow
          </div>
          <div className="mt-2 text-2xl font-black">
            Signal → Score → Action
          </div>
        </div>

        <svg viewBox="0 0 520 160" className="h-40 w-full">
          <defs>
            <linearGradient id="sliceLine" x1="0" x2="1" y1="0" y2="0">
              <stop offset="0%" stopColor="rgb(127 29 29)" />
              <stop offset="45%" stopColor="rgb(220 38 38)" />
              <stop offset="100%" stopColor="rgb(110 231 183)" />
            </linearGradient>
          </defs>

          <path
            d="M10 125 C70 120, 92 68, 140 78 C190 88, 205 24, 260 44 C315 64, 340 115, 390 72 C430 38, 472 30, 510 18"
            fill="none"
            stroke="url(#sliceLine)"
            strokeWidth="8"
            strokeLinecap="round"
          />

          <circle cx="140" cy="78" r="8" fill="rgb(248 113 113)" />
          <circle cx="260" cy="44" r="8" fill="rgb(248 113 113)" />
          <circle cx="390" cy="72" r="8" fill="rgb(252 211 77)" />
          <circle cx="510" cy="18" r="8" fill="rgb(110 231 183)" />

          <line
            x1="10"
            y1="140"
            x2="510"
            y2="140"
            stroke="rgba(255,255,255,0.12)"
            strokeWidth="2"
          />
        </svg>

        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-2xl bg-white/5 p-3">
            <div className="text-[10px] font-black uppercase text-slate-500">
              Scan
            </div>
            <div className="mt-1 text-sm font-black">Market data</div>
          </div>

          <div className="rounded-2xl bg-white/5 p-3">
            <div className="text-[10px] font-black uppercase text-slate-500">
              Rank
            </div>
            <div className="mt-1 text-sm font-black">Signal quality</div>
          </div>

          <div className="rounded-2xl bg-white/5 p-3">
            <div className="text-[10px] font-black uppercase text-slate-500">
              Act
            </div>
            <div className="mt-1 text-sm font-black">Advisor review</div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.22),_transparent_28%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] text-white">
      <div className="mx-auto max-w-[1500px] px-5 py-5">
        <header className="sticky top-4 z-40 rounded-[1.75rem] border border-white/10 bg-black/70 p-4 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <Logo />

            <nav className="flex flex-wrap items-center gap-2">
              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Firm Login
              </a>

              <a
                href="/founder-login"
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40"
              >
                Founder Login
              </a>

              <a
                href="/workspace"
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white hover:bg-white/20"
              >
                Create Firm
              </a>
            </nav>
          </div>
        </header>

        <section className="grid min-h-[calc(100vh-8rem)] items-center gap-8 py-12 xl:grid-cols-[1.1fr_0.9fr]">
          <div>
            <Pill tone="red">Built for wealth advisor firms</Pill>

            <h1 className="mt-6 max-w-5xl text-5xl font-black leading-[0.95] tracking-tight md:text-7xl xl:text-8xl">
              Get a slice of the next big opportunity.
            </h1>

            <p className="mt-7 max-w-3xl text-lg leading-8 text-slate-300">
              Slice is a firm-first intelligence platform for advisors who need
              faster signal detection, cleaner decision workflows, named
              watchlists, portfolio-aware alerts, alternative investment
              monitoring, and founder-grade governance in one beautiful
              workspace.
            </p>

            <div className="mt-8 flex flex-wrap gap-3">
              <a
                href="/workspace"
                className="rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-950 shadow-xl shadow-red-950/25"
              >
                Enter Firm Workspace
              </a>

              <a
                href="/founder-login"
                className="rounded-2xl bg-red-600 px-6 py-4 text-sm font-black text-white shadow-xl shadow-red-950/40"
              >
                Founder Access
              </a>

              <a
                href="#platform"
                className="rounded-2xl bg-white/10 px-6 py-4 text-sm font-black text-white ring-1 ring-white/10 hover:bg-white/20"
              >
                Explore Platform
              </a>
            </div>

            <div className="mt-8 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Signal Layers"
                value="8+"
                helper="News, portfolios, alerts"
                tone="red"
              />
              <Metric
                label="Watchlists"
                value="Named"
                helper="User-defined emphasis"
                tone="purple"
              />
              <Metric
                label="Access"
                value="Firm"
                helper="Invite-only teams"
                tone="green"
              />
              <Metric
                label="Governance"
                value="Founder"
                helper="Executive control"
                tone="amber"
              />
            </div>
          </div>

          <Card className="p-5">
            <MiniChart />

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              <SoftCard>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Watchlist emphasis
                </div>
                <div className="mt-2 text-xl font-black">
                  Your saved ideas matter.
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Save alerts and scans into named watchlists. Future triage
                  gives extra weight to those stocks and crypto names.
                </p>
              </SoftCard>

              <SoftCard>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
                  Portfolio awareness
                </div>
                <div className="mt-2 text-xl font-black">
                  Holdings get priority.
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Portfolio holdings receive the strongest scan relevance boost
                  so advisor attention moves toward client-impacting signals.
                </p>
              </SoftCard>
            </div>
          </Card>
        </section>

        <section id="platform" className="grid gap-5 py-8">
          <SectionTitle
            eyebrow="Platform intelligence"
            title="Designed to turn market noise into advisor action."
            description="Slice is not just another dashboard. It is a connected operating layer for firm-level execution, signal ranking, watchlist emphasis, alternative investment tracking, and executive governance."
          />

          <div className="grid gap-5 xl:grid-cols-3">
            <FeatureCard
              title="Ranked Signal Triage"
              description="Scan financial, macro, crypto, and market sources, then rank results by score, materiality, relevance, trust, and potential fruitfulness."
              tone="red"
              bullets={[
                "Configurable noise floors remove low-value scans.",
                "Portfolio holdings receive the strongest relevance boost.",
                "Named watchlist symbols receive additional emphasis.",
              ]}
            />

            <FeatureCard
              title="Named Watchlists"
              description="Advisors can create watchlists by theme, strategy, client need, or conviction level, then save alerts and scans directly into them."
              tone="purple"
              bullets={[
                "Save from alerts, scans, or manual entry.",
                "Separate stock and crypto ideas by watchlist.",
                "Watchlists influence future scoring priority.",
              ]}
            />

            <FeatureCard
              title="Firm Workspace"
              description="Slice is firm-first. Only firms sign up directly, and team members join by invite so access stays controlled."
              tone="green"
              bullets={[
                "Invite-only team member onboarding.",
                "Shared calendar, projects, tasks, and intelligence.",
                "Role-based access across firm workflows.",
              ]}
            />
          </div>

          <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
            <Card className="p-6">
              <SectionTitle
                eyebrow="Advisor workflow"
                title="From alert to decision."
                description="Slice helps advisors move from a noisy headline to a structured decision process."
              />

              <div className="mt-6 grid gap-3">
                {[
                  [
                    "1",
                    "Scan",
                    "Monitor retained sources, alerts, and triage decisions.",
                  ],
                  [
                    "2",
                    "Rank",
                    "Score signals by materiality, relevance, trust, and watchlist/portfolio overlap.",
                  ],
                  [
                    "3",
                    "Save",
                    "Push promising stock or crypto alerts into named watchlists.",
                  ],
                  [
                    "4",
                    "Act",
                    "Use briefings, comparison, portfolio lab, and firm tasks to move toward advisor review.",
                  ],
                ].map(([step, title, body]) => (
                  <div
                    key={step}
                    className="grid grid-cols-[48px_1fr] gap-4 rounded-3xl border border-white/10 bg-white/[0.055] p-4"
                  >
                    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-red-600 text-lg font-black">
                      {step}
                    </div>
                    <div>
                      <div className="text-lg font-black">{title}</div>
                      <div className="mt-1 text-sm leading-6 text-slate-400">
                        {body}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <SectionTitle
                eyebrow="Why firms should care"
                title="A premium command center for faster, cleaner judgment."
                description="Wealth advisor firms live in a world of information overload. Slice is built to help identify what matters, retain what is useful, and discard what is noise."
              />

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                {[
                  [
                    "Portfolio-aware alerts",
                    "Signals tied to actual holdings can be elevated above generic headlines.",
                  ],
                  [
                    "Advisor-ready evidence",
                    "Saved scans keep source links, scores, summaries, and risk notes.",
                  ],
                  [
                    "Alternative investment layer",
                    "Crypto, penny stocks, and venture opportunities remain separated from core portfolios.",
                  ],
                  [
                    "Founder governance",
                    "A founder portal consolidates cross-firm intelligence, recommendations, and governance actions.",
                  ],
                ].map(([title, body]) => (
                  <SoftCard key={title}>
                    <div className="text-base font-black">{title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {body}
                    </p>
                  </SoftCard>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <div className="grid gap-6 xl:grid-cols-[1fr_auto] xl:items-center">
              <div>
                <Pill tone="red">Advisor firms deserve better signal flow</Pill>
                <h2 className="mt-4 text-4xl font-black tracking-tight">
                  Start with one firm workspace. Build toward an intelligence
                  advantage.
                </h2>
                <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
                  Slice gives advisor teams a single command surface for
                  watchlists, alerts, scans, portfolios, alternatives, firm
                  planning, and founder-level governance.
                </p>
              </div>

              <div className="flex flex-wrap gap-3">
                <a
                  href="/workspace"
                  className="rounded-2xl bg-white px-6 py-4 text-sm font-black text-slate-950"
                >
                  Go to Firm Login
                </a>

                <a
                  href="/founder-login"
                  className="rounded-2xl bg-red-600 px-6 py-4 text-sm font-black text-white"
                >
                  Founder Login
                </a>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}