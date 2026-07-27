"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Category = {
  sourceName: string;
  present: boolean;
  required: boolean;
  qualityScore: number;
  liveStatus: string;
  freshnessStatus: string;
  fallbackUsed: boolean;
  stale: boolean;
  futureTimestampCount: number;
  asOfAt: string | null;
  warnings: string[];
  status:
    | "Validated"
    | "Needs Review";
  materialized: boolean;
  materializedStatus:
    | string
    | null;
  lastCheckedAt:
    | string
    | null;
};

type WarehouseRun = {
  id: string;
  requestId: string;
  symbol: string;
  asOfAt: string;
  generatedAt: string;
  engineVersion: string;
  modelVersion: string;
  calibrationVersion: string;
  marketRegime: string;
  forecastStatus: string;
  warehouseStatus: string;
  warehouseCheckedAt:
    | string
    | null;
  pointInTimeSafe: boolean;
  integrityScore: number;
  timestampCount: number;
  futureEvidenceCount: number;
  futureEvidencePaths: string[];
  missingRequiredCategories: string[];
  fallbackCategories: string[];
  staleCategories: string[];
  earliestEvidenceAt:
    | string
    | null;
  latestEvidenceAt:
    | string
    | null;
  warnings: string[];
  categories: Category[];
};

type WarehouseResponse = {
  ok: boolean;
  generatedAt: string;
  filters: {
    symbol:
      | string
      | null;
    limit: number;
  };
  summary: {
    totalRuns: number;
    coverageScopeCount: number;
    coverageCapped: boolean;
    auditedRuns: number;
    notAuditedRuns: number;
    validatedRuns: number;
    needsReviewRuns: number;
    coveragePercent: number;
    recentPointInTimeSafe: number;
    recentNeedsReview: number;
    recentAverageIntegrityScore: number;
  };
  safeguards: {
    autonomousTradingEnabled: boolean;
    futureDatedEvidenceAccepted: boolean;
    demoEvidencePromotedToTruth: boolean;
    humanReviewRequiredForViolations: boolean;
  };
  runs: WarehouseRun[];
  error?: string;
};

function number(
  value: number,
  decimals = 1,
) {
  return Number.isFinite(
    value,
  )
    ? value.toFixed(
        decimals,
      )
    : "—";
}

function dateTime(
  value:
    | string
    | null,
) {
  if (!value) {
    return "—";
  }

  const parsed =
    new Date(
      value,
    );

  return Number.isFinite(
    parsed.getTime(),
  )
    ? parsed.toLocaleString()
    : value;
}

function runStatusClass(
  run: WarehouseRun,
) {
  if (
    run.pointInTimeSafe &&
    run.integrityScore >=
      70
  ) {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
  }

  return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
}

function categoryStatusClass(
  category: Category,
) {
  if (
    category.status ===
    "Validated"
  ) {
    return "border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-100";
  }

  return "border-amber-400/20 bg-amber-500/[0.06] text-amber-100";
}

