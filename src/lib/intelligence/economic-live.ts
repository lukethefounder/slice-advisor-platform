import "server-only";

import type {
  EconomicResearchSnapshot,
  EconomicSeriesEvidence,
  EconomicSeriesPoint,
} from "@/lib/intelligence/research-swarm-types";

const ALPHA_ENDPOINT =
  "https://www.alphavantage.co/query";
const DEFAULT_STALE_CACHE_MS = 72 * 60 * 60_000;
const FUTURE_TOLERANCE_MS = 24 * 60 * 60_000;

type AlphaEconomicPayload = {
  name?: string;
  interval?: string;
  unit?: string;
  data?: Array<{
    date?: string;
    value?: string;
  }>;
  Information?: string;
  Note?: string;
  "Error Message"?: string;
};

type CacheEntry = {
  payload: AlphaEconomicPayload;
  storedAt: number;
};

type FetchResult = {
  payload: AlphaEconomicPayload;
  warning: string | null;
  cacheState:
    | "fresh-cache"
    | "network"
    | "stale-cache";
};

type SeriesDefinition = {
  functionName: string;
  label: string;
  description: string;
  parameters?: Record<string, string>;
  positiveWhenRising: boolean;
  baselineLow: number;
  baselineHigh: number;
  expectedCadence:
    | "daily"
    | "monthly"
    | "quarterly"
    | "annual";
  sectors: Record<string, number>;
};

declare global {
  // eslint-disable-next-line no-var
  var __sliceEconomicCache:
    | Map<string, CacheEntry>
    | undefined;
  // eslint-disable-next-line no-var
  var __sliceEconomicInflight:
    | Map<string, Promise<FetchResult>>
    | undefined;
}

const cache =
  globalThis.__sliceEconomicCache ??
  new Map<string, CacheEntry>();
const inflight =
  globalThis.__sliceEconomicInflight ??
  new Map<string, Promise<FetchResult>>();

globalThis.__sliceEconomicCache = cache;
globalThis.__sliceEconomicInflight = inflight;

