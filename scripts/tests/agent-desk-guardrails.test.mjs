import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url), ts = require("typescript");
let checks = 0;
const same = (value, expected, label) => { assert.deepEqual(value, expected, label); checks++; };
const yes = (value, label) => { assert.ok(value, label); checks++; };
const throws = (fn, code, label) => { assert.throws(fn, error => error.code === code, label); checks++; };
const clone = value => structuredClone(value);
const source = await readFile(new URL("../../src/lib/agent-desk/guardrails.ts", import.meta.url), "utf8");
const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
same(compiled.diagnostics.filter(value => value.category === ts.DiagnosticCategory.Error), [], "Pure guardrails transpile");
const loaded = { exports: {} };
new Function("module", "exports", compiled.outputText)(loaded, loaded.exports);
const { DEFAULT_DESK_POLICY, DEFAULT_DESK_CONTROLS, createPaperAccount, applyPaperCycle, validateDeskPolicy, validateDeskControls, validatePaperAccount } = loaded.exports;
const baseNow = Date.parse("2026-11-18T15:00:00.000Z");
const iso = (offset = 0) => new Date(baseNow + offset).toISOString();
const controls = { armed: true, autonomous: true, paused: false, killSwitch: false };
const cleanPolicy = () => ({ ...clone(DEFAULT_DESK_POLICY), slippageBps: 0, feeBps: 0, commissionUsd: 0 });
function fixture(overrides = {}) {
  return {
    account: createPaperAccount({ initialCapital: 100000, now: iso() }), policy: cleanPolicy(), controls: clone(controls),
    cycleId: "cycle-1", expectedSequence: 0, now: iso(),
    quote: { symbol: "MSFT", price: 200, observedAt: iso(-30000), retrievedAt: iso(-5000), marketOpen: true, realTimeConfirmed: true, instrumentKind: "equity", currency: "USD", sourceKind: "intraday-bar" },
    assessment: { researchRunId: "research-1", evaluatedAt: iso(-60000), confidence: 65, coverage: 80, evidenceVerified: true, allAgentsCompleted: true, skepticVeto: false },
    proposal: { action: "buy", symbol: "MSFT", referencePrice: 200, allocationPct: 10, rationale: "Controlled evidence fixture" }, ...overrides,
  };
}
function next(result, offset = 60000, overrides = {}) {
  const input = fixture({ account: clone(result.account), cycleId: `cycle-${result.account.sequence + 1}`, expectedSequence: result.account.sequence, now: iso(offset) });
  input.quote.observedAt = iso(offset - 30000); input.quote.retrievedAt = iso(offset - 5000);
  return { ...input, ...overrides };
}
function blocked(mutate, code, label) {
  const input = fixture(); mutate(input); const before = JSON.stringify(input), output = applyPaperCycle(input);
  same(output.decision.code, code, label); same(output.decision.status, "blocked", label);
  same(output.fill, null, "A blocked decision has no fill"); same(output.account.cash, input.account.cash, "A blocked entry cannot debit cash");
  same(JSON.stringify(input), before, "Evaluation does not mutate its input");
  return output;
}

