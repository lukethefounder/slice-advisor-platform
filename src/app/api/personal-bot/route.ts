import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  PERSONAL_BOT_QUESTIONS,
  defaultBotAnswers,
} from "@/lib/personal-bot-questions";
import { prisma } from "@/lib/prisma";
import {
  ensureBotProfile,
  executePersonalBotCommand,
} from "@/lib/bot/command-router";
import {
  ensurePlatformBrain,
  recordCommandCorrection,
  recordTrainingPhrase,
  startVoiceSession,
  updateVoiceSession,
} from "@/lib/bot/platform-brain";
import { generateUniversalAssistantReply } from "@/lib/integrations/ai";

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

function deriveBotProfile(answers: Record<string, string>) {
  const riskTolerance = answers.risk_tolerance ?? "Balanced";
  const communicationStyle = answers.communication_tone ?? "Professional";
  const detailLevel = answers.detail_level ?? "Balanced detail";
  const automationComfort = answers.automation_comfort ?? "Create tasks with approval";

  return {
    personality: {
      decisionSpeed: answers.decision_speed ?? "Balanced",
      tone: communicationStyle,
      spokenAccent: "British English",
      detailLevel,
      researchStyle: answers.research_style ?? "Balanced",
      challengeLevel: answers.challenge_level ?? "Balanced challenge",
      taskStyle: answers.task_style ?? "Balanced",
      notificationStyle: answers.notification_style ?? "Balanced",
      meetingPrepDepth: answers.meeting_prep_depth ?? "Balanced",
    },
    risk: {
      riskTolerance,
      timeHorizon: answers.time_horizon ?? "5-10 years",
      liquidityNeeds: answers.liquidity_needs ?? "Moderate",
      complianceCaution: answers.compliance_caution ?? "Extra cautious",
    },
    capabilities: [
      "Universal AI conversation layer",
      "British English spoken voice",
      "User-personalized tone and answer style",
      "OpenAI structured command interpretation",
      "Browser voice-to-command sessions",
      "Platform Brain routing map",
      "Learned phrase training",
      "Command correction memory",
      "Navigate anywhere in Slice",
      "Answer open-ended questions",
      "Find source-backed alerts and opportunity evidence",
      "Search firm data",
      "Research investments using platform context",
      "Sort opportunities, alerts, and workspace data",
      "Create tasks, clients, projects, and watchlist items",
      "Create high/low price alerts",
      "Draft approval-gated client/investor emails",
      "Create premium reports",
      "Run backend jobs",
      "Queue delivery records safely",
      "Generate Advisor Day",
      "Remember preferences",
      "Change personal theme",
    ],
    preferredTone: communicationStyle,
    commandStyle: detailLevel,
    autonomyLevel: automationComfort,
  };
}

