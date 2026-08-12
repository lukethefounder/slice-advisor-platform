import "server-only";

import { randomUUID } from "node:crypto";

import { boolEnv, getOptionalEnv } from "@/lib/env";
import {
  IntegrationError,
  getIntegrationCircuitSnapshot,
  publicIntegrationFailure,
  requestProviderJson,
} from "@/lib/integrations/core";

export type SendEmailInput = {
  to: string | string[];
  subject: string;
  text?: string;
  html?: string;
  from?: string;
  replyTo?: string;
  idempotencyKey?: string;
};

export type IntegrationSendResult = {
  ok: boolean;
  provider: string;
  status: "sent" | "simulated" | "failed" | "disabled";
  id?: string;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  requestId?: string;
  latencyMs?: number;
  diagnostics?: {
    liveEnabled: boolean;
    hasApiKey: boolean;
    hasFrom: boolean;
    recipientCount: number;
    invalidRecipientCount: number;
    idempotencyProtected: boolean;
  };
};

type ResendResponse = {
  id?: unknown;
};

function normalizeRecipients(to: string | string[]) {
  const recipients = Array.isArray(to) ? to : [to];

  return Array.from(
    new Set(
      recipients
        .flatMap((item) => String(item).split(/[;,]/))
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean),
    ),
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 320;
}

function isValidAddressHeader(value: string) {
  const clean = value.trim();
  const bracketMatch = clean.match(/<([^<>]+)>$/);
  const email = bracketMatch?.[1]?.trim() || clean;

  return isValidEmail(email);
}

function escapeHtml(value: string) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function textToHtml(text: string) {
  const paragraphs = text
    .split(/\n{2,}/)
    .map((paragraph) => paragraph.trim())
    .filter(Boolean)
    .map((paragraph) => `<p>${escapeHtml(paragraph).replace(/\n/g, "<br />")}</p>`)
    .join("");

  return `<div style="font-family:Inter,Arial,sans-serif;line-height:1.65;color:#0f172a;">${
    paragraphs || "<p></p>"
  }</div>`;
}

function cleanSubject(subject: string) {
  return String(subject ?? "")
    .replace(/\r|\n/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 180);
}

function cleanBody(value: string | undefined) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, 120_000);
}

function cleanHeaderValue(value: string | undefined) {
  return String(value ?? "")
    .replace(/[\r\n]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 500);
}

function cleanIdempotencyKey(value: string | undefined) {
  return String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._:-]/g, "-")
    .slice(0, 256);
}

function configuredFrom() {
  return getOptionalEnv("RESEND_FROM") || getOptionalEnv("EMAIL_FROM") || "";
}

function configuredReplyTo() {
  return getOptionalEnv("RESEND_REPLY_TO") || getOptionalEnv("EMAIL_REPLY_TO") || "";
}

function failed(
  diagnostics: NonNullable<IntegrationSendResult["diagnostics"]>,
  message: string,
  code: string,
  retryable = false,
): IntegrationSendResult {
  return {
    ok: false,
    provider: "Resend",
    status: "failed",
    error: message,
    errorCode: code,
    retryable,
    diagnostics,
  };
}

