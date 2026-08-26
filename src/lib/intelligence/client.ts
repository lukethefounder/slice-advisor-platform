export type IntelligenceApiErrorBody = {
  code?: string;
  message?: string;
  requestId?: string;
  details?: {
    retryAfterSeconds?: number;
    [key: string]: unknown;
  };
};

type IntelligenceErrorEnvelope = {
  error?: string | IntelligenceApiErrorBody;
  detail?: string;
  message?: string;
};

export class IntelligenceApiError extends Error {
  readonly status: number;
  readonly code: string | null;
  readonly requestId: string | null;
  readonly retryAfterSeconds: number | null;

  constructor(
    message: string,
    input: {
      status: number;
      code?: string | null;
      requestId?: string | null;
      retryAfterSeconds?: number | null;
      cause?: unknown;
    },
  ) {
    super(message, input.cause === undefined ? undefined : { cause: input.cause });
    this.name = "IntelligenceApiError";
    this.status = input.status;
    this.code = input.code ?? null;
    this.requestId = input.requestId ?? null;
    this.retryAfterSeconds = input.retryAfterSeconds ?? null;
  }
}


export type ClientFreshnessState =
  | "current"
  | "recent"
  | "stale"
  | "future"
  | "missing"
  | "invalid";

export type ClientTimestampFreshness = {
  state: ClientFreshnessState;
  timestamp: string | null;
  ageMs: number | null;
  label: string;
};

