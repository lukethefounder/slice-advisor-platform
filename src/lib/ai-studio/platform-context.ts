import {
  accessibleClientWhere,
  canManageClientRouting,
} from "@/lib/client-access";
import { getPlatformBrainContext } from "@/lib/bot/platform-brain";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

export type SliceAiUser = {
  id: string;
  name: string;
  email: string;
};

export type SliceAiProfile = {
  id: string;
  userId: string;
  firmId: string | null;
  botName: string;
  preferredTone: string;
  commandStyle: string;
  autonomyLevel: string;
  personalityJson: string;
  riskJson: string;
  customInstructions: string | null;
};

export type SliceCapability = {
  key: string;
  label: string;
  route: string;
  category: string;
  description: string;
  capabilities: string[];
  exampleCommands: string[];
  approvalNotes?: string;
};

export type SlicePlatformSearchGroup = {
  label: string;
  route: string;
  items: Array<{
    id: string;
    title: string;
    detail?: string | null;
    score?: number | null;
    status?: string | null;
    ticker?: string | null;
    sourceUrl?: string | null;
  }>;
};

export type SlicePlatformContext = {
  generatedAt: string;
  user: {
    id: string;
    name: string;
  };
  firm: {
    id: string | null;
    name: string | null;
    role: string | null;
    membershipId: string | null;
  };
  permissions: {
    canManageFirm: boolean;
    canManageProjects: boolean;
    canInviteMembers: boolean;
    canAccessPortfolios: boolean;
    canManageClientRouting: boolean;
  };
  privacy: {
    clientNamesIncludedInAiSnapshot: boolean;
    privateClientDataMayBeWebSearched: false;
    note: string;
  };
  capabilities: SliceCapability[];
  platformBrain: Awaited<
    ReturnType<
      typeof getPlatformBrainContext
    >
  >;
  metrics: {
    accessibleClients: number;
    activeClients: number;
    clientsNeedingReview: number;
    clientHoldings: number;
    openPersonalTasks: number;
    openFirmTasks: number;
    unreadAlerts: number;
    highPriorityAlerts: number;
    openOpportunities: number;
    pendingApprovals: number;
    activeWatchlistItems: number;
    activePriceAlerts: number;
    reportsReady: number;
    activeProjects: number;
    unreadAssignedClientMessages: number;
  };
  recent: {
    alerts: Array<
      Record<string, unknown>
    >;
    opportunities: Array<
      Record<string, unknown>
    >;
    watchlistItems: Array<
      Record<string, unknown>
    >;
    researchNotes: Array<
      Record<string, unknown>
    >;
    tasks: Array<
      Record<string, unknown>
    >;
    projects: Array<
      Record<string, unknown>
    >;
    reports: Array<
      Record<string, unknown>
    >;
    approvals: Array<
      Record<string, unknown>
    >;
    clients: Array<
      Record<string, unknown>
    >;
    assignedClientMessages: Array<
      Record<string, unknown>
    >;
  };
  memory: Array<{
    title: string;
    value: string;
    type: string;
    confidenceScore: number;
  }>;
};

