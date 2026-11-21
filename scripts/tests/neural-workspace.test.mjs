import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const temporary = await mkdtemp(join(tmpdir(), "slice-neural-workspace-"));
const asOf = "2026-11-18T20:00:00.000Z";
const modules = {
  "research-evidence": "src/lib/intelligence/research-evidence.ts",
  "brief-highlight": "src/lib/workspace/brief-highlight.ts",
  "home-summary": "src/lib/instant-workspace/home-summary.ts",
  "home-route": "src/app/api/workspace/home/route.ts",
};

try {
  await writeFile(join(temporary, "mocks.mjs"), `
    let records = [], userId = "owner-a", briefFailure = false;
    const queries = [];
    export const setRecords = value => { records = value; };
    export const setUser = value => { userId = value; };
    export const failBrief = value => { briefFailure = value; };
    export const getQueries = () => queries;
    export const resetQueries = () => { queries.length = 0; };
    export const clientScopeWhere = context => ({ userId: context.user.id, firmId: context.firm.id });
    function model(name) { return { async count(query) { queries.push({ model: name, query }); return 0; }, async findMany(query) { queries.push({ model: name, query }); return []; } }; }
    export const prisma = {
      clientProfile: model("clients"), meetingTask: model("tasks"), personalUserBotApprovalItem: model("approvals"),
      sliceForwardScenario: model("scenarios"), sliceForecastBundle: model("research"),
      advisorDayBrief: { async findFirst(query) {
        queries.push({ model: "brief", query });
        if (briefFailure) throw new Error("Fixture database unavailable");
        return records.filter(row => row.userId === query.where.userId && row.title.startsWith(query.where.title.startsWith))
          .sort((a,b) => new Date(b.createdAt) - new Date(a.createdAt))[0] ?? null;
      } }
    };
    export async function studioAccess() {
      if (!userId) { const error = new Error("Sign in"); error.status = 401; throw error; }
      return { userId, firmId: "firm-a", context: { user: { id: userId, name: "Fixture User" }, firm: { id: "firm-a", name: "Fixture Firm" }, membership: { role: "Advisor" } } };
    }
    export const PRIVATE_HEADERS = { "Cache-Control": "private, no-store" };
    export const failure = error => Response.json({ message: error.message }, { status: error.status ?? 500, headers: PRIVATE_HEADERS });
  `);

  for (const [name, path] of Object.entries(modules)) {
    const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source.replace(/^import ["']server-only["'];?\s*$/m, ""), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, fileName: path, reportDiagnostics: true,
    });
    assert.equal(compiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `${name} must transpile`);
    const output = compiled.outputText.replace(/from (["'])([^"']+)\1/g, (match, _quote, specifier) => {
      if (specifier.startsWith("node:")) return match;
      const local = specifier.match(/\/(research-evidence|brief-highlight|home-summary)$/)?.[1];
      return local ? `from "./${local}.mjs"` : 'from "./mocks.mjs"';
    });
    await writeFile(join(temporary, `${name}.mjs`), output);
  }
  const load = name => import(pathToFileURL(join(temporary, `${name}.mjs`)).href);
  const { selectWorkspaceBriefHighlight: select } = await load("brief-highlight");
  const { readHomeSummary } = await load("home-summary");
  const route = await load("home-route"), mocks = await load("mocks");
  const security = (symbol = "NVDA", extra = {}) => ({ symbol, name: `${symbol} fixture company`, industryName: "Semiconductors", overallRank: 1, score: 74.6, confidence: 61.5, explanation: "Demand evidence supports the saved ranking.", positiveDrivers: ["Recorded demand"], riskFlags: ["Recorded valuation risk"], sourceIds: ["relevant", "duplicate", "unsafe"], quote: { symbol, price: 140.25, changePercent: 1.8, timestamp: asOf }, ...extra });
  const brief = (securities = [security()], extra = {}) => ({ schemaVersion: "slice-advisor-market-brief-1.0.0", briefId: "brief-a", title: "Fixture daily brief", generatedAt: asOf, marketAsOf: asOf, providerMode: "Delayed", dataQuality: 78, warnings: ["Provider observation is delayed."], overallRankedSecurities: securities, sources: [
    { id: "relevant", label: "Primary source", publisher: "Publisher A", url: "https://publisher.example/report?id=1&apikey=PRIVATE&utm_source=feed#section", asOf },
    { id: "duplicate", label: "Syndicated link", publisher: "Publisher A", url: "https://publisher.example/report?id=1", asOf },
    { id: "unrelated", label: "Other security", publisher: "Publisher B", url: "https://other.example/report", asOf },
    { id: "unsafe", label: "Invalid", publisher: "Invalid", url: "javascript:alert(1)", asOf },
  ], ...extra });
  const record = (value = brief(), extra = {}) => ({ id: "saved-a", userId: "owner-a", title: "Slice Advisor Market Brief · fixture", createdAt: new Date(asOf), metricsJson: JSON.stringify({ kind: "ADVISOR_MARKET_BRIEF_V1", brief: value }), ...extra });

  const selected = select(record());
  assert.equal(selected.symbol, "NVDA");
  assert.equal(selected.recordId, "saved-a");
  assert.equal(selected.score, 74.6);
  assert.equal(selected.confidence, 61.5);
  assert.equal(selected.price, 140.25);
  assert.equal(selected.quoteAsOf, asOf);
  assert.equal(selected.providerMode, "Delayed");
  assert.deepEqual(selected.riskFlags, ["Recorded valuation risk"]);
  assert.deepEqual(selected.warnings, ["Provider observation is delayed."]);
  assert.equal(selected.sources.length, 1, "Only distinct safe sources cited by the featured stock belong to its brief card");
  assert.equal(selected.sources[0].url, "https://publisher.example/report?id=1");
  assert.equal(JSON.stringify(selected).includes("PRIVATE"), false);

  const ranked = select(record(brief([security("AMD", { score: 55, overallRank: 2 }), security("NVDA", { score: 95, overallRank: 1 })])));
  assert.equal(ranked.symbol, "AMD", "Preserve the saved ranking order instead of silently reranking by score");
  assert.equal(ranked.rank, 2);
  assert.equal(select(record(brief([security("<script>"), security("BRK.B")]))).symbol, "BRK.B");
  for (const invalid of [null, record(brief([])), record(brief([security("A".repeat(81))])), record(brief(), { metricsJson: "not JSON" }), record(brief(), { metricsJson: "null" }), record(brief(), { metricsJson: JSON.stringify({ kind: "OTHER", brief: brief() }) }), record(brief([], { schemaVersion: "unknown" })), record(brief(), { createdAt: new Date("invalid") })]) {
    assert.equal(select(invalid), null, "Missing or malformed saved evidence must never manufacture a daily highlight");
  }
  const degraded = select(record(brief([security("NVDA", { score: 250, confidence: "99", overallRank: 0, quote: { symbol: "OTHER", price: 1000, changePercent: 10, timestamp: asOf } })], { dataQuality: null, marketAsOf: "invalid", generatedAt: "invalid" })));
  for (const field of ["score", "confidence", "dataQuality", "rank", "price", "changePercent", "quoteAsOf", "marketAsOf", "generatedAt"]) assert.equal(degraded[field], null, `${field} must not be presented as valid evidence`);
  assert.equal(select(record(brief([security("NVDA", { score: 0, confidence: 0 })]))).score, 0, "A genuine zero is distinct from missing evidence");

  mocks.setRecords([
    record(brief([security("AAPL")]), { id: "old-a", createdAt: new Date("2026-11-17T20:00:00.000Z") }),
    record(),
    record(brief([security("TSLA")]), { userId: "owner-b", id: "private-b", createdAt: new Date("2026-11-19T20:00:00.000Z") }),
  ]);
  const ownerScope = await mocks.studioAccess();
  const home = await readHomeSummary(ownerScope);
  assert.equal(home.dailyBrief.state, "ready");
  assert.equal(home.dailyBrief.data.symbol, "NVDA", "Use the most recent saved brief belonging to this user");
  const query = mocks.getQueries().find(item => item.model === "brief").query;
  assert.equal(query.where.userId, "owner-a");
  assert.deepEqual(query.orderBy, { createdAt: "desc" });
  assert.deepEqual(query.select, { id: true, metricsJson: true, createdAt: true });
  assert.equal(home.tasks.state, "ready");
  assert.equal(home.scenarios.state, "ready");

  const request = () => new Request("https://slice.example/api/workspace/home");
  let response = await route.GET(request());
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("Cache-Control"), "private, no-store");
  assert.equal((await response.json()).dailyBrief.data.symbol, "NVDA");
  mocks.setUser("owner-b");
  response = await route.GET(request());
  assert.equal((await response.json()).dailyBrief.data.symbol, "TSLA");
  mocks.setUser("new-user");
  response = await route.GET(request());
  assert.equal((await response.json()).dailyBrief.data, null, "A new account cannot inherit another user's brief");
  mocks.setUser(null); mocks.resetQueries();
  response = await route.GET(request());
  assert.equal(response.status, 401);
  assert.equal(mocks.getQueries().length, 0, "Unauthenticated navigation must not read any saved workspace data");

  mocks.setUser("owner-a"); mocks.failBrief(true);
  response = await route.GET(request());
  const partial = await response.json();
  assert.equal(response.status, 200);
  assert.equal(partial.dailyBrief.state, "unavailable");
  assert.equal(partial.tasks.state, "ready", "A failed brief read must not take down the rest of the workspace");
  console.log("Neural workspace checks passed: saved ranking order, safe source attribution, missing/degraded evidence, exact owner-scoped latest brief, authenticated private read, and partial outage handling.");
} finally {
  await rm(temporary, { recursive: true, force: true });
}
