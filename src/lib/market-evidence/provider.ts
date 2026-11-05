import "server-only";
import { randomUUID } from "node:crypto";
import type { MarketEvidence, MarketIssue, MarketReceipt, MarketRequest } from "./contracts";
import { MarketError } from "./core";
import { safeMarketError } from "./transport";
import { marketConfiguration } from "./configuration";
import { loadMarketSection } from "@/lib/market-visuals/service";
export { marketConfiguration } from "./configuration";
export type CacheValue = { value: unknown; retrievedAt: string; sha256: string; observedAt?: string; retained?: boolean; refreshNotice?: string; retryAt?: string };
export type MarketStorage = { cacheNamespace?: string; retained?: (key: string, maxAgeMs: number) => Promise<CacheValue | null>; cached: (key: string, ttlMs: number) => Promise<CacheValue | null>; claim: (key: string) => Promise<string>; reserve: () => Promise<void>; save: (key: string, token: string, record: CacheValue) => Promise<void>; fail: (key: string, token: string, error: MarketError) => Promise<void> };
export async function collectMarket(input: MarketRequest, storage: MarketStorage, signal: AbortSignal, force = false): Promise<MarketEvidence> {
  const c = marketConfiguration();
  if (!c.key || c.key.toLowerCase() === "demo") throw new MarketError("MARKET_KEY_MISSING", "Configure a private Alpha Vantage credential. Demonstration keys are not accepted.", 503);
  const receipts: MarketReceipt[] = [], issues: MarketIssue[] = [], snapshots: NonNullable<MarketEvidence["snapshots"]> = [];
  async function get<S extends import("@/lib/market-visuals/contracts").Section>(section: S, symbol: string) {
    try {
      const r = await loadMarketSection({ section, symbol, range: input.range || "3M", confirmOptions: false }, storage, signal, force);
      receipts.push(...r.receipts); if (r.snapshotId) snapshots.push({ section, symbol, snapshotId: r.snapshotId });
      return r.data;
    } catch (e) { signal.throwIfAborted(); const error = safeMarketError(e); issues.push({ scope: `${section}:${symbol}`, code: error.code, message: error.message }); return null; }
  }
  // The exact same per-symbol request is used by Workspace, Market Visuals, and AI Studio.
  // The existing transport limits outbound concurrency and enforces database-backed quotas.
  const [quoteSets, series, comparison, newsSets] = await Promise.all([
    Promise.all(input.symbols.map(s => get("quote", s))),
    input.chartSymbol ? get("history", input.chartSymbol) : Promise.resolve(null),
    input.comparisonSymbol ? get("history", input.comparisonSymbol) : Promise.resolve(null),
    input.news ? Promise.all(input.symbols.map(s => get("news", s))) : Promise.resolve([]),
  ]);
  const news = [...new Map(newsSets.flatMap(rows => rows || []).map(n => [n.url, n])).values()].sort((a, b) => b.publishedAt.localeCompare(a.publishedAt)).slice(0, 8);
  return { version: "slice-market-evidence-v1", evidenceId: randomUUID(), provider: "Alpha Vantage", preparedAt: new Date().toISOString(), requestedSymbols: input.symbols, entitlement: c.entitlement, quotes: quoteSets.flatMap(rows => rows || []), series, comparison, comparisonRequested: input.comparisonSymbol || null, news, receipts, issues, snapshots, delivery: "refreshed", newsRequested: Boolean(input.news), newsRetrieved: Boolean(input.news && newsSets.some(r => r !== null)), marketIsOpen: null };
}
