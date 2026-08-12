import "server-only";

import { createHash, randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api-route";
import { createLogger } from "@/lib/logger";

export type IntegrationCircuitState = "closed" | "open" | "half-open";

export type IntegrationMeta = {
  provider: string;
  operation: string;
  requestId: string;
  attempts: number;
  durationMs: number;
  upstreamRequestId?: string;
};

export type IntegrationExecution<T> = {
  data: T;
  meta: IntegrationMeta;
};

export type IntegrationFailure = {
  code: string;
  message: string;
  status: number;
  retryable: boolean;
  retryAfterMs?: number;
  requestId?: string;
};

type CircuitRecord = {
  state: IntegrationCircuitState;
  failureCount: number;
  openedAt: number | null;
  halfOpenProbe: boolean;
  lastFailureAt: number | null;
  lastSuccessAt: number | null;
  lastErrorCode: string | null;
};

export type ExecuteIntegrationOptions = {
  provider: string;
  operation: string;
  circuitKey?: string;
  timeoutMs?: number;
  maxAttempts?: number;
  idempotent?: boolean;
  signal?: AbortSignal;
  retryBaseMs?: number;
  retryMaxMs?: number;
  idempotencyKey?: string;
};

export type OperationContext = {
  attempt: number;
  requestId: string;
  signal: AbortSignal;
};

export type ProviderJsonRequestOptions<T> = ExecuteIntegrationOptions & {
  url: string | URL;
  init?: RequestInit;
  maxResponseBytes?: number;
  validate?: (payload: unknown, response: Response) => T;
};

declare global {
  // eslint-disable-next-line no-var
  var __sliceIntegrationCircuits: Map<string, CircuitRecord> | undefined;

  // eslint-disable-next-line no-var
  var __sliceIntegrationInFlight: Map<string, Promise<unknown>> | undefined;
}

const circuits =
  globalThis.__sliceIntegrationCircuits ?? new Map<string, CircuitRecord>();
const inFlightOperations =
  globalThis.__sliceIntegrationInFlight ?? new Map<string, Promise<unknown>>();

globalThis.__sliceIntegrationCircuits = circuits;
globalThis.__sliceIntegrationInFlight = inFlightOperations;

const log = createLogger("integrations");
const RETRYABLE_HTTP_STATUSES = new Set([408, 425, 429, 500, 502, 503, 504]);

function envInteger(
  name: string,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const value = Number(process.env[name]);

  if (!Number.isInteger(value)) return fallback;
  return Math.max(minimum, Math.min(maximum, value));
}

function defaultTimeoutMs() {
  return envInteger("INTEGRATION_TIMEOUT_MS", 15_000, 1_000, 300_000);
}

function defaultAttempts() {
  return envInteger("INTEGRATION_RETRY_ATTEMPTS", 2, 1, 5);
}

function circuitFailureThreshold() {
  return envInteger("INTEGRATION_CIRCUIT_FAILURES", 5, 2, 20);
}

function circuitCooldownMs() {
  return envInteger("INTEGRATION_CIRCUIT_COOLDOWN_MS", 60_000, 5_000, 900_000);
}

function defaultResponseLimit() {
  return envInteger(
    "INTEGRATION_MAX_RESPONSE_BYTES",
    2 * 1024 * 1024,
    16 * 1024,
    20 * 1024 * 1024,
  );
}

function cleanName(value: string, fallback: string) {
  const clean = String(value ?? "")
    .replace(/[^A-Za-z0-9 ._:/-]/g, "")
    .trim()
    .slice(0, 120);

  return clean || fallback;
}

function circuitKeyFor(options: ExecuteIntegrationOptions) {
  return (
    options.circuitKey?.trim() ||
    `${cleanName(options.provider, "provider")}:${cleanName(
      options.operation,
      "operation",
    )}`
  ).slice(0, 240);
}

function initialCircuit(): CircuitRecord {
  return {
    state: "closed",
    failureCount: 0,
    openedAt: null,
    halfOpenProbe: false,
    lastFailureAt: null,
    lastSuccessAt: null,
    lastErrorCode: null,
  };
}

function currentCircuit(key: string) {
  const existing = circuits.get(key);

  if (existing) return existing;

  const created = initialCircuit();
  circuits.set(key, created);
  return created;
}

export class IntegrationError extends Error {
  readonly provider: string;
  readonly operation: string;
  readonly code: string;
  readonly status: number;
  readonly upstreamStatus?: number;
  readonly retryable: boolean;
  readonly retryAfterMs?: number;
  readonly expose: boolean;
  readonly requestId?: string;

  constructor(input: {
    provider: string;
    operation: string;
    code: string;
    message: string;
    status?: number;
    upstreamStatus?: number;
    retryable?: boolean;
    retryAfterMs?: number;
    expose?: boolean;
    requestId?: string;
    cause?: unknown;
  }) {
    super(
      input.message,
      input.cause === undefined ? undefined : { cause: input.cause },
    );
    this.name = "IntegrationError";
    this.provider = cleanName(input.provider, "Integration");
    this.operation = cleanName(input.operation, "request");
    this.code = input.code;
    this.status = input.status ?? 502;
    this.upstreamStatus = input.upstreamStatus;
    this.retryable = input.retryable ?? false;
    this.retryAfterMs = input.retryAfterMs;
    this.expose = input.expose ?? false;
    this.requestId = input.requestId;
  }
}

function safeProviderMessage(error: unknown) {
  if (!(error instanceof Error)) return "";

  return error.message.replace(/\s+/g, " ").trim().slice(0, 1_000);
}

function looksUnconfigured(message: string) {
  return /(not configured|missing.+(?:api|token|key|secret)|requires.+(?:api|token|key|secret))/i.test(
    message,
  );
}

function looksAborted(error: unknown) {
  return (
    error instanceof Error &&
    (error.name === "AbortError" || /abort|timed?\s*out|timeout/i.test(error.message))
  );
}

function normalizeIntegrationError(
  error: unknown,
  input: {
    provider: string;
    operation: string;
    requestId: string;
    timedOut?: boolean;
    cancelled?: boolean;
  },
) {
  if (error instanceof IntegrationError) {
    return error.requestId
      ? error
      : new IntegrationError({
          provider: error.provider,
          operation: error.operation,
          code: error.code,
          message: error.message,
          status: error.status,
          upstreamStatus: error.upstreamStatus,
          retryable: error.retryable,
          retryAfterMs: error.retryAfterMs,
          expose: error.expose,
          requestId: input.requestId,
          cause: error.cause,
        });
  }

  const message = safeProviderMessage(error);

  if (input.cancelled) {
    return new IntegrationError({
      provider: input.provider,
      operation: input.operation,
      code: "INTEGRATION_CANCELLED",
      message: "The provider request was cancelled.",
      status: 499,
      retryable: false,
      expose: false,
      requestId: input.requestId,
      cause: error,
    });
  }

  if (input.timedOut || looksAborted(error)) {
    return new IntegrationError({
      provider: input.provider,
      operation: input.operation,
      code: "INTEGRATION_TIMEOUT",
      message: `${input.provider} did not respond within the allowed time.`,
      status: 504,
      retryable: true,
      expose: false,
      requestId: input.requestId,
      cause: error,
    });
  }

  if (looksUnconfigured(message)) {
    return new IntegrationError({
      provider: input.provider,
      operation: input.operation,
      code: "INTEGRATION_NOT_CONFIGURED",
      message: `${input.provider} is not configured on the server.`,
      status: 503,
      retryable: false,
      expose: true,
      requestId: input.requestId,
      cause: error,
    });
  }

  return new IntegrationError({
    provider: input.provider,
    operation: input.operation,
    code: "INTEGRATION_FAILED",
    message: message || `${input.provider} request failed.`,
    status: 502,
    retryable: true,
    expose: false,
    requestId: input.requestId,
    cause: error,
  });
}

function assertCircuitAvailable(key: string, provider: string, operation: string) {
  const record = currentCircuit(key);
  const now = Date.now();

  if (record.state === "open") {
    const openedAt = record.openedAt ?? now;
    const remainingMs = circuitCooldownMs() - (now - openedAt);

    if (remainingMs > 0) {
      throw new IntegrationError({
        provider,
        operation,
        code: "INTEGRATION_CIRCUIT_OPEN",
        message: `${provider} is temporarily paused after repeated failures.`,
        status: 503,
        retryable: false,
        retryAfterMs: remainingMs,
        expose: true,
      });
    }

    record.state = "half-open";
    record.halfOpenProbe = false;
    circuits.set(key, record);
  }

  if (record.state === "half-open") {
    if (record.halfOpenProbe) {
      throw new IntegrationError({
        provider,
        operation,
        code: "INTEGRATION_CIRCUIT_OPEN",
        message: `${provider} is recovering and is already running a test request.`,
        status: 503,
        retryable: false,
        retryAfterMs: 1_000,
        expose: true,
      });
    }

    record.halfOpenProbe = true;
    circuits.set(key, record);
  }
}

function recordCircuitSuccess(key: string) {
  const record = currentCircuit(key);

  record.state = "closed";
  record.failureCount = 0;
  record.openedAt = null;
  record.halfOpenProbe = false;
  record.lastSuccessAt = Date.now();
  record.lastErrorCode = null;
  circuits.set(key, record);
}

function recordCircuitFailure(key: string, error: IntegrationError) {
  const record = currentCircuit(key);

  record.halfOpenProbe = false;
  record.lastFailureAt = Date.now();
  record.lastErrorCode = error.code;

  if (!error.retryable) {
    if (record.state === "half-open") record.state = "closed";
    circuits.set(key, record);
    return;
  }

  record.failureCount += 1;

  if (
    record.state === "half-open" ||
    record.failureCount >= circuitFailureThreshold()
  ) {
    record.state = "open";
    record.openedAt = Date.now();
  }

  circuits.set(key, record);
}

function retryDelayMs(
  attempt: number,
  baseMs: number,
  maximumMs: number,
  retryAfterMs?: number,
) {
  if (retryAfterMs && retryAfterMs > 0) {
    return Math.min(maximumMs, retryAfterMs);
  }

  const exponential = Math.min(maximumMs, baseMs * 2 ** Math.max(0, attempt - 1));
  const jitter = Math.round(exponential * (0.15 + Math.random() * 0.2));
  return Math.min(maximumMs, exponential + jitter);
}

async function delay(ms: number, signal?: AbortSignal) {
  if (ms <= 0) return;

  await new Promise<void>((resolve, reject) => {
    const finish = () => {
      signal?.removeEventListener("abort", abort);
      resolve();
    };
    const timer = setTimeout(finish, ms);

    function abort() {
      clearTimeout(timer);
      signal?.removeEventListener("abort", abort);
      reject(new DOMException("The operation was aborted.", "AbortError"));
    }

    if (signal?.aborted) {
      abort();
      return;
    }

    signal?.addEventListener("abort", abort, { once: true });
  });
}

function combinedSignal(
  timeoutMs: number,
  externalSignal?: AbortSignal,
) {
  const controller = new AbortController();
  let timedOut = false;
  let cancelled = false;

  const timeout = setTimeout(() => {
    timedOut = true;
    controller.abort(new DOMException("Provider request timed out.", "TimeoutError"));
  }, timeoutMs);

  const abortFromExternal = () => {
    cancelled = true;
    controller.abort(externalSignal?.reason);
  };

  if (externalSignal?.aborted) {
    abortFromExternal();
  } else {
    externalSignal?.addEventListener("abort", abortFromExternal, { once: true });
  }

  return {
    signal: controller.signal,
    timedOut: () => timedOut,
    cancelled: () => cancelled,
    cleanup() {
      clearTimeout(timeout);
      externalSignal?.removeEventListener("abort", abortFromExternal);
    },
  };
}

async function executeIntegrationInternal<T>(
  options: ExecuteIntegrationOptions,
  operation: (context: OperationContext) => Promise<T>,
): Promise<IntegrationExecution<T>> {
  const provider = cleanName(options.provider, "Integration");
  const operationName = cleanName(options.operation, "request");
  const circuitKey = circuitKeyFor(options);
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? defaultTimeoutMs());
  const requestedAttempts = Math.max(1, options.maxAttempts ?? defaultAttempts());
  const maxAttempts = options.idempotent ? requestedAttempts : 1;
  const retryBaseMs = Math.max(50, options.retryBaseMs ?? 250);
  const retryMaxMs = Math.max(retryBaseMs, options.retryMaxMs ?? 5_000);
  const requestId = randomUUID();
  const startedAt = performance.now();

  assertCircuitAvailable(circuitKey, provider, operationName);

  let lastError: IntegrationError | null = null;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const signals = combinedSignal(timeoutMs, options.signal);

    try {
      const operationPromise = Promise.resolve(
        operation({
          attempt,
          requestId,
          signal: signals.signal,
        }),
      );
      const timeoutPromise = new Promise<never>((_, reject) => {
        signals.signal.addEventListener(
          "abort",
          () => reject(signals.signal.reason ?? new DOMException("Aborted", "AbortError")),
          { once: true },
        );
      });
      const data = await Promise.race([operationPromise, timeoutPromise]);
      const durationMs = Math.max(0, Math.round(performance.now() - startedAt));

      recordCircuitSuccess(circuitKey);
      log.info("provider.request.completed", {
        provider,
        operation: operationName,
        requestId,
        attempt,
        durationMs,
      });

      return {
        data,
        meta: {
          provider,
          operation: operationName,
          requestId,
          attempts: attempt,
          durationMs,
        },
      };
    } catch (error) {
      const normalized = normalizeIntegrationError(error, {
        provider,
        operation: operationName,
        requestId,
        timedOut: signals.timedOut(),
        cancelled: signals.cancelled(),
      });

      lastError = normalized;

      const canRetry =
        options.idempotent === true &&
        normalized.retryable &&
        attempt < maxAttempts &&
        !options.signal?.aborted;

      if (!canRetry) break;

      const waitMs = retryDelayMs(
        attempt,
        retryBaseMs,
        retryMaxMs,
        normalized.retryAfterMs,
      );

      log.warn("provider.request.retrying", {
        provider,
        operation: operationName,
        requestId,
        attempt,
        nextAttempt: attempt + 1,
        waitMs,
        code: normalized.code,
        upstreamStatus: normalized.upstreamStatus,
      });

      signals.cleanup();

      try {
        await delay(waitMs, options.signal);
      } catch (delayError) {
        lastError = normalizeIntegrationError(delayError, {
          provider,
          operation: operationName,
          requestId,
          cancelled: Boolean(options.signal?.aborted),
        });
        break;
      }
    } finally {
      signals.cleanup();
    }
  }

  const finalError =
    lastError ??
    new IntegrationError({
      provider,
      operation: operationName,
      code: "INTEGRATION_FAILED",
      message: `${provider} request failed.`,
      status: 502,
      retryable: true,
      requestId,
    });

  recordCircuitFailure(circuitKey, finalError);
  log.error("provider.request.failed", finalError, {
    provider,
    operation: operationName,
    requestId,
    attempts: maxAttempts,
    durationMs: Math.max(0, Math.round(performance.now() - startedAt)),
    circuitKey,
  });

  throw finalError;
}

