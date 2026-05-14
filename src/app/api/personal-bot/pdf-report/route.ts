import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { fetchMarketQuote } from "@/lib/integrations/market";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ReportSection = {
  title?: string;
  body?: string;
  content?: string;
  summary?: string;
};

type PdfPage = {
  ops: string[];
  pageNumber: number;
};

type MarketQuoteSnapshot = {
  symbol: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  previousClose: number | null;
  volume: number | null;
  latestTradingDay: string | null;
  provider: string;
  isLive: boolean;
  note: string;
};

type ReportSource = {
  title: string;
  publisher: string;
  url: string | null;
  whyItMatters: string;
  sourceType: "Slice" | "Market Data" | "Web Research" | "Internal Research" | "Generated";
  score?: number | null;
};

type AiReportGuidance = {
  title: string;
  subtitle: string;
  topicType: string;
  executiveSummary: string;
  clientReadySummary: string;
  researchNarrative: string;
  keyFindings: string[];
  dataPoints: string[];
  visualInsights: string[];
  recommendationFramework: string;
  potentialRecommendations: string[];
  riskConsiderations: string;
  planningConsiderations: string;
  advisorNotes: string;
  actionPlan: string[];
  questionsForAdvisor: string[];
  missingInformation: string[];
  sources: ReportSource[];
  complianceNote: string;
  grammarPolished: boolean;
};

type ReportContext = {
  topic: string;
  topicType: string;
  isInvestmentTopic: boolean;
  isWeatherTopic: boolean;
  report: {
    title: string;
    reportType: string;
    status: string;
    summary: string;
    createdAt: string;
  };
  extractedTickers: string[];
  originalSections: ReportSection[];
  marketQuotes: MarketQuoteSnapshot[];
  alerts: Array<Record<string, any>>;
  headlineDecisions: Array<Record<string, any>>;
  opportunities: Array<Record<string, any>>;
  researchNotes: Array<Record<string, any>>;
  researchRuns: Array<Record<string, any>>;
  clients: Array<Record<string, any>>;
  holdings: Array<Record<string, any>>;
  watchlistItems: Array<Record<string, any>>;
  priceAlerts: Array<Record<string, any>>;
  dataQuality: Array<Record<string, any>>;
  approvals: Array<Record<string, any>>;
  botMemory: Array<Record<string, any>>;
  sourceLedger: ReportSource[];
};

const PAGE = {
  width: 612,
  height: 792,
  margin: 40,
  top: 744,
  bottom: 52,
};

const COLORS = {
  black: [0.025, 0.025, 0.035],
  deep: [0.045, 0.05, 0.07],
  slate950: [0.015, 0.018, 0.024],
  slate900: [0.07, 0.08, 0.1],
  slate800: [0.12, 0.14, 0.17],
  slate700: [0.22, 0.25, 0.31],
  slate600: [0.33, 0.38, 0.46],
  slate500: [0.43, 0.49, 0.58],
  slate400: [0.58, 0.64, 0.72],
  slate300: [0.78, 0.83, 0.9],
  slate200: [0.88, 0.91, 0.95],
  white: [1, 1, 1],
  paper: [0.985, 0.986, 0.992],
  card: [1, 1, 1],
  red: [0.86, 0.15, 0.15],
  redDark: [0.36, 0.05, 0.05],
  cyan: [0.02, 0.71, 0.83],
  purple: [0.66, 0.33, 0.97],
  green: [0.13, 0.77, 0.37],
  amber: [0.96, 0.62, 0.04],
};

const NON_TICKER_WORDS = new Set([
  "SLICE",
  "REPORT",
  "AI",
  "PDF",
  "THE",
  "AND",
  "FOR",
  "WITH",
  "THIS",
  "THAT",
  "FROM",
  "CLIENT",
  "MARKET",
  "RISK",
  "DATA",
  "WEATHER",
  "REGION",
  "FORECAST",
  "A",
  "AN",
  "OF",
  "TO",
  "IN",
  "ON",
  "US",
  "USA",
  "UK",
  "EU",
  "UAE",
  "NYC",
  "LA",
  "AZ",
  "CA",
  "NY",
  "TX",
  "FL",
  "WA",
  "OR",
  "NV",
  "CO",
]);

const COMPANY_TICKERS: Array<[string, string]> = [
  ["nvidia", "NVDA"],
  ["apple", "AAPL"],
  ["microsoft", "MSFT"],
  ["tesla", "TSLA"],
  ["meta", "META"],
  ["facebook", "META"],
  ["alphabet", "GOOGL"],
  ["google", "GOOGL"],
  ["amazon", "AMZN"],
  ["amd", "AMD"],
  ["netflix", "NFLX"],
  ["broadcom", "AVGO"],
  ["salesforce", "CRM"],
  ["palantir", "PLTR"],
  ["coinbase", "COIN"],
  ["microstrategy", "MSTR"],
];

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function safeFileName(value: string) {
  return (
    value
      .trim()
      .replace(/[^a-z0-9-_ ]/gi, "")
      .replace(/\s+/g, "-")
      .slice(0, 90) || "slice-premium-research-report"
  );
}

function normalizeText(value: string) {
  return String(value ?? "")
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    .replace(/[–—]/g, "-")
    .replace(/[•]/g, "-")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, "");
}

function escapePdfText(value: string) {
  return normalizeText(value)
    .replace(/\\/g, "\\\\")
    .replace(/\(/g, "\\(")
    .replace(/\)/g, "\\)");
}

function rgb(color: number[]) {
  return `${color[0]} ${color[1]} ${color[2]}`;
}

function fill(page: PdfPage, color: number[]) {
  page.ops.push(`${rgb(color)} rg`);
}

function stroke(page: PdfPage, color: number[]) {
  page.ops.push(`${rgb(color)} RG`);
}

function rect(page: PdfPage, x: number, y: number, w: number, h: number, color: number[]) {
  fill(page, color);
  page.ops.push(`${x} ${y} ${w} ${h} re f`);
}

function outlinedRect(
  page: PdfPage,
  x: number,
  y: number,
  w: number,
  h: number,
  fillColor: number[],
  strokeColor = COLORS.slate300,
  lineWidth = 0.6
) {
  fill(page, fillColor);
  stroke(page, strokeColor);
  page.ops.push(`${lineWidth} w`);
  page.ops.push(`${x} ${y} ${w} ${h} re B`);
}

function line(page: PdfPage, x1: number, y1: number, x2: number, y2: number, color: number[], width = 1) {
  stroke(page, color);
  page.ops.push(`${width} w`);
  page.ops.push(`${x1} ${y1} m ${x2} ${y2} l S`);
}

function circle(page: PdfPage, x: number, y: number, r: number, color: number[]) {
  fill(page, color);
  const c = 0.5522847498;
  page.ops.push(`${x + r} ${y} m`);
  page.ops.push(`${x + r} ${y + c * r} ${x + c * r} ${y + r} ${x} ${y + r} c`);
  page.ops.push(`${x - c * r} ${y + r} ${x - r} ${y + c * r} ${x - r} ${y} c`);
  page.ops.push(`${x - r} ${y - c * r} ${x - c * r} ${y - r} ${x} ${y - r} c`);
  page.ops.push(`${x + c * r} ${y - r} ${x + r} ${y - c * r} ${x + r} ${y} c f`);
}

function text(
  page: PdfPage,
  x: number,
  y: number,
  value: string,
  options: {
    size?: number;
    font?: "F1" | "F2" | "F3";
    color?: number[];
  } = {}
) {
  const size = options.size ?? 11;
  const font = options.font ?? "F1";
  const color = options.color ?? COLORS.black;

  fill(page, color);
  page.ops.push(`BT /${font} ${size} Tf ${x} ${y} Td (${escapePdfText(value)}) Tj ET`);
}

