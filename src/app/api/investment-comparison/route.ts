import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";

const ASSET_TYPES = ["Stock", "Bond", "ETF", "Fund"] as const;
const HOLDING_TERMS = ["Short Term", "Medium Term", "Long Term"] as const;
const RISK_TOLERANCES = ["Conservative", "Moderate", "Aggressive"] as const;
const OBJECTIVES = ["Capital Preservation", "Income", "Balanced Growth", "Growth"] as const;

type AssetType = (typeof ASSET_TYPES)[number];
type HoldingTerm = (typeof HOLDING_TERMS)[number];
type RiskTolerance = (typeof RISK_TOLERANCES)[number];
type Objective = (typeof OBJECTIVES)[number];

type SecurityInput = {
  symbol: string;
  name?: string;
  assetType: AssetType;
  sector?: string;
  marketCap?: string;
  bondType?: string;
  creditQuality?: string;
  durationBucket?: string;
  expectedReturnPct?: number | string | null;
  yieldPct?: number | string | null;
  volatilityPct?: number | string | null;
  beta?: number | string | null;
};

type NormalizedSecurity = {
  symbol: string;
  name: string;
  assetType: AssetType;
  sector: string;
  marketCap: string;
  bondType: string;
  creditQuality: string;
  durationBucket: string;
  expectedReturnPct: number | null;
  yieldPct: number | null;
  volatilityPct: number | null;
  beta: number | null;
};

type TermFit = {
  short: number;
  medium: number;
  long: number;
};

type AssetAnalysis = {
  symbol: string;
  name: string;
  assetType: AssetType;
  headline: string;
  riskScore: number;
  rewardScore: number;
  incomeScore: number;
  liquidityScore: number;
  volatilityRisk: number;
  durationRisk: number;
  creditRisk: number;
  rateSensitivity: number;
  timeHorizonFit: string;
  bestUseCase: string;
  riskProfile: string;
  rewardProfile: string;
  potentialRewards: string[];
  keyRisks: string[];
  whatToWatch: string[];
  termFit: TermFit;
};

function cleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const cleaned = value.replace("%", "").trim();
    if (!cleaned) return null;

    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function isAssetType(value: unknown): value is AssetType {
  return typeof value === "string" && ASSET_TYPES.includes(value as AssetType);
}

function isHoldingTerm(value: unknown): value is HoldingTerm {
  return typeof value === "string" && HOLDING_TERMS.includes(value as HoldingTerm);
}

function isRiskTolerance(value: unknown): value is RiskTolerance {
  return (
    typeof value === "string" &&
    RISK_TOLERANCES.includes(value as RiskTolerance)
  );
}

function isObjective(value: unknown): value is Objective {
  return typeof value === "string" && OBJECTIVES.includes(value as Objective);
}

function normalizeSecurity(input: Partial<SecurityInput>, fallbackLabel: string): NormalizedSecurity {
  const assetType = isAssetType(input.assetType) ? input.assetType : "Stock";
  const symbol = cleanString(input.symbol).toUpperCase();

  return {
    symbol: symbol || fallbackLabel,
    name: cleanString(input.name) || symbol || fallbackLabel,
    assetType,
    sector: cleanString(input.sector) || "Unknown",
    marketCap: cleanString(input.marketCap) || "Unknown",
    bondType: cleanString(input.bondType) || "Unknown",
    creditQuality: cleanString(input.creditQuality) || "Unknown",
    durationBucket: cleanString(input.durationBucket) || "Unknown",
    expectedReturnPct: toNumber(input.expectedReturnPct),
    yieldPct: toNumber(input.yieldPct),
    volatilityPct: toNumber(input.volatilityPct),
    beta: toNumber(input.beta),
  };
}

function riskToleranceScore(riskTolerance: RiskTolerance) {
  if (riskTolerance === "Conservative") return 35;
  if (riskTolerance === "Aggressive") return 80;
  return 55;
}

function sectorRiskAdjustment(sector: string) {
  const map: Record<string, number> = {
    Technology: 10,
    "Consumer Discretionary": 8,
    Financials: 7,
    Industrials: 5,
    Healthcare: 4,
    Energy: 9,
    Utilities: -8,
    "Consumer Staples": -6,
    "Real Estate": 6,
    Materials: 7,
    Communication: 8,
    Unknown: 3,
  };

  return map[sector] ?? 3;
}

