import {
  NextResponse,
} from "next/server";

import {
  syncForecastGraphBatch,
} from "@/lib/intelligence-forecast/provenance-graph";

import {
  isNeo4jConfigured,
} from "@/lib/neo4j";

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
    ) ?? "";

  return userAgent.includes(
    "vercel-cron/1.0",
  );
}

function isAuthorized(
  request: Request,
) {
  const secret =
    process.env.CRON_SECRET;

  const authorization =
    request.headers.get(
      "authorization",
    ) ?? "";

  const secretHeader =
    request.headers.get(
      "x-cron-secret",
    ) ?? "";

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
    process.env.NODE_ENV !==
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
        status: 401,
      },
    );
  }

  if (
    !isNeo4jConfigured()
  ) {
    return NextResponse.json(
      {
        ok: true,

        skipped:
          true,

        reason:
          "Neo4j is not configured.",

        autonomousTradingEnabled:
          false,
      },
      {
        status: 200,
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
      50,
      1,
      250,
    );

  const runLimit =
    readNumber(
      url.searchParams.get(
        "runs",
      ),
      20,
      1,
      100,
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

  const results: Array<{
    userId: string;
    ok: boolean;
    syncedCount?: number;
    failedCount?: number;
    error?: string;
  }> = [];

  for (
    const user of
      users
  ) {
    try {
      const result =
        await syncForecastGraphBatch(
          {
            userId:
              user.id,

            limit:
              runLimit,
          },
        );

      results.push({
        userId:
          user.id,

        ok:
          true,

        syncedCount:
          result.syncedCount,

        failedCount:
          result.failedCount,
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
            : "Unknown graph synchronization error.",
      });
    }
  }

  return NextResponse.json(
    {
      ok: true,

      route:
        "/api/cron/intelligence-forecast-graph",

      generatedAt:
        new Date().toISOString(),

      usersExamined:
        users.length,

      userLimit,

      runLimit,

      syncedCount:
        results.reduce(
          (
            sum,
            result,
          ) =>
            sum +
            (
              result.syncedCount ??
              0
            ),
          0,
        ),

      failedCount:
        results.reduce(
          (
            sum,
            result,
          ) =>
            sum +
            (
              result.failedCount ??
              0
            ) +
            (
              result.ok
                ? 0
                : 1
            ),
          0,
        ),

      results,

      safeguards: {
        autonomousTradingEnabled:
          false,

        rawCredentialsStored:
          false,

        tenantIdentifierHashed:
          true,
      },
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

export async function POST(
  request: Request,
) {
  return GET(
    request,
  );
}