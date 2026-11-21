import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { requireAgentDeskAccess } from "./access";
import { requireResearchStorage } from "@/lib/data-readiness/server";
import { configured } from "@/lib/data-readiness/core";
import { buildResearchSwarmForUser } from "@/lib/intelligence/research-swarm-service";
import { getAlphaVantageIntelligence } from "@/lib/intelligence/alpha-vantage-live";
import { safeResearchSourceUrl, aggregateResearchEvidence } from "@/lib/intelligence/research-evidence";
import { hasCompleteScoredResearch } from "@/lib/intelligence/research-readiness";
import { resolveResearchInstrument } from "@/lib/intelligence/research-instrument";
import type { AlphaVantageIntelligenceResponse } from "@/lib/intelligence/alpha-vantage-types";
import type { ResearchSwarmResponse } from "@/lib/intelligence/research-swarm-types";
import { enqueueBackgroundJob, requestBackgroundJobCancellation, type BackgroundJobRuntime } from "@/lib/background-jobs/queue";
import { AgentDeskError, DEFAULT_DESK_OPERATIONS, type DeskScope, type DeskCycle, type AgentDeskView, type AgentEvidence, type AgentFinding, type DeskResourceView } from "./contracts";
import { agentProviderConfiguration, runSixAgentTeam, type AgentContext } from "./agents";
import { loadDeskResearchTools, scoutDiscoveryEvidence } from "./research-tools";
import { appendAgentBoardMessage, readAgentBoard } from "./collaboration";
import { readAgentLearning } from "./learning";
import { loadAgentResearchAccess } from "./research-access";
import { readAgentResearchSourceFingerprint } from "./research-access-web";
import { sourceIdentity } from "./research-access-core";
import type { AgentResearchAccess } from "./research-access-types";
import { runAgentHelpers } from "./subagents";
import { emptyAgentSignal, sumAgentUsage, uniqueAgentEvidence, decideAgentReview } from "./operations";
import { getAgentBrokerContext, getBrokerView, getBrokerResearchObservation, pauseBrokerExecution, submitChiefBrokerProposal } from "@/lib/agent-broker/service";
import { applyPaperCycle, createPaperAccount, type DeskQuote, type DeskAssessment, type PaperCycleResult } from "./guardrails";
import { readDeskRecord, replaceDeskRecord, readDeskHistory, readDeskCycle, commitDeskCycle, validateDeskSettings, positionFingerprint,
  type DeskRecord, type DeskState } from "./store";