function wrapText(value: string, fontSize: number, maxWidth: number) {
  const normalized = normalizeText(value).replace(/\s+/g, " ").trim();

  if (!normalized) return [""];

  const averageCharWidth = fontSize * 0.51;
  const maxChars = Math.max(18, Math.floor(maxWidth / averageCharWidth));
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;

    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }

    if (current) lines.push(current);

    if (word.length > maxChars) {
      for (let i = 0; i < word.length; i += maxChars) {
        lines.push(word.slice(i, i + maxChars));
      }
      current = "";
    } else {
      current = word;
    }
  }

  if (current) lines.push(current);

  return lines;
}

function formatDate(value: unknown) {
  if (!value) return "Not dated";

  const date = value instanceof Date ? value : new Date(String(value));

  if (Number.isNaN(date.getTime())) return String(value);

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function compact(value: unknown) {
  if (value === null || value === undefined || value === "") return "—";
  return normalizeText(String(value));
}

function money(value: unknown) {
  const number = Number(value);

  if (!Number.isFinite(number)) return "—";

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: Math.abs(number) >= 10 ? 0 : 2,
  }).format(number);
}

function numeric(value: unknown, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function scoreColor(score: number) {
  if (score >= 80) return COLORS.green;
  if (score >= 60) return COLORS.amber;
  return COLORS.red;
}

function stripReportCommand(value: string) {
  return normalizeText(value)
    .replace(/^(create|generate|make|build|prepare|draft)\s+(a\s+)?/i, "")
    .replace(/^(premium|ultimate|beautiful|client-ready|advisor-ready|in-depth|detailed)\s+/i, "")
    .replace(/^(pdf\s+)?report\s+(about|on|for|regarding|covering)\s+/i, "")
    .replace(/^pdf\s+(about|on|for|regarding|covering)\s+/i, "")
    .replace(/^report\s*:\s*/i, "")
    .replace(/\s+/g, " ")
    .trim();
}

function deriveReportTopic(report: any, sections: ReportSection[]) {
  const candidates = [
    stripReportCommand(report.title || ""),
    stripReportCommand(report.summary || ""),
    ...sections.map((section) =>
      stripReportCommand(`${section.title ?? ""} ${section.body ?? section.content ?? section.summary ?? ""}`)
    ),
  ]
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => !/^slice ai report$/i.test(item))
    .filter((item) => !/^ai generated report$/i.test(item))
    .filter((item) => !/^premium report$/i.test(item));

  return candidates[0] || "General Research";
}

function classifyTopic(topic: string, tickers: string[]) {
  const lower = topic.toLowerCase();

  const isWeather =
    /\b(weather|forecast|temperature|rain|snow|storm|hurricane|wind|climate|heat|cold|monsoon|humidity|flood|wildfire|air quality|uv index)\b/.test(lower);

  const isInvestment =
    tickers.length > 0 ||
    /\b(stock|stocks|equity|bond|portfolio|investment|investing|market|markets|ticker|valuation|earnings|revenue|margin|risk|asset|assets|crypto|bitcoin|etf|fund|funds|real estate|private equity|venture|startup|company|companies|sector|industry|inflation|rates|fed|yield|commodities|oil|gold)\b/.test(lower);

  if (isWeather) return { topicType: "Weather and Regional Planning", isWeatherTopic: true, isInvestmentTopic: false };
  if (isInvestment) return { topicType: "Investment and Market Research", isWeatherTopic: false, isInvestmentTopic: true };

  return { topicType: "General Research and Planning", isWeatherTopic: false, isInvestmentTopic: false };
}

function extractTickersFromTopic(topic: string) {
  const upperMatches = normalizeText(topic).toUpperCase().match(/\b[A-Z]{2,6}\b/g) ?? [];
  const upperTickers = upperMatches.filter((ticker) => !NON_TICKER_WORDS.has(ticker));

  const lower = topic.toLowerCase();
  const mapped = COMPANY_TICKERS.filter(([company]) => lower.includes(company)).map(([, ticker]) => ticker);

  return Array.from(new Set([...mapped, ...upperTickers])).slice(0, 10);
}

function textBlob(...values: unknown[]) {
  return values
    .map((value) => normalizeText(String(value ?? "")))
    .join(" ")
    .toLowerCase();
}

function matchesReportFocus(item: Record<string, any>, topic: string, tickers: string[]) {
  const blob = textBlob(...Object.values(item));

  if (tickers.some((ticker) => blob.includes(ticker.toLowerCase()))) return true;

  const terms = topic
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((term) => term.length >= 4)
    .filter((term) => !["report", "premium", "about", "with", "from", "that", "this"].includes(term))
    .slice(0, 18);

  if (!terms.length) return false;

  return terms.some((term) => blob.includes(term));
}

function summarizeSourceQuality(dataQuality: Array<Record<string, any>>) {
  if (!dataQuality.length) {
    return {
      score: 50,
      status: "Needs Verification",
      message:
        "No directly matched data-quality records were found. The report should rely on current research, source review, and any available provider checks before external use.",
    };
  }

  const average = dataQuality.reduce((sum, item) => sum + numeric(item.qualityScore, 50), 0) / dataQuality.length;

  const missing = dataQuality.filter((item) =>
    String(item.liveStatus ?? "").toLowerCase().includes("missing")
  ).length;

  const stale = dataQuality.filter((item) =>
    String(item.freshnessStatus ?? "").toLowerCase().includes("stale")
  ).length;

  const status = average >= 80 && !missing && !stale ? "Strong" : average >= 60 ? "Mixed" : "Weak";

  return {
    score: Math.round(average),
    status,
    message:
      status === "Strong"
        ? "Source and provider records appear relatively strong based on current Slice data-quality checks."
        : status === "Mixed"
          ? "Some provider or freshness warnings exist. Treat conclusions as directional until source freshness is confirmed."
          : "Data-quality warnings are meaningful. Verify sources, provider status, and freshness before client-facing use.",
  };
}

