import { METRICS, SECTOR_ETFS, StrategyError, type Rule, type RuleSet, type StrategySpec } from "./contracts";
function record(value: unknown, label: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw new StrategyError("INVALID_INPUT", `${label} must be an object.`);
  return value as Record<string, unknown>;
}
function num(value: unknown, label: string, min: number, max: number, integer = false): number {
  if (typeof value !== "number" || !Number.isFinite(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    throw new StrategyError("INVALID_NUMBER", `${label} must be ${integer ? "an integer" : "a finite number"} from ${min} to ${max}.`);
  return value;
}
function choice<T extends string>(v: unknown, values: readonly T[], label: string): T {
  if (typeof v !== "string" || !values.includes(v as T)) throw new StrategyError("INVALID_CHOICE", `${label} is not supported.`);
  return v as T;
}
export function isoDate(v: unknown, label: string): string {
  if (typeof v !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(v) || !Number.isFinite(Date.parse(v)) || new Date(v).toISOString().slice(0, 10) !== v)
    throw new StrategyError("INVALID_DATE", `${label} must be a real calendar date (YYYY-MM-DD).`);
  return v;
}
export function symbolOf(v: unknown): string {
  if (typeof v !== "string" || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(v)) throw new StrategyError("INVALID_SYMBOL", "Use an uppercase US stock or ETF symbol.");
  return v;
}
function nullableNumber(v: unknown, label: string, min: number, max: number, int = false) { return v === null ? null : num(v, label, min, max, int); }
function rules(v: unknown, label: string): RuleSet {
  const r = record(v, label);
  if (Object.keys(r).some(k => !["mode", "rules"].includes(k))) throw new StrategyError("UNKNOWN_RULE_FIELDS", "Rule group contains unsupported fields.");
  if (!Array.isArray(r.rules) || r.rules.length > 20) throw new StrategyError("INVALID_RULES", `${label} supports at most 20 rules.`);
  return { mode: choice(r.mode, ["all", "any"], `${label} mode`), rules: r.rules.map((x, i): Rule => {
    const a = record(x, `${label} ${i + 1}`);
    if (Object.keys(a).some(k => !["metric", "period", "comparator", "value", "upper"].includes(k))) throw new StrategyError("UNKNOWN_RULE_FIELDS", "A rule contains unsupported fields.");
    const def = METRICS.find(m => m.id === a.metric);
    if (!def) throw new StrategyError("UNSUPPORTED_HISTORICAL_CRITERION", "This criterion lacks a supported historical price-data implementation. Fundamental, news, and vintage-macro rules are not enabled.");
    const comparator = choice(a.comparator, [">", ">=", "<", "<=", "between"], "Comparator");
    const value = num(a.value, "Threshold", def.min, def.max);
    const upper = comparator === "between" ? num(a.upper, "Upper threshold", value, def.max) : undefined;
    return { metric: def.id, period: num(a.period, "Lookback sessions", 2, 252, true), comparator, value, ...(upper === undefined ? {} : { upper }) };
  }) };
}
export function validateSpec(raw: unknown, now = new Date(), options: { allowSingleSession?: boolean } = {}): StrategySpec {
  const v = record(raw, "Strategy");
  // Do not silently discard hidden/unsupported criteria provided by a caller.
  const keys = new Set(["version", "name", "template", "universeMode", "symbols", "benchmark", "startDate", "endDate", "initialCapital", "entry", "exit", "ranking", "rankingPeriod", "weighting", "rebalance", "maxHoldings", "maxPositionPct", "maxExposurePct", "trailingStopPct", "maxHoldingSessions", "portfolioStopPct", "cooldownSessions", "feeBps", "slippageBps", "commissionUsd", "riskFreeRatePct", "acknowledgeFixedUniverse"]);
  if (Object.keys(v).some(k => !keys.has(k))) throw new StrategyError("UNKNOWN_FIELDS", "Strategy contains unsupported fields; no criterion was silently ignored.");
  if (v.version !== 1 || typeof v.name !== "string" || !v.name.trim() || v.name.length > 100) throw new StrategyError("INVALID_NAME", "Provide a strategy name up to 100 characters and version 1.");
  if (!Array.isArray(v.symbols) || !v.symbols.length || v.symbols.length > 12) throw new StrategyError("UNIVERSE_LIMIT", "Choose 1–12 fixed symbols.");
  const symbols = v.symbols.map(symbolOf);
  if (new Set(symbols).size !== symbols.length) throw new StrategyError("DUPLICATE_SYMBOL", "Remove duplicate symbols.");
  const universeMode = choice(v.universeMode, ["sector-etfs", "fixed-symbols"], "Universe mode");
  if (universeMode === "sector-etfs" && symbols.some(s => !SECTOR_ETFS.some(e => e.symbol === s))) throw new StrategyError("SECTOR_UNIVERSE", "Sector mode supports only the listed sector ETFs, not reconstructed historical sector constituents.");
  const startDate = isoDate(v.startDate, "Start"), endDate = isoDate(v.endDate, "End");
  const nyToday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if ((options.allowSingleSession ? startDate > endDate : startDate >= endDate) || endDate >= nyToday || startDate < "2000-01-01") throw new StrategyError("INVALID_RANGE", "Choose a range after 1999 ending before today's New York date. Incomplete current-day bars are excluded.");
  if (v.acknowledgeFixedUniverse !== true) throw new StrategyError("ACKNOWLEDGMENT_REQUIRED", "Acknowledge that this is a fixed-universe test, not survivorship-bias-free historical sector stock selection.");
  return { version: 1, name: v.name.trim(), template: typeof v.template === "string" ? v.template.slice(0, 50) : "custom", universeMode, symbols,
    benchmark: symbolOf(v.benchmark), startDate, endDate, initialCapital: num(v.initialCapital, "Capital", 100, 1e10),
    entry: rules(v.entry, "Entry"), exit: rules(v.exit, "Exit"),
    ranking: choice(v.ranking, ["momentum", "low-volatility", "relative-strength", "alphabetical"], "Ranking"), rankingPeriod: num(v.rankingPeriod, "Ranking lookback", 2, 252, true),
    weighting: choice(v.weighting, ["equal", "inverse-volatility"], "Weighting"), rebalance: choice(v.rebalance, ["once", "daily", "weekly", "monthly", "quarterly"], "Rebalance"),
    maxHoldings: num(v.maxHoldings, "Max holdings", 1, symbols.length, true), maxPositionPct: num(v.maxPositionPct, "Position cap", 1, 100), maxExposurePct: num(v.maxExposurePct, "Exposure cap", 1, 100),
    trailingStopPct: nullableNumber(v.trailingStopPct, "Trailing closing stop", 0.1, 99), maxHoldingSessions: nullableNumber(v.maxHoldingSessions, "Holding sessions", 1, 2520, true),
    portfolioStopPct: nullableNumber(v.portfolioStopPct, "Portfolio stop", 0.1, 99), cooldownSessions: num(v.cooldownSessions, "Cooldown", 0, 252, true),
    feeBps: num(v.feeBps, "Fees bps", 0, 500), slippageBps: num(v.slippageBps, "Slippage bps", 0, 500), commissionUsd: num(v.commissionUsd, "Commission", 0, 10000),
    riskFreeRatePct: num(v.riskFreeRatePct, "Assumed annual risk-free rate", -5, 30), acknowledgeFixedUniverse: true };
}
