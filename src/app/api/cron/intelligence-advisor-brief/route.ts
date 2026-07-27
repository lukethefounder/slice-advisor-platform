import "server-only";

import { NextResponse } from "next/server";

import {
  ADVISOR_BRIEF_PREFERENCE_IDENTITY,
  generateAdvisorMarketBrief,
  getAdvisorBriefPreference,
  isAdvisorBriefDue,
  saveAdvisorBriefPreference,
  sendAdvisorMarketBrief,
} from "@/lib/advisor-briefing/engine";
import type { AdvisorBriefPreference } from "@/lib/advisor-briefing/types";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 300;

const RUN_SUBJECT_TYPE = "AdvisorBriefingRun";
const RUN_SUBJECT_NAME = "Autonomous Advisor Market Brief";

function isVercelCronRequest(request: Request) {
  return (request.headers.get("user-agent") ?? "").includes(
    "vercel-cron/1.0",
  );
}

function isAuthorized(request: Request) {
  if (isVercelCronRequest(request)) {
    return true;
  }

  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return (
    request.headers.get("authorization") === `Bearer ${secret}` ||
    request.headers.get("x-cron-secret") === secret
  );
}

function json(body: unknown, init?: ResponseInit) {
  const response = NextResponse.json(body, init);
  response.headers.set("Cache-Control", "no-store, max-age=0");
  response.headers.set("X-Content-Type-Options", "nosniff");
  response.headers.set(
    "X-Slice-Cron-Route",
    "advisor-market-brief-v1",
  );
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
    ? Math.round(
        Math.max(minimum, Math.min(maximum, parsed)),
      )
    : fallback;
}

function localDateKey(date: Date, timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ?? "00";

  return `${read("year")}-${read("month")}-${read("day")}`;
}

function occurrenceKey(
  preference: AdvisorBriefPreference,
  now: Date,
) {
  if (preference.scheduleMode === "Interval") {
    const intervalMs =
      Math.max(preference.intervalMinutes, 15) * 60_000;
    return `interval:${Math.floor(now.getTime() / intervalMs)}`;
  }

  return `${preference.scheduleMode.toLowerCase()}:${localDateKey(
    now,
    preference.timezone,
  )}`;
}

function isUniqueConstraintError(error: unknown) {
  return (
    typeof error === "object" &&
    error !== null &&
    "code" in error &&
    (error as { code?: unknown }).code === "P2002"
  );
}

async function acquireRunLock(input: {
  userId: string;
  occurrence: string;
  now: Date;
}) {
  try {
    return await prisma.advisorAdaptiveMemory.create({
      data: {
        userId: input.userId,
        subjectType: RUN_SUBJECT_TYPE,
        subjectName: RUN_SUBJECT_NAME,
        memoryKey: input.occurrence,
        memoryValue: JSON.stringify({
          status: "Running",
          startedAt: input.now.toISOString(),
        }),
        confidenceScore: 100,
        evidenceJson: "[]",
        lastAppliedAt: input.now,
      },
    });
  } catch (error) {
    if (isUniqueConstraintError(error)) {
      return null;
    }

    throw error;
  }
}

async function completeRunLock(input: {
  id: string;
  status: string;
  detail: string;
  briefId?: string;
  deliveryStatus?: string;
}) {
  await prisma.advisorAdaptiveMemory.update({
    where: {
      id: input.id,
    },
    data: {
      memoryValue: JSON.stringify({
        status: input.status,
        detail: input.detail,
        briefId: input.briefId ?? null,
        deliveryStatus: input.deliveryStatus ?? null,
        completedAt: new Date().toISOString(),
      }),
      lastAppliedAt: new Date(),
    },
  });
}

async function releaseFailedRunLock(id: string) {
  await prisma.advisorAdaptiveMemory.delete({
    where: {
      id,
    },
  });
}

