import "server-only";
import { createHash, randomUUID } from "node:crypto";
import { FlightPool, FlightCapacityError, subscribe } from "@/lib/performance/singleflight";
import { MarketError, providerFailure } from "./core";
import type { MarketReceipt } from "./contracts";
import type { CacheValue, MarketStorage } from "./provider";

type Configuration = { key: string; fingerprint: string };
type Delivery = { record: CacheValue; cached: boolean };
const pool = new FlightPool<Delivery>(3, 48);
const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));
export function requestKey(endpoint: string, params: Record<string, string>, fingerprint: string) {
  return createHash("sha256").update(JSON.stringify({ endpoint, params: Object.fromEntries(Object.entries(params).sort(([a], [b]) => a.localeCompare(b))), credential: fingerprint })).digest("hex");
}
export function safeMarketError(error: unknown) {
  if (error instanceof MarketError) return error;
  if (error instanceof FlightCapacityError) return new MarketError("MARKET_BUSY", error.message, 429);
  return new MarketError("PROVIDER_NETWORK", "The market-data request timed out or could not connect. No placeholder observations were generated.", 503);
}
async function readBounded(response: Response, limit = 4_000_000) {
  const length = Number(response.headers.get("content-length"));
  if (Number.isFinite(length) && length > limit) throw new MarketError("PAYLOAD_SIZE", "The provider response exceeded the safe size limit.", 502);
  if (!response.body) throw new MarketError("PAYLOAD_EMPTY", "The provider response was empty.", 502);
  const reader = response.body.getReader(), parts: Uint8Array[] = []; let size = 0;
  try {
    while (true) {
      const chunk = await reader.read(); if (chunk.done) break;
      size += chunk.value.byteLength;
      if (size > limit) { await reader.cancel(); throw new MarketError("PAYLOAD_SIZE", "The provider response exceeded the safe size limit.", 502); }
      parts.push(chunk.value);
    }
  } finally { reader.releaseLock(); }
  const bytes = new Uint8Array(size); let offset = 0;
  for (const part of parts) { bytes.set(part, offset); offset += part.length; }
  return new TextDecoder().decode(bytes);
}
/** A shared, fixed-host transport for Workspace, AI evidence and Market Visuals.
 * It retains the database quota/lease checks. No provider key or URL reaches a client.
 * Requests are coalesced only within the same explicit user+firm cache namespace.
 */
export function createMarketReader(config: Configuration, storage: MarketStorage, signal: AbortSignal, receipts: MarketReceipt[], force = false) {
  if (!config.key || config.key.toLowerCase() === "demo") throw new MarketError("MARKET_KEY_MISSING", "Configure a private Alpha Vantage server credential. Demonstration keys are not accepted.", 503);
  return async function call<T>(endpoint: string, params: Record<string, string>, ttl: number, parse: (raw: unknown) => T): Promise<T> {
    signal.throwIfAborted();
    const key = requestKey(endpoint, params, config.fingerprint);
    const fromDatabase = force ? null : await storage.cached(key, ttl);
    if (fromDatabase) {
      const result = parse(fromDatabase.value);
      receipts.push({ endpoint, symbols: (params.symbol || params.tickers || "").split(",").filter(Boolean), retrievedAt: fromDatabase.retrievedAt, cacheHit: true, sha256: fromDatabase.sha256, cacheAgeMs: Math.max(0, Date.now() - Date.parse(fromDatabase.retrievedAt)), cacheState: fromDatabase.retained ? "retained" : Date.now() - Date.parse(fromDatabase.retrievedAt) >= ttl ? "stale" : "fresh" });
      return result;
    }
    // Storage without a verified namespace is deliberately NOT shared across requests.
    const flightKey = `${storage.cacheNamespace ?? randomUUID()}:${key}:${force ? "forced" : "ordinary"}`;
    const joined = pool.has(flightKey), queuedAt = Date.now();
    const job = pool.run(flightKey, async () => {
      if (Date.now() - queuedAt > 15000) throw new MarketError("MARKET_BUSY", "The market queue is busy. Retry shortly.", 429);
      // Work may have spent time queued, so recheck before paying for a provider call.
      const found = force ? null : await storage.cached(key, ttl);
      if (found) return { record: found, cached: true };
      let token: string;
      try { token = await storage.claim(key); }
      catch (e) {
        if (!force && e instanceof MarketError && e.code === "MARKET_BUSY") {
          // Another server instance may own the lease; short bounded wait, not a retry storm.
          for (let n = 0; n < 5; n++) { await wait(180); const ready = await storage.cached(key, ttl); if (ready) return { record: ready, cached: true }; }
        }
        throw e;
      }
      try {
        for (let retry = 0; ; retry++) {
          try { await storage.reserve(); break; }
          catch (e) { if (!(e instanceof MarketError) || e.code !== "MARKET_BUSY" || retry >= 3) throw e; await wait(80 * (retry + 1)); }
        }
        const url = new URL("https://www.alphavantage.co/query");
        url.searchParams.set("function", endpoint); url.searchParams.set("apikey", config.key);
        for (const [name, value] of Object.entries(params)) if (value) url.searchParams.set(name, value);
        // Subscriber cancellation does not abort another caller's identical lookup.
        // This request has its own hard timeout and is never an unbounded background job.
        const response = await fetch(url, { signal: AbortSignal.timeout(12_000), cache: "no-store", redirect: "error", headers: { Accept: "application/json" } });
        if (!response.ok) throw new MarketError(response.status === 429 ? "PROVIDER_RATE" : "PROVIDER_HTTP", response.status === 429 ? "Alpha Vantage rate limit reached." : `Market provider returned HTTP ${response.status}.`, response.status === 429 ? 429 : 502);
        const raw = await readBounded(response);
        let value: unknown; try { value = JSON.parse(raw); } catch { throw new MarketError("PAYLOAD_JSON", "The market provider did not return JSON data.", 502); }
        providerFailure(value); const validated = parse(value); // Validate before persisting raw evidence.
        const values = Array.isArray(validated) ? validated : [validated];
        const observed = values.flatMap(item => item && typeof item === "object" && "observedAt" in item && typeof item.observedAt === "string" && Number.isFinite(Date.parse(item.observedAt)) ? [item.observedAt] : []).sort();
        const record: CacheValue = { value, retrievedAt: new Date().toISOString(), sha256: createHash("sha256").update(raw).digest("hex"), ...(observed.length ? { observedAt: observed.at(-1) } : {}) };
        await storage.save(key, token, record);
        return { record, cached: false };
      } catch (e) { const error = safeMarketError(e); await storage.fail(key, token, error).catch(() => undefined); throw error; }
    });
    let delivered: Delivery;
    try { delivered = await subscribe(job, signal); } catch (e) { if (signal.aborted) throw signal.reason; throw safeMarketError(e); }
    // Re-evaluate observation freshness for EACH response, not just when it was cached.
    const parsed = parse(delivered.record.value);
    receipts.push({ endpoint, symbols: (params.symbol || params.tickers || "").split(",").filter(Boolean), retrievedAt: delivered.record.retrievedAt, cacheHit: delivered.cached || joined, sha256: delivered.record.sha256, cacheAgeMs: Math.max(0, Date.now() - Date.parse(delivered.record.retrievedAt)), cacheState: delivered.record.retained ? "retained" : "fresh" });
    return parsed;
  };
}