same(validateDeskPolicy(DEFAULT_DESK_POLICY), DEFAULT_DESK_POLICY);
same(validateDeskControls(DEFAULT_DESK_CONTROLS), DEFAULT_DESK_CONTROLS);
same(createPaperAccount({ initialCapital: 100000, now: iso() }).classification, "paper-simulation");
same(DEFAULT_DESK_CONTROLS, { armed: false, autonomous: false, paused: true, killSwitch: false }, "Execution begins disabled");
for (const patch of [
  { live: true }, { leverage: 2 }, { mode: "live" }, { allowShort: true }, { version: 2 },
  { allowedSymbols: [] }, { allowedSymbols: ["MSFT", "MSFT"] }, { allowedSymbols: ["msft"] },
  { allowedSymbols: ["INDEX:SPX"] }, { allowedSymbols: ["^GSPC"] }, { allowedSymbols: ["MSFT; curl"] },
  { allowedSymbols: Array.from({ length: 21 }, (_, i) => `T${i}`) },
  { maxPositionPct: 40 }, { maxExposurePct: 60 }, { maxPositionPct: 0 }, { maxPositionPct: Infinity },
  { maxDailyLossPct: 0 }, { maxDailyLossPct: 21 }, { maxTradesPerDay: 1.2 }, { cooldownMinutes: -1 },
  { minResearchConfidence: 39 }, { minResearchConfidence: "40" }, { minEvidenceCoverage: 39 },
  { maxQuoteAgeSeconds: 59 }, { maxQuoteAgeSeconds: 901 }, { maxDecisionAgeSeconds: 3601 },
  { maxPriceDriftBps: 0 }, { slippageBps: -1 }, { feeBps: 101 }, { commissionUsd: 101 },
  { stopLossPct: null }, { stopLossPct: 0 }, { takeProfitPct: 0 }, { trailingStopPct: -1 },
  { maxHoldingMinutes: 391 }, { flattenBeforeCloseMinutes: 0 }, { flattenBeforeCloseMinutes: 61 },
]) throws(() => validateDeskPolicy({ ...cleanPolicy(), ...patch }), "INVALID_POLICY", JSON.stringify(patch));
const missing = cleanPolicy(); delete missing.stopLossPct;
throws(() => validateDeskPolicy(missing), "INVALID_POLICY");
for (const value of [null, [], {}, "policy"]) throws(() => validateDeskPolicy(value), "INVALID_POLICY");
for (const value of [{ ...controls, live: true }, { ...controls, armed: "true" }, { armed: true }, null]) throws(() => validateDeskControls(value), "INVALID_CONTROLS");
for (const value of [0, 99, -1, NaN, Infinity, 1e9 + 1, "100000"]) throws(() => createPaperAccount({ initialCapital: value, now: iso() }), "INVALID_CAPITAL");
for (const value of ["", "2026-02-30T00:00:00Z", "2026-11-18", "invalid"]) throws(() => createPaperAccount({ initialCapital: 100000, now: value }), "INVALID_TIME");

const initial = fixture(), immutable = JSON.stringify(initial), entry = applyPaperCycle(initial);
same(entry.decision.status, "filled"); same(entry.fill.side, "BUY"); same(entry.fill.quantity, 50);
same(entry.account.cash, 90000); same(entry.equity, 100000); same(entry.unrealizedPnl, 0);
same(entry.account.position.averageEntry, 200); same(entry.account.session.trades, 1);
same(entry.account.sequence, 1); same(entry.account.lastFillRetrievedAt, initial.quote.retrievedAt);
same(entry.fill.observedAt, initial.quote.observedAt); same(entry.fill.fillModel, "observed-price-plus-configured-costs");
same(JSON.stringify(initial), immutable); validatePaperAccount(entry.account);
const replay = applyPaperCycle({ ...clone(initial), account: entry.account });
same(replay.decision.status, "duplicate"); same(replay.fill, null); same(replay.account, entry.account);
throws(() => applyPaperCycle({ ...next(entry), expectedSequence: 0 }), "STATE_CONFLICT", "Late concurrent transition is fenced by expected sequence");
throws(() => applyPaperCycle({ ...next(entry), now: iso(-1) }), "OUT_OF_ORDER_CYCLE");
throws(() => applyPaperCycle({ ...fixture(), cycleId: "" }), "INVALID_CYCLE");
throws(() => applyPaperCycle({ ...fixture(), approved: "true" }), "INVALID_CYCLE");