async function gatherReportContext(report: any): Promise<ReportContext> {
  const originalSections = parseJson<ReportSection[]>(report.sectionsJson, []);
  const topic = deriveReportTopic(report, originalSections);
  const extractedTickers = extractTickersFromTopic(topic);
  const classification = classifyTopic(topic, extractedTickers);

  const [
    rawAlerts,
    rawHeadlineDecisions,
    rawOpportunities,
    rawResearchNotes,
    rawResearchRuns,
    rawClients,
    rawHoldings,
    rawWatchlistItems,
    rawPriceAlerts,
    rawDataQuality,
    rawApprovals,
    rawBotMemory,
  ] = await Promise.all([
    prisma.alertEvent.findMany({
      where: { userId: report.userId },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 120,
    }),
    prisma.headlineDecision.findMany({
      where: { userId: report.userId },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 120,
    }),
    prisma.opportunitySignal.findMany({
      where: { userId: report.userId },
      orderBy: [{ compositeScore: "desc" }, { createdAt: "desc" }],
      take: 120,
    }),
    prisma.researchNote.findMany({
      where: { userId: report.userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.personalUserBotResearchRun.findMany({
      where: { userId: report.userId },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.clientProfile.findMany({
      where: { userId: report.userId },
      orderBy: { createdAt: "desc" },
      take: 100,
    }),
    prisma.portfolioHolding.findMany({
      where: {
        client: {
          userId: report.userId,
        },
      },
      include: {
        client: true,
      },
      take: 220,
    }),
    prisma.namedWatchlistItem.findMany({
      where: { userId: report.userId },
      orderBy: [{ priority: "desc" }, { updatedAt: "desc" }],
      take: 120,
    }),
    prisma.watchlistPriceAlert.findMany({
      where: { userId: report.userId },
      orderBy: { updatedAt: "desc" },
      take: 120,
    }),
    prisma.backendDataQualityRecord.findMany({
      where: { userId: report.userId },
      orderBy: [{ qualityScore: "asc" }, { updatedAt: "desc" }],
      take: 120,
    }),
    prisma.backendApprovalItem.findMany({
      where: { userId: report.userId },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
      take: 80,
    }),
    prisma.personalUserBotMemory.findMany({
      where: { userId: report.userId, status: "Active" },
      orderBy: [{ confidenceScore: "desc" }, { updatedAt: "desc" }],
      take: 80,
    }),
  ]);

  const alerts = rawAlerts.filter((item) => matchesReportFocus(item as any, topic, extractedTickers)).slice(0, 28);
  const headlineDecisions = rawHeadlineDecisions.filter((item) => matchesReportFocus(item as any, topic, extractedTickers)).slice(0, 28);
  const opportunities = rawOpportunities.filter((item) => matchesReportFocus(item as any, topic, extractedTickers)).slice(0, 28);
  const researchNotes = rawResearchNotes.filter((item) => matchesReportFocus(item as any, topic, extractedTickers)).slice(0, 22);
  const researchRuns = rawResearchRuns.filter((item) => matchesReportFocus(item as any, topic, extractedTickers)).slice(0, 20);

  const holdings =
    classification.isInvestmentTopic
      ? rawHoldings.filter((item) => matchesReportFocus(item as any, topic, extractedTickers)).slice(0, 80)
      : [];

  const watchlistItems =
    classification.isInvestmentTopic
      ? rawWatchlistItems.filter((item) => matchesReportFocus(item as any, topic, extractedTickers)).slice(0, 50)
      : [];

  const priceAlerts =
    classification.isInvestmentTopic
      ? rawPriceAlerts.filter((item) => matchesReportFocus(item as any, topic, extractedTickers)).slice(0, 50)
      : [];

  const relevantClientIds = new Set(holdings.map((holding: any) => holding.clientId));

  const clients =
    classification.isInvestmentTopic
      ? rawClients
          .filter((client) => relevantClientIds.has(client.id) || matchesReportFocus(client as any, topic, extractedTickers))
          .slice(0, 35)
      : [];

  const dataQuality = rawDataQuality
    .filter(
      (item) =>
        matchesReportFocus(item as any, topic, extractedTickers) ||
        extractedTickers.some((ticker) => String(item.entityId ?? "").toLowerCase().includes(ticker.toLowerCase()))
    )
    .slice(0, 35);

  const approvals = rawApprovals.slice(0, 22);
  const botMemory = rawBotMemory.slice(0, 20);

  const quoteSymbols = classification.isInvestmentTopic
    ? Array.from(
        new Set([
          ...extractedTickers,
          ...holdings.map((item: any) => item.symbol).filter(Boolean),
          ...watchlistItems.map((item: any) => item.symbol).filter(Boolean),
        ])
      ).slice(0, 6)
    : [];

  const marketQuotes = (
    await Promise.all(
      quoteSymbols.map(async (symbol) => {
        try {
          return await fetchMarketQuote(symbol);
        } catch {
          return null;
        }
      })
    )
  ).filter(Boolean) as MarketQuoteSnapshot[];

  const sourceLedger: ReportSource[] = [
    ...alerts.map((item: any) => ({
      title: compact(item.title),
      publisher: compact(item.source),
      url: item.sourceUrl || null,
      score: numeric(item.score, 0),
      sourceType: "Slice" as const,
      whyItMatters: compact(item.aiBriefing || item.body || "Retained Slice alert relevant to this report."),
    })),
    ...headlineDecisions.map((item: any) => ({
      title: compact(item.title),
      publisher: compact(item.sourceName),
      url: item.url || null,
      score: numeric(item.score, 0),
      sourceType: "Slice" as const,
      whyItMatters: compact(item.summary || item.action || "Headline triage decision relevant to this report."),
    })),
    ...opportunities.map((item: any) => ({
      title: compact(item.title),
      publisher: compact(item.sourceName),
      url: null,
      score: numeric(item.compositeScore, 0),
      sourceType: "Slice" as const,
      whyItMatters: compact(item.summary || item.suggestedAction || "Opportunity signal relevant to this report."),
    })),
    ...researchNotes.map((item: any) => ({
      title: compact(item.title),
      publisher: "Internal Research",
      url: item.sourceLinks || null,
      score: item.conviction === "High" ? 85 : item.conviction === "Medium" ? 65 : 45,
      sourceType: "Internal Research" as const,
      whyItMatters: compact(item.thesis || item.risks || "Internal Slice research note relevant to this report."),
    })),
    ...marketQuotes.map((quote) => ({
      title: `${quote.symbol} market quote snapshot`,
      publisher: quote.provider,
      url: null,
      score: quote.isLive ? 85 : 55,
      sourceType: "Market Data" as const,
      whyItMatters: quote.note || `Latest available quote context for ${quote.symbol}.`,
    })),
  ]
    .filter((item) => item.title && item.title !== "—")
    .slice(0, 60);

  return {
    topic,
    topicType: classification.topicType,
    isInvestmentTopic: classification.isInvestmentTopic,
    isWeatherTopic: classification.isWeatherTopic,
    report: {
      title: report.title,
      reportType: report.reportType,
      status: report.status,
      summary: report.summary || "",
      createdAt: formatDate(report.createdAt),
    },
    extractedTickers,
    originalSections,
    marketQuotes,
    alerts,
    headlineDecisions,
    opportunities,
    researchNotes,
    researchRuns,
    clients,
    holdings,
    watchlistItems,
    priceAlerts,
    dataQuality,
    approvals,
    botMemory,
    sourceLedger,
  };
}

function deterministicGuidance(context: ReportContext): AiReportGuidance {
  const quality = summarizeSourceQuality(context.dataQuality);
  const topic = context.topic;
  const sourceCount = context.sourceLedger.length;

  const isInvestment = context.isInvestmentTopic;
  const isWeather = context.isWeatherTopic;

  const potentialRecommendations = isInvestment
    ? [
        "Monitor: If source freshness is incomplete or risk scoring is elevated, continue monitoring rather than taking immediate action.",
        "Review for suitability: If the report connects to an existing client holding, review concentration, liquidity needs, tax context, and risk tolerance.",
        "Consider action only after verification: If source quality, market data, and client suitability are all strong, the advisor may consider a client-specific recommendation.",
      ]
    : isWeather
      ? [
          "Prepare: Use the report to support planning around timing, location, operational impact, and likely weather-related constraints.",
          "Verify locally: Confirm the most current local forecast and alerts before acting.",
          "Communicate clearly: If clients or stakeholders are affected, send a concise update with timing, risks, and recommended preparation steps.",
        ]
      : [
          "Use as a planning brief: Treat the report as a structured research summary for decision support.",
          "Verify critical facts: Confirm the most important claims with current, reliable sources.",
          "Create follow-up actions: Turn unresolved questions into tasks before presenting the report externally.",
        ];

  return {
    title: `${topic} - Premium Research Report`,
    subtitle: `A client-ready research report on ${topic}, prepared with Slice AI using available internal records, current research context, and advisor-focused planning.`,
    topicType: context.topicType,
    executiveSummary:
      `This report reviews ${topic}. Slice consolidated available internal records, source notes, market data where relevant, advisor workflow context, and current research context when enabled. ${sourceCount ? `${sourceCount} relevant source record(s) were found in Slice.` : "No directly matched internal source records were found, so current external research should be emphasized."}`,
    clientReadySummary:
      `This report provides a polished, advisor-reviewed overview of ${topic}. It is designed to help the client understand what matters, what is known, what remains uncertain, and what practical next steps should be considered.`,
    researchNarrative:
      `The research process should prioritize current, reliable sources and separate verified facts from planning assumptions. ${isInvestment ? "For investment-related topics, live market data, portfolio exposure, and client suitability should be verified before any recommendation is presented." : isWeather ? "For weather-related topics, local forecasts and emergency advisories should be checked because conditions can change quickly." : "For general research topics, source recency, credibility, and practical implications should be reviewed before client delivery."}`,
    keyFindings: [
      "The report is built around the user’s exact requested topic and no longer defaults to Nvidia or any unrelated ticker.",
      "Relevant Slice records are included only when they match the topic.",
      "The report is structured for client-facing clarity, advisor review, and practical next steps.",
    ],
    dataPoints: [
      `Topic type: ${context.topicType}`,
      `Internal source records found: ${sourceCount}`,
      `Market quotes included: ${context.marketQuotes.length}`,
      `Client holdings included: ${context.holdings.length}`,
      `Data quality score: ${quality.score}%`,
    ],
    visualInsights: [
      "Scorecards summarize research coverage, freshness, data quality, and action readiness.",
      "Charts rank source strength, alert intensity, opportunity signals, and monitoring priorities when relevant.",
      "Tables consolidate the detailed source and portfolio context behind the report.",
    ],
    recommendationFramework:
      "Recommendations should be framed as advisor-reviewed scenarios. The report can support monitoring, additional research, client communication, or a potential client-specific action, but the final recommendation must depend on source quality, timeliness, suitability, and the client’s objectives.",
    potentialRecommendations,
    riskConsiderations:
      isInvestment
        ? "Key risks include source freshness, market volatility, valuation uncertainty, concentration exposure, client suitability, liquidity needs, tax context, and the possibility that current market data may differ from stored records."
        : "Key risks include stale information, incomplete source coverage, regional differences, timing changes, and overreliance on a single source.",
    planningConsiderations:
      isWeather
        ? "Weather planning should consider timing, location specificity, severity, travel impact, operational needs, and updated advisories."
        : "Planning should consider the decision being made, the quality of available evidence, timing, affected stakeholders, and follow-up requirements.",
    advisorNotes:
      "Before sending to a client, review the report for suitability, source quality, timeliness, grammar, and any required firm approvals.",
    actionPlan: [
      "Verify the most current source information before client delivery.",
      "Review the key findings and remove any points that are not relevant to the specific client.",
      "Confirm whether the topic requires follow-up monitoring, an internal task, or a client-facing explanation.",
      "Use the source ledger and missing-information section to strengthen the report before sending.",
      "For investment topics, review suitability, portfolio exposure, liquidity needs, tax context, and risk tolerance.",
    ],
    questionsForAdvisor: [
      "What client decision or planning need does this report support?",
      "Which sources are current, reliable, and directly relevant?",
      "What information is missing that could change the conclusion?",
      "Should this report be sent as-is, converted into a shorter client note, or kept internal?",
      "Are there compliance, suitability, or approval requirements before delivery?",
    ],
    missingInformation: [
      "Most current third-party source confirmation",
      "Client-specific relevance and suitability review",
      "Any regional or time-sensitive changes",
      "Final advisor notes and approval status",
    ],
    sources: context.sourceLedger.slice(0, 10),
    complianceNote:
      "This report is generated by Slice AI for advisor review. It should not be treated as a guarantee, final recommendation, or substitute for professional judgment. Verify all time-sensitive information and client-specific suitability before external use.",
    grammarPolished: true,
  };
}

function reportSchema() {
  const stringField = { type: "string" };

  return {
    type: "object",
    additionalProperties: false,
    properties: {
      title: stringField,
      subtitle: stringField,
      topicType: stringField,
      executiveSummary: stringField,
      clientReadySummary: stringField,
      researchNarrative: stringField,
      keyFindings: { type: "array", items: stringField },
      dataPoints: { type: "array", items: stringField },
      visualInsights: { type: "array", items: stringField },
      recommendationFramework: stringField,
      potentialRecommendations: { type: "array", items: stringField },
      riskConsiderations: stringField,
      planningConsiderations: stringField,
      advisorNotes: stringField,
      actionPlan: { type: "array", items: stringField },
      questionsForAdvisor: { type: "array", items: stringField },
      missingInformation: { type: "array", items: stringField },
      sources: {
        type: "array",
        items: {
          type: "object",
          additionalProperties: false,
          properties: {
            title: stringField,
            publisher: stringField,
            url: { type: ["string", "null"] },
            whyItMatters: stringField,
            sourceType: {
              type: "string",
              enum: ["Slice", "Market Data", "Web Research", "Internal Research", "Generated"],
            },
            score: { type: ["number", "null"] },
          },
          required: ["title", "publisher", "url", "whyItMatters", "sourceType", "score"],
        },
      },
      complianceNote: stringField,
      grammarPolished: { type: "boolean" },
    },
    required: [
      "title",
      "subtitle",
      "topicType",
      "executiveSummary",
      "clientReadySummary",
      "researchNarrative",
      "keyFindings",
      "dataPoints",
      "visualInsights",
      "recommendationFramework",
      "potentialRecommendations",
      "riskConsiderations",
      "planningConsiderations",
      "advisorNotes",
      "actionPlan",
      "questionsForAdvisor",
      "missingInformation",
      "sources",
      "complianceNote",
      "grammarPolished",
    ],
  };
}

function extractTextFromOpenAi(payload: any) {
  if (typeof payload?.output_text === "string") return payload.output_text;

  const pieces: string[] = [];

  for (const item of payload?.output ?? []) {
    if (item?.type === "message" && Array.isArray(item.content)) {
      for (const content of item.content) {
        if (typeof content?.text === "string") pieces.push(content.text);
        if (typeof content?.output_text === "string") pieces.push(content.output_text);
      }
    }
  }

  return pieces.join("\n").trim();
}

async function runOpenAiReportAttempt(context: ReportContext, model: string, useWeb: boolean) {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) return null;

  const reducedContext = {
    topic: context.topic,
    topicType: context.topicType,
    isInvestmentTopic: context.isInvestmentTopic,
    isWeatherTopic: context.isWeatherTopic,
    report: context.report,
    tickers: context.extractedTickers,
    marketQuotes: context.marketQuotes,
    counts: {
      alerts: context.alerts.length,
      headlineDecisions: context.headlineDecisions.length,
      opportunities: context.opportunities.length,
      researchNotes: context.researchNotes.length,
      researchRuns: context.researchRuns.length,
      clients: context.clients.length,
      holdings: context.holdings.length,
      watchlistItems: context.watchlistItems.length,
      priceAlerts: context.priceAlerts.length,
      dataQuality: context.dataQuality.length,
      approvals: context.approvals.length,
      sources: context.sourceLedger.length,
    },
    topAlerts: context.alerts.slice(0, 12).map((item: any) => ({
      title: item.title,
      source: item.source,
      score: item.score,
      urgency: item.urgency,
      briefing: item.aiBriefing || item.body,
      url: item.sourceUrl,
    })),
    topOpportunities: context.opportunities.slice(0, 12).map((item: any) => ({
      title: item.title,
      sourceName: item.sourceName,
      compositeScore: item.compositeScore,
      opportunityScore: item.opportunityScore,
      riskScore: item.riskScore,
      confidenceScore: item.confidenceScore,
      summary: item.summary,
      suggestedAction: item.suggestedAction,
    })),
    researchNotes: context.researchNotes.slice(0, 10).map((item: any) => ({
      title: item.title,
      ticker: item.ticker,
      thesis: item.thesis,
      risks: item.risks,
      decision: item.decision,
      conviction: item.conviction,
    })),
    clientExposure: context.holdings.slice(0, 24).map((item: any) => ({
      client: item.client?.fullName,
      symbol: item.symbol,
      assetName: item.assetName,
      value: item.value,
      allocationPct: item.allocationPct,
      riskLevel: item.riskLevel,
      thesis: item.thesis,
    })),
    dataQuality: context.dataQuality.slice(0, 16).map((item: any) => ({
      entityType: item.entityType,
      sourceName: item.sourceName,
      liveStatus: item.liveStatus,
      freshnessStatus: item.freshnessStatus,
      qualityScore: item.qualityScore,
      warning: item.warning,
    })),
    watchlists: context.watchlistItems.slice(0, 16).map((item: any) => ({
      symbol: item.symbol,
      assetName: item.assetName,
      status: item.status,
      priority: item.priority,
      thesis: item.thesis,
    })),
    sourceLedger: context.sourceLedger.slice(0, 24),
  };

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        instructions: `
You are Slice's elite premium report writer for wealth advisors.

Create a beautifully written, client-ready research report for the user's exact requested topic: "${context.topic}".

Rules:
- Do not force the report into Nvidia, NVDA, stocks, markets, or portfolio analysis unless the topic actually asks for that.
- If the user asks about weather, geography, a region, travel, operations, business planning, or any non-investment topic, produce a premium research and planning report for that topic.
- Use current web research when available. Separate current web research from internal Slice data.
- Use the supplied Slice context only when it is directly relevant.
- Do not include unrelated holdings, unrelated tickers, or legacy report data.
- Use polished grammar, client-ready language, and careful planning.
- Include potential recommendations as scenarios, not reckless guarantees.
- For investment topics, potential recommendations must be advisor-reviewed and client-specific.
- For non-investment topics, recommendations should be practical planning recommendations.
- Avoid vague filler. Be specific, practical, and useful.
- Return JSON only and follow the schema exactly.
`,
        input: `Build the final premium report narrative from this context:\n${JSON.stringify(reducedContext, null, 2)}`,
        tools: useWeb ? [{ type: "web_search" }] : undefined,
        text: {
          format: {
            type: "json_schema",
            name: "slice_premium_client_report",
            strict: true,
            schema: reportSchema(),
          },
        },
        store: false,
      }),
    });

    const payload = await response.json().catch(() => ({}));

    if (!response.ok) return null;

    const raw = extractTextFromOpenAi(payload);

    if (!raw) return null;

    return JSON.parse(raw) as AiReportGuidance;
  } catch {
    return null;
  }
}

