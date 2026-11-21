import "server-only";
import { AGENT_ROLES, AgentDeskError, type DeskCycle, type DeskScope } from "./contracts";
import { validatePaperAccount, type PaperAccount, type PaperPosition } from "./guardrails";
import type { AgentBoardMessage, AgentBoardMessageInput, AgentCollaborationView, AgentTradeBrief, AgentTradeOutcome } from "./collaboration-types";
import { artifactHash, artifactObject, artifactScope, boundedArtifactLimit, decodePrivateArtifact, deskArtifactDatabase, readPrivateArtifact, validArtifactId, writePrivateArtifact, type DeskArtifactDatabase } from "./collaboration-storage";
import { closedTradeOutcome, entryLearningConditions, readAgentLearning, type AgentEntryRecord } from "./learning";

const phases = ["discovery", "research", "challenge", "reply", "decision", "execution", "learning"];
const validTime = (value: unknown): value is string => typeof value === "string" && Number.isFinite(Date.parse(value));
const finite = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const arrayOfIds = (value: unknown, maximum: number): value is string[] => Array.isArray(value) && value.length <= maximum && value.every(validArtifactId) && new Set(value).size === value.length;
const rounded = (value: number) => Math.round(value * 1e8) / 1e8;
const close = (a: number, b: number) => Math.abs(a - b) <= 1e-6;

function validateMessage(value: unknown): AgentBoardMessage {
  if (!artifactObject(value) || value.version !== 1 || !validArtifactId(value.id) || !validArtifactId(value.cycleId) || typeof value.symbol !== "string" || !/^[A-Z0-9^][A-Z0-9.^:-]{0,31}$/.test(value.symbol) || typeof value.round !== "number" || !Number.isInteger(value.round) || value.round < 0 || value.round > 16 || !phases.includes(String(value.phase)) || ![...AGENT_ROLES, "system", "founder"].includes(String(value.from)) || ![...AGENT_ROLES, "team", "founder"].includes(String(value.to)) || typeof value.body !== "string" || !value.body.trim() || value.body.length > 12_000 || !arrayOfIds(value.replyToIds, 24) || !arrayOfIds(value.evidenceIds, 80) || !validTime(value.createdAt) || (value.researchRunId !== null && !validArtifactId(value.researchRunId)) || (value.sourceHash !== null && (typeof value.sourceHash !== "string" || !/^[a-f0-9]{64}$/.test(value.sourceHash))))
    throw new AgentDeskError("INVALID_AGENT_MESSAGE", "A discussion message requires a bounded body, valid sender, exact cycle, dated sources, and reply references.", 400);
  if (value.report !== undefined && value.report !== null && (!artifactObject(value.report) || value.report.role !== value.from || !["complete", "failed", "skipped"].includes(String(value.report.status)))) throw new AgentDeskError("INVALID_AGENT_MESSAGE", "A report must match the agent that wrote the message.", 400);
  if (value.from === "founder" && (value.report || value.evidenceIds.length)) throw new AgentDeskError("INVALID_FOUNDER_MESSAGE", "A founder message cannot impersonate an agent report or certify market evidence.", 400);
  return value as unknown as AgentBoardMessage;
}

/** Actual agent messages are durable before peers read them. Callers recheck the
 * founder authorization and cycle lease; these functions additionally bind every
 * record and reply reference to its exact owner and firm. */
export async function appendAgentBoardMessage(scope: DeskScope, input: AgentBoardMessageInput, db: DeskArtifactDatabase = deskArtifactDatabase): Promise<AgentBoardMessage> {
  const message = validateMessage({ ...structuredClone(input), version: 1 });
  if (message.replyToIds.includes(message.id)) throw new AgentDeskError("INVALID_AGENT_REPLY", "A discussion message cannot reply to itself.", 400);
  if (message.replyToIds.length) {
    const parents = await Promise.all(message.replyToIds.map(id => readPrivateArtifact<AgentBoardMessage>(scope, "board", id, db)));
    if (parents.some(parent => !parent || parent.cycleId !== message.cycleId || Date.parse(parent.createdAt) > Date.parse(message.createdAt))) throw new AgentDeskError("INVALID_AGENT_REPLY", "Replies must reference earlier messages in this owner's exact discussion cycle.", 400);
  }
  return writePrivateArtifact(scope, "board", message.id, message, { title: `${message.from} → ${message.to}`, detail: message.body, status: message.phase, sourceId: message.cycleId }, db);
}