blocked(value => { value.controls.killSwitch = true; }, "KILL_SWITCH");
blocked(value => { value.controls.armed = false; }, "PAPER_NOT_ARMED");
blocked(value => { value.controls.paused = true; }, "ENTRIES_PAUSED");
blocked(value => { value.controls.autonomous = false; }, "APPROVAL_REQUIRED");
same(applyPaperCycle({ ...fixture(), controls: { ...controls, autonomous: false }, approved: true }).decision.status, "filled", "Owner-bound approval can authorize one paper proposal");
blocked(value => { value.quote = null; }, "QUOTE_UNAVAILABLE");
for (const price of [0, -1, NaN, Infinity, 1e9 + 1]) blocked(value => { value.quote.price = price; }, "QUOTE_UNAVAILABLE");
blocked(value => { value.quote.instrumentKind = "index"; }, "ASSET_NOT_TRADABLE");
blocked(value => { value.quote.currency = "EUR"; }, "ASSET_NOT_TRADABLE");
for (const confirmed of [false, "true", null]) blocked(value => { value.quote.realTimeConfirmed = confirmed; }, "LIVE_DATA_UNVERIFIED");
blocked(value => { value.quote.sourceKind = "daily"; }, "LIVE_DATA_UNVERIFIED");
blocked(value => { value.quote.observedAt = iso(-300001); }, "QUOTE_TOO_OLD");
for (const stamp of [iso(5001), "2026-11-18", "bad", "2026-02-30T15:00:00Z"]) blocked(value => { value.quote.observedAt = stamp; }, "INVALID_QUOTE_TIME");
blocked(value => { value.quote.retrievedAt = iso(5001); }, "INVALID_QUOTE_TIME");
blocked(value => { value.quote.retrievedAt = iso(-36000); }, "INVALID_QUOTE_TIME");
for (const open of [false, "true", null]) blocked(value => { value.quote.marketOpen = open; }, "SESSION_CLOSED");
for (const at of ["2026-11-18T14:00:00Z", "2026-11-18T21:00:00Z", "2026-11-21T15:00:00Z"]) {
  blocked(value => { value.now = at; value.account = createPaperAccount({ initialCapital: 100000, now: at }); value.quote.observedAt = at; value.quote.retrievedAt = at; }, "SESSION_CLOSED");
}
blocked(value => { value.proposal.symbol = "NVDA"; }, "INVALID_PROPOSAL");
blocked(value => { value.proposal.action = "short"; }, "INVALID_PROPOSAL");
blocked(value => { value.proposal = null; }, "INVALID_PROPOSAL");
blocked(value => { value.policy.allowedSymbols = ["AAPL"]; }, "SYMBOL_NOT_ALLOWED");
for (const mutate of [value => { value.assessment = null; }, value => { value.assessment.evidenceVerified = false; }, value => { value.assessment.evidenceVerified = "true"; }, value => { value.assessment.allAgentsCompleted = false; }, value => { value.assessment.allAgentsCompleted = "true"; }, value => { value.assessment.researchRunId = ""; }]) blocked(mutate, "EVIDENCE_INCOMPLETE");
for (const stamp of [iso(-900001), iso(5001), "bad"]) blocked(value => { value.assessment.evaluatedAt = stamp; }, "DECISION_TOO_OLD");
for (const confidence of [21, 39.99, NaN, Infinity, 101, "80"]) blocked(value => { value.assessment.confidence = confidence; }, "RESEARCH_CONFIDENCE_LOW");
same(applyPaperCycle({ ...fixture(), assessment: { ...fixture().assessment, confidence: 40, coverage: 40 } }).decision.status, "filled", "Exact configured floors are honored without an inflated score");
blocked(value => { value.policy.minResearchConfidence = 70; }, "RESEARCH_CONFIDENCE_LOW");
for (const coverage of [0, 39.99, NaN, 101, "80"]) blocked(value => { value.assessment.coverage = coverage; }, "EVIDENCE_COVERAGE_LOW");
for (const veto of [true, undefined, "false"]) blocked(value => { value.assessment.skepticVeto = veto; }, "SKEPTIC_VETO");
for (const referencePrice of [null, 0, 198, NaN]) blocked(value => { value.proposal.referencePrice = referencePrice; }, "ENTRY_PRICE_MOVED");
for (const allocationPct of [null, -1, 0, 10.01, 100, NaN]) blocked(value => { value.proposal.allocationPct = allocationPct; }, "ALLOCATION_LIMIT");
const hold = fixture(); hold.proposal.action = "hold"; hold.assessment.confidence = 21;
same(applyPaperCycle(hold).decision.code, "HOLD", "An abstention does not become a buy when confidence is low");
const nakedSell = fixture(); nakedSell.proposal.action = "sell";
same(applyPaperCycle(nakedSell).decision.code, "NO_POSITION", "No position means no sale and no short");
const small = fixture(); small.account = createPaperAccount({ initialCapital: 100, now: iso() });
same(applyPaperCycle(small).decision.code, "INSUFFICIENT_CAPITAL");
const expensive = fixture(); expensive.account = createPaperAccount({ initialCapital: 1000, now: iso() }); expensive.policy.commissionUsd = 5; expensive.policy.maxDailyLossPct = .1; expensive.proposal.referencePrice = expensive.quote.price = 10;
same(applyPaperCycle(expensive).decision.code, "ENTRY_COSTS_EXCEED_LOSS_BUDGET");

