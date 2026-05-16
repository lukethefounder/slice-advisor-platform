import type { TriageDecision, TriageProfile } from "@/lib/news-triage";

export type ScanMode = "fast" | "broad" | "deep";

export type InvestmentGrade =
  | "A+"
  | "A"
  | "A-"
  | "B+"
  | "B"
  | "B-"
  | "C+"
  | "C"
  | "Watch"
  | "Suppress";

export type InvestmentGradeResult = {
  grade: InvestmentGrade;
  finalScore: number;
  baseScore: number;
  urgency: "Critical" | "High" | "Medium" | "Low";
  emailEligible: boolean;
  action:
    | "SEND_ADVISOR_EMAIL"
    | "CREATE_DASHBOARD_ALERT"
    | "QUEUE_REVIEW"
    | "ADD_TO_DIGEST"
    | "STORE_ONLY"
    | "SUPPRESS";
  confidenceScore: number;
  factorScores: {
    sourceTrust: number;
    uSMarketRelevance: number;
    advisorCriteriaFit: number;
    catalystStrength: number;
    portfolioExposureFit: number;
    macroSensitivity: number;
    immediacy: number;
    riskPenalty: number;
    noisePenalty: number;
  };
  reasons: string[];
  risks: string[];
  nextActions: string[];
};

type GradeInput = {
  decision: TriageDecision;
  profile: TriageProfile;
  scanMode?: ScanMode;
  alertFloor?: number;
};

const POSITIVE_CATALYSTS = [
  "raises guidance",
  "beats estimates",
  "earnings beat",
  "margin expansion",
  "free cash flow",
  "new contract",
  "contract award",
  "strategic partnership",
  "share repurchase",
  "buyback",
  "special dividend",
  "fda approval",
  "merger",
  "acquisition",
  "spin-off",
  "activist investor",
  "upgrade",
  "price target raised",
  "ai demand",
  "data center",
  "semiconductor",
  "cloud growth",
  "defense contract",
  "infrastructure spending",
  "rate cut",
  "disinflation",
  "soft landing",
  "record revenue",
  "record backlog",
];

const MATERIAL_RISK_CATALYSTS = [
  "sec charges",
  "fraud",
  "investigation",
  "trading halt",
  "halted",
  "delisting",
  "bankruptcy",
  "chapter 11",
  "default",
  "cuts guidance",
  "lowers guidance",
  "profit warning",
  "misses estimates",
  "material weakness",
  "going concern",
  "downgrade",
  "lawsuit",
  "recall",
  "data breach",
  "cyberattack",
  "liquidity concern",
  "covenant",
];

const US_MARKET_TERMS = [
  "u.s.",
  "us ",
  "united states",
  "nasdaq",
  "nyse",
  "sec",
  "federal reserve",
  "fed",
  "treasury",
  "s&p",
  "s&p 500",
  "dow",
  "russell",
  "cpi",
  "ppi",
  "jobs report",
  "nonfarm payrolls",
  "yield",
  "mortgage rates",
  "earnings",
  "guidance",
  "etf",
  "stock",
  "shares",
];

const NOISE_TERMS = [
  "sponsored",
  "advertisement",
  "promo",
  "click here",
  "price prediction",
  "could explode",
  "moon",
  "guaranteed",
  "hot pick",
  "rumor",
  "unconfirmed",
];