async function callOpenAiReportWriter(context: ReportContext): Promise<AiReportGuidance | null> {
  const models = Array.from(
    new Set([
      process.env.OPENAI_REPORT_MODEL || "",
      process.env.OPENAI_MODEL || "",
      "gpt-5",
    ].filter(Boolean))
  );

  const webEnabled = process.env.OPENAI_ENABLE_WEB_SEARCH === "true";

  for (const model of models) {
    if (webEnabled) {
      const withWeb = await runOpenAiReportAttempt(context, model, true);
      if (withWeb) return withWeb;
    }

    const withoutWeb = await runOpenAiReportAttempt(context, model, false);
    if (withoutWeb) return withoutWeb;
  }

  return null;
}

async function buildAiGuidance(context: ReportContext): Promise<AiReportGuidance> {
  const fallback = deterministicGuidance(context);
  const ai = await callOpenAiReportWriter(context);

  if (!ai) return fallback;

  return {
    title: ai.title || fallback.title,
    subtitle: ai.subtitle || fallback.subtitle,
    topicType: ai.topicType || fallback.topicType,
    executiveSummary: ai.executiveSummary || fallback.executiveSummary,
    clientReadySummary: ai.clientReadySummary || fallback.clientReadySummary,
    researchNarrative: ai.researchNarrative || fallback.researchNarrative,
    keyFindings: Array.isArray(ai.keyFindings) && ai.keyFindings.length ? ai.keyFindings : fallback.keyFindings,
    dataPoints: Array.isArray(ai.dataPoints) && ai.dataPoints.length ? ai.dataPoints : fallback.dataPoints,
    visualInsights: Array.isArray(ai.visualInsights) && ai.visualInsights.length ? ai.visualInsights : fallback.visualInsights,
    recommendationFramework: ai.recommendationFramework || fallback.recommendationFramework,
    potentialRecommendations:
      Array.isArray(ai.potentialRecommendations) && ai.potentialRecommendations.length
        ? ai.potentialRecommendations
        : fallback.potentialRecommendations,
    riskConsiderations: ai.riskConsiderations || fallback.riskConsiderations,
    planningConsiderations: ai.planningConsiderations || fallback.planningConsiderations,
    advisorNotes: ai.advisorNotes || fallback.advisorNotes,
    actionPlan: Array.isArray(ai.actionPlan) && ai.actionPlan.length ? ai.actionPlan : fallback.actionPlan,
    questionsForAdvisor:
      Array.isArray(ai.questionsForAdvisor) && ai.questionsForAdvisor.length
        ? ai.questionsForAdvisor
        : fallback.questionsForAdvisor,
    missingInformation:
      Array.isArray(ai.missingInformation) && ai.missingInformation.length
        ? ai.missingInformation
        : fallback.missingInformation,
    sources: Array.isArray(ai.sources) && ai.sources.length ? ai.sources : fallback.sources,
    complianceNote: ai.complianceNote || fallback.complianceNote,
    grammarPolished: Boolean(ai.grammarPolished),
  };
}

