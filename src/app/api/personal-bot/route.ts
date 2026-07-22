import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  compactSlicePlatformContext,
  loadSlicePlatformContext,
} from "@/lib/ai-studio/platform-context";
import {
  ensureBotProfile,
  executePersonalBotCommand,
  type BotProfileShape,
  type CurrentUserShape,
  type ExecutePersonalBotCommandResult,
} from "@/lib/bot/command-router";
import {
  getOpenAiAudioRuntimeStatus,
} from "@/lib/integrations/audio";
import {
  getOpenAiRuntimeStatus,
  verifyOpenAiConnection,
} from "@/lib/integrations/ai";
import {
  PERSONAL_BOT_QUESTIONS,
  defaultBotAnswers,
} from "@/lib/personal-bot-questions";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const db = prisma as any;

type AnswerMode =
  | "quick"
  | "balanced"
  | "deep";

type BotProfileRecord =
  BotProfileShape & {
    onboardingComplete: boolean;
    answersJson: string;
    capabilitiesJson: string;
    voiceEnabled: boolean;
    createdAt?: Date;
    updatedAt?: Date;
  };

type UnknownRecord =
  Record<string, unknown>;

function noStoreJson(
  body: unknown,
  init?: ResponseInit,
) {
  const response =
    NextResponse.json(
      body,
      init,
    );

  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate",
  );

  response.headers.set(
    "Pragma",
    "no-cache",
  );

  response.headers.set(
    "X-Slice-AI-Studio",
    "unified",
  );

  return response;
}

function asJson(
  value: unknown,
) {
  return JSON.stringify(value);
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

function readText(
  value: unknown,
  fallback = "",
) {
  return typeof value ===
      "string" &&
    value.trim()
    ? value.trim()
    : fallback;
}

function readOptionalText(
  value: unknown,
  maximum = 5000,
) {
  if (
    typeof value !== "string"
  ) {
    return undefined;
  }

  return value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maximum);
}

function readAnswerMode(
  value: unknown,
): AnswerMode {
  if (
    value === "quick" ||
    value === "balanced" ||
    value === "deep"
  ) {
    return value;
  }

  return "balanced";
}

function readAdvancedSettings(
  value: unknown,
) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value)
  ) {
    return null;
  }

  return value as Record<
    string,
    unknown
  >;
}

function deriveBotProfile(
  answers: Record<
    string,
    string
  >,
) {
  const riskTolerance =
    answers.risk_tolerance ??
    "Balanced";

  const communicationStyle =
    answers.communication_tone ??
    "Professional";

  const detailLevel =
    answers.detail_level ??
    "Balanced detail";

  const automationComfort =
    answers.automation_comfort ??
    "Advisor approval required";

  return {
    personality: {
      decisionSpeed:
        answers.decision_speed ??
        "Balanced",

      tone:
        communicationStyle,

      spokenAccent:
        "British English",

      detailLevel,

      researchStyle:
        answers.research_style ??
        "Source-first financial research",

      challengeLevel:
        answers.challenge_level ??
        "Balanced challenge",

      taskStyle:
        answers.task_style ??
        "Balanced",

      notificationStyle:
        answers.notification_style ??
        "Balanced",

      meetingPrepDepth:
        answers.meeting_prep_depth ??
        "Balanced",
    },

    risk: {
      riskTolerance,

      timeHorizon:
        answers.time_horizon ??
        "5-10 years",

      liquidityNeeds:
        answers.liquidity_needs ??
        "Moderate",

      complianceCaution:
        answers.compliance_caution ??
        "Extra cautious",
    },

    capabilities: [
      "Researched financial answers with visible sources",
      "Unified typed and voice command execution",
      "Permission-scoped Slice platform knowledge",
      "OpenAI transcription and spoken replies",
      "Investment, company, market, economic, and regulatory research",
      "Client-safe explanations and advisor-ready analysis",
      "Internal firm and client-record search",
      "Task, project, watchlist, price-alert, and client workflows",
      "Approval-gated client communication and delivery",
      "Source-backed browser and PDF report generation",
      "Backend jobs and operating health checks",
      "Workspace memory and personalised response style",
    ],

    preferredTone:
      communicationStyle,

    commandStyle:
      detailLevel,

    autonomyLevel:
      automationComfort,
  };
}

