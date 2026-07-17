"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type Metrics = {
  sampleCount?: number;
  brierScore?: number;
  logLoss?: number;
  directionalAccuracyPercent?: number;
  intervalCoveragePercent?: number;
  meanAbsoluteReturnError?: number;
  expectedCalibrationError?: number;
};

type Gate = {
  key: string;
  passed: boolean;
  required: boolean;
  actual?: unknown;
  threshold?: unknown;
};

type Backtest = {
  id: string;
  status: string;
  modelVersion: string;
  completedAt: string | null;
  holdoutSampleCount: number;
  recommendation: string;
  pointInTimeSafe: boolean;
  overallMetrics: Metrics;
  gates: {
    allPassed?: boolean;
    items?: Gate[];
  };
};

type DriftAlert = {
  id: string;
  horizon: string;
  severity: string;
  reason: string;
  brierScoreChange: number;
  directionalAccuracyChange: number;
  intervalCoverageChange: number;
  meanAbsoluteErrorChange: number;
  createdAt: string;
};

type ForecastModel = {
  id: string;
  displayName: string;
  modelVersion: string;
  engineVersion: string;
  calibrationVersion: string;
  status: string;
  promotedAt: string | null;
  backtestRuns: Backtest[];
  driftAlerts: DriftAlert[];
};

type Overview = {
  ok: boolean;
  generatedAt: string;
  models: ForecastModel[];
  safeguards: {
    autonomousTradingEnabled: boolean;
    automaticModelPromotionEnabled: boolean;
    humanApprovalRequired: boolean;
    pointInTimeValidationRequired: boolean;
  };
  error?: string;
};

function metric(value: number | undefined, decimals = 2) {
  return typeof value === "number" && Number.isFinite(value)
    ? value.toFixed(decimals)
    : "—";
}

function statusClass(status: string) {
  if (status === "Production") {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
  }

  if (status === "Candidate") {
    return "border-amber-400/25 bg-amber-500/10 text-amber-100";
  }

  if (status === "Disabled") {
    return "border-red-400/25 bg-red-500/10 text-red-100";
  }

  return "border-blue-400/20 bg-blue-500/10 text-blue-100";
}

