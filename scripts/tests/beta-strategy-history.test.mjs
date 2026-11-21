import assert from "node:assert/strict";
import { mkdtemp, readFile, writeFile, rm } from "node:fs/promises";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url), ts = require("typescript");
const temporary = await mkdtemp(join(tmpdir(), "slice-beta-strategy-"));
let checks = 0;
const check = (actual, expected, message) => { assert.deepEqual(actual, expected, message); checks++; };
const rejects = async (value, expected) => { await assert.rejects(value, expected); checks++; };
const deferred = () => { let resolve, reject; const promise = new Promise((a, b) => { resolve = a; reject = b; }); return { promise, resolve, reject }; };
const flush = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const moduleFiles = {
  contracts: "src/lib/strategy-lab/contracts.ts", validation: "src/lib/strategy-lab/validation.ts",
  "provider-parser": "src/lib/strategy-lab/provider-parser.ts", indicators: "src/lib/strategy-lab/indicators.ts",
  "import-errors": "src/lib/strategy-lab/import-errors.ts", "history-reuse": "src/lib/strategy-lab/history-reuse.ts",
  provider: "src/lib/strategy-lab/provider.ts", "guided-workflow": "src/lib/strategy-ease/guided-workflow.ts",
  "import-client": "src/lib/strategy-lab/import-client.ts", "beta-client": "src/lib/research/beta-client.ts",
  "beta-policy": "src/lib/research/beta-policy.ts", "runs-route": "src/app/api/strategy-lab/runs/route.ts",
};
try {
  await writeFile(join(temporary, "mocks.mjs"), `
    export let rows = [], runs = [], currentUser = 'owner-a', queries = [], calculations = 0;
    export const setRows = value => { rows = value; };
    export const setUser = value => { currentUser = value; };
    export const reset = () => { runs.length = 0; queries.length = 0; calculations = 0; };
    export const withApiRoute = (_options, handler) => request => handler({ request });
    export const apiJson = (body, options) => Response.json(body, options);
    export const strategyAccess = async () => currentUser;
    export const readResearchJson = request => request.json();
    export const strategyFailure = error => { throw error; };
    export const runBacktest = spec => { calculations++; return { spec, effectiveStart: spec.startDate, effectiveEnd: spec.endDate, strategy: {totalReturnPct: 4}, benchmark: {totalReturnPct: 3} }; };
    export const prisma = {
      sliceResearchDataset: {
        async findMany(query) { queries.push(query); const w = query.where; return rows.filter(row => row.userId === w.userId && row.provider === w.provider && (!w.symbol || row.symbol === w.symbol) && (!w.currency || row.currency === w.currency) && (!w.endpoint || row.endpoint === w.endpoint) && (!w.id?.in || w.id.in.includes(row.id)) && (!w.retrievedAt?.gte || row.retrievedAt >= w.retrievedAt.gte)).slice(0, query.take || 100); },
        async findFirst(query) { queries.push(query); const w=query.where; return rows.find(row=>row.userId===w.userId && row.provider===w.provider && (!w.id || row.id===w.id) && (!w.symbol || row.symbol===w.symbol) && (!w.sourceSha256 || row.sourceSha256===w.sourceSha256)) || null; },
      },
      backendPlatformEvent: { async upsert() { return {id: 'lease-fixture'}; }, async updateMany() { return {count: 1}; } },
      sliceStrategyRun: {
        async findFirst(query) { queries.push(query); return runs.find(row => row.userId === query.where.userId && (query.where.inputSha256 ? row.inputSha256 === query.where.inputSha256 : row.id === query.where.id)) || null; },
        async create({data}) { const value = {id: 'run-' + (runs.length + 1), createdAt: new Date(), ...data}; runs.push(value); return value; },
      },
    };
  `);
  for (const [name, file] of Object.entries(moduleFiles)) {
    const source = (await readFile(file, "utf8")).replace(/^import ["']server-only["'];?\s*$/m, "");
    const result = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext }, fileName: file });
    const code = result.outputText.replace(/from (["'])([^"']+)\1/g, (match, _quote, specifier) => {
      if (specifier.startsWith("node:")) return match;
      const target = specifier.split("/").at(-1);
      return `from "./${moduleFiles[target] ? target : "mocks"}.mjs"`;
    });
    await writeFile(join(temporary, name + ".mjs"), code);
  }
  const load = name => import(pathToFileURL(join(temporary, name + ".mjs")).href);
  const { canReuseHistory, shareHistoryImport } = await load("history-reuse");
  const { defaultSpec, templateSpec } = await load("contracts");
  const { prepareGuidedHistory, executeGuidedHistory } = await load("guided-workflow");
  const { researchPost } = await load("import-client");
  const { importHistory, hydrate } = await load("provider");
  const route = await load("runs-route"), mocks = await load("mocks");
  const dates = ["2023-01-02", "2023-01-03", "2023-01-04", "2023-01-05", "2023-01-06", "2023-01-09", "2023-01-10", "2023-01-11", "2023-01-12", "2023-01-13", "2023-01-16", "2023-01-17", "2023-01-18", "2023-01-19", "2023-01-20"];
  function row(userId = "owner-a", symbol = "SPY") {
    const rawJson = JSON.stringify({ "Meta Data": { "2. Symbol": symbol }, "Time Series (Daily)": Object.fromEntries(dates.map((date, i) => [date, { "1. open": String(100+i), "2. high": String(102+i), "3. low": String(99+i), "4. close": String(101+i), "5. adjusted close": String(101+i), "6. volume": "1000000", "7. dividend amount": "0", "8. split coefficient": "1" }])) });
    return { id: `${userId}-${symbol}`, userId, symbol, provider: "Alpha Vantage", currency: "USD", endpoint: "TIME_SERIES_DAILY_ADJUSTED", retrievedAt: new Date("2023-01-23T16:00:00Z"), firstDate:dates[0],lastDate:dates.at(-1),barCount:dates.length,rawJson, identityJson: JSON.stringify({bestMatches:[{"1. symbol":symbol,"2. name":"Fixture instrument","3. type":"ETF","4. region":"United States","8. currency":"USD"}]}), sourceSha256: createHash("sha256").update(rawJson).digest("hex") };
  }
  const stored = row(), dataset = hydrate(stored), coverage = { startDate: "2023-01-09", endDate: "2023-01-20", warmupSessions: 4 };
  const reuse = { now: Date.parse("2026-11-19T20:00:00Z"), freshForMs: 6*3600000, coverage };
  check(canReuseHistory(dataset, reuse), true, "A verified closed period remains reusable beyond the network cache TTL");
  check(canReuseHistory(dataset, {...reuse, coverage: undefined}), false, "Old history cannot masquerade as fresh forward data");
  check(canReuseHistory(dataset, {...reuse, coverage: {...coverage, warmupSessions: 10}}), false);
  check(canReuseHistory(dataset, {...reuse, coverage: {...coverage, endDate: "2023-02-20"}}), false);
  check(canReuseHistory({...dataset,retrievedAt:"2023-01-20T18:00:00Z"}, reuse), false, "Same-day retrieval cannot prove that day's completed close");
  check(canReuseHistory({...dataset,retrievedAt:"2027-01-01T18:00:00Z"}, reuse), false);
  check(canReuseHistory(dataset, {...reuse, coverage: {...coverage, startDate:"invalid"}}), false);
  check(canReuseHistory(dataset, {...reuse, now: Date.parse("2023-01-23T17:00:00Z"), coverage:undefined}), true);

  let work = 0; const pending = deferred();
  const one = shareHistoryImport("owner-a:SPY", () => { work++; return pending.promise; });
  const two = shareHistoryImport("owner-a:SPY", () => { work++; return Promise.resolve("wrong"); });
  check(one === two, true); await flush(); check(work, 1);
  check(await shareHistoryImport("owner-b:SPY", async () => "private-b"), "private-b", "Dedup stays private to the requesting scope");
  pending.resolve("private-a"); check(await one, "private-a");
  check(await shareHistoryImport("owner-a:SPY", async () => "next"), "next", "Completed imports release the in-flight entry");
  await rejects(shareHistoryImport("failure", async () => { throw Error("fixture"); }), /fixture/);
  check(await shareHistoryImport("failure", async () => "recovered"), "recovered");

  const savedKey = process.env.ALPHA_VANTAGE_API_KEY; delete process.env.ALPHA_VANTAGE_API_KEY;
  try {
    mocks.setRows([stored]);
    const result = await importHistory("owner-a", "SPY", false, coverage);
    check([result.id,result.cached,result.reuseReason,result.retrievedAt], [stored.id,true,"verified-period",stored.retrievedAt.toISOString()], "Reuse retains original provenance and works without a key");
    check(mocks.queries.at(-1).where.userId,"owner-a");
    await rejects(importHistory("owner-b", "SPY", false, coverage), error => error.code === "PROVIDER_NOT_CONFIGURED");
    await rejects(importHistory("owner-a", "SPY", true, coverage), error => error.code === "PROVIDER_NOT_CONFIGURED");
    mocks.setRows([{...stored,rawJson: stored.rawJson + " "}]);
    await rejects(importHistory("owner-a", "SPY", false, coverage), error => error.code === "DATASET_INTEGRITY");
  } finally { if(savedKey===undefined)delete process.env.ALPHA_VANTAGE_API_KEY;else process.env.ALPHA_VANTAGE_API_KEY=savedKey; }

  const spec = templateSpec("buy-and-hold", {...defaultSpec(), symbols:["SPY","QQQ","IWM"], universeMode:"fixed-symbols", benchmark:"SPY", acknowledgeFixedUniverse:true, startDate:coverage.startDate,endDate:coverage.endDate});
  const manifest = symbol => ({...dataset,id:`fixture-${symbol}`,symbol,bars:undefined,firstDate:dates[0],lastDate:dates.at(-1),barCount:dates.length,vintage:"vendor-current-history",cached:true});
  const readiness={ok:true,issues:[],sessionCount:10,requiredWarmup:4,effectiveStart:coverage.startDate,effectiveEnd:coverage.endDate};
  const requests=[], gates=new Map(), stages=[]; let active=0,peak=0;
  const request=async(url,body) => {
    requests.push({url,body});
    if(url.endsWith("/datasets")){active++;peak=Math.max(peak,active);const gate=deferred();gates.set(body.symbol,gate);await gate.promise;active--;return {dataset:manifest(body.symbol)};}
    if(url.endsWith("/readiness")) return {readiness};
    return {runId:"result-fixture"};
  };
  const control=new AbortController();
  const preparation=prepareGuidedHistory({spec,signal:control.signal,request,onStage:value=>stages.push(value)});
  await flush();check([...gates.keys()],["SPY","QQQ"],"Two independent symbols start without serial waiting");
  gates.get("SPY").resolve();await flush();check([...gates.keys()],["SPY","QQQ","IWM"]);
  gates.get("QQQ").resolve();gates.get("IWM").resolve();const prepared=await preparation;
  check(peak,2);check(requests.filter(x=>x.url.endsWith("/datasets")).length,3,"Benchmark duplicates are not imported again");
  check(prepared.datasets.map(x=>x.symbol),["SPY","QQQ","IWM"]);check(stages,["history","validation"]);
  check(requests.every(x=>x.body.spec.symbols.length===3),true,"The exact requested period reaches the importer and preflight");
  check((await executeGuidedHistory({spec,prepared,signal:control.signal,request,onStage:value=>stages.push(value)})).runId,"result-fixture");
  check(stages,["history","validation","simulation"]);check(requests.length,5);
  await rejects(executeGuidedHistory({spec:{...spec,feeBps:9},prepared,signal:control.signal,request}),/inputs changed/);
  await rejects(executeGuidedHistory({spec,prepared:{...prepared,readiness:{...readiness,ok:false,issues:[{code:"GAP",message:"Missing session"}]}},signal:control.signal,request}),/Missing session/);
  check(requests.length,5,"Changed inputs and failed coverage never submit a backtest");
  const stopped=new AbortController();stopped.abort();
  await rejects(prepareGuidedHistory({spec,signal:stopped.signal,request}),error=>error.name==="AbortError");check(requests.length,5);

  let forbidden=false;const other=deferred();let settled=false;
  const failed=prepareGuidedHistory({spec,signal:new AbortController().signal,request:async(url,body)=>{
    if(!url.endsWith("/datasets")){forbidden=true;return {readiness};}
    if(body.symbol==="SPY")throw Error("Provider entitlement unavailable");
    await other.promise;return {dataset:manifest(body.symbol)};
  }}).finally(()=>{settled=true;});
  await flush();check(settled,false,"A failed worker waits for an already-running import to settle");other.resolve();await rejects(failed,/Provider entitlement/);check(forbidden,false);
  await rejects(prepareGuidedHistory({spec:{...spec,symbols:["SPY"],maxHoldings:1},signal:new AbortController().signal,request:async()=>({dataset:{...manifest("SPY"),currency:"EUR"}})}),/source validation/);

  const originalDocument=globalThis.document,originalTimer=globalThis.setTimeout,originalClear=globalThis.clearTimeout;
  const timers=[],cleared=[];
  try {
    globalThis.document={documentElement:{dataset:{sliceBeta:"true"}}};
    globalThis.setTimeout=(_callback,ms)=>{timers.push(ms);return 123;};globalThis.clearTimeout=value=>{cleared.push(value);};
    const fetchOk=async()=>Response.json({ok:true});
    await researchPost("/api/strategy-lab/runs",{},1200,undefined,fetchOk);check(timers,[],"Beta creates no elapsed-time deadline");
    globalThis.document.documentElement.dataset.sliceBeta="false";
    await researchPost("/api/strategy-lab/runs",{},1200,undefined,fetchOk);check(timers,[1200]);check(cleared,[123]);
    globalThis.document.documentElement.dataset.sliceBeta="true";
    const cancel=new AbortController();let outgoing;
    const waiting=researchPost("/api/strategy-lab/runs",{},1200,cancel.signal,async(_url,init)=>{outgoing=init.signal;return new Promise((_resolve,reject)=>init.signal.addEventListener("abort",()=>reject(new DOMException("Stopped","AbortError")),{once:true}));});
    cancel.abort();await rejects(waiting,error=>error.name==="AbortError");check(outgoing.aborted,true,"Manual cancellation remains effective in beta");
  } finally { if(originalDocument===undefined)delete globalThis.document;else globalThis.document=originalDocument;globalThis.setTimeout=originalTimer;globalThis.clearTimeout=originalClear; }

  mocks.setRows([row("owner-a"),row("owner-b")]);mocks.reset();
  const single={...spec,symbols:["SPY"],maxHoldings:1};
  const post=owner=>{mocks.setUser(owner);return route.POST(new Request("http://localhost/api/strategy-lab/runs",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({spec:single,datasetIds:[`${owner}-SPY`]})})).then(r=>r.json());};
  const first=await post("owner-a"),again=await post("owner-a");
  check(first.runId,again.runId);check(again.reused,true);check(mocks.calculations,1,"Identical saved inputs do not trigger a duplicate calculation");
  const secondOwner=await post("owner-b");check(secondOwner.runId!==first.runId,true);check(mocks.calculations,2);
  mocks.runs[0].outputSha256="0".repeat(64);await rejects(post("owner-a"),error=>error.code==="RESULT_INTEGRITY");
  check(mocks.calculations,2,"A corrupt saved result is never served or silently replaced");
  console.log(`Beta Strategy Studio checks passed (${checks} assertions): real-history reuse, original provenance, ownership, integrity, bounded concurrency, cancellation, exact preflight, changed-input protection, beta deadlines, and immutable retry reuse.`);
} finally { await rm(temporary,{recursive:true,force:true}); }
