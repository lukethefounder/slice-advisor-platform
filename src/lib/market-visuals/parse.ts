import { MarketError, dateOnly, finite, obj, providerFailure, symbol, todayNY } from "@/lib/market-evidence/core";
import type { Company, Earnings, Metric, Options, OptionRow, SectionRequest } from "./contracts";
import { SECTIONS } from "./contracts";
import type { MarketBar, MarketRange } from "@/lib/market-evidence/contracts";
const text = (v: unknown, max = 400) => typeof v === "string" ? v.replace(/\0/g, "").trim().slice(0, max) : "";
export function parseSection(value: unknown): SectionRequest {
  const p = obj(value), section = String(p.section ?? ""), range = String(p.range ?? "3M");
  if (!SECTIONS.includes(section as SectionRequest["section"])) throw new MarketError("SECTION", "Choose a supported market section.");
  if (!["1D", "1M", "3M", "6M", "1Y"].includes(range)) throw new MarketError("RANGE", "Choose 1D, 1M, 3M, 6M or 1Y.");
  if (section === "options" && p.confirmOptions !== true) throw new MarketError("OPTIONS_CONFIRM", "Explicitly request the entitled options snapshot before loading it.");
  return { section: section as SectionRequest["section"], symbol: symbol(p.symbol), range: range as MarketRange, confirmOptions: p.confirmOptions === true };
}
function matching(payload: unknown, requested: string) {
  providerFailure(payload); const p = obj(payload);
  if (text(p.Symbol ?? p.symbol).toUpperCase() !== requested) throw new MarketError("IDENTITY_MISMATCH", "The provider response does not match the requested instrument.", 502);
  return p;
}
const metricFields: Array<[string, string, Metric["kind"]]> = [
  ["MarketCapitalization", "Market capitalization", "money"], ["PERatio", "P/E ratio", "ratio"],
  ["ForwardPE", "Forward P/E", "ratio"], ["PriceToBookRatio", "Price / book", "ratio"],
  ["PriceToSalesRatioTTM", "Price / sales", "ratio"], ["EPS", "Earnings per share", "money"],
  ["ProfitMargin", "Profit margin", "percent"], ["OperatingMarginTTM", "Operating margin", "percent"],
  ["ReturnOnEquityTTM", "Return on equity", "percent"], ["ReturnOnAssetsTTM", "Return on assets", "percent"],
  ["RevenueTTM", "Revenue (trailing)", "money"], ["QuarterlyRevenueGrowthYOY", "Quarterly revenue growth", "percent"],
  ["QuarterlyEarningsGrowthYOY", "Quarterly earnings growth", "percent"], ["DividendYield", "Dividend yield", "percent"],
  ["Beta", "Beta", "number"], ["SharesOutstanding", "Shares outstanding", "number"],
  ["52WeekHigh", "52-week high", "money"], ["52WeekLow", "52-week low", "money"],
  ["AnalystTargetPrice", "Analyst target", "money"],
];
export function parseCompany(payload: unknown, requested: string): Company {
  const p = matching(payload, requested);
  const currency = text(p.Currency, 12); if (currency !== "USD") throw new MarketError("CURRENCY", "This workspace accepts USD equity/ETF evidence. No currency conversion was assumed.", 422);
  return { symbol: requested, name: text(p.Name), sector: text(p.Sector), industry: text(p.Industry), currency, exchange: text(p.Exchange), description: text(p.Description, 4000), latestQuarter: dateOnly(p.LatestQuarter), metrics: metricFields.map(([key, label, kind]) => {
    const value = finite(p[key]); return { label, value: value === null ? null : kind === "percent" ? value * 100 : value, kind, ...(key === "AnalystTargetPrice" ? { detail: "Provider analyst consensus; not the Slice canonical forecast." } : {}) };
  }) };
}
export function parseEarnings(payload: unknown, requested: string, now = Date.now()): Earnings {
  const p = matching(payload, requested);
  if (!Array.isArray(p.quarterlyEarnings)) throw new MarketError("EARNINGS_SHAPE", "Quarterly earnings were not returned for this instrument.", 502);
  const seen = new Set<string>(), cutoff = todayNY(now);
  const rows: Earnings["rows"] = [];
  for (const raw of p.quarterlyEarnings) {
    const r = obj(raw), fiscalDate = dateOnly(r.fiscalDateEnding), reportedDate = dateOnly(r.reportedDate);
    if (!fiscalDate || fiscalDate > cutoff || (reportedDate && reportedDate > cutoff) || seen.has(fiscalDate)) continue;
    seen.add(fiscalDate); rows.push({ fiscalDate, reportedDate, reportedEPS: finite(r.reportedEPS), estimatedEPS: finite(r.estimatedEPS), surprisePct: finite(r.surprisePercentage), reportTime: text(r.reportTime) || null });
  }
  return { symbol: requested, rows: rows.sort((a, b) => b.fiscalDate.localeCompare(a.fiscalDate)).slice(0, 24) };
}
export function parseOptions(payload: unknown, requested: string, now = Date.now()): Options {
  providerFailure(payload); const p = obj(payload);
  if (!Array.isArray(p.data)) throw new MarketError("OPTIONS_SHAPE", "No usable options chain was returned. Check endpoint access.", 502);
  const rows: OptionRow[] = [], seen = new Set<string>(), cutoff = todayNY(now);
  const nonnegative = (value: unknown) => { const n = finite(value); return n !== null && n >= 0 ? n : null; };
  for (const raw of p.data) {
    const r = obj(raw), id = text(r.contractID, 160), s = text(r.symbol).toUpperCase(), type = text(r.type).toLowerCase();
    const expiration = dateOnly(r.expiration), strike = finite(r.strike), asOf = dateOnly(r.date);
    if (s !== requested || !id || seen.has(id) || !expiration || strike === null || strike <= 0 || !["call", "put"].includes(type) || (asOf && asOf > cutoff)) continue;
    seen.add(id);
    const bid = nonnegative(r.bid), ask = nonnegative(r.ask);
    rows.push({ id, symbol: s, expiration, strike, type: type as OptionRow["type"], asOf, bid, ask, last: nonnegative(r.last), volume: nonnegative(r.volume), openInterest: nonnegative(r.open_interest), impliedVolatility: nonnegative(r.implied_volatility), delta: finite(r.delta), crossed: bid !== null && ask !== null && bid > ask });
    if (rows.length >= 2000) break;
  }
  if (p.data.length && !rows.length) throw new MarketError("OPTIONS_IDENTITY", "The returned contracts could not be validated for this symbol.", 502);
  return { symbol: requested, rows: rows.sort((a, b) => a.expiration.localeCompare(b.expiration) || a.strike - b.strike || a.type.localeCompare(b.type)), receivedCount: p.data.length, omittedCount: p.data.length - rows.length, datePrecision: "provider date or unavailable", note: "Snapshot only. A date-only contract observation cannot prove tick-level freshness. Missing Greeks/prices remain unavailable; crossed bid/ask values are flagged. No trade execution." };
}
/** Bounded, explicitly labeled price-derived observations; no neutral placeholder scores. */
export function technicalSummary(input: Array<MarketBar & { gapBefore?: boolean }>) {
  const lastGap = input.map(b => b.gapBefore).lastIndexOf(true);
  const bars = input.slice(Math.max(0, lastGap));
  if (!bars.length) return [];
  const last = bars.at(-1)!, closes = bars.map(b => b.close);
  const average = (n: number) => closes.length >= n ? closes.slice(-n).reduce((a, b) => a + b, 0) / n : null;
  const relative = (v: number | null) => v !== null ? (last.close / v - 1) * 100 : null;
  let rsi: number | null = null;
  if (closes.length >= 15) { const changes = closes.slice(-15).slice(1).map((v, i) => v - closes.slice(-15)[i]); const up = changes.reduce((a, b) => a + Math.max(b, 0), 0), down = changes.reduce((a, b) => a + Math.max(-b, 0), 0); rsi = up === 0 && down === 0 ? 50 : down === 0 ? 100 : 100 - 100 / (1 + up / down); }
  const period = Math.min(20, closes.length), recent = bars.slice(-period);
  return [
    { label: "Last completed close", value: last.close, suffix: "price units", detail: last.at },
    { label: "SMA 20", value: average(20), suffix: "price units", detail: "20 loaded completed observations" },
    { label: "SMA 50", value: average(50), suffix: "price units", detail: "Unavailable before 50 observations" },
    { label: "Distance from SMA 20", value: relative(average(20)), suffix: "%", detail: "Raw price relationship, not forecast probability" },
    { label: "RSI 14 (simple)", value: rsi, suffix: "/100", detail: "Simple-window gains/losses, not Wilder smoothing" },
    { label: `Recent ${period}-bar high`, value: Math.max(...recent.map(b => b.high)), suffix: "price units", detail: "High of loaded observed bars" },
    { label: `Recent ${period}-bar low`, value: Math.min(...recent.map(b => b.low)), suffix: "price units", detail: "Low of loaded observed bars" },
    { label: "Latest volume", value: last.volume, suffix: last.volume===null?"not supplied":"shares", detail: last.volume===null?"Volume is not supplied for this series; no zero was invented.":"Provider reported bar volume" },
  ];
}
