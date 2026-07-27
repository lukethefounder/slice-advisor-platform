import "server-only";

import type {
  AdvisorBriefFundamentals,
  AdvisorBriefTechnical,
} from "@/lib/advisor-briefing/types";
import {
  type DailyBar,
  type JsonRecord,
  average,
  clamp,
  isRecord,
  nullableNumber,
  numberValue,
  round,
  cleanText,
} from "@/lib/advisor-briefing/shared";
import {
  alphaRequest,
} from "@/lib/advisor-briefing/alpha-market";

function parseDailyBars(payload: JsonRecord) {
  const series = isRecord(payload["Time Series (Daily)"])
    ? (payload["Time Series (Daily)"] as JsonRecord)
    : {};

  return Object.keys(series)
    .sort((left, right) => right.localeCompare(left))
    .flatMap((date) => {
      const record = isRecord(series[date])
        ? (series[date] as JsonRecord)
        : {};
      const close = numberValue(record["4. close"]);

      return close > 0
        ? [
            {
              date,
              open: numberValue(record["1. open"]),
              high: numberValue(record["2. high"]),
              low: numberValue(record["3. low"]),
              close,
              volume: numberValue(record["5. volume"]),
            } satisfies DailyBar,
          ]
        : [];
    });
}

function sma(values: number[], length: number) {
  return values.length >= length
    ? average(values.slice(0, length))
    : null;
}

function rsi(values: number[], length = 14) {
  if (values.length < length + 1) {
    return null;
  }

  const chronological = values.slice(0, length + 1).reverse();
  let gains = 0;
  let losses = 0;

  for (let index = 1; index < chronological.length; index += 1) {
    const change = chronological[index] - chronological[index - 1];

    if (change >= 0) {
      gains += change;
    } else {
      losses += Math.abs(change);
    }
  }

  if (losses === 0) {
    return gains === 0 ? 50 : 100;
  }

  const relativeStrength = gains / losses;
  return 100 - 100 / (1 + relativeStrength);
}

function standardDeviation(values: number[]) {
  if (values.length < 2) {
    return 0;
  }

  const mean = average(values);
  return Math.sqrt(
    average(values.map((value) => (value - mean) ** 2)),
  );
}

function higherIsBetter(value: number, low: number, high: number) {
  return clamp(((value - low) / Math.max(high - low, 0.0001)) * 100);
}

function lowerIsBetter(value: number, low: number, high: number) {
  return clamp(100 - higherIsBetter(value, low, high));
}

export function technicalFromBars(bars: DailyBar[]): AdvisorBriefTechnical {
  const closes = bars.map((bar) => bar.close);
  const volumes = bars.map((bar) => bar.volume).filter((value) => value > 0);
  const latest = closes[0] ?? 0;
  const sma20Value = sma(closes, 20);
  const sma50Value = sma(closes, 50);
  const sma200Value = sma(closes, 200);
  const rsiValue = rsi(closes);
  const momentum20Percent = closes[20]
    ? ((latest - closes[20]) / closes[20]) * 100
    : null;
  const momentum60Percent = closes[60]
    ? ((latest - closes[60]) / closes[60]) * 100
    : null;
  const returns = closes.slice(0, 21).flatMap((close, index) => {
    const prior = closes[index + 1];
    return prior && close > 0 && prior > 0
      ? [Math.log(close / prior)]
      : [];
  });
  const volatility20AnnualizedPercent = returns.length
    ? standardDeviation(returns) * Math.sqrt(252) * 100
    : null;
  const high60 = bars.length
    ? Math.max(...bars.slice(0, 60).map((bar) => bar.high))
    : latest;
  const drawdown60Percent = high60
    ? ((latest - high60) / high60) * 100
    : null;
  const volume5 = average(volumes.slice(0, 5));
  const volume20 = average(volumes.slice(5, 20));
  const volumeRatio5To20 = volume20 ? volume5 / volume20 : null;
  const trendScore = clamp(
    (sma20Value !== null && latest > sma20Value ? 26 : 8) +
      (sma50Value !== null && latest > sma50Value ? 26 : 8) +
      (sma200Value !== null && latest > sma200Value ? 26 : 8) +
      higherIsBetter(momentum20Percent ?? 0, -15, 25) * 0.22,
  );
  const momentumScore = clamp(
    higherIsBetter(momentum20Percent ?? 0, -20, 30) * 0.45 +
      higherIsBetter(momentum60Percent ?? 0, -30, 50) * 0.35 +
      higherIsBetter(rsiValue ?? 50, 30, 70) * 0.2,
  );
  const volumeScore = clamp(
    higherIsBetter(volumeRatio5To20 ?? 1, 0.5, 2),
  );
  const riskQualityScore = clamp(
    lowerIsBetter(volatility20AnnualizedPercent ?? 40, 12, 90) * 0.55 +
      lowerIsBetter(Math.abs(drawdown60Percent ?? 0), 0, 45) * 0.45,
  );

  return {
    asOf: bars[0]?.date ?? null,
    observations: bars.length,
    sma20: sma20Value,
    sma50: sma50Value,
    sma200: sma200Value,
    rsi14: rsiValue,
    momentum20Percent,
    momentum60Percent,
    volatility20AnnualizedPercent,
    drawdown60Percent,
    volumeRatio5To20,
    trendScore: round(trendScore),
    momentumScore: round(momentumScore),
    volumeScore: round(volumeScore),
    riskQualityScore: round(riskQualityScore),
  };
}

