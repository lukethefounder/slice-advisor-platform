import {apiJson,withApiRoute} from "@/lib/api-route";
import {connectedAccess} from "@/lib/connected-research/access";
import {readPinnedPrices} from "@/lib/scenario-decision/service";
import {decisionFailure} from "@/lib/scenario-decision/route-error";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const GET=withApiRoute({route:"/api/scenario-decision/prices",timeoutMs:25000,cacheControl:"private, no-store, max-age=0"},async({request})=>{const scope=await connectedAccess(request);try{const q=new URL(request.url).searchParams;return apiJson({ok:true,prices:await readPinnedPrices(scope,{runId:q.get("runId"),scenarioId:q.get("scenarioId"),symbol:q.get("symbol"),sourceHash:q.get("sourceHash"),checkpoint:q.get("checkpoint")})});}catch(e){decisionFailure(e);}});
