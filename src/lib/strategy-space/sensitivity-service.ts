import "server-only";
import { randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { loadDatasets } from "@/lib/strategy-lab/provider";
import { StrategyError, type BacktestResult } from "@/lib/strategy-lab/contracts";
import type { Scope } from "@/lib/connected-research/contracts";
import { validRecordId } from "./routes";
import { costSensitivity, sensitivityInputHash, validateCases, sha, type SensitivityReport } from "./sensitivity-core";
export type SavedSensitivity = { runId: string; sourceHash: string; inputHash: string; outputHash: string; createdAt: string; report: SensitivityReport; reused: boolean };
export async function reviewCosts(scope: Scope, body: Record<string,unknown>): Promise<SavedSensitivity> {
  if(!validRecordId(body.runId)) throw new StrategyError("RUN_ID", "Select a saved historical run.",400);
  const cases=validateCases(body.cases);
  // Historical runs retain their established per-user ownership. Reports are additionally firm-scoped.
  const run=await prisma.sliceStrategyRun.findFirst({where:{id:body.runId,userId:scope.userId},select:{id:true,resultJson:true,outputSha256:true,datasetIdsJson:true}});
  if(!run) throw new StrategyError("RUN_NOT_FOUND","Saved run not found for this user.",404);
  if(sha(run.resultJson)!==run.outputSha256) throw new StrategyError("RESULT_INTEGRITY","Source result failed its checksum.",409);
  const inputHash=sensitivityInputHash(run.id,run.outputSha256,cases),eventKey=`strategy-review:${scope.firmId}:${inputHash}`;
  const existing=await prisma.backendPlatformEvent.findUnique({where:{userId_eventKey:{userId:scope.userId,eventKey}},select:{metadataJson:true,sourceId:true}});
  if(existing && existing.sourceId===scope.firmId){
    const prior=JSON.parse(existing.metadataJson) as SavedSensitivity;
    if(prior.inputHash!==inputHash || sha(JSON.stringify(prior.report))!==prior.outputHash) throw new StrategyError("REVIEW_INTEGRITY","Saved review failed validation.",409);
    return {...prior,reused:true};
  }
  const leaseKey=`strategy-review-lease:${scope.firmId}`, token=randomUUID(), now=new Date();
  const lease=await prisma.backendPlatformEvent.upsert({where:{userId_eventKey:{userId:scope.userId,eventKey:leaseKey}},update:{},create:{userId:scope.userId,eventKey:leaseKey,eventType:"SLICE_STRATEGY_REVIEW_LEASE",sourceType:"StrategyReviewLease",sourceId:scope.firmId,area:"Strategy Lab",title:"Historical review lease",status:"Idle",severity:"Info",metadataJson:"{}"},select:{id:true}});
  const claimed=await prisma.backendPlatformEvent.updateMany({where:{id:lease.id,userId:scope.userId,OR:[{status:{not:"Running"}},{updatedAt:{lt:new Date(now.getTime()-120000)}}]},data:{status:"Running",sourceId:token}});
  if(claimed.count!==1) throw new StrategyError("REVIEW_RUNNING","A review is already running in this workspace. Let it complete before starting another.",409);
  try {
    const result=JSON.parse(run.resultJson) as BacktestResult;
    const ids=JSON.parse(run.datasetIdsJson) as unknown;
    if(!Array.isArray(ids)||ids.some(x=>!validRecordId(x))) throw new StrategyError("SOURCE_IDS","Saved dataset references are invalid.",409);
    const datasets=await loadDatasets(scope.userId,ids as string[]);
    const report=costSensitivity(result,datasets,cases),outputHash=sha(JSON.stringify(report));
    const saved:SavedSensitivity={runId:run.id,sourceHash:run.outputSha256,inputHash,outputHash,createdAt:new Date().toISOString(),report,reused:false};
    const text=JSON.stringify(saved);
    if(Buffer.byteLength(text)>250000) throw new StrategyError("REPORT_SIZE","The review exceeded the interactive summary size.",422);
    await prisma.backendPlatformEvent.upsert({where:{userId_eventKey:{userId:scope.userId,eventKey}},update:{},create:{userId:scope.userId,eventKey,eventType:"SLICE_STRATEGY_COST_REVIEW_V1",area:"Strategy Lab",title:`Cost sensitivity: ${result.spec.name}`.slice(0,150),status:"Complete",severity:"Info",sourceType:"StrategyCostSensitivity",sourceId:scope.firmId,metadataJson:text}});
    return saved;
  } finally {await prisma.backendPlatformEvent.updateMany({where:{id:lease.id,sourceId:token},data:{status:"Idle",sourceId:null}}).catch(()=>undefined);}
}
