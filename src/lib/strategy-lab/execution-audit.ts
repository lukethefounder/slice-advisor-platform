import { StrategyError, type BacktestResult, type Dataset } from "./contracts";
import { Series, traceRules } from "./indicators";
/** Re-explains a saved decision using the exact pinned datasets, never a fresh provider request. */
export function explainDecision(run: BacktestResult, datasets: Dataset[], date: string, symbol: string) {
  if (!["slice-daily-event-ledger-1.0.0", "slice-daily-event-ledger-2.0.0"].includes(run.engineVersion)) throw new StrategyError("ENGINE_UNSUPPORTED", "This engine version cannot be audited by the installed evaluator.", 409);
  if (!run.spec.symbols.includes(symbol) || !run.equity.some(p => p.date === date)) throw new StrategyError("AUDIT_SELECTION", "Choose a symbol and execution date from this saved run.");
  for (const m of run.manifests) if (!datasets.some(d => d.id === m.id && d.symbol === m.symbol && d.sourceSha256 === m.sourceSha256)) throw new StrategyError("AUDIT_SOURCE", "A pinned dataset differs from the saved source manifest.", 409);
  const data = datasets.find(d => d.symbol === symbol), ref = datasets.find(d => d.symbol === run.spec.benchmark);
  if (!data || !ref) throw new StrategyError("AUDIT_SOURCE", "The pinned symbol or benchmark dataset is missing.");
  const s = new Series(data), b = new Series(ref), fill = b.index.get(date) ?? -1, signalDate = ref.bars[fill - 1]?.date;
  if (!signalDate || !s.index.has(signalDate)) throw new StrategyError("AUDIT_SESSION", "The saved prior-session observation is missing.");
  const index = s.index.get(signalDate)!;
  return { engineVersion: run.engineVersion, symbol, date, signalDate, provider: "Alpha Vantage" as const,
    entry: traceRules(run.spec.entry, s, index, b, true), exit: traceRules(run.spec.exit, s, index, b, false),
    regime: traceRules(run.spec.regime ?? { mode: "all", rules: [] }, b, fill - 1, b, true),
    trades: run.trades.filter(t => t.symbol === symbol && t.date === date),
    positionAtClose: run.equity.find(p => p.date === date)?.weights[symbol] ?? 0,
    note: "Rules are evaluated on the prior close. A passing entry does not guarantee an order: rebalance schedule, ranking, held positions, caps, cooldowns, costs, cash, and risk exits also determine fills. The original order ledger is shown alongside the rule values." };
}
