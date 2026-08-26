import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import { getOperationalCalibration } from "@/lib/intelligence-forecast/operating-memory";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function symbol(value: string | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-:$]/g, "")
    .slice(0, 24);
}

export const GET = withApiRoute(
  {
    route: "/api/intelligence/forecast/calibration",
    timeoutMs: 20_000,
  },
  async ({ request }) => {
    const access = await requireCurrentAccessContext({
      requireFirm: true,
    });
    const rate = checkRateLimit({
      key: `forecast-calibration:${access.user.id}:${hashForSecurity(
        getClientIp(request),
      )}`,
      limit: 120,
      windowMs: 60_000,
    });

    if (!rate.allowed) {
      throw new ApiError({
        status: 429,
        code: "FORECAST_CALIBRATION_RATE_LIMITED",
        message: "Too many calibration requests. Retry shortly.",
        expose: true,
        details: {
          retryAfterSeconds: rate.retryAfterSeconds,
        },
      });
    }

    const url = new URL(request.url);
    const calibration = await getOperationalCalibration({
      userId: access.user.id,
      days: url.searchParams.get("days"),
      symbol: symbol(url.searchParams.get("symbol")),
    });

    return apiJson({
      ok: true,
      ...calibration,
      definitions: {
        brierScore:
          "Probability accuracy score. Lower is better and zero is perfect.",
        logLoss:
          "Penalizes highly confident incorrect probabilities. Lower is better.",
        intervalCoveragePercent:
          "Percent of observed prices that landed inside the forecast interval.",
        directionalAccuracyPercent:
          "Percent of bullish, bearish, or neutral classifications that were correct.",
        meanAbsoluteReturnError:
          "Average absolute difference between expected return and realized return.",
        reliability:
          "Compares forecast probability with the observed frequency of positive outcomes.",
      },
    });
  },
);