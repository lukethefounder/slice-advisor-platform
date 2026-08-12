import "server-only";

import { randomUUID } from "node:crypto";

import { ApiError } from "@/lib/api-route";
import {
  buildProfileForUser,
  getAdvisorSourcesForScan,
  scanPermittedSources,
  type ScanResult,
} from "@/lib/intelligence";
import { getAlphaVantageIntelligence } from "@/lib/intelligence/alpha-vantage-live";
import type { AlphaVantageIntelligenceResponse } from "@/lib/intelligence/alpha-vantage-types";
import { sendEmail } from "@/lib/integrations/email";
import {
  metricOptions,
  type AdvisorWatchlist,
  type MetricId,
  type Priority,
  type QualificationEvent,
  type WatchConstraint,
} from "@/lib/workspace-watchlists";
import {
  eligibleWatchlist,
  loadWatchlistWorkspace,
  requireStoredWatchlist,
  updateWatchlistScanResult,
} from "@/lib/watchlists/service";

const METRIC_LABELS = Object.fromEntries(
  metricOptions.map((metric) => [metric.id, metric.label]),
) as Record<MetricId, string>;
const PRIORITY_ORDER: Record<Priority, number> = {
  Monitor: 1,
  Important: 2,
  Critical: 3,
};
const INTELLIGENCE_CACHE_MS = 90_000;
const MAX_INTELLIGENCE_CACHE_USERS = 100;

type IntelligenceCacheEntry = {
  expiresAt: number;
  promise: Promise<ScanResult>;
};

declare global {
  // eslint-disable-next-line no-var
  var __sliceWatchlistIntelligenceCache:
    | Map<string, IntelligenceCacheEntry>
    | undefined;
}

const intelligenceCache =
  globalThis.__sliceWatchlistIntelligenceCache ??
  new Map<string, IntelligenceCacheEntry>();

globalThis.__sliceWatchlistIntelligenceCache = intelligenceCache;

type ObservedMetric = {
  value: number | null;
  display: string;
  source: string;
  asOf: string | null;
  available: boolean;
};

type SymbolEvaluation = {
  symbol: string;
  metrics: Record<MetricId, ObservedMetric>;
};

function clean(value: unknown, maximum = 1_000) {
  return String(value ?? "")
    .replace(/\u0000/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, maximum);
}

