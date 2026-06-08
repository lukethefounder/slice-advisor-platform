import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  PERSONAL_BOT_QUESTIONS,
  defaultBotAnswers,
} from "@/lib/personal-bot-questions";
import { prisma } from "@/lib/prisma";
import { generateAiText, type AiSpeedMode } from "@/lib/integrations/ai";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const db = prisma as any;

type CurrentUser = {
  id: string;
  name: string;
  email: string;
};

type BotProfile = {
  id: string;
  userId: string;
  firmId: string | null;
  botName: string;
  onboardingComplete: boolean;
  answersJson: string;
  personalityJson: string;
  riskJson: string;
  capabilitiesJson: string;
  preferredTone: string;
  commandStyle: string;
  autonomyLevel: string;
  voiceEnabled: boolean;
  customInstructions: string | null;
};

type AnswerMode = "quick" | "balanced" | "deep";

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

function normalizeEnv(value: string | undefined) {
  return String(value ?? "").trim().replace(/^["']|["']$/g, "");
}

function getAiRuntimeStatus() {
  const apiKey =
    normalizeEnv(process.env.OPENAI_API_KEY) ||
    normalizeEnv(process.env.OPENAI_KEY) ||
    normalizeEnv(process.env.OPENAI_SECRET_KEY);

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const qualityModel = process.env.OPENAI_QUALITY_MODEL || process.env.OPENAI_MODEL || "gpt-4.1";

  return {
    configured: Boolean(apiKey),
    provider: apiKey ? "OpenAI Responses API" : "Local fallback",
    model,
    qualityModel,
    requiredEnv: "OPENAI_API_KEY",
    webSearchEnabled: process.env.OPENAI_ENABLE_WEB_SEARCH === "true",
  };
}

async function safe<T>(fallback: T, callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch {
    return fallback;
  }
}

function readAnswerMode(value: unknown): AnswerMode {
  if (value === "quick" || value === "balanced" || value === "deep") return value;
  return "balanced";
}

function speedModeForAnswerMode(mode: AnswerMode): AiSpeedMode {
  if (mode === "quick") return "fast";
  if (mode === "deep") return "quality";
  return "balanced";
}

function timeoutForAnswerMode(mode: AnswerMode) {
  if (mode === "quick") return 45_000;
  if (mode === "deep") return 150_000;
  return 95_000;
}

function modelForAnswerMode(mode: AnswerMode) {
  const runtime = getAiRuntimeStatus();

  if (mode === "deep") {
    return runtime.qualityModel;
  }

  return runtime.model;
}

async function resolveFirmId(userId: string) {
  return safe<string | null>(null, async () => {
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
  });
}

function deriveBotProfile(answers: Record<string, string>) {
  const riskTolerance = answers.risk_tolerance ?? "Balanced";
  const communicationStyle = answers.communication_tone ?? "Professional";
  const detailLevel = answers.detail_level ?? "Balanced detail";
  const automationComfort = answers.automation_comfort ?? "Advisor approval required";

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
      "Universal AI answers",
      "Plain-English advisor explanations",
      "Voice input and spoken replies",
      "PDF report generation",
      "Professional command interpretation",
      "Advisor-review safety gates",
      "Source-aware research structure",
      "Workspace memory",
      "Client communication preparation",
      "Meeting preparation",
      "Investment scenario modeling",
    ],
    preferredTone: communicationStyle,
    commandStyle: detailLevel,
    autonomyLevel: automationComfort,
  };
}

