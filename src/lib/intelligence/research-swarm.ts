import "server-only";

import { createHash, randomUUID } from "node:crypto";

import type { AlphaVantageIntelligenceResponse } from "@/lib/intelligence/alpha-vantage-types";
import type { IntelligenceScanPayload } from "@/lib/intelligence-forecast/live-snapshot";
import { buildLiveMarketSnapshot } from "@/lib/intelligence-forecast/live-snapshot";
import type {
  EconomicResearchSnapshot,
  ResearchAgent,
  ResearchCohort,
  ResearchCohortResult,
  ResearchEvidence,
  ResearchForecastVector,
  ResearchGraphAnalytics,
  ResearchGraphEdge,
  ResearchGraphNode,
  ResearchKnowledgeGraph,
  ResearchMatrixRow,
  ResearchSwarmResponse,
  ResearchBotTopology,
  SliceAgenticScore,
} from "@/lib/intelligence/research-swarm-types";

const MEDIA_ROLES = [
  "Breaking-news relevance analyst",
  "Source credibility auditor",
  "Narrative velocity researcher",
  "Contradiction and rumor detector",
  "Regulatory and filing monitor",
  "Product and customer signal analyst",
  "Management credibility researcher",
  "Competitor narrative researcher",
  "Sector-media correlation analyst",
  "Event novelty analyst",
  "Institutional-news impact analyst",
  "Retail attention researcher",
  "Geopolitical headline analyst",
  "Supply-chain news researcher",
  "Earnings narrative analyst",
  "Merger and capital-allocation analyst",
  "Litigation and compliance researcher",
  "Source diversity auditor",
] as const;

const TECHNICAL_ROLES = [
  "Intraday trend analyst",
  "Multi-timeframe momentum analyst",
  "Volume and liquidity researcher",
  "Volatility regime analyst",
  "Mean-reversion analyst",
  "Breakout confirmation analyst",
  "Drawdown and tail-risk analyst",
  "Moving-average structure analyst",
  "Relative valuation analyst",
  "Fundamental quality analyst",
  "Growth durability analyst",
  "Market-cap and liquidity analyst",
  "Price-to-target dislocation analyst",
  "Trend contradiction analyst",
  "Session VWAP analyst",
  "Risk-adjusted return analyst",
  "Beta sensitivity analyst",
  "Technical data quality auditor",
] as const;

const ECONOMY_ROLES = [
  "Industry growth-cycle analyst",
  "Inflation transmission analyst",
  "Interest-rate sensitivity analyst",
  "Labor-market demand analyst",
  "Consumer demand analyst",
  "Industrial orders analyst",
  "Energy input-cost analyst",
  "Liquidity and credit analyst",
  "Economic release freshness auditor",
  "Sector macro-beta analyst",
  "Policy-regime analyst",
  "Commodity pass-through analyst",
  "Recession-risk analyst",
  "Economic contradiction analyst",
  "Industry resilience analyst",
  "Demand elasticity analyst",
  "Capital-cost analyst",
  "Macro source-quality auditor",
] as const;

const COHORT_LABELS: Record<ResearchCohort, string> = {
  media: "Media & Narrative Research",
  technical: "Technical & Company Data",
  economy: "Industry & Economy Research",
};

type GraphMode = "full" | "summary";

type RunResearchSwarmInput = {
  symbol: string;
  requestedAgents: number;
  alpha: AlphaVantageIntelligenceResponse;
  scan: IntelligenceScanPayload | null;
  economy: EconomicResearchSnapshot;
  simulationPaths?: number;
  graphMode?: GraphMode;
};

function clamp(value: number, minimum = 0, maximum = 100) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(minimum, Math.min(maximum, value));
}

