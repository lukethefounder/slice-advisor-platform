import { prisma } from "@/lib/prisma";

type GenerateBriefingInput = {
  userId: string;
  audience: string;
  briefType: string;
  clientId?: string;
  scope?: "Local" | "State" | "Country" | "Global";
  geography?: string;
  symbols?: string[];
  reportFocus?: string;
  technicalDepth?: "Executive" | "Standard" | "Institutional";
  timeframe?: "Daily" | "Weekly" | "Monthly" | "Quarterly";
  includeTechnicals?: boolean;
  includeMacro?: boolean;
  includeGlobal?: boolean;
  includeAlternatives?: boolean;
  includeMeetingAgenda?: boolean;
};

type DailyPoint = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

type TechnicalSnapshot = {
  type: "TechnicalSnapshot";
  symbol: string;
  provider: string;
  dataQuality: string;
  price: number | null;
  changePct: number | null;
  sma20: number | null;
  sma50: number | null;
  sma200: number | null;
  rsi14: number | null;
  macd: number | null;
  macdSignal: number | null;
  macdHistogram: number | null;
  volatility30Pct: number | null;
  drawdownFromHighPct: number | null;
  rangePositionPct: number | null;
  support: number | null;
  resistance: number | null;
  volumeRatio: number | null;
  technicalScore: number;
  technicalLabel: string;
  technicalReasons: string[];
  miniChart: Array<{
    date: string;
    close: number;
    sma20: number | null;
    sma50: number | null;
    volume: number;
  }>;
};

function safeJson(value: unknown) {
  return JSON.stringify(value);
}

