import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import { intelligenceMemoryWindow } from "@/lib/intelligence-forecast/operating-memory";
import { settleForecastHorizon } from "@/lib/intelligence-forecast/settlement";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
  isPotentiallyCrossSiteUnsafeRequest,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_BODY_BYTES = 20_000;

type Body = {
  forecastHorizonId?: unknown;
  observedPrice?: unknown;
  observedAt?: unknown;
  provider?: unknown;
  force?: unknown;
};

function cleanString(value: unknown, maximumLength: number) {
  return typeof value === "string"
    ? value.trim().slice(0, maximumLength)
    : "";
}

export const POST = withApiRoute(
  {
    route: "/api/intelligence/forecast/outcomes",
    timeoutMs: 25_000,
  },
  async ({ request }) => {
    if (isPotentiallyCrossSiteUnsafeRequest(request)) {
      throw new ApiError({
        status: 403,
        code: "CROSS_SITE_FORECAST_SETTLEMENT_BLOCKED",
        message: "Cross-site forecast settlement is not allowed.",
        expose: true,
      });
    }

    const access = await requireCurrentAccessContext({
      requireFirm: true,
    });
    const rate = checkRateLimit({
      key: `forecast-outcomes:${access.user.id}:${hashForSecurity(
        getClientIp(request),
      )}`,
      limit: 20,
      windowMs: 60_000,
    });

    if (!rate.allowed) {
      throw new ApiError({
        status: 429,
        code: "FORECAST_OUTCOMES_RATE_LIMITED",
        message: "Too many settlement requests. Retry shortly.",
        expose: true,
        details: {
          retryAfterSeconds: rate.retryAfterSeconds,
        },
      });
    }

    if (
      !(request.headers.get("content-type") ?? "")
        .toLowerCase()
        .includes("application/json")
    ) {
      throw new ApiError({
        status: 415,
        code: "FORECAST_OUTCOMES_JSON_REQUIRED",
        message: "Use application/json for settlement requests.",
        expose: true,
      });
    }

    const raw = await request.text();

    if (Buffer.byteLength(raw, "utf8") > MAX_BODY_BYTES) {
      throw new ApiError({
        status: 413,
        code: "FORECAST_OUTCOMES_REQUEST_TOO_LARGE",
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
        code: "INVALID_FORECAST_OUTCOMES_JSON",
        message: "Request body must contain valid JSON.",
        expose: true,
      });
    }

    const forecastHorizonId = cleanString(
      body.forecastHorizonId,
      120,
    );
    const observedPrice = Number(body.observedPrice);

    if (!forecastHorizonId) {
      throw new ApiError({
        status: 400,
        code: "FORECAST_HORIZON_ID_REQUIRED",
        message: "forecastHorizonId is required.",
        expose: true,
      });
    }

    if (!Number.isFinite(observedPrice) || observedPrice <= 0) {
      throw new ApiError({
        status: 400,
        code: "INVALID_OBSERVED_PRICE",
        message: "observedPrice must be greater than zero.",
        expose: true,
      });
    }

    const window = intelligenceMemoryWindow({
      days: 30,
    });
    const retainedHorizon =
      await prisma.intelligenceForecastHorizon.findFirst({
        where: {
          id: forecastHorizonId,
          userId: access.user.id,
          forecastRun: {
            generatedAt: {
              gte: new Date(window.startAt),
              lte: new Date(window.endAt),
            },
          },
        },
        select: {
          id: true,
        },
      });

    if (!retainedHorizon) {
      throw new ApiError({
        status: 404,
        code: "FORECAST_HORIZON_NOT_IN_MEMORY",
        message:
          "The selected forecast horizon is not inside the retained operating-memory window.",
        expose: true,
      });
    }

    const forceBeforeTarget =
      process.env.NODE_ENV !== "production" && body.force === true;
    const result = await settleForecastHorizon({
      userId: access.user.id,
      forecastHorizonId,
      observedPrice,
      observedAt:
        cleanString(body.observedAt, 60) || undefined,
      provider:
        cleanString(body.provider, 120) ||
        "Advisor manual observation",
      forceBeforeTarget,
      request,
      raw: {
        source: "Authenticated advisor manual settlement",
        forceBeforeTarget,
      },
    });

    return apiJson({
      ok: true,
      alreadySettled: result.alreadySettled,
      horizon: result.horizon,
      outcome: result.outcome,
      safeguards: {
        manualOverride: true,
        automaticSettlementPreferred: true,
        preTargetOverrideAllowed:
          process.env.NODE_ENV !== "production",
        autonomousTradingEnabled: false,
      },
    });
  },
);