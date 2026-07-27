"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type ReadinessItem = {
  area: string;
  status: string;
  detail: string;
  score: number;
};

type WorkspaceLink = {
  title: string;
  path: string;
  description: string;
  status: string;
};

type RecentAlert = {
  id: string;
  title: string;
  source: string;
  ticker: string | null;
  urgency: string;
  score: number;
  status: string;
  createdAt: string;
};

type RecentBriefing = {
  id: string;
  title: string;
  audience: string;
  briefType: string;
  createdAt: string;
  client: {
    fullName: string;
  } | null;
};

type RecentDecision = {
  id: string;
  title: string;
  sourceName: string;
  category: string;
  urgency: string;
  score: number;
  createdAt: string;
};

type RecentDelivery = {
  id: string;
  channel: string;
  status: string;
  urgency: string;
  score: number;
  title: string;
  createdAt: string;
};

type RecentAuditLog = {
  id: string;
  eventType: string;
  severity: string;
  area: string;
  title: string;
  createdAt: string;
};

type SourceHealth = {
  id: string;
  sourceId: string;
  sourceName: string;
  lastStatus: string;
  lastItemCount: number;
  updatedAt: string;
};

type CommandOverview = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  readinessScore: number;
  readinessItems: ReadinessItem[];
  workspaceLinks: WorkspaceLink[];
  counts: {
    watchlistCount: number;
    ventureCount: number;
    goalCount: number;
    researchCount: number;
    unreadAlertCount: number;
    totalAlertCount: number;
    clientCount: number;
    openTaskCount: number;
    briefingCount: number;
    retainedDecisionCount: number;
    triageRunCount: number;
    deliveryCount: number;
    digestCount: number;
    auditLogCount: number;
    accountCount: number;
    holdingCount: number;
    modelCount: number;
    enabledSources: number;
    totalSources: number;
    enabledNotifications: number;
    totalNotificationChannels: number;
    acceptedDisclosures: number;
    requiredDisclosures: number;
    portfolioTotalValue: number;
  };
  recent: {
    alerts: RecentAlert[];
    briefings: RecentBriefing[];
    decisions: RecentDecision[];
    deliveries: RecentDelivery[];
    auditLogs: RecentAuditLog[];
    sourceHealth: SourceHealth[];
  };
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
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
        "rounded-[2rem] border border-white/10 bg-zinc-950/70 shadow-xl shadow-emerald-950/20 backdrop-blur-xl",
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
    red: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex rounded-full px-3 py-1 text-xs font-black ring-1",
        tones[tone]
      )}
    >
      {children}
    </span>
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
        <div className="text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-emerald-400">
          Command Center
        </div>
      </div>
    </div>
  );
}

function readinessTone(score: number): "red" | "green" | "amber" | "slate" {
  if (score >= 85) return "green";
  if (score >= 70) return "amber";
  if (score >= 50) return "red";
  return "slate";
}

function urgencyTone(urgency: string): "red" | "green" | "amber" | "slate" {
  if (urgency === "Critical") return "red";
  if (urgency === "High") return "amber";
  if (urgency === "Medium") return "green";
  return "slate";
}

function statusTone(status: string): "red" | "green" | "amber" | "slate" {
  if (["Ready", "Active", "Delivered", "OK", "Info"].includes(status)) {
    return "green";
  }

  if (["Queued", "Needs Review", "Warning", "Skipped"].includes(status)) {
    return "amber";
  }

  if (["Critical", "Error", "Suppressed"].includes(status)) {
    return "red";
  }

  return "slate";
}

