export type WorkspaceTone =
  | "emerald"
  | "lime"
  | "teal"
  | "cyan"
  | "sky"
  | "violet"
  | "amber"
  | "slate";

export type WorkspaceIconName =
  | "board"
  | "watch"
  | "visuals"
  | "intel"
  | "brief"
  | "portal"
  | "client"
  | "mail"
  | "spark"
  | "settings"
  | "shield"
  | "team";

export type WorkspaceCategory =
  | "Market"
  | "Client"
  | "Communication"
  | "AI"
  | "System"
  | "Team";

export type WorkspaceTool = {
  id: string;
  label: string;
  shortLabel: string;
  subtitle: string;
  description: string;
  icon: WorkspaceIconName;
  tone: WorkspaceTone;
  href: string;
  category: WorkspaceCategory;
  outcome: string;
  differentiator: string;
  tags: string[];
  orbit: {
    x: number;
    y: number;
  };
};

export type WorkspaceIdentity = {
  id: string;
  name: string;
  email: string;
};

export type FirmWorkspaceSummary = {
  firm: {
    id: string;
    name: string;
    firmEmail?: string | null;
    platformStatus?: string;
  } | null;
  membership: {
    id: string;
    role: string;
    canInviteMembers: boolean;
    canManageFirm: boolean;
  } | null;
  members: Array<{
    id: string;
    role: string;
    status: string;
    user?: {
      id: string;
      name: string;
      email: string;
    } | null;
  }>;
  invites: Array<{
    id: string;
    email: string;
    role: string;
    status: string;
    inviteCode: string;
    expiresAt?: string | null;
    createdAt: string;
  }>;
  operations?: {
    sprintMetrics?: {
      total?: number;
      open?: number;
      inProgress?: number;
      review?: number;
      blocked?: number;
      complete?: number;
      overdue?: number;
      ideas?: number;
      deadlines?: number;
      timedReminders?: number;
    };
    openNotifications?: unknown[];
  };
};

export type WorkspaceBriefSummary = {
  latest: {
    id: string;
    createdAt: string;
    brief: {
      title: string;
      generatedAt: string;
      providerMode: string;
      dataQuality: number;
      executiveSummary: string;
      topIndustries: Array<{
        id: string;
        name: string;
        rank: number;
        score: number;
      }>;
    };
  } | null;
};

export type SentTeamInvite = {
  id: string;
  email: string;
  role: string;
  firmName: string;
  inviteCode: string;
  inviteLink: string;
  expiresAt: string;
  deliveryStatus: "sent" | "simulated" | "failed" | "disabled";
  createdAt: string;
};

export const WORKSPACE_MARKET_SYMBOLS = [
  "SPY",
  "QQQ",
  "NVDA",
  "AAPL",
  "MSFT",
  "TLT",
  "GLD",
  "DXY",
] as const;