async function ensureBotProfile(user: CurrentUser): Promise<BotProfile> {
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
      botName: `${user.name?.split(" ")?.[0] || "Slice"} AI`,
      onboardingComplete: true,
      answersJson: "{}",
      personalityJson: asJson({
        tone: "Professional",
        spokenAccent: "British English",
        detailLevel: "Balanced detail",
      }),
      riskJson: "{}",
      capabilitiesJson: asJson([
        "Universal AI answers",
        "Voice input and spoken replies",
        "Premium PDF generation",
        "Professional advisor summaries",
        "Client communication preparation",
        "Meeting preparation",
        "Investment scenario modeling",
      ]),
      preferredTone: "Professional",
      commandStyle: "Balanced detail",
      autonomyLevel: "Advisor approval required",
      voiceEnabled: true,
    },
  });

  await safe(null, async () =>
    db.personalUserBotWorkspaceTab.upsert({
      where: {
        userId_tabName: {
          userId: user.id,
          tabName: "AI Studio",
        },
      },
      update: {
        profileId: profile.id,
        notes:
          "Calm Slice AI Studio for advisor answers, voice, reports, client communication, platform guidance, and investment scenario modeling.",
      },
      create: {
        userId: user.id,
        profileId: profile.id,
        tabName: "AI Studio",
        layoutJson: asJson({
          mode: "calm-advisor-ai-studio-v3",
        }),
        pinnedCommandsJson: asJson([
          "Explain this platform in simple terms for a wealth manager.",
          "Create a client-friendly explanation of NVDA exposure.",
          "Prepare a calm meeting agenda for a client portfolio review.",
          "Build an investment scenario for a new client with $250,000 starting capital.",
          "Help me decide what to work on next inside Slice.",
        ]),
        notes:
          "Calm Slice AI Studio for advisor answers, voice, reports, client communication, platform guidance, and investment scenario modeling.",
        status: "Active",
      },
    })
  );

  return profile;
}

function cleanFileTitle(value: string) {
  return (
    value
      .replace(/[^a-z0-9\s._-]/gi, "")
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, 130) || "Slice AI Report"
  );
}

function looksLikeReportRequest(prompt: string) {
  const lower = prompt.toLowerCase();

  return (
    lower.includes("pdf") ||
    lower.includes("report") ||
    lower.includes("briefing") ||
    lower.includes("presentation") ||
    lower.includes("deck") ||
    lower.includes("packet")
  );
}

function professionalFallbackAnswer(prompt: string) {
  return `I can help with that.

Here is a useful advisor-grade starting point based on the Slice platform context:

${prompt}

The practical way to approach this is to keep the answer clear, reviewable, and client-safe. Slice should help an advisor turn market information, client context, portfolio holdings, alerts, notes, and tasks into organized next steps.

Use this as a working draft, then ask me to refine it into one of these formats:
- client-friendly email
- meeting agenda
- investment scenario
- executive summary
- report or PDF packet
- advisor talking points`;
}

async function generateProfessionalAnswer(input: {
  user: CurrentUser;
  profile: BotProfile;
  prompt: string;
  recentMessages: Array<{ role: string; content: string }>;
  answerMode: AnswerMode;
}) {
  const runtime = getAiRuntimeStatus();
  const speedMode = speedModeForAnswerMode(input.answerMode);
  const timeoutMs = timeoutForAnswerMode(input.answerMode);
  const model = modelForAnswerMode(input.answerMode);

  const ai = await generateAiText({
    safetyIdentifier: input.user.email,
    speedMode,
    timeoutMs,
    model,
    useCache: false,
    enableWebSearch: runtime.webSearchEnabled,
    instructions: `
You are Slice AI Studio, a calm, premium advisor intelligence assistant.

Rules:
- Answer directly inside the chat.
- Take the time needed to provide a real answer.
- Avoid saying you returned a fallback unless the API key is missing or the request truly fails.
- Make the answer easy to understand and useful.
- Avoid intimidating technical language unless the user asks for technical depth.
- Be polished and advisor-grade.
- Keep investment commentary review-oriented. Do not guarantee returns.
- For client-facing content, keep language clear, calm, and compliance-conscious.
- If the user asks for a PDF/report/presentation, explain what was created and how to use it.
- If a live market fact is not supplied by platform context or web-search tooling, do not pretend it is live.
- Use the user's preferred tone: ${input.profile.preferredTone}.
- Use the user's detail preference: ${input.profile.commandStyle}.
- Custom instructions: ${input.profile.customInstructions || "None"}.
`,
    prompt: JSON.stringify(
      {
        user: {
          name: input.user.name,
          email: input.user.email,
        },
        answerMode: input.answerMode,
        prompt: input.prompt,
        recentMessages: input.recentMessages,
        platformContext:
          "Slice is a wealth/advisor operating platform with AI Studio, team board, clients, email center, market visuals, opportunity radar, watchlists, portfolio lab, alternatives, security, and backend readiness.",
      },
      null,
      2
    ),
    fallbackText: professionalFallbackAnswer(input.prompt),
  });

  return {
    text: ai.text || professionalFallbackAnswer(input.prompt),
    provider: ai.provider,
    status: ai.status,
    error: ai.error,
    model: ai.model,
    configured: runtime.configured,
    answerMode: input.answerMode,
    latencyMs: ai.latencyMs,
  };
}

