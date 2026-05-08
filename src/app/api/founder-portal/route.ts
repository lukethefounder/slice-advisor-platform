import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { founderEmails, isFounderEmail } from "@/lib/founder-access";
import { prisma } from "@/lib/prisma";

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
    capturedAt?: Date | string | null;
  }>;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function parseJsonList(value: string | null | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function requireFounder() {
  const user = await getCurrentUser();

  if (!user) {
    return {
      user: null,
      error: NextResponse.json({ error: "Unauthorized." }, { status: 401 }),
    };
  }

  const allowed = founderEmails();

  if (!allowed.length) {
    return {
      user: null,
      error: NextResponse.json(
        {
          error:
            "Founder portal is not configured. Add SLICE_FOUNDER_EMAILS to .env.local or use /founder-bootstrap locally.",
        },
        { status: 403 }
      ),
    };
  }

  if (!isFounderEmail(user.email)) {
    return {
      user: null,
      error: NextResponse.json(
        {
          error: "Founder portal access denied.",
        },
        { status: 403 }
      ),
    };
  }

  return {
    user,
    error: null,
  };
}

async function writeFounderAudit({
  founderUserId,
  eventType,
  title,
  detail,
  metadata,
}: {
  founderUserId: string;
  eventType: string;
  title: string;
  detail?: string;
  metadata?: Record<string, unknown>;
}) {
  await prisma.auditLog.create({
    data: {
      userId: founderUserId,
      eventType,
      severity: "Critical",
      area: "Founder Governance",
      title,
      detail: detail ?? null,
      metadataJson: JSON.stringify(metadata ?? {}),
    },
  });
}

function firmHealthScore({
  platformStatus,
  activeMembers,
  openTasks,
  completedTasks,
  projects,
  highAlerts,
  highDecisions,
}: {
  platformStatus: string;
  activeMembers: number;
  openTasks: number;
  completedTasks: number;
  projects: number;
  highAlerts: number;
  highDecisions: number;
}) {
  if (platformStatus !== "Active") return 0;

  const taskBase =
    openTasks + completedTasks > 0
      ? (completedTasks / Math.max(openTasks + completedTasks, 1)) * 30
      : 12;

  const memberBase = Math.min(18, activeMembers * 4);
  const projectBase = Math.min(15, projects * 3);
  const intelligencePenalty = Math.min(18, highAlerts * 2 + highDecisions);

  return clamp(45 + taskBase + memberBase + projectBase - intelligencePenalty);
}

async function optionalCount(modelName: string) {
  const prismaAny = prisma as unknown as Record<
    string,
    { count?: () => Promise<number> }
  >;

  const model = prismaAny[modelName];

  if (!model?.count) return 0;

  try {
    return await model.count();
  } catch {
    return 0;
  }
}

async function optionalFindMany<T>(modelName: string, args: Record<string, unknown>) {
  const prismaAny = prisma as unknown as Record<
    string,
    { findMany?: (args: Record<string, unknown>) => Promise<T[]> }
  >;

  const model = prismaAny[modelName];

  if (!model?.findMany) return [];

  try {
    return await model.findMany(args);
  } catch {
    return [];
  }
}

function priorityFromScore(score: number): FounderLead["priority"] {
  if (score >= 90) return "Critical";
  if (score >= 80) return "High";
  if (score >= 65) return "Medium";
  return "Low";
}

function confidenceFromSignal({
  score,
  materialityScore = 0,
  relevanceScore = 0,
  trustScore = 0,
}: {
  score: number;
  materialityScore?: number;
  relevanceScore?: number;
  trustScore?: number;
}) {
  return clamp(score * 0.45 + materialityScore * 0.25 + relevanceScore * 0.2 + trustScore * 0.1);
}

function buildAlertLead(alert: {
  id: string;
  userId: string;
  title: string;
  body: string;
  source: string;
  sourceUrl: string | null;
  ticker: string | null;
  score: number;
  urgency: string;
  createdAt: Date;
  aiBriefing: string | null;
  user: {
    id: string;
    name: string;
    email: string;
  };
}): FounderLead {
  const confidence = confidenceFromSignal({ score: alert.score });

  return {
    id: `alert-${alert.id}`,
    title: alert.title,
    leadType: "High-Signal Alert",
    priority: priorityFromScore(alert.score),
    confidence,
    expectedUpside:
      alert.score >= 90
        ? "Potentially urgent investment, risk-management, or advisor-client communication opportunity."
        : alert.score >= 80
          ? "Potentially valuable advisor review item with possible portfolio or client relevance."
          : "Useful intelligence item that may support research, briefing, or monitoring.",
    summary: alert.aiBriefing || alert.body,
    whyItMatters: [
      `The signal cleared a score of ${alert.score}/100.`,
      `Urgency is marked ${alert.urgency}.`,
      alert.ticker
        ? `The signal is associated with ticker ${alert.ticker}.`
        : "The signal may relate to broader market, firm, or client context.",
      `Detected for user ${alert.user.email}.`,
    ],
    suggestedActions: [
      "Review the original source and supporting AI briefing.",
      "Check whether the signal overlaps with client holdings, watchlists, or research notes.",
      "If material, create an advisor briefing or firm discussion item.",
      "If the signal is weakly sourced, keep it in watch mode until corroborated.",
    ],
    riskFlags: [
      "Do not act without verifying the source.",
      "Confirm whether the alert is already priced into the market.",
      "Check suitability, liquidity, concentration, and client objective fit.",
    ],
    relatedFirmIds: [],
    relatedUserIds: [alert.userId],
    sources: [
      {
        label: "Alert source",
        sourceName: alert.source,
        url: alert.sourceUrl,
        score: alert.score,
        capturedAt: alert.createdAt,
      },
    ],
  };
}

function buildDecisionLead(decision: {
  id: string;
  userId: string;
  title: string;
  summary: string | null;
  sourceName: string;
  url: string | null;
  category: string;
  subcategory: string;
  urgency: string;
  score: number;
  materialityScore: number;
  relevanceScore: number;
  trustScore: number;
  reasonsJson: string;
  matchedTickersJson: string;
  matchedAreasJson: string;
  createdAt: Date;
  user: {
    id: string;
    name: string;
    email: string;
  };
}): FounderLead {
  const reasons = parseJsonList(decision.reasonsJson).map(String);
  const tickers = parseJsonList(decision.matchedTickersJson).map(String);
  const areas = parseJsonList(decision.matchedAreasJson).map(String);

  const confidence = confidenceFromSignal({
    score: decision.score,
    materialityScore: decision.materialityScore,
    relevanceScore: decision.relevanceScore,
    trustScore: decision.trustScore,
  });

  return {
    id: `decision-${decision.id}`,
    title: decision.title,
    leadType: "Ranked Intelligence Lead",
    priority: priorityFromScore(decision.score),
    confidence,
    expectedUpside:
      decision.materialityScore >= 80
        ? "Potentially material market event requiring advisor review."
        : decision.relevanceScore >= 80
          ? "Strong user/portfolio relevance. Could support client communication or research."
          : "Possible research lead if corroborated by additional sources.",
    summary:
      decision.summary ||
      "Slice retained this intelligence decision because it cleared scoring and noise thresholds.",
    whyItMatters: [
      `Score: ${decision.score}/100.`,
      `Materiality: ${decision.materialityScore}/100.`,
      `Relevance: ${decision.relevanceScore}/100.`,
      `Source trust: ${decision.trustScore}/100.`,
      `Category: ${decision.category} / ${decision.subcategory}.`,
      tickers.length ? `Matched tickers: ${tickers.join(", ")}.` : "",
      areas.length ? `Matched areas: ${areas.join(", ")}.` : "",
      ...reasons.slice(0, 5),
    ].filter(Boolean),
    suggestedActions: [
      "Review the source before treating this as actionable.",
      "Compare this signal against portfolio holdings and client objectives.",
      "Ask whether the event changes risk, valuation, sentiment, or timing.",
      "If the signal is high materiality and high relevance, create a briefing or firm discussion.",
    ],
    riskFlags: [
      "A high score is not a buy/sell recommendation.",
      "Market data, valuation, client suitability, and compliance review are still required.",
      "Avoid acting on a single-source headline without confirmation.",
    ],
    relatedFirmIds: [],
    relatedUserIds: [decision.userId],
    sources: [
      {
        label: "Ranked triage source",
        sourceName: decision.sourceName,
        url: decision.url,
        score: decision.score,
        capturedAt: decision.createdAt,
      },
    ],
  };
}

function buildFirmLead(firm: {
  id: string;
  name: string;
  healthScore: number;
  highAlertCount: number;
  highDecisionCount: number;
  openTaskCount: number;
  completedTaskCount: number;
  executiveRead: string;
}): FounderLead | null {
  if (
    firm.highAlertCount < 3 &&
    firm.highDecisionCount < 3 &&
    firm.openTaskCount <= firm.completedTaskCount + 5 &&
    firm.healthScore >= 70
  ) {
    return null;
  }

  const operationalRisk =
    firm.openTaskCount > firm.completedTaskCount + 5
      ? "Execution backlog appears elevated."
      : "Execution appears manageable.";

  return {
    id: `firm-${firm.id}`,
    title: `${firm.name}: founder review opportunity`,
    leadType: "Firm Intelligence Lead",
    priority: firm.healthScore < 45 ? "High" : "Medium",
    confidence: clamp(100 - firm.healthScore + firm.highAlertCount * 4 + firm.highDecisionCount * 3),
    expectedUpside:
      "Operational review may reveal opportunities to improve advisor workflow, client communication, or investment decision quality.",
    summary: firm.executiveRead,
    whyItMatters: [
      `Firm health score is ${firm.healthScore}/100.`,
      `${firm.highAlertCount} high-score alerts were associated with this firm.`,
      `${firm.highDecisionCount} high-score triage decisions were associated with this firm.`,
      operationalRisk,
    ],
    suggestedActions: [
      "Review the firm's top signals and task backlog.",
      "Send a founder directive if advisor workflow needs correction.",
      "Check whether alerts are being converted into briefings, tasks, or client-ready decisions.",
      "If the firm is healthy, study what they find most useful and replicate it across other firms.",
    ],
    riskFlags: [
      "High signal volume may overwhelm advisors.",
      "Low task completion may indicate poor adoption or unclear workflow.",
    ],
    relatedFirmIds: [firm.id],
    relatedUserIds: [],
    sources: [
      {
        label: "Firm operating data",
        sourceName: "Slice Firm Workspace",
        url: null,
        score: firm.healthScore,
        capturedAt: new Date(),
      },
    ],
  };
}

function buildCategoryLeads(
  decisions: Array<{
    category: string;
    score: number;
    title: string;
    sourceName: string;
    url: string | null;
    createdAt: Date;
  }>
): FounderLead[] {
  const categoryMap = new Map<
    string,
    Array<{
      category: string;
      score: number;
      title: string;
      sourceName: string;
      url: string | null;
      createdAt: Date;
    }>
  >();

  for (const decision of decisions) {
    const items = categoryMap.get(decision.category) ?? [];
    items.push(decision);
    categoryMap.set(decision.category, items);
  }

  const leads: FounderLead[] = [];

  for (const [category, items] of categoryMap.entries()) {
    const averageScore =
      items.reduce((sum, item) => sum + item.score, 0) /
      Math.max(items.length, 1);

    if (items.length < 3 && averageScore < 75) {
      continue;
    }

    leads.push({
      id: `category-${category}`,
      title: `${category}: recurring signal cluster`,
      leadType: "Signal Cluster Lead",
      priority: averageScore >= 85 ? "High" : "Medium",
      confidence: clamp(averageScore + Math.min(15, items.length * 3)),
      expectedUpside:
        "Recurring signal clusters can reveal themes that firms are repeatedly finding useful.",
      summary: `${items.length} retained decisions appeared in ${category}, with an average score of ${Math.round(
        averageScore
      )}.`,
      whyItMatters: [
        "Repeated category concentration may indicate a market theme worth monitoring.",
        "If multiple firms or users generate similar signal categories, the platform may benefit from a dedicated workflow or alert pack.",
        `Average score in this cluster: ${Math.round(averageScore)}/100.`,
      ],
      suggestedActions: [
        "Review the highest-scoring sources in this category.",
        "Consider creating a firm-wide briefing template for this signal cluster.",
        "If the theme is recurring, add specialized scoring rules or a dedicated radar module.",
      ],
      riskFlags: [
        "Clustered headlines can create narrative bias.",
        "Theme momentum can reverse quickly if the market prices it in.",
      ],
      relatedFirmIds: [],
      relatedUserIds: [],
      sources: items.slice(0, 5).map((item) => ({
        label: "Cluster source",
        sourceName: item.sourceName,
        url: item.url,
        score: item.score,
        capturedAt: item.createdAt,
      })),
    });
  }

  return leads
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 8);
}

