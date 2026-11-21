import type { CycleReceipt } from "@/lib/agent-desk/store";
import { AGENT_ROLES } from "@/lib/agent-desk/contracts";
import { AgentBrokerError, type BrokerPolicy } from "./contracts";
import type { AlpacaOrderInput, BrokerAsset, BrokerQuote } from "./alpaca";
import type { BrokerSnapshot } from "./store";

/** A durable global desk pause survives a failure to update the separate broker row. */
export function brokerPausedByDesk(state: { deskRevisionAtEnable?: number }, desk: { controls: { killSwitch: boolean }; brokerPausedAtRevision?: number }): boolean {
  if (desk.controls.killSwitch) return true;
  return Number.isSafeInteger(desk.brokerPausedAtRevision) && (!Number.isSafeInteger(state.deskRevisionAtEnable) || state.deskRevisionAtEnable! < desk.brokerPausedAtRevision!);
}

export function brokerTradingDay(now: number): string {
  const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date(now));
  return ["year", "month", "day"].map(type => parts.find(part => part.type === type)!.value).join("-");
}
export function assertBrokerSession(snapshot: BrokerSnapshot, now = Date.now(), closingBufferMinutes = 0): void {
  const clock = snapshot.clock;
  const clockAge = now - Date.parse(clock.timestamp), untilClose = Date.parse(clock.nextClose) - now;
  if (!Number.isFinite(clockAge) || clockAge < -2000 || clockAge > 15_000 || clock.isOpen !== true || !Number.isFinite(untilClose) || untilClose <= closingBufferMinutes * 60_000)
    throw new AgentBrokerError("BROKER_SESSION_CLOSED", "The broker's current regular session is closed, stale, or inside the configured closing buffer. No order was submitted.");
}
export function assertChiefReceipt(receipt: CycleReceipt, policy: BrokerPolicy, now = Date.now()): void {
  const { cycle, assessment } = receipt;
  const age = now - Date.parse(cycle.completedAt);
  if (!Number.isFinite(age) || age < -2000 || age > policy.maxDecisionAgeSeconds * 1000)
    throw new AgentBrokerError("BROKER_DECISION_STALE", "The Chief decision is too old for broker execution. Run a fresh review.");
  const chief = cycle.agents.find(agent => agent.role === "chief");
  if (!chief || chief.status !== "complete" || cycle.agents.filter(agent => agent.role === "chief").length !== 1 || !cycle.proposal || cycle.proposal.symbol !== cycle.symbol
    || chief.action !== cycle.proposal.action || !["buy", "sell", "hold"].includes(cycle.proposal.action) || cycle.status === "failed")
    throw new AgentBrokerError("BROKER_PROPOSAL_INVALID", "The completed Chief conclusion and saved execution proposal do not agree.");
  // Weak or contradictory entry evidence is a valid reason to reduce an existing owned position.
  // Exits still require a fresh, immutable, account-targeted Chief decision and independent broker exposure checks.
  if (cycle.proposal.action !== "buy") return;
  if (!assessment || assessment.evidenceVerified !== true || assessment.allAgentsCompleted !== true || assessment.skepticVeto !== false
    || !Number.isFinite(assessment.confidence) || assessment.confidence < policy.minResearchConfidence
    || !Number.isFinite(assessment.coverage) || assessment.coverage < policy.minEvidenceCoverage
    || !cycle.deliberation?.complete || cycle.deliberation.reports !== 12 || cycle.deliberation.rounds !== 2
    || cycle.agents.length !== 6 || AGENT_ROLES.some(role => cycle.agents.filter(agent => agent.role === role && agent.status === "complete").length !== 1)
    || cycle.helpers?.some(helper => helper.report.status !== "complete" || helper.report.veto)
    || cycle.agents.some(agent => agent.veto) || !cycle.researchRunId || assessment.researchRunId !== cycle.researchRunId)
    throw new AgentBrokerError("BROKER_RESEARCH_INCOMPLETE", "Broker execution requires verified current research, the complete two-round six-agent review, completed helpers, sufficient confidence and coverage, and no veto.");
}
export function buildBrokerEntry(input: { receipt: CycleReceipt; policy: BrokerPolicy; snapshot: BrokerSnapshot; quote: BrokerQuote; asset: BrokerAsset; clientOrderId: string; entriesToday: number; now?: number }): AlpacaOrderInput {
  const { receipt, policy, snapshot, quote, asset, clientOrderId } = input; const now = input.now ?? Date.now();
  assertChiefReceipt(receipt, policy, now); assertBrokerSession(snapshot, now, policy.flattenBeforeCloseMinutes);
  const proposal = receipt.cycle.proposal!, account = snapshot.account;
  if (proposal.action !== "buy" || !policy.allowedSymbols.includes(proposal.symbol) || asset.symbol !== proposal.symbol || asset.assetClass !== "us_equity" || asset.status !== "active" || !asset.tradable
    || !["NYSE", "NASDAQ", "ARCA", "AMEX", "BATS", "NYSEARCA"].includes(asset.exchange))
    throw new AgentBrokerError("BROKER_ASSET_NOT_APPROVED", "This proposal is outside the approved, tradable US stock and ETF universe.");
  if (account.status !== "ACTIVE" || account.currency !== "USD" || account.accountBlocked || account.tradingBlocked || account.tradeSuspended
    || ![account.cash, account.equity, account.lastEquity, account.nonMarginableBuyingPower].every(value => Number.isFinite(value) && value > 0))
    throw new AgentBrokerError("BROKER_ACCOUNT_BLOCKED", "The broker account is not active with verified positive USD cash and non-margin buying power.");
  if (snapshot.positions.length || snapshot.orders.length) throw new AgentBrokerError("BROKER_EXISTING_EXPOSURE", "Existing positions or open orders must resolve before a new agent position is opened.");
  if ((account.lastEquity - account.equity) / account.lastEquity * 100 >= policy.maxDailyLossPct)
    throw new AgentBrokerError("BROKER_DAILY_LOSS_LIMIT", "The account's equity drawdown has reached the configured daily loss limit. New entries are stopped.");
  if (input.entriesToday >= policy.maxTradesPerDay) throw new AgentBrokerError("BROKER_DAILY_TRADE_LIMIT", "Today's maximum number of entry attempts has been reached.");
  const quoteAge = now - Date.parse(quote.timestamp);
  if (quote.symbol !== proposal.symbol || quote.feed !== policy.feed || !Number.isFinite(quoteAge) || quoteAge < -1000 || quoteAge > policy.maxQuoteAgeSeconds * 1000
    || !Number.isFinite(quote.bid) || !Number.isFinite(quote.ask) || quote.bid < 1 || quote.ask < quote.bid || quote.ask > 1_000_000)
    throw new AgentBrokerError("BROKER_QUOTE_UNUSABLE", "A fresh, valid two-sided broker quote of at least $1 is required before entry.");
  const spreadBps = (quote.ask - quote.bid) / ((quote.ask + quote.bid) / 2) * 10_000;
  if (spreadBps > policy.maxSpreadBps) throw new AgentBrokerError("BROKER_SPREAD_TOO_WIDE", "The current bid/ask spread exceeds the founder's execution limit.");
  const reference = proposal.referencePrice, allocation = proposal.allocationPct;
  if (typeof reference !== "number" || !Number.isFinite(reference) || reference <= 0 || typeof allocation !== "number" || !Number.isFinite(allocation) || allocation <= 0 || allocation > 100)
    throw new AgentBrokerError("BROKER_PRICE_REFERENCE_MISSING", "The stored Chief proposal needs a valid observed reference price and allocation.");
  // A marketable limit bounds entry slippage. It can remain unfilled; no fill is fabricated.
  const limitPrice = Math.ceil(quote.ask * (1 + Math.min(5, policy.maxPriceDriftBps) / 10_000) * 100) / 100;
  if (Math.abs(limitPrice - reference) / reference * 10_000 > policy.maxPriceDriftBps)
    throw new AgentBrokerError("BROKER_PRICE_DRIFT", "The executable price moved too far from the Chief's research reference. Request a new decision.");
  const availableCash = account.cash - account.equity * policy.minCashPct / 100;
  const budget = Math.min(policy.maxOrderUsd, account.equity * Math.min(policy.maxPositionPct, allocation) / 100, availableCash, account.nonMarginableBuyingPower * 0.99);
  const quantity = Math.floor(budget / limitPrice);
  if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 9_999_999) throw new AgentBrokerError("BROKER_ALLOCATION_TOO_SMALL", "The cash reserve, order cap and position limit leave insufficient room for one whole share.");
  const stop = Math.floor(limitPrice * (1 - policy.stopLossPct / 100) * 100) / 100;
  const target = Math.ceil(limitPrice * (1 + policy.takeProfitPct / 100) * 100) / 100;
  if (stop <= 0 || stop >= quote.bid - 0.009 || target <= limitPrice) throw new AgentBrokerError("BROKER_BRACKET_INVALID", "The stop and target cannot be placed safely around the current quote.");
  return { symbol: proposal.symbol, qty: String(quantity), side: "buy", type: "limit", time_in_force: "day", client_order_id: clientOrderId,
    extended_hours: false, position_intent: "buy_to_open", order_class: "bracket", limit_price: limitPrice.toFixed(2), take_profit: { limit_price: target.toFixed(2) }, stop_loss: { stop_price: stop.toFixed(2) } };
}
