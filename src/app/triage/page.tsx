"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Decision = {
  id: string;
  rank: number;
  title: string;
  summary: string | null;
  sourceName: string;
  sourceTier: string;
  url: string | null;
  category: string;
  subcategory: string;
  importanceTier: string;
  action: string;
  urgency: string;
  score: number;
  rankingScore: number;
  fruitPotentialScore: number;
  materialityScore: number;
  relevanceScore: number;
  trustScore: number;
  matchedTickersJson: string;
  matchedAreasJson: string;
  reasonsJson: string;
  channelsJson: string;
  matchedTickers?: string[];
  matchedAreas?: string[];
  reasons?: string[];
  channels?: string[];
  scoreExplanation?: string[];
  deliveryRecommendation?: string;
  createdAt: string;
};

type Run = {
  id: string;
  mode: string;
  scannedCount: number;
  retainedCount: number;
  alertCount: number;
  digestCount: number;
  discardedCount: number;
  durationMs: number;
  createdAt: string;
};

type SourceCheckpoint = {
  id: string;
  sourceId: string;
  sourceName: string;
  lastFetchedAt: string | null;
  lastSeenHash: string | null;
  lastStatus: string;
  lastItemCount: number;
  updatedAt: string;
  createdAt: string;
};

type Policy = {
  minScoreToStore: number;
  minScoreToAlert: number;
  maxRetainedPerRun: number;
  maxRetainedDecisions: number;
  maxRetainedRuns: number;
  maxAlertEvents: number;
};

type FirmRecipient = {
  firmId: string | null;
  firmName: string;
  userId: string;
  name: string;
  email: string;
  role: string;
};

type RankingState = {
  sortBy: string;
  visibleFloor: number;
  totalDecisionCount: number;
  hiddenBelowFloorCount: number;
  scoreBands: {
    ninetyPlus: number;
    eightyPlus: number;
    seventyPlus: number;
    sixtyPlus: number;
  };
  categoryCounts: Record<string, number>;
  tierCounts: Record<string, number>;
  topCandidate: Decision | null;
};

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseJsonList(value: string | null | undefined) {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function scoreTone(score: number): "red" | "green" | "amber" | "slate" | "purple" {
  if (score >= 90) return "red";
  if (score >= 80) return "amber";
  if (score >= 70) return "purple";
  if (score >= 60) return "green";
  return "slate";
}

function urgencyTone(urgency: string): "red" | "green" | "amber" | "slate" {
  if (urgency === "Critical") return "red";
  if (urgency === "High") return "amber";
  if (urgency === "Medium") return "green";
  return "slate";
}

function sourceStatusTone(status: string): "red" | "green" | "amber" | "slate" {
  if (status === "OK") return "green";
  if (status === "Skipped") return "amber";
  if (status === "Error") return "red";
  return "slate";
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-[1.75rem] border border-white/10 bg-zinc-950/72 shadow-xl shadow-red-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function SoftCard({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4",
        className
      )}
    >
      {children}
    </div>
  );
}

function Pill({
  children,
  tone = "red",
}: {
  children: ReactNode;
  tone?: "red" | "green" | "amber" | "slate" | "purple";
}) {
  const tones = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full px-3 py-1 text-[11px] font-black ring-1",
        tones[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
  );
}

function Logo() {
  return (
    <div className="flex items-center gap-3">
      <div className="relative flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-red-950 via-zinc-950 to-red-700 shadow-lg shadow-red-950/50 ring-1 ring-red-500/40">
        <div className="absolute inset-1 rounded-[1rem] border border-white/10" />
        <div className="relative flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-red-500 to-red-900 text-lg font-black text-white shadow-inner">
          S
        </div>
        <div className="absolute right-2 top-2 h-2 w-2 rotate-45 bg-red-400" />
        <div className="absolute bottom-2 left-2 h-2 w-2 rotate-45 bg-red-700" />
      </div>

      <div className="min-w-0">
        <div className="truncate text-2xl font-black tracking-tight text-white">
          Slice
        </div>
        <div className="truncate text-[10px] font-black uppercase tracking-[0.28em] text-red-400">
          Intelligence Triage
        </div>
      </div>
    </div>
  );
}

