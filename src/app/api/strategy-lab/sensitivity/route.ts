import { apiJson, withApiRoute } from "@/lib/api-route";
import { connectedAccess } from "@/lib/connected-research/access";
import { readResearchJson, strategyFailure } from "@/lib/strategy-lab/http";
import { reviewCosts } from "@/lib/strategy-space/sensitivity-service";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const POST=withApiRoute({route:"/api/strategy-lab/sensitivity",timeoutMs:55000,cacheControl:"private, no-store"},async({request})=>{
 const scope=await connectedAccess(request,true);
 try{return apiJson({ok:true,...await reviewCosts(scope,await readResearchJson(request))});}catch(error){strategyFailure(error);}
});
