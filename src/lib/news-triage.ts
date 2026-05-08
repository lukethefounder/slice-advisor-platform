import { createHash } from "crypto";

export type RawHeadline = {
  sourceId: string;
  sourceName: string;
  sourceTier:
    | "official-regulatory"
    | "official-exchange"
    | "macro-source"
    | "market-news"
    | "crypto-source"
    | "venture-source"
    | "unknown";
  title: string;
  summary?: string;
  url?: string;
  publishedAt?: string;
};

export type TriageProfile = {
  watchTickers: string[];
  namedWatchlistTickers: string[];
  namedWatchlistNames: string[];
  companyNames: string[];
  clientHoldingTickers: string[];
  portfolioHoldingTickers: string[];
  ventureSectors: string[];
  researchTickers: string[];
  goalThemes: string[];
};

export type TriageDecision = {
  dedupeKey: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceTier: string;
  url: string | null;
  category: string;
  subcategory: string;
  importanceTier:
    | "URGENT_PORTFOLIO_ALERT"
    | "ADVISOR_REVIEW"
    | "INVESTOR_DIGEST"
    | "WATCH_ONLY"
    | "SUPPRESSED";
  action:
    | "CREATE_ALERT"
    | "QUEUE_ADVISOR_REVIEW"
    | "ADD_TO_DIGEST"
    | "STORE_SHORT_TERM"
    | "DISCARD";
  urgency: "Critical" | "High" | "Medium" | "Low" | "Suppressed";
  score: number;
  materialityScore: number;
  relevanceScore: number;
  trustScore: number;
  matchedTickers: string[];
  matchedAreas: string[];
  reasons: string[];
  channels: string[];
  shouldPersist: boolean;
  shouldAlert: boolean;
  retentionDays: number;
};

type Rule = {
  category: string;
  subcategory: string;
  weight: number;
  terms: string[];
};

export const MAX_HEADLINES_PER_RUN = 120;
export const MAX_RETAINED_PER_RUN = 40;
export const MAX_TOTAL_RETAINED_PER_USER = 600;

const MATERIALITY_RULES: Rule[] = [
  {
    category: "Regulatory / Legal",
    subcategory: "SEC enforcement or investigation",
    weight: 42,
    terms: [
      "sec charges",
      "charged by the sec",
      "enforcement action",
      "fraud",
      "settlement",
      "investigation",
      "subpoena",
      "market manipulation",
      "accounting fraud",
    ],
  },
  {
    category: "Regulatory / Legal",
    subcategory: "Trading halt or suspension",
    weight: 46,
    terms: [
      "trading halt",
      "halted",
      "suspended trading",
      "trading suspension",
      "delisting",
      "delist",
      "nasdaq halt",
    ],
  },
  {
    category: "SEC Filings",
    subcategory: "Material filing",
    weight: 40,
    terms: [
      "form 8-k",
      "8-k",
      "10-k",
      "10-q",
      "s-1",
      "13d",
      "13g",
      "form 4",
      "restatement",
      "material weakness",
      "going concern",
    ],
  },
  {
    category: "Earnings / Guidance",
    subcategory: "Guidance revision",
    weight: 36,
    terms: [
      "raises guidance",
      "cuts guidance",
      "lowers guidance",
      "withdraws guidance",
      "profit warning",
      "revenue warning",
      "misses estimates",
      "beats estimates",
    ],
  },
  {
    category: "Earnings / Guidance",
    subcategory: "Earnings release",
    weight: 28,
    terms: [
      "earnings",
      "quarterly results",
      "revenue",
      "eps",
      "gross margin",
      "operating margin",
      "free cash flow",
    ],
  },
  {
    category: "Corporate Actions",
    subcategory: "M&A / strategic transaction",
    weight: 38,
    terms: [
      "merger",
      "acquisition",
      "takeover",
      "buyout",
      "tender offer",
      "strategic review",
      "spin-off",
      "divestiture",
    ],
  },
  {
    category: "Corporate Actions",
    subcategory: "Capital allocation",
    weight: 26,
    terms: [
      "share repurchase",
      "buyback",
      "dividend increase",
      "special dividend",
      "secondary offering",
      "stock offering",
      "debt offering",
    ],
  },
  {
    category: "Balance Sheet / Credit",
    subcategory: "Distress or financing pressure",
    weight: 40,
    terms: [
      "bankruptcy",
      "chapter 11",
      "default",
      "debt restructuring",
      "credit facility",
      "liquidity concern",
      "covenant",
    ],
  },
  {
    category: "Leadership / Governance",
    subcategory: "Executive change",
    weight: 22,
    terms: [
      "ceo resigns",
      "cfo resigns",
      "chief executive resigns",
      "chief financial officer resigns",
      "board change",
      "activist investor",
    ],
  },
  {
    category: "Product / Technology",
    subcategory: "AI or product catalyst",
    weight: 20,
    terms: [
      "artificial intelligence",
      " ai ",
      "chip",
      "semiconductor",
      "data center",
      "cloud",
      "cybersecurity",
      "product launch",
      "partnership",
    ],
  },
  {
    category: "Macro / Rates",
    subcategory: "Interest rates and inflation",
    weight: 26,
    terms: [
      "federal reserve",
      "fed",
      "interest rate",
      "rates",
      "inflation",
      "cpi",
      "ppi",
      "treasury yield",
      "yield spike",
      "jobs report",
      "unemployment",
    ],
  },
  {
    category: "Bonds / Credit Markets",
    subcategory: "Duration and spread risk",
    weight: 24,
    terms: [
      "duration",
      "credit spread",
      "investment grade",
      "high yield",
      "treasury",
      "bond yields",
      "yield curve",
      "default risk",
    ],
  },
  {
    category: "Crypto / Digital Assets",
    subcategory: "Regulatory or protocol event",
    weight: 30,
    terms: [
      "bitcoin",
      "ethereum",
      "crypto",
      "stablecoin",
      "sec crypto",
      "etf inflows",
      "hack",
      "exploit",
      "protocol outage",
      "token",
    ],
  },
  {
    category: "Private Markets / Venture",
    subcategory: "Startup funding or private exposure",
    weight: 18,
    terms: [
      "venture capital",
      "startup",
      "seed round",
      "series a",
      "series b",
      "private company",
      "founder",
      "funding round",
    ],
  },
  {
    category: "Geopolitical / Supply Chain",
    subcategory: "Global disruption",
    weight: 24,
    terms: [
      "sanctions",
      "tariff",
      "export controls",
      "supply chain",
      "shipping disruption",
      "geopolitical",
      "war",
      "conflict",
    ],
  },
  {
    category: "Consumer / Demand",
    subcategory: "Demand trend",
    weight: 16,
    terms: [
      "consumer demand",
      "same-store sales",
      "supplier demand",
      "retail sales",
      "pricing power",
      "weak demand",
    ],
  },
];