function MetricBubble({
  label,
  value,
  helper,
  tone = "slate",
}: {
  label: string;
  value: string | number;
  helper?: string;
  tone?: "red" | "green" | "amber" | "slate" | "purple";
}) {
  const glows = {
    red: "from-red-500/18 to-transparent",
    green: "from-emerald-500/18 to-transparent",
    amber: "from-amber-500/18 to-transparent",
    slate: "from-slate-400/10 to-transparent",
    purple: "from-purple-500/18 to-transparent",
  };

  return (
    <div className="relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div
        className={cx(
          "pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b",
          glows[tone]
        )}
      />
      <div className="relative">
        <div className="truncate text-[11px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-2xl font-black text-white">
          {value}
        </div>
        {helper ? (
          <div className="mt-1 truncate text-xs font-semibold text-slate-500">
            {helper}
          </div>
        ) : null}
      </div>
    </div>
  );
}

function ScoreBar({
  value,
  tone = "red",
}: {
  value: number;
  tone?: "red" | "green" | "amber" | "purple" | "slate";
}) {
  const fills = {
    red: "from-red-700 to-red-400",
    green: "from-emerald-700 to-emerald-300",
    amber: "from-amber-700 to-amber-300",
    purple: "from-purple-700 to-purple-300",
    slate: "from-slate-700 to-slate-300",
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-black/50">
      <div
        className={cx("h-full rounded-full bg-gradient-to-r", fills[tone])}
        style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
      />
    </div>
  );
}

function SectionTitle({
  eyebrow,
  title,
  description,
}: {
  eyebrow?: string;
  title: string;
  description?: string;
}) {
  return (
    <div>
      {eyebrow ? (
        <div className="text-xs font-black uppercase tracking-[0.24em] text-red-400">
          {eyebrow}
        </div>
      ) : null}
      <h1 className="mt-2 text-3xl font-black tracking-tight text-white md:text-4xl">
        {title}
      </h1>
      {description ? (
        <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
          {description}
        </p>
      ) : null}
    </div>
  );
}

function rankLabel(rank: number) {
  if (rank === 1) return "Top-ranked";
  if (rank === 2) return "Second";
  if (rank === 3) return "Third";
  return `Rank #${rank}`;
}

