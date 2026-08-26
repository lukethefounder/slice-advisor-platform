import type {
  ScanResult,
  ScoredNewsItem,
} from "@/lib/intelligence";
import type {
  PublicArticle,
  PublicIntelligenceSnapshot,
  PublicTopicCount,
} from "@/lib/public-intelligence-types";

export const HOUR_MS = 60 * 60_000;
export const DAY_MS = 24 * HOUR_MS;
export const WEEK_MS = 7 * DAY_MS;

export const DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS = WEEK_MS;
export const DEFAULT_PUBLIC_EDITION_MAX_AGE_MS = 36 * HOUR_MS;
export const DEFAULT_RESEARCH_NEWS_MAX_AGE_MS = WEEK_MS;
export const DEFAULT_FUTURE_TOLERANCE_MS = 10 * 60_000;

export type TimestampFreshnessState =
  | "current"
  | "recent"
  | "stale"
  | "future"
  | "missing"
  | "invalid";

export type TimestampFreshness = {
  state: TimestampFreshnessState;
  timestamp: string | null;
  ageMs: number | null;
  ageHours: number | null;
  checkedAt: string;
  currentWithinMs: number;
  recentWithinMs: number;
  futureToleranceMs: number;
};

export type FreshnessRejections = {
  missingTimestamp: number;
  invalidTimestamp: number;
  futureTimestamp: number;
  tooOld: number;
  duplicate: number;
};

export type PublicArticleFreshnessResult = {
  items: PublicArticle[];
  rejected: FreshnessRejections;
  checkedAt: string;
  cutoffAt: string;
  maximumAgeMs: number;
  futureToleranceMs: number;
  newestPublishedAt: string | null;
  oldestPublishedAt: string | null;
};

export type ScanFreshnessResult = {
  result: ScanResult;
  rejected: FreshnessRejections;
  checkedAt: string;
  cutoffAt: string;
  maximumAgeMs: number;
  futureToleranceMs: number;
};

