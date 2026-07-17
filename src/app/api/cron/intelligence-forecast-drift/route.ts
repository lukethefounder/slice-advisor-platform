import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

import {
  runForecastDriftMonitor,
} from "@/lib/intelligence-forecast/model-governance";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 120;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  const authorization =
    request.headers.get("authorization") ?? "";
  const secretHeader =
    request.headers.get("x-cron-secret") ?? "";
  const userAgent =
    request.headers.get("user-agent") ?? "";

  if (userAgent.includes("vercel-cron/1.0")) {
    return true;
  }

  if (
    secret &&
    (authorization === `Bearer ${secret}` ||
      secretHeader === secret)
  ) {
    return true;
  }

  return process.env.NODE_ENV !== "production";
}

function readWindow(value: string | null) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed)) return 40;

  return Math.max(20, Math.min(200, Math.round(parsed)));
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json(
      { error: "Unauthorized cron request." },
      { status: 401 },
    );
  }

  const url = new URL(request.url);
  const windowSize = readWindow(
    url.searchParams.get("window"),
  );

  const users = await prisma.user.findMany({
    where: {
      platformStatus: "Active",
    },

    select: {
      id: true,
    },

    take: 500,
  });

  const results = [];

  for (const user of users) {
    try {
      const result = await runForecastDriftMonitor({
        userId: user.id,
        windowSize,
      });

      results.push({
        userId: user.id,
        ok: true,
        ...result,
      });
    } catch (error) {
      results.push({
        userId: user.id,
        ok: false,
        error:
          error instanceof Error
            ? error.message
            : "Unknown drift-monitor error.",
      });
    }
  }

  return NextResponse.json({
    ok: true,
    generatedAt: new Date().toISOString(),
    usersExamined: users.length,
    windowSize,
    results,
    autonomousTradingEnabled: false,
  });
}

export async function POST(request: Request) {
  return GET(request);
}