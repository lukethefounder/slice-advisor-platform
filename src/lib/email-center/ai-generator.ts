import "server-only";

import { createHash } from "node:crypto";

import { getOptionalEnv } from "@/lib/env";
import { getOpenAiRuntimeStatus } from "@/lib/integrations/ai";

export type CustomAiEmailOption = {
  subject: string;
  body: string;
  strategy: string;
  complianceNotes: string[];
  promptCoverage: string[];
  factsUsed: string[];
};

export type CustomAiEmailGenerationAttempt = {
  model: string;
  format: "json_schema" | "json_object" | "text";
  statusCode: number | null;
  requestId: string | null;
  error: string | null;
};

export type CustomAiEmailGenerationResult = {
  ok: boolean;
  provider: string;
  model: string | null;
  requestId: string | null;
  latencyMs: number;
  options: CustomAiEmailOption[];
  error: string | null;
  attemptedModels: string[];
  attempts: CustomAiEmailGenerationAttempt[];
};

export type CustomAiEmailGenerationInput = {
  prompt: string;
  instructions: string;
  optionCount: number;
  speedMode: "Quick" | "Researched";
  safetyIdentifier: string;
  signal?: AbortSignal;
  repairFeedback?: string[];
};

type OpenAiPayload = Record<string, unknown> & {
  id?: string;
  status?: string;
  output_text?: string;
  output?: unknown[];
  incomplete_details?: {
    reason?: string;
  } | null;
  error?: {
    message?: string;
    type?: string;
    code?: string;
  };
  message?: string;
};

type OutputFormat = "json_schema" | "json_object" | "text";

function cleanSecret(value: string) {
  return value
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^['"]|['"]$/g, "");
}

function apiKey() {
  return cleanSecret(
    getOptionalEnv("OPENAI_API_KEY") ||
      getOptionalEnv("OPENAI_KEY") ||
      getOptionalEnv("OPENAI_SECRET_KEY"),
  );
}

function keyLooksUsable(value: string) {
  if (!value || value.length < 20) return false;

  const lower = value.toLowerCase();
  return ![
    "your_api_key",
    "your-openai-key",
    "replace_me",
    "placeholder",
    "undefined",
    "null",
  ].some((candidate) => lower.includes(candidate));
}

function cleanModel(value: string | null | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/^['"]|['"]$/g, "")
    .replace(/[^a-zA-Z0-9._:-]/g, "")
    .slice(0, 120);
}

function unique(values: Array<string | null | undefined>) {
  return Array.from(
    new Set(values.map(cleanModel).filter(Boolean)),
  );
}

function modelCandidates(mode: "Quick" | "Researched") {
  const runtime = getOpenAiRuntimeStatus();

  if (mode === "Quick") {
    return unique([
      getOptionalEnv("OPENAI_EMAIL_FAST_MODEL"),
      runtime.fastModel,
      "gpt-5-mini",
      "gpt-4.1-mini",
      "gpt-4o-mini",
      runtime.model,
    ]).slice(0, 5);
  }

  return unique([
    getOptionalEnv("OPENAI_EMAIL_QUALITY_MODEL"),
    runtime.qualityModel,
    "gpt-5.1",
    "gpt-5",
    "gpt-4.1",
    "gpt-5-mini",
    runtime.model,
  ]).slice(0, 5);
}

function hashedSafetyIdentifier(value: string) {
  return `slice_email_${createHash("sha256")
    .update(value.trim().toLowerCase() || "slice-email-user")
    .digest("hex")
    .slice(0, 32)}`;
}

function cleanText(value: unknown, maximum: number) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\r\n/g, "\n")
    .replace(/[ \t]+/g, " ")
    .replace(/\n{4,}/g, "\n\n")
    .trim()
    .slice(0, maximum);
}

function safeProviderError(value: unknown, fallback: string) {
  return cleanText(value, 1_200)
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+[A-Za-z0-9._~+\/-]+/gi, "Bearer [REDACTED]")
    .replace(/(api[_-]?key|token|secret|password)[=:]\s*[^\s,;]+/gi, "$1=[REDACTED]") || fallback;
}

function cleanList(value: unknown, maximum = 16) {
  if (!Array.isArray(value)) return [];

  return Array.from(
    new Set(
      value
        .map((item) => cleanText(item, 700))
        .filter(Boolean),
    ),
  ).slice(0, maximum);
}

/**
 * Raw Responses API payloads may contain reasoning items alongside the final
 * assistant message. Only collect actual output_text content. Collecting every
 * arbitrary `text` field can prepend reasoning or annotation text to the JSON
 * and make a valid structured result impossible to parse.
 */
