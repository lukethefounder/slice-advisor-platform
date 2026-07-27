"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";
type ViewMode = "overview" | "sources" | "trust" | "policy" | "playbooks";

type SourceConfig = {
  sourceId: string;
  name: string;
  description: string | null;
  sourceTier: string;
  category: string;
  enabled: boolean;
  minScoreToRetain: number;
  minScoreToAlert: number;
  maxItemsPerRun: number;
  cooldownMinutes: number;
  priority: number;
  lastRunAt: string | null;
};

type Policy = {
  minScoreToStore: number;
  minScoreToAlert: number;
  maxRetainedPerRun: number;
  maxRetainedDecisions: number;
  maxRetainedRuns: number;
  maxAlertEvents: number;
  readAlertRetentionDays: number;
};

const SOURCE_CAPACITY = 200;

const inputClass =
  "rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-emerald-400/40 focus:ring-2 focus:ring-emerald-500/20";

const chartColors = ["#10b981", "#06b6d4", "#a855f7", "#22c55e", "#f59e0b", "#3b82f6", "#ec4899"];

const PLAYBOOKS = [
  {
    name: "Quiet Advisor",
    tone: "cyan" as Tone,
    description: "Maximum calm. Best for client-service days when only very strong intelligence should interrupt advisors.",
    policy: {
      minScoreToStore: 65,
      minScoreToAlert: 92,
      maxRetainedPerRun: 70,
      maxRetainedDecisions: 900,
      maxRetainedRuns: 80,
      maxAlertEvents: 500,
      readAlertRetentionDays: 30,
    },
    sourcePatch: {
      minScoreToRetain: 65,
      minScoreToAlert: 92,
      cooldownMinutes: 45,
      maxItemsPerRun: 16,
    },
  },
  {
    name: "Balanced Radar",
    tone: "green" as Tone,
    description: "Best default. Scans broadly, retains useful information, and avoids excessive advisor notifications.",
    policy: {
      minScoreToStore: 55,
      minScoreToAlert: 86,
      maxRetainedPerRun: 120,
      maxRetainedDecisions: 1500,
      maxRetainedRuns: 120,
      maxAlertEvents: 1000,
      readAlertRetentionDays: 45,
    },
    sourcePatch: {
      minScoreToRetain: 58,
      minScoreToAlert: 88,
      cooldownMinutes: 25,
      maxItemsPerRun: 24,
    },
  },
  {
    name: "Fast Market Desk",
    tone: "red" as Tone,
    description: "More aggressive. Best for active monitoring when speed matters and the advisor wants more surfaced opportunities.",
    policy: {
      minScoreToStore: 45,
      minScoreToAlert: 78,
      maxRetainedPerRun: 180,
      maxRetainedDecisions: 2400,
      maxRetainedRuns: 160,
      maxAlertEvents: 1600,
      readAlertRetentionDays: 60,
    },
    sourcePatch: {
      minScoreToRetain: 50,
      minScoreToAlert: 82,
      cooldownMinutes: 10,
      maxItemsPerRun: 36,
    },
  },
];

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Number.isFinite(value) ? Math.round(value) : min));
}

function sourceTrustScore(tier: string) {
  if (tier === "official-regulatory") return 96;
  if (tier === "official-exchange") return 94;
  if (tier === "macro-source") return 88;
  if (tier === "market-news") return 72;
  if (tier === "crypto-source") return 62;
  if (tier === "venture-source") return 60;
  return 42;
}

function trustBand(score: number) {
  if (score >= 90) return "Primary";
  if (score >= 80) return "High";
  if (score >= 70) return "Standard";
  if (score >= 60) return "Specialized";
  return "Verify";
}

function toneForTrust(score: number): Tone {
  if (score >= 90) return "green";
  if (score >= 80) return "cyan";
  if (score >= 70) return "amber";
  if (score >= 60) return "purple";
  return "red";
}

function scoreTone(score: number): Tone {
  if (score >= 90) return "green";
  if (score >= 75) return "amber";
  if (score >= 55) return "cyan";
  return "red";
}

function categoryTone(category: string): Tone {
  const lower = category.toLowerCase();

  if (lower.includes("market") || lower.includes("equity")) return "red";
  if (lower.includes("macro") || lower.includes("rates")) return "purple";
  if (lower.includes("reg") || lower.includes("filing")) return "amber";
  if (lower.includes("crypto")) return "cyan";
  if (lower.includes("official") || lower.includes("exchange")) return "green";

  return "slate";
}

