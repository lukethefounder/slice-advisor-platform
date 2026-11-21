import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { getEconomicResearch } from "@/lib/intelligence/economic-live";
import { marketConfiguration } from "@/lib/market-evidence/configuration";
import { MarketError, easternIso, finite, freshness, obj } from "@/lib/market-evidence/core";
import { exactInstrument, isIndex } from "@/lib/market-evidence/instruments";
import { marketStorage } from "@/lib/market-evidence/storage";
import { createMarketReader, safeMarketError } from "@/lib/market-evidence/transport";
import { buildBoardSnapshot } from "@/lib/market-visuals/board-snapshot";
import { loadMarketSection } from "@/lib/market-visuals/service";
import { defaultSpec, engineVersionFor, manifestOf, StrategyError, templateSpec, type BacktestResult, type Dataset, type StrategySpec } from "@/lib/strategy-lab/contracts";
import { runBacktest } from "@/lib/strategy-lab/engine";
import { importHistory, loadDatasets } from "@/lib/strategy-lab/provider";
import { validateSpec } from "@/lib/strategy-lab/validation";
import type { Entitlement, MarketReceipt } from "@/lib/market-evidence/contracts";
import type { SectionResponse } from "@/lib/market-visuals/contracts";
import type { AgentEvidence, DeskScope } from "./contracts";
import { benchmarkRiskAppetite, buildHistoricalAnalogues } from "./historical-scenarios";
import type { DeskResearchTools, DeskScenarios, ResearchToolIssue, ScoutCandidate, ScoutDiscovery, ScoutOrigin, StrategyToolResult } from "./research-tool-types";

const SOURCE_URL = "https://www.alphavantage.co/documentation/";
const SCOUT_TTL = 60_000;
const MAX_SEED_QUOTES = 8;
const CHART_METRICS = ["last-price", "change-pct", "volume", "avg-volume", "rsi-14", "macd", "sma-20", "sma-50", "sma-200", "ema-21", "atr-14", "beta", "market-cap", "pe-ratio", "52-week-high", "52-week-low", "directional-bias"];
const sha = (value: string) => createHash("sha256").update(value).digest("hex");
type WatchSymbol = { symbol: string; name: string };
type Definition = { id: string; name: string; specJson: string };
type RunReceipt = { runId: string; inputSha256: string; outputSha256: string };
type Mover = Omit<ScoutCandidate, "rank" | "reason" | "retrievedAt" | "sourceSha256" | "tradableByPolicy">;

/** Validate vendor symbols, timestamps and measurements before storing/using discovery. */
export function parseScoutMovers(payload: unknown, entitlement: Entitlement, now = Date.now()): Mover[] {
  const body = obj(payload), rawTime = typeof body.last_updated === "string" ? body.last_updated : "";
  const timeMatch = /^(\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) (?:US\/Eastern|America\/New_York)$/.exec(rawTime);
  const observedAt = timeMatch ? easternIso(timeMatch[1]) : null;
  if (!observedAt || now - Date.parse(observedAt) > 7 * 86400000 || Date.parse(observedAt) - now > 60_000)
    throw new MarketError("SCOUT_TIME", "Market discovery lacks a valid observation from the last seven days; a new retrieval time cannot make an old scan current.", 502);
  const base = entitlement === "historical" ? freshness(observedAt.slice(0, 10), "date", entitlement, now) : freshness(observedAt, "timestamp", entitlement, now);
  const buckets = [["top_gainers", "top-gainers"], ["top_losers", "top-losers"], ["most_actively_traded", "most-active"]] as const;
  const found = new Map<string, Mover>();
  for (const [key, origin] of buckets) {
    if (!Array.isArray(body[key])) continue;
    for (const raw of body[key].slice(0, 20)) {
      const row = obj(raw), ticker = typeof row.ticker === "string" ? row.ticker.trim().toUpperCase() : "";
      const price = finite(row.price), volume = finite(row.volume), changePct = finite(row.change_percentage);
      if (!/^[A-Z][A-Z0-9.-]{0,14}$/.test(ticker) || price === null || price <= 0 || volume === null || volume <= 0 || changePct === null || changePct <= -100) continue;
      const prior = found.get(ticker);
      if (prior) { if (!prior.origins.includes(origin)) prior.origins.push(origin); continue; }
      found.set(ticker, { symbol: ticker, name: ticker, origins: [origin], observedAt, price, changePct, volume, state: base.state,
        source: "Alpha Vantage TOP_GAINERS_LOSERS", sourceUrl: `${SOURCE_URL}#top-gainers-losers` });
    }
  }
  if (!found.size) throw new MarketError("SCOUT_EMPTY", "The provider scan contained no valid dated equity/ETF candidates.", 502);
  return [...found.values()];
}