function number(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[$,%x,]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function compact(value: number | null, suffix = "") {
  if (value === null) return "Unavailable";
  return `${value.toLocaleString("en-US", {
    maximumFractionDigits: 2,
  })}${suffix}`;
}

function escapeHtml(value: unknown) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function intelligenceForSymbol(scan: ScanResult, symbol: string) {
  const items = [...scan.alertCandidates, ...scan.items].filter((item) =>
    item.matchedTickers.some((ticker) => ticker.toUpperCase() === symbol.toUpperCase()),
  );
  const score = items.reduce((maximum, item) => Math.max(maximum, item.score), 0);
  const content = items.map((item) => `${item.title} ${item.summary}`).join(" ").toLowerCase();
  const regulatoryRisk = /sec|regulatory|investigation|fraud|delisting|enforcement/.test(content)
    ? 100
    : 0;
  const haltRisk = /halt|suspension|suspended|trading pause/.test(content) ? 100 : 0;

  return {
    score,
    regulatoryRisk,
    haltRisk,
    overall: Math.max(score, regulatoryRisk, haltRisk),
    matches: items,
  };
}

function averageVolume(alpha: AlphaVantageIntelligenceResponse) {
  const bars = alpha.intraday?.bars ?? [];
  if (!bars.length) return null;
  return bars.reduce((sum, bar) => sum + bar.volume, 0) / bars.length;
}

function exponentialMovingAverage(values: number[], period: number) {
  if (values.length < period || period < 2) return null;

  const seed = values
    .slice(0, period)
    .reduce((sum, value) => sum + value, 0) / period;
  const multiplier = 2 / (period + 1);
  let ema = seed;

  for (const value of values.slice(period)) {
    ema = value * multiplier + ema * (1 - multiplier);
  }

  return Number.isFinite(ema) ? ema : null;
}

function macdFromIntraday(alpha: AlphaVantageIntelligenceResponse) {
  const closes = [...(alpha.intraday?.bars ?? [])]
    .sort((left, right) => Date.parse(left.timestamp) - Date.parse(right.timestamp))
    .map((bar) => bar.close)
    .filter((value) => Number.isFinite(value));

  const fast = exponentialMovingAverage(closes, 12);
  const slow = exponentialMovingAverage(closes, 26);

  if (fast === null || slow === null) return null;

  const value = fast - slow;
  return Number.isFinite(value) ? value : null;
}

function metricMap(
  alpha: AlphaVantageIntelligenceResponse,
  scan: ScanResult,
): Record<MetricId, ObservedMetric> {
  const symbol = alpha.symbol;
  const intel = intelligenceForSymbol(scan, symbol);
  const quote = alpha.quote;
  const technicals = alpha.technicals;
  const overview = alpha.overview;
  const newsScore = alpha.news
    ? Math.max(
        0,
        Math.min(
          100,
          50 + alpha.news.relevanceWeightedSentiment * 50,
        ),
      )
    : intel.score;
  const asOf = alpha.providerAsOf ?? alpha.retrievedAt;
  const observed = (
    value: number | null | undefined,
    display: string,
    source: string,
  ): ObservedMetric => ({
    value: value === null || value === undefined || !Number.isFinite(value) ? null : value,
    display,
    source,
    asOf,
    available: value !== null && value !== undefined && Number.isFinite(value),
  });
  const avgVolume = averageVolume(alpha);
  const macd = macdFromIntraday(alpha);
  const intelligenceScore = Math.max(newsScore, intel.overall);

  return {
    "last-price": observed(
      quote?.price,
      compact(quote?.price ?? null),
      "Alpha Vantage quote",
    ),
    "change-pct": observed(
      quote?.changePercent,
      compact(quote?.changePercent ?? null, "%"),
      "Alpha Vantage quote",
    ),
    volume: observed(
      quote?.volume,
      compact(quote?.volume ?? null),
      "Alpha Vantage quote",
    ),
    "avg-volume": observed(
      avgVolume,
      compact(avgVolume),
      "Alpha Vantage intraday bars",
    ),
    "rsi-14": observed(
      technicals?.rsi14,
      compact(technicals?.rsi14 ?? null),
      "Slice calculation from Alpha Vantage history",
    ),
    macd: observed(
      macd,
      compact(macd),
      "Slice MACD calculation from Alpha Vantage intraday closes",
    ),
    "sma-50": observed(
      technicals?.sma50,
      compact(technicals?.sma50 ?? null),
      "Slice calculation from Alpha Vantage history",
    ),
    "atr-14": observed(
      technicals?.averageTrueRange14,
      compact(technicals?.averageTrueRange14 ?? null),
      "Slice calculation from Alpha Vantage history",
    ),
    "market-cap": observed(
      overview?.marketCap,
      compact(overview?.marketCap ?? null),
      "Alpha Vantage company overview",
    ),
    "pe-ratio": observed(
      overview?.peRatio,
      compact(overview?.peRatio ?? null),
      "Alpha Vantage company overview",
    ),
    "dividend-yield": observed(
      overview ? overview.dividendYield * 100 : null,
      compact(overview ? overview.dividendYield * 100 : null, "%"),
      "Alpha Vantage company overview",
    ),
    "news-score": observed(
      newsScore,
      compact(newsScore),
      alpha.news ? "Alpha Vantage news sentiment" : "Slice permitted-source scan",
    ),
    "regulatory-risk": observed(
      intel.regulatoryRisk,
      intel.regulatoryRisk ? "Detected" : "Clear",
      "Slice permitted-source scan",
    ),
    "halt-risk": observed(
      intel.haltRisk,
      intel.haltRisk ? "Detected" : "Clear",
      "Slice permitted-source scan",
    ),
    "intelligence-score": observed(
      intelligenceScore,
      compact(intelligenceScore),
      "Slice intelligence synthesis",
    ),
  };
}

function threshold(value: string) {
  const labels: Record<string, number> = {
    critical: 100,
    high: 80,
    medium: 55,
    low: 25,
  };
  return labels[value.trim().toLowerCase()] ?? number(value);
}

function qualifies(constraint: WatchConstraint, observed: number | null) {
  const lower = threshold(constraint.value);
  const upper = threshold(constraint.upperValue);

  if (observed === null || lower === null) return false;

  if (constraint.condition === "above") return observed > lower;
  if (constraint.condition === "below") return observed < lower;
  if (constraint.condition === "moves-by") return Math.abs(observed) >= Math.abs(lower);
  if (constraint.condition === "crosses-above") return observed >= lower;
  if (constraint.condition === "crosses-below") return observed <= lower;
  if (constraint.condition === "news-at-least") return observed >= lower;
  if (constraint.condition === "between") {
    return upper !== null && observed >= lower && observed <= upper;
  }

  return false;
}

function thresholdDisplay(constraint: WatchConstraint) {
  if (constraint.condition === "between") {
    return `${constraint.value} to ${constraint.upperValue}`;
  }
  if (constraint.condition === "moves-by") return `±${constraint.value}`;
  return constraint.value;
}

function recentlyTriggered(
  key: string,
  events: QualificationEvent[],
  now = Date.now(),
) {
  const fourHoursAgo = now - 4 * 60 * 60_000;
  return events.some(
    (event) =>
      event.key === key &&
      Number.isFinite(Date.parse(event.createdAt)) &&
      Date.parse(event.createdAt) >= fourHoursAgo,
  );
}

function eventHtml(event: QualificationEvent, list: AdvisorWatchlist) {
  return `<div style="font-family:Inter,Arial,sans-serif;max-width:720px;margin:0 auto;color:#0f172a;">
    <div style="background:linear-gradient(135deg,#020617,#022c22,#065f46);padding:26px;border-radius:22px;color:white;">
      <div style="font-size:11px;text-transform:uppercase;letter-spacing:.16em;color:#6ee7b7;font-weight:800;">Slice watchlist qualification</div>
      <h1 style="margin:10px 0 0;font-size:28px;">${escapeHtml(event.symbol)} qualified for ${escapeHtml(list.name)}</h1>
      <p style="margin-top:12px;color:#d1fae5;line-height:1.65;">${escapeHtml(event.message)}</p>
    </div>
    <div style="margin-top:18px;border:1px solid #e5e7eb;border-radius:18px;padding:18px;line-height:1.7;">
      <div><strong>Metric:</strong> ${escapeHtml(event.metricLabel)}</div>
      <div><strong>Observed:</strong> ${escapeHtml(event.observedDisplay)}</div>
      <div><strong>Condition:</strong> ${escapeHtml(event.condition)}</div>
      <div><strong>Threshold:</strong> ${escapeHtml(event.thresholdDisplay)}</div>
      <div><strong>Priority:</strong> ${escapeHtml(event.priority)}</div>
      <div><strong>Checked:</strong> ${escapeHtml(event.createdAt)}</div>
    </div>
    <p style="margin-top:18px;color:#64748b;font-size:12px;line-height:1.6;">Review current source evidence, client suitability, and the firm's compliance process before communicating or taking action.</p>
  </div>`;
}

async function loadIntelligence(userId: string) {
  const now = Date.now();
  const cached = intelligenceCache.get(userId);

  if (cached && cached.expiresAt > now) {
    return cached.promise;
  }

  const promise = (async () => {
    const [profile, advisorSources] = await Promise.all([
      buildProfileForUser(userId),
      getAdvisorSourcesForScan(userId),
    ]);

    return scanPermittedSources(profile, advisorSources);
  })();

  intelligenceCache.set(userId, {
    expiresAt: now + INTELLIGENCE_CACHE_MS,
    promise,
  });

  if (intelligenceCache.size > MAX_INTELLIGENCE_CACHE_USERS) {
    const oldestKey = intelligenceCache.keys().next().value as
      | string
      | undefined;

    if (oldestKey) {
      intelligenceCache.delete(oldestKey);
    }
  }

  try {
    return await promise;
  } catch (error) {
    if (intelligenceCache.get(userId)?.promise === promise) {
      intelligenceCache.delete(userId);
    }

    throw error;
  }
}

async function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => Promise<R>,
) {
  const results = new Array<R>(values.length);
  let cursor = 0;

  async function worker() {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker()),
  );
  return results;
}

