import { engineVersionFor, StrategyError, type Dataset, type DatasetManifest, type StrategySpec } from "./contracts";
import { validateSpec } from "./validation";
import { prepareBacktest, requiredWarmup } from "./engine";
export type Readiness = { ok: boolean; checkedAt: string; engineVersion: string; requiredWarmup: number;
  effectiveStart: string | null; effectiveEnd: string | null; sessionCount: number;
  instruments: Array<{ symbol: string; datasetId: string | null; firstDate: string | null; lastDate: string | null; priorSessions: number; missingSessions: string[] }>;
  issues: Array<{ code: string; message: string }>; note: string };
export function assessReadiness(raw: unknown, datasets: Dataset[], now = new Date()): Readiness {
  const spec = validateSpec(raw, now), warmup = requiredWarmup(spec);
  const symbols = [...new Set([...spec.symbols, spec.benchmark])], ref = datasets.find(d => d.symbol === spec.benchmark);
  const dates = ref?.bars.map(b => b.date) ?? [], first = dates.findIndex(d => d >= spec.startDate);
  const needed = first < 0 ? [] : dates.slice(Math.max(0, first - warmup)).filter(d => d <= spec.endDate);
  const instruments = symbols.map(symbol => {
    const d = datasets.find(item => item.symbol === symbol), known = new Set(d?.bars.map(b => b.date) ?? []);
    return { symbol, datasetId: d?.id ?? null, firstDate: d?.bars[0]?.date ?? null, lastDate: d?.bars.at(-1)?.date ?? null,
      priorSessions: d?.bars.filter(b => b.date < spec.startDate).length ?? 0, missingSessions: needed.filter(date => !known.has(date)).slice(0, 8) };
  });
  const base = { checkedAt: now.toISOString(), engineVersion: engineVersionFor(spec), requiredWarmup: warmup, instruments,
    note: "Preflight and execution share the same coverage validation. No dates, gaps, or rule fields were silently changed. This is not a profitability or provider-access certification." };
  try { const prepared = prepareBacktest(spec, datasets, now); return { ...base, ok: true, effectiveStart: prepared.dates[0], effectiveEnd: prepared.dates.at(-1)!, sessionCount: prepared.dates.length, issues: [] }; }
  catch (error) { if (!(error instanceof StrategyError)) throw error; return { ...base, ok: false, effectiveStart: null, effectiveEnd: null, sessionCount: 0, issues: [{ code: error.code, message: error.message }] }; }
}
/** A manifest check is only an import plan; full session coverage is checked on the server. */
export function planImports(spec: StrategySpec, available: Array<Omit<DatasetManifest, "vintage">>, selected: Record<string, string>) {
  return [...new Set([...spec.symbols, spec.benchmark])].map(symbol => {
    const d = available.find(x => x.id === selected[symbol] && x.symbol === symbol);
    return { symbol, datasetId: d?.id ?? null, state: !d ? "missing" as const : d.firstDate > spec.startDate || Date.parse(spec.endDate) - Date.parse(d.lastDate) > 4 * 86400000 ? "coverage-review" as const : "selected" as const };
  });
}
