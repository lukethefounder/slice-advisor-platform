import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { resolve } from "node:path";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url), ts = require("typescript"), root = fileURLToPath(new URL("../..", import.meta.url));
let assertions = 0, scenarios = 0;
const yes = (value, message) => { assert.ok(value, message); assertions++; };
const check = (value, expected, message) => { assert.deepEqual(value, expected, message); assertions++; };
const denied = async action => { await assert.rejects(action, error => error.status === 403); assertions++; };
const ownerAccess = (email = "founder@example.test") => ({ user: { id: "owner", name: "Owner", email, platformStatus: "Active" }, firm: { id: "firm", name: "Firm", platformStatus: "Active" }, membership: { status: "Active", role: "Founder" }, isFounder: true, permissions: ["*"] });
const env = { SLICE_FOUNDER_EMAILS: "  Founder@Example.Test , second@example.test " }, scope = { userId: "owner", firmId: "firm" };
let current = ownerAccess(), storageChecks = 0, serviceReads = 0, serviceWrites = 0, cancellations = 0, retries = 0, resumes = 0;
const enqueued = [], queried = [], pendingAfter = [], modules = new Map();
class ApiError extends Error { constructor(input) { super(input.message); Object.assign(this, input); } }
const api = { ApiError, apiJson: (body, options = {}) => ({ body, status: options.status ?? 200, headers: options.headers ?? {} }), withApiRoute: (_options, handler) => request => handler({ request, log: { warn() {} } }) };
const now = new Date(), old = new Date(now.valueOf() - 30 * 60000);
const job = (id, jobKey, userId = "owner", firmId = "firm", status = "Queued") => ({ id, jobKey, userId, firmId, jobName: id, status, startedAt: now, completedAt: null, durationMs: null, resultJson: "{}", error: null, createdAt: now, updatedAt: old });
const data = {
  backendJobRun: [job("agent-own", "agent_desk_cycle"), job("scout-own", "agent_desk_scout"), job("agent-other", "agent_desk_cycle", "other"), job("agent-other-firm", "agent_desk_scout", "owner", "other-firm"), job("ordinary-own", "intelligence_graph_refresh"), job("ordinary-other", "market_watchlists", "other"), job("private-failure", "agent_desk_cycle", "other", "firm", "DeadLetter")],
  backendPlatformEvent: [{ id: "private-event", userId: "owner", firmId: "firm", eventType: "SLICE_AGENT_DESK_BOARD_V1", metadataJson: '{"body":"private conversation"}' }, { id: "ordinary-event", userId: "owner", firmId: "firm", eventType: "system.health.checked", metadataJson: "{}" }],
  backendJobDefinition: [{ id: "private-definition", userId: "owner", firmId: "firm", jobKey: "agent_desk_cycle", lastResultJson: "{}" }, { id: "scout-definition", userId: "owner", firmId: "firm", jobKey: "agent_desk_scout", lastResultJson: "{}" }, { id: "ordinary-definition", userId: "owner", firmId: "firm", jobKey: "intelligence_graph_refresh", lastResultJson: "{}" }],
};
const receiptTypes = ["queued", "completed", "retry_scheduled", "cancelled", "failed"];
data.backendPlatformEvent.push(...receiptTypes.flatMap(phase => ["agent_desk_cycle", "agent_desk_scout"].map(jobKey => ({ id: `legacy-${jobKey}-${phase}`, userId: "owner", firmId: "firm", sourceType: "BackendJobRun", sourceId: "private-agent-job-id", eventType: `background_job.${phase}`, metadataJson: JSON.stringify({ jobKey }, null, 2) }))));
data.backendPlatformEvent.push({ id: "ordinary-job-event", userId: "owner", firmId: "firm", eventType: "background_job.completed", metadataJson: '{"jobKey":"intelligence_graph_refresh"}' });
function matches(row, where = {}) {
  return Object.entries(where ?? {}).every(([key, value]) => {
    if (key === "OR") return value.some(item => matches(row, item));
    if (key === "AND") return (Array.isArray(value) ? value : [value]).every(item => matches(row, item));
    if (key === "NOT") return !(Array.isArray(value) ? value.some(item => matches(row, item)) : matches(row, value));
    if (value && typeof value === "object" && !(value instanceof Date)) return Object.entries(value).every(([operator, operand]) => operator === "in" ? operand.includes(row[key]) : operator === "notIn" ? !operand.includes(row[key]) : operator === "startsWith" ? String(row[key]).startsWith(operand) : operator === "contains" ? String(row[key]).includes(operand) : operator === "lt" ? row[key] < operand : operator === "gte" ? row[key] >= operand : operator === "equals" ? row[key] === operand : false);
    return row[key] === value;
  });
}
const prisma = new Proxy({}, { get(_target, model) {
  return {
    async findMany(input = {}) { queried.push({ model, method: "findMany", input }); return (data[model] ?? []).filter(row => matches(row, input.where)).slice(0, input.take ?? Infinity); },
    async findFirst(input = {}) { queried.push({ model, method: "findFirst", input }); if (model === "firmMembership") return { firmId: "firm" }; return (data[model] ?? []).find(row => matches(row, input.where)) ?? null; },
    async count(input = {}) { queried.push({ model, method: "count", input }); return (data[model] ?? []).filter(row => matches(row, input.where)).length; },
    async groupBy(input = {}) { queried.push({ model, method: "groupBy", input }); const groups = new Map(); for (const row of (data[model] ?? []).filter(row => matches(row, input.where))) groups.set(row.status, (groups.get(row.status) ?? 0) + 1); return [...groups].map(([status, count]) => ({ status, _count: { _all: count } })); },
  };
} });
const keys = ["intelligence_graph_refresh", "market_watchlists", "agent_desk_cycle", "agent_desk_scout"];
function load(path) {
  if (modules.has(path)) return modules.get(path).exports;
  const module = { exports: {} }; modules.set(path, module);
  const output = ts.transpileModule(readFileSync(resolve(root, path), "utf8"), { fileName: path, reportDiagnostics: true, compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.CommonJS, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } });
  check(output.diagnostics.filter(row => row.category === ts.DiagnosticCategory.Error).length, 0, `${path} transpiles`);
  const imports = specifier => {
    if (specifier === "server-only") return {};
    if (specifier === "@/lib/api-route") return api;
    if (specifier === "@/lib/prisma") return { prisma };
    if (specifier === "@/generated/prisma/client") return { Prisma: {} };
    if (specifier === "@/lib/access-control") return { getAccessContextForUser: async () => current, requireCurrentAccessContext: async () => { if (!current) throw new ApiError({ status: 401, message: "Authentication required" }); return current; }, hasFirmPermission: () => true };
    if (specifier === "@/lib/auth") return { getCurrentUser: async () => current?.user ?? null };
    if (specifier === "@/lib/founder-access") return load("src/lib/founder-access.ts");
    if (specifier === "@/lib/agent-desk/access") return load("src/lib/agent-desk/access.ts");
    if (specifier === "./contracts" || specifier === "@/lib/agent-desk/contracts") return load("src/lib/agent-desk/contracts.ts");
    if (specifier === "@/lib/agent-desk/guardrails") return load("src/lib/agent-desk/guardrails.ts");
    if (specifier === "@/lib/background-jobs/queue") return { ...load("src/lib/background-jobs/queue.ts"), requestBackgroundJobCancellation: async () => { cancellations++; return {}; }, retryBackgroundJob: async () => { retries++; return {}; }, recoverStalledBackgroundJobs: async () => { resumes++; return 0; } };
    if (specifier === "@/lib/logger") return { createLogger: () => ({ info() {}, warn() {}, error() {}, debug() {} }) };
    if (specifier === "@/lib/research/beta-policy") return { researchBetaEnabled: () => true };
    if (specifier === "@/lib/backend/jobs") return { SUPPORTED_BACKGROUND_JOB_KEYS: keys, isSupportedBackgroundJobKey: key => keys.includes(key), requiredPermissionForBackgroundJob: () => null, enqueueBackendJob: async (_context, key) => { enqueued.push(key); return { duplicate: false, job: {} }; } };
    if (specifier === "@/lib/security") return { checkRateLimit: () => ({ allowed: true }), getClientIp: () => "test", hashForSecurity: () => "hash", isPotentiallyCrossSiteUnsafeRequest: () => false };
    if (specifier === "@/lib/backend/events") return { emitBackendEvent: async () => {} };
    if (specifier === "@/lib/backend/notifications") return { queueBackendDelivery: async () => ({ id: "delivery" }) };
    if (specifier === "@/lib/backend/vendors") return { ensureBackendVendors: async () => {} };
    if (specifier === "next/server") return { after: callback => pendingAfter.push(callback), NextResponse: { json: api.apiJson } };
    if (specifier === "@/lib/background-jobs/worker") return { processBackgroundJobIds: async () => {} };
    if (specifier === "@/lib/connected-research/access") return { connectedAccess: async () => { if (!current) throw new ApiError({ status: 401, message: "Authentication required" }); return scope; } };
    if (specifier === "@/lib/strategy-lab/http") return { readResearchJson: request => request.json() };
    if (specifier === "@/lib/strategy-lab/contracts") return load("src/lib/strategy-lab/contracts.ts");
    if (specifier === "@/lib/data-readiness/server") return { requireResearchStorage: async () => { storageChecks++; } };
    if (specifier === "@/lib/data-readiness/core") return { databaseFailure: () => null };
    if (specifier === "@/lib/agent-desk/service") return { readAgentDesk: async () => { serviceReads++; return { executionMode: "paper" }; }, queueDeskCycle: async () => { serviceWrites++; return "queued"; }, queueDeskScout: async () => { serviceWrites++; return "queued"; }, updateDeskControls: async () => { serviceWrites++; }, approveDeskCycle: async () => { serviceWrites++; } };
    if (specifier.startsWith("@/")) return {};
    return require(specifier);
  };
  const expose = path === "src/lib/production/readiness.ts" ? "\nmodule.exports.queueCheckForTest = queueCheck;" : "";
  new Function("require", "module", "exports", "process", output.outputText + expose)(imports, module, module.exports, { env });
  return module.exports;
}
const access = load("src/lib/agent-desk/access.ts"), queue = load("src/lib/background-jobs/queue.ts");
const jobs = load("src/app/api/jobs/route.ts"), jobRoute = load("src/app/api/jobs/[id]/route.ts"), desk = load("src/app/api/intelligence/agent-desk/route.ts"), kernel = load("src/app/api/backend-kernel/route.ts"), readiness = load("src/app/api/backend-readiness/route.ts");
const request = (path, method = "GET", body) => new Request(`https://slice.example${path}`, { method, ...(body ? { headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) } : {}) });
const failures = [];
async function test(name, action) { try { await action(); scenarios++; } catch (error) { failures.push(new Error(name, { cause: error })); console.error(`FAIL ${name}: ${error.message}`); } finally { current = ownerAccess(); env.SLICE_FOUNDER_EMAILS = " Founder@Example.Test , second@example.test "; } }

