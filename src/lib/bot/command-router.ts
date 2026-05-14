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

function asJson(value: unknown) {
  return JSON.stringify(value);
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

export async function resolveFirmId(userId: string) {
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

export async function ensureBotProfile(user: CurrentUserShape) {
  const firmId = await resolveFirmId(user.id);

  const profile = await prisma.personalUserBotProfile.upsert({
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
      personalityJson: "{}",
      riskJson: "{}",
      capabilitiesJson: "[]",
      preferredTone: "Professional",
      commandStyle: "Balanced detail",
      autonomyLevel: "Advisor approval required",
      voiceEnabled: true,
    },
  });

  await ensurePlatformBrain(user.id, firmId);

  await prisma.personalUserUiPreference.upsert({
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

  await prisma.personalUserBotWorkspaceTab.upsert({
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
        mode: "platform-brain-fast-voice-command-center",
        sections: [
          "fast command router",
          "voice command",
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
        "What should I do next?",
        "Research NVDA",
        "Open market visuals",
        "Open venture monitor",
        "Find source for NVDA",
        "Search the firm for Apple exposure",
        "Sort opportunities by score",
        "Create a price alert for NVDA above 1000",
        "Run backend vendor health",
        "Create a premium PDF report",
      ]),
      notes: "OpenAI-powered platform-brain command center for Slice with fast local routing.",
      status: "Active",
    },
  });

  return profile;
}

async function getFirmName(firmId: string | null) {
  if (!firmId) return null;

  const firm = await prisma.firm.findUnique({
    where: {
      id: firmId,
    },
  });

  return firm?.name ?? null;
}

async function ensureAgenda(userId: string, firmId: string | null) {
  if (!firmId) return null;

  const membership = await prisma.firmMembership.findFirst({
    where: {
      userId,
      firmId,
      status: "Active",
    },
  });

  if (!membership) return null;

  const date = new Date().toISOString().slice(0, 10);

  return prisma.weeklyAgenda.upsert({
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
  return prisma.personalUserBotCommand.create({
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
  const approval = await prisma.backendApprovalItem.create({
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

  await prisma.personalUserBotApprovalItem.create({
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
    prisma.clientProfile.findMany({
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
    prisma.meetingTask.findMany({
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
    prisma.alertEvent.findMany({
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
    prisma.opportunitySignal.findMany({
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
    prisma.namedWatchlistItem.findMany({
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
    prisma.backendApprovalItem.findMany({
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
    prisma.personalUserBotMemory.findMany({
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
    { label: "Clients", items: clients.map((item) => item.fullName) },
    { label: "Tasks", items: tasks.map((item) => item.title) },
    { label: "Alerts", items: alerts.map((item) => item.title) },
    { label: "Opportunities", items: opportunities.map((item) => item.title) },
    { label: "Watchlists", items: watchlistItems.map((item) => `${item.symbol} · ${item.assetName}`) },
    { label: "Approvals", items: approvals.map((item) => item.title) },
    { label: "Bot Memory", items: memories.map((item) => item.title) },
  ].filter((group) => group.items.length);

  const total = groups.reduce((sum, group) => sum + group.items.length, 0);

  await prisma.personalUserBotDataView.upsert({
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
            .map((group) => `${group.label}:\n${group.items.map((item, index) => `  ${index + 1}. ${item}`).join("\n")}`)
            .join("\n\n")}`
        : `I did not find firm records for "${search}". Try running triage, adding client holdings, or creating watchlist/research records first.`,
    clientAction: { type: "navigate", href: "/advisor-command-center", autoRun: false },
    status: "Complete",
    resultSummary: `Firm search returned ${total} result(s).`,
    action: { query, ticker, groups, total },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeSourceLookup(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const ticker = safeTicker(command, prompt);
  const query = command.parameters.query || ticker || prompt;

  const [alerts, decisions, opportunities, researchNotes] = await Promise.all([
    prisma.alertEvent.findMany({
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
    prisma.headlineDecision.findMany({
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
    prisma.opportunitySignal.findMany({
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
    prisma.researchNote.findMany({
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
    ...alerts.map((alert) => ({
      type: "Alert",
      title: alert.title,
      source: alert.source,
      url: alert.sourceUrl,
      score: alert.score,
      detail: alert.aiBriefing || alert.body,
    })),
    ...decisions.map((decision) => ({
      type: "Headline Decision",
      title: decision.title,
      source: decision.sourceName,
      url: decision.url,
      score: decision.score,
      detail: decision.summary || decision.action,
    })),
    ...opportunities.map((signal) => ({
      type: "Opportunity Signal",
      title: signal.title,
      source: signal.sourceName,
      url: null,
      score: signal.compositeScore,
      detail: signal.summary || signal.suggestedAction,
    })),
    ...researchNotes.map((note) => ({
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
    resultSummary: sourceItems.length ? `Found ${sourceItems.length} source-backed item(s).` : "No matching source found.",
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

  const [alerts, opportunities, holdings, researchNotes, watchlistItems, dataQuality] = await Promise.all([
    prisma.alertEvent.findMany({
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
    prisma.opportunitySignal.findMany({
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
    prisma.portfolioHolding.findMany({
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
    prisma.researchNote.findMany({
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
    prisma.namedWatchlistItem.findMany({
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
    prisma.backendDataQualityRecord.findMany({
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
    alerts: alerts.map((item) => ({
      title: item.title,
      score: item.score,
      urgency: item.urgency,
      source: item.source,
      briefing: item.aiBriefing || item.body,
      url: item.sourceUrl,
    })),
    opportunities: opportunities.map((item) => ({
      title: item.title,
      compositeScore: item.compositeScore,
      opportunityScore: item.opportunityScore,
      riskScore: item.riskScore,
      confidenceScore: item.confidenceScore,
      source: item.sourceName,
      action: item.suggestedAction,
      summary: item.summary,
    })),
    holdings: holdings.map((item) => ({
      client: item.client.fullName,
      symbol: item.symbol,
      assetName: item.assetName,
      value: item.value,
      allocationPct: item.allocationPct,
      riskLevel: item.riskLevel,
      thesis: item.thesis,
    })),
    researchNotes: researchNotes.map((item) => ({
      title: item.title,
      thesis: item.thesis,
      risks: item.risks,
      decision: item.decision,
      conviction: item.conviction,
    })),
    watchlistItems: watchlistItems.map((item) => ({
      symbol: item.symbol,
      assetName: item.assetName,
      priority: item.priority,
      thesis: item.thesis,
      status: item.status,
    })),
    dataQuality: dataQuality.map((item) => ({
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

  const note = await prisma.researchNote.create({
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
      sourceLinks: alerts.map((alert) => alert.sourceUrl).filter(Boolean).join("\n"),
    },
  });

  await prisma.personalUserBotResearchRun.create({
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
    const task = await prisma.firmAgendaTask.create({
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

  const task = await prisma.meetingTask.create({
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
  const fullName = safeText(command.parameters.clientName || command.parameters.title, "New Client").slice(0, 120);

  const client = await prisma.clientProfile.create({
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
  user: CurrentUserShape,
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

  const title = safeText(command.parameters.projectTitle || command.parameters.title, prompt).slice(0, 140);

  const project = await prisma.firmProject.create({
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
    resultSummary: `Created project: ${project.title}`,
    action: { projectId: project.id, href: "/workspace?tab=team-board" },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeWatchlistItem(
  user: CurrentUserShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const symbol = safeTicker(command, prompt) || "NVDA";
  const watchlistName = command.parameters.watchlistName || "AI Command Watchlist";

  const watchlist = await prisma.namedWatchlist.upsert({
    where: {
      userId_name: {
        userId: user.id,
        name: watchlistName,
      },
    },
    update: {
      description: "Updated by Slice AI command.",
    },
    create: {
      userId: user.id,
      name: watchlistName,
      description: "Created by Slice AI command.",
      focus: "AI-selected",
      riskLevel: "Mixed",
    },
  });

  const item = await prisma.namedWatchlistItem.upsert({
    where: {
      watchlistId_symbol: {
        watchlistId: watchlist.id,
        symbol,
      },
    },
    update: {
      status: "Watching",
      priority: command.parameters.priority || "Medium",
    },
    create: {
      userId: user.id,
      watchlistId: watchlist.id,
      symbol,
      assetName: symbol,
      assetType: "Stock",
      sourceType: "Slice AI",
      thesis: command.parameters.detail || "Added by Slice AI command.",
      status: "Watching",
      priority: command.parameters.priority || "Medium",
    },
  });

  return {
    intent: "Watchlist",
    answer: `I added ${item.symbol} to ${watchlist.name}.`,
    clientAction: { type: "navigate", href: "/workspace?tab=watchlists", autoRun: false },
    status: "Complete",
    resultSummary: `Added ${item.symbol} to ${watchlist.name}.`,
    action: { watchlistId: watchlist.id, itemId: item.id, href: "/workspace?tab=watchlists" },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeCreatePriceAlert(
  user: CurrentUserShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const symbol = safeTicker(command, prompt);

  if (!symbol) {
    return {
      intent: "Create Price Alert",
      answer: "I can create a price alert, but I need a ticker symbol.",
      clientAction: { type: "navigate", href: "/watchlist-alerts", autoRun: false },
      status: "Needs Ticker",
      resultSummary: "Price alert requested without ticker.",
      action: { href: "/watchlist-alerts" },
      aiProvider: "Fast/OpenAI",
    };
  }

  const upper = safeNumber(command.parameters.upperTargetPrice);
  const lower = safeNumber(command.parameters.lowerTargetPrice);

  if (upper === null && lower === null) {
    return {
      intent: "Create Price Alert",
      answer: `I can create a ${symbol} price alert, but I need a high target, low target, or both.`,
      clientAction: { type: "navigate", href: "/watchlist-alerts", autoRun: false },
      status: "Needs Target",
      resultSummary: "Price alert requested without target.",
      action: { symbol, href: "/watchlist-alerts" },
      aiProvider: "Fast/OpenAI",
    };
  }

  const alert = await prisma.watchlistPriceAlert.create({
    data: {
      userId: user.id,
      symbol,
      assetName: symbol,
      upperTargetPrice: upper,
      lowerTargetPrice: lower,
      notificationChannel: command.parameters.deliveryChannel || "Dashboard",
      status: "Active",
      notes: command.parameters.detail || "Created by Slice AI command.",
    },
  });

  return {
    intent: "Create Price Alert",
    answer: `Price alert created for ${symbol}${upper !== null ? ` above $${upper}` : ""}${lower !== null ? ` below $${lower}` : ""}.`,
    clientAction: { type: "navigate", href: "/watchlist-alerts", autoRun: false },
    status: "Complete",
    resultSummary: `Created price alert for ${symbol}.`,
    action: { alertId: alert.id, symbol, upper, lower, href: "/watchlist-alerts" },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeDraftEmail(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const ticker = safeTicker(command, prompt);
  const subject = command.parameters.subject || (ticker ? `Advisor update regarding ${ticker}` : "Advisor update");
  const body =
    command.parameters.body ||
    `Draft prepared by Slice AI. Advisor review is required before delivery.\n\nOriginal command: ${prompt}`;

  const draft = await prisma.personalUserBotEmailDraft.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      firmId: profile.firmId,
      targetTicker: ticker,
      recipientJson: asJson(command.parameters.recipient ? [{ email: command.parameters.recipient }] : []),
      subject,
      body,
      status: "Draft",
      deliveryMode: "Approval Required",
      complianceJson: asJson([
        "Advisor approval required before delivery.",
        "No guaranteed outcomes.",
        "Attach source context if client-facing.",
      ]),
    },
  });

  const approval = await createApproval({
    user,
    profile,
    title: `Approve email draft: ${subject}`,
    actionType: "AI Email Draft",
    riskLevel: "High",
    summary: `Slice AI created an approval-gated email draft${ticker ? ` for ${ticker}` : ""}.`,
    payload: { draftId: draft.id, ticker, subject },
  });

  return {
    intent: "Email Draft",
    answer: `I created an approval-gated email draft: ${subject}. It is waiting for advisor approval.`,
    clientAction: { type: "navigate", href: "/workspace/personal-bot", autoRun: false },
    status: "Draft",
    resultSummary: `Created approval-gated email draft: ${subject}`,
    action: { draftId: draft.id, approvalId: approval.id, href: "/workspace/personal-bot" },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeCreateReport(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const token = randomBytes(18).toString("hex");
  const title = command.parameters.reportTitle || command.parameters.title || "Slice AI Investment Report";

  const report = await prisma.personalUserBotPdfReport.create({
    data: {
      userId: user.id,
      profileId: profile.id,
      firmId: profile.firmId,
      title,
      reportType: "AI Generated Report",
      status: "Ready",
      summary: `Generated from Slice AI command: ${prompt}`,
      sectionsJson: asJson([
        {
          title: "Executive Summary",
          body: command.answer || "Slice AI generated a premium advisor report shell.",
        },
        {
          title: "Command",
          body: prompt,
        },
        {
          title: "Compliance Note",
          body: "Advisor review required before client delivery.",
        },
      ]),
      designJson: asJson({
        theme: "Premium dark Slice report",
        quality: "presentation-ready",
      }),
      downloadToken: token,
    },
  });

  const approval = await createApproval({
    user,
    profile,
    title: `Approve report: ${title}`,
    actionType: "AI Report",
    riskLevel: "Medium",
    summary: "Slice AI created a report that should be reviewed before external use.",
    payload: { reportId: report.id, title },
  });

  return {
    intent: "PDF Report",
    answer: `I created a premium report: ${title}. It is ready for review.`,
    clientAction: { type: "source", href: `/api/personal-bot/pdf-report?token=${token}`, autoRun: false },
    status: "Ready",
    resultSummary: `Created report: ${title}`,
    action: { reportId: report.id, approvalId: approval.id, downloadUrl: `/api/personal-bot/pdf-report?token=${token}` },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeAdvisorDay(
  user: CurrentUserShape,
  profile: BotProfileShape
): Promise<CommandExecutionResult> {
  const context = {
    userId: user.id,
    firmId: profile.firmId,
    actorName: user.name,
    actorEmail: user.email,
  };

  const result = await runBackendJob(context, "advisor_day");

  return {
    intent: "Advisor Day",
    answer: "Advisor Day generated through the backend job runner.",
    clientAction: { type: "navigate", href: "/advisor-command-center", autoRun: false },
    status: "Complete",
    resultSummary: "Advisor Day backend job completed.",
    action: { result, href: "/advisor-command-center" },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeBackendJob(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand
): Promise<CommandExecutionResult> {
  const context = {
    userId: user.id,
    firmId: profile.firmId,
    actorName: user.name,
    actorEmail: user.email,
  };

  const jobKey = command.parameters.jobKey || "vendor_health";
  const result = await runBackendJob(context, jobKey);

  return {
    intent: "Backend Job",
    answer: `Backend job completed: ${jobKey}.`,
    clientAction: { type: "navigate", href: "/backend-kernel", autoRun: false },
    status: "Complete",
    resultSummary: `Backend job completed: ${jobKey}`,
    action: { jobKey, result, href: "/backend-kernel" },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeQueueDelivery(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand
): Promise<CommandExecutionResult> {
  const context = {
    userId: user.id,
    firmId: profile.firmId,
    actorName: user.name,
    actorEmail: user.email,
  };

  const channel = command.parameters.deliveryChannel || "Dashboard";

  const delivery = await queueBackendDelivery(context, {
    channel,
    destination: command.parameters.recipient || user.email,
    title: command.parameters.subject || command.parameters.title || "Slice AI Delivery",
    body: command.parameters.body || command.parameters.detail || command.answer || "Slice AI queued this delivery.",
    urgency: command.riskLevel === "Critical" || command.riskLevel === "High" ? "High" : "Medium",
    score: Math.round(command.confidence * 100),
    approvalRequired: command.requiresApproval,
    payload: {
      source: "Slice AI command",
      command,
    },
  });

  return {
    intent: "Queue Delivery",
    answer: `Delivery queued through the backend: ${delivery.title}.`,
    clientAction: { type: "navigate", href: "/backend-kernel", autoRun: false },
    status: delivery.status,
    resultSummary: `Queued delivery: ${delivery.title}`,
    action: { deliveryId: delivery.id, href: "/backend-kernel" },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeApprovalDecision(
  user: CurrentUserShape,
  command: SliceStructuredCommand
): Promise<CommandExecutionResult> {
  const decision = command.parameters.approvalDecision || "approve";

  const backendApproval = await prisma.backendApprovalItem.findFirst({
    where: {
      userId: user.id,
      status: "Pending",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  if (!backendApproval) {
    return {
      intent: "Approval Decision",
      answer: "There are no pending approval items right now.",
      clientAction: { type: "navigate", href: "/backend-readiness", autoRun: false },
      status: "No Pending Approval",
      resultSummary: "No pending approval items.",
      action: {},
      aiProvider: "Fast/OpenAI",
    };
  }

  const status = decision === "reject" ? "Rejected" : "Approved";

  await prisma.backendApprovalItem.update({
    where: {
      id: backendApproval.id,
    },
    data: {
      status,
      approvedBy: user.email,
      decidedAt: new Date(),
      approvalNotes: `Decision made by Slice AI command: ${decision}`,
    },
  });

  return {
    intent: "Approval Decision",
    answer: `${backendApproval.title} has been ${status.toLowerCase()}.`,
    clientAction: { type: "navigate", href: "/backend-readiness", autoRun: false },
    status: "Complete",
    resultSummary: `Approval item ${status.toLowerCase()}: ${backendApproval.title}`,
    action: { approvalId: backendApproval.id, status },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeRemember(
  user: CurrentUserShape,
  profile: BotProfileShape,
  command: SliceStructuredCommand,
  prompt: string
): Promise<CommandExecutionResult> {
  const memoryValue = command.parameters.memory || command.parameters.detail || prompt.replace(/remember/i, "").trim();
  const memoryKey =
    normalize(memoryValue).split(" ").slice(0, 10).join("-").replace(/[^a-z0-9-]/g, "") ||
    `memory-${Date.now()}`;

  const memory = await prisma.personalUserBotMemory.upsert({
    where: {
      userId_memoryKey: {
        userId: user.id,
        memoryKey,
      },
    },
    update: {
      profileId: profile.id,
      firmId: profile.firmId,
      value: memoryValue,
      confidenceScore: 90,
      sourcePrompt: prompt,
      status: "Active",
    },
    create: {
      userId: user.id,
      profileId: profile.id,
      firmId: profile.firmId,
      memoryKey,
      memoryType: "Preference",
      title: memoryValue.slice(0, 100),
      value: memoryValue,
      confidenceScore: 90,
      sourcePrompt: prompt,
      status: "Active",
    },
  });

  return {
    intent: "Memory",
    answer: `I saved this to memory: ${memory.value}`,
    clientAction: { type: "navigate", href: "/workspace/personal-bot", autoRun: false },
    status: "Complete",
    resultSummary: `Saved memory: ${memory.title}`,
    action: { memoryId: memory.id },
    aiProvider: "Fast/OpenAI",
  };
}

async function executeTheme(
  user: CurrentUserShape,
  command: SliceStructuredCommand
): Promise<CommandExecutionResult> {
  const color = normalize(command.parameters.color || "");

  const presets: Record<string, { name: string; accentHex: string; accentDarkHex: string; accentSoftHex: string }> = {
    red: { name: "Slice Red", accentHex: "#dc2626", accentDarkHex: "#7f1d1d", accentSoftHex: "#fee2e2" },
    blue: { name: "Advisor Blue", accentHex: "#2563eb", accentDarkHex: "#1e3a8a", accentSoftHex: "#dbeafe" },
    green: { name: "Wealth Green", accentHex: "#059669", accentDarkHex: "#064e3b", accentSoftHex: "#d1fae5" },
    purple: { name: "Adaptive Purple", accentHex: "#7c3aed", accentDarkHex: "#4c1d95", accentSoftHex: "#ede9fe" },
    gold: { name: "Premium Gold", accentHex: "#d97706", accentDarkHex: "#78350f", accentSoftHex: "#fef3c7" },
    mint: { name: "Mint Intelligence", accentHex: "#10b981", accentDarkHex: "#064e3b", accentSoftHex: "#ccfbf1" },
  };

  const selected = presets[color] || presets.red;

  await prisma.personalUserUiPreference.upsert({
    where: {
      userId: user.id,
    },
    update: {
      ...selected,
      preferenceSource: "Fast Bot Command",
    },
    create: {
      userId: user.id,
      ...selected,
      backgroundStyle: "Premium Dark",
      preferenceSource: "Fast Bot Command",
    },
  });

  return {
    intent: "Theme",
    answer: `I changed your personal color scheme to ${selected.name}.`,
    clientAction: { type: "theme", autoRun: true },
    status: "Complete",
    resultSummary: `Updated theme to ${selected.name}`,
    action: selected,
    aiProvider: "Fast/OpenAI",
  };
}

async function executeHelp(profile: BotProfileShape): Promise<CommandExecutionResult> {
  return {
    intent: "Help",
    answer:
      `${profile.botName} can navigate the platform, run research, find sources, search firm data, sort opportunities, create tasks, create clients, create projects, add watchlist items, create price alerts, draft approval-gated emails, create reports, run backend jobs, generate Advisor Day, approve/reject pending items, remember preferences, change themes, and answer platform questions. Common commands now run through the fast local router before OpenAI, so commands like "Open market visuals" or "Run vendor health" should feel much faster.`,
    clientAction: { type: "navigate", href: "/workspace/personal-bot", autoRun: false },
    status: "Complete",
    resultSummary: "Displayed help capabilities.",
    action: {},
    aiProvider: "Fast Local Router",
  };
}

async function executeAnswer(
  user: CurrentUserShape,
  profile: BotProfileShape,
  prompt: string,
  command: SliceStructuredCommand,
  aiProvider: string
): Promise<CommandExecutionResult> {
  const ai = await generateAiText({
    safetyIdentifier: user.email,
    instructions: `
You are ${profile.botName}, the AI command center for Slice.
You are precise, fintech-aware, source-conscious, and compliance-aware.
Keep answers useful and action-oriented.
Do not make guaranteed investment recommendations.
If a platform route or backend action is relevant, suggest it clearly.
`,
    prompt,
  });

  return {
    intent: "Answer",
    answer: ai.ok && ai.text ? ai.text : command.answer || fallbackSliceCommand(prompt).answer,
    clientAction: {},
    status: ai.ok ? "Complete" : "Fallback",
    resultSummary: ai.ok ? "Answered with OpenAI." : `Answered with fallback: ${ai.error ?? aiProvider}`,
    action: { aiProvider, aiStatus: ai.status, error: ai.error },
    aiProvider,
  };
}

export async function executePersonalBotCommand(input: {
  user: CurrentUserShape;
  profile: BotProfileShape;
  prompt: string;
  voiceTranscript?: string | null;
}) {
  const { user, profile, prompt } = input;

  await ensurePlatformBrain(user.id, profile.firmId);

  const [firmName, memories, platformBrain, openTasks, unreadAlerts, clients] = await Promise.all([
    getFirmName(profile.firmId),
    prisma.personalUserBotMemory.findMany({
      where: {
        userId: user.id,
        status: "Active",
      },
      orderBy: { updatedAt: "desc" },
      take: 12,
    }),
    getPlatformBrainContext(user.id),
    prisma.meetingTask.count({
      where: {
        userId: user.id,
        status: { not: "Complete" },
      },
    }),
    prisma.alertEvent.count({
      where: {
        userId: user.id,
        status: "Unread",
      },
    }),
    prisma.clientProfile.count({
      where: { userId: user.id },
    }),
  ]);

  const fastMatch = matchFastCommand({
    prompt,
    platformBrain,
  });

  const parsed =
    fastMatch && fastMatch.confidence >= 0.82
      ? {
          ok: true,
          provider: `Fast Local Router · ${fastMatch.reason}`,
          command: fastMatch.command,
          error: undefined,
        }
      : await parseSliceCommandWithAi({
          prompt,
          userName: user.name,
          userEmail: user.email,
          firmName,
          botName: profile.botName,
          memory: memories.map((memory) => `${memory.title}: ${memory.value}`),
          openTasks,
          unreadAlerts,
          clients,
          platformBrain,
          voiceTranscript: input.voiceTranscript,
        });

  const command = parsed.command;
  let result: CommandExecutionResult;

  try {
    if (command.intent === "navigate") result = await executeNavigate(command);
    else if (command.intent === "source_lookup") result = await executeSourceLookup(user, profile, command, prompt);
    else if (command.intent === "platform_search") result = await executePlatformSearch(user, profile, command, prompt);
    else if (command.intent === "research") result = await executeResearch(user, profile, command, prompt);
    else if (command.intent === "sort_data") result = await executePlatformSearch(user, profile, command, prompt);
    else if (command.intent === "create_task") result = await executeCreateTask(user, profile, command, prompt);
    else if (command.intent === "create_client") result = await executeCreateClient(user, command);
    else if (command.intent === "create_project") result = await executeCreateProject(user, profile, command, prompt);
    else if (command.intent === "create_watchlist_item") result = await executeWatchlistItem(user, command, prompt);
    else if (command.intent === "create_price_alert") result = await executeCreatePriceAlert(user, command, prompt);
    else if (command.intent === "draft_email") result = await executeDraftEmail(user, profile, command, prompt);
    else if (command.intent === "create_report") result = await executeCreateReport(user, profile, command, prompt);
    else if (command.intent === "advisor_day") result = await executeAdvisorDay(user, profile);
    else if (command.intent === "backend_job") result = await executeBackendJob(user, profile, command);
    else if (command.intent === "queue_delivery") result = await executeQueueDelivery(user, profile, command);
    else if (command.intent === "approval_decision") result = await executeApprovalDecision(user, command);
    else if (command.intent === "remember") result = await executeRemember(user, profile, command, prompt);
    else if (command.intent === "theme") result = await executeTheme(user, command);
    else if (command.intent === "help") result = await executeHelp(profile);
    else result = await executeAnswer(user, profile, prompt, command, parsed.provider);
  } catch (error) {
    result = {
      intent: command.intent,
      answer: `I understood the command, but the backend tool failed: ${error instanceof Error ? error.message : "Unknown error"}`,
      clientAction: { type: "navigate", href: "/backend-kernel", autoRun: false },
      status: "Failed",
      resultSummary: error instanceof Error ? error.message : "Tool failed.",
      action: { error: error instanceof Error ? error.message : "Tool failed.", command },
      aiProvider: parsed.provider,
    };
  }

  const commandRecord = await createBotCommandRecord({
    userId: user.id,
    profileId: profile.id,
    firmId: profile.firmId,
    commandText: prompt,
    commandType: result.intent,
    status: result.status,
    resultSummary: result.resultSummary,
    action: {
      ...result.action,
      structuredCommand: command,
      aiProvider: parsed.provider,
      aiParserOk: parsed.ok,
      aiError: parsed.error,
      fastRouterUsed: Boolean(fastMatch && fastMatch.confidence >= 0.82),
      fastRouterReason: fastMatch?.reason,
      fastRouterConfidence: fastMatch?.confidence,
    },
  });

  await recordTrainingPhrase({
    userId: user.id,
    profileId: profile.id,
    firmId: profile.firmId,
    phrase: prompt,
    targetIntent: command.intent,
    targetRoute: command.route,
    parameters: command.parameters,
  });

  await recordAiToolRun(
    {
      userId: user.id,
      firmId: profile.firmId,
      actorName: user.name,
      actorEmail: user.email,
    },
    {
      toolKey: command.intent,
      toolName: result.intent,
      input: {
        prompt,
        structuredCommand: command,
        fastRouterUsed: Boolean(fastMatch && fastMatch.confidence >= 0.82),
      },
      output: {
        status: result.status,
        resultSummary: result.resultSummary,
        action: result.action,
      },
      status: result.status,
    }
  );

  return {
    ...result,
    commandRecord,
    structuredCommand: command,
    aiParserOk: parsed.ok,
    aiParserError: parsed.error,
    fastRouterUsed: Boolean(fastMatch && fastMatch.confidence >= 0.82),
    fastRouterReason: fastMatch?.reason,
    fastRouterConfidence: fastMatch?.confidence,
  };
}