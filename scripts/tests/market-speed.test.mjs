import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";
const root = path.resolve(import.meta.dirname, "../.."), nativeRequire = createRequire(import.meta.url);
let now = Date.parse("2026-11-18T18:00:00Z"), assertions = 0;
class Clock extends Date { constructor(...args) { if (!args.length) super(now); else super(...args); } static now() { return now; } }
function modules(extra = {}, mocks = {}) {
  const cache = new Map();
  const context = vm.createContext({ console, Date: Clock, URL, Response, Headers, Request, AbortController, AbortSignal, DOMException, performance, TextDecoder, TextEncoder, setTimeout, clearTimeout, document: { documentElement: { dataset: { sliceBeta: "true" } } }, process: { env: {} }, ...extra });
  function load(file) {
    let absolute = file.startsWith("@/") ? path.join(root, "src", file.slice(2)) : path.resolve(root, file);
    if (!path.extname(absolute)) absolute += ".ts";
    if (cache.has(absolute)) return cache.get(absolute).exports;
    const module = { exports: {} }; cache.set(absolute, module);
    const code = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } }).outputText;
    const require = name => {
      if (Object.hasOwn(mocks, name)) return mocks[name];
      if (name === "server-only") return {};
      if (name.startsWith("@/")) return load(name);
      if (name.startsWith(".")) return load(path.resolve(path.dirname(absolute), name));
      return nativeRequire(name);
    };
    vm.runInContext(`(function(require,module,exports){${code}\n})`, context, { filename: absolute })(require, module, module.exports);
    return module.exports;
  }
  return { load, context };
}
const check = (actual, expected, message) => { assert.deepEqual(JSON.parse(JSON.stringify(actual)), expected, message); assertions++; };
const ok = (value, message) => { assert.ok(value, message); assertions++; };
const deferred = () => { let resolve, reject; const promise = new Promise((yes, no) => { resolve = yes; reject = no; }); return { promise, resolve, reject }; };
const flush = async () => { await new Promise(resolve => setImmediate(resolve)); };
const { load } = modules();
const { createMarketRefreshLoop } = load("src/lib/market-visuals/refresh-loop.ts");
let visible = true, online = true, runs = 0, active = 0, peak = 0, sequence = 0;
const timers = new Map(), pending = [];
const loop = createMarketRefreshLoop(async () => { runs++; active++; peak = Math.max(peak, active); const d = deferred(); pending.push(d); await d.promise; active--; }, () => 15000, { available: () => visible && online, schedule: (fn, ms) => { const id = ++sequence; timers.set(id, { fn, ms }); return id; }, cancel: id => timers.delete(id) });
loop.wake(); loop.wake(); loop.wake(); check(runs, 1, "Focus and online events share one active refresh");
pending.shift().resolve(); await flush(); check(peak, 1); check([...timers.values()].map(t => t.ms), [15000]);
visible = false; loop.pause(); check(timers.size, 0); loop.wake(); check(runs, 1, "Hidden tabs do not poll");
visible = true; online = false; loop.wake(); check(runs, 1, "Offline tabs do not poll");
online = true; loop.wake(); check(runs, 2, "Resume checks immediately"); loop.stop(); pending.shift().resolve(); await flush(); check(timers.size, 0, "Unmount never rearms polling"); loop.wake(); check(runs, 2);

