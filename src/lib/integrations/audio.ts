import { getOptionalEnv } from "@/lib/env";

export type SpeechAudioFormat =
  | "mp3"
  | "opus"
  | "aac"
  | "flac"
  | "wav"
  | "pcm";

export type AudioTranscriptionStatus =
  | "completed"
  | "failed"
  | "missing"
  | "recovered";

export type SpeechAudioStatus =
  | "completed"
  | "failed"
  | "missing"
  | "recovered"
  | "timeout";

export type AudioTranscriptionResult = {
  ok: boolean;
  provider: string;
  model: string;
  text: string;
  status: AudioTranscriptionStatus;
  error?: string;
  raw?: unknown;
  attemptedModels?: string[];
  latencyMs?: number;
  fileSizeBytes?: number;
  maxUploadBytes?: number;
};

export type SpeechAudioResult = {
  ok: boolean;
  provider: string;
  model: string;
  requestedModel: string;
  voice: string;
  format: SpeechAudioFormat;
  status: SpeechAudioStatus;
  audio: Uint8Array;
  contentType: string;
  latencyMs: number;
  attemptedModels: string[];
  fallbackUsed: boolean;
  instructionsApplied: boolean;
  truncated: boolean;
  error?: string;
  raw?: unknown;
};

export type OpenAiAudioRuntimeStatus = {
  configured: boolean;
  provider: "OpenAI";
  transcriptionModel: string;
  speechModel: string;
  speechVoice: string;
  speechFormat: SpeechAudioFormat;
  speechFallbackModels: string[];
  maxUploadMb: number;
  maxUploadBytes: number;
  requestTimeoutMs: number;
  requiredEnv: "OPENAI_API_KEY";
};

const DEFAULT_MAX_UPLOAD_MB = 24;
const OPENAI_HARD_MAX_UPLOAD_MB = 25;
const DEFAULT_REQUEST_TIMEOUT_MS = 90_000;
const MIN_REQUEST_TIMEOUT_MS = 10_000;
const MAX_REQUEST_TIMEOUT_MS = 180_000;
const MAX_TRANSCRIPTION_PROMPT_CHARACTERS = 4_000;
const MAX_SPEECH_INPUT_CHARACTERS = 4_096;
const MAX_SPEECH_INSTRUCTION_CHARACTERS = 2_000;

const AUDIO_SIZE_ENV_NAMES = [
  "OPENAI_AUDIO_MAX_UPLOAD_MB",
  "OPENAI_AUDIO_MAX_MB",
  "OPENAI_MAX_AUDIO_MB",
  "AUDIO_MAX_UPLOAD_MB",
] as const;

const CONTENT_TYPES: Record<SpeechAudioFormat, string> = {
  mp3: "audio/mpeg",
  opus: "audio/ogg",
  aac: "audio/aac",
  flac: "audio/flac",
  wav: "audio/wav",
  pcm: "application/octet-stream",
};

function cleanEnv(name: string): string {
  return String(getOptionalEnv(name) ?? "").trim();
}

function firstEnv(names: readonly string[]): string {
  for (const name of names) {
    const value = cleanEnv(name);

    if (value) {
      return value;
    }
  }

  return "";
}

function readPositiveNumber(
  names: readonly string[],
  fallback: number,
  minimum: number,
  maximum: number,
): number {
  const raw = firstEnv(names);

  if (!raw) {
    return fallback;
  }

  const parsed = Number(raw);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.min(maximum, Math.max(minimum, parsed));
}

function maxUploadMb(): number {
  return readPositiveNumber(
    AUDIO_SIZE_ENV_NAMES,
    DEFAULT_MAX_UPLOAD_MB,
    1,
    OPENAI_HARD_MAX_UPLOAD_MB,
  );
}

