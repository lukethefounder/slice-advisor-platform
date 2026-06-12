"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";
import TeamBoardEmbedded from "@/components/workspace/team-board-embedded";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";

type IconName =
  | "brain"
  | "spark"
  | "team"
  | "calendar"
  | "client"
  | "mail"
  | "bell"
  | "market"
  | "signal"
  | "portfolio"
  | "compare"
  | "diamond"
  | "report"
  | "shield"
  | "system"
  | "radar"
  | "target"
  | "flow"
  | "chart"
  | "lock";

type Tab =
  | "overview"
  | "command"
  | "team-board"
  | "firm-calendar"
  | "clients"
  | "emails"
  | "watchlists"
  | "intelligence"
  | "portfolio"
  | "comparison"
  | "alternatives"
  | "briefings"
  | "notifications"
  | "compliance"
  | "security"
  | "system";

type User = {
  id: string;
  name: string;
  email: string;
};

type Firm = {
  id: string;
  name: string;
  firmEmail: string | null;
  firmCode: string;
};

type Membership = {
  id: string;
  firmId: string;
  userId: string;
  role: string;
  status: string;
  calendarColor: string;
  canAccessPortfolios: boolean;
  canManageProjects: boolean;
  canInviteMembers: boolean;
  canManageFirm: boolean;
  user?: User;
  firm?: Firm;
};

type Project = {
  id: string;
  title: string;
  description: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  agendaTasks?: Array<{ id: string; status: string }>;
  assignments?: Array<{
    id: string;
    projectRole: string;
    membership: Membership;
  }>;
};

type AgendaTask = {
  id: string;
  projectId: string | null;
  title: string;
  detail: string | null;
  status: string;
  priority: string;
  dueDate: string | null;
  delayReason?: string | null;
  inquiry?: string | null;
  project?: Project | null;
  comments?: Array<{
    id: string;
    body: string;
    commentType: string;
    createdAt: string;
    user: User;
  }>;
};

type CalendarTask = AgendaTask & {
  agendaTitle?: string;
  weekStart?: string;
  ownerName?: string;
  ownerColor?: string;
  ownerId?: string;
  ownerUserId?: string;
};

type Agenda = {
  id: string;
  weekStart: string;
  title: string;
  focus: string | null;
  blockers: string | null;
  status: string;
  membership: Membership;
  tasks: AgendaTask[];
};

type FirmPost = {
  id: string;
  title: string;
  body: string;
  postType: string;
  createdAt: string;
  project: Project | null;
  authorMembership: Membership | null;
  fileLinks?: string[];
  mentions?: string[];
  ideaStatus?: string;
  votes?: number;
};

type DashboardNotification = {
  id: string;
  title: string;
  body: string;
  urgency: string;
  score: number;
  status: string;
  createdAt: string;
};

type FirmWorkspace = {
  firms: Array<Firm & { membership: Membership }>;
  firm: Firm | null;
  membership: Membership | null;
  members: Membership[];
  invites: unknown[];
  projects: Project[];
  agendas: Agenda[];
  posts: FirmPost[];
  operations?: {
    scrumStatuses: string[];
    allTasks: CalendarTask[];
    calendarTasks: CalendarTask[];
    unifiedMessages: FirmPost[];
    ideaBoard: FirmPost[];
    projectDeadlines: Array<
      Project & {
        dueStatus: string;
        assignedNames: string[];
      }
    >;
    timedReminders: Array<{
      id: string;
      body: string;
      commentType: string;
      createdAt: string;
      taskId: string;
      taskTitle: string;
      ownerName?: string;
      dueDate?: string | null;
    }>;
    openNotifications: DashboardNotification[];
    sprintMetrics: {
      total: number;
      open: number;
      inProgress: number;
      review: number;
      blocked: number;
      complete: number;
      overdue: number;
      ideas: number;
      deadlines: number;
      timedReminders: number;
    };
  };
};

type CommandOverview = {
  readinessScore: number;
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
    portfolioTotalValue: number;
    firmCount?: number;
    ownedFirmCount?: number;
    firmProjectCount?: number;
    firmAgendaCount?: number;
    firmAgendaTaskCount?: number;
    firmPostCount?: number;
    acceptedDisclosures?: number;
    requiredDisclosures?: number;
  };
};

type BackendKernelSummary = {
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
  message?: string;
};

type ModuleCardConfig = {
  id: string;
  title: string;
  subtitle: string;
  description: string;
  tone: Tone;
  icon: IconName;
  href: string;
  button: string;
  category: string;
  meta?: Array<[string, string | number]>;
};

type ComplianceControl = {
  id: string;
  title: string;
  ruleArea: string;
  status: "Active" | "Advisor Review" | "Compliance Review" | "Needs Firm Policy" | "Production Wiring";
  tone: Tone;
  summary: string;
  evidence: string;
};

type ComplianceGate = {
  id: string;
  title: string;
  trigger: string;
  action: string;
  tone: Tone;
};

const EMPTY_COMMAND: CommandOverview = {
  readinessScore: 0,
  counts: {
    watchlistCount: 0,
    ventureCount: 0,
    goalCount: 0,
    researchCount: 0,
    unreadAlertCount: 0,
    totalAlertCount: 0,
    clientCount: 0,
    openTaskCount: 0,
    briefingCount: 0,
    retainedDecisionCount: 0,
    triageRunCount: 0,
    deliveryCount: 0,
    digestCount: 0,
    auditLogCount: 0,
    accountCount: 0,
    holdingCount: 0,
    modelCount: 0,
    portfolioTotalValue: 0,
    firmCount: 0,
    ownedFirmCount: 0,
    firmProjectCount: 0,
    firmAgendaCount: 0,
    firmAgendaTaskCount: 0,
    firmPostCount: 0,
    acceptedDisclosures: 0,
    requiredDisclosures: 0,
  },
};

const EMPTY_FIRM_WORKSPACE: FirmWorkspace = {
  firms: [],
  firm: null,
  membership: null,
  members: [],
  invites: [],
  projects: [],
  agendas: [],
  posts: [],
  operations: {
    scrumStatuses: ["Backlog", "To Do", "In Progress", "Review", "Blocked", "Complete"],
    allTasks: [],
    calendarTasks: [],
    unifiedMessages: [],
    ideaBoard: [],
    projectDeadlines: [],
    timedReminders: [],
    openNotifications: [],
    sprintMetrics: {
      total: 0,
      open: 0,
      inProgress: 0,
      review: 0,
      blocked: 0,
      complete: 0,
      overdue: 0,
      ideas: 0,
      deadlines: 0,
      timedReminders: 0,
    },
  },
};

const SLICE_COMPLIANCE_PROFILE = {
  readinessScore: 84,
  positioning:
    "Slice is an advisor workflow, intelligence, supervision, and documentation layer. It helps advisors move faster, but it should not replace the advisor, supervisor, CCO, firm policy, legal counsel, or regulatory review process.",
  noAutoSendRule:
    "AI may draft, summarize, rank, and prepare. It should not automatically send client-specific advice, trade instructions, performance advertising, testimonials, endorsements, private investment opportunities, or recommendation language without human approval.",
  controls: [
    {
      id: "human-review",
      title: "Human approval before client delivery",
      ruleArea: "Advisor supervision",
      status: "Active",
      tone: "green",
      summary:
        "Client-facing communications are treated as drafts until reviewed by the advisor, supervisor, or compliance depending on risk.",
      evidence:
        "AI output is positioned as preparation, not final advice or automatic delivery.",
    },
    {
      id: "books-records",
      title: "Books-and-records package",
      ruleArea: "Record retention",
      status: "Active",
      tone: "green",
      summary:
        "Drafts, final text, source packages, approval decisions, delivery metadata, and recommendation rationale should be retained.",
      evidence:
        "Workspace counts retained decisions, audit logs, briefings, deliveries, and required disclosures.",
    },
    {
      id: "marketing-review",
      title: "Marketing and performance pre-clearance",
      ruleArea: "Marketing Rule",
      status: "Compliance Review",
      tone: "amber",
      summary:
        "Testimonials, endorsements, third-party ratings, performance claims, hypothetical performance, and public/prospect content require compliance review.",
      evidence:
        "Reports, briefings, email, and AI-generated output are labeled as approval-gated.",
    },
    {
      id: "privacy-pii",
      title: "Client data minimization",
      ruleArea: "Privacy / customer information",
      status: "Production Wiring",
      tone: "amber",
      summary:
        "Client identifiers, account details, tax details, and personal information should be minimized in AI prompts and routed through approved systems.",
      evidence:
        "Client and portfolio descriptions avoid exposing allocation details in the workspace copy.",
    },
    {
      id: "ai-governance",
      title: "AI prompt and output governance",
      ruleArea: "AI / vendor oversight",
      status: "Needs Firm Policy",
      tone: "cyan",
      summary:
        "Prompt, output, model/vendor, source basis, reviewer, edits, and final decision should be logged before production use.",
      evidence:
        "AI Studio is framed as advisor-ready preparation, not autonomous regulated advice.",
    },
    {
      id: "source-substantiation",
      title: "Source-backed claims",
      ruleArea: "Substantiation",
      status: "Active",
      tone: "green",
      summary:
        "Market alerts, client briefings, and opportunity items should preserve source links and rationale before an advisor uses them.",
      evidence:
        "Intelligence, radar, and briefings are described as source-backed and retained.",
    },
  ] satisfies ComplianceControl[],
  communicationGates: [
    {
      id: "recommendation-gate",
      title: "Recommendation language",
      trigger:
        "Mentions buy, sell, rebalance, allocate, switch, reduce, increase, suitability, or specific securities advice.",
      action:
        "Require advisor review, client objective context, suitability/risk rationale, and retained source package.",
      tone: "red",
    },
    {
      id: "performance-gate",
      title: "Performance or projection language",
      trigger:
        "Mentions past performance, backtests, forecasts, expected return, alpha, win rate, or model performance.",
      action:
        "Require compliance review, assumptions, net/gross treatment, time period, risks, limitations, and substantiation.",
      tone: "amber",
    },
    {
      id: "marketing-gate",
      title: "Prospect or public-facing material",
      trigger:
        "Anything used for websites, social posts, public campaigns, prospect emails, seminars, ads, or general promotion.",
      action:
        "Route through marketing review before use and retain final version plus approval evidence.",
      tone: "amber",
    },
    {
      id: "testimonial-gate",
      title: "Testimonials, endorsements, and ratings",
      trigger:
        "Client reviews, third-party ratings, paid promoters, referral quotes, five-star language, or endorsement claims.",
      action:
        "Require compliance review for disclosure, compensation, conflicts, oversight, written agreement, and disqualification checks.",
      tone: "red",
    },
    {
      id: "privacy-gate",
      title: "Client PII or nonpublic personal information",
      trigger:
        "Names, emails, account data, tax facts, estate details, SSNs, birth dates, custodial information, or household financial facts.",
      action:
        "Minimize, permission, route through approved channels, and record privacy handling.",
      tone: "purple",
    },
  ] satisfies ComplianceGate[],
  booksAndRecordsPackage: [
    "Original AI prompt",
    "AI output",
    "Human edits",
    "Final approved version",
    "Source links and documents",
    "Assumptions and calculations",
    "Recommendation rationale",
    "Reviewer name, role, and timestamp",
    "Approval or rejection decision",
    "Delivery channel and recipient metadata",
  ],
  aiGuardrails: [
    "AI output is draft-only until reviewed.",
    "No client-specific recommendation should be sent without advisor approval.",
    "No trade instruction should be sent without firm-approved workflow controls.",
    "No marketing, testimonial, rating, or performance content should bypass compliance.",
    "Every claim should be source-backed or labeled as internal analysis.",
    "Prompt and output records should be retained in production.",
  ],
  prohibitedAutomations: [
    "Auto-send investment recommendations",
    "Auto-send trade instructions",
    "Auto-send performance advertising",
    "Auto-send testimonials or endorsements",
    "Auto-send private investment opportunities",
    "Use personal email or SMS without approved archiving",
    "Delete drafts, source packages, or approval logs before retention period",
  ],
};