const NOISE_TERMS = [
  "sponsored",
  "advertisement",
  "affiliate",
  "promo",
  "click here",
  "top 10 stocks",
  "millionaire maker",
  "guaranteed",
  "can't miss",
  "you won't believe",
  "rumor",
];

const DEMO_HEADLINES: RawHeadline[] = [
  {
    sourceId: "demo-sec",
    sourceName: "Demo SEC Filing Feed",
    sourceTier: "official-regulatory",
    title: "NVDA Form 8-K announces material AI infrastructure agreement",
    summary:
      "A material filing references a strategic AI infrastructure agreement and updated data center commitments.",
    publishedAt: new Date().toISOString(),
  },
  {
    sourceId: "demo-exchange",
    sourceName: "Demo Exchange Halt Feed",
    sourceTier: "official-exchange",
    title: "Trading halt issued for small-cap issuer pending news",
    summary:
      "An exchange halt was issued pending additional company information.",
    publishedAt: new Date().toISOString(),
  },
  {
    sourceId: "demo-market",
    sourceName: "Demo Market News",
    sourceTier: "market-news",
    title: "Apple supplier demand report suggests stronger hardware cycle",
    summary:
      "Supplier demand and services strength are being cited as positive catalysts for Apple.",
    publishedAt: new Date().toISOString(),
  },
  {
    sourceId: "demo-macro",
    sourceName: "Demo Macro Feed",
    sourceTier: "macro-source",
    title: "Treasury yield spike pressures long duration bond exposure",
    summary:
      "Rate movement may affect portfolios with elevated duration or bond ETF exposure.",
    publishedAt: new Date().toISOString(),
  },
  {
    sourceId: "demo-earnings",
    sourceName: "Demo Earnings Feed",
    sourceTier: "market-news",
    title: "Microsoft beats estimates but cloud margin commentary is mixed",
    summary:
      "Earnings beat expectations, but operating margin commentary requires review.",
    publishedAt: new Date().toISOString(),
  },
  {
    sourceId: "demo-crypto",
    sourceName: "Demo Crypto Feed",
    sourceTier: "crypto-source",
    title: "Bitcoin ETF inflows rise as crypto volatility remains elevated",
    summary:
      "Digital asset exposure remains high-risk but institutional interest continues to rise.",
    publishedAt: new Date().toISOString(),
  },
  {
    sourceId: "demo-venture",
    sourceName: "Demo Venture Feed",
    sourceTier: "venture-source",
    title: "AI startup seed round shows investor interest in workflow automation",
    summary:
      "Private market capital continues to move toward AI workflow tools and automation infrastructure.",
    publishedAt: new Date().toISOString(),
  },
  {
    sourceId: "demo-noise",
    sourceName: "Demo Noisy Feed",
    sourceTier: "unknown",
    title: "Sponsored: Top 10 millionaire maker stocks you cannot miss",
    summary:
      "Promotional article with exaggerated language and low trust value.",
    publishedAt: new Date().toISOString(),
  },
];

