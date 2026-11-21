import { apiJson, withApiRoute } from "@/lib/api-route";
import { connectedAccess } from "@/lib/connected-research/access";
import { readResearchJson } from "@/lib/strategy-lab/http";
import { collectDecisionEvidence, getDecisionEvidence } from "@/lib/scenario-decision/service";
import { decisionFailure } from "@/lib/scenario-decision/route-error";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const GET=withApiRoute({route:"/api/scenario-decision/evidence",timeoutMs:15000,cacheControl:"private, no-store, max-age=0"},async({request})=>{
 const scope=await connectedAccess(request);try{return apiJson({ok:true,evidence:await getDecisionEvidence(scope,new URL(request.url).searchParams.get("id"))});}catch(e){decisionFailure(e);}
});
export const POST=withApiRoute({route:"/api/scenario-decision/evidence",timeoutMs:35000,cacheControl:"private, no-store, max-age=0"},async({request})=>{
 const scope=await connectedAccess(request,true);try{return apiJson({ok:true,evidence:await collectDecisionEvidence(scope,await readResearchJson(request),request.signal)});}catch(e){decisionFailure(e);}
});