async function readMovers(scope: DeskScope, signal: AbortSignal, force: boolean, now: number) {
  const configuration = marketConfiguration(), receipts: MarketReceipt[] = [];
  const read = createMarketReader(configuration, marketStorage(scope), signal, receipts, force);
  const params: Record<string, string> = configuration.entitlement === "historical" ? {} : { entitlement: configuration.entitlement };
  const rows = await read("TOP_GAINERS_LOSERS", params, SCOUT_TTL, raw => parseScoutMovers(raw, configuration.entitlement, now));
  return { rows, receipts };
}

async function readWatchlists(scope: DeskScope): Promise<WatchSymbol[]> {
  const results = await Promise.all([
    prisma.watchAsset.findMany({ where: { userId: scope.userId }, orderBy: { createdAt: "desc" }, take: 50, select: { ticker: true, name: true } }),
    prisma.namedWatchlistItem.findMany({ where: { userId: scope.userId, watchlist: { userId: scope.userId } }, orderBy: { updatedAt: "desc" }, take: 50, select: { symbol: true, assetName: true } }),
  ]);
  return [...results[0].map(row => ({ symbol: row.ticker, name: row.name })), ...results[1].map(row => ({ symbol: row.symbol, name: row.assetName }))];
}
async function readDefinitions(scope: DeskScope): Promise<Definition[]> {
  return prisma.sliceStrategyDefinition.findMany({ where: { userId: scope.userId }, orderBy: { updatedAt: "desc" }, take: 50, select: { id: true, name: true, specJson: true } });
}

/** Use the same immutable result identity and owner filter as Strategy Studio. */
async function persistBacktest(scope: DeskScope, spec: StrategySpec, datasets: Dataset[], result: BacktestResult): Promise<RunReceipt> {
  const inputSha256 = sha(JSON.stringify({ spec, engineVersion: engineVersionFor(spec), sources: datasets.map(manifestOf).sort((a, b) => a.symbol.localeCompare(b.symbol)) }));
  const resultJson = JSON.stringify(result), outputSha256 = sha(resultJson);
  if (Buffer.byteLength(resultJson, "utf8") > 3_200_000) throw new StrategyError("RESULT_LIMIT", "The saved scenario exceeds the Strategy Studio audit limit. No partial result was saved.");
  const existing = await prisma.sliceStrategyRun.findFirst({ where: { userId: scope.userId, inputSha256 }, orderBy: { createdAt: "desc" }, select: { id: true, resultJson: true, outputSha256: true } });
  if (existing) {
    if (sha(existing.resultJson) !== existing.outputSha256 || existing.outputSha256 !== outputSha256)
      throw new StrategyError("RESULT_INTEGRITY", "A matching historical run failed its immutable result verification.", 409);
    return { runId: existing.id, inputSha256, outputSha256 };
  }
  const saved = await prisma.sliceStrategyRun.create({ data: { userId: scope.userId, name: spec.name, engineVersion: engineVersionFor(spec), inputSha256, outputSha256,
    datasetIdsJson: JSON.stringify(datasets.map(row => row.id)), resultJson,
    summaryJson: JSON.stringify({ start: result.effectiveStart, end: result.effectiveEnd, benchmark: spec.benchmark, universe: spec.symbols, strategy: result.strategy, benchmarkPerformance: result.benchmark }) }, select: { id: true } });
  return { runId: saved.id, inputSha256, outputSha256 };
}

export type ResearchToolsDependencies = {
  now: () => Date; readMovers: typeof readMovers; readWatchlists: typeof readWatchlists;
  readDefinitions: typeof readDefinitions; persistBacktest: typeof persistBacktest;
  marketStorage: typeof marketStorage; loadMarketSection: typeof loadMarketSection;
  getEconomicResearch: typeof getEconomicResearch; importHistory: typeof importHistory; loadDatasets: typeof loadDatasets;
  runBacktest: typeof runBacktest;
};
const defaults: ResearchToolsDependencies = { now: () => new Date(), readMovers, readWatchlists, readDefinitions, persistBacktest,
  marketStorage, loadMarketSection, getEconomicResearch, importHistory, loadDatasets, runBacktest };

