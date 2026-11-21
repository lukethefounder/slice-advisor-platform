import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url), ts = require("typescript");
let checks = 0;
const equal = (a, b, label) => { assert.deepEqual(a, b, label); checks++; };
const ok = (a, label) => { assert.ok(a, label); checks++; };
const fail = (fn, code = "INVALID_MARKET_STREAM") => { assert.throws(fn, error => error.code === code); checks++; };
async function load(path, dependencies = {}) {
  const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8"), module = { exports: {} };
  const output = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, reportDiagnostics: true });
  equal(output.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0);
  new Function("require", "module", "exports", output.outputText)(name => name === "server-only" ? {} : name.startsWith("node:") ? require(name) : Object.hasOwn(dependencies, name) ? dependencies[name] : (() => { throw Error(`Unexpected dependency ${name}`); })(), module, module.exports); return module.exports;
}
const contracts = await load("src/lib/agent-desk/contracts.ts");
const core = await load("src/lib/agent-desk/market-stream-core.ts", { "./contracts": contracts });
const { validateMarketStreamInput, mergeMarketStream, marketStreamView } = core;
const now = "2026-11-20T15:00:00.000Z", time = offset => new Date(Date.parse(now) + offset).toISOString();
const quote = { symbol: "MSFT", bid: 100, ask: 100.02, observedAt: time(-200), receivedAt: time(-100) };
const batch = { id: "connection", userId: "founder", firmId: "firm", revision: 1, feed: "iex", status: "live", quotes: [quote] };
equal(validateMarketStreamInput(batch), batch);
for (const invalid of [null, [], { ...batch, apiKey: "forbidden" }, { ...batch, revision: -1 }, { ...batch, feed: "delayed_sip" }, { ...batch, status: "guaranteed-live" }, { ...batch, quotes: [quote, quote] }, { ...batch, quotes: [{ ...quote, bid: NaN }] }, { ...batch, quotes: [{ ...quote, ask: 99 }] }, { ...batch, quotes: [{ ...quote, observedAt: "tomorrow" }] }, { ...batch, quotes: [{ ...quote, authorization: "forbidden" }] }]) fail(() => validateMarketStreamInput(invalid));
const saved = mergeMarketStream(null, batch, ["MSFT"], now), view = marketStreamView(saved, now);
equal(view.status, "live"); equal(view.quotes[0].ageMs, 200); equal(view.quotes[0].transportLagMs, 100); equal(view.quotes[0].observedAt, quote.observedAt);
ok(Math.abs(view.quotes[0].mid - 100.01) < 1e-8); ok(view.quotes[0].spreadBps > 1.9 && view.quotes[0].spreadBps < 2.1);
equal(marketStreamView(saved, time(6_000)).status, "stale", "An open stream cannot make an old quote fresh");
equal(marketStreamView(saved, time(21_000)).status, "offline", "Missed worker heartbeats are visible");
equal(marketStreamView(null, now).quotes, []);
const heartbeat = mergeMarketStream(saved, { ...batch, quotes: [] }, ["MSFT"], time(10_000));
equal(heartbeat.quotes[0].observedAt, quote.observedAt); equal(marketStreamView(heartbeat, time(10_000)).status, "stale", "Heartbeat writes never retimestamp prices");
const older = mergeMarketStream(saved, { ...batch, quotes: [{ ...quote, bid: 90, ask: 91, observedAt: time(-500) }] }, ["MSFT"], now);
equal(older.quotes[0].bid, quote.bid, "Out-of-order data cannot replace a newer quote");
for (const changed of [{ ...quote, observedAt: time(3_000), receivedAt: time(3_100) }, { ...quote, receivedAt: time(-61_000) }, { ...quote, observedAt: time(-121_000) }, { ...quote, symbol: "AAPL" }]) fail(() => mergeMarketStream(saved, { ...batch, quotes: [changed] }, ["MSFT"], now));
equal(mergeMarketStream(saved, { ...batch, revision: 2, quotes: [] }, ["MSFT"], now).quotes, [], "Rotated credentials cannot inherit the old feed snapshot");
equal(mergeMarketStream(saved, { ...batch, feed: "sip", quotes: [] }, ["MSFT"], now).quotes, []);
equal(mergeMarketStream(saved, { ...batch, message: "provider secret must not be echoed", status: "error", quotes: [] }, ["MSFT"], now).message, "The broker market stream is unavailable. Check the connection, feed entitlement and worker.");
const preciseQuote = { ...quote, observedAt: "2026-11-20T14:59:59.800123456Z" };
const precise = mergeMarketStream(null, { ...batch, quotes: [preciseQuote] }, ["MSFT"], now);
equal(precise.quotes[0].observedAt, preciseQuote.observedAt, "Provider nanosecond timestamp is retained exactly");
const nextPrecise = mergeMarketStream(precise, { ...batch, quotes: [{ ...preciseQuote, bid: 100.01, observedAt: "2026-11-20T14:59:59.800987654Z" }] }, ["MSFT"], now);
equal(nextPrecise.quotes[0].bid, 100.01, "A newer observation in the same millisecond is accepted");
equal(mergeMarketStream(nextPrecise, { ...batch, quotes: [preciseQuote] }, ["MSFT"], now).quotes[0].bid, 100.01, "An older nanosecond observation cannot replace it");

