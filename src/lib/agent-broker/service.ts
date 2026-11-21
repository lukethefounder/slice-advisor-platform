import "server-only";
import type { DeskScope } from "@/lib/agent-desk/contracts";
import { requireAgentDeskAccess } from "@/lib/agent-desk/access";
import { readDeskRecord } from "@/lib/agent-desk/store";
import { AlpacaClient } from "./alpaca";
import { AgentBrokerError, type BrokerCommand, type BrokerSubmission, type BrokerView } from "./contracts";
import { brokerEncryptionConfigured, decryptBrokerCredentials, encryptBrokerCredentials, validateBrokerCredentials } from "./crypto";
import { accountEntryReasons, clientForBroker, fetchBrokerSnapshot, liveBrokerEnabled, refreshBroker } from "./connection";
import { intentView, listBrokerScopes, mutateBrokerRecord, readBrokerIntent, readBrokerRecord, replaceBrokerRecord } from "./store";
import { object, validRevision, validateBrokerPolicy } from "./validation";
import { runBrokerMonitoring, submitChiefBrokerProposal } from "./execution";
import { readBrokerFillObservations } from "./observations";
import { brokerPausedByDesk } from "./guardrails";
export { refreshBroker, runBrokerMonitoring, submitChiefBrokerProposal };
export { readBrokerFillObservations };