function aborted(signal: AbortSignal) { if (signal.aborted) throw signal.reason ?? new DOMException("Research canceled", "AbortError"); }
function issue(tool: ResearchToolIssue["tool"], error: unknown): ResearchToolIssue {
  if (error instanceof StrategyError) return { tool, code: error.code, message: error.message };
  const safe = safeMarketError(error); return { tool, code: safe.code, message: safe.message };
}
function checkScope(scope: DeskScope) { if (!scope.userId || !scope.firmId) throw new MarketError("SCOPE_REQUIRED", "An authenticated owner and workspace are required for agent research.", 403); }

/** One provider scan plus at most eight watched/configured quotes per refresh; no account policy mutation. */
export async function discoverScoutCandidates(scope: DeskScope, input: { universe?: string[]; exclude?: string[]; limit?: number; signal: AbortSignal; forceRefresh?: boolean }, overrides: Partial<ResearchToolsDependencies> = {}): Promise<ScoutDiscovery> {
  checkScope(scope); aborted(input.signal);
  const deps = { ...defaults, ...overrides }, now = deps.now(), checkedAt = now.toISOString();
  const issues: ResearchToolIssue[] = [], receipts: MarketReceipt[] = [];
  const normalize = (values: string[]) => [...new Set(values.map(value => value.trim().toUpperCase()).filter(value => /^[A-Z][A-Z0-9.-]{0,14}$/.test(value)))];
  if (input.universe && (input.universe.length > 100 || input.universe.some(value => typeof value !== "string" || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(value.trim().toUpperCase()))))
    throw new MarketError("SCOUT_UNIVERSE", "The research universe supports at most 100 exact equity/ETF symbols. Invalid instruments are not replaced or silently removed.");
  const universe = normalize((input.universe ?? []).slice(0, 100)), excluded = new Set(normalize(input.exclude ?? []));
  const allowed = new Set(universe), candidates = new Map<string, ScoutCandidate>();
  const eligible = (symbol: string) => !excluded.has(symbol) && (!allowed.size || allowed.has(symbol));
  const results = await Promise.allSettled([deps.readMovers(scope, input.signal, Boolean(input.forceRefresh), now.getTime()), deps.readWatchlists(scope)]);
  aborted(input.signal);
  if (results[0].status === "fulfilled") {
    receipts.push(...results[0].value.receipts);
    const receipt = results[0].value.receipts.find(row => row.endpoint === "TOP_GAINERS_LOSERS");
    if (!receipt) issues.push({ tool: "scout", code: "SCOUT_RECEIPT", message: "The market scan has no retrieval receipt and was excluded." });
    else for (const row of results[0].value.rows) if (eligible(row.symbol)) candidates.set(row.symbol, { ...row, retrievedAt: receipt.retrievedAt, sourceSha256: receipt.sha256, rank: 0, reason: "", tradableByPolicy: false });
  } else issues.push(issue("scout", results[0].reason));
  const watched = results[1].status === "fulfilled" ? results[1].value : [];
  if (results[1].status === "rejected") issues.push(issue("scout", results[1].reason));
  const seedMap = new Map<string, WatchSymbol & { origin: ScoutOrigin }>();
  for (const item of watched) for (const symbol of normalize([item.symbol])) if (eligible(symbol)) seedMap.set(symbol, { symbol, name: item.name, origin: "watchlist" });
  for (const symbol of universe) if (eligible(symbol) && !seedMap.has(symbol)) seedMap.set(symbol, { symbol, name: symbol, origin: "research-universe" });
  for (const seed of seedMap.values()) {
    const candidate = candidates.get(seed.symbol);
    if (candidate) { candidate.name = seed.name; if (!candidate.origins.includes(seed.origin)) candidate.origins.push(seed.origin); }
  }
  const pending = [...seedMap.values()].filter(row => !candidates.has(row.symbol));
  // Stable minute buckets rotate a bounded slice through a larger research universe.
  const offset = pending.length ? Math.floor(now.getTime() / SCOUT_TTL) * MAX_SEED_QUOTES % pending.length : 0;
  const selected = [...pending.slice(offset), ...pending.slice(0, offset)].slice(0, MAX_SEED_QUOTES);
  const storage = deps.marketStorage(scope);
  for (let index = 0; index < selected.length; index += 2) {
    aborted(input.signal);
    const batch = await Promise.allSettled(selected.slice(index, index + 2).map(async seed => {
      const response = await deps.loadMarketSection({ section: "quote", symbol: seed.symbol, range: "3M", confirmOptions: false }, storage, input.signal, Boolean(input.forceRefresh));
      const quote = response.data.find(row => row.symbol === seed.symbol), receipt = response.receipts.at(-1);
      if (!quote || !receipt || quote.state === "unavailable" || quote.state === "stale" || now.getTime() - Date.parse(quote.observedAt) > 7 * 86400000)
        throw new MarketError("SCOUT_QUOTE", `${seed.symbol}: a current dated quote is required before it can enter the research shortlist.`);
      return { receipts: response.receipts, candidate: { symbol: seed.symbol, name: seed.name, rank: 0, reason: "", origins: [seed.origin], price: quote.price,
        changePct: quote.changePct, volume: quote.volume, state: quote.state, observedAt: quote.observedAt, retrievedAt: receipt.retrievedAt, source: `Alpha Vantage ${quote.endpoint}`,
        sourceUrl: `${SOURCE_URL}#latestprice`, sourceSha256: receipt.sha256, tradableByPolicy: false } satisfies ScoutCandidate };
    }));
    aborted(input.signal);
    for (const result of batch) if (result.status === "fulfilled") { receipts.push(...result.value.receipts); candidates.set(result.value.candidate.symbol, result.value.candidate); } else issues.push(issue("scout", result.reason));
  }
  if (pending.length > selected.length) issues.push({ tool: "scout", code: "SCOUT_ROTATION", message: `${selected.length} of ${pending.length} additional watched/configured instruments were quoted this refresh; subsequent scans rotate through the remainder.` });
  const interest = (row: ScoutCandidate) => (row.origins.includes("most-active") ? 20 : 0) + Math.min(40, Math.abs(row.changePct ?? 0) * 2) + Math.min(40, Math.max(0, Math.log10(Math.max(1, row.price * (row.volume ?? 0))) - 4) * 6);
  const ranked = [...candidates.values()].sort((a, b) => interest(b) - interest(a) || a.symbol.localeCompare(b.symbol));
  const limit = Math.max(1, Math.min(20, Number.isFinite(input.limit) ? Math.floor(input.limit!) : 12));
  ranked.forEach((row, index) => { row.rank = index + 1; row.reason = `${row.origins.join(", ")}; observed change ${row.changePct === null ? "unavailable" : `${row.changePct.toFixed(2)}%`}; activity rank ${index + 1}. This is a research priority, not an expected-return score.`; });
  return { version: 1, checkedAt, candidates: ranked.slice(0, limit), receipts, issues, refreshAfterMs: SCOUT_TTL, scannedCount: candidates.size,
    method: "Actual provider gainers, losers and most-active lists, with independently quoted owner watchlists and a rotating configured research universe. Sort by observed absolute movement and dollar activity; exclude unsupported or stale observations. Discovery never changes execution permission.", tradingAllowlistChanged: false };
}

