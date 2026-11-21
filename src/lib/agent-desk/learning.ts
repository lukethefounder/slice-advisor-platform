import "server-only";
import { AGENT_ROLES, AgentDeskError, type AgentFinding, type DeskCycle, type DeskScope } from "./contracts";
import type { PaperAccount } from "./guardrails";
import type { AgentLearningSummary, AgentLesson, AgentTradeOutcome } from "./collaboration-types";
import { artifactObject, artifactScope, boundedArtifactLimit, decodePrivateArtifact, deskArtifactDatabase, validArtifactId, type DeskArtifactDatabase } from "./collaboration-storage";

const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const rounded = (value: number) => Math.round(value * 1e8) / 1e8;
const validTime = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const sourceHash = (value: unknown) => typeof value === "string" && /^[a-f0-9]{64}$/.test(value);
const nullableId = (value: unknown) => value === null || validArtifactId(value);
const nullablePercent = (value: unknown) => value === null || finite(value) && value >= 0 && value <= 100;
const validSymbol = (value: unknown): value is string => typeof value === "string" && /^[A-Z0-9^][A-Z0-9.^:-]{0,31}$/.test(value);
function validEntryReport(value: unknown) {
  return artifactObject(value) && AGENT_ROLES.some(role => role === value.role) && ["complete", "failed", "skipped"].includes(String(value.status)) && typeof value.summary === "string"
    && Array.isArray(value.findings) && value.findings.every(finding => artifactObject(finding) && typeof finding.claim === "string" && Array.isArray(finding.evidenceIds) && finding.evidenceIds.every(validArtifactId))
    && Array.isArray(value.risks) && value.risks.every(item => typeof item === "string") && Array.isArray(value.missingData) && value.missingData.every(item => typeof item === "string");
}
export type AgentEntryRecord = {
  version: 1; id: string; cycleId: string; symbol: string; openedAt: string;
  quantity: number; entryPrice: number; entryFees: number;
  sourceHash: string; researchRunId: string | null;
  confidence: number | null; coverage: number | null;
  conditions: string[]; agents: AgentFinding[];
};

/** Conditions are measured when the entry is recorded. Future returns never
 * rewrite this feature set or the original specialist reports. */
export function entryLearningConditions(cycle: DeskCycle): string[] {
  const conditions = [`instrument:${cycle.symbol}`];
  const confidence = cycle.researchScore?.confidence, coverage = cycle.researchScore?.quality.evidenceCoverage;
  if (finite(confidence)) conditions.push(confidence < 60 ? "confidence-below-60" : "confidence-at-least-60");
  if (finite(coverage) && coverage < 60) conditions.push("coverage-below-60");
  const concentration = cycle.researchScore?.methodology?.sourceConcentrationPercent;
  if (finite(concentration) && concentration > 65) conditions.push("source-concentration-over-65");
  if ((cycle.researchScore?.quality.contradictionPenalty ?? 0) > 0) conditions.push("cohort-disagreement");
  if (cycle.agents.some(agent => agent.missingData.length)) conditions.push("documented-missing-inputs");
  const skeptic = cycle.agents.find(agent => agent.role === "skeptic");
  if (skeptic?.risks.length) conditions.push("skeptic-raised-risks");
  const sentiment = cycle.agents.find(agent => agent.role === "sentiment"), charts = cycle.agents.find(agent => agent.role === "charts");
  if (sentiment?.status === "complete" && sentiment.stance !== "bullish") conditions.push("sentiment-not-bullish");
  if (charts?.status === "complete" && charts.stance !== "bullish") conditions.push("charts-not-bullish");
  return conditions;
}

