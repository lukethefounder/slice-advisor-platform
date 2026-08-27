import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import {
  getModelGovernanceOverview,
  runStoredPointInTimeBacktest,
} from "@/lib/intelligence-forecast/model-governance";
import { getIntelligenceOperatingMemory } from "@/lib/intelligence-forecast/operating-memory";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

const MAX_BODY_BYTES = 20_000;

type Body = {
  modelVersion?: unknown;
};

function cleanString(value: unknown, maximumLength = 220) {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

function enforceRateLimit(input: {
  request: Request;
  userId: string;
  write: boolean;
}) {
  const rate = checkRateLimit({
    key: `forecast-backtest:${input.write ? "write" : "read"}:${
      input.userId
    }:${hashForSecurity(getClientIp(input.request))}`,
    limit: input.write ? 6 : 90,
    windowMs: 60_000,
  });

  if (!rate.allowed) {
    throw new ApiError({
      status: 429,
      code: "FORECAST_BACKTEST_RATE_LIMITED",
      message: "Too many model-validation requests. Retry shortly.",
      expose: true,
      details: {
        retryAfterSeconds: rate.retryAfterSeconds,
      },
    });
  }
}

export const GET = withApiRoute(
  {
    route: "/api/intelligence/forecast/backtest",
    timeoutMs: 35_000,
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

    const days = new URL(request.url).searchParams.get("days");
    const [overview, memory] = await Promise.all([
      getModelGovernanceOverview(access.user.id),
      getIntelligenceOperatingMemory({
        userId: access.user.id,
        days,
        limit: 50,
      }),
    ]);

    return apiJson({
      ok: true,
      ...overview,
      memory,
      operatingPolicy: {
        memoryWindow: memory.window,
        validationDataset:
          "All eligible settled, non-demo, point-in-time-safe outcomes remain available to governed model validation.",
        recentOperatingState:
          "The interface and drift review emphasize the retained 30-day operating-memory window.",
      },
    });
  },
);

export const POST = withApiRoute(
  {
    route: "/api/intelligence/forecast/backtest",
    timeoutMs: 118_000,
  },
  async ({ request }) => {
    if (isPotentiallyCrossSiteUnsafeRequest(request)) {
      throw new ApiError({
        status: 403,
        code: "CROSS_SITE_BACKTEST_BLOCKED",
        message: "Cross-site model validation is not allowed.",
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
        code: "BACKTEST_JSON_REQUIRED",
        message: "Use application/json for model validation.",
        expose: true,
      });
    }

    const raw = await request.text();

    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      throw new ApiError({
        status: 413,
        code: "BACKTEST_REQUEST_TOO_LARGE",
        message: `Request body may not exceed ${MAX_BODY_BYTES} bytes.`,
        expose: true,
      });
    }

    let body: Body;

    try {
      body = JSON.parse(raw || "{}") as Body;
    } catch {
      throw new ApiError({
        status: 400,
        code: "INVALID_BACKTEST_JSON",
        message: "Request body must contain valid JSON.",
        expose: true,
      });
    }

    const modelVersion = cleanString(body.modelVersion);

    if (!modelVersion) {
      throw new ApiError({
        status: 400,
        code: "MODEL_VERSION_REQUIRED",
        message: "modelVersion is required.",
        expose: true,
      });
    }

    const result = await runStoredPointInTimeBacktest({
      userId: access.user.id,
      modelVersion,
      request,
    });
    const memory = await getIntelligenceOperatingMemory({
      userId: access.user.id,
      days: 30,
      limit: 50,
    });

    return apiJson({
      ok: true,
      ...result,
      memory,
      message:
        "Chronological point-in-time validation completed and was retained in model-governance memory.",
    });
  },
);