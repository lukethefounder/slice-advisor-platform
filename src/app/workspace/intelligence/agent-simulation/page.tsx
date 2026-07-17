"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type Scenario = {
  id: string;
  label: string;
  description: string;
};

type ForecastRun = {
  id: string;
  requestId: string;
  symbol: string;
  generatedAt: string;
  modelVersion: string;
  marketRegime: string;
  status: string;
  horizons: Array<{
    id: string;
    horizon: string;
    label: string;
    targetAt: string;
    initialPrice: number;
    direction: string;
    positiveReturnProbability: number;
    expectedReturnPercent: number;
    volatilityPercent: number;
    confidence: number;
    status: string;
  }>;
};

type AgentInfluence = {
  id: string;
  label: string;
  category: string;
  influenceSharePercent: number;
  signedSupport: number;
  dominantAction:
    | "Buy"
    | "Sell"
    | "Neutral";
};

type HorizonResult = {
  horizon: string;
  label: string;
  targetAt: string;
  initialPrice: number;
  paths: number;
  steps: number;
  positiveReturnProbability: number;
  meanReturnPercent: number;
  standardDeviationPercent: number;
  quantiles: {
    p05: number;
    p10: number;
    p25: number;
    p50: number;
    p75: number;
    p90: number;
    p95: number;
  };
  expectedPrice: number;
  medianPrice: number;
  priceRangeP10: number;
  priceRangeP90: number;
  crashThresholdPercent: number;
  rallyThresholdPercent: number;
  crashProbability: number;
  rallyProbability: number;
  averageMaximumDrawdownPercent: number;
  maximumDrawdownP90Percent: number;
  agentAgreementPercent: number;
  netAgentSupport: number;
  agentInfluence: AgentInfluence[];
};

type SimulationResult = {
  simulationId: string;
  generatedAt: string;
  replayFingerprint: string;
  engineVersion: string;
  forecastRunId: string;
  requestId: string;
  symbol: string;
  sourceModelVersion: string;
  marketRegime: string;
  scenario: Scenario;
  configuration: {
    paths: number;
    seed: number;
    agentCount: number;
    horizonCount: number;
  };
  horizons: HorizonResult[];
};

type HistoryItem = {
  id: string;
  forecastRunId: string;
  symbol: string;
  scenario: string;
  paths: number;
  seed: number;
  generatedAt: string;
  replayFingerprint: string;
  horizonCount: number;
  summary: {
    averagePositiveProbability: number;
    averageMedianReturnPercent: number;
    maximumCrashProbability: number;
    maximumRallyProbability: number;
  };
};

type Overview = {
  ok: boolean;
  scenarios: Scenario[];
  agents: Array<{
    id: string;
    label: string;
    category: string;
    description: string;
  }>;
  limits: {
    minimumPaths: number;
    maximumPaths: number;
  };
  forecastRuns: ForecastRun[];
  history: HistoryItem[];
  latestResult: SimulationResult | null;
  error?: string;
};

function number(
  value: number,
  decimals = 2,
) {
  return Number.isFinite(
    value,
  )
    ? value.toFixed(
        decimals,
      )
    : "—";
}

function signedPercent(
  value: number,
) {
  return `${
    value > 0
      ? "+"
      : ""
  }${number(
    value,
  )}%`;
}

function dateTime(
  value: string,
) {
  const date =
    new Date(
      value,
    );

  return Number.isFinite(
    date.getTime(),
  )
    ? date.toLocaleString()
    : value;
}

function actionClass(
  action:
    | "Buy"
    | "Sell"
    | "Neutral",
) {
  if (
    action ===
    "Buy"
  ) {
    return "text-emerald-300";
  }

  if (
    action ===
    "Sell"
  ) {
    return "text-red-300";
  }

  return "text-amber-300";
}

