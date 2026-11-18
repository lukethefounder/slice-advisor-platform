import { apiJson, withApiRoute } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { connectedAccess } from "@/lib/connected-research/access";
import { StrategyError, engineVersionFor, type StrategySpec } from "@/lib/strategy-lab/contracts";
import { digest, type ForwardResult } from "@/lib/connected-research/scenario-core";
import { strategyFailure } from "@/lib/strategy-lab/http";
import { validRecordId } from "@/lib/strategy-space/routes";
import type { ScenarioWatch } from "@/lib/strategy-space/live-core";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const GET=withApiRoute({route:"/api/strategy-lab/watch",timeoutMs:15000,cacheControl:"private, no-store"},async({request})=>{
 const scope=await connectedAccess(request);
 try {
  const id=new URL(request.url).searchParams.get("id");if(!validRecordId(id)) throw new StrategyError("SCENARIO_ID","Select a saved scenario.",400);
  const row=await prisma.sliceForwardScenario.findFirst({where:{...scope,id},select:{id:true,name:true,status:true,sourceRunId:true,specJson:true,assumptionsJson:true,baselineWeightsJson:true,definitionHash:true,resultHash:true,resultJson:true,frozenAt:true,lastSession:true,acceptedSessions:true,lastError:true,nextCheckAt:true,updatedAt:true}});
  if(!row) throw new StrategyError("SCENARIO_NOT_FOUND","Scenario not found in this workspace.",404);
  if(digest(row.specJson+"\n"+row.assumptionsJson+"\n"+row.baselineWeightsJson)!==row.definitionHash) throw new StrategyError("DEFINITION_INTEGRITY","Scenario rules failed validation.",409);
  if(row.resultJson && (!row.resultHash || digest(row.resultJson)!==row.resultHash)) throw new StrategyError("RESULT_INTEGRITY","Saved paper result failed validation.",409);
  const spec=JSON.parse(row.specJson) as StrategySpec,assumptions=JSON.parse(row.assumptionsJson) as {targetSessions:number};
  const result=row.resultJson ? JSON.parse(row.resultJson) as ForwardResult : null;
  if(result && (result.calculation.engineVersion!==engineVersionFor(spec) || result.acceptedSessions!==row.acceptedSessions || result.throughDate!==row.lastSession)) throw new StrategyError("CHECKPOINT_MISMATCH","Scenario metadata does not match its accepted calculation.",409);
  const watch:ScenarioWatch={id:row.id,name:row.name,status:row.status,sourceRunId:row.sourceRunId,definitionHash:row.definitionHash,resultHash:row.resultHash,frozenAt:row.frozenAt?.toISOString()??null,lastSession:row.lastSession,acceptedSessions:row.acceptedSessions,targetSessions:assumptions.targetSessions,symbols:spec.symbols,benchmark:spec.benchmark,engineVersion:engineVersionFor(spec),performance:result?.calculation.strategy??null,holdings:result?.calculation.equity.at(-1)?.weights??{},lastError:row.lastError,nextCheckAt:row.nextCheckAt?.toISOString()??null,updatedAt:row.updatedAt.toISOString(),ruleSummary:{rebalance:spec.rebalance,weighting:spec.weighting,maxExposurePct:spec.maxExposurePct}};
  return apiJson({ok:true,scope:`${scope.userId}:${scope.firmId}`,watch});
 }catch(error){strategyFailure(error);}
});
