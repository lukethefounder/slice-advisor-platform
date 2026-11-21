import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import ts from "typescript";

// The real parser/collector runs with controlled responses, time, and timers.
// No provider, secret, browser, or database is used.
const root = path.resolve(import.meta.dirname, "../.."), nativeRequire = createRequire(import.meta.url);
const moduleCache = new Map(), timers = new Map(); let timerId = 0, checks = 0;
const context = vm.createContext({ Buffer, URL, Request, Response, Headers, AbortController, AbortSignal, DOMException, ReadableStream,
  console, Date, structuredClone, process: { env: {} }, fetch: () => { throw Error("Uncontrolled network access"); },
  setTimeout: (callback, delay) => { const id = ++timerId; timers.set(id, { callback, delay }); return id; },
  clearTimeout: id => timers.delete(id),
});
function load(file) {
  let absolute = file.startsWith("@/") ? path.join(root, "src", file.slice(2)) : path.resolve(root, file);
  if (!path.extname(absolute)) absolute += ".ts";
  if (moduleCache.has(absolute)) return moduleCache.get(absolute).exports;
  const module = { exports: {} }; moduleCache.set(absolute, module);
  const compiled = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { fileName: absolute, reportDiagnostics: true, compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, esModuleInterop: true } });
  assert.equal(compiled.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0);
  const require = name => name === "server-only" ? {} : name.startsWith("@/") ? load(name) : name.startsWith(".") ? load(path.resolve(path.dirname(absolute), name)) : nativeRequire(name);
  vm.runInContext(`(function(require,module,exports){${compiled.outputText}\n})`, context, { filename: absolute })(require, module, module.exports);
  return module.exports;
}
const news = load("src/lib/intelligence/research-public-news.ts"), alpha = load("src/lib/intelligence/research-news.ts");
const plain = value => value === undefined ? undefined : JSON.parse(JSON.stringify(value));
const check = (actual, expected, message) => { assert.deepEqual(plain(actual), plain(expected), message); checks++; };
const ok = (value, message) => { assert.ok(value, message); checks++; };
const throws = work => { assert.throws(work); checks++; };
const rejects = async (work, predicate) => { await assert.rejects(work, predicate); checks++; };
const now = Date.parse("2026-11-18T20:00:00.000Z"), stamp = new Date(now - 60_000).toISOString();
const input = { symbol: "MSFT", companyName: "Microsoft Corporation", sector: "Technology", weights: { media: 55, technical: 30, economy: 15 } };
const escape = value => String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
function item(overrides = {}) { return { title: "Microsoft earnings outlook improves", summary: "Microsoft reports quarterly results and guidance.", url: "https://news.google.com/rss/articles/article-1?utm_source=test", publishedAt: stamp, publisher: "Example News", publisherUrl: "https://example-news.test", ...overrides }; }
function rss(items, { updatedOnly = false } = {}) {
  return `<?xml version="1.0"?><rss version="2.0"><channel>${items.map(row => `<item><title>${escape(row.title)} - ${escape(row.publisher)}</title><link>${escape(row.url)}</link><description><![CDATA[${row.summary}]]></description><${updatedOnly ? "updated" : "pubDate"}>${escape(row.publishedAt)}</${updatedOnly ? "updated" : "pubDate"}><source url="${escape(row.publisherUrl)}">${escape(row.publisher)}</source></item>`).join("")}</channel></rss>`;
}
const response = items => new Response(rss(items), { headers: { "content-type": "application/rss+xml" } });
const fake = (body, options = {}) => {
  let time = now; const requests = [];
  const collect = news.createPublicResearchNewsCollector({ now: () => time, fetch: async (url, init) => { requests.push({ url, init }); return typeof body === "function" ? body(requests.length, url, init) : response(body); } });
  return { collect, requests, advance: value => { time += value; }, ...options };
};

