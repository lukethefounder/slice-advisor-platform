import {
  matchFastCommand,
  type FastCommandMatch,
} from "@/lib/bot/fast-command-router";
import {
  generateUniversalAssistantReply,
  parseSliceCommandWithAi,
  type AiResponseResult,
  type AiSource,
  type AiSpeedMode,
  type SliceStructuredCommand,
} from "@/lib/integrations/ai";
import {
  compactSlicePlatformContext,
  loadSlicePlatformContext,
  type SliceAiProfile,
  type SliceAiUser,
  type SlicePlatformContext,
} from "@/lib/ai-studio/platform-context";

export type AiStudioAnswerMode =
  | "quick"
  | "balanced"
  | "deep";

export type AiStudioRecentMessage = {
  role: string;
  content: string;
};

export type AiStudioOrchestrationInput = {
  user: SliceAiUser;
  profile: SliceAiProfile;
  prompt: string;
  voiceTranscript?: string | null;
  currentPath?: string | null;
  pageTitle?: string | null;
  answerMode?: AiStudioAnswerMode;
  recentMessages?: AiStudioRecentMessage[];
  advancedSettings?: Record<string, unknown> | null;
};

export type AiStudioOrchestrationResult = {
  prompt: string;
  structuredCommand: SliceStructuredCommand;
  platformContext: SlicePlatformContext;
  compactPlatformContext: ReturnType<
    typeof compactSlicePlatformContext
  >;
  aiResponse: AiResponseResult | null;
  answer: string;
  sources: AiSource[];
  researchUsed: boolean;
  provider: string;
  status: string;

  parser: {
    ok: boolean;
    provider: string;
    error?: string;
  };

  fastRouter: {
    used: boolean;
    matched: boolean;
    confidence?: number;
    reason?: string;
  };
};

const AI_CONTENT_INTENTS =
  new Set<
    SliceStructuredCommand["intent"]
  >([
    "answer",
    "research",
    "source_lookup",
    "create_report",
    "draft_email",
  ]);

const DIRECT_FAST_INTENTS =
  new Set<
    SliceStructuredCommand["intent"]
  >([
    "navigate",
    "platform_search",
    "sort_data",
    "create_task",
    "create_client",
    "create_project",
    "create_watchlist_item",
    "create_price_alert",
    "advisor_day",
    "backend_job",
    "queue_delivery",
    "approval_decision",
    "remember",
    "theme",
    "help",
    "research",
    "source_lookup",
    "create_report",
    "draft_email",
  ]);

const FAST_REASONS_THAT_REQUIRE_AI_PARSING =
  new Set([
    "chat_first_universal_answer",
    "ticker_answer_professional",
    "empty_prompt_help",
  ]);

function parseJson<T>(
  value:
    | string
    | null
    | undefined,
  fallback: T,
): T {
  if (!value) {
    return fallback;
  }

  try {
    return JSON.parse(
      value,
    ) as T;
  } catch {
    return fallback;
  }
}