export const SLICE_PLATFORM_CAPABILITIES: SliceCapability[] =
  [
    {
      key: "workspace",
      label: "Workspace",
      route: "/workspace",
      category: "Home",
      description:
        "Central operating dashboard for the advisor and firm.",
      capabilities: [
        "workspace status",
        "firm overview",
        "navigation",
        "operating metrics",
      ],
      exampleCommands: [
        "Open the workspace",
        "Show my dashboard",
        "What needs attention today?",
      ],
    },
    {
      key: "ai-studio",
      label: "AI Studio",
      route:
        "/workspace/personal-bot",
      category: "AI",
      description:
        "Unified financial research, voice command, reports, tasks, and platform operations.",
      capabilities: [
        "researched answers",
        "voice operations",
        "platform commands",
        "report creation",
        "memory",
      ],
      exampleCommands: [
        "Research NVDA",
        "Create a client-ready report",
        "Open Voice Ops",
      ],
    },
    {
      key: "ai-reports",
      label: "AI Report Library",
      route:
        "/workspace/personal-bot/reports",
      category: "Reports",
      description:
        "Browser and PDF views of AI-generated advisor reports.",
      capabilities: [
        "report review",
        "report download",
        "source review",
        "advisor-ready packets",
      ],
      exampleCommands: [
        "Open AI reports",
        "Show my latest report",
      ],
    },
    {
      key: "client-profiles",
      label: "Client Profiles",
      route: "/workspace/clients",
      category: "Clients",
      description:
        "Permission-scoped client records, holdings, risk reviews, notes, tasks, and documents.",
      capabilities: [
        "client records",
        "holdings",
        "risk review",
        "client assignments",
        "portal access",
      ],
      exampleCommands: [
        "Open client profiles",
        "Create a new client",
        "Find Apple exposure",
      ],
      approvalNotes:
        "Client access is limited by firm role and advisor assignment.",
    },
    {
      key: "client-portal-inbox",
      label:
        "Client Portal Inbox",
      route:
        "/workspace/client-portal-inbox",
      category: "Clients",
      description:
        "Assigned-advisor inbox for client messages and profile updates.",
      capabilities: [
        "assigned client messages",
        "advisor replies",
        "firm oversight",
        "message status",
      ],
      exampleCommands: [
        "Open client messages",
        "Show unread portal updates",
      ],
    },
    {
      key:
        "client-email-center",
      label:
        "Client Email Center",
      route:
        "/workspace/client-emails",
      category:
        "Communications",
      description:
        "AI-assisted client email drafting with approval and delivery controls.",
      capabilities: [
        "draft email",
        "polish email",
        "approval queue",
        "approved delivery",
      ],
      exampleCommands: [
        "Draft a volatility email",
        "Open the email center",
      ],
      approvalNotes:
        "External delivery remains approval-gated.",
    },
    {
      key: "client-briefings",
      label: "Client Briefings",
      route:
        "/workspace/client-briefings",
      category: "Reports",
      description:
        "Advisor-reviewed client and household briefing generation.",
      capabilities: [
        "client briefing",
        "market summary",
        "portfolio summary",
        "action items",
      ],
      exampleCommands: [
        "Create a client briefing",
        "Open client briefings",
      ],
    },
    {
      key: "team-board",
      label: "Team Board",
      route:
        "/workspace/team-board",
      category: "Operations",
      description:
        "Firm projects, agendas, tasks, owners, priorities, and deadlines.",
      capabilities: [
        "task creation",
        "task assignment",
        "project tracking",
        "deadline review",
      ],
      exampleCommands: [
        "Create a high-priority task",
        "Open the team board",
      ],
    },
    {
      key: "custom-board",
      label: "Custom Board",
      route:
        "/workspace/custom-board",
      category: "Operations",
      description:
        "Flexible advisor work board for custom workflows.",
      capabilities: [
        "custom tasks",
        "workflow organization",
        "status tracking",
      ],
      exampleCommands: [
        "Open the custom board",
      ],
    },
    {
      key:
        "firm-command-center",
      label:
        "Firm Command Center",
      route:
        "/workspace/firm-command-center",
      category: "Firm",
      description:
        "Firm-wide operating visibility, projects, team activity, and management controls.",
      capabilities: [
        "firm oversight",
        "project management",
        "team operations",
        "management metrics",
      ],
      exampleCommands: [
        "Open the firm command center",
        "Summarize firm operations",
      ],
    },
    {
      key: "market-visuals",
      label: "Market Visuals",
      route: "/market-visuals",
      category: "Markets",
      description:
        "Market charts and technical views for public securities.",
      capabilities: [
        "price charts",
        "technical indicators",
        "symbol comparison",
        "market context",
      ],
      exampleCommands: [
        "Open the NVDA chart",
        "Show market visuals",
      ],
    },
    {
      key: "triage",
      label:
        "Intelligence Triage",
      route: "/triage",
      category: "Intelligence",
      description:
        "Source-aware headline triage and materiality review.",
      capabilities: [
        "news triage",
        "source scoring",
        "materiality",
        "alert decisions",
      ],
      exampleCommands: [
        "Open triage",
        "Review high-priority headlines",
      ],
    },
    {
      key:
        "opportunity-radar",
      label:
        "Opportunity Radar",
      route:
        "/opportunity-radar",
      category: "Intelligence",
      description:
        "Scored investment and workflow opportunities with evidence and risk context.",
      capabilities: [
        "opportunity ranking",
        "risk scoring",
        "evidence",
        "suggested actions",
      ],
      exampleCommands: [
        "Rank the top opportunities",
        "Open opportunity radar",
      ],
    },
    {
      key: "portfolio-lab",
      label: "Portfolio Lab",
      route: "/portfolio-lab",
      category: "Portfolio",
      description:
        "Portfolio holdings, allocation, scenario, and rebalance analysis.",
      capabilities: [
        "holdings",
        "allocation",
        "scenario modeling",
        "rebalance review",
      ],
      exampleCommands: [
        "Open portfolio lab",
        "Analyze allocation risk",
      ],
    },
    {
      key:
        "watchlist-alerts",
      label:
        "Watchlist Alerts",
      route:
        "/watchlist-alerts",
      category: "Markets",
      description:
        "Named watchlists and high/low price alerts.",
      capabilities: [
        "watchlists",
        "price alerts",
        "market-data checks",
        "dashboard notifications",
      ],
      exampleCommands: [
        "Track MSFT",
        "Create an NVDA alert above 200",
      ],
    },
    {
      key:
        "alternative-investments",
      label:
        "Alternative Investments",
      route:
        "/alternative-investments",
      category: "Alternatives",
      description:
        "Venture, speculative equity, and digital-asset monitoring.",
      capabilities: [
        "venture monitoring",
        "penny stocks",
        "crypto",
        "high-risk review",
      ],
      exampleCommands: [
        "Open venture monitor",
        "Review crypto markets",
      ],
    },
    {
      key:
        "advisor-command-center",
      label:
        "Advisor Command Center",
      route:
        "/advisor-command-center",
      category: "Advisor OS",
      description:
        "Client brain, next-best actions, proof trail, and firm knowledge search.",
      capabilities: [
        "client brain",
        "next-best action",
        "proof trail",
        "firm knowledge",
      ],
      exampleCommands: [
        "Open advisor command center",
        "What should I do next?",
      ],
    },
    {
      key: "backend-kernel",
      label: "Backend Kernel",
      route: "/backend-kernel",
      category: "Backend",
      description:
        "Vendors, jobs, delivery queue, data quality, and backend operations.",
      capabilities: [
        "vendor health",
        "jobs",
        "delivery processing",
        "data-quality sweep",
      ],
      exampleCommands: [
        "Run vendor health",
        "Process delivery queue",
      ],
    },
    {
      key:
        "backend-readiness",
      label:
        "Backend Readiness",
      route:
        "/backend-readiness",
      category: "Backend",
      description:
        "System readiness, role policies, approvals, and tenant checks.",
      capabilities: [
        "system health",
        "approvals",
        "role policies",
        "readiness checks",
      ],
      exampleCommands: [
        "Open backend readiness",
        "Show pending approvals",
      ],
    },
    {
      key: "security",
      label:
        "Security and Compliance",
      route: "/security",
      category: "Governance",
      description:
        "Audit logs, security controls, disclosures, and compliance review.",
      capabilities: [
        "audit trail",
        "security settings",
        "disclosures",
        "compliance review",
      ],
      exampleCommands: [
        "Open security",
        "Show the audit trail",
      ],
    },
    {
      key: "settings",
      label:
        "Workspace Settings",
      route:
        "/workspace/settings",
      category: "Settings",
      description:
        "Advisor account, appearance, privacy, notification, and scheduling settings.",
      capabilities: [
        "advisor settings",
        "Calendly",
        "privacy",
        "notifications",
        "appearance",
      ],
      exampleCommands: [
        "Open settings",
        "Show my scheduling settings",
      ],
    },
  ];

