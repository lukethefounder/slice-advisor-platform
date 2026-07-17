import { NextResponse } from "next/server";

import {
  runAutomaticForecastSettlement,
} from "@/lib/intelligence-forecast/settlement";

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

  if (
    isVercelCronRequest(
      request,
    )
  ) {
    return true;
  }

  return (
    process.env.NODE_ENV !==
    "production"
  );
}

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

export async function GET(
  request: Request,
) {
  if (
    !isAuthorized(request)
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

  const url =
    new URL(request.url);

  const limit =
    readLimit(
      url.searchParams.get(
        "limit",
      ),
    );

  try {
    const result =
      await runAutomaticForecastSettlement({
        limit,
      });

    return NextResponse.json(
      {
        ok: true,
        route:
          "/api/cron/intelligence-forecast-settlement",
        autonomousTradingEnabled:
          false,
        ...result,
      },
      {
        status: 200,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          "Automatic forecast settlement failed.",
        detail:
          error instanceof Error
            ? error.message
            : "Unknown settlement error.",
      },
      {
        status: 500,
      },
    );
  }
}

export async function POST(
  request: Request,
) {
  return GET(request);
}