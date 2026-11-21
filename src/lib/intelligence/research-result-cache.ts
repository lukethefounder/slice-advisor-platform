export type ResearchResultCacheRecord<T> = {
  value: T;
  expiresAt: number;
  byteCount: number;
};

export const RESEARCH_RESULT_CACHE_LIMITS = Object.freeze({
  maxBytes: 32 * 1024 * 1024,
  maxEntries: 4,
});

type ResearchResultCacheLimits = { readonly maxBytes: number; readonly maxEntries: number };

/** Serialized UTF-8 bytes bound retained payloads; this is not a JS heap measurement. */
export function researchResultByteSize(value: unknown) {
  try {
    const serialized = JSON.stringify(value);
    return typeof serialized === "string" ? Buffer.byteLength(serialized, "utf8") : Infinity;
  } catch {
    return Infinity;
  }
}

export function pruneResearchResultCache<T>(
  cache: Map<string, ResearchResultCacheRecord<T>>,
  now = Date.now(),
  limits: ResearchResultCacheLimits = RESEARCH_RESULT_CACHE_LIMITS,
) {
  let bytes = 0;
  for (const [key, record] of cache) {
    if (!Number.isFinite(record.expiresAt) || record.expiresAt <= now
      || !Number.isSafeInteger(record.byteCount) || record.byteCount <= 0
      || record.byteCount > limits.maxBytes) {
      cache.delete(key);
    } else {
      bytes += record.byteCount;
    }
  }
  // Map order is insertion order; the service touches an entry when it is read.
  for (const [key, record] of cache) {
    if (bytes <= limits.maxBytes && cache.size <= limits.maxEntries) break;
    cache.delete(key);
    bytes -= record.byteCount;
  }
  return { bytes, entries: cache.size };
}

export function retainResearchResult<T>(
  cache: Map<string, ResearchResultCacheRecord<T>>,
  key: string,
  record: ResearchResultCacheRecord<T>,
  now = Date.now(),
  limits: ResearchResultCacheLimits = RESEARCH_RESULT_CACHE_LIMITS,
) {
  cache.delete(key);
  if (Number.isSafeInteger(record.byteCount) && record.byteCount > 0
    && record.byteCount <= limits.maxBytes && Number.isFinite(record.expiresAt) && record.expiresAt > now) {
    cache.set(key, record);
  }
  pruneResearchResultCache(cache, now, limits);
  return cache.get(key) === record;
}

/** An older forced refresh must never clear a newer request's coalescing slot. */
export function releaseResearchFlight<T>(
  inflight: Map<string, Promise<T>>,
  key: string,
  operation: Promise<T>,
) {
  if (inflight.get(key) === operation) inflight.delete(key);
}
