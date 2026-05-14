import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { transcribeAudio } from "@/lib/integrations/audio";
import { prisma } from "@/lib/prisma";
import {
  ensureBotProfile,
  executePersonalBotCommand,
} from "@/lib/bot/command-router";
import {
  startVoiceSession,
  updateVoiceSession,
} from "@/lib/bot/platform-brain";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function asJson(value: unknown) {
  return JSON.stringify(value);
}

function readText(value: FormDataEntryValue | null, fallback = "") {
  return typeof value === "string" && value.trim() ? value.trim() : fallback;
}

function isFile(value: FormDataEntryValue | null): value is File {
  return Boolean(value && typeof value !== "string" && typeof value.arrayBuffer === "function");
}

async function createAssistantRecoveryMessage(input: {
  userId: string;
  profileId: string;
  sessionKey: string;
  reason: string;
}) {
  const content =
    "I did not receive a clear enough voice command, so I stayed in command mode instead of failing. Try again with a short command like: “Open market visuals,” “Research NVDA,” “Run vendor health,” “Create a price alert for NVDA above 1000,” or type the command below.";

  await prisma.personalUserBotMessage.create({
    data: {
      userId: input.userId,
      profileId: input.profileId,
      role: "assistant",
      content,
      intent: "Voice Recovery",
      metadataJson: asJson({
        sessionKey: input.sessionKey,
        recoveryReason: input.reason,
        clientAction: {
          type: "none",
          autoRun: false,
        },
      }),
    },
  });

  return {
    intent: "Voice Recovery",
    answer: content,
    status: "Recovered",
    resultSummary: "Voice command did not produce a clear transcript, so the bot returned command suggestions instead of failing.",
    clientAction: {
      type: "none",
      autoRun: false,
    },
  };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const form = await request.formData();
  const audio = form.get("audio");
  const action = readText(form.get("action"), "transcribeAndExecute");
  const language = readText(form.get("language"), "en-US");
  const suppliedSessionKey = readText(form.get("sessionKey"), "");
  const fallbackPrompt = readText(form.get("fallbackPrompt"), "");
  const fallbackTranscript = readText(form.get("fallbackTranscript"), "");
  const execute = action !== "transcribeOnly";

  const profile = await ensureBotProfile(user);

  let sessionKey = suppliedSessionKey;

  if (!sessionKey) {
    const session = await startVoiceSession({
      userId: user.id,
      profileId: profile.id,
      firmId: profile.firmId,
      language,
    });

    sessionKey = session.sessionKey;
  }

  if (!isFile(audio)) {
    const fallbackText = fallbackTranscript || fallbackPrompt;

    if (fallbackText && execute) {
      const result = await executePersonalBotCommand({
        user,
        profile,
        prompt: fallbackText,
        voiceTranscript: fallbackText,
      });

      await updateVoiceSession({
        userId: user.id,
        sessionKey,
        transcript: fallbackText,
        finalTranscript: fallbackText,
        status: "Recovered",
        confidenceScore: 55,
        commandId: result.commandRecord.id,
      });

      return NextResponse.json({
        ok: true,
        recovered: true,
        sessionKey,
        transcript: fallbackText,
        executed: true,
        result: {
          intent: result.intent,
          answer: result.answer,
          status: result.status,
          resultSummary: result.resultSummary,
          clientAction: result.clientAction,
          structuredCommand: result.structuredCommand,
          aiParserOk: result.aiParserOk,
          aiParserError: result.aiParserError,
          fastRouterUsed: result.fastRouterUsed,
          fastRouterReason: result.fastRouterReason,
          fastRouterConfidence: result.fastRouterConfidence,
        },
      });
    }

    const recovery = await createAssistantRecoveryMessage({
      userId: user.id,
      profileId: profile.id,
      sessionKey,
      reason: "No audio file was received.",
    });

    await updateVoiceSession({
      userId: user.id,
      sessionKey,
      transcript: "",
      finalTranscript: "",
      status: "Recovered",
      confidenceScore: 20,
    });

    return NextResponse.json({
      ok: true,
      recovered: true,
      sessionKey,
      transcript: "",
      executed: false,
      result: recovery,
    });
  }

  const transcription = await transcribeAudio({
    file: audio,
    language: language.split("-")[0] || "en",
    prompt:
      "This is a voice command for Slice, an investment advisor platform. Common terms include Slice, market visuals, backend kernel, triage, opportunity radar, venture monitor, watchlist alerts, advisor command center, client brain, portfolio lab, NVDA, AAPL, MSFT, TSLA, OpenAI, vendor health, price check, approval, report, and PDF.",
  });

  const transcript = transcription.text || fallbackTranscript || fallbackPrompt;

  if (!transcript) {
    const recovery = await createAssistantRecoveryMessage({
      userId: user.id,
      profileId: profile.id,
      sessionKey,
      reason: transcription.error || "No transcript was returned.",
    });

    await updateVoiceSession({
      userId: user.id,
      sessionKey,
      transcript: "",
      finalTranscript: "",
      status: "Recovered",
      confidenceScore: 25,
    });

    return NextResponse.json({
      ok: true,
      recovered: true,
      sessionKey,
      transcript: "",
      transcription,
      executed: false,
      result: recovery,
    });
  }

  let botResult: Awaited<ReturnType<typeof executePersonalBotCommand>> | null = null;
  let commandId: string | null = null;

  if (execute) {
    await prisma.personalUserBotMessage.create({
      data: {
        userId: user.id,
        profileId: profile.id,
        role: "user",
        content: transcript,
        intent: "Voice Command",
        metadataJson: asJson({
          source: transcription.ok ? "openai-audio-transcription" : "voice-recovery-fallback",
          sessionKey,
          transcriptionModel: transcription.model,
          attemptedModels: transcription.attemptedModels,
          transcriptionStatus: transcription.status,
          language,
        }),
      },
    });

    botResult = await executePersonalBotCommand({
      user,
      profile,
      prompt: transcript,
      voiceTranscript: transcript,
    });

    commandId = botResult.commandRecord.id;

    await prisma.personalUserBotMessage.create({
      data: {
        userId: user.id,
        profileId: profile.id,
        role: "assistant",
        content: botResult.answer,
        intent: botResult.intent,
        metadataJson: asJson({
          commandId,
          clientAction: botResult.clientAction,
          structuredCommand: botResult.structuredCommand,
          aiParserOk: botResult.aiParserOk,
          aiParserError: botResult.aiParserError,
          fastRouterUsed: botResult.fastRouterUsed,
          fastRouterReason: botResult.fastRouterReason,
          fastRouterConfidence: botResult.fastRouterConfidence,
          voiceSessionKey: sessionKey,
          transcriptionProvider: transcription.provider,
          transcriptionModel: transcription.model,
          transcriptionStatus: transcription.status,
        }),
      },
    });
  }

  await updateVoiceSession({
    userId: user.id,
    sessionKey,
    transcript,
    finalTranscript: transcript,
    status: execute ? "Complete" : "Transcribed",
    confidenceScore: transcription.ok ? 90 : 60,
    commandId,
  });

  return NextResponse.json({
    ok: true,
    recovered: !transcription.ok,
    sessionKey,
    transcript,
    transcription,
    executed: execute,
    result: botResult
      ? {
          intent: botResult.intent,
          answer: botResult.answer,
          status: botResult.status,
          resultSummary: botResult.resultSummary,
          clientAction: botResult.clientAction,
          structuredCommand: botResult.structuredCommand,
          aiParserOk: botResult.aiParserOk,
          aiParserError: botResult.aiParserError,
          fastRouterUsed: botResult.fastRouterUsed,
          fastRouterReason: botResult.fastRouterReason,
          fastRouterConfidence: botResult.fastRouterConfidence,
        }
      : null,
  });
}