export async function readAgentBoard(scope: DeskScope, options: { cycleId?: string; limit?: number; before?: string } = {}, db: DeskArtifactDatabase = deskArtifactDatabase): Promise<AgentBoardMessage[]> {
  if (options.cycleId && !validArtifactId(options.cycleId)) throw new AgentDeskError("INVALID_AGENT_RECORD_ID", "Choose a valid discussion cycle.", 400);
  if (options.before && !validTime(options.before)) throw new AgentDeskError("INVALID_AGENT_TIME", "Choose a valid discussion cutoff.", 400);
  const limit = boundedArtifactLimit(options.limit, 50, 100);
  const rows = await db.backendPlatformEvent.findMany({ where: { ...artifactScope(scope, "board"), ...(options.cycleId ? { sourceId: options.cycleId } : {}), ...(options.before ? { createdAt: { lte: new Date(options.before) } } : {}) },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit, select: { metadataJson: true } });
  return rows.map(row => validateMessage(decodePrivateArtifact(row.metadataJson, scope, "board")))
    .filter(message => !options.before || Date.parse(message.createdAt) <= Date.parse(options.before))
    .sort((a, b) => Date.parse(a.createdAt) - Date.parse(b.createdAt) || a.round - b.round || a.id.localeCompare(b.id));
}

/** The position identity survives later market marks and tighter exit settings. */
export function entryArtifactId(position: PaperPosition): string {
  return artifactHash(JSON.stringify({ symbol: position.symbol, openedAt: position.openedAt, quantity: position.quantity, averageEntry: position.averageEntry, entryFees: position.entryFees }));
}
function validateTradeTransition(cycle: DeskCycle, before: PaperAccount, after: PaperAccount) {
  validatePaperAccount(before); validatePaperAccount(after);
  const fill = cycle.fill;
  if (!fill || cycle.mode !== "paper" || cycle.executionStatus !== "filled" || cycle.decision?.status !== "filled" || fill.classification !== "paper-simulation" || fill.cycleId !== cycle.id || fill.symbol !== cycle.symbol || after.lastCycleId !== cycle.id || after.sequence !== before.sequence + 1 || fill.sequence !== after.sequence || after.lastFillAt !== fill.filledAt || after.lastFillObservedAt !== fill.observedAt || !validTime(fill.filledAt) || !validTime(fill.observedAt) || !finite(fill.quantity) || !Number.isInteger(fill.quantity) || fill.quantity <= 0 || !finite(fill.fillPrice) || fill.fillPrice <= 0 || !finite(fill.notional) || !finite(fill.fees) || fill.fees < 0 || !finite(fill.realizedPnl) || !close(fill.notional, rounded(fill.quantity * fill.fillPrice)) || !close(after.feesPaid, before.feesPaid + fill.fees))
    throw new AgentDeskError("INVALID_AGENT_TRADE_ARTIFACT", "The trade brief does not match a committed paper ledger transition.");
  const quote = cycle.executionQuote;
  if (!quote || quote.symbol !== fill.symbol || quote.observedAt !== fill.observedAt || quote.retrievedAt !== after.lastFillRetrievedAt || !close(quote.price, fill.observedPrice) || !validTime(quote.retrievedAt))
    throw new AgentDeskError("INVALID_AGENT_TRADE_SOURCE", "The paper fill must retain its original matching execution observation and provider receipt.");
  if (fill.side === "BUY") {
    if (before.position || !after.position || after.position.symbol !== fill.symbol || after.position.quantity !== fill.quantity || after.position.openedAt !== fill.filledAt || !close(after.position.averageEntry, fill.fillPrice) || !close(after.position.entryFees, fill.fees) || !close(after.cash, before.cash - fill.notional - fill.fees) || fill.realizedPnl !== 0 || !close(before.realizedPnl, after.realizedPnl))
      throw new AgentDeskError("INVALID_AGENT_TRADE_ARTIFACT", "An entry brief must match the new paper position and its cash debit.");
  } else if (fill.side === "SELL") {
    if (!before.position || after.position || before.position.quantity !== fill.quantity || before.position.symbol !== fill.symbol || !close(after.cash, before.cash + fill.notional - fill.fees) || !close(after.realizedPnl, before.realizedPnl + fill.realizedPnl))
      throw new AgentDeskError("INVALID_AGENT_TRADE_ARTIFACT", "An exit brief must match the closed paper position and realized cash credit.");
  } else throw new AgentDeskError("INVALID_AGENT_TRADE_ARTIFACT", "Unsupported paper order side.");
}

