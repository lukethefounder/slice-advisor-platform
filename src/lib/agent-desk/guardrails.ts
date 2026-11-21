/** Deterministic paper accounting. This module has no network, broker, or live-order capability.
 * Persist account.sequence with an atomic compare-and-set and cycleId with a unique
 * owner-scoped receipt. A pure transition cannot supply database concurrency control. */
export type DeskPolicy = {
  version: 1;
  allowedSymbols: string[];
  maxPositionPct: number;
  maxExposurePct: number;
  minCashPct: number;
  maxDailyLossPct: number;
  maxTradesPerDay: number;
  cooldownMinutes: number;
  minResearchConfidence: number;
  minEvidenceCoverage: number;
  maxQuoteAgeSeconds: number;
  maxDecisionAgeSeconds: number;
  maxPriceDriftBps: number;
  slippageBps: number;
  feeBps: number;
  commissionUsd: number;
  stopLossPct: number;
  takeProfitPct: number | null;
  trailingStopPct: number | null;
  maxHoldingMinutes: number;
  flattenBeforeCloseMinutes: number;
};
export type DeskControls = { armed: boolean; autonomous: boolean; paused: boolean; killSwitch: boolean };
export type DeskQuote = {
  symbol: string; price: number; observedAt: string; retrievedAt: string;
  marketOpen: boolean; realTimeConfirmed: boolean; instrumentKind: "equity" | "index";
  currency: string; sourceKind: "intraday-bar" | "quote" | "daily"; exchange?: string;
};
export type DeskAssessment = {
  researchRunId: string; evaluatedAt: string; confidence: number; coverage: number;
  evidenceVerified: boolean; allAgentsCompleted: boolean; skepticVeto: boolean;
};
export type TradeProposal = {
  action: "buy" | "sell" | "hold"; symbol: string;
  referencePrice: number | null; allocationPct: number | null; rationale: string;
};
export type PaperPosition = {
  symbol: string; quantity: number; averageEntry: number; entryFees: number;
  openedAt: string; sessionDate: string; peakPrice: number;
  stopLossPct: number; takeProfitPct: number | null; trailingStopPct: number | null;
  maxHoldingMinutes: number; flattenBeforeCloseMinutes: number;
};
export type PaperAccount = {
  version: 1; classification: "paper-simulation"; initialCapital: number; cash: number;
  position: PaperPosition | null; realizedPnl: number; feesPaid: number;
  session: { date: string; openingEquity: number; trades: number; lossHalted: boolean };
  sequence: number; lastCycleId: string | null; lastCycleAt: string | null;
  lastFillAt: string | null; lastFillObservedAt: string | null; lastFillRetrievedAt: string | null;
  lastObservedAt: string | null; lastObservedPrice: number | null;
  reviewRequired: "overnight-position" | null;
};
export type PaperFill = {
  id: string; cycleId: string; sequence: number; classification: "paper-simulation";
  fillModel: "observed-price-plus-configured-costs";
  symbol: string; side: "BUY" | "SELL"; quantity: number;
  observedPrice: number; observedAt: string; filledAt: string;
  fillPrice: number; notional: number; fees: number; slippageCost: number;
  realizedPnl: number; reason: string; researchRunId: string | null;
};
export type PaperDecision = {
  status: "filled" | "blocked" | "held" | "duplicate";
  code: string; message: string; reasons: string[]; action: "buy" | "sell" | "hold";
  protective: boolean; cycleId: string; checkedAt: string; sequence: number;
};
export type PaperCycleResult = {
  account: PaperAccount; decision: PaperDecision; fill: PaperFill | null;
  equity: number | null; unrealizedPnl: number | null;
};
export type PaperCycleInput = {
  account: PaperAccount; policy: DeskPolicy; controls: DeskControls;
  cycleId: string; expectedSequence: number; now: string; quote: DeskQuote | null;
  assessment: DeskAssessment | null; proposal: TradeProposal | null; approved?: boolean;
};