const iso = () => new Date().toISOString();
const hash = (value: unknown) => createHash("sha256").update(JSON.stringify(value)).digest("hex");
const safeError = (error: unknown) => error instanceof AgentDeskError ? error.message : "The cycle could not complete. Check market access, AI configuration, and research storage; no unverified paper order was created.";
export async function requireDeskAccess(scope: DeskScope) {
  await requireAgentDeskAccess(scope);
}
export function deskProviderStatus(): AgentDeskView["providers"] {
  const ai = agentProviderConfiguration();
  return { ai: ai.key ? "configured-unverified" : "missing", market: configured(process.env.ALPHA_VANTAGE_API_KEY) ? "configured-unverified" : "missing", model: ai.model };
}
function requireProviders() {
  const status = deskProviderStatus();
  if (status.ai === "missing" || status.market === "missing") throw new AgentDeskError("DESK_PROVIDERS_REQUIRED", "Configure OPENAI_API_KEY and ALPHA_VANTAGE_API_KEY before starting the six-agent team. Real-time market entitlement is separately checked before every paper fill.", 503);
}
export async function readAgentDesk(scope: DeskScope): Promise<AgentDeskView> {
  await requireDeskAccess(scope);
  const [record, history] = await Promise.all([readDeskRecord(scope), readDeskHistory(scope)]);
  const state = record.state;
  const latestCycle = state.latestCycleId ? history.find(cycle => cycle.id === state.latestCycleId) ?? (await readDeskCycle(scope, state.latestCycleId))?.cycle ?? null : null;
  const lastTeamId = history.find(cycle => cycle.agents.length)?.id;
  // Only the most recent deliberation needs its full role/source payload on each poll.
  const compactHistory = history.map(cycle => cycle.id === lastTeamId && cycle.id !== latestCycle?.id ? cycle : { ...cycle, agents: [], helpers: [], evidence: [], currentResearch: null, researchTools: null, discovery: null, learningSnapshot: null });
  const busy = state.busy ? { cycleId: state.busy.cycleId, jobId: state.busy.jobId, startedAt: state.busy.startedAt, expiresAt: state.busy.expiresAt, stage: state.busy.stage, progress: state.busy.progress } : null;
  const operations = state.settings.operations ?? DEFAULT_DESK_OPERATIONS, signal = state.signal ?? emptyAgentSignal();
  return { version: 1, revision: state.revision, settings: state.settings, controls: state.controls, account: state.account,
    executionMode: "paper", liveExecutionAvailable: false, providers: deskProviderStatus(), busy, latestCycle, history: compactHistory,
    nextRunAt: state.nextRunAt, lastError: state.lastError, updatedAt: state.updatedAt,
    worker: { requiredForAutonomy: true, command: "npm run beta:worker", lastCheckedAt: state.lastCheckedAt },
    operations: { mode: operations.mode, helperLimit: operations.helpersEnabled ? operations.maxHelpers : 0, concurrency: operations.maxConcurrentHelpers,
      lastReason: signal.lastReason, lastSignalAt: signal.evaluatedAt, nextFullReviewAt: signal.nextFullReviewAt, skippedReviews: signal.skippedReviews,
      lastCycleUsage: latestCycle?.usage ?? history.find(cycle => cycle.usage)?.usage ?? null, capabilities: latestCycle?.resources?.capabilities ?? history.find(cycle => cycle.resources)?.resources?.capabilities ?? [] },
    scouting: { lastScanAt: state.scouting.lastScanAt, nextScanAt: state.scouting.nextScanAt, lastError: state.scouting.lastError, discovery: state.scouting.discovery, selection: state.scouting.selection,
      busy: state.scouting.busy ? { jobId: state.scouting.busy.jobId, startedAt: state.scouting.busy.startedAt } : null } };
}
function checkRevision(record: DeskRecord, revision: unknown) {
  if (!Number.isSafeInteger(revision) || revision !== record.state.revision) throw new AgentDeskError("DESK_REVISION_CHANGED", "The saved safeguards changed. Reload the desk before submitting this action.");
}
async function cancelOldJob(scope: DeskScope, record: DeskRecord) {
  for (const jobId of [record.state.busy?.jobId, record.state.scouting.busy?.jobId]) if (jobId) await requestBackgroundJobCancellation({ ...scope, jobId }).catch(() => undefined);
}
async function cancelScoutJob(scope: DeskScope, record: DeskRecord) {
  if (record.state.scouting.busy?.jobId) await requestBackgroundJobCancellation({ ...scope, jobId: record.state.scouting.busy.jobId }).catch(() => undefined);
}
export async function updateDeskControls(scope: DeskScope, body: Record<string, unknown>) {
  await requireDeskAccess(scope);
  const action = String(body.action);
  if (!["settings", "arm", "enable", "pause", "kill", "resume"].includes(action)) throw new AgentDeskError("INVALID_DESK_ACTION", "Choose a supported desk action.", 400);
  let brokerPauseFailed = false;
  if (["pause", "kill"].includes(action)) {
    // Both authority reductions must be attempted. The durable desk epoch below
    // also invalidates brokerage activation when its own state write is down.
    try { await pauseBrokerExecution(scope, action === "kill" ? "The founder activated the desk kill switch. Broker entries were disabled; existing broker-native protection remains." : "The founder paused the agent desk. Broker entries were disabled; owned exposure continues to be monitored."); }
    catch { brokerPauseFailed = true; }
  }
  // Emergency actions only reduce authority, so a stale browser revision cannot prevent them.
  for (let attempt = 0; attempt < 3; attempt++) {
    const record = await readDeskRecord(scope), next = structuredClone(record.state);
    if (!["pause", "kill"].includes(action)) checkRevision(record, body.revision);
    if (action === "settings") {
      if (next.busy || next.controls.autonomous) throw new AgentDeskError("PAUSE_BEFORE_SETTINGS", "Pause the desk before changing its research or safeguards.");
      const settings = validateDeskSettings(body.settings);
      if (next.account.position && (settings.symbol !== next.account.position.symbol || !settings.policy.allowedSymbols.includes(next.account.position.symbol))) throw new AgentDeskError("POSITION_SETTINGS_LOCKED", "Keep the held stock selected and allowed until its paper position is closed.");
      if (settings.initialCapital !== next.account.initialCapital) {
        if (next.account.lastFillAt) throw new AgentDeskError("PAPER_CAPITAL_LOCKED", "Starting cash cannot be rewritten after a paper fill.");
        next.account = createPaperAccount({ initialCapital: settings.initialCapital, now: iso() });
      }
      next.settings = settings;
    } else if (action === "arm" || action === "enable") {
      if (body.paperOnly !== true) throw new AgentDeskError("PAPER_ACK_REQUIRED", "Explicitly acknowledge paper mode before arming this account.", 400);
      requireProviders();
      if (next.account.reviewRequired) throw new AgentDeskError("POSITION_REVIEW_REQUIRED", "This paper position crossed a session without a verified close and requires reconciliation. Arming cannot erase that history.");
      next.controls = { armed: true, autonomous: action === "enable", paused: false, killSwitch: false };
    } else if (action === "pause") next.controls = { ...next.controls, autonomous: false, paused: true };
    else if (action === "kill") next.controls = { ...next.controls, autonomous: false, paused: true, killSwitch: true };
    else next.controls = { armed: false, autonomous: false, paused: false, killSwitch: false };
    next.revision += 1; next.busy = null; next.updatedAt = iso(); next.lastError = null;
    if (["pause", "kill"].includes(action)) {
      next.brokerPausedAtRevision = next.revision;
      if (brokerPauseFailed) next.lastError = "The desk revoked research and broker entry authority. The separate broker status update failed; refresh the broker panel to reconcile its stored status. Existing broker protection remains at Alpaca.";
    }
    next.scouting = { ...next.scouting, busy: null, pendingResearch: null, nextScanAt: next.settings.scouting?.enabled && !next.controls.killSwitch ? next.updatedAt : null };
    next.nextRunAt = next.controls.autonomous ? next.updatedAt : null;
    try { await replaceDeskRecord(scope, record, next); await cancelOldJob(scope, record); return; }
    catch (error) { if (!(error instanceof AgentDeskError) || error.code !== "DESK_CONFLICT" || !["pause", "kill"].includes(action) || attempt === 2) throw error; }
  }
}
async function recoverTerminalLease(scope: DeskScope, record: DeskRecord): Promise<DeskRecord> {
  if (!record.state.busy) return record;
  const busy = record.state.busy;
  const job = busy.jobId ? await prisma.backendJobRun.findFirst({ where: { id: busy.jobId, ...scope }, select: { status: true, completedAt: true } }) : null;
  if ((!job || !["Failed", "DeadLetter", "Cancelled", "Complete"].includes(job.status)) && Date.parse(busy.expiresAt) > Date.now()) return record;
  return replaceDeskRecord(scope, record, { ...record.state, busy: null, lastError: "The previous research job ended or lost its lease. Its stale result cannot place an order; a new cycle can be requested.", updatedAt: iso() });
}
export async function recoverDeskCycleLease(scope: DeskScope, record?: DeskRecord): Promise<DeskRecord> {
  await requireDeskAccess(scope);
  return recoverTerminalLease(scope, record ?? await readDeskRecord(scope));
}
export async function queueDeskCycle(scope: DeskScope, revision: number, scheduled = false, selection?: { scanId: string; symbol: string }, brokerSymbol?: string) {
  await requireDeskAccess(scope); await requireResearchStorage(["BackendPlatformEvent", "SliceForecastBundle"]); requireProviders();
  let record = await recoverTerminalLease(scope, await readDeskRecord(scope)); checkRevision(record, revision);
  if (record.state.controls.killSwitch) throw new AgentDeskError("DESK_KILLED", "Clear the kill switch before starting another cycle.");
  if (record.state.busy) throw new AgentDeskError("DESK_BUSY", "A cycle is already queued or running.");
  if (brokerSymbol) {
    const broker = await getBrokerView(scope);
    if (!scheduled || selection || !broker.connected || !broker.controls.enabled || !broker.controls.autonomous || broker.controls.paused || brokerSymbol !== (broker.activePositionSymbol ?? record.state.settings.symbol) || !broker.policy.allowedSymbols.includes(brokerSymbol)) throw new AgentDeskError("BROKER_RESEARCH_NOT_DUE", "The active brokerage account has not authorized this scheduled research target.");
  } else if (scheduled && (!record.state.controls.autonomous || record.state.controls.paused || (record.state.nextRunAt && Date.parse(record.state.nextRunAt) > Date.now()))) throw new AgentDeskError("DESK_NOT_DUE", "The autonomous desk is paused or not yet due.");
  if (selection && (!record.state.settings.scouting?.autoResearch || record.state.scouting.pendingResearch?.scanId !== selection.scanId || record.state.scouting.pendingResearch.symbol !== selection.symbol || !record.state.scouting.discovery?.candidates.some(item => item.symbol === selection.symbol) || record.state.scouting.lastQueuedScanId === selection.scanId)) throw new AgentDeskError("SCOUT_SELECTION_SUPERSEDED", "That Scout selection is no longer pending. Only a saved discovery can start automatic candidate research.");
  const symbol = brokerSymbol ?? selection?.symbol ?? record.state.settings.symbol;
  const cycleId = randomUUID(), token = randomUUID(), now = iso();
  const pending = record.state.scouting.pendingResearch;
  record = await replaceDeskRecord(scope, record, { ...record.state,
    scouting: selection ? { ...record.state.scouting, pendingResearch: null, lastQueuedScanId: selection.scanId } : record.state.scouting,
    busy: { cycleId, token, symbol, scoutingId: selection?.scanId ?? null, discovery: record.state.scouting.discovery, jobId: null, startedAt: now, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString(), stage: selection ? `Queued Scout candidate ${symbol} for Intelligence research` : "Queued for evidence collection", progress: 0 }, lastError: null, updatedAt: now });
  try {
    await requireDeskAccess(scope);
    const queued = await enqueueBackgroundJob({ context: scope, jobKey: "agent_desk_cycle", jobName: "Founder six-agent research cycle", payload: { cycleId, token, revision, scheduled, ...(brokerSymbol ? { brokerScheduled: true } : {}) },
      idempotencyKey: `agent-desk:${scope.firmId}:${cycleId}`, maxAttempts: 1, timeoutMs: 1_200_000, backoffMs: 30_000 });
    // A worker may start immediately. Update only our current lease, preserving its progress.
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await readDeskRecord(scope);
      if (current.state.busy?.token !== token) { await requestBackgroundJobCancellation({ ...scope, jobId: queued.job.id }).catch(() => undefined); break; }
      if (current.state.busy.jobId === queued.job.id) break;
      try { await replaceDeskRecord(scope, current, { ...current.state, busy: { ...current.state.busy, jobId: queued.job.id } }); break; }
      catch (error) { if (!(error instanceof AgentDeskError) || error.code !== "DESK_CONFLICT" || attempt === 2) throw error; }
    }
    return queued.job.id;
  } catch (error) {
    const current = await readDeskRecord(scope);
    if (current.state.busy?.token === token) await replaceDeskRecord(scope, current, { ...current.state, busy: null,
      scouting: selection && current.state.scouting.lastQueuedScanId === selection.scanId ? { ...current.state.scouting, pendingResearch: current.state.scouting.pendingResearch ?? pending, lastQueuedScanId: null } : current.state.scouting,
      lastError: safeError(error), updatedAt: iso() }).catch(() => undefined);
    throw error;
  }
}

