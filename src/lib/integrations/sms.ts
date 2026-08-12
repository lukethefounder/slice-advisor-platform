import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { boolEnv, getOptionalEnv } from "@/lib/env";
import {
  IntegrationError,
  getIntegrationCircuitSnapshot,
  publicIntegrationFailure,
  requestProviderJson,
} from "@/lib/integrations/core";

export type SendSmsInput = {
  to: string;
  body: string;
  idempotencyKey?: string;
};

export type SmsSendResult = {
  ok: boolean;
  provider: string;
  status: "sent" | "simulated" | "failed" | "disabled";
  id?: string;
  error?: string;
  errorCode?: string;
  retryable?: boolean;
  requestId?: string;
  latencyMs?: number;
};

type TwilioResponse = {
  sid?: unknown;
};

type SmsIdempotencyRecord = {
  expiresAt: number;
  result: SmsSendResult;
};

declare global {
  // eslint-disable-next-line no-var
  var __sliceSmsIdempotency: Map<string, SmsIdempotencyRecord> | undefined;
}

const smsIdempotency =
  globalThis.__sliceSmsIdempotency ?? new Map<string, SmsIdempotencyRecord>();

globalThis.__sliceSmsIdempotency = smsIdempotency;

function normalizeIdempotencyKey(value: string | undefined) {
  const clean = String(value ?? "")
    .trim()
    .replace(/[^A-Za-z0-9._:-]/g, "-")
    .slice(0, 500);

  return clean
    ? createHash("sha256").update(clean).digest("hex").slice(0, 48)
    : "";
}

function getIdempotentResult(key: string) {
  if (!key) return null;

  const record = smsIdempotency.get(key);

  if (!record) return null;
  if (record.expiresAt <= Date.now()) {
    smsIdempotency.delete(key);
    return null;
  }

  return record.result;
}

function storeIdempotentResult(key: string, result: SmsSendResult) {
  if (!key || !result.ok) return;

  smsIdempotency.set(key, {
    expiresAt: Date.now() + 10 * 60_000,
    result,
  });

  if (smsIdempotency.size > 500) {
    for (const [candidate, record] of smsIdempotency) {
      if (record.expiresAt <= Date.now()) smsIdempotency.delete(candidate);
    }

    while (smsIdempotency.size > 500) {
      const oldest = smsIdempotency.keys().next().value as string | undefined;
      if (!oldest) break;
      smsIdempotency.delete(oldest);
    }
  }
}

function normalizePhone(value: string) {
  const clean = String(value ?? "")
    .trim()
    .replace(/^00/, "+")
    .replace(/[\s().-]/g, "");

  return /^\+[1-9]\d{7,14}$/.test(clean) ? clean : "";
}

function normalizeBody(value: string) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .trim()
    .slice(0, 1_600);
}

