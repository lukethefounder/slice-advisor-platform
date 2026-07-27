import { randomBytes } from "crypto";
import {
  accessibleClientWhere,
  ensureAdvisorFirmContext,
} from "@/lib/client-access";
import {
  orchestrateAiStudioRequest,
  type AiStudioAnswerMode,
  type AiStudioOrchestrationResult,
  type AiStudioRecentMessage,
} from "@/lib/ai-studio/orchestrator";
import {
  searchSlicePlatformData,
  type SliceAiProfile,
  type SliceAiUser,
  type SliceCapability,
  type SlicePlatformSearchGroup,
} from "@/lib/ai-studio/platform-context";
import { recordAiToolRun } from "@/lib/backend/events";
import { runBackendJob } from "@/lib/backend/jobs";
import { queueBackendDelivery } from "@/lib/backend/notifications";
import {
  ensurePlatformBrain,
  recordTrainingPhrase,
} from "@/lib/bot/platform-brain";
import { encryptSensitiveText } from "@/lib/data-vault";
import type {
  AiSource,
  SliceStructuredCommand,
} from "@/lib/integrations/ai";
import { prisma } from "@/lib/prisma";

const db = prisma as any;

export type CurrentUserShape = SliceAiUser;
export type BotProfileShape = SliceAiProfile;

export type CommandExecutionResult = {
  intent: string;
  answer: string;
  clientAction: Record<string, unknown>;
  status: string;
  resultSummary: string;
  action: Record<string, unknown>;
  aiProvider: string;
  sources?: AiSource[];
  researchUsed?: boolean;
};

export type ExecutePersonalBotCommandInput = {
  user: CurrentUserShape;
  profile: BotProfileShape;
  prompt: string;
  voiceTranscript?: string | null;
  currentPath?: string | null;
  pageTitle?: string | null;
  answerMode?: AiStudioAnswerMode;
  recentMessages?: AiStudioRecentMessage[];
  advancedSettings?: Record<string, unknown> | null;
};

export type ExecutePersonalBotCommandResult =
  CommandExecutionResult & {
    commandRecord: any;
    structuredCommand: SliceStructuredCommand;
    aiParserOk: boolean;
    aiParserError?: string;
    fastRouterUsed: boolean;
    fastRouterReason?: string;
    fastRouterConfidence?: number;

    orchestration: {
      provider: string;
      status: string;
      researchUsed: boolean;
      sources: AiSource[];
      aiModel?: string;
      aiStatus?: string;
      aiError?: string;
      latencyMs?: number;
    };
  };

function asJson(value: unknown) {
  return JSON.stringify(value);
}

function parseJson<T>(
  value: string | null | undefined,
  fallback: T,
): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
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

