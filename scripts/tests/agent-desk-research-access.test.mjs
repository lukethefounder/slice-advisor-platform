import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import vm from "node:vm";
import { createRequire } from "node:module";
import { EventEmitter } from "node:events";
import ts from "typescript";

const root = path.resolve(import.meta.dirname, "../.."), nativeRequire = createRequire(import.meta.url);
const NOW = Date.parse("2026-11-21T15:00:00Z"), at = new Date(NOW).toISOString(), scope = { userId: "founder-test", firmId: "firm-test" };
let assertions = 0, unauthorizedNetwork = 0, authorizations = 0;
const plain = value => JSON.parse(JSON.stringify(value));
const same = (value, expected, message) => { assert.deepEqual(plain(value), plain(expected), message); assertions++; };
const yes = (value, message) => { assert.ok(value, message); assertions++; };
const rejects = async (fn, code) => { await assert.rejects(fn, error => error.code === code); assertions++; };
const throws = (fn, code) => { assert.throws(fn, error => error.code === code); assertions++; };
class Clock extends Date { constructor(...args) { super(...(args.length ? args : [NOW])); } static now() { return NOW; } }
const signal = () => new AbortController().signal;
const globalDb = { backendPlatformEvent: {} };
const httpsCalls = [];
let pageFixture = { status: 200, contentType: "text/html", body: "<title>Issuer report</title><script>PRIVATE_SCRIPT</script><p>Observed public statement.</p>" };
const mocks = {
  "server-only": {}, "@/lib/prisma": { prisma: globalDb },
  "./access": { requireAgentDeskAccess: async candidate => { authorizations++; if (candidate.userId !== scope.userId || candidate.firmId !== scope.firmId) throw Object.assign(new Error("Founder scope required"), { code: "FOUNDER_AGENT_ACCESS_REQUIRED", status: 403 }); } },
  "@/lib/connected-research/network-service": { getResearchNetwork: async () => { throw Error("Controlled network service must be injected"); } },
  "./collaboration": { readAgentBoard: async () => [], readAgentBriefs: async () => [] },
  "node:dns/promises": { lookup: async () => { unauthorizedNetwork++; throw Error("Uncontrolled DNS is forbidden"); } },
  "node:https": { request: (url, options, onResponse) => {
    httpsCalls.push({ url: String(url), options });
    const request = new EventEmitter();
    request.end = () => {
      const response = new EventEmitter(); response.statusCode = pageFixture.status; response.headers = { "content-type": pageFixture.contentType };
      response.resume = () => {}; response.destroy = () => {};
      onResponse(response);
      queueMicrotask(() => { response.emit("data", Buffer.from(pageFixture.body)); response.emit("end"); });
    };
    return request;
  } },
};
const cache = new Map();
const context = vm.createContext({ Date: Clock, Buffer, URL, URLSearchParams, Request, Response, Headers, AbortController, AbortSignal, DOMException, TextDecoder, TextEncoder,
  structuredClone, setTimeout, clearTimeout, process: { env: {} }, fetch: async () => { unauthorizedNetwork++; throw Error("Uncontrolled internet calls are forbidden"); } });
