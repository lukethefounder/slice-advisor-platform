import { AgentBrokerError, DEFAULT_BROKER_POLICY, type BrokerPolicy } from "./contracts";
export const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
export const isSymbol = (value: unknown): value is string => typeof value === "string" && /^[A-Z][A-Z0-9.-]{0,14}$/.test(value);
const bounds: Record<Exclude<keyof BrokerPolicy, "allowedSymbols" | "feed">, [number, number, boolean?]> = {
  maxOrderUsd: [1, 100_000], maxPositionPct: [0.1, 20], minCashPct: [50, 99], maxDailyLossPct: [0.1, 5],
  maxTradesPerDay: [1, 20, true], minResearchConfidence: [40, 100], minEvidenceCoverage: [40, 100],
  maxQuoteAgeSeconds: [1, 10], maxDecisionAgeSeconds: [10, 900], maxSpreadBps: [1, 100], maxPriceDriftBps: [1, 100],
  stopLossPct: [0.1, 10], takeProfitPct: [0.1, 30], maxHoldingMinutes: [1, 390], flattenBeforeCloseMinutes: [5, 60],
};
export function validateBrokerPolicy(value: unknown): BrokerPolicy {
  if (!object(value) || Object.keys(value).some(key => !(key in DEFAULT_BROKER_POLICY)) || Object.keys(value).length !== Object.keys(DEFAULT_BROKER_POLICY).length)
    throw new AgentBrokerError("INVALID_BROKER_POLICY", "Supply the complete broker safeguards without extra fields.", 400);
  for (const [key, [min, max, integer]] of Object.entries(bounds)) {
    const item = value[key];
    if (typeof item !== "number" || !Number.isFinite(item) || item < min || item > max || (integer && !Number.isInteger(item)))
      throw new AgentBrokerError("INVALID_BROKER_POLICY", `${key} must be ${integer ? "a whole number " : ""}between ${min} and ${max}.`, 400);
  }
  if (!Array.isArray(value.allowedSymbols) || value.allowedSymbols.length < 1 || value.allowedSymbols.length > 30 || value.allowedSymbols.some(symbol => !isSymbol(symbol)) || new Set(value.allowedSymbols).size !== value.allowedSymbols.length || !["iex", "sip"].includes(String(value.feed)))
    throw new AgentBrokerError("INVALID_BROKER_POLICY", "Choose IEX or SIP and 1–30 distinct uppercase US stock or ETF symbols.", 400);
  return structuredClone(value) as BrokerPolicy;
}
export function validRevision(value: unknown): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) throw new AgentBrokerError("INVALID_BROKER_COMMAND", "Supply the current broker revision.", 400);
  return value;
}
export function isoDate(value: unknown): string {
  if (typeof value !== "string" || value.length > 64 || !Number.isFinite(Date.parse(value))) throw new AgentBrokerError("BROKER_RESPONSE_INVALID", "The broker returned an invalid timestamp. Trading is blocked.", 502);
  return new Date(value).toISOString();
}
