import { apiJson, withApiRoute } from "@/lib/api-route";
import { connectedAccess } from "@/lib/connected-research/access";
import { readResearchJson } from "@/lib/strategy-lab/http";
import { decisionFailure } from "@/lib/scenario-decision/route-error";
import { createStudy, listStudies, readStudy } from "@/lib/earnings-lab/service";
export const runtime="nodejs"; export const dynamic="force-dynamic"; export const maxDuration=90;
export const GET=withApiRoute({route:"/api/strategy-lab/earnings",timeoutMs:15000,cacheControl:"private, no-store, max-age=0"},async({request})=>{const scope=await connectedAccess(request);try{const id=new URL(request.url).searchParams.get("id");return apiJson({ok:true,...(id?{review:await readStudy(scope,id)}:{reviews:await listStudies(scope)})});}catch(e){decisionFailure(e);}});
export const POST=withApiRoute({route:"/api/strategy-lab/earnings",timeoutMs:85000,cacheControl:"private, no-store, max-age=0"},async({request})=>{const scope=await connectedAccess(request,true);try{return apiJson({ok:true,review:await createStudy(scope,await readResearchJson(request),request.signal)});}catch(e){decisionFailure(e);}});
