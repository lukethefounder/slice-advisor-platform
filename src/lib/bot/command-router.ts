import { randomBytes } from "crypto";
import { prisma } from "@/lib/prisma";
import {
  fallbackSliceCommand,
  generateAiText,
  parseSliceCommandWithAi,
  SliceStructuredCommand,
} from "@/lib/integrations/ai";
import { queueBackendDelivery } from "@/lib/backend/notifications";
import { recordAiToolRun } from "@/lib/backend/events";
import { runBackendJob } from "@/lib/backend/jobs";
import {
  ensurePlatformBrain,
  getPlatformBrainContext,
  recordTrainingPhrase,
} from "@/lib/bot/platform-brain";
import { matchFastCommand } from "@/lib/bot/fast-command-router";

type CurrentUserShape = {
  id: string;
  name: string;
  email: string;
};

type BotProfileShape = {
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

type CommandExecutionResult = {
  intent: string;
  answer: string;
  clientAction: Record<string, unknown>;
  status: string;
  resultSummary: string;
  action: Record<string, unknown>;
  aiProvider: string;
};

type ExecutePersonalBotCommandInput = {
  user: CurrentUserShape;
  profile: BotProfileShape;
  prompt: string;
  voiceTranscript?: string | null;
};

type ExecutePersonalBotCommandResult = CommandExecutionResult & {
  commandRecord: any;
  structuredCommand: SliceStructuredCommand;
  aiParserOk: boolean;
  aiParserError?: string;
  fastRouterUsed: boolean;
  fastRouterReason?: string;
  fastRouterConfidence?: number;
};

const db = prisma as any;

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

function normalize(value: string) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9#\s$.-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function safeText(value: string | null | undefined, fallback = "") {
  return value?.trim() || fallback;
}

function safeTicker(command: SliceStructuredCommand, prompt: string) {
  const explicit = command.parameters.ticker || command.parameters.symbol;

  if (explicit) return explicit.toUpperCase();

  const match = prompt
    .toUpperCase()
    .match(/\b(NVDA|AAPL|MSFT|TSLA|META|GOOGL|GOOG|AMZN|AMD|NFLX|SPY|QQQ|IWM|TLT|AVGO|CRM|PLTR|COIN|MSTR|[A-Z]{2,5})\b/);

  return match?.[0] ?? null;
}

function safeNumber(value: number | null | undefined) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function currency(value: number | null | undefined) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "not set";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 10 ? 0 : 2,
  }).format(value);
}

function backendContext(user: CurrentUserShape, profile: BotProfileShape) {
  return {
    userId: user.id,
    firmId: profile.firmId,
    actorName: user.name,
    actorEmail: user.email,
  };
}

function tonePrefix(profile: BotProfileShape) {
  const tone = normalize(profile.preferredTone || "professional");

  if (tone.includes("witty")) {
    return "Right then";
  }

  if (tone.includes("direct") || tone.includes("brutal")) {
    return "Here is the direct answer";
  }

  if (tone.includes("calm")) {
    return "Certainly";
  }

  return "Certainly";
}

function helpfulFallbackAnswer(profile: BotProfileShape) {
  const prefix = tonePrefix(profile);

  return `${prefix} — I can answer open-ended questions, navigate Slice, search firm records, research investments, find source-backed evidence, create tasks, build reports, draft approval-gated emails, run backend jobs, and adapt my tone to the user’s preference. For fully open-ended questions that are not pre-coded, connect OPENAI_API_KEY so the universal AI layer can answer dynamically.`;
}