export default function DataWarehousePage() {
  const [
    symbolInput,
    setSymbolInput,
  ] =
    useState("");

  const [
    activeSymbol,
    setActiveSymbol,
  ] =
    useState("");

  const [
    data,
    setData,
  ] =
    useState<WarehouseResponse | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(true);

  const [
    activeAction,
    setActiveAction,
  ] =
    useState<string | null>(
      null,
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      "Loading point-in-time evidence warehouse.",
    );

  const loadWarehouse =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        try {
          const query =
            activeSymbol
              ? `?symbol=${encodeURIComponent(
                  activeSymbol,
                )}&limit=50`
              : "?limit=50";

          const response =
            await fetch(
              `/api/intelligence/forecast/warehouse${query}`,
              {
                cache:
                  "no-store",
              },
            );

          const body =
            (await response.json()) as WarehouseResponse;

          if (
            !response.ok
          ) {
            throw new Error(
              body.error ??
                "Unable to load the evidence warehouse.",
            );
          }

          setData(
            body,
          );

          setMessage(
            "Warehouse loaded. Future-dated evidence is never treated as valid point-in-time evidence.",
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load the evidence warehouse.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        activeSymbol,
      ],
    );

  useEffect(
    () => {
      void loadWarehouse();
    },
    [
      loadWarehouse,
    ],
  );

  async function auditBatch() {
    setActiveAction(
      "batch",
    );

    setMessage(
      "Auditing forecasts that do not yet have materialized evidence records.",
    );

    try {
      const response =
        await fetch(
          "/api/intelligence/forecast/warehouse",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  action:
                    "audit-batch",

                  limit:
                    50,

                  onlyMissing:
                    true,
                },
              ),
          },
        );

      const body =
        (await response.json()) as {
          error?: string;
          detail?: string;
          auditedCount?: number;
          failedCount?: number;
        };

      if (
        !response.ok
      ) {
        throw new Error(
          body.detail ??
            body.error ??
            "Batch audit failed.",
        );
      }

      setMessage(
        `Audited ${body.auditedCount ?? 0} forecast runs. ` +
          `${body.failedCount ?? 0} failed.`,
      );

      await loadWarehouse();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Batch audit failed.",
      );
    } finally {
      setActiveAction(
        null,
      );
    }
  }

  async function auditRun(
    runId: string,
  ) {
    setActiveAction(
      runId,
    );

    try {
      const response =
        await fetch(
          "/api/intelligence/forecast/warehouse",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify(
                {
                  action:
                    "audit-run",

                  runId,
                },
              ),
          },
        );

      const body =
        (await response.json()) as {
          error?: string;
          detail?: string;
        };

      if (
        !response.ok
      ) {
        throw new Error(
          body.detail ??
            body.error ??
            "Forecast evidence audit failed.",
        );
      }

      setMessage(
        "Forecast evidence audit completed.",
      );

      await loadWarehouse();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Forecast evidence audit failed.",
      );
    } finally {
      setActiveAction(
        null,
      );
    }
  }

  function applyFilter() {
    setActiveSymbol(
      symbolInput
        .trim()
        .toUpperCase(),
    );
  }

  const summary =
    data?.summary;

  return (
    <main className="mx-auto min-h-screen max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-emerald-500/15 bg-gradient-to-br from-emerald-950/30 via-black to-black p-6 shadow-2xl shadow-emerald-950/20 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-300">
          Slice Historical Data Integrity
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
          Point-in-Time Evidence Warehouse
        </h1>

        <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
          Inspect the exact evidence snapshot preserved with every
          forecast, detect missing or fallback inputs, identify
          timestamps that occur after forecast generation, and create
          materialized data-quality records for walk-forward validation.
        </p>

        <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
          {message}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <input
            value={
              symbolInput
            }
            onChange={(
              event,
            ) =>
              setSymbolInput(
                event
                  .target
                  .value,
              )
            }
            onKeyDown={(
              event,
            ) => {
              if (
                event.key ===
                "Enter"
              ) {
                applyFilter();
              }
            }}
            placeholder="Filter by ticker"
            className="w-52 rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40"
          />

          <button
            type="button"
            onClick={
              applyFilter
            }
            className="rounded-xl border border-emerald-400/25 bg-emerald-500/15 px-5 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-500/25"
          >
            Apply Filter
          </button>

          <button
            type="button"
            onClick={() => {
              setSymbolInput(
                "",
              );

              setActiveSymbol(
                "",
              );
            }}
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-300 hover:bg-white/[0.08]"
          >
            Clear
          </button>

          <button
            type="button"
            disabled={
              Boolean(
                activeAction,
              )
            }
            onClick={() =>
              void auditBatch()
            }
            className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-5 py-3 text-sm font-black text-emerald-100 disabled:opacity-40"
          >
            {activeAction ===
            "batch"
              ? "Auditing…"
              : "Audit Missing Records"}
          </button>

          <button
            type="button"
            onClick={() =>
              void loadWarehouse()
            }
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-300 hover:bg-white/[0.08]"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        {[
          {
            label:
              "Forecast Runs",

            value:
              summary
                ?.totalRuns ??
              0,
          },
          {
            label:
              "Warehouse Coverage",

            value:
              `${number(
                summary
                  ?.coveragePercent ??
                  0,
              )}%`,
          },
          {
            label:
              "Audited",

            value:
              summary
                ?.auditedRuns ??
              0,
          },
          {
            label:
              "Not Audited",

            value:
              summary
                ?.notAuditedRuns ??
              0,
          },
          {
            label:
              "Validated",

            value:
              summary
                ?.validatedRuns ??
              0,
          },
          {
            label:
              "Needs Review",

            value:
              summary
                ?.needsReviewRuns ??
              0,
          },
          {
            label:
              "Average Integrity",

            value:
              number(
                summary
                  ?.recentAverageIntegrityScore ??
                  0,
              ),
          },
        ].map(
          (metric) => (
            <div
              key={
                metric.label
              }
              className="rounded-2xl border border-white/8 bg-white/[0.035] p-5"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                {
                  metric.label
                }
              </div>

              <div className="mt-3 text-2xl font-black text-white">
                {
                  metric.value
                }
              </div>
            </div>
          ),
        )}
      </section>

      {loading ? (
        <div className="mt-6 rounded-[2rem] border border-white/8 p-10 text-center text-sm text-slate-500">
          Loading evidence warehouse…
        </div>
      ) : null}

      <section className="mt-6 space-y-5">
        {(data?.runs ?? []).map(
          (run) => (
            <article
              key={
                run.id
              }
              className="overflow-hidden rounded-[2rem] border border-white/8 bg-white/[0.025]"
            >
              <header className="flex flex-wrap items-start justify-between gap-5 border-b border-white/8 p-6">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-black text-white">
                      {
                        run.symbol
                      }
                    </h2>

                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.12em] ${runStatusClass(
                        run,
                      )}`}
                    >
                      {run.pointInTimeSafe
                        ? "Point-in-time safe"
                        : "Review required"}
                    </span>

                    <span className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[10px] font-black uppercase text-slate-300">
                      {
                        run.warehouseStatus
                      }
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    Generated{" "}
                    {dateTime(
                      run.generatedAt,
                    )}{" "}
                    ·{" "}
                    {
                      run.modelVersion
                    }{" "}
                    ·{" "}
                    {
                      run.marketRegime
                    }
                  </p>
                </div>

                <div className="flex items-center gap-4">
                  <div className="text-right">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                      Integrity
                    </div>

                    <div className="mt-1 text-3xl font-black text-white">
                      {number(
                        run.integrityScore,
                      )}
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={
                      Boolean(
                        activeAction,
                      )
                    }
                    onClick={() =>
                      void auditRun(
                        run.id,
                      )
                    }
                    className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100 disabled:opacity-40"
                  >
                    {activeAction ===
                    run.id
                      ? "Auditing…"
                      : "Audit Again"}
                  </button>
                </div>
              </header>

              <div className="grid gap-4 p-6 md:grid-cols-3 xl:grid-cols-6">
                {[
                  {
                    label:
                      "Evidence Timestamps",

                    value:
                      run.timestampCount,
                  },
                  {
                    label:
                      "Future Timestamps",

                    value:
                      run.futureEvidenceCount,
                  },
                  {
                    label:
                      "Missing Categories",

                    value:
                      run
                        .missingRequiredCategories
                        .length,
                  },
                  {
                    label:
                      "Fallback Categories",

                    value:
                      run
                        .fallbackCategories
                        .length,
                  },
                  {
                    label:
                      "Stale Categories",

                    value:
                      run
                        .staleCategories
                        .length,
                  },
                  {
                    label:
                      "Last Audit",

                    value:
                      dateTime(
                        run.warehouseCheckedAt,
                      ),
                  },
                ].map(
                  (metric) => (
                    <div
                      key={
                        metric.label
                      }
                      className="rounded-xl border border-white/8 bg-black/30 p-4"
                    >
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                        {
                          metric.label
                        }
                      </div>

                      <div className="mt-2 text-lg font-black text-white">
                        {
                          metric.value
                        }
                      </div>
                    </div>
                  ),
                )}
              </div>

              {run.warnings.length ? (
                <div className="mx-6 mb-6 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-4">
                  <div className="text-xs font-black uppercase tracking-[0.14em] text-amber-200">
                    Evidence warnings
                  </div>

                  <div className="mt-3 grid gap-2">
                    {run.warnings.map(
                      (
                        warning,
                      ) => (
                        <div
                          key={
                            warning
                          }
                          className="text-xs leading-5 text-amber-100"
                        >
                          •{" "}
                          {
                            warning
                          }
                        </div>
                      ),
                    )}
                  </div>
                </div>
              ) : null}

              <div className="grid gap-3 border-t border-white/8 p-6 md:grid-cols-2 xl:grid-cols-4">
                {run.categories.map(
                  (
                    category,
                  ) => (
                    <div
                      key={
                        category.sourceName
                      }
                      className={`rounded-xl border p-4 ${categoryStatusClass(
                        category,
                      )}`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="font-black">
                            {
                              category.sourceName
                            }
                          </div>

                          <div className="mt-1 text-[10px] uppercase tracking-[0.12em] opacity-70">
                            {
                              category.liveStatus
                            }{" "}
                            ·{" "}
                            {
                              category.freshnessStatus
                            }
                          </div>
                        </div>

                        <div className="text-xl font-black">
                          {number(
                            category.qualityScore,
                          )}
                        </div>
                      </div>

                      <div className="mt-3 text-[11px] opacity-75">
                        As of{" "}
                        {dateTime(
                          category.asOfAt,
                        )}
                      </div>

                      {category.warnings.length ? (
                        <div className="mt-3 space-y-1 text-[11px] leading-4 opacity-80">
                          {category.warnings
                            .slice(
                              0,
                              3,
                            )
                            .map(
                              (
                                warning,
                              ) => (
                                <div
                                  key={
                                    warning
                                  }
                                >
                                  •{" "}
                                  {
                                    warning
                                  }
                                </div>
                              ),
                            )}
                        </div>
                      ) : null}
                    </div>
                  ),
                )}
              </div>
            </article>
          ),
        )}

        {!loading &&
        !data?.runs.length ? (
          <div className="rounded-[2rem] border border-dashed border-white/10 p-10 text-center text-sm text-slate-500">
            No stored forecasts match this filter.
          </div>
        ) : null}
      </section>
    </main>
  );
}