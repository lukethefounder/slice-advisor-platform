import { exactInstrument, isIndex } from "@/lib/market-evidence/instruments";
import { freshness } from "@/lib/market-evidence/core";
import { ema, technicalWorkbench } from "@/lib/market-workbench/technicals";
import type { MarketRange, MarketReceipt, MarketState } from "@/lib/market-evidence/contracts";
import type { Section, SectionResponse } from "./contracts";

export type BoardMetric = {
  value: number | string | null; display: string;
  status: MarketState | "calculated" | "reference" | "chart";
  source: string; asOf: string | null; detail: string;
};
export type BoardSnapshot = {
  ok: boolean; symbol: string; tvSymbol: string; provider: string; asOf: string | null;
  retrievedAt: string | null; session: string; price: number | null; change: number | null;
  changePct: number | null; volume: number | null; summary: string;
  metrics: Record<string, BoardMetric>; receipts: MarketReceipt[];
};
export const BOARD_METRICS = ["last-price", "change", "change-pct", "open", "high", "low", "volume", "avg-volume", "rsi-14", "macd", "sma-20", "sma-50", "sma-200", "ema-21", "vwap", "atr-14", "beta", "market-cap", "pe-ratio", "eps", "dividend-yield", "52-week-high", "52-week-low", "directional-bias"] as const;
const daily = new Set(["open", "high", "low", "avg-volume", "rsi-14", "macd", "sma-20", "sma-50", "sma-200", "ema-21", "atr-14", "directional-bias"]);
const companyFields: Record<string, string> = { beta: "Beta", "market-cap": "Market capitalization", "pe-ratio": "P/E ratio", eps: "Earnings per share", "dividend-yield": "Dividend yield", "52-week-high": "52-week high", "52-week-low": "52-week low" };

/** Keep the chart's exact instrument; unsupported asset classes never become a guessed equity. */
export function boardInstrument(tvSymbol: string): string {
  const full = tvSymbol.trim().toUpperCase(), [exchange, ticker] = full.split(":");
  const aliases: Record<string, string> = { "SP:SPX": "INDEX:SPX", "NASDAQ:NDX": "INDEX:NDX", "NASDAQ:IXIC": "INDEX:COMP", "DJ:DJI": "INDEX:DJI", "TVC:DJI": "INDEX:DJI", "TVC:VIX": "INDEX:VIX", "CBOE:VIX": "INDEX:VIX", "TVC:RUT": "INDEX:RUT" };
  if (aliases[full]) return aliases[full];
  if (exchange === "INDEX") return exactInstrument(full);
  if (!ticker) return exactInstrument(full);
  if (!["NASDAQ", "NYSE", "AMEX", "NYSEARCA", "ARCA", "BATS"].includes(exchange)) throw new Error("This symbol can be viewed in TradingView. The verified metric rail currently supports US stocks, ETFs and explicitly identified indices.");
  return exactInstrument(ticker);
}
export function boardPlan(symbol: string, selected: string[]): Array<{ section: Section; symbol: string; range: MarketRange }> {
  const ids = [...new Set(selected)].filter(id => (BOARD_METRICS as readonly string[]).includes(id));
  const plan: Array<{ section: Section; symbol: string; range: MarketRange }> = [{ section: "quote", symbol, range: "3M" }];
  if (ids.some(id => daily.has(id))) plan.push({ section: "history", symbol, range: ids.includes("sma-200") ? "1Y" : "3M" });
  if (!isIndex(symbol) && ids.some(id => companyFields[id])) plan.push({ section: "fundamentals", symbol, range: "3M" });
  return plan;
}
const display = (value: number | string | null, percent = false) => value === null || (typeof value === "number" && !Number.isFinite(value)) ? "—" : typeof value === "string" ? value : value.toLocaleString("en-US", { maximumFractionDigits: 2, notation: Math.abs(value) >= 1_000_000 ? "compact" : "standard" }) + (percent ? "%" : "");

