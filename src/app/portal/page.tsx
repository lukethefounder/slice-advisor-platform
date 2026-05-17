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

const TEMP_LOGINS = [
  {
    label: "Founder",
    email: "founder@slice.local",
    password: "SliceFounder!2026",
    description:
      "Use this to test founder-level access, governance, and executive controls.",
    href: "/founder-login",
  },
  {
    label: "Firm Advisor",
    email: "advisor@slice.local",
    password: "SliceAdvisor!2026",
    description:
      "Use this to test the firm workspace, Advisor OS, task board, client drafts, and workflow automation.",
    href: "/founder-login",
  },
];

export default function PortalPage() {
  return (
    <SliceBackground>
      <div className="mx-auto grid max-w-7xl gap-6 px-5 py-5">
        <TopNav subtitle="Portal Access" />

        <Card className="p-6 md:p-8">
          <div className="absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-red-500/15 to-transparent" />

          <div className="relative grid gap-8 xl:grid-cols-[1fr_0.9fr] xl:items-center">
            <div>
              <Pill tone="red">Slice portal</Pill>

              <h1 className="mt-5 max-w-4xl text-4xl font-black tracking-tight md:text-6xl">
                Access Slice or create an advisor workspace.
              </h1>

              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">
                Slice is built around firm access, founder controls, Advisor OS,
                autonomous research scanning, client email briefings, and
                approval-gated communication. Create a real advisor workspace
                or use demo credentials for testing.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <LinkButton href="/advisor-signup" variant="primary">
                  Create Advisor Account
                </LinkButton>
                <LinkButton href="/founder-login" variant="danger">
                  Login
                </LinkButton>
                <LinkButton href="/workspace" variant="secondary">
                  Firm Workspace
                </LinkButton>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label="Account setup"
                value="Live"
                helper="Advisor signup"
                tone="green"
              />
              <Metric
                label="Founder"
                value="Admin"
                helper="Governance layer"
                tone="red"
              />
              <Metric
                label="Advisor OS"
                value="AI"
                helper="Workflow engine"
                tone="purple"
              />
              <Metric
                label="Client delivery"
                value="Gated"
                helper="Approval first"
                tone="amber"
              />
            </div>
          </div>
        </Card>

        <section className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-6">
            <Pill tone="green">Recommended</Pill>
            <h2 className="mt-4 text-3xl font-black">
              Create a real advisor account
            </h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Use this for the actual platform experience. It creates a firm
              owner, an active firm workspace, starter watchlists, and a logged-in
              advisor session.
            </p>

            <div className="mt-5">
              <LinkButton href="/advisor-signup" variant="primary">
                Start Advisor Signup
              </LinkButton>
            </div>
          </Card>

          <Card className="p-6">
            <Pill tone="amber">Demo access</Pill>
            <h2 className="mt-4 text-3xl font-black">Temporary logins</h2>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Demo logins require ENABLE_TEMP_LOGINS=true in Vercel production
              environment variables. They are useful for testing but should not
              replace real advisor account creation.
            </p>

            <div className="mt-5 grid gap-3">
              {TEMP_LOGINS.map((login) => (
                <SoftCard key={login.label}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <Pill tone={login.label === "Founder" ? "red" : "green"}>
                        {login.label}
                      </Pill>
                      <p className="mt-3 text-sm leading-6 text-slate-400">
                        {login.description}
                      </p>
                    </div>
                    <LinkButton
                      href={login.href}
                      variant={login.label === "Founder" ? "danger" : "primary"}
                    >
                      Login
                    </LinkButton>
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Email
                      </div>
                      <div className="mt-2 break-all text-sm font-black text-white">
                        {login.email}
                      </div>
                    </div>

                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Password
                      </div>
                      <div className="mt-2 break-all text-sm font-black text-white">
                        {login.password}
                      </div>
                    </div>
                  </div>
                </SoftCard>
              ))}
            </div>
          </Card>
        </section>

        <Card className="p-6">
          <SectionHeader
            eyebrow="Production reminder"
            title="Real advisor accounts should be created through advisor signup."
            description="Temporary logins are useful for testing only. For a real platform workflow, create a firm owner account, use a durable production database, and keep client communications approval-gated."
          />
        </Card>
      </div>
    </SliceBackground>
  );
}