"use client";
const pending=new Map<string,Promise<unknown>>();
export async function strategyRead<T>(scope:string,url:string):Promise<T>{
 if(!scope || !url.startsWith("/api/strategy-lab/"))throw new Error("A private strategy scope and local endpoint are required.");
 const key=JSON.stringify([scope,url]);const prior=pending.get(key);if(prior)return prior as Promise<T>;
 const ctrl=new AbortController(), timer=setTimeout(()=>ctrl.abort(),22000);
 const job=(async()=>{const r=await globalThis.fetch(url,{cache:"no-store",credentials:"same-origin",signal:ctrl.signal});const body=await r.json();if(!r.ok)throw new Error(body.message||body.error||"Strategy request failed.");if(body.scope && body.scope!==scope)throw new Error("Private workspace changed. Reload before continuing.");return body as T;})().finally(()=>{clearTimeout(timer);if(pending.get(key)===job)pending.delete(key);});
 pending.set(key,job);return job;
}