function extractOutputText(payload: OpenAiPayload) {
  if (typeof payload.output_text === "string" && payload.output_text.trim()) {
    return payload.output_text.trim();
  }

  const pieces: string[] = [];

  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    if (!item || typeof item !== "object") continue;

    const outputItem = item as Record<string, unknown>;
    const content = Array.isArray(outputItem.content) ? outputItem.content : [];

    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const contentPart = part as Record<string, unknown>;

      if (
        contentPart.type === "output_text" &&
        typeof contentPart.text === "string" &&
        contentPart.text.trim()
      ) {
        pieces.push(contentPart.text.trim());
      }
    }
  }

  return pieces.join("\n").trim();
}

function extractRefusal(payload: OpenAiPayload) {
  for (const item of Array.isArray(payload.output) ? payload.output : []) {
    if (!item || typeof item !== "object") continue;
    const outputItem = item as Record<string, unknown>;
    const content = Array.isArray(outputItem.content) ? outputItem.content : [];

    for (const part of content) {
      if (!part || typeof part !== "object") continue;
      const contentPart = part as Record<string, unknown>;
      if (
        contentPart.type === "refusal" &&
        typeof contentPart.refusal === "string"
      ) {
        return cleanText(contentPart.refusal, 1_000);
      }
    }
  }

  return null;
}

function responseSchema() {
  return {
    type: "object",
    additionalProperties: false,
    properties: {
      options: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            subject: { type: "string" },
            body: { type: "string" },
            strategy: { type: "string" },
            complianceNotes: {
              type: "array",
              items: { type: "string" },
            },
            promptCoverage: {
              type: "array",
              items: { type: "string" },
            },
            factsUsed: {
              type: "array",
              items: { type: "string" },
            },
          },
          required: [
            "subject",
            "body",
            "strategy",
            "complianceNotes",
            "promptCoverage",
            "factsUsed",
          ],
        },
      },
    },
    required: ["options"],
  };
}

function parseJsonLoose(text: string) {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    const first = text.indexOf("{");
    const last = text.lastIndexOf("}");

    if (first >= 0 && last > first) {
      try {
        return JSON.parse(text.slice(first, last + 1)) as unknown;
      } catch {
        return null;
      }
    }

    return null;
  }
}

function parseOptions(text: string, optionCount: number) {
  const parsed = parseJsonLoose(text);

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return [];
  }

  const options = (parsed as { options?: unknown }).options;
  if (!Array.isArray(options)) return [];

  return options
    .map((option): CustomAiEmailOption | null => {
      if (!option || typeof option !== "object" || Array.isArray(option)) {
        return null;
      }

      const record = option as Record<string, unknown>;
      const subject = cleanText(record.subject, 180);
      const body = cleanText(record.body, 20_000);

      if (subject.length < 3 || body.length < 120) return null;

      return {
        subject,
        body,
        strategy: cleanText(record.strategy, 1_500),
        complianceNotes: cleanList(record.complianceNotes),
        promptCoverage: cleanList(record.promptCoverage),
        factsUsed: cleanList(record.factsUsed),
      };
    })
    .filter((option): option is CustomAiEmailOption => Boolean(option))
    .slice(0, Math.max(1, Math.min(3, optionCount)));
}

function linesAfterHeading(text: string, heading: string) {
  const pattern = new RegExp(
    `(?:^|\\n)${heading}\\s*:\\s*([\\s\\S]*?)(?=\\n[A-Z][A-Z _-]{2,}\\s*:|$)`,
    "i",
  );
  return pattern.exec(text)?.[1]?.trim() ?? "";
}

function parseBulletList(value: string) {
  return value
    .split(/\n+/)
    .map((line) => line.replace(/^[-*•\d.)\s]+/, "").trim())
    .filter(Boolean)
    .slice(0, 16);
}

function parsePlainTextOption(text: string): CustomAiEmailOption[] {
  const subject = cleanText(linesAfterHeading(text, "SUBJECT"), 180);
  const body = cleanText(linesAfterHeading(text, "BODY"), 20_000);

  if (subject.length < 3 || body.length < 120) return [];

  return [
    {
      subject,
      body,
      strategy: cleanText(linesAfterHeading(text, "STRATEGY"), 1_500),
      complianceNotes: parseBulletList(linesAfterHeading(text, "COMPLIANCE")),
      promptCoverage: parseBulletList(linesAfterHeading(text, "COVERAGE")),
      factsUsed: parseBulletList(linesAfterHeading(text, "FACTS")),
    },
  ];
}

function providerError(payload: OpenAiPayload, status: number) {
  return safeProviderError(
    payload.error?.message ||
      payload.message ||
      `OpenAI email generation failed with HTTP ${status}.`,
    `OpenAI email generation failed with HTTP ${status}.`,
  );
}

