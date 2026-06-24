"use client";

import { ReactNode, useEffect, useMemo, useState } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "blue" | "slate";

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
  | "lock"
  | "settings"
  | "board"
  | "bot"
  | "search"
  | "light"
  | "portal"
  | "doc"
  | "message"
  | "check";

type WorkspaceMode = "guided" | "power" | "focus";

type Tab =
  | "overview"
  | "command"
  | "custom-board"
  | "client-portal"
  | "settings"
  | "clients"
  | "emails"
  | "briefings"
  | "notifications"
  | "markets"
  | "portfolio"
  | "intelligence"
  | "alternatives"
  | "firm"
  | "compliance"
  | "security"
  | "system";

type ModuleStatus = "Core" | "Ready" | "New" | "Review" | "Build";

type ModuleCardConfig = {
  id: string;
  title: string;
  shortTitle: string;
  subtitle: string;
  description: string;
  tone: Tone;
  icon: IconName;
  href: string;
  group: string;
  status: ModuleStatus;
  priority: number;
  recommended?: boolean;
  newFeature?: boolean;
  tags: string[];
  meta?: Array<[string, string | number]>;
};

type WorkspaceTabConfig = {
  id: Tab;
  label: string;
  compact: string;
  description: string;
  icon: IconName;
  tone: Tone;
  group: string;
  href?: string;
  isNew?: boolean;
};

type IntelligenceMetric = {
  label: string;
  value: string | number;
  helper: string;
  tone: Tone;
  icon: IconName;
};

type OperatingLane = {
  id: string;
  title: string;
  description: string;
  tone: Tone;
  icon: IconName;
  href: string;
  bullets: string[];
};