function buildAlternativeLead({
  ventureCount,
  pennyStockCount,
}: {
  ventureCount: number;
  pennyStockCount: number;
}): FounderLead | null {
  if (ventureCount + pennyStockCount === 0) return null;

  return {
    id: "alternative-investment-activity",
    title: "Alternative investment activity is emerging",
    leadType: "Alternative Investment Governance Lead",
    priority: ventureCount + pennyStockCount >= 5 ? "High" : "Medium",
    confidence: clamp(60 + ventureCount * 6 + pennyStockCount * 5),
    expectedUpside:
      "Alternative investment records may reveal differentiated deal flow, crypto/penny-stock interest, or venture themes worth monitoring.",
    summary: `${ventureCount} venture record(s) and ${pennyStockCount} penny-stock record(s) were found across the platform.`,
    whyItMatters: [
      "Riskier investments can produce valuable insights but require strict governance.",
      "Founder-level review can identify recurring speculative themes before they become firm-wide habits.",
      "Alternative investment behavior may reveal what advisors find useful beyond core portfolio tools.",
    ],
    suggestedActions: [
      "Review venture and penny-stock records for thesis quality and risk controls.",
      "Require downside case, liquidity review, source validation, and position sizing for speculative ideas.",
      "If patterns emerge, consider a founder-approved alternative-investment scoring framework.",
    ],
    riskFlags: [
      "Penny stocks carry dilution, liquidity, manipulation, and promotional risk.",
      "Venture investments are illiquid and frequently fail.",
      "Crypto markets are volatile, sentiment-driven, and exposed to custody/regulatory risk.",
    ],
    relatedFirmIds: [],
    relatedUserIds: [],
    sources: [
      {
        label: "Alternative investment records",
        sourceName: "Slice Alternative Investments",
        url: "/alternative-investments",
        score: ventureCount + pennyStockCount,
        capturedAt: new Date(),
      },
    ],
  };
}

