import "server-only";

import {
  randomUUID,
} from "node:crypto";

import type {
  AdvisorBriefEconomicEvidence,
  AdvisorMarketBrief,
} from "@/lib/advisor-briefing/types";
import {
  ADVISOR_BRIEF_ALL_SYMBOLS,
  ADVISOR_BRIEF_INDUSTRIES,
} from "@/lib/advisor-briefing/universe";
import {
  ALPHA_DOCUMENTATION,
  BRIEF_TITLE_PREFIX,
  INDUSTRY_WEIGHTS,
  MARKET_CACHE_MS,
  METHODOLOGY_VERSION,
  SECURITY_WEIGHTS,
  type BriefCache,
  type EconomicSeries,
  average,
  clamp,
  round,
  uniqueStrings,
} from "@/lib/advisor-briefing/shared";
import {
  alphaEntitlement,
  loadMarketStatus,
  loadQuotes,
} from "@/lib/advisor-briefing/alpha-market";
import {
  ECONOMIC_SERIES,
  loadEconomy,
} from "@/lib/advisor-briefing/economic-research";
import {
  createSourceRegistry,
  providerMode,
} from "@/lib/advisor-briefing/ranking-helpers";
import {
  rankIndustries,
} from "@/lib/advisor-briefing/industry-ranking";
import {
  rankSecurities,
} from "@/lib/advisor-briefing/security-ranking";

declare global {
  // eslint-disable-next-line no-var
  var __sliceAdvisorMarketBriefCache:
    | BriefCache
    | undefined;
}

