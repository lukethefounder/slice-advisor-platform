import { randomBytes } from "crypto";
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  PERSONAL_BOT_QUESTIONS,
  defaultBotAnswers,
} from "@/lib/personal-bot-questions";
import { prisma } from "@/lib/prisma";
import { generateAiText } from "@/lib/integrations/ai";

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

async function safe<T>(fallback: T, callback: () => Promise<T>): Promise<T> {
  try {
    return await callback();
  } catch {
    return fallback;
  }
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
  const automationComfort =
    answers.automation_comfort ?? "Advisor approval required";

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
      "Presentation-ready advisor summaries",
      "Voice input and spoken replies",
      "PDF report generation",
      "Professional command interpretation",
      "Advisor-review safety gates",
      "Source-aware research structure",
      "Workspace memory",
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
          "Presentation-grade Slice AI Studio for advisor answers, voice, reports, and command work.",
      },
      create: {
        userId: user.id,
        profileId: profile.id,
        tabName: "AI Studio",
        layoutJson: asJson({
          mode: "presentation-grade-ai-studio",
        }),
        pinnedCommandsJson: asJson([
          "Create a stunning PDF report explaining Slice for a wealth manager presentation.",
          "Give me a presentation-ready answer to why Slice matters.",
          "Research NVDA and explain the bull case, bear case, and next steps.",
          "What should I improve before showing this platform to a wealth manager?",
        ]),
        notes:
          "Presentation-grade Slice AI Studio for advisor answers, voice, reports, and command work.",
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
  return `Here is the professional answer.

${prompt}

For a wealth manager or advisor audience, the strongest way to position this is: Slice is an advisor intelligence layer that helps turn market noise, client context, tasks, alerts, and research into fast, reviewable decisions. The value is not just that it answers questions; it reduces friction in the advisor workflow by keeping analysis, action items, reports, and communication preparation in one operating layer.

The practical takeaway: Slice should be presented as a productivity and intelligence platform for advisors, not just a chatbot. The core promise is faster understanding, cleaner documentation, stronger follow-through, and better client-ready preparation while keeping important actions review-gated.`;
}

async function generateProfessionalAnswer(input: {
  user: CurrentUser;
  profile: BotProfile;
  prompt: string;
  recentMessages: Array<{ role: string; content: string }>;
}) {
  const ai = await generateAiText({
    safetyIdentifier: input.user.email,
    speedMode: "fast",
    useCache: false,
    instructions: `
You are Slice AI Studio, a state-of-the-art advisor intelligence assistant.

Rules:
- Always answer directly inside the chat.
- Do not tell the user to go elsewhere unless they explicitly ask to navigate.
- Be fast, professional, polished, and presentation-ready.
- Use clear advisor-grade language.
- If the user asks for a PDF/report/presentation, explain what was created and what it is useful for.
- Do not claim live market facts unless supplied by the platform context.
- For investment commentary, avoid guarantees and phrase conclusions as review-oriented analysis.
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
        prompt: input.prompt,
        recentMessages: input.recentMessages,
        presentationContext:
          "The user has an important presentation soon. Prioritize clarity, polish, and demo reliability.",
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
  };
}

function buildReportSections(prompt: string, answer: string) {
  return [
    {
      title: "Executive Summary",
      body:
        "Slice AI Studio was asked to prepare a presentation-ready advisor intelligence report. This section summarizes the core thesis, platform value, and advisor-facing use case in a clean format.",
      bullets: [
        "Slice centralizes advisor intelligence, research, task execution, alerts, and report preparation.",
        "The AI layer is designed to answer questions quickly while preserving advisor-review workflows.",
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
      title: "Presentation Talking Points",
      bullets: [
        "Slice is not merely a chatbot; it is an advisor operating layer.",
        "The platform is designed around speed, clarity, reviewability, and client preparation.",
        "The strongest near-term value is workflow compression for advisors and wealth managers.",
        "The long-term moat is the combination of AI, firm memory, source intelligence, reports, and task execution.",
      ],
    },
    {
      title: "Important Review Notes",
      body:
        "This report is AI-assisted and intended for advisor review. Verify any market data, client suitability, compliance requirements, and source freshness before using externally.",
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
      reportType: "Presentation-Ready AI Report",
      summary:
        "A premium Slice AI Studio report generated for advisor review, platform demonstration, and presentation preparation.",
      sectionsJson: asJson(buildReportSections(input.prompt, input.answer)),
      designJson: asJson({
        generatedBy: input.profile.botName,
        preparedFor: "Advisor / Wealth Manager Review",
        investmentGrade: "Presentation Ready",
        confidenceScore: 88,
        metrics: [
          {
            label: "Presentation Polish",
            value: 92,
            helper: "Designed for demo use",
            tone: "green",
          },
          {
            label: "Advisor Utility",
            value: 90,
            helper: "Workflow-focused",
            tone: "green",
          },
          {
            label: "Review Safety",
            value: 86,
            helper: "Approval-first posture",
            tone: "amber",
          },
        ],
        charts: [
          {
            type: "bar",
            title: "Slice AI Capability Strength",
            subtitle: "Presentation-oriented internal scorecard.",
            data: [
              { label: "Answers", value: 92 },
              { label: "Voice", value: 86 },
              { label: "Reports", value: 90 },
              { label: "Workflow", value: 88 },
              { label: "Review", value: 87 },
            ],
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
        take: 30,
      })
    ),
    safe([], () =>
      db.personalUserBotCommand.findMany({
        where: { userId: user.id },
        orderBy: { createdAt: "desc" },
        take: 30,
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
        take: 20,
      })
    ),
    safe([], () =>
      db.personalUserBotMemory.findMany({
        where: { userId: user.id },
        orderBy: [{ status: "asc" }, { updatedAt: "desc" }],
        take: 20,
      })
    ),
    safe([], () =>
      db.personalUserBotApprovalItem.findMany({
        where: { userId: user.id },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 20,
      })
    ),
    safe([], () =>
      db.backendApprovalItem.findMany({
        where: { userId: user.id },
        orderBy: [{ status: "asc" }, { createdAt: "desc" }],
        take: 20,
      })
    ),
    safe([], () =>
      db.personalUserBotPlatformMapItem.findMany({
        where: { userId: user.id },
        orderBy: [{ category: "asc" }, { label: "asc" }],
        take: 40,
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
    uiPreference: null,
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
          layoutJson: asJson({ mode: "custom-ai-studio" }),
        },
      });

      return NextResponse.json(await loadBot(user));
    }

    if (action === "sendMessage") {
      const prompt = readText(body.prompt);

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
            voiceTranscript:
              typeof body.voiceTranscript === "string" ? body.voiceTranscript : null,
          }),
        },
      });

      const recentMessages = await safe([], () =>
        db.personalUserBotMessage.findMany({
          where: { userId: user.id },
          orderBy: { createdAt: "desc" },
          take: 8,
        })
      );

      const answer = await generateProfessionalAnswer({
        user,
        profile,
        prompt,
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
        ? `${answer.text}\n\nI also created a presentation-ready PDF report. Use the “Open Presentation PDF” button to view it.`
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
            universalAiProvider: answer.provider,
            universalAiStatus: answer.status,
            universalAiError: answer.error,
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