function buildReportSections(prompt: string, answer: string) {
  return [
    {
      title: "Executive Summary",
      body:
        "Slice AI Studio prepared an advisor-facing report from the user's request. This section summarizes the practical point, platform value, and advisor use case.",
      bullets: [
        "Slice centralizes advisor intelligence, research, task execution, alerts, and report preparation.",
        "The AI layer is designed to answer questions while preserving advisor-review workflows.",
        "The voice layer supports faster hands-free interaction during demonstrations or daily work.",
        "The PDF layer converts analysis into a polished review packet suitable for internal discussion.",
      ],
    },
    {
      title: "Original Request",
      body: prompt,
    },
    {
      title: "AI Briefing",
      body: answer,
    },
    {
      title: "Advisor Value Proposition",
      bullets: [
        "Reduce time spent moving between research, tasks, reports, and communication workflows.",
        "Create a stronger client-service experience through faster preparation and clearer briefing materials.",
        "Maintain review gates before sensitive communication or external use.",
        "Turn rough prompts and voice commands into structured, professional output.",
      ],
    },
    {
      title: "Important Review Notes",
      body:
        "This report is AI-assisted and intended for advisor review. Verify market data, client suitability, compliance requirements, and source freshness before using externally.",
    },
  ];
}

async function createReport(input: {
  user: CurrentUser;
  profile: BotProfile;
  prompt: string;
  answer: string;
}) {
  const title = cleanFileTitle(
    input.prompt.toLowerCase().includes("slice")
      ? input.prompt
      : `Slice AI Studio Report - ${input.prompt}`
  );

  return db.personalUserBotPdfReport.create({
    data: {
      userId: input.user.id,
      profileId: input.profile.id,
      firmId: input.profile.firmId,
      title,
      reportType: "Advisor AI Report",
      summary:
        "A polished Slice AI Studio report generated for advisor review, platform demonstration, and meeting preparation.",
      sectionsJson: asJson(buildReportSections(input.prompt, input.answer)),
      designJson: asJson({
        generatedBy: input.profile.botName,
        preparedFor: "Advisor / Wealth Manager Review",
        investmentGrade: "Advisor Review Ready",
        confidenceScore: 90,
        metrics: [
          {
            label: "Clarity",
            value: 92,
            helper: "Designed for easy use",
            tone: "green",
          },
          {
            label: "Advisor Utility",
            value: 91,
            helper: "Workflow-focused",
            tone: "green",
          },
          {
            label: "Review Safety",
            value: 88,
            helper: "Approval-first posture",
            tone: "amber",
          },
        ],
      }),
      downloadToken: randomBytes(24).toString("hex"),
      status: "Ready",
    },
  });
}

