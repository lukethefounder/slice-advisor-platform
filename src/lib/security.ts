import "server-only";

import {
  createHash,
  createHmac,
  randomBytes,
  timingSafeEqual,
} from "node:crypto";

import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";

type RateLimitResult = {
  allowed: boolean;
  key: string;
  limit: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
};

type RateLimitInput = {
  key: string;
  limit: number;
  windowMs: number;
};

type SecurityEventInput = {
  userId?: string | null;
  eventType: string;
  severity?: "Info" | "Low" | "Medium" | "High" | "Critical";
  area?: string;
  title: string;
  detail?: string | null;
  metadata?: Record<string, unknown>;
  request?: Request;
};

type RateBucket = {
  count: number;
  resetAt: number;
  lastUsedAt: number;
};

const memoryRateBuckets = new Map<string, RateBucket>();
const securityLog = createLogger("security");
const MAX_MEMORY_BUCKETS = 20_000;
const MAX_METADATA_DEPTH = 5;
const MAX_METADATA_KEYS = 80;
const MAX_ARRAY_ITEMS = 50;
const MAX_STRING_LENGTH = 2_000;
const REDACTED = "[REDACTED]";
const SENSITIVE_KEY_PATTERN =
  /(password|passcode|secret|token|authorization|cookie|session|api[-_]?key|private[-_]?key|client[-_]?secret|access[-_]?key|refresh[-_]?token|ssn|tax[-_]?id|routing[-_]?number|account[-_]?number|credential|signature)/i;

function truncate(value: string, maximum = MAX_STRING_LENGTH) {
  return value.length <= maximum
    ? value
    : `${value.slice(0, maximum)}…[truncated]`;
}

function securityPepper() {
  return (
    String(process.env.SECURITY_PEPPER ?? "").trim() ||
    String(process.env.SLICE_SECRET_ENCRYPTION_KEY ?? "").trim() ||
    String(process.env.NEXTAUTH_SECRET ?? "").trim() ||
    (process.env.NODE_ENV === "production"
      ? "slice-production-missing-security-pepper"
      : "slice-local-security-pepper")
  );
}

function pruneMemoryBuckets(now = Date.now()) {
  for (const [key, bucket] of memoryRateBuckets) {
    if (bucket.resetAt <= now) memoryRateBuckets.delete(key);
  }

  if (memoryRateBuckets.size <= MAX_MEMORY_BUCKETS) return;

  const overflow = memoryRateBuckets.size - MAX_MEMORY_BUCKETS;
  const oldest = [...memoryRateBuckets.entries()]
    .sort((left, right) => left[1].lastUsedAt - right[1].lastUsedAt)
    .slice(0, overflow);

  for (const [key] of oldest) memoryRateBuckets.delete(key);
}

function safeRequestPath(request: Request) {
  try {
    return new URL(request.url).pathname.slice(0, 500);
  } catch {
    return "unknown";
  }
}

function sanitizeMetadata(
  value: unknown,
  key = "",
  depth = 0,
  seen = new WeakSet<object>(),
): unknown {
  if (key && SENSITIVE_KEY_PATTERN.test(key)) return REDACTED;
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return truncate(value);
  if (typeof value === "number" || typeof value === "boolean") return value;
  if (typeof value === "bigint") return value.toString();
  if (value instanceof Date) return value.toISOString();
  if (value instanceof URL) return `${value.origin}${value.pathname}`;
  if (value instanceof Error) {
    return { name: value.name, message: truncate(value.message, 1_000) };
  }
  if (depth >= MAX_METADATA_DEPTH) return "[Maximum depth reached]";

  if (Array.isArray(value)) {
    return value
      .slice(0, MAX_ARRAY_ITEMS)
      .map((item) => sanitizeMetadata(item, "", depth + 1, seen));
  }

  if (typeof value === "object") {
    if (seen.has(value)) return "[Circular]";
    seen.add(value);
    const output: Record<string, unknown> = {};

    for (const [childKey, childValue] of Object.entries(value).slice(
      0,
      MAX_METADATA_KEYS,
    )) {
      output[childKey] = sanitizeMetadata(
        childValue,
        childKey,
        depth + 1,
        seen,
      );
    }

    return output;
  }

  return truncate(String(value));
}

export function securityId(prefix = "sec") {
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}

export function getClientIp(request: Request) {
  const vercel = request.headers.get("x-vercel-forwarded-for");
  const cloudflare = request.headers.get("cf-connecting-ip");
  const forwarded = request.headers.get("x-forwarded-for");
  const real = request.headers.get("x-real-ip");

  return (
    vercel?.split(",")[0]?.trim() ||
    cloudflare?.trim() ||
    forwarded?.split(",")[0]?.trim() ||
    real?.trim() ||
    "unknown"
  );
}

