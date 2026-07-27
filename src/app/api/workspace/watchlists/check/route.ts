import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type ConstraintCondition =
  | "above"
  | "below"
  | "between"
  | "moves-by"
  | "crosses-above"
  | "crosses-below"
  | "news-at-least";

type ConstraintJoin = "AND" | "OR";
type Priority = "Monitor" | "Important" | "Critical";

type MetricId =
  | "last-price"
  | "change-pct"
  | "volume"
  | "avg-volume"
  | "rsi-14"
  | "macd"
  | "sma-50"
  | "atr-14"
  | "market-cap"
  | "pe-ratio"
  | "dividend-yield"
  | "news-score"
  | "regulatory-risk"
  | "halt-risk"
  | "intelligence-score";

type SecurityItem = {
  id: string;
  symbol: string;
  tvSymbol: string;
  label: string;
  assetType: string;
  note: string;
  addedAt: string;
};

type WatchConstraint = {
  id: string;
  metricId: MetricId;
  condition: ConstraintCondition;
  value: string;
  upperValue: string;
  priority: Priority;
  enabled: boolean;
};

type AdvisorWatchlist = {
  id: string;
  name: string;
  description: string;
  tone: string;
  notificationEmail: string;
  enabled: boolean;
  constraintJoin: ConstraintJoin;
  constraints: WatchConstraint[];
  items: SecurityItem[];
  createdAt: string;
  updatedAt: string;
};

type IntelligenceScan = {
  scannedAt?: string;
  alertCandidates?: Array<{
    id: string;
    title: string;
    summary: string;
    urgency: "Critical" | "High" | "Medium" | "Low" | "Suppressed";
    score: number;
    matchedTickers: string[];
    shouldAlert: boolean;
    sourceName: string;
    link: string;
  }>;
  items?: Array<{
    id: string;
    title: string;
    summary: string;
    urgency: "Critical" | "High" | "Medium" | "Low" | "Suppressed";
    score: number;
    matchedTickers: string[];
    shouldAlert: boolean;
    sourceName: string;
    link: string;
  }>;
};

type QualificationEvent = {
  id: string;
  key: string;
  listId: string;
  listName: string;
  symbol: string;
  tvSymbol: string;
  metricId: MetricId;
  metricLabel: string;
  observedDisplay: string;
  condition: string;
  thresholdDisplay: string;
  priority: Priority;
  emailSent: boolean;
  emailSkippedReason?: string;
  message: string;
  createdAt: string;
};

type MarketSnapshot = {
  ok: boolean;
  symbol: string;
  tvSymbol: string;
  provider: string;
  asOf: string | null;
  metrics: Record<
    string,
    {
      value: number | string | null;
      display: string;
      status: "live" | "chart" | "missing" | "review";
      source: string;
      asOf: string | null;
    }
  >;
};

const metricLabels: Record<MetricId, string> = {
  "last-price": "Last Price",
  "change-pct": "Change %",
  volume: "Volume",
  "avg-volume": "Average Volume",
  "rsi-14": "RSI 14",
  macd: "MACD",
  "sma-50": "50 SMA",
  "atr-14": "ATR 14",
  "market-cap": "Market Cap",
  "pe-ratio": "P/E Ratio",
  "dividend-yield": "Dividend Yield",
  "news-score": "News Score",
  "regulatory-risk": "Regulatory Risk",
  "halt-risk": "Halt Risk",
  "intelligence-score": "Intelligence Score",
};

const urgencyScores: Record<string, number> = {
  Critical: 100,
  High: 80,
  Medium: 55,
  Low: 25,
  Suppressed: 0,
};

