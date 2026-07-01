import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type MetricValue = {
  value: number | string | null;
  display: string;
  status: "live" | "chart" | "missing" | "review";
  source: string;
  asOf: string | null;
};

type MarketSnapshot = {
  ok: boolean;
  symbol: string;
  tvSymbol: string;
  provider: string;
  asOf: string | null;
  session: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  volume: number | null;
  summary: string;
  metrics: Record<string, MetricValue>;
};

const CACHE_TTL_MS = 60_000;
const cache = new Map<string, { expiresAt: number; payload: MarketSnapshot }>();

const ALL_METRIC_IDS = [
  "last-price",
  "change",
  "change-pct",
  "open",
  "high",
  "low",
  "volume",
  "avg-volume",
  "rsi-14",
  "macd",
  "sma-20",
  "sma-50",
  "sma-200",
  "ema-21",
  "vwap",
  "atr-14",
  "beta",
  "market-cap",
  "pe-ratio",
  "eps",
  "dividend-yield",
  "52-week-high",
  "52-week-low",
  "directional-bias",
];

const CHART_MIRROR_METRICS = new Set([
  "rsi-14",
  "macd",
  "sma-20",
  "sma-50",
  "sma-200",
  "ema-21",
  "vwap",
  "atr-14",
]);

function cleanSymbol(value: string | null) {
  return (value || "AAPL")
    .toUpperCase()
    .replace(/[^A-Z0-9._/!\-$]/g, "")
    .slice(0, 32);
}

function cleanTvSymbol(value: string | null, symbol: string) {
  return (value || `NASDAQ:${symbol}`)
    .toUpperCase()
    .replace(/[^A-Z0-9:._/!\-$]/g, "")
    .slice(0, 48);
}

function cleanMetrics(value: string | null) {
  const requested = (value || "")
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
    .filter((item) => ALL_METRIC_IDS.includes(item));

  return Array.from(new Set(requested.length ? requested : ["last-price", "change-pct", "volume", "rsi-14", "macd", "sma-50", "atr-14", "directional-bias"]));
}

function emptyMetric(id: string, asOf: string): MetricValue {
  if (CHART_MIRROR_METRICS.has(id)) {
    return {
      value: null,
      display: "Chart",
      status: "chart",
      source: "TradingView chart",
      asOf,
    };
  }

  return {
    value: null,
    display: "—",
    status: "missing",
    source: "Unavailable",
    asOf,
  };
}

function fallbackSnapshot(symbol: string, tvSymbol: string, metricIds: string[], message: string): MarketSnapshot {
  const asOf = new Date().toISOString();

  return {
    ok: false,
    symbol,
    tvSymbol,
    provider: "Market rail",
    asOf,
    session: "Unavailable",
    price: null,
    change: null,
    changePct: null,
    volume: null,
    summary: message,
    metrics: Object.fromEntries(metricIds.map((id) => [id, emptyMetric(id, asOf)])),
  };
}

function extractText(payload: unknown) {
  const root = payload as {
    output_text?: string;
    output?: Array<{
      type?: string;
      content?: Array<{
        type?: string;
        text?: string;
      }>;
    }>;
  };

  if (typeof root.output_text === "string") return root.output_text;

  const chunks: string[] = [];

  for (const item of root.output || []) {
    for (const content of item.content || []) {
      if (typeof content.text === "string") chunks.push(content.text);
    }
  }

  return chunks.join("\n");
}