type UserResult = {
  userId: string;
  email: string;
  status:
    | "Skipped"
    | "Locked"
    | "Generated"
    | "Delivered"
    | "Simulated"
    | "Withheld"
    | "Failed";
  reason: string;
  briefId?: string;
  dataQuality?: number;
  deliveryStatus?: string;
};

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return json(
      {
        error: "Unauthorized cron request.",
      },
      {
        status: 401,
      },
    );
  }

  const url = new URL(request.url);
  const scheduleLimit = boundedInteger(
    url.searchParams.get("users"),
    100,
    1,
    250,
  );
  const force = ["1", "true", "yes"].includes(
    String(url.searchParams.get("force") ?? "").toLowerCase(),
  );
  const now = new Date();

  const scheduleRecords =
    await prisma.advisorAdaptiveMemory.findMany({
      where: {
        subjectType:
          ADVISOR_BRIEF_PREFERENCE_IDENTITY.subjectType,
        subjectName:
          ADVISOR_BRIEF_PREFERENCE_IDENTITY.subjectName,
        memoryKey:
          ADVISOR_BRIEF_PREFERENCE_IDENTITY.memoryKey,
      },
      orderBy: {
        updatedAt: "asc",
      },
      take: scheduleLimit,
      select: {
        userId: true,
      },
    });
  const scheduledUserIds = Array.from(
    new Set(
      scheduleRecords.map(
        (record) => record.userId,
      ),
    ),
  );
  const activeUsers = scheduledUserIds.length
    ? await prisma.user.findMany({
        where: {
          id: {
            in: scheduledUserIds,
          },
          platformStatus: "Active",
        },
        select: {
          id: true,
          email: true,
        },
      })
    : [];
  const activeUserMap = new Map(
    activeUsers.map((user) => [user.id, user]),
  );
  const users = scheduledUserIds
    .map((userId) => activeUserMap.get(userId))
    .filter(
      (
        user,
      ): user is {
        id: string;
        email: string;
      } => Boolean(user),
    );
  const results: UserResult[] = [];

  // Sequential processing protects Alpha Vantage and email limits.
  // The engine-level request cache shares one market-research result
  // across advisors whose schedules become due in the same invocation.
  for (const user of users) {
    let lockId: string | null = null;

    try {
      const preference =
        await getAdvisorBriefPreference(
          user.id,
          user.email,
        );

      if (
        !force &&
        !isAdvisorBriefDue(preference, now)
      ) {
        results.push({
          userId: user.id,
          email: user.email,
          status: "Skipped",
          reason: preference.enabled
            ? "The advisor-configured schedule is not due."
            : "Autonomous briefing is paused.",
        });
        continue;
      }

      const occurrence = occurrenceKey(preference, now);
      const lock = await acquireRunLock({
        userId: user.id,
        occurrence,
        now,
      });

      if (!lock) {
        results.push({
          userId: user.id,
          email: user.email,
          status: "Locked",
          reason:
            "This schedule occurrence is already running or completed.",
        });
        continue;
      }

      lockId = lock.id;

      const generated =
        await generateAdvisorMarketBrief({
          userId: user.id,
          userEmail: user.email,
          force,
          minimumDataQuality:
            preference.minimumDataQuality,
        });
      const brief = generated.record.brief;
      let status: UserResult["status"] = "Generated";
      let reason =
        "Brief generated and stored; email delivery is disabled.";
      let deliveryStatus = "Email disabled";

      if (
        brief.dataQuality <
        preference.minimumDataQuality
      ) {
        status = "Withheld";
        reason =
          `Email withheld because data quality ${brief.dataQuality.toFixed(
            1,
          )}/100 is below the advisor threshold ` +
          `${preference.minimumDataQuality}/100.`;
        deliveryStatus =
          "Withheld: data quality below threshold";
      } else if (
        preference.emailEnabled &&
        preference.emailAddress
      ) {
        const delivery =
          await sendAdvisorMarketBrief({
            userId: user.id,
            userEmail: user.email,
            record: generated.record,
            destination:
              preference.emailAddress,
          });

        deliveryStatus = delivery.status;

        if (delivery.status === "sent") {
          status = "Delivered";
          reason =
            "Brief generated, stored, and sent through Resend.";
        } else if (
          delivery.status === "simulated"
        ) {
          status = "Simulated";
          reason =
            "Brief generated and stored; email was simulated because live email is disabled.";
        } else {
          status = "Failed";
          reason =
            delivery.error ||
            "Brief generated, but email delivery failed.";
        }
      } else if (preference.emailEnabled) {
        status = "Withheld";
        reason =
          "Email delivery is enabled, but no destination is saved.";
        deliveryStatus =
          "Withheld: missing destination";
      }

      await saveAdvisorBriefPreference(
        user.id,
        {
          ...preference,
          lastGeneratedAt: brief.generatedAt,
          lastScheduledRunAt: now.toISOString(),
          lastSentAt:
            status === "Delivered"
              ? new Date().toISOString()
              : preference.lastSentAt,
          lastDeliveryStatus: deliveryStatus,
        },
        user.email,
      );

      await completeRunLock({
        id: lock.id,
        status,
        detail: reason,
        briefId: brief.briefId,
        deliveryStatus,
      });
      lockId = null;

      results.push({
        userId: user.id,
        email: user.email,
        status,
        reason,
        briefId: brief.briefId,
        dataQuality: brief.dataQuality,
        deliveryStatus,
      });
    } catch (error) {
      if (lockId) {
        await releaseFailedRunLock(lockId).catch(
          () => undefined,
        );
      }

      results.push({
        userId: user.id,
        email: user.email,
        status: "Failed",
        reason:
          error instanceof Error
            ? error.message
            : "Unknown autonomous briefing error.",
      });
    }
  }

  return json({
    ok: true,
    route:
      "/api/cron/intelligence-advisor-brief",
    generatedAt: new Date().toISOString(),
    schedulesExamined: scheduleRecords.length,
    usersExamined: users.length,
    generatedCount: results.filter(
      (result) =>
        [
          "Generated",
          "Delivered",
          "Simulated",
          "Withheld",
        ].includes(result.status),
    ).length,
    deliveredCount: results.filter(
      (result) => result.status === "Delivered",
    ).length,
    skippedCount: results.filter(
      (result) =>
        ["Skipped", "Locked"].includes(
          result.status,
        ),
    ).length,
    failedCount: results.filter(
      (result) => result.status === "Failed",
    ).length,
    results,
    safeguards: {
      autonomousTradingEnabled: false,
      clientCommunicationSent: false,
      advisorEmailOnly: true,
      minimumDataQualityEnforced: true,
      idempotentScheduleLocks: true,
    },
  });
}

export async function POST(request: Request) {
  return GET(request);
}