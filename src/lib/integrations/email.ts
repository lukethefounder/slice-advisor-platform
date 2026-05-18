import { boolEnv, getOptionalEnv } from "@/lib/env";

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
  diagnostics?: {
    liveEnabled: boolean;
    hasApiKey: boolean;
    hasFrom: boolean;
    recipientCount: number;
  };
};

function normalizeRecipients(to: string | string[]) {
  const recipients = Array.isArray(to) ? to : [to];

  return Array.from(
    new Set(
      recipients
        .flatMap((item) => String(item).split(/[;,]/))
        .map((item) => item.trim())
        .filter(Boolean)
    )
  );
}

function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
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

  return `
    <div style="font-family:Inter,Arial,sans-serif;line-height:1.65;color:#0f172a;">
      ${paragraphs || "<p></p>"}
    </div>
  `;
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
    .slice(0, 120000);
}

function configuredFrom() {
  return getOptionalEnv("RESEND_FROM") || getOptionalEnv("EMAIL_FROM") || "";
}

function configuredReplyTo() {
  return getOptionalEnv("RESEND_REPLY_TO") || getOptionalEnv("EMAIL_REPLY_TO") || "";
}

export async function sendEmail(input: SendEmailInput): Promise<IntegrationSendResult> {
  const liveEnabled = boolEnv("ENABLE_LIVE_EMAIL");
  const apiKey = getOptionalEnv("RESEND_API_KEY");
  const from = input.from || configuredFrom();
  const replyTo = input.replyTo || configuredReplyTo();
  const recipients = normalizeRecipients(input.to);
  const invalidRecipients = recipients.filter((recipient) => !isValidEmail(recipient));
  const subject = cleanSubject(input.subject);
  const text = cleanBody(input.text);
  const html = cleanBody(input.html) || textToHtml(text);

  const diagnostics = {
    liveEnabled,
    hasApiKey: Boolean(apiKey),
    hasFrom: Boolean(from),
    recipientCount: recipients.length,
  };

  if (!recipients.length) {
    return {
      ok: false,
      provider: "Resend",
      status: "failed",
      error: "At least one email recipient is required.",
      diagnostics,
    };
  }

  if (invalidRecipients.length) {
    return {
      ok: false,
      provider: "Resend",
      status: "failed",
      error: `Invalid recipient email(s): ${invalidRecipients.join(", ")}`,
      diagnostics,
    };
  }

  if (!subject) {
    return {
      ok: false,
      provider: "Resend",
      status: "failed",
      error: "Email subject is required.",
      diagnostics,
    };
  }

  if (!text && !html) {
    return {
      ok: false,
      provider: "Resend",
      status: "failed",
      error: "Email body is required.",
      diagnostics,
    };
  }

  if (!liveEnabled) {
    return {
      ok: true,
      provider: "Resend",
      status: "simulated",
      id: `sim_email_${Date.now()}`,
      diagnostics,
    };
  }

  if (!apiKey || !from) {
    return {
      ok: false,
      provider: "Resend",
      status: "failed",
      error:
        "Live email is enabled, but RESEND_API_KEY and RESEND_FROM or EMAIL_FROM are required.",
      diagnostics,
    };
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        ...(input.idempotencyKey ? { "Idempotency-Key": input.idempotencyKey } : {}),
      },
      body: JSON.stringify({
        from,
        to: recipients,
        subject,
        html,
        text: text || undefined,
        reply_to: replyTo || undefined,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        provider: "Resend",
        status: "failed",
        error:
          payload?.message ||
          payload?.error?.message ||
          payload?.error ||
          `Resend failed with ${response.status}`,
        diagnostics,
      };
    }

    return {
      ok: true,
      provider: "Resend",
      status: "sent",
      id: payload?.id,
      diagnostics,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "Resend",
      status: "failed",
      error: error instanceof Error ? error.message : "Email send failed.",
      diagnostics,
    };
  }
}