function extractJson(text: string) {
  const trimmed = text.trim();
  const fenced = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const candidate = fenced?.[1] || trimmed;
  const firstBrace = candidate.indexOf("{");
  const lastBrace = candidate.lastIndexOf("}");

  if (firstBrace >= 0 && lastBrace > firstBrace) {
    return candidate.slice(firstBrace, lastBrace + 1);
  }

  return candidate;
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

function compactDisplay(raw: unknown) {
  if (raw === null || raw === undefined) return "—";
  if (typeof raw === "number") return raw.toLocaleString(undefined, { maximumFractionDigits: 2 });
  if (typeof raw === "string" && raw.trim()) return raw.trim().slice(0, 24);
  return "—";
}

function metricValue(raw: unknown, id: string, asOf: string | null): MetricValue {
  const row = raw && typeof raw === "object" ? (raw as Record<string, unknown>) : {};
  const rawValue = row.value ?? row.display ?? null;
  const parsed =
    typeof rawValue === "string" && rawValue.trim() && Number.isNaN(Number(rawValue.replace(/[$,%x,]/g, "")))
      ? rawValue.trim()
      : parseNumber(rawValue);

  const display =
    typeof row.display === "string" && row.display.trim()
      ? row.display.trim().slice(0, 24)
      : compactDisplay(parsed);

  if (display === "—" && CHART_MIRROR_METRICS.has(id)) {
    return {
      value: null,
      display: "Chart",
      status: "chart",
      source: "TradingView chart",
      asOf,
    };
  }

  return {
    value: parsed,
    display,
    status: display === "—" ? "missing" : "live",
    source: typeof row.source === "string" && row.source.trim() ? row.source.trim().slice(0, 40) : "Market rail",
    asOf: typeof row.asOf === "string" && row.asOf.trim() ? row.asOf : asOf,
  };
}

function normalizeSnapshot(input: unknown, symbol: string, tvSymbol: string, metricIds: string[]): MarketSnapshot {
  const row = input && typeof input === "object" ? (input as Record<string, unknown>) : {};
  const asOf = typeof row.asOf === "string" ? row.asOf : new Date().toISOString();
  const rawMetrics = row.metrics && typeof row.metrics === "object" ? (row.metrics as Record<string, unknown>) : {};

  const metrics: Record<string, MetricValue> = {};

  for (const id of metricIds) {
    metrics[id] = metricValue(rawMetrics[id], id, asOf);
  }

  return {
    ok: true,
    symbol,
    tvSymbol,
    provider: "Market rail",
    asOf,
    session: typeof row.session === "string" ? row.session.slice(0, 40) : "Latest available",
    price: parseNumber(row.price),
    change: parseNumber(row.change),
    changePct: parseNumber(row.changePct),
    volume: parseNumber(row.volume),
    summary: typeof row.summary === "string" ? row.summary.slice(0, 180) : "Market rail synced.",
    metrics,
  };
}

export async function GET(request: Request) {
  const apiKey = process.env.OPENAI_API_KEY;
  const url = new URL(request.url);
  const symbol = cleanSymbol(url.searchParams.get("symbol"));
  const tvSymbol = cleanTvSymbol(url.searchParams.get("tvSymbol"), symbol);
  const metricIds = cleanMetrics(url.searchParams.get("metrics"));
  const cacheKey = `${symbol}:${tvSymbol}:${metricIds.join(",")}`;
  const cached = cache.get(cacheKey);

  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.payload);
  }

  if (!apiKey) {
    return NextResponse.json(
      fallbackSnapshot(symbol, tvSymbol, metricIds, "OPENAI_API_KEY is not configured."),
      { status: 503 },
    );
  }

  const metricSchema = Object.fromEntries(
    metricIds.map((id) => [
      id,
      {
        value: "number|string|null",
        display: "compact string",
        source: "source name",
        asOf: "timestamp or null",
      },
    ]),
  );

  const prompt = `
You power a compact financial advisor market rail.

Find the latest available market information for:
- Symbol: ${symbol}
- TradingView symbol: ${tvSymbol}

Only return the requested metrics:
${metricIds.join(", ")}

Important:
- Do not invent data.
- If the value is not available from current web sources, return value null and display "—".
- Technical chart-study values may be unavailable. Do not estimate them. If unavailable, return "—".
- Keep all display fields very compact, under 24 characters.
- Return JSON only.

Schema:
{
  "asOf": "ISO timestamp or source timestamp",
  "session": "regular / pre-market / after-hours / closed / latest",
  "price": number|null,
  "change": number|null,
  "changePct": number|null,
  "volume": number|null,
  "summary": "short sentence",
  "metrics": ${JSON.stringify(metricSchema)}
}
`;

  try {
    const response = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MARKET_MODEL || "gpt-5.5",
        tools: [
          {
            type: "web_search",
            search_context_size: "low",
            external_web_access: true,
          },
        ],
        tool_choice: "required",
        input: prompt,
        max_output_tokens: 1600,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      return NextResponse.json(
        fallbackSnapshot(symbol, tvSymbol, metricIds, `Market rail failed: ${errorText.slice(0, 180)}`),
        { status: response.status },
      );
    }

    const payload = await response.json();
    const text = extractText(payload);
    const jsonText = extractJson(text);
    const parsed = JSON.parse(jsonText);
    const normalized = normalizeSnapshot(parsed, symbol, tvSymbol, metricIds);

    cache.set(cacheKey, {
      expiresAt: Date.now() + CACHE_TTL_MS,
      payload: normalized,
    });

    return NextResponse.json(normalized);
  } catch (error) {
    return NextResponse.json(
      fallbackSnapshot(
        symbol,
        tvSymbol,
        metricIds,
        error instanceof Error ? error.message : "Unexpected market rail error.",
      ),
      { status: 500 },
    );
  }
}