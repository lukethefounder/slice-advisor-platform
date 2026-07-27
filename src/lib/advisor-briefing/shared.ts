import "server-only";

import type {
  AdvisorBriefIndustry,
  AdvisorBriefNewsItem,
  AdvisorBriefQuote,
  AdvisorBriefTechnical,
  AdvisorMarketBrief,
} from "@/lib/advisor-briefing/types";
import type {
  AdvisorBriefIndustryDefinition,
} from "@/lib/advisor-briefing/universe";

export const ALPHA_ENDPOINT =
  "https://www.alphavantage.co/query";
export const ALPHA_DOCUMENTATION =
  "https://www.alphavantage.co/documentation/";
export const BRIEF_TITLE_PREFIX =
  "Slice Advisor Market Brief";
export const PREFERENCE_SUBJECT_TYPE =
  "AdvisorBriefing";
export const PREFERENCE_SUBJECT_NAME =
  "Advisor Market Brief";
export const PREFERENCE_MEMORY_KEY =
  "deliverySchedule";
export const REPORT_MARKER =
  "ADVISOR_MARKET_BRIEF_V1";
export const METHODOLOGY_VERSION =
  "slice-advisor-brief-ranking-1.0.0";
export const MARKET_CACHE_MS =
  10 * 60_000;

export const INDUSTRY_WEIGHTS = {
  liveBreadthAndMomentum: 0.25,
  technicalTrendAndRisk: 0.28,
  newsSentimentAndFreshness: 0.2,
  macroIndustryAlignment: 0.17,
  liquidity: 0.1,
} as const;

export const SECURITY_WEIGHTS = {
  liveSessionMomentum: 0.2,
  technicalTrend: 0.2,
  multiPeriodMomentum: 0.15,
  volumeConfirmation: 0.1,
  newsSentimentAndFreshness: 0.15,
  fundamentalQualityAndGrowth: 0.15,
  riskQuality: 0.05,
} as const;

export type JsonRecord =
  Record<string, unknown>;

export type AlphaCacheEntry = {
  payload: JsonRecord;
  storedAt: number;
};

export type AlphaResult = {
  payload: JsonRecord;
  retrievedAt: string;
  stale: boolean;
};

export type DailyBar = {
  date: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
};

export type MarketStatus = {
  currentStatus: string;
  isOpen: boolean;
  region: string;
  exchanges: string;
  localOpen: string;
  localClose: string;
  notes: string;
  retrievedAt: string;
};

export type QuoteBatch = {
  quotes: Record<string, AdvisorBriefQuote>;
  requestedSymbols: number;
  returnedSymbols: number;
  coveragePercent: number;
  providerAsOf: string | null;
  retrievedAt: string;
  sourceFunction:
    | "REALTIME_BULK_QUOTES"
    | "GLOBAL_QUOTE_FALLBACK";
  warnings: string[];
};

export type NewsTickerDigest = {
  score: number;
  confidence: number;
  articleCount: number;
  items: AdvisorBriefNewsItem[];
};

export type NewsDigest = {
  score: number;
  confidence: number;
  articleCount: number;
  independentSourceCount: number;
  latestPublishedAt: string | null;
  items: AdvisorBriefNewsItem[];
  byTicker: Record<
    string,
    NewsTickerDigest
  >;
  retrievedAt: string;
  warnings: string[];
};

export type EconomicSeries = {
  id: string;
  functionName: string;
  label: string;
  interval: string;
  unit: string;
  latestValue: number | null;
  previousValue: number | null;
  change: number | null;
  changePercent: number | null;
  asOf: string | null;
  score: number;
  confidence: number;
  retrievedAt: string;
};

export type IndustryResearch = {
  definition:
    AdvisorBriefIndustryDefinition;
  technical:
    AdvisorBriefTechnical;
  news:
    NewsDigest;
  averageChangePercent:
    number;
  advancingSharePercent:
    number;
  quoteCoveragePercent:
    number;
  liveScore:
    number;
  technicalScore:
    number;
  newsScore:
    number;
  macroScore:
    number;
  liquidityScore:
    number;
  score:
    number;
  confidence:
    number;
  sourceIds:
    string[];
  warnings:
    string[];
};

export type BriefCache = {
  brief:
    AdvisorMarketBrief;
  storedAt:
    number;
};

