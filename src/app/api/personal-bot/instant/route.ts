import "server-only";

import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import {
  ensureBotProfile,
  executePersonalBotCommand,
  type BotProfileShape,
  type CurrentUserShape,
} from "@/lib/bot/command-router";
import {
  getOpenAiAudioRuntimeStatus,
  transcribeAudio,
} from "@/lib/integrations/audio";
import { getOpenAiRuntimeStatus } from "@/lib/integrations/ai";
import {
  PERSONAL_BOT_MEMORY_TURNS,
  PERSONAL_BOT_REPORT_LIMIT,
  PERSONAL_BOT_VISIBLE_MESSAGE_LIMIT,
  clearPersonalBotWorkingMemory,
  countStoredPersonalBotTurns,
  prunePersonalBotMemory,
} from "@/lib/personal-bot/memory";
import { prisma } from "@/lib/prisma";
import { isPotentiallyCrossSiteUnsafeRequest } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 75;

const MAXIMUM_JSON_BODY_BYTES = 48_000;
const MAXIMUM_AUDIO_BYTES = 8 * 1024 * 1024;

type AnswerMode = "quick" | "balanced" | "deep";

type InstantBotProfile = BotProfileShape & {
  voiceEnabled?: boolean;
  capabilitiesJson?: string;
};

type PersonalBotMessageRow = {
  id: string;
  role: string;
  content: string;
  intent: string;
  metadataJson: string;
  createdAt: Date;
};

type PersonalBotReportRow = {
  id: string;
  title: string;
  reportType: string;
  status: string;
  summary: string;
  designJson: string;
  downloadToken: string;
  createdAt: Date;
};

type RecentMessageRow = {
  role: string;
  content: string;
};

type ParsedRequest = {
  prompt: string;
  voiceTranscript: string | null;
  answerMode: AnswerMode;
  currentPath: string | null;
  pageTitle: string | null;
  advancedSettings: Record<string, unknown> | null;
  transcriptionMs: number | null;
  transcriptionModel: string | null;
};

type JsonRequestBody = {
  prompt?: unknown;
  voiceTranscript?: unknown;
  answerMode?: unknown;
  currentPath?: unknown;
  pageTitle?: unknown;
  advancedSettings?: unknown;
};

function cleanText(value: unknown, maximum: number) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").trim().slice(0, maximum)
    : "";
}

function readAnswerMode(value: unknown): AnswerMode {
  return value === "deep" || value === "balanced" || value === "quick"
    ? value
    : "quick";
}

function readSettings(value: unknown) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function response(body: unknown, init?: ResponseInit) {
  const next = NextResponse.json(body, init);
  next.headers.set("Cache-Control", "private, no-store, max-age=0");
  next.headers.set("Pragma", "no-cache");
  next.headers.set("X-Content-Type-Options", "nosniff");
  next.headers.set("X-Slice-AI-Path", "instant-command-v2");
  next.headers.set("X-Slice-AI-Memory-Turns", String(PERSONAL_BOT_MEMORY_TURNS));
  return next;
}

function sourceAuthorityScore(sources: Array<{ url: string; title?: string }>) {
  if (!sources.length) return 0;

  const authoritative = [
    ".gov",
    ".edu",
    "sec.gov",
    "federalreserve.gov",
    "bls.gov",
    "bea.gov",
    "irs.gov",
    "finra.org",
    "investor.gov",
    "nasdaq.com",
    "nyse.com",
    "cmegroup.com",
  ];
  const institutional = [
    "reuters.com",
    "apnews.com",
    "ft.com",
    "wsj.com",
    "bloomberg.com",
    "morningstar.com",
  ];
  const scores = sources.slice(0, 12).map((source) => {
    try {
      const host = new URL(source.url).hostname.toLowerCase();
      if (authoritative.some((domain) => host === domain || host.endsWith(domain))) return 100;
      if (institutional.some((domain) => host === domain || host.endsWith(`.${domain}`))) return 82;
      return source.url.startsWith("https://") ? 62 : 45;
    } catch {
      return 35;
    }
  });

  return Math.round(scores.reduce((sum, value) => sum + value, 0) / scores.length);
}