export default function ModelGovernancePage() {
  const [overview, setOverview] =
    useState<Overview | null>(null);

  const [loading, setLoading] = useState(true);
  const [activeAction, setActiveAction] =
    useState<string | null>(null);

  const [message, setMessage] = useState(
    "Loading model registry and validation status.",
  );

  const loadOverview = useCallback(async () => {
    setLoading(true);

    try {
      const response = await fetch(
        "/api/intelligence/forecast/backtest",
        {
          cache: "no-store",
        },
      );

      const body = (await response.json()) as Overview;

      if (!response.ok) {
        throw new Error(
          body.error ?? "Unable to load model governance.",
        );
      }

      setOverview(body);
      setMessage(
        "Model registry loaded. No model is promoted automatically.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load model governance.",
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadOverview();
  }, [loadOverview]);

  async function runValidation(modelVersion: string) {
    setActiveAction(`validate:${modelVersion}`);
    setMessage(`Validating ${modelVersion}…`);

    try {
      const response = await fetch(
        "/api/intelligence/forecast/backtest",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            modelVersion,
          }),
        },
      );

      const body = (await response.json()) as {
        error?: string;
        detail?: string;
        recommendation?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.detail ??
            body.error ??
            "Validation failed.",
        );
      }

      setMessage(
        body.recommendation ??
          "Validation completed.",
      );

      await loadOverview();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Validation failed.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  async function promoteModel(model: ForecastModel) {
    const reason = window.prompt(
      `Document why ${model.modelVersion} should become production:`,
    );

    if (!reason) return;

    const confirmed = window.confirm(
      "Promote this model? The prior production model will return to Shadow status. Trading remains disabled.",
    );

    if (!confirmed) return;

    setActiveAction(`promote:${model.id}`);

    try {
      const response = await fetch(
        "/api/intelligence/forecast/models",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            action: "promote",
            modelId: model.id,
            reason,
          }),
        },
      );

      const body = (await response.json()) as {
        error?: string;
        detail?: string;
      };

      if (!response.ok) {
        throw new Error(
          body.detail ??
            body.error ??
            "Promotion was rejected.",
        );
      }

      setMessage(
        `${model.modelVersion} was promoted after human approval.`,
      );

      await loadOverview();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Promotion failed.",
      );
    } finally {
      setActiveAction(null);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-red-500/15 bg-gradient-to-br from-red-950/30 via-black to-black p-6 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300">
          Slice Model Risk Management
        </p>

        <h1 className="mt-3 text-3xl font-black text-white sm:text-5xl">
          Model Governance
        </h1>

        <p className="mt-4 max-w-4xl text-sm leading-7 text-slate-400">
          Validate stored point-in-time forecasts, compare model
          versions, enforce promotion gates, and detect degradation.
          Models cannot promote themselves and cannot execute trades.
        </p>

        <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
          {message}
        </div>

        <button
          type="button"
          onClick={() => void loadOverview()}
          className="mt-4 rounded-xl border border-white/10 bg-white/[0.04] px-5 py-3 text-sm font-black text-white hover:bg-white/[0.08]"
        >
          Refresh Registry
        </button>
      </section>

      {loading ? (
        <div className="mt-6 rounded-2xl border border-white/8 p-8 text-center text-slate-500">
          Loading model governance…
        </div>
      ) : null}

      <section className="mt-6 space-y-5">
        {(overview?.models ?? []).map((model) => {
          const latest = model.backtestRuns[0];
          const metrics = latest?.overallMetrics ?? {};
          const gates = latest?.gates.items ?? [];
          const canPromote =
            latest?.gates.allPassed === true &&
            model.status !== "Production";

          return (
            <article
              key={model.id}
              className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6"
            >
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div>
                  <div className="flex flex-wrap items-center gap-3">
                    <h2 className="text-2xl font-black text-white">
                      {model.displayName}
                    </h2>

                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-black uppercase ${statusClass(
                        model.status,
                      )}`}
                    >
                      {model.status}
                    </span>
                  </div>

                  <p className="mt-2 text-xs text-slate-500">
                    {model.engineVersion} ·{" "}
                    {model.calibrationVersion}
                  </p>
                </div>

                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    disabled={Boolean(activeAction)}
                    onClick={() =>
                      void runValidation(model.modelVersion)
                    }
                    className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 disabled:opacity-40"
                  >
                    {activeAction ===
                    `validate:${model.modelVersion}`
                      ? "Validating…"
                      : "Run Validation"}
                  </button>

                  {canPromote ? (
                    <button
                      type="button"
                      disabled={Boolean(activeAction)}
                      onClick={() => void promoteModel(model)}
                      className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100 disabled:opacity-40"
                    >
                      Promote After Review
                    </button>
                  ) : null}
                </div>
              </div>

              <div className="mt-5 grid gap-3 sm:grid-cols-2 lg:grid-cols-6">
                {[
                  ["Holdout Samples", latest?.holdoutSampleCount ?? 0],
                  ["Brier", metric(metrics.brierScore, 4)],
                  ["Log Loss", metric(metrics.logLoss, 4)],
                  [
                    "Direction",
                    `${metric(
                      metrics.directionalAccuracyPercent,
                    )}%`,
                  ],
                  [
                    "Coverage",
                    `${metric(
                      metrics.intervalCoveragePercent,
                    )}%`,
                  ],
                  [
                    "Calibration Error",
                    metric(
                      metrics.expectedCalibrationError,
                      4,
                    ),
                  ],
                ].map(([label, value]) => (
                  <div
                    key={String(label)}
                    className="rounded-xl border border-white/8 bg-black/30 p-4"
                  >
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                      {label}
                    </div>
                    <div className="mt-2 text-xl font-black text-white">
                      {value}
                    </div>
                  </div>
                ))}
              </div>

              {latest ? (
                <div className="mt-5">
                  <h3 className="text-sm font-black text-white">
                    Promotion gates
                  </h3>

                  <div className="mt-3 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                    {gates.map((gate) => (
                      <div
                        key={gate.key}
                        className={`rounded-xl border p-3 text-xs ${
                          gate.passed
                            ? "border-emerald-400/20 bg-emerald-500/[0.06] text-emerald-100"
                            : "border-red-400/20 bg-red-500/[0.06] text-red-100"
                        }`}
                      >
                        <div className="font-black">
                          {gate.passed ? "PASS" : "FAIL"} ·{" "}
                          {gate.key}
                        </div>
                      </div>
                    ))}
                  </div>

                  <p className="mt-3 text-sm text-slate-400">
                    Recommendation:{" "}
                    <strong className="text-white">
                      {latest.recommendation}
                    </strong>
                  </p>
                </div>
              ) : (
                <p className="mt-5 text-sm text-slate-500">
                  No validation run has been completed for this
                  version.
                </p>
              )}

              {model.driftAlerts.length ? (
                <div className="mt-6">
                  <h3 className="text-sm font-black text-red-200">
                    Open drift alerts
                  </h3>

                  <div className="mt-3 grid gap-3">
                    {model.driftAlerts.map((alert) => (
                      <div
                        key={alert.id}
                        className="rounded-xl border border-red-400/20 bg-red-500/[0.06] p-4 text-xs text-red-100"
                      >
                        <div className="font-black">
                          {alert.severity} · {alert.horizon}
                        </div>
                        <div className="mt-2">{alert.reason}</div>
                        <div className="mt-2 text-red-200/70">
                          Brier change{" "}
                          {metric(alert.brierScoreChange, 4)} ·
                          Accuracy change{" "}
                          {metric(
                            alert.directionalAccuracyChange,
                          )}
                          %
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : null}
            </article>
          );
        })}
      </section>
    </main>
  );
}