// Exercise the production private snapshot persistence and revocation fence.
const scope = { userId: "founder", firmId: "firm" }; let active = true, credentials = { mode: "paper", key: "fixture-key-not-real", secret: "fixture-secret-not-real", feed: "iex", revision: 1, accountId: "account", allowedSymbols: ["MSFT", "NVDA"], activePositionSymbol: "NVDA" }, row = null, writes = 0;
const authorize = async actor => { equal(actor, scope); if (!active) throw new contracts.AgentDeskError("FOUNDER_AGENT_ACCESS_REQUIRED", "Revoked", 403); };
const fakeDb = { backendPlatformEvent: {
  async findFirst({ where }) { equal(where.userId, scope.userId); equal(where.firmId, scope.firmId); return row ? structuredClone(row) : null; },
  async upsert({ create }) { if (!row) { row = { id: "snapshot", ...structuredClone(create) }; writes++; } return structuredClone(row); },
  async updateMany({ where, data }) { if (!row || where.metadataJson !== row.metadataJson) return { count: 0 }; row = { ...row, ...structuredClone(data) }; writes++; return { count: 1 }; },
} };
const server = await load("src/lib/agent-desk/market-stream.ts", { "@/lib/prisma": { prisma: fakeDb }, "./contracts": contracts, "./market-stream-core": core,
  "./access": { requireAgentDeskAccess: authorize }, "./store": { encodeDeskEnvelope: JSON.stringify, decodeDeskEnvelope: JSON.parse, readDeskRecord: async actor => { await authorize(actor); return { state: { settings: { symbol: "MSFT", policy: { allowedSymbols: ["MSFT"] }, scouting: { universe: ["AAPL"] } }, account: { position: null } } }; } },
  "@/lib/agent-broker/service": { getFounderMarketCredentials: async actor => { await authorize(actor); return credentials; }, listConnectedBrokerScopes: async () => [scope], getAgentBrokerContext: async () => ({ activePositionSymbol: "NVDA", safeguards: { allowedSymbols: ["NVDA", "MSFT"] } }) },
});
const config = await server.agentMarketWorkerConfiguration(); equal(config.connections.length, 1); ok(config.connections[0].symbols.includes("NVDA")); equal(config.connections[0].key, credentials.key, "Only the private worker configuration contains credentials");
const current = new Date().toISOString(), input = { ...batch, id: config.connections[0].id, quotes: [{ ...quote, observedAt: current, receivedAt: current }] };
await server.ingestAgentMarket(input); ok(writes >= 1);
const snapshot = await server.readAgentMarket(scope); equal(snapshot.quotes[0].symbol, "MSFT"); ok(!JSON.stringify(snapshot).includes(credentials.key)); ok(!JSON.stringify(snapshot).includes(credentials.secret)); ok(!JSON.stringify(row).includes(credentials.secret));
const before = writes; credentials = { ...credentials, revision: 2 };
await assert.rejects(() => server.ingestAgentMarket(input), error => error.code === "MARKET_CONNECTION_CHANGED"); checks++; equal(writes, before); equal((await server.readAgentMarket(scope)).quotes, []);
active = false; await assert.rejects(() => server.readAgentMarket(scope), error => error.code === "FOUNDER_AGENT_ACCESS_REQUIRED"); checks++;
equal((await server.agentMarketWorkerConfiguration()).connections, [], "Revoked founders disappear from the worker configuration");
console.log(`Agent market stream: ${checks} checks passed (timestamps, stale data, owner isolation, credential rotation and revocation).`);
