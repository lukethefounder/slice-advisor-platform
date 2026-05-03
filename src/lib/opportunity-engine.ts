import { createHash } from "crypto";
import { buildAdvisorOpportunityBriefing } from "@/lib/advisor-briefing";
import { prisma } from "@/lib/prisma";

type ParsedDecision = {
  id: string;
  title: string;
  summary: string | null;
  sourceName: string;
  sourceTier: string;
  url: string | null;
  category: string;
  subcategory: string;
  urgency: string;
  score: number;
  materialityScore: number;
  relevanceScore: number;
  trustScore: number;
  matchedTickersJson: string;
  matchedAreasJson: string;
  reasonsJson: string;
};

type ExposureMap = Map<
  string,
  {
    ticker: string;
    firmHoldingValue: number;
    clientHoldingValue: number;
    watchlist: boolean;
    research: boolean;
    names: Set<string>;
  }
>;

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function safeParseArray(value: string) {
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.map(String) : [];
  } catch {
    return [];
  }
}

function safeJson(value: unknown) {
  return JSON.stringify(value);
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 40);
}

function parseMoneyLike(value: string | null | undefined) {
  if (!value) return 0;
  const cleaned = value.replace(/[$,%\s,]/g, "");
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : 0;
}

function tickerKey(value: string | null | undefined) {
  return (value ?? "").trim().toUpperCase();
}

function ensureExposure(map: ExposureMap, ticker: string) {
  const key = tickerKey(ticker);

  if (!key) return null;

  if (!map.has(key)) {
    map.set(key, {
      ticker: key,
      firmHoldingValue: 0,
      clientHoldingValue: 0,
      watchlist: false,
      research: false,
      names: new Set<string>(),
    });
  }

  return map.get(key)!;
}

function categoryRiskScore(category: string, subcategory: string) {
  const text = `${category} ${subcategory}`.toLowerCase();

  if (text.includes("trading halt")) return 95;
  if (text.includes("regulatory") || text.includes("legal")) return 88;
  if (text.includes("balance sheet") || text.includes("credit")) return 82;
  if (text.includes("crypto")) return 76;
  if (text.includes("private")) return 72;
  if (text.includes("macro") || text.includes("rates")) return 64;
  if (text.includes("earnings")) return 58;
  if (text.includes("corporate actions")) return 55;

  return 40;
}

function categoryOpportunityScore(
  category: string,
  subcategory: string,
  title: string
) {
  const text = `${category} ${subcategory} ${title}`.toLowerCase();

  let score = 35;

  if (text.includes("raises guidance")) score += 35;
  if (text.includes("beats estimates")) score += 28;
  if (text.includes("merger") || text.includes("acquisition")) score += 30;
  if (text.includes("strategic") || text.includes("partnership")) score += 22;
  if (text.includes("ai") || text.includes("semiconductor")) score += 20;
  if (text.includes("rate cut")) score += 18;
  if (text.includes("product launch")) score += 18;
  if (text.includes("etf inflows")) score += 14;

  if (text.includes("cuts guidance")) score -= 25;
  if (text.includes("fraud")) score -= 35;
  if (text.includes("halt")) score -= 20;
  if (text.includes("bankruptcy")) score -= 45;
  if (text.includes("default")) score -= 35;
  if (text.includes("investigation")) score -= 25;

  return clamp(score);
}

function issuerCredibilityScore(decision: ParsedDecision) {
  let score = decision.trustScore;

  if (decision.sourceTier === "official-regulatory") score += 48;
  else if (decision.sourceTier === "official-exchange") score += 42;
  else if (decision.sourceTier === "macro-source") score += 30;
  else if (decision.sourceTier === "market-news") score += 22;
  else if (decision.sourceTier === "crypto-source") score += 14;
  else score += 6;

  if (decision.url) score += 8;
  if (decision.materialityScore >= 70) score += 8;

  return clamp(score);
}

function actionabilityScore(decision: ParsedDecision, matchedTickers: string[]) {
  let score = 20;

  if (matchedTickers.length > 0) score += 30;
  if (decision.materialityScore >= 70) score += 20;
  if (decision.urgency === "Critical") score += 20;
  if (decision.urgency === "High") score += 12;
  if (decision.trustScore >= 25) score += 10;
  if (decision.score >= 85) score += 10;

  return clamp(score);
}

