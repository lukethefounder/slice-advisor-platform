import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url), ts = require("typescript");
let checks = 0;
const same = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const yes = (actual, message) => { assert.ok(actual, message); checks++; };
async function load(path, dependencies = {}) {
  const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
  const compiled = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS }, fileName: path, reportDiagnostics: true });
  same(compiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0);
  const module = { exports: {} };
  const resolve = name => Object.hasOwn(dependencies, name) ? dependencies[name] : name === "server-only" ? {} : name.startsWith("node:") ? require(name) : (() => { throw new Error(`Unmocked route dependency ${name}`); })();
  new Function("require", "module", "exports", "fetch", "process", compiled.outputText)(resolve, module, module.exports,
    () => { throw new Error("No external service is permitted in route tests"); }, { env: {} });
  return module.exports;
}
class ApiError extends Error { constructor(input) { super(input.message); Object.assign(this, input); } }
const api = { ApiError, withApiRoute: (_options, handler) => request => handler({ request }), apiJson: (body, init) => Response.json(body, init) };
const contracts = await load("src/lib/agent-desk/contracts.ts"), strategy = await load("src/lib/strategy-lab/contracts.ts"), instrument = await load("src/lib/intelligence/research-instrument.ts");
const scope = { userId: "owner-founder", firmId: "active-firm" }, otherScope = { userId: "different-owner", firmId: "active-firm" };
let currentScope = scope, founder = true, signedIn = true, permittedRate = true, storageReady = true;
const trace = [], messages = [], acknowledgments = [];
const context = {
  async requireCurrentAccessContext() { trace.push("session"); if (!signedIn) throw new ApiError({ status: 401, code: "UNAUTHENTICATED", message: "Sign in." }); return { user: { id: currentScope.userId }, firm: { id: currentScope.firmId } }; },
};
const security = {
  isPotentiallyCrossSiteUnsafeRequest(request) { trace.push("origin"); return request.headers.get("sec-fetch-site") === "cross-site"; },
  checkRateLimit(input) { trace.push({ rate: input }); return { allowed: permittedRate }; },
  getClientIp() { return "fixture-ip"; }, hashForSecurity() { return "fixture-hash"; },
};
const access = await load("src/lib/connected-research/access.ts", { "@/lib/api-route": api, "@/lib/access-control": context, "@/lib/security": security });
const readiness = { async requireResearchStorage(tables) { trace.push("storage"); same(tables, ["BackendPlatformEvent"]); if (!storageReady) { const error = new Error("controlled storage error"); error.code = "STORAGE_FIXTURE"; throw error; } } };
const failures = { databaseFailure: error => error.code === "STORAGE_FIXTURE" ? { status: 503, code: "DATABASE_NOT_READY", message: "Storage is unavailable." } : null, routeStorageRequirements: () => [] };
const http = await load("src/lib/strategy-lab/http.ts", {
  "@/lib/data-readiness/server": readiness, "@/lib/data-readiness/core": failures, "@/lib/api-route": api,
  "@/lib/access-control": context, "@/lib/security": security, "./contracts": strategy,
});
const ownedCycle = { cycle: { id: "cycle-owned", symbol: "MSFT", researchRunId: "research-owned", sourceHash: "b".repeat(64) } };
const journal = {
  async readAgentCollaboration(received) { trace.push("read"); same(received, currentScope); return { board: messages.filter(item => item.scope.userId === received.userId && item.scope.firmId === received.firmId).map(item => item.message), briefs: [], learning: { advisoryOnly: true } }; },
  async appendAgentBoardMessage(received, message) { trace.push("append"); same(received, currentScope); messages.push({ scope: structuredClone(received), message: structuredClone(message) }); return message; },
  async markAgentBriefRead(received, id) { trace.push("acknowledge"); same(received, currentScope); if (received.userId !== scope.userId || id !== "brief:owned") throw new contracts.AgentDeskError("AGENT_BRIEF_NOT_FOUND", "Not found.", 404); acknowledgments.push(id); },
};
const routes = await load("src/app/api/intelligence/agent-desk/collaboration/route.ts", {
  "@/lib/api-route": api, "@/lib/connected-research/access": access, "@/lib/strategy-lab/http": http, "@/lib/strategy-lab/contracts": strategy,
  "@/lib/data-readiness/server": readiness, "@/lib/data-readiness/core": failures, "@/lib/intelligence/research-instrument": instrument,
  "@/lib/agent-desk/contracts": contracts,
  "@/lib/agent-desk/access": { async requireAgentDeskAccess(received) { trace.push("founder"); same(received, currentScope); if (!founder) throw new contracts.AgentDeskError("FOUNDER_AGENT_ACCESS_REQUIRED", "Founder access required.", 403); } },
  "@/lib/agent-desk/collaboration": journal,
  "@/lib/agent-desk/collaboration-storage": { validArtifactId: value => typeof value === "string" && /^[A-Za-z0-9:_.-]{1,200}$/.test(value) },
  "@/lib/agent-desk/store": {
    async readDeskCycle(received, id) { trace.push("cycle"); return received.userId === scope.userId && received.firmId === scope.firmId && id === "cycle-owned" ? structuredClone(ownedCycle) : null; },
    async readDeskRecord(received) { trace.push("desk"); same(received, currentScope); return { state: { settings: { symbol: "MSFT" } } }; },
  },
});
const url = "https://slice.example/api/intelligence/agent-desk/collaboration";
function request(body, headers = {}) { return new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) }); }
async function denied(action, status, code) { await assert.rejects(action, error => error.status === status && error.code === code); checks++; }
function resetTrace() { trace.length = 0; }