const secondBuy = applyPaperCycle(next(entry)); same(secondBuy.decision.code, "POSITION_ALREADY_OPEN");
const otherStock = next(entry); otherStock.quote.symbol = otherStock.proposal.symbol = "AAPL";
same(applyPaperCycle(otherStock).decision.code, "POSITION_SYMBOL_MISMATCH");
const lateQuote = next(entry); lateQuote.quote.observedAt = iso(-60000);
same(applyPaperCycle(lateQuote).decision.code, "OUT_OF_ORDER_QUOTE");
const sameReceipt = next(entry); sameReceipt.quote.observedAt = initial.quote.observedAt; sameReceipt.quote.retrievedAt = initial.quote.retrievedAt; sameReceipt.proposal.action = "sell";
same(applyPaperCycle(sameReceipt).decision.code, "OBSERVATION_ALREADY_USED");
const newReceiptSameBar = next(entry); newReceiptSameBar.quote.observedAt = initial.quote.observedAt; newReceiptSameBar.quote.price = 197; newReceiptSameBar.proposal = null; newReceiptSameBar.assessment = null;
const sameBarExit = applyPaperCycle(newReceiptSameBar); same(sameBarExit.decision.code, "STOP_LOSS_EXIT"); same(sameBarExit.fill.quantity, 50);
same(sameBarExit.fill.fillPrice, 197, "A stop crossing fills the observed gap price, not the nominal stop");
same(sameBarExit.account.cash, 99850); same(sameBarExit.account.realizedPnl, -150);

for (const mutate of [value => { value.assessment = null; }, value => { value.assessment.confidence = 21; value.assessment.skepticVeto = true; }, value => { value.controls.paused = true; value.controls.autonomous = false; }, value => { value.policy.allowedSymbols = ["AAPL"]; }, value => { value.policy.maxTradesPerDay = 1; }]) {
  const value = next(entry); value.quote.price = 197; value.proposal = null; mutate(value);
  const output = applyPaperCycle(value); same(output.decision.code, "STOP_LOSS_EXIT"); same(output.decision.protective, true); same(output.fill.side, "SELL");
}
const killedStop = next(entry); killedStop.quote.price = 197; killedStop.controls.killSwitch = true;
same(applyPaperCycle(killedStop).decision.code, "KILL_SWITCH"); same(applyPaperCycle(killedStop).account.position, entry.account.position);
const staleStop = next(entry, 360000); staleStop.quote.price = 197; staleStop.quote.observedAt = initial.quote.observedAt;
same(applyPaperCycle(staleStop).decision.code, "QUOTE_TOO_OLD", "A protective exit never invents a fresh price");
const manualExit = next(entry); manualExit.proposal.action = "sell"; manualExit.controls.autonomous = false; manualExit.controls.paused = true; manualExit.assessment = null;
same(applyPaperCycle(manualExit).decision.code, "APPROVAL_REQUIRED"); manualExit.approved = true;
same(applyPaperCycle(manualExit).decision.code, "PAPER_SELL");
const win = next(entry); win.quote.price = 204; win.proposal.action = "hold";
same(applyPaperCycle(win).decision.code, "TAKE_PROFIT_EXIT"); same(applyPaperCycle(win).account.realizedPnl, 200);
const duration = next(entry, 90 * 60000); duration.proposal.action = "hold";
same(applyPaperCycle(duration).decision.code, "HOLDING_TIME_EXIT");
const closeWindow = next(entry, 355 * 60000); closeWindow.proposal.action = "hold";
same(applyPaperCycle(closeWindow).decision.code, "SESSION_END_EXIT");
const closingEntry = fixture(); closingEntry.now = iso(355 * 60000); closingEntry.quote.observedAt = closingEntry.quote.retrievedAt = closingEntry.now;
same(applyPaperCycle(closingEntry).decision.code, "SESSION_END_ENTRY_BLOCK");

