"use client";

import { startApplicationDeadline } from "@/lib/research/beta-client";
export async function decisionJson<T>(url:string,init:RequestInit={},timeoutMs=40000):Promise<T>{
 const controller=new AbortController();const parent=init.signal;
 const abort=()=>controller.abort(parent?.reason);if(parent?.aborted)abort();else parent?.addEventListener("abort",abort,{once:true});
 const timer=startApplicationDeadline(controller, timeoutMs, "The request timed out. Check saved records before retrying a write.");
 try{const response=await globalThis.fetch(url,{credentials:"same-origin",cache:"no-store",...init,signal:controller.signal,headers:{...(init.body?{"Content-Type":"application/json"}:{}),...init.headers}});
  const body=await response.json().catch(()=>({}));
  if(!response.ok)throw new Error(typeof body.message==="string"?body.message:typeof body.error==="string"?body.error:`Request failed (${response.status}).`);
  return body as T;
 }finally{clearTimeout(timer);parent?.removeEventListener("abort",abort);}
}
export function downloadText(name:string,value:string,type="application/json"){const url=URL.createObjectURL(new Blob([value],{type}));const a=document.createElement("a");a.href=url;a.download=name;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);}
export const money=(v:number|null|undefined)=>v==null||!Number.isFinite(v)?"Not available":new Intl.NumberFormat("en-US",{style:"currency",currency:"USD",maximumFractionDigits:2}).format(v);
export const pct=(v:number|null|undefined)=>v==null||!Number.isFinite(v)?"Not available":`${v.toFixed(2)}%`;
export function when(v:string|null|undefined){if(!v)return "Not recorded";if(/^\d{4}-\d{2}-\d{2}$/.test(v))return v;const n=Date.parse(v);return Number.isFinite(n)?new Date(n).toISOString().replace("T"," ").replace(/\.\d{3}Z$/," UTC"):"Invalid date";}