export function closedTradeOutcome(cycle: DeskCycle, before: PaperAccount, entry: AgentEntryRecord | null): AgentTradeOutcome {
  const fill = cycle.fill, position = before.position;
  if (!fill || fill.side !== "SELL" || fill.classification !== "paper-simulation" || !position || position.symbol !== fill.symbol || position.quantity !== fill.quantity || !finite(fill.realizedPnl)
    || !validTime(fill.filledAt) || !validTime(position.openedAt) || !finite(fill.notional) || !finite(fill.fees) || fill.fees < 0 || !finite(fill.fillPrice) || fill.fillPrice <= 0
    || !finite(position.quantity) || !Number.isInteger(position.quantity) || position.quantity <= 0 || !finite(position.averageEntry) || position.averageEntry <= 0 || !finite(position.entryFees) || position.entryFees < 0)
    throw new AgentDeskError("INVALID_LEARNING_CLOSE", "A learning outcome requires a confirmed complete paper-position close.");
  const expectedPnl = rounded(fill.notional - fill.fees - position.quantity * position.averageEntry - position.entryFees);
  if (Math.abs(expectedPnl - fill.realizedPnl) > 1e-6 || Math.abs(fill.notional - rounded(fill.quantity * fill.fillPrice)) > 1e-6 || Date.parse(fill.filledAt) < Date.parse(position.openedAt))
    throw new AgentDeskError("INVALID_LEARNING_CLOSE", "The recorded exit does not reconcile with its paper position.");
  if (entry && (entry.version !== 1 || !validArtifactId(entry.cycleId) || !sourceHash(entry.sourceHash) || !finite(entry.entryPrice) || !finite(entry.entryFees) || !nullablePercent(entry.confidence) || !nullablePercent(entry.coverage) || !Array.isArray(entry.conditions) || entry.conditions.some(item => typeof item !== "string") || !Array.isArray(entry.agents) || !entry.agents.every(validEntryReport)
    || entry.symbol !== position.symbol || entry.openedAt !== position.openedAt || entry.quantity !== position.quantity || Math.abs(entry.entryPrice - position.averageEntry) > 1e-8 || Math.abs(entry.entryFees - position.entryFees) > 1e-8))
    throw new AgentDeskError("ENTRY_OUTCOME_MISMATCH", "The saved entry belongs to a different paper position.");
  const basis = position.quantity * position.averageEntry + position.entryFees;
  return { version: 1, id: `outcome:${cycle.id}`, symbol: fill.symbol, entryCycleId: entry?.cycleId ?? null, exitCycleId: cycle.id,
    entryResearchRunId: entry?.researchRunId ?? null, exitResearchRunId: cycle.researchRunId,
    openedAt: position.openedAt, closedAt: fill.filledAt, quantity: fill.quantity,
    entryPrice: position.averageEntry, exitPrice: fill.fillPrice, entryFees: position.entryFees, exitFees: fill.fees,
    netPnl: fill.realizedPnl, netReturnPct: rounded(fill.realizedPnl / basis * 100), holdingMinutes: rounded((Date.parse(fill.filledAt) - Date.parse(position.openedAt)) / 60_000),
    protective: cycle.decision?.protective === true, exitCode: cycle.decision?.code ?? "PAPER_SELL", exitReason: fill.reason,
    entrySourceHash: entry?.sourceHash ?? null, exitSourceHash: cycle.sourceHash,
    entryConfidence: entry?.confidence ?? null, entryCoverage: entry?.coverage ?? null,
    entryConditions: entry?.conditions ?? [], entryAgents: entry?.agents ?? [],
    attribution: entry ? "linked-entry" : "legacy-entry-unavailable", classification: "paper-simulation" };
}