function normalize(
  value: string | null | undefined,
) {
  return String(value ?? "")
    .toLowerCase()
    .replace(
      /[^a-z0-9#\s$@._/-]/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function safeText(
  value: string | null | undefined,
  fallback = "",
) {
  return value?.trim() || fallback;
}

function safeTicker(
  command: SliceStructuredCommand,
  prompt: string,
) {
  const explicit =
    command.parameters.ticker ||
    command.parameters.symbol;

  if (explicit) {
    return explicit.toUpperCase();
  }

  const match = prompt
    .toUpperCase()
    .match(
      /\b(NVDA|AAPL|MSFT|TSLA|META|GOOGL|GOOG|AMZN|AMD|NFLX|SPY|QQQ|IWM|TLT|AVGO|CRM|PLTR|COIN|MSTR|JPM|BAC|GS|BLK|SCHW|BRK\.B|[A-Z]{2,5})\b/,
    );

  return match?.[0] ?? null;
}

function safeNumber(
  value: number | null | undefined,
) {
  return typeof value === "number" &&
    Number.isFinite(value)
    ? value
    : null;
}

function currency(
  value: number | null | undefined,
) {
  if (
    typeof value !== "number" ||
    !Number.isFinite(value)
  ) {
    return "not set";
  }

  return new Intl.NumberFormat(
    "en-US",
    {
      style: "currency",
      currency: "USD",
      maximumFractionDigits:
        value >= 10 ? 0 : 2,
    },
  ).format(value);
}

function cleanTitle(
  value: string,
  fallback: string,
  maximum = 160,
) {
  return (
    value
      .replace(
        /[^a-z0-9\s.,:;!?()&'"/_-]/gi,
        " ",
      )
      .replace(/\s+/g, " ")
      .trim()
      .slice(0, maximum) ||
    fallback
  );
}

function memoryKey(value: string) {
  return (
    normalize(value)
      .replace(/[^a-z0-9]+/g, "-")
      .replace(
        /^-+|-+$/g,
        "",
      )
      .slice(0, 90) ||
    `memory-${Date.now()}`
  );
}

function safeDate(
  value: string | null | undefined,
) {
  if (!value) return null;

  const direct = new Date(value);

  if (
    !Number.isNaN(
      direct.getTime(),
    )
  ) {
    return direct;
  }

  const localDate = new Date(
    `${value}T00:00:00`,
  );

  return Number.isNaN(
    localDate.getTime(),
  )
    ? null
    : localDate;
}

function backendContext(
  user: CurrentUserShape,
  profile: BotProfileShape,
) {
  return {
    userId: user.id,
    firmId: profile.firmId,
    actorName: user.name,
    actorEmail: user.email,
  };
}

function sourcesAsPlainText(
  sources: AiSource[],
) {
  return sources
    .slice(0, 12)
    .map(
      (source, index) =>
        `${index + 1}. ${
          source.title
        } — ${source.url}`,
    )
    .join("\n");
}

function reportSummary(
  answer: string,
) {
  const clean = answer
    .replace(/\s+/g, " ")
    .trim();

  if (!clean) {
    return "Slice AI report prepared for advisor review.";
  }

  return clean.length > 900
    ? `${clean
        .slice(0, 900)
        .trim()}...`
    : clean;
}

function reportBullets(
  answer: string,
) {
  const lines = answer
    .split(/\n+/)
    .map((line) =>
      line
        .replace(
          /^#{1,6}\s*/,
          "",
        )
        .replace(
          /^[-*•]\s*/,
          "",
        )
        .replace(
          /^\d+\.\s*/,
          "",
        )
        .trim(),
    )
    .filter(
      (line) =>
        line.length >= 25 &&
        line.length <= 360,
    )
    .slice(0, 8);

  return lines.length
    ? lines
    : [
        "Review the AI-generated analysis for factual accuracy and source freshness.",
        "Confirm client suitability, liquidity, time horizon, tax sensitivity, and concentration risk before external use.",
        "Document final advisor decisions and any changes made after review.",
      ];
}

function buildReportSections(
  input: {
    prompt: string;
    answer: string;
    sources: AiSource[];
  },
) {
  return [
    {
      title: "Executive Summary",
      body: reportSummary(
        input.answer,
      ),
      bullets: reportBullets(
        input.answer,
      ).slice(0, 4),
    },
    {
      title: "Original Request",
      body: input.prompt,
    },
    {
      title:
        "Research and Analysis",
      body: input.answer,
    },
    {
      title:
        "Research Sources",

      body: input.sources.length
        ? "The following public sources were returned by the OpenAI research layer."
        : "No external sources were returned. The report should not be treated as externally researched until sources are added and verified.",

      bullets: input.sources
        .length
        ? input.sources
            .map(
              (source) =>
                `${source.title} — ${source.url}`,
            )
            .slice(0, 12)
        : [
            "Verify all current, market-sensitive, regulatory, and company-specific claims before use.",
          ],
    },
    {
      title:
        "Advisor Review Checklist",

      bullets: [
        "Verify source dates, source authority, and any quoted market or economic data.",
        "Confirm that no private client identifier was used in public research.",
        "Review suitability, risk tolerance, liquidity needs, time horizon, concentration, and tax sensitivity.",
        "Separate education, scenario analysis, and individualized recommendations.",
        "Obtain required firm or compliance approval before external distribution.",
      ],
    },
  ];
}

function orchestrationProvider(
  orchestration: AiStudioOrchestrationResult,
) {
  return (
    orchestration.aiResponse
      ?.provider ||
    orchestration.provider ||
    "Slice AI"
  );
}

function orchestrationFailureAnswer(
  orchestration: AiStudioOrchestrationResult,
) {
  const error =
    orchestration.aiResponse
      ?.error;

  if (error) {
    return `The AI request was understood, but a verified response could not be completed.

Error: ${error}

Check OPENAI_API_KEY, billing, model access, and web-search access, then retry.`;
  }

  return orchestration.answer;
}

export async function resolveFirmId(
  userId: string,
) {
  try {
    const membership =
      await ensureAdvisorFirmContext(
        userId,
      );

    return membership.firmId;
  } catch {
    const membership =
      await db.firmMembership.findFirst(
        {
          where: {
            userId,
            status: "Active",
          },

          orderBy: {
            createdAt: "desc",
          },
        },
      );

    return (
      membership?.firmId ??
      null
    );
  }
}

export async function ensureBotProfile(
  user: CurrentUserShape,
): Promise<BotProfileShape> {
  const firmId =
    await resolveFirmId(
      user.id,
    );

  const firstName =
    user.name
      ?.split(/\s+/)?.[0] ||
    "Slice";

  const profile =
    await db.personalUserBotProfile.upsert(
      {
        where: {
          userId: user.id,
        },

        update: {
          firmId,
        },

        create: {
          userId: user.id,
          firmId,

          botName:
            `${firstName} AI`,

          onboardingComplete:
            true,

          answersJson: "{}",

          personalityJson:
            asJson({
              tone:
                "Professional",

              spokenAccent:
                "British English",

              detailLevel:
                "Balanced detail",

              researchStyle:
                "Source-first financial research",
            }),

          riskJson: asJson({
            complianceCaution:
              "Extra cautious",

            externalActions:
              "Advisor approval required",
          }),

          capabilitiesJson:
            asJson([
              "Researched financial answers with visible sources",
              "Unified typed and voice command execution",
              "Permission-scoped Slice platform knowledge",
              "Investment and market research",
              "Internal firm and client-record search",
              "Task and project creation",
              "Client profile creation and advisor assignment",
              "Watchlists and price alerts",
              "Approval-gated communications and deliveries",
              "Advisor-ready report generation",
              "Backend jobs and operating health checks",
              "Workspace memory and personalised tone",
            ]),

          preferredTone:
            "Professional",

          commandStyle:
            "Balanced detail",

          autonomyLevel:
            "Advisor approval required",

          voiceEnabled: true,

          customInstructions:
            "Use source-backed financial research, preserve client confidentiality, and never claim a platform action occurred unless the platform confirms it.",
        },
      },
    );

  await ensurePlatformBrain(
    user.id,
    firmId,
  );

  await safe(null, () =>
    db.personalUserUiPreference.upsert(
      {
        where: {
          userId: user.id,
        },

        update: {},

        create: {
          userId: user.id,

          accentName:
            "Market Green",

          accentHex:
            "#059669",

          accentDarkHex:
            "#064e3b",

          accentSoftHex:
            "#d1fae5",

          backgroundStyle:
            "Premium Dark",

          preferenceSource:
            "Personal Bot",
        },
      },
    ),
  );

  const tabData = {
    profileId: profile.id,

    layoutJson: asJson({
      mode:
        "unified-financial-ai-studio-v7",

      sections: [
        "researched command chat",
        "voice operations",
        "platform actions",
        "permission-scoped context",
        "reports",
        "tasks",
        "approvals",
        "memory",
      ],
    }),

    pinnedCommandsJson:
      asJson([
        "Research NVDA with current sources, catalysts, valuation context, and risks.",
        "Open client profiles.",
        "Search the firm for Apple exposure.",
        "Create a high-priority task to review the latest client briefing tomorrow.",
        "Create a source-backed client report explaining market volatility.",
        "Create a price alert for MSFT above 600.",
        "Run backend vendor health.",
        "Show pending approvals.",
      ]),

    notes:
      "Unified Slice AI Studio using one financial research and platform-command path for typed messages, voice operations, and reports.",

    status: "Active",
  };

  await Promise.all([
    safe(null, () =>
      db.personalUserBotWorkspaceTab.upsert(
        {
          where: {
            userId_tabName: {
              userId: user.id,
              tabName:
                "AI Studio",
            },
          },

          update: tabData,

          create: {
            userId: user.id,

            tabName:
              "AI Studio",

            ...tabData,
          },
        },
      ),
    ),

    safe(null, () =>
      db.personalUserBotWorkspaceTab.upsert(
        {
          where: {
            userId_tabName: {
              userId: user.id,
              tabName: "My Bot",
            },
          },

          update: tabData,

          create: {
            userId: user.id,
            tabName: "My Bot",
            ...tabData,
          },
        },
      ),
    ),
  ]);

  return profile as BotProfileShape;
}

async function createBotCommandRecord(
  input: {
    userId: string;
    profileId: string;
    firmId: string | null;
    commandText: string;
    commandType: string;
    status: string;
    resultSummary: string;
    action: Record<
      string,
      unknown
    >;
  },
) {
  return db.personalUserBotCommand.create(
    {
      data: {
        userId: input.userId,
        profileId:
          input.profileId,
        firmId: input.firmId,
        commandText:
          input.commandText,
        commandType:
          input.commandType,
        status: input.status,
        resultSummary:
          input.resultSummary,
        actionJson: asJson(
          input.action,
        ),
      },
    },
  );
}

async function createApproval(
  input: {
    user: CurrentUserShape;
    profile: BotProfileShape;
    title: string;
    actionType: string;
    riskLevel: string;
    summary: string;
    payload: Record<
      string,
      unknown
    >;
  },
) {
  const approval =
    await db.backendApprovalItem.create(
      {
        data: {
          userId: input.user.id,

          firmId:
            input.profile.firmId,

          title: input.title,

          actionType:
            input.actionType,

          riskLevel:
            input.riskLevel,

          summary: input.summary,

          payloadJson:
            asJson(input.payload),

          requestedBy:
            input.user.email,

          status: "Pending",
        },
      },
    );

  await db.personalUserBotApprovalItem.create(
    {
      data: {
        userId: input.user.id,

        profileId:
          input.profile.id,

        firmId:
          input.profile.firmId,

        title: input.title,

        actionType:
          input.actionType,

        riskLevel:
          input.riskLevel,

        summary: input.summary,

        payloadJson: asJson({
          backendApprovalItemId:
            approval.id,

          ...input.payload,
        }),

        status: "Pending",
      },
    },
  );

  return approval;
}

async function ensureAgenda(
  userId: string,
  firmId: string | null,
) {
  if (!firmId) return null;

  const membership =
    await db.firmMembership.findFirst(
      {
        where: {
          userId,
          firmId,
          status: "Active",
        },
      },
    );

  if (!membership) return null;

  if (
    !membership.canManageProjects &&
    !membership.canManageFirm
  ) {
    return null;
  }

  const weekStart =
    new Date()
      .toISOString()
      .slice(0, 10);

  return db.weeklyAgenda.upsert(
    {
      where: {
        id: `${firmId}-${membership.id}-ai-bot-agenda`,
      },

      update: {
        weekStart,

        title:
          "AI command agenda",

        focus:
          "Verified tasks created through the Slice AI command layer.",

        status: "Open",
      },

      create: {
        id: `${firmId}-${membership.id}-ai-bot-agenda`,

        firmId,

        membershipId:
          membership.id,

        weekStart,

        title:
          "AI command agenda",

        focus:
          "Verified tasks created through the Slice AI command layer.",

        status: "Open",
      },
    },
  );
}

async function executeNavigate(
  command: SliceStructuredCommand,
): Promise<CommandExecutionResult> {
  const href =
    command.route ||
    command.parameters.route ||
    "/workspace";

  return {
    intent: "Navigate",

    answer:
      command.answer ||
      `Opening ${href}.`,

    clientAction: {
      type: "navigate",
      href,
      autoRun: true,
    },

    status: "Complete",

    resultSummary:
      `Navigation requested: ${href}`,

    action: {
      href,
    },

    aiProvider:
      "Slice Fast Router",
  };
}

async function executeAnswer(
  orchestration: AiStudioOrchestrationResult,
): Promise<CommandExecutionResult> {
  const ai =
    orchestration.aiResponse;

  return {
    intent: "Answer",

    answer: ai?.ok
      ? orchestration.answer
      : orchestrationFailureAnswer(
          orchestration,
        ),

    clientAction: {
      type: "none",
      autoRun: false,
    },

    status: ai?.ok
      ? "Complete"
      : ai?.status ||
        "Failed",

    resultSummary: ai?.ok
      ? `Answered through ${orchestrationProvider(
          orchestration,
        )} with ${
          orchestration.sources
            .length
        } source(s).`
      : ai?.error ||
        "AI answer failed.",

    action: {
      provider:
        orchestrationProvider(
          orchestration,
        ),

      model: ai?.model,
      status: ai?.status,
      error: ai?.error,

      sources:
        orchestration.sources,

      researchUsed:
        orchestration.researchUsed,

      requestId:
        ai?.requestId,

      latencyMs:
        ai?.latencyMs,
    },

    aiProvider:
      orchestrationProvider(
        orchestration,
      ),

    sources:
      orchestration.sources,

    researchUsed:
      orchestration.researchUsed,
  };
}

async function executePlatformSearch(
  input: {
    user: CurrentUserShape;
    profile: BotProfileShape;
    command: SliceStructuredCommand;
    prompt: string;
  },
): Promise<CommandExecutionResult> {
  const ticker = safeTicker(
    input.command,
    input.prompt,
  );

  const query =
    input.command.parameters
      .query ||
    ticker ||
    input.prompt;

  const result =
    await searchSlicePlatformData(
      {
        user: input.user,
        profile:
          input.profile,
        query,
        ticker,
      },
    );

  await safe(null, () =>
    db.personalUserBotDataView.upsert(
      {
        where: {
          userId_viewName: {
            userId:
              input.user.id,

            viewName:
              `Firm Search · ${(
                ticker || query
              ).slice(0, 40)}`,
          },
        },

        update: {
          profileId:
            input.profile.id,

          viewType:
            "Firm Search",

          filterJson: asJson({
            query,
            ticker,
          }),

          sortJson: asJson({
            by: "grouped relevance",
          }),

          resultJson:
            asJson(
              result.groups,
            ),
        },

        create: {
          userId:
            input.user.id,

          profileId:
            input.profile.id,

          viewName:
            `Firm Search · ${(
              ticker || query
            ).slice(0, 40)}`,

          viewType:
            "Firm Search",

          filterJson: asJson({
            query,
            ticker,
          }),

          sortJson: asJson({
            by: "grouped relevance",
          }),

          resultJson:
            asJson(
              result.groups,
            ),
        },
      },
    ),
  );

  const answer = result.total
    ? `I found ${result.total} permission-scoped Slice result(s) for "${ticker || query}".

${result.groups
  .map(
    (
      group: SlicePlatformSearchGroup,
    ) =>
      `${group.label}:
${group.items
  .map(
    (
      item: SlicePlatformSearchGroup["items"][number],
      index: number,
    ) =>
      `  ${index + 1}. ${
        item.title
      }${
        item.detail
          ? ` — ${item.detail}`
          : ""
      }`,
  )
  .join("\n")}`,
  )
  .join("\n\n")}`
    : `I did not find a permission-scoped Slice or firm record for "${ticker || query}".`;

  return {
    intent:
      "Platform Search",

    answer,

    clientAction: {
      type: "navigate",

      href:
        result.groups[0]
          ?.route ||
        "/advisor-command-center",

      autoRun: false,
    },

    status: "Complete",

    resultSummary:
      `Permission-scoped platform search returned ${result.total} result(s).`,

    action:
      result as unknown as Record<
        string,
        unknown
      >,

    aiProvider:
      "Slice Platform Search",
  };
}

async function executeSourceLookup(
  input: {
    user: CurrentUserShape;
    profile: BotProfileShape;
    command: SliceStructuredCommand;
    prompt: string;
    orchestration: AiStudioOrchestrationResult;
  },
): Promise<CommandExecutionResult> {
  const ticker = safeTicker(
    input.command,
    input.prompt,
  );

  const query =
    input.command.parameters
      .query ||
    ticker ||
    input.prompt;

  const internal =
    await searchSlicePlatformData(
      {
        user: input.user,
        profile:
          input.profile,
        query,
        ticker,
      },
    );

  const internalSources =
    internal.groups.flatMap(
      (
        group: SlicePlatformSearchGroup,
      ) =>
        group.items
          .filter(
            (
              item: SlicePlatformSearchGroup["items"][number],
            ) =>
              Boolean(
                item.sourceUrl,
              ),
          )
          .map(
            (
              item: SlicePlatformSearchGroup["items"][number],
            ) => ({
              type:
                "web" as const,

              title:
                item.title,

              url:
                item.sourceUrl as string,
            }),
          ),
    );

  const combined =
    new Map<
      string,
      AiSource
    >();

  for (const source of [
    ...input.orchestration
      .sources,

    ...internalSources,
  ]) {
    if (
      source.url &&
      !combined.has(
        source.url,
      )
    ) {
      combined.set(
        source.url,
        source,
      );
    }
  }

  const sources =
    Array.from(
      combined.values(),
    ).slice(0, 16);

  const externalAnswer =
    input.orchestration
      .aiResponse?.ok
      ? input.orchestration
          .answer
      : "";

  const answer = externalAnswer
    ? externalAnswer
    : sources.length
      ? `I found ${sources.length} source-backed item(s) for "${query}".

${sourcesAsPlainText(
  sources,
)}`
      : orchestrationFailureAnswer(
          input.orchestration,
        );

  return {
    intent:
      "Source Lookup",

    answer,

    clientAction: sources[0]
      ? {
          type: "source",
          href:
            sources[0].url,
          autoRun: false,
        }
      : {
          type: "navigate",
          href: "/triage",
          autoRun: false,
        },

    status: sources.length
      ? "Complete"
      : input.orchestration
            .aiResponse
            ?.status ||
        "No Source Found",

    resultSummary:
      sources.length
        ? `Found ${sources.length} unique source-backed item(s).`
        : "No verified source was returned.",

    action: {
      query,
      ticker,
      sources,

      internalResultCount:
        internal.total,

      provider:
        orchestrationProvider(
          input.orchestration,
        ),
    },

    aiProvider:
      orchestrationProvider(
        input.orchestration,
      ),

    sources,

    researchUsed:
      input.orchestration
        .researchUsed,
  };
}

async function executeResearch(
  input: {
    user: CurrentUserShape;
    profile: BotProfileShape;
    command: SliceStructuredCommand;
    prompt: string;
    orchestration: AiStudioOrchestrationResult;
  },
): Promise<CommandExecutionResult> {
  const ticker = safeTicker(
    input.command,
    input.prompt,
  );

  const query =
    input.command.parameters
      .query ||
    ticker ||
    input.prompt;

  const depth =
    input.command.parameters
      .researchDepth ||
    "standard";

  const ai =
    input.orchestration
      .aiResponse;

  if (
    !ai?.ok ||
    !input.orchestration.answer.trim()
  ) {
    return {
      intent: "Research",

      answer:
        orchestrationFailureAnswer(
          input.orchestration,
        ),

      clientAction: {
        type: "navigate",

        href: ticker
          ? `/market-visuals?symbol=${encodeURIComponent(
              ticker,
            )}`
          : "/triage",

        autoRun: false,
      },

      status:
        ai?.status ||
        "Failed",

      resultSummary:
        ai?.error ||
        "Research could not be completed.",

      action: {
        query,
        ticker,
        depth,

        provider:
          orchestrationProvider(
            input.orchestration,
          ),

        error: ai?.error,
      },

      aiProvider:
        orchestrationProvider(
          input.orchestration,
        ),

      sources:
        input.orchestration
          .sources,

      researchUsed:
        input.orchestration
          .researchUsed,
    };
  }

  const memo =
    input.orchestration
      .answer;

  const sourceLinks =
    input.orchestration.sources
      .map(
        (source: AiSource) =>
          source.url,
      )
      .join("\n");

  const confidenceScore =
    input.orchestration.sources
      .length >= 3
      ? 90
      : 78;

  const note =
    await db.researchNote.create(
      {
        data: {
          userId:
            input.user.id,

          ticker,

          title: cleanTitle(
            `AI Research · ${
              ticker || query
            }`,
            "AI Research",
            140,
          ),

          thesis:
            memo.slice(
              0,
              5000,
            ),

          risks:
            "AI-assisted research. Verify source freshness, valuation inputs, suitability, liquidity, concentration, tax sensitivity, and compliance requirements before client-facing use.",

          decision: "Review",

          conviction:
            input.orchestration
              .sources
              .length >= 3
              ? "Medium"
              : "Low",

          sourceLinks:
            sourceLinks ||
            null,
        },
      },
    );

  const researchRun =
    await safe<any>(
      null,
      () =>
        db.personalUserBotResearchRun.create(
          {
            data: {
              userId:
                input.user.id,

              profileId:
                input.profile
                  .id,

              firmId:
                input.profile
                  .firmId,

              query,
              ticker,
              depth,

              status:
                "Complete",

              answerJson:
                asJson({
                  memo,

                  provider:
                    ai.provider,

                  model:
                    ai.model,

                  sources:
                    input
                      .orchestration
                      .sources,

                  researchUsed:
                    input
                      .orchestration
                      .researchUsed,
                }),

              sourceSnapshotJson:
                asJson(
                  input
                    .orchestration
                    .compactPlatformContext,
                ),

              confidenceScore,
            },
          },
        ),
    );

  return {
    intent: "Research",
    answer: memo,

    clientAction: {
      type: "navigate",

      href: ticker
        ? `/market-visuals?symbol=${encodeURIComponent(
            ticker,
          )}`
        : "/advisor-command-center",

      autoRun: false,
    },

    status: "Complete",

    resultSummary:
      `Created source-backed AI research for ${ticker || query}.`,

    action: {
      researchNoteId:
        note.id,

      researchRunId:
        researchRun?.id ??
        null,

      ticker,
      query,
      depth,

      provider:
        ai.provider,

      model: ai.model,

      sources:
        input.orchestration
          .sources,

      requestId:
        ai.requestId,
    },

    aiProvider:
      ai.provider,

    sources:
      input.orchestration
        .sources,

    researchUsed:
      input.orchestration
        .researchUsed,
  };
}

async function executeCreateTask(
  input: {
    user: CurrentUserShape;
    profile: BotProfileShape;
    command: SliceStructuredCommand;
    prompt: string;
  },
): Promise<CommandExecutionResult> {
  const title = cleanTitle(
    safeText(
      input.command.parameters
        .title,
      input.prompt,
    ),

    "AI Studio follow-up task",
  );

  const detail = safeText(
    input.command.parameters
      .detail,

    "Created by the Slice AI command layer.",
  ).slice(0, 5000);

  const priority = safeText(
    input.command.parameters
      .priority,

    "Medium",
  );

  const dueDateText =
    input.command.parameters
      .dueDate ||
    new Date()
      .toISOString()
      .slice(0, 10);

  const dueDate =
    safeDate(dueDateText) ||
    new Date();

  const agenda =
    await ensureAgenda(
      input.user.id,
      input.profile.firmId,
    );

  if (agenda) {
    const task =
      await db.firmAgendaTask.create(
        {
          data: {
            firmId:
              agenda.firmId,

            agendaId:
              agenda.id,

            title,
            detail,
            priority,

            status: "Open",

            dueDate:
              dueDateText,
          },
        },
      );

    return {
      intent: "Create Task",

      answer:
        `Task created: ${task.title}`,

      clientAction: {
        type: "navigate",
        href:
          "/workspace/team-board",
        autoRun: false,
      },

      status: "Complete",

      resultSummary:
        `Created firm task: ${task.title}`,

      action: {
        taskId: task.id,

        taskType:
          "Firm Agenda Task",

        href:
          "/workspace/team-board",
      },

      aiProvider:
        "Slice Task Tool",
    };
  }

  const task =
    await db.meetingTask.create(
      {
        data: {
          userId:
            input.user.id,

          title,

          description: detail,

          dueDate,

          priority,

          status: "Open",
        },
      },
    );

  return {
    intent: "Create Task",

    answer:
      `Personal task created: ${task.title}`,

    clientAction: {
      type: "navigate",
      href:
        "/workspace/team-board",
      autoRun: false,
    },

    status: "Complete",

    resultSummary:
      `Created personal task: ${task.title}`,

    action: {
      taskId: task.id,

      taskType:
        "Personal Task",

      href:
        "/workspace/team-board",
    },

    aiProvider:
      "Slice Task Tool",
  };
}

async function executeCreateClient(
  input: {
    user: CurrentUserShape;
    command: SliceStructuredCommand;
  },
): Promise<CommandExecutionResult> {
  const proposedName =
    safeText(
      input.command.parameters
        .clientName ||
        input.command.parameters
          .title,

      "",
    );

  if (
    !proposedName ||
    normalize(proposedName) ===
      "new client"
  ) {
    return {
      intent: "Create Client",

      answer:
        "I need the client's full name before I can create the profile.",

      clientAction: {
        type: "navigate",
        href:
          "/workspace/clients",
        autoRun: false,
      },

      status:
        "Needs Details",

      resultSummary:
        "Client creation needs a full name.",

      action: {
        href:
          "/workspace/clients",
      },

      aiProvider:
        "Slice Client Tool",
    };
  }

  const access =
    await accessibleClientWhere(
      input.user.id,
    );

  const fullName =
    cleanTitle(
      proposedName,
      "New Client",
      240,
    );

  const email =
    input.command.parameters
      .email
      ?.trim()
      .toLowerCase() ||
    null;

  const client =
    await db.clientProfile.create(
      {
        data: {
          userId:
            input.user.id,

          firmId:
            access.membership
              .firmId,

          assignedAdvisorMembershipId:
            access.membership.id,

          assignedAdvisorAt:
            new Date(),

          assignedByUserId:
            input.user.id,

          fullName,

          email:
            encryptSensitiveText(
              email,
            ),

          householdName:
            fullName,

          clientType:
            "Private Client",

          riskProfile:
            "Balanced",

          liquidityNeeds:
            "Moderate",

          timeHorizon:
            "5-10 years",

          objective:
            "Long-term wealth growth",

          status: "Active",

          notes:
            encryptSensitiveText(
              "Created by the Slice AI command layer.",
            ),
        },
      },
    );

  return {
    intent: "Create Client",

    answer:
      `Client profile created and assigned to you: ${client.fullName}.`,

    clientAction: {
      type: "navigate",

      href:
        `/workspace/clients?clientId=${encodeURIComponent(
          client.id,
        )}`,

      autoRun: false,
    },

    status: "Complete",

    resultSummary:
      `Created client ${client.fullName} in firm ${access.membership.firmId}.`,

    action: {
      clientId: client.id,

      firmId:
        access.membership
          .firmId,

      assignedAdvisorMembershipId:
        access.membership.id,

      href:
        `/workspace/clients?clientId=${encodeURIComponent(
          client.id,
        )}`,
    },

    aiProvider:
      "Slice Client Tool",
  };
}

async function executeCreateProject(
  input: {
    user: CurrentUserShape;
    profile: BotProfileShape;
    command: SliceStructuredCommand;
    prompt: string;
  },
): Promise<CommandExecutionResult> {
  const membership =
    await ensureAdvisorFirmContext(
      input.user.id,
    );

  if (
    !membership.canManageProjects &&
    !membership.canManageFirm
  ) {
    return {
      intent:
        "Create Project",

      answer:
        "Your current firm role does not permit project creation. A firm manager can grant project-management permission.",

      clientAction: {
        type: "navigate",
        href:
          "/workspace/team-board",
        autoRun: false,
      },

      status:
        "Permission Denied",

      resultSummary:
        "Project creation was blocked by firm permissions.",

      action: {
        firmId:
          membership.firmId,

        role:
          membership.role,

        href:
          "/workspace/team-board",
      },

      aiProvider:
        "Slice Project Tool",
    };
  }

  const title = cleanTitle(
    safeText(
      input.command.parameters
        .projectTitle ||
        input.command.parameters
          .title,

      input.prompt,
    ),

    "AI Studio Project",
    180,
  );

  const project =
    await db.firmProject.create(
      {
        data: {
          firmId:
            membership.firmId,

          title,

          description: safeText(
            input.command.parameters
              .detail,

            "Created by the Slice AI command layer.",
          ),

          status: "Active",

          priority:
            input.command
              .parameters
              .priority ||
            "Medium",

          dueDate:
            input.command
              .parameters
              .dueDate,
        },
      },
    );

  return {
    intent: "Create Project",

    answer:
      `Project created: ${project.title}.`,

    clientAction: {
      type: "navigate",
      href:
        "/workspace/team-board",
      autoRun: false,
    },

    status: "Complete",

    resultSummary:
      `Created firm project: ${project.title}`,

    action: {
      projectId:
        project.id,

      firmId:
        membership.firmId,

      href:
        "/workspace/team-board",
    },

    aiProvider:
      "Slice Project Tool",
  };
}

async function executeCreateWatchlistItem(
  input: {
    user: CurrentUserShape;
    command: SliceStructuredCommand;
    prompt: string;
  },
): Promise<CommandExecutionResult> {
  const symbol = safeTicker(
    input.command,
    input.prompt,
  );

  if (!symbol) {
    return {
      intent:
        "Create Watchlist Item",

      answer:
        "I need a public ticker symbol before I can add a watchlist item.",

      clientAction: {
        type: "navigate",
        href:
          "/watchlist-alerts",
        autoRun: false,
      },

      status:
        "Needs Ticker",

      resultSummary:
        "Watchlist item was not created because no ticker was found.",

      action: {
        href:
          "/watchlist-alerts",
      },

      aiProvider:
        "Slice Watchlist Tool",
    };
  }

  const watchlistName =
    safeText(
      input.command.parameters
        .watchlistName,

      "AI Command Watchlist",
    ).slice(0, 120);

  const watchlist =
    await db.namedWatchlist.upsert(
      {
        where: {
          userId_name: {
            userId:
              input.user.id,

            name:
              watchlistName,
          },
        },

        update: {
          description:
            "Watchlist managed through Slice AI commands.",
        },

        create: {
          userId:
            input.user.id,

          name:
            watchlistName,

          description:
            "Watchlist managed through Slice AI commands.",

          focus:
            "AI monitored opportunities",

          riskLevel: "Mixed",
        },
      },
    );

  const item =
    await db.namedWatchlistItem.upsert(
      {
        where: {
          watchlistId_symbol: {
            watchlistId:
              watchlist.id,

            symbol,
          },
        },

        update: {
          assetName:
            input.command
              .parameters
              .title ||
            symbol,

          thesis:
            input.command
              .parameters
              .detail ||
            input.prompt,

          status: "Watching",

          priority:
            input.command
              .parameters
              .priority ||
            "Medium",
        },

        create: {
          userId:
            input.user.id,

          watchlistId:
            watchlist.id,

          symbol,

          assetName:
            input.command
              .parameters
              .title ||
            symbol,

          assetType: "Stock",

          sourceType:
            "AI Command",

          thesis:
            input.command
              .parameters
              .detail ||
            input.prompt,

          riskNotes:
            "Added by AI command. Research, suitability, and advisor review are required before client-facing action.",

          status: "Watching",

          priority:
            input.command
              .parameters
              .priority ||
            "Medium",
        },
      },
    );

  return {
    intent:
      "Create Watchlist Item",

    answer:
      `${symbol} was added to ${watchlist.name}.`,

    clientAction: {
      type: "navigate",
      href:
        "/watchlist-alerts",
      autoRun: false,
    },

    status: "Complete",

    resultSummary:
      `Added ${symbol} to watchlist ${watchlist.name}.`,

    action: {
      watchlistId:
        watchlist.id,

      itemId: item.id,

      symbol,
    },

    aiProvider:
      "Slice Watchlist Tool",
  };
}

async function executeCreatePriceAlert(
  input: {
    user: CurrentUserShape;
    command: SliceStructuredCommand;
    prompt: string;
  },
): Promise<CommandExecutionResult> {
  const symbol = safeTicker(
    input.command,
    input.prompt,
  );

  const upperTargetPrice =
    safeNumber(
      input.command.parameters
        .upperTargetPrice,
    );

  const lowerTargetPrice =
    safeNumber(
      input.command.parameters
        .lowerTargetPrice,
    );

  if (!symbol) {
    return {
      intent:
        "Create Price Alert",

      answer:
        "I need a ticker symbol before I can create the price alert.",

      clientAction: {
        type: "navigate",
        href:
          "/watchlist-alerts",
        autoRun: false,
      },

      status:
        "Needs Ticker",

      resultSummary:
        "Price alert was not created because no ticker was found.",

      action: {
        href:
          "/watchlist-alerts",
      },

      aiProvider:
        "Slice Price Alert Tool",
    };
  }

  if (
    upperTargetPrice ===
      null &&
    lowerTargetPrice ===
      null
  ) {
    return {
      intent:
        "Create Price Alert",

      answer:
        `I found ${symbol}, but I need an upper or lower target price before creating the alert.`,

      clientAction: {
        type: "navigate",
        href:
          "/watchlist-alerts",
        autoRun: false,
      },

      status:
        "Needs Target",

      resultSummary:
        "Price alert was not created because no target price was found.",

      action: {
        symbol,

        href:
          "/watchlist-alerts",
      },

      aiProvider:
        "Slice Price Alert Tool",
    };
  }

  const alert =
    await db.watchlistPriceAlert.create(
      {
        data: {
          userId:
            input.user.id,

          symbol,

          assetName: symbol,

          upperTargetPrice,

          lowerTargetPrice,

          notificationChannel:
            input.command
              .parameters
              .deliveryChannel ||
            "Dashboard",

          status: "Active",

          notes:
            input.command
              .parameters
              .detail ||
            input.prompt,
        },
      },
    );

  return {
    intent:
      "Create Price Alert",

    answer:
      `Price alert created for ${symbol}. Upper target: ${currency(
        upperTargetPrice,
      )}. Lower target: ${currency(
        lowerTargetPrice,
      )}.`,

    clientAction: {
      type: "navigate",
      href:
        "/watchlist-alerts",
      autoRun: false,
    },

    status: "Complete",

    resultSummary:
      `Created price alert for ${symbol}.`,

    action: {
      alertId: alert.id,
      symbol,
      upperTargetPrice,
      lowerTargetPrice,
    },

    aiProvider:
      "Slice Price Alert Tool",
  };
}

async function executeSortData(
  input: {
    user: CurrentUserShape;
    profile: BotProfileShape;
    orchestration: AiStudioOrchestrationResult;
  },
): Promise<CommandExecutionResult> {
  const recent =
    input.orchestration
      .platformContext.recent;

  const ranked = [
    ...recent.opportunities.map(
      (item: any) => ({
        type: "Opportunity",

        title: String(
          item.title ||
            "Opportunity",
        ),

        score: Number(
          item.compositeScore ??
            0,
        ),

        route:
          "/opportunity-radar",
      }),
    ),

    ...recent.alerts.map(
      (item: any) => ({
        type: "Alert",

        title: String(
          item.title ||
            "Alert",
        ),

        score: Number(
          item.score ?? 0,
        ),

        route: "/triage",
      }),
    ),

    ...recent.tasks.map(
      (item: any) => ({
        type: "Task",

        title: String(
          item.title ||
            "Task",
        ),

        score:
          item.priority ===
          "Critical"
            ? 95
            : item.priority ===
                "High"
              ? 82
              : item.priority ===
                  "Medium"
                ? 62
                : 42,

        route:
          "/workspace/team-board",
      }),
    ),

    ...recent.approvals.map(
      (item: any) => ({
        type: "Approval",

        title: String(
          item.title ||
            "Approval",
        ),

        score:
          item.riskLevel ===
          "Critical"
            ? 100
            : item.riskLevel ===
                "High"
              ? 90
              : item.riskLevel ===
                  "Medium"
                ? 70
                : 50,

        route:
          "/backend-readiness",
      }),
    ),
  ]
    .filter(
      (item) => item.title,
    )
    .sort(
      (a, b) =>
        b.score - a.score,
    )
    .slice(0, 15);

  await safe(null, () =>
    db.personalUserBotDataView.upsert(
      {
        where: {
          userId_viewName: {
            userId:
              input.user.id,

            viewName:
              "AI Ranked Work Queue",
          },
        },

        update: {
          profileId:
            input.profile.id,

          viewType:
            "Ranked Work Queue",

          filterJson:
            asJson({
              source:
                "AI Studio",
            }),

          sortJson:
            asJson({
              by: "score",
              direction: "desc",
            }),

          resultJson:
            asJson(ranked),
        },

        create: {
          userId:
            input.user.id,

          profileId:
            input.profile.id,

          viewName:
            "AI Ranked Work Queue",

          viewType:
            "Ranked Work Queue",

          filterJson:
            asJson({
              source:
                "AI Studio",
            }),

          sortJson:
            asJson({
              by: "score",
              direction: "desc",
            }),

          resultJson:
            asJson(ranked),
        },
      },
    ),
  );

  return {
    intent: "Sort Data",

    answer: ranked.length
      ? `Here are the highest-priority Slice items:

${ranked
  .map(
    (item, index) =>
      `${index + 1}. ${
        item.type
      }: ${item.title} — score ${
        item.score
      }`,
  )
  .join("\n")}`
      : "There is not enough accessible Slice data to rank yet.",

    clientAction: {
      type: "navigate",

      href:
        ranked[0]?.route ||
        "/advisor-command-center",

      autoRun: false,
    },

    status: "Complete",

    resultSummary:
      `Ranked ${ranked.length} accessible item(s).`,

    action: {
      ranked,
    },

    aiProvider:
      "Slice Ranking Tool",
  };
}

async function executeDraftEmail(
  input: {
    user: CurrentUserShape;
    profile: BotProfileShape;
    command: SliceStructuredCommand;
    prompt: string;
    orchestration: AiStudioOrchestrationResult;
  },
): Promise<CommandExecutionResult> {
  const ai =
    input.orchestration
      .aiResponse;

  if (!ai?.ok) {
    return {
      intent: "Draft Email",

      answer:
        orchestrationFailureAnswer(
          input.orchestration,
        ),

      clientAction: {
        type: "navigate",
        href:
          "/workspace/client-emails",
        autoRun: false,
      },

      status:
        ai?.status ||
        "Failed",

      resultSummary:
        ai?.error ||
        "AI email drafting failed.",

      action: {
        provider:
          orchestrationProvider(
            input.orchestration,
          ),

        error: ai?.error,
      },

      aiProvider:
        orchestrationProvider(
          input.orchestration,
        ),

      sources:
        input.orchestration
          .sources,

      researchUsed:
        input.orchestration
          .researchUsed,
    };
  }

  const subject = cleanTitle(
    input.command.parameters
      .subject ||
      input.command.parameters
        .title ||
      "Slice advisor update",

    "Slice advisor update",
    180,
  );

  const body = safeText(
    input.command.parameters
      .body,

    input.orchestration.answer,
  ).slice(0, 20000);

  const recipient =
    input.command.parameters
      .recipient ||
    input.command.parameters
      .email ||
    null;

  const draft =
    await db.personalUserBotEmailDraft.create(
      {
        data: {
          userId:
            input.user.id,

          profileId:
            input.profile.id,

          firmId:
            input.profile
              .firmId,

          targetTicker:
            safeTicker(
              input.command,
              input.prompt,
            ),

          subject,
          body,

          recipientJson:
            asJson(
              recipient
                ? [
                    {
                      email:
                        recipient,
                    },
                  ]
                : [],
            ),

          complianceJson:
            asJson([
              "Advisor review required before delivery.",
              "Verify all facts, sources, client suitability, and firm disclosures.",
              "External delivery must remain approval-gated.",
            ]),

          status: "Draft",

          deliveryMode:
            "Approval Required",
        },
      },
    );

  const approval =
    await createApproval({
      user: input.user,
      profile:
        input.profile,

      title:
        `Approve email draft: ${subject}`,

      actionType:
        "Email Draft",

      riskLevel: "High",

      summary: recipient
        ? `Email draft created for ${recipient}. Advisor approval is required before delivery.`
        : "Email draft created without a recipient. Add a recipient and obtain advisor approval before delivery.",

      payload: {
        draftId: draft.id,
        recipient,
        subject,
        body,

        sources:
          input.orchestration
            .sources,
      },
    });

  return {
    intent: "Draft Email",

    answer:
      `Email draft created and queued for advisor approval. Subject: ${subject}${
        recipient
          ? ` · Recipient: ${recipient}`
          : " · Recipient still required"
      }`,

    clientAction: {
      type: "navigate",
      href:
        "/workspace/client-emails",
      autoRun: false,
    },

    status:
      "Needs Approval",

    resultSummary:
      `Created email draft ${draft.id} and approval ${approval.id}.`,

    action: {
      draftId: draft.id,

      approvalId:
        approval.id,

      recipient,
      subject,

      provider:
        ai.provider,

      model: ai.model,

      sources:
        input.orchestration
          .sources,
    },

    aiProvider:
      ai.provider,

    sources:
      input.orchestration
        .sources,

    researchUsed:
      input.orchestration
        .researchUsed,
  };
}

async function executeCreateReport(
  input: {
    user: CurrentUserShape;
    profile: BotProfileShape;
    command: SliceStructuredCommand;
    prompt: string;
    orchestration: AiStudioOrchestrationResult;
  },
): Promise<CommandExecutionResult> {
  const ai =
    input.orchestration
      .aiResponse;

  if (
    !ai?.ok ||
    !input.orchestration.answer.trim()
  ) {
    return {
      intent:
        "Create Report",

      answer:
        orchestrationFailureAnswer(
          input.orchestration,
        ),

      clientAction: {
        type: "navigate",

        href:
          "/workspace/personal-bot/reports",

        autoRun: false,
      },

      status:
        ai?.status ||
        "Failed",

      resultSummary:
        ai?.error ||
        "Report research and drafting failed.",

      action: {
        provider:
          orchestrationProvider(
            input.orchestration,
          ),

        error: ai?.error,
      },

      aiProvider:
        orchestrationProvider(
          input.orchestration,
        ),

      sources:
        input.orchestration
          .sources,

      researchUsed:
        input.orchestration
          .researchUsed,
    };
  }

  const title = cleanTitle(
    input.command.parameters
      .reportTitle ||
      input.command.parameters
        .title ||
      input.prompt,

    "Slice AI Report",
    180,
  );

  const summary =
    reportSummary(
      input.orchestration
        .answer,
    );

  const sections =
    buildReportSections({
      prompt: input.prompt,

      answer:
        input.orchestration
          .answer,

      sources:
        input.orchestration
          .sources,
    });

  const downloadToken =
    randomBytes(24).toString(
      "hex",
    );

  const report =
    await db.personalUserBotPdfReport.create(
      {
        data: {
          userId:
            input.user.id,

          profileId:
            input.profile.id,

          firmId:
            input.profile
              .firmId,

          title,

          reportType:
            "Source-Backed Advisor Intelligence",

          status: "Ready",

          summary,

          sectionsJson:
            asJson(sections),

          designJson:
            asJson({
              style:
                "premium-dark-red",

              generatedBy:
                input.profile
                  .botName,

              preparedFor:
                input.user.name,

              provider:
                ai.provider,

              model: ai.model,

              researchUsed:
                input
                  .orchestration
                  .researchUsed,

              sourceCount:
                input
                  .orchestration
                  .sources.length,

              sources:
                input
                  .orchestration
                  .sources,

              requestId:
                ai.requestId,

              confidenceScore:
                input
                  .orchestration
                  .sources
                  .length >= 3
                  ? 90
                  : 78,

              metrics: [
                {
                  label:
                    "Sources",

                  value:
                    input
                      .orchestration
                      .sources
                      .length,

                  helper:
                    "Visible public research sources",

                  tone:
                    input
                      .orchestration
                      .sources
                      .length
                      ? "green"
                      : "amber",
                },
                {
                  label:
                    "Research",

                  value:
                    input
                      .orchestration
                      .researchUsed
                      ? "Live"
                      : "Internal",

                  helper:
                    "OpenAI research status",

                  tone:
                    input
                      .orchestration
                      .researchUsed
                      ? "green"
                      : "amber",
                },
                {
                  label:
                    "Review",

                  value:
                    "Required",

                  helper:
                    "Advisor and firm review",

                  tone:
                    "amber",
                },
              ],
            }),

          downloadToken,
        },
      },
    );

  const approval =
    await createApproval({
      user: input.user,

      profile:
        input.profile,

      title:
        `Review report: ${title}`,

      actionType:
        "PDF Report",

      riskLevel:
        "Medium",

      summary:
        `A source-backed advisor report was generated and requires review before external use: ${title}`,

      payload: {
        reportId:
          report.id,

        title,

        viewerUrl:
          `/workspace/personal-bot/reports?token=${downloadToken}`,

        pdfUrl:
          `/api/personal-bot/pdf-report?token=${downloadToken}`,

        sources:
          input.orchestration
            .sources,
      },
    });

  return {
    intent:
      "Create Report",

    answer:
      `${input.orchestration.answer}

A presentation-ready Slice report was also created. It contains ${input.orchestration.sources.length} visible research source(s) and is ready for advisor review.`,

    clientAction: {
      type: "report",

      href:
        `/workspace/personal-bot/reports?token=${downloadToken}`,

      pdfHref:
        `/api/personal-bot/pdf-report?token=${downloadToken}`,

      autoRun: false,
    },

    status: "Complete",

    resultSummary:
      `Created source-backed report ${report.id}.`,

    action: {
      reportId:
        report.id,

      approvalId:
        approval.id,

      viewerUrl:
        `/workspace/personal-bot/reports?token=${downloadToken}`,

      pdfUrl:
        `/api/personal-bot/pdf-report?token=${downloadToken}`,

      provider:
        ai.provider,

      model: ai.model,

      sources:
        input.orchestration
          .sources,

      requestId:
        ai.requestId,
    },

    aiProvider:
      ai.provider,

    sources:
      input.orchestration
        .sources,

    researchUsed:
      input.orchestration
        .researchUsed,
  };
}

async function executeAdvisorDay(
  input: {
    user: CurrentUserShape;
    profile: BotProfileShape;
  },
): Promise<CommandExecutionResult> {
  const result =
    await runBackendJob(
      backendContext(
        input.user,
        input.profile,
      ),

      "advisor_day",
    );

  return {
    intent: "Advisor Day",

    answer:
      `Advisor Day was generated from verified Slice records. Result: ${JSON.stringify(
        result,
      )}`,

    clientAction: {
      type: "navigate",

      href:
        "/advisor-command-center",

      autoRun: false,
    },

    status: "Complete",

    resultSummary:
      "Generated Advisor Day from current Slice records.",

    action: {
      jobKey:
        "advisor_day",

      result,
    },

    aiProvider:
      "Slice Backend Job",
  };
}

async function executeBackendJob(
  input: {
    user: CurrentUserShape;
    profile: BotProfileShape;
    command: SliceStructuredCommand;
  },
): Promise<CommandExecutionResult> {
  const jobKey =
    input.command.parameters
      .jobKey ||
    "vendor_health";

  const result =
    await runBackendJob(
      backendContext(
        input.user,
        input.profile,
      ),

      jobKey,
    );

  await safe(null, () =>
    recordAiToolRun(
      backendContext(
        input.user,
        input.profile,
      ),

      {
        toolKey:
          `bot_job_${jobKey}`,

        toolName:
          `Bot job: ${jobKey}`,

        input: {
          jobKey,
        },

        output:
          result as Record<
            string,
            unknown
          >,

        status: "Complete",
      },
    ),
  );

  return {
    intent: "Backend Job",

    answer:
      `Backend job completed: ${jobKey}. Result: ${JSON.stringify(
        result,
      )}`,

    clientAction: {
      type: "navigate",

      href:
        "/backend-kernel",

      autoRun: false,
    },

    status: "Complete",

    resultSummary:
      `Backend job completed: ${jobKey}.`,

    action: {
      jobKey,
      result,
    },

    aiProvider:
      "Slice Backend Job",
  };
}

async function executeQueueDelivery(
  input: {
    user: CurrentUserShape;
    profile: BotProfileShape;
    command: SliceStructuredCommand;
    prompt: string;
  },
): Promise<CommandExecutionResult> {
  const channel =
    input.command.parameters
      .deliveryChannel ||
    "Dashboard";

  const destination =
    input.command.parameters
      .recipient ||
    input.command.parameters
      .email ||
    input.command.parameters
      .phone ||
    (channel === "Dashboard"
      ? "Dashboard"
      : null);

  const title = cleanTitle(
    input.command.parameters
      .subject ||
      input.command.parameters
        .title ||
      "Slice AI delivery",

    "Slice AI delivery",
  );

  const body = safeText(
    input.command.parameters
      .body ||
      input.command.parameters
        .detail,

    input.prompt,
  ).slice(0, 20000);

  if (
    channel !== "Dashboard" &&
    !destination
  ) {
    return {
      intent:
        "Queue Delivery",

      answer:
        `I need a valid ${
          channel === "Email"
            ? "email address"
            : "phone number"
        } before I can queue this delivery.`,

      clientAction: {
        type: "navigate",

        href:
          "/backend-readiness",

        autoRun: false,
      },

      status:
        "Needs Destination",

      resultSummary:
        "Delivery was not queued because the destination is missing.",

      action: {
        channel,

        href:
          "/backend-readiness",
      },

      aiProvider:
        "Slice Delivery Tool",
    };
  }

  const delivery =
    await queueBackendDelivery(
      backendContext(
        input.user,
        input.profile,
      ),

      {
        channel,
        destination,
        title,
        body,

        payload: {
          prompt:
            input.prompt,

          createdBy:
            input.profile
              .botName,
        },

        urgency:
          input.command
            .riskLevel ===
          "Critical"
            ? "Critical"
            : "Medium",

        score:
          input.command
            .riskLevel ===
          "Critical"
            ? 95
            : 70,

        approvalRequired:
          true,
      },
    );

  const approval =
    await createApproval({
      user: input.user,

      profile:
        input.profile,

      title:
        `Approve ${channel} delivery: ${title}`,

      actionType:
        "Outbound Delivery",

      riskLevel: "High",

      summary:
        `A ${channel} delivery was queued and will not be sent until approved.`,

      payload: {
        deliveryId:
          delivery.id,

        channel,
        destination,
        title,
        body,
      },
    });

  return {
    intent:
      "Queue Delivery",

    answer:
      `${channel} delivery was queued for approval. It has not been sent.`,

    clientAction: {
      type: "navigate",

      href:
        "/backend-readiness",

      autoRun: false,
    },

    status:
      "Needs Approval",

    resultSummary:
      `Queued delivery ${delivery.id} and approval ${approval.id}.`,

    action: {
      deliveryId:
        delivery.id,

      approvalId:
        approval.id,

      channel,
      destination,
    },

    aiProvider:
      "Slice Delivery Tool",
  };
}

async function executeApprovalDecision(
  input: {
    user: CurrentUserShape;
    command: SliceStructuredCommand;
  },
): Promise<CommandExecutionResult> {
  const decision =
    input.command.parameters
      .approvalDecision;

  if (!decision) {
    return {
      intent:
        "Approval Decision",

      answer:
        "I need an explicit approve or reject instruction before changing a pending approval.",

      clientAction: {
        type: "navigate",

        href:
          "/backend-readiness",

        autoRun: false,
      },

      status:
        "Needs Decision",

      resultSummary:
        "Approval command did not include approve or reject.",

      action: {
        href:
          "/backend-readiness",
      },

      aiProvider:
        "Slice Approval Tool",
    };
  }

  const approval =
    await db.backendApprovalItem.findFirst(
      {
        where: {
          userId:
            input.user.id,

          status: "Pending",
        },

        orderBy: {
          createdAt: "desc",
        },
      },
    );

  if (!approval) {
    return {
      intent:
        "Approval Decision",

      answer:
        "There are no pending approval items to decide.",

      clientAction: {
        type: "navigate",

        href:
          "/backend-readiness",

        autoRun: false,
      },

      status:
        "No Pending Approval",

      resultSummary:
        "No pending approval was found.",

      action: {
        href:
          "/backend-readiness",
      },

      aiProvider:
        "Slice Approval Tool",
    };
  }

  const status =
    decision === "approve"
      ? "Approved"
      : "Rejected";

  const payload =
    parseJson<
      Record<
        string,
        unknown
      >
    >(
      approval.payloadJson,
      {},
    );

  const deliveryId =
    typeof payload.deliveryId ===
    "string"
      ? payload.deliveryId
      : null;

  const now = new Date();

  await db.$transaction(
    async (tx: any) => {
      await tx.backendApprovalItem.update(
        {
          where: {
            id: approval.id,
          },

          data: {
            status,

            decidedAt: now,

            approvedBy:
              input.user.email,

            approvalNotes:
              `Decision recorded through Slice AI: ${status}.`,
          },
        },
      );

      await tx.personalUserBotApprovalItem.updateMany(
        {
          where: {
            userId:
              input.user.id,

            title:
              approval.title,

            status: "Pending",
          },

          data: {
            status,

            approvalNotes:
              `Decision recorded through Slice AI: ${status}.`,
          },
        },
      );

      if (deliveryId) {
        await tx.backendOutboundDelivery.updateMany(
          {
            where: {
              id: deliveryId,

              userId:
                input.user.id,
            },

            data:
              decision ===
              "approve"
                ? {
                    status:
                      "Queued",

                    approvedAt:
                      now,
                  }
                : {
                    status:
                      "Rejected",

                    failureReason:
                      "Delivery rejected through approval workflow.",
                  },
          },
        );
      }
    },
  );

  return {
    intent:
      "Approval Decision",

    answer:
      `Latest pending approval ${status.toLowerCase()}: ${approval.title}.`,

    clientAction: {
      type: "navigate",

      href:
        "/backend-readiness",

      autoRun: false,
    },

    status: "Complete",

    resultSummary:
      `${status} approval ${approval.id}.`,

    action: {
      approvalId:
        approval.id,

      decision,
      status,
      deliveryId,
    },

    aiProvider:
      "Slice Approval Tool",
  };
}

async function executeRemember(
  input: {
    user: CurrentUserShape;
    profile: BotProfileShape;
    command: SliceStructuredCommand;
    prompt: string;
  },
): Promise<CommandExecutionResult> {
  const memoryText =
    safeText(
      input.command.parameters
        .memory,

      input.prompt
        .replace(
          /remember/i,
          "",
        )
        .trim(),
    ).slice(0, 5000);

  if (!memoryText) {
    return {
      intent: "Remember",

      answer:
        "Tell me the preference or fact you want Slice AI to remember.",

      clientAction: {
        type: "none",
        autoRun: false,
      },

      status:
        "Needs Memory",

      resultSummary:
        "No memory text was supplied.",

      action: {},

      aiProvider:
        "Slice Memory Tool",
    };
  }

  const title =
    cleanTitle(
      memoryText.split(
        ".",
      )[0] || memoryText,

      "User preference",
      100,
    );

  const key =
    memoryKey(title);

  const memory =
    await db.personalUserBotMemory.upsert(
      {
        where: {
          userId_memoryKey: {
            userId:
              input.user.id,

            memoryKey: key,
          },
        },

        update: {
          profileId:
            input.profile.id,

          firmId:
            input.profile
              .firmId,

          memoryType:
            "Preference",

          title,
          value: memoryText,

          confidenceScore:
            90,

          sourcePrompt:
            input.prompt,

          status: "Active",
        },

        create: {
          userId:
            input.user.id,

          profileId:
            input.profile.id,

          firmId:
            input.profile
              .firmId,

          memoryKey: key,

          memoryType:
            "Preference",

          title,
          value: memoryText,

          confidenceScore:
            90,

          sourcePrompt:
            input.prompt,

          status: "Active",
        },
      },
    );

  return {
    intent: "Remember",

    answer:
      `I will remember: ${memoryText}`,

    clientAction: {
      type: "none",
      autoRun: false,
    },

    status: "Complete",

    resultSummary:
      `Stored or updated memory: ${title}.`,

    action: {
      memoryId: memory.id,
      memoryKey: key,
      memoryText,
    },

    aiProvider:
      "Slice Memory Tool",
  };
}

async function executeTheme(
  input: {
    user: CurrentUserShape;
    command: SliceStructuredCommand;
  },
): Promise<CommandExecutionResult> {
  const color = normalize(
    input.command.parameters
      .color ||
      "red",
  );

  const palette: Record<
    string,
    {
      name: string;
      accentHex: string;
      accentDarkHex: string;
      accentSoftHex: string;
    }
  > = {
    red: {
      name: "Market Green",
      accentHex: "#059669",
      accentDarkHex:
        "#064e3b",
      accentSoftHex:
        "#d1fae5",
    },

    blue: {
      name:
        "Executive Blue",
      accentHex: "#2563eb",
      accentDarkHex:
        "#1e3a8a",
      accentSoftHex:
        "#dbeafe",
    },

    green: {
      name:
        "Market Green",
      accentHex: "#16a34a",
      accentDarkHex:
        "#14532d",
      accentSoftHex:
        "#dcfce7",
    },

    purple: {
      name:
        "Advisor Purple",
      accentHex: "#9333ea",
      accentDarkHex:
        "#581c87",
      accentSoftHex:
        "#f3e8ff",
    },

    gold: {
      name: "Regal Gold",
      accentHex: "#d97706",
      accentDarkHex:
        "#78350f",
      accentSoftHex:
        "#fef3c7",
    },

    mint: {
      name: "Mint",
      accentHex: "#10b981",
      accentDarkHex:
        "#064e3b",
      accentSoftHex:
        "#d1fae5",
    },
  };

  const selected =
    palette[color] ??
    palette.red;

  await db.personalUserUiPreference.upsert(
    {
      where: {
        userId:
          input.user.id,
      },

      update: {
        accentName:
          selected.name,

        accentHex:
          selected.accentHex,

        accentDarkHex:
          selected.accentDarkHex,

        accentSoftHex:
          selected.accentSoftHex,

        preferenceSource:
          "Personal Bot",
      },

      create: {
        userId:
          input.user.id,

        accentName:
          selected.name,

        accentHex:
          selected.accentHex,

        accentDarkHex:
          selected.accentDarkHex,

        accentSoftHex:
          selected.accentSoftHex,

        backgroundStyle:
          "Premium Dark",

        preferenceSource:
          "Personal Bot",
      },
    },
  );

  return {
    intent: "Theme",

    answer:
      `Theme updated to ${selected.name}.`,

    clientAction: {
      type: "theme",
      autoRun: false,
      color: selected,
    },

    status: "Complete",

    resultSummary:
      `Theme changed to ${selected.name}.`,

    action: selected,

    aiProvider:
      "Slice Theme Tool",
  };
}

async function executeHelp(
  input: {
    orchestration: AiStudioOrchestrationResult;
  },
): Promise<CommandExecutionResult> {
  const capabilityText =
    input.orchestration
      .platformContext
      .capabilities
      .map(
        (
          capability: SliceCapability,
        ) =>
          `${capability.label}: ${capability.capabilities.join(
            ", ",
          )}`,
      )
      .join("\n");

  const answer =
    input.orchestration
      .aiResponse?.ok
      ? input.orchestration
          .answer
      : `Slice AI can research public financial topics with sources, answer advisor questions, operate Voice Ops, navigate the platform, search permission-scoped firm records, create tasks and projects, create assigned client profiles, manage watchlists and price alerts, draft approval-gated communications, generate source-backed reports, run backend jobs, manage approvals, remember preferences, and change workspace appearance.

${capabilityText}`;

  return {
    intent: "Help",
    answer,

    clientAction: {
      type: "navigate",

      href:
        "/workspace/personal-bot",

      autoRun: false,
    },

    status: "Complete",

    resultSummary:
      "Displayed current Slice AI and platform capabilities.",

    action: {
      href:
        "/workspace/personal-bot",

      capabilities:
        input.orchestration
          .platformContext
          .capabilities,
    },

    aiProvider:
      input.orchestration
        .aiResponse?.ok
        ? input.orchestration
            .aiResponse
            .provider
        : "Slice Capability Map",

    sources:
      input.orchestration
        .sources,

    researchUsed:
      input.orchestration
        .researchUsed,
  };
}

async function executeStructuredCommand(
  input: {
    user: CurrentUserShape;
    profile: BotProfileShape;
    command: SliceStructuredCommand;
    prompt: string;
    orchestration: AiStudioOrchestrationResult;
  },
): Promise<CommandExecutionResult> {
  const {
    user,
    profile,
    command,
    prompt,
    orchestration,
  } = input;

  switch (command.intent) {
    case "navigate":
      return executeNavigate(
        command,
      );

    case "answer":
      return executeAnswer(
        orchestration,
      );

    case "source_lookup":
      return executeSourceLookup(
        {
          user,
          profile,
          command,
          prompt,
          orchestration,
        },
      );

    case "platform_search":
      return executePlatformSearch(
        {
          user,
          profile,
          command,
          prompt,
        },
      );

    case "research":
      return executeResearch({
        user,
        profile,
        command,
        prompt,
        orchestration,
      });

    case "sort_data":
      return executeSortData({
        user,
        profile,
        orchestration,
      });

    case "create_task":
      return executeCreateTask(
        {
          user,
          profile,
          command,
          prompt,
        },
      );

    case "create_client":
      return executeCreateClient(
        {
          user,
          command,
        },
      );

    case "create_project":
      return executeCreateProject(
        {
          user,
          profile,
          command,
          prompt,
        },
      );

    case "create_watchlist_item":
      return executeCreateWatchlistItem(
        {
          user,
          command,
          prompt,
        },
      );

    case "create_price_alert":
      return executeCreatePriceAlert(
        {
          user,
          command,
          prompt,
        },
      );

    case "draft_email":
      return executeDraftEmail(
        {
          user,
          profile,
          command,
          prompt,
          orchestration,
        },
      );

    case "create_report":
      return executeCreateReport(
        {
          user,
          profile,
          command,
          prompt,
          orchestration,
        },
      );

    case "advisor_day":
      return executeAdvisorDay(
        {
          user,
          profile,
        },
      );

    case "backend_job":
      return executeBackendJob(
        {
          user,
          profile,
          command,
        },
      );

    case "queue_delivery":
      return executeQueueDelivery(
        {
          user,
          profile,
          command,
          prompt,
        },
      );

    case "approval_decision":
      return executeApprovalDecision(
        {
          user,
          command,
        },
      );

    case "remember":
      return executeRemember({
        user,
        profile,
        command,
        prompt,
      });

    case "theme":
      return executeTheme({
        user,
        command,
      });

    case "help":
      return executeHelp({
        orchestration,
      });

    default:
      return executeAnswer(
        orchestration,
      );
  }
}

export async function executePersonalBotCommand(
  input: ExecutePersonalBotCommandInput,
): Promise<ExecutePersonalBotCommandResult> {
  const startedAt =
    Date.now();

  const prompt =
    input.prompt.trim();

  if (!prompt) {
    throw new Error(
      "A Slice AI command or question is required.",
    );
  }

  await ensurePlatformBrain(
    input.user.id,
    input.profile.firmId,
  );

  const orchestration =
    await orchestrateAiStudioRequest(
      {
        user: input.user,

        profile:
          input.profile,

        prompt,

        voiceTranscript:
          input.voiceTranscript,

        currentPath:
          input.currentPath,

        pageTitle:
          input.pageTitle,

        answerMode:
          input.answerMode ||
          "balanced",

        recentMessages:
          input.recentMessages,

        advancedSettings:
          input.advancedSettings,
      },
    );

  const structuredCommand =
    orchestration.structuredCommand;

  let execution: CommandExecutionResult;

  try {
    execution =
      await executeStructuredCommand(
        {
          user: input.user,

          profile:
            input.profile,

          command:
            structuredCommand,

          prompt,

          orchestration,
        },
      );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Command execution failed.";

    execution = {
      intent: "Error",

      answer:
        `I understood the request, but the verified Slice platform action failed.

Error: ${message}`,

      clientAction: {
        type: "none",
        autoRun: false,
      },

      status: "Failed",

      resultSummary:
        message,

      action: {
        error: message,

        structuredCommand,
      },

      aiProvider:
        orchestrationProvider(
          orchestration,
        ),

      sources:
        orchestration.sources,

      researchUsed:
        orchestration.researchUsed,
    };
  }

  const durationMs =
    Date.now() - startedAt;

  const commandRecord =
    await createBotCommandRecord(
      {
        userId:
          input.user.id,

        profileId:
          input.profile.id,

        firmId:
          input.profile.firmId,

        commandText: prompt,

        commandType:
          structuredCommand.intent,

        status:
          execution.status,

        resultSummary:
          execution.resultSummary,

        action: {
          ...execution.action,

          structuredCommand,

          aiParserOk:
            orchestration.parser
              .ok,

          aiParserError:
            orchestration.parser
              .error,

          aiParserProvider:
            orchestration.parser
              .provider,

          aiProvider:
            execution.aiProvider,

          fastRouterUsed:
            orchestration
              .fastRouter.used,

          fastRouterReason:
            orchestration
              .fastRouter.reason,

          fastRouterConfidence:
            orchestration
              .fastRouter
              .confidence,

          voiceTranscript:
            input.voiceTranscript ??
            null,

          durationMs,

          spokenAccent:
            "British English",

          preferredTone:
            input.profile
              .preferredTone,

          sources:
            execution.sources ||
            orchestration.sources,

          researchUsed:
            execution.researchUsed ??
            orchestration.researchUsed,

          aiModel:
            orchestration
              .aiResponse?.model,

          aiStatus:
            orchestration
              .aiResponse?.status,

          aiError:
            orchestration
              .aiResponse?.error,

          aiRequestId:
            orchestration
              .aiResponse
              ?.requestId,

          aiLatencyMs:
            orchestration
              .aiResponse
              ?.latencyMs,
        },
      },
    );

  if (
    execution.status ===
      "Complete" &&
    structuredCommand.confidence >=
      0.7
  ) {
    await recordTrainingPhrase({
      userId:
        input.user.id,

      profileId:
        input.profile.id,

      firmId:
        input.profile.firmId,

      phrase: prompt,

      targetIntent:
        structuredCommand.intent,

      targetRoute:
        structuredCommand.route ||
        structuredCommand
          .parameters.route,

      parameters:
        structuredCommand.parameters as unknown as Record<
          string,
          unknown
        >,
    }).catch(() => null);
  }

  if (
    ![
      "answer",
      "research",
      "source_lookup",
      "help",
    ].includes(
      structuredCommand.intent,
    )
  ) {
    await safe(null, () =>
      recordAiToolRun(
        backendContext(
          input.user,
          input.profile,
        ),

        {
          toolKey:
            `slice_ai_${structuredCommand.intent}`,

          toolName:
            `Slice AI: ${structuredCommand.intent}`,

          input: {
            prompt,
            structuredCommand,
          },

          output: {
            status:
              execution.status,

            resultSummary:
              execution.resultSummary,

            action:
              execution.action,
          },

          status:
            execution.status,

          durationMs,
        },
      ),
    );
  }

  return {
    ...execution,

    commandRecord,

    structuredCommand,

    aiParserOk:
      orchestration.parser.ok,

    aiParserError:
      orchestration.parser.error,

    fastRouterUsed:
      orchestration.fastRouter
        .used,

    fastRouterReason:
      orchestration.fastRouter
        .reason,

    fastRouterConfidence:
      orchestration.fastRouter
        .confidence,

    orchestration: {
      provider:
        orchestration.provider,

      status:
        orchestration.status,

      researchUsed:
        orchestration.researchUsed,

      sources:
        orchestration.sources,

      aiModel:
        orchestration
          .aiResponse?.model,

      aiStatus:
        orchestration
          .aiResponse?.status,

      aiError:
        orchestration
          .aiResponse?.error,

      latencyMs:
        orchestration
          .aiResponse?.latencyMs,
    },
  };
}