export async function buildAdvisorMarketBriefCore(input: {
  force?: boolean;
  minimumDataQuality: number;
}) {
  const cached = globalThis.__sliceAdvisorMarketBriefCache;

  if (!input.force && cached && Date.now() - cached.storedAt <= MARKET_CACHE_MS) {
    return cached.brief;
  }

  const generatedAt = new Date().toISOString();
  const registry = createSourceRegistry();
  const warnings: string[] = [];
  const [quoteResult, marketStatusResult, economyResult] =
    await Promise.allSettled([
      loadQuotes(ADVISOR_BRIEF_ALL_SYMBOLS),
      loadMarketStatus(),
      loadEconomy(),
    ]);

  if (quoteResult.status === "rejected") {
    throw new Error(
      `Broad quote coverage failed: ${
        quoteResult.reason instanceof Error
          ? quoteResult.reason.message
          : String(quoteResult.reason)
      }`,
    );
  }

  const quoteBatch = quoteResult.value;
  warnings.push(...quoteBatch.warnings);
  const marketStatus =
    marketStatusResult.status === "fulfilled"
      ? marketStatusResult.value
      : {
          currentStatus: "unknown",
          isOpen: false,
          region: "United States",
          exchanges: "NASDAQ, NYSE",
          localOpen: "09:30",
          localClose: "16:00",
          notes: "MARKET_STATUS unavailable.",
          retrievedAt: generatedAt,
        };
  const economy =
    economyResult.status === "fulfilled"
      ? economyResult.value
      : {
          series: [] as EconomicSeries[],
          warnings: ["Economic-release research is unavailable."],
        };

  if (marketStatusResult.status === "rejected") {
    warnings.push(
      `Market status unavailable: ${
        marketStatusResult.reason instanceof Error
          ? marketStatusResult.reason.message
          : String(marketStatusResult.reason)
      }`,
    );
  }
  warnings.push(...economy.warnings);

  registry.add({
    id: "alpha:market-status",
    kind: "market-status",
    provider: "Alpha Vantage",
    label: "US equity market status",
    publisher: "Alpha Vantage",
    url: ALPHA_DOCUMENTATION,
    asOf: marketStatus.retrievedAt,
    retrievedAt: marketStatus.retrievedAt,
    usedFor: ["market-open classification", "freshness labeling"],
  });

  const economicEvidence: AdvisorBriefEconomicEvidence[] = economy.series.map(
    (series) => {
      const sourceId = registry.add({
        id: `alpha:economy:${series.functionName}`,
        kind: "economic-release",
        provider: "Alpha Vantage",
        label: series.label,
        publisher: "Alpha Vantage",
        url: ALPHA_DOCUMENTATION,
        asOf: series.asOf,
        retrievedAt: series.retrievedAt,
        usedFor: ["industry macro alignment", series.functionName],
      });

      return {
        id: series.id,
        label: series.label,
        functionName: series.functionName,
        unit: series.unit,
        interval: series.interval,
        latestValue: series.latestValue,
        previousValue: series.previousValue,
        change: series.change,
        changePercent: series.changePercent,
        asOf: series.asOf,
        score: series.score,
        confidence: series.confidence,
        sourceId,
      };
    },
  );

  const concurrency = Math.max(
    1,
    Math.min(
      8,
      Number(process.env.ADVISOR_BRIEF_ALPHA_CONCURRENCY) || 5,
    ),
  );


  const topIndustryResearch =
    await rankIndustries({
      quoteBatch,
      economy,
      registry,
      generatedAt,
      concurrency,
    });

  const {
    topIndustries,
    overallRankedSecurities,
  } = await rankSecurities({
    topIndustryResearch,
    quoteBatch,
    registry,
    generatedAt,
    concurrency,
  });

  const mode = providerMode({
    entitlement: alphaEntitlement(),
    marketOpen: marketStatus.isOpen,
    sourceFunction: quoteBatch.sourceFunction,
    providerAsOf: quoteBatch.providerAsOf,
    quoteCoverage: quoteBatch.coveragePercent,
  });
  const dataQuality = clamp(
    quoteBatch.coveragePercent * 0.32 +
      average(
        topIndustries.map((industry) => industry.confidence),
        0,
      ) *
        0.28 +
      average(
        overallRankedSecurities.map(
          (security) => security.confidence,
        ),
        0,
      ) *
        0.25 +
      Math.min((economy.series.length / ECONOMIC_SERIES.length) * 100, 100) *
        0.15 -
      warnings.length * 1.5,
  );

  if (!mode.realTimeConfirmed) {
    warnings.push(
      mode.mode === "Market Closed"
        ? "The US equity market is closed; rankings use the latest available provider observations."
        : `Market data is classified as ${mode.mode.toLowerCase()}, not confirmed real time.`,
    );
  }
  if (dataQuality < input.minimumDataQuality) {
    warnings.push(
      `Data quality ${dataQuality.toFixed(0)}/100 is below the advisor delivery threshold ${input.minimumDataQuality}/100.`,
    );
  }

  warnings.push(
    ...topIndustryResearch.flatMap((industry) => industry.warnings),
    "Economic indicators are latest published releases, not continuous market ticks.",
    "Rankings are advisor monitoring priorities, not trade instructions or guaranteed outcomes.",
  );

  const summaryIndustries = topIndustries
    .map(
      (industry) =>
        `#${industry.rank} ${industry.name} (${industry.score.toFixed(1)}/100)`,
    )
    .join(", ");
  const summaryStocks = overallRankedSecurities
    .slice(0, 5)
    .map((security) => `#${security.overallRank} ${security.symbol}`)
    .join(", ");
  const brief: AdvisorMarketBrief = {
    schemaVersion: "slice-advisor-market-brief-1.0.0",
    briefId: randomUUID(),
    title: `${BRIEF_TITLE_PREFIX} — ${new Date(
      generatedAt,
    ).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    })}`,
    generatedAt,
    marketAsOf: quoteBatch.providerAsOf,
    marketStatus: marketStatus.currentStatus,
    providerMode: mode.mode,
    realTimeConfirmed: mode.realTimeConfirmed,
    dataQuality: round(dataQuality),
    quoteCoveragePercent: round(quoteBatch.coveragePercent),
    methodologyVersion: METHODOLOGY_VERSION,
    executiveSummary:
      `Today's highest-ranked monitoring industries are ${summaryIndustries}. ` +
      `The five leading securities across those groups are ${summaryStocks || "not available"}. ` +
      "The ranking combines broad quote coverage, live breadth, daily technical structure, source-weighted news, company fundamentals, liquidity, risk quality, and the latest economic releases.",
    topIndustries,
    overallRankedSecurities,
    economicEvidence,
    sources: registry.values(),
    warnings: uniqueStrings(warnings, 100),
    methodology: {
      industryWeights: INDUSTRY_WEIGHTS,
      securityWeights: SECURITY_WEIGHTS,
      selectionUniverseSize: ADVISOR_BRIEF_ALL_SYMBOLS.length,
      industryUniverseSize: ADVISOR_BRIEF_INDUSTRIES.length,
      minimumDataQuality: input.minimumDataQuality,
      description:
        "Industry ranks combine 25% live breadth and momentum, 28% ETF technical trend and risk quality, 20% source-weighted news sentiment, 17% macro alignment, and 10% liquidity. Security ranks combine live, technical, news, fundamental, volume, and risk factors, followed by an 18% industry-context overlay.",
    },
  };

  globalThis.__sliceAdvisorMarketBriefCache = {
    brief,
    storedAt: Date.now(),
  };

  return brief;
}