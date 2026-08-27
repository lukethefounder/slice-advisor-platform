"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  Clock3,
  Database,
  Gauge,
  History,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Target,
  TrendingUp,
} from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from "react";

import {
  IntelligenceMetric,
  IntelligenceNotice,
  IntelligencePage,
  IntelligencePill,
  IntelligenceSectionHeading,
  IntelligenceSurface,
  formatIntelligenceCurrency,
  formatIntelligenceDate,
  formatIntelligenceInteger,
  formatIntelligenceNumber,
  formatIntelligencePercent,
} from "@/components/intelligence/intelligence-ui";
import {
  OperatingMemoryPills,
  type ClientOperatingMemory,
  statusTone,
  useVisibilityRefresh,
} from "@/components/intelligence/operating-memory-ui";
import {
  cleanIntelligenceSymbol,
  intelligenceFetch,
  isAbortError,
} from "@/lib/intelligence/client";

type ForecastOutcome = {
  id: string;
  observedAt: string;
  providerTimestamp: string | null;
  initialPrice: number;
  observedPrice: number;
  realizedReturnPercent: number;
  positiveOutcome: boolean;
  brierScore: number;
  logLoss: number;
  intervalCovered: boolean;
  directionalCorrect: boolean;
  absoluteReturnError: number;
  priceProvider: string;
};

type ForecastHorizon = {
  id: string;
  horizon: string;
  label: string;
  targetAt: string;
  initialPrice: number;
  direction: string;
  positiveReturnProbability: number;
  expectedReturnPercent: number;
  expectedPrice: number;
  priceRangeLow: number;
  priceRangeHigh: number;
  volatilityPercent: number;
  confidence: number;
  modelAgreement: string;
  simulationAgreement: string;
  dataQuality: string;
  primaryUncertainty: string;
  status: string;
  outcome: ForecastOutcome | null;
};

type ForecastRun = {
  id: string;
  requestId: string;
  symbol: string;
  asOfAt: string;
  generatedAt: string;
  engineVersion: string;
  modelVersion: string;
  calibrationVersion: string;
  marketRegime: string;
  sliceSentimentScore: number;
  dataQualityScore: number;
  sourceCount: number;
  independentSourceCount: number;
  simulationPaths: number;
  camelStatus: string;
  camelWorkforceMode: string;
  status: string;
  horizons: ForecastHorizon[];
};

type CalibrationMetrics = {
  sampleCount: number;
  brierScore: number;
  logLoss: number;
  intervalCoveragePercent: number;
  directionalAccuracyPercent: number;
  meanAbsoluteReturnError: number;
};

type HistoryResponse = {
  ok: true;
  generatedAt: string;
  window: {
    days: number;
    startAt: string;
    endAt: string;
    label: string;
    minimumRetainedDays: number;
    durable: boolean;
    scope: string;
  };
  filters: {
    symbol: string | null;
    limit: number;
  };
  summary: {
    totalRuns: number;
    returnedRuns: number;
    pendingHorizons: number;
    dueHorizons: number;
    settledHorizons: number;
    settledOutcomes: number;
  };
  automaticSettlement: {
    enabled: boolean;
    cadence: string;
    providerOrder: string[];
    demoPricesAccepted: false;
    preTargetPricesAccepted: false;
  };
  calibration: {
    generatedAt: string;
    window: HistoryResponse["window"];
    overall: CalibrationMetrics;
    byHorizon: Array<
      CalibrationMetrics & {
        horizon: string;
      }
    >;
    reliability: Array<{
      minimumProbability: number;
      maximumProbability: number;
      sampleCount: number;
      averageForecastProbability: number;
      observedPositivePercent: number;
    }>;
    latestObservedAt: string | null;
  };
  memory: ClientOperatingMemory;
  runs: ForecastRun[];
};

type ManualSettlement = {
  horizonId: string;
  symbol: string;
  label: string;
  targetAt: string;
  initialPrice: number;
};

function reliabilityWidth(value: number) {
  return `${Math.max(0, Math.min(100, value))}%`;
}