/** Call INSIDE the same transaction that commits the account and unique cycle.
 * All side effects are database records: no network, email, broker, or external
 * message delivery occurs here. Rollback includes every brief and lesson input. */
export async function writeCycleArtifacts(transaction: DeskArtifactDatabase, scope: DeskScope,
  input: { cycle: DeskCycle; beforeAccount: PaperAccount; afterAccount: PaperAccount }): Promise<{ brief: AgentTradeBrief | null; outcome: AgentTradeOutcome | null }> {
  const { cycle, beforeAccount, afterAccount } = input;
  if (!cycle.fill) return { brief: null, outcome: null };
  validateTradeTransition(cycle, beforeAccount, afterAccount);
  const fill = cycle.fill;
  let entry: AgentEntryRecord | null = null, outcome: AgentTradeOutcome | null = null;
  if (fill.side === "BUY") {
    const id = entryArtifactId(afterAccount.position!);
    entry = { version: 1, id, cycleId: cycle.id, symbol: cycle.symbol, openedAt: fill.filledAt,
      quantity: fill.quantity, entryPrice: fill.fillPrice, entryFees: fill.fees, sourceHash: cycle.sourceHash,
      researchRunId: cycle.researchRunId, confidence: cycle.researchScore?.confidence ?? null, coverage: cycle.researchScore?.quality.evidenceCoverage ?? null,
      conditions: entryLearningConditions(cycle), agents: structuredClone(cycle.agents) };
    await writePrivateArtifact(scope, "entry", id, entry, { title: cycle.symbol, detail: "Original paper entry and its unmodified agent reports", status: "OpenAtEntry", sourceId: cycle.id }, transaction);
  } else {
    entry = await readPrivateArtifact<AgentEntryRecord>(scope, "entry", entryArtifactId(beforeAccount.position!), transaction);
    outcome = closedTradeOutcome(cycle, beforeAccount, entry);
    await writePrivateArtifact(scope, "outcome", outcome.id, outcome, { title: cycle.symbol, detail: `${outcome.netPnl >= 0 ? "Gain" : "Loss"} after configured paper costs: USD ${outcome.netPnl}`, status: outcome.attribution, sourceId: cycle.id }, transaction);
  }
  const summary = fill.side === "BUY"
    ? `Paper purchase: ${fill.quantity} ${fill.symbol} at USD ${fill.fillPrice}, with USD ${fill.fees} in entry fees. The position is open; no realized profit or loss is claimed.`
    : `Paper position closed: ${fill.quantity} ${fill.symbol} at USD ${fill.fillPrice}. Realized net result after entry and exit fees: USD ${fill.realizedPnl}. ${fill.reason}`;
  const brief: AgentTradeBrief = { version: 1, id: `brief:${cycle.id}`, cycleId: cycle.id, symbol: cycle.symbol, side: fill.side,
    title: fill.side === "BUY" ? `${cycle.symbol} paper entry recorded` : `${cycle.symbol} paper trade result`, summary,
    createdAt: fill.filledAt, readAt: null, delivery: "in-app", classification: "paper-simulation", fill: structuredClone(fill),
    contextQuote: cycle.contextQuote ?? null, executionQuote: cycle.executionQuote ?? null, researchRunId: cycle.researchRunId, sourceHash: cycle.sourceHash,
    entryCycleId: entry?.cycleId ?? null, realized: fill.side === "SELL", netPnl: outcome?.netPnl ?? null, netReturnPct: outcome?.netReturnPct ?? null,
    attribution: fill.side === "BUY" ? "entry-open" : outcome!.attribution };
  await writePrivateArtifact(scope, "brief", brief.id, brief, { title: brief.title, detail: brief.summary, status: "DeliveredInApp", sourceId: cycle.id }, transaction);
  await appendAgentBoardMessage(scope, { id: `execution:${cycle.id}`, cycleId: cycle.id, symbol: cycle.symbol, round: 0, phase: "execution", from: "system", to: "founder",
    replyToIds: [], body: summary, evidenceIds: [], createdAt: fill.filledAt, researchRunId: cycle.researchRunId, sourceHash: cycle.sourceHash }, transaction);
  if (outcome) await appendAgentBoardMessage(scope, { id: `learning:${cycle.id}`, cycleId: cycle.id, symbol: cycle.symbol, round: 0, phase: "learning", from: "system", to: "team", replyToIds: [`execution:${cycle.id}`],
    body: outcome.attribution === "linked-entry"
      ? `A closed paper outcome is now available to all six roles: net USD ${outcome.netPnl}, ${outcome.netReturnPct}% on entry cost, ${outcome.holdingMinutes} minutes held. Compare entry cycle ${outcome.entryCycleId} with exit ${cycle.id}; review the original risks before repeating a similar setup. This result is one observation, not proof of forecasting skill.`
      : `This closed paper trade has a measured net result of USD ${outcome.netPnl}, but its original team entry record is unavailable. It is excluded from agent-specific lessons and role attribution.`,
    evidenceIds: [], createdAt: fill.filledAt, researchRunId: cycle.researchRunId, sourceHash: cycle.sourceHash }, transaction);
  return { brief, outcome };
}

