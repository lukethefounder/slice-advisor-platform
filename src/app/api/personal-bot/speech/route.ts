import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import {
  generateSpeechAudio,
  getOpenAiAudioRuntimeStatus,
  type SpeechAudioFormat,
} from "@/lib/integrations/audio";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

type SpeechRequestBody = {
  text?: unknown;
  voice?: unknown;
  model?: unknown;
  instructions?: unknown;
  format?: unknown;
  speed?: unknown;
};

type AuthenticatedUserShape = {
  id?: string | null;
  email?: string | null;
};

type RateLimitEntry = {
  count: number;
  resetAt: number;
};

const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1_000;
const RATE_LIMIT_MAX_REQUESTS = 30;
const MAX_REQUEST_TEXT_CHARACTERS = 30_000;
const MAX_INSTRUCTION_CHARACTERS = 2_000;

const globalForSpeechRateLimit =
  globalThis as typeof globalThis & {
    __sliceSpeechRateLimits?: Map<string, RateLimitEntry>;
  };

const speechRateLimits =
  globalForSpeechRateLimit.__sliceSpeechRateLimits ??
  new Map<string, RateLimitEntry>();

globalForSpeechRateLimit.__sliceSpeechRateLimits =
  speechRateLimits;

function noStoreJson(
  body: unknown,
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, init);

  response.headers.set(
    "Cache-Control",
    "no-store, no-cache, must-revalidate",
  );

  response.headers.set("Pragma", "no-cache");
  response.headers.set(
    "X-Content-Type-Options",
    "nosniff",
  );

  response.headers.set(
    "X-Slice-AI-Disclosure",
    "AI-generated voice",
  );

  return response;
}

function readString(
  value: unknown,
  fallback = "",
  maximum = 10_000,
) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, maximum);

  return cleaned || fallback;
}

function readSpeed(value: unknown) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) {
    return 1;
  }

  return Math.min(
    4,
    Math.max(0.25, parsed),
  );
}

function readFormat(
  value: unknown,
): SpeechAudioFormat {
  const normalized = readString(
    value,
    "mp3",
    20,
  ).toLowerCase();

  if (
    normalized === "mp3" ||
    normalized === "opus" ||
    normalized === "aac" ||
    normalized === "flac" ||
    normalized === "wav" ||
    normalized === "pcm"
  ) {
    return normalized;
  }

  return "mp3";
}

function fileExtension(
  format: SpeechAudioFormat,
) {
  if (format === "pcm") {
    return "pcm";
  }

  return format;
}

function isPotentiallyCrossSiteRequest(
  request: Request,
) {
  const fetchSite = request.headers
    .get("sec-fetch-site")
    ?.trim()
    .toLowerCase();

  if (fetchSite === "cross-site") {
    return true;
  }

  const origin = request.headers.get("origin");

  if (!origin) {
    return false;
  }

  try {
    const requestUrl = new URL(request.url);
    const originUrl = new URL(origin);

    return originUrl.origin !== requestUrl.origin;
  } catch {
    return true;
  }
}

function clientIdentifier(
  request: Request,
  user: AuthenticatedUserShape,
) {
  const forwardedFor = request.headers
    .get("x-forwarded-for")
    ?.split(",")[0]
    ?.trim();

  const realIp = request.headers
    .get("x-real-ip")
    ?.trim();

  return (
    user.id ||
    user.email ||
    forwardedFor ||
    realIp ||
    "anonymous"
  );
}

function checkRateLimit(identifier: string) {
  const now = Date.now();
  const existing = speechRateLimits.get(identifier);

  if (!existing || existing.resetAt <= now) {
    const next: RateLimitEntry = {
      count: 1,
      resetAt:
        now + RATE_LIMIT_WINDOW_MS,
    };

    speechRateLimits.set(identifier, next);

    return {
      allowed: true,
      remaining:
        RATE_LIMIT_MAX_REQUESTS - 1,
      resetAt: next.resetAt,
    };
  }

  if (
    existing.count >=
    RATE_LIMIT_MAX_REQUESTS
  ) {
    return {
      allowed: false,
      remaining: 0,
      resetAt: existing.resetAt,
    };
  }

  existing.count += 1;
  speechRateLimits.set(identifier, existing);

  return {
    allowed: true,

    remaining: Math.max(
      0,
      RATE_LIMIT_MAX_REQUESTS -
        existing.count,
    ),

    resetAt: existing.resetAt,
  };
}