await test("Only configured emails grant founder access, including after allowlist removal", async () => {
  for (const email of ["founder@example.test", " FOUNDER@EXAMPLE.TEST ", "second@example.test"]) check(access.isAgentDeskFounder(email), true);
  for (const email of ["member@example.test", "", undefined, null, { email: "founder@example.test" }]) check(access.isAgentDeskFounder(email), false);
  await access.requireAgentDeskAccess(scope); check(await access.requireCurrentAgentDeskAccess(), scope);
  env.SLICE_FOUNDER_EMAILS = ""; check(access.isAgentDeskFounder("founder@example.test"), false); await denied(() => access.requireAgentDeskAccess(scope));
  env.SLICE_FOUNDER_EMAILS = "second@example.test"; await denied(() => access.requireCurrentAgentDeskAccess());
});

await test("Firm, owner, user status and job ownership are all enforced independently of roles", async () => {
  for (const altered of [{ ...ownerAccess(), user: { ...ownerAccess().user, email: "member@example.test" } }, { ...ownerAccess(), user: { ...ownerAccess().user, platformStatus: "Suspended" } }, { ...ownerAccess(), firm: { ...ownerAccess().firm, platformStatus: "Suspended" } }, { ...ownerAccess(), firm: null }]) { current = altered; await denied(() => access.requireAgentDeskAccess(scope)); }
  current = ownerAccess(); await denied(() => access.requireAgentDeskAccess({ ...scope, userId: "other" })); await denied(() => access.requireAgentDeskAccess({ ...scope, firmId: "other-firm" }));
  for (const key of ["agent_desk_cycle", "agent_desk_scout"]) { access.assertAgentJobViewer(current, { jobKey: key, ...scope }); assertions++; await denied(async () => access.assertAgentJobViewer(current, { jobKey: key, userId: "other", firmId: "firm" })); }
  current = ownerAccess("member@example.test"); access.assertAgentJobViewer(current, { jobKey: "intelligence_graph_refresh", ...scope }); assertions++;
});

