"use client";

import { FormEvent, ReactNode, useEffect, useMemo, useState } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";
type View = "overview" | "health" | "approvals" | "quality" | "tools" | "jobs" | "tenant" | "events";

type Payload = {
  message?: string;
  readinessScore: number;
  metrics: {
    healthAverage: number;
    pendingApprovals: number;
    poorDataQuality: number;
    enabledTools: number;
    plannedJobs: number;
    events: number;
    rolePolicies: number;
    notificationRules: number;
    jobs: number;
    tenantChecks: number;
    seedRuns: number;
    clientCount: number;
    alertCount: number;
    watchlistCount: number;
    taskCount: number;
    botCommandCount: number;
    firmProjectCount: number;
  };
  healthChecks: Array<{
    id: string;
    label: string;
    category: string;
    status: string;
    score: number;
    lastCheckedAt: string;
    details: Record<string, unknown>;
  }>;
  events: Array<{
    id: string;
    eventType: string;
    area: string;
    title: string;
    detail: string | null;
    severity: string;
    status: string;
    createdAt: string;
  }>;
  rolePolicies: Array<{
    id: string;
    roleName: string;
    roleKey: string;
    description: string;
    permissions: string[];
    status: string;
  }>;
  approvals: Array<{
    id: string;
    title: string;
    actionType: string;
    riskLevel: string;
    summary: string;
    status: string;
    createdAt: string;
  }>;
  notificationRules: Array<{
    id: string;
    ruleName: string;
    scopeType: string;
    channel: string;
    minScore: number;
    minUrgency: string;
    digestOnly: boolean;
    approvalRequired: boolean;
    status: string;
  }>;
  dataQuality: Array<{
    id: string;
    entityType: string;
    entityId: string;
    sourceName: string;
    liveStatus: string;
    freshnessStatus: string;
    qualityScore: number;
    fallbackUsed: boolean;
    warning: string | null;
    warnings: string[];
  }>;
  aiTools: Array<{
    id: string;
    toolName: string;
    toolKey: string;
    category: string;
    description: string;
    approvalRequired: boolean;
    enabled: boolean;
    successCount: number;
    failureCount: number;
    inputSchema: Record<string, unknown>;
    outputSchema: Record<string, unknown>;
  }>;
  jobs: Array<{
    id: string;
    jobName: string;
    jobKey: string;
    category: string;
    description: string;
    scheduleLabel: string;
    cadence: string;
    status: string;
  }>;
  tenantChecks: Array<{
    id: string;
    checkName: string;
    status: string;
    detail: string;
    lastCheckedAt: string;
  }>;
  seedRuns: Array<{
    id: string;
    summary: string;
    status: string;
    counts: Record<string, unknown>;
    createdAt: string;
  }>;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toneFor(value: string | number | boolean | null | undefined): Tone {
  const text = String(value ?? "").toLowerCase();

  if (
    text.includes("broken") ||
    text.includes("missing") ||
    text.includes("failed") ||
    text.includes("rejected") ||
    text.includes("critical") ||
    text.includes("poor") ||
    text.includes("fallback")
  ) {
    return "red";
  }

  if (
    text.includes("healthy") ||
    text.includes("configured") ||
    text.includes("passed") ||
    text.includes("approved") ||
    text.includes("active") ||
    text.includes("complete") ||
    text.includes("enabled")
  ) {
    return "green";
  }

  if (
    text.includes("pending") ||
    text.includes("planned") ||
    text.includes("needs") ||
    text.includes("warning") ||
    text.includes("manual")
  ) {
    return "amber";
  }

  if (text.includes("ai") || text.includes("tool") || text.includes("job")) return "purple";
  if (text.includes("vendor") || text.includes("health") || text.includes("data")) return "cyan";

  return "slate";
}

function scoreTone(score: number): Tone {
  if (score >= 85) return "green";
  if (score >= 68) return "cyan";
  if (score >= 45) return "amber";
  return "red";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const minutes = Math.round((Date.now() - date.getTime()) / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    red: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span className={cx("inline-flex max-w-full rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1", tones[tone])}>
      <span className="truncate">{children}</span>
    </span>
  );
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div className={cx("relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/78 shadow-xl shadow-emerald-950/20 backdrop-blur-xl", className)}>
      {children}
    </div>
  );
}