function requestTimeoutMs(): number {
  return Math.round(
    readPositiveNumber(
      ["OPENAI_AUDIO_TIMEOUT_MS"],
      DEFAULT_REQUEST_TIMEOUT_MS,
      MIN_REQUEST_TIMEOUT_MS,
      MAX_REQUEST_TIMEOUT_MS,
    ),
  );
}

function defaultTranscriptionModel(): string {
  return (
    cleanEnv("OPENAI_FAST_TRANSCRIBE_MODEL") ||
    cleanEnv("OPENAI_TRANSCRIBE_MODEL") ||
    "gpt-4o-mini-transcribe"
  );
}

function defaultSpeechModel(): string {
  return cleanEnv("OPENAI_SPEECH_MODEL") || "gpt-4o-mini-tts";
}

function defaultSpeechVoice(): string {
  return cleanEnv("OPENAI_SPEECH_VOICE") || "cedar";
}

function normalizeSpeechFormat(
  value: unknown,
): SpeechAudioFormat {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

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

function defaultSpeechFormat(): SpeechAudioFormat {
  return normalizeSpeechFormat(
    cleanEnv("OPENAI_SPEECH_FORMAT") || "mp3",
  );
}

function normalizeLanguage(value?: string): string {
  const normalized = String(value ?? "")
    .trim()
    .toLowerCase();

  return normalized
    ? normalized.split(/[-_]/)[0] || ""
    : "";
}

function uniqueStrings(
  values: Array<string | null | undefined>,
): string[] {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  );
}

function configuredSpeechFallbackModels(): string[] {
  const configured = cleanEnv(
    "OPENAI_SPEECH_FALLBACK_MODELS",
  )
    .split(",")
    .map((value) => value.trim())
    .filter(Boolean);

  return uniqueStrings([
    ...configured,
    "gpt-4o-mini-tts",
    "tts-1",
    "tts-1-hd",
  ]);
}

function safeErrorMessage(
  value: unknown,
  fallback: string,
): string {
  if (value && typeof value === "object") {
    const record = value as Record<string, unknown>;
    const nested = record.error;

    if (nested && typeof nested === "object") {
      const message = (
        nested as Record<string, unknown>
      ).message;

      if (
        typeof message === "string" &&
        message.trim()
      ) {
        return message.trim();
      }
    }

    if (
      typeof record.message === "string" &&
      record.message.trim()
    ) {
      return record.message.trim();
    }
  }

  return fallback;
}

function supportsSpeechInstructions(
  model: string,
): boolean {
  return !model
    .trim()
    .toLowerCase()
    .startsWith("tts-1");
}

function isAbortError(error: unknown): boolean {
  return (
    error instanceof Error &&
    error.name === "AbortError"
  );
}