function reasoningForModel(model: string, mode: "Quick" | "Researched") {
  if (/^gpt-5\.1(?:-|$)/i.test(model)) {
    return { effort: mode === "Quick" ? "none" : "low" };
  }

  if (/^gpt-5(?:-|$)/i.test(model)) {
    return { effort: mode === "Quick" ? "minimal" : "low" };
  }

  return undefined;
}

function textFormat(format: OutputFormat) {
  if (format === "json_schema") {
    return {
      type: "json_schema",
      name: "slice_custom_client_email",
      description: "One or more complete, prompt-specific advisor-client emails.",
      strict: true,
      schema: responseSchema(),
    };
  }

  if (format === "json_object") {
    return { type: "json_object" };
  }

  return { type: "text" };
}

function formatInstructions(format: OutputFormat) {
  if (format === "json_schema") {
    return "Return the required structured output only.";
  }

  if (format === "json_object") {
    return [
      "Return valid JSON only.",
      "Use exactly this shape:",
      '{"options":[{"subject":"...","body":"...","strategy":"...","complianceNotes":[],"promptCoverage":[],"factsUsed":[]}]}',
    ].join("\n");
  }

  return [
    "Return one finished email using exactly these headings:",
    "SUBJECT:",
    "BODY:",
    "STRATEGY:",
    "COMPLIANCE:",
    "COVERAGE:",
    "FACTS:",
    "Do not include markdown fences.",
  ].join("\n");
}

function requestHeaders(token: string) {
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json",
  };

  const organization = cleanSecret(
    getOptionalEnv("OPENAI_ORGANIZATION") || getOptionalEnv("OPENAI_ORG_ID"),
  );
  const project = cleanSecret(
    getOptionalEnv("OPENAI_PROJECT") || getOptionalEnv("OPENAI_PROJECT_ID"),
  );

  if (organization) headers["OpenAI-Organization"] = organization;
  if (project) headers["OpenAI-Project"] = project;

  return headers;
}

