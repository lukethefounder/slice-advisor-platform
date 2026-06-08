"use client";

import { useEffect, useMemo, useState, type ReactNode } from "react";

type Tone = "red" | "green" | "amber" | "purple" | "cyan" | "slate";

type Preference = {
  id: string;
  channel: string;
  enabled: boolean;
  minUrgency: string;
  minScore: number;
  digestOnly: boolean;
  quietHoursStart: string | null;
  quietHoursEnd: string | null;
  cooldownMinutes: number;
};

type Delivery = {
  id: string;
  channel: string;
  destination?: string | null;
  status: string;
  urgency: string;
  score: number;
  title: string;
  body: string;
  reason: string | null;
  simulated?: boolean;
  createdAt: string;
  deliveredAt: string | null;
};

type Digest = {
  id: string;
  title: string;
  summary: string;
  itemCount: number;
  urgencyMixJson: string;
  itemsJson: string;
  status: string;
  createdAt: string;
};

type NotificationCenterPayload = {
  preferences: Preference[];
  deliveries: Delivery[];
  digests: Digest[];
  metrics?: {
    totalDeliveries: number;
    delivered: number;
    queued: number;
    failed: number;
    suppressed: number;
    reviewed: number;
    archived: number;
    critical: number;
    high: number;
    email: number;
    dashboard: number;
    digests: number;
    activeChannels: number;
  };
};

type ViewMode = "deliveries" | "preferences" | "digests" | "command";

const EMPTY_PAYLOAD: NotificationCenterPayload = {
  preferences: [],
  deliveries: [],
  digests: [],
  metrics: {
    totalDeliveries: 0,
    delivered: 0,
    queued: 0,
    failed: 0,
    suppressed: 0,
    reviewed: 0,
    archived: 0,
    critical: 0,
    high: 0,
    email: 0,
    dashboard: 0,
    digests: 0,
    activeChannels: 0,
  },
};

const inputClass =
  "rounded-2xl border border-white/10 bg-black/45 px-4 py-3 text-sm font-semibold text-white outline-none placeholder:text-slate-600 focus:border-red-400/40 focus:ring-2 focus:ring-red-500/20";

function cx(...classes: Array<string | false | null | undefined>) {
  return classes.filter(Boolean).join(" ");
}