export const WORKSPACE_TOOLS: WorkspaceTool[] = [
  {
    id: "custom-board",
    label: "Custom Board",
    shortLabel: "Board",
    subtitle: "Security analysis",
    description:
      "Build a live market cockpit around any security, metric, indicator, and advisor workflow.",
    icon: "board",
    tone: "cyan",
    href: "/workspace/custom-board",
    category: "Market",
    outcome: "Analyze securities faster",
    differentiator: "Advisor-owned market cockpit",
    tags: ["board", "stock", "etf", "chart", "security", "analysis"],
    orbit: { x: 18, y: 22 },
  },
  {
    id: "watchlists",
    label: "Watchlists",
    shortLabel: "Watch",
    subtitle: "Rules and intervals",
    description:
      "Monitor criteria-based lists with independent scan intervals, alerts, and advisor review.",
    icon: "watch",
    tone: "amber",
    href: "/workspace/watchlists",
    category: "Market",
    outcome: "Track material change",
    differentiator: "Interval-based criteria monitoring",
    tags: ["watchlist", "alerts", "scan", "criteria", "threshold"],
    orbit: { x: 11, y: 52 },
  },
  {
    id: "market-visuals",
    label: "Market Visuals",
    shortLabel: "Visuals",
    subtitle: "Presentation desk",
    description:
      "Transform live market observations into decision-ready charts and advisor presentations.",
    icon: "visuals",
    tone: "sky",
    href: "/market-visuals",
    category: "Market",
    outcome: "Explain market context",
    differentiator: "Presentation-ready visual intelligence",
    tags: ["market", "charts", "visuals", "presentation"],
    orbit: { x: 20, y: 81 },
  },
  {
    id: "intelligence",
    label: "Intelligence",
    shortLabel: "Intel",
    subtitle: "Agentic research",
    description:
      "Combine real-time evidence, technical research, media pathways, and economic context.",
    icon: "intel",
    tone: "emerald",
    href: "/workspace/intelligence",
    category: "AI",
    outcome: "Surface signals earlier",
    differentiator: "Agentic Slice intelligence",
    tags: ["intelligence", "agents", "news", "technical", "forecast"],
    orbit: { x: 42, y: 91 },
  },
  {
    id: "brief",
    label: "Brief",
    shortLabel: "Brief",
    subtitle: "Autonomous market brief",
    description:
      "Review the top industries and securities with source-backed research and scheduled advisor email delivery.",
    icon: "brief",
    tone: "lime",
    href: "/workspace/brief",
    category: "AI",
    outcome: "Start informed",
    differentiator: "Autonomous source-backed briefing",
    tags: ["brief", "briefing", "industries", "stocks", "email", "research"],
    orbit: { x: 67, y: 88 },
  },
  {
    id: "client-portal-inbox",
    label: "Client Portal Inbox",
    shortLabel: "Portal",
    subtitle: "Client intent",
    description:
      "Review client messages, requests, documents, and account updates in one routed inbox.",
    icon: "portal",
    tone: "violet",
    href: "/workspace/client-portal-inbox",
    category: "Client",
    outcome: "Review client intent first",
    differentiator: "Client requests become workflows",
    tags: ["client", "portal", "inbox", "request", "document"],
    orbit: { x: 87, y: 67 },
  },
  {
    id: "client-profiles",
    label: "Client Profiles",
    shortLabel: "Clients",
    subtitle: "Relationship context",
    description:
      "Access households, objectives, holdings, risk preferences, notes, and assigned advisors.",
    icon: "client",
    tone: "teal",
    href: "/workspace/clients",
    category: "Client",
    outcome: "Know the client before acting",
    differentiator: "Context before recommendation",
    tags: ["client", "profiles", "household", "risk", "crm"],
    orbit: { x: 89, y: 36 },
  },
  {
    id: "document-center",
    label: "Secure Documents",
    shortLabel: "Documents",
    subtitle: "Private vault and processing",
    description:
      "Upload originals to private storage, verify fingerprints, classify files, control access, and review immutable audit history.",
    icon: "shield",
    tone: "emerald",
    href: "/workspace/documents",
    category: "Client",
    outcome: "Handle client files securely",
    differentiator: "Private storage with processing and audit",
    tags: [
      "documents",
      "document",
      "files",
      "vault",
      "upload",
      "download",
      "private storage",
      "audit",
    ],
    orbit: { x: 91, y: 50 },
  },
  {
    id: "email-center",
    label: "Email Center",
    shortLabel: "Email",
    subtitle: "Draft and approve",
    description:
      "Create, edit, approve, schedule, and send advisor-controlled client communications.",
    icon: "mail",
    tone: "cyan",
    href: "/workspace/client-emails",
    category: "Communication",
    outcome: "Communicate with control",
    differentiator: "AI drafts with advisor approval",
    tags: ["email", "draft", "approval", "communication"],
    orbit: { x: 77, y: 12 },
  },
  {
    id: "ai-studio",
    label: "AI Studio",
    shortLabel: "AI",
    subtitle: "Command and prepare",
    description:
      "Summarize, prepare, route, research, and coordinate advisor work from a single AI cockpit.",
    icon: "spark",
    tone: "emerald",
    href: "/workspace/personal-bot?mode=studio",
    category: "AI",
    outcome: "Reduce preparation time",
    differentiator: "Advisor-specific AI operating layer",
    tags: ["ai", "studio", "assistant", "command", "summary"],
    orbit: { x: 51, y: 7 },
  },
  {
    id: "team-board",
    label: "Team Board",
    shortLabel: "Team",
    subtitle: "Delegate and execute",
    description:
      "Manage ranked work, delegated tasks, reminders, shared documents, and completion events.",
    icon: "team",
    tone: "lime",
    href: "/workspace/team-board",
    category: "Team",
    outcome: "Execute as a firm",
    differentiator: "Advisor execution beside intelligence",
    tags: ["team", "tasks", "delegation", "calendar", "docs"],
    orbit: { x: 31, y: 9 },
  },
  {
    id: "compliance",
    label: "Compliance Center",
    shortLabel: "Compliance",
    subtitle: "Review gates",
    description:
      "Apply visible review gates, records, disclosures, and advisor guardrails before delivery.",
    icon: "shield",
    tone: "amber",
    href: "/security?panel=compliance",
    category: "System",
    outcome: "Review before delivery",
    differentiator: "Compliance inside the workflow",
    tags: ["compliance", "security", "review", "records"],
    orbit: { x: 8, y: 36 },
  },
  {
    id: "settings",
    label: "Workspace Settings",
    shortLabel: "Settings",
    subtitle: "Preferences and defaults",
    description:
      "Control appearance, notifications, advisor defaults, security, and connected services.",
    icon: "settings",
    tone: "slate",
    href: "/workspace/settings",
    category: "System",
    outcome: "Personalize the operating system",
    differentiator: "Advisor-controlled experience",
    tags: ["settings", "theme", "notifications", "security"],
    orbit: { x: 7, y: 72 },
  },
];

