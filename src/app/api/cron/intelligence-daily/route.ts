import "server-only";

import { NextResponse } from "next/server";

import {
  DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS,
  DEFAULT_PUBLIC_EDITION_MAX_AGE_MS,
  freshenPublicSnapshot,
  isTimestampWithin,
  timestampFreshness,
} from "@/lib/intelligence/freshness";
import {
  getPublicIntelligence,
  scoutAndPersistPublicIntelligence,
} from "@/lib/public-intelligence";
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

type PublicationMode =
  | "scheduled"
  | "recovery"
  | "force";

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.max(minimum, Math.min(maximum, value));
}

function articleMaximumAgeMs() {
  const configured = Number(
    process.env.PUBLIC_INTELLIGENCE_MAX_ARTICLE_AGE_HOURS,
  );

  return Number.isFinite(configured)
    ? clamp(configured, 24, 168) * 60 * 60_000
    : DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS;
}

function editionMaximumAgeMs() {
  const configured = Number(
    process.env.PUBLIC_INTELLIGENCE_MAX_EDITION_AGE_HOURS,
  );

  return Number.isFinite(configured)
    ? clamp(configured, 12, 72) * 60 * 60_000
    : DEFAULT_PUBLIC_EDITION_MAX_AGE_MS;
}

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
    "public-daily-intelligence-v4",
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
    parts.find((part) => part.type === type)
      ?.value ?? "";

  return {
    dateKey: `${read("year")}-${read(
      "month",
    )}-${read("day")}`,
    hour: Number(read("hour")),
    minute: Number(read("minute")),
  };
}

function publicationMode(
  request: Request,
): PublicationMode {
  const url = new URL(request.url);
  const force = url.searchParams
    .get("force")
    ?.trim()
    .toLowerCase();
  const mode = url.searchParams
    .get("mode")
    ?.trim()
    .toLowerCase();

  if (
    force === "1" ||
    force === "true" ||
    force === "yes" ||
    mode === "force"
  ) {
    return "force";
  }

  return mode === "recovery"
    ? "recovery"
    : "scheduled";
}