same(routes.runtime, "nodejs"); same(routes.dynamic, "force-dynamic");
const get = await routes.GET(new Request(url));
same(get.status, 200); same(get.headers.get("cache-control"), "private, no-store"); same((await get.json()).ok, true);
yes(trace.indexOf("founder") < trace.indexOf("storage") && trace.indexOf("storage") < trace.indexOf("read"), "Founder eligibility precedes any storage access");
same(trace.find(item => item.rate).rate.limit, 90);

founder = false;
for (const action of [() => routes.GET(new Request(url)), () => routes.POST(request({ action: "message", body: "A note" }))]) {
  resetTrace(); await denied(action, 403, "FOUNDER_AGENT_ACCESS_REQUIRED"); yes(!trace.includes("storage") && !trace.includes("read") && !trace.includes("append"));
}
founder = true; signedIn = false; resetTrace();
await denied(() => routes.GET(new Request(url)), 401, "UNAUTHENTICATED"); yes(!trace.includes("founder")); signedIn = true;
permittedRate = false; resetTrace();
await denied(() => routes.POST(request({ action: "message", body: "Rate-limited note" })), 429, "RATE_LIMITED"); yes(!trace.includes("founder")); permittedRate = true;
resetTrace(); await denied(() => routes.POST(request({ action: "message", body: "Cross-site note" }, { "sec-fetch-site": "cross-site" })), 403, "CROSS_SITE_BLOCKED");
same(trace, ["origin"], "Cross-site writes stop before session or founder storage");
storageReady = false; resetTrace(); await denied(() => routes.GET(new Request(url)), 503, "DATABASE_NOT_READY"); yes(!trace.includes("read")); storageReady = true;

resetTrace(); const posted = await routes.POST(request({ action: "message", body: "  Review prior losses before another paper entry.  " }));
same(posted.status, 200); same(posted.headers.get("cache-control"), "private, no-store"); same((await posted.json()).collaboration.board.length, 1);
same(trace.find(item => item.rate).rate.limit, 20);
const first = messages[0].message;
yes(/^founder:[0-9a-f-]{36}$/.test(first.id)); same(first.cycleId, first.id); same(first.from, "founder"); same(first.to, "team"); same(first.symbol, "MSFT");
same(first.body, "Review prior losses before another paper entry."); same(first.evidenceIds, []); same(first.report, null); same(first.replyToIds, []); same(first.researchRunId, null); same(first.sourceHash, null);
yes(Number.isFinite(Date.parse(first.createdAt)), "The server supplies the message clock");
await routes.POST(request({ action: "message", body: "Review this explicit index as context.", to: "chief", symbol: "^gspc" }));
same(messages.at(-1).message.symbol, "INDEX:SPX"); same(messages.at(-1).message.to, "chief");
await routes.POST(request({ action: "message", body: "Review the source disagreement in this cycle.", cycleId: "cycle-owned", symbol: "msft" }));
same(messages.at(-1).message.cycleId, ownedCycle.cycle.id); same(messages.at(-1).message.researchRunId, ownedCycle.cycle.researchRunId); same(messages.at(-1).message.sourceHash, ownedCycle.cycle.sourceHash);

