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

export function normalizeBotPhrase(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9#\s$.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function phraseKey(value: string) {
  return normalizeBotPhrase(value).replace(/[^a-z0-9]+/g, "-").slice(0, 90) || `phrase-${Date.now()}`;
}

export const PLATFORM_BRAIN_ROUTES: PlatformBrainRoute[] = [
  {
    itemKey: "workspace",
    label: "Workspace",
    route: "/workspace",
    category: "Home",
    aliases: ["home", "main dashboard", "main workspace", "home screen", "investment os"],
    capabilities: ["central dashboard", "firm navigation", "status overview"],
    examplePrompts: ["open workspace", "go home", "show main dashboard"],
  },
  {
    itemKey: "command-layer",
    label: "Command Layer",
    route: "/workspace?tab=command",
    category: "Backend",
    aliases: ["command", "backend controls", "live systems", "integration controls"],
    capabilities: ["run backend jobs", "bootstrap kernel", "view live systems"],
    examplePrompts: ["open command layer", "show backend controls", "run backend"],
  },
  {
    itemKey: "personal-bot",
    label: "Personal Bot",
    route: "/workspace/personal-bot",
    category: "AI",
    aliases: ["bot", "robot", "assistant", "voice bot", "my ai"],
    capabilities: ["voice command", "research", "memory", "actions", "reports"],
    examplePrompts: ["open my bot", "show the robot", "ask slice ai"],
  },
  {
    itemKey: "market-visuals",
    label: "Market Visuals",
    route: "/market-visuals",
    category: "Markets",
    aliases: ["charts", "graphs", "market charts", "visuals", "trading view", "technical charts"],
    capabilities: ["price chart", "RSI", "MACD", "VWAP", "Bollinger bands", "forecast"],
    examplePrompts: ["open market visuals", "show NVDA chart", "take me to graphs"],
  },
  {
    itemKey: "watchlist-alerts",
    label: "Watchlist Alerts",
    route: "/watchlist-alerts",
    category: "Notifications",
    aliases: ["price alerts", "stock alerts", "watchlist triggers", "high low alerts"],
    capabilities: ["high price alerts", "low price alerts", "dashboard notifications"],
    examplePrompts: ["open price alerts", "create NVDA alert above 1000", "show stock alerts"],
  },
  {
    itemKey: "advisor-command-center",
    label: "Advisor Command Center",
    route: "/advisor-command-center",
    category: "Advisor OS",
    aliases: ["advisor command", "client brain", "next best action", "ask the firm"],
    capabilities: ["client brain", "next best action", "proof trail", "firm search"],
    examplePrompts: ["open advisor command", "show client brain", "what should I do next"],
  },
  {
    itemKey: "triage",
    label: "Triage",
    route: "/triage",
    category: "Intelligence",
    aliases: ["trage", "news triage", "headline triage", "scan results"],
    capabilities: ["news review", "retained headlines", "source scoring"],
    examplePrompts: ["open triage", "show trage", "review news"],
  },
  {
    itemKey: "opportunity-radar",
    label: "Opportunity Radar",
    route: "/opportunity-radar",
    category: "Intelligence",
    aliases: ["radar", "opportunities", "opportunity signals", "investment signals"],
    capabilities: ["opportunity ranking", "risk scoring", "source evidence"],
    examplePrompts: ["open radar", "sort opportunities", "show best signals"],
  },
  {
    itemKey: "portfolio-lab",
    label: "Portfolio Lab",
    route: "/portfolio-lab",
    category: "Portfolio",
    aliases: ["portfolio", "holdings", "allocation", "models", "portfolio analysis"],
    capabilities: ["allocation", "holdings", "portfolio impact", "models"],
    examplePrompts: ["open portfolio lab", "show holdings", "analyze portfolio"],
  },
  {
    itemKey: "venture-monitor",
    label: "Venture Monitor",
    route: "/alternative-investments?view=venture",
    category: "Alternatives",
    aliases: ["ventures", "alternative ventures", "startup monitor", "startups", "venture tab"],
    capabilities: ["startup tracking", "founder details", "valuation", "equity offered"],
    examplePrompts: ["open venture monitor", "show alternative ventures", "review startups"],
  },
  {
    itemKey: "penny-stocks",
    label: "Penny Stocks",
    route: "/alternative-investments?view=penny-stocks",
    category: "Alternatives",
    aliases: ["penny stock", "speculative equities", "microcap", "small speculative stocks"],
    capabilities: ["speculative ticker tracking", "risk notes", "catalysts"],
    examplePrompts: ["open penny stocks", "review speculative equities"],
  },
  {
    itemKey: "crypto-markets",
    label: "Crypto Markets",
    route: "/alternative-investments?view=crypto",
    category: "Alternatives",
    aliases: ["crypto", "bitcoin", "digital assets", "crypto tab"],
    capabilities: ["crypto markets", "sentiment", "volatility"],
    examplePrompts: ["open crypto", "show bitcoin", "review digital assets"],
  },
  {
    itemKey: "backend-kernel",
    label: "Backend Kernel",
    route: "/backend-kernel",
    category: "Backend",
    aliases: ["kernel", "backend", "vendors", "jobs", "provider status", "integration status"],
    capabilities: ["vendor registry", "jobs", "delivery queue", "feature flags", "data quality"],
    examplePrompts: ["open backend kernel", "run vendor health", "process delivery queue"],
  },
  {
    itemKey: "backend-readiness",
    label: "Backend Readiness",
    route: "/backend-readiness",
    category: "Backend",
    aliases: ["readiness", "system health", "approval center", "tenant checks"],
    capabilities: ["health checks", "approvals", "role policies", "tenant isolation"],
    examplePrompts: ["open backend readiness", "check system health", "show approvals"],
  },
  {
    itemKey: "briefings",
    label: "Briefings",
    route: "/briefings",
    category: "Reports",
    aliases: ["reports", "briefing reports", "client reports", "advisor reports"],
    capabilities: ["report generation", "daily brief", "client-ready summaries"],
    examplePrompts: ["open briefings", "create report", "show advisor reports"],
  },
  {
    itemKey: "security",
    label: "Security",
    route: "/security",
    category: "Governance",
    aliases: ["audit", "governance", "compliance", "security center"],
    capabilities: ["audit logs", "disclosures", "security controls"],
    examplePrompts: ["open security", "show audit", "review compliance"],
  },
];

