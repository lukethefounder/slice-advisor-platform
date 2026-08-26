import "server-only";

import { randomUUID } from "node:crypto";

import {
  DEMO_SLICE_PROFILE,
  scanPermittedSources,
  type ScanResult,
  type ScoredNewsItem,
} from "@/lib/intelligence";
import {
  DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS,
  DEFAULT_PUBLIC_EDITION_MAX_AGE_MS,
  freshenPublicSnapshot,
  freshnessRejectionMessage,
} from "@/lib/intelligence/freshness";
import { prisma } from "@/lib/prisma";
import type {
  PublicArticle,
  PublicIntelligenceSnapshot,
  PublicSourceStatus,
  PublicUrgency,
} from "@/lib/public-intelligence-types";

const ALPHA_VANTAGE_ENDPOINT =
  "https://www.alphavantage.co/query";
const SNAPSHOT_TITLE =
  "__SLICE_PUBLIC_INTELLIGENCE_SNAPSHOT_V2__";
const CHECKPOINT_ID = "slice-public-intelligence-v2";
const RETENTION_MS = 30 * 24 * 60 * 60_000;
const DEFAULT_MAX_AGE_MS =
  DEFAULT_PUBLIC_EDITION_MAX_AGE_MS;
const DEFAULT_ALPHA_NEWS_LIMIT = 200;
const MARKET_TIME_ZONE = "America/New_York" as const;
const DAILY_REFRESH_CADENCE =
  "Published daily at 6:00 AM Eastern Time with a six-hour recovery check; only source articles published within the last seven days are eligible";

type AlphaNewsTicker = {
  ticker?: unknown;
  relevance_score?: unknown;
  ticker_sentiment_score?: unknown;
  ticker_sentiment_label?: unknown;
};

type AlphaNewsTopic = {
  topic?: unknown;
  relevance_score?: unknown;
};

type AlphaNewsFeedItem = {
  title?: unknown;
  url?: unknown;
  time_published?: unknown;
  authors?: unknown;
  summary?: unknown;
  banner_image?: unknown;
  source?: unknown;
  source_domain?: unknown;
  topics?: unknown;
  overall_sentiment_score?: unknown;
  overall_sentiment_label?: unknown;
  ticker_sentiment?: unknown;
};

type AlphaNewsPayload = {
  feed?: unknown;
  items?: unknown;
  Information?: unknown;
  Note?: unknown;
  "Error Message"?: unknown;
};

type AlphaNewsResult = {
  articles: PublicArticle[];
  status: PublicSourceStatus;
  warning?: string;
};

type PersistenceResult =
  | {
      persisted: true;
      storage: "database";
      batchId: string;
      savedAt: string;
    }
  | {
      persisted: false;
      storage: "memory";
      warning: string;
    };

type StoredSnapshotEnvelope = {
  version: 2;
  batchId: string;
  savedAt: string;
  snapshot: PublicIntelligenceSnapshot;
};

type PublicIntelligenceTransaction = {
  newsDecision: {
    create(input: unknown): Promise<unknown>;
    deleteMany(input: unknown): Promise<unknown>;
  };
  sourceCheckpoint: {
    upsert(input: unknown): Promise<unknown>;
  };
};

declare global {
  // eslint-disable-next-line no-var
  var __slicePublicIntelligenceSnapshot:
    | PublicIntelligenceSnapshot
    | undefined;
  // eslint-disable-next-line no-var
  var __slicePublicIntelligenceRefresh:
    | Promise<{
        snapshot: PublicIntelligenceSnapshot;
        persistence: PersistenceResult;
      }>
    | undefined;
}

function clamp(
  value: number,
  minimum: number,
  maximum: number,
) {
  return Math.max(minimum, Math.min(maximum, value));
}

function toNumber(value: unknown, fallback = 0) {
  if (
    typeof value === "number" &&
    Number.isFinite(value)
  ) {
    return value;
  }

  const parsed = Number(
    String(value ?? "")
      .replace(/[,%]/g, "")
      .trim(),
  );

  return Number.isFinite(parsed) ? parsed : fallback;
}

function cleanString(
  value: unknown,
  maximumLength = 4_000,
) {
  return typeof value === "string"
    ? value
        .replace(/\s+/g, " ")
        .trim()
        .slice(0, maximumLength)
    : "";
}

