import "server-only";
import { MarketError } from "@/lib/market-evidence/core";
import type { MarketStorage } from "@/lib/market-evidence/provider";
/** May read an explicitly dated last-good response; cannot reserve capacity or call a vendor. */
export function cacheOnly(storage: MarketStorage, maximumAgeMs = 72 * 60 * 60 * 1000): MarketStorage {
  const blocked = async (): Promise<never> => { throw new MarketError("SNAPSHOT_COLD", "No saved observation is available yet. A live lookup will start after the page opens.", 404); };
  return { cacheNamespace: storage.cacheNamespace ? `saved:${storage.cacheNamespace}` : undefined,
    cached: async (key, ttl) => { try { return await storage.cached(key, Math.min(Math.max(ttl, maximumAgeMs), 7 * 86400000)); } catch (error) { if (error instanceof MarketError && error.status === 429) return null; throw error; } },
    claim: blocked, reserve: blocked, save: blocked, fail: async () => {},
  };
}
