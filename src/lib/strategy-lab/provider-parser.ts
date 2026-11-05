import { assertProviderSuccess } from "./import-errors";
import { type DailyBar, StrategyError } from "./contracts";
import { isoDate } from "./validation";
function object(x: unknown): Record<string, unknown> {
  if (!x || typeof x !== "object" || Array.isArray(x)) throw new StrategyError("PROVIDER_SCHEMA", "Provider returned an unexpected JSON structure.", 502);
  return x as Record<string, unknown>;
}
function number(v: unknown, key: string, date: string) {
  if (v === null || v === undefined || v === "" || typeof v === "boolean") throw new StrategyError("MISSING_PROVIDER_VALUE", `Missing ${key} for ${date}.`, 502);
  const n = Number(v);
  if (!Number.isFinite(n)) throw new StrategyError("INVALID_PROVIDER_VALUE", `Invalid ${key} for ${date}.`, 502);
  return n;
}
export function parseDailyPayload(raw: unknown, symbol: string, today: string): DailyBar[] {
  const root = object(raw);
  assertProviderSuccess(root);
  const metadata = object(root["Meta Data"]);
  const reported = Object.entries(metadata).find(([key]) => /symbol/i.test(key))?.[1];
  if (typeof reported !== "string" || reported.toUpperCase() !== symbol) throw new StrategyError("SYMBOL_MISMATCH", "Provider symbol does not match the requested symbol.", 502);
  const series = object(root["Time Series (Daily)"]);
  const bars: DailyBar[] = [];
  for (const [rawDate, data] of Object.entries(series)) {
    const date = isoDate(rawDate, "Provider date");
    if (date >= today) continue; // Only previous completed daily sessions.
    const v = object(data), n = (key: string) => number(v[key], key, date);
    bars.push({ date, open: n("1. open"), high: n("2. high"), low: n("3. low"), close: n("4. close"), adjustedClose: n("5. adjusted close"), volume: n("6. volume"), dividend: n("7. dividend amount"), split: n("8. split coefficient") });
  }
  if (bars.length < 2) throw new StrategyError("NO_HISTORY", "No complete daily-adjusted history was returned.", 502);
  return bars.sort((a, b) => a.date.localeCompare(b.date));
}

/** Current identity is a currency/venue check, never a historical sector-membership signal. */
export function verifyUsdIdentity(payload: unknown, symbol: string) {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) throw new StrategyError("IDENTITY_UNAVAILABLE", "Alpha Vantage returned no instrument identity.", 502);
  const record = payload as Record<string, unknown>;
  assertProviderSuccess(record);
  const matches = Array.isArray(record.bestMatches) ? record.bestMatches : [];
  const candidate = matches.find((item: unknown) => item && typeof item === "object" && (item as Record<string, unknown>)["1. symbol"] === symbol) as Record<string, unknown> | undefined;
  if (!candidate || candidate["8. currency"] !== "USD" || candidate["4. region"] !== "United States" || !["Equity", "ETF"].includes(String(candidate["3. type"])))
    throw new StrategyError("UNVERIFIED_USD_INSTRUMENT", "Only an exact Alpha Vantage match for a US-listed USD equity or ETF is supported. No currency or venue was assumed.");
  return { symbol, name: String(candidate["2. name"]), type: String(candidate["3. type"]), currency: "USD" as const, region: "United States" as const };
}