function dedupeLeads(leads: FounderLead[]) {
  const seen = new Set<string>();

  return leads.filter((lead) => {
    if (seen.has(lead.id)) return false;
    seen.add(lead.id);
    return true;
  });
}

async function loadFounderPortal(founderUserId: string) {
  const [
    users,
    firms,
    recentAlerts,
    recentDecisions,
    recentDeliveries,
    recentAuditLogs,
    clientCount,
    holdingCount,
    portfolioAggregate,
    ventureCount,
    pennyStockCount,
    recentVentures,
    recentPennyStocks,
  ] = await Promise.all([
    prisma.user.findMany({
      select: {
        id: true,
        name: true,
        email: true,
        createdAt: true,
        platformStatus: true,
        governanceReason: true,
        governedAt: true,
        firmMemberships: {
          include: {
            firm: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 300,
    }),

    prisma.firm.findMany({
      include: {
        createdBy: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        memberships: {
          include: {
            user: true,
          },
          orderBy: [{ role: "asc" }, { createdAt: "asc" }],
        },
        invites: {
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        },
        projects: {
          include: {
            agendaTasks: true,
          },
          orderBy: {
            createdAt: "desc",
          },
        },
        weeklyAgendas: {
          include: {
            tasks: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 50,
        },
        posts: {
          orderBy: {
            createdAt: "desc",
          },
          take: 20,
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),

    prisma.alertEvent.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 120,
    }),

    prisma.headlineDecision.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 120,
    }),

    prisma.notificationDelivery.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),

    prisma.auditLog.findMany({
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 100,
    }),

    prisma.clientProfile.count(),

    prisma.investorHolding.count(),

    prisma.investorHolding.aggregate({
      _sum: {
        valueNumber: true,
      },
    }),

    optionalCount("alternativeVenture"),

    optionalCount("alternativePennyStock"),

    optionalFindMany<Record<string, unknown>>("alternativeVenture", {
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),

    optionalFindMany<Record<string, unknown>>("alternativePennyStock", {
      orderBy: { updatedAt: "desc" },
      take: 30,
    }),
  ]);

  const firmSummaries = firms.map((firm) => {
    const memberUserIds = firm.memberships.map(
      (membership) => membership.userId
    );

    const activeMembers = firm.memberships.filter(
      (membership) => membership.status === "Active"
    );

    const allTasks = firm.weeklyAgendas.flatMap((agenda) => agenda.tasks);

    const openTasks = allTasks.filter(
      (task) => task.status !== "Complete" && task.status !== "Done"
    );

    const completedTasks = allTasks.filter(
      (task) => task.status === "Complete" || task.status === "Done"
    );

    const alerts = recentAlerts.filter((alert) =>
      memberUserIds.includes(alert.userId)
    );

    const decisions = recentDecisions.filter((decision) =>
      memberUserIds.includes(decision.userId)
    );

    const highAlerts = alerts.filter((alert) => alert.score >= 80);

    const highDecisions = decisions.filter((decision) => decision.score >= 80);

    const healthScore = firmHealthScore({
      platformStatus: firm.platformStatus,
      activeMembers: activeMembers.length,
      openTasks: openTasks.length,
      completedTasks: completedTasks.length,
      projects: firm.projects.length,
      highAlerts: highAlerts.length,
      highDecisions: highDecisions.length,
    });

    const executiveRead =
      firm.platformStatus !== "Active"
        ? "Firm is under governance restriction."
        : highAlerts.length >= 5
          ? "High intelligence activity. Review advisor workload and alert response."
          : openTasks.length > completedTasks.length + 5
            ? "Execution risk is rising. Review open tasks and ownership."
            : firm.projects.length === 0
              ? "Firm has low project activity. Consider onboarding guidance."
              : "Firm appears operationally healthy.";

    return {
      id: firm.id,
      name: firm.name,
      firmEmail: firm.firmEmail,
      firmCode: firm.firmCode,
      platformStatus: firm.platformStatus,
      governanceReason: firm.governanceReason,
      governedAt: firm.governedAt,
      createdAt: firm.createdAt,
      createdBy: firm.createdBy,
      activeMemberCount: activeMembers.length,
      totalMemberCount: firm.memberships.length,
      inviteCount: firm.invites.length,
      projectCount: firm.projects.length,
      postCount: firm.posts.length,
      openTaskCount: openTasks.length,
      completedTaskCount: completedTasks.length,
      highAlertCount: highAlerts.length,
      highDecisionCount: highDecisions.length,
      healthScore,
      executiveRead,
      members: firm.memberships.map((membership) => ({
        id: membership.id,
        role: membership.role,
        status: membership.status,
        canAccessPortfolios: membership.canAccessPortfolios,
        canManageProjects: membership.canManageProjects,
        canInviteMembers: membership.canInviteMembers,
        canManageFirm: membership.canManageFirm,
        user: {
          id: membership.user.id,
          name: membership.user.name,
          email: membership.user.email,
          platformStatus: membership.user.platformStatus,
          governanceReason: membership.user.governanceReason,
        },
      })),
      recentProjects: firm.projects.slice(0, 8).map((project) => ({
        id: project.id,
        title: project.title,
        status: project.status,
        priority: project.priority,
        dueDate: project.dueDate,
        taskCount: project.agendaTasks.length,
      })),
      recentPosts: firm.posts.slice(0, 5),
    };
  });

  const globalStats = {
    userCount: users.length,
    activeUserCount: users.filter((user) => user.platformStatus === "Active")
      .length,
    bannedUserCount: users.filter((user) => user.platformStatus === "Banned")
      .length,
    suspendedUserCount: users.filter(
      (user) => user.platformStatus === "Suspended"
    ).length,
    firmCount: firms.length,
    activeFirmCount: firms.filter((firm) => firm.platformStatus === "Active")
      .length,
    bannedFirmCount: firms.filter((firm) => firm.platformStatus === "Banned")
      .length,
    clientCount,
    holdingCount,
    portfolioValue: portfolioAggregate._sum.valueNumber ?? 0,
    retainedDecisionCount: recentDecisions.length,
    alertCount: recentAlerts.length,
    highSignalCount:
      recentAlerts.filter((alert) => alert.score >= 80).length +
      recentDecisions.filter((decision) => decision.score >= 80).length,
    deliveryCount: recentDeliveries.length,
    auditLogCount: recentAuditLogs.length,
    ventureCount,
    pennyStockCount,
  };

  const alertLeads = recentAlerts
    .filter((alert) => alert.score >= 75)
    .slice(0, 20)
    .map(buildAlertLead);

  const decisionLeads = recentDecisions
    .filter((decision) => decision.score >= 70)
    .slice(0, 25)
    .map(buildDecisionLead);

  const firmLeads = firmSummaries
    .map(buildFirmLead)
    .filter((lead): lead is FounderLead => Boolean(lead));

  const categoryLeads = buildCategoryLeads(recentDecisions);

  const alternativeLead = buildAlternativeLead({
    ventureCount,
    pennyStockCount,
  });

  const founderLeads = dedupeLeads([
    ...alertLeads,
    ...decisionLeads,
    ...categoryLeads,
    ...firmLeads,
    ...(alternativeLead ? [alternativeLead] : []),
  ])
    .sort(
      (a, b) =>
        b.confidence - a.confidence ||
        (b.priority === "Critical" ? 1 : 0) -
          (a.priority === "Critical" ? 1 : 0)
    )
    .slice(0, 40);

  const executiveRecommendations = [
    globalStats.highSignalCount >= 10
      ? {
          title: "High signal activity is elevated",
          priority: "High",
          detail:
            "Multiple high-score alerts or triage decisions exist across firms. Review top-ranked opportunities and advisor delivery status.",
        }
      : {
          title: "Signal volume appears controlled",
          priority: "Normal",
          detail:
            "High-score intelligence volume is not overwhelming. Continue monitoring source quality and noise thresholds.",
        },

    globalStats.bannedUserCount || globalStats.bannedFirmCount
      ? {
          title: "Governance restrictions are active",
          priority: "Critical",
          detail:
            "One or more users or firms are currently restricted. Review governance notes and audit trail.",
        }
      : {
          title: "No active platform bans",
          priority: "Normal",
          detail:
            "No users or firms are currently marked as banned by founder governance.",
        },

    globalStats.ventureCount + globalStats.pennyStockCount > 0
      ? {
          title: "Alternative investment activity detected",
          priority: "Medium",
          detail:
            "Some firms are tracking venture or penny-stock opportunities. Review risk controls and thesis quality.",
        }
      : {
          title: "No alternative investment records detected",
          priority: "Low",
          detail:
            "No firm-level venture or penny-stock records were found. Crypto market data remains available separately.",
        },

    founderLeads.length >= 12
      ? {
          title: "Founder lead queue is active",
          priority: "High",
          detail:
            "The founder intelligence engine has generated multiple lead packages. Prioritize the highest confidence leads with direct sources.",
        }
      : {
          title: "Founder lead queue is manageable",
          priority: "Normal",
          detail:
            "Lead volume is currently manageable. Continue monitoring the highest confidence signals.",
        },
  ];

  return {
    founderUserId,
    configuredFounderEmails: founderEmails(),
    globalStats,
    firmSummaries,
    users,
    recentAlerts,
    recentDecisions,
    recentDeliveries,
    recentAuditLogs,
    executiveRecommendations,
    founderLeads,
    recentVentures,
    recentPennyStocks,
    generatedAt: new Date().toISOString(),
  };
}

export async function GET() {
  const { user, error } = await requireFounder();

  if (error || !user) return error;

  return NextResponse.json(await loadFounderPortal(user.id));
}

export async function POST(request: Request) {
  const { user, error } = await requireFounder();

  if (error || !user) return error;

  const body = await request.json();
  const action = cleanString(body.action);
  const reason = cleanString(body.reason) || "Founder governance action.";

  if (action === "banUser") {
    const userId = cleanString(body.userId);

    if (userId === user.id) {
      return NextResponse.json(
        {
          error:
            "You cannot ban your own founder account from the founder portal.",
        },
        { status: 400 }
      );
    }

    const target = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: userId,
        },
        data: {
          platformStatus: "Banned",
          governanceReason: reason,
          governedAt: new Date(),
        },
      }),
      prisma.firmMembership.updateMany({
        where: {
          userId,
        },
        data: {
          status: "Removed",
          canAccessPortfolios: false,
          canManageProjects: false,
          canInviteMembers: false,
          canManageFirm: false,
        },
      }),
      prisma.session.deleteMany({
        where: {
          userId,
        },
      }),
    ]);

    await writeFounderAudit({
      founderUserId: user.id,
      eventType: "FounderBanUser",
      title: `Banned user: ${target.email}`,
      detail: reason,
      metadata: {
        targetUserId: userId,
      },
    });

    return NextResponse.json(await loadFounderPortal(user.id));
  }

  if (action === "restoreUser") {
    const userId = cleanString(body.userId);

    const target = await prisma.user.findUnique({
      where: {
        id: userId,
      },
    });

    if (!target) {
      return NextResponse.json({ error: "User not found." }, { status: 404 });
    }

    await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        platformStatus: "Active",
        governanceReason: null,
        governedAt: new Date(),
      },
    });

    await writeFounderAudit({
      founderUserId: user.id,
      eventType: "FounderRestoreUser",
      title: `Restored user platform status: ${target.email}`,
      detail: reason,
      metadata: {
        targetUserId: userId,
      },
    });

    return NextResponse.json(await loadFounderPortal(user.id));
  }

  if (action === "clearUserSessions") {
    const userId = cleanString(body.userId);

    if (userId === user.id) {
      return NextResponse.json(
        {
          error:
            "You cannot clear your own founder session from this action. Use logout instead.",
        },
        { status: 400 }
      );
    }

    const result = await prisma.session.deleteMany({
      where: {
        userId,
      },
    });

    await writeFounderAudit({
      founderUserId: user.id,
      eventType: "FounderClearUserSessions",
      title: "Cleared user sessions",
      detail: reason,
      metadata: {
        targetUserId: userId,
        removedSessions: result.count,
      },
    });

    return NextResponse.json(await loadFounderPortal(user.id));
  }

  if (action === "banFirm") {
    const firmId = cleanString(body.firmId);

    const firm = await prisma.firm.findUnique({
      where: {
        id: firmId,
      },
      include: {
        memberships: true,
      },
    });

    if (!firm) {
      return NextResponse.json({ error: "Firm not found." }, { status: 404 });
    }

    const userIds = firm.memberships.map((membership) => membership.userId);

    await prisma.$transaction([
      prisma.firm.update({
        where: {
          id: firmId,
        },
        data: {
          platformStatus: "Banned",
          governanceReason: reason,
          governedAt: new Date(),
        },
      }),
      prisma.firmMembership.updateMany({
        where: {
          firmId,
        },
        data: {
          status: "Removed",
          canAccessPortfolios: false,
          canManageProjects: false,
          canInviteMembers: false,
          canManageFirm: false,
        },
      }),
      prisma.session.deleteMany({
        where: {
          userId: {
            in: userIds.filter((targetUserId) => targetUserId !== user.id),
          },
        },
      }),
    ]);

    await writeFounderAudit({
      founderUserId: user.id,
      eventType: "FounderBanFirm",
      title: `Banned firm: ${firm.name}`,
      detail: reason,
      metadata: {
        firmId,
        affectedUserIds: userIds,
      },
    });

    return NextResponse.json(await loadFounderPortal(user.id));
  }

  if (action === "restoreFirm") {
    const firmId = cleanString(body.firmId);

    const firm = await prisma.firm.findUnique({
      where: {
        id: firmId,
      },
    });

    if (!firm) {
      return NextResponse.json({ error: "Firm not found." }, { status: 404 });
    }

    await prisma.firm.update({
      where: {
        id: firmId,
      },
      data: {
        platformStatus: "Active",
        governanceReason: null,
        governedAt: new Date(),
      },
    });

    await writeFounderAudit({
      founderUserId: user.id,
      eventType: "FounderRestoreFirm",
      title: `Restored firm platform status: ${firm.name}`,
      detail: reason,
      metadata: {
        firmId,
      },
    });

    return NextResponse.json(await loadFounderPortal(user.id));
  }

  if (action === "removeMember") {
    const membershipId = cleanString(body.membershipId);

    const membership = await prisma.firmMembership.findUnique({
      where: {
        id: membershipId,
      },
      include: {
        user: true,
        firm: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Membership not found." },
        { status: 404 }
      );
    }

    await prisma.$transaction([
      prisma.firmMembership.update({
        where: {
          id: membershipId,
        },
        data: {
          status: "Removed",
          canAccessPortfolios: false,
          canManageProjects: false,
          canInviteMembers: false,
          canManageFirm: false,
        },
      }),
      prisma.session.deleteMany({
        where: {
          userId:
            membership.userId === user.id
              ? "__do_not_clear_founder__"
              : membership.userId,
        },
      }),
    ]);

    await writeFounderAudit({
      founderUserId: user.id,
      eventType: "FounderRemoveMember",
      title: `Removed member ${membership.user.email} from ${membership.firm.name}`,
      detail: reason,
      metadata: {
        membershipId,
        userId: membership.userId,
        firmId: membership.firmId,
      },
    });

    return NextResponse.json(await loadFounderPortal(user.id));
  }

  if (action === "restoreMember") {
    const membershipId = cleanString(body.membershipId);

    const membership = await prisma.firmMembership.findUnique({
      where: {
        id: membershipId,
      },
      include: {
        user: true,
        firm: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: "Membership not found." },
        { status: 404 }
      );
    }

    await prisma.firmMembership.update({
      where: {
        id: membershipId,
      },
      data: {
        status: "Active",
        canAccessPortfolios: true,
      },
    });

    await writeFounderAudit({
      founderUserId: user.id,
      eventType: "FounderRestoreMember",
      title: `Restored member ${membership.user.email} to ${membership.firm.name}`,
      detail: reason,
      metadata: {
        membershipId,
        userId: membership.userId,
        firmId: membership.firmId,
      },
    });

    return NextResponse.json(await loadFounderPortal(user.id));
  }

  if (action === "createFounderDirective") {
    const firmId = cleanString(body.firmId);
    const title = cleanString(body.title);
    const directiveBody = cleanString(body.body);

    if (!firmId || !title || !directiveBody) {
      return NextResponse.json(
        {
          error: "Firm, directive title, and directive body are required.",
        },
        { status: 400 }
      );
    }

    const firm = await prisma.firm.findUnique({
      where: {
        id: firmId,
      },
    });

    if (!firm) {
      return NextResponse.json({ error: "Firm not found." }, { status: 404 });
    }

    await prisma.firmPost.create({
      data: {
        firmId,
        projectId: null,
        authorMembershipId: null,
        title,
        body: directiveBody,
        postType: "Founder Directive",
      },
    });

    await writeFounderAudit({
      founderUserId: user.id,
      eventType: "FounderDirectiveCreated",
      title: `Founder directive sent to ${firm.name}`,
      detail: title,
      metadata: {
        firmId,
      },
    });

    return NextResponse.json(await loadFounderPortal(user.id));
  }

  return NextResponse.json(
    {
      error: "Unknown founder governance action.",
    },
    { status: 400 }
  );
}