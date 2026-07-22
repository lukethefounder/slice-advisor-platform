import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  ensureBotProfile,
  executePersonalBotCommand,
  type BotProfileShape,
  type CurrentUserShape,
  type ExecutePersonalBotCommandResult,
} from "@/lib/bot/command-router";
import {
  startVoiceSession,
  updateVoiceSession,
} from "@/lib/bot/platform-brain";
import {
  getOpenAiAudioRuntimeStatus,
  transcribeAudio,
  type AudioTranscriptionResult,
} from "@/lib/integrations/audio";
import { prisma } from "@/lib/prisma";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

const db = prisma as any;

type AnswerMode =
  | "quick"
  | "balanced"
  | "deep";

type RecentMessage = {
  role: string;
  content: string;
};

type VoiceRequestPayload = {
  audio:
    | File
    | null;
  action: string;
  language: string;
  suppliedSessionKey: string;
  fallbackPrompt: string;
  fallbackTranscript: string;
  currentPath:
    | string
    | null;
  pageTitle:
    | string
    | null;
  answerMode: AnswerMode;
  recentMessages: RecentMessage[];
  advancedSettings:
    | Record<
        string,
        unknown
      >
    | null;
};

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
    "X-Slice-Voice-Ops",
    "low-latency-unified",
  );

  return response;
}

function asJson(
  value: unknown,
) {
  return JSON.stringify(
    value,
  );
}

