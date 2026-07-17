"use client";

import {
  useCallback,
  useEffect,
  useState,
} from "react";

type HealthCheck = {
  key:
    string;

  label:
    string;

  status:
    "Healthy" | "Warning" | "Critical";

  detail:
    string;

  remediation:
    string;
};

type UsageOperation = {
  operation:
    string;

  count:
    number;

  estimatedCostUsd:
    number;

  completed:
    number;

  failed:
    number;
};

type Incident = {
  id:
    string;

  title:
    string;

  detail:
    string | null;

  severity:
    string;

  status:
    string;

  createdAt:
    string;
};

type Circuit = {
  id:
    string;

  sourceType:
    string | null;

  status:
    string;

  detail:
    string | null;

  metadata: {
    service?:
      string;

    state?:
      string;

    reason?:
      string;

    openedAt?:
      string | null;

    openUntil?:
      string | null;

    automatic?:
      boolean;
  };
};

type RolePolicy = {
  id:
    string;

  roleName:
    string;

  description:
    string;

  status:
    string;

  permissions:
    unknown;
};

type Overview = {
  ok:
    boolean;

  health: {
    generatedAt:
      string;

    score:
      number;

    status:
      string;

    checks:
      HealthCheck[];

    activeCircuits:
      unknown[];

    openIncidents:
      Incident[];

    usage: {
      operationCount:
        number;

      estimatedCostUsd:
        number;

      byOperation:
        UsageOperation[];

      budget: {
        dailyEstimatedCostLimitUsd:
          number;

        warningPercent:
          number;

        hardStopEnabled:
          boolean;
      };

      budgetPercent:
        number;
    };

    metrics: {
      recentFailures:
        number;

      pendingOldApprovals:
        number;

      criticalDriftAlerts:
        number;

      dataQualityReviewCount:
        number;

      overdueSettlementCount:
        number;

      productionModelCount:
        number;
    };
  };

  rolePolicies:
    RolePolicy[];

  incidents:
    Incident[];

  circuits:
    Circuit[];

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

function dateTime(
  value:
    string | null | undefined,
) {
  if (!value) {
    return "—";
  }

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
  const normalized =
    status.toLowerCase();

  if (
    normalized.includes(
      "healthy",
    ) ||
    normalized.includes(
      "closed",
    ) ||
    normalized.includes(
      "resolved",
    )
  ) {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
  }

  if (
    normalized.includes(
      "critical",
    ) ||
    normalized.includes(
      "open",
    )
  ) {
    return "border-red-400/25 bg-red-500/10 text-red-100";
  }

  return "border-amber-400/25 bg-amber-500/10 text-amber-100";
}

export default function ProductionControlsPage() {
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
    message,
    setMessage,
  ] =
    useState(
      "Loading production controls.",
    );

  const [
    budget,
    setBudget,
  ] =
    useState(
      8,
    );

  const [
    warningPercent,
    setWarningPercent,
  ] =
    useState(
      70,
    );

  const [
    hardStopEnabled,
    setHardStopEnabled,
  ] =
    useState(
      true,
    );

  const [
    incidentTitle,
    setIncidentTitle,
  ] =
    useState("");

  const [
    incidentSummary,
    setIncidentSummary,
  ] =
    useState("");

  const [
    incidentSeverity,
    setIncidentSeverity,
  ] =
    useState(
      "Warning",
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
              "/api/intelligence/production-controls",
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
              "Unable to load production controls.",
            );
          }

          setOverview(
            body,
          );

          setBudget(
            body.health
              .usage
              .budget
              .dailyEstimatedCostLimitUsd,
          );

          setWarningPercent(
            body.health
              .usage
              .budget
              .warningPercent,
          );

          setHardStopEnabled(
            body.health
              .usage
              .budget
              .hardStopEnabled,
          );

          setMessage(
            "Production controls loaded. Cost figures are operational estimates, not vendor invoices.",
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load production controls.",
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

  async function postAction(
    body:
      Record<string, unknown>,
  ) {
    const response =
      await fetch(
        "/api/intelligence/production-controls",
        {
          method:
            "POST",

          headers: {
            "Content-Type":
              "application/json",
          },

          body:
            JSON.stringify(
              body,
            ),
        },
      );

    const result =
      (await response.json()) as {
        error?:
          string;

        detail?:
          string;
      };

    if (!response.ok) {
      throw new Error(
        result.detail ??
        result.error ??
        "Production-control action failed.",
      );
    }

    return result;
  }

  async function runAction(
    name: string,
    body:
      Record<string, unknown>,
  ) {
    setActiveAction(
      name,
    );

    try {
      await postAction(
        body,
      );

      setMessage(
        `${name} completed.`,
      );

      await loadOverview();
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : `${name} failed.`,
      );
    } finally {
      setActiveAction(
        null,
      );
    }
  }

  async function saveBudget() {
    await runAction(
      "Budget update",
      {
        action:
          "update-budget",

        dailyEstimatedCostLimitUsd:
          budget,

        warningPercent,

        hardStopEnabled,
      },
    );
  }

  async function createIncident() {
    if (
      !incidentTitle.trim() ||
      !incidentSummary.trim()
    ) {
      setMessage(
        "Enter an incident title and summary.",
      );

      return;
    }

    await runAction(
      "Incident creation",
      {
        action:
          "create-incident",

        title:
          incidentTitle,

        summary:
          incidentSummary,

        severity:
          incidentSeverity,
      },
    );

    setIncidentTitle(
      "",
    );

    setIncidentSummary(
      "",
    );
  }

  async function resolveIncident(
    incidentId: string,
  ) {
    const resolution =
      window.prompt(
        "Document root cause, containment, and recovery:",
      );

    if (!resolution) {
      return;
    }

    await runAction(
      "Incident resolution",
      {
        action:
          "resolve-incident",

        incidentId,

        resolution,
      },
    );
  }

  async function changeCircuit(
    service: string,
    state:
      "Open" | "Closed",
  ) {
    const reason =
      window.prompt(
        state ===
        "Open"
          ? "Why should this service be disabled?"
          : "Why is it safe to restore this service?",
      );

    if (!reason) {
      return;
    }

    await runAction(
      `${service} circuit ${state}`,
      {
        action:
          state ===
          "Open"
            ? "open-circuit"
            : "close-circuit",

        service,

        reason,

        minutes:
          30,
      },
    );
  }

  const health =
    overview?.health;

  return (
    <main className="mx-auto min-h-screen max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-red-500/15 bg-gradient-to-br from-red-950/30 via-black to-black p-6 shadow-2xl shadow-red-950/20 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300">
          Slice Operational Resilience
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
          Production Controls
        </h1>

        <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
          Monitor security posture, database-backed throttling,
          estimated-cost budgets, service circuit breakers, model
          failures, settlement backlogs, evidence quality, and
          production incidents.
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
                "Production health scan",
                {
                  action:
                    "scan",
                },
              )
            }
            className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-5 py-3 text-sm font-black text-emerald-100 disabled:opacity-40"
          >
            {activeAction ===
            "Production health scan"
              ? "Scanning…"
              : "Run Full Health Scan"}
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
            "Health Score",
            health
              ? `${health.score}/100`
              : "—",
          ],
          [
            "Status",
            health?.status ??
            "—",
          ],
          [
            "Daily Operations",
            health
              ?.usage
              .operationCount ??
            0,
          ],
          [
            "Estimated Cost",
            `$${number(
              health
                ?.usage
                .estimatedCostUsd ??
              0,
              4,
            )}`,
          ],
          [
            "Budget Used",
            `${number(
              health
                ?.usage
                .budgetPercent ??
              0,
            )}%`,
          ],
          [
            "Open Incidents",
            overview
              ?.incidents
              .filter(
                (incident) =>
                  incident.status ===
                  "Open",
              )
              .length ??
            0,
          ],
          [
            "Trading",
            "Disabled",
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
          Loading production controls…
        </div>
      ) : null}

      <section className="mt-6 rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
        <h2 className="text-xl font-black text-white">
          Security and Health Checks
        </h2>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(health?.checks ?? []).map(
            (check) => (
              <article
                key={
                  check.key
                }
                className={`rounded-2xl border p-5 ${statusClass(
                  check.status,
                )}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-black">
                    {check.label}
                  </h3>

                  <span className="text-[10px] font-black uppercase">
                    {check.status}
                  </span>
                </div>

                <p className="mt-3 text-xs leading-5 opacity-90">
                  {check.detail}
                </p>

                <p className="mt-3 text-[11px] leading-5 opacity-65">
                  {check.remediation}
                </p>
              </article>
            ),
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <article className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
          <h2 className="text-xl font-black text-white">
            Estimated-Cost Budget
          </h2>

          <p className="mt-2 text-xs leading-5 text-slate-500">
            These amounts are internal operational estimates and must
            be reconciled against actual provider invoices.
          </p>

          <div className="mt-5 grid gap-4 sm:grid-cols-2">
            <label className="grid gap-2">
              <span className="text-xs font-black text-slate-300">
                Daily limit in USD
              </span>

              <input
                type="number"
                min={
                  0.1
                }
                step={
                  0.1
                }
                value={
                  budget
                }
                onChange={(
                  event,
                ) =>
                  setBudget(
                    Number(
                      event.target
                        .value,
                    ),
                  )
                }
                className="rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white"
              />
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black text-slate-300">
                Warning percentage
              </span>

              <input
                type="number"
                min={
                  1
                }
                max={
                  100
                }
                value={
                  warningPercent
                }
                onChange={(
                  event,
                ) =>
                  setWarningPercent(
                    Number(
                      event.target
                        .value,
                    ),
                  )
                }
                className="rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white"
              />
            </label>
          </div>

          <label className="mt-4 flex items-center gap-3 text-sm text-slate-300">
            <input
              type="checkbox"
              checked={
                hardStopEnabled
              }
              onChange={(
                event,
              ) =>
                setHardStopEnabled(
                  event.target
                    .checked,
                )
              }
            />

            Block new guarded operations when the estimated budget is
            reached
          </label>

          <button
            type="button"
            disabled={
              Boolean(
                activeAction,
              )
            }
            onClick={() =>
              void saveBudget()
            }
            className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 px-5 py-3 text-sm font-black text-red-100 disabled:opacity-40"
          >
            Save Budget Policy
          </button>

          <div className="mt-6 space-y-2">
            {(health
              ?.usage
              .byOperation ??
            []).map(
              (operation) => (
                <div
                  key={
                    operation.operation
                  }
                  className="rounded-xl border border-white/8 bg-black/30 p-4"
                >
                  <div className="flex justify-between gap-4 text-xs">
                    <span className="font-black text-white">
                      {operation.operation}
                    </span>

                    <span className="text-slate-400">
                      $
                      {number(
                        operation.estimatedCostUsd,
                        4,
                      )}
                    </span>
                  </div>

                  <div className="mt-2 text-[10px] text-slate-600">
                    {operation.count} request(s) ·{" "}
                    {operation.completed} completed ·{" "}
                    {operation.failed} failed
                  </div>
                </div>
              ),
            )}
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
          <h2 className="text-xl font-black text-white">
            Manual Incident
          </h2>

          <div className="mt-5 grid gap-3">
            <input
              value={
                incidentTitle
              }
              onChange={(
                event,
              ) =>
                setIncidentTitle(
                  event.target
                    .value,
                )
              }
              placeholder="Incident title"
              className="rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white placeholder:text-slate-600"
            />

            <textarea
              value={
                incidentSummary
              }
              onChange={(
                event,
              ) =>
                setIncidentSummary(
                  event.target
                    .value,
                )
              }
              rows={
                5
              }
              placeholder="Describe impact, systems affected, and current containment."
              className="resize-none rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm leading-6 text-white placeholder:text-slate-600"
            />

            <select
              value={
                incidentSeverity
              }
              onChange={(
                event,
              ) =>
                setIncidentSeverity(
                  event.target
                    .value,
                )
              }
              className="rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white"
            >
              <option value="Info">
                Info
              </option>

              <option value="Warning">
                Warning
              </option>

              <option value="Critical">
                Critical
              </option>
            </select>

            <button
              type="button"
              disabled={
                Boolean(
                  activeAction,
                )
              }
              onClick={() =>
                void createIncident()
              }
              className="rounded-xl border border-red-400/25 bg-red-500/10 px-5 py-3 text-sm font-black text-red-100 disabled:opacity-40"
            >
              Open Incident
            </button>
          </div>
        </article>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <article className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
          <h2 className="text-xl font-black text-white">
            Service Circuit Breakers
          </h2>

          <div className="mt-5 space-y-3">
            {(overview?.circuits ?? []).map(
              (circuit) => {
                const service =
                  circuit.metadata
                    .service ||
                  circuit.sourceType ||
                  "Unknown service";

                const state =
                  circuit.metadata
                    .state ||
                  circuit.status;

                return (
                  <div
                    key={
                      circuit.id
                    }
                    className="rounded-2xl border border-white/8 bg-black/30 p-5"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <div className="font-black text-white">
                          {service}
                        </div>

                        <div className="mt-1 text-xs text-slate-500">
                          {circuit.metadata
                            .reason ||
                          circuit.detail}
                        </div>
                      </div>

                      <span
                        className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusClass(
                          state,
                        )}`}
                      >
                        {state}
                      </span>
                    </div>

                    <div className="mt-3 text-[10px] text-slate-600">
                      Open until{" "}
                      {dateTime(
                        circuit.metadata
                          .openUntil,
                      )}
                    </div>

                    <div className="mt-4 flex gap-2">
                      <button
                        type="button"
                        disabled={
                          Boolean(
                            activeAction,
                          )
                        }
                        onClick={() =>
                          void changeCircuit(
                            service,
                            "Open",
                          )
                        }
                        className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 disabled:opacity-40"
                      >
                        Open
                      </button>

                      <button
                        type="button"
                        disabled={
                          Boolean(
                            activeAction,
                          )
                        }
                        onClick={() =>
                          void changeCircuit(
                            service,
                            "Closed",
                          )
                        }
                        className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100 disabled:opacity-40"
                      >
                        Close
                      </button>
                    </div>
                  </div>
                );
              },
            )}

            {!overview?.circuits.length ? (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                No service circuit has been opened.
              </div>
            ) : null}
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
          <h2 className="text-xl font-black text-white">
            Incident History
          </h2>

          <div className="mt-5 space-y-3">
            {(overview?.incidents ?? []).map(
              (incident) => (
                <div
                  key={
                    incident.id
                  }
                  className="rounded-2xl border border-white/8 bg-black/30 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">
                        {incident.title}
                      </div>

                      <div className="mt-1 text-[10px] text-slate-600">
                        {dateTime(
                          incident.createdAt,
                        )}
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusClass(
                        incident.status,
                      )}`}
                    >
                      {incident.status}
                    </span>
                  </div>

                  <p className="mt-3 whitespace-pre-wrap text-xs leading-5 text-slate-400">
                    {incident.detail}
                  </p>

                  {incident.status ===
                  "Open" ? (
                    <button
                      type="button"
                      disabled={
                        Boolean(
                          activeAction,
                        )
                      }
                      onClick={() =>
                        void resolveIncident(
                          incident.id,
                        )
                      }
                      className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100 disabled:opacity-40"
                    >
                      Resolve Incident
                    </button>
                  ) : null}
                </div>
              ),
            )}

            {!overview?.incidents.length ? (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                No production incident has been recorded.
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
        <h2 className="text-xl font-black text-white">
          Intelligence Role Policies
        </h2>

        <div className="mt-5 grid gap-4 md:grid-cols-3">
          {(overview?.rolePolicies ?? []).map(
            (policy) => (
              <article
                key={
                  policy.id
                }
                className="rounded-2xl border border-white/8 bg-black/30 p-5"
              >
                <div className="font-black text-white">
                  {policy.roleName}
                </div>

                <p className="mt-3 text-xs leading-5 text-slate-500">
                  {policy.description}
                </p>

                <span
                  className={`mt-4 inline-flex rounded-full border px-3 py-1 text-[10px] font-black ${statusClass(
                    policy.status,
                  )}`}
                >
                  {policy.status}
                </span>
              </article>
            ),
          )}
        </div>
      </section>
    </main>
  );
}