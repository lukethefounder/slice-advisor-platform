import "server-only";

import { NextResponse } from "next/server";

import { scoutAndPersistPublicIntelligence } from "@/lib/public-intelligence";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 180;

const MARKET_TIME_ZONE = "America/New_York";
const CHECKPOINT_ID = "slice-public-intelligence-v2";
const DAILY_ARTICLE_COUNT = 6;

type EasternClock = {
  dateKey: string;
  hour: number;
  minute: number;
};

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();

  if (!secret) {
    return process.env.NODE_ENV !== "production";
  }

  return (
    request.headers.get("authorization") ===
    `Bearer ${secret}`
  );
}

function json(
  body: unknown,
  init?: ResponseInit,
) {
  const response = NextResponse.json(body, init);

  response.headers.set(
    "Cache-Control",
    "no-store, max-age=0",
  );
  response.headers.set(
    "X-Content-Type-Options",
    "nosniff",
  );
  response.headers.set(
    "X-Slice-Cron-Route",
    "public-daily-intelligence-v3",
  );

  return response;
}

function easternClock(
  date = new Date(),
): EasternClock {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: MARKET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const read = (type: string) =>
    parts.find((part) => part.type === type)?.value ?? "";

  return {
    dateKey: `${read("year")}-${read("month")}-${read("day")}`,
    hour: Number(read("hour")),
    minute: Number(read("minute")),
  };
}

function forceRequested(request: Request) {
  const value = new URL(request.url)
    .searchParams
    .get("force")
    ?.trim()
    .toLowerCase();

  return (
    value === "1" ||
    value === "true" ||
    value === "yes"
  );
}

function isSixAmEasternWindow(
  clock: EasternClock,
) {
  /*
   * The paired UTC schedules call this route at 10:00 and 11:00 UTC.
   * Only the invocation that resolves to 6:00 AM New York time publishes.
   */
  return clock.hour === 6 && clock.minute <= 20;
}

async function readPublicationCheckpoint() {
  try {
    return await prisma.sourceCheckpoint.findUnique({
      where: {
        sourceId: CHECKPOINT_ID,
      },
      select: {
        lastFetchedAt: true,
        lastItemCount: true,
        lastStatus: true,
      },
    });
  } catch {
    /*
     * A checkpoint read problem must not permanently prevent the scheduled
     * publisher from attempting its work.
     */
    return null;
  }
}

export async function GET(request: Request) {
  const startedAt = Date.now();

  if (!isAuthorized(request)) {
    return json(
      {
        ok: false,
        error: "Unauthorized cron request.",
        detail:
          "Configure CRON_SECRET and send it as Authorization: Bearer <secret>.",
      },
      {
        status: 401,
      },
    );
  }

  const now = new Date();
  const clock = easternClock(now);
  const force = forceRequested(request);

  if (!force && !isSixAmEasternWindow(clock)) {
    return json({
      ok: true,
      skipped: true,
      reason:
        "This invocation did not occur during the 6:00 AM Eastern publication window.",
      easternDateKey: clock.dateKey,
      easternHour: clock.hour,
      easternMinute: clock.minute,
      scheduledPublication:
        "6:00 AM America/New_York",
      articleLimit: DAILY_ARTICLE_COUNT,
      durationMs: Date.now() - startedAt,
    });
  }

  const checkpoint =
    await readPublicationCheckpoint();

  if (
    !force &&
    checkpoint?.lastFetchedAt
  ) {
    const lastPublication = easternClock(
      checkpoint.lastFetchedAt,
    );

    if (
      lastPublication.dateKey === clock.dateKey &&
      lastPublication.hour >= 6
    ) {
      return json({
        ok: true,
        skipped: true,
        reason:
          "Today's 6:00 AM Eastern edition was already published.",
        easternDateKey: clock.dateKey,
        previousPublicationAt:
          checkpoint.lastFetchedAt.toISOString(),
        previousStatus:
          checkpoint.lastStatus ?? "Unknown",
        articleCount: Math.min(
          checkpoint.lastItemCount ?? 0,
          DAILY_ARTICLE_COUNT,
        ),
        articleLimit: DAILY_ARTICLE_COUNT,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  try {
    const {
      snapshot,
      persistence,
    } =
      await scoutAndPersistPublicIntelligence();

    const selectedArticles = snapshot.items.slice(
      0,
      DAILY_ARTICLE_COUNT,
    );
    const onlineSources = snapshot.sources.filter(
      (source) => source.ok,
    ).length;

    const warnings = [...snapshot.warnings];

    if (
      selectedArticles.length <
      DAILY_ARTICLE_COUNT
    ) {
      warnings.push(
        `Only ${selectedArticles.length} unique sourced articles were available for the six-article daily edition.`,
      );
    }

    return json({
      ok: true,
      skipped: false,
      forced: force,
      route: "/api/cron/intelligence-daily",
      purpose:
        "Publish one fixed six-article public intelligence edition each day at 6:00 AM Eastern Time.",
      scheduledPublication:
        "6:00 AM America/New_York",
      generatedAt: snapshot.generatedAt,
      dateKey: snapshot.dateKey,
      articleCount: selectedArticles.length,
      articleLimit: DAILY_ARTICLE_COUNT,
      totalRankedArticleCount:
        snapshot.items.length,
      selectedArticleIds:
        selectedArticles.map(
          (article) => article.id,
        ),
      alertCount: selectedArticles.filter(
        (article) => article.shouldAlert,
      ).length,
      digestCount: selectedArticles.filter(
        (article) =>
          !article.shouldAlert &&
          article.score >= 55,
      ).length,
      onlineSourceCount: onlineSources,
      sourceCount: snapshot.sources.length,
      topTopics:
        snapshot.topicCounts.slice(0, 12),
      warnings: Array.from(new Set(warnings)),
      persistence,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        skipped: false,
        route:
          "/api/cron/intelligence-daily",
        error:
          error instanceof Error
            ? error.message
            : "The daily public intelligence publication failed.",
        durationMs: Date.now() - startedAt,
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