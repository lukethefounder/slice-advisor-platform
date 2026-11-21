import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { pathToFileURL } from "node:url";

const require = createRequire(import.meta.url);
const ts = require("typescript");
const temporary = await mkdtemp(join(tmpdir(), "slice-knowledge-sources-"));
const digest = value => createHash("sha256").update(value).digest("hex");
const now = Date.parse("2026-11-18T20:00:00.000Z");
const asOf = new Date(now).toISOString();

const modules = {
  "research-config": "src/lib/intelligence/research-config.ts",
  "research-evidence": "src/lib/intelligence/research-evidence.ts",
  "research-news": "src/lib/intelligence/research-news.ts",
  "research-instrument": "src/lib/intelligence/research-instrument.ts",
  "research-source-index": "src/lib/intelligence/research-source-index.ts",
  "research-agent-index": "src/lib/intelligence/research-agent-index.ts",
  "canonical-service": "src/lib/intelligence-unified/service.ts",
  "source-route": "src/app/api/intelligence/research-sources/route.ts",
  "agent-route": "src/app/api/intelligence/research-agents/route.ts",
};

try {
  await writeFile(join(temporary, "mocks.mjs"), `
    let row = null, userId = "owner-a", rateAllowed = true;
    const queries = [], storageChecks = [];
    export function setRow(value) { row = value; }
    export function setUser(value) { userId = value; }
    export function setRateAllowed(value) { rateAllowed = value; }
    export function getQueries() { return queries; }
    export function resetQueries() { queries.length = 0; }
    export const prisma = { sliceForecastBundle: { async findFirst(query) {
      queries.push(query);
      if (!row) return null;
      const where = query.where;
      return Object.entries(where).every(([key,value]) => value && typeof value === "object" && Array.isArray(value.in) ? value.in.includes(row[key]) : row[key] === value) ? row : null;
    } } };
    export async function requireResearchStorage(tables) { storageChecks.push(tables); }
    export class StrategyError extends Error { constructor(code,message,status=500) { super(message); this.code=code; this.status=status; } }
    export class ApiError extends Error { constructor(options) { super(options.message); Object.assign(this,options); } }
    export async function requireCurrentAccessContext(options) {
      if (!options.requireFirm) throw new Error("Firm access requirement was omitted");
      if (!userId) throw new ApiError({status:401,code:"UNAUTHENTICATED",message:"Sign in"});
      return {user:{id:userId},firm:{id:"firm-a"}};
    }
    export const withApiRoute = (_options,handler) => handler;
    export const apiJson = (payload,init) => new Response(JSON.stringify(payload),init);
    export const checkRateLimit = () => ({allowed:rateAllowed});
    export const getClientIp = () => "127.0.0.1";
    export const hashForSecurity = () => "fixture-ip";
    const unused = () => { throw new Error("An unrelated operation ran during a source read"); };
    export const buildForecast=unused, createDisabledCamelFeatures=unused, normalizeMarketSnapshot=unused;
    export const persistForecastRun=unused, auditForecastEvidenceRun=unused, syncForecastRunToGraph=unused;
    export const isNeo4jConfigured=unused, loadHorizonModelSuite=unused, persistShadowHorizonPredictions=unused, scoreHorizonModelSuite=unused;
    export const analyzeResearchGraph=unused, projectResearchGraph=unused, getResearchGraphNodeDetail=unused;
    export const HORIZONS=[];
  `);

  for (const [name, path] of Object.entries(modules)) {
    const source = await readFile(new URL(`../../${path}`, import.meta.url), "utf8");
    const compiled = ts.transpileModule(source.replace(/^import ["']server-only["'];?\s*$/m, ""), {
      compilerOptions: { target: ts.ScriptTarget.ES2022, module: ts.ModuleKind.ESNext },
      fileName: path, reportDiagnostics: true,
    });
    assert.equal(compiled.diagnostics.filter(item => item.category === ts.DiagnosticCategory.Error).length, 0, `${name} must transpile`);
    const output = compiled.outputText.replace(/from (["'])([^"']+)\1/g, (match, _quote, specifier) => {
      if (specifier.startsWith("node:")) return match;
      const local = specifier.match(/(?:^\.\/|\/)(research-config|research-evidence|research-news|research-instrument|research-source-index|research-agent-index)$/)?.[1];
      if (local) return `from "./${local}.mjs"`;
      if (specifier === "@/lib/intelligence-unified/service") return 'from "./canonical-service.mjs"';
      return 'from "./mocks.mjs"';
    });
    await writeFile(join(temporary, `${name}.mjs`), output);
  }

  const load = name => import(pathToFileURL(join(temporary, `${name}.mjs`)).href);
  const news = await load("research-news"), sources = await load("research-source-index");
  const provenance = await load("research-evidence"), canonical = await load("canonical-service");
  const endpoint = await load("source-route"), mocks = await load("mocks");
  const agentIndex = await load("research-agent-index"), agentEndpoint = await load("agent-route");

  const rawArticle = (overrides = {}) => ({
    title: "A company publishes its quarterly earnings and demand outlook",
    summary: "Fixture article with ticker-specific sentiment.",
    url: "https://publisher.example/article",
    source: "Publisher", time_published: "20261118T190000",
    overall_sentiment_score: 0.75, overall_sentiment_label: "Bullish",
    ticker_sentiment: [
      {ticker:"OTHER",ticker_sentiment_score:"0.9",relevance_score:"0.95"},
      {ticker:"MSFT",ticker_sentiment_score:"-0.3",relevance_score:"0.8",ticker_sentiment_label:"Bearish"},
    ],
    topics: [{topic:"earnings",relevance_score:"0.8"}], ...overrides,
  });
  const article = (overrides = {}) => ({
    id:"news-a", title:"Company research", summary:"Fixture", url:"https://publisher.example/article",
    source:"Publisher", sourceDomain:"publisher.example", publishedAt:asOf,
    tickerSentimentScore:0.2, tickerRelevance:0.8, tickerSentimentLabel:"Positive",
    overallSentimentScore:0.5, overallSentimentLabel:"Positive", topics:["earnings"], ...overrides,
  });
  const evidence = (index, overrides = {}) => ({
    id:`evidence-${index}`, cohort:["media","technical","economy"][index % 3], kind:"news",
    title:`Research evidence number ${index}`, summary:`Archive finding ${index}`,
    source:`Publisher ${index % 5}`, sourceUrl:`https://source${index % 5}.example/article/${index}`,
    asOf, retrievedAt:asOf, score:60, confidence:50, freshnessScore:90, relevanceScore:80,
    polarity:"positive", symbol:"MSFT", sector:"Technology", industry:"Software", topics:["earnings"], metrics:{}, warnings:[], ...overrides,
  });

  // Provider responses must explicitly mention the requested ticker. Sentiment from
  // the first row or the article-wide sentiment cannot be borrowed for another stock.
  const parsed = news.parseResearchNews({feed:[rawArticle()]}, "MSFT");
  assert.equal(parsed.articleCount, 1);
  assert.equal(parsed.items[0].tickerSentimentScore, -0.3);
  assert.equal(parsed.items[0].tickerRelevance, 0.8);
  assert.equal(news.parseResearchNews({feed:[rawArticle()]}, "NVDA"), null);
  assert.equal(news.parseResearchNews({feed:[rawArticle({ticker_sentiment:[]})]}, "MSFT"), null);
  assert.equal(news.parseResearchNews({feed:[rawArticle({ticker_sentiment:[{ticker:"MSFT",ticker_sentiment_score:" ",relevance_score:"0.8"}]})]}, "MSFT"), null,"Missing sentiment cannot become a neutral observation");
  assert.equal(news.parseResearchNews({feed:[rawArticle({ticker_sentiment:[{ticker:"MSFT",ticker_sentiment_score:"0",relevance_score:"0.8"}]})]}, "MSFT").items[0].tickerSentimentScore,0,"An explicitly observed numeric zero is valid");
  assert.equal(news.parseResearchNews({feed:[rawArticle({url:""})]}, "MSFT"), null);
  assert.equal(news.parseResearchNews({feed:[]}, "MSFT"), null);
  assert.equal(news.newsSnapshot([]), null);
  assert.equal(news.parseResearchNews({feed:[rawArticle({time_published:"20260230T120000"})]}, "MSFT"), null);
  assert.equal(news.parseResearchNews({feed:[rawArticle({time_published:"not-a-provider-time"})]}, "MSFT"), null);
  assert.equal(news.parseResearchNews({feed:[rawArticle({url:"javascript:alert(1)"})]}, "MSFT"), null);

  // Distinct topic queries reflect the chosen research ratio and never fan out per bot.
  assert.deepEqual(news.researchNewsTopics("Technology", {media:100,technical:0,economy:0}, 3), ["earnings","technology","mergers_and_acquisitions"]);
  assert.deepEqual(news.researchNewsTopics("Technology", {media:0,technical:0,economy:100}, 6), ["economy_macro","economy_monetary"]);
  for (const limit of [0,1,3,6,1000]) {
    const topics = news.researchNewsTopics("Unknown", {media:55,technical:30,economy:15}, limit);
    assert.ok(topics.length <= Math.min(limit,6));
    assert.equal(new Set(topics).size, topics.length);
  }

  const prolific = Array.from({length:20}, (_,index) => article({id:`prolific-${index}`,url:`https://prolific.example/article/${index}`,tickerRelevance:1-index/100}));
  const diverse = news.diversifyResearchNews([...prolific,article({id:"second",url:"https://second.example/story"}),article({id:"third",url:"https://third.example/story"})], 3, now);
  assert.equal(new Set(diverse.map(item => new URL(item.url).hostname)).size,3,"One publisher must not consume the first source page");
  const duplicateQueryResults = Array.from({length:12}, (_,index) => article({id:`query-${index}`,url:`https://publisher.example/article?utm_source=query${index}#section`}));
  assert.equal(news.diversifyResearchNews(duplicateQueryResults,500,now).length,1);
  const filtered = news.diversifyResearchNews([
    article(), article({id:"future",url:"https://future.example/story",publishedAt:new Date(now+3600000).toISOString()}),
    article({id:"old",url:"https://old.example/story",publishedAt:new Date(now-169*3600000).toISOString()}),
    article({id:"bad-date",url:"https://bad.example/story",publishedAt:"invalid"}),
    article({id:"unsafe",url:"data:text/html,bad"}),
  ],500,now,168);
  assert.deepEqual(filtered.map(item=>item.id),["news-a"]);
  assert.deepEqual(news.diversifyResearchNews([],500,now),[]);

  // Every archived item remains reachable even when the graph renders a small projection.
  const archive = Array.from({length:137},(_,index)=>evidence(index));
  const visited = [];
  for (let page=1;page<=6;page++) {
    const result=sources.pageResearchSources(archive,{page,pageSize:25});
    assert.equal(result.total,137);assert.equal(result.totalEvidence,137);assert.equal(result.pages,6);
    assert.ok(result.items.length<=25);visited.push(...result.items.map(item=>item.id));
  }
  assert.equal(new Set(visited).size,137);
  assert.deepEqual(visited,archive.map(item=>item.id));
  assert.equal(sources.pageResearchSources(archive,{pageSize:10000}).items.length,100);
  assert.equal(sources.pageResearchSources(archive,{cohort:"economy"}).items.every(item=>item.cohort==="economy"),true);
  assert.equal(sources.pageResearchSources(archive,{q:"number 136"}).items[0].id,"evidence-136");
  assert.equal(sources.pageResearchSources([]).sourceCount,0);
  assert.equal(sources.pageResearchSources([evidence(0,{sourceUrl:"",source:"Unverified name"})]).sourceCount,0,"A publisher name without an observed URL is not a verified source");

  const linked = evidence(0, {
    sourceUrl:"https://publisher.example/a?token=PRIVATE&utm_campaign=feed&id=1#part",
    canonicalUrl:"https://publisher.example/a?apikey=PRIVATE&id=1",
    relatedSources:[
      {source:"Syndicated publisher",url:"https://syndicated.example/article?access_token=PRIVATE&id=2",asOf},
      {source:"Unsafe archived alias",url:"javascript:alert(1)",asOf},
    ],
  });
  const sanitized=sources.pageResearchSources([linked]).items[0];
  assert.equal(sanitized.sourceUrl,"https://publisher.example/a?id=1");
  assert.equal(sanitized.canonicalUrl,"https://publisher.example/a?id=1");
  assert.equal(sanitized.relatedSources[0].source,"Syndicated publisher");
  assert.equal(sanitized.relatedSources[0].url,"https://syndicated.example/article?id=2");
  assert.equal(sanitized.relatedSources[0].asOf,asOf);
  assert.equal(sanitized.relatedSources[1].url,"");
  assert.equal(JSON.stringify(sanitized).includes("PRIVATE"),false);
  assert.equal(sources.pageResearchSources([linked],{q:"Syndicated publisher"}).total,1,"Preserved source aliases must be searchable by publisher name");
  assert.equal(sources.pageResearchSources([linked],{q:"syndicated.example"}).total,1,"Preserved source aliases must be searchable by site");
  assert.equal(provenance.safeResearchSourceUrl("https://user:password@example.com/story"),"");

  const graph={schemaVersion:"slice-research-graph-1.0.0",runId:"run-a",generatedAt:asOf,nodeCount:2,edgeCount:0,edges:[],clusters:[],nodes:archive.slice(0,2).map(item=>({id:item.id,kind:"evidence",label:item.title,cohort:item.cohort,score:item.score,confidence:item.confidence,size:10,group:"news",properties:{kind:item.kind,source:item.source,sourceUrl:item.sourceUrl,asOf}}))};
  function bundle(summary={evidence:archive},graphValue=graph) {
    const researchJson=JSON.stringify(summary),graphJson=JSON.stringify(graphValue);
    return {userId:"owner-a",symbol:"MSFT",status:"Ready",researchRunId:"run-a",researchJson,graphJson,
      operationsJson:JSON.stringify({researchSha256:digest(researchJson),graphSha256:digest(graphJson)})};
  }
  mocks.setRow(bundle());mocks.resetQueries();
  const lastPage=await canonical.readCanonicalResearchSources({userId:"owner-a",symbol:"MSFT",runId:"run-a",page:6,pageSize:25});
  assert.equal(lastPage.total,137);assert.equal(lastPage.items.length,12);assert.equal(lastPage.legacy,false);
  assert.equal(lastPage.runId,"run-a");assert.equal(lastPage.items.at(-1).id,"evidence-136");
  assert.deepEqual(mocks.getQueries()[0].where,{userId:"owner-a",symbol:"MSFT",status:{in:["Ready","ResearchOnly"]},researchRunId:"run-a"});
  assert.equal(await canonical.readCanonicalResearchSources({userId:"other-user",symbol:"MSFT",runId:"run-a"}),null);
  assert.equal(await canonical.readCanonicalResearchSources({userId:"owner-a",symbol:"OTHER",runId:"run-a"}),null);
  assert.equal(await canonical.readCanonicalResearchSources({userId:"owner-a",symbol:"MSFT",runId:"other-run"}),null);

  const tamperedResearch=bundle();tamperedResearch.researchJson=JSON.stringify({evidence:[]});mocks.setRow(tamperedResearch);
  await assert.rejects(()=>canonical.readCanonicalResearchSources({userId:"owner-a",symbol:"MSFT",runId:"run-a"}),error=>error.code==="RESEARCH_INTEGRITY"&&error.status===409);
  const tamperedGraph=bundle();tamperedGraph.graphJson="{}";mocks.setRow(tamperedGraph);
  await assert.rejects(()=>canonical.readCanonicalResearchSources({userId:"owner-a",symbol:"MSFT",runId:"run-a"}),error=>error.code==="RESEARCH_INTEGRITY");
  const missingHashes=bundle();missingHashes.operationsJson="{}";mocks.setRow(missingHashes);
  await assert.rejects(()=>canonical.readCanonicalResearchSources({userId:"owner-a",symbol:"MSFT",runId:"run-a"}),error=>error.code==="RESEARCH_INTEGRITY");
  mocks.setRow(bundle({score:{overall:60}},graph));
  const legacy=await canonical.readCanonicalResearchSources({userId:"owner-a",symbol:"MSFT",runId:"run-a"});
  assert.equal(legacy.legacy,true);assert.equal(legacy.total,2);assert.equal(legacy.items[0].sourceUrl,archive[0].sourceUrl);
  const unavailable=JSON.parse(JSON.stringify(graph));unavailable.nodes[0].properties={};
  const legacyMissing=sources.legacyGraphEvidence(unavailable,"MSFT")[0];
  assert.equal(legacyMissing.sourceUrl,"");assert.equal(legacyMissing.source,"Source not recorded");

  // Route authentication, ownership, exact run pinning, and private/no-store remain active.
  const request = query => ({request:new Request(`https://slice.example/api/intelligence/research-sources?${query}`)});
  mocks.setRow(bundle());mocks.setUser("owner-a");mocks.setRateAllowed(true);
  const response=await endpoint.GET(request("symbol=MSFT&runId=run-a&page=6&pageSize=25"));
  assert.equal(response.status,200);assert.equal(response.headers.get("Cache-Control"),"private, no-store");
  assert.equal((await response.json()).items.length,12);
  mocks.setUser("other-user");
  await assert.rejects(()=>endpoint.GET(request("symbol=MSFT&runId=run-a")),error=>error.status===404);
  mocks.setUser(null);mocks.resetQueries();
  await assert.rejects(()=>endpoint.GET(request("symbol=MSFT&runId=run-a")),error=>error.status===401);
  assert.equal(mocks.getQueries().length,0,"Unauthenticated source reads must not query the archive");
  mocks.setUser("owner-a");
  await assert.rejects(()=>endpoint.GET(request("symbol=MSFT%3Cscript%3E")),error=>error.status===400);
  mocks.setRateAllowed(false);
  await assert.rejects(()=>endpoint.GET(request("symbol=MSFT")),error=>error.status===429);
  mocks.setRateAllowed(true);

  // The persisted graph retains the full research workforce. A page materializes
  // only the requested agents while preserving their exact recorded evidence trail.
  const agentNodes = Array.from({length:10_000},(_,index)=>{
    const cohort=["media","technical","economy"][index%3];
    const status=["completed","degraded","insufficient-evidence","completed"][index%4];
    return {
      id:`run-a:${cohort}-agent-${index+1}`,kind:"agent",label:`Sector researcher #${index+1}`,
      cohort,score:61,confidence:47,size:5,group:"Sector research",
      properties:{
        ordinal:index+1,role:"Sector researcher",pathway:`Research pathway ${index+1}`,status,
        agreement:54,primaryEvidenceId:`evidence-${index%137}`,latencyMs:0.5,generatedAt:asOf,
        missionKey:`MSFT:${cohort}:${index+1}`,sector:"Technology",industry:"Software",
        researchQuestion:`Question ${index+1}: how does demand affect software?`,
        evidenceFingerprint:`fingerprint-${index%137}`,evidenceReused:index>=137,
        positiveDriversJson:JSON.stringify([index===9876?"Rare witness alpha":"Observed customer demand"]),
        negativeDriversJson:JSON.stringify(["Margin pressure"]),
        contradictionsJson:JSON.stringify(["Price strength conflicts with the demand report"]),
      },
    };
  });
  const agentEdges=agentNodes.map((node,index)=>({id:`uses-${index}`,source:node.id,target:`evidence:evidence-${index%137}`,kind:"USES_EVIDENCE",weight:1,cohort:node.cohort,properties:{}}));
  agentEdges.push({id:"unrelated-edge",source:agentNodes[0].id,target:"asset:MSFT",kind:"RESEARCHES",weight:1,cohort:"shared",properties:{}});
  const agentGraph={...graph,nodes:[...graph.nodes,...agentNodes],edges:agentEdges,nodeCount:10_002,edgeCount:agentEdges.length};
  const firstAgents=agentIndex.pageResearchAgents(agentGraph);
  assert.equal(firstAgents.items.length,24);assert.equal(firstAgents.pageSize,24);assert.equal(firstAgents.pages,417);
  assert.equal(firstAgents.total,10_000);assert.equal(firstAgents.recordedAgentCount,10_000);
  assert.equal(firstAgents.items[0].id,agentNodes[0].id,"Inspector IDs must identify the actual saved graph node");
  assert.equal(firstAgents.items[0].ordinal,1);
  assert.equal(firstAgents.items[0].role,"Sector researcher");assert.equal(firstAgents.items[0].pathway,"Research pathway 1");
  assert.equal(firstAgents.items[0].primaryEvidenceId,"evidence-0");assert.deepEqual(firstAgents.items[0].evidenceIds,["evidence-0"]);
  assert.deepEqual(firstAgents.items[0].positiveDrivers,["Observed customer demand"]);
  assert.deepEqual(firstAgents.items[0].negativeDrivers,["Margin pressure"]);
  assert.deepEqual(firstAgents.items[0].contradictions,["Price strength conflicts with the demand report"]);
  assert.equal(firstAgents.items[0].generatedAt,asOf);assert.equal(firstAgents.items[0].missionKey,"MSFT:media:1");
  assert.equal(firstAgents.items[0].evidenceFingerprint,"fingerprint-0");assert.equal(firstAgents.items[0].evidenceReused,false);
  const allAgentIds=[];
  for(let page=1;page<=firstAgents.pages;page++){
    const result=agentIndex.pageResearchAgents(agentGraph,{page});
    assert.ok(result.items.length<=24);assert.equal(result.recordedAgentCount,10_000);
    allAgentIds.push(...result.items.map(item=>item.id));
  }
  assert.equal(new Set(allAgentIds).size,10_000);assert.deepEqual(allAgentIds,agentNodes.map(node=>node.id));
  assert.equal(agentIndex.pageResearchAgents(agentGraph,{page:10000}).items.length,16);
  assert.equal(agentIndex.pageResearchAgents(agentGraph,{page:10000}).page,417);
  assert.equal(agentIndex.pageResearchAgents(agentGraph,{pageSize:10000}).items.length,100);
  assert.equal(agentIndex.pageResearchAgents(agentGraph,{page:-100,pageSize:-100}).items.length,1);
  assert.equal(agentIndex.pageResearchAgents(agentGraph,{page:NaN,pageSize:NaN}).items.length,24);
  const filteredAgents=agentIndex.pageResearchAgents(agentGraph,{cohort:"economy",status:"completed"});
  const expectedFiltered=agentNodes.filter(node=>node.cohort==="economy"&&node.properties.status==="completed");
  assert.equal(filteredAgents.total,expectedFiltered.length);assert.equal(filteredAgents.recordedAgentCount,10_000);
  assert.equal(filteredAgents.items.every(item=>item.cohort==="economy"&&item.status==="completed"),true);
  const driverMatch=agentIndex.pageResearchAgents(agentGraph,{q:"rare witness alpha"});
  assert.equal(driverMatch.total,1);assert.equal(driverMatch.items[0].id,agentNodes[9876].id);
  assert.equal(agentIndex.pageResearchAgents(agentGraph,{q:"technology"}).total,10_000);
  assert.equal(agentIndex.pageResearchAgents(agentGraph,{q:"<script>alert(1)</script>"}).total,0);
  assert.equal(agentIndex.pageResearchAgents(agentGraph,{q:"[invalid regex"}).total,0);
  const malformedNode={...agentNodes[0],properties:{...agentNodes[0].properties,status:"unknown",positiveDriversJson:"{bad json",negativeDriversJson:JSON.stringify(["Retained text",42,null]),contradictionsJson:"{}"}};
  const malformed=agentIndex.pageResearchAgents({...agentGraph,nodes:[malformedNode]}).items[0];
  assert.equal(malformed.status,"insufficient-evidence");assert.deepEqual(malformed.positiveDrivers,[]);
  assert.deepEqual(malformed.negativeDrivers,["Retained text"]);assert.deepEqual(malformed.contradictions,[]);
  assert.equal(agentIndex.pageResearchAgents({...agentGraph,nodes:[]}).recordedAgentCount,0);

  const agentBundle=()=>bundle({requestedAgents:10_000,evidence:archive},agentGraph);
  mocks.setRow(agentBundle());mocks.resetQueries();
  const savedAgents=await canonical.readCanonicalResearchAgents({userId:"owner-a",symbol:"MSFT",runId:"run-a",page:417,pageSize:24});
  assert.equal(savedAgents.requestedAgents,10_000);assert.equal(savedAgents.recordedAgentCount,10_000);
  assert.equal(savedAgents.items.length,16);assert.equal(savedAgents.items.at(-1).id,agentNodes.at(-1).id);
  assert.deepEqual(mocks.getQueries()[0].where,{userId:"owner-a",symbol:"MSFT",status:{in:["Ready","ResearchOnly"]},researchRunId:"run-a"});
  for(const selection of [{userId:"other-user",symbol:"MSFT",runId:"run-a"},{userId:"owner-a",symbol:"OTHER",runId:"run-a"},{userId:"owner-a",symbol:"MSFT",runId:"other-run"}]){
    assert.equal(await canonical.readCanonicalResearchAgents(selection),null);
  }
  for(const field of ["researchJson","graphJson","operationsJson"]){
    const tampered=agentBundle();tampered[field]="{}";mocks.setRow(tampered);
    await assert.rejects(()=>canonical.readCanonicalResearchAgents({userId:"owner-a",symbol:"MSFT",runId:"run-a"}),error=>error.code==="RESEARCH_INTEGRITY"&&error.status===409);
  }
  const agentRequest=query=>({request:new Request(`https://slice.example/api/intelligence/research-agents?${query}`)});
  mocks.setRow(agentBundle());mocks.setUser("owner-a");mocks.setRateAllowed(true);
  const agentsResponse=await agentEndpoint.GET(agentRequest("symbol=MSFT&runId=run-a&page=417&pageSize=24"));
  assert.equal(agentsResponse.status,200);assert.equal(agentsResponse.headers.get("Cache-Control"),"private, no-store");
  const agentsPayload=await agentsResponse.json();assert.equal(agentsPayload.recordedAgentCount,10_000);assert.equal(agentsPayload.items.length,16);
  const filteredResponse=await agentEndpoint.GET(agentRequest("symbol=MSFT&runId=run-a&cohort=economy&status=completed&pageSize=10000"));
  const filteredPayload=await filteredResponse.json();assert.equal(filteredPayload.total,expectedFiltered.length);assert.equal(filteredPayload.items.length,100);
  const unsafeFilters=await agentEndpoint.GET(agentRequest("symbol=MSFT&runId=run-a&status=__proto__&cohort=%3Cscript%3E&q=%5Bnot-a-regex"));
  assert.equal((await unsafeFilters.json()).total,0,"Unknown filter values and arbitrary search text must remain inert");
  const unknownStatus=await agentEndpoint.GET(agentRequest("symbol=MSFT&runId=run-a&status=__proto__"));
  assert.equal((await unknownStatus.json()).total,10_000,"Unknown status is treated as no status filter");
  mocks.setUser("other-user");
  await assert.rejects(()=>agentEndpoint.GET(agentRequest("symbol=MSFT&runId=run-a")),error=>error.status===404);
  mocks.setUser(null);mocks.resetQueries();
  await assert.rejects(()=>agentEndpoint.GET(agentRequest("symbol=MSFT&runId=run-a")),error=>error.status===401);
  assert.equal(mocks.getQueries().length,0);
  mocks.setUser("owner-a");
  await assert.rejects(()=>agentEndpoint.GET(agentRequest("symbol=MSFT%3Cscript%3E")),error=>error.status===400);
  mocks.setRateAllowed(false);
  await assert.rejects(()=>agentEndpoint.GET(agentRequest("symbol=MSFT")),error=>error.status===429);
  mocks.setRateAllowed(true);

  console.log("Knowledge graph archive checks passed: ticker matching, distinct query bounds, freshness, publisher diversity, URL redaction, complete source and 10,000-agent pagination, evidence trails, private ownership, and immutable-run integrity.");
} finally {
  await rm(temporary,{recursive:true,force:true});
}
