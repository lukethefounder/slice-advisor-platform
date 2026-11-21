import type { Dataset } from "./contracts";

export type HistoryCoverage = { startDate: string; endDate: string; warmupSessions: number };
const DAY = 86_400_000;

/** A reuse decision, not a replacement for the engine's full cross-symbol preflight.
 * Old immutable observations remain useful for a closed historical period. They
 * must never masquerade as a fresh import for forward tracking. */
export function canReuseHistory(dataset: Dataset, options: {
  coverage?: HistoryCoverage;
  freshForMs: number;
  now?: number;
}): boolean {
  const now = options.now ?? Date.now(), retrieved = Date.parse(dataset.retrievedAt);
  if (!Number.isFinite(retrieved) || retrieved > now + 60_000 || dataset.bars.length < 2) return false;
  const coverage = options.coverage;
  if (!coverage) return now - retrieved <= options.freshForMs;
  const start = Date.parse(coverage.startDate), end = Date.parse(coverage.endDate);
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start
    || !Number.isInteger(coverage.warmupSessions) || coverage.warmupSessions < 0) return false;
  // parseDailyPayload freezes available sessions to the NY date of retrieval.
  // An import taken during the requested last day cannot prove that day's close.
  const retrievedDay = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit",
  }).format(new Date(retrieved));
  if (retrievedDay <= coverage.endDate) return false;
  const first = dataset.bars.findIndex(bar => bar.date >= coverage.startDate);
  if (first < coverage.warmupSessions) return false;
  const dates = dataset.bars.slice(first).filter(bar => bar.date <= coverage.endDate);
  return dates.length >= 2
    && Date.parse(dates[0].date) - start <= 4 * DAY
    && end - Date.parse(dates.at(-1)!.date) <= 4 * DAY;
}

/** In-process callers share work; the existing database lease covers workers.
 * User + symbol + force/coverage form the key, so no private dataset crosses users. */
const pending = new Map<string, Promise<unknown>>();
export function shareHistoryImport<T>(key: string, work: () => Promise<T>): Promise<T> {
  const existing = pending.get(key);
  if (existing) return existing as Promise<T>;
  const request = Promise.resolve().then(work).finally(() => {
    if (pending.get(key) === request) pending.delete(key);
  });
  pending.set(key, request);
  return request;
}
