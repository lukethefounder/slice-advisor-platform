import "server-only";

export type LogLevel = "debug" | "info" | "warn" | "error";
export type LogContext = Record<string, unknown>;

const LEVEL_WEIGHT: Record<LogLevel, number> = {
  debug: 10,
  info: 20,
  warn: 30,
  error: 40,
};

const REDACTED_VALUE = "[REDACTED]";
const MAX_DEPTH = 5;
const MAX_ARRAY_ITEMS = 30;
const MAX_OBJECT_KEYS = 60;
const MAX_STRING_LENGTH = 4_000;
const SENSITIVE_KEY_PATTERN =
  /(password|passcode|secret|token|authorization|cookie|session|api[-_]?key|private[-_]?key|client[-_]?secret|access[-_]?key|refresh[-_]?token|ssn|tax[-_]?id|routing[-_]?number|account[-_]?number)/i;

function configuredLevel(): LogLevel {
  const value = String(process.env.LOG_LEVEL ?? "info").toLowerCase();

  return value === "debug" ||
    value === "info" ||
    value === "warn" ||
    value === "error"
    ? value
    : "info";
}

function shouldLog(level: LogLevel) {
  return LEVEL_WEIGHT[level] >= LEVEL_WEIGHT[configuredLevel()];
}

function truncate(value: string) {
  return value.length <= MAX_STRING_LENGTH
    ? value
    : `${value.slice(0, MAX_STRING_LENGTH)}…[truncated]`;
}

function sanitizeUrl(value: URL) {
  const safe = new URL(value.toString());

  for (const key of safe.searchParams.keys()) {
    if (SENSITIVE_KEY_PATTERN.test(key)) {
      safe.searchParams.set(key, REDACTED_VALUE);
    }
  }

  return truncate(safe.toString());
}

function sanitizeValue(
  value: unknown,
  key = "",
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) return REDACTED_VALUE;
  if (value === null || value === undefined) return value;

  if (typeof value === "string") return truncate(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (typeof value === "symbol") return value.toString();
  if (typeof value === "function") return `[Function ${value.name || "anonymous"}]`;

  if (value instanceof Date) return value.toISOString();
  if (value instanceof URL) return sanitizeUrl(value);
  if (value instanceof Error) return serializeError(value);
  if (typeof Buffer !== "undefined" && Buffer.isBuffer(value)) {
    return `[Buffer ${value.length} bytes]`;
  }

  if (depth >= MAX_DEPTH) return "[Maximum log depth reached]";

  if (Array.isArray(value)) {
    const items = value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeValue(item, "", depth + 1, seen));

    if (value.length > MAX_ARRAY_ITEMS) {
      items.push(`[${value.length - MAX_ARRAY_ITEMS} additional items omitted]`);
    }

    return items;
  }

  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);

    const output: Record<string, unknown> = {};
    const entries = Object.entries(value).slice(0, MAX_OBJECT_KEYS);

    for (const [childKey, childValue] of entries) {
      output[childKey] = sanitizeValue(
        childValue,
        childKey,
        depth + 1,
        seen,
      );
    }

    const totalKeys = Object.keys(value).length;

    if (totalKeys > MAX_OBJECT_KEYS) {
      output.__omittedKeys = totalKeys - MAX_OBJECT_KEYS;
    }

    return output;
  }

  return String(value);
}

export function serializeError(error: unknown) {
  if (!(error instanceof Error)) {
    return {
      name: "UnknownError",
      message: truncate(String(error)),
    };
  }

  const candidate = error as Error & {
    code?: unknown;
    cause?: unknown;
    digest?: unknown;
  };
  const includeStack =
    process.env.NODE_ENV !== "production" ||
    String(process.env.LOG_INCLUDE_STACKS).toLowerCase() === "true";

  return {
    name: error.name,
    message: truncate(error.message),
    ...(candidate.code === undefined
      ? {}
      : { code: sanitizeValue(candidate.code, "code") }),
    ...(candidate.digest === undefined
      ? {}
      : { digest: sanitizeValue(candidate.digest, "digest") }),
    ...(candidate.cause === undefined
      ? {}
      : { cause: sanitizeValue(candidate.cause, "cause") }),
    ...(includeStack && error.stack ? { stack: truncate(error.stack) } : {}),
  };
}

function write(
  level: LogLevel,
  scope: string,
  event: string,
  context: LogContext,
) {
  if (!shouldLog(level)) return;

  const safeContext = sanitizeValue(context);
  const entry = {
    ...(safeContext && typeof safeContext === "object" ? safeContext : {}),
    timestamp: new Date().toISOString(),
    level,
    service: "slice-platform",
    scope,
    event,
    environment:
      process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
  };
  const serialized = JSON.stringify(entry);

  if (level === "error") {
    console.error(serialized);
    return;
  }

  if (level === "warn") {
    console.warn(serialized);
    return;
  }

  if (level === "debug") {
    console.debug(serialized);
    return;
  }

  console.info(serialized);
}

export function createLogger(scope: string, baseContext: LogContext = {}) {
  return {
    debug(event: string, context: LogContext = {}) {
      write("debug", scope, event, { ...baseContext, ...context });
    },
    info(event: string, context: LogContext = {}) {
      write("info", scope, event, { ...baseContext, ...context });
    },
    warn(event: string, context: LogContext = {}) {
      write("warn", scope, event, { ...baseContext, ...context });
    },
    error(event: string, error: unknown, context: LogContext = {}) {
      write("error", scope, event, {
        ...baseContext,
        ...context,
        error: serializeError(error),
      });
    },
    child(childScope: string, childContext: LogContext = {}) {
      return createLogger(`${scope}:${childScope}`, {
        ...baseContext,
        ...childContext,
      });
    },
  };
}

export const logger = createLogger("application");