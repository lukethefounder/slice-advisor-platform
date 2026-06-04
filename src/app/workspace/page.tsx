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
  { id: "emails", label: "Email Center", compact: "Email", description: "Draft/send", icon: "mail", tone: "green", group: "Advisor" },
  { id: "notifications", label: "Alerts", compact: "Alerts", description: "Delivery", icon: "bell", tone: "amber", group: "Advisor" },
  { id: "watchlists", label: "Markets", compact: "Markets", description: "Visuals", icon: "market", tone: "amber", group: "Markets" },
  { id: "intelligence", label: "Intelligence", compact: "Intel", description: "Signals", icon: "signal", tone: "red", group: "Markets" },
  { id: "portfolio", label: "Portfolio", compact: "Portfolio", description: "Holdings", icon: "portfolio", tone: "green", group: "Markets" },
  { id: "comparison", label: "Compare", compact: "Compare", description: "Risk", icon: "compare", tone: "slate", group: "Markets" },
  { id: "alternatives", label: "Alternatives", compact: "Alts", description: "Private", icon: "diamond", tone: "amber", group: "Markets" },
  { id: "briefings", label: "Reports", compact: "Reports", description: "PDFs", icon: "report", tone: "cyan", group: "Research" },
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

function compactNumber(value: number) {
  return new Intl.NumberFormat("en-US", {
    notation: "compact",
    maximumFractionDigits: 1,
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
        <path d="M5 16l.7 1.6L7.3 18l-1.6.7L5 20.3l-.7-1.6L2.7 18l1.6-.7L5 16z" />
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
        <path d="M7 7V5.5A1.5 1.5 0 0 1 8.5 4h7A1.5 1.5 0 0 1 17 5.5V7" />
        <path d="M4 7h16v12H4z" />
        <path d="M4 12h16" />
        <path d="M10 11h4v3h-4z" />
      </svg>
    );
  }

  if (name === "compare") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M7 7h13" />
        <path d="M17 4l3 3l-3 3" />
        <path d="M17 17H4" />
        <path d="M7 14l-3 3l3 3" />
      </svg>
    );
  }

  if (name === "diamond") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M12 3l8 7l-8 11L4 10z" />
        <path d="M4 10h16" />
        <path d="M9 10l3 11l3-11" />
        <path d="M8 4l4 6l4-6" />
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
        <path d="M9 18h3" />
      </svg>
    );
  }

  if (name === "shield") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M12 3l8 3v6c0 4.7-3.2 7.8-8 9c-4.8-1.2-8-4.3-8-9V6z" />
        <path d="M9 12l2 2l4-5" />
      </svg>
    );
  }

  if (name === "system") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M12 8a4 4 0 1 0 0 8a4 4 0 0 0 0-8z" />
        <path d="M4 12H2" />
        <path d="M22 12h-2" />
        <path d="M12 4V2" />
        <path d="M12 22v-2" />
        <path d="M5.6 5.6L4.2 4.2" />
        <path d="M19.8 19.8l-1.4-1.4" />
        <path d="M18.4 5.6l1.4-1.4" />
        <path d="M4.2 19.8l1.4-1.4" />
      </svg>
    );
  }

  if (name === "radar") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M12 12l7-7" />
        <path d="M12 12m-2 0a2 2 0 1 0 4 0a2 2 0 1 0-4 0" />
        <path d="M4 12a8 8 0 1 0 8-8" />
        <path d="M2 12a10 10 0 1 0 10-10" />
      </svg>
    );
  }

  if (name === "target") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M12 21a9 9 0 1 0 0-18a9 9 0 0 0 0 18z" />
        <path d="M12 17a5 5 0 1 0 0-10a5 5 0 0 0 0 10z" />
        <path d="M12 13a1 1 0 1 0 0-2a1 1 0 0 0 0 2z" />
      </svg>
    );
  }

  if (name === "flow") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M5 6h4v4H5z" />
        <path d="M15 14h4v4h-4z" />
        <path d="M9 8h3a3 3 0 0 1 3 3v3" />
        <path d="M13 12l2 2l2-2" />
      </svg>
    );
  }

  if (name === "chart") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M4 19h16" />
        <path d="M7 16V9" />
        <path d="M12 16V5" />
        <path d="M17 16v-4" />
      </svg>
    );
  }

  if (name === "lock") {
    return (
      <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
        <path d="M7 11V8a5 5 0 0 1 10 0v3" />
        <path d="M5 11h14v10H5z" />
        <path d="M12 15v2" />
      </svg>
    );
  }

  return (
    <svg viewBox="0 0 24 24" className={common} {...strokeProps}>
      <path d="M12 3l8 6v6l-8 6l-8-6V9z" />
      <path d="M12 8v8" />
      <path d="M8 12h8" />
    </svg>
  );
}

