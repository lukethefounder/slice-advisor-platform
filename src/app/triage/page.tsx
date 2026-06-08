"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Tone = "red" | "green" | "amber" | "slate" | "purple" | "cyan";
type ViewMode = "command" | "decisions" | "runs" | "sources" | "settings";
type ScanMode = "fast" | "broad" | "deep";
type TechnicalUniverseId = "sp100" | "nasdaq100" | "dow30" | "advisor-watchlist" | "custom";

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

const inputClass =
  "rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-red-400/40 focus:ring-2 focus:ring-red-500/20";

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

function scoreTone(score: number): Tone {
  if (score >= 90) return "red";
  if (score >= 80) return "amber";
  if (score >= 70) return "purple";
  if (score >= 60) return "green";
  return "slate";
}

function urgencyTone(urgency: string): Tone {
  if (urgency === "Critical") return "red";
  if (urgency === "High") return "amber";
  if (urgency === "Medium") return "green";
  return "slate";
}

function sourceStatusTone(status: string): Tone {
  if (status === "OK") return "green";
  if (status === "Skipped") return "amber";
  if (status === "Error") return "red";
  return "slate";
}

function runTone(mode: string): Tone {
  if (mode.startsWith("technical")) return "cyan";
  if (mode.includes("fast")) return "red";
  if (mode.includes("deep")) return "purple";
  if (mode.includes("cron")) return "green";
  return "slate";
}

function technicalRun(run: Run) {
  return run.mode.startsWith("technical-");
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Unknown";

  const minutes = Math.round((Date.now() - date.getTime()) / 60000);

  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;

  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;

  return `${Math.round(hours / 24)}d ago`;
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Never";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
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
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/78 shadow-xl shadow-red-950/20 backdrop-blur-xl",
        className
      )}
    >
      {children}
    </div>
  );
}

function Panel({
  children,
  className = "",
  tone = "slate",
}: {
  children: ReactNode;
  className?: string;
  tone?: Tone;
}) {
  const glows: Record<Tone, string> = {
    red: "from-red-500/16",
    green: "from-emerald-500/16",
    amber: "from-amber-500/16",
    purple: "from-purple-500/16",
    cyan: "from-cyan-500/16",
    slate: "from-slate-400/8",
  };

  return (
    <div
      className={cx(
        "relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.052] p-4 shadow-lg shadow-black/10",
        className
      )}
    >
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">{children}</div>
    </div>
  );
}

