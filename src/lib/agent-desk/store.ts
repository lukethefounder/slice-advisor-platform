import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { resolveResearchInstrument } from "@/lib/intelligence/research-instrument";
import { AgentDeskError, DEFAULT_DESK_SCOUTING, type DeskScope, type DeskSettings, type DeskBusy, type DeskCycle, type DeskScoutingSettings, type AgentFinding } from "./contracts";
import type { ScoutDiscovery } from "./research-tool-types";
import { writeCycleArtifacts } from "./collaboration";
import { validateDeskOperations, emptyAgentSignal, type AgentSignalState } from "./operations";
import { DEFAULT_DESK_POLICY, DEFAULT_DESK_CONTROLS, createPaperAccount, validatePaperAccount, validateDeskPolicy, validateDeskControls, type DeskControls, type PaperAccount, type DeskAssessment } from "./guardrails";

export const DESK_STATE_EVENT = "SLICE_AGENT_DESK_STATE_V1";
export const DESK_CYCLE_EVENT = "SLICE_AGENT_DESK_CYCLE_V1";
export type DeskScoutingState = {
  lastScanAt: string | null; nextScanAt: string | null; lastError: string | null;
  busy: { id: string; token: string; jobId: string | null; startedAt: string; expiresAt: string; revision: number; scheduled?: boolean } | null;
  discovery: ScoutDiscovery | null; selection: AgentFinding | null;
  pendingResearch: { scanId: string; symbol: string; selectedAt: string } | null;
  lastQueuedScanId: string | null;
};
export const emptyScoutingState = (): DeskScoutingState => ({ lastScanAt: null, nextScanAt: null, lastError: null, busy: null, discovery: null, selection: null, pendingResearch: null, lastQueuedScanId: null });
export type DeskState = {
  version: 1; revision: number; settings: DeskSettings; controls: DeskControls; account: PaperAccount;
  busy: (DeskBusy & { token: string; symbol?: string; scoutingId?: string | null; discovery?: ScoutDiscovery | null }) | null;
  scouting: DeskScoutingState;
  signal?: AgentSignalState;
  /** A durable revocation fence even if the separate broker-state write fails. */
  brokerPausedAtRevision?: number;
  latestCycleId: string | null; nextRunAt: string | null;
  lastCheckedAt: string | null; lastError: string | null; updatedAt: string;
};
export type DeskRecord = { id: string; raw: string; state: DeskState };
/** Execution inputs are private, server-written data. They never come from an approval request. */
export type CycleReceipt = {
  cycle: DeskCycle; assessment: DeskAssessment | null;
  positionFingerprint: string; approvalOf: string | null;
};
const stateKey = (scope: DeskScope) => `agent-desk-state:${scope.firmId}`;
const cycleKey = (scope: DeskScope, id: string) => `agent-desk-cycle:${scope.firmId}:${id}`;
const sha = (s: string) => createHash("sha256").update(s).digest("hex");
const object = (v: unknown): v is Record<string, unknown> => Boolean(v) && typeof v === "object" && !Array.isArray(v);

