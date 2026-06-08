"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Tone = "red" | "green" | "amber" | "slate" | "purple" | "cyan";
type SecurityView = "overview" | "settings" | "disclosures" | "audit" | "controls";

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

function toneFor(value: string | number | boolean | null | undefined): Tone {
  const text = String(value ?? "").toLowerCase();

  if (
    text.includes("critical") ||
    text.includes("failed") ||
    text.includes("missing") ||
    text.includes("blocked") ||
    text.includes("warning") ||
    text.includes("false")
  ) {
    return "red";
  }

  if (
    text.includes("accepted") ||
    text.includes("complete") ||
    text.includes("healthy") ||
    text.includes("enabled") ||
    text.includes("true") ||
    text.includes("info")
  ) {
    return "green";
  }

  if (
    text.includes("pending") ||
    text.includes("review") ||
    text.includes("required") ||
    text.includes("open")
  ) {
    return "amber";
  }

  if (text.includes("audit") || text.includes("disclosure")) return "purple";
  if (text.includes("setting") || text.includes("session")) return "cyan";

  return "slate";
}

function severityTone(severity: string): Tone {
  if (severity === "Critical") return "red";
  if (severity === "Warning") return "amber";
  if (severity === "Info") return "green";
  return "slate";
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

function safeJson(value: string) {
  try {
    return JSON.stringify(JSON.parse(value || "{}"), null, 2);
  } catch {
    return value || "{}";
  }
}

function scoreTone(score: number): Tone {
  if (score >= 85) return "green";
  if (score >= 68) return "cyan";
  if (score >= 45) return "amber";
  return "red";
}

function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/78 shadow-xl shadow-red-950/20 backdrop-blur-xl",
        className
      )}
    >
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
    red: "from-red-500/16",
    green: "from-emerald-500/16",
    amber: "from-amber-500/16",
    purple: "from-purple-500/16",
    cyan: "from-cyan-500/16",
    slate: "from-slate-400/8",
  };

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.052] p-4 shadow-lg shadow-black/10",
        className
      )}
    >
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">{children}</div>
    </div>
  );
}

function Pill({ children, tone = "red" }: { children: ReactNode; tone?: Tone }) {
  const tones: Record<Tone, string> = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex max-w-full rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1",
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
      <div className="relative flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-zinc-950 to-red-700 shadow-lg shadow-red-950/50 ring-1 ring-red-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
      </div>

      <div>
        <div className="text-2xl font-black tracking-tight text-white">Slice</div>
        <div className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
          Security Center
        </div>
      </div>
    </div>
  );
}