function load(file) {
  let absolute = file.startsWith("@/") ? path.join(root, "src", file.slice(2)) : path.resolve(root, file);
  if (!path.extname(absolute)) absolute += ".ts";
  if (cache.has(absolute)) return cache.get(absolute).exports;
  const module = { exports: {} }; cache.set(absolute, module);
  const compiled = ts.transpileModule(fs.readFileSync(absolute, "utf8"), { fileName: absolute, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, esModuleInterop: true } });
  assert.equal(compiled.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0, absolute);
  const require = name => {
    if (Object.hasOwn(mocks, name)) return mocks[name];
    if (name.startsWith("@/")) return load(name);
    if (name.startsWith(".")) return load(path.resolve(path.dirname(absolute), name));
    if (name.startsWith("node:")) return nativeRequire(name);
    throw Error(`Unmocked dependency ${name}`);
  };
  vm.runInContext(`(function(require,module,exports){${compiled.outputText}\n})`, context, { filename: absolute })(require, module, module.exports);
  return module.exports;
}
const core = load("src/lib/agent-desk/research-access-core.ts"), web = load("src/lib/agent-desk/research-access-web.ts"), sharing = load("src/lib/agent-desk/research-access-sharing.ts");
const access = load("src/lib/agent-desk/research-access.ts"), platform = load("src/lib/agent-desk/research-access-platform.ts"), agents = load("src/lib/agent-desk/agents.ts");
for (const address of ["0.0.0.0", "10.0.0.1", "127.0.0.1", "169.254.169.254", "172.31.0.1", "192.168.1.1", "100.64.1.1", "198.18.0.1", "192.0.2.1", "198.51.100.1", "203.0.113.1", "224.0.0.1", "255.255.255.255", "::1", "::ffff:127.0.0.1", "fd00::1", "fe80::1", "2001:db8::1", "2001::1", "2002:7f00:1::", "64:ff9b::7f00:1"]) same(core.isPublicResearchAddress(address), false, `${address} is blocked`);
for (const address of ["8.8.8.8", "1.1.1.1", "2606:4700:4700::1111", "2001:4860:4860::8888"]) same(core.isPublicResearchAddress(address), true);
for (const url of ["http://issuer.com/a", "https://user:password@issuer.com/a", "https://localhost/a", "https://metadata.internal/a", "https://127.1/a", "https://2130706433/a", "https://[::1]/a", "https://issuer.com:8443/a", "file:///etc/passwd", "https://issuer.com/?api_key=x", "https://issuer.com/?apiKey=x", "https://issuer.com/?accessToken=x", "https://issuer.com/?X-Amz-Signature=x", "https://issuer.com/\\@internal.local/"]) same(core.publicResearchUrl(url), null, "Private and credential-bearing URL is rejected");
same(core.publicResearchUrl("https://issuer.com/report?q=MSFT#section"), "https://issuer.com/report?q=MSFT");
const discovery = { title: "Issuer reports actual earnings", url: "https://issuer.com/report", publisher: "Issuer", publishedAt: "2026-11-20T13:00:00Z", retrievedAt: at, discoveryProvider: "Google News RSS", summary: "PRIVATE_ANALYSIS_NOT_SHARED", privateNotes: "CLIENT_SECRET" };
const research = { currentResearch: { discoveries: [discovery, { ...discovery, url: "https://other.com/old", publishedAt: "2025-01-01T00:00:00Z" }, { ...discovery, url: "https://other.com/licensed", discoveryProvider: "Licensed Feed" }] }, score: { overall: 88, confidence: 21 }, privateClientDocument: "PRIVATE_DOCUMENT" };
const projected = core.projectPublicDiscoverySources(research, NOW, "opt-in-public-market-sources");
same(projected.length, 1); same(projected[0].excerpt, null); yes(!JSON.stringify(projected).includes("PRIVATE")); same(projected[0].publishedAt, "2026-11-20T13:00:00.000Z");
const rawWeb = { id: "resp_test", status: "completed", usage: { input_tokens: 300, output_tokens: 100 }, output: [
  { type: "web_search_call", status: "completed", action: { type: "search", sources: [{ url: discovery.url, title: discovery.title }, { url: "https://127.0.0.1/private", title: "unsafe" }] } },
  { type: "message", content: [{ type: "output_text", text: "Generated synthesis with unverified date. https://invented.com/not-a-source", annotations: [{ type: "url_citation", url: discovery.url, title: discovery.title }] }] },
] };
const parsed = web.parseResearchWebResponse(rawWeb, { model: "fixture-model", queries: ["MSFT filings"], retrievedAt: at, maximumCalls: 2 });
same(parsed.sources.length, 1); same(parsed.sources[0].publishedAt, null); same(parsed.usage.searchCalls, 1); same(parsed.usage.billableUsd, null);
throws(() => web.parseResearchWebResponse({ ...rawWeb, output: rawWeb.output.slice(1) }, { model: "fixture", queries: [], retrievedAt: at, maximumCalls: 2 }), "WEB_RESEARCH_UNVERIFIED");
throws(() => web.parseResearchWebResponse({ ...rawWeb, status: "incomplete" }, { model: "fixture", queries: [], retrievedAt: at, maximumCalls: 2 }), "WEB_RESEARCH_INCOMPLETE");
let cachedRow = null, providerCalls = 0;
const webDb = { backendPlatformEvent: {
  findFirst: async query => { same(query.where.userId, scope.userId); same(query.where.firmId, scope.firmId); return cachedRow; },
  upsert: async query => { same(query.create.userId, scope.userId); same(query.create.firmId, scope.firmId); yes(query.create.eventType.startsWith("SLICE_AGENT_DESK_")); cachedRow = query.create; return cachedRow; },
} };
const webDeps = { db: webDb, now: () => NOW, configuration: () => ({ key: "fixture-only-key", model: "fixture-model" }), fetch: async (url, options) => {
  providerCalls++; same(url, "https://api.openai.com/v1/responses"); same(options.redirect, "error"); const body = JSON.parse(options.body);
  same(body.max_tool_calls, 2); same(body.store, false); same(body.include, ["web_search_call.action.sources"]); same(body.tools[0].external_web_access, true); same(body.tools[0].search_context_size, "low");
  yes(!options.body.includes("fixture-only-key")); yes(!options.body.includes("PRIVATE")); return Response.json(rawWeb);
} };
const searched = await web.searchAgentPublicWeb(scope, { symbol: "MSFT", signal: signal() }, webDeps);
same(searched.status, "ready"); same(providerCalls, 1);
const reused = await web.searchAgentPublicWeb(scope, { symbol: "MSFT", signal: signal() }, webDeps);
same(reused.status, "cached"); same(reused.cacheHit, true); same(reused.retrievedAt, searched.retrievedAt); same(providerCalls, 1, "Repeated roles reuse one source inventory without extra requests");
const originalFingerprint = await web.readAgentResearchSourceFingerprint(scope, "MSFT", { db: webDb });
yes(typeof originalFingerprint === "string" && originalFingerprint.length === 64);
const laterCache = JSON.parse(cachedRow.metadataJson); laterCache.value.retrievedAt = "2026-11-21T15:01:00Z"; laterCache.value.web.retrievedAt = "2026-11-21T15:01:00Z"; laterCache.value.web.sources[0].retrievedAt = "2026-11-21T15:01:00Z"; laterCache.checksum = core.researchHash(JSON.stringify(laterCache.value)); cachedRow.metadataJson = JSON.stringify(laterCache);
same(await web.readAgentResearchSourceFingerprint(scope, "MSFT", { db: webDb }), originalFingerprint, "Retrieval-time changes alone do not trigger model reviews");
laterCache.value.web.sources[0].url = "https://issuer.com/new-report"; laterCache.checksum = core.researchHash(JSON.stringify(laterCache.value)); cachedRow.metadataJson = JSON.stringify(laterCache);
yes(await web.readAgentResearchSourceFingerprint(scope, "MSFT", { db: webDb }) !== originalFingerprint, "New actual source identities trigger review");
await rejects(() => web.readAgentResearchSourceFingerprint({ ...scope, userId: "other-user" }, "MSFT", { db: webDb }), "FOUNDER_AGENT_ACCESS_REQUIRED");
same((await web.searchAgentPublicWeb(scope, { symbol: "MSFT", enabled: false, signal: signal() }, webDeps)).status, "disabled");
same((await web.searchAgentPublicWeb(scope, { symbol: "MSFT", signal: signal() }, { ...webDeps, configuration: () => ({ key: "", model: "fixture" }) })).status, "unconfigured");
await rejects(() => web.searchAgentPublicWeb({ ...scope, userId: "other-user" }, { symbol: "MSFT", signal: signal() }, webDeps), "FOUNDER_AGENT_ACCESS_REQUIRED");
cachedRow = null;
same((await web.searchAgentPublicWeb(scope, { symbol: "MSFT", signal: signal() }, { ...webDeps, fetch: async () => new Response("SECRET_PROVIDER_ERROR", { status: 403 }) })).status, "error");
same((await web.searchAgentPublicWeb(scope, { symbol: "MSFT", signal: signal() }, { ...webDeps, fetch: async () => new Response("x".repeat(1_048_577)) })).status, "error", "Provider response bytes are capped");

