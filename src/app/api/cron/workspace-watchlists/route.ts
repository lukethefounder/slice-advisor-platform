import "server-only";

import { NextResponse } from "next/server";

import { getAccessContextForUser } from "@/lib/access-control";
import { listBackgroundJobs } from "@/lib/background-jobs/queue";
import { enqueueBackendJob } from "@/lib/backend/jobs";
import { prisma } from "@/lib/prisma";
import { constantTimeEqual } from "@/lib/security";
import {
  WATCHLIST_WORKSPACE_IDENTITY,
  loadWatchlistWorkspace,
  watchlistIsDue,
} from "@/lib/watchlists/service";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization") ?? "";
  const candidate = authorization.replace(/^Bearer\s+/i, "").trim();

  return Boolean(candidate && constantTimeEqual(candidate, secret));
}

function bounded(value: string | null, fallback: number, maximum: number) {
  const parsed = Number(value);
  return Number.isInteger(parsed)
    ? Math.max(1, Math.min(maximum, parsed))
    : fallback;
}

function json(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("X-Slice-Cron-Route", "workspace-watchlists-v3");
  return response;
}

export async function GET(request: Request) {
  if (!authorized(request)) {
    return json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const url = new URL(request.url);
  const userLimit = bounded(url.searchParams.get("users"), 100, 250);
  const listLimit = bounded(url.searchParams.get("lists"), 100, 500);
  const memories = await prisma.advisorAdaptiveMemory.findMany({
    where: {
      subjectType: WATCHLIST_WORKSPACE_IDENTITY.subjectType,
      subjectName: WATCHLIST_WORKSPACE_IDENTITY.subjectName,
      memoryKey: {
        startsWith: WATCHLIST_WORKSPACE_IDENTITY.memoryKeyPrefix,
      },
    },
    orderBy: { updatedAt: "asc" },
    take: userLimit,
    select: {
      userId: true,
      firmId: true,
    },
  });
  const now = new Date();
  const results: Array<{
    userId: string;
    listId: string;
    status: "Queued" | "Duplicate" | "Skipped" | "Failed";
    jobId?: string;
    reason: string;
  }> = [];
  let considered = 0;

  for (const memory of memories) {
    if (considered >= listLimit) break;

    try {
      const access = await getAccessContextForUser({
        userId: memory.userId,
        firmId: memory.firmId,
      });

      if (!access?.firm) continue;

      const state = await loadWatchlistWorkspace({
        userId: access.user.id,
        firmId: access.firm.id,
      });

      if (!state.schedulerEnabled) continue;

      const activeJobs = await listBackgroundJobs({
        userId: access.user.id,
        firmId: access.firm.id,
        statuses: ["Queued", "Retrying", "Processing"],
        limit: 50,
        includePayload: true,
      });
      const activeListIds = new Set(
        activeJobs
          .filter((job) => job.jobKey === "workspace_watchlist_scan")
          .map((job) => String(job.payload?.listId ?? "").trim())
          .filter(Boolean),
      );
      const due = [...state.lists, state.customBoardList].filter(
        (list) => watchlistIsDue(list, now) && !activeListIds.has(list.id),
      );

      for (const list of due) {
        if (considered >= listLimit) break;
        considered += 1;
        const intervalMs = Math.max(list.scanIntervalMinutes, 1) * 60_000;
        const occurrence = Math.floor(now.getTime() / intervalMs);
        const queued = await enqueueBackendJob(
          {
            userId: access.user.id,
            firmId: access.firm.id,
            actorName: access.user.name,
            actorEmail: access.user.email,
          },
          "workspace_watchlist_scan",
          {
            payload: {
              listId: list.id,
              source: "scheduled",
              requestedAt: now.toISOString(),
            },
            idempotencyKey: `workspace-watchlist:schedule:${access.user.id}:${list.id}:${occurrence}`,
          },
        );

        results.push({
          userId: access.user.id,
          listId: list.id,
          status: queued.duplicate ? "Duplicate" : "Queued",
          jobId: queued.job.id,
          reason: queued.duplicate
            ? "This watchlist interval is already queued or completed."
            : "Due watchlist scan queued.",
        });
      }
    } catch (error) {
      results.push({
        userId: memory.userId,
        listId: "unknown",
        status: "Failed",
        reason:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Unknown watchlist scheduler error.",
      });
    }
  }

  return json({
    ok: true,
    checkedAt: now.toISOString(),
    workspacesExamined: memories.length,
    listsConsidered: considered,
    queuedCount: results.filter((result) => result.status === "Queued").length,
    duplicateCount: results.filter((result) => result.status === "Duplicate").length,
    failedCount: results.filter((result) => result.status === "Failed").length,
    results,
  });
}

export async function POST(request: Request) {
  return GET(request);
}