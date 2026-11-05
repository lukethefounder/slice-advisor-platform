/** Seconds/date Retry-After handling shared by diagnostics and tests. */
export function retrySeconds(value:string|null, now=Date.now(), fallback=60):number{
 if(!value)return fallback;const n=Number(value);if(Number.isFinite(n)&&n>=0)return Math.max(1,Math.min(86400,Math.ceil(n)));
 const ms=Date.parse(value);return Number.isFinite(ms)?Math.max(1,Math.min(86400,Math.ceil((ms-now)/1000))):fallback;
}