function ProgressBar({ value, tone = "cyan" }: { value: number; tone?: Tone }) {
  const fills: Record<Tone, string> = {
    red: "from-red-700 to-red-400",
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
  return (
    <div className="relative min-h-[116px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div
        className={cx(
          "absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent",
          tone === "red"
            ? "from-red-500/18"
            : tone === "green"
              ? "from-emerald-500/18"
              : tone === "amber"
                ? "from-amber-500/18"
                : tone === "purple"
                  ? "from-purple-500/18"
                  : tone === "cyan"
                    ? "from-cyan-500/18"
                    : "from-slate-400/10"
        )}
      />
      <div className="relative">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{label}</div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function SettingToggle({
  label,
  helper,
  checked,
  tone,
  onChange,
}: {
  label: string;
  helper: string;
  checked: boolean;
  tone: Tone;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={cx(
        "w-full rounded-[1.35rem] border p-4 text-left transition hover:bg-white/[0.08]",
        checked ? "border-emerald-500/25 bg-emerald-500/10" : "border-white/10 bg-white/[0.045]"
      )}
    >
      <div className="flex items-start justify-between gap-4">
        <div>
          <div className="text-sm font-black text-white">{label}</div>
          <p className="mt-1 text-xs leading-5 text-slate-400">{helper}</p>
        </div>
        <Pill tone={checked ? tone : "slate"}>{checked ? "Enabled" : "Off"}</Pill>
      </div>
    </button>
  );
}

export default function SecurityPage() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [message, setMessage] = useState("");
  const [unauthorized, setUnauthorized] = useState(false);
  const [sessionTimeout, setSessionTimeout] = useState("43200");
  const [activeView, setActiveView] = useState<SecurityView>("overview");
  const [auditFilter, setAuditFilter] = useState("All");

  const acceptedPercent = useMemo(() => {
    if (!overview) return 0;
    if (overview.stats.requiredDisclosures === 0) return 100;

    return Math.round(
      (overview.stats.acceptedDisclosures / overview.stats.requiredDisclosures) * 100
    );
  }, [overview]);

  const securityScore = useMemo(() => {
    if (!overview) return 0;

    const setting = overview.securitySetting;
    let score = 25;

    if (setting.mfaEnabled) score += 16;
    if (setting.requireReauthForSensitiveActions) score += 18;
    if (setting.alertOnNewLogin) score += 12;
    if (setting.advisorModeEnabled) score += 10;
    if (setting.sessionTimeoutMinutes <= 720) score += 8;
    if (acceptedPercent === 100) score += 16;
    if (overview.stats.criticalLogs === 0) score += 10;
    if (overview.stats.warningLogs === 0) score += 5;

    return Math.max(0, Math.min(100, score));
  }, [overview, acceptedPercent]);

  const filteredAuditLogs = useMemo(() => {
    if (!overview) return [];

    if (auditFilter === "All") return overview.auditLogs;
    return overview.auditLogs.filter((log) => log.severity === auditFilter || log.area === auditFilter);
  }, [overview, auditFilter]);

  const auditAreas = useMemo(() => {
    if (!overview) return [];
    return Array.from(new Set(overview.auditLogs.map((log) => log.area))).filter(Boolean);
  }, [overview]);

  async function loadData() {
    const response = await fetch("/api/security/overview", {
      cache: "no-store",
    });

    if (response.status === 401) {
      setUnauthorized(true);
      return;
    }

    if (!response.ok) return;

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
        "x-slice-sensitive-action": "security-settings-update",
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
        "x-slice-sensitive-action": "security-disclosure-accept",
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
        "x-slice-sensitive-action": "security-disclosures-accept-all",
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
      headers: {
        "x-slice-sensitive-action": "security-review",
      },
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
          <h1 className="mt-8 text-5xl font-black tracking-tight">Sign in to open the security center.</h1>
          <p className="mt-4 max-w-2xl text-slate-400">Register or log in through the functional portal first.</p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <a
              href="/portal"
              className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-6 py-4 font-black text-white shadow-lg shadow-red-950/40"
            >
              Go to Login Portal
            </a>
            <a
              href="/workspace"
              className="rounded-2xl bg-white px-6 py-4 font-black text-slate-950"
            >
              Workspace
            </a>
          </div>
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
  const pendingDisclosures = overview.disclosures.filter((item) => !item.accepted);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1800px] gap-5">
        <header className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-zinc-950/78 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(239,68,68,0.26),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(6,182,212,0.12),transparent_26%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <Logo />

              <div className="mt-5 flex flex-wrap gap-2">
                <Pill tone="red">Governance</Pill>
                <Pill tone="cyan">Session Controls</Pill>
                <Pill tone="purple">Audit Trail</Pill>
                <Pill tone="green">Advisor Review Gates</Pill>
              </div>

              <h1 className="mt-5 max-w-6xl text-4xl font-black tracking-tight md:text-6xl">
                Security command center for advisor-grade operations.
              </h1>

              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
                Monitor disclosure acceptance, local platform security controls, sensitive-action gates,
                session behavior, audit history, and review posture before a wealth management team uses the system at scale.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <a href="/workspace?tab=security" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20">
                ← Workspace
              </a>
              <a href="/backend-readiness" className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-500/20">
                Backend Readiness
              </a>
              <a href="/workspace/personal-bot" className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-black text-purple-100 hover:bg-purple-500/20">
                AI Studio
              </a>
              <button
                onClick={runSecurityReview}
                className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40"
              >
                Run Security Review
              </button>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <Metric label="Security Score" value={`${securityScore}%`} helper="Calculated posture" tone={scoreTone(securityScore)} />
            <Metric label="Disclosures" value={`${acceptedPercent}%`} helper={`${overview.stats.acceptedDisclosures}/${overview.stats.requiredDisclosures} accepted`} tone={acceptedPercent === 100 ? "green" : "amber"} />
            <Metric label="Audit Logs" value={overview.stats.totalAuditLogs} helper="Recent records" tone="purple" />
            <Metric label="Warnings" value={overview.stats.warningLogs} helper="Review items" tone={overview.stats.warningLogs ? "amber" : "green"} />
            <Metric label="Critical" value={overview.stats.criticalLogs} helper="High-risk events" tone={overview.stats.criticalLogs ? "red" : "green"} />
            <Metric label="MFA" value={setting.mfaEnabled ? "On" : "Off"} helper="Local readiness flag" tone={setting.mfaEnabled ? "green" : "red"} />
            <Metric label="Reauth" value={setting.requireReauthForSensitiveActions ? "Required" : "Off"} helper="Sensitive actions" tone={setting.requireReauthForSensitiveActions ? "green" : "red"} />
            <Metric label="Last Review" value={relativeTime(setting.lastSecurityReviewAt)} helper="Security sweep" tone={setting.lastSecurityReviewAt ? "green" : "amber"} />
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <Card className="p-3">
          <div className="grid gap-2 md:grid-cols-5">
            {[
              ["overview", "Overview", "Security posture", "red"],
              ["settings", "Settings", "Local controls", "cyan"],
              ["disclosures", "Disclosures", "Required review", "amber"],
              ["audit", "Audit Trail", "Event history", "purple"],
              ["controls", "Controls", "Best practices", "green"],
            ].map(([key, label, helper, tone]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveView(key as SecurityView)}
                className={cx(
                  "rounded-2xl px-4 py-3 text-left transition",
                  activeView === key
                    ? "bg-white text-slate-950 shadow-lg shadow-black/20"
                    : "border border-white/10 bg-white/[0.045] text-white hover:bg-white/10"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-black">{label}</div>
                  <span
                    className={cx(
                      "h-2 w-2 rounded-full",
                      tone === "red"
                        ? "bg-red-400"
                        : tone === "cyan"
                          ? "bg-cyan-400"
                          : tone === "purple"
                            ? "bg-purple-400"
                            : tone === "green"
                              ? "bg-emerald-400"
                              : "bg-amber-400"
                    )}
                  />
                </div>
                <div className={cx("mt-1 text-[10px] font-bold", activeView === key ? "text-slate-500" : "text-slate-500")}>
                  {helper}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {activeView === "overview" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
                Security posture
              </div>
              <h2 className="mt-2 text-3xl font-black text-white">
                Operational controls at a glance
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-400">
                The score prioritizes disclosure acceptance, MFA readiness, sensitive-action reauthentication,
                login alerting, advisor mode, session limits, and the absence of critical audit events.
              </p>

              <div className="mt-6">
                <ProgressBar value={securityScore} tone={scoreTone(securityScore)} />
              </div>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["MFA readiness", setting.mfaEnabled, "Enable MFA readiness before external users rely on production access."],
                  ["Sensitive reauth", setting.requireReauthForSensitiveActions, "Require confirmation before high-impact actions."],
                  ["Login alerts", setting.alertOnNewLogin, "Notify user when a new login is detected."],
                  ["Advisor mode", setting.advisorModeEnabled, "Keeps client-facing workflows framed around review and suitability."],
                  ["Disclosures complete", acceptedPercent === 100, "Required platform disclosures should be accepted before live use."],
                  ["Critical event clean", overview.stats.criticalLogs === 0, "Critical events should be investigated immediately."],
                ].map(([label, enabled, helper]) => (
                  <Panel key={String(label)} tone={enabled ? "green" : "red"} className="bg-black/35">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-white">{label}</div>
                        <p className="mt-2 text-xs leading-5 text-slate-400">{helper}</p>
                      </div>
                      <Pill tone={enabled ? "green" : "red"}>{enabled ? "Pass" : "Review"}</Pill>
                    </div>
                  </Panel>
                ))}
              </div>
            </Card>

            <div className="grid gap-5">
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-400">
                  Immediate actions
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">What to fix first</h2>

                <div className="mt-5 grid gap-3">
                  {!setting.mfaEnabled ? (
                    <Panel tone="red" className="bg-black/35">
                      <div className="text-sm font-black text-white">Enable MFA readiness</div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">Local flag is currently off.</p>
                    </Panel>
                  ) : null}

                  {!setting.requireReauthForSensitiveActions ? (
                    <Panel tone="red" className="bg-black/35">
                      <div className="text-sm font-black text-white">Require sensitive-action reauth</div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">High-impact actions should require confirmation.</p>
                    </Panel>
                  ) : null}

                  {pendingDisclosures.length ? (
                    <Panel tone="amber" className="bg-black/35">
                      <div className="text-sm font-black text-white">{pendingDisclosures.length} disclosure(s) pending</div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">Accept or review disclosures before production demonstrations.</p>
                    </Panel>
                  ) : null}

                  {overview.stats.criticalLogs ? (
                    <Panel tone="red" className="bg-black/35">
                      <div className="text-sm font-black text-white">Critical audit events detected</div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">Review critical events in the audit tab.</p>
                    </Panel>
                  ) : null}

                  {setting.mfaEnabled &&
                  setting.requireReauthForSensitiveActions &&
                  !pendingDisclosures.length &&
                  overview.stats.criticalLogs === 0 ? (
                    <Panel tone="green" className="bg-black/35">
                      <div className="text-sm font-black text-white">Security posture looks strong</div>
                      <p className="mt-2 text-xs leading-5 text-slate-400">Continue periodic reviews and keep backend readiness current.</p>
                    </Panel>
                  ) : null}
                </div>
              </Card>

              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">
                  User context
                </div>
                <h2 className="mt-2 text-2xl font-black text-white">{overview.user.name}</h2>
                <p className="mt-2 text-sm text-slate-400">{overview.user.email}</p>

                <div className="mt-5 grid gap-3">
                  <Metric label="Session Timeout" value={`${setting.sessionTimeoutMinutes}m`} helper="Local policy" tone="cyan" />
                  <Metric label="Last Review" value={formatDateTime(setting.lastSecurityReviewAt)} tone="slate" />
                </div>
              </Card>
            </div>
          </section>
        ) : null}

        {activeView === "settings" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">
                Local security controls
              </div>
              <h2 className="mt-2 text-3xl font-black text-white">Advisor platform settings</h2>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-400">
                These controls are platform-readiness flags for the current user. They help keep sensitive advisor workflows
                deliberate, logged, and reviewable.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2">
                <SettingToggle
                  label="MFA readiness"
                  helper="Marks the account as requiring multi-factor authentication in production readiness checks."
                  checked={setting.mfaEnabled}
                  tone="green"
                  onChange={(value) => updateSettings({ mfaEnabled: value })}
                />
                <SettingToggle
                  label="Require reauthentication"
                  helper="Requires extra confirmation for sensitive actions such as approvals, delivery, and platform changes."
                  checked={setting.requireReauthForSensitiveActions}
                  tone="green"
                  onChange={(value) => updateSettings({ requireReauthForSensitiveActions: value })}
                />
                <SettingToggle
                  label="New login alerts"
                  helper="Keeps login-awareness enabled for new device or new session events."
                  checked={setting.alertOnNewLogin}
                  tone="cyan"
                  onChange={(value) => updateSettings({ alertOnNewLogin: value })}
                />
                <SettingToggle
                  label="Advisor mode"
                  helper="Frames workflows around suitability, evidence, and client-facing communication controls."
                  checked={setting.advisorModeEnabled}
                  tone="purple"
                  onChange={(value) => updateSettings({ advisorModeEnabled: value })}
                />
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-purple-400">
                Session policy
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Session timeout</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Shorter sessions are safer for shared office environments. Longer sessions are more convenient during build/demo work.
              </p>

              <div className="mt-5 grid gap-3">
                <input
                  type="number"
                  min={15}
                  max={43200}
                  value={sessionTimeout}
                  onChange={(event) => setSessionTimeout(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none ring-red-500 focus:ring-2"
                />
                <button
                  type="button"
                  onClick={() => updateSettings({ sessionTimeoutMinutes: Number(sessionTimeout) })}
                  className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
                >
                  Save Timeout
                </button>
              </div>

              <div className="mt-5 grid gap-3">
                {[30, 120, 720, 43200].map((minutes) => (
                  <button
                    key={minutes}
                    type="button"
                    onClick={() => {
                      setSessionTimeout(String(minutes));
                      void updateSettings({ sessionTimeoutMinutes: minutes });
                    }}
                    className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3 text-left text-sm font-bold text-slate-300 hover:bg-white/[0.08]"
                  >
                    {minutes < 60 ? `${minutes} minutes` : minutes < 1440 ? `${minutes / 60} hours` : "30 days"}
                  </button>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "disclosures" ? (
          <section className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)]">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-amber-400">
                Disclosure status
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">{acceptedPercent}% accepted</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Required disclosures should be accepted before investor-facing or client-facing demonstrations.
              </p>

              <div className="mt-5">
                <ProgressBar value={acceptedPercent} tone={acceptedPercent === 100 ? "green" : "amber"} />
              </div>

              <div className="mt-5 grid gap-3">
                <Metric label="Accepted" value={overview.stats.acceptedDisclosures} tone="green" />
                <Metric label="Required" value={overview.stats.requiredDisclosures} tone="amber" />
                <Metric label="Pending" value={pendingDisclosures.length} tone={pendingDisclosures.length ? "red" : "green"} />
              </div>

              {pendingDisclosures.length ? (
                <button
                  onClick={acceptAll}
                  className="mt-5 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
                >
                  Accept All Pending
                </button>
              ) : null}
            </Card>

            <Card className="p-5">
              <div className="grid gap-4">
                {overview.disclosures.map((disclosure) => (
                  <Panel key={disclosure.disclosureKey} tone={disclosure.accepted ? "green" : "amber"} className="bg-black/35">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={disclosure.accepted ? "green" : "amber"}>
                            {disclosure.accepted ? "Accepted" : "Required"}
                          </Pill>
                          <Pill tone="slate">v{disclosure.version}</Pill>
                          {disclosure.acceptedAt ? <Pill tone="green">{relativeTime(disclosure.acceptedAt)}</Pill> : null}
                        </div>

                        <h3 className="mt-3 text-xl font-black text-white">{disclosure.title}</h3>
                        <p className="mt-2 max-w-4xl whitespace-pre-wrap text-sm leading-7 text-slate-400">
                          {disclosure.content}
                        </p>
                      </div>

                      {!disclosure.accepted ? (
                        <button
                          onClick={() => acceptDisclosure(disclosure.disclosureKey)}
                          className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
                        >
                          Accept
                        </button>
                      ) : null}
                    </div>
                  </Panel>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "audit" ? (
          <section className="grid gap-5 xl:grid-cols-[370px_minmax(0,1fr)]">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-purple-400">
                Audit explorer
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Security audit trail</h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Review sensitive actions, platform events, disclosures, and security review history.
              </p>

              <div className="mt-5 grid gap-3">
                <select
                  value={auditFilter}
                  onChange={(event) => setAuditFilter(event.target.value)}
                  className="rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-black text-white outline-none ring-red-500 focus:ring-2"
                >
                  <option>All</option>
                  <option>Critical</option>
                  <option>Warning</option>
                  <option>Info</option>
                  {auditAreas.map((area) => (
                    <option key={area}>{area}</option>
                  ))}
                </select>

                <Metric label="Visible" value={filteredAuditLogs.length} helper="Filtered records" tone="purple" />
                <Metric label="Critical" value={overview.stats.criticalLogs} tone={overview.stats.criticalLogs ? "red" : "green"} />
                <Metric label="Warnings" value={overview.stats.warningLogs} tone={overview.stats.warningLogs ? "amber" : "green"} />
              </div>
            </Card>

            <Card className="p-5">
              <div className="grid max-h-[980px] gap-4 overflow-y-auto pr-2">
                {filteredAuditLogs.map((log) => (
                  <Panel key={log.id} tone={severityTone(log.severity)} className="bg-black/35">
                    <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={severityTone(log.severity)}>{log.severity}</Pill>
                          <Pill tone="purple">{log.area}</Pill>
                          <Pill tone="slate">{relativeTime(log.createdAt)}</Pill>
                        </div>
                        <h3 className="mt-3 text-lg font-black text-white">{log.title}</h3>
                        <p className="mt-2 text-sm leading-6 text-slate-400">{log.detail || "No detail recorded."}</p>
                        <div className="mt-2 text-xs font-bold text-slate-600">{log.eventType}</div>
                      </div>
                    </div>

                    <details className="mt-4 rounded-2xl border border-white/10 bg-black/35 p-3">
                      <summary className="cursor-pointer text-xs font-black uppercase tracking-[0.16em] text-slate-500">
                        Metadata
                      </summary>
                      <pre className="mt-3 max-h-[260px] overflow-y-auto whitespace-pre-wrap text-xs leading-5 text-slate-400">
                        {safeJson(log.metadataJson)}
                      </pre>
                    </details>
                  </Panel>
                ))}

                {!filteredAuditLogs.length ? (
                  <div className="rounded-3xl border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
                    No audit records match this filter.
                  </div>
                ) : null}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "controls" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-green-400">
                Security operating model
              </div>
              <h2 className="mt-2 text-3xl font-black text-white">Controls that matter for advisor adoption</h2>
              <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-400">
                The goal is not just to show security. The platform needs operational controls that advisors understand:
                approval gates, disclosure awareness, audit trail, data minimization, and safe defaults.
              </p>

              <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-3">
                {[
                  ["Data minimization", "Store only what the platform needs. Portfolio privacy matters.", "green"],
                  ["Approval gates", "Require advisor approval before sensitive delivery or client-facing output.", "cyan"],
                  ["Audit trail", "Record security, disclosure, approval, and sensitive workflow activity.", "purple"],
                  ["Session discipline", "Control session length for shared offices and advisor devices.", "amber"],
                  ["Disclosure readiness", "Keep user-facing and client-facing risk language reviewable.", "red"],
                  ["Backend readiness", "Confirm vendors, jobs, AI tools, and tenant isolation before automation.", "cyan"],
                ].map(([title, body, tone]) => (
                  <Panel key={title} tone={tone as Tone} className="bg-black/35">
                    <div className="text-sm font-black text-white">{title}</div>
                    <p className="mt-2 text-xs leading-5 text-slate-400">{body}</p>
                  </Panel>
                ))}
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
                Production checklist
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Before investor demo or advisor rollout</h2>

              <div className="mt-5 grid gap-3">
                {[
                  "Enable MFA readiness and sensitive-action reauthentication.",
                  "Accept all required disclosures.",
                  "Run Security Review and Backend Readiness checks.",
                  "Review critical and warning audit events.",
                  "Confirm email delivery remains approval-gated.",
                  "Confirm client portfolio amounts are not exposed where privacy requires symbol-only views.",
                  "Confirm AI-generated client communication is reviewed by an advisor before sending.",
                ].map((item) => (
                  <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-sm leading-6 text-slate-300">
                    {item}
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}