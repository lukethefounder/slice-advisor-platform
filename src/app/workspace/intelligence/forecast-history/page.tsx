"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Outcome = {
  id: string;
  observedAt: string;
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

type Horizon = {
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
  outcome: Outcome | null;
};

type ForecastRun = {
  id: string;
  requestId: string;
  symbol: string;
  generatedAt: string;
  modelVersion: string;
  marketRegime: string;
  sliceSentimentScore: number;
  dataQualityScore: number;
  sourceCount: number;
  simulationPaths: number;
  camelStatus: string;
  camelWorkforceMode: string;
  status: string;
  horizons: Horizon[];
};

type HistoryResponse = {
  ok: boolean;
  summary: {
    totalRuns: number;
    returnedRuns: number;
    pendingHorizons: number;
    settledHorizons: number;
  };
  runs: ForecastRun[];
  error?: string;
};

type Metric = {
  horizon: string;
  sampleCount: number;
  brierScore: number;
  logLoss: number;
  intervalCoveragePercent: number;
  directionalAccuracyPercent: number;
  meanAbsoluteReturnError: number;
};

type CalibrationResponse = {
  ok: boolean;
  overall: {
    sampleCount: number;
    brierScore: number;
    logLoss: number;
    intervalCoveragePercent: number;
    directionalAccuracyPercent: number;
    meanAbsoluteReturnError: number;
  };
  byHorizon: Metric[];
  reliability: Array<{
    minimumProbability: number;
    maximumProbability: number;
    sampleCount: number;
    averageForecastProbability: number;
    observedPositivePercent: number;
  }>;
  error?: string;
};

function number(
  value: number,
  decimals = 2,
) {
  return Number.isFinite(value)
    ? value.toFixed(decimals)
    : "—";
}

function signedPercent(
  value: number,
) {
  return `${
    value > 0 ? "+" : ""
  }${number(value)}%`;
}

function dateTime(
  value: string,
) {
  const parsed =
    new Date(value);

  return Number.isFinite(
    parsed.getTime(),
  )
    ? parsed.toLocaleString()
    : value;
}

function statusClass(
  status: string,
) {
  const normalized =
    status.toLowerCase();

  if (
    normalized.includes(
      "settled",
    ) &&
    !normalized.includes(
      "partially",
    )
  ) {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
  }

  if (
    normalized.includes(
      "partial",
    )
  ) {
    return "border-amber-400/25 bg-amber-500/10 text-amber-100";
  }

  return "border-slate-400/20 bg-white/[0.04] text-slate-300";
}

