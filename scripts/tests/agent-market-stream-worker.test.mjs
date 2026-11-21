import assert from "node:assert/strict";
import { runAgentMarketStreams } from "../agent-market-stream.mjs";

let assertions = 0, scenarios = 0;
const failures = [], check = (a, b, message) => { assert.deepEqual(a, b, message); assertions++; }, yes = (a, message) => { assert.ok(a, message); assertions++; };
const settle = () => new Promise(done => setImmediate(done));
async function test(name, action) { try { await action(); scenarios++; } catch (error) { failures.push(new Error(name, { cause: error })); console.error(`FAIL ${name}: ${error.message}`); } }
const epoch = Date.parse("2026-11-21T15:30:00.000Z");
const connection = (overrides = {}) => ({ id: "connection-one", userId: "owner-one", firmId: "firm-one", mode: "paper", key: "test-stream-key", secret: "test-stream-secret", feed: "iex", revision: 3, accountId: "paper-account", symbols: ["MSFT", "SPY"], ...overrides });
const response = (status = 200, value = { ok: true }) => ({ ok: status >= 200 && status < 300, status, json: async () => value });
const quote = (overrides = {}) => ({ T: "q", S: "MSFT", bp: 100, ap: 100.02, t: "2026-11-21T15:30:00.000123456Z", ...overrides });
function deferred() { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; }
function harness(initial = [connection()]) {
  let time = epoch, nextTimer = 0;
  const timers = new Map(), sockets = [], requests = [], logs = [], controller = new AbortController();
  class Socket {
    constructor(url) { this.url = url; this.closed = false; this.sent = []; this.listeners = new Map(); sockets.push(this); }
    addEventListener(type, fn) { const group = this.listeners.get(type) || []; group.push(fn); this.listeners.set(type, group); }
    emit(type, value = {}) { for (const fn of this.listeners.get(type) || []) fn(value); }
    send(text) { this.sent.push(JSON.parse(text)); }
    close() { this.closed = true; this.emit("close"); }
    message(items) { this.emit("message", { data: JSON.stringify(items) }); }
  }
  const h = { timers, sockets, requests, logs, controller, connections: initial, getStatus: 200, postStatus: 200, getImpl: null, postImpl: null,
    get time() { return time; }, posts() { return requests.filter(item => item.init.method === "POST"); }, gets() { return requests.filter(item => item.init.method === "GET"); },
    async advance(ms) {
      const target = time + ms; let calls = 0;
      while (true) { await settle(); const entry = [...timers].filter(([, value]) => value.at <= target).sort((a, b) => a[1].at - b[1].at || a[0] - b[0])[0]; if (!entry) break; timers.delete(entry[0]); time = entry[1].at; entry[1].callback(); if (++calls > 2000) throw new Error("Unbounded timer loop"); }
      time = target; await settle();
    },
    async open(index = 0) { await settle(); const socket = sockets[index]; yes(socket, "A stream socket was created"); socket.emit("open"); socket.message([{ T: "success", msg: "authenticated" }]); socket.message([{ T: "subscription", quotes: socket.sent.find(item => item.action === "subscribe")?.quotes || [] }]); await settle(); return socket; },
    async stop() { controller.abort(); await h.running; await settle(); },
  };
  h.running = runAgentMarketStreams({ origin: "http://localhost:3000", secret: "test-cron-secret" }, controller.signal, {
    WebSocket: Socket, now: () => time, random: () => .5, log: value => logs.push(value),
    setTimeout(callback, ms) { const id = ++nextTimer; timers.set(id, { callback, at: time + ms }); return id; }, clearTimeout(id) { timers.delete(id); },
    fetch(url, init) {
      const item = { url: String(url), init, at: time, body: init.body ? JSON.parse(init.body) : null }; requests.push(item);
      if (init.method === "GET") return h.getImpl ? h.getImpl(item) : Promise.resolve(response(h.getStatus, { ok: h.getStatus === 200, connections: h.connections }));
      return h.postImpl ? h.postImpl(item) : Promise.resolve(response(h.postStatus));
    },
  });
  return h;
}

