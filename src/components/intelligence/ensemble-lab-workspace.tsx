"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  FlaskConical,
  Gauge,
  GitMerge,
  Play,
  RefreshCw,
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
} from "react";

import {
  IntelligenceMetric,
  IntelligenceNotice,
  IntelligencePage,
  IntelligencePill,
  IntelligenceSectionHeading,
  IntelligenceSurface,
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
  intelligenceFetch,
  isAbortError,
} from "@/lib/intelligence/client";

type EnsembleMetrics = {
  sampleCount: number;
  brierScore: number;
  logLoss: number;
  directionalAccuracyPercent: number;
  expectedCalibrationError: number;
  meanAbsoluteReturnError: number;
  returnBias: number;
  averageProbability: number;
  observedPositivePercent: number;
};

type ComponentWeights = {
  production: number;
  horizonModel: number;
  agentSimulation: number;
};

type EnsembleArtifact = {
  horizon: string;
  status: "TRAINED" | "PRIOR";
  sampleCount: number;
  trainingCount: number;
  validationCount: number;
  probabilityWeights: ComponentWeights;
  returnWeights: ComponentWeights;
  calibration: {
    slope: number;
    intercept: number;
  };
  trainingMetrics: EnsembleMetrics;
  validationMetrics: EnsembleMetrics;
  productionOnlyMetrics: EnsembleMetrics;
  componentCoverage: {
    production: number;
    horizonModel: number;
    agentSimulation: number;
  };
  componentAblations: Array<{
    component: string;
    conclusion: string;
    brierDelta: number;
    accuracyDelta: number;
    returnErrorDelta: number;
  }>;
  featureAblations: Array<{
    feature: string;
    affectedSampleCount: number;
    brierDelta: number;
    accuracyDelta: number;
    returnErrorDelta: number;
    recommendation: string;
  }>;
  recommendedFeatureRemovals: string[];
  promotionGates: {
    allPassed: boolean;
    items: Array<{
      key: string;
      passed: boolean;
      actual: number | boolean;
      threshold: number | boolean;
      detail: string;
    }>;
  };
};

type EnsembleSuite = {
  schemaVersion: string;
  family: string;
  modelVersion: string;
  engineVersion: string;
  calibrationVersion: string;
  trainedAt: string;
  status: "TRAINED" | "PRIOR";
  totalEligibleSamples: number;
  artifacts: Record<string, EnsembleArtifact>;
  safeguards: {
    autonomousTradingEnabled: false;
    automaticPromotionEnabled: false;
    simulationTreatedAsTruth: false;
    shadowOnly: true;
    featureRemovalAutomatic: false;
  };
};

type EnsembleEvaluation = {
  generatedAt: string;
  modelVersion: string | null;
  predictionCount: number;
  matchedOutcomeCount: number;
  overall: EnsembleMetrics;
  byHorizon: Array<
    EnsembleMetrics & {
      horizon: string;
    }
  >;
};

type EnsembleResponse = {
  ok: true;
  generatedAt: string;
  activeSuite: EnsembleSuite;
  models: Array<{
    id: string;
    displayName: string;
    modelVersion: string;
    engineVersion: string;
    calibrationVersion: string;
    status: string;
    createdAt: string;
    promotedAt: string | null;
  }>;
  evaluation: EnsembleEvaluation;
  recentPredictions: Array<{
    eventId: string;
    createdAt: string;
    forecastRunId: string;
    modelVersion: string;
    horizon: string;
    probability: number;
    expectedReturnPercent: number;
    direction: string;
    confidence: number;
  }>;
  memory: ClientOperatingMemory;
  operatingMode: string;
  terminology: {
    evaluation: string;
    promotion: string;
  };
  safeguards: {
    autonomousTradingEnabled: false;
    automaticPromotionEnabled: false;
    automaticFeatureRemovalEnabled: false;
    simulationTreatedAsTruth: false;
    activeMode: string;
  };
};

