export function mayRetain(code:string){return ["GATEWAY_MINUTE","GATEWAY_DAY","GATEWAY_BUDGET","PROVIDER_RATE","PROVIDER_HTTP","PROVIDER_NETWORK","MARKET_BUSY","MARKET_BACKOFF"].includes(code);}
export function maximumRetainedAge(endpoint:string):number{
 if(endpoint==="REALTIME_OPTIONS")return 15*60_000;
 if(["GLOBAL_QUOTE","REALTIME_BULK_QUOTES","TIME_SERIES_INTRADAY"].includes(endpoint))return 48*3_600_000;
 if(endpoint==="NEWS_SENTIMENT")return 24*3_600_000;
 return 7*24*3_600_000;
}