export function clamp(
  value: number,
  minimum = 0,
  maximum = 100,
) {
  if (!Number.isFinite(value)) {
    return minimum;
  }

  return Math.max(
    minimum,
    Math.min(
      maximum,
      value,
    ),
  );
}

export function average(
  values: number[],
  fallback = 0,
) {
  return values.length
    ? values.reduce(
        (sum, value) =>
          sum + value,
        0,
      ) / values.length
    : fallback;
}

export function round(
  value: number,
  places = 2,
) {
  const multiplier =
    10 ** places;

  return (
    Math.round(
      value * multiplier,
    ) / multiplier
  );
}

export function cleanText(
  value: unknown,
  maximum = 4_000,
) {
  return typeof value ===
    "string"
    ? value
        .trim()
        .replace(
          /\s+/g,
          " ",
        )
        .slice(
          0,
          maximum,
        )
    : "";
}

export function numberValue(
  value: unknown,
  fallback = 0,
) {
  const parsed =
    Number(
      String(
        value ?? "",
      )
        .replace(
          /[$,%]/g,
          "",
        )
        .replace(
          /,/g,
          "",
        )
        .trim(),
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : fallback;
}

export function nullableNumber(
  value: unknown,
) {
  const parsed =
    numberValue(
      value,
      Number.NaN,
    );

  return Number.isFinite(
    parsed,
  )
    ? parsed
    : null;
}

export function uniqueStrings(
  values: string[],
  maximum = 50,
) {
  return Array.from(
    new Set(
      values
        .map(
          (value) =>
            value.trim(),
        )
        .filter(
          Boolean,
        ),
    ),
  ).slice(
    0,
    maximum,
  );
}

export function isRecord(
  value: unknown,
): value is JsonRecord {
  return (
    typeof value ===
      "object" &&
    value !== null &&
    !Array.isArray(
      value,
    )
  );
}

export function parseJson<T>(
  value: string,
  fallback: T,
): T {
  try {
    return JSON.parse(
      value,
    ) as T;
  } catch {
    return fallback;
  }
}

export async function mapWithConcurrency<
  T,
  R,
>(
  values: T[],
  concurrency: number,
  worker: (
    value: T,
    index: number,
  ) => Promise<R>,
) {
  const output =
    new Array<R>(
      values.length,
    );
  let nextIndex = 0;

  async function runWorker() {
    while (true) {
      const index =
        nextIndex;
      nextIndex += 1;

      if (
        index >=
        values.length
      ) {
        return;
      }

      output[index] =
        await worker(
          values[index],
          index,
        );
    }
  }

  await Promise.all(
    Array.from(
      {
        length:
          Math.max(
            1,
            Math.min(
              concurrency,
              values.length ||
                1,
            ),
          ),
      },
      () =>
        runWorker(),
    ),
  );

  return output;
}

export function parseAlphaTimestamp(
  value: unknown,
) {
  const raw =
    cleanText(
      value,
      64,
    );

  if (!raw) {
    return null;
  }

  const compact =
    raw.match(
      /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/,
    );

  if (compact) {
    const [
      ,
      year,
      month,
      day,
      hour,
      minute,
      second,
    ] = compact;

    return new Date(
      Date.UTC(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hour),
        Number(minute),
        Number(second),
      ),
    ).toISOString();
  }

  const normalized =
    raw.includes("T")
      ? raw
      : raw.replace(
          " ",
          "T",
        );
  const parsed =
    new Date(
      normalized.endsWith(
        "Z",
      )
        ? normalized
        : `${normalized}Z`,
    );

  return Number.isFinite(
    parsed.getTime(),
  )
    ? parsed.toISOString()
    : null;
}

export function latestTimestamp(
  values:
    Array<string | null>,
) {
  const timestamps =
    values
      .filter(
        (
          value,
        ): value is string =>
          Boolean(value),
      )
      .map(
        (value) =>
          Date.parse(
            value,
          ),
      )
      .filter(
        Number.isFinite,
      );

  return timestamps.length
    ? new Date(
        Math.max(
          ...timestamps,
        ),
      ).toISOString()
    : null;
}

export function higherIsBetter(
  value: number,
  low: number,
  high: number,
) {
  return clamp(
    ((value - low) /
      Math.max(
        high - low,
        0.0001,
      )) *
      100,
  );
}

export function lowerIsBetter(
  value: number,
  low: number,
  high: number,
) {
  return clamp(
    100 -
      higherIsBetter(
        value,
        low,
        high,
      ),
  );
}