function cleanExpiredRateLimits() {
  if (speechRateLimits.size < 500) {
    return;
  }

  const now = Date.now();

  for (const [
    key,
    entry,
  ] of speechRateLimits.entries()) {
    if (entry.resetAt <= now) {
      speechRateLimits.delete(key);
    }
  }
}

function failureStatusCode(
  status: string,
) {
  if (status === "missing") {
    return 503;
  }

  if (status === "timeout") {
    return 504;
  }

  return 502;
}

function createResponseArrayBuffer(
  source: Uint8Array,
) {
  /*
   * TypeScript's DOM BodyInit type rejects Uint8Array<ArrayBufferLike>
   * because its backing storage might theoretically be SharedArrayBuffer.
   *
   * Creating a new Uint8Array by length guarantees a normal ArrayBuffer.
   * The audio bytes remain unchanged.
   */
  const copy = new Uint8Array(source.byteLength);

  copy.set(source);

  return copy.buffer;
}

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  const runtimeStatus =
    getOpenAiAudioRuntimeStatus();

  return noStoreJson({
    ok: true,

    audioRuntime: {
      configured:
        runtimeStatus.configured,

      provider:
        runtimeStatus.provider,

      speechModel:
        runtimeStatus.speechModel,

      speechVoice:
        runtimeStatus.speechVoice,

      speechFormat:
        runtimeStatus.speechFormat,

      speechFallbackModels:
        runtimeStatus.speechFallbackModels,

      requestTimeoutMs:
        runtimeStatus.requestTimeoutMs,

      requiredEnv:
        runtimeStatus.requiredEnv,
    },

    disclosure:
      "Spoken output is generated by artificial intelligence.",
  });
}