type ClientPortalPreviewItem = {
  title: string;
  detail: string;
  tone: Tone;
  icon: IconName;
  href: string;
  status: string;
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

const ACTIVE_TAB_KEY = "slice-workspace-active-tab-v5";
const MODE_KEY = "slice-workspace-mode-v5";
const FAVORITES_KEY = "slice-workspace-favorites-v5";

const defaultFavorites = [
  "custom-board",
  "client-portal-inbox",
  "settings",
  "ai-command",
  "client-emails",
];

const tabs: WorkspaceTabConfig[] = [
  {
    id: "overview",
    label: "Daily Brain",
    compact: "Brain",
    description: "Advisor home",
    icon: "brain",
    tone: "red",
    group: "Command",
  },
  {
    id: "command",
    label: "AI Command",
    compact: "AI",
    description: "Ask + build",
    icon: "spark",
    tone: "cyan",
    group: "Command",
  },
  {
    id: "custom-board",
    label: "Custom Board",
    compact: "Board",
    description: "TradingView + metrics",
    icon: "board",
    tone: "cyan",
    group: "Markets",
    href: "/workspace/custom-board",
    isNew: true,
  },
  {
    id: "client-portal",
    label: "Client Portal",
    compact: "Portal",
    description: "Client requests",
    icon: "portal",
    tone: "purple",
    group: "Advisor",
    href: "/workspace/client-portal-inbox",
    isNew: true,
  },
  {
    id: "settings",
    label: "Settings",
    compact: "Settings",
    description: "Theme + preferences",
    icon: "settings",
    tone: "blue",
    group: "System",
    href: "/workspace/settings",
    isNew: true,
  },
  {
    id: "clients",
    label: "Clients",
    compact: "Clients",
    description: "CRM",
    icon: "client",
    tone: "purple",
    group: "Advisor",
    href: "/workspace/clients",
  },
  {
    id: "emails",
    label: "Email Center",
    compact: "Email",
    description: "Draft/review",
    icon: "mail",
    tone: "green",
    group: "Advisor",
    href: "/workspace/client-emails",
  },
  {
    id: "briefings",
    label: "Reports",
    compact: "Reports",
    description: "Client output",
    icon: "report",
    tone: "cyan",
    group: "Advisor",
    href: "/workspace/client-briefings",
  },
  {
    id: "notifications",
    label: "Alerts",
    compact: "Alerts",
    description: "Delivery",
    icon: "bell",
    tone: "amber",
    group: "Advisor",
    href: "/watchlist-alerts",
  },
  {
    id: "markets",
    label: "Markets",
    compact: "Markets",
    description: "Visuals",
    icon: "market",
    tone: "amber",
    group: "Markets",
    href: "/market-visuals",
  },
  {
    id: "portfolio",
    label: "Portfolio",
    compact: "Portfolio",
    description: "Holdings",
    icon: "portfolio",
    tone: "green",
    group: "Markets",
    href: "/portfolio-lab",
  },
  {
    id: "intelligence",
    label: "Intelligence",
    compact: "Intel",
    description: "Signals",
    icon: "signal",
    tone: "red",
    group: "Research",
    href: "/intelligence",
  },
  {
    id: "alternatives",
    label: "Alternatives",
    compact: "Alts",
    description: "Private",
    icon: "diamond",
    tone: "amber",
    group: "Markets",
    href: "/alternative-investments",
  },
  {
    id: "firm",
    label: "Firm Ops",
    compact: "Firm",
    description: "Team + calendar",
    icon: "team",
    tone: "green",
    group: "Firm",
  },
  {
    id: "compliance",
    label: "Compliance",
    compact: "Compliance",
    description: "Review gates",
    icon: "shield",
    tone: "red",
    group: "System",
  },
  {
    id: "security",
    label: "Security",
    compact: "Security",
    description: "Audit",
    icon: "lock",
    tone: "red",
    group: "System",
    href: "/security",
  },
  {
    id: "system",
    label: "System",
    compact: "System",
    description: "Kernel",
    icon: "system",
    tone: "cyan",
    group: "System",
    href: "/system",
  },
];

const moduleCards: ModuleCardConfig[] = [
  {
    id: "custom-board",
    title: "Create Your Own Workspace",
    shortTitle: "Custom Board",
    subtitle: "TradingView + custom advisor metrics",
    description:
      "A customizable market board for each advisor with TradingView charts, any TradingView-style symbol, searchable metric catalog, 10-metric right rail, generated notification layers, and watchlist alert standards.",
    tone: "cyan",
    icon: "board",
    href: "/workspace/custom-board",
    group: "Markets",
    status: "New",
    priority: 100,
    recommended: true,
    newFeature: true,
    tags: ["tradingview", "stocks", "etf", "metrics", "watchlist", "alerts", "custom board"],
    meta: [
      ["Symbols", "TradingView"],
      ["Metrics", "Heavy"],
      ["Alerts", "Generated"],
    ],
  },
  {
    id: "client-portal-inbox",
    title: "Client Portal Inbox",
    shortTitle: "Client Portal",
    subtitle: "Hands-on client requests",
    description:
      "Advisor-facing intake center for client portal submissions: messages, meeting requests, document metadata, risk tolerance updates, permission changes, and buy/sell discussion requests.",
    tone: "purple",
    icon: "portal",
    href: "/workspace/client-portal-inbox",
    group: "Advisor",
    status: "New",
    priority: 99,
    recommended: true,
    newFeature: true,
    tags: ["client portal", "client requests", "messages", "documents", "risk survey", "permissions"],
    meta: [
      ["Requests", "Client"],
      ["Review", "Advisor"],
      ["Portal", "Invite"],
    ],
  },
  {
    id: "settings",
    title: "Enhanced Settings",
    shortTitle: "Settings",
    subtitle: "Theme, privacy, alerts, and AI defaults",
    description:
      "A platform-wide settings center for dark/red mode, light/blue mode, compact layout, accessibility, notifications, privacy, assistant visibility, and advisor AI behavior.",
    tone: "blue",
    icon: "settings",
    href: "/workspace/settings",
    group: "System",
    status: "New",
    priority: 98,
    recommended: true,
    newFeature: true,
    tags: ["settings", "theme", "dark mode", "light mode", "privacy", "notifications", "ai defaults"],
    meta: [
      ["Dark", "Black/red"],
      ["Light", "White/blue"],
      ["Saved", "Local"],
    ],
  },
  {
    id: "ai-command",
    title: "AI Command Center",
    shortTitle: "AI Command",
    subtitle: "Ask, build, route, and execute",
    description:
      "The central operating interface for advisor questions, workflow planning, platform control, analysis, summaries, and AI-guided execution.",
    tone: "red",
    icon: "spark",
    href: "/advisor-command-center",
    group: "Command",
    status: "Core",
    priority: 97,
    recommended: true,
    tags: ["ai", "command", "assistant", "workflow", "advisor os"],
    meta: [
      ["Mode", "Advisor OS"],
      ["Use", "Daily"],
      ["Speed", "Fast"],
    ],
  },
  {
    id: "advisor-os",
    title: "Advisor OS",
    shortTitle: "Advisor OS",
    subtitle: "Daily advisor operating system",
    description:
      "A broader advisor operating view for the day: priorities, work streams, intelligence, clients, system health, and strategic execution.",
    tone: "purple",
    icon: "brain",
    href: "/advisor-os",
    group: "Command",
    status: "Ready",
    priority: 96,
    recommended: true,
    tags: ["advisor os", "daily", "workflow", "command"],
    meta: [
      ["View", "OS"],
      ["Focus", "Daily"],
      ["Role", "Advisor"],
    ],
  },
  {
    id: "clients",
    title: "Client Profiles",
    shortTitle: "Clients",
    subtitle: "CRM and client intelligence",
    description:
      "Manage client profiles, household context, holdings, notes, risk profiles, objectives, and advisor-ready client records.",
    tone: "purple",
    icon: "client",
    href: "/workspace/clients",
    group: "Advisor",
    status: "Core",
    priority: 95,
    recommended: true,
    tags: ["clients", "crm", "profiles", "households", "holdings"],
    meta: [
      ["Data", "Client"],
      ["Use", "CRM"],
      ["Mode", "Profile"],
    ],
  },
  {
    id: "client-emails",
    title: "Email Center",
    shortTitle: "Email",
    subtitle: "AI drafts and approval-safe sending",
    description:
      "Create, edit, polish, queue, approve, and send client emails through the advisor-controlled communication workflow.",
    tone: "green",
    icon: "mail",
    href: "/workspace/client-emails",
    group: "Advisor",
    status: "Core",
    priority: 94,
    recommended: true,
    tags: ["email", "client communication", "drafts", "approval", "openai"],
    meta: [
      ["Drafts", "AI/manual"],
      ["Send", "Approval"],
      ["Review", "Required"],
    ],
  },
  {
    id: "client-briefings",
    title: "Client Briefings",
    shortTitle: "Briefings",
    subtitle: "Portfolio-aware client reports",
    description:
      "Generate client-ready briefings, holdings explanations, advisor summaries, and source-backed communication packages.",
    tone: "cyan",
    icon: "report",
    href: "/workspace/client-briefings",
    group: "Advisor",
    status: "Ready",
    priority: 91,
    tags: ["briefings", "reports", "client", "portfolio", "holdings"],
    meta: [
      ["Output", "Reports"],
      ["Review", "Advisor"],
      ["Data", "Holdings"],
    ],
  },
  {
    id: "personal-bot",
    title: "Personal Bot",
    shortTitle: "Personal Bot",
    subtitle: "Individualized advisor assistant",
    description:
      "A personalized assistant for advisor preferences, task style, notes, AI behavior, and individualized daily support.",
    tone: "cyan",
    icon: "bot",
    href: "/workspace/personal-bot",
    group: "Command",
    status: "Ready",
    priority: 90,
    tags: ["bot", "assistant", "personal", "memory", "preferences"],
    meta: [
      ["Mode", "Personal"],
      ["Memory", "Advisor"],
      ["Use", "Daily"],
    ],
  },
  {
    id: "watchlist-alerts",
    title: "Watchlist Alerts",
    shortTitle: "Alerts",
    subtitle: "Market notifications and standards",
    description:
      "Track watchlist movement, alert standards, market triggers, risk changes, and advisor-defined notification events.",
    tone: "amber",
    icon: "bell",
    href: "/watchlist-alerts",
    group: "Markets",
    status: "Ready",
    priority: 89,
    tags: ["watchlist", "alerts", "market", "triggers", "notifications"],
    meta: [
      ["Alerts", "Watchlist"],
      ["Signals", "Market"],
      ["Mode", "Trigger"],
    ],
  },
  {
    id: "opportunity-radar",
    title: "Opportunity Radar",
    shortTitle: "Radar",
    subtitle: "Market and opportunity discovery",
    description:
      "Review market opportunities, signal anomalies, idea flow, and advisor-relevant market movement in a focused radar view.",
    tone: "red",
    icon: "radar",
    href: "/opportunity-radar",
    group: "Markets",
    status: "Ready",
    priority: 88,
    tags: ["radar", "opportunities", "market", "signals"],
    meta: [
      ["Scan", "Radar"],
      ["Mode", "Ideas"],
      ["Focus", "Signals"],
    ],
  },
  {
    id: "portfolio-lab",
    title: "Portfolio Lab",
    shortTitle: "Portfolio",
    subtitle: "Holdings and allocation analysis",
    description:
      "Analyze holdings, allocation, risk context, comparison views, and advisor decision support inside a portfolio workspace.",
    tone: "green",
    icon: "portfolio",
    href: "/portfolio-lab",
    group: "Markets",
    status: "Ready",
    priority: 87,
    tags: ["portfolio", "holdings", "allocation", "risk", "analysis"],
    meta: [
      ["View", "Portfolio"],
      ["Risk", "Allocation"],
      ["Use", "Analysis"],
    ],
  },
  {
    id: "intelligence",
    title: "Intelligence",
    shortTitle: "Intel",
    subtitle: "Signals and research context",
    description:
      "Source-backed insight workspace for market context, intelligence summaries, signal review, and advisor decision support.",
    tone: "red",
    icon: "signal",
    href: "/intelligence",
    group: "Research",
    status: "Ready",
    priority: 86,
    tags: ["intelligence", "research", "signals", "sources"],
    meta: [
      ["Signals", "Research"],
      ["Mode", "Intel"],
      ["Sources", "Tracked"],
    ],
  },
  {
    id: "market-visuals",
    title: "Market Visuals",
    shortTitle: "Visuals",
    subtitle: "Charts and market dashboards",
    description:
      "Open the visual market workspace for market snapshots, chart-heavy views, and presentation-ready market context.",
    tone: "blue",
    icon: "chart",
    href: "/market-visuals",
    group: "Research",
    status: "Ready",
    priority: 85,
    tags: ["market", "visuals", "charts", "presentation"],
    meta: [
      ["Mode", "Visual"],
      ["Use", "Market"],
      ["View", "Charts"],
    ],
  },
  {
    id: "alternatives",
    title: "Alternative Investments",
    shortTitle: "Alternatives",
    subtitle: "Private markets and alternatives",
    description:
      "Review alternative investment ideas, private-market analysis, offering considerations, and advisor-facing opportunity workflows.",
    tone: "amber",
    icon: "diamond",
    href: "/alternative-investments",
    group: "Markets",
    status: "Review",
    priority: 80,
    tags: ["alternatives", "private markets", "private equity", "alts"],
    meta: [
      ["Category", "Alts"],
      ["Review", "Required"],
      ["Risk", "High"],
    ],
  },
  {
    id: "team-board",
    title: "Team Board",
    shortTitle: "Team",
    subtitle: "Firm execution and delegation",
    description:
      "Coordinate internal work, assign priorities, manage projects, and keep firm operations visible.",
    tone: "green",
    icon: "team",
    href: "/workspace?tab=firm",
    group: "Firm",
    status: "Ready",
    priority: 78,
    tags: ["team", "tasks", "projects", "firm", "delegation"],
    meta: [
      ["Mode", "Team"],
      ["Use", "Tasks"],
      ["Group", "Firm"],
    ],
  },
  {
    id: "backend-readiness",
    title: "Backend Readiness",
    shortTitle: "Readiness",
    subtitle: "Production wiring and system checks",
    description:
      "Review backend readiness, production controls, platform wiring, vendors, jobs, delivery health, and system status.",
    tone: "cyan",
    icon: "system",
    href: "/backend-readiness",
    group: "System",
    status: "Ready",
    priority: 76,
    tags: ["backend", "readiness", "system", "vendors", "production"],
    meta: [
      ["System", "Checks"],
      ["Mode", "Readiness"],
      ["Ops", "Kernel"],
    ],
  },
  {
    id: "security",
    title: "Security",
    shortTitle: "Security",
    subtitle: "Audit, protection, and risk controls",
    description:
      "Open the security center for audit posture, sensitive workflow protection, account safety, and operational hardening.",
    tone: "red",
    icon: "lock",
    href: "/security",
    group: "System",
    status: "Core",
    priority: 92,
    tags: ["security", "audit", "risk", "protection"],
    meta: [
      ["Audit", "Security"],
      ["Risk", "Controls"],
      ["Status", "Core"],
    ],
  },
  {
    id: "system",
    title: "System",
    shortTitle: "System",
    subtitle: "Platform kernel and operations",
    description:
      "Manage platform-level views, readiness, infrastructure, system controls, kernel posture, and operating tools.",
    tone: "cyan",
    icon: "system",
    href: "/system",
    group: "System",
    status: "Ready",
    priority: 74,
    tags: ["system", "kernel", "platform", "operations"],
    meta: [
      ["Kernel", "System"],
      ["Ops", "Platform"],
      ["View", "Control"],
    ],
  },
];

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
        "Workspace keeps communication, briefing, approval, and system areas connected.",
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
        "Client portal requests and documents are positioned as advisor-review intake.",
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
        "Intelligence, radar, custom board, and briefings are described as source-backed and retained.",
    },
  ] satisfies ComplianceControl[],
  communicationGates: [
    {
      id: "recommendation-gate",
      title: "Recommendation language",
      trigger:
        "Mentions buy, sell, hold, rebalance, allocate, switch, reduce, increase, suitability, or specific securities advice.",
      action:
        "Require advisor review, client objective context, suitability/risk rationale, and retained source package.",
      tone: "red",
    },
    {
      id: "client-portal-gate",
      title: "Client-submitted buy/sell request",
      trigger:
        "Client asks to buy, sell, hold, add, reduce, allocate, or discuss a specific stock, ETF, or security.",
      action:
        "Treat as client request for advisor review only. Do not treat as an executable order without the correct supervised workflow.",
      tone: "purple",
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
      id: "privacy-gate",
      title: "Client PII or nonpublic personal information",
      trigger:
        "Names, emails, account data, tax facts, estate details, SSNs, birth dates, custodial information, or household financial facts.",
      action:
        "Minimize, permission, route through approved channels, and record privacy handling.",
      tone: "red",
    },
  ] satisfies ComplianceGate[],
  booksAndRecordsPackage: [
    "Original AI prompt",
    "AI output",
    "Human edits",
    "Final approved version",
    "Client portal request",
    "Document metadata",
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
};