/** Stable, source-bound candidate IDs let Scout inspect and cite the exact observed shortlist. */
export function scoutDiscoveryEvidence(discovery: ScoutDiscovery): AgentEvidence[] {
  return discovery.candidates.map(candidate => ({
    id: `desk-scout-${sha(JSON.stringify({ symbol: candidate.symbol, observedAt: candidate.observedAt, sourceSha256: candidate.sourceSha256 })).slice(0, 24)}`,
    title: `${candidate.symbol} · observed scout candidate`, summary: `${candidate.name}. ${candidate.reason} Observation state: ${candidate.state}. This discovery grants no permission to trade.`,
    source: candidate.source, url: candidate.sourceUrl, observedAt: candidate.observedAt, retrievedAt: candidate.retrievedAt,
    kind: "tool-research", cohort: "discovery", metrics: { symbol: candidate.symbol, price: candidate.price, changePct: candidate.changePct, volume: candidate.volume,
      rank: candidate.rank, origins: candidate.origins.join(","), sourceSha256: candidate.sourceSha256, discoveryAuthorizesTrading: false },
  }));
}

async function strategyResult(scope: DeskScope, definitionId: string | null, spec: StrategySpec, datasets: Dataset[], deps: ResearchToolsDependencies, signal: AbortSignal): Promise<StrategyToolResult> {
  const base: StrategyToolResult = { definitionId, source: definitionId ? "user-definition" : "fixed-template", name: spec.name, status: "unavailable", spec,
    runId: null, engineVersion: null, inputSha256: null, outputSha256: null, effectiveStart: null, effectiveEnd: null, manifests: datasets.map(manifestOf), strategy: null, benchmark: null,
    development: null, validation: null, validationStartDate: null, classification: "hypothetical-historical-simulation", warnings: [], error: null };
  try {
    aborted(signal);
    const result = deps.runBacktest(spec, datasets, deps.now());
    aborted(signal);
    const receipt = await deps.persistBacktest(scope, spec, datasets, result);
    const dates = result.equity.map(row => row.date), split = Math.floor(dates.length * 0.7);
    let development = null, validation = null, validationStartDate: string | null = null;
    const warnings = [...result.warnings, "Fixed rules were not tuned on the validation partition. Development and validation restart with the same initial capital, so their returns do not compound into the full-period result."];
    if (split >= 20 && dates.length - split >= 20) {
      try {
        const dev = deps.runBacktest({ ...spec, endDate: dates[split - 1] }, datasets, deps.now());
        const test = deps.runBacktest({ ...spec, startDate: dates[split] }, datasets, deps.now());
        development = dev.strategy; validation = test.strategy; validationStartDate = dates[split];
        warnings.push("This chronological holdout is an evaluation aid, not evidence that a user-defined rule was never selected after viewing history. Daily-bar simulations cannot establish intraday execution quality.");
      } catch { warnings.push("Separate chronological partition simulations are unavailable for this specification; only the full-period result is shown."); }
    } else warnings.push("Fewer than 20 sessions in a chronological partition; no separate development/validation performance is reported.");
    return { ...base, ...receipt, status: "complete", engineVersion: result.engineVersion, effectiveStart: result.effectiveStart, effectiveEnd: result.effectiveEnd,
      manifests: result.manifests, strategy: result.strategy, benchmark: result.benchmark, development, validation, validationStartDate, warnings };
  } catch (error) { aborted(signal); return { ...base, error: issue("scenarios", error).message }; }
}