export function encodeDeskEnvelope(value: unknown): string {
  const payload = JSON.stringify(value);
  return JSON.stringify({ version: 1, checksum: sha(payload), payload });
}
export function decodeDeskEnvelope(raw: string): unknown {
  try {
    const row: unknown = JSON.parse(raw);
    if (!object(row) || row.version !== 1 || typeof row.payload !== "string" || row.checksum !== sha(row.payload)) throw new Error("checksum");
    return JSON.parse(row.payload);
  } catch { throw new AgentDeskError("DESK_STORAGE_INVALID", "The saved desk record failed its integrity check. Execution is blocked; restore the verified record before continuing.", 503); }
}
export function validateDeskSettings(value: unknown): DeskSettings {
  if (!object(value) || Object.keys(value).some(key => !["symbol", "intervalMinutes", "initialCapital", "policy", "scouting", "operations"].includes(key))) throw new AgentDeskError("INVALID_SETTINGS", "Supply the complete desk settings without extra fields.", 400);
  const { symbol, intervalMinutes, initialCapital } = value;
  if (typeof symbol !== "string" || !/^[A-Z0-9^][A-Z0-9.^:-]{0,31}$/.test(symbol) || typeof intervalMinutes !== "number" || !Number.isInteger(intervalMinutes) || intervalMinutes < 5 || intervalMinutes > 240 || typeof initialCapital !== "number" || !Number.isFinite(initialCapital) || initialCapital < 100 || initialCapital > 1e9)
    throw new AgentDeskError("INVALID_SETTINGS", "Choose a valid stock symbol, a 5–240 minute research interval, and $100–$1 billion of simulated starting cash.", 400);
  const policy = validateDeskPolicy(value.policy);
  const scouting = validateScoutingSettings(value.scouting);
  return { symbol: resolveResearchInstrument(symbol).symbol, intervalMinutes, initialCapital, policy, scouting, operations: validateDeskOperations(value.operations) };
}
export function validateScoutingSettings(value: unknown): DeskScoutingSettings {
  if (value === undefined) return structuredClone(DEFAULT_DESK_SCOUTING);
  if (!object(value) || Object.keys(value).some(key => !["enabled", "autoResearch", "intervalMinutes", "universe", "maxCandidates"].includes(key)) || typeof value.enabled !== "boolean" || typeof value.autoResearch !== "boolean" || typeof value.intervalMinutes !== "number" || !Number.isInteger(value.intervalMinutes) || value.intervalMinutes < 5 || value.intervalMinutes > 240 || typeof value.maxCandidates !== "number" || !Number.isInteger(value.maxCandidates) || value.maxCandidates < 1 || value.maxCandidates > 12 || !Array.isArray(value.universe) || value.universe.length > 40 || value.universe.some(symbol => typeof symbol !== "string" || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)) || new Set(value.universe).size !== value.universe.length)
    throw new AgentDeskError("INVALID_SCOUTING", "Choose a 5–240 minute scout interval, 1–12 candidates, and up to 40 distinct equity research symbols.", 400);
  return { enabled: value.enabled, autoResearch: value.autoResearch, intervalMinutes: value.intervalMinutes, universe: value.universe as string[], maxCandidates: value.maxCandidates };
}
function validateState(value: unknown): DeskState {
  if (!object(value) || value.version !== 1 || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || !object(value.account)) throw new AgentDeskError("DESK_STORAGE_INVALID", "The saved desk state is invalid. Execution is blocked.", 503);
  const state = value as unknown as DeskState;
  const settings = validateDeskSettings(state.settings); validateDeskControls(state.controls); validatePaperAccount(state.account);
  if (state.brokerPausedAtRevision !== undefined && (!Number.isSafeInteger(state.brokerPausedAtRevision) || state.brokerPausedAtRevision < 0 || state.brokerPausedAtRevision > state.revision)) throw new AgentDeskError("DESK_STORAGE_INVALID", "The broker pause revision is invalid. Execution is blocked.", 503);
  if (state.account.initialCapital !== state.settings.initialCapital || !Number.isFinite(Date.parse(state.updatedAt)) || (state.busy && (!state.busy.token || !state.busy.cycleId || !Number.isFinite(Date.parse(state.busy.expiresAt))))) throw new AgentDeskError("DESK_STORAGE_INVALID", "The saved desk controls or account do not agree. Execution is blocked.", 503);
  const scouting = state.scouting ?? emptyScoutingState();
  if (scouting.busy && (!scouting.busy.token || !scouting.busy.id || !Number.isFinite(Date.parse(scouting.busy.expiresAt)))) throw new AgentDeskError("DESK_STORAGE_INVALID", "The scout job lease is invalid.", 503);
  return { ...state, settings, scouting, signal: state.signal ?? emptyAgentSignal() };
}
function stateStatus(state: DeskState) {
  return state.controls.killSwitch ? "Killed" : state.controls.armed && state.account.position ? "Monitoring" : state.controls.autonomous && !state.controls.paused ? "Autonomous" : state.settings.scouting?.enabled || state.scouting.pendingResearch ? "Scouting" : "Paused";
}
export function positionFingerprint(account: PaperAccount): string {
  // Quote marks may advance during research. Actual exposure changes invalidate a proposal.
  return sha(JSON.stringify({ cash: account.cash, position: account.position ? {
    symbol: account.position.symbol, quantity: account.position.quantity, averageEntry: account.position.averageEntry,
    entryFees: account.position.entryFees, openedAt: account.position.openedAt,
  } : null, lastFillAt: account.lastFillAt, feesPaid: account.feesPaid, realizedPnl: account.realizedPnl }));
}
export async function readDeskRecord(scope: DeskScope): Promise<DeskRecord> {
  let row = await prisma.backendPlatformEvent.findFirst({ where: { ...scope, eventKey: stateKey(scope), eventType: DESK_STATE_EVENT } });
  if (!row) {
    const now = new Date().toISOString();
    const state: DeskState = { version: 1, revision: 0,
      settings: { symbol: "MSFT", intervalMinutes: 15, initialCapital: 10_000, policy: structuredClone(DEFAULT_DESK_POLICY), scouting: structuredClone(DEFAULT_DESK_SCOUTING) },
      controls: { ...DEFAULT_DESK_CONTROLS }, account: createPaperAccount({ initialCapital: 10_000, now }),
      busy: null, scouting: emptyScoutingState(), latestCycleId: null, nextRunAt: null, lastCheckedAt: null, lastError: null, updatedAt: now };
    row = await prisma.backendPlatformEvent.upsert({ where: { userId_eventKey: { userId: scope.userId, eventKey: stateKey(scope) } }, update: {},
      create: { ...scope, eventKey: stateKey(scope), eventType: DESK_STATE_EVENT, area: "Intelligence", title: "Six-agent paper desk", status: "Paused", metadataJson: encodeDeskEnvelope(state) } });
  }
  if (row.userId !== scope.userId || row.firmId !== scope.firmId || row.eventType !== DESK_STATE_EVENT) throw new AgentDeskError("DESK_STORAGE_INVALID", "The desk owner does not match the active workspace.", 403);
  return { id: row.id, raw: row.metadataJson, state: validateState(decodeDeskEnvelope(row.metadataJson)) };
}
export async function replaceDeskRecord(scope: DeskScope, previous: DeskRecord, next: DeskState): Promise<DeskRecord> {
  validateState(next); const raw = encodeDeskEnvelope(next);
  const changed = await prisma.backendPlatformEvent.updateMany({
    where: { id: previous.id, ...scope, eventKey: stateKey(scope), eventType: DESK_STATE_EVENT, metadataJson: previous.raw },
    data: { metadataJson: raw, status: stateStatus(next) },
  });
  if (changed.count !== 1) throw new AgentDeskError("DESK_CONFLICT", "The desk changed while this request was running. Reload the latest settings and result.");
  return { id: previous.id, raw, state: next };
}
function decodeReceipt(raw: string, expectedId?: string): CycleReceipt {
  const value = decodeDeskEnvelope(raw);
  if (!object(value) || !object(value.cycle) || value.cycle.version !== 1 || value.cycle.mode !== "paper" || (expectedId && value.cycle.id !== expectedId) || typeof value.positionFingerprint !== "string") throw new AgentDeskError("DESK_STORAGE_INVALID", "The stored paper decision failed validation.", 503);
  return value as unknown as CycleReceipt;
}
export async function readDeskCycle(scope: DeskScope, id: string): Promise<CycleReceipt | null> {
  const row = await prisma.backendPlatformEvent.findFirst({ where: { ...scope, eventKey: cycleKey(scope, id), eventType: DESK_CYCLE_EVENT } });
  return row ? decodeReceipt(row.metadataJson, id) : null;
}
export async function readDeskHistory(scope: DeskScope): Promise<DeskCycle[]> {
  const rows = await prisma.backendPlatformEvent.findMany({ where: { ...scope, eventType: DESK_CYCLE_EVENT }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], take: 20, select: { metadataJson: true } });
  return rows.map(row => decodeReceipt(row.metadataJson).cycle);
}
/** The paper ledger change and its unique immutable receipt commit together.
 * A failed compare-and-set rolls back the receipt; a duplicate cannot fill again. */