export default function ForecastHistoryWorkspace() {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [symbolInput, setSymbolInput] = useState("");
  const [activeSymbol, setActiveSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [settling, setSettling] = useState(false);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState(
    "Loading retained forecasts, due outcomes, and accuracy.",
  );
  const [error, setError] = useState("");
  const [manual, setManual] = useState<ManualSettlement | null>(null);
  const [observedPrice, setObservedPrice] = useState("");
  const [observedAt, setObservedAt] = useState("");
  const [provider, setProvider] = useState("Advisor manual observation");
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const load = useCallback(
    async (quiet = false, symbolOverride?: string) => {
      controller.current?.abort();
      const nextController = new AbortController();
      controller.current = nextController;
      const selectedSymbol =
        symbolOverride === undefined ? activeSymbol : symbolOverride;
      const params = new URLSearchParams({
        days: "30",
        limit: "50",
      });

      if (selectedSymbol) {
        params.set("symbol", selectedSymbol);
      }

      if (!quiet) {
        setLoading(true);
        setMessage("Loading 30-day forecast and outcome memory.");
      }

      try {
        const response = await intelligenceFetch<HistoryResponse>(
          `/api/intelligence/forecast/history?${params.toString()}`,
          {
            signal: nextController.signal,
          },
          {
            timeoutMs: 35_000,
            retries: 1,
          },
        );

        if (!mounted.current) return;

        setData(response);
        setError("");
        setMessage(
          `${response.summary.totalRuns.toLocaleString()} forecast runs and ${response.summary.settledOutcomes.toLocaleString()} settled outcomes are available in ${response.window.label}.`,
        );
      } catch (caught) {
        if (isAbortError(caught) || !mounted.current) return;

        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load forecast history.",
        );
      } finally {
        if (mounted.current) setLoading(false);
      }
    },
    [activeSymbol],
  );

  useEffect(() => {
    mounted.current = true;
    setOnline(navigator.onLine);
    const update = () => setOnline(navigator.onLine);
    window.addEventListener("online", update);
    window.addEventListener("offline", update);
    void load();

    return () => {
      mounted.current = false;
      controller.current?.abort();
      window.removeEventListener("online", update);
      window.removeEventListener("offline", update);
    };
  }, [load]);

  useVisibilityRefresh(
    () => load(true),
    {
      intervalMs: 60_000,
      enabled: true,
      busy: loading || settling,
    },
  );

  function applyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const symbol = cleanIntelligenceSymbol(symbolInput);
    setActiveSymbol(symbol);
    void load(false, symbol);
  }

  function openManualSettlement(
    run: ForecastRun,
    horizon: ForecastHorizon,
  ) {
    setManual({
      horizonId: horizon.id,
      symbol: run.symbol,
      label: horizon.label,
      targetAt: horizon.targetAt,
      initialPrice: horizon.initialPrice,
    });
    setObservedPrice("");
    setObservedAt("");
    setProvider("Advisor manual observation");
    setError("");
  }

  async function submitSettlement(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!manual) return;

    const price = Number(observedPrice);

    if (!Number.isFinite(price) || price <= 0) {
      setError("Observed price must be greater than zero.");
      return;
    }

    const parsedObservedAt = observedAt ? Date.parse(observedAt) : null;

    if (observedAt && !Number.isFinite(parsedObservedAt)) {
      setError("Observed time must be a valid date and time.");
      return;
    }

    const observedAtIso =
      parsedObservedAt === null
        ? undefined
        : new Date(parsedObservedAt).toISOString();

    setSettling(true);
    setError("");
    setMessage(
      `Recording the advisor-observed outcome for ${manual.symbol} ${manual.label}.`,
    );

    try {
      const response = await intelligenceFetch<{
        ok: true;
        alreadySettled: boolean;
      }>(
        "/api/intelligence/forecast/outcomes",
        {
          method: "POST",
          body: JSON.stringify({
            forecastHorizonId: manual.horizonId,
            observedPrice: price,
            observedAt: observedAtIso,
            provider,
          }),
        },
        {
          timeoutMs: 25_000,
        },
      );

      if (!mounted.current) return;

      setManual(null);
      setObservedPrice("");
      setObservedAt("");
      setMessage(
        response.alreadySettled
          ? "The selected horizon was already settled."
          : "The observed outcome was stored with probability, calibration, interval, direction, and return-error metrics.",
      );
      await load(true);
    } catch (caught) {
      if (isAbortError(caught) || !mounted.current) return;

      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to store the observed outcome.",
      );
    } finally {
      if (mounted.current) setSettling(false);
    }
  }

  const calibration = data?.calibration.overall;
  const latestRun = data?.runs[0] ?? null;
  const dueHorizons = useMemo(
    () =>
      (data?.runs ?? []).flatMap((run) =>
        run.horizons
          .filter(
            (horizon) =>
              horizon.status === "Pending" &&
              Date.parse(horizon.targetAt) <= Date.now(),
          )
          .map((horizon) => ({
            run,
            horizon,
          })),
      ),
    [data],
  );

  return (
    <IntelligencePage>
      <IntelligenceSurface className="overflow-hidden">
        <div className="bg-[radial-gradient(circle_at_8%_0%,rgba(16,185,129,0.12),transparent_34%),radial-gradient(circle_at_95%_8%,rgba(245,158,11,0.08),transparent_34%)] p-5 sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-5xl">
              <OperatingMemoryPills
                memory={data?.memory ?? null}
                online={online}
                busy={loading || settling}
              >
                <IntelligencePill tone="emerald">
                  <History className="h-3.5 w-3.5" />
                  Outcomes and accuracy
                </IntelligencePill>
              </OperatingMemoryPills>

              <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] text-[var(--slice-heading)] sm:text-5xl xl:text-6xl">
                Forecast history tied to observed market outcomes.
              </h1>
              <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-[var(--slice-muted)] sm:text-base">
                Slice retains forecast runs, horizon targets, observed prices,
                realized returns, calibration error, interval coverage, and
                directional accuracy. The operating view is bounded to a
                durable 30-day memory window and refreshes only while visible.
              </p>
            </div>

            <Link
              href="/workspace/intelligence"
              prefetch={false}
              className="inline-flex min-h-11 shrink-0 items-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 text-xs font-black text-[var(--slice-text)] transition hover:border-[var(--slice-accent-border)]"
            >
              <ArrowLeft className="h-4 w-4" />
              Control plane
            </Link>
          </div>

          <div className="mt-7 grid gap-3 xl:grid-cols-[minmax(260px,1fr)_auto_auto]">
            <form
              onSubmit={applyFilter}
              className="flex min-h-14 items-center rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 shadow-sm"
            >
              <Search className="h-5 w-5 text-[var(--slice-accent-strong)]" />
              <input
                value={symbolInput}
                onChange={(event: ChangeEvent<HTMLInputElement>) =>
                  setSymbolInput(
                    cleanIntelligenceSymbol(event.target.value),
                  )
                }
                placeholder="All symbols or enter MSFT"
                className="min-w-0 flex-1 bg-transparent px-4 text-sm font-black uppercase tracking-[0.1em] text-[var(--slice-heading)] outline-none placeholder:normal-case placeholder:tracking-normal placeholder:text-[var(--slice-subtle)]"
              />
              <button
                type="submit"
                disabled={loading}
                className="rounded-xl bg-[var(--slice-accent-strong)] px-4 py-2 text-[11px] font-black text-white disabled:opacity-50"
              >
                Apply
              </button>
            </form>

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || settling}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-5 text-sm font-black text-[var(--slice-text)] shadow-sm transition hover:border-[var(--slice-accent-border)] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh outcomes
            </button>

            <IntelligencePill tone="cyan" className="min-h-14 justify-center rounded-2xl px-5">
              <Clock3 className="h-4 w-4" />
              Automatic settlement {data?.automaticSettlement.cadence ?? "every 10 minutes"}
            </IntelligencePill>
          </div>

          <IntelligenceNotice
            className="mt-4"
            tone={error ? "rose" : data ? "emerald" : "slate"}
            icon={
              error ? (
                <AlertTriangle className="h-5 w-5" />
              ) : data ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <RefreshCw className="h-5 w-5 animate-spin" />
              )
            }
          >
            {error || message}
          </IntelligenceNotice>
        </div>
      </IntelligenceSurface>

      {data && calibration ? (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
            <IntelligenceMetric
              label="Forecast runs"
              value={formatIntelligenceInteger(data.summary.totalRuns)}
              helper={data.window.label}
              icon={<History className="h-5 w-5" />}
            />
            <IntelligenceMetric
              label="Pending horizons"
              value={formatIntelligenceInteger(data.summary.pendingHorizons)}
              helper={`${data.summary.dueHorizons.toLocaleString()} currently due.`}
              icon={<Clock3 className="h-5 w-5" />}
              tone={data.summary.dueHorizons ? "amber" : "emerald"}
            />
            <IntelligenceMetric
              label="Settled horizons"
              value={formatIntelligenceInteger(data.summary.settledHorizons)}
              helper={`${data.summary.settledOutcomes.toLocaleString()} outcomes retained.`}
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <IntelligenceMetric
              label="Directional accuracy"
              value={`${formatIntelligenceNumber(
                calibration.directionalAccuracyPercent,
                1,
              )}%`}
              helper="Observed direction versus forecast."
              icon={<TrendingUp className="h-5 w-5" />}
              tone={
                calibration.directionalAccuracyPercent >= 52
                  ? "emerald"
                  : "amber"
              }
            />
            <IntelligenceMetric
              label="Interval coverage"
              value={`${formatIntelligenceNumber(
                calibration.intervalCoveragePercent,
                1,
              )}%`}
              helper="Observed price inside forecast range."
              icon={<Target className="h-5 w-5" />}
              tone={
                calibration.intervalCoveragePercent >= 65 &&
                calibration.intervalCoveragePercent <= 95
                  ? "emerald"
                  : "amber"
              }
            />
            <IntelligenceMetric
              label="Brier score"
              value={formatIntelligenceNumber(calibration.brierScore, 4)}
              helper="Probability error; lower is better."
              icon={<Gauge className="h-5 w-5" />}
              tone={
                calibration.brierScore > 0 &&
                calibration.brierScore <= 0.245
                  ? "emerald"
                  : "amber"
              }
            />
            <IntelligenceMetric
              label="Log loss"
              value={formatIntelligenceNumber(calibration.logLoss, 4)}
              helper="Confidence-sensitive probability error."
              icon={<BarChart3 className="h-5 w-5" />}
              tone={
                calibration.logLoss > 0 && calibration.logLoss <= 0.72
                  ? "emerald"
                  : "amber"
              }
            />
            <IntelligenceMetric
              label="Return MAE"
              value={formatIntelligencePercent(
                calibration.meanAbsoluteReturnError,
                2,
              )}
              helper="Expected versus realized return."
              icon={<Database className="h-5 w-5" />}
              tone="cyan"
            />
          </section>

          <section className="mt-5 grid gap-5 xl:grid-cols-[0.82fr_1.18fr]">
            <IntelligenceSurface className="p-5 sm:p-6">
              <IntelligenceSectionHeading
                eyebrow="Reliability"
                title="Probability calibration"
                description="Each bin compares average forecast probability with the observed positive-outcome rate."
              />
              <div className="mt-5 space-y-3">
                {data.calibration.reliability.map((bin) => (
                  <div
                    key={bin.minimumProbability}
                    className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-xs font-black text-[var(--slice-heading)]">
                        {bin.minimumProbability}–{Math.round(bin.maximumProbability)}%
                      </p>
                      <p className="text-[10px] font-black text-[var(--slice-muted)]">
                        {bin.sampleCount} samples
                      </p>
                    </div>
                    <div className="mt-3 grid gap-2">
                      <div>
                        <div className="flex justify-between text-[9px] font-bold text-[var(--slice-subtle)]">
                          <span>Forecast</span>
                          <span>
                            {formatIntelligenceNumber(
                              bin.averageForecastProbability,
                              1,
                            )}
                            %
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--slice-slate-bg)]">
                          <div
                            className="h-full rounded-full bg-cyan-600"
                            style={{
                              width: reliabilityWidth(
                                bin.averageForecastProbability,
                              ),
                            }}
                          />
                        </div>
                      </div>
                      <div>
                        <div className="flex justify-between text-[9px] font-bold text-[var(--slice-subtle)]">
                          <span>Observed</span>
                          <span>
                            {formatIntelligenceNumber(
                              bin.observedPositivePercent,
                              1,
                            )}
                            %
                          </span>
                        </div>
                        <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--slice-slate-bg)]">
                          <div
                            className="h-full rounded-full bg-emerald-600"
                            style={{
                              width: reliabilityWidth(
                                bin.observedPositivePercent,
                              ),
                            }}
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </IntelligenceSurface>

            <IntelligenceSurface className="p-5 sm:p-6">
              <IntelligenceSectionHeading
                eyebrow="Automatic outcome pipeline"
                title="How due forecasts are settled"
                description="Slice prefers verified stored or historical prices. Manual entry remains an explicit advisor override for exceptional cases."
              />

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                {data.automaticSettlement.providerOrder.map(
                  (step, index) => (
                    <div
                      key={step}
                      className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4"
                    >
                      <span className="grid h-9 w-9 place-items-center rounded-xl border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-sm font-black text-[var(--slice-accent-strong)]">
                        {index + 1}
                      </span>
                      <p className="mt-3 text-xs font-black leading-5 text-[var(--slice-heading)]">
                        {step}
                      </p>
                    </div>
                  ),
                )}
              </div>

              <div className="mt-4 grid gap-3 sm:grid-cols-2">
                <IntelligenceNotice
                  tone="emerald"
                  icon={<ShieldCheck className="h-4 w-4" />}
                >
                  Demo prices are never accepted for settlement or validation.
                </IntelligenceNotice>
                <IntelligenceNotice
                  tone="emerald"
                  icon={<Clock3 className="h-4 w-4" />}
                >
                  Provider timestamps are preserved and pre-target observations
                  are rejected.
                </IntelligenceNotice>
              </div>

              {dueHorizons.length ? (
                <div className="mt-5">
                  <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">
                    Due horizons requiring review
                  </p>
                  <div className="mt-3 space-y-2">
                    {dueHorizons.slice(0, 8).map(({ run, horizon }) => (
                      <div
                        key={horizon.id}
                        className="flex flex-col gap-3 rounded-xl border border-amber-600/20 bg-amber-50 p-3 sm:flex-row sm:items-center sm:justify-between dark:border-amber-400/20 dark:bg-amber-500/[0.07]"
                      >
                        <div>
                          <p className="text-xs font-black text-amber-950 dark:text-amber-100">
                            {run.symbol} · {horizon.label}
                          </p>
                          <p className="mt-1 text-[9px] font-semibold text-amber-900/70 dark:text-amber-100/70">
                            Due {formatIntelligenceDate(horizon.targetAt)}
                          </p>
                        </div>
                        <button
                          type="button"
                          onClick={() => openManualSettlement(run, horizon)}
                          className="min-h-9 rounded-xl border border-amber-700/20 bg-white px-3 text-[10px] font-black text-amber-900 dark:bg-transparent dark:text-amber-100"
                        >
                          Manual override
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <IntelligenceNotice className="mt-5" tone="slate">
                  No currently due horizon requires a manual review.
                </IntelligenceNotice>
              )}
            </IntelligenceSurface>
          </section>

          {manual ? (
            <IntelligenceSurface className="mt-5 p-5 sm:p-6">
              <IntelligenceSectionHeading
                eyebrow="Advisor override"
                title={`Record ${manual.symbol} ${manual.label} outcome`}
                description={`Target time ${formatIntelligenceDate(
                  manual.targetAt,
                )}. Initial price ${formatIntelligenceCurrency(
                  manual.initialPrice,
                )}. Automatic settlement remains preferred.`}
              />
              <form
                onSubmit={submitSettlement}
                className="mt-5 grid gap-3 lg:grid-cols-[1fr_1fr_1.2fr_auto_auto]"
              >
                <label className="grid gap-1 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 py-2">
                  <span className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                    Observed price
                  </span>
                  <input
                    type="number"
                    min="0.0001"
                    step="any"
                    required
                    value={observedPrice}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setObservedPrice(event.target.value)
                    }
                    className="bg-transparent text-sm font-black text-[var(--slice-heading)] outline-none"
                  />
                </label>
                <label className="grid gap-1 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 py-2">
                  <span className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                    Observed time
                  </span>
                  <input
                    type="datetime-local"
                    value={observedAt}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setObservedAt(event.target.value)
                    }
                    className="bg-transparent text-sm font-black text-[var(--slice-heading)] outline-none"
                  />
                </label>
                <label className="grid gap-1 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 py-2">
                  <span className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                    Source description
                  </span>
                  <input
                    value={provider}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setProvider(event.target.value.slice(0, 120))
                    }
                    className="bg-transparent text-sm font-black text-[var(--slice-heading)] outline-none"
                  />
                </label>
                <button
                  type="button"
                  onClick={() => setManual(null)}
                  className="min-h-12 rounded-xl border border-[var(--slice-border)] px-4 text-xs font-black text-[var(--slice-muted)]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={settling || !online}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-[var(--slice-accent-strong)] px-4 text-xs font-black text-white disabled:opacity-50"
                >
                  {settling ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Save className="h-4 w-4" />
                  )}
                  Store outcome
                </button>
              </form>
            </IntelligenceSurface>
          ) : null}

          <IntelligenceSurface className="mt-5 p-5 sm:p-6">
            <IntelligenceSectionHeading
              eyebrow="Retained forecast runs"
              title="Forecasts and horizon outcomes"
              description="Each run preserves its source time, model versions, quality, simulation count, target times, predictions, observed outcomes, and settlement provider."
              action={
                latestRun ? (
                  <IntelligencePill tone={statusTone(latestRun.status)}>
                    Latest {formatIntelligenceDate(latestRun.generatedAt)}
                  </IntelligencePill>
                ) : null
              }
            />

            <div className="mt-5 space-y-4">
              {data.runs.map((run) => (
                <details
                  key={run.id}
                  className="group rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4 open:shadow-sm"
                >
                  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <IntelligencePill tone={statusTone(run.status)}>
                            {run.status}
                          </IntelligencePill>
                          <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                            {formatIntelligenceDate(run.generatedAt)}
                          </span>
                        </div>
                        <h3 className="mt-3 text-xl font-black text-[var(--slice-heading)]">
                          {run.symbol} · Slice score{" "}
                          {formatIntelligenceNumber(
                            run.sliceSentimentScore,
                            1,
                          )}
                        </h3>
                        <p className="mt-1 text-[10px] font-semibold text-[var(--slice-muted)]">
                          Provider as of {formatIntelligenceDate(run.asOfAt)} ·{" "}
                          {run.marketRegime} · {run.modelVersion}
                        </p>
                      </div>
                      <div className="grid grid-cols-3 gap-2 text-center lg:w-[23rem]">
                        {[
                          ["Quality", `${formatIntelligenceNumber(run.dataQualityScore, 0)}%`],
                          ["Sources", run.independentSourceCount],
                          ["Paths", run.simulationPaths],
                        ].map(([label, value]) => (
                          <div
                            key={String(label)}
                            className="rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-3"
                          >
                            <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                              {label}
                            </p>
                            <p className="mt-1 text-sm font-black text-[var(--slice-heading)]">
                              {value}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </summary>

                  <div className="mt-5 grid gap-3 xl:grid-cols-2">
                    {run.horizons.map((horizon) => (
                      <article
                        key={horizon.id}
                        className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <IntelligencePill tone={statusTone(horizon.status)}>
                              {horizon.status}
                            </IntelligencePill>
                            <h4 className="mt-3 text-base font-black text-[var(--slice-heading)]">
                              {horizon.label}
                            </h4>
                            <p className="mt-1 text-[9px] font-semibold text-[var(--slice-muted)]">
                              Target {formatIntelligenceDate(horizon.targetAt)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className="text-lg font-black text-[var(--slice-heading)]">
                              {formatIntelligenceNumber(
                                horizon.positiveReturnProbability,
                                1,
                              )}
                              %
                            </p>
                            <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                              Probability positive
                            </p>
                          </div>
                        </div>

                        <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                          {[
                            [
                              "Expected",
                              formatIntelligencePercent(
                                horizon.expectedReturnPercent,
                                2,
                              ),
                            ],
                            [
                              "Price",
                              formatIntelligenceCurrency(
                                horizon.expectedPrice,
                              ),
                            ],
                            [
                              "Confidence",
                              `${formatIntelligenceNumber(
                                horizon.confidence,
                                0,
                              )}%`,
                            ],
                          ].map(([label, value]) => (
                            <div
                              key={String(label)}
                              className="rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-2.5"
                            >
                              <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                                {label}
                              </p>
                              <p className="mt-1 text-xs font-black text-[var(--slice-heading)]">
                                {value}
                              </p>
                            </div>
                          ))}
                        </div>

                        {horizon.outcome ? (
                          <div className="mt-4 rounded-xl border border-emerald-600/15 bg-emerald-50 p-3 dark:border-emerald-400/20 dark:bg-emerald-500/[0.07]">
                            <div className="flex items-center justify-between gap-3">
                              <p className="text-xs font-black text-emerald-950 dark:text-emerald-100">
                                Observed{" "}
                                {formatIntelligenceCurrency(
                                  horizon.outcome.observedPrice,
                                )}
                              </p>
                              <span className="text-xs font-black text-emerald-800 dark:text-emerald-200">
                                {formatIntelligencePercent(
                                  horizon.outcome.realizedReturnPercent,
                                  2,
                                )}
                              </span>
                            </div>
                            <p className="mt-2 text-[9px] font-semibold leading-4 text-emerald-900/75 dark:text-emerald-100/75">
                              {horizon.outcome.priceProvider} ·{" "}
                              {formatIntelligenceDate(
                                horizon.outcome.observedAt,
                              )}{" "}
                              · Brier{" "}
                              {formatIntelligenceNumber(
                                horizon.outcome.brierScore,
                                4,
                              )}{" "}
                              · Direction{" "}
                              {horizon.outcome.directionalCorrect
                                ? "correct"
                                : "incorrect"}
                            </p>
                          </div>
                        ) : (
                          <div className="mt-4 flex items-center justify-between gap-3 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-3">
                            <p className="text-[10px] font-semibold text-[var(--slice-muted)]">
                              Awaiting a valid post-target market observation.
                            </p>
                            {Date.parse(horizon.targetAt) <= Date.now() ? (
                              <button
                                type="button"
                                onClick={() =>
                                  openManualSettlement(run, horizon)
                                }
                                className="shrink-0 rounded-lg border border-[var(--slice-border)] px-3 py-2 text-[9px] font-black text-[var(--slice-heading)]"
                              >
                                Manual override
                              </button>
                            ) : null}
                          </div>
                        )}
                      </article>
                    ))}
                  </div>
                </details>
              ))}

              {!data.runs.length ? (
                <IntelligenceNotice tone="slate">
                  No forecast runs are stored in the selected operating-memory
                  window.
                </IntelligenceNotice>
              ) : null}
            </div>
          </IntelligenceSurface>
        </>
      ) : null}

      {loading && !data ? (
        <IntelligenceSurface className="mt-5 p-8">
          <div className="grid min-h-64 place-items-center text-center">
            <div>
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-[var(--slice-accent-strong)]" />
              <p className="mt-3 text-sm font-black text-[var(--slice-heading)]">
                Loading forecast memory and accuracy
              </p>
            </div>
          </div>
        </IntelligenceSurface>
      ) : null}
    </IntelligencePage>
  );
}