const operatingLanes: OperatingLane[] = [
  {
    id: "command-lane",
    title: "Command",
    description: "Ask, build, summarize, and route work from one AI command layer.",
    tone: "red",
    icon: "spark",
    href: "/advisor-command-center",
    bullets: ["Daily planning", "AI execution", "Workflow routing"],
  },
  {
    id: "market-lane",
    title: "Custom Board",
    description: "Use the TradingView board for charting, metrics, and alert layers.",
    tone: "cyan",
    icon: "board",
    href: "/workspace/custom-board",
    bullets: ["TradingView symbols", "Metric rail", "Generated alerts"],
  },
  {
    id: "client-lane",
    title: "Client Portal",
    description: "Review client-submitted messages, requests, documents, and risk updates.",
    tone: "purple",
    icon: "portal",
    href: "/workspace/client-portal-inbox",
    bullets: ["Client requests", "Risk updates", "Documents"],
  },
  {
    id: "settings-lane",
    title: "Settings",
    description: "Personalize appearance, accessibility, alerts, privacy, and AI defaults.",
    tone: "blue",
    icon: "settings",
    href: "/workspace/settings",
    bullets: ["Dark/light", "Privacy", "Advisor AI"],
  },
];

const intelligenceMetrics: IntelligenceMetric[] = [
  {
    label: "Command Readiness",
    value: "94%",
    helper: "Organized advisor home",
    tone: "green",
    icon: "brain",
  },
  {
    label: "Client Portal",
    value: "New",
    helper: "Hands-on client intake",
    tone: "purple",
    icon: "portal",
  },
  {
    label: "Market Board",
    value: "New",
    helper: "TradingView + metrics",
    tone: "cyan",
    icon: "board",
  },
  {
    label: "Settings",
    value: "Enhanced",
    helper: "Theme + privacy",
    tone: "blue",
    icon: "settings",
  },
];

const clientPortalPreviewItems: ClientPortalPreviewItem[] = [
  {
    title: "Client wants to discuss VOO",
    detail: "Buy discussion request routed to advisor review. Not an order.",
    tone: "purple",
    icon: "market",
    href: "/workspace/client-portal-inbox",
    status: "Review",
  },
  {
    title: "Risk tolerance update",
    detail: "Client submitted updated risk and preference survey.",
    tone: "amber",
    icon: "target",
    href: "/workspace/client-portal-inbox",
    status: "New",
  },
  {
    title: "Document metadata submitted",
    detail: "Client uploaded document metadata for advisor review.",
    tone: "cyan",
    icon: "doc",
    href: "/workspace/client-portal-inbox",
    status: "New",
  },
  {
    title: "Secure client message",
    detail: "Client sent a portal message connected to advisor account.",
    tone: "green",
    icon: "message",
    href: "/workspace/client-portal-inbox",
    status: "Inbox",
  },
];

const toneClasses: Record<Tone, string> = {
  red: "border-red-500/25 bg-red-500/10 text-red-100 shadow-red-950/20",
  green: "border-emerald-500/25 bg-emerald-500/10 text-emerald-100 shadow-emerald-950/20",
  amber: "border-amber-500/25 bg-amber-500/10 text-amber-100 shadow-amber-950/20",
  purple: "border-purple-500/25 bg-purple-500/10 text-purple-100 shadow-purple-950/20",
  cyan: "border-cyan-500/25 bg-cyan-500/10 text-cyan-100 shadow-cyan-950/20",
  blue: "border-blue-500/25 bg-blue-500/10 text-blue-100 shadow-blue-950/20",
  slate: "border-slate-500/20 bg-slate-500/10 text-slate-100 shadow-slate-950/20",
};

const glowClasses: Record<Tone, string> = {
  red: "from-red-500/20",
  green: "from-emerald-500/20",
  amber: "from-amber-500/20",
  purple: "from-purple-500/20",
  cyan: "from-cyan-500/20",
  blue: "from-blue-500/20",
  slate: "from-slate-400/10",
};

const toneDot: Record<Tone, string> = {
  red: "bg-red-400 shadow-red-400/50",
  green: "bg-emerald-400 shadow-emerald-400/50",
  amber: "bg-amber-400 shadow-amber-400/50",
  purple: "bg-purple-400 shadow-purple-400/50",
  cyan: "bg-cyan-400 shadow-cyan-400/50",
  blue: "bg-blue-400 shadow-blue-400/50",
  slate: "bg-slate-400 shadow-slate-400/50",
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseWorkspaceTab(value: string | null): Tab | null {
  if (!value) return null;
  return tabs.some((tab) => tab.id === value) ? (value as Tab) : null;
}

function loadWorkspaceMode(): WorkspaceMode {
  if (typeof window === "undefined") return "guided";

  const value = window.localStorage.getItem(MODE_KEY);
  if (value === "power" || value === "focus") return value;
  return "guided";
}

function saveWorkspaceMode(mode: WorkspaceMode) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(MODE_KEY, mode);
}

function loadFavorites() {
  if (typeof window === "undefined") return defaultFavorites;

  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY);
    if (!raw) return defaultFavorites;

    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return defaultFavorites;

    return parsed.filter((id) => typeof id === "string");
  } catch {
    return defaultFavorites;
  }
}

function saveFavorites(ids: string[]) {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(ids));
}

function IconGlyph({ name }: { name: IconName }) {
  const glyphs: Record<IconName, string> = {
    brain: "◉",
    spark: "✦",
    team: "☷",
    calendar: "□",
    client: "👥",
    mail: "✉",
    bell: "⚡",
    market: "▴",
    signal: "◌",
    portfolio: "▤",
    compare: "⇄",
    diamond: "◇",
    report: "▣",
    shield: "🛡",
    system: "▦",
    radar: "⌖",
    target: "◎",
    flow: "↬",
    chart: "▧",
    lock: "🔒",
    settings: "⚙",
    board: "◈",
    bot: "🤖",
    search: "⌕",
    light: "◐",
    portal: "◍",
    doc: "▥",
    message: "✉",
    check: "✓",
  };

  return <span>{glyphs[name]}</span>;
}