const LIMITATIONS = [
  "Broker paper fills and live fills are separate from Slice's local paper simulation. An accepted order is not a completed trade.",
  "The free IEX feed covers one exchange. Live orders require SIP entitlement; quotes and internet access are never guaranteed instantaneous.",
  "Only long, whole-share US equity/ETF positions are supported, one agent-owned position at a time, without borrowing or short sales.",
  "Native bracket stop and target orders activate after the entry is fully filled. Partial entries trigger cancellation and monitored closure; stop execution prices are not guaranteed.",
  "The worker must remain online for reconciliation, partial-fill handling, time exits and close-of-session exits. Native accepted protection remains at Alpaca when Slice is offline.",
  "Pause prevents new entries while monitoring owned exposure continues. Disconnect removes credentials; it does not close positions or cancel brokerage orders. Review exposure directly in Alpaca.",
  "External positions and orders are never automatically managed. Broker restrictions, account eligibility, market-data subscriptions and applicable fees still apply.",
];
export async function getBrokerView(scope: DeskScope): Promise<BrokerView> {
  await requireAgentDeskAccess(scope);
  const [{ state }, desk] = await Promise.all([readBrokerRecord(scope), readDeskRecord(scope)]);
  const globallyPaused = brokerPausedByDesk(state, desk.state);
  const ids = [...new Set([...(state.pendingIntentId ? [state.pendingIntentId] : []), ...state.recentIntentIds.slice(0, 12)])];
  const receipts = await Promise.all(ids.map(id => readBrokerIntent(scope, id)));
  const recentIntents = receipts.flatMap(row => row ? [intentView(row.intent)] : []);
  const reasons = accountEntryReasons(state);
  if (!brokerEncryptionConfigured()) reasons.unshift("Configure the dedicated server encryption key before storing broker credentials.");
  return { version: 1, provider: "alpaca", revision: state.revision, mode: state.mode, encryptionConfigured: brokerEncryptionConfigured(), liveServerEnabled: liveBrokerEnabled(),
    connected: Boolean(state.encryptedCredentials), credentialsHint: state.credentialsHint, connectedAt: state.connectedAt, lastCheckedAt: state.snapshot?.checkedAt ?? null,
    controls: globallyPaused ? { enabled: false, autonomous: false, paused: true } : state.controls, policy: state.policy, account: state.snapshot?.account ?? null, positions: state.snapshot?.positions ?? [], orders: state.snapshot?.orders ?? [], clock: state.snapshot?.clock ?? null,
    activePositionSymbol: state.ownedPosition?.symbol ?? null, pendingIntent: recentIntents.find(intent => intent.id === state.pendingIntentId) ?? null,
    recentIntents, recentFills: await readBrokerFillObservations(scope, 12), lastError: state.lastError ?? (globallyPaused ? "Global desk controls paused broker entries. Review and explicitly enable brokerage execution again." : null), updatedAt: state.updatedAt, readiness: { canEnable: reasons.length === 0 && !desk.state.controls.killSwitch, reasons: desk.state.controls.killSwitch ? [...reasons, "The founder desk kill switch is active."] : reasons, liveRequiresSip: true }, limitations: LIMITATIONS };
}
/** Server worker only. Never return this object to a browser, board, prompt, or audit log. */
export async function getFounderMarketCredentials(scope: DeskScope): Promise<null | { mode: "paper" | "live"; key: string; secret: string; feed: "iex" | "sip"; revision: number; accountId: string; allowedSymbols: string[]; activePositionSymbol: string | null }> {
  await requireAgentDeskAccess(scope); const { state } = await readBrokerRecord(scope);
  if (!state.encryptedCredentials || !state.expectedAccountId) return null;
  const credentials = decryptBrokerCredentials(scope, state.mode, state.encryptedCredentials);
  return { mode: state.mode, ...credentials, feed: state.policy.feed, revision: state.credentialRevision, accountId: state.expectedAccountId,
    allowedSymbols: [...state.policy.allowedSymbols], activePositionSymbol: state.ownedPosition?.symbol ?? null };
}
export async function getBrokerResearchObservation(scope: DeskScope, symbol: string): Promise<null | { symbol: string; bid: number; ask: number; observedAt: string; receivedAt: string; feed: "iex" | "sip"; marketOpen: boolean; currency: "USD"; exchange: "US" }> {
  await requireAgentDeskAccess(scope); const { state } = await readBrokerRecord(scope);
  if (!state.encryptedCredentials) return null;
  const client = clientForBroker(scope, state);
  const [quote, clock] = await Promise.all([client.quote(symbol, state.policy.feed), client.clock()]);
  const now = Date.now(), age = now - Date.parse(quote.timestamp), clockAge = now - Date.parse(clock.timestamp);
  if (age < -1000 || age > state.policy.maxQuoteAgeSeconds * 1000 || clockAge < -2000 || clockAge > 15_000 || quote.bid <= 0 || quote.ask < quote.bid) return null;
  await requireAgentDeskAccess(scope);
  const current = await readBrokerRecord(scope);
  if (!current.state.encryptedCredentials || current.state.credentialRevision !== state.credentialRevision) return null;
  return { symbol: quote.symbol, bid: quote.bid, ask: quote.ask, observedAt: quote.timestamp, receivedAt: new Date(now).toISOString(), feed: quote.feed, marketOpen: clock.isOpen, currency: "USD", exchange: "US" };
}
/** A deliberately small prompt-safe context, without API credentials or raw account identifiers. */
export async function getAgentBrokerContext(scope: DeskScope) {
  const view = await getBrokerView(scope);
  return { provider: view.provider, mode: view.mode, revision: view.revision, connected: view.connected, controls: view.controls, safeguards: view.policy,
    account: view.account ? { cash: view.account.cash, equity: view.account.equity, buyingPower: view.account.nonMarginableBuyingPower, status: view.account.status } : null,
    positions: view.positions, activePositionSymbol: view.activePositionSymbol, pendingOrder: view.pendingIntent ? { symbol: view.pendingIntent.symbol, side: view.pendingIntent.side, quantity: view.pendingIntent.quantity, status: view.pendingIntent.status } : null,
    recentFills: view.recentFills.slice(0, 10),
    learningLimitations: "Broker fill observations are cumulative per order and separated by paper/live classification. Fees and net P&L are unavailable; do not add partial snapshots, treat them as calibrated win probabilities, or claim that model weights have trained on them.",
    observedAt: view.lastCheckedAt, readiness: view.readiness, limitations: view.limitations };
}
export const listConnectedBrokerScopes = (limit = 100) => listBrokerScopes(limit, true);
export const scheduledBrokerScopes = (limit = 100) => listBrokerScopes(limit, false);
export async function pauseBrokerExecution(scope: DeskScope, reason = "New broker entries were paused by the founder."): Promise<void> {
  await requireAgentDeskAccess(scope);
  await mutateBrokerRecord(scope, state => ({ ...state, revision: state.revision + 1, controls: { enabled: false, autonomous: false, paused: true }, lastError: reason.slice(0, 400), updatedAt: new Date().toISOString() }));
}
const commandKeys: Record<BrokerCommand["action"], string[]> = {
  connect: ["action", "revision", "mode", "apiKey", "apiSecret"], settings: ["action", "revision", "policy"],
  "enable-paper": ["action", "revision", "autonomous", "acknowledgement"], "enable-live": ["action", "revision", "autonomous", "acknowledgement"],
  refresh: ["action", "revision"], reconcile: ["action", "revision"], pause: ["action", "revision"], disconnect: ["action", "revision"], approve: ["action", "revision", "cycleId"],
};
export async function applyBrokerCommand(scope: DeskScope, body: unknown): Promise<BrokerSubmission | null> {
  await requireAgentDeskAccess(scope);
  if (!object(body) || typeof body.action !== "string" || !Object.hasOwn(commandKeys, body.action)) throw new AgentBrokerError("INVALID_BROKER_COMMAND", "Choose a supported broker action.", 400);
  const action = body.action as BrokerCommand["action"];
  if (Object.keys(body).some(key => !commandKeys[action].includes(key))) throw new AgentBrokerError("INVALID_BROKER_COMMAND", "Supply only the fields for this broker action. Order overrides are not accepted.", 400);
  const revision = validRevision(body.revision);
  if (action === "pause") { await pauseBrokerExecution(scope); return null; }
  if (action === "refresh") { await refreshBroker(scope); return null; }
  if (action === "reconcile") return runBrokerMonitoring(scope);
  let record = await readBrokerRecord(scope);
  if (record.state.revision !== revision) throw new AgentBrokerError("BROKER_CONFLICT", "The broker settings changed. Reload the latest revision before continuing.");
  if (action === "connect") {
    if (body.mode !== "paper" && body.mode !== "live") throw new AgentBrokerError("INVALID_BROKER_MODE", "Select paper or live explicitly.", 400);
    const credentials = validateBrokerCredentials(body.apiKey, body.apiSecret);
    const encryptedCredentials = encryptBrokerCredentials(scope, body.mode, credentials);
    const outstanding = Boolean(record.state.pendingIntentId || record.state.ownedPosition);
    if (outstanding && body.mode !== record.state.mode) throw new AgentBrokerError("BROKER_EXPOSURE_PENDING", "Reconcile the existing account's exposure before changing broker environments.");
    const snapshot = await fetchBrokerSnapshot(new AlpacaClient(body.mode, credentials), outstanding ? record.state.expectedAccountId : null);
    await requireAgentDeskAccess(scope);
    await replaceBrokerRecord(scope, record, { ...record.state, revision: revision + 1, credentialRevision: record.state.credentialRevision + 1,
      mode: body.mode, encryptedCredentials, credentialsHint: `••••${credentials.key.slice(-4)}`, connectedAt: snapshot.checkedAt, expectedAccountId: snapshot.account.id,
      controls: { enabled: false, autonomous: false, paused: true }, snapshot, lastError: null, updatedAt: snapshot.checkedAt });
    return null;
  }
  if (action === "disconnect") {
    await replaceBrokerRecord(scope, record, { ...record.state, revision: revision + 1, credentialRevision: record.state.credentialRevision + 1, encryptedCredentials: null, credentialsHint: null,
      controls: { enabled: false, autonomous: false, paused: true }, lastError: record.state.pendingIntentId || record.state.ownedPosition ? "Disconnected with recorded exposure. Review all open orders and positions directly in Alpaca; reconnect the same account to resume reconciliation." : null, updatedAt: new Date().toISOString() });
    return null;
  }
  if (action === "settings") {
    if (record.state.pendingIntentId) throw new AgentBrokerError("BROKER_ORDER_PENDING", "Reconcile the pending broker order before changing safeguards.");
    const policy = validateBrokerPolicy(body.policy);
    await replaceBrokerRecord(scope, record, { ...record.state, revision: revision + 1, credentialRevision: record.state.credentialRevision + (policy.feed !== record.state.policy.feed ? 1 : 0),
      policy, controls: { enabled: false, autonomous: false, paused: true }, lastError: null, updatedAt: new Date().toISOString() });
    return null;
  }
  if (action === "approve") {
    if (typeof body.cycleId !== "string" || !/^[A-Za-z0-9_-]{1,128}$/.test(body.cycleId)) throw new AgentBrokerError("INVALID_CYCLE", "Choose a saved Chief decision from this founder workspace.", 400);
    return submitChiefBrokerProposal(scope, { cycleId: body.cycleId, approved: true });
  }
  if (typeof body.autonomous !== "boolean" || body.acknowledgement !== (action === "enable-live" ? "ENABLE LIVE TRADING" : "ENABLE PAPER TRADING") || record.state.mode !== (action === "enable-live" ? "live" : "paper"))
    throw new AgentBrokerError("BROKER_ACKNOWLEDGEMENT_REQUIRED", "Explicitly confirm the selected broker environment and execution mode before enabling orders.", 400);
  const desk = await readDeskRecord(scope);
  if (desk.state.controls.killSwitch) throw new AgentBrokerError("BROKER_KILL_SWITCH", "The founder desk kill switch is active. Review it before enabling broker execution.");
  await refreshBroker(scope); record = await readBrokerRecord(scope);
  if (record.state.revision !== revision) throw new AgentBrokerError("BROKER_CONFLICT", "The broker controls changed during verification.");
  const reasons = accountEntryReasons(record.state); if (reasons.length) throw new AgentBrokerError("BROKER_NOT_READY", reasons.join(" "));
  // Probe the selected entitlement; activation does not assume a subscription from a user's checkbox.
  await clientForBroker(scope, record.state).quote(record.state.policy.allowedSymbols[0], record.state.policy.feed);
  await requireAgentDeskAccess(scope);
  const latestDesk = await readDeskRecord(scope);
  if (latestDesk.state.revision !== desk.state.revision || latestDesk.state.controls.killSwitch)
    throw new AgentBrokerError("BROKER_ACTIVATION_SUPERSEDED", "Global desk controls changed during broker activation. Review the latest controls and explicitly enable again.");
  await replaceBrokerRecord(scope, record, { ...record.state, revision: revision + 1, deskRevisionAtEnable: latestDesk.state.revision, controls: { enabled: true, autonomous: body.autonomous, paused: false }, lastError: null, updatedAt: new Date().toISOString() });
  return null;
}