export async function POST(request: Request) {
  const requestStartedAt = Date.now();

  const user = await getCurrentUser();

  if (!user) {
    return noStoreJson(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  if (
    isPotentiallyCrossSiteRequest(request)
  ) {
    return noStoreJson(
      {
        error:
          "Cross-site speech requests are not allowed.",
      },
      {
        status: 403,
      },
    );
  }

  cleanExpiredRateLimits();

  const rateLimit = checkRateLimit(
    clientIdentifier(
      request,
      user as AuthenticatedUserShape,
    ),
  );

  if (!rateLimit.allowed) {
    const retryAfterSeconds = Math.max(
      1,
      Math.ceil(
        (rateLimit.resetAt - Date.now()) /
          1_000,
      ),
    );

    const response = noStoreJson(
      {
        error:
          "Too many speech requests. Try again shortly.",

        retryAfterSeconds,
      },
      {
        status: 429,
      },
    );

    response.headers.set(
      "Retry-After",
      String(retryAfterSeconds),
    );

    response.headers.set(
      "X-RateLimit-Limit",
      String(RATE_LIMIT_MAX_REQUESTS),
    );

    response.headers.set(
      "X-RateLimit-Remaining",
      "0",
    );

    return response;
  }

  let body: SpeechRequestBody;

  try {
    body =
      (await request.json()) as SpeechRequestBody;
  } catch {
    return noStoreJson(
      {
        error:
          "A valid JSON request body is required.",
      },
      {
        status: 400,
      },
    );
  }

  const text = readString(
    body.text,
    "",
    MAX_REQUEST_TEXT_CHARACTERS,
  );

  if (!text) {
    return noStoreJson(
      {
        error:
          "Speech text is required.",
      },
      {
        status: 400,
      },
    );
  }

  const runtimeStatus =
    getOpenAiAudioRuntimeStatus();

  const voice = readString(
    body.voice,
    runtimeStatus.speechVoice,
    100,
  );

  const model = readString(
    body.model,
    runtimeStatus.speechModel,
    200,
  );

  const format = readFormat(
    body.format ??
      runtimeStatus.speechFormat,
  );

  const speed = readSpeed(body.speed);

  const instructions = readString(
    body.instructions,
    [
      "Speak clearly, naturally, and professionally.",
      "Use a calm financial-advisor tone.",
      "Pronounce ticker symbols, percentages, dates, currency amounts, and financial terminology carefully.",
      "Do not add information that is not present in the supplied text.",
    ].join(" "),
    MAX_INSTRUCTION_CHARACTERS,
  );

  try {
    const result =
      await generateSpeechAudio({
        text,
        voice,
        model,
        instructions,
        format,
        speed,
      });

    if (
      !result.ok ||
      result.audio.byteLength === 0
    ) {
      return noStoreJson(
        {
          ok: false,

          error:
            result.error ||
            "Speech generation did not return usable audio.",

          audioRuntime: {
            configured:
              runtimeStatus.configured,

            provider:
              result.provider,

            requestedModel:
              result.requestedModel,

            model:
              result.model,

            voice:
              result.voice,

            format:
              result.format,

            status:
              result.status,

            fallbackUsed:
              result.fallbackUsed,

            instructionsApplied:
              result.instructionsApplied,

            attemptedModels:
              result.attemptedModels,

            latencyMs:
              result.latencyMs,

            truncated:
              result.truncated,

            audioBytes:
              result.audio.byteLength,
          },

          disclosure:
            "Spoken output is generated by artificial intelligence.",

          requestLatencyMs:
            Date.now() -
            requestStartedAt,
        },
        {
          status:
            failureStatusCode(
              result.status,
            ),
        },
      );
    }

    const responseBody =
      createResponseArrayBuffer(
        result.audio,
      );

    const response = new Response(
      responseBody,
      {
        status: 200,

        headers: {
          "Content-Type":
            result.contentType,

          "Content-Length":
            String(
              result.audio.byteLength,
            ),

          "Content-Disposition":
            `inline; filename="slice-ai-speech.${fileExtension(
              result.format,
            )}"`,

          "Cache-Control":
            "no-store, no-cache, must-revalidate",

          Pragma: "no-cache",

          "X-Content-Type-Options":
            "nosniff",

          "X-Slice-AI-Provider":
            result.provider,

          "X-Slice-AI-Requested-Model":
            result.requestedModel,

          "X-Slice-AI-Model":
            result.model,

          "X-Slice-AI-Voice":
            result.voice,

          "X-Slice-AI-Format":
            result.format,

          "X-Slice-AI-Status":
            result.status,

          "X-Slice-AI-Fallback-Used":
            String(
              result.fallbackUsed,
            ),

          "X-Slice-AI-Instructions-Applied":
            String(
              result.instructionsApplied,
            ),

          "X-Slice-AI-Truncated":
            String(
              result.truncated,
            ),

          "X-Slice-AI-Latency-Ms":
            String(
              result.latencyMs,
            ),

          "X-Slice-AI-Attempted-Models":
            result.attemptedModels.join(
              ",",
            ),

          "X-Slice-AI-Disclosure":
            "AI-generated voice",

          "X-RateLimit-Limit":
            String(
              RATE_LIMIT_MAX_REQUESTS,
            ),

          "X-RateLimit-Remaining":
            String(
              rateLimit.remaining,
            ),
        },
      },
    );

    return response;
  } catch (error) {
    return noStoreJson(
      {
        ok: false,

        error:
          "Speech generation failed.",

        detail:
          error instanceof Error
            ? error.message
            : "Unknown speech-generation error.",

        requestLatencyMs:
          Date.now() -
          requestStartedAt,
      },
      {
        status: 500,
      },
    );
  }
}