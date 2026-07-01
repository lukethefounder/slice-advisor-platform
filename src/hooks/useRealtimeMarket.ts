"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";

export type RealtimeAssetSnapshot = {
  symbol: string;
  providerSymbol: string;
  assetType: string;
  provider: string;
  isRealtime: boolean;
  price: number;
  previousClose?: number | null;
  change?: number | null;
  changePercent?: number | null;
  bid?: number | null;
  ask?: number | null;
  volume?: number | null;
  currency: string;
  marketState: "Live" | "Delayed" | "Closed" | "Stale" | "Demo";
  qualityScore: number;
  latencyMs: number;
  providerTimestamp?: string | null;
  receivedAt: string;
  technicals: {
    sma20?: number | null;
    sma50?: number | null;
    sma200?: number | null;
    rsi14?: number | null;
    volatility30d?: number | null;
    trend?: "Bullish" | "Bearish" | "Neutral" | "Insufficient data";
    technicalSummary: string;
  };
  warnings: string[];
};

export type RealtimeMarketResponse = {
  generatedAt: string;
  pollAfterMs: number;
  providerPriority: string[];
  requestedSymbols: string[];
  realtimeCount: number;
  delayedOrDemoCount: number;
  staleCount: number;
  warnings: string[];
  snapshots: RealtimeAssetSnapshot[];
};

type UseRealtimeMarketOptions = {
  intervalMs?: number;
  enabled?: boolean;
  persist?: boolean;
};

function normalizeSymbols(symbols: string[]) {
  return Array.from(
    new Set(
      symbols
        .map((symbol) => symbol.trim().toUpperCase())
        .filter(Boolean)
    )
  );
}

export function useRealtimeMarket(
  symbols: string[],
  options: UseRealtimeMarketOptions = {}
) {
  const normalizedSymbols = useMemo(() => normalizeSymbols(symbols), [symbols.join(",")]);
  const intervalMs =
    options.intervalMs ??
    Number(process.env.NEXT_PUBLIC_SLICE_REALTIME_POLL_MS) ??
    15_000;

  const enabled = options.enabled ?? true;
  const persist = options.persist ?? true;

  const [data, setData] = useState<RealtimeMarketResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const abortRef = useRef<AbortController | null>(null);

  const refresh = useCallback(async () => {
    if (!enabled || normalizedSymbols.length === 0) return;

    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        symbols: normalizedSymbols.join(","),
        persist: String(persist),
      });

      const response = await fetch(`/api/market/realtime?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      if (!response.ok) {
        throw new Error(`Real-time market request failed with HTTP ${response.status}.`);
      }

      const payload = (await response.json()) as RealtimeMarketResponse;

      setData(payload);
      setLastUpdatedAt(new Date());
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") return;

      setError(fetchError instanceof Error ? fetchError.message : "Market refresh failed.");
    } finally {
      setLoading(false);
    }
  }, [enabled, normalizedSymbols.join(","), persist]);

  useEffect(() => {
    refresh();

    if (!enabled) return;

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        refresh();
      }
    }, Math.max(5_000, intervalMs));

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible") refresh();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);

    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      abortRef.current?.abort();
    };
  }, [enabled, intervalMs, refresh]);

  const isStale = lastUpdatedAt
    ? Date.now() - lastUpdatedAt.getTime() > Math.max(intervalMs * 3, 45_000)
    : false;

  return {
    data,
    snapshots: data?.snapshots ?? [],
    error,
    loading,
    isStale,
    lastUpdatedAt,
    refresh,
  };
}