const SERIES: SeriesDefinition[] = [
  {
    functionName: "REAL_GDP",
    label: "Real GDP",
    description:
      "Inflation-adjusted US economic output.",
    parameters: { interval: "quarterly" },
    positiveWhenRising: true,
    baselineLow: -2,
    baselineHigh: 5,
    expectedCadence: "quarterly",
    sectors: {
      default: 0.75,
      Technology: 0.75,
      Industrials: 1,
      ConsumerCyclical: 1,
      FinancialServices: 0.9,
      Utilities: 0.35,
      Healthcare: 0.45,
      Energy: 0.65,
    },
  },
  {
    functionName: "CPI",
    label: "Consumer Price Index",
    description:
      "Monthly US consumer price level.",
    parameters: { interval: "monthly" },
    positiveWhenRising: false,
    baselineLow: 0,
    baselineHigh: 8,
    expectedCadence: "monthly",
    sectors: {
      default: 0.7,
      Technology: 0.8,
      FinancialServices: 0.8,
      ConsumerCyclical: 0.9,
      ConsumerDefensive: 0.65,
      Utilities: 0.55,
      RealEstate: 0.85,
    },
  },
  {
    functionName: "INFLATION",
    label: "Annual Inflation",
    description: "Annual US inflation rate.",
    positiveWhenRising: false,
    baselineLow: 0,
    baselineHigh: 8,
    expectedCadence: "annual",
    sectors: {
      default: 0.75,
      Technology: 0.9,
      FinancialServices: 0.75,
      ConsumerCyclical: 0.85,
      RealEstate: 0.9,
      Energy: 0.4,
      BasicMaterials: 0.45,
    },
  },
  {
    functionName: "UNEMPLOYMENT",
    label: "Unemployment Rate",
    description:
      "Monthly US unemployment rate.",
    positiveWhenRising: false,
    baselineLow: 3,
    baselineHigh: 10,
    expectedCadence: "monthly",
    sectors: {
      default: 0.8,
      ConsumerCyclical: 1,
      FinancialServices: 0.8,
      Industrials: 0.85,
      Healthcare: 0.45,
      ConsumerDefensive: 0.5,
    },
  },
  {
    functionName: "FEDERAL_FUNDS_RATE",
    label: "Federal Funds Rate",
    description: "Effective US policy rate.",
    parameters: { interval: "daily" },
    positiveWhenRising: false,
    baselineLow: 0,
    baselineHigh: 8,
    expectedCadence: "daily",
    sectors: {
      default: 0.8,
      Technology: 1,
      RealEstate: 1,
      Utilities: 0.9,
      FinancialServices: 0.65,
      Energy: 0.55,
    },
  },
  {
    functionName: "TREASURY_YIELD",
    label: "10-Year Treasury Yield",
    description:
      "Daily 10-year US Treasury yield.",
    parameters: {
      interval: "daily",
      maturity: "10year",
    },
    positiveWhenRising: false,
    baselineLow: 0.5,
    baselineHigh: 7,
    expectedCadence: "daily",
    sectors: {
      default: 0.85,
      Technology: 1,
      RealEstate: 1,
      Utilities: 0.9,
      FinancialServices: 0.7,
      Industrials: 0.65,
    },
  },
  {
    functionName: "RETAIL_SALES",
    label: "Retail Sales",
    description:
      "Monthly US retail sales activity.",
    positiveWhenRising: true,
    baselineLow: -5,
    baselineHigh: 8,
    expectedCadence: "monthly",
    sectors: {
      default: 0.55,
      ConsumerCyclical: 1,
      ConsumerDefensive: 0.8,
      FinancialServices: 0.55,
      Technology: 0.5,
    },
  },
  {
    functionName: "DURABLES",
    label: "Durable Goods Orders",
    description:
      "Monthly US durable goods manufacturing demand.",
    positiveWhenRising: true,
    baselineLow: -10,
    baselineHigh: 15,
    expectedCadence: "monthly",
    sectors: {
      default: 0.55,
      Industrials: 1,
      BasicMaterials: 0.8,
      Technology: 0.65,
      ConsumerCyclical: 0.6,
    },
  },
  {
    functionName: "NONFARM_PAYROLL",
    label: "Nonfarm Payrolls",
    description:
      "Monthly US payroll employment.",
    positiveWhenRising: true,
    baselineLow: -500,
    baselineHigh: 750,
    expectedCadence: "monthly",
    sectors: {
      default: 0.75,
      ConsumerCyclical: 0.9,
      Industrials: 0.85,
      FinancialServices: 0.7,
      Healthcare: 0.6,
    },
  },
  {
    functionName: "WTI",
    label: "WTI Crude Oil",
    description:
      "West Texas Intermediate crude oil spot price.",
    parameters: { interval: "daily" },
    positiveWhenRising: true,
    baselineLow: -20,
    baselineHigh: 20,
    expectedCadence: "daily",
    sectors: {
      default: 0.35,
      Energy: 1,
      Industrials: 0.55,
      ConsumerCyclical: 0.55,
      Utilities: 0.4,
      BasicMaterials: 0.5,
    },
  },
  {
    functionName: "BRENT",
    label: "Brent Crude Oil",
    description: "Brent crude oil spot price.",
    parameters: { interval: "daily" },
    positiveWhenRising: true,
    baselineLow: -20,
    baselineHigh: 20,
    expectedCadence: "daily",
    sectors: {
      default: 0.35,
      Energy: 1,
      Industrials: 0.55,
      ConsumerCyclical: 0.55,
      BasicMaterials: 0.5,
    },
  },
  {
    functionName: "NATURAL_GAS",
    label: "Natural Gas",
    description:
      "Henry Hub natural gas spot price.",
    parameters: { interval: "daily" },
    positiveWhenRising: true,
    baselineLow: -25,
    baselineHigh: 25,
    expectedCadence: "daily",
    sectors: {
      default: 0.3,
      Energy: 1,
      Utilities: 0.75,
      Industrials: 0.45,
      BasicMaterials: 0.5,
    },
  },
];