function validateOutcome(value: unknown): AgentTradeOutcome {
  if (!artifactObject(value) || value.version !== 1 || value.classification !== "paper-simulation" || !validArtifactId(value.id) || !validSymbol(value.symbol) || !validArtifactId(value.exitCycleId) || !nullableId(value.entryCycleId) || !nullableId(value.entryResearchRunId) || !nullableId(value.exitResearchRunId)
    || !finite(value.quantity) || !Number.isInteger(value.quantity) || value.quantity <= 0 || !finite(value.entryPrice) || value.entryPrice <= 0 || !finite(value.exitPrice) || value.exitPrice <= 0 || !finite(value.entryFees) || value.entryFees < 0 || !finite(value.exitFees) || value.exitFees < 0
    || !finite(value.netPnl) || !finite(value.netReturnPct) || !finite(value.holdingMinutes) || value.holdingMinutes < 0 || !Array.isArray(value.entryConditions) || value.entryConditions.some(item => typeof item !== "string" || item.length > 200) || !Array.isArray(value.entryAgents) || !value.entryAgents.every(validEntryReport)
    || !validTime(value.closedAt) || !validTime(value.openedAt) || Date.parse(value.openedAt) > Date.parse(value.closedAt) || !sourceHash(value.exitSourceHash) || !nullablePercent(value.entryConfidence) || !nullablePercent(value.entryCoverage)
    || !["linked-entry", "legacy-entry-unavailable"].includes(String(value.attribution)) || typeof value.protective !== "boolean" || typeof value.exitCode !== "string" || typeof value.exitReason !== "string")
    throw new AgentDeskError("AGENT_OUTCOME_INVALID", "A saved paper outcome is invalid and cannot inform learning.", 503);
  const outcome = value as unknown as AgentTradeOutcome;
  const basis = outcome.quantity * outcome.entryPrice + outcome.entryFees;
  if (outcome.id !== `outcome:${outcome.exitCycleId}` || !Number.isFinite(basis) || Math.abs(rounded(rounded(outcome.quantity * outcome.exitPrice) - outcome.exitFees - basis) - outcome.netPnl) > 1e-6
    || Math.abs(rounded(outcome.netPnl / basis * 100) - outcome.netReturnPct) > 1e-6 || Math.abs(rounded((Date.parse(outcome.closedAt) - Date.parse(outcome.openedAt)) / 60_000) - outcome.holdingMinutes) > 1e-6
    || (outcome.attribution === "linked-entry" ? !validArtifactId(outcome.entryCycleId) || !sourceHash(outcome.entrySourceHash) : outcome.entryCycleId !== null || outcome.entrySourceHash !== null || outcome.entryConditions.length > 0 || outcome.entryAgents.length > 0))
    throw new AgentDeskError("AGENT_OUTCOME_INVALID", "The saved paper result does not reconcile with its original entry and exit observations.", 503);
  return outcome;
}
const CONDITION_LABELS: Record<string, string> = {
  "confidence-below-60": "Entries with research confidence below 60",
  "confidence-at-least-60": "Entries with research confidence of at least 60",
  "coverage-below-60": "Entries with evidence coverage below 60",
  "source-concentration-over-65": "Entries dominated by one source domain",
  "cohort-disagreement": "Entries with recorded cohort disagreement",
  "documented-missing-inputs": "Entries with documented missing inputs",
  "skeptic-raised-risks": "Entries with risks raised by Skeptic",
  "sentiment-not-bullish": "Entries without a bullish Sentiment assessment",
  "charts-not-bullish": "Entries without a bullish Charts assessment",
};

/** Statistical memory is descriptive and versioned. It does not rewrite model
 * weights, source scores, order policy, or the original entry decision. */