export async function commitDeskCycle(scope: DeskScope, previous: DeskRecord, next: DeskState, receipt: CycleReceipt): Promise<void> {
  validateState(next);
  await prisma.$transaction(async transaction => {
    const changed = await transaction.backendPlatformEvent.updateMany({
      where: { id: previous.id, ...scope, eventKey: stateKey(scope), eventType: DESK_STATE_EVENT, metadataJson: previous.raw },
      data: { metadataJson: encodeDeskEnvelope(next), status: stateStatus(next) },
    });
    if (changed.count !== 1) throw new AgentDeskError("DESK_CONFLICT", "Newer desk controls or account state superseded this cycle. No order from it was committed.");
    await transaction.backendPlatformEvent.create({ data: { ...scope, eventKey: cycleKey(scope, receipt.cycle.id), eventType: DESK_CYCLE_EVENT,
      area: "Intelligence", title: `Paper desk · ${receipt.cycle.symbol}`, detail: receipt.cycle.decision?.message ?? receipt.cycle.errors[0] ?? "Saved six-agent research",
      status: receipt.cycle.executionStatus, severity: receipt.cycle.fill ? "Info" : "Warning", sourceType: "PaperSimulation", sourceId: receipt.cycle.id,
      metadataJson: encodeDeskEnvelope(receipt) } });
    await writeCycleArtifacts(transaction, scope, { cycle: receipt.cycle, beforeAccount: previous.state.account, afterAccount: next.account });
  });
}
export async function scheduledDeskScopes(limit: number): Promise<DeskScope[]> {
  const rows = await prisma.backendPlatformEvent.findMany({ where: { eventType: DESK_STATE_EVENT, status: { in: ["Autonomous", "Monitoring", "Scouting"] }, firmId: { not: null } },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: limit, select: { userId: true, firmId: true } });
  return rows.flatMap(row => row.firmId ? [{ userId: row.userId, firmId: row.firmId }] : []);
}