/** Original provider receipt time is preserved; a cache read never becomes a fresh quote. */
export function executionQuote(alpha: AlphaVantageIntelligenceResponse): DeskQuote | null {
  const q = alpha.quote;
  if (!q || !q.observedAt) return null;
  const endpoint = q.sourceKind === "intraday-bar" ? "intraday" : q.sourceKind === "native-index-daily" ? "index" : "quote";
  const retrievedAt = alpha.health.retrievedAt?.[endpoint];
  if (!retrievedAt) return null;
  const statusTime = Date.parse(alpha.health.retrievedAt?.marketStatus ?? "");
  const statusCurrent = Number.isFinite(statusTime) && statusTime <= Date.now() + 5000 && Date.now() - statusTime <= 60_000 && alpha.health.cache.marketStatus !== "stale-cache";
  const exchange = typeof alpha.overview?.exchange === "string" ? alpha.overview.exchange.trim().toUpperCase() : "unknown";
  const supportedVenue = ["NASDAQ", "NYSE", "NYSE ARCA", "NYSEARCA", "NYSE AMERICAN", "AMEX", "NYSE MKT", "BATS", "CBOE BZX"].includes(exchange);
  return { symbol: alpha.symbol, price: q.price, observedAt: q.observedAt, retrievedAt,
    marketOpen: supportedVenue && statusCurrent && alpha.market?.isOpen === true, realTimeConfirmed: alpha.freshness.isRealtime, exchange,
    instrumentKind: alpha.instrument?.kind ?? resolveResearchInstrument(alpha.symbol).kind,
    currency: alpha.overview?.currency ?? "unknown", sourceKind: q.sourceKind === "intraday-bar" ? "intraday-bar" : "daily" };
}
async function freshQuote(symbol: string) {
  const alpha = await getAlphaVantageIntelligence({ symbol, interval: "1min", forceRefresh: true, executionOnly: true });
  if (alpha.symbol !== symbol) throw new AgentDeskError("QUOTE_SYMBOL_MISMATCH", "The provider observation did not match the selected instrument. Execution is blocked.", 502);
  return executionQuote(alpha);
}
async function referenceObservation(scope: DeskScope, symbol: string, brokerPreferred: boolean) {
  if (brokerPreferred) {
    const observed = await getBrokerResearchObservation(scope, symbol);
    const quote: DeskQuote | null = observed ? { symbol: observed.symbol, price: (observed.bid + observed.ask) / 2,
      observedAt: observed.observedAt, retrievedAt: observed.receivedAt, marketOpen: observed.marketOpen,
      realTimeConfirmed: true, instrumentKind: "equity", currency: "USD", sourceKind: "quote", exchange: "US" } : null;
    return { quote, source: observed ? `Alpaca ${observed.feed.toUpperCase()}` : "Alpaca", url: "https://docs.alpaca.markets/us/docs/about-market-data-api" };
  }
  return { quote: await freshQuote(symbol), source: "Alpha Vantage", url: "https://www.alphavantage.co/documentation/#intraday" };
}
function resourceView(access: AgentResearchAccess): DeskResourceView {
  return { internet: { status: access.web.status, sources: access.web.sources.length, queries: access.web.queries.length, cacheHit: access.web.cacheHit },
    workspaceRecords: access.workspace.records.length, sharedRecords: access.shared.sourceCount,
    capabilities: [{ id: "internet", label: "Public internet research", status: ["ready", "cached"].includes(access.web.status) ? "available" : access.web.status === "disabled" ? "disabled" : access.web.status === "empty" ? "partial" : "unavailable", detail: access.web.detail },
      ...access.workspace.capabilities.map(row => ({ id: row.id, label: row.label, status: row.status === "available" ? "available" as const : row.status === "empty" || row.status === "restricted" ? "partial" as const : "unavailable" as const, detail: row.detail })),
      { id: "shared-public-research", label: "Consented public research sources", status: access.shared.status === "ready" ? "available" : access.shared.status === "disabled" ? "disabled" : access.shared.status === "empty" ? "partial" : "unavailable", detail: access.shared.detail }],
    issues: access.issues.map(issue => `${issue.tool}: ${issue.message}`) };
}
const sourceFingerprint = (access: AgentResearchAccess) => access.web.sources.length ? hash([...new Set(access.web.sources.map(source => `${sourceIdentity(source.url)}|${source.publishedAt ?? "undated"}`))].sort()) : null;

