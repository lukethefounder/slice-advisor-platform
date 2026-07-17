"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Weights = {
  production:
    number;

  horizonModel:
    number;

  agentSimulation:
    number;
};

type Metrics = {
  sampleCount:
    number;

  brierScore:
    number;

  logLoss:
    number;

  directionalAccuracyPercent:
    number;

  expectedCalibrationError:
    number;

  meanAbsoluteReturnError:
    number;

  returnBias:
    number;
};

type ComponentAblation = {
  component:
    string;

  brierDelta:
    number;

  accuracyDelta:
    number;

  returnErrorDelta:
    number;

  conclusion:
    string;
};

type FeatureAblation = {
  feature:
    string;

  affectedSampleCount:
    number;

  brierDelta:
    number;

  accuracyDelta:
    number;

  returnErrorDelta:
    number;

  recommendation:
    string;
};

type Artifact = {
  horizon:
    string;

  status:
    "TRAINED" | "PRIOR";

  sampleCount:
    number;

  trainingCount:
    number;

  validationCount:
    number;

  probabilityWeights:
    Weights;

  returnWeights:
    Weights;

  calibration: {
    slope:
      number;

    intercept:
      number;
  };

  validationMetrics:
    Metrics;

  productionOnlyMetrics:
    Metrics;

  componentCoverage: {
    production:
      number;

    horizonModel:
      number;

    agentSimulation:
      number;
  };

  componentAblations:
    ComponentAblation[];

  featureAblations:
    FeatureAblation[];

  recommendedFeatureRemovals:
    string[];

  promotionGates: {
    allPassed:
      boolean;

    items:
      Array<{
        key:
          string;

        passed:
          boolean;

        actual:
          number | boolean;

        threshold:
          number | boolean;

        detail:
          string;
      }>;
  };
};

type Suite = {
  modelVersion:
    string;

  engineVersion:
    string;

  calibrationVersion:
    string;

  trainedAt:
    string;

  status:
    "TRAINED" | "PRIOR";

  totalEligibleSamples:
    number;

  artifacts:
    Record<
      string,
      Artifact
    >;
};

type ModelRecord = {
  id:
    string;

  displayName:
    string;

  modelVersion:
    string;

  status:
    string;

  createdAt:
    string;

  promotedAt:
    string | null;
};

type Evaluation = {
  predictionCount:
    number;

  matchedOutcomeCount:
    number;

  overall:
    Metrics;

  byHorizon:
    Array<
      {
        horizon:
          string;
      } &
      Metrics
    >;
};

type RecentPrediction = {
  eventId:
    string;

  createdAt:
    string;

  forecastRunId:
    string;

  modelVersion:
    string;

  horizon:
    string;

  probability:
    number;

  expectedReturnPercent:
    number;

  direction:
    string;

  confidence:
    number;
};