function Pill({
  children,
  tone = "red",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const tones: Record<Tone, string> = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
  };

  return (
    <span
      className={cx(
        "inline-flex max-w-full items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1",
        tones[tone]
      )}
    >
      <span className="truncate">{children}</span>
    </span>
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
  tone?: Tone;
}) {
  const glows: Record<Tone, string> = {
    red: "from-red-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    slate: "from-slate-400/10",
    purple: "from-purple-500/18",
    cyan: "from-cyan-500/18",
  };

  return (
    <div className="relative min-h-[112px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs font-semibold text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function ScoreBar({
  value,
  tone = "red",
}: {
  value: number;
  tone?: Tone;
}) {
  const fills: Record<Tone, string> = {
    red: "from-red-700 to-red-400",
    green: "from-emerald-700 to-emerald-300",
    amber: "from-amber-700 to-amber-300",
    purple: "from-purple-700 to-purple-300",
    slate: "from-slate-700 to-slate-300",
    cyan: "from-cyan-700 to-cyan-300",
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
            <Pill tone={scoreTone(decision.score)}>Rank #{decision.rank}</Pill>
            <Pill tone={urgencyTone(decision.urgency)}>{decision.urgency}</Pill>
            <Pill tone="slate">{decision.importanceTier}</Pill>
            <Pill tone="amber">{decision.category}</Pill>
          </div>

          <h3 className="mt-4 text-xl font-black leading-snug">{decision.title}</h3>

          <p className="mt-2 line-clamp-3 text-sm leading-6 text-slate-400">
            {decision.summary || "No summary stored."}
          </p>

          <div className="mt-3 truncate text-xs font-bold text-slate-500">
            {decision.sourceName} · {decision.sourceTier} · {formatDateTime(decision.createdAt)}
          </div>
        </div>

        <div className="grid min-w-[220px] gap-3">
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-center">
            <div className="text-xs font-black uppercase text-red-300">Score</div>
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

      <div className="mt-4 grid gap-3 md:grid-cols-5">
        {[
          ["Materiality", decision.materialityScore, "red"],
          ["Relevance", decision.relevanceScore, "purple"],
          ["Trust", decision.trustScore, "green"],
          ["Rank Score", decision.rankingScore, "cyan"],
          ["Channels", channels.length ? channels.join(", ") : "Dashboard", "slate"],
        ].map(([label, value, tone]) => (
          <Panel key={`${decision.id}-${label}`} tone={tone as Tone} className="bg-black/35">
            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">
              {label}
            </div>
            <div className="mt-1 truncate text-lg font-black text-white">
              {String(value)}
            </div>
            {typeof value === "number" ? (
              <div className="mt-2">
                <ScoreBar value={value} tone={tone as Tone} />
              </div>
            ) : null}
          </Panel>
        ))}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-3">
        <Panel>
          <div className="text-[10px] font-black uppercase text-slate-500">
            Matched tickers
          </div>
          <div className="mt-2 flex flex-wrap gap-2">
            {tickers.length ? tickers.map((ticker) => <Pill key={String(ticker)} tone="red">{String(ticker)}</Pill>) : <span className="text-sm text-slate-500">None</span>}
          </div>
        </Panel>

        <Panel>
          <div className="text-[10px] font-black uppercase text-slate-500">
            Matched areas
          </div>
          <div className="mt-2 line-clamp-3 text-sm font-semibold text-slate-300">
            {areas.length ? areas.join(", ") : "None"}
          </div>
        </Panel>

        <Panel>
          <div className="text-[10px] font-black uppercase text-slate-500">
            Delivery recommendation
          </div>
          <div className="mt-2 text-sm font-semibold leading-6 text-slate-300">
            {decision.deliveryRecommendation || "Retain for dashboard review."}
          </div>
        </Panel>
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

  const [activeView, setActiveView] = useState<ViewMode>("command");

  const [noiseFloor, setNoiseFloor] = useState(60);
  const [alertFloor, setAlertFloor] = useState(80);
  const [visibleFloor, setVisibleFloor] = useState(60);
  const [sortBy, setSortBy] = useState("score");
  const [applyToSources, setApplyToSources] = useState(false);

  const [runConfig, setRunConfig] = useState({
    headlines: true,
    technicals: true,
    opportunities: true,
    email: true,
    aiResearch: true,
    scanMode: "fast" as ScanMode,
    technicalUniverse: "sp100" as TechnicalUniverseId,
    technicalLimit: 80,
    technicalMinScore: 70,
    technicalMaxDurationMs: 38000,
    customSymbols: "",
    maxRiskScore: 78,
    minConfidenceScore: 50,
    minActionabilityScore: 46,
    minDollarVolume: 3000000,
    minRsi14: 32,
    maxRsi14: 62,
    requireMacdImproving: true,
  });

  const latestRun = runs[0];
  const latestTechnicalRun = runs.find(technicalRun);
  const headlineRuns = runs.filter((run) => !technicalRun(run));
  const technicalRuns = runs.filter(technicalRun);

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

  const sourceSummary = useMemo(() => {
    return {
      ok: sourceHealth.filter((source) => source.lastStatus === "OK").length,
      skipped: sourceHealth.filter((source) => source.lastStatus === "Skipped").length,
      error: sourceHealth.filter((source) => source.lastStatus === "Error").length,
      totalItems: sourceHealth.reduce((sum, source) => sum + source.lastItemCount, 0),
    };
  }, [sourceHealth]);

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
          "x-slice-sensitive-action": "save-triage-policy",
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
        `Noise policy saved. Scores below ${noiseFloor} will be treated as noise. Alert floor is ${Math.max(
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
          "x-slice-sensitive-action": "purge-triage-noise",
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

  async function runTriage(mode: "full" | "headlines" | "technical" | "demo") {
    setLoading(true);
    setMessage("");

    try {
      const params = new URLSearchParams({
        noiseFloor: String(noiseFloor),
        alertFloor: String(Math.max(noiseFloor, alertFloor)),
        email: runConfig.email ? "1" : "0",
        aiResearch: runConfig.aiResearch ? "1" : "0",
        opportunities: runConfig.opportunities ? "1" : "0",
        scanMode: runConfig.scanMode,
        technicalUniverse: runConfig.technicalUniverse,
        technicalLimit: String(runConfig.technicalLimit),
        technicalMinScore: String(runConfig.technicalMinScore),
        technicalMaxDurationMs: String(runConfig.technicalMaxDurationMs),
        maxRiskScore: String(runConfig.maxRiskScore),
        minConfidenceScore: String(runConfig.minConfidenceScore),
        minActionabilityScore: String(runConfig.minActionabilityScore),
        minDollarVolume: String(runConfig.minDollarVolume),
        minRsi14: String(runConfig.minRsi14),
        maxRsi14: String(runConfig.maxRsi14),
        requireMacdImproving: runConfig.requireMacdImproving ? "1" : "0",
      });

      if (runConfig.customSymbols.trim()) {
        params.set("symbols", runConfig.customSymbols);
      }

      if (mode === "demo") {
        params.set("demo", "1");
        params.set("headlines", "1");
        params.set("technicals", "1");
      } else if (mode === "headlines") {
        params.set("headlines", "1");
        params.set("technicals", "0");
      } else if (mode === "technical") {
        params.set("headlines", "0");
        params.set("technicals", "1");
      } else {
        params.set("headlines", runConfig.headlines ? "1" : "0");
        params.set("technicals", runConfig.technicals ? "1" : "0");
      }

      const response = await fetch(
        `/api/intelligence/triage/run?${params.toString()}`,
        {
          method: "POST",
          headers: {
            "x-slice-sensitive-action": `triage-${mode}`,
          },
        }
      );

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Triage run failed.");
        return;
      }

      const summary = data.summary ?? {};

      setMessage(
        `Triage complete: ${summary.headlineScanned ?? 0} headline(s) scanned, ${
          summary.headlineRetained ?? 0
        } retained, ${summary.technicalScanned ?? 0} technical symbol(s) scanned, ${
          summary.technicalQualified ?? 0
        } technical setup(s) qualified, ${summary.technicalAlerts ?? 0} technical alert(s), ${
          summary.opportunityCreated ?? 0
        } opportunity signal(s) created.`
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
        headers: {
          "x-slice-sensitive-action": "intelligence-cleanup",
        },
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
    const interval = window.setInterval(() => {
      void loadData({ keepLocalControls: true });
    }, 30_000);

    return () => window.clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sortBy, visibleFloor]);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.18),_transparent_28%),linear-gradient(135deg,_#030712,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1900px] gap-5">
        <header className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-zinc-950/78 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(239,68,68,0.28),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(6,182,212,0.14),transparent_26%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <Logo />

              <div className="mt-5 flex flex-wrap gap-2">
                <Pill tone="red">Mission critical</Pill>
                <Pill tone="cyan">Headline + technical scans</Pill>
                <Pill tone="green">Autonomous advisor alerts</Pill>
                <Pill tone="purple">Always-on intelligence</Pill>
              </div>

              <h1 className="mt-5 max-w-6xl text-4xl font-black tracking-tight md:text-6xl">
                Intelligence triage command center.
              </h1>

              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
                This is the core scanner behind Slice. It ranks headlines, verifies source reliability,
                evaluates advisor relevance, triggers notifications, and now runs technical opportunity
                scans from the same command flow.
              </p>
            </div>

            <div className="flex flex-wrap gap-2 xl:justify-end">
              <a href="/workspace" className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20">
                ← Workspace
              </a>

              <a href="/opportunity-radar" className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-500/20">
                Opportunity Radar
              </a>

              <a href="/notifications" className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white hover:bg-white/10">
                Notifications
              </a>

              <a href="/intelligence-settings" className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-black text-purple-100 hover:bg-purple-500/20">
                Settings
              </a>

              <button
                onClick={() => runTriage("full")}
                disabled={loading}
                className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-60"
              >
                {loading ? "Running..." : "Run Full Triage"}
              </button>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-8">
            <MetricBubble label="Latest Scan" value={latestRun ? relativeTime(latestRun.createdAt) : "Never"} helper={latestRun?.mode ?? "No run"} tone={latestRun ? runTone(latestRun.mode) : "slate"} />
            <MetricBubble label="Scanned" value={latestRun?.scannedCount ?? "—"} helper="Latest run" tone="cyan" />
            <MetricBubble label="Retained" value={latestRun?.retainedCount ?? "—"} helper="Useful intelligence" tone="green" />
            <MetricBubble label="Alerts" value={latestRun?.alertCount ?? "—"} helper="Advisor notifications" tone={latestRun?.alertCount ? "red" : "slate"} />
            <MetricBubble label="Technical Run" value={latestTechnicalRun ? relativeTime(latestTechnicalRun.createdAt) : "Never"} helper={latestTechnicalRun?.mode ?? "No technical scan"} tone={latestTechnicalRun ? "cyan" : "slate"} />
            <MetricBubble label="Visible" value={decisions.length} helper="Current board" tone="purple" />
            <MetricBubble label="Sources OK" value={sourceSummary.ok} helper={`${sourceSummary.error} errors`} tone={sourceSummary.error ? "amber" : "green"} />
            <MetricBubble label="Hidden Noise" value={ranking?.hiddenBelowFloorCount ?? 0} helper={`Below ${visibleFloor}`} tone="slate" />
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <Card className="p-3">
          <div className="grid gap-2 md:grid-cols-5">
            {[
              ["command", "Command", "Run engine", "red"],
              ["decisions", "Decisions", "Ranked signals", "cyan"],
              ["runs", "Runs", "Audit trail", "purple"],
              ["sources", "Sources", "Feed health", "green"],
              ["settings", "Settings", "Policy tuning", "amber"],
            ].map(([key, label, helper, tone]) => (
              <button
                key={key}
                type="button"
                onClick={() => setActiveView(key as ViewMode)}
                className={cx(
                  "rounded-2xl px-4 py-3 text-left transition",
                  activeView === key
                    ? "bg-white text-slate-950 shadow-lg shadow-black/20"
                    : "border border-white/10 bg-white/[0.045] text-white hover:bg-white/10"
                )}
              >
                <div className="flex items-center justify-between gap-2">
                  <div className="text-sm font-black">{label}</div>
                  <span
                    className={cx(
                      "h-2 w-2 rounded-full",
                      tone === "red"
                        ? "bg-red-400"
                        : tone === "cyan"
                          ? "bg-cyan-400"
                          : tone === "purple"
                            ? "bg-purple-400"
                            : tone === "green"
                              ? "bg-emerald-400"
                              : "bg-amber-400"
                    )}
                  />
                </div>
                <div className={cx("mt-1 text-[10px] font-bold", activeView === key ? "text-slate-500" : "text-slate-500")}>
                  {helper}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {activeView === "command" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_470px]">
            <Card className="p-6">
              <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.22em] text-red-400">
                    Run control
                  </div>
                  <h2 className="mt-2 text-3xl font-black text-white">
                    Full-stack intelligence scan
                  </h2>
                  <p className="mt-2 max-w-4xl text-sm leading-7 text-slate-400">
                    Run headlines, technicals, and opportunity signal generation in one command. The cron route should keep this scanning in production, but this page gives you direct control.
                  </p>
                </div>

                <div className="grid gap-2 sm:grid-cols-2 xl:min-w-[460px]">
                  <button
                    onClick={() => runTriage("full")}
                    disabled={loading}
                    className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60"
                  >
                    Full Stack Scan
                  </button>

                  <button
                    onClick={() => runTriage("headlines")}
                    disabled={loading}
                    className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 disabled:opacity-60"
                  >
                    Headlines Only
                  </button>

                  <button
                    onClick={() => runTriage("technical")}
                    disabled={loading}
                    className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 disabled:opacity-60"
                  >
                    Technicals Only
                  </button>

                  <button
                    onClick={() => runTriage("demo")}
                    disabled={loading}
                    className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-3 text-sm font-black text-purple-100 disabled:opacity-60"
                  >
                    Demo Validation
                  </button>
                </div>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-3">
                <Panel tone="red" className="bg-black/35">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-red-300">
                    Headline triage
                  </div>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    Source-backed ranking
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Scores headlines by materiality, relevance, trust, urgency, and advisor fit.
                  </p>
                  <div className="mt-4">
                    <ScoreBar value={runConfig.headlines ? 100 : 15} tone={runConfig.headlines ? "red" : "slate"} />
                  </div>
                </Panel>

                <Panel tone="cyan" className="bg-black/35">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-300">
                    Technical scanner
                  </div>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    Index-level analysis
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Runs RSI, SMA, MACD, volume, volatility, liquidity, relative strength, and risk filters.
                  </p>
                  <div className="mt-4">
                    <ScoreBar value={runConfig.technicals ? 100 : 15} tone={runConfig.technicals ? "cyan" : "slate"} />
                  </div>
                </Panel>

                <Panel tone="green" className="bg-black/35">
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-emerald-300">
                    Notifications
                  </div>
                  <h3 className="mt-2 text-2xl font-black text-white">
                    Advisor delivery
                  </h3>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Qualified items are retained, ranked, and queued for dashboard/email delivery when policy allows.
                  </p>
                  <div className="mt-4">
                    <ScoreBar value={runConfig.email ? 100 : 40} tone={runConfig.email ? "green" : "amber"} />
                  </div>
                </Panel>
              </div>

              <div className="mt-6 grid gap-4 xl:grid-cols-2">
                <Panel tone="purple" className="bg-black/35">
                  <div className="text-lg font-black text-white">Latest headline runs</div>
                  <div className="mt-4 grid gap-3">
                    {headlineRuns.slice(0, 5).map((run) => (
                      <div key={run.id} className="rounded-2xl border border-white/10 bg-black/35 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-white">{run.mode}</div>
                            <div className="mt-1 text-xs text-slate-500">{formatDateTime(run.createdAt)}</div>
                          </div>
                          <Pill tone={runTone(run.mode)}>{run.alertCount} alerts</Pill>
                        </div>
                        <div className="mt-3">
                          <ScoreBar value={run.scannedCount ? (run.retainedCount / run.scannedCount) * 100 : 0} tone="purple" />
                        </div>
                      </div>
                    ))}
                    {!headlineRuns.length ? <div className="text-sm text-slate-500">No headline runs yet.</div> : null}
                  </div>
                </Panel>

                <Panel tone="cyan" className="bg-black/35">
                  <div className="text-lg font-black text-white">Latest technical runs</div>
                  <div className="mt-4 grid gap-3">
                    {technicalRuns.slice(0, 5).map((run) => (
                      <div key={run.id} className="rounded-2xl border border-white/10 bg-black/35 p-3">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="truncate text-sm font-black text-white">{run.mode}</div>
                            <div className="mt-1 text-xs text-slate-500">{formatDateTime(run.createdAt)}</div>
                          </div>
                          <Pill tone="cyan">{run.retainedCount} qualified</Pill>
                        </div>
                        <div className="mt-3">
                          <ScoreBar value={run.scannedCount ? (run.retainedCount / run.scannedCount) * 100 : 0} tone="cyan" />
                        </div>
                      </div>
                    ))}
                    {!technicalRuns.length ? <div className="text-sm text-slate-500">No technical runs yet.</div> : null}
                  </div>
                </Panel>
              </div>
            </Card>

            <Card className="p-6">
              <div className="text-xs font-black uppercase tracking-[0.22em] text-cyan-400">
                Engine configuration
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">Scanner controls</h2>

              <div className="mt-5 grid gap-3">
                <div className="grid gap-2 md:grid-cols-3">
                  <label className="grid gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Mode</span>
                    <select
                      value={runConfig.scanMode}
                      onChange={(event) => setRunConfig((current) => ({ ...current, scanMode: event.target.value as ScanMode }))}
                      className={inputClass}
                    >
                      <option value="fast">Fast</option>
                      <option value="broad">Broad</option>
                      <option value="deep">Deep</option>
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Universe</span>
                    <select
                      value={runConfig.technicalUniverse}
                      onChange={(event) => setRunConfig((current) => ({ ...current, technicalUniverse: event.target.value as TechnicalUniverseId }))}
                      className={inputClass}
                    >
                      <option value="sp100">S&P 100</option>
                      <option value="nasdaq100">Nasdaq 100</option>
                      <option value="dow30">Dow 30</option>
                      <option value="advisor-watchlist">Advisor Watchlist</option>
                      <option value="custom">Custom</option>
                    </select>
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Limit</span>
                    <input
                      type="number"
                      min={1}
                      max={125}
                      value={runConfig.technicalLimit}
                      onChange={(event) => setRunConfig((current) => ({ ...current, technicalLimit: Number(event.target.value) }))}
                      className={inputClass}
                    />
                  </label>
                </div>

                {runConfig.technicalUniverse === "custom" ? (
                  <textarea
                    value={runConfig.customSymbols}
                    onChange={(event) => setRunConfig((current) => ({ ...current, customSymbols: event.target.value }))}
                    placeholder="AAPL, MSFT, NVDA, JPM"
                    className={cx(inputClass, "min-h-24")}
                  />
                ) : null}

                <div className="grid gap-2 md:grid-cols-2">
                  <label className="grid gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Technical min score</span>
                    <input
                      type="number"
                      min={50}
                      max={95}
                      value={runConfig.technicalMinScore}
                      onChange={(event) => setRunConfig((current) => ({ ...current, technicalMinScore: Number(event.target.value) }))}
                      className={inputClass}
                    />
                  </label>

                  <label className="grid gap-2">
                    <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Max duration ms</span>
                    <input
                      type="number"
                      min={8000}
                      max={55000}
                      value={runConfig.technicalMaxDurationMs}
                      onChange={(event) => setRunConfig((current) => ({ ...current, technicalMaxDurationMs: Number(event.target.value) }))}
                      className={inputClass}
                    />
                  </label>
                </div>

                <div className="grid gap-2 md:grid-cols-2">
                  {[
                    ["headlines", "Run headlines"],
                    ["technicals", "Run technicals"],
                    ["opportunities", "Generate opportunities"],
                    ["email", "Queue email alerts"],
                    ["aiResearch", "AI research briefing"],
                    ["requireMacdImproving", "Require MACD improving"],
                  ].map(([key, label]) => (
                    <label key={key} className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-slate-300">
                      {label}
                      <input
                        type="checkbox"
                        checked={Boolean((runConfig as any)[key])}
                        onChange={(event) => setRunConfig((current) => ({ ...current, [key]: event.target.checked }))}
                      />
                    </label>
                  ))}
                </div>
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "decisions" ? (
          <section className="grid gap-5 xl:grid-cols-[380px_1fr]">
            <div className="grid gap-5">
              <Card className="p-5">
                <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                  Top ranked
                </div>
                <h2 className="mt-2 text-2xl font-black">Most likely to matter</h2>

                <div className="mt-5 grid gap-3">
                  {topThree.length ? (
                    topThree.map((decision) => (
                      <div key={decision.id} className="rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            <div className="flex flex-wrap gap-2">
                              <Pill tone={scoreTone(decision.score)}>#{decision.rank}</Pill>
                              <Pill tone={urgencyTone(decision.urgency)}>{decision.urgency}</Pill>
                            </div>
                            <h3 className="mt-3 line-clamp-2 text-sm font-black leading-5">
                              {decision.title}
                            </h3>
                            <div className="mt-2 truncate text-xs font-semibold text-slate-500">
                              {decision.sourceName}
                            </div>
                          </div>

                          <div className="shrink-0 rounded-2xl bg-red-500/10 px-3 py-2 text-center ring-1 ring-red-500/30">
                            <div className="text-[10px] font-black uppercase text-red-300">Score</div>
                            <div className="text-2xl font-black">{decision.score}</div>
                          </div>
                        </div>

                        <div className="mt-3">
                          <ScoreBar value={decision.fruitPotentialScore} tone={scoreTone(decision.fruitPotentialScore)} />
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
                <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
                  Score bands
                </div>
                <h2 className="mt-2 text-2xl font-black">Distribution</h2>

                <div className="mt-5 grid gap-3 md:grid-cols-2">
                  <MetricBubble label="90+" value={ranking?.scoreBands.ninetyPlus ?? 0} helper="Highest signal" tone="red" />
                  <MetricBubble label="80+" value={ranking?.scoreBands.eightyPlus ?? 0} helper="Advisor alerts" tone="amber" />
                  <MetricBubble label="70+" value={ranking?.scoreBands.seventyPlus ?? 0} helper="Strong review" tone="purple" />
                  <MetricBubble label="60+" value={ranking?.scoreBands.sixtyPlus ?? 0} helper="Retained" tone="green" />
                </div>
              </Card>
            </div>

            <Card className="p-5">
              <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                <div>
                  <div className="text-xs font-black uppercase tracking-[0.18em] text-red-400">
                    Ranked decisions
                  </div>
                  <h2 className="mt-2 text-2xl font-black">Signal ranking board</h2>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Only retained results above your visible floor are shown.
                  </p>
                </div>

                <select value={sortBy} onChange={(event) => setSortBy(event.target.value)} className={inputClass}>
                  <option value="score">Sort by score</option>
                  <option value="fruit">Sort by fruit potential</option>
                  <option value="materiality">Sort by materiality</option>
                  <option value="relevance">Sort by relevance</option>
                </select>
              </div>

              <div className="mt-5 grid gap-4">
                {decisions.length ? (
                  decisions.map((decision) => <DecisionCard key={decision.id} decision={decision} />)
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-semibold text-slate-400">
                    No retained decisions above the current floor.
                  </div>
                )}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "runs" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
                Audit trail
              </div>
              <h2 className="mt-2 text-2xl font-black">Recent intelligence runs</h2>

              <div className="mt-5 grid gap-3">
                {runs.length ? (
                  runs.map((run) => (
                    <Panel key={run.id} tone={runTone(run.mode)} className="bg-black/35">
                      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                        <div className="min-w-0">
                          <div className="truncate text-lg font-black text-white">{run.mode}</div>
                          <div className="mt-1 text-xs font-bold text-slate-500">
                            {formatDateTime(run.createdAt)} · {run.durationMs}ms
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <Pill tone={runTone(run.mode)}>{technicalRun(run) ? "Technical" : "Headline"}</Pill>
                          <Pill tone={run.alertCount ? "red" : "slate"}>{run.alertCount} alerts</Pill>
                        </div>
                      </div>

                      <div className="mt-4 grid gap-3 md:grid-cols-5">
                        <MetricBubble label="Scanned" value={run.scannedCount} tone="cyan" />
                        <MetricBubble label="Retained" value={run.retainedCount} tone="green" />
                        <MetricBubble label="Alerts" value={run.alertCount} tone={run.alertCount ? "red" : "slate"} />
                        <MetricBubble label="Discarded" value={run.discardedCount} tone="amber" />
                        <MetricBubble label="Digest" value={run.digestCount} tone="purple" />
                      </div>
                    </Panel>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 p-8 text-center text-sm font-semibold text-slate-400">
                    No intelligence runs yet.
                  </div>
                )}
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-cyan-400">
                Runtime mix
              </div>
              <h2 className="mt-2 text-2xl font-black">Headline vs technical</h2>

              <div className="mt-5 grid gap-3">
                <MetricBubble label="Headline Runs" value={headlineRuns.length} helper="Recent" tone="red" />
                <MetricBubble label="Technical Runs" value={technicalRuns.length} helper="Recent" tone="cyan" />
                <MetricBubble label="Total Alerts" value={runs.reduce((sum, run) => sum + run.alertCount, 0)} helper="Recent runs" tone="purple" />
                <MetricBubble label="Total Scanned" value={runs.reduce((sum, run) => sum + run.scannedCount, 0)} helper="Recent runs" tone="green" />
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "sources" ? (
          <section className="grid gap-5 xl:grid-cols-[420px_1fr]">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-green-400">
                Source health
              </div>
              <h2 className="mt-2 text-2xl font-black">Feed status</h2>

              <div className="mt-5 grid gap-3">
                <MetricBubble label="OK" value={sourceSummary.ok} tone="green" />
                <MetricBubble label="Skipped" value={sourceSummary.skipped} tone="amber" />
                <MetricBubble label="Errors" value={sourceSummary.error} tone={sourceSummary.error ? "red" : "green"} />
                <MetricBubble label="Items" value={sourceSummary.totalItems} tone="cyan" />
              </div>
            </Card>

            <Card className="p-5">
              <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
                {sourceHealth.length ? (
                  sourceHealth.map((source) => (
                    <Panel key={source.id} tone={sourceStatusTone(source.lastStatus)} className="bg-black/35">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <div className="truncate text-sm font-black">{source.sourceName}</div>
                          <div className="mt-1 truncate text-xs text-slate-500">{source.sourceId}</div>
                        </div>
                        <Pill tone={sourceStatusTone(source.lastStatus)}>{source.lastStatus}</Pill>
                      </div>
                      <div className="mt-3 text-xs font-semibold text-slate-500">
                        {source.lastItemCount} item(s) · {source.lastFetchedAt ? formatDateTime(source.lastFetchedAt) : "Never fetched"}
                      </div>
                    </Panel>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm font-bold text-slate-500">
                    No source health checkpoints yet.
                  </div>
                )}
              </div>
            </Card>
          </section>
        ) : null}

        {activeView === "settings" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-amber-400">
                Policy tuning
              </div>
              <h2 className="mt-2 text-2xl font-black">Noise floor and alert floor</h2>

              <div className="mt-5 grid gap-4 md:grid-cols-3">
                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Noise floor</span>
                  <input type="number" min={0} max={100} value={noiseFloor} onChange={(event) => setNoiseFloor(Number(event.target.value))} className={inputClass} />
                </label>

                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Alert floor</span>
                  <input type="number" min={0} max={100} value={alertFloor} onChange={(event) => setAlertFloor(Number(event.target.value))} className={inputClass} />
                </label>

                <label className="grid gap-2">
                  <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Visible floor</span>
                  <input type="number" min={0} max={100} value={visibleFloor} onChange={(event) => setVisibleFloor(Number(event.target.value))} className={inputClass} />
                </label>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-slate-300">
                  Apply floor to all sources
                  <input type="checkbox" checked={applyToSources} onChange={(event) => setApplyToSources(event.target.checked)} />
                </label>

                <div className="grid gap-2 md:grid-cols-2">
                  <button onClick={saveNoisePolicy} disabled={loading} className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-60">
                    Save Policy
                  </button>

                  <button onClick={purgeNoise} disabled={loading} className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 disabled:opacity-60">
                    Purge Noise
                  </button>
                </div>
              </div>

              <div className="mt-5">
                <button onClick={runCleanup} disabled={loading} className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm font-black text-amber-100 disabled:opacity-60">
                  Run Cleanup
                </button>
              </div>
            </Card>

            <Card className="p-5">
              <div className="text-xs font-black uppercase tracking-[0.18em] text-purple-400">
                Advisor recipients
              </div>
              <h2 className="mt-2 text-2xl font-black">Delivery visibility</h2>

              <div className="mt-5 grid gap-3">
                {firmRecipients.length ? (
                  firmRecipients.map((recipient) => (
                    <Panel key={recipient.userId} tone="purple" className="bg-black/35">
                      <div className="truncate text-sm font-black">{recipient.name}</div>
                      <div className="mt-1 truncate text-xs font-semibold text-slate-500">{recipient.email}</div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Pill tone="slate">{recipient.role}</Pill>
                        <Pill tone="purple">{recipient.firmName}</Pill>
                      </div>
                    </Panel>
                  ))
                ) : (
                  <div className="rounded-3xl border border-dashed border-white/10 p-6 text-sm font-bold text-slate-500">
                    No firm recipients found.
                  </div>
                )}
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}