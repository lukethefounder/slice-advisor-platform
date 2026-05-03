"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type SecuritySetting = {
  id: string;
  mfaEnabled: boolean;
  requireReauthForSensitiveActions: boolean;
  alertOnNewLogin: boolean;
  advisorModeEnabled: boolean;
  sessionTimeoutMinutes: number;
  lastSecurityReviewAt: string | null;
};

type Disclosure = {
  disclosureKey: string;
  title: string;
  version: string;
  content: string;
  accepted: boolean;
  acceptedAt: string | null;
};

type AuditLog = {
  id: string;
  eventType: string;
  severity: string;
  area: string;
  title: string;
  detail: string | null;
  metadataJson: string;
  createdAt: string;
};

type Overview = {
  user: {
    id: string;
    name: string;
    email: string;
  };
  securitySetting: SecuritySetting;
  disclosures: Disclosure[];
  auditLogs: AuditLog[];
  stats: {
    totalAuditLogs: number;
    criticalLogs: number;
    warningLogs: number;
    acceptedDisclosures: number;
    requiredDisclosures: number;
  };
};

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
        "rounded-[2rem] border border-white/10 bg-zinc-950/70 shadow-xl shadow-red-950/20 backdrop-blur-xl",
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
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-zinc-950 to-red-700 shadow-lg shadow-red-950/50 ring-1 ring-red-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
      </div>

      <div>
        <div className="text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
          Security Center
        </div>
      </div>
    </div>
  );
}

function severityTone(severity: string): "red" | "green" | "amber" | "slate" {
  if (severity === "Critical") return "red";
  if (severity === "Warning") return "amber";
  if (severity === "Info") return "green";
  return "slate";
}

