import { type Dataset, type Metric, type Rule, type RuleSet, StrategyError } from "./contracts";
/** Cached O(n) rolling indicators. No history-wide adjustment using future corporate events. */
export class Series {
  readonly index = new Map<string, number>();
  readonly price: number[] = []; readonly high: number[] = []; readonly low: number[] = [];
  private values = new Map<string, Array<number | null>>();
  constructor(readonly data: Dataset) {
    let units = 1;
    for (let i = 0; i < data.bars.length; i++) {
      const b = data.bars[i];
      if ((i && b.date <= data.bars[i - 1].date) || ![b.open, b.high, b.low, b.close, b.adjustedClose, b.split].every(x => Number.isFinite(x) && x > 0)
        || !Number.isFinite(b.volume) || b.volume < 0 || !Number.isFinite(b.dividend) || b.dividend < 0
        || b.high < Math.max(b.open, b.close, b.low) || b.low > Math.min(b.open, b.close, b.high))
        throw new StrategyError("INVALID_BAR", `Invalid or unordered price bar for ${data.symbol} on ${b.date}.`);
      units *= b.split;
      if (!Number.isFinite(units) || units <= 0) throw new StrategyError("INVALID_SPLIT_CHAIN", "Corporate-action normalization overflowed.");
      this.price.push(b.close * units); this.high.push(b.high * units); this.low.push(b.low * units); this.index.set(b.date, i);
    }
  }
  metric(metric: Metric, period: number, index: number, benchmark?: Series): number | null {
    if (index < 0 || index >= this.price.length) return null;
    if (metric === "relativeMomentumPct") {
      const j = benchmark?.index.get(this.data.bars[index].date);
      if (!benchmark || j === undefined) return null;
      const a = this.metric("momentumPct", period, index), b = benchmark.metric("momentumPct", period, j);
      return a === null || b === null ? null : a - b;
    }
    if (metric === "rawClose") return this.data.bars[index].close;
    const key = `${metric}:${period}`;
    let values = this.values.get(key);
    if (!values) { values = this.calculate(metric, period); this.values.set(key, values); }
    return values[index] ?? null;
  }
  private calculate(metric: Metric, p: number): Array<number | null> {
    const a = this.price, bars = this.data.bars, n = a.length, out: Array<number | null> = Array(n).fill(null);
    const prefix = (values: number[]) => { const result = [0]; for (const v of values) result.push(result.at(-1)! + v); return result; };
    const prices = prefix(a), dollars = prefix(bars.map(b => b.close * b.volume));
    const gains = prefix(a.map((v, i) => i ? Math.max(0, v - a[i - 1]) : 0));
    const losses = prefix(a.map((v, i) => i ? Math.max(0, a[i - 1] - v) : 0));
    const logReturns = a.map((v, i) => i ? Math.log(v / a[i - 1]) : 0);
    const returns = prefix(logReturns), squares = prefix(logReturns.map(v => v * v));
    const trueRanges = prefix(a.map((_, i) => i ? Math.max(this.high[i] - this.low[i], Math.abs(this.high[i] - a[i - 1]), Math.abs(this.low[i] - a[i - 1])) : 0));
    const sum = (values: number[], i: number) => values[i + 1] - values[i - p + 1];
    let ema: number | null = null;
    const maxQueue: number[] = []; let head = 0;
    const maxima: number[] = Array(n).fill(0);
    for (let i = 0; i < n; i++) {
      while (head < maxQueue.length && maxQueue[head] <= i - p) head++;
      while (maxQueue.length > head && a[maxQueue.at(-1)!] <= a[i]) maxQueue.pop();
      maxQueue.push(i); maxima[i] = a[maxQueue[head]];
    }
    for (let i = p; i < n; i++) {
      switch (metric) {
        case "momentumPct": out[i] = (a[i] / a[i - p] - 1) * 100; break;
        case "distanceSmaPct": out[i] = (a[i] / (sum(prices, i) / p) - 1) * 100; break;
        case "distanceEmaPct":
          // Preserve the existing Slice seed convention for backward compatibility.
          if (ema === null) ema = prices[p] / p;
          ema = a[i] * (2 / (p + 1)) + ema * (1 - 2 / (p + 1)); out[i] = (a[i] / ema - 1) * 100; break;
        case "rsi": { const up = sum(gains, i), down = sum(losses, i); out[i] = up + down === 0 ? 50 : down <= 0 ? 100 : 100 - 100 / (1 + up / down); break; }
        case "volatilityPct": { const total = sum(returns, i), variance = Math.max(0, (sum(squares, i) - total * total / p) / (p - 1)); out[i] = Math.sqrt(variance * 252) * 100; break; }
        case "drawdownPct": out[i] = (a[i] / maxima[i] - 1) * 100; break;
        case "breakoutPct": out[i] = (a[i] / maxima[i - 1] - 1) * 100; break;
        case "averageDollarVolume": out[i] = sum(dollars, i) / p; break;
        case "atrPct": out[i] = sum(trueRanges, i) / p / a[i] * 100; break;
      }
      if (out[i] !== null && !Number.isFinite(out[i])) out[i] = null;
    }
    return out;
  }
}
export function ruleMatches(value: number | null, rule: Rule): boolean {
  if (value === null || !Number.isFinite(value)) return false;
  switch (rule.comparator) {
    case ">": return value > rule.value;
    case ">=": return value >= rule.value;
    case "<": return value < rule.value;
    case "<=": return value <= rule.value;
    case "between": return value >= rule.value && value <= (rule.upper ?? rule.value);
  }
}
export function evaluateRules(set: RuleSet, s: Series, i: number, b: Series, empty: boolean): boolean {
  if (!set.rules.length) return empty;
  const match = (r: Rule) => ruleMatches(s.metric(r.metric, r.period, i, b), r);
  return set.mode === "all" ? set.rules.every(match) : set.rules.some(match);
}