type Overview = {
  ok:
    boolean;

  activeSuite:
    Suite;

  models:
    ModelRecord[];

  evaluation:
    Evaluation;

  recentPredictions:
    RecentPrediction[];

  error?:
    string;
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

function percentWeight(
  value: number,
) {
  return `${number(
    value *
    100,
    0,
  )}%`;
}

function dateTime(
  value: string,
) {
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

function statusClass(
  status: string,
) {
  if (
    status ===
      "TRAINED" ||
    status ===
      "Production"
  ) {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
  }

  return "border-amber-400/25 bg-amber-500/10 text-amber-100";
}

function conclusionClass(
  conclusion: string,
) {
  if (
    conclusion ===
    "Helpful"
  ) {
    return "text-emerald-300";
  }

  if (
    conclusion ===
      "Potentially Harmful" ||
    conclusion ===
      "Remove Candidate"
  ) {
    return "text-red-300";
  }

  return "text-amber-300";
}

export default function EnsembleLabPage() {
  const [
    overview,
    setOverview,
  ] =
    useState<Overview | null>(
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
    activeAction,
    setActiveAction,
  ] =
    useState<string | null>(
      null,
    );

  const [
    runId,
    setRunId,
  ] =
    useState("");

  const [
    message,
    setMessage,
  ] =
    useState(
      "Loading calibrated ensemble artifacts.",
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
              "/api/intelligence/forecast/ensemble",
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
              "Unable to load the ensemble.",
            );
          }

          setOverview(
            body,
          );

          setMessage(
            "Ensemble loaded in shadow mode. No model, feature, or weight is promoted automatically.",
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load the ensemble.",
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

  async function runAction(
    action: "train" | "generate-run",
  ) {
    if (
      action ===
      "generate-run" &&
      !runId.trim()
    ) {
      setMessage(
        "Paste a forecast run ID before generating an ensemble.",
      );

      return;
    }

    const confirmed =
      action ===
      "train"
        ? window.confirm(
            "Train a new immutable ensemble artifact from chronological settled outcomes?",
          )
        : true;

    if (!confirmed) {
      return;
    }

    setActiveAction(
      action,
    );

    try {
      const response =
        await fetch(
          "/api/intelligence/forecast/ensemble",
          {
            method:
              "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body:
              JSON.stringify({
                action,

                runId:
                  runId.trim() ||
                  undefined,
              }),
          },
        );

      const body =
        (await response.json()) as {
          error?:
            string;

          detail?:
            string;

          suite?: {
            modelVersion:
              string;

            totalEligibleSamples:
              number;
          };

          result?: {
            predictions:
              unknown[];
          };
        };

      if (
        !response.ok
      ) {
        throw new Error(
          body.detail ??
          body.error ??
          "Ensemble operation failed.",
        );
      }

      setMessage(
        action ===
        "train"
          ? `Created ${body.suite?.modelVersion ?? "a new ensemble"} from ${body.suite?.totalEligibleSamples ?? 0} eligible outcomes.`
          : `Generated ${body.result?.predictions.length ?? 0} ensemble predictions.`,
      );

      await loadOverview();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Ensemble operation failed.",
      );
    } finally {
      setActiveAction(
        null,
      );
    }
  }

  const suite =
    overview?.activeSuite;

  const evaluation =
    overview?.evaluation;

  return (
    <main className="mx-auto min-h-screen max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-red-500/15 bg-gradient-to-br from-red-950/30 via-black to-black p-6 shadow-2xl shadow-red-950/20 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300">
          Slice Calibrated Decision Engine
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
          Ensemble Lab
        </h1>

        <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
          Optimize production, independent horizon, and
          heterogeneous-agent components using chronological
          validation. Inspect probability calibration, component
          ablation, feature ablation, and human-controlled promotion
          gates.
        </p>

        <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
          {message}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={
              Boolean(
                activeAction,
              )
            }
            onClick={() =>
              void runAction(
                "train",
              )
            }
            className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-5 py-3 text-sm font-black text-emerald-100 disabled:opacity-40"
          >
            {activeAction ===
            "train"
              ? "Training…"
              : "Train New Ensemble"}
          </button>

          <input
            value={
              runId
            }
            onChange={(
              event,
            ) =>
              setRunId(
                event.target
                  .value,
              )
            }
            placeholder="Forecast run ID"
            className="min-w-72 rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white placeholder:text-slate-600"
          />

          <button
            type="button"
            disabled={
              Boolean(
                activeAction,
              )
            }
            onClick={() =>
              void runAction(
                "generate-run",
              )
            }
            className="rounded-xl border border-red-400/25 bg-red-500/10 px-5 py-3 text-sm font-black text-red-100 disabled:opacity-40"
          >
            Generate for Run
          </button>

          <button
            type="button"
            onClick={() =>
              void loadOverview()
            }
            className="rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-slate-300 hover:bg-white/[0.08]"
          >
            Refresh
          </button>
        </div>
      </section>

      <section className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-7">
        {[
          [
            "Suite Status",
            suite?.status ??
            "—",
          ],
          [
            "Eligible Samples",
            suite?.totalEligibleSamples ??
            0,
          ],
          [
            "Shadow Predictions",
            evaluation?.predictionCount ??
            0,
          ],
          [
            "Matched Outcomes",
            evaluation?.matchedOutcomeCount ??
            0,
          ],
          [
            "Brier Score",
            number(
              evaluation?.overall.brierScore ??
              0,
              4,
            ),
          ],
          [
            "Calibration Error",
            number(
              evaluation?.overall.expectedCalibrationError ??
              0,
              4,
            ),
          ],
          [
            "Direction Accuracy",
            `${number(
              evaluation?.overall.directionalAccuracyPercent ??
              0,
            )}%`,
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

      {loading ? (
        <div className="mt-6 rounded-[2rem] border border-white/8 p-10 text-center text-sm text-slate-500">
          Loading ensemble…
        </div>
      ) : null}

      {suite ? (
        <section className="mt-6 space-y-5">
          {Object.values(
            suite.artifacts,
          ).map(
            (artifact) => (
              <article
                key={
                  artifact.horizon
                }
                className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6"
              >
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <div className="flex flex-wrap items-center gap-3">
                      <h2 className="text-2xl font-black text-white">
                        {
                          artifact.horizon
                        }
                      </h2>

                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusClass(
                          artifact.status,
                        )}`}
                      >
                        {
                          artifact.status
                        }
                      </span>

                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-black ${
                          artifact.promotionGates
                            .allPassed
                            ? "border-emerald-400/25 bg-emerald-500/10 text-emerald-100"
                            : "border-red-400/25 bg-red-500/10 text-red-100"
                        }`}
                      >
                        {artifact.promotionGates
                          .allPassed
                          ? "GATES PASSED"
                          : "GATES BLOCKED"}
                      </span>
                    </div>

                    <p className="mt-2 text-xs text-slate-500">
                      {artifact.sampleCount} total ·{" "}
                      {artifact.trainingCount} training ·{" "}
                      {artifact.validationCount} validation
                    </p>
                  </div>

                  <div className="text-right text-xs text-slate-500">
                    Calibration slope{" "}
                    {number(
                      artifact.calibration
                        .slope,
                      4,
                    )}{" "}
                    · intercept{" "}
                    {number(
                      artifact.calibration
                        .intercept,
                      4,
                    )}
                  </div>
                </div>

                <div className="mt-5 grid gap-4 xl:grid-cols-2">
                  <div className="rounded-2xl border border-white/8 bg-black/30 p-5">
                    <h3 className="text-sm font-black text-white">
                      Probability Weights
                    </h3>

                    <div className="mt-4 grid grid-cols-3 gap-3">
                      {Object.entries(
                        artifact.probabilityWeights,
                      ).map(
                        ([
                          component,
                          weight,
                        ]) => (
                          <div
                            key={
                              component
                            }
                            className="rounded-xl border border-white/8 p-4"
                          >
                            <div className="text-[10px] uppercase text-slate-600">
                              {
                                component
                              }
                            </div>

                            <div className="mt-2 text-xl font-black text-white">
                              {percentWeight(
                                weight,
                              )}
                            </div>
                          </div>
                        ),
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-white/8 bg-black/30 p-5">
                    <h3 className="text-sm font-black text-white">
                      Validation
                    </h3>

                    <div className="mt-4 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-slate-600">
                          Ensemble Brier
                        </div>

                        <div className="mt-1 font-black text-white">
                          {number(
                            artifact.validationMetrics
                              .brierScore,
                            4,
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-600">
                          Production Brier
                        </div>

                        <div className="mt-1 font-black text-white">
                          {number(
                            artifact.productionOnlyMetrics
                              .brierScore,
                            4,
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-600">
                          Direction
                        </div>

                        <div className="mt-1 font-black text-white">
                          {number(
                            artifact.validationMetrics
                              .directionalAccuracyPercent,
                          )}
                          %
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-600">
                          Calibration Error
                        </div>

                        <div className="mt-1 font-black text-white">
                          {number(
                            artifact.validationMetrics
                              .expectedCalibrationError,
                            4,
                          )}
                        </div>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="mt-5 grid gap-5 xl:grid-cols-2">
                  <section>
                    <h3 className="text-sm font-black text-white">
                      Component Ablation
                    </h3>

                    <div className="mt-3 space-y-2">
                      {artifact.componentAblations.map(
                        (ablation) => (
                          <div
                            key={
                              ablation.component
                            }
                            className="rounded-xl border border-white/8 bg-black/30 p-4 text-xs"
                          >
                            <div className="flex justify-between gap-3">
                              <span className="font-black text-white">
                                {
                                  ablation.component
                                }
                              </span>

                              <span
                                className={`font-black ${conclusionClass(
                                  ablation.conclusion,
                                )}`}
                              >
                                {
                                  ablation.conclusion
                                }
                              </span>
                            </div>

                            <div className="mt-2 text-slate-500">
                              Brier delta{" "}
                              {number(
                                ablation.brierDelta,
                                4,
                              )}{" "}
                              · accuracy delta{" "}
                              {number(
                                ablation.accuracyDelta,
                              )}
                              %
                            </div>
                          </div>
                        ),
                      )}

                      {!artifact.componentAblations
                        .length ? (
                        <div className="rounded-xl border border-dashed border-white/10 p-5 text-xs text-slate-500">
                          More validation outcomes are required.
                        </div>
                      ) : null}
                    </div>
                  </section>

                  <section>
                    <h3 className="text-sm font-black text-white">
                      Feature Removal Review
                    </h3>

                    <div className="mt-3 max-h-80 space-y-2 overflow-y-auto">
                      {artifact.featureAblations
                        .slice(
                          0,
                          30,
                        )
                        .map(
                          (ablation) => (
                            <div
                              key={
                                ablation.feature
                              }
                              className="rounded-xl border border-white/8 bg-black/30 p-4 text-xs"
                            >
                              <div className="flex justify-between gap-3">
                                <span className="font-black text-white">
                                  {
                                    ablation.feature
                                  }
                                </span>

                                <span
                                  className={`font-black ${conclusionClass(
                                    ablation.recommendation,
                                  )}`}
                                >
                                  {
                                    ablation.recommendation
                                  }
                                </span>
                              </div>

                              <div className="mt-2 text-slate-500">
                                {ablation.affectedSampleCount} affected ·
                                Brier delta{" "}
                                {number(
                                  ablation.brierDelta,
                                  4,
                                )}
                              </div>
                            </div>
                          ),
                        )}

                      {!artifact.featureAblations
                        .length ? (
                        <div className="rounded-xl border border-dashed border-white/10 p-5 text-xs text-slate-500">
                          Feature ablation begins after stored horizon
                          predictions mature into outcomes.
                        </div>
                      ) : null}
                    </div>
                  </section>
                </div>

                <div className="mt-5 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                  {artifact.promotionGates.items.map(
                    (gate) => (
                      <div
                        key={
                          gate.key
                        }
                        className={`rounded-xl border p-3 text-xs ${
                          gate.passed
                            ? "border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-100"
                            : "border-red-400/20 bg-red-500/[0.06] text-red-100"
                        }`}
                      >
                        <div className="font-black">
                          {gate.passed
                            ? "PASS"
                            : "FAIL"}{" "}
                          · {gate.key}
                        </div>

                        <div className="mt-1 opacity-70">
                          {
                            gate.detail
                          }
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </article>
            ),
          )}
        </section>
      ) : null}

      <section className="mt-6 rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
        <h2 className="text-xl font-black text-white">
          Immutable Ensemble Artifacts
        </h2>

        <div className="mt-5 grid gap-3">
          {(overview?.models ?? []).map(
            (model) => (
              <div
                key={
                  model.id
                }
                className="flex flex-wrap items-center justify-between gap-4 rounded-xl border border-white/8 bg-black/30 p-4"
              >
                <div>
                  <div className="font-black text-white">
                    {
                      model.displayName
                    }
                  </div>

                  <div className="mt-1 break-all text-xs text-slate-600">
                    {
                      model.modelVersion
                    }
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusClass(
                      model.status,
                    )}`}
                  >
                    {
                      model.status
                    }
                  </span>

                  <span className="text-xs text-slate-500">
                    {dateTime(
                      model.createdAt,
                    )}
                  </span>
                </div>
              </div>
            ),
          )}
        </div>
      </section>
    </main>
  );
}