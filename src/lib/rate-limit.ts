import "server-only";

import { createHmac } from "node:crypto";

import { Prisma } from "@/generated/prisma/client";
import { ApiError } from "@/lib/api-route";
import { createLogger } from "@/lib/logger";
import { prisma } from "@/lib/prisma";
import { checkRateLimit } from "@/lib/security";

export type DistributedRateLimitResult = {
  allowed: boolean;
  keyHash: string;
  scope: string;
  limit: number;
  count: number;
  remaining: number;
  resetAt: Date;
  retryAfterSeconds: number;
  source: "postgresql" | "memory-fallback";
  degraded: boolean;
};

type ConsumeRateLimitInput = {
  key: string;
  scope: string;
  limit: number;
  windowMs: number;
  failOpen?: boolean;
};

type BucketRow = {
  keyHash: string;
  scope: string;
  count: number;
  limit: number;
  resetAt: Date;
};

const rateLog = createLogger("rate-limit");

function secret() {
  const value =
    String(process.env.SECURITY_PEPPER ?? "").trim() ||
    String(process.env.SLICE_SECRET_ENCRYPTION_KEY ?? "").trim() ||
    String(process.env.NEXTAUTH_SECRET ?? "").trim();

  if (!value && process.env.NODE_ENV === "production") {
    throw new ApiError({
      status: 503,
      code: "SECURITY_CONFIGURATION_MISSING",
      message: "The security rate limiter is not configured.",
      expose: true,
    });
  }

  return value || "slice-local-rate-limit-secret";
}

function normalizedInteger(
  value: number,
  minimum: number,
  maximum: number,
  label: string,
) {
  if (!Number.isInteger(value) || value < minimum || value > maximum) {
    throw new ApiError({
      status: 500,
      code: "RATE_LIMIT_CONFIGURATION_INVALID",
      message: `${label} is outside the supported range.`,
      expose: false,
    });
  }

  return value;
}

function keyHash(scope: string, key: string) {
  return createHmac("sha256", secret())
    .update(`${scope}:${key}`)
    .digest("hex");
}

function booleanEnvironment(name: string, fallback = false) {
  const value = String(process.env[name] ?? "").trim().toLowerCase();
  if (["1", "true", "yes", "on"].includes(value)) return true;
  if (["0", "false", "no", "off"].includes(value)) return false;
  return fallback;
}

function resultFromRow(row: BucketRow): DistributedRateLimitResult {
  const now = Date.now();
  return {
    allowed: row.count <= row.limit,
    keyHash: row.keyHash,
    scope: row.scope,
    limit: row.limit,
    count: row.count,
    remaining: Math.max(0, row.limit - row.count),
    resetAt: row.resetAt,
    retryAfterSeconds:
      row.count <= row.limit
        ? 0
        : Math.max(1, Math.ceil((row.resetAt.getTime() - now) / 1_000)),
    source: "postgresql",
    degraded: false,
  };
}

export async function consumeRateLimit(
  input: ConsumeRateLimitInput,
): Promise<DistributedRateLimitResult> {
  const limit = normalizedInteger(input.limit, 1, 100_000, "Rate limit");
  const windowMs = normalizedInteger(
    input.windowMs,
    1_000,
    30 * 24 * 60 * 60_000,
    "Rate-limit window",
  );
  const scope = String(input.scope).trim().slice(0, 120) || "general";
  const rawKey = String(input.key).trim().slice(0, 1_000);
  const digest = keyHash(scope, rawKey);
  const now = new Date();
  const resetAt = new Date(now.getTime() + windowMs);

  try {
    const rows = await prisma.$queryRaw<BucketRow[]>(Prisma.sql`
      INSERT INTO "SecurityRateLimitBucket"
        ("keyHash", "scope", "count", "limit", "resetAt", "createdAt", "updatedAt")
      VALUES
        (${digest}, ${scope}, 1, ${limit}, ${resetAt}, ${now}, ${now})
      ON CONFLICT ("keyHash") DO UPDATE SET
        "scope" = EXCLUDED."scope",
        "limit" = EXCLUDED."limit",
        "count" = CASE
          WHEN "SecurityRateLimitBucket"."resetAt" <= ${now} THEN 1
          ELSE "SecurityRateLimitBucket"."count" + 1
        END,
        "resetAt" = CASE
          WHEN "SecurityRateLimitBucket"."resetAt" <= ${now} THEN ${resetAt}
          ELSE "SecurityRateLimitBucket"."resetAt"
        END,
        "updatedAt" = ${now}
      RETURNING "keyHash", "scope", "count", "limit", "resetAt"
    `);
    const row = rows[0];

    if (!row) throw new Error("Rate-limit update returned no row.");
    return resultFromRow(row);
  } catch (error) {
    const failOpen =
      input.failOpen ??
      booleanEnvironment("SECURITY_RATE_LIMIT_FAIL_OPEN", false);

    rateLog.error("distributed.failed", error, { scope, failOpen });

    if (process.env.NODE_ENV !== "production" || failOpen) {
      const fallback = checkRateLimit({
        key: `${scope}:${rawKey}`,
        limit,
        windowMs,
      });

      return {
        allowed: fallback.allowed,
        keyHash: digest,
        scope,
        limit,
        count: Math.max(0, limit - fallback.remaining),
        remaining: fallback.remaining,
        resetAt: fallback.resetAt,
        retryAfterSeconds: fallback.retryAfterSeconds,
        source: "memory-fallback",
        degraded: true,
      };
    }

    throw new ApiError({
      status: 503,
      code: "RATE_LIMIT_SERVICE_UNAVAILABLE",
      message: "The request cannot be safely processed right now. Try again shortly.",
      expose: true,
      cause: error,
    });
  }
}

export function rateLimitHeaders(result: DistributedRateLimitResult) {
  return {
    "RateLimit-Limit": String(result.limit),
    "RateLimit-Remaining": String(result.remaining),
    "RateLimit-Reset": String(Math.ceil(result.resetAt.getTime() / 1_000)),
    ...(result.retryAfterSeconds > 0
      ? { "Retry-After": String(result.retryAfterSeconds) }
      : {}),
  };
}

export async function resetRateLimit(input: { key: string; scope: string }) {
  const digest = keyHash(input.scope, input.key);
  await prisma.securityRateLimitBucket
    .delete({ where: { keyHash: digest } })
    .catch(() => null);
}

export async function pruneRateLimitBuckets(before = new Date()) {
  return prisma.securityRateLimitBucket.deleteMany({
    where: { resetAt: { lt: before } },
  });
}