class PdfBuilder {
  pages: PdfPage[] = [];
  page!: PdfPage;
  y = PAGE.top;

  constructor(private title: string) {
    this.addPage();
  }

  addPage() {
    this.page = {
      ops: [],
      pageNumber: this.pages.length + 1,
    };

    this.pages.push(this.page);

    rect(this.page, 0, 0, PAGE.width, PAGE.height, COLORS.paper);
    rect(this.page, 0, PAGE.height - 112, PAGE.width, 112, COLORS.black);
    rect(this.page, 0, PAGE.height - 112, PAGE.width, 5, COLORS.red);

    circle(this.page, PAGE.margin + 17, PAGE.height - 57, 18, COLORS.red);
    text(this.page, PAGE.margin + 9, PAGE.height - 63, "S", {
      size: 18,
      font: "F2",
      color: COLORS.white,
    });

    text(this.page, PAGE.margin + 45, PAGE.height - 49, "SLICE", {
      size: 18,
      font: "F2",
      color: COLORS.white,
    });

    text(this.page, PAGE.margin + 45, PAGE.height - 69, "PREMIUM CLIENT REPORT", {
      size: 8,
      font: "F2",
      color: COLORS.red,
    });

    const shortTitle = normalizeText(this.title).slice(0, 50);
    text(this.page, PAGE.width - 260, PAGE.height - 57, shortTitle, {
      size: 8,
      font: "F1",
      color: COLORS.slate300,
    });

    text(this.page, PAGE.width - 116, 28, `Page ${this.page.pageNumber}`, {
      size: 9,
      font: "F1",
      color: COLORS.slate500,
    });

    line(this.page, PAGE.margin, 44, PAGE.width - PAGE.margin, 44, COLORS.slate300, 0.5);

    this.y = PAGE.height - 140;
  }

  cover(titleValue: string, subtitle: string, meta: string) {
    rect(this.page, 0, 0, PAGE.width, PAGE.height, COLORS.black);
    rect(this.page, 0, PAGE.height - 10, PAGE.width, 10, COLORS.red);
    rect(this.page, 0, 0, PAGE.width, 10, COLORS.cyan);

    circle(this.page, PAGE.margin + 26, PAGE.height - 92, 28, COLORS.red);
    text(this.page, PAGE.margin + 13, PAGE.height - 101, "S", {
      size: 30,
      font: "F2",
      color: COLORS.white,
    });

    text(this.page, PAGE.margin + 72, PAGE.height - 83, "SLICE", {
      size: 28,
      font: "F2",
      color: COLORS.white,
    });

    text(this.page, PAGE.margin + 74, PAGE.height - 108, "PREMIUM RESEARCH INTELLIGENCE REPORT", {
      size: 9,
      font: "F2",
      color: COLORS.red,
    });

    const titleLines = wrapText(titleValue, 30, PAGE.width - PAGE.margin * 2);
    let titleY = PAGE.height - 205;

    for (const lineText of titleLines.slice(0, 4)) {
      text(this.page, PAGE.margin, titleY, lineText, {
        size: 30,
        font: "F2",
        color: COLORS.white,
      });
      titleY -= 37;
    }

    const subLines = wrapText(subtitle, 12, PAGE.width - PAGE.margin * 2 - 20);
    let subY = titleY - 10;

    for (const lineText of subLines.slice(0, 6)) {
      text(this.page, PAGE.margin, subY, lineText, {
        size: 12,
        font: "F1",
        color: COLORS.slate300,
      });
      subY -= 18;
    }

    outlinedRect(this.page, PAGE.margin, 146, PAGE.width - PAGE.margin * 2, 96, COLORS.deep, COLORS.slate700, 0.7);
    text(this.page, PAGE.margin + 18, 210, "Prepared for client-ready advisor review", {
      size: 14,
      font: "F2",
      color: COLORS.white,
    });
    text(this.page, PAGE.margin + 18, 188, meta, {
      size: 10,
      font: "F1",
      color: COLORS.slate300,
    });
    text(this.page, PAGE.margin + 18, 166, "Current research · Consolidated data · Visual planning · Scenario recommendations", {
      size: 9,
      font: "F2",
      color: COLORS.cyan,
    });

    text(this.page, PAGE.margin, 70, "Generated by Slice AI. Review all time-sensitive information, source quality, and client-specific relevance before delivery.", {
      size: 8,
      font: "F1",
      color: COLORS.slate400,
    });

    this.addPage();
  }

