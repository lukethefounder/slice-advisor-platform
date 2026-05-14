"use client";

import { useEffect, useState } from "react";

type KernelPayload = {
  message?: string;
  readinessScore: number;
  metrics: {
    vendors: number;
    configuredVendors: number;
    features: number;
    enabledFeatures: number;
    jobs: number;
    jobRuns: number;
    queuedDeliveries: number;
    deliveries: number;
    dataQuality: number;
    toolRuns: number;
    events: number;
    failedRuns: number;
  };
  vendors: Array<{
    id: string;
    vendorName: string;
    vendorKey: string;
    category: string;
    purpose: string;
    status: string;
    enabled: boolean;
    riskLevel: string;
    fallbackBehavior: string | null;
  }>;
  flags: Array<{
    id: string;
    flagName: string;
    flagKey: string;
    category: string;
    description: string;
    enabled: boolean;
    status: string;
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
  jobRuns: Array<{
    id: string;
    jobName: string;
    jobKey: string;
    status: string;
    startedAt: string;
    completedAt: string | null;
    durationMs: number | null;
    error: string | null;
  }>;
  deliveries: Array<{
    id: string;
    channel: string;
    title: string;
    status: string;
    urgency: string;
    score: number;
    createdAt: string;
    failureReason: string | null;
  }>;
  dataQuality: Array<{
    id: string;
    entityType: string;
    sourceName: string;
    liveStatus: string;
    freshnessStatus: string;
    qualityScore: number;
    warning: string | null;
  }>;
  events: Array<{
    id: string;
    title: string;
    eventType: string;
    area: string;
    severity: string;
    detail: string | null;
    createdAt: string;
  }>;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function toneFor(value: string | number): "red" | "green" | "amber" | "purple" | "slate" {
  const text = String(value).toLowerCase();

  if (text.includes("failed") || text.includes("missing") || text.includes("provider missing") || text.includes("broken")) return "red";
  if (text.includes("configured") || text.includes("ready") || text.includes("sent") || text.includes("complete")) return "green";
  if (text.includes("planned") || text.includes("queued") || text.includes("running") || text.includes("needs")) return "amber";
  if (text.includes("ai") || text.includes("feature")) return "purple";

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

export default function BackendKernelPage() {
  const [data, setData] = useState<KernelPayload | null>(null);
  const [message, setMessage] = useState("");
  const [working, setWorking] = useState("");

  async function load() {
    const response = await fetch("/api/backend-kernel", {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Could not load Backend Kernel.");
      return;
    }

    setData(payload);
  }

  async function runAction(action: string, extra: Record<string, unknown> = {}) {
    setWorking(action);
    setMessage("");

    try {
      const response = await fetch("/api/backend-kernel", {
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
      setMessage(payload.message ?? "Backend Kernel updated.");
    } finally {
      setWorking("");
    }
  }

  useEffect(() => {
    void load();
  }, []);

  if (!data) {
    return (
      <main className="min-h-screen bg-[#050505] p-6 text-white">
        <Card className="mx-auto mt-20 max-w-3xl text-center">
          <Pill tone="red">Slice</Pill>
          <h1 className="mt-4 text-3xl font-black">Loading Backend Kernel...</h1>
          {message ? <p className="mt-3 text-sm text-red-200">{message}</p> : null}
        </Card>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(8,145,178,0.18),_transparent_30%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1600px] gap-6">
        <header className="rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="text-xs font-black uppercase tracking-[0.24em] text-cyan-300">
                Slice Backend Kernel
              </div>
              <h1 className="mt-2 text-4xl font-black md:text-6xl">
                The backend spine for every feature.
              </h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">
                Vendor registry, feature flags, job runner, outbound delivery,
                market quote checks, data-quality records, AI tool runs, and the
                activity event bus are now connected.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a href="/workspace" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950">
                Workspace
              </a>
              <a href="/backend-readiness" className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100">
                Readiness
              </a>
              <button
                onClick={() => runAction("bootstrap")}
                disabled={working === "bootstrap"}
                className="rounded-2xl bg-cyan-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-cyan-950/40 disabled:opacity-50"
              >
                Bootstrap Kernel
              </button>
            </div>
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">
            {message}
          </div>
        ) : null}

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-6">
          <Metric label="Readiness" value={`${data.readinessScore}%`} helper="Kernel score" tone={data.readinessScore >= 80 ? "green" : data.readinessScore >= 55 ? "amber" : "red"} />
          <Metric label="Vendors" value={`${data.metrics.configuredVendors}/${data.metrics.vendors}`} helper="Configured" tone="purple" />
          <Metric label="Features" value={`${data.metrics.enabledFeatures}/${data.metrics.features}`} helper="Enabled" tone="green" />
          <Metric label="Jobs" value={data.metrics.jobs} helper="Registered" tone="amber" />
          <Metric label="Queued" value={data.metrics.queuedDeliveries} helper="Deliveries" tone={data.metrics.queuedDeliveries ? "amber" : "green"} />
          <Metric label="Failed Runs" value={data.metrics.failedRuns} helper="Recent runs" tone={data.metrics.failedRuns ? "red" : "green"} />
        </section>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <button
            onClick={() => runAction("runCoreJobs")}
            disabled={working === "runCoreJobs"}
            className="rounded-[1.5rem] bg-white p-5 text-left text-slate-950 shadow-xl shadow-red-950/20 transition hover:scale-[1.01] disabled:opacity-50"
          >
            <div className="text-xs font-black uppercase tracking-[0.16em] text-cyan-700">Core Jobs</div>
            <div className="mt-2 text-2xl font-black">Run Core Backend</div>
            <div className="mt-2 text-sm font-semibold text-slate-600">Vendor health, price alerts, delivery, data quality, and advisor day.</div>
          </button>

          <button
            onClick={() => runAction("runJob", { jobKey: "watchlist_price_check" })}
            disabled={working === "runJob"}
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 text-left transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            <div className="text-xs font-black uppercase tracking-[0.16em] text-amber-300">Market</div>
            <div className="mt-2 text-2xl font-black">Check Prices</div>
            <div className="mt-2 text-sm font-semibold text-slate-500">Run high/low watchlist price alerts.</div>
          </button>

          <button
            onClick={() => runAction("runJob", { jobKey: "notification_delivery" })}
            disabled={working === "runJob"}
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 text-left transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            <div className="text-xs font-black uppercase tracking-[0.16em] text-emerald-300">Delivery</div>
            <div className="mt-2 text-2xl font-black">Process Queue</div>
            <div className="mt-2 text-sm font-semibold text-slate-500">Process queued dashboard delivery records.</div>
          </button>

          <button
            onClick={() => runAction("queueTestDelivery")}
            disabled={working === "queueTestDelivery"}
            className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-5 text-left transition hover:bg-white/[0.08] disabled:opacity-50"
          >
            <div className="text-xs font-black uppercase tracking-[0.16em] text-purple-300">Test</div>
            <div className="mt-2 text-2xl font-black">Queue Delivery</div>
            <div className="mt-2 text-sm font-semibold text-slate-500">Queue a test notification through the backend.</div>
          </button>
        </section>

        <section className="grid gap-6 xl:grid-cols-2">
          <Card>
            <SectionHeader
              eyebrow="Vendor Registry"
              title="Provider readiness"
              description="Every live backend dependency is registered with status, purpose, fallback, and risk."
            />

            <div className="grid gap-3">
              {data.vendors.map((vendor) => (
                <div key={vendor.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{vendor.vendorName}</div>
                      <div className="mt-1 text-xs text-slate-500">{vendor.category} · {vendor.vendorKey}</div>
                    </div>
                    <Pill tone={toneFor(vendor.status)}>{vendor.status}</Pill>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{vendor.purpose}</p>
                  {vendor.fallbackBehavior ? (
                    <p className="mt-2 text-xs leading-5 text-slate-500">{vendor.fallbackBehavior}</p>
                  ) : null}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader
              eyebrow="Feature Flags"
              title="Backend-controlled capability switches"
              description="These flags determine what should run live, what should stay simulated, and what needs provider setup."
            />

            <div className="grid gap-3">
              {data.flags.map((flag) => (
                <div key={flag.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{flag.flagName}</div>
                      <div className="mt-1 text-xs text-slate-500">{flag.category} · {flag.flagKey}</div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={flag.enabled ? "green" : "slate"}>{flag.enabled ? "Enabled" : "Off"}</Pill>
                      <Pill tone={toneFor(flag.status)}>{flag.status}</Pill>
                    </div>
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">{flag.description}</p>
                  <button
                    onClick={() => runAction("toggleFeature", { flagKey: flag.flagKey, enabled: !flag.enabled })}
                    className="mt-3 rounded-2xl border border-white/10 bg-white/5 px-4 py-2 text-xs font-black text-white hover:bg-white/10"
                  >
                    {flag.enabled ? "Disable" : "Enable"}
                  </button>
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <Card>
            <SectionHeader
              eyebrow="Job Registry"
              title="Backend jobs"
              description="Manual now, cron/queue later. These are the jobs that power continuous platform behavior."
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
                  <button
                    onClick={() => runAction("runJob", { jobKey: job.jobKey })}
                    className="mt-3 rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                  >
                    Run Job
                  </button>
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader
              eyebrow="Job Runs"
              title="Execution history"
              description="Every manual or scheduled backend run is recorded here."
            />

            <div className="grid max-h-[720px] gap-3 overflow-y-auto pr-1">
              {data.jobRuns.map((run) => (
                <div key={run.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{run.jobName}</div>
                      <div className="mt-1 text-xs text-slate-500">
                        {run.jobKey} · {new Date(run.startedAt).toLocaleString()} · {run.durationMs ?? 0}ms
                      </div>
                    </div>
                    <Pill tone={toneFor(run.status)}>{run.status}</Pill>
                  </div>
                  {run.error ? <p className="mt-2 text-sm leading-6 text-red-200">{run.error}</p> : null}
                </div>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-6 xl:grid-cols-3">
          <Card>
            <SectionHeader
              eyebrow="Outbound Delivery"
              title="Delivery queue"
              description="Dashboard/email/SMS delivery starts here before live providers are connected."
            />

            <div className="grid gap-3">
              {data.deliveries.slice(0, 10).map((delivery) => (
                <div key={delivery.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{delivery.title}</div>
                      <div className="mt-1 text-xs text-slate-500">{delivery.channel} · Score {delivery.score}</div>
                    </div>
                    <Pill tone={toneFor(delivery.status)}>{delivery.status}</Pill>
                  </div>
                  {delivery.failureReason ? <p className="mt-2 text-xs leading-5 text-red-200">{delivery.failureReason}</p> : null}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader
              eyebrow="Data Quality"
              title="Freshness and quality"
              description="Live features need visible source health and freshness."
            />

            <div className="grid gap-3">
              {data.dataQuality.slice(0, 10).map((record) => (
                <div key={record.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">{record.entityType}</div>
                      <div className="mt-1 text-xs text-slate-500">{record.sourceName} · {record.freshnessStatus}</div>
                    </div>
                    <Pill tone={toneFor(record.liveStatus)}>{record.liveStatus}</Pill>
                  </div>
                  <div className="mt-2 text-sm text-slate-300">Quality: {record.qualityScore}%</div>
                  {record.warning ? <p className="mt-2 text-xs leading-5 text-slate-500">{record.warning}</p> : null}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <SectionHeader
              eyebrow="Event Bus"
              title="Recent backend events"
              description="The backend event log powers audit trails, activity history, and future analytics."
            />

            <div className="grid gap-3">
              {data.events.slice(0, 10).map((event) => (
                <div key={event.id} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4">
                  <div className="font-black text-white">{event.title}</div>
                  <div className="mt-1 text-xs text-slate-500">{event.area} · {event.eventType}</div>
                  {event.detail ? <p className="mt-2 text-sm leading-6 text-slate-400">{event.detail}</p> : null}
                </div>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}