function IconBadge({
  icon,
  tone,
  size = "md",
}: {
  icon: IconName;
  tone: Tone;
  size?: "sm" | "md" | "lg";
}) {
  return (
    <div
      className={cx(
        "grid shrink-0 place-items-center rounded-2xl border shadow-lg",
        toneClasses[tone],
        size === "sm" && "h-8 w-8",
        size === "md" && "h-10 w-10",
        size === "lg" && "h-12 w-12"
      )}
    >
      <div
        className={cx(
          size === "sm" && "h-4 w-4",
          size === "md" && "h-5 w-5",
          size === "lg" && "h-6 w-6"
        )}
      >
        <IconSvg name={icon} />
      </div>
    </div>
  );
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
        "relative overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/74 shadow-2xl shadow-black/20 backdrop-blur-2xl",
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
  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.4rem] border border-white/10 bg-white/[0.052] p-4 shadow-xl shadow-black/10",
        className
      )}
    >
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glowClasses[tone])} />
      <div className="relative">{children}</div>
    </div>
  );
}

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.13em] shadow-sm",
        toneClasses[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function MetricCard({
  label,
  value,
  helper,
  tone = "slate",
  dense = false,
  icon,
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: Tone;
  dense?: boolean;
  icon?: IconName;
}) {
  return (
    <Panel tone={tone} className={cx("p-4", dense && "p-3")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[9px] font-black uppercase tracking-[0.17em] text-slate-500">
            {label}
          </div>
          <div className={cx("mt-1.5 truncate font-black text-white", dense ? "text-xl" : "text-2xl")}>
            {value}
          </div>
          {helper ? <div className="mt-1 truncate text-[11px] font-semibold text-slate-500">{helper}</div> : null}
        </div>
        {icon ? <IconBadge icon={icon} tone={tone} size="sm" /> : null}
      </div>
    </Panel>
  );
}

function ProgressBar({
  value,
  tone = "red",
}: {
  value: number;
  tone?: Exclude<Tone, "slate">;
}) {
  const fills: Record<Exclude<Tone, "slate">, string> = {
    red: "from-red-700 to-red-300",
    green: "from-emerald-700 to-emerald-300",
    amber: "from-amber-700 to-amber-300",
    purple: "from-purple-700 to-purple-300",
    cyan: "from-cyan-700 to-cyan-300",
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/50 ring-1 ring-white/10">
      <div
        className={cx("h-full rounded-full bg-gradient-to-r", fills[tone])}
        style={{ width: percent(value) }}
      />
    </div>
  );
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cx(
        "relative flex shrink-0 items-center justify-center rounded-[1.35rem] bg-gradient-to-br from-red-950 via-zinc-950 to-red-700 shadow-xl shadow-red-950/50 ring-1 ring-red-500/40",
        compact ? "h-10 w-10" : "h-12 w-12"
      )}
    >
      <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
      <div
        className={cx(
          "relative flex items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 font-black text-white shadow-inner",
          compact ? "h-7 w-7 text-sm" : "h-8 w-8 text-lg"
        )}
      >
        S
      </div>
      <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
      <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
    </div>
  );
}