async function loadBot(user: CurrentUser) {
  const profile = await ensureBotProfile(user);
  const runtime = getAiRuntimeStatus();

  const [
    messages,
    commands,
    tabs,
    pdfReports,
    memories,
    approvals,
    backendApprovals,
    platformMap,
  ] = await Promise.all([
    safe([], () =>
      db.personalUserBotMessage.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    ),
    safe([], () =>
      db.personalUserBotCommand.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 50,
      })
    ),
    safe([], () =>
      db.personalUserBotWorkspaceTab.findMany({
        where: { userId: user.id },
        orderBy: { updatedAt: "desc" },
        take: 10,
      })
    ),
    safe([], () =>
      db.personalUserBotPdfReport.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
      })
    ),
    safe([], () =>
      db.personalUserBotMemory.findMany({
        where: { userId: user.id },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        take: 25,
      })
    ),
    safe([], () =>
      db.personalUserBotApprovalItem.findMany({
        where: { userId: user.id },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 25,
      })
    ),
    safe([], () =>
      db.backendApprovalItem.findMany({
        where: { userId: user.id },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 25,
      })
    ),
    safe([], () =>
      db.personalUserBotPlatformMapItem.findMany({
        where: { userId: user.id },
        orderBy: [{ category: "asc" }, { label: "asc" }],
        take: 50,
      })
    ),
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
      provider: runtime.provider,
      configured: runtime.configured,
      model: runtime.model,
      qualityModel: runtime.qualityModel,
      structuredCommands: true,
      universalAnswers: true,
      approvalGates: true,
      platformBrain: true,
      voiceLearning: true,
      spokenAccent: "British English",
      speechLanguage: "en-GB",
      webSearchEnabled: runtime.webSearchEnabled,
      requiredEnv: runtime.requiredEnv,
      timeoutPolicy: {
        quickMs: timeoutForAnswerMode("quick"),
        balancedMs: timeoutForAnswerMode("balanced"),
        deepMs: timeoutForAnswerMode("deep"),
      },
    },
    uiPreference: {
      mode: "calm",
      density: "comfortable",
      primaryGoal: "Make AI Studio feel easy to use.",
    },
    requiresOnboarding: false,
    questions: PERSONAL_BOT_QUESTIONS,
    messages: [...messages].reverse().map((message: any) => ({
      ...message,
      metadata: parseJson<Record<string, unknown>>(message.metadataJson, {}),
    })),
    commands: commands.map((command: any) => ({
      ...command,
      action: parseJson<Record<string, unknown>>(command.actionJson, {}),
    })),
    tabs: tabs.map((tab: any) => ({
      ...tab,
      layout: parseJson<Record<string, unknown>>(tab.layoutJson, {}),
      pinnedCommands: parseJson<string[]>(tab.pinnedCommandsJson, []),
    })),
    pdfReports: pdfReports.map((report: any) => ({
      ...report,
      sections: parseJson<Array<Record<string, string>>>(report.sectionsJson, []),
      design: parseJson<Record<string, unknown>>(report.designJson, {}),
      downloadUrl: `/api/personal-bot/pdf-report?token=${report.downloadToken}`,
    })),
    memories,
    approvals: approvals.map((approval: any) => ({
      ...approval,
      payload: parseJson<Record<string, unknown>>(approval.payloadJson, {}),
    })),
    backendApprovals: backendApprovals.map((approval: any) => ({
      ...approval,
      payload: parseJson<Record<string, unknown>>(approval.payloadJson, {}),
    })),
    platformMap: platformMap.map((item: any) => ({
      ...item,
      aliases: parseJson<string[]>(item.aliasesJson, []),
      capabilities: parseJson<string[]>(item.capabilitiesJson, []),
      examplePrompts: parseJson<string[]>(item.examplePromptsJson, []),
    })),
    emailDrafts: [],
    automationRules: [],
    skills: [],
    insights: [],
    dataViews: [],
    backendToolRuns: [],
    voiceSessions: [],
    trainingPhrases: [],
    corrections: [],
    researchRuns: [],
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

  try {
    const body = await request.json().catch(() => ({}));
    const action = readText(body.action);
    const profile = await ensureBotProfile(user);

    if (action === "saveOnboarding") {
      const answers =
        body.answers && typeof body.answers === "object"
          ? (body.answers as Record<string, string>)
          : defaultBotAnswers();

      const derived = deriveBotProfile(answers);

      await db.personalUserBotProfile.update({
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

      return NextResponse.json(await loadBot(user));
    }

    if (action === "updateProfile") {
      await db.personalUserBotProfile.update({
        where: { userId: user.id },
        data: {
          botName:
            typeof body.botName === "string" ? body.botName.trim() : undefined,
          preferredTone:
            typeof body.preferredTone === "string"
              ? body.preferredTone.trim()
              : undefined,
          autonomyLevel:
            typeof body.autonomyLevel === "string"
              ? body.autonomyLevel.trim()
              : undefined,
          commandStyle:
            typeof body.commandStyle === "string"
              ? body.commandStyle.trim()
              : undefined,
          customInstructions:
            typeof body.customInstructions === "string"
              ? body.customInstructions.trim()
              : undefined,
          voiceEnabled:
            typeof body.voiceEnabled === "boolean" ? body.voiceEnabled : undefined,
        },
      });

      return NextResponse.json(await loadBot(user));
    }

    if (action === "updateTab") {
      const tabName = readText(body.tabName, "AI Studio");
      const notes = readText(body.notes, "");
      const pinnedCommands = Array.isArray(body.pinnedCommands)
        ? body.pinnedCommands.map(String).filter(Boolean)
        : [];

      await db.personalUserBotWorkspaceTab.upsert({
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
          layoutJson: asJson({ mode: "calm-ai-studio-v3" }),
        },
      });

      return NextResponse.json(await loadBot(user));
    }

    if (action === "sendMessage") {
      const prompt = readText(body.prompt);
      const answerMode = readAnswerMode(body.answerMode);

      if (!prompt) {
        return NextResponse.json({ error: "Prompt is required." }, { status: 400 });
      }

      await db.personalUserBotMessage.create({
        data: {
          userId: user.id,
          profileId: profile.id,
          role: "user",
          content: prompt,
          intent: body.voiceTranscript ? "Voice Command" : "Command",
          metadataJson: asJson({
            currentPath: readText(body.currentPath, ""),
            pageTitle: readText(body.pageTitle, ""),
            answerMode,
            voiceTranscript:
              typeof body.voiceTranscript === "string" ? body.voiceTranscript : null,
          }),
        },
      });

      const recentMessages = await safe([], () =>
        db.personalUserBotMessage.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 10,
        })
      );

      const answer = await generateProfessionalAnswer({
        user,
        profile,
        prompt,
        answerMode,
        recentMessages: recentMessages
          .reverse()
          .map((message: any) => ({
            role: message.role,
            content: message.content,
          })),
      });

      let report: any = null;
      let reportError: string | null = null;

      if (looksLikeReportRequest(prompt)) {
        try {
          report = await createReport({
            user,
            profile,
            prompt,
            answer: answer.text,
          });
        } catch (error) {
          reportError =
            error instanceof Error ? error.message : "Report creation failed.";
        }
      }

      const finalAnswer = report
        ? `${answer.text}\n\nI also created a presentation-ready PDF report. Use the “Open Report” button to view it.`
        : reportError
          ? `${answer.text}\n\nI answered the request, but PDF creation failed: ${reportError}`
          : answer.text;

      const clientAction = report
        ? {
            type: "report",
            href: `/api/personal-bot/pdf-report?token=${report.downloadToken}`,
            autoRun: false,
          }
        : {
            type: "none",
            autoRun: false,
          };

      await db.personalUserBotMessage.create({
        data: {
          userId: user.id,
          profileId: profile.id,
          role: "assistant",
          content: finalAnswer,
          intent: report ? "Create Report" : "Answer",
          metadataJson: asJson({
            clientAction,
            answerMode,
            universalAiProvider: answer.provider,
            universalAiStatus: answer.status,
            universalAiError: answer.error,
            universalAiModel: answer.model,
            universalAiConfigured: answer.configured,
            universalAiLatencyMs: answer.latencyMs,
            spokenAccent: "British English",
            reportError,
          }),
        },
      });

      await safe(null, () =>
        db.personalUserBotCommand.create({
          data: {
            userId: user.id,
            profileId: profile.id,
            firmId: profile.firmId,
            commandText: prompt,
            commandType: report ? "create_report" : "answer",
            status: report ? "Report Generated" : "Complete",
            resultSummary: report
              ? `Generated PDF report: ${report.title}`
              : "Answered in AI Studio.",
            actionJson: asJson({
              provider: answer.provider,
              status: answer.status,
              model: answer.model,
              configured: answer.configured,
              answerMode,
              latencyMs: answer.latencyMs,
              reportId: report?.id ?? null,
              reportUrl: report
                ? `/api/personal-bot/pdf-report?token=${report.downloadToken}`
                : null,
              reportError,
            }),
          },
        })
      );

      return NextResponse.json(await loadBot(user));
    }

    return NextResponse.json(await loadBot(user));
  } catch (error) {
    return NextResponse.json(
      {
        error: "AI Studio request failed.",
        detail: error instanceof Error ? error.message : "Unknown error.",
      },
      { status: 500 }
    );
  }
}