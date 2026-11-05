import "server-only";
import { readCanonical } from "./service";
import { selectHorizon } from "./contracts";
/** Compatibility shape for the existing Market Visuals tabs. No independent forecast calculation. */
export async function legacyMarketForecast(userId: string, symbol: string, horizonId = "2-5d", researchRunId?: string | null) {
  const b = await readCanonical(userId, symbol, researchRunId), h = b ? selectHorizon(b, horizonId) : null;
  const points: Array<{ step: number; date: string; label: string; projected: number; lower: number; upper: number; bearish: number; bullish: number }> = [];
  if (b && h) {
    points.push({ step: 0, date: b.asOf, label: "Stored reference", projected: b.market.price, lower: b.market.price, upper: b.market.price, bearish: b.market.price, bullish: b.market.price });
    points.push({ step: 1, date: b.targets[h.horizon] ?? b.asOf, label: h.label, projected: h.expectedPrice, lower: h.expectedPriceRange.low, upper: h.expectedPriceRange.high, bearish: h.expectedPriceRange.low, bullish: h.expectedPriceRange.high });
  }
  return { points, horizon: points.length ? 1 : 0, confidenceLevel: 0,
    probabilityUp: h?.positiveReturnProbability ?? null, probabilityDown: h ? 100 - h.positiveReturnProbability : null,
    expectedMovePct: h?.expectedReturnPercent ?? null, lowerMovePct: h?.expectedRangePercent.low ?? null, upperMovePct: h?.expectedRangePercent.high ?? null,
    annualizedVolatilityPct: null, driftPerStepPct: null, directionalBacktestPct: null,
    modelConfidence: h?.confidence ?? 0,
    methodology: b && h ? `Canonical run ${b.researchRunId}; ${h.horizon}; ${b.asOf}. Stored horizon endpoints, not a separately fitted path. The range has no asserted coverage level unless supplied by the engine.` : "No verified stored forecast. Generate current research in the linked forecast panel.",
    scenarios: h ? [
      { name: "Bear" as const, target: h.expectedPriceRange.low, movePct: h.expectedRangePercent.low, description: "Stored model range lower endpoint; not a separately generated scenario." },
      { name: "Base" as const, target: h.expectedPrice, movePct: h.expectedReturnPercent, description: "Stored Intelligence expected price, unchanged." },
      { name: "Bull" as const, target: h.expectedPriceRange.high, movePct: h.expectedRangePercent.high, description: "Stored model range upper endpoint; not a separately generated scenario." },
    ] : [], canonical: b ? { id: b.id, researchRunId: b.researchRunId, forecastRunId: b.forecastRunId, horizon: h?.horizon, asOf: b.asOf } : null };
}