/** This check performs observed-data reads, never a model call or an order. */
export async function checkScheduledAgentReview(scope: DeskScope, brokerSymbol?: string) {
  await requireDeskAccess(scope);
  const record = await readDeskRecord(scope), state = record.state, operations = state.settings.operations ?? DEFAULT_DESK_OPERATIONS;
  const broker = brokerSymbol ? await getAgentBrokerContext(scope) : null;
  const symbol = brokerSymbol ?? state.settings.symbol;
  const [{ quote }, fingerprint] = await Promise.all([referenceObservation(scope, symbol, Boolean(brokerSymbol)), readAgentResearchSourceFingerprint(scope, symbol)]);
  const now = iso(), observedAge = quote ? Date.now() - Date.parse(quote.observedAt) : Infinity;
  const exposure = broker ? hash({ mode: broker.mode, positions: broker.positions.map(row => [row.symbol, row.quantity, row.averageEntryPrice]), pending: broker.pendingOrder }) : positionFingerprint(state.account);
  const signal = state.signal ?? emptyAgentSignal();
  const result = decideAgentReview({ mode: operations.mode, now, state: signal, price: quote?.price ?? null,
    sourceFingerprint: fingerprint, exposureFingerprint: exposure, intervalMinutes: state.settings.intervalMinutes,
    observationsFresh: Boolean(quote?.realTimeConfirmed && quote.marketOpen && observedAge >= -2_000 && observedAge <= (broker ? 5_000 : 90_000)) });
  await requireDeskAccess(scope);
  await replaceDeskRecord(scope, record, { ...state, signal: { ...signal, evaluatedAt: now, lastReason: result.reason, nextFullReviewAt: result.nextFullReviewAt, skippedReviews: signal.skippedReviews + (result.review ? 0 : 1) }, lastCheckedAt: now });
  return result;
}
export function deskEvidence(research: ResearchSwarmResponse): AgentEvidence[] {
  const evidence: AgentEvidence[] = [];
  for (const cohort of ["media", "technical", "economy"] as const) {
    const rows = research.evidence.filter(item => item.cohort === cohort && item.symbol === research.symbol);
    const ids = new Set(aggregateResearchEvidence(rows, { evaluatedAt: research.completedAt }).eligibleEvidenceIds);
    const eligible = rows.filter(item => ids.has(item.id));
    for (const item of eligible.slice(0, 20)) evidence.push({ id: item.id, title: item.title.slice(0, 500), summary: item.summary.slice(0, 4000), source: item.source, url: safeResearchSourceUrl(item.sourceUrl), observedAt: item.asOf, retrievedAt: item.retrievedAt, kind: "scored-evidence", cohort, metrics: item.metrics });
  }
  for (const item of (research.currentResearch?.discoveries ?? []).slice(0, 24)) {
    const url = safeResearchSourceUrl(item.url), date = Date.parse(item.publishedAt), collected = Date.parse(research.completedAt);
    if (!url || !Number.isFinite(date) || date > collected + 5000 || date < collected - 7 * 86_400_000) continue;
    evidence.push({ id: `discovery:${item.id}`, title: item.title.slice(0, 500), summary: item.summary.slice(0, 4000), source: item.publisher, url, observedAt: item.publishedAt, retrievedAt: item.retrievedAt, kind: "public-discovery", cohort: "media", metrics: { linkKind: item.linkKind, publisherAttribution: item.publisherAttribution, contentScope: "feed-title-and-summary-not-full-article" } });
  }
  return [...new Map(evidence.map(item => [item.id, item])).values()];
}
function blankCycle(id: string, state: DeskState, startedAt: string): DeskCycle {
  return { version: 1, id, symbol: state.settings.symbol, status: "failed", startedAt, completedAt: iso(), settingsRevision: state.revision,
    researchRunId: null, researchScore: null, currentResearch: null, agents: [], evidence: [], proposal: null, decision: null, fill: null, errors: [], sourceHash: "", contextQuote: null, executionQuote: null, equity: null, unrealizedPnl: null, mode: "paper", executionStatus: "failed" };
}
function sealCycleSources(cycle: DeskCycle) {
  cycle.sourceHash = hash({ runId: cycle.researchRunId, score: cycle.researchScore, evidence: cycle.evidence, contextQuote: cycle.contextQuote, executionQuote: cycle.executionQuote,
    ...(cycle.researchTools ? { researchTools: cycle.researchTools } : {}), ...(cycle.discovery ? { discovery: cycle.discovery } : {}), ...(cycle.learningSnapshot ? { learning: cycle.learningSnapshot } : {}),
    ...(cycle.resources ? { resources: cycle.resources } : {}), ...(cycle.helpers ? { helpers: cycle.helpers.map(row => ({ id: row.id, sourceHash: row.sourceHash, evidenceIds: row.evidenceIds })) } : {}) });
}
function followHeldSymbol(state: DeskState): DeskState {
  const symbol = state.account.position?.symbol;
  return symbol && symbol !== state.settings.symbol ? { ...state, revision: state.revision + 1, settings: { ...state.settings, symbol }, scouting: { ...state.scouting, busy: null } } : state;
}
function applyResult(cycle: DeskCycle, result: PaperCycleResult) {
  cycle.decision = result.decision; cycle.fill = result.fill; cycle.equity = result.equity; cycle.unrealizedPnl = result.unrealizedPnl;
  cycle.status = cycle.agents.some(agent => agent.status !== "complete") ? "failed" : result.decision.status === "blocked" ? "blocked" : "complete";
  cycle.executionStatus = result.fill ? "filled" : result.decision.code === "APPROVAL_REQUIRED" ? "awaiting-approval" : result.decision.status === "blocked" ? "blocked" : "held";
}
function nextCycleAt(state: DeskState) { return state.controls.autonomous && !state.controls.paused && !state.controls.killSwitch ? new Date(Date.now() + state.settings.intervalMinutes * 60_000).toISOString() : null; }
async function leased(scope: DeskScope, cycleId: string, token: string, revision: number, jobId?: string) {
  const record = await readDeskRecord(scope), busy = record.state.busy;
  if (!busy || busy.cycleId !== cycleId || busy.token !== token || !Number.isFinite(Date.parse(busy.expiresAt)) || Date.parse(busy.expiresAt) <= Date.now() || record.state.revision !== revision || (jobId && busy.jobId && busy.jobId !== jobId)) throw new AgentDeskError("DESK_LEASE_LOST", "Newer controls, an expired lease, or another cycle superseded this result. No paper order can be placed by this worker.");
  return record;
}
export async function executeAgentDeskCycleJob(context: { userId: string; firmId?: string | null }, runtime: BackgroundJobRuntime): Promise<Record<string, unknown>> {
  if (!context.firmId) throw new AgentDeskError("DESK_ACCESS_REQUIRED", "The desk job requires its original workspace.", 403);
  const scope: DeskScope = { userId: context.userId, firmId: context.firmId };
  const { cycleId, token, revision } = runtime.payload;
  if (typeof cycleId !== "string" || typeof token !== "string" || !Number.isSafeInteger(revision)) throw new AgentDeskError("INVALID_DESK_JOB", "The job lacks a server-issued desk lease.", 403);
  await requireDeskAccess(scope); await runtime.throwIfCancelled();
  const prior = await readDeskCycle(scope, cycleId); if (prior) return { cycleId, duplicate: true, executionStatus: prior.cycle.executionStatus };
  const start = await leased(scope, cycleId, token, revision as number, runtime.jobId);
  let cycle = blankCycle(cycleId, start.state, start.state.busy!.startedAt);
  const symbol = start.state.busy!.symbol ?? start.state.settings.symbol;
  cycle.symbol = symbol;
  const initialExposure = positionFingerprint(start.state.account);
  async function progress(stage: string, value: number) {
    await requireDeskAccess(scope); await runtime.throwIfCancelled();
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await leased(scope, cycleId as string, token as string, revision as number, runtime.jobId);
      try { await replaceDeskRecord(scope, current, { ...current.state, busy: { ...current.state.busy!, stage, progress: value, jobId: runtime.jobId, expiresAt: new Date(Date.now() + 30 * 60_000).toISOString() } }); break; }
      catch (error) { if (!(error instanceof AgentDeskError) || error.code !== "DESK_CONFLICT" || attempt === 2) throw error; }
    }
    await runtime.reportProgress(value, stage);
  }
  async function authorize() { await requireDeskAccess(scope); await runtime.throwIfCancelled(); await leased(scope, cycleId as string, token as string, revision as number, runtime.jobId); }
  try {
    const broker = await getAgentBrokerContext(scope);
    const brokerInstrument = resolveResearchInstrument(symbol).kind === "equity" && /^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol);
    const brokerActive = broker.connected && broker.controls.enabled && !broker.controls.paused && brokerInstrument;
    cycle.executionTarget = brokerActive ? broker.mode === "live" ? "alpaca-live" : "alpaca-paper" : "local-simulation";
    if (brokerActive) cycle.brokerContextRevision = broker.revision;
    if (runtime.payload.brokerScheduled === true && (!brokerActive || !broker.controls.autonomous)) throw new AgentDeskError("BROKER_RESEARCH_NOT_DUE", "The broker was paused before its scheduled research began.");
    if (runtime.payload.scheduled === true) {
      const { quote } = await referenceObservation(scope, symbol, brokerActive);
      if (!quote?.marketOpen || !quote.realTimeConfirmed) {
        await requireDeskAccess(scope); await runtime.throwIfCancelled();
        const current = await leased(scope, cycleId, token, revision as number, runtime.jobId);
        const result = applyPaperCycle({ account: current.state.account, policy: current.state.settings.policy, controls: current.state.controls, cycleId,
          expectedSequence: current.state.account.sequence, now: iso(), quote, assessment: null,
          proposal: { action: "hold", symbol, referencePrice: quote?.price ?? null, allocationPct: null, rationale: "Autonomous research waits for a verified open-market intraday observation." } });
        cycle.executionQuote = quote; sealCycleSources(cycle); cycle.completedAt = iso(); applyResult(cycle, result);
        cycle.errors = ["Autonomous AI calls were deferred because an open-market, real-time observation was unavailable. Manual research remains available."];
        await commitDeskCycle(scope, current, { ...current.state, account: result.account, busy: null, latestCycleId: cycleId, nextRunAt: nextCycleAt(current.state), lastError: cycle.errors[0], updatedAt: iso() },
          { cycle, assessment: null, positionFingerprint: initialExposure, approvalOf: null });
        return { cycleId, executionStatus: cycle.executionStatus, deferred: true };
      }
    }
    await progress("Collecting and saving dated stock evidence", 5);
    const operations = start.state.settings.operations ?? DEFAULT_DESK_OPERATIONS;
    const collected = await Promise.allSettled([
      buildResearchSwarmForUser({ userId: scope.userId, symbol, requestedAgents: 60, forceRefresh: true, graphMode: "summary", detailMode: "summary", persistGraph: false,
        progress: (value, message) => progress(message, Math.min(35, 5 + Math.round(value * .3))) }),
      loadDeskResearchTools(scope, { symbol, signal: runtime.signal, forceRefresh: false }),
      readAgentLearning(scope), readAgentBoard(scope, { limit: 30 }),
      loadAgentResearchAccess(scope, { symbol, signal: runtime.signal, webEnabled: operations.internetResearch, maxWebQueries: operations.mode === "economy" ? 1 : 2, includeWorkspace: true, includeShared: operations.sharedResearch }),
    ]);
    await authorize();
    const [researchResult, toolsResult, learningResult, boardResult, accessResult] = collected;
    for (const result of collected) if (result.status === "rejected") throw result.reason;
    if (researchResult.status !== "fulfilled" || toolsResult.status !== "fulfilled" || learningResult.status !== "fulfilled" || boardResult.status !== "fulfilled" || accessResult.status !== "fulfilled") throw new AgentDeskError("DESK_RESEARCH_UNAVAILABLE", "The team's research or learning journal could not be loaded.");
    const research = researchResult.value, researchTools = toolsResult.value, learning = learningResult.value, researchAccess = accessResult.value;
    if (research.symbol !== symbol || researchTools.symbol !== symbol) throw new AgentDeskError("RESEARCH_SYMBOL_MISMATCH", "The saved research did not match this desk's selected instrument. Execution is blocked.");
    const discovery = start.state.busy!.discovery ?? null;
    const evidence = uniqueAgentEvidence([...deskEvidence(research), ...researchTools.evidence, ...researchAccess.evidence, ...(discovery ? scoutDiscoveryEvidence(discovery) : [])]);
    const observation = await referenceObservation(scope, symbol, brokerActive), contextQuote = observation.quote;
    if (contextQuote) evidence.push({ id: `desk-observation:${cycleId}`, title: `${research.symbol} observed price before agent review`,
      summary: "Provider observation supplied to all six roles. A bar close is a reference observation, not an executable bid or offer.",
      source: observation.source, url: observation.url, observedAt: contextQuote.observedAt, retrievedAt: contextQuote.retrievedAt,
      kind: "execution-reference", cohort: "technical", metrics: { price: contextQuote.price, currency: contextQuote.currency, exchange: contextQuote.exchange ?? null, realTimeConfirmed: contextQuote.realTimeConfirmed, sourceKind: contextQuote.sourceKind, role: "execution-reference-not-an-additional-score-vote" } });
    if (broker.connected) evidence.push({ id: `desk-broker-context-${cycleId}`, title: `Observed Alpaca ${broker.mode} account constraints`, summary: "The attached broker context reports observed cash, positions and confirmed fills separately from the local simulation. It is an account constraint, not independent market evidence; recorded balances retain their observation time.",
      source: "Alpaca account API", url: "https://docs.alpaca.markets/us/docs/trading-account", observedAt: broker.observedAt, retrievedAt: iso(), kind: "tool-research", cohort: "account",
      metrics: { mode: broker.mode, cash: broker.account?.cash ?? null, equity: broker.account?.equity ?? null, positionCount: broker.positions.length, currentTradingAuthority: brokerActive, increasesResearchConfidence: false } });
    const sourceHash = hash({ runId: research.runId, score: research.score, evidence, market: contextQuote });
    cycle = { ...cycle, researchRunId: research.runId, researchScore: research.score, currentResearch: research.currentResearch ?? null, evidence, sourceHash, contextQuote, researchTools, discovery, learningSnapshot: learning, resources: resourceView(researchAccess) };
    sealCycleSources(cycle);
    const agentContext: AgentContext = { symbol: research.symbol, researchRunId: research.runId, collectedAt: research.completedAt, market: contextQuote,
      score: research.score, evidence, gaps: [...(research.currentResearch?.gaps ?? []).map(gap => `${gap.description} ${gap.action}`), ...researchTools.issues.map(issue => `${issue.tool}: ${issue.message}`), ...researchAccess.issues.map(issue => `${issue.tool}: ${issue.message}`)], policy: { ...start.state.settings.policy, ...(brokerActive ? { maxPositionPct: Math.min(start.state.settings.policy.maxPositionPct, broker.safeguards.maxPositionPct) } : {}) }, account: start.state.account,
      researchTools, discovery, learning, board: boardResult.value, discussionCycleId: cycleId, operationsMode: operations.mode, researchAccess, broker, executionTarget: cycle.executionTarget };
    const rounds: AgentFinding[] = []; let messages = 0;
    const publish = async (report: AgentFinding) => {
        await authorize(); if (!report.worker) rounds.push(report);
        const prefix = report.worker ? `${cycleId}:helper:${report.worker.id}` : `${cycleId}:${report.round}:${report.role}:${report.phase}`;
        await appendAgentBoardMessage(scope, { id: `${prefix}:report`, cycleId, symbol, round: report.round ?? 1, phase: report.phase ?? "research", from: report.role, to: "team", replyToIds: [], body: report.summary,
          evidenceIds: [...new Set(report.findings.flatMap(finding => finding.evidenceIds))], createdAt: report.completedAt, researchRunId: research.runId, sourceHash: cycle.sourceHash, report }); messages++;
        for (const [index, message] of (report.messages ?? []).entries()) {
          await authorize();
          await appendAgentBoardMessage(scope, { ...message, id: `${prefix}:message:${index}`, cycleId, symbol, round: report.round ?? 1, phase: report.phase ?? "research", from: report.role, createdAt: report.completedAt, researchRunId: research.runId, sourceHash: cycle.sourceHash }); messages++;
        }
    };
    await progress("Delegating overloaded source groups to bounded research helpers", 37);
    cycle.helpers = await runAgentHelpers(agentContext, operations, { ownerId: scope.userId, signal: runtime.signal, authorize, publishReport: publish });
    agentContext.helpers = cycle.helpers;
    agentContext.board = await readAgentBoard(scope, { limit: 50 });
    sealCycleSources(cycle);
    const agents = await runSixAgentTeam(agentContext, { ownerId: scope.userId, signal: runtime.signal, progress, authorize,
      readBoard: async () => { await authorize(); return readAgentBoard(scope, { limit: 50 }); }, publishReport: publish });
    const chief = agents.find(agent => agent.role === "chief")!, skeptic = agents.find(agent => agent.role === "skeptic")!;
    const proposal = { action: chief.status === "complete" ? chief.action : "hold" as const, symbol: research.symbol,
      referencePrice: contextQuote?.price ?? null, allocationPct: chief.allocationPct, rationale: chief.summary };
    const assessment: DeskAssessment = { researchRunId: research.runId, evaluatedAt: research.completedAt, confidence: research.score.confidence,
      coverage: research.score.quality.evidenceCoverage, evidenceVerified: evidence.some(item => item.kind === "scored-evidence") && Boolean(research.currentResearch && research.currentResearch.symbol === research.symbol && research.currentResearch.checkedAt === research.completedAt && research.currentResearch.status !== "incomplete" && hasCompleteScoredResearch(research)),
      allAgentsCompleted: agents.length === 6 && agents.every(agent => agent.status === "complete") && rounds.length === 12 && rounds.every(agent => agent.status === "complete") && cycle.helpers.every(helper => helper.report.status === "complete"),
      skepticVeto: skeptic.status !== "complete" || skeptic.veto || researchTools.scenarios.status === "unavailable" || researchTools.charts.status === "unavailable" || researchTools.economy.status === "unavailable" };
    cycle = { ...cycle, agents, proposal, usage: sumAgentUsage([...rounds.map(row => row.usage), ...cycle.helpers.map(row => row.report.usage), !researchAccess.web.cacheHit && researchAccess.web.requestId ? { requests: 1, inputTokens: researchAccess.web.usage.inputTokens ?? 0, outputTokens: researchAccess.web.usage.outputTokens ?? 0, cachedInputTokens: 0, measuredResponses: researchAccess.web.usage.inputTokens !== null ? 1 : 0, unmeasuredResponses: researchAccess.web.usage.inputTokens === null ? 1 : 0 } : undefined]),
      deliberation: { version: "slice-agent-deliberation-2.0.0", rounds: 2, reports: rounds.length, messages, complete: assessment.allAgentsCompleted },
      errors: [...rounds.flatMap(agent => agent.error ? [`${agent.role} round ${agent.round}: ${agent.error}`] : []), ...cycle.helpers.flatMap(helper => helper.report.error ? [`Helper ${helper.id}: ${helper.report.error}`] : []), ...(assessment.skepticVeto && !skeptic.veto && skeptic.status === "complete" ? ["One or more required economy, technical, or historical tools were unavailable. New exposure is blocked."] : [])] };
    await progress("Rechecking the current observation and independent paper safeguards", 92);
    const quote = (await referenceObservation(scope, research.symbol, brokerActive)).quote;
    cycle.executionQuote = quote; sealCycleSources(cycle);
    await requireDeskAccess(scope); await runtime.throwIfCancelled();
    for (let attempt = 0; attempt < 3; attempt++) {
      const current = await leased(scope, cycleId, token, revision as number, runtime.jobId);
      if (positionFingerprint(current.state.account) !== initialExposure) throw new AgentDeskError("EXPOSURE_CHANGED", "The paper position changed while the team was researching. Run a new cycle against the current account.");
      const result = applyPaperCycle({ account: current.state.account, policy: current.state.settings.policy, controls: current.state.controls, cycleId,
        expectedSequence: current.state.account.sequence, now: iso(), quote, assessment,
        proposal: brokerActive ? { ...proposal, action: "hold", allocationPct: null, rationale: "This Chief proposal targets the separate brokerage account. Local simulation entries remain independent; inspect the broker receipt for execution and confirmed fills." } : proposal });
      cycle.completedAt = iso(); applyResult(cycle, result);
      const next = followHeldSymbol({ ...current.state, account: result.account, busy: null, latestCycleId: cycleId, nextRunAt: nextCycleAt(current.state), updatedAt: cycle.completedAt, lastError: cycle.errors[0] ?? null });
      const exposure = brokerActive ? hash({ mode: broker.mode, positions: broker.positions.map(row => [row.symbol, row.quantity, row.averageEntryPrice]), pending: broker.pendingOrder }) : positionFingerprint(result.account);
      next.signal = { ...(current.state.signal ?? emptyAgentSignal()), evaluatedAt: cycle.completedAt, lastReviewAt: cycle.completedAt, referencePrice: contextQuote?.price ?? null, lastSourceFingerprint: sourceFingerprint(researchAccess), lastExposureFingerprint: exposure,
        lastReason: "Completed fresh team review; market monitoring remains independent", nextFullReviewAt: new Date(Date.parse(cycle.completedAt) + Math.max(operations.mode === "economy" ? 60 : 15, current.state.settings.intervalMinutes) * 60_000).toISOString() };
      try {
        await commitDeskCycle(scope, current, next, { cycle, assessment, positionFingerprint: initialExposure, approvalOf: null });
        if (next.revision !== current.state.revision) await cancelScoutJob(scope, current);
        // Brokerage uses its own durable intent, actual balances, fresh quotes,
        // permissions and fill reconciliation. The local paper ledger is never
        // presented as a broker fill. An ambiguous send is never blindly retried.
        const submission = brokerActive ? await submitChiefBrokerProposal(scope, { cycleId }).catch(() => ({ status: "blocked", code: "BROKER_REVIEW_REQUIRED" })) : null;
        return { cycleId, executionStatus: cycle.executionStatus, researchRunId: research.runId, broker: submission ? { status: submission.status, code: submission.code } : null };
      }
      catch (error) { if (!(error instanceof AgentDeskError) || error.code !== "DESK_CONFLICT" || attempt === 2) throw error; }
    }
    throw new AgentDeskError("DESK_CONFLICT", "The account changed during execution.");
  } catch (error) {
    // Cancellation, safety controls, or a competing protective fill may have revoked this lease.
    await requireDeskAccess(scope);
    const current = await readDeskRecord(scope);
    if (current.state.busy?.token === token && current.state.revision === revision) {
      cycle.completedAt = iso(); cycle.errors = [...cycle.errors, safeError(error)]; cycle.status = "failed"; cycle.executionStatus = "failed"; cycle.fill = null;
      sealCycleSources(cycle);
      await commitDeskCycle(scope, current, { ...current.state, busy: null, latestCycleId: cycleId, nextRunAt: nextCycleAt(current.state), lastError: safeError(error), updatedAt: iso() },
        { cycle, assessment: null, positionFingerprint: initialExposure, approvalOf: null }).catch(() => undefined);
    }
    throw error;
  }
}

