import "server-only";
import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { DeskScope } from "@/lib/agent-desk/contracts";
import { AgentBrokerError, DEFAULT_BROKER_POLICY, type BrokerAccount, type BrokerClock, type BrokerIntentView, type BrokerMode, type BrokerOrder, type BrokerPolicy, type BrokerPosition } from "./contracts";
import type { AlpacaOrderInput } from "./alpaca";
import { object, validateBrokerPolicy } from "./validation";

export const BROKER_STATE_EVENT = "SLICE_AGENT_DESK_BROKER_STATE_V1";
export const BROKER_INTENT_EVENT = "SLICE_AGENT_DESK_BROKER_INTENT_V1";
export type BrokerSnapshot = { account: BrokerAccount; positions: BrokerPosition[]; orders: BrokerOrder[]; clock: BrokerClock; checkedAt: string };
export type OwnedBrokerPosition = { symbol: string; quantity: number; entryIntentId: string; entryOrderId: string; openedAt: string; forceExitReason: string | null };
export type BrokerState = {
  version: 1; revision: number; credentialRevision: number; mode: BrokerMode;
  deskRevisionAtEnable?: number;
  encryptedCredentials: string | null; credentialsHint: string | null; expectedAccountId: string | null; connectedAt: string | null;
  controls: { enabled: boolean; autonomous: boolean; paused: boolean }; policy: BrokerPolicy;
  snapshot: BrokerSnapshot | null; lastError: string | null; updatedAt: string;
  pendingIntentId: string | null; ownedPosition: OwnedBrokerPosition | null;
  recentIntentIds: string[]; tradingDay: string | null; entriesToday: number;
};
export type BrokerRecord = { id: string; raw: string; state: BrokerState };
export type BrokerIntent = BrokerIntentView & {
  accountId: string; credentialRevision: number; brokerRevision: number; quoteObservedAt: string | null; request: AlpacaOrderInput;
  phase: "submitting" | "canceling-protection" | "settled";
  entryIntentId: string | null;
};
export type IntentRecord = { id: string; raw: string; intent: BrokerIntent };
export const brokerHash = (value: string) => createHash("sha256").update(value).digest("hex");
const key = (scope: DeskScope) => `agent-broker-state:${scope.firmId}`;
const intentKey = (scope: DeskScope, id: string) => `agent-broker-intent:${scope.firmId}:${id}`;
export function encodeBrokerEnvelope(scope: DeskScope, kind: string, value: unknown): string {
  const payload = JSON.stringify({ owner: scope.userId, firm: scope.firmId, kind, value });
  return JSON.stringify({ version: 1, checksum: brokerHash(payload), payload });
}
export function decodeBrokerEnvelope(scope: DeskScope, kind: string, raw: string): unknown {
  try {
    const envelope: unknown = JSON.parse(raw);
    if (!object(envelope) || envelope.version !== 1 || typeof envelope.payload !== "string" || envelope.checksum !== brokerHash(envelope.payload)) throw new Error("integrity");
    const data: unknown = JSON.parse(envelope.payload);
    if (!object(data) || data.owner !== scope.userId || data.firm !== scope.firmId || data.kind !== kind) throw new Error("owner");
    return data.value;
  } catch { throw new AgentBrokerError("BROKER_STORAGE_INVALID", "The private broker record failed its owner or integrity check. Trading is blocked.", 503); }
}
export function validateBrokerState(value: unknown): BrokerState {
  if (!object(value) || value.version !== 1 || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || !Number.isSafeInteger(value.credentialRevision)
    || (value.deskRevisionAtEnable !== undefined && (!Number.isSafeInteger(value.deskRevisionAtEnable) || Number(value.deskRevisionAtEnable) < 0))
    || !["paper", "live"].includes(String(value.mode)) || !object(value.controls) || [value.controls.enabled, value.controls.autonomous, value.controls.paused].some(flag => typeof flag !== "boolean")
    || !(value.encryptedCredentials === null || typeof value.encryptedCredentials === "string") || !Array.isArray(value.recentIntentIds) || value.recentIntentIds.length > 60
    || !Number.isSafeInteger(value.entriesToday) || Number(value.entriesToday) < 0 || typeof value.updatedAt !== "string" || !Number.isFinite(Date.parse(value.updatedAt)))
    throw new AgentBrokerError("BROKER_STORAGE_INVALID", "The stored broker controls are invalid. Trading is blocked.", 503);
  validateBrokerPolicy(value.policy);
  return value as unknown as BrokerState;
}
const status = (state: BrokerState) => state.encryptedCredentials ? state.pendingIntentId || state.ownedPosition ? "Monitoring" : state.controls.enabled ? "Enabled" : "Connected" : state.pendingIntentId || state.ownedPosition ? "DisconnectedExposure" : "Disconnected";
export async function readBrokerRecord(scope: DeskScope): Promise<BrokerRecord> {
  let row = await prisma.backendPlatformEvent.findFirst({ where: { ...scope, eventKey: key(scope), eventType: BROKER_STATE_EVENT } });
  if (!row) {
    const state: BrokerState = { version: 1, revision: 0, credentialRevision: 0, mode: "paper", encryptedCredentials: null, credentialsHint: null,
      expectedAccountId: null, connectedAt: null, controls: { enabled: false, autonomous: false, paused: true }, policy: structuredClone(DEFAULT_BROKER_POLICY),
      snapshot: null, lastError: null, updatedAt: new Date().toISOString(), pendingIntentId: null, ownedPosition: null, recentIntentIds: [], tradingDay: null, entriesToday: 0 };
    row = await prisma.backendPlatformEvent.upsert({ where: { userId_eventKey: { userId: scope.userId, eventKey: key(scope) } }, update: {},
      create: { ...scope, eventKey: key(scope), eventType: BROKER_STATE_EVENT, area: "Intelligence", title: "Private founder brokerage", status: status(state), metadataJson: encodeBrokerEnvelope(scope, "state", state) } });
  }
  if (row.userId !== scope.userId || row.firmId !== scope.firmId) throw new AgentBrokerError("BROKER_OWNER_MISMATCH", "The broker connection does not belong to this founder workspace.", 403);
  return { id: row.id, raw: row.metadataJson, state: validateBrokerState(decodeBrokerEnvelope(scope, "state", row.metadataJson)) };
}
export async function replaceBrokerRecord(scope: DeskScope, previous: BrokerRecord, next: BrokerState): Promise<BrokerRecord> {
  validateBrokerState(next); const raw = encodeBrokerEnvelope(scope, "state", next);
  const changed = await prisma.backendPlatformEvent.updateMany({ where: { id: previous.id, ...scope, eventKey: key(scope), eventType: BROKER_STATE_EVENT, metadataJson: previous.raw }, data: { metadataJson: raw, status: status(next) } });
  if (changed.count !== 1) throw new AgentBrokerError("BROKER_CONFLICT", "Broker state changed during this request. Refresh before continuing.");
  return { id: previous.id, raw, state: next };
}
export async function mutateBrokerRecord(scope: DeskScope, update: (state: BrokerState) => BrokerState): Promise<BrokerRecord> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    const previous = await readBrokerRecord(scope); const next = update(structuredClone(previous.state));
    try { return await replaceBrokerRecord(scope, previous, next); }
    catch (error) { if (!(error instanceof AgentBrokerError) || error.code !== "BROKER_CONFLICT" || attempt === 3) throw error; }
  }
  throw new AgentBrokerError("BROKER_CONFLICT", "Broker state changed during this request.");
}
export async function readBrokerIntent(scope: DeskScope, id: string): Promise<IntentRecord | null> {
  const row = await prisma.backendPlatformEvent.findFirst({ where: { ...scope, eventKey: intentKey(scope, id), eventType: BROKER_INTENT_EVENT } });
  if (!row) return null;
  const value = decodeBrokerEnvelope(scope, "intent", row.metadataJson);
  if (!object(value) || value.id !== id || !object(value.request) || !Number.isSafeInteger(value.brokerRevision) || typeof value.clientOrderId !== "string" || value.request.client_order_id !== value.clientOrderId)
    throw new AgentBrokerError("BROKER_STORAGE_INVALID", "The saved order intent is invalid. No order will be retried.", 503);
  return { id: row.id, raw: row.metadataJson, intent: value as unknown as BrokerIntent };
}
/** One CAS transaction reserves both the exposure slot and a unique, permanent intent BEFORE any order HTTP call. */
export async function reserveBrokerIntent(scope: DeskScope, previous: BrokerRecord, next: BrokerState, intent: BrokerIntent): Promise<void> {
  validateBrokerState(next);
  await prisma.$transaction(async transaction => {
    const changed = await transaction.backendPlatformEvent.updateMany({ where: { id: previous.id, ...scope, eventKey: key(scope), eventType: BROKER_STATE_EVENT, metadataJson: previous.raw },
      data: { metadataJson: encodeBrokerEnvelope(scope, "state", next), status: status(next) } });
    if (changed.count !== 1) throw new AgentBrokerError("BROKER_CONFLICT", "Another request or safety control superseded this order. No new order was sent.");
    await transaction.backendPlatformEvent.create({ data: { ...scope, eventKey: intentKey(scope, intent.id), eventType: BROKER_INTENT_EVENT,
      area: "Intelligence", title: "Private broker order intent", status: intent.status, sourceType: "FounderBroker", sourceId: intent.id, metadataJson: encodeBrokerEnvelope(scope, "intent", intent) } });
  });
}
/** Atomically reconcile order truth and the matching owned-exposure slot. */
export async function commitBrokerIntent(scope: DeskScope, previous: BrokerRecord, previousIntent: IntentRecord, next: BrokerState, intent: BrokerIntent): Promise<void> {
  validateBrokerState(next);
  await prisma.$transaction(async transaction => {
    const state = await transaction.backendPlatformEvent.updateMany({ where: { id: previous.id, ...scope, eventKey: key(scope), eventType: BROKER_STATE_EVENT, metadataJson: previous.raw }, data: { metadataJson: encodeBrokerEnvelope(scope, "state", next), status: status(next) } });
    if (state.count !== 1) throw new AgentBrokerError("BROKER_CONFLICT", "Broker state changed while the order was being reconciled.");
    const receipt = await transaction.backendPlatformEvent.updateMany({ where: { id: previousIntent.id, ...scope, eventKey: intentKey(scope, intent.id), eventType: BROKER_INTENT_EVENT, metadataJson: previousIntent.raw }, data: { metadataJson: encodeBrokerEnvelope(scope, "intent", intent), status: intent.status } });
    if (receipt.count !== 1) throw new AgentBrokerError("BROKER_CONFLICT", "The order was already reconciled by another worker.");
  });
}
export function intentView(intent: BrokerIntent): BrokerIntentView {
  return { id: intent.id, cycleId: intent.cycleId, mode: intent.mode, symbol: intent.symbol, side: intent.side, quantity: intent.quantity, status: intent.status,
    createdAt: intent.createdAt, updatedAt: intent.updatedAt, clientOrderId: intent.clientOrderId, order: intent.order, message: intent.message };
}
export async function listBrokerScopes(limit: number, connectedOnly: boolean): Promise<DeskScope[]> {
  const bounded = Math.max(1, Math.min(500, Math.floor(limit)));
  const rows = await prisma.backendPlatformEvent.findMany({ where: { eventType: BROKER_STATE_EVENT, status: { in: connectedOnly ? ["Connected", "Enabled", "Monitoring"] : ["Enabled", "Monitoring"] }, firmId: { not: null } },
    orderBy: [{ updatedAt: "asc" }, { id: "asc" }], take: bounded, select: { userId: true, firmId: true } });
  return rows.flatMap(row => row.firmId ? [{ userId: row.userId, firmId: row.firmId }] : []);
}