function envBoolean(
  name: string,
  fallback: boolean,
) {
  const value = String(
    process.env[name] ?? "",
  )
    .trim()
    .toLowerCase();

  if (!value) return fallback;

  if (
    [
      "1",
      "true",
      "yes",
      "on",
    ].includes(value)
  ) {
    return true;
  }

  if (
    [
      "0",
      "false",
      "no",
      "off",
    ].includes(value)
  ) {
    return false;
  }

  return fallback;
}

function parseJson<T>(
  value:
    | string
    | null
    | undefined,
  fallback: T,
): T {
  if (!value) return fallback;

  try {
    return JSON.parse(
      value,
    ) as T;
  } catch {
    return fallback;
  }
}

async function safe<T>(
  fallback: T,
  callback: () => Promise<T>,
): Promise<T> {
  try {
    return await callback();
  } catch {
    return fallback;
  }
}

function sanitizePublicText(
  value: unknown,
  maximum = 1200,
) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function summarizeClientForAi(
  client: any,
  includeNames: boolean,
  index: number,
) {
  return {
    clientRef: includeNames
      ? client.fullName
      : `Accessible Client ${
          index + 1
        }`,
    household: includeNames
      ? client.householdName ??
        null
      : null,
    clientType:
      client.clientType,
    riskProfile:
      client.riskProfile,
    liquidityNeeds:
      client.liquidityNeeds,
    timeHorizon:
      client.timeHorizon,
    objective:
      sanitizePublicText(
        client.objective,
        500,
      ),
    status: client.status,
    assignedToCurrentAdvisor:
      Boolean(
        client.assignedAdvisorMembershipId,
      ),
    holdings: (
      client.holdings ?? []
    )
      .slice(0, 20)
      .map(
        (holding: any) => ({
          symbol:
            holding.symbol,
          assetClass:
            holding.assetClass,
          riskLevel:
            holding.riskLevel,
        }),
      ),
  };
}

export function platformCapabilitySummary() {
  return SLICE_PLATFORM_CAPABILITIES.map(
    (item) => ({
      key: item.key,
      label: item.label,
      route: item.route,
      category: item.category,
      description:
        item.description,
      capabilities:
        item.capabilities,
      exampleCommands:
        item.exampleCommands,
      approvalNotes:
        item.approvalNotes,
    }),
  );
}