function clamp(
  value: number,
  minimum = 0,
  maximum = 100,
) {
  if (!Number.isFinite(value)) return minimum;
  return Math.max(
    minimum,
    Math.min(maximum, value),
  );
}

function clean(
  value: unknown,
  maximumLength = 2_000,
) {
  return typeof value === "string"
    ? value
        .trim()
        .replace(/\s+/g, " ")
        .slice(0, maximumLength)
    : "";
}

function toNumber(value: unknown) {
  const parsed = Number(
    String(value ?? "").replace(/,/g, ""),
  );

  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSector(value: string) {
  const compact = value
    .replace(/[^A-Za-z]/g, "")
    .toLowerCase();
  const aliases: Record<string, string> = {
    technology: "Technology",
    informationtechnology: "Technology",
    communicationservices:
      "CommunicationServices",
    financialservices: "FinancialServices",
    financials: "FinancialServices",
    consumercyclical: "ConsumerCyclical",
    consumerdiscretionary:
      "ConsumerCyclical",
    consumerdefensive: "ConsumerDefensive",
    consumerstaples: "ConsumerDefensive",
    industrials: "Industrials",
    healthcare: "Healthcare",
    energy: "Energy",
    utilities: "Utilities",
    realestate: "RealEstate",
    basicmaterials: "BasicMaterials",
    materials: "BasicMaterials",
  };

  return aliases[compact] ?? "default";
}

function sensitivity(
  definition: SeriesDefinition,
  sector: string,
) {
  const key = normalizeSector(sector);

  return (
    definition.sectors[key] ??
    definition.sectors.default ??
    0.5
  );
}

function scoreSeries(input: {
  definition: SeriesDefinition;
  latest: number;
  previous: number;
  sector: string;
}) {
  const change = input.latest - input.previous;
  const changePercent = input.previous
    ? (change / Math.abs(input.previous)) * 100
    : 0;
  const sensitivityValue = sensitivity(
    input.definition,
    input.sector,
  );
  const normalizedChange = clamp(
    ((changePercent -
      input.definition.baselineLow) /
      Math.max(
        input.definition.baselineHigh -
          input.definition.baselineLow,
        0.0001,
      )) *
      100,
  );
  const directional =
    input.definition.positiveWhenRising
      ? normalizedChange
      : 100 - normalizedChange;
  const score = clamp(
    50 +
      (directional - 50) * sensitivityValue,
  );
  const directionDelta = score - 50;

  return {
    score,
    change,
    changePercent,
    direction:
      directionDelta >= 7
        ? ("improving" as const)
        : directionDelta <= -7
          ? ("deteriorating" as const)
          : ("stable" as const),
    industrySensitivity: sensitivityValue,
  };
}

function stableKey(
  definition: SeriesDefinition,
) {
  return JSON.stringify({
    function: definition.functionName,
    ...(definition.parameters ?? {}),
  });
}

function readProviderError(
  payload: AlphaEconomicPayload,
) {
  return (
    clean(payload["Error Message"]) ||
    clean(payload.Information) ||
    clean(payload.Note) ||
    null
  );
}

function configuredCacheMs(
  definition: SeriesDefinition,
) {
  const explicit = Number(
    process.env.ALPHA_VANTAGE_ECONOMIC_CACHE_MS,
  );

  if (Number.isFinite(explicit) && explicit > 0) {
    return clamp(
      explicit,
      60_000,
      7 * 24 * 60 * 60_000,
    );
  }

  switch (definition.expectedCadence) {
    case "daily":
      return 20 * 60_000;
    case "monthly":
      return 6 * 60 * 60_000;
    case "quarterly":
      return 24 * 60 * 60_000;
    case "annual":
      return 24 * 60 * 60_000;
  }
}

function configuredStaleCacheMs() {
  const explicit = Number(
    process.env.ALPHA_VANTAGE_ECONOMIC_STALE_CACHE_MS,
  );

  return Number.isFinite(explicit) && explicit > 0
    ? clamp(
        explicit,
        60 * 60_000,
        7 * 24 * 60 * 60_000,
      )
    : DEFAULT_STALE_CACHE_MS;
}

function concurrencyLimit() {
  const explicit = Number(
    process.env.ALPHA_VANTAGE_ECONOMIC_CONCURRENCY,
  );

  return Number.isFinite(explicit)
    ? Math.round(clamp(explicit, 1, 4))
    : 3;
}

function expectedReleaseAgeDays(
  cadence: SeriesDefinition["expectedCadence"],
) {
  switch (cadence) {
    case "daily":
      return 10;
    case "monthly":
      return 70;
    case "quarterly":
      return 190;
    case "annual":
      return 500;
  }
}

async function fetchSeries(
  definition: SeriesDefinition,
): Promise<FetchResult> {
  const apiKey = String(
    process.env.ALPHA_VANTAGE_API_KEY ?? "",
  ).trim();

  if (!apiKey) {
    throw new Error(
      "ALPHA_VANTAGE_API_KEY is not configured.",
    );
  }

  const key = stableKey(definition);
  const current = cache.get(key);
  const now = Date.now();
  const ttlMs = configuredCacheMs(definition);

  if (
    current &&
    now - current.storedAt <= ttlMs
  ) {
    return {
      payload: current.payload,
      warning: null,
      cacheState: "fresh-cache",
    };
  }

  const existing = inflight.get(key);

  if (existing) return existing;

  const request = (async () => {
    const url = new URL(ALPHA_ENDPOINT);
    url.searchParams.set(
      "function",
      definition.functionName,
    );
    url.searchParams.set("apikey", apiKey);

    for (const [name, value] of Object.entries(
      definition.parameters ?? {},
    )) {
      url.searchParams.set(name, value);
    }

    try {
      const controller = new AbortController();
      const timeout = setTimeout(
        () => controller.abort(),
        9_000,
      );

      try {
        const response = await fetch(url, {
          cache: "no-store",
          signal: controller.signal,
          headers: {
            Accept: "application/json",
            "User-Agent":
              "SliceEconomicResearch/2.0",
          },
        });

        if (!response.ok) {
          throw new Error(
            `${definition.functionName} returned HTTP ${response.status}.`,
          );
        }

        const payload =
          (await response.json()) as AlphaEconomicPayload;
        const providerError =
          readProviderError(payload);

        if (providerError) {
          throw new Error(providerError);
        }

        cache.set(key, {
          payload,
          storedAt: Date.now(),
        });

        return {
          payload,
          warning: null,
          cacheState: "network" as const,
        };
      } finally {
        clearTimeout(timeout);
      }
    } catch (error) {
      if (
        current &&
        now - current.storedAt <=
          configuredStaleCacheMs()
      ) {
        return {
          payload: current.payload,
          warning: `${definition.label} is using a previously verified provider response because the current request failed: ${
            error instanceof Error
              ? error.message
              : String(error)
          }`,
          cacheState:
            "stale-cache" as const,
        };
      }

      throw error;
    } finally {
      inflight.delete(key);
    }
  })();

  inflight.set(key, request);
  return request;
}

function normalizeData(
  payload: AlphaEconomicPayload,
  retrievedAt: string,
) {
  const now = Date.parse(retrievedAt);
  const seen = new Set<string>();

  return (payload.data ?? [])
    .flatMap((point) => {
      const value = toNumber(point.value);
      const date = clean(point.date, 32);
      const timestamp = Date.parse(date);

      if (
        value === null ||
        !date ||
        !Number.isFinite(timestamp) ||
        timestamp > now + FUTURE_TOLERANCE_MS ||
        seen.has(date)
      ) {
        return [];
      }

      seen.add(date);
      return [{ date, value }];
    })
    .sort(
      (left, right) =>
        Date.parse(right.date) -
        Date.parse(left.date),
    )
    .slice(0, 36);
}

function parseSeries(
  definition: SeriesDefinition,
  fetched: FetchResult,
  sector: string,
  retrievedAt: string,
): EconomicSeriesEvidence {
  const data: EconomicSeriesPoint[] =
    normalizeData(fetched.payload, retrievedAt);
  const latest = data[0]?.value ?? null;
  const previous = data[1]?.value ?? null;
  const scored =
    latest !== null && previous !== null
      ? scoreSeries({
          definition,
          latest,
          previous,
          sector,
        })
      : null;
  const ageDays = data[0]?.date
    ? Math.max(
        0,
        (Date.parse(retrievedAt) -
          Date.parse(data[0].date)) /
          86_400_000,
      )
    : 999;
  const expectedAge = expectedReleaseAgeDays(
    definition.expectedCadence,
  );
  const releaseWarning =
    ageDays > expectedAge
      ? `${definition.label} latest release is ${Math.round(
          ageDays,
        )} days old, beyond the expected ${expectedAge}-day freshness threshold.`
      : null;
  const freshnessConfidence = clamp(
    100 -
      Math.log2(ageDays + 1) *
        (definition.expectedCadence === "daily"
          ? 12
          : definition.expectedCadence ===
              "monthly"
            ? 5
            : 2.5),
  );
  const confidence = clamp(
    freshnessConfidence * 0.55 +
      (data.length >= 12
        ? 100
        : (data.length / 12) * 100) *
        0.25 +
      sensitivity(definition, sector) *
        100 *
        0.2,
  );
  const warning = [
    fetched.warning,
    releaseWarning,
  ]
    .filter(Boolean)
    .join(" ");

  return {
    id: `alpha-economy:${definition.functionName}`,
    functionName: definition.functionName,
    label:
      clean(fetched.payload.name, 300) ||
      definition.label,
    description: definition.description,
    interval:
      clean(fetched.payload.interval, 80) ||
      definition.parameters?.interval ||
      definition.expectedCadence,
    unit: clean(fetched.payload.unit, 100),
    source:
      "Alpha Vantage economic indicator",
    sourceUrl:
      "https://www.alphavantage.co/documentation/",
    asOf: data[0]?.date ?? null,
    retrievedAt,
    latestValue: latest,
    previousValue: previous,
    change: scored?.change ?? null,
    changePercent:
      scored?.changePercent ?? null,
    direction: scored?.direction ?? "unknown",
    score: Math.round(scored?.score ?? 50),
    confidence: Math.round(
      warning ? confidence * 0.82 : confidence,
    ),
    industrySensitivity:
      scored?.industrySensitivity ??
      sensitivity(definition, sector),
    data,
    warning: warning || null,
  };
}

function weightedAverage(
  values: Array<{
    value: number;
    weight: number;
  }>,
  fallback = 50,
) {
  const totalWeight = values.reduce(
    (sum, item) => sum + item.weight,
    0,
  );

  return totalWeight
    ? values.reduce(
        (sum, item) =>
          sum + item.value * item.weight,
        0,
      ) / totalWeight
    : fallback;
}

function deriveRegime(
  series: EconomicSeriesEvidence[],
) {
  const scoreByFunction = new Map(
    series.map((item) => [
      item.functionName,
      item.score,
    ]),
  );
  const inflation = weightedAverage(
    [
      scoreByFunction.has("CPI")
        ? {
            value:
              100 -
              (scoreByFunction.get("CPI") ?? 50),
            weight: 1,
          }
        : null,
      scoreByFunction.has("INFLATION")
        ? {
            value:
              100 -
              (scoreByFunction.get(
                "INFLATION",
              ) ?? 50),
            weight: 1,
          }
        : null,
    ].filter(
      (
        item,
      ): item is {
        value: number;
        weight: number;
      } => Boolean(item),
    ),
  );
  const growth = weightedAverage(
    [
      "REAL_GDP",
      "RETAIL_SALES",
      "DURABLES",
      "NONFARM_PAYROLL",
    ]
      .filter((id) =>
        scoreByFunction.has(id),
      )
      .map((id) => ({
        value:
          scoreByFunction.get(id) ?? 50,
        weight: 1,
      })),
  );
  const liquidity = weightedAverage(
    [
      "FEDERAL_FUNDS_RATE",
      "TREASURY_YIELD",
    ]
      .filter((id) =>
        scoreByFunction.has(id),
      )
      .map((id) => ({
        value:
          scoreByFunction.get(id) ?? 50,
        weight: 1,
      })),
  );

  if (inflation >= 65 && liquidity <= 45) {
    return "High Inflation" as const;
  }
  if (liquidity <= 30) {
    return "Liquidity Stress" as const;
  }
  if (growth >= 65) {
    return "Expansion" as const;
  }
  if (growth >= 52) {
    return "Slowing Expansion" as const;
  }
  if (growth <= 38) {
    return "Contraction Risk" as const;
  }

  return "Balanced" as const;
}

async function runPool<T, R>(
  values: T[],
  concurrency: number,
  worker: (value: T) => Promise<R>,
) {
  const output =
    new Array<PromiseSettledResult<R>>(
      values.length,
    );
  let nextIndex = 0;

  async function runner() {
    while (true) {
      const index = nextIndex;
      nextIndex += 1;

      if (index >= values.length) return;

      try {
        output[index] = {
          status: "fulfilled",
          value: await worker(values[index]),
        };
      } catch (reason) {
        output[index] = {
          status: "rejected",
          reason,
        };
      }
    }
  }

  await Promise.all(
    Array.from(
      {
        length: Math.min(
          concurrency,
          values.length,
        ),
      },
      () => runner(),
    ),
  );

  return output;
}

export async function getEconomicResearch(input: {
  sector: string;
  industry: string;
}): Promise<EconomicResearchSnapshot> {
  const retrievedAt = new Date().toISOString();

  if (
    !String(
      process.env.ALPHA_VANTAGE_API_KEY ?? "",
    ).trim()
  ) {
    return {
      schemaVersion:
        "slice-economic-research-1.0.0",
      retrievedAt,
      sector: input.sector,
      industry: input.industry,
      score: 50,
      confidence: 0,
      regime: "Balanced",
      series: [],
      warnings: [
        "ALPHA_VANTAGE_API_KEY is not configured; economic evidence was neutralized rather than simulated.",
      ],
    };
  }

  const settled = await runPool(
    SERIES,
    concurrencyLimit(),
    async (definition) => {
      const fetched =
        await fetchSeries(definition);

      return parseSeries(
        definition,
        fetched,
        input.sector,
        retrievedAt,
      );
    },
  );
  const series: EconomicSeriesEvidence[] = [];
  const warnings: string[] = [];

  settled.forEach((result, index) => {
    if (result.status === "fulfilled") {
      series.push(result.value);

      if (result.value.warning) {
        warnings.push(result.value.warning);
      }
    } else {
      warnings.push(
        `${SERIES[index]?.label ?? "Economic series"} unavailable: ${
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason)
        }`,
      );
    }
  });

  series.sort(
    (left, right) =>
      right.industrySensitivity *
        right.confidence -
      left.industrySensitivity *
        left.confidence,
  );

  const score = weightedAverage(
    series.map((item) => ({
      value: item.score,
      weight: Math.max(
        item.industrySensitivity *
          item.confidence,
        1,
      ),
    })),
  );
  const confidence = weightedAverage(
    series.map((item) => ({
      value: item.confidence,
      weight: Math.max(
        item.industrySensitivity,
        0.1,
      ),
    })),
    0,
  );

  return {
    schemaVersion:
      "slice-economic-research-1.0.0",
    retrievedAt,
    sector: input.sector,
    industry: input.industry,
    score: Math.round(score),
    confidence: Math.round(confidence),
    regime: deriveRegime(series),
    series,
    warnings: Array.from(new Set(warnings)),
  };
}