export async function loadHistoricalScenarios(scope: DeskScope, input: { symbol: string; signal: AbortSignal; forceRefresh?: boolean }, overrides: Partial<ResearchToolsDependencies> = {}): Promise<DeskScenarios> {
  checkScope(scope); aborted(input.signal);
  const deps = { ...defaults, ...overrides }, symbol = exactInstrument(input.symbol), checkedAt = deps.now().toISOString();
  const result: DeskScenarios = { status: "unavailable", symbol, checkedAt, manifests: [], analogues: null, strategies: [], savedDefinitionsChecked: 0, skippedDefinitions: [], benchmark: null, issues: [] };
  if (isIndex(symbol)) { result.issues.push({ tool: "scenarios", code: "INDEX_NOT_INVESTABLE", message: "Strategy Studio historical fills require a verified US equity or ETF. An index is not silently substituted with a tradable ETF." }); return result; }
  const symbols = [...new Set([symbol, "SPY"])];
  const imported = await Promise.allSettled(symbols.map(item => deps.importHistory(scope.userId, item, Boolean(input.forceRefresh))));
  aborted(input.signal);
  const ids: string[] = [];
  for (const value of imported) if (value.status === "fulfilled") ids.push(value.value.id); else result.issues.push(issue("scenarios", value.reason));
  let datasets: Dataset[] = [];
  if (ids.length) try { datasets = await deps.loadDatasets(scope.userId, ids); } catch (error) { result.issues.push(issue("scenarios", error)); }
  aborted(input.signal);
  result.manifests = datasets.map(manifestOf);
  for (const manifest of result.manifests) if (Date.parse(checkedAt) - Date.parse(manifest.lastDate) > 7 * 86400000)
    result.issues.push({ tool: "scenarios", code: "HISTORY_STALE", message: `${manifest.symbol}: history ends ${manifest.lastDate}. Historical results remain inspectable, but this is not a current market-state assessment.` });
  const instrument = datasets.find(row => row.symbol === symbol), benchmark = datasets.find(row => row.symbol === "SPY");
  if (benchmark) result.benchmark = benchmarkRiskAppetite(benchmark);
  if (instrument) try { result.analogues = buildHistoricalAnalogues(instrument); } catch (error) { result.issues.push(issue("scenarios", error)); }
  const hasAnalogueSamples = () => Boolean(result.analogues?.scenarios.some(row => row.development.samples > 0 || row.validation.samples > 0));
  if (!instrument || !benchmark) { result.status = hasAnalogueSamples() ? "partial" : "unavailable"; return result; }
  const lastDate = [instrument.bars.at(-1)?.date, benchmark.bars.at(-1)?.date].filter((value): value is string => Boolean(value)).sort()[0];
  if (!lastDate) return result;
  const start = new Date(`${lastDate}T12:00:00Z`); start.setUTCFullYear(start.getUTCFullYear() - 3);
  const prior = { ...defaultSpec(), symbols: [symbol], benchmark: "SPY", universeMode: "fixed-symbols" as const, startDate: start.toISOString().slice(0, 10), endDate: lastDate, acknowledgeFixedUniverse: true };
  const selections: Array<{ id: string | null; spec: StrategySpec }> = ["trend-following", "mean-reversion", "buy-and-hold"].map(template => {
    const spec = templateSpec(template, prior); return { id: null, spec: { ...spec, name: `Agent review · ${symbol} · ${spec.name}`, maxHoldings: 1, maxPositionPct: 100 } };
  });
  try {
    const definitions = await deps.readDefinitions(scope); result.savedDefinitionsChecked = definitions.length;
    for (const definition of definitions) {
      let spec: StrategySpec;
      try { spec = validateSpec(JSON.parse(definition.specJson), deps.now()); }
      catch { result.skippedDefinitions.push({ id: definition.id, name: definition.name, reason: "The saved definition is not currently valid; its rules were not changed." }); continue; }
      if (!spec.symbols.includes(symbol)) continue;
      if (spec.symbols.length !== 1 || !symbols.includes(spec.benchmark)) { result.skippedDefinitions.push({ id: definition.id, name: definition.name, reason: "This bounded single-instrument review does not load the full basket or another benchmark. Run the unchanged definition in Strategy Studio." }); continue; }
      if (selections.length >= 6) { result.skippedDefinitions.push({ id: definition.id, name: definition.name, reason: "Three recent applicable user definitions are reviewed per cycle; this definition remains available in Strategy Studio." }); continue; }
      selections.push({ id: definition.id, spec });
    }
  } catch (error) { result.issues.push(issue("scenarios", error)); }
  for (const selection of selections) {
    aborted(input.signal);
    const required = new Set([...selection.spec.symbols, selection.spec.benchmark]);
    result.strategies.push(await strategyResult(scope, selection.id, selection.spec, datasets.filter(row => required.has(row.symbol)), deps, input.signal));
  }
  const completedStrategies = result.strategies.filter(row => row.status === "complete").length;
  result.status = !hasAnalogueSamples() && !completedStrategies ? "unavailable"
    : hasAnalogueSamples() && result.strategies.every(row => row.status === "complete") && !result.issues.length ? "available" : "partial";
  if (result.status === "unavailable") result.issues.push({ tool: "scenarios", code: "HISTORICAL_SCENARIOS_UNAVAILABLE", message: "No observed analogue samples or completed Strategy Studio simulation were available. Imported bars alone do not establish historical support for a trade." });
  return result;
}