export async function loadTechnical(symbol: string) {
  const result = await alphaRequest(
    {
      function: "TIME_SERIES_DAILY",
      symbol,
      outputsize: "full",
    },
    {
      ttlMs: 15 * 60_000,
      staleTtlMs: 24 * 60 * 60_000,
    },
  );

  return {
    technical: technicalFromBars(parseDailyBars(result.payload)),
    retrievedAt: result.retrievedAt,
    stale: result.stale,
  };
}

function percentageValue(value: unknown) {
  const number = nullableNumber(value);
  return number === null ? null : Math.abs(number) <= 1 ? number * 100 : number;
}

function fundamentalScore(
  overview: AdvisorBriefFundamentals,
  price: number,
) {
  const valuation = clamp(
    lowerIsBetter(overview.peRatio ?? 25, 8, 45) * 0.45 +
      lowerIsBetter(overview.pegRatio ?? 2.5, 0.5, 4) * 0.25 +
      higherIsBetter(
        overview.analystTargetPrice && price
          ? ((overview.analystTargetPrice - price) / price) * 100
          : 0,
        -20,
        40,
      ) *
        0.3,
  );
  const quality = clamp(
    higherIsBetter(overview.profitMarginPercent ?? 0, 0, 35) * 0.3 +
      higherIsBetter(overview.operatingMarginPercent ?? 0, 0, 40) * 0.3 +
      higherIsBetter(overview.returnOnEquityPercent ?? 0, 0, 45) * 0.4,
  );
  const growth = clamp(
    higherIsBetter(overview.revenueGrowthPercent ?? 0, -10, 35) * 0.45 +
      higherIsBetter(overview.earningsGrowthPercent ?? 0, -15, 50) * 0.55,
  );

  return clamp(valuation * 0.35 + quality * 0.35 + growth * 0.3);
}

export async function loadFundamentals(symbol: string, price: number) {
  const result = await alphaRequest(
    {
      function: "OVERVIEW",
      symbol,
    },
    {
      ttlMs: 6 * 60 * 60_000,
      staleTtlMs: 48 * 60 * 60_000,
    },
  );
  const payload = result.payload;
  const fundamentals: AdvisorBriefFundamentals = {
    asOf: cleanText(payload.LatestQuarter, 30) || null,
    marketCapitalization: numberValue(payload.MarketCapitalization),
    peRatio: nullableNumber(payload.PERatio),
    pegRatio: nullableNumber(payload.PEGRatio),
    profitMarginPercent: percentageValue(payload.ProfitMargin),
    operatingMarginPercent: percentageValue(payload.OperatingMarginTTM),
    returnOnEquityPercent: percentageValue(payload.ReturnOnEquityTTM),
    revenueGrowthPercent: percentageValue(payload.QuarterlyRevenueGrowthYOY),
    earningsGrowthPercent: percentageValue(payload.QuarterlyEarningsGrowthYOY),
    analystTargetPrice: nullableNumber(payload.AnalystTargetPrice),
    beta: nullableNumber(payload.Beta),
    fundamentalScore: 50,
  };
  fundamentals.fundamentalScore = round(
    fundamentalScore(fundamentals, price),
  );

  return {
    companyName: cleanText(payload.Name, 300),
    fundamentals,
    retrievedAt: result.retrievedAt,
    stale: result.stale,
  };
}