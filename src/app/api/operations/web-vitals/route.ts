import { Prisma } from "@/generated/prisma/client";
import { apiJson, withApiRoute } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { consumeRateLimit, rateLimitHeaders } from "@/lib/rate-limit";
import { getClientIp, hashForSecurity } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 8_192;
const METRICS = new Set(["CLS", "FCP", "INP", "LCP", "TTFB"]);
const RATINGS = new Set(["good", "needs-improvement", "poor"]);

function clean(value: unknown, maximum: number) {
  return typeof value === "string"
    ? value.replace(/\u0000/g, "").trim().slice(0, maximum)
    : "";
}

function normalizedRoute(value: unknown) {
  const route = clean(value, 500).split("?")[0] || "/";

  return route
    .split("/")
    .map((segment) =>
      /^(?:c[a-z0-9]{20,}|[0-9a-f]{8,}|[A-Za-z0-9_-]{32,})$/i.test(segment)
        ? ":id"
        : segment.slice(0, 80),
    )
    .join("/")
    .slice(0, 300);
}

function numericValue(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 10_000_000
    ? parsed
    : null;
}

export const POST = withApiRoute(
  {
    route: "/api/operations/web-vitals",
    timeoutMs: 8_000,
  },
  async ({ request }) => {
    const raw = await request.text();

    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      return apiJson({ error: "Metric payload is too large." }, { status: 413 });
    }

    let body: Record<string, unknown>;

    try {
      body = JSON.parse(raw || "{}") as Record<string, unknown>;
    } catch {
      return apiJson({ error: "Metric payload must be valid JSON." }, { status: 400 });
    }

    const name = clean(body.name, 12).toUpperCase();
    const value = numericValue(body.value);
    const metricId = clean(body.metricId, 160);
    const rating = clean(body.rating, 40).toLowerCase();

    if (!METRICS.has(name) || value === null || !metricId) {
      return apiJson({ error: "Metric payload is invalid." }, { status: 400 });
    }

    const limit = await consumeRateLimit({
      key: hashForSecurity(getClientIp(request)),
      scope: "web-vitals.ingest",
      limit: 180,
      windowMs: 60 * 60_000,
      failOpen: true,
    });

    if (!limit.allowed) {
      return apiJson(
        { error: "Metric rate limit exceeded." },
        { status: 429, headers: rateLimitHeaders(limit) },
      );
    }

    const session = clean(body.sessionId, 200);
    const route = normalizedRoute(body.route);
    const deploymentId =
      process.env.VERCEL_DEPLOYMENT_ID ||
      process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 40) ||
      null;

    try {
      await prisma.webVitalSample.upsert({
        where: {
          metricId_name: {
            metricId,
            name,
          },
        },
        update: {
          value,
          rating: RATINGS.has(rating) ? rating : "unknown",
          route,
          navigationType: clean(body.navigationType, 80) || null,
          sessionHash: session ? hashForSecurity(session) : null,
          deviceClass: clean(body.deviceClass, 40) || null,
          connectionType: clean(body.connectionType, 40) || null,
          environment:
            process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
          deploymentId,
        },
        create: {
          metricId,
          name,
          value,
          rating: RATINGS.has(rating) ? rating : "unknown",
          route,
          navigationType: clean(body.navigationType, 80) || null,
          sessionHash: session ? hashForSecurity(session) : null,
          deviceClass: clean(body.deviceClass, 40) || null,
          connectionType: clean(body.connectionType, 40) || null,
          environment:
            process.env.VERCEL_ENV || process.env.NODE_ENV || "unknown",
          deploymentId,
        },
      });
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === "P2002"
      ) {
        return new Response(null, {
          status: 202,
          headers: rateLimitHeaders(limit),
        });
      }
      throw error;
    }

    return new Response(null, {
      status: 202,
      headers: rateLimitHeaders(limit),
    });
  },
);