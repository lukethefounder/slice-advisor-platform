import {
  NextResponse,
} from "next/server";

import {
  createAdvisorDayBrief,
} from "@/lib/intelligence-forecast/advisor-bot";

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
      50,
      1,
      250,
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

      briefId?:
        string;

      approvalId?:
        string | null;

      reused?:
        boolean;

      error?:
        string;
    }> = [];

  for (
    const user of
      users
  ) {
    try {
      const result =
        await createAdvisorDayBrief({
          userId:
            user.id,

          force:
            false,
        });

      results.push({
        userId:
          user.id,

        ok:
          true,

        briefId:
          result.brief.id,

        approvalId:
          result.approval
            ?.id ??
          null,

        reused:
          result.reused,
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
            : "Unknown morning-brief error.",
      });
    }
  }

  return NextResponse.json(
    {
      ok:
        true,

      route:
        "/api/cron/intelligence-advisor-brief",

      generatedAt:
        new Date().toISOString(),

      usersExamined:
        users.length,

      createdOrReusedCount:
        results.filter(
          (result) =>
            result.ok,
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

        externalEmailSent:
          false,

        clientCommunicationSent:
          false,

        reportApprovalRequired:
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