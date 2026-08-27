"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  Clock3,
  Database,
  GitBranch,
  Layers3,
  Play,
  RefreshCw,
  ShieldCheck,
  Target,
  TrendingDown,
  TrendingUp,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type KeyboardEvent,
} from "react";

import {
  IntelligenceMetric,
  IntelligenceNotice,
  IntelligencePage,
  IntelligencePill,
  IntelligenceSectionHeading,
  IntelligenceSurface,
  cx,
  formatIntelligenceCurrency,
  formatIntelligenceDate,
  formatIntelligenceNumber,
  formatIntelligencePercent,
} from "@/components/intelligence/intelligence-ui";
import {
  cleanIntelligenceSymbol,
  clientTimestampFreshness,
  intelligenceFetch,
  isAbortError,
} from "@/lib/intelligence/client";
import type {
  ResearchCohort,
  ResearchSwarmResponse,
} from "@/lib/intelligence/research-swarm-types";
import type {
  ForecastFactorContribution,
  ForecastHorizon,
  ForecastHorizonResult,
  ForecastResponse,
} from "@/lib/intelligence-forecast/types";

type ForecastWithPersistence =
  ForecastResponse & {
    persistence?: {
      status: string;
      runId: string;
      storedAt: string;
    };
    shadowPersistence?: {
      status: string;
      storedCount?: number;
      modelVersion?: string;
      detail?: string;
    };
    evidenceWarehouse?: {
      status: string;
      pointInTimeSafe?: boolean;
      integrityScore?: number;
      warningCount?: number;
      detail?: string;
    };
    knowledgeGraph?: {
      status: string;
      syncedAt?: string;
      detail?: string;
    };
  };

const COHORTS = [
  "media",
  "technical",
  "economy",
] as const;

function freshnessTone(
  state: ReturnType<
    typeof clientTimestampFreshness
  >["state"],
) {
  if (state === "current") {
    return "emerald" as const;
  }
  if (state === "recent") {
    return "cyan" as const;
  }
  if (state === "stale") {
    return "amber" as const;
  }
  if (state === "missing") {
    return "slate" as const;
  }
  return "rose" as const;
}

function cohortTone(cohort: ResearchCohort) {
  return cohort === "media"
    ? ("amber" as const)
    : cohort === "technical"
      ? ("cyan" as const)
      : ("violet" as const);
}

function directionTone(
  direction: ForecastHorizonResult["direction"],
) {
  return direction === "Bullish"
    ? ("emerald" as const)
    : direction === "Bearish"
      ? ("rose" as const)
      : ("amber" as const);
}

function ContributionCard({
  contribution,
}: {
  contribution: ForecastFactorContribution;
}) {
  const positive =
    contribution.contribution >= 0;

  return (
    <article className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h3 className="text-sm font-black text-[var(--slice-heading)]">
            {contribution.factor}
          </h3>
          <p className="mt-1 text-[9px] font-black uppercase tracking-[0.11em] text-[var(--slice-subtle)]">
            Weight{" "}
            {formatIntelligenceNumber(
              contribution.weight * 100,
              1,
            )}
            %
          </p>
        </div>
        <span
          className={cx(
            "text-sm font-black",
            positive
              ? "text-emerald-700 dark:text-emerald-200"
              : "text-rose-700 dark:text-rose-200",
          )}
        >
          {positive ? "+" : ""}
          {formatIntelligenceNumber(
            contribution.contribution,
            3,
          )}
        </span>
      </div>

      <p className="mt-3 text-xs font-semibold leading-5 text-[var(--slice-muted)]">
        {contribution.explanation}
      </p>
    </article>
  );
}

