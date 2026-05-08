"use client";

import { FormEvent, useEffect, useMemo, useState, type ReactNode } from "react";

type PortalView =
  | "overview"
  | "leads"
  | "firms"
  | "users"
  | "intelligence"
  | "directives"
  | "audit";

type FounderUser = {
  id: string;
  name: string;
  email: string;
  createdAt: string;
  platformStatus: string;
  governanceReason: string | null;
  governedAt: string | null;
  firmMemberships: Array<{
    id: string;
    role: string;
    status: string;
    firm: {
      id: string;
      name: string;
      platformStatus: string;
    };
  }>;
};

type FounderLead = {
  id: string;
  title: string;
  leadType: string;
  priority: "Critical" | "High" | "Medium" | "Low";
  confidence: number;
  expectedUpside: string;
  summary: string;
  whyItMatters: string[];
  suggestedActions: string[];
  riskFlags: string[];
  relatedFirmIds: string[];
  relatedUserIds: string[];
  sources: Array<{
    label: string;
    sourceName: string;
    url: string | null;
    score?: number;
    capturedAt?: string | null;
  }>;
};

type FirmSummary = {
  id: string;
  name: string;
  firmEmail: string | null;
  firmCode: string;
  platformStatus: string;
  governanceReason: string | null;
  governedAt: string | null;
  createdAt: string;
  createdBy: {
    id: string;
    name: string;
    email: string;
  };
  activeMemberCount: number;
  totalMemberCount: number;
  inviteCount: number;
  projectCount: number;
  postCount: number;
  openTaskCount: number;
  completedTaskCount: number;
  highAlertCount: number;
  highDecisionCount: number;
  healthScore: number;
  executiveRead: string;
  members: Array<{
    id: string;
    role: string;
    status: string;
    canAccessPortfolios: boolean;
    canManageProjects: boolean;
    canInviteMembers: boolean;
    canManageFirm: boolean;
    user: {
      id: string;
      name: string;
      email: string;
      platformStatus: string;
      governanceReason: string | null;
    };
  }>;
  recentProjects: Array<{
    id: string;
    title: string;
    status: string;
    priority: string;
    dueDate: string | null;
    taskCount: number;
  }>;
  recentPosts: Array<{
    id: string;
    title: string;
    body: string;
    postType: string;
    createdAt: string;
  }>;
};

