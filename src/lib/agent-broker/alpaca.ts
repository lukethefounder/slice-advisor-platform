import "server-only";
import { AgentBrokerError, type BrokerAccount, type BrokerClock, type BrokerFeed, type BrokerMode, type BrokerOrder, type BrokerPosition } from "./contracts";
import type { BrokerCredentials } from "./crypto";
import { isSymbol, isoDate, object } from "./validation";

export const ALPACA_ORIGINS = { paper: "https://paper-api.alpaca.markets", live: "https://api.alpaca.markets", data: "https://data.alpaca.markets" } as const;
const MAX_BODY = 2 * 1024 * 1024;
const responseError = () => new AgentBrokerError("BROKER_RESPONSE_INVALID", "The broker returned incomplete or invalid data. Trading is blocked until a valid refresh succeeds.", 502);
function record(value: unknown): Record<string, unknown> { if (!object(value)) throw responseError(); return value; }
function string(value: unknown, max = 128): string { if (typeof value !== "string" || !value.length || value.length > max || /[\u0000-\u001f]/.test(value)) throw responseError(); return value; }
function identifier(value: unknown): string { const parsed = string(value); if (!/^[A-Za-z0-9_-]+$/.test(parsed)) throw responseError(); return parsed; }
function symbol(value: unknown): string { if (!isSymbol(value)) throw responseError(); return value; }
function number(value: unknown, min = -1e15): number {
  if (typeof value !== "number" && !(typeof value === "string" && /^-?\d{1,18}(\.\d{1,12})?$/.test(value))) throw responseError();
  const parsed = Number(value); if (!Number.isFinite(parsed) || parsed < min || Math.abs(parsed) > 1e15) throw responseError(); return parsed;
}
function bool(value: unknown): boolean { if (typeof value !== "boolean") throw responseError(); return value; }
const nullableDate = (value: unknown) => value == null ? null : isoDate(value);
const nullableNumber = (value: unknown) => value == null ? null : number(value, 0);
export function parseAccount(value: unknown): BrokerAccount {
  const row = record(value); const accountNumber = string(row.account_number, 64);
  return { id: identifier(row.id), numberMasked: `••••${accountNumber.slice(-4)}`, status: string(row.status, 40), currency: string(row.currency, 8),
    cash: number(row.cash), equity: number(row.equity), lastEquity: number(row.last_equity), buyingPower: number(row.buying_power),
    nonMarginableBuyingPower: number(row.non_marginable_buying_power), tradingBlocked: bool(row.trading_blocked), accountBlocked: bool(row.account_blocked),
    tradeSuspended: bool(row.trade_suspended_by_user), patternDayTrader: bool(row.pattern_day_trader), dayTradeCount: number(row.daytrade_count, 0) };
}
export function parsePosition(value: unknown): BrokerPosition {
  const row = record(value); if (row.side !== "long" && row.side !== "short") throw responseError();
  return { symbol: symbol(row.symbol), quantity: number(row.qty), availableQuantity: number(row.qty_available), side: row.side,
    averageEntryPrice: number(row.avg_entry_price, 0), currentPrice: number(row.current_price, 0), marketValue: number(row.market_value), unrealizedPnl: number(row.unrealized_pl) };
}
export function parseOrder(value: unknown, depth = 0): BrokerOrder {
  const row = record(value);
  if (depth > 2 || !["buy", "sell"].includes(String(row.side)) || (row.legs != null && (!Array.isArray(row.legs) || row.legs.length > 4))) throw responseError();
  const quantity = number(row.qty, 0), filledQuantity = number(row.filled_qty, 0);
  if (filledQuantity > quantity) throw responseError();
  return { id: identifier(row.id), clientOrderId: string(row.client_order_id), symbol: symbol(row.symbol), side: row.side as "buy" | "sell",
    type: string(row.type, 32), orderClass: row.order_class === "" ? "simple" : string(row.order_class, 32), status: string(row.status, 48),
    quantity, filledQuantity, filledAveragePrice: nullableNumber(row.filled_avg_price), submittedAt: nullableDate(row.submitted_at),
    filledAt: nullableDate(row.filled_at), updatedAt: nullableDate(row.updated_at), limitPrice: nullableNumber(row.limit_price), stopPrice: nullableNumber(row.stop_price),
    legs: Array.isArray(row.legs) ? row.legs.map(leg => parseOrder(leg, depth + 1)) : [] };
}
export function parseClock(value: unknown): BrokerClock {
  const row = record(value); return { timestamp: isoDate(row.timestamp), isOpen: bool(row.is_open), nextOpen: isoDate(row.next_open), nextClose: isoDate(row.next_close) };
}
export type BrokerQuote = { symbol: string; bid: number; ask: number; timestamp: string; feed: BrokerFeed };
export type BrokerAsset = { symbol: string; tradable: boolean; status: string; assetClass: string; exchange: string };
export type AlpacaOrderInput = {
  symbol: string; qty: string; side: "buy" | "sell"; type: "limit" | "market";
  time_in_force: "day"; client_order_id: string; extended_hours: false;
  position_intent: "buy_to_open" | "sell_to_close";
  order_class: "bracket" | "simple"; limit_price?: string;
  take_profit?: { limit_price: string }; stop_loss?: { stop_price: string };
};
export class AlpacaHttpError extends AgentBrokerError {
  constructor(public providerStatus: number) {
    super(providerStatus === 401 || providerStatus === 403 ? "BROKER_ACCESS_DENIED" : providerStatus === 429 ? "BROKER_RATE_LIMIT" : "BROKER_REQUEST_FAILED",
      providerStatus === 401 || providerStatus === 403 ? "Alpaca rejected these credentials or the requested data entitlement. Verify the selected paper/live environment and subscription."
        : providerStatus === 429 ? "Alpaca's request limit was reached. The worker will back off; new orders remain blocked."
          : "Alpaca did not accept the request. Reconcile the recorded order before attempting another trade.", providerStatus === 401 || providerStatus === 403 ? 422 : 502);
  }
}
/** Personal-account adapter: no arbitrary URLs, transfers, short sales, or model-supplied order bodies. */
export class AlpacaClient {
  constructor(private mode: BrokerMode, private credentials: BrokerCredentials, private transport: typeof fetch = fetch) {
    if (!(mode === "paper" || mode === "live")) throw responseError();
  }
  private async request(path: string, method: "GET" | "POST" | "DELETE" = "GET", body?: AlpacaOrderInput, data = false): Promise<unknown> {
    const origin = data ? ALPACA_ORIGINS.data : ALPACA_ORIGINS[this.mode];
    if (!path.startsWith("/v2/") || path.includes("\\") || path.includes("..") || (data && method !== "GET")) throw responseError();
    const url = new URL(path, origin); if (url.origin !== origin) throw responseError();
    try {
      const response = await this.transport(url, { method, headers: { "APCA-API-KEY-ID": this.credentials.key, "APCA-API-SECRET-KEY": this.credentials.secret, Accept: "application/json", ...(body ? { "Content-Type": "application/json" } : {}) },
        ...(body ? { body: JSON.stringify(body) } : {}), signal: AbortSignal.timeout(12_000), cache: "no-store", redirect: "error" });
      if (!response.ok) { await response.body?.cancel(); throw new AlpacaHttpError(response.status); }
      if (response.status === 204) { await response.body?.cancel(); return null; }
      if (!response.body || Number(response.headers.get("content-length") || 0) > MAX_BODY) { await response.body?.cancel(); throw responseError(); }
      const reader = response.body.getReader(); const chunks: Uint8Array[] = []; let length = 0;
      try {
        for (;;) { const { done, value } = await reader.read(); if (done) break; length += value.byteLength; if (length > MAX_BODY) throw responseError(); chunks.push(value); }
      } finally { await reader.cancel().catch(() => undefined); }
      return JSON.parse(Buffer.concat(chunks).toString("utf8"));
    } catch (error) {
      if (error instanceof AgentBrokerError) throw error;
      throw new AgentBrokerError("BROKER_TRANSPORT_UNCERTAIN", "The broker request could not be confirmed. Submitted order intents remain locked until reconciliation confirms the broker's result.", 502);
    }
  }
  async account() { return parseAccount(await this.request("/v2/account")); }
  async positions() {
    const rows = await this.request("/v2/positions"); if (!Array.isArray(rows) || rows.length > 500) throw responseError(); return rows.map(parsePosition);
  }
  async openOrders() {
    const rows = await this.request("/v2/orders?status=open&nested=true&limit=100");
    // A full page could hide additional exposure; fail closed rather than trade against a truncated book.
    if (!Array.isArray(rows) || rows.length >= 100) throw responseError(); return rows.map(row => parseOrder(row));
  }
  async clock() { return parseClock(await this.request("/v2/clock")); }
  async quote(ticker: string, feed: BrokerFeed): Promise<BrokerQuote> {
    symbol(ticker); if (feed !== "iex" && feed !== "sip") throw responseError();
    const row = record(await this.request(`/v2/stocks/${encodeURIComponent(ticker)}/quotes/latest?feed=${feed}`, "GET", undefined, true));
    if (row.symbol !== ticker) throw responseError(); const quote = record(row.quote);
    return { symbol: ticker, bid: number(quote.bp, 0), ask: number(quote.ap, 0), timestamp: isoDate(quote.t), feed };
  }
  async asset(ticker: string): Promise<BrokerAsset> {
    symbol(ticker); const row = record(await this.request(`/v2/assets/${encodeURIComponent(ticker)}`));
    return { symbol: symbol(row.symbol), tradable: bool(row.tradable), status: string(row.status), assetClass: string(row.class), exchange: string(row.exchange) };
  }
  async orderByClientId(clientId: string): Promise<BrokerOrder | null> {
    identifier(clientId);
    try { return parseOrder(await this.request(`/v2/orders:by_client_order_id?client_order_id=${encodeURIComponent(clientId)}`)); }
    catch (error) { if (error instanceof AlpacaHttpError && error.providerStatus === 404) return null; throw error; }
  }
  async order(id: string): Promise<BrokerOrder> { identifier(id); return parseOrder(await this.request(`/v2/orders/${encodeURIComponent(id)}?nested=true`)); }
  async submit(input: AlpacaOrderInput): Promise<BrokerOrder> {
    if (this.mode === "live" && process.env.SLICE_BROKER_LIVE_ENABLED !== "true") throw new AgentBrokerError("BROKER_LIVE_DISABLED", "Live brokerage execution is disabled on the server.");
    symbol(input.symbol); identifier(input.client_order_id);
    const keys = ["symbol", "qty", "side", "type", "time_in_force", "client_order_id", "extended_hours", "position_intent", "order_class", "limit_price", "take_profit", "stop_loss"];
    const price = (value: unknown) => typeof value === "string" && /^\d{1,7}\.\d{2}$/.test(value) && Number(value) > 0;
    if (!/^\d{1,7}$/.test(input.qty) || Number(input.qty) < 1 || input.extended_hours !== false || input.time_in_force !== "day"
      || Object.keys(input).some(key => !keys.includes(key))
      || (input.side === "buy" ? input.position_intent !== "buy_to_open" || input.order_class !== "bracket" || input.type !== "limit" || !input.take_profit || !input.stop_loss
        || !price(input.limit_price) || !price(input.take_profit.limit_price) || !price(input.stop_loss.stop_price)
        || Object.keys(input.take_profit).length !== 1 || Object.keys(input.stop_loss).length !== 1
        || Number(input.stop_loss.stop_price) >= Number(input.limit_price) || Number(input.take_profit.limit_price) <= Number(input.limit_price)
        : input.side !== "sell" || input.position_intent !== "sell_to_close" || input.order_class !== "simple" || input.type !== "market" || input.limit_price !== undefined || input.take_profit !== undefined || input.stop_loss !== undefined)) throw responseError();
    return parseOrder(await this.request("/v2/orders", "POST", input));
  }
  async cancel(id: string): Promise<void> {
    if (this.mode === "live" && process.env.SLICE_BROKER_LIVE_ENABLED !== "true") throw new AgentBrokerError("BROKER_LIVE_DISABLED", "Live brokerage execution is disabled on the server. Existing broker orders remain unchanged.");
    identifier(id); await this.request(`/v2/orders/${encodeURIComponent(id)}`, "DELETE");
  }
}
