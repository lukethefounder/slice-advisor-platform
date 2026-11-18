import { apiJson, withApiRoute } from "@/lib/api-route";
import { connectedAccess } from "@/lib/connected-research/access";
import { readDecisionSource } from "@/lib/scenario-decision/service";
import { decisionFailure } from "@/lib/scenario-decision/route-error";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const GET=withApiRoute({route:"/api/scenario-decision/source",timeoutMs:25000,cacheControl:"private, no-store, max-age=0"},async({request})=>{
 const scope=await connectedAccess(request);try{const u=new URL(request.url);return apiJson({ok:true,source:await readDecisionSource(scope,{runId:u.searchParams.get("runId"),scenarioId:u.searchParams.get("scenarioId")})});}catch(e){decisionFailure(e);}
});