function clamp(value: number, min = 0, max = 100) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function lowerText(decision: TriageDecision) {
  return [
    decision.title,
    decision.summary,
    decision.sourceName,
    decision.sourceTier,
    decision.category,
    decision.subcategory,
    decision.matchedTickers.join(" "),
    decision.matchedAreas.join(" "),
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
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

function countMatches(text: string, terms: string[]) {
  return terms.filter((term) => text.includes(term)).length;
}

function catalystScore(text: string) {
  const positiveMatches = countMatches(text, POSITIVE_CATALYSTS);
  const riskMatches = countMatches(text, MATERIAL_RISK_CATALYSTS);

  return clamp(35 + positiveMatches * 11 + riskMatches * 12);
}

function riskPenalty(text: string) {
  const matches = countMatches(text, MATERIAL_RISK_CATALYSTS);
  return clamp(matches * 8, 0, 35);
}

function noisePenalty(text: string) {
  const matches = countMatches(text, NOISE_TERMS);
  return clamp(matches * 14, 0, 45);
}

function usMarketRelevanceScore(text: string, decision: TriageDecision) {
  const termScore = countMatches(text, US_MARKET_TERMS) * 8;
  const tickerScore = decision.matchedTickers.length ? 24 : 0;
  const sourceScore =
    decision.sourceTier === "official-regulatory" ||
    decision.sourceTier === "official-exchange" ||
    decision.sourceTier === "macro-source"
      ? 20
      : 0;

  return clamp(35 + termScore + tickerScore + sourceScore);
}

function advisorCriteriaFit(decision: TriageDecision, profile: TriageProfile) {
  const matched = new Set(decision.matchedTickers.map((ticker) => ticker.toUpperCase()));

  const watchMatches = profile.watchTickers.filter((ticker) => matched.has(ticker)).length;
  const namedMatches = profile.namedWatchlistTickers.filter((ticker) => matched.has(ticker)).length;
  const clientMatches = profile.clientHoldingTickers.filter((ticker) => matched.has(ticker)).length;
  const portfolioMatches = profile.portfolioHoldingTickers.filter((ticker) => matched.has(ticker)).length;
  const researchMatches = profile.researchTickers.filter((ticker) => matched.has(ticker)).length;

  const themeText = decision.matchedAreas.join(" ").toLowerCase();
  const goalMatches = profile.goalThemes.filter((goal) =>
    themeText.includes(String(goal).toLowerCase())
  ).length;

  return clamp(
    25 +
      watchMatches * 10 +
      namedMatches * 14 +
      clientMatches * 18 +
      portfolioMatches * 16 +
      researchMatches * 12 +
      goalMatches * 6
  );
}

function portfolioExposureFit(decision: TriageDecision, profile: TriageProfile) {
  const matched = new Set(decision.matchedTickers.map((ticker) => ticker.toUpperCase()));

  const clientExposure = profile.clientHoldingTickers.filter((ticker) => matched.has(ticker)).length;
  const portfolioExposure = profile.portfolioHoldingTickers.filter((ticker) => matched.has(ticker)).length;

  return clamp(20 + clientExposure * 24 + portfolioExposure * 20);
}

function macroSensitivity(text: string) {
  const macroTerms = [
    "federal reserve",
    "fed",
    "rate",
    "interest",
    "inflation",
    "cpi",
    "ppi",
    "jobs",
    "unemployment",
    "treasury",
    "yield",
    "gdp",
    "consumer spending",
    "oil",
    "energy",
    "dollar",
  ];

  return clamp(30 + countMatches(text, macroTerms) * 10);
}

function immediacyScore(decision: TriageDecision, scanMode: ScanMode) {
  let score = decision.score;

  if (decision.urgency === "Critical") score += 16;
  if (decision.urgency === "High") score += 10;
  if (decision.importanceTier === "URGENT_PORTFOLIO_ALERT") score += 14;
  if (decision.action === "CREATE_ALERT") score += 10;
  if (scanMode === "fast") score += 6;
  if (scanMode === "deep") score -= 2;

  return clamp(score);
}

function gradeFromScore(score: number, confidence: number, noise: number): InvestmentGrade {
  if (noise >= 35) return "Suppress";
  if (score >= 96 && confidence >= 82) return "A+";
  if (score >= 91 && confidence >= 74) return "A";
  if (score >= 87 && confidence >= 68) return "A-";
  if (score >= 82) return "B+";
  if (score >= 76) return "B";
  if (score >= 70) return "B-";
  if (score >= 64) return "C+";
  if (score >= 58) return "C";
  return "Watch";
}

function actionFromGrade(grade: InvestmentGrade, score: number, emailEligible: boolean): InvestmentGradeResult["action"] {
  if (grade === "Suppress") return "SUPPRESS";
  if (emailEligible) return "SEND_ADVISOR_EMAIL";
  if (score >= 82) return "CREATE_DASHBOARD_ALERT";
  if (score >= 72) return "QUEUE_REVIEW";
  if (score >= 64) return "ADD_TO_DIGEST";
  return "STORE_ONLY";
}

function urgencyFromScore(score: number): InvestmentGradeResult["urgency"] {
  if (score >= 92) return "Critical";
  if (score >= 82) return "High";
  if (score >= 68) return "Medium";
  return "Low";
}

export function gradeInvestmentSignal(input: GradeInput): InvestmentGradeResult {
  const scanMode = input.scanMode ?? "broad";
  const decision = input.decision;
  const text = lowerText(decision);

  const sourceTrust = sourceTrustScore(decision.sourceTier);
  const uSMarketRelevance = usMarketRelevanceScore(text, decision);
  const criteriaFit = advisorCriteriaFit(decision, input.profile);
  const exposureFit = portfolioExposureFit(decision, input.profile);
  const catalyst = catalystScore(text);
  const macro = macroSensitivity(text);
  const immediacy = immediacyScore(decision, scanMode);
  const risk = riskPenalty(text);
  const noise = noisePenalty(text);

  const baseScore =
    decision.score * 0.22 +
    sourceTrust * 0.16 +
    uSMarketRelevance * 0.12 +
    criteriaFit * 0.17 +
    exposureFit * 0.13 +
    catalyst * 0.11 +
    macro * 0.04 +
    immediacy * 0.05;

  const scanModeAdjustment =
    scanMode === "fast" ? 2 : scanMode === "deep" ? 4 : 0;

  const finalScore = clamp(baseScore + scanModeAdjustment - risk * 0.28 - noise * 0.72);
  const confidenceScore = clamp(sourceTrust * 0.42 + decision.trustScore * 0.24 + criteriaFit * 0.18 + uSMarketRelevance * 0.16);
  const grade = gradeFromScore(finalScore, confidenceScore, noise);
  const urgency = urgencyFromScore(finalScore);

  const alertFloor = input.alertFloor ?? 86;

  const emailEligible =
    grade !== "Suppress" &&
    finalScore >= alertFloor &&
    confidenceScore >= 62 &&
    sourceTrust >= 58 &&
    noise < 28 &&
    (criteriaFit >= 55 || exposureFit >= 55 || finalScore >= 92);

  const reasons = [
    `Final institutional grade score: ${finalScore}/100.`,
    `Source trust score: ${sourceTrust}/100.`,
    `U.S. market relevance score: ${uSMarketRelevance}/100.`,
    `Advisor criteria fit: ${criteriaFit}/100.`,
    `Portfolio/client exposure fit: ${exposureFit}/100.`,
    `Catalyst strength: ${catalyst}/100.`,
    `Confidence score: ${confidenceScore}/100.`,
  ];

  if (decision.matchedTickers.length) {
    reasons.push(`Matched ticker(s): ${decision.matchedTickers.join(", ")}.`);
  }

  if (decision.matchedAreas.length) {
    reasons.push(`Matched advisor criteria/theme(s): ${decision.matchedAreas.join(", ")}.`);
  }

  if (scanMode === "fast") {
    reasons.push("Fast scan mode prioritised immediacy and urgent advisor review.");
  }

  if (scanMode === "deep") {
    reasons.push("Deep scan mode broadened retention for further research and context.");
  }

  const risks: string[] = [];

  if (risk > 0) {
    risks.push(`Material risk catalyst penalty detected: ${risk}/100.`);
  }

  if (noise > 0) {
    risks.push(`Noise/promotional language penalty detected: ${noise}/100.`);
  }

  if (sourceTrust < 65) {
    risks.push("Source trust is below institutional-quality threshold. Verify before relying on this item.");
  }

  if (confidenceScore < 65) {
    risks.push("Confidence score is moderate. Advisor verification is recommended before action.");
  }

  const nextActions = [
    "Open and verify the original source.",
    "Check current price action and volume.",
    "Compare against client holdings and concentration exposure.",
    "Review tax, liquidity, and suitability before any recommendation.",
  ];

  if (emailEligible) {
    nextActions.unshift("Send advisor-facing research alert immediately.");
  } else if (finalScore >= 82) {
    nextActions.unshift("Create dashboard alert and queue advisor review.");
  } else {
    nextActions.unshift("Store for digest or watchlist context.");
  }

  return {
    grade,
    finalScore,
    baseScore: clamp(decision.score),
    urgency,
    emailEligible,
    action: actionFromGrade(grade, finalScore, emailEligible),
    confidenceScore,
    factorScores: {
      sourceTrust,
      uSMarketRelevance,
      advisorCriteriaFit: criteriaFit,
      catalystStrength: catalyst,
      portfolioExposureFit: exposureFit,
      macroSensitivity: macro,
      immediacy,
      riskPenalty: risk,
      noisePenalty: noise,
    },
    reasons,
    risks,
    nextActions,
  };
}

export function buildInstitutionalResearchMemo(input: {
  decision: TriageDecision;
  grade: InvestmentGradeResult;
}) {
  const { decision, grade } = input;

  const source = decision.url
    ? `${decision.sourceName} — ${decision.url}`
    : decision.sourceName;

  const matchedTickers = decision.matchedTickers.length
    ? decision.matchedTickers.join(", ")
    : "None";

  const matchedAreas = decision.matchedAreas.length
    ? decision.matchedAreas.join(", ")
    : "None";

  return [
    `Investment Grade: ${grade.grade}`,
    `Final Score: ${grade.finalScore}/100`,
    `Urgency: ${grade.urgency}`,
    `Recommended Action: ${grade.action}`,
    "",
    `Headline: ${decision.title}`,
    `Source: ${source}`,
    `Category: ${decision.category} / ${decision.subcategory}`,
    "",
    "Why this matters:",
    ...grade.reasons.map((reason) => `- ${reason}`),
    "",
    "Matched criteria:",
    `- Tickers: ${matchedTickers}`,
    `- Themes: ${matchedAreas}`,
    "",
    "Risk checks:",
    ...(grade.risks.length ? grade.risks.map((risk) => `- ${risk}`) : ["- No major grading penalties were detected."]),
    "",
    "Advisor next steps:",
    ...grade.nextActions.map((action) => `- ${action}`),
    "",
    "Compliance note:",
    "This alert is for advisor research review only. It is not a client-specific recommendation, trade instruction, or guarantee of investment outcome.",
  ].join("\n");
}