function shortDateTime(value: string | null) {
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

function relativeTime(value: string | null) {
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

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const tones: Record<Tone, string> = {
    red: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
  };

  return (
    <span className={cx("inline-flex max-w-full items-center rounded-full px-3 py-1 text-[10px] font-black uppercase tracking-[0.14em] ring-1", tones[tone])}>
      <span className="truncate">{children}</span>
    </span>
  );
}

function Card({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx("relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-xl shadow-emerald-950/20 backdrop-blur-xl", className)}>
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
    red: "from-emerald-500/16",
    green: "from-emerald-500/16",
    amber: "from-amber-500/16",
    purple: "from-purple-500/16",
    cyan: "from-cyan-500/16",
    slate: "from-slate-400/8",
  };

  return (
    <div className={cx("relative overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.052] p-4 shadow-lg shadow-black/10", className)}>
      <div className={cx("pointer-events-none absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">{children}</div>
    </div>
  );
}

function Metric({
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
    red: "from-emerald-500/18",
    green: "from-emerald-500/18",
    amber: "from-amber-500/18",
    purple: "from-purple-500/18",
    cyan: "from-cyan-500/18",
    slate: "from-slate-400/10",
  };

  return (
    <div className="relative min-h-[112px] overflow-hidden rounded-[1.5rem] border border-white/10 bg-white/[0.055] p-4">
      <div className={cx("absolute inset-x-0 top-0 h-20 bg-gradient-to-b to-transparent", glows[tone])} />
      <div className="relative">
        <div className="truncate text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
          {label}
        </div>
        <div className="mt-2 truncate text-2xl font-black text-white">{value}</div>
        {helper ? <div className="mt-1 truncate text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function ProgressBar({
  value,
  tone = "cyan",
}: {
  value: number;
  tone?: Tone;
}) {
  const colors: Record<Tone, string> = {
    red: "from-emerald-500 to-emerald-800",
    green: "from-emerald-400 to-emerald-700",
    amber: "from-amber-400 to-amber-700",
    purple: "from-purple-400 to-purple-800",
    cyan: "from-cyan-400 to-cyan-700",
    slate: "from-slate-400 to-slate-700",
  };

  return (
    <div className="h-2 overflow-hidden rounded-full bg-white/10">
      <div
        className={cx("h-full rounded-full bg-gradient-to-r transition-all", colors[tone])}
        style={{ width: `${clamp(value, 0, 100)}%` }}
      />
    </div>
  );
}

function CustomTooltip({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-2xl border border-white/10 bg-zinc-950/95 p-3 text-xs text-white shadow-xl shadow-black/40">
      <div className="mb-2 font-black text-slate-200">{label}</div>
      <div className="grid gap-1">
        {payload.map((item: any, index: number) => (
          <div key={`${item.dataKey}-${index}`} className="flex items-center justify-between gap-5">
            <span className="text-slate-400">{item.name || item.dataKey}</span>
            <span className="font-black text-white">
              {typeof item.value === "number" ? item.value.toLocaleString() : item.value}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function IntelligenceSettingsPage() {
  const [sources, setSources] = useState<SourceConfig[]>([]);
  const [policy, setPolicy] = useState<Policy | null>(null);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [view, setView] = useState<ViewMode>("overview");
  const [query, setQuery] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("All");
  const [stateFilter, setStateFilter] = useState("All");
  const [trustFilter, setTrustFilter] = useState("All");
  const [selectedSourceId, setSelectedSourceId] = useState("");

  const categories = useMemo(() => {
    return ["All", ...Array.from(new Set(sources.map((source) => source.category))).sort()];
  }, [sources]);

  const enrichedSources = useMemo(() => {
    return sources.map((source) => {
      const trustScore = sourceTrustScore(source.sourceTier);
      return {
        ...source,
        trustScore,
        trustBand: trustBand(trustScore),
        effectiveStrictness: Math.round((source.minScoreToRetain + source.minScoreToAlert + trustScore) / 3),
        needsConfirmation: trustScore < 65,
      };
    });
  }, [sources]);

  const filteredSources = useMemo(() => {
    const search = query.trim().toLowerCase();

    return enrichedSources.filter((source) => {
      const searchMatch =
        !search ||
        source.name.toLowerCase().includes(search) ||
        source.description?.toLowerCase().includes(search) ||
        source.category.toLowerCase().includes(search) ||
        source.sourceTier.toLowerCase().includes(search) ||
        source.sourceId.toLowerCase().includes(search);

      const categoryMatch = categoryFilter === "All" || source.category === categoryFilter;

      const stateMatch =
        stateFilter === "All" ||
        (stateFilter === "Enabled" && source.enabled) ||
        (stateFilter === "Disabled" && !source.enabled) ||
        (stateFilter === "Strict" && source.minScoreToAlert >= 92) ||
        (stateFilter === "Fast" && source.minScoreToAlert < 85);

      const trustMatch =
        trustFilter === "All" ||
        source.trustBand === trustFilter ||
        (trustFilter === "Needs Confirmation" && source.needsConfirmation);

      return searchMatch && categoryMatch && stateMatch && trustMatch;
    });
  }, [enrichedSources, query, categoryFilter, stateFilter, trustFilter]);

  const selectedSource =
    filteredSources.find((source) => source.sourceId === selectedSourceId) ??
    filteredSources[0] ??
    null;

  const metrics = useMemo(() => {
    const enabled = enrichedSources.filter((source) => source.enabled);
    const avgStore = enabled.length
      ? Math.round(enabled.reduce((sum, source) => sum + source.minScoreToRetain, 0) / enabled.length)
      : 0;
    const avgAlert = enabled.length
      ? Math.round(enabled.reduce((sum, source) => sum + source.minScoreToAlert, 0) / enabled.length)
      : 0;
    const avgTrust = enabled.length
      ? Math.round(enabled.reduce((sum, source) => sum + source.trustScore, 0) / enabled.length)
      : 0;

    return {
      total: enrichedSources.length,
      enabled: enabled.length,
      disabled: enrichedSources.length - enabled.length,
      capacityUsed: Math.round((enrichedSources.length / SOURCE_CAPACITY) * 100),
      avgStore,
      avgAlert,
      avgTrust,
      primary: enabled.filter((source) => source.trustScore >= 90).length,
      corroborationRequired: enabled.filter((source) => source.needsConfirmation).length,
      categories: new Set(enrichedSources.map((source) => source.category)).size,
      maxItemsPerRun: enabled.reduce((sum, source) => sum + source.maxItemsPerRun, 0),
    };
  }, [enrichedSources]);

  const trustChartData = useMemo(() => {
    const map = new Map<string, number>();
    enrichedSources.forEach((source) => {
      map.set(source.trustBand, (map.get(source.trustBand) ?? 0) + 1);
    });
    return Array.from(map.entries()).map(([band, count]) => ({ band, count }));
  }, [enrichedSources]);

  const thresholdChartData = useMemo(() => {
    return filteredSources.slice(0, 16).map((source) => ({
      name: source.name.length > 20 ? `${source.name.slice(0, 20)}...` : source.name,
      store: source.minScoreToRetain,
      alert: source.minScoreToAlert,
      trust: source.trustScore,
    }));
  }, [filteredSources]);

  const categoryChartData = useMemo(() => {
    const map = new Map<string, number>();
    enrichedSources.forEach((source) => {
      map.set(source.category, (map.get(source.category) ?? 0) + 1);
    });
    return Array.from(map.entries())
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 12);
  }, [enrichedSources]);

  const policyChartData = useMemo(() => {
    if (!policy) return [];
    return [
      { label: "Store", value: policy.minScoreToStore },
      { label: "Alert", value: policy.minScoreToAlert },
      { label: "Run cap", value: Math.min(100, policy.maxRetainedPerRun) },
      { label: "Decision cap", value: Math.min(100, policy.maxRetainedDecisions / 25) },
      { label: "Alert cap", value: Math.min(100, policy.maxAlertEvents / 20) },
      { label: "Read days", value: Math.min(100, policy.readAlertRetentionDays) },
    ];
  }, [policy]);

  async function loadSettings() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/intelligence/settings", {
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error ?? "Unable to load intelligence settings.");
        return;
      }

      setSources(data.sources ?? []);
      setPolicy(data.policy ?? null);

      if (!selectedSourceId && data.sources?.[0]) {
        setSelectedSourceId(data.sources[0].sourceId);
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Unable to load intelligence settings.");
    } finally {
      setLoading(false);
    }
  }

  async function patchSource(source: SourceConfig, patch: Partial<SourceConfig>, successMessage = "Source updated.") {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/intelligence/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "update-intelligence-source",
        },
        body: JSON.stringify({
          kind: "source",
          sourceId: source.sourceId,
          ...patch,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error ?? "Source update failed.");
        return;
      }

      setMessage(successMessage);
      await loadSettings();
      setSelectedSourceId(source.sourceId);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Source update failed.");
    } finally {
      setLoading(false);
    }
  }

  async function updateSourceValue(
    source: SourceConfig,
    field: "minScoreToRetain" | "minScoreToAlert" | "maxItemsPerRun" | "cooldownMinutes",
    value: number
  ) {
    const clamped =
      field === "minScoreToRetain" || field === "minScoreToAlert"
        ? clamp(value, 0, 100)
        : field === "maxItemsPerRun"
          ? clamp(value, 1, 100)
          : clamp(value, 0, 720);

    await patchSource(source, { [field]: clamped }, `${source.name} updated.`);
  }

  async function updatePolicy() {
    if (!policy) return;

    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/intelligence/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "update-intelligence-policy",
        },
        body: JSON.stringify({
          kind: "policy",
          ...policy,
        }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error ?? "Policy update failed.");
        return;
      }

      setMessage("Intelligence policy saved.");
      await loadSettings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Policy update failed.");
    } finally {
      setLoading(false);
    }
  }

  async function cleanup() {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/intelligence/cleanup", {
        method: "POST",
        headers: {
          "x-slice-sensitive-action": "intelligence-cleanup",
        },
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error ?? "Cleanup failed.");
        return;
      }

      setMessage(`Cleanup complete: ${JSON.stringify(data.result)}`);
      await loadSettings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Cleanup failed.");
    } finally {
      setLoading(false);
    }
  }

  async function bulkSetEnabled(enabled: boolean) {
    setLoading(true);
    setMessage("");

    try {
      await Promise.all(
        filteredSources.map((source) =>
          fetch("/api/intelligence/settings", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-slice-sensitive-action": "bulk-update-intelligence-sources",
            },
            body: JSON.stringify({
              kind: "source",
              sourceId: source.sourceId,
              enabled,
            }),
          })
        )
      );

      setMessage(enabled ? "Filtered sources enabled." : "Filtered sources disabled.");
      await loadSettings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Bulk source update failed.");
    } finally {
      setLoading(false);
    }
  }

  async function applyPlaybook(playbook: (typeof PLAYBOOKS)[number]) {
    setLoading(true);
    setMessage("");

    try {
      const policyResponse = await fetch("/api/intelligence/settings", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "apply-intelligence-playbook",
        },
        body: JSON.stringify({
          kind: "policy",
          ...playbook.policy,
        }),
      });

      if (!policyResponse.ok) {
        const data = await policyResponse.json().catch(() => ({}));
        setMessage(data.error ?? "Could not apply policy playbook.");
        return;
      }

      await Promise.all(
        enrichedSources.map((source) => {
          const trustAdjustment =
            source.trustScore >= 90
              ? -4
              : source.trustScore >= 70
                ? 0
                : 5;

          return fetch("/api/intelligence/settings", {
            method: "PATCH",
            headers: {
              "Content-Type": "application/json",
              "x-slice-sensitive-action": "apply-intelligence-source-playbook",
            },
            body: JSON.stringify({
              kind: "source",
              sourceId: source.sourceId,
              minScoreToRetain: clamp(playbook.sourcePatch.minScoreToRetain + trustAdjustment, 0, 100),
              minScoreToAlert: clamp(playbook.sourcePatch.minScoreToAlert + trustAdjustment, 0, 100),
              cooldownMinutes: playbook.sourcePatch.cooldownMinutes,
              maxItemsPerRun: playbook.sourcePatch.maxItemsPerRun,
            }),
          });
        })
      );

      setMessage(`${playbook.name} playbook applied with trust-adjusted source thresholds.`);
      await loadSettings();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not apply playbook.");
    } finally {
      setLoading(false);
    }
  }

  function setPolicyField(key: keyof Policy, value: number) {
    setPolicy((current) =>
      current
        ? {
            ...current,
            [key]: value,
          }
        : current
    );
  }

  useEffect(() => {
    void loadSettings();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(6,78,59,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.18),_transparent_28%),linear-gradient(135deg,_#020617,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1900px] gap-5">
        <header className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-zinc-950/78 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(16,185,129,0.28),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(6,182,212,0.16),transparent_26%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="red">200-source radar</Pill>
                <Pill tone="cyan">Cross-source verification</Pill>
                <Pill tone="green">{metrics.enabled} enabled</Pill>
                <Pill tone="amber">{metrics.corroborationRequired} require confirmation</Pill>
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
                Intelligence settings for nonstop advisor radar.
              </h1>

              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
                Slice can now manage a much larger source universe while protecting automatic updates
                with trust scoring, corroboration checks, lower-trust confirmation gates, and per-source
                thresholds. The system is designed to scan broadly, retain intelligently, and only notify
                advisors when the evidence clears the right standard.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20 transition hover:scale-[1.01]"
              >
                ← Workspace
              </a>

              <a
                href="/notifications"
                className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-500/20"
              >
                Notification Center
              </a>

              <a
                href="/triage"
                className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white hover:bg-white/10"
              >
                Triage
              </a>

              <button
                type="button"
                onClick={cleanup}
                disabled={loading}
                className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-sm font-black text-emerald-100 hover:bg-emerald-500/20 disabled:opacity-50"
              >
                Run Cleanup
              </button>

              <button
                type="button"
                onClick={() => void loadSettings()}
                disabled={loading}
                className="rounded-2xl bg-gradient-to-r from-emerald-600 via-emerald-700 to-emerald-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-emerald-950/40 disabled:opacity-50"
              >
                Refresh
              </button>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Metric label="Sources" value={`${metrics.total}/${SOURCE_CAPACITY}`} helper={`${metrics.capacityUsed}% capacity`} tone="cyan" />
            <Metric label="Enabled" value={metrics.enabled} helper={`${metrics.disabled} disabled`} tone="green" />
            <Metric label="Avg Trust" value={metrics.avgTrust} helper="Enabled sources" tone={toneForTrust(metrics.avgTrust)} />
            <Metric label="Avg Alert" value={metrics.avgAlert} helper="Notification gate" tone={scoreTone(metrics.avgAlert)} />
            <Metric label="Confirm Gates" value={metrics.corroborationRequired} helper="Lower-trust active feeds" tone={metrics.corroborationRequired ? "amber" : "green"} />
            <Metric label="Run Capacity" value={metrics.maxItemsPerRun} helper="Possible fetched items" tone="purple" />
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 text-sm font-bold text-emerald-100">
            {message}
          </div>
        ) : null}

        <Card className="p-3">
          <div className="grid gap-2 md:grid-cols-5">
            {[
              ["overview", "Overview", "Radar health", "cyan"],
              ["sources", "Sources", "Manage 200 feeds", "purple"],
              ["trust", "Trust Engine", "Verification rules", "amber"],
              ["policy", "Policy", "Global thresholds", "red"],
              ["playbooks", "Playbooks", "One-click modes", "green"],
            ].map(([key, label, helper, tone]) => (
              <button
                key={key}
                type="button"
                onClick={() => setView(key as ViewMode)}
                className={cx(
                  "rounded-2xl px-4 py-3 text-left transition",
                  view === key
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
                        ? "bg-emerald-400"
                        : tone === "cyan"
                          ? "bg-cyan-400"
                          : tone === "purple"
                            ? "bg-purple-400"
                            : tone === "amber"
                              ? "bg-amber-400"
                              : "bg-emerald-400"
                    )}
                  />
                </div>
                <div className={cx("mt-1 text-[10px] font-bold", view === key ? "text-slate-500" : "text-slate-500")}>
                  {helper}
                </div>
              </button>
            ))}
          </div>
        </Card>

        {view === "overview" ? (
          <section className="grid gap-5 xl:grid-cols-[1.08fr_0.92fr]">
            <Card>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                    Radar Overview
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    Source scale, trust mix, and alert pressure
                  </h2>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                    This shows whether the platform is tuned for broad nonstop scanning, strict advisor notifications,
                    or rapid market-desk style surfacing.
                  </p>
                </div>

                <Pill tone={metrics.avgAlert >= 90 ? "green" : metrics.avgAlert >= 80 ? "amber" : "red"}>
                  {metrics.avgAlert >= 90 ? "Quiet" : metrics.avgAlert >= 80 ? "Balanced" : "Fast"}
                </Pill>
              </div>

              <div className="mt-5 grid gap-5 2xl:grid-cols-2">
                <Panel className="min-h-[360px] bg-black/30" tone="cyan">
                  <div className="text-lg font-black text-white">Trust distribution</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Lower-trust sources are still useful, but they must clear confirmation gates before automatic advisor updates.
                  </p>

                  <div className="mt-4 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Pie data={trustChartData} dataKey="count" nameKey="band" innerRadius={58} outerRadius={95} paddingAngle={4}>
                          {trustChartData.map((entry, index) => (
                            <Cell key={entry.band} fill={chartColors[index % chartColors.length]} />
                          ))}
                        </Pie>
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel className="min-h-[360px] bg-black/30" tone="red">
                  <div className="text-lg font-black text-white">Thresholds by source</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Store score controls retention. Alert score controls advisor interruption.
                  </p>

                  <div className="mt-4 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={thresholdChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="name" stroke="#64748b" fontSize={11} minTickGap={12} />
                        <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Legend />
                        <Bar dataKey="trust" name="Trust" fill="#22c55e" radius={[8, 8, 0, 0]} />
                        <Bar dataKey="alert" name="Alert" fill="#10b981" radius={[8, 8, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel className="min-h-[360px] bg-black/30" tone="purple">
                  <div className="text-lg font-black text-white">Top categories</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    The largest coverage areas across the expanded source universe.
                  </p>

                  <div className="mt-4 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={categoryChartData} layout="vertical">
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis type="number" stroke="#64748b" fontSize={12} />
                        <YAxis dataKey="category" type="category" stroke="#64748b" fontSize={10} width={140} />
                        <Tooltip content={<CustomTooltip />} />
                        <Bar dataKey="count" name="Sources" fill="#a855f7" radius={[0, 8, 8, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>

                <Panel className="min-h-[360px] bg-black/30" tone="green">
                  <div className="text-lg font-black text-white">Global policy shape</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Normalized view of retention, alerting, and storage caps.
                  </p>

                  <div className="mt-4 h-[260px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart data={policyChartData}>
                        <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                        <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                        <Tooltip content={<CustomTooltip />} />
                        <Line type="monotone" dataKey="value" name="Policy strength" stroke="#06b6d4" strokeWidth={3} dot={{ r: 4 }} />
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </Panel>
              </div>
            </Card>

            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                Reliability Algorithm
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                How lower-trust information becomes useful safely
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Slice does not throw away lower-trust information. It stores and evaluates it with higher proof requirements.
                Automatic advisor updates require stronger scores, lower noise, and cross-source confirmation.
              </p>

              <div className="mt-5 grid gap-3">
                <Panel tone="green" className="bg-black/35">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-black text-white">Primary sources</div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        SEC, exchanges, regulators, central banks, and official macro sources can clear alerts with less outside confirmation.
                      </p>
                    </div>
                    <Pill tone="green">High trust</Pill>
                  </div>
                </Panel>

                <Panel tone="amber" className="bg-black/35">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-black text-white">Market and specialized sources</div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        Market, crypto, venture, and sector feeds receive useful scoring but face stricter alert thresholds.
                      </p>
                    </div>
                    <Pill tone="amber">Verify</Pill>
                  </div>
                </Panel>

                <Panel tone="red" className="bg-black/35">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="font-black text-white">Open-web / lower-trust feeds</div>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        These feeds can be stored and reviewed, but automatic emails are blocked unless sufficiently corroborated.
                      </p>
                    </div>
                    <Pill tone="red">Confirmation gate</Pill>
                  </div>
                </Panel>

                <Panel tone="cyan" className="bg-black/35">
                  <div className="font-black text-white">Source capacity</div>
                  <div className="mt-3 flex items-center justify-between text-xs font-bold text-slate-400">
                    <span>{metrics.total} configured</span>
                    <span>{SOURCE_CAPACITY} max</span>
                  </div>
                  <div className="mt-2">
                    <ProgressBar value={metrics.capacityUsed} tone="cyan" />
                  </div>
                </Panel>
              </div>
            </Card>
          </section>
        ) : null}

        {view === "sources" ? (
          <section className="grid gap-5 xl:grid-cols-[390px_minmax(0,1fr)_420px]">
            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                Source Controls
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                Manage up to 200 sources
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Filter, enable, disable, and adjust thresholds without searching through a giant raw list.
              </p>

              <div className="mt-5 grid gap-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search source, category, tier..."
                  className={inputClass}
                />

                <select value={categoryFilter} onChange={(event) => setCategoryFilter(event.target.value)} className={inputClass}>
                  {categories.map((category) => (
                    <option key={category}>{category}</option>
                  ))}
                </select>

                <select value={trustFilter} onChange={(event) => setTrustFilter(event.target.value)} className={inputClass}>
                  <option>All</option>
                  <option>Primary</option>
                  <option>High</option>
                  <option>Standard</option>
                  <option>Specialized</option>
                  <option>Verify</option>
                  <option>Needs Confirmation</option>
                </select>

                <select value={stateFilter} onChange={(event) => setStateFilter(event.target.value)} className={inputClass}>
                  <option>All</option>
                  <option>Enabled</option>
                  <option>Disabled</option>
                  <option>Strict</option>
                  <option>Fast</option>
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <button type="button" onClick={() => bulkSetEnabled(true)} disabled={loading || !filteredSources.length} className="rounded-2xl bg-white px-4 py-3 text-xs font-black text-slate-950 disabled:opacity-50">
                    Enable Filtered
                  </button>
                  <button type="button" onClick={() => bulkSetEnabled(false)} disabled={loading || !filteredSources.length} className="rounded-2xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs font-black text-emerald-100 disabled:opacity-50">
                    Disable Filtered
                  </button>
                </div>

                <Metric label="Visible" value={filteredSources.length} helper="Affected by bulk actions" tone="cyan" />
              </div>
            </Card>

            <Card>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                    Source List
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    Source-level controls
                  </h2>
                </div>
                <Pill tone="cyan">{filteredSources.length} visible</Pill>
              </div>

              <div className="mt-5 grid max-h-[980px] gap-3 overflow-y-auto pr-2">
                {filteredSources.map((source) => (
                  <article
                    key={source.sourceId}
                    className={cx(
                      "rounded-[1.5rem] border p-4 transition hover:bg-white/[0.07]",
                      selectedSource?.sourceId === source.sourceId
                        ? "border-cyan-400/50 bg-cyan-500/10 shadow-lg shadow-cyan-950/20"
                        : "border-white/10 bg-black/35"
                    )}
                  >
                    <button type="button" onClick={() => setSelectedSourceId(source.sourceId)} className="w-full text-left">
                      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Pill tone={source.enabled ? "green" : "slate"}>
                              {source.enabled ? "Enabled" : "Disabled"}
                            </Pill>
                            <Pill tone={categoryTone(source.category)}>{source.category}</Pill>
                            <Pill tone={toneForTrust(source.trustScore)}>{source.trustBand}</Pill>
                            {source.needsConfirmation ? <Pill tone="red">Confirm</Pill> : null}
                          </div>

                          <h3 className="mt-3 text-xl font-black text-white">{source.name}</h3>
                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                            {source.description || "No source description yet."}
                          </p>
                        </div>

                        <div className="grid min-w-[210px] grid-cols-3 gap-2 text-center">
                          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Trust</div>
                            <div className="text-xl font-black text-white">{source.trustScore}</div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Store</div>
                            <div className="text-xl font-black text-white">{source.minScoreToRetain}</div>
                          </div>
                          <div className="rounded-2xl border border-white/10 bg-white/[0.04] p-3">
                            <div className="text-[10px] font-black uppercase tracking-[0.14em] text-slate-500">Alert</div>
                            <div className="text-xl font-black text-white">{source.minScoreToAlert}</div>
                          </div>
                        </div>
                      </div>
                    </button>

                    <div className="mt-4 grid gap-3 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => patchSource(source, { enabled: !source.enabled }, source.enabled ? `${source.name} disabled.` : `${source.name} enabled.`)}
                        disabled={loading}
                        className={cx(
                          "rounded-2xl px-4 py-3 text-xs font-black disabled:opacity-50",
                          source.enabled
                            ? "border border-emerald-500/30 bg-emerald-500/10 text-emerald-100"
                            : "bg-white text-slate-950"
                        )}
                      >
                        {source.enabled ? "Disable" : "Enable"}
                      </button>

                      <button type="button" onClick={() => setSelectedSourceId(source.sourceId)} className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-xs font-black text-white hover:bg-white/10">
                        Open Detail
                      </button>
                    </div>
                  </article>
                ))}

                {!filteredSources.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm font-bold text-slate-500">
                    No sources match the current filters.
                  </div>
                ) : null}
              </div>
            </Card>

            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                Source Detail
              </div>

              {selectedSource ? (
                <div className="mt-4 grid gap-4">
                  <div>
                    <div className="flex flex-wrap gap-2">
                      <Pill tone={selectedSource.enabled ? "green" : "slate"}>
                        {selectedSource.enabled ? "Enabled" : "Disabled"}
                      </Pill>
                      <Pill tone={toneForTrust(selectedSource.trustScore)}>
                        Trust {selectedSource.trustScore}
                      </Pill>
                      <Pill tone={categoryTone(selectedSource.category)}>
                        {selectedSource.category}
                      </Pill>
                    </div>

                    <h2 className="mt-4 text-2xl font-black text-white">{selectedSource.name}</h2>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {selectedSource.description || "No source description yet."}
                    </p>
                  </div>

                  <Panel tone={toneForTrust(selectedSource.trustScore)} className="bg-black/35">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-black text-white">Trust classification</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {selectedSource.needsConfirmation
                            ? "This source needs outside corroboration before automatic advisor email delivery."
                            : "This source has enough baseline trust to clear standard thresholds."}
                        </div>
                      </div>
                      <div className="text-3xl font-black text-white">{selectedSource.trustScore}</div>
                    </div>
                    <div className="mt-4">
                      <ProgressBar value={selectedSource.trustScore} tone={toneForTrust(selectedSource.trustScore)} />
                    </div>
                  </Panel>

                  <Panel tone="cyan" className="bg-black/35">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-black text-white">Store score</div>
                        <div className="mt-1 text-xs text-slate-500">Minimum score needed to retain items.</div>
                      </div>
                      <div className="text-3xl font-black text-white">{selectedSource.minScoreToRetain}</div>
                    </div>
                    <input type="range" min={0} max={100} value={selectedSource.minScoreToRetain} onChange={(event) => updateSourceValue(selectedSource, "minScoreToRetain", Number(event.target.value))} className="mt-4 w-full" />
                    <ProgressBar value={selectedSource.minScoreToRetain} tone={scoreTone(selectedSource.minScoreToRetain)} />
                  </Panel>

                  <Panel tone="red" className="bg-black/35">
                    <div className="flex items-center justify-between">
                      <div>
                        <div className="text-sm font-black text-white">Alert score</div>
                        <div className="mt-1 text-xs text-slate-500">Minimum score needed to notify advisors.</div>
                      </div>
                      <div className="text-3xl font-black text-white">{selectedSource.minScoreToAlert}</div>
                    </div>
                    <input type="range" min={0} max={100} value={selectedSource.minScoreToAlert} onChange={(event) => updateSourceValue(selectedSource, "minScoreToAlert", Number(event.target.value))} className="mt-4 w-full" />
                    <ProgressBar value={selectedSource.minScoreToAlert} tone={scoreTone(selectedSource.minScoreToAlert)} />
                  </Panel>

                  <div className="grid gap-3 md:grid-cols-2">
                    <label>
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Max items per run</span>
                      <input type="number" value={selectedSource.maxItemsPerRun} onChange={(event) => updateSourceValue(selectedSource, "maxItemsPerRun", Number(event.target.value))} className={cx(inputClass, "mt-2 w-full")} />
                    </label>

                    <label>
                      <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">Cooldown minutes</span>
                      <input type="number" value={selectedSource.cooldownMinutes} onChange={(event) => updateSourceValue(selectedSource, "cooldownMinutes", Number(event.target.value))} className={cx(inputClass, "mt-2 w-full")} />
                    </label>
                  </div>

                  <Panel tone="slate" className="bg-black/35">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">Last run</div>
                    <div className="mt-2 text-sm font-black text-white">{shortDateTime(selectedSource.lastRunAt)}</div>
                    <div className="mt-1 text-xs text-slate-500">{relativeTime(selectedSource.lastRunAt)}</div>
                  </Panel>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm font-bold text-slate-500">
                  Select a source to edit.
                </div>
              )}
            </Card>
          </section>
        ) : null}

        {view === "trust" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-amber-400">
                Trust Engine
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                Lower-trust information is useful, but not equal.
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                The scanner annotates every headline with source trust, corroborating source count,
                strongest corroborator trust, and confirmation status. The grading engine then blocks
                automatic email delivery for lower-trust items unless the evidence is strong enough.
              </p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                {[
                  ["Primary", "Official regulatory, exchange, and official macro feeds. These can clear alerts with less outside confirmation.", "green"],
                  ["High", "Macro and high-quality institutional sources. Strong for context and advisor research.", "cyan"],
                  ["Standard", "Market news sources. Useful, but still scored against client relevance and alert thresholds.", "amber"],
                  ["Specialized", "Crypto, venture, niche sectors, and specialized feeds. Higher confirmation burden.", "purple"],
                  ["Verify", "Open-web and aggregator feeds. Retain and learn from them, but require corroboration before automatic advisor emails.", "red"],
                ].map(([band, description, tone]) => (
                  <Panel key={band} tone={tone as Tone} className="bg-black/35">
                    <Pill tone={tone as Tone}>{band}</Pill>
                    <p className="mt-3 text-sm leading-6 text-slate-400">{description}</p>
                  </Panel>
                ))}
              </div>
            </Card>

            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                Automatic Update Rules
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                Email reliability gate
              </h2>

              <div className="mt-5 grid gap-3">
                <Panel tone="green" className="bg-black/35">
                  <div className="font-black text-white">Allowed automatically</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    High score + high confidence + trusted source or confirmed by multiple independent sources.
                  </p>
                </Panel>

                <Panel tone="amber" className="bg-black/35">
                  <div className="font-black text-white">Queued for review</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Useful but moderate confidence, single-source market news, or not enough client relevance.
                  </p>
                </Panel>

                <Panel tone="red" className="bg-black/35">
                  <div className="font-black text-white">Blocked from auto email</div>
                  <p className="mt-1 text-sm leading-6 text-slate-400">
                    Lower-trust or open-web source without enough corroboration, noisy language, or promotional terms.
                  </p>
                </Panel>
              </div>
            </Card>
          </section>
        ) : null}

        {view === "policy" ? (
          <section className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_430px]">
            <Card>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400">
                    Global Policy
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    Storage and alert thresholds
                  </h2>
                </div>

                <button type="button" onClick={updatePolicy} disabled={loading || !policy} className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50">
                  Save Policy
                </button>
              </div>

              {policy ? (
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  {[
                    ["minScoreToStore", "Minimum score to store", "Retain fewer low-signal items by raising this value.", 0, 100, "cyan"],
                    ["minScoreToAlert", "Minimum score to alert", "Notify advisors only when intelligence clears this level.", 0, 100, "red"],
                    ["maxRetainedPerRun", "Max retained per run", "Maximum intelligence items retained from one scan.", 10, 250, "purple"],
                    ["maxRetainedDecisions", "Max retained decisions", "Total stored decision history cap.", 100, 3000, "amber"],
                    ["maxRetainedRuns", "Max retained runs", "Total scan-run history cap.", 20, 250, "green"],
                    ["maxAlertEvents", "Max alert events", "Total alert event retention cap.", 100, 2500, "red"],
                    ["readAlertRetentionDays", "Read alert retention days", "How long read alerts stay before cleanup.", 1, 180, "slate"],
                  ].map(([key, label, helper, min, max, tone]) => {
                    const typedKey = key as keyof Policy;
                    const minValue = Number(min);
                    const maxValue = Number(max);
                    const value = policy[typedKey];

                    return (
                      <Panel key={key as string} tone={tone as Tone} className="bg-black/35">
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="text-lg font-black text-white">{label}</div>
                            <p className="mt-1 text-xs leading-5 text-slate-500">{helper}</p>
                          </div>
                          <div className="text-3xl font-black text-white">{value}</div>
                        </div>

                        <input
                          type="range"
                          min={minValue}
                          max={maxValue}
                          value={value}
                          onChange={(event) => setPolicyField(typedKey, Number(event.target.value))}
                          className="mt-4 w-full"
                        />

                        <div className="mt-3 grid grid-cols-[1fr_110px] gap-3">
                          <ProgressBar value={((value - minValue) / (maxValue - minValue)) * 100} tone={tone as Tone} />
                          <input
                            type="number"
                            value={value}
                            onChange={(event) => setPolicyField(typedKey, Number(event.target.value))}
                            className="rounded-xl border border-white/10 bg-black/45 px-3 py-2 text-sm font-black text-white outline-none"
                          />
                        </div>
                      </Panel>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 rounded-2xl border border-dashed border-white/10 p-8 text-center text-sm font-bold text-slate-500">
                  Loading policy...
                </div>
              )}
            </Card>

            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                Policy Shape
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                Visual summary
              </h2>
              <div className="mt-5 h-[320px]">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={policyChartData}>
                    <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.08)" />
                    <XAxis dataKey="label" stroke="#64748b" fontSize={12} />
                    <YAxis stroke="#64748b" fontSize={12} domain={[0, 100]} />
                    <Tooltip content={<CustomTooltip />} />
                    <Bar dataKey="value" name="Policy strength" fill="#10b981" radius={[8, 8, 0, 0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </Card>
          </section>
        ) : null}

        {view === "playbooks" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_430px]">
            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-green-400">
                Playbooks
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                One-click operating modes
              </h2>
              <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                Playbooks adjust the global policy and then trust-adjust all source thresholds. Lower-trust
                sources remain stricter even in fast mode.
              </p>

              <div className="mt-5 grid gap-4 lg:grid-cols-3">
                {PLAYBOOKS.map((playbook) => (
                  <Panel key={playbook.name} tone={playbook.tone} className="bg-black/35">
                    <Pill tone={playbook.tone}>{playbook.name}</Pill>
                    <h3 className="mt-4 text-xl font-black text-white">{playbook.name}</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{playbook.description}</p>

                    <div className="mt-4 grid gap-2">
                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-xs">
                        <span className="font-bold text-slate-400">Store</span>
                        <span className="font-black text-white">{playbook.policy.minScoreToStore}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-xs">
                        <span className="font-bold text-slate-400">Alert</span>
                        <span className="font-black text-white">{playbook.policy.minScoreToAlert}</span>
                      </div>
                      <div className="flex items-center justify-between rounded-2xl border border-white/10 bg-black/35 px-3 py-2 text-xs">
                        <span className="font-bold text-slate-400">Cooldown</span>
                        <span className="font-black text-white">{playbook.sourcePatch.cooldownMinutes}m</span>
                      </div>
                    </div>

                    <button type="button" onClick={() => applyPlaybook(playbook)} disabled={loading} className="mt-5 w-full rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 disabled:opacity-50">
                      Apply Playbook
                    </button>
                  </Panel>
                ))}
              </div>
            </Card>

            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                Best Use
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                Recommended mode
              </h2>

              <div className="mt-5 grid gap-3">
                <Panel tone="cyan" className="bg-black/35">
                  <div className="text-sm font-black text-white">Quiet Advisor</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Fewer alerts. Best for service-heavy days.
                  </p>
                </Panel>
                <Panel tone="green" className="bg-black/35">
                  <div className="text-sm font-black text-white">Balanced Radar</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Best default for a wealth management operating platform.
                  </p>
                </Panel>
                <Panel tone="red" className="bg-black/35">
                  <div className="text-sm font-black text-white">Fast Market Desk</div>
                  <p className="mt-1 text-xs leading-5 text-slate-500">
                    Best when market speed matters and you want more opportunities surfaced.
                  </p>
                </Panel>
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}