const emptyWorkspace = { capabilities: [], records: [], sources: [], issues: [] };
const inventory = { version: 1, symbol: "MSFT", checkedAt: at, evidence: [], web: parsed, workspace: emptyWorkspace, shared: sharing.emptySharedResearch(), issues: [] };
let dnsLookups = 0;
const resolver = async () => { dnsLookups++; return [{ address: "93.184.216.34", family: 4 }]; };
const opened = await web.openAgentResearchSource(scope, { sourceId: parsed.sources[0].id, access: inventory, signal: signal() }, { resolve: resolver, now: () => NOW });
same(opened.contentScope, "public-page-excerpt"); same(opened.publishedAt, null); yes(opened.excerpt.includes("Observed public statement")); yes(!opened.excerpt.includes("PRIVATE_SCRIPT")); same(opened.sha256.length, 64);
same(httpsCalls[0].options.family, 4); same(httpsCalls[0].options.agent, false); same(httpsCalls[0].options.rejectUnauthorized, true); same(httpsCalls[0].options.headers["Accept-Encoding"], "identity"); yes(!("Authorization" in httpsCalls[0].options.headers));
let pinned; httpsCalls[0].options.lookup("issuer.com", {}, (error, address, family) => { assert.ifError(error); pinned = { address, family }; }); same(pinned, { address: "93.184.216.34", family: 4 });
await rejects(() => web.openAgentResearchSource(scope, { sourceId: "forged", access: inventory, signal: signal() }, { resolve: resolver }), "RESEARCH_SOURCE_NOT_AUTHORIZED"); same(dnsLookups, 1);
await rejects(() => web.openAgentResearchSource(scope, { sourceId: parsed.sources[0].id, access: inventory, signal: signal() }, { resolve: async () => [{ address: "1.1.1.1", family: 4 }, { address: "127.0.0.1", family: 4 }] }), "RESEARCH_SOURCE_BLOCKED");
pageFixture = { ...pageFixture, status: 302 }; await rejects(() => web.openAgentResearchSource(scope, { sourceId: parsed.sources[0].id, access: inventory, signal: signal() }, { resolve: resolver }), "RESEARCH_PAGE_STATUS");
pageFixture = { status: 200, contentType: "application/octet-stream", body: "binary" }; await rejects(() => web.openAgentResearchSource(scope, { sourceId: parsed.sources[0].id, access: inventory, signal: signal() }, { resolve: resolver }), "RESEARCH_PAGE_CONTENT");
pageFixture = { status: 200, contentType: "text/plain", body: "x".repeat(524_289) }; await rejects(() => web.openAgentResearchSource(scope, { sourceId: parsed.sources[0].id, access: inventory, signal: signal() }, { resolve: resolver }), "RESEARCH_PAGE_TOO_LARGE");