function operationDeduplicationKey(options: ExecuteIntegrationOptions) {
  const rawKey = options.idempotencyKey?.trim();

  if (!rawKey) return null;

  const digest = createHash("sha256")
    .update(rawKey)
    .digest("hex")
    .slice(0, 32);

  return `${circuitKeyFor(options)}:${digest}`;
}

export function executeIntegration<T>(
  options: ExecuteIntegrationOptions,
  operation: (context: OperationContext) => Promise<T>,
): Promise<IntegrationExecution<T>> {
  const dedupeKey = operationDeduplicationKey(options);

  if (dedupeKey) {
    const existing = inFlightOperations.get(dedupeKey);

    if (existing) {
      return existing as Promise<IntegrationExecution<T>>;
    }
  }

  const task = executeIntegrationInternal(options, operation);

  if (dedupeKey) {
    inFlightOperations.set(dedupeKey, task);
    task.finally(() => inFlightOperations.delete(dedupeKey)).catch(() => undefined);
  }

  return task;
}

function retryAfterMs(response: Response) {
  const value = response.headers.get("retry-after");

  if (!value) return undefined;

  const seconds = Number(value);

  if (Number.isFinite(seconds) && seconds >= 0) {
    return Math.round(seconds * 1_000);
  }

  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - Date.now()) : undefined;
}

