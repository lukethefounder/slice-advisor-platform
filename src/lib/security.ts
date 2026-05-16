import { createHash, randomBytes, timingSafeEqual } from "crypto";
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
};

const memoryRateBuckets = new Map<string, RateBucket>();

const SENSITIVE_KEYS = [
  "password",
  "token",
  "secret",
  "apiKey",
  "authorization",
  "cookie",
  "session",
  "passwordHash",
];

export function securityId(prefix = "sec") {
  return `${prefix}_${randomBytes(16).toString("hex")}`;
}

export function getClientIp(request: Request) {
  const forwardedFor = request.headers.get("x-forwarded-for");
  const realIp = request.headers.get("x-real-ip");
  const cfConnectingIp = request.headers.get("cf-connecting-ip");

  if (cfConnectingIp) return cfConnectingIp.trim();

  if (forwardedFor) {
    return forwardedFor.split(",")[0]?.trim() || "unknown";
  }

  if (realIp) return realIp.trim();

  return "unknown";
}

export function getUserAgent(request: Request) {
  return request.headers.get("user-agent") || "unknown";
}

export function hashForSecurity(value: string) {
  const pepper = process.env.SECURITY_PEPPER || process.env.NEXTAUTH_SECRET || "slice-local-security-pepper";

  return createHash("sha256").update(`${pepper}:${value}`).digest("hex");
}

export function constantTimeEqual(left: string, right: string) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);

  if (leftBuffer.length !== rightBuffer.length) return false;

  return timingSafeEqual(leftBuffer, rightBuffer);
}

export function redactSecurityMetadata(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(redactSecurityMetadata);
  }

  if (value && typeof value === "object") {
    const clean: Record<string, unknown> = {};

    for (const [key, item] of Object.entries(value)) {
      const lower = key.toLowerCase();

      if (SENSITIVE_KEYS.some((sensitive) => lower.includes(sensitive.toLowerCase()))) {
        clean[key] = "[REDACTED]";
      } else {
        clean[key] = redactSecurityMetadata(item);
      }
    }

    return clean;
  }

  return value;
}

export function checkRateLimit(input: RateLimitInput): RateLimitResult {
  const now = Date.now();
  const existing = memoryRateBuckets.get(input.key);

  if (!existing || existing.resetAt <= now) {
    const resetAt = now + input.windowMs;

    memoryRateBuckets.set(input.key, {
      count: 1,
      resetAt,
    });

    return {
      allowed: true,
      key: input.key,
      limit: input.limit,
      remaining: Math.max(0, input.limit - 1),
      resetAt: new Date(resetAt),
      retryAfterSeconds: 0,
    };
  }

  existing.count += 1;
  memoryRateBuckets.set(input.key, existing);

  const remaining = Math.max(0, input.limit - existing.count);
  const retryAfterSeconds = Math.max(1, Math.ceil((existing.resetAt - now) / 1000));

  return {
    allowed: existing.count <= input.limit,
    key: input.key,
    limit: input.limit,
    remaining,
    resetAt: new Date(existing.resetAt),
    retryAfterSeconds,
  };
}

export function isPotentiallyCrossSiteUnsafeRequest(request: Request) {
  const method = request.method.toUpperCase();

  if (!["POST", "PUT", "PATCH", "DELETE"].includes(method)) {
    return false;
  }

  const secFetchSite = request.headers.get("sec-fetch-site");

  if (secFetchSite === "cross-site") {
    return true;
  }

  const origin = request.headers.get("origin");
  const host = request.headers.get("host");

  if (!origin || !host) {
    return false;
  }

  try {
    const originUrl = new URL(origin);
    return originUrl.host !== host;
  } catch {
    return true;
  }
}

export function buildSecurityMetadata(request: Request, extra: Record<string, unknown> = {}) {
  return redactSecurityMetadata({
    requestId: securityId("request"),
    ipHash: hashForSecurity(getClientIp(request)),
    userAgent: getUserAgent(request),
    method: request.method,
    url: request.url,
    secFetchSite: request.headers.get("sec-fetch-site"),
    origin: request.headers.get("origin"),
    referer: request.headers.get("referer"),
    ...extra,
  }) as Record<string, unknown>;
}

export async function recordSecurityEvent(input: SecurityEventInput) {
  const metadata = input.request
    ? buildSecurityMetadata(input.request, input.metadata ?? {})
    : (redactSecurityMetadata(input.metadata ?? {}) as Record<string, unknown>);

  if (!input.userId) {
    if (process.env.NODE_ENV !== "production") {
      console.warn("[Slice Security Event]", {
        eventType: input.eventType,
        severity: input.severity ?? "Info",
        area: input.area ?? "Security",
        title: input.title,
        detail: input.detail,
        metadata,
      });
    }

    return null;
  }

  return prisma.auditLog.create({
    data: {
      userId: input.userId,
      eventType: input.eventType,
      severity: input.severity ?? "Info",
      area: input.area ?? "Security",
      title: input.title,
      detail: input.detail,
      metadataJson: JSON.stringify(metadata),
      ipAddress: input.request ? hashForSecurity(getClientIp(input.request)) : null,
      userAgent: input.request ? getUserAgent(input.request).slice(0, 500) : null,
    },
  });
}

export function securityFailureResponseBody(message = "Security check failed.") {
  return {
    error: message,
    requestBlocked: true,
  };
}

export function maskEmail(email: string) {
  const [name, domain] = email.split("@");

  if (!name || !domain) return "unknown";

  const visible = name.slice(0, 2);
  return `${visible}${"*".repeat(Math.max(2, name.length - 2))}@${domain}`;
}