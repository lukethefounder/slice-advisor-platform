import { getOptionalEnv } from "@/lib/env";

export type AudioTranscriptionResult = {
  ok: boolean;
  provider: string;
  model: string;
  text: string;
  status: "completed" | "failed" | "missing" | "recovered";
  error?: string;
  raw?: unknown;
  attemptedModels?: string[];
};

async function transcribeWithModel(input: {
  apiKey: string;
  model: string;
  file: File;
  language?: string;
  prompt?: string;
}): Promise<AudioTranscriptionResult> {
  const formData = new FormData();
  formData.set("model", input.model);
  formData.set("file", input.file, input.file.name || "slice-voice.webm");

  if (input.language) {
    formData.set("language", input.language);
  }

  if (input.prompt) {
    formData.set("prompt", input.prompt);
  }

  try {
    const response = await fetch("https://api.openai.com/v1/audio/transcriptions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${input.apiKey}`,
      },
      body: formData,
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        provider: "OpenAI",
        model: input.model,
        text: "",
        status: "failed",
        raw: payload,
        error:
          payload?.error?.message ||
          payload?.message ||
          `OpenAI transcription failed with ${response.status}`,
      };
    }

    const text = String(payload?.text ?? "").trim();

    if (!text) {
      return {
        ok: false,
        provider: "OpenAI",
        model: input.model,
        text: "",
        status: "failed",
        raw: payload,
        error: "Transcription completed but returned no text.",
      };
    }

    return {
      ok: true,
      provider: "OpenAI",
      model: input.model,
      text,
      status: "completed",
      raw: payload,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "OpenAI",
      model: input.model,
      text: "",
      status: "failed",
      error: error instanceof Error ? error.message : "Audio transcription failed.",
    };
  }
}

export async function transcribeAudio(input: {
  file: File;
  language?: string;
  prompt?: string;
}): Promise<AudioTranscriptionResult> {
  const apiKey = getOptionalEnv("OPENAI_API_KEY");
  const preferredModel = getOptionalEnv("OPENAI_TRANSCRIBE_MODEL") || "gpt-4o-transcribe";

  if (!apiKey) {
    return {
      ok: false,
      provider: "OpenAI",
      model: preferredModel,
      text: "",
      status: "missing",
      error: "OPENAI_API_KEY is missing.",
      attemptedModels: [preferredModel],
    };
  }

  const models = Array.from(
    new Set([
      preferredModel,
      "gpt-4o-mini-transcribe",
      "gpt-4o-transcribe",
      "whisper-1",
    ])
  );

  const attemptedModels: string[] = [];
  let lastFailure: AudioTranscriptionResult | null = null;

  for (const model of models) {
    attemptedModels.push(model);

    const result = await transcribeWithModel({
      apiKey,
      model,
      file: input.file,
      language: input.language,
      prompt: input.prompt,
    });

    if (result.ok && result.text) {
      return {
        ...result,
        attemptedModels,
        status: model === preferredModel ? "completed" : "recovered",
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
    error: lastFailure?.error || "No transcription model returned usable text.",
    raw: lastFailure?.raw,
    attemptedModels,
  };
}