const { MarketViewCache, resourceKey, resourceTtl } = load("src/lib/market-visuals/view-cache.ts");
const scope = "user:firm";
const quoteRow = (symbol = "AAPL", at = new Date(now).toISOString()) => ({ symbol, price: 125, previousClose: 120, change: 5, changePct: 100 * 5 / 120, volume: 1000, observedAt: at, precision: "timestamp", endpoint: "REALTIME_BULK_QUOTES", priceKind: "regular-session quote", state: "realtime", note: "Provider observation" });
const quote = (symbol = "AAPL", at = new Date(now).toISOString()) => ({ ok: true, scope, section: "quote", symbol, range: "3M", preparedAt: new Date(now).toISOString(), elapsedMs: 1, refreshAfterMs: 10000, receipts: [{ endpoint: "REALTIME_BULK_QUOTES", symbols: [symbol], retrievedAt: new Date(now).toISOString(), cacheHit: false, sha256: "a" }], data: [quoteRow(symbol, at)] });
const bars = Array.from({ length: 252 }, (_, i) => ({ at: new Date(Date.parse("2025-11-01T12:00:00Z") + i * 86400000).toISOString().slice(0, 10), open: 100 + i, high: 102 + i, low: 99 + i, close: 101 + i, volume: 1000 + i }));
const history = { ok: true, scope, section: "history", symbol: "AAPL", range: "1Y", preparedAt: new Date(now).toISOString(), elapsedMs: 2, refreshAfterMs: 3600000, receipts: [{ endpoint: "TIME_SERIES_DAILY", symbols: ["AAPL"], retrievedAt: new Date(now).toISOString(), cacheHit: true, sha256: "b" }], data: { symbol: "AAPL", range: "1Y", bars, endpoint: "TIME_SERIES_DAILY", observedAt: bars.at(-1).at, precision: "date", state: "end-of-day", providerTimeZone: "US/Eastern", note: "Completed raw daily bars", basis: "raw as-traded; no dividend adjustment" } };
const quotePending = deferred(), historyPending = deferred(); let requests = 0;
const cache = new MarketViewCache(async (_url, init) => { requests++; return JSON.parse(init.body).section === "quote" ? quotePending.promise : historyPending.promise; }); cache.activate(scope);
const q1 = cache.load(scope, "quote", "AAPL", "3M"), q2 = cache.load(scope, "quote", "AAPL", "1Y"), h1 = cache.load(scope, "history", "AAPL", "1Y");
check(requests, 2, "One quote flight plus one independent history flight"); ok(q1 === q2, "Quote range changes coalesce into the same flight");
quotePending.resolve(Response.json(quote())); await q1;
check(cache.entries.get(resourceKey("quote", "AAPL", "3M")).value.data[0].price, 125);
check(cache.entries.get(resourceKey("history", "AAPL", "1Y")).busy, true, "Quote paints without waiting for historical data");
historyPending.resolve(Response.json(history)); await h1;
await cache.load(scope, "quote", "AAPL", "3M"); await cache.load(scope, "history", "AAPL", "1Y"); check(requests, 2, "Warm views require no provider request");
check(resourceTtl("quote", quote()), 10000); check(resourceTtl("history", history), 3600000, "Daily history is reused while quotes refresh");

let count = 0, result = Response.json(quote());
const failing = new MarketViewCache(async () => { count++; return result.clone(); }); failing.activate(scope); await failing.load(scope, "quote", "AAPL", "3M");
result = Response.json({ ok: false, message: "Provider request limit" }, { status: 429, headers: { "Retry-After": "60" } });
await failing.load(scope, "quote", "AAPL", "3M", true);
check(failing.entries.get("quote:AAPL:snapshot").value.data[0].price, 125, "Last good price survives refresh failure");
await failing.load(scope, "quote", "AAPL", "3M", true); check(count, 2, "Manual refresh respects provider backoff");
now += 61000; result = Response.json(quote("AAPL", "2026-11-18T17:00:00Z")); await failing.load(scope, "quote", "AAPL", "3M", true);
check(failing.entries.get("quote:AAPL:snapshot").value.data[0].observedAt, "2026-11-18T18:00:00.000Z", "Late older price cannot overwrite the newer snapshot");
const late = deferred(), isolated = new MarketViewCache(() => late.promise); isolated.activate(scope); const old = isolated.load(scope, "quote", "AAPL", "3M"); isolated.activate("other:firm"); late.resolve(Response.json(quote())); await old; check(isolated.entries.size, 0, "A prior user's late response is discarded");
const mismatch = new MarketViewCache(async () => Response.json({ ...quote(), scope: "other:firm" })); mismatch.activate(scope); let denied = 0; await mismatch.load(scope, "quote", "AAPL", "3M", false, () => denied++); check(denied, 1); check(mismatch.scope, null);

