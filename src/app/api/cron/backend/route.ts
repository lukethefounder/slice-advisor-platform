import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { BackendContext } from "@/lib/backend/config";
import { runBackendJob } from "@/lib/backend/jobs";

export const dynamic = "force-dynamic";

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const url = new URL(request.url);
  const querySecret = url.searchParams.get("secret");
  const auth = request.headers.get("authorization");

  return querySecret === secret || auth === `Bearer ${secret}`;
}

async function contextForUser(user: { id: string; name: string; email: string }): Promise<BackendContext> {
  const membership = await prisma.firmMembership.findFirst({
    where: {
      userId: user.id,
      status: "Active",
    },
    orderBy: {
      createdAt: "desc",
    },
  });

  return {
    userId: user.id,
    firmId: membership?.firmId ?? null,
    actorName: user.name,
    actorEmail: user.email,
  };
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const url = new URL(request.url);
  const requestedJob = url.searchParams.get("job");

  const jobKeys = requestedJob
    ? [requestedJob]
    : [
        "vendor_health",
        "watchlist_price_check",
        "notification_delivery",
        "data_quality_sweep",
        "advisor_day",
      ];

  const users = await prisma.user.findMany({
    orderBy: {
      createdAt: "asc",
    },
    take: 100,
  });

  const results = [];

  for (const user of users) {
    const context = await contextForUser(user);

    for (const jobKey of jobKeys) {
      try {
        const result = await runBackendJob(context, jobKey);

        results.push({
          userId: user.id,
          email: user.email,
          jobKey,
          status: "Complete",
          result,
        });
      } catch (error) {
        results.push({
          userId: user.id,
          email: user.email,
          jobKey,
          status: "Failed",
          error: error instanceof Error ? error.message : "Job failed.",
        });
      }
    }
  }

  return NextResponse.json({
    ok: true,
    jobs: jobKeys,
    users: users.length,
    results,
  });
}

export async function POST(request: Request) {
  return GET(request);
}