function id(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function nowLabel() {
  return new Date().toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function parseNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;

  if (typeof value === "string") {
    const cleaned = value.replace(/[$,%x,]/g, "").trim();
    const parsed = Number(cleaned);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function thresholdToNumber(value: string) {
  const normalized = value.trim();

  if (urgencyScores[normalized] !== undefined) return urgencyScores[normalized];

  const lower = normalized.toLowerCase();

  if (lower === "critical") return 100;
  if (lower === "high") return 80;
  if (lower === "medium") return 55;
  if (lower === "low") return 25;

  return parseNumber(value);
}

function cleanList(input: unknown): AdvisorWatchlist | null {
  if (!input || typeof input !== "object") return null;

  const list = input as AdvisorWatchlist;

  if (!list.id || !list.name || !Array.isArray(list.items) || !Array.isArray(list.constraints)) return null;

  return {
    ...list,
    items: list.items.slice(0, 20),
    constraints: list.constraints.filter((constraint) => constraint.enabled).slice(0, 2),
    constraintJoin: list.constraintJoin === "AND" ? "AND" : "OR",
  };
}

function intelForSymbol(intelligence: IntelligenceScan | null, symbol: string) {
  const allItems = [...(intelligence?.alertCandidates || []), ...(intelligence?.items || [])];
  const matches = allItems.filter((item) =>
    item.matchedTickers?.some((ticker) => ticker.toUpperCase() === symbol.toUpperCase()),
  );

  const maxScore = matches.reduce((max, item) => Math.max(max, Number(item.score || 0)), 0);
  const maxUrgency = matches.reduce((max, item) => Math.max(max, urgencyScores[item.urgency] ?? 0), 0);
  const regulatoryRisk = matches.some((item) =>
    `${item.title} ${item.summary}`.toLowerCase().match(/sec|regulatory|investigation|fraud|delisting|enforcement/),
  )
    ? 100
    : 0;
  const haltRisk = matches.some((item) =>
    `${item.title} ${item.summary}`.toLowerCase().match(/halt|suspension|suspended|trading pause/),
  )
    ? 100
    : 0;

  return {
    matches,
    newsScore: Math.max(maxScore, maxUrgency),
    regulatoryRisk,
    haltRisk,
    intelligenceScore: Math.max(maxScore, regulatoryRisk, haltRisk),
  };
}

async function getIntelligenceFromRoute(origin: string) {
  try {
    const response = await fetch(`${origin}/api/intelligence/scan`, {
      cache: "no-store",
    });

    if (!response.ok) return null;

    return (await response.json()) as IntelligenceScan;
  } catch {
    return null;
  }
}

async function getMarketSnapshot(origin: string, item: SecurityItem, metricIds: MetricId[]) {
  const marketMetricIds = metricIds.filter(
    (metricId) => !["news-score", "regulatory-risk", "halt-risk", "intelligence-score"].includes(metricId),
  );

  if (!marketMetricIds.length) return null;

  try {
    const response = await fetch(
      `${origin}/api/custom-board/openai-market?symbol=${encodeURIComponent(item.symbol)}&tvSymbol=${encodeURIComponent(item.tvSymbol)}&metrics=${encodeURIComponent(marketMetricIds.join(","))}`,
      { cache: "no-store" },
    );

    if (!response.ok) return null;

    return (await response.json()) as MarketSnapshot;
  } catch {
    return null;
  }
}

function observedValue(
  metricId: MetricId,
  market: MarketSnapshot | null,
  intel: ReturnType<typeof intelForSymbol>,
) {
  if (metricId === "news-score") {
    return {
      value: intel.newsScore,
      display: String(intel.newsScore),
    };
  }

  if (metricId === "regulatory-risk") {
    return {
      value: intel.regulatoryRisk,
      display: intel.regulatoryRisk ? "Detected" : "Clear",
    };
  }

  if (metricId === "halt-risk") {
    return {
      value: intel.haltRisk,
      display: intel.haltRisk ? "Detected" : "Clear",
    };
  }

  if (metricId === "intelligence-score") {
    return {
      value: intel.intelligenceScore,
      display: String(intel.intelligenceScore),
    };
  }

  const metric = market?.metrics?.[metricId];
  const value = parseNumber(metric?.value ?? metric?.display);

  return {
    value,
    display: metric?.display || (value === null ? "—" : String(value)),
  };
}

function qualifies(condition: WatchConstraint, value: number | null) {
  const lower = thresholdToNumber(condition.value);
  const upper = thresholdToNumber(condition.upperValue);

  if (value === null || lower === null) return false;

  if (condition.condition === "above") return value > lower;
  if (condition.condition === "below") return value < lower;
  if (condition.condition === "moves-by") return Math.abs(value) >= Math.abs(lower);
  if (condition.condition === "crosses-above") return value >= lower;
  if (condition.condition === "crosses-below") return value <= lower;
  if (condition.condition === "news-at-least") return value >= lower;
  if (condition.condition === "between") {
    if (upper === null) return false;
    return value >= lower && value <= upper;
  }

  return false;
}

function thresholdDisplay(condition: WatchConstraint) {
  if (condition.condition === "between") {
    return `${condition.value} to ${condition.upperValue}`;
  }

  if (condition.condition === "moves-by") {
    return `±${condition.value}`;
  }

  return condition.value;
}

function recentlySent(eventKey: string, recentEvents: QualificationEvent[]) {
  const fourHoursAgo = Date.now() - 4 * 60 * 60 * 1000;

  return recentEvents.some((event) => {
    if (event.key !== eventKey) return false;

    const time = new Date(event.createdAt).getTime();
    if (Number.isNaN(time)) return false;

    return time >= fourHoursAgo;
  });
}

async function sendEmail({
  to,
  subject,
  body,
}: {
  to: string;
  subject: string;
  body: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;

  if (!apiKey) {
    return {
      sent: false,
      reason: "RESEND_API_KEY is not configured.",
    };
  }

  if (!to || !to.includes("@")) {
    return {
      sent: false,
      reason: "No valid notification email is set for this list.",
    };
  }

  const from = process.env.WATCHLIST_ALERTS_FROM_EMAIL || process.env.TEAM_INVITES_FROM_EMAIL || "Slice <onboarding@resend.dev>";

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to,
      subject,
      html: body,
    }),
  });

  if (!response.ok) {
    const text = await response.text();

    return {
      sent: false,
      reason: text.slice(0, 180),
    };
  }

  return {
    sent: true,
    reason: "",
  };
}