const tabs: Array<{
  id: Tab;
  label: string;
  compact: string;
  description: string;
  icon: IconName;
  tone: Tone;
  group: string;
}> = [
  { id: "overview", label: "Daily Brain", compact: "Brain", description: "Advisor home", icon: "brain", tone: "red", group: "Command" },
  { id: "command", label: "AI Command", compact: "AI", description: "Ask + build", icon: "spark", tone: "cyan", group: "Command" },
  { id: "team-board", label: "Team Board", compact: "Team", description: "Delegate", icon: "team", tone: "green", group: "Firm" },
  { id: "firm-calendar", label: "Calendar", compact: "Calendar", description: "Due dates", icon: "calendar", tone: "purple", group: "Firm" },
  { id: "clients", label: "Clients", compact: "Clients", description: "CRM", icon: "client", tone: "purple", group: "Advisor" },
  { id: "emails", label: "Email Center", compact: "Email", description: "Draft/review", icon: "mail", tone: "green", group: "Advisor" },
  { id: "notifications", label: "Alerts", compact: "Alerts", description: "Delivery", icon: "bell", tone: "amber", group: "Advisor" },
  { id: "watchlists", label: "Markets", compact: "Markets", description: "Visuals", icon: "market", tone: "amber", group: "Markets" },
  { id: "intelligence", label: "Intelligence", compact: "Intel", description: "Signals", icon: "signal", tone: "red", group: "Markets" },
  { id: "portfolio", label: "Portfolio", compact: "Portfolio", description: "Holdings", icon: "portfolio", tone: "green", group: "Markets" },
  { id: "comparison", label: "Compare", compact: "Compare", description: "Risk", icon: "compare", tone: "slate", group: "Markets" },
  { id: "alternatives", label: "Alternatives", compact: "Alts", description: "Private", icon: "diamond", tone: "amber", group: "Markets" },
  { id: "briefings", label: "Reports", compact: "Reports", description: "Client output", icon: "report", tone: "cyan", group: "Research" },
  { id: "compliance", label: "Compliance", compact: "Compliance", description: "Review gates", icon: "shield", tone: "red", group: "System" },
  { id: "security", label: "Security", compact: "Security", description: "Audit", icon: "shield", tone: "red", group: "System" },
  { id: "system", label: "System", compact: "System", description: "Kernel", icon: "system", tone: "cyan", group: "System" },
];

const toneClasses: Record<Tone, string> = {
  red: "border-red-500/25 bg-red-500/10 text-red-100 shadow-red-950/20",
  green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100 shadow-emerald-950/20",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-100 shadow-amber-950/20",
  purple: "border-purple-500/25 bg-purple-500/10 text-purple-100 shadow-purple-950/20",
  cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100 shadow-cyan-950/20",
  slate: "border-slate-500/20 bg-slate-500/10 text-slate-100 shadow-slate-950/20",
};

const glowClasses: Record<Tone, string> = {
  red: "from-red-500/18",
  green: "from-emerald-500/18",
  amber: "from-amber-500/18",
  purple: "from-purple-500/18",
  cyan: "from-cyan-500/18",
  slate: "from-slate-400/10",
};

const toneDot: Record<Tone, string> = {
  red: "bg-red-400 shadow-red-400/50",
  green: "bg-emerald-400 shadow-emerald-400/50",
  amber: "bg-amber-400 shadow-amber-400/50",
  purple: "bg-purple-400 shadow-purple-400/50",
  cyan: "bg-cyan-400 shadow-cyan-400/50",
  slate: "bg-slate-400 shadow-slate-400/50",
};

const toneText: Record<Tone, string> = {
  red: "text-red-300",
  green: "text-emerald-300",
  amber: "text-amber-300",
  purple: "text-purple-300",
  cyan: "text-cyan-300",
  slate: "text-slate-300",
};

const toneSoft: Record<Tone, string> = {
  red: "bg-red-500/10 border-red-500/20",
  green: "bg-emerald-500/10 border-emerald-500/20",
  amber: "bg-amber-500/10 border-amber-500/20",
  purple: "bg-purple-500/10 border-purple-500/20",
  cyan: "bg-cyan-500/10 border-cyan-500/20",
  slate: "bg-slate-500/10 border-slate-500/20",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseWorkspaceTab(value: string | null): Tab | null {
  if (!value) return null;
  return tabs.some((tab) => tab.id === value) ? (value as Tab) : null;
}

function money(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value || 0);
}

function percent(value: number) {
  return `${Math.max(0, Math.min(100, Math.round(value || 0)))}%`;
}

function ymd(date: Date) {
  return date.toISOString().slice(0, 10);
}

function toDate(dateString: string) {
  return new Date(`${dateString}T00:00:00`);
}

function addDays(dateString: string, days: number) {
  const date = toDate(dateString);
  date.setDate(date.getDate() + days);
  return ymd(date);
}

function addMonths(dateString: string, months: number) {
  const date = toDate(dateString);
  date.setMonth(date.getMonth() + months);
  return ymd(date);
}

function startOfWeek(dateString: string) {
  const date = toDate(dateString);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  date.setDate(diff);
  return ymd(date);
}

function monthStart(dateString: string) {
  const date = toDate(dateString);
  date.setDate(1);
  return ymd(date);
}

function calendarMonthDays(anchorDate: string) {
  const start = toDate(monthStart(anchorDate));
  const firstGridDay = startOfWeek(ymd(start));
  return Array.from({ length: 42 }).map((_, index) => addDays(firstGridDay, index));
}

function shortDate(dateString: string | null | undefined) {
  if (!dateString) return "No date";
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

function dayLabel(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

function monthTitle(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    month: "long",
    year: "numeric",
  });
}

function monthDayLabel(dateString: string) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-US", {
    day: "numeric",
  });
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function completeStatus(status: string) {
  return status === "Complete" || status === "Done";
}

function priorityTone(priority: string): Tone {
  if (priority === "High" || priority === "Critical" || priority === "Urgent") return "red";
  if (priority === "Medium") return "amber";
  if (priority === "Low") return "green";
  return "slate";
}

function toneFor(value: string | null | undefined): Tone {
  const lower = String(value ?? "").toLowerCase();

  if (
    lower.includes("complete") ||
    lower.includes("done") ||
    lower.includes("active") ||
    lower.includes("ready") ||
    lower.includes("configured") ||
    lower.includes("healthy") ||
    lower.includes("approved") ||
    lower.includes("delivered")
  ) {
    return "green";
  }

  if (
    lower.includes("missing") ||
    lower.includes("failed") ||
    lower.includes("critical") ||
    lower.includes("blocked") ||
    lower.includes("high") ||
    lower.includes("overdue")
  ) {
    return "red";
  }

  if (
    lower.includes("open") ||
    lower.includes("pending") ||
    lower.includes("queued") ||
    lower.includes("planned") ||
    lower.includes("watch") ||
    lower.includes("progress") ||
    lower.includes("review") ||
    lower.includes("medium") ||
    lower.includes("today") ||
    lower.includes("soon")
  ) {
    return "amber";
  }

  if (lower.includes("ai") || lower.includes("portfolio") || lower.includes("alternative") || lower.includes("idea")) return "purple";
  if (lower.includes("backend") || lower.includes("system") || lower.includes("kernel") || lower.includes("chat")) return "cyan";

  return "slate";
}

function advisorReadinessLabel(score: number) {
  if (score >= 85) return "Institutional";
  if (score >= 75) return "Ready";
  if (score >= 55) return "Needs review";
  return "Setup needed";
}

function getComplianceTone(score: number): Tone {
  if (score >= 80) return "green";
  if (score >= 65) return "amber";
  return "red";
}

function getActiveComplianceControlCount() {
  return SLICE_COMPLIANCE_PROFILE.controls.filter((control) => control.status === "Active").length;
}

function IconSvg({ name }: { name: IconName }) {
  const common = "stroke-current";
  const strokeProps = {
    fill: "none",
    strokeWidth: 1.8,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
  };

  if (name === "brain") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M9 4.5C7.3 4 5.5 5.2 5.4 7.1C3.9 7.5 3 8.8 3 10.3c0 1.2.6 2.2 1.5 2.8C4.2 15.2 5.8 17 8 17h1" />
        <path d="M15 4.5c1.7-.5 3.5.7 3.6 2.6c1.5.4 2.4 1.7 2.4 3.2c0 1.2-.6 2.2-1.5 2.8c.3 2.1-1.3 3.9-3.5 3.9h-1" />
        <path d="M9 4.5V19.5" />
        <path d="M15 4.5V19.5" />
        <path d="M9 9h3" />
        <path d="M12 15h3" />
      </svg>
    );
  }

  if (name === "spark") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M12 3l1.9 5.1L19 10l-5.1 1.9L12 17l-1.9-5.1L5 10l5.1-1.9L12 3z" />
        <path d="M19 15l.9 2.1L22 18l-2.1.9L19 21l-.9-2.1L16 18l2.1-.9L19 15z" />
      </svg>
    );
  }

  if (name === "team") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M8 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6z" />
        <path d="M16 11a3 3 0 1 0 0-6a3 3 0 0 0 0 6z" />
        <path d="M3.5 20c.6-3 2.4-5 4.5-5s3.9 2 4.5 5" />
        <path d="M11.5 20c.6-3 2.4-5 4.5-5s3.9 2 4.5 5" />
      </svg>
    );
  }

  if (name === "calendar") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M6 4v3" />
        <path d="M18 4v3" />
        <path d="M4 8h16" />
        <path d="M5 6h14a1 1 0 0 1 1 1v12a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1z" />
        <path d="M8 12h3" />
        <path d="M13 12h3" />
        <path d="M8 16h5" />
      </svg>
    );
  }

  if (name === "client") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M12 12a4 4 0 1 0 0-8a4 4 0 0 0 0 8z" />
        <path d="M4 21c.9-4 3.7-6 8-6s7.1 2 8 6" />
        <path d="M17.5 5.5l2 2l-2 2" />
      </svg>
    );
  }

  if (name === "mail") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M4 6h16v12H4z" />
        <path d="M4 7l8 6l8-6" />
        <path d="M7 16h4" />
      </svg>
    );
  }

  if (name === "bell") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M18 16H6c1.2-1.2 1.5-3 1.5-5V9a4.5 4.5 0 0 1 9 0v2c0 2 .3 3.8 1.5 5z" />
        <path d="M10 19a2 2 0 0 0 4 0" />
        <path d="M12 3v2" />
      </svg>
    );
  }

  if (name === "market") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M4 18l5-6l4 3l7-9" />
        <path d="M4 20h16" />
        <path d="M17 6h3v3" />
      </svg>
    );
  }

  if (name === "signal") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
        <path d="M6.3 17.7a8 8 0 0 1 0-11.4" />
        <path d="M17.7 6.3a8 8 0 0 1 0 11.4" />
        <path d="M3.5 20.5a12 12 0 0 1 0-17" />
        <path d="M20.5 3.5a12 12 0 0 1 0 17" />
      </svg>
    );
  }

  if (name === "portfolio") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M4 7h16v12H4z" />
        <path d="M8 7V5h8v2" />
        <path d="M8 15l3-3l2 2l3-4" />
      </svg>
    );
  }

  if (name === "compare") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M5 6h14" />
        <path d="M5 18h14" />
        <path d="M8 6v12" />
        <path d="M16 6v12" />
        <path d="M8 10h8" />
        <path d="M8 14h8" />
      </svg>
    );
  }

  if (name === "diamond") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M6 4h12l4 6l-10 10L2 10z" />
        <path d="M2 10h20" />
        <path d="M8 4l4 16l4-16" />
      </svg>
    );
  }

  if (name === "report") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M6 3h9l3 3v15H6z" />
        <path d="M15 3v4h4" />
        <path d="M9 11h6" />
        <path d="M9 15h6" />
        <path d="M9 19h3" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M12 3l7 3v5c0 4.4-2.6 8.3-7 10c-4.4-1.7-7-5.6-7-10V6z" />
        <path d="M9 12l2 2l4-5" />
      </svg>
    );
  }

  if (name === "system") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M4 5h16v11H4z" />
        <path d="M8 20h8" />
        <path d="M10 16v4" />
        <path d="M14 16v4" />
        <path d="M8 9h3" />
        <path d="M13 9h3" />
        <path d="M8 12h8" />
      </svg>
    );
  }

  if (name === "radar") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M12 21a9 9 0 1 0-9-9" />
        <path d="M12 12l6-6" />
        <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
        <path d="M3 12h4" />
        <path d="M12 3v4" />
      </svg>
    );
  }

  if (name === "target") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M12 21a9 9 0 1 0-9-9a9 9 0 0 0 9 9z" />
        <path d="M12 17a5 5 0 1 0-5-5a5 5 0 0 0 5 5z" />
        <path d="M12 13a1 1 0 1 0-1-1a1 1 0 0 0 1 1z" />
      </svg>
    );
  }

  if (name === "flow") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M6 7h12" />
        <path d="M6 17h12" />
        <path d="M8 7v10" />
        <path d="M16 7v10" />
        <path d="M4 7a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
        <path d="M16 17a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M4 20V5" />
        <path d="M4 20h16" />
        <path d="M8 16v-5" />
        <path d="M12 16V8" />
        <path d="M16 16v-3" />
        <path d="M20 16V6" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
      <path d="M7 10V7a5 5 0 0 1 10 0v3" />
      <path d="M5 10h14v11H5z" />
      <path d="M12 15v2" />
    </svg>
  );
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cx(
        "relative grid place-items-center overflow-hidden rounded-[1.1rem] border border-red-500/35 bg-gradient-to-br from-red-500/25 via-black to-zinc-950 shadow-lg shadow-red-950/40",
        compact ? "h-11 w-11" : "h-14 w-14"
      )}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_25%_20%,rgba(248,113,113,0.45),transparent_32%)]" />
      <div className="relative text-xl font-black tracking-tight text-white">S</div>
      <div className="absolute bottom-2 h-0.5 w-7 rotate-[-18deg] rounded-full bg-red-400" />
    </div>
  );
}