// Query construction is fixed-host and honors resolved identity and a hard request budget.
const queries = news.publicResearchNewsQueries(input);
check(queries.length, 3);
for (const query of queries) {
  check(new URL(query.url).origin, "https://news.google.com"); check(new URL(query.url).pathname, "/rss/search");
  ok(query.query.includes('"Microsoft"')); ok(query.query.includes("when:7d"));
}
check(news.publicResearchNewsQueries({ ...input, maxQueries: 0 }), []);
check(news.publicResearchNewsQueries({ ...input, maxQueries: 100 }).length, 3);
check(news.publicResearchNewsQueries({ ...input, symbol: "https://localhost/admin" }), []);
check(news.publicResearchNewsQueries({ ...input, maxAgeHours: 900 })[0].query.includes("when:7d"), true);
check(news.publicResearchNewsQueries({ ...input, maxAgeHours: 24 })[0].query.includes("when:1d"), true);
ok(news.publicResearchNewsQueries({ ...input, weights: { economy: 100, media: 0, technical: 0 } })[1].query.includes("inflation"));
ok(news.publicResearchNewsQueries({ ...input, weights: { technical: 100, media: 0, economy: 0 } })[1].query.includes("volatility"));
ok(queries[2].query.includes('"Technology"'));

// Publication dates never become retrieval time or a feed's updated time.
check(news.publicNewsPublicationTime("Wed, 18 Nov 2026 19:59:00 GMT"), stamp);
check(news.publicNewsPublicationTime("2026-11-18T14:59:00-05:00"), stamp);
for (const bad of ["2026-02-30T12:00:00Z", "30 Feb 2026 12:00:00 GMT", "not a date", "2026-11-18", "2026-11-18T12:00:00", "", "2026-13-01T12:00:00Z"]) check(news.publicNewsPublicationTime(bad), null);
const parsed = news.parsePublicResearchFeed(rss([item({ summary: '<script>secret()</script><p>Profit &amp; outlook &#x1F4C8;</p>' })]));
check(parsed.length, 1); check(parsed[0].title, "Microsoft earnings outlook improves");
check(parsed[0].summary, "Profit & outlook 📈"); check(parsed[0].publishedAt, stamp);
check(news.parsePublicResearchFeed(rss([item()], { updatedOnly: true }))[0].publishedAt, null);
check(news.parsePublicResearchFeed('<feed xmlns="http://www.w3.org/2005/Atom"><entry><title>Microsoft quarterly earnings</title><link rel="alternate" href="https://publisher.test/msft"/><summary>Microsoft earnings</summary><published>2026-11-18T19:59:00Z</published></entry></feed>')[0].url, "https://publisher.test/msft");
throws(() => news.parsePublicResearchFeed("<!DOCTYPE rss><rss><channel/></rss>"));
throws(() => news.parsePublicResearchFeed("<!ENTITY test SYSTEM 'file:///secret'><rss/>"));
throws(() => news.parsePublicResearchFeed("<html><body>Access denied</body></html>"));
throws(() => news.parsePublicResearchFeed(`<rss><channel>${"a".repeat(1_048_576)}</channel></rss>`));
check(news.parsePublicResearchFeed(rss(Array.from({ length: 180 }, (_, i) => item({ title: `Microsoft stock item ${i}` })))).length, 150);