function unique(
  values: Array<string | null | undefined>,
  limit = 30,
) {
  return Array.from(
    new Set(
      values
        .map((value) => String(value ?? "").trim())
        .filter(Boolean),
    ),
  ).slice(0, limit);
}

function stableHash(value: string) {
  let hash = 2_166_136_261;

  for (
    let index = 0;
    index < value.length;
    index += 1
  ) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16_777_619);
  }

  return Math.abs(hash >>> 0).toString(36);
}

function parseAlphaTimestamp(value: unknown) {
  const raw = cleanString(value, 40);
  const match = raw.match(
    /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
  );

  if (!match) {
    const parsed = Date.parse(raw);
    return Number.isFinite(parsed)
      ? new Date(parsed).toISOString()
      : undefined;
  }

  const [, year, month, day, hour, minute, second] =
    match;

  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour),
      Number(minute),
      Number(second),
    ),
  ).toISOString();
}

function dateKey(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: MARKET_TIME_ZONE,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(date);
  const read = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((part) => part.type === type)?.value ??
    "";

  return `${read("year")}-${read("month")}-${read(
    "day",
  )}`;
}

function alphaTimeFrom(
  millisecondsBack = DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS,
) {
  const date = new Date(Date.now() - millisecondsBack);
  const pad = (value: number) =>
    String(value).padStart(2, "0");

  return `${date.getUTCFullYear()}${pad(
    date.getUTCMonth() + 1,
  )}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}`;
}

function normalizeUrl(value: unknown) {
  const raw = cleanString(value, 2_000);

  if (!raw) return "";

  try {
    const url = new URL(raw);

    return url.protocol === "https:" ||
      url.protocol === "http:"
      ? url.toString()
      : "";
  } catch {
    return "";
  }
}

function ageHours(value?: string) {
  if (!value) return 168;

  const parsed = Date.parse(value);

  if (!Number.isFinite(parsed)) return 168;

  return Math.max(
    0,
    (Date.now() - parsed) / 3_600_000,
  );
}

function urgencyForScore(
  score: number,
  tickerRelevance: number,
): PublicUrgency {
  if (score >= 94 && tickerRelevance >= 0.7) {
    return "Critical";
  }
  if (score >= 82) return "High";
  if (score >= 64) return "Medium";
  return "Low";
}

function scoreAlphaArticle(input: {
  publishedAt?: string;
  overallSentiment: number;
  tickerRelevance: number;
  topicRelevance: number;
  tickerCount: number;
  themeCount: number;
}) {
  const hours = ageHours(input.publishedAt);
  const freshness = clamp(
    100 - hours * 0.55,
    0,
    100,
  );
  const sentimentMagnitude = clamp(
    Math.abs(input.overallSentiment) * 100,
    0,
    100,
  );
  const relevance = clamp(
    input.tickerRelevance * 100,
    0,
    100,
  );
  const topic = clamp(
    input.topicRelevance * 100,
    0,
    100,
  );
  const breadth = clamp(
    input.tickerCount * 4 +
      input.themeCount * 3,
    0,
    18,
  );

  return clamp(
    Math.round(
      38 +
        freshness * 0.22 +
        relevance * 0.2 +
        topic * 0.08 +
        sentimentMagnitude * 0.08 +
        breadth,
    ),
    42,
    98,
  );
}

function alphaProviderError(
  payload: AlphaNewsPayload,
) {
  return (
    cleanString(payload["Error Message"], 1_000) ||
    cleanString(payload.Information, 1_000) ||
    cleanString(payload.Note, 1_000) ||
    ""
  );
}

function alphaNewsLimit() {
  const configured = Number(
    process.env.ALPHA_VANTAGE_PUBLIC_NEWS_LIMIT,
  );

  return Number.isFinite(configured)
    ? clamp(Math.round(configured), 50, 1_000)
    : DEFAULT_ALPHA_NEWS_LIMIT;
}

