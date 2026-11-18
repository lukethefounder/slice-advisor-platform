import { apiJson, withApiRoute } from "@/lib/api-route";
import { prisma } from "@/lib/prisma";
import { connectedAccess } from "@/lib/connected-research/access";
import { PROVIDER } from "@/lib/strategy-lab/contracts";
export const runtime="nodejs";export const dynamic="force-dynamic";
export const GET=withApiRoute({route:"/api/strategy-lab/bootstrap",timeoutMs:18000,cacheControl:"private, no-store"},async({request})=>{
 const {userId,firmId}=await connectedAccess(request);
 const result=await Promise.allSettled([
  prisma.sliceResearchDataset.findMany({where:{userId,provider:PROVIDER,endpoint:"TIME_SERIES_DAILY_ADJUSTED"},orderBy:{retrievedAt:"desc"},take:200,select:{id:true,provider:true,symbol:true,currency:true,sourceSha256:true,retrievedAt:true,firstDate:true,lastDate:true,barCount:true}}),
  prisma.sliceStrategyRun.findMany({where:{userId},orderBy:{createdAt:"desc"},take:50,select:{id:true,name:true,createdAt:true,engineVersion:true,summaryJson:true}}).then(rows=>rows.map(r=>({id:r.id,name:r.name,createdAt:r.createdAt,engineVersion:r.engineVersion,summary:JSON.parse(r.summaryJson) as unknown}))),
  prisma.sliceStrategyDefinition.findMany({where:{userId},orderBy:{updatedAt:"desc"},take:100,select:{id:true,name:true,updatedAt:true,specJson:true}}).then(rows=>rows.map(r=>({id:r.id,name:r.name,updatedAt:r.updatedAt,spec:JSON.parse(r.specJson) as unknown}))),
 ]);
 return apiJson({ok:true,scope:`${userId}:${firmId}`,sections:result.map((r,i)=>r.status==="fulfilled"?{ok:true,data:r.value}:{ok:false,message:`${["Historical datasets","Saved results","Saved definitions"][i]} could not be loaded. Check Data Readiness and retry.`}),limits:{datasets:200,runs:50,saved:100},preparedAt:new Date().toISOString()});
});
