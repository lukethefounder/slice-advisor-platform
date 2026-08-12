import { existsSync } from "node:fs";
import { resolve } from "node:path";

for (const file of [".env.local", ".env"]) {
  const path = resolve(process.cwd(), file);
  if (existsSync(path) && typeof process.loadEnvFile === "function") {
    try {
      process.loadEnvFile(path);
    } catch {
      // Shell variables remain authoritative. This is only a local helper.
    }
  }
}

function clean(value) {
  return String(value ?? "")
    .trim()
    .replace(/^Bearer\s+/i, "")
    .replace(/^['"]|['"]$/g, "");
}

function redact(value) {
  return String(value ?? "")
    .replace(/sk-[A-Za-z0-9_-]{8,}/g, "[REDACTED_API_KEY]")
    .replace(/Bearer\s+[^\s]+/gi, "Bearer [REDACTED]")
    .slice(0, 1500);
}

const key = clean(
  process.env.OPENAI_API_KEY ||
    process.env.OPENAI_KEY ||
    process.env.OPENAI_SECRET_KEY,
);

if (!key || key.length < 20) {
  console.error(
    JSON.stringify(
      {
        ok: false,
        stage: "configuration",
        error: "OPENAI_API_KEY is missing or invalid in this process.",
        hint: "Add OPENAI_API_KEY to .env.local or the deployment environment, restart Slice, and retry.",
      },
      null,
      2,
    ),
  );
  process.exitCode = 1;
} else {
  const model = clean(process.env.OPENAI_EMAIL_FAST_MODEL) || "gpt-5-mini";
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 30000);

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      signal: controller.signal,
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
        ...(process.env.OPENAI_ORGANIZATION
          ? { "OpenAI-Organization": clean(process.env.OPENAI_ORGANIZATION) }
          : {}),
        ...(process.env.OPENAI_PROJECT
          ? { "OpenAI-Project": clean(process.env.OPENAI_PROJECT) }
          : {}),
      },
      body: JSON.stringify({
        model,
        instructions:
          "Return a tiny JSON object proving the Slice Email Center can create structured output.",
        input: "Create a subject and a two-sentence client email about scheduling an annual review.",
        text: {
          format: {
            type: "json_schema",
            name: "slice_email_health_check",
            strict: true,
            schema: {
              type: "object",
              additionalProperties: false,
              properties: {
                subject: { type: "string" },
                body: { type: "string" },
              },
              required: ["subject", "body"],
            },
          },
        },
        reasoning: /^gpt-5\.1(?:-|$)/i.test(model)
          ? { effort: "none" }
          : /^gpt-5(?:-|$)/i.test(model)
            ? { effort: "minimal" }
            : undefined,
        max_output_tokens: 500,
        store: false,
      }),
    });

    const payload = await response.json().catch(() => ({}));
    const requestId =
      response.headers.get("x-request-id") || payload?.id || null;

    if (!response.ok) {
      throw new Error(
        `${payload?.error?.message || payload?.message || `HTTP ${response.status}`} (request ${requestId || "unknown"})`,
      );
    }

    console.log(
      JSON.stringify(
        {
          ok: true,
          model,
          status: payload?.status || "completed",
          requestId,
          message:
            "OpenAI accepted a Responses API structured-output request. Retry Custom AI in Slice.",
        },
        null,
        2,
      ),
    );
  } catch (error) {
    console.error(
      JSON.stringify(
        {
          ok: false,
          stage: "openai_request",
          model,
          error: redact(error instanceof Error ? error.message : error),
          hints: [
            "Confirm the API key belongs to a funded OpenAI API project.",
            "Confirm the selected project has access to the configured model.",
            "Remove OPENAI_EMAIL_FAST_MODEL temporarily to test gpt-5-mini.",
            "Restart the Next.js server after changing environment variables.",
          ],
        },
        null,
        2,
      ),
    );
    process.exitCode = 1;
  } finally {
    clearTimeout(timeout);
  }
}