// Identity checks do not interpret ordinary words, another company, or another index as this security.
check(news.publicNewsIdentityMatch(item(), input), "company-name");
check(news.publicNewsIdentityMatch({ title: "MSFT earnings rise", summary: "" }, { ...input, companyName: "" }), "ticker");
check(news.publicNewsIdentityMatch({ title: "msft earnings rise", summary: "" }, { ...input, companyName: "" }), null);
check(news.publicNewsIdentityMatch({ title: "NASDAQ:MSFT announces earnings", summary: "" }, { ...input, companyName: "" }), "ticker");
check(news.publicNewsIdentityMatch({ title: "$MSFT.AB earnings", summary: "" }, { ...input, companyName: "" }), null);
check(news.publicNewsIdentityMatch({ title: "AI transforms business", summary: "" }, { ...input, symbol: "AI", companyName: "" }), null);
check(news.publicNewsIdentityMatch({ title: "$AI reports earnings", summary: "" }, { ...input, symbol: "AI", companyName: "" }), "ticker");
check(news.publicNewsIdentityMatch({ title: "NOW is the time to buy stocks", summary: "" }, { ...input, symbol: "NOW", companyName: "" }), null);
check(news.publicNewsIdentityMatch({ title: "Nvidia earnings increase", summary: "" }, input), null);
const index = { ...input, symbol: "INDEX:SPX", companyName: "", queryName: "S&P 500", aliases: ["S&P500", "Standard and Poor’s 500"], assetType: "index" };
ok(!news.publicResearchNewsQueries(index)[0].query.includes("$INDEX:SPX"));
check(news.publicResearchNewsQueries({ ...index, symbol: "INDEX:UNKNOWN", queryName: "Index UNKNOWN", aliases: [] }), []);
check(news.publicResearchNewsQueries({ ...index, symbol: "^UNKNOWN", queryName: "^UNKNOWN", aliases: [] }), []);
check(news.publicNewsIdentityMatch({ title: "Index UNKNOWN stocks climb", summary: "$INDEX:UNKNOWN stock" }, { ...index, symbol: "INDEX:UNKNOWN", queryName: "Index UNKNOWN", aliases: [] }), null);
check(news.publicNewsIdentityMatch({ title: "S&P500 stocks climb", summary: "" }, index), "query-name");
check(news.publicNewsIdentityMatch({ title: "Nasdaq Composite index falls", summary: "" }, index), null);
check(news.publicNewsIdentityMatch(item(), { ...index, companyName: "Microsoft Corporation" }), null);
check(news.publicNewsIdentityMatch({ title: "Apple harvest reaches record", summary: "Local orchards prepare" }, { ...input, symbol: "AAPL", companyName: "Apple Inc." }), null);

// A real collection rejects stale/future/undated/unrelated/unsafe records and keeps public metadata unscored.
const selective = fake([
  item(), item({ title: "Microsoft earnings stale", url: "https://old.test/article", publishedAt: new Date(now - 169 * 3600000).toISOString() }),
  item({ title: "Microsoft earnings future", url: "https://future.test/article", publishedAt: new Date(now + 3600000).toISOString() }),
  item({ title: "Microsoft missing date", url: "https://undated.test/article", publishedAt: "" }),
  item({ title: "Other company earnings", summary: "Other company only", url: "https://other.test/article" }),
  item({ url: "http://127.0.0.1/private" }), item({ url: "https://user:password@private.test/article" }), item({ url: "https://news.google.com/rss/search?q=test" }),
  item({ title: "Microsoft earnings at original publisher", url: "https://original.test/msft?utm_campaign=test&api_key=secret#fragment", publisherUrl: "https://claimed.test", publisher: "Original publisher" }),
]);
const selected = await selective.collect({ ...input, maxQueries: 1 });
check(selected.articles.length, 2); check(selected.articles[0].sentiment, null); check(selected.articles[0].publisherAttribution, "feed-reported");
check(selected.articles[0].linkKind, "aggregator"); check(selected.articles[0].publisherDomain, "example-news.test");
check(selected.articles[1].linkKind, "publisher"); check(selected.articles[1].publisherDomain, "original.test");
check(selected.articles[1].publisherAttribution, "article-host"); check(selected.articles[1].url, "https://original.test/msft");
check(selected.diagnostics.queries[0].rejected, { stale: 1, future: 1, undated: 1, unrelated: 1, unsafeUrl: 3, duplicate: 0 });
check(selected.diagnostics.status, "partial"); check(selective.requests[0].init.redirect, "error");
check(selective.requests[0].init.cache, "no-store"); check(selective.requests[0].init.headers.Authorization, undefined);
check(timers.size, 0, "Transport timers are cleared after completed bodies");