function emailHtml(event: QualificationEvent, list: AdvisorWatchlist) {
  return `
    <div style="font-family:Arial,sans-serif;background:#050505;color:#ffffff;padding:24px;border-radius:18px;">
      <div style="font-size:12px;letter-spacing:0.16em;text-transform:uppercase;color:#6ee7b7;font-weight:800;">
        Slice Watchlist Alert
      </div>
      <h1 style="margin:10px 0 4px;font-size:24px;">${event.symbol} qualified for ${list.name}</h1>
      <p style="color:#cbd5e1;line-height:1.6;">${event.message}</p>
      <div style="margin-top:16px;padding:14px;border:1px solid rgba(255,255,255,0.12);border-radius:14px;background:rgba(255,255,255,0.05);">
        <div><strong>Metric:</strong> ${event.metricLabel}</div>
        <div><strong>Observed:</strong> ${event.observedDisplay}</div>
        <div><strong>Condition:</strong> ${event.condition}</div>
        <div><strong>Threshold:</strong> ${event.thresholdDisplay}</div>
        <div><strong>Priority:</strong> ${event.priority}</div>
        <div><strong>Time:</strong> ${event.createdAt}</div>
      </div>
      <p style="margin-top:18px;color:#94a3b8;font-size:12px;line-height:1.6;">
        Review the live chart, Intelligence tab, and compliance process before sending any client-specific recommendation.
      </p>
    </div>
  `;
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const list = cleanList(body?.list);
  const recentEvents = Array.isArray(body?.recentEvents) ? (body.recentEvents as QualificationEvent[]) : [];
  const providedIntelligence = body?.intelligence as IntelligenceScan | null;
  const origin = new URL(request.url).origin;

  if (!list) {
    return NextResponse.json(
      {
        ok: false,
        message: "Invalid watchlist payload.",
        checkedAt: nowIso(),
        checkedSymbols: 0,
        triggered: [],
      },
      { status: 400 },
    );
  }

  if (!list.enabled) {
    return NextResponse.json({
      ok: true,
      message: `${list.name} is paused.`,
      checkedAt: nowIso(),
      checkedSymbols: 0,
      triggered: [],
    });
  }

  const intelligence = providedIntelligence || (await getIntelligenceFromRoute(origin));
  const activeConstraints = list.constraints.filter((constraint) => constraint.enabled).slice(0, 2);
  const metricIds = Array.from(new Set(activeConstraints.map((constraint) => constraint.metricId)));
  const triggered: QualificationEvent[] = [];

  for (const item of list.items.slice(0, 20)) {
    const market = await getMarketSnapshot(origin, item, metricIds);
    const intel = intelForSymbol(intelligence, item.symbol);

    const passedConstraints = activeConstraints
      .map((constraint) => {
        const observed = observedValue(constraint.metricId, market, intel);
        const pass = qualifies(constraint, parseNumber(observed.value));

        return {
          constraint,
          observed,
          pass,
        };
      })
      .filter((result) => result.pass);

    const listQualified =
      list.constraintJoin === "AND"
        ? passedConstraints.length === activeConstraints.length && activeConstraints.length > 0
        : passedConstraints.length > 0;

    if (!listQualified) continue;

    for (const result of passedConstraints) {
      const eventKey = `${list.id}:${item.tvSymbol}:${result.constraint.id}:${result.constraint.metricId}`;
      const duplicate = recentlySent(eventKey, recentEvents);

      let emailSent = false;
      let emailSkippedReason = duplicate ? "Cooldown active" : "";

      const event: QualificationEvent = {
        id: id("event"),
        key: eventKey,
        listId: list.id,
        listName: list.name,
        symbol: item.symbol,
        tvSymbol: item.tvSymbol,
        metricId: result.constraint.metricId,
        metricLabel: metricLabels[result.constraint.metricId],
        observedDisplay: result.observed.display,
        condition: result.constraint.condition,
        thresholdDisplay: thresholdDisplay(result.constraint),
        priority: result.constraint.priority,
        emailSent: false,
        emailSkippedReason,
        message: `${item.symbol} qualified: ${metricLabels[result.constraint.metricId]} ${result.constraint.condition.replace("-", " ")} ${thresholdDisplay(result.constraint)}. Observed ${result.observed.display}.`,
        createdAt: nowIso(),
      };

      if (!duplicate) {
        const email = await sendEmail({
          to: list.notificationEmail,
          subject: `Slice Alert: ${item.symbol} qualified for ${list.name}`,
          body: emailHtml(event, list),
        });

        emailSent = email.sent;
        emailSkippedReason = email.sent ? "" : email.reason;
      }

      triggered.push({
        ...event,
        emailSent,
        emailSkippedReason,
      });
    }
  }

  return NextResponse.json({
    ok: true,
    checkedAt: nowIso(),
    checkedSymbols: list.items.length,
    triggered,
    message: triggered.length
      ? `${triggered.length} qualification${triggered.length === 1 ? "" : "s"} found for ${list.name}.`
      : `No securities qualified for ${list.name}.`,
  });
}