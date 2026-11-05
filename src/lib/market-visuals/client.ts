"use client";
import { useCallback, useEffect, useReducer, useRef } from "react";
import type { MarketRange } from "@/lib/market-evidence/contracts";
import type { Section, SectionResponse, SectionData } from "./contracts";
import { MarketViewCache, EMPTY_RESOURCE, resourceKey, type Resource } from "./view-cache";
export { resourceKey } from "./view-cache";
export type { Resource } from "./view-cache";
let browserCache: MarketViewCache | null = null;
export function clearMarketViews() { browserCache?.clear(); }
export function useMarketResources(scope: string | null, onUnauthorized: () => void, initial: SectionResponse[] = []) {
  const [, render] = useReducer((n: number) => n + 1, 0);
  const seed = useRef(initial), scopeRef = useRef(scope), cache = useRef<MarketViewCache | null>(null), unauthorized = useRef(onUnauthorized);
  unauthorized.current = onUnauthorized;
  const initialEntries = useRef(new Map<string, Resource>(initial.filter(r => r.scope === scope).map(r => [resourceKey(r.section, r.symbol, r.range), { ...EMPTY_RESOURCE, value: r, receivedAt: Math.min(Date.now(), ...r.receipts.map(p => Date.parse(p.retrievedAt) || 0)) }])));
  useEffect(() => {
    if (!browserCache) browserCache = new MarketViewCache();
    cache.current = browserCache;
    browserCache.activate(scope); scopeRef.current = scope;
    if (scope) browserCache.seed(scope, seed.current);
    const unsubscribe = browserCache.subscribe(() => render()); render();
    const clear = () => browserCache?.clear();
    window.addEventListener("slice-session-ended", clear);
    return () => { unsubscribe(); window.removeEventListener("slice-session-ended", clear); };
  }, [scope]);
  const get = useCallback(<S extends Section>(section: S, symbol: string, range: MarketRange): Resource<S> => {
    if (scopeRef.current !== scope) return EMPTY_RESOURCE as Resource<S>;
    if (cache.current && cache.current.scope !== scope) return EMPTY_RESOURCE as Resource<S>;
    return ((cache.current ? cache.current.entries : initialEntries.current).get(resourceKey(section, symbol, range)) || EMPTY_RESOURCE) as Resource<S>;
  }, [scope]);
  const load = useCallback(async (section: Section, symbol: string, range: MarketRange, refresh = false) => {
    if (scope && cache.current?.scope === scope) await cache.current.load(scope, section, symbol, range, refresh, () => unauthorized.current());
  }, [scope]);
  const all = useCallback(() => scopeRef.current === scope && (!cache.current || cache.current.scope === scope) ? [...(cache.current ? cache.current.entries : initialEntries.current).values()] : [], [scope]);
  return { get, load, all };
}
export function sectionValue<S extends Section>(r: Resource<S>): SectionData[S] | null { return r.value?.data ?? null; }
