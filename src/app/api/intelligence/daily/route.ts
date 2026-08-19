import { NextResponse } from "next/server";

import { getPublicIntelligence } from "@/lib/public-intelligence";
import type {
  PublicArticle,
  PublicTopicCount,
} from "@/lib/public-intelligence-types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 60;

const DAILY_ARTICLE_COUNT = 6;
const DAILY_REFRESH_CADENCE =
  "Published daily at 6:00 AM Eastern Time";

function buildTopicCounts(
  articles: PublicArticle[],
): PublicTopicCount[] {
  const counts = new Map<string, number>();

  for (const article of articles) {
    for (const rawTopic of article.matchedThemes) {
      const topic = rawTopic.trim();

      if (!topic) continue;

      counts.set(topic, (counts.get(topic) ?? 0) + 1);
    }
  }

  return [...counts.entries()]
    .map(([topic, count]) => ({
      topic,
      count,
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.topic.localeCompare(right.topic),
    )
    .slice(0, 12);
}

export async function GET() {
  try {
    const snapshot = await getPublicIntelligence({
      maxAgeMs: 24 * 60 * 60_000,

      /*
       * Production visitors can only read a completed scheduled edition.
       * Local development may still recover by creating the first snapshot.
       */
      allowRefresh: process.env.NODE_ENV !== "production",
    });

    const items = snapshot.items.slice(0, DAILY_ARTICLE_COUNT);
    const alertCandidates = items.filter(
      (item) => item.shouldAlert,
    );
    const digestCandidates = items.filter(
      (item) => !item.shouldAlert && item.score >= 55,
    );
    const suppressed = items.filter(
      (item) => item.score < 55,
    );

    return NextResponse.json(
      {
        ...snapshot,
        refreshCadence: DAILY_REFRESH_CADENCE,
        items,
        articleCount: items.length,
        articleLimit: DAILY_ARTICLE_COUNT,
        alertCandidates,
        digestCandidates,
        suppressed,
        topicCounts: buildTopicCounts(items),
        servedAt: new Date().toISOString(),
      },
      {
        status: 200,
        headers: {
          /*
           * The edition is fixed during the day. Browsers may keep it for
           * five minutes and the edge may keep it for fifteen minutes.
           */
          "Cache-Control":
            "public, s-maxage=900, stale-while-revalidate=86400, max-age=300",
          "Content-Type": "application/json; charset=utf-8",
          "X-Content-Type-Options": "nosniff",
          "Referrer-Policy": "no-referrer",
          "X-Slice-Intelligence-Storage": snapshot.storage,
          "X-Slice-Intelligence-Feed": "public-daily-six-v3",
          "X-Slice-Article-Limit": String(DAILY_ARTICLE_COUNT),
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        schemaVersion: "slice-public-intelligence-2.0.0",
        ok: false,
        generatedAt: new Date().toISOString(),
        articleCount: 0,
        articleLimit: DAILY_ARTICLE_COUNT,
        error:
          error instanceof Error
            ? error.message
            : "The scheduled Slice daily intelligence edition is temporarily unavailable.",
      },
      {
        status: 503,
        headers: {
          "Cache-Control": "no-store, max-age=0",
          "X-Content-Type-Options": "nosniff",
          "X-Slice-Intelligence-Feed": "public-daily-six-v3",
        },
      },
    );
  }
}