function marketCapRiskAdjustment(marketCap: string) {
  const map: Record<string, number> = {
    "Mega Cap": -8,
    "Large Cap": -5,
    "Mid Cap": 3,
    "Small Cap": 12,
    "Micro Cap": 22,
    Unknown: 4,
  };

  return map[marketCap] ?? 4;
}

function durationRisk(durationBucket: string) {
  const map: Record<string, number> = {
    "Ultra Short": 10,
    Short: 22,
    Intermediate: 43,
    Long: 72,
    Unknown: 40,
  };

  return map[durationBucket] ?? 40;
}

function creditRisk(creditQuality: string) {
  const map: Record<string, number> = {
    "Treasury / Government": 5,
    AAA: 8,
    AA: 12,
    A: 18,
    BBB: 32,
    "High Yield / Below Investment Grade": 68,
    Unknown: 35,
  };

  return map[creditQuality] ?? 35;
}

function bondTypeRiskAdjustment(bondType: string) {
  const map: Record<string, number> = {
    Treasury: -18,
    Municipal: -8,
    "Investment Grade Corporate": 4,
    "High Yield Corporate": 24,
    TIPS: -5,
    International: 12,
    Unknown: 4,
  };

  return map[bondType] ?? 4;
}

function stockAnalysis(security: NormalizedSecurity): AssetAnalysis {
  const betaRisk =
    security.beta === null ? 8 : security.beta > 1.4 ? 18 : security.beta > 1.1 ? 10 : security.beta < 0.8 ? -6 : 3;

  const volatilityRisk =
    security.volatilityPct === null
      ? 55
      : security.volatilityPct >= 45
        ? 88
        : security.volatilityPct >= 30
          ? 72
          : security.volatilityPct >= 20
            ? 55
            : security.volatilityPct >= 12
              ? 38
              : 25;

  const riskScore = clamp(
    48 +
      sectorRiskAdjustment(security.sector) +
      marketCapRiskAdjustment(security.marketCap) +
      betaRisk +
      (volatilityRisk - 50) * 0.35
  );

  const expectedReturnBoost =
    security.expectedReturnPct === null
      ? 0
      : security.expectedReturnPct >= 18
        ? 18
        : security.expectedReturnPct >= 12
          ? 12
          : security.expectedReturnPct >= 8
            ? 7
            : security.expectedReturnPct >= 4
              ? 3
              : -5;

  const dividendBoost =
    security.yieldPct === null
      ? 0
      : security.yieldPct >= 4
        ? 8
        : security.yieldPct >= 2
          ? 5
          : security.yieldPct > 0
            ? 2
            : 0;

  const rewardScore = clamp(
    62 +
      expectedReturnBoost +
      dividendBoost +
      (security.assetType === "ETF" || security.assetType === "Fund" ? -4 : 4)
  );

  const incomeScore = clamp(security.yieldPct === null ? 25 : security.yieldPct * 12 + 20);
  const liquidityScore = security.assetType === "Stock" || security.assetType === "ETF" ? 88 : 75;

  const termFit: TermFit = {
    short: clamp(42 - riskScore * 0.2 + incomeScore * 0.1),
    medium: clamp(58 + rewardScore * 0.25 - riskScore * 0.12),
    long: clamp(70 + rewardScore * 0.35 - riskScore * 0.1),
  };

  const potentialRewards = [
    "Potential capital appreciation if the company grows earnings, revenue, margins, or market share.",
    "Liquidity benefit because listed stocks and ETFs are usually easy to buy or sell during market hours.",
    security.yieldPct && security.yieldPct > 0
      ? "Possible dividend income in addition to price appreciation."
      : "Potential upside comes primarily from price appreciation rather than income.",
    security.assetType === "ETF" || security.assetType === "Fund"
      ? "Diversification benefit if the fund holds a broad basket of securities."
      : "Company-specific upside if the individual business executes well.",
  ];

  const keyRisks = [
    "Market volatility can create short-term drawdowns even when the long-term thesis is intact.",
    "Company, sector, valuation, earnings, and sentiment risk can affect returns.",
    "A high expected reward usually comes with a higher probability of price swings or permanent capital loss.",
    "Short holding periods can make timing risk more important than fundamental quality.",
  ];

  const whatToWatch = [
    "Earnings growth, revenue growth, margins, valuation multiples, and free cash flow.",
    "Sector trends, interest-rate sensitivity, market sentiment, and liquidity.",
    "Position size relative to the portfolio and whether the investment matches the intended holding term.",
  ];

  return {
    symbol: security.symbol,
    name: security.name,
    assetType: security.assetType,
    headline:
      riskScore >= 70
        ? "Higher-risk growth-oriented profile"
        : riskScore >= 50
          ? "Moderate equity risk profile"
          : "Lower-volatility equity profile",
    riskScore,
    rewardScore,
    incomeScore,
    liquidityScore,
    volatilityRisk,
    durationRisk: 0,
    creditRisk: 0,
    rateSensitivity: clamp(riskScore * 0.25),
    timeHorizonFit:
      termFit.long >= termFit.short
        ? "Better suited for medium-to-long holding periods."
        : "Could fit shorter tactical use, but still carries equity volatility.",
    bestUseCase:
      security.yieldPct && security.yieldPct >= 3
        ? "Income plus growth exposure."
        : "Growth, capital appreciation, or tactical equity exposure.",
    riskProfile:
      "This investment behaves primarily like an equity exposure. The main risks are price volatility, valuation changes, company execution, earnings disappointment, sector rotation, and broader market drawdowns.",
    rewardProfile:
      "The reward profile is driven mostly by price appreciation, business growth, valuation expansion, and potentially dividends if the security pays income.",
    potentialRewards,
    keyRisks,
    whatToWatch,
    termFit,
  };
}