function finiteDate(value: string | null | undefined) {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function rounded(value: number, digits = 2) {
  const multiplier = 10 ** digits;
  return Math.round(value * multiplier) / multiplier;
}

function normalizeKey(value: string) {
  return value
    .toLowerCase()
    .replace(/^https?:\/\/(www\.)?/, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .slice(0, 260);
}

function uniqueStrings(values: string[], limit = 30) {
  return Array.from(
    new Set(values.map((value) => value.trim()).filter(Boolean)),
  ).slice(0, limit);
}

export function timestampFreshness(
  value: string | null | undefined,
  options: {
    now?: Date;
    currentWithinMs?: number;
    recentWithinMs?: number;
    futureToleranceMs?: number;
  } = {},
): TimestampFreshness {
  const now = options.now ?? new Date();
  const checkedAt = now.toISOString();
  const currentWithinMs = Math.max(
    1_000,
    options.currentWithinMs ?? 15 * 60_000,
  );
  const recentWithinMs = Math.max(
    currentWithinMs,
    options.recentWithinMs ?? 24 * HOUR_MS,
  );
  const futureToleranceMs = Math.max(
    0,
    options.futureToleranceMs ?? DEFAULT_FUTURE_TOLERANCE_MS,
  );

  if (!value) {
    return {
      state: "missing",
      timestamp: null,
      ageMs: null,
      ageHours: null,
      checkedAt,
      currentWithinMs,
      recentWithinMs,
      futureToleranceMs,
    };
  }

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) {
    return {
      state: "invalid",
      timestamp: value,
      ageMs: null,
      ageHours: null,
      checkedAt,
      currentWithinMs,
      recentWithinMs,
      futureToleranceMs,
    };
  }

  const ageMs = now.getTime() - parsed;
  const state: TimestampFreshnessState =
    ageMs < -futureToleranceMs
      ? "future"
      : ageMs <= currentWithinMs
        ? "current"
        : ageMs <= recentWithinMs
          ? "recent"
          : "stale";

  return {
    state,
    timestamp: new Date(parsed).toISOString(),
    ageMs,
    ageHours: rounded(Math.max(0, ageMs) / HOUR_MS, 2),
    checkedAt,
    currentWithinMs,
    recentWithinMs,
    futureToleranceMs,
  };
}

export function isTimestampWithin(
  value: string | null | undefined,
  maximumAgeMs: number,
  options: {
    now?: Date;
    futureToleranceMs?: number;
  } = {},
) {
  const now = options.now ?? new Date();
  const futureToleranceMs =
    options.futureToleranceMs ?? DEFAULT_FUTURE_TOLERANCE_MS;
  const parsed = finiteDate(value);

  if (parsed === null) return false;

  const ageMs = now.getTime() - parsed;
  return ageMs >= -futureToleranceMs && ageMs <= maximumAgeMs;
}

function publicArticleRank(article: PublicArticle, nowMs: number) {
  const published = finiteDate(article.publishedAt) ?? 0;
  const ageHours = Math.max(0, (nowMs - published) / HOUR_MS);
  const recencyBoost = Math.max(0, 42 - ageHours * 0.24);
  const alertBoost = article.shouldAlert ? 6 : 0;
  const relevanceBoost =
    typeof article.relevanceScore === "number" &&
    Number.isFinite(article.relevanceScore)
      ? Math.max(0, Math.min(1, article.relevanceScore)) * 8
      : 0;

  return article.score + recencyBoost + alertBoost + relevanceBoost;
}

function sortFreshPublicArticles(
  articles: PublicArticle[],
  nowMs: number,
) {
  return [...articles].sort((left, right) => {
    const rankDelta =
      publicArticleRank(right, nowMs) -
      publicArticleRank(left, nowMs);

    if (Math.abs(rankDelta) > 0.0001) return rankDelta;

    const publishedDelta =
      (finiteDate(right.publishedAt) ?? 0) -
      (finiteDate(left.publishedAt) ?? 0);

    if (publishedDelta) return publishedDelta;
    return right.score - left.score;
  });
}

export function selectDiversePublicArticles(
  articles: PublicArticle[],
  limit: number,
  options: {
    maximumPerSource?: number;
  } = {},
) {
  const safeLimit = Math.max(0, Math.floor(limit));
  if (!safeLimit) return [];

  const maximumPerSource = Math.max(
    1,
    Math.floor(options.maximumPerSource ?? 2),
  );
  const selected: PublicArticle[] = [];
  const selectedIds = new Set<string>();
  const sourceCounts = new Map<string, number>();

  for (const article of articles) {
    if (selected.length >= safeLimit) break;

    const source =
      normalizeKey(article.sourceDomain || article.sourceName) ||
      "unknown-source";
    const count = sourceCounts.get(source) ?? 0;

    if (count >= maximumPerSource) continue;

    selected.push(article);
    selectedIds.add(article.id);
    sourceCounts.set(source, count + 1);
  }

  if (selected.length < safeLimit) {
    for (const article of articles) {
      if (selected.length >= safeLimit) break;
      if (selectedIds.has(article.id)) continue;
      selected.push(article);
      selectedIds.add(article.id);
    }
  }

  return selected;
}

export function filterFreshPublicArticles(
  articles: PublicArticle[],
  options: {
    now?: Date;
    maximumAgeMs?: number;
    futureToleranceMs?: number;
    limit?: number;
    maximumPerSource?: number;
  } = {},
): PublicArticleFreshnessResult {
  const now = options.now ?? new Date();
  const nowMs = now.getTime();
  const maximumAgeMs = Math.max(
    HOUR_MS,
    options.maximumAgeMs ?? DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS,
  );
  const futureToleranceMs = Math.max(
    0,
    options.futureToleranceMs ?? DEFAULT_FUTURE_TOLERANCE_MS,
  );
  const cutoffAt = new Date(nowMs - maximumAgeMs).toISOString();
  const rejected: FreshnessRejections = {
    missingTimestamp: 0,
    invalidTimestamp: 0,
    futureTimestamp: 0,
    tooOld: 0,
    duplicate: 0,
  };
  const accepted: PublicArticle[] = [];
  const seen = new Set<string>();

  for (const article of articles) {
    if (!article.publishedAt) {
      rejected.missingTimestamp += 1;
      continue;
    }

    const published = finiteDate(article.publishedAt);

    if (published === null) {
      rejected.invalidTimestamp += 1;
      continue;
    }

    const ageMs = nowMs - published;

    if (ageMs < -futureToleranceMs) {
      rejected.futureTimestamp += 1;
      continue;
    }

    if (ageMs > maximumAgeMs) {
      rejected.tooOld += 1;
      continue;
    }

    const primaryKey = normalizeKey(article.link || article.title);
    const titleKey = normalizeKey(article.title);

    if (
      !primaryKey ||
      seen.has(primaryKey) ||
      (titleKey && seen.has(titleKey))
    ) {
      rejected.duplicate += 1;
      continue;
    }

    seen.add(primaryKey);
    if (titleKey) seen.add(titleKey);

    accepted.push({
      ...article,
      publishedAt: new Date(published).toISOString(),
    });
  }

  const ranked = sortFreshPublicArticles(accepted, nowMs);
  const items =
    options.limit === undefined
      ? ranked
      : selectDiversePublicArticles(
          ranked,
          Math.max(0, Math.floor(options.limit)),
          {
            maximumPerSource: options.maximumPerSource,
          },
        );
  const timestamps = items
    .map((article) => finiteDate(article.publishedAt))
    .filter((value): value is number => value !== null)
    .sort((left, right) => left - right);

  return {
    items,
    rejected,
    checkedAt: now.toISOString(),
    cutoffAt,
    maximumAgeMs,
    futureToleranceMs,
    newestPublishedAt: timestamps.length
      ? new Date(timestamps[timestamps.length - 1]).toISOString()
      : null,
    oldestPublishedAt: timestamps.length
      ? new Date(timestamps[0]).toISOString()
      : null,
  };
}

export function buildPublicTopicCounts(
  articles: PublicArticle[],
  limit = 18,
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
    .map(([topic, count]) => ({ topic, count }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        left.topic.localeCompare(right.topic),
    )
    .slice(0, Math.max(1, Math.floor(limit)));
}

export function freshnessRejectionMessage(
  rejected: FreshnessRejections,
) {
  const parts = [
    rejected.tooOld
      ? `${rejected.tooOld} outside the freshness window`
      : "",
    rejected.missingTimestamp
      ? `${rejected.missingTimestamp} without publication time`
      : "",
    rejected.invalidTimestamp
      ? `${rejected.invalidTimestamp} with invalid publication time`
      : "",
    rejected.futureTimestamp
      ? `${rejected.futureTimestamp} future-dated`
      : "",
    rejected.duplicate
      ? `${rejected.duplicate} duplicate`
      : "",
  ].filter(Boolean);

  return parts.length
    ? `Freshness validation excluded ${parts.join(", ")}.`
    : "";
}

export function freshenPublicSnapshot(
  snapshot: PublicIntelligenceSnapshot,
  options: {
    now?: Date;
    maximumAgeMs?: number;
    futureToleranceMs?: number;
    limit?: number;
    maximumPerSource?: number;
  } = {},
) {
  const freshness = filterFreshPublicArticles(
    snapshot.items,
    options,
  );
  const items = freshness.items;
  const rejectionWarning = freshnessRejectionMessage(
    freshness.rejected,
  );
  const warnings = uniqueStrings(
    [
      ...snapshot.warnings,
      rejectionWarning,
      items.length
        ? ""
        : "No source article passed the current publication-time freshness contract.",
    ],
    30,
  );

  return {
    snapshot: {
      ...snapshot,
      items,
      alertCandidates: items.filter((item) => item.shouldAlert),
      digestCandidates: items.filter(
        (item) => !item.shouldAlert && item.score >= 55,
      ),
      suppressed: items.filter((item) => item.score < 55),
      topicCounts: buildPublicTopicCounts(items),
      warnings,
    } satisfies PublicIntelligenceSnapshot,
    freshness,
  };
}

function filterScoredNewsItems(
  items: ScoredNewsItem[],
  input: {
    now: Date;
    maximumAgeMs: number;
    futureToleranceMs: number;
  },
) {
  const accepted: ScoredNewsItem[] = [];
  const rejected: FreshnessRejections = {
    missingTimestamp: 0,
    invalidTimestamp: 0,
    futureTimestamp: 0,
    tooOld: 0,
    duplicate: 0,
  };
  const nowMs = input.now.getTime();
  const seen = new Set<string>();

  for (const item of items) {
    if (!item.publishedAt) {
      rejected.missingTimestamp += 1;
      continue;
    }

    const published = finiteDate(item.publishedAt);

    if (published === null) {
      rejected.invalidTimestamp += 1;
      continue;
    }

    const ageMs = nowMs - published;

    if (ageMs < -input.futureToleranceMs) {
      rejected.futureTimestamp += 1;
      continue;
    }

    if (ageMs > input.maximumAgeMs) {
      rejected.tooOld += 1;
      continue;
    }

    const key = normalizeKey(item.link || item.title);
    const titleKey = normalizeKey(item.title);

    if (
      !key ||
      seen.has(key) ||
      (titleKey && seen.has(titleKey))
    ) {
      rejected.duplicate += 1;
      continue;
    }

    seen.add(key);
    if (titleKey) seen.add(titleKey);

    accepted.push({
      ...item,
      publishedAt: new Date(published).toISOString(),
    });
  }

  return {
    items: accepted.sort((left, right) => {
      const publishedDelta =
        (finiteDate(right.publishedAt) ?? 0) -
        (finiteDate(left.publishedAt) ?? 0);

      return publishedDelta || right.score - left.score;
    }),
    rejected,
  };
}

export function filterFreshScanResult(
  scan: ScanResult,
  options: {
    now?: Date;
    maximumAgeMs?: number;
    futureToleranceMs?: number;
  } = {},
): ScanFreshnessResult {
  const now = options.now ?? new Date();
  const maximumAgeMs = Math.max(
    HOUR_MS,
    options.maximumAgeMs ?? DEFAULT_RESEARCH_NEWS_MAX_AGE_MS,
  );
  const futureToleranceMs = Math.max(
    0,
    options.futureToleranceMs ?? DEFAULT_FUTURE_TOLERANCE_MS,
  );
  const filtered = filterScoredNewsItems(scan.items, {
    now,
    maximumAgeMs,
    futureToleranceMs,
  });
  const itemIds = new Set(filtered.items.map((item) => item.id));

  return {
    result: {
      ...scan,
      items: filtered.items,
      alertCandidates: scan.alertCandidates.filter((item) =>
        itemIds.has(item.id),
      ),
      digestCandidates: scan.digestCandidates.filter((item) =>
        itemIds.has(item.id),
      ),
      suppressed: scan.suppressed.filter((item) =>
        itemIds.has(item.id),
      ),
    },
    rejected: filtered.rejected,
    checkedAt: now.toISOString(),
    cutoffAt: new Date(
      now.getTime() - maximumAgeMs,
    ).toISOString(),
    maximumAgeMs,
    futureToleranceMs,
  };
}