function Card({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/72 shadow-2xl shadow-black/35 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function Panel({
  children,
  tone = "slate",
  className,
}: {
  children: ReactNode;
  tone?: Tone;
  className?: string;
}) {
  return (
    <div className={cx("rounded-[1.35rem] border p-4 shadow-lg", toneClasses[tone], className)}>
      {children}
    </div>
  );
}

function Pill({ children, tone = "slate" }: { children: ReactNode; tone?: Tone }) {
  return (
    <span className={cx("inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-black", toneClasses[tone])}>
      {children}
    </span>
  );
}

function ProgressBar({ value, tone = "red" }: { value: number; tone?: Tone }) {
  const fill =
    tone === "green"
      ? "bg-emerald-400"
      : tone === "amber"
        ? "bg-amber-400"
        : tone === "purple"
          ? "bg-purple-400"
          : tone === "cyan"
            ? "bg-cyan-400"
            : tone === "slate"
              ? "bg-slate-400"
              : "bg-red-400";

  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div className={cx("h-full rounded-full", fill)} style={{ width: `${Math.max(0, Math.min(100, value))}%` }} />
    </div>
  );
}

function IconBadge({
  icon,
  tone = "red",
  size = "md",
}: {
  icon: IconName;
  tone?: Tone;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <span
      className={cx(
        "grid shrink-0 place-items-center rounded-2xl border shadow-lg",
        toneClasses[tone],
        size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14" : "h-11 w-11"
      )}
    >
      <span className={cx(size === "sm" ? "h-4 w-4" : size === "lg" ? "h-7 w-7" : "h-5 w-5")}>
        <IconSvg name={icon} />
      </span>
    </span>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone = "red",
  icon = "brain",
  dense = false,
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: Tone;
  icon?: IconName;
  dense?: boolean;
}) {
  return (
    <Panel tone={tone} className={cx("relative overflow-hidden", dense ? "p-3" : "p-4")}>
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-24 bg-gradient-to-b to-transparent", glowClasses[tone])} />
      <div className="relative flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[9px] font-black uppercase tracking-[0.18em] text-slate-400">{label}</div>
          <div className={cx("mt-1 truncate font-black text-white", dense ? "text-2xl" : "text-3xl")}>{value}</div>
          {helper ? <div className="mt-1 truncate text-[11px] font-semibold text-slate-500">{helper}</div> : null}
        </div>
        <IconBadge icon={icon} tone={tone} size="sm" />
      </div>
    </Panel>
  );
}

function OrbitGraphic() {
  return (
    <div className="pointer-events-none absolute right-[-90px] top-[-120px] hidden h-[360px] w-[360px] rounded-full border border-red-500/10 opacity-80 2xl:block">
      <div className="absolute inset-10 rounded-full border border-cyan-500/10" />
      <div className="absolute inset-20 rounded-full border border-white/10" />
      <div className="absolute left-16 top-28 h-3 w-3 rounded-full bg-red-400 shadow-lg shadow-red-500/50" />
      <div className="absolute bottom-24 right-20 h-2.5 w-2.5 rounded-full bg-cyan-400 shadow-lg shadow-cyan-500/50" />
      <div className="absolute left-1/2 top-1/2 h-24 w-24 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/10 blur-2xl" />
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  compact = false,
  action,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  compact?: boolean;
  action?: ReactNode;
}) {
  return (
    <div className="relative flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div>
        {eyebrow ? (
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">
            {eyebrow}
          </div>
        ) : null}
        <h2 className={cx("mt-1 font-black tracking-tight text-white", compact ? "text-xl md:text-2xl" : "text-2xl md:text-4xl")}>
          {title}
        </h2>
        {description ? <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">{description}</p> : null}
      </div>

      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

function BeautifulButton({
  href,
  children,
  tone = "red",
  compact = false,
}: {
  href: string;
  children: ReactNode;
  tone?: Tone;
  compact?: boolean;
}) {
  return (
    <a
      href={href}
      className={cx(
        "inline-flex items-center justify-center rounded-2xl border text-sm font-black shadow-lg transition hover:-translate-y-0.5 hover:scale-[1.01]",
        compact ? "px-3 py-2.5" : "px-4 py-3",
        tone === "slate" ? "border-white/10 bg-white text-slate-950" : toneClasses[tone]
      )}
    >
      {children}
    </a>
  );
}

function Sidebar({
  activeTab,
  setTab,
}: {
  activeTab: Tab;
  setTab: (tab: Tab) => void;
}) {
  const groupedTabs = tabs.reduce<Record<string, typeof tabs>>((acc, tab) => {
    acc[tab.group] = acc[tab.group] ?? [];
    acc[tab.group].push(tab);
    return acc;
  }, {});

  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[292px] shrink-0 overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/58 shadow-2xl shadow-black/35 backdrop-blur-2xl xl:block">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <LogoMark compact />
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">
              Slice
            </div>
            <div className="truncate text-lg font-black text-white">Command Brain</div>
            <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
              Advisor operating system
            </div>
          </div>
        </div>
      </div>

      <nav className="max-h-[calc(100vh-7.7rem)] overflow-y-auto p-3">
        {Object.entries(groupedTabs).map(([group, items]) => (
          <div key={group} className="mb-3">
            <div className="mb-1.5 px-3 text-[9px] font-black uppercase tracking-[0.2em] text-slate-600">
              {group}
            </div>
            <div className="grid gap-1">
              {items.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTab(tab.id)}
                  className={cx(
                    "group grid grid-cols-[34px_minmax(0,1fr)_auto] items-center gap-2.5 rounded-[1.1rem] border px-2.5 py-2.5 text-left transition",
                    activeTab === tab.id
                      ? "border-white/25 bg-white text-slate-950 shadow-lg shadow-red-950/20"
                      : "border-transparent bg-transparent text-slate-300 hover:border-white/10 hover:bg-white/[0.065] hover:text-white"
                  )}
                >
                  <span
                    className={cx(
                      "grid h-8 w-8 place-items-center rounded-2xl",
                      activeTab === tab.id ? "bg-slate-950 text-white" : "bg-white/[0.06] text-white"
                    )}
                  >
                    <span className="h-4 w-4">
                      <IconSvg name={tab.icon} />
                    </span>
                  </span>
                  <span className="min-w-0">
                    <span className="block truncate text-[13px] font-black">{tab.label}</span>
                    <span
                      className={cx(
                        "block truncate text-[10px] font-semibold",
                        activeTab === tab.id ? "text-slate-600" : "text-slate-500"
                      )}
                    >
                      {tab.description}
                    </span>
                  </span>
                  <span className={cx("h-2.5 w-2.5 rounded-full shadow-lg", toneDot[tab.tone])} />
                </button>
              ))}
            </div>
          </div>
        ))}
      </nav>
    </aside>
  );
}

function ModuleCard({
  title,
  description,
  stats,
  primaryHref,
  primaryLabel,
  tone = "red",
  icon = "brain",
}: {
  title: string;
  description: string;
  stats?: Array<[string, string | number]>;
  primaryHref?: string;
  primaryLabel?: string;
  tone?: Tone;
  icon?: IconName;
}) {
  return (
    <Card className="group p-4 transition hover:-translate-y-1 hover:border-white/20 hover:bg-zinc-950/90">
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b to-transparent", glowClasses[tone])} />
      <div className="relative">
        <div className="flex items-start justify-between gap-3">
          <div className="flex min-w-0 gap-3">
            <IconBadge icon={icon} tone={tone} size="md" />
            <div className="min-w-0">
              <h2 className="truncate text-lg font-black text-white">{title}</h2>
              <p className="mt-1.5 line-clamp-2 min-h-[44px] text-xs leading-5 text-slate-400">{description}</p>
            </div>
          </div>
        </div>

        {stats?.length ? (
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {stats.map(([label, value], index) => (
              <div key={`${title}-${label}-${index}`} className="rounded-2xl border border-white/10 bg-black/25 p-2.5">
                <div className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-slate-500">{label}</div>
                <div className="mt-1 truncate text-base font-black text-white">{value}</div>
              </div>
            ))}
          </div>
        ) : null}

        {primaryHref ? (
          <a
            href={primaryHref}
            className="mt-4 inline-flex w-full items-center justify-center rounded-2xl bg-white px-4 py-2.5 text-sm font-black text-slate-950 transition hover:scale-[1.01]"
          >
            {primaryLabel ?? "Open"}
          </a>
        ) : null}
      </div>
    </Card>
  );
}

function GenericModule({
  eyebrow,
  title,
  description,
  cards,
}: {
  eyebrow: string;
  title: string;
  description: string;
  cards: Array<{
    title: string;
    description: string;
    href?: string;
    button?: string;
    tone?: Tone;
    icon?: IconName;
    stats?: Array<[string, string | number]>;
  }>;
}) {
  return (
    <section className="grid gap-4">
      <Card className="p-5">
        <SectionTitle eyebrow={eyebrow} title={title} description={description} compact />
      </Card>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {cards.map((card, index) => (
          <ModuleCard
            key={`${title}-${card.title}-${index}`}
            title={card.title}
            description={card.description}
            stats={card.stats}
            primaryHref={card.href}
            primaryLabel={card.button}
            tone={card.tone}
            icon={card.icon}
          />
        ))}
      </div>
    </section>
  );
}

function CalendarTaskPill({ task, dense = false }: { task: CalendarTask; dense?: boolean }) {
  const complete = completeStatus(task.status);

  return (
    <div
      className={cx(
        "rounded-xl border bg-black/30 shadow-sm",
        dense ? "px-2 py-1.5" : "px-2.5 py-2",
        complete ? "border-emerald-500/20 opacity-70" : "border-white/10"
      )}
      style={{
        borderLeftWidth: 3,
        borderLeftColor: task.ownerColor ?? "#ef4444",
      }}
    >
      <div className={cx("truncate font-black", dense ? "text-[11px]" : "text-[12px]", complete ? "text-slate-500 line-through" : "text-white")}>
        {task.title}
      </div>
      {!dense ? (
        <div className="mt-1 truncate text-[10px] font-semibold text-slate-500">
          {task.ownerName ?? "Team"} {task.project?.title ? `· ${task.project.title}` : ""}
        </div>
      ) : null}
    </div>
  );
}

function ExecutiveCommandStrip({ moduleCards }: { moduleCards: ModuleCardConfig[] }) {
  const actions = moduleCards.slice(0, 6);

  return (
    <Card className="p-3">
      <div className="grid gap-2 lg:grid-cols-6">
        {actions.map((item) => (
          <a
            key={item.id}
            href={item.href}
            className="group rounded-[1.15rem] border border-white/10 bg-white/[0.045] p-3 transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
          >
            <div className="flex items-center gap-2">
              <IconBadge icon={item.icon} tone={item.tone} size="sm" />
              <div className="min-w-0">
                <div className="truncate text-xs font-black text-white">{item.title}</div>
                <div className="truncate text-[10px] font-semibold text-slate-500">{item.subtitle}</div>
              </div>
            </div>
          </a>
        ))}
      </div>
    </Card>
  );
}

function IntelligenceRibbon({
  cards,
}: {
  cards: Array<{
    title: string;
    value: string | number;
    helper: string;
    tone: Tone;
    icon: IconName;
  }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2 2xl:grid-cols-4">
      {cards.map((card) => (
        <MetricCard
          key={card.title}
          label={card.title}
          value={card.value}
          helper={card.helper}
          tone={card.tone}
          icon={card.icon}
        />
      ))}
    </div>
  );
}