const trailPolicy = cleanPolicy(); trailPolicy.takeProfitPct = null; trailPolicy.trailingStopPct = .5;
const trailEntry = applyPaperCycle(fixture({ policy: trailPolicy }));
const up = next(trailEntry); up.policy = trailPolicy; up.quote.price = 204; up.proposal.action = "hold";
const peak = applyPaperCycle(up); same(peak.account.position.peakPrice, 204); same(peak.fill, null);
const back = next(peak, 120000); back.policy = trailPolicy; back.quote.price = 202; back.proposal.action = "hold";
same(applyPaperCycle(back).decision.code, "TRAILING_STOP_EXIT");
const looser = next(entry); looser.policy.stopLossPct = 20; looser.quote.price = 197; looser.proposal.action = "hold";
same(applyPaperCycle(looser).decision.code, "STOP_LOSS_EXIT", "A policy edit cannot loosen the open position's saved stop");
const tighterPolicy = next(entry); tighterPolicy.policy.stopLossPct = .25; tighterPolicy.quote.price = 199; tighterPolicy.proposal.action = "hold";
same(applyPaperCycle(tighterPolicy).decision.code, "STOP_LOSS_EXIT");
const laterClose = next(entry, 355 * 60000); laterClose.policy.flattenBeforeCloseMinutes = 1; laterClose.proposal.action = "hold";
same(applyPaperCycle(laterClose).decision.code, "SESSION_END_EXIT", "The saved closing window cannot be weakened while a position is open");

const lost = next(entry); lost.quote.price = 150; lost.proposal = null;
const circuit = applyPaperCycle(lost); same(circuit.decision.code, "DAILY_LOSS_EXIT"); same(circuit.account.session.lossHalted, true);
const retry = next(circuit, 600000); retry.policy.maxDailyLossPct = 20;
same(applyPaperCycle(retry).decision.code, "DAILY_LOSS_HALT", "A raised setting cannot silently unlatch an observed daily loss circuit");
const dayTwo = next(circuit, 24 * 3600000); dayTwo.assessment.evaluatedAt = dayTwo.now;
const resumed = applyPaperCycle(dayTwo); same(resumed.decision.status, "filled"); same(resumed.account.session.lossHalted, false); same(resumed.account.session.trades, 1); same(resumed.account.session.openingEquity, circuit.account.cash);
const overnight = next(entry, 24 * 3600000); overnight.proposal.action = "sell"; overnight.approved = true;
same(applyPaperCycle(overnight).decision.code, "OVERNIGHT_POSITION_REVIEW"); same(applyPaperCycle(overnight).fill, null, "No fabricated corporate action or missed-close execution");
const limitPolicy = cleanPolicy(); limitPolicy.maxTradesPerDay = 1;
const cappedEntry = applyPaperCycle(fixture({ policy: limitPolicy }));
const capExitInput = next(cappedEntry); capExitInput.policy = limitPolicy; capExitInput.proposal.action = "sell";
const capExit = applyPaperCycle(capExitInput); same(capExit.decision.status, "filled"); same(capExit.account.session.trades, 2, "Position reduction stays available after daily entry limit");
const capRetry = next(capExit, 600000); capRetry.policy = limitPolicy;
same(applyPaperCycle(capRetry).decision.code, "DAILY_TRADE_LIMIT");
const cooldown = next(sameBarExit, 120000); same(applyPaperCycle(cooldown).decision.code, "ENTRY_COOLDOWN");
const tiny = fixture(); tiny.quote.price = tiny.proposal.referencePrice = 0.000001;
const tinyEntry = applyPaperCycle(tiny); const tinyHold = next(tinyEntry); tinyHold.quote.price = 0.000001; tinyHold.proposal.action = "hold";
same(applyPaperCycle(tinyHold).decision.code, "HOLD", "Relative trigger tolerance never turns an unchanged low-price observation into a false stop or profit exit");

