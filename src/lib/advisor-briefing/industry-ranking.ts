import "server-only";

import type {
  AdvisorBriefQuote,
} from "@/lib/advisor-briefing/types";
import {
  ADVISOR_BRIEF_INDUSTRIES,
} from "@/lib/advisor-briefing/universe";
import {
  ALPHA_DOCUMENTATION,
  INDUSTRY_WEIGHTS,
  type EconomicSeries,
  type IndustryResearch,
  type QuoteBatch,
  average,
  clamp,
  higherIsBetter,
  mapWithConcurrency,
  uniqueStrings,
} from "@/lib/advisor-briefing/shared";
import {
  loadTechnical,
  technicalFromBars,
} from "@/lib/advisor-briefing/technical-research";
import {
  loadNews,
} from "@/lib/advisor-briefing/news-research";
import {
  industryMacroScore,
} from "@/lib/advisor-briefing/economic-research";
import type {
  SourceRegistry,
} from "@/lib/advisor-briefing/ranking-helpers";

export async function rankIndustries(input: {
  quoteBatch: QuoteBatch;
  economy: {
    series: EconomicSeries[];
    warnings: string[];
  };
  registry: SourceRegistry;
  generatedAt: string;
  concurrency: number;
}) {
  const {
    quoteBatch,
    economy,
    registry,
    generatedAt,
    concurrency,
  } = input;

  const industryResearch = await mapWithConcurrency(
    ADVISOR_BRIEF_INDUSTRIES,
    concurrency,
    async (definition): Promise<IndustryResearch> => {
      const localWarnings: string[] = [];
      const [technicalResult, newsResult] = await Promise.allSettled([
        loadTechnical(definition.etfSymbol),
        loadNews(
          [
            definition.etfSymbol,
            ...definition.stocks.map((stock) => stock.symbol),
          ],
          definition.newsTopics,
          definition.name,
        ),
      ]);
      const technical =
        technicalResult.status === "fulfilled"
          ? technicalResult.value.technical
          : technicalFromBars([]);
      const news =
        newsResult.status === "fulfilled"
          ? newsResult.value
          : {
              score: 50,
              confidence: 0,
              articleCount: 0,
              independentSourceCount: 0,
              latestPublishedAt: null,
              items: [],
              byTicker: {},
              retrievedAt: generatedAt,
              warnings: [
                `${definition.name} market-news research was unavailable.`,
              ],
            };

      if (technicalResult.status === "rejected") {
        localWarnings.push(
          `${definition.name} ETF history unavailable: ${
            technicalResult.reason instanceof Error
              ? technicalResult.reason.message
              : String(technicalResult.reason)
          }`,
        );
      }
      localWarnings.push(...news.warnings);

      const memberQuotes = definition.stocks
        .map((stock) => quoteBatch.quotes[stock.symbol])
        .filter((quote): quote is AdvisorBriefQuote => Boolean(quote));
      const etfQuote = quoteBatch.quotes[definition.etfSymbol];
      const memberChanges = memberQuotes.map(
        (quote) => quote.changePercent,
      );
      const averageChangePercent = average(memberChanges);
      const advancingSharePercent = memberQuotes.length
        ? (memberQuotes.filter((quote) => quote.changePercent > 0).length /
            memberQuotes.length) *
          100
        : 0;
      const quoteCoveragePercent =
        ((memberQuotes.length + (etfQuote ? 1 : 0)) /
          (definition.stocks.length + 1)) *
        100;
      const etfChange = etfQuote?.changePercent ?? averageChangePercent;
      const liveScore = clamp(
        50 +
          averageChangePercent * 6 +
          etfChange * 3 +
          (advancingSharePercent - 50) * 0.35,
      );
      const technicalScore = clamp(
        technical.trendScore * 0.45 +
          technical.momentumScore * 0.25 +
          technical.riskQualityScore * 0.2 +
          technical.volumeScore * 0.1,
      );
      const macroScore = industryMacroScore(definition, economy.series);
      const liquidityValues = [
        ...(etfQuote?.volume
          ? [Math.log10(etfQuote.volume + 1)]
          : []),
        ...memberQuotes
          .filter((quote) => quote.volume > 0)
          .map((quote) => Math.log10(quote.volume + 1)),
      ];
      const liquidityScore = clamp(
        higherIsBetter(average(liquidityValues, 5), 4.5, 7.5),
      );
      const score = clamp(
        liveScore * INDUSTRY_WEIGHTS.liveBreadthAndMomentum +
          technicalScore * INDUSTRY_WEIGHTS.technicalTrendAndRisk +
          news.score * INDUSTRY_WEIGHTS.newsSentimentAndFreshness +
          macroScore * INDUSTRY_WEIGHTS.macroIndustryAlignment +
          liquidityScore * INDUSTRY_WEIGHTS.liquidity,
      );
      const confidence = clamp(
        quoteCoveragePercent * 0.35 +
          Math.min(technical.observations, 100) * 0.25 +
          news.confidence * 0.2 +
          average(
            economy.series.map((series) => series.confidence),
            0,
          ) *
            0.2 -
          localWarnings.length * 3,
      );
      const quoteSourceId = registry.add({
        id: `alpha:quote:${definition.etfSymbol}`,
        kind: "realtime-quote",
        provider: "Alpha Vantage",
        label: `${definition.etfSymbol} quote and constituent breadth`,
        publisher: "Alpha Vantage",
        url: ALPHA_DOCUMENTATION,
        asOf: etfQuote?.timestamp ?? quoteBatch.providerAsOf,
        retrievedAt: quoteBatch.retrievedAt,
        usedFor: [
          definition.name,
          "industry live momentum",
          "industry liquidity",
        ],
      });
      const technicalSourceId = registry.add({
        id: `alpha:daily:${definition.etfSymbol}`,
        kind: "daily-history",
        provider: "Alpha Vantage",
        label: `${definition.etfSymbol} daily time series`,
        publisher: "Alpha Vantage",
        url: ALPHA_DOCUMENTATION,
        asOf: technical.asOf,
        retrievedAt:
          technicalResult.status === "fulfilled"
            ? technicalResult.value.retrievedAt
            : generatedAt,
        usedFor: [
          definition.name,
          "industry trend",
          "industry risk quality",
        ],
      });
      const newsSourceIds = news.items.slice(0, 8).map((item) =>
        registry.add({
          id: `news:${definition.id}:${item.id}`,
          kind: "market-news",
          provider: "Alpha Vantage News Sentiment",
          label: item.title,
          publisher: item.publisher,
          url: item.url,
          asOf: item.publishedAt,
          retrievedAt: news.retrievedAt,
          usedFor: [definition.name, "industry news sentiment"],
        }),
      );

      return {
        definition,
        technical,
        news,
        averageChangePercent,
        advancingSharePercent,
        quoteCoveragePercent,
        liveScore,
        technicalScore,
        newsScore: news.score,
        macroScore,
        liquidityScore,
        score,
        confidence,
        sourceIds: uniqueStrings([
          quoteSourceId,
          technicalSourceId,
          ...newsSourceIds,
        ]),
        warnings: localWarnings,
      };
    },
  );

  const topIndustryResearch = [...industryResearch]
    .sort((left, right) => right.score - left.score)
    .slice(0, 3);


  return topIndustryResearch;
}