function upstreamRequestId(response: Response) {
  return (
    response.headers.get("x-request-id") ||
    response.headers.get("request-id") ||
    response.headers.get("cf-ray") ||
    undefined
  );
}

function messageFromPayload(payload: unknown) {
  if (!payload || typeof payload !== "object") return "";

  const candidate = payload as {
    message?: unknown;
    error?: unknown;
    detail?: unknown;
  };

  if (typeof candidate.message === "string") return candidate.message.slice(0, 1_000);
  if (typeof candidate.detail === "string") return candidate.detail.slice(0, 1_000);
  if (typeof candidate.error === "string") return candidate.error.slice(0, 1_000);

  if (
    candidate.error &&
    typeof candidate.error === "object" &&
    "message" in candidate.error &&
    typeof (candidate.error as { message?: unknown }).message === "string"
  ) {
    return String((candidate.error as { message: string }).message).slice(0, 1_000);
  }

  return "";
}

function httpError(
  provider: string,
  operation: string,
  response: Response,
  payload: unknown,
  requestId: string,
) {
  const status = response.status;
  const retryable = RETRYABLE_HTTP_STATUSES.has(status);
  const providerMessage = messageFromPayload(payload);
  const code =
    status === 401 || status === 403
      ? "PROVIDER_AUTH_FAILED"
      : status === 429
        ? "PROVIDER_RATE_LIMITED"
        : retryable
          ? "PROVIDER_UNAVAILABLE"
          : "PROVIDER_REJECTED_REQUEST";

  return new IntegrationError({
    provider,
    operation,
    code,
    message: providerMessage || `${provider} returned HTTP ${status}.`,
    status: status === 429 ? 429 : status >= 500 ? 502 : 502,
    upstreamStatus: status,
    retryable,
    retryAfterMs: retryAfterMs(response),
    expose: false,
    requestId,
  });
}