export function demoHeadlineBatch() {
  return DEMO_HEADLINES.slice(0, MAX_HEADLINES_PER_RUN);
}

function normalize(value: string) {
  return ` ${value
    .toLowerCase()
    .replace(/[^a-z0-9$ ]/g, " ")
    .replace(/\s+/g, " ")} `;
}

function hash(value: string) {
  return createHash("sha256").update(value).digest("hex").slice(0, 40);
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function includesTicker(text: string, ticker: string) {
  const escaped = ticker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(`(^|[^A-Z0-9])\\$?${escaped}([^A-Z0-9]|$)`, "i");
  return regex.test(text);
}

function uniqueSymbols(symbols: string[]) {
  return Array.from(
    new Set(
      symbols
        .map((symbol) => symbol.trim().replace(/^\$/, "").toUpperCase())
        .filter(Boolean)
    )
  );
}

function sourceTrustScore(sourceTier: RawHeadline["sourceTier"]) {
  if (sourceTier === "official-regulatory") return 30;
  if (sourceTier === "official-exchange") return 28;
  if (sourceTier === "macro-source") return 22;
  if (sourceTier === "market-news") return 18;
  if (sourceTier === "crypto-source") return 14;
  if (sourceTier === "venture-source") return 12;
  return 5;
}

function recencyScore(publishedAt?: string) {
  if (!publishedAt) return 6;

  const parsed = Date.parse(publishedAt);
  if (Number.isNaN(parsed)) return 6;

  const minutesOld = Math.max(0, (Date.now() - parsed) / 1000 / 60);

  if (minutesOld <= 15) return 18;
  if (minutesOld <= 60) return 14;
  if (minutesOld <= 360) return 8;
  if (minutesOld <= 1440) return 3;

  return 0;
}

export function triageHeadline(
  raw: RawHeadline,
  profile: TriageProfile
): TriageDecision {
  const text = `${raw.title} ${raw.summary ?? ""}`;
  const normalized = normalize(text);

  const reasons: string[] = [];
  const matchedTickers = new Set<string>();
  const matchedAreas = new Set<string>();

  const trustScore = sourceTrustScore(raw.sourceTier);
  const recentScore = recencyScore(raw.publishedAt);

  let materialityScore = 0;
  let relevanceScore = 0;
  let noisePenalty = 0;

  let category = "General Market";
  let subcategory = "General update";

  reasons.push(`Source trust score: ${trustScore}.`);

  if (recentScore > 0) {
    reasons.push(`Recency score: ${recentScore}.`);
  }

  for (const ticker of uniqueSymbols(profile.portfolioHoldingTickers)) {
    if (includesTicker(text, ticker)) {
      matchedTickers.add(ticker);
      relevanceScore += 52;
      reasons.push(
        `Highest emphasis: direct portfolio holding match (${ticker}).`
      );
    }
  }

  for (const ticker of uniqueSymbols(profile.clientHoldingTickers)) {
    if (includesTicker(text, ticker)) {
      matchedTickers.add(ticker);
      relevanceScore += 46;
      reasons.push(`Client holding match: ${ticker}.`);
    }
  }

  for (const ticker of uniqueSymbols(profile.namedWatchlistTickers)) {
    if (includesTicker(text, ticker)) {
      matchedTickers.add(ticker);
      relevanceScore += 42;
      reasons.push(`Named watchlist emphasis match: ${ticker}.`);
    }
  }

  for (const ticker of uniqueSymbols(profile.watchTickers)) {
    if (includesTicker(text, ticker)) {
      matchedTickers.add(ticker);
      relevanceScore += 30;
      reasons.push(`General watchlist ticker match: ${ticker}.`);
    }
  }

  for (const ticker of uniqueSymbols(profile.researchTickers)) {
    if (includesTicker(text, ticker)) {
      matchedTickers.add(ticker);
      relevanceScore += 20;
      reasons.push(`Research ticker match: ${ticker}.`);
    }
  }

  for (const name of profile.companyNames) {
    if (name.length > 2 && normalized.includes(normalize(name))) {
      relevanceScore += 20;
      reasons.push(`Company name match: ${name}.`);
    }
  }

  for (const listName of profile.namedWatchlistNames) {
    if (listName.length > 2 && normalized.includes(normalize(listName))) {
      relevanceScore += 12;
      matchedAreas.add(`Watchlist theme: ${listName}`);
      reasons.push(`Named watchlist theme match: ${listName}.`);
    }
  }

  for (const area of [...profile.ventureSectors, ...profile.goalThemes]) {
    if (area.length > 2 && normalized.includes(normalize(area))) {
      matchedAreas.add(area);
      relevanceScore += 8;
      reasons.push(`User area/theme match: ${area}.`);
    }
  }

  for (const rule of MATERIALITY_RULES) {
    const matched = rule.terms.some((term) =>
      normalized.includes(normalize(term))
    );

    if (matched) {
      materialityScore += rule.weight;
      matchedAreas.add(rule.category);
      reasons.push(`${rule.category}: ${rule.subcategory}.`);

      if (rule.weight > materialityScore || category === "General Market") {
        category = rule.category;
        subcategory = rule.subcategory;
      }
    }
  }

  for (const term of NOISE_TERMS) {
    if (normalized.includes(normalize(term))) {
      noisePenalty += 35;
      reasons.push(`Noise penalty: ${term}.`);
    }
  }

  relevanceScore = clamp(relevanceScore, 0, 100);
  materialityScore = clamp(materialityScore, 0, 100);

  const hasPortfolioMatch = uniqueSymbols(profile.portfolioHoldingTickers).some(
    (ticker) => includesTicker(text, ticker)
  );

  const hasNamedWatchlistMatch = uniqueSymbols(profile.namedWatchlistTickers).some(
    (ticker) => includesTicker(text, ticker)
  );

  const extraEmphasisBoost = hasPortfolioMatch
    ? 10
    : hasNamedWatchlistMatch
      ? 7
      : 0;

  if (hasPortfolioMatch) {
    reasons.push("Portfolio holding boost applied to final score.");
  }

  if (hasNamedWatchlistMatch) {
    reasons.push("Named watchlist boost applied to final score.");
  }

  const rawScore =
    trustScore +
    recentScore +
    relevanceScore +
    materialityScore +
    extraEmphasisBoost -
    noisePenalty;

  const score = clamp(rawScore, 0, 100);

  let urgency: TriageDecision["urgency"] = "Low";
  let importanceTier: TriageDecision["importanceTier"] = "WATCH_ONLY";
  let action: TriageDecision["action"] = "STORE_SHORT_TERM";
  let channels: string[] = [];
  let retentionDays = 7;

  const exactPortfolioMatch = matchedTickers.size > 0;
  const majorMaterialEvent = materialityScore >= 55;
  const trustedCriticalSource =
    raw.sourceTier === "official-regulatory" ||
    raw.sourceTier === "official-exchange";

  if (
    score >= 88 &&
    (exactPortfolioMatch || majorMaterialEvent || trustedCriticalSource)
  ) {
    urgency = "Critical";
    importanceTier = "URGENT_PORTFOLIO_ALERT";
    action = "CREATE_ALERT";
    channels = ["Dashboard", "Email", "SMS"];
    retentionDays = 45;
  } else if (score >= 74 && (exactPortfolioMatch || materialityScore >= 40)) {
    urgency = "High";
    importanceTier = "ADVISOR_REVIEW";
    action = "QUEUE_ADVISOR_REVIEW";
    channels = ["Dashboard", "Email"];
    retentionDays = 30;
  } else if (score >= 55) {
    urgency = "Medium";
    importanceTier = "INVESTOR_DIGEST";
    action = "ADD_TO_DIGEST";
    channels = ["Dashboard Digest"];
    retentionDays = 14;
  } else if (score >= 35) {
    urgency = "Low";
    importanceTier = "WATCH_ONLY";
    action = "STORE_SHORT_TERM";
    channels = [];
    retentionDays = 5;
  } else {
    urgency = "Suppressed";
    importanceTier = "SUPPRESSED";
    action = "DISCARD";
    channels = [];
    retentionDays = 0;
  }

  const shouldAlert = action === "CREATE_ALERT";
  const shouldPersist =
    action !== "DISCARD" &&
    (score >= 55 ||
      exactPortfolioMatch ||
      materialityScore >= 40 ||
      hasNamedWatchlistMatch ||
      hasPortfolioMatch);

  const summary = (raw.summary ?? "").slice(0, 700);
  const dedupeKey = hash(`${raw.sourceId}:${raw.title}:${raw.url ?? ""}`);

  return {
    dedupeKey,
    title: raw.title.slice(0, 300),
    summary,
    sourceName: raw.sourceName,
    sourceTier: raw.sourceTier,
    url: raw.url ?? null,
    category,
    subcategory,
    importanceTier,
    action,
    urgency,
    score,
    materialityScore,
    relevanceScore,
    trustScore,
    matchedTickers: Array.from(matchedTickers),
    matchedAreas: Array.from(matchedAreas).slice(0, 8),
    reasons: Array.from(new Set(reasons)).slice(0, 12),
    channels,
    shouldPersist,
    shouldAlert,
    retentionDays,
  };
}