function inferredExecutionLane(input: {
  fastRouterUsed: boolean;
  researchUsed: boolean;
  answerMode: AnswerMode;
}) {
  if (input.fastRouterUsed && !input.researchUsed) return "Direct";
  if (input.researchUsed && input.answerMode === "deep") return "Deep Research";
  if (input.researchUsed) return "Research";
  return input.answerMode === "quick" ? "Instant Analysis" : "Adaptive Analysis";
}

function metadataForResult(input: {
  mode: AnswerMode;
  voiceTranscript: string | null;
  result: Awaited<ReturnType<typeof executePersonalBotCommand>>;
  transcriptionMs: number | null;
  transcriptionModel: string | null;
}) {
  const runtime = getOpenAiRuntimeStatus();

  return {
    commandId: input.result.commandRecord?.id ?? null,
    clientAction: input.result.clientAction,
    answerMode: input.mode,
    structuredCommand: input.result.structuredCommand,
    executionStatus: input.result.status,
    resultSummary: input.result.resultSummary,
    aiParserOk: input.result.aiParserOk,
    aiParserError: input.result.aiParserError ?? null,
    fastRouterUsed: input.result.fastRouterUsed,
    fastRouterReason: input.result.fastRouterReason ?? null,
    fastRouterConfidence: input.result.fastRouterConfidence ?? null,
    universalAiProvider:
      input.result.orchestration.provider || input.result.aiProvider,
    universalAiStatus:
      input.result.orchestration.aiStatus || input.result.status,
    universalAiError: input.result.orchestration.aiError ?? null,
    universalAiModel: input.result.orchestration.aiModel ?? null,
    universalAiConfigured: runtime.configured,
    universalAiLatencyMs: input.result.orchestration.latencyMs ?? null,
    researchUsed:
      input.result.researchUsed ?? input.result.orchestration.researchUsed,
    sources: input.result.sources ?? input.result.orchestration.sources,
    voiceTranscript: input.voiceTranscript,
    transcriptionMs: input.transcriptionMs,
    transcriptionModel: input.transcriptionModel,
    executionLane: inferredExecutionLane({
      fastRouterUsed: input.result.fastRouterUsed,
      researchUsed:
        input.result.researchUsed ?? input.result.orchestration.researchUsed,
      answerMode: input.mode,
    }),
    evidenceScore: sourceAuthorityScore(
      input.result.sources ?? input.result.orchestration.sources,
    ),
    instantResponse: true,
    rollingMemoryTurns: PERSONAL_BOT_MEMORY_TURNS,
  };
}

async function parseRequest(request: Request): Promise<ParsedRequest> {
  const contentType = request.headers.get("content-type") ?? "";

  if (contentType.includes("multipart/form-data")) {
    const form = await request.formData();
    const audio = form.get("audio");
    const fallbackTranscript = cleanText(
      form.get("fallbackTranscript") ?? form.get("prompt"),
      30_000,
    );
    let transcript = fallbackTranscript;
    let transcriptionMs: number | null = null;
    let transcriptionModel: string | null = null;

    if (audio instanceof File && audio.size > 0) {
      if (audio.size > MAXIMUM_AUDIO_BYTES) {
        throw new RangeError("Voice recordings must be 8 MB or smaller.");
      }

      const startedAt = Date.now();
      transcriptionModel =
        process.env.OPENAI_FAST_TRANSCRIBE_MODEL ||
        process.env.OPENAI_TRANSCRIBE_MODEL ||
        "gpt-4o-mini-transcribe";

      const transcription = await transcribeAudio({
        file: audio,
        language: cleanText(form.get("language"), 30) || "en-US",
        model: transcriptionModel,
        prompt:
          "Short command for Slice, a financial-advisor operating platform. Preserve ticker symbols, client names, company names, dates, percentages, prices, email addresses, and route names exactly.",
      });

      transcriptionMs = Date.now() - startedAt;
      transcript = cleanText(transcription.text, 30_000) || fallbackTranscript;

      if (!transcript) {
        throw new SyntaxError(
          transcription.error ||
            "The recording did not contain enough clear speech to execute.",
        );
      }
    }

    return {
      prompt: transcript,
      voiceTranscript: transcript || null,
      answerMode: readAnswerMode(form.get("answerMode")),
      currentPath: cleanText(form.get("currentPath"), 500) || null,
      pageTitle: cleanText(form.get("pageTitle"), 500) || null,
      advancedSettings: parseJson<Record<string, unknown> | null>(
        cleanText(form.get("advancedSettings"), 12_000),
        null,
      ),
      transcriptionMs,
      transcriptionModel,
    };
  }

  const raw = await request.text();

  if (Buffer.byteLength(raw, "utf8") > MAXIMUM_JSON_BODY_BYTES) {
    throw new RangeError("The AI request is too large.");
  }

  let body: JsonRequestBody;

  try {
    body = JSON.parse(raw || "{}") as JsonRequestBody;
  } catch {
    throw new SyntaxError("The AI request must contain valid JSON.");
  }

  const prompt = cleanText(body.prompt, 30_000);
  const voiceTranscript = cleanText(body.voiceTranscript, 30_000) || null;

  return {
    prompt,
    voiceTranscript,
    answerMode: readAnswerMode(body.answerMode),
    currentPath: cleanText(body.currentPath, 500) || null,
    pageTitle: cleanText(body.pageTitle, 500) || null,
    advancedSettings: readSettings(body.advancedSettings),
    transcriptionMs: null,
    transcriptionModel: null,
  };
}

