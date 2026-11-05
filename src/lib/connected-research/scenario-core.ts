/** Pure calculation layer. No provider/network/Prisma code; all prices arrive as verified observations. */
import { createHash } from "node:crypto";
import { StrategyError, PROVIDER, type Dataset, type BacktestResult, type StrategySpec, type DailyBar } from "../strategy-lab/contracts";
import { runBacktest, requiredWarmup } from "../strategy-lab/engine";
import { Series } from "../strategy-lab/indicators";
import { SCENARIO_VERSION, type ScenarioAssumptions } from "./contracts";
export const digest = (value: string) => createHash("sha256").update(value).digest("hex");
export const nyDate = (date = new Date()) => new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
export function nextCalendarDate(date: string) { return new Date(Date.parse(date + "T00:00:00Z") + 86400000).toISOString().slice(0, 10); }
export type SourceBatch = { datasetId: string; rawSha256: string; retrievedAt: string; symbol: string; acceptedThrough: string };
export type ScenarioJournal = { version: 1; frozenAt: string; earliestStart: string; datasets: Dataset[]; sources: SourceBatch[]; ignoredAdjustedRevisions: number };
export type ForwardResult = { version: typeof SCENARIO_VERSION; classification: "registered-rule-paper-replay"; effectiveStart: string; throughDate: string; acceptedSessions: number; complete: boolean; calculation: BacktestResult; warning: string };
const fail = (code: string, message: string): never => { throw new StrategyError(code, message, 409); };
const symbolsFor = (s: StrategySpec) => [...new Set([...s.symbols, s.benchmark])];
function source(d: Dataset): SourceBatch { return { datasetId: d.id, rawSha256: d.sourceSha256, retrievedAt: d.retrievedAt, symbol: d.symbol, acceptedThrough: d.bars.at(-1)?.date ?? "" }; }
function checkedData(spec: StrategySpec, inputs: Dataset[], now: Date): Dataset[] {
  return symbolsFor(spec).map(symbol => {
    const matches = inputs.filter(d => d.symbol === symbol);
    if (matches.length !== 1) return fail("SCENARIO_DATA", `Exactly one verified dataset is required for ${symbol}.`);
    const d = matches[0];
    if (d.provider !== PROVIDER || d.currency !== "USD" || !/^[a-f0-9]{64}$/.test(d.sourceSha256) || !Number.isFinite(Date.parse(d.retrievedAt)) || Date.parse(d.retrievedAt) > now.getTime() + 600000) return fail("SCENARIO_PROVENANCE", "Dataset identity, timestamp, currency, or checksum is invalid.");
    if (!d.bars.length || d.bars.some(b => b.date >= nyDate(now))) return fail("INCOMPLETE_SESSION", "Only completed sessions before today's New York date may be accepted.");
    new Series(d); return d;
  });
}
export function validateAssumptions(raw: unknown, spec: StrategySpec): ScenarioAssumptions {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return fail("ASSUMPTIONS", "Provide a scenario assumptions object.");
  const a = raw as Record<string, unknown>;
  if (Object.keys(a).some(k => !["targetSessions", "shocksPct", "reviewDrawdownPct", "notes"].includes(k))) return fail("ASSUMPTIONS", "An unsupported assumption was supplied.");
  if (typeof a.targetSessions !== "number" || !Number.isInteger(a.targetSessions) || a.targetSessions < 1 || a.targetSessions > 756) return fail("ASSUMPTIONS", "Choose 1–756 completed observation sessions.");
  if (typeof a.reviewDrawdownPct !== "number" || !Number.isFinite(a.reviewDrawdownPct) || a.reviewDrawdownPct < .1 || a.reviewDrawdownPct > 99) return fail("ASSUMPTIONS", "Review threshold must be 0.1–99 percent.");
  if (!a.shocksPct || typeof a.shocksPct !== "object" || Array.isArray(a.shocksPct)) return fail("ASSUMPTIONS", "Provide price shocks by symbol.");
  const shocks = a.shocksPct as Record<string, unknown>;
  if (Object.keys(shocks).some(s => !spec.symbols.includes(s))) return fail("ASSUMPTIONS", "Shocks must refer to the selected fixed universe.");
  const result: Record<string, number> = {};
  for (const symbol of spec.symbols) {
    const x = shocks[symbol] ?? 0;
    if (typeof x !== "number" || !Number.isFinite(x) || x < -95 || x > 300) return fail("ASSUMPTIONS", "Each assumed price change must be between -95% and +300%.");
    result[symbol] = x;
  }
  if (a.notes !== undefined && (typeof a.notes !== "string" || a.notes.length > 2000)) return fail("ASSUMPTIONS", "Notes must contain no more than 2,000 characters.");
  return { targetSessions: a.targetSessions, shocksPct: result, reviewDrawdownPct: a.reviewDrawdownPct, notes: typeof a.notes === "string" ? a.notes.trim() : "" };
}
export function staticShockImpact(weightsPct: Record<string, number>, shocksPct: Record<string, number>, capital: number) {
  if (!(capital > 0) || !Number.isFinite(capital)) return fail("SHOCK_INPUT", "Capital must be a positive finite number.");
  const rows = Object.entries(weightsPct).map(([symbol, weightPct]) => {
    const shockPct = shocksPct[symbol] ?? 0;
    if (!Number.isFinite(weightPct) || weightPct < 0 || weightPct > 100 || !Number.isFinite(shockPct) || shockPct < -95 || shockPct > 300) return fail("SHOCK_INPUT", "Invalid unlevered weight or shock.");
    return { symbol, weightPct, shockPct, contributionPct: weightPct / 100 * shockPct };
  });
  if (rows.reduce((s, r) => s + r.weightPct, 0) > 100.000001) return fail("SHOCK_LEVERAGE", "Static scenario weights may not exceed 100%.");
  const returnPct = rows.reduce((s, r) => s + r.contributionPct, 0);
  return { classification: "user-assumption-not-a-forecast" as const, rows, returnPct, hypotheticalValue: capital * (1 + returnPct / 100), cashWeightPct: Math.max(0, 100 - rows.reduce((s, r) => s + r.weightPct, 0)), note: "Static price-only shock on the selected historical run's ending weights, rescaled to starting capital. No probability, dividends, taxes, new trades, or time path is implied. This is not the future rule-based paper portfolio." };
}
export function freezeJournal(spec: StrategySpec, inputs: Dataset[], now = new Date()): ScenarioJournal {
  const datasets = checkedData(spec, inputs, now);
  const reference = datasets.find(d => d.symbol === spec.benchmark)!;
  const lastDate = reference.bars.at(-1)!.date;
  if ((Date.parse(nyDate(now)) - Date.parse(lastDate)) / 86400000 > 7) return fail("STALE_BASELINE", "Import recent history before arming; the benchmark baseline is over seven calendar days old.");
  const warmup = requiredWarmup(spec);
  if (reference.bars.length < warmup + 1) return fail("WARMUP_REQUIRED", `At least ${warmup + 1} baseline sessions are required.`);
  const required = reference.bars.slice(-warmup - 1).map(b => b.date);
  for (const d of datasets) {
    if (d.bars.at(-1)!.date !== lastDate) return fail("OUT_OF_SYNC", "All baseline datasets must end on the same completed session. Refresh the missing instrument; no session was shortened.");
    const dates = new Set(d.bars.map(b => b.date));
    if (required.some(date => !dates.has(date))) return fail("MISSING_SESSION", `${d.symbol} lacks required baseline history.`);
  }
  return { version: 1, frozenAt: now.toISOString(), earliestStart: nextCalendarDate(nyDate(now)), datasets: structuredClone(datasets), sources: datasets.map(source), ignoredAdjustedRevisions: 0 };
}
const ECONOMIC_FIELDS: Array<keyof Omit<DailyBar, "date" | "adjustedClose">> = ["open", "high", "low", "close", "volume", "dividend", "split"];
function almostEqual(a: number, b: number) { return Math.abs(a - b) <= Math.max(1e-10, Math.max(Math.abs(a), Math.abs(b)) * 1e-10); }
export function appendObservations(spec: StrategySpec, journal: ScenarioJournal, inputs: Dataset[], now = new Date()): ScenarioJournal {
  const latest = checkedData(spec, inputs, now); let ignored = journal.ignoredAdjustedRevisions;
  const sources = [...journal.sources];
  const datasets = journal.datasets.map(frozen => {
    const incoming = latest.find(d => d.symbol === frozen.symbol)!;
    const byDate = new Map(incoming.bars.map(b => [b.date, b]));
    for (const old of frozen.bars) {
      const current = byDate.get(old.date);
      if (!current || ECONOMIC_FIELDS.some(k => !almostEqual(old[k], current[k]))) return fail("HISTORICAL_REVISION", `${frozen.symbol}: previously accepted observations changed or disappeared on ${old.date}. Prior paper results were preserved. Reconcile the source change or create a new scenario; it was not silently rewritten.`);
      if (!almostEqual(old.adjustedClose, current.adjustedClose)) ignored++;
    }
    const cutoff = frozen.bars.at(-1)!.date;
    const added = incoming.bars.filter(b => b.date > cutoff);
    if (!added.length) return frozen;
    const acceptedDates = new Set(frozen.bars.map(b => b.date));
    if (incoming.bars.some(b => b.date <= cutoff && b.date >= frozen.bars[0].date && !acceptedDates.has(b.date))) return fail("HISTORICAL_REVISION", "A new earlier session was inserted into an accepted calendar.");
    sources.push(source(incoming));
    const bars = [...frozen.bars, ...added];
    // This checksum describes the accepted observation journal. Original vendor-response hashes remain in sources.
    return { ...frozen, id: `journal-${frozen.symbol}`, bars, retrievedAt: incoming.retrievedAt, sourceSha256: digest(JSON.stringify(bars)) };
  });
  const reference = datasets.find(d => d.symbol === spec.benchmark)!;
  const lastDate = reference.bars.at(-1)!.date;
  if (datasets.some(d => d.bars.at(-1)!.date !== lastDate)) return fail("OUT_OF_SYNC", "Provider histories are not aligned to the same completed session. The prior checkpoint remains intact.");
  return { ...journal, datasets, sources, ignoredAdjustedRevisions: ignored };
}
export function assertStablePrefix(previous: ForwardResult, next: ForwardResult) {
  if (previous.version !== SCENARIO_VERSION) return fail("ENGINE_CHANGED", "The paper engine changed. Create a new forward scenario instead of rewriting this one.");
  const p = previous.calculation, n = next.calculation, cutoff = previous.throughDate;
  const checks = [[p.equity, n.equity.filter(x => x.date <= cutoff)], [p.benchmarkEquity, n.benchmarkEquity.filter(x => x.date <= cutoff)], [p.trades, n.trades.filter(x => x.date <= cutoff)], [p.corporateActions, n.corporateActions.filter(x => x.date <= cutoff)]];
  if (checks.some(([a, b]) => JSON.stringify(a) !== JSON.stringify(b))) return fail("PREFIX_CHANGED", "New information would change a previously recorded paper result. Nothing was published.");
}
export function replayForward(spec: StrategySpec, journal: ScenarioJournal, targetSessions: number, previous: ForwardResult | null, now = new Date()): ForwardResult | null {
  const reference = journal.datasets.find(d => d.symbol === spec.benchmark);
  if (!reference) return fail("BENCHMARK_MISSING", "The frozen journal lacks the benchmark.");
  const dates = reference.bars.map(b => b.date).filter(d => d >= journal.earliestStart && d < nyDate(now)).slice(0, targetSessions);
  if (!dates.length) return null;
  const calculation = runBacktest({ ...spec, startDate: dates[0], endDate: dates.at(-1)! }, journal.datasets, now, { allowSingleSession: true });
  const result: ForwardResult = { version: SCENARIO_VERSION, classification: "registered-rule-paper-replay", effectiveStart: dates[0], throughDate: dates.at(-1)!, acceptedSessions: dates.length, complete: dates.length >= targetSessions, calculation,
    warning: "Rules were registered before the first eligible session. Later vendor observations are replayed under those frozen rules; fills are modeled, not broker executions or proof that a live order was submitted. Signals use prior closes, executions use the next observed open. Gaps in monitoring are caught up transparently; future observations and old raw-price revisions are never substituted." };
  if (previous) assertStablePrefix(previous, result);
  return result;
}
/** Detects accidental checkpoint changes. This is a hash chain, not an external digital signature. */
export function verifyObservationChain(records: Array<{ sessionDate: string; payloadJson: string; previousHash: string; recordHash: string }>, definitionHash: string, frozenAt: string, expectedCount: number) {
  if (records.length !== expectedCount) return fail("AUDIT_COUNT", "The saved observation count does not match the scenario checkpoint count.");
  let previousHash = digest(definitionHash + "\n" + frozenAt), previousDate = "";
  for (const record of records) {
    if (record.sessionDate <= previousDate || record.previousHash !== previousHash || digest(previousHash + "\n" + record.payloadJson) !== record.recordHash) return fail("AUDIT_CHAIN", "The stored observation audit chain failed verification. No replacement history was generated.");
    previousHash = record.recordHash; previousDate = record.sessionDate;
  }
  return { verified: true as const, records: records.length, finalHash: previousHash, digitallySigned: false as const };
}