export default function ForecastLabWorkspace() {
  const [symbolInput, setSymbolInput] =
    useState("MSFT");
  const [agentCount, setAgentCount] =
    useState(600);
  const [simulationPaths, setSimulationPaths] =
    useState(300);
  const [swarm, setSwarm] =
    useState<ResearchSwarmResponse | null>(
      null,
    );
  const [forecast, setForecast] =
    useState<ForecastWithPersistence | null>(
      null,
    );
  const [selectedHorizon, setSelectedHorizon] =
    useState<ForecastHorizon>("2-5d");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(
    "Run a current research cycle to create a point-in-time forecast. Opening this route does not start providers or agents.",
  );
  const [error, setError] = useState("");
  const controller =
    useRef<AbortController | null>(null);
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    const params = new URLSearchParams(
      window.location.search,
    );
    const symbol =
      cleanIntelligenceSymbol(
        params.get("symbol"),
      ) || "MSFT";

    setSymbolInput(symbol);

    return () => {
      mounted.current = false;
      controller.current?.abort();
    };
  }, []);

  async function runForecast() {
    const symbol =
      cleanIntelligenceSymbol(symbolInput) ||
      "MSFT";
    controller.current?.abort();
    const nextController =
      new AbortController();
    controller.current = nextController;

    setSymbolInput(symbol);
    setRunning(true);
    setError("");
    setMessage(
      `Running ${agentCount.toLocaleString()} current research pathways for ${symbol}.`,
    );

    try {
      const research =
        await intelligenceFetch<ResearchSwarmResponse>(
          "/api/intelligence/research-swarm",
          {
            method: "POST",
            signal: nextController.signal,
            body: JSON.stringify({
              symbol,
              agentCount,
              simulationPaths,
              graphMode: "summary",
              detailMode: "summary",
              projection: "overview",
              persistGraph: false,
              forceRefresh: true,
              executionMode: "sync",
            }),
          },
          {
            timeoutMs: 82_000,
          },
        );

      if (!mounted.current) return;

      const inputFreshness =
        clientTimestampFreshness(
          research.forecastSnapshot.asOf,
          {
            currentWithinMs: 20 * 60_000,
            /*
             * A verified prior close is still usable through a weekend or
             * market holiday, but anything older is not called current.
             */
            recentWithinMs:
              72 * 60 * 60_000,
          },
        );

      if (
        inputFreshness.state === "stale" ||
        inputFreshness.state ===
          "future" ||
        inputFreshness.state ===
          "invalid" ||
        inputFreshness.state === "missing"
      ) {
        throw new Error(
          `Forecast input rejected: ${inputFreshness.label}. Refresh the market provider before generating a new forecast.`,
        );
      }

      setSwarm(research);
      setMessage(
        `${research.activeAgents.toLocaleString()} current pathways completed. Generating all forecast horizons from the verified point-in-time snapshot.`,
      );

      const result =
        await intelligenceFetch<ForecastWithPersistence>(
          "/api/intelligence/forecast",
          {
            method: "POST",
            signal: nextController.signal,
            body: JSON.stringify(
              research.forecastSnapshot,
            ),
          },
          {
            timeoutMs: 82_000,
          },
        );

      if (!mounted.current) return;

      setForecast(result);
      setSelectedHorizon(
        result.horizons[0]?.horizon ??
          "2-5d",
      );
      setMessage(
        `${symbol} forecast generated from Slice score ${formatIntelligenceNumber(
          research.score.overall,
          1,
        )}. Research graph persistence was intentionally skipped; the forecast retained its own point-in-time provenance.`,
      );
    } catch (caught) {
      if (
        isAbortError(caught) ||
        !mounted.current
      ) {
        return;
      }

      setError(
        caught instanceof Error
          ? caught.message
          : "Unable to generate the current forecast.",
      );
      setMessage(
        "The research and forecast cycle did not complete.",
      );
    } finally {
      if (mounted.current) {
        setRunning(false);
      }
    }
  }

  const currentHorizon = useMemo(
    () =>
      forecast?.horizons.find(
        (horizon) =>
          horizon.horizon ===
          selectedHorizon,
      ) ??
      forecast?.horizons[0] ??
      null,
    [forecast, selectedHorizon],
  );
  const providerFreshness =
    clientTimestampFreshness(
      swarm?.providerAsOf,
      {
        currentWithinMs: 20 * 60_000,
        recentWithinMs:
          72 * 60 * 60_000,
      },
    );
  const researchFreshness =
    clientTimestampFreshness(
      swarm?.completedAt,
      {
        currentWithinMs: 15 * 60_000,
        recentWithinMs:
          60 * 60_000,
      },
    );
  const forecastFreshness =
    clientTimestampFreshness(
      forecast?.generatedAt,
      {
        currentWithinMs: 15 * 60_000,
        recentWithinMs:
          60 * 60_000,
      },
    );
  const forecastInputFreshness =
    clientTimestampFreshness(
      forecast?.asOf,
      {
        currentWithinMs: 20 * 60_000,
        recentWithinMs:
          72 * 60 * 60_000,
      },
    );
  const currencyCode =
    swarm?.market.currency || "USD";
  const dataNeedsReview = forecast
    ? [
        forecastFreshness.state,
        forecastInputFreshness.state,
      ].some((state) =>
        [
          "stale",
          "future",
          "invalid",
          "missing",
        ].includes(state),
      )
    : false;

  return (
    <IntelligencePage>
      <IntelligenceSurface className="overflow-hidden">
        <div className="bg-[radial-gradient(circle_at_8%_0%,rgba(16,185,129,0.13),transparent_35%),radial-gradient(circle_at_94%_10%,rgba(6,182,212,0.08),transparent_32%)] p-5 sm:p-7">
          <div className="flex flex-col gap-6 xl:flex-row xl:items-start xl:justify-between">
            <div className="max-w-5xl">
              <div className="flex flex-wrap items-center gap-2">
                <IntelligencePill tone="emerald">
                  <Target className="h-3.5 w-3.5" />
                  Forecast lab
                </IntelligencePill>
                <IntelligencePill tone="cyan">
                  <BrainCircuit className="h-3.5 w-3.5" />
                  Equal-third score
                </IntelligencePill>
                {swarm ? (
                  <IntelligencePill
                    tone={freshnessTone(
                      providerFreshness.state,
                    )}
                  >
                    <Clock3 className="h-3.5 w-3.5" />
                    Provider{" "}
                    {providerFreshness.label}
                  </IntelligencePill>
                ) : null}
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-[-0.05em] text-[var(--slice-heading)] sm:text-5xl xl:text-6xl">
                Point-in-time forecasts from current, timestamped evidence.
              </h1>
              <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-[var(--slice-muted)] sm:text-base">
                Media, technical, and economy
                pathways each contribute exactly one
                third to the Slice score. The forecast
                API receives that verified snapshot,
                preserves its source time, and exposes
                stale-data, evidence-warehouse, and
                provenance status rather than implying
                certainty.
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

          <div className="mt-7 grid gap-3 xl:grid-cols-[minmax(220px,1fr)_270px_270px_auto]">
            <label className="flex min-h-14 items-center rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 shadow-sm">
              <span className="sr-only">
                Security symbol
              </span>
              <input
                value={symbolInput}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>,
                ) =>
                  setSymbolInput(
                    cleanIntelligenceSymbol(
                      event.target.value,
                    ),
                  )
                }
                onKeyDown={(
                  event: KeyboardEvent<HTMLInputElement>,
                ) => {
                  if (
                    event.key === "Enter" &&
                    !running
                  ) {
                    void runForecast();
                  }
                }}
                className="min-w-0 flex-1 bg-transparent text-sm font-black uppercase tracking-[0.12em] text-[var(--slice-heading)] outline-none"
                placeholder="MSFT"
              />
            </label>

            <label className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 py-2.5 shadow-sm">
              <span className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">
                Research pathways
                <span className="text-[var(--slice-accent-strong)]">
                  {agentCount.toLocaleString()}
                </span>
              </span>
              <input
                type="range"
                min={300}
                max={900}
                step={100}
                value={agentCount}
                disabled={running}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>,
                ) =>
                  setAgentCount(
                    Number(event.target.value),
                  )
                }
                className="mt-2 w-full accent-emerald-600 disabled:opacity-50"
              />
            </label>

            <label className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] px-4 py-2.5 shadow-sm">
              <span className="flex items-center justify-between text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-subtle)]">
                Behavioral paths
                <span className="text-violet-700 dark:text-violet-200">
                  {simulationPaths.toLocaleString()}
                </span>
              </span>
              <input
                type="range"
                min={100}
                max={1_000}
                step={100}
                value={simulationPaths}
                disabled={running}
                onChange={(
                  event: ChangeEvent<HTMLInputElement>,
                ) =>
                  setSimulationPaths(
                    Number(event.target.value),
                  )
                }
                className="mt-2 w-full accent-violet-600 disabled:opacity-50"
              />
            </label>

            <button
              type="button"
              onClick={() =>
                void runForecast()
              }
              disabled={
                running ||
                !cleanIntelligenceSymbol(
                  symbolInput,
                )
              }
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-[linear-gradient(110deg,var(--slice-accent),var(--slice-accent-strong))] px-6 text-sm font-black text-white shadow-[0_14px_32px_var(--slice-accent-glow)] transition hover:brightness-105 disabled:opacity-50"
            >
              {running ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              Research and forecast
            </button>
          </div>

          <IntelligenceNotice
            className="mt-4"
            tone={
              error
                ? "rose"
                : forecast
                  ? "emerald"
                  : "slate"
            }
            icon={
              error ? (
                <AlertTriangle className="h-5 w-5" />
              ) : forecast ? (
                <CheckCircle2 className="h-5 w-5" />
              ) : (
                <BrainCircuit className="h-5 w-5" />
              )
            }
          >
            {error || message}
          </IntelligenceNotice>

          {dataNeedsReview ? (
            <IntelligenceNotice
              className="mt-4"
              tone="amber"
              icon={
                <AlertTriangle className="h-4 w-4" />
              }
            >
              This forecast is retained for audit
              history, but one or more timestamps no
              longer qualify as current. Forecast
              generated: {forecastFreshness.label}.
              Input snapshot:{" "}
              {forecastInputFreshness.label}.
            </IntelligenceNotice>
          ) : null}
        </div>
      </IntelligenceSurface>

      {swarm ? (
        <section className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-6">
          <IntelligenceMetric
            label="Slice score"
            value={formatIntelligenceNumber(
              swarm.score.overall,
              1,
            )}
            helper={swarm.score.label}
            icon={
              <BrainCircuit className="h-5 w-5" />
            }
          />
          <IntelligenceMetric
            label="Confidence"
            value={`${formatIntelligenceNumber(
              swarm.score.confidence,
              0,
            )}%`}
            helper="Evidence and pathway agreement."
            icon={
              <ShieldCheck className="h-5 w-5" />
            }
          />
          <IntelligenceMetric
            label="Research age"
            value={researchFreshness.label}
            helper={`Completed ${formatIntelligenceDate(
              swarm.completedAt,
            )}.`}
            icon={<Clock3 className="h-5 w-5" />}
            tone={freshnessTone(
              researchFreshness.state,
            )}
          />
          <IntelligenceMetric
            label="Provider age"
            value={providerFreshness.label}
            helper={`As of ${formatIntelligenceDate(
              swarm.providerAsOf,
            )}.`}
            icon={<Clock3 className="h-5 w-5" />}
            tone={freshnessTone(
              providerFreshness.state,
            )}
          />
          <IntelligenceMetric
            label="Evidence coverage"
            value={`${formatIntelligenceNumber(
              swarm.score.quality
                .evidenceCoverage,
              0,
            )}%`}
            helper="Current provider and source coverage."
            icon={<Database className="h-5 w-5" />}
            tone="cyan"
          />
          <IntelligenceMetric
            label="Source diversity"
            value={`${formatIntelligenceNumber(
              swarm.score.quality
                .sourceDiversity,
              0,
            )}%`}
            helper="Independent source breadth."
            icon={
              <GitBranch className="h-5 w-5" />
            }
            tone="violet"
          />
        </section>
      ) : null}

      {swarm ? (
        <IntelligenceSurface className="mt-5 p-5 sm:p-6">
          <IntelligenceSectionHeading
            eyebrow="Equal-third research"
            title="The score feeding every horizon"
            description="All three cohorts retain the original 33.33% weight. Current-source filtering happens before the agents and score are constructed."
          />
          <div className="mt-5 grid gap-3 xl:grid-cols-3">
            {COHORTS.map((cohort) => {
              const result =
                swarm.cohorts[cohort];

              return (
                <article
                  key={cohort}
                  className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-5 shadow-sm"
                >
                  <div className="flex items-center justify-between gap-4">
                    <IntelligencePill
                      tone={cohortTone(cohort)}
                    >
                      {cohort}
                    </IntelligencePill>
                    <span className="text-3xl font-black text-[var(--slice-heading)]">
                      {formatIntelligenceNumber(
                        result.score,
                        1,
                      )}
                    </span>
                  </div>
                  <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                    {[
                      [
                        "Agents",
                        result.requestedAgents,
                      ],
                      [
                        "Confidence",
                        result.confidence,
                      ],
                      [
                        "Evidence",
                        result.evidenceCount,
                      ],
                    ].map(([label, value]) => (
                      <div
                        key={String(label)}
                        className="rounded-xl border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-3"
                      >
                        <p className="text-[8px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                          {label}
                        </p>
                        <p className="mt-1 text-base font-black text-[var(--slice-heading)]">
                          {formatIntelligenceNumber(
                            Number(value),
                            0,
                          )}
                          {label ===
                          "Confidence"
                            ? "%"
                            : ""}
                        </p>
                      </div>
                    ))}
                  </div>
                  <p className="mt-3 text-[9px] font-black uppercase tracking-[0.1em] text-[var(--slice-subtle)]">
                    33.33% score weight
                  </p>
                </article>
              );
            })}
          </div>
        </IntelligenceSurface>
      ) : null}

      {forecast?.horizons.length ? (
        <>
          <IntelligenceSurface className="mt-5 p-5 sm:p-6">
            <IntelligenceSectionHeading
              eyebrow="Forecast horizons"
              title="Point-in-time probability surface"
              description="Each horizon preserves the same source snapshot, model version, calibration version, uncertainty, and contribution trail."
              action={
                <IntelligencePill
                  tone={freshnessTone(
                    forecastFreshness.state,
                  )}
                >
                  Forecast{" "}
                  {forecastFreshness.label}
                </IntelligencePill>
              }
            />

            <div className="mt-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {forecast.horizons.map(
                (horizon) => (
                  <button
                    key={horizon.horizon}
                    type="button"
                    onClick={() =>
                      setSelectedHorizon(
                        horizon.horizon,
                      )
                    }
                    className={cx(
                      "shrink-0 rounded-xl border px-4 py-3 text-xs font-black transition",
                      currentHorizon?.horizon ===
                        horizon.horizon
                        ? "border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-[var(--slice-accent-strong)]"
                        : "border-[var(--slice-border)] bg-[var(--slice-surface-strong)] text-[var(--slice-muted)] hover:text-[var(--slice-heading)]",
                    )}
                  >
                    {horizon.horizon}
                  </button>
                ),
              )}
            </div>

            {currentHorizon ? (
              <div className="mt-4 rounded-[1.5rem] border border-[var(--slice-border)] bg-[var(--slice-surface-muted)] p-5">
                <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <IntelligencePill
                      tone={directionTone(
                        currentHorizon.direction,
                      )}
                    >
                      {currentHorizon.direction ===
                      "Bullish" ? (
                        <TrendingUp className="h-3.5 w-3.5" />
                      ) : currentHorizon.direction ===
                        "Bearish" ? (
                        <TrendingDown className="h-3.5 w-3.5" />
                      ) : null}
                      {currentHorizon.direction}
                    </IntelligencePill>
                    <h3 className="mt-3 text-3xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
                      {currentHorizon.label}
                    </h3>
                    <p className="mt-2 max-w-3xl text-sm font-semibold leading-6 text-[var(--slice-muted)]">
                      {
                        currentHorizon.primaryUncertainty
                      }
                    </p>
                  </div>

                  <div className="rounded-2xl border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] p-4 text-right">
                    <p className="text-[9px] font-black uppercase tracking-[0.12em] text-[var(--slice-accent-strong)]">
                      Expected price
                    </p>
                    <p className="mt-2 text-3xl font-black text-[var(--slice-heading)]">
                      {formatIntelligenceCurrency(
                        currentHorizon.expectedPrice,
                        currencyCode,
                      )}
                    </p>
                  </div>
                </div>

                <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
                  <IntelligenceMetric
                    label="Probability positive"
                    value={`${formatIntelligenceNumber(
                      currentHorizon.positiveReturnProbability,
                      1,
                    )}%`}
                    helper="Calibrated probability."
                    icon={
                      <Target className="h-5 w-5" />
                    }
                  />
                  <IntelligenceMetric
                    label="Expected return"
                    value={formatIntelligencePercent(
                      currentHorizon.expectedReturnPercent,
                    )}
                    helper="Point expectation."
                    icon={
                      <TrendingUp className="h-5 w-5" />
                    }
                    tone={directionTone(
                      currentHorizon.direction,
                    )}
                  />
                  <IntelligenceMetric
                    label="Confidence"
                    value={`${formatIntelligenceNumber(
                      currentHorizon.confidence,
                      0,
                    )}%`}
                    helper={
                      currentHorizon.modelAgreement
                    }
                    icon={
                      <ShieldCheck className="h-5 w-5" />
                    }
                  />
                  <IntelligenceMetric
                    label="Volatility"
                    value={`${formatIntelligenceNumber(
                      currentHorizon.volatilityPercent,
                      2,
                    )}%`}
                    helper={
                      currentHorizon.dataQuality
                    }
                    icon={
                      <Layers3 className="h-5 w-5" />
                    }
                    tone="amber"
                  />
                  <IntelligenceMetric
                    label="Expected range"
                    value={`${formatIntelligenceCurrency(
                      currentHorizon.expectedPriceRange.low,
                      currencyCode,
                    )} – ${formatIntelligenceCurrency(
                      currentHorizon.expectedPriceRange.high,
                      currencyCode,
                    )}`}
                    helper="Model interval."
                    icon={
                      <ArrowRight className="h-5 w-5" />
                    }
                    tone="cyan"
                  />
                </div>
              </div>
            ) : null}
          </IntelligenceSurface>

          {currentHorizon ? (
            <section className="mt-5 grid gap-5 xl:grid-cols-[1.2fr_0.8fr]">
              <IntelligenceSurface className="p-5 sm:p-6">
                <IntelligenceSectionHeading
                  eyebrow="Factor contributions"
                  title={`${currentHorizon.label} drivers`}
                  description="Every factor retains its normalized signal, weight, contribution, and explanation."
                />
                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  {currentHorizon.contributions.map(
                    (contribution) => (
                      <ContributionCard
                        key={
                          contribution.factor
                        }
                        contribution={
                          contribution
                        }
                      />
                    ),
                  )}
                </div>
              </IntelligenceSurface>

              <IntelligenceSurface className="p-5 sm:p-6">
                <IntelligenceSectionHeading
                  eyebrow="Persistence and provenance"
                  title="Operational result status"
                  description="Forecast storage, point-in-time evidence integrity, and knowledge-graph synchronization are reported separately."
                />
                <div className="mt-5 space-y-3">
                  {[
                    [
                      "Forecast record",
                      forecast.persistence
                        ?.status ?? "Not reported",
                      forecast.persistence
                        ?.storedAt
                        ? formatIntelligenceDate(
                            forecast.persistence
                              .storedAt,
                          )
                        : "No storage time reported",
                    ],
                    [
                      "Evidence warehouse",
                      forecast.evidenceWarehouse
                        ?.status ??
                        "Not reported",
                      forecast
                        .evidenceWarehouse
                        ?.pointInTimeSafe ===
                      true
                        ? `Point-in-time safe · integrity ${formatIntelligenceNumber(
                            forecast
                              .evidenceWarehouse
                              .integrityScore,
                            0,
                          )}`
                        : forecast
                            .evidenceWarehouse
                            ?.detail ??
                          "Review evidence integrity",
                    ],
                    [
                      "Knowledge graph",
                      forecast.knowledgeGraph
                        ?.status ??
                        "Not reported",
                      forecast.knowledgeGraph
                        ?.syncedAt
                        ? formatIntelligenceDate(
                            forecast
                              .knowledgeGraph
                              .syncedAt,
                          )
                        : forecast
                            .knowledgeGraph
                            ?.detail ??
                          "No sync time reported",
                    ],
                    [
                      "Shadow persistence",
                      forecast.shadowPersistence
                        ?.status ??
                        "Not reported",
                      forecast.shadowPersistence
                        ?.detail ??
                        `${forecast.shadowPersistence?.storedCount ?? 0} shadow records`,
                    ],
                  ].map(
                    ([label, status, detail]) => (
                      <div
                        key={label}
                        className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <p className="text-sm font-black text-[var(--slice-heading)]">
                              {label}
                            </p>
                            <p className="mt-1 text-[10px] font-semibold leading-5 text-[var(--slice-muted)]">
                              {detail}
                            </p>
                          </div>
                          <IntelligencePill
                            tone={
                              String(status)
                                .toLowerCase()
                                .includes(
                                  "fail",
                                )
                                ? "rose"
                                : String(status)
                                      .toLowerCase()
                                      .includes(
                                        "stored",
                                      ) ||
                                    String(status)
                                      .toLowerCase()
                                      .includes(
                                        "complete",
                                      ) ||
                                    String(status)
                                      .toLowerCase()
                                      .includes(
                                        "sync",
                                      )
                                  ? "emerald"
                                  : "slate"
                            }
                          >
                            {status}
                          </IntelligencePill>
                        </div>
                      </div>
                    ),
                  )}
                </div>
              </IntelligenceSurface>
            </section>
          ) : null}

          <IntelligenceSurface className="mt-5 p-5 sm:p-6">
            <IntelligenceSectionHeading
              eyebrow="Model contract"
              title="Versions, safeguards, and limitations"
              description="A forecast is a probabilistic model output—not an autonomous trade instruction—and the source timestamp remains attached."
            />
            <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {[
                [
                  "Engine",
                  forecast.engineVersion,
                ],
                [
                  "Model",
                  forecast.modelVersion,
                ],
                [
                  "Calibration",
                  forecast.calibrationVersion,
                ],
                [
                  "Input as of",
                  `${formatIntelligenceDate(
                    forecast.asOf,
                  )} · ${forecastInputFreshness.label}`,
                ],
              ].map(([label, value]) => (
                <div
                  key={label}
                  className="rounded-2xl border border-[var(--slice-border)] bg-[var(--slice-surface-strong)] p-4"
                >
                  <p className="text-[9px] font-black uppercase tracking-[0.11em] text-[var(--slice-subtle)]">
                    {label}
                  </p>
                  <p className="mt-2 break-words text-sm font-black text-[var(--slice-heading)]">
                    {value}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 grid gap-3 lg:grid-cols-2">
              {[
                ...forecast.limitations,
                ...forecast.simulation
                  .knownLimitations,
              ]
                .filter(
                  (value, index, array) =>
                    value &&
                    array.indexOf(value) ===
                      index,
                )
                .slice(0, 12)
                .map((limitation) => (
                  <IntelligenceNotice
                    key={limitation}
                    tone="amber"
                    icon={
                      <AlertTriangle className="h-4 w-4" />
                    }
                  >
                    {limitation}
                  </IntelligenceNotice>
                ))}
            </div>
          </IntelligenceSurface>
        </>
      ) : (
        <IntelligenceSurface className="mt-5 p-8">
          <div className="grid min-h-[340px] place-items-center text-center">
            <div className="max-w-2xl">
              <span className="mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-[var(--slice-accent-border)] bg-[var(--slice-accent-soft)] text-[var(--slice-accent-strong)]">
                <Target className="h-8 w-8" />
              </span>
              <h2 className="mt-5 text-3xl font-black tracking-[-0.04em] text-[var(--slice-heading)]">
                No forecast runs on navigation
              </h2>
              <p className="mt-3 text-sm font-semibold leading-7 text-[var(--slice-muted)]">
                Start an explicit current research
                cycle above. Slice will reject
                materially stale, invalid, missing,
                or future-dated forecast input before
                generating the probability surface.
              </p>
            </div>
          </div>
        </IntelligenceSurface>
      )}
    </IntelligencePage>
  );
}