async function readResponsePayload(
  response: Response,
  maxBytes: number,
  context: { provider: string; operation: string; requestId: string },
) {
  const declared = Number(response.headers.get("content-length"));

  if (Number.isFinite(declared) && declared > maxBytes) {
    throw new IntegrationError({
      provider: context.provider,
      operation: context.operation,
      code: "PROVIDER_RESPONSE_TOO_LARGE",
      message: `Provider response exceeded ${maxBytes} bytes.`,
      status: 502,
      retryable: false,
      expose: false,
      requestId: context.requestId,
    });
  }

  if (response.status === 204) return null;

  const text = await response.text();

  if (Buffer.byteLength(text, "utf8") > maxBytes) {
    throw new IntegrationError({
      provider: context.provider,
      operation: context.operation,
      code: "PROVIDER_RESPONSE_TOO_LARGE",
      message: `Provider response exceeded ${maxBytes} bytes.`,
      status: 502,
      retryable: false,
      expose: false,
      requestId: context.requestId,
    });
  }

  if (!text.trim()) return null;

  const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";

  if (!contentType.includes("json")) {
    return { message: text.slice(0, 1_000) };
  }

  try {
    return JSON.parse(text) as unknown;
  } catch (error) {
    throw new IntegrationError({
      provider: context.provider,
      operation: context.operation,
      code: "PROVIDER_INVALID_JSON",
      message: "Provider returned malformed JSON.",
      status: 502,
      retryable: true,
      expose: false,
      requestId: context.requestId,
      cause: error,
    });
  }
}