function Panel({
  children,
  className = "",
  tone = "slate",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  const glows: Record<Tone, string> = {
    red: "from-emerald-500/16",
    green: "from-emerald-500/16",
    amber: "from-amber-500/16",
    purple: "from-purple-500/16",
    cyan: "from-cyan-500/16",
    slate: "from-slate-400/8",
  };

  return (
    <div className={cx("relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.052] p-4 shadow-lg shadow-black/10", className)}>
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">{children}</div>
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
  value: string | number;
  helper?: string;
  tone?: Tone;
}) {
  const glows: Record<Tone, string> = {
    red: "from-emerald-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    cyan: "from-cyan-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative min-h-[112px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function ProgressBar({ value, tone = "cyan" }: { value: number; tone?: Tone }) {
  const fills: Record<Tone, string> = {
    red: "from-emerald-700 to-emerald-400",
    green: "from-emerald-700 to-emerald-300",
    amber: "from-amber-700 to-amber-300",
    purple: "from-purple-700 to-purple-300",
    slate: "from-slate-700 to-slate-300",
    cyan: "from-cyan-700 to-cyan-300",
  };

  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-black/50">
      <div
        className={cx("h-full rounded-full bg-gradient-to-r", fills[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-emerald-950 via-zinc-950 to-emerald-700 shadow-lg shadow-emerald-950/50 ring-1 ring-emerald-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-emerald-500 to-emerald-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-emerald-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-emerald-700" />
      </div>

      <div>
        <div className="text-2xl font-black tracking-tight text-white">Slice</div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400">
          Backend Readiness
        </div>
      </div>
    </div>
  );
}

function SectionHeader({ eyebrow, title, description }: { eyebrow: string; title: string; description: string }) {
  return (
    <div className="mb-5">
      <div className="text-xs font-black uppercase tracking-[0.2em] text-emerald-400">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

export default function BackendReadinessPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState("");
  const [activeView, setActiveView] = useState<View>("overview");
  const [approvalForm, setApprovalForm] = useState({
    title: "",
    actionType: "Manual Review",
    riskLevel: "Medium",
    summary: "",
  });

  const pendingApprovals = useMemo(() => data?.approvals.filter((item) => item.status === "Pending") ?? [], [data]);
  const weakHealth = useMemo(() => data?.healthChecks.filter((item) => item.score < 70) ?? [], [data]);
  const weakQuality = useMemo(() => data?.dataQuality.filter((item) => item.qualityScore < 70 || item.fallbackUsed) ?? [], [data]);
  const enabledTools = useMemo(() => data?.aiTools.filter((tool) => tool.enabled) ?? [], [data]);
  const approvalTools = useMemo(() => data?.aiTools.filter((tool) => tool.approvalRequired) ?? [], [data]);

  async function load() {
    const response = await fetch("/api/backend-readiness", {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Could not load backend readiness.");
      return;
    }

    setData(payload);
  }

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    setWorking(action);
    setMessage("");

    try {
      const response = await fetch("/api/backend-readiness", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": action,
        },
        body: JSON.stringify({
          action,
          ...extra,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Action failed.");
        return;
      }

      setData(payload);
      setMessage(payload.message ?? "Backend readiness updated.");
    } finally {
      setWorking("");
    }
  }

  async function createApproval(event: FormEvent) {
    event.preventDefault();

    if (!approvalForm.title.trim()) {
      setMessage("Approval title is required.");
      return;
    }

    await runAction("createApproval", approvalForm);

    setApprovalForm({
      title: "",
      actionType: "Manual Review",
      riskLevel: "Medium",
      summary: "",
    });
  }

  useEffect(() => {
    void load();
  }, []);

  if (!data) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <Card className="mx-auto mt-20 max-w-3xl p-8 text-center">
          <Logo />
          <h1 className="mt-6 text-3xl font-black">Loading backend readiness...</h1>
          {message ? <p className="mt-3 text-sm text-emerald-200">{message}</p> : null}
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(88,28,135,0.24),_transparent_30%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1900px] gap-5">
        <header className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-zinc-950/78 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.25),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(6,182,212,0.14),transparent_26%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <Logo />

              <div className="mt-5 flex flex-wrap gap-2">
                <Pill tone="red">Security Foundation</Pill>
                <Pill tone="cyan">Health Checks</Pill>
                <Pill tone="purple">AI Tool Contracts</Pill>
                <Pill tone="green">Tenant Isolation</Pill>
              </div>

              <h1 className="mt-5 max-w-6xl text-4xl font-black tracking-tight md:text-6xl">
                Backend readiness before live automation.
              </h1>

              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
                Review system health, role policies, approvals, notification rules, data quality, AI tools,
                background jobs, tenant isolation, and seed data before connecting live services or enabling automated advisor workflows.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <a href="/workspace?tab=security" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20">
                ← Workspace
              </a>
              <a href="/security" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100">
                Security Center
              </a>
              <a href="/advisor-command-center" className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-black text-purple-100">
                AI Command
              </a>
              <button
                onClick={() => runAction("bootstrap")}
                disabled={working === "bootstrap"}
                className="rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/40 disabled:opacity-50"
              >
                {working === "bootstrap" ? "Bootstrapping..." : "Bootstrap Foundation"}
              </button>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <Metric label="Readiness" value={`${data.readinessScore}%`} helper="Backend score" tone={scoreTone(data.readinessScore)} />
            <Metric label="Health" value={`${data.metrics.healthAverage}%`} helper="System average" tone={scoreTone(data.metrics.healthAverage)} />
            <Metric label="Approvals" value={data.metrics.pendingApprovals} helper="Pending items" tone={data.metrics.pendingApprovals ? "red" : "green"} />
            <Metric label="Data Issues" value={data.metrics.poorDataQuality} helper="Quality records" tone={data.metrics.poorDataQuality ? "red" : "green"} />
            <Metric label="AI Tools" value={data.metrics.enabledTools} helper={`${approvalTools.length} gated`} tone="purple" />
            <Metric label="Jobs" value={data.metrics.jobs} helper={`${data.metrics.plannedJobs} planned`} tone="amber" />
            <Metric label="Tenant Checks" value={data.metrics.tenantChecks} helper="Access isolation" tone={data.metrics.tenantChecks ? "green" : "amber"} />
            <Metric label="Events" value={data.metrics.events} helper="Backend log" tone="cyan" />
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
            {message}
          </div>
        ) : null}

        <Card className="p-3">
          <div className="grid gap-2 md:grid-cols-4 xl:grid-cols-8">
            {[
              ["overview", "Overview", "Readiness", "red"],
              ["health", "Health", "Checks", "cyan"],
              ["approvals", "Approvals", "Gates", "amber"],
              ["quality", "Data Quality", "Vendors", "green"],
              ["tools", "AI Tools", "Contracts", "purple"],
              ["jobs", "Jobs", "Automation", "cyan"],
              ["tenant", "Tenant", "Isolation", "green"],
              ["events", "Events", "Log", "slate"],
            ].map(([key, label, helper, tone]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveView(key as View)}
                className={cx(
                  "rounded-2xl px-4 py-3 text-left transition",
                  activeView === key
                    ? "bg-white text-slate-950 shadow-lg shadow-black/20"
                    : "border border-white/10 bg-white/[0.045] text-white hover:bg-white/10"
                )}
              >
                <div className="text-sm font-black">{label}</div>
                <div className={cx("mt-1 text-[10px] font-bold", activeView === key ? "text-slate-500" : "text-slate-500")}>{helper}</div>
              </button>
            ))}
          </div>
        </Card>

        {activeView === "overview" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card className="p-6">
              <SectionHeader
                eyebrow="Readiness Model"
                title="What must be true before automation goes live"
                description="The backend readiness score blends health checks, role policies, notification rules, AI tools, jobs, pending approvals, and data-quality gaps."
              />

              <ProgressBar value={data.readinessScore} tone={scoreTone(data.readinessScore)} />

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["System health", data.metrics.healthAverage, "Core health check average."],
                  ["Role policies", data.metrics.rolePolicies ? 100 : 0, "Permission model exists."],
                  ["Notification rules", data.metrics.notificationRules ? 100 : 0, "Delivery rules exist."],
                  ["AI tools", data.metrics.enabledTools ? 100 : 0, "Registered AI tool contracts."],
                  ["Background jobs", data.metrics.jobs ? 100 : 0, "Scheduled automation plan exists."],
                  ["Data quality", data.metrics.poorDataQuality ? 45 : 100, "Provider readiness and fallback state."],
                ].map(([label, score, helper]) => (
                  <Panel key={String(label)} tone={scoreTone(Number(score))} className="bg-black/35">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-white">{label}</div>
                        <p className="mt-1 text-xs leading-5 text-slate-400">{helper}</p>
                      </div>
                      <Pill tone={scoreTone(Number(score))}>{score}%</Pill>
                    </div>
                    <div className="mt-3">
                      <ProgressBar value={Number(score)} tone={scoreTone(Number(score))} />
                    </div>
                  </Panel>
                ))}
              </div>
            </Card>

            <div className="grid gap-5">
              <Card className="p-5">
                <SectionHeader
                  eyebrow="Runbook"
                  title="One-click readiness actions"
                  description="Use these in order before live delivery, AI tool execution, or autonomous scanning."
                />

                <div className="grid gap-3">
                  {[
                    ["bootstrap", "Bootstrap Foundation", "Create/update policies, tools, jobs, notification rules, data quality, and first approval."],
                    ["runHealthChecks", "Run Health Checks", "Update database, provider, AI, email, SMS, and job strategy checks."],
                    ["runTenantChecks", "Run Tenant Checks", "Verify user and firm-scoped access boundaries."],
                    ["seedDemoData", "Seed Demo Data", "Create safe sample records for readiness testing."],
                  ].map(([action, label, helper]) => (
                    <button
                      key={action}
                      type="button"
                      disabled={working === action}
                      onClick={() => runAction(action)}
                      className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-left transition hover:bg-white/[0.09] disabled:opacity-50"
                    >
                      <div className="text-sm font-black text-white">{working === action ? "Working..." : label}</div>
                      <div className="mt-2 text-xs leading-5 text-slate-500">{helper}</div>
                    </button>
                  ))}
                </div>
              </Card>

              <Card className="p-5">
                <SectionHeader
                  eyebrow="Risk items"
                  title="Needs attention"
                  description="Weak health, pending approvals, and weak data-quality records."
                />

                <div className="grid gap-3">
                  <Metric label="Weak Health" value={weakHealth.length} tone={weakHealth.length ? "red" : "green"} />
                  <Metric label="Pending Approvals" value={pendingApprovals.length} tone={pendingApprovals.length ? "amber" : "green"} />
                  <Metric label="Weak Data Quality" value={weakQuality.length} tone={weakQuality.length ? "red" : "green"} />
                </div>
              </Card>
            </div>
          </section>
        ) : null}

        {activeView === "health" ? (
          <section className="grid gap-5">
            <Card className="p-6">
              <SectionHeader
                eyebrow="System health"
                title="Provider and platform health checks"
                description="Core backend checks for database, schema readiness, market data, email, SMS, AI, and background job strategy."
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.healthChecks.map((check) => (
                  <Panel key={check.id} tone={toneFor(check.status)} className="bg-black/35">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={toneFor(check.status)}>{check.status}</Pill>
                          <Pill tone="slate">{check.category}</Pill>
                        </div>
                        <h3 className="mt-3 text-lg font-black text-white">{check.label}</h3>
                        <p className="mt-1 text-xs text-slate-500">{relativeTime(check.lastCheckedAt)}</p>
                      </div>
                      <div className="rounded-2xl bg-black/35 px-3 py-2 text-center">
                        <div className="text-[10px] font-black uppercase text-slate-500">Score</div>
                        <div className="text-xl font-black text-white">{check.score}</div>
                      </div>
                    </div>
                    <div className="mt-4">
                      <ProgressBar value={check.score} tone={scoreTone(check.score)} />
                    </div>
                    <pre className="mt-4 max-h-[180px] overflow-y-auto whitespace-pre-wrap rounded-2xl border border-white/10 bg-black/35 p-3 text-xs leading-5 text-slate-400">
                      {JSON.stringify(check.details, null, 2)}
                    </pre>
                  </Panel>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "approvals" ? (
          <section className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)]">
            <Card className="p-5">
              <SectionHeader
                eyebrow="Approval center"
                title="Manual gates for sensitive backend actions"
                description="Create, approve, or reject readiness items before live automation or risky workflows."
              />

              <form onSubmit={createApproval} className="grid gap-3">
                <input
                  value={approvalForm.title}
                  onChange={(event) => setApprovalForm((current) => ({ ...current, title: event.target.value }))}
                  placeholder="Approval title"
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2"
                />

                <div className="grid gap-3 md:grid-cols-2">
                  <select
                    value={approvalForm.actionType}
                    onChange={(event) => setApprovalForm((current) => ({ ...current, actionType: event.target.value }))}
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 focus:ring-2"
                  >
                    <option>Manual Review</option>
                    <option>Backend Readiness</option>
                    <option>Live Delivery</option>
                    <option>AI Tool Execution</option>
                    <option>Vendor Integration</option>
                    <option>Security Change</option>
                  </select>

                  <select
                    value={approvalForm.riskLevel}
                    onChange={(event) => setApprovalForm((current) => ({ ...current, riskLevel: event.target.value }))}
                    className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 focus:ring-2"
                  >
                    <option>Low</option>
                    <option>Medium</option>
                    <option>High</option>
                    <option>Critical</option>
                  </select>
                </div>

                <textarea
                  value={approvalForm.summary}
                  onChange={(event) => setApprovalForm((current) => ({ ...current, summary: event.target.value }))}
                  placeholder="Approval summary"
                  className="min-h-[120px] rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none ring-emerald-500 placeholder:text-slate-600 focus:ring-2"
                />

                <button
                  disabled={working === "createApproval"}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                >
                  Create Approval Gate
                </button>
              </form>
            </Card>

            <Card className="p-5">
              <div className="grid gap-4">
                {data.approvals.map((approval) => (
                  <Panel key={approval.id} tone={toneFor(approval.status)} className="bg-black/35">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={toneFor(approval.status)}>{approval.status}</Pill>
                          <Pill tone={toneFor(approval.riskLevel)}>{approval.riskLevel}</Pill>
                          <Pill tone="cyan">{approval.actionType}</Pill>
                        </div>
                        <h3 className="mt-3 text-xl font-black text-white">{approval.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{approval.summary}</p>
                        <div className="mt-2 text-xs text-slate-600">{formatDateTime(approval.createdAt)}</div>
                      </div>

                      {approval.status === "Pending" ? (
                        <div className="grid min-w-[170px] gap-2">
                          <button
                            onClick={() =>
                              runAction("approveItem", {
                                approvalId: approval.id,
                                approvalNotes: "Approved from backend readiness console.",
                              })
                            }
                            className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                          >
                            Approve
                          </button>
                          <button
                            onClick={() =>
                              runAction("rejectItem", {
                                approvalId: approval.id,
                                approvalNotes: "Rejected from backend readiness console.",
                              })
                            }
                            className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100"
                          >
                            Reject
                          </button>
                        </div>
                      ) : null}
                    </div>
                  </Panel>
                ))}

                {!data.approvals.length ? (
                  <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
                    No approval items yet.
                  </div>
                ) : null}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "quality" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card className="p-6">
              <SectionHeader
                eyebrow="Data quality"
                title="Provider readiness and fallback awareness"
                description="Data quality records show whether important providers are configured or if the platform is using fallback/simulated behavior."
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.dataQuality.map((record) => (
                  <Panel key={record.id} tone={scoreTone(record.qualityScore)} className="bg-black/35">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={toneFor(record.liveStatus)}>{record.liveStatus}</Pill>
                          <Pill tone={toneFor(record.freshnessStatus)}>{record.freshnessStatus}</Pill>
                          {record.fallbackUsed ? <Pill tone="red">Fallback</Pill> : null}
                        </div>
                        <h3 className="mt-3 text-lg font-black text-white">{record.sourceName}</h3>
                        <p className="mt-1 text-xs text-slate-500">{record.entityType} · {record.entityId}</p>
                      </div>
                      <div className="text-2xl font-black text-white">{record.qualityScore}</div>
                    </div>

                    <div className="mt-4">
                      <ProgressBar value={record.qualityScore} tone={scoreTone(record.qualityScore)} />
                    </div>

                    {record.warning ? (
                      <p className="mt-4 text-sm leading-6 text-slate-400">{record.warning}</p>
                    ) : null}
                  </Panel>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <SectionHeader
                eyebrow="Quality checklist"
                title="Before live automation"
                description="Provider keys and data-quality readiness should be verified before automatic alerts or client delivery."
              />

              <div className="grid gap-3">
                {[
                  "Configure market data provider before live watchlist-price alerts.",
                  "Configure email provider before switching client delivery out of simulation.",
                  "Configure AI provider before relying on AI-generated advisor output.",
                  "Keep fallback behavior visible so demos do not overstate live capability.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-sm leading-6 text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "tools" ? (
          <section className="grid gap-5">
            <Card className="p-6">
              <SectionHeader
                eyebrow="AI tool contracts"
                title="Controlled AI execution surface"
                description="Every AI tool should have a schema, approval rule, category, and success/failure trail before autonomous execution."
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.aiTools.map((tool) => (
                  <Panel key={tool.id} tone={tool.enabled ? "purple" : "slate"} className="bg-black/35">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={tool.enabled ? "green" : "slate"}>{tool.enabled ? "Enabled" : "Disabled"}</Pill>
                          <Pill tone={tool.approvalRequired ? "amber" : "green"}>{tool.approvalRequired ? "Approval" : "Direct"}</Pill>
                        </div>
                        <h3 className="mt-3 text-lg font-black text-white">{tool.toolName}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{tool.description}</p>
                      </div>
                    </div>

                    <div className="mt-4 grid grid-cols-2 gap-2">
                      <Metric label="Success" value={tool.successCount} tone="green" />
                      <Metric label="Failure" value={tool.failureCount} tone={tool.failureCount ? "red" : "slate"} />
                    </div>

                    <details className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-3">
                      <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                        Schemas
                      </summary>
                      <pre className="mt-3 max-h-[250px] overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-slate-400">
                        {JSON.stringify({ input: tool.inputSchema, output: tool.outputSchema }, null, 2)}
                      </pre>
                    </details>
                  </Panel>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "jobs" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_430px]">
            <Card className="p-6">
              <SectionHeader
                eyebrow="Background jobs"
                title="Automation schedule and operating plan"
                description="Planned jobs describe the backbone for market scans, news scans, watchlist checks, digests, vendor health, and compliance retention."
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.jobs.map((job) => (
                  <Panel key={job.id} tone={toneFor(job.status)} className="bg-black/35">
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={toneFor(job.status)}>{job.status}</Pill>
                      <Pill tone="purple">{job.category}</Pill>
                      <Pill tone="cyan">{job.cadence}</Pill>
                    </div>

                    <h3 className="mt-3 text-lg font-black text-white">{job.jobName}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{job.description}</p>

                    <div className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-3">
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Schedule</div>
                      <div className="mt-1 text-sm font-black text-white">{job.scheduleLabel}</div>
                    </div>
                  </Panel>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <SectionHeader
                eyebrow="Automation readiness"
                title="Safe launch order"
                description="Live automation should be phased so delivery, AI execution, and background scanning are not enabled before vendor readiness."
              />

              <div className="grid gap-3">
                {[
                  "1. Bootstrap foundation records.",
                  "2. Run health checks.",
                  "3. Resolve missing providers.",
                  "4. Run tenant checks.",
                  "5. Confirm approval gates.",
                  "6. Enable live delivery only after email provider is configured.",
                  "7. Enable autonomous scanning only after source thresholds are reviewed.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-sm leading-6 text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "tenant" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card className="p-6">
              <SectionHeader
                eyebrow="Tenant isolation"
                title="User and firm access boundary checks"
                description="Tenant checks make sure user-scoped and firm-scoped records are not assumed available without membership and permission context."
              />

              <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {data.tenantChecks.map((check) => (
                  <Panel key={check.id} tone={toneFor(check.status)} className="bg-black/35">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <Pill tone={toneFor(check.status)}>{check.status}</Pill>
                        <h3 className="mt-3 text-lg font-black text-white">{check.checkName}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{check.detail}</p>
                      </div>
                    </div>
                    <div className="mt-3 text-xs text-slate-500">{relativeTime(check.lastCheckedAt)}</div>
                  </Panel>
                ))}

                {!data.tenantChecks.length ? (
                  <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
                    No tenant checks yet. Run tenant checks from the overview runbook.
                  </div>
                ) : null}
              </div>
            </Card>

            <Card className="p-6">
              <SectionHeader
                eyebrow="Tenant checklist"
                title="Firm safety standard"
                description="This is critical before adding multi-advisor firm accounts."
              />

              <div className="grid gap-3">
                {[
                  "Every firm-scoped record must include a firm ID.",
                  "Every firm action must check active membership.",
                  "Owner/admin-only actions must check permission flags.",
                  "Client portfolio data should remain private to authorized users.",
                  "Approvals and audit logs should be user- and firm-scoped.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-sm leading-6 text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "events" ? (
          <section className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
            <Card className="p-5">
              <SectionHeader
                eyebrow="Backend events"
                title="Readiness event log"
                description="A compact timeline of foundation changes, checks, approval actions, and seed activity."
              />

              <div className="grid gap-3">
                <Metric label="Events" value={data.events.length} tone="cyan" />
                <Metric label="Seed Runs" value={data.seedRuns.length} tone="purple" />
                <Metric label="Clients" value={data.metrics.clientCount} tone="green" />
                <Metric label="Alerts" value={data.metrics.alertCount} tone="red" />
              </div>
            </Card>

            <Card className="p-5">
              <div className="grid max-h-[980px] gap-4 overflow-y-auto pr-2">
                {data.events.map((event) => (
                  <Panel key={event.id} tone={toneFor(event.severity)} className="bg-black/35">
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={toneFor(event.severity)}>{event.severity}</Pill>
                      <Pill tone="purple">{event.area}</Pill>
                      <Pill tone={toneFor(event.status)}>{event.status}</Pill>
                      <Pill tone="slate">{relativeTime(event.createdAt)}</Pill>
                    </div>
                    <h3 className="mt-3 text-lg font-black text-white">{event.title}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{event.detail || "No detail recorded."}</p>
                    <div className="mt-2 text-xs font-bold text-slate-600">{event.eventType}</div>
                  </Panel>
                ))}

                {!data.events.length ? (
                  <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
                    No backend events yet.
                  </div>
                ) : null}
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}