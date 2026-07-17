"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type RecentRun = {
  runId: string;
  requestId: string;
  symbol: string;
  generatedAt: string;
  modelVersion: string;
  marketRegime: string;
  camelStatus: string;
  status: string;
  claimCount: number;
  contradictionCount: number;
  horizonCount: number;
  outcomeCount: number;
};

type GraphObject =
  Record<
    string,
    unknown
  >;

type ProvenancePath = {
  type: string;
  path: string[];
  status: string;
};

type GraphResponse = {
  ok: boolean;
  configured: boolean;
  connectivity: {
    ok: boolean;
    configured: boolean;
    enabled: boolean;
    database: string;
    address?: string;
    agent?: string;
    detail: string;
    missing?: string[];
  };
  counts: {
    assets: number;
    runs: number;
    models: number;
    evidence: number;
    horizons: number;
    outcomes: number;
    claims: number;
    contradictions: number;
  };
  recentRuns: RecentRun[];
  selectedRun: {
    run: GraphObject;
    asset: GraphObject;
    models: GraphObject[];
    evidence: GraphObject[];
    horizons: GraphObject[];
    outcomes: GraphObject[];
    claims: GraphObject[];
    contradictions: GraphObject[];
  } | null;
  provenancePaths: ProvenancePath[];
  error?: string;
};

function text(
  value: unknown,
) {
  return String(
    value ?? "",
  );
}

function number(
  value: unknown,
  decimals = 1,
) {
  const parsed =
    Number(value);

  return Number.isFinite(
    parsed,
  )
    ? parsed.toFixed(
        decimals,
      )
    : "—";
}

function dateTime(
  value: unknown,
) {
  const parsed =
    new Date(
      text(value),
    );

  return Number.isFinite(
    parsed.getTime(),
  )
    ? parsed.toLocaleString()
    : "—";
}

function polarityClass(
  polarity: unknown,
) {
  const normalized =
    text(
      polarity,
    ).toLowerCase();

  if (
    normalized ===
    "bullish"
  ) {
    return "border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-100";
  }

  if (
    normalized ===
    "bearish"
  ) {
    return "border-red-400/20 bg-red-500/[0.06] text-red-100";
  }

  return "border-amber-400/20 bg-amber-500/[0.06] text-amber-100";
}

