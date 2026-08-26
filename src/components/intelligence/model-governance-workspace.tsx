"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  BarChart3,
  CheckCircle2,
  ClipboardCheck,
  Clock3,
  Gauge,
  RefreshCw,
  Rocket,
  ShieldCheck,
  TriangleAlert,
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
  formatIntelligenceDate,
  formatIntelligenceInteger,
  formatIntelligenceNumber,
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

type Gate = {
  key: string;
  passed: boolean;
  detail: string;
  actual?: number | boolean;
  threshold?: number | boolean;
};

type Backtest = {
  id: string;
  status: string;
  modelVersion: string;
  createdAt: string;
  completedAt: string | null;
  eligibleSampleCount: number;
  excludedSampleCount: number;
  holdoutSampleCount: number;
  pointInTimeSafe: boolean;
  lookaheadDetected: boolean;
  recommendation: string | null;
  overallMetrics: Record<string, unknown>;
  horizonMetrics: Array<Record<string, unknown>>;
  regimeMetrics: Array<Record<string, unknown>>;
  comparison: Record<string, unknown>;
  gates: {
    allPassed?: boolean;
    items?: Gate[];
  };
};

type DriftAlert = {
  id: string;
  modelVersion: string;
  horizon: string;
  regime: string;
  severity: string;
  status: string;
  reason: string;
  createdAt: string;
  currentWindowEndAt: string | null;
  evidence: Record<string, unknown>;
};

type GovernanceModel = {
  id: string;
  modelKey: string;
  displayName: string;
  description: string | null;
  engineVersion: string;
  modelVersion: string;
  calibrationVersion: string;
  status: string;
  createdAt: string;
  updatedAt: string;
  promotedAt: string | null;
  disabledAt: string | null;
  promotionGates: Record<string, unknown>;
  backtestRuns: Backtest[];
  driftAlerts: DriftAlert[];
};

type GovernanceResponse = {
  ok: true;
  generatedAt: string;
  safeguards: {
    autonomousTradingEnabled: false;
    automaticModelPromotionEnabled: false;
    humanApprovalRequired: true;
    pointInTimeValidationRequired: true;
  };
  models: GovernanceModel[];
  memory: ClientOperatingMemory;
  operatingPolicy: {
    memoryWindow: ClientOperatingMemory["window"];
    validationDataset: string;
    recentOperatingState: string;
  };
};

function numberFrom(
  object: Record<string, unknown>,
  keys: string[],
) {
  for (const key of keys) {
    const parsed = Number(object[key]);
    if (Number.isFinite(parsed)) return parsed;
  }

  return null;
}

function latestCompletedBacktest(model: GovernanceModel) {
  return model.backtestRuns.find(
    (run) => run.status === "Completed",
  );
}

