import { NextResponse } from "next/server";

import {
  DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS,
  DEFAULT_PUBLIC_EDITION_MAX_AGE_MS,
  freshenPublicSnapshot,
  isTimestampWithin,
  timestampFreshness,
} from "@/lib/intelligence/freshness";
import { getPublicIntelligence } from "@/lib/public-intelligence";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const DEFAULT_ARTICLE_COUNT = 6;
const MAX_ARTICLE_COUNT = 12;
const DAILY_REFRESH_CADENCE =
  "Published daily at 6:00 AM Eastern Time with six-hour recovery checks";

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.max(minimum, Math.min(maximum, value));
}

function articleLimit(request: Request) {
  const requested = Number(
    new URL(request.url).searchParams.get("limit"),
  );

  return Number.isFinite(requested)
    ? clamp(
        Math.round(requested),
        1,
        MAX_ARTICLE_COUNT,
      )
    : DEFAULT_ARTICLE_COUNT;
}

function articleMaximumAgeMs() {
  const configured = Number(
    process.env.PUBLIC_INTELLIGENCE_MAX_ARTICLE_AGE_HOURS,
  );

  return Number.isFinite(configured)
    ? clamp(
        configured,
        24,
        168,
      ) * 60 * 60_000
    : DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS;
}

function editionMaximumAgeMs() {
  const configured = Number(
    process.env.PUBLIC_INTELLIGENCE_MAX_EDITION_AGE_HOURS,
  );

  return Number.isFinite(configured)
    ? clamp(
        configured,
        12,
        72,
      ) * 60 * 60_000
    : DEFAULT_PUBLIC_EDITION_MAX_AGE_MS;
}

function json(
  body: unknown,
  init: ResponseInit,
) {
  const response = NextResponse.json(body, init);

  response.headers.set(
    "X-Content-Type-Options",
    "nosniff",
  );
  response.headers.set(
    "Referrer-Policy",
    "no-referrer",
  );
  response.headers.set(
    "X-Slice-Intelligence-Feed",
    "public-daily-current-v4",
  );

  return response;
}

export async function GET(request: Request) {
  const limit = articleLimit(request);
  const maximumArticleAgeMs =
    articleMaximumAgeMs();
  const maximumEditionAgeMs =
    editionMaximumAgeMs();
  const now = new Date();

  try {
    const stored = await getPublicIntelligence({
      maxAgeMs: maximumEditionAgeMs,
      /*
       * A public page read never starts provider scans. The protected
       * publisher and recovery cron own edition creation.
       */
      allowRefresh:
        process.env.NODE_ENV !== "production",
    });
    const { snapshot, freshness } =
      freshenPublicSnapshot(stored, {
        now,
        maximumAgeMs: maximumArticleAgeMs,
        limit,
        maximumPerSource: 2,
      });
    const editionFreshness = timestampFreshness(
      snapshot.generatedAt,
      {
        now,
        currentWithinMs: maximumEditionAgeMs,
        recentWithinMs: maximumEditionAgeMs,
      },
    );
    const editionFresh = isTimestampWithin(
      snapshot.generatedAt,
      maximumEditionAgeMs,
      { now },
    );

    if (!editionFresh || !snapshot.items.length) {
      return json(
        {
          schemaVersion:
            "slice-public-intelligence-2.0.0",
          ok: false,
          generatedAt: snapshot.generatedAt,
          servedAt: now.toISOString(),
          articleCount: 0,
          articleLimit: limit,
          items: [],
          error: !editionFresh
            ? "The most recent completed daily intelligence edition is outside the allowed edition-freshness window."
            : "No source article passed the strict publication-time freshness contract.",
          freshness: {
            checkedAt: freshness.checkedAt,
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
            edition: editionFreshness,
          },
        },
        {
          status: 503,
          headers: {
            "Cache-Control":
              "no-store, max-age=0",
            "Retry-After": "900",
          },
        },
      );
    }

    const items = snapshot.items;
    const alertCandidates = items.filter(
      (item) => item.shouldAlert,
    );
    const digestCandidates = items.filter(
      (item) =>
        !item.shouldAlert && item.score >= 55,
    );
    const suppressed = items.filter(
      (item) => item.score < 55,
    );
    const response = json(
      {
        ...snapshot,
        ok: true,
        refreshCadence:
          DAILY_REFRESH_CADENCE,
        items,
        articleCount: items.length,
        articleLimit: limit,
        alertCandidates,
        digestCandidates,
        suppressed,
        servedAt: now.toISOString(),
        freshness: {
          checkedAt: freshness.checkedAt,
          contract:
            "Every displayed article has a valid publication timestamp, is not materially future-dated, and was published within the configured maximum age.",
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
          edition: editionFreshness,
        },
      },
      {
        status: 200,
        headers: {
          /*
           * The page may cache briefly, but it may not retain a response
           * through an entire day after the edition has changed.
           */
          "Cache-Control":
            "public, s-maxage=300, stale-while-revalidate=1800, max-age=120",
          "X-Slice-Intelligence-Storage":
            snapshot.storage,
          "X-Slice-Article-Limit":
            String(limit),
          "X-Slice-Edition-Fresh": "true",
        },
      },
    );

    if (freshness.newestPublishedAt) {
      response.headers.set(
        "X-Slice-Newest-Article-At",
        freshness.newestPublishedAt,
      );
    }

    if (freshness.oldestPublishedAt) {
      response.headers.set(
        "X-Slice-Oldest-Article-At",
        freshness.oldestPublishedAt,
      );
    }

    return response;
  } catch (error) {
    return json(
      {
        schemaVersion:
          "slice-public-intelligence-2.0.0",
        ok: false,
        generatedAt: now.toISOString(),
        servedAt: now.toISOString(),
        articleCount: 0,
        articleLimit: limit,
        items: [],
        error:
          error instanceof Error
            ? error.message
            : "The scheduled Slice daily intelligence edition is temporarily unavailable.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control":
            "no-store, max-age=0",
          "Retry-After": "900",
        },
      },
    );
  }
}