export async function approveDeskCycle(scope: DeskScope, revision: number, cycleId: string, paperOnly: unknown) {
  if (paperOnly !== true || !/^[a-zA-Z0-9:-]{1,100}$/.test(cycleId)) throw new AgentDeskError("INVALID_APPROVAL", "Approve an exact saved paper proposal.", 400);
  await requireDeskAccess(scope);
  const approvalId = `approval:${cycleId}`;
  if (await readDeskCycle(scope, approvalId)) throw new AgentDeskError("PROPOSAL_ALREADY_REVIEWED", "This proposal already has an immutable approval result. Run a new research cycle.");
  const original = await readDeskCycle(scope, cycleId);
  if (!original || original.cycle.executionStatus !== "awaiting-approval" || !original.cycle.proposal || !original.assessment) throw new AgentDeskError("PROPOSAL_NOT_PENDING", "That cycle has no pending paper proposal.");
  let record = await readDeskRecord(scope); checkRevision(record, revision);
  if (record.state.busy || record.state.latestCycleId !== cycleId || record.state.revision !== original.cycle.settingsRevision || positionFingerprint(record.state.account) !== original.positionFingerprint) throw new AgentDeskError("PROPOSAL_SUPERSEDED", "Newer research, controls, or account exposure replaced this proposal. Run a new cycle.");
  const quote = await freshQuote(original.cycle.symbol);
  await requireDeskAccess(scope);
  record = await readDeskRecord(scope); checkRevision(record, revision);
  if (record.state.busy || record.state.latestCycleId !== cycleId || positionFingerprint(record.state.account) !== original.positionFingerprint) throw new AgentDeskError("PROPOSAL_SUPERSEDED", "The proposal changed during approval; no stale approval can place an order.");
  const result = applyPaperCycle({ account: record.state.account, policy: record.state.settings.policy, controls: record.state.controls, cycleId: approvalId, expectedSequence: record.state.account.sequence,
    now: iso(), quote, assessment: original.assessment, proposal: original.cycle.proposal, approved: true });
  const cycle: DeskCycle = { ...original.cycle, id: approvalId, startedAt: iso(), completedAt: iso(), errors: [...original.cycle.errors], executionQuote: quote }; applyResult(cycle, result); sealCycleSources(cycle);
  const next = followHeldSymbol({ ...record.state, account: result.account, latestCycleId: approvalId, updatedAt: iso(), lastError: null });
  await commitDeskCycle(scope, record, next,
    { cycle, assessment: original.assessment, positionFingerprint: positionFingerprint(record.state.account), approvalOf: cycleId });
  if (next.revision !== record.state.revision) await cancelScoutJob(scope, record);
}

