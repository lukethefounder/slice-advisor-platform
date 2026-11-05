import { studioAccess, failure, PRIVATE_HEADERS } from "@/lib/studio/request";
import { MarketError } from "@/lib/market-evidence/core";
import { readGatewayBudget } from "@/lib/market-evidence/storage";
export const runtime="nodejs";
export const dynamic="force-dynamic";
export async function GET(request:Request){
 try{await studioAccess(request);return Response.json({ok:true,budget:await readGatewayBudget(),note:"Application gateway counters only. Legacy collectors and external applications may also consume the provider allowance. Configuration is not entitlement verification."},{headers:PRIVATE_HEADERS});}
 catch(e){if(e instanceof MarketError)return Response.json({ok:false,message:e.message,code:e.code},{status:e.status,headers:PRIVATE_HEADERS});return failure(e);}
}