export async function requestProviderJson<T>(
  options: ProviderJsonRequestOptions<T>,
): Promise<IntegrationExecution<T>> {
  const provider = cleanName(options.provider, "Integration");
  const operationName = cleanName(options.operation, "request");
  const maxBytes = Math.max(
    16 * 1024,
    Math.min(options.maxResponseBytes ?? defaultResponseLimit(), 20 * 1024 * 1024),
  );
  let capturedUpstreamRequestId: string | undefined;

  const result = await executeIntegration(
    options,
    async ({ signal, requestId }) => {
      const response = await fetch(options.url, {
        ...options.init,
        cache: options.init?.cache ?? "no-store",
        signal,
      });
      const payload = await readResponsePayload(response, maxBytes, {
        provider,
        operation: operationName,
        requestId,
      });

      capturedUpstreamRequestId = upstreamRequestId(response);

      if (!response.ok) {
        throw httpError(provider, operationName, response, payload, requestId);
      }

      if (options.validate) {
        return options.validate(payload, response);
      }

      return payload as T;
    },
  );

  return {
    data: result.data,
    meta: {
      ...result.meta,
      ...(capturedUpstreamRequestId
        ? { upstreamRequestId: capturedUpstreamRequestId }
        : {}),
    },
  };
}

export function publicIntegrationFailure(
  error: unknown,
  fallbackMessage = "The external provider could not complete the request.",
): IntegrationFailure {
  const normalized =
    error instanceof IntegrationError
      ? error
      : normalizeIntegrationError(error, {
          provider: "Integration",
          operation: "request",
          requestId: randomUUID(),
        });

  const message =
    normalized.code === "INTEGRATION_NOT_CONFIGURED"
      ? "This integration is not configured."
      : normalized.code === "INTEGRATION_CIRCUIT_OPEN"
        ? "This integration is temporarily paused after repeated provider failures."
        : normalized.code === "INTEGRATION_TIMEOUT"
          ? "The provider did not respond in time."
          : normalized.code === "PROVIDER_RATE_LIMITED"
            ? "The provider is rate-limiting requests. Try again after the cooldown."
            : normalized.code === "PROVIDER_AUTH_FAILED"
              ? "The provider rejected its server credentials."
            : normalized.code === "PROVIDER_ACCESS_REQUIRED"
              ? "The provider account does not include access to this operation."
            : normalized.code === "PROVIDER_INVALID_RESPONSE" ||
                normalized.code === "PROVIDER_INVALID_JSON"
              ? "The provider returned an unreadable response."
            : normalized.code === "INTEGRATION_CANCELLED"
              ? "The provider request was cancelled."
              : normalized.code === "PROVIDER_RESPONSE_TOO_LARGE"
                ? "The provider returned more data than this operation permits."
                : fallbackMessage;

  return {
    code: normalized.code,
    message,
    status: normalized.status,
    retryable: normalized.retryable,
    retryAfterMs: normalized.retryAfterMs,
    requestId: normalized.requestId,
  };
}