function bondAnalysis(security: NormalizedSecurity): AssetAnalysis {
  const dRisk = durationRisk(security.durationBucket);
  const cRisk = creditRisk(security.creditQuality);
  const typeRisk = bondTypeRiskAdjustment(security.bondType);

  const yieldReward =
    security.yieldPct === null
      ? 20
      : security.yieldPct >= 8
        ? 72
        : security.yieldPct >= 5
          ? 58
          : security.yieldPct >= 3
            ? 43
            : security.yieldPct >= 1.5
              ? 30
              : 18;

  const riskScore = clamp(18 + dRisk * 0.45 + cRisk * 0.45 + typeRisk);
  const rewardScore = clamp(30 + yieldReward * 0.55 + cRisk * 0.12);
  const incomeScore = clamp(security.yieldPct === null ? 45 : security.yieldPct * 10 + 28);
  const liquidityScore =
    security.bondType === "Treasury" ? 88 : security.bondType === "Municipal" ? 60 : 68;

  const termFit: TermFit = {
    short: clamp(85 - dRisk * 0.55 - cRisk * 0.2),
    medium: clamp(72 - Math.abs(dRisk - 40) * 0.35 - cRisk * 0.15 + incomeScore * 0.1),
    long: clamp(55 + incomeScore * 0.25 - cRisk * 0.25 - Math.max(0, dRisk - 55) * 0.2),
  };

  const potentialRewards = [
    "Potential income through coupon or yield payments.",
    "Potential portfolio stability compared with higher-volatility equities.",
    "Possible downside protection if high-quality bonds are used during risk-off markets.",
    security.durationBucket === "Long"
      ? "Potential price appreciation if interest rates fall, though long duration also increases rate sensitivity."
      : "Lower rate sensitivity than long-duration bonds if duration is short or intermediate.",
  ];

  const keyRisks = [
    "Interest-rate risk: bond prices may fall when rates rise, especially with longer duration.",
    "Credit risk: lower-quality issuers may default or suffer spread widening.",
    "Inflation risk: fixed income can lose purchasing power if inflation exceeds yield.",
    "Liquidity risk can be higher for individual corporate, municipal, or less frequently traded bonds.",
  ];

  const whatToWatch = [
    "Duration, yield, credit quality, maturity date, call risk, and issuer financial strength.",
    "Interest-rate direction, credit spreads, inflation, and central bank policy.",
    "Whether the bond is being used for capital preservation, income, or total return.",
  ];

  return {
    symbol: security.symbol,
    name: security.name,
    assetType: security.assetType,
    headline:
      riskScore >= 65
        ? "Higher-risk fixed-income profile"
        : riskScore >= 40
          ? "Moderate bond risk profile"
          : "Defensive fixed-income profile",
    riskScore,
    rewardScore,
    incomeScore,
    liquidityScore,
    volatilityRisk: clamp(dRisk * 0.35 + cRisk * 0.25),
    durationRisk: dRisk,
    creditRisk: cRisk,
    rateSensitivity: dRisk,
    timeHorizonFit:
      security.durationBucket === "Ultra Short" || security.durationBucket === "Short"
        ? "Generally better suited for shorter holding periods."
        : security.durationBucket === "Long"
          ? "Better suited for investors who can tolerate rate sensitivity over a longer horizon."
          : "Can fit medium-term income or stability objectives.",
    bestUseCase:
      security.creditQuality === "Treasury / Government" || security.bondType === "Treasury"
        ? "Capital preservation, liquidity, and defensive allocation."
        : security.bondType === "High Yield Corporate"
          ? "Income-seeking allocation with meaningful credit risk."
          : "Income generation and portfolio risk balancing.",
    riskProfile:
      "This investment behaves primarily like fixed income. The main risks are interest-rate changes, duration sensitivity, credit quality, inflation, liquidity, and whether the yield adequately compensates for those risks.",
    rewardProfile:
      "The reward profile is driven mostly by yield, coupon income, potential price movement from rate changes, and credit spread changes.",
    potentialRewards,
    keyRisks,
    whatToWatch,
    termFit,
  };
}

