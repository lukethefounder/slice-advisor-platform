import { MarketError, obj, finite, dateOnly, todayNY, freshness, providerFailure } from "./core";
import { isIndex } from "./instruments";
import type { MarketBar, MarketQuote, MarketRange, MarketSeries } from "./contracts";
/** Native index OHLC. Volume is absent in this product and is never replaced with zero. */
export function indexBars(raw: unknown, requested: string, now = Date.now()): MarketBar[] {
 providerFailure(raw);
 if(!isIndex(requested))throw new MarketError("INDEX_IDENTITY","Select an explicit INDEX: identifier.");
 const p=obj(raw),meta=obj(p["Meta Data"] ?? p.metadata);
 const found=String(meta["2. Symbol"] ?? meta.symbol ?? p.symbol ?? "").trim().toUpperCase();
 const expected=requested.slice(6);
 if(found!==expected)throw new MarketError("INDEX_IDENTITY","The returned index identity could not be verified for your selection. No ETF was substituted.",502);
 const rawRows=p["Time Series (Daily)"] ?? p["Time Series (daily)"] ?? p.data;
 const rows=Array.isArray(rawRows)?rawRows.map(item=>{const r=obj(item);return [r.date ?? r.timestamp,r] as const;}):Object.entries(obj(rawRows));
 const bars:MarketBar[]=[],seen=new Set<string>(),cutoff=todayNY(now);
 if(rows.length>100_000)throw new MarketError("INDEX_SIZE","The index response exceeds the accepted row limit.",502);
 for(const [key,value] of rows){
  const at=dateOnly(key); if(!at)throw new MarketError("INDEX_DATE","Index history contains an invalid daily observation date.",502);
  if(at>=cutoff)continue;
  if(seen.has(at))throw new MarketError("INDEX_DUPLICATE","Duplicate index observations were rejected.",502);
  seen.add(at);const r=obj(value),open=finite(r["1. open"]??r.open),high=finite(r["2. high"]??r.high),low=finite(r["3. low"]??r.low),close=finite(r["4. close"]??r.close);
  if(open===null||high===null||low===null||close===null||[open,high,low,close].some(n=>n<=0)||high<Math.max(open,close,low)||low>Math.min(open,close,high))throw new MarketError("INDEX_OHLC","The provider index prices failed OHLC validation.",502);
  bars.push({at,open,high,low,close,volume:null});
 }
 bars.sort((a,b)=>a.at.localeCompare(b.at));
 if(bars.length<2)throw new MarketError("INDEX_HISTORY","Fewer than two completed daily index observations were returned. Verify INDEX_DATA access.",502);
 return bars;
}
export function indexQuote(raw:unknown,requested:string,now=Date.now()):MarketQuote[]{
 const bars=indexBars(raw,requested,now),last=bars.at(-1)!,previous=bars.at(-2)!,change=last.close-previous.close;
 return [{symbol:requested,price:last.close,previousClose:previous.close,change,changePct:change/previous.close*100,volume:null,observedAt:last.at,precision:"date",endpoint:"INDEX_DATA",priceKind:"completed index close",...freshness(last.at,"date","historical",now),note:"Completed daily index close in index points. Not an intraday quote, tradable ETF, or total-return series."}];
}
export function indexSeries(raw:unknown,requested:string,range:MarketRange,now=Date.now()):MarketSeries{
 if(range==="1D")throw new MarketError("INDEX_INTERVAL","Native index data uses daily observations. Choose 1M, 3M, 6M, or 1Y; no intraday price is invented.",422);
 const count={"1M":23,"3M":65,"6M":126,"1Y":252}[range],bars=indexBars(raw,requested,now).slice(-count),last=bars.at(-1)!;
 return {symbol:requested,range,endpoint:"INDEX_DATA",bars,providerTimeZone:"US/Eastern",observedAt:last.at,precision:"date",requestedBars:count,coverage:bars.length<count?"limited":"available",...freshness(last.at,"date","historical",now),note:"Native index points; completed daily OHLC only. Volume, intraday quotes, and ETF returns are not inferred.",basis:"index level; not an investable total return"};
}
