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
};

function normalizeRecipients(to: string | string[]) {
  return Array.isArray(to) ? to : [to];
}

function textToHtml(text: string) {
  return `<p>${text.replace(/\n/g, "<br />")}</p>`;
}

export async function sendEmail(input: SendEmailInput): Promise<IntegrationSendResult> {
  const liveEnabled = boolEnv("ENABLE_LIVE_EMAIL");
  const apiKey = getOptionalEnv("RESEND_API_KEY");
  const from = input.from || getOptionalEnv("RESEND_FROM");
  const replyTo = input.replyTo || getOptionalEnv("RESEND_REPLY_TO");

  if (!liveEnabled) {
    return {
      ok: true,
      provider: "Resend",
      status: "simulated",
      id: `sim_email_${Date.now()}`,
    };
  }

  if (!apiKey || !from) {
    return {
      ok: false,
      provider: "Resend",
      status: "failed",
      error: "RESEND_API_KEY and RESEND_FROM are required for live email.",
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
        to: normalizeRecipients(input.to),
        subject: input.subject,
        html: input.html || textToHtml(input.text || ""),
        text: input.text,
        reply_to: replyTo || undefined,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) {
      return {
        ok: false,
        provider: "Resend",
        status: "failed",
        error: payload?.message || payload?.error || `Resend failed with ${response.status}`,
      };
    }

    return {
      ok: true,
      provider: "Resend",
      status: "sent",
      id: payload?.id,
    };
  } catch (error) {
    return {
      ok: false,
      provider: "Resend",
      status: "failed",
      error: error instanceof Error ? error.message : "Email send failed.",
    };
  }
}