const publisher = { userId: "private-publisher-user", firmId: "publisher-firm" };
const consentRow = { ...publisher, eventKey: "agent-desk-public-source-consent:v1", metadataJson: JSON.stringify({ version: 1, ...publisher, enabled: true, updatedAt: at }) };
let revokeDuringRead = false, consentReads = 0, archivesRead = 0, activePublishers = true;
const sharingDb = { backendPlatformEvent: {
  findFirst: async query => { same(query.where.userId, publisher.userId); same(query.where.eventKey, "agent-desk-public-source-consent:v1"); return null; },
  upsert: async query => ({ ...query.create, metadataJson: query.update.metadataJson }),
  findMany: async query => { consentReads++; same(query.where.eventType, sharing.RESEARCH_SHARING_EVENT); return revokeDuringRead && consentReads % 2 === 0 ? [] : [consentRow]; },
}, firmMembership: { findMany: async query => { same(query.where.status, "Active"); same(query.where.user.platformStatus, "Active"); same(query.where.firm.platformStatus, "Active"); return activePublishers ? [publisher] : []; } },
sliceForecastBundle: { findMany: async query => { archivesRead++; same(query.where.userId.in, [publisher.userId]); same(query.where.symbol, "MSFT"); same(Object.keys(query.select).sort(), ["operationsJson", "researchJson", "userId"]); return [{ userId: publisher.userId, researchJson: JSON.stringify(research), operationsJson: JSON.stringify({ researchSha256: core.researchHash(JSON.stringify(research)) }) }]; } } };
same((await sharing.getResearchSharingPreference(publisher, sharingDb)).enabled, false);
const enabled = await sharing.setResearchSharingPreference(publisher, true, sharingDb); same(enabled.enabled, true); same(enabled.updatedAt, at); yes(enabled.revocation.includes("historical audit"));
let savedPreference;
const preferenceDb = { backendPlatformEvent: {
  findFirst: async query => savedPreference?.userId === query.where.userId && savedPreference?.eventKey === query.where.eventKey ? savedPreference : null,
  upsert: async query => { savedPreference = savedPreference ? { ...savedPreference, ...query.update } : query.create; return savedPreference; },
} };
await sharing.setResearchSharingPreference(publisher, true, preferenceDb);
same((await sharing.getResearchSharingPreference({ ...publisher, firmId: "another-owned-firm" }, preferenceDb)).enabled, true, "One account-wide permission is visible consistently across owned workspaces");
await sharing.setResearchSharingPreference({ ...publisher, firmId: "another-owned-firm" }, false, preferenceDb);
same((await sharing.getResearchSharingPreference(publisher, preferenceDb)).enabled, false, "Revocation does not leave another workspace opt-in active");
const pooled = await sharing.loadSharedPublicResearch(scope, "MSFT", signal(), { db: sharingDb, now: () => NOW }); same(pooled.status, "ready"); same(pooled.sourceCount, 1); yes(!JSON.stringify(pooled).includes("PRIVATE")); yes(!JSON.stringify(pooled).includes(publisher.userId));
revokeDuringRead = true; consentReads = 0;
same((await sharing.loadSharedPublicResearch(scope, "MSFT", signal(), { db: sharingDb, now: () => NOW })).sourceCount, 0, "In-flight consent revocation excludes future source results");
activePublishers = false; const previousReads = archivesRead;
same((await sharing.loadSharedPublicResearch(scope, "MSFT", signal(), { db: sharingDb, now: () => NOW })).sourceCount, 0); same(archivesRead, previousReads, "Inactive publishers are never read");
await rejects(() => sharing.loadSharedPublicResearch({ ...scope, userId: publisher.userId }, "MSFT", signal(), { db: sharingDb }), "FOUNDER_AGENT_ACCESS_REQUIRED");

