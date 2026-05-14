import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

function asJson(value: unknown) {
  return JSON.stringify(value);
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function readText(value: unknown, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function ownerKey(userId: string, firmId: string | null, key: string) {
  return `${userId}:${firmId ?? "personal"}:${key}`;
}

async function resolveFirmId(userId: string) {
  const membership = await prisma.firmMembership.findFirst({
    where: {
      userId,
      status: "Active",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return membership?.firmId ?? null;
}

async function logBackendEvent(input: {
  userId: string;
  firmId: string | null;
  eventKey?: string;
  eventType: string;
  area: string;
  actorName?: string | null;
  title: string;
  detail?: string | null;
  severity?: string;
  status?: string;
  sourceType?: string | null;
  sourceId?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const eventKey =
    input.eventKey ??
    `${input.eventType}:${input.sourceType ?? "manual"}:${input.sourceId ?? Date.now()}`;

  return prisma.backendPlatformEvent.upsert({
    where: {
      userId_eventKey: {
        userId: input.userId,
        eventKey,
      },
    },
    update: {
      firmId: input.firmId,
      eventType: input.eventType,
      area: input.area,
      actorName: input.actorName,
      title: input.title,
      detail: input.detail,
      severity: input.severity ?? "Info",
      status: input.status ?? "Recorded",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadataJson: asJson(input.metadata ?? {}),
    },
    create: {
      userId: input.userId,
      firmId: input.firmId,
      eventKey,
      eventType: input.eventType,
      area: input.area,
      actorName: input.actorName,
      title: input.title,
      detail: input.detail,
      severity: input.severity ?? "Info",
      status: input.status ?? "Recorded",
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      metadataJson: asJson(input.metadata ?? {}),
    },
  });
}

const DEFAULT_ROLE_POLICIES = [
  {
    roleKey: "founder",
    roleName: "Founder / Platform Owner",
    description: "Full platform control, override ability, pricing, governance, and system setup.",
    permissions: [
      "*",
      "firm.manage",
      "users.invite",
      "bot.override",
      "reports.export",
      "security.review",
      "integrations.configure",
      "billing.configure",
    ],
  },
  {
    roleKey: "firm_owner",
    roleName: "Firm Owner",
    description: "Firm-level administration, users, projects, approvals, and client workflows.",
    permissions: [
      "firm.manage",
      "users.invite",
      "clients.manage",
      "portfolios.manage",
      "tasks.manage",
      "approvals.decide",
      "reports.export",
    ],
  },
  {
    roleKey: "advisor",
    roleName: "Advisor",
    description: "Client, portfolio, task, report, and advisor workflow access.",
    permissions: [
      "clients.manage",
      "portfolios.view",
      "tasks.manage",
      "reports.create",
      "alerts.review",
      "bot.command",
    ],
  },
  {
    roleKey: "analyst",
    roleName: "Analyst",
    description: "Research, source review, watchlists, and opportunity scoring.",
    permissions: [
      "research.manage",
      "sources.review",
      "watchlists.manage",
      "opportunities.review",
      "reports.draft",
    ],
  },
  {
    roleKey: "assistant",
    roleName: "Assistant",
    description: "Calendar, task, meeting prep, and draft support with restricted client delivery.",
    permissions: [
      "calendar.manage",
      "tasks.manage",
      "meetings.prepare",
      "drafts.create",
    ],
  },
  {
    roleKey: "compliance",
    roleName: "Compliance Reviewer",
    description: "Approval queue, proof trail, disclosures, audit, and governance review.",
    permissions: [
      "approvals.decide",
      "audit.review",
      "prooftrail.review",
      "disclosures.review",
      "communications.approve",
    ],
  },
  {
    roleKey: "viewer",
    roleName: "Read-only Viewer",
    description: "Read-only access for oversight without write permissions.",
    permissions: [
      "dashboard.view",
      "reports.view",
      "tasks.view",
    ],
  },
];

const DEFAULT_AI_TOOLS = [
  {
    toolKey: "create_task",
    toolName: "Create Task",
    category: "Execution",
    description: "Create a firm, client, or personal task from a structured bot command.",
    approvalRequired: false,
    inputSchema: {
      title: "string",
      dueDate: "YYYY-MM-DD optional",
      priority: "Low | Medium | High | Critical",
      clientId: "optional",
      firmId: "optional",
    },
    outputSchema: {
      taskId: "string",
      status: "created",
    },
  },
  {
    toolKey: "create_client",
    toolName: "Create Client",
    category: "Client Brain",
    description: "Create a client profile and prepare client-brain enrichment.",
    approvalRequired: false,
    inputSchema: {
      fullName: "string",
      email: "optional",
      riskProfile: "optional",
    },
    outputSchema: {
      clientId: "string",
      status: "created",
    },
  },
  {
    toolKey: "draft_investor_email",
    toolName: "Draft Investor Email",
    category: "Communication",
    description: "Create an approval-gated email draft tied to source, ticker, and client exposure.",
    approvalRequired: true,
    inputSchema: {
      ticker: "string",
      sourceId: "optional",
      audience: "Investors | Clients | Firm",
    },
    outputSchema: {
      draftId: "string",
      approvalItemId: "string",
    },
  },
  {
    toolKey: "create_price_alert",
    toolName: "Create Price Alert",
    category: "Market Data",
    description: "Create high/low price alerts for watchlist stocks.",
    approvalRequired: false,
    inputSchema: {
      symbol: "string",
      upperTargetPrice: "number optional",
      lowerTargetPrice: "number optional",
    },
    outputSchema: {
      alertId: "string",
    },
  },
  {
    toolKey: "search_firm",
    toolName: "Ask the Firm Search",
    category: "Knowledge",
    description: "Search across clients, notes, tasks, alerts, research, proof trails, and reports.",
    approvalRequired: false,
    inputSchema: {
      query: "string",
    },
    outputSchema: {
      results: "array",
    },
  },
  {
    toolKey: "generate_pdf_report",
    toolName: "Generate PDF Report",
    category: "Reporting",
    description: "Create a premium report with source, chart, and compliance context.",
    approvalRequired: true,
    inputSchema: {
      reportType: "string",
      clientId: "optional",
      topic: "string",
    },
    outputSchema: {
      reportId: "string",
      downloadUrl: "string",
    },
  },
  {
    toolKey: "create_advisor_day",
    toolName: "Create Advisor Day",
    category: "Operating System",
    description: "Generate one-click daily advisor brief with next-best actions.",
    approvalRequired: false,
    inputSchema: {
      firmId: "optional",
    },
    outputSchema: {
      advisorDayBriefId: "string",
    },
  },
  {
    toolKey: "create_compliance_trail",
    toolName: "Create Compliance Proof Trail",
    category: "Compliance",
    description: "Record source, reasoning, approval, and human review context.",
    approvalRequired: false,
    inputSchema: {
      actionType: "string",
      sourceId: "optional",
      clientId: "optional",
      summary: "string",
    },
    outputSchema: {
      proofTrailId: "string",
    },
  },
];

const DEFAULT_BACKGROUND_JOBS = [
  {
    jobKey: "market_scan",
    jobName: "Market Scan",
    category: "Market Data",
    description: "Scan market data and refresh technical visuals, watchlist prices, and price alerts.",
    scheduleLabel: "Every 5 minutes during market hours",
    cadence: "Cron",
  },
  {
    jobKey: "news_scan",
    jobName: "News Scan",
    category: "Intelligence",
    description: "Scan configured sources, score headlines, retain important items, and generate alerts.",
    scheduleLabel: "Every 15 minutes",
    cadence: "Cron",
  },
  {
    jobKey: "watchlist_price_check",
    jobName: "Watchlist Price Check",
    category: "Notifications",
    description: "Check watchlist high/low price targets and queue notifications when triggered.",
    scheduleLabel: "Every 5 minutes during market hours",
    cadence: "Cron",
  },
  {
    jobKey: "advisor_day",
    jobName: "Advisor Day Brief",
    category: "AI",
    description: "Generate daily Next Best Action and Client Brain summaries.",
    scheduleLabel: "Every weekday morning",
    cadence: "Cron",
  },
  {
    jobKey: "digest_delivery",
    jobName: "Digest Delivery",
    category: "Notifications",
    description: "Send daily/weekly digest summaries according to user preferences.",
    scheduleLabel: "Daily",
    cadence: "Cron",
  },
  {
    jobKey: "prooftrail_retention",
    jobName: "Compliance Retention Sweep",
    category: "Compliance",
    description: "Check compliance-proof records, retention windows, and stale review queues.",
    scheduleLabel: "Daily",
    cadence: "Cron",
  },
  {
    jobKey: "vendor_health",
    jobName: "Vendor Health Check",
    category: "System",
    description: "Check provider availability for market data, email, SMS, AI, storage, and auth.",
    scheduleLabel: "Hourly",
    cadence: "Cron",
  },
];

const DEFAULT_NOTIFICATION_RULES = [
  {
    ruleKey: "critical-alerts-dashboard",
    ruleName: "Critical dashboard alerts",
    scopeType: "Alerts",
    channel: "Dashboard",
    minScore: 90,
    minUrgency: "High",
    digestOnly: false,
    approvalRequired: false,
  },
  {
    ruleKey: "investor-email-approval",
    ruleName: "Investor email approval",
    scopeType: "Communication",
    channel: "Email",
    minScore: 75,
    minUrgency: "Medium",
    digestOnly: false,
    approvalRequired: true,
  },
  {
    ruleKey: "watchlist-price-alerts",
    ruleName: "Watchlist price alerts",
    scopeType: "Market Data",
    channel: "Dashboard",
    minScore: 80,
    minUrgency: "High",
    digestOnly: false,
    approvalRequired: false,
  },
  {
    ruleKey: "daily-advisor-digest",
    ruleName: "Daily advisor digest",
    scopeType: "Digest",
    channel: "Email",
    minScore: 60,
    minUrgency: "Medium",
    digestOnly: true,
    approvalRequired: false,
  },
];

async function ensureBackendFoundation(user: { id: string; name: string; email: string }, firmId: string | null) {
  for (const policy of DEFAULT_ROLE_POLICIES) {
    await prisma.backendRolePolicy.upsert({
      where: {
        policyKey: ownerKey(user.id, firmId, policy.roleKey),
      },
      update: {
        firmId,
        roleName: policy.roleName,
        description: policy.description,
        permissionsJson: asJson(policy.permissions),
        status: "Active",
      },
      create: {
        userId: user.id,
        firmId,
        policyKey: ownerKey(user.id, firmId, policy.roleKey),
        roleKey: policy.roleKey,
        roleName: policy.roleName,
        description: policy.description,
        permissionsJson: asJson(policy.permissions),
        status: "Active",
      },
    });
  }

  for (const tool of DEFAULT_AI_TOOLS) {
    await prisma.backendAiTool.upsert({
      where: {
        ownerToolKey: ownerKey(user.id, firmId, tool.toolKey),
      },
      update: {
        firmId,
        toolName: tool.toolName,
        category: tool.category,
        description: tool.description,
        inputSchemaJson: asJson(tool.inputSchema),
        outputSchemaJson: asJson(tool.outputSchema),
        approvalRequired: tool.approvalRequired,
        enabled: true,
      },
      create: {
        userId: user.id,
        firmId,
        ownerToolKey: ownerKey(user.id, firmId, tool.toolKey),
        toolKey: tool.toolKey,
        toolName: tool.toolName,
        category: tool.category,
        description: tool.description,
        inputSchemaJson: asJson(tool.inputSchema),
        outputSchemaJson: asJson(tool.outputSchema),
        approvalRequired: tool.approvalRequired,
        enabled: true,
      },
    });
  }

  for (const job of DEFAULT_BACKGROUND_JOBS) {
    await prisma.backendJobDefinition.upsert({
      where: {
        ownerJobKey: ownerKey(user.id, firmId, job.jobKey),
      },
      update: {
        firmId,
        jobName: job.jobName,
        category: job.category,
        description: job.description,
        scheduleLabel: job.scheduleLabel,
        cadence: job.cadence,
        status: "Planned",
      },
      create: {
        userId: user.id,
        firmId,
        ownerJobKey: ownerKey(user.id, firmId, job.jobKey),
        jobKey: job.jobKey,
        jobName: job.jobName,
        category: job.category,
        description: job.description,
        scheduleLabel: job.scheduleLabel,
        cadence: job.cadence,
        status: "Planned",
      },
    });
  }

  for (const rule of DEFAULT_NOTIFICATION_RULES) {
    await prisma.backendNotificationRule.upsert({
      where: {
        ownerRuleKey: ownerKey(user.id, firmId, rule.ruleKey),
      },
      update: {
        firmId,
        ruleName: rule.ruleName,
        scopeType: rule.scopeType,
        channel: rule.channel,
        minScore: rule.minScore,
        minUrgency: rule.minUrgency,
        digestOnly: rule.digestOnly,
        approvalRequired: rule.approvalRequired,
        status: "Active",
      },
      create: {
        userId: user.id,
        firmId,
        ownerRuleKey: ownerKey(user.id, firmId, rule.ruleKey),
        ruleName: rule.ruleName,
        scopeType: rule.scopeType,
        channel: rule.channel,
        minScore: rule.minScore,
        minUrgency: rule.minUrgency,
        digestOnly: rule.digestOnly,
        approvalRequired: rule.approvalRequired,
        status: "Active",
      },
    });
  }

  const qualityRecords = [
    {
      entityType: "MarketData",
      entityId: "global",
      sourceName: "Alpha Vantage",
      liveStatus: process.env.ALPHA_VANTAGE_API_KEY ? "Configured" : "Missing",
      freshnessStatus: process.env.ALPHA_VANTAGE_API_KEY ? "Ready" : "Needs Provider",
      qualityScore: process.env.ALPHA_VANTAGE_API_KEY ? 85 : 45,
      fallbackUsed: !process.env.ALPHA_VANTAGE_API_KEY,
      warning: process.env.ALPHA_VANTAGE_API_KEY
        ? "Market-data provider configured."
        : "ALPHA_VANTAGE_API_KEY is missing. Live market features will fall back or skip triggers.",
    },
    {
      entityType: "Email",
      entityId: "global",
      sourceName: "Email Provider",
      liveStatus: process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY ? "Configured" : "Missing",
      freshnessStatus: "Config Check",
      qualityScore: process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY ? 85 : 40,
      fallbackUsed: !(process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY),
      warning: process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY
        ? "Email provider appears configured."
        : "No email provider key detected. Email delivery should remain simulated until configured.",
    },
    {
      entityType: "AI",
      entityId: "global",
      sourceName: "OpenAI",
      liveStatus: process.env.OPENAI_API_KEY ? "Configured" : "Missing",
      freshnessStatus: "Config Check",
      qualityScore: process.env.OPENAI_API_KEY ? 90 : 50,
      fallbackUsed: !process.env.OPENAI_API_KEY,
      warning: process.env.OPENAI_API_KEY
        ? "AI provider appears configured."
        : "OPENAI_API_KEY is missing. AI workflows should remain local/template-based until configured.",
    },
  ];

  for (const record of qualityRecords) {
    await prisma.backendDataQualityRecord.upsert({
      where: {
        userId_entityType_entityId_sourceName: {
          userId: user.id,
          entityType: record.entityType,
          entityId: record.entityId,
          sourceName: record.sourceName,
        },
      },
      update: {
        firmId,
        liveStatus: record.liveStatus,
        freshnessStatus: record.freshnessStatus,
        qualityScore: record.qualityScore,
        fallbackUsed: record.fallbackUsed,
        warning: record.warning,
        warningsJson: asJson([record.warning]),
        lastCheckedAt: new Date(),
      },
      create: {
        userId: user.id,
        firmId,
        entityType: record.entityType,
        entityId: record.entityId,
        sourceName: record.sourceName,
        liveStatus: record.liveStatus,
        freshnessStatus: record.freshnessStatus,
        qualityScore: record.qualityScore,
        fallbackUsed: record.fallbackUsed,
        warning: record.warning,
        warningsJson: asJson([record.warning]),
        lastCheckedAt: new Date(),
      },
    });
  }

  const existingApproval = await prisma.backendApprovalItem.findFirst({
    where: {
      userId: user.id,
      actionType: "Backend Readiness",
      status: "Pending",
    },
  });

  if (!existingApproval) {
    await prisma.backendApprovalItem.create({
      data: {
        userId: user.id,
        firmId,
        title: "Review backend readiness foundation",
        actionType: "Backend Readiness",
        riskLevel: "Low",
        summary:
          "Review the platform foundation before connecting live backend services, jobs, email/SMS, and AI tool execution.",
        payloadJson: asJson({
          areas: [
            "System health",
            "Permissions",
            "Approvals",
            "Notifications",
            "Data quality",
            "AI tools",
            "Jobs",
            "Tenant isolation",
          ],
        }),
        requestedBy: user.email,
        status: "Pending",
      },
    });
  }

  await logBackendEvent({
    userId: user.id,
    firmId,
    eventKey: `backend-foundation:${new Date().toISOString().slice(0, 10)}`,
    eventType: "backend.foundation.bootstrap",
    area: "Backend Readiness",
    actorName: user.name,
    title: "Backend readiness foundation bootstrapped",
    detail: "Default policies, tools, jobs, notification rules, data quality records, and approval review were created or updated.",
    severity: "Info",
    metadata: {
      rolePolicies: DEFAULT_ROLE_POLICIES.length,
      aiTools: DEFAULT_AI_TOOLS.length,
      jobs: DEFAULT_BACKGROUND_JOBS.length,
      notificationRules: DEFAULT_NOTIFICATION_RULES.length,
    },
  });
}

async function runHealthChecks(user: { id: string; name: string; email: string }, firmId: string | null) {
  let databaseHealthy = false;

  try {
    await prisma.user.count();
    databaseHealthy = true;
  } catch {
    databaseHealthy = false;
  }

  const checks = [
    {
      checkKey: "database",
      label: "Database Connection",
      category: "Core",
      status: databaseHealthy ? "Healthy" : "Broken",
      score: databaseHealthy ? 100 : 0,
      details: {
        message: databaseHealthy ? "Database query succeeded." : "Database query failed.",
      },
    },
    {
      checkKey: "prisma",
      label: "Prisma Schema Sync",
      category: "Core",
      status: "Generated",
      score: 85,
      details: {
        message: "If this page loads, Prisma Client is generated for the backend-readiness models.",
      },
    },
    {
      checkKey: "market-data",
      label: "Market Data Provider",
      category: "Vendor",
      status: process.env.ALPHA_VANTAGE_API_KEY ? "Configured" : "Missing",
      score: process.env.ALPHA_VANTAGE_API_KEY ? 85 : 45,
      details: {
        requiredEnv: "ALPHA_VANTAGE_API_KEY",
        configured: Boolean(process.env.ALPHA_VANTAGE_API_KEY),
      },
    },
    {
      checkKey: "email-provider",
      label: "Email Provider",
      category: "Vendor",
      status: process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY ? "Configured" : "Missing",
      score: process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY ? 85 : 40,
      details: {
        supported: ["SENDGRID_API_KEY", "RESEND_API_KEY"],
        configured: Boolean(process.env.SENDGRID_API_KEY || process.env.RESEND_API_KEY),
      },
    },
    {
      checkKey: "sms-provider",
      label: "SMS Provider",
      category: "Vendor",
      status: process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN ? "Configured" : "Missing",
      score: process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN ? 85 : 35,
      details: {
        supported: ["TWILIO_ACCOUNT_SID", "TWILIO_AUTH_TOKEN"],
        configured: Boolean(process.env.TWILIO_ACCOUNT_SID && process.env.TWILIO_AUTH_TOKEN),
      },
    },
    {
      checkKey: "ai-provider",
      label: "AI Provider",
      category: "Vendor",
      status: process.env.OPENAI_API_KEY ? "Configured" : "Missing",
      score: process.env.OPENAI_API_KEY ? 90 : 50,
      details: {
        requiredEnv: "OPENAI_API_KEY",
        configured: Boolean(process.env.OPENAI_API_KEY),
      },
    },
    {
      checkKey: "background-jobs",
      label: "Background Job Strategy",
      category: "Automation",
      status: "Planned",
      score: 70,
      details: {
        recommended: ["Vercel Cron", "Inngest", "Trigger.dev", "QStash"],
        note: "Choose the job runner before connecting live scanning and automatic delivery.",
      },
    },
  ];

  for (const check of checks) {
    await prisma.backendSystemHealthCheck.upsert({
      where: {
        ownerCheckKey: ownerKey(user.id, firmId, check.checkKey),
      },
      update: {
        firmId,
        label: check.label,
        category: check.category,
        status: check.status,
        score: check.score,
        detailsJson: asJson(check.details),
        lastCheckedAt: new Date(),
      },
      create: {
        userId: user.id,
        firmId,
        ownerCheckKey: ownerKey(user.id, firmId, check.checkKey),
        checkKey: check.checkKey,
        label: check.label,
        category: check.category,
        status: check.status,
        score: check.score,
        detailsJson: asJson(check.details),
        lastCheckedAt: new Date(),
      },
    });
  }

  await logBackendEvent({
    userId: user.id,
    firmId,
    eventKey: `health-check:${Date.now()}`,
    eventType: "system.health.checked",
    area: "System Health",
    actorName: user.name,
    title: "System health checks completed",
    detail: `${checks.length} backend readiness checks were updated.`,
    severity: "Info",
    metadata: {
      checks,
    },
  });

  return checks;
}

async function runTenantChecks(user: { id: string; name: string; email: string }, firmId: string | null) {
  const membership = firmId
    ? await prisma.firmMembership.findFirst({
        where: {
          userId: user.id,
          firmId,
          status: "Active",
        },
      })
    : await prisma.firmMembership.findFirst({
        where: {
          userId: user.id,
          status: "Active",
        },
        orderBy: {
          createdAt: "desc",
        },
      });

  const checks = [
    {
      checkName: "User scope",
      status: user.id ? "Passed" : "Failed",
      detail: "Authenticated user ID exists and can scope user-owned records.",
      details: {
        userId: user.id,
      },
    },
    {
      checkName: "Firm scope",
      status: membership ? "Passed" : "Needs Firm",
      detail: membership
        ? "Active firm membership found for tenant-scoped records."
        : "No active firm membership found. Firm-level data should remain inaccessible.",
      details: {
        firmId,
        membershipId: membership?.id ?? null,
        role: membership?.role ?? null,
      },
    },
    {
      checkName: "Permission flags",
      status: membership ? "Passed" : "Needs Firm",
      detail: "Permission flags are available for firm-level authorization checks.",
      details: {
        canAccessPortfolios: membership?.canAccessPortfolios ?? false,
        canManageProjects: membership?.canManageProjects ?? false,
        canInviteMembers: membership?.canInviteMembers ?? false,
        canManageFirm: membership?.canManageFirm ?? false,
      },
    },
  ];

  await prisma.backendTenantAccessCheck.deleteMany({
    where: {
      userId: user.id,
      firmId,
    },
  });

  for (const check of checks) {
    await prisma.backendTenantAccessCheck.create({
      data: {
        userId: user.id,
        firmId,
        checkName: check.checkName,
        status: check.status,
        detail: check.detail,
        detailsJson: asJson(check.details),
        lastCheckedAt: new Date(),
      },
    });
  }

  await logBackendEvent({
    userId: user.id,
    firmId,
    eventKey: `tenant-check:${Date.now()}`,
    eventType: "tenant.isolation.checked",
    area: "Tenant Isolation",
    actorName: user.name,
    title: "Tenant isolation checks completed",
    detail: `${checks.length} tenant checks were recorded.`,
    metadata: {
      checks,
    },
  });

  return checks;
}

async function seedDemoData(user: { id: string; name: string; email: string }, firmId: string | null) {
  let clients = 0;
  let holdings = 0;
  let watchlists = 0;
  let alerts = 0;
  let tasks = 0;

  let client = await prisma.clientProfile.findFirst({
    where: {
      userId: user.id,
      fullName: "Demo Client - Anderson Household",
    },
  });

  if (!client) {
    client = await prisma.clientProfile.create({
      data: {
        userId: user.id,
        fullName: "Demo Client - Anderson Household",
        email: "anderson@example.com",
        householdName: "Anderson Household",
        clientType: "Private Client",
        riskProfile: "Balanced",
        liquidityNeeds: "Moderate",
        timeHorizon: "5-10 years",
        objective: "Long-term growth with controlled downside",
        portfolioValue: "$1,250,000",
        status: "Active",
        notes: "Prefers concise explanations and clear next steps.",
      },
    });
    clients += 1;
  }

  const demoHoldings = [
    { symbol: "NVDA", assetName: "NVIDIA", value: "$185,000", allocationPct: "14.8%" },
    { symbol: "AAPL", assetName: "Apple", value: "$135,000", allocationPct: "10.8%" },
    { symbol: "MSFT", assetName: "Microsoft", value: "$160,000", allocationPct: "12.8%" },
  ];

  for (const holding of demoHoldings) {
    const existing = await prisma.portfolioHolding.findFirst({
      where: {
        clientId: client.id,
        symbol: holding.symbol,
      },
    });

    if (!existing) {
      await prisma.portfolioHolding.create({
        data: {
          clientId: client.id,
          symbol: holding.symbol,
          assetName: holding.assetName,
          assetClass: "Stock",
          value: holding.value,
          allocationPct: holding.allocationPct,
          riskLevel: "Medium",
          thesis: "Demo holding for Slice backend testing.",
        },
      });
      holdings += 1;
    }
  }

  const watchlist = await prisma.namedWatchlist.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: "Demo AI Watchlist",
      },
    },
    update: {
      description: "Demo watchlist for backend readiness testing.",
      focus: "AI and mega-cap technology",
      riskLevel: "Mixed",
    },
    create: {
      userId: user.id,
      name: "Demo AI Watchlist",
      description: "Demo watchlist for backend readiness testing.",
      focus: "AI and mega-cap technology",
      riskLevel: "Mixed",
    },
  });
  watchlists += 1;

  for (const symbol of ["NVDA", "AAPL", "MSFT"]) {
    await prisma.namedWatchlistItem.upsert({
      where: {
        watchlistId_symbol: {
          watchlistId: watchlist.id,
          symbol,
        },
      },
      update: {
        status: "Watching",
        priority: symbol === "NVDA" ? "High" : "Medium",
      },
      create: {
        userId: user.id,
        watchlistId: watchlist.id,
        symbol,
        assetName: symbol,
        assetType: "Stock",
        sourceType: "Demo Seed",
        thesis: "Demo watchlist item for backend testing.",
        status: "Watching",
        priority: symbol === "NVDA" ? "High" : "Medium",
      },
    });
  }

  await prisma.alertEvent.upsert({
    where: {
      userId_dedupeKey: {
        userId: user.id,
        dedupeKey: "demo:nvda:ai-demand",
      },
    },
    update: {
      title: "Demo NVDA AI demand alert",
      body: "Demo alert showing how market news may affect a client with NVDA exposure.",
      source: "Demo Source",
      ticker: "NVDA",
      urgency: "High",
      score: 91,
      channel: "Dashboard",
      status: "Unread",
      aiBriefing: "Client has meaningful NVDA exposure. Review source, portfolio impact, and possible client communication.",
    },
    create: {
      userId: user.id,
      dedupeKey: "demo:nvda:ai-demand",
      title: "Demo NVDA AI demand alert",
      body: "Demo alert showing how market news may affect a client with NVDA exposure.",
      source: "Demo Source",
      ticker: "NVDA",
      urgency: "High",
      score: 91,
      channel: "Dashboard",
      status: "Unread",
      aiBriefing: "Client has meaningful NVDA exposure. Review source, portfolio impact, and possible client communication.",
    },
  });
  alerts += 1;

  const existingTask = await prisma.meetingTask.findFirst({
    where: {
      userId: user.id,
      title: "Demo follow-up with Anderson Household",
    },
  });

  if (!existingTask) {
    await prisma.meetingTask.create({
      data: {
        userId: user.id,
        clientId: client.id,
        title: "Demo follow-up with Anderson Household",
        description: "Review AI exposure and prepare a client-friendly explanation.",
        dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000),
        priority: "High",
        status: "Open",
      },
    });
    tasks += 1;
  }

  if (firmId) {
    const membership = await prisma.firmMembership.findFirst({
      where: {
        userId: user.id,
        firmId,
        status: "Active",
      },
    });

    if (membership) {
      const agenda = await prisma.weeklyAgenda.upsert({
        where: {
          id: `${firmId}-${membership.id}-backend-demo-agenda`,
        },
        update: {
          title: "Backend Demo Agenda",
          focus: "Validate backend readiness workflows.",
          status: "Open",
        },
        create: {
          id: `${firmId}-${membership.id}-backend-demo-agenda`,
          firmId,
          membershipId: membership.id,
          weekStart: new Date().toISOString().slice(0, 10),
          title: "Backend Demo Agenda",
          focus: "Validate backend readiness workflows.",
          status: "Open",
        },
      });

      const existingFirmTask = await prisma.firmAgendaTask.findFirst({
        where: {
          agendaId: agenda.id,
          title: "Review backend readiness dashboard",
        },
      });

      if (!existingFirmTask) {
        await prisma.firmAgendaTask.create({
          data: {
            firmId,
            agendaId: agenda.id,
            title: "Review backend readiness dashboard",
            detail: "Confirm health checks, permissions, jobs, approvals, and data quality before full backend build.",
            status: "Open",
            priority: "High",
            dueDate: new Date().toISOString().slice(0, 10),
          },
        });
        tasks += 1;
      }
    }
  }

  const seedRun = await prisma.backendDemoSeedRun.create({
    data: {
      userId: user.id,
      firmId,
      status: "Complete",
      summary: "Demo data created or refreshed for backend-readiness testing.",
      countsJson: asJson({
        clients,
        holdings,
        watchlists,
        alerts,
        tasks,
      }),
    },
  });

  await logBackendEvent({
    userId: user.id,
    firmId,
    eventKey: `demo-seed:${seedRun.id}`,
    eventType: "demo.seed.completed",
    area: "Demo Data",
    actorName: user.name,
    title: "Demo seed completed",
    detail: seedRun.summary,
    metadata: {
      clients,
      holdings,
      watchlists,
      alerts,
      tasks,
    },
  });

  return seedRun;
}

async function loadReadiness(user: { id: string; name: string; email: string }) {
  const firmId = await resolveFirmId(user.id);

  const [
    healthChecks,
    events,
    rolePolicies,
    approvals,
    notificationRules,
    dataQuality,
    aiTools,
    jobs,
    tenantChecks,
    seedRuns,
    counts,
  ] = await Promise.all([
    prisma.backendSystemHealthCheck.findMany({
      where: { userId: user.id },
      orderBy: [{ category: "asc" }, { score: "asc" }],
      take: 50,
    }),
    prisma.backendPlatformEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.backendRolePolicy.findMany({
      where: { userId: user.id },
      orderBy: [{ roleKey: "asc" }],
      take: 50,
    }),
    prisma.backendApprovalItem.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 50,
    }),
    prisma.backendNotificationRule.findMany({
      where: { userId: user.id },
      orderBy: [{ scopeType: "asc" }, { channel: "asc" }],
      take: 50,
    }),
    prisma.backendDataQualityRecord.findMany({
      where: { userId: user.id },
      orderBy: [{ qualityScore: "asc" }, { updatedAt: "desc" }],
      take: 50,
    }),
    prisma.backendAiTool.findMany({
      where: { userId: user.id },
      orderBy: [{ category: "asc" }, { toolName: "asc" }],
      take: 80,
    }),
    prisma.backendJobDefinition.findMany({
      where: { userId: user.id },
      orderBy: [{ category: "asc" }, { jobName: "asc" }],
      take: 80,
    }),
    prisma.backendTenantAccessCheck.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 50,
    }),
    prisma.backendDemoSeedRun.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
    Promise.all([
      prisma.clientProfile.count({ where: { userId: user.id } }),
      prisma.alertEvent.count({ where: { userId: user.id } }),
      prisma.namedWatchlist.count({ where: { userId: user.id } }),
      prisma.meetingTask.count({ where: { userId: user.id } }),
      prisma.personalUserBotCommand.count({ where: { userId: user.id } }),
      firmId ? prisma.firmProject.count({ where: { firmId } }) : Promise.resolve(0),
    ]),
  ]);

  const [clientCount, alertCount, watchlistCount, taskCount, botCommandCount, firmProjectCount] = counts;

  const healthAverage = healthChecks.length
    ? Math.round(
        healthChecks.reduce((sum, check) => sum + check.score, 0) / healthChecks.length
      )
    : 0;

  const pendingApprovals = approvals.filter((item) => item.status === "Pending").length;
  const poorDataQuality = dataQuality.filter((item) => item.qualityScore < 60).length;
  const enabledTools = aiTools.filter((tool) => tool.enabled).length;
  const plannedJobs = jobs.filter((job) => job.status === "Planned").length;

  const readinessScore = Math.max(
    0,
    Math.min(
      100,
      Math.round(
        healthAverage * 0.4 +
          (rolePolicies.length ? 15 : 0) +
          (notificationRules.length ? 10 : 0) +
          (enabledTools ? 15 : 0) +
          (jobs.length ? 10 : 0) -
          pendingApprovals * 2 -
          poorDataQuality * 3
      )
    )
  );

  return {
    user,
    firmId,
    readinessScore,
    metrics: {
      healthAverage,
      pendingApprovals,
      poorDataQuality,
      enabledTools,
      plannedJobs,
      events: events.length,
      rolePolicies: rolePolicies.length,
      notificationRules: notificationRules.length,
      jobs: jobs.length,
      tenantChecks: tenantChecks.length,
      seedRuns: seedRuns.length,
      clientCount,
      alertCount,
      watchlistCount,
      taskCount,
      botCommandCount,
      firmProjectCount,
    },
    healthChecks: healthChecks.map((check) => ({
      ...check,
      details: parseJson<Record<string, unknown>>(check.detailsJson, {}),
    })),
    events: events.map((event) => ({
      ...event,
      metadata: parseJson<Record<string, unknown>>(event.metadataJson, {}),
    })),
    rolePolicies: rolePolicies.map((policy) => ({
      ...policy,
      permissions: parseJson<string[]>(policy.permissionsJson, []),
    })),
    approvals: approvals.map((approval) => ({
      ...approval,
      payload: parseJson<Record<string, unknown>>(approval.payloadJson, {}),
    })),
    notificationRules,
    dataQuality: dataQuality.map((record) => ({
      ...record,
      warnings: parseJson<string[]>(record.warningsJson, []),
    })),
    aiTools: aiTools.map((tool) => ({
      ...tool,
      inputSchema: parseJson<Record<string, unknown>>(tool.inputSchemaJson, {}),
      outputSchema: parseJson<Record<string, unknown>>(tool.outputSchemaJson, {}),
    })),
    jobs: jobs.map((job) => ({
      ...job,
      lastResult: parseJson<Record<string, unknown>>(job.lastResultJson, {}),
    })),
    tenantChecks: tenantChecks.map((check) => ({
      ...check,
      details: parseJson<Record<string, unknown>>(check.detailsJson, {}),
    })),
    seedRuns: seedRuns.map((run) => ({
      ...run,
      counts: parseJson<Record<string, unknown>>(run.countsJson, {}),
    })),
  };
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(await loadReadiness(user));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const firmId = await resolveFirmId(user.id);
  const body = await request.json().catch(() => ({}));
  const action = readText(body.action);

  if (action === "bootstrap") {
    await ensureBackendFoundation(user, firmId);
    await runHealthChecks(user, firmId);
    await runTenantChecks(user, firmId);

    return NextResponse.json({
      ...(await loadReadiness(user)),
      message: "Backend readiness foundation created or refreshed.",
    });
  }

  if (action === "runHealthChecks") {
    const checks = await runHealthChecks(user, firmId);

    return NextResponse.json({
      ...(await loadReadiness(user)),
      message: `Updated ${checks.length} health check(s).`,
    });
  }

  if (action === "runTenantChecks") {
    const checks = await runTenantChecks(user, firmId);

    return NextResponse.json({
      ...(await loadReadiness(user)),
      message: `Updated ${checks.length} tenant isolation check(s).`,
    });
  }

  if (action === "seedDemoData") {
    const seed = await seedDemoData(user, firmId);

    return NextResponse.json({
      ...(await loadReadiness(user)),
      message: seed.summary,
    });
  }

  if (action === "approveItem" || action === "rejectItem") {
    const approvalId = readText(body.approvalId);
    const approvalNotes = readText(body.approvalNotes, "");

    if (!approvalId) {
      return NextResponse.json({ error: "Approval ID is required." }, { status: 400 });
    }

    const status = action === "approveItem" ? "Approved" : "Rejected";

    await prisma.backendApprovalItem.updateMany({
      where: {
        id: approvalId,
        userId: user.id,
      },
      data: {
        status,
        approvedBy: user.email,
        approvalNotes,
        decidedAt: new Date(),
      },
    });

    await logBackendEvent({
      userId: user.id,
      firmId,
      eventType: `approval.${status.toLowerCase()}`,
      area: "Approval Center",
      actorName: user.name,
      title: `Approval item ${status.toLowerCase()}`,
      detail: approvalNotes || `Approval item ${approvalId} was ${status.toLowerCase()}.`,
      sourceType: "BackendApprovalItem",
      sourceId: approvalId,
      metadata: {
        approvalId,
        status,
      },
    });

    return NextResponse.json({
      ...(await loadReadiness(user)),
      message: `Approval item ${status.toLowerCase()}.`,
    });
  }

  if (action === "createApproval") {
    const title = readText(body.title, "Manual approval item");
    const actionType = readText(body.actionType, "Manual Review");
    const riskLevel = readText(body.riskLevel, "Medium");
    const summary = readText(body.summary, "Manual approval item created from backend readiness.");

    await prisma.backendApprovalItem.create({
      data: {
        userId: user.id,
        firmId,
        title,
        actionType,
        riskLevel,
        summary,
        payloadJson: asJson(body.payload ?? {}),
        requestedBy: user.email,
        status: "Pending",
      },
    });

    await logBackendEvent({
      userId: user.id,
      firmId,
      eventType: "approval.created",
      area: "Approval Center",
      actorName: user.name,
      title: `Approval created: ${title}`,
      detail: summary,
      metadata: {
        actionType,
        riskLevel,
      },
    });

    return NextResponse.json({
      ...(await loadReadiness(user)),
      message: "Approval item created.",
    });
  }

  return NextResponse.json({ error: "Unknown backend readiness action." }, { status: 400 });
}