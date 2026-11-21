import "server-only";
import type { DeskScope } from "@/lib/agent-desk/contracts";
import { requireAgentDeskAccess } from "@/lib/agent-desk/access";
import { readDeskCycle, readDeskRecord } from "@/lib/agent-desk/store";
import { AgentBrokerError, type BrokerOrder, type BrokerSubmission } from "./contracts";
import { AlpacaHttpError, type AlpacaClient, type AlpacaOrderInput } from "./alpaca";
import { assertBrokerSession, assertChiefReceipt, brokerPausedByDesk, brokerTradingDay, buildBrokerEntry } from "./guardrails";
import { brokerErrorMessage, clientForBroker, fetchBrokerSnapshot, liveBrokerEnabled, recordBrokerFailure, refreshBroker } from "./connection";
import { brokerHash, commitBrokerIntent, intentView, mutateBrokerRecord, readBrokerIntent, readBrokerRecord, reserveBrokerIntent, type BrokerIntent, type BrokerRecord, type BrokerState } from "./store";
import { observeBrokerFills } from "./observations";

const nowIso = () => new Date().toISOString();
const terminal = (order: BrokerOrder) => ["filled", "canceled", "expired", "rejected"].includes(order.status);
const flatten = (orders: BrokerOrder[]): BrokerOrder[] => orders.flatMap(order => [order, ...flatten(order.legs)]);
const result = (status: BrokerSubmission["status"], code: string, message: string, intent: BrokerIntent | null = null): BrokerSubmission => ({ status, code, message, intent: intent ? intentView(intent) : null });
function assertExecutionMode(state: BrokerState): void {
  if (!state.encryptedCredentials || !state.expectedAccountId) throw new AgentBrokerError("BROKER_NOT_CONNECTED", "Connect and verify an Alpaca account first.");
  if (state.mode === "live" && !liveBrokerEnabled()) throw new AgentBrokerError("BROKER_LIVE_DISABLED", "Live brokerage execution is disabled on the server. Existing broker-native orders remain at Alpaca.");
}
function assertOrderMatches(intent: BrokerIntent, order: BrokerOrder): void {
  if (order.clientOrderId !== intent.clientOrderId || order.symbol !== intent.symbol || order.side !== intent.side || order.quantity !== intent.quantity
    || (order.status === "filled" && order.filledQuantity !== order.quantity) || (order.filledQuantity > 0 && !(order.filledAveragePrice && order.filledAveragePrice > 0)))
    throw new AgentBrokerError("BROKER_ORDER_MISMATCH", "The broker's order does not match the reserved intent. Execution remains locked for manual review.", 502);
}
async function updateIntentOrder(scope: DeskScope, id: string, order: BrokerOrder | null, message?: string): Promise<BrokerIntent> {
  for (let attempt = 0; attempt < 4; attempt += 1) {
    await requireAgentDeskAccess(scope);
    const previous = await readBrokerRecord(scope), saved = await readBrokerIntent(scope, id);
    if (!saved) throw new AgentBrokerError("BROKER_INTENT_MISSING", "The durable order intent was not found. No retry is permitted.", 503);
    const intent = saved.intent;
    if (previous.state.expectedAccountId !== intent.accountId || previous.state.mode !== intent.mode) throw new AgentBrokerError("BROKER_ACCOUNT_CHANGED", "The pending intent belongs to a different brokerage account.");
    if (order) assertOrderMatches(intent, order);
    const completed = Boolean(order && terminal(order));
    const status = !order ? "uncertain" : order.status === "filled" ? "filled" : order.status === "rejected" ? "rejected" : completed ? "canceled" : "accepted";
    const nextIntent: BrokerIntent = { ...intent, order: order ?? intent.order, status, updatedAt: nowIso(), phase: completed ? "settled" : "submitting",
      message: message ?? (!order ? "Alpaca has not confirmed this reserved client order ID. The order will not be blindly retried. Review and reconcile in Alpaca."
        : completed ? `Broker order ${order.status}; ${order.filledQuantity} of ${order.quantity} shares observed filled.` : `Alpaca reports ${order.status}; ${order.filledQuantity} of ${order.quantity} shares observed filled.`) };
    const next = structuredClone(previous.state); next.updatedAt = nextIntent.updatedAt;
    if (previous.state.pendingIntentId === id) {
      if (!order) next.lastError = nextIntent.message;
      if (completed && order) {
        next.pendingIntentId = null;
        if (intent.side === "buy" && order.filledQuantity > 0) {
          const exitsFilled = order.legs.filter(leg => leg.side === "sell").reduce((total, leg) => total + leg.filledQuantity, 0);
          if (exitsFilled > order.filledQuantity) throw new AgentBrokerError("BROKER_EXPOSURE_MISMATCH", "Broker child fills exceed the owned entry. Manual account review is required.");
          const remaining = order.filledQuantity - exitsFilled;
          next.ownedPosition = remaining > 0 ? { symbol: intent.symbol, quantity: remaining, entryIntentId: id, entryOrderId: order.id,
            openedAt: order.filledAt ?? order.updatedAt ?? nowIso(), forceExitReason: order.status !== "filled" ? "The bracket entry did not fully fill; close the verified partial position." : null } : null;
        }
        if (intent.side === "sell" && next.ownedPosition?.entryIntentId === intent.entryIntentId) {
          const remaining = next.ownedPosition.quantity - order.filledQuantity;
          if (remaining < 0) throw new AgentBrokerError("BROKER_EXPOSURE_MISMATCH", "A closing fill exceeded the recorded owned position. Manual account review is required.");
          next.ownedPosition = remaining ? { ...next.ownedPosition, quantity: remaining, forceExitReason: "The closing order did not fully fill. Review and close remaining exposure in Alpaca." } : null;
          if (remaining) next.lastError = "A broker exit was not fully filled. Its unique order intent cannot be automatically replayed; review the remaining position in Alpaca.";
        }
        if (!next.ownedPosition?.forceExitReason) next.lastError = null;
      }
    }
    try {
      await commitBrokerIntent(scope, previous, saved, next, nextIntent);
      if (order) await observeBrokerFills(scope, nextIntent);
      return nextIntent;
    } catch (error) { if (!(error instanceof AgentBrokerError) || error.code !== "BROKER_CONFLICT" || attempt === 3) throw error; }
  }
  throw new AgentBrokerError("BROKER_CONFLICT", "Another worker is reconciling this order.");
}
async function cancelUnsentIntent(scope: DeskScope, id: string, message: string, rejected = false): Promise<void> {
  const previous = await readBrokerRecord(scope), saved = await readBrokerIntent(scope, id);
  if (!saved || previous.state.pendingIntentId !== id) return;
  const intent: BrokerIntent = { ...saved.intent, status: rejected ? "rejected" : "canceled", phase: "settled", updatedAt: nowIso(), message };
  await commitBrokerIntent(scope, previous, saved, { ...previous.state, pendingIntentId: null, updatedAt: intent.updatedAt, lastError: message }, intent);
}
/** This function is entered once by the worker that successfully reserved the intent.
 * A restart or retry can only look up its client_order_id, never send it again. */