async function createUniversalAnswer(input: {
  user: { id: string; name: string; email: string };
  profile: {
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
  prompt: string;
  platformAnswer: string;
  commandIntent: string;
  platformSnapshot?: Record<string, unknown>;
  currentPath?: string | null;
  pageTitle?: string | null;
}) {
  const [memories, recentMessages] = await Promise.all([
    prisma.personalUserBotMemory.findMany({
      where: {
        userId: input.user.id,
        status: "Active",
      },
      orderBy: {
        updatedAt: "desc",
      },
      take: 12,
    }),
    prisma.personalUserBotMessage.findMany({
      where: {
        userId: input.user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 12,
    }),
  ]);

  const universal = await generateUniversalAssistantReply({
    prompt: input.prompt,
    userName: input.user.name,
    userEmail: input.user.email,
    botName: input.profile.botName,
    currentPath: input.currentPath,
    pageTitle: input.pageTitle,
    preferredTone: input.profile.preferredTone,
    commandStyle: input.profile.commandStyle,
    autonomyLevel: input.profile.autonomyLevel,
    customInstructions: input.profile.customInstructions,
    personality: parseJson<Record<string, unknown>>(input.profile.personalityJson, {}),
    risk: parseJson<Record<string, unknown>>(input.profile.riskJson, {}),
    memory: memories.map((memory) => `${memory.title}: ${memory.value}`),
    recentMessages: recentMessages.reverse().map((message) => ({
      role: message.role,
      content: message.content,
    })),
    platformResult: input.platformAnswer,
    commandIntent: input.commandIntent,
    platformSnapshot: input.platformSnapshot ?? {},
    safetyIdentifier: input.user.email,
  });

  return {
    answer: universal.text || input.platformAnswer,
    provider: universal.provider,
    status: universal.status,
    error: universal.error,
  };
}

async function loadBot(user: { id: string; name: string; email: string }) {
  const profile = await ensureBotProfile(user);
  await ensurePlatformBrain(user.id, profile.firmId);

  const [
    messages,
    commands,
    tabs,
    uiPreference,
    emailDrafts,
    pdfReports,
    automationRules,
    memories,
    skills,
    insights,
    approvals,
    dataViews,
    backendApprovals,
    backendToolRuns,
    voiceSessions,
    platformMap,
    trainingPhrases,
    corrections,
    researchRuns,
  ] = await Promise.all([
    prisma.personalUserBotMessage.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.personalUserBotCommand.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
    }),
    prisma.personalUserBotWorkspaceTab.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    }),
    prisma.personalUserUiPreference.findUnique({
      where: { userId: user.id },
    }),
    prisma.personalUserBotEmailDraft.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.personalUserBotPdfReport.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.personalUserBotAutomationRule.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.personalUserBotMemory.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
      take: 40,
    }),
    prisma.personalUserBotSkill.findMany({
      where: { userId: user.id },
      orderBy: [{ category: "asc" }, { skillName: "asc" }],
      take: 60,
    }),
    prisma.personalUserBotProactiveInsight.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { score: "desc" }, { createdAt: "desc" }],
      take: 40,
    }),
    prisma.personalUserBotApprovalItem.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 40,
    }),
    prisma.personalUserBotDataView.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 25,
    }),
    prisma.backendApprovalItem.findMany({
      where: { userId: user.id },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 25,
    }),
    prisma.backendAiToolRun.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.personalUserBotVoiceSession.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
    prisma.personalUserBotPlatformMapItem.findMany({
      where: { userId: user.id },
      orderBy: [{ category: "asc" }, { label: "asc" }],
      take: 80,
    }),
    prisma.personalUserBotTrainingPhrase.findMany({
      where: { userId: user.id },
      orderBy: [{ successCount: "desc" }, { usageCount: "desc" }, { updatedAt: "desc" }],
      take: 80,
    }),
    prisma.personalUserBotCommandCorrection.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      take: 40,
    }),
    prisma.personalUserBotResearchRun.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 25,
    }),
  ]);

  return {
    profile: {
      ...profile,
      spokenAccent: "British English",
      speechLanguage: "en-GB",
      answers: parseJson<Record<string, string>>(profile.answersJson, {}),
      personality: parseJson<Record<string, unknown>>(profile.personalityJson, {}),
      risk: parseJson<Record<string, unknown>>(profile.riskJson, {}),
      capabilities: parseJson<string[]>(profile.capabilitiesJson, []),
    },
    aiEngine: {
      provider: process.env.OPENAI_API_KEY ? "OpenAI Responses API" : "Local fallback",
      configured: Boolean(process.env.OPENAI_API_KEY),
      model: process.env.OPENAI_MODEL || "gpt-5",
      structuredCommands: true,
      universalAnswers: true,
      approvalGates: true,
      platformBrain: true,
      voiceLearning: true,
      spokenAccent: "British English",
      speechLanguage: "en-GB",
      webSearchEnabled: process.env.OPENAI_ENABLE_WEB_SEARCH === "true",
    },
    uiPreference,
    requiresOnboarding: !profile.onboardingComplete,
    questions: PERSONAL_BOT_QUESTIONS,
    messages: messages.reverse().map((message) => ({
      ...message,
      metadata: parseJson<Record<string, unknown>>(message.metadataJson, {}),
    })),
    commands: commands.map((command) => ({
      ...command,
      action: parseJson<Record<string, unknown>>(command.actionJson, {}),
    })),
    tabs: tabs.map((tab) => ({
      ...tab,
      layout: parseJson<Record<string, unknown>>(tab.layoutJson, {}),
      pinnedCommands: parseJson<string[]>(tab.pinnedCommandsJson, []),
    })),
    emailDrafts: emailDrafts.map((draft) => ({
      ...draft,
      recipients: parseJson<Array<Record<string, unknown>>>(draft.recipientJson, []),
      compliance: parseJson<string[]>(draft.complianceJson, []),
    })),
    pdfReports: pdfReports.map((report) => ({
      ...report,
      sections: parseJson<Array<Record<string, string>>>(report.sectionsJson, []),
      design: parseJson<Record<string, unknown>>(report.designJson, {}),
      downloadUrl: `/api/personal-bot/pdf-report?token=${report.downloadToken}`,
    })),
    automationRules: automationRules.map((rule) => ({
      ...rule,
      channels: parseJson<string[]>(rule.channelsJson, []),
      processedKeys: parseJson<string[]>(rule.processedKeysJson, []),
    })),
    memories,
    skills: skills.map((skill) => ({
      ...skill,
      examplePrompts: parseJson<string[]>(skill.examplePromptsJson, []),
    })),
    insights: insights.map((insight) => ({
      ...insight,
      source: parseJson<Array<Record<string, unknown>>>(insight.sourceJson, []),
    })),
    approvals: approvals.map((approval) => ({
      ...approval,
      payload: parseJson<Record<string, unknown>>(approval.payloadJson, {}),
    })),
    dataViews: dataViews.map((view) => ({
      ...view,
      filter: parseJson<Record<string, unknown>>(view.filterJson, {}),
      sort: parseJson<Record<string, unknown>>(view.sortJson, {}),
      result: parseJson<Array<Record<string, unknown>>>(view.resultJson, []),
    })),
    backendApprovals: backendApprovals.map((approval) => ({
      ...approval,
      payload: parseJson<Record<string, unknown>>(approval.payloadJson, {}),
    })),
    backendToolRuns: backendToolRuns.map((run) => ({
      ...run,
      input: parseJson<Record<string, unknown>>(run.inputJson, {}),
      output: parseJson<Record<string, unknown>>(run.outputJson, {}),
    })),
    voiceSessions: voiceSessions.map((session) => ({
      ...session,
      metadata: parseJson<Record<string, unknown>>(session.metadataJson, {}),
    })),
    platformMap: platformMap.map((item) => ({
      ...item,
      aliases: parseJson<string[]>(item.aliasesJson, []),
      capabilities: parseJson<string[]>(item.capabilitiesJson, []),
      examplePrompts: parseJson<string[]>(item.examplePromptsJson, []),
    })),
    trainingPhrases: trainingPhrases.map((item) => ({
      ...item,
      parameters: parseJson<Record<string, unknown>>(item.parametersJson, {}),
    })),
    corrections: corrections.map((item) => ({
      ...item,
      parameters: parseJson<Record<string, unknown>>(item.correctedParametersJson, {}),
    })),
    researchRuns: researchRuns.map((run) => ({
      ...run,
      answer: parseJson<Record<string, unknown>>(run.answerJson, {}),
      sourceSnapshot: parseJson<Record<string, unknown>>(run.sourceSnapshotJson, {}),
    })),
  };
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  return NextResponse.json(await loadBot(user));
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json().catch(() => ({}));
  const action = readText(body.action);
  const profile = await ensureBotProfile(user);

  if (action === "saveOnboarding") {
    const answers =
      body.answers && typeof body.answers === "object"
        ? (body.answers as Record<string, string>)
        : defaultBotAnswers();

    const derived = deriveBotProfile(answers);

    await prisma.personalUserBotProfile.update({
      where: { userId: user.id },
      data: {
        botName: readText(body.botName, profile.botName),
        onboardingComplete: true,
        answersJson: asJson(answers),
        personalityJson: asJson(derived.personality),
        riskJson: asJson(derived.risk),
        capabilitiesJson: asJson(derived.capabilities),
        preferredTone: derived.preferredTone,
        commandStyle: derived.commandStyle,
        autonomyLevel: derived.autonomyLevel,
        voiceEnabled: true,
      },
    });
  }

  if (action === "updateProfile") {
    await prisma.personalUserBotProfile.update({
      where: { userId: user.id },
      data: {
        botName: typeof body.botName === "string" ? body.botName.trim() : undefined,
        preferredTone: typeof body.preferredTone === "string" ? body.preferredTone.trim() : undefined,
        autonomyLevel: typeof body.autonomyLevel === "string" ? body.autonomyLevel.trim() : undefined,
        commandStyle: typeof body.commandStyle === "string" ? body.commandStyle.trim() : undefined,
        customInstructions: typeof body.customInstructions === "string" ? body.customInstructions.trim() : undefined,
        voiceEnabled: typeof body.voiceEnabled === "boolean" ? body.voiceEnabled : undefined,
      },
    });
  }

  if (action === "updateTab") {
    const tabName = readText(body.tabName, "My Bot");
    const notes = readText(body.notes, "");
    const pinnedCommands = Array.isArray(body.pinnedCommands)
      ? body.pinnedCommands.map(String).filter(Boolean)
      : [];

    await prisma.personalUserBotWorkspaceTab.upsert({
      where: {
        userId_tabName: {
          userId: user.id,
          tabName,
        },
      },
      update: {
        notes,
        pinnedCommandsJson: asJson(pinnedCommands),
      },
      create: {
        userId: user.id,
        profileId: profile.id,
        tabName,
        notes,
        pinnedCommandsJson: asJson(pinnedCommands),
        layoutJson: asJson({ mode: "custom", updatedBy: "platform-brain-personal-bot" }),
      },
    });
  }

  if (action === "rebuildPlatformBrain") {
    await ensurePlatformBrain(user.id, profile.firmId);
  }

  if (action === "startVoiceSession") {
    const session = await startVoiceSession({
      userId: user.id,
      profileId: profile.id,
      firmId: profile.firmId,
      language: readText(body.language, "en-GB"),
    });

    return NextResponse.json({
      ...(await loadBot(user)),
      voiceSession: session,
      message: "Voice session started.",
    });
  }

  if (action === "appendVoiceTranscript") {
    const sessionKey = readText(body.sessionKey);
    const transcript = readText(body.transcript);

    if (!sessionKey) {
      return NextResponse.json({ error: "Voice session key is required." }, { status: 400 });
    }

    await updateVoiceSession({
      userId: user.id,
      sessionKey,
      transcript,
      finalTranscript: typeof body.finalTranscript === "string" ? body.finalTranscript : null,
      status: readText(body.status, "Listening"),
      confidenceScore: Number(body.confidenceScore ?? 50),
    });
  }

  if (action === "finishVoiceSession") {
    const sessionKey = readText(body.sessionKey);
    const transcript = readText(body.transcript);
    const shouldExecute = body.execute !== false;

    if (!sessionKey) {
      return NextResponse.json({ error: "Voice session key is required." }, { status: 400 });
    }

    let commandId: string | null = null;

    if (shouldExecute && transcript) {
      await prisma.personalUserBotMessage.create({
        data: {
          userId: user.id,
          profileId: profile.id,
          role: "user",
          content: transcript,
          intent: "Voice Command",
          metadataJson: asJson({ sessionKey }),
        },
      });

      const result = await executePersonalBotCommand({
        user,
        profile,
        prompt: transcript,
        voiceTranscript: transcript,
      });

      commandId = result.commandRecord.id;

      const universal = await createUniversalAnswer({
        user,
        profile,
        prompt: transcript,
        platformAnswer: result.answer,
        commandIntent: result.intent,
        currentPath: readText(body.currentPath, null as unknown as string),
        pageTitle: readText(body.pageTitle, null as unknown as string),
        platformSnapshot: {
          resultSummary: result.commandRecord.resultSummary,
          clientAction: result.clientAction,
          structuredCommand: result.structuredCommand,
          aiParserOk: result.aiParserOk,
          aiParserError: result.aiParserError,
        },
      });

      await prisma.personalUserBotMessage.create({
        data: {
          userId: user.id,
          profileId: profile.id,
          role: "assistant",
          content: universal.answer,
          intent: result.intent,
          metadataJson: asJson({
            commandId: result.commandRecord.id,
            clientAction: result.clientAction,
            structuredCommand: result.structuredCommand,
            aiParserOk: result.aiParserOk,
            aiParserError: result.aiParserError,
            voiceSessionKey: sessionKey,
            universalAiProvider: universal.provider,
            universalAiStatus: universal.status,
            universalAiError: universal.error,
            spokenAccent: "British English",
          }),
        },
      });
    }

    await updateVoiceSession({
      userId: user.id,
      sessionKey,
      transcript,
      finalTranscript: transcript,
      status: "Complete",
      confidenceScore: Number(body.confidenceScore ?? 80),
      commandId,
    });
  }

  if (action === "saveCorrection") {
    const originalCommand = readText(body.originalCommand);
    const correctedIntent = readText(body.correctedIntent);
    const correctedRoute = readText(body.correctedRoute, "");
    const interpretedIntent = readText(body.interpretedIntent, "");

    if (!originalCommand || !correctedIntent) {
      return NextResponse.json({ error: "Original command and corrected intent are required." }, { status: 400 });
    }

    await recordCommandCorrection({
      userId: user.id,
      profileId: profile.id,
      firmId: profile.firmId,
      originalCommand,
      interpretedIntent: interpretedIntent || null,
      correctedIntent,
      correctedRoute: correctedRoute || null,
      correctionNotes: readText(body.correctionNotes, ""),
      parameters: body.parameters && typeof body.parameters === "object" ? body.parameters : {},
    });
  }

  if (action === "trainPhrase") {
    const phrase = readText(body.phrase);
    const targetIntent = readText(body.targetIntent);
    const targetRoute = readText(body.targetRoute, "");

    if (!phrase || !targetIntent) {
      return NextResponse.json({ error: "Phrase and target intent are required." }, { status: 400 });
    }

    await recordTrainingPhrase({
      userId: user.id,
      profileId: profile.id,
      firmId: profile.firmId,
      phrase,
      targetIntent,
      targetRoute: targetRoute || null,
      parameters: body.parameters && typeof body.parameters === "object" ? body.parameters : {},
    });
  }

  if (action === "sendMessage") {
    const prompt = readText(body.prompt);

    if (!prompt) {
      return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
    }

    await prisma.personalUserBotMessage.create({
      data: {
        userId: user.id,
        profileId: profile.id,
        role: "user",
        content: prompt,
        intent: "Command",
        metadataJson: asJson({
          currentPath: readText(body.currentPath, ""),
          pageTitle: readText(body.pageTitle, ""),
        }),
      },
    });

    const result = await executePersonalBotCommand({
      user,
      profile,
      prompt,
      voiceTranscript: typeof body.voiceTranscript === "string" ? body.voiceTranscript : null,
    });

    const universal = await createUniversalAnswer({
      user,
      profile,
      prompt,
      platformAnswer: result.answer,
      commandIntent: result.intent,
      currentPath: readText(body.currentPath, ""),
      pageTitle: readText(body.pageTitle, ""),
      platformSnapshot: {
        resultSummary: result.commandRecord.resultSummary,
        clientAction: result.clientAction,
        structuredCommand: result.structuredCommand,
        aiParserOk: result.aiParserOk,
        aiParserError: result.aiParserError,
      },
    });

    await prisma.personalUserBotMessage.create({
      data: {
        userId: user.id,
        profileId: profile.id,
        role: "assistant",
        content: universal.answer,
        intent: result.intent,
        metadataJson: asJson({
          commandId: result.commandRecord.id,
          clientAction: result.clientAction,
          structuredCommand: result.structuredCommand,
          aiParserOk: result.aiParserOk,
          aiParserError: result.aiParserError,
          universalAiProvider: universal.provider,
          universalAiStatus: universal.status,
          universalAiError: universal.error,
          spokenAccent: "British English",
        }),
      },
    });
  }

  return NextResponse.json(await loadBot(user));
}