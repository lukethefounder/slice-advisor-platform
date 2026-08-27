import { ApiError, apiJson, withApiRoute } from "@/lib/api-route";
import { requireCurrentAccessContext } from "@/lib/access-control";
import {
  getIntelligenceOperatingMemory,
  getOperationalCalibration,
  intelligenceMemoryWindow,
} from "@/lib/intelligence-forecast/operating-memory";
import { prisma } from "@/lib/prisma";
import {
  checkRateLimit,
  getClientIp,
  hashForSecurity,
} from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function limit(value: string | null) {
  const parsed = Number(value);

  return Number.isFinite(parsed)
    ? Math.max(1, Math.min(100, Math.round(parsed)))
    : 50;
}

function symbol(value: string | null) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9.\-:$]/g, "")
    .slice(0, 24);
}

export const GET = withApiRoute(
  {
    route: "/api/intelligence/forecast/history",
    timeoutMs: 30_000,
  },
  async ({ request }) => {
    const access = await requireCurrentAccessContext({
      requireFirm: true,
    });
    const rate = checkRateLimit({
      key: `forecast-history:${access.user.id}:${hashForSecurity(
        getClientIp(request),
      )}`,
      limit: 120,
      windowMs: 60_000,
    });

    if (!rate.allowed) {
      throw new ApiError({
        status: 429,
        code: "FORECAST_HISTORY_RATE_LIMITED",
        message: "Too many forecast-history requests. Retry shortly.",
        expose: true,
        details: {
          retryAfterSeconds: rate.retryAfterSeconds,
        },
      });
    }

    const url = new URL(request.url);
    const selectedSymbol = symbol(url.searchParams.get("symbol"));
    const take = limit(url.searchParams.get("limit"));
    const window = intelligenceMemoryWindow({
      days: url.searchParams.get("days"),
    });
    const where = {
      userId: access.user.id,
      generatedAt: {
        gte: new Date(window.startAt),
        lte: new Date(window.endAt),
      },
      ...(selectedSymbol ? { symbol: selectedSymbol } : {}),
    };
    const [
      runs,
      totalRuns,
      pendingHorizons,
      dueHorizons,
      settledHorizons,
      calibration,
      memory,
    ] = await Promise.all([
      prisma.intelligenceForecastRun.findMany({
        where,
        orderBy: {
          generatedAt: "desc",
        },
        take,
        select: {
          id: true,
          requestId: true,
          symbol: true,
          asOfAt: true,
          generatedAt: true,
          engineVersion: true,
          modelVersion: true,
          calibrationVersion: true,
          marketRegime: true,
          sliceSentimentScore: true,
          dataQualityScore: true,
          sourceCount: true,
          independentSourceCount: true,
          simulationPaths: true,
          camelStatus: true,
          camelWorkforceMode: true,
          status: true,
          horizons: {
            orderBy: {
              targetAt: "asc",
            },
            select: {
              id: true,
              horizon: true,
              label: true,
              targetAt: true,
              initialPrice: true,
              direction: true,
              positiveReturnProbability: true,
              expectedReturnPercent: true,
              expectedPrice: true,
              priceRangeLow: true,
              priceRangeHigh: true,
              volatilityPercent: true,
              confidence: true,
              modelAgreement: true,
              simulationAgreement: true,
              dataQuality: true,
              primaryUncertainty: true,
              status: true,
              outcome: {
                select: {
                  id: true,
                  observedAt: true,
                  providerTimestamp: true,
                  initialPrice: true,
                  observedPrice: true,
                  realizedReturnPercent: true,
                  positiveOutcome: true,
                  brierScore: true,
                  logLoss: true,
                  intervalCovered: true,
                  directionalCorrect: true,
                  absoluteReturnError: true,
                  priceProvider: true,
                },
              },
            },
          },
        },
      }),
      prisma.intelligenceForecastRun.count({
        where,
      }),
      prisma.intelligenceForecastHorizon.count({
        where: {
          userId: access.user.id,
          status: "Pending",
          forecastRun: {
            generatedAt: {
              gte: new Date(window.startAt),
              lte: new Date(window.endAt),
            },
            ...(selectedSymbol ? { symbol: selectedSymbol } : {}),
          },
        },
      }),
      prisma.intelligenceForecastHorizon.count({
        where: {
          userId: access.user.id,
          status: "Pending",
          targetAt: {
            lte: new Date(window.endAt),
          },
          forecastRun: {
            generatedAt: {
              gte: new Date(window.startAt),
              lte: new Date(window.endAt),
            },
            ...(selectedSymbol ? { symbol: selectedSymbol } : {}),
          },
        },
      }),
      prisma.intelligenceForecastHorizon.count({
        where: {
          userId: access.user.id,
          status: "Settled",
          forecastRun: {
            generatedAt: {
              gte: new Date(window.startAt),
              lte: new Date(window.endAt),
            },
            ...(selectedSymbol ? { symbol: selectedSymbol } : {}),
          },
        },
      }),
      getOperationalCalibration({
        userId: access.user.id,
        days: window.days,
        symbol: selectedSymbol,
      }),
      getIntelligenceOperatingMemory({
        userId: access.user.id,
        symbol: selectedSymbol,
        days: window.days,
        limit: take,
      }),
    ]);

    return apiJson({
      ok: true,
      generatedAt: new Date().toISOString(),
      window,
      filters: {
        symbol: selectedSymbol || null,
        limit: take,
      },
      summary: {
        totalRuns,
        returnedRuns: runs.length,
        pendingHorizons,
        dueHorizons,
        settledHorizons,
        settledOutcomes: calibration.overall.sampleCount,
      },
      automaticSettlement: {
        enabled: true,
        cadence: "Every 10 minutes",
        providerOrder: [
          "Stored verified price near target",
          "Historical market-price resolver",
          "Live non-demo quote within horizon tolerance",
        ],
        demoPricesAccepted: false,
        preTargetPricesAccepted: false,
      },
      calibration,
      memory,
      runs,
    });
  },
);