export default function SecurityPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("43200");

  const acceptedPercent = useMemo(() => {
    if (!overview) return 0;

    if (overview.stats.requiredDisclosures === 0) return 100;

    return Math.round(
      (overview.stats.acceptedDisclosures / overview.stats.requiredDisclosures) * 100
    );
  }, [overview]);

  async function loadData() {
    const response = await fetch("/api/security/overview", {
      cache: "no-store",
    });

    if (response.status === 401) {
      setUnauthorized(true);
      return;
    }

    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as Overview;
    setOverview(data);
    setSessionTimeout(String(data.securitySetting.sessionTimeoutMinutes));
  }

  async function updateSettings(patch: Partial<SecuritySetting>) {
    setMessage("");

    const response = await fetch("/api/security/settings", {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(patch),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not update security settings.");
      return;
    }

    setMessage("Security settings updated.");
    await loadData();
  }

  async function acceptDisclosure(disclosureKey: string) {
    setMessage("");

    const response = await fetch("/api/security/disclosures", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ disclosureKey }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not accept disclosure.");
      return;
    }

    setMessage("Disclosure accepted.");
    await loadData();
  }

  async function acceptAll() {
    setMessage("");

    const response = await fetch("/api/security/disclosures", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ acceptAll: true }),
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Could not accept disclosures.");
      return;
    }

    setMessage("All disclosures accepted.");
    await loadData();
  }

  async function runSecurityReview() {
    setMessage("");

    const response = await fetch("/api/security/review", {
      method: "POST",
    });

    const data = await response.json();

    if (!response.ok) {
      setMessage(data.error ?? "Security review failed.");
      return;
    }

    setMessage(
      data.warnings?.length
        ? `Security review completed with warnings: ${data.warnings.join(" ")}`
        : "Security review completed successfully."
    );

    await loadData();
  }

  useEffect(() => {
    void loadData();
  }, []);

  if (unauthorized) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <section className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-4xl flex-col items-center justify-center text-center">
          <Logo />
          <h1 className="mt-8 text-5xl font-black tracking-tight">
            Sign in to open the security center.
          </h1>
          <p className="mt-4 max-w-2xl text-slate-400">
            Register or log in through the functional portal first.
          </p>
          <a
            href="/portal"
            className="mt-8 rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-6 py-4 font-black text-white shadow-lg shadow-red-950/40"
          >
            Go to Login Portal
          </a>
        </section>
      </main>
    );
  }

  if (!overview) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
        <div className="mx-auto max-w-7xl">
          <Logo />
          <div className="mt-8 text-slate-400">Loading security center...</div>
        </div>
      </main>
    );
  }

  const setting = overview.securitySetting;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-6 text-white">
      <div className="mx-auto max-w-7xl">
        <header className="flex flex-col gap-5 rounded-[2rem] border border-white/10 bg-black/60 p-5 shadow-xl shadow-red-950/30 backdrop-blur-xl md:flex-row md:items-center md:justify-between">
          <Logo />

          <div className="flex flex-wrap items-center gap-3">
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

            <a
              href="/briefings"
              className="rounded-2xl bg-white/10 px-4 py-3 font-black text-white ring-1 ring-white/10"
            >
              Briefings
            </a>

            <button
              onClick={runSecurityReview}
              className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 font-black text-white shadow-lg shadow-red-950/40"
            >
              Run Security Review
            </button>
          </div>
        </header>

        {message ? (
          <div className="mt-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        ) : null}

        <section className="mt-6 grid gap-5 md:grid-cols-4">
          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Disclosures</div>
            <div className="mt-1 text-4xl font-black">{acceptedPercent}%</div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Audit Logs</div>
            <div className="mt-1 text-4xl font-black">
              {overview.stats.totalAuditLogs}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Warnings</div>
            <div className="mt-1 text-4xl font-black">
              {overview.stats.warningLogs}
            </div>
          </Card>

          <Card className="p-5">
            <div className="text-sm font-bold text-slate-400">Critical</div>
            <div className="mt-1 text-4xl font-black">
              {overview.stats.criticalLogs}
            </div>
          </Card>
        </section>

        <section className="mt-6 grid gap-6 lg:grid-cols-[0.85fr_1.15fr]">
          <div className="space-y-6">
            <Card className="p-6">
              <h1 className="text-3xl font-black">Security Settings</h1>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                These are local platform-readiness controls. External MFA,
                device verification, and login notifications can connect later.
              </p>

              <div className="mt-5 space-y-4">
                {[
                  {
                    label: "MFA readiness flag",
                    key: "mfaEnabled" as const,
                    value: setting.mfaEnabled,
                  },
                  {
                    label: "Require reauth for sensitive actions",
                    key: "requireReauthForSensitiveActions" as const,
                    value: setting.requireReauthForSensitiveActions,
                  },
                  {
                    label: "Alert on new login",
                    key: "alertOnNewLogin" as const,
                    value: setting.alertOnNewLogin,
                  },
                  {
                    label: "Advisor mode enabled",
                    key: "advisorModeEnabled" as const,
                    value: setting.advisorModeEnabled,
                  },
                ].map((item) => (
                  <div
                    key={item.key}
                    className="flex items-center justify-between gap-4 rounded-3xl border border-white/10 bg-white/5 p-4"
                  >
                    <div>
                      <div className="font-black">{item.label}</div>
                      <div className="mt-1 text-sm text-slate-400">
                        Current status: {item.value ? "enabled" : "disabled"}
                      </div>
                    </div>

                    <button
                      onClick={() =>
                        updateSettings({
                          [item.key]: !item.value,
                        })
                      }
                      className={cx(
                        "rounded-2xl px-4 py-3 font-black",
                        item.value
                          ? "bg-emerald-500/10 text-emerald-300 ring-1 ring-emerald-500/30"
                          : "bg-red-500/10 text-red-300 ring-1 ring-red-500/30"
                      )}
                    >
                      {item.value ? "Enabled" : "Disabled"}
                    </button>
                  </div>
                ))}

                <div className="rounded-3xl border border-white/10 bg-white/5 p-4">
                  <div className="font-black">Session timeout minutes</div>
                  <div className="mt-3 flex gap-3">
                    <input
                      value={sessionTimeout}
                      onChange={(event) => setSessionTimeout(event.target.value)}
                      type="number"
                      className="flex-1 rounded-2xl border border-white/10 bg-black/40 px-4 py-3 font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                    />
                    <button
                      onClick={() =>
                        updateSettings({
                          sessionTimeoutMinutes: Number(sessionTimeout),
                        })
                      }
                      className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
                    >
                      Save
                    </button>
                  </div>
                </div>

                <div className="rounded-3xl border border-white/10 bg-black/30 p-4">
                  <div className="text-xs font-black uppercase text-slate-500">
                    Last review
                  </div>
                  <div className="mt-1 text-sm font-semibold text-slate-300">
                    {setting.lastSecurityReviewAt
                      ? new Date(setting.lastSecurityReviewAt).toLocaleString()
                      : "No security review has been run yet."}
                  </div>
                </div>
              </div>
            </Card>

            <Card className="p-6">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <h2 className="text-2xl font-black">Required Disclosures</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    These records are stored locally and create audit logs when accepted.
                  </p>
                </div>

                <button
                  onClick={acceptAll}
                  className="rounded-2xl bg-white px-4 py-3 font-black text-slate-950"
                >
                  Accept All
                </button>
              </div>

              <div className="mt-5 space-y-4">
                {overview.disclosures.map((disclosure) => (
                  <div
                    key={disclosure.disclosureKey}
                    className="rounded-3xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={disclosure.accepted ? "green" : "amber"}>
                            {disclosure.accepted ? "Accepted" : "Required"}
                          </Pill>
                          <Pill tone="slate">v{disclosure.version}</Pill>
                        </div>

                        <h3 className="mt-3 text-xl font-black">
                          {disclosure.title}
                        </h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">
                          {disclosure.content}
                        </p>

                        {disclosure.acceptedAt ? (
                          <p className="mt-3 text-xs font-bold text-slate-500">
                            Accepted{" "}
                            {new Date(disclosure.acceptedAt).toLocaleString()}
                          </p>
                        ) : null}
                      </div>

                      {!disclosure.accepted ? (
                        <button
                          onClick={() =>
                            acceptDisclosure(disclosure.disclosureKey)
                          }
                          className="rounded-2xl bg-red-600 px-4 py-3 font-black text-white"
                        >
                          Accept
                        </button>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </div>

          <Card className="p-6">
            <h2 className="text-2xl font-black">Audit Timeline</h2>
            <p className="mt-2 text-sm leading-6 text-slate-400">
              Slice records important local events so security, disclosure, and compliance actions can be reviewed.
            </p>

            <div className="mt-5 space-y-4">
              {overview.auditLogs.length === 0 ? (
                <div className="rounded-3xl border border-white/10 bg-white/5 p-8 text-center text-sm font-semibold text-slate-400">
                  No audit logs yet. Accept disclosures or run a security review.
                </div>
              ) : (
                overview.auditLogs.map((log) => (
                  <article
                    key={log.id}
                    className="rounded-3xl border border-white/10 bg-white/5 p-5"
                  >
                    <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={severityTone(log.severity)}>
                            {log.severity}
                          </Pill>
                          <Pill tone="slate">{log.area}</Pill>
                          <Pill tone="purple">{log.eventType}</Pill>
                        </div>

                        <h3 className="mt-4 text-xl font-black">{log.title}</h3>

                        {log.detail ? (
                          <p className="mt-2 text-sm leading-6 text-slate-400">
                            {log.detail}
                          </p>
                        ) : null}
                      </div>

                      <div className="text-right text-xs font-bold text-slate-500">
                        {new Date(log.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </article>
                ))
              )}
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}