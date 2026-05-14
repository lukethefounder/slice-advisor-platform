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

function safeMoney(value: string | null | undefined) {
  if (!value) return 0;

  const clean = value.replace(/[^0-9.-]/g, "");
  const number = Number(clean);

  return Number.isFinite(number) ? number : 0;
}

function scorePriority(score: number) {
  if (score >= 90) return "Critical";
  if (score >= 80) return "High";
  if (score >= 65) return "Medium";
  return "Low";
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

async function createProofTrail(input: {
  userId: string;
  firmId: string | null;
  dedupeKey: string;
  actionType: string;
  subject: string;
  summary: string;
  sourceType?: string | null;
  sourceId?: string | null;
  sourceTitle?: string | null;
  sourceUrl?: string | null;
  clientId?: string | null;
  clientName?: string | null;
  aiReasoning: string;
  riskLevel?: string;
  evidence?: unknown[];
}) {
  return prisma.complianceProofTrail.upsert({
    where: {
      userId_dedupeKey: {
        userId: input.userId,
        dedupeKey: input.dedupeKey,
      },
    },
    update: {
      firmId: input.firmId ?? undefined,
      actionType: input.actionType,
      subject: input.subject,
      summary: input.summary,
      sourceType: input.sourceType ?? undefined,
      sourceId: input.sourceId ?? undefined,
      sourceTitle: input.sourceTitle ?? undefined,
      sourceUrl: input.sourceUrl ?? undefined,
      clientId: input.clientId ?? undefined,
      clientName: input.clientName ?? undefined,
      aiReasoning: input.aiReasoning,
      riskLevel: input.riskLevel ?? "Medium",
      evidenceJson: asJson(input.evidence ?? []),
      humanStatus: "Needs Review",
    },
    create: {
      userId: input.userId,
      firmId: input.firmId,
      dedupeKey: input.dedupeKey,
      actionType: input.actionType,
      subject: input.subject,
      summary: input.summary,
      sourceType: input.sourceType,
      sourceId: input.sourceId,
      sourceTitle: input.sourceTitle,
      sourceUrl: input.sourceUrl,
      clientId: input.clientId,
      clientName: input.clientName,
      aiReasoning: input.aiReasoning,
      riskLevel: input.riskLevel ?? "Medium",
      evidenceJson: asJson(input.evidence ?? []),
      humanStatus: "Needs Review",
    },
  });
}

async function buildClientBrains(userId: string, firmId: string | null) {
  const clients = await prisma.clientProfile.findMany({
    where: {
      userId,
    },
    include: {
      holdings: true,
      notesList: {
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
      },
      tasks: {
        orderBy: {
          createdAt: "desc",
        },
        take: 8,
      },
      documents: {
        orderBy: {
          createdAt: "desc",
        },
        take: 5,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  const saved = [];

  for (const client of clients) {
    const totalValue = client.holdings.reduce(
      (sum, holding) => sum + safeMoney(holding.value),
      0
    );

    const largestHolding = [...client.holdings].sort(
      (a, b) => safeMoney(b.value) - safeMoney(a.value)
    )[0];

    const largestPct =
      totalValue > 0 && largestHolding
        ? Math.round((safeMoney(largestHolding.value) / totalValue) * 100)
        : 0;

    const openTasks = client.tasks.filter((task) => task.status !== "Complete");
    const latestInteraction =
      client.notesList[0]?.createdAt ??
      client.tasks[0]?.createdAt ??
      client.documents[0]?.createdAt ??
      client.createdAt;

    const tags = [
      client.riskProfile,
      client.liquidityNeeds,
      client.timeHorizon,
      largestPct >= 25 ? "Concentration Risk" : null,
      !client.email ? "Missing Email" : null,
      openTasks.length ? "Open Follow-Up" : null,
    ].filter(Boolean);

    const communicationStyle = client.notes?.toLowerCase().includes("short")
      ? "Brief, direct, plain English"
      : client.notes?.toLowerCase().includes("detail")
        ? "Detailed, context-rich, advisor-led"
        : "Clear, professional, plain English";

    const score = Math.max(
      40,
      Math.min(
        100,
        70 +
          (largestPct >= 25 ? 12 : 0) +
          (openTasks.length ? 8 : 0) +
          (!client.email ? -8 : 0)
      )
    );

    const portfolioSummary =
      client.holdings.length > 0
        ? `${client.fullName} has ${client.holdings.length} tracked holding(s), ${
            totalValue ? `approximately $${Math.round(totalValue).toLocaleString()} in tracked value, ` : ""
          }with largest tracked exposure ${
            largestHolding ? `${largestHolding.symbol} at ${largestPct}%` : "not available"
          }.`
        : `${client.fullName} does not have tracked holdings yet.`;

    const riskPulse =
      largestPct >= 25
        ? `Potential concentration risk: ${largestHolding?.symbol ?? "largest position"} is approximately ${largestPct}% of tracked value.`
        : `${client.riskProfile} risk profile with no major tracked concentration flag.`;

    const opportunityPulse =
      client.holdings.length > 0
        ? `Monitor news and alerts tied to ${client.holdings
            .slice(0, 4)
            .map((holding) => holding.symbol)
            .join(", ")}.`
        : "Add holdings to unlock portfolio-aware opportunities.";

    const nextAction = !client.email
      ? "Add client email so communication drafts and alert workflows can be routed."
      : openTasks.length
        ? `Review ${openTasks.length} open client task(s).`
        : largestPct >= 25
          ? `Review concentration exposure in ${largestHolding?.symbol}.`
          : "Schedule the next portfolio review or update client notes.";

    const brain = await prisma.clientBrainProfile.upsert({
      where: {
        userId_clientId: {
          userId,
          clientId: client.id,
        },
      },
      update: {
        firmId,
        clientName: client.fullName,
        householdName: client.householdName,
        riskProfile: client.riskProfile,
        communicationStyle,
        preferredTone: communicationStyle,
        portfolioSummary,
        riskPulse,
        opportunityPulse,
        nextAction,
        keyFactsJson: asJson([
          `Client type: ${client.clientType}`,
          `Risk profile: ${client.riskProfile}`,
          `Liquidity needs: ${client.liquidityNeeds}`,
          `Time horizon: ${client.timeHorizon}`,
          `Objective: ${client.objective}`,
        ]),
        holdingsJson: asJson(client.holdings),
        notesJson: asJson(client.notesList),
        tagsJson: asJson(tags),
        score,
        status: client.status,
        lastInteractionAt: latestInteraction,
      },
      create: {
        userId,
        firmId,
        clientId: client.id,
        clientName: client.fullName,
        householdName: client.householdName,
        riskProfile: client.riskProfile,
        communicationStyle,
        preferredTone: communicationStyle,
        portfolioSummary,
        riskPulse,
        opportunityPulse,
        nextAction,
        keyFactsJson: asJson([
          `Client type: ${client.clientType}`,
          `Risk profile: ${client.riskProfile}`,
          `Liquidity needs: ${client.liquidityNeeds}`,
          `Time horizon: ${client.timeHorizon}`,
          `Objective: ${client.objective}`,
        ]),
        holdingsJson: asJson(client.holdings),
        notesJson: asJson(client.notesList),
        tagsJson: asJson(tags),
        score,
        status: client.status,
        lastInteractionAt: latestInteraction,
      },
    });

    await prisma.firmKnowledgeEntry.upsert({
      where: {
        userId_entryKey: {
          userId,
          entryKey: `client-brain:${client.id}`,
        },
      },
      update: {
        firmId,
        title: `Client Brain: ${client.fullName}`,
        category: "Client Brain",
        body: `${portfolioSummary}\n${riskPulse}\n${opportunityPulse}\nNext action: ${nextAction}`,
        sourceType: "ClientProfile",
        sourceId: client.id,
        tagsJson: asJson(tags),
        score,
      },
      create: {
        userId,
        firmId,
        entryKey: `client-brain:${client.id}`,
        title: `Client Brain: ${client.fullName}`,
        category: "Client Brain",
        body: `${portfolioSummary}\n${riskPulse}\n${opportunityPulse}\nNext action: ${nextAction}`,
        sourceType: "ClientProfile",
        sourceId: client.id,
        tagsJson: asJson(tags),
        score,
      },
    });

    saved.push(brain);
  }

  await createProofTrail({
    userId,
    firmId,
    dedupeKey: `client-brains:${new Date().toISOString().slice(0, 10)}`,
    actionType: "Client Brain Refresh",
    subject: "Client Brain refresh",
    summary: `Generated or updated ${saved.length} client brain profile(s).`,
    aiReasoning:
      "The AI reviewed client profiles, holdings, open tasks, notes, and communication metadata to create advisor-ready client intelligence.",
    riskLevel: "Low",
    evidence: saved.map((brain) => ({
      clientId: brain.clientId,
      clientName: brain.clientName,
      score: brain.score,
    })),
  });

  return saved;
}

async function generateNextBestActions(userId: string, firmId: string | null) {
  const [alerts, opportunities, tasks, brains, emailDrafts] = await Promise.all([
    prisma.alertEvent.findMany({
      where: {
        userId,
        status: "Unread",
      },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
    prisma.opportunitySignal.findMany({
      where: {
        userId,
        status: "Open",
      },
      orderBy: [{ compositeScore: "desc" }, { createdAt: "desc" }],
      take: 10,
    }),
    prisma.meetingTask.findMany({
      where: {
        userId,
        status: {
          not: "Complete",
        },
      },
      orderBy: [{ dueDate: "asc" }, { createdAt: "desc" }],
      take: 10,
    }),
    prisma.clientBrainProfile.findMany({
      where: {
        userId,
        status: "Active",
      },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
      take: 10,
    }),
    prisma.personalUserBotEmailDraft.findMany({
      where: {
        userId,
        status: "Draft",
      },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const created = [];

  for (const alert of alerts.slice(0, 5)) {
    const action = await prisma.nextBestAction.upsert({
      where: {
        userId_dedupeKey: {
          userId,
          dedupeKey: `alert:${alert.id}`,
        },
      },
      update: {
        firmId,
        title: `Review alert: ${alert.title}`,
        actionType: "Alert Review",
        priority: scorePriority(alert.score),
        score: alert.score,
        sourceType: "AlertEvent",
        sourceId: alert.id,
        sourceTitle: alert.title,
        sourceUrl: alert.sourceUrl,
        reason: alert.aiBriefing ?? alert.body,
        recommendedCommand: `source for ${alert.ticker ?? alert.title}`,
        evidenceJson: asJson([
          {
            source: alert.source,
            urgency: alert.urgency,
            score: alert.score,
            ticker: alert.ticker,
          },
        ]),
      },
      create: {
        userId,
        firmId,
        dedupeKey: `alert:${alert.id}`,
        title: `Review alert: ${alert.title}`,
        actionType: "Alert Review",
        priority: scorePriority(alert.score),
        score: alert.score,
        sourceType: "AlertEvent",
        sourceId: alert.id,
        sourceTitle: alert.title,
        sourceUrl: alert.sourceUrl,
        reason: alert.aiBriefing ?? alert.body,
        recommendedCommand: `source for ${alert.ticker ?? alert.title}`,
        evidenceJson: asJson([
          {
            source: alert.source,
            urgency: alert.urgency,
            score: alert.score,
            ticker: alert.ticker,
          },
        ]),
      },
    });

    created.push(action);
  }

  for (const signal of opportunities.slice(0, 5)) {
    const action = await prisma.nextBestAction.upsert({
      where: {
        userId_dedupeKey: {
          userId,
          dedupeKey: `opportunity:${signal.id}`,
        },
      },
      update: {
        firmId,
        title: `Assess opportunity: ${signal.title}`,
        actionType: "Opportunity Review",
        priority: scorePriority(signal.compositeScore),
        score: signal.compositeScore,
        sourceType: "OpportunitySignal",
        sourceId: signal.id,
        sourceTitle: signal.title,
        reason: signal.summary ?? signal.suggestedAction,
        recommendedCommand: `create report for ${signal.title}`,
        evidenceJson: signal.evidenceJson,
      },
      create: {
        userId,
        firmId,
        dedupeKey: `opportunity:${signal.id}`,
        title: `Assess opportunity: ${signal.title}`,
        actionType: "Opportunity Review",
        priority: scorePriority(signal.compositeScore),
        score: signal.compositeScore,
        sourceType: "OpportunitySignal",
        sourceId: signal.id,
        sourceTitle: signal.title,
        reason: signal.summary ?? signal.suggestedAction,
        recommendedCommand: `create report for ${signal.title}`,
        evidenceJson: signal.evidenceJson,
      },
    });

    created.push(action);
  }

  for (const task of tasks.slice(0, 5)) {
    const action = await prisma.nextBestAction.upsert({
      where: {
        userId_dedupeKey: {
          userId,
          dedupeKey: `task:${task.id}`,
        },
      },
      update: {
        firmId,
        title: `Complete task: ${task.title}`,
        actionType: "Task Follow-Up",
        priority: task.priority,
        score: task.priority === "High" ? 82 : 65,
        clientId: task.clientId,
        reason: task.description ?? "Open task requires advisor follow-up.",
        recommendedCommand: `complete task ${task.title}`,
        dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
        evidenceJson: asJson([{ status: task.status, priority: task.priority }]),
      },
      create: {
        userId,
        firmId,
        dedupeKey: `task:${task.id}`,
        title: `Complete task: ${task.title}`,
        actionType: "Task Follow-Up",
        priority: task.priority,
        score: task.priority === "High" ? 82 : 65,
        clientId: task.clientId,
        reason: task.description ?? "Open task requires advisor follow-up.",
        recommendedCommand: `complete task ${task.title}`,
        dueDate: task.dueDate ? task.dueDate.toISOString().slice(0, 10) : null,
        evidenceJson: asJson([{ status: task.status, priority: task.priority }]),
      },
    });

    created.push(action);
  }

  for (const brain of brains.slice(0, 5)) {
    const action = await prisma.nextBestAction.upsert({
      where: {
        userId_dedupeKey: {
          userId,
          dedupeKey: `client-brain:${brain.clientId}`,
        },
      },
      update: {
        firmId,
        title: `Client action: ${brain.clientName}`,
        actionType: "Client Follow-Up",
        priority: scorePriority(brain.score),
        score: brain.score,
        clientId: brain.clientId,
        clientName: brain.clientName,
        sourceType: "ClientBrainProfile",
        sourceId: brain.id,
        sourceTitle: brain.clientName,
        reason: brain.nextAction,
        recommendedCommand: `prepare client briefing for ${brain.clientName}`,
        evidenceJson: asJson([
          {
            riskPulse: brain.riskPulse,
            opportunityPulse: brain.opportunityPulse,
          },
        ]),
      },
      create: {
        userId,
        firmId,
        dedupeKey: `client-brain:${brain.clientId}`,
        title: `Client action: ${brain.clientName}`,
        actionType: "Client Follow-Up",
        priority: scorePriority(brain.score),
        score: brain.score,
        clientId: brain.clientId,
        clientName: brain.clientName,
        sourceType: "ClientBrainProfile",
        sourceId: brain.id,
        sourceTitle: brain.clientName,
        reason: brain.nextAction,
        recommendedCommand: `prepare client briefing for ${brain.clientName}`,
        evidenceJson: asJson([
          {
            riskPulse: brain.riskPulse,
            opportunityPulse: brain.opportunityPulse,
          },
        ]),
      },
    });

    created.push(action);
  }

  for (const draft of emailDrafts.slice(0, 5)) {
    const action = await prisma.nextBestAction.upsert({
      where: {
        userId_dedupeKey: {
          userId,
          dedupeKey: `email-draft:${draft.id}`,
        },
      },
      update: {
        firmId,
        title: `Approve draft: ${draft.subject}`,
        actionType: "Communication Approval",
        priority: "High",
        score: 84,
        sourceType: "PersonalUserBotEmailDraft",
        sourceId: draft.id,
        sourceTitle: draft.subject,
        reason: "Client-facing communication draft is waiting for review.",
        recommendedCommand: "approve latest",
        evidenceJson: asJson([
          {
            targetTicker: draft.targetTicker,
            deliveryMode: draft.deliveryMode,
          },
        ]),
      },
      create: {
        userId,
        firmId,
        dedupeKey: `email-draft:${draft.id}`,
        title: `Approve draft: ${draft.subject}`,
        actionType: "Communication Approval",
        priority: "High",
        score: 84,
        sourceType: "PersonalUserBotEmailDraft",
        sourceId: draft.id,
        sourceTitle: draft.subject,
        reason: "Client-facing communication draft is waiting for review.",
        recommendedCommand: "approve latest",
        evidenceJson: asJson([
          {
            targetTicker: draft.targetTicker,
            deliveryMode: draft.deliveryMode,
          },
        ]),
      },
    });

    created.push(action);
  }

  await createProofTrail({
    userId,
    firmId,
    dedupeKey: `next-best-actions:${new Date().toISOString().slice(0, 10)}`,
    actionType: "Next Best Action Refresh",
    subject: "Next best action generation",
    summary: `Generated or updated ${created.length} action recommendation(s).`,
    aiReasoning:
      "The AI reviewed unread alerts, opportunity signals, open tasks, client brain profiles, and communication drafts to prioritize advisor work.",
    riskLevel: "Medium",
    evidence: created.map((action) => ({
      id: action.id,
      title: action.title,
      score: action.score,
      priority: action.priority,
    })),
  });

  return created.sort((a, b) => b.score - a.score);
}

async function rebuildKnowledgeIndex(userId: string, firmId: string | null) {
  const [clients, notes, tasks, alerts, opportunities, research, briefings] =
    await Promise.all([
      prisma.clientProfile.findMany({
        where: { userId },
        take: 100,
      }),
      prisma.advisorNote.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.meetingTask.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.alertEvent.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.opportunitySignal.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.researchNote.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
      prisma.briefingReport.findMany({
        where: { userId },
        orderBy: { createdAt: "desc" },
        take: 100,
      }),
    ]);

  const entries = [
    ...clients.map((client) => ({
      key: `client:${client.id}`,
      title: `Client: ${client.fullName}`,
      category: "Client",
      body: `${client.fullName} ${client.householdName ?? ""} ${client.riskProfile} ${client.objective} ${client.notes ?? ""}`,
      sourceType: "ClientProfile",
      sourceId: client.id,
      sourceUrl: null,
      tags: [client.riskProfile, client.clientType, client.status],
      score: 70,
    })),
    ...notes.map((note) => ({
      key: `note:${note.id}`,
      title: note.title,
      category: "Advisor Note",
      body: note.body,
      sourceType: "AdvisorNote",
      sourceId: note.id,
      sourceUrl: null,
      tags: [note.noteType],
      score: 60,
    })),
    ...tasks.map((task) => ({
      key: `task:${task.id}`,
      title: task.title,
      category: "Task",
      body: `${task.title} ${task.description ?? ""} ${task.priority} ${task.status}`,
      sourceType: "MeetingTask",
      sourceId: task.id,
      sourceUrl: null,
      tags: [task.priority, task.status],
      score: task.priority === "High" ? 80 : 55,
    })),
    ...alerts.map((alert) => ({
      key: `alert:${alert.id}`,
      title: alert.title,
      category: "Alert",
      body: `${alert.title} ${alert.body} ${alert.aiBriefing ?? ""} ${alert.ticker ?? ""} ${alert.source}`,
      sourceType: "AlertEvent",
      sourceId: alert.id,
      sourceUrl: alert.sourceUrl,
      tags: [alert.urgency, alert.ticker, alert.source].filter(Boolean),
      score: alert.score,
    })),
    ...opportunities.map((signal) => ({
      key: `opportunity:${signal.id}`,
      title: signal.title,
      category: "Opportunity",
      body: `${signal.title} ${signal.summary ?? ""} ${signal.suggestedAction} ${signal.sourceName} ${signal.tickersJson}`,
      sourceType: "OpportunitySignal",
      sourceId: signal.id,
      sourceUrl: null,
      tags: parseJson<string[]>(signal.categoriesJson, []),
      score: signal.compositeScore,
    })),
    ...research.map((item) => ({
      key: `research:${item.id}`,
      title: item.title,
      category: "Research",
      body: `${item.title} ${item.thesis} ${item.risks ?? ""} ${item.ticker ?? ""}`,
      sourceType: "ResearchNote",
      sourceId: item.id,
      sourceUrl: null,
      tags: [item.ticker, item.decision, item.conviction].filter(Boolean),
      score: item.conviction === "High" ? 82 : 62,
    })),
    ...briefings.map((briefing) => ({
      key: `briefing:${briefing.id}`,
      title: briefing.title,
      category: "Briefing",
      body: `${briefing.title} ${briefing.executiveSummary} ${briefing.marketSummary} ${briefing.alertSummary} ${briefing.portfolioSummary}`,
      sourceType: "BriefingReport",
      sourceId: briefing.id,
      sourceUrl: null,
      tags: [briefing.audience, briefing.briefType, briefing.status],
      score: 65,
    })),
  ];

  for (const entry of entries) {
    await prisma.firmKnowledgeEntry.upsert({
      where: {
        userId_entryKey: {
          userId,
          entryKey: entry.key,
        },
      },
      update: {
        firmId,
        title: entry.title,
        category: entry.category,
        body: entry.body,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        sourceUrl: entry.sourceUrl,
        tagsJson: asJson(entry.tags),
        score: entry.score,
      },
      create: {
        userId,
        firmId,
        entryKey: entry.key,
        title: entry.title,
        category: entry.category,
        body: entry.body,
        sourceType: entry.sourceType,
        sourceId: entry.sourceId,
        sourceUrl: entry.sourceUrl,
        tagsJson: asJson(entry.tags),
        score: entry.score,
      },
    });
  }

  return entries.length;
}

async function searchFirm(userId: string, firmId: string | null, query: string) {
  const cleanQuery = query.trim();

  if (!cleanQuery) return [];

  await rebuildKnowledgeIndex(userId, firmId);

  const entries = await prisma.firmKnowledgeEntry.findMany({
    where: {
      userId,
      OR: [
        { title: { contains: cleanQuery } },
        { body: { contains: cleanQuery } },
        { category: { contains: cleanQuery } },
        { tagsJson: { contains: cleanQuery } },
      ],
    },
    orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
    take: 25,
  });

  return entries;
}

async function generateAdvisorDay(userId: string, firmId: string | null) {
  const [brains, actions] = await Promise.all([
    buildClientBrains(userId, firmId),
    generateNextBestActions(userId, firmId),
  ]);

  const metrics = {
    clientBrains: brains.length,
    nextBestActions: actions.length,
    criticalActions: actions.filter((action) => action.priority === "Critical").length,
    highActions: actions.filter((action) => action.priority === "High").length,
  };

  const topActions = actions.slice(0, 8);

  const summary =
    topActions.length > 0
      ? `Slice generated your Advisor Day with ${topActions.length} prioritized action(s). Your top item is: ${topActions[0].title}.`
      : "Slice generated your Advisor Day. No urgent actions were found yet; run triage and opportunity radar for more signal coverage.";

  const brief = await prisma.advisorDayBrief.create({
    data: {
      userId,
      firmId,
      title: `Advisor Day · ${new Date().toLocaleDateString()}`,
      summary,
      topActionsJson: asJson(topActions),
      metricsJson: asJson(metrics),
      status: "Generated",
    },
  });

  await createProofTrail({
    userId,
    firmId,
    dedupeKey: `advisor-day:${brief.id}`,
    actionType: "Advisor Day",
    subject: brief.title,
    summary,
    sourceType: "AdvisorDayBrief",
    sourceId: brief.id,
    aiReasoning:
      "The AI created an advisor operating brief by refreshing client brain profiles and next-best-action recommendations.",
    riskLevel: "Low",
    evidence: [
      {
        metrics,
        topActionCount: topActions.length,
      },
    ],
  });

  return brief;
}

async function loadCommandCenter(userId: string) {
  const firmId = await resolveFirmId(userId);

  const [
    clientBrains,
    nextBestActions,
    proofTrails,
    knowledgeEntries,
    advisorDayBriefs,
    rawCounts,
  ] = await Promise.all([
    prisma.clientBrainProfile.findMany({
      where: {
        userId,
      },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
      take: 40,
    }),
    prisma.nextBestAction.findMany({
      where: {
        userId,
      },
      orderBy: [{ status: "asc" }, { score: "desc" }, { updatedAt: "desc" }],
      take: 40,
    }),
    prisma.complianceProofTrail.findMany({
      where: {
        userId,
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.firmKnowledgeEntry.findMany({
      where: {
        userId,
      },
      orderBy: [{ score: "desc" }, { updatedAt: "desc" }],
      take: 40,
    }),
    prisma.advisorDayBrief.findMany({
      where: {
        userId,
      },
      orderBy: { createdAt: "desc" },
      take: 15,
    }),
    Promise.all([
      prisma.clientProfile.count({ where: { userId } }),
      prisma.alertEvent.count({ where: { userId, status: "Unread" } }),
      prisma.opportunitySignal.count({ where: { userId, status: "Open" } }),
      prisma.meetingTask.count({ where: { userId, status: { not: "Complete" } } }),
      prisma.personalUserBotEmailDraft.count({ where: { userId, status: "Draft" } }),
    ]),
  ]);

  const [clientCount, unreadAlerts, openSignals, openTasks, draftEmails] = rawCounts;

  return {
    firmId,
    metrics: {
      clientCount,
      unreadAlerts,
      openSignals,
      openTasks,
      draftEmails,
      clientBrains: clientBrains.length,
      nextBestActions: nextBestActions.filter((action) => action.status === "Open").length,
      proofTrails: proofTrails.length,
      knowledgeEntries: knowledgeEntries.length,
      advisorDayBriefs: advisorDayBriefs.length,
    },
    clientBrains: clientBrains.map((brain) => ({
      ...brain,
      keyFacts: parseJson<string[]>(brain.keyFactsJson, []),
      holdings: parseJson<Array<Record<string, unknown>>>(brain.holdingsJson, []),
      notes: parseJson<Array<Record<string, unknown>>>(brain.notesJson, []),
      tags: parseJson<string[]>(brain.tagsJson, []),
    })),
    nextBestActions: nextBestActions.map((action) => ({
      ...action,
      evidence: parseJson<Array<Record<string, unknown>>>(action.evidenceJson, []),
    })),
    proofTrails: proofTrails.map((proof) => ({
      ...proof,
      evidence: parseJson<Array<Record<string, unknown>>>(proof.evidenceJson, []),
      approval: parseJson<Record<string, unknown>>(proof.approvalJson, {}),
    })),
    knowledgeEntries: knowledgeEntries.map((entry) => ({
      ...entry,
      tags: parseJson<string[]>(entry.tagsJson, []),
    })),
    advisorDayBriefs: advisorDayBriefs.map((brief) => ({
      ...brief,
      topActions: parseJson<Array<Record<string, unknown>>>(brief.topActionsJson, []),
      metrics: parseJson<Record<string, unknown>>(brief.metricsJson, {}),
    })),
  };
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(await loadCommandCenter(user.id));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const firmId = await resolveFirmId(user.id);
  const body = await request.json().catch(() => ({}));
  const action = readText(body.action);

  if (action === "buildClientBrains") {
    const result = await buildClientBrains(user.id, firmId);
    return NextResponse.json({
      ...(await loadCommandCenter(user.id)),
      message: `Updated ${result.length} client brain profile(s).`,
    });
  }

  if (action === "generateNextBestActions") {
    const result = await generateNextBestActions(user.id, firmId);
    return NextResponse.json({
      ...(await loadCommandCenter(user.id)),
      message: `Generated or updated ${result.length} next-best-action item(s).`,
    });
  }

  if (action === "advisorDay") {
    const result = await generateAdvisorDay(user.id, firmId);
    return NextResponse.json({
      ...(await loadCommandCenter(user.id)),
      message: `Generated Advisor Day: ${result.title}.`,
    });
  }

  if (action === "rebuildKnowledge") {
    const count = await rebuildKnowledgeIndex(user.id, firmId);
    return NextResponse.json({
      ...(await loadCommandCenter(user.id)),
      message: `Rebuilt Ask-the-Firm index with ${count} item(s).`,
    });
  }

  if (action === "searchFirm") {
    const query = readText(body.query);
    const results = await searchFirm(user.id, firmId, query);

    return NextResponse.json({
      ...(await loadCommandCenter(user.id)),
      searchQuery: query,
      searchResults: results.map((entry) => ({
        ...entry,
        tags: parseJson<string[]>(entry.tagsJson, []),
      })),
      message: `Found ${results.length} result(s) for "${query}".`,
    });
  }

  if (action === "completeAction") {
    const actionId = readText(body.actionId);

    if (!actionId) {
      return NextResponse.json({ error: "Action ID is required." }, { status: 400 });
    }

    await prisma.nextBestAction.update({
      where: {
        id: actionId,
      },
      data: {
        status: "Complete",
        completedAt: new Date(),
      },
    });

    return NextResponse.json({
      ...(await loadCommandCenter(user.id)),
      message: "Action marked complete.",
    });
  }

  return NextResponse.json({ error: "Unknown command center action." }, { status: 400 });
}