import { NextResponse } from "next/server";

import { getCurrentUser } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

function readLimit(
  value: string | null,
) {
  const parsed =
    Number(value);

  if (!Number.isFinite(parsed)) {
    return 25;
  }

  return Math.max(
    1,
    Math.min(
      100,
      Math.round(parsed),
    ),
  );
}

function cleanSymbol(
  value: string | null,
) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(
      /[^A-Z0-9.\-:$]/g,
      "",
    )
    .slice(0, 20);
}

export async function GET(
  request: Request,
) {
  const user =
    await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error: "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  const url =
    new URL(request.url);

  const symbol =
    cleanSymbol(
      url.searchParams.get(
        "symbol",
      ),
    );

  const limit =
    readLimit(
      url.searchParams.get(
        "limit",
      ),
    );

  const runs =
    await prisma.intelligenceForecastRun.findMany({
      where: {
        userId:
          user.id,

        ...(symbol
          ? {
              symbol,
            }
          : {}),
      },

      orderBy: {
        generatedAt:
          "desc",
      },

      take: limit,

      select: {
        id: true,
        requestId: true,
        symbol: true,
        asOfAt: true,
        generatedAt: true,
        engineVersion: true,
        modelVersion: true,
        calibrationVersion:
          true,
        marketRegime: true,
        sliceSentimentScore:
          true,
        dataQualityScore:
          true,
        sourceCount: true,
        independentSourceCount:
          true,
        simulationPaths: true,
        camelStatus: true,
        camelWorkforceMode:
          true,
        status: true,

        horizons: {
          orderBy: {
            targetAt:
              "asc",
          },

          select: {
            id: true,
            horizon: true,
            label: true,
            targetAt: true,
            initialPrice: true,
            direction: true,
            positiveReturnProbability:
              true,
            expectedReturnPercent:
              true,
            expectedPrice: true,
            priceRangeLow: true,
            priceRangeHigh: true,
            volatilityPercent:
              true,
            confidence: true,
            modelAgreement: true,
            simulationAgreement:
              true,
            dataQuality: true,
            primaryUncertainty:
              true,
            status: true,

            outcome: {
              select: {
                id: true,
                observedAt: true,
                initialPrice: true,
                observedPrice: true,
                realizedReturnPercent:
                  true,
                positiveOutcome:
                  true,
                brierScore: true,
                logLoss: true,
                intervalCovered:
                  true,
                directionalCorrect:
                  true,
                absoluteReturnError:
                  true,
                priceProvider:
                  true,
              },
            },
          },
        },
      },
    });

  const totalRuns =
    await prisma.intelligenceForecastRun.count({
      where: {
        userId:
          user.id,

        ...(symbol
          ? {
              symbol,
            }
          : {}),
      },
    });

  const pendingHorizons =
    await prisma.intelligenceForecastHorizon.count({
      where: {
        userId:
          user.id,

        status: "Pending",

        ...(symbol
          ? {
              symbol,
            }
          : {}),
      },
    });

  const settledHorizons =
    await prisma.intelligenceForecastHorizon.count({
      where: {
        userId:
          user.id,

        status: "Settled",

        ...(symbol
          ? {
              symbol,
            }
          : {}),
      },
    });

  return NextResponse.json(
    {
      ok: true,

      generatedAt:
        new Date().toISOString(),

      filters: {
        symbol:
          symbol || null,
        limit,
      },

      summary: {
        totalRuns,
        returnedRuns:
          runs.length,
        pendingHorizons,
        settledHorizons,
      },

      runs,
    },

    {
      status: 200,

      headers: {
        "Cache-Control":
          "no-store, max-age=0",
      },
    },
  );
}