export async function resolveFirmId(userId: string) {
  const membership = await db.firmMembership.findFirst({
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

export async function ensureBotProfile(user: CurrentUserShape) {
  const firmId = await resolveFirmId(user.id);

  const profile = await db.personalUserBotProfile.upsert({
    where: {
      userId: user.id,
    },
    update: {
      firmId,
    },
    create: {
      userId: user.id,
      firmId,
      botName: `${user.name.split(" ")[0] || "Slice"} Bot`,
      onboardingComplete: false,
      answersJson: "{}",
      personalityJson: asJson({
        tone: "Professional",
        spokenAccent: "British English",
        detailLevel: "Balanced detail",
      }),
      riskJson: "{}",
      capabilitiesJson: asJson([
        "Universal AI conversation layer",
        "British English spoken voice",
        "Personalized tone and answer style",
        "Open-ended question answering",
        "Platform Brain routing map",
        "Command execution",
        "Research",
        "Source lookup",
        "Firm search",
        "Task creation",
        "Report generation",
        "Approval-gated delivery",
      ]),
      preferredTone: "Professional",
      commandStyle: "Balanced detail",
      autonomyLevel: "Advisor approval required",
      voiceEnabled: true,
    },
  });

  await ensurePlatformBrain(user.id, firmId);

  await db.personalUserUiPreference.upsert({
    where: {
      userId: user.id,
    },
    update: {},
    create: {
      userId: user.id,
      accentName: "Slice Red",
      accentHex: "#dc2626",
      accentDarkHex: "#7f1d1d",
      accentSoftHex: "#fee2e2",
      backgroundStyle: "Premium Dark",
      preferenceSource: "Personal Bot",
    },
  });

  await db.personalUserBotWorkspaceTab.upsert({
    where: {
      userId_tabName: {
        userId: user.id,
        tabName: "My Bot",
      },
    },
    update: {
      profileId: profile.id,
    },
    create: {
      userId: user.id,
      profileId: profile.id,
      tabName: "My Bot",
      layoutJson: asJson({
        mode: "universal-british-ai-command-center",
        sections: [
          "universal ai chat",
          "british voice",
          "fast command router",
          "platform brain",
          "research",
          "routing",
          "approvals",
          "memory",
          "email drafts",
          "reports",
          "backend jobs",
        ],
      }),
      pinnedCommandsJson: asJson([
        "Ask me anything",
        "Research NVDA",
        "Open market visuals",
        "Find source for NVDA",
        "Search the firm for Apple exposure",
        "Sort opportunities by score",
        "Create a price alert for NVDA above 1000",
        "Run backend vendor health",
        "Create a premium PDF report",
      ]),
      notes:
        "Universal Slice AI assistant with British English voice, personalized tone, open-ended answers, platform actions, and approval-gated execution.",
      status: "Active",
    },
  });

  return profile;
}

async function getFirmName(firmId: string | null) {
  if (!firmId) return null;

  const firm = await db.firm.findUnique({
    where: {
      id: firmId,
    },
  });

  return firm?.name ?? null;
}

async function ensureAgenda(userId: string, firmId: string | null) {
  if (!firmId) return null;

  const membership = await db.firmMembership.findFirst({
    where: {
      userId,
      firmId,
      status: "Active",
    },
  });

  if (!membership) return null;

  const date = new Date().toISOString().slice(0, 10);

  return db.weeklyAgenda.upsert({
    where: {
      id: `${firmId}-${membership.id}-ai-bot-agenda`,
    },
    update: {
      weekStart: date,
      title: "AI command agenda",
      focus: "Tasks created by the Slice AI command layer.",
      status: "Open",
    },
    create: {
      id: `${firmId}-${membership.id}-ai-bot-agenda`,
      firmId,
      membershipId: membership.id,
      weekStart: date,
      title: "AI command agenda",
      focus: "Tasks created by the Slice AI command layer.",
      status: "Open",
    },
  });
}

async function createBotCommandRecord(input: {
  userId: string;
  profileId: string;
  firmId: string | null;
  commandText: string;
  commandType: string;
  status: string;
  resultSummary: string;
  action: Record<string, unknown>;
}) {
  return db.personalUserBotCommand.create({
    data: {
      userId: input.userId,
      profileId: input.profileId,
      firmId: input.firmId,
      commandText: input.commandText,
      commandType: input.commandType,
      status: input.status,
      resultSummary: input.resultSummary,
      actionJson: asJson(input.action),
    },
  });
}

async function createApproval(input: {
  user: CurrentUserShape;
  profile: BotProfileShape;
  title: string;
  actionType: string;
  riskLevel: string;
  summary: string;
  payload: Record<string, unknown>;
}) {
  const approval = await db.backendApprovalItem.create({
    data: {
      userId: input.user.id,
      firmId: input.profile.firmId,
      title: input.title,
      actionType: input.actionType,
      riskLevel: input.riskLevel,
      summary: input.summary,
      payloadJson: asJson(input.payload),
      requestedBy: input.user.email,
      status: "Pending",
    },
  });

  await db.personalUserBotApprovalItem.create({
    data: {
      userId: input.user.id,
      profileId: input.profile.id,
      firmId: input.profile.firmId,
      title: input.title,
      actionType: input.actionType,
      riskLevel: input.riskLevel,
      summary: input.summary,
      payloadJson: asJson({
        backendApprovalItemId: approval.id,
        ...input.payload,
      }),
      status: "Pending",
    },
  });

  return approval;
}

async function executeNavigate(command: SliceStructuredCommand): Promise<CommandExecutionResult> {
  const href = command.route || command.parameters.route || "/workspace";

  return {
    intent: "Navigate",
    answer: command.answer || `Opening ${href}.`,
    clientAction: {
      type: "navigate",
      href,
      autoRun: true,
    },
    status: "Complete",
    resultSummary: `Navigation requested: ${href}`,
    action: { href },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeAnswer(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const memories = await db.personalUserBotMemory.findMany({
    where: {
      userId: user.id,
      status: "Active",
    },
    orderBy: {
      updatedAt: "desc",
    },
    take: 12,
  });

  const ai = await generateAiText({
    safetyIdentifier: user.email,
    instructions: `
You are ${profile.botName}, the universal AI assistant inside Slice.

Style:
- Use polished British English wording.
- Adapt to the user's preferred tone: ${profile.preferredTone}.
- Adapt to the user's detail style: ${profile.commandStyle}.
- If witty, be sharp but useful.
- If professional, be concise and advisor-grade.
- If brutally honest, be direct but respectful.

Capabilities:
- Answer open-ended questions even if they are not pre-coded.
- Use the user prompt, platform memory, and Slice context.
- Do not claim you completed real-world actions unless a tool result proves it.
- For financial, legal, tax, medical, or other high-stakes topics, be helpful but avoid guarantees and unsupported advice.
`,
    prompt: JSON.stringify(
      {
        prompt,
        parsedCommand: command,
        user: {
          name: user.name,
          email: user.email,
        },
        botProfile: {
          botName: profile.botName,
          preferredTone: profile.preferredTone,
          commandStyle: profile.commandStyle,
          autonomyLevel: profile.autonomyLevel,
          customInstructions: profile.customInstructions,
          personality: parseJson(profile.personalityJson, {}),
          risk: parseJson(profile.riskJson, {}),
        },
        memory: memories.map((memory: any) => ({
          title: memory.title,
          value: memory.value,
          type: memory.memoryType,
        })),
      },
      null,
      2
    ),
  });

  return {
    intent: "Answer",
    answer: ai.ok && ai.text ? ai.text : command.answer || helpfulFallbackAnswer(profile),
    clientAction: { type: "none", autoRun: false },
    status: ai.ok ? "Complete" : "Fallback",
    resultSummary: ai.ok
      ? "Answered open-ended prompt through the AI response layer."
      : "Answered with local fallback because OpenAI was unavailable.",
    action: {
      provider: ai.provider,
      status: ai.status,
      error: ai.error,
    },
    aiProvider: ai.ok ? ai.provider : "Fallback",
  };
}

async function executePlatformSearch(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const query = command.parameters.query || prompt;
  const ticker = safeTicker(command, prompt);
  const search = ticker || query;

  const [
    clients,
    tasks,
    alerts,
    opportunities,
    watchlistItems,
    approvals,
    memories,
  ] = await Promise.all([
    db.clientProfile.findMany({
      where: {
        userId: user.id,
        OR: [
          { fullName: { contains: search } },
          { householdName: { contains: search } },
          { notes: { contains: search } },
          { objective: { contains: search } },
        ],
      },
      take: 8,
    }),
    db.meetingTask.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: search } },
          { description: { contains: search } },
          { priority: { contains: search } },
          { status: { contains: search } },
        ],
      },
      take: 8,
    }),
    db.alertEvent.findMany({
      where: {
        userId: user.id,
        OR: [
          ticker ? { ticker } : {},
          { title: { contains: search } },
          { body: { contains: search } },
          { source: { contains: search } },
        ],
      },
      take: 8,
    }),
    db.opportunitySignal.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: search } },
          { summary: { contains: search } },
          { sourceName: { contains: search } },
          { tickersJson: { contains: ticker || search } },
        ],
      },
      take: 8,
    }),
    db.namedWatchlistItem.findMany({
      where: {
        userId: user.id,
        OR: [
          { symbol: { contains: search.toUpperCase() } },
          { assetName: { contains: search } },
          { thesis: { contains: search } },
        ],
      },
      take: 8,
    }),
    db.backendApprovalItem.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: search } },
          { summary: { contains: search } },
          { actionType: { contains: search } },
        ],
      },
      take: 8,
    }),
    db.personalUserBotMemory.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: search } },
          { value: { contains: search } },
          { memoryType: { contains: search } },
        ],
      },
      take: 8,
    }),
  ]);

  const groups = [
    { label: "Clients", items: clients.map((item: any) => item.fullName) },
    { label: "Tasks", items: tasks.map((item: any) => item.title) },
    { label: "Alerts", items: alerts.map((item: any) => item.title) },
    { label: "Opportunities", items: opportunities.map((item: any) => item.title) },
    {
      label: "Watchlists",
      items: watchlistItems.map((item: any) => `${item.symbol} · ${item.assetName}`),
    },
    { label: "Approvals", items: approvals.map((item: any) => item.title) },
    { label: "Bot Memory", items: memories.map((item: any) => item.title) },
  ].filter((group) => group.items.length);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  await db.personalUserBotDataView.upsert({
    where: {
      userId_viewName: {
        userId: user.id,
        viewName: `Firm Search · ${search.slice(0, 30)}`,
      },
    },
    update: {
      profileId: profile.id,
      viewType: "Firm Search",
      filterJson: asJson({ query, ticker }),
      sortJson: asJson({ by: "grouped relevance" }),
      resultJson: asJson(groups),
    },
    create: {
      userId: user.id,
      profileId: profile.id,
      viewName: `Firm Search · ${search.slice(0, 30)}`,
      viewType: "Firm Search",
      filterJson: asJson({ query, ticker }),
      sortJson: asJson({ by: "grouped relevance" }),
      resultJson: asJson(groups),
    },
  });

  return {
    intent: "Platform Search",
    answer:
      total > 0
        ? `I found ${total} firm result(s) for "${search}".\n\n${groups
            .map(
              (group) =>
                `${group.label}:\n${group.items
                  .map((item: string, index: number) => `  ${index + 1}. ${item}`)
                  .join("\n")}`
            )
            .join("\n\n")}`
        : `I did not find stored firm records for "${search}" yet. That does not mean the answer does not exist; it means Slice has no matching internal record stored for that search.`,
    clientAction: { type: "navigate", href: "/advisor-command-center", autoRun: false },
    status: "Complete",
    resultSummary: `Firm search returned ${total} result(s).`,
    action: { query, ticker, groups, total },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeSourceLookup(
  user: CurrentUserShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const ticker = safeTicker(command, prompt);
  const query = command.parameters.query || ticker || prompt;

  const [alerts, decisions, opportunities, researchNotes] = await Promise.all([
    db.alertEvent.findMany({
      where: {
        userId: user.id,
        OR: [
          ticker ? { ticker } : {},
          { title: { contains: query } },
          { body: { contains: query } },
          { source: { contains: query } },
        ],
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    db.headlineDecision.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: query } },
          { summary: { contains: query } },
          { sourceName: { contains: query } },
          { matchedTickersJson: { contains: ticker ?? query } },
        ],
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    db.opportunitySignal.findMany({
      where: {
        userId: user.id,
        OR: [
          { title: { contains: query } },
          { summary: { contains: query } },
          { sourceName: { contains: query } },
          { tickersJson: { contains: ticker ?? query } },
          { evidenceJson: { contains: query } },
        ],
      },
      orderBy: [{ compositeScore: "desc" }, { createdAt: "desc" }],
      take: 5,
    }),
    db.researchNote.findMany({
      where: {
        userId: user.id,
        OR: [
          ticker ? { ticker } : {},
          { title: { contains: query } },
          { thesis: { contains: query } },
          { risks: { contains: query } },
        ],
      },
      orderBy: { createdAt: "desc" },
      take: 5,
    }),
  ]);

  const sourceItems = [
    ...alerts.map((alert: any) => ({
      type: "Alert",
      title: alert.title,
      source: alert.source,
      url: alert.sourceUrl,
      score: alert.score,
      detail: alert.aiBriefing || alert.body,
    })),
    ...decisions.map((decision: any) => ({
      type: "Headline Decision",
      title: decision.title,
      source: decision.sourceName,
      url: decision.url,
      score: decision.score,
      detail: decision.summary || decision.action,
    })),
    ...opportunities.map((signal: any) => ({
      type: "Opportunity Signal",
      title: signal.title,
      source: signal.sourceName,
      url: null,
      score: signal.compositeScore,
      detail: signal.summary || signal.suggestedAction,
    })),
    ...researchNotes.map((note: any) => ({
      type: "Research Note",
      title: note.title,
      source: "Internal Research",
      url: null,
      score: note.conviction === "High" ? 85 : note.conviction === "Medium" ? 65 : 45,
      detail: `${note.thesis}${note.risks ? ` Risks: ${note.risks}` : ""}`,
    })),
  ]
    .filter((item) => item.title)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const firstUrl = sourceItems.find((item) => item.url)?.url;

  return {
    intent: "Source Lookup",
    answer:
      sourceItems.length > 0
        ? `I found ${sourceItems.length} source-backed item(s) for "${query}".\n\n${sourceItems
            .map(
              (item, index) =>
                `${index + 1}. ${item.type}: ${item.title}\nSource: ${item.source}\nScore: ${item.score}\n${
                  item.url ? `URL: ${item.url}\n` : ""
                }${item.detail ? `Brief: ${item.detail}` : ""}`
            )
            .join("\n\n")}`
        : `I could not find a stored source for "${query}" yet. Run triage, opportunity radar, or market research first.`,
    clientAction: firstUrl
      ? { type: "source", href: firstUrl, autoRun: false }
      : { type: "navigate", href: "/triage", autoRun: false },
    status: sourceItems.length ? "Complete" : "No Source Found",
    resultSummary: sourceItems.length
      ? `Found ${sourceItems.length} source-backed item(s).`
      : "No matching source found.",
    action: { query, ticker, sourceItems, href: firstUrl ?? "/triage" },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeResearch(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const ticker = safeTicker(command, prompt);
  const query = command.parameters.query || ticker || prompt;
  const depth = command.parameters.researchDepth || "standard";

  const [alerts, opportunities, holdings, researchNotes, watchlistItems, dataQuality] =
    await Promise.all([
      db.alertEvent.findMany({
        where: {
          userId: user.id,
          OR: [
            ticker ? { ticker } : {},
            { title: { contains: query } },
            { body: { contains: query } },
            { aiBriefing: { contains: query } },
          ],
        },
        orderBy: [{ score: "desc" }, { createdAt: "desc" }],
        take: depth === "deep" ? 12 : 6,
      }),
      db.opportunitySignal.findMany({
        where: {
          userId: user.id,
          OR: [
            { title: { contains: query } },
            { summary: { contains: query } },
            { tickersJson: { contains: ticker || query } },
            { evidenceJson: { contains: query } },
          ],
        },
        orderBy: [{ compositeScore: "desc" }, { createdAt: "desc" }],
        take: depth === "deep" ? 12 : 6,
      }),
      db.portfolioHolding.findMany({
        where: {
          symbol: ticker || undefined,
          client: {
            userId: user.id,
          },
        },
        include: {
          client: true,
        },
        take: 20,
      }),
      db.researchNote.findMany({
        where: {
          userId: user.id,
          OR: [
            ticker ? { ticker } : {},
            { title: { contains: query } },
            { thesis: { contains: query } },
            { risks: { contains: query } },
          ],
        },
        orderBy: { createdAt: "desc" },
        take: 8,
      }),
      db.namedWatchlistItem.findMany({
        where: {
          userId: user.id,
          OR: [
            ticker ? { symbol: ticker } : {},
            { assetName: { contains: query } },
            { thesis: { contains: query } },
          ],
        },
        take: 10,
      }),
      db.backendDataQualityRecord.findMany({
        where: {
          userId: user.id,
        },
        orderBy: [{ qualityScore: "asc" }, { updatedAt: "desc" }],
        take: 8,
      }),
    ]);

  const context = {
    query,
    ticker,
    depth,
    userTone: profile.preferredTone,
    commandStyle: profile.commandStyle,
    alerts: alerts.map((item: any) => ({
      title: item.title,
      score: item.score,
      urgency: item.urgency,
      source: item.source,
      briefing: item.aiBriefing || item.body,
      url: item.sourceUrl,
    })),
    opportunities: opportunities.map((item: any) => ({
      title: item.title,
      compositeScore: item.compositeScore,
      opportunityScore: item.opportunityScore,
      riskScore: item.riskScore,
      confidenceScore: item.confidenceScore,
      source: item.sourceName,
      action: item.suggestedAction,
      summary: item.summary,
    })),
    holdings: holdings.map((item: any) => ({
      client: item.client.fullName,
      symbol: item.symbol,
      assetName: item.assetName,
      value: item.value,
      allocationPct: item.allocationPct,
      riskLevel: item.riskLevel,
      thesis: item.thesis,
    })),
    researchNotes: researchNotes.map((item: any) => ({
      title: item.title,
      thesis: item.thesis,
      risks: item.risks,
      decision: item.decision,
      conviction: item.conviction,
    })),
    watchlistItems: watchlistItems.map((item: any) => ({
      symbol: item.symbol,
      assetName: item.assetName,
      priority: item.priority,
      thesis: item.thesis,
      status: item.status,
    })),
    dataQuality: dataQuality.map((item: any) => ({
      entityType: item.entityType,
      sourceName: item.sourceName,
      liveStatus: item.liveStatus,
      freshnessStatus: item.freshnessStatus,
      qualityScore: item.qualityScore,
      warning: item.warning,
    })),
  };

  const ai = await generateAiText({
    safetyIdentifier: user.email,
    instructions: `
You are Slice Research, an elite investment-research assistant inside an advisor platform.

Style:
- Use polished British English.
- Match the user’s tone preference: ${profile.preferredTone}.
- Match the detail preference: ${profile.commandStyle}.

Create a source-aware research memo from the platform data provided.
Rules:
- Do not invent firm data.
- Separate bull case, bear case, client exposure, source quality, risk flags, and next actions.
- Keep it advisor-review oriented.
- Do not make guaranteed recommendations.
- Mention missing data when relevant.
`,
    prompt: `Research request: ${prompt}\n\nPlatform data:\n${JSON.stringify(context, null, 2)}`,
  });

  const memo =
    ai.ok && ai.text
      ? ai.text
      : `Research memo for ${query}:\n\nAvailable platform data: ${alerts.length} alert(s), ${opportunities.length} opportunity signal(s), ${holdings.length} client holding(s), ${researchNotes.length} prior research note(s), and ${watchlistItems.length} watchlist item(s).\n\nOpenAI research synthesis was unavailable. Review Market Visuals, Triage, Opportunity Radar, and Client Brain before taking action.`;

  const note = await db.researchNote.create({
    data: {
      userId: user.id,
      ticker,
      title: `AI Research · ${ticker || query}`.slice(0, 140),
      thesis: memo.slice(0, 5000),
      risks:
        "AI-generated research note. Advisor review required. Source freshness and suitability should be validated before client-facing action.",
      decision: "Review",
      conviction:
        opportunities[0]?.confidenceScore && opportunities[0].confidenceScore >= 75
          ? "Medium"
          : "Low",
      sourceLinks: alerts.map((alert: any) => alert.sourceUrl).filter(Boolean).join("\n"),
    },
  });

  await db.personalUserBotResearchRun.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      firmId: profile.firmId,
      query,
      ticker,
      depth,
      status: "Complete",
      answerJson: asJson({ memo }),
      sourceSnapshotJson: asJson(context),
      confidenceScore: ai.ok ? 82 : 45,
    },
  });

  return {
    intent: "Research",
    answer: memo,
    clientAction: {
      type: "navigate",
      href: ticker ? `/market-visuals?symbol=${ticker}` : "/advisor-command-center",
      autoRun: false,
    },
    status: "Complete",
    resultSummary: `Created AI research note for ${ticker || query}.`,
    action: {
      researchNoteId: note.id,
      ticker,
      query,
      depth,
    },
    aiProvider: ai.ok ? "OpenAI" : "Fallback",
  };
}