async function lightweightBootstrap(user: CurrentUserShape) {
  const profile = (await ensureBotProfile(user)) as InstantBotProfile;
  await prunePersonalBotMemory(user.id);

  const runtime = getOpenAiRuntimeStatus();
  const audio = getOpenAiAudioRuntimeStatus();

  const [
    messageRows,
    reportRows,
    approvalRows,
    backendApprovalRows,
    membership,
    storedSearches,
  ] = await Promise.all([
    prisma.personalUserBotMessage.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: PERSONAL_BOT_VISIBLE_MESSAGE_LIMIT,
      select: {
        id: true,
        role: true,
        content: true,
        intent: true,
        metadataJson: true,
        createdAt: true,
      },
    }),
    prisma.personalUserBotPdfReport.findMany({
      where: {
        userId: user.id,
      },
      orderBy: {
        createdAt: "desc",
      },
      take: PERSONAL_BOT_REPORT_LIMIT,
      select: {
        id: true,
        title: true,
        reportType: true,
        status: true,
        summary: true,
        designJson: true,
        downloadToken: true,
        createdAt: true,
      },
    }),
    prisma.personalUserBotApprovalItem.findMany({
      where: {
        userId: user.id,
        status: "Pending",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 6,
      select: {
        id: true,
        title: true,
        status: true,
      },
    }),
    prisma.backendApprovalItem.findMany({
      where: {
        userId: user.id,
        status: "Pending",
      },
      orderBy: {
        createdAt: "desc",
      },
      take: 6,
      select: {
        id: true,
        title: true,
        status: true,
      },
    }),
    profile.firmId
      ? prisma.firmMembership.findFirst({
          where: {
            userId: user.id,
            firmId: profile.firmId,
            status: "Active",
          },
          select: {
            role: true,
            firm: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        })
      : Promise.resolve(null),
    countStoredPersonalBotTurns(user.id),
  ]);

  const messages = (messageRows as PersonalBotMessageRow[])
    .reverse()
    .map((message) => ({
      id: message.id,
      role: message.role,
      content: message.content,
      intent: message.intent,
      createdAt: message.createdAt.toISOString(),
      metadata: parseJson<Record<string, unknown>>(message.metadataJson, {}),
    }));

  const reports = (reportRows as PersonalBotReportRow[]).map((report) => {
    const design = parseJson<Record<string, unknown>>(report.designJson, {});

    return {
      id: report.id,
      title: report.title,
      reportType: report.reportType,
      status: report.status,
      summary: report.summary,
      createdAt: report.createdAt.toISOString(),
      design,
      downloadUrl: `/api/personal-bot/pdf-report?token=${encodeURIComponent(
        report.downloadToken,
      )}`,
      viewerUrl: `/workspace/personal-bot/reports?token=${encodeURIComponent(
        report.downloadToken,
      )}`,
    };
  });

  const latestAssistant = [...messages]
    .reverse()
    .find((message) => message.role === "assistant");

  return {
    ok: true,
    profile: {
      id: profile.id,
      botName: profile.botName,
      preferredTone: profile.preferredTone,
      commandStyle: profile.commandStyle,
      autonomyLevel: profile.autonomyLevel,
      voiceEnabled: profile.voiceEnabled !== false,
      customInstructions: profile.customInstructions,
      capabilities: parseJson<string[]>(profile.capabilitiesJson, []),
    },
    aiEngine: {
      provider: runtime.provider,
      configured: runtime.configured,
      model: runtime.model,
      fastModel: runtime.fastModel,
      qualityModel: runtime.qualityModel,
      webSearchEnabled: runtime.webSearchEnabled,
      health: {
        ok: runtime.configured,
        status: runtime.configured ? "ready" : "missing",
        latencyMs: 0,
        error: runtime.configured
          ? undefined
          : "OPENAI_API_KEY is not configured.",
      },
      audio,
    },
    platformContext: {
      generatedAt: new Date().toISOString(),
      firm: membership
        ? {
            id: membership.firm.id,
            name: membership.firm.name,
            role: membership.role,
          }
        : null,
    },
    messages,
    pdfReports: reports,
    approvals: approvalRows,
    backendApprovals: backendApprovalRows,
    lastExecution: latestAssistant
      ? {
          status: String(latestAssistant.metadata.executionStatus ?? "Complete"),
          resultSummary: String(
            latestAssistant.metadata.resultSummary ?? latestAssistant.content,
          ),
          clientAction:
            latestAssistant.metadata.clientAction &&
            typeof latestAssistant.metadata.clientAction === "object"
              ? latestAssistant.metadata.clientAction
              : undefined,
          sources: Array.isArray(latestAssistant.metadata.sources)
            ? latestAssistant.metadata.sources
            : [],
          researchUsed: latestAssistant.metadata.researchUsed === true,
        }
      : null,
    memoryPolicy: {
      maximumSearches: PERSONAL_BOT_MEMORY_TURNS,
      storedSearches,
      reportsPreserved: true,
      auditHistoryPreserved: true,
      description:
        "AI Studio keeps only the 10 most recent searches in working memory. Reports, approvals, and audit records are retained separately.",
    },
  };
}

