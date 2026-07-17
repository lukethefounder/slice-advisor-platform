import "server-only";

import {
  randomUUID,
} from "node:crypto";

import OpenAI from "openai";

import {
  recordAuditLog,
} from "@/lib/audit";

import {
  prisma,
} from "@/lib/prisma";

const BOT_NAME =
  "Slice Advisor";

const USER_MESSAGE_EVENT =
  "INTELLIGENCE_ADVISOR_BOT_USER_MESSAGE";

const ASSISTANT_MESSAGE_EVENT =
  "INTELLIGENCE_ADVISOR_BOT_ASSISTANT_MESSAGE";

const ACTION_EXECUTION_EVENT =
  "INTELLIGENCE_ADVISOR_ACTION_EXECUTED";

const MAXIMUM_MESSAGE_LENGTH =
  8_000;

const MAXIMUM_CONTEXT_FORECASTS =
  8;

const MAXIMUM_CONVERSATION_MESSAGES =
  30;

const ALLOWED_AUTONOMY_LEVELS = [
  "Read-Only Research",
  "Draft Actions Only",
  "Advisor Approval Required",
] as const;

const ALLOWED_ACTION_TYPES = [
  "SAVE_RESEARCH_NOTE",
  "CREATE_DASHBOARD_ALERT",
  "SAVE_MEMORY",
  "APPROVE_DAY_BRIEF",
  "PROPOSE_RESEARCH_TASK",
  "PROPOSE_CLIENT_OUTREACH",
  "PROPOSE_PORTFOLIO_REVIEW",
] as const;

type AdvisorAutonomyLevel =
  (typeof ALLOWED_AUTONOMY_LEVELS)[number];

type AdvisorActionType =
  (typeof ALLOWED_ACTION_TYPES)[number];

type JsonRecord =
  Record<string, unknown>;

type RiskLevel =
  | "Low"
  | "Medium"
  | "High";

type AdvisorSourceReference = {
  sourceType:
    string;

  sourceId:
    string;

  label:
    string;

  asOfAt:
    string | null;
};

export type AdvisorSuggestedAction = {
  actionType:
    AdvisorActionType;

  title:
    string;

  summary:
    string;

  riskLevel:
    RiskLevel;

  payload:
    JsonRecord;
};

type AdvisorModelResponse = {
  answer:
    string;

  confidence:
    number;

  sourceReferences:
    AdvisorSourceReference[];

  suggestedActions:
    AdvisorSuggestedAction[];
};

type AdvisorBriefContent = {
  title:
    string;

  summary:
    string;

  topActions:
    string[];

  metrics:
    JsonRecord;
};

type ConversationMessage = {
  id:
    string;

  role:
    "user" | "assistant";

  content:
    string;

  createdAt:
    Date;

  confidence:
    number | null;

  sourceReferences:
    AdvisorSourceReference[];
};

const globalForAdvisorBot =
  globalThis as unknown as {
    sliceAdvisorOpenAI?:
      OpenAI;
  };

function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(
      value,
    )
  );
}

function safeJson(
  value: unknown,
  fallback: string,
) {
  try {
    return JSON.stringify(
      value,
    );
  } catch {
    return fallback;
  }
}

function parseJson(
  value: string,
): unknown {
  try {
    return JSON.parse(
      value,
    ) as unknown;
  } catch {
    return null;
  }
}

function cleanText(
  value: unknown,
  maximumLength:
    number,
) {
  return typeof value ===
    "string"
    ? value
        .trim()
        .replace(
          /\r\n/g,
          "\n",
        )
        .slice(
          0,
          maximumLength,
        )
    : "";
}

function cleanSingleLine(
  value: unknown,
  maximumLength:
    number,
) {
  return cleanText(
    value,
    maximumLength,
  ).replace(
    /\s+/g,
    " ",
  );
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.max(
    minimum,
    Math.min(
      maximum,
      value,
    ),
  );
}

function finiteNumber(
  value: unknown,
  fallback: number,
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : fallback;
}

function uniqueStrings(
  values: string[],
  maximum = 25,
) {
  return Array.from(
    new Set(
      values
        .map(
          (value) =>
            value.trim(),
        )
        .filter(
          Boolean,
        ),
    ),
  ).slice(
    0,
    maximum,
  );
}

function parseStringArray(
  value: string,
) {
  const parsed =
    parseJson(
      value,
    );

  if (!Array.isArray(parsed)) {
    return [];
  }

  return uniqueStrings(
    parsed
      .filter(
        (
          item,
        ): item is string =>
          typeof item ===
          "string",
      )
      .map(
        (item) =>
          item.slice(
            0,
            500,
          ),
      ),
  );
}

function advisorAiEnabled() {
  const configured =
    Boolean(
      process.env
        .OPENAI_API_KEY
        ?.trim(),
    );

  const setting =
    String(
      process.env
        .SLICE_ADVISOR_AI_ENABLED ??
      "true",
    )
      .trim()
      .toLowerCase();

  return (
    configured &&
    ![
      "false",
      "0",
      "off",
      "disabled",
    ].includes(
      setting,
    )
  );
}

function advisorModelName() {
  return (
    process.env
      .SLICE_ADVISOR_MODEL
      ?.trim() ||
    "gpt-5-mini"
  );
}

function advisorTimeoutMs() {
  const parsed =
    Number(
      process.env
        .SLICE_ADVISOR_TIMEOUT_MS,
    );

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return 45_000;
  }

  return Math.max(
    10_000,
    Math.min(
      120_000,
      Math.round(
        parsed,
      ),
    ),
  );
}

function getOpenAIClient() {
  const apiKey =
    process.env
      .OPENAI_API_KEY
      ?.trim();

  if (!apiKey) {
    throw new Error(
      "OPENAI_API_KEY is not configured.",
    );
  }

  if (
    globalForAdvisorBot
      .sliceAdvisorOpenAI
  ) {
    return globalForAdvisorBot
      .sliceAdvisorOpenAI;
  }

  const client =
    new OpenAI({
      apiKey,

      timeout:
        advisorTimeoutMs(),

      maxRetries:
        1,
    });

  globalForAdvisorBot
    .sliceAdvisorOpenAI =
    client;

  return client;
}

