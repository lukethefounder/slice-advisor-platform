import { prisma } from "@/lib/prisma";
import type { RawHeadline } from "@/lib/news-triage";

export type FetchableSource = {
  sourceId: string;
  name: string;
  sourceUrl: string | null;
  sourceTier: string;
  category?: string | null;
  enabled?: boolean | null;
  minScoreToRetain?: number | null;
  minScoreToAlert?: number | null;
  maxItemsPerRun?: number | null;
  cooldownMinutes?: number | null;
  priority?: number | null;
  lastRunAt?: Date | null;
};

export type FetchResult = {
  sourceId: string;
  sourceName: string;
  sourceUrl: string | null;
  sourceTier: string;
  category: string | null;
  ok: boolean;
  itemCount: number;
  skipped: boolean;
  status: "OK" | "Skipped" | "Error";
  parser: "rss" | "atom" | "json-feed" | "json-array" | "unknown";
  latencyMs: number;
  error?: string;
  headlines: RawHeadline[];
};

const MAX_LIVE_SOURCES_PER_RUN = 200;
const MAX_TOTAL_LIVE_HEADLINES = 600;
const DEFAULT_MAX_ITEMS_PER_SOURCE = 24;
const DEFAULT_COOLDOWN_MINUTES = 15;
const DEFAULT_TIMEOUT_MS = 9000;
const MAX_FETCH_RETRIES = 2;
const FETCH_CONCURRENCY = 12;

const STOP_WORDS = new Set([
  "about",
  "after",
  "again",
  "against",
  "amid",
  "among",
  "announces",
  "announcement",
  "before",
  "being",
  "between",
  "business",
  "could",
  "from",
  "have",
  "into",
  "market",
  "markets",
  "more",
  "news",
  "over",
  "public",
  "report",
  "reports",
  "said",
  "says",
  "shares",
  "stock",
  "stocks",
  "their",
  "this",
  "through",
  "under",
  "update",
  "with",
  "will",
]);

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string) {
  return decodeEntities(
    value
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]*>/g, " ")
  );
}

function compactText(value: unknown, fallback = "") {
  if (typeof value !== "string") return fallback;

  return stripHtml(value)
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 2500);
}

function extractTag(block: string, names: string[]) {
  for (const name of names) {
    const pattern = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i");
    const match = block.match(pattern);

    if (match?.[1]) {
      return compactText(match[1]);
    }
  }

  return "";
}

function extractLink(block: string) {
  const linkTag = extractTag(block, ["link"]);

  if (linkTag && /^https?:\/\//i.test(linkTag)) {
    return linkTag;
  }

  const atomLink =
    block.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["'][^>]*>/i)?.[1] ??
    block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1];

  return atomLink ? decodeEntities(atomLink) : "";
}

function normalizeSourceTier(value: string): RawHeadline["sourceTier"] {
  if (value === "official-regulatory") return "official-regulatory";
  if (value === "official-exchange") return "official-exchange";
  if (value === "macro-source") return "macro-source";
  if (value === "market-news") return "market-news";
  if (value === "crypto-source") return "crypto-source";
  if (value === "venture-source") return "venture-source";

  return "unknown";
}

function sourceTrustScore(sourceTier: string) {
  if (sourceTier === "official-regulatory") return 96;
  if (sourceTier === "official-exchange") return 94;
  if (sourceTier === "macro-source") return 88;
  if (sourceTier === "market-news") return 72;
  if (sourceTier === "crypto-source") return 62;
  if (sourceTier === "venture-source") return 60;
  return 42;
}

function sourceTrustLabel(sourceTier: string) {
  const score = sourceTrustScore(sourceTier);

  if (score >= 90) return "institutional-primary";
  if (score >= 80) return "high-trust";
  if (score >= 70) return "standard-news";
  if (score >= 60) return "specialized-watch";
  return "low-trust-open-web";
}

function maxItemsForSource(source: FetchableSource) {
  const value = source.maxItemsPerRun ?? DEFAULT_MAX_ITEMS_PER_SOURCE;

  if (!Number.isFinite(value)) {
    return DEFAULT_MAX_ITEMS_PER_SOURCE;
  }

  return Math.max(1, Math.min(100, Math.round(value)));
}

function cooldownMinutesForSource(source: FetchableSource) {
  const value = source.cooldownMinutes ?? DEFAULT_COOLDOWN_MINUTES;

  if (!Number.isFinite(value)) {
    return DEFAULT_COOLDOWN_MINUTES;
  }

  return Math.max(0, Math.round(value));
}

function isValidHttpUrl(value: string | null | undefined): value is string {
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" || url.protocol === "http:";
  } catch {
    return false;
  }
}

