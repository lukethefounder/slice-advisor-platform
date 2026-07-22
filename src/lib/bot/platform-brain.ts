import { prisma } from "@/lib/prisma";

export type PlatformBrainRoute = {
  itemKey: string;
  label: string;
  route: string;
  category: string;
  aliases: string[];
  capabilities: string[];
  examplePrompts: string[];
};

const platformBrainEnsureCache =
  new Map<
    string,
    number
  >();

function asJson(
  value: unknown,
) {
  return JSON.stringify(
    value,
  );
}

function parseJson<T>(
  value:
    | string
    | null
    | undefined,
  fallback: T,
): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(
      value,
    ) as T;
  } catch {
    return fallback;
  }
}

export function normalizeBotPhrase(
  value: string,
) {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9#\s$.-]/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

export function phraseKey(
  value: string,
) {
  return (
    normalizeBotPhrase(
      value,
    )
      .replace(
        /[^a-z0-9]+/g,
        "-",
      )
      .slice(0, 90) ||
    `phrase-${Date.now()}`
  );
}

export const PLATFORM_BRAIN_ROUTES: PlatformBrainRoute[] =
  [
    {
      itemKey:
        "workspace",

      label:
        "Workspace",

      route:
        "/workspace",

      category:
        "Home",

      aliases: [
        "home",
        "main dashboard",
        "main workspace",
        "home screen",
        "investment os",
      ],

      capabilities: [
        "central dashboard",
        "firm navigation",
        "status overview",
        "workspace search",
      ],

      examplePrompts: [
        "open workspace",
        "go home",
        "show main dashboard",
      ],
    },

    {
      itemKey:
        "custom-board",

      label:
        "Custom Board",

      route:
        "/workspace/custom-board",

      category:
        "Markets",

      aliases: [
        "custom board",
        "security analysis",
        "market board",
        "advisor market board",
      ],

      capabilities: [
        "security analysis",
        "symbols",
        "metrics",
        "advisor market review",
      ],

      examplePrompts: [
        "open custom board",
        "show security analysis",
        "open market board",
      ],
    },

    {
      itemKey:
        "workspace-watchlists",

      label:
        "Workspace Watchlists",

      route:
        "/workspace/watchlists",

      category:
        "Markets",

      aliases: [
        "watchlists",
        "watch list",
        "tracked assets",
        "tracked stocks",
        "monitoring rules",
      ],

      capabilities: [
        "watchlist rules",
        "constraints",
        "thresholds",
        "advisor notes",
      ],

      examplePrompts: [
        "open watchlists",
        "show tracked assets",
        "review monitoring rules",
      ],
    },

    {
      itemKey:
        "market-visuals",

      label:
        "Market Visuals",

      route:
        "/market-visuals",

      category:
        "Markets",

      aliases: [
        "charts",
        "graphs",
        "market charts",
        "visuals",
        "trading view",
        "technical charts",
      ],

      capabilities: [
        "price chart",
        "RSI",
        "MACD",
        "VWAP",
        "Bollinger bands",
        "forecast",
      ],

      examplePrompts: [
        "open market visuals",
        "show NVDA chart",
        "take me to graphs",
      ],
    },

    {
      itemKey:
        "workspace-intelligence",

      label:
        "Workspace Intelligence",

      route:
        "/workspace/intelligence",

      category:
        "Intelligence",

      aliases: [
        "intelligence",
        "technical scan",
        "news scan",
        "article monitor",
        "signal scanner",
      ],

      capabilities: [
        "technical scanning",
        "news monitoring",
        "article review",
        "watchlist intelligence",
      ],

      examplePrompts: [
        "open intelligence",
        "show technical scan",
        "review news monitor",
      ],
    },

    {
      itemKey:
        "triage",

      label:
        "Intelligence Triage",

      route:
        "/triage",

      category:
        "Intelligence",

      aliases: [
        "triage",
        "trage",
        "news triage",
        "headline triage",
        "scan results",
      ],

      capabilities: [
        "news review",
        "retained headlines",
        "source scoring",
        "materiality review",
      ],

      examplePrompts: [
        "open triage",
        "show headline triage",
        "review news",
      ],
    },

    {
      itemKey:
        "opportunity-radar",

      label:
        "Opportunity Radar",

      route:
        "/opportunity-radar",

      category:
        "Intelligence",

      aliases: [
        "radar",
        "opportunities",
        "opportunity signals",
        "investment signals",
      ],

      capabilities: [
        "opportunity ranking",
        "risk scoring",
        "source evidence",
        "suggested actions",
      ],

      examplePrompts: [
        "open radar",
        "sort opportunities",
        "show best signals",
      ],
    },

    {
      itemKey:
        "client-portal-inbox",

      label:
        "Client Portal Inbox",

      route:
        "/workspace/client-portal-inbox",

      category:
        "Clients",

      aliases: [
        "client portal",
        "portal inbox",
        "client messages",
        "client requests",
        "portal updates",
      ],

      capabilities: [
        "client messages",
        "requests",
        "documents",
        "permission changes",
        "account updates",
      ],

      examplePrompts: [
        "open client portal inbox",
        "show client messages",
        "review portal requests",
      ],
    },

    {
      itemKey:
        "client-profiles",

      label:
        "Client Profiles",

      route:
        "/workspace/clients",

      category:
        "Clients",

      aliases: [
        "clients",
        "client profiles",
        "client book",
        "households",
        "investors",
        "crm",
      ],

      capabilities: [
        "client profiles",
        "households",
        "risk preferences",
        "notes",
        "objectives",
        "holdings",
      ],

      examplePrompts: [
        "open client profiles",
        "show clients",
        "review client records",
      ],
    },

    {
      itemKey:
        "client-email-center",

      label:
        "Client Email Center",

      route:
        "/workspace/client-emails",

      category:
        "Communications",

      aliases: [
        "email center",
        "client emails",
        "draft email",
        "advisor email",
        "communications",
      ],

      capabilities: [
        "AI email drafts",
        "advisor review",
        "approval queue",
        "client communication",
      ],

      examplePrompts: [
        "open email center",
        "draft client email",
        "show email drafts",
      ],
    },

    {
      itemKey:
        "client-briefings",

      label:
        "Client Briefings",

      route:
        "/workspace/client-briefings",

      category:
        "Reports",

      aliases: [
        "client briefings",
        "client briefing",
        "client updates",
        "household briefing",
      ],

      capabilities: [
        "client briefing",
        "market summary",
        "portfolio summary",
        "action items",
      ],

      examplePrompts: [
        "open client briefings",
        "create client briefing",
        "show household updates",
      ],
    },

    {
      itemKey:
        "personal-bot",

      label:
        "AI Studio",

      route:
        "/workspace/personal-bot",

      category:
        "AI",

      aliases: [
        "bot",
        "robot",
        "assistant",
        "voice bot",
        "my ai",
        "ai studio",
        "command studio",
      ],

      capabilities: [
        "voice command",
        "financial research",
        "memory",
        "platform actions",
        "reports",
      ],

      examplePrompts: [
        "open ai studio",
        "show the robot",
        "ask slice ai",
      ],
    },

    {
      itemKey:
        "personal-bot-reports",

      label:
        "AI Report Library",

      route:
        "/workspace/personal-bot/reports",

      category:
        "Reports",

      aliases: [
        "ai reports",
        "report library",
        "pdf reports",
        "browser reports",
      ],

      capabilities: [
        "report review",
        "browser reports",
        "secure PDF",
        "source provenance",
      ],

      examplePrompts: [
        "open ai reports",
        "show report library",
        "open latest pdf report",
      ],
    },

    {
      itemKey:
        "team-board",

      label:
        "Team Board",

      route:
        "/workspace/team-board",

      category:
        "Team",

      aliases: [
        "team",
        "team board",
        "projects",
        "task board",
        "calendar",
        "my work",
        "team docs",
      ],

      capabilities: [
        "delegation",
        "tasks",
        "calendar",
        "brainstorm",
        "shared workspace",
        "documents",
      ],

      examplePrompts: [
        "open team board",
        "show team tasks",
        "open team calendar",
      ],
    },

    {
      itemKey:
        "firm-command-center",

      label:
        "Firm Command Center",

      route:
        "/workspace/firm-command-center",

      category:
        "Firm",

      aliases: [
        "firm command center",
        "firm center",
        "firm operations",
        "management center",
      ],

      capabilities: [
        "firm oversight",
        "project management",
        "team operations",
        "management metrics",
      ],

      examplePrompts: [
        "open firm command center",
        "show firm operations",
        "summarize firm activity",
      ],
    },

    {
      itemKey:
        "workspace-settings",

      label:
        "Workspace Settings",

      route:
        "/workspace/settings",

      category:
        "Settings",

      aliases: [
        "settings",
        "enhanced settings",
        "workspace settings",
        "preferences",
        "notifications",
        "appearance",
      ],

      capabilities: [
        "appearance",
        "privacy",
        "notifications",
        "advisor profile",
        "scheduling",
      ],

      examplePrompts: [
        "open settings",
        "show preferences",
        "open notification settings",
      ],
    },

    {
      itemKey:
        "advisor-command-center",

      label:
        "Advisor Command Center",

      route:
        "/advisor-command-center",

      category:
        "Advisor OS",

      aliases: [
        "advisor command",
        "client brain",
        "next best action",
        "ask the firm",
        "advisor center",
      ],

      capabilities: [
        "client brain",
        "next best action",
        "proof trail",
        "firm search",
      ],

      examplePrompts: [
        "open advisor command",
        "show client brain",
        "what should I do next",
      ],
    },

    {
      itemKey:
        "portfolio-lab",

      label:
        "Portfolio Lab",

      route:
        "/portfolio-lab",

      category:
        "Portfolio",

      aliases: [
        "portfolio",
        "holdings",
        "allocation",
        "models",
        "portfolio analysis",
      ],

      capabilities: [
        "allocation",
        "holdings",
        "portfolio impact",
        "models",
        "scenario analysis",
      ],

      examplePrompts: [
        "open portfolio lab",
        "show holdings",
        "analyze portfolio",
      ],
    },

    {
      itemKey:
        "venture-monitor",

      label:
        "Venture Monitor",

      route:
        "/alternative-investments?view=venture",

      category:
        "Alternatives",

      aliases: [
        "ventures",
        "alternative ventures",
        "startup monitor",
        "startups",
        "venture tab",
      ],

      capabilities: [
        "startup tracking",
        "founder details",
        "valuation",
        "equity offered",
      ],

      examplePrompts: [
        "open venture monitor",
        "show alternative ventures",
        "review startups",
      ],
    },

    {
      itemKey:
        "penny-stocks",

      label:
        "Penny Stocks",

      route:
        "/alternative-investments?view=penny-stocks",

      category:
        "Alternatives",

      aliases: [
        "penny stock",
        "speculative equities",
        "microcap",
        "small speculative stocks",
      ],

      capabilities: [
        "speculative ticker tracking",
        "risk notes",
        "catalysts",
      ],

      examplePrompts: [
        "open penny stocks",
        "review speculative equities",
      ],
    },

    {
      itemKey:
        "crypto-markets",

      label:
        "Crypto Markets",

      route:
        "/alternative-investments?view=crypto",

      category:
        "Alternatives",

      aliases: [
        "crypto",
        "bitcoin",
        "digital assets",
        "crypto tab",
      ],

      capabilities: [
        "crypto markets",
        "sentiment",
        "volatility",
      ],

      examplePrompts: [
        "open crypto",
        "show bitcoin",
        "review digital assets",
      ],
    },

    {
      itemKey:
        "watchlist-alerts",

      label:
        "Watchlist Alerts",

      route:
        "/watchlist-alerts",

      category:
        "Notifications",

      aliases: [
        "price alerts",
        "stock alerts",
        "watchlist triggers",
        "high low alerts",
      ],

      capabilities: [
        "high price alerts",
        "low price alerts",
        "market data checks",
        "dashboard notifications",
      ],

      examplePrompts: [
        "open price alerts",
        "create NVDA alert above 1000",
        "show stock alerts",
      ],
    },

    {
      itemKey:
        "backend-kernel",

      label:
        "Backend Kernel",

      route:
        "/backend-kernel",

      category:
        "Backend",

      aliases: [
        "kernel",
        "backend",
        "vendors",
        "jobs",
        "provider status",
        "integration status",
      ],

      capabilities: [
        "vendor registry",
        "jobs",
        "delivery queue",
        "feature flags",
        "data quality",
      ],

      examplePrompts: [
        "open backend kernel",
        "run vendor health",
        "process delivery queue",
      ],
    },

    {
      itemKey:
        "backend-readiness",

      label:
        "Backend Readiness",

      route:
        "/backend-readiness",

      category:
        "Backend",

      aliases: [
        "readiness",
        "system health",
        "approval center",
        "tenant checks",
      ],

      capabilities: [
        "health checks",
        "approvals",
        "role policies",
        "tenant isolation",
      ],

      examplePrompts: [
        "open backend readiness",
        "check system health",
        "show approvals",
      ],
    },

    {
      itemKey:
        "briefings",

      label:
        "Briefings",

      route:
        "/briefings",

      category:
        "Reports",

      aliases: [
        "reports",
        "briefing reports",
        "client reports",
        "advisor reports",
      ],

      capabilities: [
        "report generation",
        "daily brief",
        "client-ready summaries",
      ],

      examplePrompts: [
        "open briefings",
        "create report",
        "show advisor reports",
      ],
    },

    {
      itemKey:
        "security",

      label:
        "Security Center",

      route:
        "/security",

      category:
        "Governance",

      aliases: [
        "audit",
        "governance",
        "compliance",
        "security center",
        "security",
      ],

      capabilities: [
        "audit logs",
        "disclosures",
        "security controls",
        "compliance review",
      ],

      examplePrompts: [
        "open security",
        "show audit",
        "review compliance",
      ],
    },

    {
      itemKey:
        "compliance-center",

      label:
        "Compliance Center",

      route:
        "/security?panel=compliance",

      category:
        "Governance",

      aliases: [
        "compliance center",
        "review gates",
        "sensitive workflow review",
        "advisor guardrails",
      ],

      capabilities: [
        "review gates",
        "records",
        "advisor guardrails",
        "sensitive workflow approval",
      ],

      examplePrompts: [
        "open compliance center",
        "show review gates",
        "review compliance items",
      ],
    },
  ];

export async function ensurePlatformBrain(
  userId: string,
  firmId: string | null,
) {
  const cacheKey =
    `${userId}:${firmId ?? "personal"}`;

  const cachedUntil =
    platformBrainEnsureCache.get(
      cacheKey,
    ) ?? 0;

  if (
    cachedUntil >
    Date.now()
  ) {
    return;
  }

  const operations =
    PLATFORM_BRAIN_ROUTES.map(
      (item) =>
        prisma.personalUserBotPlatformMapItem.upsert(
          {
            where: {
              userId_itemKey: {
                userId,
                itemKey:
                  item.itemKey,
              },
            },

            update: {
              firmId,
              label:
                item.label,
              route:
                item.route,
              category:
                item.category,

              aliasesJson:
                asJson(
                  item.aliases,
                ),

              capabilitiesJson:
                asJson(
                  item.capabilities,
                ),

              examplePromptsJson:
                asJson(
                  item.examplePrompts,
                ),

              confidenceScore:
                98,

              lastVerifiedAt:
                new Date(),

              status:
                "Active",
            },

            create: {
              userId,
              firmId,

              itemKey:
                item.itemKey,

              label:
                item.label,

              route:
                item.route,

              category:
                item.category,

              aliasesJson:
                asJson(
                  item.aliases,
                ),

              capabilitiesJson:
                asJson(
                  item.capabilities,
                ),

              examplePromptsJson:
                asJson(
                  item.examplePrompts,
                ),

              confidenceScore:
                98,

              lastVerifiedAt:
                new Date(),

              status:
                "Active",
            },
          },
        ),
    );

  await prisma.$transaction(
    operations,
  );

  platformBrainEnsureCache.set(
    cacheKey,
    Date.now() +
      10 * 60 * 1000,
  );

  if (
    platformBrainEnsureCache.size >
    500
  ) {
    const now =
      Date.now();

    for (
      const [
        key,
        expiresAt,
      ] of platformBrainEnsureCache.entries()
    ) {
      if (
        expiresAt <= now
      ) {
        platformBrainEnsureCache.delete(
          key,
        );
      }
    }
  }
}

export async function getPlatformBrainContext(
  userId: string,
) {
  const [
    mapItems,
    trainingPhrases,
    corrections,
  ] = await Promise.all([
    prisma.personalUserBotPlatformMapItem.findMany(
      {
        where: {
          userId,
          status:
            "Active",
        },

        orderBy: [
          {
            category:
              "asc",
          },
          {
            label: "asc",
          },
        ],

        take: 150,
      },
    ),

    prisma.personalUserBotTrainingPhrase.findMany(
      {
        where: {
          userId,
          status:
            "Active",
        },

        orderBy: [
          {
            successCount:
              "desc",
          },
          {
            usageCount:
              "desc",
          },
          {
            updatedAt:
              "desc",
          },
        ],

        take: 100,
      },
    ),

    prisma.personalUserBotCommandCorrection.findMany(
      {
        where: {
          userId,
          status:
            "Active",
        },

        orderBy: {
          updatedAt:
            "desc",
        },

        take: 80,
      },
    ),
  ]);

  return {
    routes:
      mapItems.map(
        (item) => ({
          label:
            item.label,

          route:
            item.route,

          category:
            item.category,

          aliases:
            parseJson<
              string[]
            >(
              item.aliasesJson,
              [],
            ),

          capabilities:
            parseJson<
              string[]
            >(
              item.capabilitiesJson,
              [],
            ),

          examples:
            parseJson<
              string[]
            >(
              item.examplePromptsJson,
              [],
            ),
        }),
      ),

    learnedPhrases:
      trainingPhrases.map(
        (item) => ({
          phrase:
            item.phrase,

          targetIntent:
            item.targetIntent,

          targetRoute:
            item.targetRoute,

          usageCount:
            item.usageCount,

          successCount:
            item.successCount,

          parameters:
            parseJson<
              Record<
                string,
                unknown
              >
            >(
              item.parametersJson,
              {},
            ),
        }),
      ),

    corrections:
      corrections.map(
        (item) => ({
          originalCommand:
            item.originalCommand,

          interpretedIntent:
            item.interpretedIntent,

          correctedIntent:
            item.correctedIntent,

          correctedRoute:
            item.correctedRoute,

          notes:
            item.correctionNotes,

          parameters:
            parseJson<
              Record<
                string,
                unknown
              >
            >(
              item.correctedParametersJson,
              {},
            ),
        }),
      ),
  };
}

export async function recordTrainingPhrase(
  input: {
    userId: string;
    profileId?:
      | string
      | null;
    firmId?:
      | string
      | null;
    phrase: string;
    targetIntent: string;
    targetRoute?:
      | string
      | null;
    parameters?: Record<
      string,
      unknown
    >;
  },
) {
  const normalizedPhrase =
    normalizeBotPhrase(
      input.phrase,
    );

  const key =
    phraseKey(
      `${input.targetIntent}-${input.targetRoute ?? "none"}-${normalizedPhrase}`,
    );

  return prisma.personalUserBotTrainingPhrase.upsert(
    {
      where: {
        userId_phraseKey: {
          userId:
            input.userId,

          phraseKey:
            key,
        },
      },

      update: {
        profileId:
          input.profileId,

        firmId:
          input.firmId,

        phrase:
          input.phrase,

        normalizedPhrase,

        targetIntent:
          input.targetIntent,

        targetRoute:
          input.targetRoute,

        parametersJson:
          asJson(
            input.parameters ??
            {},
          ),

        usageCount: {
          increment: 1,
        },

        lastUsedAt:
          new Date(),

        status: "Active",
      },

      create: {
        userId:
          input.userId,

        profileId:
          input.profileId,

        firmId:
          input.firmId,

        phraseKey:
          key,

        phrase:
          input.phrase,

        normalizedPhrase,

        targetIntent:
          input.targetIntent,

        targetRoute:
          input.targetRoute,

        parametersJson:
          asJson(
            input.parameters ??
            {},
          ),

        usageCount: 1,

        successCount: 0,

        lastUsedAt:
          new Date(),

        status: "Active",
      },
    },
  );
}

export async function recordCommandCorrection(
  input: {
    userId: string;
    profileId?:
      | string
      | null;
    firmId?:
      | string
      | null;
    originalCommand: string;
    interpretedIntent?:
      | string
      | null;
    correctedIntent: string;
    correctedRoute?:
      | string
      | null;
    correctionNotes?:
      | string
      | null;
    parameters?: Record<
      string,
      unknown
    >;
  },
) {
  await recordTrainingPhrase(
    {
      userId:
        input.userId,

      profileId:
        input.profileId,

      firmId:
        input.firmId,

      phrase:
        input.originalCommand,

      targetIntent:
        input.correctedIntent,

      targetRoute:
        input.correctedRoute,

      parameters:
        input.parameters,
    },
  );

  return prisma.personalUserBotCommandCorrection.create(
    {
      data: {
        userId:
          input.userId,

        profileId:
          input.profileId,

        firmId:
          input.firmId,

        originalCommand:
          input.originalCommand,

        interpretedIntent:
          input.interpretedIntent,

        correctedIntent:
          input.correctedIntent,

        correctedRoute:
          input.correctedRoute,

        correctionNotes:
          input.correctionNotes,

        correctedParametersJson:
          asJson(
            input.parameters ??
            {},
          ),

        status:
          "Active",
      },
    },
  );
}

export async function startVoiceSession(
  input: {
    userId: string;
    profileId?:
      | string
      | null;
    firmId?:
      | string
      | null;
    language?: string;
  },
) {
  const sessionKey =
    `voice-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2, 9)}`;

  return prisma.personalUserBotVoiceSession.create(
    {
      data: {
        userId:
          input.userId,

        profileId:
          input.profileId,

        firmId:
          input.firmId,

        sessionKey,

        language:
          input.language ??
          "en-US",

        status:
          "Listening",

        transcript: "",

        metadataJson:
          asJson({
            source:
              "slice-voice-ops",

            unifiedRouter:
              true,

            lowLatencyCommandPath:
              true,
          }),
      },
    },
  );
}

export async function updateVoiceSession(
  input: {
    userId: string;
    sessionKey: string;
    transcript: string;
    finalTranscript?:
      | string
      | null;
    status?: string;
    confidenceScore?: number;
    commandId?:
      | string
      | null;
  },
) {
  const finalStatus =
    input.status ??
    "Listening";

  const ended = [
    "Complete",
    "Failed",
    "Recovered",
    "Transcribed",
  ].includes(finalStatus);

  return prisma.personalUserBotVoiceSession.updateMany(
    {
      where: {
        userId:
          input.userId,

        sessionKey:
          input.sessionKey,
      },

      data: {
        transcript:
          input.transcript,

        finalTranscript:
          input.finalTranscript,

        status:
          finalStatus,

        confidenceScore:
          input.confidenceScore ??
          undefined,

        commandId:
          input.commandId,

        endedAt: ended
          ? new Date()
          : undefined,
      },
    },
  );
}