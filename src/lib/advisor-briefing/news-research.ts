import "server-only";

import type {
  AdvisorBriefNewsItem,
} from "@/lib/advisor-briefing/types";
import {
  type JsonRecord,
  type NewsDigest,
  type NewsTickerDigest,
  average,
  clamp,
  cleanText,
  isRecord,
  latestTimestamp,
  numberValue,
  parseAlphaTimestamp,
  round,
  uniqueStrings,
} from "@/lib/advisor-briefing/shared";
import {
  alphaRequest,
} from "@/lib/advisor-briefing/alpha-market";

function tickerSentiments(record: JsonRecord) {
  return Array.isArray(record.ticker_sentiment)
    ? (record.ticker_sentiment as unknown[])
        .filter(isRecord)
        .map((entry) => ({
          ticker: cleanText(entry.ticker, 40).toUpperCase(),
          sentiment: numberValue(entry.ticker_sentiment_score),
          relevance: numberValue(entry.relevance_score),
        }))
        .filter((entry) => entry.ticker)
    : [];
}

export function summarizeNews(
  entries: Array<{
    item: AdvisorBriefNewsItem;
    sentiment: number;
    relevance: number;
  }>,
): NewsTickerDigest {
  let weighted = 0;
  let relevanceTotal = 0;

  for (const entry of entries) {
    weighted += entry.sentiment * Math.max(entry.relevance, 0.05);
    relevanceTotal += Math.max(entry.relevance, 0.05);
  }

  const sentiment = relevanceTotal ? weighted / relevanceTotal : 0;
  const sources = new Set(
    entries.map((entry) => entry.item.publisher).filter(Boolean),
  );
  const latest = latestTimestamp(
    entries.map((entry) => entry.item.publishedAt),
  );
  const ageHours = latest
    ? Math.max(0, (Date.now() - Date.parse(latest)) / 3_600_000)
    : 168;
  const freshness = clamp(100 - Math.log2(ageHours + 1) * 12);
  const score = clamp(50 + sentiment * 50);
  const confidence = clamp(
    Math.min(entries.length * 8, 50) +
      Math.min(sources.size * 10, 30) +
      freshness * 0.2,
  );

  return {
    score: round(score),
    confidence: round(confidence),
    articleCount: entries.length,
    items: entries
      .sort(
        (left, right) =>
          (Date.parse(right.item.publishedAt ?? "") || 0) -
          (Date.parse(left.item.publishedAt ?? "") || 0),
      )
      .slice(0, 10)
      .map((entry) => entry.item),
  };
}

export async function loadNews(
  symbolsInput: string[],
  topicsInput: string[],
  label: string,
): Promise<NewsDigest> {
  const symbols = uniqueStrings(
    symbolsInput.map((symbol) => symbol.toUpperCase()),
    25,
  );
  const topics = uniqueStrings(topicsInput, 5);
  const result = await alphaRequest(
    {
      function: "NEWS_SENTIMENT",
      tickers: symbols.join(","),
      ...(topics.length ? { topics: topics.join(",") } : {}),
      sort: "LATEST",
      limit: "100",
    },
    {
      ttlMs: 2 * 60_000,
      staleTtlMs: 12 * 60 * 60_000,
    },
  );
  const feed = Array.isArray(result.payload.feed)
    ? (result.payload.feed as unknown[]).filter(isRecord)
    : [];
  const allEntries: Array<{
    item: AdvisorBriefNewsItem;
    sentiment: number;
    relevance: number;
  }> = [];
  const byTickerEntries: Record<
    string,
    Array<{
      item: AdvisorBriefNewsItem;
      sentiment: number;
      relevance: number;
    }>
  > = Object.fromEntries(symbols.map((symbol) => [symbol, []]));

  feed.forEach((record, index) => {
    const sentiments = tickerSentiments(record);
    const publishedAt = parseAlphaTimestamp(record.time_published);
    const overallSentiment = numberValue(record.overall_sentiment_score);
    const item: AdvisorBriefNewsItem = {
      id: `${label}:${publishedAt ?? "unknown"}:${index}`,
      title: cleanText(record.title, 1_000) || `${label} market-news item`,
      summary: cleanText(record.summary, 4_000),
      publisher:
        cleanText(record.source, 200) ||
        cleanText(record.source_domain, 300) ||
        "Unknown publisher",
      url: cleanText(record.url, 2_000),
      publishedAt,
      sentimentScore: overallSentiment,
      relevanceScore: average(
        sentiments.map((entry) => entry.relevance),
        0,
      ),
      tickers: sentiments.map((entry) => entry.ticker),
    };

    if (sentiments.length) {
      for (const sentiment of sentiments) {
        const entry = {
          item: {
            ...item,
            sentimentScore: sentiment.sentiment,
            relevanceScore: sentiment.relevance,
          },
          sentiment: sentiment.sentiment,
          relevance: sentiment.relevance,
        };
        allEntries.push(entry);

        if (byTickerEntries[sentiment.ticker]) {
          byTickerEntries[sentiment.ticker].push(entry);
        }
      }
    } else {
      allEntries.push({
        item,
        sentiment: overallSentiment,
        relevance: 0.25,
      });
    }
  });

  const overall = summarizeNews(allEntries);
  const byTicker: Record<string, NewsTickerDigest> = {};

  for (const symbol of symbols) {
    byTicker[symbol] = summarizeNews(byTickerEntries[symbol] ?? []);
  }

  return {
    ...overall,
    independentSourceCount: new Set(
      overall.items.map((item) => item.publisher).filter(Boolean),
    ).size,
    latestPublishedAt: latestTimestamp(
      overall.items.map((item) => item.publishedAt),
    ),
    byTicker,
    retrievedAt: result.retrievedAt,
    warnings: result.stale
      ? ["Market-news research is using the most recent cached provider response."]
      : [],
  };
}