export function integrationErrorToApiError(
  error: unknown,
  fallbackMessage = "The provider request could not be completed.",
) {
  const failure = publicIntegrationFailure(error, fallbackMessage);

  return new ApiError({
    status: failure.status,
    code: failure.code,
    message: failure.message,
    expose: true,
    details: {
      retryable: failure.retryable,
      ...(failure.retryAfterMs
        ? { retryAfterSeconds: Math.max(1, Math.ceil(failure.retryAfterMs / 1_000)) }
        : {}),
      ...(failure.requestId ? { providerRequestId: failure.requestId } : {}),
    },
    cause: error,
  });
}

export function getIntegrationCircuitSnapshot(prefix?: string) {
  const now = Date.now();

  return Array.from(circuits.entries())
    .filter(([key]) => !prefix || key.startsWith(prefix))
    .map(([key, record]) => ({
      key,
      state: record.state,
      failureCount: record.failureCount,
      lastErrorCode: record.lastErrorCode,
      lastFailureAt: record.lastFailureAt
        ? new Date(record.lastFailureAt).toISOString()
        : null,
      lastSuccessAt: record.lastSuccessAt
        ? new Date(record.lastSuccessAt).toISOString()
        : null,
      retryAt:
        record.state === "open" && record.openedAt
          ? new Date(record.openedAt + circuitCooldownMs()).toISOString()
          : null,
      available:
        record.state !== "open" ||
        !record.openedAt ||
        now - record.openedAt >= circuitCooldownMs(),
    }))
    .sort((left, right) => left.key.localeCompare(right.key));
}

export function stableIntegrationId(prefix: string, value: string) {
  const safePrefix = String(prefix ?? "integration")
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 40) || "integration";
  const digest = createHash("sha256")
    .update(String(value ?? ""))
    .digest("hex")
    .slice(0, 32);

  return `${safePrefix}-${digest}`;
}

export function getIntegrationRuntimeSnapshot() {
  return {
    policy: {
      defaultTimeoutMs: defaultTimeoutMs(),
      defaultAttempts: defaultAttempts(),
      circuitFailureThreshold: circuitFailureThreshold(),
      circuitCooldownMs: circuitCooldownMs(),
      maximumJsonResponseBytes: defaultResponseLimit(),
      automaticRetriesRequireIdempotency: true,
    },
    circuits: getIntegrationCircuitSnapshot(),
    capturedAt: new Date().toISOString(),
  };
}