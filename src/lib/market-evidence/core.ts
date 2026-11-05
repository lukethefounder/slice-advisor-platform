import { exactInstrument, isIndex } from "./instruments";
import { parseHomePresentation } from "./home-presentation";
import { parseChartSettings, parseWidgetOrder, ChartSettingsError } from "./chart-settings";
import type { Entitlement, MarketBar, MarketConnection, MarketEvidence, MarketNews, MarketQuote, MarketRange, MarketRequest, MarketSeries, PulsePreferences } from "./contracts";
export class MarketError extends Error { constructor(public code: string, message: string, public status = 422, public retryAfterSeconds?: number, public retryAt?: string) { super(message); this.name = "MarketError"; } }
export function obj(value: unknown): Record<string, unknown> { return value && typeof value === "object" && !Array.isArray(value) ? value as Record<string, unknown> : {}; }
export function finite(value: unknown): number | null { if (value == null || value === "" || typeof value === "boolean") return null; const n = Number(typeof value === "string" ? value.replace(/%$/, "") : value); return Number.isFinite(n) ? n : null; }
export function symbol(value: unknown): string {
 try { return exactInstrument(value); } catch(e) { throw new MarketError("SYMBOL",e instanceof Error?e.message:"Choose an exact instrument."); }
}
export function symbols(value: unknown, maximum = 4): string[] {
 if (!Array.isArray(value) || !value.length || value.length > maximum) throw new MarketError("SYMBOL_COUNT", `Choose 1–${maximum} ticker symbols.`);
 return [...new Set(value.map(symbol))];
}
export function parseMarketRequest(value: unknown): MarketRequest {
 const p = obj(value), list = symbols(p.symbols), range = p.range ?? "3M";
 if (!["1D", "1M", "3M", "6M", "1Y"].includes(String(range))) throw new MarketError("RANGE", "Choose 1D, 1M, 3M, 6M or 1Y.");
 const chartSymbol = p.chartSymbol == null ? undefined : symbol(p.chartSymbol);
 if (chartSymbol && !list.includes(chartSymbol)) throw new MarketError("CHART_SYMBOL", "The chart symbol must be in the selected universe.");
 const comparisonSymbol = p.comparisonSymbol == null || p.comparisonSymbol === "" ? undefined : symbol(p.comparisonSymbol);
 if (comparisonSymbol && (!chartSymbol || comparisonSymbol === chartSymbol || !list.includes(comparisonSymbol))) throw new MarketError("COMPARISON_SYMBOL", "Choose a different comparison from your selected symbols and request a main chart.");
 return { symbols: list, chartSymbol, range: range as MarketRange, news: p.news === true, ...(comparisonSymbol ? { comparisonSymbol } : {}) };
}
export function defaultPreferences(tickers: string[] = []): PulsePreferences {
 const list: string[] = [];
 for (const t of tickers) { try { const s = symbol(t); if (!list.includes(s)) list.push(s); } catch { /* Ignore unsupported watchlist instrument formats. */ } if (list.length === 1) break; }
 if (!list.length) list.push("SPY");
 return { version: 1, symbols: list, primary: list[0], range: "3M", refreshSeconds: 0, motion: true, showNews: false, showResearch: true, showTasks: true, showScenarios: true, focus: "balanced", dailyFocus: "", chart: parseChartSettings(undefined), widgetOrder: parseWidgetOrder(undefined), presentation: parseHomePresentation(undefined) };
}
export function parsePreferences(value: unknown): PulsePreferences {
 const p = obj(value), list = symbols(p.symbols), primary = symbol(p.primary);
 if (!list.includes(primary)) throw new MarketError("PRIMARY", "The main chart symbol must be one of your selected symbols.");
 if (!["1D", "1M", "3M", "6M", "1Y"].includes(String(p.range)) || ![0, 60, 180, 600].includes(Number(p.refreshSeconds))) throw new MarketError("PREFERENCES", "Choose a supported chart range and refresh interval.");
 if (!["balanced", "markets", "clients"].includes(String(p.focus))) throw new MarketError("FOCUS", "Choose a supported workspace focus.");
 if (typeof p.dailyFocus !== "string" || p.dailyFocus.length > 180 || p.dailyFocus.includes("\0")) throw new MarketError("DAILY_FOCUS", "Keep your focus note within 180 characters.");
 for (const key of ["motion", "showNews", "showResearch", "showTasks", "showScenarios"]) if (typeof p[key] !== "boolean") throw new MarketError("PREFERENCES", "Use explicit visibility and motion preferences.");
 let chart, widgetOrder;
 try { chart = parseChartSettings(p.chart === undefined ? undefined : { ...obj(p.chart), compareSymbol: null }, [primary], primary); widgetOrder = parseWidgetOrder(p.widgetOrder); }
 catch (e) { if (e instanceof ChartSettingsError) throw new MarketError("CHART_PREFERENCES", e.message); throw e; }
 let presentation; try { presentation = parseHomePresentation(p.presentation); } catch(e) { throw new MarketError("PRESENTATION", e instanceof Error ? e.message : "Check workspace presentation."); }
 if (isIndex(primary) && p.range === "1D") throw new MarketError("INDEX_INTERVAL", "Native indices use completed daily bars. Choose 1M or longer.");
 return { version: 1, symbols: [primary], primary, chart, widgetOrder, presentation, range: p.range as MarketRange, refreshSeconds: Number(p.refreshSeconds) as PulsePreferences["refreshSeconds"], focus: p.focus as PulsePreferences["focus"], dailyFocus: p.dailyFocus.trim(), motion: p.motion as boolean, showNews: p.showNews as boolean, showResearch: p.showResearch as boolean, showTasks: p.showTasks as boolean, showScenarios: p.showScenarios as boolean };
}
export function providerFailure(value: unknown): void {
 const p = obj(value), msg = [p.Information, p.Note, p["Error Message"], p.message].filter(v => typeof v === "string").join(" ");
 if (!msg) return;
 if (/artificial|illustration|demo.*key|demo purposes/i.test(msg)) throw new MarketError("SAMPLE_REJECTED", "The provider returned demonstration data. No sample value was accepted.", 502);
 if (/rate limit|call frequency|too many requests|exceed(?:ed|s)?[^.]{0,50}(?:limit|quota)|(?:daily|minute) limit|request limit|limit (?:reached|has been)/i.test(msg)) throw new MarketError("PROVIDER_RATE", "Alpha Vantage reports a request limit. No substitute data was generated.", 429);
 if (/premium|entitlement|subscription|subscribe/i.test(msg)) throw new MarketError("ENTITLEMENT", "This Alpha Vantage endpoint requires account access that is not available. Check your subscription and commercial entitlement.", 503);
 if (/api.?key|invalid key|apikey/i.test(msg)) throw new MarketError("PROVIDER_KEY", "Alpha Vantage rejected the server credential. Ask your administrator to verify it.", 503);
 throw new MarketError("PROVIDER_MESSAGE", "Alpha Vantage did not return a usable observation for this request.", 502);
}
export function dateOnly(s: unknown): string | null {
 if (typeof s !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
 const ms = Date.parse(s + "T12:00:00Z"); return Number.isFinite(ms) && new Date(ms).toISOString().slice(0, 10) === s ? s : null;
}
export function todayNY(now = Date.now()): string { return new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit" }).format(now); }
/** Convert a vendor US/Eastern wall time without inventing a current timestamp. DST round-trip required. */
export function easternIso(value: unknown): string | null {
 if (typeof value !== "string") return null;
 const m = /^(\d{4}-\d{2}-\d{2})[ T](\d{2}):(\d{2}):(\d{2})(?:\.(\d{1,3}))?$/.exec(value);
 if (!m || !dateOnly(m[1]) || +m[2] > 23 || +m[3] > 59 || +m[4] > 59) return null;
 const [year, month, day] = m[1].split("-").map(Number), ms = Number((m[5] || "").padEnd(3, "0"));
 const wall = Date.UTC(year, month - 1, day, +m[2], +m[3], +m[4], ms);
 const fmt = new Intl.DateTimeFormat("en-CA", { timeZone: "America/New_York", year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", second: "2-digit", hourCycle: "h23" });
 const candidates = [4, 5].map(h => wall + h * 3600000).filter(t => { const p = fmt.formatToParts(t); const get = (k: string) => p.find(v => v.type === k)?.value; return `${get("year")}-${get("month")}-${get("day")} ${get("hour")}:${get("minute")}:${get("second")}` === value.slice(0, 19).replace("T", " "); });
 return candidates.length === 1 ? new Date(candidates[0]).toISOString() : null;
}
export function freshness(at: string, precision: "date" | "timestamp", entitlement: Entitlement, now = Date.now()): { state: MarketQuote["state"]; note: string } {
 if (precision === "date") {
  if (!dateOnly(at) || at > todayNY(now)) throw new MarketError("FUTURE_DATA", "An invalid or future provider date was rejected.", 502);
  const age = (Date.parse(todayNY(now)) - Date.parse(at)) / 86400000;
  return age > 4 ? { state: "stale", note: "An older date-only provider observation; not live." } : { state: "end-of-day", note: "Provider supplied a trading date, not an intraday timestamp. Real-time freshness cannot be verified." };
 }
 const age = now - Date.parse(at);
 if (!Number.isFinite(age) || age < -60000) throw new MarketError("FUTURE_DATA", "An invalid or future provider timestamp was rejected.", 502);
 if (entitlement === "realtime" && age <= 180000) return { state: "realtime", note: "Recent timestamp from the realtime endpoint. Regular-session and extended-hours fields remain distinct." };
 if (entitlement === "delayed" && age <= 25 * 60000) return { state: "delayed", note: "Delayed entitlement; this observation is not real time." };
 return { state: "stale", note: "Last observed data, possibly from a closed session. No live-market claim is made." };
}
function positive(n: unknown, label: string) { const v = finite(n); if (v === null || v <= 0) throw new MarketError("BAD_PRICE", `Missing or invalid ${label} in provider response.`, 502); return v; }
export function parseQuotes(payload: unknown, requested: string[], entitlement: Entitlement, now = Date.now()): MarketQuote[] {
 providerFailure(payload); const p = obj(payload);
 const bulk = Array.isArray(p.data), rows = bulk ? p.data as unknown[] : [p["Global Quote"]];
 const result: MarketQuote[] = [];
 for (const raw of rows) {
  const r = obj(raw), s = String(bulk ? r.symbol ?? "" : r["01. symbol"] ?? "").toUpperCase();
  if (!requested.includes(s)) continue;
  if (result.some(q => q.symbol === s)) throw new MarketError("DUPLICATE_QUOTE", "Duplicate provider symbols were rejected.", 502);
  const timestamp = bulk ? easternIso(r.timestamp) : dateOnly(r["07. latest trading day"]);
  if (!timestamp) throw new MarketError("QUOTE_TIME", "Provider quote lacks a valid observation time.", 502);
  const regular = positive(bulk ? r.close : r["05. price"], "quote price"), ext = finite(r.extended_hours_quote);
  const previousClose = finite(bulk ? r.previous_close : r["08. previous close"]);
  // Bulk timestamp covers latest extended trading too; retain the actual selected field and basis.
  const localTime = bulk ? String(r.timestamp).slice(11, 16) : "";
  const extended = bulk && (localTime < "09:30" || localTime >= "16:00") && ext !== null && ext > 0;
  const price = extended ? ext! : regular;
  const change = previousClose !== null && previousClose > 0 ? price - previousClose : null;
  result.push({ symbol: s, price, previousClose, change, changePct: change !== null && previousClose ? change / previousClose * 100 : null, volume: finite(bulk ? r.volume : r["06. volume"]), observedAt: timestamp, precision: bulk ? "timestamp" : "date", endpoint: bulk ? "REALTIME_BULK_QUOTES" : "GLOBAL_QUOTE", priceKind: extended ? "extended-hours quote" : "regular-session quote", ...freshness(timestamp, bulk ? "timestamp" : "date", entitlement, now) });
 }
 if (!result.length) throw new MarketError("NO_QUOTES", "No matching quote was returned. Check the ticker and endpoint access.", 502);
 return result;
}
/** Only completed bars are charted. Short histories are labeled, never padded. */
export function parseSeries(payload: unknown, s: string, range: MarketRange, entitlement: Entitlement, now = Date.now()): MarketSeries {
 providerFailure(payload); const p = obj(payload), meta = obj(p["Meta Data"]);
 if (String(meta["2. Symbol"] ?? "").toUpperCase() !== s) throw new MarketError("SERIES_SYMBOL", "Provider history does not match the requested symbol.", 502);
 const intra = range === "1D", tz = String(meta[intra ? "6. Time Zone" : "5. Time Zone"] ?? "");
 if (!["US/Eastern", "America/New_York"].includes(tz)) throw new MarketError("SERIES_VENUE", "This dashboard accepts only US/Eastern equity and ETF history.", 422);
 const source = obj(p[intra ? "Time Series (5min)" : "Time Series (Daily)"]), bars: MarketBar[] = [];
 const seen = new Set<string>();
 for (const [key, raw] of Object.entries(source)) {
  const at = intra ? easternIso(key) : dateOnly(key); if (!at) throw new MarketError("BAR_TIME", "Invalid provider history timestamp.", 502);
  freshness(at, intra ? "timestamp" : "date", entitlement, now);
  // The daily bar for today is excluded even after close; it is accepted on a later date.
  if ((!intra && at === todayNY(now)) || (intra && Date.parse(at) + 300000 > now)) continue;
  if (seen.has(at)) throw new MarketError("BAR_DUPLICATE", "Duplicate provider bar timestamps were rejected.", 502);
  seen.add(at);
  const r = obj(raw), open = positive(r["1. open"], "open"), high = positive(r["2. high"], "high"), low = positive(r["3. low"], "low"), close = positive(r["4. close"], "close"), volume = finite(r["5. volume"]);
  if (high < Math.max(open, close, low) || low > Math.min(open, close, high) || volume === null || volume < 0) throw new MarketError("OHLCV", "Inconsistent provider price or volume data was rejected.", 502);
  bars.push({ at, open, high, low, close, volume });
 }
 bars.sort((a, b) => a.at.localeCompare(b.at));
 if (!bars.length) throw new MarketError("HISTORY_SHORT", "No completed provider observations were returned.", 422);
 const requestedBars = range === "1M" ? 23 : range === "3M" ? 65 : range === "6M" ? 126 : range === "1Y" ? 252 : 0;
 const latestDay = intra ? todayNY(Date.parse(bars[bars.length - 1].at)) : "";
 const selected = intra ? bars.filter(b => todayNY(Date.parse(b.at)) === latestDay) : bars.slice(-requestedBars);
 if (selected.length < 2) throw new MarketError("HISTORY_SHORT", "At least two completed observations are required for the chart.", 422);
 const at = selected[selected.length - 1].at, base = freshness(at, intra ? "timestamp" : "date", entitlement, now);
 const limited = !intra && selected.length < requestedBars;
 return { symbol: s, range, endpoint: intra ? "TIME_SERIES_INTRADAY" : "TIME_SERIES_DAILY", bars: selected, providerTimeZone: tz, observedAt: at, precision: intra ? "timestamp" : "date", requestedBars: intra ? undefined : requestedBars, coverage: limited ? "limited" : "available", state: intra && base.state === "realtime" ? "delayed" : base.state,
  note: (intra ? "Completed five-minute observations from the latest returned session. Not streaming ticks; missing intervals are not filled." : "Completed raw daily OHLCV. Splits and dividends are not adjusted; changes are not total returns.") + (limited ? ` Only ${selected.length} of ${requestedBars} requested daily observations were returned; the displayed dates define actual coverage.` : ""), basis: "raw as-traded; no dividend adjustment" };
}
export function parseNews(payload: unknown, selected: string[], now = Date.now()): MarketNews[] {
 providerFailure(payload); const p = obj(payload);
 if (!Array.isArray(p.feed)) throw new MarketError("NEWS_SHAPE", "The news endpoint did not return a usable feed.", 502);
 const seen = new Set<string>(); const items: MarketNews[] = [];
 for (const item of p.feed) {
  const r = obj(item), t = String(r.time_published || ""), m = /^(\d{4})(\d{2})(\d{2})T(\d{2})(\d{2})(\d{2})$/.exec(t); if (!m || !dateOnly(`${m[1]}-${m[2]}-${m[3]}`) || +m[4] > 23 || +m[5] > 59 || +m[6] > 59) continue;
  const at = `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6]}Z`, age = now - Date.parse(at); if (age < 0 || age > 7 * 86400000) continue;
  let url: URL; try { url = new URL(String(r.url)); } catch { continue; } if (url.protocol !== "https:" || url.username || url.password || seen.has(url.href)) continue;
  const matches = (Array.isArray(r.ticker_sentiment) ? r.ticker_sentiment : []).map(x => String(obj(x).ticker || "")).filter(x => selected.includes(x)); if (!matches.length) continue;
  const title = String(r.title || "").slice(0, 220); if (!title.trim()) continue; seen.add(url.href);
  items.push({ title, summary: String(r.summary || "").slice(0, 600), url: url.href, source: String(r.source || url.hostname).slice(0, 100), publishedAt: at, symbols: matches });
 }
 return items.sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 6);
}
export function evidenceForModel(e: MarketEvidence): string {
 return JSON.stringify({ provider: e.provider, evidenceId: e.evidenceId, preparedAt: e.preparedAt, quotes: e.quotes, chart: e.series ? { symbol: e.series.symbol, range: e.series.range, first: e.series.bars[0], last: e.series.bars.at(-1), note: e.series.note } : null, news: e.news, receipts: e.receipts, issues: e.issues, newsRequested: e.newsRequested, newsRetrieved: e.newsRetrieved, marketIsOpen: null, details: e.details || [], retrievalNote: e.retrievalNote });
}
export function connectionFromEvidence(e: MarketEvidence): MarketConnection {
 const q = e.quotes[0]; const issue = e.issues[0];
 return { configured: true, entitlement: e.entitlement, state: q ? "verified" : issue?.code === "ENTITLEMENT" || issue?.code === "PROVIDER_KEY" ? "restricted" : issue?.code?.includes("RATE") || issue?.code?.includes("BUDGET") || ["GATEWAY_MINUTE","GATEWAY_DAY"].includes(issue?.code||"") ? "rate-limited" : "unavailable", message: q ? `A matching ${q.symbol} quote was returned. Freshness: ${q.state}. This check does not verify every endpoint or commercial licensing.` : issue?.message || "No verified quote was returned.", checkedAt: e.preparedAt, observationAt: q?.observedAt ?? null, observationState: q?.state ?? null };
}
/** Bounded SVG geometry uses observed prices only, never random/synthetic ticks. */
export function chartGeometry(bars: MarketBar[], width = 900, height = 240) {
 if (bars.length < 2) return null;
 const values = bars.map(b => b.close); if (values.some(v => !Number.isFinite(v) || v <= 0)) return null;
 const lo = Math.min(...values), hi = Math.max(...values), pad = Math.max((hi - lo) * .15, hi * .002), min = lo - pad, max = hi + pad;
 const points = bars.map((b, i) => ({ x: 12 + i / (bars.length - 1) * (width - 24), y: 12 + (max - b.close) / (max - min) * (height - 24), ...b }));
 const line = points.map((p, i) => `${i ? "L" : "M"}${p.x.toFixed(2)},${p.y.toFixed(2)}`).join(" ");
 return { points, line, area: `${line} L${points.at(-1)!.x},${height} L${points[0].x},${height} Z`, min, max, changePct: (values.at(-1)! / values[0] - 1) * 100 };
}