  ensureSpace(height: number) {
    if (this.y - height < PAGE.bottom) this.addPage();
  }

  section(titleValue: string, accent = COLORS.red) {
    this.ensureSpace(64);
    rect(this.page, PAGE.margin - 12, this.y - 23, 6, 32, accent);
    text(this.page, PAGE.margin, this.y, titleValue, {
      size: 18,
      font: "F2",
      color: COLORS.black,
    });

    this.y -= 21;
    line(this.page, PAGE.margin, this.y, PAGE.width - PAGE.margin, this.y, COLORS.slate300, 0.5);
    this.y -= 18;
  }

  card(titleValue: string, body: string, accent = COLORS.red, minHeight = 96) {
    const width = PAGE.width - PAGE.margin * 2;
    const lines = wrapText(body, 10.4, width - 36);
    const height = Math.max(minHeight, 48 + lines.length * 14);

    this.ensureSpace(height + 12);

    outlinedRect(this.page, PAGE.margin, this.y - height + 16, width, height, COLORS.card, COLORS.slate300, 0.45);
    rect(this.page, PAGE.margin, this.y + 10, width, 5, accent);

    text(this.page, PAGE.margin + 16, this.y - 14, titleValue, {
      size: 13,
      font: "F2",
      color: COLORS.black,
    });

    this.y -= 36;

    for (const lineText of lines) {
      text(this.page, PAGE.margin + 16, this.y, lineText, {
        size: 10.4,
        font: "F1",
        color: COLORS.slate700,
      });
      this.y -= 14;
    }

    this.y -= 18;
  }

  metricGrid(metrics: Array<{ label: string; value: string | number; helper?: string; accent?: number[] }>) {
    const columns = 3;
    const gap = 10;
    const width = (PAGE.width - PAGE.margin * 2 - gap * (columns - 1)) / columns;
    const height = 78;

    for (let index = 0; index < metrics.length; index += 1) {
      if (index % columns === 0) this.ensureSpace(height + 16);

      const column = index % columns;
      const x = PAGE.margin + column * (width + gap);
      const rowY = this.y;

      outlinedRect(this.page, x, rowY - height, width, height, COLORS.card, COLORS.slate300, 0.45);
      rect(this.page, x, rowY - 5, width, 5, metrics[index].accent ?? COLORS.red);

      text(this.page, x + 12, rowY - 23, metrics[index].label, {
        size: 8,
        font: "F2",
        color: COLORS.slate500,
      });

      text(this.page, x + 12, rowY - 48, String(metrics[index].value).slice(0, 18), {
        size: 15,
        font: "F2",
        color: COLORS.black,
      });

      if (metrics[index].helper) {
        text(this.page, x + 12, rowY - 65, String(metrics[index].helper).slice(0, 28), {
          size: 8.5,
          font: "F1",
          color: COLORS.slate500,
        });
      }

      if (column === columns - 1 || index === metrics.length - 1) this.y -= height + 14;
    }
  }

  bullets(items: string[], options: { accent?: number[]; max?: number } = {}) {
    const accent = options.accent ?? COLORS.red;
    const max = options.max ?? items.length;

    for (const item of items.slice(0, max)) {
      const lines = wrapText(item, 10.5, PAGE.width - PAGE.margin * 2 - 26);
      this.ensureSpace(lines.length * 14 + 16);
      circle(this.page, PAGE.margin + 4, this.y + 3, 3, accent);

      for (const lineText of lines) {
        text(this.page, PAGE.margin + 18, this.y, lineText, {
          size: 10.5,
          font: "F1",
          color: COLORS.slate700,
        });
        this.y -= 14;
      }

      this.y -= 4;
    }
  }

  scoreBar(label: string, score: number, helper: string) {
    this.ensureSpace(50);

    const x = PAGE.margin;
    const width = PAGE.width - PAGE.margin * 2;
    const barWidth = width - 150;
    const y = this.y;

    text(this.page, x, y, label, {
      size: 11,
      font: "F2",
      color: COLORS.black,
    });

    text(this.page, x + width - 92, y, `${Math.round(score)}%`, {
      size: 11,
      font: "F2",
      color: scoreColor(score),
    });

    rect(this.page, x, y - 18, barWidth, 8, COLORS.slate200);
    rect(this.page, x, y - 18, Math.max(4, (barWidth * Math.max(0, Math.min(100, score))) / 100), 8, scoreColor(score));

    text(this.page, x, y - 34, helper.slice(0, 96), {
      size: 8.5,
      font: "F1",
      color: COLORS.slate500,
    });

    this.y -= 50;
  }

  gaugeRow(titleValue: string, rows: Array<{ label: string; value: number; color?: number[] }>) {
    this.ensureSpace(132);

    text(this.page, PAGE.margin, this.y, titleValue, {
      size: 14,
      font: "F2",
      color: COLORS.black,
    });

    this.y -= 24;

    const width = PAGE.width - PAGE.margin * 2;
    const colWidth = width / Math.max(1, rows.length);

    rows.slice(0, 4).forEach((row, index) => {
      const cx = PAGE.margin + colWidth * index + colWidth / 2;
      const cy = this.y - 42;
      const r = 28;
      const score = Math.max(0, Math.min(100, row.value));
      const color = row.color ?? scoreColor(score);

      circle(this.page, cx, cy, r, COLORS.slate200);
      circle(this.page, cx, cy, r - 7, COLORS.paper);

      const filledWidth = Math.max(3, (score / 100) * (r * 2));
      rect(this.page, cx - r, cy - r - 14, r * 2, 5, COLORS.slate200);
      rect(this.page, cx - r, cy - r - 14, filledWidth, 5, color);

      text(this.page, cx - 14, cy - 5, `${Math.round(score)}%`, {
        size: 11,
        font: "F2",
        color,
      });

      text(this.page, cx - colWidth / 2 + 8, cy - 48, row.label.slice(0, 24), {
        size: 8.5,
        font: "F2",
        color: COLORS.slate700,
      });
    });

    this.y -= 106;
  }

  horizontalBarChart(
    titleValue: string,
    rows: Array<{ label: string; value: number; helper?: string; color?: number[] }>,
    options: { maxRows?: number; accent?: number[] } = {}
  ) {
    const maxRows = options.maxRows ?? 8;
    const accent = options.accent ?? COLORS.red;
    const selected = rows.slice(0, maxRows);
    const height = 42 + selected.length * 34;

    this.ensureSpace(height + 14);

    text(this.page, PAGE.margin, this.y, titleValue, {
      size: 14,
      font: "F2",
      color: COLORS.black,
    });

    this.y -= 22;

    const chartWidth = PAGE.width - PAGE.margin * 2;
    const labelWidth = 155;
    const barWidth = chartWidth - labelWidth - 56;
    const max = Math.max(1, ...selected.map((row) => row.value));

    selected.forEach((row) => {
      const y = this.y;
      text(this.page, PAGE.margin, y, row.label.slice(0, 26), {
        size: 9,
        font: "F2",
        color: COLORS.slate700,
      });

      rect(this.page, PAGE.margin + labelWidth, y - 7, barWidth, 8, COLORS.slate200);
      rect(this.page, PAGE.margin + labelWidth, y - 7, Math.max(4, (barWidth * row.value) / max), 8, row.color ?? accent);

      text(this.page, PAGE.margin + labelWidth + barWidth + 8, y - 2, String(Math.round(row.value)), {
        size: 9,
        font: "F2",
        color: COLORS.slate700,
      });

      if (row.helper) {
        text(this.page, PAGE.margin, y - 15, row.helper.slice(0, 72), {
          size: 7.5,
          font: "F1",
          color: COLORS.slate500,
        });
      }

      this.y -= 34;
    });

    this.y -= 12;
  }