function isCoolingDown(source: FetchableSource) {
  if (!source.lastRunAt) return false;

  const msSinceRun = Date.now() - source.lastRunAt.getTime();
  const cooldownMs = cooldownMinutesForSource(source) * 60 * 1000;

  return msSinceRun < cooldownMs;
}

function headlineKey(headline: RawHeadline) {
  return `${headline.sourceId}:${headline.title}:${headline.url ?? ""}`
    .toLowerCase()
    .replace(/\s+/g, " ")
    .slice(0, 300);
}

function headlineText(headline: RawHeadline) {
  return `${headline.title} ${headline.summary ?? ""}`.toLowerCase();
}

function titleTerms(headline: RawHeadline) {
  return Array.from(
    new Set(
      `${headline.title} ${headline.summary ?? ""}`
        .toLowerCase()
        .replace(/[^a-z0-9$.\s-]/g, " ")
        .split(/\s+/)
        .map((term) => term.trim())
        .filter((term) => term.length >= 5 && !STOP_WORDS.has(term))
    )
  ).slice(0, 18);
}

function extractTickerHints(headline: RawHeadline) {
  const text = `${headline.title} ${headline.summary ?? ""}`;
  const dollarTickers = text.match(/\$[A-Z][A-Z0-9.-]{0,5}\b/g) ?? [];
  const parentheticalTickers = text.match(/\(([A-Z]{1,5})\)/g) ?? [];

  return Array.from(
    new Set(
      [
        ...dollarTickers.map((ticker) => ticker.replace("$", "")),
        ...parentheticalTickers.map((ticker) => ticker.replace(/[()]/g, "")),
      ]
        .map((ticker) => ticker.toUpperCase())
        .filter((ticker) => ticker.length >= 1 && ticker.length <= 6)
    )
  );
}

function parseRssOrAtom(
  raw: string,
  source: FetchableSource
): {
  parser: FetchResult["parser"];
  headlines: RawHeadline[];
} {
  const itemBlocks = raw.match(/<item[\s\S]*?<\/item>/gi) ?? [];
  const entryBlocks = raw.match(/<entry[\s\S]*?<\/entry>/gi) ?? [];
  const blocks = itemBlocks.length ? itemBlocks : entryBlocks;
  const parser = itemBlocks.length ? "rss" : entryBlocks.length ? "atom" : "unknown";

  const headlines = blocks.slice(0, maxItemsForSource(source)).map((block) => {
    const title = extractTag(block, ["title"]) || "Untitled source item";
    const summary = extractTag(block, ["description", "summary", "content", "content:encoded"]);
    const url = extractLink(block);
    const publishedAt = extractTag(block, ["pubDate", "updated", "published", "dc:date"]);

    return {
      sourceId: source.sourceId,
      sourceName: source.name,
      sourceTier: normalizeSourceTier(source.sourceTier),
      title,
      summary,
      url: url || undefined,
      publishedAt: publishedAt || undefined,
    };
  });

  return {
    parser,
    headlines,
  };
}

function parseJsonFeed(
  raw: string,
  source: FetchableSource
): {
  parser: FetchResult["parser"];
  headlines: RawHeadline[];
} {
  const payload = JSON.parse(raw);

  const items = Array.isArray(payload)
    ? payload
    : Array.isArray(payload.items)
      ? payload.items
      : Array.isArray(payload.entries)
        ? payload.entries
        : [];

  const parser: FetchResult["parser"] = Array.isArray(payload) ? "json-array" : "json-feed";

  const headlines = items.slice(0, maxItemsForSource(source)).map((item: any) => {
    const title =
      compactText(item.title) ||
      compactText(item.headline) ||
      compactText(item.name) ||
      "Untitled source item";

    const summary =
      compactText(item.summary) ||
      compactText(item.description) ||
      compactText(item.content_text) ||
      compactText(item.content_html) ||
      compactText(item.body);

    const url =
      typeof item.url === "string"
        ? item.url
        : typeof item.external_url === "string"
          ? item.external_url
          : typeof item.link === "string"
            ? item.link
            : "";

    const publishedAt =
      typeof item.date_published === "string"
        ? item.date_published
        : typeof item.published === "string"
          ? item.published
          : typeof item.pubDate === "string"
            ? item.pubDate
            : typeof item.updated === "string"
              ? item.updated
              : undefined;

    return {
      sourceId: source.sourceId,
      sourceName: source.name,
      sourceTier: normalizeSourceTier(source.sourceTier),
      title,
      summary,
      url: isValidHttpUrl(url) ? url : undefined,
      publishedAt,
    };
  });

  return {
    parser,
    headlines,
  };
}

