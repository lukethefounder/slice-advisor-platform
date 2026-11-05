/** Explicit identifiers prevent an index from being silently replaced with an ETF. */
export const INDEX_CHOICES = [
 {symbol:"INDEX:SPX",name:"S&P 500 index"}, {symbol:"INDEX:NDX",name:"Nasdaq 100 index"},
 {symbol:"INDEX:DJI",name:"Dow Jones Industrial Average"}, {symbol:"INDEX:COMP",name:"Nasdaq Composite index"},
 {symbol:"INDEX:RUT",name:"Russell 2000 index"}, {symbol:"INDEX:VIX",name:"Cboe Volatility Index"},
] as const;
export function isIndex(value: string) { return value.startsWith("INDEX:"); }
export function instrumentLabel(value: string) { return INDEX_CHOICES.find(x=>x.symbol===value)?.name || value; }
export function exactInstrument(value: unknown): string {
 const s=typeof value==="string"?value.trim().toUpperCase():"";
 if (/^INDEX:[A-Z][A-Z0-9.-]{0,14}$/.test(s) || /^[A-Z][A-Z0-9.-]{0,14}$/.test(s)) return s;
 throw new Error("Enter one exact stock/ETF ticker, or INDEX: followed by the Alpha Vantage index code (for example INDEX:SPX).");
}