const safeMessageCount = messages.length;
for (const patch of [
  { body: "" }, { body: "  " }, { body: "x".repeat(4001) }, { body: 4 }, { body: "text\u0000control" },
  { from: "chief" }, { userId: "other-owner" }, { firmId: "other-firm" }, { id: "chosen-id" }, { createdAt: "2020-01-01" },
  { report: { role: "chief", action: "buy" } }, { evidenceIds: ["invented-evidence"] }, { sourceHash: "claimed-hash" }, { replyToIds: ["cross-owner"] },
  { to: "everyone" }, { to: null }, { to: {} }, { cycleId: "../../foreign" }, { cycleId: null }, { cycleId: "x".repeat(201) },
]) await denied(() => routes.POST(request({ action: "message", body: "A valid note", ...patch })), 400, "INVALID_FOUNDER_MESSAGE");
for (const symbol of ["", " ", "../account", "A".repeat(33), 3, null]) await denied(() => routes.POST(request({ action: "message", body: "A note", symbol })), 400, "INVALID_AGENT_SYMBOL");
await denied(() => routes.POST(request({ action: "message", body: "A note", cycleId: "not-owned" })), 404, "AGENT_CYCLE_NOT_FOUND");
await denied(() => routes.POST(request({ action: "message", body: "A note", cycleId: "cycle-owned", symbol: "NVDA" })), 400, "AGENT_MESSAGE_SYMBOL_MISMATCH");
currentScope = otherScope;
await denied(() => routes.POST(request({ action: "message", body: "A note", cycleId: "cycle-owned" })), 404, "AGENT_CYCLE_NOT_FOUND");
same((await (await routes.GET(new Request(url))).json()).collaboration.board, [], "Another owner cannot read the founder's private notes");
currentScope = { userId: scope.userId, firmId: "different-firm" };
await denied(() => routes.POST(request({ action: "message", body: "A note", cycleId: "cycle-owned" })), 404, "AGENT_CYCLE_NOT_FOUND");
currentScope = scope;
same(messages.length, safeMessageCount, "Invalid commands never become private board messages");

await routes.POST(request({ action: "read-brief", id: "brief:owned" })); same(acknowledgments, ["brief:owned"]);
await denied(() => routes.POST(request({ action: "read-brief", id: "brief:foreign" })), 404, "AGENT_BRIEF_NOT_FOUND");
for (const body of [{ action: "read-brief" }, { action: "read-brief", id: "unsafe/path" }, { action: "read-brief", id: "brief:owned", userId: "owner" }, { action: "read-brief", id: "brief:owned", readAt: "forged" }])
  await denied(() => routes.POST(request(body)), 400, "INVALID_AGENT_BRIEF_COMMAND");
for (const action of ["arm", "enable", "kill", "settings", "trade", "send-email", "", null])
  await denied(() => routes.POST(request({ action })), 400, "INVALID_AGENT_COLLABORATION_COMMAND");
await denied(() => routes.POST(request("invalid-json")), 400, "INVALID_JSON");
await denied(() => routes.POST(request([])), 400, "INVALID_JSON");
await denied(() => routes.POST(request({ action: "message", body: "text" }, { "content-type": "text/plain" })), 415, "JSON_REQUIRED");
await denied(() => routes.POST(request({ action: "message", body: "x".repeat(64_001) })), 413, "BODY_TOO_LARGE");
same(messages.length, safeMessageCount); same(acknowledgments, ["brief:owned"]);

console.log(`Agent Desk collaboration route: ${checks} checks passed (founder-first access, owner/firm cycle isolation, write origin/rate guards, server-bound notes, strict commands, JSON limits, private responses and brief acknowledgments; no live database/provider calls).`);