function compactAge(ageMs: number) {
  const seconds = Math.max(0, Math.floor(ageMs / 1_000));

  if (seconds < 60) return "less than a minute ago";

  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? "" : "s"} ago`;
  }

  const hours = Math.floor(minutes / 60);
  if (hours < 48) {
    return `${hours} hour${hours === 1 ? "" : "s"} ago`;
  }

  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

export function clientTimestampFreshness(
  value: string | null | undefined,
  options: {
    now?: number;
    currentWithinMs?: number;
    recentWithinMs?: number;
    futureToleranceMs?: number;
  } = {},
): ClientTimestampFreshness {
  const now = options.now ?? Date.now();
  const currentWithinMs = Math.max(
    1_000,
    options.currentWithinMs ?? 15 * 60_000,
  );
  const recentWithinMs = Math.max(
    currentWithinMs,
    options.recentWithinMs ?? 24 * 60 * 60_000,
  );
  const futureToleranceMs = Math.max(
    0,
    options.futureToleranceMs ?? 10 * 60_000,
  );

  if (!value) {
    return {
      state: "missing",
      timestamp: null,
      ageMs: null,
      label: "Timestamp unavailable",
    };
  }

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return {
      state: "invalid",
      timestamp: value,
      ageMs: null,
      label: "Invalid timestamp",
    };
  }

  const ageMs = now - parsed;
  const timestamp = new Date(parsed).toISOString();

  if (ageMs < -futureToleranceMs) {
    return {
      state: "future",
      timestamp,
      ageMs,
      label: "Future-dated timestamp",
    };
  }

  if (ageMs <= currentWithinMs) {
    return {
      state: "current",
      timestamp,
      ageMs,
      label: `Current · ${compactAge(ageMs)}`,
    };
  }

  if (ageMs <= recentWithinMs) {
    return {
      state: "recent",
      timestamp,
      ageMs,
      label: `Recent · ${compactAge(ageMs)}`,
    };
  }

  return {
    state: "stale",
    timestamp,
    ageMs,
    label: `Saved · ${compactAge(ageMs)}`,
  };
}

export function cleanIntelligenceSymbol(value: unknown) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-:$]/g, "")
    .slice(0, 24);
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

function envelopeMessage(
  envelope: IntelligenceErrorEnvelope,
  fallback: string,
) {
  const apiError =
    envelope.error && typeof envelope.error === "object"
      ? envelope.error
      : null;

  return (
    envelope.detail ||
    apiError?.message ||
    (typeof envelope.error === "string" ? envelope.error : "") ||
    envelope.message ||
    fallback
  );
}

function mergeSignals(
  controller: AbortController,
  signal: AbortSignal | null | undefined,
) {
  if (!signal) return () => undefined;

  const abort = () => controller.abort(signal.reason);
  if (signal.aborted) {
    abort();
    return () => undefined;
  }

  signal.addEventListener("abort", abort, { once: true });
  return () => signal.removeEventListener("abort", abort);
}

function sleep(milliseconds: number, signal?: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = window.setTimeout(resolve, milliseconds);

    if (!signal) return;

    const abort = () => {
      window.clearTimeout(timer);
      reject(new DOMException("The request was aborted.", "AbortError"));
    };

    if (signal.aborted) {
      abort();
      return;
    }

    signal.addEventListener("abort", abort, { once: true });
  });
}

export async function intelligenceFetch<T>(
  url: string,
  init: RequestInit = {},
  options: {
    timeoutMs?: number;
    retries?: number;
    retryDelayMs?: number;
  } = {},
): Promise<T> {
  const method = String(init.method ?? "GET").toUpperCase();
  const retries = method === "GET" ? Math.max(0, options.retries ?? 1) : 0;
  const timeoutMs = Math.max(1_000, options.timeoutMs ?? 30_000);
  const retryDelayMs = Math.max(100, options.retryDelayMs ?? 450);
  let lastError: unknown;

  for (let attempt = 0; attempt <= retries; attempt += 1) {
    const controller = new AbortController();
    const releaseSignal = mergeSignals(controller, init.signal);
    const timeout = window.setTimeout(
      () => controller.abort(new DOMException("Request timed out.", "TimeoutError")),
      timeoutMs,
    );

    try {
      const headers = new Headers(init.headers);
      if (!headers.has("Accept")) headers.set("Accept", "application/json");
      if (
        init.body !== undefined &&
        !(init.body instanceof FormData) &&
        !headers.has("Content-Type")
      ) {
        headers.set("Content-Type", "application/json");
      }

      const response = await fetch(url, {
        ...init,
        cache: init.cache ?? "no-store",
        headers,
        signal: controller.signal,
      });

      const body = (await response.json().catch(() => ({}))) as
        | T
        | IntelligenceErrorEnvelope;

      if (!response.ok) {
        const envelope = body as IntelligenceErrorEnvelope;
        const structured =
          envelope.error && typeof envelope.error === "object"
            ? envelope.error
            : null;
        const retryAfterHeader = Number(response.headers.get("retry-after"));
        const retryAfterDetails = Number(
          structured?.details?.retryAfterSeconds,
        );
        const retryAfterSeconds = Number.isFinite(retryAfterHeader)
          ? retryAfterHeader
          : Number.isFinite(retryAfterDetails)
            ? retryAfterDetails
            : null;

        throw new IntelligenceApiError(
          envelopeMessage(
            envelope,
            `Intelligence request returned HTTP ${response.status}.`,
          ),
          {
            status: response.status,
            code: structured?.code,
            requestId:
              structured?.requestId ??
              response.headers.get("x-request-id"),
            retryAfterSeconds,
          },
        );
      }

      return body as T;
    } catch (error) {
      lastError = error;

      if (isAbortError(error) || init.signal?.aborted) {
        throw error;
      }

      const retryable =
        error instanceof IntelligenceApiError
          ? error.status === 408 ||
            error.status === 425 ||
            error.status === 429 ||
            error.status >= 500
          : error instanceof TypeError;

      if (!retryable || attempt >= retries) throw error;

      await sleep(retryDelayMs * (attempt + 1), init.signal ?? undefined);
    } finally {
      window.clearTimeout(timeout);
      releaseSignal();
    }
  }

  throw lastError instanceof Error
    ? lastError
    : new Error("The intelligence request could not be completed.");
}

type StoredValue<T> = {
  storedAt: number;
  value: T;
};

export function readSessionValue<T>(
  key: string,
  maximumAgeMs: number,
): T | null {
  if (typeof window === "undefined") return null;

  try {
    const parsed = JSON.parse(
      window.sessionStorage.getItem(key) ?? "",
    ) as StoredValue<T>;

    if (
      !parsed ||
      typeof parsed.storedAt !== "number" ||
      Date.now() - parsed.storedAt > maximumAgeMs
    ) {
      window.sessionStorage.removeItem(key);
      return null;
    }

    return parsed.value;
  } catch {
    return null;
  }
}

export function writeSessionValue<T>(key: string, value: T) {
  if (typeof window === "undefined") return;

  try {
    window.sessionStorage.setItem(
      key,
      JSON.stringify({
        storedAt: Date.now(),
        value,
      } satisfies StoredValue<T>),
    );
  } catch {
    // Session storage is an optional fast-path and must never block the UI.
  }
}