function analyzeSecurity(security: NormalizedSecurity): AssetAnalysis {
  if (security.assetType === "Bond") return bondAnalysis(security);

  return stockAnalysis(security);
}

function selectedTermKey(term: HoldingTerm): keyof TermFit {
  if (term === "Short Term") return "short";
  if (term === "Medium Term") return "medium";
  return "long";
}

function holdingTermDescription(term: HoldingTerm) {
  if (term === "Short Term") {
    return "Short term usually means less than 12 months. Liquidity, downside risk, volatility, and timing risk matter more than long-term upside.";
  }

  if (term === "Medium Term") {
    return "Medium term usually means 1 to 5 years. The decision should balance growth potential, income, valuation risk, and drawdown tolerance.";
  }

  return "Long term usually means 5+ years. Business quality, compounding potential, inflation protection, and long-run risk/reward matter more than short-term volatility.";
}

function objectiveDescription(objective: Objective) {
  if (objective === "Capital Preservation") {
    return "The priority is protecting principal and avoiding large drawdowns.";
  }

  if (objective === "Income") {
    return "The priority is cash flow, yield, and reliability of distributions or coupon payments.";
  }

  if (objective === "Growth") {
    return "The priority is long-term capital appreciation, even if volatility is higher.";
  }

  return "The priority is balancing risk, return, income, and capital appreciation.";
}

function adjustedDecisionScore(
  analysis: AssetAnalysis,
  term: HoldingTerm,
  riskTolerance: RiskTolerance,
  objective: Objective
) {
  const termKey = selectedTermKey(term);
  const tolerance = riskToleranceScore(riskTolerance);

  let score =
    analysis.termFit[termKey] +
    analysis.rewardScore * 0.28 -
    Math.max(0, analysis.riskScore - tolerance) * 0.55 +
    analysis.liquidityScore * 0.08;

  if (objective === "Capital Preservation") {
    score += (100 - analysis.riskScore) * 0.35;
    score += analysis.assetType === "Bond" ? 8 : -6;
  }

  if (objective === "Income") {
    score += analysis.incomeScore * 0.35;
    score += analysis.assetType === "Bond" ? 6 : 0;
  }

  if (objective === "Growth") {
    score += analysis.rewardScore * 0.35;
    score += analysis.assetType === "Stock" || analysis.assetType === "ETF" ? 5 : -5;
  }

  if (objective === "Balanced Growth") {
    score += (analysis.rewardScore - analysis.riskScore * 0.35) * 0.2;
  }

  return score;
}

