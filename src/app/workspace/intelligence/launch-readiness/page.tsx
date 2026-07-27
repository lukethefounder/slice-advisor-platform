"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type LaunchMode =
  | "Shadow"
  | "Pilot"
  | "Production";

type Gate = {
  key: string;
  label: string;
  required: boolean;
  status:
    | "Passed"
    | "Failed"
    | "Warning";
  actual:
    | string
    | number
    | boolean
    | null;
  threshold:
    | string
    | number
    | boolean
    | null;
  detail: string;
  remediation: string;
};

type Drill = {
  eventId: string;
  drillKey: string;
  label: string;
  passed: boolean;
  evidence: string;
  performedAt: string;
  ageDays: number;
};

type DrillDefinition = {
  key: string;
  label: string;
  description: string;
};

type ValidationEvidence = {
  eventId: string;
  commitSha: string;
  branch: string;
  generatedAt: string;
  passed: boolean;
  typecheckPassed: boolean;
  buildPassed: boolean;
  testsPassed: boolean;
  dependencyAuditPassed: boolean;
  secretScanPassed: boolean;
  notes: string;
};

type LaunchState = {
  mode: LaunchMode;
  status: string;
  activatedAt: string;
  reason: string;
  releaseCommitSha:
    | string
    | null;
  pilotStartedAt:
    | string
    | null;
};

type Readiness = {
  generatedAt: string;
  targetMode: LaunchMode;
  currentState: LaunchState;
  score: number;
  status: string;
  allRequiredGatesPassed: boolean;
  passedRequiredGateCount: number;
  requiredGateCount: number;
  gates: Gate[];
  blockers: string[];
  warnings: string[];
  confirmationPhrase: string;
  metrics: {
    validationEvidence:
      ValidationEvidence | null;
    recoveryDrills:
      Drill[];
    totalForecastRuns: number;
    settledHorizonCount: number;
    evidenceCoveragePercent: number;
    evidenceValidatedPercent: number;
    futureEvidenceViolationCount: number;
    criticalDriftCount: number;
    productionModelCount: number;
    recentOperationCount: number;
    recentOperationSuccessPercent: number;
    pilotAgeDays:
      | number
      | null;
  };
};

type Approval = {
  id: string;
  title: string;
  actionType: string;
  riskLevel: string;
  summary: string;
  status: string;
  createdAt: string;
  approvalNotes:
    | string
    | null;
};

type Overview = {
  ok: boolean;
  targetMode: LaunchMode;
  readiness: Readiness;
  currentModeReadiness:
    | Readiness
    | null;
  pendingApprovals: Approval[];
  recoveryDrillDefinitions:
    DrillDefinition[];
  error?: string;
};

function number(
  value: number,
  decimals = 1,
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
    | string
    | null,
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
      "pass",
    ) ||
    normalized.includes(
      "ready",
    ) ||
    normalized.includes(
      "approved",
    )
  ) {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
  }

  if (
    normalized.includes(
      "fail",
    ) ||
    normalized.includes(
      "blocked",
    ) ||
    normalized.includes(
      "critical",
    ) ||
    normalized.includes(
      "rejected",
    )
  ) {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
  }

  return "border-amber-400/25 bg-amber-500/10 text-amber-100";
}

