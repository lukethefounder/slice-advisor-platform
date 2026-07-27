"use client";

import Link from "next/link";
import {
  AlertTriangle,
  ArrowLeft,
  Bot,
  BrainCircuit,
  CheckCircle2,
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
  useMemo,
  useState,
  type ReactNode,
} from "react";

import type {
  ResearchCohort,
  ResearchSwarmResponse,
} from "@/lib/intelligence/research-swarm-types";
import type {
  ForecastFactorContribution,
  ForecastHorizon,
  ForecastResponse,
} from "@/lib/intelligence-forecast/types";

type ForecastWithPersistence = ForecastResponse & {
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

const panelClass =
  "rounded-[1.75rem] border border-white/10 bg-black/58 shadow-2xl shadow-black/40 backdrop-blur-xl";

function cx(...values: Array<string | false | null | undefined>) {
  return values.filter(Boolean).join(" ");
}

function number(value: number | null | undefined, decimals = 1) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

function currency(
  value: number | null | undefined,
  currencyCode = "USD",
) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return value.toLocaleString("en-US", {
    style: "currency",
    currency: currencyCode || "USD",
    maximumFractionDigits: value >= 100 ? 2 : 4,
  });
}

function signedPercent(value: number | null | undefined) {
  if (value === null || value === undefined || !Number.isFinite(value)) {
    return "—";
  }

  return `${value > 0 ? "+" : ""}${number(value, 2)}%`;
}

function Badge({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: "green" | "red" | "amber" | "cyan" | "purple" | "orange" | "slate";
}) {
  const colors = {
    green: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    red: "border-emerald-400/25 bg-emerald-500/10 text-emerald-200",
    amber: "border-amber-400/25 bg-amber-500/10 text-amber-100",
    cyan: "border-cyan-400/25 bg-cyan-500/10 text-cyan-100",
    purple: "border-purple-400/25 bg-purple-500/10 text-purple-100",
    orange: "border-orange-400/25 bg-orange-500/10 text-orange-100",
    slate: "border-white/10 bg-white/[0.05] text-slate-300",
  } as const;

  return (
    <span
      className={cx(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[10px] font-black uppercase tracking-[0.15em]",
        colors[tone],
      )}
    >
      {children}
    </span>
  );
}

function Progress({ value }: { value: number }) {
  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/[0.06]">
      <div
        className="h-full rounded-full bg-gradient-to-r from-emerald-500 to-emerald-800"
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function Metric({
  label,
  value,
  helper,
}: {
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
      <p className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
        {label}
      </p>
      <p className="mt-2 text-2xl font-black text-white">{value}</p>
      <p className="mt-2 text-xs font-semibold leading-5 text-slate-500">
        {helper}
      </p>
    </div>
  );
}

function Contribution({
  contribution,
}: {
  contribution: ForecastFactorContribution;
}) {
  const positive = contribution.contribution >= 0;

  return (
    <div className="rounded-2xl border border-white/8 bg-white/[0.025] p-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-sm font-black text-white">
            {contribution.factor}
          </p>
          <p className="mt-1 text-[10px] font-black uppercase tracking-[0.13em] text-slate-600">
            Weight {number(contribution.weight * 100, 1)}%
          </p>
        </div>
        <span
          className={cx(
            "text-sm font-black",
            positive ? "text-emerald-300" : "text-emerald-300",
          )}
        >
          {positive ? "+" : ""}
          {number(contribution.contribution, 3)}
        </span>
      </div>
      <p className="mt-3 text-xs font-semibold leading-5 text-slate-500">
        {contribution.explanation}
      </p>
    </div>
  );
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    cache: "no-store",
    ...init,
  });
  const body = (await response.json()) as T & {
    error?: string;
    detail?: string;
  };

  if (!response.ok) {
    throw new Error(
      body.detail || body.error || `Request failed with HTTP ${response.status}.`,
    );
  }

  return body;
}

function cohortTone(cohort: ResearchCohort) {
  return cohort === "media"
    ? ("orange" as const)
    : cohort === "technical"
      ? ("cyan" as const)
      : ("purple" as const);
}