function confidenceScore(decision: ParsedDecision, matchedTickers: string[]) {
  let score = 30;

  score += Math.min(30, decision.trustScore);
  score += decision.materialityScore >= 60 ? 18 : 8;
  score += matchedTickers.length > 0 ? 18 : 0;
  score += decision.relevanceScore >= 60 ? 12 : 0;
  score += decision.url ? 8 : 0;

  return clamp(score);
}

function portfolioRelevanceScore(
  exposureMap: ExposureMap,
  tickers: string[],
  areas: string[],
  decision: ParsedDecision
) {
  let score = 0;

  for (const ticker of tickers) {
    const exposure = exposureMap.get(tickerKey(ticker));

    if (!exposure) continue;

    if (exposure.firmHoldingValue > 0) score += 42;
    if (exposure.clientHoldingValue > 0) score += 40;
    if (exposure.watchlist) score += 22;
    if (exposure.research) score += 18;

    const totalExposure =
      exposure.firmHoldingValue + exposure.clientHoldingValue;

    if (totalExposure >= 1_000_000) score += 24;
    else if (totalExposure >= 250_000) score += 18;
    else if (totalExposure >= 50_000) score += 12;
  }

  const lowerAreas = areas.join(" ").toLowerCase();

  if (lowerAreas.includes("macro") || lowerAreas.includes("rates")) score += 10;
  if (lowerAreas.includes("crypto")) score += 8;
  if (lowerAreas.includes("private")) score += 8;
  if (decision.relevanceScore >= 70) score += 12;

  return clamp(score);
}

function estimatedImpactScore(input: {
  portfolioScore: number;
  materialityScore: number;
  urgency: string;
  riskScore: number;
  opportunityScore: number;
}) {
  let score =
    input.portfolioScore * 0.4 +
    input.materialityScore * 0.28 +
    Math.max(input.riskScore, input.opportunityScore) * 0.22;

  if (input.urgency === "Critical") score += 12;
  if (input.urgency === "High") score += 7;

  return clamp(score);
}

function signalTypeFor(
  category: string,
  riskScore: number,
  opportunityScore: number
) {
  const lower = category.toLowerCase();

  if (
    lower.includes("regulatory") ||
    lower.includes("legal") ||
    lower.includes("balance sheet") ||
    lower.includes("credit") ||
    riskScore >= 85
  ) {
    return "Protect";
  }

  if (opportunityScore >= 70 && riskScore < 80) {
    return "Opportunity";
  }

  if (riskScore >= 70 && opportunityScore >= 60) {
    return "High-Risk Opportunity";
  }

  return "Review";
}

function priorityTierFor(compositeScore: number, signalType: string) {
  if (compositeScore >= 88) return "Critical";
  if (compositeScore >= 76) return "High";
  if (compositeScore >= 60) return "Medium";
  if (signalType === "Protect") return "Medium";
  return "Low";
}

function suggestedActionFor(input: {
  signalType: string;
  tickers: string[];
}) {
  const tickerText = input.tickers.length
    ? input.tickers.join(", ")
    : "the affected exposure";

  if (input.signalType === "Protect") {
    return `Review ${tickerText} for downside, client exposure, concentration, and whether advisor follow-up is needed. Do not treat this as an automatic sell signal.`;
  }

  if (input.signalType === "Opportunity") {
    return `Review ${tickerText} as a possible opportunity catalyst. Compare against thesis, valuation, risk profile, and client suitability before taking action.`;
  }

  if (input.signalType === "High-Risk Opportunity") {
    return `Review ${tickerText} carefully. This may have upside potential, but risk is elevated; separate it from core portfolio decisions and document reasoning.`;
  }

  return `Review ${tickerText} for relevance. Store as advisor intelligence unless it becomes material to a portfolio or client discussion.`;
}