function parseJson<T>(
  value: unknown,
  fallback: T,
): T {
  if (
    typeof value !==
      "string" ||
    !value.trim()
  ) {
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

function cleanText(
  value: unknown,
  fallback = "",
  maximum = 30_000,
) {
  if (
    typeof value !==
    "string"
  ) {
    return fallback;
  }

  const clean =
    value
      .replace(
        /\u0000/g,
        "",
      )
      .trim()
      .slice(
        0,
        maximum,
      );

  return clean ||
    fallback;
}

function nullableText(
  value: unknown,
  maximum = 1000,
) {
  return (
    cleanText(
      value,
      "",
      maximum,
    ) || null
  );
}

function readAnswerMode(
  value: unknown,
): AnswerMode {
  return value ===
      "quick" ||
    value ===
      "balanced" ||
    value ===
      "deep"
    ? value
    : "balanced";
}

function isFile(
  value: unknown,
): value is File {
  return Boolean(
    value &&
      typeof value !==
        "string" &&
      typeof (
        value as File
      ).arrayBuffer ===
        "function",
  );
}

function normalizeRecentMessages(
  value: unknown,
): RecentMessage[] {
  if (
    !Array.isArray(
      value,
    )
  ) {
    return [];
  }

  return value
    .map((item) => {
      if (
        !item ||
        typeof item !==
          "object"
      ) {
        return null;
      }

      const record =
        item as Record<
          string,
          unknown
        >;

      const content =
        cleanText(
          record.content,
          "",
          12_000,
        );

      if (!content) {
        return null;
      }

      return {
        role:
          cleanText(
            record.role,
            "assistant",
            40,
          ),

        content,
      };
    })
    .filter(
      (
        item,
      ): item is RecentMessage =>
        Boolean(item),
    )
    .slice(-8);
}

function normalizeAdvancedSettings(
  value: unknown,
) {
  if (
    !value ||
    typeof value !==
      "object" ||
    Array.isArray(
      value,
    )
  ) {
    return null;
  }

  return value as Record<
    string,
    unknown
  >;
}

async function readVoiceRequest(
  request: Request,
): Promise<VoiceRequestPayload> {
  const contentType =
    request.headers.get(
      "content-type",
    ) ?? "";

  if (
    contentType.includes(
      "application/json",
    )
  ) {
    const body =
      (await request
        .json()
        .catch(
          () => ({}),
        )) as Record<
        string,
        unknown
      >;

    return {
      audio: null,

      action:
        cleanText(
          body.action,
          "transcribeAndExecute",
          100,
        ),

      language:
        cleanText(
          body.language,
          "en-US",
          30,
        ),

      suppliedSessionKey:
        cleanText(
          body.sessionKey,
          "",
          200,
        ),

      fallbackPrompt:
        cleanText(
          body.fallbackPrompt ??
            body.prompt,
        ),

      fallbackTranscript:
        cleanText(
          body.fallbackTranscript ??
            body.transcript,
        ),

      currentPath:
        nullableText(
          body.currentPath,
          500,
        ),

      pageTitle:
        nullableText(
          body.pageTitle,
          500,
        ),

      answerMode:
        readAnswerMode(
          body.answerMode,
        ),

      recentMessages:
        normalizeRecentMessages(
          body.recentMessages,
        ),

      advancedSettings:
        normalizeAdvancedSettings(
          body.advancedSettings,
        ),
    };
  }

  const form =
    await request.formData();

  const audioValue =
    form.get("audio");

  return {
    audio: isFile(
      audioValue,
    )
      ? audioValue
      : null,

    action:
      cleanText(
        form.get("action"),
        "transcribeAndExecute",
        100,
      ),

    language:
      cleanText(
        form.get(
          "language",
        ),
        "en-US",
        30,
      ),

    suppliedSessionKey:
      cleanText(
        form.get(
          "sessionKey",
        ),
        "",
        200,
      ),

    fallbackPrompt:
      cleanText(
        form.get(
          "fallbackPrompt",
        ),
      ),

    fallbackTranscript:
      cleanText(
        form.get(
          "fallbackTranscript",
        ),
      ),

    currentPath:
      nullableText(
        form.get(
          "currentPath",
        ),
        500,
      ),

    pageTitle:
      nullableText(
        form.get(
          "pageTitle",
        ),
        500,
      ),

    answerMode:
      readAnswerMode(
        form.get(
          "answerMode",
        ),
      ),

    recentMessages:
      normalizeRecentMessages(
        parseJson<unknown>(
          form.get(
            "recentMessages",
          ),
          [],
        ),
      ),

    advancedSettings:
      normalizeAdvancedSettings(
        parseJson<unknown>(
          form.get(
            "advancedSettings",
          ),
          null,
        ),
      ),
  };
}

async function recentMessagesForUser(
  userId: string,
) {
  const rows =
    await db.personalUserBotMessage.findMany(
      {
        where: {
          userId,
        },

        select: {
          role: true,
          content: true,
        },

        orderBy: {
          createdAt:
            "desc",
        },

        take: 8,
      },
    );

  return rows
    .reverse()
    .map(
      (row: any) => ({
        role: row.role,
        content:
          row.content,
      }),
    );
}

async function ensureVoiceSession(
  input: {
    user: CurrentUserShape;
    profile: BotProfileShape;
    suppliedSessionKey: string;
    language: string;
  },
) {
  if (
    input.suppliedSessionKey
  ) {
    const existing =
      await db.personalUserBotVoiceSession.findFirst(
        {
          where: {
            userId:
              input.user.id,

            sessionKey:
              input.suppliedSessionKey,
          },
        },
      );

    if (existing) {
      return existing;
    }
  }

  return startVoiceSession(
    {
      userId:
        input.user.id,

      profileId:
        input.profile.id,

      firmId:
        input.profile
          .firmId,

      language:
        input.language,
    },
  );
}

async function saveMessage(
  input: {
    userId: string;
    profileId: string;
    role:
      | "user"
      | "assistant";
    content: string;
    intent: string;
    metadata: Record<
      string,
      unknown
    >;
  },
) {
  return db.personalUserBotMessage.create(
    {
      data: {
        userId:
          input.userId,

        profileId:
          input.profileId,

        role:
          input.role,

        content:
          input.content,

        intent:
          input.intent,

        metadataJson:
          asJson(
            input.metadata,
          ),
      },
    },
  );
}

function resultPayload(
  result:
    | ExecutePersonalBotCommandResult
    | null,
) {
  if (!result) {
    return null;
  }

  return {
    intent:
      result.intent,

    answer:
      result.answer,

    status:
      result.status,

    resultSummary:
      result.resultSummary,

    clientAction:
      result.clientAction,

    structuredCommand:
      result.structuredCommand,

    aiParserOk:
      result.aiParserOk,

    aiParserError:
      result.aiParserError,

    fastRouterUsed:
      result.fastRouterUsed,

    fastRouterReason:
      result.fastRouterReason,

    fastRouterConfidence:
      result.fastRouterConfidence,

    sources:
      result.sources ??
      result.orchestration
        .sources,

    researchUsed:
      result.researchUsed ??
      result.orchestration
        .researchUsed,

    orchestration:
      result.orchestration,

    commandId:
      result.commandRecord
        ?.id ??
      null,
  };
}

function recoveryAnswer(
  reason: string,
) {
  return `I could not obtain a reliable transcript from that recording.

Reason: ${reason}

Try a shorter command such as:
- Open client profiles.
- Research NVDA with current sources.
- Create a task to review the client briefing tomorrow.
- Create a report explaining market volatility.
- Run backend vendor health.`;
}

export async function POST(
  request: Request,
) {
  const requestStartedAt =
    Date.now();

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
    const payload =
      await readVoiceRequest(
        request,
      );

    const execute =
      payload.action !==
      "transcribeOnly";

    const profile =
      await ensureBotProfile(
        user,
      );

    const audioRuntime =
      getOpenAiAudioRuntimeStatus();

    const session =
      await ensureVoiceSession(
        {
          user,
          profile,

          suppliedSessionKey:
            payload.suppliedSessionKey,

          language:
            payload.language,
        },
      );

    const sessionKey =
      session.sessionKey;

    let transcription:
      | AudioTranscriptionResult
      | null = null;

    const transcriptionStartedAt =
      Date.now();

    if (payload.audio) {
      transcription =
        await transcribeAudio(
          {
            file:
              payload.audio,

            language:
              payload.language,

            model:
              process.env
                .OPENAI_FAST_TRANSCRIBE_MODEL ||
              process.env
                .OPENAI_TRANSCRIBE_MODEL ||
              "gpt-4o-mini-transcribe",

            prompt:
              "Short command for Slice, a financial-advisor operating platform. Preserve ticker symbols, company names, client workflow terms, dates, percentages, prices, email addresses, and route names exactly. Common routes and terms include Workspace, Custom Board, Watchlists, Market Visuals, Intelligence, Triage, Opportunity Radar, Client Portal Inbox, Client Profiles, Client Email Center, Client Briefings, AI Studio, Team Board, Firm Command Center, Portfolio Lab, Alternative Investments, Backend Kernel, Backend Readiness, Briefings, Security, Compliance Center, settings, advisor day, vendor health, price alert, approval, report, and PDF.",
          },
        );
    }

    const transcriptionMs =
      Date.now() -
      transcriptionStartedAt;

    const transcript =
      transcription?.text ||
      payload.fallbackTranscript ||
      payload.fallbackPrompt;

    if (!transcript) {
      const reason =
        transcription?.error ||
        (payload.audio
          ? "The audio did not contain enough clear speech."
          : "No audio or transcript was supplied.");

      const answer =
        recoveryAnswer(
          reason,
        );

      await saveMessage({
        userId: user.id,
        profileId:
          profile.id,
        role:
          "assistant",
        content: answer,
        intent:
          "Voice Recovery",

        metadata: {
          voiceSessionKey:
            sessionKey,

          recoveryReason:
            reason,

          transcription,

          clientAction: {
            type: "none",
            autoRun: false,
          },
        },
      });

      await updateVoiceSession(
        {
          userId:
            user.id,

          sessionKey,

          transcript: "",

          finalTranscript:
            "",

          status:
            "Failed",

          confidenceScore:
            10,

          commandId: null,
        },
      );

      return noStoreJson(
        {
          ok: false,

          recovered:
            true,

          sessionKey,

          transcript: "",

          transcription,

          audioRuntime,

          executed: false,

          result: {
            intent:
              "Voice Recovery",

            answer,

            status:
              "Recovered",

            clientAction: {
              type:
                "none",

              autoRun:
                false,
            },
          },

          performance: {
            totalMs:
              Date.now() -
              requestStartedAt,

            transcriptionMs,

            executionMs: 0,
          },
        },
        {
          status: 422,
        },
      );
    }

    if (!execute) {
      await updateVoiceSession(
        {
          userId:
            user.id,

          sessionKey,

          transcript,

          finalTranscript:
            transcript,

          status:
            "Transcribed",

          confidenceScore:
            transcription?.ok
              ? 96
              : 70,

          commandId: null,
        },
      );

      return noStoreJson({
        ok: true,

        recovered:
          !transcription?.ok,

        sessionKey,

        transcript,

        transcription,

        audioRuntime,

        executed:
          false,

        result: null,

        performance: {
          totalMs:
            Date.now() -
            requestStartedAt,

          transcriptionMs,

          executionMs: 0,
        },
      });
    }

    const recentMessages =
      payload.recentMessages
        .length
        ? payload.recentMessages
        : await recentMessagesForUser(
            user.id,
          );

    await saveMessage({
      userId: user.id,

      profileId:
        profile.id,

      role: "user",

      content:
        transcript,

      intent:
        "Voice Command",

      metadata: {
        voiceSessionKey:
          sessionKey,

        language:
          payload.language,

        answerMode:
          payload.answerMode,

        transcriptionProvider:
          transcription?.provider ??
          "browser-or-text",

        transcriptionModel:
          transcription?.model ??
          null,

        transcriptionStatus:
          transcription?.status ??
          "fallback",

        transcriptionError:
          transcription?.error ??
          null,

        transcriptionLatencyMs:
          transcription?.latencyMs ??
          transcriptionMs,

        lowLatencyCommandPath:
          true,
      },
    });

    const executionStartedAt =
      Date.now();

    const result =
      await executePersonalBotCommand(
        {
          user,
          profile,

          prompt:
            transcript,

          voiceTranscript:
            transcript,

          currentPath:
            payload.currentPath ||
            "/workspace/personal-bot",

          pageTitle:
            payload.pageTitle ||
            "Slice AI Studio Voice Ops",

          answerMode:
            payload.answerMode,

          recentMessages,

          advancedSettings:
            payload.advancedSettings,
        },
      );

    const executionMs =
      Date.now() -
      executionStartedAt;

    await saveMessage({
      userId: user.id,

      profileId:
        profile.id,

      role:
        "assistant",

      content:
        result.answer,

      intent:
        result.intent,

      metadata: {
        commandId:
          result.commandRecord
            ?.id ??
          null,

        clientAction:
          result.clientAction,

        structuredCommand:
          result.structuredCommand,

        executionStatus:
          result.status,

        resultSummary:
          result.resultSummary,

        aiParserOk:
          result.aiParserOk,

        aiParserError:
          result.aiParserError ??
          null,

        fastRouterUsed:
          result.fastRouterUsed,

        fastRouterReason:
          result.fastRouterReason ??
          null,

        fastRouterConfidence:
          result.fastRouterConfidence ??
          null,

        universalAiProvider:
          result.orchestration
            .provider ||
          result.aiProvider,

        universalAiStatus:
          result.orchestration
            .aiStatus ||
          result.status,

        universalAiError:
          result.orchestration
            .aiError ??
          null,

        universalAiModel:
          result.orchestration
            .aiModel ??
          null,

        universalAiLatencyMs:
          result.orchestration
            .latencyMs ??
          null,

        researchUsed:
          result.researchUsed ??
          result.orchestration
            .researchUsed,

        sources:
          result.sources ??
          result.orchestration
            .sources,

        voiceSessionKey:
          sessionKey,

        transcriptionProvider:
          transcription?.provider ??
          "browser-or-text",

        transcriptionModel:
          transcription?.model ??
          null,

        transcriptionStatus:
          transcription?.status ??
          "fallback",

        performance: {
          transcriptionMs,
          executionMs,

          totalMs:
            Date.now() -
            requestStartedAt,
        },
      },
    });

    const failed =
      result.status ===
        "Failed" ||
      result.status ===
        "Error";

    await updateVoiceSession(
      {
        userId: user.id,

        sessionKey,

        transcript,

        finalTranscript:
          transcript,

        status: failed
          ? "Failed"
          : "Complete",

        confidenceScore:
          transcription?.ok
            ? 96
            : 72,

        commandId:
          result.commandRecord
            ?.id ??
          null,
      },
    );

    return noStoreJson({
      ok: !failed,

      recovered:
        !transcription?.ok,

      sessionKey,

      transcript,

      transcription,

      audioRuntime,

      executed: true,

      result:
        resultPayload(
          result,
        ),

      speech: {
        available:
          audioRuntime.configured,

        endpoint:
          "/api/personal-bot/speech",

        text:
          result.answer,

        voice:
          audioRuntime.speechVoice,

        model:
          audioRuntime.speechModel,

        format:
          audioRuntime.speechFormat,

        disclosure:
          "Spoken output is AI-generated.",
      },

      performance: {
        totalMs:
          Date.now() -
          requestStartedAt,

        transcriptionMs,

        executionMs,

        fastRouterUsed:
          result.fastRouterUsed,
      },
    });
  } catch (error) {
    return noStoreJson(
      {
        ok: false,

        error:
          "Voice Ops request failed.",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown Voice Ops error.",

        performance: {
          totalMs:
            Date.now() -
            requestStartedAt,
        },
      },
      {
        status: 500,
      },
    );
  }
}