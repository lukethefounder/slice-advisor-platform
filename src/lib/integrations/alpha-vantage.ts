import "server-only";

import {
  IntegrationError,
  getIntegrationCircuitSnapshot,
  requestProviderJson,
  type IntegrationExecution,
} from "@/lib/integrations/core";

const ALPHA_VANTAGE_ENDPOINT = "https://www.alphavantage.co/query";

export type AlphaVantagePayload = Record<string, unknown> & {
  Information?: unknown;
  Note?: unknown;
  "Error Message"?: unknown;
};

function cleanMessage(value: unknown) {
  return typeof value === "string"
    ? value.replace(/\s+/g, " ").trim().slice(0, 1_000)
    : "";
}

function alphaProviderMessage(payload: AlphaVantagePayload) {
  return (
    cleanMessage(payload["Error Message"]) ||
    cleanMessage(payload.Information) ||
    cleanMessage(payload.Note) ||
    ""
  );
}

function isRateLimitMessage(message: string) {
  return /(rate limit|call frequency|requests? per (?:minute|day)|too many requests|standard api rate)/i.test(
    message,
  );
}

function isAccessMessage(message: string) {
  return /(premium|subscription|entitlement|upgrade|not available with your current plan)/i.test(
    message,
  );
}

function validatePayload(
  value: unknown,
  functionName: string,
): AlphaVantagePayload {
  if (!value || Array.isArray(value) || typeof value !== "object") {
    throw new IntegrationError({
      provider: "Alpha Vantage",
      operation: functionName,
      code: "PROVIDER_INVALID_RESPONSE",
      message: "Alpha Vantage returned an invalid response object.",
      status: 502,
      retryable: true,
      expose: false,
    });
  }

  const payload = value as AlphaVantagePayload;
  const message = alphaProviderMessage(payload);

  if (!message) return payload;

  if (isRateLimitMessage(message)) {
    throw new IntegrationError({
      provider: "Alpha Vantage",
      operation: functionName,
      code: "PROVIDER_RATE_LIMITED",
      message,
      status: 429,
      upstreamStatus: 429,
      retryable: true,
      retryAfterMs: 60_000,
      expose: false,
    });
  }

  if (isAccessMessage(message)) {
    throw new IntegrationError({
      provider: "Alpha Vantage",
      operation: functionName,
      code: "PROVIDER_ACCESS_REQUIRED",
      message,
      status: 503,
      retryable: false,
      expose: false,
    });
  }

  throw new IntegrationError({
    provider: "Alpha Vantage",
    operation: functionName,
    code: "PROVIDER_REJECTED_REQUEST",
    message,
    status: 502,
    retryable: false,
    expose: false,
  });
}

export async function alphaVantageRequest(
  functionName: string,
  parameters: Record<string, string | number | boolean | null | undefined> = {},
  options: {
    timeoutMs?: number;
    maxAttempts?: number;
    maxResponseBytes?: number;
    signal?: AbortSignal;
  } = {},
): Promise<IntegrationExecution<AlphaVantagePayload>> {
  const apiKey = String(process.env.ALPHA_VANTAGE_API_KEY ?? "").trim();

  if (!apiKey) {
    throw new IntegrationError({
      provider: "Alpha Vantage",
      operation: functionName,
      code: "INTEGRATION_NOT_CONFIGURED",
      message: "ALPHA_VANTAGE_API_KEY is not configured.",
      status: 503,
      retryable: false,
      expose: true,
    });
  }

  const url = new URL(ALPHA_VANTAGE_ENDPOINT);
  url.searchParams.set("function", functionName);
  url.searchParams.set("apikey", apiKey);

  for (const [key, value] of Object.entries(parameters)) {
    if (value === null || value === undefined || value === "") continue;
    url.searchParams.set(key, String(value));
  }

  return requestProviderJson<AlphaVantagePayload>({
    provider: "Alpha Vantage",
    operation: functionName,
    circuitKey: "alpha-vantage",
    url,
    init: {
      method: "GET",
      headers: {
        Accept: "application/json",
        "User-Agent": "SliceIntegrationFoundation/5.0",
      },
    },
    idempotent: true,
    timeoutMs: options.timeoutMs ?? 15_000,
    maxAttempts: options.maxAttempts ?? 2,
    maxResponseBytes: options.maxResponseBytes ?? 8 * 1024 * 1024,
    signal: options.signal,
    validate: (payload) => validatePayload(payload, functionName),
  });
}

export function getAlphaVantageIntegrationStatus() {
  const entitlement = String(process.env.ALPHA_VANTAGE_ENTITLEMENT ?? "")
    .trim()
    .toLowerCase();

  return {
    configured: Boolean(String(process.env.ALPHA_VANTAGE_API_KEY ?? "").trim()),
    entitlement:
      entitlement === "realtime" || entitlement === "delayed"
        ? entitlement
        : "unspecified",
    circuits: getIntegrationCircuitSnapshot("alpha-vantage"),
  };
}