async function buildExposureMap(userId: string) {
  const [investorHoldings, clientProfiles, watchAssets, researchNotes] =
    await Promise.all([
      prisma.investorHolding.findMany({
        where: { userId },
      }),
      prisma.clientProfile.findMany({
        where: { userId },
        include: {
          holdings: true,
        },
      }),
      prisma.watchAsset.findMany({
        where: { userId },
      }),
      prisma.researchNote.findMany({
        where: { userId },
      }),
    ]);

  const map: ExposureMap = new Map();

  for (const holding of investorHoldings) {
    const exposure = ensureExposure(map, holding.symbol);
    if (!exposure) continue;

    exposure.firmHoldingValue += holding.valueNumber;
    exposure.names.add(holding.assetName);
  }

  for (const client of clientProfiles) {
    for (const holding of client.holdings) {
      const exposure = ensureExposure(map, holding.symbol);
      if (!exposure) continue;

      exposure.clientHoldingValue += parseMoneyLike(holding.value);
      exposure.names.add(holding.assetName);
    }
  }

  for (const asset of watchAssets) {
    const exposure = ensureExposure(map, asset.ticker);
    if (!exposure) continue;

    exposure.watchlist = true;
    exposure.names.add(asset.name);
  }

  for (const note of researchNotes) {
    const key = tickerKey(note.ticker);

    if (!key) continue;

    const exposure = ensureExposure(map, key);
    if (!exposure) continue;

    exposure.research = true;
  }

  return map;
}