export async function ensurePlatformBrain(userId: string, firmId: string | null) {
  for (const item of PLATFORM_BRAIN_ROUTES) {
    await prisma.personalUserBotPlatformMapItem.upsert({
      where: {
        userId_itemKey: {
          userId,
          itemKey: item.itemKey,
        },
      },
      update: {
        firmId,
        label: item.label,
        route: item.route,
        category: item.category,
        aliasesJson: asJson(item.aliases),
        capabilitiesJson: asJson(item.capabilities),
        examplePromptsJson: asJson(item.examplePrompts),
        confidenceScore: 95,
        lastVerifiedAt: new Date(),
        status: "Active",
      },
      create: {
        userId,
        firmId,
        itemKey: item.itemKey,
        label: item.label,
        route: item.route,
        category: item.category,
        aliasesJson: asJson(item.aliases),
        capabilitiesJson: asJson(item.capabilities),
        examplePromptsJson: asJson(item.examplePrompts),
        confidenceScore: 95,
        lastVerifiedAt: new Date(),
        status: "Active",
      },
    });
  }
}

export async function getPlatformBrainContext(userId: string) {
  const [mapItems, trainingPhrases, corrections] = await Promise.all([
    prisma.personalUserBotPlatformMapItem.findMany({
      where: {
        userId,
        status: "Active",
      },
      orderBy: [{ category: "asc" }, { label: "asc" }],
      take: 100,
    }),
    prisma.personalUserBotTrainingPhrase.findMany({
      where: {
        userId,
        status: "Active",
      },
      orderBy: [{ successCount: "desc" }, { usageCount: "desc" }, { updatedAt: "desc" }],
      take: 60,
    }),
    prisma.personalUserBotCommandCorrection.findMany({
      where: {
        userId,
        status: "Active",
      },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
  ]);

  return {
    routes: mapItems.map((item) => ({
      label: item.label,
      route: item.route,
      category: item.category,
      aliases: parseJson<string[]>(item.aliasesJson, []),
      capabilities: parseJson<string[]>(item.capabilitiesJson, []),
      examples: parseJson<string[]>(item.examplePromptsJson, []),
    })),
    learnedPhrases: trainingPhrases.map((item) => ({
      phrase: item.phrase,
      targetIntent: item.targetIntent,
      targetRoute: item.targetRoute,
      usageCount: item.usageCount,
      successCount: item.successCount,
      parameters: parseJson<Record<string, unknown>>(item.parametersJson, {}),
    })),
    corrections: corrections.map((item) => ({
      originalCommand: item.originalCommand,
      interpretedIntent: item.interpretedIntent,
      correctedIntent: item.correctedIntent,
      correctedRoute: item.correctedRoute,
      notes: item.correctionNotes,
      parameters: parseJson<Record<string, unknown>>(item.correctedParametersJson, {}),
    })),
  };
}

export async function recordTrainingPhrase(input: {
  userId: string;
  profileId?: string | null;
  firmId?: string | null;
  phrase: string;
  targetIntent: string;
  targetRoute?: string | null;
  parameters?: Record<string, unknown>;
}) {
  const normalizedPhrase = normalizeBotPhrase(input.phrase);
  const key = phraseKey(`${input.targetIntent}-${input.targetRoute ?? "none"}-${normalizedPhrase}`);

  return prisma.personalUserBotTrainingPhrase.upsert({
    where: {
      userId_phraseKey: {
        userId: input.userId,
        phraseKey: key,
      },
    },
    update: {
      profileId: input.profileId,
      firmId: input.firmId,
      phrase: input.phrase,
      normalizedPhrase,
      targetIntent: input.targetIntent,
      targetRoute: input.targetRoute,
      parametersJson: asJson(input.parameters ?? {}),
      usageCount: { increment: 1 },
      lastUsedAt: new Date(),
      status: "Active",
    },
    create: {
      userId: input.userId,
      profileId: input.profileId,
      firmId: input.firmId,
      phraseKey: key,
      phrase: input.phrase,
      normalizedPhrase,
      targetIntent: input.targetIntent,
      targetRoute: input.targetRoute,
      parametersJson: asJson(input.parameters ?? {}),
      usageCount: 1,
      successCount: 0,
      lastUsedAt: new Date(),
      status: "Active",
    },
  });
}

export async function recordCommandCorrection(input: {
  userId: string;
  profileId?: string | null;
  firmId?: string | null;
  originalCommand: string;
  interpretedIntent?: string | null;
  correctedIntent: string;
  correctedRoute?: string | null;
  correctionNotes?: string | null;
  parameters?: Record<string, unknown>;
}) {
  await recordTrainingPhrase({
    userId: input.userId,
    profileId: input.profileId,
    firmId: input.firmId,
    phrase: input.originalCommand,
    targetIntent: input.correctedIntent,
    targetRoute: input.correctedRoute,
    parameters: input.parameters,
  });

  return prisma.personalUserBotCommandCorrection.create({
    data: {
      userId: input.userId,
      profileId: input.profileId,
      firmId: input.firmId,
      originalCommand: input.originalCommand,
      interpretedIntent: input.interpretedIntent,
      correctedIntent: input.correctedIntent,
      correctedRoute: input.correctedRoute,
      correctionNotes: input.correctionNotes,
      correctedParametersJson: asJson(input.parameters ?? {}),
      status: "Active",
    },
  });
}

export async function startVoiceSession(input: {
  userId: string;
  profileId?: string | null;
  firmId?: string | null;
  language?: string;
}) {
  const sessionKey = `voice-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

  return prisma.personalUserBotVoiceSession.create({
    data: {
      userId: input.userId,
      profileId: input.profileId,
      firmId: input.firmId,
      sessionKey,
      language: input.language ?? "en-US",
      status: "Listening",
      transcript: "",
      metadataJson: asJson({ source: "browser-speech-recognition" }),
    },
  });
}

export async function updateVoiceSession(input: {
  userId: string;
  sessionKey: string;
  transcript: string;
  finalTranscript?: string | null;
  status?: string;
  confidenceScore?: number;
  commandId?: string | null;
}) {
  return prisma.personalUserBotVoiceSession.updateMany({
    where: {
      userId: input.userId,
      sessionKey: input.sessionKey,
    },
    data: {
      transcript: input.transcript,
      finalTranscript: input.finalTranscript,
      status: input.status ?? "Listening",
      confidenceScore: input.confidenceScore ?? undefined,
      commandId: input.commandId,
      endedAt: input.status === "Complete" || input.status === "Failed" ? new Date() : undefined,
    },
  });
}