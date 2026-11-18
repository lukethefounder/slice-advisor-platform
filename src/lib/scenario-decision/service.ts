import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { scenarioDetail } from "@/lib/connected-research/scenario-service";
import type { Scope } from "@/lib/connected-research/contracts";
import { StrategyError, type BacktestResult } from "@/lib/strategy-lab/contracts";
import { marketStorage } from "@/lib/market-evidence/storage";
import { marketConfiguration } from "@/lib/market-evidence/configuration";
import { createMarketReader } from "@/lib/market-evidence/transport";
import { loadMarketSection } from "@/lib/market-visuals/service";
import { sectionPolicy } from "@/lib/market-visuals/section-policy";
import type { MarketReceipt } from "@/lib/market-evidence/contracts";
import { parseInsiders, parseNewsEvidence, parseInstitutional } from "./activity";
import { evidenceSymbol, interpretSource, REPORT_LIMITATIONS, validId } from "./core";
import { DECISION_VERSION, EVIDENCE_SECTIONS, type EvidenceSection, type EvidenceData, type SavedEvidence, type DecisionSource, type DecisionReport, type ScenarioDetail } from "./contracts";
const EVIDENCE="SLICE_DECISION_EVIDENCE_V1", REPORT="SLICE_DECISION_REPORT_V1";
const sha=(s:string)=>createHash("sha256").update(s).digest("hex");
const reject=(code:string,message:string,status=400):never=>{throw new StrategyError(code,message,status);};
function parse<T>(s:string,hash?:string):T{if(hash&&sha(s)!==hash)reject("SNAPSHOT_INTEGRITY","The saved result failed its checksum.",409);try{return JSON.parse(s) as T;}catch{return reject("SNAPSHOT_FORMAT","The saved result is not readable.",409);}}
function allowedId(v:unknown,label:string):string{if(!validId(v))return reject("INVALID_ID",`Select a valid ${label}.`);return v;}
function reportWhere(scope:Scope){return {userId:scope.userId,sourceId:scope.firmId,eventType:REPORT};}
export async function readDecisionSource(scope:Scope,input:{runId?:unknown;scenarioId?:unknown}):Promise<DecisionSource>{
 let scenario:ScenarioDetail|null=null;
 if(input.scenarioId){const data=await scenarioDetail(scope,allowedId(input.scenarioId,"scenario"));if("notModified" in data)return reject("SCENARIO_STATE","Reload the selected scenario.",409);scenario=JSON.parse(JSON.stringify(data)) as ScenarioDetail;}
 const runId=scenario?.scenario.sourceRunId??allowedId(input.runId,"historical run");
 if(input.runId&&input.runId!==runId)reject("SOURCE_MISMATCH","The selected historical run does not match this scenario.",409);
 // This preserves the established per-user ACL of historical runs; scenario/report records are additionally firm-scoped.
 const row=await prisma.sliceStrategyRun.findFirst({where:{id:runId,userId:scope.userId},select:{id:true,createdAt:true,resultJson:true,outputSha256:true}});
 if(!row)return reject("SOURCE_NOT_FOUND","The saved historical result is unavailable to this user.",404);
 const result=parse<BacktestResult>(row.resultJson,row.outputSha256);
 if(result.classification!=="hypothetical-historical-simulation"||!Array.isArray(result.equity)||!Array.isArray(result.trades)||!result.spec?.symbols?.length)reject("SOURCE_FORMAT","The saved historical result has an unsupported structure.",409);
 return {runId:row.id,runCreatedAt:row.createdAt.toISOString(),sourceHash:row.outputSha256,result,scenario};
}
function decodeEvidence(id:string,text:string):SavedEvidence{const saved=parse<{payload:Omit<SavedEvidence,"id"|"outputHash">;outputHash:string}>(text);if(sha(JSON.stringify(saved.payload))!==saved.outputHash)reject("EVIDENCE_INTEGRITY","The saved evidence failed its checksum.",409);return {...saved.payload,id,outputHash:saved.outputHash};}
export async function getDecisionEvidence(scope:Scope,id:unknown):Promise<SavedEvidence>{
 const row=await prisma.backendPlatformEvent.findFirst({where:{id:allowedId(id,"evidence snapshot"),userId:scope.userId,sourceId:scope.firmId,eventType:EVIDENCE},select:{id:true,metadataJson:true}});
 if(!row)return reject("EVIDENCE_NOT_FOUND","The evidence is not available in this workspace.",404);return decodeEvidence(row.id,row.metadataJson);
}
export async function collectDecisionEvidence(scope:Scope,body:Record<string,unknown>,signal:AbortSignal):Promise<SavedEvidence>{
 if(body.acknowledgeProviderUsage!==true)reject("USAGE_APPROVAL","Confirm provider usage before collecting current evidence.");
 let symbol:string;try{symbol=evidenceSymbol(body.symbol);}catch(e){return reject("SYMBOL",e instanceof Error?e.message:"Select an exact ticker.");}
 if(!EVIDENCE_SECTIONS.includes(body.section as EvidenceSection))reject("SECTION","Select a supported evidence section.");
 const section=body.section as EvidenceSection,storage=marketStorage(scope),config=marketConfiguration();
 let data:EvidenceData[EvidenceSection],receipts:MarketReceipt[]=[],sourceSnapshotId="";
 if(section==="quote"||section==="history"){
  const result=await loadMarketSection({section,symbol,range:"3M",confirmOptions:false},storage,signal);data=result.data;receipts=result.receipts;sourceSnapshotId=result.snapshotId??sha(JSON.stringify({section,symbol,data,receipts}));
 }else{
  const call=createMarketReader(config,storage,signal,receipts);
  if(section==="news"){const policy=sectionPolicy({section:"news",symbol,range:"3M",confirmOptions:false},config.entitlement);data=await call(policy.endpoint,policy.params,policy.ttlMs,raw=>parseNewsEvidence(raw,symbol));}
  else if(section==="insiders")data=await call("INSIDER_TRANSACTIONS",{symbol},3600000,raw=>parseInsiders(raw,symbol));
  else data=await call("INSTITUTIONAL_HOLDINGS",{symbol},3600000,raw=>parseInstitutional(raw,symbol));
  sourceSnapshotId=sha(JSON.stringify({schema:"decision-evidence-1",section,symbol,data,receipts:receipts.map(r=>({sha256:r.sha256,retrievedAt:r.retrievedAt}))}));
 }
 const deliveryIdentity=sha(JSON.stringify({sourceSnapshotId,data,receipts:receipts.map(r=>({sha:r.sha256,retrievedAt:r.retrievedAt,state:r.cacheState,notice:r.refreshNotice,retryAt:r.retryAt}))}));
 const eventKey=`decision-evidence:${scope.firmId}:${deliveryIdentity}`;
 const prior=await prisma.backendPlatformEvent.findUnique({where:{userId_eventKey:{userId:scope.userId,eventKey}},select:{id:true,metadataJson:true,sourceId:true}});
 if(prior&&prior.sourceId===scope.firmId)return decodeEvidence(prior.id,prior.metadataJson);
 const payload={version:1 as const,section,symbol,preparedAt:new Date().toISOString(),data,receipts,sourceSnapshotId};const outputHash=sha(JSON.stringify(payload)),metadataJson=JSON.stringify({payload,outputHash});
 if(Buffer.byteLength(metadataJson)>1200000)reject("EVIDENCE_SIZE","The evidence exceeds the saved snapshot size limit.",422);
 const row=await prisma.backendPlatformEvent.upsert({where:{userId_eventKey:{userId:scope.userId,eventKey}},update:{},create:{userId:scope.userId,eventKey,eventType:EVIDENCE,area:"Scenario Studio",title:`${symbol} ${section} evidence`,severity:"Info",status:"Ready",sourceType:"DecisionEvidence",sourceId:scope.firmId,metadataJson},select:{id:true,metadataJson:true}});
 return decodeEvidence(row.id,row.metadataJson);
}
function decodeReport(id:string,text:string):DecisionReport{const saved=parse<{payload:Omit<DecisionReport,"id"|"outputHash">;outputHash:string}>(text);if(saved.payload.version!==DECISION_VERSION||sha(JSON.stringify(saved.payload))!==saved.outputHash)reject("REPORT_INTEGRITY","The report failed its snapshot integrity check.",409);return {...saved.payload,id,outputHash:saved.outputHash};}
export async function readDecisionReport(scope:Scope,id:unknown){const row=await prisma.backendPlatformEvent.findFirst({where:{...reportWhere(scope),id:allowedId(id,"report")},select:{id:true,metadataJson:true}});if(!row)return reject("REPORT_NOT_FOUND","Report not found in this workspace.",404);return decodeReport(row.id,row.metadataJson);}
export async function listDecisionReports(scope:Scope){const rows=await prisma.backendPlatformEvent.findMany({where:reportWhere(scope),orderBy:[{createdAt:"desc"},{id:"desc"}],take:30,select:{id:true,title:true,createdAt:true}});return rows.map(r=>({...r,createdAt:r.createdAt.toISOString()}));}
export async function createDecisionReport(scope:Scope,body:Record<string,unknown>):Promise<{id:string;outputHash:string;reused:boolean}>{
 const key=allowedId(body.requestKey,"request identifier");
 const ids=body.evidenceIds??[];if(!Array.isArray(ids)||ids.length>10||ids.some(x=>!validId(x)))reject("EVIDENCE_IDS","Attach at most ten saved evidence snapshots.");
 const cleanIds=[...new Set(ids as string[])].sort();
 const runId=body.runId?allowedId(body.runId,"run"):null,scenarioId=body.scenarioId?allowedId(body.scenarioId,"scenario"):null;if(!runId&&!scenarioId)reject("SOURCE_REQUIRED","Select a saved historical run or scenario.");
 const requestHash=sha(JSON.stringify({runId,scenarioId,evidenceIds:cleanIds,expectedSourceHash:body.expectedSourceHash,expectedScenarioVersion:body.expectedScenarioVersion,expectedScenarioResultHash:body.expectedScenarioResultHash})),eventKey=`decision-report:${scope.firmId}:${key}`;
 const prior=await prisma.backendPlatformEvent.findUnique({where:{userId_eventKey:{userId:scope.userId,eventKey}},select:{id:true,metadataJson:true,sourceId:true}});
 if(prior){if(prior.sourceId!==scope.firmId)return reject("REPORT_SCOPE","Report scope does not match.",403);const report=decodeReport(prior.id,prior.metadataJson);if(report.requestHash!==requestHash)reject("REQUEST_REUSED","This request identifier was used with different source selections.",409);return {id:prior.id,outputHash:report.outputHash,reused:true};}
 const source=await readDecisionSource(scope,{runId:runId??undefined,scenarioId:scenarioId??undefined}),evidence=await Promise.all(cleanIds.map(id=>getDecisionEvidence(scope,id)));
 if(body.expectedSourceHash!==source.sourceHash)reject("SOURCE_CHANGED","The historical source differs from the reviewed source. Reload before saving a report.",409);
 if(source.scenario&&(body.expectedScenarioVersion!==source.scenario.scenario.version||body.expectedScenarioResultHash!==(source.scenario.scenario.resultHash??null)))reject("SCENARIO_CHANGED","The paper checkpoint changed since you reviewed it. Reload before saving a report.",409);
 const universe=new Set([...source.result.spec.symbols,source.result.spec.benchmark]);
 if(evidence.some(e=>!universe.has(e.symbol)))reject("EVIDENCE_UNIVERSE","An attached instrument is not in this strategy or its benchmark.");
 const payload:Omit<DecisionReport,"id"|"outputHash">={version:DECISION_VERSION,createdAt:new Date().toISOString(),title:`${source.scenario?.scenario.name??source.result.spec.name} — decision review`,requestHash,source,evidence,interpretation:interpretSource(source,evidence),limitations:REPORT_LIMITATIONS};
 const outputHash=sha(JSON.stringify(payload)),metadataJson=JSON.stringify({payload,outputHash});if(Buffer.byteLength(metadataJson)>3500000)reject("REPORT_SIZE","This report exceeds the 3.5 MB interactive snapshot limit. Attach fewer evidence snapshots or use a shorter source run; no partial report was saved.",422);
 const row=await prisma.backendPlatformEvent.upsert({where:{userId_eventKey:{userId:scope.userId,eventKey}},update:{},create:{id:randomUUID(),userId:scope.userId,eventKey,eventType:REPORT,area:"Scenario Studio",title:payload.title.slice(0,180),severity:"Info",status:"Complete",sourceType:"DecisionReport",sourceId:scope.firmId,metadataJson},select:{id:true,metadataJson:true}});
 const saved=decodeReport(row.id,row.metadataJson);if(saved.requestHash!==requestHash)reject("REQUEST_REUSED","This request identifier was used with different selections.",409);return {id:row.id,outputHash:saved.outputHash,reused:saved.createdAt!==payload.createdAt};
}
export async function readPinnedPrices(scope:Scope,input:{runId?:unknown;scenarioId?:unknown;symbol:unknown;sourceHash?:unknown;checkpoint?:unknown}):Promise<import("./contracts").PinnedPriceSeries>{
 const source=await readDecisionSource(scope,input),symbol=evidenceSymbol(input.symbol);
 if(input.sourceHash&&input.sourceHash!==source.sourceHash)return reject("SOURCE_CHANGED","The historical source changed. Reload the review.",409);
 if(source.scenario&&input.checkpoint!==source.scenario.scenario.resultHash)return reject("SCENARIO_CHANGED","The paper checkpoint changed. Reload before inspecting its price chart.",409);
 if(![...source.result.spec.symbols,source.result.spec.benchmark].includes(symbol))return reject("PRICE_UNIVERSE","Choose an instrument from this strategy.");
 let dataset:import("@/lib/strategy-lab/contracts").Dataset,calculation=source.result,classification:"historical"|"registered-paper"="historical";
 if(source.scenario){
  if(!source.scenario.result)return reject("FORWARD_EMPTY","No accepted forward result is available for a price/trade chart.",409);
  const row=await prisma.sliceForwardScenario.findFirst({where:{...scope,id:source.scenario.scenario.id},select:{journalJson:true,journalHash:true,resultHash:true}});
  if(!row||!row.journalJson||!row.journalHash||row.resultHash!==source.scenario.scenario.resultHash)return reject("SCENARIO_CHANGED","The scenario changed during this read. Reload its checkpoint.",409);
  const journal=parse<import("@/lib/connected-research/scenario-core").ScenarioJournal>(row.journalJson,row.journalHash),found=journal.datasets.find(d=>d.symbol===symbol);
  if(!found)return reject("JOURNAL_SYMBOL","The accepted journal has no matching instrument.",409);dataset=found;calculation=source.scenario.result.calculation;classification="registered-paper";
 }else{
  const manifest=source.result.manifests.find(m=>m.symbol===symbol);if(!manifest)return reject("SOURCE_MANIFEST","The pinned manifest has no matching instrument.",409);
  const {loadDatasets}=await import("@/lib/strategy-lab/provider");const rows=await loadDatasets(scope.userId,[manifest.id]);const found=rows.find(d=>d.id===manifest.id&&d.symbol===symbol&&d.sourceSha256===manifest.sourceSha256);if(!found)return reject("SOURCE_MANIFEST","The pinned dataset no longer matches its manifest.",409);dataset=found;
 }
 return {symbol,classification,sourceHash:dataset.sourceSha256,datasetId:dataset.id,bars:dataset.bars.filter(b=>b.date>=calculation.effectiveStart&&b.date<=calculation.effectiveEnd).map(b=>({date:b.date,open:b.open,high:b.high,low:b.low,close:b.close,volume:b.volume})),trades:calculation.trades.filter(t=>t.symbol===symbol),note:"Raw closing prices from the exact saved dataset or accepted journal. Triangles mark modeled fill prices, not actual broker fills. Splits may cause raw-price discontinuities; strategy performance retains its corporate-action accounting."};
}
