import { MarketError, obj, parseNews } from "@/lib/market-evidence/core";
import type { InsiderEvidence, InsiderRow, InstitutionalEvidence, NewsEvidence } from "./contracts";
const finite=(v:unknown):number|null=>{if(v==null||typeof v==="boolean"||typeof v==="object"||String(v).trim()==="")return null;const n=Number(v);return Number.isFinite(n)?n:null;};
const text=(v:unknown,max=200)=>typeof v==="string"?v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g,"").slice(0,max):"";
const day=(v:unknown)=>typeof v==="string"&&/^\d{4}-\d{2}-\d{2}$/.test(v)&&Number.isFinite(Date.parse(v+"T00:00:00Z"))&&new Date(v+"T00:00:00Z").toISOString().slice(0,10)===v?v:null;
const CODE:Record<string,string>={P:"Open-market or private purchase",S:"Open-market or private sale",A:"Grant, award or other acquisition",F:"Exercise-price or tax payment",M:"Exercise or conversion",G:"Gift",I:"Discretionary plan transaction",J:"Other reported transaction",D:"Disposal; mechanism not established"};
export function parseInsiders(raw:unknown,symbol:string,now=Date.now()):InsiderEvidence{
 const value=obj(raw);if(!Array.isArray(value.data))throw new MarketError("ACTIVITY_FORMAT","The insider endpoint did not return the expected record array.",502);
 if(value.data.length>30000)throw new MarketError("ACTIVITY_SIZE","The insider response exceeded the record limit.",502);
 const seen=new Set<string>(),rows:InsiderRow[]=[];
 for(const item of value.data){const r=obj(item),date=day(r.transaction_date),ticker=text(r.ticker||r.symbol).toUpperCase();
  if(ticker&&ticker!==symbol)continue;
  if(!date||!ticker||Date.parse(date+"T00:00:00Z")>now||now-Date.parse(date+"T00:00:00Z")>90*86400000)continue;
  const person=text(r.executive),code=text(r.acquisition_or_disposal,12).toUpperCase();if(!person)continue;
  const n=finite(r.shares),p=finite(r.share_price),shares=n!==null&&n>=0?n:null,price=p!==null&&p>=0?p:null;
  const filing=day(r.filing_date),filingDate=filing&&Date.parse(filing+"T00:00:00Z")<=now?filing:null;
  const row:InsiderRow={date,filingDate,symbol,person,title:text(r.executive_title),security:text(r.security_type),code,label:CODE[code]||"Unclassified disclosure",shares,price,disclosedValue:shares!==null&&price!==null&&Number.isFinite(shares*price)?shares*price:null};
  const key=JSON.stringify(row);if(!seen.has(key)){seen.add(key);rows.push(row);}
 }
 rows.sort((a,b)=>b.date.localeCompare(a.date));return {rows:rows.slice(0,150),received:value.data.length,omitted:value.data.length-Math.min(150,rows.length),note:"Latest returned records with a transaction date in the last 90 days, limited to 150. P/S codes describe open-market OR private trades; A/M/F are not inferred discretionary buys or sells. Transaction date is not a publication date. Dollar value is shares × reported price, not verified cash flow. Missing filing times remain unknown."};
}
export function parseNewsEvidence(raw:unknown,symbol:string,now=Date.now()):NewsEvidence{
 const headlines=parseNews(raw,[symbol],now),feed=obj(raw).feed;
 const source=Array.isArray(feed)?feed:[],seen=new Set<string>();
 const rows=headlines.flatMap(h=>{
  const titleKey=h.title.trim().toLowerCase().replace(/\s+/g," ");if(seen.has(titleKey))return [];seen.add(titleKey);
  const record=source.map(obj).find(x=>x.url===h.url),tickers=Array.isArray(record?.ticker_sentiment)?record.ticker_sentiment.map(obj):[];
  const match=tickers.find(x=>x.ticker===symbol),score=finite(match?.ticker_sentiment_score),rel=finite(match?.relevance_score);
  return [{...h,sentiment:score!==null&&score>=-1&&score<=1?score:null,relevance:rel!==null&&rel>=0&&rel<=1?rel:null}];
 }).slice(0,40);
 const scored=rows.filter(r=>r.sentiment!==null&&r.relevance!==null&&r.relevance>0),weight=scored.reduce((n,r)=>n+r.relevance!,0);
 return {rows,weightedScore:weight?scored.reduce((n,r)=>n+r.sentiment!*r.relevance!,0)/weight:null,scoredCount:scored.length,note:"Ticker-relevance-weighted sentiment over the returned deduplicated seven-day news sample. Not a measure of all public opinion, a probability, or a historically available signal. Syndicated stories may remain correlated."};
}
export function parseInstitutional(raw:unknown,symbol:string):InstitutionalEvidence{
 const record=obj(raw);if(!Object.keys(record).length)throw new MarketError("HOLDINGS_FORMAT","Institutional disclosure response is empty.",502);
 const echo=text(record.symbol||record.ticker).toUpperCase();if(echo&&echo!==symbol)throw new MarketError("SYMBOL_MISMATCH","Institutional response did not match the requested instrument.",502);
 if(!Object.values(record).some(v=>Array.isArray(v)||v&&typeof v==="object"))throw new MarketError("HOLDINGS_FORMAT","No structured institutional disclosures were returned.",502);
 const fields:Array<{field:string;value:string}>=[];let truncated=false;
 function walk(value:unknown,key:string,depth:number){if(fields.length>=160||depth>5){truncated=true;return;}if(/apikey|api_key|token|secret|password/i.test(key))return;
  if(value===null||typeof value==="string"||typeof value==="number"||typeof value==="boolean"){if(typeof value==="number"&&!Number.isFinite(value))return;fields.push({field:key.slice(0,180),value:value===null?"Not supplied":text(String(value),600)});return;}
  if(Array.isArray(value)){value.slice(0,20).forEach((v,i)=>walk(v,`${key}[${i}]`,depth+1));if(value.length>20)truncated=true;return;}
  if(value&&typeof value==="object")for(const[k,v]of Object.entries(value))walk(v,key?`${key}.${k}`:k,depth+1);
 }
 walk(record,"",0);if(!fields.length)throw new MarketError("HOLDINGS_FORMAT","No inspectable disclosure fields were returned.",502);
 return {fields,truncated,note:"Provider institutional-holdings fields shown as supplied. These are reported positions, not verified transactions at the filing time. Units, report periods and filing dates must be read from the returned fields. No purchase/sale or real-time flow is inferred. Expandable view is bounded; this adapter is not a normalized institutional transaction feed."};
}