export default function AgentSimulationPage() {
  const [
    overview,
    setOverview,
  ] =
    useState<Overview | null>(
      null,
    );

  const [
    selectedRunId,
    setSelectedRunId,
  ] =
    useState("");

  const [
    selectedScenario,
    setSelectedScenario,
  ] =
    useState(
      "BASELINE",
    );

  const [
    paths,
    setPaths,
  ] =
    useState(
      250,
    );

  const [
    seed,
    setSeed,
  ] =
    useState("");

  const [
    result,
    setResult,
  ] =
    useState<SimulationResult | null>(
      null,
    );

  const [
    loading,
    setLoading,
  ] =
    useState(
      true,
    );

  const [
    running,
    setRunning,
  ] =
    useState(
      false,
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      "Loading simulation environment.",
    );

  const loadOverview =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        try {
          const response =
            await fetch(
              "/api/intelligence/forecast/agent-simulation",
              {
                cache:
                  "no-store",
              },
            );

          const body =
            (await response.json()) as Overview;

          if (
            !response.ok
          ) {
            throw new Error(
              body.error ??
                "Unable to load simulation environment.",
            );
          }

          setOverview(
            body,
          );

          setResult(
            (
              current,
            ) =>
              current ??
              body.latestResult,
          );

          setSelectedRunId(
            (
              current,
            ) =>
              current ||
              body.forecastRuns[0]
                ?.id ||
              "",
          );

          setMessage(
            "Simulation environment loaded. Results are hypothetical scenario evidence, not observed truth.",
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load simulation environment.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [],
    );

  useEffect(
    () => {
      void loadOverview();
    },
    [
      loadOverview,
    ],
  );

  const selectedRun =
    useMemo(
      () =>
        overview
          ?.forecastRuns
          .find(
            (run) =>
              run.id ===
              selectedRunId,
          ) ??
        null,
      [
        overview,
        selectedRunId,
      ],
    );

  async function runSimulation() {
    if (
      !selectedRunId
    ) {
      setMessage(
        "Select a stored forecast first.",
      );

      return;
    }

    setRunning(
      true,
    );

    setMessage(
      "Running deterministic heterogeneous-agent simulation.",
    );

    try {
      const response =
        await fetch(
          "/api/intelligence/forecast/agent-simulation",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "run",
                runId:
                  selectedRunId,
                scenario:
                  selectedScenario,
                paths,
                seed:
                  seed.trim()
                    ? Number(
                        seed,
                      )
                    : undefined,
              }),
          },
        );

      const body =
        (await response.json()) as {
          result?: SimulationResult;
          error?: string;
          detail?: string;
        };

      if (
        !response.ok ||
        !body.result
      ) {
        throw new Error(
          body.detail ??
            body.error ??
            "Simulation failed.",
        );
      }

      setResult(
        body.result,
      );

      setMessage(
        `${body.result.scenario.label} completed with ${body.result.configuration.paths} paths and seed ${body.result.configuration.seed}.`,
      );

      await loadOverview();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Simulation failed.",
      );
    } finally {
      setRunning(
        false,
      );
    }
  }

  async function replay(
    eventId: string,
  ) {
    setRunning(
      true,
    );

    try {
      const response =
        await fetch(
          "/api/intelligence/forecast/agent-simulation",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action:
                  "replay",
                eventId,
              }),
          },
        );

      const body =
        (await response.json()) as {
          result?: SimulationResult;
          error?: string;
          detail?: string;
        };

      if (
        !response.ok ||
        !body.result
      ) {
        throw new Error(
          body.detail ??
            body.error ??
            "Replay failed.",
        );
      }

      setResult(
        body.result,
      );

      setMessage(
        `Replayed fingerprint ${body.result.replayFingerprint}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Replay failed.",
      );
    } finally {
      setRunning(
        false,
      );
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-red-500/15 bg-gradient-to-br from-red-950/30 via-black to-black p-6 shadow-2xl shadow-red-950/20 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300">
          Slice Behavioral Simulation
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
          Agent Simulation Lab
        </h1>

        <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
          Stress-test stored forecasts against heterogeneous retail,
          institutional, systematic, derivatives, liquidity, macro,
          and structural market participants. Every result is
          reproducible and stored as hypothetical decision-support
          evidence.
        </p>

        <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
          {message}
        </div>

        <div className="mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-5">
          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              Stored Forecast
            </span>

            <select
              value={
                selectedRunId
              }
              onChange={(
                event,
              ) =>
                setSelectedRunId(
                  event.target
                    .value,
                )
              }
              className="rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-sm font-bold text-white"
            >
              {(overview?.forecastRuns ?? []).map(
                (run) => (
                  <option
                    key={
                      run.id
                    }
                    value={
                      run.id
                    }
                  >
                    {run.symbol} ·{" "}
                    {dateTime(
                      run.generatedAt,
                    )}
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              Scenario
            </span>

            <select
              value={
                selectedScenario
              }
              onChange={(
                event,
              ) =>
                setSelectedScenario(
                  event.target
                    .value,
                )
              }
              className="rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-sm font-bold text-white"
            >
              {(overview?.scenarios ?? []).map(
                (scenario) => (
                  <option
                    key={
                      scenario.id
                    }
                    value={
                      scenario.id
                    }
                  >
                    {
                      scenario.label
                    }
                  </option>
                ),
              )}
            </select>
          </label>

          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              Paths
            </span>

            <input
              type="number"
              min={
                overview?.limits
                  .minimumPaths ??
                50
              }
              max={
                overview?.limits
                  .maximumPaths ??
                1000
              }
              value={
                paths
              }
              onChange={(
                event,
              ) =>
                setPaths(
                  Number(
                    event.target
                      .value,
                  ),
                )
              }
              className="rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-sm font-bold text-white"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              Replay Seed
            </span>

            <input
              value={
                seed
              }
              onChange={(
                event,
              ) =>
                setSeed(
                  event.target
                    .value,
                )
              }
              placeholder="Automatic"
              className="rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-sm font-bold text-white placeholder:text-slate-600"
            />
          </label>

          <div className="flex items-end">
            <button
              type="button"
              disabled={
                running ||
                !selectedRunId
              }
              onClick={() =>
                void runSimulation()
              }
              className="w-full rounded-xl border border-red-400/25 bg-red-500/15 px-5 py-3 text-sm font-black text-red-100 hover:bg-red-500/25 disabled:opacity-40"
            >
              {running
                ? "Simulating…"
                : "Run Scenario"}
            </button>
          </div>
        </div>

        {selectedRun ? (
          <div className="mt-4 text-xs text-slate-500">
            Source:{" "}
            {selectedRun.symbol} ·{" "}
            {selectedRun.modelVersion} ·{" "}
            {selectedRun.marketRegime} ·{" "}
            {selectedRun.horizons.length} horizons
          </div>
        ) : null}
      </section>

      {loading ? (
        <div className="mt-6 rounded-[2rem] border border-white/8 p-10 text-center text-sm text-slate-500">
          Loading simulations…
        </div>
      ) : null}

      {result ? (
        <>
          <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-6">
            {[
              [
                "Symbol",
                result.symbol,
              ],
              [
                "Scenario",
                result.scenario
                  .label,
              ],
              [
                "Paths",
                result.configuration
                  .paths,
              ],
              [
                "Agents",
                result.configuration
                  .agentCount,
              ],
              [
                "Seed",
                result.configuration
                  .seed,
              ],
              [
                "Fingerprint",
                result.replayFingerprint.slice(
                  0,
                  12,
                ),
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
                    {label}
                  </div>

                  <div className="mt-3 break-words text-xl font-black text-white">
                    {value}
                  </div>
                </div>
              ),
            )}
          </section>

          <section className="mt-6 space-y-5">
            {result.horizons.map(
              (horizon) => (
                <article
                  key={
                    horizon.horizon
                  }
                  className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6"
                >
                  <div className="flex flex-wrap items-start justify-between gap-4">
                    <div>
                      <h2 className="text-2xl font-black text-white">
                        {
                          horizon.label
                        }
                      </h2>

                      <p className="mt-2 text-xs text-slate-500">
                        {horizon.paths} paths ·{" "}
                        {horizon.steps} steps · target{" "}
                        {dateTime(
                          horizon.targetAt,
                        )}
                      </p>
                    </div>

                    <div className="text-right">
                      <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                        Positive Probability
                      </div>

                      <div className="mt-1 text-3xl font-black text-white">
                        {number(
                          horizon.positiveReturnProbability,
                        )}
                        %
                      </div>
                    </div>
                  </div>

                  <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
                    {[
                      [
                        "Mean Return",
                        signedPercent(
                          horizon.meanReturnPercent,
                        ),
                      ],
                      [
                        "Median Return",
                        signedPercent(
                          horizon.quantiles
                            .p50,
                        ),
                      ],
                      [
                        "P10 / P90",
                        `${signedPercent(
                          horizon.quantiles
                            .p10,
                        )} / ${signedPercent(
                          horizon.quantiles
                            .p90,
                        )}`,
                      ],
                      [
                        "Crash Risk",
                        `${number(
                          horizon.crashProbability,
                        )}%`,
                      ],
                      [
                        "Rally Chance",
                        `${number(
                          horizon.rallyProbability,
                        )}%`,
                      ],
                      [
                        "Average Drawdown",
                        `${number(
                          horizon.averageMaximumDrawdownPercent,
                        )}%`,
                      ],
                      [
                        "Agent Agreement",
                        `${number(
                          horizon.agentAgreementPercent,
                        )}%`,
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
                          <div className="text-[10px] font-black uppercase tracking-[0.12em] text-slate-600">
                            {label}
                          </div>

                          <div className="mt-2 text-sm font-black text-white">
                            {value}
                          </div>
                        </div>
                      ),
                    )}
                  </div>

                  <div className="mt-6 grid gap-6 xl:grid-cols-2">
                    <div>
                      <h3 className="text-sm font-black text-white">
                        Return Distribution
                      </h3>

                      <div className="mt-3 grid grid-cols-7 gap-2">
                        {Object.entries(
                          horizon.quantiles,
                        ).map(
                          ([
                            key,
                            value,
                          ]) => (
                            <div
                              key={
                                key
                              }
                              className="rounded-lg border border-white/8 bg-black/30 p-3 text-center"
                            >
                              <div className="text-[10px] font-black uppercase text-slate-600">
                                {key}
                              </div>

                              <div className="mt-2 text-xs font-black text-white">
                                {signedPercent(
                                  value,
                                )}
                              </div>
                            </div>
                          ),
                        )}
                      </div>

                      <div className="mt-4 rounded-xl border border-white/8 bg-black/30 p-4 text-xs text-slate-400">
                        Median price: ${number(
                          horizon.medianPrice,
                          4,
                        )} · P10–P90 price range: $
                        {number(
                          horizon.priceRangeP10,
                          4,
                        )}–$
                        {number(
                          horizon.priceRangeP90,
                          4,
                        )}
                      </div>
                    </div>

                    <div>
                      <h3 className="text-sm font-black text-white">
                        Dominant Agent Influence
                      </h3>

                      <div className="mt-3 space-y-2">
                        {horizon.agentInfluence
                          .slice(
                            0,
                            7,
                          )
                          .map(
                            (
                              agent,
                            ) => (
                              <div
                                key={
                                  agent.id
                                }
                                className="rounded-xl border border-white/8 bg-black/30 p-3"
                              >
                                <div className="flex items-center justify-between gap-3 text-xs">
                                  <div>
                                    <span className="font-black text-white">
                                      {
                                        agent.label
                                      }
                                    </span>

                                    <span className="ml-2 text-slate-600">
                                      {
                                        agent.category
                                      }
                                    </span>
                                  </div>

                                  <span
                                    className={`font-black ${actionClass(
                                      agent.dominantAction,
                                    )}`}
                                  >
                                    {
                                      agent.dominantAction
                                    }
                                  </span>
                                </div>

                                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-white/5">
                                  <div
                                    className="h-full rounded-full bg-red-500"
                                    style={{
                                      width: `${Math.min(
                                        100,
                                        agent.influenceSharePercent *
                                          5,
                                      )}%`,
                                    }}
                                  />
                                </div>

                                <div className="mt-2 flex justify-between text-[10px] text-slate-600">
                                  <span>
                                    Influence{" "}
                                    {number(
                                      agent.influenceSharePercent,
                                    )}
                                    %
                                  </span>

                                  <span>
                                    Support{" "}
                                    {number(
                                      agent.signedSupport,
                                      4,
                                    )}
                                  </span>
                                </div>
                              </div>
                            ),
                          )}
                      </div>
                    </div>
                  </div>
                </article>
              ),
            )}
          </section>
        </>
      ) : null}

      <section className="mt-6 rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
        <h2 className="text-xl font-black text-white">
          Stored Scenario Replays
        </h2>

        <div className="mt-5 grid gap-3">
          {(overview?.history ?? []).map(
            (history) => (
              <div
                key={
                  history.id
                }
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/30 p-4"
              >
                <div>
                  <div className="font-black text-white">
                    {history.symbol} ·{" "}
                    {history.scenario}
                  </div>

                  <div className="mt-1 text-xs text-slate-600">
                    {dateTime(
                      history.generatedAt,
                    )} · {history.paths} paths · seed{" "}
                    {history.seed}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-4">
                  <div className="text-right text-xs text-slate-500">
                    <div>
                      Positive{" "}
                      {number(
                        history.summary
                          .averagePositiveProbability,
                      )}
                      %
                    </div>

                    <div>
                      Crash max{" "}
                      {number(
                        history.summary
                          .maximumCrashProbability,
                      )}
                      %
                    </div>
                  </div>

                  <button
                    type="button"
                    disabled={
                      running
                    }
                    onClick={() =>
                      void replay(
                        history.id,
                      )
                    }
                    className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 disabled:opacity-40"
                  >
                    Exact Replay
                  </button>
                </div>
              </div>
            ),
          )}

          {!overview?.history.length ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
              No stored simulations exist yet.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}