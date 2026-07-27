import type {
  AdvisorBriefFundamentals,
  AdvisorBriefSource,
  AdvisorBriefTechnical,
} from "@/lib/advisor-briefing/types";
import type {
  IndustryResearch,
  QuoteBatch,
} from "@/lib/advisor-briefing/shared";
import {
  uniqueStrings,
} from "@/lib/advisor-briefing/shared";

export function createSourceRegistry() {
  const sources = new Map<string, AdvisorBriefSource>();

  return {
    add(source: AdvisorBriefSource) {
      const existing = sources.get(source.id);

      if (existing) {
        existing.usedFor = uniqueStrings([
          ...existing.usedFor,
          ...source.usedFor,
        ]);
        if (!existing.asOf && source.asOf) {
          existing.asOf = source.asOf;
        }
        return existing.id;
      }

      sources.set(source.id, source);
      return source.id;
    },
    values() {
      return Array.from(sources.values());
    },
  };
}

export function providerMode(input: {
  entitlement: "realtime" | "delayed" | null;
  marketOpen: boolean;
  sourceFunction: QuoteBatch["sourceFunction"];
  providerAsOf: string | null;
  quoteCoverage: number;
}) {
  if (!input.marketOpen) {
    return {
      mode: "Market Closed" as const,
      realTimeConfirmed: false,
    };
  }

  const ageMinutes = input.providerAsOf
    ? (Date.now() - Date.parse(input.providerAsOf)) / 60_000
    : Number.POSITIVE_INFINITY;

  if (
    input.entitlement === "realtime" &&
    input.sourceFunction === "REALTIME_BULK_QUOTES" &&
    ageMinutes <= 20 &&
    input.quoteCoverage >= 80
  ) {
    return {
      mode: "Realtime" as const,
      realTimeConfirmed: true,
    };
  }

  if (input.entitlement === "delayed") {
    return {
      mode: "Delayed" as const,
      realTimeConfirmed: false,
    };
  }

  if (input.quoteCoverage >= 70) {
    return {
      mode: "End of Day" as const,
      realTimeConfirmed: false,
    };
  }

  return {
    mode: "Degraded" as const,
    realTimeConfirmed: false,
  };
}

export function industryThesis(industry: IndustryResearch) {
  const direction =
    industry.score >= 62
      ? "constructive"
      : industry.score <= 42
        ? "defensive"
        : "mixed";
  return (
    `${industry.definition.name} ranks with a ${direction} evidence profile. ` +
    `Industry breadth is ${industry.advancingSharePercent.toFixed(0)}% advancing, ` +
    `the ETF technical score is ${industry.technicalScore.toFixed(0)}/100, ` +
    `news is ${industry.newsScore.toFixed(0)}/100, and industry-specific macro alignment is ${industry.macroScore.toFixed(0)}/100.`
  );
}

export function industryDrivers(industry: IndustryResearch) {
  const drivers: string[] = [];

  if (industry.liveScore >= 58) {
    drivers.push("Live breadth and session momentum are constructive.");
  }
  if (industry.technicalScore >= 58) {
    drivers.push("ETF trend, momentum, and risk quality are supportive.");
  }
  if (industry.newsScore >= 58) {
    drivers.push("Source-weighted industry news is positively skewed.");
  }
  if (industry.macroScore >= 58) {
    drivers.push("Latest economic releases align with industry sensitivities.");
  }
  if (industry.liquidityScore >= 60) {
    drivers.push("ETF and constituent liquidity support monitorability.");
  }

  return uniqueStrings(
    drivers.length
      ? drivers
      : ["No single positive factor dominates; the industry remains a balanced watch."],
    5,
  );
}

export function industryRisks(industry: IndustryResearch) {
  const risks: string[] = [];

  if (industry.quoteCoveragePercent < 85) {
    risks.push(
      `Quote coverage is ${industry.quoteCoveragePercent.toFixed(0)}%.`,
    );
  }
  if (industry.advancingSharePercent <= 37.5) {
    risks.push("Industry breadth is weak.");
  }
  if (industry.technicalScore <= 42) {
    risks.push("ETF technical structure is weak.");
  }
  if (industry.newsScore <= 42) {
    risks.push("Current source-weighted news is negatively skewed.");
  }
  if (industry.macroScore <= 42) {
    risks.push("Latest macro releases are unfavorable for this industry profile.");
  }

  return uniqueStrings(
    risks.length
      ? risks
      : ["Concentration and reversal risk remain even without a dominant measured warning."],
    5,
  );
}

export function securityDrivers(input: {
  technical: AdvisorBriefTechnical;
  fundamentals: AdvisorBriefFundamentals;
  newsScore: number;
  changePercent: number;
}) {
  const drivers: string[] = [];

  if (input.changePercent >= 1) {
    drivers.push(
      `Live session momentum is +${input.changePercent.toFixed(2)}%.`,
    );
  }
  if (input.technical.trendScore >= 62) {
    drivers.push("The daily trend structure is constructive.");
  }
  if ((input.technical.momentum20Percent ?? 0) >= 5) {
    drivers.push(
      `Twenty-session momentum is ${input.technical.momentum20Percent?.toFixed(1)}%.`,
    );
  }
  if ((input.technical.volumeRatio5To20 ?? 0) >= 1.2) {
    drivers.push(
      `Recent volume is ${input.technical.volumeRatio5To20?.toFixed(2)}× its baseline.`,
    );
  }
  if (input.newsScore >= 58) {
    drivers.push("Ticker-specific news sentiment is positive.");
  }
  if (input.fundamentals.fundamentalScore >= 62) {
    drivers.push("Fundamental quality, growth, and valuation score constructively.");
  }

  return uniqueStrings(
    drivers.length
      ? drivers
      : ["The security ranks through a balanced combination of measured factors."],
    5,
  );
}

export function securityRisks(input: {
  technical: AdvisorBriefTechnical;
  fundamentals: AdvisorBriefFundamentals;
  newsScore: number;
  changePercent: number;
}) {
  const risks: string[] = [];

  if (input.changePercent <= -2) {
    risks.push(
      `The latest session move is ${input.changePercent.toFixed(2)}%.`,
    );
  }
  if (input.technical.trendScore <= 42) {
    risks.push("Daily trend structure is weak.");
  }
  if ((input.technical.volatility20AnnualizedPercent ?? 0) >= 60) {
    risks.push("Realized volatility is elevated.");
  }
  if ((input.technical.drawdown60Percent ?? 0) <= -20) {
    risks.push("The security remains in a material 60-session drawdown.");
  }
  if (input.newsScore <= 42) {
    risks.push("Ticker-specific news sentiment is negatively skewed.");
  }
  if (input.fundamentals.fundamentalScore <= 40) {
    risks.push("Fundamental quality, growth, or valuation is weak.");
  }

  return uniqueStrings(
    risks.length
      ? risks
      : ["No single measured risk dominates; reversal and event risk remain."],
    5,
  );
}

export type SourceRegistry =
  ReturnType<typeof createSourceRegistry>;