function ClientShowcasePanel({
  assets,
  clients,
  alerts,
  ideas,
}: {
  assets: number;
  clients: number;
  alerts: number;
  ideas: number;
}) {
  return (
    <Card className="p-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_420px] xl:items-center">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">
            Client-Presentable Layer
          </div>
          <h2 className="mt-1.5 text-2xl font-black text-white md:text-3xl">
            A workspace an advisor can confidently use every day.
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            The workspace frames the firm’s workflow professionally: intelligence enters the platform,
            the advisor reviews it, the team delegates action, client communication becomes polished,
            and compliance gates make the process safer without making it feel complicated.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Pill tone="cyan">AI-assisted</Pill>
            <Pill tone="green">Action-oriented</Pill>
            <Pill tone="purple">Client-ready</Pill>
            <Pill tone="red">Compliance-aware</Pill>
            <Pill tone="amber">Source-backed</Pill>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Assets Watched" value={assets} helper="Watchlists" tone="amber" dense icon="market" />
          <MetricCard label="Clients" value={clients} helper="Profiles" tone="purple" dense icon="client" />
          <MetricCard label="Alerts" value={alerts} helper="Total" tone={alerts ? "red" : "green"} dense icon="bell" />
          <MetricCard label="Ideas" value={ideas} helper="Team growth" tone="cyan" dense icon="spark" />
        </div>
      </div>
    </Card>
  );
}