export const TEAM_ROLE_OPTIONS = [
  "Principal Advisor",
  "Lead Advisor",
  "Senior Wealth Advisor",
  "Associate Advisor",
  "Service Advisor",
  "Portfolio Manager",
  "Investment Analyst",
  "Financial Planning Analyst",
  "Paraplanner",
  "Client Service Associate",
  "Relationship Manager",
  "Operations Associate",
  "Compliance Officer",
  "Chief Compliance Officer",
  "Admin",
  "Ops",
] as const;

export function searchWorkspaceTools(query: string) {
  const normalized = query.trim().toLowerCase();

  if (!normalized) {
    return WORKSPACE_TOOLS.slice(0, 8);
  }

  return WORKSPACE_TOOLS.map((tool) => {
    const fields = [
      tool.label,
      tool.shortLabel,
      tool.subtitle,
      tool.description,
      tool.category,
      tool.outcome,
      tool.differentiator,
      tool.href,
      ...tool.tags,
    ];
    const haystack = fields.join(" ").toLowerCase();
    const words = normalized.split(/\s+/).filter(Boolean);
    let score = 0;

    if (tool.label.toLowerCase().startsWith(normalized)) {
      score += 100;
    }

    if (tool.label.toLowerCase().includes(normalized)) {
      score += 70;
    }

    if (haystack.includes(normalized)) {
      score += 40;
    }

    score += words.filter((word) => haystack.includes(word)).length * 12;

    return { tool, score };
  })
    .filter((item) => item.score > 0)
    .sort((left, right) => right.score - left.score)
    .map((item) => item.tool)
    .slice(0, 10);
}

export function compactNumber(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    notation: "compact",
    maximumFractionDigits: 2,
  });
}

export function money(
  value: number | null | undefined,
  currency = "USD",
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency,
    maximumFractionDigits: value < 10 ? 4 : 2,
  });
}

export function signedPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${value > 0 ? "+" : ""}${value.toFixed(2)}%`;
}

export function shortDateTime(value: string | null | undefined) {
  if (!value) {
    return "—";
  }

  const date = new Date(value);

  return Number.isFinite(date.getTime())
    ? date.toLocaleString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
      })
    : value;
}