function OrbitGraphic() {
  return (
    <div className="pointer-events-none absolute right-[-90px] top-[-95px] hidden h-[330px] w-[330px] opacity-95 lg:block">
      <div className="absolute inset-0 rounded-full border border-red-500/20" />
      <div className="absolute inset-10 rounded-full border border-cyan-500/20" />
      <div className="absolute inset-20 rounded-full border border-purple-500/20" />
      <div className="absolute left-1/2 top-1/2 h-16 w-16 -translate-x-1/2 -translate-y-1/2 rounded-full bg-gradient-to-br from-red-500 to-cyan-400 opacity-70 blur-xl" />
      <div className="absolute left-[66%] top-[17%] h-3 w-3 rounded-full bg-red-300 shadow-lg shadow-red-500/50" />
      <div className="absolute bottom-[25%] left-[12%] h-3 w-3 rounded-full bg-cyan-300 shadow-lg shadow-cyan-500/50" />
      <div className="absolute bottom-[10%] right-[28%] h-2.5 w-2.5 rounded-full bg-purple-300 shadow-lg shadow-purple-500/50" />
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
  action,
  compact = false,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className="flex flex-col gap-3 lg:flex-row lg:items-end lg:justify-between">
      <div className="min-w-0">
        {eyebrow ? (
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">
            {eyebrow}
          </div>
        ) : null}
        <h1 className={cx("mt-1.5 font-black tracking-tight text-white", compact ? "text-2xl md:text-3xl" : "text-3xl md:text-4xl")}>
          {title}
        </h1>
        {description ? (
          <p className={cx("mt-2 max-w-4xl leading-6 text-slate-400", compact ? "text-xs" : "text-sm")}>
            {description}
          </p>
        ) : null}
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

function CalendarTaskPill({
  task,
  dense = false,
}: {
  task: CalendarTask;
  dense?: boolean;
}) {
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
      <div
        className={cx(
          "truncate font-black",
          dense ? "text-[11px]" : "text-[12px]",
          complete ? "text-slate-500 line-through" : "text-white"
        )}
      >
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

function VisualModuleMap({
  moduleCards,
}: {
  moduleCards: ModuleCardConfig[];
}) {
  const featured = moduleCards.slice(0, 8);

  return (
    <Card className="p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">
            System Map
          </div>
          <h2 className="mt-1.5 text-2xl font-black text-white">Everything connects to the brain</h2>
        </div>
        <Pill tone="cyan">Client-ready view</Pill>
      </div>

      <div className="relative mt-4 overflow-hidden rounded-[1.5rem] border border-white/10 bg-black/35 p-4">
        <div className="absolute left-1/2 top-1/2 h-28 w-28 -translate-x-1/2 -translate-y-1/2 rounded-full bg-red-500/20 blur-3xl" />
        <div className="absolute left-1/2 top-1/2 h-36 w-36 -translate-x-1/2 -translate-y-1/2 rounded-full border border-red-400/20" />
        <div className="absolute left-1/2 top-1/2 h-64 w-64 -translate-x-1/2 -translate-y-1/2 rounded-full border border-cyan-400/10" />

        <div className="relative grid gap-3 lg:grid-cols-[1fr_220px_1fr]">
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

          <div className="grid place-items-center">
            <div className="relative grid h-52 w-52 place-items-center rounded-full border border-white/10 bg-gradient-to-br from-red-950/50 via-black to-cyan-950/30 shadow-2xl shadow-red-950/40">
              <div className="absolute inset-6 rounded-full border border-cyan-400/15" />
              <div className="absolute inset-12 rounded-full border border-red-400/20" />
              <div className="grid h-24 w-24 place-items-center rounded-[2rem] border border-white/15 bg-white text-slate-950 shadow-xl">
                <div className="h-12 w-12">
                  <IconSvg name="brain" />
                </div>
              </div>
              <div className="absolute bottom-8 text-center text-[10px] font-black uppercase tracking-[0.2em] text-slate-500">
                Command Brain
              </div>
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
    <Card className="p-4">
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {cards.map((card) => (
          <div
            key={card.title}
            className={cx(
              "relative overflow-hidden rounded-[1.35rem] border p-3",
              toneSoft[card.tone]
            )}
          >
            <div className={cx("absolute inset-x-0 top-0 h-16 bg-gradient-to-b to-transparent", glowClasses[card.tone])} />
            <div className="relative flex items-start gap-3">
              <IconBadge icon={card.icon} tone={card.tone} size="sm" />
              <div className="min-w-0">
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-slate-500">{card.title}</div>
                <div className="mt-1 text-xl font-black text-white">{card.value}</div>
                <div className="mt-0.5 truncate text-[11px] font-semibold text-slate-500">{card.helper}</div>
              </div>
            </div>
          </div>
        ))}
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
      title: "Sense",
      helper: "Scan alerts, sources, markets",
      tone: unreadAlerts ? "red" : "green",
      icon: "radar",
      stat: unreadAlerts,
      label: "Unread",
    },
    {
      title: "Think",
      helper: "Ask AI and generate briefings",
      tone: "cyan",
      icon: "spark",
      stat: "AI",
      label: "Studio",
    },
    {
      title: "Act",
      helper: "Delegate and follow up",
      tone: overdue ? "red" : dueToday ? "amber" : "green",
      icon: "team",
      stat: overdue || dueToday,
      label: overdue ? "Overdue" : "Due",
    },
    {
      title: "Serve",
      helper: "Prepare clients and emails",
      tone: "purple",
      icon: "client",
      stat: clientCount,
      label: "Clients",
    },
  ] as Array<{
    title: string;
    helper: string;
    tone: Tone;
    icon: IconName;
    stat: string | number;
    label: string;
  }>;

  return (
    <Card className="p-4">
      <SectionTitle
        eyebrow="Advisor Flow"
        title="A visual operating path"
        description="A wealth team should always know where work starts, where decisions happen, and where follow-through lives."
        compact
      />

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        {steps.map((step, index) => (
          <div key={step.title} className="relative">
            {index < steps.length - 1 ? (
              <div className="pointer-events-none absolute right-[-18px] top-1/2 hidden h-px w-9 bg-gradient-to-r from-white/20 to-transparent md:block" />
            ) : null}
            <div className={cx("rounded-[1.35rem] border p-3", toneSoft[step.tone])}>
              <div className="flex items-center justify-between gap-3">
                <IconBadge icon={step.icon} tone={step.tone} size="md" />
                <Pill tone={step.tone}>{step.label}</Pill>
              </div>
              <div className="mt-3 text-lg font-black text-white">{step.title}</div>
              <div className="mt-1 text-xs leading-5 text-slate-400">{step.helper}</div>
              <div className="mt-3 text-2xl font-black text-white">{step.stat}</div>
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
  const visiblePosts = posts.slice(0, 4);
  const visibleNotifications = notifications.slice(0, 4);

  return (
    <Card className="p-4">
      <SectionTitle
        eyebrow="Activity"
        title="Recent firm movement"
        description="A compact stream of workspace updates and notifications."
        compact
      />

      <div className="mt-4 grid gap-3 xl:grid-cols-2">
        <div className="grid gap-2">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Workspace Posts</div>
          {visiblePosts.map((post) => (
            <div key={post.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">{post.title}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{post.postType}</div>
                </div>
                <Pill tone={toneFor(post.postType)}>{post.postType}</Pill>
              </div>
            </div>
          ))}
          {!visiblePosts.length ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs font-bold text-slate-500">
              No workspace posts yet.
            </div>
          ) : null}
        </div>

        <div className="grid gap-2">
          <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Notifications</div>
          {visibleNotifications.map((item) => (
            <div key={item.id} className="rounded-2xl border border-white/10 bg-black/30 p-3">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="truncate text-sm font-black text-white">{item.title}</div>
                  <div className="mt-1 truncate text-xs text-slate-500">{item.body}</div>
                </div>
                <Pill tone={toneFor(item.urgency)}>{item.urgency}</Pill>
              </div>
            </div>
          ))}
          {!visibleNotifications.length ? (
            <div className="rounded-2xl border border-dashed border-white/10 p-4 text-center text-xs font-bold text-slate-500">
              No dashboard notifications yet.
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

function CohesionMatrix({
  moduleCards,
}: {
  moduleCards: ModuleCardConfig[];
}) {
  const categories = ["Command", "Firm", "Advisor", "Markets", "Research", "System"];

  return (
    <Card className="p-4">
      <SectionTitle
        eyebrow="Platform Cohesion"
        title="How the modules support the advisor team"
        description="Every major section has a clear role, visual identity, and route back to the central command brain."
        compact
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2 2xl:grid-cols-3">
        {categories.map((category) => {
          const items = moduleCards.filter((module) => module.category === category);
          const tone = items[0]?.tone ?? "slate";

          return (
            <div key={category} className={cx("rounded-[1.35rem] border p-3", toneSoft[tone])}>
              <div className="flex items-center justify-between gap-3">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{category}</div>
                  <div className="mt-1 text-lg font-black text-white">{items.length} module{items.length === 1 ? "" : "s"}</div>
                </div>
                <div className={cx("h-3 w-3 rounded-full shadow-lg", toneDot[tone])} />
              </div>

              <div className="mt-3 flex flex-wrap gap-2">
                {items.map((item) => (
                  <a
                    key={item.id}
                    href={item.href}
                    className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-black/30 px-3 py-1 text-[10px] font-black uppercase tracking-[0.13em] text-white transition hover:bg-white/10"
                  >
                    <span className="h-3.5 w-3.5">
                      <IconSvg name={item.icon} />
                    </span>
                    {item.title}
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
  const items: Array<{
    label: string;
    value: string | number;
    detail: string;
    tone: Tone;
    icon: IconName;
  }> = [
    {
      label: "Advisor Brain",
      value: percent(readiness),
      detail: advisorReadinessLabel(readiness),
      tone: readiness >= 75 ? "green" : readiness >= 45 ? "amber" : "red",
      icon: "brain",
    },
    {
      label: "Backend Kernel",
      value: percent(kernelReadiness),
      detail: kernelReadiness >= 75 ? "Healthy" : "Review services",
      tone: kernelReadiness >= 75 ? "green" : kernelReadiness >= 45 ? "amber" : "red",
      icon: "system",
    },
    {
      label: "Alert Load",
      value: alerts,
      detail: alerts ? "Needs review" : "Clear",
      tone: alerts ? "red" : "green",
      icon: "bell",
    },
    {
      label: "Execution Risk",
      value: overdue + failedRuns,
      detail: overdue || failedRuns ? "Follow up" : "Stable",
      tone: overdue || failedRuns ? "amber" : "green",
      icon: "target",
    },
  ];

  return (
    <Card className="p-4">
      <SectionTitle
        eyebrow="Command Health"
        title="Operational status at a glance"
        description="A production-grade advisor workspace should always show what is healthy, what needs review, and what needs action."
        compact
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => (
          <div key={item.label} className={cx("rounded-[1.35rem] border p-3", toneSoft[item.tone])}>
            <div className="flex items-center justify-between gap-3">
              <IconBadge icon={item.icon} tone={item.tone} size="md" />
              <Pill tone={item.tone}>{item.detail}</Pill>
            </div>
            <div className="mt-3 text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">{item.label}</div>
            <div className="mt-1 text-2xl font-black text-white">{item.value}</div>
          </div>
        ))}
      </div>
    </Card>
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
    <Card className="p-4">
      <div className="grid gap-4 xl:grid-cols-[1fr_340px] xl:items-center">
        <div>
          <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">
            Client-Presentable Layer
          </div>
          <h2 className="mt-1.5 text-2xl font-black text-white md:text-3xl">
            A workspace an advisor can confidently show a client.
          </h2>
          <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
            The dashboard frames the firm’s workflow professionally: intelligence enters the platform,
            the advisor reviews it, the team delegates action, and client communication becomes polished,
            trackable, and compliance-minded.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            <Pill tone="cyan">AI-assisted</Pill>
            <Pill tone="green">Action-oriented</Pill>
            <Pill tone="purple">Client-ready</Pill>
            <Pill tone="red">Source-aware</Pill>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <MetricCard label="Assets Watched" value={assets} helper="Watchlists" tone="amber" dense icon="market" />
          <MetricCard label="Clients" value={clients} helper="Profiles" tone="purple" dense icon="client" />
          <MetricCard label="Alerts" value={alerts} helper="Total" tone={alerts ? "red" : "green"} dense icon="bell" />
          <MetricCard label="Ideas" value={ideas} helper="Growth" tone="cyan" dense icon="spark" />
        </div>
      </div>
    </Card>
  );
}

function ExecutiveCommandStrip({
  moduleCards,
}: {
  moduleCards: ModuleCardConfig[];
}) {
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

function SignalQualityPanel({
  retained,
  research,
  watchlists,
  deliveries,
}: {
  retained: number;
  research: number;
  watchlists: number;
  deliveries: number;
}) {
  const rows: Array<{
    label: string;
    value: string | number;
    helper: string;
    tone: Tone;
    icon: IconName;
  }> = [
    {
      label: "Signal Discipline",
      value: retained,
      helper: "Retained opportunities",
      tone: retained ? "red" : "slate",
      icon: "radar",
    },
    {
      label: "Research Base",
      value: research,
      helper: "Stored research items",
      tone: "cyan",
      icon: "report",
    },
    {
      label: "Coverage",
      value: watchlists,
      helper: "Tracked watchlists",
      tone: "amber",
      icon: "market",
    },
    {
      label: "Delivery Trail",
      value: deliveries,
      helper: "Notification records",
      tone: "green",
      icon: "mail",
    },
  ];

  return (
    <Card className="p-4">
      <SectionTitle
        eyebrow="Signal Quality"
        title="Source-aware intelligence flow"
        description="Important information should become reviewable, explainable, and actionable before it reaches a client."
        compact
      />

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        {rows.map((row) => (
          <div key={row.label} className={cx("rounded-[1.25rem] border p-3", toneSoft[row.tone])}>
            <div className="flex items-start justify-between gap-3">
              <IconBadge icon={row.icon} tone={row.tone} size="sm" />
              <Pill tone={row.tone}>{row.value}</Pill>
            </div>
            <div className="mt-3 text-sm font-black text-white">{row.label}</div>
            <div className="mt-1 text-xs leading-5 text-slate-400">{row.helper}</div>
          </div>
        ))}
      </div>
    </Card>
  );
}

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [message, setMessage] = useState("");
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
      description: "Ask anything, generate advisor-ready output, create reports, use voice, and prepare client material.",
      tone: "cyan",
      icon: "spark",
      href: "/workspace/personal-bot",
      button: "Ask AI",
      category: "Command",
      meta: [
        ["Briefings", currentCommand.counts.briefingCount],
        ["Research", currentCommand.counts.researchCount],
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
      description: "Draft, refine, approve, and send advisor-grade client communication.",
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
      description: "Source-backed market and opportunity intelligence with triage scoring and alert delivery.",
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
      id: "reports",
      title: "Briefings",
      subtitle: "PDF output",
      description: "AI-generated briefings, client reports, founder reports, and advisor-ready PDFs.",
      tone: "cyan",
      icon: "report",
      href: "/workspace?tab=briefings",
      button: "Open Reports",
      category: "Research",
      meta: [
        ["Briefings", currentCommand.counts.briefingCount],
        ["Ideas", operations.sprintMetrics.ideas],
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
      title: "Client Base",
      value: currentCommand.counts.clientCount,
      helper: "Client profiles",
      tone: "purple",
      icon: "client",
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
                    markets, intelligence, portfolio tools, reports, alerts, security, and backend health.
                  </p>

                  <div className="mt-3 flex flex-wrap gap-2">
                    <Pill tone={currentCommand.counts.unreadAlertCount ? "red" : "green"}>
                      {currentCommand.counts.unreadAlertCount} unread alerts
                    </Pill>
                    <Pill tone={overdueTasks.length ? "red" : "green"}>{overdueTasks.length} overdue tasks</Pill>
                    <Pill tone="amber">{tasksDueToday.length} due today</Pill>
                    <Pill tone="purple">{operations.sprintMetrics.ideas} ideas</Pill>
                    <Pill tone="cyan">{percent(currentCommand.readinessScore)} ready</Pill>
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
                  <BeautifulButton href="/workspace?tab=team-board" tone="green" compact>
                    Delegate
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

              <CommandHealthPanel
                readiness={currentCommand.readinessScore}
                kernelReadiness={kernel?.readinessScore ?? 0}
                alerts={currentCommand.counts.unreadAlertCount}
                failedRuns={kernel?.metrics.failedRuns ?? 0}
                overdue={overdueTasks.length}
              />

              <SignalQualityPanel
                retained={currentCommand.counts.retainedDecisionCount}
                research={currentCommand.counts.researchCount}
                watchlists={currentCommand.counts.watchlistCount}
                deliveries={currentCommand.counts.deliveryCount}
              />

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
                  description="Every feature stays accessible without forcing the advisor team to hunt around the platform."
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
              description="Use this tab when the platform needs to think, draft, explain, summarize, or generate."
              cards={[
                {
                  title: "AI Studio",
                  description: "Ask anything, use voice, create reports, and turn rough thoughts into professional output.",
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
                              !inMonth && "opacity-45"
                            )}
                          >
                            <div className="text-xs font-black text-white">{monthDayLabel(day)}</div>
                            <div className="mt-2 grid gap-1">
                              {tasks.slice(0, 2).map((task) => (
                                <CalendarTaskPill key={task.id} task={task} dense />
                              ))}
                              {tasks.length > 2 ? (
                                <div className="text-[10px] font-bold text-slate-500">
                                  +{tasks.length - 2}
                                </div>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  )}
                </Card>

                <Card className="p-4">
                  <SectionTitle
                    eyebrow="Selected Day"
                    title={dayLabel(selectedDay)}
                    description={`${selectedDayTasks.length} due task(s).`}
                    compact
                  />

                  <div className="mt-4 grid max-h-[500px] gap-3 overflow-y-auto pr-2">
                    {selectedDayTasks.map((task) => (
                      <CalendarTaskPill key={task.id} task={task} />
                    ))}

                    {!selectedDayTasks.length ? (
                      <div className="rounded-2xl border border-dashed border-white/10 p-6 text-center text-sm font-bold text-slate-500">
                        No due tasks for this day.
                      </div>
                    ) : null}
                  </div>
                </Card>
              </div>
            </section>
          ) : null}

          {activeTab === "watchlists" ? (
            <GenericModule
              eyebrow="Markets"
              title="Markets, watchlists, and visuals"
              description="Track what matters, compare assets, and use market visuals for daily review."
              cards={[
                {
                  title: "Market Visuals",
                  description: "Advisor-grade charts, moving averages, comparisons, volume, RSI, MACD, and forecast ranges.",
                  href: "/market-visuals",
                  button: "Open Market Visuals",
                  tone: "red",
                  icon: "market",
                },
                {
                  title: "Watchlist Alerts",
                  description: "Watch tickers and event triggers that feed your triage engine.",
                  href: "/watchlist-alerts",
                  button: "Open Watchlists",
                  tone: "amber",
                  icon: "calendar",
                  stats: [["Tracked", currentCommand.counts.watchlistCount]],
                },
                {
                  title: "Opportunity Radar",
                  description: "Review AI-scored, source-backed opportunities.",
                  href: "/opportunity-radar",
                  button: "Open Radar",
                  tone: "purple",
                  icon: "radar",
                  stats: [["Retained", currentCommand.counts.retainedDecisionCount]],
                },
              ]}
            />
          ) : null}

          {activeTab === "comparison" ? (
            <GenericModule
              eyebrow="Compare"
              title="Advisor comparison layer"
              description="Compare assets, strategies, risk/reward, and opportunity signals."
              cards={[
                {
                  title: "Market Visuals Compare",
                  description: "Use the compare view for normalized asset performance, technical spreads, and relative analysis.",
                  href: "/market-visuals",
                  button: "Open Market Visuals",
                  tone: "red",
                  icon: "compare",
                },
                {
                  title: "Opportunity Radar",
                  description: "Compare retained signals, scores, risks, and source-backed opportunity records.",
                  href: "/opportunity-radar",
                  button: "Open Radar",
                  tone: "purple",
                  icon: "radar",
                },
                {
                  title: "Portfolio Lab",
                  description: "Compare holdings, client portfolios, and scenario models.",
                  href: "/portfolio-lab",
                  button: "Open Portfolio Lab",
                  tone: "green",
                  icon: "portfolio",
                },
              ]}
            />
          ) : null}

          {activeTab === "alternatives" ? (
            <GenericModule
              eyebrow="Alternatives"
              title="Alternative investments and venture tracking"
              description="Track private market opportunities, alternatives, venture notes, goals, and research."
              cards={[
                {
                  title: "Alternative Investments",
                  description: "Track and compare non-traditional investment ideas.",
                  href: "/alternative-investments",
                  button: "Open Alternatives",
                  tone: "amber",
                  icon: "diamond",
                  stats: [["Ventures", currentCommand.counts.ventureCount]],
                },
                {
                  title: "Research Notes",
                  description: "Capture investment theses and research links.",
                  href: "/briefings",
                  button: "Open Briefings",
                  tone: "cyan",
                  icon: "report",
                  stats: [["Research", currentCommand.counts.researchCount]],
                },
                {
                  title: "Opportunity Radar",
                  description: "Review scored opportunities from the triage engine.",
                  href: "/opportunity-radar",
                  button: "Open Radar",
                  tone: "red",
                  icon: "radar",
                },
              ]}
            />
          ) : null}

          {activeTab === "clients" ? (
            <GenericModule
              eyebrow="Clients"
              title="Client intelligence center"
              description="Manage client profiles, briefings, communications, and advisor-ready notes."
              cards={[
                {
                  title: "Client Profiles",
                  description: "Client records, holdings, notes, reviews, and risk profile context.",
                  href: "/workspace/clients",
                  button: "Open Clients",
                  tone: "purple",
                  icon: "client",
                  stats: [["Clients", currentCommand.counts.clientCount]],
                },
                {
                  title: "Client Briefings",
                  description: "Generate advisor-ready client briefings.",
                  href: "/workspace/client-briefings",
                  button: "Open Briefings",
                  tone: "cyan",
                  icon: "report",
                },
                {
                  title: "Client Email Center",
                  description: "Draft, polish, queue, approve, and send client emails.",
                  href: "/workspace/client-emails",
                  button: "Open Email Center",
                  tone: "green",
                  icon: "mail",
                },
              ]}
            />
          ) : null}

          {activeTab === "emails" ? (
            <GenericModule
              eyebrow="Email Center"
              title="Advisor-grade email workflow"
              description="Draft one email, draft many emails, polish, approve, and send communications safely."
              cards={[
                {
                  title: "Client Email Center",
                  description: "AI drafts, manual drafts, approval queueing, and live/simulated sending.",
                  href: "/workspace/client-emails",
                  button: "Open Email Center",
                  tone: "green",
                  icon: "mail",
                  stats: [
                    ["Clients", currentCommand.counts.clientCount],
                    ["Deliveries", currentCommand.counts.deliveryCount],
                  ],
                },
                {
                  title: "AI Studio",
                  description: "Ask the AI to draft, rewrite, summarize, or create client-ready language.",
                  href: "/workspace/personal-bot",
                  button: "Ask AI",
                  tone: "cyan",
                  icon: "spark",
                },
                {
                  title: "Notifications",
                  description: "Review whether email and dashboard alerts are being delivered.",
                  href: "/notifications",
                  button: "Open Delivery",
                  tone: "amber",
                  icon: "bell",
                },
              ]}
            />
          ) : null}

          {activeTab === "portfolio" ? (
            <GenericModule
              eyebrow="Portfolio"
              title="Portfolio lab"
              description="Review holdings, models, accounts, scenarios, and dashboard analytics."
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
                  title: "Market Visuals",
                  description: "Visualize prices, technicals, moving averages, and relative performance.",
                  href: "/market-visuals",
                  button: "Open Visuals",
                  tone: "red",
                  icon: "market",
                },
                {
                  title: "Alternative Investments",
                  description: "Track alternatives and private opportunities.",
                  href: "/alternative-investments",
                  button: "Open Alternatives",
                  tone: "amber",
                  icon: "diamond",
                },
              ]}
            />
          ) : null}

          {activeTab === "intelligence" ? (
            <GenericModule
              eyebrow="Intelligence"
              title="Signal and triage intelligence"
              description="Continuous scans, source credibility, AI briefings, and advisor-specific opportunities."
              cards={[
                {
                  title: "Opportunity Radar",
                  description: "Source-backed signals, AI briefings, credibility, urgency, and scoring.",
                  href: "/opportunity-radar",
                  button: "Open Radar",
                  tone: "red",
                  icon: "radar",
                  stats: [["Retained", currentCommand.counts.retainedDecisionCount]],
                },
                {
                  title: "Triage Runs",
                  description: "Review autonomous scan history and retained decision volume.",
                  href: "/intelligence-settings",
                  button: "Open Settings",
                  tone: "cyan",
                  icon: "system",
                  stats: [["Runs", currentCommand.counts.triageRunCount]],
                },
                {
                  title: "Watchlists",
                  description: "Tune what matters to each advisor.",
                  href: "/watchlist-alerts",
                  button: "Open Watchlists",
                  tone: "amber",
                  icon: "market",
                },
              ]}
            />
          ) : null}

          {activeTab === "notifications" ? (
            <GenericModule
              eyebrow="Notifications"
              title="Delivery and alert center"
              description="Review email, dashboard, and alert delivery events."
              cards={[
                {
                  title: "Notifications",
                  description: "Inspect deliveries, queued alerts, dashboard notifications, and failures.",
                  href: "/notifications",
                  button: "Open Notifications",
                  tone: "amber",
                  icon: "bell",
                  stats: [["Deliveries", currentCommand.counts.deliveryCount]],
                },
                {
                  title: "Alert Settings",
                  description: "Configure thresholds, urgency, and notification preferences.",
                  href: "/intelligence-settings",
                  button: "Open Settings",
                  tone: "cyan",
                  icon: "system",
                },
                {
                  title: "Email Center",
                  description: "Create client emails and advisor communications.",
                  href: "/workspace/client-emails",
                  button: "Open Email Center",
                  tone: "green",
                  icon: "mail",
                },
              ]}
            />
          ) : null}

          {activeTab === "briefings" ? (
            <GenericModule
              eyebrow="Briefings"
              title="Reports and advisor briefings"
              description="Generate and manage investment, client, and platform briefings."
              cards={[
                {
                  title: "AI Studio Reports",
                  description: "Generate presentation-ready reports through the AI Studio.",
                  href: "/workspace/personal-bot",
                  button: "Open AI Studio",
                  tone: "cyan",
                  icon: "spark",
                  stats: [["Briefings", currentCommand.counts.briefingCount]],
                },
                {
                  title: "Client Briefings",
                  description: "Create client-specific advisory notes and briefings.",
                  href: "/workspace/client-briefings",
                  button: "Open Client Briefings",
                  tone: "purple",
                  icon: "client",
                },
                {
                  title: "Founder / Advisor Reports",
                  description: "Review report readiness and platform output.",
                  href: "/briefings",
                  button: "Open Briefings",
                  tone: "red",
                  icon: "report",
                },
              ]}
            />
          ) : null}

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
                  Built to be used every day by a wealth management team: clean left navigation, compact visual information, and all tools connected to one command brain.
                </p>
              </div>

              <div className="flex flex-wrap gap-2">
                <BeautifulButton href="/workspace?tab=team-board" tone="green" compact>
                  Team Board
                </BeautifulButton>
                <BeautifulButton href="/workspace/personal-bot" tone="cyan" compact>
                  AI Studio
                </BeautifulButton>
                <BeautifulButton href="/market-visuals" tone="red" compact>
                  Market Visuals
                </BeautifulButton>
              </div>
            </div>
          </Card>
        </section>
      </div>
    </main>
  );
}