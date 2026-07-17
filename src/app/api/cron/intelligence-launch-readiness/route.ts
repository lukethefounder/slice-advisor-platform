import {
  NextResponse,
} from "next/server";

import {
  INTELLIGENCE_LAUNCH_MODES,
  runLaunchReadinessScan,
  type IntelligenceLaunchMode,
} from "@/lib/intelligence-forecast/launch-readiness";

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

function readMode(
  value: string | null,
): IntelligenceLaunchMode {
  const mode =
    String(
      value ??
      "Production",
    ).trim();

  return (
    INTELLIGENCE_LAUNCH_MODES as readonly string[]
  ).includes(
    mode,
  )
    ? mode as IntelligenceLaunchMode
    : "Production";
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

  const targetMode =
    readMode(
      url.searchParams.get(
        "target",
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
      userId: string;
      ok: boolean;
      targetMode: string;
      score?: number;
      status?: string;
      blockerCount?: number;
      currentMode?: string;
      currentModeRegression?: boolean;
      error?: string;
    }> = [];

  for (
    const user of
      users
  ) {
    try {
      const result =
        await runLaunchReadinessScan({
          userId:
            user.id,

          targetMode,

          persist:
            true,
        });

      results.push({
        userId:
          user.id,

        ok:
          true,

        targetMode,

        score:
          result.target.score,

        status:
          result.target.status,

        blockerCount:
          result.target
            .blockers
            .length,

        currentMode:
          result.target
            .currentState
            .mode,

        currentModeRegression:
          Boolean(
            result.currentModeReadiness &&
            !result.currentModeReadiness
              .allRequiredGatesPassed,
          ),
      });
    } catch (error) {
      results.push({
        userId:
          user.id,

        ok:
          false,

        targetMode,

        error:
          error instanceof Error
            ? error.message
            : "Unknown launch-readiness error.",
      });
    }
  }

  return NextResponse.json(
    {
      ok:
        true,

      route:
        "/api/cron/intelligence-launch-readiness",

      generatedAt:
        new Date().toISOString(),

      targetMode,

      usersExamined:
        users.length,

      readyCount:
        results.filter(
          (result) =>
            result.ok &&
            result.status ===
            "Ready",
        ).length,

      blockedCount:
        results.filter(
          (result) =>
            result.ok &&
            result.status ===
            "Blocked",
        ).length,

      regressionCount:
        results.filter(
          (result) =>
            result.currentModeRegression,
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

        automaticLaunchEnabled:
          false,

        automaticRollbackEnabled:
          false,

        humanReviewRequired:
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