export function buildAgentLearning(outcomes: AgentTradeOutcome[], options: { now?: string; symbol?: string; limit?: number; totalRecordedTrades?: number } = {}): AgentLearningSummary {
  const generatedAt = options.now ?? new Date().toISOString(), now = Date.parse(generatedAt);
  if (!Number.isFinite(now)) throw new AgentDeskError("INVALID_LEARNING_TIME", "Learning needs a valid observation cutoff.", 400);
  if (options.symbol !== undefined && !validSymbol(options.symbol)) throw new AgentDeskError("INVALID_AGENT_SYMBOL", "Choose a valid research symbol.", 400);
  if (options.totalRecordedTrades !== undefined && (!Number.isSafeInteger(options.totalRecordedTrades) || options.totalRecordedTrades < 0)) throw new AgentDeskError("INVALID_LEARNING_COUNT", "The outcome sample count is invalid.", 400);
  const unique = new Map<string, AgentTradeOutcome>();
  for (const raw of outcomes) {
    const outcome = validateOutcome(raw);
    if (Date.parse(outcome.closedAt) > now || options.symbol && outcome.symbol !== options.symbol) continue;
    if (unique.has(outcome.id) && JSON.stringify(unique.get(outcome.id)) !== JSON.stringify(outcome)) throw new AgentDeskError("CONFLICTING_AGENT_OUTCOME", "Duplicate outcome identities disagree; learning is blocked.", 503);
    unique.set(outcome.id, outcome);
  }
  const limit = boundedArtifactLimit(options.limit, 200, 500);
  const rows = [...unique.values()].sort((a, b) => Date.parse(b.closedAt) - Date.parse(a.closedAt) || a.id.localeCompare(b.id)).slice(0, limit);
  const linked = rows.filter(row => row.attribution === "linked-entry");
  const wins = rows.filter(row => row.netPnl > 1e-8).length, losses = rows.filter(row => row.netPnl < -1e-8).length;
  const groups = new Map<string, AgentTradeOutcome[]>();
  for (const outcome of linked) for (const condition of new Set(outcome.entryConditions)) groups.set(condition, [...(groups.get(condition) ?? []), outcome]);
  const lessons: AgentLesson[] = [...groups].flatMap(([condition, samples]) => {
    const losing = samples.filter(sample => sample.netPnl < -1e-8);
    if (!losing.length) return [];
    const title = CONDITION_LABELS[condition] ?? (condition.startsWith("instrument:") ? `${condition.slice(11)} paper-trade outcomes` : "Recorded entry condition");
    const netPnl = rounded(samples.reduce((total, row) => total + row.netPnl, 0));
    return [{ version: 1 as const, id: `lesson:${condition}`, title, condition,
      description: `${losing.length} of ${samples.length} closed paper trades with this recorded entry condition lost money after costs. Review the cited entry risks and exit reasons before repeating the setup. This association does not establish the cause of a loss or predict the next trade.`,
      status: samples.length >= 3 && losing.length >= 2 ? "observed-pattern" as const : "review-candidate" as const,
      sampleCount: samples.length, lossCount: losing.length, netPnl,
      relatedCycleIds: losing.slice(0, 10).map(row => row.exitCycleId),
      firstObservedAt: samples[samples.length - 1].closedAt, lastObservedAt: samples[0].closedAt, advisoryOnly: true as const }];
  }).sort((a, b) => b.lossCount - a.lossCount || a.netPnl - b.netPnl || a.id.localeCompare(b.id)).slice(0, 24);
  const byRole = AGENT_ROLES.map(role => {
    const samples = linked.filter(row => row.entryAgents.some(agent => agent.role === role && agent.status === "complete"));
    const roleWins = samples.filter(row => row.netPnl > 1e-8).length, roleLosses = samples.filter(row => row.netPnl < -1e-8).length;
    return { role, reviewedTrades: samples.length, wins: roleWins, losses: roleLosses, breakeven: samples.length - roleWins - roleLosses,
      netPnl: rounded(samples.reduce((total, row) => total + row.netPnl, 0)), observedWinRatePct: samples.length ? rounded(roleWins / samples.length * 100) : null };
  });
  const totalRecordedTrades = Math.max(rows.length, options.totalRecordedTrades ?? unique.size);
  return { version: "slice-agent-learning-1.0.0", generatedAt, symbol: options.symbol ?? null,
    closedTrades: rows.length, linkedTrades: linked.length, unattributedTrades: rows.length - linked.length,
    wins, losses, breakeven: rows.length - wins - losses, netPnl: rounded(rows.reduce((total, row) => total + row.netPnl, 0)),
    observedWinRatePct: rows.length ? rounded(wins / rows.length * 100) : null, byRole, lessons,
    recentOutcomes: rows.slice(0, 10).map(row => ({ ...row, entryAgents: row.entryAgents.map(agent => ({ ...agent, findings: agent.findings.slice(0, 3), toolCalls: [], risks: agent.risks.slice(0, 3), missingData: agent.missingData.slice(0, 3) })) })),
    sampleWindow: { limit, totalRecordedTrades, truncated: totalRecordedTrades > rows.length, oldestClosedAt: rows.at(-1)?.closedAt ?? null, newestClosedAt: rows[0]?.closedAt ?? null },
    advisoryOnly: true,
    limitations: [
      "These are observed closed paper-trade results after configured costs, not a calibrated probability of future profit or live brokerage performance.",
      "Open positions and unrealized losses are not included in the closed-trade win rate. The displayed sample window and count must be considered.",
      "Roles share evidence and the same trade outcome. Associated role results do not establish independent agent accuracy or causal responsibility.",
      "Lessons are descriptive retrieval memory. They do not fine-tune a model, change safeguards, or guarantee that a mistake cannot recur.",
      "Entries without a recorded original team decision remain unattributed and cannot create agent-specific lessons.",
    ] };
}

export async function readAgentLearning(scope: DeskScope, options: { symbol?: string; limit?: number; now?: string } = {}, db: DeskArtifactDatabase = deskArtifactDatabase): Promise<AgentLearningSummary> {
  const limit = boundedArtifactLimit(options.limit, 200, 500), now = options.now ?? new Date().toISOString();
  if (!validTime(now)) throw new AgentDeskError("INVALID_LEARNING_TIME", "Learning needs a valid observation cutoff.", 400);
  if (options.symbol !== undefined && !validSymbol(options.symbol)) throw new AgentDeskError("INVALID_AGENT_SYMBOL", "Choose a valid research symbol.", 400);
  const where = { ...artifactScope(scope, "outcome"), createdAt: { lte: new Date(now) }, ...(options.symbol ? { title: options.symbol } : {}) };
  const [records, totalRecordedTrades] = await Promise.all([
    db.backendPlatformEvent.findMany({ where, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit, select: { metadataJson: true } }),
    db.backendPlatformEvent.count({ where }),
  ]);
  return buildAgentLearning(records.map(row => decodePrivateArtifact<AgentTradeOutcome>(row.metadataJson, scope, "outcome")), { ...options, now, limit, totalRecordedTrades });
}