await test("Queue visibility filters private jobs before pagination and metric aggregation", async () => {
  check((await queue.listBackgroundJobs({ firmId: "firm", limit: 1 })).map(job => job.id), ["ordinary-own"]);
  check((await queue.getBackgroundJobMetrics({ firmId: "firm" })).queued, 2); check((await queue.getBackgroundJobMetrics({ firmId: "firm" })).deadLetter, 0);
  const viewer = { ...scope, founder: true };
  check((await queue.listBackgroundJobs({ firmId: "firm", agentViewer: viewer })).map(job => job.id), ["agent-own", "scout-own", "ordinary-own", "ordinary-other"]);
  check((await queue.getBackgroundJobMetrics({ firmId: "firm", agentViewer: viewer })).queued, 4);
  check((await queue.listBackgroundJobs({ firmId: "firm", agentViewer: { ...viewer, founder: "true" } })).length, 2, "Truthy client strings do not grant queue visibility");
});

await test("Every agent queue lifecycle event is private and earlier receipts remain concealed", () => {
  for (const phase of receiptTypes) {
    for (const key of ["agent_desk_cycle", "agent_desk_scout"]) check(queue.backgroundJobEventType(key, `background_job.${phase}`), `SLICE_AGENT_DESK_JOB_${phase.toUpperCase()}`);
    check(queue.backgroundJobEventType("intelligence_graph_refresh", `background_job.${phase}`), `background_job.${phase}`);
  }
  const visible = data.backendPlatformEvent.filter(row => matches(row, queue.backgroundJobEventVisibilityWhere()));
  check(visible.map(row => row.id), ["ordinary-event", "ordinary-job-event"]);
  yes(!JSON.stringify(visible).includes("private-agent-job-id"));
});