export function getUserAgent(request: Request) {
  return truncate(request.headers.get("user-agent") || "unknown", 500);
}

export function hashForSecurity(value: string) {
  return createHmac("sha256", securityPepper()).update(value).digest("hex");
}

export function plainHash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

export function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  if (leftBuffer.length !== rightBuffer.length) return false;
  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function redactSecurityMetadata(value: unknown): unknown {
  return sanitizeMetadata(value);
}

export function checkRateLimit(input: RateLimitInput): RateLimitResult {
  const now = Date.now();
  pruneMemoryBuckets(now);
  const key = hashForSecurity(input.key);
  const existing = memoryRateBuckets.get(key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + input.windowMs;
    memoryRateBuckets.set(key, { count: 1, resetAt, lastUsedAt: now });

    return {
      allowed: true,
      key,
      limit: input.limit,
      remaining: Math.max(0, input.limit - 1),
      resetAt: new Date(resetAt),
      retryAfterSeconds: 0,
    };
  }

  existing.count += 1;
  existing.lastUsedAt = now;
  memoryRateBuckets.set(key, existing);

  return {
    allowed: existing.count <= input.limit,
    key,
    limit: input.limit,
    remaining: Math.max(0, input.limit - existing.count),
    resetAt: new Date(existing.resetAt),
    retryAfterSeconds: Math.max(
      1,
      Math.ceil((existing.resetAt - now) / 1_000),
    ),
  };
}

export function isPotentiallyCrossSiteUnsafeRequest(request: Request) {
  const method = request.method.toUpperCase();
  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) return false;

  const site = request.headers.get("sec-fetch-site")?.toLowerCase();
  if (site === "cross-site") return true;

  const origin = request.headers.get("origin");
  const referer = request.headers.get("referer");
  const host = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const forwardedProto = request.headers.get("x-forwarded-proto") || "https";
  if (!host) return Boolean(origin || referer);

  const expectedOrigins = new Set([
    `${forwardedProto}://${host}`,
    `https://${host}`,
    `http://${host}`,
  ]);

  try {
    if (origin && !expectedOrigins.has(new URL(origin).origin)) return true;
    if (!origin && referer && !expectedOrigins.has(new URL(referer).origin)) {
      return true;
    }
  } catch {
    return true;
  }

  return false;
}

export function buildSecurityMetadata(
  request: Request,
  extra: Record<string, unknown> = {},
) {
  let origin: string | null = null;
  const rawOrigin = request.headers.get("origin");

  if (rawOrigin) {
    try {
      origin = new URL(rawOrigin).origin;
    } catch {
      origin = "invalid";
    }
  }

  return redactSecurityMetadata({
    requestId:
      request.headers.get("x-request-id")?.slice(0, 128) || securityId("request"),
    ipHash: hashForSecurity(getClientIp(request)),
    userAgent: getUserAgent(request),
    method: request.method,
    path: safeRequestPath(request),
    secFetchSite: request.headers.get("sec-fetch-site"),
    origin,
    ...extra,
  }) as Record<string, unknown>;
}

export async function recordSecurityEvent(input: SecurityEventInput) {
  const metadata = input.request
    ? buildSecurityMetadata(input.request, input.metadata ?? {})
    : (redactSecurityMetadata(input.metadata ?? {}) as Record<string, unknown>);
  const eventContext = {
    eventType: input.eventType,
    severity: input.severity ?? "Info",
    area: input.area ?? "Security",
    title: truncate(input.title, 300),
    userId: input.userId ?? null,
    metadata,
  };

  if (input.severity === "Critical" || input.severity === "High") {
    securityLog.warn("event.recorded", eventContext);
  } else {
    securityLog.info("event.recorded", eventContext);
  }

  if (!input.userId) return null;

  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      eventType: input.eventType.slice(0, 160),
      severity: input.severity ?? "Info",
      area: (input.area ?? "Security").slice(0, 160),
      title: truncate(input.title, 300),
      detail: input.detail ? truncate(input.detail, 2_000) : null,
      metadataJson: JSON.stringify(metadata),
      ipAddress: input.request
        ? hashForSecurity(getClientIp(input.request))
        : null,
      userAgent: input.request ? getUserAgent(input.request) : null,
    },
  });
}

export function securityFailureResponseBody(message = "Security check failed.") {
  return { error: message, requestBlocked: true };
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");
  if (!name || !domain) return "unknown";
  const visible = name.slice(0, Math.min(2, name.length));
  return `${visible}${"*".repeat(Math.max(2, name.length - visible.length))}@${domain}`;
}