function LogoMark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cx(
        "relative grid place-items-center overflow-hidden rounded-[1.1rem] border border-red-500/35 bg-gradient-to-br from-red-500/25 via-black to-zinc-950 shadow-lg shadow-red-950/40",
        compact ? "h-11 w-11" : "h-14 w-14",
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
        className,
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
            : tone === "blue"
              ? "bg-blue-400"
              : tone === "slate"
                ? "bg-slate-400"
                : "bg-red-400";

  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className={cx("h-full rounded-full", fill)}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
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
        "grid shrink-0 place-items-center rounded-2xl border text-lg font-black shadow-lg",
        toneClasses[tone],
        size === "sm" ? "h-9 w-9" : size === "lg" ? "h-14 w-14 text-2xl" : "h-11 w-11",
      )}
    >
      <IconGlyph name={icon} />
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
        tone === "slate" ? "border-white/10 bg-white text-slate-950" : toneClasses[tone],
      )}
    >
      {children}
    </a>
  );
}

function Sidebar({
  activeTab,
  setTab,
  mode,
  setMode,
  favorites,
  toggleFavorite,
}: {
  activeTab: Tab;
  setTab: (tab: Tab) => void;
  mode: WorkspaceMode;
  setMode: (mode: WorkspaceMode) => void;
  favorites: string[];
  toggleFavorite: (id: string) => void;
}) {
  const groupedTabs = tabs.reduce<Record<string, WorkspaceTabConfig[]>>((acc, tab) => {
    acc[tab.group] = acc[tab.group] ?? [];
    acc[tab.group].push(tab);
    return acc;
  }, {});

  return (
    <aside className="sticky top-4 hidden h-[calc(100vh-2rem)] w-[322px] shrink-0 overflow-hidden rounded-[1.8rem] border border-white/10 bg-black/58 shadow-2xl shadow-black/35 backdrop-blur-2xl xl:block">
      <div className="border-b border-white/10 p-4">
        <div className="flex items-center gap-3">
          <LogoMark compact />
          <div className="min-w-0">
            <div className="text-[10px] font-black uppercase tracking-[0.22em] text-red-400">
              Slice
            </div>
            <div className="truncate text-lg font-black text-white">Command Brain</div>
            <div className="mt-0.5 text-[11px] font-semibold text-slate-500">
              Advisor intelligence center
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2 rounded-2xl border border-white/10 bg-white/[0.035] p-1.5">
          {(["guided", "power", "focus"] as WorkspaceMode[]).map((item) => (
            <button
              key={item}
              type="button"
              onClick={() => setMode(item)}
              className={cx(
                "rounded-xl px-2 py-2 text-xs font-black capitalize transition",
                mode === item ? "bg-white text-slate-950" : "text-slate-400 hover:bg-white/[0.055] hover:text-white",
              )}
            >
              {item}
            </button>
          ))}
        </div>
      </div>

      <div className="h-[calc(100%-174px)] overflow-y-auto p-3">
        <div className="space-y-4">
          {Object.entries(groupedTabs).map(([group, groupTabs]) => (
            <div key={group}>
              <div className="mb-2 px-2 text-[10px] font-black uppercase tracking-[0.22em] text-slate-500">
                {group}
              </div>
              <div className="grid gap-1.5">
                {groupTabs.map((tab) => {
                  const active = activeTab === tab.id;
                  const favorite = favorites.includes(tab.id);

                  return (
                    <div key={tab.id} className="group/tab flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => setTab(tab.id)}
                        className={cx(
                          "flex min-w-0 flex-1 items-center gap-3 rounded-2xl border px-3 py-2.5 text-left transition",
                          active ? "border-white bg-white text-slate-950" : "border-white/10 bg-white/[0.035] text-white hover:bg-white/[0.075]",
                        )}
                      >
                        <span
                          className={cx(
                            "grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-sm font-black",
                            active ? "border-slate-200 bg-slate-100 text-slate-950" : toneClasses[tab.tone],
                          )}
                        >
                          <IconGlyph name={tab.icon} />
                        </span>
                        <span className="min-w-0 flex-1">
                          <span className="flex items-center gap-2">
                            <span className="truncate text-sm font-black">{tab.label}</span>
                            {tab.isNew ? (
                              <span className={cx("rounded-full px-1.5 py-0.5 text-[8px] font-black uppercase", active ? "bg-blue-100 text-blue-700" : "bg-blue-500/15 text-blue-200")}>
                                New
                              </span>
                            ) : null}
                          </span>
                          <span className={cx("mt-0.5 block truncate text-[11px]", active ? "text-slate-600" : "text-slate-500")}>
                            {tab.description}
                          </span>
                        </span>
                      </button>

                      <button
                        type="button"
                        onClick={() => toggleFavorite(tab.id)}
                        className={cx(
                          "grid h-9 w-9 shrink-0 place-items-center rounded-xl border text-xs font-black transition",
                          favorite ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-white/10 bg-white/[0.035] text-slate-500 hover:text-white",
                        )}
                        aria-label={favorite ? "Remove favorite" : "Add favorite"}
                      >
                        ★
                      </button>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      <div className="border-t border-white/10 p-3">
        <div className="grid grid-cols-2 gap-2">
          <a
            href="/workspace/custom-board"
            className="rounded-2xl border border-cyan-500/25 bg-cyan-500/10 p-3 text-center text-xs font-black text-cyan-100"
          >
            Custom Board
          </a>
          <a
            href="/workspace/client-portal-inbox"
            className="rounded-2xl border border-purple-500/25 bg-purple-500/10 p-3 text-center text-xs font-black text-purple-100"
          >
            Portal Inbox
          </a>
        </div>
      </div>
    </aside>
  );
}

function MobileNavigation({
  activeTab,
  setTab,
}: {
  activeTab: Tab;
  setTab: (tab: Tab) => void;
}) {
  return (
    <div className="xl:hidden">
      <div className="flex gap-2 overflow-x-auto rounded-[1.35rem] border border-white/10 bg-black/50 p-2">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setTab(tab.id)}
            className={cx(
              "shrink-0 rounded-2xl border px-4 py-2 text-xs font-black",
              activeTab === tab.id ? "border-white bg-white text-slate-950" : toneClasses[tab.tone],
            )}
          >
            <IconGlyph name={tab.icon} /> {tab.compact}
          </button>
        ))}
      </div>
    </div>
  );
}

function ModuleCard({
  module,
  favorite,
  toggleFavorite,
  compact = false,
}: {
  module: ModuleCardConfig;
  favorite: boolean;
  toggleFavorite: (id: string) => void;
  compact?: boolean;
}) {
  return (
    <div className={cx("group relative flex h-full flex-col overflow-hidden rounded-[1.55rem] border shadow-xl transition hover:-translate-y-1 hover:scale-[1.01]", toneClasses[module.tone], compact ? "p-4" : "p-5")}>
      <div className="pointer-events-none absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-white/10 to-transparent opacity-70" />
      <div className="relative flex items-start justify-between gap-3">
        <a href={module.href} className="flex min-w-0 flex-1 items-start gap-3">
          <IconBadge icon={module.icon} tone={module.tone} />
          <div className="min-w-0">
            <div className="truncate text-xs font-black uppercase tracking-[0.16em] opacity-70">
              {module.subtitle}
            </div>
            <h3 className={cx("mt-1 truncate font-black tracking-tight text-white", compact ? "text-lg" : "text-2xl")}>
              {module.title}
            </h3>
          </div>
        </a>

        <button
          type="button"
          onClick={() => toggleFavorite(module.id)}
          className={cx(
            "rounded-full border px-2.5 py-1 text-xs font-black transition",
            favorite ? "border-amber-400/40 bg-amber-400/15 text-amber-100" : "border-white/10 bg-black/20 text-slate-400 hover:text-white",
          )}
        >
          ★
        </button>
      </div>

      <a href={module.href} className="relative mt-4 flex-1">
        <p className={cx("text-sm leading-6 text-slate-300", compact ? "line-clamp-2" : "line-clamp-3")}>
          {module.description}
        </p>
      </a>

      {!compact && module.meta?.length ? (
        <div className="relative mt-5 grid grid-cols-3 gap-2">
          {module.meta.map(([label, value]) => (
            <div key={`${module.id}-${label}`} className="rounded-2xl border border-white/10 bg-black/24 p-3">
              <div className="truncate text-[9px] font-black uppercase tracking-[0.15em] text-slate-500">
                {label}
              </div>
              <div className="mt-1 truncate text-sm font-black text-white">
                {value}
              </div>
            </div>
          ))}
        </div>
      ) : null}

      <div className="relative mt-4 flex items-center justify-between gap-2">
        <div className="flex flex-wrap gap-2">
          <Pill tone={module.tone}>{module.status}</Pill>
          {module.recommended ? <Pill tone="green">Recommended</Pill> : null}
          {module.newFeature ? <Pill tone="blue">New</Pill> : null}
        </div>

        <a href={module.href} className="inline-flex items-center gap-1 text-xs font-black text-white">
          Open <span className="transition group-hover:translate-x-1">→</span>
        </a>
      </div>
    </div>
  );
}

function OperatingLaneCard({ lane }: { lane: OperatingLane }) {
  return (
    <a href={lane.href} className={cx("rounded-[1.5rem] border p-5 shadow-lg transition hover:-translate-y-1", toneClasses[lane.tone])}>
      <div className="flex items-start justify-between gap-3">
        <IconBadge icon={lane.icon} tone={lane.tone} />
        <Pill tone={lane.tone}>Start</Pill>
      </div>
      <div className="mt-4 text-xl font-black text-white">{lane.title}</div>
      <p className="mt-2 text-sm leading-6 text-slate-400">{lane.description}</p>
      <div className="mt-4 grid gap-2">
        {lane.bullets.map((bullet) => (
          <div key={bullet} className="flex items-center gap-2 text-xs font-bold text-slate-300">
            <span className={cx("h-2 w-2 rounded-full shadow", toneDot[lane.tone])} />
            {bullet}
          </div>
        ))}
      </div>
    </a>
  );
}

function WorkstreamRow({
  title,
  detail,
  tone,
  href,
  status,
  icon,
}: {
  title: string;
  detail: string;
  tone: Tone;
  href: string;
  status: string;
  icon: IconName;
}) {
  return (
    <a href={href} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-white/[0.035] p-4 transition hover:bg-white/[0.075]">
      <div className="flex min-w-0 items-center gap-3">
        <IconBadge icon={icon} tone={tone} size="sm" />
        <div className="min-w-0">
          <div className="truncate text-sm font-black text-white">{title}</div>
          <div className="mt-0.5 truncate text-xs text-slate-500">{detail}</div>
        </div>
      </div>
      <Pill tone={tone}>{status}</Pill>
    </a>
  );
}

function ClientPortalPreview() {
  return (
    <Card className="p-5">
      <SectionTitle
        eyebrow="Client Portal"
        title="Hands-on client intake."
        description="Designed for more demanding clients who want to submit requests, documents, permissions, messages, and risk updates directly."
        compact
        action={<BeautifulButton href="/workspace/client-portal-inbox" tone="purple" compact>Open Inbox</BeautifulButton>}
      />

      <div className="mt-5 grid gap-3">
        {clientPortalPreviewItems.map((item) => (
          <WorkstreamRow
            key={item.title}
            title={item.title}
            detail={item.detail}
            tone={item.tone}
            href={item.href}
            status={item.status}
            icon={item.icon}
          />
        ))}
      </div>

      <div className="mt-4 rounded-2xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm leading-6 text-amber-50">
        Client buy/sell requests are intake items for advisor review. They are not automatic trade orders.
      </div>
    </Card>
  );
}

function OverviewTab({
  mode,
  favorites,
  toggleFavorite,
}: {
  mode: WorkspaceMode;
  favorites: string[];
  toggleFavorite: (id: string) => void;
}) {
  const recommended = moduleCards
    .filter((module) => module.recommended)
    .sort((a, b) => b.priority - a.priority);

  const favoriteModules = moduleCards
    .filter((module) => favorites.includes(module.id))
    .sort((a, b) => b.priority - a.priority);

  return (
    <div className="grid gap-5">
      <Card className="p-5">
        <OrbitGraphic />
        <div className="relative">
          <SectionTitle
            eyebrow="Daily Brain"
            title="Advisor intelligence center."
            description="The ultimate command center home page now organizes daily actions, client portal intake, market board workflows, AI command, settings, compliance, and system controls without overwhelming the advisor."
            action={
              <div className="flex flex-wrap gap-2">
                <BeautifulButton href="/workspace/custom-board" tone="cyan">Custom Board</BeautifulButton>
                <BeautifulButton href="/workspace/client-portal-inbox" tone="purple">Portal Inbox</BeautifulButton>
                <BeautifulButton href="/workspace/settings" tone="blue">Settings</BeautifulButton>
              </div>
            }
          />

          <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {intelligenceMetrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                helper={metric.helper}
                tone={metric.tone}
                icon={metric.icon}
              />
            ))}
          </div>
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1.2fr)_minmax(390px,0.8fr)]">
        <Card className="p-5">
          <SectionTitle
            eyebrow="Start Here"
            title="Four clear advisor flows."
            description="Everything is advanced, but the first screen makes the next action obvious."
            compact
            action={<Pill tone="green">Guided</Pill>}
          />

          <div className="mt-5 grid gap-4 md:grid-cols-2">
            {operatingLanes.map((lane) => (
              <OperatingLaneCard key={lane.id} lane={lane} />
            ))}
          </div>
        </Card>

        <ClientPortalPreview />
      </section>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <Card className="p-5">
          <SectionTitle
            eyebrow="Live Workstream"
            title="Today’s operating queue."
            description="Quickly jump to the next advisor action."
            compact
          />

          <div className="mt-5 grid gap-3">
            <WorkstreamRow
              title="Review client portal requests"
              detail="Messages, meeting requests, documents, risk updates, and buy/sell discussion requests."
              tone="purple"
              href="/workspace/client-portal-inbox"
              status="New"
              icon="portal"
            />
            <WorkstreamRow
              title="Review client communication drafts"
              detail="Email Center is approval-gated and ready for review."
              tone="green"
              href="/workspace/client-emails"
              status="Client"
              icon="mail"
            />
            <WorkstreamRow
              title="Open TradingView custom board"
              detail="Use advisor metric rails and notification layers."
              tone="cyan"
              href="/workspace/custom-board"
              status="Markets"
              icon="board"
            />
            <WorkstreamRow
              title="Tune workspace preferences"
              detail="Theme, privacy, notifications, accessibility, and AI defaults."
              tone="blue"
              href="/workspace/settings"
              status="Settings"
              icon="settings"
            />
            <WorkstreamRow
              title="Check compliance posture"
              detail="Review gates, prohibited automations, and records package."
              tone="red"
              href="/workspace?tab=compliance"
              status="Compliance"
              icon="shield"
            />
          </div>
        </Card>

        <Card className="p-5">
          <SectionTitle
            eyebrow="Decision Stack"
            title="Advisor-ready layers."
            description="A simple view of how client, market, AI, and compliance layers connect."
            compact
          />

          <div className="mt-5 grid gap-3">
            {[
              ["Client portal request received", "Advisor reviews intent and suitability context.", "purple", "portal", 92],
              ["Market board context prepared", "TradingView, metrics, and alert layers support the conversation.", "cyan", "board", 88],
              ["AI draft or summary prepared", "Output remains draft-only until reviewed.", "red", "spark", 84],
              ["Compliance gate checked", "Recommendation, performance, PII, and marketing risks are retained.", "green", "shield", 91],
            ].map(([title, detail, tone, icon, value]) => (
              <Panel key={title as string} tone={tone as Tone}>
                <div className="flex items-start gap-3">
                  <IconBadge icon={icon as IconName} tone={tone as Tone} />
                  <div className="min-w-0 flex-1">
                    <div className="font-black text-white">{title}</div>
                    <p className="mt-1 text-sm leading-6 text-slate-400">{detail}</p>
                    <div className="mt-3">
                      <ProgressBar value={value as number} tone={tone as Tone} />
                    </div>
                  </div>
                </div>
              </Panel>
            ))}
          </div>
        </Card>
      </section>

      <Card className="p-5">
        <SectionTitle
          eyebrow="Favorites"
          title={favoriteModules.length ? "Your saved workspace shortcuts." : "Add workspace favorites."}
          description="Favorite modules from the sidebar or cards. Advisors can keep their daily tools one click away."
          compact
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-4">
          {(favoriteModules.length ? favoriteModules : recommended.slice(0, 4)).map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              favorite={favorites.includes(module.id)}
              toggleFavorite={toggleFavorite}
              compact={mode === "power" || mode === "focus"}
            />
          ))}
        </div>
      </Card>

      {mode !== "focus" ? (
        <Card className="p-5">
          <SectionTitle
            eyebrow="Recommended"
            title="Most important workspace modules."
            description="The new additions are treated as first-class tools, not separate add-ons."
            compact
          />

          <div className="mt-5 grid gap-4 lg:grid-cols-2 2xl:grid-cols-3">
            {recommended.map((module) => (
              <ModuleCard
                key={module.id}
                module={module}
                favorite={favorites.includes(module.id)}
                toggleFavorite={toggleFavorite}
                compact={mode === "power"}
              />
            ))}
          </div>
        </Card>
      ) : null}
    </div>
  );
}