export async function generateOpportunitySignals(userId: string) {
  const exposureMap = await buildExposureMap(userId);

  const decisions = await prisma.headlineDecision.findMany({
    where: {
      userId,
      score: {
        gte: 45,
      },
    },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 150,
  });

  let created = 0;
  let updated = 0;
  let skipped = 0;

  for (const decision of decisions) {
    const tickers = safeParseArray(decision.matchedTickersJson)
      .map(tickerKey)
      .filter(Boolean);

    const areas = safeParseArray(decision.matchedAreasJson);
    const reasons = safeParseArray(decision.reasonsJson);

    const portfolioScore = portfolioRelevanceScore(
      exposureMap,
      tickers,
      areas,
      decision
    );

    const risk = categoryRiskScore(decision.category, decision.subcategory);
    const opportunity = categoryOpportunityScore(
      decision.category,
      decision.subcategory,
      decision.title
    );
    const actionability = actionabilityScore(decision, tickers);
    const confidence = confidenceScore(decision, tickers);
    const issuerScore = issuerCredibilityScore(decision);

    const impactScore = estimatedImpactScore({
      portfolioScore,
      materialityScore: decision.materialityScore,
      urgency: decision.urgency,
      riskScore: risk,
      opportunityScore: opportunity,
    });

    const portfolioMustReview = portfolioScore >= 50;
    const highMateriality = decision.materialityScore >= 70;
    const strongOpportunity = opportunity >= 70;
    const strongRisk = risk >= 80;

    if (!portfolioMustReview && !highMateriality && !strongOpportunity && !strongRisk) {
      skipped += 1;
      continue;
    }

    const signalType = signalTypeFor(decision.category, risk, opportunity);

    const composite = clamp(
      decision.score * 0.22 +
        portfolioScore * 0.24 +
        impactScore * 0.18 +
        issuerScore * 0.12 +
        actionability * 0.12 +
        confidence * 0.12
    );

    if (composite < 50 && portfolioScore < 50) {
      skipped += 1;
      continue;
    }

    const priorityTier = priorityTierFor(composite, signalType);

    const evidence = [
      `Original triage score: ${decision.score}`,
      `Portfolio relevance score: ${portfolioScore}`,
      `Estimated impact score: ${impactScore}`,
      `Issuer/source credibility score: ${issuerScore}`,
      `Materiality score: ${decision.materialityScore}`,
      `Risk score: ${risk}`,
      `Opportunity score: ${opportunity}`,
      ...reasons.slice(0, 5),
    ];

    const suggestedAction = suggestedActionFor({
      signalType,
      tickers,
    });

    const categories = [
      decision.category,
      decision.subcategory,
      ...areas,
    ].filter(Boolean);

    const aiBriefing = buildAdvisorOpportunityBriefing({
      title: decision.title,
      summary: decision.summary,
      sourceName: decision.sourceName,
      sourceUrl: decision.url,
      signalType,
      priorityTier,
      tickers,
      categories,
      portfolioRelevanceScore: portfolioScore,
      opportunityScore: opportunity,
      riskScore: risk,
      confidenceScore: confidence,
      actionabilityScore: actionability,
      issuerCredibilityScore: issuerScore,
      estimatedImpactScore: impactScore,
    });

    const dedupeKey = hash(`${userId}:${decision.id}:${signalType}`);

    const existing = await prisma.opportunitySignal.findUnique({
      where: {
        userId_dedupeKey: {
          userId,
          dedupeKey,
        },
      },
    });

    await prisma.opportunitySignal.upsert({
      where: {
        userId_dedupeKey: {
          userId,
          dedupeKey,
        },
      },
      update: {
        title: decision.title,
        summary: decision.summary,
        sourceName: decision.sourceName,
        sourceUrl: decision.url,
        aiBriefing,
        signalType,
        priorityTier,
        portfolioRelevanceScore: portfolioScore,
        opportunityScore: opportunity,
        riskScore: risk,
        confidenceScore: confidence,
        actionabilityScore: actionability,
        issuerCredibilityScore: issuerScore,
        estimatedImpactScore: impactScore,
        compositeScore: composite,
        tickersJson: safeJson(tickers),
        categoriesJson: safeJson(categories),
        evidenceJson: safeJson(evidence),
        suggestedAction,
      },
      create: {
        userId,
        headlineDecisionId: decision.id,
        dedupeKey,
        title: decision.title,
        summary: decision.summary,
        sourceName: decision.sourceName,
        sourceUrl: decision.url,
        aiBriefing,
        signalType,
        priorityTier,
        portfolioRelevanceScore: portfolioScore,
        opportunityScore: opportunity,
        riskScore: risk,
        confidenceScore: confidence,
        actionabilityScore: actionability,
        issuerCredibilityScore: issuerScore,
        estimatedImpactScore: impactScore,
        compositeScore: composite,
        tickersJson: safeJson(tickers),
        categoriesJson: safeJson(categories),
        evidenceJson: safeJson(evidence),
        suggestedAction,
      },
    });

    if (existing) updated += 1;
    else created += 1;

    if (priorityTier === "Critical" || priorityTier === "High") {
      await prisma.alertEvent.upsert({
        where: {
          userId_dedupeKey: {
            userId,
            dedupeKey: `opportunity-${dedupeKey}`,
          },
        },
        update: {
          title: decision.title,
          body: suggestedAction,
          source: decision.sourceName,
          sourceUrl: decision.url,
          aiBriefing,
          ticker: tickers[0] ?? null,
          urgency: priorityTier === "Critical" ? "Critical" : "High",
          score: composite,
          channel:
            priorityTier === "Critical"
              ? "Dashboard + Email + SMS"
              : "Dashboard + Email",
        },
        create: {
          userId,
          dedupeKey: `opportunity-${dedupeKey}`,
          title: decision.title,
          body: suggestedAction,
          source: decision.sourceName,
          sourceUrl: decision.url,
          aiBriefing,
          ticker: tickers[0] ?? null,
          urgency: priorityTier === "Critical" ? "Critical" : "High",
          score: composite,
          channel:
            priorityTier === "Critical"
              ? "Dashboard + Email + SMS"
              : "Dashboard + Email",
        },
      });
    }
  }

  const signals = await prisma.opportunitySignal.findMany({
    where: { userId },
    orderBy: [{ compositeScore: "desc" }, { updatedAt: "desc" }],
    take: 100,
  });

  return {
    scanned: decisions.length,
    created,
    updated,
    skipped,
    signals,
  };
}

export async function getOpportunityRadar(userId: string) {
  const signals = await prisma.opportunitySignal.findMany({
    where: { userId },
    include: {
      headlineDecision: true,
    },
    orderBy: [{ compositeScore: "desc" }, { updatedAt: "desc" }],
    take: 120,
  });

  const open = signals.filter((signal) => signal.status === "Open");
  const critical = signals.filter((signal) => signal.priorityTier === "Critical");
  const high = signals.filter((signal) => signal.priorityTier === "High");
  const protect = signals.filter((signal) => signal.signalType === "Protect");
  const opportunity = signals.filter((signal) =>
    signal.signalType.includes("Opportunity")
  );

  return {
    signals,
    stats: {
      total: signals.length,
      open: open.length,
      critical: critical.length,
      high: high.length,
      protect: protect.length,
      opportunity: opportunity.length,
    },
  };
}