/** Prices are parsed provider observations. Technicals are explicit daily calculations, never LLM numbers. */
export function buildBoardSnapshot(symbol: string, tvSymbol: string, selected: string[], sections: SectionResponse[], now = Date.now()): BoardSnapshot {
  const matching = sections.filter(row => row.symbol === symbol);
  const quoteResponse = matching.find(row => row.section === "quote") as SectionResponse<"quote"> | undefined;
  const history = matching.find(row => row.section === "history") as SectionResponse<"history"> | undefined;
  const company = matching.find(row => row.section === "fundamentals") as SectionResponse<"fundamentals"> | undefined;
  const quote = quoteResponse?.data.find(row => row.symbol === symbol), series = history?.data;
  const rows = series?.bars ?? [], last = rows.at(-1), closes = rows.map(row => row.close);
  const technicals = technicalWorkbench(rows), technical = (label: string) => technicals.metrics.find(row => row.label === label)?.value ?? null;
  const average = (size: number) => closes.length >= size ? closes.slice(-size).reduce((sum, value) => sum + value, 0) / size : null;
  const latestReceipt = (row?: SectionResponse) => row?.receipts.map(r => r.retrievedAt).sort().at(-1) ?? null;
  const entitlement = quote?.endpoint === "REALTIME_BULK_QUOTES" ? "realtime" : quote?.state === "delayed" ? "delayed" : "historical";
  const quoteState = quote ? freshness(quote.observedAt, quote.precision, entitlement, now) : null;
  const metric = (value: number | string | null, status: BoardMetric["status"], source: string, asOf: string | null, detail: string, percent = false): BoardMetric => ({ value, display: display(value, percent), status: value === null ? "unavailable" : status, source, asOf, detail });
  const metrics: Record<string, BoardMetric> = {};
  for (const id of new Set(["last-price", "change-pct", ...selected])) {
    if (!(BOARD_METRICS as readonly string[]).includes(id)) continue;
    if (["last-price", "change", "change-pct", "volume"].includes(id)) {
      const value = id === "last-price" ? quote?.price : id === "change" ? quote?.change : id === "change-pct" ? quote?.changePct : quote?.volume;
      metrics[id] = metric(value ?? null, quoteState?.state ?? "unavailable", quote?.endpoint ?? "Alpha Vantage", quote?.observedAt ?? null, quoteState?.note ?? "Waiting for a verified quote.", id === "change-pct");
    } else if (companyFields[id]) {
      const field = company?.data.metrics.find(row => row.label === companyFields[id]);
      metrics[id] = metric(field?.value ?? null, "reference", "Alpha Vantage OVERVIEW · retrieved", latestReceipt(company), "Provider reference snapshot. Retrieval time does not establish a live valuation or a new financial filing.", id === "dividend-yield");
    } else if (id === "vwap") {
      metrics[id] = metric(null, "chart", "TradingView intraday chart", null, "Session VWAP needs intraday bars. It is not estimated from daily history.");
      metrics[id].status = "chart"; metrics[id].display = "Chart";
    } else {
      let value: number | string | null = null;
      if (id === "open" || id === "high" || id === "low") value = last?.[id] ?? null;
      if (id.startsWith("sma-")) value = average(Number(id.slice(4)));
      if (id === "ema-21") value = ema(closes, 21).at(-1) ?? null;
      if (id === "rsi-14") value = technical("Wilder RSI 14");
      if (id === "macd") value = technical("MACD 12 / 26 / 9");
      if (id === "atr-14") value = technical("ATR 14");
      if (id === "directional-bias" && average(50) !== null) value = technicals.trend;
      if (id === "avg-volume" && rows.length >= 20 && rows.slice(-20).every(row => row.volume !== null)) value = rows.slice(-20).reduce((sum, row) => sum + row.volume!, 0) / 20;
      metrics[id] = metric(value, "calculated", "Alpha Vantage · daily bars", last?.at ?? null, id === "directional-bias" ? "Last completed daily close versus SMA 50. Descriptive trend, not a forecast or investment instruction." : "Calculated from completed raw daily observations, not the live chart interval. Splits and dividends are not adjusted; insufficient warmup stays unavailable.");
    }
  }
  const receipts = matching.flatMap(row => row.receipts), retained = receipts.some(row => row.cacheState === "retained");
  return { ok: Boolean(quote || rows.length || company), symbol, tvSymbol, provider: "Alpha Vantage", asOf: quote?.observedAt ?? last?.at ?? null,
    retrievedAt: latestReceipt(quoteResponse), session: quoteState?.state ?? (rows.length ? "end-of-day" : "unavailable"), price: quote?.price ?? null, change: quote?.change ?? null, changePct: quote?.changePct ?? null, volume: quote?.volume ?? null, metrics, receipts,
    summary: retained ? "Retained observations are visible while the provider recovers. Their original timestamps are preserved." : quote ? quoteState!.note : "Quote and historical sections load independently. Missing observations are not estimated." };
}