export async function GET() {
  const user = (await getCurrentUser()) as CurrentUserShape | null;

  if (!user) {
    return response({ error: "Sign in to use Slice AI Studio." }, { status: 401 });
  }

  try {
    return response(await lightweightBootstrap(user));
  } catch (error) {
    console.error("[Slice AI Bootstrap]", {
      userId: user.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return response(
      {
        error: "Slice AI Studio could not load its lightweight workspace.",
      },
      { status: 500 },
    );
  }
}

export async function DELETE(request: Request) {
  if (isPotentiallyCrossSiteUnsafeRequest(request)) {
    return response({ error: "Security policy blocked this request." }, { status: 403 });
  }

  const user = (await getCurrentUser()) as CurrentUserShape | null;

  if (!user) {
    return response({ error: "Sign in to manage AI memory." }, { status: 401 });
  }

  try {
    const deleted = await clearPersonalBotWorkingMemory(user.id);

    return response({
      ok: true,
      deleted,
      memoryPolicy: {
        maximumSearches: PERSONAL_BOT_MEMORY_TURNS,
        storedSearches: 0,
      },
    });
  } catch (error) {
    console.error("[Slice AI Memory Clear]", {
      userId: user.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return response(
      {
        error: "Slice could not clear the AI working memory.",
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  if (isPotentiallyCrossSiteUnsafeRequest(request)) {
    return response({ error: "Security policy blocked this request." }, { status: 403 });
  }

  const startedAt = Date.now();
  const user = (await getCurrentUser()) as CurrentUserShape | null;

  if (!user) {
    return response({ error: "Sign in to use Slice AI Studio." }, { status: 401 });
  }

  let parsed: ParsedRequest;

  try {
    parsed = await parseRequest(request);
  } catch (error) {
    const status = error instanceof RangeError ? 413 : 400;

    return response(
      {
        error:
          error instanceof Error
            ? error.message
            : "The AI request could not be read.",
      },
      { status },
    );
  }

  if (!parsed.prompt) {
    return response(
      { error: "Enter a prompt or voice command first." },
      { status: 400 },
    );
  }

  let createdUserMessageId: string | null = null;

  try {
    const [profile, recentRows] = await Promise.all([
      ensureBotProfile(user) as Promise<InstantBotProfile>,
      prisma.personalUserBotMessage.findMany({
        where: {
          userId: user.id,
        },
        orderBy: {
          createdAt: "desc",
        },
        take: Math.min(PERSONAL_BOT_VISIBLE_MESSAGE_LIMIT, 12),
        select: {
          role: true,
          content: true,
        },
      }),
    ]);
    const recentMessages = (recentRows as RecentMessageRow[])
      .reverse()
      .slice(-6)
      .map((message) => ({
        role: message.role,
        content: message.content,
      }));

    const userMessage = await prisma.personalUserBotMessage.create({
      data: {
        userId: user.id,
        profileId: profile.id,
        role: "user",
        content: parsed.prompt,
        intent: parsed.voiceTranscript ? "Voice Command" : "Command",
        metadataJson: JSON.stringify({
          answerMode: parsed.answerMode,
          voiceTranscript: parsed.voiceTranscript,
          currentPath: parsed.currentPath,
          pageTitle: parsed.pageTitle,
          transcriptionMs: parsed.transcriptionMs,
          transcriptionModel: parsed.transcriptionModel,
          instantResponse: true,
          rollingMemoryTurns: PERSONAL_BOT_MEMORY_TURNS,
        }),
      },
      select: {
        id: true,
        role: true,
        content: true,
        intent: true,
        createdAt: true,
      },
    });
    createdUserMessageId = userMessage.id;

    const result = await executePersonalBotCommand({
      user,
      profile,
      prompt: parsed.prompt,
      voiceTranscript: parsed.voiceTranscript,
      currentPath: parsed.currentPath,
      pageTitle: parsed.pageTitle,
      answerMode: parsed.answerMode,
      recentMessages,
      advancedSettings: parsed.advancedSettings,
    });

    const metadata = metadataForResult({
      mode: parsed.answerMode,
      voiceTranscript: parsed.voiceTranscript,
      result,
      transcriptionMs: parsed.transcriptionMs,
      transcriptionModel: parsed.transcriptionModel,
    });

    const assistantMessage = await prisma.personalUserBotMessage.create({
      data: {
        userId: user.id,
        profileId: profile.id,
        role: "assistant",
        content: result.answer,
        intent: result.intent,
        metadataJson: JSON.stringify(metadata),
      },
      select: {
        id: true,
        role: true,
        content: true,
        intent: true,
        createdAt: true,
      },
    });

    const memoryCleanup = await prunePersonalBotMemory(user.id);
    const storedSearches = await countStoredPersonalBotTurns(user.id);

    return response({
      ok: true,
      latencyMs: Date.now() - startedAt,
      transcriptionMs: parsed.transcriptionMs,
      transcript: parsed.voiceTranscript,
      userMessage: {
        ...userMessage,
        createdAt: userMessage.createdAt.toISOString(),
      },
      assistantMessage: {
        ...assistantMessage,
        createdAt: assistantMessage.createdAt.toISOString(),
        metadata,
      },
      result: {
        intent: result.intent,
        status: result.status,
        answer: result.answer,
        resultSummary: result.resultSummary,
        clientAction: result.clientAction,
        structuredCommand: result.structuredCommand,
        fastRouterUsed: result.fastRouterUsed,
        fastRouterConfidence: result.fastRouterConfidence ?? null,
        sources: result.sources ?? result.orchestration.sources,
        researchUsed:
          result.researchUsed ?? result.orchestration.researchUsed,
        provider: result.orchestration.provider || result.aiProvider,
        model: result.orchestration.aiModel ?? null,
        providerLatencyMs: result.orchestration.latencyMs ?? null,
        commandId: result.commandRecord?.id ?? null,
        executionLane: inferredExecutionLane({
          fastRouterUsed: result.fastRouterUsed,
          researchUsed: result.researchUsed ?? result.orchestration.researchUsed,
          answerMode: parsed.answerMode,
        }),
        evidenceScore: sourceAuthorityScore(
          result.sources ?? result.orchestration.sources,
        ),
      },
      memoryPolicy: {
        maximumSearches: PERSONAL_BOT_MEMORY_TURNS,
        storedSearches,
        pruned: memoryCleanup,
      },
    });
  } catch (error) {
    if (createdUserMessageId) {
      await prisma.personalUserBotMessage
        .delete({
          where: {
            id: createdUserMessageId,
          },
        })
        .catch(() => undefined);
    }

    console.error("[Slice AI Instant]", {
      userId: user.id,
      error: error instanceof Error ? error.message : "Unknown error",
    });

    return response(
      {
        error:
          "Slice AI could not complete that request. The prompt was not sent externally a second time; retry when ready.",
      },
      { status: 500 },
    );
  }
}