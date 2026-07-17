import {
  NextResponse,
} from "next/server";

import {
  generateEnsembleForRun,
  trainEnsembleSuite,
} from "@/lib/intelligence-forecast/ensemble-optimization";

import {
  prisma,
} from "@/lib/prisma";

export const dynamic =
  "force-dynamic";

export const runtime =
  "nodejs";

export const maxDuration =
  120;

function isVercelCronRequest(
  request: Request,
) {
  const userAgent =
    request.headers.get(
      "user-agent",
    ) ??
    "";

  return userAgent.includes(
    "vercel-cron/1.0",
  );
}

function isAuthorized(
  request: Request,
) {
  const secret =
    process.env
      .CRON_SECRET;

  const authorization =
    request.headers.get(
      "authorization",
    ) ??
    "";

  const secretHeader =
    request.headers.get(
      "x-cron-secret",
    ) ??
    "";

  if (
    isVercelCronRequest(
      request,
    )
  ) {
    return true;
  }

  if (
    secret &&
    (
      authorization ===
        `Bearer ${secret}` ||
      secretHeader ===
        secret
    )
  ) {
    return true;
  }

  return (
    process.env
      .NODE_ENV !==
    "production"
  );
}

function readNumber(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return fallback;
  }

  return Math.max(
    minimum,
    Math.min(
      maximum,
      Math.round(
        parsed,
      ),
    ),
  );
}

export async function GET(
  request: Request,
) {
  if (
    !isAuthorized(
      request,
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Unauthorized cron request.",
      },
      {
        status:
          401,
      },
    );
  }

  const url =
    new URL(
      request.url,
    );

  const action =
    String(
      url.searchParams.get(
        "action",
      ) ??
      "generate",
    )
      .trim()
      .toLowerCase();

  const userLimit =
    readNumber(
      url.searchParams.get(
        "users",
      ),
      25,
      1,
      100,
    );

  const runLimit =
    readNumber(
      url.searchParams.get(
        "runs",
      ),
      5,
      1,
      25,
    );

  const minimumSamples =
    readNumber(
      url.searchParams.get(
        "minimum",
      ),
      40,
      1,
      1_000,
    );

  const users =
    await prisma.user.findMany({
      where: {
        platformStatus:
          "Active",
      },

      orderBy: {
        createdAt:
          "asc",
      },

      take:
        userLimit,

      select: {
        id:
          true,
      },
    });

  const results:
    Array<{
      userId:
        string;

      ok:
        boolean;

      action:
        string;

      generatedCount?:
        number;

      skipped?:
        boolean;

      modelVersion?:
        string;

      eligibleSamples?:
        number;

      error?:
        string;
    }> = [];

  for (
    const user of
      users
  ) {
    if (
      action ===
      "train"
    ) {
      const settledCount =
        await prisma.intelligenceForecastHorizon.count({
          where: {
            userId:
              user.id,

            status:
              "Settled",

            outcome: {
              isNot:
                null,
            },
          },
        });

      if (
        settledCount <
        minimumSamples
      ) {
        results.push({
          userId:
            user.id,

          ok:
            true,

          action,

          skipped:
            true,

          eligibleSamples:
            settledCount,
        });

        continue;
      }

      try {
        const trained =
          await trainEnsembleSuite({
            userId:
              user.id,
          });

        results.push({
          userId:
            user.id,

          ok:
            true,

          action,

          skipped:
            false,

          modelVersion:
            trained.suite
              .modelVersion,

          eligibleSamples:
            trained.suite
              .totalEligibleSamples,
        });
      } catch (error) {
        results.push({
          userId:
            user.id,

          ok:
            false,

          action,

          error:
            error instanceof Error
              ? error.message
              : "Unknown ensemble-training error.",
        });
      }

      continue;
    }

    const runs =
      await prisma.intelligenceForecastRun.findMany({
        where: {
          userId:
            user.id,
        },

        orderBy: {
          generatedAt:
            "desc",
        },

        take:
          runLimit,

        select: {
          id:
            true,
        },
      });

    let generatedCount =
      0;

    let userError:
      string | undefined;

    for (
      const run of
        runs
    ) {
      try {
        await generateEnsembleForRun({
          userId:
            user.id,

          runId:
            run.id,
        });

        generatedCount +=
          1;
      } catch (error) {
        userError =
          error instanceof Error
            ? error.message
            : "Unknown ensemble-generation error.";
      }
    }

    results.push({
      userId:
        user.id,

      ok:
        !userError,

      action:
        "generate",

      generatedCount,

      error:
        userError,
    });
  }

  return NextResponse.json(
    {
      ok:
        true,

      route:
        "/api/cron/intelligence-ensemble",

      generatedAt:
        new Date().toISOString(),

      action:

        action ===
        "train"
          ? "train"
          : "generate",

      usersExamined:
        users.length,

      results,

      safeguards: {
        autonomousTradingEnabled:
          false,

        automaticPromotionEnabled:
          false,

        automaticFeatureRemovalEnabled:
          false,

        simulationTreatedAsTruth:
          false,
      },
    },
    {
      status:
        200,

      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}

export async function POST(
  request: Request,
) {
  return GET(
    request,
  );
}