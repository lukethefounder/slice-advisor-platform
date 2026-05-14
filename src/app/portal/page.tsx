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
    href: "/workspace",
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
                Choose the right access path.
              </h1>
              <p className="mt-5 max-w-3xl text-base leading-8 text-slate-300">
                Slice is built around firm access, founder controls, and
                Advisor OS. Use the temporary logins for local testing while
                the platform is still being built.
              </p>

              <div className="mt-6 flex flex-wrap gap-3">
                <LinkButton href="/workspace" variant="primary">
                  Firm Workspace
                </LinkButton>
                <LinkButton href="/founder-login" variant="danger">
                  Founder Login
                </LinkButton>
                <LinkButton href="/advisor-os" variant="secondary">
                  Advisor OS
                </LinkButton>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Metric
                label="Access model"
                value="Firm"
                helper="Invite-controlled"
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

        <section className="grid gap-5 xl:grid-cols-2">
          {TEMP_LOGINS.map((login) => (
            <Card key={login.label} className="p-6">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Pill tone={login.label === "Founder" ? "red" : "green"}>
                    {login.label}
                  </Pill>
                  <h2 className="mt-4 text-2xl font-black">{login.label} Login</h2>
                  <p className="mt-2 text-sm leading-7 text-slate-400">
                    {login.description}
                  </p>
                </div>
                <LinkButton
                  href={login.href}
                  variant={login.label === "Founder" ? "danger" : "primary"}
                >
                  Open
                </LinkButton>
              </div>

              <div className="mt-5 grid gap-3">
                <SoftCard>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Email
                  </div>
                  <div className="mt-2 break-all text-lg font-black text-white">
                    {login.email}
                  </div>
                </SoftCard>

                <SoftCard>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Password
                  </div>
                  <div className="mt-2 break-all text-lg font-black text-white">
                    {login.password}
                  </div>
                </SoftCard>
              </div>
            </Card>
          ))}
        </section>

        <Card className="p-6">
          <SectionHeader
            eyebrow="Testing reminder"
            title="Temporary logins are for local/demo use."
            description="Keep these credentials disabled in true production unless you intentionally set ENABLE_TEMP_LOGINS=true. The long-term version should use real firm onboarding, invites, MFA, and founder-only governance."
          />
        </Card>
      </div>
    </SliceBackground>
  );
}