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
export function validateRuleSet(v: unknown, label: string, version: 1 | 2 = 2, depth = 0, count = { leaves: 0, groups: 0 }): RuleSet {
  const r = record(v, label);
  if (depth > 3 || ++count.groups > 21) throw new StrategyError("RULE_DEPTH", "Use at most 3 nested levels and 21 groups per condition tree.");
  const allowed = version === 2 ? ["mode", "rules", "groups"] : ["mode", "rules"];
  if (Object.keys(r).some(k => !allowed.includes(k))) throw new StrategyError("UNKNOWN_RULE_FIELDS", "Rule group contains unsupported fields.");
  if (!Array.isArray(r.rules) || (count.leaves += r.rules.length) > 40 || (version === 1 && r.rules.length > 20))
    throw new StrategyError("INVALID_RULES", "Use at most 40 criteria across one condition tree (20 for legacy rules).");
  const checked: Rule[] = r.rules.map((x, i): Rule => {
    const a = record(x, `${label} ${i + 1}`);
    if (Object.keys(a).some(k => !["metric", "period", "comparator", "value", "upper", ...(version === 2 ? ["subject"] : [])].includes(k)))
      throw new StrategyError("UNKNOWN_RULE_FIELDS", "A rule contains unsupported fields; none were discarded.");
    const def = METRICS.find(m => m.id === a.metric);
    if (!def) throw new StrategyError("UNSUPPORTED_HISTORICAL_CRITERION", "This criterion lacks verified historical input. Fundamental vintages, historical sector membership, and future observations are not substituted.");
    const comparator = choice(a.comparator, version === 2 ? [">", ">=", "<", "<=", "between", "crossesAbove", "crossesBelow"] as const : [">", ">=", "<", "<=", "between"] as const, "Comparator");
    const value = num(a.value, "Threshold", def.min, def.max);
    const upper = comparator === "between" ? num(a.upper, "Upper threshold", value, def.max) : undefined;
    const subject = a.subject === undefined ? undefined : choice(a.subject, ["instrument", "benchmark"] as const, "Rule subject");
    return { metric: def.id, period: num(a.period, "Lookback sessions", 2, 252, true), comparator, value, ...(upper === undefined ? {} : { upper }), ...(subject ? { subject } : {}) };
  });
  if (r.groups !== undefined && (!Array.isArray(r.groups) || r.groups.length > 8)) throw new StrategyError("INVALID_RULE_GROUPS", "A group supports at most 8 child groups.");
  const groups = Array.isArray(r.groups) ? r.groups.map((g, i) => validateRuleSet(g, `${label} group ${i + 1}`, version, depth + 1, count)) : [];
  if (depth > 0 && checked.length === 0 && groups.length === 0) throw new StrategyError("EMPTY_NESTED_GROUP", "Remove or complete empty nested groups; their meaning is ambiguous.");
  return { mode: choice(r.mode, ["all", "any"], `${label} mode`), rules: checked, ...(groups.length ? { groups } : {}) };
}
export function validateSpec(raw: unknown, now = new Date(), options: { allowSingleSession?: boolean } = {}): StrategySpec {
  const v = record(raw, "Strategy");
  // Do not silently discard hidden/unsupported criteria provided by a caller.
  const keys = new Set(["version", "name", "template", "universeMode", "symbols", "benchmark", "startDate", "endDate", "initialCapital", "entry", "exit", "ranking", "rankingPeriod", "weighting", "rebalance", "maxHoldings", "maxPositionPct", "maxExposurePct", "trailingStopPct", "maxHoldingSessions", "portfolioStopPct", "cooldownSessions", "feeBps", "slippageBps", "commissionUsd", "riskFreeRatePct", "acknowledgeFixedUniverse", "regime", "allocationGroups"]);
  if (Object.keys(v).some(k => !keys.has(k))) throw new StrategyError("UNKNOWN_FIELDS", "Strategy contains unsupported fields; no criterion was silently ignored.");
  if ((v.version !== 1 && v.version !== 2) || typeof v.name !== "string" || !v.name.trim() || v.name.length > 100) throw new StrategyError("INVALID_NAME", "Provide a strategy name up to 100 characters and a supported strategy version.");
  if (!Array.isArray(v.symbols) || !v.symbols.length || v.symbols.length > 12) throw new StrategyError("UNIVERSE_LIMIT", "Choose 1–12 fixed symbols.");
  const symbols = v.symbols.map(symbolOf);
  if (new Set(symbols).size !== symbols.length) throw new StrategyError("DUPLICATE_SYMBOL", "Remove duplicate symbols.");
  const universeMode = choice(v.universeMode, ["sector-etfs", "fixed-symbols"], "Universe mode");
  if (universeMode === "sector-etfs" && symbols.some(s => !SECTOR_ETFS.some(e => e.symbol === s))) throw new StrategyError("SECTOR_UNIVERSE", "Sector mode supports only the listed sector ETFs, not reconstructed historical sector constituents.");
  const startDate = isoDate(v.startDate, "Start"), endDate = isoDate(v.endDate, "End");
  const nyToday = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
  if ((options.allowSingleSession ? startDate > endDate : startDate >= endDate) || endDate >= nyToday || startDate < "2000-01-01") throw new StrategyError("INVALID_RANGE", "Choose a range after 1999 ending before today's New York date. Incomplete current-day bars are excluded.");
  if (v.acknowledgeFixedUniverse !== true) throw new StrategyError("ACKNOWLEDGMENT_REQUIRED", "Acknowledge that this is a fixed-universe test, not survivorship-bias-free historical sector stock selection.");
  if (v.version === 1 && (v.regime !== undefined || v.allocationGroups !== undefined)) throw new StrategyError("VERSION_REQUIRED", "Advanced rules require a new version-2 strategy.");
  let allocationGroups: StrategySpec["allocationGroups"];
  if (v.allocationGroups !== undefined) {
    if (!Array.isArray(v.allocationGroups) || v.allocationGroups.length > 12) throw new StrategyError("GROUP_LIMIT", "Use at most 12 user-defined allocation groups.");
    const members = new Set<string>(), names = new Set<string>();
    allocationGroups = v.allocationGroups.map((g, i) => {
      const a = record(g, `Allocation group ${i + 1}`);
      if (Object.keys(a).some(k => !["name", "symbols", "maxExposurePct"].includes(k))) throw new StrategyError("UNKNOWN_GROUP_FIELDS", "Unsupported allocation-group fields.");
      if (typeof a.name !== "string" || !a.name.trim() || a.name.length > 60 || names.has(a.name.trim().toLowerCase())) throw new StrategyError("GROUP_NAME", "Group names must be nonempty, unique, and at most 60 characters.");
      names.add(a.name.trim().toLowerCase());
      if (!Array.isArray(a.symbols) || !a.symbols.length || a.symbols.length > 12) throw new StrategyError("GROUP_MEMBERS", "Select at least one member per group.");
      const groupSymbols = a.symbols.map(symbolOf);
      for (const member of groupSymbols) { if (!symbols.includes(member) || members.has(member)) throw new StrategyError("GROUP_OVERLAP", "Each grouped symbol must be in the fixed universe and belong to at most one group."); members.add(member); }
      return { name: a.name.trim(), symbols: groupSymbols, maxExposurePct: num(a.maxExposurePct, "Group target cap (%)", 1, 100) };
    });
  }
  const version = v.version as 1 | 2;
  return { version, name: v.name.trim(), template: typeof v.template === "string" ? v.template.slice(0, 50) : "custom", universeMode, symbols,
    benchmark: symbolOf(v.benchmark), startDate, endDate, initialCapital: num(v.initialCapital, "Capital", 100, 1e10),
    entry: validateRuleSet(v.entry, "Entry", version), exit: validateRuleSet(v.exit, "Exit", version),
    ...(v.regime === undefined ? {} : { regime: validateRuleSet(v.regime, "Benchmark regime", version) }),
    ...(allocationGroups === undefined ? {} : { allocationGroups }),
    ranking: choice(v.ranking, ["momentum", "low-volatility", "relative-strength", "alphabetical"], "Ranking"), rankingPeriod: num(v.rankingPeriod, "Ranking lookback", 2, 252, true),
    weighting: choice(v.weighting, ["equal", "inverse-volatility"], "Weighting"), rebalance: choice(v.rebalance, ["once", "daily", "weekly", "monthly", "quarterly"], "Rebalance"),
    maxHoldings: num(v.maxHoldings, "Max holdings", 1, symbols.length, true), maxPositionPct: num(v.maxPositionPct, "Position cap", 1, 100), maxExposurePct: num(v.maxExposurePct, "Exposure cap", 1, 100),
    trailingStopPct: nullableNumber(v.trailingStopPct, "Trailing closing stop", 0.1, 99), maxHoldingSessions: nullableNumber(v.maxHoldingSessions, "Holding sessions", 1, 2520, true),
    portfolioStopPct: nullableNumber(v.portfolioStopPct, "Portfolio stop", 0.1, 99), cooldownSessions: num(v.cooldownSessions, "Cooldown", 0, 252, true),
    feeBps: num(v.feeBps, "Fees bps", 0, 500), slippageBps: num(v.slippageBps, "Slippage bps", 0, 500), commissionUsd: num(v.commissionUsd, "Commission", 0, 10000),
    riskFreeRatePct: num(v.riskFreeRatePct, "Assumed annual risk-free rate", -5, 30), acknowledgeFixedUniverse: true };
}