const platformQueries = [];
const ownerTable = (name, rows) => ({ findMany: async query => { same(query.where.userId, scope.userId, `${name} preserves owner guard`); platformQueries.push({ name, query }); return rows; } });
const researchJson = JSON.stringify(research), graphJson = JSON.stringify({ nodes: [{ id: "n", label: "MSFT", type: "symbol" }], edges: [] });
const platformDb = {
  sliceForecastBundle: ownerTable("graph", [{ id: "own-run", symbol: "MSFT", researchRunId: "run-1", status: "ResearchOnly", provider: "Alpha Vantage", researchJson, graphJson, operationsJson: JSON.stringify({ researchSha256: core.researchHash(researchJson), graphSha256: core.researchHash(graphJson) }), asOfAt: at }]),
  sliceStrategyDefinition: ownerTable("strategy", [{ id: "rules", name: "Own entry exits", specJson: JSON.stringify({ symbols: ["MSFT"], entry: { mode: "all", rules: [{ metric: "rsi", period: 14, comparator: "<", value: 30 }] }, exit: { mode: "all", rules: [] }, privateExtra: "SHOULD_NOT_BE_PROJECTED" }), updatedAt: at }]),
  sliceStrategyRun: ownerTable("backtest", [{ id: "backtest", name: "Saved simulation", summaryJson: JSON.stringify({ universe: ["MSFT"], strategy: { totalReturnPct: 8, dailyWinRatePct: 51 } }), engineVersion: "fixture", inputSha256: "input", outputSha256: "output", createdAt: at }]),
  sliceForwardScenario: ownerTable("scenario", []), namedWatchlistItem: ownerTable("watchlist", []), headlineDecision: ownerTable("news", []), briefingReport: ownerTable("briefs", []),
};
const own = await platform.loadAgentWorkspaceResearch(scope, { symbol: "MSFT", signal: signal() }, { db: platformDb, now: () => NOW, network: async owner => { same(owner, scope); return { nodes: [], edges: [] }; }, board: async owner => { same(owner, scope); return []; }, briefs: async owner => { same(owner, scope); return []; } });
same(own.records.length, 3); same(own.sources.length, 1); same(own.records[0].data.score.confidence, 21, "Confidence is not raised by source discovery"); yes(!JSON.stringify(own).includes("SHOULD_NOT_BE_PROJECTED"));
same(platformQueries.find(row => row.name === "scenario").query.where.firmId, scope.firmId); same(platformQueries.find(row => row.name === "watchlist").query.where.watchlist.userId, scope.userId);
same(platformQueries.find(row => row.name === "briefs").query.where.clientId, null); yes(!("portfolioSummary" in platformQueries.find(row => row.name === "briefs").query.select)); same(own.capabilities.find(row => row.id === "custom-board-layout").status, "restricted");
const combined = await access.loadAgentResearchAccess(scope, { symbol: "MSFT", signal: signal() }, { workspace: async () => own, web: async () => parsed, shared: async () => pooled, now: () => NOW });
yes(combined.evidence.every(row => row.kind === "tool-research" && row.metrics.increasesResearchConfidence === false)); same(combined.evidence.filter(row => row.id === parsed.sources[0].id).length, 1, "Repeated public sources are not counted as independent observations");
same(access.searchAgentResearchInventory(combined, { query: "entry", capability: "strategies" }).networkRequests, 0);
throws(() => access.searchAgentResearchInventory(combined, { capability: "all-users-portfolios" }), "INVALID_RESEARCH_CAPABILITY");