function parseJsonArray(value: string | null | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function shortDate() {
  return new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function compactDate(date: Date) {
  return date.toISOString().slice(0, 10).replace(/-/g, "");
}

function sentenceList(items: string[]) {
  const clean = items.filter(Boolean);

  if (clean.length === 0) return "no major items";
  if (clean.length === 1) return clean[0];

  return `${clean.slice(0, -1).join(", ")} and ${clean[clean.length - 1]}`;
}

function money(value: number | string | null | undefined) {
  if (value === null || value === undefined || value === "") return "not entered";

  const parsed = typeof value === "number" ? value : Number(String(value).replace(/[$,]/g, ""));

  if (!Number.isFinite(parsed)) return String(value);

  if (Math.abs(parsed) >= 1_000_000_000) return `$${(parsed / 1_000_000_000).toFixed(2)}B`;
  if (Math.abs(parsed) >= 1_000_000) return `$${(parsed / 1_000_000).toFixed(2)}M`;

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(parsed);
}

function round(value: number, places = 2) {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

function average(values: number[]) {
  if (!values.length) return null;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function standardDeviation(values: number[]) {
  if (values.length < 2) return null;

  const avg = average(values);
  if (avg === null) return null;

  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function sma(values: number[], period: number) {
  if (values.length < period) return null;
  return average(values.slice(-period));
}

function ema(values: number[], period: number) {
  if (values.length < period) return null;

  const multiplier = 2 / (period + 1);
  let current = average(values.slice(0, period));

  if (current === null) return null;

  for (const value of values.slice(period)) {
    current = value * multiplier + current * (1 - multiplier);
  }

  return current;
}

function rsi(values: number[], period = 14) {
  if (values.length <= period) return null;

  const changes = values.slice(1).map((value, index) => value - values[index]);
  const recent = changes.slice(-period);
  const gains = recent.map((value) => Math.max(value, 0));
  const losses = recent.map((value) => Math.abs(Math.min(value, 0)));
  const avgGain = average(gains) ?? 0;
  const avgLoss = average(losses) ?? 0;

  if (avgLoss === 0) return 100;

  const rs = avgGain / avgLoss;
  return 100 - 100 / (1 + rs);
}

function macd(values: number[]) {
  if (values.length < 35) {
    return {
      macd: null,
      signal: null,
      histogram: null,
    };
  }

  const macdSeries: number[] = [];

  for (let index = 26; index <= values.length; index += 1) {
    const subset = values.slice(0, index);
    const ema12 = ema(subset, 12);
    const ema26 = ema(subset, 26);

    if (ema12 !== null && ema26 !== null) {
      macdSeries.push(ema12 - ema26);
    }
  }

  const latestMacd = macdSeries[macdSeries.length - 1] ?? null;
  const signal = ema(macdSeries, 9);
  const histogram = latestMacd !== null && signal !== null ? latestMacd - signal : null;

  return {
    macd: latestMacd,
    signal,
    histogram,
  };
}

function scoreLabel(score: number) {
  if (score >= 82) return "Constructive / decision-ready";
  if (score >= 68) return "Positive but needs confirmation";
  if (score >= 52) return "Mixed / watch";
  if (score >= 38) return "Weak / caution";
  return "High-risk technical posture";
}

function stooqSymbol(symbol: string) {
  const clean = symbol.trim().toLowerCase();

  if (!clean) return "";
  if (clean.includes(".")) return clean;

  return `${clean}.us`;
}

async function fetchStooqDailySeries(symbol: string): Promise<DailyPoint[]> {
  const end = new Date();
  const start = new Date();
  start.setDate(start.getDate() - 460);

  const url = `https://stooq.com/q/d/l/?s=${encodeURIComponent(stooqSymbol(symbol))}&d1=${compactDate(
    start
  )}&d2=${compactDate(end)}&i=d`;

  try {
    const response = await fetch(url, {
      cache: "no-store",
      headers: {
        accept: "text/csv,text/plain,*/*",
      },
    });

    if (!response.ok) return [];

    const text = await response.text();
    const rows = text.trim().split(/\r?\n/).slice(1);

    return rows
      .map((row) => {
        const [date, open, high, low, close, volume] = row.split(",");

        return {
          date,
          open: Number(open),
          high: Number(high),
          low: Number(low),
          close: Number(close),
          volume: Number(volume),
        };
      })
      .filter(
        (point) =>
          point.date &&
          Number.isFinite(point.open) &&
          Number.isFinite(point.high) &&
          Number.isFinite(point.low) &&
          Number.isFinite(point.close)
      )
      .sort((a, b) => a.date.localeCompare(b.date));
  } catch {
    return [];
  }
}

function buildTechnicalSnapshot(symbol: string, points: DailyPoint[]): TechnicalSnapshot {
  if (points.length < 30) {
    return {
      type: "TechnicalSnapshot",
      symbol,
      provider: "Stooq",
      dataQuality: "Unavailable or insufficient",
      price: null,
      changePct: null,
      sma20: null,
      sma50: null,
      sma200: null,
      rsi14: null,
      macd: null,
      macdSignal: null,
      macdHistogram: null,
      volatility30Pct: null,
      drawdownFromHighPct: null,
      rangePositionPct: null,
      support: null,
      resistance: null,
      volumeRatio: null,
      technicalScore: 35,
      technicalLabel: "Insufficient technical data",
      technicalReasons: [
        "Not enough daily price history was available from the free quote source.",
        "Use TradingView visual confirmation before making any meeting decision.",
      ],
      miniChart: [],
    };
  }

  const closes = points.map((point) => point.close);
  const highs = points.map((point) => point.high);
  const lows = points.map((point) => point.low);
  const volumes = points.map((point) => point.volume).filter(Number.isFinite);
  const latest = points[points.length - 1];
  const previous = points[points.length - 2];
  const price = latest.close;
  const changePct = previous?.close ? ((price - previous.close) / previous.close) * 100 : null;
  const sma20Value = sma(closes, 20);
  const sma50Value = sma(closes, 50);
  const sma200Value = sma(closes, 200);
  const rsi14Value = rsi(closes, 14);
  const macdValue = macd(closes);
  const trailing30 = closes.slice(-31);
  const returns30 = trailing30.slice(1).map((value, index) => ((value - trailing30[index]) / trailing30[index]) * 100);
  const vol30 = standardDeviation(returns30);
  const annualizedVol = vol30 === null ? null : vol30 * Math.sqrt(252);
  const high252 = Math.max(...highs.slice(-252));
  const low252 = Math.min(...lows.slice(-252));
  const support = Math.min(...lows.slice(-30));
  const resistance = Math.max(...highs.slice(-30));
  const drawdown = high252 ? ((price - high252) / high252) * 100 : null;
  const rangePosition = high252 !== low252 ? ((price - low252) / (high252 - low252)) * 100 : null;
  const avgVolume20 = average(volumes.slice(-20));
  const volumeRatio = avgVolume20 && latest.volume ? latest.volume / avgVolume20 : null;

  const technicalReasons: string[] = [];
  let score = 50;

  if (changePct !== null) {
    score += Math.max(-12, Math.min(12, changePct * 1.7));
    technicalReasons.push(`Latest daily move is ${round(changePct)}%.`);
  }

  if (sma20Value !== null) {
    if (price > sma20Value) {
      score += 8;
      technicalReasons.push("Price is above the 20-day moving average.");
    } else {
      score -= 6;
      technicalReasons.push("Price is below the 20-day moving average.");
    }
  }

  if (sma50Value !== null) {
    if (price > sma50Value) {
      score += 10;
      technicalReasons.push("Price is above the 50-day moving average.");
    } else {
      score -= 8;
      technicalReasons.push("Price is below the 50-day moving average.");
    }
  }

  if (sma20Value !== null && sma50Value !== null) {
    if (sma20Value > sma50Value) {
      score += 8;
      technicalReasons.push("20-day average is above the 50-day average.");
    } else {
      score -= 5;
      technicalReasons.push("20-day average is below the 50-day average.");
    }
  }

  if (sma200Value !== null) {
    if (price > sma200Value) {
      score += 8;
      technicalReasons.push("Price is above the 200-day moving average.");
    } else {
      score -= 9;
      technicalReasons.push("Price is below the 200-day moving average.");
    }
  }

  if (rsi14Value !== null) {
    if (rsi14Value >= 45 && rsi14Value <= 65) {
      score += 7;
      technicalReasons.push("RSI is constructive and not extremely extended.");
    } else if (rsi14Value < 30) {
      score -= 4;
      technicalReasons.push("RSI is oversold; potential rebound requires confirmation.");
    } else if (rsi14Value > 72) {
      score -= 8;
      technicalReasons.push("RSI is extended and may be vulnerable to mean reversion.");
    }
  }

  if (macdValue.histogram !== null) {
    if (macdValue.histogram > 0) {
      score += 7;
      technicalReasons.push("MACD histogram is positive.");
    } else {
      score -= 5;
      technicalReasons.push("MACD histogram is negative.");
    }
  }

  if (volumeRatio !== null && volumeRatio > 1.4) {
    score += 6;
    technicalReasons.push(`Volume is ${round(volumeRatio, 2)}x the 20-day average.`);
  }

  if (annualizedVol !== null && annualizedVol > 55) {
    score -= 8;
    technicalReasons.push("Volatility is elevated and requires position-size discipline.");
  }

  if (drawdown !== null && drawdown < -25) {
    score -= 6;
    technicalReasons.push(`Security is ${round(Math.abs(drawdown))}% below its 52-week high.`);
  }

  const technicalScore = Math.max(0, Math.min(100, Math.round(score)));

  const rollingCloses = points.map((point, index) => {
    const closeSlice = points.slice(0, index + 1).map((row) => row.close);

    return {
      date: point.date,
      close: round(point.close, 2),
      sma20: closeSlice.length >= 20 ? round(average(closeSlice.slice(-20)) ?? point.close, 2) : null,
      sma50: closeSlice.length >= 50 ? round(average(closeSlice.slice(-50)) ?? point.close, 2) : null,
      volume: point.volume,
    };
  });

  return {
    type: "TechnicalSnapshot",
    symbol,
    provider: "Stooq",
    dataQuality: "Free daily market data",
    price: round(price, price < 10 ? 4 : 2),
    changePct: changePct === null ? null : round(changePct, 2),
    sma20: sma20Value === null ? null : round(sma20Value, 2),
    sma50: sma50Value === null ? null : round(sma50Value, 2),
    sma200: sma200Value === null ? null : round(sma200Value, 2),
    rsi14: rsi14Value === null ? null : round(rsi14Value, 1),
    macd: macdValue.macd === null ? null : round(macdValue.macd, 4),
    macdSignal: macdValue.signal === null ? null : round(macdValue.signal, 4),
    macdHistogram: macdValue.histogram === null ? null : round(macdValue.histogram, 4),
    volatility30Pct: annualizedVol === null ? null : round(annualizedVol, 2),
    drawdownFromHighPct: drawdown === null ? null : round(drawdown, 2),
    rangePositionPct: rangePosition === null ? null : round(rangePosition, 2),
    support: round(support, 2),
    resistance: round(resistance, 2),
    volumeRatio: volumeRatio === null ? null : round(volumeRatio, 2),
    technicalScore,
    technicalLabel: scoreLabel(technicalScore),
    technicalReasons,
    miniChart: rollingCloses.slice(-90),
  };
}

async function buildTechnicalSnapshots(symbols: string[]) {
  const uniqueSymbols = Array.from(
    new Set(
      symbols
        .map((symbol) => symbol.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, ""))
        .filter(Boolean)
    )
  ).slice(0, 10);

  const snapshots: TechnicalSnapshot[] = [];

  for (const symbol of uniqueSymbols) {
    const series = await fetchStooqDailySeries(symbol);
    snapshots.push(buildTechnicalSnapshot(symbol, series));
  }

  return snapshots;
}

function scopeNarrative(input: GenerateBriefingInput) {
  const scope = input.scope ?? "Country";
  const geography = input.geography?.trim() || "United States";

  if (scope === "Local") {
    return `This report is scoped locally to ${geography}. Local scope should emphasize client geography, local business exposure, employment conditions, real estate pressure, municipal/state-specific policy, and nearby economic sensitivity before expanding to broader market context.`;
  }

  if (scope === "State") {
    return `This report is scoped at the state level for ${geography}. State scope should consider regional labor conditions, tax/policy shifts, public-company employment exposure, real estate, energy/utility impact, and sector concentration.`;
  }

  if (scope === "Global") {
    return `This report is scoped globally. Global scope should emphasize geopolitical risk, tariffs, currency and commodity pressure, global supply-chain fragility, war or sanctions risk, energy markets, and cross-border effects on client portfolios.`;
  }

  return `This report is scoped at the country level for ${geography}. Country scope should emphasize U.S. market structure, rates, inflation, labor, earnings, sector rotation, consumer health, fiscal policy, and national risk factors.`;
}

function technicalMeetingNarrative(snapshots: TechnicalSnapshot[]) {
  if (!snapshots.length) {
    return "No technical snapshots were generated. Add symbols to the report builder to include technical equity analysis.";
  }

  const best = snapshots.slice().sort((a, b) => b.technicalScore - a.technicalScore)[0];
  const weakest = snapshots.slice().sort((a, b) => a.technicalScore - b.technicalScore)[0];
  const averageScore = Math.round(
    snapshots.reduce((sum, item) => sum + item.technicalScore, 0) / snapshots.length
  );

  return `Technical analysis was generated for ${snapshots.length} security/securities. Average technical score is ${averageScore}/100. The strongest current setup is ${best.symbol} at ${best.technicalScore}/100 (${best.technicalLabel}). The weakest current setup is ${weakest.symbol} at ${weakest.technicalScore}/100 (${weakest.technicalLabel}). These scores should be used for meeting preparation and review, not as automatic trading instructions.`;
}

function riskLabel(score: number) {
  if (score >= 85) return "high-risk / aggressive";
  if (score >= 70) return "growth-oriented";
  if (score >= 50) return "balanced";
  return "conservative";
}

export async function generateBriefingReport(input: GenerateBriefingInput) {
  const user = await prisma.user.findUnique({
    where: { id: input.userId },
  });

  if (!user) {
    throw new Error("User not found.");
  }

  const [
    watchAssets,
    ventures,
    goals,
    researchNotes,
    alertEvents,
    headlineDecisions,
    insights,
    clients,
  ] = await Promise.all([
    prisma.watchAsset.findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: "desc" },
      take: 80,
    }),
    prisma.ventureProject.findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.investorGoal.findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: "desc" },
      take: 30,
    }),
    prisma.researchNote.findMany({
      where: { userId: input.userId },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
    prisma.alertEvent.findMany({
      where: { userId: input.userId },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 40,
    }),
    prisma.headlineDecision.findMany({
      where: { userId: input.userId },
      orderBy: [{ score: "desc" }, { createdAt: "desc" }],
      take: 40,
    }),
    prisma.investorInsight.findMany({
      where: { userId: input.userId },
      orderBy: [{ score: "asc" }, { createdAt: "desc" }],
      take: 20,
    }),
    prisma.clientProfile.findMany({
      where: { userId: input.userId },
      include: {
        holdings: true,
        notesList: {
          orderBy: { createdAt: "desc" },
          take: 8,
        },
        tasks: {
          orderBy: { createdAt: "desc" },
          take: 8,
        },
        reviews: {
          orderBy: { createdAt: "desc" },
          take: 5,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 40,
    }),
  ]);

  const selectedClient = input.clientId
    ? clients.find((client) => client.id === input.clientId)
    : null;

  if (input.clientId && !selectedClient) {
    throw new Error("Client not found.");
  }

  const criticalAlerts = alertEvents.filter((alert) => alert.urgency === "Critical");
  const highAlerts = alertEvents.filter((alert) => alert.urgency === "High");
  const unreadAlerts = alertEvents.filter((alert) => alert.status === "Unread");

  const tickersFromDecisions = headlineDecisions.flatMap((decision) =>
    parseJsonArray(decision.matchedTickersJson).map(String)
  );

  const tickersFromClient = selectedClient?.holdings.map((holding) => holding.symbol) ?? [];

  const requestedSymbols = input.symbols?.length
    ? input.symbols
    : Array.from(
        new Set([
          ...tickersFromClient,
          ...watchAssets.map((asset) => asset.ticker),
          ...alertEvents.map((alert) => alert.ticker).filter(Boolean).map(String),
          ...tickersFromDecisions,
        ])
      )
        .filter(Boolean)
        .slice(0, 8);

  const technicalSnapshots = input.includeTechnicals === false
    ? []
    : await buildTechnicalSnapshots(requestedSymbols);

  const topTickers = Array.from(
    new Set([
      ...requestedSymbols,
      ...watchAssets.map((asset) => asset.ticker),
      ...alertEvents.map((alert) => alert.ticker).filter(Boolean).map(String),
      ...tickersFromDecisions,
    ])
  )
    .filter(Boolean)
    .slice(0, 12);

  const topCategories = Array.from(
    new Set(headlineDecisions.map((decision) => decision.category))
  ).slice(0, 8);

  const activeGoals = goals.filter((goal) => goal.status !== "Complete");
  const highPriorityGoals = activeGoals.filter((goal) => goal.priority === "High");

  const cryptoItems = watchAssets.filter((asset) =>
    asset.assetType.toLowerCase().includes("crypto")
  );

  const alternativeCount = ventures.length + cryptoItems.length;
  const latestRiskReview = selectedClient?.reviews[0] ?? null;
  const scopeText = scopeNarrative(input);
  const technicalText = technicalMeetingNarrative(technicalSnapshots);

  const strongestTechnical = technicalSnapshots
    .slice()
    .sort((a, b) => b.technicalScore - a.technicalScore)[0];

  const weakestTechnical = technicalSnapshots
    .slice()
    .sort((a, b) => a.technicalScore - b.technicalScore)[0];

  const focusText = input.reportFocus?.trim()
    ? `Primary meeting focus: ${input.reportFocus.trim()}`
    : "Primary meeting focus was not customized; report is generated from available platform intelligence.";

  const executiveSummary = selectedClient
    ? `${focusText}. ${scopeText} ${selectedClient.fullName} has a ${selectedClient.riskProfile.toLowerCase()} risk profile, ${selectedClient.liquidityNeeds.toLowerCase()} liquidity needs, and a stated objective of "${selectedClient.objective}". Slice detected ${criticalAlerts.length} critical alert(s), ${highAlerts.length} high-priority alert(s), and ${headlineDecisions.length} retained market intelligence decision(s). ${technicalText}`
    : `${focusText}. ${scopeText} Slice reviewed ${watchAssets.length} watchlist asset(s), ${goals.length} investor goal(s), ${researchNotes.length} research note(s), ${ventures.length} private venture item(s), ${alertEvents.length} alert event(s), and ${technicalSnapshots.length} technical market snapshot(s). Current attention should focus on ${criticalAlerts.length} critical alert(s), ${highAlerts.length} high-priority alert(s), and the most material categories: ${sentenceList(topCategories)}. ${technicalText}`;

  const marketSummary = headlineDecisions.length || technicalSnapshots.length
    ? [
        headlineDecisions.length
          ? `Top retained market intelligence categories include ${sentenceList(topCategories)}. The most relevant tickers or symbols currently being surfaced are ${sentenceList(topTickers.map(String))}. Slice is retaining scored decisions that passed storage thresholds, rather than storing every headline.`
          : "No retained headline decisions are currently stored. Run triage to produce source-ranked market intelligence before future reports.",
        strongestTechnical
          ? `Technically, ${strongestTechnical.symbol} currently shows the strongest score at ${strongestTechnical.technicalScore}/100. Key reasons: ${strongestTechnical.technicalReasons.slice(0, 3).join(" ")}`
          : "",
        weakestTechnical
          ? `The weakest technical read is ${weakestTechnical.symbol} at ${weakestTechnical.technicalScore}/100. Meeting risk discussion should include this weaker setup if it is in client exposure.`
          : "",
      ]
        .filter(Boolean)
        .join(" ")
    : "No retained headline decisions or technical snapshots are currently available. Run triage and add symbols to improve future meeting reports.";

  const alertSummary = alertEvents.length
    ? `There are ${alertEvents.length} alert event(s), including ${unreadAlerts.length} unread item(s). Critical alerts: ${criticalAlerts.length}. High alerts: ${highAlerts.length}. The highest-scoring alert is "${alertEvents[0]?.title ?? "None"}" with a score of ${alertEvents[0]?.score ?? 0}.`
    : "No alert events are currently available. Run triage or opportunity radar before generating future reports.";

  const portfolioSummary = selectedClient
    ? `${selectedClient.fullName} currently has ${selectedClient.holdings.length} holding(s) saved in Slice. Portfolio value is ${money(selectedClient.portfolioValue)}. Holdings include ${sentenceList(selectedClient.holdings.slice(0, 10).map((holding) => holding.symbol))}. Meeting preparation should compare client exposure against the technical snapshots and recent alert events.`
    : `The advisor workspace currently tracks ${watchAssets.length} watchlist asset(s). Watchlist exposure includes ${sentenceList(watchAssets.slice(0, 10).map((asset) => `${asset.ticker} (${asset.assetType})`))}. For founder/advisor reporting, review technical outliers, critical alerts, and concentration around repeated tickers.`;

  const alternativeSummary =
    input.includeAlternatives === false
      ? "Alternative investment section was excluded by report settings."
      : alternativeCount > 0
        ? `Alternative exposure is being tracked separately. Slice found ${cryptoItems.length} crypto watch item(s) and ${ventures.length} private venture project(s). Private venture records are user-added only and should be treated as high-risk, illiquid, and not suitable for all investors.`
        : "No alternative investment exposure is currently being tracked. Crypto and private venture items should remain separated from the core portfolio if added later.";

  const riskSummary = selectedClient
    ? latestRiskReview
      ? `Most recent risk review: ${latestRiskReview.suitabilityStatus}, score ${latestRiskReview.score}/100, which maps to a ${riskLabel(latestRiskReview.score)} posture. Summary: ${latestRiskReview.summary}. Technical snapshots and alert scores should be reviewed against this client-specific risk posture before any recommendation discussion.`
      : `No formal risk review has been run for ${selectedClient.fullName}. Current profile is ${selectedClient.riskProfile}, liquidity needs are ${selectedClient.liquidityNeeds}, and horizon is ${selectedClient.timeHorizon}. Run a suitability review before making meeting decisions.`
    : insights.length
      ? `Investor insight checks identified ${insights.length} portfolio-health insight(s). The lowest-scoring item is "${insights[0]?.title}" with a score of ${insights[0]?.score}/100, which should be reviewed first. Scope is ${input.scope ?? "Country"} and geography is ${input.geography || "United States"}.`
      : "No investor insights are currently stored. Generate insights from the investor workspace after adding goals, watchlist items, research, and alerts.";

  const actionItems = [
    criticalAlerts.length > 0
      ? `Review ${criticalAlerts.length} critical alert(s) before making any meeting decision.`
      : null,
    highAlerts.length > 0
      ? `Review ${highAlerts.length} high-priority alert(s) for relevance.`
      : null,
    technicalSnapshots.length > 0
      ? `Review technical snapshots for ${technicalSnapshots.map((snapshot) => `${snapshot.symbol} (${snapshot.technicalScore})`).join(", ")}.`
      : null,
    strongestTechnical
      ? `Use ${strongestTechnical.symbol} as the strongest technical discussion point, but confirm with chart review before the meeting.`
      : null,
    weakestTechnical
      ? `Prepare risk language around ${weakestTechnical.symbol}, currently the weakest technical score in the report.`
      : null,
    selectedClient && !latestRiskReview
      ? `Run a suitability / risk review for ${selectedClient.fullName}.`
      : null,
    selectedClient && selectedClient.tasks.some((task) => task.status !== "Complete")
      ? `Complete open meeting task(s) for ${selectedClient.fullName}.`
      : null,
    highPriorityGoals.length > 0
      ? `Update progress on ${highPriorityGoals.length} high-priority goal(s).`
      : null,
    ventures.length > 0 && input.includeAlternatives !== false
      ? "Review private venture exposure separately from core portfolio decisions."
      : null,
    researchNotes.length < 3
      ? "Add more research notes to improve decision discipline."
      : null,
    input.scope === "Global"
      ? "Include global risk language around currencies, tariffs, sanctions, supply chains, energy, and geopolitical shocks."
      : null,
    "Do not treat this brief as a buy/sell recommendation. It is market intelligence and workflow support.",
  ].filter(Boolean) as string[];

  const sourceItems = [
    {
      type: "ReportMeta",
      scope: input.scope ?? "Country",
      geography: input.geography || "United States",
      audience: input.audience,
      briefType: input.briefType,
      timeframe: input.timeframe ?? input.briefType,
      technicalDepth: input.technicalDepth ?? "Standard",
      reportFocus: input.reportFocus ?? "",
      includeTechnicals: input.includeTechnicals !== false,
      includeMacro: input.includeMacro !== false,
      includeGlobal: input.includeGlobal !== false,
      includeAlternatives: input.includeAlternatives !== false,
      symbols: requestedSymbols,
      generatedAt: new Date().toISOString(),
    },
    ...technicalSnapshots,
    ...alertEvents.slice(0, 10).map((alert) => ({
      type: "Alert",
      title: alert.title,
      source: alert.source,
      ticker: alert.ticker,
      urgency: alert.urgency,
      score: alert.score,
      sourceUrl: alert.sourceUrl,
      aiBriefing: alert.aiBriefing,
    })),
    ...headlineDecisions.slice(0, 10).map((decision) => ({
      type: "HeadlineDecision",
      title: decision.title,
      source: decision.sourceName,
      category: decision.category,
      urgency: decision.urgency,
      score: decision.score,
      matchedTickers: parseJsonArray(decision.matchedTickersJson),
    })),
    ...researchNotes.slice(0, 8).map((note) => ({
      type: "ResearchNote",
      title: note.title,
      ticker: note.ticker,
      thesis: note.thesis,
      decision: note.decision,
      conviction: note.conviction,
      sourceLinks: note.sourceLinks,
    })),
  ];

  const title = selectedClient
    ? `${selectedClient.fullName} ${input.briefType} ${input.scope ?? "Country"} Report — ${shortDate()}`
    : `Slice ${input.audience} ${input.briefType} ${input.scope ?? "Country"} Report — ${shortDate()}`;

  const report = await prisma.briefingReport.create({
    data: {
      userId: input.userId,
      clientId: selectedClient?.id ?? null,
      title,
      audience: input.audience,
      briefType: input.briefType,
      executiveSummary,
      marketSummary,
      alertSummary,
      portfolioSummary,
      alternativeSummary,
      riskSummary,
      actionItemsJson: safeJson(actionItems),
      sourceItemsJson: safeJson(sourceItems),
    },
    include: {
      client: true,
    },
  });

  return report;
}