async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();

  const timer = setTimeout(
    () => controller.abort(),
    timeoutMs,
  );

  try {
    return await fetch(url, {
      ...init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

async function readResponsePayload(
  response: Response,
): Promise<unknown> {
  const contentType =
    response.headers.get("content-type") ?? "";

  if (contentType.includes("application/json")) {
    return response.json().catch(() => ({}));
  }

  return response.text().catch(() => "");
}

async function transcribeWithModel(input: {
  apiKey: string;
  model: string;
  file: File;
  language?: string;
  prompt?: string;
  timeoutMs: number;
}): Promise<AudioTranscriptionResult> {
  const startedAt = Date.now();
  const formData = new FormData();

  formData.set("model", input.model);

  formData.set(
    "file",
    input.file,
    input.file.name || "slice-voice.webm",
  );

  const language = normalizeLanguage(input.language);

  if (language) {
    formData.set("language", language);
  }

  const prompt = String(input.prompt ?? "")
    .trim()
    .slice(0, MAX_TRANSCRIPTION_PROMPT_CHARACTERS);

  if (prompt) {
    formData.set("prompt", prompt);
  }

  try {
    const response = await fetchWithTimeout(
      "https://api.openai.com/v1/audio/transcriptions",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${input.apiKey}`,
        },

        body: formData,
      },
      input.timeoutMs,
    );

    const payload = await readResponsePayload(response);

    if (!response.ok) {
      return {
        ok: false,
        provider: "OpenAI",
        model: input.model,
        text: "",
        status: "failed",
        raw: payload,
        latencyMs: Date.now() - startedAt,

        error: safeErrorMessage(
          payload,
          `OpenAI transcription failed with HTTP ${response.status}.`,
        ),
      };
    }

    const text =
      payload && typeof payload === "object"
        ? String(
            (
              payload as Record<string, unknown>
            ).text ?? "",
          ).trim()
        : "";

    if (!text) {
      return {
        ok: false,
        provider: "OpenAI",
        model: input.model,
        text: "",
        status: "failed",
        raw: payload,
        latencyMs: Date.now() - startedAt,
        error:
          "Transcription completed but returned no text.",
      };
    }

    return {
      ok: true,
      provider: "OpenAI",
      model: input.model,
      text,
      status: "completed",
      raw: payload,
      latencyMs: Date.now() - startedAt,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "OpenAI",
      model: input.model,
      text: "",
      status: "failed",
      latencyMs: Date.now() - startedAt,

      error: isAbortError(error)
        ? `Audio transcription timed out after ${Math.round(
            input.timeoutMs / 1_000,
          )} seconds.`
        : error instanceof Error
          ? error.message
          : "Audio transcription failed.",
    };
  }
}

async function generateSpeechWithModel(input: {
  apiKey: string;
  model: string;
  requestedModel: string;
  voice: string;
  text: string;
  instructions: string;
  format: SpeechAudioFormat;
  speed: number;
  timeoutMs: number;
  attemptedModels: string[];
  truncated: boolean;
}): Promise<SpeechAudioResult> {
  const startedAt = Date.now();

  const instructionsApplied = Boolean(
    input.instructions &&
      supportsSpeechInstructions(input.model),
  );

  const body: Record<string, unknown> = {
    model: input.model,
    voice: input.voice,
    input: input.text,
    response_format: input.format,
    speed: input.speed,
  };

  if (instructionsApplied) {
    body.instructions = input.instructions;
  }

  const baseResult = (
    values: Partial<SpeechAudioResult>,
  ): SpeechAudioResult => ({
    ok: false,
    provider: "OpenAI",
    model: input.model,
    requestedModel: input.requestedModel,
    voice: input.voice,
    format: input.format,
    status: "failed",
    audio: new Uint8Array(),
    contentType: CONTENT_TYPES[input.format],
    latencyMs: Date.now() - startedAt,
    attemptedModels: [...input.attemptedModels],

    fallbackUsed:
      input.model !== input.requestedModel,

    instructionsApplied,
    truncated: input.truncated,
    ...values,
  });

  try {
    const response = await fetchWithTimeout(
      "https://api.openai.com/v1/audio/speech",
      {
        method: "POST",

        headers: {
          Authorization: `Bearer ${input.apiKey}`,
          "Content-Type": "application/json",
        },

        body: JSON.stringify(body),
      },
      input.timeoutMs,
    );

    if (!response.ok) {
      const payload = await readResponsePayload(response);

      return baseResult({
        raw: payload,

        error: safeErrorMessage(
          payload,
          `OpenAI speech generation failed with HTTP ${response.status}.`,
        ),
      });
    }

    const audio = new Uint8Array(
      await response.arrayBuffer(),
    );

    if (!audio.byteLength) {
      return baseResult({
        audio,

        error:
          "OpenAI speech generation returned an empty audio file.",
      });
    }

    return baseResult({
      ok: true,

      status:
        input.model === input.requestedModel
          ? "completed"
          : "recovered",

      audio,

      contentType:
        response.headers.get("content-type") ||
        CONTENT_TYPES[input.format],
    });
  } catch (error) {
    if (isAbortError(error)) {
      return baseResult({
        status: "timeout",

        error: `Speech generation timed out after ${Math.round(
          input.timeoutMs / 1_000,
        )} seconds.`,
      });
    }

    return baseResult({
      status: "failed",

      error:
        error instanceof Error
          ? error.message
          : "Speech generation failed.",
    });
  }
}

export function getOpenAiAudioRuntimeStatus(): OpenAiAudioRuntimeStatus {
  const uploadMb = maxUploadMb();
  const speechModel = defaultSpeechModel();

  return {
    configured: Boolean(cleanEnv("OPENAI_API_KEY")),
    provider: "OpenAI",
    transcriptionModel: defaultTranscriptionModel(),
    speechModel,
    speechVoice: defaultSpeechVoice(),
    speechFormat: defaultSpeechFormat(),

    speechFallbackModels: uniqueStrings([
      speechModel,
      ...configuredSpeechFallbackModels(),
    ]),

    maxUploadMb: uploadMb,

    maxUploadBytes: Math.floor(
      uploadMb * 1024 * 1024,
    ),

    requestTimeoutMs: requestTimeoutMs(),
    requiredEnv: "OPENAI_API_KEY",
  };
}

export async function transcribeAudio(input: {
  file: File;
  language?: string;
  prompt?: string;
  model?: string;
}): Promise<AudioTranscriptionResult> {
  const runtime = getOpenAiAudioRuntimeStatus();
  const apiKey = cleanEnv("OPENAI_API_KEY");

  const preferredModel =
    String(input.model ?? "").trim() ||
    runtime.transcriptionModel;

  const fileSizeBytes = Number(
    input.file?.size ?? 0,
  );

  const failure = (
    error: string,
    status: AudioTranscriptionStatus = "failed",
  ): AudioTranscriptionResult => ({
    ok: false,
    provider: "OpenAI",
    model: preferredModel,
    text: "",
    status,
    error,
    attemptedModels: [preferredModel],
    fileSizeBytes,
    maxUploadBytes: runtime.maxUploadBytes,
  });

  if (!apiKey) {
    return failure(
      "OPENAI_API_KEY is missing.",
      "missing",
    );
  }

  if (
    !input.file ||
    typeof input.file.arrayBuffer !== "function"
  ) {
    return failure(
      "A valid audio file is required.",
    );
  }

  if (
    !Number.isFinite(fileSizeBytes) ||
    fileSizeBytes <= 0
  ) {
    return failure(
      "The recorded audio file is empty.",
    );
  }

  if (fileSizeBytes > runtime.maxUploadBytes) {
    const actualMb =
      fileSizeBytes / (1024 * 1024);

    return failure(
      `The audio file is ${actualMb.toFixed(
        2,
      )} MB and exceeds the configured ${runtime.maxUploadMb.toFixed(
        0,
      )} MB limit.`,
    );
  }

  const models = uniqueStrings([
    preferredModel,
    cleanEnv("OPENAI_FAST_TRANSCRIBE_MODEL"),
    cleanEnv("OPENAI_TRANSCRIBE_MODEL"),
    "gpt-4o-mini-transcribe",
    "gpt-4o-transcribe",
    "whisper-1",
  ]);

  const attemptedModels: string[] = [];

  let lastFailure:
    | AudioTranscriptionResult
    | null = null;

  const startedAt = Date.now();

  for (const model of models) {
    attemptedModels.push(model);

    const result = await transcribeWithModel({
      apiKey,
      model,
      file: input.file,
      language: input.language,
      prompt: input.prompt,
      timeoutMs: runtime.requestTimeoutMs,
    });

    if (result.ok && result.text) {
      return {
        ...result,
        attemptedModels: [...attemptedModels],

        status:
          model === preferredModel
            ? "completed"
            : "recovered",

        latencyMs: Date.now() - startedAt,
        fileSizeBytes,
        maxUploadBytes: runtime.maxUploadBytes,
      };
    }

    lastFailure = result;
  }

  return {
    ok: false,
    provider: "OpenAI",
    model: preferredModel,
    text: "",
    status: "failed",

    error:
      lastFailure?.error ||
      "No transcription model returned usable text.",

    raw: lastFailure?.raw,
    attemptedModels,
    latencyMs: Date.now() - startedAt,
    fileSizeBytes,
    maxUploadBytes: runtime.maxUploadBytes,
  };
}

export async function generateSpeechAudio(input: {
  text: string;
  voice?: string;
  model?: string;
  instructions?: string | null;
  format?: SpeechAudioFormat | string;
  speed?: number;
}): Promise<SpeechAudioResult> {
  const startedAt = Date.now();
  const apiKey = cleanEnv("OPENAI_API_KEY");

  const requestedModel =
    String(input.model ?? "").trim() ||
    defaultSpeechModel();

  const voice =
    String(input.voice ?? "").trim() ||
    defaultSpeechVoice();

  const format = normalizeSpeechFormat(
    input.format ?? defaultSpeechFormat(),
  );

  const originalText = String(input.text ?? "").trim();

  const truncated =
    originalText.length >
    MAX_SPEECH_INPUT_CHARACTERS;

  const text = originalText.slice(
    0,
    MAX_SPEECH_INPUT_CHARACTERS,
  );

  const instructions = String(
    input.instructions ?? "",
  )
    .trim()
    .slice(0, MAX_SPEECH_INSTRUCTION_CHARACTERS);

  const rawSpeed = Number(input.speed ?? 1);

  const speed = Number.isFinite(rawSpeed)
    ? Math.min(4, Math.max(0.25, rawSpeed))
    : 1;

  const attemptedModels: string[] = [];

  const baseResult = (
    values: Partial<SpeechAudioResult>,
  ): SpeechAudioResult => ({
    ok: false,
    provider: "OpenAI",
    model: requestedModel,
    requestedModel,
    voice,
    format,
    status: "failed",
    audio: new Uint8Array(),
    contentType: CONTENT_TYPES[format],
    latencyMs: Date.now() - startedAt,
    attemptedModels: [...attemptedModels],
    fallbackUsed: false,
    instructionsApplied: false,
    truncated,
    ...values,
  });

  if (!apiKey) {
    return baseResult({
      status: "missing",
      attemptedModels: [requestedModel],
      error: "OPENAI_API_KEY is missing.",
    });
  }

  if (!text) {
    return baseResult({
      attemptedModels: [requestedModel],
      error: "Speech text is required.",
    });
  }

  const models = uniqueStrings([
    requestedModel,
    ...configuredSpeechFallbackModels(),
  ]);

  let lastFailure:
    | SpeechAudioResult
    | null = null;

  let allAttemptsTimedOut = true;

  for (const model of models) {
    attemptedModels.push(model);

    const result = await generateSpeechWithModel({
      apiKey,
      model,
      requestedModel,
      voice,
      text,
      instructions,
      format,
      speed,
      timeoutMs: requestTimeoutMs(),
      attemptedModels,
      truncated,
    });

    if (
      result.ok &&
      result.audio.byteLength > 0
    ) {
      return {
        ...result,
        latencyMs: Date.now() - startedAt,
        attemptedModels: [...attemptedModels],

        fallbackUsed:
          model !== requestedModel,
      };
    }

    if (result.status !== "timeout") {
      allAttemptsTimedOut = false;
    }

    lastFailure = result;
  }

  return baseResult({
    model:
      lastFailure?.model ||
      requestedModel,

    status:
      allAttemptsTimedOut
        ? "timeout"
        : "failed",

    raw:
      lastFailure?.raw,

    error:
      lastFailure?.error ||
      "No speech model returned usable audio.",

    latencyMs:
      Date.now() - startedAt,

    attemptedModels: [...attemptedModels],

    fallbackUsed:
      attemptedModels.length > 1,

    instructionsApplied:
      lastFailure?.instructionsApplied ??
      false,
  });
}