async function fetchWithDeadline(input: {
  url: string;
  init: RequestInit;
  timeoutMs: number;
  signal?: AbortSignal;
}) {
  const controller = new AbortController();
  const abortFromCaller = () => controller.abort();
  input.signal?.addEventListener("abort", abortFromCaller, { once: true });
  const timeout = setTimeout(() => controller.abort(), input.timeoutMs);

  try {
    return await fetch(input.url, {
      ...input.init,
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timeout);
    input.signal?.removeEventListener("abort", abortFromCaller);
  }
}

function shouldStopAll(status: number, error: string) {
  const lower = error.toLowerCase();
  return (
    status === 401 ||
    status === 403 ||
    (status === 429 &&
      (lower.includes("quota") ||
        lower.includes("billing") ||
        lower.includes("insufficient_quota")))
  );
}

function shouldMoveToNextModel(status: number, error: string) {
  const lower = error.toLowerCase();
  return (
    status === 404 ||
    lower.includes("model_not_found") ||
    lower.includes("does not exist") ||
    lower.includes("do not have access") ||
    status === 429 ||
    status >= 500
  );
}

export async function generateCustomAiEmailOptions(
  input: CustomAiEmailGenerationInput,
): Promise<CustomAiEmailGenerationResult> {
  const startedAt = Date.now();
  const token = apiKey();
  const models = modelCandidates(input.speedMode);
  const attemptedModels: string[] = [];
  const attempts: CustomAiEmailGenerationAttempt[] = [];

  if (!keyLooksUsable(token)) {
    return {
      ok: false,
      provider: "OpenAI",
      model: models[0] ?? null,
      requestId: null,
      latencyMs: Date.now() - startedAt,
      options: [],
      error:
        "OPENAI_API_KEY is missing or invalid in the server environment. Add a funded OpenAI API key, restart Slice, and retry Custom AI.",
      attemptedModels,
      attempts,
    };
  }

  const totalDeadlineMs = input.speedMode === "Quick" ? 65_000 : 135_000;
  const maximumTokens = input.speedMode === "Quick" ? 2_600 : 5_400;
  let lastError = "No configured OpenAI model returned a complete custom email.";
  let lastModel: string | null = models[0] ?? null;
  let lastRequestId: string | null = null;
  let stopAll = false;

  const repairInstructions = input.repairFeedback?.length
    ? `\n\nThe previous candidate failed these checks:\n- ${input.repairFeedback.join(
        "\n- ",
      )}\nRewrite it completely and correct every listed issue.`
    : "";

  for (const model of models) {
    if (stopAll) break;

    const remainingBeforeModel = totalDeadlineMs - (Date.now() - startedAt);
    if (remainingBeforeModel < 5_000) break;

    attemptedModels.push(model);
    lastModel = model;

    for (const format of [
      "json_schema",
      "json_object",
      "text",
    ] as const) {
      const remainingMs = totalDeadlineMs - (Date.now() - startedAt);
      if (remainingMs < 4_000) break;

      const timeoutMs = Math.min(
        remainingMs,
        input.speedMode === "Quick"
          ? format === "json_schema"
            ? 20_000
            : 13_000
          : format === "json_schema"
            ? 38_000
            : 24_000,
      );

      try {
        const reasoning = reasoningForModel(model, input.speedMode);
        const response = await fetchWithDeadline({
          url: "https://api.openai.com/v1/responses",
          timeoutMs,
          signal: input.signal,
          init: {
            method: "POST",
            headers: requestHeaders(token),
            body: JSON.stringify({
              model,
              instructions: [
                input.instructions,
                repairInstructions,
                formatInstructions(format),
              ]
                .filter(Boolean)
                .join("\n\n"),
              input: input.prompt,
              text: {
                format: textFormat(format),
              },
              ...(reasoning ? { reasoning } : {}),
              max_output_tokens: maximumTokens,
              safety_identifier: hashedSafetyIdentifier(input.safetyIdentifier),
              metadata: {
                surface: "slice_email_center",
                task: input.repairFeedback?.length
                  ? "repair_custom_email"
                  : "generate_custom_email",
                speed_mode: input.speedMode,
                output_format: format,
              },
              store: false,
            }),
          },
        });

        const payload = (await response.json().catch(() => ({}))) as OpenAiPayload;
        const requestId =
          response.headers.get("x-request-id") ||
          (typeof payload.id === "string" ? payload.id : null);
        lastRequestId = requestId;

        if (!response.ok) {
          const error = providerError(payload, response.status);
          lastError = error;
          attempts.push({
            model,
            format,
            statusCode: response.status,
            requestId,
            error,
          });

          if (shouldStopAll(response.status, error)) {
            stopAll = true;
            break;
          }

          if (shouldMoveToNextModel(response.status, error)) {
            break;
          }

          continue;
        }

        const refusal = extractRefusal(payload);
        if (refusal) {
          lastError = `OpenAI declined this email request: ${refusal}`;
          attempts.push({
            model,
            format,
            statusCode: response.status,
            requestId,
            error: lastError,
          });
          break;
        }

        if (payload.status === "incomplete") {
          lastError = `OpenAI returned an incomplete response${
            payload.incomplete_details?.reason
              ? `: ${payload.incomplete_details.reason}`
              : "."
          }`;
          attempts.push({
            model,
            format,
            statusCode: response.status,
            requestId,
            error: lastError,
          });
          continue;
        }

        const outputText = extractOutputText(payload);
        const options =
          format === "text"
            ? parsePlainTextOption(outputText)
            : parseOptions(outputText, input.optionCount);

        if (!options.length) {
          lastError =
            format === "json_schema"
              ? "OpenAI completed the request, but no parseable structured email was present in the final assistant message."
              : format === "json_object"
                ? "OpenAI returned JSON that did not contain a complete subject and email body."
                : "OpenAI returned text without the required subject and complete email body.";
          attempts.push({
            model,
            format,
            statusCode: response.status,
            requestId,
            error: lastError,
          });
          continue;
        }

        attempts.push({
          model,
          format,
          statusCode: response.status,
          requestId,
          error: null,
        });

        return {
          ok: true,
          provider: `OpenAI/${model}`,
          model,
          requestId,
          latencyMs: Date.now() - startedAt,
          options: options.slice(0, Math.max(1, Math.min(3, input.optionCount))),
          error: null,
          attemptedModels,
          attempts,
        };
      } catch (error) {
        if (input.signal?.aborted) throw error;

        const timedOut =
          error instanceof Error &&
          (error.name === "AbortError" ||
            error.message.toLowerCase().includes("abort"));

        lastError = timedOut
          ? `OpenAI model ${model} exceeded the ${Math.round(timeoutMs / 1_000)}-second request deadline.`
          : safeProviderError(
              error instanceof Error ? error.message : error,
              "OpenAI email generation failed.",
            );

        attempts.push({
          model,
          format,
          statusCode: null,
          requestId: null,
          error: lastError,
        });

        // A timeout or network failure is model/request-level. Move to the
        // next model instead of repeating three formats through the same path.
        break;
      }
    }
  }

  const attemptSummary = attempts
    .slice(-4)
    .map(
      (attempt) =>
        `${attempt.model}/${attempt.format}: ${attempt.error ?? "completed"}`,
    )
    .join(" | ");

  return {
    ok: false,
    provider: lastModel ? `OpenAI/${lastModel}` : "OpenAI",
    model: lastModel,
    requestId: lastRequestId,
    latencyMs: Date.now() - startedAt,
    options: [],
    error: safeProviderError(
      `${lastError}${attemptSummary ? ` Recent attempts: ${attemptSummary}` : ""}`,
      "OpenAI did not return a complete custom email.",
    ),
    attemptedModels,
    attempts,
  };
}