function validateBrief(value: unknown): AgentTradeBrief {
  if (!artifactObject(value) || value.version !== 1 || !validArtifactId(value.id) || !validArtifactId(value.cycleId) || value.classification !== "paper-simulation" || value.delivery !== "in-app" || !["BUY", "SELL"].includes(String(value.side)) || !validTime(value.createdAt) || !artifactObject(value.fill) || typeof value.title !== "string" || typeof value.summary !== "string") throw new AgentDeskError("AGENT_BRIEF_INVALID", "The saved personal trade brief failed validation.", 503);
  return value as unknown as AgentTradeBrief;
}
type BriefRead = { version: 1; id: string; briefId: string; readAt: string };
export async function readAgentBriefs(scope: DeskScope, options: { limit?: number } = {}, db: DeskArtifactDatabase = deskArtifactDatabase): Promise<AgentTradeBrief[]> {
  const limit = boundedArtifactLimit(options.limit, 30, 100);
  const rows = await db.backendPlatformEvent.findMany({ where: artifactScope(scope, "brief"), orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: limit, select: { metadataJson: true } });
  const briefs = rows.map(row => validateBrief(decodePrivateArtifact(row.metadataJson, scope, "brief")));
  if (!briefs.length) return [];
  const reads = await db.backendPlatformEvent.findMany({ where: { ...artifactScope(scope, "read"), sourceId: { in: briefs.map(brief => brief.id) } }, select: { metadataJson: true } });
  const acknowledged = new Map(reads.map(row => {
    const item = decodePrivateArtifact<BriefRead>(row.metadataJson, scope, "read");
    if (item.version !== 1 || !validArtifactId(item.briefId) || !validTime(item.readAt)) throw new AgentDeskError("AGENT_BRIEF_INVALID", "A personal brief receipt is invalid.", 503);
    return [item.briefId, item.readAt] as const;
  }));
  return briefs.map(brief => ({ ...brief, readAt: acknowledged.get(brief.id) ?? null }));
}
export async function markAgentBriefRead(scope: DeskScope, id: string, db: DeskArtifactDatabase = deskArtifactDatabase, now = new Date().toISOString()): Promise<AgentTradeBrief> {
  const found = await readPrivateArtifact<AgentTradeBrief>(scope, "brief", id, db);
  if (!found) throw new AgentDeskError("AGENT_BRIEF_NOT_FOUND", "This personal trade brief does not exist in the current workspace.", 404);
  const brief = validateBrief(found);
  if (!validTime(now) || Date.parse(now) < Date.parse(brief.createdAt)) throw new AgentDeskError("INVALID_AGENT_TIME", "A brief cannot be read before it was created.", 400);
  const receipt = await writePrivateArtifact<BriefRead>(scope, "read", id, { version: 1, id, briefId: id, readAt: now },
    { title: "Personal trade brief read", detail: brief.title, status: "Read", sourceId: id }, db, true);
  return { ...brief, readAt: receipt.readAt };
}
export async function readAgentCollaboration(scope: DeskScope, db: DeskArtifactDatabase = deskArtifactDatabase): Promise<AgentCollaborationView> {
  const [board, briefs, learning] = await Promise.all([readAgentBoard(scope, { limit: 50 }, db), readAgentBriefs(scope, { limit: 30 }, db), readAgentLearning(scope, { limit: 200 }, db)]);
  return { board, briefs, learning };
}