function DecisionCard({ decision }: { decision: Decision }) {
  const tickers =
    decision.matchedTickers ??
    parseJsonList(decision.matchedTickersJson).map(String);
  const areas =
    decision.matchedAreas ??
    parseJsonList(decision.matchedAreasJson).map(String);
  const reasons =
    decision.reasons ?? parseJsonList(decision.reasonsJson).map(String);
  const channels =
    decision.channels ?? parseJsonList(decision.channelsJson).map(String);
  const explanations =
    decision.scoreExplanation?.length
      ? decision.scoreExplanation
      : reasons.length
        ? reasons
        : ["No score explanation stored."];

  return (
    <article className="rounded-[1.7rem] border border-white/10 bg-white/[0.055] p-5">
      <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap gap-2">
            <Pill tone={scoreTone(decision.score)}>{rankLabel(decision.rank)}</Pill>
            <Pill tone={urgencyTone(decision.urgency)}>{decision.urgency}</Pill>
            <Pill tone="slate">{decision.importanceTier}</Pill>
            <Pill tone="amber">{decision.category}</Pill>
          </div>

          <h3 className="mt-4 text-xl font-black leading-snug">
            {decision.title}
          </h3>

          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">
            {decision.summary || "No summary stored."}
          </p>

          <div className="mt-3 truncate text-xs font-bold text-slate-500">
            {decision.sourceName} · {decision.sourceTier}
          </div>
        </div>

        <div className="grid min-w-[220px] gap-3">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center">
            <div className="text-xs font-black uppercase text-red-300">
              Score
            </div>
            <div className="text-4xl font-black">{decision.score}</div>
            <div className="mt-2">
              <ScoreBar value={decision.score} tone={scoreTone(decision.score)} />
            </div>
          </div>

          <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-3 text-center">
            <div className="text-[10px] font-black uppercase text-emerald-300">
              Fruit Potential
            </div>
            <div className="text-2xl font-black text-emerald-100">
              {decision.fruitPotentialScore}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-4">
        <SoftCard>
          <div className="text-[10px] font-black uppercase text-slate-500">
            Materiality
          </div>
          <div className="mt-1 text-xl font-black">
            {decision.materialityScore}
          </div>
          <div className="mt-2">
            <ScoreBar value={decision.materialityScore} tone="red" />
          </div>
        </SoftCard>

        <SoftCard>
          <div className="text-[10px] font-black uppercase text-slate-500">
            Relevance
          </div>
          <div className="mt-1 text-xl font-black">
            {decision.relevanceScore}
          </div>
          <div className="mt-2">
            <ScoreBar value={decision.relevanceScore} tone="purple" />
          </div>
        </SoftCard>

        <SoftCard>
          <div className="text-[10px] font-black uppercase text-slate-500">
            Trust
          </div>
          <div className="mt-1 text-xl font-black">{decision.trustScore}</div>
          <div className="mt-2">
            <ScoreBar value={decision.trustScore} tone="green" />
          </div>
        </SoftCard>

        <SoftCard>
          <div className="text-[10px] font-black uppercase text-slate-500">
            Channels
          </div>
          <div className="mt-2 text-xs font-black text-slate-300">
            {channels.length ? channels.join(", ") : "Dashboard"}
          </div>
        </SoftCard>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <SoftCard>
          <div className="text-[10px] font-black uppercase text-slate-500">
            Matched tickers
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-300">
            {tickers.length ? tickers.join(", ") : "None"}
          </div>
        </SoftCard>

        <SoftCard>
          <div className="text-[10px] font-black uppercase text-slate-500">
            Matched areas
          </div>
          <div className="mt-2 line-clamp-2 text-sm font-semibold text-slate-300">
            {areas.length ? areas.join(", ") : "None"}
          </div>
        </SoftCard>

        <SoftCard>
          <div className="text-[10px] font-black uppercase text-slate-500">
            Delivery recommendation
          </div>
          <div className="mt-2 text-sm font-semibold text-slate-300">
            {decision.deliveryRecommendation || "Retain for dashboard review."}
          </div>
        </SoftCard>
      </div>

      <div className="mt-4 rounded-[1.5rem] border border-white/10 bg-black/30 p-4">
        <div className="text-xs font-black uppercase tracking-[0.2em] text-slate-500">
          Why it attained this score
        </div>

        <ul className="mt-3 grid gap-2">
          {explanations.slice(0, 8).map((reason) => (
            <li
              key={String(reason)}
              className="rounded-2xl bg-white/[0.045] px-3 py-2 text-sm font-semibold leading-6 text-slate-400"
            >
              {String(reason)}
            </li>
          ))}
        </ul>
      </div>

      {decision.url ? (
        <a
          href={decision.url}
          target="_blank"
          rel="noreferrer"
          className="mt-4 inline-flex rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
        >
          Open Source
        </a>
      ) : null}
    </article>
  );
}

