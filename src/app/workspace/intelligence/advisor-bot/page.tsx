"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";

type SourceReference = {
  sourceType:
    string;

  sourceId:
    string;

  label:
    string;

  asOfAt:
    string | null;
};

type ConversationMessage = {
  id:
    string;

  role:
    "user" | "assistant";

  content:
    string;

  createdAt:
    string;

  confidence:
    number | null;

  sourceReferences:
    SourceReference[];
};

type Profile = {
  id:
    string;

  botName:
    string;

  styleInstructions:
    string;

  memoryWeight:
    number;

  autonomyLevel:
    string;

  successScore:
    number;

  status:
    string;

  decisionRules:
    string[];

  escalationRules:
    string[];
};

type Memory = {
  id:
    string;

  memoryKey:
    string;

  memoryValue:
    string;

  confidenceScore:
    number;

  updatedAt:
    string;
};

type Horizon = {
  id:
    string;

  horizon:
    string;

  label:
    string;

  targetAt:
    string;

  direction:
    string;

  probability:
    number;

  expectedReturnPercent:
    number;

  confidence:
    number;

  status:
    string;

  primaryUncertainty:
    string;
};

type Forecast = {
  id:
    string;

  requestId:
    string;

  symbol:
    string;

  generatedAt:
    string;

  asOfAt:
    string;

  modelVersion:
    string;

  marketRegime:
    string;

  sliceSentimentScore:
    number;

  dataQualityScore:
    number;

  staleDataWarning:
    string | null;

  status:
    string;

  horizons:
    Horizon[];
};

type Approval = {
  id:
    string;

  title:
    string;

  actionType:
    string;

  riskLevel:
    string;

  summary:
    string;

  status:
    string;

  createdAt:
    string;

  approvalNotes:
    string | null;
};

type Brief = {
  id:
    string;

  title:
    string;

  summary:
    string;

  status:
    string;

  createdAt:
    string;

  topActions:
    string[];

  metrics:
    unknown;
};

type DriftAlert = {
  id:
    string;

  modelVersion:
    string;

  horizon:
    string;

  severity:
    string;

  reason:
    string;

  createdAt:
    string;
};

type Overview = {
  ok:
    boolean;

  generatedAt:
    string;

  ai: {
    enabled:
      boolean;

    model:
      string;

    fallbackAvailable:
      boolean;
  };

  profile:
    Profile;

  memories:
    Memory[];

  latestForecasts:
    Forecast[];

  openDriftAlerts:
    DriftAlert[];

  approvals:
    Approval[];

  briefs:
    Brief[];

  conversation:
    ConversationMessage[];

  safeguards: {
    autonomousTradingEnabled:
      boolean;

    emailSendingEnabled:
      boolean;

    portfolioChangesEnabled:
      boolean;

    moneyMovementEnabled:
      boolean;

    modelPromotionEnabled:
      boolean;

    reportsRequireApproval:
      boolean;

    consequentialActionsRequireApproval:
      boolean;
  };

  error?:
    string;
};

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

function statusClass(
  status: string,
) {
  const normalized =
    status.toLowerCase();

  if (
    normalized.includes(
      "approved",
    ) ||
    normalized.includes(
      "active",
    )
  ) {
    return "border-emerald-400/25 bg-emerald-500/10 text-emerald-100";
  }

  if (
    normalized.includes(
      "rejected",
    ) ||
    normalized.includes(
      "critical",
    ) ||
    normalized.includes(
      "failed",
    )
  ) {
    return "border-red-400/25 bg-red-500/10 text-red-100";
  }

  return "border-amber-400/25 bg-amber-500/10 text-amber-100";
}

