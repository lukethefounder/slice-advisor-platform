import "server-only";

import { NextResponse } from "next/server";

import { getAccessContextForUser } from "@/lib/access-control";
import {
  ADVISOR_BRIEF_PREFERENCE_IDENTITY,
  advisorBriefOccurrenceKey,
  getAdvisorBriefPreference,
  isAdvisorBriefDue,
} from "@/lib/advisor-briefing/engine";
import { listBackgroundJobs } from "@/lib/background-jobs/queue";
import { enqueueBackendJob } from "@/lib/backend/jobs";
import { prisma } from "@/lib/prisma";
import { constantTimeEqual } from "@/lib/security";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  const authorization = request.headers.get("authorization") ?? "";
  const candidate = authorization.replace(/^Bearer\s+/i, "").trim();

  return Boolean(candidate && constantTimeEqual(candidate, secret));
}

function json(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set("X-Slice-Cron-Route", "advisor-market-brief-v2-queue");
  return response;
}

function boundedInteger(
  value: string | null,
  fallback: number,
  minimum: number,
  maximum: number,
) {
  const parsed = Number(value);
  return Number.isFinite(parsed)
    ? Math.round(Math.max(minimum, Math.min(maximum, parsed)))
    : fallback;
}

type Result = {
  userId: string;
  status: "Skipped" | "Queued" | "Duplicate" | "Failed";
  reason: string;
  jobId?: string;
  occurrence?: string;
};

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return json({ error: "Unauthorized cron request." }, { status: 401 });
  }

  const url = new URL(request.url);
  const limit = boundedInteger(url.searchParams.get("users"), 100, 1, 250);
  const force = ["1", "true", "yes"].includes(
    String(url.searchParams.get("force") ?? "").toLowerCase(),
  );
  const now = new Date();
  const scheduleRecords = await prisma.advisorAdaptiveMemory.findMany({
    where: {
      subjectType: ADVISOR_BRIEF_PREFERENCE_IDENTITY.subjectType,
      subjectName: ADVISOR_BRIEF_PREFERENCE_IDENTITY.subjectName,
      memoryKey: ADVISOR_BRIEF_PREFERENCE_IDENTITY.memoryKey,
    },
    orderBy: { updatedAt: "asc" },
    take: limit,
    select: { userId: true },
  });
  const userIds = Array.from(new Set(scheduleRecords.map((record) => record.userId)));
  const users = userIds.length
    ? await prisma.user.findMany({
        where: {
          id: { in: userIds },
          platformStatus: "Active",
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      })
    : [];
  const results: Result[] = [];

  for (const user of users) {
    try {
      const [preference, access] = await Promise.all([
        getAdvisorBriefPreference(user.id, user.email),
        getAccessContextForUser({ userId: user.id }),
      ]);

      if (!access?.firm) {
        results.push({
          userId: user.id,
          status: "Skipped",
          reason: "No active firm workspace is available.",
        });
        continue;
      }

      const activeJobs = await listBackgroundJobs({
        userId: user.id,
        firmId: access.firm.id,
        statuses: ["Queued", "Retrying", "Processing"],
        limit: 10,
      });

      if (activeJobs.some((job) => job.jobKey === "advisor_brief_generate")) {
        results.push({
          userId: user.id,
          status: "Skipped",
          reason: "A previous advisor briefing job is still active.",
        });
        continue;
      }

      if (!force && !isAdvisorBriefDue(preference, now)) {
        results.push({
          userId: user.id,
          status: "Skipped",
          reason: preference.enabled
            ? "The advisor-configured schedule is not due."
            : "Automatic briefing is paused.",
        });
        continue;
      }

      const occurrence = advisorBriefOccurrenceKey(preference, now);
      const queued = await enqueueBackendJob(
        {
          userId: user.id,
          firmId: access.firm.id,
          actorName: user.name,
          actorEmail: user.email,
        },
        "advisor_brief_generate",
        {
          payload: {
            schemaVersion: 1,
            mode: preference.emailEnabled
              ? "generate-and-send"
              : "generate",
            destination: preference.emailAddress,
            force,
            scheduled: true,
            occurrence,
            minimumDataQuality: preference.minimumDataQuality,
            requestedAt: now.toISOString(),
          },
          idempotencyKey: `advisor-brief:schedule:${user.id}:${occurrence}`,
        },
      );

      results.push({
        userId: user.id,
        status: queued.duplicate ? "Duplicate" : "Queued",
        reason: queued.duplicate
          ? "This schedule occurrence is already queued or completed."
          : "The due briefing was added to the durable background queue.",
        jobId: queued.job.id,
        occurrence,
      });
    } catch (error) {
      results.push({
        userId: user.id,
        status: "Failed",
        reason:
          error instanceof Error
            ? error.message.slice(0, 500)
            : "Unknown advisor briefing scheduling error.",
      });
    }
  }

  return json({
    ok: true,
    route: "/api/cron/intelligence-advisor-brief",
    generatedAt: new Date().toISOString(),
    schedulesExamined: scheduleRecords.length,
    usersExamined: users.length,
    queuedCount: results.filter((result) => result.status === "Queued").length,
    duplicateCount: results.filter((result) => result.status === "Duplicate").length,
    skippedCount: results.filter((result) => result.status === "Skipped").length,
    failedCount: results.filter((result) => result.status === "Failed").length,
    results,
    safeguards: {
      durableBackgroundJobs: true,
      autonomousTradingEnabled: false,
      advisorEmailOnly: true,
      minimumDataQualityEnforcedByWorker: true,
      idempotentScheduleOccurrences: true,
    },
  });
}

export async function POST(request: Request) {
  return GET(request);
}