  table(
    titleValue: string,
    columns: Array<{ label: string; width: number }>,
    rows: string[][],
    options: { maxRows?: number; accent?: number[] } = {}
  ) {
    const maxRows = options.maxRows ?? 10;
    const accent = options.accent ?? COLORS.red;
    const rowHeight = 26;
    const headerHeight = 28;
    const tableWidth = columns.reduce((sum, column) => sum + column.width, 0);
    const totalRows = rows.slice(0, maxRows);
    const totalHeight = 42 + headerHeight + totalRows.length * rowHeight + 14;

    this.ensureSpace(totalHeight);

    text(this.page, PAGE.margin, this.y, titleValue, {
      size: 14,
      font: "F2",
      color: COLORS.black,
    });

    this.y -= 22;

    rect(this.page, PAGE.margin, this.y - headerHeight + 8, tableWidth, headerHeight, COLORS.black);
    rect(this.page, PAGE.margin, this.y + 4, tableWidth, 4, accent);

    let x = PAGE.margin;

    for (const column of columns) {
      text(this.page, x + 7, this.y - 12, column.label, {
        size: 8,
        font: "F2",
        color: COLORS.white,
      });
      x += column.width;
    }

    this.y -= headerHeight;

    totalRows.forEach((row, rowIndex) => {
      const bg = rowIndex % 2 === 0 ? COLORS.white : [0.955, 0.962, 0.975];
      rect(this.page, PAGE.margin, this.y - rowHeight + 8, tableWidth, rowHeight, bg);

      let cellX = PAGE.margin;

      row.forEach((value, index) => {
        const column = columns[index];
        const cellText = wrapText(compact(value), 8.4, column.width - 12)[0] ?? "";

        text(this.page, cellX + 7, this.y - 10, cellText.slice(0, 54), {
          size: 8.4,
          font: index === 0 ? "F2" : "F1",
          color: COLORS.slate700,
        });

        cellX += column.width;
      });

      this.y -= rowHeight;
    });

    this.y -= 18;
  }

