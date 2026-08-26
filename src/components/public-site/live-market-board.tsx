"use client";

import type { ReactNode } from "react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  Activity,
  AlertTriangle,
  ArrowDownRight,
  ArrowUpRight,
  BarChart3,
  CheckCircle2,
  Clock3,
  CloudOff,
  Database,
  Gauge,
  LineChart,
  Loader2,
  Newspaper,
  RefreshCcw,
  ServerCog,
  ShieldCheck,
  Signal,
  Wifi,
  WifiOff,
} from "lucide-react";

import type { AlphaVantageIntelligenceResponse } from "@/lib/intelligence/alpha-vantage-types";
import type {
  PublicMarketEntitlement,
  PublicMarketSnapshot,
  PublicMarketSummaryPayload,
  PublicMarketSummarySuccess,
} from "@/lib/public-market-types";

const STORAGE_KEY = "slice-public-market-summary-v1";
const MAX_STORED_AGE_MS = 10 * 60_000;

type BoardStatus =
  | "idle"
  | "loading"
  | "refreshing"
  | "ready"
  | "error";

type PriceMovement = Record<string, "up" | "down" | "flat">;
type PriceHistory = Record<string, number[]>;

type AlphaDetailFailure = {
  ok: false;
  error: string;
};

type AlphaDetailPayload =
  | AlphaVantageIntelligenceResponse
  | AlphaDetailFailure;

type AlphaDetailResponse = AlphaVantageIntelligenceResponse;

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function clamp(value: number, minimum: number, maximum: number) {
  return Math.max(minimum, Math.min(maximum, value));
}

function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: value >= 100 ? 2 : value >= 1 ? 3 : 5,
  }).format(value);
}

function formatPercent(value: number | null | undefined, digits = 2) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${value >= 0 ? "+" : ""}${value.toFixed(digits)}%`;
}

function formatCompact(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return new Intl.NumberFormat("en-US", {
    notation: Math.abs(value) >= 1_000 ? "compact" : "standard",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatTime(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "Unavailable";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    timeZoneName: "short",
  }).format(new Date(value));
}

function relativeTime(value?: string | null) {
  if (!value || !Number.isFinite(Date.parse(value))) return "time unavailable";

  const seconds = Math.max(0, Math.round((Date.now() - Date.parse(value)) / 1_000));
  if (seconds < 60) return `${seconds}s ago`;
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

async function readJson<T>(response: Response): Promise<T> {
  const text = await response.text();

  try {
    return JSON.parse(text) as T;
  } catch {
    throw new Error(
      `Slice received an invalid JSON response (HTTP ${response.status}).`,
    );
  }
}

function isAlphaDetailResponse(
  value: AlphaDetailPayload,
): value is AlphaDetailResponse {
  return (
    "symbol" in value &&
    typeof value.symbol === "string" &&
    "provider" in value &&
    value.provider === "Alpha Vantage" &&
    "health" in value &&
    typeof value.health === "object" &&
    value.health !== null
  );
}

function readStoredSummary() {
  if (typeof window === "undefined") return null;

  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as PublicMarketSummarySuccess;
    const age = Date.now() - Date.parse(parsed.generatedAt);

    return parsed.ok && Number.isFinite(age) && age <= MAX_STORED_AGE_MS
      ? parsed
      : null;
  } catch {
    return null;
  }
}

function storeSummary(value: PublicMarketSummarySuccess) {
  try {
    window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Session storage is an optional rendering optimization.
  }
}

function buildSparkPath(values: number[], width = 280, height = 82) {
  const points = values.filter(Number.isFinite);
  if (!points.length) return "";

  const minimum = Math.min(...points);
  const maximum = Math.max(...points);
  const range = Math.max(maximum - minimum, Math.abs(maximum) * 0.0005, 0.0001);

  return points
    .map((value, index) => {
      const x =
        points.length === 1
          ? width / 2
          : (index / (points.length - 1)) * width;
      const y = height - ((value - minimum) / range) * (height - 14) - 7;
      return `${index === 0 ? "M" : "L"}${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}