export async function runStoredWatchlistCheck(input: {
  userId: string;
  firmId: string;
  listId: string;
  signal?: AbortSignal;
  reportProgress?: (value: number, message: string) => Promise<void>;
}) {
  const { state, list } = await requireStoredWatchlist(input);

  if (!eligibleWatchlist(list)) {
    throw new ApiError({
      status: 409,
      code: "WATCHLIST_NOT_READY",
      message: `${list.name} needs an enabled list, at least one security, and an active rule.`,
      expose: true,
    });
  }

  await input.reportProgress?.(8, "Loading permitted intelligence sources");
  const scan = await loadIntelligence(input.userId);
  const activeConstraints = list.constraints.filter((constraint) => constraint.enabled).slice(0, 2);
  const now = new Date();
  const checkedAt = now.toISOString();
  const triggered: QualificationEvent[] = [];
  const evaluations = await mapWithConcurrency(
    list.items.slice(0, 20),
    4,
    async (item, index): Promise<SymbolEvaluation> => {
      if (input.signal?.aborted) throw new DOMException("Watchlist scan cancelled.", "AbortError");
      await input.reportProgress?.(
        15 + Math.round((index / Math.max(list.items.length, 1)) * 60),
        `Checking ${item.symbol}`,
      );
      const alpha = await getAlphaVantageIntelligence({
        symbol: item.symbol,
        interval: "5min",
      });

      return {
        symbol: item.symbol,
        metrics: metricMap(alpha, scan),
      };
    },
  );

  for (const item of list.items) {
    const evaluation = evaluations.find((candidate) => candidate.symbol === item.symbol);
    if (!evaluation) continue;
    const outcomes = activeConstraints.map((constraint) => ({
      constraint,
      observed: evaluation.metrics[constraint.metricId],
      passed: qualifies(constraint, evaluation.metrics[constraint.metricId].value),
    }));
    const listQualified =
      list.constraintJoin === "AND"
        ? outcomes.every((outcome) => outcome.passed)
        : outcomes.some((outcome) => outcome.passed);

    if (!listQualified) continue;

    for (const outcome of outcomes.filter((candidate) => candidate.passed)) {
      const key = [
        list.id,
        item.symbol,
        outcome.constraint.metricId,
        outcome.constraint.condition,
        outcome.constraint.value,
        outcome.constraint.upperValue,
      ].join(":");

      if (recentlyTriggered(key, state.events, now.getTime())) continue;

      const event: QualificationEvent = {
        id: `watch-event-${randomUUID()}`,
        key,
        listId: list.id,
        listName: list.name,
        symbol: item.symbol,
        tvSymbol: item.tvSymbol,
        metricId: outcome.constraint.metricId,
        metricLabel: METRIC_LABELS[outcome.constraint.metricId],
        observedDisplay: outcome.observed.display,
        condition: outcome.constraint.condition,
        thresholdDisplay: thresholdDisplay(outcome.constraint),
        priority: outcome.constraint.priority,
        emailSent: false,
        message: `${item.symbol} met ${METRIC_LABELS[outcome.constraint.metricId]} ${outcome.constraint.condition} ${thresholdDisplay(outcome.constraint)}. Observed ${outcome.observed.display}.`,
        createdAt: checkedAt,
      };

      if (list.notificationEmail) {
        const email = await sendEmail({
          to: list.notificationEmail,
          subject: `${outcome.constraint.priority}: ${item.symbol} qualified for ${list.name}`,
          text: event.message,
          html: eventHtml(event, list),
          idempotencyKey: `workspace-watchlist:${input.userId}:${key}:${Math.floor(now.getTime() / (4 * 60 * 60_000))}`,
        });
        event.emailSent = email.status === "sent";
        event.emailSkippedReason = email.ok
          ? email.status === "simulated"
            ? "Email delivery was simulated because live email is disabled."
            : undefined
          : email.error || "Email delivery failed.";
      } else {
        event.emailSkippedReason = "No notification email is configured for this watchlist.";
      }

      triggered.push(event);
    }
  }

  triggered.sort(
    (left, right) => PRIORITY_ORDER[right.priority] - PRIORITY_ORDER[left.priority],
  );
  const message = `${list.name}: checked ${list.items.length} securities and found ${triggered.length} new qualification${triggered.length === 1 ? "" : "s"}.`;

  await updateWatchlistScanResult({
    userId: input.userId,
    firmId: input.firmId,
    listId: list.id,
    checkedAt,
    status: "success",
    message,
    events: triggered,
  });
  await input.reportProgress?.(96, "Watchlist scan complete");

  return {
    ok: true,
    checkedAt,
    checkedSymbols: list.items.length,
    triggered,
    message,
    listId: list.id,
  };
}

export async function markStoredWatchlistCheckFailed(input: {
  userId: string;
  firmId: string;
  listId: string;
  error: unknown;
}) {
  const message =
    input.error instanceof Error
      ? clean(input.error.message, 800)
      : "Watchlist scan failed.";

  await updateWatchlistScanResult({
    userId: input.userId,
    firmId: input.firmId,
    listId: input.listId,
    checkedAt: new Date().toISOString(),
    status: "error",
    message,
  });

  return message;
}

export async function scanDueWatchlists(input: {
  userId: string;
  firmId: string;
}) {
  return loadWatchlistWorkspace(input);
}