function parseJson<T>(value: string | null | undefined, fallback: T): T {
  if (!value) return fallback;

  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function formatDateTime(value: string | null | undefined) {
  if (!value) return "Not delivered";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return value;

  return date.toLocaleString("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function relativeTime(value: string | null | undefined) {
  if (!value) return "—";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) return "—";

  const diffMs = Date.now() - date.getTime();
  const diffMinutes = Math.round(diffMs / 60000);

  if (diffMinutes < 1) return "Just now";
  if (diffMinutes < 60) return `${diffMinutes}m ago`;

  const diffHours = Math.round(diffMinutes / 60);

  if (diffHours < 24) return `${diffHours}h ago`;

  const diffDays = Math.round(diffHours / 24);

  return `${diffDays}d ago`;
}

function statusTone(status: string): Tone {
  const lower = status.toLowerCase();

  if (lower.includes("delivered")) return "green";
  if (lower.includes("queued")) return "amber";
  if (lower.includes("reviewed")) return "cyan";
  if (lower.includes("suppressed")) return "slate";
  if (lower.includes("archived")) return "slate";
  if (lower.includes("failed")) return "red";

  return "red";
}

function urgencyTone(urgency: string): Tone {
  const lower = urgency.toLowerCase();

  if (lower.includes("critical")) return "red";
  if (lower.includes("high")) return "amber";
  if (lower.includes("medium")) return "green";

  return "slate";
}

function scoreTone(score: number): Tone {
  if (score >= 90) return "red";
  if (score >= 75) return "amber";
  if (score >= 55) return "cyan";
  return "slate";
}

function channelTone(channel: string): Tone {
  const lower = channel.toLowerCase();

  if (lower.includes("email")) return "green";
  if (lower.includes("dashboard")) return "cyan";
  if (lower.includes("sms")) return "red";
  if (lower.includes("push")) return "purple";
  if (lower.includes("digest")) return "amber";

  return "slate";
}

function urgencyRank(value: string) {
  const order: Record<string, number> = {
    Low: 1,
    Medium: 2,
    High: 3,
    Critical: 4,
  };

  return order[value] ?? 0;
}

function Pill({
  children,
  tone = "slate",
}: {
  children: ReactNode;
  tone?: Tone;
}) {
  const tones: Record<Tone, string> = {
    red: "bg-red-500/10 text-red-300 ring-red-500/30",
    green: "bg-emerald-500/10 text-emerald-300 ring-emerald-500/30",
    amber: "bg-amber-500/10 text-amber-300 ring-amber-500/30",
    purple: "bg-purple-500/10 text-purple-300 ring-purple-500/30",
    cyan: "bg-cyan-500/10 text-cyan-300 ring-cyan-500/30",
    slate: "bg-slate-500/10 text-slate-300 ring-slate-500/30",
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
        "relative overflow-hidden rounded-[2rem] border border-white/10 bg-zinc-950/78 p-5 shadow-xl shadow-red-950/20 backdrop-blur-xl",
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
    red: "from-red-500/18",
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
        <div className="mt-2 truncate text-2xl font-black text-white">
          {value}
        </div>
        {helper ? <div className="mt-1 truncate text-xs text-slate-500">{helper}</div> : null}
      </div>
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const tone = scoreTone(score);
  const border =
    tone === "red"
      ? "border-red-500/40 bg-red-500/10 text-red-100"
      : tone === "amber"
        ? "border-amber-500/40 bg-amber-500/10 text-amber-100"
        : tone === "cyan"
          ? "border-cyan-500/40 bg-cyan-500/10 text-cyan-100"
          : "border-slate-500/30 bg-slate-500/10 text-slate-100";

  return (
    <div className={cx("grid h-16 w-16 shrink-0 place-items-center rounded-2xl border text-center shadow-lg", border)}>
      <div>
        <div className="text-[9px] font-black uppercase tracking-[0.14em] opacity-70">Score</div>
        <div className="text-2xl font-black leading-none">{score}</div>
      </div>
    </div>
  );
}

export default function NotificationsPage() {
  const [payload, setPayload] = useState<NotificationCenterPayload>(EMPTY_PAYLOAD);
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const [view, setView] = useState<ViewMode>("deliveries");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("Active");
  const [channelFilter, setChannelFilter] = useState("All");
  const [urgencyFilter, setUrgencyFilter] = useState("All");
  const [selectedDeliveryId, setSelectedDeliveryId] = useState("");
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

  const preferences = payload.preferences ?? [];
  const deliveries = payload.deliveries ?? [];
  const digests = payload.digests ?? [];
  const metrics = payload.metrics ?? EMPTY_PAYLOAD.metrics!;

  const channels = useMemo(() => {
    return ["All", ...Array.from(new Set(deliveries.map((item) => item.channel))).sort()];
  }, [deliveries]);

  const statuses = useMemo(() => {
    return ["Active", "All", ...Array.from(new Set(deliveries.map((item) => item.status))).sort()];
  }, [deliveries]);

  const filteredDeliveries = useMemo(() => {
    const search = query.trim().toLowerCase();

    return deliveries.filter((delivery) => {
      const activeMatch =
        statusFilter === "Active"
          ? delivery.status !== "Archived"
          : statusFilter === "All" || delivery.status === statusFilter;

      const channelMatch = channelFilter === "All" || delivery.channel === channelFilter;
      const urgencyMatch = urgencyFilter === "All" || delivery.urgency === urgencyFilter;

      const searchMatch =
        !search ||
        delivery.title.toLowerCase().includes(search) ||
        delivery.body.toLowerCase().includes(search) ||
        delivery.reason?.toLowerCase().includes(search) ||
        delivery.channel.toLowerCase().includes(search) ||
        delivery.status.toLowerCase().includes(search);

      return activeMatch && channelMatch && urgencyMatch && searchMatch;
    });
  }, [deliveries, query, statusFilter, channelFilter, urgencyFilter]);

  const selectedDelivery =
    filteredDeliveries.find((item) => item.id === selectedDeliveryId) ??
    filteredDeliveries[0] ??
    null;

  const selectedDeliveries = deliveries.filter((delivery) =>
    selectedIds.includes(delivery.id)
  );

  const digestItems = useMemo(() => {
    return digests.map((digest) => ({
      digest,
      items: parseJson<
        Array<{
          title: string;
          source: string;
          ticker: string | null;
          urgency: string;
          score: number;
        }>
      >(digest.itemsJson, []),
      urgencyMix: parseJson<Record<string, number>>(digest.urgencyMixJson, {}),
    }));
  }, [digests]);

  const channelReadiness = useMemo(() => {
    return preferences.map((preference) => {
      const channelDeliveries = deliveries.filter(
        (delivery) => delivery.channel === preference.channel
      );
      const delivered = channelDeliveries.filter(
        (delivery) => delivery.status === "Delivered"
      ).length;
      const failed = channelDeliveries.filter(
        (delivery) => delivery.status === "Failed"
      ).length;

      const health = channelDeliveries.length
        ? Math.round((delivered / channelDeliveries.length) * 100)
        : preference.enabled
          ? 100
          : 0;

      return {
        preference,
        delivered,
        failed,
        total: channelDeliveries.length,
        health,
      };
    });
  }, [preferences, deliveries]);

  async function loadData() {
    setLoading(true);

    try {
      const response = await fetch("/api/notifications", {
        cache: "no-store",
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        setMessage(data.error ?? "Unable to load notification center.");
        return;
      }

      setPayload(data);

      const firstDelivery = data.deliveries?.[0]?.id ?? "";
      if (!selectedDeliveryId && firstDelivery) {
        setSelectedDeliveryId(firstDelivery);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Unable to load notification center."
      );
    } finally {
      setLoading(false);
    }
  }

  async function runAction(
    action:
      | "queue"
      | "process"
      | "digest"
      | "archiveDelivery"
      | "archiveDeliveries"
      | "markReviewed"
      | "retryDelivery"
      | "retryDeliveries",
    options: Record<string, unknown> = {}
  ) {
    setLoading(true);
    setMessage("");

    try {
      const response = await fetch("/api/notifications", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": action,
        },
        body: JSON.stringify({
          action,
          ...options,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Notification action failed.");
        return;
      }

      if (data.center) {
        setPayload(data.center);
      } else {
        await loadData();
      }

      if (action === "archiveDelivery" || action === "archiveDeliveries") {
        setSelectedIds([]);
      }

      if (action === "queue") setMessage("Alerts queued for delivery review.");
      if (action === "process") setMessage("Queued notifications processed.");
      if (action === "digest") setMessage("Digest generated.");
      if (action === "archiveDelivery") setMessage("Delivery archived.");
      if (action === "archiveDeliveries") setMessage("Selected deliveries archived.");
      if (action === "markReviewed") setMessage("Delivery marked reviewed.");
      if (action === "retryDelivery" || action === "retryDeliveries") {
        setMessage("Delivery moved back to queue.");
      }
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Notification action failed."
      );
    } finally {
      setLoading(false);
    }
  }

  async function updatePreference(
    preference: Preference,
    patch: Partial<Preference>
  ) {
    setMessage("");

    try {
      const response = await fetch("/api/notifications", {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
          "x-slice-sensitive-action": "update-notification-preference",
        },
        body: JSON.stringify({
          channel: preference.channel,
          ...patch,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        setMessage(data.error ?? "Could not update preference.");
        return;
      }

      if (data.center) {
        setPayload(data.center);
      } else {
        await loadData();
      }

      setMessage(`${preference.channel} preference updated.`);
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "Could not update preference."
      );
    }
  }

  function toggleSelected(id: string) {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter((item) => item !== id)
        : [...current, id]
    );
  }

  function selectFiltered() {
    setSelectedIds(filteredDeliveries.map((item) => item.id));
  }

  function clearSelection() {
    setSelectedIds([]);
  }

  useEffect(() => {
    void loadData();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(127,29,29,0.42),_transparent_32%),radial-gradient(circle_at_top_right,_rgba(6,182,212,0.18),_transparent_28%),linear-gradient(135deg,_#020617,_#09090b,_#111827,_#1f0707)] p-5 text-white">
      <div className="mx-auto grid max-w-[1900px] gap-5">
        <header className="relative overflow-hidden rounded-[2.35rem] border border-white/10 bg-zinc-950/78 p-6 shadow-2xl shadow-black/30 backdrop-blur-2xl">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_20%_10%,rgba(239,68,68,0.28),transparent_30%),radial-gradient(circle_at_85%_15%,rgba(6,182,212,0.16),transparent_26%)]" />

          <div className="relative flex flex-col gap-5 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <div className="flex flex-wrap gap-2">
                <Pill tone="red">Alerts center</Pill>
                <Pill tone="cyan">Delivery cockpit</Pill>
                <Pill tone="green">{metrics.activeChannels} active channel(s)</Pill>
              </div>

              <h1 className="mt-5 text-4xl font-black tracking-tight md:text-6xl">
                Notification command center.
              </h1>

              <p className="mt-4 max-w-5xl text-sm leading-7 text-slate-400">
                A consolidated alert operating room for delivery preferences, queue processing,
                digest generation, status review, archived items, delivery failures, and advisor
                action history. Keep the signal clean, suppress noise, and quickly return to the
                main workspace when finished.
              </p>
            </div>

            <div className="flex flex-wrap gap-2">
              <a
                href="/workspace"
                className="rounded-2xl bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-lg shadow-black/20 transition hover:scale-[1.01]"
              >
                ← Workspace
              </a>

              <button
                type="button"
                onClick={() => void loadData()}
                disabled={loading}
                className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-sm font-black text-white hover:bg-white/10 disabled:opacity-50"
              >
                Refresh
              </button>

              <button
                type="button"
                onClick={() => runAction("queue")}
                disabled={loading}
                className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm font-black text-red-100 hover:bg-red-500/20 disabled:opacity-50"
              >
                Queue Alerts
              </button>

              <button
                type="button"
                onClick={() => runAction("process")}
                disabled={loading}
                className="rounded-2xl bg-gradient-to-r from-red-600 via-red-700 to-red-950 px-4 py-3 text-sm font-black text-white shadow-lg shadow-red-950/40 disabled:opacity-50"
              >
                Process Queue
              </button>

              <button
                type="button"
                onClick={() => runAction("digest")}
                disabled={loading}
                className="rounded-2xl border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm font-black text-cyan-100 hover:bg-cyan-500/20 disabled:opacity-50"
              >
                Generate Digest
              </button>
            </div>
          </div>

          <div className="relative mt-6 grid gap-3 md:grid-cols-2 xl:grid-cols-6">
            <Metric
              label="Delivered"
              value={metrics.delivered}
              helper={`${metrics.totalDeliveries} total`}
              tone="green"
            />
            <Metric
              label="Queued"
              value={metrics.queued}
              helper="Awaiting processing"
              tone={metrics.queued ? "amber" : "slate"}
            />
            <Metric
              label="Failed"
              value={metrics.failed}
              helper="Needs review"
              tone={metrics.failed ? "red" : "green"}
            />
            <Metric
              label="Critical / High"
              value={`${metrics.critical}/${metrics.high}`}
              helper="Signal intensity"
              tone={metrics.critical ? "red" : metrics.high ? "amber" : "green"}
            />
            <Metric
              label="Digests"
              value={metrics.digests}
              helper="Summaries"
              tone="purple"
            />
            <Metric
              label="Archived"
              value={metrics.archived}
              helper="Hidden from active"
              tone="slate"
            />
          </div>
        </header>

        {message ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm font-bold text-red-100">
            {message}
          </div>
        ) : null}

        <Card className="p-3">
          <div className="grid gap-2 md:grid-cols-4">
            {[
              ["deliveries", "Deliveries", "Queue + history", "red"],
              ["preferences", "Preferences", "Channels + thresholds", "cyan"],
              ["digests", "Digests", "Summaries", "purple"],
              ["command", "Command", "Health + controls", "green"],
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
                        ? "bg-red-400"
                        : tone === "cyan"
                          ? "bg-cyan-400"
                          : tone === "purple"
                            ? "bg-purple-400"
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

        {view === "deliveries" ? (
          <section className="grid gap-5 xl:grid-cols-[430px_minmax(0,1fr)_420px]">
            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-red-400">
                Filter Console
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                Find the right alert fast
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Consolidated filters keep the notification feed usable even when the platform is busy.
              </p>

              <div className="mt-5 grid gap-3">
                <input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search title, body, reason, channel, status..."
                  className={inputClass}
                />

                <div className="grid gap-2 md:grid-cols-2">
                  <select
                    value={statusFilter}
                    onChange={(event) => setStatusFilter(event.target.value)}
                    className={inputClass}
                  >
                    {statuses.map((status) => (
                      <option key={status}>{status}</option>
                    ))}
                  </select>

                  <select
                    value={channelFilter}
                    onChange={(event) => setChannelFilter(event.target.value)}
                    className={inputClass}
                  >
                    {channels.map((channel) => (
                      <option key={channel}>{channel}</option>
                    ))}
                  </select>
                </div>

                <select
                  value={urgencyFilter}
                  onChange={(event) => setUrgencyFilter(event.target.value)}
                  className={inputClass}
                >
                  <option>All</option>
                  <option>Critical</option>
                  <option>High</option>
                  <option>Medium</option>
                  <option>Low</option>
                </select>

                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={selectFiltered}
                    className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-xs font-black text-white hover:bg-white/10"
                  >
                    Select Filtered
                  </button>
                  <button
                    type="button"
                    onClick={clearSelection}
                    className="rounded-2xl border border-white/10 bg-white/[0.055] px-4 py-3 text-xs font-black text-white hover:bg-white/10"
                  >
                    Clear
                  </button>
                </div>

                <div className="rounded-2xl border border-white/10 bg-black/35 p-4">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Selected
                  </div>
                  <div className="mt-2 text-3xl font-black text-white">
                    {selectedIds.length}
                  </div>
                  <div className="mt-1 text-xs text-slate-500">
                    {filteredDeliveries.length} visible deliveries
                  </div>

                  <div className="mt-4 grid gap-2">
                    <button
                      type="button"
                      disabled={!selectedIds.length || loading}
                      onClick={() =>
                        runAction("markReviewed", {
                          deliveryIds: selectedIds,
                        })
                      }
                      className="rounded-2xl bg-white px-4 py-3 text-xs font-black text-slate-950 disabled:opacity-50"
                    >
                      Mark Reviewed
                    </button>

                    <button
                      type="button"
                      disabled={!selectedIds.length || loading}
                      onClick={() =>
                        runAction("retryDeliveries", {
                          deliveryIds: selectedIds,
                        })
                      }
                      className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-black text-amber-100 disabled:opacity-50"
                    >
                      Retry Selected
                    </button>

                    <button
                      type="button"
                      disabled={!selectedIds.length || loading}
                      onClick={() =>
                        runAction("archiveDeliveries", {
                          deliveryIds: selectedIds,
                        })
                      }
                      className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-black text-red-100 disabled:opacity-50"
                    >
                      Archive Selected
                    </button>
                  </div>
                </div>
              </div>
            </Card>

            <Card>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                    Delivery Feed
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    Active alert stream
                  </h2>
                </div>

                <Pill tone="cyan">{filteredDeliveries.length} visible</Pill>
              </div>

              <div className="mt-5 grid max-h-[920px] gap-3 overflow-y-auto pr-2">
                {filteredDeliveries.map((delivery) => {
                  const selected = selectedDelivery?.id === delivery.id;
                  const checked = selectedIds.includes(delivery.id);

                  return (
                    <article
                      key={delivery.id}
                      className={cx(
                        "rounded-[1.5rem] border p-4 transition hover:bg-white/[0.07]",
                        selected
                          ? "border-cyan-400/50 bg-cyan-500/10 shadow-lg shadow-cyan-950/20"
                          : "border-white/10 bg-black/35"
                      )}
                    >
                      <div className="flex gap-3">
                        <button
                          type="button"
                          onClick={() => toggleSelected(delivery.id)}
                          className={cx(
                            "mt-1 grid h-6 w-6 shrink-0 place-items-center rounded-lg border text-xs font-black",
                            checked
                              ? "border-cyan-400 bg-cyan-500 text-white"
                              : "border-white/20 text-slate-500"
                          )}
                        >
                          {checked ? "✓" : ""}
                        </button>

                        <button
                          type="button"
                          onClick={() => setSelectedDeliveryId(delivery.id)}
                          className="min-w-0 flex-1 text-left"
                        >
                          <div className="flex flex-wrap gap-2">
                            <Pill tone={statusTone(delivery.status)}>{delivery.status}</Pill>
                            <Pill tone={urgencyTone(delivery.urgency)}>{delivery.urgency}</Pill>
                            <Pill tone={channelTone(delivery.channel)}>{delivery.channel}</Pill>
                            {delivery.simulated ? <Pill tone="slate">Simulated</Pill> : null}
                          </div>

                          <h3 className="mt-3 line-clamp-2 text-base font-black text-white">
                            {delivery.title}
                          </h3>

                          <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-400">
                            {delivery.body}
                          </p>

                          <div className="mt-3 flex flex-wrap gap-2 text-[11px] font-bold text-slate-500">
                            <span>{relativeTime(delivery.createdAt)}</span>
                            <span>·</span>
                            <span>Score {delivery.score}</span>
                            {delivery.destination ? (
                              <>
                                <span>·</span>
                                <span>{delivery.destination}</span>
                              </>
                            ) : null}
                          </div>
                        </button>
                      </div>
                    </article>
                  );
                })}

                {!filteredDeliveries.length ? (
                  <div className="rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm font-bold text-slate-500">
                    No deliveries match the current filter.
                  </div>
                ) : null}
              </div>
            </Card>

            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                Delivery Detail
              </div>

              {selectedDelivery ? (
                <div className="mt-4 grid gap-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h2 className="text-2xl font-black text-white">
                        {selectedDelivery.title}
                      </h2>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Pill tone={statusTone(selectedDelivery.status)}>
                          {selectedDelivery.status}
                        </Pill>
                        <Pill tone={urgencyTone(selectedDelivery.urgency)}>
                          {selectedDelivery.urgency}
                        </Pill>
                        <Pill tone={channelTone(selectedDelivery.channel)}>
                          {selectedDelivery.channel}
                        </Pill>
                      </div>
                    </div>

                    <ScoreRing score={selectedDelivery.score} />
                  </div>

                  <Panel tone={statusTone(selectedDelivery.status)} className="bg-black/35">
                    <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                      Message
                    </div>
                    <p className="mt-3 whitespace-pre-wrap text-sm leading-7 text-slate-300">
                      {selectedDelivery.body}
                    </p>
                  </Panel>

                  {selectedDelivery.reason ? (
                    <Panel tone="amber" className="bg-black/35">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Reason
                      </div>
                      <p className="mt-3 text-sm leading-7 text-slate-300">
                        {selectedDelivery.reason}
                      </p>
                    </Panel>
                  ) : null}

                  <div className="grid gap-3 md:grid-cols-2">
                    <Panel className="bg-black/35">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Created
                      </div>
                      <div className="mt-2 text-sm font-black text-white">
                        {formatDateTime(selectedDelivery.createdAt)}
                      </div>
                    </Panel>

                    <Panel className="bg-black/35">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Delivered
                      </div>
                      <div className="mt-2 text-sm font-black text-white">
                        {formatDateTime(selectedDelivery.deliveredAt)}
                      </div>
                    </Panel>

                    <Panel className="bg-black/35">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Destination
                      </div>
                      <div className="mt-2 truncate text-sm font-black text-white">
                        {selectedDelivery.destination ?? "Dashboard / internal"}
                      </div>
                    </Panel>

                    <Panel className="bg-black/35">
                      <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                        Delivery Mode
                      </div>
                      <div className="mt-2 text-sm font-black text-white">
                        {selectedDelivery.simulated ? "Simulated" : "Live"}
                      </div>
                    </Panel>
                  </div>

                  <div className="grid gap-2 md:grid-cols-3">
                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        runAction("markReviewed", {
                          deliveryId: selectedDelivery.id,
                        })
                      }
                      className="rounded-2xl bg-white px-4 py-3 text-xs font-black text-slate-950 disabled:opacity-50"
                    >
                      Mark Reviewed
                    </button>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        runAction("retryDelivery", {
                          deliveryId: selectedDelivery.id,
                        })
                      }
                      className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-xs font-black text-amber-100 disabled:opacity-50"
                    >
                      Retry
                    </button>

                    <button
                      type="button"
                      disabled={loading}
                      onClick={() =>
                        runAction("archiveDelivery", {
                          deliveryId: selectedDelivery.id,
                        })
                      }
                      className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs font-black text-red-100 disabled:opacity-50"
                    >
                      Archive
                    </button>
                  </div>
                </div>
              ) : (
                <div className="mt-4 rounded-2xl border border-dashed border-white/10 p-10 text-center text-sm font-bold text-slate-500">
                  Select a delivery to view details.
                </div>
              )}
            </Card>
          </section>
        ) : null}

        {view === "preferences" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_420px]">
            <Card>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
                <div>
                  <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                    Notification Preferences
                  </div>
                  <h2 className="mt-2 text-2xl font-black text-white">
                    Channel rules, thresholds, and quiet windows
                  </h2>
                  <p className="mt-2 max-w-4xl text-sm leading-6 text-slate-400">
                    Control how aggressively Slice sends dashboard, email, SMS, push, or digest notifications.
                    Higher thresholds reduce noise; digest-only keeps updates bundled.
                  </p>
                </div>

                <Pill tone="green">{metrics.activeChannels} enabled</Pill>
              </div>

              <div className="mt-5 grid gap-4 md:grid-cols-2 2xl:grid-cols-3">
                {preferences.map((preference) => {
                  const readiness = channelReadiness.find(
                    (item) => item.preference.id === preference.id
                  );

                  return (
                    <Panel
                      key={preference.id}
                      tone={preference.enabled ? channelTone(preference.channel) : "slate"}
                      className="bg-black/30"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap gap-2">
                            <Pill tone={preference.enabled ? "green" : "slate"}>
                              {preference.enabled ? "Enabled" : "Disabled"}
                            </Pill>
                            {preference.digestOnly ? <Pill tone="purple">Digest only</Pill> : null}
                          </div>

                          <h3 className="mt-3 text-2xl font-black text-white">
                            {preference.channel}
                          </h3>
                          <p className="mt-2 text-xs leading-5 text-slate-500">
                            Min urgency {preference.minUrgency} · score {preference.minScore}+ · cooldown {preference.cooldownMinutes}m
                          </p>
                        </div>

                        <button
                          type="button"
                          onClick={() =>
                            updatePreference(preference, {
                              enabled: !preference.enabled,
                            })
                          }
                          className={cx(
                            "rounded-2xl px-4 py-2 text-xs font-black",
                            preference.enabled
                              ? "border border-red-500/30 bg-red-500/10 text-red-100"
                              : "bg-white text-slate-950"
                          )}
                        >
                          {preference.enabled ? "Disable" : "Enable"}
                        </button>
                      </div>

                      <div className="mt-4 grid gap-3">
                        <div>
                          <div className="flex items-center justify-between text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                            <span>Health</span>
                            <span>{readiness?.health ?? 0}%</span>
                          </div>
                          <div className="mt-2 h-2 overflow-hidden rounded-full bg-white/10">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-cyan-500 to-emerald-400"
                              style={{ width: `${readiness?.health ?? 0}%` }}
                            />
                          </div>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                          <label>
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                              Min Score
                            </span>
                            <input
                              type="number"
                              min={0}
                              max={100}
                              value={preference.minScore}
                              onChange={(event) =>
                                updatePreference(preference, {
                                  minScore: Number(event.target.value),
                                })
                              }
                              className={cx(inputClass, "mt-2 w-full")}
                            />
                          </label>

                          <label>
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                              Min Urgency
                            </span>
                            <select
                              value={preference.minUrgency}
                              onChange={(event) =>
                                updatePreference(preference, {
                                  minUrgency: event.target.value,
                                })
                              }
                              className={cx(inputClass, "mt-2 w-full")}
                            >
                              <option>Low</option>
                              <option>Medium</option>
                              <option>High</option>
                              <option>Critical</option>
                            </select>
                          </label>
                        </div>

                        <div className="grid gap-2 md:grid-cols-2">
                          <label>
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                              Quiet Start
                            </span>
                            <input
                              value={preference.quietHoursStart ?? ""}
                              onChange={(event) =>
                                updatePreference(preference, {
                                  quietHoursStart: event.target.value || null,
                                })
                              }
                              placeholder="21:00"
                              className={cx(inputClass, "mt-2 w-full")}
                            />
                          </label>

                          <label>
                            <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                              Quiet End
                            </span>
                            <input
                              value={preference.quietHoursEnd ?? ""}
                              onChange={(event) =>
                                updatePreference(preference, {
                                  quietHoursEnd: event.target.value || null,
                                })
                              }
                              placeholder="07:00"
                              className={cx(inputClass, "mt-2 w-full")}
                            />
                          </label>
                        </div>

                        <label>
                          <span className="text-[10px] font-black uppercase tracking-[0.16em] text-slate-500">
                            Cooldown Minutes
                          </span>
                          <input
                            type="number"
                            value={preference.cooldownMinutes}
                            onChange={(event) =>
                              updatePreference(preference, {
                                cooldownMinutes: Number(event.target.value),
                              })
                            }
                            className={cx(inputClass, "mt-2 w-full")}
                          />
                        </label>

                        <label className="flex items-center justify-between gap-3 rounded-2xl border border-white/10 bg-black/35 px-4 py-3 text-sm font-bold text-slate-300">
                          Digest only
                          <input
                            type="checkbox"
                            checked={preference.digestOnly}
                            onChange={(event) =>
                              updatePreference(preference, {
                                digestOnly: event.target.checked,
                              })
                            }
                          />
                        </label>
                      </div>
                    </Panel>
                  );
                })}
              </div>
            </Card>

            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                Channel Readiness
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                Delivery health by channel
              </h2>

              <div className="mt-5 grid gap-3">
                {channelReadiness.map((item) => (
                  <Panel key={item.preference.id} tone={channelTone(item.preference.channel)} className="bg-black/35">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="font-black text-white">{item.preference.channel}</div>
                        <div className="mt-1 text-xs text-slate-500">
                          {item.delivered} delivered · {item.failed} failed · {item.total} total
                        </div>
                      </div>
                      <Pill tone={item.preference.enabled ? "green" : "slate"}>
                        {item.preference.enabled ? "On" : "Off"}
                      </Pill>
                    </div>

                    <div className="mt-3 h-2 overflow-hidden rounded-full bg-white/10">
                      <div
                        className="h-full rounded-full bg-gradient-to-r from-red-500 via-amber-400 to-emerald-400"
                        style={{ width: `${item.health}%` }}
                      />
                    </div>
                  </Panel>
                ))}
              </div>
            </Card>
          </section>
        ) : null}

        {view === "digests" ? (
          <section className="grid gap-5 xl:grid-cols-[420px_minmax(0,1fr)]">
            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-purple-400">
                Digest Control
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                Reduce noise with summaries
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Digests summarize noteworthy items so advisors can review batches instead of receiving constant interruptions.
              </p>

              <div className="mt-5 grid gap-3">
                <Metric
                  label="Digest Reports"
                  value={digests.length}
                  helper="Generated summaries"
                  tone="purple"
                />
                <Metric
                  label="Total Items"
                  value={digests.reduce((sum, digest) => sum + digest.itemCount, 0)}
                  helper="Across digests"
                  tone="cyan"
                />
                <button
                  type="button"
                  onClick={() => runAction("digest")}
                  disabled={loading}
                  className="rounded-2xl bg-white px-5 py-3 text-sm font-black text-slate-950 disabled:opacity-50"
                >
                  Generate Digest
                </button>
              </div>
            </Card>

            <div className="grid gap-4">
              {digestItems.map(({ digest, items, urgencyMix }) => (
                <Card key={digest.id}>
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div>
                      <div className="flex flex-wrap gap-2">
                        <Pill tone="purple">{digest.status}</Pill>
                        <Pill tone="amber">{digest.itemCount} items</Pill>
                        <Pill tone="slate">{relativeTime(digest.createdAt)}</Pill>
                      </div>

                      <h3 className="mt-3 text-2xl font-black text-white">
                        {digest.title}
                      </h3>
                      <p className="mt-2 text-sm leading-7 text-slate-400">
                        {digest.summary}
                      </p>
                    </div>

                    <div className="grid min-w-[220px] gap-2 rounded-2xl border border-white/10 bg-black/35 p-3">
                      {Object.entries(urgencyMix).map(([key, value]) => (
                        <div key={key} className="flex items-center justify-between gap-3">
                          <span className="text-xs font-bold text-slate-400">{key}</span>
                          <Pill tone={urgencyTone(key)}>{value}</Pill>
                        </div>
                      ))}

                      {!Object.keys(urgencyMix).length ? (
                        <div className="text-xs font-bold text-slate-500">No urgency mix stored.</div>
                      ) : null}
                    </div>
                  </div>

                  {items.length ? (
                    <div className="mt-5 grid gap-3 md:grid-cols-2">
                      {items.slice(0, 8).map((item) => (
                        <Panel key={`${digest.id}-${item.title}-${item.score}`} className="bg-black/35" tone={urgencyTone(item.urgency)}>
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <div className="font-black text-white">{item.title}</div>
                              <div className="mt-1 text-xs text-slate-500">
                                {item.source} · {item.ticker ?? "General"}
                              </div>
                            </div>
                            <Pill tone={scoreTone(item.score)}>{item.score}</Pill>
                          </div>
                        </Panel>
                      ))}
                    </div>
                  ) : null}
                </Card>
              ))}

              {!digests.length ? (
                <Card className="grid min-h-[320px] place-items-center text-center">
                  <div>
                    <Pill tone="purple">No digests yet</Pill>
                    <h2 className="mt-4 text-3xl font-black text-white">
                      Generate your first alert digest.
                    </h2>
                    <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-400">
                      Digests collect noteworthy intelligence and delivery events into a calmer review format.
                    </p>
                  </div>
                </Card>
              ) : null}
            </div>
          </section>
        ) : null}

        {view === "command" ? (
          <section className="grid gap-5 xl:grid-cols-[1fr_1fr]">
            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-green-400">
                Command Actions
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                One-click alert operations
              </h2>
              <p className="mt-2 text-sm leading-6 text-slate-400">
                Use this consolidated control area to move alerts through the full notification cycle.
              </p>

              <div className="mt-5 grid gap-3 md:grid-cols-3">
                <button
                  type="button"
                  onClick={() => runAction("queue")}
                  disabled={loading}
                  className="rounded-2xl border border-red-500/30 bg-red-500/10 px-4 py-5 text-sm font-black text-red-100 disabled:opacity-50"
                >
                  Queue Alerts
                </button>
                <button
                  type="button"
                  onClick={() => runAction("process")}
                  disabled={loading}
                  className="rounded-2xl bg-white px-4 py-5 text-sm font-black text-slate-950 disabled:opacity-50"
                >
                  Process Queue
                </button>
                <button
                  type="button"
                  onClick={() => runAction("digest")}
                  disabled={loading}
                  className="rounded-2xl border border-purple-500/30 bg-purple-500/10 px-4 py-5 text-sm font-black text-purple-100 disabled:opacity-50"
                >
                  Digest
                </button>
              </div>

              <div className="mt-5 grid gap-3 md:grid-cols-2">
                <Panel tone="red" className="bg-black/35">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Noise Control
                  </div>
                  <div className="mt-2 text-3xl font-black text-white">
                    {metrics.suppressed}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Suppressed items are signals that did not meet channel rules or were blocked by delivery preferences.
                  </p>
                </Panel>

                <Panel tone="green" className="bg-black/35">
                  <div className="text-[10px] font-black uppercase tracking-[0.18em] text-slate-500">
                    Delivery Path
                  </div>
                  <div className="mt-2 text-3xl font-black text-white">
                    {metrics.delivered}/{metrics.totalDeliveries}
                  </div>
                  <p className="mt-2 text-sm leading-6 text-slate-400">
                    Delivered items have cleared the queue and were recorded in the notification audit trail.
                  </p>
                </Panel>
              </div>
            </Card>

            <Card>
              <div className="text-[10px] font-black uppercase tracking-[0.2em] text-cyan-400">
                System Health
              </div>
              <h2 className="mt-2 text-2xl font-black text-white">
                Notification pipeline snapshot
              </h2>

              <div className="mt-5 grid gap-3">
                {[
                  ["Queue", metrics.queued, metrics.queued ? "amber" : "green"],
                  ["Failures", metrics.failed, metrics.failed ? "red" : "green"],
                  ["Reviewed", metrics.reviewed, "cyan"],
                  ["Email Events", metrics.email, "green"],
                  ["Dashboard Events", metrics.dashboard, "cyan"],
                  ["Archived", metrics.archived, "slate"],
                ].map(([label, value, tone]) => (
                  <Panel key={label as string} tone={tone as Tone} className="bg-black/35">
                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <div className="text-sm font-black text-white">{label}</div>
                        <div className="mt-1 text-xs text-slate-500">Current recorded count</div>
                      </div>
                      <div className="text-2xl font-black text-white">{value as number}</div>
                    </div>
                  </Panel>
                ))}
              </div>
            </Card>
          </section>
        ) : null}
      </div>
    </main>
  );
}