export default function LaunchReadinessPage() {
  const [
    targetMode,
    setTargetMode,
  ] =
    useState<LaunchMode>(
      "Production",
    );

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
      "Loading launch readiness.",
    );

  const [
    commitSha,
    setCommitSha,
  ] =
    useState("");

  const [
    branch,
    setBranch,
  ] =
    useState(
      "main",
    );

  const [
    validationNotes,
    setValidationNotes,
  ] =
    useState("");

  const [
    validationChecks,
    setValidationChecks,
  ] =
    useState({
      typecheckPassed:
        false,
      buildPassed:
        false,
      testsPassed:
        false,
      dependencyAuditPassed:
        false,
      secretScanPassed:
        false,
    });

  const [
    drillEvidence,
    setDrillEvidence,
  ] =
    useState<
      Record<
        string,
        string
      >
    >({});

  const [
    launchReason,
    setLaunchReason,
  ] =
    useState("");

  const [
    confirmationPhrase,
    setConfirmationPhrase,
  ] =
    useState("");

  const loadOverview =
    useCallback(
      async () => {
        setLoading(
          true,
        );

        try {
          const response =
            await fetch(
              `/api/intelligence/launch-readiness?target=${encodeURIComponent(
                targetMode,
              )}`,
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
              "Unable to load launch readiness.",
            );
          }

          setOverview(
            body,
          );

          setMessage(
            `${body.targetMode} readiness score: ${body.readiness.score}/100.`,
          );
        } catch (error) {
          setMessage(
            error instanceof Error
              ? error.message
              : "Unable to load launch readiness.",
          );
        } finally {
          setLoading(
            false,
          );
        }
      },
      [
        targetMode,
      ],
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
        "/api/intelligence/launch-readiness",
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
        error?: string;
        detail?: string;
      };

    if (!response.ok) {
      throw new Error(
        result.detail ??
        result.error ??
        "Launch-control operation failed.",
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

  async function recordValidation() {
    await runAction(
      "Release validation",
      {
        action:
          "record-validation",

        commitSha,

        branch,

        ...validationChecks,

        notes:
          validationNotes,
      },
    );
  }

  async function recordDrill(
    drillKey: string,
    passed: boolean,
  ) {
    await runAction(
      `${drillKey} drill`,
      {
        action:
          "record-drill",

        drillKey,

        passed,

        evidence:
          drillEvidence[
            drillKey
          ] ??
          "",
      },
    );
  }

  async function requestLaunch() {
    await runAction(
      `${targetMode} launch request`,
      {
        action:
          "request-launch",

        targetMode,

        reason:
          launchReason,
      },
    );
  }

  async function decideLaunch(
    approvalId: string,
    decision:
      | "approve"
      | "reject",
  ) {
    const confirmed =
      window.confirm(
        decision ===
        "approve"
          ? `Approve the ${targetMode} launch-state change?`
          : "Reject this launch request?",
      );

    if (!confirmed) {
      return;
    }

    await runAction(
      `Launch ${decision}`,
      {
        action:
          "decide-launch",

        approvalId,

        decision,

        confirmationPhrase:
          decision ===
          "approve"
            ? confirmationPhrase
            : "",

        notes:
          decision ===
          "approve"
            ? `Human-approved transition to ${targetMode}.`
            : "Launch request rejected.",
      },
    );
  }

  const readiness =
    overview?.readiness;

  const launchApprovals =
    useMemo(
      () =>
        (
          overview
            ?.pendingApprovals ??
          []
        ).filter(
          (approval) =>
            approval.status ===
            "Pending",
        ),
      [
        overview,
      ],
    );

  const currentValidation =
    readiness
      ?.metrics
      .validationEvidence ??
    null;

  return (
    <main className="mx-auto min-h-screen max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-emerald-500/15 bg-gradient-to-br from-emerald-950/30 via-black to-black p-6 shadow-2xl shadow-emerald-950/20 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-emerald-300">
          Slice Controlled Launch
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
          Launch Readiness
        </h1>

        <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
          Validate Shadow, Pilot, and Production acceptance gates.
          Launch-state changes require a stored approval, an exact
          human confirmation phrase, and a fresh readiness scan.
        </p>

        <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
          {message}
        </div>

        <div className="mt-6 flex flex-wrap gap-3">
          <select
            value={
              targetMode
            }
            onChange={(
              event,
            ) => {
              setTargetMode(
                event.target
                  .value as LaunchMode,
              );

              setConfirmationPhrase(
                "",
              );
            }}
            className="rounded-xl border border-white/10 bg-black/70 px-4 py-3 text-sm font-black text-white"
          >
            <option value="Shadow">
              Shadow
            </option>

            <option value="Pilot">
              Pilot
            </option>

            <option value="Production">
              Production
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
              void runAction(
                "Readiness scan",
                {
                  action:
                    "scan",

                  targetMode,
                },
              )
            }
            className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-5 py-3 text-sm font-black text-emerald-100 disabled:opacity-40"
          >
            {activeAction ===
            "Readiness scan"
              ? "Scanning…"
              : "Run and Store Scan"}
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
            "Current Mode",
            readiness
              ?.currentState
              .mode ??
            "—",
          ],
          [
            "Target Mode",
            targetMode,
          ],
          [
            "Readiness",
            readiness
              ?.status ??
            "—",
          ],
          [
            "Score",
            readiness
              ? `${number(
                  readiness.score,
                )}/100`
              : "—",
          ],
          [
            "Passed Gates",
            readiness
              ? `${readiness.passedRequiredGateCount}/${readiness.requiredGateCount}`
              : "—",
          ],
          [
            "Settled Outcomes",
            readiness
              ?.metrics
              .settledHorizonCount ??
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
          Loading launch gates…
        </div>
      ) : null}

      <section className="mt-6 rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-xl font-black text-white">
            {targetMode} Acceptance Gates
          </h2>

          <span
            className={`rounded-full border px-4 py-2 text-xs font-black ${statusClass(
              readiness
                ?.status ??
              "Blocked",
            )}`}
          >
            {readiness
              ?.status ??
            "Blocked"}
          </span>
        </div>

        <div className="mt-5 grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {(readiness?.gates ?? []).map(
            (gate) => (
              <article
                key={
                  gate.key
                }
                className={`rounded-2xl border p-5 ${statusClass(
                  gate.status,
                )}`}
              >
                <div className="flex items-start justify-between gap-3">
                  <h3 className="font-black">
                    {gate.label}
                  </h3>

                  <span className="text-[10px] font-black uppercase">
                    {gate.status}
                  </span>
                </div>

                <div className="mt-3 text-xs">
                  Actual:{" "}
                  <strong>
                    {String(
                      gate.actual ??
                      "—",
                    )}
                  </strong>
                </div>

                <div className="mt-1 text-xs">
                  Required:{" "}
                  <strong>
                    {String(
                      gate.threshold ??
                      "—",
                    )}
                  </strong>
                </div>

                <p className="mt-3 text-xs leading-5 opacity-85">
                  {gate.detail}
                </p>

                {gate.status !==
                "Passed" ? (
                  <p className="mt-3 text-[11px] leading-5 opacity-65">
                    {gate.remediation}
                  </p>
                ) : null}
              </article>
            ),
          )}
        </div>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <article className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
          <h2 className="text-xl font-black text-white">
            Release Validation Evidence
          </h2>

          {currentValidation ? (
            <div
              className={`mt-4 rounded-xl border p-4 ${statusClass(
                currentValidation.passed
                  ? "Passed"
                  : "Failed",
              )}`}
            >
              <div className="font-black">
                Commit{" "}
                {currentValidation.commitSha}
              </div>

              <div className="mt-1 text-xs opacity-75">
                {currentValidation.branch} ·{" "}
                {dateTime(
                  currentValidation.generatedAt,
                )}
              </div>
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            <input
              value={
                commitSha
              }
              onChange={(
                event,
              ) =>
                setCommitSha(
                  event.target
                    .value,
                )
              }
              placeholder="Validated Git commit SHA"
              className="rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white placeholder:text-slate-600"
            />

            <input
              value={
                branch
              }
              onChange={(
                event,
              ) =>
                setBranch(
                  event.target
                    .value,
                )
              }
              placeholder="Branch"
              className="rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white placeholder:text-slate-600"
            />

            {[
              [
                "typecheckPassed",
                "TypeScript passed",
              ],
              [
                "buildPassed",
                "Production build passed",
              ],
              [
                "testsPassed",
                "Automated and manual tests passed",
              ],
              [
                "dependencyAuditPassed",
                "High-severity dependency audit passed",
              ],
              [
                "secretScanPassed",
                "Secret scan passed",
              ],
            ].map(
              ([
                key,
                label,
              ]) => (
                <label
                  key={
                    key
                  }
                  className="flex items-center gap-3 text-sm text-slate-300"
                >
                  <input
                    type="checkbox"
                    checked={
                      validationChecks[
                        key as keyof typeof validationChecks
                      ]
                    }
                    onChange={(
                      event,
                    ) =>
                      setValidationChecks(
                        (
                          current,
                        ) => ({
                          ...current,

                          [key]:
                            event.target
                              .checked,
                        }),
                      )
                    }
                  />

                  {label}
                </label>
              ),
            )}

            <textarea
              value={
                validationNotes
              }
              onChange={(
                event,
              ) =>
                setValidationNotes(
                  event.target
                    .value,
                )
              }
              rows={
                4
              }
              placeholder="Validation notes and report location"
              className="resize-none rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white placeholder:text-slate-600"
            />

            <button
              type="button"
              disabled={
                Boolean(
                  activeAction,
                )
              }
              onClick={() =>
                void recordValidation()
              }
              className="rounded-xl border border-blue-400/25 bg-blue-500/10 px-5 py-3 text-sm font-black text-blue-100 disabled:opacity-40"
            >
              Record Release Evidence
            </button>
          </div>
        </article>

        <article className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
          <h2 className="text-xl font-black text-white">
            Launch Approval
          </h2>

          <textarea
            value={
              launchReason
            }
            onChange={(
              event,
            ) =>
              setLaunchReason(
                event.target
                  .value,
              )
            }
            rows={
              5
            }
            placeholder="Document why this operating-state change is appropriate."
            className="mt-5 w-full resize-none rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white placeholder:text-slate-600"
          />

          <button
            type="button"
            disabled={
              Boolean(
                activeAction,
              ) ||
              (
                targetMode !==
                  "Shadow" &&
                !readiness
                  ?.allRequiredGatesPassed
              )
            }
            onClick={() =>
              void requestLaunch()
            }
            className="mt-4 rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-5 py-3 text-sm font-black text-emerald-100 disabled:opacity-40"
          >
            Request {targetMode} Approval
          </button>

          <div className="mt-6 rounded-xl border border-emerald-400/20 bg-emerald-500/[0.05] p-4">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-emerald-300">
              Exact Confirmation Phrase
            </div>

            <div className="mt-2 break-words font-mono text-sm text-emerald-100">
              {readiness
                ?.confirmationPhrase ??
              "—"}
            </div>

            <input
              value={
                confirmationPhrase
              }
              onChange={(
                event,
              ) =>
                setConfirmationPhrase(
                  event.target
                    .value,
                )
              }
              placeholder="Type the exact phrase"
              className="mt-4 w-full rounded-xl border border-emerald-400/20 bg-black/60 px-4 py-3 font-mono text-sm text-white placeholder:text-slate-600"
            />
          </div>

          <div className="mt-5 space-y-3">
            {launchApprovals.map(
              (approval) => (
                <div
                  key={
                    approval.id
                  }
                  className="rounded-xl border border-amber-400/20 bg-amber-500/[0.05] p-4"
                >
                  <div className="font-black text-white">
                    {approval.title}
                  </div>

                  <div className="mt-2 text-xs leading-5 text-slate-400">
                    {approval.summary}
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
                        void decideLaunch(
                          approval.id,
                          "approve",
                        )
                      }
                      className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100 disabled:opacity-40"
                    >
                      Approve
                    </button>

                    <button
                      type="button"
                      disabled={
                        Boolean(
                          activeAction,
                        )
                      }
                      onClick={() =>
                        void decideLaunch(
                          approval.id,
                          "reject",
                        )
                      }
                      className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100 disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ),
            )}

            {!launchApprovals.length ? (
              <div className="rounded-xl border border-dashed border-white/10 p-6 text-center text-sm text-slate-500">
                No launch-state approval is pending.
              </div>
            ) : null}
          </div>
        </article>
      </section>

      <section className="mt-6 rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
        <h2 className="text-xl font-black text-white">
          Recovery and Adversarial Drills
        </h2>

        <div className="mt-5 grid gap-4 lg:grid-cols-2">
          {(overview?.recoveryDrillDefinitions ?? []).map(
            (definition) => {
              const current =
                readiness
                  ?.metrics
                  .recoveryDrills
                  .find(
                    (drill) =>
                      drill.drillKey ===
                      definition.key,
                  );

              return (
                <article
                  key={
                    definition.key
                  }
                  className="rounded-2xl border border-white/8 bg-black/30 p-5"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black text-white">
                        {definition.label}
                      </h3>

                      <p className="mt-2 text-xs leading-5 text-slate-500">
                        {definition.description}
                      </p>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusClass(
                        current?.passed
                          ? "Passed"
                          : "Failed",
                      )}`}
                    >
                      {current?.passed
                        ? "Passed"
                        : "Not Passed"}
                    </span>
                  </div>

                  {current?.performedAt ? (
                    <div className="mt-3 text-[10px] text-slate-600">
                      Last performed{" "}
                      {dateTime(
                        current.performedAt,
                      )}{" "}
                      · {number(
                        current.ageDays,
                      )} days old
                    </div>
                  ) : null}

                  <textarea
                    value={
                      drillEvidence[
                        definition.key
                      ] ??
                      ""
                    }
                    onChange={(
                      event,
                    ) =>
                      setDrillEvidence(
                        (
                          existing,
                        ) => ({
                          ...existing,

                          [definition.key]:
                            event.target
                              .value,
                        }),
                      )
                    }
                    rows={
                      4
                    }
                    placeholder="Document commands, observations, timestamps, result, and reviewer."
                    className="mt-4 w-full resize-none rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white placeholder:text-slate-600"
                  />

                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      disabled={
                        Boolean(
                          activeAction,
                        )
                      }
                      onClick={() =>
                        void recordDrill(
                          definition.key,
                          true,
                        )
                      }
                      className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100 disabled:opacity-40"
                    >
                      Record Pass
                    </button>

                    <button
                      type="button"
                      disabled={
                        Boolean(
                          activeAction,
                        )
                      }
                      onClick={() =>
                        void recordDrill(
                          definition.key,
                          false,
                        )
                      }
                      className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-4 py-2 text-xs font-black text-emerald-100 disabled:opacity-40"
                    >
                      Record Failure
                    </button>
                  </div>
                </article>
              );
            },
          )}
        </div>
      </section>
    </main>
  );
}