function extractJsonObject(
  value: string,
) {
  const cleaned =
    value
      .trim()
      .replace(
        /^```json\s*/i,
        "",
      )
      .replace(
        /^```\s*/i,
        "",
      )
      .replace(
        /\s*```$/,
        "",
      )
      .trim();

  try {
    const parsed =
      JSON.parse(
        cleaned,
      ) as unknown;

    return isRecord(parsed)
      ? parsed
      : null;
  } catch {
    const start =
      cleaned.indexOf(
        "{",
      );

    const end =
      cleaned.lastIndexOf(
        "}",
      );

    if (
      start < 0 ||
      end <= start
    ) {
      return null;
    }

    try {
      const parsed =
        JSON.parse(
          cleaned.slice(
            start,
            end + 1,
          ),
        ) as unknown;

      return isRecord(parsed)
        ? parsed
        : null;
    } catch {
      return null;
    }
  }
}

function normalizeRiskLevel(
  value: unknown,
): RiskLevel {
  const normalized =
    cleanSingleLine(
      value,
      20,
    ).toLowerCase();

  if (
    normalized ===
    "high"
  ) {
    return "High";
  }

  if (
    normalized ===
    "low"
  ) {
    return "Low";
  }

  return "Medium";
}

function isAllowedActionType(
  value: string,
): value is AdvisorActionType {
  return (
    ALLOWED_ACTION_TYPES as readonly string[]
  ).includes(
    value,
  );
}

function sanitizeSourceReferences(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const references:
    AdvisorSourceReference[] = [];

  for (
    const item of
      value
  ) {
    if (!isRecord(item)) {
      continue;
    }

    const sourceType =
      cleanSingleLine(
        item.sourceType,
        100,
      );

    const sourceId =
      cleanSingleLine(
        item.sourceId,
        200,
      );

    const label =
      cleanSingleLine(
        item.label,
        300,
      );

    if (
      !sourceType ||
      !sourceId ||
      !label
    ) {
      continue;
    }

    const asOfAt =
      typeof item.asOfAt ===
      "string"
        ? item.asOfAt.slice(
            0,
            100,
          )
        : null;

    references.push({
      sourceType,

      sourceId,

      label,

      asOfAt,
    });
  }

  return references.slice(
    0,
    20,
  );
}

function sanitizeSuggestedActions(
  value: unknown,
) {
  if (!Array.isArray(value)) {
    return [];
  }

  const actions:
    AdvisorSuggestedAction[] = [];

  for (
    const item of
      value
  ) {
    if (!isRecord(item)) {
      continue;
    }

    const actionType =
      cleanSingleLine(
        item.actionType,
        100,
      );

    if (
      !isAllowedActionType(
        actionType,
      )
    ) {
      continue;
    }

    const title =
      cleanSingleLine(
        item.title,
        300,
      );

    const summary =
      cleanText(
        item.summary,
        2_000,
      );

    if (
      !title ||
      !summary
    ) {
      continue;
    }

    actions.push({
      actionType,

      title,

      summary,

      riskLevel:
        normalizeRiskLevel(
          item.riskLevel,
        ),

      payload:
        isRecord(
          item.payload,
        )
          ? item.payload
          : {},
    });
  }

  return actions.slice(
    0,
    5,
  );
}

function parseAdvisorModelResponse(
  value: string,
): AdvisorModelResponse | null {
  const parsed =
    extractJsonObject(
      value,
    );

  if (!parsed) {
    return null;
  }

  const answer =
    cleanText(
      parsed.answer,
      12_000,
    );

  if (!answer) {
    return null;
  }

  return {
    answer,

    confidence:
      clamp(
        finiteNumber(
          parsed.confidence,
          60,
        ),
        0,
        100,
      ),

    sourceReferences:
      sanitizeSourceReferences(
        parsed.sourceReferences,
      ),

    suggestedActions:
      sanitizeSuggestedActions(
        parsed.suggestedActions,
      ),
  };
}

function parseBriefContent(
  value: string,
): AdvisorBriefContent | null {
  const parsed =
    extractJsonObject(
      value,
    );

  if (!parsed) {
    return null;
  }

  const title =
    cleanSingleLine(
      parsed.title,
      300,
    );

  const summary =
    cleanText(
      parsed.summary,
      8_000,
    );

  const topActions =
    Array.isArray(
      parsed.topActions,
    )
      ? uniqueStrings(
          parsed.topActions
            .filter(
              (
                item,
              ): item is string =>
                typeof item ===
                "string",
            )
            .map(
              (item) =>
                item.slice(
                  0,
                  700,
                ),
            ),
          10,
        )
      : [];

  if (
    !title ||
    !summary
  ) {
    return null;
  }

  return {
    title,

    summary,

    topActions,

    metrics:
      isRecord(
        parsed.metrics,
      )
        ? parsed.metrics
        : {},
  };
}

export async function ensureAdvisorBotProfile(
  userId: string,
) {
  return prisma.botLearningProfile.upsert({
    where: {
      userId_botName: {
        userId,

        botName:
          BOT_NAME,
      },
    },

    update: {},

    create: {
      userId,

      botName:
        BOT_NAME,

      styleInstructions:
        "Use a professional, balanced, executive-summary style. Lead with what changed, why it matters, uncertainty, and the next review step. Never present a forecast as certain.",

      decisionRulesJson:
        safeJson(
          [
            "Use stored Slice evidence before general inference.",
            "State forecast timestamps and model versions.",
            "Highlight disagreement, stale evidence, and drift.",
            "Do not execute trades.",
            "Do not send emails.",
            "Create approval items before consequential actions.",
          ],
          "[]",
        ),

      escalationRulesJson:
        safeJson(
          [
            "Escalate critical model drift.",
            "Escalate point-in-time integrity failures.",
            "Escalate high forecast disagreement.",
            "Escalate client-facing or portfolio-changing actions.",
          ],
          "[]",
        ),

      memoryWeight:
        70,

      autonomyLevel:
        "Advisor Approval Required",

      successScore:
        72,

      status:
        "Learning",
    },
  });
}

async function readConversation(
  userId: string,
) {
  const events =
    await prisma.backendPlatformEvent.findMany({
      where: {
        userId,

        eventType: {
          in: [
            USER_MESSAGE_EVENT,
            ASSISTANT_MESSAGE_EVENT,
          ],
        },
      },

      orderBy: {
        createdAt:
          "desc",
      },

      take:
        MAXIMUM_CONVERSATION_MESSAGES,
    });

  const messages:
    ConversationMessage[] = [];

  for (
    const event of
      events.reverse()
  ) {
    const parsed =
      parseJson(
        event.metadataJson,
      );

    const metadata =
      isRecord(parsed)
        ? parsed
        : {};

    const role =
      event.eventType ===
      USER_MESSAGE_EVENT
        ? "user"
        : "assistant";

    const content =
      cleanText(
        metadata.content ??
        event.detail,
        12_000,
      );

    if (!content) {
      continue;
    }

    messages.push({
      id:
        event.id,

      role,

      content,

      createdAt:
        event.createdAt,

      confidence:
        role ===
        "assistant"
          ? finiteNumber(
              metadata.confidence,
              0,
            )
          : null,

      sourceReferences:
        sanitizeSourceReferences(
          metadata.sourceReferences,
        ),
    });
  }

  return messages;
}

async function loadAdvisorContext(
  userId: string,
) {
  const profile =
    await ensureAdvisorBotProfile(
      userId,
    );

  const [
    memories,
    forecastRuns,
    driftAlerts,
    models,
    approvals,
    briefs,
    alerts,
    conversation,
    ensembleEvents,
  ] =
    await Promise.all([
      prisma.advisorAdaptiveMemory.findMany({
        where: {
          userId,
        },

        orderBy: {
          updatedAt:
            "desc",
        },

        take:
          40,
      }),

      prisma.intelligenceForecastRun.findMany({
        where: {
          userId,
        },

        orderBy: {
          generatedAt:
            "desc",
        },

        take:
          MAXIMUM_CONTEXT_FORECASTS,

        include: {
          horizons: {
            orderBy: {
              targetAt:
                "asc",
            },

            include: {
              outcome:
                true,
            },
          },
        },
      }),

      prisma.intelligenceForecastDriftAlert.findMany({
        where: {
          userId,

          status:
            "Open",
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take:
          25,
      }),

      prisma.intelligenceForecastModel.findMany({
        where: {
          userId,
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take:
          20,
      }),

      prisma.backendApprovalItem.findMany({
        where: {
          userId,
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take:
          30,
      }),

      prisma.advisorDayBrief.findMany({
        where: {
          userId,
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take:
          15,
      }),

      prisma.alertEvent.findMany({
        where: {
          userId,
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take:
          20,
      }),

      readConversation(
        userId,
      ),

      prisma.backendPlatformEvent.findMany({
        where: {
          userId,

          eventType:
            "INTELLIGENCE_ENSEMBLE_PREDICTION",
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take:
          50,
      }),
    ]);

  return {
    profile,

    memories,

    forecastRuns,

    driftAlerts,

    models,

    approvals,

    briefs,

    alerts,

    conversation,

    ensembleEvents,
  };
}

function compactAdvisorContext(
  context:
    Awaited<
      ReturnType<
        typeof loadAdvisorContext
      >
    >,
) {
  return {
    generatedAt:
      new Date().toISOString(),

    profile: {
      botName:
        context.profile.botName,

      styleInstructions:
        context.profile.styleInstructions,

      decisionRules:
        parseStringArray(
          context.profile.decisionRulesJson,
        ),

      escalationRules:
        parseStringArray(
          context.profile.escalationRulesJson,
        ),

      memoryWeight:
        context.profile.memoryWeight,

      autonomyLevel:
        context.profile.autonomyLevel,
    },

    memories:
      context.memories.map(
        (memory) => ({
          subjectType:
            memory.subjectType,

          subjectName:
            memory.subjectName,

          memoryKey:
            memory.memoryKey,

          memoryValue:
            memory.memoryValue,

          confidenceScore:
            memory.confidenceScore,

          updatedAt:
            memory.updatedAt.toISOString(),
        }),
      ),

    forecasts:
      context.forecastRuns.map(
        (run) => ({
          runId:
            run.id,

          requestId:
            run.requestId,

          symbol:
            run.symbol,

          generatedAt:
            run.generatedAt.toISOString(),

          asOfAt:
            run.asOfAt.toISOString(),

          modelVersion:
            run.modelVersion,

          engineVersion:
            run.engineVersion,

          marketRegime:
            run.marketRegime,

          sliceSentimentScore:
            run.sliceSentimentScore,

          dataQualityScore:
            run.dataQualityScore,

          staleDataWarning:
            run.staleDataWarning,

          status:
            run.status,

          horizons:
            run.horizons.map(
              (horizon) => ({
                horizonId:
                  horizon.id,

                horizon:
                  horizon.horizon,

                label:
                  horizon.label,

                targetAt:
                  horizon.targetAt.toISOString(),

                direction:
                  horizon.direction,

                positiveReturnProbability:
                  horizon.positiveReturnProbability,

                expectedReturnPercent:
                  horizon.expectedReturnPercent,

                expectedPrice:
                  horizon.expectedPrice,

                rangeLow:
                  horizon.priceRangeLow,

                rangeHigh:
                  horizon.priceRangeHigh,

                confidence:
                  horizon.confidence,

                modelAgreement:
                  horizon.modelAgreement,

                simulationAgreement:
                  horizon.simulationAgreement,

                dataQuality:
                  horizon.dataQuality,

                primaryUncertainty:
                  horizon.primaryUncertainty,

                status:
                  horizon.status,

                outcome:
                  horizon.outcome
                    ? {
                        observedAt:
                          horizon.outcome.observedAt.toISOString(),

                        observedPrice:
                          horizon.outcome.observedPrice,

                        realizedReturnPercent:
                          horizon.outcome.realizedReturnPercent,

                        directionalCorrect:
                          horizon.outcome.directionalCorrect,

                        brierScore:
                          horizon.outcome.brierScore,

                        provider:
                          horizon.outcome.priceProvider,
                      }
                    : null,
              }),
            ),
        }),
      ),

    driftAlerts:
      context.driftAlerts.map(
        (alert) => ({
          id:
            alert.id,

          modelVersion:
            alert.modelVersion,

          horizon:
            alert.horizon,

          severity:
            alert.severity,

          reason:
            alert.reason,

          brierScoreChange:
            alert.brierScoreChange,

          directionalAccuracyChange:
            alert.directionalAccuracyChange,

          intervalCoverageChange:
            alert.intervalCoverageChange,

          createdAt:
            alert.createdAt.toISOString(),
        }),
      ),

    models:
      context.models.map(
        (model) => ({
          id:
            model.id,

          displayName:
            model.displayName,

          modelVersion:
            model.modelVersion,

          engineVersion:
            model.engineVersion,

          status:
            model.status,

          createdAt:
            model.createdAt.toISOString(),
        }),
      ),

    pendingApprovals:
      context.approvals
        .filter(
          (approval) =>
            approval.status ===
            "Pending",
        )
        .map(
          (approval) => ({
            id:
              approval.id,

            title:
              approval.title,

            actionType:
              approval.actionType,

            riskLevel:
              approval.riskLevel,

            summary:
              approval.summary,

            createdAt:
              approval.createdAt.toISOString(),
          }),
        ),

    recentBriefs:
      context.briefs.map(
        (brief) => ({
          id:
            brief.id,

          title:
            brief.title,

          summary:
            brief.summary,

          status:
            brief.status,

          createdAt:
            brief.createdAt.toISOString(),
        }),
      ),

    ensemblePredictions:
      context.ensembleEvents
        .map(
          (event) => {
            const parsed =
              parseJson(
                event.metadataJson,
              );

            return isRecord(parsed)
              ? {
                  eventId:
                    event.id,

                  forecastRunId:
                    event.sourceId,

                  horizon:
                    parsed.horizon,

                  direction:
                    parsed.direction,

                  probability:
                    parsed.positiveReturnProbability,

                  expectedReturnPercent:
                    parsed.expectedReturnPercent,

                  confidence:
                    parsed.confidence,

                  generatedAt:
                    parsed.generatedAt ??
                    event.createdAt.toISOString(),
                }
              : null;
          },
        )
        .filter(
          Boolean,
        ),
  };
}

function defaultSourceReferences(
  context:
    Awaited<
      ReturnType<
        typeof loadAdvisorContext
      >
    >,
) {
  return context.forecastRuns
    .slice(
      0,
      5,
    )
    .map(
      (run) => ({
        sourceType:
          "IntelligenceForecastRun",

        sourceId:
          run.id,

        label:
          `${run.symbol} forecast generated ${run.generatedAt.toISOString()}`,

        asOfAt:
          run.asOfAt.toISOString(),
      }),
    );
}

function fallbackAdvisorAnswer(
  message: string,
  context:
    Awaited<
      ReturnType<
        typeof loadAdvisorContext
      >
    >,
): AdvisorModelResponse {
  const latest =
    context.forecastRuns[0];

  const openDrift =
    context.driftAlerts.length;

  const pendingApprovals =
    context.approvals.filter(
      (approval) =>
        approval.status ===
        "Pending",
    ).length;

  if (!latest) {
    return {
      answer:
        "No stored Slice forecast is available yet. Run a forecast in Forecast Lab first. I can then compare horizons, model confidence, simulation disagreement, evidence quality, and realized outcomes.",

      confidence:
        30,

      sourceReferences:
        [],

      suggestedActions: [
        {
          actionType:
            "PROPOSE_RESEARCH_TASK",

          title:
            "Generate first stored forecast",

          summary:
            "Open Forecast Lab and generate a point-in-time forecast before relying on the advisor bot for asset-specific conclusions.",

          riskLevel:
            "Low",

          payload: {
            requestedQuestion:
              message,
          },
        },
      ],
    };
  }

  const selectedHorizons =
    latest.horizons.filter(
      (horizon) =>
        [
          "1d",
          "2-5d",
          "1-4w",
          "1-3m",
        ].includes(
          horizon.horizon,
        ),
    );

  const horizonSummary =
    selectedHorizons
      .map(
        (horizon) =>
          `${horizon.label}: ${horizon.direction}, ` +
          `${horizon.positiveReturnProbability.toFixed(1)}% positive-return probability, ` +
          `${horizon.expectedReturnPercent.toFixed(2)}% expected return, ` +
          `${horizon.confidence.toFixed(0)} confidence`,
      )
      .join(
        "\n",
      );

  const staleWarning =
    latest.staleDataWarning
      ? `\nData warning: ${latest.staleDataWarning}`
      : "";

  return {
    answer:
      `Executive summary for ${latest.symbol}\n\n` +
      `The latest stored forecast was generated ${latest.generatedAt.toISOString()} using ${latest.modelVersion}. ` +
      `Slice sentiment is ${latest.sliceSentimentScore.toFixed(1)} and data quality is ${latest.dataQualityScore.toFixed(1)}.\n\n` +
      `${horizonSummary || "No core horizon details are available."}\n\n` +
      `Open model-drift alerts: ${openDrift}. Pending advisor approvals: ${pendingApprovals}.` +
      staleWarning +
      `\n\nThis is decision-support evidence, not a guaranteed outcome or an executed recommendation.`,

    confidence:
      clamp(
        latest.dataQualityScore,
        25,
        90,
      ),

    sourceReferences:
      defaultSourceReferences(
        context,
      ),

    suggestedActions: [
      {
        actionType:
          "SAVE_RESEARCH_NOTE",

        title:
          `Review ${latest.symbol} forecast thesis`,

        summary:
          `Save an internal research note covering the latest ${latest.symbol} multi-horizon forecast and its principal uncertainty.`,

        riskLevel:
          "Low",

        payload: {
          ticker:
            latest.symbol,

          title:
            `${latest.symbol} forecast review`,

          thesis:
            horizonSummary ||
            `Review the latest ${latest.symbol} forecast.`,

          risks:
            latest.staleDataWarning ||
            selectedHorizons
              .map(
                (horizon) =>
                  horizon.primaryUncertainty,
              )
              .filter(
                Boolean,
              )
              .join(
                "; ",
              ),

          decision:
            "Watch",

          conviction:
            "Medium",

          sourceLinks:
            "",
        },
      },
    ],
  };
}

async function callAdvisorModel(
  input: {
    message:
      string;

    context:
      Awaited<
        ReturnType<
          typeof loadAdvisorContext
        >
      >;
  },
) {
  if (
    !advisorAiEnabled()
  ) {
    return null;
  }

  const client =
    getOpenAIClient();

  const compactContext =
    compactAdvisorContext(
      input.context,
    );

  const conversation =
    input.context.conversation
      .slice(
        -10,
      )
      .map(
        (message) => ({
          role:
            message.role,

          content:
            message.content.slice(
              0,
              2_500,
            ),
        }),
      );

  const instructions = [
    "You are Slice Advisor, an institutional-style investment research assistant.",
    "Use only the supplied Slice context as factual evidence.",
    "Do not invent live prices, news, filings, model results, or outcomes.",
    "Clearly distinguish observed evidence, forecasts, simulations, and inference.",
    "Never promise returns or describe a forecast as certain.",
    "Never execute or recommend automatic trading.",
    "Never claim to have sent an email, contacted a client, moved money, or changed a portfolio.",
    "Consequential actions must be returned as approval-gated suggestedActions.",
    "Use a professional, balanced executive-summary style.",
    "Respond only with one valid JSON object.",
    "Required JSON shape:",
    '{"answer":"string","confidence":0,"sourceReferences":[{"sourceType":"string","sourceId":"string","label":"string","asOfAt":"ISO string or null"}],"suggestedActions":[{"actionType":"SAVE_RESEARCH_NOTE|CREATE_DASHBOARD_ALERT|SAVE_MEMORY|PROPOSE_RESEARCH_TASK|PROPOSE_CLIENT_OUTREACH|PROPOSE_PORTFOLIO_REVIEW","title":"string","summary":"string","riskLevel":"Low|Medium|High","payload":{}}]}',
  ].join(
    "\n",
  );

  const response =
    await client.responses.create({
      model:
        advisorModelName(),

      instructions,

      input:
        JSON.stringify({
          currentQuestion:
            input.message,

          recentConversation:
            conversation,

          sliceContext:
            compactContext,
        }),

      max_output_tokens:
        1_800,

      store:
        false,
    });

  return parseAdvisorModelResponse(
    response.output_text,
  );
}

async function persistConversationMessage(
  input: {
    userId:
      string;

    role:
      "user" | "assistant";

    content:
      string;

    confidence?:
      number | null;

    sourceReferences?:
      AdvisorSourceReference[];
  },
) {
  const eventType =
    input.role ===
    "user"
      ? USER_MESSAGE_EVENT
      : ASSISTANT_MESSAGE_EVENT;

  const eventKey = [
    "advisor-bot-message",
    input.role,
    Date.now(),
    randomUUID(),
  ].join(
    ":",
  );

  return prisma.backendPlatformEvent.create({
    data: {
      userId:
        input.userId,

      eventKey,

      eventType,

      area:
        "Market Intelligence",

      actorName:
        input.role ===
        "user"
          ? "Advisor"
          : BOT_NAME,

      title:
        input.role ===
        "user"
          ? "Advisor question"
          : "Slice Advisor response",

      detail:
        input.content.slice(
          0,
          4_000,
        ),

      severity:
        "Info",

      status:
        "Recorded",

      sourceType:
        "AdvisorBotConversation",

      sourceId:
        null,

      metadataJson:
        safeJson(
          {
            role:
              input.role,

            content:
              input.content,

            confidence:
              input.confidence ??
              null,

            sourceReferences:
              input.sourceReferences ??
              [],
          },
          "{}",
        ),
    },
  });
}

async function createPendingApproval(
  input: {
    userId:
      string;

    action:
      AdvisorSuggestedAction;

    requestedBy?:
      string;
  },
) {
  const since =
    new Date(
      Date.now() -
      24 *
      60 *
      60 *
      1_000,
    );

  const existing =
    await prisma.backendApprovalItem.findFirst({
      where: {
        userId:
          input.userId,

        actionType:
          input.action.actionType,

        title:
          input.action.title,

        status:
          "Pending",

        createdAt: {
          gte:
            since,
        },
      },
    });

  if (existing) {
    return existing;
  }

  return prisma.backendApprovalItem.create({
    data: {
      userId:
        input.userId,

      title:
        input.action.title,

      actionType:
        input.action.actionType,

      riskLevel:
        input.action.riskLevel,

      summary:
        input.action.summary,

      payloadJson:
        safeJson(
          input.action.payload,
          "{}",
        ),

      requestedBy:
        input.requestedBy ??
        BOT_NAME,

      status:
        "Pending",
    },
  });
}

export async function chatWithAdvisorBot(
  input: {
    userId:
      string;

    message:
      string;

    request?:
      Request;
  },
) {
  const message =
    cleanText(
      input.message,
      MAXIMUM_MESSAGE_LENGTH,
    );

  if (!message) {
    throw new Error(
      "A message is required.",
    );
  }

  const context =
    await loadAdvisorContext(
      input.userId,
    );

  await persistConversationMessage({
    userId:
      input.userId,

    role:
      "user",

    content:
      message,
  });

  let response:
    AdvisorModelResponse;

  let mode:
    "AI" | "DETERMINISTIC_FALLBACK";

  try {
    const modelResponse =
      await callAdvisorModel({
        message,

        context,
      });

    if (modelResponse) {
      response =
        modelResponse;

      mode =
        "AI";
    } else {
      response =
        fallbackAdvisorAnswer(
          message,
          context,
        );

      mode =
        "DETERMINISTIC_FALLBACK";
    }
  } catch (error) {
    console.error(
      "Slice Advisor AI response failed; deterministic fallback used:",
      error,
    );

    response =
      fallbackAdvisorAnswer(
        message,
        context,
      );

    mode =
      "DETERMINISTIC_FALLBACK";
  }

  if (
    !response.sourceReferences.length
  ) {
    response.sourceReferences =
      defaultSourceReferences(
        context,
      );
  }

  await persistConversationMessage({
    userId:
      input.userId,

    role:
      "assistant",

    content:
      response.answer,

    confidence:
      response.confidence,

    sourceReferences:
      response.sourceReferences,
  });

  const approvals = [];

  for (
    const action of
      response.suggestedActions
  ) {
    approvals.push(
      await createPendingApproval({
        userId:
          input.userId,

        action,

        requestedBy:
          BOT_NAME,
      }),
    );
  }

  await recordAuditLog({
    userId:
      input.userId,

    eventType:
      "INTELLIGENCE_ADVISOR_BOT_RESPONDED",

    severity:
      "Info",

    area:
      "Market Intelligence",

    title:
      "Slice Advisor answered an investment-intelligence question",

    detail:
      `${response.suggestedActions.length} approval-gated action proposal(s) were created.`,

    metadata: {
      mode,

      confidence:
        response.confidence,

      sourceReferenceCount:
        response.sourceReferences.length,

      approvalProposalCount:
        approvals.length,

      autonomousTradingEnabled:
        false,

      externalActionsExecuted:
        false,
    },

    request:
      input.request,
  }).catch(
    console.error,
  );

  return {
    mode,

    answer:
      response.answer,

    confidence:
      response.confidence,

    sourceReferences:
      response.sourceReferences,

    suggestedActions:
      response.suggestedActions,

    approvals,

    safeguards: {
      autonomousTradingEnabled:
        false,

      externalEmailSent:
        false,

      portfolioChanged:
        false,

      moneyMoved:
        false,

      approvalRequired:
        true,
    },
  };
}

export async function updateAdvisorBotProfile(
  input: {
    userId:
      string;

    styleInstructions:
      string;

    memoryWeight:
      number;

    autonomyLevel:
      string;

    decisionRules:
      string[];

    escalationRules:
      string[];
  },
) {
  const styleInstructions =
    cleanText(
      input.styleInstructions,
      4_000,
    );

  if (
    styleInstructions.length <
    10
  ) {
    throw new Error(
      "Style instructions must contain at least 10 characters.",
    );
  }

  const autonomyLevel =
    (
      ALLOWED_AUTONOMY_LEVELS as readonly string[]
    ).includes(
      input.autonomyLevel,
    )
      ? input.autonomyLevel as AdvisorAutonomyLevel
      : "Advisor Approval Required";

  return prisma.botLearningProfile.upsert({
    where: {
      userId_botName: {
        userId:
          input.userId,

        botName:
          BOT_NAME,
      },
    },

    update: {
      styleInstructions,

      decisionRulesJson:
        safeJson(
          uniqueStrings(
            input.decisionRules,
            25,
          ),
          "[]",
        ),

      escalationRulesJson:
        safeJson(
          uniqueStrings(
            input.escalationRules,
            25,
          ),
          "[]",
        ),

      memoryWeight:
        Math.round(
          clamp(
            input.memoryWeight,
            0,
            100,
          ),
        ),

      autonomyLevel,

      status:
        "Learning",
    },

    create: {
      userId:
        input.userId,

      botName:
        BOT_NAME,

      styleInstructions,

      decisionRulesJson:
        safeJson(
          uniqueStrings(
            input.decisionRules,
            25,
          ),
          "[]",
        ),

      escalationRulesJson:
        safeJson(
          uniqueStrings(
            input.escalationRules,
            25,
          ),
          "[]",
        ),

      memoryWeight:
        Math.round(
          clamp(
            input.memoryWeight,
            0,
            100,
          ),
        ),

      autonomyLevel,

      successScore:
        72,

      status:
        "Learning",
    },
  });
}

function normalizeMemoryKey(
  value: string,
) {
  return value
    .trim()
    .toLowerCase()
    .replace(
      /[^a-z0-9]+/g,
      "-",
    )
    .replace(
      /^-+|-+$/g,
      "",
    )
    .slice(
      0,
      120,
    );
}

export async function saveAdvisorMemory(
  input: {
    userId:
      string;

    memoryKey:
      string;

    memoryValue:
      string;

    confidenceScore?:
      number;

    evidence?:
      unknown[];
  },
) {
  const memoryKey =
    normalizeMemoryKey(
      input.memoryKey,
    );

  const memoryValue =
    cleanText(
      input.memoryValue,
      4_000,
    );

  if (!memoryKey) {
    throw new Error(
      "A memory key is required.",
    );
  }

  if (!memoryValue) {
    throw new Error(
      "A memory value is required.",
    );
  }

  return prisma.advisorAdaptiveMemory.upsert({
    where: {
      userId_subjectType_subjectName_memoryKey: {
        userId:
          input.userId,

        subjectType:
          "Advisor",

        subjectName:
          BOT_NAME,

        memoryKey,
      },
    },

    update: {
      memoryValue,

      confidenceScore:
        Math.round(
          clamp(
            input.confidenceScore ??
            85,
            0,
            100,
          ),
        ),

      evidenceJson:
        safeJson(
          input.evidence ??
          [],
          "[]",
        ),

      lastAppliedAt:
        new Date(),
    },

    create: {
      userId:
        input.userId,

      subjectType:
        "Advisor",

      subjectName:
        BOT_NAME,

      memoryKey,

      memoryValue,

      confidenceScore:
        Math.round(
          clamp(
            input.confidenceScore ??
            85,
            0,
            100,
          ),
        ),

      evidenceJson:
        safeJson(
          input.evidence ??
          [],
          "[]",
        ),

      lastAppliedAt:
        new Date(),
    },
  });
}

function utcDayRange(
  date = new Date(),
) {
  const start =
    new Date(
      Date.UTC(
        date.getUTCFullYear(),
        date.getUTCMonth(),
        date.getUTCDate(),
      ),
    );

  const end =
    new Date(
      start.getTime() +
      24 *
      60 *
      60 *
      1_000,
    );

  return {
    start,

    end,
  };
}

function fallbackBriefContent(
  context:
    Awaited<
      ReturnType<
        typeof loadAdvisorContext
      >
    >,
) {
  const latest =
    context.forecastRuns[0];

  const openDrift =
    context.driftAlerts.length;

  const pendingApprovals =
    context.approvals.filter(
      (approval) =>
        approval.status ===
        "Pending",
    ).length;

  const forecastSummary =
    latest
      ? `${latest.symbol} is the latest stored forecast, generated ${latest.generatedAt.toISOString()} with sentiment ${latest.sliceSentimentScore.toFixed(1)} and data quality ${latest.dataQualityScore.toFixed(1)}.`
      : "No stored forecast is currently available.";

  const criticalDrift =
    context.driftAlerts.filter(
      (alert) =>
        alert.severity ===
        "Critical",
    );

  const topActions = [
    latest
      ? `Review ${latest.symbol} horizon disagreement and primary uncertainties.`
      : "Generate a current point-in-time forecast.",

    openDrift
      ? `Review ${openDrift} open model-drift alert(s).`
      : "No open model-drift alert requires review.",

    pendingApprovals
      ? `Decide ${pendingApprovals} pending advisor approval item(s).`
      : "No pending advisor approval item requires action.",
  ];

  if (
    criticalDrift.length
  ) {
    topActions.unshift(
      `Escalate ${criticalDrift.length} critical model-drift alert(s).`,
    );
  }

  return {
    title:
      `Slice Morning Intelligence Brief — ${new Date().toISOString().slice(
        0,
        10,
      )}`,

    summary:
      `${forecastSummary} ` +
      `${openDrift} open model-drift alert(s) and ${pendingApprovals} pending approval item(s) are currently recorded. ` +
      `This brief is a draft and requires advisor approval.`,

    topActions:
      uniqueStrings(
        topActions,
        10,
      ),

    metrics: {
      latestForecastSymbol:
        latest?.symbol ??
        null,

      latestForecastAt:
        latest
          ?.generatedAt
          .toISOString() ??
        null,

      latestDataQualityScore:
        latest
          ?.dataQualityScore ??
        null,

      openDriftAlerts:
        openDrift,

      criticalDriftAlerts:
        criticalDrift.length,

      pendingApprovals,

      activeModelCount:
        context.models.filter(
          (model) =>
            model.status !==
            "Disabled",
        ).length,
    },
  };
}

async function callBriefModel(
  context:
    Awaited<
      ReturnType<
        typeof loadAdvisorContext
      >
    >,
) {
  if (
    !advisorAiEnabled()
  ) {
    return null;
  }

  const client =
    getOpenAIClient();

  const response =
    await client.responses.create({
      model:
        advisorModelName(),

      instructions: [
        "Create a concise weekday morning intelligence brief for a professional investment advisor.",
        "Use only the supplied Slice context.",
        "Distinguish observed outcomes, forecasts, simulations, and unresolved uncertainty.",
        "Prioritize model drift, point-in-time integrity, high disagreement, pending approvals, and imminent horizon targets.",
        "Do not recommend automatic trading.",
        "Do not claim that an email was sent or a client was contacted.",
        "Return only valid JSON.",
        'Required shape: {"title":"string","summary":"string","topActions":["string"],"metrics":{}}',
      ].join(
        "\n",
      ),

      input:
        JSON.stringify(
          compactAdvisorContext(
            context,
          ),
        ),

      max_output_tokens:
        1_400,

      store:
        false,
    });

  return parseBriefContent(
    response.output_text,
  );
}

export async function createAdvisorDayBrief(
  input: {
    userId:
      string;

    force?:
      boolean;

    request?:
      Request;
  },
) {
  const range =
    utcDayRange();

  if (!input.force) {
    const existing =
      await prisma.advisorDayBrief.findFirst({
        where: {
          userId:
            input.userId,

          createdAt: {
            gte:
              range.start,

            lt:
              range.end,
          },
        },

        orderBy: {
          createdAt:
            "desc",
        },
      });

    if (existing) {
      return {
        brief:
          existing,

        approval:
          await prisma.backendApprovalItem.findFirst({
            where: {
              userId:
                input.userId,

              actionType:
                "APPROVE_DAY_BRIEF",

              payloadJson: {
                contains:
                  existing.id,
              },
            },

            orderBy: {
              createdAt:
                "desc",
            },
          }),

        reused:
          true,
      };
    }
  }

  const context =
    await loadAdvisorContext(
      input.userId,
    );

  let content:
    AdvisorBriefContent;

  try {
    content =
      (
        await callBriefModel(
          context,
        )
      ) ??
      fallbackBriefContent(
        context,
      );
  } catch (error) {
    console.error(
      "AI morning brief failed; deterministic brief used:",
      error,
    );

    content =
      fallbackBriefContent(
        context,
      );
  }

  const brief =
    await prisma.advisorDayBrief.create({
      data: {
        userId:
          input.userId,

        title:
          content.title,

        summary:
          content.summary,

        topActionsJson:
          safeJson(
            content.topActions,
            "[]",
          ),

        metricsJson:
          safeJson(
            {
              ...content.metrics,

              generatedBy:
                BOT_NAME,

              aiEnabled:
                advisorAiEnabled(),

              requiresApproval:
                true,

              autonomousTradingEnabled:
                false,
            },
            "{}",
          ),

        status:
          "Needs Approval",
      },
    });

  const approval =
    await createPendingApproval({
      userId:
        input.userId,

      requestedBy:
        BOT_NAME,

      action: {
        actionType:
          "APPROVE_DAY_BRIEF",

        title:
          `Approve ${brief.title}`,

        summary:
          "Review and approve the generated Slice morning intelligence brief before treating it as an advisor report.",

        riskLevel:
          "Medium",

        payload: {
          briefId:
            brief.id,
        },
      },
    });

  const alertKey = [
    "advisor-day-brief",
    brief.id,
  ].join(
    ":",
  );

  await prisma.alertEvent.upsert({
    where: {
      userId_dedupeKey: {
        userId:
          input.userId,

        dedupeKey:
          alertKey,
      },
    },

    update: {
      title:
        "Morning intelligence brief needs approval",

      body:
        brief.summary.slice(
          0,
          2_000,
        ),

      source:
        BOT_NAME,

      urgency:
        "Medium",

      score:
        75,

      channel:
        "Dashboard",

      status:
        "Unread",

      aiBriefing:
        brief.summary,
    },

    create: {
      userId:
        input.userId,

      dedupeKey:
        alertKey,

      title:
        "Morning intelligence brief needs approval",

      body:
        brief.summary.slice(
          0,
          2_000,
        ),

      source:
        BOT_NAME,

      ticker:
        null,

      urgency:
        "Medium",

      score:
        75,

      channel:
        "Dashboard",

      status:
        "Unread",

      sourceUrl:
        null,

      aiBriefing:
        brief.summary,
    },
  });

  await recordAuditLog({
    userId:
      input.userId,

    eventType:
      "INTELLIGENCE_ADVISOR_DAY_BRIEF_CREATED",

    severity:
      "Info",

    area:
      "Market Intelligence",

    title:
      brief.title,

    detail:
      "The morning intelligence brief was created in Needs Approval status.",

    metadata: {
      briefId:
        brief.id,

      approvalId:
        approval.id,

      aiEnabled:
        advisorAiEnabled(),

      reportApproved:
        false,

      autonomousTradingEnabled:
        false,
    },

    request:
      input.request,
  }).catch(
    console.error,
  );

  return {
    brief,

    approval,

    reused:
      false,
  };
}

async function createExecutionEvent(
  input: {
    userId:
      string;

    approvalId:
      string;

    actionType:
      string;

    title:
      string;

    detail:
      string;

    sourceId?:
      string | null;
  },
) {
  const eventKey = [
    "advisor-action-executed",
    input.approvalId,
  ].join(
    ":",
  );

  return prisma.backendPlatformEvent.upsert({
    where: {
      userId_eventKey: {
        userId:
          input.userId,

        eventKey,
      },
    },

    update: {
      eventType:
        ACTION_EXECUTION_EVENT,

      area:
        "Market Intelligence",

      actorName:
        BOT_NAME,

      title:
        input.title,

      detail:
        input.detail,

      severity:
        "Info",

      status:
        "Completed",

      sourceType:
        input.actionType,

      sourceId:
        input.sourceId ??
        null,
    },

    create: {
      userId:
        input.userId,

      eventKey,

      eventType:
        ACTION_EXECUTION_EVENT,

      area:
        "Market Intelligence",

      actorName:
        BOT_NAME,

      title:
        input.title,

      detail:
        input.detail,

      severity:
        "Info",

      status:
        "Completed",

      sourceType:
        input.actionType,

      sourceId:
        input.sourceId ??
        null,

      metadataJson:
        safeJson(
          {
            approvalId:
              input.approvalId,

            actionType:
              input.actionType,

            externalActionExecuted:
              false,

            autonomousTradingEnabled:
              false,
          },
          "{}",
        ),
    },
  });
}

async function executeApprovedAction(
  input: {
    userId:
      string;

    approvalId:
      string;

    actionType:
      string;

    title:
      string;

    payload:
      JsonRecord;
  },
) {
  if (
    input.actionType ===
    "APPROVE_DAY_BRIEF"
  ) {
    const briefId =
      cleanSingleLine(
        input.payload.briefId,
        100,
      );

    if (!briefId) {
      throw new Error(
        "The approval payload does not include a brief ID.",
      );
    }

    const brief =
      await prisma.advisorDayBrief.update({
        where: {
          id:
            briefId,
        },

        data: {
          status:
            "Approved",
        },
      });

    await createExecutionEvent({
      userId:
        input.userId,

      approvalId:
        input.approvalId,

      actionType:
        input.actionType,

      title:
        "Advisor day brief approved",

      detail:
        brief.title,

      sourceId:
        brief.id,
    });

    return {
      resultType:
        "AdvisorDayBrief",

      resultId:
        brief.id,
    };
  }

  if (
    input.actionType ===
    "SAVE_RESEARCH_NOTE"
  ) {
    const ticker =
      cleanSingleLine(
        input.payload.ticker,
        20,
      )
        .toUpperCase()
        .replace(
          /[^A-Z0-9.\-:$]/g,
          "",
        );

    const title =
      cleanSingleLine(
        input.payload.title ??
        input.title,
        300,
      );

    const thesis =
      cleanText(
        input.payload.thesis,
        8_000,
      );

    if (
      !title ||
      !thesis
    ) {
      throw new Error(
        "A research-note title and thesis are required.",
      );
    }

    const note =
      await prisma.researchNote.create({
        data: {
          userId:
            input.userId,

          ticker:
            ticker ||
            null,

          title,

          thesis,

          risks:
            cleanText(
              input.payload.risks,
              4_000,
            ) ||
            null,

          decision:
            cleanSingleLine(
              input.payload.decision,
              100,
            ) ||
            "Watch",

          conviction:
            cleanSingleLine(
              input.payload.conviction,
              100,
            ) ||
            "Medium",

          sourceLinks:
            cleanText(
              input.payload.sourceLinks,
              4_000,
            ) ||
            null,
        },
      });

    await createExecutionEvent({
      userId:
        input.userId,

      approvalId:
        input.approvalId,

      actionType:
        input.actionType,

      title:
        "Research note saved",

      detail:
        note.title,

      sourceId:
        note.id,
    });

    return {
      resultType:
        "ResearchNote",

      resultId:
        note.id,
    };
  }

  if (
    input.actionType ===
    "CREATE_DASHBOARD_ALERT"
  ) {
    const title =
      cleanSingleLine(
        input.payload.title ??
        input.title,
        300,
      );

    const body =
      cleanText(
        input.payload.body ??
        input.payload.summary,
        4_000,
      );

    if (
      !title ||
      !body
    ) {
      throw new Error(
        "An alert title and body are required.",
      );
    }

    const dedupeKey = [
      "advisor-alert",
      input.approvalId,
    ].join(
      ":",
    );

    const alert =
      await prisma.alertEvent.upsert({
        where: {
          userId_dedupeKey: {
            userId:
              input.userId,

            dedupeKey,
          },
        },

        update: {
          title,

          body,

          source:
            BOT_NAME,

          ticker:
            cleanSingleLine(
              input.payload.ticker,
              20,
            ) ||
            null,

          urgency:
            cleanSingleLine(
              input.payload.urgency,
              50,
            ) ||
            "Medium",

          score:
            Math.round(
              clamp(
                finiteNumber(
                  input.payload.score,
                  70,
                ),
                0,
                100,
              ),
            ),

          channel:
            "Dashboard",

          status:
            "Unread",

          aiBriefing:
            body,
        },

        create: {
          userId:
            input.userId,

          dedupeKey,

          title,

          body,

          source:
            BOT_NAME,

          ticker:
            cleanSingleLine(
              input.payload.ticker,
              20,
            ) ||
            null,

          urgency:
            cleanSingleLine(
              input.payload.urgency,
              50,
            ) ||
            "Medium",

          score:
            Math.round(
              clamp(
                finiteNumber(
                  input.payload.score,
                  70,
                ),
                0,
                100,
              ),
            ),

          channel:
            "Dashboard",

          status:
            "Unread",

          sourceUrl:
            null,

          aiBriefing:
            body,
        },
      });

    await createExecutionEvent({
      userId:
        input.userId,

      approvalId:
        input.approvalId,

      actionType:
        input.actionType,

      title:
        "Dashboard alert created",

      detail:
        alert.title,

      sourceId:
        alert.id,
    });

    return {
      resultType:
        "AlertEvent",

      resultId:
        alert.id,
    };
  }

  if (
    input.actionType ===
    "SAVE_MEMORY"
  ) {
    const memory =
      await saveAdvisorMemory({
        userId:
          input.userId,

        memoryKey:
          cleanSingleLine(
            input.payload.memoryKey,
            120,
          ),

        memoryValue:
          cleanText(
            input.payload.memoryValue,
            4_000,
          ),

        confidenceScore:
          finiteNumber(
            input.payload.confidenceScore,
            85,
          ),

        evidence:
          Array.isArray(
            input.payload.evidence,
          )
            ? input.payload.evidence
            : [],
      });

    await createExecutionEvent({
      userId:
        input.userId,

      approvalId:
        input.approvalId,

      actionType:
        input.actionType,

      title:
        "Advisor memory saved",

      detail:
        memory.memoryKey,

      sourceId:
        memory.id,
    });

    return {
      resultType:
        "AdvisorAdaptiveMemory",

      resultId:
        memory.id,
    };
  }

  if (
    [
      "PROPOSE_RESEARCH_TASK",
      "PROPOSE_CLIENT_OUTREACH",
      "PROPOSE_PORTFOLIO_REVIEW",
    ].includes(
      input.actionType,
    )
  ) {
    const event =
      await createExecutionEvent({
        userId:
          input.userId,

        approvalId:
          input.approvalId,

        actionType:
          input.actionType,

        title:
          input.title,

        detail:
          "Approved as an internal planning action. No client communication, portfolio change, or external action was executed.",

        sourceId:
          null,
      });

    return {
      resultType:
        "BackendPlatformEvent",

      resultId:
        event.id,
    };
  }

  throw new Error(
    "This action type cannot be executed by Slice Advisor.",
  );
}

export async function decideAdvisorApproval(
  input: {
    userId:
      string;

    approvalId:
      string;

    decision:
      "approve" | "reject";

    notes?:
      string;

    request?:
      Request;
  },
) {
  const approval =
    await prisma.backendApprovalItem.findFirst({
      where: {
        id:
          input.approvalId,

        userId:
          input.userId,
      },
    });

  if (!approval) {
    throw new Error(
      "Approval item was not found.",
    );
  }

  if (
    approval.status !==
    "Pending"
  ) {
    throw new Error(
      "This approval item has already been decided.",
    );
  }

  const notes =
    cleanText(
      input.notes,
      2_000,
    );

  if (
    input.decision ===
    "reject"
  ) {
    const rejected =
      await prisma.backendApprovalItem.update({
        where: {
          id:
            approval.id,
        },

        data: {
          status:
            "Rejected",

          approvedBy:
            input.userId,

          approvalNotes:
            notes ||
            "Rejected by advisor.",

          decidedAt:
            new Date(),
        },
      });

    return {
      approval:
        rejected,

      execution:
        null,
    };
  }

  const parsedPayload =
    parseJson(
      approval.payloadJson,
    );

  const payload =
    isRecord(
      parsedPayload,
    )
      ? parsedPayload
      : {};

  let execution:
    Awaited<
      ReturnType<
        typeof executeApprovedAction
      >
    >;

  try {
    execution =
      await executeApprovedAction({
        userId:
          input.userId,

        approvalId:
          approval.id,

        actionType:
          approval.actionType,

        title:
          approval.title,

        payload,
      });
  } catch (error) {
    await prisma.backendApprovalItem.update({
      where: {
        id:
          approval.id,
      },

      data: {
        status:
          "Execution Failed",

        approvedBy:
          input.userId,

        approvalNotes:
          error instanceof Error
            ? error.message
            : "Unknown execution error.",

        decidedAt:
          new Date(),
      },
    });

    throw error;
  }

  const approved =
    await prisma.backendApprovalItem.update({
      where: {
        id:
          approval.id,
      },

      data: {
        status:
          "Approved",

        approvedBy:
          input.userId,

        approvalNotes:
          notes ||
          "Approved by advisor.",

        decidedAt:
          new Date(),
      },
    });

  await recordAuditLog({
    userId:
      input.userId,

    eventType:
      "INTELLIGENCE_ADVISOR_ACTION_APPROVED",

    severity:
      approval.riskLevel ===
      "High"
        ? "Warning"
        : "Info",

    area:
      "Market Intelligence",

    title:
      approval.title,

    detail:
      `Approval completed for ${approval.actionType}.`,

    metadata: {
      approvalId:
        approval.id,

      actionType:
        approval.actionType,

      riskLevel:
        approval.riskLevel,

      execution,

      autonomousTradingEnabled:
        false,

      externalEmailSent:
        false,

      portfolioChanged:
        false,
    },

    request:
      input.request,
  }).catch(
    console.error,
  );

  return {
    approval:
      approved,

    execution,
  };
}

export async function getAdvisorBotOverview(
  userId: string,
) {
  const context =
    await loadAdvisorContext(
      userId,
    );

  return {
    generatedAt:
      new Date().toISOString(),

    ai: {
      enabled:
        advisorAiEnabled(),

      model:
        advisorModelName(),

      fallbackAvailable:
        true,
    },

    profile: {
      ...context.profile,

      decisionRules:
        parseStringArray(
          context.profile.decisionRulesJson,
        ),

      escalationRules:
        parseStringArray(
          context.profile.escalationRulesJson,
        ),
    },

    memories:
      context.memories,

    latestForecasts:
      context.forecastRuns.map(
        (run) => ({
          id:
            run.id,

          requestId:
            run.requestId,

          symbol:
            run.symbol,

          generatedAt:
            run.generatedAt,

          asOfAt:
            run.asOfAt,

          modelVersion:
            run.modelVersion,

          marketRegime:
            run.marketRegime,

          sliceSentimentScore:
            run.sliceSentimentScore,

          dataQualityScore:
            run.dataQualityScore,

          staleDataWarning:
            run.staleDataWarning,

          status:
            run.status,

          horizons:
            run.horizons.map(
              (horizon) => ({
                id:
                  horizon.id,

                horizon:
                  horizon.horizon,

                label:
                  horizon.label,

                targetAt:
                  horizon.targetAt,

                direction:
                  horizon.direction,

                probability:
                  horizon.positiveReturnProbability,

                expectedReturnPercent:
                  horizon.expectedReturnPercent,

                confidence:
                  horizon.confidence,

                status:
                  horizon.status,

                primaryUncertainty:
                  horizon.primaryUncertainty,
              }),
            ),
        }),
      ),

    openDriftAlerts:
      context.driftAlerts,

    models:
      context.models,

    approvals:
      context.approvals,

    briefs:
      context.briefs.map(
        (brief) => ({
          ...brief,

          topActions:
            parseStringArray(
              brief.topActionsJson,
            ),

          metrics:
            parseJson(
              brief.metricsJson,
            ),
        }),
      ),

    alerts:
      context.alerts,

    conversation:
      context.conversation,

    safeguards: {
      autonomousTradingEnabled:
        false,

      emailSendingEnabled:
        false,

      portfolioChangesEnabled:
        false,

      moneyMovementEnabled:
        false,

      modelPromotionEnabled:
        false,

      reportsRequireApproval:
        true,

      consequentialActionsRequireApproval:
        true,
    },
  };
}