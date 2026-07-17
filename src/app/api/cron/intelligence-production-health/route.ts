import {
  NextResponse,
} from "next/server";

import {
  runProductionHealthScan,
} from "@/lib/intelligence-forecast/production-controls";

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

function readLimit(
  value: string | null,
) {
  const parsed =
    Number(value);

  if (
    !Number.isFinite(
      parsed,
    )
  ) {
    return 50;
  }

  return Math.max(
    1,
    Math.min(
      250,
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

  const userLimit =
    readLimit(
      url.searchParams.get(
        "users",
      ),
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

      score?:
        number;

      status?:
        string;

      criticalChecks?:
        number;

      warningChecks?:
        number;

      error?:
        string;
    }> = [];

  for (
    const user of
      users
  ) {
    try {
      const scan =
        await runProductionHealthScan({
          userId:
            user.id,

          persist:
            true,

          request,
        });

      results.push({
        userId:
          user.id,

        ok:
          true,

        score:
          scan.score,

        status:
          scan.status,

        criticalChecks:
          scan.checks.filter(
            (check) =>
              check.status ===
              "Critical",
          ).length,

        warningChecks:
          scan.checks.filter(
            (check) =>
              check.status ===
              "Warning",
          ).length,
      });
    } catch (error) {
      results.push({
        userId:
          user.id,

        ok:
          false,

        error:
          error instanceof Error
            ? error.message
            : "Unknown production-health error.",
      });
    }
  }

  return NextResponse.json(
    {
      ok:
        true,

      route:
        "/api/cron/intelligence-production-health",

      generatedAt:
        new Date().toISOString(),

      usersExamined:
        users.length,

      healthyCount:
        results.filter(
          (result) =>
            result.ok &&
            result.status ===
            "Healthy",
        ).length,

      needsReviewCount:
        results.filter(
          (result) =>
            result.ok &&
            result.status ===
            "Needs Review",
        ).length,

      criticalCount:
        results.filter(
          (result) =>
            result.ok &&
            result.status ===
            "Critical",
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

        moneyMovementEnabled:
          false,

        secretValuesReturned:
          false,

        healthAlertsEnabled:
          true,
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