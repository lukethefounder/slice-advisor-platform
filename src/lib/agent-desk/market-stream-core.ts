import { AgentDeskError } from "./contracts";
import type { MarketStreamInput, MarketStreamQuote, MarketStreamView } from "./market-stream-types";

export type SavedMarketStream = { version: 1; revision: number; feed: "iex" | "sip"; status: MarketStreamInput["status"]; checkedAt: string; lastMessageAt: string | null; quotes: Array<Omit<MarketStreamQuote, "ageMs">>; message: string | null };
const object = (value: unknown): value is Record<string, unknown> => Boolean(value) && typeof value === "object" && !Array.isArray(value);
const invalid = () => new AgentDeskError("INVALID_MARKET_STREAM", "The market worker supplied an invalid or unsupported observation.", 400);
function compareObservation(left: string, right: string) {
  const milliseconds = Date.parse(left) - Date.parse(right);
  if (milliseconds !== 0) return milliseconds;
  const remainder = (value: string) => Number((value.match(/\.(\d+)/)?.[1] ?? "").slice(3).padEnd(6, "0").slice(0, 6));
  return remainder(left) - remainder(right);
}

export function validateMarketStreamInput(value: unknown): MarketStreamInput {
  if (!object(value) || Object.keys(value).some(key => !["id", "userId", "firmId", "revision", "feed", "status", "message", "quotes"].includes(key)) ||
      [value.id, value.userId, value.firmId].some(id => typeof id !== "string" || !/^[A-Za-z0-9:_-]{1,160}$/.test(id)) || !Number.isSafeInteger(value.revision) || Number(value.revision) < 0 || !["iex", "sip"].includes(String(value.feed)) || !["connecting", "live", "offline", "error"].includes(String(value.status)) ||
      value.message !== undefined && (typeof value.message !== "string" || value.message.length > 300) || !Array.isArray(value.quotes) || value.quotes.length > 30) throw invalid();
  const symbols = new Set<string>();
  for (const quote of value.quotes) {
    if (!object(quote) || Object.keys(quote).some(key => !["symbol", "bid", "ask", "observedAt", "receivedAt"].includes(key)) || typeof quote.symbol !== "string" || !/^[A-Z][A-Z0-9.-]{0,14}$/.test(quote.symbol) || symbols.has(quote.symbol) || typeof quote.bid !== "number" || typeof quote.ask !== "number" || !Number.isFinite(quote.bid) || !Number.isFinite(quote.ask) || quote.bid <= 0 || quote.ask < quote.bid || quote.ask > 1e8 || typeof quote.observedAt !== "string" || typeof quote.receivedAt !== "string" || !Number.isFinite(Date.parse(quote.observedAt)) || !Number.isFinite(Date.parse(quote.receivedAt))) throw invalid();
    symbols.add(quote.symbol);
  }
  return value as MarketStreamInput;
}

export function mergeMarketStream(previous: SavedMarketStream | null, input: MarketStreamInput, allowedSymbols: string[], now = new Date().toISOString()): SavedMarketStream {
  const currentTime = Date.parse(now), allowed = new Set(allowedSymbols), same = previous?.revision === input.revision && previous.feed === input.feed;
  const quotes = new Map((same ? previous.quotes : []).filter(quote => allowed.has(quote.symbol)).map(quote => [quote.symbol, quote]));
  let lastMessageAt = same ? previous.lastMessageAt : null;
  for (const row of input.quotes) {
    const observed = Date.parse(row.observedAt), received = Date.parse(row.receivedAt);
    // Preserve provider time. A worker receipt is not a new market observation.
    if (!allowed.has(row.symbol) || observed > currentTime + 2_000 || received > currentTime + 2_000 || received < observed - 2_000 || currentTime - received > 60_000 || currentTime - observed > 120_000) throw invalid();
    const prior = quotes.get(row.symbol);
    if (prior && compareObservation(prior.observedAt, row.observedAt) >= 0) continue;
    const mid = (row.bid + row.ask) / 2;
    quotes.set(row.symbol, { ...row, mid, spreadBps: (row.ask - row.bid) / mid * 10_000, transportLagMs: Math.max(0, received - observed) });
    if (!lastMessageAt || received > Date.parse(lastMessageAt)) lastMessageAt = new Date(received).toISOString();
  }
  const message = input.status === "error" ? "The broker market stream is unavailable. Check the connection, feed entitlement and worker." : input.status === "offline" ? "The market worker disconnected; previous quotes retain their original timestamps." : input.status === "connecting" ? "Connecting to the entitled broker market feed." : null;
  return { version: 1, revision: input.revision, feed: input.feed, status: input.status, checkedAt: now, lastMessageAt, quotes: [...quotes.values()].slice(0, 30), message };
}

export function marketStreamView(saved: SavedMarketStream | null, now = new Date().toISOString()): MarketStreamView {
  if (!saved) return { version: 1, status: "offline", feed: null, checkedAt: now, lastMessageAt: null, quotes: [], message: "Connect Alpaca in Settings and keep the beta worker running to receive broker quotes." };
  const current = Date.parse(now), heartbeatAge = current - Date.parse(saved.checkedAt);
  const quotes = saved.quotes.map(row => ({ ...row, ageMs: Math.max(0, current - Date.parse(row.observedAt)) }));
  const isFresh = heartbeatAge <= 20_000 && heartbeatAge >= -2_000 && quotes.some(quote => quote.ageMs <= 5_000);
  const status = heartbeatAge > 20_000 ? "offline" : saved.status === "live" && !isFresh ? "stale" : saved.status;
  return { version: 1, status, feed: saved.feed, checkedAt: now, lastMessageAt: saved.lastMessageAt, quotes,
    message: status === "offline" && saved.status !== "offline" ? "The worker heartbeat is overdue. These are saved observations, not a live feed." : status === "stale" ? "No quote is fresh enough for the live indicator. An open connection does not guarantee current market data." : saved.message };
}
