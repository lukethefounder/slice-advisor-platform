"use client";
export async function researchRequest<T>(url:string,body:unknown,signal:AbortSignal):Promise<T>{
 const r=await fetch(url,{method:"POST",credentials:"same-origin",cache:"no-store",headers:{"Content-Type":"application/json"},body:JSON.stringify(body),signal});
 const p=await r.json().catch(()=>({}));if(!r.ok||p.ok===false){const m=typeof p.error==="string"?p.error:typeof p.error?.message==="string"?p.error.message:typeof p.message==="string"?p.message:`Research request failed (HTTP ${r.status}).`;const retry=r.headers.get("retry-after");throw Error(m+(retry?` Retry after ${retry} seconds.`:""));}return p as T;
}