async function sendReservedOrder(scope: DeskScope, id: string): Promise<BrokerSubmission> {
  await requireAgentDeskAccess(scope);
  const record = await readBrokerRecord(scope), saved = await readBrokerIntent(scope, id);
  if (!saved || record.state.pendingIntentId !== id) throw new AgentBrokerError("BROKER_RESERVATION_LOST", "The order reservation is no longer active.");
  const intent = saved.intent;
  try {
    assertExecutionMode(record.state);
    if (record.state.credentialRevision !== intent.credentialRevision || record.state.expectedAccountId !== intent.accountId) throw new AgentBrokerError("BROKER_CONNECTION_CHANGED", "The broker credentials changed before submission.");
    if (!record.state.snapshot) throw new AgentBrokerError("BROKER_ACCOUNT_UNVERIFIED", "A current broker account snapshot is required before submission.");
    assertBrokerSession(record.state.snapshot, Date.now(), intent.side === "buy" ? record.state.policy.flattenBeforeCloseMinutes : 0);
    if (intent.side === "buy") {
      const [desk, receipt] = await Promise.all([readDeskRecord(scope), intent.cycleId ? readDeskCycle(scope, intent.cycleId) : null]);
      if (desk.state.controls.killSwitch || !record.state.controls.enabled || record.state.controls.paused) throw new AgentBrokerError("BROKER_ENTRIES_PAUSED", "Broker entry was stopped before submission by a safety control.");
      if (brokerPausedByDesk(record.state, desk.state)) throw new AgentBrokerError("BROKER_DESK_PAUSED", "The durable global desk pause superseded this broker activation. No entry was submitted.");
      if (!receipt || desk.state.latestCycleId !== intent.cycleId || receipt.cycle.settingsRevision !== desk.state.revision || record.state.revision !== intent.brokerRevision)
        throw new AgentBrokerError("BROKER_DECISION_SUPERSEDED", "The approved research or safeguards changed after reservation. No broker order was sent.");
      assertChiefReceipt(receipt, record.state.policy);
      const quoteAge = Date.now() - Date.parse(intent.quoteObservedAt ?? "");
      if (!Number.isFinite(quoteAge) || quoteAge < -1000 || quoteAge > record.state.policy.maxQuoteAgeSeconds * 1000)
        throw new AgentBrokerError("BROKER_QUOTE_UNUSABLE", "The checked broker quote expired before submission. No order was sent; run a fresh review.");
    }
  } catch (error) {
    await cancelUnsentIntent(scope, id, brokerErrorMessage(error));
    return result("blocked", error instanceof AgentBrokerError ? error.code : "BROKER_STOPPED", brokerErrorMessage(error));
  }
  const client = clientForBroker(scope, record.state);
  try {
    const order = await client.submit(intent.request);
    const observed = await updateIntentOrder(scope, id, order);
    return result("accepted", "BROKER_ORDER_OBSERVED", observed.message, observed);
  } catch (error) {
    if (error instanceof AlpacaHttpError && [400, 401, 403].includes(error.providerStatus)) {
      // These are explicit broker denials, unlike a timeout or duplicate-ID 422.
      await cancelUnsentIntent(scope, id, brokerErrorMessage(error), true);
      return result("blocked", "BROKER_ORDER_REJECTED", brokerErrorMessage(error), (await readBrokerIntent(scope, id))?.intent ?? null);
    }
    // A timeout, malformed success, or duplicate-ID rejection can happen after acceptance.
    // Even a 404 lookup is not proof of no eventual order: retain the reservation, never retry POST.
    let found: BrokerOrder | null = null;
    try { await requireAgentDeskAccess(scope); found = await client.orderByClientId(intent.clientOrderId); } catch { /* Preserve uncertainty. */ }
    if (found) {
      const observed = await updateIntentOrder(scope, id, found);
      return result("accepted", "BROKER_ORDER_RECONCILED", observed.message, observed);
    }
    const uncertain = await updateIntentOrder(scope, id, null, brokerErrorMessage(error));
    return result("uncertain", "BROKER_ORDER_UNCERTAIN", uncertain.message, uncertain);
  }
}
function newIntent(record: BrokerRecord, request: AlpacaOrderInput, id: string, cycleId: string | null, entryIntentId: string | null): BrokerIntent {
  const timestamp = nowIso();
  return { id, cycleId, accountId: record.state.expectedAccountId!, credentialRevision: record.state.credentialRevision, brokerRevision: record.state.revision, quoteObservedAt: null, mode: record.state.mode,
    symbol: request.symbol, side: request.side, quantity: Number(request.qty), status: "reserved", phase: request.side === "sell" ? "canceling-protection" : "submitting",
    request, entryIntentId, clientOrderId: request.client_order_id, order: null, createdAt: timestamp, updatedAt: timestamp, message: "Reserved durably before any order submission." };
}
async function reserve(scope: DeskScope, record: BrokerRecord, intent: BrokerIntent): Promise<void> {
  if (record.state.pendingIntentId) throw new AgentBrokerError("BROKER_ORDER_PENDING", "A pending or uncertain order must reconcile before another order.");
  const next = { ...record.state, pendingIntentId: intent.id, recentIntentIds: [intent.id, ...record.state.recentIntentIds].slice(0, 60), updatedAt: intent.createdAt };
  if (intent.side === "buy") { const day = brokerTradingDay(Date.now()); next.tradingDay = day; next.entriesToday = record.state.tradingDay === day ? record.state.entriesToday + 1 : 1; }
  await requireAgentDeskAccess(scope); await reserveBrokerIntent(scope, record, next, intent);
}
export async function submitChiefBrokerProposal(scope: DeskScope, input: { cycleId: string; approved?: boolean }): Promise<BrokerSubmission> {
  await requireAgentDeskAccess(scope);
  try {
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(input.cycleId) || (input.approved !== undefined && typeof input.approved !== "boolean")) throw new AgentBrokerError("BROKER_PROPOSAL_INVALID", "Choose an immutable Chief decision from this workspace.", 400);
    let record = await readBrokerRecord(scope);
    if (!record.state.controls.enabled || record.state.controls.paused) return result("noop", "BROKER_DISABLED", "Broker execution is paused; research and the local simulation remain available.");
    if (!record.state.controls.autonomous && input.approved !== true) return result("pending", "BROKER_APPROVAL_REQUIRED", "This Chief decision needs the founder's explicit broker approval.");
    assertExecutionMode(record.state);
    const [receipt, desk] = await Promise.all([readDeskCycle(scope, input.cycleId), readDeskRecord(scope)]);
    if (!receipt || desk.state.latestCycleId !== input.cycleId || receipt.cycle.settingsRevision !== desk.state.revision)
      throw new AgentBrokerError("BROKER_DECISION_SUPERSEDED", "The Chief decision does not match the latest saved research and desk settings. Run a new cycle.");
    if (receipt.cycle.executionTarget !== `alpaca-${record.state.mode}` || receipt.cycle.brokerContextRevision !== record.state.revision)
      throw new AgentBrokerError("BROKER_CONTEXT_CHANGED", "This decision was not researched for the currently enabled broker account and safeguards. Run a new broker-targeted review.");
    if (desk.state.controls.killSwitch) throw new AgentBrokerError("BROKER_KILL_SWITCH", "The founder desk kill switch blocks new broker entries.");
    assertChiefReceipt(receipt, record.state.policy);
    if (receipt.cycle.proposal?.action === "hold") return result("noop", "CHIEF_HOLD", "The Chief chose to hold; no broker order was submitted.");
    if (receipt.cycle.proposal?.action === "buy" && brokerPausedByDesk(record.state, desk.state)) throw new AgentBrokerError("BROKER_DESK_PAUSED", "Global desk controls paused broker entries after the last activation. Review and explicitly enable again.");
    if (record.state.pendingIntentId) {
      const pending = await readBrokerIntent(scope, record.state.pendingIntentId);
      return result("pending", "BROKER_ORDER_PENDING", "An existing order must reconcile before another order can be submitted.", pending?.intent ?? null);
    }
    if (receipt.cycle.proposal?.action === "sell") return await requestOwnedExit(scope, `Chief exit decision ${input.cycleId}.`, input.cycleId, receipt.cycle.symbol);
    if (record.state.ownedPosition) return result("blocked", "BROKER_POSITION_OPEN", "The existing owned position must close before a new entry.");
    if (record.state.mode === "live" && record.state.policy.feed !== "sip") throw new AgentBrokerError("BROKER_SIP_REQUIRED", "Live entries require a verified consolidated SIP quote.");
    const generation = record.state.credentialRevision, revision = record.state.revision;
    const client = clientForBroker(scope, record.state);
    const [snapshot, quote, asset] = await Promise.all([fetchBrokerSnapshot(client, record.state.expectedAccountId), client.quote(receipt.cycle.symbol, record.state.policy.feed), client.asset(receipt.cycle.symbol)]);
    await requireAgentDeskAccess(scope);
    record = await readBrokerRecord(scope);
    if (record.state.credentialRevision !== generation || record.state.revision !== revision || !record.state.controls.enabled || record.state.controls.paused || record.state.pendingIntentId || record.state.ownedPosition)
      throw new AgentBrokerError("BROKER_CONFLICT", "Broker safeguards or exposure changed during order checks. No order was sent.");
    const id = brokerHash(JSON.stringify([scope.userId, scope.firmId, record.state.mode, snapshot.account.id, "buy", input.cycleId])).slice(0, 40);
    const existing = await readBrokerIntent(scope, id);
    if (existing) return result("noop", "BROKER_INTENT_ALREADY_USED", "This Chief decision already has a permanent broker intent and cannot submit another order.", existing.intent);
    const request = buildBrokerEntry({ receipt, policy: record.state.policy, snapshot, quote, asset, clientOrderId: `slice_${id}`, entriesToday: record.state.tradingDay === brokerTradingDay(Date.now()) ? record.state.entriesToday : 0 });
    // Keep the exact account truth used for the decision, within the same exposure reservation.
    record.state.snapshot = snapshot;
    const intent = newIntent(record, request, id, input.cycleId, null);
    intent.quoteObservedAt = quote.timestamp;
    await reserve(scope, record, intent);
    return await sendReservedOrder(scope, id);
  } catch (error) {
    if (!(error instanceof AgentBrokerError)) throw error;
    if (error.code !== "BROKER_CONFLICT") await recordBrokerFailure(scope, error);
    return result("blocked", error.code, error.message);
  }
}
async function requestOwnedExit(scope: DeskScope, reason: string, cycleId: string | null, symbol?: string): Promise<BrokerSubmission> {
  await requireAgentDeskAccess(scope);
  const record = await readBrokerRecord(scope); assertExecutionMode(record.state);
  const owned = record.state.ownedPosition;
  if (!owned || (symbol && symbol !== owned.symbol)) return result("noop", "BROKER_NO_OWNED_POSITION", "There is no verified agent-owned position for this exit. External positions are not managed.");
  if (record.state.pendingIntentId) return result("pending", "BROKER_ORDER_PENDING", "A pending order must reconcile before an exit is submitted.");
  const id = brokerHash(JSON.stringify([scope.userId, scope.firmId, record.state.mode, record.state.expectedAccountId, "exit", owned.entryIntentId])).slice(0, 40);
  const existing = await readBrokerIntent(scope, id);
  if (existing) return result("blocked", "BROKER_EXIT_REVIEW_REQUIRED", "This position already has an exit intent. Reconcile it or review remaining exposure directly in Alpaca; no duplicate closing order will be sent.", existing.intent);
  if (!Number.isSafeInteger(owned.quantity) || owned.quantity < 1) throw new AgentBrokerError("BROKER_EXPOSURE_MISMATCH", "The owned quantity is not a valid whole-share position. Review it in Alpaca.");
  const request: AlpacaOrderInput = { symbol: owned.symbol, qty: String(owned.quantity), side: "sell", type: "market", order_class: "simple", time_in_force: "day", extended_hours: false, position_intent: "sell_to_close", client_order_id: `slice_${id}` };
  const intent = newIntent(record, request, id, cycleId, owned.entryIntentId); intent.message = reason;
  await reserve(scope, record, intent);
  return continueOwnedExit(scope, id);
}
async function cancelKnownOrder(client: AlpacaClient, order: BrokerOrder): Promise<void> {
  if (terminal(order)) return;
  try { await client.cancel(order.id); }
  catch (error) { if (!(error instanceof AlpacaHttpError) || ![404, 422].includes(error.providerStatus)) throw error; }
}
async function continueOwnedExit(scope: DeskScope, id: string): Promise<BrokerSubmission> {
  await requireAgentDeskAccess(scope);
  const initial = await readBrokerRecord(scope), saved = await readBrokerIntent(scope, id);
  if (!saved || saved.intent.phase !== "canceling-protection" || initial.state.pendingIntentId !== id) return result("pending", "BROKER_EXIT_RECONCILING", "The existing closing intent is reconciling.", saved?.intent ?? null);
  assertExecutionMode(initial.state);
  const owned = initial.state.ownedPosition;
  if (!owned || owned.entryIntentId !== saved.intent.entryIntentId) throw new AgentBrokerError("BROKER_EXPOSURE_MISMATCH", "The closing intent no longer matches the owned position.");
  const client = clientForBroker(scope, initial.state);
  const parent = await client.order(owned.entryOrderId);
  const entry = await readBrokerIntent(scope, owned.entryIntentId);
  if (!entry) throw new AgentBrokerError("BROKER_INTENT_MISSING", "The owned entry receipt is missing.");
  assertOrderMatches(entry.intent, parent);
  const snapshot = await fetchBrokerSnapshot(client, initial.state.expectedAccountId);
  assertBrokerSession(snapshot);
  const position = snapshot.positions.find(row => row.symbol === owned.symbol);
  const actualOwnedRemaining = parent.filledQuantity - parent.legs.reduce((sum, leg) => sum + leg.filledQuantity, 0);
  if (!position && actualOwnedRemaining === 0) {
    await cancelUnsentIntent(scope, id, "The broker's protective exit already closed the owned position; no extra sale was sent.");
    await mutateBrokerRecord(scope, state => ({ ...state, ownedPosition: state.ownedPosition?.entryIntentId === owned.entryIntentId ? null : state.ownedPosition, snapshot, updatedAt: nowIso() }));
    await updateIntentOrder(scope, entry.intent.id, parent);
    return result("noop", "BROKER_ALREADY_CLOSED", "Native protection already closed this position.");
  }
  if (!position || position.side !== "long" || position.quantity !== owned.quantity || position.quantity !== actualOwnedRemaining || snapshot.positions.length !== 1)
    throw new AgentBrokerError("BROKER_EXPOSURE_MISMATCH", "The account position changed outside the verified entry and protection. No automatic sale was sent.");
  const knownIds = new Set(flatten([parent]).map(order => order.id));
  if (flatten(snapshot.orders).some(order => !knownIds.has(order.id))) throw new AgentBrokerError("BROKER_EXTERNAL_ORDER", "An unrelated broker order exists. Resolve it before the agent can close its position.");
  // Re-authorization precedes every external cancellation. Native protection is removed only for an owned exit.
  for (const leg of [parent, ...parent.legs].filter(order => !terminal(order))) {
    await requireAgentDeskAccess(scope); const current = await readBrokerRecord(scope);
    if (current.state.credentialRevision !== initial.state.credentialRevision || current.state.pendingIntentId !== id) throw new AgentBrokerError("BROKER_CONNECTION_CHANGED", "The connection changed during exit preparation.");
    await cancelKnownOrder(client, leg);
  }
  const confirmed = await fetchBrokerSnapshot(client, initial.state.expectedAccountId);
  assertBrokerSession(confirmed);
  const available = confirmed.positions.find(row => row.symbol === owned.symbol);
  if (confirmed.orders.length || !available || available.side !== "long" || available.quantity !== owned.quantity || available.availableQuantity !== owned.quantity)
    return result("pending", "BROKER_PROTECTION_CANCEL_PENDING", "Waiting for broker protection cancellation and a verified available long quantity before submitting the close.", saved.intent);
  await requireAgentDeskAccess(scope);
  const current = await readBrokerRecord(scope), intentRecord = await readBrokerIntent(scope, id);
  if (!intentRecord || intentRecord.intent.phase !== "canceling-protection" || current.state.pendingIntentId !== id || current.state.credentialRevision !== initial.state.credentialRevision)
    return result("pending", "BROKER_EXIT_RECONCILING", "Another worker is preparing the same closing intent.", intentRecord?.intent ?? null);
  // A process crash after this CAS is ambiguous, so later workers ONLY look up the client order ID.
  const submitting: BrokerIntent = { ...intentRecord.intent, phase: "submitting", credentialRevision: current.state.credentialRevision, updatedAt: nowIso() };
  await commitBrokerIntent(scope, current, intentRecord, { ...current.state, snapshot: confirmed, updatedAt: submitting.updatedAt }, submitting);
  return sendReservedOrder(scope, id);
}
async function reconcilePending(scope: DeskScope, state: BrokerState): Promise<BrokerSubmission> {
  const saved = await readBrokerIntent(scope, state.pendingIntentId!);
  if (!saved) throw new AgentBrokerError("BROKER_INTENT_MISSING", "The pending broker receipt is missing. No new trade can be submitted.");
  if (saved.intent.phase === "canceling-protection") return continueOwnedExit(scope, saved.intent.id);
  const client = clientForBroker(scope, state);
  const found = await client.orderByClientId(saved.intent.clientOrderId);
  await requireAgentDeskAccess(scope);
  const observed = await updateIntentOrder(scope, saved.intent.id, found);
  if (found && saved.intent.side === "buy" && !terminal(found)) {
    const stale = Date.now() - Date.parse(saved.intent.createdAt) > 30_000;
    if (found.filledQuantity > 0 || stale || state.controls.paused) {
      assertExecutionMode(state); await requireAgentDeskAccess(scope);
      const current = await readBrokerRecord(scope);
      if (current.state.credentialRevision !== state.credentialRevision) throw new AgentBrokerError("BROKER_CONNECTION_CHANGED", "The broker connection changed before entry cancellation.");
      await cancelKnownOrder(client, found);
      // Cancellation is asynchronous. Only terminal broker truth releases the exposure slot.
      const after = await client.order(found.id);
      const reconciled = await updateIntentOrder(scope, saved.intent.id, after);
      return result(terminal(after) ? "accepted" : "pending", "BROKER_ENTRY_CANCELING", reconciled.message, reconciled);
    }
  }
  return result(found ? terminal(found) ? "accepted" : "pending" : "uncertain", found ? "BROKER_RECONCILED" : "BROKER_ORDER_UNCERTAIN", observed.message, observed);
}
export async function runBrokerMonitoring(scope: DeskScope): Promise<BrokerSubmission> {
  await requireAgentDeskAccess(scope);
  try {
    let state = (await readBrokerRecord(scope)).state;
    if (!state.encryptedCredentials) return result("noop", "BROKER_DISCONNECTED", "No broker connection is active. Review any existing exposure directly in Alpaca.");
    state = await refreshBroker(scope);
    if (state.pendingIntentId) {
      const pending = await reconcilePending(scope, state);
      state = (await readBrokerRecord(scope)).state;
      if (state.pendingIntentId || !state.ownedPosition) return pending;
      state = await refreshBroker(scope);
    }
    if (!state.ownedPosition) return result("noop", "BROKER_MONITORED", "Broker account refreshed; no agent-owned exposure requires an exit.");
    const owned = state.ownedPosition, client = clientForBroker(scope, state);
    const entry = await readBrokerIntent(scope, owned.entryIntentId);
    if (!entry) throw new AgentBrokerError("BROKER_INTENT_MISSING", "The owned position has no verified entry receipt.");
    const parent = await client.order(owned.entryOrderId); assertOrderMatches(entry.intent, parent);
    const remaining = parent.filledQuantity - parent.legs.reduce((sum, leg) => sum + leg.filledQuantity, 0);
    const position = state.snapshot!.positions.find(row => row.symbol === owned.symbol);
    await updateIntentOrder(scope, entry.intent.id, parent);
    if (!position && remaining === 0) {
      await requireAgentDeskAccess(scope);
      await mutateBrokerRecord(scope, current => ({ ...current, ownedPosition: current.ownedPosition?.entryIntentId === owned.entryIntentId ? null : current.ownedPosition, updatedAt: nowIso(), lastError: null }));
      return result("accepted", "BROKER_PROTECTION_FILLED", "The broker's native exit filled and the owned position is closed. Observed fills are recorded separately from the local simulation.");
    }
    if (!position || position.side !== "long" || position.quantity !== remaining || state.snapshot!.positions.length !== 1 || remaining <= 0)
      throw new AgentBrokerError("BROKER_EXPOSURE_MISMATCH", "The actual position no longer matches the agent's verified fills. Automatic management is stopped; review Alpaca.");
    if (remaining !== owned.quantity) {
      await mutateBrokerRecord(scope, current => ({ ...current, ownedPosition: current.ownedPosition?.entryIntentId === owned.entryIntentId ? { ...current.ownedPosition, quantity: remaining } : current.ownedPosition, updatedAt: nowIso() }));
    }
    const openProtection = parent.legs.filter(leg => leg.side === "sell" && !terminal(leg));
    const heldMinutes = (Date.now() - Date.parse(owned.openedAt)) / 60_000;
    const closeMinutes = (Date.parse(state.snapshot!.clock.nextClose) - Date.now()) / 60_000;
    const reason = owned.forceExitReason ?? (openProtection.length < 2 ? "One or more native protective legs are missing or terminal." : heldMinutes >= state.policy.maxHoldingMinutes ? "The maximum holding time was reached." : state.snapshot!.clock.isOpen && closeMinutes <= state.policy.flattenBeforeCloseMinutes ? "The pre-close exit buffer was reached." : null);
    if (reason) {
      if (!state.snapshot!.clock.isOpen) return result("blocked", "BROKER_EXIT_SESSION_CLOSED", "An owned exit is due, but the regular broker session is closed. Review exposure in Alpaca; no next-day market order was queued.");
      return await requestOwnedExit(scope, reason, null);
    }
    return result("noop", "BROKER_POSITION_MONITORED", "Owned exposure and native protective orders match the broker's latest account state.");
  } catch (error) {
    if (!(error instanceof AgentBrokerError)) throw error;
    if (error.code !== "BROKER_CONFLICT") await recordBrokerFailure(scope, error);
    return result("blocked", error.code, error.message);
  }
}