function parseMessageMetadata(
  value:
    | string
    | null
    | undefined,
) {
  return parseJson<
    Record<
      string,
      unknown
    >
  >(
    value,
    {},
  );
}

function profileForResponse(
  profile: BotProfileRecord,
) {
  return {
    ...profile,

    spokenAccent:
      "British English",

    speechLanguage:
      "en-GB",

    answers:
      parseJson<
        Record<
          string,
          string
        >
      >(
        profile.answersJson,
        {},
      ),

    personality:
      parseJson<
        Record<
          string,
          unknown
        >
      >(
        profile.personalityJson,
        {},
      ),

    risk:
      parseJson<
        Record<
          string,
          unknown
        >
      >(
        profile.riskJson,
        {},
      ),

    capabilities:
      parseJson<string[]>(
        profile.capabilitiesJson,
        [],
      ),
  };
}

function mapReport(
  report: any,
) {
  return {
    ...report,

    sections:
      parseJson<
        Array<
          Record<
            string,
            unknown
          >
        >
      >(
        report.sectionsJson,
        [],
      ),

    design:
      parseJson<
        Record<
          string,
          unknown
        >
      >(
        report.designJson,
        {},
      ),

    downloadUrl:
      `/api/personal-bot/pdf-report?token=${report.downloadToken}`,

    viewerUrl:
      `/workspace/personal-bot/reports?token=${report.downloadToken}`,
  };
}

function mapCommand(
  command: any,
) {
  return {
    ...command,

    action:
      parseJson<
        Record<
          string,
          unknown
        >
      >(
        command.actionJson,
        {},
      ),
  };
}

function mapTab(
  tab: any,
) {
  return {
    ...tab,

    layout:
      parseJson<
        Record<
          string,
          unknown
        >
      >(
        tab.layoutJson,
        {},
      ),

    pinnedCommands:
      parseJson<string[]>(
        tab.pinnedCommandsJson,
        [],
      ),
  };
}

function mapApproval(
  approval: any,
) {
  return {
    ...approval,

    payload:
      parseJson<
        Record<
          string,
          unknown
        >
      >(
        approval.payloadJson,
        {},
      ),
  };
}