// Costs, whole-share sizing, and accounting invariant across bounded variations.
for (const capital of [1000, 10000, 100000]) for (const price of [3.27, 89.99, 525.37]) for (const slip of [0, 5, 100]) {
  const policy = cleanPolicy(); policy.slippageBps = slip; policy.feeBps = 10; policy.commissionUsd = 1.25;
  const value = fixture({ policy, account: createPaperAccount({ initialCapital: capital, now: iso() }) }); value.quote.price = value.proposal.referencePrice = price;
  const bought = applyPaperCycle(value);
  same(JSON.stringify(value.account), JSON.stringify(createPaperAccount({ initialCapital: capital, now: iso() })), "Input account remains immutable");
  if (bought.fill) {
    yes(Number.isSafeInteger(bought.fill.quantity) && bought.fill.quantity > 0);
    yes(bought.account.cash >= 0); yes(bought.account.cash / bought.equity * 100 >= policy.minCashPct - 1e-7);
    yes(bought.account.position.quantity * price / bought.equity * 100 <= policy.maxPositionPct + 1e-7);
    yes(bought.fill.fillPrice >= price); yes(bought.fill.fees >= 1.25);
    const sell = next(bought); sell.policy = policy; sell.quote.price = price; sell.proposal.action = "sell";
    const sold = applyPaperCycle(sell); same(sold.decision.status, "filled"); same(sold.account.position, null);
    yes(sold.account.realizedPnl < 0, "Unchanged underlying price cannot create a net profit after costs");
    yes(Math.abs(sold.account.cash - capital - sold.account.realizedPnl) < 1e-5);
    yes(Math.abs(sold.account.feesPaid - bought.fill.fees - sold.fill.fees) < 1e-5);
    validatePaperAccount(sold.account);
  } else yes(["INSUFFICIENT_CAPITAL", "ENTRY_COSTS_EXCEED_LOSS_BUDGET"].includes(bought.decision.code));
}
for (const mutate of [
  value => { value.cash += 1; }, value => { value.cash = -1; }, value => { value.realizedPnl = NaN; },
  value => { value.session.trades = -1; }, value => { value.session.date = "2026-02-30"; },
  value => { value.sequence = -1; }, value => { value.lastCycleId = "bad id"; }, value => { value.lastCycleAt = null; },
  value => { value.position.quantity = .5; }, value => { value.position.averageEntry = 0; }, value => { value.position.openedAt = iso(3600000); },
  value => { value.lastFillRetrievedAt = null; }, value => { value.lastObservedPrice = null; },
]) { const account = clone(entry.account); mutate(account); throws(() => validatePaperAccount(account), "INVALID_ACCOUNT"); }
console.log(`Agent Desk guardrails: ${checks} deterministic checks passed (paper-only accounting, entry/exit controls, confidence and data gates, costs, replay fences, session loss limits, and immutable receipts; no broker/network calls).`);