const evidence = { id: "original-one", title: "Observed data", summary: "Actual fixture observation.", source: "Fixture", url: "https://issuer.com/observation", observedAt: at, retrievedAt: at, kind: "scored-evidence", cohort: "technical", metrics: {} };
const agentContext = { symbol: "MSFT", researchRunId: "run-1", collectedAt: at, market: null, score: null, evidence: [evidence, ...combined.evidence], gaps: [], policy: { maxPositionPct: 10, allowedSymbols: ["MSFT"] }, account: { cash: 1000, position: null }, operationsMode: "economy", researchAccess: combined, helpers: [] };
const report = { stance: "neutral", summary: "Grounded assigned analysis.", findings: [{ claim: "The original data is present.", evidenceIds: [evidence.id] }], risks: ["This is not a calibrated forecast."], missingData: [], veto: false, action: "hold", allocationPct: null, messages: [], candidateSymbol: null, lessonsReviewed: [], horizonViews: [] };
const assigned = agents.executeAgentReadTool("read_assigned_research", {}, agentContext, [], "charts");
yes(assigned.evidence.some(row => row.id === evidence.id)); yes(assigned.modules.read_workspace_research); same(assigned.modules.read_broker_status.orderAuthority, false);
throws(() => agents.executeAgentReadTool("read_workspace_research", { userId: "another-owner" }, agentContext, []), "INVALID_AGENT_TOOL");
throws(() => agents.executeAgentReadTool("place_broker_order", {}, agentContext, []), "INVALID_AGENT_TOOL");
let aiCalls = [];
const finalResponse = value => ({ status: "completed", usage: { input_tokens: 200, output_tokens: 80, input_tokens_details: { cached_tokens: 100 } }, output: [{ type: "message", content: [{ type: "output_text", text: JSON.stringify(value) }] }] });
function provider(value) { return { now: () => at, configuration: () => ({ key: "fixture-only", model: "fixture-model" }), fetch: async (_url, options) => {
  const body = JSON.parse(options.body); aiCalls.push(body);
  return Response.json(aiCalls.length === 1 ? { status: "completed", usage: { input_tokens: 100, output_tokens: 20, input_tokens_details: { cached_tokens: 50 } }, output: [{ type: "function_call", name: "read_assigned_research", call_id: "call-one", arguments: "{}" }] } : finalResponse(value));
} }; }
const agentInput = { ownerId: scope.userId, signal: signal() };
const analyzed = await agents.runResearchAgent("charts", agentContext, [], agentInput, provider(report));
same(analyzed.status, "complete"); same(aiCalls.length, 2); same(analyzed.toolCalls.map(row => row.tool), ["read_assigned_research"]); same(analyzed.usage, { requests: 2, inputTokens: 300, outputTokens: 100, cachedInputTokens: 150, measuredResponses: 2, unmeasuredResponses: 0 });
same(aiCalls[0].tool_choice.name, "read_assigned_research"); yes(aiCalls[0].tools.some(tool => tool.name === "read_broker_status")); yes(!aiCalls[0].tools.some(tool => /place|approve|cancel|order$/.test(tool.name)));
aiCalls = [];
const delegated = { ...agentContext, helperTask: { id: "helper:news:1", parentRole: "news", focus: "Inspect one source and its missing dates." } };
const helped = await agents.runResearchAgent("news", delegated, [], agentInput, provider(report)); same(helped.status, "complete", helped.error); same(helped.worker, delegated.helperTask); same(helped.horizonViews, [], "Bounded helpers are exempt from whole-role horizon requirements");
aiCalls = [];
const invalidHelper = await agents.runResearchAgent("news", delegated, [], agentInput, provider({ ...report, action: "buy", allocationPct: 5, stance: "bullish" })); same(invalidHelper.status, "failed"); same(invalidHelper.action, "hold");
aiCalls = [];
const invented = await agents.runResearchAgent("charts", agentContext, [], agentInput, provider({ ...report, findings: [{ claim: "Invented evidence", evidenceIds: ["unknown-source"] }] })); same(invented.status, "failed");
const errorUsage = await agents.runResearchAgent("charts", agentContext, [], agentInput, { configuration: () => ({ key: "fixture", model: "fixture" }), fetch: async () => new Response("SECRET_ERROR", { status: 429 }) });
same(errorUsage.usage.requests, 1); same(errorUsage.usage.unmeasuredResponses, 1); yes(!errorUsage.summary.includes("SECRET_ERROR"));
const broker = { provider: "Alpaca", mode: "paper", connected: true, controls: { enabled: true }, safeguards: {}, account: { cash: 50, equity: 80, buyingPower: 50, status: "ACTIVE" }, positions: [{ symbol: "MSFT", quantity: 1 }], activePositionSymbol: "MSFT", pendingOrder: null, observedAt: at, readiness: {}, limitations: [] };
const brokerRead = agents.executeAgentReadTool("read_broker_status", {}, { ...agentContext, broker, executionTarget: "alpaca-paper" }, []);
same(brokerRead.broker.account.cash, 50); same(brokerRead.executionTarget, "alpaca-paper"); same(brokerRead.credentialsAccessible, false); same(brokerRead.orderAuthority, false);
same(unauthorizedNetwork, 0); yes(authorizations > 10);
console.log(`Agent research access: ${assertions} checks passed (public DNS/IP pinning, URL and byte limits, real search receipts, scoped cache, explicit consent/revocation, owner read federation, helper hold-only rules, inspected evidence, combined reads and measured usage; no live network, database, accounts or orders).`);