function clean(value: unknown, maximumLength = 1_000) {
  return typeof value === "string"
    ? value.trim().replace(/\s+/g, " ").slice(0, maximumLength)
    : "";
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function numericHash(value: string) {
  return Number.parseInt(hash(value).slice(0, 12), 16);
}

function deterministicUnit(value: string) {
  return (numericHash(value) % 1_000_000) / 1_000_000;
}

function unique(values: string[]) {
  return Array.from(new Set(values.filter(Boolean)));
}

function average(values: number[], fallback = 50) {
  return values.length
    ? values.reduce((sum, value) => sum + value, 0) / values.length
    : fallback;
}

function weightedAverage(
  values: Array<{ value: number; weight: number }>,
  fallback = 50,
) {
  const valid = values.filter(
    (item) => Number.isFinite(item.value) && Number.isFinite(item.weight),
  );
  const totalWeight = valid.reduce(
    (sum, item) => sum + Math.max(item.weight, 0),
    0,
  );

  return totalWeight
    ? valid.reduce(
        (sum, item) => sum + item.value * Math.max(item.weight, 0),
        0,
      ) / totalWeight
    : fallback;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  return Math.sqrt(
    average(values.map((value) => (value - mean) ** 2), 0),
  );
}

function scorePolarity(score: number): ResearchEvidence["polarity"] {
  if (score >= 58) {
    return "positive";
  }

  if (score <= 42) {
    return "negative";
  }

  return "neutral";
}

function freshnessScore(asOf: string | null, retrievedAt: string) {
  if (!asOf) {
    return 35;
  }

  const ageHours = Math.max(
    0,
    (Date.parse(retrievedAt) - Date.parse(asOf)) / 3_600_000,
  );

  if (ageHours <= 0.25) {
    return 100;
  }

  if (ageHours <= 1) {
    return 94;
  }

  if (ageHours <= 6) {
    return 84;
  }

  if (ageHours <= 24) {
    return 72;
  }

  if (ageHours <= 24 * 7) {
    return 58;
  }

  if (ageHours <= 24 * 45) {
    return 45;
  }

  return 30;
}

function allocateAgents(totalInput: number) {
  const total = Math.round(clamp(totalInput, 30, 2_000));
  const base = Math.floor(total / 3);
  const remainder = total - base * 3;

  return {
    total,
    allocation: {
      media: base + (remainder >= 1 ? 1 : 0),
      technical: base + (remainder >= 2 ? 1 : 0),
      economy: base,
    } satisfies Record<ResearchCohort, number>,
  };
}

function mediaEvidence(input: {
  alpha: AlphaVantageIntelligenceResponse;
  scan: IntelligenceScanPayload | null;
  sector: string;
  industry: string;
}) {
  const evidence: ResearchEvidence[] = [];
  const retrievedAt = input.alpha.retrievedAt;

  for (const item of input.alpha.news?.items ?? []) {
    const score = clamp(50 + item.tickerSentimentScore * 50);
    const relevance = clamp(item.tickerRelevance * 100);
    const freshness = freshnessScore(item.publishedAt, retrievedAt);
    const sourceQuality = item.source || item.sourceDomain ? 78 : 45;

    evidence.push({
      id: `media:alpha:${hash(item.id).slice(0, 20)}`,
      cohort: "media",
      kind: "news",
      title: item.title || "Alpha Vantage news item",
      summary: item.summary,
      source: item.source || item.sourceDomain || "Alpha Vantage news feed",
      sourceUrl: item.url,
      asOf: item.publishedAt,
      retrievedAt,
      score,
      confidence: Math.round(
        clamp(relevance * 0.42 + freshness * 0.3 + sourceQuality * 0.28),
      ),
      freshnessScore: Math.round(freshness),
      relevanceScore: Math.round(relevance),
      polarity: scorePolarity(score),
      symbol: input.alpha.symbol,
      sector: input.sector,
      industry: input.industry,
      topics: unique(item.topics),
      metrics: {
        tickerSentimentScore: item.tickerSentimentScore,
        tickerRelevance: item.tickerRelevance,
        overallSentimentScore: item.overallSentimentScore,
      },
      warnings: [],
    });
  }

  for (const item of input.scan?.items ?? []) {
    const score = clamp(item.score);
    const asOf = input.scan?.scannedAt ?? retrievedAt;
    const freshness = freshnessScore(asOf, retrievedAt);

    evidence.push({
      id: `media:scan:${hash(item.id).slice(0, 20)}`,
      cohort: "media",
      kind: "news",
      title: clean(item.title, 1_000) || `${item.sourceName} intelligence item`,
      summary: unique(item.reasons ?? []).join(" "),
      source: item.sourceName,
      sourceUrl: "",
      asOf,
      retrievedAt,
      score,
      confidence: Math.round(
        clamp(score * 0.25 + freshness * 0.35 + 65 * 0.4),
      ),
      freshnessScore: Math.round(freshness),
      relevanceScore: Math.round(score),
      polarity: scorePolarity(score),
      symbol: input.alpha.symbol,
      sector: input.sector,
      industry: input.industry,
      topics: unique([
        item.urgency,
        ...(item.matchedTickers ?? []),
      ]),
      metrics: {
        scanScore: score,
        urgency: item.urgency,
      },
      warnings: [],
    });
  }

  return evidence;
}

function technicalEvidence(input: {
  alpha: AlphaVantageIntelligenceResponse;
  sector: string;
  industry: string;
}) {
  const evidence: ResearchEvidence[] = [];
  const alpha = input.alpha;
  const retrievedAt = alpha.retrievedAt;
  const asOf = alpha.providerAsOf;
  const freshness = freshnessScore(asOf, retrievedAt);
  const quote = alpha.quote;
  const technicals = alpha.technicals;
  const overview = alpha.overview;

  if (quote) {
    const sessionScore = clamp(50 + quote.changePercent * 8);

    evidence.push({
      id: "technical:quote",
      cohort: "technical",
      kind: "quote",
      title: `${alpha.symbol} latest Alpha Vantage quote`,
      summary: `Price ${quote.price}; change ${quote.changePercent.toFixed(
        2,
      )}%; volume ${quote.volume}.`,
      source: "Alpha Vantage GLOBAL_QUOTE",
      sourceUrl: "https://www.alphavantage.co/documentation/",
      asOf,
      retrievedAt,
      score: sessionScore,
      confidence: Math.round(
        clamp(freshness * 0.55 + (quote.volume > 0 ? 90 : 45) * 0.45),
      ),
      freshnessScore: Math.round(freshness),
      relevanceScore: 100,
      polarity: scorePolarity(sessionScore),
      symbol: alpha.symbol,
      sector: input.sector,
      industry: input.industry,
      topics: ["price", "volume", "session-change"],
      metrics: {
        price: quote.price,
        previousClose: quote.previousClose,
        changePercent: quote.changePercent,
        volume: quote.volume,
      },
      warnings: [],
    });
  }

  if (alpha.intraday?.session) {
    const session = alpha.intraday.session;
    const vwapDistance = session.vwap
      ? ((session.latest - session.vwap) / session.vwap) * 100
      : 0;
    const score = clamp(
      50 + session.changePercent * 7 + vwapDistance * 4,
    );

    evidence.push({
      id: "technical:intraday",
      cohort: "technical",
      kind: "intraday",
      title: `${alpha.intraday.interval} intraday structure`,
      summary: `Session change ${session.changePercent.toFixed(
        2,
      )}%; latest versus VWAP ${vwapDistance.toFixed(2)}%.`,
      source: "Alpha Vantage TIME_SERIES_INTRADAY",
      sourceUrl: "https://www.alphavantage.co/documentation/",
      asOf: alpha.intraday.lastRefreshed,
      retrievedAt,
      score,
      confidence: Math.round(
        clamp(
          freshnessScore(alpha.intraday.lastRefreshed, retrievedAt) * 0.65 +
            Math.min(alpha.intraday.bars.length, 50) * 0.7,
        ),
      ),
      freshnessScore: Math.round(
        freshnessScore(alpha.intraday.lastRefreshed, retrievedAt),
      ),
      relevanceScore: 100,
      polarity: scorePolarity(score),
      symbol: alpha.symbol,
      sector: input.sector,
      industry: input.industry,
      topics: ["intraday", "vwap", "liquidity"],
      metrics: {
        sessionOpen: session.open,
        sessionHigh: session.high,
        sessionLow: session.low,
        sessionLatest: session.latest,
        sessionVwap: session.vwap,
        sessionVolume: session.volume,
      },
      warnings: [],
    });
  }

  const factors: Array<{
    id: string;
    label: string;
    value: number | null | undefined;
    score: number;
    summary: string;
    topics: string[];
  }> = [
    {
      id: "trend",
      label: "Trend structure",
      value: technicals?.trendScore,
      score: technicals?.trendScore ?? 50,
      summary: technicals?.technicalSummary ?? "Trend data unavailable.",
      topics: ["trend", "moving-averages"],
    },
    {
      id: "momentum",
      label: "Momentum structure",
      value: technicals?.momentumScore,
      score: technicals?.momentumScore ?? 50,
      summary: `RSI ${technicals?.rsi14?.toFixed(1) ?? "n/a"}; 30-day momentum ${
        technicals?.momentum30?.toFixed(2) ?? "n/a"
      }%.`,
      topics: ["momentum", "rsi"],
    },
    {
      id: "risk",
      label: "Volatility and drawdown risk",
      value: technicals?.riskScore,
      score: technicals?.riskScore ?? 50,
      summary: `Annualized realized volatility ${
        technicals?.volatility20Annualized?.toFixed(2) ?? "n/a"
      }%; 60-day drawdown ${
        technicals?.drawdownFrom60DayHigh?.toFixed(2) ?? "n/a"
      }%.`,
      topics: ["volatility", "drawdown", "atr"],
    },
    {
      id: "volume",
      label: "Volume confirmation",
      value: technicals?.volumeScore,
      score: technicals?.volumeScore ?? 50,
      summary: `Recent volume trend ${
        technicals?.volumeTrendPercent?.toFixed(2) ?? "n/a"
      }%.`,
      topics: ["volume", "liquidity"],
    },
  ];

  for (const factor of factors) {
    if (factor.value === null || factor.value === undefined) {
      continue;
    }

    evidence.push({
      id: `technical:${factor.id}`,
      cohort: "technical",
      kind: "technical",
      title: factor.label,
      summary: factor.summary,
      source: "Slice calculations from Alpha Vantage history",
      sourceUrl: "https://www.alphavantage.co/documentation/",
      asOf,
      retrievedAt,
      score: clamp(factor.score),
      confidence: Math.round(
        clamp(
          freshness * 0.35 +
            Math.min(technicals?.historyPointCount ?? 0, 200) * 0.25 +
            35,
        ),
      ),
      freshnessScore: Math.round(freshness),
      relevanceScore: 100,
      polarity: scorePolarity(factor.score),
      symbol: alpha.symbol,
      sector: input.sector,
      industry: input.industry,
      topics: factor.topics,
      metrics: {
        score: factor.score,
        rawValue: factor.value,
      },
      warnings: [],
    });
  }

  if (overview) {
    const valuationScore = clamp(
      (overview.peRatio > 0
        ? 100 - ((overview.peRatio - 8) / 37) * 100
        : 50) *
        0.4 +
        (overview.pegRatio > 0
          ? 100 - ((overview.pegRatio - 0.5) / 3.5) * 100
          : 50) *
          0.25 +
        (overview.analystTargetPrice > 0 && quote
          ? clamp(
              50 +
                ((overview.analystTargetPrice - quote.price) /
                  quote.price) *
                  100,
            )
          : 50) *
          0.35,
    );
    const qualityScore = clamp(
      clamp(overview.profitMargin * 100 * 2.5) * 0.3 +
        clamp(overview.operatingMargin * 100 * 2.5) * 0.3 +
        clamp(overview.returnOnEquity * 100 * 2) * 0.4,
    );
    const growthScore = clamp(
      clamp(50 + overview.quarterlyRevenueGrowthYOY * 100) * 0.45 +
        clamp(50 + overview.quarterlyEarningsGrowthYOY * 100) * 0.55,
    );

    for (const item of [
      {
        id: "valuation",
        title: "Relative valuation and target dislocation",
        score: valuationScore,
        summary: `P/E ${overview.peRatio}; PEG ${overview.pegRatio}; analyst target ${overview.analystTargetPrice}.`,
        topics: ["valuation", "analyst-target"],
      },
      {
        id: "quality",
        title: "Fundamental quality",
        score: qualityScore,
        summary: `Profit margin ${(overview.profitMargin * 100).toFixed(
          2,
        )}%; operating margin ${(
          overview.operatingMargin * 100
        ).toFixed(2)}%; ROE ${(overview.returnOnEquity * 100).toFixed(2)}%.`,
        topics: ["quality", "margins", "roe"],
      },
      {
        id: "growth",
        title: "Growth durability",
        score: growthScore,
        summary: `Revenue growth ${(
          overview.quarterlyRevenueGrowthYOY * 100
        ).toFixed(2)}%; earnings growth ${(
          overview.quarterlyEarningsGrowthYOY * 100
        ).toFixed(2)}%.`,
        topics: ["growth", "revenue", "earnings"],
      },
    ]) {
      evidence.push({
        id: `technical:fundamental:${item.id}`,
        cohort: "technical",
        kind: "fundamental",
        title: item.title,
        summary: item.summary,
        source: "Alpha Vantage OVERVIEW",
        sourceUrl: "https://www.alphavantage.co/documentation/",
        asOf: overview.latestQuarter ?? asOf,
        retrievedAt,
        score: item.score,
        confidence: Math.round(
          clamp(
            freshnessScore(overview.latestQuarter ?? asOf, retrievedAt) *
              0.45 +
              55,
          ),
        ),
        freshnessScore: Math.round(
          freshnessScore(overview.latestQuarter ?? asOf, retrievedAt),
        ),
        relevanceScore: 100,
        polarity: scorePolarity(item.score),
        symbol: alpha.symbol,
        sector: input.sector,
        industry: input.industry,
        topics: item.topics,
        metrics: {
          marketCap: overview.marketCap,
          peRatio: overview.peRatio,
          pegRatio: overview.pegRatio,
        },
        warnings: [],
      });
    }
  }

  return evidence;
}

function economyEvidence(input: {
  economy: EconomicResearchSnapshot;
  symbol: string;
}) {
  const evidence: ResearchEvidence[] = input.economy.series.map((series) => ({
    id: `economy:${series.functionName}`,
    cohort: "economy",
    kind: "economic-series",
    title: series.label,
    summary: `${series.description} Latest ${series.latestValue ?? "n/a"}; change ${
      series.changePercent?.toFixed(2) ?? "n/a"
    }%; industry sensitivity ${series.industrySensitivity.toFixed(2)}.`,
    source: series.source,
    sourceUrl: series.sourceUrl,
    asOf: series.asOf,
    retrievedAt: series.retrievedAt,
    score: series.score,
    confidence: series.confidence,
    freshnessScore: Math.round(
      freshnessScore(series.asOf, series.retrievedAt),
    ),
    relevanceScore: Math.round(series.industrySensitivity * 100),
    polarity: scorePolarity(series.score),
    symbol: input.symbol,
    sector: input.economy.sector,
    industry: input.economy.industry,
    topics: [
      series.functionName,
      input.economy.regime,
      input.economy.sector,
    ],
    metrics: {
      latestValue: series.latestValue,
      previousValue: series.previousValue,
      change: series.change,
      changePercent: series.changePercent,
      industrySensitivity: series.industrySensitivity,
    },
    warnings: series.warning ? [series.warning] : [],
  }));

  evidence.push({
    id: "economy:industry-context",
    cohort: "economy",
    kind: "industry-context",
    title: `${input.economy.sector || "Sector"} industry macro regime`,
    summary: `${input.economy.regime} regime for ${
      input.economy.industry || input.economy.sector || "the company industry"
    }, based on the latest available economic releases.`,
    source: "Slice industry-economy synthesis",
    sourceUrl: "",
    asOf: input.economy.retrievedAt,
    retrievedAt: input.economy.retrievedAt,
    score: input.economy.score,
    confidence: input.economy.confidence,
    freshnessScore: 85,
    relevanceScore: 100,
    polarity: scorePolarity(input.economy.score),
    symbol: input.symbol,
    sector: input.economy.sector,
    industry: input.economy.industry,
    topics: [input.economy.regime, input.economy.sector],
    metrics: {
      regime: input.economy.regime,
      seriesCount: input.economy.series.length,
    },
    warnings: input.economy.warnings,
  });

  return evidence;
}

function roleLibrary(cohort: ResearchCohort) {
  if (cohort === "media") {
    return MEDIA_ROLES;
  }

  if (cohort === "technical") {
    return TECHNICAL_ROLES;
  }

  return ECONOMY_ROLES;
}

function roleEvidencePreference(role: string, evidence: ResearchEvidence) {
  const normalized = role.toLowerCase();
  const haystack = `${evidence.kind} ${evidence.title} ${evidence.topics.join(
    " ",
  )}`.toLowerCase();
  const tokens = normalized
    .split(/[^a-z0-9]+/)
    .filter((token) => token.length >= 4);
  const matches = tokens.filter((token) => haystack.includes(token)).length;
  const kindBonus =
    normalized.includes("credibility") || normalized.includes("quality")
      ? evidence.confidence / 100
      : normalized.includes("freshness") || normalized.includes("breaking")
        ? evidence.freshnessScore / 100
        : normalized.includes("relevance") || normalized.includes("industry")
          ? evidence.relevanceScore / 100
          : 0.5;

  return 1 + matches * 0.35 + kindBonus * 0.5;
}

function agentStatus(
  selectedEvidence: ResearchEvidence[],
  confidence: number,
): ResearchAgent["status"] {
  if (!selectedEvidence.length) {
    return "insufficient-evidence";
  }

  return confidence >= 45 ? "completed" : "degraded";
}

function generateAgents(input: {
  runId: string;
  cohort: ResearchCohort;
  count: number;
  evidence: ResearchEvidence[];
  generatedAt: string;
}) {
  const roles = roleLibrary(input.cohort);
  const agents: ResearchAgent[] = [];

  for (let ordinal = 0; ordinal < input.count; ordinal += 1) {
    const role = roles[ordinal % roles.length] ?? `${input.cohort} researcher`;
    const ranked = input.evidence
      .map((evidence) => ({
        evidence,
        priority:
          roleEvidencePreference(role, evidence) *
          (0.8 +
            deterministicUnit(
              `${input.runId}:${input.cohort}:${ordinal}:${evidence.id}`,
            ) *
              0.4),
      }))
      .sort((left, right) => right.priority - left.priority);
    const evidenceCount = input.evidence.length
      ? 1 + (numericHash(`${input.runId}:${input.cohort}:${ordinal}`) % 3)
      : 0;
    const selected = ranked.slice(0, evidenceCount).map((item) => item.evidence);
    const score = weightedAverage(
      selected.map((evidence) => ({
        value: evidence.score,
        weight:
          Math.max(evidence.confidence, 1) *
          Math.max(roleEvidencePreference(role, evidence), 0.25),
      })),
    );
    const confidence = weightedAverage(
      selected.map((evidence) => ({
        value: evidence.confidence,
        weight: Math.max(evidence.relevanceScore, 1),
      })),
      0,
    );
    const positiveDrivers = selected
      .filter((evidence) => evidence.score >= 56)
      .slice(0, 3)
      .map((evidence) => evidence.title);
    const negativeDrivers = selected
      .filter((evidence) => evidence.score <= 44)
      .slice(0, 3)
      .map((evidence) => evidence.title);
    const contradictions = selected
      .flatMap((left, leftIndex) =>
        selected.slice(leftIndex + 1).flatMap((right) =>
          Math.abs(left.score - right.score) >= 28
            ? [`${left.title} conflicts with ${right.title}`]
            : [],
        ),
      )
      .slice(0, 3);

    agents.push({
      id: `agent:${input.cohort}:${String(ordinal + 1).padStart(4, "0")}`,
      cohort: input.cohort,
      ordinal: ordinal + 1,
      role,
      pathway: `${role} → ${
        selected.map((evidence) => evidence.kind).join(" + ") || "no evidence"
      } → ${COHORT_LABELS[input.cohort]}`,
      status: agentStatus(selected, confidence),
      score: Math.round(clamp(score) * 100) / 100,
      confidence: Math.round(clamp(confidence) * 100) / 100,
      agreement: 0,
      evidenceIds: selected.map((evidence) => evidence.id),
      primaryEvidenceId: selected[0]?.id ?? null,
      positiveDrivers,
      negativeDrivers,
      contradictions,
      latencyMs:
        2 +
        (numericHash(`${input.runId}:${input.cohort}:${ordinal}:latency`) % 29),
      generatedAt: input.generatedAt,
    });
  }

  return agents;
}

function topStrings(values: string[], limit = 8) {
  const counts = new Map<string, number>();

  for (const value of values.filter(Boolean)) {
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }

  return [...counts.entries()]
    .sort((left, right) => right[1] - left[1])
    .slice(0, limit)
    .map(([value]) => value);
}

function aggregateCohort(input: {
  cohort: ResearchCohort;
  agents: ResearchAgent[];
  evidence: ResearchEvidence[];
}) {
  const score = weightedAverage(
    input.agents.map((agent) => ({
      value: agent.score,
      weight: Math.max(agent.confidence, 1),
    })),
  );
  const dispersion = standardDeviation(
    input.agents.map((agent) => agent.score),
  );
  const agreement = clamp(100 - dispersion * 3.5);
  const sourceCount = new Set(
    input.evidence.map((evidence) => evidence.source).filter(Boolean),
  ).size;
  const confidence = clamp(
    weightedAverage(
      input.agents.map((agent) => ({
        value: agent.confidence,
        weight: 1,
      })),
      0,
    ) *
      0.65 +
      agreement * 0.2 +
      Math.min(sourceCount * 10, 100) * 0.15,
  );
  const updatedAgents = input.agents.map((agent) => ({
    ...agent,
    agreement: Math.round(
      clamp(100 - Math.abs(agent.score - score) * 2.4) * 100,
    ) / 100,
  }));
  const result: ResearchCohortResult = {
    cohort: input.cohort,
    label: COHORT_LABELS[input.cohort],
    requestedAgents: updatedAgents.length,
    completedAgents: updatedAgents.filter(
      (agent) => agent.status === "completed",
    ).length,
    degradedAgents: updatedAgents.filter(
      (agent) => agent.status !== "completed",
    ).length,
    evidenceCount: input.evidence.length,
    independentSourceCount: sourceCount,
    score: Math.round(score * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    agreement: Math.round(agreement * 100) / 100,
    dispersion: Math.round(dispersion * 100) / 100,
    contributionToSliceScore: Math.round((score / 3) * 100) / 100,
    topPositiveDrivers: topStrings(
      updatedAgents.flatMap((agent) => agent.positiveDrivers),
    ),
    topNegativeDrivers: topStrings(
      updatedAgents.flatMap((agent) => agent.negativeDrivers),
    ),
    contradictions: topStrings(
      updatedAgents.flatMap((agent) => agent.contradictions),
      6,
    ),
  };

  return {
    agents: updatedAgents,
    result,
  };
}

function scoreLabel(score: number): SliceAgenticScore["label"] {
  if (score >= 72) {
    return "Strongly Bullish";
  }

  if (score >= 58) {
    return "Bullish";
  }

  if (score <= 28) {
    return "Strongly Bearish";
  }

  if (score <= 42) {
    return "Bearish";
  }

  return "Neutral";
}

function graphNode(input: ResearchGraphNode) {
  return input;
}

function graphEdge(input: ResearchGraphEdge) {
  return input;
}

function buildGraph(input: {
  runId: string;
  symbol: string;
  companyName: string;
  sector: string;
  industry: string;
  score: SliceAgenticScore;
  agents: ResearchAgent[];
  evidence: ResearchEvidence[];
  graphMode: GraphMode;
  generatedAt: string;
}) {
  const nodes: ResearchGraphNode[] = [];
  const edges: ResearchGraphEdge[] = [];
  const nodeIds = new Set<string>();
  const edgeIds = new Set<string>();

  function addNode(node: ResearchGraphNode) {
    if (!nodeIds.has(node.id)) {
      nodeIds.add(node.id);
      nodes.push(node);
    }
  }

  function addEdge(edge: ResearchGraphEdge) {
    if (!edgeIds.has(edge.id)) {
      edgeIds.add(edge.id);
      edges.push(edge);
    }
  }

  const runNodeId = `run:${input.runId}`;
  const assetNodeId = `asset:${input.symbol}`;
  const scoreNodeId = `score:${input.runId}`;
  const sectorNodeId = `sector:${hash(input.sector || "Unknown").slice(0, 12)}`;
  const industryNodeId = `industry:${hash(input.industry || "Unknown").slice(
    0,
    12,
  )}`;

  addNode(
    graphNode({
      id: runNodeId,
      kind: "run",
      label: `Research run ${input.symbol}`,
      cohort: "shared",
      score: input.score.overall,
      confidence: input.score.confidence,
      size: 22,
      group: "run",
      properties: {
        runId: input.runId,
        generatedAt: input.generatedAt,
      },
    }),
  );
  addNode(
    graphNode({
      id: assetNodeId,
      kind: "asset",
      label: `${input.symbol} ${input.companyName}`.trim(),
      cohort: "shared",
      score: input.score.overall,
      confidence: input.score.confidence,
      size: 25,
      group: "asset",
      properties: {
        symbol: input.symbol,
        companyName: input.companyName,
      },
    }),
  );
  addNode(
    graphNode({
      id: scoreNodeId,
      kind: "score",
      label: `Slice Score ${input.score.overall.toFixed(1)}`,
      cohort: "shared",
      score: input.score.overall,
      confidence: input.score.confidence,
      size: 30,
      group: "score",
      properties: {
        label: input.score.label,
        equalThirdWeighting: true,
      },
    }),
  );
  addNode(
    graphNode({
      id: sectorNodeId,
      kind: "sector",
      label: input.sector || "Unknown sector",
      cohort: "economy",
      score: input.score.cohorts.economy.score,
      confidence: input.score.cohorts.economy.confidence,
      size: 18,
      group: "sector",
      properties: {},
    }),
  );
  addNode(
    graphNode({
      id: industryNodeId,
      kind: "industry",
      label: input.industry || "Unknown industry",
      cohort: "economy",
      score: input.score.cohorts.economy.score,
      confidence: input.score.cohorts.economy.confidence,
      size: 17,
      group: "industry",
      properties: {},
    }),
  );

  addEdge(
    graphEdge({
      id: `edge:${runNodeId}:${assetNodeId}`,
      source: runNodeId,
      target: assetNodeId,
      kind: "RESEARCHES",
      weight: 1,
      cohort: "shared",
      properties: {},
    }),
  );
  addEdge(
    graphEdge({
      id: `edge:${runNodeId}:${scoreNodeId}`,
      source: runNodeId,
      target: scoreNodeId,
      kind: "DERIVES",
      weight: 1,
      cohort: "shared",
      properties: {},
    }),
  );
  addEdge(
    graphEdge({
      id: `edge:${assetNodeId}:${sectorNodeId}`,
      source: assetNodeId,
      target: sectorNodeId,
      kind: "OPERATES_IN",
      weight: 1,
      cohort: "economy",
      properties: {},
    }),
  );
  addEdge(
    graphEdge({
      id: `edge:${sectorNodeId}:${industryNodeId}`,
      source: sectorNodeId,
      target: industryNodeId,
      kind: "CONTAINS",
      weight: 1,
      cohort: "economy",
      properties: {},
    }),
  );

  for (const cohort of ["media", "technical", "economy"] as const) {
    const cohortNodeId = `cohort:${cohort}:${input.runId}`;
    const result = input.score.cohorts[cohort];

    addNode(
      graphNode({
        id: cohortNodeId,
        kind: "cohort",
        label: result.label,
        cohort,
        score: result.score,
        confidence: result.confidence,
        size: 23,
        group: cohort,
        properties: {
          agentCount: result.requestedAgents,
          evidenceCount: result.evidenceCount,
          contribution: result.contributionToSliceScore,
        },
      }),
    );
    addEdge(
      graphEdge({
        id: `edge:${cohortNodeId}:${scoreNodeId}`,
        source: cohortNodeId,
        target: scoreNodeId,
        kind: "CONTRIBUTES_TO",
        weight: 1 / 3,
        cohort,
        properties: {
          equalWeight: true,
        },
      }),
    );
  }

  for (const evidence of input.evidence) {
    const evidenceNodeId = `evidence:${evidence.id}`;
    const sourceNodeId = `source:${hash(evidence.source || "Unknown").slice(
      0,
      20,
    )}`;

    addNode(
      graphNode({
        id: evidenceNodeId,
        kind:
          evidence.kind === "economic-series"
            ? "economic-series"
            : "evidence",
        label: evidence.title,
        cohort: evidence.cohort,
        score: evidence.score,
        confidence: evidence.confidence,
        size: 9 + evidence.relevanceScore / 20,
        group: evidence.kind,
        properties: {
          source: evidence.source,
          asOf: evidence.asOf,
          kind: evidence.kind,
          freshnessScore: evidence.freshnessScore,
          relevanceScore: evidence.relevanceScore,
          sourceUrl: evidence.sourceUrl,
        },
      }),
    );
    addNode(
      graphNode({
        id: sourceNodeId,
        kind: "source",
        label: evidence.source || "Unknown source",
        cohort: evidence.cohort,
        score: null,
        confidence: evidence.confidence,
        size: 11,
        group: "source",
        properties: {
          sourceUrl: evidence.sourceUrl,
        },
      }),
    );
    addEdge(
      graphEdge({
        id: `edge:${evidenceNodeId}:${sourceNodeId}`,
        source: evidenceNodeId,
        target: sourceNodeId,
        kind: "PUBLISHED_BY",
        weight: evidence.confidence / 100,
        cohort: evidence.cohort,
        properties: {},
      }),
    );

    for (const topic of evidence.topics.slice(0, 6)) {
      const topicNodeId = `topic:${hash(topic).slice(0, 18)}`;
      addNode(
        graphNode({
          id: topicNodeId,
          kind: "topic",
          label: topic,
          cohort: evidence.cohort,
          score: null,
          confidence: null,
          size: 7,
          group: "topic",
          properties: {},
        }),
      );
      addEdge(
        graphEdge({
          id: `edge:${evidenceNodeId}:${topicNodeId}`,
          source: evidenceNodeId,
          target: topicNodeId,
          kind: "ABOUT_TOPIC",
          weight: evidence.relevanceScore / 100,
          cohort: evidence.cohort,
          properties: {},
        }),
      );
    }
  }

  const evidenceForLinks = input.evidence.slice(0, input.graphMode === "full" ? 180 : 60);

  for (let leftIndex = 0; leftIndex < evidenceForLinks.length; leftIndex += 1) {
    const left = evidenceForLinks[leftIndex];

    for (const right of evidenceForLinks.slice(leftIndex + 1)) {
      const sharedTopics = left.topics.filter((topic) => right.topics.includes(topic));
      const sameCohort = left.cohort === right.cohort;
      const scoreDelta = Math.abs(left.score - right.score);

      if (!sharedTopics.length && !sameCohort) {
        continue;
      }

      if (scoreDelta < 12 && sharedTopics.length) {
        addEdge(
          graphEdge({
            id: `edge:evidence:${left.id}:${right.id}:supports`,
            source: `evidence:${left.id}`,
            target: `evidence:${right.id}`,
            kind: "SUPPORTS",
            weight: clamp(0.15 + sharedTopics.length * 0.12 + (100 - scoreDelta) / 400, 0, 1),
            cohort: left.cohort === right.cohort ? left.cohort : "shared",
            properties: {
              sharedTopics: sharedTopics.join(", "),
              scoreDelta: Math.round(scoreDelta * 100) / 100,
            },
          }),
        );
      } else if (scoreDelta >= 28) {
        addEdge(
          graphEdge({
            id: `edge:evidence:${left.id}:${right.id}:contradicts`,
            source: `evidence:${left.id}`,
            target: `evidence:${right.id}`,
            kind: "CONTRADICTS",
            weight: clamp(scoreDelta / 100, 0.2, 0.95),
            cohort: left.cohort === right.cohort ? left.cohort : "shared",
            properties: {
              sharedTopics: sharedTopics.join(", "),
              scoreDelta: Math.round(scoreDelta * 100) / 100,
            },
          }),
        );
      }
    }
  }

  const agentsForGraph =
    input.graphMode === "full"
      ? input.agents
      : (["media", "technical", "economy"] as const).flatMap((cohort) =>
          input.agents.filter((agent) => agent.cohort === cohort).slice(0, 80),
        );

  for (const agent of agentsForGraph) {
    const agentNodeId = `${input.runId}:${agent.id}`;
    const cohortNodeId = `cohort:${agent.cohort}:${input.runId}`;
    addNode(
      graphNode({
        id: agentNodeId,
        kind: "agent",
        label: `${agent.role} #${agent.ordinal}`,
        cohort: agent.cohort,
        score: agent.score,
        confidence: agent.confidence,
        size: 4 + agent.confidence / 40,
        group: agent.role,
        properties: {
          role: agent.role,
          pathway: agent.pathway,
          status: agent.status,
          latencyMs: agent.latencyMs,
        },
      }),
    );
    addEdge(
      graphEdge({
        id: `edge:${cohortNodeId}:${agentNodeId}`,
        source: cohortNodeId,
        target: agentNodeId,
        kind: "CONTAINS",
        weight: agent.confidence / 100,
        cohort: agent.cohort,
        properties: {},
      }),
    );

    for (const evidenceId of agent.evidenceIds) {
      const evidenceNodeId = `evidence:${evidenceId}`;
      if (!nodeIds.has(evidenceNodeId)) {
        continue;
      }
      addEdge(
        graphEdge({
          id: `edge:${agentNodeId}:${evidenceNodeId}`,
          source: agentNodeId,
          target: evidenceNodeId,
          kind: "USES_EVIDENCE",
          weight: agent.confidence / 100,
          cohort: agent.cohort,
          properties: {},
        }),
      );
    }
  }

  const clusters: ResearchKnowledgeGraph["clusters"] = ([
    "media",
    "technical",
    "economy",
  ] as const).map((cohort) => ({
      id: cohort,
      label: COHORT_LABELS[cohort],
      cohort,
      nodeCount: nodes.filter((node) => node.cohort === cohort).length,
      averageScore: input.score.cohorts[cohort].score,
    }));
  clusters.push({
    id: "shared",
    label: "Shared score and asset context",
    cohort: "shared",
    nodeCount: nodes.filter((node) => node.cohort === "shared").length,
    averageScore: input.score.overall,
  });

  return {
    schemaVersion: "slice-research-graph-1.0.0",
    runId: input.runId,
    generatedAt: input.generatedAt,
    nodeCount: nodes.length,
    edgeCount: edges.length,
    nodes,
    edges,
    clusters,
  } satisfies ResearchKnowledgeGraph;
}


function buildGraphAnalytics(
  graph: ResearchKnowledgeGraph,
  score: SliceAgenticScore,
): ResearchGraphAnalytics {
  const degree = new Map<string, { degree: number; weighted: number; cohorts: Set<string>; contradictions: number }>();

  for (const node of graph.nodes) {
    degree.set(node.id, {
      degree: 0,
      weighted: 0,
      cohorts: new Set([node.cohort]),
      contradictions: 0,
    });
  }

  for (const edge of graph.edges) {
    for (const id of [edge.source, edge.target]) {
      const current = degree.get(id);

      if (!current) {
        continue;
      }

      current.degree += 1;
      current.weighted += edge.weight;
      current.cohorts.add(edge.cohort);

      if (edge.kind === "CONTRADICTS" || edge.kind === "OPPOSES") {
        current.contradictions += 1;
      }
    }
  }

  const nodeById = new Map(graph.nodes.map((node) => [node.id, node]));
  const maximumDegree = Math.max(
    1,
    ...Array.from(degree.values()).map((item) => item.degree),
  );
  const centralityTop = Array.from(degree.entries())
    .map(([id, metrics]) => {
      const node = nodeById.get(id);
      return node
        ? {
            id,
            label: node.label,
            kind: node.kind,
            cohort: node.cohort,
            degree: metrics.degree,
            weightedDegree: Math.round(metrics.weighted * 100) / 100,
            centralityScore: Math.round((metrics.degree / maximumDegree) * 100),
          }
        : null;
    })
    .filter((item): item is NonNullable<typeof item> => Boolean(item))
    .sort((left, right) => right.centralityScore - left.centralityScore)
    .slice(0, 12);
  const bridgeNodes = Array.from(degree.entries())
    .flatMap(([id, metrics]) => {
      const node = nodeById.get(id);
      if (!node || metrics.cohorts.size < 2) {
        return [];
      }
      return [
        {
          id,
          label: node.label,
          cohort: node.cohort,
          bridgeScore: Math.round(
            clamp(metrics.degree * 4 + metrics.cohorts.size * 18),
          ),
        },
      ];
    })
    .sort((left, right) => right.bridgeScore - left.bridgeScore)
    .slice(0, 10);
  const contradictionHotspots = Array.from(degree.entries())
    .flatMap(([id, metrics]) => {
      const node = nodeById.get(id);
      if (!node || metrics.contradictions <= 0) {
        return [];
      }
      return [
        {
          id,
          label: node.label,
          cohort: node.cohort,
          contradictionCount: metrics.contradictions,
          severity: Math.round(
            clamp(metrics.contradictions * 20 + Math.abs((node.score ?? 50) - 50)),
          ),
        },
      ];
    })
    .sort((left, right) => right.severity - left.severity)
    .slice(0, 10);
  const possibleEdges = Math.max(
    1,
    (graph.nodeCount * Math.max(graph.nodeCount - 1, 1)) / 2,
  );
  const density = clamp((graph.edgeCount / possibleEdges) * 8_000);
  const edgeIntensity = clamp(
    average(graph.edges.map((edge) => edge.weight * 100), 50),
  );
  const connectednessScore = clamp(
    density * 0.25 + edgeIntensity * 0.35 + centralityTop.length * 3 + bridgeNodes.length * 2,
  );
  const visualComplexity = clamp(
    Math.log2(Math.max(graph.nodeCount, 1)) * 9 +
      Math.log2(Math.max(graph.edgeCount, 1)) * 7 +
      bridgeNodes.length * 2,
  );
  const clusterPressure: ResearchGraphAnalytics["clusterPressure"] = {
    media: {
      score: score.cohorts.media.score,
      confidence: score.cohorts.media.confidence,
      pressure: Math.round(Math.abs(score.cohorts.media.score - score.overall) * 100) / 100,
      nodeCount: graph.nodes.filter((node) => node.cohort === "media").length,
    },
    technical: {
      score: score.cohorts.technical.score,
      confidence: score.cohorts.technical.confidence,
      pressure: Math.round(Math.abs(score.cohorts.technical.score - score.overall) * 100) / 100,
      nodeCount: graph.nodes.filter((node) => node.cohort === "technical").length,
    },
    economy: {
      score: score.cohorts.economy.score,
      confidence: score.cohorts.economy.confidence,
      pressure: Math.round(Math.abs(score.cohorts.economy.score - score.overall) * 100) / 100,
      nodeCount: graph.nodes.filter((node) => node.cohort === "economy").length,
    },
    shared: {
      score: score.overall,
      confidence: score.confidence,
      pressure: 0,
      nodeCount: graph.nodes.filter((node) => node.cohort === "shared").length,
    },
  };

  return {
    density: Math.round(density * 100) / 100,
    visualComplexity: Math.round(visualComplexity * 100) / 100,
    edgeIntensity: Math.round(edgeIntensity * 100) / 100,
    connectednessScore: Math.round(connectednessScore * 100) / 100,
    centralityTop,
    bridgeNodes,
    contradictionHotspots,
    clusterPressure,
  };
}

function relationshipFromDelta(delta: number): ResearchBotTopology["cohortHandoffs"][number]["relationship"] {
  if (delta >= 18) {
    return "contradicts";
  }
  if (delta >= 9) {
    return "diverges";
  }
  if (delta <= 3) {
    return "confirms";
  }
  return "reinforces";
}

function buildBotTopology(input: {
  cohorts: Record<ResearchCohort, ResearchCohortResult>;
  agents: ResearchAgent[];
  durationMs: number;
}): ResearchBotTopology {
  const mediaTechnical = Math.abs(input.cohorts.media.score - input.cohorts.technical.score);
  const mediaEconomy = Math.abs(input.cohorts.media.score - input.cohorts.economy.score);
  const technicalEconomy = Math.abs(input.cohorts.technical.score - input.cohorts.economy.score);
  const averageTension = average([mediaTechnical, mediaEconomy, technicalEconomy], 0);
  const averageLatencyMs = average(input.agents.map((agent) => agent.latencyMs), 0);
  const completionRate = input.agents.length
    ? (input.agents.filter((agent) => agent.status === "completed").length / input.agents.length) * 100
    : 0;
  const consensusScore = clamp(
    100 - averageTension * 1.25 +
      average([
        input.cohorts.media.agreement,
        input.cohorts.technical.agreement,
        input.cohorts.economy.agreement,
      ]) * 0.2,
  );
  const throughput = input.durationMs > 0
    ? input.agents.length / (input.durationMs / 1_000)
    : input.agents.length;
  const pairings: Array<[ResearchCohort, ResearchCohort, number]> = [
    ["media", "technical", mediaTechnical],
    ["media", "economy", mediaEconomy],
    ["technical", "economy", technicalEconomy],
  ];

  return {
    totalPathways: input.agents.length,
    mediaToTechnicalTension: Math.round(mediaTechnical * 100) / 100,
    mediaToEconomyTension: Math.round(mediaEconomy * 100) / 100,
    technicalToEconomyTension: Math.round(technicalEconomy * 100) / 100,
    consensusScore: Math.round(consensusScore * 100) / 100,
    pathwayThroughputPerSecond: Math.round(throughput * 100) / 100,
    averageLatencyMs: Math.round(averageLatencyMs * 100) / 100,
    completionRate: Math.round(completionRate * 100) / 100,
    cohortHandoffs: pairings.map(([from, to, delta]) => ({
      from,
      to,
      relationship: relationshipFromDelta(delta),
      strength: Math.round(clamp(100 - delta * 2) * 100) / 100,
      description: `${COHORT_LABELS[from]} and ${COHORT_LABELS[to]} differ by ${delta.toFixed(1)} score points.`,
    })),
  };
}

function buildForecastVector(input: {
  score: SliceAgenticScore;
  graphAnalytics: ResearchGraphAnalytics;
  botTopology: ResearchBotTopology;
  quoteChangePercent: number;
}): ResearchForecastVector {
  const bias = input.score.overall >= 58
    ? "bullish"
    : input.score.overall <= 42
      ? "bearish"
      : "neutral";
  const directionalForce = (input.score.overall - 50) / 50;
  const expectedDriftPercent =
    directionalForce * 3.2 +
    input.quoteChangePercent * 0.18 +
    (input.graphAnalytics.connectednessScore - 50) * 0.018 -
    input.score.quality.contradictionPenalty * 0.035;
  const confidenceLift = clamp(
    input.score.confidence * 0.34 +
      input.graphAnalytics.connectednessScore * 0.24 +
      input.botTopology.consensusScore * 0.24 +
      input.score.quality.evidenceCoverage * 0.18,
  );
  const tailRiskScore = clamp(
    input.score.quality.contradictionPenalty * 2.3 +
      input.score.quality.freshnessPenalty * 2.4 +
      Math.max(0, 50 - input.botTopology.consensusScore) * 0.8,
  );
  const regimePressure = clamp(
    Math.abs(input.score.cohorts.technical.score - input.score.cohorts.economy.score) * 1.4 +
      input.graphAnalytics.visualComplexity * 0.2,
  );
  const dataFreshnessScore = clamp(
    input.score.quality.realTimeConfirmed
      ? 100 - input.score.quality.freshnessPenalty
      : input.score.quality.delayed
        ? 78 - input.score.quality.freshnessPenalty
        : 58 - input.score.quality.freshnessPenalty,
  );
  const networkAmplification = clamp(
    input.graphAnalytics.edgeIntensity * 0.35 +
      input.graphAnalytics.connectednessScore * 0.45 +
      input.graphAnalytics.bridgeNodes.length * 2,
  );
  const contradictionDrag = clamp(
    input.score.quality.contradictionPenalty * 2 +
      input.graphAnalytics.contradictionHotspots.reduce(
        (sum, hotspot) => sum + hotspot.severity,
        0,
      ) * 0.02,
  );

  return {
    algorithmVersion: "slice-swarm-forecast-vector-2.0.0",
    forecastBias: bias,
    expectedDriftPercent: Math.round(expectedDriftPercent * 100) / 100,
    confidenceLift: Math.round(confidenceLift * 100) / 100,
    tailRiskScore: Math.round(tailRiskScore * 100) / 100,
    regimePressure: Math.round(regimePressure * 100) / 100,
    dataFreshnessScore: Math.round(dataFreshnessScore * 100) / 100,
    networkAmplification: Math.round(networkAmplification * 100) / 100,
    contradictionDrag: Math.round(contradictionDrag * 100) / 100,
    driverSummary: `${bias} bias with ${input.botTopology.consensusScore.toFixed(0)}% pathway consensus and ${input.graphAnalytics.connectednessScore.toFixed(0)}% graph connectedness.`,
  };
}

function buildResearchMatrix(input: {
  cohorts: Record<ResearchCohort, ResearchCohortResult>;
}): ResearchMatrixRow[] {
  return (["media", "technical", "economy"] as const).flatMap((cohort) => {
    const result = input.cohorts[cohort];
    return [
      {
        cohort,
        dimension: "Score",
        score: result.score,
        confidence: result.confidence,
        evidenceCount: result.evidenceCount,
        agentCount: result.requestedAgents,
        weight: 1 / 3,
      },
      {
        cohort,
        dimension: "Agreement",
        score: result.agreement,
        confidence: result.confidence,
        evidenceCount: result.evidenceCount,
        agentCount: result.requestedAgents,
        weight: 1 / 3,
      },
      {
        cohort,
        dimension: "Dispersion control",
        score: clamp(100 - result.dispersion * 3),
        confidence: result.confidence,
        evidenceCount: result.evidenceCount,
        agentCount: result.requestedAgents,
        weight: 1 / 3,
      },
    ];
  });
}

export function runResearchSwarm(
  input: RunResearchSwarmInput,
): Omit<ResearchSwarmResponse, "graphPersistence"> {
  const startedAt = new Date().toISOString();
  const startedMs = Date.now();
  const runId = randomUUID();
  const allocationResult = allocateAgents(input.requestedAgents);
  const sector = input.alpha.overview?.sector || input.economy.sector || "Unknown";
  const industry =
    input.alpha.overview?.industry || input.economy.industry || "Unknown";
  const companyName = input.alpha.overview?.name || input.symbol;
  const media = mediaEvidence({
    alpha: input.alpha,
    scan: input.scan,
    sector,
    industry,
  });
  const technical = technicalEvidence({
    alpha: input.alpha,
    sector,
    industry,
  });
  const economy = economyEvidence({
    economy: input.economy,
    symbol: input.symbol,
  });
  const evidence = [...media, ...technical, ...economy];
  const generatedAt = new Date().toISOString();
  const mediaAgents = generateAgents({
    runId,
    cohort: "media",
    count: allocationResult.allocation.media,
    evidence: media,
    generatedAt,
  });
  const technicalAgents = generateAgents({
    runId,
    cohort: "technical",
    count: allocationResult.allocation.technical,
    evidence: technical,
    generatedAt,
  });
  const economyAgents = generateAgents({
    runId,
    cohort: "economy",
    count: allocationResult.allocation.economy,
    evidence: economy,
    generatedAt,
  });
  const mediaAggregation = aggregateCohort({
    cohort: "media",
    agents: mediaAgents,
    evidence: media,
  });
  const technicalAggregation = aggregateCohort({
    cohort: "technical",
    agents: technicalAgents,
    evidence: technical,
  });
  const economyAggregation = aggregateCohort({
    cohort: "economy",
    agents: economyAgents,
    evidence: economy,
  });
  const agents = [
    ...mediaAggregation.agents,
    ...technicalAggregation.agents,
    ...economyAggregation.agents,
  ];
  const cohorts = {
    media: mediaAggregation.result,
    technical: technicalAggregation.result,
    economy: economyAggregation.result,
  };
  const overall =
    (cohorts.media.score + cohorts.technical.score + cohorts.economy.score) /
    3;
  const baseConfidence =
    (cohorts.media.confidence +
      cohorts.technical.confidence +
      cohorts.economy.confidence) /
    3;
  const contradictionPenalty = clamp(
    average(
      [
        Math.abs(cohorts.media.score - cohorts.technical.score),
        Math.abs(cohorts.media.score - cohorts.economy.score),
        Math.abs(cohorts.technical.score - cohorts.economy.score),
      ],
      0,
    ) * 0.75,
    0,
    25,
  );
  const freshnessPenalty = input.alpha.freshness.isRealtime
    ? 0
    : input.alpha.freshness.isDelayed ||
        input.alpha.freshness.mode === "market_closed"
      ? 5
      : 13;
  const agentCompletionRate =
    agents.length > 0
      ? (agents.filter((agent) => agent.status === "completed").length /
          agents.length) *
        100
      : 0;
  const sourceDiversity = clamp(
    new Set(evidence.map((item) => item.source).filter(Boolean)).size * 7,
  );
  const live = buildLiveMarketSnapshot({
    symbol: input.symbol,
    alpha: input.alpha,
    scan: input.scan,
    simulationPaths: input.simulationPaths ?? 500,
  });
  const evidenceCoverage = live.coverage.score;
  const confidence = clamp(
    baseConfidence * 0.55 +
      evidenceCoverage * 0.2 +
      sourceDiversity * 0.1 +
      agentCompletionRate * 0.15 -
      contradictionPenalty -
      freshnessPenalty,
  );
  const score: SliceAgenticScore = {
    schemaVersion: "slice-agentic-score-1.0.0",
    overall: Math.round(overall * 100) / 100,
    confidence: Math.round(confidence * 100) / 100,
    label: scoreLabel(overall),
    generatedAt,
    providerAsOf: input.alpha.providerAsOf,
    weighting: {
      media: 1 / 3,
      technical: 1 / 3,
      economy: 1 / 3,
    },
    cohorts,
    quality: {
      realTimeConfirmed: input.alpha.freshness.isRealtime,
      delayed: input.alpha.freshness.isDelayed,
      marketOpen: input.alpha.market?.isOpen ?? null,
      evidenceCoverage,
      sourceDiversity,
      agentCompletionRate,
      contradictionPenalty,
      freshnessPenalty,
    },
    drivers: {
      positive: topStrings([
        ...cohorts.media.topPositiveDrivers,
        ...cohorts.technical.topPositiveDrivers,
        ...cohorts.economy.topPositiveDrivers,
      ]),
      negative: topStrings([
        ...cohorts.media.topNegativeDrivers,
        ...cohorts.technical.topNegativeDrivers,
        ...cohorts.economy.topNegativeDrivers,
      ]),
      contradictions: topStrings([
        ...cohorts.media.contradictions,
        ...cohorts.technical.contradictions,
        ...cohorts.economy.contradictions,
      ]),
    },
    safeguards: {
      equalThirdWeighting: true,
      autonomousTradingEnabled: false,
      unavailableInputsNeutralized: true,
      simulatedAgentsAreObservedTruth: false,
      externalCallsPerAgent: false,
    },
  };
  const forecastSnapshot = {
    ...live.snapshot,
    slice: {
      ...live.snapshot.slice,
      sentimentScore: score.overall,
      sentimentConfidence: score.confidence,
      dataQuality: clamp(
        score.quality.evidenceCoverage * 0.55 +
          score.quality.sourceDiversity * 0.2 +
          score.quality.agentCompletionRate * 0.25 -
          score.quality.contradictionPenalty,
      ),
      sourceCount: evidence.length,
      independentSourceCount: new Set(
        evidence.map((item) => item.source).filter(Boolean),
      ).size,
      duplicateCount: Math.max(
        0,
        evidence.length -
          new Set(evidence.map((item) => item.source).filter(Boolean)).size,
      ),
    },
    news: {
      ...live.snapshot.news,
      relevanceWeightedSentiment: (cohorts.media.score - 50) / 50,
      articleCount: media.length,
      sourceReliability: cohorts.media.confidence,
      contradictionScore: clamp(100 - cohorts.media.agreement),
    },
    macro: {
      ...live.snapshot.macro,
      alignmentScore: cohorts.economy.score,
      stressScore: clamp(100 - cohorts.economy.score),
      surpriseScore: clamp(cohorts.economy.score),
    },
  };
  const graph = buildGraph({
    runId,
    symbol: input.symbol,
    companyName,
    sector,
    industry,
    score,
    agents,
    evidence,
    graphMode: input.graphMode ?? "full",
    generatedAt,
  });
  const durationMs = Date.now() - startedMs;
  const graphAnalytics = buildGraphAnalytics(graph, score);
  const botTopology = buildBotTopology({
    cohorts,
    agents,
    durationMs,
  });
  const forecastVector = buildForecastVector({
    score,
    graphAnalytics,
    botTopology,
    quoteChangePercent: input.alpha.quote?.changePercent ?? 0,
  });
  const researchMatrix = buildResearchMatrix({ cohorts });
  const completedAt = new Date().toISOString();
  const warnings = unique([
    ...input.alpha.health.warnings,
    ...input.economy.warnings,
    ...evidence.flatMap((item) => item.warnings),
    ...(!media.length
      ? ["Media cohort had no live evidence and was neutralized at low confidence."]
      : []),
    ...(!technical.length
      ? ["Technical cohort had no live evidence and was neutralized at low confidence."]
      : []),
    ...(!economy.length
      ? ["Economy cohort had no release evidence and was neutralized at low confidence."]
      : []),
    "Economic indicators are latest-release data, not continuous market ticks.",
    "The 2,000 agents are independent analytical pathways over shared evidence; they do not each make an external API request.",
  ]);

  return {
    schemaVersion: "slice-research-swarm-1.0.0",
    ok: true,
    runId,
    symbol: input.symbol,
    companyName,
    sector,
    industry,
    requestedAgents: allocationResult.total,
    activeAgents: agents.length,
    allocation: allocationResult.allocation,
    startedAt,
    completedAt,
    durationMs,
    providerAsOf: input.alpha.providerAsOf,
    retrievedAt: input.alpha.retrievedAt,
    market: {
      provider: "Alpha Vantage",
      price: input.alpha.quote?.price ?? 0,
      previousClose: input.alpha.quote?.previousClose ?? 0,
      change: input.alpha.quote?.change ?? 0,
      changePercent: input.alpha.quote?.changePercent ?? 0,
      volume: input.alpha.quote?.volume ?? 0,
      currency: input.alpha.overview?.currency || "USD",
      freshnessMode: input.alpha.freshness.mode,
      freshnessLabel: input.alpha.freshness.label,
      realTimeConfirmed: input.alpha.freshness.isRealtime,
      delayed: input.alpha.freshness.isDelayed,
      marketOpen: input.alpha.market?.isOpen ?? null,
      marketStatus: input.alpha.market?.currentStatus || "unknown",
      providerTimeZone: input.alpha.providerTimeZone,
    },
    score,
    cohorts,
    evidence,
    agents,
    economy: input.economy,
    graph,
    graphAnalytics,
    botTopology,
    forecastVector,
    researchMatrix,
    forecastSnapshot,
    warnings,
  };
}