function CommandHealthPanel({
  readiness,
  kernelReadiness,
  alerts,
  failedRuns,
  overdue,
}: {
  readiness: number;
  kernelReadiness: number;
  alerts: number;
  failedRuns: number;
  overdue: number;
}) {
  const rows = [
    { label: "Advisor OS", value: readiness, tone: readiness >= 75 ? "green" : readiness >= 45 ? "amber" : "red" },
    { label: "Backend Kernel", value: kernelReadiness, tone: kernelReadiness >= 75 ? "green" : kernelReadiness >= 45 ? "amber" : "red" },
    { label: "Compliance Layer", value: SLICE_COMPLIANCE_PROFILE.readinessScore, tone: getComplianceTone(SLICE_COMPLIANCE_PROFILE.readinessScore) },
  ] satisfies Array<{ label: string; value: number; tone: Tone }>;

  return (
    <Card className="p-5">
      <div className="grid gap-5 xl:grid-cols-[0.9fr_1.1fr]">
        <div>
          <SectionTitle
            eyebrow="Command Health"
            title="One simple health view"
            description="Readiness should be obvious: advisor workflow, backend services, compliance posture, alerts, and overdue work all show up in one place."
            compact
          />
          <div className="mt-4 grid gap-3 md:grid-cols-3">
            <MetricCard label="Unread Alerts" value={alerts} helper="Needs review" tone={alerts ? "red" : "green"} dense icon="bell" />
            <MetricCard label="Failed Runs" value={failedRuns} helper="Backend" tone={failedRuns ? "red" : "green"} dense icon="system" />
            <MetricCard label="Overdue" value={overdue} helper="Tasks" tone={overdue ? "red" : "green"} dense icon="target" />
          </div>
        </div>

        <div className="grid gap-3">
          {rows.map((row) => (
            <div key={row.label} className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-black text-white">{row.label}</div>
                <Pill tone={row.tone}>{percent(row.value)}</Pill>
              </div>
              <ProgressBar value={row.value} tone={row.tone} />
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

function SignalQualityPanel({
  retained,
  watchlists,
  deliveries,
  alerts,
}: {
  retained: number;
  watchlists: number;
  deliveries: number;
  alerts: number;
}) {
  return (
    <Card className="p-5">
      <SectionTitle
        eyebrow="Signal Quality"
        title="Signals need sources, retained rationale, and advisor review"
        description="Slice can move quickly, but the safer version does not just fire alerts. It retains why the alert mattered, what source supported it, and who reviewed the client-facing output."
        compact
      />

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricCard label="Retained Rationale" value={retained} helper="Decision records" tone="green" dense icon="report" />
        <MetricCard label="Watchlists" value={watchlists} helper="Market monitoring" tone="amber" dense icon="market" />
        <MetricCard label="Deliveries" value={deliveries} helper="Communications" tone="purple" dense icon="mail" />
        <MetricCard label="Alerts" value={alerts} helper="Triage input" tone={alerts ? "red" : "green"} dense icon="signal" />
      </div>
    </Card>
  );
}

function VisualModuleMap({ moduleCards }: { moduleCards: ModuleCardConfig[] }) {
  const featured = moduleCards.slice(0, 8);

  return (
    <Card className="p-5">
      <SectionTitle
        eyebrow="Command Map"
        title="Everything stays connected"
        description="The advisor does not need to hunt. The most important modules stay available from the command center."
        compact
      />

      <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_220px_1fr]">
        <div className="grid gap-3">
          {featured.slice(0, 4).map((module) => (
            <a
              key={module.id}
              href={module.href}
              className="group rounded-2xl border border-white/10 bg-white/[0.045] p-3 transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
            >
              <div className="flex items-center gap-3">
                <IconBadge icon={module.icon} tone={module.tone} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">{module.title}</div>
                  <div className="truncate text-[11px] font-semibold text-slate-500">{module.subtitle}</div>
                </div>
                <span className="ml-auto text-slate-600 transition group-hover:text-white">→</span>
              </div>
            </a>
          ))}
        </div>

        <div className="grid place-items-center rounded-[1.5rem] border border-red-500/20 bg-red-500/10 p-4">
          <div className="text-center">
            <LogoMark />
            <div className="mt-3 text-lg font-black text-white">Command Brain</div>
            <div className="mt-1 text-xs leading-5 text-slate-400">AI, data, clients, markets, team, compliance</div>
          </div>
        </div>

        <div className="grid gap-3">
          {featured.slice(4, 8).map((module) => (
            <a
              key={module.id}
              href={module.href}
              className="group rounded-2xl border border-white/10 bg-white/[0.045] p-3 transition hover:-translate-y-0.5 hover:bg-white/[0.08]"
            >
              <div className="flex items-center gap-3">
                <IconBadge icon={module.icon} tone={module.tone} size="sm" />
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">{module.title}</div>
                  <div className="truncate text-[11px] font-semibold text-slate-500">{module.subtitle}</div>
                </div>
                <span className="ml-auto text-slate-600 transition group-hover:text-white">→</span>
              </div>
            </a>
          ))}
        </div>
      </div>
    </Card>
  );
}

function AdvisorWorkflowBlueprint({
  dueToday,
  overdue,
  unreadAlerts,
  clientCount,
}: {
  dueToday: number;
  overdue: number;
  unreadAlerts: number;
  clientCount: number;
}) {
  const steps = [
    {
      title: "Scan",
      body: `${unreadAlerts} unread alert(s) and source-backed market intelligence.`,
      tone: unreadAlerts ? "red" : "green",
      icon: "radar",
    },
    {
      title: "Prioritize",
      body: `${overdue} overdue item(s), ${dueToday} due today.`,
      tone: overdue ? "red" : dueToday ? "amber" : "green",
      icon: "target",
    },
    {
      title: "Review",
      body: "Compliance gates check advice, marketing, performance, testimonials, and privacy concerns.",
      tone: "red",
      icon: "shield",
    },
    {
      title: "Communicate",
      body: `${clientCount} client profile(s) available for polished, approval-aware communication.`,
      tone: "purple",
      icon: "mail",
    },
  ] satisfies Array<{ title: string; body: string; tone: Tone; icon: IconName }>;

  return (
    <Card className="p-4">
      <SectionTitle
        eyebrow="Daily Flow"
        title="Four-step advisor workflow"
        description="A simple rhythm makes adoption easier: scan, prioritize, review, communicate."
        compact
      />

      <div className="mt-4 grid gap-3">
        {steps.map((step, index) => (
          <div key={step.title} className="rounded-2xl border border-white/10 bg-white/[0.045] p-3">
            <div className="flex items-start gap-3">
              <IconBadge icon={step.icon} tone={step.tone} size="sm" />
              <div>
                <div className="text-sm font-black text-white">
                  {index + 1}. {step.title}
                </div>
                <div className="mt-1 text-xs leading-5 text-slate-400">{step.body}</div>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function CompactActivityPanel({
  posts,
  notifications,
}: {
  posts: FirmPost[];
  notifications: DashboardNotification[];
}) {
  return (
    <div className="grid gap-4 2xl:grid-cols-2">
      <Card className="p-4">
        <SectionTitle
          eyebrow="Activity"
          title="Recent workspace activity"
          description="Firm messages, ideas, notes, shared updates, and internal context."
          compact
        />

        <div className="mt-4 grid max-h-[320px] gap-3 overflow-y-auto pr-2">
          {posts.slice(0, 7).map((post) => (
            <div key={post.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">{post.title}</div>
                  <div className="mt-1 truncate text-[11px] font-semibold text-slate-500">
                    {post.postType} · {formatDateTime(post.createdAt)}
                  </div>
                </div>
                <Pill tone={toneFor(post.postType)}>{post.postType}</Pill>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{post.body}</p>
            </div>
          ))}

          {!posts.length ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
              No recent workspace activity.
            </div>
          ) : null}
        </div>
      </Card>

      <Card className="p-4">
        <SectionTitle
          eyebrow="Open Notifications"
          title="What still needs review"
          description="Unread dashboard notifications, urgent alerts, and review-worthy items."
          compact
        />

        <div className="mt-4 grid max-h-[320px] gap-3 overflow-y-auto pr-2">
          {notifications.slice(0, 7).map((notification) => (
            <div key={notification.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">{notification.title}</div>
                  <div className="mt-1 truncate text-[11px] font-semibold text-slate-500">
                    {notification.status} · {formatDateTime(notification.createdAt)}
                  </div>
                </div>
                <Pill tone={toneFor(notification.urgency)}>{notification.urgency}</Pill>
              </div>
              <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">{notification.body}</p>
            </div>
          ))}

          {!notifications.length ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
              No open dashboard notifications.
            </div>
          ) : null}
        </div>
      </Card>
    </div>
  );
}

function AdoptionPanel({
  moduleCards,
  readiness,
}: {
  moduleCards: ModuleCardConfig[];
  readiness: number;
}) {
  const lanes = [
    {
      title: "First 5 minutes",
      body: "Open AI Studio, review alerts, then scan the Daily Brain.",
      href: "/workspace/personal-bot",
      tone: "cyan",
      icon: "spark",
    },
    {
      title: "First team meeting",
      body: "Use Team Board to assign work, due dates, priority, reminders, and owners.",
      href: "/workspace?tab=team-board",
      tone: "green",
      icon: "team",
    },
    {
      title: "First client review",
      body: "Open Clients and Client Briefings for clean, advisor-approved communication.",
      href: "/workspace?tab=briefings",
      tone: "purple",
      icon: "client",
    },
    {
      title: "First compliance review",
      body: "Open Compliance to show human approval, source retention, and communication gates.",
      href: "/workspace?tab=compliance",
      tone: "red",
      icon: "shield",
    },
  ] satisfies Array<{ title: string; body: string; href: string; tone: Tone; icon: IconName }>;

  return (
    <Card className="p-5">
      <div className="grid gap-5 xl:grid-cols-[1fr_320px] xl:items-center">
        <div>
          <SectionTitle
            eyebrow="Adoption"
            title="Make the platform obvious in the first session"
            description="The workspace should not feel like a maze. It should tell a new advisor exactly where to start, where compliance lives, and why each area matters."
            compact
          />

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {lanes.map((lane) => (
              <a
                key={lane.title}
                href={lane.href}
                className={cx("group rounded-[1.35rem] border p-4 transition hover:-translate-y-0.5 hover:bg-white/[0.08]", toneSoft[lane.tone])}
              >
                <div className="flex gap-3">
                  <IconBadge icon={lane.icon} tone={lane.tone} size="sm" />
                  <div>
                    <div className="text-sm font-black text-white">{lane.title}</div>
                    <div className="mt-1 text-xs leading-5 text-slate-400">{lane.body}</div>
                  </div>
                </div>
              </a>
            ))}
          </div>
        </div>

        <Panel tone={readiness >= 75 ? "green" : readiness >= 45 ? "amber" : "red"} className="bg-black/35">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
            Adoption Score
          </div>
          <div className="mt-2 text-4xl font-black text-white">{percent(readiness)}</div>
          <div className="mt-3">
            <ProgressBar value={readiness} tone={readiness >= 75 ? "green" : readiness >= 45 ? "amber" : "red"} />
          </div>
          <div className="mt-3 text-xs leading-5 text-slate-400">
            {moduleCards.length} core modules stay visible from the workspace without forcing advisors to hunt through hidden pages.
          </div>
        </Panel>
      </div>
    </Card>
  );
}

function CohesionMatrix({ moduleCards }: { moduleCards: ModuleCardConfig[] }) {
  const categories = Array.from(new Set(moduleCards.map((module) => module.category)));

  return (
    <Card className="p-4">
      <SectionTitle
        eyebrow="Workspace Cohesion"
        title="Every module has a clean purpose"
        description="The workspace stays consolidated while compliance is added as a native operating layer, not a separate maze."
        compact
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
        {categories.map((category) => {
          const modules = moduleCards.filter((module) => module.category === category);
          const tone = modules[0]?.tone ?? "slate";

          return (
            <div key={category} className={cx("rounded-[1.35rem] border p-4", toneSoft[tone])}>
              <div className="text-sm font-black text-white">{category}</div>
              <div className="mt-1 text-xs text-slate-500">{modules.length} tool(s)</div>
              <div className="mt-3 grid gap-2">
                {modules.slice(0, 5).map((module) => (
                  <a key={module.id} href={module.href} className="truncate rounded-xl bg-black/25 px-3 py-2 text-xs font-bold text-slate-300 hover:bg-black/40">
                    {module.title}
                  </a>
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

function ComplianceStatusStrip() {
  const activeControls = getActiveComplianceControlCount();
  const totalControls = SLICE_COMPLIANCE_PROFILE.controls.length;
  const scoreTone = getComplianceTone(SLICE_COMPLIANCE_PROFILE.readinessScore);

  return (
    <Card className="p-4">
      <SectionTitle
        eyebrow="Compliance Layer"
        title="Advisor supervision added without changing the workspace"
        description="Slice still feels like the same command brain, but now client communications, AI output, performance language, testimonials, private opportunities, and recommendations are routed through visible review gates."
        compact
        action={
          <BeautifulButton href="/workspace?tab=compliance" tone="red" compact>
            Open Compliance
          </BeautifulButton>
        }
      />

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <MetricCard
          label="Compliance Score"
          value={percent(SLICE_COMPLIANCE_PROFILE.readinessScore)}
          helper="Demo posture"
          tone={scoreTone}
          dense
          icon="shield"
        />
        <MetricCard
          label="Active Controls"
          value={`${activeControls}/${totalControls}`}
          helper="Workflow guardrails"
          tone="green"
          dense
          icon="lock"
        />
        <MetricCard
          label="Auto-Send Advice"
          value="Off"
          helper="Human review required"
          tone="red"
          dense
          icon="mail"
        />
        <MetricCard
          label="Record Package"
          value="Required"
          helper="Sources + approvals"
          tone="cyan"
          dense
          icon="report"
        />
      </div>

      <div className="mt-4 grid gap-3 xl:grid-cols-3">
        {SLICE_COMPLIANCE_PROFILE.communicationGates.slice(0, 3).map((gate) => (
          <div key={gate.id} className={cx("rounded-[1.35rem] border p-4", toneSoft[gate.tone])}>
            <div className="flex items-start justify-between gap-3">
              <div>
                <div className="text-sm font-black text-white">{gate.title}</div>
                <p className="mt-1 line-clamp-2 text-xs leading-5 text-slate-400">
                  {gate.trigger}
                </p>
              </div>
              <Pill tone={gate.tone}>Gate</Pill>
            </div>
            <p className="mt-3 text-xs font-semibold leading-5 text-slate-300">
              {gate.action}
            </p>
          </div>
        ))}
      </div>
    </Card>
  );
}

function ComplianceCenterModule() {
  const activeControls = getActiveComplianceControlCount();
  const totalControls = SLICE_COMPLIANCE_PROFILE.controls.length;
  const scoreTone = getComplianceTone(SLICE_COMPLIANCE_PROFILE.readinessScore);

  return (
    <section className="grid gap-4">
      <Card className="p-5">
        <SectionTitle
          eyebrow="Compliance"
          title="Advisor compliance command layer"
          description="This is an addition to the current Slice workspace. It adds review gates, recordkeeping awareness, AI governance, marketing controls, privacy controls, and advisor supervision without replacing the original command center."
          compact
          action={<Pill tone="red">No auto-send advice</Pill>}
        />

        <div className="mt-4 grid gap-3 md:grid-cols-4">
          <MetricCard
            label="Posture"
            value={percent(SLICE_COMPLIANCE_PROFILE.readinessScore)}
            helper="Compliance readiness"
            tone={scoreTone}
            dense
            icon="shield"
          />
          <MetricCard
            label="Controls"
            value={`${activeControls}/${totalControls}`}
            helper="Active guardrails"
            tone="green"
            dense
            icon="lock"
          />
          <MetricCard
            label="Review Gates"
            value={SLICE_COMPLIANCE_PROFILE.communicationGates.length}
            helper="Communication checks"
            tone="amber"
            dense
            icon="flow"
          />
          <MetricCard
            label="Archive Fields"
            value={SLICE_COMPLIANCE_PROFILE.booksAndRecordsPackage.length}
            helper="Record package"
            tone="cyan"
            dense
            icon="report"
          />
        </div>

        <div className="mt-5 rounded-[1.5rem] border border-red-500/20 bg-red-500/10 p-4">
          <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-300">
            Core rule inside Slice
          </div>
          <p className="mt-2 text-sm font-semibold leading-6 text-red-50">
            {SLICE_COMPLIANCE_PROFILE.noAutoSendRule}
          </p>
        </div>
      </Card>

      <div className="grid gap-4 2xl:grid-cols-[1.05fr_0.95fr]">
        <Card className="p-4">
          <SectionTitle
            eyebrow="Control Matrix"
            title="What Slice now checks"
            description="These controls are designed to make the existing advisor portal more usable for regulated teams."
            compact
          />

          <div className="mt-4 grid gap-3">
            {SLICE_COMPLIANCE_PROFILE.controls.map((control) => (
              <div key={control.id} className="rounded-[1.35rem] border border-white/10 bg-black/30 p-4">
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-sm font-black text-white">{control.title}</div>
                    <div className="mt-1 text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500">
                      {control.ruleArea}
                    </div>
                  </div>
                  <Pill tone={control.tone}>{control.status}</Pill>
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-400">{control.summary}</p>

                <div className="mt-3 rounded-2xl border border-white/10 bg-white/[0.035] p-3">
                  <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Evidence
                  </div>
                  <p className="mt-1 text-xs leading-5 text-slate-300">{control.evidence}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <div className="grid gap-4">
          <Card className="p-4">
            <SectionTitle
              eyebrow="Blocked Automation"
              title="What Slice should not do automatically"
              description="These restrictions keep the platform useful without turning it into an unsupervised advice engine."
              compact
            />

            <div className="mt-4 grid gap-2">
              {SLICE_COMPLIANCE_PROFILE.prohibitedAutomations.map((item) => (
                <div key={item} className="rounded-2xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-xs font-bold leading-5 text-red-50">
                  {item}
                </div>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <SectionTitle
              eyebrow="AI Governance"
              title="AI stays draft-only"
              description="The advisor, supervisor, or compliance officer stays in control."
              compact
            />

            <div className="mt-4 grid gap-2">
              {SLICE_COMPLIANCE_PROFILE.aiGuardrails.map((item) => (
                <div key={item} className="rounded-2xl border border-cyan-500/20 bg-cyan-500/10 px-4 py-3 text-xs font-bold leading-5 text-cyan-50">
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>

      <div className="grid gap-4 2xl:grid-cols-2">
        <Card className="p-4">
          <SectionTitle
            eyebrow="Communication Gates"
            title="When advisor output needs review"
            description="These gates should be checked before sending emails, client briefings, alerts, or public-facing material."
            compact
          />

          <div className="mt-4 grid gap-3">
            {SLICE_COMPLIANCE_PROFILE.communicationGates.map((gate) => (
              <div key={gate.id} className={cx("rounded-[1.35rem] border p-4", toneSoft[gate.tone])}>
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-sm font-black text-white">{gate.title}</div>
                    <p className="mt-1 text-xs leading-5 text-slate-400">{gate.trigger}</p>
                  </div>
                  <Pill tone={gate.tone}>Review</Pill>
                </div>
                <p className="mt-3 text-xs font-semibold leading-5 text-slate-300">
                  {gate.action}
                </p>
              </div>
            ))}
          </div>
        </Card>

        <Card className="p-4">
          <SectionTitle
            eyebrow="Books & Records"
            title="Record package for advisor teams"
            description="Every serious client-facing output should preserve the evidence trail, not just the final message."
            compact
          />

          <div className="mt-4 grid gap-2 md:grid-cols-2">
            {SLICE_COMPLIANCE_PROFILE.booksAndRecordsPackage.map((item) => (
              <div key={item} className="rounded-2xl border border-white/10 bg-white/[0.045] px-4 py-3">
                <div className="flex items-start gap-3">
                  <span className="mt-1.5 h-2 w-2 rounded-full bg-red-400 shadow-lg shadow-red-500/40" />
                  <p className="text-xs font-bold leading-5 text-slate-200">{item}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </section>
  );
}

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [message] = useState("");
  const [backendMessage, setBackendMessage] = useState("");
  const [backendWorking, setBackendWorking] = useState("");
  const [command, setCommand] = useState<CommandOverview | null>(null);
  const [firmWorkspace, setFirmWorkspace] = useState<FirmWorkspace | null>(null);
  const [kernel, setKernel] = useState<BackendKernelSummary | null>(null);
  const [calendarMode, setCalendarMode] = useState<"week" | "month">("week");
  const [calendarAnchor, setCalendarAnchor] = useState(ymd(new Date()));
  const [selectedDay, setSelectedDay] = useState(ymd(new Date()));

  const currentCommand = command ?? EMPTY_COMMAND;
  const currentFirmWorkspace = firmWorkspace ?? EMPTY_FIRM_WORKSPACE;
  const operations = currentFirmWorkspace.operations ?? EMPTY_FIRM_WORKSPACE.operations!;
  const firmTasks = operations.allTasks ?? [];
  const openFirmTasks = firmTasks.filter((task) => !completeStatus(task.status));
  const completedFirmTasks = firmTasks.filter((task) => completeStatus(task.status));
  const today = ymd(new Date());

  const tasksDueToday = useMemo(
    () => firmTasks.filter((task) => task.dueDate === today && !completeStatus(task.status)),
    [firmTasks, today]
  );

  const overdueTasks = useMemo(
    () => firmTasks.filter((task) => task.dueDate && task.dueDate < today && !completeStatus(task.status)),
    [firmTasks, today]
  );

  const tasksByDay = useMemo(() => {
    const map = new Map<string, CalendarTask[]>();

    for (const task of firmTasks) {
      if (!task.dueDate) continue;
      const items = map.get(task.dueDate) ?? [];
      items.push(task);
      map.set(task.dueDate, items);
    }

    return map;
  }, [firmTasks]);

  const weekDays = useMemo(
    () => Array.from({ length: 7 }).map((_, index) => addDays(startOfWeek(calendarAnchor), index)),
    [calendarAnchor]
  );

  const monthDays = useMemo(() => calendarMonthDays(calendarAnchor), [calendarAnchor]);
  const selectedDayTasks = useMemo(() => tasksByDay.get(selectedDay) ?? [], [selectedDay, tasksByDay]);

  const readinessTone: Exclude<Tone, "slate"> =
    currentCommand.readinessScore >= 75
      ? "green"
      : currentCommand.readinessScore >= 45
        ? "amber"
        : "red";

  const moduleCards: ModuleCardConfig[] = [
    {
      id: "team",
      title: "Team Board",
      subtitle: "Delegation OS",
      description: "Delegate work, rank importance, create reminders, track completion, and collect anonymous ideas.",
      tone: "green",
      icon: "team",
      href: "/workspace?tab=team-board",
      button: "Open Team Board",
      category: "Firm",
      meta: [
        ["Tasks", operations.sprintMetrics.total],
        ["Ideas", operations.sprintMetrics.ideas],
        ["Blocked", operations.sprintMetrics.blocked],
        ["Timed", operations.sprintMetrics.timedReminders],
      ],
    },
    {
      id: "calendar",
      title: "Calendar",
      subtitle: "Timeline control",
      description: "Review deadlines, task due dates, project timing, and weekly execution flow.",
      tone: "purple",
      icon: "calendar",
      href: "/workspace?tab=firm-calendar",
      button: "Open Calendar",
      category: "Firm",
      meta: [
        ["Deadlines", operations.sprintMetrics.deadlines],
        ["Due today", tasksDueToday.length],
      ],
    },
    {
      id: "ai",
      title: "AI Studio",
      subtitle: "Command assistant",
      description: "Ask anything, generate advisor-reviewed drafts, create reports, use voice, and prepare client material with source and approval awareness.",
      tone: "cyan",
      icon: "spark",
      href: "/workspace/personal-bot",
      button: "Ask AI",
      category: "Command",
      meta: [
        ["Briefings", currentCommand.counts.briefingCount],
        ["Alerts", currentCommand.counts.totalAlertCount],
      ],
    },
    {
      id: "markets",
      title: "Market Visuals",
      subtitle: "Advisor charts",
      description: "Technical charts, comparisons, moving averages, RSI, MACD, volume, and forecast ranges.",
      tone: "red",
      icon: "market",
      href: "/market-visuals",
      button: "Open Visuals",
      category: "Markets",
      meta: [
        ["Watchlists", currentCommand.counts.watchlistCount],
        ["Alerts", currentCommand.counts.totalAlertCount],
      ],
    },
    {
      id: "clients",
      title: "Clients",
      subtitle: "Client brain",
      description: "Client records, briefings, emails, notes, suitability context, and relationship preparation.",
      tone: "purple",
      icon: "client",
      href: "/workspace?tab=clients",
      button: "Open Clients",
      category: "Advisor",
      meta: [
        ["Clients", currentCommand.counts.clientCount],
        ["Emails", currentCommand.counts.deliveryCount],
      ],
    },
    {
      id: "emails",
      title: "Email Center",
      subtitle: "Communication OS",
      description: "Draft, refine, review, archive, and prepare advisor-grade client communication through approved workflows.",
      tone: "green",
      icon: "mail",
      href: "/workspace?tab=emails",
      button: "Open Email",
      category: "Advisor",
      meta: [
        ["Clients", currentCommand.counts.clientCount],
        ["Deliveries", currentCommand.counts.deliveryCount],
      ],
    },
    {
      id: "intel",
      title: "Intelligence",
      subtitle: "Continuous scan",
      description: "Source-backed market and opportunity intelligence with triage scoring, advisor review gates, and retained rationale.",
      tone: "red",
      icon: "signal",
      href: "/workspace?tab=intelligence",
      button: "Open Intel",
      category: "Markets",
      meta: [
        ["Retained", currentCommand.counts.retainedDecisionCount],
        ["Runs", currentCommand.counts.triageRunCount],
      ],
    },
    {
      id: "portfolio",
      title: "Portfolio Lab",
      subtitle: "Holdings view",
      description: "Holdings, accounts, value, models, scenarios, and portfolio context.",
      tone: "green",
      icon: "portfolio",
      href: "/portfolio-lab",
      button: "Open Portfolio",
      category: "Markets",
      meta: [
        ["Holdings", currentCommand.counts.holdingCount],
        ["Value", money(currentCommand.counts.portfolioTotalValue)],
      ],
    },
    {
      id: "client-briefings",
      title: "Client Briefings",
      subtitle: "Approval-ready output",
      description: "Create client-specific advisory notes, source-backed briefings, retained rationale, and approval-gated communication.",
      tone: "purple",
      icon: "report",
      href: "/workspace/client-briefings",
      button: "Open Client Briefings",
      category: "Research",
      meta: [
        ["Briefings", currentCommand.counts.briefingCount],
        ["Deliveries", currentCommand.counts.deliveryCount],
      ],
    },
    {
      id: "compliance",
      title: "Compliance Guardrails",
      subtitle: "Review gates",
      description: "Advisor review, marketing controls, books-and-records, privacy, AI governance, and no auto-send advice.",
      tone: "red",
      icon: "shield",
      href: "/workspace?tab=compliance",
      button: "Open Compliance",
      category: "System",
      meta: [
        ["Score", percent(SLICE_COMPLIANCE_PROFILE.readinessScore)],
        ["Controls", SLICE_COMPLIANCE_PROFILE.controls.length],
      ],
    },
    {
      id: "system",
      title: "System",
      subtitle: "Backend readiness",
      description: "Kernel health, vendors, queues, failed runs, deployments, and platform reliability.",
      tone: "cyan",
      icon: "system",
      href: "/workspace?tab=system",
      button: "Open System",
      category: "System",
      meta: [
        ["Kernel", percent(kernel?.readinessScore ?? 0)],
        ["Failed", kernel?.metrics.failedRuns ?? 0],
      ],
    },
    {
      id: "security",
      title: "Security",
      subtitle: "Governance",
      description: "Audit posture, disclosures, sensitive-action review, and platform controls.",
      tone: "red",
      icon: "shield",
      href: "/workspace?tab=security",
      button: "Open Security",
      category: "System",
      meta: [
        ["Audit", currentCommand.counts.auditLogCount],
        ["Required", currentCommand.counts.requiredDisclosures ?? 0],
      ],
    },
  ];

  const ribbonCards = [
    {
      title: "Brain Readiness",
      value: percent(currentCommand.readinessScore),
      helper: "Command center score",
      tone: readinessTone,
      icon: "brain",
    },
    {
      title: "Advisor Alerts",
      value: currentCommand.counts.unreadAlertCount,
      helper: `${currentCommand.counts.totalAlertCount} total alerts`,
      tone: currentCommand.counts.unreadAlertCount ? "red" : "green",
      icon: "bell",
    },
    {
      title: "Team Execution",
      value: openFirmTasks.length,
      helper: `${completedFirmTasks.length} complete`,
      tone: openFirmTasks.length ? "amber" : "green",
      icon: "team",
    },
    {
      title: "Compliance",
      value: percent(SLICE_COMPLIANCE_PROFILE.readinessScore),
      helper: "Guardrail posture",
      tone: getComplianceTone(SLICE_COMPLIANCE_PROFILE.readinessScore),
      icon: "shield",
    },
  ] satisfies Array<{
    title: string;
    value: string | number;
    helper: string;
    tone: Tone;
    icon: IconName;
  }>;

  function setTab(tab: Tab) {
    setActiveTab(tab);

    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState(null, "", url.toString());
    }
  }

  async function loadCommandCenter() {
    try {
      const response = await fetch("/api/command-center", { cache: "no-store" });

      if (!response.ok) return;

      const payload = await response.json();
      setCommand(payload.overview ?? payload);
    } catch {
      setCommand(EMPTY_COMMAND);
    }
  }

  async function loadFirmWorkspace() {
    try {
      const response = await fetch("/api/firm-workspace", { cache: "no-store" });

      if (!response.ok) return;

      const payload = await response.json();
      setFirmWorkspace(payload);
    } catch {
      setFirmWorkspace(EMPTY_FIRM_WORKSPACE);
    }
  }

  async function loadBackendKernel() {
    try {
      const response = await fetch("/api/backend-kernel", { cache: "no-store" });

      if (!response.ok) return;

      const payload = await response.json();
      setKernel(payload.summary ?? payload);
    } catch {
      setKernel(null);
    }
  }

  async function runBackendAction(action: string, successMessage: string) {
    setBackendWorking(action);
    setBackendMessage("");

    try {
      const response = await fetch("/api/backend-kernel", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": action,
        },
        body: JSON.stringify({ action }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setBackendMessage(payload.error ?? "Backend action failed.");
        return;
      }

      setBackendMessage(payload.message ?? successMessage);
      await loadBackendKernel();
    } catch (error) {
      setBackendMessage(error instanceof Error ? error.message : "Backend action failed.");
    } finally {
      setBackendWorking("");
    }
  }

  useEffect(() => {
    if (typeof window !== "undefined") {
      const tab = parseWorkspaceTab(new URLSearchParams(window.location.search).get("tab"));
      if (tab) setActiveTab(tab);
    }

    void loadCommandCenter();
    void loadFirmWorkspace();
    void loadBackendKernel();
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.40),_transparent_33%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.16),_transparent_30%),linear-gradient(135deg,_#030712,_#050505,_#111827,_#1f0707)] p-4 text-white md:p-5">
      <div className="mx-auto flex max-w-[1900px] gap-5">
        <Sidebar activeTab={activeTab} setTab={setTab} />

        <section className="grid min-w-0 flex-1 gap-4">
          <Card className="p-4 xl:hidden">
            <div className="flex items-center gap-3">
              <LogoMark compact />
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
                  Slice
                </div>
                <div className="text-lg font-black text-white">Command Brain</div>
              </div>
            </div>

            <div className="mt-4 flex gap-2 overflow-x-auto pb-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setTab(tab.id)}
                  className={cx(
                    "shrink-0 rounded-2xl border px-3 py-2.5 text-xs font-black",
                    activeTab === tab.id
                      ? "border-white/25 bg-white text-slate-950"
                      : "border-white/10 bg-white/[0.045] text-white"
                  )}
                >
                  {tab.compact}
                </button>
              ))}
            </div>
          </Card>

          <Card className="p-4">
            <OrbitGraphic />

            <div className="relative grid gap-4 2xl:grid-cols-[1fr_330px] 2xl:items-center">
              <div className="flex min-w-0 gap-3">
                <div className="hidden sm:block">
                  <LogoMark />
                </div>
                <div className="min-w-0">
                  <div className="text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
                    One Command Center
                  </div>
                  <h1 className="mt-1.5 text-3xl font-black tracking-tight md:text-5xl">
                    The premium advisor workspace.
                  </h1>
                  <p className="mt-2 max-w-5xl text-sm leading-6 text-slate-400">
                    A client-presentable operating system connecting AI, firm delegation, clients, emails,
                    markets, intelligence, portfolio tools, client briefings, alerts, compliance, security, and backend health.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill tone={currentCommand.counts.unreadAlertCount ? "red" : "green"}>
                      {currentCommand.counts.unreadAlertCount} unread alerts
                    </Pill>
                    <Pill tone={overdueTasks.length ? "red" : "green"}>{overdueTasks.length} overdue tasks</Pill>
                    <Pill tone="amber">{tasksDueToday.length} due today</Pill>
                    <Pill tone="purple">{operations.sprintMetrics.ideas} ideas</Pill>
                    <Pill tone="cyan">{percent(currentCommand.readinessScore)} ready</Pill>
                    <Pill tone="red">Compliance-aware</Pill>
                  </div>
                </div>
              </div>

              <Panel tone={readinessTone} className="p-4">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <div className="text-[9px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Brain Score
                    </div>
                    <div className="mt-1 text-3xl font-black text-white">{percent(currentCommand.readinessScore)}</div>
                  </div>
                  <Pill tone={readinessTone}>
                    {advisorReadinessLabel(currentCommand.readinessScore)}
                  </Pill>
                </div>

                <div className="mt-3">
                  <ProgressBar value={currentCommand.readinessScore} tone={readinessTone} />
                </div>

                <div className="mt-3 grid grid-cols-2 gap-2">
                  <BeautifulButton href="/workspace/personal-bot" tone="cyan" compact>
                    Ask AI
                  </BeautifulButton>
                  <BeautifulButton href="/workspace?tab=compliance" tone="red" compact>
                    Review
                  </BeautifulButton>
                </div>
              </Panel>
            </div>
          </Card>

          <ExecutiveCommandStrip moduleCards={moduleCards} />

          {message ? (
            <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
              {message}
            </div>
          ) : null}

          {activeTab === "overview" ? (
            <section className="grid gap-4">
              <IntelligenceRibbon cards={ribbonCards} />

              <ClientShowcasePanel
                assets={currentCommand.counts.watchlistCount}
                clients={currentCommand.counts.clientCount}
                alerts={currentCommand.counts.totalAlertCount}
                ideas={operations.sprintMetrics.ideas}
              />

              <ComplianceStatusStrip />

              <CommandHealthPanel
                readiness={currentCommand.readinessScore}
                kernelReadiness={kernel?.readinessScore ?? 0}
                alerts={currentCommand.counts.unreadAlertCount}
                failedRuns={kernel?.metrics.failedRuns ?? 0}
                overdue={overdueTasks.length}
              />

              <SignalQualityPanel
                retained={currentCommand.counts.retainedDecisionCount}
                watchlists={currentCommand.counts.watchlistCount}
                deliveries={currentCommand.counts.deliveryCount}
                alerts={currentCommand.counts.totalAlertCount}
              />

              <AdoptionPanel moduleCards={moduleCards} readiness={currentCommand.readinessScore} />

              <div className="grid gap-4 2xl:grid-cols-[1.1fr_0.9fr]">
                <VisualModuleMap moduleCards={moduleCards} />

                <div className="grid gap-4">
                  <Card className="p-4">
                    <SectionTitle
                      eyebrow="Focus"
                      title="What needs attention now"
                      description="Overdue work, tasks due today, and immediate advisor follow-up."
                      compact
                    />

                    <div className="mt-4 grid max-h-[300px] gap-3 overflow-y-auto pr-2">
                      {[...overdueTasks, ...tasksDueToday].slice(0, 6).map((task) => (
                        <div key={task.id} className="rounded-2xl border border-white/10 bg-black/35 p-3">
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className="truncate font-black text-white">{task.title}</div>
                              <div className="mt-1 truncate text-xs text-slate-500">
                                {task.ownerName ?? "Team"} · Due {shortDate(task.dueDate)}
                              </div>
                            </div>
                            <Pill tone={priorityTone(task.priority)}>{task.priority}</Pill>
                          </div>
                          <p className="mt-2 line-clamp-2 text-xs leading-5 text-slate-400">
                            {task.detail || "No task detail."}
                          </p>
                        </div>
                      ))}

                      {!overdueTasks.length && !tasksDueToday.length ? (
                        <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                          Nothing urgent due today.
                        </div>
                      ) : null}
                    </div>
                  </Card>

                  <AdvisorWorkflowBlueprint
                    dueToday={tasksDueToday.length}
                    overdue={overdueTasks.length}
                    unreadAlerts={currentCommand.counts.unreadAlertCount}
                    clientCount={currentCommand.counts.clientCount}
                  />
                </div>
              </div>

              <CohesionMatrix moduleCards={moduleCards} />

              <CompactActivityPanel
                posts={operations.unifiedMessages ?? currentFirmWorkspace.posts ?? []}
                notifications={operations.openNotifications ?? []}
              />

              <Card className="p-4">
                <SectionTitle
                  eyebrow="Module Gallery"
                  title="All core tools, compact and connected"
                  description="The workspace emphasizes the highest-adoption tools, now with compliance guardrails included directly in the same portal."
                  compact
                />

                <div className="mt-4 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
                  {moduleCards.map((module) => (
                    <ModuleCard
                      key={module.id}
                      title={module.title}
                      description={module.description}
                      stats={module.meta}
                      primaryHref={module.href}
                      primaryLabel={module.button}
                      tone={module.tone}
                      icon={module.icon}
                    />
                  ))}
                </div>
              </Card>
            </section>
          ) : null}

          {activeTab === "command" ? (
            <GenericModule
              eyebrow="AI Command"
              title="Ask, draft, summarize, report, and operate"
              description="Use this tab when the platform needs to think, draft, explain, summarize, or generate. AI output is advisor-reviewed before it becomes client-facing."
              cards={[
                {
                  title: "AI Studio",
                  description: "Ask anything, use voice, create advisor-reviewed output, and turn rough thoughts into professional work.",
                  href: "/workspace/personal-bot",
                  button: "Open AI Studio",
                  tone: "cyan",
                  icon: "spark",
                  stats: [
                    ["Readiness", percent(currentCommand.readinessScore)],
                    ["Briefings", currentCommand.counts.briefingCount],
                  ],
                },
                {
                  title: "Compliance-Aware Drafting",
                  description: "Use AI to prepare client material while preserving review gates, sources, rationale, and archive requirements.",
                  href: "/workspace?tab=compliance",
                  button: "Open Guardrails",
                  tone: "red",
                  icon: "shield",
                  stats: [["Score", percent(SLICE_COMPLIANCE_PROFILE.readinessScore)]],
                },
                {
                  title: "Backend Kernel",
                  description: "Inspect vendors, jobs, queues, failed runs, and platform readiness.",
                  href: "/backend-kernel",
                  button: "Open Kernel",
                  tone: "red",
                  icon: "system",
                  stats: [
                    ["Readiness", percent(kernel?.readinessScore ?? 0)],
                    ["Failed Runs", kernel?.metrics.failedRuns ?? 0],
                  ],
                },
                {
                  title: "Advisor Command Center",
                  description: "Open the broader command module for platform-wide operations.",
                  href: "/advisor-command-center",
                  button: "Open Command Center",
                  tone: "purple",
                  icon: "brain",
                },
              ]}
            />
          ) : null}

          {activeTab === "team-board" ? <TeamBoardEmbedded /> : null}

          {activeTab === "firm-calendar" ? (
            <section className="grid gap-4">
              <Card className="p-5">
                <SectionTitle
                  eyebrow="Calendar"
                  title="Project deadlines, task due dates, and weekly execution"
                  description="A clean calendar view. Use Team Board for advanced delegation and reminders."
                  compact
                  action={
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => setCalendarMode(calendarMode === "week" ? "month" : "week")}
                        className="rounded-2xl border border-white/10 bg-white/5 px-4 py-2.5 text-sm font-black text-white hover:bg-white/10"
                      >
                        {calendarMode === "week" ? "Month View" : "Week View"}
                      </button>
                      <BeautifulButton href="/workspace/firm-command-center" tone="green" compact>
                        Full Center
                      </BeautifulButton>
                    </div>
                  }
                />

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <MetricCard label="Open" value={openFirmTasks.length} tone="amber" dense icon="target" />
                  <MetricCard label="Complete" value={completedFirmTasks.length} tone="green" dense icon="team" />
                  <MetricCard label="Projects" value={currentFirmWorkspace.projects.length} tone="purple" dense icon="flow" />
                  <MetricCard label="Deadlines" value={operations.sprintMetrics.deadlines} tone="red" dense icon="calendar" />
                </div>
              </Card>

              <div className="grid gap-4 xl:grid-cols-[1fr_390px]">
                <Card className="p-4">
                  <div className="mb-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                        {calendarMode === "week" ? "Week View" : monthTitle(calendarAnchor)}
                      </div>
                      <h2 className="mt-1 text-2xl font-black text-white">
                        {calendarMode === "week"
                          ? `${dayLabel(startOfWeek(calendarAnchor))} – ${dayLabel(addDays(startOfWeek(calendarAnchor), 6))}`
                          : "Monthly Execution"}
                      </h2>
                    </div>

                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCalendarAnchor(calendarMode === "week" ? addDays(calendarAnchor, -7) : addMonths(calendarAnchor, -1))}
                        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-black text-white hover:bg-white/10"
                      >
                        Prev
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          const current = ymd(new Date());
                          setCalendarAnchor(current);
                          setSelectedDay(current);
                        }}
                        className="rounded-2xl bg-white px-3 py-2 text-sm font-black text-slate-950"
                      >
                        Today
                      </button>
                      <button
                        type="button"
                        onClick={() => setCalendarAnchor(calendarMode === "week" ? addDays(calendarAnchor, 7) : addMonths(calendarAnchor, 1))}
                        className="rounded-2xl border border-white/10 bg-white/5 px-3 py-2 text-sm font-black text-white hover:bg-white/10"
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  {calendarMode === "week" ? (
                    <div className="grid gap-3 lg:grid-cols-7">
                      {weekDays.map((day) => {
                        const tasks = tasksByDay.get(day) ?? [];
                        const selected = selectedDay === day;

                        return (
                          <button
                            type="button"
                            key={day}
                            onClick={() => setSelectedDay(day)}
                            className={cx(
                              "min-h-[220px] rounded-[1.25rem] border p-3 text-left transition hover:bg-white/[0.08]",
                              selected ? "border-red-400/50 bg-red-500/10" : "border-white/10 bg-white/[0.035]"
                            )}
                          >
                            <div className="text-sm font-black text-white">{dayLabel(day)}</div>
                            <div className="mt-3 grid gap-2">
                              {tasks.slice(0, 5).map((task) => (
                                <CalendarTaskPill key={task.id} task={task} dense />
                              ))}
                              {tasks.length > 5 ? (
                                <div className="text-xs font-bold text-slate-500">
                                  +{tasks.length - 5} more
                                </div>
                              ) : null}
                              {!tasks.length ? (
                                <div className="rounded-xl border border-dashed border-white/10 p-3 text-center text-xs font-bold text-slate-600">
                                  Empty
                                </div>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  ) : (
                    <div className="grid grid-cols-7 gap-2">
                      {monthDays.map((day) => {
                        const tasks = tasksByDay.get(day) ?? [];
                        const selected = selectedDay === day;
                        const inMonth = monthStart(day) === monthStart(calendarAnchor);

                        return (
                          <button
                            key={day}
                            type="button"
                            onClick={() => setSelectedDay(day)}
                            className={cx(
                              "min-h-[108px] rounded-2xl border p-2 text-left transition hover:bg-white/[0.08]",
                              selected ? "border-red-400/50 bg-red-500/10" : "border-white/10 bg-white/[0.035]",
                              !inMonth && "opacity-40"
                            )}
                          >
                            <div className="text-xs font-black text-white">{monthDayLabel(day)}</div>
                            <div className="mt-1 grid gap-1">
                              {tasks.slice(0, 3).map((task) => (
                                <CalendarTaskPill key={task.id} task={task} dense />
                              ))}
                              {tasks.length > 3 ? <div className="text-[10px] font-bold text-slate-500">+{tasks.length - 3}</div> : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Card>

                <Card className="p-4">
                  <SectionTitle eyebrow="Selected Day" title={dayLabel(selectedDay)} compact />
                  <div className="mt-4 grid max-h-[520px] gap-3 overflow-y-auto pr-2">
                    {selectedDayTasks.map((task) => (
                      <CalendarTaskPill key={task.id} task={task} />
                    ))}
                    {!selectedDayTasks.length ? (
                      <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                        No tasks on this date.
                      </div>
                    ) : null}
                  </div>
                </Card>
              </div>
            </section>
          ) : null}

          {activeTab === "clients" ? (
            <GenericModule
              eyebrow="Clients"
              title="Client relationship command"
              description="Everything needed to prepare, document, and communicate with clients."
              cards={[
                {
                  title: "Client Profiles",
                  description: "Add clients, emails, household context, portfolio symbols, notes, tasks, and suitability details.",
                  href: "/client-profiles",
                  button: "Open Profiles",
                  tone: "purple",
                  icon: "client",
                  stats: [["Clients", currentCommand.counts.clientCount]],
                },
                {
                  title: "Client Briefings",
                  description: "Create source-backed, advisor-approved client communication without cluttering the main workspace.",
                  href: "/workspace/client-briefings",
                  button: "Open Briefings",
                  tone: "cyan",
                  icon: "report",
                  stats: [["Briefings", currentCommand.counts.briefingCount]],
                },
                {
                  title: "Client Email Center",
                  description: "Draft, polish, review, and prepare advisor-grade client emails.",
                  href: "/workspace/client-emails",
                  button: "Open Email Center",
                  tone: "green",
                  icon: "mail",
                  stats: [["Deliveries", currentCommand.counts.deliveryCount]],
                },
              ]}
            />
          ) : null}

          {activeTab === "emails" ? (
            <GenericModule
              eyebrow="Email Center"
              title="Client and advisor communication"
              description="Create polished, reviewed, source-aware communication with the AI Studio and email center."
              cards={[
                {
                  title: "Client Email Center",
                  description: "Generate and manage client emails from holdings, opportunities, and source-backed updates.",
                  href: "/workspace/client-emails",
                  button: "Open Email Center",
                  tone: "green",
                  icon: "mail",
                  stats: [["Deliveries", currentCommand.counts.deliveryCount]],
                },
                {
                  title: "Compliance Review Gates",
                  description: "Check whether a message contains recommendation, performance, testimonial, marketing, or privacy risk.",
                  href: "/workspace?tab=compliance",
                  button: "Open Compliance",
                  tone: "red",
                  icon: "shield",
                  stats: [["Guardrails", SLICE_COMPLIANCE_PROFILE.communicationGates.length]],
                },
                {
                  title: "Client Briefings",
                  description: "Create briefing drafts when communication needs a full explanation, source list, and approval gate.",
                  href: "/workspace/client-briefings",
                  button: "Open Briefings",
                  tone: "purple",
                  icon: "report",
                },
                {
                  title: "Notifications",
                  description: "Review queued, delivered, failed, and simulated notifications.",
                  href: "/notifications",
                  button: "Open Notifications",
                  tone: "amber",
                  icon: "bell",
                },
              ]}
            />
          ) : null}

          {activeTab === "watchlists" ? (
            <GenericModule
              eyebrow="Markets"
              title="Charts, watchlists, and market visuals"
              description="Advisor-ready market tools for technical awareness and opportunity monitoring."
              cards={[
                {
                  title: "Market Visuals",
                  description: "Technical charts, predictive analysis, scenario overlays, and TradingView context.",
                  href: "/market-visuals",
                  button: "Open Visuals",
                  tone: "red",
                  icon: "market",
                  stats: [["Watchlists", currentCommand.counts.watchlistCount]],
                },
                {
                  title: "Watchlist Alerts",
                  description: "Private advisor watchlists, technical criteria, and price/trigger alerts.",
                  href: "/watchlist-alerts",
                  button: "Open Watchlists",
                  tone: "amber",
                  icon: "bell",
                  stats: [["Alerts", currentCommand.counts.totalAlertCount]],
                },
                {
                  title: "Opportunity Radar",
                  description: "Source-backed opportunity monitoring, headline scanning, technical scoring, and advisor review gates.",
                  href: "/opportunity-radar",
                  button: "Open Radar",
                  tone: "cyan",
                  icon: "radar",
                  stats: [["Retained", currentCommand.counts.retainedDecisionCount]],
                },
              ]}
            />
          ) : null}

          {activeTab === "intelligence" ? (
            <GenericModule
              eyebrow="Intelligence"
              title="Source-backed opportunity intelligence"
              description="Scan the market, monitor signals, preserve rationale, and route anything client-facing through advisor review."
              cards={[
                {
                  title: "Opportunity Radar",
                  description: "Scan sources, score opportunities, retain decisions, and identify advisor follow-up.",
                  href: "/opportunity-radar",
                  button: "Open Radar",
                  tone: "red",
                  icon: "radar",
                  stats: [
                    ["Retained", currentCommand.counts.retainedDecisionCount],
                    ["Runs", currentCommand.counts.triageRunCount],
                  ],
                },
                {
                  title: "Intelligence Settings",
                  description: "Configure thresholds, urgency, source quality, notification preferences, and compliance review sensitivity.",
                  href: "/intelligence-settings",
                  button: "Open Settings",
                  tone: "cyan",
                  icon: "system",
                },
                {
                  title: "Email Center",
                  description: "Create client emails and advisor communications after review.",
                  href: "/workspace/client-emails",
                  button: "Open Email Center",
                  tone: "green",
                  icon: "mail",
                },
              ]}
            />
          ) : null}

          {activeTab === "portfolio" ? (
            <GenericModule
              eyebrow="Portfolio"
              title="Portfolio tools and investment context"
              description="Holdings, exposures, portfolio value, account context, model portfolios, and scenario analysis."
              cards={[
                {
                  title: "Portfolio Lab",
                  description: "Portfolio construction, holdings, exposures, and scenario tools.",
                  href: "/portfolio-lab",
                  button: "Open Portfolio Lab",
                  tone: "green",
                  icon: "portfolio",
                  stats: [
                    ["Accounts", currentCommand.counts.accountCount],
                    ["Holdings", currentCommand.counts.holdingCount],
                    ["Value", money(currentCommand.counts.portfolioTotalValue)],
                  ],
                },
                {
                  title: "Client Profiles",
                  description: "Review which securities clients hold without exposing unnecessary sensitive allocation details in AI prompts.",
                  href: "/client-profiles",
                  button: "Open Client Profiles",
                  tone: "purple",
                  icon: "client",
                  stats: [["Clients", currentCommand.counts.clientCount]],
                },
                {
                  title: "Market Visuals",
                  description: "Visualize technicals, moving averages, and relative performance before client meetings.",
                  href: "/market-visuals",
                  button: "Open Visuals",
                  tone: "red",
                  icon: "chart",
                },
              ]}
            />
          ) : null}

          {activeTab === "comparison" ? (
            <GenericModule
              eyebrow="Compare"
              title="Compare investments, risk, and client context"
              description="Use comparison tools when the advisor needs to explain tradeoffs clearly."
              cards={[
                {
                  title: "Market Visuals",
                  description: "Compare symbols, technical behavior, scenario paths, and price action.",
                  href: "/market-visuals",
                  button: "Compare Markets",
                  tone: "red",
                  icon: "compare",
                },
                {
                  title: "Portfolio Lab",
                  description: "Compare portfolio models, holdings, exposure, and scenario effects.",
                  href: "/portfolio-lab",
                  button: "Compare Portfolios",
                  tone: "green",
                  icon: "portfolio",
                },
                {
                  title: "AI Studio",
                  description: "Ask AI to explain tradeoffs, scenarios, risks, and meeting talking points for advisor review.",
                  href: "/workspace/personal-bot",
                  button: "Ask AI",
                  tone: "cyan",
                  icon: "spark",
                },
                {
                  title: "Compliance Gate",
                  description: "If comparison output becomes a recommendation, preserve rationale and route it through review.",
                  href: "/workspace?tab=compliance",
                  button: "Open Compliance",
                  tone: "red",
                  icon: "shield",
                },
              ]}
            />
          ) : null}

          {activeTab === "alternatives" ? (
            <GenericModule
              eyebrow="Alternatives"
              title="Private market and alternative investment workflow"
              description="Treat alternatives as high-supervision items with eligibility, suitability, source, risk, and approval controls."
              cards={[
                {
                  title: "Alternative Opportunity Review",
                  description: "Organize private-market ideas, source packages, eligibility notes, and approval-ready rationale.",
                  href: "/opportunity-radar",
                  button: "Open Radar",
                  tone: "amber",
                  icon: "diamond",
                  stats: [["Retained", currentCommand.counts.retainedDecisionCount]],
                },
                {
                  title: "Client Suitability Context",
                  description: "Review client profile, liquidity, time horizon, risk tolerance, and restrictions before any alternative idea is discussed.",
                  href: "/client-profiles",
                  button: "Open Profiles",
                  tone: "purple",
                  icon: "client",
                },
                {
                  title: "Compliance Review",
                  description: "Private investments should never be auto-sent. Route through advisor and compliance review before client delivery.",
                  href: "/workspace?tab=compliance",
                  button: "Open Compliance",
                  tone: "red",
                  icon: "shield",
                },
              ]}
            />
          ) : null}

          {activeTab === "briefings" ? (
            <GenericModule
              eyebrow="Reports"
              title="Client output and advisor-approved communication"
              description="The Reports area is focused on usable client communication and AI-generated output with source retention and approval gates."
              cards={[
                {
                  title: "Client Briefings",
                  description: "Create client-specific advisory notes, approval-gated briefings, and source-backed client updates.",
                  href: "/workspace/client-briefings",
                  button: "Open Client Briefings",
                  tone: "purple",
                  icon: "client",
                  stats: [["Briefings", currentCommand.counts.briefingCount]],
                },
                {
                  title: "AI Studio Output",
                  description: "Use AI Studio for custom summaries, meeting prep, visuals, scenarios, and advisor-reviewed writing.",
                  href: "/workspace/personal-bot",
                  button: "Open AI Studio",
                  tone: "cyan",
                  icon: "spark",
                  stats: [["Readiness", percent(currentCommand.readinessScore)]],
                },
                {
                  title: "Client Email Center",
                  description: "Draft, polish, approve, archive, and organize client-facing communication.",
                  href: "/workspace/client-emails",
                  button: "Open Email Center",
                  tone: "green",
                  icon: "mail",
                  stats: [["Deliveries", currentCommand.counts.deliveryCount]],
                },
                {
                  title: "Review Gates",
                  description: "Check client output for recommendation, performance, marketing, testimonial, and privacy issues.",
                  href: "/workspace?tab=compliance",
                  button: "Open Compliance",
                  tone: "red",
                  icon: "shield",
                },
              ]}
            />
          ) : null}

          {activeTab === "notifications" ? (
            <GenericModule
              eyebrow="Notifications"
              title="Alerts, delivery, and notification control"
              description="Review queued, delivered, failed, and simulated notifications before client-facing delivery."
              cards={[
                {
                  title: "Notifications Center",
                  description: "Review queued, delivered, failed, and simulated notifications.",
                  href: "/notifications",
                  button: "Open Notifications",
                  tone: "amber",
                  icon: "bell",
                  stats: [
                    ["Unread", currentCommand.counts.unreadAlertCount],
                    ["Total", currentCommand.counts.totalAlertCount],
                  ],
                },
                {
                  title: "Email Center",
                  description: "Convert alerts into advisor-reviewed client communication.",
                  href: "/workspace/client-emails",
                  button: "Open Email Center",
                  tone: "green",
                  icon: "mail",
                },
                {
                  title: "Compliance Gate",
                  description: "Client alerts that imply action, recommendation, or urgency should be reviewed before delivery.",
                  href: "/workspace?tab=compliance",
                  button: "Open Compliance",
                  tone: "red",
                  icon: "shield",
                },
              ]}
            />
          ) : null}

          {activeTab === "compliance" ? <ComplianceCenterModule /> : null}

          {activeTab === "security" ? (
            <GenericModule
              eyebrow="Security"
              title="Governance, disclosures, and audit posture"
              description="Maintain advisor review gates, security controls, audit trail awareness, and client-data safety."
              cards={[
                {
                  title: "Security Center",
                  description: "Review platform security, governance, and audit posture.",
                  href: "/security",
                  button: "Open Security",
                  tone: "red",
                  icon: "shield",
                  stats: [["Audit Logs", currentCommand.counts.auditLogCount]],
                },
                {
                  title: "Compliance Guardrails",
                  description: "Review advisor approval gates, AI output controls, books-and-records, and marketing review requirements.",
                  href: "/workspace?tab=compliance",
                  button: "Open Compliance",
                  tone: "red",
                  icon: "lock",
                  stats: [["Score", percent(SLICE_COMPLIANCE_PROFILE.readinessScore)]],
                },
                {
                  title: "Backend Readiness",
                  description: "Review external services, jobs, queues, and operational readiness.",
                  href: "/backend-readiness",
                  button: "Open Readiness",
                  tone: "cyan",
                  icon: "system",
                },
                {
                  title: "Required Disclosures",
                  description: "Track accepted and required disclosures.",
                  href: "/security",
                  button: "Review Disclosures",
                  tone: "amber",
                  icon: "lock",
                  stats: [
                    ["Accepted", currentCommand.counts.acceptedDisclosures ?? 0],
                    ["Required", currentCommand.counts.requiredDisclosures ?? 0],
                  ],
                },
              ]}
            />
          ) : null}

          {activeTab === "system" ? (
            <section className="grid gap-4">
              <Card className="p-5">
                <SectionTitle
                  eyebrow="System"
                  title="Backend and deployment readiness"
                  description="Run safe backend setup actions, inspect system readiness, and continue production hardening."
                  compact
                />

                <div className="mt-4 grid gap-3 md:grid-cols-4">
                  <MetricCard label="Kernel" value={percent(kernel?.readinessScore ?? 0)} tone="cyan" dense icon="system" />
                  <MetricCard label="Vendors" value={`${kernel?.metrics.configuredVendors ?? 0}/${kernel?.metrics.vendors ?? 0}`} tone="purple" dense icon="flow" />
                  <MetricCard label="Queued" value={kernel?.metrics.queuedDeliveries ?? 0} tone="amber" dense icon="bell" />
                  <MetricCard label="Failed" value={kernel?.metrics.failedRuns ?? 0} tone={(kernel?.metrics.failedRuns ?? 0) ? "red" : "green"} dense icon="target" />
                </div>

                <div className="mt-5 grid gap-3 md:grid-cols-3">
                  {[
                    ["seedBackendKernel", "Seed Backend Kernel", "Create default vendors, features, jobs, and readiness records."],
                    ["runHealthCheck", "Run Health Check", "Inspect the backend for missing service configuration."],
                    ["processQueuedDeliveries", "Process Queue", "Process pending delivery records where safe."],
                  ].map(([action, label, helper]) => (
                    <button
                      key={action}
                      type="button"
                      disabled={backendWorking === action}
                      onClick={() => runBackendAction(action, `${label} complete.`)}
                      className="rounded-2xl border border-white/10 bg-white/[0.055] p-4 text-left transition hover:bg-white/[0.09] disabled:opacity-50"
                    >
                      <div className="text-sm font-black text-white">{backendWorking === action ? "Working..." : label}</div>
                      <div className="mt-2 text-xs leading-5 text-slate-500">{helper}</div>
                    </button>
                  ))}
                </div>

                {backendMessage ? (
                  <div className="mt-5 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm font-bold text-cyan-100">
                    {backendMessage}
                  </div>
                ) : null}
              </Card>
            </section>
          ) : null}

          <Card className="p-4">
            <div className="grid gap-4 xl:grid-cols-[1fr_auto] xl:items-center">
              <div>
                <div className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                  Workspace Principle
                </div>
                <p className="mt-2 text-sm leading-6 text-slate-400">
                  Built to be used every day by a wealth management team: clean left navigation, compact visual information,
                  fewer distracting report/research entries, all high-value tools connected to one command brain, and compliance
                  factors added without burying the advisor experience.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <BeautifulButton href="/workspace?tab=team-board" tone="green" compact>
                  Team Board
                </BeautifulButton>
                <BeautifulButton href="/workspace/personal-bot" tone="cyan" compact>
                  AI Studio
                </BeautifulButton>
                <BeautifulButton href="/workspace?tab=compliance" tone="red" compact>
                  Compliance
                </BeautifulButton>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}