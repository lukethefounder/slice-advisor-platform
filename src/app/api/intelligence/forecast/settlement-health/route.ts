import {
  NextResponse,
} from "next/server";

import {
  getCurrentUser,
} from "@/lib/auth";

import {
  prisma,
} from "@/lib/prisma";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export async function GET() {
  const user =
    await getCurrentUser();

  if (!user) {
    return NextResponse.json(
      {
        error:
          "Unauthorized.",
      },
      {
        status: 401,
      },
    );
  }

  const now =
    new Date();

  const [
    totalRuns,
    pendingDue,
    pendingFuture,
    settledHorizons,
    partiallySettledRuns,
    fullySettledRuns,
    oldestDue,
    recentOutcomes,
  ] =
    await Promise.all([
      prisma.intelligenceForecastRun.count({
        where: {
          userId:
            user.id,
        },
      }),

      prisma.intelligenceForecastHorizon.count({
        where: {
          userId:
            user.id,

          status:
            "Pending",

          targetAt: {
            lte: now,
          },
        },
      }),

      prisma.intelligenceForecastHorizon.count({
        where: {
          userId:
            user.id,

          status:
            "Pending",

          targetAt: {
            gt: now,
          },
        },
      }),

      prisma.intelligenceForecastHorizon.count({
        where: {
          userId:
            user.id,

          status:
            "Settled",
        },
      }),

      prisma.intelligenceForecastRun.count({
        where: {
          userId:
            user.id,

          status:
            "Partially Settled",
        },
      }),

      prisma.intelligenceForecastRun.count({
        where: {
          userId:
            user.id,

          status:
            "Settled",
        },
      }),

      prisma.intelligenceForecastHorizon.findFirst({
        where: {
          userId:
            user.id,

          status:
            "Pending",

          targetAt: {
            lte: now,
          },
        },

        orderBy: {
          targetAt:
            "asc",
        },

        select: {
          id: true,
          symbol: true,
          horizon: true,
          label: true,
          targetAt: true,
        },
      }),

      prisma.intelligenceForecastOutcome.findMany({
        where: {
          userId:
            user.id,
        },

        orderBy: {
          observedAt:
            "desc",
        },

        take: 250,

        select: {
          priceProvider:
            true,

          observedAt:
            true,

          directionalCorrect:
            true,

          intervalCovered:
            true,
        },
      }),
    ]);

  const providerCounts =
    new Map<
      string,
      number
    >();

  for (
    const outcome of
      recentOutcomes
  ) {
    providerCounts.set(
      outcome.priceProvider,
      (
        providerCounts.get(
          outcome.priceProvider,
        ) ?? 0
      ) + 1,
    );
  }

  return NextResponse.json(
    {
      ok: true,

      generatedAt:
        now.toISOString(),

      configuration: {
        alphaVantageConfigured:
          Boolean(
            process.env
              .ALPHA_VANTAGE_API_KEY,
          ),

        cronSecretConfigured:
          Boolean(
            process.env
              .CRON_SECRET,
          ),

        autonomousTradingEnabled:
          false,
      },

      counts: {
        totalRuns,
        pendingDue,
        pendingFuture,
        settledHorizons,
        partiallySettledRuns,
        fullySettledRuns,
      },

      oldestDue,

      recentSettlementProviders:
        Array.from(
          providerCounts.entries(),
        )
          .map(
            ([provider, count]) => ({
              provider,
              count,
            }),
          )
          .sort(
            (left, right) =>
              right.count -
              left.count,
          ),

      status:
        pendingDue === 0
          ? "Healthy"
          : pendingDue <= 10
            ? "Settlement backlog present"
            : "Settlement backlog elevated",
    },
    {
      status: 200,

      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}