export default function KnowledgeGraphPage() {
  const [
    data,
    setData,
  ] =
    useState<GraphResponse | null>(
      null,
    );

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
    selectedRunId,
    setSelectedRunId,
  ] =
    useState("");

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
      "Loading Neo4j provenance graph.",
    );

  const loadGraph =
    useCallback(
      async (
        explicitRunId =
          selectedRunId,
      ) => {
        setLoading(
          true,
        );

        try {
          const parameters =
            new URLSearchParams();

          parameters.set(
            "limit",
            "50",
          );

          if (
            activeSymbol
          ) {
            parameters.set(
              "symbol",
              activeSymbol,
            );
          }

          if (
            explicitRunId
          ) {
            parameters.set(
              "runId",
              explicitRunId,
            );
          }

          const response =
            await fetch(
              `/api/intelligence/forecast/graph?${parameters.toString()}`,
              {
                cache:
                  "no-store",
              },
            );

          const body =
            (await response.json()) as GraphResponse;

          if (
            !response.ok
          ) {
            throw new Error(
              body.error ??
                "Unable to load the knowledge graph.",
            );
          }

          setData(
            body,
          );

          setMessage(
            body.connectivity
              .ok
              ? "Neo4j graph connected. Claims and evidence remain decision-support records."
              : body.connectivity
                  .detail,
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load the knowledge graph.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        activeSymbol,
        selectedRunId,
      ],
    );

  useEffect(
    () => {
      void loadGraph();
    },
    [
      loadGraph,
    ],
  );

  async function performAction(
    action: string,
    additional:
      Record<
        string,
        unknown
      > = {},
  ) {
    setActiveAction(
      action,
    );

    try {
      const response =
        await fetch(
          "/api/intelligence/forecast/graph",
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
                  action,
                  ...additional,
                },
              ),
          },
        );

      const body =
        (await response.json()) as {
          error?: string;
          detail?: string;
          syncedCount?: number;
          failedCount?: number;
        };

      if (
        !response.ok
      ) {
        throw new Error(
          body.detail ??
            body.error ??
            "Graph operation failed.",
        );
      }

      if (
        action ===
        "sync-batch"
      ) {
        setMessage(
          `Graph synchronization completed. ` +
            `${body.syncedCount ?? 0} runs synchronized and ` +
            `${body.failedCount ?? 0} failed.`,
        );
      } else {
        setMessage(
          "Graph operation completed.",
        );
      }

      await loadGraph();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Graph operation failed.",
      );
    } finally {
      setActiveAction(
        null,
      );
    }
  }

  function applyFilter() {
    setSelectedRunId(
      "",
    );

    setActiveSymbol(
      symbolInput
        .trim()
        .toUpperCase(),
    );
  }

  const selected =
    data?.selectedRun;

  return (
    <main className="mx-auto min-h-screen max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-red-500/15 bg-gradient-to-br from-red-950/30 via-black to-black p-6 shadow-2xl shadow-red-950/20 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300">
          Slice Provenance Intelligence
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
          Knowledge Graph
        </h1>

        <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
          Trace every forecast from its model version and evidence
          categories through claims, horizon conclusions,
          contradictions, and realized outcomes. The graph stores
          provenance and accountability—not trading instructions.
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
            className="w-52 rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm font-bold text-white outline-none placeholder:text-slate-600 focus:border-red-400/40"
          />

          <button
            type="button"
            onClick={
              applyFilter
            }
            className="rounded-xl border border-red-400/25 bg-red-500/15 px-5 py-3 text-sm font-black text-red-100 hover:bg-red-500/25"
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

              setSelectedRunId(
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
              void performAction(
                "initialize",
              )
            }
            className="rounded-xl border border-blue-400/25 bg-blue-500/10 px-5 py-3 text-sm font-black text-blue-100 disabled:opacity-40"
          >
            Initialize Schema
          </button>

          <button
            type="button"
            disabled={
              Boolean(
                activeAction,
              )
            }
            onClick={() =>
              void performAction(
                "sync-batch",
                {
                  limit:
                    50,
                },
              )
            }
            className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-5 py-3 text-sm font-black text-emerald-100 disabled:opacity-40"
          >
            {activeAction ===
            "sync-batch"
              ? "Synchronizing…"
              : "Sync Recent Forecasts"}
          </button>

          <button
            type="button"
            onClick={() =>
              void loadGraph()
            }
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-300 hover:bg-white/[0.08]"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-8">
        {[
          [
            "Assets",
            data?.counts
              .assets ??
              0,
          ],
          [
            "Forecasts",
            data?.counts
              .runs ??
              0,
          ],
          [
            "Models",
            data?.counts
              .models ??
              0,
          ],
          [
            "Evidence",
            data?.counts
              .evidence ??
              0,
          ],
          [
            "Horizons",
            data?.counts
              .horizons ??
              0,
          ],
          [
            "Outcomes",
            data?.counts
              .outcomes ??
              0,
          ],
          [
            "Claims",
            data?.counts
              .claims ??
              0,
          ],
          [
            "Contradictions",
            data?.counts
              .contradictions ??
              0,
          ],
        ].map(
          ([
            label,
            value,
          ]) => (
            <div
              key={
                String(
                  label,
                )
              }
              className="rounded-2xl border border-white/8 bg-white/[0.035] p-5"
            >
              <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                {
                  label
                }
              </div>

              <div className="mt-3 text-2xl font-black text-white">
                {
                  value
                }
              </div>
            </div>
          ),
        )}
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-[380px_minmax(0,1fr)]">
        <aside className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-5">
          <h2 className="text-lg font-black text-white">
            Forecast Runs
          </h2>

          <div className="mt-4 space-y-3">
            {(data?.recentRuns ?? []).map(
              (
                run,
              ) => (
                <button
                  type="button"
                  key={
                    run.runId
                  }
                  onClick={() => {
                    setSelectedRunId(
                      run.runId,
                    );

                    void loadGraph(
                      run.runId,
                    );
                  }}
                  className={`w-full rounded-xl border p-4 text-left transition ${
                    selectedRunId ===
                    run.runId
                      ? "border-red-400/30 bg-red-500/10"
                      : "border-white/8 bg-black/30 hover:border-red-400/20"
                  }`}
                >
                  <div className="flex items-center justify-between gap-3">
                    <div className="text-lg font-black text-white">
                      {
                        run.symbol
                      }
                    </div>

                    <div className="text-[10px] font-black uppercase text-slate-500">
                      {
                        run.status
                      }
                    </div>
                  </div>

                  <div className="mt-2 text-xs text-slate-500">
                    {dateTime(
                      run.generatedAt,
                    )}
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2 text-[11px] text-slate-400">
                    <div>
                      Claims{" "}
                      {
                        run.claimCount
                      }
                    </div>

                    <div>
                      Conflicts{" "}
                      {
                        run.contradictionCount
                      }
                    </div>

                    <div>
                      Horizons{" "}
                      {
                        run.horizonCount
                      }
                    </div>

                    <div>
                      Outcomes{" "}
                      {
                        run.outcomeCount
                      }
                    </div>
                  </div>
                </button>
              ),
            )}

            {!data
              ?.recentRuns
              .length ? (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                No synchronized forecasts.
              </div>
            ) : null}
          </div>
        </aside>

        <div className="space-y-6">
          {loading ? (
            <div className="rounded-[2rem] border border-white/8 p-10 text-center text-sm text-slate-500">
              Loading graph…
            </div>
          ) : null}

          {selected ? (
            <>
              <section className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <h2 className="text-2xl font-black text-white">
                      {text(
                        selected
                          .asset
                          .symbol,
                      )}
                    </h2>

                    <p className="mt-2 text-xs text-slate-500">
                      {text(
                        selected
                          .run
                          .requestId,
                      )}{" "}
                      ·{" "}
                      {dateTime(
                        selected
                          .run
                          .generatedAt,
                      )}
                    </p>
                  </div>

                  <button
                    type="button"
                    disabled={
                      Boolean(
                        activeAction,
                      )
                    }
                    onClick={() =>
                      void performAction(
                        "sync-run",
                        {
                          runId:
                            text(
                              selected
                                .run
                                .runId,
                            ),
                        },
                      )
                    }
                    className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 disabled:opacity-40"
                  >
                    Sync This Run
                  </button>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  {[
                    [
                      "Model",
                      text(
                        selected
                          .run
                          .modelVersion,
                      ),
                    ],
                    [
                      "Regime",
                      text(
                        selected
                          .run
                          .marketRegime,
                      ),
                    ],
                    [
                      "Slice Score",
                      number(
                        selected
                          .run
                          .sliceSentimentScore,
                      ),
                    ],
                    [
                      "Data Quality",
                      number(
                        selected
                          .run
                          .dataQualityScore,
                      ),
                    ],
                    [
                      "CAMEL",
                      text(
                        selected
                          .run
                          .camelStatus,
                      ),
                    ],
                  ].map(
                    ([
                      label,
                      value,
                    ]) => (
                      <div
                        key={
                          label
                        }
                        className="rounded-xl border border-white/8 bg-black/30 p-4"
                      >
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                          {
                            label
                          }
                        </div>

                        <div className="mt-2 break-words text-sm font-black text-white">
                          {
                            value
                          }
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
                <h2 className="text-xl font-black text-white">
                  Provenance Paths
                </h2>

                <div className="mt-5 grid gap-3">
                  {(data
                    ?.provenancePaths ??
                    [])
                    .slice(
                      0,
                      80,
                    )
                    .map(
                      (
                        path,
                        index,
                      ) => (
                        <div
                          key={`${path.type}-${index}`}
                          className="rounded-xl border border-white/8 bg-black/30 p-4"
                        >
                          <div className="text-[10px] font-black uppercase tracking-[0.14em] text-red-300">
                            {
                              path.type
                            }{" "}
                            ·{" "}
                            {
                              path.status
                            }
                          </div>

                          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-300">
                            {path.path.map(
                              (
                                item,
                                itemIndex,
                              ) => (
                                <div
                                  key={`${item}-${itemIndex}`}
                                  className="flex items-center gap-2"
                                >
                                  {itemIndex >
                                  0 ? (
                                    <span className="text-red-500">
                                      →
                                    </span>
                                  ) : null}

                                  <span className="rounded-lg border border-white/8 bg-white/[0.04] px-3 py-2">
                                    {
                                      item
                                    }
                                  </span>
                                </div>
                              ),
                            )}
                          </div>
                        </div>
                      ),
                    )}
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
                <h2 className="text-xl font-black text-white">
                  Evidence Nodes
                </h2>

                <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                  {selected.evidence.map(
                    (
                      item,
                      index,
                    ) => (
                      <div
                        key={`${text(
                          item.key,
                        )}-${index}`}
                        className="rounded-xl border border-blue-400/20 bg-blue-500/[0.05] p-4"
                      >
                        <div className="font-black text-blue-100">
                          {text(
                            item.sourceName,
                          )}
                        </div>

                        <div className="mt-2 text-xs text-blue-100/70">
                          {text(
                            item.liveStatus,
                          )}{" "}
                          ·{" "}
                          {text(
                            item.freshnessStatus,
                          )}
                        </div>

                        <div className="mt-3 text-2xl font-black text-white">
                          {number(
                            item.qualityScore,
                          )}
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
                <h2 className="text-xl font-black text-white">
                  Claims
                </h2>

                <div className="mt-5 grid gap-3">
                  {selected.claims
                    .slice(
                      0,
                      100,
                    )
                    .map(
                      (
                        claim,
                        index,
                      ) => (
                        <div
                          key={`${text(
                            claim.key,
                          )}-${index}`}
                          className={`rounded-xl border p-4 ${polarityClass(
                            claim.polarity,
                          )}`}
                        >
                          <div className="flex flex-wrap items-center justify-between gap-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.14em]">
                              {text(
                                claim.kind,
                              )}{" "}
                              ·{" "}
                              {text(
                                claim.polarity,
                              )}
                            </div>

                            <div className="text-xs font-black">
                              Confidence{" "}
                              {number(
                                claim.confidence,
                              )}
                            </div>
                          </div>

                          <div className="mt-3 text-sm leading-6">
                            {text(
                              claim.text,
                            )}
                          </div>
                        </div>
                      ),
                    )}
                </div>
              </section>

              <section className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
                <h2 className="text-xl font-black text-white">
                  Contradictions
                </h2>

                <div className="mt-5 grid gap-3">
                  {selected.contradictions.map(
                    (
                      contradiction,
                      index,
                    ) => (
                      <div
                        key={`${text(
                          contradiction.key,
                        )}-${index}`}
                        className="rounded-xl border border-red-400/20 bg-red-500/[0.06] p-4"
                      >
                        <div className="text-[10px] font-black uppercase tracking-[0.14em] text-red-200">
                          {text(
                            contradiction.type,
                          )}{" "}
                          ·{" "}
                          {text(
                            contradiction.severity,
                          )}
                        </div>

                        <div className="mt-3 text-sm leading-6 text-red-100">
                          {text(
                            contradiction.text,
                          )}
                        </div>
                      </div>
                    ),
                  )}

                  {!selected
                    .contradictions
                    .length ? (
                    <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                      No graph contradictions were recorded for this run.
                    </div>
                  ) : null}
                </div>
              </section>
            </>
          ) : null}
        </div>
      </section>
    </main>
  );
}