export const DEFAULT_DESK_POLICY: DeskPolicy = {
  version: 1, allowedSymbols: ["MSFT", "AAPL", "SPY"], maxPositionPct: 10,
  maxExposurePct: 30, minCashPct: 50, maxDailyLossPct: 2, maxTradesPerDay: 8,
  cooldownMinutes: 5, minResearchConfidence: 40, minEvidenceCoverage: 40,
  maxQuoteAgeSeconds: 300, maxDecisionAgeSeconds: 900, maxPriceDriftBps: 50,
  slippageBps: 5, feeBps: 0, commissionUsd: 0, stopLossPct: 1,
  takeProfitPct: 2, trailingStopPct: null, maxHoldingMinutes: 90, flattenBeforeCloseMinutes: 5,
};
export const DEFAULT_DESK_CONTROLS: DeskControls = { armed: false, autonomous: false, paused: true, killSwitch: false };
const EPSILON = 1e-7;
const MINUTE = 60_000;
const CLOCK_TOLERANCE = 5_000;
const number = (value: unknown): value is number => typeof value === "number" && Number.isFinite(value);
const record = (value: unknown): value is Record<string, unknown> => typeof value === "object" && value !== null && !Array.isArray(value);
const money = (value: number) => Math.round(value * 1e8) / 1e8;
const symbolPattern = /^[A-Z][A-Z0-9.-]{0,14}$/;
const idPattern = /^[A-Za-z0-9:_-]{1,160}$/;
export class DeskGuardrailError extends Error {
  constructor(public code: string, message: string) { super(message); this.name = "DeskGuardrailError"; }
}
function fail(code: string, message: string): never { throw new DeskGuardrailError(code, message); }
function ranged(value: unknown, key: string, min: number, max: number, integer = false) {
  if (!number(value) || value < min || value > max || (integer && !Number.isInteger(value)))
    fail("INVALID_POLICY", `${key} must be ${integer ? "an integer " : ""}between ${min} and ${max}.`);
  return value;
}
function nullableRange(value: unknown, key: string, min: number, max: number) {
  return value === null ? null : ranged(value, key, min, max);
}
function timestamp(value: unknown) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,9})?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return NaN;
  const parsed = Date.parse(value), day = Date.parse(`${value.slice(0, 10)}T00:00:00Z`);
  return Number.isFinite(parsed) && Number.isFinite(day) && new Date(day).toISOString().slice(0, 10) === value.slice(0, 10) ? parsed : NaN;
}
function sessionClock(value: number) {
  const parts = Object.fromEntries(new Intl.DateTimeFormat("en-US", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", weekday: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).formatToParts(new Date(value)).map(part => [part.type, part.value]));
  return { date: `${parts.year}-${parts.month}-${parts.day}`, minute: Number(parts.hour) * 60 + Number(parts.minute), weekday: parts.weekday };
}

/** Only this version's known settings are accepted; no live/short/leverage switch is inferred. */
export function validateDeskPolicy(value: unknown): DeskPolicy {
  if (!record(value) || value.version !== 1) fail("INVALID_POLICY", "Use the supported version-1 paper policy.");
  const keys = Object.keys(DEFAULT_DESK_POLICY);
  if (Object.keys(value).some(key => !keys.includes(key)) || keys.some(key => !Object.hasOwn(value, key)))
    fail("INVALID_POLICY", "The paper policy contains missing or unsupported fields.");
  if (!Array.isArray(value.allowedSymbols) || value.allowedSymbols.length < 1 || value.allowedSymbols.length > 20 || value.allowedSymbols.some(symbol => typeof symbol !== "string" || !symbolPattern.test(symbol)) || new Set(value.allowedSymbols).size !== value.allowedSymbols.length)
    fail("INVALID_POLICY", "Choose 1–20 distinct uppercase stock or ETF symbols. Native indices are research-only.");
  const policy: DeskPolicy = {
    version: 1, allowedSymbols: [...value.allowedSymbols] as string[],
    maxPositionPct: ranged(value.maxPositionPct, "Maximum position", 1, 100),
    maxExposurePct: ranged(value.maxExposurePct, "Maximum exposure", 1, 100),
    minCashPct: ranged(value.minCashPct, "Minimum cash", 0, 99),
    maxDailyLossPct: ranged(value.maxDailyLossPct, "Daily loss limit", 0.1, 20),
    maxTradesPerDay: ranged(value.maxTradesPerDay, "Daily order limit", 1, 100, true),
    cooldownMinutes: ranged(value.cooldownMinutes, "Entry cooldown", 0, 240),
    minResearchConfidence: ranged(value.minResearchConfidence, "Research confidence", 40, 100),
    minEvidenceCoverage: ranged(value.minEvidenceCoverage, "Evidence coverage", 40, 100),
    maxQuoteAgeSeconds: ranged(value.maxQuoteAgeSeconds, "Maximum quote age", 60, 900, true),
    maxDecisionAgeSeconds: ranged(value.maxDecisionAgeSeconds, "Maximum decision age", 60, 3600, true),
    maxPriceDriftBps: ranged(value.maxPriceDriftBps, "Maximum entry price drift", 1, 500),
    slippageBps: ranged(value.slippageBps, "Simulated slippage", 0, 100),
    feeBps: ranged(value.feeBps, "Simulated percentage fee", 0, 100),
    commissionUsd: ranged(value.commissionUsd, "Simulated fixed commission", 0, 100),
    stopLossPct: ranged(value.stopLossPct, "Stop-loss", 0.1, 25),
    takeProfitPct: nullableRange(value.takeProfitPct, "Take-profit", 0.1, 100),
    trailingStopPct: nullableRange(value.trailingStopPct, "Trailing stop", 0.1, 25),
    maxHoldingMinutes: ranged(value.maxHoldingMinutes, "Maximum holding time", 1, 390, true),
    flattenBeforeCloseMinutes: ranged(value.flattenBeforeCloseMinutes, "Close-before-session-end window", 1, 60, true),
  };
  if (policy.maxPositionPct > policy.maxExposurePct || policy.maxExposurePct + policy.minCashPct > 100 + EPSILON)
    fail("INVALID_POLICY", "Maximum position must fit maximum exposure, and maximum exposure plus minimum cash cannot exceed 100%.");
  return policy;
}
export function validateDeskControls(value: unknown): DeskControls {
  if (!record(value) || Object.keys(value).some(key => !Object.hasOwn(DEFAULT_DESK_CONTROLS, key)) || Object.keys(DEFAULT_DESK_CONTROLS).some(key => typeof value[key] !== "boolean"))
    fail("INVALID_CONTROLS", "Paper controls must explicitly specify armed, autonomous, paused, and killSwitch.");
  return { armed: value.armed as boolean, autonomous: value.autonomous as boolean, paused: value.paused as boolean, killSwitch: value.killSwitch as boolean };
}
export function createPaperAccount(input: { initialCapital: number; now: string }): PaperAccount {
  if (!number(input.initialCapital) || input.initialCapital < 100 || input.initialCapital > 1_000_000_000 || Math.abs(money(input.initialCapital) - input.initialCapital) > EPSILON)
    fail("INVALID_CAPITAL", "Paper capital must be between $100 and $1 billion.");
  const time = timestamp(input.now);
  if (!Number.isFinite(time)) fail("INVALID_TIME", "A valid account creation time is required.");
  return { version: 1, classification: "paper-simulation", initialCapital: input.initialCapital, cash: input.initialCapital,
    position: null, realizedPnl: 0, feesPaid: 0, session: { date: sessionClock(time).date, openingEquity: input.initialCapital, trades: 0, lossHalted: false },
    sequence: 0, lastCycleId: null, lastCycleAt: null, lastFillAt: null, lastFillObservedAt: null, lastFillRetrievedAt: null,
    lastObservedAt: null, lastObservedPrice: null, reviewRequired: null };
}
export function validatePaperAccount(account: PaperAccount) {
  if (!record(account) || account.version !== 1 || account.classification !== "paper-simulation" || !number(account.initialCapital) || account.initialCapital < 100 || account.initialCapital > 1e9 || !number(account.cash) || account.cash < 0 || !number(account.realizedPnl) || !number(account.feesPaid) || account.feesPaid < 0 || !Number.isSafeInteger(account.sequence) || account.sequence < 0)
    fail("INVALID_ACCOUNT", "The stored paper account failed its accounting checks.");
  if (!record(account.session) || !Number.isFinite(timestamp(`${account.session.date}T00:00:00Z`)) || !number(account.session.openingEquity) || account.session.openingEquity <= 0 || !Number.isSafeInteger(account.session.trades) || account.session.trades < 0 || account.session.trades > account.sequence || typeof account.session.lossHalted !== "boolean")
    fail("INVALID_ACCOUNT", "The stored paper-session accounting is invalid.");
  if (account.reviewRequired !== null && account.reviewRequired !== "overnight-position") fail("INVALID_ACCOUNT", "Unknown paper-account review state.");
  for (const field of ["lastCycleAt", "lastFillAt", "lastFillObservedAt", "lastFillRetrievedAt", "lastObservedAt"] as const)
    if (account[field] !== null && !Number.isFinite(timestamp(account[field]))) fail("INVALID_ACCOUNT", "The stored paper account contains an invalid timestamp.");
  if (account.lastCycleId !== null && !idPattern.test(account.lastCycleId)) fail("INVALID_ACCOUNT", "The stored cycle identity is invalid.");
  const fillTimeCount = [account.lastFillAt, account.lastFillObservedAt, account.lastFillRetrievedAt].filter(value => value !== null).length;
  if ((account.sequence === 0 && (account.lastCycleId !== null || account.lastCycleAt !== null)) || (account.sequence > 0 && (account.lastCycleId === null || account.lastCycleAt === null)) || (fillTimeCount !== 0 && fillTimeCount !== 3) || (account.lastObservedAt === null) !== (account.lastObservedPrice === null))
    fail("INVALID_ACCOUNT", "The stored cycle, fill, and market-mark identities are inconsistent.");
  if (account.lastFillAt && (!account.lastCycleAt || timestamp(account.lastFillAt) > timestamp(account.lastCycleAt))) fail("INVALID_ACCOUNT", "The stored fill is later than its paper cycle.");
  if (account.lastObservedPrice !== null && (!number(account.lastObservedPrice) || account.lastObservedPrice <= 0)) fail("INVALID_ACCOUNT", "The stored market mark is invalid.");
  const position = account.position;
  if (position !== null) {
    if (!record(position) || !symbolPattern.test(position.symbol) || !Number.isSafeInteger(position.quantity) || position.quantity <= 0 || !number(position.averageEntry) || position.averageEntry <= 0 || !number(position.entryFees) || position.entryFees < 0 || position.entryFees > account.feesPaid + EPSILON || !number(position.peakPrice) || position.peakPrice <= 0 || !Number.isFinite(timestamp(position.openedAt)) || !Number.isFinite(timestamp(`${position.sessionDate}T00:00:00Z`)) || !account.lastFillAt || timestamp(position.openedAt) > timestamp(account.lastFillAt))
      fail("INVALID_ACCOUNT", "The stored paper position is invalid.");
    if (sessionClock(timestamp(position.openedAt)).date !== position.sessionDate) fail("INVALID_ACCOUNT", "The paper entry session does not match its timestamp.");
    ranged(position.stopLossPct, "Stored stop-loss", 0.1, 25);
    nullableRange(position.takeProfitPct, "Stored take-profit", 0.1, 100);
    nullableRange(position.trailingStopPct, "Stored trailing stop", 0.1, 25);
    ranged(position.maxHoldingMinutes, "Stored holding limit", 1, 390, true);
    ranged(position.flattenBeforeCloseMinutes, "Stored closing window", 1, 60, true);
  }
  const accounted = account.cash + (position ? position.quantity * position.averageEntry + position.entryFees : 0);
  if (Math.abs(accounted - (account.initialCapital + account.realizedPnl)) > Math.max(1e-5, Math.abs(accounted) * 1e-10))
    fail("INVALID_ACCOUNT", "Paper cash, cost basis, and realized profit do not reconcile.");
}
const tighter = (before: number | null, after: number | null) => before === null ? after : after === null ? before : Math.min(before, after);

/** One stock/ETF at a time; whole shares, no leverage, shorting, broker order or
 * invented spread. Approval must be owner-verified and bound to this proposal by
 * the caller. Model output must never set controls, approval, or account state. */
export function applyPaperCycle(input: PaperCycleInput): PaperCycleResult {
  const policy = validateDeskPolicy(input.policy); validateDeskControls(input.controls); validatePaperAccount(input.account);
  const now = timestamp(input.now);
  if (!Number.isFinite(now) || !idPattern.test(input.cycleId) || typeof input.approved !== "undefined" && typeof input.approved !== "boolean") fail("INVALID_CYCLE", "A valid server cycle identity, time, and approval state are required.");
  const original = input.account;
  const duplicate = original.lastCycleId === input.cycleId;
  if (!duplicate && input.expectedSequence !== original.sequence) fail("STATE_CONFLICT", "The account changed during this cycle. Reload its current revision before retrying.");
  if (!duplicate && original.lastCycleAt && now < timestamp(original.lastCycleAt)) fail("OUT_OF_ORDER_CYCLE", "A past cycle cannot replace newer paper-account state.");
  const account: PaperAccount = structuredClone(original);
  let equity: number | null = account.position ? null : account.cash, unrealizedPnl: number | null = account.position ? null : 0;
  const outcome = (status: PaperDecision["status"], code: string, message: string, action: PaperDecision["action"] = "hold", protective = false, fill: PaperFill | null = null): PaperCycleResult => ({
    account, decision: { status, code, message, reasons: [message], action, protective, cycleId: input.cycleId, checkedAt: input.now, sequence: account.sequence },
    fill, equity, unrealizedPnl,
  });
  if (duplicate) return outcome("duplicate", "CYCLE_ALREADY_APPLIED", "This cycle was already applied; no second paper order was created.");
  if (!Number.isSafeInteger(account.sequence + 1)) fail("INVALID_ACCOUNT", "The paper sequence limit has been reached.");
  account.sequence += 1; account.lastCycleId = input.cycleId; account.lastCycleAt = input.now;
  if (input.controls.killSwitch) return outcome("blocked", "KILL_SWITCH", "The kill switch blocks every paper order, including protective exits, until you explicitly resume.");
  if (!input.controls.armed) return outcome("blocked", "PAPER_NOT_ARMED", "Paper execution is not armed. Research can continue without an order.");
  const quote = input.quote;
  if (!quote || !number(quote.price) || quote.price <= 0 || quote.price > 1e9 || typeof quote.symbol !== "string" || !symbolPattern.test(quote.symbol)) return outcome("blocked", "QUOTE_UNAVAILABLE", "A valid observed stock price is required; no paper fill was invented.");
  if (quote.instrumentKind !== "equity" || quote.currency !== "USD") return outcome("blocked", "ASSET_NOT_TRADABLE", "This paper account supports USD stocks and ETFs only; native indices remain research-only.");
  if (quote.realTimeConfirmed !== true || !["intraday-bar", "quote"].includes(quote.sourceKind)) return outcome("blocked", "LIVE_DATA_UNVERIFIED", "A confirmed real-time intraday observation is required. Daily or delayed data cannot drive this day-trading simulator.");
  const observed = timestamp(quote.observedAt), retrieved = timestamp(quote.retrievedAt);
  if (![observed, retrieved].every(Number.isFinite) || observed > now + CLOCK_TOLERANCE || retrieved > now + CLOCK_TOLERANCE || observed > retrieved + CLOCK_TOLERANCE) return outcome("blocked", "INVALID_QUOTE_TIME", "The quote must retain valid original observation and retrieval times without future evidence.");
  if (now - observed > policy.maxQuoteAgeSeconds * 1000) return outcome("blocked", "QUOTE_TOO_OLD", `The latest observation exceeds your ${policy.maxQuoteAgeSeconds}-second age limit.`);
  if (account.lastObservedAt && observed < timestamp(account.lastObservedAt)) return outcome("blocked", "OUT_OF_ORDER_QUOTE", "An older observation cannot replace the newest paper-account market mark.");
  const clock = sessionClock(now), quoteClock = sessionClock(observed);
  if (quote.marketOpen !== true || ["Sat", "Sun"].includes(clock.weekday) || clock.minute < 570 || clock.minute >= 960 || quoteClock.date !== clock.date) return outcome("blocked", "SESSION_CLOSED", "Paper fills require a provider-confirmed open US regular session and a same-session observation.");
  if (account.position && account.position.symbol !== quote.symbol) return outcome("blocked", "POSITION_SYMBOL_MISMATCH", `The open ${account.position.symbol} position needs its own fresh observation before another symbol can be considered.`);
  account.lastObservedAt = quote.observedAt; account.lastObservedPrice = quote.price;
  equity = money(account.cash + (account.position?.quantity ?? 0) * quote.price);
  unrealizedPnl = account.position ? money(account.position.quantity * (quote.price - account.position.averageEntry) - account.position.entryFees) : 0;
  if (account.position && account.position.sessionDate !== clock.date) account.reviewRequired = "overnight-position";
  if (account.reviewRequired) return outcome("blocked", "OVERNIGHT_POSITION_REVIEW", "The position crossed a session boundary without a confirmed closing fill. Review possible splits or dividends before resuming; no overnight adjustment or close was invented.");
  if (account.session.date !== clock.date) account.session = { date: clock.date, openingEquity: equity, trades: 0, lossHalted: false };
  const lossPct = Math.max(0, (account.session.openingEquity - equity) / account.session.openingEquity * 100);
  if (lossPct + EPSILON >= policy.maxDailyLossPct) account.session.lossHalted = true;
  const position = account.position;
  let protectiveReason: { code: string; message: string } | null = null;
  if (position) {
    const priceTolerance = Math.max(position.averageEntry, quote.price) * 1e-12;
    position.peakPrice = Math.max(position.peakPrice, quote.price);
    position.stopLossPct = Math.min(position.stopLossPct, policy.stopLossPct);
    position.takeProfitPct = tighter(position.takeProfitPct, policy.takeProfitPct);
    position.trailingStopPct = tighter(position.trailingStopPct, policy.trailingStopPct);
    position.maxHoldingMinutes = Math.min(position.maxHoldingMinutes, policy.maxHoldingMinutes);
    position.flattenBeforeCloseMinutes = Math.max(position.flattenBeforeCloseMinutes, policy.flattenBeforeCloseMinutes);
    if (account.session.lossHalted) protectiveReason = { code: "DAILY_LOSS_EXIT", message: "Observed account loss reached the daily circuit; reduce the paper position and block new entries for the session." };
    else if (quote.price <= position.averageEntry * (1 - position.stopLossPct / 100) + priceTolerance) protectiveReason = { code: "STOP_LOSS_EXIT", message: "The observed price crossed the saved stop-loss. The fill uses the observed price and configured costs, not a guaranteed stop price." };
    else if (position.trailingStopPct !== null && quote.price <= position.peakPrice * (1 - position.trailingStopPct / 100) + priceTolerance) protectiveReason = { code: "TRAILING_STOP_EXIT", message: "The observed price crossed the saved trailing stop." };
    else if (clock.minute >= 960 - position.flattenBeforeCloseMinutes) protectiveReason = { code: "SESSION_END_EXIT", message: "The paper position reached the configured regular-session closing window." };
    else if (now - timestamp(position.openedAt) >= position.maxHoldingMinutes * MINUTE) protectiveReason = { code: "HOLDING_TIME_EXIT", message: "The paper position reached its maximum holding time." };
    else if (position.takeProfitPct !== null && quote.price >= position.averageEntry * (1 + position.takeProfitPct / 100) - priceTolerance) protectiveReason = { code: "TAKE_PROFIT_EXIT", message: "The observed price reached the saved take-profit threshold." };
  }
  const proposal = input.proposal;
  if (!protectiveReason && (!proposal || !["buy", "sell", "hold"].includes(proposal.action) || proposal.symbol !== quote.symbol || typeof proposal.rationale !== "string" || proposal.rationale.length > 4000)) return outcome("blocked", "INVALID_PROPOSAL", "A validated proposal for the exact observed stock is required.");
  const sell = Boolean(position && (protectiveReason || proposal?.action === "sell"));
  if (sell) {
    if (!protectiveReason && !input.controls.autonomous && input.approved !== true) return outcome("blocked", "APPROVAL_REQUIRED", "This paper sale requires your approval; protective exits remain automatic while armed.");
    if (account.lastFillObservedAt && (observed < timestamp(account.lastFillObservedAt) || observed === timestamp(account.lastFillObservedAt) && retrieved <= timestamp(account.lastFillRetrievedAt))) return outcome("blocked", "OBSERVATION_ALREADY_USED", "Wait for a new provider observation or a newer original fetch receipt before simulating another order.", "sell", Boolean(protectiveReason));
    const held = position!;
    const fillPrice = money(quote.price * (1 - policy.slippageBps / 10_000));
    const notional = money(held.quantity * fillPrice), fees = money(notional * policy.feeBps / 10_000 + policy.commissionUsd);
    if (!(fillPrice > 0) || notional < fees) return outcome("blocked", "COST_EXCEEDS_PROCEEDS", "The configured sale costs exceed proceeds; no impossible paper fill was recorded.", "sell", Boolean(protectiveReason));
    const realizedPnl = money(notional - fees - held.quantity * held.averageEntry - held.entryFees);
    const reason = protectiveReason?.message ?? "Approved chief proposal to close the paper position.";
    account.cash = money(account.cash + notional - fees); account.realizedPnl = money(account.realizedPnl + realizedPnl);
    account.feesPaid = money(account.feesPaid + fees); account.position = null; account.session.trades += 1;
    account.lastFillAt = input.now; account.lastFillObservedAt = quote.observedAt; account.lastFillRetrievedAt = quote.retrievedAt;
    equity = account.cash; unrealizedPnl = 0;
    if ((account.session.openingEquity - equity) / account.session.openingEquity * 100 + EPSILON >= policy.maxDailyLossPct) account.session.lossHalted = true;
    validatePaperAccount(account);
    return outcome("filled", protectiveReason?.code ?? "PAPER_SELL", reason, "sell", Boolean(protectiveReason), {
      id: `paper:${input.cycleId}`, cycleId: input.cycleId, sequence: account.sequence, classification: "paper-simulation", fillModel: "observed-price-plus-configured-costs",
      symbol: quote.symbol, side: "SELL", quantity: held.quantity, observedPrice: quote.price, observedAt: quote.observedAt, filledAt: input.now,
      fillPrice, notional, fees, slippageCost: money(held.quantity * (quote.price - fillPrice)), realizedPnl, reason,
      researchRunId: input.assessment?.researchRunId ?? null,
    });
  }
  if (proposal!.action === "sell") return outcome("held", "NO_POSITION", "There is no position to sell. Short selling is unavailable.");
  if (proposal!.action === "hold") return outcome("held", "HOLD", "The team proposed no new paper order.");
  if (account.position) return outcome("blocked", "POSITION_ALREADY_OPEN", "This account holds one stock at a time. Adding leverage, pyramiding, or a second position is unavailable.");
  if (input.controls.paused) return outcome("blocked", "ENTRIES_PAUSED", "New paper entries are paused; protective exits can still run while armed.");
  if (!input.controls.autonomous && input.approved !== true) return outcome("blocked", "APPROVAL_REQUIRED", "This paper entry requires your approval or an explicitly armed autonomous paper policy.");
  if (!policy.allowedSymbols.includes(quote.symbol)) return outcome("blocked", "SYMBOL_NOT_ALLOWED", "The proposed stock is outside your approved symbol list.");
  if (account.session.lossHalted) return outcome("blocked", "DAILY_LOSS_HALT", "The daily loss circuit is latched. New entries remain blocked for the rest of this session.");
  if (account.session.trades >= policy.maxTradesPerDay) return outcome("blocked", "DAILY_TRADE_LIMIT", "The daily order limit blocks new entries. Protective and approved position-closing exits remain available.");
  if (account.lastFillAt && now - timestamp(account.lastFillAt) < policy.cooldownMinutes * MINUTE) return outcome("blocked", "ENTRY_COOLDOWN", "Your entry cooldown has not elapsed since the last paper fill.");
  if (account.lastFillObservedAt && (observed < timestamp(account.lastFillObservedAt) || observed === timestamp(account.lastFillObservedAt) && retrieved <= timestamp(account.lastFillRetrievedAt))) return outcome("blocked", "OBSERVATION_ALREADY_USED", "Wait for a new provider observation or a newer original fetch receipt before simulating another order.");
  if (clock.minute >= 960 - policy.flattenBeforeCloseMinutes) return outcome("blocked", "SESSION_END_ENTRY_BLOCK", "New entries are blocked during the configured closing window.");
  const assessment = input.assessment;
  if (!assessment || !idPattern.test(assessment.researchRunId) || assessment.evidenceVerified !== true || assessment.allAgentsCompleted !== true) return outcome("blocked", "EVIDENCE_INCOMPLETE", "All six agents must complete against a verified, saved evidence packet before opening a paper position.");
  const assessed = timestamp(assessment.evaluatedAt);
  if (!Number.isFinite(assessed) || assessed > now + CLOCK_TOLERANCE || now - assessed > policy.maxDecisionAgeSeconds * 1000) return outcome("blocked", "DECISION_TOO_OLD", "The research decision is missing, future-dated, or older than your configured decision window.");
  if (!number(assessment.confidence) || assessment.confidence < policy.minResearchConfidence || assessment.confidence > 100) return outcome("blocked", "RESEARCH_CONFIDENCE_LOW", `Observed research confidence must meet your ${policy.minResearchConfidence}/100 threshold; model self-confidence cannot replace it.`);
  if (!number(assessment.coverage) || assessment.coverage < policy.minEvidenceCoverage || assessment.coverage > 100) return outcome("blocked", "EVIDENCE_COVERAGE_LOW", `Evidence coverage must meet your ${policy.minEvidenceCoverage}/100 threshold.`);
  if (assessment.skepticVeto !== false) return outcome("blocked", "SKEPTIC_VETO", "The skeptic veto or an unverified veto state blocks a new entry.");
  if (!number(proposal!.referencePrice) || proposal!.referencePrice! <= 0 || Math.abs(quote.price / proposal!.referencePrice! - 1) * 10_000 > policy.maxPriceDriftBps + EPSILON) return outcome("blocked", "ENTRY_PRICE_MOVED", "The current observed price moved beyond your permitted drift from the proposed entry price.");
  const allocation = proposal!.allocationPct;
  if (!number(allocation) || allocation <= 0 || allocation > policy.maxPositionPct || allocation > policy.maxExposurePct) return outcome("blocked", "ALLOCATION_LIMIT", "The requested allocation exceeds your position or exposure cap, or is invalid.");
  const fillPrice = money(quote.price * (1 + policy.slippageBps / 10_000));
  const feeRate = policy.feeBps / 10_000, cap = allocation / 100, reserve = policy.minCashPct / 100;
  const costPerShare = fillPrice - quote.price + fillPrice * feeRate;
  const afterCommission = equity! - policy.commissionUsd;
  const capQuantity = cap * afterCommission / (quote.price + cap * costPerShare);
  const cashQuantity = (1 - reserve) * afterCommission / (fillPrice * (1 + feeRate) - reserve * costPerShare);
  const quantity = Math.floor(Math.min(capQuantity, cashQuantity, 1_000_000_000));
  if (!Number.isSafeInteger(quantity) || quantity < 1 || !(fillPrice > 0)) return outcome("blocked", "INSUFFICIENT_CAPITAL", "The approved allocation cannot fund one whole share after configured costs and the cash reserve.");
  const notional = money(quantity * fillPrice), fees = money(notional * feeRate + policy.commissionUsd);
  const cashAfter = money(account.cash - notional - fees), equityAfter = money(cashAfter + quantity * quote.price);
  if (!(equityAfter > 0) || cashAfter < -EPSILON || cashAfter / equityAfter * 100 + EPSILON < policy.minCashPct || quantity * quote.price / equityAfter * 100 > Math.min(allocation, policy.maxPositionPct, policy.maxExposurePct) + EPSILON) return outcome("blocked", "ALLOCATION_ACCOUNTING_LIMIT", "Whole-share sizing and configured costs could not satisfy every cash and exposure constraint.");
  if ((account.session.openingEquity - equityAfter) / account.session.openingEquity * 100 + EPSILON >= policy.maxDailyLossPct) return outcome("blocked", "ENTRY_COSTS_EXCEED_LOSS_BUDGET", "Entry costs alone would reach the daily loss circuit; no paper position was opened.");
  account.cash = Math.max(0, cashAfter); account.feesPaid = money(account.feesPaid + fees); account.session.trades += 1;
  account.position = { symbol: quote.symbol, quantity, averageEntry: fillPrice, entryFees: fees, openedAt: input.now, sessionDate: clock.date, peakPrice: quote.price,
    stopLossPct: policy.stopLossPct, takeProfitPct: policy.takeProfitPct, trailingStopPct: policy.trailingStopPct, maxHoldingMinutes: policy.maxHoldingMinutes, flattenBeforeCloseMinutes: policy.flattenBeforeCloseMinutes };
  account.lastFillAt = input.now; account.lastFillObservedAt = quote.observedAt; account.lastFillRetrievedAt = quote.retrievedAt; equity = equityAfter; unrealizedPnl = money(quantity * (quote.price - fillPrice) - fees);
  validatePaperAccount(account);
  return outcome("filled", "PAPER_BUY", "The entry passed the deterministic paper safeguards. The fill is a simulation over the observed price with configured costs, not a broker execution.", "buy", false, {
    id: `paper:${input.cycleId}`, cycleId: input.cycleId, sequence: account.sequence, classification: "paper-simulation", fillModel: "observed-price-plus-configured-costs",
    symbol: quote.symbol, side: "BUY", quantity, observedPrice: quote.price, observedAt: quote.observedAt, filledAt: input.now,
    fillPrice, notional, fees, slippageCost: money(quantity * (fillPrice - quote.price)), realizedPnl: 0, reason: "Validated chief entry proposal under the saved paper policy.", researchRunId: assessment.researchRunId,
  });
}