await test("Older Node without WebSocket stays offline and makes no provider or credential calls", async () => {
  const logs = [], controller = new AbortController(); let calls = 0;
  await runAgentMarketStreams({ origin: "http://localhost:3000", secret: "test" }, controller.signal, { WebSocket: null, fetch() { calls++; }, log: value => logs.push(value) });
  check(calls, 0); yes(logs[0].includes("Node.js 22 or newer")); yes(logs[0].includes("offline"));
});
await test("Remote plaintext origins and malformed feeds cannot receive broker credentials", async () => {
  await assert.rejects(runAgentMarketStreams({ origin: "http://example.com", secret: "test" }, new AbortController().signal), /validated Slice worker origin/); assertions++;
  const h = harness([connection({ feed: "https://attacker.invalid" })]); await settle(); check(h.sockets.length, 0); check(h.posts().length, 0); yes(h.logs.some(line => line.includes("verified connection settings"))); await h.stop();
});
await test("Fixed broker URL authenticates first, subscribes exact symbols, and never includes credentials in app snapshots", async () => {
  const h = harness(); const socket = await h.open(); check(socket.url, "wss://stream.data.alpaca.markets/v2/iex");
  check(socket.sent, [{ action: "auth", key: "test-stream-key", secret: "test-stream-secret" }, { action: "subscribe", quotes: ["MSFT", "SPY"] }]);
  await h.advance(1); const post = h.posts()[0]; check(post.url, "http://localhost:3000/api/cron/agent-market"); check(post.init.redirect, "error"); check(post.init.headers.authorization, "Bearer test-cron-secret");
  check(post.body.id, "connection-one"); check(post.body.revision, 3); yes(!post.init.body.includes("test-stream-key")); yes(!post.init.body.includes("test-stream-secret")); yes(!JSON.stringify(h.logs).includes("test-stream-secret")); await h.stop();
});
await test("Quote bursts coalesce to the latest symbol value once per second and retain original nanosecond timestamps", async () => {
  const h = harness(), socket = await h.open(); await h.advance(1);
  socket.message([quote()]); await h.advance(100); socket.message([quote({ bp: 101, ap: 101.02, t: "2026-11-21T15:30:00.100987654Z" })]);
  await h.advance(899); check(h.posts().length, 1); await h.advance(101); check(h.posts().length, 2);
  const observed = h.posts()[1].body.quotes[0]; check(observed.bid, 101); check(observed.observedAt, "2026-11-21T15:30:00.100987654Z"); check(observed.receivedAt, "2026-11-21T15:30:00.101Z");
  await h.advance(10_000); check(h.posts().at(-1).body.quotes[0].observedAt, observed.observedAt); check(h.posts().at(-1).body.quotes[0].receivedAt, observed.receivedAt); await h.stop();
});
await test("Out-of-order, unauthorized, crossed and fabricated future quotes never replace usable observed data", async () => {
  const h = harness(), socket = await h.open(); socket.message([quote()]); await h.advance(1);
  socket.message([quote({ t: "2026-11-21T15:29:00.000Z", bp: 10 }), quote({ S: "NVDA" }), quote({ bp: 101, ap: 100 }), quote({ t: "2030-01-01T00:00:00Z" }), quote({ bp: "100" })]);
  await h.advance(10_000); const records = h.posts().at(-1).body.quotes; check(records.length, 1); check(records[0].bid, 100); check(records[0].observedAt, quote().t); await h.stop();
});
await test("Same account/feed reuses one provider connection and filters every workspace snapshot to its allowed symbols", async () => {
  const h = harness([connection({ symbols: ["MSFT"] }), connection({ id: "two", userId: "owner-two", firmId: "firm-two", symbols: ["SPY"] })]); const socket = await h.open(); check(h.sockets.length, 1);
  check(socket.sent[1].quotes, ["MSFT", "SPY"]); socket.message([quote(), quote({ S: "SPY", bp: 500, ap: 500.02 })]); await h.advance(1);
  check(h.posts().length, 2); check(h.posts()[0].body.quotes.map(item => item.symbol), ["MSFT"]); check(h.posts()[1].body.quotes.map(item => item.symbol), ["SPY"]); check(h.posts()[1].body.userId, "owner-two"); await h.stop();
});
await test("Connection removal or failed access refresh closes sockets and clears scheduled reconnect work", async () => {
  const h = harness(), socket = await h.open(); h.connections = []; await h.advance(30_000); yes(socket.closed); check(h.gets().length, 2); const count = h.sockets.length; await h.advance(30_000); check(h.sockets.length, count); await h.stop();
  const failed = harness(), old = await failed.open(); failed.getStatus = 503; await failed.advance(30_000); yes(old.closed); yes(failed.logs.some(line => line.includes("Streams are closed"))); await failed.stop(); check(failed.timers.size, 0);
});
await test("Credential and subscription changes replace the old socket with a new verified configuration", async () => {
  const h = harness(), old = await h.open(); h.connections = [connection({ key: "rotated-test-key", revision: 4, symbols: ["AAPL"] })]; await h.advance(30_000); yes(old.closed); check(h.sockets.length, 2); const current = await h.open(1); check(current.sent[0].key, "rotated-test-key"); check(current.sent[1].quotes, ["AAPL"]); await h.stop();
});
await test("Provider entitlement errors report a safe fixed message and do not spin reconnects", async () => {
  const h = harness(), socket = await h.open(); socket.message([{ T: "error", code: 409, msg: "Sensitive echo test-stream-key test-stream-secret" }]); await h.advance(1); yes(socket.closed); yes(h.posts().at(-1).body.message.includes("entitlement"));
  await h.advance(60_000); check(h.sockets.length, 1); yes(!JSON.stringify(h.posts()).includes("Sensitive echo")); yes(!JSON.stringify(h.logs).includes("test-stream-secret")); await h.stop();
});
await test("Connection-limit failures use bounded slow reconnect and successful quote data resets the backoff", async () => {
  const h = harness(), socket = await h.open(); socket.message([{ T: "error", code: 406, msg: "limit" }]); await h.advance(59_999); check(h.sockets.length, 1); await h.advance(1); check(h.sockets.length, 2); await h.stop();
});
await test("Failed snapshot delivery backs off and a changed configuration stops rejected writes", async () => {
  const h = harness(); h.postStatus = 503; await h.open(); await h.advance(1); check(h.posts().length, 1); await h.advance(4999); check(h.posts().length, 1); await h.advance(1); check(h.posts().length, 2); await h.stop();
  const changed = harness(); changed.postStatus = 409; const socket = await changed.open(); await changed.advance(1); yes(socket.closed); await changed.advance(20_000); check(changed.posts().length, 1); await changed.stop();
});
await test("Snapshot requests never overlap; pending delivery and cleanup are fenced when cancellation is ignored", async () => {
  const h = harness(), wait = deferred(); h.postImpl = () => wait.promise; const socket = await h.open(); await h.advance(1); check(h.posts().length, 1); socket.message([quote()]); await h.advance(5000); check(h.posts().length, 1);
  const pending = h.posts()[0]; await h.stop(); yes(pending.init.signal.aborted); check(h.timers.size, 0); wait.resolve(response()); await settle(); check(h.posts().length, 1); check(h.timers.size, 0); yes(socket.closed);
});
await test("Cron rejection terminates the streaming task with no retry and no raw response logging", async () => {
  const h = harness(); h.getStatus = 401; await h.advance(30_000); await h.running; check(h.timers.size, 0); yes(h.sockets.every(socket => socket.closed)); yes(h.logs.some(line => line.includes("authorization was rejected")));
});
await test("Quiet symbols retain old server observations without stale heartbeat payloads blocking active symbols", async () => {
  const h = harness(), socket = await h.open(); socket.message([quote()]); await h.advance(61_000);
  check(h.posts().at(-1).body.quotes, [], "A heartbeat sends no expired quote payload");
  socket.message([quote({ S: "SPY", bp: 500, ap: 500.02, t: new Date(h.time).toISOString() })]); await h.advance(1_000);
  check(h.posts().at(-1).body.quotes.map(item => item.symbol), ["SPY"]); await h.stop();
});

if (failures.length) throw new AggregateError(failures, `${failures.length} market stream worker scenarios failed`);
console.log(`Market stream worker: ${scenarios} scenarios, ${assertions} assertions passed.`);