function compareAnalyses({
  assetA,
  assetB,
  holdingTerm,
  riskTolerance,
  objective,
}: {
  assetA: AssetAnalysis;
  assetB: AssetAnalysis;
  holdingTerm: HoldingTerm;
  riskTolerance: RiskTolerance;
  objective: Objective;
}) {
  const scoreA = adjustedDecisionScore(assetA, holdingTerm, riskTolerance, objective);
  const scoreB = adjustedDecisionScore(assetB, holdingTerm, riskTolerance, objective);

  const preferred = scoreA >= scoreB ? assetA : assetB;
  const alternate = scoreA >= scoreB ? assetB : assetA;

  const shortTermPick =
    adjustedDecisionScore(assetA, "Short Term", riskTolerance, objective) >=
    adjustedDecisionScore(assetB, "Short Term", riskTolerance, objective)
      ? assetA.symbol
      : assetB.symbol;

  const mediumTermPick =
    adjustedDecisionScore(assetA, "Medium Term", riskTolerance, objective) >=
    adjustedDecisionScore(assetB, "Medium Term", riskTolerance, objective)
      ? assetA.symbol
      : assetB.symbol;

  const longTermPick =
    adjustedDecisionScore(assetA, "Long Term", riskTolerance, objective) >=
    adjustedDecisionScore(assetB, "Long Term", riskTolerance, objective)
      ? assetA.symbol
      : assetB.symbol;

  const riskWinner =
    assetA.riskScore <= assetB.riskScore ? assetA.symbol : assetB.symbol;

  const rewardWinner =
    assetA.rewardScore >= assetB.rewardScore ? assetA.symbol : assetB.symbol;

  const incomeWinner =
    assetA.incomeScore >= assetB.incomeScore ? assetA.symbol : assetB.symbol;

  const liquidityWinner =
    assetA.liquidityScore >= assetB.liquidityScore ? assetA.symbol : assetB.symbol;

  return {
    preferredSymbol: preferred.symbol,
    alternateSymbol: alternate.symbol,
    decisionScoreA: Math.round(scoreA),
    decisionScoreB: Math.round(scoreB),
    shortTermPick,
    mediumTermPick,
    longTermPick,
    riskWinner,
    rewardWinner,
    incomeWinner,
    liquidityWinner,
    summary: `${preferred.symbol} appears better aligned with the selected ${holdingTerm.toLowerCase()} holding term, ${riskTolerance.toLowerCase()} risk tolerance, and ${objective.toLowerCase()} objective. ${alternate.symbol} may still be useful depending on portfolio role, diversification need, entry price, and whether the investor wants more income, lower volatility, or higher growth exposure.`,
    termCommentary: holdingTermDescription(holdingTerm),
    objectiveCommentary: objectiveDescription(objective),
    decisionFactors: [
      `Selected holding term: ${holdingTerm}.`,
      `Selected risk tolerance: ${riskTolerance}.`,
      `Selected investment objective: ${objective}.`,
      `${riskWinner} has the lower modeled risk score.`,
      `${rewardWinner} has the higher modeled reward score.`,
      `${incomeWinner} has the stronger income profile.`,
      `${liquidityWinner} has the stronger liquidity profile.`,
    ],
    caveats: [
      "This is a decision-support comparison, not personalized financial advice.",
      "Live pricing, valuation, balance-sheet data, yield-to-maturity, credit spreads, and analyst estimates should be connected before using this for real client recommendations.",
      "The best investment can change if the investor’s time horizon, tax situation, liquidity needs, concentration, or risk tolerance changes.",
    ],
  };
}

export async function POST(request: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized." }, { status: 401 });
  }

  const body = await request.json();

  const assetA = normalizeSecurity(body.assetA ?? {}, "Asset A");
  const assetB = normalizeSecurity(body.assetB ?? {}, "Asset B");

  if (!assetA.symbol || !assetB.symbol) {
    return NextResponse.json(
      { error: "Both investments need a symbol, name, or label." },
      { status: 400 }
    );
  }

  const holdingTerm = isHoldingTerm(body.holdingTerm)
    ? body.holdingTerm
    : "Long Term";

  const riskTolerance = isRiskTolerance(body.riskTolerance)
    ? body.riskTolerance
    : "Moderate";

  const objective = isObjective(body.objective)
    ? body.objective
    : "Balanced Growth";

  const analysisA = analyzeSecurity(assetA);
  const analysisB = analyzeSecurity(assetB);

  const comparison = compareAnalyses({
    assetA: analysisA,
    assetB: analysisB,
    holdingTerm,
    riskTolerance,
    objective,
  });

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    holdingTerm,
    riskTolerance,
    objective,
    inputs: {
      assetA,
      assetB,
    },
    analyses: {
      assetA: analysisA,
      assetB: analysisB,
    },
    comparison,
    dataMode:
      "Heuristic model using user-entered fields. Connect live market data later for real-time prices, volatility, yields, valuation, credit, and fundamentals.",
  });
}