const HORIZON_ORDER = [
  "5-30m",
  "intraday",
  "1d",
  "2-5d",
  "1-4w",
  "1-3m",
  "3-12m",
  "1-3y",
] as const;

function percentageWeight(value: number) {
  return `${formatIntelligenceNumber(value * 100, 1)}%`;
}

function healthTone(value: number, lowerBetter = false) {
  const healthy = lowerBetter ? value > 0 && value <= 0.25 : value >= 52;
  return healthy ? ("emerald" as const) : ("amber" as const);
}

export default function EnsembleLabWorkspace() {
  const [data, setData] = useState<EnsembleResponse | null>(null);
  const [selectedRunId, setSelectedRunId] = useState("");
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<"train" | "generate" | null>(
    null,
  );
  const [confirmTraining, setConfirmTraining] = useState(false);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState(
    "Loading calibrated ensemble operating state.",
  );
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (quiet = false) => {
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;

    if (!quiet) {
      setLoading(true);
      setMessage("Loading ensemble artifacts, components, and memory.");
    }

    try {
      const response = await intelligenceFetch<EnsembleResponse>(
        "/api/intelligence/forecast/ensemble?days=30",
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
      setSelectedRunId((current) => {
        if (
          current &&
          response.memory.recentRuns.some((run) => run.id === current)
        ) {
          return current;
        }

        return response.memory.recentRuns[0]?.id ?? "";
      });
      setMessage(
        `${response.operatingMode} loaded with ${response.memory.summary.ensemblePredictions.toLocaleString()} retained ensemble predictions.`,
      );
    } catch (caught) {
      if (isAbortError(caught) || !mounted.current) return;

      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load ensemble operations.",
      );
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

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
      busy: Boolean(operation) || loading,
    },
  );

  async function runAction(action: "train" | "generate") {
    if (action === "generate" && !selectedRunId) {
      setError("Select a retained forecast run first.");
      return;
    }

    setOperation(action);
    setError("");
    setMessage(
      action === "train"
        ? "Training calibrated component weights and probability calibration from eligible settled outcomes."
        : "Generating calibrated ensemble predictions for the selected retained forecast.",
    );

    try {
      const response = await intelligenceFetch<{
        ok: true;
        message?: string;
      }>(
        "/api/intelligence/forecast/ensemble",
        {
          method: "POST",
          body: JSON.stringify(
            action === "train"
              ? {
                  action: "train",
                }
              : {
                  action: "generate-run",
                  runId: selectedRunId,
                },
          ),
        },
        {
          timeoutMs: 118_000,
        },
      );

      if (!mounted.current) return;

      setConfirmTraining(false);
      setMessage(
        response.message ??
          (action === "train"
            ? "Ensemble training completed."
            : "Calibrated ensemble predictions were retained."),
      );
      await load(true);
    } catch (caught) {
      if (isAbortError(caught) || !mounted.current) return;

      setError(
        caught instanceof Error
          ? caught.message
          : "The ensemble operation did not complete.",
      );
    } finally {
      if (mounted.current) setOperation(null);
    }
  }

  const artifacts = useMemo(
    () =>
      HORIZON_ORDER.flatMap((horizon) => {
        const artifact = data?.activeSuite.artifacts[horizon];
        return artifact ? [artifact] : [];
      }),
    [data],
  );
  const trainedCount = artifacts.filter(
    (artifact) => artifact.status === "TRAINED",
  ).length;
  const gatesPassed = artifacts.filter(
    (artifact) => artifact.promotionGates.allPassed,
  ).length;
  const selectedRun = data?.memory.recentRuns.find(
    (run) => run.id === selectedRunId,
  );

  return (
    <IntelligencePage>
      <IntelligenceSurface className="overflow-hidden">
        <div className="bg-[radial-gradient(circle_at_8%_0%,rgba(6,182,212,0.10),transparent_34%),radial-gradient(circle_at_94%_5%,rgba(16,185,129,0.12),transparent_36%)] p-5 sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-5xl">
              <OperatingMemoryPills
                memory={data?.memory ?? null}
                online={online}
                busy={Boolean(operation)}
              >
                {data ? (
                  <IntelligencePill tone={statusTone(data.activeSuite.status)}>
                    <FlaskConical className="h-3.5 w-3.5" />
                    {data.activeSuite.status}
                  </IntelligencePill>
                ) : null}
              </OperatingMemoryPills>

              <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] text-[var(--slice-heading)] sm:text-5xl xl:text-6xl">
                Calibrated ensemble intelligence across every horizon.
              </h1>
              <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-[var(--slice-muted)] sm:text-base">
                Slice combines the stored production forecast, independent
                horizon model, and agent simulation when those components are
                available. Applied weights are renormalized, calibrated, and
                retained with validation and ablation evidence.
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

          <div className="mt-7 grid gap-3 xl:grid-cols-[minmax(280px,1fr)_auto_auto_auto]">
            <label className="grid min-h-14 gap-1 rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 py-2.5 shadow-sm">
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">
                Retained forecast run
              </span>
              <select
                value={selectedRunId}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setSelectedRunId(event.target.value)
                }
                disabled={!data?.memory.recentRuns.length || Boolean(operation)}
                className="min-w-0 bg-transparent text-sm font-black text-[var(--slice-heading)] outline-none disabled:opacity-50"
              >
                {!data?.memory.recentRuns.length ? (
                  <option value="">No forecast runs in memory</option>
                ) : null}
                {data?.memory.recentRuns.map((run) => (
                  <option key={run.id} value={run.id}>
                    {run.symbol} · {formatIntelligenceDate(run.generatedAt)} ·{" "}
                    {run.status}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || Boolean(operation)}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-5 text-sm font-black text-[var(--slice-text)] shadow-sm transition hover:border-[var(--slice-accent-border)] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh state
            </button>

            <button
              type="button"
              onClick={() => void runAction("generate")}
              disabled={
                !selectedRunId || loading || Boolean(operation) || !online
              }
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--slice-accent-strong)] px-5 text-sm font-black text-white shadow-[0_14px_32px_var(--slice-accent-glow)] disabled:opacity-50"
            >
              {operation === "generate" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              Generate ensemble
            </button>

            <button
              type="button"
              onClick={() => setConfirmTraining(true)}
              disabled={loading || Boolean(operation) || !online}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-cyan-600/20 bg-cyan-50 px-5 text-sm font-black text-cyan-800 transition hover:bg-cyan-100 disabled:opacity-50 dark:border-cyan-400/25 dark:bg-cyan-500/10 dark:text-cyan-100"
            >
              <BrainCircuit className="h-4 w-4" />
              Train ensemble
            </button>
          </div>

          {selectedRun ? (
            <p className="mt-3 text-[10px] font-semibold text-[var(--slice-muted)]">
              Selected run: {selectedRun.symbol}, generated{" "}
              {formatIntelligenceDate(selectedRun.generatedAt)}, provider as of{" "}
              {formatIntelligenceDate(selectedRun.asOfAt)}.
            </p>
          ) : null}

          {confirmTraining ? (
            <IntelligenceNotice
              className="mt-4"
              tone="cyan"
              icon={<ShieldCheck className="h-5 w-5" />}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-black">
                    Confirm chronological ensemble training
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5">
                    Training optimizes component weights and calibration on
                    settled, point-in-time-safe outcomes. It records feature
                    and component ablations but removes nothing automatically.
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmTraining(false)}
                    className="min-h-10 rounded-xl border border-current/20 px-3 text-[11px] font-black"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void runAction("train")}
                    className="min-h-10 rounded-xl bg-cyan-700 px-4 text-[11px] font-black text-white"
                  >
                    Train calibrated ensemble
                  </button>
                </div>
              </div>
            </IntelligenceNotice>
          ) : null}

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

          {data && !data.memory.recentRuns.length ? (
            <IntelligenceNotice
              className="mt-4"
              tone="amber"
              icon={<Target className="h-4 w-4" />}
            >
              No retained forecast run is available. Create a current,
              point-in-time forecast in the{" "}
              <Link
                href="/workspace/intelligence/forecast-lab"
                prefetch={false}
                className="font-black underline"
              >
                Forecast Lab
              </Link>{" "}
              before generating a calibrated ensemble.
            </IntelligenceNotice>
          ) : null}
        </div>
      </IntelligenceSurface>

      {data ? (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <IntelligenceMetric
              label="Suite status"
              value={data.activeSuite.status}
              helper={data.operatingMode}
              icon={<FlaskConical className="h-5 w-5" />}
              tone={statusTone(data.activeSuite.status)}
            />
            <IntelligenceMetric
              label="Trained horizons"
              value={`${trainedCount} / ${artifacts.length || 8}`}
              helper="Calibrated horizon artifacts."
              icon={<Target className="h-5 w-5" />}
              tone={trainedCount === 8 ? "emerald" : "amber"}
            />
            <IntelligenceMetric
              label="Gates passed"
              value={`${gatesPassed} / ${artifacts.length || 8}`}
              helper="Per-horizon promotion gates."
              icon={<ShieldCheck className="h-5 w-5" />}
              tone={gatesPassed === 8 ? "emerald" : "amber"}
            />
            <IntelligenceMetric
              label="Eligible samples"
              value={formatIntelligenceInteger(
                data.activeSuite.totalEligibleSamples,
              )}
              helper="Settled ensemble training rows."
              icon={<Database className="h-5 w-5" />}
              tone="cyan"
            />
            <IntelligenceMetric
              label="Predictions in memory"
              value={formatIntelligenceInteger(
                data.memory.summary.ensemblePredictions,
              )}
              helper={data.memory.window.label}
              icon={<GitMerge className="h-5 w-5" />}
              tone="violet"
            />
            <IntelligenceMetric
              label="Directional accuracy"
              value={`${formatIntelligenceNumber(
                data.evaluation.overall.directionalAccuracyPercent,
                1,
              )}%`}
              helper="Matched settled outcomes."
              icon={<TrendingUp className="h-5 w-5" />}
              tone={healthTone(
                data.evaluation.overall.directionalAccuracyPercent,
              )}
            />
            <IntelligenceMetric
              label="Brier score"
              value={formatIntelligenceNumber(
                data.evaluation.overall.brierScore,
                4,
              )}
              helper="Calibrated probability error."
              icon={<Gauge className="h-5 w-5" />}
              tone={healthTone(
                data.evaluation.overall.brierScore,
                true,
              )}
            />
          </section>

          <IntelligenceSurface className="mt-5 p-5 sm:p-6">
            <IntelligenceSectionHeading
              eyebrow="Calibrated horizon artifacts"
              title="Component weights, coverage, and validation"
              description="Weights are applied only to available components, then renormalized. Each horizon retains independent probability, return, calibration, ablation, and gate evidence."
              action={
                <IntelligencePill tone={statusTone(data.activeSuite.status)}>
                  <Clock3 className="h-3.5 w-3.5" />
                  Trained {formatIntelligenceDate(data.activeSuite.trainedAt)}
                </IntelligencePill>
              }
            />

            <div className="mt-5 grid gap-3 xl:grid-cols-2">
              {artifacts.map((artifact) => (
                <article
                  key={artifact.horizon}
                  className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-5 shadow-sm"
                >
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <IntelligencePill tone={statusTone(artifact.status)}>
                          {artifact.status}
                        </IntelligencePill>
                        <IntelligencePill
                          tone={
                            artifact.promotionGates.allPassed
                              ? "emerald"
                              : "amber"
                          }
                        >
                          {artifact.promotionGates.allPassed
                            ? "Gates passed"
                            : "Review gates"}
                        </IntelligencePill>
                      </div>
                      <h3 className="mt-3 text-xl font-black text-[var(--slice-heading)]">
                        {artifact.horizon}
                      </h3>
                      <p className="mt-1 text-xs font-semibold text-[var(--slice-muted)]">
                        {artifact.sampleCount.toLocaleString()} samples ·{" "}
                        {artifact.validationCount.toLocaleString()} validation
                      </p>
                    </div>

                    <div className="grid grid-cols-3 gap-2 text-center sm:w-72">
                      {[
                        [
                          "Brier",
                          formatIntelligenceNumber(
                            artifact.validationMetrics.brierScore,
                            4,
                          ),
                        ],
                        [
                          "Accuracy",
                          `${formatIntelligenceNumber(
                            artifact.validationMetrics
                              .directionalAccuracyPercent,
                            1,
                          )}%`,
                        ],
                        [
                          "Calibration",
                          formatIntelligenceNumber(
                            artifact.validationMetrics
                              .expectedCalibrationError,
                            4,
                          ),
                        ],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-2.5"
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

                  <div className="mt-4 grid gap-3 lg:grid-cols-2">
                    <div className="rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[var(--slice-subtle)]">
                        Probability weights
                      </p>
                      <div className="mt-3 space-y-2">
                        {[
                          ["Production", artifact.probabilityWeights.production],
                          [
                            "Horizon model",
                            artifact.probabilityWeights.horizonModel,
                          ],
                          [
                            "Agent simulation",
                            artifact.probabilityWeights.agentSimulation,
                          ],
                        ].map(([label, weight]) => (
                          <div
                            key={String(label)}
                            className="flex items-center justify-between gap-3 text-xs font-bold text-[var(--slice-muted)]"
                          >
                            <span>{label}</span>
                            <span className="text-[var(--slice-heading)]">
                              {percentageWeight(Number(weight))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>

                    <div className="rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-4">
                      <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[var(--slice-subtle)]">
                        Component coverage
                      </p>
                      <div className="mt-3 space-y-2">
                        {[
                          ["Production", artifact.componentCoverage.production],
                          [
                            "Horizon model",
                            artifact.componentCoverage.horizonModel,
                          ],
                          [
                            "Agent simulation",
                            artifact.componentCoverage.agentSimulation,
                          ],
                        ].map(([label, coverage]) => (
                          <div
                            key={String(label)}
                            className="flex items-center justify-between gap-3 text-xs font-bold text-[var(--slice-muted)]"
                          >
                            <span>{label}</span>
                            <span className="text-[var(--slice-heading)]">
                              {percentageWeight(Number(coverage))}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <IntelligencePill tone="slate">
                      Calibration slope{" "}
                      {formatIntelligenceNumber(
                        artifact.calibration.slope,
                        3,
                      )}
                    </IntelligencePill>
                    <IntelligencePill tone="slate">
                      Intercept{" "}
                      {formatIntelligenceNumber(
                        artifact.calibration.intercept,
                        3,
                      )}
                    </IntelligencePill>
                    {artifact.recommendedFeatureRemovals.length ? (
                      <IntelligencePill tone="amber">
                        {artifact.recommendedFeatureRemovals.length} review
                        candidate
                        {artifact.recommendedFeatureRemovals.length === 1
                          ? ""
                          : "s"}
                      </IntelligencePill>
                    ) : (
                      <IntelligencePill tone="emerald">
                        No removal candidates
                      </IntelligencePill>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </IntelligenceSurface>

          <section className="mt-5 grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
            <IntelligenceSurface className="p-5 sm:p-6">
              <IntelligenceSectionHeading
                eyebrow="Model registry"
                title="Stored ensemble suites"
                description="Every trained suite remains versioned with its engine, calibration, status, and creation time."
              />
              <div className="mt-5 space-y-3">
                {data.models.length ? (
                  data.models.map((model) => (
                    <article
                      key={model.id}
                      className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4"
                    >
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0">
                          <IntelligencePill tone={statusTone(model.status)}>
                            {model.status}
                          </IntelligencePill>
                          <h3 className="mt-3 truncate text-sm font-black text-[var(--slice-heading)]">
                            {model.displayName}
                          </h3>
                          <p className="mt-1 break-all text-[10px] font-semibold text-[var(--slice-muted)]">
                            {model.modelVersion}
                          </p>
                        </div>
                        <div className="text-right text-[10px] font-semibold text-[var(--slice-muted)]">
                          <p>{formatIntelligenceDate(model.createdAt)}</p>
                          <p className="mt-1">{model.calibrationVersion}</p>
                        </div>
                      </div>
                    </article>
                  ))
                ) : (
                  <IntelligenceNotice tone="amber">
                    No stored ensemble suite exists yet. Training will create
                    the first governed artifact.
                  </IntelligenceNotice>
                )}
              </div>
            </IntelligenceSurface>

            <IntelligenceSurface className="p-5 sm:p-6">
              <IntelligenceSectionHeading
                eyebrow="Operating memory"
                title="Recent calibrated predictions"
                description="Each prediction retains its source run, model version, horizon, probability, expected return, confidence, and timestamp."
              />
              <div className="mt-5 space-y-3">
                {data.memory.ensemblePredictions.slice(0, 10).map(
                  (prediction) => (
                    <article
                      key={prediction.id}
                      className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="text-sm font-black text-[var(--slice-heading)]">
                            {prediction.symbol ?? "Forecast"} ·{" "}
                            {prediction.horizon ?? "Horizon"}
                          </p>
                          <p className="mt-1 text-[10px] font-semibold text-[var(--slice-muted)]">
                            {formatIntelligenceDate(prediction.createdAt)}
                          </p>
                        </div>
                        <IntelligencePill
                          tone={statusTone(
                            prediction.direction ?? prediction.status,
                          )}
                        >
                          {prediction.direction ?? prediction.status}
                        </IntelligencePill>
                      </div>
                      <div className="mt-3 flex flex-wrap gap-3 text-[10px] font-black text-[var(--slice-muted)]">
                        <span>
                          Probability{" "}
                          {formatIntelligenceNumber(
                            prediction.probability,
                            1,
                          )}
                          %
                        </span>
                        <span>
                          Return{" "}
                          {formatIntelligencePercent(
                            prediction.expectedReturnPercent,
                            2,
                          )}
                        </span>
                        <span>
                          Confidence{" "}
                          {formatIntelligenceNumber(
                            prediction.confidence,
                            0,
                          )}
                          %
                        </span>
                      </div>
                    </article>
                  ),
                )}

                {!data.memory.ensemblePredictions.length ? (
                  <IntelligenceNotice tone="slate">
                    No ensemble predictions are retained in the current
                    operating-memory window. Select a forecast run and generate
                    an ensemble.
                  </IntelligenceNotice>
                ) : null}
              </div>
            </IntelligenceSurface>
          </section>

          <IntelligenceSurface className="mt-5 p-5 sm:p-6">
            <IntelligenceSectionHeading
              eyebrow="Governed operation"
              title="Component and promotion policy"
              description="The ensemble is an evidence layer with stored evaluation. It does not self-promote, remove features, treat simulations as truth, or place trades."
            />
            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              <IntelligenceNotice
                tone="cyan"
                icon={<GitMerge className="h-4 w-4" />}
              >
                {data.terminology.evaluation}
              </IntelligenceNotice>
              <IntelligenceNotice
                tone="violet"
                icon={<ShieldCheck className="h-4 w-4" />}
              >
                {data.terminology.promotion}
              </IntelligenceNotice>
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
                Loading ensemble operations
              </p>
            </div>
          </div>
        </IntelligenceSurface>
      ) : null}
    </IntelligencePage>
  );
}