export async function loadSlicePlatformContext(
  input: {
    user: SliceAiUser;
    profile: SliceAiProfile;
  },
): Promise<SlicePlatformContext> {
  const includeClientNames =
    envBoolean(
      "OPENAI_INCLUDE_CLIENT_NAMES",
      false,
    );

  const clientAccess =
    await accessibleClientWhere(
      input.user.id,
    );

  const membership =
    clientAccess.membership;

  const platformBrain =
    await safe(
      {
        routes: [],
        learnedPhrases: [],
        corrections: [],
      },
      () =>
        getPlatformBrainContext(
          input.user.id,
        ),
    );

  const clientRows =
    await safe<any[]>([], () =>
      db.clientProfile.findMany(
        {
          where:
            clientAccess.where,
          select: {
            id: true,
            fullName: true,
            householdName: true,
            clientType: true,
            riskProfile: true,
            liquidityNeeds: true,
            timeHorizon: true,
            objective: true,
            status: true,
            assignedAdvisorMembershipId:
              true,
            holdings: {
              select: {
                symbol: true,
                assetClass: true,
                riskLevel: true,
              },
              take: 30,
            },
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 100,
        },
      ),
    );

  const clientIds =
    clientRows.map(
      (client) => client.id,
    );

  const firmId =
    membership.firmId ||
    input.profile.firmId;

  const [
    personalTasks,
    firmTasks,
    alerts,
    opportunities,
    watchlistItems,
    priceAlerts,
    reports,
    projects,
    approvals,
    memories,
    researchNotes,
    assignedClientMessages,
  ] = await Promise.all([
    safe<any[]>([], () =>
      db.meetingTask.findMany({
        where: {
          OR: [
            {
              userId:
                input.user.id,
            },
            ...(clientIds.length
              ? [
                  {
                    clientId: {
                      in: clientIds,
                    },
                  },
                ]
              : []),
          ],
          status: {
            notIn: [
              "Done",
              "Complete",
              "Archived",
            ],
          },
        },
        select: {
          id: true,
          title: true,
          description: true,
          dueDate: true,
          priority: true,
          status: true,
          clientId: true,
        },
        orderBy: [
          {
            dueDate: "asc",
          },
          {
            createdAt: "desc",
          },
        ],
        take: 20,
      }),
    ),

    firmId
      ? safe<any[]>([], () =>
          db.firmAgendaTask.findMany(
            {
              where: {
                firmId,
                status: {
                  notIn: [
                    "Done",
                    "Complete",
                    "Archived",
                  ],
                },
              },
              select: {
                id: true,
                title: true,
                detail: true,
                dueDate: true,
                priority: true,
                status: true,
                projectId: true,
              },
              orderBy: [
                {
                  dueDate: "asc",
                },
                {
                  createdAt:
                    "desc",
                },
              ],
              take: 20,
            },
          ),
        )
      : Promise.resolve([]),

    safe<any[]>([], () =>
      db.alertEvent.findMany({
        where: {
          userId: input.user.id,
        },
        select: {
          id: true,
          title: true,
          source: true,
          ticker: true,
          urgency: true,
          score: true,
          status: true,
          createdAt: true,
          sourceUrl: true,
          aiBriefing: true,
        },
        orderBy: [
          {
            score: "desc",
          },
          {
            createdAt: "desc",
          },
        ],
        take: 15,
      }),
    ),

    safe<any[]>([], () =>
      db.opportunitySignal.findMany(
        {
          where: {
            userId:
              input.user.id,
            status: {
              not: "Archived",
            },
          },
          select: {
            id: true,
            title: true,
            summary: true,
            sourceName: true,
            priorityTier: true,
            compositeScore: true,
            opportunityScore: true,
            riskScore: true,
            confidenceScore: true,
            suggestedAction: true,
            tickersJson: true,
            status: true,
            createdAt: true,
          },
          orderBy: [
            {
              compositeScore:
                "desc",
            },
            {
              createdAt: "desc",
            },
          ],
          take: 15,
        },
      ),
    ),

    safe<any[]>([], () =>
      db.namedWatchlistItem.findMany(
        {
          where: {
            userId:
              input.user.id,
            status: {
              not: "Archived",
            },
          },
          select: {
            id: true,
            symbol: true,
            assetName: true,
            assetType: true,
            priority: true,
            status: true,
            thesis: true,
            sourceTitle: true,
            sourceUrl: true,
          },
          orderBy: [
            {
              priority: "asc",
            },
            {
              updatedAt: "desc",
            },
          ],
          take: 20,
        },
      ),
    ),

    safe<any[]>([], () =>
      db.watchlistPriceAlert.findMany(
        {
          where: {
            userId:
              input.user.id,
            status: "Active",
          },
          select: {
            id: true,
            symbol: true,
            assetName: true,
            upperTargetPrice:
              true,
            lowerTargetPrice:
              true,
            lastPrice: true,
            lastProvider: true,
            lastCheckedAt: true,
            notificationChannel:
              true,
            status: true,
          },
          orderBy: {
            updatedAt: "desc",
          },
          take: 20,
        },
      ),
    ),

    safe<any[]>([], () =>
      db.personalUserBotPdfReport.findMany(
        {
          where: {
            userId:
              input.user.id,
            status: {
              not: "Archived",
            },
          },
          select: {
            id: true,
            title: true,
            reportType: true,
            status: true,
            summary: true,
            downloadToken: true,
            createdAt: true,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 10,
        },
      ),
    ),

    firmId
      ? safe<any[]>([], () =>
          db.firmProject.findMany({
            where: {
              firmId,
              status: {
                not: "Archived",
              },
            },
            select: {
              id: true,
              title: true,
              description: true,
              status: true,
              priority: true,
              dueDate: true,
            },
            orderBy: [
              {
                priority: "asc",
              },
              {
                updatedAt:
                  "desc",
              },
            ],
            take: 15,
          }),
        )
      : Promise.resolve([]),

    safe<any[]>([], () =>
      db.backendApprovalItem.findMany(
        {
          where: {
            userId:
              input.user.id,
            status: "Pending",
          },
          select: {
            id: true,
            title: true,
            actionType: true,
            riskLevel: true,
            summary: true,
            status: true,
            createdAt: true,
          },
          orderBy: [
            {
              riskLevel: "desc",
            },
            {
              createdAt: "desc",
            },
          ],
          take: 15,
        },
      ),
    ),

    safe<any[]>([], () =>
      db.personalUserBotMemory.findMany(
        {
          where: {
            userId:
              input.user.id,
            status: "Active",
          },
          select: {
            title: true,
            value: true,
            memoryType: true,
            confidenceScore: true,
          },
          orderBy: [
            {
              confidenceScore:
                "desc",
            },
            {
              updatedAt: "desc",
            },
          ],
          take: 20,
        },
      ),
    ),

    safe<any[]>([], () =>
      db.researchNote.findMany({
        where: {
          userId: input.user.id,
        },
        select: {
          id: true,
          ticker: true,
          title: true,
          thesis: true,
          risks: true,
          decision: true,
          conviction: true,
          sourceLinks: true,
          updatedAt: true,
        },
        orderBy: {
          updatedAt: "desc",
        },
        take: 12,
      }),
    ),

    membership.id
      ? safe<any[]>([], () =>
          db.advisorClientInboxItem.findMany(
            {
              where: {
                firmId:
                  membership.firmId,
                assignedAdvisorMembershipId:
                  membership.id,
                status: {
                  notIn: [
                    "Resolved",
                    "Archived",
                  ],
                },
              },
              select: {
                id: true,
                clientId: true,
                kind: true,
                title: true,
                status: true,
                priority: true,
                createdAt: true,
              },
              orderBy: {
                createdAt:
                  "desc",
              },
              take: 15,
            },
          ),
        )
      : Promise.resolve([]),
  ]);

  const clients =
    clientRows.map(
      (client, index) =>
        summarizeClientForAi(
          client,
          includeClientNames,
          index,
        ),
    );

  const activeClients =
    clientRows.filter(
      (client) =>
        client.status ===
        "Active",
    ).length;

  const clientsNeedingReview =
    clientRows.filter(
      (client) =>
        client.status !==
          "Active" ||
        client.riskProfile ===
          "Aggressive" ||
        client.riskProfile ===
          "Conservative",
    ).length;

  const clientHoldings =
    clientRows.reduce(
      (sum, client) =>
        sum +
        (client.holdings
          ?.length ?? 0),
      0,
    );

  return {
    generatedAt:
      new Date().toISOString(),

    user: {
      id: input.user.id,
      name: input.user.name,
    },

    firm: {
      id:
        membership.firmId ??
        null,
      name:
        membership.firm?.name ??
        null,
      role:
        membership.role ??
        null,
      membershipId:
        membership.id ?? null,
    },

    permissions: {
      canManageFirm:
        Boolean(
          membership.canManageFirm,
        ),
      canManageProjects:
        Boolean(
          membership.canManageProjects,
        ),
      canInviteMembers:
        Boolean(
          membership.canInviteMembers,
        ),
      canAccessPortfolios:
        Boolean(
          membership.canAccessPortfolios,
        ),
      canManageClientRouting:
        canManageClientRouting(
          membership,
        ),
    },

    privacy: {
      clientNamesIncludedInAiSnapshot:
        includeClientNames,
      privateClientDataMayBeWebSearched:
        false,
      note:
        "The AI snapshot excludes client email addresses, encrypted notes, document contents, account numbers, and portfolio values. Public web research must never include private client identifiers.",
    },

    capabilities:
      platformCapabilitySummary(),

    platformBrain,

    metrics: {
      accessibleClients:
        clientRows.length,

      activeClients,

      clientsNeedingReview,

      clientHoldings,

      openPersonalTasks:
        personalTasks.length,

      openFirmTasks:
        firmTasks.length,

      unreadAlerts:
        alerts.filter(
          (alert) =>
            alert.status ===
            "Unread",
        ).length,

      highPriorityAlerts:
        alerts.filter(
          (alert) =>
            alert.score >= 80 ||
            [
              "High",
              "Critical",
            ].includes(
              alert.urgency,
            ),
        ).length,

      openOpportunities:
        opportunities.filter(
          (item) =>
            item.status !==
            "Complete",
        ).length,

      pendingApprovals:
        approvals.length,

      activeWatchlistItems:
        watchlistItems.length,

      activePriceAlerts:
        priceAlerts.length,

      reportsReady:
        reports.filter(
          (report) =>
            report.status ===
            "Ready",
        ).length,

      activeProjects:
        projects.filter(
          (project) =>
            project.status !==
            "Complete",
        ).length,

      unreadAssignedClientMessages:
        assignedClientMessages.filter(
          (item) =>
            item.status ===
            "Unread",
        ).length,
    },

    recent: {
      alerts: alerts.map(
        (item) => ({
          id: item.id,
          title: item.title,
          source: item.source,
          ticker: item.ticker,
          urgency:
            item.urgency,
          score: item.score,
          status: item.status,
          createdAt:
            item.createdAt,
          sourceUrl:
            item.sourceUrl,
          briefing:
            sanitizePublicText(
              item.aiBriefing,
              1000,
            ),
        }),
      ),

      opportunities:
        opportunities.map(
          (item) => ({
            id: item.id,
            title: item.title,
            summary:
              sanitizePublicText(
                item.summary,
                1000,
              ),
            sourceName:
              item.sourceName,
            priorityTier:
              item.priorityTier,
            compositeScore:
              item.compositeScore,
            opportunityScore:
              item.opportunityScore,
            riskScore:
              item.riskScore,
            confidenceScore:
              item.confidenceScore,
            suggestedAction:
              sanitizePublicText(
                item.suggestedAction,
                600,
              ),
            tickers:
              parseJson<
                string[]
              >(
                item.tickersJson,
                [],
              ),
            status: item.status,
          }),
        ),

      watchlistItems:
        watchlistItems.map(
          (item) => ({
            id: item.id,
            symbol: item.symbol,
            assetName:
              item.assetName,
            assetType:
              item.assetType,
            priority:
              item.priority,
            status: item.status,
            thesis:
              sanitizePublicText(
                item.thesis,
                600,
              ),
            sourceTitle:
              item.sourceTitle,
            sourceUrl:
              item.sourceUrl,
          }),
        ),

      researchNotes:
        researchNotes.map(
          (item) => ({
            id: item.id,
            ticker: item.ticker,
            title: item.title,
            thesis:
              sanitizePublicText(
                item.thesis,
                1200,
              ),
            risks:
              sanitizePublicText(
                item.risks,
                800,
              ),
            decision:
              item.decision,
            conviction:
              item.conviction,
            sourceLinks: String(
              item.sourceLinks ??
                "",
            )
              .split(/\r?\n/)
              .map((value) =>
                value.trim(),
              )
              .filter(Boolean)
              .slice(0, 8),
          }),
        ),

      tasks: [
        ...personalTasks.map(
          (item) => ({
            id: item.id,
            taskType:
              "Personal or Client Task",
            title: item.title,
            detail:
              sanitizePublicText(
                item.description,
                600,
              ),
            dueDate:
              item.dueDate,
            priority:
              item.priority,
            status: item.status,
          }),
        ),

        ...firmTasks.map(
          (item) => ({
            id: item.id,
            taskType:
              "Firm Agenda Task",
            title: item.title,
            detail:
              sanitizePublicText(
                item.detail,
                600,
              ),
            dueDate:
              item.dueDate,
            priority:
              item.priority,
            status: item.status,
          }),
        ),
      ].slice(0, 25),

      projects: projects.map(
        (item) => ({
          id: item.id,
          title: item.title,
          description:
            sanitizePublicText(
              item.description,
              600,
            ),
          status: item.status,
          priority:
            item.priority,
          dueDate: item.dueDate,
        }),
      ),

      reports: reports.map(
        (item) => ({
          id: item.id,
          title: item.title,
          reportType:
            item.reportType,
          status: item.status,
          summary:
            sanitizePublicText(
              item.summary,
              700,
            ),
          viewerUrl:
            `/workspace/personal-bot/reports?token=${item.downloadToken}`,
          pdfUrl:
            `/api/personal-bot/pdf-report?token=${item.downloadToken}`,
          createdAt:
            item.createdAt,
        }),
      ),

      approvals:
        approvals.map(
          (item) => ({
            id: item.id,
            title: item.title,
            actionType:
              item.actionType,
            riskLevel:
              item.riskLevel,
            summary:
              sanitizePublicText(
                item.summary,
                700,
              ),
            status: item.status,
            createdAt:
              item.createdAt,
          }),
        ),

      clients,

      assignedClientMessages:
        assignedClientMessages.map(
          (item) => ({
            id: item.id,

            clientRef:
              includeClientNames
                ? clientRows.find(
                    (client) =>
                      client.id ===
                      item.clientId,
                  )?.fullName ??
                  "Client"
                : "Assigned client",

            kind: item.kind,
            title: item.title,
            status: item.status,
            priority:
              item.priority,
            createdAt:
              item.createdAt,
          }),
        ),
    },

    memory: memories.map(
      (item) => ({
        title: item.title,
        value:
          sanitizePublicText(
            item.value,
            900,
          ),
        type:
          item.memoryType,
        confidenceScore:
          item.confidenceScore,
      }),
    ),
  };
}

export function compactSlicePlatformContext(
  context: SlicePlatformContext,
) {
  return {
    generatedAt:
      context.generatedAt,

    firm: context.firm,

    permissions:
      context.permissions,

    privacy: context.privacy,

    metrics: context.metrics,

    capabilities:
      context.capabilities,

    platformBrain:
      context.platformBrain,

    recent: {
      alerts:
        context.recent.alerts.slice(
          0,
          8,
        ),

      opportunities:
        context.recent.opportunities.slice(
          0,
          8,
        ),

      watchlistItems:
        context.recent.watchlistItems.slice(
          0,
          10,
        ),

      researchNotes:
        context.recent.researchNotes.slice(
          0,
          6,
        ),

      tasks:
        context.recent.tasks.slice(
          0,
          12,
        ),

      projects:
        context.recent.projects.slice(
          0,
          8,
        ),

      reports:
        context.recent.reports.slice(
          0,
          6,
        ),

      approvals:
        context.recent.approvals.slice(
          0,
          8,
        ),

      clients:
        context.recent.clients.slice(
          0,
          20,
        ),

      assignedClientMessages:
        context.recent.assignedClientMessages.slice(
          0,
          8,
        ),
    },

    memory:
      context.memory.slice(
        0,
        12,
      ),
  };
}

export async function searchSlicePlatformData(
  input: {
    user: SliceAiUser;
    profile: SliceAiProfile;
    query: string;
    ticker?: string | null;
  },
): Promise<{
  query: string;
  ticker: string | null;
  total: number;
  groups: SlicePlatformSearchGroup[];
}> {
  const query =
    input.query
      .trim()
      .slice(0, 300);

  const ticker =
    input.ticker
      ?.trim()
      .toUpperCase() ||
    null;

  const clientAccess =
    await accessibleClientWhere(
      input.user.id,
    );

  const firmId =
    clientAccess.membership
      .firmId ||
    input.profile.firmId;

  const search =
    ticker || query;

  if (!search) {
    return {
      query,
      ticker,
      total: 0,
      groups: [],
    };
  }

  const contains = (
    value: string,
  ) => ({
    contains: value,
    mode: "insensitive",
  });

  const [
    clients,
    personalTasks,
    firmTasks,
    alerts,
    opportunities,
    watchlistItems,
    researchNotes,
    approvals,
    reports,
    projects,
    knowledge,
  ] = await Promise.all([
    safe<any[]>([], () =>
      db.clientProfile.findMany(
        {
          where: {
            ...clientAccess.where,

            OR: [
              {
                fullName:
                  contains(
                    query ||
                      search,
                  ),
              },
              {
                householdName:
                  contains(
                    query ||
                      search,
                  ),
              },
              {
                objective:
                  contains(
                    query ||
                      search,
                  ),
              },
              {
                status:
                  contains(
                    query ||
                      search,
                  ),
              },

              ...(ticker
                ? [
                    {
                      holdings: {
                        some: {
                          symbol:
                            ticker,
                        },
                      },
                    },
                  ]
                : []),
            ],
          },

          select: {
            id: true,
            fullName: true,
            householdName: true,
            riskProfile: true,
            status: true,
            objective: true,

            holdings: {
              select: {
                symbol: true,
              },

              take: 20,
            },
          },

          take: 12,
        },
      ),
    ),

    safe<any[]>([], () =>
      db.meetingTask.findMany(
        {
          where: {
            userId:
              input.user.id,

            OR: [
              {
                title:
                  contains(
                    search,
                  ),
              },
              {
                description:
                  contains(
                    search,
                  ),
              },
              {
                priority:
                  contains(
                    search,
                  ),
              },
              {
                status:
                  contains(
                    search,
                  ),
              },
            ],
          },

          select: {
            id: true,
            title: true,
            description: true,
            priority: true,
            status: true,
            dueDate: true,
          },

          take: 12,
        },
      ),
    ),

    firmId
      ? safe<any[]>([], () =>
          db.firmAgendaTask.findMany(
            {
              where: {
                firmId,

                OR: [
                  {
                    title:
                      contains(
                        search,
                      ),
                  },
                  {
                    detail:
                      contains(
                        search,
                      ),
                  },
                  {
                    priority:
                      contains(
                        search,
                      ),
                  },
                  {
                    status:
                      contains(
                        search,
                      ),
                  },
                ],
              },

              select: {
                id: true,
                title: true,
                detail: true,
                priority: true,
                status: true,
                dueDate: true,
              },

              take: 12,
            },
          ),
        )
      : Promise.resolve([]),

    safe<any[]>([], () =>
      db.alertEvent.findMany({
        where: {
          userId: input.user.id,

          OR: [
            ...(ticker
              ? [
                  {
                    ticker,
                  },
                ]
              : []),

            {
              title:
                contains(
                  search,
                ),
            },
            {
              body:
                contains(
                  search,
                ),
            },
            {
              source:
                contains(
                  search,
                ),
            },
          ],
        },

        select: {
          id: true,
          title: true,
          source: true,
          ticker: true,
          score: true,
          urgency: true,
          status: true,
          sourceUrl: true,
        },

        orderBy: [
          {
            score: "desc",
          },
          {
            createdAt: "desc",
          },
        ],

        take: 12,
      }),
    ),

    safe<any[]>([], () =>
      db.opportunitySignal.findMany(
        {
          where: {
            userId:
              input.user.id,

            OR: [
              {
                title:
                  contains(
                    search,
                  ),
              },
              {
                summary:
                  contains(
                    search,
                  ),
              },
              {
                sourceName:
                  contains(
                    search,
                  ),
              },
              {
                tickersJson:
                  contains(
                    ticker ||
                      search,
                  ),
              },
            ],
          },

          select: {
            id: true,
            title: true,
            summary: true,
            sourceName: true,
            compositeScore: true,
            status: true,
            tickersJson: true,
          },

          orderBy: [
            {
              compositeScore:
                "desc",
            },
            {
              createdAt: "desc",
            },
          ],

          take: 12,
        },
      ),
    ),

    safe<any[]>([], () =>
      db.namedWatchlistItem.findMany(
        {
          where: {
            userId:
              input.user.id,

            OR: [
              ...(ticker
                ? [
                    {
                      symbol:
                        ticker,
                    },
                  ]
                : []),

              {
                assetName:
                  contains(
                    search,
                  ),
              },
              {
                thesis:
                  contains(
                    search,
                  ),
              },
              {
                sourceTitle:
                  contains(
                    search,
                  ),
              },
            ],
          },

          select: {
            id: true,
            symbol: true,
            assetName: true,
            priority: true,
            status: true,
            thesis: true,
            sourceUrl: true,
          },

          take: 12,
        },
      ),
    ),

    safe<any[]>([], () =>
      db.researchNote.findMany(
        {
          where: {
            userId:
              input.user.id,

            OR: [
              ...(ticker
                ? [
                    {
                      ticker,
                    },
                  ]
                : []),

              {
                title:
                  contains(
                    search,
                  ),
              },
              {
                thesis:
                  contains(
                    search,
                  ),
              },
              {
                risks:
                  contains(
                    search,
                  ),
              },
            ],
          },

          select: {
            id: true,
            ticker: true,
            title: true,
            thesis: true,
            risks: true,
            decision: true,
            conviction: true,
            sourceLinks: true,
          },

          take: 12,
        },
      ),
    ),

    safe<any[]>([], () =>
      db.backendApprovalItem.findMany(
        {
          where: {
            userId:
              input.user.id,

            OR: [
              {
                title:
                  contains(
                    search,
                  ),
              },
              {
                summary:
                  contains(
                    search,
                  ),
              },
              {
                actionType:
                  contains(
                    search,
                  ),
              },
            ],
          },

          select: {
            id: true,
            title: true,
            summary: true,
            actionType: true,
            riskLevel: true,
            status: true,
          },

          take: 12,
        },
      ),
    ),

    safe<any[]>([], () =>
      db.personalUserBotPdfReport.findMany(
        {
          where: {
            userId:
              input.user.id,

            OR: [
              {
                title:
                  contains(
                    search,
                  ),
              },
              {
                summary:
                  contains(
                    search,
                  ),
              },
              {
                reportType:
                  contains(
                    search,
                  ),
              },
            ],
          },

          select: {
            id: true,
            title: true,
            summary: true,
            reportType: true,
            status: true,
            downloadToken: true,
          },

          take: 12,
        },
      ),
    ),

    firmId
      ? safe<any[]>([], () =>
          db.firmProject.findMany({
            where: {
              firmId,

              OR: [
                {
                  title:
                    contains(
                      search,
                    ),
                },
                {
                  description:
                    contains(
                      search,
                    ),
                },
                {
                  status:
                    contains(
                      search,
                    ),
                },
                {
                  priority:
                    contains(
                      search,
                    ),
                },
              ],
            },

            select: {
              id: true,
              title: true,
              description: true,
              priority: true,
              status: true,
              dueDate: true,
            },

            take: 12,
          }),
        )
      : Promise.resolve([]),

    safe<any[]>([], () =>
      db.firmKnowledgeEntry.findMany(
        {
          where: {
            userId:
              input.user.id,

            OR: [
              {
                title:
                  contains(
                    search,
                  ),
              },
              {
                body:
                  contains(
                    search,
                  ),
              },
              {
                category:
                  contains(
                    search,
                  ),
              },
              {
                tagsJson:
                  contains(
                    search,
                  ),
              },
            ],
          },

          select: {
            id: true,
            title: true,
            category: true,
            body: true,
            sourceUrl: true,
            score: true,
          },

          orderBy: [
            {
              score: "desc",
            },
            {
              updatedAt: "desc",
            },
          ],

          take: 12,
        },
      ),
    ),
  ]);

  const groups: SlicePlatformSearchGroup[] =
    [
      {
        label: "Clients",
        route:
          "/workspace/clients",

        items: clients.map(
          (item) => ({
            id: item.id,
            title:
              item.fullName,

            detail:
              `${
                item.householdName ||
                "No household"
              } · ${
                item.riskProfile
              } · ${
                item.status
              } · Holdings: ${
                (
                  item.holdings ??
                  []
                )
                  .map(
                    (
                      holding: any,
                    ) =>
                      holding.symbol,
                  )
                  .join(", ") ||
                "None"
              }`,

            status:
              item.status,
          }),
        ),
      },

      {
        label:
          "Personal Tasks",

        route:
          "/workspace/team-board",

        items:
          personalTasks.map(
            (item) => ({
              id: item.id,
              title:
                item.title,
              detail:
                sanitizePublicText(
                  item.description,
                  500,
                ),
              status:
                item.status,
            }),
          ),
      },

      {
        label: "Firm Tasks",

        route:
          "/workspace/team-board",

        items:
          firmTasks.map(
            (item) => ({
              id: item.id,
              title:
                item.title,
              detail:
                sanitizePublicText(
                  item.detail,
                  500,
                ),
              status:
                item.status,
            }),
          ),
      },

      {
        label: "Alerts",
        route: "/triage",

        items: alerts.map(
          (item) => ({
            id: item.id,
            title:
              item.title,

            detail:
              `${item.source} · ${item.urgency} · Score ${item.score}`,

            score:
              item.score,

            status:
              item.status,

            ticker:
              item.ticker,

            sourceUrl:
              item.sourceUrl,
          }),
        ),
      },

      {
        label: "Opportunities",

        route:
          "/opportunity-radar",

        items:
          opportunities.map(
            (item) => ({
              id: item.id,
              title:
                item.title,

              detail:
                sanitizePublicText(
                  item.summary,
                  500,
                ),

              score:
                item.compositeScore,

              status:
                item.status,

              ticker:
                parseJson<
                  string[]
                >(
                  item.tickersJson,
                  [],
                )[0] ??
                null,
            }),
          ),
      },

      {
        label: "Watchlists",

        route:
          "/watchlist-alerts",

        items:
          watchlistItems.map(
            (item) => ({
              id: item.id,

              title:
                `${item.symbol} · ${item.assetName}`,

              detail:
                sanitizePublicText(
                  item.thesis,
                  500,
                ),

              status:
                item.status,

              ticker:
                item.symbol,

              sourceUrl:
                item.sourceUrl,
            }),
          ),
      },

      {
        label:
          "Research Notes",

        route:
          "/advisor-command-center",

        items:
          researchNotes.map(
            (item) => ({
              id: item.id,
              title:
                item.title,

              detail:
                `${sanitizePublicText(
                  item.thesis,
                  500,
                )}${
                  item.risks
                    ? ` Risks: ${sanitizePublicText(
                        item.risks,
                        250,
                      )}`
                    : ""
                }`,

              status:
                item.decision,

              ticker:
                item.ticker,

              sourceUrl:
                String(
                  item.sourceLinks ??
                    "",
                )
                  .split(
                    /\r?\n/,
                  )
                  .map(
                    (value) =>
                      value.trim(),
                  )
                  .find(
                    Boolean,
                  ) ??
                null,
            }),
          ),
      },

      {
        label: "Approvals",

        route:
          "/backend-readiness",

        items:
          approvals.map(
            (item) => ({
              id: item.id,
              title:
                item.title,

              detail:
                `${item.actionType} · ${item.riskLevel} · ${sanitizePublicText(
                  item.summary,
                  450,
                )}`,

              status:
                item.status,
            }),
          ),
      },

      {
        label: "AI Reports",

        route:
          "/workspace/personal-bot/reports",

        items: reports.map(
          (item) => ({
            id: item.id,
            title:
              item.title,

            detail:
              sanitizePublicText(
                item.summary,
                500,
              ),

            status:
              item.status,

            sourceUrl:
              `/workspace/personal-bot/reports?token=${item.downloadToken}`,
          }),
        ),
      },

      {
        label:
          "Firm Projects",

        route:
          "/workspace/team-board",

        items:
          projects.map(
            (item) => ({
              id: item.id,
              title:
                item.title,

              detail:
                sanitizePublicText(
                  item.description,
                  500,
                ),

              status:
                item.status,
            }),
          ),
      },

      {
        label:
          "Firm Knowledge",

        route:
          "/advisor-command-center",

        items:
          knowledge.map(
            (item) => ({
              id: item.id,
              title:
                item.title,

              detail:
                `${item.category} · ${sanitizePublicText(
                  item.body,
                  500,
                )}`,

              score:
                item.score,

              sourceUrl:
                item.sourceUrl,
            }),
          ),
      },
    ].filter(
      (group) =>
        group.items.length > 0,
    );

  return {
    query,
    ticker,

    total: groups.reduce(
      (sum, group) =>
        sum +
        group.items.length,
      0,
    ),

    groups,
  };
}