function parseSourcePayload(raw: string, source: FetchableSource, contentType: string | null) {
  const trimmed = raw.trim();

  if (!trimmed) {
    return {
      parser: "unknown" as const,
      headlines: [],
    };
  }

  const looksJson =
    contentType?.toLowerCase().includes("json") ||
    trimmed.startsWith("{") ||
    trimmed.startsWith("[");

  if (looksJson) {
    try {
      return parseJsonFeed(trimmed, source);
    } catch {
      // Some sources mislabel XML as JSON. Fall through to XML parsing.
    }
  }

  return parseRssOrAtom(trimmed, source);
}

function dedupeHeadlines(headlines: RawHeadline[]) {
  const seen = new Set<string>();
  const deduped: RawHeadline[] = [];

  for (const headline of headlines) {
    const key = headlineKey(headline);

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(headline);
    }
  }

  return deduped;
}

async function updateCheckpoint(result: FetchResult) {
  await prisma.sourceCheckpoint.upsert({
    where: {
      sourceId: result.sourceId,
    },
    update: {
      sourceName: result.sourceName,
      lastFetchedAt: new Date(),
      lastStatus: result.status,
      lastItemCount: result.itemCount,
      lastSeenHash: result.headlines[0]?.title ?? result.error ?? null,
    },
    create: {
      sourceId: result.sourceId,
      sourceName: result.sourceName,
      lastFetchedAt: new Date(),
      lastStatus: result.status,
      lastItemCount: result.itemCount,
      lastSeenHash: result.headlines[0]?.title ?? result.error ?? null,
    },
  });
}

async function fetchWithTimeout(url: string, timeoutMs: number) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    return await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent":
          process.env.SLICE_FEED_USER_AGENT ||
          "SliceAdvisorIntelligence/1.0 (+https://slice-advisor-platform.local)",
        Accept:
          "application/rss+xml, application/atom+xml, application/feed+json, application/json, application/xml, text/xml, */*",
      },
    });
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchOneSource(source: FetchableSource): Promise<FetchResult> {
  const startedAt = Date.now();
  const sourceUrl = source.sourceUrl;

  if (!isValidHttpUrl(sourceUrl)) {
    const result: FetchResult = {
      sourceId: source.sourceId,
      sourceName: source.name,
      sourceUrl,
      sourceTier: source.sourceTier,
      category: source.category ?? null,
      ok: false,
      skipped: true,
      status: "Skipped",
      itemCount: 0,
      parser: "unknown",
      latencyMs: Date.now() - startedAt,
      error: "Source has no live URL.",
      headlines: [],
    };

    await updateCheckpoint(result);
    return result;
  }

  if (isCoolingDown(source)) {
    const result: FetchResult = {
      sourceId: source.sourceId,
      sourceName: source.name,
      sourceUrl,
      sourceTier: source.sourceTier,
      category: source.category ?? null,
      ok: true,
      skipped: true,
      status: "Skipped",
      itemCount: 0,
      parser: "unknown",
      latencyMs: Date.now() - startedAt,
      error: "Source cooldown active.",
      headlines: [],
    };

    await updateCheckpoint(result);
    return result;
  }

  let lastError = "";

  for (let attempt = 1; attempt <= MAX_FETCH_RETRIES; attempt += 1) {
    try {
      const response = await fetchWithTimeout(sourceUrl, DEFAULT_TIMEOUT_MS);

      if (!response.ok) {
        lastError = `HTTP ${response.status}`;
        continue;
      }

      const raw = await response.text();
      const parsed = parseSourcePayload(raw, source, response.headers.get("content-type"));
      const headlines = dedupeHeadlines(parsed.headlines).slice(0, maxItemsForSource(source));

      const result: FetchResult = {
        sourceId: source.sourceId,
        sourceName: source.name,
        sourceUrl,
        sourceTier: source.sourceTier,
        category: source.category ?? null,
        ok: true,
        skipped: false,
        status: "OK",
        itemCount: headlines.length,
        parser: parsed.parser,
        latencyMs: Date.now() - startedAt,
        headlines,
      };

      await updateCheckpoint(result);
      return result;
    } catch (error) {
      lastError = error instanceof Error ? error.message : "Unknown fetch error";
    }
  }

  const result: FetchResult = {
    sourceId: source.sourceId,
    sourceName: source.name,
    sourceUrl,
    sourceTier: source.sourceTier,
    category: source.category ?? null,
    ok: false,
    skipped: false,
    status: "Error",
    itemCount: 0,
    parser: "unknown",
    latencyMs: Date.now() - startedAt,
    error: lastError || "Source fetch failed.",
    headlines: [],
  };

  await updateCheckpoint(result);
  return result;
}