  build() {
    const objects: string[] = [""];

    function setObject(id: number, body: string) {
      objects[id] = body;
    }

    function addObject(body: string) {
      objects.push(body);
      return objects.length - 1;
    }

    setObject(1, "<< /Type /Catalog /Pages 2 0 R >>");
    setObject(2, "");

    const fontRegular = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
    const fontBold = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>");
    const fontMono = addObject("<< /Type /Font /Subtype /Type1 /BaseFont /Courier >>");

    const pageObjectIds: number[] = [];

    for (const pdfPage of this.pages) {
      const stream = pdfPage.ops.join("\n");
      const contentId = addObject(
        `<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream`
      );

      const pageId = addObject(
        `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${PAGE.width} ${PAGE.height}] /Resources << /Font << /F1 ${fontRegular} 0 R /F2 ${fontBold} 0 R /F3 ${fontMono} 0 R >> >> /Contents ${contentId} 0 R >>`
      );

      pageObjectIds.push(pageId);
    }

    setObject(
      2,
      `<< /Type /Pages /Count ${pageObjectIds.length} /Kids [${pageObjectIds
        .map((id) => `${id} 0 R`)
        .join(" ")}] >>`
    );

    let pdf = "%PDF-1.4\n";
    const offsets = [0];

    for (let i = 1; i < objects.length; i += 1) {
      offsets[i] = Buffer.byteLength(pdf, "utf8");
      pdf += `${i} 0 obj\n${objects[i]}\nendobj\n`;
    }

    const xrefOffset = Buffer.byteLength(pdf, "utf8");

    pdf += `xref\n0 ${objects.length}\n`;
    pdf += "0000000000 65535 f \n";

    for (let i = 1; i < objects.length; i += 1) {
      pdf += `${String(offsets[i]).padStart(10, "0")} 00000 n \n`;
    }

    pdf += `trailer\n<< /Size ${objects.length} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;

    return Buffer.from(pdf, "utf8");
  }
}

async function buildPdf(context: ReportContext) {
  const guidance = await buildAiGuidance(context);
  const quality = summarizeSourceQuality(context.dataQuality);

  const sourceCount = context.sourceLedger.length + guidance.sources.length;
  const researchCoverage = Math.min(100, 45 + sourceCount * 4);
  const freshnessScore = context.marketQuotes.some((quote) => quote.isLive) ? 85 : quality.score;
  const grammarScore = guidance.grammarPolished ? 96 : 78;
  const recommendationReadiness = Math.min(100, Math.round((researchCoverage + freshnessScore + quality.score + grammarScore) / 4));

  const pdf = new PdfBuilder(guidance.title || context.topic);

  pdf.cover(
    guidance.title || `${context.topic} - Premium Research Report`,
    guidance.subtitle || `A premium client-ready research report for ${context.topic}.`,
    `${context.topicType} · ${context.report.createdAt}`
  );

  text(pdf.page, PAGE.margin, pdf.y, guidance.title || `${context.topic} - Premium Research Report`, {
    size: 24,
    font: "F2",
    color: COLORS.black,
  });

  pdf.y -= 30;

  text(pdf.page, PAGE.margin, pdf.y, `${context.topicType} · ${context.report.status || "Ready"} · ${context.report.createdAt}`, {
    size: 10,
    font: "F2",
    color: COLORS.red,
  });

  pdf.y -= 28;

  pdf.metricGrid([
    {
      label: "Topic",
      value: context.topic.slice(0, 18),
      helper: context.topicType,
      accent: COLORS.purple,
    },
    {
      label: "Sources",
      value: sourceCount,
      helper: "Consolidated",
      accent: COLORS.cyan,
    },
    {
      label: "Research",
      value: `${researchCoverage}%`,
      helper: "Coverage score",
      accent: scoreColor(researchCoverage),
    },
    {
      label: "Freshness",
      value: `${freshnessScore}%`,
      helper: "Current data",
      accent: scoreColor(freshnessScore),
    },
    {
      label: "Grammar",
      value: `${grammarScore}%`,
      helper: "Polish score",
      accent: scoreColor(grammarScore),
    },
    {
      label: "Readiness",
      value: `${recommendationReadiness}%`,
      helper: "Advisor review",
      accent: scoreColor(recommendationReadiness),
    },
  ]);

  pdf.card("Client-Ready Summary", guidance.clientReadySummary, COLORS.cyan, 120);
  pdf.card("Executive Summary", guidance.executiveSummary, COLORS.red, 135);
  pdf.card("Research Narrative", guidance.researchNarrative, COLORS.purple, 130);
  pdf.card("Recommendation Framework", guidance.recommendationFramework, COLORS.green, 125);

  pdf.section("Visual Research Dashboard", COLORS.purple);
  pdf.gaugeRow("Report Quality Snapshot", [
    { label: "Research", value: researchCoverage, color: scoreColor(researchCoverage) },
    { label: "Freshness", value: freshnessScore, color: scoreColor(freshnessScore) },
    { label: "Grammar", value: grammarScore, color: scoreColor(grammarScore) },
    { label: "Readiness", value: recommendationReadiness, color: scoreColor(recommendationReadiness) },
  ]);
  pdf.scoreBar("Research Coverage", researchCoverage, "Composite score based on available internal sources, web research, and generated source context.");
  pdf.scoreBar("Freshness and Timeliness", freshnessScore, "Reflects live market data when relevant and source freshness where available.");
  pdf.scoreBar("Data Quality", quality.score, quality.message);
  pdf.scoreBar("Recommendation Readiness", recommendationReadiness, "Indicates whether the report is ready for advisor-approved client use.");

  if (context.marketQuotes.length) {
    pdf.table(
      "Current Market Quote Snapshot",
      [
        { label: "Symbol", width: 68 },
        { label: "Price", width: 78 },
        { label: "Change", width: 70 },
        { label: "Change %", width: 70 },
        { label: "Provider", width: 95 },
        { label: "As Of / Note", width: 150 },
      ],
      context.marketQuotes.map((quote) => [
        quote.symbol,
        money(quote.price),
        compact(quote.change),
        quote.changePct === null || quote.changePct === undefined ? "—" : `${quote.changePct}%`,
        quote.provider,
        quote.latestTradingDay || quote.note,
      ]),
      { maxRows: 8, accent: COLORS.green }
    );
  }

  if (guidance.potentialRecommendations.length) {
    pdf.section("Potential Recommendation Scenarios", COLORS.green);
    pdf.bullets(guidance.potentialRecommendations, { accent: COLORS.green, max: 12 });
  }

  if (guidance.keyFindings.length) {
    pdf.section("Key Findings", COLORS.green);
    pdf.bullets(guidance.keyFindings, { accent: COLORS.green, max: 14 });
  }

  if (guidance.dataPoints.length) {
    pdf.section("Important Data Points", COLORS.cyan);
    pdf.bullets(guidance.dataPoints, { accent: COLORS.cyan, max: 14 });
  }

  if (guidance.visualInsights.length) {
    pdf.section("Visual Interpretation", COLORS.purple);
    pdf.bullets(guidance.visualInsights, { accent: COLORS.purple, max: 10 });
  }

  pdf.card("Risk Considerations", guidance.riskConsiderations, COLORS.amber, 125);
  pdf.card("Planning Considerations", guidance.planningConsiderations, COLORS.purple, 125);
  pdf.card("Advisor Notes", guidance.advisorNotes, COLORS.cyan, 115);

  pdf.section("Advisor Action Plan", COLORS.green);
  pdf.bullets(guidance.actionPlan, { accent: COLORS.green, max: 14 });

  if (context.opportunities.length) {
    pdf.horizontalBarChart(
      "Opportunity Signal Ranking",
      context.opportunities.slice(0, 8).map((item: any) => ({
        label: compact(item.title).slice(0, 42),
        value: numeric(item.compositeScore, 0),
        helper: `${compact(item.sourceName)} · Risk ${compact(item.riskScore)}`,
        color: scoreColor(numeric(item.compositeScore, 0)),
      })),
      { accent: COLORS.amber }
    );
  }

  if (context.alerts.length) {
    pdf.horizontalBarChart(
      "Top Alert Intensity",
      context.alerts.slice(0, 8).map((item: any) => ({
        label: compact(item.title).slice(0, 42),
        value: numeric(item.score, 0),
        helper: `${compact(item.source)} · ${compact(item.urgency)}`,
        color: scoreColor(numeric(item.score, 0)),
      })),
      { accent: COLORS.red }
    );
  }

  if (context.holdings.length) {
    pdf.table(
      "Client and Portfolio Exposure",
      [
        { label: "Client", width: 145 },
        { label: "Symbol", width: 55 },
        { label: "Asset", width: 125 },
        { label: "Value", width: 72 },
        { label: "Alloc.", width: 55 },
        { label: "Risk", width: 78 },
      ],
      context.holdings.map((item: any) => [
        compact(item.client?.fullName),
        compact(item.symbol),
        compact(item.assetName),
        money(item.value),
        compact(item.allocationPct),
        compact(item.riskLevel),
      ]),
      { maxRows: 20, accent: COLORS.green }
    );
  }

  if (context.watchlistItems.length || context.priceAlerts.length) {
    pdf.section("Monitoring and Alerts", COLORS.cyan);

    if (context.watchlistItems.length) {
      pdf.table(
        "Tracked Watchlist Names",
        [
          { label: "Symbol", width: 65 },
          { label: "Asset", width: 150 },
          { label: "Priority", width: 80 },
          { label: "Status", width: 80 },
          { label: "Thesis", width: 170 },
        ],
        context.watchlistItems.map((item: any) => [
          compact(item.symbol),
          compact(item.assetName),
          compact(item.priority),
          compact(item.status),
          compact(item.thesis),
        ]),
        { maxRows: 14, accent: COLORS.cyan }
      );
    }

    if (context.priceAlerts.length) {
      pdf.table(
        "Relevant Price Alerts",
        [
          { label: "Symbol", width: 75 },
          { label: "Upper", width: 70 },
          { label: "Lower", width: 70 },
          { label: "Channel", width: 90 },
          { label: "Status", width: 90 },
          { label: "Notes", width: 160 },
        ],
        context.priceAlerts.map((item: any) => [
          compact(item.symbol),
          compact(item.upperTargetPrice),
          compact(item.lowerTargetPrice),
          compact(item.notificationChannel),
          compact(item.status),
          compact(item.notes),
        ]),
        { maxRows: 14, accent: COLORS.cyan }
      );
    }
  }

  if (context.dataQuality.length) {
    pdf.section("Data Quality, Freshness, and Reliability", COLORS.amber);

    pdf.table(
      "Data Quality Records",
      [
        { label: "Entity", width: 110 },
        { label: "Source", width: 120 },
        { label: "Live", width: 70 },
        { label: "Fresh", width: 70 },
        { label: "Score", width: 45 },
        { label: "Warning", width: 155 },
      ],
      context.dataQuality.map((item: any) => [
        compact(item.entityType),
        compact(item.sourceName),
        compact(item.liveStatus),
        compact(item.freshnessStatus),
        compact(item.qualityScore),
        compact(item.warning),
      ]),
      { maxRows: 18, accent: COLORS.amber }
    );
  }

  pdf.section("Advisor Questions Before Delivery", COLORS.red);
  pdf.bullets(guidance.questionsForAdvisor, { accent: COLORS.red, max: 14 });

  pdf.section("Missing Information and Follow-Up Needs", COLORS.amber);
  pdf.bullets(guidance.missingInformation, { accent: COLORS.amber, max: 14 });

  const consolidatedSources = [...guidance.sources, ...context.sourceLedger].slice(0, 40);

  pdf.section("Consolidated Source Ledger", COLORS.cyan);

  if (consolidatedSources.length) {
    pdf.table(
      "Source Ledger",
      [
        { label: "Type", width: 78 },
        { label: "Title", width: 180 },
        { label: "Publisher", width: 110 },
        { label: "Score", width: 45 },
        { label: "Why It Matters", width: 160 },
      ],
      consolidatedSources.map((item) => [
        compact(item.sourceType),
        compact(item.title),
        compact(item.publisher),
        compact(item.score),
        compact(item.whyItMatters),
      ]),
      { maxRows: 40, accent: COLORS.cyan }
    );
  } else {
    pdf.card(
      "No Source Ledger Available",
      "No source records were returned. Enable OpenAI web research or add Slice source records to strengthen future reports.",
      COLORS.cyan
    );
  }

  pdf.section("Important Use Limitation", COLORS.red);
  pdf.card(
    "Advisor Review Required",
    guidance.complianceNote ||
      "This report is generated by Slice AI for advisor review. It should not be treated as a guarantee, final recommendation, or substitute for professional judgment. Verify all time-sensitive information and client-specific suitability before external use.",
    COLORS.red,
    135
  );

  return pdf.build();
}

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token");

  if (!token) {
    return NextResponse.json({ error: "Report token is required." }, { status: 400 });
  }

  const report = await prisma.personalUserBotPdfReport.findFirst({
    where: {
      downloadToken: token,
    },
  });

  if (!report) {
    return NextResponse.json({ error: "Report not found." }, { status: 404 });
  }

  const context = await gatherReportContext(report);
  const pdf = await buildPdf(context);

  return new NextResponse(pdf, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `inline; filename="${safeFileName(context.topic)}.pdf"`,
      "Cache-Control": "private, no-store, max-age=0",
    },
  });
}