function LaunchTab({
  tab,
  title,
  description,
  href,
  tone,
  icon,
  features,
  favorites,
  toggleFavorite,
}: {
  tab: Tab;
  title: string;
  description: string;
  href: string;
  tone: Tone;
  icon: IconName;
  features: Array<[string, string, IconName, Tone]>;
  favorites: string[];
  toggleFavorite: (id: string) => void;
}) {
  const related = moduleCards
    .filter((module) => module.group === tabs.find((item) => item.id === tab)?.group || module.recommended)
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 4);

  return (
    <div className="grid gap-5">
      <Card className="p-5">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex min-w-0 gap-4">
            <IconBadge icon={icon} tone={tone} size="lg" />
            <div>
              <Pill tone={tone}>Workspace Module</Pill>
              <h1 className="mt-3 text-4xl font-black tracking-tight text-white md:text-5xl">{title}</h1>
              <p className="mt-3 max-w-4xl text-sm leading-7 text-slate-400">{description}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <BeautifulButton href={href} tone={tone}>Open Full Module</BeautifulButton>
            <button
              type="button"
              onClick={() => toggleFavorite(tab)}
              className={cx("rounded-2xl border px-4 py-3 text-sm font-black", favorites.includes(tab) ? toneClasses.amber : toneClasses.slate)}
            >
              ★ {favorites.includes(tab) ? "Favorited" : "Favorite"}
            </button>
          </div>
        </div>
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {features.map(([featureTitle, featureDescription, featureIcon, featureTone]) => (
          <Panel key={featureTitle} tone={featureTone}>
            <IconBadge icon={featureIcon} tone={featureTone} />
            <div className="mt-4 text-lg font-black text-white">{featureTitle}</div>
            <p className="mt-2 text-sm leading-6 text-slate-400">{featureDescription}</p>
          </Panel>
        ))}
      </section>

      <Card className="p-5">
        <SectionTitle
          eyebrow="Related"
          title="Connected workspace tools."
          description="Move to adjacent workflows without losing orientation."
          compact
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {related.map((module) => (
            <ModuleCard
              key={module.id}
              module={module}
              favorite={favorites.includes(module.id)}
              toggleFavorite={toggleFavorite}
              compact
            />
          ))}
        </div>
      </Card>
    </div>
  );
}