function StateBadge({ snapshot }: { snapshot: PublicMarketSnapshot }) {
  const classes =
    snapshot.marketState === "Live"
      ? "border-emerald-700/20 bg-emerald-50 text-emerald-900"
      : snapshot.marketState === "Closed"
        ? "border-sky-700/20 bg-sky-50 text-sky-900"
        : snapshot.marketState === "Stale"
          ? "border-rose-700/20 bg-rose-50 text-rose-900"
          : "border-amber-700/20 bg-amber-50 text-amber-900";

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.14em]",
        classes,
      )}
    >
      <span
        className={cx(
          "h-1.5 w-1.5 rounded-full",
          snapshot.marketState === "Live"
            ? "bg-emerald-600"
            : snapshot.marketState === "Closed"
              ? "bg-sky-600"
              : snapshot.marketState === "Stale"
                ? "bg-rose-600"
                : "bg-amber-600",
        )}
      />
      {snapshot.marketState}
    </span>
  );
}

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  const path = buildSparkPath(values);

  return (
    <svg
      viewBox="0 0 280 82"
      className="h-[82px] w-full"
      role="img"
      aria-label="Recent confirmed quote movement"
    >
      <defs>
        <linearGradient id={positive ? "spark-positive" : "spark-negative"} x1="0" x2="1">
          <stop offset="0" stopColor={positive ? "#047857" : "#be123c"} stopOpacity="0.35" />
          <stop offset="1" stopColor={positive ? "#16a36f" : "#fb7185"} stopOpacity="0.95" />
        </linearGradient>
      </defs>
      <path d="M0 71 H280" stroke="rgba(7,83,60,0.10)" strokeWidth="1" />
      {path ? (
        <path
          d={path}
          fill="none"
          stroke={`url(#${positive ? "spark-positive" : "spark-negative"})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ) : null}
    </svg>
  );
}

function Metric({
  label,
  value,
  helper,
  icon,
}: {
  label: string;
  value: string;
  helper: string;
  icon: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="truncate text-[9px] font-black uppercase tracking-[0.14em] text-[var(--slice-subtle)]">
            {label}
          </div>
          <div className="mt-2 truncate text-2xl font-black tracking-[-0.035em] text-[var(--slice-heading)]">
            {value}
          </div>
          <div className="mt-1 truncate text-[10px] font-bold text-[var(--slice-muted)]">
            {helper}
          </div>
        </div>
        <div className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-emerald-700/15 bg-white text-emerald-800">
          {icon}
        </div>
      </div>
    </div>
  );
}

function DetailPanel({
  snapshot,
  detail,
  loading,
  error,
  onLoad,
}: {
  snapshot: PublicMarketSnapshot;
  detail: AlphaDetailResponse | undefined;
  loading: boolean;
  error: string;
  onLoad: () => void;
}) {
  const technicals = detail?.technicals;
  const news = detail?.news;

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,0.88fr)_minmax(0,1.12fr)]">
      <div className="rounded-[1.6rem] border border-emerald-950/10 bg-white p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-800">
              Selected symbol
            </div>
            <h3 className="mt-1 text-3xl font-black tracking-[-0.05em] text-[var(--slice-heading)]">
              {snapshot.symbol}
            </h3>
          </div>
          <StateBadge snapshot={snapshot} />
        </div>

        <div className="mt-5 text-4xl font-black tracking-[-0.05em] text-[var(--slice-heading)]">
          {formatCurrency(snapshot.price)}
        </div>
        <div
          className={cx(
            "mt-2 inline-flex items-center gap-1.5 text-sm font-black",
            (snapshot.changePercent ?? 0) >= 0
              ? "text-emerald-800"
              : "text-rose-800",
          )}
        >
          {(snapshot.changePercent ?? 0) >= 0 ? (
            <ArrowUpRight className="h-4 w-4" />
          ) : (
            <ArrowDownRight className="h-4 w-4" />
          )}
          {formatCurrency(snapshot.change)} · {formatPercent(snapshot.changePercent)}
        </div>

        <dl className="mt-6 grid grid-cols-2 gap-3 text-xs">
          <div className="rounded-xl border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-3">
            <dt className="font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">Previous close</dt>
            <dd className="mt-1 font-black text-[var(--slice-heading)]">{formatCurrency(snapshot.previousClose)}</dd>
          </div>
          <div className="rounded-xl border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-3">
            <dt className="font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">Volume</dt>
            <dd className="mt-1 font-black text-[var(--slice-heading)]">{formatCompact(snapshot.volume)}</dd>
          </div>
          <div className="col-span-2 rounded-xl border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-3">
            <dt className="font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">Provider time</dt>
            <dd className="mt-1 font-bold text-[var(--slice-heading)]">{formatTime(snapshot.providerTimestamp)}</dd>
          </div>
        </dl>

        <button
          type="button"
          onClick={onLoad}
          disabled={loading}
          className="mt-6 inline-flex min-h-11 w-full items-center justify-center gap-2 rounded-xl border border-emerald-800/20 bg-[linear-gradient(110deg,#16a36f,#07533c)] px-4 py-3 text-sm font-black text-white shadow-[0_12px_26px_rgba(5,120,83,0.20)] transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <LineChart className="h-4 w-4" />
          )}
          {loading
            ? "Loading full Alpha Vantage analysis"
            : detail
              ? "Refresh full analysis"
              : "Load full analysis"}
        </button>
        <p className="mt-3 text-center text-[10px] font-semibold leading-5 text-[var(--slice-subtle)]">
          This deliberate action loads quote, intraday, market status, overview,
          news, and daily-history endpoints for {snapshot.symbol}.
        </p>
      </div>

      <div className="rounded-[1.6rem] border border-emerald-950/10 bg-white p-5 sm:p-6">
        {!detail && !loading && !error ? (
          <div className="grid min-h-[25rem] place-items-center text-center">
            <div className="max-w-md">
              <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl border border-emerald-700/15 bg-emerald-50 text-emerald-800">
                <Database className="h-6 w-6" />
              </div>
              <h3 className="mt-5 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
                Deep analysis is paused until requested.
              </h3>
              <p className="mt-3 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
                The compact board stays fast and quota-conscious. Open full
                analysis only for the symbol currently under review.
              </p>
            </div>
          </div>
        ) : null}

        {loading && !detail ? (
          <div className="grid min-h-[25rem] place-items-center text-center">
            <div>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-700" />
              <p className="mt-4 text-sm font-black text-[var(--slice-heading)]">
                Coordinating six Alpha Vantage endpoints…
              </p>
            </div>
          </div>
        ) : null}

        {error ? (
          <div className="mb-5 flex items-start gap-3 rounded-2xl border border-rose-700/20 bg-rose-50 p-4 text-sm font-semibold leading-6 text-rose-950">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        ) : null}

        {detail ? (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-800">
                  Full provider analysis
                </div>
                <h3 className="mt-1 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
                  {detail.freshness?.label ?? "Alpha Vantage intelligence"}
                </h3>
                <p className="mt-2 text-xs font-semibold leading-6 text-[var(--slice-muted)]">
                  {detail.freshness?.explanation ??
                    `Retrieved ${formatTime(detail.retrievedAt)}.`}
                </p>
              </div>
              <span
                className={cx(
                  "rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em]",
                  detail.health?.degraded
                    ? "border-amber-700/20 bg-amber-50 text-amber-900"
                    : "border-emerald-700/20 bg-emerald-50 text-emerald-900",
                )}
              >
                {detail.health?.successfulEndpointCount ?? 0}/
                {detail.health?.endpointCount ?? 6} endpoints
              </span>
            </div>

            <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <Metric
                label="Session high"
                value={formatCurrency(detail.quote?.high)}
                helper="Provider quote"
                icon={<ArrowUpRight className="h-4 w-4" />}
              />
              <Metric
                label="Session low"
                value={formatCurrency(detail.quote?.low)}
                helper="Provider quote"
                icon={<ArrowDownRight className="h-4 w-4" />}
              />
              <Metric
                label="RSI 14"
                value={
                  technicals?.rsi14 === null || technicals?.rsi14 === undefined
                    ? "—"
                    : technicals.rsi14.toFixed(1)
                }
                helper="Momentum context"
                icon={<Gauge className="h-4 w-4" />}
              />
              <Metric
                label="Risk score"
                value={
                  technicals?.riskScore === null ||
                  technicals?.riskScore === undefined
                    ? "—"
                    : technicals.riskScore.toFixed(0)
                }
                helper="Technical risk"
                icon={<ShieldCheck className="h-4 w-4" />}
              />
            </div>

            <div className="mt-5 grid gap-4 lg:grid-cols-2">
              <div className="rounded-2xl border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-4">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-800">
                  <BarChart3 className="h-3.5 w-3.5" />
                  Technical context
                </div>
                <p className="mt-3 text-xs font-semibold leading-6 text-[var(--slice-muted)]">
                  {technicals?.technicalSummary ??
                    "Technical history is not available for this response."}
                </p>
                <div className="mt-4 grid grid-cols-2 gap-2 text-[10px] font-bold">
                  <span className="rounded-lg bg-white px-2.5 py-2 text-[var(--slice-muted)]">
                    SMA 20: {formatCurrency(technicals?.sma20)}
                  </span>
                  <span className="rounded-lg bg-white px-2.5 py-2 text-[var(--slice-muted)]">
                    SMA 50: {formatCurrency(technicals?.sma50)}
                  </span>
                  <span className="rounded-lg bg-white px-2.5 py-2 text-[var(--slice-muted)]">
                    SMA 200: {formatCurrency(technicals?.sma200)}
                  </span>
                  <span className="rounded-lg bg-white px-2.5 py-2 text-[var(--slice-muted)]">
                    30D momentum: {formatPercent(technicals?.momentum30)}
                  </span>
                </div>
              </div>

              <div className="rounded-2xl border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-4">
                <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.16em] text-emerald-800">
                  <Newspaper className="h-3.5 w-3.5" />
                  Symbol news
                </div>
                <div className="mt-3 grid gap-2.5">
                  {(news?.items ?? []).slice(0, 3).map((item) => (
                    <a
                      key={item.id}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer noopener"
                      className="rounded-xl border border-emerald-950/10 bg-white p-3 transition hover:border-emerald-700/25 hover:bg-emerald-50"
                    >
                      <div className="line-clamp-2 text-xs font-black leading-5 text-[var(--slice-heading)]">
                        {item.title}
                      </div>
                      <div className="mt-1 text-[9px] font-bold uppercase tracking-[0.12em] text-[var(--slice-subtle)]">
                        {item.source} · {relativeTime(item.publishedAt)}
                      </div>
                    </a>
                  ))}
                  {!news?.items?.length ? (
                    <p className="text-xs font-semibold leading-6 text-[var(--slice-muted)]">
                      No symbol-specific provider stories were returned.
                    </p>
                  ) : null}
                </div>
              </div>
            </div>

            {detail.health?.warnings?.length ? (
              <details className="mt-5 rounded-2xl border border-amber-700/20 bg-amber-50 p-4">
                <summary className="cursor-pointer text-xs font-black text-amber-950">
                  View provider warnings ({detail.health.warnings.length})
                </summary>
                <ul className="mt-3 grid gap-2 text-xs font-semibold leading-6 text-amber-950">
                  {detail.health.warnings.map((warning) => (
                    <li key={warning}>• {warning}</li>
                  ))}
                </ul>
              </details>
            ) : null}
          </div>
        ) : null}
      </div>
    </div>
  );
}

export default function LiveMarketBoard() {
  const [summary, setSummary] =
    useState<PublicMarketSummarySuccess | null>(null);
  const [status, setStatus] = useState<BoardStatus>("idle");
  const [error, setError] = useState("");
  const [pollAfterMs, setPollAfterMs] = useState(60_000);
  const [movement, setMovement] = useState<PriceMovement>({});
  const [history, setHistory] = useState<PriceHistory>({});
  const [selectedSymbol, setSelectedSymbol] = useState("SPY");
  const [details, setDetails] = useState<Record<string, AlphaDetailResponse>>({});
  const [detailErrors, setDetailErrors] = useState<Record<string, string>>({});
  const [detailLoadingSymbol, setDetailLoadingSymbol] = useState("");
  const [online, setOnline] = useState(true);
  const [providerKeyStatus, setProviderKeyStatus] = useState<
    "checking" | "verified" | "missing" | "unverified"
  >("checking");
  const [providerEntitlement, setProviderEntitlement] =
    useState<PublicMarketEntitlement>("unconfigured");

  const summaryRef = useRef(summary);
  const summaryRequestInFlight = useRef(false);
  const summaryRequestSequence = useRef(0);
  const summaryAbort = useRef<AbortController | null>(null);
  const detailAbort = useRef<AbortController | null>(null);
  const detailSequence = useRef(0);

  useEffect(() => {
    summaryRef.current = summary;
  }, [summary]);

  const refreshSummary = useCallback(async (manual = false) => {
    if (summaryRequestInFlight.current) return;
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setOnline(false);
      setError("This device is offline. The last confirmed market response remains visible.");
      return;
    }

    const requestId = summaryRequestSequence.current + 1;
    summaryRequestSequence.current = requestId;
    summaryRequestInFlight.current = true;
    setStatus(summaryRef.current ? "refreshing" : "loading");
    if (manual) setError("");

    const controller = new AbortController();
    summaryAbort.current?.abort();
    summaryAbort.current = controller;

    try {
      const response = await fetch("/api/market/summary", {
        cache: manual ? "no-store" : "default",
        signal: controller.signal,
        headers: { Accept: "application/json" },
      });
      const payload = await readJson<PublicMarketSummaryPayload>(response);

      if (requestId !== summaryRequestSequence.current) return;

      if (!payload.ok) {
        setProviderKeyStatus(payload.keyStatus);
        setProviderEntitlement(payload.entitlement);
        throw new Error(payload.message);
      }

      if (!response.ok) {
        setProviderKeyStatus("unverified");
        setProviderEntitlement(payload.entitlement);
        throw new Error(`Market summary returned HTTP ${response.status}.`);
      }

      const previous = summaryRef.current;
      const previousPrices = new Map(
        (previous?.snapshots ?? []).map((snapshot) => [
          snapshot.symbol,
          snapshot.price,
        ]),
      );
      const nextMovement: PriceMovement = {};

      for (const snapshot of payload.snapshots) {
        const prior = previousPrices.get(snapshot.symbol);
        nextMovement[snapshot.symbol] =
          prior === undefined || prior === snapshot.price
            ? "flat"
            : snapshot.price > prior
              ? "up"
              : "down";
      }

      setMovement(nextMovement);
      setHistory((current) => {
        const next = { ...current };

        for (const snapshot of payload.snapshots) {
          const values = [...(next[snapshot.symbol] ?? [])];
          if (!values.length && snapshot.previousClose) {
            values.push(snapshot.previousClose);
          }
          if (!values.length || values[values.length - 1] !== snapshot.price) {
            values.push(snapshot.price);
          }
          next[snapshot.symbol] = values.slice(-24);
        }

        return next;
      });
      setSummary(payload);
      summaryRef.current = payload;
      setProviderKeyStatus(payload.keyStatus);
      setProviderEntitlement(payload.entitlement);
      setPollAfterMs(clamp(payload.pollAfterMs, 20_000, 300_000));
      setSelectedSymbol((current) =>
        payload.snapshots.some((snapshot) => snapshot.symbol === current)
          ? current
          : payload.snapshots[0]?.symbol ?? "SPY",
      );
      setOnline(true);
      setError("");
      setStatus("ready");
      storeSummary(payload);
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      if (requestId !== summaryRequestSequence.current) return;

      setError(
        caught instanceof Error
          ? caught.message
          : "The public market summary is temporarily unavailable.",
      );
      setProviderKeyStatus((current) =>
        current === "checking" ? "unverified" : current,
      );
      setStatus(summaryRef.current ? "ready" : "error");
    } finally {
      if (requestId === summaryRequestSequence.current) {
        summaryRequestInFlight.current = false;
        if (summaryAbort.current === controller) summaryAbort.current = null;
      }
    }
  }, []);

  useEffect(() => {
    const cached = readStoredSummary();

    if (cached) {
      const cachedHistory: PriceHistory = {};
      for (const snapshot of cached.snapshots) {
        cachedHistory[snapshot.symbol] = [
          ...(snapshot.previousClose ? [snapshot.previousClose] : []),
          snapshot.price,
        ];
      }

      summaryRef.current = cached;
      setSummary(cached);
      setStatus("ready");
      setProviderKeyStatus(cached.keyStatus);
      setProviderEntitlement(cached.entitlement);
      setPollAfterMs(clamp(cached.pollAfterMs, 20_000, 300_000));
      setSelectedSymbol(cached.snapshots[0]?.symbol ?? "SPY");
      setHistory(cachedHistory);
    }

    setOnline(typeof navigator === "undefined" ? true : navigator.onLine);
    void refreshSummary(false);

    return () => {
      summaryRequestSequence.current += 1;
      summaryRequestInFlight.current = false;
      summaryAbort.current?.abort();
      detailAbort.current?.abort();
    };
  }, [refreshSummary]);

  useEffect(() => {
    const interval = window.setInterval(() => {
      if (document.visibilityState === "visible") void refreshSummary(false);
    }, pollAfterMs);
    const onVisibility = () => {
      if (document.visibilityState === "visible") void refreshSummary(false);
    };
    const onOnline = () => {
      setOnline(true);
      void refreshSummary(false);
    };
    const onOffline = () => {
      setOnline(false);
      setError("This device is offline. The last confirmed market response remains visible.");
    };

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);

    return () => {
      window.clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [pollAfterMs, refreshSummary]);

  const loadDetail = useCallback(async (symbol: string) => {
    const requestId = detailSequence.current + 1;
    detailSequence.current = requestId;
    detailAbort.current?.abort();
    const controller = new AbortController();
    detailAbort.current = controller;
    setDetailLoadingSymbol(symbol);
    setDetailErrors((current) => ({ ...current, [symbol]: "" }));

    try {
      const response = await fetch(
        `/api/intelligence/alpha-vantage?symbol=${encodeURIComponent(symbol)}&interval=5min`,
        {
          cache: "no-store",
          signal: controller.signal,
          headers: { Accept: "application/json" },
        },
      );
      const payload = await readJson<AlphaDetailPayload>(response);

      const providerError =
        "error" in payload && typeof payload.error === "string"
          ? payload.error
          : "";

      if (
        !response.ok ||
        payload.ok === false ||
        !isAlphaDetailResponse(payload)
      ) {
        throw new Error(
          providerError ||
            `Alpha Vantage full analysis returned HTTP ${response.status}.`,
        );
      }
      if (requestId !== detailSequence.current) return;

      setDetails((current) => ({ ...current, [symbol]: payload }));
      setDetailErrors((current) => ({ ...current, [symbol]: "" }));
    } catch (caught) {
      if (caught instanceof Error && caught.name === "AbortError") return;
      if (requestId !== detailSequence.current) return;

      setDetailErrors((current) => ({
        ...current,
        [symbol]:
          caught instanceof Error
            ? caught.message
            : "Full Alpha Vantage analysis is temporarily unavailable.",
      }));
    } finally {
      if (requestId === detailSequence.current) setDetailLoadingSymbol("");
    }
  }, []);

  const snapshots = summary?.snapshots ?? [];
  const selected =
    snapshots.find((snapshot) => snapshot.symbol === selectedSymbol) ??
    snapshots[0];
  const stats = useMemo(() => {
    const advancers = snapshots.filter(
      (snapshot) => (snapshot.changePercent ?? 0) > 0,
    ).length;
    const decliners = snapshots.filter(
      (snapshot) => (snapshot.changePercent ?? 0) < 0,
    ).length;
    const quality = snapshots.length
      ? snapshots.reduce(
          (total, snapshot) => total + snapshot.qualityScore,
          0,
        ) / snapshots.length
      : 0;

    return { advancers, decliners, quality };
  }, [snapshots]);

  return (
    <section className="rounded-[2rem] border border-emerald-950/10 bg-white/88 p-4 shadow-[0_24px_80px_rgba(6,78,55,0.11)] backdrop-blur-xl sm:p-6 lg:p-8">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-700/20 bg-emerald-50 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em] text-emerald-900">
              <Signal className="h-3.5 w-3.5" />
              Alpha Vantage market summary
            </span>
            <span
              className={cx(
                "inline-flex items-center gap-2 rounded-full border px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.15em]",
                online
                  ? "border-emerald-700/20 bg-white text-emerald-900"
                  : "border-rose-700/20 bg-rose-50 text-rose-900",
              )}
            >
              {online ? <Wifi className="h-3.5 w-3.5" /> : <WifiOff className="h-3.5 w-3.5" />}
              {online ? "Device online" : "Device offline"}
            </span>
          </div>
          <h2 className="mt-4 text-3xl font-black tracking-[-0.05em] text-[var(--slice-heading)] sm:text-4xl">
            Confirmed quotes first. Deep analysis second.
          </h2>
          <p className="mt-3 max-w-3xl text-sm font-semibold leading-7 text-[var(--slice-muted)]">
            The board requests a compact fixed symbol set, exposes provider and
            entitlement state, pauses while hidden, prevents overlapping
            requests, and preserves the last confirmed response during errors.
          </p>
        </div>

        <button
          type="button"
          onClick={() => void refreshSummary(true)}
          disabled={status === "loading" || status === "refreshing"}
          className="inline-flex min-h-11 shrink-0 items-center justify-center gap-2 rounded-xl border border-emerald-950/15 bg-white px-4 py-3 text-sm font-black text-emerald-950 shadow-sm transition hover:border-emerald-700/30 hover:bg-emerald-50 disabled:cursor-not-allowed disabled:opacity-60"
        >
          <RefreshCcw
            className={cx(
              "h-4 w-4",
              (status === "loading" || status === "refreshing") &&
                "animate-spin",
            )}
          />
          {status === "refreshing" ? "Refreshing" : "Refresh quotes"}
        </button>
      </div>

      <div className="mt-6 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          label="API key"
          value={
            providerKeyStatus === "verified"
              ? "Verified"
              : providerKeyStatus === "missing"
                ? "Missing"
                : providerKeyStatus === "unverified"
                  ? "Needs check"
                  : "Checking"
          }
          helper="Never sent to the browser"
          icon={
            providerKeyStatus === "verified" ? (
              <CheckCircle2 className="h-4 w-4" />
            ) : (
              <ServerCog className="h-4 w-4" />
            )
          }
        />
        <Metric
          label="Entitlement"
          value={
            providerEntitlement === "realtime"
              ? "Realtime"
              : providerEntitlement === "delayed"
                ? "Delayed"
                : "Not declared"
          }
          helper="Controls public labels"
          icon={<ShieldCheck className="h-4 w-4" />}
        />
        <Metric
          label="Market breadth"
          value={`${stats.advancers} up · ${stats.decliners} down`}
          helper={`${snapshots.length} confirmed symbols`}
          icon={<Activity className="h-4 w-4" />}
        />
        <Metric
          label="Average quality"
          value={snapshots.length ? `${stats.quality.toFixed(0)}/100` : "—"}
          helper={summary ? `${summary.cacheStatus} · ${relativeTime(summary.generatedAt)}` : "Awaiting provider"}
          icon={<Gauge className="h-4 w-4" />}
        />
      </div>

      {error ? (
        <div className="mt-5 flex items-start gap-3 rounded-2xl border border-amber-700/20 bg-amber-50 p-4 text-sm font-semibold leading-6 text-amber-950">
          {online ? (
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          ) : (
            <CloudOff className="mt-0.5 h-4 w-4 shrink-0" />
          )}
          <div>
            <div className="font-black">Market refresh notice</div>
            <div className="mt-1">{error}</div>
          </div>
        </div>
      ) : null}

      {summary?.warnings.length ? (
        <details className="mt-4 rounded-2xl border border-amber-700/15 bg-amber-50/70 p-4">
          <summary className="cursor-pointer text-xs font-black text-amber-950">
            Provider and entitlement notes ({summary.warnings.length})
          </summary>
          <ul className="mt-3 grid gap-2 text-xs font-semibold leading-6 text-amber-950">
            {summary.warnings.map((warning) => (
              <li key={warning}>• {warning}</li>
            ))}
          </ul>
        </details>
      ) : null}

      {!snapshots.length ? (
        <div className="mt-6 grid min-h-[22rem] place-items-center rounded-[1.6rem] border border-emerald-950/10 bg-[var(--slice-surface-muted)] text-center">
          <div className="max-w-md px-6">
            {status === "error" ? (
              <ServerCog className="mx-auto h-8 w-8 text-amber-800" />
            ) : (
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-emerald-700" />
            )}
            <h3 className="mt-4 text-xl font-black text-[var(--slice-heading)]">
              {status === "error"
                ? "The provider summary is unavailable."
                : "Loading confirmed Alpha Vantage quotes…"}
            </h3>
            <p className="mt-2 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
              {status === "error"
                ? "Confirm the server-only API key and entitlement, then use Refresh quotes."
                : "The page shell is already interactive while the compact provider request completes."}
            </p>
          </div>
        </div>
      ) : (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {snapshots.map((snapshot) => {
              const positive = (snapshot.changePercent ?? 0) >= 0;
              const active = selected?.symbol === snapshot.symbol;
              const direction = movement[snapshot.symbol] ?? "flat";
              return (
                <button
                  key={snapshot.symbol}
                  type="button"
                  onClick={() => setSelectedSymbol(snapshot.symbol)}
                  aria-pressed={active}
                  className={cx(
                    "relative overflow-hidden rounded-[1.45rem] border p-4 text-left transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-600/40",
                    active
                      ? "border-emerald-700/35 bg-emerald-50 shadow-[0_15px_40px_rgba(5,120,83,0.12)]"
                      : "border-emerald-950/10 bg-white hover:border-emerald-700/25 hover:bg-emerald-50/55",
                    direction === "up" && "ring-1 ring-emerald-500/20",
                    direction === "down" && "ring-1 ring-rose-500/20",
                  )}
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <div className="text-lg font-black tracking-[-0.03em] text-[var(--slice-heading)]">
                        {snapshot.symbol}
                      </div>
                      <div className="mt-1 text-[9px] font-black uppercase tracking-[0.14em] text-[var(--slice-subtle)]">
                        Alpha Vantage
                      </div>
                    </div>
                    <StateBadge snapshot={snapshot} />
                  </div>
                  <div className="mt-5 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
                    {formatCurrency(snapshot.price)}
                  </div>
                  <div
                    className={cx(
                      "mt-2 inline-flex items-center gap-1 text-xs font-black",
                      positive ? "text-emerald-800" : "text-rose-800",
                    )}
                  >
                    {positive ? (
                      <ArrowUpRight className="h-3.5 w-3.5" />
                    ) : (
                      <ArrowDownRight className="h-3.5 w-3.5" />
                    )}
                    {formatPercent(snapshot.changePercent)}
                  </div>
                  <div className="mt-4 flex items-center justify-between gap-3 text-[9px] font-bold text-[var(--slice-subtle)]">
                    <span>Quality {snapshot.qualityScore}/100</span>
                    <span>{relativeTime(snapshot.providerTimestamp)}</span>
                  </div>
                </button>
              );
            })}
          </div>

          {selected ? (
            <div className="mt-6 rounded-[1.8rem] border border-emerald-950/10 bg-[var(--slice-surface-muted)] p-4 sm:p-5">
              <div className="mb-4 grid gap-4 rounded-[1.35rem] border border-emerald-950/10 bg-white p-4 lg:grid-cols-[minmax(0,1fr)_minmax(18rem,0.7fr)] lg:items-center">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[9px] font-black uppercase tracking-[0.16em] text-emerald-800">
                      Confirmed quote history
                    </span>
                    <span className="inline-flex items-center gap-1 text-[9px] font-bold text-[var(--slice-subtle)]">
                      <Clock3 className="h-3 w-3" />
                      Last summary {relativeTime(summary?.generatedAt)}
                    </span>
                  </div>
                  <h3 className="mt-2 text-2xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
                    {selected.symbol} has {history[selected.symbol]?.length ?? 0} retained in-session points.
                  </h3>
                  <p className="mt-2 text-xs font-semibold leading-6 text-[var(--slice-muted)]">
                    This line uses only prices confirmed during the current browser session. It is not synthetic intraday history.
                  </p>
                </div>
                <Sparkline
                  values={history[selected.symbol] ?? [selected.price]}
                  positive={(selected.changePercent ?? 0) >= 0}
                />
              </div>

              <DetailPanel
                snapshot={selected}
                detail={details[selected.symbol]}
                loading={detailLoadingSymbol === selected.symbol}
                error={detailErrors[selected.symbol] ?? ""}
                onLoad={() => void loadDetail(selected.symbol)}
              />
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}