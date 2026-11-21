import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const require = createRequire(import.meta.url), ts = require("typescript");
const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
let checks = 0;
const same = (actual, expected, label) => { assert.deepEqual(actual, expected, label); checks += 1; };
const yes = (value, label) => { assert.ok(value, label); checks += 1; };
const rejects = async (fn, code) => { await assert.rejects(fn, error => error.code === code); checks += 1; };
const throws = (fn, code) => { assert.throws(fn, error => error.code === code); checks += 1; };
const clone = value => structuredClone(value);
const scope = { userId: "founder-test", firmId: "firm-test" };
let authorized = true, sequence = 0, rows = [], transactionQueue = Promise.resolve(), pauseAtEnableCommit = false;
function matches(row, where) { return Object.entries(where).every(([key, value]) => value && typeof value === "object" ? ("in" in value ? value.in.includes(row[key]) : "not" in value ? row[key] !== value.not : false) : row[key] === value); }
const events = {
  findFirst: async ({ where }) => clone(rows.find(row => matches(row, where)) ?? null),
  findMany: async ({ where, take }) => clone(rows.filter(row => matches(row, where)).reverse().slice(0, take)),
  upsert: async ({ where, create }) => { const match = rows.find(row => row.userId === where.userId_eventKey.userId && row.eventKey === where.userId_eventKey.eventKey); return clone(match ?? await events.create({ data: create })); },
  create: async ({ data }) => { if (rows.some(row => row.userId === data.userId && row.eventKey === data.eventKey)) { const error = new Error("unique"); error.code = "P2002"; throw error; } const row = { ...clone(data), id: `event-${++sequence}`, createdAt: new Date(), updatedAt: new Date() }; rows.push(row); return clone(row); },
  updateMany: async ({ where, data }) => {
    if (pauseAtEnableCommit && data.metadataJson) {
      const envelope = JSON.parse(JSON.parse(data.metadataJson).payload);
      if (envelope.kind === "state" && envelope.value.controls.enabled) {
        pauseAtEnableCommit = false; desk.state.revision += 1; desk.state.brokerPausedAtRevision = desk.state.revision;
      }
    }
    let count = 0; rows = rows.map(row => matches(row, where) ? (count++, { ...row, ...clone(data), updatedAt: new Date() }) : row); return { count };
  },
};
const prisma = { backendPlatformEvent: events, $transaction: async callback => {
  const next = transactionQueue.then(async () => { const before = clone(rows); try { return await callback({ backendPlatformEvent: events }); } catch (error) { rows = before; throw error; } });
  transactionQueue = next.catch(() => undefined); return next;
} };
const board = new Map();
let desk = { state: { revision: 1, latestCycleId: "cycle-1", controls: { killSwitch: false } } };
let cycleReceipt;
const cache = new Map();
const stubs = {
  "server-only": {}, "@/lib/prisma": { prisma },
  "@/lib/agent-desk/access": { requireAgentDeskAccess: async () => { if (!authorized) { const error = new Error("Founder revoked"); error.code = "FOUNDER_AGENT_ACCESS_REQUIRED"; throw error; } return {}; } },
  "@/lib/agent-desk/store": { readDeskRecord: async () => clone(desk), readDeskCycle: async (_scope, id) => id === cycleReceipt?.cycle.id ? clone(cycleReceipt) : null },
  "@/lib/agent-desk/collaboration": { appendAgentBoardMessage: async (_scope, message) => { if (!board.has(message.id)) board.set(message.id, clone(message)); } },
};
function load(file) {
  const path = resolve(root, file); if (cache.has(path)) return cache.get(path).exports;
  const module = { exports: {} }; cache.set(path, module);
  const source = readFileSync(path, "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
  assert.equal(compiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);
  const localRequire = id => Object.hasOwn(stubs, id) ? stubs[id] : id.startsWith("@/") ? load(`src/${id.slice(2)}.ts`) : id.startsWith(".") ? load(resolve(dirname(path), `${id}.ts`)) : require(id);
  new Function("module", "exports", "require", compiled.outputText)(module, module.exports, localRequire);
  return module.exports;
}
const contracts = load("src/lib/agent-broker/contracts.ts"), crypt = load("src/lib/agent-broker/crypto.ts"), validators = load("src/lib/agent-broker/validation.ts");
const { DEFAULT_BROKER_POLICY: defaults } = contracts;
const fakeKey = "PK_TEST_FOUNDER_000000000001", fakeSecret = "FAKE_SECRET_FOR_CONTROLLED_TESTS_000000000000000001";
const oldEncryption = process.env.SLICE_BROKER_ENCRYPTION_KEY, oldLive = process.env.SLICE_BROKER_LIVE_ENABLED, oldFetch = globalThis.fetch;
process.env.SLICE_BROKER_ENCRYPTION_KEY = "a1".repeat(32); delete process.env.SLICE_BROKER_LIVE_ENABLED;
try {
  const credentials = { key: fakeKey, secret: fakeSecret };
  const encrypted = crypt.encryptBrokerCredentials(scope, "paper", credentials);
  same(crypt.decryptBrokerCredentials(scope, "paper", encrypted), credentials, "Encrypted credentials round trip only in their exact owner/firm/mode scope");
  yes(!encrypted.includes(fakeKey) && !encrypted.includes(fakeSecret));
  for (const [otherScope, mode] of [[{ ...scope, userId: "someone-else" }, "paper"], [{ ...scope, firmId: "another-firm" }, "paper"], [scope, "live"]]) throws(() => crypt.decryptBrokerCredentials(otherScope, mode, encrypted), "BROKER_CREDENTIALS_UNREADABLE");
  throws(() => crypt.decryptBrokerCredentials(scope, "paper", `${encrypted.slice(0, -5)}AAAAA`), "BROKER_CREDENTIALS_UNREADABLE");
  process.env.SLICE_BROKER_ENCRYPTION_KEY = "not-an-encryption-key";
  throws(() => crypt.encryptBrokerCredentials(scope, "paper", credentials), "BROKER_ENCRYPTION_REQUIRED");
  process.env.SLICE_BROKER_ENCRYPTION_KEY = "a1".repeat(32);
  same(validators.validateBrokerPolicy(defaults), defaults);
  for (const patch of [{ maxOrderUsd: Infinity }, { minCashPct: 0 }, { maxPositionPct: 90 }, { minResearchConfidence: 39 }, { allowedSymbols: ["MSFT", "MSFT"] }, { allowedSymbols: ["https://attacker.test"] }, { feed: "delayed_sip" }, { shorting: true }]) throws(() => validators.validateBrokerPolicy({ ...defaults, ...patch }), "INVALID_BROKER_POLICY");

  let brokerOrders = [], positions = [], postCount = 0, cancellationCount = 0, fault = null, afterCancel = null;
  const calls = [];
  const account = () => ({ id: "account-test-001", account_number: "12345678", status: "ACTIVE", currency: "USD", cash: "100000", equity: "100000", last_equity: "100000", buying_power: "400000", non_marginable_buying_power: "100000", trading_blocked: false, account_blocked: false, trade_suspended_by_user: false, pattern_day_trader: false, daytrade_count: 0 });
  const clock = () => ({ timestamp: new Date().toISOString(), is_open: true, next_open: new Date(Date.now() + 86_400_000).toISOString(), next_close: new Date(Date.now() + 3_600_000).toISOString() });
  const json = value => new Response(JSON.stringify(value), { status: 200, headers: { "Content-Type": "application/json" } });
  function rawOrder(request, id, extras = {}) {
    return { id, client_order_id: request.client_order_id, symbol: request.symbol, side: request.side, type: request.type, order_class: request.order_class, status: "new", qty: request.qty, filled_qty: "0", filled_avg_price: null,
      submitted_at: new Date().toISOString(), updated_at: new Date().toISOString(), filled_at: null, limit_price: request.limit_price ?? null, stop_price: null, legs: null, ...extras };
  }
  globalThis.fetch = async (input, options = {}) => {
    const url = new URL(input); calls.push({ url: url.href, method: options.method, redirect: options.redirect });
    if (!new Set(["https://paper-api.alpaca.markets", "https://api.alpaca.markets", "https://data.alpaca.markets"]).has(url.origin)) throw new Error("Unexpected external network: test forbidden");
    if (options.method === "POST") {
      postCount += 1;
      if (fault === "unknown-post") throw new Error(`simulated transport failure containing ${fakeSecret}`);
      const request = JSON.parse(options.body), order = rawOrder(request, `order-${postCount}`);
      if (request.side === "buy") order.legs = [rawOrder({ ...request, client_order_id: `${request.client_order_id}_tp`, side: "sell", type: "limit", order_class: "simple" }, `target-${postCount}`), rawOrder({ ...request, client_order_id: `${request.client_order_id}_sl`, side: "sell", type: "stop", order_class: "simple" }, `stop-${postCount}`)];
      else { order.status = "filled"; order.filled_qty = order.qty; order.filled_avg_price = "101.00"; order.filled_at = new Date().toISOString(); positions = []; }
      brokerOrders.push(order);
      if (fault === "accepted-then-lost") throw new Error("lost response after acceptance");
      return json(order);
    }
    if (options.method === "DELETE") {
      cancellationCount += 1; const id = url.pathname.split("/").at(-1);
      for (const parent of brokerOrders) for (const order of [parent, ...(parent.legs ?? [])]) if (order.id === id && order.status !== "filled") order.status = "canceled";
      if (afterCancel) { const callback = afterCancel; afterCancel = null; await callback(); }
      return new Response(null, { status: 204 });
    }
    if (url.pathname === "/v2/account") return json(account());
    if (url.pathname === "/v2/positions") return json(positions);
    if (url.pathname === "/v2/clock") return json(clock());
    if (url.pathname === "/v2/orders") return json(brokerOrders.filter(order => order.status === "new" || order.legs?.some(leg => leg.status === "new")));
    if (url.pathname === "/v2/orders:by_client_order_id") { const order = brokerOrders.find(row => row.client_order_id === url.searchParams.get("client_order_id")); return order ? json(order) : new Response(null, { status: 404 }); }
    if (url.pathname.startsWith("/v2/orders/")) { const order = brokerOrders.find(row => row.id === url.pathname.split("/").at(-1)); return order ? json(order) : new Response(null, { status: 404 }); }
    if (url.pathname.startsWith("/v2/assets/")) return json({ symbol: url.pathname.split("/").at(-1), tradable: true, status: "active", class: "us_equity", exchange: "NASDAQ" });
    if (url.pathname.includes("/quotes/latest")) {
      if (fault === "sip-denied") return new Response(null, { status: 403 });
      if (fault === "revoke-on-quote") authorized = false;
      if (fault === "pause-on-quote") { desk.state.revision += 1; desk.state.brokerPausedAtRevision = desk.state.revision; }
      return json({ symbol: url.pathname.split("/")[3], quote: { bp: 99.99, ap: 100, t: new Date().toISOString() } });
    }
    throw new Error(`Unmocked URL ${url.pathname}`);
  };
  const alpaca = load("src/lib/agent-broker/alpaca.ts"), storage = load("src/lib/agent-broker/store.ts"), guards = load("src/lib/agent-broker/guardrails.ts"), service = load("src/lib/agent-broker/service.ts");
  throws(() => alpaca.parseAccount({ ...account(), trading_blocked: undefined }), "BROKER_RESPONSE_INVALID");
  throws(() => alpaca.parseAccount({ ...account(), cash: "Infinity" }), "BROKER_RESPONSE_INVALID");
  const protectedClient = new alpaca.AlpacaClient("paper", credentials);
  await rejects(() => protectedClient.quote("../../account", "iex"), "BROKER_RESPONSE_INVALID");
  const failedClient = new alpaca.AlpacaClient("paper", credentials, async () => new Response(fakeSecret, { status: 403 }));
  try { await failedClient.account(); assert.fail("Expected denial"); } catch (error) { yes(!error.message.includes(fakeSecret), "Provider raw body is never exposed"); }
  const largeClient = new alpaca.AlpacaClient("paper", credentials, async () => new Response("{}", { headers: { "content-length": "3000000" } }));
  await rejects(() => largeClient.account(), "BROKER_RESPONSE_INVALID");
  authorized = false; await rejects(() => service.getBrokerView(scope), "FOUNDER_AGENT_ACCESS_REQUIRED"); authorized = true;
  let view = await service.getBrokerView(scope);
  same(view.mode, "paper"); same(view.controls.enabled, false);
  const initialRequests = calls.length; await service.getBrokerView(scope); same(calls.length, initialRequests, "GET view performs no provider polling");
  await service.applyBrokerCommand(scope, { action: "connect", revision: view.revision, mode: "paper", apiKey: fakeKey, apiSecret: fakeSecret });
  view = await service.getBrokerView(scope); same(view.connected, true); same(view.controls.enabled, false); same(view.account.numberMasked, "••••5678");
  yes(!JSON.stringify(view).includes(fakeKey) && !JSON.stringify(view).includes(fakeSecret), "View never returns credentials");
  yes(!rows.some(row => row.metadataJson.includes(fakeKey) || row.metadataJson.includes(fakeSecret)), "At-rest records never contain plaintext credentials");
  await rejects(() => service.applyBrokerCommand(scope, { action: "enable-paper", revision: view.revision, autonomous: true, acknowledgement: "yes" }), "BROKER_ACKNOWLEDGEMENT_REQUIRED");
  await service.applyBrokerCommand(scope, { action: "enable-paper", revision: view.revision, autonomous: true, acknowledgement: "ENABLE PAPER TRADING" });
  view = await service.getBrokerView(scope); same(view.controls.enabled, true);
  const marketCredentials = await service.getFounderMarketCredentials(scope); same(marketCredentials.mode, "paper"); same(marketCredentials.revision, 1);
  await service.applyBrokerCommand(scope, { action: "refresh", revision: 0 }); same((await service.getFounderMarketCredentials(scope)).revision, 1, "Refreshing does not rotate stream credentials");
  const observation = await service.getBrokerResearchObservation(scope, "MSFT"); same(observation.feed, "iex"); same(observation.marketOpen, true);
  const fixture = (id = "cycle-1") => ({ cycle: { id, symbol: "MSFT", status: "blocked", settingsRevision: 1, brokerContextRevision: view.revision, executionTarget: "alpaca-paper", completedAt: new Date().toISOString(), researchRunId: "research-test",
    proposal: { action: "buy", symbol: "MSFT", referencePrice: 100, allocationPct: 5 }, deliberation: { complete: true, reports: 12, rounds: 2 }, helpers: [],
    agents: ["chief", "sentiment", "scout", "news", "skeptic", "charts"].map(role => ({ role, status: "complete", veto: false, action: role === "chief" ? "buy" : "hold" })) },
    assessment: { evidenceVerified: true, allAgentsCompleted: true, skepticVeto: false, confidence: 80, coverage: 85, researchRunId: "research-test" } });
  cycleReceipt = fixture();
  const { state: fixtureState } = await storage.readBrokerRecord(scope);
  const quote = { symbol: "MSFT", bid: 99.99, ask: 100, timestamp: new Date().toISOString(), feed: "iex" };
  const build = extras => guards.buildBrokerEntry({ receipt: clone(cycleReceipt), policy: clone(defaults), snapshot: clone(fixtureState.snapshot), quote: clone(quote), asset: { symbol: "MSFT", tradable: true, status: "active", assetClass: "us_equity", exchange: "NASDAQ" }, clientOrderId: "slice_fixture", entriesToday: 0, ...extras });
  same(build({}).position_intent, "buy_to_open"); same(build({}).order_class, "bracket");
  throws(() => build({ quote: { ...quote, timestamp: new Date(Date.now() - 60_000).toISOString() } }), "BROKER_QUOTE_UNUSABLE");
  throws(() => build({ quote: { ...quote, ask: 105 } }), "BROKER_SPREAD_TOO_WIDE");
  throws(() => build({ snapshot: { ...fixtureState.snapshot, positions: [{ symbol: "AAPL" }] } }), "BROKER_EXISTING_EXPOSURE");
  throws(() => build({ entriesToday: 20 }), "BROKER_DAILY_TRADE_LIMIT");
  const failedHelper = clone(cycleReceipt); failedHelper.cycle.helpers = [{ report: { status: "failed", veto: false } }];
  throws(() => build({ receipt: failedHelper }), "BROKER_RESEARCH_INCOMPLETE");
  const veto = clone(cycleReceipt); veto.assessment.skepticVeto = true; throws(() => build({ receipt: veto }), "BROKER_RESEARCH_INCOMPLETE");
  const incomplete = clone(cycleReceipt); incomplete.cycle.deliberation.reports = 6; throws(() => build({ receipt: incomplete }), "BROKER_RESEARCH_INCOMPLETE");
  const future = clone(cycleReceipt); future.cycle.completedAt = new Date(Date.now() + 60_000).toISOString(); throws(() => build({ receipt: future }), "BROKER_DECISION_STALE");
  const riskExit = clone(failedHelper); riskExit.cycle.proposal.action = "sell"; riskExit.cycle.agents.find(agent => agent.role === "chief").action = "sell"; riskExit.assessment = null;
  guards.assertChiefReceipt(riskExit, defaults); yes(true, "A completed current Chief may reduce owned risk when entry evidence is insufficient");
  cycleReceipt.cycle.executionTarget = "local-simulation";
  same((await service.submitChiefBrokerProposal(scope, { cycleId: "cycle-1" })).code, "BROKER_CONTEXT_CHANGED"); same(postCount, 0);
  cycleReceipt.cycle.executionTarget = "alpaca-paper";
  fault = "revoke-on-quote";
  await rejects(() => service.submitChiefBrokerProposal(scope, { cycleId: "cycle-1" }), "FOUNDER_AGENT_ACCESS_REQUIRED"); same(postCount, 0, "Revocation after quote retrieval prevents the order");
  authorized = true; fault = null;
  const outcomes = await Promise.all([service.submitChiefBrokerProposal(scope, { cycleId: "cycle-1" }), service.submitChiefBrokerProposal(scope, { cycleId: "cycle-1" })]);
  same(postCount, 1, "Concurrent requests reserve once and submit exactly one broker order"); yes(outcomes.some(item => item.status === "accepted"));
  view = await service.getBrokerView(scope); same(view.pendingIntent.status, "accepted"); same(view.recentFills.length, 0, "Acceptance never creates a fill");
  const entry = brokerOrders[0]; entry.status = "filled"; entry.filled_qty = entry.qty; entry.filled_avg_price = entry.limit_price; entry.filled_at = new Date().toISOString();
  positions = [{ symbol: "MSFT", qty: entry.qty, qty_available: entry.qty, side: "long", avg_entry_price: entry.limit_price, current_price: "100", market_value: String(Number(entry.qty) * 100), unrealized_pl: "0" }];
  await service.runBrokerMonitoring(scope);
  view = await service.getBrokerView(scope); same(view.activePositionSymbol, "MSFT"); same(view.pendingIntent, null); same(view.recentFills.length, 1); same(view.recentFills[0].classification, "broker-paper"); same(view.recentFills[0].netRealizedPnl, null);
  await service.runBrokerMonitoring(scope); same((await service.getBrokerView(scope)).recentFills.length, 1, "Repeated reconciliation deduplicates cumulative fill observations"); same(board.size, 1);
  positions[0].qty = String(Number(entry.qty) + 1);
  same((await service.runBrokerMonitoring(scope)).code, "BROKER_EXPOSURE_MISMATCH"); same(postCount, 1, "External position changes block automatic sales"); positions[0].qty = entry.qty;
  const ownedRecord = await storage.readBrokerRecord(scope); ownedRecord.state.ownedPosition.openedAt = new Date(Date.now() - 120 * 60_000).toISOString();
  await storage.replaceBrokerRecord(scope, ownedRecord, ownedRecord.state);
  await Promise.all([service.runBrokerMonitoring(scope), service.runBrokerMonitoring(scope)]);
  await service.runBrokerMonitoring(scope);
  same(postCount, 2, "Holding limit closes only the verified owned position"); yes(cancellationCount >= 2, "Native protection is canceled and confirmed before the close");
  same(brokerOrders[1].side, "sell");
  view = await service.getBrokerView(scope); same(view.activePositionSymbol, null); same(view.recentFills.length, 2); yes(view.recentFills.some(fill => fill.grossRealizedPnl > 0 && fill.netRealizedPnl === null));
  await service.submitChiefBrokerProposal(scope, { cycleId: "cycle-1" }); same(postCount, 2, "A consumed Chief cycle cannot submit twice after closing");

  cycleReceipt = fixture("cycle-2"); desk.state.latestCycleId = "cycle-2"; fault = "unknown-post";
  const uncertain = await service.submitChiefBrokerProposal(scope, { cycleId: "cycle-2" }); same(uncertain.status, "uncertain"); same(postCount, 3);
  yes(!uncertain.message.includes(fakeSecret));
  await service.submitChiefBrokerProposal(scope, { cycleId: "cycle-2" }); await service.runBrokerMonitoring(scope); same(postCount, 3, "Ambiguous order plus 404 lookup is never blindly resubmitted");
  view = await service.getBrokerView(scope); same(view.pendingIntent.status, "uncertain");
  await service.applyBrokerCommand(scope, { action: "pause", revision: 0 }); same((await service.getBrokerView(scope)).controls.enabled, false, "Stale tabs can always reduce execution permissions");
  view = await service.getBrokerView(scope);
  await rejects(() => service.applyBrokerCommand(scope, { action: "connect", revision: view.revision, mode: "live", apiKey: fakeKey, apiSecret: fakeSecret }), "BROKER_EXPOSURE_PENDING");
  await service.applyBrokerCommand(scope, { action: "disconnect", revision: view.revision });
  view = await service.getBrokerView(scope); same(view.connected, false); same(view.pendingIntent.status, "uncertain"); same(await service.getFounderMarketCredentials(scope), null, "Disconnect revokes all worker credential reads");
  yes(calls.every(call => call.redirect === "error"), "Every provider HTTP call prohibits redirects");
  same(calls.some(call => call.url.startsWith("https://api.alpaca.markets")), false, "Controlled tests never send an order to a live origin");

  async function preparePaper(testScope, id) {
    brokerOrders = []; positions = []; fault = null;
    await service.applyBrokerCommand(testScope, { action: "connect", revision: 0, mode: "paper", apiKey: fakeKey, apiSecret: fakeSecret });
    await service.applyBrokerCommand(testScope, { action: "enable-paper", revision: 1, autonomous: true, acknowledgement: "ENABLE PAPER TRADING" });
    cycleReceipt = fixture(id); cycleReceipt.cycle.brokerContextRevision = 2; desk.state.latestCycleId = id;
    await service.submitChiefBrokerProposal(testScope, { cycleId: id });
    return brokerOrders.at(-1);
  }
  function heldPosition(order, quantity = order.qty) {
    positions = [{ symbol: "MSFT", qty: String(quantity), qty_available: String(quantity), side: "long", avg_entry_price: order.limit_price, current_price: "100", market_value: String(Number(quantity) * 100), unrealized_pl: "0" }];
  }
  const partialScope = { userId: "founder-partial", firmId: scope.firmId };
  const partial = await preparePaper(partialScope, "cycle-partial"); const beforePartial = postCount;
  partial.status = "partially_filled"; partial.filled_qty = "1"; partial.filled_avg_price = partial.limit_price; heldPosition(partial, 1);
  await service.applyBrokerCommand(partialScope, { action: "pause", revision: 2 });
  await service.runBrokerMonitoring(partialScope);
  same(postCount, beforePartial + 1, "A partial entry cancels the remainder and closes only its observed owned share, even while new entries are paused");
  same(brokerOrders.at(-1).qty, "1"); same(brokerOrders.at(-1).side, "sell"); same((await service.getBrokerView(partialScope)).activePositionSymbol, null);

  const revokedScope = { userId: "founder-revoked-key", firmId: scope.firmId };
  const revokeEntry = await preparePaper(revokedScope, "cycle-revoke"); revokeEntry.status = "filled"; revokeEntry.filled_qty = revokeEntry.qty; revokeEntry.filled_avg_price = revokeEntry.limit_price; revokeEntry.filled_at = new Date(Date.now() - 120 * 60_000).toISOString(); heldPosition(revokeEntry);
  // Revoke credentials during cancellation. No subsequent cancellation or closing POST may use the old key.
  const beforeRevoke = postCount;
  afterCancel = async () => { const current = await service.getBrokerView(revokedScope); await service.applyBrokerCommand(revokedScope, { action: "disconnect", revision: current.revision }); };
  same((await service.runBrokerMonitoring(revokedScope)).code, "BROKER_CONNECTION_CHANGED");
  same(postCount, beforeRevoke); same((await service.getBrokerView(revokedScope)).connected, false);

  const racedScope = { userId: "founder-exit-race", firmId: scope.firmId };
  const raceEntry = await preparePaper(racedScope, "cycle-race"); raceEntry.status = "filled"; raceEntry.filled_qty = raceEntry.qty; raceEntry.filled_avg_price = raceEntry.limit_price; raceEntry.filled_at = new Date(Date.now() - 120 * 60_000).toISOString(); heldPosition(raceEntry);
  const beforeRace = postCount;
  afterCancel = async () => { raceEntry.legs[1].status = "filled"; raceEntry.legs[1].filled_qty = raceEntry.qty; raceEntry.legs[1].filled_avg_price = "99.00"; raceEntry.legs[1].filled_at = new Date().toISOString(); positions = []; };
  await service.runBrokerMonitoring(racedScope); await service.runBrokerMonitoring(racedScope);
  same(postCount, beforeRace, "A protective exit racing cancellation prevents a duplicate sale or a short"); same((await service.getBrokerView(racedScope)).activePositionSymbol, null);

  brokerOrders = []; positions = []; fault = null;
  const liveScope = { userId: "founder-live-gates", firmId: scope.firmId };
  await service.applyBrokerCommand(liveScope, { action: "connect", revision: 0, mode: "live", apiKey: fakeKey, apiSecret: fakeSecret });
  await rejects(() => service.applyBrokerCommand(liveScope, { action: "enable-live", revision: 1, autonomous: true, acknowledgement: "ENABLE LIVE TRADING" }), "BROKER_NOT_READY");
  process.env.SLICE_BROKER_LIVE_ENABLED = "true";
  await rejects(() => service.applyBrokerCommand(liveScope, { action: "enable-live", revision: 1, autonomous: true, acknowledgement: "ENABLE LIVE TRADING" }), "BROKER_NOT_READY");
  await service.applyBrokerCommand(liveScope, { action: "settings", revision: 1, policy: { ...defaults, feed: "sip" } });
  fault = "sip-denied";
  await rejects(() => service.applyBrokerCommand(liveScope, { action: "enable-live", revision: 2, autonomous: true, acknowledgement: "ENABLE LIVE TRADING" }), "BROKER_ACCESS_DENIED");
  same((await service.getBrokerView(liveScope)).controls.enabled, false, "A SIP checkbox cannot bypass actual subscription verification");
  fault = null;
  await service.applyBrokerCommand(liveScope, { action: "enable-live", revision: 2, autonomous: true, acknowledgement: "ENABLE LIVE TRADING" });
  delete process.env.SLICE_BROKER_LIVE_ENABLED;
  same((await service.submitChiefBrokerProposal(liveScope, { cycleId: "cycle-race" })).code, "BROKER_LIVE_DISABLED");
  same(calls.filter(call => call.url.startsWith("https://api.alpaca.markets") && call.method === "POST").length, 0, "Even simulated live connection tests never issue a live order POST");

  // The root desk pause is authoritative even when the separate broker pause write fails entirely.
  brokerOrders = []; positions = []; fault = null;
  desk.state = { revision: 1, latestCycleId: "cycle-durable-pause", controls: { killSwitch: false } };
  const epochScope = { userId: "founder-pause-epoch", firmId: scope.firmId };
  await service.applyBrokerCommand(epochScope, { action: "connect", revision: 0, mode: "paper", apiKey: fakeKey, apiSecret: fakeSecret });
  await service.applyBrokerCommand(epochScope, { action: "enable-paper", revision: 1, autonomous: true, acknowledgement: "ENABLE PAPER TRADING" });
  same((await storage.readBrokerRecord(epochScope)).state.deskRevisionAtEnable, 1);
  desk.state.revision = 2; desk.state.brokerPausedAtRevision = 2;
  same((await storage.readBrokerRecord(epochScope)).state.controls.enabled, true, "Fixture deliberately leaves the broker pause write unapplied");
  same((await service.getBrokerView(epochScope)).controls.enabled, false, "The persisted desk epoch overrides the stale enabled broker row");
  cycleReceipt = fixture("cycle-durable-pause"); cycleReceipt.cycle.settingsRevision = 2; cycleReceipt.cycle.brokerContextRevision = 2;
  const beforeDurablePause = postCount;
  same((await service.submitChiefBrokerProposal(epochScope, { cycleId: "cycle-durable-pause" })).code, "BROKER_DESK_PAUSED"); same(postCount, beforeDurablePause);
  // A pause between account refresh and feed entitlement completion prevents the activation CAS.
  const activationScope = { userId: "founder-activation-race", firmId: scope.firmId };
  await service.applyBrokerCommand(activationScope, { action: "connect", revision: 0, mode: "paper", apiKey: fakeKey, apiSecret: fakeSecret });
  fault = "pause-on-quote";
  await rejects(() => service.applyBrokerCommand(activationScope, { action: "enable-paper", revision: 1, autonomous: true, acknowledgement: "ENABLE PAPER TRADING" }), "BROKER_ACTIVATION_SUPERSEDED");
  same((await storage.readBrokerRecord(activationScope)).state.controls.enabled, false);
  // A pause arriving after the final desk read but immediately before broker CAS still wins by epoch.
  fault = null; pauseAtEnableCommit = true;
  await service.applyBrokerCommand(activationScope, { action: "enable-paper", revision: 1, autonomous: true, acknowledgement: "ENABLE PAPER TRADING" });
  same((await storage.readBrokerRecord(activationScope)).state.controls.enabled, true);
  same((await service.getBrokerView(activationScope)).controls.paused, true, "A late activation cannot revive execution after a concurrent durable pause");
  // Explicit re-activation after reviewing the new epoch is permitted; another pause during entry preflight stops the reserved send.
  await service.applyBrokerCommand(activationScope, { action: "enable-paper", revision: 2, autonomous: true, acknowledgement: "ENABLE PAPER TRADING" });
  same((await service.getBrokerView(activationScope)).controls.enabled, true);
  cycleReceipt = fixture("cycle-pause-reservation"); cycleReceipt.cycle.settingsRevision = desk.state.revision; cycleReceipt.cycle.brokerContextRevision = 3; desk.state.latestCycleId = cycleReceipt.cycle.id;
  fault = "pause-on-quote";
  same((await service.submitChiefBrokerProposal(activationScope, { cycleId: cycleReceipt.cycle.id })).code, "BROKER_DESK_PAUSED");
  same(postCount, beforeDurablePause, "A durable pause after the initial research checks fences the final order send");
  const encoded = storage.encodeBrokerEnvelope(scope, "fixture", { ok: true });
  throws(() => storage.decodeBrokerEnvelope({ ...scope, firmId: "another-firm" }, "fixture", encoded), "BROKER_STORAGE_INVALID");
  console.log(`Agent broker: ${checks} assertions passed; encrypted owner isolation, immutable review gates, concurrent idempotency, real fill reconciliation, native exits, and ambiguous-order no-retry verified with fully mocked broker/database.`);
} finally {
  globalThis.fetch = oldFetch;
  if (oldEncryption === undefined) delete process.env.SLICE_BROKER_ENCRYPTION_KEY; else process.env.SLICE_BROKER_ENCRYPTION_KEY = oldEncryption;
  if (oldLive === undefined) delete process.env.SLICE_BROKER_LIVE_ENABLED; else process.env.SLICE_BROKER_LIVE_ENABLED = oldLive;
}