export default function ModelGovernanceWorkspace() {
  const [data, setData] = useState<GovernanceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<
    "validate" | "promote" | null
  >(null);
  const [selectedModelId, setSelectedModelId] = useState("");
  const [promotionModelId, setPromotionModelId] = useState("");
  const [promotionReason, setPromotionReason] = useState("");
  const [confirmValidation, setConfirmValidation] = useState(false);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState(
    "Loading model registry, validation history, drift alerts, and operating memory.",
  );
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const load = useCallback(async (quiet = false) => {
    controller.current?.abort();
    const nextController = new AbortController();
    controller.current = nextController;

    if (!quiet) setLoading(true);

    try {
      const response = await intelligenceFetch<GovernanceResponse>(
        "/api/intelligence/forecast/backtest?days=30",
        {
          signal: nextController.signal,
        },
        {
          timeoutMs: 40_000,
          retries: 1,
        },
      );

      if (!mounted.current) return;

      setData(response);
      setError("");
      setSelectedModelId((current) => {
        if (current && response.models.some((model) => model.id === current)) {
          return current;
        }

        return (
          response.models.find((model) => model.status === "Candidate")
            ?.id ??
          response.models.find((model) => model.status === "Shadow")?.id ??
          response.models[0]?.id ??
          ""
        );
      });
      setMessage(
        `${response.models.length.toLocaleString()} governed model artifacts and ${response.memory.summary.completedBacktests.toLocaleString()} completed validations are visible in operating memory.`,
      );
    } catch (caught) {
      if (isAbortError(caught) || !mounted.current) return;

      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to load model governance.",
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
      busy: loading || Boolean(operation),
    },
  );

  async function validateModel() {
    const model = data?.models.find(
      (item) => item.id === selectedModelId,
    );

    if (!model) {
      setError("Select a model to validate.");
      return;
    }

    setOperation("validate");
    setError("");
    setMessage(
      `Running chronological point-in-time validation for ${model.modelVersion}.`,
    );

    try {
      const response = await intelligenceFetch<{
        ok: true;
        message?: string;
      }>(
        "/api/intelligence/forecast/backtest",
        {
          method: "POST",
          body: JSON.stringify({
            modelVersion: model.modelVersion,
          }),
        },
        {
          timeoutMs: 118_000,
        },
      );

      if (!mounted.current) return;

      setConfirmValidation(false);
      setMessage(
        response.message ??
          "Chronological point-in-time validation completed.",
      );
      await load(true);
    } catch (caught) {
      if (isAbortError(caught) || !mounted.current) return;

      setError(
        caught instanceof Error
          ? caught.message
          : "Model validation did not complete.",
      );
    } finally {
      if (mounted.current) setOperation(null);
    }
  }

  async function promoteModel(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const reason = promotionReason.trim();

    if (!promotionModelId) {
      setError("Select a model to promote.");
      return;
    }

    if (reason.length < 10) {
      setError(
        "Provide a documented promotion reason of at least 10 characters.",
      );
      return;
    }

    setOperation("promote");
    setError("");
    setMessage("Applying human-approved model promotion.");

    try {
      await intelligenceFetch<{
        ok: true;
      }>(
        "/api/intelligence/forecast/models",
        {
          method: "POST",
          body: JSON.stringify({
            action: "promote",
            modelId: promotionModelId,
            reason,
          }),
        },
        {
          timeoutMs: 35_000,
        },
      );

      if (!mounted.current) return;

      setPromotionModelId("");
      setPromotionReason("");
      setMessage(
        "The validated model was promoted and the prior production model was moved to evaluation status.",
      );
      await load(true);
    } catch (caught) {
      if (isAbortError(caught) || !mounted.current) return;

      setError(
        caught instanceof Error
          ? caught.message
          : "Model promotion was rejected.",
      );
    } finally {
      if (mounted.current) setOperation(null);
    }
  }

  const productionCount =
    data?.models.filter((model) => model.status === "Production").length ?? 0;
  const candidateCount =
    data?.models.filter((model) => model.status === "Candidate").length ?? 0;
  const evaluationCount =
    data?.models.filter((model) => model.status === "Shadow").length ?? 0;
  const selectedModel = data?.models.find(
    (model) => model.id === selectedModelId,
  );
  const promotableModels = useMemo(
    () =>
      (data?.models ?? []).filter((model) => {
        const validation = latestCompletedBacktest(model);
        return (
          model.status !== "Production" &&
          validation?.gates.allPassed === true
        );
      }),
    [data],
  );

  return (
    <IntelligencePage>
      <IntelligenceSurface className="overflow-hidden">
        <div className="bg-[radial-gradient(circle_at_8%_0%,rgba(16,185,129,0.12),transparent_34%),radial-gradient(circle_at_95%_8%,rgba(124,58,237,0.09),transparent_34%)] p-5 sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-5xl">
              <OperatingMemoryPills
                memory={data?.memory ?? null}
                online={online}
                busy={Boolean(operation)}
              >
                <IntelligencePill tone="emerald">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  Human-gated governance
                </IntelligencePill>
              </OperatingMemoryPills>

              <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] text-[var(--slice-heading)] sm:text-5xl xl:text-6xl">
                Model validation, promotion, and drift control.
              </h1>
              <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-[var(--slice-muted)] sm:text-base">
                Slice maintains a versioned model registry, chronological
                point-in-time validation, promotion gates, audit logs, and
                rolling drift alerts. Production changes require completed
                validation and an explicit human reason.
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

          <div className="mt-7 grid gap-3 xl:grid-cols-[minmax(280px,1fr)_auto_auto]">
            <label className="grid min-h-14 gap-1 rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 py-2.5 shadow-sm">
              <span className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">
                Model for point-in-time validation
              </span>
              <select
                value={selectedModelId}
                onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                  setSelectedModelId(event.target.value)
                }
                disabled={!data?.models.length || Boolean(operation)}
                className="min-w-0 bg-transparent text-sm font-black text-[var(--slice-heading)] outline-none disabled:opacity-50"
              >
                {!data?.models.length ? (
                  <option value="">No model artifacts</option>
                ) : null}
                {data?.models.map((model) => (
                  <option key={model.id} value={model.id}>
                    {model.displayName} · {model.status}
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
              Refresh governance
            </button>

            <button
              type="button"
              onClick={() => setConfirmValidation(true)}
              disabled={!selectedModel || loading || Boolean(operation) || !online}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--slice-accent-strong)] px-5 text-sm font-black text-white shadow-[0_14px_32px_var(--slice-accent-glow)] disabled:opacity-50"
            >
              <ClipboardCheck className="h-4 w-4" />
              Validate model
            </button>
          </div>

          {confirmValidation && selectedModel ? (
            <IntelligenceNotice
              className="mt-4"
              tone="cyan"
              icon={<ClipboardCheck className="h-5 w-5" />}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="font-black">
                    Validate {selectedModel.displayName}
                  </p>
                  <p className="mt-1 text-xs font-semibold leading-5">
                    The backtest uses chronological settled outcomes, excludes
                    demo providers and look-ahead records, compares production
                    and candidate metrics, and stores gate evidence.
                  </p>
                </div>
                <div className="flex shrink-0 gap-2">
                  <button
                    type="button"
                    onClick={() => setConfirmValidation(false)}
                    className="min-h-10 rounded-xl border border-current/20 px-3 text-[11px] font-black"
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    onClick={() => void validateModel()}
                    className="min-h-10 rounded-xl bg-cyan-700 px-4 text-[11px] font-black text-white"
                  >
                    Run point-in-time validation
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
        </div>
      </IntelligenceSurface>

      {data ? (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-7">
            <IntelligenceMetric
              label="Production"
              value={formatIntelligenceInteger(productionCount)}
              helper="Human-promoted active artifacts."
              icon={<Rocket className="h-5 w-5" />}
              tone={productionCount === 1 ? "emerald" : "amber"}
            />
            <IntelligenceMetric
              label="Candidates"
              value={formatIntelligenceInteger(candidateCount)}
              helper="Artifacts awaiting validation or promotion."
              icon={<Gauge className="h-5 w-5" />}
              tone="violet"
            />
            <IntelligenceMetric
              label="Evaluation"
              value={formatIntelligenceInteger(evaluationCount)}
              helper="Stored non-production artifacts."
              icon={<BarChart3 className="h-5 w-5" />}
              tone="cyan"
            />
            <IntelligenceMetric
              label="Completed validations"
              value={formatIntelligenceInteger(
                data.memory.summary.completedBacktests,
              )}
              helper={data.memory.window.label}
              icon={<ClipboardCheck className="h-5 w-5" />}
            />
            <IntelligenceMetric
              label="Open drift alerts"
              value={formatIntelligenceInteger(
                data.memory.summary.openDriftAlerts,
              )}
              helper="Rolling-window performance review."
              icon={<TriangleAlert className="h-5 w-5" />}
              tone={data.memory.summary.openDriftAlerts ? "amber" : "emerald"}
            />
            <IntelligenceMetric
              label="Latest validation"
              value={
                data.memory.latest.backtestCompletedAt
                  ? formatIntelligenceDate(
                      data.memory.latest.backtestCompletedAt,
                    )
                  : "Not completed"
              }
              helper="Most recent retained backtest."
              icon={<Clock3 className="h-5 w-5" />}
              tone={
                data.memory.latest.backtestCompletedAt ? "cyan" : "amber"
              }
            />
            <IntelligenceMetric
              label="Promotable"
              value={formatIntelligenceInteger(promotableModels.length)}
              helper="Latest completed validation passed all gates."
              icon={<ShieldCheck className="h-5 w-5" />}
              tone={promotableModels.length ? "emerald" : "slate"}
            />
          </section>

          {promotableModels.length ? (
            <IntelligenceSurface className="mt-5 p-5 sm:p-6">
              <IntelligenceSectionHeading
                eyebrow="Human promotion"
                title="Promote a fully validated model"
                description="Promotion requires all stored gates to pass and a documented reason. The current production model is retained and moved to evaluation status."
              />
              <form
                onSubmit={promoteModel}
                className="mt-5 grid gap-3 lg:grid-cols-[minmax(250px,0.8fr)_minmax(320px,1.2fr)_auto]"
              >
                <label className="grid gap-1 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 py-2">
                  <span className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                    Validated model
                  </span>
                  <select
                    value={promotionModelId}
                    onChange={(event: ChangeEvent<HTMLSelectElement>) =>
                      setPromotionModelId(event.target.value)
                    }
                    className="bg-transparent text-sm font-black text-[var(--slice-heading)] outline-none"
                    required
                  >
                    <option value="">Select model</option>
                    {promotableModels.map((model) => (
                      <option key={model.id} value={model.id}>
                        {model.displayName}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="grid gap-1 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-3 py-2">
                  <span className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                    Promotion rationale
                  </span>
                  <input
                    value={promotionReason}
                    onChange={(event: ChangeEvent<HTMLInputElement>) =>
                      setPromotionReason(event.target.value.slice(0, 2_000))
                    }
                    placeholder="Document why this validated model should become production."
                    className="bg-transparent text-sm font-semibold text-[var(--slice-heading)] outline-none"
                    required
                    minLength={10}
                  />
                </label>

                <button
                  type="submit"
                  disabled={operation === "promote" || !online}
                  className="inline-flex min-h-12 items-center justify-center gap-2 rounded-xl bg-emerald-700 px-5 text-xs font-black text-white disabled:opacity-50"
                >
                  {operation === "promote" ? (
                    <RefreshCw className="h-4 w-4 animate-spin" />
                  ) : (
                    <Rocket className="h-4 w-4" />
                  )}
                  Promote model
                </button>
              </form>
            </IntelligenceSurface>
          ) : (
            <IntelligenceNotice
              className="mt-5"
              tone="slate"
              icon={<ShieldCheck className="h-4 w-4" />}
            >
              No non-production model currently has a completed validation
              where every promotion gate passed.
            </IntelligenceNotice>
          )}

          <IntelligenceSurface className="mt-5 p-5 sm:p-6">
            <IntelligenceSectionHeading
              eyebrow="Model registry"
              title="Versioned artifacts and validation evidence"
              description="Each model exposes status, versions, promotion time, completed validation, gate results, and active drift alerts."
            />

            <div className="mt-5 space-y-4">
              {data.models.map((model) => {
                const latest = latestCompletedBacktest(model);
                const gateItems = latest?.gates.items ?? [];
                const overall = latest?.overallMetrics ?? {};
                const brier = numberFrom(overall, [
                  "brierScore",
                  "brier",
                ]);
                const accuracy = numberFrom(overall, [
                  "directionalAccuracyPercent",
                  "accuracyPercent",
                ]);
                const coverage = numberFrom(overall, [
                  "intervalCoveragePercent",
                  "coveragePercent",
                ]);

                return (
                  <article
                    key={model.id}
                    className="rounded-[1.5rem] border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-5 shadow-sm"
                  >
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div className="max-w-3xl">
                        <div className="flex flex-wrap items-center gap-2">
                          <IntelligencePill tone={statusTone(model.status)}>
                            {model.status}
                          </IntelligencePill>
                          <span className="text-[9px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                            Updated {formatIntelligenceDate(model.updatedAt)}
                          </span>
                        </div>
                        <h3 className="mt-3 text-xl font-black text-[var(--slice-heading)]">
                          {model.displayName}
                        </h3>
                        <p className="mt-2 text-xs font-semibold leading-5 text-[var(--slice-muted)]">
                          {model.description ||
                            "Governed forecast model artifact."}
                        </p>
                        <p className="mt-2 break-all text-[10px] font-semibold text-[var(--slice-subtle)]">
                          {model.modelVersion}
                        </p>
                      </div>

                      <div className="grid grid-cols-3 gap-2 text-center xl:w-[24rem]">
                        {[
                          [
                            "Brier",
                            brier === null
                              ? "—"
                              : formatIntelligenceNumber(brier, 4),
                          ],
                          [
                            "Accuracy",
                            accuracy === null
                              ? "—"
                              : `${formatIntelligenceNumber(accuracy, 1)}%`,
                          ],
                          [
                            "Coverage",
                            coverage === null
                              ? "—"
                              : `${formatIntelligenceNumber(coverage, 1)}%`,
                          ],
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

                    {latest ? (
                      <div className="mt-5 rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-4">
                        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <div className="flex flex-wrap items-center gap-2">
                              <IntelligencePill tone={statusTone(latest.status)}>
                                {latest.status}
                              </IntelligencePill>
                              <IntelligencePill
                                tone={
                                  latest.gates.allPassed
                                    ? "emerald"
                                    : "rose"
                                }
                              >
                                {latest.gates.allPassed
                                  ? "All gates passed"
                                  : "Promotion blocked"}
                              </IntelligencePill>
                            </div>
                            <p className="mt-3 text-xs font-black text-[var(--slice-heading)]">
                              {latest.recommendation ||
                                "Point-in-time validation result"}
                            </p>
                            <p className="mt-1 text-[10px] font-semibold text-[var(--slice-muted)]">
                              {latest.holdoutSampleCount} holdout ·{" "}
                              {latest.eligibleSampleCount} eligible ·{" "}
                              {latest.excludedSampleCount} excluded
                            </p>
                          </div>
                          <p className="text-[10px] font-semibold text-[var(--slice-muted)]">
                            {formatIntelligenceDate(
                              latest.completedAt ?? latest.createdAt,
                            )}
                          </p>
                        </div>

                        <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                          {gateItems.map((gate) => (
                            <div
                              key={gate.key}
                              className={`rounded-xl border p-3 ${
                                gate.passed
                                  ? "border-emerald-600/15 bg-emerald-50 dark:border-emerald-400/20 dark:bg-emerald-500/[0.07]"
                                  : "border-rose-600/15 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-500/[0.07]"
                              }`}
                            >
                              <p
                                className={`text-[9px] font-black uppercase tracking-[0.09em] ${
                                  gate.passed
                                    ? "text-emerald-800 dark:text-emerald-200"
                                    : "text-rose-800 dark:text-rose-200"
                                }`}
                              >
                                {gate.passed ? "Passed" : "Failed"} ·{" "}
                                {gate.key}
                              </p>
                              <p className="mt-2 text-[10px] font-semibold leading-4 text-[var(--slice-muted)]">
                                {gate.detail}
                              </p>
                            </div>
                          ))}
                        </div>
                      </div>
                    ) : (
                      <IntelligenceNotice className="mt-5" tone="amber">
                        This artifact has no completed point-in-time validation.
                      </IntelligenceNotice>
                    )}

                    {model.driftAlerts.length ? (
                      <div className="mt-4 space-y-2">
                        {model.driftAlerts.slice(0, 5).map((alert) => (
                          <div
                            key={alert.id}
                            className={`rounded-xl border p-3 ${
                              alert.severity === "Critical"
                                ? "border-rose-600/20 bg-rose-50 dark:border-rose-400/20 dark:bg-rose-500/[0.07]"
                                : "border-amber-600/20 bg-amber-50 dark:border-amber-400/20 dark:bg-amber-500/[0.07]"
                            }`}
                          >
                            <div className="flex items-start justify-between gap-3">
                              <p className="text-xs font-black text-[var(--slice-heading)]">
                                {alert.severity} · {alert.horizon}
                              </p>
                              <span className="text-[9px] font-semibold text-[var(--slice-muted)]">
                                {formatIntelligenceDate(alert.createdAt)}
                              </span>
                            </div>
                            <p className="mt-1 text-[10px] font-semibold leading-4 text-[var(--slice-muted)]">
                              {alert.reason}
                            </p>
                          </div>
                        ))}
                      </div>
                    ) : null}
                  </article>
                );
              })}

              {!data.models.length ? (
                <IntelligenceNotice tone="amber">
                  No model artifact is registered. Generate forecast history and
                  train a governed model before validation.
                </IntelligenceNotice>
              ) : null}
            </div>
          </IntelligenceSurface>

          <IntelligenceSurface className="mt-5 p-5 sm:p-6">
            <IntelligenceSectionHeading
              eyebrow="Governance policy"
              title="Safety boundaries remain enforced"
              description="Model governance controls decision-support software. It does not authorize autonomous trading or automatic promotion."
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  "Autonomous trading",
                  data.safeguards.autonomousTradingEnabled
                    ? "Enabled"
                    : "Disabled",
                ],
                [
                  "Automatic promotion",
                  data.safeguards.automaticModelPromotionEnabled
                    ? "Enabled"
                    : "Disabled",
                ],
                [
                  "Human approval",
                  data.safeguards.humanApprovalRequired
                    ? "Required"
                    : "Not required",
                ],
                [
                  "Point-in-time validation",
                  data.safeguards.pointInTimeValidationRequired
                    ? "Required"
                    : "Optional",
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[var(--slice-subtle)]">
                    {label}
                  </p>
                  <p className="mt-2 text-base font-black text-[var(--slice-heading)]">
                    {value}
                  </p>
                </div>
              ))}
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
                Loading model governance
              </p>
            </div>
          </div>
        </IntelligenceSurface>
      ) : null}
    </IntelligencePage>
  );
}