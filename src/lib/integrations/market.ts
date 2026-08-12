import "server-only";

import { getOptionalEnv } from "@/lib/env";
import { alphaVantageRequest } from "@/lib/integrations/alpha-vantage";
import {
  getIntegrationCircuitSnapshot,
  publicIntegrationFailure,
} from "@/lib/integrations/core";

export type MarketQuoteResult = {
  symbol: string;
  price: number | null;
  change: number | null;
  changePct: number | null;
  previousClose: number | null;
  volume: number | null;
  latestTradingDay: string | null;
  provider: string;
  isLive: boolean;
  note: string;
  latencyMs?: number;
  requestId?: string;
  errorCode?: string;
  retryable?: boolean;
};

type GlobalQuotePayload = {
  "Global Quote"?: Record<string, unknown>;
};

function round(value: number, places = 2) {
  const multiplier = 10 ** places;
  return Math.round(value * multiplier) / multiplier;
}

function numberOrNull(value: unknown) {
  const parsed = Number(String(value ?? "").replace(/[,%]/g, "").trim());
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeSymbol(value: string) {
  return String(value ?? "")
    .trim()
    .toUpperCase()
    .replace(/^\$/, "")
    .replace(/[^A-Z0-9.-]/g, "")
    .slice(0, 20);
}

function emptyResult(
  symbol: string,
  input: {
    note: string;
    errorCode?: string;
    retryable?: boolean;
    latencyMs?: number;
    requestId?: string;
  },
): MarketQuoteResult {
  return {
    symbol,
    price: null,
    change: null,
    changePct: null,
    previousClose: null,
    volume: null,
    latestTradingDay: null,
    provider: "Alpha Vantage",
    isLive: false,
    note: input.note,
    errorCode: input.errorCode,
    retryable: input.retryable,
    latencyMs: input.latencyMs,
    requestId: input.requestId,
  };
}

export async function fetchMarketQuote(
  symbol: string,
  options: { signal?: AbortSignal } = {},
): Promise<MarketQuoteResult> {
  const cleanSymbol = normalizeSymbol(symbol);

  if (!cleanSymbol) {
    return emptyResult("", {
      note: "A valid market symbol is required.",
      errorCode: "INVALID_SYMBOL",
      retryable: false,
    });
  }

  if (!getOptionalEnv("ALPHA_VANTAGE_API_KEY")) {
    return emptyResult(cleanSymbol, {
      note: "Alpha Vantage is not configured.",
      errorCode: "INTEGRATION_NOT_CONFIGURED",
      retryable: false,
    });
  }

  const entitlement = String(process.env.ALPHA_VANTAGE_ENTITLEMENT ?? "")
    .trim()
    .toLowerCase();

  try {
    const result = await alphaVantageRequest(
      "GLOBAL_QUOTE",
      {
        symbol: cleanSymbol,
        ...(entitlement === "realtime" || entitlement === "delayed"
          ? { entitlement }
          : {}),
      },
      {
        timeoutMs: 12_000,
        maxAttempts: 2,
        maxResponseBytes: 512 * 1024,
        signal: options.signal,
      },
    );
    const payload = result.data as GlobalQuotePayload;
    const raw = payload["Global Quote"] ?? {};
    const price = numberOrNull(raw["05. price"]);
    const change = numberOrNull(raw["09. change"]);
    const changePct = numberOrNull(raw["10. change percent"]);
    const previousClose = numberOrNull(raw["08. previous close"]);
    const volume = numberOrNull(raw["06. volume"]);

    if (price === null || price <= 0) {
      return emptyResult(cleanSymbol, {
        note: "Alpha Vantage did not return a usable quote.",
        errorCode: "PROVIDER_INVALID_RESPONSE",
        retryable: false,
        latencyMs: result.meta.durationMs,
        requestId: result.meta.requestId,
      });
    }

    const isLive = entitlement === "realtime";

    return {
      symbol: cleanSymbol,
      price: round(price, 4),
      change: change === null ? null : round(change, 4),
      changePct: changePct === null ? null : round(changePct, 4),
      previousClose: previousClose === null ? null : round(previousClose, 4),
      volume,
      latestTradingDay:
        typeof raw["07. latest trading day"] === "string"
          ? raw["07. latest trading day"]
          : null,
      provider: "Alpha Vantage",
      isLive,
      note: isLive
        ? "Alpha Vantage real-time entitlement returned a quote."
        : "Quote loaded, but the configured entitlement is not marked real-time.",
      latencyMs: result.meta.durationMs,
      requestId: result.meta.requestId,
    };
  } catch (error) {
    const failure = publicIntegrationFailure(
      error,
      "Alpha Vantage could not return a quote.",
    );

    return emptyResult(cleanSymbol, {
      note: failure.message,
      errorCode: failure.code,
      retryable: failure.retryable,
      requestId: failure.requestId,
    });
  }
}

export function getMarketIntegrationStatus() {
  const entitlement = String(process.env.ALPHA_VANTAGE_ENTITLEMENT ?? "")
    .trim()
    .toLowerCase();

  return {
    provider: "Alpha Vantage",
    configured: Boolean(getOptionalEnv("ALPHA_VANTAGE_API_KEY")),
    entitlement:
      entitlement === "realtime" || entitlement === "delayed"
        ? entitlement
        : "unspecified",
    strictRealtimeClaiming: true,
    circuits: getIntegrationCircuitSnapshot("alpha-vantage"),
  };
}