function toolEvidence(bundle: Omit<DeskResearchTools, "evidence">): AgentEvidence[] {
  const evidence: AgentEvidence[] = [], add = (entry: Omit<AgentEvidence, "id" | "kind">) => evidence.push({ ...entry, kind: "tool-research", id: `desk-tool-${sha(JSON.stringify(entry)).slice(0, 24)}` });
  for (const series of bundle.economy.snapshot?.series ?? []) if (series.latestValue !== null && series.asOf) add({ title: series.label, summary: `${series.description} Latest ${series.latestValue} ${series.unit}; prior ${series.previousValue ?? "unavailable"}; ${series.direction}. ${series.warning ?? ""}`,
    source: series.source, url: series.sourceUrl, observedAt: series.asOf, retrievedAt: series.retrievedAt, cohort: "economy",
    metrics: { value: series.latestValue, previousValue: series.previousValue, changePercent: series.changePercent, confidence: series.confidence, interval: series.interval, scoreIsProfitProbability: false } });
  for (const [name, metric] of Object.entries(bundle.charts.snapshot.metrics)) if (metric.value !== null && metric.asOf) {
    const receipt = bundle.charts.snapshot.receipts.filter(row => metric.source.includes(row.endpoint) || (metric.source.includes("daily bars") && row.endpoint.includes("TIME_SERIES"))).at(-1);
    add({ title: `${bundle.symbol} · ${name}`, summary: `${metric.display}. ${metric.detail}`, source: metric.source, url: SOURCE_URL, observedAt: metric.asOf,
      retrievedAt: receipt?.retrievedAt ?? bundle.charts.snapshot.retrievedAt ?? bundle.checkedAt, cohort: "technical", metrics: { value: metric.value, status: metric.status, historyBasis: bundle.charts.historyBasis, sourceSha256: receipt?.sha256 ?? null } });
  }
  const macro = bundle.economy.riskAppetite;
  if (macro) add({ title: `${macro.symbol} · market risk appetite proxy`, summary: "Observed broad-market ETF momentum and volatility. These are indirect risk-appetite proxies, not investor surveys, fund-flow measurements or forward profit probabilities.", source: "Strategy Studio verified adjusted daily history", url: SOURCE_URL,
    observedAt: macro.asOf, retrievedAt: bundle.scenarios.manifests.find(row => row.symbol === macro.symbol)?.retrievedAt ?? bundle.checkedAt, cohort: "economy",
    metrics: { momentum20Pct: macro.momentum20Pct, momentum63Pct: macro.momentum63Pct, annualizedVolatility20Pct: macro.annualizedVolatility20Pct } });
  const analogues = bundle.scenarios.analogues;
  for (const scenario of analogues?.scenarios ?? []) add({ title: `${bundle.symbol} · ${scenario.horizonSessions}-session historical analogues`,
    summary: `${scenario.validation.samples} chronological validation matches; positive adjusted-return frequency ${scenario.validation.positiveReturnFrequencyPct ?? "unavailable"}%. ${scenario.validation.reliability}. Before trading costs; not a calibrated forecast. Development matches ${scenario.development.samples}.`,
    source: "Strategy Studio · chronological historical scenarios", url: "/api/strategy-lab/datasets", observedAt: analogues!.currentRegime?.asOf ?? null, retrievedAt: analogues!.manifest.retrievedAt, cohort: "strategy",
    metrics: { horizonSessions: scenario.horizonSessions, validationSamples: scenario.validation.samples, developmentSamples: scenario.development.samples, historicalPositiveFrequencyPct: scenario.validation.positiveReturnFrequencyPct, meanReturnPct: scenario.validation.meanReturnPct, worstReturnPct: scenario.validation.worstReturnPct,
      wilson95LowPct: scenario.validation.wilson95Pct?.[0] ?? null, wilson95HighPct: scenario.validation.wilson95Pct?.[1] ?? null, calibratedForecastProbability: null, datasetId: analogues!.manifest.id, sourceSha256: analogues!.manifest.sourceSha256 } });
  for (const strategy of bundle.scenarios.strategies) if (strategy.status === "complete" && strategy.strategy && strategy.runId) add({ title: strategy.name, summary: `Hypothetical daily-bar simulation ${strategy.effectiveStart}–${strategy.effectiveEnd}. Return ${strategy.strategy.totalReturnPct.toFixed(2)}%, drawdown ${strategy.strategy.maxDrawdownPct.toFixed(2)}%, ${strategy.strategy.tradeCount} trades; fees and slippage included. Not a forecast or live execution record.`,
    source: "Strategy Studio event-ledger engine", url: `/api/strategy-lab/runs?id=${encodeURIComponent(strategy.runId)}`, observedAt: strategy.effectiveEnd,
    retrievedAt: bundle.checkedAt, cohort: "strategy", metrics: { totalReturnPct: strategy.strategy.totalReturnPct, maxDrawdownPct: strategy.strategy.maxDrawdownPct, tradeCount: strategy.strategy.tradeCount, validationReturnPct: strategy.validation?.totalReturnPct ?? null,
      validationDrawdownPct: strategy.validation?.maxDrawdownPct ?? null, engineVersion: strategy.engineVersion, inputSha256: strategy.inputSha256, outputSha256: strategy.outputSha256 } });
  return evidence;
}

