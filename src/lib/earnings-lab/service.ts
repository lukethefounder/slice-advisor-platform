import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { loadDatasets } from "@/lib/strategy-lab/provider";
import { StrategyError, manifestOf } from "@/lib/strategy-lab/contracts";
import { marketStorage } from "@/lib/market-evidence/storage";
import { loadMarketSection } from "@/lib/market-visuals/service";
import { collectDecisionEvidence } from "@/lib/scenario-decision/service";
import type { Scope } from "@/lib/connected-research/contracts";
import type { SavedEvidence } from "@/lib/scenario-decision/contracts";
import type { SectionResponse } from "@/lib/market-visuals/contracts";
import { buildStudy, validateAssumptions, type EarningsStudy } from "./core";
const TYPE="SLICE_EARNINGS_ANALOG_V1",sha=(s:string)=>createHash("sha256").update(s).digest("hex");
const id=(v:unknown)=>{if(typeof v!=="string"||!/^[a-zA-Z0-9_-]{1,100}$/.test(v))throw new StrategyError("ID_REQUIRED","Select a valid saved record.",400);return v;};
export type SavedStudy={id:string;study:EarningsStudy;sourceHash:string;datasets:ReturnType<typeof manifestOf>[];earnings:SectionResponse<"earnings">;context:SavedEvidence[];contextNotices:string[]};
function decode(row:{id:string;metadataJson:string}):SavedStudy{const p=JSON.parse(row.metadataJson) as {payload:Omit<SavedStudy,"id"|"sourceHash">;hash:string};if(sha(JSON.stringify(p.payload))!==p.hash)throw new StrategyError("INTEGRITY","Saved earnings review failed its checksum.",409);return {...p.payload,id:row.id,sourceHash:p.hash};}
export async function listStudies(scope:Scope){return prisma.backendPlatformEvent.findMany({where:{userId:scope.userId,sourceId:scope.firmId,eventType:TYPE},select:{id:true,title:true,createdAt:true},orderBy:[{createdAt:"desc"},{id:"desc"}],take:30});}
export async function readStudy(scope:Scope,requested:unknown){const row=await prisma.backendPlatformEvent.findFirst({where:{id:id(requested),userId:scope.userId,sourceId:scope.firmId,eventType:TYPE},select:{id:true,metadataJson:true}});if(!row)throw new StrategyError("NOT_FOUND","Earnings review not found in this workspace.",404);return decode(row);}
async function performStudy(scope:Scope,body:Record<string,unknown>,signal:AbortSignal):Promise<SavedStudy>{
 const today=new Intl.DateTimeFormat("en-CA",{timeZone:"America/New_York",year:"numeric",month:"2-digit",day:"2-digit"}).format(new Date());
 let assumptions;try{assumptions=validateAssumptions(body.assumptions,today);}catch(e){throw new StrategyError("ASSUMPTIONS",e instanceof Error?e.message:"Invalid assumptions.");}
 if(body.acknowledgeProviderUsage!==true)throw new StrategyError("APPROVAL","Approve provider usage before collecting earnings and optional context.",400);
 const ids=[id(body.stockDatasetId),id(body.benchmarkDatasetId)];
 const datasets=await loadDatasets(scope.userId,ids),stock=datasets.find(d=>d.id===ids[0]),benchmark=datasets.find(d=>d.id===ids[1]);
 if(stock?.symbol!==assumptions.symbol||benchmark?.symbol!==assumptions.benchmark)throw new StrategyError("DATA_IDENTITY","The selected dataset versions do not match the exact stock and benchmark.",409);
 const requestKey=id(body.requestKey),requestHash=sha(JSON.stringify({assumptions,ids,withContext:body.withContext===true})),eventKey=`earnings-review:${scope.firmId}:${requestKey}`;
 const prior=await prisma.backendPlatformEvent.findUnique({where:{userId_eventKey:{userId:scope.userId,eventKey}},select:{id:true,metadataJson:true,detail:true,sourceId:true}});
 if(prior){if(prior.detail!==requestHash||prior.sourceId!==scope.firmId)throw new StrategyError("REQUEST_CONFLICT","Request key already used with different assumptions.",409);return decode(prior);}
 const earnings=await loadMarketSection({section:"earnings",symbol:assumptions.symbol,range:"1Y",confirmOptions:false},marketStorage(scope),signal);
 let study:EarningsStudy;try{study=buildStudy({assumptions,events:earnings.data.rows,stock:stock.bars,benchmark:benchmark.bars,today,preparedAt:new Date().toISOString()});}catch(e){throw new StrategyError("EVENT_READINESS",e instanceof Error?e.message:"Event study failed readiness checks.");}
 const context:SavedEvidence[]=[],contextNotices:string[]=[];
 if(body.withContext===true){for(const section of ["quote","news"] as const){if(signal.aborted){contextNotices.push("Context collection cancelled; verified event results remain available.");break;}try{context.push(await collectDecisionEvidence(scope,{section,symbol:assumptions.symbol,acknowledgeProviderUsage:true},signal));}catch{contextNotices.push(`${section}: current context unavailable. Historical sample and assumptions were not changed.`);}}}
 const payload={study,datasets:datasets.map(manifestOf),earnings,context,contextNotices},hash=sha(JSON.stringify(payload)),metadataJson=JSON.stringify({payload,hash});
 if(Buffer.byteLength(metadataJson)>1400000)throw new StrategyError("SIZE","Reduce attached evidence; no partial snapshot was saved.",422);
 const row=await prisma.backendPlatformEvent.upsert({where:{userId_eventKey:{userId:scope.userId,eventKey}},update:{},create:{userId:scope.userId,eventKey,eventType:TYPE,area:"Strategy Studio",title:`${assumptions.symbol} hypothetical earnings / ${assumptions.targetDate}`,severity:"Info",status:"Ready",sourceType:"ConditionalEarnings",sourceId:scope.firmId,detail:requestHash,metadataJson},select:{id:true,metadataJson:true,detail:true}});
 if(row.detail!==requestHash)throw new StrategyError("REQUEST_CONFLICT","Request key conflict.",409);return decode(row);
}

/** Cross-worker lease; safety control, not a beta subscription allowance. */
export async function createStudy(scope:Scope,body:Record<string,unknown>,signal:AbortSignal):Promise<SavedStudy>{
 const eventKey=`earnings-lease:${scope.firmId}`,token=randomUUID();
 const row=await prisma.backendPlatformEvent.upsert({where:{userId_eventKey:{userId:scope.userId,eventKey}},update:{},create:{userId:scope.userId,eventKey,eventType:"SLICE_EARNINGS_LEASE_V1",area:"Strategy Studio",title:"Earnings review lease",severity:"Info",status:"Idle",sourceType:"EarningsLease",sourceId:scope.firmId,metadataJson:"{}"},select:{id:true}});
 const claimed=await prisma.backendPlatformEvent.updateMany({where:{id:row.id,userId:scope.userId,sourceId:scope.firmId,OR:[{status:{not:"Running"}},{updatedAt:{lt:new Date(Date.now()-180000)}}]},data:{status:"Running",detail:token}});
 if(claimed.count!==1)throw new StrategyError("EARNINGS_BUSY","An earnings review is already running in this workspace. Saved studies remain available.",409);
 try{return await performStudy(scope,body,signal);}finally{await prisma.backendPlatformEvent.updateMany({where:{id:row.id,userId:scope.userId,detail:token},data:{status:"Idle",detail:null}}).catch(()=>undefined);}
}
