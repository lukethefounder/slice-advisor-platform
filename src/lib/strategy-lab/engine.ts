import { ENGINE_VERSION, PROVIDER, StrategyError, manifestOf, type StrategySpec, type Dataset, type DailyBar, type BacktestResult, type EquityPoint, type Trade, type ActionEvent, type Performance } from "./contracts";
import { Series, evaluateRules } from "./indicators";
import { validateSpec } from "./validation";
const DAY = 86400000;
function at(s: Series, date: string): DailyBar {
  const i = s.index.get(date);
  if (i === undefined) throw new StrategyError("MISSING_SESSION", `${s.data.symbol}: missing ${date}; the run was blocked, not filled or shortened.`);
  return s.data.bars[i];
}
export function requiredWarmup(s: StrategySpec): number {
  const ranking = s.ranking === "alphabetical" && s.weighting === "equal" ? 2 : s.rankingPeriod;
  return Math.max(2, ranking, ...[...s.entry.rules, ...s.exit.rules].map(r => r.period)) + 2;
}
function rebalanceDue(mode: StrategySpec["rebalance"], date: string, prior: string, first: boolean): boolean {
  if (first || mode === "daily") return true;
  if (mode === "once") return false;
  if (mode === "monthly") return date.slice(0, 7) !== prior.slice(0, 7);
  if (mode === "quarterly") return `${date.slice(0, 4)}-${Math.floor((Number(date.slice(5, 7)) - 1) / 3)}` !== `${prior.slice(0, 4)}-${Math.floor((Number(prior.slice(5, 7)) - 1) / 3)}`;
  const monday = (v: string) => { const d = new Date(v); return d.getTime() - ((d.getUTCDay() + 6) % 7) * DAY; };
  return monday(date) !== monday(prior);
}
function allocate(scores: { symbol: string; value: number }[], gross: number, cap: number): Record<string, number> {
  const w: Record<string, number> = {}; let free = [...scores], remaining = gross;
  while (free.length && remaining > 1e-12) {
    const sum = free.reduce((a, b) => a + b.value, 0);
    if (!(sum > 0)) break;
    const capped = free.filter(x => remaining * x.value / sum > cap);
    if (!capped.length) { for (const x of free) w[x.symbol] = remaining * x.value / sum; break; }
    for (const x of capped) { w[x.symbol] = cap; remaining -= cap; }
    const keys = new Set(capped.map(x => x.symbol)); free = free.filter(x => !keys.has(x.symbol));
  }
  return w;
}
type Holding = { shares: number; opened: number; peakClose: number };
function portfolio(spec: StrategySpec, prepared: Map<string, Series>, reference: Series, dates: string[], priorDates: string[]) {
  const holdings = new Map<string, Holding>(), cooldown = new Map<string, number>();
  const equity: EquityPoint[] = [], trades: Trade[] = [], corporateActions: ActionEvent[] = [];
  let cash = spec.initialCapital, peakEquity = cash, lastEquity = cash, halted = false;
  const feeRate = spec.feeBps / 10000, slip = spec.slippageBps / 10000;
  const seriesOf = (symbol: string) => { const s = prepared.get(symbol); if (!s) throw new StrategyError("DATASET_MISSING", symbol); return s; };
  for (let day = 0; day < dates.length; day++) {
    const date = dates[day], signalDate = priorDates[day];
    const exits = new Map<string, string>();
    // Signals use yesterday's close and information already observed at that close.
    if (spec.portfolioStopPct !== null && lastEquity / peakEquity - 1 <= -spec.portfolioStopPct / 100) halted = true;
    for (const [symbol, h] of holdings) {
      const s = seriesOf(symbol), j = s.index.get(signalDate)!;
      if (halted) exits.set(symbol, "Portfolio closing-drawdown circuit: cash for remainder of run");
      else if (spec.trailingStopPct !== null && at(s, signalDate).close <= h.peakClose * (1 - spec.trailingStopPct / 100)) exits.set(symbol, "Prior-close trailing stop");
      else if (spec.maxHoldingSessions !== null && day - h.opened >= spec.maxHoldingSessions) exits.set(symbol, "Maximum holding sessions");
      else if (evaluateRules(spec.exit, s, j, reference, false)) exits.set(symbol, "Exit criteria at prior close");
    }
    // Corporate actions apply to shares carried from the preceding session, before new trades.
    for (const [symbol, h] of holdings) {
      const b = at(seriesOf(symbol), date);
      if (b.split !== 1) { h.shares *= b.split; h.peakClose /= b.split; corporateActions.push({ date, symbol, type: "SPLIT", value: b.split, shares: h.shares, cash: 0 }); }
      if (b.dividend > 0) { const amount = h.shares * b.dividend; cash += amount; corporateActions.push({ date, symbol, type: "DIVIDEND", value: b.dividend, shares: h.shares, cash: amount }); }
    }
    const navOpen = cash + [...holdings].reduce((s, [symbol, h]) => s + h.shares * at(seriesOf(symbol), date).open, 0);
    const targets: Record<string, number> = {};
    const rebalance = rebalanceDue(spec.rebalance, date, signalDate, day === 0);
    if (rebalance && !halted) {
      const candidates = spec.symbols.flatMap(symbol => {
        if (exits.has(symbol) || day < (cooldown.get(symbol) ?? -1)) return [];
        const s = seriesOf(symbol), i = s.index.get(signalDate)!;
        if (!evaluateRules(spec.entry, s, i, reference, true)) return [];
        const metric = spec.ranking === "low-volatility" ? "volatilityPct" : spec.ranking === "relative-strength" ? "relativeMomentumPct" : "momentumPct";
        const rank = spec.ranking === "alphabetical" ? 0 : s.metric(metric, spec.rankingPeriod, i, reference);
        if (rank === null) return [];
        const vol = spec.weighting === "inverse-volatility" ? s.metric("volatilityPct", spec.rankingPeriod, i, reference) : 1;
        if (vol === null || (spec.weighting === "inverse-volatility" && vol <= 0)) return [];
        return [{ symbol, rank: spec.ranking === "low-volatility" ? -rank : rank, value: spec.weighting === "equal" ? 1 : 1 / vol }];
      }).sort((a, b) => b.rank - a.rank || a.symbol.localeCompare(b.symbol)).slice(0, spec.maxHoldings);
      const weights = allocate(candidates, spec.maxExposurePct / 100, spec.maxPositionPct / 100);
      for (const [symbol, w] of Object.entries(weights)) targets[symbol] = w * navOpen / at(seriesOf(symbol), date).open;
    } else if (!halted) {
      for (const [symbol, h] of holdings) if (!exits.has(symbol)) targets[symbol] = h.shares;
    }
    function execute(symbol: string, side: "BUY" | "SELL", requested: number, reason: string) {
      if (requested < 1e-9) return;
      const b = at(seriesOf(symbol), date);
      if (b.volume <= 0) throw new StrategyError("NONTRADABLE_BAR", `${symbol} has zero-volume data on ${date}; no fill was fabricated.`);
      const fillPrice = b.open * (1 + (side === "BUY" ? slip : -slip));
      const affordable = Math.max(0, (cash - spec.commissionUsd) / (fillPrice * (1 + feeRate)));
      const shares = side === "BUY" ? Math.min(requested, affordable) : Math.min(requested, holdings.get(symbol)?.shares ?? 0);
      if (shares < 1e-9) return;
      const notional = shares * fillPrice, fee = notional * feeRate + spec.commissionUsd;
      if (side === "SELL" && notional < fee) throw new StrategyError("COST_EXCEEDS_TRADE", "Commission exceeds a sale's proceeds; adjust capital, costs, or universe.");
      const h = holdings.get(symbol);
      if (side === "SELL") {
        cash += notional - fee;
        if (h) { h.shares -= shares; if (h.shares < 1e-8) { holdings.delete(symbol); cooldown.set(symbol, day + 1 + spec.cooldownSessions); } }
      } else {
        cash -= notional + fee;
        if (h) h.shares += shares;
        else holdings.set(symbol, { shares, opened: day, peakClose: b.open });
      }
      if (cash < -1e-5) throw new StrategyError("NEGATIVE_CASH", "Internal cash invariant failed.");
      cash = Math.max(0, cash);
      trades.push({ date, signalDate, symbol, side, shares, rawOpen: b.open, fillPrice, notional, fee, slippage: shares * Math.abs(fillPrice - b.open), reason });
    }
    // Sell before buying; deterministic ordering, no leverage and no same-day signal fills.
    for (const symbol of [...holdings.keys()].sort()) {
      const delta = holdings.get(symbol)!.shares - (targets[symbol] ?? 0);
      execute(symbol, "SELL", Math.max(0, delta), exits.get(symbol) ?? "Scheduled ranking / allocation rebalance");
    }
    for (const symbol of Object.keys(targets).sort()) {
      const delta = targets[symbol] - (holdings.get(symbol)?.shares ?? 0);
      execute(symbol, "BUY", Math.max(0, delta), "Prior-close entry and ranking; next-session open");
    }
    let invested = 0; const values: Record<string, number> = {};
    for (const [symbol, h] of holdings) {
      const close = at(seriesOf(symbol), date).close; h.peakClose = Math.max(h.peakClose, close);
      values[symbol] = h.shares * close; invested += values[symbol];
    }
    const nav = cash + invested;
    if (!(nav > 0) || !Number.isFinite(nav)) throw new StrategyError("INVALID_NAV", "Portfolio accounting failed; results were not published.");
    peakEquity = Math.max(peakEquity, nav);
    equity.push({ date, equity: nav, cash, invested, drawdownPct: (nav / peakEquity - 1) * 100,
      dailyReturnPct: (nav / lastEquity - 1) * 100, weights: Object.fromEntries(Object.entries(values).map(([s, value]) => [s, value / nav * 100])) });
    lastEquity = nav;
  }
  return { equity, trades, corporateActions, halted };
}
function performance(spec: StrategySpec, p: ReturnType<typeof portfolio>): Performance {
  const curve = p.equity, end = curve.at(-1)!.equity, n = curve.length;
  const r = curve.map(x => x.dailyReturnPct / 100), avg = r.reduce((a, b) => a + b, 0) / n;
  const sd = n > 1 ? Math.sqrt(r.reduce((a, b) => a + (b - avg) ** 2, 0) / (n - 1)) : 0;
  const years = (Date.parse(curve.at(-1)!.date) - Date.parse(curve[0].date) + DAY) / (365.25 * DAY);
  const rf = (1 + spec.riskFreeRatePct / 100) ** (1 / 252) - 1;
  return { totalReturnPct: (end / spec.initialCapital - 1) * 100,
    cagrPct: n >= 2 && years > 0 ? ((end / spec.initialCapital) ** (1 / years) - 1) * 100 : null,
    maxDrawdownPct: Math.min(0, ...curve.map(x => x.drawdownPct)), annualizedVolatilityPct: n > 1 ? sd * Math.sqrt(252) * 100 : null,
    sharpe: n > 1 && sd > 1e-12 ? (avg - rf) / sd * Math.sqrt(252) : null,
    dailyWinRatePct: n ? r.filter(x => x > 0).length / n * 100 : null,
    tradeCount: p.trades.length, fees: p.trades.reduce((a, x) => a + x.fee, 0), slippage: p.trades.reduce((a, x) => a + x.slippage, 0),
    dividends: p.corporateActions.reduce((a, x) => a + x.cash, 0), averageExposurePct: curve.reduce((a, x) => a + x.invested / x.equity, 0) / n * 100, finalEquity: end };
}
export function runBacktest(rawSpec: unknown, datasets: Dataset[], now = new Date(), options: { allowSingleSession?: boolean } = {}): BacktestResult {
  const spec = validateSpec(rawSpec, now, options), unique = [...new Set([...spec.symbols, spec.benchmark])];
  const prepared = new Map<string, Series>();
  for (const symbol of unique) {
    const matches = datasets.filter(d => d.symbol === symbol);
    if (matches.length !== 1 || matches[0].provider !== PROVIDER || matches[0].currency !== "USD") throw new StrategyError("DATASET_CONTRACT", `Exactly one Alpha Vantage USD dataset is required for ${symbol}.`);
    const d = matches[0];
    if (!/^[a-f0-9]{64}$/.test(d.sourceSha256) || !Number.isFinite(Date.parse(d.retrievedAt)) || Date.parse(d.retrievedAt) > now.getTime() + 600000)
      throw new StrategyError("PROVENANCE_INVALID", `Invalid provenance for ${symbol}.`);
    if (!d.bars.length || d.bars.length > 10000) throw new StrategyError("DATASET_SIZE", "History must contain 1–10,000 daily bars.");
    prepared.set(symbol, new Series(d));
  }
  const reference = prepared.get(spec.benchmark)!;
  const allDates = reference.data.bars.map(b => b.date), dates = allDates.filter(d => d >= spec.startDate && d <= spec.endDate);
  if (dates.length < (options.allowSingleSession ? 1 : 2)) throw new StrategyError("EMPTY_PERIOD", "Not enough complete benchmark trading sessions for this calculation.");
  if (Date.parse(dates[0]) - Date.parse(spec.startDate) > 4 * DAY || Date.parse(spec.endDate) - Date.parse(dates.at(-1)!) > 4 * DAY)
    throw new StrategyError("BENCHMARK_COVERAGE", "Benchmark history does not cover the requested period. Shortened tests are not substituted.");
  const criterionWork = unique.length * reference.data.bars.length * [...spec.entry.rules, ...spec.exit.rules].reduce((n, rule) => n + rule.period, spec.rankingPeriod);
  if (criterionWork > 200000000) throw new StrategyError("COMPUTATION_LIMIT", "This test exceeds the interactive work budget. Use fewer distinct criteria, instruments, or shorter lookbacks.");
  const warmup = requiredWarmup(spec), first = allDates.indexOf(dates[0]);
  if (first < warmup) throw new StrategyError("WARMUP_REQUIRED", `Need ${warmup} prior benchmark sessions before the first test session.`);
  const requiredDates = allDates.slice(first - warmup, first + dates.length);
  for (const symbol of unique) {
    const series = prepared.get(symbol)!;
    for (const date of requiredDates) at(series, date);
    for (const bar of series.data.bars) {
      if (bar.date >= requiredDates[0] && bar.date <= dates.at(-1)! && !reference.index.has(bar.date))
        throw new StrategyError("MISSING_BENCHMARK_SESSION", `Benchmark is missing ${bar.date}, which exists for ${symbol}; the calendar was not shortened.`);
    }
  }
  const previous = dates.map((_, i) => allDates[first + i - 1]);
  const p = portfolio(spec, prepared, reference, dates, previous);
  const bSpec: StrategySpec = { ...spec, symbols: [spec.benchmark], entry: { mode: "all", rules: [] }, exit: { mode: "any", rules: [] }, ranking: "alphabetical", weighting: "equal", rebalance: "once", maxHoldings: 1, maxPositionPct: 100, maxExposurePct: 100, trailingStopPct: null, portfolioStopPct: null, maxHoldingSessions: null };
  const b = portfolio(bSpec, prepared, reference, dates, previous), strategy = performance(spec, p), benchmark = performance(bSpec, b);
  const groups = new Map<string, { first: number; last: number }>();
  dates.forEach((date, i) => { const m = date.slice(0, 7); const g = groups.get(m); groups.set(m, { first: g?.first ?? i, last: i }); });
  const monthly = [...groups].map(([month, g]) => ({ month,
    strategyPct: (p.equity[g.last].equity / (g.first ? p.equity[g.first - 1].equity : spec.initialCapital) - 1) * 100,
    benchmarkPct: (b.equity[g.last].equity / (g.first ? b.equity[g.first - 1].equity : spec.initialCapital) - 1) * 100 }));
  const warnings = [
    "Fixed universe chosen by the user. Results are not survivorship-bias-free sector-constituent backtests.",
    "Vendor-current historical data retrieved now, not an archive of what was originally published on each past date. Revisions can exist.",
    "Signals use completed prior-session bars. Fills use the following session's raw open with the stated slippage and fees.",
    "Corporate splits adjust carried shares; cash dividends are credited on the vendor ex-date, not the actual payment date. Dividend cash is not automatically reinvested.",
    "Fractional shares, unlimited modeled fill liquidity, USD-only, long-only, no leverage or taxes. Final holdings are marked at the last close, not liquidated.",
    "Closing stops execute at the next open, not at an intraday trigger price. Gaps may exceed the selected stop percentage.",
    "Risk-free rate is a user-specified constant used only for Sharpe. Uninvested cash earns zero interest.",
    "Historical results are hypothetical. Repeatedly adjusting criteria to fit the same period creates selection bias; reserve a separate test period.",
  ];
  if (dates.length < 252) warnings.push("Less than one trading year: annualized metrics can be unstable.");
  if (p.halted) warnings.push("Portfolio closing-drawdown circuit triggered. The strategy remained in cash afterward.");
  const diff = strategy.totalReturnPct - benchmark.totalReturnPct;
  return { version: 1, engineVersion: ENGINE_VERSION, classification: "hypothetical-historical-simulation", spec, effectiveStart: dates[0], effectiveEnd: dates.at(-1)!, signalWarmupSessions: warmup,
    manifests: unique.map(s => manifestOf(prepared.get(s)!.data)), strategy, benchmark,
    equity: p.equity, benchmarkEquity: b.equity, trades: p.trades, corporateActions: p.corporateActions, monthly, warnings,
    interpretation: [
      `The strategy ${diff >= 0 ? "outperformed" : "underperformed"} ${spec.benchmark} by ${Math.abs(diff).toFixed(2)} percentage points over this exact period, after the modeled costs.`,
      `Largest closing drawdown: ${Math.abs(strategy.maxDrawdownPct).toFixed(2)}%; benchmark: ${Math.abs(benchmark.maxDrawdownPct).toFixed(2)}%.`,
      `Average invested exposure was ${strategy.averageExposurePct.toFixed(1)}%. The rest was zero-interest cash.`,
      `${strategy.tradeCount} simulated orders incurred $${strategy.fees.toFixed(2)} in commissions/fees and $${strategy.slippage.toFixed(2)} in modeled slippage.`,
      "This is an explanation of historical simulated outcomes, not a forecast or a recommendation to trade.",
    ] };
}