/** One observed-price check is independent of AI calls. Pause blocks entries but
 * keeps these checks available for an armed position; the kill switch stops all fills. */
export async function monitorDeskPosition(scope: DeskScope) {
  await requireDeskAccess(scope);
  let record = await readDeskRecord(scope);
  const eligible = (state: DeskState) => state.controls.armed && !state.controls.killSwitch && Boolean(state.account.position);
  if (!eligible(record.state)) return { checked: false, filled: false };
  const fingerprint = positionFingerprint(record.state.account), symbol = record.state.account.position!.symbol;
  const quote = await freshQuote(symbol); await requireDeskAccess(scope);
  record = await readDeskRecord(scope);
  if (!eligible(record.state) || positionFingerprint(record.state.account) !== fingerprint) return { checked: false, filled: false };
  const cycleId = `monitor:${randomUUID()}`, now = iso();
  const result = applyPaperCycle({ account: record.state.account, policy: record.state.settings.policy, controls: record.state.controls, cycleId,
    expectedSequence: record.state.account.sequence, now, quote, assessment: null,
    proposal: { action: "hold", symbol, referencePrice: quote?.price ?? null, allocationPct: null, rationale: "Independent protective-exit observation" } });
  const next: DeskState = { ...record.state, account: result.account, lastCheckedAt: now, updatedAt: now,
    lastError: result.decision.status === "blocked" ? result.decision.message : null };
  if (result.fill) {
    const cycle = blankCycle(cycleId, record.state, now); cycle.symbol = symbol; cycle.executionQuote = quote; sealCycleSources(cycle); applyResult(cycle, result);
    next.busy = null; next.scouting = { ...next.scouting, busy: null }; next.latestCycleId = cycleId; next.revision += 1; next.nextRunAt = nextCycleAt(next);
    await commitDeskCycle(scope, record, next, { cycle, assessment: null, positionFingerprint: fingerprint, approvalOf: null }); await cancelOldJob(scope, record);
  } else await replaceDeskRecord(scope, record, next);
  return { checked: true, filled: Boolean(result.fill), decision: result.decision.code };
}