export default function TriagePage() {
  const [decisions, setDecisions] = useState<Decision[]>([]);
  const [runs, setRuns] = useState<Run[]>([]);
  const [sourceHealth, setSourceHealth] = useState<SourceCheckpoint[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [ranking, setRanking] = useState<RankingState | null>(null);
  const [firmRecipients, setFirmRecipients] = useState<FirmRecipient[]>([]);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [noiseFloor, setNoiseFloor] = useState(60);
  const [alertFloor, setAlertFloor] = useState(80);
  const [visibleFloor, setVisibleFloor] = useState(60);
  const [sortBy, setSortBy] = useState("score");
  const [notifyFirm, setNotifyFirm] = useState(true);
  const [applyToSources, setApplyToSources] = useState(false);

  const latestRun = runs[0];

  const topThree = useMemo(() => decisions.slice(0, 3), [decisions]);

  const categoryCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const decision of decisions) {
      counts.set(decision.category, (counts.get(decision.category) ?? 0) + 1);
    }

    return Array.from(counts.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count);
  }, [decisions]);

  const tierCounts = useMemo(() => {
    const counts = new Map<string, number>();

    for (const decision of decisions) {
      counts.set(
        decision.importanceTier,
        (counts.get(decision.importanceTier) ?? 0) + 1
      );
    }

    return Array.from(counts.entries())
      .map(([tier, count]) => ({ tier, count }))
      .sort((a, b) => b.count - a.count);
  }, [decisions]);

  async function loadData(options?: { keepLocalControls?: boolean }) {
    const [triageResponse, sourceHealthResponse] = await Promise.all([
      fetch(`/api/intelligence/triage?minScore=${visibleFloor}&sortBy=${sortBy}`, {
        cache: "no-store",
      }),
      fetch("/api/intelligence/source-health", {
        cache: "no-store",
      }),
    ]);

    if (triageResponse.ok) {
      const data = await triageResponse.json();
      setDecisions(data.decisions ?? []);
      setRuns(data.runs ?? []);
      setPolicy(data.policy ?? null);
      setRanking(data.ranking ?? null);
      setFirmRecipients(data.firmRecipients ?? []);

      if (!options?.keepLocalControls && data.policy) {
        setNoiseFloor(data.policy.minScoreToStore ?? 60);
        setAlertFloor(data.policy.minScoreToAlert ?? 80);
        setVisibleFloor(data.ranking?.visibleFloor ?? data.policy.minScoreToStore ?? 60);
      }
    }

    if (sourceHealthResponse.ok) {
      const data = await sourceHealthResponse.json();
      setSourceHealth(data.checkpoints ?? []);
    }
  }

  async function saveNoisePolicy() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/intelligence/triage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "updateNoisePolicy",
          minScoreToStore: noiseFloor,
          minScoreToAlert: Math.max(noiseFloor, alertFloor),
          applyToSources,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Unable to save triage policy.");
        return;
      }

      setMessage(
        `Noise policy saved. Scores below ${noiseFloor} will be treated as noise. Firm alert floor is ${Math.max(
          noiseFloor,
          alertFloor
        )}.`
      );

      setVisibleFloor(noiseFloor);
      await loadData({ keepLocalControls: true });
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Unable to save triage policy."
      );
    } finally {
      setLoading(false);
    }
  }

  async function purgeNoise() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/intelligence/triage", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          action: "purgeNoise",
          floor: noiseFloor,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Unable to purge noise.");
        return;
      }

      setMessage(
        `Noise purge complete. Removed ${
          data.purge?.removedDecisions ?? 0
        } retained decision(s) and ${
          data.purge?.removedAlerts ?? 0
        } alert event(s) below ${noiseFloor}.`
      );

      setVisibleFloor(noiseFloor);
      await loadData({ keepLocalControls: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to purge noise.");
    } finally {
      setLoading(false);
    }
  }

  async function runTriage(mode: "live" | "demo") {
    setLoading(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        noiseFloor: String(noiseFloor),
        alertFloor: String(Math.max(noiseFloor, alertFloor)),
        notifyFirm: notifyFirm ? "1" : "0",
      });

      if (mode === "demo") {
        params.set("demo", "1");
      }

      const response = await fetch(
        `/api/intelligence/triage/run?${params.toString()}`,
        {
          method: "POST",
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Triage run failed.");
        return;
      }

      const delivery = data.firmNotificationResult;

      setMessage(
        `Ranked triage complete: ${data.scanned} scanned, ${data.retained} retained, ${data.alerts} firm-alert candidate(s), ${data.discarded} discarded as noise. Queued ${
          delivery?.alertEventsUpserted ?? 0
        } firm alert event(s) across ${delivery?.recipients ?? 0} advisor recipient(s).`
      );

      setVisibleFloor(noiseFloor);
      await loadData({ keepLocalControls: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Triage run failed.");
    } finally {
      setLoading(false);
    }
  }

  async function runCleanup() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/intelligence/cleanup", {
        method: "POST",
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Cleanup failed.");
        return;
      }

      setMessage(`Cleanup complete: ${JSON.stringify(data.result)}`);
      await loadData({ keepLocalControls: true });
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cleanup failed.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, visibleFloor]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(185,28,28,0.20),_transparent_26%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto max-w-[1500px]">
        <header className="sticky top-4 z-40 rounded-[1.75rem] border border-white/10 bg-black/70 p-4 shadow-xl shadow-red-950/30 backdrop-blur-xl">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <Logo />

            <div className="flex flex-wrap items-center gap-2">
              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950"
              >
                Workspace
              </a>

              <a
                href="/opportunity-radar"
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10"
              >
                Opportunity Radar
              </a>

              <a
                href="/intelligence-settings"
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10"
              >
                Settings
              </a>

              <button
                onClick={() => runTriage("live")}
                disabled={loading}
                className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
              >
                {loading ? "Running..." : "Run Live Ranked Scan"}
              </button>

              <button
                onClick={() => runTriage("demo")}
                disabled={loading}
                className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-black text-red-300 ring-1 ring-red-500/30 disabled:opacity-60"
              >
                Demo Ranked Run
              </button>

              <button
                onClick={runCleanup}
                disabled={loading}
                className="rounded-2xl bg-white/10 px-4 py-3 text-sm font-black text-white ring-1 ring-white/10 disabled:opacity-60"
              >
                Cleanup
              </button>
            </div>
          </div>
        </header>

        {message ? (
          <div className="mt-5 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-200">
            {message}
          </div>
        ) : null}

        <section className="mt-5 grid gap-5">
          <Card className="relative p-5 md:p-6">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-red-600/18 to-transparent" />

            <div className="relative grid gap-5 xl:grid-cols-[1.1fr_0.9fr]">
              <div>
                <SectionTitle
                  eyebrow="Ranked intelligence triage"
                  title="Score every scan, remove noise, and surface the highest-fruit opportunities."
                  description="Slice ranks retained scans by score, fruit potential, materiality, relevance, and source trust. You can set the minimum noise floor so anything below 60, 70, 80, or higher is discarded from advisor review."
                />

                <div className="mt-5 grid gap-3 md:grid-cols-5">
                  <MetricBubble
                    label="Scanned"
                    value={latestRun?.scannedCount ?? "—"}
                    helper="Latest run"
                    tone="slate"
                  />
                  <MetricBubble
                    label="Retained"
                    value={latestRun?.retainedCount ?? "—"}
                    helper="Above floor"
                    tone="green"
                  />
                  <MetricBubble
                    label="Alerts"
                    value={latestRun?.alertCount ?? "—"}
                    helper="Firm candidates"
                    tone="red"
                  />
                  <MetricBubble
                    label="Discarded"
                    value={latestRun?.discardedCount ?? "—"}
                    helper="Noise removed"
                    tone="amber"
                  />
                  <MetricBubble
                    label="Hidden"
                    value={ranking?.hiddenBelowFloorCount ?? 0}
                    helper={`Below ${visibleFloor}`}
                    tone="purple"
                  />
                </div>
              </div>

              <SoftCard className="p-5">
                <div className="flex flex-col gap-3">
                  <div>
                    <Pill tone="purple">Noise control</Pill>
                    <h2 className="mt-3 text-2xl font-black">
                      Set the firm’s noise floor.
                    </h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      Scores below the selected floor are treated as noise.
                      Scores above the alert floor can automatically create
                      dashboard/email/SMS delivery records for advisors in the
                      firm workspace.
                    </p>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="grid gap-2">
                      <span className="text-xs font-black uppercase text-slate-500">
                        Remove scores below
                      </span>
                      <select
                        value={noiseFloor}
                        onChange={(event) => {
                          const next = Number(event.target.value);
                          setNoiseFloor(next);
                          setVisibleFloor(next);
                          setAlertFloor((current) => Math.max(next, current));
                        }}
                        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                      >
                        <option value={50}>50 — permissive</option>
                        <option value={60}>60 — light noise removal</option>
                        <option value={70}>70 — balanced advisor filter</option>
                        <option value={80}>80 — aggressive noise removal</option>
                        <option value={90}>90 — only highest signal</option>
                      </select>
                    </label>

                    <label className="grid gap-2">
                      <span className="text-xs font-black uppercase text-slate-500">
                        Firm alert floor
                      </span>
                      <select
                        value={alertFloor}
                        onChange={(event) =>
                          setAlertFloor(
                            Math.max(noiseFloor, Number(event.target.value))
                          )
                        }
                        className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                      >
                        <option value={60}>60+</option>
                        <option value={70}>70+</option>
                        <option value={80}>80+</option>
                        <option value={88}>88+</option>
                        <option value={90}>90+</option>
                        <option value={95}>95+</option>
                      </select>
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm font-bold text-slate-300">
                      <input
                        type="checkbox"
                        checked={notifyFirm}
                        onChange={(event) => setNotifyFirm(event.target.checked)}
                      />
                      Notify firm advisors
                    </label>

                    <label className="flex items-center gap-3 rounded-2xl border border-white/10 bg-black/30 p-3 text-sm font-bold text-slate-300">
                      <input
                        type="checkbox"
                        checked={applyToSources}
                        onChange={(event) =>
                          setApplyToSources(event.target.checked)
                        }
                      />
                      Apply floor to all sources
                    </label>
                  </div>

                  <div className="grid gap-3 md:grid-cols-3">
                    <button
                      onClick={saveNoisePolicy}
                      disabled={loading}
                      className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
                    >
                      Save Policy
                    </button>

                    <button
                      onClick={purgeNoise}
                      disabled={loading}
                      className="rounded-2xl bg-red-500/10 px-4 py-3 text-sm font-black text-red-200 ring-1 ring-red-500/30 disabled:opacity-60"
                    >
                      Purge Below Floor
                    </button>

                    <select
                      value={sortBy}
                      onChange={(event) => setSortBy(event.target.value)}
                      className="rounded-2xl border border-white/10 bg-black/40 px-4 py-3 text-sm font-semibold text-white outline-none ring-red-500 transition focus:ring-2"
                    >
                      <option value="score">Sort by score</option>
                      <option value="fruit">Sort by fruit potential</option>
                      <option value="materiality">Sort by materiality</option>
                      <option value="relevance">Sort by relevance</option>
                    </select>
                  </div>
                </div>
              </SoftCard>
            </div>
          </Card>

          <section className="grid gap-5 xl:grid-cols-[0.85fr_1.15fr]">
            <div className="grid gap-5">
              <Card className="p-5">
                <SectionTitle
                  eyebrow="Top ranked"
                  title="Most likely to bear fruit"
                  description="These are the highest-ranking retained scans after noise removal."
                />

                <div className="mt-5 grid gap-3">
                  {topThree.length ? (
                    topThree.map((decision) => (
                      <div
                        key={decision.id}
                        className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap gap-2">
                              <Pill tone={scoreTone(decision.score)}>
                                #{decision.rank}
                              </Pill>
                              <Pill tone={urgencyTone(decision.urgency)}>
                                {decision.urgency}
                              </Pill>
                            </div>
                            <h3 className="mt-3 line-clamp-2 text-sm font-black leading-5">
                              {decision.title}
                            </h3>
                            <div className="mt-2 truncate text-xs font-semibold text-slate-500">
                              {decision.sourceName}
                            </div>
                          </div>

                          <div className="shrink-0 rounded-2xl bg-red-500/10 px-3 py-2 text-center ring-1 ring-red-500/30">
                            <div className="text-[10px] font-black uppercase text-red-300">
                              Score
                            </div>
                            <div className="text-2xl font-black">
                              {decision.score}
                            </div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <ScoreBar
                            value={decision.fruitPotentialScore}
                            tone={scoreTone(decision.fruitPotentialScore)}
                          />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm font-bold text-slate-500">
                      No ranked results yet. Run triage first.
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-5">
                <SectionTitle
                  eyebrow="Firm delivery"
                  title="Advisor recipients"
                  description="High-ranked items can create dashboard/email/SMS delivery records for these firm users."
                />

                <div className="mt-5 grid gap-3">
                  {firmRecipients.length ? (
                    firmRecipients.map((recipient) => (
                      <div
                        key={recipient.userId}
                        className="rounded-2xl border border-white/10 bg-white/[0.055] p-3"
                      >
                        <div className="truncate text-sm font-black">
                          {recipient.name}
                        </div>
                        <div className="mt-1 truncate text-xs font-semibold text-slate-500">
                          {recipient.email}
                        </div>
                        <div className="mt-2 flex flex-wrap gap-2">
                          <Pill tone="slate">{recipient.role}</Pill>
                          <Pill tone="purple">{recipient.firmName}</Pill>
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm font-bold text-slate-500">
                      No firm recipients found.
                    </div>
                  )}
                </div>
              </Card>

              <Card className="p-5">
                <SectionTitle
                  eyebrow="Bands"
                  title="Score distribution"
                  description="Quick view of how much signal is clearing each quality threshold."
                />

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <MetricBubble
                    label="90+"
                    value={ranking?.scoreBands.ninetyPlus ?? 0}
                    helper="Highest signal"
                    tone="red"
                  />
                  <MetricBubble
                    label="80+"
                    value={ranking?.scoreBands.eightyPlus ?? 0}
                    helper="Advisor alerts"
                    tone="amber"
                  />
                  <MetricBubble
                    label="70+"
                    value={ranking?.scoreBands.seventyPlus ?? 0}
                    helper="Strong review"
                    tone="purple"
                  />
                  <MetricBubble
                    label="60+"
                    value={ranking?.scoreBands.sixtyPlus ?? 0}
                    helper="Retained"
                    tone="green"
                  />
                </div>
              </Card>

              <Card className="p-5">
                <SectionTitle
                  eyebrow="Source health"
                  title="Feed status"
                  description="Shows which sources fetched, skipped, or errored."
                />

                <div className="mt-5 grid gap-3">
                  {sourceHealth.length ? (
                    sourceHealth.map((source) => (
                      <div
                        key={source.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.055] p-3"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black">
                              {source.sourceName}
                            </div>
                            <div className="mt-1 truncate text-xs text-slate-500">
                              {source.sourceId}
                            </div>
                          </div>
                          <Pill tone={sourceStatusTone(source.lastStatus)}>
                            {source.lastStatus}
                          </Pill>
                        </div>
                        <div className="mt-2 text-xs font-semibold text-slate-500">
                          {source.lastItemCount} item(s) ·{" "}
                          {source.lastFetchedAt
                            ? new Date(source.lastFetchedAt).toLocaleString()
                            : "Never fetched"}
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm font-bold text-slate-500">
                      No source health checkpoints yet.
                    </div>
                  )}
                </div>
              </Card>
            </div>

            <Card className="p-5">
              <SectionTitle
                eyebrow="Ranked decisions"
                title="Signal ranking board"
                description="Only retained results above your visible floor are shown. Anything below the floor can be discarded as noise."
              />

              <div className="mt-5 grid gap-4">
                {decisions.length ? (
                  decisions.map((decision) => (
                    <DecisionCard key={decision.id} decision={decision} />
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-semibold text-slate-400">
                    No retained decisions above the current floor. Lower the
                    visible floor or run triage again.
                  </div>
                )}
              </div>
            </Card>
          </section>

          <section className="grid gap-5 lg:grid-cols-2">
            <Card className="p-5">
              <SectionTitle
                eyebrow="Categories"
                title="Where the signal is coming from"
                description="Categories help advisors understand what kind of opportunity or risk is dominating the scan."
              />

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {categoryCounts.length ? (
                  categoryCounts.map((item) => (
                    <SoftCard key={item.category}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-black">
                          {item.category}
                        </div>
                        <Pill tone="red">{item.count}</Pill>
                      </div>
                    </SoftCard>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm font-bold text-slate-500">
                    No categories yet.
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <SectionTitle
                eyebrow="Tiers"
                title="Importance tiers"
                description="Tiers determine whether the result becomes an urgent alert, advisor review, digest item, or suppressed noise."
              />

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                {tierCounts.length ? (
                  tierCounts.map((item) => (
                    <SoftCard key={item.tier}>
                      <div className="flex items-center justify-between gap-3">
                        <div className="truncate text-sm font-black">
                          {item.tier}
                        </div>
                        <Pill tone="amber">{item.count}</Pill>
                      </div>
                    </SoftCard>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm font-bold text-slate-500">
                    No tiers yet.
                  </div>
                )}
              </div>
            </Card>
          </section>
        </section>
      </div>
    </main>
  );
}