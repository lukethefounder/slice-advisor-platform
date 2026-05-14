"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ActionButton,
  Card,
  LinkButton,
  Metric,
  Pill,
  Progress,
  SectionHeader,
  SliceBackground,
  SoftCard,
  TopNav,
  shortDate,
  toneFor,
} from "@/components/slice-ui";

type PhaseItem = {
  phase: string;
  title: string;
  status: string;
  summary: string;
};

type AutopilotAction = {
  id: string;
  eventTitle: string;
  sourceName: string;
  sourceCredibilityScore: number;
  impactScore: number;
  urgency: string;
  recommendedAction: string;
  status: string;
};

type CommunicationDraft = {
  id: string;
  clientName: string | null;
  channel: string;
  title: string;
  body: string;
  status: string;
  tone: string;
};

type AdaptiveMemory = {
  id: string;
  subjectType: string;
  subjectName: string;
  memoryKey: string;
  memoryValue: string;
  confidenceScore: number;
  evidence: string[];
};

type ClientPreferenceProfile = {
  id: string;
  clientName: string;
  communicationStyle: string;
  detailLevel: string;
  preferredChannel: string;
  meetingCadence: string;
  volatilitySensitivity: number;
  doList: string[];
  dontList: string[];
  confidenceScore: number;
  status: string;
};

type BotLearningProfile = {
  id: string;
  botName: string;
  styleInstructions: string;
  decisionRules: string[];
  escalationRules: string[];
  memoryWeight: number;
  autonomyLevel: string;
  successScore: number;
  status: string;
};

type AdaptiveRecommendation = {
  id: string;
  title: string;
  category: string;
  recommendation: string;
  reasons: string[];
  confidenceScore: number;
  status: string;
};

type FirmLearningSnapshot = {
  id: string;
  title: string;
  summary: string;
  score: number;
  recommendations: string[];
  createdAt: string;
};

type SourceReliabilitySignal = {
  id: string;
  sourceName: string;
  domain: string;
  signalType: string;
  outcome: string;
  reliabilityDelta: number;
  notes: string | null;
  createdAt: string;
};

type AdvisorFeedbackSignal = {
  id: string;
  targetType: string;
  rating: number;
  feedback: string;
  actionTaken: string;
  processedAt: string | null;
  createdAt: string;
};

type AdvisorOsPayload = {
  readinessScore?: number;
  phaseRoadmap?: PhaseItem[];
  counts?: {
    queuedAutopilotActionCount?: number;
    communicationDraftCount?: number;
    approvedCommunicationDraftCount?: number;
    workflowRuleCount?: number;
    automationRunCount?: number;
    adaptiveMemoryCount?: number;
    clientPreferenceProfileCount?: number;
    botLearningProfileCount?: number;
    sourceReliabilitySignalCount?: number;
    advisorFeedbackSignalCount?: number;
    unprocessedFeedbackCount?: number;
    adaptiveRecommendationCount?: number;
    firmLearningSnapshotCount?: number;
    averageCredibility?: number;
    averageBotSuccess?: number;
    averageMemoryConfidence?: number;
  };
  adaptiveMemories?: AdaptiveMemory[];
  clientPreferenceProfiles?: ClientPreferenceProfile[];
  botLearningProfiles?: BotLearningProfile[];
  sourceReliabilitySignals?: SourceReliabilitySignal[];
  advisorFeedbackSignals?: AdvisorFeedbackSignal[];
  adaptiveRecommendations?: AdaptiveRecommendation[];
  firmLearningSnapshots?: FirmLearningSnapshot[];
  autopilotActions?: AutopilotAction[];
  communicationDrafts?: CommunicationDraft[];
};

