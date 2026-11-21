import "server-only";
import type { DeskScope } from "@/lib/agent-desk/contracts";
import { requireAgentDeskAccess } from "@/lib/agent-desk/access";
import { AlpacaClient } from "./alpaca";
import { decryptBrokerCredentials } from "./crypto";
import { AgentBrokerError } from "./contracts";
import { mutateBrokerRecord, readBrokerRecord, type BrokerSnapshot, type BrokerState } from "./store";

export const liveBrokerEnabled = () => process.env.SLICE_BROKER_LIVE_ENABLED === "true";
export function clientForBroker(scope: DeskScope, state: BrokerState): AlpacaClient {
  if (!state.encryptedCredentials) throw new AgentBrokerError("BROKER_NOT_CONNECTED", "Connect your founder Alpaca API credentials first.", 409);
  return new AlpacaClient(state.mode, decryptBrokerCredentials(scope, state.mode, state.encryptedCredentials));
}
export async function fetchBrokerSnapshot(client: AlpacaClient, expectedAccountId: string | null): Promise<BrokerSnapshot> {
  const [account, positions, orders, clock] = await Promise.all([client.account(), client.positions(), client.openOrders(), client.clock()]);
  if (expectedAccountId && expectedAccountId !== account.id) throw new AgentBrokerError("BROKER_ACCOUNT_CHANGED", "These credentials now identify a different broker account. Trading is blocked; reconnect only after resolving the previous account's exposure.", 409);
  return { account, positions, orders, clock, checkedAt: new Date().toISOString() };
}
export function brokerErrorMessage(error: unknown): string {
  return error instanceof AgentBrokerError ? error.message : "The broker operation could not be confirmed. Review its recorded status before continuing.";
}
export async function recordBrokerFailure(scope: DeskScope, error: unknown): Promise<void> {
  await mutateBrokerRecord(scope, state => ({ ...state, lastError: brokerErrorMessage(error), updatedAt: new Date().toISOString() }));
}
export async function refreshBroker(scope: DeskScope): Promise<BrokerState> {
  await requireAgentDeskAccess(scope); const previous = await readBrokerRecord(scope);
  const client = clientForBroker(scope, previous.state);
  try {
    const snapshot = await fetchBrokerSnapshot(client, previous.state.expectedAccountId);
    await requireAgentDeskAccess(scope);
    const result = await mutateBrokerRecord(scope, state => {
      if (!state.encryptedCredentials || state.credentialRevision !== previous.state.credentialRevision) throw new AgentBrokerError("BROKER_CONNECTION_CHANGED", "The broker connection changed during refresh. Reload the latest connection.");
      return { ...state, snapshot, lastError: null, updatedAt: snapshot.checkedAt };
    });
    return result.state;
  } catch (error) { await recordBrokerFailure(scope, error); throw error; }
}
export function accountEntryReasons(state: BrokerState): string[] {
  const snapshot = state.snapshot; const reasons: string[] = [];
  if (!state.encryptedCredentials) reasons.push("Connect API credentials for the selected paper or live account.");
  if (!snapshot) reasons.push("Refresh the connected account before enabling execution.");
  if (snapshot) {
    const account = snapshot.account;
    if (Date.now() - Date.parse(snapshot.checkedAt) > 120_000) reasons.push("Refresh the account; its saved snapshot is more than two minutes old.");
    if (account.id !== state.expectedAccountId || account.status !== "ACTIVE" || account.currency !== "USD") reasons.push("Execution requires the verified, active USD Alpaca account.");
    if (account.accountBlocked || account.tradingBlocked || account.tradeSuspended) reasons.push("The broker has blocked or suspended this account's trading.");
    if (account.cash <= 0 || account.equity <= 0 || account.nonMarginableBuyingPower <= 0) reasons.push("Positive cash, equity and non-margin buying power are required.");
    if (snapshot.positions.some(position => !state.ownedPosition || position.symbol !== state.ownedPosition.symbol || position.side !== "long")) reasons.push("Existing positions outside this agent's verified ledger need review in Alpaca; the agent will not manage them.");
    const ownedIds = new Set(state.ownedPosition ? [state.ownedPosition.entryOrderId] : []);
    if (snapshot.orders.some(order => !ownedIds.has(order.id) && !order.clientOrderId.startsWith("slice_"))) reasons.push("An external open order exists. Resolve it in Alpaca before enabling new agent entries.");
  }
  if (state.pendingIntentId) reasons.push("Reconcile the pending order intent before enabling more entries.");
  if (state.lastError) reasons.push(state.lastError);
  if (state.mode === "live") {
    if (!liveBrokerEnabled()) reasons.push("Live execution is disabled on the server. Set SLICE_BROKER_LIVE_ENABLED=true only after reviewing the paper results and safeguards.");
    if (state.policy.feed !== "sip") reasons.push("Live execution requires an entitled SIP consolidated feed; the free IEX feed covers one exchange.");
  }
  return [...new Set(reasons)];
}
