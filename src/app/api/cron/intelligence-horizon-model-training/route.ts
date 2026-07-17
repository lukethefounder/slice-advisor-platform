import {
  NextResponse,
} from "next/server";

import {
  trainHorizonModelSuite,
} from "@/lib/intelligence-forecast/horizon-models";

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
  request:
    Request,
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
  request:
    Request,
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
  value:
    string | null,
  fallback:
    number,
  minimum:
    number,
  maximum:
    number,
) {
  const parsed =
    Number(
      value,
    );

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
  request:
    Request,
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

  const userLimit =
    readNumber(
      url.searchParams.get(
        "users",
      ),
      25,
      1,
      100,
    );

  const minimumSamples =
    readNumber(
      url.searchParams.get(
        "minimum",
      ),
      25,
      1,
      1_000,
    );

  const users =
    await prisma.user.findMany(
      {
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
      },
    );

  const results:
    Array<{
      userId:
        string;

      ok:
        boolean;

      skipped?:
        boolean;

      settledSampleCount?:
        number;

      modelVersion?:
        string;

      error?:
        string;
    }> = [];

  for (
    const user of
      users
  ) {
    const settledSampleCount =
      await prisma.intelligenceForecastHorizon.count(
        {
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
        },
      );

    if (
      settledSampleCount <
      minimumSamples
    ) {
      results.push({
        userId:
          user.id,

        ok:
          true,

        skipped:
          true,

        settledSampleCount,
      });

      continue;
    }

    try {
      const trained =
        await trainHorizonModelSuite(
          {
            userId:
              user.id,
          },
        );

      results.push({
        userId:
          user.id,

        ok:
          true,

        skipped:
          false,

        settledSampleCount,

        modelVersion:
          trained.suite
            .modelVersion,
      });
    } catch (error) {
      results.push({
        userId:
          user.id,

        ok:
          false,

        settledSampleCount,

        error:
          error instanceof Error
            ? error.message
            : "Unknown training error.",
      });
    }
  }

  return NextResponse.json(
    {
      ok:
        true,

      route:
        "/api/cron/intelligence-horizon-model-training",

      generatedAt:
        new Date().toISOString(),

      usersExamined:
        users.length,

      minimumSamples,

      trainedCount:
        results.filter(
          (result) =>
            result.ok &&
            !result.skipped,
        ).length,

      skippedCount:
        results.filter(
          (result) =>
            result.skipped,
        ).length,

      failedCount:
        results.filter(
          (result) =>
            !result.ok,
        ).length,

      results,

      safeguards: {
        autonomousTradingEnabled:
          false,

        automaticPromotionEnabled:
          false,

        trainingMode:
          "Shadow",
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
  request:
    Request,
) {
  return GET(
    request,
  );
}