// Publishers and normalized URL/story identity determine completion; repeating a query cannot inflate it.
const independent = Array.from({ length: 8 }, (_, i) => item({ title: `Microsoft earnings finding number ${i}`, url: `https://publisher${i % 3}.test/article/${i}`, publisherUrl: `https://publisher${i % 3}.test` }));
const sufficient = fake(independent), sufficientResult = await sufficient.collect(input);
check(sufficient.requests.length, 1); check(sufficientResult.diagnostics.status, "complete"); check(sufficientResult.diagnostics.publisherCount, 3);
check(sufficientResult.diagnostics.uniqueArticles, 8);
const diverseNeeded = fake((count) => response(count === 1 ? independent.map((row, i) => ({ ...row, url: `https://same.test/${i}` })) : [item({ title: `Microsoft followup earnings report ${count}`, url: `https://followup${count}.test/article` })]));
const diversified = await diverseNeeded.collect(input); check(diverseNeeded.requests.length, 3); check(diversified.diagnostics.status, "complete");
const duplicates = fake([item(), item({ url: "https://news.google.com/rss/articles/article-1?utm_campaign=copy" }), item({ url: "https://syndicated.test/copy", publisherUrl: "https://syndicated.test" })]);
const deduped = await duplicates.collect(input); check(deduped.articles.length, 1); check(deduped.articles[0].duplicateCount, 8);
check(deduped.articles[0].relatedSources.length, 1); check(deduped.diagnostics.completedQueries, 3); check(deduped.diagnostics.status, "partial");
const bypass = fake(() => { throw Error("Should not fetch"); });
const skipped = await bypass.collect({ ...input, existing: independent.map(row => ({ ...row, sourceDomain: "ignored.test" })) });
check(skipped.diagnostics.status, "not-needed"); check(bypass.requests.length, 0);
const noBudget = await bypass.collect({ ...input, maxQueries: 0 }); check(noBudget.diagnostics.status, "disabled"); check(bypass.requests.length, 0);

// Cache hits retain original retrieval time and do not relabel an observation as freshly published.
const cached = fake([item({ publishedAt: new Date(now - 168 * 3600000 + 30_000).toISOString() })]);
const first = await cached.collect({ ...input, maxQueries: 1 }); cached.advance(40_000);
const second = await cached.collect({ ...input, maxQueries: 1 });
check(cached.requests.length, 1); check(second.articles.length, 0); check(second.diagnostics.queries[0].cacheState, "cache");
check(second.diagnostics.queries[0].retrievedAt, first.articles[0].retrievedAt); check(second.diagnostics.queries[0].rejected.stale, 1);
cached.advance(30_000); await cached.collect({ ...input, maxQueries: 1 }); check(cached.requests.length, 2);
await cached.collect({ ...input, maxQueries: 1, forceRefresh: true }); check(cached.requests.length, 3);

// All failure types remain honest; rate-limited queries use a bounded cooldown.
for (const [make, expected] of [[() => new Response("limit", { status: 429 }), "rate-limited"], [() => new Response("denied", { status: 403 }), "unavailable"], [() => new Response("<html>Sign in</html>"), "invalid-response"], [() => { throw new Error("PRIVATE_URL?key=secret"); }, "unavailable"]]) {
  const source = fake(make), result = await source.collect({ ...input, maxQueries: 1 });
  check(result.diagnostics.status, "unavailable"); check(result.articles.length, 0); check(result.diagnostics.queries[0].status, expected);
  ok(!JSON.stringify(result).includes("PRIVATE_URL"));
  const again = await source.collect({ ...input, maxQueries: 1, forceRefresh: true }); check(source.requests.length, 1); check(again.diagnostics.queries[0].cacheState, "cooldown");
  source.advance(31_000); await source.collect({ ...input, maxQueries: 1 }); check(source.requests.length, 2);
}
const empty = fake([]); check((await empty.collect({ ...input, maxQueries: 1 })).diagnostics.status, "empty");
const oversized = fake(() => new Response("<rss/>", { headers: { "content-length": "1048577" } }));
check((await oversized.collect({ ...input, maxQueries: 1 })).diagnostics.status, "unavailable");
let cancelledBody = false;
const streamed = fake(() => new Response(new ReadableStream({ start(controller) { controller.enqueue(new Uint8Array(1_048_577)); }, cancel() { cancelledBody = true; } })));
check((await streamed.collect({ ...input, maxQueries: 1 })).diagnostics.status, "unavailable"); check(cancelledBody, true);

