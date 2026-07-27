import "server-only";

import type {
  AdvisorBriefFundamentals,
  AdvisorBriefIndustry,
  AdvisorBriefSecurity,
} from "@/lib/advisor-briefing/types";
import {
  ALPHA_DOCUMENTATION,
  SECURITY_WEIGHTS,
  type IndustryResearch,
  type QuoteBatch,
  clamp,
  mapWithConcurrency,
  round,
  uniqueStrings,
} from "@/lib/advisor-briefing/shared";
import {
  loadFundamentals,
  loadTechnical,
  technicalFromBars,
} from "@/lib/advisor-briefing/technical-research";
import {
  summarizeNews,
} from "@/lib/advisor-briefing/news-research";
import {
  industryDrivers,
  industryRisks,
  industryThesis,
  securityDrivers,
  securityRisks,
  type SourceRegistry,
} from "@/lib/advisor-briefing/ranking-helpers";

export async function rankSecurities(input: {
  topIndustryResearch: IndustryResearch[];
  quoteBatch: QuoteBatch;
  registry: SourceRegistry;
  generatedAt: string;
  concurrency: number;
}) {
  const {
    topIndustryResearch,
    quoteBatch,
    registry,
    generatedAt,
    concurrency,
  } = input;

  const stockCandidates = topIndustryResearch.flatMap((industry) =>
    industry.definition.stocks.flatMap((stock) => {
      const quote = quoteBatch.quotes[stock.symbol];
      return quote ? [{ industry, stock, quote }] : [];
    }),
  );
  const detailedSecurities = await mapWithConcurrency(
    stockCandidates,
    concurrency,
    async (candidate): Promise<AdvisorBriefSecurity> => {
      const [technicalResult, fundamentalResult] = await Promise.allSettled([
        loadTechnical(candidate.stock.symbol),
        loadFundamentals(candidate.stock.symbol, candidate.quote.price),
      ]);
      const technical =
        technicalResult.status === "fulfilled"
          ? technicalResult.value.technical
          : technicalFromBars([]);
      const fundamentals =
        fundamentalResult.status === "fulfilled"
          ? fundamentalResult.value.fundamentals
          : {
              asOf: null,
              marketCapitalization: 0,
              peRatio: null,
              pegRatio: null,
              profitMarginPercent: null,
              operatingMarginPercent: null,
              returnOnEquityPercent: null,
              revenueGrowthPercent: null,
              earningsGrowthPercent: null,
              analystTargetPrice: null,
              beta: null,
              fundamentalScore: 50,
            };
      const companyName =
        fundamentalResult.status === "fulfilled" &&
        fundamentalResult.value.companyName
          ? fundamentalResult.value.companyName
          : candidate.stock.name;
      const tickerNews =
        candidate.industry.news.byTicker[candidate.stock.symbol] ??
        summarizeNews([]);
      const sessionScore = clamp(
        50 + candidate.quote.changePercent * 7,
      );
      const rawScore = clamp(
        sessionScore * SECURITY_WEIGHTS.liveSessionMomentum +
          technical.trendScore * SECURITY_WEIGHTS.technicalTrend +
          technical.momentumScore *
            SECURITY_WEIGHTS.multiPeriodMomentum +
          technical.volumeScore *
            SECURITY_WEIGHTS.volumeConfirmation +
          tickerNews.score *
            SECURITY_WEIGHTS.newsSentimentAndFreshness +
          fundamentals.fundamentalScore *
            SECURITY_WEIGHTS.fundamentalQualityAndGrowth +
          technical.riskQualityScore *
            SECURITY_WEIGHTS.riskQuality,
      );
      const score = clamp(
        rawScore * 0.82 + candidate.industry.score * 0.18,
      );
      const confidence = clamp(
        20 +
          Math.min(technical.observations, 100) * 0.3 +
          (fundamentalResult.status === "fulfilled" ? 18 : 0) +
          tickerNews.confidence * 0.22 +
          candidate.industry.confidence * 0.1 -
          (technicalResult.status === "rejected" ? 12 : 0),
      );
      const quoteSourceId = registry.add({
        id: `alpha:quote:${candidate.stock.symbol}`,
        kind: "realtime-quote",
        provider: "Alpha Vantage",
        label: `${candidate.stock.symbol} quote`,
        publisher: "Alpha Vantage",
        url: ALPHA_DOCUMENTATION,
        asOf:
          candidate.quote.timestamp ?? quoteBatch.providerAsOf,
        retrievedAt: quoteBatch.retrievedAt,
        usedFor: [
          candidate.stock.symbol,
          "live price",
          "session momentum",
          "volume",
        ],
      });
      const technicalSourceId = registry.add({
        id: `alpha:daily:${candidate.stock.symbol}`,
        kind: "daily-history",
        provider: "Alpha Vantage",
        label: `${candidate.stock.symbol} daily time series`,
        publisher: "Alpha Vantage",
        url: ALPHA_DOCUMENTATION,
        asOf: technical.asOf,
        retrievedAt:
          technicalResult.status === "fulfilled"
            ? technicalResult.value.retrievedAt
            : generatedAt,
        usedFor: [
          candidate.stock.symbol,
          "trend",
          "momentum",
          "volatility",
          "drawdown",
        ],
      });
      const fundamentalSourceId = registry.add({
        id: `alpha:overview:${candidate.stock.symbol}`,
        kind: "company-overview",
        provider: "Alpha Vantage",
        label: `${candidate.stock.symbol} company overview`,
        publisher: "Alpha Vantage",
        url: ALPHA_DOCUMENTATION,
        asOf: fundamentals.asOf,
        retrievedAt:
          fundamentalResult.status === "fulfilled"
            ? fundamentalResult.value.retrievedAt
            : generatedAt,
        usedFor: [
          candidate.stock.symbol,
          "quality",
          "growth",
          "valuation",
        ],
      });
      const newsSourceIds = tickerNews.items.slice(0, 4).map((item) =>
        registry.add({
          id: `news:${candidate.stock.symbol}:${item.id}`,
          kind: "market-news",
          provider: "Alpha Vantage News Sentiment",
          label: item.title,
          publisher: item.publisher,
          url: item.url,
          asOf: item.publishedAt,
          retrievedAt: candidate.industry.news.retrievedAt,
          usedFor: [
            candidate.stock.symbol,
            "ticker news sentiment",
          ],
        }),
      );
      const positiveDrivers = securityDrivers({
        technical,
        fundamentals,
        newsScore: tickerNews.score,
        changePercent: candidate.quote.changePercent,
      });
      const riskFlags = securityRisks({
        technical,
        fundamentals,
        newsScore: tickerNews.score,
        changePercent: candidate.quote.changePercent,
      });

      return {
        symbol: candidate.stock.symbol,
        name: companyName,
        industryId: candidate.industry.definition.id,
        industryName: candidate.industry.definition.name,
        industryRank: 0,
        overallRank: 0,
        score: round(score),
        confidence: round(confidence),
        quote: candidate.quote,
        technical,
        fundamentals,
        newsScore: tickerNews.score,
        newsConfidence: tickerNews.confidence,
        explanation: "",
        positiveDrivers,
        riskFlags,
        sourceIds: uniqueStrings([
          quoteSourceId,
          technicalSourceId,
          fundamentalSourceId,
          ...newsSourceIds,
        ]),
      };
    },
  );

  const topIndustries: AdvisorBriefIndustry[] = topIndustryResearch.map(
    (industry, industryIndex) => {
      const stocks = detailedSecurities
        .filter(
          (security) =>
            security.industryId === industry.definition.id,
        )
        .sort((left, right) => right.score - left.score)
        .slice(0, 5)
        .map((security, stockIndex) => ({
          ...security,
          industryRank: stockIndex + 1,
        }));

      return {
        id: industry.definition.id,
        name: industry.definition.name,
        description: industry.definition.description,
        etfSymbol: industry.definition.etfSymbol,
        rank: industryIndex + 1,
        score: round(industry.score),
        confidence: round(industry.confidence),
        averageChangePercent: round(industry.averageChangePercent),
        advancingSharePercent: round(industry.advancingSharePercent),
        technicalScore: round(industry.technicalScore),
        newsScore: round(industry.newsScore),
        macroScore: round(industry.macroScore),
        liquidityScore: round(industry.liquidityScore),
        thesis: industryThesis(industry),
        positiveDrivers: industryDrivers(industry),
        riskFlags: industryRisks(industry),
        stocks,
        sourceIds: industry.sourceIds,
      };
    },
  );
  const overallRankedSecurities = topIndustries
    .flatMap((industry) => industry.stocks)
    .sort((left, right) => right.score - left.score)
    .map((security, index) => ({
      ...security,
      overallRank: index + 1,
      explanation:
        `${security.symbol} ranks #${security.industryRank} inside ${security.industryName} and #${index + 1} across today's selected industries. ` +
        `${security.positiveDrivers.slice(0, 3).join(" ")} ` +
        `Primary monitoring risk: ${
          security.riskFlags[0] ??
          "No single measured risk dominates."
        }`,
    }));
  const overallMap = new Map(
    overallRankedSecurities.map((security) => [
      security.symbol,
      security,
    ]),
  );

  for (const industry of topIndustries) {
    industry.stocks = industry.stocks.map(
      (security) => overallMap.get(security.symbol) ?? security,
    );
  }


  return {
    topIndustries,
    overallRankedSecurities,
  };
}