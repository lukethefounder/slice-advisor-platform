/** Descriptive, conditional earnings event study. Not a trading or forecast engine. */
export const EARNINGS_MODEL = "slice-earnings-analogs-1.0.0";
export type PriceBar = { date: string; close: number; split: number };
export type EarningsEvent = { fiscalDate: string; reportedDate: string | null; reportedEPS: number | null; estimatedEPS: number | null; surprisePct: number | null; reportTime: string | null };
export type EarningsAssumptions = { symbol: string; benchmark: string; expectedEPS: number; assumedEPS: number; targetDate: string; tolerancePct: number; lookbackYears: number; marketMovePct: number; sameTrend: boolean; allowDateProxy: boolean };
export type Reaction = { fiscalDate: string; reportedDate: string; basis: "before-open" | "after-close" | "date-only-proxy"; baseDate: string; endDate: string; surprisePct: number; returnPct: number; benchmarkPct: number; excessPct: number; trendPct: number | null; matched: boolean };
export type Horizon = { sessions: number; count: number; ready: boolean; medianReturnPct: number | null; medianExcessPct: number | null; empiricalP10: number | null; empiricalP90: number | null; conditionalReturnPct: number | null; assumedPrice: number | null; records: Reaction[] };
export type EarningsStudy = { model: typeof EARNINGS_MODEL; classification: "conditional-earnings-analogy"; preparedAt: string; asOf: string; assumptions: EarningsAssumptions; assumedSurprisePct: number; reference: { date: string; close: number }; currentTrendPct: number | null; horizons: Horizon[]; exclusions: Array<{ event: string; reason: string }>; warnings: string[] };
export function record(v: unknown): Record<string, unknown> { return v && typeof v === "object" && !Array.isArray(v) ? v as Record<string, unknown> : {}; }
export function isoDate(v: unknown): v is string { if(typeof v!=="string"||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;const t=Date.parse(v+"T00:00:00Z");return Number.isFinite(t)&&new Date(t).toISOString().slice(0,10)===v; }
function number(v: unknown, label: string, min: number, max: number) { if(typeof v!=="number"||!Number.isFinite(v)||v<min||v>max)throw new Error(`${label} must be between ${min} and ${max}.`);return v; }
export function validateAssumptions(value: unknown, today: string): EarningsAssumptions {
 const p=record(value),symbol=String(p.symbol??"").trim().toUpperCase(),benchmark=String(p.benchmark??"").trim().toUpperCase();
 if(!/^[A-Z][A-Z0-9.-]{0,14}$/.test(symbol)||!/^[A-Z][A-Z0-9.-]{0,14}$/.test(benchmark)||symbol===benchmark)throw new Error("Select a stock and a distinct equity/ETF benchmark using exact tickers.");
 if(!isoDate(today)||!isoDate(p.targetDate)||p.targetDate<=today||Date.parse(p.targetDate)-Date.parse(today)>370*86400000)throw new Error("Choose a hypothetical report date after today and within 370 days.");
 const expectedEPS=number(p.expectedEPS,"Expected EPS",-10000,10000);if(Math.abs(expectedEPS)<0.01)throw new Error("Expected EPS too close to zero for a stable percentage-surprise comparison. Use an absolute-EPS analysis outside this model.");
 const years=number(p.lookbackYears,"Lookback years",1,20);if(!Number.isInteger(years))throw new Error("Lookback years must be an integer.");
 if(typeof p.sameTrend!=="boolean"||typeof p.allowDateProxy!=="boolean")throw new Error("Explicitly choose the trend and report-timing policies.");
 return {symbol,benchmark,expectedEPS,assumedEPS:number(p.assumedEPS,"Assumed EPS",-10000,10000),targetDate:p.targetDate,tolerancePct:number(p.tolerancePct,"Surprise tolerance (percentage points)",0,100),lookbackYears:years,marketMovePct:number(p.marketMovePct,"Assumed benchmark move (%)",-50,50),sameTrend:p.sameTrend,allowDateProxy:p.allowDateProxy};
}
export function quantile(values: number[], q: number): number | null { if(!values.length)return null;const a=[...values].sort((x,y)=>x-y),i=(a.length-1)*q,l=Math.floor(i);return a[l]+(a[Math.ceil(i)]-a[l])*(i-l); }
function validateBars(bars: PriceBar[]) { if(!bars.length||bars.length>15000)throw new Error("Import usable bounded daily history first.");let prev="";for(const b of bars){if(!isoDate(b.date)||b.date<=prev||!Number.isFinite(b.close)||b.close<=0||!Number.isFinite(b.split)||b.split<=0)throw new Error("History contains duplicate, unordered, or invalid observations.");prev=b.date;} }
function ratio(bars: PriceBar[], start: number, end: number) { let split=1;for(let j=start+1;j<=end;j++)split*=bars[j].split;const value=(bars[end].close*split/bars[start].close-1)*100;if(!Number.isFinite(value)||value<=-100)throw new Error("The event-return calculation is invalid.");return value; }
export function eventTiming(v: string | null): "before-open"|"after-close"|null { const s=(v??"").toLowerCase().replace(/[ _-]/g,"");return ["premarket","beforemarketopen","beforeopen","bmo"].includes(s)?"before-open":["postmarket","aftermarketclose","afterclose","amc"].includes(s)?"after-close":null; }
export function buildStudy(args:{assumptions:EarningsAssumptions;events:EarningsEvent[];stock:PriceBar[];benchmark:PriceBar[];today:string;preparedAt:string}):EarningsStudy {
 const a=validateAssumptions(args.assumptions,args.today);validateBars(args.stock);validateBars(args.benchmark);
 const stock=args.stock.filter(b=>b.date<args.today),bench=args.benchmark.filter(b=>b.date<args.today);
 if(stock.length<23||bench.length<23)throw new Error("At least 23 completed daily observations are required.");
 const ref=stock.at(-1)!,bm=new Map(bench.map((b,i)=>[b.date,i])),sm=new Map(stock.map((b,i)=>[b.date,i]));
 const currentBi=bm.get(ref.date);if(currentBi===undefined)throw new Error("The latest stock close has no matching benchmark session. Refresh aligned imports.");
 const assumed=(a.assumedEPS-a.expectedEPS)/Math.abs(a.expectedEPS)*100;
 if(!Number.isFinite(assumed)||Math.abs(assumed)>10000)throw new Error("The hypothetical earnings surprise is outside this model's supported range.");
 const lower=new Date(args.today+"T00:00:00Z");lower.setUTCFullYear(lower.getUTCFullYear()-a.lookbackYears);
 const startDate=lower.toISOString().slice(0,10),exclusions:EarningsStudy["exclusions"]=[],seen=new Set<string>();
 const trendAt=(idx:number):number|null=>{const bi=bm.get(stock[idx].date);if(bi===undefined||bi<21)return null;const si=sm.get(bench[bi-21].date);if(si===undefined)return null;for(let x=bi-21;x<=bi;x++)if(!sm.has(bench[x].date))return null;return ratio(stock,si,idx);};
 const currentTrend=trendAt(stock.length-1),horizons:Horizon[]=[1,5,20].map(sessions=>({sessions,count:0,ready:false,medianReturnPct:null,medianExcessPct:null,empiricalP10:null,empiricalP90:null,conditionalReturnPct:null,assumedPrice:null,records:[]}));
 for(const event of args.events.slice(0,200)){
  const reject=(reason:string)=>exclusions.push({event:event.fiscalDate||"unknown quarter",reason});
  if(!isoDate(event.reportedDate)||event.reportedDate<startDate||event.reportedDate>=args.today){reject("Outside the selected completed-event window or missing report date.");continue;}
  if(seen.has(event.reportedDate)){reject("Duplicate report date excluded.");continue;}seen.add(event.reportedDate);
  if(event.estimatedEPS===null||event.reportedEPS===null||!Number.isFinite(event.estimatedEPS)||!Number.isFinite(event.reportedEPS)||Math.abs(event.estimatedEPS)<.01){reject("EPS pair missing or near-zero estimate.");continue;}
  const surprise=(event.reportedEPS-event.estimatedEPS)/Math.abs(event.estimatedEPS)*100;
  const timing=eventTiming(event.reportTime);if(!timing&&!a.allowDateProxy){reject("Exact report timing unavailable; date-only proxy is disabled.");continue;}
  const reportIndex=bm.get(event.reportedDate);let base:number,reaction:number;
  if(timing&&reportIndex!==undefined){reaction=timing==="before-open"?reportIndex:reportIndex+1;base=reaction-1;}
  else if(!timing){reaction=bench.findIndex(b=>b.date>event.reportedDate!);base=(()=>{for(let i=bench.length-1;i>=0;i--)if(bench[i].date<event.reportedDate!)return i;return -1;})();}
  else {reject("Known report time is not aligned to a benchmark trading session.");continue;}
  if(base<0||reaction<0||reaction>=bench.length){reject("Insufficient event-window history.");continue;}
  const baseStock=sm.get(bench[base].date);if(baseStock===undefined){reject("Stock baseline session is missing.");continue;}
  const trend=trendAt(baseStock),match=Math.abs(surprise-assumed)<=a.tolerancePct&&(!a.sameTrend||(trend!==null&&currentTrend!==null&&Math.sign(trend)===Math.sign(currentTrend)));
  for(const h of horizons){const end=reaction+h.sessions-1;if(end>=bench.length||bench[end].date>=args.today)continue;
   let complete=true;for(let k=base;k<=end;k++)if(!sm.has(bench[k].date)){complete=false;break;}if(!complete){reject(`${h.sessions}-session window has missing stock observations.`);continue;}
   // Do not cross another reported event in the selected reaction window.
   if(args.events.some(e=>e.reportedDate&&e.reportedDate>event.reportedDate!&&e.reportedDate<=bench[end].date)){reject(`${h.sessions}-session window overlaps another earnings announcement.`);continue;}
   const r=ratio(stock,baseStock,sm.get(bench[end].date)!),b=ratio(bench,base,end);
   h.records.push({fiscalDate:event.fiscalDate,reportedDate:event.reportedDate,basis:timing??"date-only-proxy",baseDate:bench[base].date,endDate:bench[end].date,surprisePct:surprise,returnPct:r,benchmarkPct:b,excessPct:r-b,trendPct:trend,matched:match});
  }
 }
 for(const h of horizons){const matched=h.records.filter(r=>r.matched);h.count=matched.length;h.ready=h.count>=6;
  if(h.ready){h.medianReturnPct=quantile(matched.map(r=>r.returnPct),.5);h.medianExcessPct=quantile(matched.map(r=>r.excessPct),.5);h.empiricalP10=quantile(matched.map(r=>r.returnPct),.1);h.empiricalP90=quantile(matched.map(r=>r.returnPct),.9);const estimate=h.medianExcessPct!+a.marketMovePct;
   if(estimate>-100&&Number.isFinite(estimate)){h.conditionalReturnPct=estimate;h.assumedPrice=ref.close*(1+estimate/100);} }
 }
 return {model:EARNINGS_MODEL,classification:"conditional-earnings-analogy",preparedAt:args.preparedAt,asOf:args.today,assumptions:a,assumedSurprisePct:assumed,reference:{date:ref.date,close:ref.close},currentTrendPct:currentTrend,horizons,exclusions,warnings:[
  "This is a descriptive same-company event analogy, not a validated earnings forecast, causal model, backtest, or trading instruction.",
  "Only an explicit sample of at least six matching events produces conditional numbers. No automatic tolerance widening or invented events.",
  "P10/P90 describe observed sample dispersion, not a calibrated prediction interval or probability of profit.",
  "Conditional return = median historical stock-minus-benchmark return + your assumed benchmark move. This additive sensitivity assumption is not a fitted market model.",
  "Reference price is the saved completed daily close, not a live quote or forecast of the price immediately before the future report.",
  ...(Date.parse(args.today)-Date.parse(ref.date)>10*86400000?["The reference history is more than 10 calendar days old. Import updated completed history before treating the illustrated price as current context."]:[]),
  "Vendor-current EPS/history may contain revisions; original estimate vintages are not established. Prices are split-normalized within each window; dividends, fees and taxes are excluded.",
  ...(a.allowDateProxy?["Date-only proxies span the close before the report date through sessions after that date and can include pre-announcement trading. They are not exact announcement reactions."]:[]),
  "Recent media and current market evidence are attached as context only. They do not reweight historical events or leak into saved backtests.",
  "The chosen future report date is a user assumption, not a verified earnings-calendar date. Hypothetical EPS values must use a comparable accounting/share basis."
 ]};
}
