import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { prisma } from "@/lib/prisma";
import type { StudioScope } from "@/lib/studio/request";
import { mayRetain } from "./retention";
import { gatewayPolicy, gatewayBudget, gatewayIssue, type GatewayBudget } from "./gateway-budget";
import { MarketError, obj, defaultPreferences, parsePreferences, connectionFromEvidence } from "./core";
import { marketConfiguration, type CacheValue, type MarketStorage } from "./provider";
import type { MarketConnection, MarketEvidence, PulsePreferences } from "./contracts";
function json(s: string) { try { return obj(JSON.parse(s)); } catch { return {}; } }
const CALL = "SLICE_MARKET_EVIDENCE_CALL_V1", CACHE = "SLICE_MARKET_EVIDENCE_CACHE_V1";
function budgetFailure(code:unknown){return ["GATEWAY_DAY","GATEWAY_MINUTE","GATEWAY_BUDGET"].includes(String(code));}
function policySignature(){try{return JSON.stringify(gatewayPolicy(process.env));}catch(e){throw new MarketError("GATEWAY_CONFIGURATION",e instanceof Error?e.message:"Review gateway policy.",503);}}
export function marketStorage(scope: StudioScope): MarketStorage {
 const cfg = marketConfiguration(), eventKey = (key: string) => `pulse-cache:${scope.firmId}:${key}`;
 const where = (key: string) => ({ userId_eventKey: { userId: scope.userId, eventKey: eventKey(key) } });
 const lock = Number.parseInt(createHash("sha256").update("slice-pulse-quota:" + cfg.fingerprint).digest("hex").slice(0, 7), 16);
 return {
  cacheNamespace: `${scope.userId}:${scope.firmId}`,
  async cached(key, ttl) {
   const row = await prisma.backendPlatformEvent.findUnique({where:where(key),select:{metadataJson:true,status:true,updatedAt:true}}); if(!row)return null;
   const p=json(row.metadataJson),at=typeof p.retrievedAt==="string"?p.retrievedAt:"",age=Date.now()-Date.parse(at);
   // A reviewed policy change may reopen capacity; it never deletes usage reservations.
   // Re-enter reserve() instead of honoring an obsolete failure's cooldown.
   if(row.status==="Failed"&&budgetFailure(p.code)&&p.policySignature!==policySignature())return null;
   const valid=["Ready","Loading","Failed"].includes(row.status)&&(row.status!=="Failed"||mayRetain(String(p.code||"MARKET_BACKOFF")))&&Number.isFinite(age)&&age>=0&&age<ttl&&typeof p.sha256==="string"&&p.value!==undefined;
   if(valid)return {value:p.value,retrievedAt:at,sha256:p.sha256 as string,retained:row.status==="Failed",observedAt:typeof p.observedAt==="string"?p.observedAt:undefined,...(row.status==="Failed"?{refreshNotice:String(p.message||"The prior refresh did not complete."),retryAt:typeof p.retryAt==="string"?p.retryAt:undefined}:{})};
   if(row.status==="Failed"){
    const until=typeof p.retryAt==="string"&&Number.isFinite(Date.parse(p.retryAt))?Date.parse(p.retryAt):row.updatedAt.getTime()+60_000;
    if(until>Date.now())throw new MarketError(String(p.code||"MARKET_BACKOFF"),String(p.message||"The provider is cooling down; saved observations are retained."),typeof p.status==="number"&&p.status>=400&&p.status<=599?p.status:429,Math.ceil((until-Date.now())/1000),new Date(until).toISOString());
   }
   return null;
  },
  async retained(key,maxAgeMs){
   const row=await prisma.backendPlatformEvent.findUnique({where:where(key),select:{metadataJson:true,status:true}});if(!row)return null;
   const p=json(row.metadataJson),at=typeof p.retrievedAt==="string"?p.retrievedAt:"",age=Date.now()-Date.parse(at);
   if(!["Ready","Loading","Failed"].includes(row.status)||!Number.isFinite(age)||age<0||age>maxAgeMs||typeof p.sha256!=="string"||p.value===undefined)return null;
   return {value:p.value,retrievedAt:at,sha256:p.sha256,observedAt:typeof p.observedAt==="string"?p.observedAt:undefined,retained:true};
  },
  async claim(key) {
   const row = await prisma.backendPlatformEvent.upsert({ where: where(key), update: {}, create: { userId: scope.userId, eventKey: eventKey(key), eventType: CACHE, area: "Market Evidence", title: "Timestamped market evidence cache", severity: "Info", status: "Idle", sourceType: "MarketCache", sourceId: scope.firmId, metadataJson: "{}" }, select: { id: true } });
   const token = randomUUID();
   const result = await prisma.backendPlatformEvent.updateMany({ where: { id: row.id, userId: scope.userId, OR: [{ status: { not: "Loading" } }, { updatedAt: { lt: new Date(Date.now() - 30000) } }] }, data: { status: "Loading", detail: token } });
   if (!result.count) throw new MarketError("MARKET_BUSY", "An identical market lookup is already running. Retry shortly.", 409);
   return token;
  },
  async reserve() {
   let policy;try{policy=gatewayPolicy(process.env);}catch(e){throw new MarketError("GATEWAY_CONFIGURATION",e instanceof Error?e.message:"Review gateway configuration.",503);}
   await prisma.$transaction(async tx=>{
    const held=await tx.$queryRaw<Array<{locked:boolean}>>`SELECT pg_try_advisory_xact_lock(${lock}::bigint) AS locked`;
    if(!held[0]?.locked)throw new MarketError("MARKET_BUSY","The market gateway is reserving capacity. Retry shortly.",409,2);
    const now=new Date(),start=new Date(now);start.setUTCHours(0,0,0,0);
    const scopeWhere={eventType:CALL,sourceType:cfg.fingerprint},minuteWhere={...scopeWhere,createdAt:{gte:new Date(now.getTime()-60000)}};
    const [minute,day,oldest]=await Promise.all([
     tx.backendPlatformEvent.count({where:minuteWhere}),
     tx.backendPlatformEvent.count({where:{...scopeWhere,createdAt:{gte:start}}}),
     tx.backendPlatformEvent.findFirst({where:minuteWhere,orderBy:{createdAt:"asc"},select:{createdAt:true}}),
    ]);
    const budget=gatewayBudget(policy,{minute,day,oldestMinuteAt:oldest?.createdAt.toISOString()??null},now.getTime()),issue=gatewayIssue(budget,now.getTime());
    if(issue)throw new MarketError(issue.code,issue.message,429,issue.retryAfterSeconds,issue.retryAt);
    await tx.backendPlatformEvent.create({data:{userId:scope.userId,eventKey:`pulse-call:${randomUUID()}`,eventType:CALL,area:"Market Evidence",title:"Market provider request reservation",severity:"Info",status:"Reserved",sourceType:cfg.fingerprint,sourceId:scope.firmId,metadataJson:"{}"}});
   },{timeout:10000,maxWait:5000});
  },
  async save(key, token, value: CacheValue) {
   const current = await prisma.backendPlatformEvent.findUnique({ where: where(key), select: { metadataJson: true } });
   const prior = current ? json(current.metadataJson) : {};
   if (typeof prior.observedAt === "string" && value.observedAt && Date.parse(prior.observedAt) > Date.parse(value.observedAt)) throw new MarketError("OLDER_OBSERVATION", "An older provider observation was rejected; the newer saved observation is retained.", 409);
   const r = await prisma.backendPlatformEvent.updateMany({ where: { userId: scope.userId, eventKey: eventKey(key), eventType: CACHE, detail: token, status: "Loading" }, data: { status: "Ready", detail: null, metadataJson: JSON.stringify(value) } });
   if (!r.count) throw new MarketError("CACHE_RACE", "The evidence lookup was superseded. Retry to load the newer snapshot.", 409);
  },
  async fail(key, token, error) {
   const row = await prisma.backendPlatformEvent.findUnique({ where: where(key), select: { metadataJson: true } });
   const last = row ? json(row.metadataJson) : {};
   await prisma.backendPlatformEvent.updateMany({ where: { userId: scope.userId, eventKey: eventKey(key), detail: token, status: "Loading" }, data: { status: "Failed", detail: null, metadataJson: JSON.stringify({ ...last, code: error.code, message: error.message, status:error.status, ...(budgetFailure(error.code)?{policySignature:policySignature()}:{}), retryAt: error.retryAt || new Date(Date.now() + (error.retryAfterSeconds || 60) * 1000).toISOString() }) } });
  }
 };
}
function prefKey(scope: StudioScope) { return { userId_eventKey: { userId: scope.userId, eventKey: `pulse-preferences:${scope.firmId}` } }; }
export async function readPreferences(scope: StudioScope) {
 const [row, watch] = await Promise.all([prisma.backendPlatformEvent.findUnique({ where: prefKey(scope), select: { metadataJson: true, updatedAt: true } }), prisma.watchAsset.findMany({ where: { userId: scope.userId }, take: 20, orderBy: { createdAt: "desc" }, select: { ticker: true } })]);
 const suggested = defaultPreferences(watch.map(w => w.ticker));
 let preferences = suggested;
 if (row) { try { preferences = parsePreferences(json(row.metadataJson)); } catch { /* Safely recover an obsolete preference record. */ } }
 return { preferences, revision: row?.updatedAt.toISOString() ?? null, suggestedSymbols: suggested.symbols };
}
export async function savePreferences(scope: StudioScope, preferences: PulsePreferences, revision: string | null) {
 const data = { eventType: "SLICE_PULSE_PREFERENCES_V1", area: "Workspace", title: "Personal market workspace", severity: "Info", status: "Active", sourceType: "WorkspacePreferences", sourceId: scope.firmId, metadataJson: JSON.stringify(preferences) };
 if (revision === null) {
  try { const row = await prisma.backendPlatformEvent.create({ data: { userId: scope.userId, eventKey: `pulse-preferences:${scope.firmId}`, ...data }, select: { updatedAt: true } }); return row.updatedAt.toISOString(); }
  catch { throw new MarketError("PREFERENCE_CONFLICT", "Preferences changed in another tab. Reload before saving again.", 409); }
 }
 if (!Number.isFinite(Date.parse(revision))) throw new MarketError("REVISION", "Invalid preference revision.");
 // A successful same-millisecond write must still invalidate the previous revision.
 const updatedAt = new Date(Math.max(Date.now(), Date.parse(revision) + 1));
 const result = await prisma.backendPlatformEvent.updateMany({ where: { userId: scope.userId, eventKey: `pulse-preferences:${scope.firmId}`, updatedAt: new Date(revision) }, data: { ...data, updatedAt } });
 if (!result.count) throw new MarketError("PREFERENCE_CONFLICT", "Preferences changed in another tab. Reload before saving again.", 409);
 return updatedAt.toISOString();
}
export async function saveMarketHealth(scope: StudioScope, e: MarketEvidence) {
 const health = connectionFromEvidence(e), cfg = marketConfiguration();
 const values = { eventType: "SLICE_PULSE_HEALTH_V1", area: "Market Evidence", title: "Alpha Vantage connection test", severity: "Info", status: health.state, sourceType: "MarketHealth", sourceId: scope.firmId, metadataJson: JSON.stringify({ health, fingerprint: cfg.fingerprint, entitlement: cfg.entitlement }) };
 await prisma.backendPlatformEvent.upsert({ where: { userId_eventKey: { userId: scope.userId, eventKey: `pulse-health:${scope.firmId}` } }, create: { userId: scope.userId, eventKey: `pulse-health:${scope.firmId}`, ...values }, update: values }); return health;
}
export async function readMarketHealth(scope: StudioScope): Promise<MarketConnection> {
 const c = marketConfiguration(), base: MarketConnection = { configured: Boolean(c.key) && c.key.toLowerCase() !== "demo", entitlement: c.entitlement, state: c.key && c.key.toLowerCase() !== "demo" ? "unverified" : "missing", message: c.key && c.key.toLowerCase() !== "demo" ? "Configured; run a quote test to verify endpoint access. Entitlement and observation age are separate." : "A private server market credential is required.", checkedAt: null, observationAt: null, observationState: null };
 if (!base.configured) return base;
 const row = await prisma.backendPlatformEvent.findUnique({ where: { userId_eventKey: { userId: scope.userId, eventKey: `pulse-health:${scope.firmId}` } }, select: { metadataJson: true, updatedAt: true } });
 if (!row || Date.now() - row.updatedAt.getTime() > 300000) return base;
 const p = json(row.metadataJson);
 if (p.fingerprint !== c.fingerprint || p.entitlement !== c.entitlement) return base;
 const h = obj(p.health); if (!["missing", "unverified", "verified", "restricted", "rate-limited", "unavailable"].includes(String(h.state))) return base;
 return { ...base, state: h.state as MarketConnection["state"], message: typeof h.message === "string" ? h.message : base.message, checkedAt: typeof h.checkedAt === "string" ? h.checkedAt : null, observationAt: typeof h.observationAt === "string" ? h.observationAt : null, observationState: ["realtime", "delayed", "end-of-day", "stale", "unavailable"].includes(String(h.observationState)) ? h.observationState as MarketConnection["observationState"] : null };
}

/** Read-only deployment-wide allowance status. No keys, user identities, or provider calls. */
export async function readGatewayBudget(): Promise<GatewayBudget> {
 let policy;try{policy=gatewayPolicy(process.env);}catch(e){throw new MarketError("GATEWAY_CONFIGURATION",e instanceof Error?e.message:"Review gateway configuration.",503);}
 const cfg=marketConfiguration(),now=new Date(),start=new Date(now);start.setUTCHours(0,0,0,0);
 const where={eventType:CALL,sourceType:cfg.fingerprint},minuteWhere={...where,createdAt:{gte:new Date(now.getTime()-60000)}};
 const [minute,day,oldest]=await Promise.all([prisma.backendPlatformEvent.count({where:minuteWhere}),prisma.backendPlatformEvent.count({where:{...where,createdAt:{gte:start}}}),prisma.backendPlatformEvent.findFirst({where:minuteWhere,orderBy:{createdAt:"asc"},select:{createdAt:true}})]);
 return gatewayBudget(policy,{minute,day,oldestMinuteAt:oldest?.createdAt.toISOString()??null},now.getTime());
}