function normalize(
  value: string,
) {
  return value
    .toLowerCase()
    .replace(
      /[^a-z0-9\s$#@._/-]/g,
      " ",
    )
    .replace(/\s+/g, " ")
    .trim();
}

function readSetting(
  input:
    | Record<
        string,
        unknown
      >
    | null
    | undefined,
  key: string,
) {
  const value =
    input?.[key];

  return typeof value ===
      "string"
    ? value.trim()
    : "";
}

function speedModeForAnswerMode(
  mode: AiStudioAnswerMode,
): AiSpeedMode {
  if (mode === "quick") {
    return "fast";
  }

  if (mode === "deep") {
    return "quality";
  }

  return "balanced";
}

function minimumConfidence(
  intent:
    SliceStructuredCommand["intent"],
  voice: boolean,
) {
  if (
    intent === "navigate"
  ) {
    return voice
      ? 0.9
      : 0.86;
  }

  if (
    intent ===
    "approval_decision"
  ) {
    return 0.95;
  }

  if (
    intent ===
    "queue_delivery"
  ) {
    return 0.93;
  }

  if (
    intent ===
    "platform_search"
  ) {
    return voice
      ? 0.9
      : 0.87;
  }

  if (
    intent === "sort_data"
  ) {
    return 0.85;
  }

  if (
    intent === "research" ||
    intent ===
      "source_lookup"
  ) {
    return 0.88;
  }

  if (
    intent ===
      "draft_email" ||
    intent ===
      "create_report"
  ) {
    return 0.87;
  }

  if (intent === "help") {
    return 0.95;
  }

  return voice
    ? 0.92
    : 0.89;
}

function isReliableFastMatch(
  match:
    | FastCommandMatch
    | null,
  voice: boolean,
) {
  if (!match) {
    return false;
  }

  if (
    FAST_REASONS_THAT_REQUIRE_AI_PARSING.has(
      match.reason,
    )
  ) {
    return false;
  }

  if (
    !DIRECT_FAST_INTENTS.has(
      match.command.intent,
    )
  ) {
    return false;
  }

  return (
    match.confidence >=
    minimumConfidence(
      match.command.intent,
      voice,
    )
  );
}

function looksInternalOnly(
  prompt: string,
  command: SliceStructuredCommand,
) {
  const lower =
    normalize(prompt);

  if (
    [
      "navigate",
      "platform_search",
      "sort_data",
      "create_task",
      "create_client",
      "create_project",
      "create_watchlist_item",
      "create_price_alert",
      "advisor_day",
      "backend_job",
      "queue_delivery",
      "approval_decision",
      "remember",
      "theme",
      "help",
    ].includes(
      command.intent,
    )
  ) {
    return true;
  }

  return [
    "slice platform",
    "my firm",
    "our firm",
    "team recap",
    "team execution",
    "client records",
    "client portal",
    "internal report",
    "workspace status",
    "platform capabilities",
    "what can slice do",
  ].some((phrase) =>
    lower.includes(
      phrase,
    ),
  );
}

function requiresExternalResearch(
  prompt: string,
  command: SliceStructuredCommand,
  advancedSettings:
    | Record<
        string,
        unknown
      >
    | null
    | undefined,
) {
  if (
    looksInternalOnly(
      prompt,
      command,
    )
  ) {
    return false;
  }

  if (
    [
      "research",
      "source_lookup",
    ].includes(
      command.intent,
    )
  ) {
    return true;
  }

  if (
    command.intent ===
    "create_report"
  ) {
    return true;
  }

  if (
    command.intent ===
      "answer" ||
    command.intent ===
      "draft_email"
  ) {
    const lower =
      normalize(prompt);

    if (
      /^(hi|hello|hey|thanks|thank you)[.! ]*$/.test(
        lower,
      )
    ) {
      return false;
    }

    const operatingMode =
      readSetting(
        advancedSettings,
        "operatingMode",
      );

    const sourcePolicy =
      readSetting(
        advancedSettings,
        "sourcePolicy",
      );

    if (
      operatingMode ===
      "Platform Ops"
    ) {
      return false;
    }

    if (
      sourcePolicy ===
        "Fast" &&
      !/current|latest|today|market|company|stock|economic|regulat|news|price|law|rule/.test(
        lower,
      )
    ) {
      return false;
    }

    return true;
  }

  return false;
}

function localCommandAnswer(
  command: SliceStructuredCommand,
) {
  if (
    command.intent ===
    "navigate"
  ) {
    return (
      command.answer ||
      `I identified the requested Slice section: ${
        command.route ||
        command.parameters
          .route ||
        "/workspace"
      }.`
    );
  }

  const messages: Partial<
    Record<
      SliceStructuredCommand["intent"],
      string
    >
  > = {
    platform_search:
      "I identified this as a permission-scoped search of Slice and firm records.",

    sort_data:
      "I identified this as a request to rank accessible Slice records by priority and relevance.",

    create_task:
      "I identified a task-creation command. Slice will validate the details and return the verified record.",

    create_client:
      "I identified a client-creation command. Slice will validate the required fields, firm context, and advisor assignment.",

    create_project:
      "I identified a firm-project command. Slice will verify project-management permission before creating it.",

    create_watchlist_item:
      "I identified a watchlist command. Slice will verify the symbol and save the item.",

    create_price_alert:
      "I identified a price-alert command. Slice will require a symbol and at least one target price.",

    advisor_day:
      "I identified an Advisor Day request. Slice will build the operating brief from current platform records.",

    backend_job:
      "I identified a backend operating command. The job runner will return a verified execution result.",

    queue_delivery:
      "I identified an external-delivery command. Slice will keep delivery approval-gated.",

    approval_decision:
      "I identified an approval decision. Slice will apply it only to a verified pending item.",

    remember:
      "I identified a memory command. Slice will store the preference in the user's AI memory.",

    theme:
      "I identified an appearance command. Slice will update the saved preference.",

    help:
      "Slice can research financial topics, navigate the platform, search permission-scoped records, create tasks and projects, manage watchlists and alerts, draft approval-gated communications, create reports, run backend jobs, manage approvals, and remember preferences.",
  };

  return (
    messages[
      command.intent
    ] ||
    command.answer ||
    "I interpreted the request and prepared it for the Slice command router."
  );
}

export async function orchestrateAiStudioRequest(
  input: AiStudioOrchestrationInput,
): Promise<AiStudioOrchestrationResult> {
  const prompt =
    input.prompt.trim();

  if (!prompt) {
    throw new Error(
      "AI Studio prompt is required.",
    );
  }

  const answerMode =
    input.answerMode ??
    "balanced";

  const platformContext =
    await loadSlicePlatformContext(
      {
        user: input.user,
        profile:
          input.profile,
      },
    );

  const compactPlatformContext =
    compactSlicePlatformContext(
      platformContext,
    );

  const fastMatch =
    matchFastCommand({
      prompt,

      platformBrain:
        platformContext.platformBrain,
    });

  const useFastMatch =
    isReliableFastMatch(
      fastMatch,
      Boolean(
        input.voiceTranscript,
      ),
    );

  let parser: {
    ok: boolean;
    provider: string;
    error?: string;
    command: SliceStructuredCommand;
  };

  if (
    useFastMatch &&
    fastMatch
  ) {
    parser = {
      ok: true,

      provider:
        "Slice Fast Command Router",

      command:
        fastMatch.command,
    };
  } else {
    const parsed =
      await parseSliceCommandWithAi(
        {
          prompt,

          userName:
            input.user.name,

          userEmail:
            input.user.email,

          firmName:
            platformContext
              .firm.name,

          botName:
            input.profile
              .botName,

          memory:
            platformContext.memory.map(
              (item) =>
                `${item.title}: ${item.value}`,
            ),

          openTasks:
            platformContext
              .metrics
              .openPersonalTasks +
            platformContext
              .metrics
              .openFirmTasks,

          unreadAlerts:
            platformContext
              .metrics
              .unreadAlerts,

          clients:
            platformContext
              .metrics
              .accessibleClients,

          portfolioValue: 0,

          platformBrain:
            platformContext.platformBrain,

          voiceTranscript:
            input.voiceTranscript,

          preferredTone:
            input.profile
              .preferredTone,

          commandStyle:
            input.profile
              .commandStyle,

          customInstructions:
            input.profile
              .customInstructions,

          personality:
            parseJson<
              Record<
                string,
                unknown
              >
            >(
              input.profile
                .personalityJson,
              {},
            ),
        },
      );

    parser = {
      ok: parsed.ok,

      provider:
        parsed.provider,

      error:
        parsed.error,

      command:
        parsed.command,
    };
  }

  const command =
    parser.command;

  let aiResponse:
    | AiResponseResult
    | null = null;

  if (
    AI_CONTENT_INTENTS.has(
      command.intent,
    )
  ) {
    const researchRequired =
      requiresExternalResearch(
        prompt,
        command,
        input.advancedSettings,
      );

    aiResponse =
      await generateUniversalAssistantReply(
        {
          prompt,

          userName:
            input.user.name,

          userEmail:
            input.user.email,

          botName:
            input.profile
              .botName,

          currentPath:
            input.currentPath,

          pageTitle:
            input.pageTitle,

          preferredTone:
            input.profile
              .preferredTone,

          commandStyle:
            input.profile
              .commandStyle,

          autonomyLevel:
            input.profile
              .autonomyLevel,

          customInstructions:
            input.profile
              .customInstructions,

          personality:
            parseJson<
              Record<
                string,
                unknown
              >
            >(
              input.profile
                .personalityJson,
              {},
            ),

          risk:
            parseJson<
              Record<
                string,
                unknown
              >
            >(
              input.profile
                .riskJson,
              {},
            ),

          memory:
            platformContext.memory.map(
              (item) =>
                `${item.title}: ${item.value}`,
            ),

          recentMessages:
            (
              input.recentMessages ??
              []
            ).slice(-8),

          platformResult:
            null,

          commandIntent:
            command.intent,

          platformSnapshot:
            compactPlatformContext as unknown as Record<
              string,
              unknown
            >,

          financialContext:
            {
              parsedCommand:
                command,

              answerMode,

              advancedSettings:
                input.advancedSettings ??
                null,

              researchRequired,

              sourcePolicy:
                readSetting(
                  input.advancedSettings,
                  "sourcePolicy",
                ) ||
                "Primary First",

              operatingMode:
                readSetting(
                  input.advancedSettings,
                  "operatingMode",
                ) ||
                "Research",

              privacyRule:
                "Private client identifiers must not be used in public web-search queries. Use the platform snapshot only as internal context.",
            },

          enableWebSearch:
            researchRequired,

          requireResearch:
            researchRequired,

          speedMode:
            speedModeForAnswerMode(
              answerMode,
            ),

          safetyIdentifier:
            input.user.email,
        },
      );
  }

  const answer =
    aiResponse?.text?.trim() ||
    localCommandAnswer(
      command,
    );

  return {
    prompt,

    structuredCommand:
      command,

    platformContext,

    compactPlatformContext,

    aiResponse,

    answer,

    sources:
      aiResponse?.sources ??
      [],

    researchUsed:
      Boolean(
        aiResponse?.researchUsed,
      ),

    provider:
      aiResponse?.provider ||
      parser.provider ||
      "Slice Command Router",

    status: aiResponse
      ? aiResponse.ok
        ? "Complete"
        : aiResponse.status
      : "Interpreted",

    parser: {
      ok: parser.ok,

      provider:
        parser.provider,

      error:
        parser.error,
    },

    fastRouter: {
      used:
        useFastMatch,

      matched:
        Boolean(fastMatch),

      confidence:
        fastMatch?.confidence,

      reason:
        fastMatch?.reason,
    },
  };
}