type AlertEvent = {
  id: string;
  userId: string;
  title: string;
  body: string;
  source: string;
  ticker: string | null;
  urgency: string;
  score: number;
  channel: string;
  status: string;
  createdAt: string;
  sourceUrl: string | null;
  aiBriefing: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type HeadlineDecision = {
  id: string;
  userId: string;
  title: string;
  summary: string | null;
  sourceName: string;
  sourceTier: string;
  category: string;
  subcategory: string;
  importanceTier: string;
  action: string;
  urgency: string;
  score: number;
  materialityScore: number;
  relevanceScore: number;
  trustScore: number;
  reasonsJson: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type Delivery = {
  id: string;
  userId: string;
  channel: string;
  status: string;
  urgency: string;
  score: number;
  title: string;
  reason: string | null;
  createdAt: string;
  deliveredAt: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type AuditLog = {
  id: string;
  userId: string;
  eventType: string;
  severity: string;
  area: string;
  title: string;
  detail: string | null;
  metadataJson: string;
  createdAt: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type FounderPortalData = {
  globalStats: {
    userCount: number;
    activeUserCount: number;
    bannedUserCount: number;
    suspendedUserCount: number;
    firmCount: number;
    activeFirmCount: number;
    bannedFirmCount: number;
    clientCount: number;
    holdingCount: number;
    portfolioValue: number;
    retainedDecisionCount: number;
    alertCount: number;
    highSignalCount: number;
    deliveryCount: number;
    auditLogCount: number;
    ventureCount: number;
    pennyStockCount: number;
  };
  firmSummaries: FirmSummary[];
  users: FounderUser[];
  recentAlerts: AlertEvent[];
  recentDecisions: HeadlineDecision[];
  recentDeliveries: Delivery[];
  recentAuditLogs: AuditLog[];
  executiveRecommendations: Array<{
    title: string;
    priority: string;
    detail: string;
  }>;
  founderLeads: FounderLead[];
  recentVentures: Array<Record<string, unknown>>;
  recentPennyStocks: Array<Record<string, unknown>>;
  configuredFounderEmails: string[];
  generatedAt: string;
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

function shortDate(value: string | null | undefined) {
  if (!value) return "—";

  return new Date(value).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function statusTone(status: string): "red" | "green" | "amber" | "slate" | "purple" {
  if (["Active", "Ready", "Complete", "Delivered", "Normal", "Low"].includes(status)) {
    return "green";
  }

  if (["Banned", "Removed", "Critical"].includes(status)) {
    return "red";
  }

  if (["Suspended", "High", "Pending"].includes(status)) {
    return "amber";
  }

  if (["Medium"].includes(status)) {
    return "purple";
  }

  return "slate";
}

function scoreTone(score: number): "red" | "green" | "amber" | "slate" | "purple" {
  if (score >= 85) return "green";
  if (score >= 70) return "purple";
  if (score >= 50) return "amber";
  return "red";
}

function priorityTone(priority: string): "red" | "green" | "amber" | "slate" | "purple" {
  if (priority === "Critical") return "red";
  if (priority === "High") return "amber";
  if (priority === "Medium") return "purple";
  if (priority === "Low") return "green";
  return "slate";
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
          Founder Intelligence Portal
        </div>
      </div>
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
            {eyebrow}
          </div>
        ) : null}
        <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
          {title}
        </h1>
        {description ? (
          <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-400">
            {description}
          </p>
        ) : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function MetricBubble({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  helper?: string;
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
        <div className="mt-2 truncate text-2xl font-black text-white">
          {value}
        </div>
        {helper ? (
          <div className="mt-1 truncate text-xs font-semibold text-slate-500">
            {helper}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ProgressBar({
  value,
  tone = "red",
}: {
  value: number;
  tone?: "red" | "green" | "amber" | "purple" | "slate";
}) {
  const fills = {
    red: "from-red-700 to-red-400",
    green: "from-emerald-700 to-emerald-300",
    amber: "from-amber-700 to-amber-300",
    purple: "from-purple-700 to-purple-300",
    slate: "from-slate-700 to-slate-300",
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/50">
      <div
        className={cx("h-full rounded-full bg-gradient-to-r", fills[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

const inputClass =
  "w-full rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition placeholder:text-slate-600 focus:ring-2";

function LeadCard({ lead }: { lead: FounderLead }) {
  return (
    <div className="rounded-[1.6rem] border border-white/10 bg-white/[0.055] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Pill tone={priorityTone(lead.priority)}>{lead.priority}</Pill>
            <Pill tone="purple">{lead.leadType}</Pill>
            <Pill tone={scoreTone(lead.confidence)}>
              Confidence {lead.confidence}
            </Pill>
          </div>

          <h3 className="mt-4 text-2xl font-black leading-snug">
            {lead.title}
          </h3>

          <p className="mt-2 text-sm leading-6 text-slate-400">
            {lead.summary}
          </p>

          <div className="mt-4 rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-sm font-bold text-emerald-100">
            {lead.expectedUpside}
          </div>
        </div>

        <div className="min-w-[220px] rounded-2xl border border-red-500/30 bg-red-500/10 p-4">
          <div className="text-xs font-black uppercase text-red-300">
            Confidence
          </div>
          <div className="mt-1 text-4xl font-black">{lead.confidence}</div>
          <div className="mt-3">
            <ProgressBar value={lead.confidence} tone={scoreTone(lead.confidence)} />
          </div>
        </div>
      </div>

      <div className="mt-5 grid gap-4 xl:grid-cols-3">
        <SoftCard>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Why it matters
          </div>
          <ul className="mt-3 space-y-2">
            {lead.whyItMatters.slice(0, 6).map((item) => (
              <li key={item} className="text-sm leading-6 text-slate-400">
                • {item}
              </li>
            ))}
          </ul>
        </SoftCard>

        <SoftCard>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
            Suggested actions
          </div>
          <ul className="mt-3 space-y-2">
            {lead.suggestedActions.slice(0, 6).map((item) => (
              <li key={item} className="text-sm leading-6 text-slate-400">
                • {item}
              </li>
            ))}
          </ul>
        </SoftCard>

        <SoftCard>
          <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
            Risk flags
          </div>
          <ul className="mt-3 space-y-2">
            {lead.riskFlags.slice(0, 6).map((item) => (
              <li key={item} className="text-sm leading-6 text-slate-400">
                • {item}
              </li>
            ))}
          </ul>
        </SoftCard>
      </div>

      <div className="mt-5 rounded-[1.4rem] border border-white/10 bg-black/30 p-4">
        <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">
          Sources
        </div>

        <div className="mt-3 grid gap-3 md:grid-cols-2">
          {lead.sources.length ? (
            lead.sources.map((source, index) => (
              <div
                key={`${source.label}-${index}`}
                className="rounded-2xl border border-white/10 bg-white/[0.045] p-3"
              >
                <div className="text-sm font-black">{source.label}</div>
                <div className="mt-1 text-xs text-slate-500">
                  {source.sourceName}
                  {source.score !== undefined ? ` · Score ${source.score}` : ""}
                </div>

                {source.url ? (
                  <a
                    href={source.url}
                    target={source.url.startsWith("/") ? "_self" : "_blank"}
                    rel="noreferrer"
                    className="mt-3 inline-flex rounded-xl bg-white px-3 py-2 text-xs font-black text-slate-950"
                  >
                    Open Source
                  </a>
                ) : (
                  <div className="mt-3 text-xs font-semibold text-slate-600">
                    Internal Slice source
                  </div>
                )}
              </div>
            ))
          ) : (
            <div className="text-sm text-slate-500">No sources attached.</div>
          )}
        </div>
      </div>
    </div>
  );
}

export default function FounderPortalPage() {
  const [data, setData] = useState<FounderPortalData | null>(null);
  const [activeView, setActiveView] = useState<PortalView>("overview");
  const [selectedFirmId, setSelectedFirmId] = useState("");
  const [directiveForm, setDirectiveForm] = useState({
    firmId: "",
    title: "",
    body: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);

  const selectedFirm = useMemo(() => {
    return data?.firmSummaries.find((firm) => firm.id === selectedFirmId) ?? null;
  }, [data?.firmSummaries, selectedFirmId]);

  const topLeads = useMemo(() => {
    return data?.founderLeads.slice(0, 6) ?? [];
  }, [data?.founderLeads]);

  async function loadPortal() {
    const response = await fetch("/api/founder-portal", {
      cache: "no-store",
    });

    const payload = await response.json();

    if (!response.ok) {
      setMessage(payload.error ?? "Unable to load founder portal.");
      return;
    }

    setData(payload);

    if (!selectedFirmId && payload.firmSummaries?.[0]?.id) {
      setSelectedFirmId(payload.firmSummaries[0].id);
      setDirectiveForm((current) => ({
        ...current,
        firmId: payload.firmSummaries[0].id,
      }));
    }
  }

  async function founderAction(
    action: string,
    payload: Record<string, unknown>,
    fallbackReason: string
  ) {
    const reason =
      window.prompt("Governance reason:", fallbackReason) || fallbackReason;

    const confirmed = window.confirm(
      `Confirm founder governance action: ${action}?`
    );

    if (!confirmed) return;

    setWorking(true);
    setMessage("");

    try {
      const response = await fetch("/api/founder-portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          reason,
          ...payload,
        }),
      });

      const next = await response.json();

      if (!response.ok) {
        setMessage(next.error ?? "Governance action failed.");
        return;
      }

      setData(next);
      setMessage(`Founder action complete: ${action}.`);
    } finally {
      setWorking(false);
    }
  }

  async function createDirective(event: FormEvent) {
    event.preventDefault();

    if (!directiveForm.firmId || !directiveForm.title || !directiveForm.body) {
      setMessage("Firm, title, and directive body are required.");
      return;
    }

    setWorking(true);
    setMessage("");

    try {
      const response = await fetch("/api/founder-portal", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "createFounderDirective",
          ...directiveForm,
          reason: "Founder directive issued.",
        }),
      });

      const next = await response.json();

      if (!response.ok) {
        setMessage(next.error ?? "Directive failed.");
        return;
      }

      setData(next);
      setDirectiveForm({
        firmId: directiveForm.firmId,
        title: "",
        body: "",
      });
      setMessage("Founder directive created.");
    } finally {
      setWorking(false);
    }
  }

  useEffect(() => {
    async function run() {
      try {
        await loadPortal();
      } finally {
        setLoading(false);
      }
    }

    void run();
  }, []);

  if (loading) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
        <div className="mx-auto max-w-[1500px]">
          <Logo />
          <div className="mt-8 text-sm font-semibold text-slate-400">
            Loading founder intelligence portal...
          </div>
        </div>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
        <div className="mx-auto max-w-3xl">
          <Logo />

          <Card className="mt-8 p-6">
            <Pill tone="red">Access blocked</Pill>
            <h1 className="mt-4 text-3xl font-black">
              Founder portal unavailable.
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {message ||
                "Make sure you are logged in with an email listed in SLICE_FOUNDER_EMAILS or use /founder-login."}
            </p>

            <div className="mt-6 flex flex-wrap gap-3">
              <a
                href="/founder-login"
                className="inline-flex rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950"
              >
                Founder Login
              </a>
              <a
                href="/workspace"
                className="inline-flex rounded-2xl bg-white/10 px-5 py-3 text-sm font-black text-white"
              >
                Workspace
              </a>
            </div>
          </Card>
        </div>
      </main>
    );
  }

  const stats = data.globalStats;

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto max-w-[1500px]">
        <header className="sticky top-4 z-40 rounded-[1.75rem] border border-white/10 bg-black/70 p-4 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <Logo />

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/founder-login"
                className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-black text-red-200 ring-1 ring-red-500/30"
              >
                Founder Login
              </a>

              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Workspace
              </a>

              <button
                onClick={() => void loadPortal()}
                disabled={working}
                className="rounded-2xl bg-red-600 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
            {[
              ["overview", "Overview"],
              ["leads", "Leads"],
              ["firms", "Firms"],
              ["users", "Users"],
              ["intelligence", "Intelligence"],
              ["directives", "Directives"],
              ["audit", "Audit"],
            ].map(([id, label]) => (
              <button
                key={id}
                type="button"
                onClick={() => setActiveView(id as PortalView)}
                className={cx(
                  "shrink-0 rounded-full px-4 py-2 text-sm font-black transition",
                  activeView === id
                    ? "bg-gradient-to-r from-red-600 to-red-950 text-white shadow-lg shadow-red-950/40"
                    : "bg-white/5 text-slate-400 hover:bg-white/10 hover:text-white"
                )}
              >
                {label}
              </button>
            ))}
          </div>
        </header>

        {message ? (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        ) : null}

        {activeView === "overview" ? (
          <section className="mt-5 grid gap-5">
            <Card className="relative p-5 md:p-6">
              <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-red-600/18 to-transparent" />

              <div className="relative">
                <SectionTitle
                  eyebrow="Founder intelligence command"
                  title="Platform governance, intelligence, and lead generation."
                  description="This portal consolidates firm behavior, user activity, investment signals, triage decisions, alerts, alternative investment activity, and source-backed recommendations into a founder-only executive decision unit."
                  action={<Pill tone="red">Founder-only</Pill>}
                />

                <div className="mt-5 grid gap-3 md:grid-cols-4">
                  <MetricBubble
                    label="Generated Leads"
                    value={data.founderLeads.length}
                    helper="Founder intelligence"
                    tone="red"
                  />
                  <MetricBubble
                    label="Firms"
                    value={stats.firmCount}
                    helper={`${stats.activeFirmCount} active`}
                    tone="purple"
                  />
                  <MetricBubble
                    label="High Signals"
                    value={stats.highSignalCount}
                    helper="Alerts + decisions"
                    tone="amber"
                  />
                  <MetricBubble
                    label="Portfolio Value"
                    value={money(stats.portfolioValue)}
                    helper="Tracked across users"
                    tone="green"
                  />
                </div>
              </div>
            </Card>

            <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
              <Card className="p-5">
                <SectionTitle
                  eyebrow="Top founder leads"
                  title="Most important current recommendations"
                  description="These are generated from cross-firm data, alerts, triage decisions, operating behavior, and alternative investment activity."
                />

                <div className="mt-5 grid gap-4">
                  {topLeads.length ? (
                    topLeads.map((lead) => <LeadCard key={lead.id} lead={lead} />)
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                      No founder leads generated yet. More firm activity,
                      alerts, triage decisions, and alternative records will
                      improve recommendations.
                    </div>
                  )}
                </div>
              </Card>

              <div className="grid gap-5">
                <Card className="p-5">
                  <SectionTitle
                    eyebrow="Executive recommendations"
                    title="Founder decision prompts"
                    description="Automatically synthesized platform-level items that may need executive attention."
                  />

                  <div className="mt-5 grid gap-3">
                    {data.executiveRecommendations.map((item) => (
                      <SoftCard key={item.title}>
                        <div className="flex items-start justify-between gap-4">
                          <div>
                            <div className="text-base font-black">
                              {item.title}
                            </div>
                            <p className="mt-1 text-sm leading-6 text-slate-400">
                              {item.detail}
                            </p>
                          </div>
                          <Pill tone={statusTone(item.priority)}>
                            {item.priority}
                          </Pill>
                        </div>
                      </SoftCard>
                    ))}
                  </div>
                </Card>

                <Card className="p-5">
                  <SectionTitle
                    eyebrow="Governance snapshot"
                    title="Restrictions and risk controls"
                    description="Current state of platform-wide access and founder governance."
                  />

                  <div className="mt-5 grid gap-3 md:grid-cols-2">
                    <MetricBubble
                      label="Banned Users"
                      value={stats.bannedUserCount}
                      helper="Platform blocked"
                      tone="red"
                    />
                    <MetricBubble
                      label="Suspended Users"
                      value={stats.suspendedUserCount}
                      helper="Restricted"
                      tone="amber"
                    />
                    <MetricBubble
                      label="Banned Firms"
                      value={stats.bannedFirmCount}
                      helper="Firm-level block"
                      tone="red"
                    />
                    <MetricBubble
                      label="Audit Logs"
                      value={stats.auditLogCount}
                      helper="Recent governance"
                      tone="purple"
                    />
                  </div>
                </Card>
              </div>
            </section>

            <section className="grid gap-5 xl:grid-cols-4 md:grid-cols-2">
              <MetricBubble
                label="Clients"
                value={stats.clientCount}
                helper="Across platform"
                tone="green"
              />
              <MetricBubble
                label="Holdings"
                value={stats.holdingCount}
                helper="Tracked assets"
                tone="purple"
              />
              <MetricBubble
                label="Ventures"
                value={stats.ventureCount}
                helper="Alternative records"
                tone="amber"
              />
              <MetricBubble
                label="Penny Stocks"
                value={stats.pennyStockCount}
                helper="High-risk watchlist"
                tone="red"
              />
            </section>
          </section>
        ) : null}

        {activeView === "leads" ? (
          <section className="mt-5 grid gap-5">
            <Card className="p-5">
              <SectionTitle
                eyebrow="Founder lead engine"
                title="Source-backed platform recommendations"
                description="Each lead includes confidence scoring, expected upside, why it matters, suggested actions, risk flags, and source records."
              />

              <div className="mt-5 grid gap-5">
                {data.founderLeads.length ? (
                  data.founderLeads.map((lead) => (
                    <LeadCard key={lead.id} lead={lead} />
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                    No founder leads generated yet.
                  </div>
                )}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "firms" ? (
          <section className="mt-5 grid gap-5">
            <Card className="p-5">
              <SectionTitle
                eyebrow="Firm intelligence"
                title="Firm-level governance and health"
                description="Review every firm, its operating health, members, projects, alerts, and governance state."
              />

              <div className="mt-5 grid gap-4">
                {data.firmSummaries.map((firm) => (
                  <div
                    key={firm.id}
                    className="rounded-[1.6rem] border border-white/10 bg-white/[0.055] p-5"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={statusTone(firm.platformStatus)}>
                            {firm.platformStatus}
                          </Pill>
                          <Pill tone={scoreTone(firm.healthScore)}>
                            Health {firm.healthScore}
                          </Pill>
                        </div>

                        <h2 className="mt-3 text-2xl font-black">
                          {firm.name}
                        </h2>
                        <p className="mt-1 text-sm text-slate-500">
                          Created by {firm.createdBy.name} ·{" "}
                          {shortDate(firm.createdAt)}
                        </p>
                        <p className="mt-3 text-sm leading-6 text-slate-400">
                          {firm.executiveRead}
                        </p>

                        {firm.governanceReason ? (
                          <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-sm font-bold text-red-200">
                            {firm.governanceReason}
                          </div>
                        ) : null}
                      </div>

                      <div className="grid min-w-[260px] gap-3">
                        <div>
                          <div className="mb-2 flex justify-between text-xs font-black uppercase text-slate-500">
                            <span>Health</span>
                            <span>{firm.healthScore}/100</span>
                          </div>
                          <ProgressBar
                            value={firm.healthScore}
                            tone={scoreTone(firm.healthScore)}
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-2">
                          <SoftCard>
                            <div className="text-xs text-slate-500">
                              Members
                            </div>
                            <div className="text-xl font-black">
                              {firm.activeMemberCount}
                            </div>
                          </SoftCard>
                          <SoftCard>
                            <div className="text-xs text-slate-500">
                              Projects
                            </div>
                            <div className="text-xl font-black">
                              {firm.projectCount}
                            </div>
                          </SoftCard>
                        </div>
                      </div>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-4">
                      <MetricBubble
                        label="Open Tasks"
                        value={firm.openTaskCount}
                        helper="Execution load"
                        tone="amber"
                      />
                      <MetricBubble
                        label="Completed"
                        value={firm.completedTaskCount}
                        helper="Finished work"
                        tone="green"
                      />
                      <MetricBubble
                        label="High Alerts"
                        value={firm.highAlertCount}
                        helper="Recent alert load"
                        tone="red"
                      />
                      <MetricBubble
                        label="High Decisions"
                        value={firm.highDecisionCount}
                        helper="Recent triage signal"
                        tone="purple"
                      />
                    </div>

                    <div className="mt-5 flex flex-wrap gap-2">
                      {firm.platformStatus === "Active" ? (
                        <button
                          disabled={working}
                          onClick={() =>
                            founderAction(
                              "banFirm",
                              { firmId: firm.id },
                              "Firm banned by founder governance."
                            )
                          }
                          className="rounded-2xl bg-red-500/10 px-4 py-2 text-xs font-black text-red-200 ring-1 ring-red-500/30 disabled:opacity-60"
                        >
                          Ban Firm
                        </button>
                      ) : (
                        <button
                          disabled={working}
                          onClick={() =>
                            founderAction(
                              "restoreFirm",
                              { firmId: firm.id },
                              "Firm restored by founder governance."
                            )
                          }
                          className="rounded-2xl bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-200 ring-1 ring-emerald-500/30 disabled:opacity-60"
                        >
                          Restore Firm
                        </button>
                      )}

                      <button
                        onClick={() => {
                          setSelectedFirmId(firm.id);
                          setDirectiveForm((current) => ({
                            ...current,
                            firmId: firm.id,
                          }));
                          setActiveView("directives");
                        }}
                        className="rounded-2xl bg-white px-4 py-2 text-xs font-black text-slate-950"
                      >
                        Send Directive
                      </button>
                    </div>

                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {firm.members.map((member) => (
                        <SoftCard key={member.id}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate text-sm font-black">
                                {member.user.name}
                              </div>
                              <div className="truncate text-xs text-slate-500">
                                {member.user.email}
                              </div>
                              <div className="mt-2 flex flex-wrap gap-2">
                                <Pill tone="slate">{member.role}</Pill>
                                <Pill tone={statusTone(member.status)}>
                                  {member.status}
                                </Pill>
                                <Pill tone={statusTone(member.user.platformStatus)}>
                                  {member.user.platformStatus}
                                </Pill>
                              </div>
                            </div>

                            <div className="flex shrink-0 flex-col gap-2">
                              {member.status === "Active" ? (
                                <button
                                  disabled={working}
                                  onClick={() =>
                                    founderAction(
                                      "removeMember",
                                      { membershipId: member.id },
                                      "Member removed by founder governance."
                                    )
                                  }
                                  className="rounded-xl bg-red-500/10 px-3 py-2 text-[11px] font-black text-red-200 ring-1 ring-red-500/30 disabled:opacity-60"
                                >
                                  Remove
                                </button>
                              ) : (
                                <button
                                  disabled={working}
                                  onClick={() =>
                                    founderAction(
                                      "restoreMember",
                                      { membershipId: member.id },
                                      "Member restored by founder governance."
                                    )
                                  }
                                  className="rounded-xl bg-emerald-500/10 px-3 py-2 text-[11px] font-black text-emerald-200 ring-1 ring-emerald-500/30 disabled:opacity-60"
                                >
                                  Restore
                                </button>
                              )}
                            </div>
                          </div>
                        </SoftCard>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "users" ? (
          <section className="mt-5 grid gap-5">
            <Card className="p-5">
              <SectionTitle
                eyebrow="User governance"
                title="Platform users"
                description="Ban, restore, or clear sessions for any user. Banning removes firm memberships and deletes active sessions."
              />

              <div className="mt-5 grid gap-3">
                {data.users.map((user) => (
                  <SoftCard key={user.id}>
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                      <div className="min-w-0">
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={statusTone(user.platformStatus)}>
                            {user.platformStatus}
                          </Pill>
                          <Pill tone="slate">
                            {user.firmMemberships.length} membership(s)
                          </Pill>
                        </div>

                        <h3 className="mt-3 text-lg font-black">
                          {user.name}
                        </h3>
                        <div className="mt-1 text-sm text-slate-500">
                          {user.email}
                        </div>
                        <div className="mt-1 text-xs text-slate-600">
                          Joined {shortDate(user.createdAt)}
                        </div>

                        {user.governanceReason ? (
                          <div className="mt-3 rounded-2xl border border-red-500/30 bg-red-500/10 p-3 text-xs font-bold text-red-200">
                            {user.governanceReason}
                          </div>
                        ) : null}
                      </div>

                      <div className="flex flex-wrap gap-2">
                        {user.platformStatus === "Active" ? (
                          <button
                            disabled={working}
                            onClick={() =>
                              founderAction(
                                "banUser",
                                { userId: user.id },
                                "User banned by founder governance."
                              )
                            }
                            className="rounded-2xl bg-red-500/10 px-4 py-2 text-xs font-black text-red-200 ring-1 ring-red-500/30 disabled:opacity-60"
                          >
                            Ban User
                          </button>
                        ) : (
                          <button
                            disabled={working}
                            onClick={() =>
                              founderAction(
                                "restoreUser",
                                { userId: user.id },
                                "User restored by founder governance."
                              )
                            }
                            className="rounded-2xl bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-200 ring-1 ring-emerald-500/30 disabled:opacity-60"
                          >
                            Restore User
                          </button>
                        )}

                        <button
                          disabled={working}
                          onClick={() =>
                            founderAction(
                              "clearUserSessions",
                              { userId: user.id },
                              "Founder cleared active sessions."
                            )
                          }
                          className="rounded-2xl bg-white/10 px-4 py-2 text-xs font-black text-white ring-1 ring-white/10 disabled:opacity-60"
                        >
                          Clear Sessions
                        </button>
                      </div>
                    </div>
                  </SoftCard>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "intelligence" ? (
          <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
            <Card className="p-5">
              <SectionTitle
                eyebrow="Signals"
                title="Top alerts"
                description="Highest recent alert events across platform users."
              />

              <div className="mt-5 grid gap-3">
                {data.recentAlerts.slice(0, 25).map((alert) => (
                  <SoftCard key={alert.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={statusTone(alert.urgency)}>
                            {alert.urgency}
                          </Pill>
                          <Pill tone="red">{alert.score}</Pill>
                        </div>
                        <h3 className="mt-3 text-sm font-black">
                          {alert.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                          {alert.body}
                        </p>
                        <div className="mt-2 text-xs text-slate-500">
                          {alert.user.email} · {alert.source}
                        </div>
                      </div>
                    </div>
                  </SoftCard>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle
                eyebrow="Ranked triage"
                title="Top decisions"
                description="Highest recent retained decisions across platform users."
              />

              <div className="mt-5 grid gap-3">
                {data.recentDecisions.slice(0, 25).map((decision) => (
                  <SoftCard key={decision.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={statusTone(decision.urgency)}>
                            {decision.urgency}
                          </Pill>
                          <Pill tone="red">{decision.score}</Pill>
                          <Pill tone="purple">{decision.category}</Pill>
                        </div>
                        <h3 className="mt-3 text-sm font-black">
                          {decision.title}
                        </h3>
                        <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                          {decision.summary || "No summary stored."}
                        </p>
                        <div className="mt-2 text-xs text-slate-500">
                          {decision.user.email} · {decision.sourceName}
                        </div>
                      </div>
                    </div>
                  </SoftCard>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "directives" ? (
          <section className="mt-5 grid gap-5 xl:grid-cols-[0.75fr_1.25fr]">
            <Card className="p-5">
              <SectionTitle
                eyebrow="Founder directive"
                title="Send executive instruction"
                description="Create a founder directive visible in a firm’s post/update stream."
              />

              <form onSubmit={createDirective} className="mt-5 space-y-4">
                <select
                  value={directiveForm.firmId}
                  onChange={(event) =>
                    setDirectiveForm((current) => ({
                      ...current,
                      firmId: event.target.value,
                    }))
                  }
                  className={inputClass}
                >
                  <option value="">Select firm</option>
                  {data.firmSummaries.map((firm) => (
                    <option key={firm.id} value={firm.id}>
                      {firm.name}
                    </option>
                  ))}
                </select>

                <input
                  value={directiveForm.title}
                  onChange={(event) =>
                    setDirectiveForm((current) => ({
                      ...current,
                      title: event.target.value,
                    }))
                  }
                  className={inputClass}
                  placeholder="Directive title"
                />

                <textarea
                  value={directiveForm.body}
                  onChange={(event) =>
                    setDirectiveForm((current) => ({
                      ...current,
                      body: event.target.value,
                    }))
                  }
                  className={cx(inputClass, "min-h-40")}
                  placeholder="Directive body"
                />

                <button
                  disabled={working}
                  className="w-full rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-5 py-4 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
                >
                  Send Founder Directive
                </button>
              </form>
            </Card>

            <Card className="p-5">
              <SectionTitle
                eyebrow="Firm context"
                title={selectedFirm?.name ?? "Select a firm"}
                description={
                  selectedFirm?.executiveRead ??
                  "Choose a firm to view context before sending a directive."
                }
              />

              {selectedFirm ? (
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <MetricBubble
                    label="Health"
                    value={selectedFirm.healthScore}
                    helper="Founder score"
                    tone={scoreTone(selectedFirm.healthScore)}
                  />
                  <MetricBubble
                    label="Members"
                    value={selectedFirm.activeMemberCount}
                    helper="Active"
                    tone="green"
                  />
                  <MetricBubble
                    label="Open Tasks"
                    value={selectedFirm.openTaskCount}
                    helper="Execution"
                    tone="amber"
                  />
                  <MetricBubble
                    label="High Alerts"
                    value={selectedFirm.highAlertCount}
                    helper="Recent"
                    tone="red"
                  />
                </div>
              ) : null}
            </Card>
          </section>
        ) : null}

        {activeView === "audit" ? (
          <section className="mt-5 grid gap-5 xl:grid-cols-[1fr_1fr]">
            <Card className="p-5">
              <SectionTitle
                eyebrow="Deliveries"
                title="Recent notification delivery records"
                description="Shows queued, delivered, and suppressed delivery activity."
              />

              <div className="mt-5 grid gap-3">
                {data.recentDeliveries.map((delivery) => (
                  <SoftCard key={delivery.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={statusTone(delivery.status)}>
                            {delivery.status}
                          </Pill>
                          <Pill tone="slate">{delivery.channel}</Pill>
                          <Pill tone="red">{delivery.score}</Pill>
                        </div>
                        <h3 className="mt-3 text-sm font-black">
                          {delivery.title}
                        </h3>
                        <div className="mt-2 text-xs text-slate-500">
                          {delivery.user.email} · {shortDate(delivery.createdAt)}
                        </div>
                      </div>
                    </div>
                  </SoftCard>
                ))}
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle
                eyebrow="Audit logs"
                title="Recent platform audit trail"
                description="Governance and operational activity."
              />

              <div className="mt-5 grid gap-3">
                {data.recentAuditLogs.map((log) => (
                  <SoftCard key={log.id}>
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={statusTone(log.severity)}>
                            {log.severity}
                          </Pill>
                          <Pill tone="purple">{log.area}</Pill>
                        </div>
                        <h3 className="mt-3 text-sm font-black">
                          {log.title}
                        </h3>
                        {log.detail ? (
                          <p className="mt-1 text-xs leading-5 text-slate-400">
                            {log.detail}
                          </p>
                        ) : null}
                        <div className="mt-2 text-xs text-slate-500">
                          {log.user.email} · {shortDate(log.createdAt)}
                        </div>
                      </div>
                    </div>
                  </SoftCard>
                ))}
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}