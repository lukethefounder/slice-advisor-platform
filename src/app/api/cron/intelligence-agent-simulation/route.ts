import {
  NextResponse,
} from "next/server";

import {
  runAgentSimulation,
} from "@/lib/intelligence-forecast/agent-simulation";

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

  const userLimit =
    readNumber(
      url.searchParams.get(
        "users",
      ),
      10,
      1,
      50,
    );

  const paths =
    readNumber(
      url.searchParams.get(
        "paths",
      ),
      100,
      50,
      500,
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

  const scenarios = [
    "BASELINE",
    "RISK_OFF",
    "LIQUIDITY_SHOCK",
  ] as const;

  const results:
    Array<{
      userId: string;
      runId?: string;
      scenario?: string;
      ok: boolean;
      simulationId?: string;
      error?: string;
      skipped?: boolean;
    }> = [];

  for (
    const user of
      users
  ) {
    const latestRun =
      await prisma.intelligenceForecastRun.findFirst({
        where: {
          userId:
            user.id,
        },

        orderBy: {
          generatedAt:
            "desc",
        },

        select: {
          id:
            true,
        },
      });

    if (!latestRun) {
      results.push({
        userId:
          user.id,
        ok:
          true,
        skipped:
          true,
      });

      continue;
    }

    for (
      const scenario of
        scenarios
    ) {
      try {
        const simulation =
          await runAgentSimulation({
            userId:
              user.id,
            runId:
              latestRun.id,
            scenario,
            paths,
          });

        results.push({
          userId:
            user.id,
          runId:
            latestRun.id,
          scenario,
          ok:
            true,
          simulationId:
            simulation.simulationId,
        });
      } catch (error) {
        results.push({
          userId:
            user.id,
          runId:
            latestRun.id,
          scenario,
          ok:
            false,
          error:
            error instanceof Error
              ? error.message
              : "Unknown scenario-sweep error.",
        });
      }
    }
  }

  return NextResponse.json(
    {
      ok:
        true,

      route:
        "/api/cron/intelligence-agent-simulation",

      generatedAt:
        new Date().toISOString(),

      usersExamined:
        users.length,

      paths,

      scenarios,

      completedCount:
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
        simulationIsObservedTruth:
          false,
        scheduledExecutionIsResearchOnly:
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