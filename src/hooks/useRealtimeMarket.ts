"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

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
  providerMode?: "alphavantage" | "auto";
  strictProvider?: boolean;
  authenticated?: boolean;
};

type UseRealtimeMarketOptions = {
  intervalMs?: number;
  enabled?: boolean;
  persist?: boolean;
  provider?: "alphavantage" | "auto";
  strictProvider?: boolean;
};

function normalizeSymbols(symbols: string[]) {
  return Array.from(
    new Set(
      symbols
        .map((symbol) =>
          symbol
            .trim()
            .toUpperCase()
            .replace(/^\$/, "")
        )
        .filter(Boolean)
    )
  ).slice(0, 100);
}

function configuredInterval() {
  const value = Number(process.env.NEXT_PUBLIC_SLICE_REALTIME_POLL_MS);

  return Number.isFinite(value) ? value : 30_000;
}

export function useRealtimeMarket(
  symbols: string[],
  options: UseRealtimeMarketOptions = {}
) {
  const normalizedSymbols = useMemo(
    () => normalizeSymbols(symbols),
    [symbols.join(",")]
  );

  const intervalMs = Math.max(
    15_000,
    options.intervalMs ?? configuredInterval()
  );

  const enabled = options.enabled ?? true;
  const persist = options.persist ?? true;
  const provider = options.provider ?? "alphavantage";
  const strictProvider = options.strictProvider ?? provider === "alphavantage";

  const [data, setData] = useState<RealtimeMarketResponse | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [lastUpdatedAt, setLastUpdatedAt] = useState<Date | null>(null);

  const abortRef = useRef<AbortController | null>(null);
  const mountedRef = useRef(true);

  const refresh = useCallback(async () => {
    if (!enabled || normalizedSymbols.length === 0) {
      return;
    }

    abortRef.current?.abort();

    const controller = new AbortController();
    abortRef.current = controller;

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams({
        symbols: normalizedSymbols.join(","),
        persist: String(persist),
        provider,
        strict: String(strictProvider),
      });

      const response = await fetch(`/api/market/realtime?${params.toString()}`, {
        cache: "no-store",
        signal: controller.signal,
      });

      const payload = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          payload.detail ||
            payload.error ||
            `Real-time market request failed with HTTP ${response.status}.`
        );
      }

      const result = payload as RealtimeMarketResponse;

      if (strictProvider && provider === "alphavantage") {
        const nonAlpha = result.snapshots.filter(
          (snapshot) => snapshot.provider !== "Alpha Vantage"
        );

        if (nonAlpha.length) {
          throw new Error(
            `Strict Alpha Vantage mode received another provider for ${nonAlpha
              .map((snapshot) => snapshot.symbol)
              .join(", ")}.`
          );
        }
      }

      if (mountedRef.current) {
        setData(result);
        setLastUpdatedAt(new Date());
      }
    } catch (fetchError) {
      if (fetchError instanceof DOMException && fetchError.name === "AbortError") {
        return;
      }

      if (mountedRef.current) {
        setError(
          fetchError instanceof Error
            ? fetchError.message
            : "Alpha Vantage market refresh failed."
        );
      }
    } finally {
      if (mountedRef.current) {
        setLoading(false);
      }
    }
  }, [
    enabled,
    normalizedSymbols.join(","),
    persist,
    provider,
    strictProvider,
  ]);

  useEffect(() => {
    mountedRef.current = true;
    void refresh();

    if (!enabled) {
      return;
    }

    const timer = window.setInterval(() => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void refresh();
      }
    }, intervalMs);

    const onVisibilityChange = () => {
      if (document.visibilityState === "visible" && navigator.onLine) {
        void refresh();
      }
    };

    const onOnline = () => {
      void refresh();
    };

    document.addEventListener("visibilitychange", onVisibilityChange);
    window.addEventListener("online", onOnline);

    return () => {
      mountedRef.current = false;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisibilityChange);
      window.removeEventListener("online", onOnline);
      abortRef.current?.abort();
    };
  }, [enabled, intervalMs, refresh]);

  const isStale = lastUpdatedAt
    ? Date.now() - lastUpdatedAt.getTime() > Math.max(intervalMs * 3, 90_000)
    : false;

  return {
    data,
    snapshots: data?.snapshots ?? [],
    error,
    loading,
    isStale,
    lastUpdatedAt,
    refresh,
    provider,
    strictProvider,
  };
}