await test("Generic firm job lists expose the same filtered population as their counts", async () => {
  current = ownerAccess("member@example.test"); let result = await jobs.GET(request("/api/jobs?scope=firm&includePayload=1&limit=1"));
  check(result.body.jobs.map(job => job.id), ["ordinary-own"]); check(result.body.metrics.queued, 2); check(result.body.metrics.deadLetter, 0);
  current = ownerAccess(); result = await jobs.GET(request("/api/jobs?scope=firm&includePayload=1"));
  check(result.body.jobs.map(job => job.id), ["agent-own", "scout-own", "ordinary-own", "ordinary-other"]); check(result.body.metrics.queued, 4);
});

await test("Generic job detail and control routes cannot reveal or mutate another private desk", async () => {
  current = ownerAccess("member@example.test"); const before = { cancellations, retries, resumes, after: pendingAfter.length };
  for (const id of ["agent-own", "scout-own"]) { await denied(() => jobRoute.GET(request(`/api/jobs/${id}?scope=firm&includePayload=1`))); for (const action of ["cancel", "retry", "resume"]) await denied(() => jobRoute.PATCH(request(`/api/jobs/${id}`, "PATCH", { action, firmScope: true }))); }
  check({ cancellations, retries, resumes, after: pendingAfter.length }, before);
  current = ownerAccess(); await denied(() => jobRoute.GET(request("/api/jobs/agent-other?scope=firm"))); await denied(() => jobRoute.PATCH(request("/api/jobs/agent-other", "PATCH", { action: "retry", firmScope: true })));
  check((await jobRoute.GET(request("/api/jobs/agent-own"))).body.job.id, "agent-own");
});