const { boardInstrument, boardPlan, buildBoardSnapshot } = load("src/lib/market-visuals/board-snapshot.ts");
check(boardInstrument("NASDAQ:AAPL"), "AAPL"); check(boardInstrument("SP:SPX"), "INDEX:SPX");
assert.throws(() => boardInstrument("BINANCE:BTCUSDT")); assertions++;
check(boardPlan("AAPL", ["last-price", "volume"]), [{ section: "quote", symbol: "AAPL", range: "3M" }], "Price-only boards avoid historical and company lookups");
check(boardPlan("AAPL", ["sma-200", "beta"]).map(row => [row.section, row.range]), [["quote", "3M"], ["history", "1Y"], ["fundamentals", "3M"]]);
check(boardPlan("INDEX:SPX", ["beta"]).length, 1, "Native indices never become equity company lookups");
check(boardPlan("AAPL", ["beta", "sma-200"]), JSON.parse(JSON.stringify(boardPlan("AAPL", ["sma-200", "beta"]))), "Metric reordering keeps the request plan stable");
let board = buildBoardSnapshot("AAPL", "NASDAQ:AAPL", ["rsi-14", "sma-200", "vwap"], [quote()], now);
check(board.price, 125); check(board.metrics["sma-200"].value, null); check(board.metrics.vwap.status, "chart");
board = buildBoardSnapshot("AAPL", "NASDAQ:AAPL", ["rsi-14", "sma-200", "ema-21", "directional-bias"], [quote(), history], now);
check(board.metrics["sma-200"].value, bars.slice(-200).reduce((sum, row) => sum + row.close, 0) / 200);
check(board.metrics["rsi-14"].value, 100); check(board.metrics["rsi-14"].status, "calculated"); ok(board.metrics["directional-bias"].detail.includes("not a forecast"));
check(buildBoardSnapshot("MSFT", "NASDAQ:MSFT", ["last-price"], [quote(), history], now).price, null, "Another ticker's cache never leaks into a board");
board = buildBoardSnapshot("AAPL", "NASDAQ:AAPL", ["last-price"], [quote("AAPL", "2026-11-18T17:00:00Z")], now);
check(board.metrics["last-price"].status, "stale", "Fresh retrieval cannot turn an old market event into a live quote");
const dailyQuote = quote(); dailyQuote.data[0] = { ...dailyQuote.data[0], endpoint: "GLOBAL_QUOTE", precision: "date", observedAt: "2026-11-18", state: "end-of-day" };
check(buildBoardSnapshot("AAPL", "NASDAQ:AAPL", ["last-price"], [dailyQuote], now).session, "end-of-day");

const writes = []; let fetches = 0;
const noProvider = modules({ fetch: async () => { fetches++; throw new Error("No network allowed in test"); } }, { "@/lib/prisma": { prisma: { realtimePriceSnapshot: { createMany: async value => writes.push(value) } } } }).load("src/lib/realtime-market.ts");
const empty = await noProvider.getRealtimeMarketSnapshots(["AAPL", "MSFT"]);
check(empty.snapshots, []); check(empty.unavailableSymbols, ["AAPL", "MSFT"]); check(fetches, 0, "Missing configuration does not launch network calls or fabricate prices");
ok(!empty.providerPriority.includes("demo"));
await noProvider.persistRealtimeSnapshots("user", [{ symbol: "AAPL", price: 125, provider: "Demo fallback", marketState: "Demo" }]); check(writes.length, 0, "Illustrations never enter historical market evidence");
const provider = modules({ process: { env: { FINNHUB_API_KEY: "fixture-only", SLICE_REALTIME_PROVIDER_PRIORITY: "finnhub,demo" } }, fetch: async input => {
  const url = new URL(String(input)); if (url.pathname.endsWith("candle")) return Response.json({ s: "no_data" });
  if (url.searchParams.get("symbol") === "MSFT") throw new Error("Fixture provider outage");
  return Response.json({ c: 125, pc: 120, d: 5, dp: 100 * 5 / 120, t: Date.parse("2026-11-17T18:00:00Z") / 1000 });
} }, { "@/lib/prisma": { prisma: {} } }).load("src/lib/realtime-market.ts");
const partial = await provider.getRealtimeMarketSnapshots(["AAPL", "MSFT"]);
check(partial.snapshots.map(row => row.symbol), ["AAPL"], "A failed symbol does not discard another real provider observation");
check(partial.unavailableSymbols, ["MSFT"]); check(partial.snapshots[0].isRealtime, false); check(partial.snapshots[0].marketState, "Stale");
check(partial.realtimeCount, 0, "An old provider timestamp is not counted as realtime");

