import "server-only";

import type {
  AdvisorBriefIndustryDefinition,
} from "@/lib/advisor-briefing/universe";
import {
  type EconomicSeries,
  average,
  clamp,
  cleanText,
  higherIsBetter,
  isRecord,
  mapWithConcurrency,
  nullableNumber,
  round,
} from "@/lib/advisor-briefing/shared";
import {
  alphaRequest,
} from "@/lib/advisor-briefing/alpha-market";

export const ECONOMIC_SERIES = [
  {
    functionName: "REAL_GDP",
    label: "Real GDP",
    parameters: { interval: "quarterly" },
    positiveWhenRising: true,
    low: -2,
    high: 5,
  },
  {
    functionName: "CPI",
    label: "Consumer Price Index",
    parameters: { interval: "monthly" },
    positiveWhenRising: false,
    low: -1,
    high: 2,
  },
  {
    functionName: "UNEMPLOYMENT",
    label: "Unemployment Rate",
    parameters: {},
    positiveWhenRising: false,
    low: -0.5,
    high: 1,
  },
  {
    functionName: "FEDERAL_FUNDS_RATE",
    label: "Federal Funds Rate",
    parameters: { interval: "daily" },
    positiveWhenRising: false,
    low: -1,
    high: 1,
  },
  {
    functionName: "TREASURY_YIELD",
    label: "10-Year Treasury Yield",
    parameters: { interval: "daily", maturity: "10year" },
    positiveWhenRising: false,
    low: -1,
    high: 1,
  },
  {
    functionName: "RETAIL_SALES",
    label: "Retail Sales",
    parameters: {},
    positiveWhenRising: true,
    low: -5,
    high: 5,
  },
  {
    functionName: "DURABLES",
    label: "Durable Goods Orders",
    parameters: {},
    positiveWhenRising: true,
    low: -10,
    high: 10,
  },
  {
    functionName: "WTI",
    label: "WTI Crude Oil",
    parameters: { interval: "daily" },
    positiveWhenRising: true,
    low: -10,
    high: 10,
  },
] as const;

export async function loadEconomy() {
  const warnings: string[] = [];
  const series = await mapWithConcurrency(
    [...ECONOMIC_SERIES],
    4,
    async (definition): Promise<EconomicSeries | null> => {
      try {
        const result = await alphaRequest(
          {
            function: definition.functionName,
            ...definition.parameters,
          },
          {
            ttlMs: 15 * 60_000,
            staleTtlMs: 48 * 60 * 60_000,
          },
        );
        const data = Array.isArray(result.payload.data)
          ? (result.payload.data as unknown[])
              .filter(isRecord)
              .flatMap((point) => {
                const date = cleanText(point.date, 30);
                const value = nullableNumber(point.value);
                return date && value !== null ? [{ date, value }] : [];
              })
          : [];
        const latestValue = data[0]?.value ?? null;
        const previousValue = data[1]?.value ?? null;
        const change =
          latestValue !== null && previousValue !== null
            ? latestValue - previousValue
            : null;
        const changePercent =
          change !== null && previousValue
            ? (change / Math.abs(previousValue)) * 100
            : null;
        const normalized = higherIsBetter(
          changePercent ?? 0,
          definition.low,
          definition.high,
        );
        const score = definition.positiveWhenRising
          ? normalized
          : 100 - normalized;
        const ageDays = data[0]?.date
          ? Math.max(
              0,
              (Date.now() - Date.parse(data[0].date)) / 86_400_000,
            )
          : 999;
        const confidence = clamp(
          100 - Math.log2(ageDays + 1) * 8 + Math.min(data.length, 12),
        );

        if (result.stale) {
          warnings.push(`${definition.label} is using a cached release.`);
        }

        return {
          id: `alpha:economy:${definition.functionName}`,
          functionName: definition.functionName,
          label:
            cleanText(result.payload.name, 200) || definition.label,
          interval:
            cleanText(result.payload.interval, 50) ||
            ("interval" in definition.parameters
              ? definition.parameters.interval
              : "") ||
            "reported",
          unit: cleanText(result.payload.unit, 80),
          latestValue,
          previousValue,
          change,
          changePercent,
          asOf: data[0]?.date ?? null,
          score: round(score),
          confidence: round(confidence),
          retrievedAt: result.retrievedAt,
        };
      } catch (error) {
        warnings.push(
          `${definition.label} unavailable: ${
            error instanceof Error ? error.message : String(error)
          }`,
        );
        return null;
      }
    },
  );

  return {
    series: series.filter(
      (item): item is EconomicSeries => item !== null,
    ),
    warnings,
  };
}

function macroFactors(series: EconomicSeries[]) {
  const byName = new Map(
    series.map((item) => [item.functionName, item.score]),
  );
  const growth = average(
    ["REAL_GDP", "RETAIL_SALES", "DURABLES"]
      .filter((name) => byName.has(name))
      .map((name) => byName.get(name) ?? 50),
    50,
  );
  const rateRelief = average(
    ["FEDERAL_FUNDS_RATE", "TREASURY_YIELD"]
      .filter((name) => byName.has(name))
      .map((name) => byName.get(name) ?? 50),
    50,
  );
  const disinflation = byName.get("CPI") ?? 50;
  const energyStrength = byName.get("WTI") ?? 50;
  const consumerDemand = average(
    ["RETAIL_SALES", "UNEMPLOYMENT"]
      .filter((name) => byName.has(name))
      .map((name) => byName.get(name) ?? 50),
    50,
  );

  return {
    growth,
    rateRelief,
    disinflation,
    energyStrength,
    consumerDemand,
  };
}

export function industryMacroScore(
  definition: AdvisorBriefIndustryDefinition,
  series: EconomicSeries[],
) {
  const factors = macroFactors(series);
  const sensitivities = definition.macroSensitivity;
  const entries = [
    { score: factors.growth, sensitivity: sensitivities.growth },
    { score: factors.rateRelief, sensitivity: sensitivities.rateRelief },
    { score: factors.disinflation, sensitivity: sensitivities.disinflation },
    { score: factors.energyStrength, sensitivity: sensitivities.energyStrength },
    { score: factors.consumerDemand, sensitivity: sensitivities.consumerDemand },
  ];
  let weighted = 0;
  let total = 0;

  for (const entry of entries) {
    const magnitude = Math.abs(entry.sensitivity);

    if (!magnitude) {
      continue;
    }

    const aligned =
      entry.sensitivity >= 0 ? entry.score : 100 - entry.score;
    weighted += aligned * magnitude;
    total += magnitude;
  }

  return total ? clamp(weighted / total) : 50;
}