function isSixAmEasternWindow(
  clock: EasternClock,
) {
  /*
   * Paired 10:00 and 11:00 UTC invocations cover daylight and
   * standard time. Only the call that resolves to 6:00 AM New York
   * time publishes.
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
    return null;
  }
}

async function currentEditionHealth(
  now: Date,
  maximumArticleAgeMs: number,
  maximumEditionAgeMs: number,
) {
  try {
    const stored = await getPublicIntelligence({
      maxAgeMs: maximumEditionAgeMs,
      allowRefresh: false,
    });
    const { snapshot, freshness } =
      freshenPublicSnapshot(stored, {
        now,
        maximumAgeMs: maximumArticleAgeMs,
        limit: DAILY_ARTICLE_COUNT,
        maximumPerSource: 2,
      });
    const editionFresh = isTimestampWithin(
      snapshot.generatedAt,
      maximumEditionAgeMs,
      { now },
    );

    return {
      healthy:
        editionFresh && snapshot.items.length > 0,
      snapshot,
      freshness,
      editionFresh,
      error: null,
    };
  } catch (error) {
    return {
      healthy: false,
      snapshot: null,
      freshness: null,
      editionFresh: false,
      error:
        error instanceof Error
          ? error.message
          : "Unable to inspect the current edition.",
    };
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
      { status: 401 },
    );
  }

  const now = new Date();
  const clock = easternClock(now);
  const mode = publicationMode(request);
  const maximumArticleAgeMs =
    articleMaximumAgeMs();
  const maximumEditionAgeMs =
    editionMaximumAgeMs();

  if (
    mode === "scheduled" &&
    !isSixAmEasternWindow(clock)
  ) {
    return json({
      ok: true,
      skipped: true,
      mode,
      reason:
        "This invocation did not occur during the 6:00 AM Eastern publication window.",
      easternDateKey: clock.dateKey,
      easternHour: clock.hour,
      easternMinute: clock.minute,
      scheduledPublication:
        "6:00 AM America/New_York",
      recoveryCadence: "Every six hours",
      articleLimit: DAILY_ARTICLE_COUNT,
      durationMs: Date.now() - startedAt,
    });
  }

  if (mode === "recovery") {
    const health = await currentEditionHealth(
      now,
      maximumArticleAgeMs,
      maximumEditionAgeMs,
    );

    if (health.healthy) {
      return json({
        ok: true,
        skipped: true,
        mode,
        reason:
          "The current edition and its source articles already satisfy the freshness contract.",
        generatedAt:
          health.snapshot?.generatedAt ?? null,
        articleCount:
          health.snapshot?.items.length ?? 0,
        newestPublishedAt:
          health.freshness?.newestPublishedAt ??
          null,
        oldestPublishedAt:
          health.freshness?.oldestPublishedAt ??
          null,
        durationMs: Date.now() - startedAt,
      });
    }
  }

  const checkpoint =
    await readPublicationCheckpoint();

  if (
    mode === "scheduled" &&
    checkpoint?.lastFetchedAt
  ) {
    const lastPublication = easternClock(
      checkpoint.lastFetchedAt,
    );

    if (
      lastPublication.dateKey ===
        clock.dateKey &&
      lastPublication.hour >= 6
    ) {
      const health = await currentEditionHealth(
        now,
        maximumArticleAgeMs,
        maximumEditionAgeMs,
      );

      if (health.healthy) {
        return json({
          ok: true,
          skipped: true,
          mode,
          reason:
            "Today's 6:00 AM Eastern edition was already published and remains current.",
          easternDateKey: clock.dateKey,
          previousPublicationAt:
            checkpoint.lastFetchedAt.toISOString(),
          previousStatus:
            checkpoint.lastStatus ?? "Unknown",
          articleCount:
            health.snapshot?.items.length ??
            Math.min(
              checkpoint.lastItemCount ?? 0,
              DAILY_ARTICLE_COUNT,
            ),
          articleLimit: DAILY_ARTICLE_COUNT,
          durationMs: Date.now() - startedAt,
        });
      }
    }
  }

  try {
    const { snapshot, persistence } =
      await scoutAndPersistPublicIntelligence();
    const { snapshot: current, freshness } =
      freshenPublicSnapshot(snapshot, {
        now: new Date(snapshot.generatedAt),
        maximumAgeMs: maximumArticleAgeMs,
        limit: DAILY_ARTICLE_COUNT,
        maximumPerSource: 2,
      });
    const selectedArticles = current.items;
    const onlineSources = current.sources.filter(
      (source) => source.ok,
    ).length;
    const warnings = [...current.warnings];

    if (!selectedArticles.length) {
      throw new Error(
        "The provider scan completed, but no article passed the strict seven-day publication-time freshness contract. The previous durable edition was retained.",
      );
    }

    if (
      selectedArticles.length <
      DAILY_ARTICLE_COUNT
    ) {
      warnings.push(
        `Only ${selectedArticles.length} unique, current, sourced articles were available for the six-article edition.`,
      );
    }

    return json({
      ok: true,
      skipped: false,
      forced: mode === "force",
      mode,
      route:
        "/api/cron/intelligence-daily",
      purpose:
        "Publish a current source-verified public intelligence edition while excluding missing, future, invalid, and older-than-seven-day publication timestamps.",
      scheduledPublication:
        "6:00 AM America/New_York",
      recoveryCadence: "Every six hours",
      generatedAt: current.generatedAt,
      dateKey: current.dateKey,
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
      sourceCount: current.sources.length,
      topTopics:
        current.topicCounts.slice(0, 12),
      freshness: {
        maximumArticleAgeHours:
          maximumArticleAgeMs / 3_600_000,
        maximumEditionAgeHours:
          maximumEditionAgeMs / 3_600_000,
        cutoffAt: freshness.cutoffAt,
        newestPublishedAt:
          freshness.newestPublishedAt,
        oldestPublishedAt:
          freshness.oldestPublishedAt,
        rejected: freshness.rejected,
        edition: timestampFreshness(
          current.generatedAt,
          {
            currentWithinMs:
              maximumEditionAgeMs,
            recentWithinMs:
              maximumEditionAgeMs,
          },
        ),
      },
      warnings: Array.from(
        new Set(warnings),
      ),
      persistence,
      durationMs: Date.now() - startedAt,
    });
  } catch (error) {
    return json(
      {
        ok: false,
        skipped: false,
        mode,
        route:
          "/api/cron/intelligence-daily",
        error:
          error instanceof Error
            ? error.message
            : "The daily public intelligence publication failed.",
        durationMs: Date.now() - startedAt,
      },
      { status: 500 },
    );
  }
}

export async function POST(request: Request) {
  return GET(request);
}