const afterCallbacks = [], archiveEvents = []; let archiveCalls = 0;
const realtimeRoute = modules({}, {
  "@/lib/auth": { getCurrentUser: async () => ({ id: "user" }) },
  "next/server": { after: callback => afterCallbacks.push(callback) },
  "@/lib/logger": { createLogger: () => ({ warn: (...event) => archiveEvents.push(event) }) },
  "@/lib/alpha-vantage-realtime": { getAlphaVantageRealtimeSnapshots: async () => ({ snapshots: [{ symbol: "AAPL", provider: "Alpha Vantage", price: 125 }] }) },
  "@/lib/realtime-market": { getRealtimeMarketSnapshots: async () => ({ snapshots: [] }), persistRealtimeSnapshots: async () => { archiveCalls++; throw new Error("Fixture archive failure"); } },
}).load("src/app/api/market/realtime/route.ts");
const delivered = await realtimeRoute.GET(new Request("http://localhost/api/market/realtime?symbols=AAPL"));
check(delivered.status, 200); check(archiveCalls, 0, "Optional database archival does not block the quote response"); check(afterCallbacks.length, 1);
await afterCallbacks[0](); check(archiveCalls, 1); check(archiveEvents[0][0], "snapshot.persistence.failed", "Archive failures are recorded, not silently swallowed");

let classicMode = "date";
const classic = modules({ process: { env: { ALPHA_VANTAGE_API_KEY: "fixture-only", ALPHA_VANTAGE_ENTITLEMENT: "realtime" } }, fetch: async input => {
  const u = new URL(String(input)), endpoint = u.searchParams.get("function"), symbol = u.searchParams.get("symbol");
  if (endpoint === "REALTIME_BULK_QUOTES") return Response.json({ data: [{ symbol, close: "125", previous_close: "120", volume: "1000", ...(classicMode === "timestamp" ? { timestamp: "2026-11-18 12:58:11" } : {}) }] });
  if (endpoint === "GLOBAL_QUOTE") return Response.json({ "Global Quote": { "01. symbol": symbol, "05. price": "125", "06. volume": "1000", "07. latest trading day": "2026-11-17", "08. previous close": "120" } });
  if (endpoint === "TIME_SERIES_DAILY_ADJUSTED") return Response.json({ "Time Series (Daily)": { "2026-11-16": { "1. open": "120", "2. high": "122", "3. low": "118", "4. close": "121", "5. adjusted close": "121", "6. volume": "1000", "7. dividend amount": "0", "8. split coefficient": "1" }, "2026-11-17": { "1. open": "121", "2. high": "126", "3. low": "120", "4. close": "125", "5. adjusted close": "125", "6. volume": "1100", "7. dividend amount": "0", "8. split coefficient": "1" } } });
  return Response.json({});
} }, { "@/lib/auth": { getCurrentUser: async () => ({ id: "user" }) }, "next/server": { NextResponse: Response }, "@/lib/intelligence-unified/market-adapter": { legacyMarketForecast: async () => null } }).load("src/app/api/market-visuals/route.ts");
let classicResponse = await classic.GET(new Request("http://localhost/api/market-visuals?symbol=AAPL&interval=daily")), classicBody = await classicResponse.json();
check(classicResponse.status, 200); check(classicBody.quote.timestamp, "2026-11-17", "Classic GLOBAL_QUOTE retains its provider date instead of stamping now");
check(classicBody.quote.source, "Alpha Vantage GLOBAL_QUOTE", "A bulk quote without event time is rejected"); check(classicBody.isRealtime, false);
classicMode = "timestamp";
classicResponse = await classic.GET(new Request("http://localhost/api/market-visuals?symbol=MSFT&interval=daily")); classicBody = await classicResponse.json();
check(classicBody.isRealtime, true); const originalTimestamp = classicBody.quote.timestamp;
now += 20000;
classicResponse = await classic.GET(new Request("http://localhost/api/market-visuals?symbol=MSFT&interval=daily")); classicBody = await classicResponse.json();
check(classicResponse.headers.get("X-Slice-Market-Cache"), "HIT"); check(classicBody.quote.timestamp, originalTimestamp); check(classicBody.isRealtime, false, "A classic cache hit recomputes observation freshness");
console.log(`Market speed checks passed (${assertions} assertions): progressive quotes, warm-cache reuse, no-overlap polling, provider backoff, session isolation, explicit source timing, calculated daily metrics, and no synthetic auto-market prices.`);