export default function AdvisorOsPage() {
  const [data, setData] = useState<AdvisorOsPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [runningAction, setRunningAction] = useState("");

  async function loadAdvisorOs() {
    setMessage("");

    try {
      const response = await fetch("/api/advisor-os", {
        cache: "no-store",
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Unable to load Advisor OS.");
        return;
      }

      setData(payload);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Unable to load Advisor OS: ${error.message}`
          : "Unable to load Advisor OS."
      );
    } finally {
      setLoading(false);
    }
  }

  async function postAction(action: string, extra: Record<string, unknown> = {}) {
    setRunningAction(action);
    setMessage("");

    try {
      const response = await fetch("/api/advisor-os", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action,
          ...extra,
        }),
      });

      const payload = await response.json();

      if (!response.ok) {
        setMessage(payload.error ?? "Advisor OS action failed.");
        return;
      }

      setData(payload);
      setMessage("Advisor OS updated.");
    } catch (error) {
      setMessage(
        error instanceof Error
          ? `Advisor OS action failed: ${error.message}`
          : "Advisor OS action failed."
      );
    } finally {
      setRunningAction("");
    }
  }

  useEffect(() => {
    loadAdvisorOs();
  }, []);

  const counts = data?.counts ?? {};
  const readinessScore = data?.readinessScore ?? 0;

  const commandMetrics = useMemo(
    () => [
      {
        label: "Readiness",
        value: `${readinessScore}%`,
        helper: "Advisor OS score",
        tone: "red" as const,
      },
      {
        label: "Learning",
        value: counts.firmLearningSnapshotCount ?? 0,
        helper: "Adaptive snapshots",
        tone: "purple" as const,
      },
      {
        label: "Bot Success",
        value: `${counts.averageBotSuccess ?? 0}%`,
        helper: "Learning profile avg",
        tone: "green" as const,
      },
      {
        label: "Memory Confidence",
        value: `${counts.averageMemoryConfidence ?? 0}%`,
        helper: "Adaptive memory avg",
        tone: "amber" as const,
      },
      {
        label: "Queued Actions",
        value: counts.queuedAutopilotActionCount ?? 0,
        helper: "Needs routing",
        tone: "red" as const,
      },
      {
        label: "Drafts",
        value: counts.communicationDraftCount ?? 0,
        helper: "Client factory",
        tone: "green" as const,
      },
      {
        label: "Feedback",
        value: counts.advisorFeedbackSignalCount ?? 0,
        helper: `${counts.unprocessedFeedbackCount ?? 0} unprocessed`,
        tone: "amber" as const,
      },
      {
        label: "Recommendations",
        value: counts.adaptiveRecommendationCount ?? 0,
        helper: "AI improvements",
        tone: "purple" as const,
      },
    ],
    [counts, readinessScore]
  );

  if (loading) {
    return (
      <SliceBackground>
        <div className="mx-auto grid min-h-screen max-w-4xl place-items-center px-5">
          <Card className="p-8 text-center">
            <Pill tone="red">Slice Advisor OS</Pill>
            <h1 className="mt-4 text-3xl font-black">
              Loading command center...
            </h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              Preparing adaptive intelligence, source memory, client style,
              workflow routing, and approval-gated communication.
            </p>
          </Card>
        </div>
      </SliceBackground>
    );
  }

  if (!data) {
    return (
      <SliceBackground>
        <div className="mx-auto grid min-h-screen max-w-4xl place-items-center px-5">
          <Card className="p-8 text-center">
            <Pill tone="red">Advisor OS unavailable</Pill>
            <h1 className="mt-4 text-3xl font-black">Unable to open Advisor OS</h1>
            <p className="mt-3 text-sm leading-6 text-slate-400">
              {message || "Please log in again."}
            </p>
            <div className="mt-6 flex justify-center">
              <LinkButton href="/portal" variant="primary">
                Open Portal
              </LinkButton>
            </div>
          </Card>
        </div>
      </SliceBackground>
    );
  }

  return (
    <SliceBackground>
      <div className="mx-auto grid max-w-[1500px] gap-6 px-5 py-5">
        <TopNav subtitle="Advisor OS" />

        {message ? (
          <div className="rounded-2xl border border-red-400/20 bg-red-500/10 px-4 py-3 text-sm font-semibold text-red-100">
            {message}
          </div>
        ) : null}

        <Card className="p-5 md:p-8">
          <div className="absolute inset-x-0 top-0 h-52 bg-gradient-to-b from-red-500/15 to-transparent" />
          <div className="relative grid gap-8 xl:grid-cols-[1.12fr_0.88fr] xl:items-center">
            <div>
              <Pill tone="green">Adaptive Advisor OS</Pill>
              <h1 className="mt-5 max-w-6xl text-4xl font-black leading-[0.95] tracking-tight md:text-6xl xl:text-7xl">
                The page an advisor keeps open all day.
              </h1>
              <p className="mt-6 max-w-3xl text-base leading-8 text-slate-300">
                Slice Advisor OS connects source credibility, portfolio impact,
                workflow automation, personal AI bots, client communication,
                meeting prep, compliance memory, and adaptive firm learning.
              </p>

              <div className="mt-7 flex flex-wrap gap-3">
                <ActionButton
                  onClick={() => postAction("runPhase3AdaptiveLearning")}
                  disabled={runningAction === "runPhase3AdaptiveLearning"}
                  variant="primary"
                >
                  Run Adaptive Learning
                </ActionButton>
                <ActionButton
                  onClick={() => postAction("runPhase2WorkflowAutomation")}
                  disabled={runningAction === "runPhase2WorkflowAutomation"}
                  variant="danger"
                >
                  Route Workflow
                </ActionButton>
                <ActionButton
                  onClick={() => postAction("addPositiveFeedback")}
                  disabled={runningAction === "addPositiveFeedback"}
                  variant="secondary"
                >
                  Add Positive Feedback
                </ActionButton>
                <ActionButton
                  onClick={() => postAction("addCorrectionFeedback")}
                  disabled={runningAction === "addCorrectionFeedback"}
                  variant="secondary"
                >
                  Add Correction
                </ActionButton>
              </div>
            </div>

            <div className="grid gap-4">
              <SoftCard>
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
                      Adaptive readiness
                    </div>
                    <div className="mt-2 text-6xl font-black">
                      {readinessScore}%
                    </div>
                  </div>
                  <Pill tone={readinessScore >= 85 ? "green" : "amber"}>
                    {readinessScore >= 85 ? "Learning" : "Building"}
                  </Pill>
                </div>
                <div className="mt-5">
                  <Progress value={readinessScore} tone="red" />
                </div>
              </SoftCard>

              <div className="grid gap-3 sm:grid-cols-2">
                <Metric
                  label="Source Trust"
                  value={`${counts.averageCredibility ?? 0}%`}
                  helper="Credibility average"
                  tone="green"
                />
                <Metric
                  label="Approvals"
                  value={counts.approvedCommunicationDraftCount ?? 0}
                  helper="Approved/simulated drafts"
                  tone="amber"
                />
              </div>
            </div>
          </div>
        </Card>

        <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          {commandMetrics.map((metric) => (
            <Metric
              key={metric.label}
              label={metric.label}
              value={metric.value}
              helper={metric.helper}
              tone={metric.tone}
            />
          ))}
        </section>

        <section className="grid gap-4 md:grid-cols-3">
          {(data.phaseRoadmap ?? []).map((phase) => (
            <Card key={phase.phase} className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.2em] text-red-400">
                    {phase.phase}
                  </div>
                  <h3 className="mt-2 text-xl font-black">{phase.title}</h3>
                </div>
                <Pill tone={toneFor(phase.status)}>{phase.status}</Pill>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-400">
                {phase.summary}
              </p>
            </Card>
          ))}
        </section>

        <section className="grid gap-5 xl:grid-cols-[1.05fr_0.95fr]">
          <Card className="p-5 md:p-6">
            <SectionHeader
              eyebrow="Learning cockpit"
              title="Firm learning snapshots"
              description="Every adaptive cycle becomes firm memory, showing what the system learned and what should happen next."
              action={
                <ActionButton
                  onClick={() => postAction("runPhase3AdaptiveLearning")}
                  disabled={runningAction === "runPhase3AdaptiveLearning"}
                >
                  Run Cycle
                </ActionButton>
              }
            />

            <div className="mt-6 grid gap-4">
              {(data.firmLearningSnapshots ?? []).slice(0, 6).map((snapshot) => (
                <SoftCard key={snapshot.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="text-lg font-black">{snapshot.title}</h3>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {shortDate(snapshot.createdAt)}
                      </div>
                    </div>
                    <Pill tone={snapshot.score >= 80 ? "green" : "amber"}>
                      {snapshot.score}% learning score
                    </Pill>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {snapshot.summary}
                  </p>

                  <div className="mt-4">
                    <Progress value={snapshot.score} tone="green" />
                  </div>

                  <div className="mt-4 grid gap-2">
                    {(snapshot.recommendations ?? []).slice(0, 4).map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-white/10 bg-black/24 px-3 py-2 text-sm text-slate-400"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </SoftCard>
              ))}
            </div>
          </Card>

          <Card className="p-5 md:p-6">
            <SectionHeader
              eyebrow="AI recommendations"
              title="Approve or dismiss adaptive suggestions"
              description="Every approval or dismissal becomes feedback that improves the next learning cycle."
            />

            <div className="mt-6 grid gap-4">
              {(data.adaptiveRecommendations ?? []).slice(0, 8).map((item) => (
                <SoftCard key={item.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black">{item.title}</h3>
                        <Pill tone={toneFor(item.status)}>{item.status}</Pill>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {item.category}
                      </div>
                    </div>
                    <Pill tone="purple">{item.confidenceScore}%</Pill>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {item.recommendation}
                  </p>

                  <div className="mt-4 flex flex-wrap gap-2">
                    <ActionButton
                      variant="secondary"
                      onClick={() =>
                        postAction("approveRecommendation", {
                          recommendationId: item.id,
                        })
                      }
                      disabled={
                        runningAction === "approveRecommendation" ||
                        item.status === "Approved"
                      }
                    >
                      Approve
                    </ActionButton>
                    <ActionButton
                      variant="secondary"
                      onClick={() =>
                        postAction("dismissRecommendation", {
                          recommendationId: item.id,
                        })
                      }
                      disabled={
                        runningAction === "dismissRecommendation" ||
                        item.status === "Dismissed"
                      }
                    >
                      Dismiss
                    </ActionButton>
                  </div>
                </SoftCard>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Card className="p-5 md:p-6">
            <SectionHeader
              eyebrow="Personal AI bots"
              title="Bot behavior tuning"
              description="Bot profiles track style instructions, decision rules, escalation rules, memory weight, autonomy, and success score."
              action={
                <ActionButton
                  onClick={() => postAction("applyBotTuning")}
                  disabled={runningAction === "applyBotTuning"}
                >
                  Tune Bots
                </ActionButton>
              }
            />

            <div className="mt-6 grid gap-4">
              {(data.botLearningProfiles ?? []).map((bot) => (
                <SoftCard key={bot.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black">{bot.botName}</h3>
                        <Pill tone={toneFor(bot.status)}>{bot.status}</Pill>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {bot.autonomyLevel}
                      </div>
                    </div>
                    <Pill tone="green">{bot.successScore}% success</Pill>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {bot.styleInstructions}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <div>
                      <div className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Memory weight {bot.memoryWeight}%
                      </div>
                      <Progress value={bot.memoryWeight} tone="purple" />
                    </div>
                    <div>
                      <div className="mb-1 text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Success {bot.successScore}%
                      </div>
                      <Progress value={bot.successScore} tone="green" />
                    </div>
                  </div>

                  <div className="mt-4 grid gap-2">
                    {(bot.decisionRules ?? []).slice(0, 3).map((rule) => (
                      <div
                        key={rule}
                        className="rounded-2xl border border-white/10 bg-black/24 px-3 py-2 text-sm text-slate-400"
                      >
                        {rule}
                      </div>
                    ))}
                  </div>
                </SoftCard>
              ))}
            </div>
          </Card>

          <Card className="p-5 md:p-6">
            <SectionHeader
              eyebrow="Client preference memory"
              title="Communication adapts by client"
              description="Client profiles preserve preferred channel, detail level, communication style, meeting cadence, volatility sensitivity, and do/don’t guidance."
            />

            <div className="mt-6 grid gap-4">
              {(data.clientPreferenceProfiles ?? []).map((profile) => (
                <SoftCard key={profile.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="text-lg font-black">
                          {profile.clientName}
                        </h3>
                        <Pill tone={toneFor(profile.status)}>
                          {profile.status}
                        </Pill>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {profile.preferredChannel} · {profile.detailLevel} ·{" "}
                        {profile.meetingCadence}
                      </div>
                    </div>
                    <Pill tone="amber">
                      Volatility {profile.volatilitySensitivity}%
                    </Pill>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {profile.communicationStyle}
                  </p>

                  <div className="mt-4">
                    <Progress value={profile.confidenceScore} tone="green" />
                  </div>

                  <div className="mt-4 grid gap-3 md:grid-cols-2">
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Do
                      </div>
                      <ul className="mt-2 grid gap-2 text-sm text-slate-400">
                        {(profile.doList ?? []).slice(0, 4).map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                    <div>
                      <div className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                        Do not
                      </div>
                      <ul className="mt-2 grid gap-2 text-sm text-slate-400">
                        {(profile.dontList ?? []).slice(0, 4).map((item) => (
                          <li key={item}>• {item}</li>
                        ))}
                      </ul>
                    </div>
                  </div>
                </SoftCard>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-[0.95fr_1.05fr]">
          <Card className="p-5 md:p-6">
            <SectionHeader
              eyebrow="Adaptive memory"
              title="Reusable knowledge"
              description="Memory records preserve how the advisor, client, bot, or source should be handled next time."
            />

            <div className="mt-6 grid gap-4">
              {(data.adaptiveMemories ?? []).slice(0, 8).map((memory) => (
                <SoftCard key={memory.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <h3 className="font-black">{memory.subjectName}</h3>
                        <Pill tone="purple">{memory.subjectType}</Pill>
                      </div>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {memory.memoryKey}
                      </div>
                    </div>
                    <Pill tone="green">{memory.confidenceScore}%</Pill>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {memory.memoryValue}
                  </p>

                  <div className="mt-4 grid gap-2">
                    {(memory.evidence ?? []).slice(0, 3).map((item) => (
                      <div
                        key={item}
                        className="rounded-2xl border border-white/10 bg-black/24 px-3 py-2 text-sm text-slate-400"
                      >
                        {item}
                      </div>
                    ))}
                  </div>
                </SoftCard>
              ))}
            </div>
          </Card>

          <Card className="p-5 md:p-6">
            <SectionHeader
              eyebrow="Source reliability + feedback"
              title="The system learns what to trust"
              description="Advisor outcomes and source reliability signals update how future events are weighted."
              action={
                <ActionButton
                  onClick={() => postAction("improveSourceReliability")}
                  disabled={runningAction === "improveSourceReliability"}
                >
                  Add Source Signal
                </ActionButton>
              }
            />

            <div className="mt-6 grid gap-4">
              {(data.sourceReliabilitySignals ?? []).slice(0, 5).map((signal) => (
                <SoftCard key={signal.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">{signal.sourceName}</h3>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {signal.domain} · {signal.signalType}
                      </div>
                    </div>
                    <Pill tone={signal.reliabilityDelta >= 0 ? "green" : "red"}>
                      {signal.reliabilityDelta >= 0 ? "+" : ""}
                      {signal.reliabilityDelta}
                    </Pill>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {signal.outcome}
                  </p>
                </SoftCard>
              ))}

              {(data.advisorFeedbackSignals ?? []).slice(0, 5).map((feedback) => (
                <SoftCard key={feedback.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">{feedback.targetType}</h3>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {shortDate(feedback.createdAt)} · {feedback.actionTaken}
                      </div>
                    </div>
                    <Pill tone={feedback.rating >= 0 ? "green" : "red"}>
                      {feedback.rating >= 0 ? "Positive" : "Correction"}
                    </Pill>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {feedback.feedback}
                  </p>
                </SoftCard>
              ))}
            </div>
          </Card>
        </section>

        <section className="grid gap-5 xl:grid-cols-2">
          <Card className="p-5 md:p-6">
            <SectionHeader
              eyebrow="Live action feed"
              title="Events waiting for action"
              description="These events can be routed into firm tasks, briefings, client drafts, meeting prep, vault records, and delivery queues."
            />

            <div className="mt-6 grid gap-4">
              {(data.autopilotActions ?? []).slice(0, 6).map((action) => (
                <SoftCard key={action.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">{action.eventTitle}</h3>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {action.sourceName}
                      </div>
                    </div>
                    <Pill tone={toneFor(action.status)}>{action.status}</Pill>
                  </div>

                  <p className="mt-3 text-sm leading-6 text-slate-400">
                    {action.recommendedAction}
                  </p>

                  <div className="mt-4 grid gap-3 sm:grid-cols-2">
                    <Metric
                      label="Source"
                      value={`${action.sourceCredibilityScore}%`}
                      tone="green"
                    />
                    <Metric
                      label="Impact"
                      value={`${action.impactScore}%`}
                      tone="red"
                    />
                  </div>
                </SoftCard>
              ))}
            </div>
          </Card>

          <Card className="p-5 md:p-6">
            <SectionHeader
              eyebrow="Client communication feed"
              title="Approval-gated drafts"
              description="Drafts stay controlled by the advisor. They can be approved, simulated, and retained in compliance memory."
            />

            <div className="mt-6 grid gap-4">
              {(data.communicationDrafts ?? []).slice(0, 6).map((draft) => (
                <SoftCard key={draft.id}>
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h3 className="font-black">{draft.title}</h3>
                      <div className="mt-1 text-xs font-semibold text-slate-500">
                        {draft.clientName ?? "No client"} · {draft.channel} ·{" "}
                        {draft.tone}
                      </div>
                    </div>
                    <Pill tone={toneFor(draft.status)}>{draft.status}</Pill>
                  </div>

                  <p className="mt-3 line-clamp-3 text-sm leading-6 text-slate-400">
                    {draft.body}
                  </p>
                </SoftCard>
              ))}
            </div>
          </Card>
        </section>
      </div>
    </SliceBackground>
  );
}