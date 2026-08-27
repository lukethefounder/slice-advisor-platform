"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  Database,
  FileCheck2,
  RefreshCw,
  ScanSearch,
  Search,
  ShieldCheck,
  TriangleAlert,
} from "lucide-react";
import {
  useCallback,
  useEffect,
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
  type ClientMemoryWindow,
  statusTone,
  useVisibilityRefresh,
} from "@/components/intelligence/operating-memory-ui";
import {
  cleanIntelligenceSymbol,
  intelligenceFetch,
  isAbortError,
} from "@/lib/intelligence/client";

type WarehouseCategory = {
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
  status: "Validated" | "Needs Review";
  materialized: boolean;
  materializedStatus: string | null;
  lastCheckedAt: string | null;
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
  warehouseCheckedAt: string | null;
  pointInTimeSafe: boolean;
  integrityScore: number;
  timestampCount: number;
  futureEvidenceCount: number;
  futureEvidencePaths: string[];
  missingRequiredCategories: string[];
  fallbackCategories: string[];
  staleCategories: string[];
  earliestEvidenceAt: string | null;
  latestEvidenceAt: string | null;
  warnings: string[];
  categories: WarehouseCategory[];
};

type WarehouseResponse = {
  ok: true;
  generatedAt: string;
  window: ClientMemoryWindow;
  filters: {
    symbol: string | null;
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
    autonomousTradingEnabled: false;
    futureDatedEvidenceAccepted: false;
    demoEvidencePromotedToTruth: false;
    humanReviewRequiredForViolations: true;
    monthMemoryMinimumEnforced: true;
  };
  runs: WarehouseRun[];
};

function categoryTone(category: WarehouseCategory) {
  if (
    category.status === "Validated" &&
    !category.fallbackUsed &&
    !category.stale &&
    category.futureTimestampCount === 0
  ) {
    return "emerald" as const;
  }

  if (category.futureTimestampCount > 0 || !category.present) {
    return "rose" as const;
  }

  return "amber" as const;
}