/** Calls the real studio data/metric/engine services; never scrapes UI or synthesizes observations. */
export async function loadDeskResearchTools(scope: DeskScope, input: { symbol: string; signal: AbortSignal; forceRefresh?: boolean }, overrides: Partial<ResearchToolsDependencies> = {}): Promise<DeskResearchTools> {
  checkScope(scope); aborted(input.signal);
  const deps = { ...defaults, ...overrides }, symbol = exactInstrument(input.symbol), checkedAt = deps.now().toISOString(), storage = deps.marketStorage(scope);
  const issues: ResearchToolIssue[] = [], sectionNames = isIndex(symbol) ? ["quote", "history"] as const : ["quote", "history", "fundamentals"] as const;
  const sectionWork = Promise.allSettled(sectionNames.map(section => deps.loadMarketSection({ section, symbol, range: "1Y", confirmOptions: false }, storage, input.signal, Boolean(input.forceRefresh))));
  const economicWork = sectionWork.then(values => {
    aborted(input.signal);
    const company = values.flatMap(value => value.status === "fulfilled" && value.value.section === "fundamentals" ? [value.value as SectionResponse<"fundamentals">] : [])[0];
    return deps.getEconomicResearch({ sector: company?.data.sector ?? "General", industry: company?.data.industry ?? "General", forceRefresh: input.forceRefresh });
  });
  const settled = await Promise.allSettled([
    sectionWork, loadHistoricalScenarios(scope, input, deps), economicWork,
  ]);
  aborted(input.signal);
  const sections: SectionResponse[] = [];
  if (settled[0].status === "fulfilled") for (const value of settled[0].value) { if (value.status === "fulfilled") sections.push(value.value); else issues.push(issue("charts", value.reason)); }
  else issues.push(issue("charts", settled[0].reason));
  const history = sections.find(row => row.section === "history") as SectionResponse<"history"> | undefined;
  const snapshot = buildBoardSnapshot(symbol, symbol, CHART_METRICS, sections, deps.now().getTime());
  const technicalKeys = ["rsi-14", "macd", "sma-20", "sma-50", "sma-200", "ema-21", "atr-14", "directional-bias"];
  const measuredTechnicals = technicalKeys.filter(key => snapshot.metrics[key]?.value != null).length;
  if (!measuredTechnicals) issues.push({ tool: "charts", code: "TECHNICAL_HISTORY_UNAVAILABLE", message: "No history-derived technical measurement is available. A company overview or a lone quote does not substitute for the missing chart lookbacks." });
  else if (measuredTechnicals < technicalKeys.length) issues.push({ tool: "charts", code: "TECHNICAL_LOOKBACKS_PARTIAL", message: `${measuredTechnicals} of ${technicalKeys.length} requested technical measurements were calculable; unavailable lookbacks were not estimated.` });
  const economicSnapshot = settled[2].status === "fulfilled" ? settled[2].value : null;
  if (settled[2].status === "rejected") issues.push(issue("economy", settled[2].reason));
  aborted(input.signal);
  if (economicSnapshot) for (const message of economicSnapshot.warnings) issues.push({ tool: "economy", code: "ECONOMIC_COVERAGE", message });
  const scenarios = settled[1].status === "fulfilled" ? settled[1].value : { status: "unavailable" as const, symbol, checkedAt, manifests: [], analogues: null, strategies: [], savedDefinitionsChecked: 0, skippedDefinitions: [], benchmark: null, issues: [issue("scenarios", settled[1].reason)] };
  issues.push(...scenarios.issues);
  const validMacro = economicSnapshot?.series.filter(row => row.latestValue !== null && row.confidence > 0).length ?? 0;
  const bundle: Omit<DeskResearchTools, "evidence"> = { version: 1, symbol, checkedAt,
    economy: { status: !validMacro ? "unavailable" : economicSnapshot?.warnings.length ? "partial" : "available", snapshot: economicSnapshot, riskAppetite: scenarios.benchmark,
      interpretationLimits: ["Economic releases have daily, monthly, quarterly or annual cadences; publication and retrieval are distinct. Revisions and missing series are disclosed by Intelligence Studio.",
        "The macro score describes economic conditions. A market-price proxy cannot measure every investor's willingness to participate and is not a profit probability."] },
    charts: { status: !measuredTechnicals ? "unavailable" : issues.some(row => row.tool === "charts") ? "partial" : "available", snapshot, barCount: history?.data.bars.length ?? 0, historyBasis: history?.data.basis ?? null }, scenarios, issues };
  return { ...bundle, evidence: toolEvidence(bundle) };
}