export default function CommandCenterPage() {
  const [overview, setOverview] = useState<CommandOverview | null>(null);
  const [unauthorized, setUnauthorized] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeAction, setActiveAction] = useState("");
  const [message, setMessage] = useState("");

  const readinessToneValue = overview
    ? readinessTone(overview.readinessScore)
    : "slate";

  const topNeeds = useMemo(() => {
    if (!overview) return [];
    return overview.readinessItems
      .slice()
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);
  }, [overview]);

  async function loadOverview() {
    const response = await fetch("/api/command/overview", {
      cache: "no-store",
    });

    if (response.status === 401) {
      setUnauthorized(true);
      return;
    }

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as CommandOverview;
    setOverview(data);
  }

  async function runAction(label: string, url: string, body?: unknown) {
    setLoading(true);
    setActiveAction(label);
    setMessage("");

    try {
      const response = await fetch(url, {
        method: "POST",
        headers: body
          ? {
              "Content-Type": "application/json",
            }
          : undefined,
        body: body ? JSON.stringify(body) : undefined,
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? `${label} failed.`);
        return;
      }

      setMessage(`${label} complete.`);
      await loadOverview();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : `${label} failed.`);
    } finally {
      setLoading(false);
      setActiveAction("");
    }
  }

  useEffect(() => {
    void loadOverview();
  }, []);

  if (unauthorized) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(4,120,87,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl flex-col items-center justify-center text-center">
          <Logo />
          <h1 className="mt-8 text-5xl font-black tracking-tight">
            Sign in to open the Slice Command Center.
          </h1>
          <p className="mt-4 max-w-2xl text-slate-400">
            Use the functional portal to register or log in first.
          </p>
          <a
            href="/portal"
            className="mt-8 rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-6 py-4 font-black text-white shadow-lg shadow-emerald-950/40"
          >
            Go to Login Portal
          </a>
        </section>
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(4,120,87,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <Logo />
          <div className="mt-8 text-slate-400">Loading command center...</div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(4,120,87,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-black/60 p-5 shadow-xl shadow-emerald-950/30 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <Logo />

          <div className="flex flex-wrap items-center gap-3">
            <div className="rounded-2xl bg-white/5 px-4 py-3">
              <div className="text-xs font-black uppercase text-slate-500">
                Operator
              </div>
              <div className="font-black text-white">{overview.user.name}</div>
            </div>

            <a
              href="/"
              className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
            >
              Main App
            </a>

            <a
              href="/portal"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Portal
            </a>

            <button
              onClick={loadOverview}
              className="rounded-2xl bg-emerald-500/10 px-4 py-3 font-black text-emerald-300 ring-1 ring-emerald-500/30"
            >
              Refresh
            </button>
          </div>
        </header>

        {message ? (
          <div className="mt-6 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-200">
            {message}
          </div>
        ) : null}

        <section className="mt-6 grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <Card className="p-6">
            <div className="flex flex-col gap-6 md:flex-row md:items-start md:justify-between">
              <div>
                <Pill tone={readinessToneValue}>System readiness</Pill>
                <h1 className="mt-4 text-5xl font-black tracking-tight">
                  Slice Command Center
                </h1>
                <p className="mt-4 max-w-3xl text-base leading-7 text-slate-400">
                  One operating console for every internal Slice module before
                  external variables are connected.
                </p>
              </div>

              <div className="rounded-[2rem] border border-emerald-500/30 bg-emerald-500/10 p-6 text-center">
                <div className="text-xs font-black uppercase text-emerald-300">
                  Readiness
                </div>
                <div className="mt-2 text-6xl font-black">
                  {overview.readinessScore}
                </div>
                <div className="mt-1 text-sm font-bold text-slate-400">
                  out of 100
                </div>
              </div>
            </div>

            <div className="mt-6 grid gap-4 md:grid-cols-3">
              {topNeeds.map((item) => (
                <div
                  key={item.area}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5"
                >
                  <Pill tone={readinessTone(item.score)}>{item.status}</Pill>
                  <div className="mt-3 text-lg font-black">{item.area}</div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    {item.detail}
                  </p>
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-black">Quick Actions</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Run common platform workflows from one place.
            </p>

            <div className="mt-5 grid gap-3">
              {[
                {
                  label: "Run Live Triage",
                  url: "/api/intelligence/triage/run",
                  body: undefined,
                  tone: "red",
                },
                {
                  label: "Run Demo Triage",
                  url: "/api/intelligence/triage/run?demo=1",
                  body: undefined,
                  tone: "slate",
                },
                {
                  label: "Queue Notifications",
                  url: "/api/notifications",
                  body: { action: "queue" },
                  tone: "amber",
                },
                {
                  label: "Process Notification Queue",
                  url: "/api/notifications",
                  body: { action: "process" },
                  tone: "green",
                },
                {
                  label: "Generate Digest",
                  url: "/api/notifications",
                  body: { action: "digest" },
                  tone: "purple",
                },
                {
                  label: "Generate Investor Briefing",
                  url: "/api/briefings",
                  body: { audience: "Investor", briefType: "Daily" },
                  tone: "red",
                },
                {
                  label: "Run Security Review",
                  url: "/api/security/review",
                  body: undefined,
                  tone: "amber",
                },
                {
                  label: "Run Intelligence Cleanup",
                  url: "/api/intelligence/cleanup",
                  body: undefined,
                  tone: "slate",
                },
              ].map((action) => (
                <button
                  key={action.label}
                  onClick={() =>
                    runAction(action.label, action.url, action.body)
                  }
                  disabled={loading}
                  className={cx(
                    "rounded-2xl px-4 py-3 text-left font-black ring-1 transition disabled:opacity-60",
                    action.tone === "red" &&
                      "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
                    action.tone === "green" &&
                      "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
                    action.tone === "amber" &&
                      "bg-amber-500/10 text-amber-300 ring-amber-500/30",
                    action.tone === "purple" &&
                      "bg-purple-500/10 text-purple-300 ring-purple-500/30",
                    action.tone === "slate" &&
                      "bg-white/5 text-slate-300 ring-white/10"
                  )}
                >
                  {loading && activeAction === action.label
                    ? "Running..."
                    : action.label}
                </button>
              ))}
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-5 md:grid-cols-4">
          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Portfolio Value</div>
            <div className="mt-1 text-3xl font-black">
              {money(overview.counts.portfolioTotalValue)}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Unread Alerts</div>
            <div className="mt-1 text-3xl font-black">
              {overview.counts.unreadAlertCount}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Clients</div>
            <div className="mt-1 text-3xl font-black">
              {overview.counts.clientCount}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Briefings</div>
            <div className="mt-1 text-3xl font-black">
              {overview.counts.briefingCount}
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.9fr_1.1fr]">
          <Card className="p-6">
            <h2 className="text-2xl font-black">Workspace Launcher</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Every workspace currently built into Slice.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2">
              {overview.workspaceLinks.map((workspace) => (
                <a
                  key={workspace.path}
                  href={workspace.path}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5 transition hover:border-emerald-500/40 hover:bg-emerald-500/10"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="font-black">{workspace.title}</div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">
                        {workspace.description}
                      </p>
                    </div>

                    <Pill tone="red">{workspace.status}</Pill>
                  </div>
                </a>
              ))}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-black">Module Readiness</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Each system area before external data, AI, email, and SMS variables.
            </p>

            <div className="mt-5 space-y-4">
              {overview.readinessItems.map((item) => (
                <div
                  key={item.area}
                  className="rounded-3xl border border-white/10 bg-white/5 p-5"
                >
                  <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="font-black">{item.area}</div>
                      <p className="mt-1 text-sm leading-6 text-slate-400">
                        {item.detail}
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <Pill tone={statusTone(item.status)}>{item.status}</Pill>
                      <div className="rounded-2xl bg-black/30 px-4 py-3 text-xl font-black">
                        {item.score}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 h-2 rounded-full bg-white/10">
                    <div
                      className="h-2 rounded-full bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950"
                      style={{ width: `${item.score}%` }}
                    />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-2">
          <Card className="p-6">
            <h2 className="text-2xl font-black">Recent Alerts</h2>

            <div className="mt-5 space-y-3">
              {overview.recent.alerts.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                  No recent alerts.
                </div>
              ) : (
                overview.recent.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={urgencyTone(alert.urgency)}>
                        {alert.urgency}
                      </Pill>
                      <Pill tone={alert.status === "Unread" ? "red" : "green"}>
                        {alert.status}
                      </Pill>
                    </div>
                    <div className="mt-3 font-black">{alert.title}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {alert.source} · {alert.ticker ?? "General"} · score{" "}
                      {alert.score}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-black">Recent Briefings</h2>

            <div className="mt-5 space-y-3">
              {overview.recent.briefings.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                  No recent briefings.
                </div>
              ) : (
                overview.recent.briefings.map((briefing) => (
                  <div
                    key={briefing.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-wrap gap-2">
                      <Pill tone="red">{briefing.audience}</Pill>
                      <Pill tone="amber">{briefing.briefType}</Pill>
                      {briefing.client ? (
                        <Pill tone="green">{briefing.client.fullName}</Pill>
                      ) : null}
                    </div>
                    <div className="mt-3 font-black">{briefing.title}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {new Date(briefing.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-3">
          <Card className="p-6">
            <h2 className="text-2xl font-black">Recent Triage Decisions</h2>

            <div className="mt-5 space-y-3">
              {overview.recent.decisions.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                  No retained decisions.
                </div>
              ) : (
                overview.recent.decisions.map((decision) => (
                  <div
                    key={decision.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4"
                  >
                    <Pill tone={urgencyTone(decision.urgency)}>
                      {decision.urgency}
                    </Pill>
                    <div className="mt-3 font-black">{decision.title}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {decision.category} · {decision.sourceName} · score{" "}
                      {decision.score}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-black">Recent Deliveries</h2>

            <div className="mt-5 space-y-3">
              {overview.recent.deliveries.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                  No delivery records.
                </div>
              ) : (
                overview.recent.deliveries.map((delivery) => (
                  <div
                    key={delivery.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={statusTone(delivery.status)}>
                        {delivery.status}
                      </Pill>
                      <Pill tone="slate">{delivery.channel}</Pill>
                    </div>
                    <div className="mt-3 font-black">{delivery.title}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {delivery.urgency} · score {delivery.score}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card className="p-6">
            <h2 className="text-2xl font-black">Recent Audit Logs</h2>

            <div className="mt-5 space-y-3">
              {overview.recent.auditLogs.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                  No audit logs yet.
                </div>
              ) : (
                overview.recent.auditLogs.map((log) => (
                  <div
                    key={log.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4"
                  >
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={statusTone(log.severity)}>
                        {log.severity}
                      </Pill>
                      <Pill tone="purple">{log.area}</Pill>
                    </div>
                    <div className="mt-3 font-black">{log.title}</div>
                    <div className="mt-1 text-sm text-slate-400">
                      {log.eventType} ·{" "}
                      {new Date(log.createdAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>

        <section className="mt-6">
          <Card className="p-6">
            <h2 className="text-2xl font-black">Source Health</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Live/free source checkpoint status from the intelligence scanner.
            </p>

            <div className="mt-5 grid gap-4 md:grid-cols-2 lg:grid-cols-4">
              {overview.recent.sourceHealth.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-6 text-sm text-slate-400">
                  No source checkpoints yet.
                </div>
              ) : (
                overview.recent.sourceHealth.map((source) => (
                  <div
                    key={source.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-4"
                  >
                    <Pill tone={statusTone(source.lastStatus)}>
                      {source.lastStatus}
                    </Pill>
                    <div className="mt-3 font-black">{source.sourceName}</div>
                    <div className="mt-1 text-xs text-slate-500">
                      {source.sourceId}
                    </div>
                    <div className="mt-3 text-sm text-slate-400">
                      {source.lastItemCount} items ·{" "}
                      {new Date(source.updatedAt).toLocaleString()}
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}