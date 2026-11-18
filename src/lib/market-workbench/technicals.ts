export type TechnicalBar = {at:string;open:number;high:number;low:number;close:number;volume:number|null};
export type TechnicalMetric={label:string;value:number|null;suffix:string;detail:string};
export type TechnicalView={metrics:TechnicalMetric[];macd:Array<{at:string;line:number;signal:number;histogram:number}>;barsUsed:number;warnings:string[];trend:string};
export function ema(values:number[],n:number):Array<number|null>{const out:Array<number|null>=Array(values.length).fill(null);if(values.length<n)return out;let p=values.slice(0,n).reduce((s,x)=>s+x,0)/n;out[n-1]=p;for(let i=n;i<values.length;i++){p+=(values[i]-p)*2/(n+1);out[i]=p;}return out;}
export function wilderRsi(values:number[],n=14):number|null{if(values.length<=n)return null;let up=0,down=0;for(let i=1;i<=n;i++){const d=values[i]-values[i-1];up+=Math.max(d,0);down+=Math.max(-d,0);}up/=n;down/=n;for(let i=n+1;i<values.length;i++){const d=values[i]-values[i-1];up=(up*(n-1)+Math.max(d,0))/n;down=(down*(n-1)+Math.max(-d,0))/n;}return down===0?up===0?50:100:100-100/(1+up/down);}
export function technicalWorkbench(input:TechnicalBar[],intraday=false):TechnicalView{
 const warnings:string[]=[];let rows:TechnicalBar[]=[];
 for(const b of input){if(![b.open,b.high,b.low,b.close].every(v=>Number.isFinite(v)&&v>0)||b.low>b.high||b.low>Math.min(b.open,b.close)||b.high<Math.max(b.open,b.close)){rows=[];warnings.push("Invalid bar resets indicator warmup; no replacement was inferred.");continue;}
 if(rows.length&&b.at<=rows.at(-1)!.at){warnings.push("Unordered or duplicate observations: technicals withheld.");rows=[];break;}
 if(intraday&&rows.length&&Date.parse(b.at)-Date.parse(rows.at(-1)!.at)>300001){rows=[];warnings.push("A missing intraday interval resets indicator warmup.");}rows.push(b);}
 const c=rows.map(b=>b.close),last=rows.at(-1),e12=ema(c,12),e26=ema(c,26),e20=ema(c,20),m=rows.flatMap((b,i)=>e12[i]!==null&&e26[i]!==null?[{at:b.at,line:e12[i]!-e26[i]!}]:[]),signal=ema(m.map(x=>x.line),9),macd=m.flatMap((x,i)=>signal[i]===null?[]:[{...x,signal:signal[i]!,histogram:x.line-signal[i]!}]);
 const avg=(a:number[])=>a.reduce((s,x)=>s+x,0)/a.length,sma=c.length>=50?avg(c.slice(-50)):null;
 const tr=rows.slice(1).map((r,i)=>Math.max(r.high-r.low,Math.abs(r.high-rows[i].close),Math.abs(r.low-rows[i].close)));let atr:number|null=null;if(tr.length>=14){atr=avg(tr.slice(0,14));for(let i=14;i<tr.length;i++)atr=(atr*13+tr[i])/14;}
 const prior=rows.slice(-21,-1),priorHigh=prior.length===20?Math.max(...prior.map(b=>b.high)):null,low=rows.length>=20?Math.min(...rows.slice(-20).map(b=>b.low)):null,high=rows.length>=20?Math.max(...rows.slice(-20).map(b=>b.high)):null;
 const vols=prior.map(b=>b.volume),meanVolume=vols.length===20&&vols.every(v=>v!==null&&v>=0)?avg(vols as number[]):null;
 const volume=rows.length&&rows.every(b=>b.volume!==null&&b.volume>=0)?rows.reduce((s,b)=>s+b.volume!,0):null;
 const vwap=intraday&&volume&&volume>0?rows.reduce((s,b)=>s+(b.high+b.low+b.close)/3*b.volume!,0)/volume:null;
 const latest=macd.at(-1),metric=(label:string,value:number|null|undefined,suffix:string,detail:string):TechnicalMetric=>({label,value:value!==undefined&&value!==null&&Number.isFinite(value)?value:null,suffix,detail});
 if(rows.length<50)warnings.push("Some indicators need more observations. Choose a longer historical range.");
 if(intraday)warnings.push("Periods are five-minute bars, not trading days. VWAP is a bar-derived approximation, not trade-level VWAP.");
 warnings.push("Raw-price technicals can be affected by splits. Indicators are descriptive, not probabilities or automatic orders.");
 return {barsUsed:rows.length,macd,warnings:[...new Set(warnings)],trend:last&&sma!==null?(last.close>sma?"Above SMA 50":last.close<sma?"Below SMA 50":"At SMA 50"):"More history needed",metrics:[
 metric("Wilder RSI 14",wilderRsi(c),"/ 100","Wilder smoothing; this differs from the simple-window RSI used by existing strategy rules."),
 metric("MACD 12 / 26 / 9",latest?.line,"","EMA spread; signal uses nine MACD observations."),metric("MACD histogram",latest?.histogram,"","MACD minus its signal line; positive is not an order."),
 metric("EMA 20",e20.at(-1),"","SMA-seeded exponential moving average."),metric("SMA 50",sma,"","Mean of 50 loaded closing observations."),metric("ATR 14",atr,"","Wilder-smoothed true range in price units."),
 metric("20-bar high",high,"","Maximum loaded high across the last 20 bars."),metric("20-bar low",low,"","Minimum loaded low across the last 20 bars."),metric("Prior-high distance",last&&priorHigh?(last.close/priorHigh-1)*100:null,"%","Last close versus high of 20 preceding bars, excluding the current bar."),
 metric("Relative volume",last?.volume!==null&&last?.volume!==undefined&&meanVolume&&meanVolume>0?last.volume/meanVolume:null,"×","Current volume divided by the preceding 20-bar average."),metric("Session VWAP",vwap,"","Intraday only: typical-price × volume / loaded session volume."),metric("Observed close",last?.close,"","Last loaded close; separate from the quote endpoint timestamp.") ]};
}