function parseAlphaArticle(
  item: AlphaNewsFeedItem,
  index: number,
): PublicArticle | null {
  const title = cleanString(item.title, 1_000);
  const link = normalizeUrl(item.url);

  if (!title || !link) return null;

  const summary = cleanString(item.summary, 5_000);
  const publishedAt = parseAlphaTimestamp(
    item.time_published,
  );
  const sourceName =
    cleanString(item.source, 240) ||
    "Alpha Vantage News";
  const sourceDomain = cleanString(
    item.source_domain,
    300,
  );
  const tickerEntries = Array.isArray(
    item.ticker_sentiment,
  )
    ? (item.ticker_sentiment as AlphaNewsTicker[])
    : [];
  const topicEntries = Array.isArray(item.topics)
    ? (item.topics as AlphaNewsTopic[])
    : [];
  const matchedTickers = unique(
    tickerEntries
      .filter(
        (entry) =>
          toNumber(entry.relevance_score) >= 0.12,
      )
      .map((entry) =>
        cleanString(entry.ticker, 40).toUpperCase(),
      ),
    12,
  );
  const matchedThemes = unique(
    topicEntries
      .filter(
        (entry) =>
          toNumber(entry.relevance_score) >= 0.08,
      )
      .map((entry) =>
        cleanString(entry.topic, 160),
      ),
    12,
  );
  const tickerRelevance = tickerEntries.reduce(
    (maximum, entry) =>
      Math.max(
        maximum,
        toNumber(entry.relevance_score),
      ),
    0,
  );
  const topicRelevance = topicEntries.reduce(
    (maximum, entry) =>
      Math.max(
        maximum,
        toNumber(entry.relevance_score),
      ),
    0,
  );
  const overallSentiment = toNumber(
    item.overall_sentiment_score,
  );
  const sentimentLabel = cleanString(
    item.overall_sentiment_label,
    120,
  );
  const score = scoreAlphaArticle({
    publishedAt,
    overallSentiment,
    tickerRelevance,
    topicRelevance,
    tickerCount: matchedTickers.length,
    themeCount: matchedThemes.length,
  });
  const urgency = urgencyForScore(
    score,
    tickerRelevance,
  );
  const shouldAlert =
    urgency === "Critical" ||
    (urgency === "High" &&
      tickerRelevance >= 0.35);
  const hours = ageHours(publishedAt);
  const reasons = unique([
    publishedAt
      ? `Published ${
          hours < 1
            ? "within the last hour"
            : `${Math.round(hours)} hours ago`
        }.`
      : "Publication time was not supplied by the provider.",
    tickerRelevance > 0
      ? `Highest ticker relevance: ${Math.round(
          tickerRelevance * 100,
        )}%.`
      : "Broad-market article without a dominant ticker match.",
    topicRelevance > 0
      ? `Highest topic relevance: ${Math.round(
          topicRelevance * 100,
        )}%.`
      : "Provider topic relevance was not available.",
    sentimentLabel
      ? `Provider sentiment: ${sentimentLabel}.`
      : "Sentiment label unavailable.",
    matchedThemes.length
      ? `Themes: ${matchedThemes
          .slice(0, 4)
          .join(", ")}.`
      : null,
  ]);
  const authors = Array.isArray(item.authors)
    ? unique(
        item.authors.map((author) =>
          cleanString(author, 200),
        ),
        10,
      )
    : [];

  return {
    id: `alpha-${stableHash(
      `${link}:${title}:${index}`,
    )}`,
    sourceName,
    sourceDomain,
    sourceKind: "alpha-vantage-news",
    sourceTier: "provider-aggregated",
    sourceCategory: "market-news",
    title,
    summary,
    link,
    publishedAt,
    score,
    urgency,
    matchedTickers,
    matchedCompanies: [],
    matchedThemes,
    reasons,
    shouldAlert,
    channels: shouldAlert
      ? ["Dashboard", "Digest"]
      : ["Digest"],
    complianceLabel:
      "Sourced market intelligence. Verify the original article before client-specific use.",
    alertCopy: `${urgency}: ${title}`,
    sentimentScore: overallSentiment,
    sentimentLabel,
    relevanceScore: tickerRelevance,
    bannerImage: normalizeUrl(item.banner_image),
    authors,
  };
}

