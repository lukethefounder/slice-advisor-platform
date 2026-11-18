import { ApiError, withApiRoute } from "@/lib/api-route";
import { requireCurrentClientPortalSession } from "@/lib/client-portal-auth";
import { noStoreJson } from "@/lib/client-data-security";
import { prisma } from "@/lib/prisma";
import { routeClientPortalEvent } from "@/lib/client-portal/events";
import { checkRateLimit, getClientIp, hashForSecurity, isPotentiallyCrossSiteUnsafeRequest } from "@/lib/security";
import { safeSchedulingLink, validatePortalSubmission } from "@/lib/portal-experience/core";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const GET=withApiRoute({route:"/api/client-portal/overview",timeoutMs:15000,cacheControl:"private, no-store, max-age=0"},async()=>{
 const c=await requireCurrentClientPortalSession();const notices:string[]=[];
 const rows=await prisma.advisorClientInboxItem.findMany({where:{firmId:c.assignment.firmId,clientId:c.client.id},orderBy:[{createdAt:"desc"},{id:"desc"}],take:31,select:{id:true,title:true,body:true,kind:true,status:true,createdAt:true,updatedAt:true}});
 const items=rows.slice(0,30);const replies=items.length?await prisma.advisorClientInboxReply.findMany({where:{inboxItemId:{in:items.map(x=>x.id)}},orderBy:[{createdAt:"desc"},{id:"desc"}],take:101,select:{id:true,inboxItemId:true,body:true,createdAt:true}}):[];
 if(replies.length>100)notices.push("Showing the latest 100 advisor replies for these recent submissions. Advanced tools retain the existing conversation workflow.");
 return noStoreJson({ok:true,preparedAt:new Date().toISOString(),client:{id:c.client.id,name:c.client.fullName,household:c.client.householdName??"",objective:c.client.objective??"",risk:c.client.riskProfile??"",horizon:c.client.timeHorizon??"",liquidity:c.client.liquidityNeeds??"",onboarding:c.client.portalOnboardingStatus},advisor:{name:c.assignment.user.name||"Your advisor",email:c.assignment.user.email,schedulingUrl:c.scheduling.enabled?safeSchedulingLink(c.scheduling.url):null,schedulingLabel:c.scheduling.label},firm:{name:c.assignment.firm.name},expiresAt:c.session.expiresAt.toISOString(),items,replies:replies.slice(0,100),hasMore:rows.length>30,notices});
});
export const POST=withApiRoute({route:"/api/client-portal/overview",timeoutMs:30000,cacheControl:"private, no-store, max-age=0"},async({request})=>{
 if(isPotentiallyCrossSiteUnsafeRequest(request))throw new ApiError({status:403,code:"CROSS_SITE",message:"Cross-site submission blocked.",expose:true});
 if(!(request.headers.get("content-type")??"").includes("application/json"))throw new ApiError({status:415,code:"FORMAT",message:"Use a JSON request.",expose:true});
 const c=await requireCurrentClientPortalSession();const rate=checkRateLimit({key:`client-portal-routing:${c.client.id}:${hashForSecurity(getClientIp(request))}`,limit:40,windowMs:60000});
 if(!rate.allowed)return noStoreJson({ok:false,error:"Too many requests. Retry after the indicated delay."},{status:429,headers:{"Retry-After":String(rate.retryAfterSeconds)}});
 const text=await request.text();if(Buffer.byteLength(text)>16000)throw new ApiError({status:413,code:"SIZE",message:"Request is too large.",expose:true});
 let input;try{input=validatePortalSubmission(JSON.parse(text));}catch{throw new ApiError({status:400,code:"INPUT",message:"Enter a valid subject, message and request type.",expose:true});}
 if(input.expectedClientId!==c.client.id)throw new ApiError({status:409,code:"SESSION_CHANGED",message:"The signed-in client changed. Reload before submitting.",expose:true});
 const result=await routeClientPortalEvent({current:c,event:input,request});
 return noStoreJson({ok:true,created:result.created,item:result.item,notificationQueued:result.notificationQueued});
});
