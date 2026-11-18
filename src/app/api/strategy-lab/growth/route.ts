import {apiJson,withApiRoute} from "@/lib/api-route";
import {strategyAccess,readResearchJson,strategyFailure} from "@/lib/strategy-lab/http";
import {loadDatasets} from "@/lib/strategy-lab/provider";
import {StrategyError,manifestOf} from "@/lib/strategy-lab/contracts";
import {growthIllustration} from "@/lib/strategy-ease/growth";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const POST=withApiRoute({route:"/api/strategy-lab/growth",timeoutMs:20000,cacheControl:"private, no-store"},async({request})=>{
 const userId=await strategyAccess(request,true);
 try{const body=await readResearchJson(request);if(typeof body.datasetId!=="string"||! /^[a-zA-Z0-9_-]{1,100}$/.test(body.datasetId))throw new StrategyError("DATASET","Select a verified saved dataset.");const [dataset]=await loadDatasets(userId,[body.datasetId]);let result;try{result=growthIllustration(dataset.bars,body.assumptions);}catch(e){throw new StrategyError("ASSUMPTIONS",e instanceof Error?e.message:"Review the assumptions.");}return apiJson({ok:true,result,source:manifestOf(dataset),preparedAt:new Date().toISOString()});}catch(e){strategyFailure(e);}
});