export async function sendEmail(input: SendEmailInput): Promise<IntegrationSendResult> {
  const liveEnabled = boolEnv("ENABLE_LIVE_EMAIL");
  const apiKey = getOptionalEnv("RESEND_API_KEY");
  const from = cleanHeaderValue(input.from || configuredFrom());
  const replyTo = cleanHeaderValue(input.replyTo || configuredReplyTo());
  const recipients = normalizeRecipients(input.to);
  const invalidRecipients = recipients.filter((recipient) => !isValidEmail(recipient));
  const subject = cleanSubject(input.subject);
  const text = cleanBody(input.text);
  const providedHtml = cleanBody(input.html);
  const html = providedHtml || (text ? textToHtml(text) : "");
  const idempotencyKey = cleanIdempotencyKey(input.idempotencyKey);

  const diagnostics = {
    liveEnabled,
    hasApiKey: Boolean(apiKey),
    hasFrom: Boolean(from),
    recipientCount: recipients.length,
    invalidRecipientCount: invalidRecipients.length,
    idempotencyProtected: Boolean(idempotencyKey),
  };

  if (!recipients.length) {
    return failed(diagnostics, "At least one email recipient is required.", "MISSING_RECIPIENT");
  }

  if (recipients.length > 100) {
    return failed(
      diagnostics,
      "A single email request cannot contain more than 100 recipients.",
      "RECIPIENT_LIMIT_EXCEEDED",
    );
  }

  if (invalidRecipients.length) {
    return failed(
      diagnostics,
      "One or more recipient email addresses are invalid.",
      "INVALID_RECIPIENT",
    );
  }

  if (!subject) {
    return failed(diagnostics, "Email subject is required.", "MISSING_SUBJECT");
  }

  if (!text && !html) {
    return failed(diagnostics, "Email body is required.", "MISSING_BODY");
  }

  if (!liveEnabled) {
    return {
      ok: true,
      provider: "Resend",
      status: "simulated",
      id: `sim_email_${randomUUID()}`,
      diagnostics,
    };
  }

  if (from && !isValidAddressHeader(from)) {
    return failed(
      diagnostics,
      "The configured sender address is invalid.",
      "INVALID_SENDER",
    );
  }

  if (replyTo && !isValidAddressHeader(replyTo)) {
    return failed(
      diagnostics,
      "The configured reply-to address is invalid.",
      "INVALID_REPLY_TO",
    );
  }

  if (!apiKey || !from) {
    return failed(
      diagnostics,
      "Live email is enabled, but the Resend API key or sender address is missing.",
      "INTEGRATION_NOT_CONFIGURED",
    );
  }

  try {
    const result = await requestProviderJson<ResendResponse>({
      provider: "Resend",
      operation: "send email",
      circuitKey: "resend:send-email",
      url: "https://api.resend.com/emails",
      init: {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          ...(idempotencyKey ? { "Idempotency-Key": idempotencyKey } : {}),
        },
        body: JSON.stringify({
          from,
          to: recipients,
          subject,
          html,
          text: text || undefined,
          reply_to: replyTo || undefined,
        }),
      },
      idempotent: Boolean(idempotencyKey),
      idempotencyKey: idempotencyKey || undefined,
      maxAttempts: idempotencyKey ? 3 : 1,
      timeoutMs: 20_000,
      maxResponseBytes: 512 * 1024,
      validate(payload) {
        if (!payload || typeof payload !== "object") {
          throw new IntegrationError({
            provider: "Resend",
            operation: "send email",
            code: "PROVIDER_INVALID_RESPONSE",
            message: "Resend returned an invalid response.",
            status: 502,
            retryable: false,
          });
        }

        const id = (payload as ResendResponse).id;

        if (typeof id !== "string" || !id.trim()) {
          throw new IntegrationError({
            provider: "Resend",
            operation: "send email",
            code: "PROVIDER_INVALID_RESPONSE",
            message: "Resend did not return a delivery identifier.",
            status: 502,
            retryable: false,
          });
        }

        return { id };
      },
    });

    return {
      ok: true,
      provider: "Resend",
      status: "sent",
      id: String(result.data.id),
      requestId: result.meta.requestId,
      latencyMs: result.meta.durationMs,
      diagnostics,
    };
  } catch (error) {
    const failure = publicIntegrationFailure(
      error,
      "The email provider could not send this message.",
    );

    return {
      ok: false,
      provider: "Resend",
      status: "failed",
      error: failure.message,
      errorCode: failure.code,
      retryable: failure.retryable,
      requestId: failure.requestId,
      diagnostics,
    };
  }
}

export function getEmailIntegrationStatus() {
  const liveEnabled = boolEnv("ENABLE_LIVE_EMAIL");
  const hasApiKey = Boolean(getOptionalEnv("RESEND_API_KEY"));
  const hasFrom = Boolean(configuredFrom());

  return {
    provider: "Resend",
    enabled: liveEnabled,
    configured: hasApiKey && hasFrom,
    mode: liveEnabled ? "live" : "simulated",
    ready: liveEnabled ? hasApiKey && hasFrom : true,
    idempotencySupported: true,
    circuits: getIntegrationCircuitSnapshot("resend:"),
  };
}