export default function AdvisorBotPage() {
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
    useState("");

  const [
    statusMessage,
    setStatusMessage,
  ] =
    useState(
      "Loading Slice Advisor.",
    );

  const [
    styleInstructions,
    setStyleInstructions,
  ] =
    useState("");

  const [
    memoryWeight,
    setMemoryWeight,
  ] =
    useState(
      70,
    );

  const [
    autonomyLevel,
    setAutonomyLevel,
  ] =
    useState(
      "Advisor Approval Required",
    );

  const [
    decisionRulesText,
    setDecisionRulesText,
  ] =
    useState("");

  const [
    escalationRulesText,
    setEscalationRulesText,
  ] =
    useState("");

  const [
    memoryKey,
    setMemoryKey,
  ] =
    useState("");

  const [
    memoryValue,
    setMemoryValue,
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
              "/api/intelligence/advisor-bot",
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
              "Unable to load Slice Advisor.",
            );
          }

          setOverview(
            body,
          );

          setStyleInstructions(
            body.profile.styleInstructions,
          );

          setMemoryWeight(
            body.profile.memoryWeight,
          );

          setAutonomyLevel(
            body.profile.autonomyLevel,
          );

          setDecisionRulesText(
            body.profile
              .decisionRules
              .join(
                "\n",
              ),
          );

          setEscalationRulesText(
            body.profile
              .escalationRules
              .join(
                "\n",
              ),
          );

          setStatusMessage(
            body.ai.enabled
              ? `Slice Advisor is connected to ${body.ai.model}.`
              : "Slice Advisor is using its deterministic stored-data fallback.",
          );
        } catch (error) {
          setStatusMessage(
            error instanceof Error
              ? error.message
              : "Unable to load Slice Advisor.",
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

  const pendingApprovals =
    useMemo(
      () =>
        (
          overview
            ?.approvals ??
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

  const latestForecast =
    overview
      ?.latestForecasts[0] ??
    null;

  async function postAction(
    body:
      Record<string, unknown>,
  ) {
    const response =
      await fetch(
        "/api/intelligence/advisor-bot",
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

        result?: {
          answer?:
            string;

          mode?:
            string;
        };

        brief?:
          Brief;
      };

    if (!response.ok) {
      throw new Error(
        result.detail ??
        result.error ??
        "Slice Advisor operation failed.",
      );
    }

    return result;
  }

  async function sendMessage() {
    const content =
      message.trim();

    if (!content) {
      return;
    }

    setActiveAction(
      "chat",
    );

    setMessage("");

    setStatusMessage(
      "Slice Advisor is reviewing stored forecasts, outcomes, models, and approval rules.",
    );

    try {
      const result =
        await postAction({
          action:
            "chat",

          message:
            content,
        });

      setStatusMessage(
        `Response completed using ${result.result?.mode ?? "Slice intelligence"}.`,
      );

      await loadOverview();
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to complete the response.",
      );
    } finally {
      setActiveAction(
        null,
      );
    }
  }

  async function saveProfile() {
    setActiveAction(
      "profile",
    );

    try {
      await postAction({
        action:
          "save-profile",

        styleInstructions,

        memoryWeight,

        autonomyLevel,

        decisionRules:
          decisionRulesText
            .split(
              "\n",
            )
            .map(
              (item) =>
                item.trim(),
            )
            .filter(
              Boolean,
            ),

        escalationRules:
          escalationRulesText
            .split(
              "\n",
            )
            .map(
              (item) =>
                item.trim(),
            )
            .filter(
              Boolean,
            ),
      });

      setStatusMessage(
        "Advisor profile saved.",
      );

      await loadOverview();
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to save the profile.",
      );
    } finally {
      setActiveAction(
        null,
      );
    }
  }

  async function saveMemory() {
    if (
      !memoryKey.trim() ||
      !memoryValue.trim()
    ) {
      setStatusMessage(
        "Enter both a memory key and memory value.",
      );

      return;
    }

    setActiveAction(
      "memory",
    );

    try {
      await postAction({
        action:
          "save-memory",

        memoryKey,

        memoryValue,

        confidenceScore:
          90,
      });

      setMemoryKey(
        "",
      );

      setMemoryValue(
        "",
      );

      setStatusMessage(
        "Advisor preference saved to memory.",
      );

      await loadOverview();
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to save advisor memory.",
      );
    } finally {
      setActiveAction(
        null,
      );
    }
  }

  async function generateBrief() {
    setActiveAction(
      "brief",
    );

    try {
      const result =
        await postAction({
          action:
            "generate-brief",

          force:
            true,
        });

      setStatusMessage(
        result.brief
          ? `${result.brief.title} was generated and requires approval.`
          : "Morning brief generated.",
      );

      await loadOverview();
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to generate the morning brief.",
      );
    } finally {
      setActiveAction(
        null,
      );
    }
  }

  async function decideApproval(
    approvalId:
      string,
    decision:
      "approve" | "reject",
  ) {
    const confirmed =
      window.confirm(
        decision ===
        "approve"
          ? "Approve this internal Slice Advisor action?"
          : "Reject this Slice Advisor action?",
      );

    if (!confirmed) {
      return;
    }

    setActiveAction(
      approvalId,
    );

    try {
      await postAction({
        action:
          "decide-approval",

        approvalId,

        decision,

        notes:
          decision ===
          "approve"
            ? "Approved from the Slice Advisor workspace."
            : "Rejected from the Slice Advisor workspace.",
      });

      setStatusMessage(
        decision ===
        "approve"
          ? "Advisor action approved and internally executed."
          : "Advisor action rejected.",
      );

      await loadOverview();
    } catch (error) {
      setStatusMessage(
        error instanceof Error
          ? error.message
          : "Unable to decide the approval item.",
      );
    } finally {
      setActiveAction(
        null,
      );
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-[1800px] px-4 py-8 sm:px-6 lg:px-8">
      <section className="rounded-[2rem] border border-red-500/15 bg-gradient-to-br from-red-950/30 via-black to-black p-6 shadow-2xl shadow-red-950/20 sm:p-8">
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-red-300">
          Slice Personalized Intelligence
        </p>

        <h1 className="mt-3 text-3xl font-black tracking-tight text-white sm:text-5xl">
          Slice Advisor
        </h1>

        <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
          Ask questions across stored forecasts, outcomes, simulations,
          model governance, evidence quality, and drift. Slice Advisor
          can draft internal actions, but consequential steps require
          explicit advisor approval.
        </p>

        <div className="mt-5 rounded-xl border border-amber-400/20 bg-amber-500/[0.06] p-4 text-sm text-amber-100">
          {statusMessage}
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
              void generateBrief()
            }
            className="rounded-xl border border-emerald-400/25 bg-emerald-500/10 px-5 py-3 text-sm font-black text-emerald-100 disabled:opacity-40"
          >
            {activeAction ===
            "brief"
              ? "Generating…"
              : "Generate Morning Brief"}
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
            "AI Mode",
            overview?.ai.enabled
              ? overview.ai.model
              : "Fallback",
          ],
          [
            "Stored Forecasts",
            overview
              ?.latestForecasts
              .length ??
            0,
          ],
          [
            "Open Drift Alerts",
            overview
              ?.openDriftAlerts
              .length ??
            0,
          ],
          [
            "Pending Approvals",
            pendingApprovals.length,
          ],
          [
            "Memories",
            overview
              ?.memories
              .length ??
            0,
          ],
          [
            "Reports",
            overview
              ?.briefs
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

      <section className="mt-6 grid gap-6 xl:grid-cols-[minmax(0,1fr)_420px]">
        <div className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-5 sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <h2 className="text-xl font-black text-white">
                Advisor Conversation
              </h2>

              <p className="mt-1 text-xs text-slate-500">
                Answers are grounded in stored Slice records.
              </p>
            </div>

            <span className="rounded-full border border-amber-400/20 bg-amber-500/[0.06] px-3 py-1 text-[10px] font-black uppercase text-amber-100">
              Approval Required
            </span>
          </div>

          <div className="mt-5 max-h-[720px] space-y-4 overflow-y-auto pr-1">
            {(overview?.conversation ?? []).map(
              (item) => (
                <div
                  key={
                    item.id
                  }
                  className={`rounded-2xl border p-4 ${
                    item.role ===
                    "user"
                      ? "ml-8 border-white/10 bg-white/[0.05]"
                      : "mr-8 border-red-400/20 bg-red-500/[0.06]"
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
                      {item.role ===
                      "user"
                        ? "Advisor"
                        : "Slice Advisor"}
                    </div>

                    <div className="text-[10px] text-slate-600">
                      {dateTime(
                        item.createdAt,
                      )}
                    </div>
                  </div>

                  <div className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-200">
                    {item.content}
                  </div>

                  {item.confidence !==
                  null ? (
                    <div className="mt-3 text-[10px] font-black uppercase text-red-300">
                      Confidence{" "}
                      {number(
                        item.confidence,
                      )}
                    </div>
                  ) : null}

                  {item.sourceReferences.length ? (
                    <div className="mt-4 space-y-1 border-t border-white/8 pt-3 text-[10px] text-slate-600">
                      {item.sourceReferences.map(
                        (
                          source,
                        ) => (
                          <div
                            key={`${source.sourceType}-${source.sourceId}`}
                          >
                            {source.label}
                          </div>
                        ),
                      )}
                    </div>
                  ) : null}
                </div>
              ),
            )}

            {!loading &&
            !overview?.conversation.length ? (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                Ask Slice Advisor about a ticker, horizon, simulation,
                risk, model disagreement, or pending decision.
              </div>
            ) : null}
          </div>

          <div className="mt-5 border-t border-white/8 pt-5">
            <textarea
              value={
                message
              }
              onChange={(
                event,
              ) =>
                setMessage(
                  event.target
                    .value,
                )
              }
              onKeyDown={(
                event,
              ) => {
                if (
                  event.key ===
                    "Enter" &&
                  !event.shiftKey
                ) {
                  event.preventDefault();

                  void sendMessage();
                }
              }}
              rows={
                4
              }
              placeholder="Ask: Where is the highest disagreement in the latest MSFT forecast?"
              className="w-full resize-none rounded-2xl border border-white/10 bg-black/60 px-4 py-4 text-sm leading-6 text-white outline-none placeholder:text-slate-600 focus:border-red-400/40"
            />

            <div className="mt-3 flex justify-end">
              <button
                type="button"
                disabled={
                  activeAction ===
                    "chat" ||
                  !message.trim()
                }
                onClick={() =>
                  void sendMessage()
                }
                className="rounded-xl border border-red-400/25 bg-red-500/15 px-6 py-3 text-sm font-black text-red-100 disabled:opacity-40"
              >
                {activeAction ===
                "chat"
                  ? "Reviewing…"
                  : "Ask Slice Advisor"}
              </button>
            </div>
          </div>
        </div>

        <aside className="space-y-6">
          <section className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-5">
            <h2 className="text-lg font-black text-white">
              Latest Forecast
            </h2>

            {latestForecast ? (
              <>
                <div className="mt-4 flex items-center justify-between">
                  <div className="text-3xl font-black text-white">
                    {latestForecast.symbol}
                  </div>

                  <div className="text-right">
                    <div className="text-[10px] uppercase text-slate-600">
                      Slice Score
                    </div>

                    <div className="text-xl font-black text-red-200">
                      {number(
                        latestForecast.sliceSentimentScore,
                      )}
                    </div>
                  </div>
                </div>

                <div className="mt-3 text-xs text-slate-500">
                  {dateTime(
                    latestForecast.generatedAt,
                  )} ·{" "}
                  {latestForecast.modelVersion}
                </div>

                <div className="mt-4 space-y-2">
                  {latestForecast.horizons
                    .filter(
                      (horizon) =>
                        [
                          "1d",
                          "2-5d",
                          "1-4w",
                          "1-3m",
                        ].includes(
                          horizon.horizon,
                        ),
                    )
                    .map(
                      (horizon) => (
                        <div
                          key={
                            horizon.id
                          }
                          className="rounded-xl border border-white/8 bg-black/30 p-3"
                        >
                          <div className="flex justify-between gap-3 text-xs">
                            <span className="font-black text-white">
                              {horizon.label}
                            </span>

                            <span className="text-red-200">
                              {number(
                                horizon.probability,
                              )}
                              %
                            </span>
                          </div>

                          <div className="mt-2 text-[10px] text-slate-600">
                            {horizon.direction} ·{" "}
                            {number(
                              horizon.expectedReturnPercent,
                            )}
                            % expected · confidence{" "}
                            {number(
                              horizon.confidence,
                            )}
                          </div>
                        </div>
                      ),
                    )}
                </div>
              </>
            ) : (
              <div className="mt-4 text-sm text-slate-500">
                No stored forecast is available.
              </div>
            )}
          </section>

          <section className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-5">
            <h2 className="text-lg font-black text-white">
              Advisor Memory
            </h2>

            <div className="mt-4 grid gap-3">
              <input
                value={
                  memoryKey
                }
                onChange={(
                  event,
                ) =>
                  setMemoryKey(
                    event.target
                      .value,
                  )
                }
                placeholder="Preference key"
                className="rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white placeholder:text-slate-600"
              />

              <textarea
                value={
                  memoryValue
                }
                onChange={(
                  event,
                ) =>
                  setMemoryValue(
                    event.target
                      .value,
                  )
                }
                rows={
                  3
                }
                placeholder="Example: Prioritize downside risk and lead with the 1–4 week horizon."
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
                  void saveMemory()
                }
                className="rounded-xl border border-blue-400/25 bg-blue-500/10 px-4 py-3 text-xs font-black text-blue-100 disabled:opacity-40"
              >
                Save Preference
              </button>
            </div>

            <div className="mt-5 max-h-56 space-y-2 overflow-y-auto">
              {(overview?.memories ?? []).map(
                (memory) => (
                  <div
                    key={
                      memory.id
                    }
                    className="rounded-xl border border-white/8 bg-black/30 p-3"
                  >
                    <div className="text-xs font-black text-white">
                      {memory.memoryKey}
                    </div>

                    <div className="mt-1 text-xs leading-5 text-slate-500">
                      {memory.memoryValue}
                    </div>
                  </div>
                ),
              )}
            </div>
          </section>
        </aside>
      </section>

      <section className="mt-6 grid gap-6 xl:grid-cols-2">
        <div className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-xl font-black text-white">
              Pending Approvals
            </h2>

            <span className="rounded-full border border-amber-400/20 bg-amber-500/[0.06] px-3 py-1 text-xs font-black text-amber-100">
              {pendingApprovals.length}
            </span>
          </div>

          <div className="mt-5 space-y-3">
            {pendingApprovals.map(
              (approval) => (
                <div
                  key={
                    approval.id
                  }
                  className="rounded-2xl border border-amber-400/20 bg-amber-500/[0.04] p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="font-black text-white">
                        {approval.title}
                      </div>

                      <div className="mt-1 text-[10px] uppercase tracking-[0.12em] text-amber-200">
                        {approval.actionType} ·{" "}
                        {approval.riskLevel} risk
                      </div>
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusClass(
                        approval.status,
                      )}`}
                    >
                      {approval.status}
                    </span>
                  </div>

                  <div className="mt-3 text-sm leading-6 text-slate-400">
                    {approval.summary}
                  </div>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={
                        Boolean(
                          activeAction,
                        )
                      }
                      onClick={() =>
                        void decideApproval(
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
                        void decideApproval(
                          approval.id,
                          "reject",
                        )
                      }
                      className="rounded-xl border border-red-400/25 bg-red-500/10 px-4 py-2 text-xs font-black text-red-100 disabled:opacity-40"
                    >
                      Reject
                    </button>
                  </div>
                </div>
              ),
            )}

            {!pendingApprovals.length ? (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                No advisor action is waiting for approval.
              </div>
            ) : null}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
          <h2 className="text-xl font-black text-white">
            Morning Briefs
          </h2>

          <div className="mt-5 space-y-3">
            {(overview?.briefs ?? []).map(
              (brief) => (
                <article
                  key={
                    brief.id
                  }
                  className="rounded-2xl border border-white/8 bg-black/30 p-5"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="font-black text-white">
                      {brief.title}
                    </div>

                    <span
                      className={`rounded-full border px-3 py-1 text-[10px] font-black ${statusClass(
                        brief.status,
                      )}`}
                    >
                      {brief.status}
                    </span>
                  </div>

                  <div className="mt-3 text-sm leading-6 text-slate-400">
                    {brief.summary}
                  </div>

                  {brief.topActions.length ? (
                    <div className="mt-4 space-y-2">
                      {brief.topActions.map(
                        (action) => (
                          <div
                            key={
                              action
                            }
                            className="rounded-lg border border-white/8 bg-white/[0.03] p-3 text-xs text-slate-300"
                          >
                            {action}
                          </div>
                        ),
                      )}
                    </div>
                  ) : null}

                  <div className="mt-3 text-[10px] text-slate-600">
                    {dateTime(
                      brief.createdAt,
                    )}
                  </div>
                </article>
              ),
            )}

            {!overview?.briefs.length ? (
              <div className="rounded-xl border border-dashed border-white/10 p-8 text-center text-sm text-slate-500">
                No morning brief has been generated.
              </div>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mt-6 rounded-[2rem] border border-white/8 bg-white/[0.025] p-6">
        <h2 className="text-xl font-black text-white">
          Bot Profile and Guardrails
        </h2>

        <div className="mt-5 grid gap-5 xl:grid-cols-2">
          <label className="grid gap-2">
            <span className="text-xs font-black text-slate-300">
              Communication style
            </span>

            <textarea
              value={
                styleInstructions
              }
              onChange={(
                event,
              ) =>
                setStyleInstructions(
                  event.target
                    .value,
                )
              }
              rows={
                6
              }
              className="resize-none rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm leading-6 text-white"
            />
          </label>

          <div className="grid gap-4">
            <label className="grid gap-2">
              <span className="text-xs font-black text-slate-300">
                Autonomy level
              </span>

              <select
                value={
                  autonomyLevel
                }
                onChange={(
                  event,
                ) =>
                  setAutonomyLevel(
                    event.target
                      .value,
                  )
                }
                className="rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm text-white"
              >
                <option value="Read-Only Research">
                  Read-Only Research
                </option>

                <option value="Draft Actions Only">
                  Draft Actions Only
                </option>

                <option value="Advisor Approval Required">
                  Advisor Approval Required
                </option>
              </select>
            </label>

            <label className="grid gap-2">
              <span className="text-xs font-black text-slate-300">
                Memory weight: {memoryWeight}
              </span>

              <input
                type="range"
                min={
                  0
                }
                max={
                  100
                }
                value={
                  memoryWeight
                }
                onChange={(
                  event,
                ) =>
                  setMemoryWeight(
                    Number(
                      event.target
                        .value,
                    ),
                  )
                }
              />
            </label>
          </div>

          <label className="grid gap-2">
            <span className="text-xs font-black text-slate-300">
              Decision rules — one per line
            </span>

            <textarea
              value={
                decisionRulesText
              }
              onChange={(
                event,
              ) =>
                setDecisionRulesText(
                  event.target
                    .value,
                )
              }
              rows={
                8
              }
              className="resize-none rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm leading-6 text-white"
            />
          </label>

          <label className="grid gap-2">
            <span className="text-xs font-black text-slate-300">
              Escalation rules — one per line
            </span>

            <textarea
              value={
                escalationRulesText
              }
              onChange={(
                event,
              ) =>
                setEscalationRulesText(
                  event.target
                    .value,
                )
              }
              rows={
                8
              }
              className="resize-none rounded-xl border border-white/10 bg-black/60 px-4 py-3 text-sm leading-6 text-white"
            />
          </label>
        </div>

        <button
          type="button"
          disabled={
            Boolean(
              activeAction,
            )
          }
          onClick={() =>
            void saveProfile()
          }
          className="mt-5 rounded-xl border border-red-400/25 bg-red-500/10 px-5 py-3 text-sm font-black text-red-100 disabled:opacity-40"
        >
          Save Bot Profile
        </button>
      </section>
    </main>
  );
}