export default function ForecastHistoryPage() {
  const [
    symbolInput,
    setSymbolInput,
  ] = useState("");

  const [
    activeSymbol,
    setActiveSymbol,
  ] = useState("");

  const [
    history,
    setHistory,
  ] =
    useState<HistoryResponse | null>(
      null,
    );

  const [
    calibration,
    setCalibration,
  ] =
    useState<CalibrationResponse | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] = useState(true);

  const [
    error,
    setError,
  ] =
    useState<string | null>(
      null,
    );

  const loadData =
    useCallback(async () => {
      setLoading(true);
      setError(null);

      try {
        const query =
          activeSymbol
            ? `?symbol=${encodeURIComponent(
                activeSymbol,
              )}&limit=50`
            : "?limit=50";

        const [
          historyResponse,
          calibrationResponse,
        ] = await Promise.all([
          fetch(
            `/api/intelligence/forecast/history${query}`,
            {
              cache:
                "no-store",
            },
          ),

          fetch(
            "/api/intelligence/forecast/calibration",
            {
              cache:
                "no-store",
            },
          ),
        ]);

        const historyBody =
          (await historyResponse.json()) as HistoryResponse;

        const calibrationBody =
          (await calibrationResponse.json()) as CalibrationResponse;

        if (
          !historyResponse.ok
        ) {
          throw new Error(
            historyBody.error ??
              "Unable to load forecast history.",
          );
        }

        if (
          !calibrationResponse.ok
        ) {
          throw new Error(
            calibrationBody.error ??
              "Unable to load calibration metrics.",
          );
        }

        setHistory(
          historyBody,
        );

        setCalibration(
          calibrationBody,
        );
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Unable to load forecast records.",
        );
      } finally {
        setLoading(false);
      }
    }, [activeSymbol]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  async function manuallySettle(
    horizon: Horizon,
  ) {
    const rawPrice =
      window.prompt(
        `Enter the observed price for ${horizon.label}:`,
      );

    if (
      rawPrice === null
    ) {
      return;
    }

    const observedPrice =
      Number(rawPrice);

    if (
      !Number.isFinite(
        observedPrice,
      ) ||
      observedPrice <= 0
    ) {
      window.alert(
        "Enter a valid price greater than zero.",
      );

      return;
    }

    const response =
      await fetch(
        "/api/intelligence/forecast/outcomes",
        {
          method: "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            forecastHorizonId:
              horizon.id,
            observedPrice,
            provider:
              "Advisor manual observation",
          }),
        },
      );

    const body =
      (await response.json()) as {
        error?: string;
        detail?: string;
      };

    if (!response.ok) {
      window.alert(
        body.detail ??
          body.error ??
          "Unable to settle forecast.",
      );

      return;
    }

    await loadData();
  }

  function applyFilter() {
    setActiveSymbol(
      symbolInput
        .trim()
        .toUpperCase(),
    );
  }

  const overall =
    calibration?.overall;

  return (
    <main className="mx-auto min-h-screen max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-red-500/15 bg-gradient-to-br from-red-950/30 via-black to-black p-6 shadow-2xl shadow-red-950/20 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300">
          Slice Forecast Accountability
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
          History &amp; Accuracy
        </h1>

        <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-400">
          Point-in-time forecasts, realized outcomes, probability
          calibration, interval coverage, and directional accuracy.
          Simulation and CAMEL outputs remain decision-support evidence,
          not guaranteed outcomes or autonomous trade instructions.
        </p>

        <div className="mt-6 flex flex-wrap gap-3">
          <input
            value={symbolInput}
            onChange={(event) =>
              setSymbolInput(
                event.target.value,
              )
            }
            onKeyDown={(event) => {
              if (
                event.key ===
                "Enter"
              ) {
                applyFilter();
              }
            }}
            placeholder="Filter by ticker"
            className="w-52 rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm font-bold text-white outline-none transition placeholder:text-slate-600 focus:border-red-400/40"
          />

          <button
            type="button"
            onClick={applyFilter}
            className="rounded-xl border border-red-400/25 bg-red-500/15 px-5 py-3 text-sm font-black text-red-100 transition hover:bg-red-500/25"
          >
            Apply Filter
          </button>

          <button
            type="button"
            onClick={() => {
              setSymbolInput("");
              setActiveSymbol("");
            }}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-300 transition hover:bg-white/[0.08]"
          >
            Clear
          </button>

          <button
            type="button"
            onClick={() =>
              void loadData()
            }
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-300 transition hover:bg-white/[0.08]"
          >
            Refresh
          </button>
        </div>
      </section>

      {error ? (
        <div className="mt-6 rounded-2xl border border-red-400/25 bg-red-500/10 p-5 text-sm text-red-100">
          {error}
        </div>
      ) : null}

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
        {[
          {
            label:
              "Forecast Runs",
            value:
              history?.summary
                .totalRuns ?? 0,
          },
          {
            label:
              "Settled Horizons",
            value:
              history?.summary
                .settledHorizons ??
              0,
          },
          {
            label:
              "Pending Horizons",
            value:
              history?.summary
                .pendingHorizons ??
              0,
          },
          {
            label:
              "Directional Accuracy",
            value:
              overall
                ? `${number(
                    overall.directionalAccuracyPercent,
                  )}%`
                : "—",
          },
          {
            label:
              "Interval Coverage",
            value:
              overall
                ? `${number(
                    overall.intervalCoveragePercent,
                  )}%`
                : "—",
          },
          {
            label:
              "Brier Score",
            value:
              overall
                ? number(
                    overall.brierScore,
                    4,
                  )
                : "—",
          },
        ].map((metric) => (
          <div
            key={metric.label}
            className="rounded-2xl border border-white/8 bg-white/[0.035] p-5"
          >
            <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
              {metric.label}
            </div>

            <div className="mt-3 text-2xl font-black text-white">
              {metric.value}
            </div>
          </div>
        ))}
      </section>

      <section className="mt-6 rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
        <h2 className="text-xl font-black text-white">
          Probability Reliability
        </h2>

        <p className="mt-2 text-sm text-slate-500">
          Forecast probability compared with the actual rate of positive outcomes.
        </p>

        <div className="mt-5 grid gap-3">
          {(calibration?.reliability ?? [])
            .filter(
              (bin) =>
                bin.sampleCount >
                0,
            )
            .map((bin) => (
              <div
                key={`${bin.minimumProbability}-${bin.maximumProbability}`}
                className="rounded-xl border border-white/8 bg-black/35 p-4"
              >
                <div className="flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="font-black text-slate-200">
                    {bin.minimumProbability}–{Math.round(
                      bin.maximumProbability,
                    )}% probability
                  </span>

                  <span className="text-slate-500">
                    {bin.sampleCount} observations
                  </span>
                </div>

                <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/5">
                  <div
                    className="h-full rounded-full bg-red-500"
                    style={{
                      width: `${Math.max(
                        0,
                        Math.min(
                          100,
                          bin.observedPositivePercent,
                        ),
                      )}%`,
                    }}
                  />
                </div>

                <div className="mt-2 flex justify-between text-[11px] text-slate-500">
                  <span>
                    Forecast average:{" "}
                    {number(
                      bin.averageForecastProbability,
                    )}
                    %
                  </span>

                  <span>
                    Observed positive:{" "}
                    {number(
                      bin.observedPositivePercent,
                    )}
                    %
                  </span>
                </div>
              </div>
            ))}

          {!calibration?.overall.sampleCount ? (
            <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
              Reliability metrics will appear after forecast horizons are settled.
            </div>
          ) : null}
        </div>
      </section>

      <section className="mt-6 space-y-5">
        {loading ? (
          <div className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-10 text-center text-sm text-slate-500">
            Loading forecast history…
          </div>
        ) : null}

        {!loading &&
        !history?.runs.length ? (
          <div className="rounded-[2rem] border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
            No stored forecasts match this filter.
          </div>
        ) : null}

        {(history?.runs ?? []).map(
          (run) => (
            <article
              key={run.id}
              className="overflow-hidden rounded-[2rem] border border-white/8 bg-white/[0.025]"
            >
              <header className="flex flex-wrap items-start justify-between gap-4 border-b border-white/8 p-6">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-black text-white">
                      {run.symbol}
                    </h2>

                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ${statusClass(
                        run.status,
                      )}`}
                    >
                      {run.status}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Generated {dateTime(
                      run.generatedAt,
                    )} · {run.modelVersion}
                  </p>
                </div>

                <div className="grid grid-cols-2 gap-4 text-right text-xs">
                  <div>
                    <div className="text-slate-600">
                      Slice Score
                    </div>
                    <div className="mt-1 font-black text-white">
                      {number(
                        run.sliceSentimentScore,
                      )}
                    </div>
                  </div>

                  <div>
                    <div className="text-slate-600">
                      CAMEL
                    </div>
                    <div className="mt-1 font-black text-white">
                      {run.camelStatus}
                    </div>
                  </div>
                </div>
              </header>

              <div className="overflow-x-auto">
                <table className="min-w-[1100px] w-full text-left text-xs">
                  <thead className="bg-black/30 text-[10px] uppercase tracking-[0.12em] text-slate-600">
                    <tr>
                      <th className="px-5 py-4">
                        Horizon
                      </th>
                      <th className="px-5 py-4">
                        Target
                      </th>
                      <th className="px-5 py-4">
                        Direction
                      </th>
                      <th className="px-5 py-4">
                        Positive Probability
                      </th>
                      <th className="px-5 py-4">
                        Expected Return
                      </th>
                      <th className="px-5 py-4">
                        Observed Return
                      </th>
                      <th className="px-5 py-4">
                        Accuracy
                      </th>
                      <th className="px-5 py-4">
                        Action
                      </th>
                    </tr>
                  </thead>

                  <tbody>
                    {run.horizons.map(
                      (horizon) => {
                        const due =
                          new Date(
                            horizon.targetAt,
                          ).getTime() <=
                          Date.now();

                        return (
                          <tr
                            key={horizon.id}
                            className="border-t border-white/6"
                          >
                            <td className="px-5 py-4">
                              <div className="font-black text-white">
                                {horizon.label}
                              </div>
                              <div className="mt-1 text-slate-600">
                                {horizon.horizon}
                              </div>
                            </td>

                            <td className="px-5 py-4 text-slate-400">
                              {dateTime(
                                horizon.targetAt,
                              )}
                            </td>

                            <td className="px-5 py-4 font-bold text-slate-200">
                              {horizon.direction}
                            </td>

                            <td className="px-5 py-4 text-slate-300">
                              {number(
                                horizon.positiveReturnProbability,
                              )}
                              %
                            </td>

                            <td className="px-5 py-4 text-slate-300">
                              {signedPercent(
                                horizon.expectedReturnPercent,
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {horizon.outcome ? (
                                <div>
                                  <div className="font-black text-white">
                                    {signedPercent(
                                      horizon.outcome.realizedReturnPercent,
                                    )}
                                  </div>
                                  <div className="mt-1 text-slate-600">
                                    ${number(
                                      horizon.outcome.observedPrice,
                                    )} via{" "}
                                    {horizon.outcome.priceProvider}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-600">
                                  Pending
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {horizon.outcome ? (
                                <div className="space-y-1">
                                  <div
                                    className={
                                      horizon.outcome.directionalCorrect
                                        ? "text-emerald-300"
                                        : "text-red-300"
                                    }
                                  >
                                    Direction{" "}
                                    {horizon.outcome.directionalCorrect
                                      ? "correct"
                                      : "incorrect"}
                                  </div>

                                  <div
                                    className={
                                      horizon.outcome.intervalCovered
                                        ? "text-emerald-300"
                                        : "text-amber-300"
                                    }
                                  >
                                    Range{" "}
                                    {horizon.outcome.intervalCovered
                                      ? "covered"
                                      : "missed"}
                                  </div>

                                  <div className="text-slate-600">
                                    Brier{" "}
                                    {number(
                                      horizon.outcome.brierScore,
                                      4,
                                    )}
                                  </div>
                                </div>
                              ) : (
                                <span className="text-slate-600">
                                  —
                                </span>
                              )}
                            </td>

                            <td className="px-5 py-4">
                              {!horizon.outcome ? (
                                <button
                                  type="button"
                                  disabled={!due}
                                  onClick={() =>
                                    void manuallySettle(
                                      horizon,
                                    )
                                  }
                                  className="rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 font-black text-red-100 transition enabled:hover:bg-red-500/20 disabled:cursor-not-allowed disabled:opacity-35"
                                >
                                  {due
                                    ? "Settle Price"
                                    : "Not Due"}
                                </button>
                              ) : (
                                <span className="font-black text-emerald-300">
                                  Settled
                                </span>
                              )}
                            </td>
                          </tr>
                        );
                      },
                    )}
                  </tbody>
                </table>
              </div>
            </article>
          ),
        )}
      </section>
    </main>
  );
}