// Caller abort owns only its own work; it cancels a stalled body and launches no further query.
let bodyOpened;
const bodyReady = new Promise(resolve => { bodyOpened = resolve; });
let callerCancelledBody = false;
const cancellation = fake(() => { bodyOpened(); return new Response(new ReadableStream({ cancel() { callerCancelledBody = true; } })); });
const controller = new AbortController(), collection = cancellation.collect({ ...input, signal: controller.signal });
await bodyReady; await Promise.resolve(); controller.abort();
await rejects(collection, error => error.name === "AbortError"); check(cancellation.requests.length, 1); check(callerCancelledBody, true); check(timers.size, 0);
const early = new AbortController(); early.abort(); await rejects(cancellation.collect({ ...input, signal: early.signal }), error => error.name === "AbortError"); check(cancellation.requests.length, 1);

// The transport bound remains active until the response body completes, including beta mode.
let deadlineBodyOpened;
const deadlineReady = new Promise(resolve => { deadlineBodyOpened = resolve; });
let deadlineBodyCancelled = false;
const deadline = fake(() => { deadlineBodyOpened(); return new Response(new ReadableStream({ cancel() { deadlineBodyCancelled = true; } })); });
const timeoutCollection = deadline.collect({ ...input, maxQueries: 1 }); await deadlineReady; await Promise.resolve();
check(timers.size, 1); const timer = [...timers.values()][0]; check(timer.delay, 10_000); timer.callback();
check((await timeoutCollection).diagnostics.status, "unavailable"); check(deadlineBodyCancelled, true); check(timers.size, 0);

// Index article context is provider-labelled and cannot borrow another company's sentiment.
const raw = { title: "S&P500 index advances after economic data", summary: "The S&P 500 trades higher.", url: "https://publisher.test/index", time_published: "20261118T195900", source: "Publisher", overall_sentiment_score: .2, overall_sentiment_label: "Somewhat-Bullish", ticker_sentiment: [{ ticker: "NVDA", ticker_sentiment_score: ".9", relevance_score: ".9" }] };
const indexIdentity = { kind: "index", name: "S&P 500", newsAliases: ["S&P500", "Standard and Poor’s 500"] };
const indexNews = alpha.parseResearchNews({ feed: [raw] }, "INDEX:SPX", 250, indexIdentity);
check(indexNews.items[0].tickerSentimentScore, .2); check(indexNews.items[0].sentimentBasis, "provider-overall-index-context"); check(indexNews.items[0].tickerRelevance, .6);
check(alpha.parseResearchNews({ feed: [{ ...raw, overall_sentiment_score: undefined }] }, "INDEX:SPX", 250, indexIdentity), null);
check(alpha.parseResearchNews({ feed: [{ ...raw, overall_sentiment_score: " " }] }, "INDEX:SPX", 250, indexIdentity), null);
check(alpha.parseResearchNews({ feed: [{ ...raw, overall_sentiment_score: 0 }] }, "INDEX:SPX", 250, indexIdentity).items[0].tickerSentimentScore, 0);
check(alpha.parseResearchNews({ feed: [{ ...raw, title: "Nasdaq Composite rises", summary: "Technology stocks are higher" }] }, "INDEX:SPX", 250, indexIdentity), null);
check(alpha.parseResearchNews({ feed: [raw] }, "INDEX:SPX"), null);
check(alpha.parseResearchNews({ feed: [raw] }, "MSFT", 250, indexIdentity), null);
check(alpha.parseResearchNews({ feed: [{ ...raw, title: "Stocks advance", summary: "S&P 500 trades higher" }] }, "INDEX:SPX", 250, indexIdentity).items[0].tickerRelevance, .35);
check(alpha.parseResearchNews({ feed: [raw] }, "INDEX:UNKNOWN", 250, { kind: "index", name: "Index UNKNOWN", newsAliases: [] }), null);
check(alpha.parseResearchNews({ feed: [raw] }, "NVDA").items[0].tickerSentimentScore, .9);
check(timers.size, 0);
console.log(`Fresh research news: ${checks} deterministic checks passed (no live providers).`);
