import "server-only";

import {
  loadSlicePlatformContext,
  type SliceAiProfile,
  type SliceAiUser,
  type SlicePlatformContext,
} from "@/lib/ai-studio/platform-context";

export type SliceContextCacheState = "network" | "fresh" | "stale" | "coalesced";

type CacheEntry = {
  value: SlicePlatformContext | null;
  loadedAt: number;
  freshUntil: number;
  staleUntil: number;
  promise: Promise<SlicePlatformContext> | null;
};

const contextCache = new Map<string, CacheEntry>();
const FRESH_MS = 25_000;
const STALE_MS = 3 * 60_000;
const MAX_ENTRIES = 32;

function cacheKey(user: SliceAiUser, profile: SliceAiProfile) {
  return `${user.id}:${profile.firmId ?? "personal"}`;
}

function pruneCache() {
  if (contextCache.size <= MAX_ENTRIES) return;

  const oldest = [...contextCache.entries()]
    .sort((left, right) => left[1].loadedAt - right[1].loadedAt)
    .slice(0, contextCache.size - MAX_ENTRIES);

  for (const [key] of oldest) contextCache.delete(key);
}

export async function loadCachedSlicePlatformContext(input: {
  user: SliceAiUser;
  profile: SliceAiProfile;
  force?: boolean;
}) {
  const key = cacheKey(input.user, input.profile);
  const now = Date.now();
  const current = contextCache.get(key);

  if (!input.force && current?.value && current.freshUntil > now) {
    return {
      context: current.value,
      cacheState: "fresh" as const,
      ageMs: Math.max(0, now - current.loadedAt),
    };
  }

  if (!input.force && current?.promise) {
    const context = await current.promise;
    return {
      context,
      cacheState: "coalesced" as const,
      ageMs: Math.max(0, Date.now() - (current.loadedAt || now)),
    };
  }

  const promise = loadSlicePlatformContext({
    user: input.user,
    profile: input.profile,
  });
  const entry: CacheEntry = current ?? {
    value: null,
    loadedAt: 0,
    freshUntil: 0,
    staleUntil: 0,
    promise: null,
  };
  entry.promise = promise;
  contextCache.set(key, entry);

  try {
    const context = await promise;
    const loadedAt = Date.now();
    contextCache.set(key, {
      value: context,
      loadedAt,
      freshUntil: loadedAt + FRESH_MS,
      staleUntil: loadedAt + STALE_MS,
      promise: null,
    });
    pruneCache();

    return {
      context,
      cacheState: "network" as const,
      ageMs: 0,
    };
  } catch (error) {
    const fallback = contextCache.get(key);
    if (fallback?.value && fallback.staleUntil > Date.now()) {
      fallback.promise = null;
      contextCache.set(key, fallback);
      return {
        context: fallback.value,
        cacheState: "stale" as const,
        ageMs: Math.max(0, Date.now() - fallback.loadedAt),
      };
    }

    contextCache.delete(key);
    throw error;
  }
}

export function invalidateSlicePlatformContext(userId: string, firmId?: string | null) {
  contextCache.delete(`${userId}:${firmId ?? "personal"}`);
}