function overlapCount(a: string[], b: string[]) {
  const set = new Set(a);
  return b.filter((item) => set.has(item)).length;
}

function corroborationForHeadline(headline: RawHeadline, allHeadlines: RawHeadline[]) {
  const tickers = extractTickerHints(headline);
  const terms = titleTerms(headline);
  const corroborators: RawHeadline[] = [];

  for (const other of allHeadlines) {
    if (other.sourceId === headline.sourceId) continue;

    const otherTickers = extractTickerHints(other);
    const otherTerms = titleTerms(other);

    const tickerMatch =
      tickers.length > 0 && otherTickers.some((ticker) => tickers.includes(ticker));
    const termMatch = overlapCount(terms, otherTerms) >= 4;

    if (tickerMatch || termMatch) {
      corroborators.push(other);
    }
  }

  const uniqueSourceNames = Array.from(
    new Set(corroborators.map((item) => item.sourceName).filter(Boolean))
  ).slice(0, 8);

  const strongestCorroboratorTrust = corroborators.reduce(
    (max, item) => Math.max(max, sourceTrustScore(item.sourceTier)),
    0
  );

  return {
    count: uniqueSourceNames.length,
    sources: uniqueSourceNames,
    strongestCorroboratorTrust,
  };
}

function annotateHeadlineReliability(headline: RawHeadline, allHeadlines: RawHeadline[]) {
  const sourceTrust = sourceTrustScore(headline.sourceTier);
  const trustLabel = sourceTrustLabel(headline.sourceTier);
  const corroboration = corroborationForHeadline(headline, allHeadlines);

  const lowerTrustRequiresConfirmation = sourceTrust < 65;
  const confirmationStatus =
    sourceTrust >= 88
      ? "primary-source"
      : corroboration.count >= 2
        ? "cross-source-confirmed"
        : corroboration.count === 1
          ? "partially-corroborated"
          : lowerTrustRequiresConfirmation
            ? "unconfirmed-low-trust"
            : "single-source-standard";

  const reliabilityNote = [
    "Slice Reliability",
    `sourceTrust=${sourceTrust}`,
    `sourceTrustLabel=${trustLabel}`,
    `sourceTier=${headline.sourceTier}`,
    `corroboratingSources=${corroboration.count}`,
    `strongestCorroboratorTrust=${corroboration.strongestCorroboratorTrust}`,
    `confirmationStatus=${confirmationStatus}`,
    `lowerTrustRequiresConfirmation=${lowerTrustRequiresConfirmation ? "yes" : "no"}`,
    corroboration.sources.length
      ? `corroborators=${corroboration.sources.join(" | ")}`
      : "corroborators=none",
  ].join("; ");

  return {
    ...headline,
    summary: [headline.summary, reliabilityNote].filter(Boolean).join("\n\n"),
  };
}

async function fetchSourcesInBatches(liveSources: FetchableSource[]) {
  const results: FetchResult[] = [];

  for (let index = 0; index < liveSources.length; index += FETCH_CONCURRENCY) {
    const batch = liveSources.slice(index, index + FETCH_CONCURRENCY);
    const batchResults = await Promise.all(batch.map((source) => fetchOneSource(source)));
    results.push(...batchResults);
  }

  return results;
}

export async function fetchFreeHeadlineBatch(sources: FetchableSource[]) {
  const liveSources = sources
    .filter((source) => source.enabled !== false && isValidHttpUrl(source.sourceUrl))
    .sort((a, b) => (a.priority ?? 99) - (b.priority ?? 99))
    .slice(0, MAX_LIVE_SOURCES_PER_RUN);

  const results = await fetchSourcesInBatches(liveSources);
  const deduped = dedupeHeadlines(results.flatMap((result) => result.headlines));

  const annotated = deduped
    .map((headline) => annotateHeadlineReliability(headline, deduped))
    .slice(0, MAX_TOTAL_LIVE_HEADLINES);

  return {
    sourceResults: results,
    headlines: annotated,
    health: {
      sourceCount: liveSources.length,
      maxSourceCapacity: MAX_LIVE_SOURCES_PER_RUN,
      ok: results.filter((result) => result.ok && !result.skipped).length,
      skipped: results.filter((result) => result.skipped).length,
      failed: results.filter((result) => !result.ok && !result.skipped).length,
      itemCount: annotated.length,
      concurrency: FETCH_CONCURRENCY,
      reliability: {
        annotated: annotated.length,
        lowTrustItems: annotated.filter((headline) =>
          headline.summary?.includes("lowerTrustRequiresConfirmation=yes")
        ).length,
        corroboratedItems: annotated.filter((headline) =>
          headline.summary?.includes("confirmationStatus=cross-source-confirmed")
        ).length,
      },
    },
  };
}