async function loadBot(
  user: CurrentUserShape,
  lastExecution?:
    | ExecutePersonalBotCommandResult
    | null,
) {
  const profile =
    (await ensureBotProfile(
      user,
    )) as BotProfileRecord;

  const runtimeStatus =
    getOpenAiRuntimeStatus();

  const audioStatus =
    getOpenAiAudioRuntimeStatus();

  const [
    health,
    platformContext,
    messages,
    commands,
    tabs,
    pdfReports,
    memories,
    approvals,
    backendApprovals,
    platformMap,
    emailDrafts,
    automationRules,
    skills,
    insights,
    dataViews,
    backendToolRuns,
    voiceSessions,
    trainingPhrases,
    corrections,
    researchRuns,
  ] = await Promise.all([
    verifyOpenAiConnection(),

    safe(null, () =>
      loadSlicePlatformContext({
        user,
        profile,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotMessage.findMany({
        where: {
          userId: user.id,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 80,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotCommand.findMany({
        where: {
          userId: user.id,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 80,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotWorkspaceTab.findMany({
        where: {
          userId: user.id,
        },

        orderBy: {
          updatedAt: "desc",
        },

        take: 12,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotPdfReport.findMany({
        where: {
          userId: user.id,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 40,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotMemory.findMany({
        where: {
          userId: user.id,
        },

        orderBy: [
          {
            status: "asc",
          },
          {
            updatedAt:
              "desc",
          },
        ],

        take: 40,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotApprovalItem.findMany({
        where: {
          userId: user.id,
        },

        orderBy: [
          {
            status: "asc",
          },
          {
            createdAt:
              "desc",
          },
        ],

        take: 40,
      }),
    ),

    safe<any[]>([], () =>
      db.backendApprovalItem.findMany({
        where: {
          userId: user.id,
        },

        orderBy: [
          {
            status: "asc",
          },
          {
            createdAt:
              "desc",
          },
        ],

        take: 40,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotPlatformMapItem.findMany({
        where: {
          userId: user.id,
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

        take: 100,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotEmailDraft.findMany({
        where: {
          userId: user.id,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 30,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotAutomationRule.findMany({
        where: {
          userId: user.id,
        },

        orderBy: {
          updatedAt: "desc",
        },

        take: 30,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotSkill.findMany({
        where: {
          userId: user.id,
        },

        orderBy: [
          {
            enabled: "desc",
          },
          {
            category:
              "asc",
          },
        ],

        take: 60,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotProactiveInsight.findMany({
        where: {
          userId: user.id,
        },

        orderBy: [
          {
            score: "desc",
          },
          {
            createdAt:
              "desc",
          },
        ],

        take: 30,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotDataView.findMany({
        where: {
          userId: user.id,
        },

        orderBy: {
          updatedAt: "desc",
        },

        take: 30,
      }),
    ),

    safe<any[]>([], () =>
      db.backendAiToolRun.findMany({
        where: {
          userId: user.id,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 40,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotVoiceSession.findMany({
        where: {
          userId: user.id,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 30,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotTrainingPhrase.findMany({
        where: {
          userId: user.id,
        },

        orderBy: [
          {
            successCount:
              "desc",
          },
          {
            updatedAt:
              "desc",
          },
        ],

        take: 50,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotCommandCorrection.findMany({
        where: {
          userId: user.id,
        },

        orderBy: {
          updatedAt: "desc",
        },

        take: 40,
      }),
    ),

    safe<any[]>([], () =>
      db.personalUserBotResearchRun.findMany({
        where: {
          userId: user.id,
        },

        orderBy: {
          createdAt: "desc",
        },

        take: 30,
      }),
    ),
  ]);

  return {
    profile:
      profileForResponse(
        profile,
      ),

    aiEngine: {
      provider: health.ok
        ? health.provider
        : runtimeStatus.provider,

      configured:
        health.ok,

      environmentConfigured:
        runtimeStatus.configured,

      keyFormatValid:
        runtimeStatus.keyFormatValid,

      health,

      model: health.ok
        ? health.model
        : runtimeStatus.model,

      fastModel:
        runtimeStatus.fastModel,

      qualityModel:
        runtimeStatus.qualityModel,

      structuredCommands:
        true,

      universalAnswers:
        true,

      researchedAnswers:
        true,

      visibleSources:
        true,

      approvalGates:
        true,

      platformBrain:
        true,

      permissionScopedContext:
        true,

      voiceLearning:
        true,

      webSearchEnabled:
        runtimeStatus.webSearchEnabled,

      researchRequired:
        runtimeStatus.requireResearch,

      requiredEnv:
        runtimeStatus.requiredEnv,

      maxOutputTokens:
        runtimeStatus.maxOutputTokens,

      spokenAccent:
        "British English",

      speechLanguage:
        "en-GB",

      timeoutPolicy: {
        quickMs:
          runtimeStatus.timeoutPolicy
            .fastMs,

        balancedMs:
          runtimeStatus.timeoutPolicy
            .balancedMs,

        deepMs:
          runtimeStatus.timeoutPolicy
            .qualityMs,
      },

      audio:
        audioStatus,
    },

    uiPreference: {
      mode: "premium",

      density:
        "comfortable",

      primaryGoal:
        "Use one researched financial AI and command path across chat, voice, reports, and platform operations.",
    },

    requiresOnboarding:
      false,

    questions:
      PERSONAL_BOT_QUESTIONS,

    platformContext:
      platformContext
        ? compactSlicePlatformContext(
            platformContext,
          )
        : null,

    messages: [
      ...messages,
    ]
      .reverse()
      .map(
        (message: any) => ({
          ...message,

          metadata:
            parseMessageMetadata(
              message.metadataJson,
            ),
        }),
      ),

    commands:
      commands.map(
        mapCommand,
      ),

    tabs:
      tabs.map(mapTab),

    pdfReports:
      pdfReports.map(
        mapReport,
      ),

    memories,

    approvals:
      approvals.map(
        mapApproval,
      ),

    backendApprovals:
      backendApprovals.map(
        mapApproval,
      ),

    platformMap:
      platformMap.map(
        (item: any) => ({
          ...item,

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

          examplePrompts:
            parseJson<
              string[]
            >(
              item.examplePromptsJson,
              [],
            ),
        }),
      ),

    emailDrafts:
      emailDrafts.map(
        (draft: any) => ({
          ...draft,

          recipients:
            parseJson<
              Array<
                Record<
                  string,
                  unknown
                >
              >
            >(
              draft.recipientJson,
              [],
            ),

          compliance:
            parseJson<
              string[]
            >(
              draft.complianceJson,
              [],
            ),
        }),
      ),

    automationRules:
      automationRules.map(
        (rule: any) => ({
          ...rule,

          channels:
            parseJson<
              string[]
            >(
              rule.channelsJson,
              [],
            ),

          processedKeys:
            parseJson<
              string[]
            >(
              rule.processedKeysJson,
              [],
            ),
        }),
      ),

    skills:
      skills.map(
        (skill: any) => ({
          ...skill,

          examplePrompts:
            parseJson<
              string[]
            >(
              skill.examplePromptsJson,
              [],
            ),
        }),
      ),

    insights:
      insights.map(
        (insight: any) => ({
          ...insight,

          sources:
            parseJson<
              Array<
                Record<
                  string,
                  unknown
                >
              >
            >(
              insight.sourceJson,
              [],
            ),
        }),
      ),

    dataViews:
      dataViews.map(
        (view: any) => ({
          ...view,

          filter:
            parseJson<
              UnknownRecord
            >(
              view.filterJson,
              {},
            ),

          sort:
            parseJson<
              UnknownRecord
            >(
              view.sortJson,
              {},
            ),

          results:
            parseJson<
              unknown[]
            >(
              view.resultJson,
              [],
            ),
        }),
      ),

    backendToolRuns:
      backendToolRuns.map(
        (run: any) => ({
          ...run,

          input:
            parseJson<
              UnknownRecord
            >(
              run.inputJson,
              {},
            ),

          output:
            parseJson<
              UnknownRecord
            >(
              run.outputJson,
              {},
            ),
        }),
      ),

    voiceSessions:
      voiceSessions.map(
        (session: any) => ({
          ...session,

          metadata:
            parseJson<
              UnknownRecord
            >(
              session.metadataJson,
              {},
            ),
        }),
      ),

    trainingPhrases:
      trainingPhrases.map(
        (phrase: any) => ({
          ...phrase,

          parameters:
            parseJson<
              UnknownRecord
            >(
              phrase.parametersJson,
              {},
            ),
        }),
      ),

    corrections:
      corrections.map(
        (
          correction: any,
        ) => ({
          ...correction,

          parameters:
            parseJson<
              UnknownRecord
            >(
              correction.correctedParametersJson,
              {},
            ),
        }),
      ),

    researchRuns:
      researchRuns.map(
        (run: any) => ({
          ...run,

          answer:
            parseJson<
              UnknownRecord
            >(
              run.answerJson,
              {},
            ),

          sourceSnapshot:
            parseJson<
              UnknownRecord
            >(
              run.sourceSnapshotJson,
              {},
            ),
        }),
      ),

    lastExecution:
      lastExecution
        ? {
            intent:
              lastExecution.intent,

            status:
              lastExecution.status,

            resultSummary:
              lastExecution.resultSummary,

            clientAction:
              lastExecution.clientAction,

            structuredCommand:
              lastExecution.structuredCommand,

            sources:
              lastExecution.sources ??
              [],

            researchUsed:
              lastExecution.researchUsed ??
              false,

            orchestration:
              lastExecution.orchestration,

            commandId:
              lastExecution.commandRecord
                ?.id ??
              null,
          }
        : null,
  };
}

async function saveAssistantMessage(
  input: {
    user: CurrentUserShape;
    profile: BotProfileRecord;
    answerMode: AnswerMode;
    result: ExecutePersonalBotCommandResult;
    voiceTranscript?:
      | string
      | null;
  },
) {
  const runtimeStatus =
    getOpenAiRuntimeStatus();

  return db.personalUserBotMessage.create(
    {
      data: {
        userId:
          input.user.id,

        profileId:
          input.profile.id,

        role: "assistant",

        content:
          input.result.answer,

        intent:
          input.result.intent,

        metadataJson:
          asJson({
            commandId:
              input.result.commandRecord
                ?.id ??
              null,

            clientAction:
              input.result.clientAction,

            answerMode:
              input.answerMode,

            structuredCommand:
              input.result
                .structuredCommand,

            executionStatus:
              input.result.status,

            resultSummary:
              input.result
                .resultSummary,

            aiParserOk:
              input.result
                .aiParserOk,

            aiParserError:
              input.result
                .aiParserError ??
              null,

            fastRouterUsed:
              input.result
                .fastRouterUsed,

            fastRouterReason:
              input.result
                .fastRouterReason ??
              null,

            fastRouterConfidence:
              input.result
                .fastRouterConfidence ??
              null,

            universalAiProvider:
              input.result
                .orchestration
                .provider ||
              input.result
                .aiProvider,

            universalAiStatus:
              input.result
                .orchestration
                .aiStatus ||
              input.result.status,

            universalAiError:
              input.result
                .orchestration
                .aiError ??
              null,

            universalAiModel:
              input.result
                .orchestration
                .aiModel ??
              null,

            universalAiConfigured:
              runtimeStatus.configured &&
              input.result
                .orchestration
                .aiStatus !==
                "missing",

            universalAiLatencyMs:
              input.result
                .orchestration
                .latencyMs ??
              null,

            environmentConfigured:
              runtimeStatus.configured,

            researchUsed:
              input.result
                .researchUsed ??
              input.result
                .orchestration
                .researchUsed,

            sources:
              input.result.sources ??
              input.result
                .orchestration
                .sources,

            spokenAccent:
              "British English",

            speechLanguage:
              "en-GB",

            voiceTranscript:
              input.voiceTranscript ??
              null,

            reportError:
              null,
          }),
      },
    },
  );
}

export async function GET() {
  const user =
    (await getCurrentUser()) as
      | CurrentUserShape
      | null;

  if (!user) {
    return noStoreJson(
      {
        error:
          "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    return noStoreJson(
      await loadBot(user),
    );
  } catch (error) {
    return noStoreJson(
      {
        error:
          "Unable to load AI Studio.",

        detail:
          error instanceof
            Error
            ? error.message
            : "Unknown error.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: Request,
) {
  const user =
    (await getCurrentUser()) as
      | CurrentUserShape
      | null;

  if (!user) {
    return noStoreJson(
      {
        error:
          "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  try {
    const body =
      (await request
        .json()
        .catch(
          () => ({}),
        )) as Record<
        string,
        unknown
      >;

    const action =
      readText(body.action);

    const profile =
      (await ensureBotProfile(
        user,
      )) as BotProfileRecord;

    if (
      action ===
      "saveOnboarding"
    ) {
      const answers =
        body.answers &&
        typeof body.answers ===
          "object" &&
        !Array.isArray(
          body.answers,
        )
          ? (body.answers as Record<
              string,
              string
            >)
          : defaultBotAnswers();

      const derived =
        deriveBotProfile(
          answers,
        );

      await db.personalUserBotProfile.update(
        {
          where: {
            userId:
              user.id,
          },

          data: {
            botName:
              readText(
                body.botName,
                profile.botName,
              ).slice(
                0,
                120,
              ),

            onboardingComplete:
              true,

            answersJson:
              asJson(
                answers,
              ),

            personalityJson:
              asJson(
                derived.personality,
              ),

            riskJson:
              asJson(
                derived.risk,
              ),

            capabilitiesJson:
              asJson(
                derived.capabilities,
              ),

            preferredTone:
              derived.preferredTone,

            commandStyle:
              derived.commandStyle,

            autonomyLevel:
              derived.autonomyLevel,

            voiceEnabled:
              true,

            customInstructions:
              "Use source-backed financial research, preserve client confidentiality, and never claim a platform action occurred unless the platform confirms it.",
          },
        },
      );

      return noStoreJson(
        await loadBot(user),
      );
    }

    if (
      action ===
      "updateProfile"
    ) {
      await db.personalUserBotProfile.update(
        {
          where: {
            userId:
              user.id,
          },

          data: {
            botName:
              readOptionalText(
                body.botName,
                120,
              ) ||
              undefined,

            preferredTone:
              readOptionalText(
                body.preferredTone,
                120,
              ) ||
              undefined,

            autonomyLevel:
              readOptionalText(
                body.autonomyLevel,
                180,
              ) ||
              undefined,

            commandStyle:
              readOptionalText(
                body.commandStyle,
                180,
              ) ||
              undefined,

            customInstructions:
              typeof body.customInstructions ===
              "string"
                ? readOptionalText(
                    body.customInstructions,
                    5000,
                  )
                : undefined,

            voiceEnabled:
              typeof body.voiceEnabled ===
              "boolean"
                ? body.voiceEnabled
                : undefined,
          },
        },
      );

      return noStoreJson(
        await loadBot(user),
      );
    }

    if (
      action === "updateTab"
    ) {
      const tabName =
        readText(
          body.tabName,
          "AI Studio",
        ).slice(0, 120);

      const notes =
        readText(
          body.notes,
          "",
        ).slice(0, 5000);

      const pinnedCommands =
        Array.isArray(
          body.pinnedCommands,
        )
          ? body.pinnedCommands
              .map((value) =>
                readText(value),
              )
              .filter(Boolean)
              .map((value) =>
                value.slice(
                  0,
                  500,
                ),
              )
              .slice(0, 30)
          : [];

      await db.personalUserBotWorkspaceTab.upsert(
        {
          where: {
            userId_tabName: {
              userId:
                user.id,

              tabName,
            },
          },

          update: {
            profileId:
              profile.id,

            notes,

            pinnedCommandsJson:
              asJson(
                pinnedCommands,
              ),

            status: "Active",
          },

          create: {
            userId:
              user.id,

            profileId:
              profile.id,

            tabName,

            notes,

            pinnedCommandsJson:
              asJson(
                pinnedCommands,
              ),

            layoutJson:
              asJson({
                mode:
                  "unified-financial-ai-studio-v7",
              }),

            status: "Active",
          },
        },
      );

      return noStoreJson(
        await loadBot(user),
      );
    }

    if (
      action === "verifyAi"
    ) {
      await verifyOpenAiConnection(
        {
          force: true,
        },
      );

      return noStoreJson(
        await loadBot(user),
      );
    }

    if (
      action ===
      "clearConversation"
    ) {
      await db.personalUserBotMessage.deleteMany(
        {
          where: {
            userId:
              user.id,
          },
        },
      );

      return noStoreJson(
        await loadBot(user),
      );
    }

    if (
      action ===
        "sendMessage" ||
      action ===
        "executeCommand" ||
      action ===
        "voiceCommand"
    ) {
      const prompt =
        readText(
          body.prompt,
        ).slice(
          0,
          30_000,
        );

      const answerMode =
        readAnswerMode(
          body.answerMode,
        );

      const voiceTranscript =
        typeof body.voiceTranscript ===
        "string"
          ? body.voiceTranscript
              .trim()
              .slice(
                0,
                30_000,
              )
          : null;

      const currentPath =
        readOptionalText(
          body.currentPath,
          500,
        ) ?? null;

      const pageTitle =
        readOptionalText(
          body.pageTitle,
          500,
        ) ?? null;

      const advancedSettings =
        readAdvancedSettings(
          body.advancedSettings,
        );

      if (!prompt) {
        return noStoreJson(
          {
            error:
              "Prompt is required.",
          },
          {
            status: 400,
          },
        );
      }

      const recentRows =
        await safe<any[]>(
          [],
          () =>
            db.personalUserBotMessage.findMany(
              {
                where: {
                  userId:
                    user.id,
                },

                orderBy: {
                  createdAt:
                    "desc",
                },

                take: 10,
              },
            ),
        );

      const recentMessages =
        recentRows
          .reverse()
          .map(
            (
              message: any,
            ) => ({
              role: String(
                message.role ||
                  "assistant",
              ),

              content:
                String(
                  message.content ||
                    "",
                ),
            }),
          );

      await db.personalUserBotMessage.create(
        {
          data: {
            userId:
              user.id,

            profileId:
              profile.id,

            role: "user",

            content: prompt,

            intent:
              voiceTranscript
                ? "Voice Command"
                : "Command",

            metadataJson:
              asJson({
                currentPath,

                pageTitle,

                answerMode,

                voiceTranscript,

                advancedSettings,

                unifiedRouter:
                  true,
              }),
          },
        },
      );

      const result =
        await executePersonalBotCommand(
          {
            user,

            profile,

            prompt,

            voiceTranscript,

            currentPath,

            pageTitle,

            answerMode,

            recentMessages,

            advancedSettings,
          },
        );

      await saveAssistantMessage(
        {
          user,

          profile,

          answerMode,

          result,

          voiceTranscript,
        },
      );

      return noStoreJson(
        await loadBot(
          user,
          result,
        ),
      );
    }

    return noStoreJson(
      await loadBot(user),
    );
  } catch (error) {
    return noStoreJson(
      {
        error:
          "AI Studio request failed.",

        detail:
          error instanceof
            Error
            ? error.message
            : "Unknown error.",
      },
      {
        status: 500,
      },
    );
  }
}