export default function ForecastLabPage() {
  const [symbolInput, setSymbolInput] = useState("MSFT");
  const [agentCount, setAgentCount] = useState(2_000);
  const [simulationPaths, setSimulationPaths] = useState(500);
  const [swarm, setSwarm] = useState<ResearchSwarmResponse | null>(null);
  const [forecast, setForecast] = useState<ForecastWithPersistence | null>(null);
  const [selectedHorizon, setSelectedHorizon] =
    useState<ForecastHorizon>("2-5d");
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState(
    "Run the research swarm and generate a stored forecast from its equal-third Slice score.",
  );

  async function runForecast() {
    const symbol = symbolInput.trim().toUpperCase() || "MSFT";
    setRunning(true);
    setMessage(
      `Running ${agentCount.toLocaleString()} research pathways for ${symbol}.`,
    );

    try {
      const research = await fetchJson<ResearchSwarmResponse>(
        "/api/intelligence/research-swarm",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            symbol,
            agentCount,
            simulationPaths,
            graphMode: "summary",
            detailMode: "summary",
            persistGraph: true,
          }),
        },
      );
      setSwarm(research);
      setMessage("Research complete. Generating all forecast horizons.");
      const result = await fetchJson<ForecastWithPersistence>(
        "/api/intelligence/forecast",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(research.forecastSnapshot),
        },
      );
      setForecast(result);
      setSelectedHorizon(result.horizons[0]?.horizon ?? "2-5d");
      setMessage(
        `${symbol} forecast stored with agentic Slice score ${number(
          research.score.overall,
          1,
        )}.`,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate the agentic forecast.",
      );
    } finally {
      setRunning(false);
    }
  }

  const currentHorizon = useMemo(
    () =>
      forecast?.horizons.find(
        (horizon) => horizon.horizon === selectedHorizon,
      ) ?? forecast?.horizons[0] ?? null,
    [forecast, selectedHorizon],
  );
  const currencyCode = swarm?.market.currency || "USD";

  return (
    <main className="relative min-h-screen overflow-hidden px-4 py-6 sm:px-6 lg:px-8">
      <div className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute left-[-12rem] top-[-12rem] h-[36rem] w-[36rem] rounded-full bg-emerald-700/17 blur-3xl" />
        <div className="absolute right-[-14rem] top-[7rem] h-[38rem] w-[38rem] rounded-full bg-cyan-800/8 blur-3xl" />
      </div>

      <div className="mx-auto max-w-[1900px]">
        <section className={cx(panelClass, "p-6 sm:p-8")}>
          <div className="flex flex-col gap-6 xl:flex-row xl:items-end xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Badge tone="red">
                  <Target className="h-3.5 w-3.5" />
                  Agentic Forecast Lab
                </Badge>
                <Badge tone="green">
                  <BrainCircuit className="h-3.5 w-3.5" />
                  Equal-third Slice score
                </Badge>
              </div>
              <h1 className="mt-4 max-w-5xl text-4xl font-black tracking-[-0.045em] text-white sm:text-6xl">
                Forecasts powered by the entire research swarm.
              </h1>
              <p className="mt-4 max-w-4xl text-sm font-semibold leading-7 text-slate-400 sm:text-base">
                Media, technical, and economy agents each contribute exactly one third
                to the point-in-time Slice score. That score, evidence quality, and
                contradictions flow into every forecast horizon and stored provenance record.
              </p>
            </div>

            <Link
              href="/workspace/intelligence"
              className="inline-flex items-center gap-2 self-start rounded-xl border border-white/10 bg-white/[0.04] px-4 py-3 text-xs font-black text-slate-300 hover:text-white xl:self-auto"
            >
              <ArrowLeft className="h-4 w-4" />
              Control Plane
            </Link>
          </div>

          <div className="mt-7 grid gap-3 xl:grid-cols-[1fr_290px_290px_auto]">
            <label className="rounded-2xl border border-white/10 bg-black/45 px-4">
              <span className="sr-only">Symbol</span>
              <input
                value={symbolInput}
                onChange={(event: any) =>
                  setSymbolInput(event.target.value.toUpperCase())
                }
                onKeyDown={(event: any) => {
                  if (event.key === "Enter") {
                    void runForecast();
                  }
                }}
                className="h-14 w-full bg-transparent text-sm font-black uppercase tracking-[0.12em] text-white outline-none"
                placeholder="MSFT"
              />
            </label>

            <label className="rounded-2xl border border-white/10 bg-black/45 px-4 py-2">
              <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                Research pathways
                <span className="text-emerald-300">
                  {agentCount.toLocaleString()}
                </span>
              </span>
              <input
                type="range"
                min={300}
                max={2_000}
                step={100}
                value={agentCount}
                onChange={(event: any) => setAgentCount(Number(event.target.value))}
                className="mt-2 w-full accent-emerald-600"
              />
            </label>

            <label className="rounded-2xl border border-white/10 bg-black/45 px-4 py-2">
              <span className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.14em] text-slate-600">
                Behavioral paths
                <span className="text-purple-300">{simulationPaths}</span>
              </span>
              <input
                type="range"
                min={100}
                max={2_000}
                step={100}
                value={simulationPaths}
                onChange={(event: any) =>
                  setSimulationPaths(Number(event.target.value))
                }
                className="mt-2 w-full accent-purple-600"
              />
            </label>

            <button
              type="button"
              onClick={() => void runForecast()}
              disabled={running}
              className="inline-flex min-h-14 items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-emerald-500 via-emerald-700 to-emerald-950 px-6 text-sm font-black text-white shadow-xl shadow-emerald-950/35 transition hover:brightness-110 disabled:opacity-50"
            >
              {running ? (
                <RefreshCw className="h-4 w-4 animate-spin" />
              ) : (
                <Play className="h-4 w-4 fill-current" />
              )}
              Research and forecast
            </button>
          </div>

          <div className="mt-4 flex items-start gap-3 rounded-2xl border border-white/10 bg-white/[0.025] p-4 text-sm font-semibold leading-6 text-slate-300">
            {running ? (
              <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 animate-spin text-emerald-300" />
            ) : forecast ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            ) : (
              <BrainCircuit className="mt-0.5 h-5 w-5 shrink-0 text-emerald-300" />
            )}
            {message}
          </div>
        </section>

        {swarm ? (
          <section className="mt-5 grid gap-5 xl:grid-cols-[0.7fr_1.3fr]">
            <div className="space-y-5">
              <section className={cx(panelClass, "p-5 sm:p-6")}>
                <Badge tone="red">
                  <BrainCircuit className="h-3.5 w-3.5" />
                  Agentic Slice Score
                </Badge>
                <div className="mt-5 flex items-end justify-between gap-4">
                  <div>
                    <p className="text-6xl font-black tracking-[-0.06em] text-white">
                      {number(swarm.score.overall, 1)}
                    </p>
                    <p className="mt-1 text-lg font-black text-white">
                      {swarm.score.label}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="text-3xl font-black text-white">
                      {number(swarm.score.confidence, 0)}%
                    </p>
                    <p className="mt-1 text-xs font-black uppercase tracking-[0.13em] text-slate-600">
                      Confidence
                    </p>
                  </div>
                </div>
                <div className="mt-5">
                  <Progress value={swarm.score.overall} />
                </div>

                <div className="mt-5 space-y-3">
                  {(["media", "technical", "economy"] as const).map(
                    (cohort) => {
                      const result = swarm.cohorts[cohort];
                      return (
                        <div
                          key={cohort}
                          className="rounded-2xl border border-white/8 bg-white/[0.025] p-4"
                        >
                          <div className="flex items-center justify-between gap-4">
                            <Badge tone={cohortTone(cohort)}>{cohort}</Badge>
                            <span className="text-2xl font-black text-white">
                              {number(result.score, 1)}
                            </span>
                          </div>
                          <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-500">
                            <span>{result.requestedAgents.toLocaleString()} agents</span>
                            <span>33.33% weight</span>
                          </div>
                        </div>
                      );
                    },
                  )}
                </div>
              </section>

              <section className={cx(panelClass, "p-5 sm:p-6")}>
                <Badge tone="cyan">
                  <Database className="h-3.5 w-3.5" />
                  Evidence quality
                </Badge>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  <Metric
                    label="Evidence coverage"
                    value={`${number(
                      swarm.score.quality.evidenceCoverage,
                      0,
                    )}%`}
                    helper="Provider and source coverage"
                  />
                  <Metric
                    label="Source diversity"
                    value={`${number(swarm.score.quality.sourceDiversity, 0)}%`}
                    helper="Independent sources"
                  />
                  <Metric
                    label="Completion"
                    value={`${number(
                      swarm.score.quality.agentCompletionRate,
                      0,
                    )}%`}
                    helper="Completed research pathways"
                  />
                  <Metric
                    label="Contradiction penalty"
                    value={number(
                      swarm.score.quality.contradictionPenalty,
                      1,
                    )}
                    helper="Cross-cohort disagreement"
                  />
                </div>
              </section>
            </div>

            <div className="space-y-5">
              <section className={cx(panelClass, "p-5 sm:p-6")}>
                <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                  <div>
                    <Badge tone="red">
                      <Layers3 className="h-3.5 w-3.5" />
                      Forecast horizons
                    </Badge>
                    <h2 className="mt-3 text-2xl font-black text-white sm:text-3xl">
                      Agentic score probability surface
                    </h2>
                  </div>
                  {forecast ? (
                    <Badge tone="green">
                      {forecast.persistence?.status || "stored"}
                    </Badge>
                  ) : null}
                </div>

                {forecast?.horizons.length ? (
                  <>
                    <div className="mt-5 flex gap-2 overflow-x-auto pb-2 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                      {forecast.horizons.map((horizon) => (
                        <button
                          key={horizon.horizon}
                          type="button"
                          onClick={() => setSelectedHorizon(horizon.horizon)}
                          className={cx(
                            "shrink-0 rounded-xl border px-4 py-3 text-xs font-black transition",
                            currentHorizon?.horizon === horizon.horizon
                              ? "border-emerald-400/30 bg-emerald-500/15 text-emerald-100"
                              : "border-white/10 bg-white/[0.025] text-slate-400 hover:text-white",
                          )}
                        >
                          {horizon.horizon}
                        </button>
                      ))}
                    </div>

                    {currentHorizon ? (
                      <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-white/[0.02] p-5">
                        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                          <div>
                            <Badge
                              tone={
                                currentHorizon.direction === "Bullish"
                                  ? "green"
                                  : currentHorizon.direction === "Bearish"
                                    ? "red"
                                    : "amber"
                              }
                            >
                              {currentHorizon.direction === "Bullish" ? (
                                <TrendingUp className="h-3.5 w-3.5" />
                              ) : currentHorizon.direction === "Bearish" ? (
                                <TrendingDown className="h-3.5 w-3.5" />
                              ) : null}
                              {currentHorizon.direction}
                            </Badge>
                            <h3 className="mt-3 text-3xl font-black text-white">
                              {currentHorizon.label}
                            </h3>
                            <p className="mt-2 text-sm font-semibold leading-6 text-slate-500">
                              {currentHorizon.primaryUncertainty}
                            </p>
                          </div>
                          <div className="rounded-2xl border border-emerald-400/15 bg-emerald-500/[0.05] p-4 text-right">
                            <p className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
                              Expected price
                            </p>
                            <p className="mt-2 text-3xl font-black text-white">
                              {currency(
                                currentHorizon.expectedPrice,
                                currencyCode,
                              )}
                            </p>
                          </div>
                        </div>

                        <div className="mt-5 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                          <Metric
                            label="Probability positive"
                            value={`${number(
                              currentHorizon.positiveReturnProbability,
                              1,
                            )}%`}
                            helper="Calibrated probability"
                          />
                          <Metric
                            label="Expected return"
                            value={signedPercent(
                              currentHorizon.expectedReturnPercent,
                            )}
                            helper="Point expectation"
                          />
                          <Metric
                            label="Confidence"
                            value={`${number(currentHorizon.confidence, 0)}%`}
                            helper={currentHorizon.modelAgreement}
                          />
                          <Metric
                            label="Expected range"
                            value={`${signedPercent(
                              currentHorizon.expectedRangePercent.low,
                            )} to ${signedPercent(
                              currentHorizon.expectedRangePercent.high,
                            )}`}
                            helper="Modeled interval"
                          />
                        </div>

                        <div className="mt-5 grid gap-3 xl:grid-cols-2">
                          {currentHorizon.contributions.map((contribution) => (
                            <Contribution
                              key={contribution.factor}
                              contribution={contribution}
                            />
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </>
                ) : (
                  <div className="mt-5 grid min-h-72 place-items-center rounded-[1.5rem] border border-dashed border-white/10 p-8 text-center">
                    <div>
                      <Target className="mx-auto h-9 w-9 text-emerald-300" />
                      <p className="mt-4 text-lg font-black text-white">
                        Forecast not generated yet
                      </p>
                    </div>
                  </div>
                )}
              </section>

              {forecast ? (
                <section className="grid gap-5 xl:grid-cols-2">
                  <div className={cx(panelClass, "p-5 sm:p-6")}>
                    <Badge tone="purple">
                      <Bot className="h-3.5 w-3.5" />
                      Embedded behavioral model
                    </Badge>
                    <div className="mt-5 grid grid-cols-2 gap-3">
                      <Metric
                        label="Paths"
                        value={number(forecast.simulation.paths, 0)}
                        helper="Deterministic paths"
                      />
                      <Metric
                        label="Positive probability"
                        value={`${number(
                          forecast.simulation.probabilityPositive,
                          1,
                        )}%`}
                        helper="Simulation distribution"
                      />
                      <Metric
                        label="Agent disagreement"
                        value={`${number(
                          forecast.simulation.agentDisagreement,
                          1,
                        )}%`}
                        helper="Lower means more consensus"
                      />
                      <Metric
                        label="Reversal frequency"
                        value={`${number(
                          forecast.simulation.reversalFrequency,
                          1,
                        )}%`}
                        helper="Path reversals"
                      />
                    </div>
                  </div>

                  <div className={cx(panelClass, "p-5 sm:p-6")}>
                    <Badge tone="green">
                      <GitBranch className="h-3.5 w-3.5" />
                      Provenance
                    </Badge>
                    <div className="mt-5 space-y-3">
                      {[
                        ["Forecast persistence", forecast.persistence?.status],
                        ["Evidence warehouse", forecast.evidenceWarehouse?.status],
                        [
                          "Point-in-time safe",
                          forecast.evidenceWarehouse?.pointInTimeSafe === true
                            ? "yes"
                            : forecast.evidenceWarehouse?.pointInTimeSafe === false
                              ? "no"
                              : "unknown",
                        ],
                        ["Knowledge graph", forecast.knowledgeGraph?.status],
                        ["Shadow predictions", forecast.shadowPersistence?.status],
                      ].map(([label, value]) => (
                        <div
                          key={label}
                          className="flex items-center justify-between gap-4 rounded-2xl border border-white/8 bg-white/[0.025] px-4 py-3"
                        >
                          <span className="text-xs font-bold text-slate-500">
                            {label}
                          </span>
                          <span className="text-xs font-black uppercase tracking-[0.12em] text-white">
                            {value || "unknown"}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                </section>
              ) : null}
            </div>
          </section>
        ) : null}

        {swarm?.warnings.length ? (
          <section className={cx(panelClass, "mt-5 p-5 sm:p-6")}>
            <Badge tone="amber">
              <AlertTriangle className="h-3.5 w-3.5" />
              Active limitations
            </Badge>
            <div className="mt-4 grid gap-3 lg:grid-cols-2">
              {swarm.warnings.map((warning) => (
                <div
                  key={warning}
                  className="rounded-2xl border border-amber-400/15 bg-amber-500/[0.05] p-4 text-xs font-semibold leading-5 text-amber-100"
                >
                  {warning}
                </div>
              ))}
            </div>
          </section>
        ) : null}
      </div>
    </main>
  );
}