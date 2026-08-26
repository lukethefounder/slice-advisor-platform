import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import {
  auditOperationalWarehouseBatch,
  getOperationalWarehouseOverview,
  intelligenceMemoryWindow,
} from "@/lib/intelligence-forecast/operating-memory";
import { auditForecastEvidenceRun } from "@/lib/intelligence-forecast/point-in-time-warehouse";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BODY_BYTES = 24_000;

type WarehouseBody = {
  action?: unknown;
  runId?: unknown;
  limit?: unknown;
  onlyMissing?: unknown;
  days?: unknown;
};

function cleanString(value: unknown, maximumLength: number) {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function cleanSymbol(value: string | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-:$]/g, "")
    .slice(0, 24);
}

function readLimit(value: unknown, fallback = 50) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(100, Math.round(parsed)))
    : fallback;
}

function enforceRateLimit(input: {
  request: Request;
  userId: string;
  write: boolean;
}) {
  const rate = checkRateLimit({
    key: `forecast-warehouse:${input.write ? "write" : "read"}:${
      input.userId
    }:${hashForSecurity(getClientIp(input.request))}`,
    limit: input.write ? 10 : 100,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    throw new ApiError({
      status: 429,
      code: "FORECAST_WAREHOUSE_RATE_LIMITED",
      message: "Too many evidence-warehouse requests. Retry shortly.",
      expose: true,
      details: {
        retryAfterSeconds: rate.retryAfterSeconds,
      },
    });
  }
}

export const GET = withApiRoute(
  {
    route: "/api/intelligence/forecast/warehouse",
    timeoutMs: 40_000,
  },
  async ({ request }) => {
    const access = await requireCurrentAccessContext({
      requireFirm: true,
    });
    enforceRateLimit({
      request,
      userId: access.user.id,
      write: false,
    });

    const url = new URL(request.url);
    const overview = await getOperationalWarehouseOverview({
      userId: access.user.id,
      symbol: cleanSymbol(url.searchParams.get("symbol")),
      days: url.searchParams.get("days"),
      limit: readLimit(url.searchParams.get("limit")),
    });

    return apiJson({
      ok: true,
      ...overview,
    });
  },
);

export const POST = withApiRoute(
  {
    route: "/api/intelligence/forecast/warehouse",
    timeoutMs: 118_000,
  },
  async ({ request }) => {
    if (isPotentiallyCrossSiteUnsafeRequest(request)) {
      throw new ApiError({
        status: 403,
        code: "CROSS_SITE_WAREHOUSE_BLOCKED",
        message: "Cross-site evidence-warehouse actions are not allowed.",
        expose: true,
      });
    }

    const access = await requireCurrentAccessContext({
      requireFirm: true,
    });
    enforceRateLimit({
      request,
      userId: access.user.id,
      write: true,
    });

    if (
      !(request.headers.get("content-type") ?? "")
        .toLowerCase()
        .includes("application/json")
    ) {
      throw new ApiError({
        status: 415,
        code: "WAREHOUSE_JSON_REQUIRED",
        message: "Use application/json for warehouse actions.",
        expose: true,
      });
    }

    const raw = await request.text();

    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      throw new ApiError({
        status: 413,
        code: "WAREHOUSE_REQUEST_TOO_LARGE",
        message: `Request body may not exceed ${MAX_BODY_BYTES} bytes.`,
        expose: true,
      });
    }

    let body: WarehouseBody;

    try {
      body = JSON.parse(raw || "{}") as WarehouseBody;
    } catch {
      throw new ApiError({
        status: 400,
        code: "INVALID_WAREHOUSE_JSON",
        message: "Request body must contain valid JSON.",
        expose: true,
      });
    }

    const action = cleanString(body.action, 50);

    if (action === "audit-run") {
      const runId = cleanString(body.runId, 120);

      if (!runId) {
        throw new ApiError({
          status: 400,
          code: "WAREHOUSE_RUN_ID_REQUIRED",
          message: "runId is required for audit-run.",
          expose: true,
        });
      }

      const window = intelligenceMemoryWindow({
        days: body.days,
      });
      const run = await prisma.intelligenceForecastRun.findFirst({
        where: {
          id: runId,
          userId: access.user.id,
          generatedAt: {
            gte: new Date(window.startAt),
            lte: new Date(window.endAt),
          },
        },
        select: {
          id: true,
        },
      });

      if (!run) {
        throw new ApiError({
          status: 404,
          code: "WAREHOUSE_RUN_NOT_IN_MEMORY",
          message:
            "The selected forecast run is not inside the retained operating-memory window.",
          expose: true,
        });
      }

      const result = await auditForecastEvidenceRun({
        userId: access.user.id,
        runId,
        request,
      });

      return apiJson({
        ok: true,
        action,
        ...result,
        window,
        autonomousTradingEnabled: false,
      });
    }

    if (action === "audit-batch" || !action) {
      const result = await auditOperationalWarehouseBatch({
        userId: access.user.id,
        days: body.days,
        limit: readLimit(body.limit),
        onlyMissing: body.onlyMissing !== false,
      });

      return apiJson({
        ok: true,
        action: "audit-batch",
        ...result,
        autonomousTradingEnabled: false,
      });
    }

    throw new ApiError({
      status: 400,
      code: "UNSUPPORTED_WAREHOUSE_ACTION",
      message: "Supported actions are audit-run and audit-batch.",
      expose: true,
    });
  },
);