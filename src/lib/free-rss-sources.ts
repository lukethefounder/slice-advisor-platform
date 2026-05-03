import { prisma } from "@/lib/prisma";
import type { RawHeadline } from "@/lib/news-triage";

type FetchableSource = {
  sourceId: string;
  name: string;
  sourceUrl: string | null;
  sourceTier: string;
  category: string;
  maxItemsPerRun: number;
  cooldownMinutes: number;
  lastRunAt: Date | null;
};

type FetchResult = {
  sourceId: string;
  sourceName: string;
  ok: boolean;
  itemCount: number;
  skipped: boolean;
  error?: string;
  headlines: RawHeadline[];
};

const MAX_TOTAL_LIVE_HEADLINES = 120;

function decodeEntities(value: string) {
  return value
    .replace(/<!\[CDATA\[(.*?)\]\]>/g, "$1")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, "\"")
    .replace(/&apos;/g, "'")
    .replace(/&#39;/g, "'")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#(\d+);/g, (_, code) => String.fromCharCode(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

function stripHtml(value: string) {
  return decodeEntities(value.replace(/<[^>]*>/g, " "));
}

function extractTag(block: string, names: string[]) {
  for (const name of names) {
    const pattern = new RegExp(`<${name}[^>]*>([\\s\\S]*?)<\\/${name}>`, "i");
    const match = block.match(pattern);

    if (match?.[1]) {
      return stripHtml(match[1]);
    }
  }

  return "";
}

function extractLink(block: string) {
  const linkTag = extractTag(block, ["link"]);

  if (linkTag) {
    return linkTag;
  }

  const atomLink = block.match(/<link[^>]*href=["']([^"']+)["'][^>]*>/i)?.[1];

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

function parseRssOrAtom(xml: string, source: FetchableSource): RawHeadline[] {
  const blocks =
    xml.match(/<item[\s\S]*?<\/item>/gi) ??
    xml.match(/<entry[\s\S]*?<\/entry>/gi) ??
    [];

  return blocks.slice(0, source.maxItemsPerRun).map((block) => {
    const title = extractTag(block, ["title"]) || "Untitled source item";
    const summary = extractTag(block, ["description", "summary", "content"]);
    const url = extractLink(block);
    const publishedAt = extractTag(block, [
      "pubDate",
      "updated",
      "published",
      "dc:date",
    ]);

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
}

function isValidHttpUrl(value: string | null) {
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
  const cooldownMs = source.cooldownMinutes * 60 * 1000;

  return msSinceRun < cooldownMs;
}

async function updateCheckpoint(result: FetchResult) {
  await prisma.sourceCheckpoint.upsert({
    where: {
      sourceId: result.sourceId,
    },
    update: {
      sourceName: result.sourceName,
      lastFetchedAt: new Date(),
      lastStatus: result.ok ? "OK" : result.skipped ? "Skipped" : "Error",
      lastItemCount: result.itemCount,
      lastSeenHash: result.headlines[0]?.title ?? null,
    },
    create: {
      sourceId: result.sourceId,
      sourceName: result.sourceName,
      lastFetchedAt: new Date(),
      lastStatus: result.ok ? "OK" : result.skipped ? "Skipped" : "Error",
      lastItemCount: result.itemCount,
      lastSeenHash: result.headlines[0]?.title ?? null,
    },
  });
}

async function fetchOneSource(source: FetchableSource): Promise<FetchResult> {
  if (!isValidHttpUrl(source.sourceUrl)) {
    const result: FetchResult = {
      sourceId: source.sourceId,
      sourceName: source.name,
      ok: false,
      skipped: true,
      itemCount: 0,
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
      ok: true,
      skipped: true,
      itemCount: 0,
      error: "Source cooldown active.",
      headlines: [],
    };

    await updateCheckpoint(result);
    return result;
  }

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 9000);

  try {
    const response = await fetch(source.sourceUrl as string, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        "User-Agent": "SliceWealthIntelligence/0.1 founder@example.com",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    });

    if (!response.ok) {
      const result: FetchResult = {
        sourceId: source.sourceId,
        sourceName: source.name,
        ok: false,
        skipped: false,
        itemCount: 0,
        error: `HTTP ${response.status}`,
        headlines: [],
      };

      await updateCheckpoint(result);
      return result;
    }

    const xml = await response.text();
    const headlines = parseRssOrAtom(xml, source);

    const result: FetchResult = {
      sourceId: source.sourceId,
      sourceName: source.name,
      ok: true,
      skipped: false,
      itemCount: headlines.length,
      headlines,
    };

    await updateCheckpoint(result);
    return result;
  } catch (error) {
    const result: FetchResult = {
      sourceId: source.sourceId,
      sourceName: source.name,
      ok: false,
      skipped: false,
      itemCount: 0,
      error: error instanceof Error ? error.message : "Unknown fetch error",
      headlines: [],
    };

    await updateCheckpoint(result);
    return result;
  } finally {
    clearTimeout(timeout);
  }
}

function dedupeHeadlines(headlines: RawHeadline[]) {
  const seen = new Set<string>();
  const deduped: RawHeadline[] = [];

  for (const headline of headlines) {
    const key = `${headline.sourceId}:${headline.title}:${headline.url ?? ""}`
      .toLowerCase()
      .replace(/\s+/g, " ")
      .slice(0, 260);

    if (!seen.has(key)) {
      seen.add(key);
      deduped.push(headline);
    }
  }

  return deduped;
}

export async function fetchFreeHeadlineBatch(sources: FetchableSource[]) {
  const liveSources = sources.filter(
    (source) => source.enabled !== false && isValidHttpUrl(source.sourceUrl)
  );

  const results: FetchResult[] = [];

  for (const source of liveSources) {
    const result = await fetchOneSource(source);
    results.push(result);
  }

  const headlines = dedupeHeadlines(results.flatMap((result) => result.headlines))
    .slice(0, MAX_TOTAL_LIVE_HEADLINES);

  return {
    sourceResults: results,
    headlines,
  };
}