export async function sendSms(input: SendSmsInput): Promise<SmsSendResult> {
  const liveEnabled = boolEnv("ENABLE_LIVE_SMS");
  const accountSid = getOptionalEnv("TWILIO_ACCOUNT_SID");
  const authToken = getOptionalEnv("TWILIO_AUTH_TOKEN");
  const fromNumber = getOptionalEnv("TWILIO_PHONE_NUMBER");
  const messagingServiceSid = getOptionalEnv("TWILIO_MESSAGING_SERVICE_SID");
  const to = normalizePhone(input.to);
  const body = normalizeBody(input.body);
  const idempotencyKey = normalizeIdempotencyKey(input.idempotencyKey);
  const cachedResult = getIdempotentResult(idempotencyKey);

  if (cachedResult) return cachedResult;

  if (!to) {
    return {
      ok: false,
      provider: "Twilio",
      status: "failed",
      error: "Enter the destination phone number in international E.164 format.",
      errorCode: "INVALID_PHONE_NUMBER",
      retryable: false,
    };
  }

  if (!body) {
    return {
      ok: false,
      provider: "Twilio",
      status: "failed",
      error: "SMS message body is required.",
      errorCode: "MISSING_BODY",
      retryable: false,
    };
  }

  if (!liveEnabled) {
    const result: SmsSendResult = {
      ok: true,
      provider: "Twilio",
      status: "simulated",
      id: `sim_sms_${randomUUID()}`,
    };

    storeIdempotentResult(idempotencyKey, result);
    return result;
  }

  if (!accountSid || !authToken || (!fromNumber && !messagingServiceSid)) {
    return {
      ok: false,
      provider: "Twilio",
      status: "failed",
      error: "Live SMS is enabled, but the Twilio server configuration is incomplete.",
      errorCode: "INTEGRATION_NOT_CONFIGURED",
      retryable: false,
    };
  }

  const params = new URLSearchParams();
  params.set("To", to);
  params.set("Body", body);

  if (messagingServiceSid) {
    params.set("MessagingServiceSid", messagingServiceSid);
  } else if (fromNumber) {
    params.set("From", fromNumber);
  }

  try {
    const result = await requestProviderJson<TwilioResponse>({
      provider: "Twilio",
      operation: "send SMS",
      circuitKey: "twilio:send-sms",
      url: `https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(
        accountSid,
      )}/Messages.json`,
      init: {
        method: "POST",
        headers: {
          Authorization: `Basic ${Buffer.from(`${accountSid}:${authToken}`).toString(
            "base64",
          )}`,
          "Content-Type": "application/x-www-form-urlencoded",
        },
        body: params.toString(),
      },
      // Twilio message creation is a side effect. Do not retry automatically,
      // because an ambiguous timeout could otherwise create duplicate texts.
      idempotent: false,
      idempotencyKey: idempotencyKey || undefined,
      maxAttempts: 1,
      timeoutMs: 20_000,
      maxResponseBytes: 512 * 1024,
      validate(payload) {
        if (!payload || typeof payload !== "object") {
          throw new IntegrationError({
            provider: "Twilio",
            operation: "send SMS",
            code: "PROVIDER_INVALID_RESPONSE",
            message: "Twilio returned an invalid response.",
            status: 502,
            retryable: false,
          });
        }

        const sid = (payload as TwilioResponse).sid;

        if (typeof sid !== "string" || !sid.trim()) {
          throw new IntegrationError({
            provider: "Twilio",
            operation: "send SMS",
            code: "PROVIDER_INVALID_RESPONSE",
            message: "Twilio did not return a message identifier.",
            status: 502,
            retryable: false,
          });
        }

        return { sid };
      },
    });

    const sendResult: SmsSendResult = {
      ok: true,
      provider: "Twilio",
      status: "sent",
      id: String(result.data.sid),
      requestId: result.meta.requestId,
      latencyMs: result.meta.durationMs,
    };

    storeIdempotentResult(idempotencyKey, sendResult);
    return sendResult;
  } catch (error) {
    const failure = publicIntegrationFailure(
      error,
      "The SMS provider could not send this message.",
    );

    return {
      ok: false,
      provider: "Twilio",
      status: "failed",
      error: failure.message,
      errorCode: failure.code,
      retryable: failure.retryable,
      requestId: failure.requestId,
    };
  }
}

export function getSmsIntegrationStatus() {
  const liveEnabled = boolEnv("ENABLE_LIVE_SMS");
  const hasCredentials = Boolean(
    getOptionalEnv("TWILIO_ACCOUNT_SID") && getOptionalEnv("TWILIO_AUTH_TOKEN"),
  );
  const hasSender = Boolean(
    getOptionalEnv("TWILIO_PHONE_NUMBER") ||
      getOptionalEnv("TWILIO_MESSAGING_SERVICE_SID"),
  );

  return {
    provider: "Twilio",
    enabled: liveEnabled,
    configured: hasCredentials && hasSender,
    mode: liveEnabled ? "live" : "simulated",
    ready: liveEnabled ? hasCredentials && hasSender : true,
    automaticRetries: false,
    processLocalIdempotencyWindowMinutes: 10,
    circuits: getIntegrationCircuitSnapshot("twilio:"),
  };
}