export default function EvidenceWarehouseWorkspace() {
  const [data, setData] = useState<WarehouseResponse | null>(null);
  const [symbolInput, setSymbolInput] = useState("");
  const [activeSymbol, setActiveSymbol] = useState("");
  const [loading, setLoading] = useState(true);
  const [operation, setOperation] = useState<
    "batch" | `run:${string}` | null
  >(null);
  const [online, setOnline] = useState(true);
  const [message, setMessage] = useState(
    "Loading point-in-time evidence audits.",
  );
  const [error, setError] = useState("");
  const controller = useRef<AbortController | null>(null);
  const mounted = useRef(true);

  const load = useCallback(
    async (quiet = false, symbolOverride?: string) => {
      controller.current?.abort();
      const nextController = new AbortController();
      controller.current = nextController;
      const symbol =
        symbolOverride === undefined ? activeSymbol : symbolOverride;
      const params = new URLSearchParams({
        days: "30",
        limit: "50",
      });

      if (symbol) params.set("symbol", symbol);

      if (!quiet) setLoading(true);

      try {
        const response = await intelligenceFetch<WarehouseResponse>(
          `/api/intelligence/forecast/warehouse?${params.toString()}`,
          {
            signal: nextController.signal,
          },
          {
            timeoutMs: 45_000,
            retries: 1,
          },
        );

        if (!mounted.current) return;

        setData(response);
        setError("");
        setMessage(
          `${response.summary.auditedRuns.toLocaleString()} of ${response.summary.coverageScopeCount.toLocaleString()} retained forecast runs have materialized evidence audits.`,
        );
      } catch (caught) {
        if (isAbortError(caught) || !mounted.current) return;

        setError(
          caught instanceof Error
            ? caught.message
            : "Unable to load the evidence warehouse.",
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
      busy: loading || Boolean(operation),
    },
  );

  function applyFilter(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const symbol = cleanIntelligenceSymbol(symbolInput);
    setActiveSymbol(symbol);
    void load(false, symbol);
  }

  async function audit(action: "batch" | "run", runId?: string) {
    setOperation(action === "batch" ? "batch" : `run:${runId ?? ""}`);
    setError("");
    setMessage(
      action === "batch"
        ? "Auditing missing forecast evidence inside the retained 30-day memory window."
        : "Rebuilding and materializing the point-in-time evidence report for the selected run.",
    );

    try {
      const response = await intelligenceFetch<{
        ok: true;
        auditedCount?: number;
        failedCount?: number;
      }>(
        "/api/intelligence/forecast/warehouse",
        {
          method: "POST",
          body: JSON.stringify(
            action === "batch"
              ? {
                  action: "audit-batch",
                  days: 30,
                  limit: 50,
                  onlyMissing: true,
                }
              : {
                  action: "audit-run",
                  days: 30,
                  runId,
                },
          ),
        },
        {
          timeoutMs: 118_000,
        },
      );

      if (!mounted.current) return;

      setMessage(
        action === "batch"
          ? `${response.auditedCount ?? 0} evidence runs were audited; ${
              response.failedCount ?? 0
            } failed.`
          : "The selected point-in-time evidence report was rebuilt and materialized.",
      );
      await load(true);
    } catch (caught) {
      if (isAbortError(caught) || !mounted.current) return;

      setError(
        caught instanceof Error
          ? caught.message
          : "The evidence audit did not complete.",
      );
    } finally {
      if (mounted.current) setOperation(null);
    }
  }

  return (
    <IntelligencePage>
      <IntelligenceSurface className="overflow-hidden">
        <div className="bg-[radial-gradient(circle_at_8%_0%,rgba(6,182,212,0.10),transparent_34%),radial-gradient(circle_at_95%_8%,rgba(16,185,129,0.12),transparent_34%)] p-5 sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-5xl">
              <OperatingMemoryPills
                memory={
                  data
                    ? {
                        generatedAt: data.generatedAt,
                        window: data.window,
                        summary: {
                          forecastRuns: data.summary.totalRuns,
                          returnedRuns: data.runs.length,
                          pendingHorizons: 0,
                          settledHorizons: 0,
                          settledOutcomes: 0,
                          modelArtifacts: 0,
                          horizonPredictions: 0,
                          ensemblePredictions: 0,
                          simulationRecords: 0,
                          completedBacktests: 0,
                          openDriftAlerts: 0,
                          evidenceAudits: data.summary.auditedRuns,
                          validatedEvidenceAudits:
                            data.summary.validatedRuns,
                          needsReviewEvidenceAudits:
                            data.summary.needsReviewRuns,
                        },
                        latest: {
                          forecastGeneratedAt:
                            data.runs[0]?.generatedAt ?? null,
                          providerAsOfAt:
                            data.runs[0]?.asOfAt ?? null,
                          settledOutcomeAt: null,
                          modelCreatedAt: null,
                          horizonPredictionAt: null,
                          ensemblePredictionAt: null,
                          backtestCompletedAt: null,
                          evidenceAuditAt:
                            data.runs[0]?.warehouseCheckedAt ?? null,
                        },
                        recentRuns: [],
                        models: [],
                        horizonPredictions: [],
                        ensemblePredictions: [],
                        backtests: [],
                        driftAlerts: [],
                        safeguards: {
                          autonomousTradingEnabled: false,
                          automaticPromotionEnabled: false,
                          futureDatedEvidenceAccepted: false,
                          demoOutcomesAcceptedForValidation: false,
                          monthMemoryMinimumEnforced: true,
                        },
                      }
                    : null
                }
                online={online}
                busy={Boolean(operation)}
              >
                <IntelligencePill tone="cyan">
                  <Database className="h-3.5 w-3.5" />
                  Point-in-time evidence
                </IntelligencePill>
              </OperatingMemoryPills>

              <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] text-[var(--slice-heading)] sm:text-5xl xl:text-6xl">
                Evidence warehouse for reproducible forecasts.
              </h1>
              <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-[var(--slice-muted)] sm:text-base">
                Every retained forecast can be reconstructed from its immutable
                input snapshot, source timestamps, data quality, fallback
                state, stale-data warnings, and point-in-time integrity report.
                Future-dated evidence is isolated for review.
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
                disabled={loading || Boolean(operation)}
                className="rounded-xl bg-[var(--slice-accent-strong)] px-4 py-2 text-[11px] font-black text-white disabled:opacity-50"
              >
                Apply
              </button>
            </form>

            <button
              type="button"
              onClick={() => void load()}
              disabled={loading || Boolean(operation)}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-5 text-sm font-black text-[var(--slice-text)] shadow-sm transition hover:border-[var(--slice-accent-border)] disabled:opacity-50"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh warehouse
            </button>

            <button
              type="button"
              onClick={() => void audit("batch")}
              disabled={loading || Boolean(operation) || !online}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[var(--slice-accent-strong)] px-5 text-sm font-black text-white shadow-[0_14px_32px_var(--slice-accent-glow)] disabled:opacity-50"
            >
              {operation === "batch" ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <ScanSearch className="h-4 w-4" />
              )}
              Audit missing runs
            </button>
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

      {data ? (
        <>
          <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-8">
            <IntelligenceMetric
              label="Forecast runs"
              value={formatIntelligenceInteger(data.summary.totalRuns)}
              helper={data.window.label}
              icon={<Database className="h-5 w-5" />}
            />
            <IntelligenceMetric
              label="Audit coverage"
              value={`${formatIntelligenceNumber(
                data.summary.coveragePercent,
                1,
              )}%`}
              helper={`${data.summary.auditedRuns.toLocaleString()} audited.`}
              icon={<FileCheck2 className="h-5 w-5" />}
              tone={
                data.summary.coveragePercent >= 95 ? "emerald" : "amber"
              }
            />
            <IntelligenceMetric
              label="Validated"
              value={formatIntelligenceInteger(data.summary.validatedRuns)}
              helper="Materialized overall audits."
              icon={<CheckCircle2 className="h-5 w-5" />}
            />
            <IntelligenceMetric
              label="Needs review"
              value={formatIntelligenceInteger(data.summary.needsReviewRuns)}
              helper="Material point-in-time or quality issue."
              icon={<TriangleAlert className="h-5 w-5" />}
              tone={data.summary.needsReviewRuns ? "amber" : "emerald"}
            />
            <IntelligenceMetric
              label="Not audited"
              value={formatIntelligenceInteger(data.summary.notAuditedRuns)}
              helper="Inside the retained scope."
              icon={<Clock3 className="h-5 w-5" />}
              tone={data.summary.notAuditedRuns ? "amber" : "emerald"}
            />
            <IntelligenceMetric
              label="Point-in-time safe"
              value={formatIntelligenceInteger(
                data.summary.recentPointInTimeSafe,
              )}
              helper="Recent returned reports."
              icon={<ShieldCheck className="h-5 w-5" />}
            />
            <IntelligenceMetric
              label="Recent review"
              value={formatIntelligenceInteger(data.summary.recentNeedsReview)}
              helper="Returned runs below integrity threshold."
              icon={<AlertTriangle className="h-5 w-5" />}
              tone={data.summary.recentNeedsReview ? "amber" : "emerald"}
            />
            <IntelligenceMetric
              label="Average integrity"
              value={`${formatIntelligenceNumber(
                data.summary.recentAverageIntegrityScore,
                1,
              )}%`}
              helper="Recent returned evidence snapshots."
              icon={<ScanSearch className="h-5 w-5" />}
              tone={
                data.summary.recentAverageIntegrityScore >= 80
                  ? "emerald"
                  : "amber"
              }
            />
          </section>

          <IntelligenceSurface className="mt-5 p-5 sm:p-6">
            <IntelligenceSectionHeading
              eyebrow="Evidence audit reports"
              title="Immutable forecast snapshots and source categories"
              description="Each report evaluates forecast time, input-snapshot equality, required categories, future timestamps, fallback use, stale evidence, and materialized audit status."
            />

            <div className="mt-5 space-y-4">
              {data.runs.map((run) => (
                <details
                  key={run.id}
                  className="group rounded-[1.5rem] border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-5 open:shadow-sm"
                >
                  <summary className="cursor-pointer list-none [&::-webkit-details-marker]:hidden">
                    <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                      <div>
                        <div className="flex flex-wrap items-center gap-2">
                          <IntelligencePill
                            tone={
                              run.pointInTimeSafe ? "emerald" : "rose"
                            }
                          >
                            {run.pointInTimeSafe
                              ? "Point-in-time safe"
                              : "Violation detected"}
                          </IntelligencePill>
                          <IntelligencePill
                            tone={statusTone(run.warehouseStatus)}
                          >
                            {run.warehouseStatus}
                          </IntelligencePill>
                        </div>
                        <h3 className="mt-3 text-xl font-black text-[var(--slice-heading)]">
                          {run.symbol} · Integrity{" "}
                          {formatIntelligenceNumber(run.integrityScore, 0)}%
                        </h3>
                        <p className="mt-1 text-[10px] font-semibold text-[var(--slice-muted)]">
                          Forecast {formatIntelligenceDate(run.generatedAt)} ·
                          Evidence as of {formatIntelligenceDate(run.asOfAt)} ·{" "}
                          {run.modelVersion}
                        </p>
                      </div>

                      <div className="grid grid-cols-4 gap-2 text-center xl:w-[31rem]">
                        {[
                          ["Timestamps", run.timestampCount],
                          ["Future", run.futureEvidenceCount],
                          ["Missing", run.missingRequiredCategories.length],
                          ["Fallback", run.fallbackCategories.length],
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

                  <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                    {run.categories.map((category) => (
                      <article
                        key={category.sourceName}
                        className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <IntelligencePill tone={categoryTone(category)}>
                              {category.materializedStatus ??
                                category.status}
                            </IntelligencePill>
                            <h4 className="mt-3 text-sm font-black text-[var(--slice-heading)]">
                              {category.sourceName}
                            </h4>
                          </div>
                          <span className="text-lg font-black text-[var(--slice-accent-strong)]">
                            {formatIntelligenceNumber(
                              category.qualityScore,
                              0,
                            )}
                          </span>
                        </div>

                        <div className="mt-3 grid grid-cols-2 gap-2 text-[9px] font-semibold text-[var(--slice-muted)]">
                          <span>Live: {category.liveStatus}</span>
                          <span>Freshness: {category.freshnessStatus}</span>
                          <span>
                            Required: {category.required ? "Yes" : "No"}
                          </span>
                          <span>
                            Present: {category.present ? "Yes" : "No"}
                          </span>
                          <span>
                            Fallback: {category.fallbackUsed ? "Yes" : "No"}
                          </span>
                          <span>Stale: {category.stale ? "Yes" : "No"}</span>
                        </div>

                        <p className="mt-3 text-[9px] font-semibold text-[var(--slice-subtle)]">
                          Evidence time{" "}
                          {formatIntelligenceDate(category.asOfAt)}
                          {category.lastCheckedAt
                            ? ` · Audited ${formatIntelligenceDate(
                                category.lastCheckedAt,
                              )}`
                            : ""}
                        </p>

                        {category.warnings.length ? (
                          <div className="mt-3 space-y-1">
                            {category.warnings.slice(0, 3).map((warning) => (
                              <p
                                key={warning}
                                className="text-[9px] font-semibold leading-4 text-amber-800 dark:text-amber-200"
                              >
                                {warning}
                              </p>
                            ))}
                          </div>
                        ) : null}
                      </article>
                    ))}
                  </div>

                  <div className="mt-4 grid gap-3 lg:grid-cols-[1fr_auto] lg:items-start">
                    <div className="space-y-2">
                      {run.warnings.map((warning) => (
                        <IntelligenceNotice
                          key={warning}
                          tone="amber"
                          icon={<AlertTriangle className="h-4 w-4" />}
                        >
                          {warning}
                        </IntelligenceNotice>
                      ))}
                      {!run.warnings.length ? (
                        <IntelligenceNotice
                          tone="emerald"
                          icon={<CheckCircle2 className="h-4 w-4" />}
                        >
                          No material point-in-time evidence warning was
                          detected for this run.
                        </IntelligenceNotice>
                      ) : null}
                    </div>

                    <button
                      type="button"
                      onClick={() => void audit("run", run.id)}
                      disabled={Boolean(operation) || !online}
                      className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 text-xs font-black text-[var(--slice-heading)] disabled:opacity-50"
                    >
                      {operation === `run:${run.id}` ? (
                        <RefreshCw className="h-4 w-4 animate-spin" />
                      ) : (
                        <ScanSearch className="h-4 w-4" />
                      )}
                      Re-audit run
                    </button>
                  </div>
                </details>
              ))}

              {!data.runs.length ? (
                <IntelligenceNotice tone="slate">
                  No forecast run is stored in the selected operating-memory
                  window.
                </IntelligenceNotice>
              ) : null}
            </div>
          </IntelligenceSurface>

          <IntelligenceSurface className="mt-5 p-5 sm:p-6">
            <IntelligenceSectionHeading
              eyebrow="Warehouse safeguards"
              title="Evidence violations remain reviewable"
              description="The warehouse stores audit records and warnings. It does not promote future-dated, missing, stale, fallback, or synthetic evidence to verified truth."
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  "Future evidence",
                  data.safeguards.futureDatedEvidenceAccepted
                    ? "Accepted"
                    : "Rejected",
                ],
                [
                  "Synthetic evidence",
                  data.safeguards.demoEvidencePromotedToTruth
                    ? "Promoted"
                    : "Never promoted",
                ],
                [
                  "Violation review",
                  data.safeguards.humanReviewRequiredForViolations
                    ? "Required"
                    : "Optional",
                ],
                [
                  "Memory minimum",
                  data.safeguards.monthMemoryMinimumEnforced
                    ? "30 days"
                    : "Not enforced",
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
                Loading evidence warehouse
              </p>
            </div>
          </div>
        </IntelligenceSurface>
      ) : null}
    </IntelligencePage>
  );
}