"use client";

import { FormEvent, useEffect, useState } from "react";

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

function toneFor(value: string | number): "red" | "green" | "amber" | "purple" | "slate" {
  const text = String(value).toLowerCase();

  if (text.includes("broken") || text.includes("missing") || text.includes("failed") || text.includes("rejected") || text.includes("critical")) {
    return "red";
  }

  if (text.includes("healthy") || text.includes("configured") || text.includes("passed") || text.includes("approved") || text.includes("active") || text.includes("complete")) {
    return "green";
  }

  if (text.includes("pending") || text.includes("planned") || text.includes("needs") || text.includes("warning")) {
    return "amber";
  }

  if (text.includes("ai") || text.includes("tool") || text.includes("job")) {
    return "purple";
  }

  return "slate";
}

function Pill({
  children,
  tone = "slate",
}: {
  children: React.ReactNode;
  tone?: "red" | "green" | "amber" | "purple" | "slate";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span className={cx("inline-flex rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1", tones[tone])}>
      {children}
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-xl shadow-red-950/20", className)}>
      {children}
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
  tone?: "red" | "green" | "amber" | "purple" | "slate";
}) {
  const glows = {
    red: "from-red-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className="mt-2 text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function SectionHeader({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description: string;
}) {
  return (
    <div className="mb-5">
      <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">{eyebrow}</div>
      <h2 className="mt-2 text-2xl font-black text-white">{title}</h2>
      <p className="mt-2 text-sm leading-6 text-slate-400">{description}</p>
    </div>
  );
}

export default function BackendReadinessPage() {
  const [data, setData] = useState<Payload | null>(null);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState("");
  const [approvalForm, setApprovalForm] = useState({
    title: "",
    actionType: "Manual Review",
    riskLevel: "Medium",
    summary: "",
  });

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
      <main className="min-h-screen bg-[#050505] p-6 text-white">
        <Card className="mx-auto mt-20 max-w-3xl text-center">
          <Pill tone="red">Slice</Pill>
          <h1 className="mt-4 text-3xl font-black">Loading backend readiness...</h1>
          {message ? <p className="mt-3 text-sm text-red-200">{message}</p> : null}
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(88,28,135,0.24),_transparent_30%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1600px] gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
                Slice Backend Readiness
              </div>
              <h1 className="mt-2 text-4xl font-black md:text-6xl">
                Backend foundation before live automation.
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
                This page prepares Slice for the real backend: health checks,
                permissions, event logs, approvals, notification rules, data
                quality, AI tool contracts, background jobs, tenant isolation,
                and demo seed data.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href="/workspace" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">
                Workspace
              </a>
              <a href="/advisor-command-center" className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100">
                AI Command
              </a>
              <a href="/market-visuals" className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100">
                Market Visuals
              </a>
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Metric label="Readiness" value={`${data.readinessScore}%`} helper="Backend score" tone={data.readinessScore >= 80 ? "green" : data.readinessScore >= 55 ? "amber" : "red"} />
          <Metric label="Health" value={`${data.metrics.healthAverage}%`} helper="System average" tone={data.metrics.healthAverage >= 80 ? "green" : "amber"} />
          <Metric label="Approvals" value={data.metrics.pendingApprovals} helper="Pending items" tone={data.metrics.pendingApprovals ? "red" : "green"} />
          <Metric label="AI Tools" value={data.metrics.enabledTools} helper="Registered tools" tone="purple" />
          <Metric label="Jobs" value={data.metrics.jobs} helper="Planned jobs" tone="amber" />
          <Metric label="Quality Issues" value={data.metrics.poorDataQuality} helper="Score under 60" tone={data.metrics.poorDataQuality ? "red" : "green"} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <button
            onClick={() => runAction("bootstrap")}
            disabled={working === "bootstrap"}
            className="rounded-[1.5rem] bg-white p-5 text-left text-slate-950 shadow-xl shadow-red-950/20 transition hover:scale-[1.01] disabled:opacity-50"
          >
            <div className="text-xs font-black uppercase tracking-[0.16em] text-red-700">Foundation</div>
            <div className="mt-2 text-2xl font-black">Bootstrap</div>
            <div className="mt-2 text-sm font-semibold text-slate-600">Create policies, tools, jobs, notification rules, quality records, and health checks.</div>
          </button>

          <button
            onClick={() => runAction("runHealthChecks")}
            disabled={working === "runHealthChecks"}
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 text-left transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">System</div>
            <div className="mt-2 text-2xl font-black">Run Health</div>
            <div className="mt-2 text-sm font-semibold text-slate-500">Refresh database, provider, AI, email, SMS, and job-readiness checks.</div>
          </button>

          <button
            onClick={() => runAction("runTenantChecks")}
            disabled={working === "runTenantChecks"}
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 text-left transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            <div className="text-xs font-black uppercase tracking-[0.16em] text-purple-300">Tenant Safety</div>
            <div className="mt-2 text-2xl font-black">Check Isolation</div>
            <div className="mt-2 text-sm font-semibold text-slate-500">Validate user, firm, membership, and permission-scoping assumptions.</div>
          </button>

          <button
            onClick={() => runAction("seedDemoData")}
            disabled={working === "seedDemoData"}
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 text-left transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Demo System</div>
            <div className="mt-2 text-2xl font-black">Seed Demo</div>
            <div className="mt-2 text-sm font-semibold text-slate-500">Create demo clients, holdings, alerts, watchlists, and tasks for testing.</div>
          </button>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.95fr_1.05fr]">
          <Card>
            <SectionHeader
              eyebrow="System Health"
              title="Provider and infrastructure checks"
              description="See what is ready, missing, or planned before connecting live backend services."
            />

            <div className="grid gap-3">
              {data.healthChecks.map((check) => (
                <div key={check.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{check.label}</div>
                      <div className="mt-1 text-xs text-slate-500">{check.category} · Score {check.score}</div>
                    </div>
                    <Pill tone={toneFor(check.status)}>{check.status}</Pill>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader
              eyebrow="Activity Timeline"
              title="Event bus"
              description="Every backend-relevant action should eventually write to this activity/event layer."
            />

            <div className="grid max-h-[560px] gap-3 overflow-y-auto pr-1">
              {data.events.map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{event.title}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {event.area} · {event.eventType} · {new Date(event.createdAt).toLocaleString()}
                      </div>
                    </div>
                    <Pill tone={toneFor(event.severity)}>{event.severity}</Pill>
                  </div>
                  {event.detail ? <p className="mt-2 text-sm leading-6 text-slate-400">{event.detail}</p> : null}
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card>
            <SectionHeader
              eyebrow="Role Matrix"
              title="Permissions and access design"
              description="These policies define who can view, create, approve, send, export, manage, and override."
            />

            <div className="grid gap-3">
              {data.rolePolicies.map((policy) => (
                <div key={policy.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{policy.roleName}</div>
                      <div className="mt-1 text-xs text-slate-500">{policy.roleKey}</div>
                    </div>
                    <Pill tone={toneFor(policy.status)}>{policy.status}</Pill>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{policy.description}</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {policy.permissions.slice(0, 10).map((permission) => (
                      <Pill key={`${policy.id}-${permission}`} tone="slate">{permission}</Pill>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader
              eyebrow="Approval Center"
              title="Human-gated actions"
              description="Client-facing communication, reports, high-risk bot actions, and sensitive automations should flow through approvals."
            />

            <form onSubmit={createApproval} className="mb-5 grid gap-3">
              <input
                value={approvalForm.title}
                onChange={(event) => setApprovalForm((current) => ({ ...current, title: event.target.value }))}
                className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                placeholder="Approval title"
              />

              <div className="grid gap-3 sm:grid-cols-2">
                <input
                  value={approvalForm.actionType}
                  onChange={(event) => setApprovalForm((current) => ({ ...current, actionType: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                  placeholder="Action type"
                />

                <select
                  value={approvalForm.riskLevel}
                  onChange={(event) => setApprovalForm((current) => ({ ...current, riskLevel: event.target.value }))}
                  className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 focus:ring-2"
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
                className="min-h-24 resize-none rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                placeholder="Summary"
              />

              <button
                disabled={working === "createApproval"}
                className="rounded-2xl bg-red-600 px-5 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
              >
                Create Approval Item
              </button>
            </form>

            <div className="grid max-h-[520px] gap-3 overflow-y-auto pr-1">
              {data.approvals.map((approval) => (
                <div key={approval.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{approval.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{approval.actionType} · {approval.riskLevel}</div>
                    </div>
                    <Pill tone={toneFor(approval.status)}>{approval.status}</Pill>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{approval.summary}</p>

                  {approval.status === "Pending" ? (
                    <div className="mt-3 flex flex-wrap gap-2">
                      <button
                        onClick={() => runAction("approveItem", { approvalId: approval.id })}
                        className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                      >
                        Approve
                      </button>
                      <button
                        onClick={() => runAction("rejectItem", { approvalId: approval.id })}
                        className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100"
                      >
                        Reject
                      </button>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Card>
            <SectionHeader
              eyebrow="Notifications"
              title="Preference rules"
              description="Rules for alert fatigue, quiet hours, score thresholds, approval gates, and delivery channels."
            />

            <div className="grid gap-3">
              {data.notificationRules.map((rule) => (
                <div key={rule.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="font-black text-white">{rule.ruleName}</div>
                  <div className="mt-1 text-xs text-slate-500">
                    {rule.scopeType} · {rule.channel} · Score {rule.minScore}+
                  </div>
                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill tone={toneFor(rule.status)}>{rule.status}</Pill>
                    <Pill tone={rule.approvalRequired ? "amber" : "green"}>
                      {rule.approvalRequired ? "Approval" : "Auto"}
                    </Pill>
                    <Pill tone={rule.digestOnly ? "purple" : "slate"}>
                      {rule.digestOnly ? "Digest" : "Instant"}
                    </Pill>
                  </div>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader
              eyebrow="Data Quality"
              title="Freshness and provider confidence"
              description="Every live-data feature should report source, freshness, fallback, warning, and quality."
            />

            <div className="grid gap-3">
              {data.dataQuality.map((record) => (
                <div key={record.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{record.entityType}</div>
                      <div className="mt-1 text-xs text-slate-500">{record.sourceName} · {record.freshnessStatus}</div>
                    </div>
                    <Pill tone={toneFor(record.liveStatus)}>{record.liveStatus}</Pill>
                  </div>
                  <div className="mt-3 text-sm text-slate-300">Quality: {record.qualityScore}%</div>
                  {record.warning ? (
                    <p className="mt-2 text-xs leading-5 text-slate-500">{record.warning}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader
              eyebrow="Tenant Isolation"
              title="Firm/user scoping"
              description="Every backend query should be scoped by user, firm, membership, and permission."
            />

            <div className="grid gap-3">
              {data.tenantChecks.map((check) => (
                <div key={check.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{check.checkName}</div>
                      <div className="mt-1 text-xs text-slate-500">{new Date(check.lastCheckedAt).toLocaleString()}</div>
                    </div>
                    <Pill tone={toneFor(check.status)}>{check.status}</Pill>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{check.detail}</p>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card>
            <SectionHeader
              eyebrow="AI Tool Registry"
              title="Structured command contracts"
              description="The bot should eventually call these tools with strict structured inputs rather than loose text."
            />

            <div className="grid gap-3 md:grid-cols-2">
              {data.aiTools.map((tool) => (
                <div key={tool.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{tool.toolName}</div>
                      <div className="mt-1 text-xs text-slate-500">{tool.category} · {tool.toolKey}</div>
                    </div>
                    <Pill tone={tool.enabled ? "green" : "slate"}>{tool.enabled ? "On" : "Off"}</Pill>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{tool.description}</p>
                  <div className="mt-2 text-xs text-slate-500">
                    Success {tool.successCount} · Failures {tool.failureCount}
                  </div>
                  {tool.approvalRequired ? (
                    <div className="mt-3">
                      <Pill tone="amber">Approval Required</Pill>
                    </div>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader
              eyebrow="Background Jobs"
              title="Automation plan"
              description="These jobs define the backend automation roadmap before connecting cron, queues, workers, and providers."
            />

            <div className="grid gap-3">
              {data.jobs.map((job) => (
                <div key={job.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{job.jobName}</div>
                      <div className="mt-1 text-xs text-slate-500">{job.category} · {job.cadence}</div>
                    </div>
                    <Pill tone={toneFor(job.status)}>{job.status}</Pill>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{job.description}</p>
                  <div className="mt-2 text-xs font-semibold text-slate-500">{job.scheduleLabel}</div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
          <Card>
            <SectionHeader
              eyebrow="Demo Seed"
              title="Testing data"
              description="Seed data keeps the backend testable before real integrations are connected."
            />

            <div className="grid gap-3">
              <Metric label="Clients" value={data.metrics.clientCount} helper="User-scoped" tone="purple" />
              <Metric label="Alerts" value={data.metrics.alertCount} helper="Alert events" tone="red" />
              <Metric label="Watchlists" value={data.metrics.watchlistCount} helper="Named lists" tone="amber" />
              <Metric label="Tasks" value={data.metrics.taskCount} helper="Personal tasks" tone="green" />
              <Metric label="Bot Commands" value={data.metrics.botCommandCount} helper="Command history" tone="purple" />
            </div>
          </Card>

          <Card>
            <SectionHeader
              eyebrow="Seed Runs"
              title="Recent seed history"
              description="Every demo seed run is recorded so you know what was created or refreshed."
            />

            <div className="grid gap-3">
              {data.seedRuns.map((run) => (
                <div key={run.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{run.summary}</div>
                      <div className="mt-1 text-xs text-slate-500">{new Date(run.createdAt).toLocaleString()}</div>
                    </div>
                    <Pill tone={toneFor(run.status)}>{run.status}</Pill>
                  </div>
                  <pre className="mt-3 overflow-x-auto rounded-2xl bg-black/40 p-3 text-xs text-slate-300">
                    {JSON.stringify(run.counts, null, 2)}
                  </pre>
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}