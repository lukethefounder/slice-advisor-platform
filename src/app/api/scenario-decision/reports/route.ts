import { apiJson, withApiRoute } from "@/lib/api-route";
import { connectedAccess } from "@/lib/connected-research/access";
import { readResearchJson } from "@/lib/strategy-lab/http";
import { readDecisionReport, listDecisionReports, createDecisionReport } from "@/lib/scenario-decision/service";
import { renderDecisionReport } from "@/lib/scenario-decision/report-html";
import { decisionFailure } from "@/lib/scenario-decision/route-error";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const GET=withApiRoute({route:"/api/scenario-decision/reports",timeoutMs:25000,cacheControl:"private, no-store, max-age=0"},async({request})=>{
 const scope=await connectedAccess(request);try{const id=new URL(request.url).searchParams.get("id");if(id){const report=await readDecisionReport(scope,id);if(new URL(request.url).searchParams.get("format")==="html")return new Response(renderDecisionReport(report),{headers:{"Content-Type":"text/html; charset=utf-8","Cache-Control":"private, no-store, max-age=0","X-Content-Type-Options":"nosniff","Referrer-Policy":"no-referrer","Content-Security-Policy":"default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'"}});return apiJson({ok:true,report});}return apiJson({ok:true,reports:await listDecisionReports(scope)});}catch(e){decisionFailure(e);}
});
export const POST=withApiRoute({route:"/api/scenario-decision/reports",timeoutMs:35000,cacheControl:"private, no-store, max-age=0"},async({request})=>{
 const scope=await connectedAccess(request,true);try{return apiJson({ok:true,...await createDecisionReport(scope,await readResearchJson(request))});}catch(e){decisionFailure(e);}
});