async function fetchAlphaVantageNews(): Promise<AlphaNewsResult> {
  const checkedAt = new Date().toISOString();
  const apiKey = cleanString(
    process.env.ALPHA_VANTAGE_API_KEY,
    500,
  );

  if (!apiKey) {
    return {
      articles: [],
      status: {
        id: "alpha-vantage-news",
        name: "Alpha Vantage Market News & Sentiment",
        ok: false,
        fetched: 0,
        provider: "Alpha Vantage",
        paid: true,
        error:
          "ALPHA_VANTAGE_API_KEY is not configured.",
        checkedAt,
      },
      warning:
        "Alpha Vantage news was skipped because its server-side API key is not configured.",
    };
  }

  const controller = new AbortController();
  const timeout = setTimeout(
    () => controller.abort(),
    15_000,
  );

  try {
    const url = new URL(ALPHA_VANTAGE_ENDPOINT);
    url.searchParams.set("function", "NEWS_SENTIMENT");
    url.searchParams.set("sort", "LATEST");
    url.searchParams.set(
      "limit",
      String(alphaNewsLimit()),
    );
    url.searchParams.set(
      "time_from",
      alphaTimeFrom(),
    );
    url.searchParams.set("apikey", apiKey);

    const response = await fetch(url, {
      cache: "no-store",
      signal: controller.signal,
      headers: {
        Accept: "application/json",
        "User-Agent":
          "SlicePublicIntelligence/3.0",
      },
    });

    if (!response.ok) {
      throw new Error(
        `Alpha Vantage NEWS_SENTIMENT returned HTTP ${response.status}.`,
      );
    }

    const payload =
      (await response.json()) as AlphaNewsPayload;
    const providerError =
      alphaProviderError(payload);

    if (providerError) {
      throw new Error(providerError);
    }

    const feed = Array.isArray(payload.feed)
      ? (payload.feed as AlphaNewsFeedItem[])
      : [];
    const articles = feed
      .map(parseAlphaArticle)
      .filter(
        (article): article is PublicArticle =>
          Boolean(article),
      );

    return {
      articles,
      status: {
        id: "alpha-vantage-news",
        name: "Alpha Vantage Market News & Sentiment",
        ok: true,
        fetched: articles.length,
        provider: "Alpha Vantage",
        paid: true,
        checkedAt,
      },
    };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown Alpha Vantage news error.";

    return {
      articles: [],
      status: {
        id: "alpha-vantage-news",
        name: "Alpha Vantage Market News & Sentiment",
        ok: false,
        fetched: 0,
        provider: "Alpha Vantage",
        paid: true,
        error: message,
        checkedAt,
      },
      warning: `Alpha Vantage news scan was unavailable: ${message}`,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function mapOfficialArticle(
  item: ScoredNewsItem,
): PublicArticle {
  return {
    id: `official-${item.id}`,
    sourceName: item.sourceName,
    sourceKind:
      item.sourceTier === "advisor-paid" ||
      item.sourceTier === "advisor-authorized"
        ? "advisor-source"
        : "official-feed",
    sourceTier: item.sourceTier,
    sourceCategory: item.sourceCategory,
    title: item.title,
    summary: item.summary,
    link: item.link,
    publishedAt: item.publishedAt,
    score: item.score,
    urgency: item.urgency,
    matchedTickers: item.matchedTickers,
    matchedCompanies: item.matchedCompanies,
    matchedThemes: item.matchedThemes,
    reasons: item.reasons,
    shouldAlert: item.shouldAlert,
    channels: item.channels,
    complianceLabel: item.complianceLabel,
    alertCopy: item.alertCopy,
  };
}

function sourceStatuses(
  result: ScanResult,
  checkedAt: string,
): PublicSourceStatus[] {
  return result.sources.map((source) => ({
    id: source.id,
    name: source.name,
    ok: source.ok,
    fetched: source.fetched,
    provider: "Slice official feeds",
    paid: source.paid,
    error: source.error,
    checkedAt,
  }));
}

function snapshotAge(
  snapshot: PublicIntelligenceSnapshot,
) {
  const parsed = Date.parse(snapshot.generatedAt);

  return Number.isFinite(parsed)
    ? Date.now() - parsed
    : Number.POSITIVE_INFINITY;
}

function normalizeSnapshot(
  value: unknown,
): PublicIntelligenceSnapshot | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const candidate =
    value as Partial<PublicIntelligenceSnapshot>;

  if (
    candidate.schemaVersion !==
      "slice-public-intelligence-2.0.0" ||
    !candidate.generatedAt ||
    !Array.isArray(candidate.items) ||
    !Array.isArray(candidate.sources)
  ) {
    return null;
  }

  const normalized: PublicIntelligenceSnapshot = {
    schemaVersion:
      "slice-public-intelligence-2.0.0",
    generatedAt: candidate.generatedAt,
    dateKey:
      candidate.dateKey ||
      dateKey(new Date(candidate.generatedAt)),
    marketTimeZone: MARKET_TIME_ZONE,
    provider: "Slice Public Intelligence Mesh",
    refreshCadence: DAILY_REFRESH_CADENCE,
    storage: candidate.storage ?? "database",
    sources: candidate.sources,
    items: candidate.items,
    alertCandidates: Array.isArray(
      candidate.alertCandidates,
    )
      ? candidate.alertCandidates
      : [],
    digestCandidates: Array.isArray(
      candidate.digestCandidates,
    )
      ? candidate.digestCandidates
      : [],
    suppressed: Array.isArray(candidate.suppressed)
      ? candidate.suppressed
      : [],
    topicCounts: Array.isArray(candidate.topicCounts)
      ? candidate.topicCounts
      : [],
    warnings: Array.isArray(candidate.warnings)
      ? candidate.warnings
      : [],
  };

  return freshenPublicSnapshot(normalized, {
    maximumAgeMs:
      DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS,
    limit: 160,
  }).snapshot;
}

function parseStoredEnvelope(
  value: string,
): StoredSnapshotEnvelope | null {
  try {
    const parsed =
      JSON.parse(
        value,
      ) as Partial<StoredSnapshotEnvelope>;

    if (
      parsed.version !== 2 ||
      !parsed.batchId ||
      !parsed.savedAt ||
      !parsed.snapshot
    ) {
      return null;
    }

    const snapshot = normalizeSnapshot(
      parsed.snapshot,
    );

    return snapshot
      ? {
          version: 2,
          batchId: parsed.batchId,
          savedAt: parsed.savedAt,
          snapshot,
        }
      : null;
  } catch {
    return null;
  }
}

async function readDatabaseSnapshot() {
  const row = await prisma.newsDecision.findFirst({
    where: {
      title: SNAPSHOT_TITLE,
      sourceName:
        "Slice Public Intelligence Mesh",
    },
    orderBy: {
      createdAt: "desc",
    },
    select: {
      reasonsJson: true,
      createdAt: true,
    },
  });

  if (!row) return null;

  const envelope = parseStoredEnvelope(
    row.reasonsJson,
  );

  if (!envelope) return null;

  return {
    ...envelope.snapshot,
    storage: "database" as const,
  };
}

async function persistSnapshot(
  snapshot: PublicIntelligenceSnapshot,
) {
  const savedAt = new Date();
  const batchId = randomUUID();
  const envelope: StoredSnapshotEnvelope = {
    version: 2,
    batchId,
    savedAt: savedAt.toISOString(),
    snapshot: {
      ...snapshot,
      storage: "database",
    },
  };
  const onlineSources = snapshot.sources.filter(
    (source) => source.ok,
  ).length;

  await prisma.$transaction(
    async (transaction: PublicIntelligenceTransaction) => {
      await transaction.newsDecision.create({
        data: {
          title: SNAPSHOT_TITLE,
          sourceName:
            "Slice Public Intelligence Mesh",
          link: null,
          score: Math.min(
            snapshot.items.length,
            999,
          ),
          urgency: "System",
          shouldAlert: false,
          reasonsJson: JSON.stringify(envelope),
          createdAt: savedAt,
        },
      });

      await transaction.sourceCheckpoint.upsert({
        where: {
          sourceId: CHECKPOINT_ID,
        },
        update: {
          sourceName:
            "Slice Public Intelligence Mesh",
          lastFetchedAt: savedAt,
          lastSeenHash: batchId,
          lastStatus:
            onlineSources === snapshot.sources.length
              ? "Healthy"
              : onlineSources > 0
                ? "Degraded"
                : "Failed",
          lastItemCount: snapshot.items.length,
        },
        create: {
          sourceId: CHECKPOINT_ID,
          sourceName:
            "Slice Public Intelligence Mesh",
          lastFetchedAt: savedAt,
          lastSeenHash: batchId,
          lastStatus:
            onlineSources === snapshot.sources.length
              ? "Healthy"
              : onlineSources > 0
                ? "Degraded"
                : "Failed",
          lastItemCount: snapshot.items.length,
        },
      });

      await transaction.newsDecision.deleteMany({
        where: {
          title: SNAPSHOT_TITLE,
          sourceName:
            "Slice Public Intelligence Mesh",
          createdAt: {
            lt: new Date(
              savedAt.getTime() - RETENTION_MS,
            ),
          },
        },
      });
    },
  );

  return {
    persisted: true as const,
    storage: "database" as const,
    batchId,
    savedAt: savedAt.toISOString(),
  };
}

export async function scoutPublicIntelligence(): Promise<PublicIntelligenceSnapshot> {
  const generatedAt = new Date().toISOString();
  const [officialResult, alphaResult] =
    await Promise.allSettled([
      scanPermittedSources(
        DEMO_SLICE_PROFILE,
        [],
      ),
      fetchAlphaVantageNews(),
    ]);
  const warnings: string[] = [];
  let officialArticles: PublicArticle[] = [];
  let officialSources: PublicSourceStatus[] = [];

  if (officialResult.status === "fulfilled") {
    officialArticles =
      officialResult.value.items.map(
        mapOfficialArticle,
      );
    officialSources = sourceStatuses(
      officialResult.value,
      generatedAt,
    );
  } else {
    warnings.push(
      `Official feed scan failed: ${
        officialResult.reason instanceof Error
          ? officialResult.reason.message
          : String(officialResult.reason)
      }`,
    );
  }

  let alphaArticles: PublicArticle[] = [];
  let alphaStatus: PublicSourceStatus = {
    id: "alpha-vantage-news",
    name: "Alpha Vantage Market News & Sentiment",
    ok: false,
    fetched: 0,
    provider: "Alpha Vantage",
    paid: true,
    error:
      "Alpha Vantage scan did not complete.",
    checkedAt: generatedAt,
  };

  if (alphaResult.status === "fulfilled") {
    alphaArticles = alphaResult.value.articles;
    alphaStatus = alphaResult.value.status;

    if (alphaResult.value.warning) {
      warnings.push(alphaResult.value.warning);
    }
  } else {
    warnings.push(
      `Alpha Vantage news scan failed: ${
        alphaResult.reason instanceof Error
          ? alphaResult.reason.message
          : String(alphaResult.reason)
      }`,
    );
  }

  const baseSnapshot: PublicIntelligenceSnapshot = {
    schemaVersion:
      "slice-public-intelligence-2.0.0",
    generatedAt,
    dateKey: dateKey(),
    marketTimeZone: MARKET_TIME_ZONE,
    provider: "Slice Public Intelligence Mesh",
    refreshCadence: DAILY_REFRESH_CADENCE,
    storage: "fresh",
    sources: [...officialSources, alphaStatus],
    items: [
      ...officialArticles,
      ...alphaArticles,
    ],
    alertCandidates: [],
    digestCandidates: [],
    suppressed: [],
    topicCounts: [],
    warnings: unique(warnings),
  };
  const freshened = freshenPublicSnapshot(
    baseSnapshot,
    {
      maximumAgeMs:
        DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS,
      limit: 160,
      maximumPerSource: 12,
    },
  );

  return {
    ...freshened.snapshot,
    warnings: unique([
      ...freshened.snapshot.warnings,
      freshnessRejectionMessage(
        freshened.freshness.rejected,
      ),
    ]),
  };
}

export async function scoutAndPersistPublicIntelligence() {
  if (
    globalThis.__slicePublicIntelligenceRefresh
  ) {
    return globalThis.__slicePublicIntelligenceRefresh;
  }

  const refresh = (async () => {
    const current =
      await scoutPublicIntelligence();

    if (!current.items.length) {
      throw new Error(
        "No source article passed the seven-day publication-time freshness contract. The prior durable edition was retained.",
      );
    }

    let prior: PublicIntelligenceSnapshot | null =
      null;

    try {
      prior = await readDatabaseSnapshot();
    } catch {
      prior = null;
    }

    const mergedBase: PublicIntelligenceSnapshot = {
      ...current,
      items: [
        ...current.items,
        ...(prior?.items ?? []),
      ],
      warnings: unique([
        ...current.warnings,
        prior
          ? "Recent articles from the prior edition were eligible to fill source-diverse coverage; every retained article still passed the seven-day cutoff."
          : "",
      ]),
    };
    const merged = freshenPublicSnapshot(
      mergedBase,
      {
        maximumAgeMs:
          DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS,
        limit: 160,
        maximumPerSource: 12,
      },
    ).snapshot;

    let persistence: PersistenceResult;
    let enriched: PublicIntelligenceSnapshot;

    try {
      persistence = await persistSnapshot(merged);
      enriched = {
        ...merged,
        storage: "database",
      };
    } catch (error) {
      const warning =
        error instanceof Error
          ? `Durable public-intelligence persistence failed: ${error.message}`
          : "Durable public-intelligence persistence failed.";

      persistence = {
        persisted: false,
        storage: "memory",
        warning,
      };
      enriched = {
        ...merged,
        storage: "memory",
        warnings: unique([
          ...merged.warnings,
          warning,
        ]),
      };
    }

    globalThis.__slicePublicIntelligenceSnapshot =
      enriched;

    return {
      snapshot: enriched,
      persistence,
    };
  })().finally(() => {
    globalThis.__slicePublicIntelligenceRefresh =
      undefined;
  });

  globalThis.__slicePublicIntelligenceRefresh =
    refresh;

  return refresh;
}

export async function getPublicIntelligence(
  options?: {
    forceRefresh?: boolean;
    maxAgeMs?: number;
    allowRefresh?: boolean;
  },
) {
  const forceRefresh =
    options?.forceRefresh ?? false;
  const allowRefresh =
    options?.allowRefresh ??
    process.env.NODE_ENV !== "production";
  const maxAgeMs = clamp(
    options?.maxAgeMs ?? DEFAULT_MAX_AGE_MS,
    60_000,
    7 * 24 * 60 * 60_000,
  );

  if (forceRefresh) {
    const { snapshot } =
      await scoutAndPersistPublicIntelligence();
    return snapshot;
  }

  const memory =
    globalThis.__slicePublicIntelligenceSnapshot;

  if (memory) {
    const freshMemory = freshenPublicSnapshot(
      memory,
      {
        maximumAgeMs:
          DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS,
        limit: 160,
      },
    ).snapshot;

    if (
      freshMemory.items.length &&
      snapshotAge(freshMemory) <= maxAgeMs
    ) {
      return {
        ...freshMemory,
        refreshCadence:
          DAILY_REFRESH_CADENCE,
        storage: "memory" as const,
      };
    }
  }

  let stored: PublicIntelligenceSnapshot | null =
    null;
  let databaseError = "";

  try {
    stored = await readDatabaseSnapshot();
  } catch (error) {
    databaseError =
      error instanceof Error
        ? error.message
        : "The public intelligence database read failed.";
  }

  if (stored?.items.length) {
    const stale = snapshotAge(stored) > maxAgeMs;
    const result: PublicIntelligenceSnapshot = {
      ...stored,
      refreshCadence: DAILY_REFRESH_CADENCE,
      storage: stale ? "stale" : "database",
      warnings: stale
        ? unique([
            ...stored.warnings,
            "The stored daily edition is older than the preferred edition window. Its individual source articles still passed the strict seven-day cutoff.",
          ])
        : stored.warnings,
    };

    globalThis.__slicePublicIntelligenceSnapshot =
      result;

    return result;
  }

  if (memory) {
    const fallback = freshenPublicSnapshot(
      memory,
      {
        maximumAgeMs:
          DEFAULT_PUBLIC_ARTICLE_MAX_AGE_MS,
        limit: 160,
      },
    ).snapshot;

    if (fallback.items.length) {
      return {
        ...fallback,
        refreshCadence:
          DAILY_REFRESH_CADENCE,
        storage: "stale" as const,
        warnings: unique([
          ...fallback.warnings,
          databaseError
            ? `The durable edition could not be read, so Slice is exposing only still-current in-memory articles: ${databaseError}`
            : "The durable edition was unavailable, so Slice is exposing only still-current in-memory articles.",
        ]),
      };
    }
  }

  /*
   * Production page views do not launch provider scans. The protected
   * scheduled publisher and recovery cron own public-edition creation.
   */
  if (!allowRefresh) {
    throw new Error(
      databaseError
        ? "The scheduled daily intelligence edition could not be read from durable storage."
        : "No current scheduled daily intelligence edition is available.",
    );
  }

  try {
    const { snapshot } =
      await scoutAndPersistPublicIntelligence();

    return databaseError
      ? {
          ...snapshot,
          warnings: unique([
            ...snapshot.warnings,
            `Database cache unavailable before the development recovery scan: ${databaseError}`,
          ]),
        }
      : snapshot;
  } catch (error) {
    throw new Error(
      error instanceof Error
        ? `Public intelligence scan failed: ${error.message}`
        : "Public intelligence scan failed.",
    );
  }
}