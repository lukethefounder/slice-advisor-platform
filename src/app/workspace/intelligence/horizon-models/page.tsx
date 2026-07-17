"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Metrics = {
  sampleCount:
    number;

  brierScore:
    number;

  directionalAccuracyPercent:
    number;

  meanAbsoluteReturnError:
    number;

  averageForecastProbability:
    number;

  observedPositivePercent:
    number;
};

type Artifact = {
  horizon:
    string;

  label:
    string;

  status:
    "TRAINED" | "PRIOR";

  sampleCount:
    number;

  trainingCount:
    number;

  validationCount:
    number;

  trainedAt:
    string;

  returnScale:
    number;

  validationMetrics:
    Metrics;
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
    "PRIOR" | "TRAINED";

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
    {
      sampleCount:
        number;

      brierScore:
        number;

      directionalAccuracyPercent:
        number;

      meanAbsoluteReturnError:
        number;

      averageConfidence:
        number;
    };

  byHorizon:
    Array<{
      horizon:
        string;

      sampleCount:
        number;

      brierScore:
        number;

      directionalAccuracyPercent:
        number;

      meanAbsoluteReturnError:
        number;

      averageConfidence:
        number;
    }>;
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

  error?:
    string;
};

function number(
  value:
    number,
  decimals =
    2,
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
    string,
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
  status:
    string,
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

export default function HorizonModelsPage() {
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
    training,
    setTraining,
  ] =
    useState(
      false,
    );

  const [
    message,
    setMessage,
  ] =
    useState(
      "Loading independent horizon models.",
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
              "/api/intelligence/forecast/horizon-models",
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
                "Unable to load horizon models.",
            );
          }

          setOverview(
            body,
          );

          setMessage(
            "Models are running in shadow mode and do not replace the production forecast.",
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load horizon models.",
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

  async function trainModels() {
    const confirmed =
      window.confirm(
        "Train a new immutable shadow-model suite from eligible settled outcomes?",
      );

    if (
      !confirmed
    ) {
      return;
    }

    setTraining(
      true,
    );

    setMessage(
      "Training eight horizon-specific models.",
    );

    try {
      const response =
        await fetch(
          "/api/intelligence/forecast/horizon-models",
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
                    "train",
                },
              ),
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
        };

      if (
        !response.ok
      ) {
        throw new Error(
          body.detail ??
            body.error ??
            "Training failed.",
        );
      }

      setMessage(
        `Created ${body.suite?.modelVersion ?? "a new model suite"} ` +
          `from ${body.suite?.totalEligibleSamples ?? 0} eligible outcomes.`,
      );

      await loadOverview();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Training failed.",
      );
    } finally {
      setTraining(
        false,
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
          Slice Independent Forecasting
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
          Horizon Models
        </h1>

        <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
          Eight independent probability and expected-return models,
          each using horizon-specific feature weights and online
          training from settled point-in-time outcomes. Predictions
          remain in shadow mode until validated and approved.
        </p>

        <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
          {message}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <button
            type="button"
            disabled={
              training
            }
            onClick={() =>
              void trainModels()
            }
            className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-5 py-3 text-sm font-black text-emerald-100 disabled:opacity-40"
          >
            {training
              ? "Training…"
              : "Train New Shadow Suite"}
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
            suite
              ?.totalEligibleSamples ??
              0,
          ],
          [
            "Shadow Predictions",
            evaluation
              ?.predictionCount ??
              0,
          ],
          [
            "Matched Outcomes",
            evaluation
              ?.matchedOutcomeCount ??
              0,
          ],
          [
            "Brier Score",
            number(
              evaluation
                ?.overall
                .brierScore ??
                0,
              4,
            ),
          ],
          [
            "Direction Accuracy",
            `${number(
              evaluation
                ?.overall
                .directionalAccuracyPercent ??
                0,
            )}%`,
          ],
          [
            "Return MAE",
            `${number(
              evaluation
                ?.overall
                .meanAbsoluteReturnError ??
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

      {suite ? (
        <section className="mt-6 rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div>
              <h2 className="text-xl font-black text-white">
                Active Shadow Suite
              </h2>

              <p className="mt-2 break-all text-xs text-slate-500">
                {suite.modelVersion}
              </p>
            </div>

            <div className="text-right text-xs text-slate-500">
              Trained{" "}
              {dateTime(
                suite.trainedAt,
              )}
            </div>
          </div>

          <div className="mt-6 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Object.values(
              suite.artifacts,
            ).map(
              (
                artifact,
              ) => {
                const shadowMetric =
                  evaluation
                    ?.byHorizon
                    .find(
                      (item) =>
                        item.horizon ===
                        artifact.horizon,
                    );

                return (
                  <article
                    key={
                      artifact.horizon
                    }
                    className="rounded-2xl border border-white/8 bg-black/30 p-5"
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="font-black text-white">
                          {artifact.label}
                        </h3>

                        <p className="mt-1 text-[10px] uppercase tracking-[0.12em] text-slate-600">
                          {artifact.horizon}
                        </p>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusClass(
                          artifact.status,
                        )}`}
                      >
                        {artifact.status}
                      </span>
                    </div>

                    <div className="mt-5 grid grid-cols-2 gap-3 text-xs">
                      <div>
                        <div className="text-slate-600">
                          Samples
                        </div>

                        <div className="mt-1 font-black text-white">
                          {artifact.sampleCount}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-600">
                          Return scale
                        </div>

                        <div className="mt-1 font-black text-white">
                          {number(
                            artifact.returnScale,
                          )}
                          %
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-600">
                          Validation Brier
                        </div>

                        <div className="mt-1 font-black text-white">
                          {number(
                            artifact
                              .validationMetrics
                              .brierScore,
                            4,
                          )}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-600">
                          Validation direction
                        </div>

                        <div className="mt-1 font-black text-white">
                          {number(
                            artifact
                              .validationMetrics
                              .directionalAccuracyPercent,
                          )}
                          %
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-600">
                          Shadow outcomes
                        </div>

                        <div className="mt-1 font-black text-white">
                          {shadowMetric
                            ?.sampleCount ??
                            0}
                        </div>
                      </div>

                      <div>
                        <div className="text-slate-600">
                          Shadow Brier
                        </div>

                        <div className="mt-1 font-black text-white">
                          {number(
                            shadowMetric
                              ?.brierScore ??
                              0,
                            4,
                          )}
                        </div>
                      </div>
                    </div>
                  </article>
                );
              },
            )}
          </div>
        </section>
      ) : null}

      <section className="mt-6 rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
        <h2 className="text-xl font-black text-white">
          Immutable Model Artifacts
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
                    {model.displayName}
                  </div>

                  <div className="mt-1 break-all text-xs text-slate-600">
                    {model.modelVersion}
                  </div>
                </div>

                <div className="flex items-center gap-4">
                  <span
                    className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusClass(
                      model.status,
                    )}`}
                  >
                    {model.status}
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

          {!loading &&
          !overview?.models.length ? (
            <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
              No trained model artifact exists. The prior suite will
              continue operating in shadow mode.
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}