async function executeCreateTask(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const title = safeText(command.parameters.title, prompt).slice(0, 160);
  const detail = command.parameters.detail || "Created by Slice AI command.";
  const priority = command.parameters.priority || "Medium";
  const dueDate = command.parameters.dueDate || new Date().toISOString().slice(0, 10);
  const agenda = await ensureAgenda(user.id, profile.firmId);

  if (agenda) {
    const task = await db.firmAgendaTask.create({
      data: {
        firmId: agenda.firmId,
        agendaId: agenda.id,
        title,
        detail,
        priority,
        status: "Open",
        dueDate,
      },
    });

    return {
      intent: "Create Task",
      answer: `Task created: ${task.title}`,
      clientAction: { type: "navigate", href: "/workspace?tab=firm-calendar", autoRun: false },
      status: "Complete",
      resultSummary: `Created firm task: ${task.title}`,
      action: { taskId: task.id, href: "/workspace?tab=firm-calendar" },
      aiProvider: "Fast/OpenAI",
    };
  }

  const task = await db.meetingTask.create({
    data: {
      userId: user.id,
      title,
      description: detail,
      dueDate: new Date(`${dueDate}T00:00:00`),
      priority,
      status: "Open",
    },
  });

  return {
    intent: "Create Task",
    answer: `Task created: ${task.title}`,
    clientAction: { type: "navigate", href: "/workspace?tab=clients", autoRun: false },
    status: "Complete",
    resultSummary: `Created personal task: ${task.title}`,
    action: { taskId: task.id, href: "/workspace?tab=clients" },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeCreateClient(
  user: CurrentUserShape,
  command: SliceStructuredCommand
): Promise<CommandExecutionResult> {
  const fullName = safeText(
    command.parameters.clientName || command.parameters.title,
    "New Client"
  ).slice(0, 120);

  const client = await db.clientProfile.create({
    data: {
      userId: user.id,
      fullName,
      email: command.parameters.email,
      householdName: fullName,
      clientType: "Private Client",
      riskProfile: "Balanced",
      liquidityNeeds: "Moderate",
      timeHorizon: "5-10 years",
      objective: "Long-term wealth growth",
      status: "Active",
      notes: "Created by Slice AI command.",
    },
  });

  return {
    intent: "Create Client",
    answer: `Client profile created: ${client.fullName}.`,
    clientAction: { type: "navigate", href: "/workspace?tab=clients", autoRun: false },
    status: "Complete",
    resultSummary: `Created client: ${client.fullName}`,
    action: { clientId: client.id, href: "/workspace?tab=clients" },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeCreateProject(
  profile: BotProfileShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  if (!profile.firmId) {
    return {
      intent: "Create Project",
      answer: "I can create the project once you are connected to an active firm workspace.",
      clientAction: { type: "navigate", href: "/workspace", autoRun: false },
      status: "Needs Firm",
      resultSummary: "No active firm workspace found.",
      action: { href: "/workspace" },
      aiProvider: "Fast/OpenAI",
    };
  }

  const title = safeText(command.parameters.projectTitle || command.parameters.title, prompt).slice(
    0,
    140
  );

  const project = await db.firmProject.create({
    data: {
      firmId: profile.firmId,
      title,
      description: command.parameters.detail || "Created by Slice AI command.",
      status: "Active",
      priority: command.parameters.priority || "Medium",
      dueDate: command.parameters.dueDate,
    },
  });

  return {
    intent: "Create Project",
    answer: `Project created: ${project.title}.`,
    clientAction: { type: "navigate", href: "/workspace?tab=team-board", autoRun: false },
    status: "Complete",
    resultSummary: `Created firm project: ${project.title}`,
    action: { projectId: project.id, href: "/workspace?tab=team-board" },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeCreateWatchlistItem(
  user: CurrentUserShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const symbol = safeTicker(command, prompt);

  if (!symbol) {
    return {
      intent: "Create Watchlist Item",
      answer: "I need a ticker symbol before I can add this to a watchlist.",
      clientAction: { type: "navigate", href: "/workspace?tab=watchlists", autoRun: false },
      status: "Needs Ticker",
      resultSummary: "Watchlist item was not created because no ticker was found.",
      action: { href: "/workspace?tab=watchlists" },
      aiProvider: "Fast/OpenAI",
    };
  }

  const watchlist = await db.namedWatchlist.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: command.parameters.watchlistName || "AI Command Watchlist",
      },
    },
    update: {
      description: "Watchlist managed by Slice AI.",
    },
    create: {
      userId: user.id,
      name: command.parameters.watchlistName || "AI Command Watchlist",
      description: "Watchlist managed by Slice AI.",
      focus: "AI monitored opportunities",
      riskLevel: "Mixed",
    },
  });

  const item = await db.namedWatchlistItem.upsert({
    where: {
      watchlistId_symbol: {
        watchlistId: watchlist.id,
        symbol,
      },
    },
    update: {
      assetName: command.parameters.title || symbol,
      thesis: command.parameters.detail || prompt,
      status: "Watching",
      priority: command.parameters.priority || "Medium",
    },
    create: {
      userId: user.id,
      watchlistId: watchlist.id,
      symbol,
      assetName: command.parameters.title || symbol,
      assetType: "Stock",
      sourceType: "AI Command",
      thesis: command.parameters.detail || prompt,
      riskNotes: "Added by AI command. Advisor review required before client-facing action.",
      status: "Watching",
      priority: command.parameters.priority || "Medium",
    },
  });

  return {
    intent: "Create Watchlist Item",
    answer: `${symbol} added to ${watchlist.name}.`,
    clientAction: { type: "navigate", href: "/workspace?tab=watchlists", autoRun: false },
    status: "Complete",
    resultSummary: `Added ${symbol} to watchlist.`,
    action: { watchlistId: watchlist.id, itemId: item.id, symbol },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeCreatePriceAlert(
  user: CurrentUserShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const symbol = safeTicker(command, prompt);
  const upperTargetPrice = safeNumber(command.parameters.upperTargetPrice);
  const lowerTargetPrice = safeNumber(command.parameters.lowerTargetPrice);

  if (!symbol) {
    return {
      intent: "Create Price Alert",
      answer: "I need a ticker symbol before I can create a price alert.",
      clientAction: { type: "navigate", href: "/watchlist-alerts", autoRun: false },
      status: "Needs Ticker",
      resultSummary: "Price alert was not created because no ticker was found.",
      action: { href: "/watchlist-alerts" },
      aiProvider: "Fast/OpenAI",
    };
  }

  if (!upperTargetPrice && !lowerTargetPrice) {
    return {
      intent: "Create Price Alert",
      answer: `I found ${symbol}, but I need a high or low target price before creating the alert.`,
      clientAction: { type: "navigate", href: "/watchlist-alerts", autoRun: false },
      status: "Needs Target",
      resultSummary: "Price alert was not created because no target price was found.",
      action: { symbol, href: "/watchlist-alerts" },
      aiProvider: "Fast/OpenAI",
    };
  }

  const alert = await db.watchlistPriceAlert.create({
    data: {
      userId: user.id,
      symbol,
      assetName: symbol,
      upperTargetPrice,
      lowerTargetPrice,
      notificationChannel: command.parameters.deliveryChannel || "Dashboard",
      status: "Active",
      notes: command.parameters.detail || prompt,
    },
  });

  return {
    intent: "Create Price Alert",
    answer: `Price alert created for ${symbol}. High target: ${currency(
      upperTargetPrice
    )}. Low target: ${currency(lowerTargetPrice)}.`,
    clientAction: { type: "navigate", href: "/watchlist-alerts", autoRun: false },
    status: "Complete",
    resultSummary: `Created price alert for ${symbol}.`,
    action: { alertId: alert.id, symbol, upperTargetPrice, lowerTargetPrice },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeSortData(user: CurrentUserShape): Promise<CommandExecutionResult> {
  const [opportunities, alerts, tasks] = await Promise.all([
    db.opportunitySignal.findMany({
      where: { userId: user.id },
      orderBy: [{ compositeScore: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    db.alertEvent.findMany({
      where: { userId: user.id },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 8,
    }),
    db.meetingTask.findMany({
      where: { userId: user.id },
      orderBy: [{ createdAt: "desc" }],
      take: 8,
    }),
  ]);

  const ranked = [
    ...opportunities.map((item: any) => ({
      type: "Opportunity",
      title: item.title,
      score: item.compositeScore,
    })),
    ...alerts.map((item: any) => ({
      type: "Alert",
      title: item.title,
      score: item.score,
    })),
    ...tasks.map((item: any) => ({
      type: "Task",
      title: item.title,
      score: item.priority === "High" ? 80 : item.priority === "Medium" ? 60 : 40,
    })),
  ]
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);

  return {
    intent: "Sort Data",
    answer:
      ranked.length > 0
        ? `Here are the top ranked Slice items:\n\n${ranked
            .map((item, index) => `${index + 1}. ${item.type}: ${item.title} — score ${item.score}`)
            .join("\n")}`
        : "There is not enough stored Slice data to rank yet.",
    clientAction: { type: "navigate", href: "/opportunity-radar", autoRun: false },
    status: "Complete",
    resultSummary: `Ranked ${ranked.length} item(s).`,
    action: { ranked },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeDraftEmail(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const subject = command.parameters.subject || command.parameters.title || "Slice advisor update";
  const body =
    command.parameters.body ||
    `Draft prepared by Slice AI for advisor review.\n\nRequest:\n${prompt}\n\nPlease review for accuracy, suitability, and compliance before sending.`;
  const recipient = command.parameters.recipient || command.parameters.email || user.email;

  const draft = await db.personalUserBotEmailDraft.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      firmId: profile.firmId,
      subject,
      body,
      recipientJson: asJson([{ email: recipient }]),
      complianceJson: asJson([
        "Advisor review required.",
        "Confirm suitability before sending.",
        "Do not send without approval.",
      ]),
      status: "Draft",
    },
  });

  const approval = await createApproval({
    user,
    profile,
    title: `Approve email draft: ${subject}`,
    actionType: "Email Draft",
    riskLevel: "High",
    summary: `Email draft created for ${recipient}. Advisor approval required before delivery.`,
    payload: {
      draftId: draft.id,
      recipient,
      subject,
      body,
    },
  });

  return {
    intent: "Draft Email",
    answer: `Email draft created and queued for approval before sending. Subject: ${subject}`,
    clientAction: { type: "navigate", href: "/backend-readiness", autoRun: false },
    status: "Needs Approval",
    resultSummary: `Created email draft ${draft.id} and approval ${approval.id}.`,
    action: { draftId: draft.id, approvalId: approval.id, recipient, subject },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeCreateReport(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const title = safeText(
    command.parameters.reportTitle || command.parameters.title,
    "Slice AI Report"
  ).slice(0, 160);

  const summary =
    command.parameters.detail ||
    `Premium report requested through Slice AI.\n\nOriginal request:\n${prompt}`;

  const sections = [
    {
      title: "Executive Summary",
      body: summary,
    },
    {
      title: "Advisor Review Notes",
      body:
        "This report was generated by Slice AI. Review source quality, suitability, compliance posture, and client-specific context before using externally.",
    },
    {
      title: "Next Actions",
      body:
        "Review the generated report, verify source freshness, and decide whether to approve, revise, or convert it into a client-facing packet.",
    },
  ];

  const report = await db.personalUserBotPdfReport.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      firmId: profile.firmId,
      title,
      reportType: "Premium AI Report",
      summary,
      sectionsJson: asJson(sections),
      designJson: asJson({
        style: "premium-dark-red",
        generatedBy: profile.botName,
        spokenAccent: "British English",
      }),
      downloadToken: randomBytes(24).toString("hex"),
      status: "Generated",
    },
  });

  const approval = await createApproval({
    user,
    profile,
    title: `Review report: ${title}`,
    actionType: "PDF Report",
    riskLevel: "Medium",
    summary: `Premium report generated for review: ${title}`,
    payload: {
      reportId: report.id,
      title,
      reportType: "Premium AI Report",
    },
  });

  return {
    intent: "Create Report",
    answer: `Premium report created: ${title}. It is ready for advisor review and PDF download.`,
    clientAction: {
      type: "report",
      href: `/api/personal-bot/pdf-report?token=${report.downloadToken}`,
      autoRun: false,
    },
    status: "Complete",
    resultSummary: `Created premium PDF report ${report.id}.`,
    action: {
      reportId: report.id,
      approvalId: approval.id,
      downloadUrl: `/api/personal-bot/pdf-report?token=${report.downloadToken}`,
    },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeAdvisorDay(
  user: CurrentUserShape,
  profile: BotProfileShape
): Promise<CommandExecutionResult> {
  const result = await runBackendJob(backendContext(user, profile), "advisor_day");

  return {
    intent: "Advisor Day",
    answer: `Advisor Day generated. ${JSON.stringify(result)}`,
    clientAction: { type: "navigate", href: "/advisor-command-center", autoRun: false },
    status: "Complete",
    resultSummary: "Generated Advisor Day.",
    action: { jobKey: "advisor_day", result },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeBackendJob(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand
): Promise<CommandExecutionResult> {
  const jobKey = command.parameters.jobKey || "vendor_health";
  const result = await runBackendJob(backendContext(user, profile), jobKey);

  await recordAiToolRun(backendContext(user, profile), {
    toolKey: `bot_job_${jobKey}`,
    toolName: `Bot job: ${jobKey}`,
    input: { jobKey },
    output: result as Record<string, unknown>,
    status: "Complete",
  });

  return {
    intent: "Backend Job",
    answer: `Backend job complete: ${jobKey}.`,
    clientAction: { type: "navigate", href: "/backend-kernel", autoRun: false },
    status: "Complete",
    resultSummary: `Backend job completed: ${jobKey}.`,
    action: { jobKey, result },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeQueueDelivery(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const channel = command.parameters.deliveryChannel || "Dashboard";
  const destination =
    command.parameters.recipient || command.parameters.email || command.parameters.phone || user.email;
  const title = command.parameters.subject || command.parameters.title || "Slice AI delivery";
  const body = command.parameters.body || command.parameters.detail || prompt;

  const delivery = await queueBackendDelivery(backendContext(user, profile), {
    channel,
    destination,
    title,
    body,
    payload: {
      prompt,
      createdBy: profile.botName,
    },
    urgency: command.riskLevel === "Critical" ? "Critical" : "Medium",
    score: command.riskLevel === "Critical" ? 95 : 65,
    approvalRequired: true,
  });

  const approval = await createApproval({
    user,
    profile,
    title: `Approve ${channel} delivery: ${title}`,
    actionType: "Outbound Delivery",
    riskLevel: "High",
    summary: `Queued ${channel} delivery for approval before sending.`,
    payload: {
      deliveryId: delivery.id,
      channel,
      destination,
      title,
      body,
    },
  });

  return {
    intent: "Queue Delivery",
    answer: `${channel} delivery queued for approval before sending.`,
    clientAction: { type: "navigate", href: "/backend-readiness", autoRun: false },
    status: "Needs Approval",
    resultSummary: `Queued delivery ${delivery.id} and approval ${approval.id}.`,
    action: { deliveryId: delivery.id, approvalId: approval.id, channel, destination },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeApprovalDecision(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand
): Promise<CommandExecutionResult> {
  const decision = command.parameters.approvalDecision;

  if (!decision) {
    return {
      intent: "Approval Decision",
      answer: "I need to know whether to approve or reject the pending item.",
      clientAction: { type: "navigate", href: "/backend-readiness", autoRun: false },
      status: "Needs Decision",
      resultSummary: "Approval command did not include approve or reject.",
      action: { href: "/backend-readiness" },
      aiProvider: "Fast/OpenAI",
    };
  }

  const approval = await db.backendApprovalItem.findFirst({
    where: {
      userId: user.id,
      status: "Pending",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!approval) {
    return {
      intent: "Approval Decision",
      answer: "There are no pending approval items to decide.",
      clientAction: { type: "navigate", href: "/backend-readiness", autoRun: false },
      status: "No Pending Approval",
      resultSummary: "No pending approval found.",
      action: { href: "/backend-readiness" },
      aiProvider: "Fast/OpenAI",
    };
  }

  const status = decision === "approve" ? "Approved" : "Rejected";

  await db.backendApprovalItem.update({
    where: { id: approval.id },
    data: {
      status,
      decidedAt: new Date(),
      decidedBy: user.email,
    },
  });

  await db.personalUserBotApprovalItem.updateMany({
    where: {
      userId: user.id,
      title: approval.title,
      status: "Pending",
    },
    data: {
      status,
      decidedAt: new Date(),
      decidedBy: user.email,
    },
  });

  return {
    intent: "Approval Decision",
    answer: `Latest pending approval ${status.toLowerCase()}: ${approval.title}.`,
    clientAction: { type: "navigate", href: "/backend-readiness", autoRun: false },
    status: "Complete",
    resultSummary: `${status} approval ${approval.id}.`,
    action: { approvalId: approval.id, decision, status },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeRemember(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const memoryText = safeText(command.parameters.memory, prompt.replace(/remember/i, "").trim());
  const title = memoryText.split(".")[0]?.slice(0, 90) || "User preference";

  const memory = await db.personalUserBotMemory.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      firmId: profile.firmId,
      memoryType: "Preference",
      title,
      value: memoryText,
      confidenceScore: 88,
      status: "Active",
    },
  });

  return {
    intent: "Remember",
    answer: `I’ll remember that: ${memoryText}`,
    clientAction: { type: "none", autoRun: false },
    status: "Complete",
    resultSummary: `Stored memory: ${title}.`,
    action: { memoryId: memory.id, memoryText },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeTheme(
  user: CurrentUserShape,
  command: SliceStructuredCommand
): Promise<CommandExecutionResult> {
  const color = normalize(command.parameters.color || "red");

  const palette: Record<
    string,
    { name: string; accentHex: string; accentDarkHex: string; accentSoftHex: string }
  > = {
    red: {
      name: "Slice Red",
      accentHex: "#dc2626",
      accentDarkHex: "#7f1d1d",
      accentSoftHex: "#fee2e2",
    },
    blue: {
      name: "Executive Blue",
      accentHex: "#2563eb",
      accentDarkHex: "#1e3a8a",
      accentSoftHex: "#dbeafe",
    },
    green: {
      name: "Market Green",
      accentHex: "#16a34a",
      accentDarkHex: "#14532d",
      accentSoftHex: "#dcfce7",
    },
    purple: {
      name: "Advisor Purple",
      accentHex: "#9333ea",
      accentDarkHex: "#581c87",
      accentSoftHex: "#f3e8ff",
    },
    gold: {
      name: "Regal Gold",
      accentHex: "#d97706",
      accentDarkHex: "#78350f",
      accentSoftHex: "#fef3c7",
    },
    mint: {
      name: "Mint",
      accentHex: "#10b981",
      accentDarkHex: "#064e3b",
      accentSoftHex: "#d1fae5",
    },
  };

  const selected = palette[color] ?? palette.red;

  await db.personalUserUiPreference.upsert({
    where: { userId: user.id },
    update: {
      accentName: selected.name,
      accentHex: selected.accentHex,
      accentDarkHex: selected.accentDarkHex,
      accentSoftHex: selected.accentSoftHex,
      preferenceSource: "Personal Bot",
    },
    create: {
      userId: user.id,
      accentName: selected.name,
      accentHex: selected.accentHex,
      accentDarkHex: selected.accentDarkHex,
      accentSoftHex: selected.accentSoftHex,
      backgroundStyle: "Premium Dark",
      preferenceSource: "Personal Bot",
    },
  });

  return {
    intent: "Theme",
    answer: `Theme updated to ${selected.name}.`,
    clientAction: { type: "theme", autoRun: false },
    status: "Complete",
    resultSummary: `Theme changed to ${selected.name}.`,
    action: selected,
    aiProvider: "Fast/OpenAI",
  };
}

async function executeHelp(profile: BotProfileShape): Promise<CommandExecutionResult> {
  return {
    intent: "Help",
    answer: `${tonePrefix(
      profile
    )} — I can answer open-ended questions, speak in British English, adapt to your preferred tone, navigate Slice, research investments, search firm data, find source-backed evidence, create tasks, create clients, create projects, create watchlist items, create price alerts, draft approval-gated messages, create premium reports, run backend jobs, remember preferences, and change your theme.`,
    clientAction: { type: "navigate", href: "/workspace/personal-bot", autoRun: false },
    status: "Complete",
    resultSummary: "Displayed bot capabilities.",
    action: { href: "/workspace/personal-bot" },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeStructuredCommand(input: {
  user: CurrentUserShape;
  profile: BotProfileShape;
  command: SliceStructuredCommand;
  prompt: string;
}): Promise<CommandExecutionResult> {
  const { user, profile, command, prompt } = input;

  switch (command.intent) {
    case "navigate":
      return executeNavigate(command);

    case "answer":
      return executeAnswer(user, profile, command, prompt);

    case "source_lookup":
      return executeSourceLookup(user, command, prompt);

    case "platform_search":
      return executePlatformSearch(user, profile, command, prompt);

    case "research":
      return executeResearch(user, profile, command, prompt);

    case "sort_data":
      return executeSortData(user);

    case "create_task":
      return executeCreateTask(user, profile, command, prompt);

    case "create_client":
      return executeCreateClient(user, command);

    case "create_project":
      return executeCreateProject(profile, command, prompt);

    case "create_watchlist_item":
      return executeCreateWatchlistItem(user, command, prompt);

    case "create_price_alert":
      return executeCreatePriceAlert(user, command, prompt);

    case "draft_email":
      return executeDraftEmail(user, profile, command, prompt);

    case "create_report":
      return executeCreateReport(user, profile, command, prompt);

    case "advisor_day":
      return executeAdvisorDay(user, profile);

    case "backend_job":
      return executeBackendJob(user, profile, command);

    case "queue_delivery":
      return executeQueueDelivery(user, profile, command, prompt);

    case "approval_decision":
      return executeApprovalDecision(user, profile, command);

    case "remember":
      return executeRemember(user, profile, command, prompt);

    case "theme":
      return executeTheme(user, command);

    case "help":
      return executeHelp(profile);

    default:
      return executeAnswer(user, profile, command, prompt);
  }
}

export async function executePersonalBotCommand(
  input: ExecutePersonalBotCommandInput
): Promise<ExecutePersonalBotCommandResult> {
  const startedAt = Date.now();
  const prompt = input.prompt.trim();
  const firmName = await getFirmName(input.profile.firmId);

  await ensurePlatformBrain(input.user.id, input.profile.firmId);

  const [
    platformBrain,
    memories,
    openTasks,
    unreadAlerts,
    clients,
    investorHoldings,
  ] = await Promise.all([
    getPlatformBrainContext(input.user.id),
    db.personalUserBotMemory.findMany({
      where: {
        userId: input.user.id,
        status: "Active",
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 20,
    }),
    db.meetingTask.count({
      where: {
        userId: input.user.id,
        status: {
          not: "Complete",
        },
      },
    }),
    db.alertEvent.count({
      where: {
        userId: input.user.id,
        status: "Unread",
      },
    }),
    db.clientProfile.count({
      where: {
        userId: input.user.id,
      },
    }),
    db.investorHolding.findMany({
      where: {
        userId: input.user.id,
      },
      take: 80,
    }),
  ]);

  const portfolioValue = investorHoldings.reduce(
    (sum: number, holding: any) => sum + Number(holding.valueNumber ?? 0),
    0
  );

  const fastMatch = matchFastCommand({
    prompt,
    platformBrain,
  });

  let structuredCommand: SliceStructuredCommand;
  let aiParserOk = false;
  let aiParserError: string | undefined;
  let aiProvider = "Fast Router";
  let fastRouterUsed = false;
  let fastRouterReason: string | undefined;
  let fastRouterConfidence: number | undefined;

  if (fastMatch?.matched && fastMatch.confidence >= 0.9) {
    structuredCommand = fastMatch.command;
    fastRouterUsed = true;
    fastRouterReason = fastMatch.reason;
    fastRouterConfidence = fastMatch.confidence;
  } else {
    const parsed = await parseSliceCommandWithAi({
      prompt,
      userName: input.user.name,
      userEmail: input.user.email,
      firmName,
      botName: input.profile.botName,
      memory: memories.map((memory: any) => `${memory.title}: ${memory.value}`),
      openTasks,
      unreadAlerts,
      clients,
      portfolioValue,
      platformBrain,
      voiceTranscript: input.voiceTranscript,
      preferredTone: input.profile.preferredTone,
      commandStyle: input.profile.commandStyle,
      customInstructions: input.profile.customInstructions,
      personality: parseJson<Record<string, unknown>>(input.profile.personalityJson, {}),
    });

    structuredCommand = parsed.command;
    aiParserOk = parsed.ok;
    aiParserError = parsed.error;
    aiProvider = parsed.provider;

    if (!parsed.ok && fastMatch?.matched) {
      structuredCommand = fastMatch.command;
      fastRouterUsed = true;
      fastRouterReason = fastMatch.reason;
      fastRouterConfidence = fastMatch.confidence;
    }

    if (!parsed.ok && !fastMatch?.matched) {
      structuredCommand = fallbackSliceCommand(prompt, platformBrain);
    }
  }

  let execution: CommandExecutionResult;

  try {
    execution = await executeStructuredCommand({
      user: input.user,
      profile: input.profile,
      command: structuredCommand,
      prompt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Command execution failed.";

    execution = {
      intent: "Error",
      answer: `I understood the request, but the platform action failed: ${message}`,
      clientAction: { type: "none", autoRun: false },
      status: "Failed",
      resultSummary: message,
      action: {
        error: message,
        structuredCommand,
      },
      aiProvider,
    };
  }

  const commandRecord = await createBotCommandRecord({
    userId: input.user.id,
    profileId: input.profile.id,
    firmId: input.profile.firmId,
    commandText: prompt,
    commandType: structuredCommand.intent,
    status: execution.status,
    resultSummary: execution.resultSummary,
    action: {
      ...execution.action,
      structuredCommand,
      aiParserOk,
      aiParserError,
      aiProvider,
      fastRouterUsed,
      fastRouterReason,
      fastRouterConfidence,
      voiceTranscript: input.voiceTranscript ?? null,
      durationMs: Date.now() - startedAt,
      spokenAccent: "British English",
      preferredTone: input.profile.preferredTone,
    },
  });

  if (execution.status === "Complete" && structuredCommand.confidence >= 0.7) {
    await recordTrainingPhrase({
      userId: input.user.id,
      profileId: input.profile.id,
      firmId: input.profile.firmId,
      phrase: prompt,
      targetIntent: structuredCommand.intent,
      targetRoute: structuredCommand.route || structuredCommand.parameters.route,
      parameters: structuredCommand.parameters as unknown as Record<string, unknown>,
    }).catch(() => null);
  }

  return {
    ...execution,
    commandRecord,
    structuredCommand,
    aiParserOk,
    aiParserError,
    fastRouterUsed,
    fastRouterReason,
    fastRouterConfidence,
  };
}