await test("Agent API rejects nonfounders before storage, reads or command dispatch", async () => {
  current = ownerAccess("member@example.test"); const before = { storageChecks, serviceReads, serviceWrites };
  await denied(() => desk.GET(request("/api/intelligence/agent-desk")));
  for (const action of ["cycle", "scout", "enable", "settings", "approve"]) await denied(() => desk.POST(request("/api/intelligence/agent-desk", "POST", { action, revision: 0, paperOnly: true })));
  check({ storageChecks, serviceReads, serviceWrites }, before);
  current = ownerAccess(); const result = await desk.GET(request("/api/intelligence/agent-desk")); check(result.body.desk.executionMode, "paper"); check(result.headers["Cache-Control"], "private, no-store");
});

await test("Backend Kernel filters private jobs and rejects alternate mutation paths", async () => {
  current = ownerAccess("member@example.test"); const result = await kernel.GET(request("/api/backend-kernel"));
  check(result.body.jobs.map(row => row.id), ["ordinary-definition"]); check(result.body.jobRuns.map(row => row.id), ["ordinary-own"]); check(result.body.jobMetrics.queued, 1); check(result.body.events.map(row => row.id), ["ordinary-event", "ordinary-job-event"]);
  const before = { cancellations, retries, enqueued: enqueued.length };
  for (const action of ["cancelJob", "retryJob"]) await denied(() => kernel.POST(request("/api/backend-kernel", "POST", { action, jobId: "agent-own" })));
  for (const jobKey of ["agent_desk_cycle", "agent_desk_scout"]) await denied(() => kernel.POST(request("/api/backend-kernel", "POST", { action: "runJob", jobKey })));
  check({ cancellations, retries, enqueued: enqueued.length }, before);
  current = ownerAccess(); await kernel.POST(request("/api/backend-kernel", "POST", { action: "runCoreJobs" }));
  check(enqueued.slice(before.enqueued), ["intelligence_graph_refresh", "market_watchlists"], "Generic core jobs cannot start the private agent network implicitly");
});

await test("Readiness dashboards omit private conversations and private job definitions", async () => {
  for (const email of ["member@example.test", "founder@example.test"]) { current = ownerAccess(email); const result = await readiness.GET(); check(result.body.events.map(row => row.id), ["ordinary-event", "ordinary-job-event"]); check(result.body.jobs.map(row => row.id), ["ordinary-definition"]); yes(!JSON.stringify(result.body).includes("private conversation")); yes(!JSON.stringify(result.body).includes("private-agent-job-id")); }
});

await test("Production queue health omits private metadata consistently from counts and latest job", async () => {
  const production = load("src/lib/production/readiness.ts"), start = queried.length;
  const result = await production.queueCheckForTest("firm");
  yes(result.state !== "blocked", "Queue fixture must execute successfully"); yes(!JSON.stringify(result).includes("agent_desk")); yes(!JSON.stringify(result).includes("private-failure"));
  const reads = queried.slice(start).filter(item => item.model === "backendJobRun");
  check(reads.length, 5); for (const read of reads) check(read.input.where.jobKey.notIn, ["agent_desk_cycle", "agent_desk_scout"]);
});

if (failures.length) throw new AggregateError(failures, `${failures.length} founder access scenarios failed`);
console.log(`Founder agent access: ${scenarios} scenarios and ${assertions} assertions passed.`);