function ModuleGridTab({
  group,
  title,
  description,
  favorites,
  toggleFavorite,
  mode,
}: {
  group: string;
  title: string;
  description: string;
  favorites: string[];
  toggleFavorite: (id: string) => void;
  mode: WorkspaceMode;
}) {
  const groupModules = moduleCards
    .filter((module) => module.group === group || group === "All")
    .sort((a, b) => b.priority - a.priority);

  return (
    <div className="grid gap-5">
      <Card className="p-5">
        <SectionTitle
          eyebrow={group}
          title={title}
          description={description}
          action={<Pill tone="cyan">{groupModules.length} modules</Pill>}
        />
      </Card>

      <div className="grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
        {groupModules.map((module) => (
          <ModuleCard
            key={module.id}
            module={module}
            favorite={favorites.includes(module.id)}
            toggleFavorite={toggleFavorite}
            compact={mode === "power" || mode === "focus"}
          />
        ))}
      </div>
    </div>
  );
}

function ComplianceTab() {
  return (
    <div className="grid gap-5">
      <Card className="p-5">
        <SectionTitle
          eyebrow="Compliance Center"
          title="Advisor review and supervision posture."
          description={SLICE_COMPLIANCE_PROFILE.positioning}
          action={<Pill tone="green">{SLICE_COMPLIANCE_PROFILE.readinessScore}% readiness</Pill>}
        />

        <div className="mt-5 rounded-[1.35rem] border border-red-500/25 bg-red-500/10 p-4">
          <div className="text-sm font-black text-white">No-autosend rule</div>
          <p className="mt-2 text-sm leading-6 text-slate-300">{SLICE_COMPLIANCE_PROFILE.noAutoSendRule}</p>
        </div>
      </Card>

      <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
        <Card className="p-5">
          <SectionTitle
            eyebrow="Controls"
            title="Compliance controls."
            description="A structured overview of the current compliance-by-design controls."
            compact
          />

          <div className="mt-5 grid gap-3">
            {SLICE_COMPLIANCE_PROFILE.controls.map((control) => (
              <Panel key={control.id} tone={control.tone}>
                <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{control.ruleArea}</div>
                    <div className="mt-1 text-lg font-black text-white">{control.title}</div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{control.summary}</p>
                    <p className="mt-2 text-xs leading-5 text-slate-500">{control.evidence}</p>
                  </div>
                  <Pill tone={control.tone}>{control.status}</Pill>
                </div>
              </Panel>
            ))}
          </div>
        </Card>

        <div className="grid gap-5">
          <Card className="p-5">
            <SectionTitle
              eyebrow="Gates"
              title="Communication gates."
              description="Triggers that require review before use."
              compact
            />

            <div className="mt-5 grid gap-3">
              {SLICE_COMPLIANCE_PROFILE.communicationGates.map((gate) => (
                <Panel key={gate.id} tone={gate.tone}>
                  <div className="text-sm font-black text-white">{gate.title}</div>
                  <p className="mt-2 text-xs leading-5 text-slate-400">{gate.trigger}</p>
                  <p className="mt-2 text-xs leading-5 text-slate-500">{gate.action}</p>
                </Panel>
              ))}
            </div>
          </Card>

          <Card className="p-5">
            <SectionTitle
              eyebrow="Records"
              title="Books-and-records package."
              description="What should be retained in production."
              compact
            />

            <div className="mt-5 grid gap-2">
              {SLICE_COMPLIANCE_PROFILE.booksAndRecordsPackage.map((item) => (
                <div key={item} className="flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.035] px-3 py-2 text-sm font-bold text-slate-300">
                  <span className="h-2 w-2 rounded-full bg-green-400 shadow-lg shadow-green-400/50" />
                  {item}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </section>
    </div>
  );
}

function SystemTab() {
  return (
    <div className="grid gap-5">
      <Card className="p-5">
        <SectionTitle
          eyebrow="System Kernel"
          title="Platform operating controls."
          description="System readiness, production posture, security, backend health, client portal intake, and preference management are grouped here."
          action={<BeautifulButton href="/backend-readiness" tone="cyan">Backend Readiness</BeautifulButton>}
        />
      </Card>

      <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Backend" value="Ready" helper="Readiness dashboard" tone="cyan" icon="system" />
        <MetricCard label="Security" value="Core" helper="Audit and controls" tone="red" icon="lock" />
        <MetricCard label="Settings" value="Enhanced" helper="Theme + privacy" tone="blue" icon="settings" />
        <MetricCard label="Portal Intake" value="New" helper="Client requests" tone="purple" icon="portal" />
      </section>

      <Card className="p-5">
        <SectionTitle
          eyebrow="System Launches"
          title="System-level modules."
          description="Open deeper system tools without hunting through the entire workspace."
          compact
        />

        <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <BeautifulButton href="/workspace/settings" tone="blue">Settings</BeautifulButton>
          <BeautifulButton href="/workspace/client-portal-inbox" tone="purple">Portal Inbox</BeautifulButton>
          <BeautifulButton href="/security" tone="red">Security</BeautifulButton>
          <BeautifulButton href="/backend-readiness" tone="cyan">Backend Readiness</BeautifulButton>
          <BeautifulButton href="/system" tone="slate">System</BeautifulButton>
        </div>
      </Card>
    </div>
  );
}

function PowerMap({
  favorites,
  toggleFavorite,
}: {
  favorites: string[];
  toggleFavorite: (id: string) => void;
}) {
  const grouped = moduleCards.reduce<Record<string, ModuleCardConfig[]>>((acc, module) => {
    acc[module.group] = acc[module.group] ?? [];
    acc[module.group].push(module);
    return acc;
  }, {});

  return (
    <Card className="p-5">
      <SectionTitle
        eyebrow="Power Map"
        title="Full workspace map."
        description="Everything remains visible and accessible for power users, but still grouped by advisor workflow."
        compact
      />

      <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {Object.entries(grouped).map(([group, items]) => (
          <Panel key={group} tone={items[0]?.tone ?? "slate"}>
            <div className="flex items-center justify-between gap-2">
              <div>
                <div className="text-xs font-black uppercase tracking-[0.18em] text-slate-500">{group}</div>
                <div className="mt-1 text-xl font-black text-white">{items.length} tools</div>
              </div>
              <IconBadge icon={items[0]?.icon ?? "system"} tone={items[0]?.tone ?? "slate"} />
            </div>

            <div className="mt-4 grid gap-2">
              {items
                .sort((a, b) => b.priority - a.priority)
                .map((module) => (
                  <div key={module.id} className="flex items-center gap-2">
                    <a
                      href={module.href}
                      className="flex min-w-0 flex-1 items-center justify-between rounded-xl border border-white/10 bg-black/20 px-3 py-2 text-xs font-black text-white hover:bg-white/[0.075]"
                    >
                      <span className="truncate">{module.shortTitle}</span>
                      <span>→</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => toggleFavorite(module.id)}
                      className={cx(
                        "grid h-8 w-8 shrink-0 place-items-center rounded-xl border text-xs font-black",
                        favorites.includes(module.id) ? "border-amber-500/30 bg-amber-500/10 text-amber-200" : "border-white/10 bg-white/[0.035] text-slate-500",
                      )}
                    >
                      ★
                    </button>
                  </div>
                ))}
            </div>
          </Panel>
        ))}
      </div>
    </Card>
  );
}

export default function WorkspacePage() {
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [mode, setModeState] = useState<WorkspaceMode>("guided");
  const [favorites, setFavorites] = useState<string[]>(defaultFavorites);
  const [search, setSearch] = useState("");

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const tabFromUrl = parseWorkspaceTab(params.get("tab"));
    const savedTab = parseWorkspaceTab(window.localStorage.getItem(ACTIVE_TAB_KEY));

    setActiveTab(tabFromUrl ?? savedTab ?? "overview");
    setModeState(loadWorkspaceMode());
    setFavorites(loadFavorites());
  }, []);

  function setTab(tab: Tab) {
    setActiveTab(tab);

    if (typeof window !== "undefined") {
      window.localStorage.setItem(ACTIVE_TAB_KEY, tab);
      const url = new URL(window.location.href);
      url.searchParams.set("tab", tab);
      window.history.replaceState({}, "", url.toString());
    }
  }

  function setMode(modeValue: WorkspaceMode) {
    setModeState(modeValue);
    saveWorkspaceMode(modeValue);
  }

  function toggleFavorite(id: string) {
    setFavorites((current) => {
      const next = current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id];

      saveFavorites(next);
      return next;
    });
  }

  const activeTabConfig = tabs.find((tab) => tab.id === activeTab) ?? tabs[0];

  const searchResults = useMemo(() => {
    const query = search.trim().toLowerCase();

    if (!query) return [];

    return moduleCards
      .filter((module) =>
        [
          module.title,
          module.shortTitle,
          module.subtitle,
          module.description,
          module.group,
          module.status,
          ...module.tags,
        ]
          .join(" ")
          .toLowerCase()
          .includes(query),
      )
      .sort((a, b) => b.priority - a.priority)
      .slice(0, 8);
  }, [search]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.38),_transparent_34%),radial-gradient(circle_at_top_right,_rgba(14,165,233,0.14),_transparent_28%),linear-gradient(135deg,_#030712,_#050505,_#111827)] p-4 text-white">
      <div className="mx-auto flex max-w-[1900px] gap-4">
        <Sidebar
          activeTab={activeTab}
          setTab={setTab}
          mode={mode}
          setMode={setMode}
          favorites={favorites}
          toggleFavorite={toggleFavorite}
        />

        <div className="grid min-w-0 flex-1 gap-4">
          <header className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-black/70 p-5 shadow-2xl shadow-red-950/30 backdrop-blur-xl">
            <OrbitGraphic />

            <div className="relative grid gap-5 xl:grid-cols-[minmax(0,1fr)_470px] xl:items-center">
              <div>
                <div className="flex flex-wrap gap-2">
                  <Pill tone="red">Slice Workspace</Pill>
                  <Pill tone={activeTabConfig.tone}>{activeTabConfig.label}</Pill>
                  <Pill tone={mode === "guided" ? "amber" : mode === "focus" ? "green" : "purple"}>{mode} mode</Pill>
                  <Pill tone="cyan">Custom Board</Pill>
                  <Pill tone="purple">Client Portal</Pill>
                  <Pill tone="blue">Settings</Pill>
                </div>

                <h1 className="mt-4 text-4xl font-black tracking-tight text-white md:text-6xl">
                  Ultimate advisor command center.
                </h1>
                <p className="mt-3 max-w-5xl text-sm leading-7 text-slate-400 md:text-base">
                  A state-of-the-art intelligence center with sidebar navigation, guided
                  workflows, favorites, search, client portal intake, custom TradingView
                  market boards, platform settings, client communication, compliance posture,
                  and system controls in one organized advisor home.
                </p>
              </div>

              <div className="grid gap-3">
                <div className="rounded-[1.5rem] border border-white/10 bg-white/[0.045] p-3">
                  <div className="flex items-center gap-2">
                    <IconBadge icon="search" tone="cyan" size="sm" />
                    <input
                      value={search}
                      onChange={(event) => setSearch(event.target.value)}
                      placeholder="Search modules, settings, clients, portal, markets..."
                      className="min-w-0 flex-1 rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-bold text-white outline-none ring-red-500 placeholder:text-slate-600 focus:ring-2"
                    />
                  </div>

                  {searchResults.length ? (
                    <div className="mt-3 grid gap-2">
                      {searchResults.map((module) => (
                        <a
                          key={module.id}
                          href={module.href}
                          className="flex items-center justify-between gap-3 rounded-xl border border-white/10 bg-black/24 px-3 py-2 text-xs font-black text-white hover:bg-white/[0.075]"
                        >
                          <span className="truncate">{module.title}</span>
                          <span>→</span>
                        </a>
                      ))}
                    </div>
                  ) : null}
                </div>

                <div className="grid grid-cols-3 gap-3">
                  <BeautifulButton href="/workspace/custom-board" tone="cyan" compact>Board</BeautifulButton>
                  <BeautifulButton href="/workspace/client-portal-inbox" tone="purple" compact>Portal</BeautifulButton>
                  <BeautifulButton href="/workspace/settings" tone="blue" compact>Settings</BeautifulButton>
                </div>
              </div>
            </div>
          </header>

          <MobileNavigation activeTab={activeTab} setTab={setTab} />

          <section className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
            {intelligenceMetrics.map((metric) => (
              <MetricCard
                key={metric.label}
                label={metric.label}
                value={metric.value}
                helper={metric.helper}
                tone={metric.tone}
                icon={metric.icon}
                dense
              />
            ))}
          </section>

          {activeTab === "overview" ? (
            <OverviewTab mode={mode} favorites={favorites} toggleFavorite={toggleFavorite} />
          ) : null}

          {activeTab === "command" ? (
            <LaunchTab
              tab="command"
              title="AI Command Center"
              description="The high-level command layer for asking, building, routing, summarizing, and executing advisor workflows."
              href="/advisor-command-center"
              tone="red"
              icon="spark"
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              features={[
                ["Ask anything", "Use Slice to reason across advisor workflows and platform operations.", "brain", "red"],
                ["Build workflows", "Turn advisor intent into pages, automations, summaries, and action plans.", "flow", "cyan"],
                ["Route tasks", "Move work into clients, email, markets, reports, or system modules.", "target", "amber"],
                ["Retain context", "Keep decisions, summaries, and review trails organized.", "shield", "green"],
              ]}
            />
          ) : null}

          {activeTab === "custom-board" ? (
            <LaunchTab
              tab="custom-board"
              title="Create Your Own Workspace"
              description="The advisor market cockpit with TradingView charts, universal TradingView-style symbol search, metric-heavy sidebars, generated notification layers, and watchlist standards."
              href="/workspace/custom-board"
              tone="cyan"
              icon="board"
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              features={[
                ["TradingView charts", "Open symbols like NASDAQ:AAPL, NYSE:BRK.B, AMEX:SPY, TSX:SHOP, or crypto pairs.", "chart", "cyan"],
                ["Metric-heavy rail", "Search a large metric catalog and keep the 10 decision metrics that matter.", "market", "blue"],
                ["Generated alert layers", "Create notification standards for price, volume, risk, valuation, and quality layers.", "bell", "amber"],
                ["Advisor watchlists", "Change stocks while preserving each advisor’s custom workspace structure.", "target", "green"],
              ]}
            />
          ) : null}

          {activeTab === "client-portal" ? (
            <LaunchTab
              tab="client-portal"
              title="Client Portal Inbox"
              description="Advisor-facing intake for hands-on clients who submit requests, messages, documents, permissions, risk updates, meeting requests, and buy/sell discussion requests."
              href="/workspace/client-portal-inbox"
              tone="purple"
              icon="portal"
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              features={[
                ["Invite-only access", "Clients enter through advisor invite links and temporary demo login.", "client", "purple"],
                ["Review-only requests", "Buy/sell requests are routed as advisor-review items, not automatic orders.", "shield", "red"],
                ["Documents", "Clients can submit document metadata for advisor review.", "doc", "cyan"],
                ["Risk survey", "Clients can update risk tolerance and investing preferences.", "target", "amber"],
              ]}
            />
          ) : null}

          {activeTab === "settings" ? (
            <LaunchTab
              tab="settings"
              title="Enhanced Workspace Settings"
              description="The platform-wide settings center for dark/red mode, light/blue mode, accessibility, privacy, notifications, workspace density, assistant visibility, and advisor AI defaults."
              href="/workspace/settings"
              tone="blue"
              icon="settings"
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              features={[
                ["Dark and light", "Dark defaults to black/red. Light shifts the platform toward white/blue.", "light", "blue"],
                ["User specific", "Preferences persist locally after logout and can be user-scoped when identity is detected.", "client", "green"],
                ["Privacy controls", "Mask sensitive client data and require confirmations for sensitive actions.", "lock", "red"],
                ["Advisor AI defaults", "Set draft depth, AI tone, approval gates, and retention preferences.", "bot", "purple"],
              ]}
            />
          ) : null}

          {activeTab === "clients" ? (
            <ModuleGridTab
              group="Advisor"
              title="Client command center."
              description="Client profiles, portal requests, briefings, email workflows, and advisor-reviewed client service tools."
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              mode={mode}
            />
          ) : null}

          {activeTab === "emails" ? (
            <LaunchTab
              tab="emails"
              title="Email Center"
              description="The approval-safe client email workflow for AI drafts, manual drafts, edits, polish, queueing, approval, and delivery."
              href="/workspace/client-emails"
              tone="green"
              icon="mail"
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              features={[
                ["AI drafts", "Generate original advisor-ready client emails.", "spark", "cyan"],
                ["Manual drafts", "Create scratch or client-specific emails.", "mail", "green"],
                ["Approval queue", "Queue and approve before sending.", "shield", "amber"],
                ["Delivery trail", "Track sent, simulated, failed, and retained records.", "report", "purple"],
              ]}
            />
          ) : null}

          {activeTab === "briefings" ? (
            <LaunchTab
              tab="briefings"
              title="Client Briefings"
              description="Portfolio-aware client reports, holdings explanations, source-backed summaries, and advisor-reviewed outputs."
              href="/workspace/client-briefings"
              tone="cyan"
              icon="report"
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              features={[
                ["Client output", "Create client-ready briefing packages.", "client", "purple"],
                ["Portfolio aware", "Tie language to holdings and objectives.", "portfolio", "green"],
                ["Source-backed", "Preserve research and rationale.", "report", "cyan"],
                ["Approval-ready", "Keep advisor review in the process.", "shield", "red"],
              ]}
            />
          ) : null}

          {activeTab === "notifications" ? (
            <LaunchTab
              tab="notifications"
              title="Watchlist Alerts"
              description="Market alerts, client task alerts, compliance alerts, email delivery alerts, and notification standards."
              href="/watchlist-alerts"
              tone="amber"
              icon="bell"
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              features={[
                ["Market alerts", "Watchlist, price, metric, and risk triggers.", "market", "amber"],
                ["Client alerts", "Reviews, tasks, email follow-up, and workflow reminders.", "client", "purple"],
                ["Compliance alerts", "Review gates and approval requirements.", "shield", "red"],
                ["Delivery alerts", "Client email delivery, simulation, and failure state.", "mail", "green"],
              ]}
            />
          ) : null}

          {activeTab === "markets" ? (
            <ModuleGridTab
              group="Markets"
              title="Market intelligence workspace."
              description="Charts, custom board, watchlist alerts, opportunity radar, portfolios, and alternative investment tools."
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              mode={mode}
            />
          ) : null}

          {activeTab === "portfolio" ? (
            <LaunchTab
              tab="portfolio"
              title="Portfolio Lab"
              description="Holdings, allocation, risk context, comparison views, and advisor decision support."
              href="/portfolio-lab"
              tone="green"
              icon="portfolio"
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              features={[
                ["Holdings", "View position context and portfolio structure.", "portfolio", "green"],
                ["Risk", "Review concentration, volatility, drawdown, and exposure.", "shield", "red"],
                ["Comparison", "Compare holdings, funds, ETFs, and securities.", "compare", "cyan"],
                ["Client context", "Tie analysis back to client objectives and risk profiles.", "client", "purple"],
              ]}
            />
          ) : null}

          {activeTab === "intelligence" ? (
            <LaunchTab
              tab="intelligence"
              title="Intelligence"
              description="Source-backed market context, research signals, advisor summaries, and decision support."
              href="/intelligence"
              tone="red"
              icon="signal"
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              features={[
                ["Signal review", "Identify meaningful changes across markets and clients.", "signal", "red"],
                ["Source context", "Keep research basis and citations attached to decisions.", "report", "cyan"],
                ["Opportunity flow", "Route ideas into radar, custom board, or portfolio workflows.", "radar", "amber"],
                ["Advisor summaries", "Turn intelligence into plain-English client or internal notes.", "brain", "purple"],
              ]}
            />
          ) : null}

          {activeTab === "alternatives" ? (
            <LaunchTab
              tab="alternatives"
              title="Alternative Investments"
              description="Private-market and alternative investment workflows with suitability, risk, liquidity, and compliance review orientation."
              href="/alternative-investments"
              tone="amber"
              icon="diamond"
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              features={[
                ["Private markets", "Review private-market style opportunities.", "diamond", "amber"],
                ["Suitability", "Keep eligibility, client fit, liquidity, and risks visible.", "shield", "red"],
                ["Research", "Attach documents, sources, assumptions, and notes.", "report", "cyan"],
                ["Approval", "Route higher-risk opportunities through review gates.", "target", "purple"],
              ]}
            />
          ) : null}

          {activeTab === "firm" ? (
            <ModuleGridTab
              group="Firm"
              title="Firm execution and team operations."
              description="Team board, calendar, delegation, internal work, operating cadence, and project visibility."
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              mode={mode}
            />
          ) : null}

          {activeTab === "compliance" ? <ComplianceTab /> : null}

          {activeTab === "security" ? (
            <LaunchTab
              tab="security"
              title="Security"
              description="Security center for audit posture, sensitive workflow protection, account safety, and operational hardening."
              href="/security"
              tone="red"
              icon="lock"
              favorites={favorites}
              toggleFavorite={toggleFavorite}
              features={[
                ["Audit posture", "Track important platform-level safety controls.", "shield", "red"],
                ["Sensitive actions", "Protect approvals, sending, deletion, and client-facing workflows.", "lock", "amber"],
                ["Client data", "Support masking, privacy, and controlled handling.", "client", "purple"],
                ["System hardening", "Review production readiness and risk controls.", "system", "cyan"],
              ]}
            />
          ) : null}

          {activeTab === "system" ? <SystemTab /> : null}

          {mode === "power" ? <PowerMap favorites={favorites} toggleFavorite={toggleFavorite} /> : null}
        </div>
      </div>
    </main>
  );
}